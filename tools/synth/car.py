"""Synthwave's parked car (the street scene): from Shotkey's "Alfa Romeo 164" to models/synth/car.glb and images/synth/car.webp.

The model:   https://sketchfab.com/3d-models/alfa-romeo-164-251a829903074fb19bfdb9878a1c1b4b
             by Shotkey (https://sketchfab.com/shotkey), licensed CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
             NOT CC0: its author must be credited (About > 3D credits does), and a changed version of it must carry the same
             licence. The two files this writes are changed versions of it, so they are CC BY-SA 4.0 as well.
The owner chose it (2026-11-23) to stand in for a car that had been built in code, and downloaded it themselves (Sketchfab's
"original format": source/alfa-164.obj and textures/main.png, a 4096 px photograph-based picture, among others).

What the page (fx/synth.js, the street scene) is given:

  models/synth/car.glb   one mesh, "car", one part, "body": positions (metres, the model's own size; the nose towards +z, the
                         middle of the car at x = 0 and z = 0, the tyres standing on y = 0), the model's own smooth normals,
                         its texture coordinates. 4,180 triangles. Nothing of its shape is changed.
  images/synth/car.webp  its picture REDRAWN in flat colours, 1024 px: every bit of the picture is one kind of thing (bodywork,
                         glass, a window's surround, a lamp, a plate, a tyre, a wheel, dark trim) and has that kind's one colour.
                         The rear lamps are one straight bar across the tail, as the real car's are. The wheels are a
                         gunmetal and the plates a dim lilac: nothing on the car is near white. A plain round emblem (a muted
                         silver ring) on the boot lid, above the lamp bar.
                         Its alpha is not transparency: it says how glossy that kind is (GLOSS below; 128 = matt, 255 = a
                         mirror), which is what the page's shader goes by for the neon the car catches. It starts at 128 and
                         not at 0 so that a browser which multiplies colour by alpha on the way in loses nothing of the colour.

Why redrawn. The model's own picture is photographs of a real car: beside a scene of flat colours it looked pasted in (the
owner: "too dissonant from the art style of the rest of the scene ... Really all that needs to be clear is windows, lights,
license plate, tyres, wheels"). It also shows what the site must not: the maker's badges (grille, boot, wheels), the model's
name in chrome, and a real registration plate. In the redrawn picture the badges and the lettering are gone (anything small
lying on the bodywork is painted over) and both plates are blank.

usage (from the repo root; needs NumPy and OpenCV):
  python -P tools/synth/car.py --src <folder holding alfa-164.obj and main.png> [--paint '#0f5a66']
                               [--out models/synth/car.glb] [--tex images/synth/car.webp] [--debug <prefix>]

  --paint  the bodywork's colour. A dark teal: the owner's choice (2026-11-23, "I think dark teal would be a good accent"),
           the one cool thing in a street of pink, magenta and purple. The model's own is a burgundy, about #771f31, which
           it wore here at first: "the red is outside the scene's palette".
  --debug  also writes <prefix>-flat.png (the picture), <prefix>-gloss.png (its alpha) and <prefix>-kinds.png (which kind
           each bit was taken for)

Run it with -P and never from inside the download folder: downloaded files are data, not code.
"""
import argparse, json, os, struct
import numpy as np, cv2

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ap = argparse.ArgumentParser(); ap.add_argument('--src', required=True); ap.add_argument('--paint', default='#0f5a66'); ap.add_argument('--debug')
ap.add_argument('--out', default=os.path.join(REPO, 'models', 'synth', 'car.glb')); ap.add_argument('--tex', default=os.path.join(REPO, 'images', 'synth', 'car.webp'))
a = ap.parse_args()
CREDIT = 'Alfa Romeo 164, by Shotkey (https://sketchfab.com/shotkey). CC BY-SA 4.0. Changed: recentred; its picture redrawn in flat colours (the bodywork a dark teal), without badges or plates.'

# ── the mesh: objects (the body, and the tyres), positions, normals, texture coordinates; triangles ──
V, VT, VN, tris, obj = [], [], [], [], 'main'
for line in open(os.path.join(a.src, 'alfa-164.obj'), encoding='utf-8', errors='replace'):
    p = line.split()
    if not p: continue
    if p[0] == 'o': obj = p[1]
    elif p[0] == 'v': V.append([float(x) for x in p[1:4]])
    elif p[0] == 'vt': VT.append([float(x) for x in p[1:3]])
    elif p[0] == 'vn': VN.append([float(x) for x in p[1:4]])
    elif p[0] == 'f':
        c = [tuple(int(x) - 1 for x in q.split('/')) for q in p[1:]]
        for i in range(1, len(c) - 1): tris.append((obj, c[0], c[i], c[i + 1]))
V, VT, VN = np.array(V), np.array(VT), np.array(VN); assert len(tris), 'no mesh'

# ── its picture, and which part of the car reads each bit of it (a wheel, or the body) ──
R = 2048
src = cv2.cvtColor(cv2.imread(os.path.join(a.src, 'main.png'), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
zero = cv2.resize((src.max(2) == 0).astype(np.float32), (R, R), interpolation=cv2.INTER_AREA) > .5      # exactly black as it came: glass (and what nothing reads)
im = cv2.resize(src, (R, R), interpolation=cv2.INTER_AREA)
who = np.zeros((R, R), np.uint8)                                            # 0 nothing reads it, 1 the body, 2 a wheel
for o, c0, c1, c2 in tris:
    uv = np.round(np.array([[VT[c[1]][0] * R, (1 - VT[c[1]][1]) * R] for c in (c0, c1, c2)])).astype(np.int32); w = 2 if o.startswith('tire') else 1
    cv2.fillPoly(who, [uv], w); cv2.polylines(who, [uv], True, w, 2)
used = who > 0
hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV).astype(np.int32); hue, sat, val = hsv[..., 0] * 2, hsv[..., 1] / 255., hsv[..., 2] / 255.
reddish = (hue < 20) | (hue > 318)

# ── which end is the front: the rear lamps are the brightest red in the picture, and the tail goes at -z ──
hot = reddish & (sat > .58) & (val > .73); zs = []
for o, c0, c1, c2 in tris:
    u = np.mean([VT[c[1]] for c in (c0, c1, c2)], 0)
    if hot[int(np.clip((1 - u[1]) * R, 0, R - 1)), int(np.clip(u[0] * R, 0, R - 1))]: zs.append(np.mean([V[c[0]][2] for c in (c0, c1, c2)]))
assert zs, 'no rear lamps found in the picture'
sg = -1. if np.mean(zs) > 0 else 1.

# ── the .glb: one mesh, one part; corners shared as the model shares them; its own normals ──
lo, hi = V.min(0), V.max(0); mid = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
key, pos, nor, uv, idx = {}, [], [], [], []
for o, *cs in tris:
    for c in cs:
        if c not in key:
            key[c] = len(pos) // 3; v = V[c[0]] - mid; n = VN[c[2]]; n = n / (np.linalg.norm(n) or 1)
            pos += [sg * v[0], v[1], sg * v[2]]; nor += [sg * n[0], n[1], sg * n[2]]; uv += [VT[c[1]][0], 1 - VT[c[1]][1]]      # (glTF's v runs down the picture, the .obj's up it)
        idx.append(key[c])
n = len(pos) // 3; assert n < 65536
pb = struct.pack('<%df' % len(pos), *pos); nb = struct.pack('<%df' % len(nor), *nor); ub = struct.pack('<%df' % len(uv), *uv); ib = struct.pack('<%dH' % len(idx), *idx); ib += b'\0' * (-len(ib) % 4)
bin_ = pb + nb + ub + ib; P = np.array(pos).reshape(-1, 3)
j = {'asset': {'version': '2.0', 'generator': 'tools/synth/car.py', 'copyright': CREDIT},      # (nothing at the top level under "extras": the page reads that as the street's layout)
     'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'car', 'mesh': 0}],
     'meshes': [{'name': 'car', 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}], 'materials': [{'name': 'body'}],
     'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': n, 'type': 'VEC3', 'min': P.min(0).round(5).tolist(), 'max': P.max(0).round(5).tolist()},
                   {'bufferView': 1, 'componentType': 5126, 'count': n, 'type': 'VEC3'}, {'bufferView': 2, 'componentType': 5126, 'count': n, 'type': 'VEC2'},
                   {'bufferView': 3, 'componentType': 5123, 'count': len(idx), 'type': 'SCALAR'}],
     'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(pb), 'target': 34962}, {'buffer': 0, 'byteOffset': len(pb), 'byteLength': len(nb), 'target': 34962},
                     {'buffer': 0, 'byteOffset': len(pb) + len(nb), 'byteLength': len(ub), 'target': 34962},
                     {'buffer': 0, 'byteOffset': len(pb) + len(nb) + len(ub), 'byteLength': len(idx) * 2, 'target': 34963}],
     'buffers': [{'byteLength': len(bin_)}]}
jb = json.dumps(j, separators=(',', ':')).encode(); jb += b' ' * (-len(jb) % 4)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
open(a.out, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(jb) + len(bin_)) + struct.pack('<I4s', len(jb), b'JSON') + jb + struct.pack('<I4s', len(bin_), b'BIN\0') + bin_)
print('%s: %d triangles, %d corners; %.2f m long, %.2f wide, %.2f high; %d bytes' % (a.out, len(idx) // 3, n, hi[2] - lo[2], hi[0] - lo[0], hi[1] - lo[1], 28 + len(jb) + len(bin_)))

# ── the picture redrawn flat. First, what kind of thing each bit of it is, by its colour (and by whether a wheel reads it) ──
GLASS, PAINT, DARK, LIGHT, RED, PALE, AMBER, TYRE, DIM, TRIM, WHEEL, PLATE, EMBLEM = range(13); NK = 13
kind = np.full((R, R), DARK, np.uint8)                                         # dark trim: the cladding, the bumpers, the grille
kind[(sat < .3) & (val > .44)] = LIGHT                                         # a lamp's glass, a plate, bright metal
kind[reddish & (sat > .38) & (val > .14)] = PAINT                              # the bodywork (a burgundy)
kind[reddish & (sat > .5) & (val > .57)] = DIM                                 # the lamp bar's dimmer red
kind[reddish & (sat > .55) & (val > .72)] = RED                                # a rear lamp
kind[reddish & (sat > .12) & (sat <= .55) & (val > .72)] = PALE                # a lamp's pale part
kind[(hue >= 20) & (hue < 52) & (sat > .5) & (val > .55)] = AMBER
kind[zero & (who == 1)] = GLASS
kind[(who == 2) & (val < .3)] = TYRE
kind[(who == 2) & (val >= .3)] = WHEEL                                         # the wheel itself (its holes are tyre-dark)
def settle(kind, s):                                                           # the grain out, the edges smooth: every bit goes to the kind strongest about it
    best = np.full(kind.shape, -1., np.float32); out = kind.copy()
    for k in range(NK):
        m = cv2.GaussianBlur((kind == k).astype(np.float32), (0, 0), s); w = m > best; best[w] = m[w]; out[w] = k
    return out
kind = settle(kind, 1.6)
# a glint on the bodywork is bodywork: dim red and pale only count where they touch a lamp
near = cv2.dilate((kind == RED).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
for K in (DIM, PALE):
    n_, cc, st, _ = cv2.connectedComponentsWithStats((kind == K).astype(np.uint8), connectivity=8)
    for c in range(1, n_):
        m = cc == c
        if not (m & near).any(): kind[m] = PAINT
    near = cv2.dilate(np.isin(kind, (RED, DIM)).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
def islands(of, into, max_area, share):                                        # small areas (of these kinds, or of any but `into`) with `into` nearly all round them become `into`
    m0 = (kind != into).astype(np.uint8) if of is None else np.isin(kind, of).astype(np.uint8)
    n_, cc, st, _ = cv2.connectedComponentsWithStats(m0, connectivity=8); k7 = np.ones((7, 7), np.uint8); done = 0
    for c in range(1, n_):
        if st[c, cv2.CC_STAT_AREA] > max_area: continue
        x, y, w, h = st[c, :4]; x0, y0, x1, y1 = max(0, x - 5), max(0, y - 5), min(R, x + w + 5), min(R, y + h + 5)
        m = cc[y0:y1, x0:x1] == c; ring = (cv2.dilate(m.astype(np.uint8), k7) > 0) & ~m; u = used[y0:y1, x0:x1][ring]
        if u.sum() and (kind[y0:y1, x0:x1][ring][u] == into).mean() >= share: kind[y0:y1, x0:x1][m] = into; done += 1
    return done
# what lies on the bodywork and is smaller than a lamp goes: the badges, the lettering, the handles, a side repeater
print('painted over on the bodywork: %d small things' % islands(None, PAINT, 5200, .8))
# the plates: a pale oblong about four and a half times as long as it is wide. Blank: whatever is written on one goes
n_, cc, st, _ = cv2.connectedComponentsWithStats((kind == LIGHT).astype(np.uint8), connectivity=8); plates = 0
for c in range(1, n_):
    x, y, w, h, ar = st[c]; r = max(w, h) / max(1, min(w, h))
    if 12000 < w * h < 60000 and 3.4 < r < 5.6 and ar > .5 * w * h and (who[y:y + h, x:x + w] == 1).mean() > .9: kind[y:y + h, x:x + w] = PLATE; plates += 1
print('plates blanked: %d' % plates); assert plates == 2, 'expected the two plates'
print('painted over in the dark trim: %d small things (what is left of a badge)' % islands((LIGHT, RED, PALE, AMBER, PAINT), DARK, 2600, .9))
# thin bright trim and stray glints on the body: gone. What is left there that is pale is a lamp or a plate
n_, cc, st, _ = cv2.connectedComponentsWithStats(((kind == LIGHT) & (who == 1)).astype(np.uint8), connectivity=8); k9 = np.ones((9, 9), np.uint8); gone = 0
for c in range(1, n_):
    x, y, w, h, ar = st[c]
    if ar > 3600 and ar > .33 * w * h: continue                                # big and solid: a lamp, a plate. (.33: a headlamp is .37 of its box. The streaks of glare on the front wing are .21 and the pale outline of the grille's shield .29: both go)
    x0, y0, x1, y1 = max(0, x - 6), max(0, y - 6), min(R, x + w + 6), min(R, y + h + 6); m = cc[y0:y1, x0:x1] == c; kk = kind[y0:y1, x0:x1]
    ring = (cv2.dilate(m.astype(np.uint8), k9) > 0) & ~m & used[y0:y1, x0:x1] & (kk != LIGHT) & (kk != GLASS)
    if ring.any(): kk[m] = np.bincount(kk[ring], minlength=NK).argmax(); gone += 1
print('thin bright trim and glints taken off: %d' % gone)
kind = settle(kind, 1.2)
# every window: its edge made smooth, and one even surround drawn round it (the model's own was a broken line once redrawn)
g = (cv2.GaussianBlur((kind == GLASS).astype(np.float32), (0, 0), 2.5) > .5) & (who == 1)
kind[(kind == GLASS) & ~g] = TRIM; kind[g] = GLASS
kind[(cv2.dilate(g.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) > 0) & ~g & (who == 1)] = TRIM

# the rear lamps: ONE straight bar, the whole way across the tail, as the real car's is (the owner, 2026-11-23: "make the
# taillights one straight beam going all the way across the rear like in the actual car"). The model's picture has it too, but
# its middle lengths are a dimmer red that the sorting above takes for bodywork, which left three separate lamps. So: the three
# big red pieces in the tail's row are found, and one oblong is drawn from the outer end of the first to the outer end of the
# last (its pale tip included), at the height of the middle one. Anything else of a lamp just above or below that row (the
# outer lamps were a little taller) becomes bodywork, so the bar's edges are two straight lines.
n_, cc, st, _ = cv2.connectedComponentsWithStats(((kind == RED) & (who == 1)).astype(np.uint8), connectivity=8)
big = sorted([st[c] for c in range(1, n_) if st[c, cv2.CC_STAT_AREA] > 3000], key=lambda q: -q[cv2.CC_STAT_AREA])[:3]
assert len(big) == 3, 'expected the three pieces of the rear lamp bar, found %d' % len(big)
mid = sorted(big, key=lambda q: q[0])[1]; by0, by1 = int(mid[1]), int(mid[1] + mid[3]); bx0 = int(min(q[0] for q in big)); bx1 = int(max(q[0] + q[2] for q in big))
assert all(q[1] < by1 and q[1] + q[3] > by0 for q in big), 'the three pieces are not in one row'
lamp = np.isin(kind, (RED, DIM, PALE, AMBER)) & (who == 1)                     # (the outer lamps end in a pale tip: the bar runs to the end of that)
cols = np.nonzero(lamp[by0:by1, max(0, bx0 - 140):bx1 + 140].any(0))[0] + max(0, bx0 - 140); bx0, bx1 = int(min(bx0, cols.min())), int(max(bx1, cols.max() + 1))
box = np.zeros((R, R), bool); box[max(0, by0 - 16):by1 + 16, max(0, bx0 - 6):bx1 + 6] = True
kind[box & np.isin(kind, (RED, DIM, PALE, AMBER)) & (who == 1)] = PAINT
kind[by0:by1, bx0:bx1][who[by0:by1, bx0:bx1] == 1] = RED
print('rear lamp bar: %d x %d px of the 2048 px picture' % (bx1 - bx0, by1 - by0))

# an emblem: a plain round badge in the middle of the boot lid, just above the lamp bar (the owner, 2026-11-23: "add a small circle
# or something to the back of the car above the tail light as an emblem"). A ring of muted silver round a dark middle, about
# 7 cm across: no maker's mark (the model's own badge was painted out, above, and must stay out). Where it goes is worked out
# from the mesh: over the tail's rear-facing triangles, where in the picture a point of the tail is, as a straight-line fit of
# (x, y) on the car; then the badge's middle (on the car: halfway across, 7.5 cm above the bar's top edge) and its size are read
# off that fit, so it is round on the car whatever the picture's scale there.
Pm, Nm, Um, Im = np.array(pos).reshape(-1, 3), np.array(nor).reshape(-1, 3), np.array(uv).reshape(-1, 2), np.array(idx).reshape(-1, 3)
cP, cN, cU = Pm[Im].mean(1), Nm[Im].mean(1), Um[Im].mean(1) * R
inbar = (cU[:, 0] >= bx0) & (cU[:, 0] < bx1) & (cU[:, 1] >= by0) & (cU[:, 1] < by1)
ybar = cP[inbar, 1].max(); zrear = cP[inbar, 2].mean()
tail = (cN[:, 2] * np.sign(zrear) > .4) & (np.abs(cP[:, 0]) < .55) & (cP[:, 1] > ybar - .12) & (cP[:, 1] < ybar + .2)
A = np.c_[cP[tail, 0], cP[tail, 1], np.ones(tail.sum())]; fit, *_ = np.linalg.lstsq(A, cU[tail], rcond=None)      # picture px = [x, y, 1] . fit
assert tail.sum() > 20 and np.abs(A @ fit - cU[tail]).max() < 60, 'the tail is not one piece of the picture here'
ec = np.array([0, ybar + .075, 1]) @ fit; ex, ey = np.hypot(*fit[0]) * .035, np.hypot(*fit[1]) * .035      # its middle, and its radius across and up, in picture px (fit[0]: px per metre across the car, fit[1]: per metre up)
gy, gx = np.mgrid[0:R, 0:R]; rr = np.hypot((gx - ec[0]) / ex, (gy - ec[1]) / ey)
kind[(rr <= 1) & (who == 1)] = EMBLEM; kind[(rr <= .62) & (who == 1)] = DARK; kind[(rr <= .3) & (who == 1)] = EMBLEM      # a ring, a dark band, a small round middle
print('emblem: at %.0f, %.0f of the 2048 px picture, %.0f x %.0f px' % (ec[0], ec[1], ex * 2, ey * 2))

# ── its colours: one flat colour a kind ──
hx = lambda s: [int(s[i:i + 2], 16) for i in (1, 3, 5)]
# (the lamps are glass that is not lit: the car is parked. Their reds and ambers are those of an unlit lens, well below the
#  brightness the model's picture gave them, which in the dark of this street read as lamps that were on)
# (the wheels and the plates: they were the pale grey of a lamp's glass, the brightest things on the car, and the eye went
#  straight to them. The owner's second review, 2026-11-23: "Darken them to a muted silver or gunmetal and cut the specular so
#  they pick up pink or cyan from the neon instead of reading near-white", and of the plate: "Drop its brightness a lot and
#  give it a slight tint". So: a gunmetal with the street's mauve in it, and a dim lilac; both nearly matt)
COL = {GLASS: hx('#0b1420'), PAINT: hx(a.paint), DARK: hx('#1b1a20'), LIGHT: hx('#b4bac4'), RED: hx('#8f1826'), PALE: hx('#b98d96'), AMBER: hx('#a8641c'), TYRE: hx('#08080a'), DIM: hx('#641322'), TRIM: hx('#434957'),
       WHEEL: hx('#4a4556'), PLATE: hx('#5a5470'), EMBLEM: hx('#7d8494')}
# how glossy each kind is, 0 matt to 1 a mirror: what the neon across the street shows in (fx/synth.js, the car's material)
GLOSS = {GLASS: 1., PAINT: .78, DARK: .22, LIGHT: .55, RED: .85, PALE: .85, AMBER: .85, TYRE: .04, DIM: .85, TRIM: .5, WHEEL: .3, PLATE: .28, EMBLEM: .8}
flat = np.zeros((R, R, 4), np.uint8)
for k, c in COL.items(): flat[kind == k] = c + [128 + round(127 * GLOSS[k])]
# what nothing reads takes the colour of the nearest bit that is read, so no dark creeps in along a seam when the picture is seen small
_, lab = cv2.distanceTransformWithLabels((~used).astype(np.uint8), cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
ys, xs = np.nonzero(used); lut = np.zeros((lab.max() + 1, 4), np.uint8); lut[lab[ys, xs]] = flat[ys, xs]; flat = np.where(used[..., None], flat, lut[lab])
out = cv2.resize(flat, (1024, 1024), interpolation=cv2.INTER_AREA)
os.makedirs(os.path.dirname(os.path.abspath(a.tex)), exist_ok=True)
assert out[..., 3].min() >= 128
cv2.imwrite(a.tex, cv2.cvtColor(out, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 101])      # (above 100: lossless)
print('%s: 1024 x 1024, %d bytes' % (a.tex, os.path.getsize(a.tex)))
if a.debug:
    cv2.imwrite(a.debug + '-flat.png', cv2.cvtColor(out[..., :3], cv2.COLOR_RGB2BGR)); cv2.imwrite(a.debug + '-gloss.png', out[..., 3]); cv2.imwrite(a.debug + '-kinds.png', cv2.resize((kind * 19).astype(np.uint8), (1024, 1024), interpolation=cv2.INTER_NEAREST))
