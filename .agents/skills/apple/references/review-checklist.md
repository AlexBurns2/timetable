# Review checklist — audit any UI against Apple's bar

Use this two ways: as the **final pass on your own work** (fix every ✖ before presenting), and to **review someone else's design** (report with the format at the bottom). It's ordered roughly by how much each area affects how "Apple" something feels.

## Contents
1. Purpose & hierarchy
2. Typography
3. Color & contrast
4. Layout, spacing & shape
5. Materials & layers
6. Components & conventions
7. Motion & feedback
8. Writing
9. Accessibility & adaptivity
10. Craft details
11. Review report format

---

## 1. Purpose & hierarchy
- [ ] Can you name the screen's single job in one sentence? Is that thing the most prominent element?
- [ ] Exactly one focal point per screen or section; nothing else competes at the same size, weight, and color.
- [ ] Everything on screen earns its place (try deleting each element mentally — would anyone miss it?).
- [ ] Secondary detail is one interaction away (progressive disclosure), not crammed in.
- [ ] Reading order (top-leading → bottom-trailing) matches importance.

## 2. Typography
- [ ] One family (the system stack) or brand + system — never three or more.
- [ ] All sizes come from the scale (17 body; the apple.com marketing scale or the HIG text styles).
- [ ] Letter-spacing is applied per size (negative at 17px, about zero at display sizes); not the browser default everywhere.
- [ ] Headline weight 600 (marketing) or bold large titles (app). No 100–300 weights for text; no 800–900 sprinkled around.
- [ ] Hierarchy uses size + weight + label color together.
- [ ] Reading text is left-aligned with a 50–75 character measure and about 1.47 line-height; headlines balanced.
- [ ] Tabular numerals in tables, prices, and timers.
- [ ] No ALL-CAPS letter-spaced labels scattered around; no centered paragraphs.

## 3. Color & contrast
- [ ] Neutral foundation (white, `#F5F5F7`, `#1D1D1F`, black); one accent, used only for interactivity, primary actions, and selection.
- [ ] Each color means one thing; the accent isn't used for decoration or static text.
- [ ] No state communicated by color alone.
- [ ] Every text/background pair passes (`scripts/contrast.py`): 4.5:1 normal, 3:1 large or bold; secondary text `#6E6E73` (light) / `#A1A1A6` (dark), never `#999`-ish.
- [ ] Colored text on light backgrounds uses the increased-contrast system colors; links use `#0066CC` / `#2997FF`.
- [ ] Dark mode is designed, not inverted: base vs elevated surfaces, `#F5F5F7` text, slightly dimmed white imagery.
- [ ] No "AI gradient" (purple→blue) backgrounds, gradient text, or neon glows in the UI layer.

## 4. Layout, spacing & shape
- [ ] All spacing is on the 4/8 scale; related things are closer than unrelated things; rhythm is consistent across repeated components.
- [ ] Generous margins (16px+ on phones; marketing sections 80–160px apart).
- [ ] Every radius comes from the scale; nested corners are concentric (inner = outer − padding); capsules for touch buttons.
- [ ] No boxes inside boxes inside boxes; grouping is done with space first.
- [ ] Optical alignment is checked (icons in buttons, play glyphs, text baselines against icons).
- [ ] Safe areas are respected (`viewport-fit=cover` + `env()` insets); nothing is under the notch, home indicator, or browser bars.
- [ ] Works at 320, 390, 744, 1024, 1440, and 1920px; same functionality at every width; no horizontal scroll.

## 5. Materials & layers
- [ ] Content layer vs functional layer is clear: controls float, content scrolls beneath.
- [ ] Glass only on bars, menus, popovers, sheets, and floating controls — never on content cards or list rows; never glass on glass.
- [ ] Only the primary action is tinted; bars are monochrome; brand color is in the content.
- [ ] A scroll edge effect (not a heavy divider or solid bar) appears where content passes under floating bars.
- [ ] Legibility on glass is verified over the worst-case background; fallbacks exist for reduced transparency, increased contrast, and no `backdrop-filter`.
- [ ] Shadows are soft and sparse (almost none in dark mode); no heavy or dark drop shadows.

## 6. Components & conventions
- [ ] Standard components in standard places: Back at the top leading edge, Cancel leading / Done trailing in sheets, primary action trailing, search placed per the platform.
- [ ] At most one or two prominent buttons per view; the preferred option is distinguished by style, not size.
- [ ] Every control has hover (pointer), pressed, focus, and disabled states, and a 44px (touch) / 28px (dense desktop) hit area.
- [ ] Tab bar for navigation (3–5 items, labelled, never disabled); toolbars for actions.
- [ ] Destructive actions are red, never default or primary, always with Cancel; undo is offered instead of confirmation for common actions.
- [ ] Standard icons for standard actions; one icon set; consistent stroke matching text weight; accessible labels on icon-only buttons.
- [ ] One modal at a time; no alerts or permission prompts on load; popovers become sheets on narrow screens.
- [ ] Lists for text, collections for images; list rows have the right accessory (chevron, switch, checkmark).

## 7. Motion & feedback
- [ ] Every animation has a job (orient, confirm, show state); nothing decorative loops.
- [ ] Springs or Apple curves, not `linear` or the default `ease`; no overshoot unless momentum.
- [ ] Everything is interruptible; no input is blocked waiting for animation; feedback starts on press.
- [ ] Things grow from their source and leave the way they came.
- [ ] Only `transform`, `opacity`, and `filter` are animated; smooth at 60fps on mid-range hardware.
- [ ] Reduced motion swaps movement for fades and stops autoplay and parallax.
- [ ] Loading shows content or skeletons immediately; progress is honest; status feedback is inline, not alerts.

## 8. Writing
- [ ] Buttons start with a verb, in title case; no "OK" or "Yes/No" for consequential choices; no "Click here".
- [ ] Errors say what happened and how to fix it, next to the problem; no "Oops", no "we", no blame.
- [ ] Concise: read it aloud and cut it. No hype adjectives, no jargon.
- [ ] Consistent terms throughout (one word per concept); capitalization rules consistent per element type.
- [ ] Empty states explain and offer a next step; permission requests explain the benefit in one sentence.

## 9. Accessibility & adaptivity
- [ ] Fully keyboard operable with visible focus; logical order; Esc closes overlays; focus returns to the trigger.
- [ ] Semantic HTML: landmarks, headings outline, real buttons and links, labelled inputs, `<dialog>` for modals.
- [ ] 200% zoom and 320px reflow work; text never clipped; layouts stack at large text.
- [ ] Light, dark, increased contrast, reduced transparency, reduced motion, and forced colors all checked.
- [ ] RTL mirrors correctly (logical properties); strings have room to grow 30–40%.
- [ ] Images have meaningful alt text; charts have text summaries; videos have captions and pause controls.

## 10. Craft details
- [ ] Nothing jitters on load (no layout shift, no font swap flash, images reserved).
- [ ] Hairlines are 0.5–1px and quiet; separators inset to the text in lists.
- [ ] Icons are pixel- and optically aligned with text; consistent sizes.
- [ ] Hover and press transitions are immediate (≤100ms in, spring out).
- [ ] Scroll behaviors feel native (momentum, snap points only where meaningful, no hijacking).
- [ ] Edge cases are designed: empty, loading, error, offline, very long names, zero/one/many items, slow network.
- [ ] Favicon, social preview image, page titles, and selection color (`::selection` tinted with the accent) are all considered.

---

## 11. Review report format

When reviewing a design or codebase, report like this: findings ranked by impact, each with the specific Apple principle behind it and a concrete fix.

```
## Apple design review — <screen or page>

**Overall:** <one-sentence verdict: what's working, what most holds it back>

### Highest impact
1. **<Issue>** — <where (file:line or element)>
   Why: <principle/guideline, e.g. "Liquid Glass belongs only in the functional layer (HIG Materials)">
   Fix: <specific change with values, e.g. "Replace card backdrop-filter with --bg-elevated; keep glass on the nav only">

### Medium
…

### Polish
…

### What's already right
- <keep these>
```
Keep it actionable: every finding names the element, the reason, and the exact fix (tokens, values, components). Don't pad it with generic advice.
