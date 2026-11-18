# Layout, spacing & shape

Sources: HIG "Layout" (Sept 2026), "Accessibility", "Designing for iOS/iPadOS/macOS/iPhone Duo", "Sidebars", "Tab bars", "Scroll views"; WWDC25 "Get to know the new design system"; apple.com production CSS.

## Contents
1. Visual hierarchy
2. Spacing system
3. Widths, margins & breakpoints
4. Adaptivity (size classes on the web)
5. Safe areas & full-bleed content
6. Shape: concentricity, capsules, radius scale
7. Hit targets & control spacing
8. Grids, lists, and density
9. Platform-specific layout notes

---

## 1. Visual hierarchy

From the HIG, nearly verbatim:
- **Order content by importance.** People read top to bottom and leading to trailing, so the most important items go near the top leading edge.
- **Align elements to make them easy to scan, and indent to show hierarchy.** Aligned items read as related; indented items read as subordinate.
- **Group related items** with negative space, container shapes, or separator lines, in that order of preference.
- **Use progressive disclosure.** Too many choices make finding anything harder. Use disclosure controls, menus, and nested views, or scrollable sections for media.
- **Differentiate controls from content.** Controls live on the floating glass layer; content lives below. Use a scroll edge effect, not a solid or semi-opaque bar background, to lift controls above scrolling content.
- **Extend full-screen backgrounds under the bars** (sidebar, toolbar, tab bar) so they fill the window.

Also:
- **One focal point per screen.** If two things compete for "most important", demote one (smaller, secondary color, or lower).
- **Partial content at an edge signals more.** Let the next card peek in a horizontal carousel; don't rely on scroll indicators alone.

## 2. Spacing system

Use a 4px base unit with the spacing concentrated on an 8px rhythm:

| Token | px | Typical use |
|---|---|---|
| `--space-1` | 4 | icon–label gap in dense UI, hairline insets |
| `--space-2` | 8 | related items in a group, chip padding |
| `--space-3` | 12 | padding between bezelled controls (HIG: ~12pt) |
| `--space-4` | 16 | phone side margins, list row horizontal inset, card padding (small) |
| `--space-5` | 20 | regular-width margins, card padding |
| `--space-6` | 24 | space around borderless controls (HIG: ~24pt), card padding (large) |
| `--space-8` | 32 | between groups of content |
| `--space-10` | 40 | between sections in an app |
| `--space-12` | 48 | above section headers on marketing pages |
| `--space-16` | 64 | |
| `--space-20` | 80 | marketing section padding (small screens) |
| `--space-30` | 120 | marketing section padding (medium) |
| `--space-40` | 160 | marketing section padding (large), hero breathing room |

Rules:
- **Space encodes relationship.** Tighter means related, wider means separate. If everything is evenly spaced, nothing is grouped.
- **Spacing grows with the container.** Marketing pages breathe (80–160px between sections). App screens are more compact (24–40px between groups) but never cramped.
- **Optical alignment beats mathematical alignment** where they disagree. Asymmetric icons (play triangles, download arrows) need to be nudged to look centered. Apple centers views "mathematically when it makes sense, and subtly offset when it doesn't."
- **Keep vertical rhythm consistent.** If one card's title-to-body gap is 8px, every card's is.

## 3. Widths, margins & breakpoints

### apple.com's content widths
```css
.content { margin-inline: auto; width: 980px; }               /* > 1068px */
@media (max-width: 1068px) { .content { width: 692px; } }      /* medium */
@media (max-width: 734px)  { .content { width: 87.5%; } }      /* small: 6.25% gutter each side */
```
Wide galleries and app shells go up to about 1440px. Reading text sits inside 980px containers in narrower columns of about 600–700px.

### Breakpoints (apple.com's, which map neatly onto iOS size classes)
| Name | Range | Size-class analogue |
|---|---|---|
| small | ≤ 734px | compact width (iPhone portrait, narrow windows) |
| medium | 735–1068px | regular width, narrow (iPad portrait, split windows) |
| large | 1069–1440px | regular width (laptops) |
| xlarge | ≥ 1441px | large desktops (more whitespace; don't stretch line lengths) |

### App margins
- Phone: 16px side margins (20px on large phones). Inset-grouped lists inset by 16–20px.
- Tablet and desktop: 20–32px, with content often capped by a readable width.
- **Avoid fixed widths.** On iPhone Duo and resizable iPad and Mac windows, the same view appears at many sizes. Use fluid layouts with `min()`, `clamp()`, and container queries.

## 4. Adaptivity (size classes on the web)

- **Decide layout by available space, never by device type or orientation** (HIG: "Determine layout based on size classes, not device type or orientation"). On the web, prefer **container queries** for components and media queries for page structure.
- **Keep functionality identical at every size;** only *how much is visible* changes. Wider spaces can switch a tab bar to a sidebar, show a second column (list + detail), or pull overflow-menu items into the toolbar.
- **Changes must stay recognizable.** Resizing shouldn't reshuffle the interface. Move only what's needed, and keep controls in similar relative positions (iPhone Duo guidance: "favor small adjustments over rearrangement").
- **Test the extremes first:** the smallest (320px wide, 200% text) and the largest (2560px) layouts.
- **Large text:** horizontally adjacent views stack vertically; single-line rows grow to multiple lines; multi-column text drops to one column.
- **Foldables and dual screens** (iPhone Duo, Android foldables): keep important content out of the hinge or fold region; prefer an even number of grid columns so content splits cleanly. On the web, the Viewport Segments API (`@media (horizontal-viewport-segments: 2)`, `env(viewport-segment-width 0 0)`) exposes the fold where browsers support it.

## 5. Safe areas & full-bleed content

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
```css
.app-bar    { padding-top: env(safe-area-inset-top); }
.tab-bar    { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
.page       { padding-inline: max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right)); }
```
- Background imagery and color run edge to edge (under the bars and into the safe area); **interactive content and text stay inside** the safe area.
- Use `100dvh` / `100svh` instead of `100vh` for full-height mobile layouts (`vh` ignores the collapsing browser bars).
- If a sidebar would cover part of a full-bleed hero image, Apple mirrors and blurs the image under the sidebar (the "background extension effect"). The web recipe is in `materials.md`.
- **macOS and desktop windows:** don't put critical controls or information at the very bottom of a window, because people often drag windows partly off-screen. Don't place content behind the camera housing.

## 6. Shape: concentricity, capsules, radius scale

The defining geometric idea of Apple's current design system: **"There's a quiet geometry to how our shapes fit together, driven by concentricity."** Hardware corners, window corners, sheet corners, and the controls inside them share a common center, so nothing looks pinched or flared.

### Three shape types
1. **Fixed** — a constant corner radius. Use for standalone elements: cards, images, tiles, inputs on desktop.
2. **Capsule** — radius = half the height (`border-radius: 999px`). Use for touch-friendly buttons, pills, search fields on mobile, segmented controls, switches, sliders, tab bars. "Capsules bring focus and clarity to touch-friendly layouts, but in dense desktop environments they're best used for standout actions."
3. **Concentric** — radius = parent radius − padding. Use for anything nested inside a rounded container.

### The rule
```
inner radius = outer radius − gap between them
```
```css
.card       { --r: 28px; --pad: 12px; border-radius: var(--r); padding: var(--pad); }
.card > img { border-radius: max(var(--r) - var(--pad), 6px); } /* concentric, with a fallback minimum */
```
- If the gap is as large as the outer radius, the inner element can be square-cornered or use a small fixed radius. That's fine.
- "Use a concentric shape with a fallback radius" for components that appear both nested and standalone.
- **Near screen edges on phones,** use a capsule with extra margin from the edge. On tablet and desktop, align floating controls concentrically with the window corner.

### Radius scale (web)
| Token | px | Use |
|---|---|---|
| `--radius-xs` | 6 | badges, tags, small thumbnails, checkboxes (≈4–6) |
| `--radius-sm` | 10 | dense desktop controls, menu items, small inputs |
| `--radius-md` | 14 | inputs, small cards, popover content items |
| `--radius-lg` | 18 | cards and tiles (apple.com's default tile radius) |
| `--radius-xl` | 28 | large tiles, sheets, modals, popovers, menus (apple.com's large tile radius) |
| `--radius-2xl` | 36 | full-width floating panels on large screens |
| `--radius-capsule` | 999 | buttons, pills, search fields, tab bar, segmented control, switches |

Rules:
- **Pick from the scale.** Mixing 7px, 9px, 13px, and 16px radii is one of the clearest "not Apple" signals.
- Larger elements get larger radii; a 28px radius on a 40px-tall chip, or a 6px radius on a full-width card, both look wrong.
- macOS controls: mini, small, and medium controls use rounded rectangles; large and extra-large controls are capsules.
- Corner smoothing (the "squircle"): Apple's hardware and icons use continuous curvature. CSS `corner-shape: squircle` (Chromium 139+) approximates it as a progressive enhancement. Standard `border-radius` is an acceptable fallback; never use SVG-masking hacks for it in production UI.

## 7. Hit targets & control spacing

| Platform | Default control size | Minimum |
|---|---|---|
| iOS, iPadOS | 44 × 44 pt | 28 × 28 pt |
| macOS | 28 × 28 pt | 20 × 20 pt |
| visionOS | 60 × 60 pt | 28 × 28 pt (keep centers ≥ 60pt apart) |
| watchOS | 44 × 44 pt | 28 × 28 pt |
| tvOS | 66 × 66 pt | 56 × 56 pt |
| Web, touch | 44 × 44 px | 24 × 24 px with spacing (WCAG 2.2 AA) |

- "Consider spacing between controls as important as size": about **12pt of padding around bezelled elements** and about **24pt around borderless ones**.
- A small visible glyph can have a larger invisible hit area (`padding`, or an `::after` with `inset: -10px`).
- Make adjacent bar buttons' hit regions contiguous, with no dead gaps between them.

## 8. Grids, lists, and density

- **Lists for text, collections for images.** "Prefer displaying text in a list"; "collections are ideal for showing image-based content."
- **iOS-style inset-grouped list:** a rounded section group (about 10–12px before iOS 26; noticeably rounder in the Liquid Glass era, so use `--radius-lg` of 18px or more and keep it concentric with any container). Rows are at least 44px tall with 16px horizontal insets. Separators are inset to the text's leading edge and absent on the last row. The section header is 13px secondary text, and the footer note is 13px secondary text below the group.
- **Card grids:** use 12–24px gutters (apple.com's homepage tiles use tight 12px gutters with 18–28px radii). Keep equal heights per row and an even number of columns where folding may occur.
- **Density by context:** phone UIs are comfortable and touch-first; Mac-class web apps can be denser (13–15px text, 28–32px rows, 8–12px gaps) but still aligned and spacious around groups. "Maintain a comfortable information density that doesn't make people strain."
- **Avoid boxes inside boxes.** One level of container is usually enough; use spacing and type for further grouping.

## 9. Platform-specific layout notes

- **iPhone:** controls in the middle or bottom of the screen are easiest to reach. Swiping to go back and swiping list rows for actions matter. The tab bar floats at the bottom; search can sit at the bottom.
- **iPhone Duo:** the outer display is wider and shorter; toolbars and tab bars move to the side (a vertical axis). Use size classes and safe areas, with no fixed widths. Show an extra level of hierarchy on the inner display (list + detail). Even-numbered column grids divide cleanly at the fold.
- **iPad:** a sidebar-adaptable tab bar (tab bar ↔ sidebar), minimal modality, controls easy to reach but not in the way. Support pointer, keyboard, and Apple Pencil. Windows resize fluidly.
- **Mac:** use large displays to show more content in fewer nested levels, with less modality. Toolbars sit at the top, every toolbar command is also in the menu bar, keyboard shortcuts are everywhere, and windows are resizable with full-screen support.
- **visionOS:** keep content centered at large window sizes, put buttons' centers at least 60pt apart, and lay things out horizontally rather than vertically to avoid neck strain.
