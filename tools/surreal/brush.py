"""The branch in the boat scene (Surrealism, the ship in the dunes), made ready to move in the wind (surreal.js sway()).

From the backdrop (images/surreal/wreck.webp), in the box BRUSH (photo px; keep in step with surreal.js BRUSH):
  wreck-brush.webp     the branch hanging in at the left and the bush along the crest behind it, cut out (RGBA). The sand
                       and its ripple shadows are blue-grey and the leaves and stems warmer, so warmth ((r + g) / 2 - b)
                       picks them out, with anything very dark (the stems); specks smaller than 40 px stay in the sand.
  wreck-brush-bg.webp  the same box with them painted out (OpenCV inpainting): it only ever shows in the slivers a moving
                       leaf uncovers, a pixel or two wide.

usage: python brush.py   (from the repo's root)"""
from PIL import Image
import numpy as np, cv2

X0, Y0, W, H = 0, 690, 280, 310
im = np.asarray(Image.open('images/surreal/wreck.webp').convert('RGB')).astype(np.float32)
reg = im[Y0:Y0 + H, X0:X0 + W]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
lum = reg.mean(-1)
warm = (r + g) / 2 - b
m = np.clip((warm + 15) / 6, 0, 1)
m = np.maximum(m, np.clip((18 - lum) / 10, 0, 1))
m = cv2.morphologyEx(m.astype(np.float32), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats((m > .3).astype(np.uint8), 8)
keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 40
m = m * keep[lab]
m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), .6)
hole = (cv2.dilate((m > .25).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0).astype(np.uint8)
plate = cv2.inpaint(reg.clip(0, 255).astype(np.uint8), hole, 6, cv2.INPAINT_TELEA)
rgba = np.dstack([reg.clip(0, 255).astype(np.uint8), (m * 255).clip(0, 255).astype(np.uint8)])
Image.fromarray(plate).save('images/surreal/wreck-brush-bg.webp', 'WEBP', quality=90)
Image.fromarray(rgba, 'RGBA').save('images/surreal/wreck-brush.webp', 'WEBP', quality=92)
print('kept', int(keep.sum()), 'pieces; coverage', round(float((m > .5).mean()), 3))
