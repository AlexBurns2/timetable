# Accessibility

Sources: HIG "Accessibility" (June 2025), "VoiceOver", "Inclusion", "Typography › Supporting Dynamic Type", "Motion", "Materials", "Dark Mode", "Charts"; WWDC25 "Meet Liquid Glass" (accessibility adaptations). Apple's framing: an accessible interface is **intuitive, perceivable, and adaptable**, and accessibility is "a priority from the start" — part of the design, not a fix at the end.

## Contents
1. Vision: text size, contrast, color
2. Motion & transparency preferences
3. Mobility: targets, spacing, gestures, keyboard
4. Screen readers (VoiceOver ↔ web semantics)
5. Hearing
6. Cognitive
7. Internationalization & RTL
8. Test protocol

---

## 1. Vision

**Text size**
- Let text grow to **at least 200%** (140% on watchOS) without loss of content or function. Web: `rem` units, no fixed-height text containers, reflow at 320 CSS px wide, and nothing clipped at 200% zoom.
- **Use the recommended defaults** (17px body, 12px minimum on the web), and go larger with thin custom fonts.
- When text gets large: stack side-by-side items, let rows grow, reduce columns, and avoid truncation. "Aim to display as much useful text at the largest accessibility font size as you do at the largest standard font size."
- Enlarge meaningful icons with the text (size icons in `em`).
- Keep the hierarchy consistent at every size; primary elements stay at the top.

**Contrast** (WCAG AA, which Apple's Accessibility Inspector also uses)
| Text | Minimum |
|---|---|
| Up to 17pt (≈ <24px regular / <18.66px bold) | 4.5:1 |
| 18pt+ / large | 3:1 |
| Bold text of any size (per HIG) | 3:1 |
| Non-text UI (control boundaries, focus rings, icons that convey meaning) | 3:1 |
| Apple's target for custom colors, especially small text | **7:1** |

Check every pair in light and dark mode: `python3 scripts/contrast.py <fg> <bg>`. If a design can't meet the minimum by default, it must at least provide higher contrast under `prefers-contrast: more`.

**Color**
- Never color alone: add shapes, labels, symbols, underlines on links in body text, and patterns in charts. Red–green and blue–orange are the problem pairs.
- Prefer system-defined (token) colors that already have increased-contrast variants.
- Consider letting people customize chart and status colors.

## 2. Motion & transparency preferences

```css
@media (prefers-reduced-motion: reduce)      { /* fades instead of movement; no parallax, zoom, bounce, autoplay */ }
@media (prefers-reduced-transparency: reduce){ /* opaque or frosted surfaces instead of glass */ }
@media (prefers-contrast: more)              { /* IC colors, solid surfaces, visible borders, thicker separators */ }
@media (forced-colors: active)               { /* Windows High Contrast: use system colors, keep borders and focus */ }
```
- **Reduce Motion:** tighten springs (no bounce), track gestures directly, no z-axis or depth animation, replace x/y/z movement with fades, no animated blurs. Flashing or blinking content must stay below 3 flashes per second.
- **Liquid Glass adaptations** (built in natively; manual on the web): Reduce Transparency makes glass frostier and more opaque. Increase Contrast makes elements predominantly black or white with a contrasting border. Reduce Motion disables the elastic properties.
- **Autoplay:** don't autoplay audio. Autoplay muted video only with visible pause controls, and stop it under reduced motion.

## 3. Mobility: targets, spacing, gestures, keyboard

- **Targets:** 44×44px on touch (minimum 28px for dense desktop; WCAG 2.2 AA's floor is 24×24 with spacing). Expand hit areas beyond small visuals.
- **Spacing:** about 12px around bezelled controls and about 24px around borderless ones, so people don't hit the neighbor.
- **Simple gestures for common actions;** no multi-finger or complex-path gestures for anything essential.
- **Always provide a non-gesture alternative:** a button for swipe-to-delete, Move… for drag and drop, visible controls for anything revealed by hover.
- **Full keyboard operation:**
  - Every interactive element is reachable with Tab, in a logical order matching the visual order.
  - **Visible focus:** a 2–3px accent ring with offset (`:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }`), or Apple's web pattern `box-shadow: 0 0 0 3px var(--bg), 0 0 0 5px var(--accent)`. Never `outline: none` without a replacement.
  - Composite widgets (menus, tabs, segmented controls, listboxes) use arrow keys inside and Tab between widgets.
  - Esc closes popovers, menus, and sheets, and focus returns to the trigger.
  - Standard shortcuts work and aren't overridden: ⌘C/⌘V/⌘Z, ⌘F (find), ⌘, (settings), Return (default button), Esc and ⌘. (cancel).
  - Provide a skip link to the main content on content-heavy sites.
- **Voice Control:** visible labels match accessible names, so people can say "Tap Send".

## 4. Screen readers (VoiceOver ↔ web semantics)

VoiceOver on Apple devices reads the web's accessibility tree, so semantic HTML *is* VoiceOver support.
| Need | Web implementation |
|---|---|
| Buttons and links | `<button>` for actions, `<a href>` for navigation. Never a clickable `<div>` |
| Icon-only control | `aria-label="Share"`; decorative icons get `aria-hidden="true"` |
| Images | Meaningful `alt` describing the content's purpose; `alt=""` for decoration |
| Headings | One `h1`, then a logical `h2`–`h3` outline; VoiceOver users navigate by headings |
| Landmarks | `<header> <nav aria-label> <main> <aside> <footer>` |
| Tab bar (navigation) | `<nav>` with links and `aria-current="page"` |
| Segmented control | Radio group (`role="radiogroup"`, arrow keys), or `role="tablist"` if it swaps panels |
| Switch | `<input type="checkbox" role="switch">` with a visible label |
| Sheets and alerts | `<dialog>` + `showModal()` (focus trap, Esc); `role="alertdialog"` for alerts; a labelled title |
| Menus | Button with `aria-haspopup="menu"` and `aria-expanded`; items `role="menuitem"`, arrow-key navigable |
| Live status | `aria-live="polite"` (status) or `"assertive"` (errors); `role="status"` for toasts |
| Forms | `<label for>`, `aria-describedby` for hints and errors, `aria-invalid="true"` on errors |
| Charts | A text summary of the takeaway plus accessible data (table or labelled points); hide axis tick labels from assistive tech when a summary covers them |

Labels describe **what** something is or does, not what it looks like, and don't include the control type ("Share", not "Share button"). Keep them short and specific.

## 5. Hearing

- Captions for video with dialogue; transcripts for audio and long-form media; audio descriptions where visuals carry the story.
- Never convey information by sound alone: pair sounds with visual cues (and haptics in native apps).

## 6. Cognitive

- Keep interactions simple, familiar, and consistent; prefer standard gestures and components.
- **Minimize time limits** and auto-dismissing UI. Prefer explicit dismissal; if something times out, let people extend it.
- Let people control media playback; respect reduced motion and autoplay preferences.
- Break complex flows into steps, with one main decision per screen.
- **Confirm before destructive, hard-to-reverse actions,** and make undo available.
- Plain language (see `writing.md`).

## 7. Internationalization & RTL

- Use **CSS logical properties** (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`) so layouts mirror automatically under `dir="rtl"`.
- **Mirror** directional icons (back chevrons, progress arrows, text-flow glyphs) in RTL. **Don't mirror** clocks, media playback controls, checkmarks, logos, or images of real objects.
- Allow 30–40% text expansion; never fix widths around English strings.
- Format dates, numbers, and currencies with the `Intl` APIs; don't assume name order or address formats.
- Arabic, Hebrew, Thai, and Indic scripts need more line height. Never set fixed `line-height` in px on multilingual text.

## 8. Test protocol

1. **Keyboard only:** complete the primary task without a mouse. Is the focus always visible and logical?
2. **Screen reader:** VoiceOver (⌘F5 on Mac; triple-click the side button on iPhone) or NVDA. Can you understand and complete the primary task? Are images and icons labelled?
3. **Zoom 200% and 400%** (reflow at 320px). Nothing lost or overlapping?
4. **Preferences:** dark mode, reduced motion, reduced transparency, increased contrast (macOS: System Settings › Accessibility › Display), Windows high contrast.
5. **Contrast:** run `scripts/contrast.py` on every text/background and icon/background pair.
6. **Color blindness:** view in grayscale (macOS Color Filters or browser devtools emulation). Is every state still distinguishable?
7. **Automated:** axe or Lighthouse for the basics, never as the only check.
