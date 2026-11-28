"""Surrealism's seventh place (skins/surreal.css, data-su="forest"): a misty clearing in a pine forest after dark, and a
big double-sided billboard standing in it on two legs, lit from inside, for a 24-hour burger place nobody has heard of
(made up: "moonbun", a neon crescent on a red 24 HOURS plate, plugged into a wall socket printed on the night sky). The
board reads "It's [clock] We're open." The clock's window is left dark here: skins/surreal.js draws the time in it, live.

The photograph: "Karachay-Cherkessia, Arkhyz, Taulu forest clearings after dusk", Vyacheslav Argenberg, CC BY 4.0
(Commons; credited in Home > About), its 1920 px copy saved as su-forest.jpg.

How it's made (all in linear light, at the photograph's own size):
  - the night: the photograph after dusk taken down to night (less exposure, colour drained toward blue, the near
    meadow a little darker still), as a shorter exposure of the same scene would be;
  - a pinhole camera matched to it (f 4000 px, horizon at row 612, eye 1.6 m over the meadow: the pines' feet at about
    220 m, 25-33 m tall, the near dock stalks about a metre), so the board stands on the meadow at 200 m, 30 m right;
  - the board is traced through that camera at 3x (boxes: the light box, its frame, two legs and a tie, a catwalk with
    a railing in front of the face); its face is the artwork below, lit from behind; the steel is lit by the face where
    the face can see it, otherwise only by the night;
  - its light on the world: the face (and the back face, which we can't see) as a grid of small emitters; the meadow
    and the pines' fronts get what reaches them (inverse square, both cosines, the catwalk's grating shading the foot),
    times their own colour from the photograph, so the grass and needles show through in their own texture;
  - the glow in the air: light scattered toward us by the photograph's own ground mist (thick near the grass, thinning
    upward) and a faint haze, marched along every ray, forward-scattering (so the face's light glows most where it
    comes toward us), the board's legs hiding what's behind them;
  - matched to the photograph: softened to its sharpness, its grain measured and added.
Also written: forest-p.webp (upright phones: the same picture cut round the board) and forest-dim.webp (black whose
opacity is the share of each pixel's light that comes from the board: surreal.js shows it for a moment when the
backlight flickers). The positions surreal.js needs are printed (LAYOUT).

usage: python forest.py <folder with su-forest.jpg> <out folder: images/surreal> [<folder for previews>]"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
PREV = sys.argv[3] if len(sys.argv) > 3 else None
FONTS = 'C:/Windows/Fonts/'

# ── the camera, matched to the photograph ──
F, YH, EYE = 4000.0, 612.0, 1.6
ZT = 220.0                                   # the pines' front
# ── the board (metres; x right, y up, z away from us) ──
ZB, DEPTH = 200.0, 1.0                       # its face, and the light box's depth
XB = (1680 - 960) * ZB / F                   # its middle, 1680 px across
BW, BH, BY0, FR = 18.0, 7.0, 9.6, 0.25       # the light box: width, height, bottom; the frame round the face
FW, FH = BW - 2 * FR, BH - 2 * FR            # the face (17.5 x 6.5 m)
FX0, FY1 = XB - FW / 2, BY0 + BH - FR        # the face's left edge, top edge
LEGX, LEGW = 5.0, 0.7                        # legs at XB +- LEGX, square
CW_Y, CW_Z0 = BY0 - 0.15, ZB - 1.1           # the catwalk: its floor's top, how far it comes out in front
PPM = 100                                    # artwork px per metre

def srgb2lin(a): a = np.asarray(a, np.float32) / 255; return np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4)
def lin2srgb(a): a = np.clip(a, 0, 1); return np.where(a <= .0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - .055)
def to8(a): return (np.clip(lin2srgb(a), 0, 1) * 255 + .5).astype(np.uint8)

# ── the artwork on the face ──
def artwork():
    S = 2; W, H = int(FW * PPM * S), int(FH * PPM * S); m = PPM * S
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    # a night sky, printed: deep at the top, a little lighter toward the bottom, stars
    top, bot = np.array([7, 12, 40], np.float32), np.array([20, 46, 112], np.float32)
    g = (np.linspace(0, 1, H)[:, None] ** 1.3) * (bot - top) + top
    im = Image.fromarray(np.repeat(g[:, None, :], W, 1).astype(np.uint8)); d = ImageDraw.Draw(im)
    rng = np.random.default_rng(7)
    for _ in range(170):
        x, y, r = rng.uniform(0, W), rng.uniform(0, H * .92), rng.uniform(.012, .04) * m
        c = int(rng.uniform(120, 255)); d.ellipse((x - r, y - r, x + r, y + r), fill=(c, c, min(255, c + 10)))
    bold = lambda px: ImageFont.truetype(FONTS + 'seguibl.ttf', int(px))
    # the words, sized so "We're open." spans the right-hand part
    U0, U1 = 6.9, 17.0
    fs = 200
    while bold(fs * S).getlength("We're open.") / m < U1 - U0 - .1: fs += 4
    while bold(fs * S).getlength("We're open.") / m > U1 - U0 - .1: fs -= 1
    f = bold(fs * S); cap = (f.getbbox('H')[3] - f.getbbox('H')[1]) / m
    b1, b2 = 1.05 + cap + .12, 1.05 + cap + .12 + cap * 1.62           # the two lines' baselines
    d.text((U0 * m, b1 * m), "It's", font=f, fill=(255, 255, 255), anchor='ls')
    d.text((U0 * m, b2 * m), "We're open.", font=f, fill=(255, 255, 255), anchor='ls')
    # the clock's window, after "It's": a dark panel in a thin bezel (the time itself is drawn live)
    wx0 = U0 + f.getlength("It's ") / m + .25; wx1 = U1
    wy0, wy1 = b1 - cap - .34, b1 + .34
    d.rectangle((wx0 * m, wy0 * m, wx1 * m, wy1 * m), fill=(44, 44, 50))
    d.rectangle(((wx0 + .07) * m, (wy0 + .07) * m, (wx1 - .07) * m, (wy1 - .07) * m), fill=(5, 5, 7))
    # the tagline, small, in script
    sc = ImageFont.truetype(FONTS + 'segoesc.ttf', int(.44 * m))
    d.text((U1 * m, (b2 + .78) * m), "moonbun \u00b7 for whoever's still up", font=sc, fill=(226, 232, 255), anchor='rs')
    # the mark: a neon crescent on a red 24 HOURS plate, its cord running down to a wall socket
    cx, cy, R = 3.35, 2.25, 1.5
    tube = Image.new('L', (W, H), 0); td = ImageDraw.Draw(tube)
    ox, oy, r2 = .62, -.42, 1.22                                             # the bite out of the moon
    th = .14
    td.ellipse(((cx - R) * m, (cy - R) * m, (cx + R) * m, (cy + R) * m), outline=255, width=int(th * m))
    bite = Image.new('L', (W, H), 0); ImageDraw.Draw(bite).ellipse(((cx + ox - r2) * m, (cy + oy - r2) * m, (cx + ox + r2) * m, (cy + oy + r2) * m), fill=255)
    tube = Image.fromarray(np.where(np.asarray(bite) > 0, 0, np.asarray(tube)).astype(np.uint8))
    td = ImageDraw.Draw(tube)
    td.ellipse(((cx + ox - r2) * m, (cy + oy - r2) * m, (cx + ox + r2) * m, (cy + oy + r2) * m), outline=255, width=int(th * m))
    inner = Image.new('L', (W, H), 0); ImageDraw.Draw(inner).ellipse(((cx - R + th * .5) * m, (cy - R + th * .5) * m, (cx + R - th * .5) * m, (cy + R - th * .5) * m), fill=255)
    tube = Image.fromarray(np.where(np.asarray(inner) > 0, np.asarray(tube), 0).astype(np.uint8))
    t = np.asarray(tube, np.float32) / 255
    glow = np.asarray(tube.filter(ImageFilter.GaussianBlur(.22 * m)), np.float32) / 255
    glow2 = np.asarray(tube.filter(ImageFilter.GaussianBlur(.6 * m)), np.float32) / 255
    a = np.asarray(im, np.float32)
    a = a + glow2[..., None] * np.array([255, 150, 30]) * .55 + glow[..., None] * np.array([255, 190, 60]) * .9
    a = a * (1 - t[..., None]) + t[..., None] * np.array([255, 246, 196])
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
    px0, px1, py0, py1 = 1.55, 5.15, 4.0, 5.15
    d.rounded_rectangle((px0 * m, py0 * m, px1 * m, py1 * m), radius=.12 * m, fill=(198, 28, 34))
    fp = bold(10); fz = 10
    while (bold(fz * S).getbbox('H')[3] - bold(fz * S).getbbox('H')[1]) / m < .5: fz += 2
    d.text(((px0 + px1) / 2 * m, (py0 + py1) / 2 * m), '24 HOURS', font=bold(fz * S), fill=(255, 255, 255), anchor='mm')
    for bx in (cx - .55, cx + .7):                                          # two little brackets holding the tube to the plate
        d.rectangle(((bx - .03) * m, (cy + R - .25) * m, (bx + .03) * m, py0 * m), fill=(60, 60, 66))
    # the cord, from the plate's corner down and along to the socket
    pts = []
    for k in range(41):
        s = k / 40; p0, p1, p2, p3 = (px1 - .25, py1), (px1 - .15, py1 + 1.0), (px1 + .25, py1 + .15), (px1 + .72, py1 + .55)
        q = [(1 - s) ** 3 * p0[i] + 3 * (1 - s) ** 2 * s * p1[i] + 3 * (1 - s) * s * s * p2[i] + s ** 3 * p3[i] for i in (0, 1)]
        pts.append((q[0] * m, q[1] * m))
    d.line(pts, fill=(18, 18, 22), width=int(.07 * m), joint='curve')
    sx, sy, ss = px1 + .72, py1 + .55, .5                                   # the socket
    d.rounded_rectangle(((sx - .02) * m, (sy - ss / 2) * m, (sx + ss) * m, (sy + ss / 2) * m), radius=.06 * m, fill=(226, 228, 232))
    d.rectangle(((sx - .04) * m, (sy - .09) * m, (sx + .17) * m, (sy + .09) * m), fill=(28, 28, 32))   # the plug in it
    d.rectangle(((sx + .3) * m, (sy - .1) * m, (sx + .34) * m, (sy + .1) * m), fill=(90, 90, 96))       # its switch
    art = im.resize((int(FW * PPM), int(FH * PPM)), Image.LANCZOS)
    win = dict(u0=wx0, u1=wx1, v0=wy0, v1=wy1)
    return art, win

def main():
    ph = Image.open(os.path.join(SRC, 'su-forest.jpg')).convert('RGB'); W, H = ph.size
    P = srgb2lin(ph)
    lum = P @ np.array([.2126, .7152, .0722], np.float32)
    # ── the night ──
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dry = P * .38 + lum[..., None] * .62
    N = dry * np.array([.55, .72, 1.25], np.float32) * .085
    N = N * (1 - .4 * np.clip((yy - 760) / 516, 0, 1) ** 1.3)[..., None]     # the near meadow, darker still
    N = N * (1 - .25 * np.clip((360 - xx) / 360, 0, 1) ** 2)[..., None] * (1 - .2 * np.clip((280 - yy) / 280, 0, 1) ** 2)[..., None]
    # ── the art, the face's emitters ──
    art, win = artwork()
    A = srgb2lin(art.filter(ImageFilter.GaussianBlur(.6))) * 1.15           # the face's light (white just over 1)
    GX, GY = 7, 3
    em = []                                                                    # (x, y, radiance*area rgb)
    ah, aw = A.shape[:2]
    for j in range(GY):
        for i in range(GX):
            cell = A[j * ah // GY:(j + 1) * ah // GY, i * aw // GX:(i + 1) * aw // GX].reshape(-1, 3).mean(0)
            em.append((FX0 + (i + .5) * FW / GX, FY1 - (j + .5) * FH / GY, cell * (FW / GX) * (FH / GY)))
    EX = np.array([e[0] for e in em], np.float32); EY = np.array([e[1] for e in em], np.float32); EI = np.array([e[2] for e in em], np.float32)
    print('face mean radiance', A.reshape(-1, 3).mean(0))
    # ── what each pixel sees: pines (at their front), the meadow, or sky ──
    dx = (xx + .5 - W / 2) / F; dy = -(yy + .5 - YH) / F
    yfoot = YH + F * EYE / ZT
    tree = (yy < yfoot) & ((lum < .16) | (yy > 520))
    ground = yy >= yfoot
    Z = np.where(ground, F * EYE / np.maximum(yy + .5 - YH, 1e-3), np.where(tree, ZT, 340.0)).astype(np.float32)
    # ── the board's light on the meadow and the pines' fronts ──
    reg = (slice(0, H), slice(900, W))
    X = dx[reg] * Z[reg]; Y = EYE + dy[reg] * Z[reg]; Zr = Z[reg]
    Eg = np.zeros(X.shape + (3,), np.float32)
    isg, ist = ground[reg], tree[reg]
    for k in range(len(EX)):
        for back in (False, True):
            ez = ZB + DEPTH if back else ZB
            vx, vy, vz = X - EX[k], Y - EY[k], Zr - ez
            d2 = np.maximum(vx * vx + vy * vy + vz * vz, 4.0); dd = np.sqrt(d2)
            cosE = np.clip((vz if back else -vz) / dd, 0, None)
            # the meadow (facing up), the pines (their fronts toward us; needles take light from all round a little)
            cosS = np.where(isg, np.clip(-vy / dd, 0, None), np.where(ist, .3 + .7 * np.clip(vz / dd, 0, None) if back else .3 * np.clip(-vy / dd, 0, None), 0))
            if not back:                                               # the catwalk's grating, under the face, shades its foot
                t = (CW_Y - EY[k]) / np.where(np.abs(vy) > 1e-3, vy, -1e-3)
                hz = ZB + t * vz; hx = EX[k] + t * vx
                cosS = cosS * np.where((t > 0) & (t < 1) & (hz > CW_Z0) & (hz < ZB) & (np.abs(hx - XB) < BW / 2), .45, 1)
            Eg += (cosE * cosS / d2)[..., None] * EI[k] * np.exp(-.004 * dd)[..., None]
    alb = P[reg] / .55                                                        # each surface's own colour (the dusk lit it at about .55)
    SURF = np.zeros_like(P); SURF[reg] = alb * Eg / math.pi * 3.2
    # ── the glow in the air: marched along each ray, at a third of the size ──
    q = 3; hq, wq = H // q, W // q
    gx0 = 900 // q
    yq, xq = np.mgrid[0:hq, gx0:wq].astype(np.float32) * q + q / 2
    dxq = (xq - W / 2) / F; dyq = -(yq - YH) / F
    Zq = np.asarray(Image.fromarray(Z).resize((wq, hq), Image.BILINEAR))[:, gx0:]
    Zq = np.minimum(Zq, np.where(yq >= yfoot, F * EYE / np.maximum(yq - YH, 1e-3), 340))
    nrm = np.sqrt(dxq ** 2 + dyq ** 2 + 1)
    RHO_M, H_M, RHO_A, G = .009, 3.8, .0016, .55
    mist = lambda Yv, Xv: RHO_M * np.exp(-np.maximum(Yv, 0) / H_M) * (.75 + .5 * np.clip(np.sin(Xv * .05) * .5 + .5, 0, 1)) + RHO_A
    def march(z0, z1, back, n=72):
        acc = np.zeros(yq.shape + (3,), np.float32); tau = np.zeros(yq.shape, np.float32)
        tau += mist(EYE + dyq * z0 * .5, dxq * z0 * .5) * z0 * nrm                # the air between us and the start
        dz = np.maximum(z1 - z0, 0) / n
        for s in range(n):
            z = z0 + (s + .5) * dz
            px, py = dxq * z, EYE + dyq * z
            rho = mist(py, px); ds = dz * nrm
            T = np.exp(-tau - rho * ds * .5)
            Lin = np.zeros_like(acc)
            ez = ZB + DEPTH if back else ZB
            for k in range(len(EX)):
                vx, vy, vz = px - EX[k], py - EY[k], z - ez
                d2 = np.maximum(vx * vx + vy * vy + vz * vz, 6.0); dd = np.sqrt(d2)
                cosE = np.clip((vz if back else -vz) / dd, 0, None)
                c = -(vx * dxq + vy * dyq + vz) / (dd * nrm)                   # light's way on, against ours back to the camera
                ph = (1 - G * G) / (4 * math.pi * (1 + G * G - 2 * G * c) ** 1.5)
                Lin += (cosE * ph / d2 * np.exp(-.006 * dd))[..., None] * EI[k]
            acc += (rho * ds * T)[..., None] * Lin
            tau += rho * ds
        return acc, np.exp(-tau)
    zfront = np.minimum(Zq, ZB)
    Gf, Tf = march(np.full_like(Zq, 20.0), zfront, False)
    Gb, _ = march(np.full_like(Zq, ZB + DEPTH), np.maximum(Zq, ZB + DEPTH), True, n=40)
    def up(a):
        full = np.zeros((H, W) + a.shape[2:], np.float32)
        chans = [a] if a.ndim == 2 else [a[..., i] for i in range(a.shape[2])]
        res = [np.asarray(Image.fromarray(c.astype(np.float32), 'F').resize((W - gx0 * q, H), Image.BICUBIC)) for c in chans]
        full[:, gx0 * q:] = res[0] if a.ndim == 2 else np.stack(res, -1)
        return full
    GLOWK = 1.0
    GF, GB, TF = up(Gf) * GLOWK, up(Gb) * GLOWK, up(Tf); TF[:, :gx0 * q] = 1
    # ── the board, traced at 3x over its box ──
    SS = 3
    pr = lambda X_, Y_, Z_: (W / 2 + F * X_ / Z_, YH - F * (Y_ - EYE) / Z_)
    bx0, by0 = pr(XB - BW / 2 - .5, BY0 + BH + .3, ZB); bx1, by1 = pr(XB + BW / 2 + .5, 0, ZB - 1.2)
    BX0, BY0p, BX1, BY1p = int(bx0) - 3, int(by0) - 3, int(bx1) + 4, int(by1) + 3
    sy, sx = np.mgrid[0:(BY1p - BY0p) * SS, 0:(BX1 - BX0) * SS].astype(np.float32)
    rx = (BX0 + (sx + .5) / SS - W / 2) / F; ry = -(BY0p + (sy + .5) / SS - YH) / F
    tmin = np.full(rx.shape, np.inf, np.float32); nrmv = np.zeros(rx.shape + (3,), np.float32); kind = np.zeros(rx.shape, np.int8)
    def box(x0, x1, y0, y1, z0, z1, kd):
        # rays from (0, EYE, 0) along (rx, ry, 1): the slab test, keeping the nearest hit and its face's normal
        with np.errstate(divide='ignore', invalid='ignore'):
            tx0, tx1 = x0 / rx, x1 / rx; ty0, ty1 = (y0 - EYE) / ry, (y1 - EYE) / ry
        txa, txb = np.minimum(tx0, tx1), np.maximum(tx0, tx1); tya, tyb = np.minimum(ty0, ty1), np.maximum(ty0, ty1)
        tn = np.maximum(np.maximum(txa, tya), z0); tf = np.minimum(np.minimum(txb, tyb), z1)
        hit = (tn <= tf) & (tn > 0) & (tn < tmin)
        ax = np.where(tn == z0, 2, np.where(tn == txa, 0, 1))
        n = np.zeros(rx.shape + (3,), np.float32)
        n[..., 0] = np.where(ax == 0, np.where(rx > 0, -1, 1), 0); n[..., 1] = np.where(ax == 1, np.where(ry > 0, -1, 1), 0); n[..., 2] = np.where(ax == 2, -1, 0)
        tmin[hit] = tn[hit]; nrmv[hit] = n[hit]; kind[hit] = kd
    L, R = XB - BW / 2, XB + BW / 2
    box(L, R, BY0, BY0 + BH, ZB, ZB + DEPTH, 1)                               # the light box (its face is kind 2, below)
    for s in (-1, 1):
        lx = XB + s * LEGX
        box(lx - LEGW / 2, lx + LEGW / 2, 0, BY0, ZB + .15, ZB + .15 + LEGW, 3)          # the legs
    box(XB - LEGX, XB + LEGX, 4.6, 5.0, ZB + .3, ZB + .6, 3)                            # a tie between them
    box(XB - LEGX - .2, XB + LEGX + .2, 3.4, 3.62, ZB + .35, ZB + .55, 3)
    box(L, R, CW_Y - .14, CW_Y, CW_Z0, ZB, 4)                                         # the catwalk
    for k in range(9):                                                                # its railing: posts, top and middle rails
        px_ = L + .1 + k * (BW - .2) / 8
        box(px_ - .035, px_ + .035, CW_Y, CW_Y + 1.05, CW_Z0, CW_Z0 + .07, 5)
    box(L, R, CW_Y + .99, CW_Y + 1.05, CW_Z0, CW_Z0 + .06, 5); box(L, R, CW_Y + .5, CW_Y + .54, CW_Z0, CW_Z0 + .05, 5)
    for s in (-1, 1):                                                                 # brackets under the catwalk to the legs
        box(XB + s * LEGX - .1, XB + s * LEGX + .1, CW_Y - .9, CW_Y - .14, CW_Z0 + .2, ZB + .2, 3)
    hx, hy, hz = rx * tmin, EYE + ry * tmin, tmin
    face = (kind == 1) & (nrmv[..., 2] < -.5) & (hx > FX0) & (hx < FX0 + FW) & (hy < FY1) & (hy > FY1 - FH)
    kind[face] = 2
    col = np.zeros(rx.shape + (3,), np.float32)
    # the face: the artwork, lit from behind
    u = np.clip((hx - FX0) * PPM, 0, A.shape[1] - 1.001); v = np.clip((FY1 - hy) * PPM, 0, A.shape[0] - 1.001)
    u0, v0 = np.floor(u).astype(int), np.floor(v).astype(int); fu, fv = (u - u0)[..., None], (v - v0)[..., None]
    samp = (A[v0, u0] * (1 - fu) + A[v0, u0 + 1] * fu) * (1 - fv) + (A[v0 + 1, u0] * (1 - fu) + A[v0 + 1, u0 + 1] * fu) * fv
    col[face] = samp[face]
    # the steel: dark, lit by the face where it can see it, by the night, and a little from the lit meadow below
    st = (kind > 0) & ~face
    Est = np.zeros(rx.shape + (3,), np.float32)
    for k in range(len(EX)):
        vx, vy, vz = hx - EX[k], hy - EY[k], hz - ZB
        d2 = np.maximum(vx * vx + vy * vy + vz * vz, .25); dd = np.sqrt(d2)
        cosE = np.clip(-vz / dd, 0, None)
        cosS = np.clip(-(nrmv[..., 0] * vx + nrmv[..., 1] * vy + nrmv[..., 2] * vz) / dd, 0, None)
        Est += (cosE * cosS / d2)[..., None] * EI[k]
    night = np.array([.006, .008, .014], np.float32) * (1 + .6 * (nrmv[..., 1:2] > .5))
    upl = np.array([.010, .009, .012], np.float32) * (nrmv[..., 1:2] < -.5)
    albs = np.where(kind[..., None] == 4, .26, np.where(kind[..., None] == 5, .22, .2))
    col[st] = (albs * (Est / math.pi * 1.0 + night + upl))[st]
    # the light box's edges catch a line of the face's light
    rim = (kind == 1) & ~face & (nrmv[..., 2] < -.5)
    col[rim] = col[rim] + np.array([.03, .04, .07], np.float32)
    cov = (kind > 0).astype(np.float32)
    def down(a):
        hh, ww = a.shape[0] // SS, a.shape[1] // SS
        return a.reshape(hh, SS, ww, SS, *a.shape[2:]).mean((1, 3))
    bc = down(col * cov[..., None]); ba = down(cov); bf = down(face.astype(np.float32))
    bc = np.where(ba[..., None] > 1e-4, bc / np.maximum(ba[..., None], 1e-4), 0)
    soft = lambda a_, s_: np.asarray(Image.fromarray(a_.astype(np.float32), 'F').filter(ImageFilter.GaussianBlur(s_)))
    bc = np.stack([soft(bc[..., i], .42) for i in range(3)], -1); ba = soft(ba, .42)
    # ── put it together ──
    base = N + SURF
    out = base.copy()
    sl = (slice(BY0p, BY1p), slice(BX0, BX1))
    tfr = TF[sl][..., None]
    out[sl] = out[sl] * (1 - ba[..., None]) + bc * ba[..., None] * tfr
    COV = np.zeros((H, W), np.float32); COV[sl] = ba
    out = out + GF + GB * (1 - COV[..., None])
    # grain: the photograph's own, measured in its sky (night version) and given to everything new
    s8 = lin2srgb(N)
    sk = s8[30:150, 200:1100].mean(-1)
    hp = sk - np.asarray(Image.fromarray((sk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    GR = float(np.clip(hp.std(), .003, .02)); print('grain', GR)
    o8 = lin2srgb(out)
    newl = np.clip((lin2srgb(out) - s8) * 6, 0, 1).mean(-1)
    rng = np.random.default_rng(11)
    o8 = o8 + rng.standard_normal((H, W, 1)).astype(np.float32) * GR * newl[..., None]
    img = Image.fromarray((np.clip(o8, 0, 1) * 255 + .5).astype(np.uint8))
    img.save(os.path.join(OUT, 'forest.webp'), quality=74, method=6)
    pw = round(H * .62); x0 = max(0, min(W - pw, 1680 - pw // 2))
    img.crop((x0, 0, x0 + pw, H)).save(os.path.join(OUT, 'forest-p.webp'), quality=72, method=6)
    # the share of each pixel's light that is the board's (for the flicker)
    lo, hi = lum_of(N), lum_of(out)
    frac = np.clip((hi - lo * (1 - COV)) / np.maximum(hi, 1e-5), 0, 1)
    frac = np.where(hi > 1e-4, frac, 0)
    ys, xs = np.where(frac > .03)
    DX0, DY0, DX1, DY1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    dim = np.zeros((DY1 - DY0, DX1 - DX0, 4), np.uint8); dim[..., 3] = (frac[DY0:DY1, DX0:DX1] * 255 + .5).astype(np.uint8)
    Image.fromarray(dim, 'RGBA').save(os.path.join(OUT, 'forest-dim.webp'), quality=80, method=6)
    # where the clock's window is, in the photograph's pixels (a plane square to the camera: a rectangle)
    wx0, wy0 = pr(FX0 + win['u0'], FY1 - win['v0'], ZB); wx1, wy1 = pr(FX0 + win['u1'], FY1 - win['v1'], ZB)
    fx0, fy0 = pr(FX0, FY1, ZB); fx1, fy1 = pr(FX0 + FW, FY1 - FH, ZB)
    import json
    print('LAYOUT', json.dumps({ 'w':W, 'h':H, 'win':[round(wx0, 2), round(wy0, 2), round(wx1, 2), round(wy1, 2)], 'face':[round(fx0, 1), round(fy0, 1), round(fx1, 1), round(fy1, 1)],
        'dim':[DX0, DY0, DX1 - DX0, DY1 - DY0], 'p':[x0, pw], 'pxm':F / ZB }))
    if PREV:
        img.crop((1250, 150, 1920, 800)).resize((1005, 975), Image.LANCZOS).save(os.path.join(PREV, 'forest-zoom.jpg'), quality=90)
        img.save(os.path.join(PREV, 'forest-full.jpg'), quality=90)
        art.save(os.path.join(PREV, 'forest-art.png'))

def lum_of(a): return a @ np.array([.2126, .7152, .0722], np.float32)

if __name__ == '__main__':
    main()
