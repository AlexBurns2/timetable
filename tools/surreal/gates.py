"""Surrealism's planner scene (render.py imports it): a line of identical gateways crossing the Salar de Uyuni, rendered in
3D with a pinhole camera matched to the photograph (its horizon; a person's eye height), lit by a low sun just risen ahead
so their long shadows fall toward the viewer, and fading into the morning haze with distance.

Second version (26 November 2026; the owner: "the frames don't look realistic at all... the shading, the shapes are too
clean, the texture tiles awkwardly and they don't match the grading and resolution of the background"):
  - every pixel of a face is traced back to the face itself, and the concrete is made there, in metres, from noise: so
    nothing repeats, and each gateway is its own (a different patch of the same weathering). Pour lines at uneven
    heights, blotches, rain streaks down from the joints, and a crust of salt at the foot;
  - light: the low sun warm on what faces it, the dawn sky cool on everything, light bounced up off the white salt
    (strongest low down), darkness where a face meets the ground and under the lintel, a fine edge caught by the sun;
  - worn edges: see the third version below;
  - shadows darken and cool the salt (multiplied), so its crust still shows through them; dark where each pier stands;
  - matched to the photograph: drawn at 3x and brought down, softened to the photo's own sharpness, the photo's own grain
    measured and added, and the haze growing with distance.
Third version (27 November 2026; the owner: "Chipping on the frames... They need to look like real objects"): every edge is
broken back by an amount worked out along the edge itself (fine nicks, chips, now and then a bigger piece, corners of the
lintel knocked off), the same for both faces that share it. Where the edge is the outline, the chip is gone and what's behind
shows through; where both faces are in view, it's broken concrete (faceted, rough, lighter, a crack where it stops). Edges on
the ground or where a pier meets the lintel stay whole. A few shallow flakes off the faces as well.
Each gateway is three boxes (two piers and a lintel); faces are drawn far to near."""
import math, zlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 3                                               # drawn at 3x, then brought down

def vnoise(x, y, seed, scale):
    """smooth value noise at `scale` metres (bilinear over a hashed lattice), 0..1"""
    gx, gy = x / scale, y / scale
    x0, y0 = np.floor(gx).astype(np.int64), np.floor(gy).astype(np.int64)
    fx, fy = gx - x0, gy - y0
    def h(ix, iy):
        v = (ix * 374761393 + iy * 668265263 + seed * 144269504) & 0xffffffff
        v = (v ^ (v >> 13)) * 1274126177 & 0xffffffff
        return ((v ^ (v >> 16)) & 0xffff) / 65535.0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx
    b = h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx
    return a * (1 - sy) + b * sy

def concrete(u, v, seed, height):
    """the face's concrete at (u along it, v up it; metres): albedo 0..1, and a salt crust (0..1) at its foot"""
    n = lambda s, k, o=0: vnoise(u + o * 31.7, v, seed * 7 + k, s)
    t = 0.5 + (n(1.1, 1) - .5) * .5 + (n(.35, 2) - .5) * .3 + (n(.08, 3) - .5) * .18 + (n(.025, 4) - .5) * .12
    # pour lines: uneven lifts, each a touch different, the seam itself thin, dark and a little wavy
    rng = np.random.default_rng(seed + 11)
    lifts = np.cumsum(rng.uniform(.48, .92, 24)); lifts = lifts[lifts < height]
    prev = 0.0
    for k, L in enumerate(lifts):
        wav = (n(.6, 20 + k) - .5) * .05
        d = np.abs(v - L - wav)
        t = t - .18 * np.exp(-(d / .02) ** 2)
        t = t + ((v > prev) & (v <= L)) * (rng.random() - .5) * .09          # each pour a touch lighter or darker
        # the formwork's tie holes: a row of small dark dots halfway up each pour, about every 0.6 m
        mid = (prev + L) / 2; du = (u % .6) - .3
        t = t - .28 * np.exp(-((v - mid) ** 2 + du ** 2) / .0012)
        prev = L
    # rain: darker streaks down from the top and from each joint, fading as they go
    st = np.clip((vnoise(u * 9.0, 0 * v, seed + 40, 1.0) - .58) * 3.2, 0, 1)
    t = t - st * .16 * np.clip((height - v) / height, 0, 1) ** .4 * (.55 + .45 * n(.5, 41))
    # salt crust at the foot: white, its top edge ragged
    edge = .14 + .16 * n(.22, 50) + .06 * n(.05, 51)
    crust = np.clip((edge - v) / .05, 0, 1)
    return np.clip(t, 0, 1), crust

def render(ph, horizon=0.584, f=1750.0, eye=1.65, count=8):
    W, H = ph.size; cx, yh = W / 2, horizon * H
    def P(x, y, z):                                   # world (x right, y up, z ahead) to the photo
        return (cx + f * x / z, yh - f * (y - eye) / z)
    cam = np.array([0.0, eye, 0.0])
    sun = np.array([0.42, 0.15, 1.0]); sun /= np.linalg.norm(sun)       # low, ahead and to the right: the shadows come at us
    base = np.asarray(ph, np.float32) / 255
    # the photograph's own grain and softness, from the plain sky up top
    sky = base[40:200, 200:1700].mean(-1)
    hp = sky - np.asarray(Image.fromarray((sky * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255
    GRAIN = float(np.clip(hp.std(), .004, .03))
    # the gateways: along a straight line from near-right to the horizon on the left, all turned the same way
    gates = []
    for i in range(count):
        z = 44 * (1.0 + 1.0 * i) ** 1.5
        x = 16.5 - 0.31 * (z - 44)
        gates.append((x, z))
    turn = math.radians(-20)
    ca, sa = math.cos(turn), math.sin(turn)
    WG, HG, TG, PG, LH = 6.0, 9.4, 1.3, 1.35, 1.6     # opening width, pier height, depth, pier width, lintel height
    def box(x0, z0, a, b, c, d, y0, y1):
        pts = []
        for lx in (a, b):
            for ly in (y0, y1):
                for lz in (c, d):
                    pts.append(np.array([x0 + lx * ca - lz * sa, ly, z0 + lx * sa + lz * ca]))
        return pts
    def gate(x0, z0):
        return [box(x0, z0, -WG / 2 - PG, -WG / 2, -TG / 2, TG / 2, 0, HG), box(x0, z0, WG / 2, WG / 2 + PG, -TG / 2, TG / 2, 0, HG),
                box(x0, z0, -WG / 2 - PG, WG / 2 + PG, -TG / 2, TG / 2, HG, HG + LH)]
    FACES = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
    haze = np.array([0.80, 0.80, 0.90])                 # the far air at the horizon

    # ── shadows on the salt, far to near: the salt darkened and cooled (multiplied), so its crust shows through ──
    tint = np.array([0.50, 0.56, 0.76], np.float32)
    for (gx, gz) in sorted(gates, key=lambda g: -g[1]):
        sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
        foot = Image.new('L', (W, H), 0); fd = ImageDraw.Draw(foot)
        for bi, pts in enumerate(gate(gx, gz)):
            gpts = []
            for p in pts:
                k = p[1] / sun[1]; q = p - k * sun
                if q[2] < 2.0: q = p - ((p[2] - 2.0) / sun[2]) * sun; q[1] = 0
                gpts.append(q)
            scr = np.array([P(*q) for q in gpts])
            d.polygon([tuple(v) for v in convex_hull(scr)], fill=255)
            if bi < 2:                                  # where each pier stands: a dark contact
                fp = np.array([P(*p) for p in pts if p[1] == 0])
                fd.polygon([tuple(v) for v in convex_hull(fp)], fill=255)
        blur = max(1.0, 260.0 / gz)
        a = np.asarray(sh.filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255 * min(0.62, 0.62 * (1 - math.exp(-60 / gz)) + 0.25)
        c = np.asarray(foot.filter(ImageFilter.GaussianBlur(max(.8, 40.0 / gz))), np.float32) / 255 * .55
        a = np.clip(a + c * (1 - a), 0, 1)
        base = base * (1 - a[..., None] * (1 - tint[None, None, :]))

    # ── the gateways, drawn at SS times the size into a layer over their own box, far to near ──
    allp = np.array([P(*p) for (gx, gz) in gates for pts in gate(gx, gz) for p in pts])
    X0, Y0 = int(max(0, allp[:, 0].min() - 4)), int(max(0, allp[:, 1].min() - 4))
    X1, Y1 = int(min(W, allp[:, 0].max() + 5)), int(min(H, allp[:, 1].max() + 5))
    LW, LH_ = (X1 - X0) * SS, (Y1 - Y0) * SS
    col = np.zeros((LH_, LW, 3), np.float32); alp = np.zeros((LH_, LW), np.float32)
    sunc = np.array([1.0, 0.80, 0.68]) * 1.02          # the low sun, warm
    skyc = np.array([0.62, 0.68, 0.88])                # the dawn sky, cool
    bnc = np.array([1.0, 0.90, 0.88])                  # light off the salt, which the low sun has turned pink
    # ── chipped edges: worked out along each edge (so the two faces either side of it break in the same places) ──
    seedof = lambda *k: zlib.crc32(repr(k).encode()) & 0xffff
    along = np.array([ca, 0.0, sa])
    def corner(gi, P):
        """how much of a corner is knocked off (metres); none where a pier meets the ground or the lintel"""
        if abs(P[1]) < 1e-6 or abs(P[1] - HG) < 1e-6: return 0.0
        r = np.random.default_rng(seedof('c', gi, *np.round(P, 2).tolist()))
        return float(r.uniform(.05, .18)) if r.random() < .5 else 0.0
    def edges_of(gi, bi, pts, info):
        """each edge of a box once: whether it's seen against what's behind it ('sil'), between two faces both in view
        ('int'), or isn't a real edge ('skip': on the ground, or where a pier meets the lintel)"""
        by = {}
        for fi, (fc, q, c, n, vis) in enumerate(info):
            for k in range(4):
                a, b = fc[k], fc[(k + 1) % 4]
                by.setdefault((min(a, b), max(a, b)), []).append(fi)
        T = {}
        for (lo, hi), fs in by.items():
            A, B = pts[lo], pts[hi]
            L = float(np.linalg.norm(B - A)); e = (B - A) / L
            E = dict(A=A, e=e, L=L, fs=fs, s0=0.0, win=None, seed=seedof(gi, bi, lo, hi), ca=corner(gi, A), cb=corner(gi, B))
            low_, top_ = max(A[1], B[1]) < 1e-6, abs(A[1] - HG) < 1e-6 and abs(B[1] - HG) < 1e-6
            vis = [info[g][4] for g in fs]
            if low_ or (top_ and (bi < 2 or abs(e @ along) < .9)) or not any(vis): E['kind'] = 'skip'
            else:
                E['kind'] = 'int' if all(vis) else 'sil'
                if abs(e[1]) > .9:          # upright: chipped by height, so a pier's edge carries on into the lintel's
                    E['s0'] = float(A[1]); E['seed'] = seedof('v', gi, round(float(A[0]), 2), round(float(A[2]), 2))
                    E['win'] = lambda y: np.clip((y - .25) / .35, 0, 1) * np.clip(np.abs(y - HG) / .35, 0, 1)
                elif top_:                  # the lintel's underside: only over the opening
                    E['win'] = lambda s: np.clip((s - PG) / .12, 0, 1) * np.clip((PG + WG - s) / .12, 0, 1)
            T[(lo, hi)] = E
        return T
    def depth_of(s, E, side):
        """how far the edge is broken back into the face (metres) at s along it"""
        t = s + E['s0']; z0 = np.zeros_like(t)
        nn = lambda sc, k: vnoise(t, z0, E['seed'] + k, sc)
        # mostly a straight arris, broken now and then (sparse: a lot of it reads as a ruin, not a weathered frame)
        d = .004 + .010 * nn(.035, 1)                                                  # never a ruled line
        d = d + .03 * np.clip((nn(.06, 2) - .88) / .12, 0, 1) ** .8                     # nicks
        d = d + .08 * np.clip((nn(.28, 3) - .87) / .13, 0, 1) ** .7                     # chips (steep sided)
        d = d + .18 * np.clip((nn(1.4, 4) - .90) / .10, 0, 1) ** .7 * (.6 + .4 * nn(.06, 5))   # now and then a bigger piece
        for amp, sv in ((E['ca'], s), (E['cb'], E['L'] - s)):                          # corners knocked off: a slanted break, not rounded
            if amp > 0: d = d + amp * np.clip(1 - np.maximum(sv, 0) / (amp * 1.3), 0, 1) * (.8 + .4 * nn(.05, 6))
        d = d * (.72 + .56 * vnoise(t, z0 + 5.3 + side * 7.1, E['seed'] + 9, .16))    # the two faces of an edge break a little differently
        if E['win'] is not None: d = d * E['win'](t)
        return np.minimum(d, .4)

    for gi, (gx, gz) in enumerate(sorted(gates, key=lambda g: -g[1])):
        seed = 101 + gi * 17
        fade = 1 - math.exp(-gz / 450)
        faces = []
        for bi, pts in enumerate(gate(gx, gz)):
            bc = sum(pts) / 8; info = []
            for fc in FACES:
                q = [pts[k] for k in fc]
                c = sum(q) / 4
                n = np.cross(q[1] - q[0], q[3] - q[0]); n /= np.linalg.norm(n) + 1e-9
                if np.dot(n, c - bc) < 0: n = -n                     # outward
                info.append((fc, q, c, n, bool(np.dot(n, cam - c) > 0)))
            eds = edges_of(gi, bi, pts, info)
            for fi, (fc, q, c, n, vis) in enumerate(info):          # only the faces turned to us (a chip shows what's behind)
                if vis: faces.append((np.linalg.norm(c - cam), q, n, bi, fi, fc, c, info, eds))
        for dist, q, n, bi, fi, fc, cface, info, eds in sorted(faces, key=lambda v: -v[0]):
            scr = np.array([P(*p) for p in q])
            bx0, by0 = int(math.floor(scr[:, 0].min())) - 1, int(math.floor(scr[:, 1].min())) - 1
            bx1, by1 = int(math.ceil(scr[:, 0].max())) + 2, int(math.ceil(scr[:, 1].max())) + 2
            bx0, by0, bx1, by1 = max(bx0, X0), max(by0, Y0), min(bx1, X1), min(by1, Y1)
            if bx1 - bx0 < 1 or by1 - by0 < 1: continue
            # coverage of the face at SS, its outline worn a little (chipped corners and edges)
            m = Image.new('L', ((bx1 - bx0) * SS, (by1 - by0) * SS), 0)
            ImageDraw.Draw(m).polygon([((s[0] - bx0) * SS, (s[1] - by0) * SS) for s in scr], fill=255)
            cov = np.asarray(m, np.float32) / 255
            # each pixel back to the face: where on it (metres) it lands
            ys, xs = np.mgrid[0:cov.shape[0], 0:cov.shape[1]].astype(np.float32)
            px = bx0 + (xs + .5) / SS; py = by0 + (ys + .5) / SS
            dx, dy = (px - cx) / f, -(py - yh) / f
            dvec = np.stack([dx, dy, np.ones_like(dx)], -1)
            q0 = q[0]
            denom = dvec @ n
            tt = np.where(np.abs(denom) > 1e-6, float(np.dot(q0 - cam, n)) / np.where(np.abs(denom) > 1e-6, denom, 1), 0)
            hit = cam[None, None, :] + dvec * tt[..., None]
            up = np.array([0.0, 1.0, 0.0])
            e1 = np.cross(up, n); nr = np.linalg.norm(e1)
            e1 = e1 / nr if nr > 1e-6 else np.array([ca, 0.0, sa])     # (the lintel's top and underside: along the gate)
            u = (hit - q0[None, None, :]) @ e1 + gi * 13.0 + bi * 4.0
            v = hit[..., 1]
            alb, crust = concrete(u, v, seed + bi, HG + LH)
            # its chipped edges: on the outline the chip is gone (what's behind shows through, a rim of broken concrete
            # inside it); between two faces in view it's broken concrete, rough and lighter, with a dark crack where it stops
            mpp = dist / f                                   # metres to a photo pixel here
            cut = np.zeros_like(cov); brk = np.zeros_like(cov); crev = np.zeros_like(cov); hl = np.zeros_like(cov)
            deep = np.zeros_like(cov); nbs = np.zeros(cov.shape + (3,), np.float32)
            for k in range(4):
                a, b = fc[k], fc[(k + 1) % 4]
                E = eds[(min(a, b), max(a, b))]
                if E['kind'] == 'skip': continue
                other = info[[g for g in E['fs'] if g != fi][0]]
                perp = np.cross(n, E['e'])
                if np.dot(perp, cface - E['A']) < 0: perp = -perp
                rel = hit - E['A'][None, None, :]
                dd = rel @ perp; s = rel @ E['e']
                dep = depth_of(s, E, fi)
                ins = np.clip((dep - dd) / (mpp / SS) + .5, 0, 1)
                big = np.clip((dep - .03) / .05, 0, 1)
                nb = n + other[3]; nb = nb / (np.linalg.norm(nb) + 1e-9)
                if E['kind'] == 'sil':
                    w = np.clip(1 - (dd - dep) / np.maximum(.4 * dep, .01), 0, 1) * (dd >= dep) * big
                    cut = np.maximum(cut, ins)
                else:
                    w = ins * np.clip((dep - .012) / .02, 0, 1)        # (the arris's fine wear isn't a chip: no light line)
                    cw = max(.01, mpp / SS)                  # a crack a centimetre wide: fainter, not wider, far off
                    crev = np.maximum(crev, np.exp(-((dd - dep) / cw) ** 2) * big * (.01 / cw))
                upd = w > brk
                nbs[upd] = nb; deep[upd] = np.clip(dd / np.maximum(dep, 1e-4), 0, 1)[upd]
                brk = np.maximum(brk, w)
                hl = np.maximum(hl, np.exp(-((dd - dep) / (.6 * mpp)) ** 2) * (dd > dep - .5 * mpp))
            cov = cov * (1 - cut)
            # the light on it
            sunl = max(0.0, float(np.dot(n, sun)))
            amb = skyc * (0.44 + 0.24 * max(0.0, n[1]))
            low = (0.16 + 0.30 * np.clip(1 - v / 4.0, 0, 1) ** 1.4) * (1.0 if n[1] < .5 else 0.0)   # off the salt: all the way up, most low down
            ao = 1 - .38 * np.exp(-np.maximum(v, 0) / .28)                    # meeting the ground
            if bi < 2: ao = ao * (1 - .22 * np.clip((v - (HG - .9)) / .9, 0, 1))  # tucked under the lintel
            if bi == 2 and n[1] < -.5: ao = ao * .72                          # the lintel's underside
            light = (sunc * sunl)[None, None, :] + amb[None, None, :] + bnc[None, None, :] * low[..., None]
            albedo = (0.60 + 0.42 * (alb - .5))[..., None] * np.array([1.0, 0.985, 0.97])
            # here and there the weathered skin has flaked off: a shallow patch of fresher concrete, its top lip shading it
            if abs(n[1]) < .5:
                pm = lambda dv: np.clip((vnoise(u, v + dv, seed + 530 + bi, .38) + .22 * (vnoise(u, v + dv, seed + 531 + bi, .055) - .5) - .86) / .02, 0, 1)
                fl = pm(0) * np.clip((v - .5) / .3, 0, 1)
                if fl.max() > 0:
                    lip = fl * (1 - pm(.035))
                    fresh = .66 + .2 * (vnoise(u, v, seed + 540, .02) - .5) + .12 * (vnoise(u, v, seed + 541, .007) - .5)
                    albedo = albedo * (1 - fl[..., None] * .75) + (fresh[..., None] * np.array([1.0, .975, .95])) * fl[..., None] * .75
                    albedo = albedo * (1 - .32 * lip)[..., None]
            albedo = albedo * (1 - crust[..., None]) + np.array([0.93, 0.92, 0.95]) * crust[..., None]
            c = albedo * light * ao[..., None]
            # the broken concrete in the chips: faceted (its own light), rough with aggregate, darker deep in
            if brk.max() > 0:
                jit = np.stack([vnoise(u, v, seed + 610 + j, .04) - .5 for j in range(3)], -1)
                nbp = nbs + jit * .9; nbp /= np.linalg.norm(nbp, axis=-1, keepdims=True) + 1e-6
                lb = (sunc * np.clip(nbp @ sun, 0, None)[..., None] + skyc * (0.44 + 0.24 * np.clip(nbp[..., 1], 0, None))[..., None]
                      + bnc * (low * (1 + .6 * np.clip(-nbp[..., 1], 0, None)))[..., None])
                agg = .70 + .22 * (vnoise(u, v, seed + 620, .02) - .5) + .14 * (vnoise(u, v, seed + 621, .007) - .5)
                cb = (agg[..., None] * np.array([1.0, .975, .94])) * lb * (ao * (1 - .28 * deep ** 2))[..., None]
                c = c * (1 - brk[..., None]) + cb * brk[..., None]
            c = c * (1 - .45 * crev)[..., None]
            # the sun catching a lit face's edge (a fine bright line along the broken edge)
            if sunl > .15: c = c + (hl * (1 - brk))[..., None] * sunc * .10 * sunl
            c = c * (1 - fade) + haze * fade
            sl = (slice((by0 - Y0) * SS, (by1 - Y0) * SS), slice((bx0 - X0) * SS, (bx1 - X0) * SS))
            col[sl] = col[sl] * (1 - cov[..., None]) + c * cov[..., None]
            alp[sl] = alp[sl] * (1 - cov) + cov
    # down to the photograph's size (premultiplied box average), softened to its sharpness, its grain added
    pc = (col * alp[..., None]).reshape(Y1 - Y0, SS, X1 - X0, SS, 3).mean((1, 3))
    pa = alp.reshape(Y1 - Y0, SS, X1 - X0, SS).mean((1, 3))
    rgb = np.where(pa[..., None] > 1e-4, pc / np.maximum(pa[..., None], 1e-4), 0)
    soft = lambda a, s: np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(s)), np.float32) / 255
    rgb = np.stack([soft(rgb[..., k], .45) for k in range(3)], -1)
    pa = soft(pa, .45)
    rng = np.random.default_rng(3)
    rgb = rgb + rng.standard_normal(rgb.shape[:2])[..., None] * GRAIN
    seg = base[Y0:Y1, X0:X1]
    base[Y0:Y1, X0:X1] = seg * (1 - pa[..., None]) + np.clip(rgb, 0, 1) * pa[..., None]
    out = Image.fromarray((np.clip(base, 0, 1) * 255 + .5).astype(np.uint8))
    return out, gates

def convex_hull(pts):
    pts = sorted(map(tuple, pts))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]
