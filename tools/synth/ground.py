"""Synthwave's ground textures (images/synth/ground-*.webp): the street scene's wet road and plaza.

They are made from Poly Haven's CC0 scans of real surfaces (polyhaven.com; logged in PHOTO-LOG.md, credited in About):
  asphalt_pit_lane         the road's grain
  concrete_floor_worn_001  the plaza's concrete: its marks, and how rough it is
  scuffed_cement           (its height only) where the plaza dips, so where water stands

usage:  python -P tools/synth/ground.py <folder holding the 1k JPGs, anywhere under it> [--out images/synth]
needs:  asphalt_pit_lane_diff_1k.jpg, concrete_floor_worn_001_diff_1k.jpg, concrete_floor_worn_001_rough_1k.jpg,
        scuffed_cement_disp_1k.jpg        (Pillow and numpy)

What fx/synth.js (the STREET shader) reads:
  ground-asphalt.webp   512 x 512, grey: the grain (bright: a stone's wet top; dark: the pores between). One channel on
                        purpose: the shader takes it at several sizes (grain, speckle, patches) and twice over for the grain's
                        lean, and a grey WebP of noise is a third the size of a coloured one.
  ground-concrete.webp  512 x 512: r the concrete's tone, g how rough it is, b where it dips. Lossy WebP keeps colour at half
                        size, so the fine detail (scratches) is in g, which carries most of the brightness; b is smooth anyway.
Each channel is spread to the same range (mean .5, the same spread), so the shader's numbers don't depend on the scan.
The scans tile, and nothing here breaks that: sizes are halved exactly, and blurs wrap round the edges."""
import sys, os
import numpy as np
from PIL import Image

def find(root, name):
    for d, _, files in os.walk(root):
        if name in files: return os.path.join(d, name)
    sys.exit('missing ' + name + ' under ' + root)

def grey(path):                       # 0..1, linear in the file's own values (these are data, not pictures to look at)
    im = Image.open(path)
    if im.mode in ('I;16', 'I'): return np.asarray(im, np.float32) / 65535.
    a = np.asarray(im.convert('RGB'), np.float32) / 255.
    return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722

def spread(a, sd=.17):                # to mean .5 and a set spread; the few values past the ends are clipped
    a = (a - a.mean()) / max(a.std(), 1e-6) * sd + .5
    return np.clip(a, 0., 1.)

def halve(a):                         # exact 2 x 2 averages: a tiling picture still tiles
    return (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / 4.

def blur_wrap(a, r):                  # a Gaussian blur (r pixels) that wraps round the edges: done on the picture's frequencies
    fy = np.fft.fftfreq(a.shape[0])[:, None]; fx = np.fft.fftfreq(a.shape[1])[None, :]
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2. * np.pi ** 2 * r * r * (fx * fx + fy * fy)))).astype(np.float32)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    src = args[0]
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(os.path.dirname(__file__), '..', '..', 'images', 'synth')
    os.makedirs(out, exist_ok=True)

    # the road: the scan's own brightness is its grain (the stones are paler than the tar between them)
    a = grey(find(src, 'asphalt_pit_lane_diff_1k.jpg'))
    a = spread(halve(a) - blur_wrap(halve(a), 40) * .35, .2)                 # (its broadest unevenness a little flattened: the shader makes patches of its own)
    p = os.path.join(out, 'ground-asphalt.webp')
    Image.fromarray((a * 255 + .5).astype(np.uint8), 'L').save(p, 'WEBP', quality=72, method=6)
    print(os.path.basename(p), a.shape, round(os.path.getsize(p) / 1024), 'KB')

    # the plaza
    tone = spread(grey(find(src, 'concrete_floor_worn_001_diff_1k.jpg')))
    rough = spread(grey(find(src, 'concrete_floor_worn_001_rough_1k.jpg')))
    dip = grey(find(src, 'scuffed_cement_disp_1k.jpg')); dip = blur_wrap(dip, 6)
    dip = np.clip((dip - np.percentile(dip, 1)) / max(np.percentile(dip, 99) - np.percentile(dip, 1), 1e-6), 0., 1.)      # 0 the lowest ground, 1 the highest
    c = np.dstack([halve(tone), halve(rough), halve(dip)])                   # 512 across: from where the scene stands, a pixel is no finer than that
    p = os.path.join(out, 'ground-concrete.webp')
    Image.fromarray((c * 255 + .5).astype(np.uint8), 'RGB').save(p, 'WEBP', quality=82, method=6)
    print(os.path.basename(p), c.shape, round(os.path.getsize(p) / 1024), 'KB')

if __name__ == '__main__': main()
