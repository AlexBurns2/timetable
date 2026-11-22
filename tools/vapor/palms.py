# Palm trees for the Vaporwave sky: a photograph of palms against the sky, reduced to the palms' silhouette (white, the shape in
# the alpha), which the page tints pale. The shape is the photograph's own: every frond is a real frond.
# usage: python -P tools/vapor/palms.py <photo> <out.png> <dark|blue> <x0 y0 x1 y1> <height> [threshold]
#   dark: palms dark against a sunset sky (anything darker than the threshold, 0..255 luminance, is palm)
#   blue: lit palms against a clear blue sky (anything not sky blue is palm)
#   x0 y0 x1 y1: the part of the photograph to keep, as fractions of its width and height (the palms, not the ground)
import sys, numpy as np, cv2
a = sys.argv[1:]
src, dst, how = a[0], a[1], a[2]; box = [float(v) for v in a[3:7]]; OH = int(a[7]); th = float(a[8]) if len(a) > 8 else 40
im = cv2.imread(src).astype(np.float32); H, W = im.shape[:2]
x0, y0, x1, y1 = int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H); im = im[y0:y1, x0:x1]
b, g, r = im[..., 0], im[..., 1], im[..., 2]; L = .0722 * b + .7152 * g + .2126 * r
if how == 'dark':
    m = np.clip((th + 12 - L) / 24, 0, 1)                     # a soft step either side of the threshold keeps the fronds' edges
else:
    sky = np.clip(((b - r) - 28) / 30, 0, 1) * np.clip((b - 90) / 40, 0, 1)
    m = 1 - sky
m = cv2.morphologyEx((m * 255).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# only what is joined to the bottom edge (the trunks rise from below): no specks of cloud or noise
n, lb = cv2.connectedComponents((m > 100).astype(np.uint8))
keep = set(np.unique(lb[-3:][lb[-3:] > 0]))
m = np.where(np.isin(lb, list(keep)) | (m <= 100), m, 0).astype(np.uint8)
m = np.where(cv2.dilate(np.isin(lb, list(keep)).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0, m, 0).astype(np.uint8)
ys, xs = np.where(m > 10); m = m[max(0, ys.min() - 4):, max(0, xs.min() - 4):xs.max() + 5]
s = OH / m.shape[0]; m = cv2.resize(m, (max(1, int(m.shape[1] * s)), OH), interpolation=cv2.INTER_AREA)
out = np.dstack([np.full(m.shape, 255, np.uint8)] * 3 + [m])
cv2.imwrite(dst, out); print(dst, out.shape[1], 'x', out.shape[0])
