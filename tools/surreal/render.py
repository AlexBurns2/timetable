"""Surrealism's backgrounds (skins/surreal.css), rendered offline from the photographs:

  home   the flooded Bonneville Salt Flats, a chrome sphere floating over them (ray traced against the photo itself,
         so its reflection is that sky and that water), and its reflection in the water below
  tt     the Great Sand Dunes at dusk, as photographed (the square of light over them is drawn live: skins/surreal.js)
  plan   the Salar de Uyuni's crust before sunrise, four mirrors standing on it, each showing a piece of sky that isn't there
  mist   a forested mountain in cloud, with a disc of it lifted out of place

usage: python render.py <folder with the downloaded photos> <out folder: images/surreal>
The photographs (Commons; credited in Home > About) are su-flat.jpg, su-dunes.jpg, su-crust.jpg, su-mist.jpg.
Each scene is written wide (1920 across) and upright for phones (-p). Nothing here runs on the site."""
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
def load(n): return Image.open(os.path.join(SRC, n)).convert('RGB')
def save(im, name, focus_x, q=74):
    w, h = im.size
    if w > 1920: im = im.resize((1920, round(h * 1920 / w)), Image.LANCZOS); w, h = im.size
    im.save(os.path.join(OUT, name + '.webp'), quality=q, method=6)
    pw = round(h * 0.62); x0 = max(0, min(w - pw, round(focus_x * w - pw / 2)))
    im.crop((x0, 0, x0 + pw, h)).save(os.path.join(OUT, name + '-p.webp'), quality=q - 2, method=6)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')

def bilinear(img, u, v):
    """sample an HxWx3 float array at fractional pixel coords (u across, v down), clamped"""
    H, W = img.shape[:2]
    u = np.clip(u, 0, W - 1.001); v = np.clip(v, 0, H - 1.001)
    x0 = np.floor(u).astype(int); y0 = np.floor(v).astype(int); fx = (u - x0)[..., None]; fy = (v - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

# ── home: the chrome sphere ──
def sphere(photo, horizon, R, ss=3):
    """a mirror sphere of radius R px seen straight on, reflecting the world the photo shows: the sky above the horizon,
    the flooded flat below it; behind the camera, the same photo mirrored. Returns RGBA."""
    P = np.asarray(photo, dtype=np.float32) / 255.0
    H, W = P.shape[:2]; yh = horizon * H
    N = 2 * R * ss
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float32)
    x = (xs + .5) / N * 2 - 1; y = 1 - (ys + .5) / N * 2
    rr = x * x + y * y; inside = rr <= 1
    z = np.sqrt(np.clip(1 - rr, 0, 1))
    # view along -z: r = d - 2 (d.n) n, d = (0,0,-1)
    rx, ry, rz = 2 * z * x, 2 * z * y, -1 + 2 * z * z
    lon = np.arctan2(rx, rz) + 0.62 * math.pi       # (turned, so the photo's mirrored seam isn't down the middle)
    lat = np.arcsin(np.clip(ry, -1, 1))
    # the photo spans 180 degrees across; the other half is it mirrored
    t = (lon / math.pi) % 2.0; t = np.where(t > 1, 2 - t, t)            # 0..1..0
    u = (0.5 + (t - 0.5) * 0.98) * (W - 1)
    e = (np.abs(lat) / (math.pi / 2)) ** 0.8
    v = np.where(lat >= 0, yh - e * yh * 0.98, yh + e * (H - yh) * 0.98)
    col = bilinear(P, u, v)
    # what reads as chrome is contrast: below the horizon the sphere sees the ground under it, darker toward the nadir
    # (a slate grey); above, the sky deepens toward the zenith
    below = np.clip(-lat / (math.pi / 2) * 1.7, 0, 0.78)[..., None]
    col = col * (1 - below) + np.array([0.30, 0.33, 0.38], np.float32) * below
    above = np.clip(lat / (math.pi / 2), 0, 1)[..., None] ** 1.5
    col = col * (1 - 0.35 * above) + np.array([0.10, 0.28, 0.62], np.float32) * 0.35 * above
    # chrome: a little less than a perfect mirror, a touch cool; brighter toward the rim (Fresnel), a soft dark rim line
    fres = 0.86 + 0.14 * (1 - z) ** 4
    col = col * fres[..., None] * np.array([0.97, 0.98, 1.0], np.float32)
    rim = np.clip((np.sqrt(rr) - 0.965) / 0.035, 0, 1)
    col = col * (1 - 0.35 * rim[..., None])
    # one small glint where the sun (high, to the left behind the camera) would sit
    gx, gy = -0.38, 0.52; g = np.exp(-(((x - gx) ** 2 + (y - gy) ** 2) / 0.0035)); col = col + g[..., None] * 0.55
    a = inside.astype(np.float32)
    rgba = np.concatenate([np.clip(col, 0, 1), a[..., None]], -1)
    im = Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').resize((2 * R, 2 * R), Image.LANCZOS)
    return im

def home():
    ph = load('su-flat.jpg'); W, H = ph.size; hz = 0.538
    R = round(0.115 * H); cx, cy = round(0.885 * W), round(0.30 * H)       # (at the right edge: kept clear of the page column)
    s = sphere(ph, hz, R)
    out = ph.convert('RGBA')
    # its reflection: mirrored about where it would stand on the water (below the horizon, nearer than it), softened and
    # dimmed as the flood's mirror is; a faint ring of disturbed water where the reflection meets
    yg = round(0.585 * H); ry = 2 * yg - cy
    refl = s.transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(1.6))
    ra = np.asarray(refl).astype(np.float32); ra[..., :3] *= 0.86; ra[..., 3] *= 0.82
    out.alpha_composite(Image.fromarray(ra.astype(np.uint8), 'RGBA'), (cx - R, ry - R))
    # a whisper of shadow under it on the water's far sheen (the light is high: small and very soft)
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).ellipse((cx - R * .9, yg - R * .08, cx + R * .9, yg + R * .08), fill=60)
    sh = sh.filter(ImageFilter.GaussianBlur(R * .18))
    dark = Image.new('RGBA', (W, H), (40, 50, 70, 0)); dark.putalpha(sh)
    out.alpha_composite(dark)
    out.alpha_composite(s, (cx - R, cy - R))
    save(out.convert('RGB'), 'home', 0.84)

# ── plan: mirrors on the salt ──
def mirror(tex, quad_h, lean=0.0, edge='l'):
    """a mirror pane (tex, RGB) standing upright: returns an RGBA image of a flat rectangle seen slightly turned"""
    w0, h0 = tex.size
    out = tex.convert('RGBA')
    d = ImageDraw.Draw(out)
    # a thin bright edge on its lit side, a darker one opposite (the pane's thickness)
    if edge == 'l': d.rectangle((0, 0, max(2, w0 // 90), h0), fill=(250, 246, 255, 255)); d.rectangle((w0 - max(2, w0 // 140), 0, w0, h0), fill=(120, 120, 150, 255))
    else: d.rectangle((w0 - max(2, w0 // 90), 0, w0, h0), fill=(250, 246, 255, 255)); d.rectangle((0, 0, max(2, w0 // 140), h0), fill=(120, 120, 150, 255))
    return out

def plan():
    ph = load('su-crust.jpg'); W, H = ph.size; hz = 0.584
    flat = load('su-flat.jpg')
    out = ph.convert('RGBA')
    # what each mirror shows: a piece of a cloudier sky (the Bonneville clouds), graded to this dawn: lilac and rose
    def sky(box, tint, k):
        t = flat.crop(box)
        a = np.asarray(t, np.float32) / 255
        g = a.mean(-1, keepdims=True)
        tinted = (g * np.array(tint, np.float32)) * k + a * (1 - k)
        return Image.fromarray((np.clip(tinted, 0, 1) * 255).astype(np.uint8))
    panes = [
        # (left x, bottom y, width, height as fractions of W/H, the sky's crop in the Bonneville photo, its tint, which edge is lit, top tilt px)
        (0.075, 0.905, 0.105, 0.30, (60, 20, 340, 520), (1.12, 0.78, 0.86), 'r', 10),
        (0.285, 0.712, 0.033, 0.084, (900, 120, 1060, 480), (0.92, 0.96, 1.06), 'r', 2),
        (0.615, 0.765, 0.052, 0.13, (1380, 60, 1600, 480), (1.12, 0.80, 0.88), 'l', -4),
        (0.735, 0.935, 0.125, 0.355, (520, 0, 840, 520), (0.92, 0.95, 1.08), 'l', -14)
    ]
    for (lx, by, fw, fh, box, tint, edge, tilt) in panes:
        pw, phh = round(fw * W), round(fh * H)
        tex = sky(box, tint, 0.72).resize((pw, phh), Image.LANCZOS)
        pane = mirror(tex, phh, edge=edge)
        x0, y1 = round(lx * W), round(by * H); y0 = y1 - phh
        # turned a little: one vertical edge shorter (the far one), the top and bottom edges tilt toward it
        quad_dst = [(x0, y0 + max(0, tilt)), (x0, y1), (x0 + pw, y1 - tilt * .35), (x0 + pw, y0 + max(0, -tilt))]
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        bb = tuple(int(round(f(p[i] for p in quad_dst))) for f, i in ((min, 0), (min, 1), (max, 0), (max, 1)))
        bw, bh = bb[2] - bb[0], bb[3] - bb[1]
        # the pane's picture stretched to the turned outline's box and cut to it (the turn is small, so no true perspective)
        warped = pane.resize((bw, bh), Image.LANCZOS)
        mask = Image.new('L', (bw, bh), 0)
        ImageDraw.Draw(mask).polygon([(p[0] - bb[0], p[1] - bb[1]) for p in quad_dst], fill=255)
        warped.putalpha(mask)
        # its contact with the ground: a soft shadow just behind and to the side (light low in the east, behind the viewer)
        sh = Image.new('L', (W, H), 0)
        ImageDraw.Draw(sh).polygon([(x0 - pw * .02, y1 - 2), (x0 + pw * 1.02, y1 - tilt * .35 - 2), (x0 + pw * 1.25, y1 - tilt * .35 - phh * .05), (x0 + pw * .2, y1 - phh * .05)], fill=110)
        sh = sh.filter(ImageFilter.GaussianBlur(max(2, pw * .03)))
        shade = Image.new('RGBA', (W, H), (70, 70, 110, 0)); shade.putalpha(sh)
        out.alpha_composite(shade)
        layer.alpha_composite(warped, (bb[0], bb[1]))
        out.alpha_composite(layer)
    save(out.convert('RGB'), 'plan', 0.79)

# ── mist: a disc of the mountain, lifted ──
def mist():
    ph = load('su-mist.jpg'); W, H = ph.size
    cx, cy, R = round(0.81 * W), round(0.43 * H), round(0.27 * H)       # (to the right, clear of the page column)
    dy = round(0.20 * H); dx = round(-0.035 * W)
    shifted = Image.new('RGB', (W, H)); shifted.paste(ph, (dx, -dy))
    # (below the shifted copy's foot: the same photo again, so the disc never shows an empty band)
    shifted.paste(ph.crop((0, H - dy - 1, W, H)), (dx, H - dy - 1))
    m = Image.new('L', (W * 3, H * 3), 0); ImageDraw.Draw(m).ellipse(((cx - R) * 3, (cy - R) * 3, (cx + R) * 3, (cy + R) * 3), fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    out = Image.composite(shifted, ph, m)
    # the disc's lower lip: a faint shade inside its rim, as if it had a little depth
    rim = Image.new('L', (W * 2, H * 2), 0)
    ImageDraw.Draw(rim).arc(((cx - R) * 2, (cy - R) * 2, (cx + R) * 2, (cy + R) * 2), 20, 160, fill=90, width=10)
    rim = rim.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3))
    out = Image.composite(Image.new('RGB', (W, H), (20, 26, 22)), out, rim.point(lambda v: v * 0.6))
    save(out, 'mist', 0.78)

def dunes():
    ph = load('su-dunes.jpg')
    save(ph, 'tt', 0.55)

if __name__ == '__main__':
    for f in sys.argv[3:] or ['home', 'plan', 'mist', 'dunes']: globals()[f]()
