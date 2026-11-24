"""Surrealism's stranded ship (Resources, Finder, Themes): the Dutch ship rendered by ship.html (three.js in headless Chrome,
ship-shoot.mjs; the Poly Haven model, CC0) put into the Mesquite Flat dunes at dusk (Commons, CC0).

usage: python wreck.py <photos folder> <ship.png> <shadow.png> <out folder: images/surreal>
writes:
  wreck.webp       the dunes with the ship's soft shadow (the wide backdrop)
  wreck-ship.webp  the ship, cut out, buried in a drift of the photo's own sand at the bottom, a touch of haze and grain to
                   sit in the photo; drawn over the rolling clouds by surreal.js (its place: printed below)
  wreck-clouds.webp  a strip of dusk cloud (the Bonneville cumulus, recoloured and made see-through), its ends blended so
                   it repeats without a seam; it rolls slowly across the sky behind the masts
  wreck-p.webp     an upright phone's picture, all of it baked"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageOps

SRC, SHIP, SHADOW, OUT = sys.argv[1:5]
# (mirrored: its branch and the glow of the sun gone down go to the left, leaving the right, beside the page, open)
ph = ImageOps.mirror(Image.open(os.path.join(SRC, 'su-mesquite.jpg')).convert('RGB')); W, H = ph.size
ship = Image.open(SHIP).convert('RGBA'); shadow = Image.open(SHADOW).convert('RGBA')

# ── the ship: haze, grain, and the sand drift where it goes in ──
S = np.asarray(ship, np.float32) / 255
a = S[..., 3]
haze = np.array([0.62, 0.66, 0.80], np.float32)                      # the dusk air between us and it, 50 m deep
S[..., :3] = S[..., :3] * 0.9 + haze * 0.1
rng = np.random.default_rng(3)
S[..., :3] += (rng.standard_normal((H, W, 1)).astype(np.float32) * 0.018)    # the phone photo's grain
# where the hull meets the ground: the lowest opaque pixel of each column
cols = np.where(a.max(0) > 0.5)[0]; x0, x1 = cols.min(), cols.max()
bottom = np.full(W, -1)
for x in range(x0, x1 + 1):
    ys = np.where(a[:, x] > 0.5)[0]
    if len(ys): bottom[x] = ys.max()
P = np.asarray(ph, np.float32) / 255
yy = np.arange(H)[:, None]
drift = np.zeros((H, W), np.float32)
span = np.where(bottom >= 0)[0]
# only along the hull's foot (the lowest part), not under the masts' or the sails' ends higher up
foot = bottom[span].max(); low = span[bottom[span] > foot - 40]
for x in low:
    t = (x - low.min()) / max(1, low.max() - low.min())
    h = 6 + 14 * np.sin(np.pi * t) ** 0.7                             # a drift highest in the middle
    b = bottom[x]
    up = np.clip((yy[:, 0] - (b - h)) / max(1.0, h), 0, 1) ** 1.6        # rising up the hull
    down = np.clip(1 - (yy[:, 0] - b) / 8.0, 0, 1)                       # and gone a few pixels below its foot
    drift[:, x] = up * down
drift = np.asarray(Image.fromarray((drift * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
# the drift is sand from just below, a little darker against the hull
sand = np.roll(P, 26, axis=0) * 0.92
S[..., :3] = S[..., :3] * (1 - drift[..., None]) + sand * drift[..., None]
S[..., 3] = np.maximum(a, drift * (a > 0.02).astype(np.float32) * 0 + drift * (drift > 0.05))
S = np.clip(S, 0, 1)
shipC = Image.fromarray((S * 255).astype(np.uint8), 'RGBA')
bb = shipC.getbbox()
shipC.crop(bb).save(os.path.join(OUT, 'wreck-ship.webp'), quality=86, method=6)

# ── the backdrop: the dunes and the ship's shadow ──
back = ph.convert('RGBA'); back.alpha_composite(shadow)
back = back.convert('RGB')
back.save(os.path.join(OUT, 'wreck.webp'), quality=74, method=6)

# ── the clouds: Bonneville cumulus, dusk-coloured (warm underneath, cool on top), alpha from their brightness ──
fl = Image.open(os.path.join(SRC, 'su-flat.jpg')).convert('RGB').crop((0, 0, 1920, 520))
F = np.asarray(fl, np.float32) / 255
lum = F.mean(-1)
sat = (F.max(-1) - F.min(-1)) / np.maximum(F.max(-1), 1e-3)            # the blue sky between the clouds is saturated; cloud isn't
alpha = np.clip((0.30 - sat) / 0.16, 0, 1) * np.clip((lum - 0.42) / 0.3, 0, 1)
alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
ys = np.linspace(0, 1, F.shape[0])[:, None]
under = np.array([1.0, 0.70, 0.55]); top = np.array([0.55, 0.60, 0.78])
tint = top * (1 - ys[..., None]) + under * ys[..., None]
C = np.concatenate([np.clip(lum[..., None] * tint * 1.05, 0, 1), (alpha * 0.7)[..., None]], -1)
C[:44, :, 3] *= np.linspace(0, 1, 44)[:, None] ** 1.5              # (clouds touching the strip's top would be cut flat)
# repeating without a seam: the strip's last stretch blended into its first, so the tile wraps (a mirror image would
# show a symmetrical cloud at the join)
B = 360; Wd = C.shape[1] - B
t = np.linspace(0, 1, B)[None, :, None]
tile = C[:, :Wd].copy(); tile[:, :B] = C[:, Wd:Wd + B] * (1 - t) + C[:, :B] * t
two = Image.fromarray((np.clip(tile, 0, 1) * 255).astype(np.uint8), 'RGBA').resize((round(Wd * 292 / C.shape[0] * 1.0), 292), Image.LANCZOS)
two.save(os.path.join(OUT, 'wreck-clouds.webp'), quality=60, method=6)

# ── the phone's picture: backdrop, a still of the clouds high in the sky, the ship ──
full = back.convert('RGBA')
band = two.crop((300, 0, 300 + W // 2, 292)).resize((W, 584), Image.LANCZOS)      # (the tile is wider than W/2)
fade = np.ones((584, W), np.float32); fade[-200:] *= np.linspace(1, 0, 200)[:, None]
bA = np.asarray(band, np.float32); bA[..., 3] *= fade
full.alpha_composite(Image.fromarray(bA.astype(np.uint8), 'RGBA'), (0, 40))
full.alpha_composite(shipC)
fx = (bb[0] + bb[2]) / 2 / W
pw = round(H * 0.62); px0 = max(0, min(W - pw, round(fx * W - pw / 2)))
full.convert('RGB').crop((px0, 0, px0 + pw, H)).save(os.path.join(OUT, 'wreck-p.webp'), quality=72, method=6)
print('LAYOUT', {'wreck': {'w':W, 'h':H, 'ship':list(bb), 'clouds':[0, 40, W, 584]}})
