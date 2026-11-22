# Poly Haven's marble_01 is a photograph of a wall of marble blocks: laid on a column, its joints drew a grid up the shaft and each
# block's own tone made a patchwork. This makes one unbroken marble from it: patches taken from inside the blocks (never across a
# joint), each brought to the same tone, laid over one another with soft edges until the square is covered, and wrapped at its
# edges so it repeats without a seam. The same patches, in the same places, for the colour, the roughness and the normals.
# usage: python -P tools/vapor/marble.py <work>/ph-dl/marble_01      (writes marble_01_solid_diff.jpg, _rough.jpg, _nor.jpg beside the 2k files)
import sys, os, numpy as np, cv2
D = sys.argv[1]; OUT = 1536; rng = np.random.default_rng(7)
rd = lambda n: cv2.imread(os.path.join(D, 'marble_01_%s_2k.jpg' % n)).astype(np.float32)
diff, rough, nor = rd('diff'), rd('rough'), rd('nor_gl'); S = diff.shape[0]

# the joints: thin dark lines, right across for the courses, and within each course between its blocks
g = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY); dark = cv2.GaussianBlur(g, (0, 0), 6) - g
def peaks(p, thr, gap=40):
    idx = [i for i in range(len(p)) if p[i] > thr and p[i] == p[max(0, i - gap):i + gap].max()]
    return [i for k, i in enumerate(idx) if not k or i - idx[k - 1] > gap]
rows = peaks(dark.mean(1), 2.2)
rows = rows if rows and rows[0] < 30 else [0] + rows                      # (the picture wraps: its top edge is a joint too)
blocks = []
for a, b in zip(rows, rows[1:] + [S]):
    if b - a < 200: continue
    cols = peaks(dark[a + 20:b - 20].mean(0), 2.2)
    for c, d in zip(cols, cols[1:]):
        if d - c >= 300: blocks.append((c + 16, a + 16, d - 16, b - 16))  # a block's inside, clear of its joints
print(len(blocks), 'blocks:', blocks)
assert len(blocks) >= 6, 'the joints were not found'
mean = np.mean([diff[y0:y1, x0:x1].reshape(-1, 3).mean(0) for x0, y0, x1, y1 in blocks], 0)
rmean = np.mean([rough[y0:y1, x0:x1].mean() for x0, y0, x1, y1 in blocks])

acc = [np.zeros((OUT, OUT, 3), np.float32) for _ in range(3)]; wsum = np.zeros((OUT, OUT, 1), np.float32)
def lay(px, py, ps):
    x0, y0, x1, y1 = blocks[rng.integers(len(blocks))]; ps = int(min(ps, x1 - x0, y1 - y0))
    sx, sy = int(rng.integers(x0, x1 - ps + 1)), int(rng.integers(y0, y1 - ps + 1))
    t = np.linspace(-1, 1, ps, dtype=np.float32); w1 = np.clip(1 - np.abs(t), 0, 1); w1 = w1 * w1 * (3 - 2 * w1)
    m = (np.outer(w1, w1) ** 3 + 1e-6)[..., None]                          # a soft-edged patch; cubed, so the strongest one mostly wins and the veins stay crisp
    bx0, by0, bx1, by1 = [b for b in blocks if b[0] <= sx < b[2] and b[1] <= sy < b[3]][0]
    tone = mean - diff[by0:by1, bx0:bx1].reshape(-1, 3).mean(0); rt = rmean - rough[by0:by1, bx0:bx1].mean()
    ys = (py + np.arange(ps)) % OUT; xs = (px + np.arange(ps)) % OUT; ix = np.ix_(ys, xs)
    acc[0][ix] += (diff[sy:sy + ps, sx:sx + ps] + tone) * m; acc[1][ix] += (rough[sy:sy + ps, sx:sx + ps] + rt) * m; acc[2][ix] += nor[sy:sy + ps, sx:sx + ps] * m; wsum[ix] += m
for py in range(0, OUT, 150):                                              # a grid first, so nowhere is left bare, then more at random
    for px in range(0, OUT, 150): lay(px + int(rng.integers(-40, 40)), py + int(rng.integers(-40, 40)), 400)
for _ in range(260): lay(int(rng.integers(OUT)), int(rng.integers(OUT)), int(rng.integers(260, 430)))
d, r, n = [a / wsum for a in acc]
v = n / 127.5 - 1; v /= np.maximum(np.linalg.norm(v, axis=2, keepdims=True), 1e-4); n = (v + 1) * 127.5      # normals: unit length again after the blend
for name, im in (('diff', d), ('rough', r), ('nor', n)):
    p = os.path.join(D, 'marble_01_solid_%s.jpg' % name); cv2.imwrite(p, np.clip(im, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 93]); print(p)
