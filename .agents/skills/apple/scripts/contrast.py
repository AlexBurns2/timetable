#!/usr/bin/env python3
"""WCAG 2.x contrast checker for Apple-style palettes.

Usage:
  python3 contrast.py "#1d1d1f" "#f5f5f7"           # one pair
  python3 contrast.py "#ffffff" "#0071e3" --large   # large/bold text threshold (3:1)
  python3 contrast.py --pairs pairs.txt              # one "fg bg" pair per line

Colors: #rgb, #rrggbb, #rrggbbaa, rgb(r,g,b), rgba(r,g,b,a).
Semi-transparent foregrounds are composited over the background first,
which matters for Apple's label colors (e.g. rgba(60,60,67,.6)).

Thresholds follow the HIG (Accessibility page, WCAG AA):
  text up to 17pt regular  -> 4.5:1
  text 18pt+ or any bold   -> 3:1
  HIG target for custom fg/bg colors, especially small text -> 7:1
"""
import re
import sys


def parse(c):
    c = c.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3,8})", c)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    m = re.fullmatch(r"rgba?\(([^)]*)\)", c)
    if m:
        parts = [p.strip() for p in re.split(r"[,\s/]+", m.group(1)) if p.strip()]
        r, g, b = (float(p) for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return r, g, b, a
    raise ValueError(f"Unrecognized color: {c}")


def composite(fg, bg):
    r, g, b, a = fg
    br, bgc, bb, _ = bg
    return (r * a + br * (1 - a), g * a + bgc * (1 - a), b * a + bb * (1 - a), 1.0)


def luminance(rgb):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(fg, bg):
    fgc = composite(parse(fg), parse(bg))
    l1, l2 = luminance(fgc), luminance(parse(bg))
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def verdict(r, large=False):
    need = 3.0 if large else 4.5
    status = "PASS" if r >= need else "FAIL"
    extra = " (meets 7:1 HIG target)" if r >= 7 else ""
    return f"{status} AA{' large' if large else ''} (needs {need}:1){extra}"


def main(argv):
    large = "--large" in argv
    argv = [a for a in argv if a != "--large"]
    pairs = []
    if argv and argv[0] == "--pairs":
        for line in open(argv[1]):
            line = line.strip()
            if line and not line.startswith("#!"):
                toks = re.findall(r"rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}", line)
                if len(toks) >= 2:
                    pairs.append((toks[0], toks[1]))
    elif len(argv) == 2:
        pairs.append((argv[0], argv[1]))
    elif len(argv) == 1:  # "fg bg" passed as one quoted argument
        toks = re.findall(r"rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}", argv[0])
        if len(toks) != 2:
            print(__doc__)
            return 1
        pairs.append((toks[0], toks[1]))
    else:
        print(__doc__)
        return 1
    for fg, bg in pairs:
        r = ratio(fg, bg)
        print(f"{fg:>24} on {bg:<24} {r:5.2f}:1  {verdict(r, large)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
