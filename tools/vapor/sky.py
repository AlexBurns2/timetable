# Pastel sky band from the 8k equirect photo (Poly Haven kloofendal_48d_partly_cloudy_puresky, CC0): seamless horizontally.
import sys, numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
src, outdir = sys.argv[1], sys.argv[2]
OW, OH = int(sys.argv[3]) if len(sys.argv) > 3 else 3600, int(sys.argv[4]) if len(sys.argv) > 4 else 440
im = Image.open(src).convert('RGB')
band = im.crop((0, 960, 8192, 2050))                                   # from high cloud down to the horizon
# resize seamlessly: tile three across, resize, keep the middle
t = Image.new('RGB', (band.width * 3, band.height)); [t.paste(band, (band.width * k, 0)) for k in range(3)]
t = t.resize((OW * 3, OH), Image.LANCZOS).crop((OW, 0, OW * 2, OH))
a = np.asarray(t).astype(np.float32) / 255
mx, mn = a.max(2), a.min(2); S = np.where(mx > 1e-3, (mx - mn) / np.maximum(mx, 1e-3), 0); L = a @ np.array([.2126, .7152, .0722], np.float32)
skyS = np.percentile(S, 88, axis=1, keepdims=True)
m = np.clip((skyS * .92 - S) / np.maximum(skyS * .75, 1e-3), 0, 1)        # clouds: where the blue drains out
m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
Lr = (L - np.percentile(L, 5)) / (np.percentile(L, 99.5) - np.percentile(L, 5)); Lr = np.clip(Lr, 0, 1)
y = np.linspace(0, 1, OH, dtype=np.float32)[:, None]
def grad(stops):
    xs = [s[0] for s in stops]; cs = np.array([[int(s[1][i:i + 2], 16) / 255 for i in (1, 3, 5)] for s in stops], np.float32)
    return np.stack([np.interp(y[:, 0], xs, cs[:, k]) for k in range(3)], 1)[:, None, :]
def hexc(h): return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
for name, sky, hi, lo, horizon, hz in (
    ('l', [(0, '#80d9f5'), (.42, '#a9cbf7'), (.74, '#d2baf2'), (1, '#ffc2dd')], '#fffafd', '#d7c6f0', '#ffd6e8', '#ffc2dd'),
    ('d', [(0, '#26425c'), (.42, '#46528a'), (.76, '#8a78ad'), (1, '#d9a0bd')], '#f0c2d8', '#5a5a90', '#e8aac8', '#d9a0bd')):
    base = np.broadcast_to(grad(sky), a.shape)
    shade = hexc(lo) + (hexc(hi) - hexc(lo)) * (Lr[..., None] ** .8)
    shade = shade * (1 - y[..., None] * .5) + (hexc(horizon) * (.55 + .45 * Lr[..., None])) * (y[..., None] * .5)     # cloud low down take the horizon's colour
    out = base * (1 - m[..., None] * .92) + shade * (m[..., None] * .92)
    k = np.clip((y - .9) / .1, 0, 1)[..., None]; out = out * (1 - k) + hexc(hz) * k                                       # the last tenth: haze
    Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)).save(f'{outdir}/vw-sky-{name}.webp', quality=82, method=6)
    print(name, 'done')
