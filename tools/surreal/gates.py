"""Surrealism's planner scene (render.py imports it): a line of identical gateways crossing the Salar de Uyuni, rendered in
3D with a pinhole camera matched to the photograph (its horizon; a person's eye height), lit by a low sun just risen ahead
so their long shadows fall toward the viewer, and fading into the morning haze with distance.

Nothing clever: each gateway is three boxes (two piers and a lintel). Faces are drawn far to near with a weathered stone
texture; shadows are the boxes projected onto the ground along the sun, merged, softened more the further away they are."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def render(ph, horizon=0.584, f=1750.0, eye=1.65, count=8):
    W, H = ph.size; cx, yh = W / 2, horizon * H
    def P(x, y, z):                                   # world (x right, y up, z ahead) to the photo
        return (cx + f * x / z, yh - f * (y - eye) / z)
    sun = np.array([0.42, 0.15, 1.0]); sun /= np.linalg.norm(sun)       # low, ahead and to the right: the shadows come at us, across the salt to the left
    out = ph.convert('RGBA')
    # the stone: weathered pale grey, a little warm where the low sun lights it
    rng = np.random.default_rng(7)
    def stone(w=512, h=768, boards=14):
        """board-formed concrete, as poured in layers: soft blotches, fine grain, the seam between each board, and
        streaks where rain ran down; 0..1, mid grey about .5"""
        def noise(sx, sy, k):
            a = rng.random((sy, sx)); return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(k)), np.float32) / 255
        t = noise(10, 14, 6) * .45 + noise(48, 72, 2) * .3 + (rng.random((h, w)).astype(np.float32)) * .25
        yy = np.arange(h)[:, None] / h * boards
        seam = np.exp(-((yy - np.round(yy)) ** 2) / 0.0009)
        t = t - seam * .22
        streak = np.asarray(Image.fromarray((rng.random((1, w)) * 255).astype(np.uint8)).resize((w, h), Image.NEAREST).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
        t = t - np.clip(streak - .62, 0, 1) * .5 * (np.arange(h)[:, None] / h) ** .5
        return np.clip(t, 0, 1)
    tex = stone()
    texim = Image.fromarray((tex * 255).astype(np.uint8))
    # the gateways: along a straight line from near-left to the horizon on the right, all turned the same way
    gates = []
    for i in range(count):
        t = i / (count - 1)
        z = 44 * (1.0 + 1.0 * i) ** 1.5                # spaced so the steps look even as they recede
        x = 16.5 - 0.31 * (z - 44)                     # near on the right (beside the page), away to the left
        gates.append((x, z))
    turn = math.radians(-20)                              # each faces a little off the camera, toward the line's direction
    ca, sa = math.cos(turn), math.sin(turn)
    def box(x0, z0, a, b, c, d, y0, y1):
        """a box: local x from a to b, local z from c to d, y from y0 to y1, about the gate's centre (x0, z0), turned"""
        pts = []
        for lx in (a, b):
            for ly in (y0, y1):
                for lz in (c, d):
                    pts.append(np.array([x0 + lx * ca - lz * sa, ly, z0 + lx * sa + lz * ca]))
        return pts
    def gate(x0, z0):
        w, h, t, p = 6.0, 9.4, 1.3, 1.35            # opening width, height, depth, pier width
        return [box(x0, z0, -w / 2 - p, -w / 2, -t / 2, t / 2, 0, h), box(x0, z0, w / 2, w / 2 + p, -t / 2, t / 2, 0, h),
                box(x0, z0, -w / 2 - p, w / 2 + p, -t / 2, t / 2, h, h + 1.6)]
    FACES = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
    haze = np.array([0.80, 0.80, 0.90]) * 255           # the colour of the far air at the horizon (sampled by eye)
    # shadows first (on the ground), far to near
    for (gx, gz) in sorted(gates, key=lambda g: -g[1]):
        sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
        for pts in gate(gx, gz):
            gpts = []
            for p in pts:                                  # each corner along the sun down to the ground (no nearer than 2 m)
                k = p[1] / sun[1]; q = p - k * sun
                if q[2] < 2.0: q = p - ((p[2] - 2.0) / sun[2]) * sun; q[1] = 0
                gpts.append(q)
            if len(gpts) < 3: continue
            scr = np.array([P(*q) for q in gpts])
            hull = convex_hull(scr)
            d.polygon([tuple(v) for v in hull], fill=255)
        blur = max(1.0, 260.0 / gz)
        sh = sh.filter(ImageFilter.GaussianBlur(blur))
        a = np.asarray(sh, np.float32) / 255 * min(0.62, 0.62 * (1 - math.exp(-60 / gz)) + 0.25)
        dark = np.zeros((H, W, 4), np.uint8); dark[..., 0], dark[..., 1], dark[..., 2] = 48, 52, 92; dark[..., 3] = (a * 255).astype(np.uint8)
        out.alpha_composite(Image.fromarray(dark, 'RGBA'))
    # the gateways, far to near; in each, the faces far to near
    light = lambda n: max(0.0, float(np.dot(n, sun)))
    for (gx, gz) in sorted(gates, key=lambda g: -g[1]):
        fade = 1 - math.exp(-gz / 520)                   # haze with distance
        faces = []
        for pts in gate(gx, gz):
            for fc in FACES:
                q = [pts[k] for k in fc]
                c = sum(q) / 4
                n = np.cross(q[1] - q[0], q[3] - q[0]); n /= np.linalg.norm(n) + 1e-9
                if np.dot(n, c - np.array([0, eye, 0])) > 0: n = -n      # outward, toward the camera side
                if np.dot(n, np.array([0, eye, 0]) - c) <= 0: continue    # facing away
                faces.append((np.linalg.norm(c - np.array([0, eye, 0])), q, n))
        gy = P(gx, 0, gz)[1]; gtop = P(gx, 11.0, gz)[1]
        for dist, q, n in sorted(faces, key=lambda v: -v[0]):
            scr = [P(*p) for p in q]
            sky = 0.54 + 0.2 * max(0.0, n[1])                # the dawn sky's light, cool
            sunl = light(n) * 0.95                            # the low sun's, warm
            col = np.array([188, 188, 206]) * sky + np.array([255, 188, 158]) * sunl
            col = col * (1 - fade) + haze * fade
            x0, y0 = int(min(s[0] for s in scr)) - 1, int(min(s[1] for s in scr)) - 1
            x1, y1 = int(max(s[0] for s in scr)) + 2, int(max(s[1] for s in scr)) + 2
            if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H or x1 - x0 < 1 or y1 - y0 < 1: continue
            bw, bh = x1 - x0, y1 - y0
            m = Image.new('L', (bw * 2, bh * 2), 0)
            ImageDraw.Draw(m).polygon([((s[0] - x0) * 2, (s[1] - y0) * 2) for s in scr], fill=255)
            m = m.resize((bw, bh), Image.LANCZOS)
            # the concrete, in perspective on the face: the texture's corners to the face's (q's order: a quad)
            if abs(q[1][1] - q[0][1]) > abs(q[3][1] - q[0][1]): q = [q[0], q[3], q[2], q[1]]; scr = [P(*p) for p in q]   # (the texture's across along the face's level edge)
            if q[0][1] < q[3][1]: q = [q[3], q[2], q[1], q[0]]; scr = [P(*p) for p in q]                                         # (and its top at the top)
            ww = np.linalg.norm(q[1] - q[0]); hh = np.linalg.norm(q[3] - q[0])
            tw, th = texim.size
            src = [(0, 0), (min(tw, tw * ww / 6), 0), (min(tw, tw * ww / 6), min(th, th * hh / 9)), (0, min(th, th * hh / 9))]
            dst = [(s[0] - x0, s[1] - y0) for s in scr]
            tt = np.asarray(texim.transform((bw, bh), Image.PERSPECTIVE, persp(dst, [src[0], src[1], src[2], src[3]]), Image.BICUBIC), np.float32) / 255
            # darker toward the ground (the light the salt doesn't bounce into the corner)
            ys = (np.arange(bh)[:, None] + y0 - gtop) / max(1.0, gy - gtop)
            ao = 1 - 0.18 * np.clip((ys - 0.7) / 0.3, 0, 1) ** 1.5
            shade = ((0.82 + 0.42 * (tt - 0.5) * (1 - fade)) * ao)[..., None]
            rgb = np.clip(col[None, None, :] * shade, 0, 255).astype(np.uint8)
            layer = np.concatenate([rgb, np.asarray(m)[..., None]], -1)
            out.alpha_composite(Image.fromarray(layer, 'RGBA'), (x0, y0))
    return out.convert('RGB'), gates

def persp(dst, src):
    """PIL's PERSPECTIVE coefficients mapping output points dst (x, y) to input points src"""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return tuple(np.linalg.lstsq(np.array(A, float), np.array(b, float), rcond=None)[0])

def convex_hull(pts):
    pts = sorted(map(tuple, pts))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]
