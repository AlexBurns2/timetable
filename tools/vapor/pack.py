# <work>/out/vw-*.png  ->  <work>/final/vw-*.webp, and <work>/final/meta.js (where each piece goes, for fx/vapor.js)
# usage: python -P tools/vapor/pack.py --work <folder>
import argparse, glob, json, os
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--work', default=os.environ.get('VW_WORK', '')); a = ap.parse_args()
OUT, FIN = os.path.join(a.work, 'out'), os.path.join(a.work, 'final'); os.makedirs(FIN, exist_ok=True)
Q = {'plate': 88, 'platew': 88, 'phone': 86}                                  # the rest (the groups, the floating things) at 90
meta = {}
for f in sorted(glob.glob(os.path.join(OUT, 'vw-*.png'))):
    n = os.path.basename(f)[:-4]; parts = n.split('-')            # vw-<scene>-<part>-<mode>
    if len(parts) != 4: continue
    _, sc, part, mode = parts
    Image.open(f).convert('RGBA').save(os.path.join(FIN, n + '.webp'), quality=Q.get(part, 90), alpha_quality=88, method=6)
    j = os.path.join(OUT, n + '.json')
    if os.path.exists(j):
        m = json.load(open(j)); meta.setdefault(sc, {}).setdefault(mode, {})[part] = {k: m[k] for k in ('W', 'H', 'hy', 'x', 'y', 'w', 'h', 'ax', 'ay') if k in m}
open(os.path.join(FIN, 'meta.js'), 'w').write(json.dumps(meta, separators=(',', ':')))
for f in sorted(glob.glob(os.path.join(FIN, 'vw-*.webp'))): print(f'{os.path.basename(f):32s} {os.path.getsize(f) // 1024:5d} KB')
