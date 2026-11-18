# Color

Sources: HIG "Color" (Liquid Glass revision, Dec 2025), "Dark Mode", "Materials", "Branding" (Sept 2026), "Accessibility"; WWDC25 "Meet Liquid Glass"; apple.com production CSS. Every contrast ratio here was computed with `scripts/contrast.py`.

## Contents
1. How Apple uses color
2. System accent colors (exact current values)
3. System grays
4. Semantic colors — backgrounds, labels, fills, separators
5. apple.com's web palette
6. Which colors are safe for text (contrast results)
7. Accent color — choosing and deriving states
8. Dark Mode
9. Liquid Glass and color
10. Wide color (Display P3)

---

## 1. How Apple uses color

- **Restraint.** Interfaces are mostly neutral (white, near-white grays, near-black text), so the few colored things carry meaning. Apple's guidance on brand color: "Using your brand color too broadly can overwhelm your interface and dilute its impact."
- **Semantic, not decorative.** "Avoid using the same color to mean different things." If the accent marks interactivity, don't also use it for static text or decoration.
- **Every color is a set:** light, dark, increased-contrast light, and increased-contrast dark. "Even if your app ships in a single appearance mode, provide both light and dark colors."
- **Never color alone.** Pair color with text, a symbol, or a shape. Red–green and blue–orange pairs are the hardest for colour-blind people.
- **Think about culture.** Red means danger in some cultures and good fortune in others.
- **Put brand color in the content layer** (hero backgrounds, illustrations, data), where it scrolls under the glass controls and tints them. Keep bars and controls monochrome, and tint only the primary action.

## 2. System accent colors (iOS/iPadOS/macOS 26+, current HIG)

These were retuned for Liquid Glass in June 2025 ("improving hue differentiation without losing the optimistic spirit"). Note that **blue is now `#0088FF`**, not the older `#007AFF`.

| Name | Light | Dark | Increased contrast (light) | Increased contrast (dark) |
|---|---|---|---|---|
| Red | `#FF383C` | `#FF4245` | `#E9152D` | `#FF6165` |
| Orange | `#FF8D28` | `#FF9230` | `#C55300` | `#FFA056` |
| Yellow | `#FFCC00` | `#FFD600` | `#A16A00` | `#FEDF43` |
| Green | `#34C759` | `#30D158` | `#008932` | `#4AD968` |
| Mint | `#00C8B3` | `#00DAC3` | `#008575` | `#54DFCB` |
| Teal | `#00C3D0` | `#00D2E0` | `#008198` | `#3BDDEC` |
| Cyan | `#00C0E8` | `#3CD3FE` | `#007EAE` | `#6DD9FF` |
| Blue | `#0088FF` | `#0091FF` | `#1E6EF4` | `#5CB8FF` |
| Indigo | `#6155F5` | `#6D7CFF` | `#564ADE` | `#A7AAFF` |
| Purple | `#CB30E0` | `#DB34F2` | `#B02FC2` | `#EA8DFF` |
| Pink | `#FF2D55` | `#FF375F` | `#E7124D` | `#FF8AC4` |
| Brown | `#AC7F5E` | `#B78A66` | `#956D51` | `#DBA679` |

visionOS uses the dark values. In native apps, **never hard-code these**; use `Color.red`, `UIColor.systemRed`, and so on, because "the actual color values may fluctuate from release to release." On the web, hard-coding is unavoidable, so keep them in tokens.

Conventional meanings: red for destructive actions, errors, and recording; orange for warnings; yellow for caution and highlights; green for success and "on"; blue for interactive elements and links (the default accent).

## 3. System grays (iOS / iPadOS)

| Name | Light | Dark | IC light | IC dark |
|---|---|---|---|---|
| Gray | `#8E8E93` | `#8E8E93` | `#6C6C70` | `#AEAEB2` |
| Gray 2 | `#AEAEB2` | `#636366` | `#8E8E93` | `#7C7C80` |
| Gray 3 | `#C7C7CC` | `#48484A` | `#AEAEB2` | `#545456` |
| Gray 4 | `#D1D1D6` | `#3A3A3C` | `#BCBCC0` | `#444446` |
| Gray 5 | `#E5E5EA` | `#2C2C2E` | `#D8D8DC` | `#363638` |
| Gray 6 | `#F2F2F7` | `#1C1C1E` | `#EBEBF0` | `#242426` |

Apple's grays have a faint cool-blue cast (the blue channel is a few points higher). Pure neutral `#888` grays look subtly off next to them.

## 4. Semantic colors — backgrounds, labels, fills, separators

Apple defines colors by *purpose*. Name your tokens the same way and never repurpose them ("don't use the separator color as a text color, or secondary label color as a background").

The values below are UIKit's long-standing published values (iOS 13 through 26). The HIG documents the *roles* but not these numbers, so treat them as accurate references rather than guarantees.

### Backgrounds — two families × three levels

Use **system** backgrounds for plain screens and **grouped** backgrounds for inset-grouped lists (Settings style). Primary is the whole view, secondary groups content within it, and tertiary groups within secondary.

| Token | Light | Dark (base) | Dark (elevated) |
|---|---|---|---|
| systemBackground | `#FFFFFF` | `#000000` | `#1C1C1E` |
| secondarySystemBackground | `#F2F2F7` | `#1C1C1E` | `#2C2C2E` |
| tertiarySystemBackground | `#FFFFFF` | `#2C2C2E` | `#3A3A3C` |
| systemGroupedBackground | `#F2F2F7` | `#000000` | `#1C1C1E` |
| secondarySystemGroupedBackground | `#FFFFFF` | `#1C1C1E` | `#2C2C2E` |
| tertiarySystemGroupedBackground | `#F2F2F7` | `#2C2C2E` | `#3A3A3C` |

**Elevated** variants apply in dark mode to anything presented *above* the base: sheets, popovers, modals, and side-by-side windows. Brighter means closer, which is how dark UI shows depth without shadows.

### Labels (text and symbols)

| Token | Light | Dark | Use |
|---|---|---|---|
| label | `#000000` | `#FFFFFF` | Primary content |
| secondaryLabel | `rgba(60,60,67,.60)` | `rgba(235,235,245,.60)` | Subtitles, supporting text |
| tertiaryLabel | `rgba(60,60,67,.30)` | `rgba(235,235,245,.30)` | Unavailable items, hints |
| quaternaryLabel | `rgba(60,60,67,.18)` | `rgba(235,235,245,.16)` | Watermarks only |
| placeholderText | `rgba(60,60,67,.30)` | `rgba(235,235,245,.30)` | Field placeholders |
| link | `#007AFF` | `#0984FF` | Text links (native) |

### Fills (for control backgrounds: segmented-control tracks, switch tracks, search fields, gray buttons)

| Token | Light | Dark |
|---|---|---|
| systemFill | `rgba(120,120,128,.20)` | `rgba(120,120,128,.36)` |
| secondarySystemFill | `rgba(120,120,128,.16)` | `rgba(120,120,128,.32)` |
| tertiarySystemFill | `rgba(118,118,128,.12)` | `rgba(118,118,128,.24)` |
| quaternarySystemFill | `rgba(116,116,128,.08)` | `rgba(118,118,128,.18)` |

Thin, small shapes use the stronger fills, and large areas the weaker ones.

### Separators

| Token | Light | Dark |
|---|---|---|
| separator (translucent hairline) | `rgba(60,60,67,.29)` | `rgba(84,84,88,.60)` |
| opaqueSeparator | `#C6C6C8` | `#38383A` |

Draw separators at 0.5px on 2x/3x screens (`border-width: 0.5px` renders as a hairline in Safari and Chrome on high-DPI displays; use 1px with a lighter color as the fallback). In inset-grouped lists, separators start at the text's leading edge, not the cell edge.

## 5. apple.com's web palette

What Apple's own web team ships. It's the right palette for marketing sites and great for web apps.

| Role | Light | Dark |
|---|---|---|
| Page background | `#FFFFFF` | `#000000` |
| Alternate section / surface | `#F5F5F7` | `#161617` (deep sections) / `#1D1D1F` (tiles) |
| Tile on alternate section | `#FFFFFF` | `#1D1D1F` / `#272729` |
| Primary text | `#1D1D1F` | `#F5F5F7` |
| Secondary text | `#6E6E73` | `#A1A1A6` |
| Tertiary text (large or decorative only) | `#86868B` | `#86868B` |
| Hairline / divider | `#D2D2D7` | `#424245` |
| Subtle fill (chips, input bg) | `#E8E8ED` | `#333336` |
| Link | `#0066CC` | `#2997FF` |
| Filled button | `#0071E3`, hover `#0076DF`, active `#006EDB`, white text | same |
| Nav bar (translucent) | `rgba(250,250,252,.8)` + `saturate(180%) blur(20px)` | `rgba(22,22,23,.8)` + same |
| Focus ring | `0 0 0 3px <page bg>, 0 0 0 5px #0071E3` | same |

Note that apple.com text is **`#1D1D1F`, not pure black**, on white. That softens the contrast slightly (16.8:1) and is part of the "expensive" feel. In dark mode, text is `#F5F5F7`, not pure white.

## 6. Which colors are safe for text (contrast results)

WCAG AA requires 4.5:1 for normal text and 3:1 for ≥18.66px bold or ≥24px regular text and for UI component boundaries. The HIG adds: strive for **7:1** for custom foreground/background pairs, especially small text.

**On white or `#F5F5F7`:**

| Color | Ratio on white | Verdict |
|---|---|---|
| `#1D1D1F` text | 16.83 | ✔ primary text |
| `#6E6E73` text | 5.07 (4.66 on `#F5F5F7`) | ✔ secondary text — the right choice on the web |
| `#86868B` | 3.62 | ✖ for body text; large or decorative only |
| iOS secondaryLabel `rgba(60,60,67,.6)` | 3.44 | ✖ for small text on the web; use `#6E6E73` |
| `#0066CC` link | 5.57 | ✔ links and blue text |
| System blue `#0088FF` | 3.52 | ✖ as text; ✔ for fills, icons, ≥24px text |
| Old blue `#007AFF` | 4.02 | ✖ for small text |
| IC blue `#1E6EF4` | 4.57 | ✔ |
| White on `#0071E3` | 4.70 | ✔ filled primary button |
| White on `#0088FF` | 3.52 | ✖ for normal-size labels; ✔ only for bold ≥18.66px |
| **Every IC-light system color** (`#E9152D`, `#C55300`, `#A16A00`, `#008932`, `#008575`, `#008198`, `#007EAE`, `#1E6EF4`, `#564ADE`, `#B02FC2`, `#E7124D`, `#956D51`) | 4.54–6.12 | ✔ — Apple tuned these to clear 4.5:1. **Use them for colored text and icons on light backgrounds** |
| Default light system colors (except indigo) | 1.5–4.2 | ✖ as text; fine as fills behind dark or bold text, and as large shapes |

**On black or `#1C1C1E`:** every *default dark* system color passes 4.5:1 on both. The tightest on `#1C1C1E` are purple (4.69), pink (4.83), and indigo (4.84), so recheck them on lighter elevated surfaces like `#2C2C2E`. `#A1A1A6` secondary text: 8.16 on black, 6.54 on `#1D1D1F`. `#86868B`: 5.80 on black. `#6E6E73` on black: 4.14 ✖, so don't reuse the light-mode secondary gray in dark mode.

**Practical mapping:**
- Destructive button text or link: `#E9152D` light / `#FF4245` dark (red).
- Success text: `#008932` light / `#30D158` dark.
- Warning text: `#C55300` light / `#FF9230` dark.
- Filled destructive button: white on `#E9152D` (4.56 ✔), not on `#FF383C` (3.57).

## 7. Accent color — choosing and deriving states

- **One accent.** Default to Apple blue (web-safe `#0071E3` for fills, `#0066CC` for text). Use a brand color only if it's truly the brand's, and check it against both backgrounds.
- **Where it goes:** primary buttons, links, the selected tab or segment, toggles in the on state (or system green), focus rings, unread badges, selection highlight, key data points. That's it.
- **Where it doesn't:** headings, body text emphasis, icons that aren't interactive, backgrounds of bars, multiple competing buttons.
- **Interaction states:** hover is a hair lighter, pressed a hair darker; Apple's own button moves `#0071E3` → `#0076DF` (hover) → `#006EDB` (active). Derive the states the same way:
  ```css
  --accent-hover:  color-mix(in oklab, var(--accent), white 4%);
  --accent-active: color-mix(in oklab, var(--accent), black 5%);
  --accent-tint:   color-mix(in oklab, var(--accent), transparent 85%); /* tinted button bg, selection */
  ```
- **Tinted (secondary) buttons:** the accent at about 12–15% alpha as the background, with full accent as the label color. This is the iOS "tinted" style.
- **On macOS** the user picks the system accent. Respect it when building for Mac (`AccentColor` in the asset catalog; CSS `accent-color: auto` for native form controls).

## 8. Dark Mode

- **Support it, and follow the system setting** (`prefers-color-scheme`). "Avoid offering an app-specific appearance setting." A manual override is acceptable on the web, but default to the system.
- **It isn't inversion.** Backgrounds get dimmer and foregrounds brighter, and colors shift (system colors get slightly brighter in dark mode).
- **Use base and elevated surfaces** to show layering: page `#000`, cards `#1C1C1E`, sheets and popovers `#2C2C2E`. Dark UI conveys depth with lighter surfaces, not shadows; shadows are nearly invisible on black.
- **Soften pure white imagery.** Slightly dim images with white backgrounds (`filter: brightness(.9)`) so they don't glow.
- **Text:** don't use pure `#FFF` for long reading on pure `#000`; prefer `#F5F5F7`. Keep secondary text at least `#A1A1A6`.
- **Icons:** symbols that use dynamic colors adapt automatically. Give custom artwork light and dark variants (`<picture>` with `prefers-color-scheme` sources).
- **Test with Increase Contrast and Reduce Transparency on,** separately and together.
- **Dark-only UI** is acceptable only for immersive media (video, photography, games), where "the UI recedes and helps people focus on the media."

CSS pattern:
```css
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { /* swap tokens */ } }
@media (prefers-contrast: more)     { :root { /* IC variants, stronger separators */ } }
```

## 9. Liquid Glass and color

- Liquid Glass has **no inherent color**; it takes on the colors behind it. Small elements (tab bars, toolbars) flip between light and dark appearances based on what's underneath. Large ones (sidebars, menus) don't flip — they become more opaque instead.
- Symbols and text on glass are **monochrome by default** (dark on light content, light on dark).
- **Color the background, not the label, for emphasis:** a prominent button gets the accent as its glass tint, with a white label. "Refrain from adding color to the background of multiple controls."
- Don't use control label colors similar to a colorful content layer; prefer monochrome bars over colorful content.
- Keep the **resting state legible.** Colorful content may scroll under the controls, but the top of the screen (the default scroll position) must keep the controls clear.

## 10. Wide color (Display P3)

Apple displays are P3, which can show more saturated colors than sRGB. Use that headroom for **imagery, gradients in the content layer, and large color fields**, not for text, whose contrast you verified in sRGB.
```css
.hero-field { background: #0071e3; }                       /* sRGB fallback */
@supports (color: color(display-p3 0 0 0)) {
  /* #0071e3 is exactly color(display-p3 0.187 0.436 0.860); push it slightly beyond sRGB: */
  .hero-field { background: color(display-p3 0.06 0.42 0.93); }
}
```
Export photos and illustrations with an embedded color profile (Display P3 for rich imagery, sRGB otherwise). Test that very similar P3 colors remain distinguishable on sRGB screens; gradients that use P3 colors can clip on sRGB displays.
