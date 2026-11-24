"""Surrealism: a straight slot cut through Factory Butte (Commons, CC BY-SA 2.0), as if a slice of the mountain had been
taken out. Rendered into the photograph by tracing each pixel through a simple model of the butte matched to the photo's
camera, so the cut has the photo's own perspective, layers, light and haze.

  camera   a long lens (f = 9000 px at 3840 wide), eye level at the plain's horizon (y 1235), looking straight ahead
  butte    a body round a vertical axis: its radius at each height from the photo's silhouette; deeper behind than in front
           (the butte is long, seen end-on)
  slot     two vertical walls 47 m apart, running straight away from us, from the top of the caprock down to the plain
  cut face the far wall (the near one faces away): flat, its layers those of the butte at the same heights (colours taken
           from the photo's own slopes and cliff), with fine laminations and grain; lit by the photo's low sun from the
           front left, mostly in the shadow of the near wall, a lit strip at its mouth and along its top
  through  where a ray goes right through, what lies beyond the butte: the sky and the far country, from the photo's own
           right-hand edge at the same height, matched to the sky just above the notch

usage: python slot.py <the 3840 px photo> <out: a full-size PNG of the edited photo>"""
import sys, math
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
ph = Image.open(SRC).convert('RGB'); W, H = ph.size
P = np.asarray(ph, np.float32) / 255
F, VX, VY = 9000.0, W / 2, 1235.0
# the butte
XC, ZC, KB = (1795 - VX) * 3500 / F, 3655.0, 2.5
PROF = [(-50, 820), (0, 780), (52, 663), (130, 470), (227, 332), (317, 205), (406, 200), (407, -1)]   # (height m, radius m)
YTOP = 406.0
def radius(Y):
    ys = [p[0] for p in PROF]; rs = [p[1] for p in PROF]
    return np.interp(Y, ys, rs)
def zfront(X, Y):
    r = radius(Y); d2 = r * r - (X - XC) ** 2
    return np.where(d2 > 0, ZC - np.sqrt(np.clip(d2, 0, None)), np.inf)
def zback(X, Y):
    r = radius(Y); d2 = r * r - (X - XC) ** 2
    return np.where(d2 > 0, ZC + KB * np.sqrt(np.clip(d2, 0, None)), -np.inf)
# the slot: its walls at these image x at the caprock's front (z 3500)
XL, XR = (2000 - VX) * 3500 / F, (2120 - VX) * 3500 / F
SUN = np.array([-0.42, 0.50, -0.76]); SUN /= np.linalg.norm(SUN)       # toward the sun: front left, 30 degrees up

# the region we work in, supersampled
x0, x1, y0, y1 = 1940, 2340, 140, 1250
SS = 2
yy, xx = np.mgrid[y0:y1:1 / SS, x0:x1:1 / SS].astype(np.float64)
yy += .25; xx += .25
dx_, dy_ = (xx - VX) / F, (VY - yy) / F                # ray: (dx, dy, 1) * z
# where the photo shows the butte (not the sky): below the caprock's top edge, found per column
sky = P[:900, :, :]
def skylike(c): return (c[..., 2] - c[..., 0] > 0.06) & (c[..., 2] > 0.62)
top = np.zeros(W, int)
for x in range(x0 - 2, x1 + 2):
    col = skylike(P[:1240, x, :]); idx = np.where(~col[120:])[0]
    top[x] = 120 + (idx[0] if len(idx) else 1240)
butte = yy >= top[np.clip(xx.astype(int), 0, W - 1)]
# the front surface along each ray (iterate z)
z = np.full(xx.shape, 3500.0)
for _ in range(14):
    X, Y = dx_ * z, dy_ * z
    zn = zfront(X, Y); z = np.where(np.isfinite(zn), zn, z)
X, Y = dx_ * z, dy_ * z
inslot = butte & (X > XL) & (X < XR) & (Y < YTOP + 2) & (Y > -2)
# inside the slot: does the ray meet the far wall (x = XR) inside the butte?
with np.errstate(divide='ignore', invalid='ignore'):
    zr = np.where(dx_ > 0, XR / dx_, np.inf)
Yr = dy_ * zr
onwall = inslot & (zr > zfront(np.full_like(zr, XR), Yr)) & (zr < zback(np.full_like(zr, XR), Yr)) & (Yr < YTOP) & (Yr > -1)
through = inslot & ~onwall

# ── the face's layers: the butte's colour at each height, lit and shaded, from the photo's own surfaces ──
# rows of the front surface at the slot's left: their height, and the colours there (the brighter half: lit; the darker: shade)
lit_prof, sh_prof, hs = [], [], []
for y in range(150, 1236):
    zz = 3500.0
    for _ in range(10):
        zz2 = zfront(np.array((1800 - VX) / F * zz), np.array((VY - y) / F * zz)); zz = float(zz2) if np.isfinite(zz2) else zz
    hY = (VY - y) / F * zz
    row = P[y, 1500:2000] if y < 430 else P[y, 1600:2400]
    lum = row.mean(-1); o = np.argsort(lum)
    lit_prof.append(row[o[len(o) // 2:]].mean(0)); sh_prof.append(row[o[len(o) // 6:len(o) // 2]].mean(0)); hs.append(hY)
hs = np.array(hs); lit_prof = np.array(lit_prof); sh_prof = np.array(sh_prof)
order = np.argsort(hs); hs, lit_prof, sh_prof = hs[order], lit_prof[order], sh_prof[order]
def prof(table, Yv):
    return np.stack([np.interp(Yv, hs, table[:, c]) for c in range(3)], -1)
# fine laminations: a fixed random profile in height (bands every 0.3 to 3 m), and slow variation along the wall
rng = np.random.default_rng(11)
lam_y = np.linspace(-10, 420, 8600)
lam = np.cumsum(rng.standard_normal(8600)) * 0.004
lam = lam - np.convolve(lam, np.ones(400) / 400, mode='same')
lam += rng.standard_normal(8600) * 0.012
lamf = lambda Yv: np.interp(Yv, lam_y, lam)
# the far wall's colour at each of its pixels
Zw = np.where(onwall, zr, 0.0); Yw = np.where(onwall, Yr, 0.0)
lit = prof(lit_prof, Yw); sh = prof(sh_prof, Yw)
# shadow of the near wall: follow the sun from the point back to the near wall's plane; lit if that passes over the top
# or out in front of the butte
t = (XR - XL) / -SUN[0]
Ys, Zs = Yw + SUN[1] * t, Zw + SUN[2] * t
sunlit = (Ys > YTOP) | (Zs < zfront(np.full_like(Zs, XL), Ys))
# deeper in, less sky: a little darker toward the back and the bottom
depth = np.clip((Zw - zfront(np.full_like(Zw, XR), Yw)) / 500.0, 0, 1)
ao = 1 - 0.10 * depth - 0.06 * np.clip(1 - Yw / 120, 0, 1)
shade_col = sh * (ao[..., None] * 0.96)
lit_col = lit * 0.96
face = np.where(sunlit[..., None], lit_col, shade_col)
# the rock itself: detail from the photo's own rock faces (the caprock cliff above its foot; the shale ledges below),
# high-passed so only its grain, joints and bedding are kept, laid on the wall at the photo's scale (0.39 m a pixel at
# the butte), so it foreshortens with the wall
def detail(box):
    g = np.asarray(ph.crop(box).convert('L'), np.float32) / 255
    lo = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)), np.float32) / 255
    d = g - lo; return d / (d.std() + 1e-6)
DCAP = detail((1300, 200, 1990, 415)); DSHA = detail((1500, 600, 2350, 720))
def sample(D, u, v):
    h, w = D.shape; return D[(v.astype(int) % h), (u.astype(int) % w)]
dist = Zw - zfront(np.full_like(Zw, XR), Yw)
u = dist / 0.39; v = (YTOP - Yw) / 0.39
tex = np.where(Yw > 317, sample(DCAP, u, v), sample(DSHA, u * 0.9, v * 0.9))
# rock is never one even tone: soft blotches some tens of metres across (value noise in the wall's own metres)
def vnoise(u, v, cell, seed):
    g = np.random.default_rng(seed).random((64, 64))
    fu, fv = u / cell, v / cell; iu, iv = np.floor(fu).astype(int), np.floor(fv).astype(int); tu, tv = fu - iu, fv - iv
    tu, tv = tu * tu * (3 - 2 * tu), tv * tv * (3 - 2 * tv)
    a_ = g[iv % 64, iu % 64]; b_ = g[iv % 64, (iu + 1) % 64]; c_ = g[(iv + 1) % 64, iu % 64]; d_ = g[(iv + 1) % 64, (iu + 1) % 64]
    return (a_ * (1 - tu) + b_ * tu) * (1 - tv) + (c_ * (1 - tu) + d_ * tu) * tv - 0.5
blot = vnoise(dist, YTOP - Yw, 26.0, 5) * 0.6 + vnoise(dist, YTOP - Yw, 9.0, 6) * 0.4
# bedding: the layers as the photo shows them on the sheer faces (the caprock's end wall, the shale ledges' faces): each
# row's brightness against its neighbours', by height, so the cut shows the same beds at the same heights
bed_h, bed_v = [], []
for y in range(160, 1236):
    xs = slice(2160, 2215) if y < 430 else slice(2480, 2700)
    zz = 3500.0
    for _ in range(10):
        z2 = zfront(np.array((2190 - VX) / F * zz), np.array((VY - y) / F * zz)); zz = float(z2) if np.isfinite(z2) else zz
    bed_h.append((VY - y) / F * zz); bed_v.append(float(np.median(P[y, xs].mean(-1))))
bed_h = np.array(bed_h); bed_v = np.array(bed_v); o = np.argsort(bed_h); bed_h, bed_v = bed_h[o], bed_v[o]
bed_v = bed_v - np.convolve(bed_v, np.ones(41) / 41, mode='same')
bed = np.interp(Yw, bed_h, bed_v) / (bed_v[20:-20].std() + 1e-6)
face = face * (1 + 0.12 * tex[..., None]) * (1 + 0.10 * bed[..., None]) * (1 + lamf(Yw)[..., None] * 0.25) * (1 + 0.16 * blot[..., None])
# the rock is the same rock either side of the shadow's edge: in shade, keep a little of the caprock's red
capr = np.clip((Yw - 300) / 25, 0, 1)[..., None] * (~sunlit)[..., None]
face = face * (1 - 0.25 * capr) + face * np.array([1.10, 0.95, 0.88]) * 0.25 * capr
# the corner at the wall's mouth: a fine line of light, no more
mouth = np.clip(1 - dist / 1.5, 0, 1)
face = face + mouth[..., None] * 0.025

# ── straight through: the sky and the far country beyond, from the photo's right-hand edge at the same height, matched
#    to the sky just above the notch ──
bgx = 3690
bgcol = np.asarray(ph.crop((bgx - 40, 0, bgx + 40, H)).filter(ImageFilter.GaussianBlur(3)), np.float32)[:, 40] / 255
ref_here = P[150:185, 2000:2120].reshape(-1, 3).mean(0); ref_far = bgcol[150:185].mean(0)
off = ref_here - ref_far
yrow = np.clip(yy.astype(int), 0, H - 1)
fade = np.clip(1 - (yy - 185) / 700.0, 0, 1)[..., None]
bg = bgcol[yrow] + off * fade
bg = bg * 0.97 + np.array([0.78, 0.82, 0.90]) * 0.03                 # (further off: a breath more haze)

# ── put it together, then back to full size ──
out = P[y0:y1, x0:x1].repeat(SS, 0).repeat(SS, 1).copy()
out = np.where(onwall[..., None], face, out)
out = np.where(through[..., None], bg, out)
# grain like the photo's
out += rng.standard_normal(out.shape[:2])[..., None] * 0.012 * (inslot[..., None])
small = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).resize((x1 - x0, y1 - y0), Image.LANCZOS)
res = ph.copy(); res.paste(small, (x0, y0))
# ── what came down: a spill of rubble at the slot's foot, made of the photo's own badland mounds (from the apron further
#    right), its edge feathered and its top broken up, half filling the bottom of the gap ──
rub = ph.crop((2560, 1060, 2860, 1240))
m = np.zeros((180, 300), np.float32)
yy2, xx2 = np.mgrid[0:180, 0:300]
prof_top = 120 - 70 * np.exp(-((xx2[0] - 140) / 70.0) ** 2) + rng.standard_normal(300).cumsum() * 0.8
prof_top = np.convolve(prof_top, np.ones(9) / 9, mode='same')
m = np.clip((yy2 - prof_top[None, :]) / 6.0, 0, 1) * np.clip(1 - np.abs(xx2 - 150) / 150.0, 0, 1) ** 0.6
mk = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
res.paste(rub, (1955, 1060), mk)
res.save(OUT)
# the site's pictures: the butte kept left of centre so the slot falls in the right-hand margin (wide screens see x 0 to
# 2450, the top 1900 rows), and an upright phone's cut round the slot
import os
d = os.path.dirname(OUT)
wide = res.crop((0, 0, 2450, 1900)).resize((1960, 1520), Image.LANCZOS)
wide.save(os.path.join(d, 'slot-wide.webp'), quality=76, method=6)
ph_ = res.crop((2060 - 620, 0, 2060 + 620, 2000)).resize((744, 1200), Image.LANCZOS)
ph_.save(os.path.join(d, 'slot-p.webp'), quality=74, method=6)
print('site', wide.size, ph_.size)
print('saved', OUT, 'wall px', int(onwall.sum() / SS / SS), 'through px', int(through.sum() / SS / SS))
