# A glitch across a photographed head's eyes, so it doesn't stare out of the screen (or, turned aside, at the page): the band over the eyes is
# corrupted, as a bad copy would be. Rows are smeared sideways from a single column, some slip left or right, the colour
# channels part (pink and cyan fringes), and a line or two of the picture is simply missing. Still, never animated.
# usage: python -P tools/vapor/eyes.py <in.png> <out.png> <band top> <band bottom> [x0 x1] [seed]
#   the band and the span are in the cut-out's pixels (the youth: 538 668, span 150 700)
# or, for a head turned aside, a band that lies on the head and follows it round (see wrap() below):
#        python -P tools/vapor/eyes.py <in.png> <out.png> wrap <cx> <R> <u:y,u:y,...> <u from> <v top> <v bottom> [seed]
# or a flat glitched panel standing in front of the eyes, turned with the head (see plane() below):
#        python -P tools/vapor/eyes.py <in.png> <out.png> plane <x near> <x far> <xc> <yc> <slope> <height> <taper> <pad> [seed]
import sys, numpy as np
from PIL import Image
a = sys.argv[1:]

def wrap():
    # The head, at the height of its eyes, taken as an upright cylinder seen from the front: its axis at x = cx, radius R (both in the
    # cut-out's pixels, from the silhouette at eye level). A point on it at angle u (0 faces the camera, + to the right) shows at
    # x = cx + R sin u. The eye line is a curve round it, given as angle:row pairs (degrees, pixels), smoothed. The band is the rows
    # v top..v bottom about that curve, from the angle u from to the far edge. Everything moves round the cylinder, not across the
    # picture: a row that slips by a few degrees moves a long way where the head faces us and hardly at all near its edge, and the
    # strips curve with the eye line. The head's outline never changes (a missing line excepted).
    import cv2
    cx, R = float(a[3]), float(a[4])
    pts = sorted((float(q.split(':')[0]), float(q.split(':')[1])) for q in a[5].split(','))
    uA, vT, vB = np.radians(float(a[6])), float(a[7]), float(a[8]); rng = np.random.default_rng(int(a[9]) if len(a) > 9 else 7)
    im = np.array(Image.open(a[0]).convert('RGBA')).astype(np.float32); H, W = im.shape[:2]
    uu = np.linspace(-np.pi / 2, np.pi / 2, 721); yy = np.interp(uu, np.radians([q[0] for q in pts]), [q[1] for q in pts])
    k = np.exp(-.5 * (np.arange(-24, 25) / 8) ** 2); k /= k.sum(); yy = np.convolve(np.pad(yy, 24, mode='edge'), k, 'valid')
    Y = lambda u: np.interp(u, uu, yy)
    al = im[..., 3] / 255                                     # colours carried a little past the outline, so nothing grey slides in
    fill = cv2.GaussianBlur(im[..., :3] * al[..., None], (0, 0), 25) / np.maximum(cv2.GaussianBlur(al, (0, 0), 25), 1e-4)[..., None]
    src = np.dstack([im[..., :3] * al[..., None] + fill * (1 - al[..., None]), im[..., 3]]).astype(np.float32)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    u = np.arcsin(np.clip((xs - cx) / R, -.999, .999)); v = ys - Y(u)
    band = (v >= vT) & (v < vB) & (u >= uA) & (al > 0)
    edges = [vT]
    while edges[-1] < vB: edges.append(min(vB, edges[-1] + int(rng.integers(5, 22))))
    E = np.array(edges); n = len(E) - 1; si = np.clip(np.searchsorted(E, v, 'right') - 1, 0, n - 1)
    us = np.full(H * W, np.nan, np.float32).reshape(H, W); un = u.copy(); gone = np.zeros((H, W), bool); missed = False
    for i in range(n):
        m = band & (si == i) & (u >= uA + np.radians(rng.uniform(0, 12)))   # each row starts at its own place
        kk = rng.random()
        if kk < .35:                                          # a smear: one line down the surface, stretched round it
            un[m] = np.radians(rng.uniform(np.degrees(uA) + 15, 70))
        elif kk < .93 or missed:                              # a slip round the head (it keeps the stone's grain)
            un[m] = u[m] - np.radians(rng.choice([-1, 1]) * rng.uniform(4, 14))
        else:                                                 # a line that never arrived
            gone |= m; missed = True
    def take(uo):                                             # the picture at angle uo, on the same row of the band
        return cv2.remap(src, (cx + R * np.sin(uo)).astype(np.float32), (Y(uo) + v).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    d = np.radians(1.6)                                       # the colour channels part along the surface too
    g0, gr, gb = take(un), take(un + d), take(un - d)
    rgb = np.dstack([gr[..., 0], g0[..., 1], gb[..., 2]])
    out = im.copy(); out[..., :3] = np.where(band[..., None], rgb, im[..., :3]); out[..., 3] = np.where(gone, 0, im[..., 3])
    for c, rows in (((255, 150, 210), 2), ((150, 232, 242), 2)):  # thin strips of the theme's pink and cyan, half there, on the curve
        for _ in range(rows):
            v0 = rng.uniform(vT, vB - 6); m = band & (v >= v0) & (v < v0 + rng.uniform(3, 8)) & (u >= uA + np.radians(rng.uniform(0, 20)))
            out[..., :3] = np.where(m[..., None], out[..., :3] * .55 + np.array(c, np.float32) * .45, out[..., :3])
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(a[1]); print('wrote', a[1])

def plane():
    # A rectangle in the head's space, square to the way the face is turned, just in front of the eyes, seen in the photograph's own
    # perspective: its long edges run along the eye line (straight, at the given slope through xc, yc), it is height tall at its near
    # end and (1 - taper) of that at its far end, and its far end stands out past the profile, in the air. Everything in it is laid
    # out on the rectangle, not on the picture: its pixels (a coarse mosaic of what's behind it) shrink toward the far end, its rows
    # converge, and they slip along it. It is solid, so the eyes don't read at all, and it lays a soft shadow on the face below it.
    # pad widens the picture on both sides (the head stays centred) so the far end has room.
    import cv2
    xN, xF, xc, yc, sl, hN, tp, pad = (float(q) for q in a[3:11]); rng = np.random.default_rng(int(a[11]) if len(a) > 11 else 7)
    im0 = np.array(Image.open(a[0]).convert('RGBA')).astype(np.float32); P = int(pad)
    im = np.zeros((im0.shape[0], im0.shape[1] + 2 * P, 4), np.float32); im[:, P:P + im0.shape[1]] = im0; H, W = im.shape[:2]
    xN, xF, xc = xN + P, xF + P, xc + P
    al = im[..., 3] / 255
    fill = np.zeros((H, W, 3), np.float32); left = np.ones((H, W), np.float32)
    for sg_ in (30, 90, 300):                                 # colours carried past the outline, further at each scale, so nothing black slides in
        wa = cv2.GaussianBlur(al, (0, 0), sg_); f = cv2.GaussianBlur(im[..., :3] * al[..., None], (0, 0), sg_) / np.maximum(wa, 1e-6)[..., None]
        k = np.clip(wa * 8, 0, 1) * left; fill += f * k[..., None]; left -= k
    fill += im[..., :3][al > .5].mean(0) * left[..., None]
    src = (im[..., :3] * al[..., None] + fill * (1 - al[..., None])).astype(np.float32)
    b = 1 - tp                                               # the far end, seen smaller: a homography along the rectangle
    X = lambda sg: xN + (xF - xN) * sg * b / ((1 - sg) + sg * b)
    K = lambda sg: 1 / ((1 - sg) + sg / b)                   # how big the rectangle shows at sg (1 at the near end)
    Y0 = lambda x: yc + sl * (x - xc)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    sg = np.clip((xs - xN) / ((xs - xN) + b * (xF - xs) + 1e-6), -.5, 1.5)
    ta = (ys - Y0(xs)) / (hN / 2 * K(sg))
    inside = (xs >= xN) & (xs <= xF) & (np.abs(ta) <= 1)
    def take(sg2, ta2):
        x2 = X(sg2); return cv2.remap(src, x2.astype(np.float32), (Y0(x2) + ta2 * hN / 2 * K(sg2)).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    NC, NR = 24, 7                                           # the mosaic, in the rectangle's own cells
    msg = (np.floor(np.clip(sg, 0, .9999) * NC) + .5) / NC; mta = (np.floor((np.clip(ta, -1, .9999) + 1) / 2 * NR) + .5) / NR * 2 - 1
    out_sg, out_ta = msg.copy(), mta.copy()                  # where each pixel of the rectangle takes its colour from
    flat = np.full((H, W, 3), np.nan, np.float32)
    edges = [-1.0]
    while edges[-1] < 1: edges.append(min(1.0, edges[-1] + rng.uniform(.06, .26)))
    E = np.array(edges); ri = np.clip(np.searchsorted(E, ta, 'right') - 1, 0, len(E) - 2)
    PAL = np.array([[255, 150, 210], [150, 232, 242], [196, 170, 250], [255, 244, 252], [120, 110, 190]], np.float32)
    for i in range(len(E) - 1):
        m = inside & (ri == i); k = rng.random()
        if k < .34:                                          # a smear: one line across the rectangle, stretched along it
            out_sg[m] = rng.uniform(.05, .95); out_ta[m] = ta[m]
        elif k < .7:                                         # a slip: the mosaic, moved along the rectangle
            d = rng.choice([-1, 1]) * rng.uniform(.12, .4); out_sg[m] = msg[m] + d
        elif k < .86:                                        # left as the mosaic
            pass
        else:                                                # a block of the theme's colour
            flat[m] = PAL[rng.integers(0, len(PAL))]
    d = .012                                                 # the colour channels part along the rectangle
    g0, gr, gb = take(out_sg, out_ta), take(out_sg + d, out_ta), take(out_sg - d, out_ta)
    rgb = np.dstack([gr[..., 0], g0[..., 1], gb[..., 2]])
    lum = rgb.mean(2, keepdims=True); rgb = np.where(np.isnan(flat), rgb, flat * .75 + lum * .25)
    for c, rows in ((PAL[0], 2), (PAL[1], 2)):               # thin lines of pink and cyan along it, half there
        for _ in range(rows):
            t0 = rng.uniform(-1, .9); m = inside & (ta >= t0) & (ta < t0 + rng.uniform(.03, .08))
            rgb = np.where(m[..., None], rgb * .55 + c * .45, rgb)
    out = im.copy()
    sh = cv2.GaussianBlur(np.roll(np.roll(inside.astype(np.float32), 16, 0), 7, 1), (0, 0), 7) * (1 - inside) * .3   # its shadow on the face
    out[..., :3] = out[..., :3] * (1 - sh[..., None] * np.array([1, 1.05, .8], np.float32))
    soft = cv2.GaussianBlur(inside.astype(np.float32), (0, 0), .7)                                            # its edges, anti-aliased
    out[..., :3] = out[..., :3] * (1 - soft[..., None]) + rgb * soft[..., None]
    out[..., 3] = np.maximum(out[..., 3], soft * 255)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(a[1]); print('wrote', a[1], W, 'x', H)

if len(a) > 2 and a[2] == 'wrap':
    wrap(); sys.exit()
if len(a) > 2 and a[2] == 'plane':
    plane(); sys.exit()
src, dst, y0, y1 = a[0], a[1], int(a[2]), int(a[3])
x0, x1 = (int(a[4]), int(a[5])) if len(a) > 5 else (150, 700)
rng = np.random.default_rng(int(a[6]) if len(a) > 6 else 7)
im = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
H, W = im.shape[:2]
out = im.copy()

def shift(strip, dx):                                       # slide a strip sideways, leaving nothing behind it
    s = np.zeros_like(strip)
    if dx >= 0: s[:, dx:] = strip[:, :W - dx]
    else: s[:, :W + dx] = strip[:, -dx:]
    return s

y = y0
while y < y1:
    h = int(rng.integers(5, 22)); h = min(h, y1 - y); r = slice(y, y + h)
    k = rng.random()
    if k < .55:                                             # a smear: one column of the picture, stretched across
        sx = int(rng.integers(x0 + 40, x1 - 40)); xa = int(rng.integers(x0 - 40, x0 + 60)); xb = int(rng.integers(x1 - 50, x1 + 60))
        col = im[r, sx:sx + 1, :].copy(); col[..., 3] = 255
        out[r, xa:xb, :] = col
    elif k < .9:                                            # a slip
        out[r] = shift(im[r], int(rng.integers(-70, 90)))
    else:                                                   # a line that never arrived
        out[r, x0 - 30:x1 + 30, 3] = 0
    y += h

b = out[y0:y1].copy(); a0 = b[..., 3:4] / 255; pm = b[..., :3] * a0   # the colour channels part a little (worked premultiplied, so empty pixels lend no colour)
red, blue = shift(np.dstack([pm, a0 * 255]), 7), shift(np.dstack([pm, a0 * 255]), -7)
na = np.maximum(b[..., 3], np.maximum(red[..., 3], blue[..., 3]) * .85)
rgb = np.dstack([red[..., 0], pm[..., 1], blue[..., 2]]) / np.maximum(na[..., None] / 255, 1e-3)
fringe = (b[..., 3:4] == 0) * .4                            # where only a parted channel shows, keep it pastel
b[..., :3] = rgb * (1 - fringe) + 255 * fringe; b[..., 3] = na
out[y0:y1] = b

for c, rows in (((255, 150, 210), 2), ((150, 232, 242), 2)):  # two thin strips of the theme's pink and cyan, half there
    for _ in range(rows):
        yy = int(rng.integers(y0, y1 - 6)); hh = int(rng.integers(3, 8)); m = out[yy:yy + hh, :, 3] > 0
        for i in range(3): out[yy:yy + hh, :, i] = np.where(m, out[yy:yy + hh, :, i] * .55 + c[i] * .45, out[yy:yy + hh, :, i])

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst)
print('wrote', dst)
