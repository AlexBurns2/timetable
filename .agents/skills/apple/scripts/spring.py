#!/usr/bin/env python3
"""Generate CSS spring easings the way Apple describes springs.

Apple tunes springs with two design-friendly parameters (WWDC18 "Designing
Fluid Interfaces"): damping ratio (1.0 = no overshoot, lower = bouncier)
and response (seconds; how quickly the value heads to its target). SwiftUI
exposes the same model as spring(duration:bounce:), where bounce = 1 - damping.

This script turns those into a CSS `linear()` easing plus the settle
duration to pair it with, so web motion behaves like a real spring.

Usage:
  python3 spring.py                         # print the standard presets
  python3 spring.py --damping 0.8 --response 0.45
  python3 spring.py --bounce 0.2 --duration 0.5   # SwiftUI-style params

Paste the output as:
  transition: transform <settle>ms <linear(...)>;
"""
import argparse
import math


def spring_value(t, zeta, response):
    w0 = 2 * math.pi / response
    if zeta < 1:
        wd = w0 * math.sqrt(1 - zeta ** 2)
        return 1 - math.exp(-zeta * w0 * t) * (math.cos(wd * t) + (zeta * w0 / wd) * math.sin(wd * t))
    if zeta == 1:
        return 1 - (1 + w0 * t) * math.exp(-w0 * t)
    r1 = -w0 * (zeta - math.sqrt(zeta ** 2 - 1))
    r2 = -w0 * (zeta + math.sqrt(zeta ** 2 - 1))
    c2 = (r1) / (r1 - r2)
    c1 = 1 - c2
    return 1 - (c1 * math.exp(r1 * t) + c2 * math.exp(r2 * t))


def settle_time(zeta, response, eps=0.001):
    t, dt, last_outside = 0.0, 0.001, 0.0
    while t < 10:
        if abs(1 - spring_value(t, zeta, response)) > eps:
            last_outside = t
        t += dt
    return last_outside + dt


def css_linear(zeta, response, samples=32):
    total = settle_time(zeta, response)
    pts = []
    for i in range(samples + 1):
        p = i / samples
        v = spring_value(p * total, zeta, response)
        pts.append(f"{v:.4f}".rstrip("0").rstrip(".") if v not in (0, 1) else str(int(v)))
    pts[0], pts[-1] = "0", "1"
    # Drop redundant trailing 1s for brevity
    return f"linear({', '.join(pts)})", round(total * 1000)


PRESETS = [
    # name, damping, response, use
    ("smooth", 1.0, 0.45, "default for UI transitions with no momentum (taps, sheets, menus)"),
    ("snappy", 0.85, 0.35, "quick, confident state changes (toggles, segment pills, small reveals)"),
    ("bouncy", 0.7, 0.5, "only when a gesture carries momentum (flick-to-dismiss, drag release)"),
    ("gentle", 1.0, 0.7, "large surfaces moving a long way (full-screen covers, hero morphs)"),
    ("interactive", 0.86, 0.15, "tracking a finger/pointer 1:1 then settling on release"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--damping", type=float)
    ap.add_argument("--response", type=float)
    ap.add_argument("--bounce", type=float, help="SwiftUI bounce (0 = no overshoot); damping = 1 - bounce")
    ap.add_argument("--duration", type=float, help="SwiftUI perceptual duration in seconds (≈ response)")
    ap.add_argument("--samples", type=int, default=32)
    a = ap.parse_args()
    if a.bounce is not None or a.duration is not None:
        zeta = 1 - (a.bounce or 0.0)
        resp = a.duration or 0.5
        easing, ms = css_linear(zeta, resp, a.samples)
        print(f"/* bounce {a.bounce or 0}, duration {resp}s -> settle {ms}ms */\n{easing}")
        return
    if a.damping is not None and a.response is not None:
        easing, ms = css_linear(a.damping, a.response, a.samples)
        print(f"/* damping {a.damping}, response {a.response}s -> settle {ms}ms */\n{easing}")
        return
    for name, z, r, use in PRESETS:
        easing, ms = css_linear(z, r, a.samples)
        print(f"/* {name}: damping {z}, response {r}s, settle {ms}ms — {use} */")
        print(f"--spring-{name}: {easing};")
        print(f"--spring-{name}-duration: {ms}ms;\n")


if __name__ == "__main__":
    main()
