# Grade a cut-out photo for the scene: light, a pastel daylight (lavender shade, warm white light); dark, dusk.
import sys, numpy as np
from PIL import Image
src, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
trim = float(sys.argv[4]) if len(sys.argv) > 4 else 0
im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(np.float32) / 255
if trim: a = a[:int(a.shape[0] * (1 - trim))]
rgb, al = a[..., :3], a[..., 3:]
L = (rgb @ np.array([.2126, .7152, .0722], np.float32))[..., None]
lo, hi = (np.array([.55, .52, .74]), np.array([1.0, .96, .97])) if mode == 'l' else (np.array([.22, .21, .38]), np.array([.9, .76, .86]))
ton = lo + (hi - lo) * np.clip((L - .12) / .8, 0, 1) ** .9
outc = ton * .72 + rgb * .28 if mode == 'l' else ton * .8 + rgb * .2 * .7
Image.fromarray((np.dstack([np.clip(outc, 0, 1), al]) * 255 + .5).astype(np.uint8)).save(out); print(out)
