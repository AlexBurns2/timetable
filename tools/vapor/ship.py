# Copy <work>/final/vw-*.webp into images/th, and write <work>/final/meta.js into fx/vapor.js (the META table).
# usage: python -P tools/vapor/ship.py --work <folder>
import argparse, glob, os, re, shutil
ap = argparse.ArgumentParser(); ap.add_argument('--work', default=os.environ.get('VW_WORK', '')); a = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FIN = os.path.join(a.work, 'final')
meta = open(os.path.join(FIN, 'meta.js')).read()
p = os.path.join(REPO, 'fx', 'vapor.js'); b = open(p, 'rb').read().decode('utf-8')
b2, n = re.subn(r'const META = /\*META\*/\{.*?\};', lambda m: 'const META = /*META*/' + meta + ';', b, count=1, flags=re.S)
assert n == 1, 'META not found in fx/vapor.js'
open(p, 'wb').write(b2.encode('utf-8'))
tot = 0
for f in sorted(glob.glob(os.path.join(FIN, 'vw-*.webp'))): shutil.copy2(f, os.path.join(REPO, 'images', 'th', os.path.basename(f))); tot += os.path.getsize(f)
print('copied into images/th:', tot // 1024, 'KB; META', len(meta), 'chars')
