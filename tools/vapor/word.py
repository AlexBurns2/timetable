# The page's word, set vertically in big iridescent type, for the margin opposite the scene (the timetable's is 時間割).
# The fill is a photograph of a real soap film (thin-film interference), its colours moved onto the theme's pastels (cyan, periwinkle,
# lilac, pink, white) so the swirls stay the photograph's own. Then a soft bevel, a pale inner line, a deep violet outline, and two
# or three rows of the type slipped sideways, as a bad copy would. Still, never animated.
# usage: python -P tools/vapor/word.py <film.jpg> <out.png> <text> [glyph px] [seed] [font file]
import sys, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
a = sys.argv[1:]
film, dst, text = a[0], a[1], a[2]
G = int(a[3]) if len(a) > 3 else 480; rng = np.random.default_rng(int(a[4]) if len(a) > 4 else 5)
FONT = a[5] if len(a) > 5 else 'C:/Windows/Fonts/YuGothB.ttc'
font = ImageFont.truetype(FONT, G)
O, IN, PAD, BOLD = int(G * .07), int(G * .02), int(G * .22), int(G * .01)   # outline, inner line, room for the glow and the slips, weight added

# the glyphs, one under another, each centred in its cell
cell = int(G * 1.02); Wd = G + 2 * PAD; Hd = cell * len(text) - (cell - G) + 2 * PAD
mask = Image.new('L', (Wd, Hd), 0); d = ImageDraw.Draw(mask)
for i, ch in enumerate(text):
    x0, y0, x1, y1 = font.getbbox(ch)
    d.text((PAD + (G - (x1 - x0)) / 2 - x0, PAD + i * cell + (G - (y1 - y0)) / 2 - y0), ch, font=font, fill=255)
m = np.asarray(mask).astype(np.float32) / 255

def grow(mm, r):                                                       # a round dilation, soft at the edge
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.GaussianBlur(cv2.dilate(mm, k), (0, 0), max(.8, r * .06))
m = np.clip((grow(m, BOLD) - .5) * 3 + .5, 0, 1)                          # heavier strokes than the font's bold, like a poster face

# the fill: the soap film, its hues moved onto the theme's colours, its light and dark kept
f = cv2.imread(film); fh, fw = f.shape[:2]; s = max(Wd / fw, Hd / fh) * 1.15
f = cv2.resize(f, (int(fw * s) + 1, int(fh * s) + 1), interpolation=cv2.INTER_AREA)
oy, ox = int(rng.integers(0, f.shape[0] - Hd + 1)), int(rng.integers(0, f.shape[1] - Wd + 1)); f = f[oy:oy + Hd, ox:ox + Wd]
hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV_FULL).astype(np.float32); hue = hsv[..., 0] / 256; val = hsv[..., 2] / 255
ring = np.array([[86, 226, 255], [96, 142, 255], [170, 132, 255], [255, 120, 206], [120, 238, 255]], np.float32) / 255
t = (hue * len(ring)) % len(ring); i0 = np.floor(t).astype(int); k = (t - i0)[..., None]; i1 = (i0 + 1) % len(ring)
col = ring[i0] * (1 - k) + ring[i1] * k
col = col * (.7 + .3 * val[..., None])                                  # the film's own light and shade
sat = hsv[..., 1] / 255; spec = np.clip((val - .55) / .45, 0, 1) * np.clip(1 - sat * 1.3, 0, 1)
col = col + (1 - col) * spec[..., None] * .8                              # where the film is pale, a white sheen

# a soft bevel from the distance to the edge: lit from the upper left, a glint along the top edges
dist = cv2.distanceTransform((m > .5).astype(np.uint8), cv2.DIST_L2, 5); bw = G * .03
hgt = np.clip(dist / bw, 0, 1); hgt = hgt * hgt * (3 - 2 * hgt); hgt = cv2.GaussianBlur(hgt, (0, 0), G * .006)
gy, gx = np.gradient(hgt); L = np.array([-.62, -.78]); sh = (gx * L[0] + gy * L[1]) * bw * 1.6
col = col + np.clip(sh, 0, 1)[..., None] * .4 - np.clip(-sh, 0, 1)[..., None] * .3
col = np.clip(col, 0, 1)

# the layers, back to front: a soft glow, the violet outline, the pale inner line, the fill
outl, inner = grow(m, O), grow(m, IN)
glow = cv2.GaussianBlur(outl, (0, 0), G * .06) * .5
img = np.zeros((Hd, Wd, 4), np.float32)
def over(rgb, al):
    global img
    al = al[..., None]; a0 = img[..., 3:4]; na = al + a0 * (1 - al)
    img[..., :3] = (np.asarray(rgb) * al + img[..., :3] * a0 * (1 - al)) / np.maximum(na, 1e-4); img[..., 3:4] = na
over(np.array([1, .86, .96], np.float32), glow)
over(np.array([43, 34, 96], np.float32) / 255, outl)
over(np.array([232, 250, 255], np.float32) / 255, inner)
over(col, m)

# the slips: a few rows of the type moved sideways; one of them doubled, its colours parted
def slide(arr, dx):
    o = np.zeros_like(arr)
    if dx >= 0: o[:, dx:] = arr[:, :Wd - dx]
    else: o[:, :Wd + dx] = arr[:, -dx:]
    return o
rows = sorted(rng.choice(np.arange(PAD + G // 3, Hd - PAD - G // 3), 3, replace=False))
for j, y in enumerate(rows):
    h = int(rng.integers(G * .03, G * .1)); dx = int(rng.choice([-1, 1]) * rng.integers(G * .05, G * .13)); band = img[y:y + h].copy()
    img[y:y + h] = slide(band, dx)
    if j == 1:                                                         # the doubled one: a pink and a cyan ghost either side
        for c, ddx in ((np.array([1, .45, .8]), dx - int(G * .035)), (np.array([.4, .95, 1]), dx + int(G * .035))):
            gh = slide(band, ddx); al = gh[..., 3] * .45; seg = img[y:y + h]
            a0 = seg[..., 3:4]; na = al[..., None] + a0 * (1 - al[..., None])
            seg[..., :3] = (c * al[..., None] + seg[..., :3] * a0 * (1 - al[..., None])) / np.maximum(na, 1e-4); seg[..., 3:4] = na

ys, xs = np.where(img[..., 3] > .01); img = img[max(0, ys.min() - 2):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3]
Image.fromarray((np.clip(img, 0, 1) * 255 + .5).astype(np.uint8)).save(dst); print(dst, img.shape[1], 'x', img.shape[0])
