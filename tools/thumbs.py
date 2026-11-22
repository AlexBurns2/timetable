# The pictures on the Theme finder's tiles: a real corner of each theme's Home page (its heading, a little of what is behind it).
# Take a 1280 x 720 screenshot of home.html in each theme, signed in as the demo student (no real names), light mode unless the
# theme is dark only, named tf-<theme id>.jpg (or .png); for Vaporwave also one as a non-moderator, tf-vapor-old. Then:
#   python -P tools/thumbs.py <folder of screenshots> images/tf
# Each becomes images/tf/<id>.webp, 240 x 92 (twice the tile). theme.js lists the ids that have one (SHOTS); the cities keep
# their photographs and Custom its drawing.
import sys, glob, os
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
CROP = {'studio': (36, 178, 596, 393)}                        # Studio's Home is the timetable: its days and first lessons, not its bare top corner
for f in sorted(glob.glob(os.path.join(src, 'tf-*.*'))):
    n = os.path.splitext(os.path.basename(f))[0][3:]
    if n.endswith('-f0') or '-j' in n: continue
    im = Image.open(f).convert('RGB')
    if im.size != (1280, 720): print('skipped (not 1280 x 720):', f); continue
    c = im.crop(CROP.get(n, (60, 4, 620, 219))).resize((240, 92), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=.6, percent=60, threshold=0))
    c.save(os.path.join(dst, n + '.webp'), quality=84, method=6)
print(len(glob.glob(os.path.join(dst, '*.webp'))), 'pictures in', dst)
