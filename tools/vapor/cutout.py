# Cut a museum photo's subject off its studio background: colour distance from the background seeds GrabCut; edges feathered.
# usage: cutout.py in.jpg out.png [cropBottomFraction] [height] [floorShadowFrom: drop a dark shadow on the floor below this fraction of the height]
import sys, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]; cropb = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0; OH = int(sys.argv[4]) if len(sys.argv) > 4 else 1400
im = cv2.imread(src); H0, W0 = im.shape[:2]; im = im[:int(H0 * cropb)]
s = 1000 / im.shape[0]; sm = cv2.resize(im, (int(im.shape[1] * s), 1000), interpolation=cv2.INTER_AREA)
h, w = sm.shape[:2]
lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
# the background: a smooth gradient, modelled per row from the left and right borders
bl = lab[:, :20].mean(1); br = lab[:, -20:].mean(1); xs = np.linspace(0, 1, w)[None, :, None]
bg = bl[:, None, :] * (1 - xs) + br[:, None, :] * xs
d = np.sqrt(((lab - bg) ** 2).sum(2))
mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
mask[d > 18] = cv2.GC_PR_FGD; mask[d > 40] = cv2.GC_FGD; mask[d < 7] = cv2.GC_BGD
mask[:, :6] = mask[:, -6:] = cv2.GC_BGD; mask[:6] = cv2.GC_BGD
bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(sm, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
# keep the biggest piece, fill holes
n, lb, st, _ = cv2.connectedComponentsWithStats(m); k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); m = np.where(lb == k, 255, 0).astype(np.uint8)
ff = m.copy(); cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255); m = m | cv2.bitwise_not(ff)
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# a shadow on the studio floor (dark, below the given fraction of the height, and reaching the subject's edge) is not the subject
if len(sys.argv) > 5:
    fy = int(float(sys.argv[5]) * h); sl = cv2.GaussianBlur(lab, (0, 0), 2); L = sl[..., 0]; med = np.median(L[m > 0])
    grey = (np.abs(sl[..., 1] - 128) < 3) & (np.abs(sl[..., 2] - 128) < 4.5)   # stone stays warm in shadow; the floor's shadow is grey
    dark = ((L < med * .6) & grey & (m > 0)).astype(np.uint8); dark[:fy] = 0
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    edge = (m > 0) & (cv2.erode(m, np.ones((5, 5), np.uint8)) == 0)
    n2, lb2 = cv2.connectedComponents(dark)
    for i in range(1, n2):
        if (edge & (lb2 == i)).any(): m[lb2 == i] = 0
    n, lb, st, _ = cv2.connectedComponentsWithStats(m); k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); m = np.where(lb == k, 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
# up to full size, refine the edge with a guided feather
M = cv2.resize(m, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_LINEAR)
M = cv2.GaussianBlur(M, (0, 0), 2.2); M = np.clip((M.astype(np.float32) - 60) * 255 / 150, 0, 255)
M = cv2.GaussianBlur(M, (0, 0), 1.2)
ys, xs2 = np.where(M > 8); y0, y1, x0, x1 = ys.min(), ys.max(), xs2.min(), xs2.max()
pad = 12; y0 = max(0, y0 - pad); x0 = max(0, x0 - pad); y1 = min(im.shape[0], y1 + pad); x1 = min(im.shape[1], x1 + pad)
rgba = np.dstack([im[y0:y1, x0:x1], M[y0:y1, x0:x1].astype(np.uint8)])
sc = OH / rgba.shape[0]; rgba = cv2.resize(rgba, (int(rgba.shape[1] * sc), OH), interpolation=cv2.INTER_AREA)
cv2.imwrite(out, rgba); print(out, rgba.shape)
