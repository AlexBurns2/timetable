"""Synthwave's street scene, from the owner's Blender model (models/synth/cinema.blend) to models/synth/cinema.glb.

The model is theirs and will change. So nothing here knows its shapes: only a few names.
What the page (fx/synth.js, the street scene) is given:

  parts (meshes, by what they are; the page gives each its look)
    building       faces with the material "building"
    glass          faces with the material "glass facade": the page puts a lit lobby behind them
    structure      meshes with no material (the canopy's rings, the tower, the sign's fin): dark painted metal
    letters        the material "CINEMA sign": the sign's letters. They are the black holders; the neon is drawn from `sign`, below
    neon <colour>  the materials "neon blue", "neon red"...: lit tubes
    sidewalk       every raised flat top in a "road" mesh (the pavements), each as a block. The road itself is not kept:
                   the page's ground is one wet mirror. What is cut off at the model's edge is run on (towards us, and out
                   to either side along the waterfront), so the picture has no end.
  layout (in the file's extras)
    car, store     the boxes named "car" and "video store": where the page puts its own car, and builds the shop
    ground         the road mesh's extent; water starts past its far edge
    pad            a raised top lower than a kerb (the strip of road before the cinema): its outline, in case it is wanted
    glass          each pane of the glass front: four corners
    sign           the lines the sign's neon tubes follow (the page makes the tubes), lifted a little off the letters'
                   faces: round each heavy stroke, set in from its edge (loops); down the middle of each hairline (lines)
    glow           where the neon is, for lighting what is near it: rings (centre, radius) and points, each with its colour
    cam            the model's camera

Axes: three.js's (x right, y up, z towards us); metres. The export turns Blender's z-up into that.

usage (from the repo root; NumPy and OpenCV needed):
  1. in Blender: File > Export > glTF 2.0, format glTF Binary, Include: Visible Objects and Cameras, Transform: +Y Up,
     Mesh: Apply Modifiers. Save it anywhere outside the repo (it is big, and only the lean copy is shipped).
  2. python -P tools/synth/cinema.py <that file.glb> [--out models/synth/cinema.glb]
"""
import json, struct, sys, argparse, math
import numpy as np, cv2

CT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4), 5121: ('B', 1), 5122: ('h', 2)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def load(f):
    b = open(f, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20 + jl]); bo = 20 + jl; bl = struct.unpack_from('<I', b, bo)[0]; bn = b[bo + 8:bo + 8 + bl]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; fmt, sz = CT[a['componentType']]; n = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', sz * n)
        if st == sz * n: return np.frombuffer(bn, dtype='<' + fmt, count=a['count'] * n, offset=off).reshape(a['count'], n).astype(np.float64)
        return np.array([struct.unpack_from('<' + fmt * n, bn, off + k * st) for k in range(a['count'])], np.float64)
    return j, acc
def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def local(n):
    M = np.eye(4); M[:3, :3] = qmat(n.get('rotation', [0, 0, 0, 1])) @ np.diag(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0]); return M

def read(f):
    """every mesh in world space: [{ node, mat, tri: (n, 3, 3) }], and the cameras"""
    j, acc = load(f); par = {}
    for i, n in enumerate(j['nodes']):
        for c in n.get('children', []): par[c] = i
    def world(i): return (world(par[i]) if i in par else np.eye(4)) @ local(j['nodes'][i])
    out = []
    for i, n in enumerate(j['nodes']):
        if 'mesh' not in n: continue
        W = world(i)
        for p in j['meshes'][n['mesh']]['primitives']:
            pos = acc(p['attributes']['POSITION']) @ W[:3, :3].T + W[:3, 3]
            idx = acc(p['indices']).astype(int).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
            if np.linalg.det(W[:3, :3]) < 0: idx = idx[:, ::-1]
            out.append({'node': n.get('name', ''), 'mat': j['materials'][p['material']]['name'] if 'material' in p else None, 'tri': pos[idx]})
    cams = [(world(i), j['cameras'][n['camera']]) for i, n in enumerate(j['nodes']) if 'camera' in n]
    return out, cams

def fnormals(tri):
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
def R(v, d=3): return [round(float(x), d) for x in v]

# ── outlines of a flat set of triangles, seen from above ──
def loops_of(tri):
    key = lambda p: (round(p[0], 3), round(p[2], 3)); E = {}
    for t in tri:
        if (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]) - (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]) < 0: t = t[::-1]      # all wound the same way, seen from above
        for a, b in ((0, 1), (1, 2), (2, 0)): E[(key(t[a]), key(t[b]))] = 1
    nxt = {a: b for (a, b) in E if (b, a) not in E}; out = []
    while nxt:
        a0 = next(iter(nxt)); loop = [a0]; b = nxt.pop(a0)
        while b != a0 and b in nxt: loop.append(b); b = nxt.pop(b)
        out.append(loop)
    res = []
    for lp in out:                                           # drop points on a straight run; turn it anticlockwise (x, z)
        p = np.array(lp); keep = []
        for i in range(len(p)):
            a, b, c = p[i - 1], p[i], p[(i + 1) % len(p)]
            if abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-6: keep.append(b)
        p = np.array(keep)
        if len(p) < 3: continue
        if np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]) < 0: p = p[::-1]
        res.append(p)
    return res
def ears(p):
    """triangles (index triples) of a simple polygon, anticlockwise"""
    idx = list(range(len(p))); out = []
    cross = lambda a, b, c: (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]; a, b, c = p[i0], p[i1], p[i2]
            if cross(a, b, c) <= 1e-9: continue
            if any(cross(a, b, p[m]) > -1e-9 and cross(b, c, p[m]) > -1e-9 and cross(c, a, p[m]) > -1e-9 for m in idx if m not in (i0, i1, i2)): continue
            out.append((i0, i1, i2)); idx.pop(k); break
        else: break
    if len(idx) == 3: out.append(tuple(idx))
    return out
def prism(loop, y):
    """a block from an outline (x, z) at height y down to just under the ground: its top and its sides"""
    t = []
    for a, b, c in ears(loop): t.append([[loop[a][0], y, loop[a][1]], [loop[c][0], y, loop[c][1]], [loop[b][0], y, loop[b][1]]])
    for i in range(len(loop)):
        a, b = loop[i], loop[(i + 1) % len(loop)]
        t.append([[a[0], y, a[1]], [b[0], y, b[1]], [b[0], -.03, b[1]]]); t.append([[a[0], y, a[1]], [b[0], -.03, b[1]], [a[0], -.03, a[1]]])
    return np.array(t)

# ── the sign: the lines its neon follows ──
def sign_lines(tri, inset=.045, lift=.035, res=500):
    P = tri.reshape(-1, 3); x, z = P[:, 0], P[:, 2]
    A = np.c_[2 * x, 2 * z, np.ones(len(x))]; sol = np.linalg.lstsq(A, x * x + z * z, rcond=None)[0]; cx, cz = sol[0], sol[1]; Rr = math.sqrt(max(sol[2] + cx * cx + cz * cz, 0))
    rad = np.hypot(x - cx, z - cz); curved = Rr < 200 and np.std(rad) < .25 * max(Rr, 1e-6)
    n = fnormals(tri); c = tri.mean(1)
    if curved:
        th0 = math.atan2(np.mean(z) - cz, np.mean(x) - cx)
        def uv(p): th = np.arctan2(p[..., 2] - cz, p[..., 0] - cx) - th0; th = (th + np.pi) % (2 * np.pi) - np.pi; return np.stack([th * Rr, p[..., 1]], -1)
        rd = np.stack([c[:, 0] - cx, 0 * c[:, 0], c[:, 2] - cz], 1); rd /= np.maximum(np.linalg.norm(rd, axis=1, keepdims=True), 1e-9)
        cap = np.abs((n * rd).sum(1)) > .7; cr = np.hypot(c[:, 0] - cx, c[:, 2] - cz)                # the letters' two faces (whichever way they are wound: a mesh can be inside out)...
        front = cap & (cr > (cr[cap].min() + cr[cap].max()) / 2); face_r = cr[front].max()            # ...and the outer of them
        def back(u, v): th = u / Rr + th0; r = face_r + lift; return np.stack([cx + r * np.cos(th), v, cz + r * np.sin(th)], -1)
    else:                                                    # flat letters: a plane through them, facing the way most of their faces do
        w = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1); nn = (n * w[:, None]).sum(0); nn[1] = 0; nn /= np.linalg.norm(nn)
        side = np.array([-nn[2], 0, nn[0]]); o = P.mean(0)
        def uv(p): d = p - o; return np.stack([d @ side, p[..., 1]], -1)
        cap = np.abs(n @ nn) > .7; cd = (c - o) @ nn; front = cap & (cd > (cd[cap].min() + cd[cap].max()) / 2); dmax = cd[front].max()
        def back(u, v): return o + np.outer(u, side) + np.outer(dmax + lift, nn) * np.ones((len(u), 1)) + np.c_[0 * u, v - o[1], 0 * u]
    q = uv(tri[front]); lo = q.reshape(-1, 2).min(0) - .1; hi = q.reshape(-1, 2).max(0) + .1
    W, H = int((hi[0] - lo[0]) * res), int((hi[1] - lo[1]) * res); mask = np.zeros((H, W), np.uint8)
    pix = np.round((q - lo) * res).astype(np.int32); pix[..., 1] = H - 1 - pix[..., 1]
    for t in pix: cv2.fillConvexPoly(mask, t, 255)
    disc = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    k = int(round(inset * res)); er = cv2.morphologyEx(cv2.erode(mask, disc(k)), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    def to3(px): return np.round(back(px[:, 0] / res + lo[0], (H - 1 - px[:, 1]) / res + lo[1]), 3)
    def smooth(p, closed, s=5):
        ker = np.exp(-.5 * (np.arange(-3 * s, 3 * s + 1) / s) ** 2); ker /= ker.sum(); n = 3 * s
        if closed: ext = lambda v: np.r_[v[-n:], v, v[:n]]
        else: ext = lambda v: np.r_[2 * v[0] - v[n:0:-1], v, 2 * v[-1] - v[-2:-n - 2:-1]] if len(v) > n + 1 else np.r_[np.full(n, v[0]), v, np.full(n, v[-1])]
        return np.stack([np.convolve(ext(p[:, i]), ker, 'valid') for i in (0, 1)], 1)
    def rounded(p, closed, rho):
        """a bend, not a corner: each sharp turn replaced by a short arc (a tube of glass is bent, never creased)"""
        out = []; n = len(p)
        for i in range(n):
            if not closed and i in (0, n - 1): out.append(p[i]); continue
            a, b, c = p[i - 1], p[i], p[(i + 1) % n]; u, v = a - b, c - b; lu, lv = np.linalg.norm(u), np.linalg.norm(v)
            if lu < 1e-6 or lv < 1e-6: continue
            if (u / lu) @ (v / lv) < -.97: out.append(b); continue                       # nearly straight on
            r = min(rho, lu * .45, lv * .45); s0, s1 = b + u / lu * r, b + v / lv * r
            for t in (0, .25, .5, .75, 1): out.append((1 - t) ** 2 * s0 + 2 * t * (1 - t) * b + t * t * s1)
        return np.array(out)
    # the heavy strokes: a line round each, set in from its edge
    cs, _ = cv2.findContours(er, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE); loops = []; lines = []; dbg = []
    for ct in cs:
        p = ct[:, 0, :].astype(np.float64)
        if len(p) < 40: continue
        ap = cv2.approxPolyDP(smooth(p, True).astype(np.float32).reshape(-1, 1, 2), .003 * res, True)[:, 0, :].astype(np.float64)
        if len(ap) < 3: continue
        ap = rounded(ap, True, .03 * res); loops.append(to3(ap)); dbg.append((ap, True))
    # the hairlines: what the heavy strokes' line does not account for, thinned to its middle (Zhang and Suen's thinning)
    thin = (mask > 0) & ~(cv2.dilate(er, disc(k + 4)) > 0)
    thin = cv2.morphologyEx(thin.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    I = thin.copy()
    while True:
        ch = False
        for step in (0, 1):
            Pd = np.pad(I, 1); nb = [Pd[:-2, 1:-1], Pd[:-2, 2:], Pd[1:-1, 2:], Pd[2:, 2:], Pd[2:, 1:-1], Pd[2:, :-2], Pd[1:-1, :-2], Pd[:-2, :-2]]
            B = sum(x.astype(np.uint8) for x in nb); A = sum(((~nb[i]) & nb[(i + 1) % 8]).astype(np.uint8) for i in range(8))
            c = (~(nb[0] & nb[2] & nb[4]) & ~(nb[2] & nb[4] & nb[6])) if step == 0 else (~(nb[0] & nb[2] & nb[6]) & ~(nb[0] & nb[4] & nb[6]))
            rm = I & (B >= 2) & (B <= 6) & (A == 1) & c
            if rm.any(): I &= ~rm; ch = True
        if not ch: break
    # each thinned piece is walked end to end along its longest way through (a thinned line has stray pixels and tiny spurs,
    # so it cannot simply be followed from pixel to pixel); what is left over after that, if it is long enough, is walked too
    from collections import deque
    N8 = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]; stub = int(.06 * res)
    def far(comp, src):
        prev = {src: None}; dq = deque([src]); last = src
        while dq:
            q = dq.popleft(); last = q
            for dy, dx in N8:
                m = (q[0] + dy, q[1] + dx)
                if m in comp and m not in prev: prev[m] = q; dq.append(m)
        return last, prev
    todo = [set(map(tuple, np.argwhere(I)))]; paths = []
    while todo:
        comp = todo.pop()
        while comp:
            seed = next(iter(comp)); a, reach = far(comp, seed); piece = set(reach); comp -= piece
            if len(piece) < stub: continue
            b, prev = far(piece, a); path = [b]
            while prev[path[-1]] is not None: path.append(prev[path[-1]])
            if len(path) < stub: continue
            paths.append(path)
            rest = piece - {(q[0] + dy, q[1] + dx) for q in path for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)}
            if len(rest) >= stub: todo.append(rest)
    for path in paths:
        p = np.array(path, np.float64)[:, ::-1]
        if len(p) > .12 * res: p = p[int(.028 * res):-int(.028 * res)]                         # (its ends, where it meets a heavy stroke, curl: trimmed)
        if len(p) < .06 * res: continue                                                    # a stub (a heavy stroke's own sharp corner): not a line
        ap = cv2.approxPolyDP(smooth(p, False, 4).astype(np.float32).reshape(-1, 1, 2), .003 * res, False)[:, 0, :].astype(np.float64)
        if len(ap) < 2: continue
        ap = rounded(ap, False, .03 * res); lines.append(to3(ap)); dbg.append((ap, False))
    if DEBUG:
        img = cv2.cvtColor(mask // 3, cv2.COLOR_GRAY2BGR); img[thin] = (70, 40, 110)
        for ap, closed in dbg:
            cv2.polylines(img, [ap.astype(np.int32).reshape(-1, 1, 2)], closed, (120, 255, 120) if closed else (255, 220, 80), 2)
            for q in ap: cv2.circle(img, (int(q[0]), int(q[1])), 3, (255, 255, 255), -1)
        cv2.imwrite(DEBUG, img)
    return loops, lines, mask.shape

def weld(tri, ang=35):
    """indexed triangles: a corner shared where the faces round it are within `ang` degrees of one another, split where they are not"""
    n = fnormals(tri); cosA = math.cos(math.radians(ang)); byp = {}
    for f in range(len(tri)):
        for c in range(3): byp.setdefault(tuple(np.round(tri[f, c], 4)), []).append((f, c))
    pos = []; idx = np.zeros((len(tri), 3), int)
    for p, uses in byp.items():
        groups = []
        for f, c in uses:
            for g in groups:
                if float(n[f] @ g['n']) > cosA: g['m'].append((f, c)); break
            else: groups.append({'n': n[f], 'm': [(f, c)]})
        for g in groups:
            for f, c in g['m']: idx[f, c] = len(pos)
            pos.append(p)
    return np.array(pos), idx

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('--out', default='models/synth/cinema.glb'); ap.add_argument('--debug', default='', help="a picture of the sign's lines, to check them")
a = ap.parse_args(); DEBUG = a.debug
S, cams = read(a.src)
parts = {}; layout = {'walks': [], 'glass': [], 'glow': {'rings': [], 'pts': []}}
add = lambda name, tri: parts.setdefault(name, []).append(np.asarray(tri, np.float64))
roads = [s for s in S if s['mat'] == 'road']
area = lambda s: np.prod(np.ptp(s['tri'].reshape(-1, 3)[:, [0, 2]], axis=0))
ground = max(roads, key=area) if roads else None
if ground is not None:
    g = ground['tri'].reshape(-1, 3); gx0, gz0 = g[:, 0].min(), g[:, 2].min(); gx1, gz1 = g[:, 0].max(), g[:, 2].max()
    layout['ground'] = {'x0': round(gx0, 2), 'x1': round(gx1, 2), 'z0': round(gz0, 2), 'z1': round(gz1, 2)}
    for s in roads:
        t = s['tri']; n = fnormals(t); up = (np.abs(n[:, 1]) > .999) & (np.ptp(t[:, :, 1], axis=1) < .005); ys = np.round(t[up][:, :, 1].mean(1), 2)      # level faces, whichever way they are wound (a slab can be inside out)
        for y in sorted(set(ys.tolist())):
            if y < .03: continue                             # the road itself
            for lp in loops_of(t[up][ys == y]):
                if y < .14: layout['pad'] = {'y': y, 'loop': [R(p, 2) for p in lp]}; continue          # lower than a kerb: not a pavement
                lp = lp.copy(); layout['walks'].append({'y': y, 'loop': [R(p, 2) for p in lp]})
                lp[lp[:, 1] >= gz1 - 2.6, 1] = 70; lp[lp[:, 0] <= gx0 + .4, 0] = -240; lp[lp[:, 0] >= gx1 - .4, 0] = 240      # what the model's edge cut off, run on
                add('sidewalk', prism(lp, y))
for s in S:
    nm, mat, t = s['node'], s['mat'], s['tri']; P = t.reshape(-1, 3); lo, hi = P.min(0), P.max(0)
    low = nm.lower()
    if mat == 'road': continue
    if low == 'car' or low.startswith('car.'):
        d = hi - lo; layout['car'] = {'x': round((lo[0] + hi[0]) / 2, 2), 'z': round((lo[2] + hi[2]) / 2, 2), 'len': round(max(d[0], d[2]), 2), 'wid': round(min(d[0], d[2]), 2), 'h': round(d[1], 2), 'along': 'z' if d[2] >= d[0] else 'x'}
    elif low.startswith('video') or low.startswith('store') or low.startswith('record'):
        layout['store'] = {'x0': round(lo[0], 2), 'x1': round(hi[0], 2), 'z0': round(lo[2], 2), 'z1': round(hi[2], 2), 'y1': round(hi[1], 2)}
    elif mat and mat.lower().startswith('neon'):
        add(mat.lower(), t); col = mat.lower()[5:]; c = (lo + hi) / 2; d = hi - lo
        rad = np.hypot(P[:, 0] - c[0], P[:, 2] - c[2])
        if d[1] < .25 and min(d[0], d[2]) > 1 and np.std(rad) < .08 * rad.mean():
            layout['glow']['rings'].append({'c': R(c, 2), 'r': round(float(rad.mean()), 2), 'col': col})
        else:                                                # anything else: a few points spread over it
            k = int(np.clip(round(float(np.linalg.norm(d)) / 1.3), 2, 6)); pts = [P[np.argmin(((P - c) ** 2).sum(1))]]
            while len(pts) < k: dd = np.min([((P - q) ** 2).sum(1) for q in pts], 0); pts.append(P[np.argmax(dd)])
            layout['glow']['pts'] += [{'p': R(q, 2), 'col': col} for q in pts]
    elif mat and 'sign' in mat.lower():
        add('letters', t); loops, lines, shape = sign_lines(t)
        layout['sign'] = {'r': .022, 'loops': [lp.reshape(-1).tolist() for lp in loops], 'lines': [lp.reshape(-1).tolist() for lp in lines]}
        print('sign: %d outlines and %d hairlines, %d points (drawn at %d x %d)' % (len(loops), len(lines), sum(len(l) for l in loops + lines), shape[1], shape[0]))
    elif mat and 'glass' in mat.lower():
        add('glass', t); n = fnormals(t); done = np.zeros(len(t), bool)
        for i in range(len(t)):                              # a pane: the triangles in one plane; its four corners
            if done[i]: continue
            same = (n @ n[i] > .999) & (np.abs((t.mean(1) - t[i].mean(0)) @ n[i]) < .02); done |= same; q = np.unique(np.round(t[same].reshape(-1, 3), 3), axis=0)
            layout['glass'].append({'min': R(q.min(0), 2), 'max': R(q.max(0), 2), 'n': R(n[i], 3)})
    elif mat == 'building':
        add('building', t); n = fnormals(t); ar = np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1) / 2; best = {}
        for ax in (0, 2):                                    # its front: the biggest upright wall on the side the car is (or the lower x, or z)
            m = np.abs(n[:, ax]) > .95; ks = np.round(t[m][:, :, ax].mean(1) * 5) / 5
            for kx in set(ks.tolist()): best[(ax, kx)] = float(ar[m][ks == kx].sum())
        if best:
            ax = max(best, key=best.get)[0]; walls = sorted((k[1], v) for k, v in best.items() if k[0] == ax and v > .4 * max(v2 for k2, v2 in best.items() if k2[0] == ax))
            fx = walls[0][0]; m = (np.abs(n[:, ax]) > .95) & (np.abs(t[:, :, ax].mean(1) - fx) < .15); Q = t[m].reshape(-1, 3)
            layout['front'] = {'axis': 'xz'[ax // 2], 'at': round(float(Q[:, ax].mean()), 2), 'min': R(Q.min(0), 2), 'max': R(Q.max(0), 2)}
    else: add('structure', t)
if cams:
    W, c = cams[0]; layout['cam'] = {'pos': R(W[:3, 3], 2), 'dir': R(-W[:3, 2], 3), 'vfov': round(math.degrees(c['perspective']['yfov']), 1)}

# ── the lean file: one node; a primitive a part; positions as int16 over the model's own box ──
names = sorted(parts); allp = np.concatenate([np.concatenate(parts[n]).reshape(-1, 3) for n in names]); lo, hi = allp.min(0), allp.max(0)
ctr = (lo + hi) / 2; half = np.maximum((hi - lo) / 2, 1e-6)
bin_ = bytearray(); views = []; accs = []; prims = []; mats = []
def view(data, target):
    while len(bin_) % 4: bin_.append(0)
    views.append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data), 'target': target}); bin_.extend(data); return len(views) - 1
for nm in names:
    pos, idx = weld(np.concatenate(parts[nm]), 180 if nm.startswith('neon') else 35)
    assert len(pos) < 65536, nm
    q = np.round((pos - ctr) / half * 32767).astype('<i2'); qmin, qmax = q.min(0).tolist(), q.max(0).tolist()
    accs.append({'bufferView': view(q.tobytes(), 34962), 'componentType': 5122, 'normalized': True, 'count': len(q), 'type': 'VEC3', 'min': qmin, 'max': qmax})
    accs.append({'bufferView': view(idx.astype('<u2').tobytes(), 34963), 'componentType': 5123, 'count': idx.size, 'type': 'SCALAR'})
    mats.append({'name': nm}); prims.append({'attributes': {'POSITION': len(accs) - 2}, 'indices': len(accs) - 1, 'material': len(mats) - 1})
    P = np.concatenate(parts[nm]).reshape(-1, 3); print('%-14s %6d triangles %6d points   %s .. %s' % (nm, idx.shape[0], len(pos), np.round(P.min(0), 2), np.round(P.max(0), 2)))
while len(bin_) % 4: bin_.append(0)
doc = {'asset': {'version': '2.0', 'generator': 'tools/synth/cinema.py'}, 'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
       'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'cinema', 'mesh': 0, 'scale': R(half, 5), 'translation': R(ctr, 5)}],
       'meshes': [{'name': 'cinema', 'primitives': prims}], 'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}], 'extras': layout}
js = json.dumps(doc, separators=(',', ':')).encode('utf-8'); js += b' ' * (-len(js) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(a.out, 'wb').write(out)
print('wrote', a.out, len(out) // 1024, 'KB;', 'layout:', {k: (len(v) if isinstance(v, list) else '…') for k, v in layout.items()})
