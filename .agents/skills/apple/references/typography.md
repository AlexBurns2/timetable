# Typography

Sources: HIG "Typography" (Dec 2025 revision), WWDC20 "The details of UI typography", WWDC26 "Communicate your brand identity", and apple.com production CSS (Oct 2026).

## Contents
1. Font families and stacks (web and native)
2. Licensing — what you may and may not do with SF
3. Web type scale (apple.com, responsive)
4. App type scale (HIG Dynamic Type)
5. Tracking (letter-spacing) by size
6. Rules that make type look Apple
7. Dynamic Type on the web
8. Using a brand font

---

## 1. Font families and stacks

Apple ships two families: **San Francisco** (sans serif: SF Pro, SF Compact, SF Mono, plus Rounded variants) and **New York** (serif, designed to pair with SF). All are variable fonts with *dynamic optical sizing*: the letterforms continuously adapt to the point size (the old Text/Display split now interpolates between about 17pt and 28pt).

### Web stacks (copy exactly)

```css
--font-sans:    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-rounded: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Nunito", "Inter", sans-serif;
--font-serif:   ui-serif, "New York", "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif;
--font-mono:    ui-monospace, "SF Mono", SFMono-Regular, Menlo, "JetBrains Mono", Consolas, "Liberation Mono", monospace;
```

- `-apple-system` and `BlinkMacSystemFont` resolve to SF Pro in Safari and Chrome on Apple devices. `ui-rounded`, `ui-serif`, and `ui-monospace` resolve to SF Pro Rounded, New York, and SF Mono — WebKit added these generic families specifically so web content could use the system designs.
- Optical sizing is automatic (`font-optical-sizing: auto` is the default). Don't disable it.
- **Inter is the cross-platform fallback** (SIL OFL, closest widely available match to SF's proportions). Load it only for non-Apple visitors to keep the look consistent:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap" rel="stylesheet">
  ```
  Apple devices never download it, because `-apple-system` matches first.
- On Windows, if Inter isn't loaded, Segoe UI Variable is the native, respectable choice.

### Native
- iOS, iPadOS, macOS, tvOS, visionOS: SF Pro. watchOS: SF Compact (SF Compact Rounded in complications).
- SwiftUI: `.font(.body)`, `.font(.title.bold())`, `.fontDesign(.rounded | .serif | .monospaced)`, `.fontWidth(.condensed | .expanded)`. Never embed the system fonts in an app bundle — reference them through the APIs.

## 2. Licensing — what you may and may not do with SF

- SF Pro, SF Compact, SF Mono, New York, and SF Symbols are licensed for creating mockups of, and building, **software for Apple platforms**.
- **On the web:** do not self-host or `@font-face` SF font files, and do not embed SF Symbols glyphs as SVGs or images. Using the *system font stack* is fine: the visitor's own device renders its own system font.
- Apple.com serves SF Pro web fonts because Apple owns them. That's not something to replicate.

## 3. Web type scale (apple.com, responsive)

Apple's web team ships one coherent scale. Headlines use **weight 600** and tight line-heights. Below about 19px the face behaves like SF Text (negative tracking); from 19px up it behaves like SF Display (slightly positive tracking that returns to negative at very large sizes). Breakpoints: `≤1068px` (medium) and `≤734px` (small).

| Role (apple.com class) | Large (>1068) | Medium (≤1068) | Small (≤734) | Weight |
|---|---|---|---|---|
| Hero / headline-super | 80 / 1.05 / −0.015em | 64 / 1.0625 / −0.009em | 48 / 1.0834 / −0.003em | 600 |
| Headline-elevated | 64 / 1.0625 / −0.009em | 48 / 1.0834 / −0.003em | 40 / 1.1 / 0 | 600 |
| Section headline | 56 / 1.0714 / −0.005em | 48 / 1.0834 / −0.003em | 32 / 1.125 / 0.004em | 600 |
| Headline | 48 / 1.0834 / −0.003em | 40 / 1.1 / 0 | 32 / 1.125 / 0.004em | 600 |
| Headline-reduced | 40 / 1.1 / 0 | 32 / 1.125 / 0.004em | 28 / 1.1428 / 0.007em | 600 |
| Eyebrow-super / tagline | 32 / 1.125 / 0.004em | 28 / 1.1428 / 0.007em | 24 / 1.1666 / 0.009em | 600 |
| Tile / card headline | 28 / 1.1428 / 0.007em | 24 / 1.1666 / 0.009em | 21 / 1.1904 / 0.011em | 600 |
| Eyebrow | 24 / 1.1666 / 0.009em | 21 / 1.1904 / 0.011em | 21 | 600 |
| Intro / lead paragraph | 21 / 1.381 / 0.011em | 21 | 19 / 1.4211 / 0.012em | 400 |
| Body | 17 / 1.4706 / −0.022em | 17 | 17 | 400 |
| Body (UI / tight) | 17 / 1.2353 / −0.022em | 17 | 14 / 1.2857 / −0.016em | 400–600 |
| Body-reduced / callout | 14 / 1.4286 / −0.016em | 14 | 14 | 400 |
| Caption / footnote / legal | 12 / 1.3334 / −0.01em | 12 | 12 | 400 |

Values are px / line-height (unitless) / letter-spacing. On the web, express sizes in `rem` (17px = 1.0625rem) so browser text-size settings are respected.

Notes from the source:
- Headlines are **semibold (600)**, never black or extra-bold. The impact comes from size, tight leading, and whitespace, not weight.
- Reading body copy stays 17px on phones; only dense tile and caption copy drops to 14px.
- Product name (eyebrow) above a big tagline is a signature pattern: the eyebrow is the smaller semibold line, the tagline the giant one.

## 4. App type scale (HIG Dynamic Type)

### iOS / iPadOS — "Large" (the default) size

| Text style | Weight | Size (pt) | Leading (pt) | Emphasized weight |
|---|---|---|---|---|
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subheadline | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

In web apps that should feel like iOS (mobile web apps, PWAs, app-like dashboards), use 1pt = 1px CSS. Navigation titles usually use the *emphasized* (bold) Large Title, while section headers and row titles use Headline or Body.

Dynamic Type range for Body: 14 (xSmall) → 15 → 16 → **17 (Large, default)** → 19 → 21 → 23 (xxxLarge), then accessibility sizes 28 / 33 / 40 / 47 / 53 (AX1–AX5). Large Title runs 31 → 34 → 40, and up to 60 at AX5. Layouts must survive Body at 53pt: that's ≥300% of default, so stack horizontally adjacent items, let rows grow, and reduce the number of columns.

### macOS built-in text styles

| Style | Weight | Size | Line height |
|---|---|---|---|
| Large Title | Regular | 26 | 32 |
| Title 1 | Regular | 22 | 26 |
| Title 2 | Regular | 17 | 22 |
| Title 3 | Regular | 15 | 20 |
| Headline | **Bold** | 13 | 16 |
| Body | Regular | 13 | 16 |
| Callout | Regular | 12 | 15 |
| Subheadline | Regular | 11 | 14 |
| Footnote | Regular | 10 | 13 |
| Caption 1 / 2 | Regular / Medium | 10 | 13 |

Desktop-class web apps (dense productivity tools, editors, admin panels) can use a 13–15px body, Mac-style. Marketing and reading surfaces use 17px.

### Default and minimum sizes (HIG)

| Platform | Default | Minimum |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |
| tvOS | 29 pt | 23 pt |
| Web (this skill) | 17 px reading / 14–15 px dense UI | 12 px |

## 5. Tracking (letter-spacing) by size

Apple tracks SF differently at every size; the system does it automatically in native apps. On the web you must apply it. Untracked SF or Inter at 17px looks loose and "default".

SF Pro (variable) tracking from the HIG, converted to CSS `em` (the HIG lists 1/1000 em):

| px | em | px | em | px | em |
|---|---|---|---|---|---|
| 10 | +0.012 | 17 | −0.026 | 24 | +0.003 |
| 11 | +0.006 | 18 | −0.025 | 28 | +0.014 |
| 12 | 0 | 19 | −0.024 | 32 | +0.013 |
| 13 | −0.006 | 20 | −0.023 | 40 | +0.010 |
| 14 | −0.011 | 21 | −0.018 | 48 | +0.008 |
| 15 | −0.016 | 22 | −0.012 | 64 | +0.004 |
| 16 | −0.020 | 23 | −0.004 | 80+ | 0 |

apple.com's web values are in the table in section 3. The two sources agree on body sizes (negative tracking) and differ at display sizes. The HIG values describe the *variable* system font and stay slightly positive up to 80pt. apple.com's values were tuned for its static SF Pro Display web fonts and go slightly negative above 40px. Which to use:
- **Marketing headlines →** apple.com's values. They're proven in production, and they keep the Inter fallback from looking loose at large sizes.
- **Recreating native iOS screens precisely** (an app's web version, mockups) **→** the HIG values. They reproduce what `-apple-system` would look like natively.
The tokens in `assets/apple-tokens.css` follow this split: `type-*` uses apple.com's values and `text-*` the HIG's.

**New York** tracks progressively tighter as it grows: 17px −0.004em, 22px −0.010em, 28px −0.012em, 40px −0.014em, 64px −0.015em, 96px+ −0.016em.

**If Inter is the primary font** (self-hosted for brand consistency), use Inter's own "dynamic metrics" curve — `tracking = −0.0223 + 0.185 × e^(−0.1745 × px)` em — which is tighter at display sizes: 12px 0, 14px −0.006em, 17px −0.013em, 21px −0.018em, 28px −0.021em, 40px+ −0.022em.

## 6. Rules that make type look Apple

1. **Use one family** — the system sans — for UI. Add New York (`ui-serif`) for long-form reading or editorial headlines if the voice calls for it. "Minimize the number of typefaces you use, even in a highly customized interface."
2. **Weights:** 400 for reading, 500 for UI labels that need a touch more presence, 600 for headlines and emphasized labels, 700 for iOS-style navigation large titles and emphasized titles. **Avoid 100–300** ("Ultralight, Thin, and Light… can be difficult to see, especially when text is small"). Avoid 800–900 except in a deliberate, single display moment.
3. **Express hierarchy with three levers at once:** size, weight, and color (label → secondary label → tertiary label). Keep the relative hierarchy when people scale text.
4. **Line-height:** about 1.47 for body paragraphs, about 1.2–1.25 for single-line UI text, and 1.05–1.15 for headlines. Avoid tight leading on 3+ lines (HIG: "If you need to display three or more lines of text, avoid tight leading").
5. **Measure:** 50–75 characters per line for reading (`max-width: 34em` to `40em`). Apple's marketing paragraphs sit in narrow centered columns inside 980px containers.
6. **Alignment:** leading-aligned for anything longer than two lines. Apple moved alerts and onboarding to "bolder and left-aligned" in 2025 for readability. Centered text is for short marketing headlines and taglines only.
7. **Balanced wrapping:** `text-wrap: balance` on headlines (avoids a lone word on the last line), `text-wrap: pretty` on paragraphs.
8. **Numbers:** `font-variant-numeric: tabular-nums` in tables, timers, prices that update, and anything that changes in place. Proportional numerals for prose.
9. **Small caps and labels:** Apple rarely uses ALL-CAPS letter-spaced labels. If you need an overline or eyebrow, use semibold sentence case in the accent or secondary color. Grouped-list section headers on iOS are small (13px), regular weight, and secondary color.
10. **Truncation:** avoid truncating at large text sizes. Allow wrapping; for long single-line items, a middle ellipsis can preserve both ends of a filename or path.
11. **Rendering:** `-webkit-font-smoothing: antialiased` on dark backgrounds on macOS (apple.com sets it); `text-rendering: optimizeLegibility` is fine for headlines.
12. **Emphasis:** use the emphasized weight of the same style (bold trait) rather than jumping to a larger size.
13. **Symbols with text:** match the icon's weight to the adjacent text's weight. SF Symbols do this automatically; on the web, pick an icon stroke width that matches (about 1.5–2px at 20–24px for regular text).

## 7. Dynamic Type on the web

- **Baseline:** use `rem` for every font size and the spacing tied to text, with the root left at the browser default (16px). The browser's text-size setting and zoom then scale the whole UI. The tokens are built this way (body = 1.0625rem = 17px).
- **Opt-in for app-like PWAs on iOS:** Safari can follow the system Dynamic Type setting through WebKit's system font keywords. Other browsers ignore them:
  ```css
  @supports (font: -apple-system-body) {
    html { font: -apple-system-body; font-family: var(--font-sans); }  /* root = the user's Body size (17px at default) */
  }
  ```
  This changes what `1rem` means (17px at default instead of 16px), so author sizes relative to 17px under it: body `1rem`, subheadline `0.882rem` (15/17), footnote `0.765rem` (13/17), title 1 `1.647rem` (28/17), large title `2rem` (34/17). Don't combine it with the 16px-based token sizes, or everything renders about 6% too large. Related keywords (`-apple-system-headline`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`, `-apple-system-caption2`) let individual elements track their own text style.
- Test at 200% browser zoom: nothing may overlap or clip. Horizontally adjacent items should wrap or stack.

## 8. Using a brand font

From HIG "Branding" and WWDC26: brand fonts work best for **headlines and display moments**, with system fonts for body, captions, and controls, which "are designed for optimal legibility at small sizes." Requirements:
- The font must be legible at every size you use it, and must support bold text and scaling (Dynamic Type natively; rem and zoom on the web).
- Give it its own tracking and line-height tuning. Don't inherit SF's.
- Keep the hierarchy discipline: brand font for titles, everything else system.
