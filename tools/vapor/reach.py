# How far each group's own thing reaches from its foot, measured from the pictures in images/th and written into fx/vapor.js (META):
#   sl, sr   to the left and right of its foot (ax), in the plate's pixels
#   st       above its foot (ay)
# The thing itself, not its shadow: where the picture is more than about six tenths opaque. fx/vapor.js uses these to draw a group
# small enough to stand whole in a laptop's narrow margin. pack.py writes the same numbers for a fresh render; this is for the
# pictures already shipped.
# usage: python -P tools/vapor/reach.py
import json, os, re
import numpy as np
from PIL import Image
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def reach(im, m):
    al = np.asarray(im.convert('RGBA'))[..., 3]; cols = np.where((al > 150).sum(0) > 3)[0]; rows = np.where((al > 150).sum(1) > 3)[0]
    if not len(cols) or not len(rows): return {}
    return {'sl': int(m['ax'] - (m['x'] + cols.min())), 'sr': int(m['x'] + cols.max() - m['ax']), 'st': int(m['ay'] - (m['y'] + rows.min()))}
p = os.path.join(REPO, 'fx', 'vapor.js'); b = open(p, 'rb').read().decode('utf-8')
mm = re.search(r'const META = /\*META\*/(\{.*?\});', b, re.S); assert mm, 'META not found in fx/vapor.js'
meta = json.loads(mm.group(1)); n = 0
for sc in meta:
    for mode in meta[sc]:
        for part, m in meta[sc][mode].items():
            f = os.path.join(REPO, 'images', 'th', 'vw-%s-%s-%s.webp' % (sc, part, mode))
            if 'ax' not in m or not os.path.exists(f): continue
            r = reach(Image.open(f), m); m.update(r); n += 1 if r else 0
            print('%-8s %-6s %s  %s' % (sc, part, mode, r))
out = json.dumps(meta, separators=(',', ':'))
b2 = b[:mm.start(1)] + out + b[mm.end(1):]
open(p, 'wb').write(b2.encode('utf-8')); print(n, 'pieces measured; META', len(out), 'chars')
