"""Surrealism's monolith in the surf (Resources, Finder): a phone clip of the Baltic breaking on the Curonian Spit
(Commons, "Groyne and sea waves at Curonian Spit", CC BY 3.0), held still, with a tall black slab standing in the sea
off the end of the groyne. The sun is low behind it, so its shadow runs straight at us across the swell, the breaking
waves and the wet sand (a shadow far too long for the light everywhere else: the thing nobody can explain).

  steady   the clip is hand-held: each frame is levelled and lifted by its horizon (the sky/sea edge, a robust line
           fit) and slid sideways by the groyne's dark posts and stump (matched against the first frame), so the sea
           stands still and the slab can stand in it
  camera   a phone's wide lens (f = 1371 px at 1920 wide), the eye 1.2 m over the water, the horizon at row 425
  slab     3.4 m wide, 0.9 m thick, 12.5 m out of the water, 60 m out and 29 m right (beside the page), turned a little
           and leaning a little; black, its edges caught by the sun behind it, a faint glare round it in the sky
  water    the waves come in front of its foot (the clip's own foam is kept over it), a line of wash where they break
           on it, its dark reflection broken up by the swell under it
  shadow   from its foot straight toward us, sharp at the slab, soft by the time it reaches the sand; deeper on sand
           and foam than on the water (which mostly shows the sky)
  loop     10 s, its last second faded into its first

usage: python surf.py <clip.webm> <out folder: images/surreal> [frames]
writes surf.webm (VP9) and surf.mp4 (H.264), 960 x 540, 30 fps, no sound; surf.webp (a still: Animation off, and
before the clip has loaded) and surf-p.webp (an upright phone's still, round the slab)"""
import sys, os, math, subprocess
import numpy as np, cv2
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
N0, N1, XF = 0, 330, 24                    # frames used; the crossfade's length
FF = os.environ.get('FFMPEG') or __import__('imageio_ffmpeg').get_ffmpeg_exe()

# ── holding the camera still ──
YREF = 425.0
def horizon(f):
    lum = f.astype(np.float32).mean(-1)
    cols = np.arange(40, 1880, 30); ys = []
    for x in cols:
        c = cv2.GaussianBlur(lum[:, x - 3:x + 4], (1, 5), 0).mean(1)
        d = c[150:560] - c[154:564]; ys.append(150 + int(np.argmax(d)) + 2)
    ys = np.array(ys, float); keep = np.abs(ys - np.median(ys)) < 25
    for tol in (12, 6, 4):
        m, c0 = np.polyfit(cols[keep], ys[keep], 1)
        k2 = np.abs(ys - (m * cols + c0)) < tol
        if k2.sum() >= 12: keep = k2
    return m * 960 + c0, math.degrees(math.atan(m))
def levelM(yc, tilt):
    M = cv2.getRotationMatrix2D((960, yc), tilt, 1.0); M[1, 2] += YREF - yc; return M
def dark(f):
    l = f.astype(np.float32).mean(-1) / 255
    return np.clip((0.33 - l) * 4, 0, 1).astype(np.float32)

cap = cv2.VideoCapture(SRC)
params, tpl = [], None
i = 0
while i < N1:
    ok, f = cap.read()
    if not ok: break
    if i >= N0:
        yc, t = horizon(f)
        M = levelM(yc, t)
        D = dark(cv2.warpAffine(f, M, (1920, 1080), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT))
        if tpl is None: tpl = D[470:660, 260:1300].copy(); dx = dy = 0.0
        else:
            r = cv2.matchTemplate(D[450:680, 60:1500], tpl, cv2.TM_CCOEFF_NORMED)
            _, _, _, (x, y) = cv2.minMaxLoc(r)
            def sub(a, b, c): d = a - 2 * b + c; return 0 if abs(d) < 1e-6 else 0.5 * (a - c) / d
            sx = sub(r[y, x - 1], r[y, x], r[y, x + 1]) if 0 < x < r.shape[1] - 1 else 0
            sy = sub(r[y - 1, x], r[y, x], r[y + 1, x]) if 0 < y < r.shape[0] - 1 else 0
            dx = x + sx + 60 - 260; dy = y + sy + 450 - 470
        params.append((yc, t, dx, dy))
    i += 1
P_ = np.array(params)
# (a tracker's odd frame out: a running median of three)
for k in range(4):
    v = P_[:, k].copy()
    for j in range(1, len(v) - 1): P_[j, k] = np.median(v[j - 1:j + 2])
def steady(f, j):
    yc, t, dx, dy = P_[j]
    M = levelM(yc, t); M[0, 2] -= dx; M[1, 2] -= dy
    return cv2.warpAffine(f, M, (1920, 1080), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

# ── the slab ──
F, CX, H0 = 1371.0, 960.0, 1.2
def proj(p):
    x, y, z = p; return np.array([CX + F * x / z, YREF - F * (y - H0) / z])
XM, ZM, WM, TM, HM = 29.0, 60.0, 3.4, 0.9, 12.5
YAW, LEAN = math.radians(14), math.radians(2.5)
def corner(a, b, c):
    """a across (-1..1), b through (-1..1), c up (metres, from the water)"""
    lx, lz = a * WM / 2, b * TM / 2
    lx += c * math.sin(LEAN)                                     # leaning a little to the right
    x = XM + lx * math.cos(YAW) + lz * math.sin(YAW); z = ZM - lx * math.sin(YAW) + lz * math.cos(YAW)
    return np.array([x, c, z])
DEEP = -3.0
faces = {
    'front': [corner(-1, -1, DEEP), corner(1, -1, DEEP), corner(1, -1, HM), corner(-1, -1, HM)],
    'side':  [corner(-1, 1, DEEP), corner(-1, -1, DEEP), corner(-1, -1, HM), corner(-1, 1, HM)],
    'top':   [corner(-1, -1, HM), corner(1, -1, HM), corner(1, 1, HM), corner(-1, 1, HM)],
}
SS = 3
def poly_mask(pts, shape=(1080, 1920)):
    m = np.zeros((shape[0] * SS, shape[1] * SS), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts) * SS).astype(np.int32)], 255, lineType=cv2.LINE_AA)
    return cv2.resize(m, (shape[1], shape[0]), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
# the face toward us is in its own shadow (the sun is behind it); the side catches a little of the sky; the top a sliver
fm = {k: poly_mask([proj(p) for p in v]) for k, v in faces.items()}
body = np.clip(fm['front'] + fm['side'] + fm['top'], 0, 1)
yy, xx = np.mgrid[0:1080, 0:1920].astype(np.float32)
# its colour: black, a breath of the sky on the side turned to it, the top lit edge-on; a faint gradient down the face
# (the bright sea reflected low in a glossy black)
front_c = np.array([0.035, 0.038, 0.044])[None, None, :] + ((yy - 150) / 300.0).clip(0, 1)[..., None] * np.array([0.022, 0.02, 0.016])
side_c = np.array([0.06, 0.068, 0.085])
top_c = np.array([0.20, 0.19, 0.18])
slab = front_c * fm['front'][..., None] + side_c * fm['side'][..., None] + top_c * fm['top'][..., None]
slab = slab / np.maximum(body, 1e-4)[..., None]
# the sun just behind it: a thin bright rim round its upper edges, and a faint glare in the sky round it
edge = cv2.GaussianBlur(body, (0, 0), 1.2) - body
top_y0 = proj(corner(0, 0, HM))[1]
rim = np.clip(-cv2.Laplacian(cv2.GaussianBlur(body, (0, 0), 0.9), cv2.CV_32F) * 2.2, 0, 1) * np.clip(1 - (yy - top_y0) / 140.0, 0, 1) ** 1.5
top_y = proj(corner(0, 0, HM))[1]; foot = proj(corner(0, -1, 0))
glow = np.exp(-(((xx - foot[0]) / 260) ** 2 + ((yy - (top_y + 120)) / 220) ** 2)) * 0.10 * (yy < YREF - 4)
# its foot in the water: a wavy line (the sea's surface going up and down the slab), with wash where the waves hit it
fx0 = proj(corner(-1, -1, 0))[0]; fx1 = proj(corner(1, -1, 0))[0]; fyb = proj(corner(0, -1, 0))[1]
# the shadow on the water and the sand: the slab's outline thrown along the ground straight toward us (x/z kept: the
# sun is behind it), from its foot to well past the camera; sharp at the foot, softening with distance
def shadow_mask():
    m = np.zeros((1080, 1920), np.float32)
    zs = np.linspace(ZM - 1, 1.0, 400)
    for z in zs:
        # across: the slab's width as seen from here (its footprint's half-width, perpendicular to the line to us)
        y = YREF + F * H0 / z
        if y > 1085: continue
        xc = CX + F * (XM / ZM)
        half = F * (WM / 2 * math.cos(YAW) + 0.3) / z
        d = ZM - z                                                   # metres from the slab's foot
        soft = 2.0 + F * (0.008 * d) / z                             # the sun's disc and the haze: the edge spreads with distance
        r0 = int(max(0, min(1079, y))); xs = np.arange(1920)
        a = np.clip((half - np.abs(xs - xc)) / soft + 0.5, 0, 1)
        m[r0, :] = np.maximum(m[r0, :], a)
    # fill the rows between the sampled ones
    rows = np.where(m.max(1) > 0)[0]
    if len(rows):
        for r in range(rows.min(), 1080):
            if m[r].max() == 0: m[r] = m[r - 1]
    return cv2.GaussianBlur(m, (0, 0), 1.0)
SH = shadow_mask()
SH[: int(fyb) - 2] = 0
# its reflection: a dark smear under it, a little wider, broken by the swell
refl = np.clip((yy - fyb) / 3, 0, 1) * np.exp(-np.clip(yy - fyb, 0, None) / 70.0) * \
    np.clip(1 - np.abs(xx - (fx0 + fx1) / 2) / ((fx1 - fx0) / 2 + 6), 0, 1) ** 0.7
rng = np.random.default_rng(5)

def comp(img, j):
    """one steadied frame (BGR uint8) with the slab put in; returns RGB float"""
    I = img[..., ::-1].astype(np.float32) / 255
    lum = I.mean(-1)
    sat = I.max(-1) - I.min(-1)
    bright = np.clip((lum - 0.42) / 0.3, 0, 1) * np.clip(1 - sat * 3, 0.3, 1)        # foam and sand, not the sea
    # the shadow: sand and foam lose most of their light; the water, which mostly shows the sky, much less
    I = I * (1 - SH * (0.2 + 0.36 * bright))[..., None]
    # the reflection, broken by the swell (the clip's own ripples: where its water is darker, more of it)
    hp = lum - cv2.GaussianBlur(lum, (0, 0), 6)
    rip = 0.5 + 0.5 * np.sin(yy * 1.9 + np.sin(xx * 0.05 + j * 0.21) * 2.5 + j * 0.9)          # (the swell's bands)
    I = I * (1 - refl * np.clip(0.62 - hp * 5 + (rip - 0.5) * 0.3, 0.12, 0.85))[..., None]
    # the glare round it
    I = I + glow[..., None] * np.array([1.0, 0.97, 0.9])
    # the water's line on it: moving a couple of pixels, and the clip's foam left in front of it
    tt = j / 30.0
    wl = fyb + 2.2 * np.sin(xx * 0.09 + tt * 5.1) + 1.4 * np.sin(xx * 0.23 - tt * 7.3) + 1.5 * np.sin(tt * 1.7)
    under = np.clip((yy - wl) / 1.5, 0, 1)                                         # below the water's line: hidden
    # whitecaps over its foot: only a splash a few pixels up its face from the water's line. (Foam higher up in the clip is
    # further out to sea, behind the slab: letting that through showed waves breaking through the monolith. 26 Nov 2026.)
    foam = np.clip((lum - 0.62) / 0.15, 0, 1) * np.clip(1 - (wl - yy) / 4.0, 0, 1) * (np.abs(yy - fyb) < 26)
    a = body * (1 - under) * (1 - foam)
    S = slab + rim[..., None] * np.array([1.0, 0.93, 0.82]) * 0.32
    S = S + rng.standard_normal(S.shape[:2])[..., None] * 0.012
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.7)
    I = I * (1 - a[..., None]) + S * a[..., None]
    # wash: a line of broken white where the swell slaps it
    wash = np.exp(-((yy - wl + 1.5) / 1.8) ** 2) * ((xx > fx0 - 4) & (xx < fx1 + 6)) * \
        np.clip(0.5 + 0.5 * np.sin(xx * 0.37 + tt * 3.3) * np.sin(xx * 0.11 - tt * 2.1), 0, 1) * (0.35 + 0.35 * np.sin(tt * 1.3) ** 2)
    I = I + wash[..., None] * 0.55
    return np.clip(I, 0, 1)

# ── out: crop the steadied frame's edges, half size; the loop's ends faded together. (Written from frame XF on, the
#    faded join last: the same loop begun a second in, so nothing has to be held but the first second.) ──
N = len(params) - XF
crop = (24, 14, 1896, 1066)
def small(I):
    c = I[crop[1]:crop[3], crop[0]:crop[2]]
    return cv2.resize(c, (960, 540), interpolation=cv2.INTER_AREA)
def frames_in():
    cap = cv2.VideoCapture(SRC); i = 0
    while True:
        ok, f = cap.read()
        if not ok or i >= N0 + len(params): return
        if i >= N0: yield i - N0, f
        i += 1
if os.environ.get('SURF_PREVIEW'):
    for j, f in frames_in():
        if j in (0, 150, 300):
            Image.fromarray((comp(steady(f, j), j) * 255 + .5).astype(np.uint8)).save(os.path.join(OUT, 'prev-%d.jpg' % j), quality=90)
        if j > 300: break
    sys.exit()
args = [FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '960x540', '-r', '30', '-i', '-']
os.makedirs(OUT, exist_ok=True)
webm = subprocess.Popen(args + ['-c:v', 'libvpx-vp9', '-crf', '41', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
                                '-pix_fmt', 'yuv420p', '-an', os.path.join(OUT, 'surf.webm')], stdin=subprocess.PIPE)
mp4 = subprocess.Popen(args + ['-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                               '-an', os.path.join(OUT, 'surf.mp4')], stdin=subprocess.PIPE)
def put(A):
    fr = (np.clip(small(A), 0, 1) * 255 + 0.5).astype(np.uint8)
    webm.stdin.write(fr.tobytes()); mp4.stdin.write(fr.tobytes())
head, first_full = [], None
for j, f in frames_in():
    A = comp(steady(f, j), j)
    if j < XF: head.append(A); continue
    if j < N:
        if j == XF: first_full = A
        put(A)
    else:
        k = j - N; w = k / XF
        put(head[k] * w + A * (1 - w))
    if j % 50 == 0: print('frame', j, '/', N + XF, flush=True)
webm.stdin.close(); mp4.stdin.close(); webm.wait(); mp4.wait()
# the stills: the clip's first frame, wide, and an upright phone's cut round the slab
Iw = (first_full[crop[1]:crop[3], crop[0]:crop[2]] * 255 + 0.5).astype(np.uint8)
Image.fromarray(Iw).save(os.path.join(OUT, 'surf.webp'), quality=72, method=6)
sx = int(proj(corner(0, 0, 0))[0]) - crop[0]
pw = 608; px0 = max(0, min(Iw.shape[1] - pw, sx - int(pw * 0.62)))
Image.fromarray(Iw[:, px0:px0 + pw]).save(os.path.join(OUT, 'surf-p.webp'), quality=70, method=6)
foot_s = (proj(corner(0, -1, 0)) - np.array(crop[:2])) / ((crop[2] - crop[0]) / 960)
print('LAYOUT', {'surf': {'w': 960, 'h': 540, 'foot': [round(float(foot_s[0])), round(float(foot_s[1]))], 'frames': N, 'phone_x0': px0}})
