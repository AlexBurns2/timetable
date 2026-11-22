# The Notes page's picture: a photograph of a head (CMA 2023.108, CC0) in a paint program's window of our own drawing,
# duotone, one glitch slice, faint scanlines; over a crop of the sky photograph. usage: paint.py <head.png> <sky.jpg> <out.webp> l|d
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
Image.MAX_IMAGE_PIXELS = None
head_p, sky_p, out_p, mode = sys.argv[1:5]
W, H = 760, 640
GREY, WHITE, DK, MID, LT = (198, 198, 198), (255, 255, 255), (11, 11, 11), (134, 134, 134), (223, 223, 223)
im = Image.new('RGB', (W, H), GREY); d = ImageDraw.Draw(im)
def bevel(x0, y0, x1, y1, raised=True, face=None):
    a, b, c, e = (LT, DK, WHITE, MID) if raised else (MID, WHITE, DK, LT)
    d.rectangle((x0, y0, x1, y1), fill=b); d.rectangle((x0, y0, x1 - 1, y1 - 1), fill=a)
    d.rectangle((x0 + 1, y0 + 1, x1 - 1, y1 - 1), fill=e); d.rectangle((x0 + 1, y0 + 1, x1 - 2, y1 - 2), fill=c)
    if face: d.rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), fill=face)
try: F = ImageFont.truetype('tahoma.ttf', 15); FB = ImageFont.truetype('tahomabd.ttf', 15); FS = ImageFont.truetype('tahoma.ttf', 13)
except OSError: F = FB = FS = ImageFont.load_default()
bevel(0, 0, W - 1, H - 1, True, GREY)
# the title bar
tb = Image.new('RGB', (W - 8, 24)); td = ImageDraw.Draw(tb)
for x in range(W - 8):
    k = x / (W - 9); td.line((x, 0, x, 23), fill=tuple(int(a + (b - a) * k) for a, b in zip((124, 223, 246), (205, 166, 242))))
im.paste(tb, (4, 4)); d.text((30, 8), 'apollo.bmp', font=FB, fill=WHITE)
# a little paint-brush icon of our own at the left of the title
for (x, y, c) in [(10, 18, (120, 80, 40)), (11, 17, (120, 80, 40)), (12, 16, (120, 80, 40)), (13, 15, (240, 120, 180)), (14, 14, (240, 120, 180)), (15, 13, (240, 120, 180)), (16, 12, (240, 120, 180)), (17, 11, (240, 120, 180)), (18, 10, (30, 30, 30))]:
    d.rectangle((x, y, x + 1, y + 1), fill=c)
for i, kind in enumerate(('x', 'max', 'min')):
    bx = W - 26 - i * 20 - (2 if i else 0); bevel(bx, 7, bx + 17, 22, True, GREY)
    if kind == 'x': d.line((bx + 5, 10, bx + 12, 18), fill=DK, width=2); d.line((bx + 12, 10, bx + 5, 18), fill=DK, width=2)
    elif kind == 'max': d.rectangle((bx + 4, 10, bx + 13, 18), outline=DK); d.line((bx + 4, 11, bx + 13, 11), fill=DK)
    else: d.line((bx + 5, 17, bx + 11, 17), fill=DK, width=2)
# the menu bar
x = 10
for m in ('File', 'Edit', 'View', 'Image', 'Colors', 'Help'): d.text((x, 33), m, font=F, fill=DK); x += int(d.textlength(m, font=F)) + 16
# the tools: two columns of buttons, each with a small glyph
TX, TY = 8, 58
glyph = [lambda x, y: d.rectangle((x + 6, y + 6, x + 18, y + 18), outline=DK),
         lambda x, y: d.ellipse((x + 5, y + 7, x + 19, y + 17), outline=DK),
         lambda x, y: d.line((x + 6, y + 18, x + 18, y + 6), fill=DK, width=2),
         lambda x, y: d.polygon([(x + 6, y + 18), (x + 9, y + 18), (x + 19, y + 8), (x + 16, y + 5)], outline=DK),
         lambda x, y: (d.polygon([(x + 6, y + 12), (x + 12, y + 6), (x + 18, y + 12), (x + 12, y + 18)], outline=DK), d.rectangle((x + 16, y + 15, x + 19, y + 19), fill=(240, 120, 180))),
         lambda x, y: d.text((x + 7, y + 3), 'A', font=FB, fill=DK),
         lambda x, y: d.rectangle((x + 6, y + 9, x + 18, y + 16), fill=(255, 190, 220), outline=DK),
         lambda x, y: [d.point((x + 6 + i * 3, y + 6 + (i * 5) % 12), fill=DK) for i in range(5)],
         lambda x, y: d.rectangle((x + 6, y + 6, x + 18, y + 18), outline=DK, fill=(190, 230, 240)),
         lambda x, y: d.line((x + 6, y + 6, x + 18, y + 18), fill=DK, width=1),
         lambda x, y: d.arc((x + 4, y + 4, x + 20, y + 20), 200, 340, fill=DK, width=2),
         lambda x, y: d.rectangle((x + 8, y + 8, x + 16, y + 16), outline=DK)]
for i in range(12):
    bx, by = TX + (i % 2) * 26, TY + (i // 2) * 26; bevel(bx, by, bx + 25, by + 25, i != 3, GREY if i != 3 else (214, 214, 214)); glyph[i](bx, by)
bevel(TX, TY + 6 * 26 + 6, TX + 51, TY + 6 * 26 + 66, False, GREY)
# the picture: the sky photograph and the head, duotone; one slice slipped sideways; scanlines
CX0, CY0, CX1, CY1 = 72, 58, W - 30, H - 104
bevel(CX0 - 2, CY0 - 2, CX1 + 20, CY1 + 20, False, (128, 128, 128))
pw, ph = CX1 - CX0, CY1 - CY0
sky = Image.open(sky_p).convert('RGB'); sky = sky.crop((2600, 1150, 2600 + 1400, 1150 + int(1400 * ph / pw))).resize((pw, ph), Image.LANCZOS)
pic = sky.convert('RGBA')
hd = Image.open(head_p).convert('RGBA'); hh = int(ph * 1.02); hd = hd.resize((int(hd.width * hh / hd.height), hh), Image.LANCZOS)
pic.alpha_composite(hd, (int(pw * .5 - hd.width * .5), int(ph - hh * .93)))
a = np.asarray(pic.convert('RGB')).astype(np.float32) / 255; L = a @ np.array([.2126, .7152, .0722], np.float32)
lo, hi = (np.array([.36, .2, .58]), np.array([1, .86, .96])) if mode == 'l' else (np.array([.15, .09, .3]), np.array([.86, .66, .9]))
L = np.clip((L - .08) / .86, 0, 1) ** 1.1; duo = lo + (hi - lo) * L[..., None]
y0, y1 = int(ph * .56), int(ph * .635)
duo[y0:y1] = np.roll(duo[y0:y1], int(pw * .045), axis=1)
duo[y0:y0 + 3] = duo[y0:y0 + 3] * .3 + np.array([.45, .95, .9]) * .7; duo[y1 - 2:y1] = duo[y1 - 2:y1] * .5 + np.array([.45, .95, .9]) * .5
duo[::3] *= .93
im.paste(Image.fromarray((np.clip(duo, 0, 1) * 255).astype(np.uint8)), (CX0, CY0))
# the scroll bars
bevel(CX1 + 1, CY0, CX1 + 18, CY1, False, (214, 214, 214)); bevel(CX1 + 1, CY0, CX1 + 18, CY0 + 17, True, GREY); bevel(CX1 + 1, CY1 - 17, CX1 + 18, CY1, True, GREY); bevel(CX1 + 1, CY0 + 40, CX1 + 18, CY0 + 120, True, GREY)
bevel(CX0, CY1 + 1, CX1, CY1 + 18, False, (214, 214, 214)); bevel(CX0, CY1 + 1, CX0 + 17, CY1 + 18, True, GREY); bevel(CX1 - 17, CY1 + 1, CX1, CY1 + 18, True, GREY); bevel(CX0 + 60, CY1 + 1, CX0 + 220, CY1 + 18, True, GREY)
# the colours
PAL = ['#1b1430', '#ffffff', '#5a3a8e', '#ffd6f2', '#8a6ad6', '#ffb3d9', '#b9a4f2', '#ff8fc8', '#7fdff6', '#ffe9a8', '#a8e4ea', '#cda6f2', '#f6b4de', '#9ad8c4',
       '#3a2a5a', '#e6e0f0', '#7a5ab0', '#ffc0e0', '#6a5ab8', '#ff9ad0', '#c9b8f6', '#ffb0d8', '#9ae8f6', '#fff1c4', '#c4eef2', '#e0c6f8', '#f8cce6', '#bfe8d8']
PY = H - 78; bevel(10, PY, 48, PY + 36, False, WHITE); d.rectangle((16, PY + 6, 30, PY + 20), fill='#5a3a8e'); d.rectangle((26, PY + 16, 40, PY + 30), fill='#ffd6f2', outline=DK)
for i, c in enumerate(PAL):
    x0, y0 = 56 + (i % 14) * 20, PY + (i // 14) * 18; bevel(x0, y0, x0 + 18, y0 + 17, False, c)
# the status line
bevel(4, H - 30, W - 5, H - 5, False, GREY); d.text((12, H - 26), 'Read-only', font=FS, fill=DK); d.text((W - 90, H - 26), '1 : 1', font=FS, fill=DK)
im.save(out_p, quality=90, method=6); print(out_p, im.size)
