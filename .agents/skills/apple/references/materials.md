# Materials & Liquid Glass

Sources: HIG "Materials" (Sept 2025), "Color › Liquid Glass color", "Scroll views › Scroll edge effects" (June 2026), "Layout"; WWDC25 "Meet Liquid Glass" and "Get to know the new design system"; Apple docs "Applying Liquid Glass to custom views".

## Contents
1. What Liquid Glass is (and isn't)
2. Where glass goes — and where it never goes
3. Regular vs clear
4. Color and tint on glass
5. Standard materials (content layer)
6. Scroll edge effects
7. Web recipes (CSS)
8. Accessibility & fallbacks
9. Performance
10. Native (SwiftUI / UIKit)

---

## 1. What Liquid Glass is (and isn't)

Liquid Glass (iOS/iPadOS/macOS/watchOS/tvOS 26+, refined in 27) is "a new digital meta-material that dynamically bends and shapes light." It is a **functional layer for controls and navigation** that floats above the content layer, so content can scroll and peek through while controls stay legible.

Its properties, per Apple's designers:
- **Lensing:** it bends and concentrates light instead of just blurring it, so edges are defined by refraction and highlights rather than by borders.
- **Adaptivity:** shadows deepen over text and lighten over plain backgrounds; small elements flip between light and dark based on what's behind them; larger elements (menus, sidebars) become thicker and more opaque rather than flipping.
- **Fluidity:** it reacts to touch by "flexing and energizing with light" — a glow starts under the finger and spreads. Controls morph into each other between states, and menus "pop open" from the button that summoned them.
- **Materializing:** objects appear and disappear by modulating the lensing in or out, not by a plain fade.
- **Lift on interaction:** some controls (slider thumbs, toggle knobs) are flat at rest and lift into glass while being touched — "the resting state stays visually quiet, while it comes to life on touch."

What it isn't: frosted-glass cards everywhere. That 2021-era "glassmorphism" look reads as dated and amateur next to Apple's restraint.

## 2. Where glass goes — and where it never goes

**Use glass for** the functional layer: navigation bars, toolbars, tab bars, sidebars (floating, inset), menus, popovers, context menus, sheets, alerts, floating action buttons, media controls over video, and the active state of sliders and toggles.

**Never use glass for:**
- **The content layer:** cards, list rows, tables, page backgrounds, hero sections. "Don't use Liquid Glass in the content layer… it can result in unnecessary complexity and a confusing visual hierarchy." A table view made of glass "would compete with other elements and muddy the hierarchy."
- **Glass on glass.** "Always avoid glass on glass." Elements on top of a glass surface use fills, transparency, and vibrancy, so they read as a thin overlay that is part of the material.
- **Every custom control.** "Use Liquid Glass effects sparingly… Limit these effects to the most important functional elements in your app."

In a steady state (such as first load), **avoid intersections between content and glass** where they hurt legibility: reposition or scale the content so the controls sit over calm areas.

## 3. Regular vs clear

| | Regular (default) | Clear |
|---|---|---|
| Look | Blurs and adjusts the luminosity of what's behind it; fully adaptive | Highly translucent; not adaptive |
| Use | Almost everything, and anything with significant text (alerts, sidebars, popovers) | Only for components floating over rich media (photos, video, maps) |
| Legibility | Built in | Needs a **dimming layer**: about 35% black behind the component when the media is bright; none if the media is already dark or the player supplies its own |

Clear glass is appropriate only when all three of these hold: the element is over media-rich content, the content won't suffer from a dimming layer, and the content on the glass is bold and bright. **Never mix regular and clear** in the same group of controls.

## 4. Color and tint on glass

- Glass has no color of its own; it takes color from what's behind it. Labels and symbols on it are **monochrome** by default and flip dark or light with the glass.
- **Tint only to signal primacy:** the one primary action (Done, Buy, Send, Check out), or a status indicator. Tint the **background** of the control, not the label. "Avoid tinting all your elements. When every element is tinted, nothing stands out."
- Apple's tint maps a range of tones to the brightness of the content behind it, like real stained glass. On the web, approximate it with a semi-opaque accent fill plus the glass highlights, never a flat opaque fill (which "breaks the visual character of Liquid Glass").
- If the content layer is colorful, keep bar labels monochrome. If it's mostly monochrome, the brand color can serve as the accent.

## 5. Standard materials (content layer)

For translucency *within* the content layer — captions over photos, overlays, panels over imagery, legacy-style sidebars — use the standard blur materials, chosen by meaning, not by look:

| Material | Light (web approximation) | Dark | Use |
|---|---|---|---|
| ultraThin | `rgb(255 255 255 / .35)` + blur 20px | `rgb(28 28 30 / .35)` | Maximum context, full-screen overlays with light scheme |
| thin | `rgb(255 255 255 / .55)` + blur 20px | `rgb(28 28 30 / .55)` | Overlays that partially obscure content |
| regular | `rgb(250 250 252 / .72)` + blur 20px | `rgb(28 28 30 / .72)` | Default overlays, panels |
| thick | `rgb(250 250 252 / .85)` + blur 20px | `rgb(28 28 30 / .85)` | Text-heavy overlays needing the most contrast |

Add `saturate(180%)` to the blur, as Apple's own web nav does: `backdrop-filter: saturate(180%) blur(20px)`. Thicker materials give better contrast for fine text, and thinner ones preserve context. On materials, use vibrant label colors (the secondary and tertiary label tokens), and avoid the quaternary level on thin materials because its contrast is too low.

## 6. Scroll edge effects

Where content scrolls under floating controls, a **scroll edge effect** keeps them legible: a soft dissolve of the content (or a subtle dim when the content is dark) instead of a hard divider line. Rules from the HIG:
- **Not decorative.** "They don't block or darken like overlays; they exist to ensure controls stay visually distinct." Use one only where a scroll view sits behind floating UI.
- **Soft** (default on iOS and iPadOS): a gradual blur and fade. **Hard** (mostly macOS): a uniform, more opaque band for text-heavy toolbars, borderless controls, or pinned table headers.
- **One per view;** never stack or mix soft and hard. In split views each pane can have its own, at matching heights.

## 7. Web recipes (CSS)

These reproduce the look well in every modern browser. Real lensing (refraction) needs SVG displacement filters that render only in Chromium, cost a lot of GPU time, and aren't used on apple.com itself. Skip it in production; blur, saturation, rim light, and adaptive shadow read as Liquid Glass everywhere.

### Regular glass
```css
.glass {
  position: relative;
  isolation: isolate;
  background: var(--glass-fill);                       /* light: rgb(255 255 255 / .55) | dark: rgb(44 44 48 / .5) */
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  box-shadow:
    inset 0 1px 0.5px var(--glass-highlight),          /* top specular edge: light .7 white | dark .22 white */
    inset 0 -0.5px 0.5px var(--glass-lowlight),        /* bottom inner edge: light .05 black | dark .3 black */
    0 0 0 0.5px var(--glass-outline),                  /* hairline definition: light .06 black | dark .5 black */
    0 8px 28px var(--glass-shadow),                    /* lift: light .12 black | dark .45 black */
    0 1px 3px var(--glass-shadow-tight);               /* contact shadow: light .06 | dark .3 */
}
/* Rim light: brighter at the top-left and bottom-right edges, like light catching a curved edge */
.glass::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: linear-gradient(135deg, var(--glass-rim-strong), transparent 38%, transparent 62%, var(--glass-rim-soft));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
```
The tokens (`--glass-*`) are defined for light and dark in `assets/apple-tokens.css`. Give glass elements a capsule or concentric radius; they're "rounded, floating forms that nest neatly in the rounded curves of modern devices."

### Clear glass (over media only)
```css
.glass-clear {
  background: rgb(255 255 255 / .1);
  -webkit-backdrop-filter: blur(6px) saturate(160%) brightness(1.05);
  backdrop-filter: blur(6px) saturate(160%) brightness(1.05);
  color: #fff;
  box-shadow: inset 0 1px 0.5px rgb(255 255 255 / .45), 0 0 0 0.5px rgb(255 255 255 / .18), 0 8px 24px rgb(0 0 0 / .25);
}
/* Dimming layer for bright media: a gradient scrim behind the controls, ~35% at its strongest */
.media-scrim { background: linear-gradient(to top, rgb(0 0 0 / .35), transparent 40%); pointer-events: none; }
```

### Tinted (prominent) glass — the one primary action
```css
.glass-prominent {
  background: color-mix(in oklab, var(--accent) 88%, transparent);
  color: #fff;
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  box-shadow: inset 0 1px 0.5px rgb(255 255 255 / .35), 0 6px 20px color-mix(in oklab, var(--accent) 35%, transparent);
}
```

### Interaction: "flex and energize"
Glass responds to a press by brightening from the touch point and swelling slightly; solid controls dim slightly instead.
```css
.glass-button { transition: transform var(--spring-snappy-duration) var(--spring-snappy); }
.glass-button::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0;
  background: radial-gradient(circle at var(--px, 50%) var(--py, 50%), rgb(255 255 255 / .45), transparent 65%);
  transition: opacity 240ms var(--ease-standard);
}
.glass-button:active { transform: scale(1.04); }
.glass-button:active::before { opacity: 1; }
```
```js
// Track where the press starts so the glow originates under the finger or pointer
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.glass-button'); if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--px', `${e.clientX - r.left}px`);
  el.style.setProperty('--py', `${e.clientY - r.top}px`);
});
```

### Materialize (appear and disappear)
Animate opacity, a little scale, and a small blur together, from the source element's position:
```css
@keyframes materialize { from { opacity: 0; transform: scale(.94); filter: blur(6px); } }
.popover[open] { transform-origin: var(--origin, top center); animation: materialize var(--spring-smooth-duration) var(--spring-smooth); }
```
Don't animate `backdrop-filter` itself; it re-renders the blur every frame.

### Scroll edge effect under a floating top bar
```css
.scroll-edge-top {
  position: fixed; inset: 0 0 auto 0; height: calc(var(--bar-height, 52px) + env(safe-area-inset-top) + 28px);
  pointer-events: none; z-index: 1;                           /* below the bar, above the content */
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 78%, transparent), transparent);
  -webkit-mask-image: linear-gradient(to bottom, #000 45%, transparent);
          mask-image: linear-gradient(to bottom, #000 45%, transparent);
}
/* Hard style (dense desktop toolbars, pinned table headers): uniform and more opaque */
.scroll-edge-hard { background: color-mix(in srgb, var(--bg) 88%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid var(--separator); }
```
Show the effect only once content has actually scrolled under the bar (an `IntersectionObserver` sentinel at the top of the scroller toggles a class), so the resting state is clean.

### Background extension (full-bleed image under a sidebar)
Instead of letting a sidebar crop a hero image, mirror and blur the image beneath the sidebar:
```css
.hero { position: relative; overflow: hidden; }
.hero::before { /* the extension: same image, flipped and heavily blurred, fills the whole width */
  content: ""; position: absolute; inset: -40px; background: var(--hero-img) center/cover;
  transform: scaleX(-1); filter: blur(40px) saturate(1.2); }
.hero > img { position: relative; margin-inline-start: var(--sidebar-width); width: calc(100% - var(--sidebar-width)); object-fit: cover; }
```
Keep text and controls above the extension, never on the distorted area.

## 8. Accessibility & fallbacks

Apple builds these adaptations into the material; on the web you write them:
```css
/* Reduce Transparency → frostier or opaque */
@media (prefers-reduced-transparency: reduce) {
  .glass, .glass-clear, .material { background: var(--bg-elevated); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
/* Increase Contrast → predominantly solid, with a contrasting border */
@media (prefers-contrast: more) {
  .glass, .glass-clear { background: var(--bg-elevated); -webkit-backdrop-filter: none; backdrop-filter: none;
    box-shadow: none; border: 1px solid var(--label); }
  .glass::after { display: none; }
}
/* Reduced motion → no elastic swelling or glow travel */
@media (prefers-reduced-motion: reduce) {
  .glass-button:active { transform: none; }
}
/* No backdrop-filter support → nearly opaque */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: color-mix(in srgb, var(--bg-elevated) 96%, transparent); }
}
```
Always verify the label contrast on glass over the *worst-case* content behind it (a white photo region in light mode, a black one in dark mode). If it fails, raise the fill opacity or add a scrim. Never accept illegible controls for the sake of the effect.

## 9. Performance

- Each `backdrop-filter` layer costs GPU work every frame that anything behind it changes. Keep to a handful at once (top bar, tab bar, one open popover).
- Blur radii of 12–24px look right; bigger radii cost more and look muddier.
- Never animate `backdrop-filter` values; animate the opacity and transform of the glass element.
- Avoid glass over autoplaying video unless it's a deliberate media-control overlay.
- Test scrolling on a mid-range Android phone and an older iPhone. Dropped frames undo the premium feel faster than any visual flaw.

## 10. Native (SwiftUI / UIKit)

Standard components (navigation bars, toolbars, tab bars, sheets, menus, popovers, sidebars, buttons in toolbars) adopt Liquid Glass automatically when built with the current SDK. "If you've customized your bars, now's the time to clean them up": remove custom bar backgrounds and borders.

SwiftUI (verified against Apple's documentation):
```swift
Text("Hello").padding().glassEffect()                                 // regular glass, capsule shape
Text("Hello").padding().glassEffect(in: .rect(cornerRadius: 16))      // custom shape
Image(systemName: "plus").glassEffect(.regular.tint(.orange).interactive()) // tinted + reacts to touch
Button("Add") { }.buttonStyle(.glass)                                 // secondary glass button
Button("Done") { }.buttonStyle(.glassProminent)                       // primary, tinted with the accent
GlassEffectContainer(spacing: 40) { /* several glass views that blend and morph together */ }
view.glassEffectID("pencil", in: namespace)                           // morph between views during transitions
ScrollView { … }.scrollEdgeEffectStyle(.soft, for: .top)
Image("hero").backgroundExtensionEffect()                             // mirror and blur under a sidebar
```
Variants: `Glass.regular` and `Glass.clear`. UIKit: `UIGlassEffect`, `UIScrollEdgeEffect`, `UIBackgroundExtensionView`. Put several glass elements inside one `GlassEffectContainer` for performance and so they can merge and morph. Apply `glassEffect` after other appearance modifiers.
