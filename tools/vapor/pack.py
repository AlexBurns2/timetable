# <work>/out/vw-*.png  ->  <work>/final/vw-*.webp, and <work>/final/meta.js (where each piece goes, for fx/vapor.js)
# usage: python -P tools/vapor/pack.py --work <folder>
import argparse, glob, json, os
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--work', default=os.environ.get('VW_WORK', '')); a = ap.parse_args()
OUT, FIN = os.path.join(a.work, 'out'), os.path.join(a.work, 'final'); os.makedirs(FIN, exist_ok=True)
Q = {'plate': 88, 'platew': 88, 'phone': 86}                                  # the rest (the groups, the floating things) at 90
def feather(im, m):
    # A group on its own is cut from the picture it was rendered in. Where its shadow (or the faint shade round it) ran out of that
    # picture's left or right side, it stopped at a straight edge; and the page stands the group wherever its margin is, so on a wide
    # screen that edge showed, as an upright line across the floor. Here the group's alpha fades to nothing towards such a side,
    # over as much room as there is between the side and the thing itself.
    a = np.asarray(im).astype(np.float32); al = a[..., 3]; w = a.shape[1]
    solid = np.where((al > 200).any(0))[0]
    if not len(solid): return im
    k = np.ones(w, np.float32); d = np.arange(w, dtype=np.float32)
    for touch, edge, dist, run in ((m['x'] <= 1, al[:, :3], solid.min(), d), (m['x'] + w >= m['W'] - 1, al[:, -3:], w - 1 - solid.max(), w - 1 - d)):
        if not touch or edge.max() < 4: continue
        F = max(24., min(280., dist - 14.)); t = np.clip(run / F, 0, 1); k *= t * t * (3 - 2 * t)
    a[..., 3] = al * k[None, :]
    return Image.fromarray((a + .5).astype(np.uint8), 'RGBA')

def reach(im, m):
    # How far the thing itself (not its shadow: where the picture is more than about six tenths opaque) reaches left and right of its
    # foot, and above it, in the plate's pixels. fx/vapor.js draws a group small enough to stand whole in a narrow margin by these.
    # (tools/vapor/reach.py measures the same from pictures already shipped.)
    al = np.asarray(im)[..., 3]; cols = np.where((al > 150).sum(0) > 3)[0]; rows = np.where((al > 150).sum(1) > 3)[0]
    if not len(cols) or not len(rows): return {}
    return {'sl': int(m['ax'] - (m['x'] + cols.min())), 'sr': int(m['x'] + cols.max() - m['ax']), 'st': int(m['ay'] - (m['y'] + rows.min()))}

meta = {}
for f in sorted(glob.glob(os.path.join(OUT, 'vw-*.png'))):
    n = os.path.basename(f)[:-4]; parts = n.split('-')            # vw-<scene>-<part>-<mode>
    if len(parts) != 4: continue
    _, sc, part, mode = parts
    j = os.path.join(OUT, n + '.json'); m = json.load(open(j)) if os.path.exists(j) else None
    im = Image.open(f).convert('RGBA')
    if m and 'x' in m and part not in Q: im = feather(im, m)
    im.save(os.path.join(FIN, n + '.webp'), quality=Q.get(part, 90), alpha_quality=88, method=6)
    if m:
        meta.setdefault(sc, {}).setdefault(mode, {})[part] = e = {k: m[k] for k in ('W', 'H', 'hy', 'x', 'y', 'w', 'h', 'ax', 'ay') if k in m}
        if 'ax' in m and 'x' in m: e.update(reach(im, m))
open(os.path.join(FIN, 'meta.js'), 'w').write(json.dumps(meta, separators=(',', ':')))
for f in sorted(glob.glob(os.path.join(FIN, 'vw-*.webp'))): print(f'{os.path.basename(f):32s} {os.path.getsize(f) // 1024:5d} KB')
