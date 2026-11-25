"""Surrealism: a slice taken out of the world through Factory Butte (Commons, CC BY-SA 2.0). Two vertical walls a hundred
and twenty metres apart running straight and level through everything: the plain in front, the butte, the country behind,
and down into the ground. The slice runs away from us to the left at an angle (not straight away), so the far wall faces us
and the low sun and its raw rock shows.

Rendered into the photograph by tracing each pixel through a simple model of the scene matched to the photo's camera:

  camera   F = 9000 px at 3840 wide (a short telephoto), eye 1.7 m over the plain, horizon at row 1235, looking level
  butte    a body round a vertical axis: its radius at each height from the photo's silhouette, longer behind than in
           front (the butte is long, seen end-on); its surface given the photo's own relief (ridges and gullies), worked
           out from the light and shade across each row, so the cut's edges follow the ridges in the photograph
  plain    level, 1.7 m under the eye
  slice    vertical planes, w apart, ANGLE from the line of sight; where a ray's first hit lies inside the slice the
           ground there is gone, and the ray goes on to the far wall (or, over the top of the cap, to the sky beyond). The
           near wall cuts the cap's end just right of the tower at its left corner, so the tower stays as the near side of
           a notch in the skyline
  saddle   behind the prow (the end wall's top) the caprock on the far side dips 60 m (the photo can't show the cap's top
           there): the far wall's top falls away from the prow, and the notch's sky comes down deep into the cleft. On a
           flat cap the far wall's top only drops as far as the cut lets you see back, which at this angle and width left
           it level with the red cap beside it, one unbroken profile
  far wall its rock is the butte's at the same height: colours from the photo's own slopes and cliffs (lit and shaded),
           the beds read off the photo's sheer faces, fine laminations, grain from the photo's rock faces, slow blotches;
           below the plain, the grey shale goes on down, fresher and darker. Lit by the photo's low sun from the front left,
           shadowed where the near wall stands between it and the sun, and darker the deeper in it is: how much sky each
           point sees past the near side and the butte (worked out on a grid over the wall). Its arrises (the top edge,
           the front edge) and the near lip catch a little more light
  rubble   at the foot of the far wall, where the rock that came off it has heaped: cones at the angle of repose under the
           tallest stretches, blocks of the grey shale with a few of the cap's buff sandstone, lit and shadowed like the
           wall
  fissure  across the plain toward us from the foot of the cut, narrowing as it comes, passing a metre and a half to our
           left: its dark side (facing away from the sun) seen down into, the soil over pale silt over grey shale

usage: python slot.py <the 3840 px photo> <out: a full-size PNG of the edited photo> [preview]
prints where the far wall's top edge and the opening are, in the site's picture's pixels, for surreal.js"""
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import uniform_filter1d, gaussian_filter, gaussian_filter1d

SRC, OUT = sys.argv[1], sys.argv[2]
PREVIEW = len(sys.argv) > 3
ph = Image.open(SRC).convert('RGB'); W, H = ph.size
P = np.asarray(ph, np.float32) / 255
F, VX, VY, EYE = 9000.0, W / 2, 1235.0, 1.7

# ── the butte ──
XC, ZC, KB = (1795 - VX) * 3500 / F, 3655.0, 2.5
PROF = [(-50, 820), (0, 780), (52, 663), (130, 470), (227, 332), (317, 205), (406, 200), (407, -1)]   # (height m, radius m)
PY_ = np.array([p[0] for p in PROF], float); PR_ = np.array([p[1] for p in PROF], float)
YTOP = 406.0
def radius(Y): return np.interp(Y, PY_, PR_)
def zfront(X, Y):
    r = radius(Y); d2 = r * r - (X - XC) ** 2
    return np.where(d2 > 0, ZC - np.sqrt(np.clip(d2, 0, None)), np.inf)
def zback(X, Y):
    r = radius(Y); d2 = r * r - (X - XC) ** 2
    return np.where(d2 > 0, ZC + KB * np.sqrt(np.clip(d2, 0, None)), -np.inf)

_G = {s: np.random.default_rng(s).random((64, 64)) for s in (5, 6, 31, 32, 33, 34, 35, 36, 47, 48, 61, 62, 63)}
def vnoise(u, v, cell, seed):
    g = _G[seed] if seed in _G else np.random.default_rng(seed).random((64, 64))
    fu, fv = u / cell, v / cell; iu, iv = np.floor(fu).astype(int), np.floor(fv).astype(int); tu, tv = fu - iu, fv - iv
    tu, tv = tu * tu * (3 - 2 * tu), tv * tv * (3 - 2 * tv)
    a_ = g[iv % 64, iu % 64]; b_ = g[iv % 64, (iu + 1) % 64]; c_ = g[(iv + 1) % 64, iu % 64]; d_ = g[(iv + 1) % 64, (iu + 1) % 64]
    return (a_ * (1 - tu) + b_ * tu) * (1 - tv) + (c_ * (1 - tu) + d_ * tu) * tv - 0.5
def hf(X, Z):
    """the ground's height where the photo can't show it (along the far wall, behind it, along the near wall's top): the
    butte's, with ridges and gullies running down its slopes (noise round the axis, long down the slope) and the apron's
    mounds; the cap's top flat"""
    dz = np.where(Z < ZC, Z - ZC, (Z - ZC) / KB)
    r = np.sqrt((X - XC) ** 2 + dz ** 2)
    base = np.interp(r, PR_[::-1], PY_[::-1])
    az = np.arctan2(X - XC, -dz) * 700.0                       # round the axis, metres at the slopes' middle
    ridge = vnoise(az, r * 0.25, 20.0, 31) * 0.65 + vnoise(az, r * 0.4, 7.0, 32) * 0.35
    mound = vnoise(X, Z, 45.0, 33) * 0.6 + vnoise(X, Z, 16.0, 34) * 0.4
    slope = np.clip(base / 20, 0, 1) * np.clip((395 - base) / 30, 0, 1)
    apron = np.clip(1 - np.abs(base - 15) / 40, 0, 1)
    capt = np.clip((base - 400) / 6, 0, 1)
    blocks = vnoise(X * 0.7, Z, 16.0, 35) * 0.7 + vnoise(X, Z, 6.0, 36) * 0.3
    h = base + ridge * 26 * slope + (mound + 0.25) * 26 * apron + (blocks - 0.3) * 4 * capt
    # behind the prow (the end wall's top), on the cut's far side, the caprock dips into a saddle (the photo can't show
    # the cap's top there; the cut does): the far wall's top falls away behind the prow, and sky comes down into the cleft
    if 'S0' in globals() and SAD_D > 0:
        ss_ = NX * X + NZ * Z - S0; uu_ = UX * X + UZ * Z
        t_ = np.clip((uu_ - (U_FRONT + SAD_P)) / SAD_R, 0, 1); t_ = t_ * t_ * (3 - 2 * t_)
        dd_ = SAD_D * t_ * np.clip((ss_ - (WID / 2 - 4)) / 4, 0, 1) * np.clip((base - 320) / 40, 0, 1) \
            * (1 + 0.12 * vnoise(uu_, ss_, 18.0, 33))
        # (the sandstone comes away bed by bed: flat treads, short steep risers, about 8 m each)
        q_ = dd_ / 8.0 + 0.35 * vnoise(uu_ * 0.5, ss_, 9.0, 34); fl_ = np.floor(q_)
        h = h - np.clip((fl_ + np.clip((q_ - fl_ - 0.55) / 0.45, 0, 1) ** 0.7) * 8.0, 0, None)
    return np.maximum(h, -EYE)
def solid_hf(X, Y, Z): return Y < hf(X, Z)

# ── the slice ──
ANGLE = math.radians(float(os.environ.get('SLOT_A', 20)))      # from the line of sight, running away to the left
WID = float(os.environ.get('SLOT_W', 120))                     # metres between the walls
NEAR_X = float(os.environ.get('SLOT_NX', 2010))                # the near wall meets the cap's front at this photo x
NX, NZ = math.cos(ANGLE), math.sin(ANGLE)                      # the walls' normal (pointing from the near wall to the far)
UX, UZ = -math.sin(ANGLE), math.cos(ANGLE)                     # along the walls, away from us
_z = 3500.0
for _ in range(20):
    _X = (NEAR_X - VX) / F * _z; _z = float(zfront(np.array(_X), np.array(390.0)))
S0 = NX * (NEAR_X - VX) / F * _z + NZ * _z + WID / 2            # s = n.p - S0: the slice is -WID/2 < s < WID/2
def xz_of(u, s):
    """the map's point at u along the slice and s across it"""
    a = S0 + s
    return a * NX + u * UX, a * NZ + u * UZ
# where the far wall comes into the cap (its front corner, at the prow's right), along it; and the saddle behind the prow
_uu = np.arange(2800.0, 4200.0, 0.5); _X, _Z = xz_of(_uu, WID / 2)
_r = np.sqrt((_X - XC) ** 2 + np.where(_Z < ZC, _Z - ZC, (_Z - ZC) / KB) ** 2)
U_FRONT = float(_uu[np.argmax(_r < 200)])
SAD_D = float(os.environ.get('SLOT_SD', 60))                  # how far the caprock dips (m)
SAD_P = float(os.environ.get('SLOT_SP', 60))                  # the prow's flat top, from the corner back (m)
SAD_R = float(os.environ.get('SLOT_SR', 160))                 # over how far it falls (m)
SUN = np.array([-0.42, 0.50, -0.76]); SUN /= np.linalg.norm(SUN)       # toward the sun: front left, 30 degrees up
NSUN = NX * SUN[0] + NZ * SUN[2]                                        # (< 0: the near wall is between the far one and the sun)

# ── the photo's relief: light and shade across each row integrated into ridges and gullies (lit slopes face left, toward
#    the sun, so the ground comes toward us going right across them and goes away again across the shaded ones) ──
lum = P.mean(-1)
d = lum - uniform_filter1d(lum, 41, axis=1)
c = np.cumsum(d, axis=1)
c = c - uniform_filter1d(c, 161, axis=1)
c = gaussian_filter(c, (2.0, 1.0))
REL = c / (c[300:1230, 1300:3300].std() + 1e-6) * 7.0           # metres toward us, about 7 m either way

# where the photo shows ground, not sky: below the first non-sky pixel of each column
def skylike(cc): return (cc[..., 2] - cc[..., 0] > 0.06) & (cc[..., 2] > 0.62)
top = np.zeros(W, int)
for x in range(W):
    col = skylike(P[:1240, x, :]); idx = np.where(~col[120:])[0]
    top[x] = 120 + (idx[0] if len(idx) else 1240)

# ── the rock: colours by height from the photo's own slopes and cliffs (the brighter half of each row: lit; the 1/6 to
#    1/2 quantile: in shade) ──
def front_height(xp, y):
    zz = 3500.0
    for _ in range(10):
        z2 = zfront(np.array((xp - VX) / F * zz), np.array((VY - y) / F * zz)); zz = float(z2) if np.isfinite(z2) else zz
    return (VY - y) / F * zz
lit_prof, sh_prof, hs = [], [], []
for y in range(150, 1236):
    xa, xb = (1500, 2000) if y < 430 else (1600, 2400)
    row = P[y, xa:xb][y >= top[xa:xb]]
    if len(row) < 12: continue
    l = row.mean(-1); o = np.argsort(l)
    lit_prof.append(row[o[len(o) // 2:]].mean(0)); sh_prof.append(row[o[len(o) // 6:len(o) // 2]].mean(0)); hs.append(front_height(1800, y))
hs = np.array(hs); lit_prof = np.array(lit_prof); sh_prof = np.array(sh_prof)
o = np.argsort(hs); hs, lit_prof, sh_prof = hs[o], lit_prof[o], sh_prof[o]
_hg = np.linspace(hs.min(), hs.max(), 2000)
_lit = np.stack([gaussian_filter1d(np.interp(_hg, hs, lit_prof[:, k]), 6) for k in range(3)], -1)
_sh = np.stack([gaussian_filter1d(np.interp(_hg, hs, sh_prof[:, k]), 6) for k in range(3)], -1)
hs, lit_prof, sh_prof = _hg, _lit, _sh
def prof(table, Yv): return np.stack([np.interp(Yv, hs, table[:, k]) for k in range(3)], -1)
rng = np.random.default_rng(11)
lam_y = np.linspace(-400, 420, 16400)
lam = np.cumsum(rng.standard_normal(lam_y.size)) * 0.004
lam = lam - np.convolve(lam, np.ones(400) / 400, mode='same')
lam += rng.standard_normal(lam_y.size) * 0.012
lamf = lambda Yv: np.interp(Yv, lam_y, lam)
def detail(box):
    g = np.asarray(ph.crop(box).convert('L'), np.float32) / 255
    lo = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)), np.float32) / 255
    dd = g - lo; return dd / (dd.std() + 1e-6)
DSHA = detail((1500, 600, 2350, 720))
def ratio(box, sig=9.0):
    """a vertical face of the photo's as a pattern of light and dark round 1: the cap's end wall, the shale's cliff band"""
    g = np.asarray(ph.crop(box).convert('L'), np.float32) / 255
    t = g / (gaussian_filter(g, sig) + 0.03)
    t = np.where(t > 1, 1 + (t - 1) * 0.35, t)                 # (its sunlit flutes kept down: on a wall they read as drips)
    return np.clip(t, 0.45, 1.25)
TCAP = ratio((2030, 206, 2270, 414)); TSH = ratio((1350, 637, 2650, 701))
# (the shale band's runnels, tiled down a wall, read as a curtain of drips: mostly smoothed out across, its layers kept)
TSH = TSH * 0.10 + gaussian_filter(TSH, (0.6, 14.0)) * 0.90
def tile(T, u, v, seed):
    """T laid on the wall at the photo's scale, mirrored to and fro so its ends meet; the shale's band (only 86 rows) in
    tiers, each from a different stretch of it, blended where they meet"""
    h, w = T.shape
    def mir(a, n): a = np.mod(a, 2 * n); return np.where(a < n, a, 2 * n - 1 - a)
    pu, pv = u / 0.39, v / 0.39
    B = 20
    tier = np.floor(pv / (h - B)); fv = pv - tier * (h - B)
    a_ = T[np.clip(mir(fv, h).astype(int), 0, h - 1), mir(pu + (np.abs(np.sin(tier * 91.7 + seed) * 43758.5) % 1.0) * w, w).astype(int)]
    b_ = T[np.clip((fv + (h - B)).astype(int), 0, h - 1), mir(pu + (np.abs(np.sin((tier - 1) * 91.7 + seed) * 43758.5) % 1.0) * w, w).astype(int)]
    k = np.clip(fv / B, 0, 1); k = k * k * (3 - 2 * k)
    return a_ * k + b_ * (1 - k)
def sample(D, u, v):
    h, w = D.shape; return D[(v.astype(int) % h), (u.astype(int) % w)]
# the beds, read off the photo's sheer faces (the caprock's end wall; the shale ledges' faces): each row's brightness
# against its neighbours', by height
bed_h, bed_v = [], []
for y in range(160, 1236):
    xs = slice(2160, 2215) if y < 430 else slice(2480, 2700)
    bed_h.append(front_height(2190, y)); bed_v.append(float(np.median(P[y, xs].mean(-1))))
bed_h = np.array(bed_h); bed_v = np.array(bed_v); o = np.argsort(bed_h); bed_h, bed_v = bed_h[o], bed_v[o]
bed_v = bed_v - np.convolve(bed_v, np.ones(41) / 41, mode='same')
bed_n = bed_v[20:-20].std() + 1e-6
# below the plain: the beds go on, from the shale's own (repeated, flipped, so they don't just stop)
def bed(Yv):
    Ym = np.where(Yv >= 25, Yv, 25 + np.abs(Yv - 25) % 130)
    return np.clip(np.interp(Ym, bed_h, bed_v) / bed_n, -1.6, 1.6)

# ── how much sky the far wall sees, on a grid over it (u along, Y up): from each point, eleven ways out across the gap
#    (straight across and swung up to 75 degrees either way along it), the highest the ground stands against the sky
#    that way (nothing inside the gap; the near side and the butte beyond it), as 1 - sin(that angle); weighted to the
#    straight-across ──
_us = np.arange(2000.0, 7000.0, 4.0)
_X, _Z = xz_of(_us, WID / 2); _px = VX + F * _X / _Z
_us = _us[(_px > 1600) & (_px < 3950)]
AO_U = np.arange(_us.min() - 20, _us.max() + 20, 4.0); AO_Y = np.arange(-24.0, 424.0, 4.0)
_UU, _YY = np.meshgrid(AO_U, AO_Y)
_Xp, _Zp = xz_of(_UU, WID / 2)
_acc = np.zeros_like(_UU); _wsum = 0.0
_ts = 3.0 * 1.2 ** np.arange(36); _ts = _ts[_ts < 2600]
for _phi in np.radians(np.arange(-75, 76, 15)):
    cph, sph = math.cos(_phi), math.sin(_phi)
    ddx, ddz = -NX * cph + UX * sph, -NZ * cph + UZ * sph
    beta = np.zeros_like(_UU)
    for t in _ts:
        if t * cph < WID: continue                             # still in the gap: nothing there
        h_ = hf(_Xp + ddx * t, _Zp + ddz * t)
        beta = np.maximum(beta, np.arctan2(h_ - _YY, t))
    _acc += cph * (1 - np.sin(beta)); _wsum += cph
AO_V = _acc / _wsum
def sky_view(u, Y):
    fu = np.clip((u - AO_U[0]) / 4.0, 0, len(AO_U) - 1.001); fy = np.clip((Y - AO_Y[0]) / 4.0, 0, len(AO_Y) - 1.001)
    iu, iy = fu.astype(int), fy.astype(int); tu, ty = fu - iu, fy - iy
    a_ = AO_V[iy, iu] * (1 - tu) + AO_V[iy, iu + 1] * tu; b_ = AO_V[iy + 1, iu] * (1 - tu) + AO_V[iy + 1, iu + 1] * tu
    return a_ * (1 - ty) + b_ * ty
print('sky view on the far wall: %.2f to %.2f' % (AO_V.min(), AO_V.max()))

# ── the rubble at the far wall's foot: half-cones at the angle of repose against the wall, under the tall stretches (each
#    about a ninth of the wall above it), on a low apron; blocks of a few metres (the shale's, a few of the cap's
#    sandstone), some bigger ──
TAN_R = math.tan(math.radians(34))
_wtu = np.arange(AO_U[0] - 50, AO_U[-1] + 50, 1.0)
_X, _Z = xz_of(_wtu, WID / 2); _wt = np.clip(hf(_X, _Z) + EYE, 0, None)
def wall_top(u): return np.interp(u, _wtu, _wt)
_rc = np.random.default_rng(23)
_cu = []; _u = AO_U[0]
while _u < AO_U[-1]:
    _u += _rc.uniform(45, 95); _cu.append(_u)
CU = np.array(_cu)
CH = np.clip(0.26 * wall_top(CU) + 5, 0, 48) * _rc.uniform(0.75, 1.1, CU.size) * (wall_top(CU) > 8)
CL = _rc.uniform(0, 6.28, CU.size)                              # (each cone's lobes)
def apron(wt): return (0.17 * wt + 4.0) * np.clip((wt - 6) / 6, 0, 1)
# its highest anywhere along u (against the wall, blocks and all), to skip rays that can't reach it
_T1 = apron(_wt)
for cu_, ch_ in zip(CU, CH): _T1 = np.maximum(_T1, ch_ - TAN_R * 0.6 * np.abs(_wtu - cu_))
_T1 = _T1 + 3.2
def talus_top(u): return np.interp(u, _wtu, _T1)
_tu = _wtu[_T1 > 3.2 - 1.0]
TU0, TU1 = (_tu.min(), _tu.max()) if len(_tu) else (0.0, -1.0)
print('rubble along u %.0f to %.0f, up to %.0f m' % (TU0, TU1, _T1.max() - 3.2))
def hsh(a, b, seed): return np.abs(np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453) % 1.0
def worley(u, v, cell, seed):
    fu, fv = u / cell, v / cell; iu, iv = np.floor(fu), np.floor(fv)
    d1 = np.full(u.shape, 9.0); d2 = np.full(u.shape, 9.0); idn = np.zeros(u.shape)
    for du in (-1, 0, 1):
        for dv in (-1, 0, 1):
            cu, cv = iu + du, iv + dv
            px_, pv_ = cu + 0.15 + 0.7 * hsh(cu, cv, seed), cv + 0.15 + 0.7 * hsh(cv, cu, seed + 1)
            dd = np.hypot(fu - px_, fv - pv_)
            nearer = dd < d1
            d2 = np.where(nearer, d1, np.minimum(d2, dd)); idn = np.where(nearer, hsh(cu, cv, seed + 2), idn); d1 = np.minimum(d1, dd)
    return d1, d2, idn
def talus(u, s):
    """the rubble's surface over the plain's level at u along, s across (s = WID/2 at the far wall); and the block's id"""
    back = WID / 2 - s
    hmax = apron(wall_top(u)) - TAN_R * back
    for cu_, ch_, cl_ in zip(CU, CH, CL):
        if ch_ <= 0: continue
        R0_ = 1.25 * ch_ / TAN_R
        r_ = np.sqrt((u - cu_) ** 2 + back ** 2 + (0.12 * R0_) ** 2) - 0.12 * R0_ + 1e-6     # (a rounded top)
        ang = np.arctan2(back, u - cu_)
        lobe = 1 + 0.08 * np.sin(ang * 5 + cl_) + 0.05 * np.sin(ang * 9 + cl_ * 2)      # gullied a little, not round
        R0 = R0_ * lobe                                                              # (concave: steep at the top)
        hmax = np.maximum(hmax, ch_ * np.clip(1 - r_ / R0, 0, None) ** 1.25 - TAN_R * np.clip(r_ - R0, 0, None))
    d1, d2, idn = worley(u, s, 1.5, 71)
    b1, b2, idb = worley(u + 40, s, 4.6, 72)
    big = idb > 0.84
    blk = 0.22 * np.sqrt(np.clip(1 - (d1 / 0.62) ** 2, 0, 1)) + np.where(big, 1.8 * np.sqrt(np.clip(1 - (b1 / 0.5) ** 2, 0, 1)), 0)
    return hmax + blk * (hmax > -1.0), np.where(big & (b1 < 0.5), idb, idn)

# ── beyond: the sky and the far country, from the photo's right-hand edge at the same height, matched to the sky over
#    the cap ──
bgx = 3690
bgcol = np.asarray(ph.crop((bgx - 40, 0, bgx + 40, H)).filter(ImageFilter.GaussianBlur(3)), np.float32)[:, 40] / 255
ref_here = P[150:185, 1950:2250].reshape(-1, 3).mean(0); ref_far = bgcol[150:185].mean(0)
off = ref_here - ref_far
CLONE = 420
skyrow = np.zeros((H, 3), np.float32); has = np.zeros(H, bool)
for y in range(H):
    xs_ = np.arange(2320, 3000); ok = y < top[xs_] - 3
    if ok.sum() > 20: skyrow[y] = P[y, xs_[ok]].mean(0); has[y] = True
bgl = np.asarray(ph.crop((60, 0, 260, H)).filter(ImageFilter.GaussianBlur(4)), np.float32)[:, 100] / 255

def shade_rock(Xw, Yw, Zw, behind, lit_):
    """the far wall's colour (and, where `behind`, the far side's slopes seen over its top)"""
    uw = UX * Xw + UZ * Zw
    V = sky_view(uw, Yw)
    Yc = np.clip(Yw, 22, None)
    litc = prof(lit_prof, Yc) * (0.64 + 0.36 * V)[..., None]
    shc = prof(sh_prof, Yc) * (0.16 + 0.84 * V ** 1.3)[..., None]
    face = np.where(lit_[..., None], litc, shc)
    under = np.clip(-Yw / 6, 0, 1)[..., None]                   # below the plain: fresh shale, darker and bluer
    face = face * (1 - under) + face * np.array([0.80, 0.83, 0.88]) * under
    vv = YTOP - Yw
    cap = np.clip((Yw - 312) / 8, 0, 1)[..., None]
    # fresh rock: the shale under the pale weathered crust is darker and a little bluer; the sandstone of the cap buff,
    # its red only a stain on the outside
    fresh = np.array([0.80, 0.81, 0.85]) * (1 - cap) + np.array([1.0, 0.94, 0.86]) * cap
    gray = face.mean(-1, keepdims=True)
    face = (face * 0.55 + gray * 0.45 * np.array([1.08, 1.0, 0.9])) * cap + face * (1 - cap)
    face = face * fresh
    # the grain of the rock: the photo's own vertical faces (the cap's end wall up top, the shale's cliff band below)
    grainp = np.where(Yw > 317, tile(TCAP, uw, vv, 3.0), tile(TSH, uw, YTOP - 317 + (317 - Yw), 7.0))
    # the beds standing a little proud and catching the sun on their tops (ledges), in the sun only
    def relief(v):
        return np.clip(bed(YTOP - v), -2.0, 2.5) * 0.45
    e = 0.4
    hv = (relief(vv + e) - relief(vv - e)) / (2 * e)
    SN = -(SUN[0] * NX + SUN[2] * NZ); SV = -SUN[1]
    emb = np.where(lit_, 1 + np.clip(-hv * SV / SN, -0.6, 0.6) * 0.5, 1.0)
    blot = vnoise(uw, vv, 26.0, 5) * 0.6 + vnoise(uw, vv, 9.0, 6) * 0.4
    tint = vnoise(np.zeros_like(Yw), Yw, 5.0, 47) * 0.6 + vnoise(np.zeros_like(Yw), Yw, 17.0, 48) * 0.4
    tintc = np.stack([1 + 0.06 * tint, 1 + 0.01 * tint, 1 - 0.06 * tint], -1)
    sand = np.clip(bed(Yw) - 0.8, 0, 2)[..., None] * np.array([0.06, 0.03, -0.02])
    face = face * tintc * (1 + sand) * emb[..., None] * (1 + 0.16 * bed(Yw)[..., None]) * (1 + lamf(Yw)[..., None] * 0.35) \
        * (1 + 0.13 * blot[..., None]) * (grainp ** np.where(lit_, 0.85, 0.5))[..., None]
    # the far side's ground seen past the wall's top (behind): weathered slopes, as the photo's, lit by their own slope
    ex = 2.0
    gx = (hf(Xw + ex, Zw) - hf(Xw - ex, Zw)) / (2 * ex); gz = (hf(Xw, Zw + ex) - hf(Xw, Zw - ex)) / (2 * ex)
    nrm = np.stack([-gx, np.ones_like(gx), -gz], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    sl = np.clip((nrm @ SUN) * 1.5, 0, 1)[..., None]
    slope_c = (prof(sh_prof, Yc) * (1 - sl) + prof(lit_prof, Yc) * sl) * (1 + 0.12 * sample(DSHA, uw / 0.39, vv / 0.39))[..., None]
    return np.where(behind[..., None], slope_c, face)

def sunlit(Xw, Yw, Zw):
    """from a point in the gap toward the sun: across to the near wall's plane and on a little, clear of the ground?"""
    t = WID / -NSUN
    ok = np.ones(Xw.shape, bool)
    for j in range(10):
        tt = t + j * 30.0
        ok &= ~solid_hf(Xw + SUN[0] * tt, Yw + SUN[1] * tt, Zw + SUN[2] * tt)
    return ok

def shade_talus(u, s, Y, idn):
    """the rubble's colour: shale blocks (fresh, darker and bluer than the weathered slopes) and a few of the cap's buff
    sandstone; lit by their own slope, in the near wall's shadow where it falls, and darker the further down in the gap"""
    e = 0.25
    h0, _ = talus(u, s)
    hu = (talus(u + e, s)[0] - talus(u - e, s)[0]) / (2 * e); hs_ = (talus(u, s + e)[0] - talus(u, s - e)[0]) / (2 * e)
    # world normal: up, minus the slope along u (U) and across s (n)
    nx = -hu * UX - hs_ * NX; nz = -hu * UZ - hs_ * NZ
    nrm = np.stack([nx, np.ones_like(nx), nz], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    ndl = nrm @ SUN
    X, Z = xz_of(u, s)
    # sun: the gap's near wall shades it where it stands higher than the sun's line from here
    tq = (s + WID / 2) / -NSUN
    lit = ~solid_hf(X + SUN[0] * tq, Y + SUN[1] * tq, Z + SUN[2] * tq) & ~solid_hf(X + SUN[0] * (tq + 40), Y + SUN[1] * (tq + 40), Z + SUN[2] * (tq + 40))
    V = sky_view(u, Y + 4) * 0.8 + 0.2 * np.clip((WID / 2 - s) / WID, 0, 1)
    Yc = np.full(u.shape, 60.0)
    litc = prof(lit_prof, Yc) * np.array([0.87, 0.89, 0.93]); shc = prof(sh_prof, Yc) * np.array([0.87, 0.89, 0.93])
    sandst = hsh(idn * 571, idn * 37, 9) > 0.94
    buff = np.array([1.08, 1.0, 0.88])
    litc = np.where(sandst[..., None], litc * buff, litc); shc = np.where(sandst[..., None], shc * buff, shc)
    alb = (0.93 + 0.14 * hsh(idn * 997, idn * 131, 5))[..., None]
    sunk = np.clip(ndl / 0.6, 0, 1.35) * lit
    col = (shc * (0.35 + 0.65 * V)[..., None] + (litc - shc) * sunk[..., None]) * alb
    return col, lit

# ── trace ──
x0, x1, y0, y1 = 1700, 3840, 120, int(os.environ.get('SLOT_Y1', 1300))      # (SLOT_Y1: trace only the top, to try things)
SS = 2 if not PREVIEW else 1
res = P.copy()
mask_cut = np.zeros((H, W), np.float32); mask_wall = np.zeros((H, W), np.float32)
m_fw = np.zeros((H, W), np.float32); m_thru = np.zeros((H, W), np.float32); m_beh = np.zeros((H, W), np.float32)
m_tal = np.zeros((H, W), np.float32)
cls = np.zeros((H, W, 3), np.float32)
info = {'wall': 0, 'through': 0, 'behind': 0, 'rubble': 0}
STRIP = 40
TAL_Y0 = 1060                                                 # (rubble can show from here down)
for ys in range(y0, y1, STRIP):
    ye = min(y1, ys + STRIP)
    yy, xx = np.mgrid[ys:ye:1 / SS, x0:x1:1 / SS].astype(np.float64)
    yy += 0.5 / SS; xx += 0.5 / SS
    dx, dy = (xx - VX) / F, (VY - yy) / F
    ground = yy >= top[np.clip(xx.astype(int), 0, W - 1)]
    # the first hit as the photo shows it: the butte's surface (with the relief), or the plain
    z = np.full(xx.shape, 3400.0)
    for _ in range(16):
        X, Y = dx * z, dy * z
        zn = zfront(X, Y) - REL[np.clip(yy.astype(int), 0, H - 1), np.clip(xx.astype(int), 0, W - 1)]
        z = np.where(np.isfinite(zn), zn, z)
    hitb = np.isfinite(zfront(dx * z, dy * z)) & ground
    with np.errstate(divide='ignore'):
        zg = np.where(dy < 0, -EYE / dy, np.inf)
    zh = np.where(hitb, np.minimum(z, zg), np.where(ground, zg, np.inf))
    # the photo's cap reaching a little higher than the model's (its top edge, toward the right-hand corner): those rays
    # meet the cap's front just under its top
    miss = ground & ~hitb & (dy > 0) & (yy < 450)
    if miss.any():
        zc_ = np.full(xx.shape, 3500.0)
        for _ in range(8):
            zf_ = zfront(dx * zc_, np.full(xx.shape, 398.0)); zc_ = np.where(np.isfinite(zf_), zf_, zc_)
        zh = np.where(miss & np.isfinite(zfront(dx * zc_, np.full(xx.shape, 398.0))), zc_, zh)
    # the slice along the ray: s = k z - S0
    k = NX * dx + NZ
    zin, zout = (S0 - WID / 2) / k, (S0 + WID / 2) / k
    cut = np.isfinite(zh) & (zh >= zin) & (zh <= zout)
    # the rubble in the gap, between where the ray enters the gap and where it would meet the far wall (or the ground)
    tal = np.zeros(xx.shape, bool); zt = np.zeros(xx.shape)
    if ye > TAL_Y0:
        zend = zout                                            # (the ground the photo shows inside the gap is gone)
        ku = UX * dx + UZ                                      # u along the ray = ku z
        cand = (zin < zh) & (yy > TAL_Y0) & (dy * zin < -EYE + _T1.max()) & (ku * zend > TU0) & (ku * zin < TU1)
        if cand.any():
            ci = np.where(cand)
            za, zb_ = zin[ci], zend[ci]; ddx, ddy = dx[ci], dy[ci]
            hit = np.zeros(za.shape, bool); zlo = za.copy(); zhi = zb_.copy()
            NS = 72
            for i_ in range(1, NS + 1):
                zc = za + (zb_ - za) * i_ / NS
                Xc, Zc = ddx * zc, zc
                uu, ss = UX * Xc + UZ * Zc, NX * Xc + NZ * Zc - S0
                Yr = ddy * zc
                near = (~hit) & (Yr < -EYE + talus_top(uu))
                inside = np.zeros(za.shape, bool)
                if near.any():
                    inside[near] = Yr[near] < -EYE + talus(uu[near], ss[near])[0]
                newh = inside & ~hit
                zhi = np.where(newh, zc, zhi); zlo = np.where(newh, za + (zb_ - za) * (i_ - 1) / NS, zlo)
                hit |= inside
            hi_ = np.where(hit)[0]
            zl_, zh_, hx, hy = zlo[hi_], zhi[hi_], ddx[hi_], ddy[hi_]
            for _ in range(6):
                zm = (zl_ + zh_) / 2
                uu, ss = UX * hx * zm + UZ * zm, NX * hx * zm + NZ * zm - S0
                ins = hy * zm < -EYE + talus(uu, ss)[0]
                zh_ = np.where(ins, zm, zh_); zl_ = np.where(ins, zl_, zm)
            zhi[hi_] = zh_
            tal[ci] = hit; zt[ci] = zhi
    cut = cut & ~tal
    Xo, Yo, Zo = dx * zout, dy * zout, zout
    so = solid_hf(Xo, Yo, Zo) & cut
    wall = so
    thru = cut & ~so
    # beyond the far wall's top: the far side's ground further on, or the sky
    zb = zout + 2.0
    behind = np.zeros_like(thru)
    for i_ in range(110):
        hit2 = solid_hf(dx * zb, dy * zb, zb) & thru & ~behind
        behind |= hit2
        zb = np.where(behind, zb, zb + (12.0 if i_ < 60 else 40.0))
    thru = thru & ~behind
    info['wall'] += int(wall.sum()); info['through'] += int(thru.sum()); info['behind'] += int(behind.sum()); info['rubble'] += int(tal.sum())
    # ── the far wall ──
    Yw = np.where(wall | behind, np.where(behind, dy * zb, Yo), 0.0)
    Xw = np.where(behind, dx * zb, Xo); Zw = np.where(behind, zb, Zo)
    lit_ = sunlit(Xw, Yw, Zw)
    face = shade_rock(Xw, Yw, Zw, behind, lit_)
    # ── beyond ──
    yrow = np.clip(yy.astype(int), 0, H - 1)
    fade = np.clip(1 - (yy - 185) / 700.0, 0, 1)[..., None]
    bg = bgcol[yrow] + off * fade
    farc = (yy >= top[150])[..., None]
    bg = np.where(farc, bgl[yrow], bg)
    bg = np.where((yy > 1205)[..., None], np.array([0.655, 0.62, 0.66]), bg)       # (the haze over the far plain)
    bg = bg * 0.97 + np.array([0.78, 0.82, 0.90]) * 0.03
    xsrc = np.clip(xx.astype(int) + CLONE, 0, W - 1)
    okc = yrow < top[xsrc] - 3
    bg = np.where(has[yrow][..., None], skyrow[yrow], bg)
    bg = np.where(okc[..., None], P[yrow, xsrc], bg)
    out = P[ys:ye, x0:x1].repeat(SS, 0).repeat(SS, 1).copy()
    out = np.where((wall | behind)[..., None], face, out)
    out = np.where(thru[..., None], bg, out)
    # ── the rubble ──
    if tal.any():
        ti = np.where(tal)
        zz_ = zt[ti]; Xt = dx[ti] * zz_; Yt = dy[ti] * zz_
        ut, st = UX * Xt + UZ * zz_, NX * Xt + NZ * zz_ - S0
        _, idt = talus(ut, st)
        colt, _lt = shade_talus(ut, st, Yt, idt)
        out[ti] = colt
    out += rng.standard_normal(out.shape[:2])[..., None] * 0.012 * (wall | behind | tal)[..., None]
    def dn(a):
        a = a.astype(np.float32)
        return a.reshape(ye - ys, SS, x1 - x0, SS).mean((1, 3)) if SS > 1 else a
    if SS > 1:
        out = out.reshape(ye - ys, SS, x1 - x0, SS, 3).mean((1, 3))
    res[ys:ye, x0:x1] = out
    mask_cut[ys:ye, x0:x1] = dn(cut | tal); mask_wall[ys:ye, x0:x1] = dn(wall | behind)
    m_fw[ys:ye, x0:x1] = dn(wall); m_thru[ys:ye, x0:x1] = dn(thru); m_beh[ys:ye, x0:x1] = dn(behind); m_tal[ys:ye, x0:x1] = dn(tal)
    cls[ys:ye, x0:x1] = np.stack([dn(wall & lit_), dn((wall & ~lit_) | behind), dn(thru | tal)], -1)
print('rays', info)
thr = m_thru > 0.25
thr = thr | np.roll(thr, 1, 1) | np.roll(thr, -1, 1) | np.roll(thr, 2, 1) | np.roll(thr, -2, 1)
for x in range(x0, x1 - CLONE):
    ys_ = np.where(thr[:, x])[0]
    if not len(ys_): continue
    yt = ys_.min()
    for k_ in range(-2, 9):
        y_ = yt - k_
        wgt = 1.0 if k_ <= 5 else (9 - k_) / 4.0
        if y_ < 0 or (cls[y_, x, 0] + cls[y_, x, 1]) > 0.02 or y_ >= top[x + CLONE] - 3: continue
        res[y_, x] = res[y_, x] * (1 - wgt) + P[y_, x + CLONE] * wgt
# where the far wall's new top sits a few rows under the cap's old one, the old edge's last rows go to sky as well
chg = (cls[..., 0] + cls[..., 1] + cls[..., 2]) > 0.25
for x in range(x0, x1 - CLONE):
    ys_ = np.where(chg[:450, x])[0]
    if not len(ys_): continue
    yc = ys_.min()
    if yc - top[x] > 9 or yc <= top[x] - 4: continue
    for y_ in range(max(0, top[x] - 4), yc):
        if chg[y_, x] or y_ >= top[x + CLONE] - 3: continue
        res[y_, x] = P[y_, x + CLONE]

# up in the notch: a few pixels the photo's relief put in front of the cut (so they kept the old cap's rock) are filled
# from either side, along the row
for y in range(y0, 470):
    idx = np.where(mask_cut[y, x0:x1] > 0.5)[0]
    if len(idx) < 2: continue
    gap = np.where(np.diff(idx) > 1)[0]
    for g in gap:
        a, b = x0 + idx[g] + 1, x0 + idx[g + 1]                    # uncut pixels a .. b-1, cut on both sides
        if b - a > 10: continue
        tt_ = (np.arange(a, b) - (a - 1)) / (b - (a - 1))
        res[y, a:b] = res[y, a - 1] * (1 - tt_[:, None]) + res[y, b] * tt_[:, None]
        mask_cut[y, a:b] = 1.0
        m_thru[y, a:b] = np.maximum(m_thru[y, a - 1], m_thru[y, b]); m_fw[y, a:b] = np.minimum(m_fw[y, a - 1], m_fw[y, b])

# ── the arrises: the far wall's top edge (against the sky or the slopes beyond) and its front edge (against the butte's
#    face, on the right) take a little more light, as broken edges do; and the near lip, where the photo's rock there is
#    in the sun ──
R = (slice(y0, y1), slice(x0 + 2, x1 - 2))
fw = m_fw[R]; above1 = np.maximum(m_thru, m_beh)[y0 - 1:y1 - 1, x0 + 2:x1 - 2]; above2 = np.maximum(m_thru, m_beh)[y0 - 2:y1 - 2, x0 + 2:x1 - 2]
rim = np.clip(fw * above1 * 1.0, 0, 1) * 0.20 + np.clip(fw * above2 * (1 - above1), 0, 1) * 0.08
uncut = 1 - np.clip(mask_cut + mask_wall, 0, 1)
gr = (np.arange(H)[:, None] >= top[None, :]).astype(np.float32)
right1 = (uncut * gr)[y0:y1, x0 + 3:x1 - 1]; right2 = (uncut * gr)[y0:y1, x0 + 4:x1]
rim += np.clip(fw * right1, 0, 1) * 0.12 + np.clip(fw * right2 * (1 - right1), 0, 1) * 0.05
nl = (uncut * gr)[R] * np.clip(mask_cut[y0:y1, x0 + 3:x1 - 1] + mask_cut[y0:y1, x0 + 4:x1], 0, 1)
litn = np.clip((lum[R] - 0.55) / 0.15, 0, 1)
rim += nl * litn * 0.10
res[R] = res[R] * (1 + rim[..., None] * np.array([1.0, 0.97, 0.9]))

# ── the fissure: from the cut's foot across the plain toward us, narrowing; passing FIS_C metres to our side ──
FIS_C = float(os.environ.get('SLOT_FC', -1.5))
_cx = np.where((m_fw[1212:1228, 2400:3100] + m_tal[1212:1228, 2400:3100]).max(0) > 0.5)[0] + 2400     # the cut's foot
xO = float(os.environ.get('SLOT_FO', (_cx.min() + 0.4 * (_cx.max() - _cx.min())) if len(_cx) else 2700))
ZO = F * (S0 - WID / 2) / (NX * (xO - VX) + F * NZ)            # on the near wall's line across the plain
XO = (S0 - WID / 2 - NZ * ZO) / NX
FW0, FW1 = 0.13, 0.0004
def fis_c(Z): return FIS_C + (XO - FIS_C) * Z / ZO                 # its middle
def fis_w(Z): return FW0 + FW1 * Z                                  # its width: 20 cm by us, a metre at the cut
veg = (P[..., 1] > P[..., 0] * 0.86) & (P.mean(-1) < 0.52)           # the photo's shrubs and tussocks (they overhang it)
blade = lum > uniform_filter1d(uniform_filter1d(lum, 9, axis=1), 9, axis=0) + 0.15   # (and its pale dry grass blades)
fy0, fy1 = 1236, H
FX0, FX1 = 900, 3000
lit_plain = np.median(P[1300:1500, 1500:2700].reshape(-1, 3), 0)
for ys in range(fy0, fy1, 64):
    ye = min(fy1, ys + 64)
    yy, xx = np.mgrid[ys:ye:1 / SS, FX0:FX1:1 / SS].astype(np.float64)
    yy += 0.5 / SS; xx += 0.5 / SS
    dx, dy = (xx - VX) / F, (VY - yy) / F
    zg = -EYE / dy; Xg = dx * zg
    w = fis_w(zg)
    # its edges: straight, but crumbled a little (a tenth of its width, over a metre or two)
    # its lips: crumbled away here and there (bites a metre or two long), otherwise roughly straight
    def lipn(seed, o):
        n1 = vnoise(zg, np.full(zg.shape, o), 3.5, seed); n2 = vnoise(zg, np.full(zg.shape, o + 3), 1.1, 62)
        n3 = vnoise(zg, np.full(zg.shape, o + 5), 0.28, 63) + 0.6 * vnoise(zg, np.full(zg.shape, o + 11), 0.09, 61)
        bite = np.clip((vnoise(zg, np.full(zg.shape, o + 7), 1.7, 61) - 0.18) * 4, 0, 1)
        return np.clip(1 + 0.5 * n1 + 0.25 * n2 + 0.35 * n3 + 0.9 * bite, 0.3, None)
    jl = lipn(61, 0.0); jr = lipn(63, 20.0)
    # straight overall, but jogging a little as cracks do, and pinched nearly shut here and there (soil bridging it)
    jog = 0.20 * vnoise(zg, np.full(zg.shape, 31.0), 3.0, 34) + 0.06 * vnoise(zg, np.full(zg.shape, 37.0), 0.7, 35)
    pinch = np.clip((vnoise(zg, np.full(zg.shape, 41.0), 2.4, 36) - 0.22) * 5, 0, 1) * np.clip((60 - zg) / 30, 0, 1)
    w = w * (1 - 0.8 * pinch)
    off_ = Xg - fis_c(zg) - jog * np.clip(zg / 15, 0, 1)
    inn = (zg < ZO) & (off_ > -w / 2 * jl) & (off_ < w / 2 * jr) & (zg > 6)
    # tussocks and grass blades at its edges stand over it: the photo's own, where they're there
    edge = np.minimum(off_ + w / 2 * jl, w / 2 * jr - off_) / (w + 1e-6)
    iy, ix = np.clip(yy.astype(int), 0, H - 1), np.clip(xx.astype(int), 0, W - 1)
    inn &= ~((veg[iy, ix] & (edge < 0.35)) | (blade[iy, ix] & (edge < 0.22)))
    if not inn.any(): continue
    # down into it: which wall the ray meets (both straight lines on the map), and how deep
    a0, a1 = FIS_C, (XO - FIS_C) / ZO; b0, b1 = FW0, FW1
    with np.errstate(divide='ignore', invalid='ignore'):
        zl = (a0 - b0 / 2) / (dx - (a1 - b1 / 2)); zr = (a0 + b0 / 2) / (dx - (a1 + b1 / 2))
    zl = np.where(zl > zg, zl, np.inf); zr = np.where(zr > zg, zr, np.inf)
    leftw = zl <= zr
    zw = np.minimum(zl, zr); zw = np.where(np.isfinite(zw), zw, zg * 1.5)
    dpt = np.clip(-dy * zw - EYE, 0, None)
    wl = fis_w(zw)
    # the soil: dark topsoil, then pale silt with fine layers, then grey shale; seen in shade (sky only, less the
    # deeper), the left side; the right side, if seen at all, lit above the line of the left lip's shadow
    # (the dry crust on top breaks pale; under it the topsoil, darker)
    lay = np.where(dpt < 0.03, 1.25, np.where(dpt < 0.12, 0.70, np.where(dpt < 1.4, 1.02 + 0.06 * np.sin(dpt * 41.0) + 0.04 * np.sin(dpt * 113.0), 0.85)))[..., None]
    alb = lit_plain * lay * np.where((dpt >= 1.4)[..., None], np.array([0.95, 1.0, 1.12]), np.array([1.0, 1.0, 1.0]))
    Vf = 1 - dpt / np.sqrt(dpt * dpt + wl * wl)
    # in shade, but lit from the sky over it and off the sunlit face opposite (pale silt): brown, black only deep down
    shade = 0.06 + 0.22 * Vf ** 1.3 + 0.20 * np.clip(1 - dpt / (1.19 * wl), 0, 1) * Vf
    litr = (~leftw) & (dpt < 1.19 * wl)
    col = alb * np.where(litr, 0.85, shade)[..., None]
    # clods and roots in the face
    col *= (1 + 0.35 * vnoise(zw * 5, dpt * 14, 1.0, 5) + 0.2 * vnoise(zw * 17, dpt * 40, 1.0, 6))[..., None]
    out = P[ys:ye, FX0:FX1].repeat(SS, 0).repeat(SS, 1).copy()
    out = np.where(inn[..., None], col, out)
    if SS > 1:
        out = out.reshape(ye - ys, SS, FX1 - FX0, SS, 3).mean((1, 3))
        fm = inn.reshape(ye - ys, SS, FX1 - FX0, SS).mean((1, 3))
    else:
        fm = inn.astype(np.float32)
    res[ys:ye, FX0:FX1] = out
    cls[ys:ye, FX0:FX1, 2] = np.maximum(cls[ys:ye, FX0:FX1, 2], fm)
print('fissure from photo x %.0f (%.0f m out, %.0f m across), passing %.1f m to the side' % (xO, ZO, XO, FIS_C))

res_im = Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8))
res_im.save(OUT)
np.save(os.path.splitext(OUT)[0] + '-cut.npy', mask_cut)
if PREVIEW:
    np.save(os.path.splitext(OUT)[0] + '-tal.npy', m_tal)
    Image.fromarray((np.clip(P * 0.5 + cls * 0.5, 0, 1) * 255).astype(np.uint8)).crop((1700, 60, 3500, 1300)).resize((900, 620)).save(os.path.splitext(OUT)[0] + '-cls.jpg', quality=85)

# ── the site's pictures: the butte left of centre so the cut's top falls in the right-hand margin (wide screens see x 0
#    to 2450 and the top 1900 rows, at 0.8), the cut running on out of the picture's right edge; an upright phone's cut
#    round the cap's cut, down to the fissure ──
d = os.path.dirname(OUT)
K = 0.8
wide = res_im.crop((0, 0, 2450, 1900)).resize((1960, 1520), Image.LANCZOS)
ph_ = res_im.crop((2300 - 620, 0, 2300 + 620, 2000)).resize((744, 1200), Image.LANCZOS)
if not PREVIEW:
    wide.save(os.path.join(d, 'slot-wide.webp'), quality=76, method=6)
    ph_.save(os.path.join(d, 'slot-p.webp'), quality=74, method=6)
# the opening's outline (each 6th row: its leftmost and rightmost cut pixel), and the far wall's top edge across the cap
# (where rock breaks away): for surreal.js, in the wide picture's pixels
rows = [y for y in range(120, 1240, 6) if (mask_cut[y, :2450] > 0.5).any()]
L_ = [(int(np.where(mask_cut[y, :2450] > 0.5)[0].min()), y) for y in rows]
R_ = [(int(np.where(mask_cut[y, :2450] > 0.5)[0].max()) + 1, y) for y in rows]
poly = [[round(x * K), round(y * K)] for x, y in L_ + R_[::-1]]
# simplify: drop points within 2 px of the line through their neighbours
def simp(pts, tol=2.0):
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        (ax, ay), (bx, by), (cx, cy) = out[-1], pts[i], pts[i + 1]
        dd = abs((cx - ax) * (ay - by) - (ax - bx) * (cy - ay)) / (math.hypot(cx - ax, cy - ay) + 1e-9)
        if dd > tol: out.append(pts[i])
    out.append(pts[-1]); return out
poly = simp(poly)
# the far wall's top edge where it meets the sky, across the notch and the prow (where rock breaks away): a line of
# points every 12 px, its ends a little in from the cut's sides
lip = []
for x in range(1990, 2300, 2):
    ys_ = np.where(m_fw[100:470, x] > 0.5)[0]
    if not len(ys_): continue
    yt = 100 + int(ys_.min())
    if m_thru[yt - 3, x] > 0.5: lip.append((x, yt))
lip = lip[4:-4]
lip = lip[::6] + ([lip[-1]] if (len(lip) - 1) % 6 else [])
print('lip (photo px)', lip[0], '...', lip[-1], len(lip))
print('LAYOUT', {'slot': {'w': 1960, 'h': 1520, 'open': poly, 'lip': [[round(x * K), round(y * K)] for x, y in lip]}})
