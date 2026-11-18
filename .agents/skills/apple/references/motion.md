# Motion

Sources: HIG "Motion" (Sept 2025), "Accessibility › Cognitive", "SF Symbols › Animations"; WWDC18 "Designing Fluid Interfaces"; WWDC25 "Meet Liquid Glass"; WWDC24 "Enhance your UI animations and transitions"; apple.com production CSS.

## Contents
1. What motion is for
2. Springs — Apple's motion model
3. Presets (copy-ready)
4. Durations and curves for non-spring changes
5. Spatial rules: where things come from and go
6. Gestures, momentum, and interruption
7. What to animate (and what never to)
8. Reduced motion
9. Web implementation patterns
10. Native (SwiftUI)

---

## 1. What motion is for

"Beautiful, fluid motions bring the interface to life, conveying status, providing feedback and instruction, and enriching the visual experience." And: "Don't add motion for the sake of adding motion. Gratuitous or excessive animation can distract people and may make them feel disconnected or physically uncomfortable."

Motion should do one of these jobs:
- **Orient:** show where something came from and where it went (a sheet rises from the bottom; a detail view zooms out of its tile).
- **Confirm:** acknowledge an action instantly (a press state, a check mark drawing on, a badge bouncing once).
- **Show state or progress:** loading, recording, syncing.
- **Teach:** hint at a gesture (a control nudging in the direction it can be swiped).

HIG rules:
- **Brief and precise.** "When animated feedback is brief and precise, it tends to feel lightweight and unobtrusive."
- **Realistic.** Motion follows the gesture and people's expectations. "If someone reveals a view by sliding it down from the top, they don't expect to dismiss it by sliding it to the side."
- **Little or no motion on frequent interactions.** "Avoid making people spend extra time paying attention to unnecessary motion every time they interact."
- **Cancellable.** "Don't make people wait for an animation to complete before they can do anything."
- **Optional.** Never the only channel for important information; pair it with text, haptics, or sound.

## 2. Springs — Apple's motion model

Apple doesn't think in durations and bezier curves for interactive motion; it thinks in **springs**, because springs are continuous, interruptible, and can inherit velocity from a gesture. Apple reduced spring physics to two design parameters:

- **Damping ratio** (0–1): how much it overshoots. **1.0 = no overshoot** (critically damped); lower values bounce more.
- **Response** (seconds): how quickly it heads to the target. Roughly the perceived duration.

SwiftUI exposes the same model as `spring(duration:bounce:)`, where `bounce = 1 − damping`.

Apple's guidance on choosing:
- **"Start with 100% damping."** No overshoot gives "smooth, graceful, and seamless motion that doesn't distract from the task at hand."
- **Add bounce only when the gesture has momentum.** Apple Music: tapping the mini player opens Now Playing with 100% damping (no momentum, no bounce); flicking it down to dismiss uses **80% damping** — "a little bit of bounce and squish, making the gesture a lot more satisfying."
- **Bounce can teach:** a control that wobbles slightly when pressed lightly hints that a firmer press activates it.
- **Avoid "duration" thinking for elastic behavior;** the spring is always ready to retarget.

## 3. Presets (copy-ready)

Generated with `scripts/spring.py` and included in `assets/apple-tokens.css`. Each `linear()` easing must be paired with its settle duration.

| Token | Damping | Response | Settle | Use |
|---|---|---|---|---|
| `--spring-smooth` | 1.0 | 0.45s | 662ms | **Default.** Sheets, menus, popovers, navigation, size changes |
| `--spring-snappy` | 0.85 | 0.35s | 488ms | Toggles, segmented-control thumbs, small reveals, press release |
| `--spring-bouncy` | 0.70 | 0.50s | 819ms | Only after a flick or drag release with momentum; playful moments |
| `--spring-gentle` | 1.0 | 0.70s | 1029ms | Large surfaces moving far: full-screen covers, hero morphs |
| `--spring-interactive` | 0.86 | 0.15s | 210ms | Following a finger or pointer closely, then settling |

```css
.sheet { transition: transform var(--spring-smooth-duration) var(--spring-smooth); }
```
A spring's settle time is longer than its *perceived* duration: most of the movement happens in the first 40–50%, so a 662ms smooth spring feels like about 350ms. That's expected. For a custom feel, run `python3 scripts/spring.py --damping 0.9 --response 0.4`.

## 4. Durations and curves for non-spring changes

Color, opacity, and other non-spatial changes don't need springs. Apple's web team uses these curves:

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.6, 1)` | apple.com's workhorse: nav flyouts, color and background changes, show and hide |
| `--ease-out-soft` | `cubic-bezier(0.25, 0.1, 0.3, 1)` | Content reveals and fades on marketing pages |
| `--ease-emphasized` | `cubic-bezier(0.28, 0.11, 0.32, 1)` | Larger content movements on marketing pages |

| Token | Duration | Use |
|---|---|---|
| `--dur-instant` | 100ms | Hover color changes (apple.com tile buttons use 100ms linear) |
| `--dur-fast` | 200ms | Small opacity and color transitions |
| `--dur-base` | 320ms | apple.com's standard for nav and menu transitions |
| `--dur-slow` | 500ms | Large fades, image cross-fades |

Never use `linear` for movement (it looks mechanical), or the browser's default `ease` for anything you care about.

## 5. Spatial rules: where things come from and go

- **Grow from the source.** Menus and popovers "pop open" from the button that summoned them (set `transform-origin` toward the trigger). Action sheets now spring from the tapped control instead of always rising from the bottom. A detail view zooms out of the tapped tile (a zoom transition).
- **Leave the way you came.** Dismissals mirror presentations; symmetry builds a spatial map.
- **Hint in the direction of travel.** On press, a control expands slightly toward its final state.
- **Morph rather than swap.** Controls that persist between states shape-shift into their new form (Liquid Glass "dynamically morphs between the controls in each context… maintaining the concept of a singular floating plane").
- **Materialize, don't just fade.** Appearing glass elements combine opacity, slight scale (0.94→1), and a small blur clearing (6px→0).
- **Use cross-fades when moving something doesn't communicate anything,** for example when relocating an object.

## 6. Gestures, momentum, and interruption

From "Designing Fluid Interfaces":
- **Respond with zero latency.** Start feedback on `pointerdown` or `touchstart`, not on `click`. Remove artificial delays.
- **1:1 tracking.** While dragging, content stays exactly under the finger. Any lag or easing during the drag breaks the illusion.
- **Interruptible and redirectable.** A sheet halfway through closing can be grabbed again; a menu animating open can be dismissed immediately. CSS transitions retarget smoothly from their current value, while keyframe animations don't, so prefer transitions (or the Web Animations API) for anything interactive.
- **Preserve momentum.** On release, use the gesture's velocity. Project where a thrown object would land, then snap to the nearest valid resting point *from the projection*, not from the release position. Apple's own function from the WWDC sample:
  ```js
  // velocity in px per second; 0.998 = UIScrollView's normal deceleration rate (0.99 = fast)
  const project = (velocity, rate = 0.998) => (velocity / 1000) * rate / (1 - rate);
  const target = nearestSnapPoint(position + project(velocityX));
  ```
- **Rubber-band at boundaries.** Past an edge, movement continues with increasing resistance and springs back on release. The classic iOS curve:
  ```js
  // x = distance past the edge, d = viewport dimension, c = 0.55
  const rubberBand = (x, d, c = 0.55) => (1 - 1 / ((x * c / d) + 1)) * d;
  ```
- **Detect competing gestures in parallel** from the start (tap vs drag vs scroll) instead of with delays.

## 7. What to animate (and what never to)

- **Animate `transform`, `opacity`, and (sparingly) `filter`.** These are compositor-friendly and stay smooth at 60–120fps.
- **Don't animate** `width`, `height`, `top`, `left`, `margin`, `box-shadow` on large elements, or `backdrop-filter`. For size changes, use the FLIP technique (animate a transform from old to new geometry) or the View Transitions API.
- **Frame quality over frame rate:** fast movement strobes. Keep large moves within one gesture's natural speed; don't fling elements across the whole screen in 150ms.
- **Stagger sparingly.** A 20–40ms stagger across a few items reads as considered; across 20 items it's slow and showy.
- **Scroll-driven effects** (marketing pages): modest reveals (opacity 0→1, translateY 24–40px→0) once per element, plus sticky pinned storytelling for hero products. No parallax on text, no scroll-jacking, and nothing that hides content from people who scroll fast.
- **Animated symbols** (SF Symbols on native; Lottie or SVG on the web): use the right verb. Bounce confirms an action, pulse or breathe shows ongoing activity, rotate shows progress, wiggle draws attention, replace swaps states, and draw on/off traces a symbol. Use them judiciously.

## 8. Reduced motion

When `prefers-reduced-motion: reduce` is on (HIG checklist):
- Tighten springs to remove bounce.
- Track gestures directly; don't add extra motion.
- Avoid animating depth (z-axis or scale) changes.
- **Replace x, y, and z movement with fades.**
- Avoid animating into and out of blurs.
- Turn off autoplaying, looping, and parallax effects.

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --spring-smooth: ease; --spring-snappy: ease; --spring-bouncy: ease; --spring-gentle: ease; --spring-interactive: ease;
    --spring-smooth-duration: 200ms; --spring-snappy-duration: 150ms; --spring-bouncy-duration: 200ms; --spring-gentle-duration: 250ms; --spring-interactive-duration: 100ms;
  }
  *, *::before, *::after { scroll-behavior: auto !important; }
  .reveal, [data-animate] { transform: none !important; } /* keep the fade, drop the travel */
}
```

## 9. Web implementation patterns

**Sheet (bottom on phone, centered on desktop)**
```css
dialog.sheet { transform: translateY(100%); transition: transform var(--spring-smooth-duration) var(--spring-smooth), overlay var(--spring-smooth-duration) allow-discrete, display var(--spring-smooth-duration) allow-discrete; }
dialog.sheet[open] { transform: translateY(0); }
@starting-style { dialog.sheet[open] { transform: translateY(100%); } }
dialog.sheet::backdrop { background: rgb(0 0 0 / .25); transition: background var(--dur-base) var(--ease-standard); }
```

**Press feedback (solid buttons):** dim on press with no delay, and restore with a spring.
```css
.btn { transition: transform var(--spring-snappy-duration) var(--spring-snappy), background-color var(--dur-instant) linear; }
.btn:active { transform: scale(.97); transition-duration: 80ms; }
```

**Zoom transition from tile to detail:** the View Transitions API.
```css
.tile img      { view-transition-name: var(--vt-name); }   /* set per tile, e.g. style="--vt-name: photo-42" */
.detail .hero  { view-transition-name: var(--vt-name); }
::view-transition-group(*) { animation-duration: var(--spring-smooth-duration); animation-timing-function: var(--spring-smooth); }
```

**JS springs** for drag and release with real velocity: use the Web Animations API with `linear()` easings, or a physics library (Motion's `spring` with `bounce: 0` / `visualDuration: 0.4` mirrors SwiftUI's model). Retarget from the current value on interruption.

## 10. Native (SwiftUI)

- Built-in springs: `.smooth` (no bounce, the default), `.snappy` (small bounce), `.bouncy` (larger bounce), or `.spring(duration: 0.5, bounce: 0.2)`.
- `withAnimation(.smooth) { … }` for state changes; `.animation(.snappy, value: x)` for view-scoped changes.
- Gesture-driven motion: `.interactiveSpring()` while tracking, then a spring that inherits velocity on release.
- Navigation zoom: `.navigationTransition(.zoom(sourceID:in:))` with `.matchedTransitionSource(id:in:)`.
- SF Symbols: `.symbolEffect(.bounce, value: count)`, `.symbolEffect(.pulse)`, `.contentTransition(.symbolEffect(.replace))`.
- Reduce Motion: read `@Environment(\.accessibilityReduceMotion)` and swap movement for opacity.
