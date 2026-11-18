---
name: apple
description: Design and build websites, web apps, and native Apple-platform apps that look and feel like Apple's own design team made them. Grounded in the current Apple Human Interface Guidelines (2026 — Liquid Glass, iOS/macOS 27, iPhone Duo, the eight design principles) and the production design system of apple.com. Use this whenever someone wants a UI that feels premium, polished, "Apple-like", "clean and expensive", iOS- or macOS-native, glassy / Liquid Glass, minimal but warm — or asks to build, redesign, restyle, polish, or review a landing page, product page, marketing site, dashboard, settings screen, mobile web app, PWA, SwiftUI view, or component library "like Apple would", even if they never mention the HIG. Also invoked directly as /apple.
---

# Apple

Make interfaces that feel like they came out of Cupertino — not by copying Apple's look, but by making decisions the way Apple's designers do. Apple's guidance is a way of thinking: what matters most, what can go, how things should feel in the hand. Every rule below carries its reason so you can apply it to cases the rules don't cover.

Two sources of truth inform this skill, both researched directly from Apple:

- **The Human Interface Guidelines** (developer.apple.com/design, current through Sept 2026) — how Apple designs *product UI*: apps, tools, dashboards, settings, anything people *use*.
- **apple.com's production CSS** — how Apple's web team builds *marketing pages*: product stories, launches, landing pages, anything people *read and browse*.

## Step 1 — Identify the surface (this changes everything)

| Surface | Mode | Primary reference |
|---|---|---|
| Web app, dashboard, admin, SaaS tool, settings, mobile web app, PWA | **Product UI** — HIG conventions, dense-but-calm, components first | `references/components.md`, `references/layout.md` |
| Landing page, marketing site, product/launch page, portfolio, pricing page | **Marketing web** — apple.com storytelling, huge type, generous rhythm | `references/marketing-web.md` |
| Native iOS / iPadOS / macOS / visionOS / watchOS app (SwiftUI, UIKit, AppKit) | **Native** — use system components; they already *are* Apple design | `references/platforms.md` |

Many projects mix modes (a marketing page that leads into an app). Apply each mode to its own surface; share tokens across both.

## Step 2 — Decide purpose and feeling before pixels

Apple's 2026 design principles begin with **Purpose**: "Design starts with intention." Before laying anything out, answer:

1. **What is this screen for?** Name the single most important thing a person comes here to do or learn. It gets the most prominent position, size, and contrast. Everything else is subordinate or removed.
2. **What should it feel like?** Calm, confident, energized, playful, trustworthy? Pick one. Apple's guidance: "Know the feeling you want to evoke, and let it shape your design." That emotion chooses your accent color, motion character, and copy tone.
3. **What can go?** "Every feature asks for people's time, attention, and trust." Cut anything that doesn't serve the purpose. *Simplicity isn't minimalism* — hiding features in a menu isn't simple; having exactly enough is.

## Step 3 — Think in two layers

Apple's current design system (Liquid Glass, iOS 26+) splits every interface into:

- **Content layer** — the stuff people came for: text, media, data, cards, lists. This is where brand, color, and imagery live. It scrolls.
- **Functional layer** — navigation and controls (top bar, tab bar, toolbars, sidebar, menus, popovers, sheets). It floats above content on a translucent material, stays quiet, and defers to content.

Most "this doesn't look Apple" problems come from mixing the layers: glass on content cards, brand-colored nav bars that letterbox the content, decorative chrome competing with content. Keep controls quiet and put color into the content.

## Step 4 — Install the tokens, then build

Copy `assets/apple-tokens.css` into the project (or translate it to Tailwind, CSS-in-JS, or design tokens). It contains Apple's actual values: system colors (light, dark, increased contrast), apple.com's web type scale, spacing, radii, materials, springs, and accessibility media queries. For ready-made building blocks (buttons, glass bars, grouped lists, switches, segmented controls, sheets), add `assets/apple-components.css`, and see `assets/demo.html` for them assembled.

**Do not invent new values.** Off-scale sizes, random radii, and one-off grays are what make interfaces feel unconsidered. If you need something the tokens don't cover, derive it from them (for example, an inner radius = outer radius − padding).

For Tailwind, map the tokens into `theme.extend` (colors → CSS variables, fontSize → the text styles with their line-height and letter-spacing, borderRadius → the radius scale, transitionTimingFunction → the springs) instead of using Tailwind's defaults, whose grays, radii, and shadows don't match.

## Step 5 — The core rules

Each rule is short; the linked reference has the full detail and the reasoning.

### Typography → `references/typography.md`
- **Font:** the system stack (`-apple-system, BlinkMacSystemFont, …`), which renders San Francisco on Apple devices. SF fonts are licensed only for Apple-platform UI mockups and apps, so never self-host SF Pro on the web. Use Inter as the cross-platform fallback. `ui-serif` (New York), `ui-rounded`, and `ui-monospace` are the other system families.
- **Body text is 17px**, the iOS default. The minimum is 11pt in apps and 12px on the web. Text sizes come from a fixed scale; never pick arbitrary sizes.
- **Weights:** Regular 400 for reading, Semibold 600 for headlines (apple.com headlines are 600, not 800/900), Medium/Bold sparingly. The HIG says to avoid Ultralight, Thin, and Light — they're hard to read.
- **Tracking is size-specific:** slightly negative at body sizes (−0.022em at 17px) and close to zero at display sizes. Untracked SF on the web looks loose and generic.
- **Hierarchy comes from size, weight, and color** (primary, secondary, tertiary label), not extra typefaces. Use at most two families.
- **Left-align reading text.** Apple made alerts and onboarding "bolder and left-aligned" in 2025. Center only short marketing headlines.
- **Support text scaling:** use `rem`, reflow at 200% zoom, stack horizontally adjacent items when text grows, and never truncate essential text.

### Color → `references/color.md`
- **Neutral foundation and one accent.** Backgrounds are white, `#f5f5f7` and `#000`; text is `#1d1d1f`. The accent is reserved for interactivity, primary actions, and selection. Apple: "Apply your app's accent color judiciously… minimize its use on controls."
- **A color means one thing.** If blue means "tappable", never use blue for decoration or static text.
- **Never rely on color alone** for state: pair it with a symbol, label, or shape.
- **Every color has light, dark, and increased-contrast variants.** Dark Mode isn't inversion: backgrounds dim and foregrounds brighten. Use base and elevated surfaces so layered UI reads as depth.
- **Contrast:** at least 4.5:1 for normal text and 3:1 for 18px+ or bold text, with 7:1 as the target for custom small text. Apple's *default* system colors fail as text on white. Use the increased-contrast variants for colored text on light backgrounds, `#0066cc` for links, and `#0071e3` for filled buttons. Verify with `scripts/contrast.py`.

### Layout & shape → `references/layout.md`
- **Put the most important content at the top leading edge,** with secondary detail one interaction away (progressive disclosure).
- **Group with space before lines.** Proximity and negative space do most of the grouping; separators are hairline (0.5–1px) and only where needed.
- **Use a 4/8-based spacing scale** with generous margins: 16px gutters on phones, 20px+ on larger screens, and 80–160px between marketing sections.
- **Nest corners concentrically:** inner radius = outer radius − padding. Use three shape types: fixed radius, capsule (radius = half the height), and concentric. Pinched or flared nested corners are an instant tell.
- **Use capsules for touch-friendly buttons and controls,** and rounded rectangles for dense desktop controls.
- **Adapt to the space available, not the device type.** Keep the same functionality at every width; only how much is visible changes. A tab bar becomes a sidebar on wide screens.
- **Respect safe areas** (`env(safe-area-inset-*)`, `viewport-fit=cover`).

### Materials & Liquid Glass → `references/materials.md`
- **Glass belongs only to the functional layer:** nav bars, tab bars, toolbars, menus, popovers, sheets. Never use it on content cards, list rows, or backgrounds; the HIG says outright "Don't use Liquid Glass in the content layer."
- **Never put glass on glass.** Elements on top of glass use fills, vibrancy, or plain text.
- **Two variants:** *regular* (blurred, adaptive, the default) and *clear* (very transparent, only over rich media, with a ~35% dimming layer when the background is bright).
- **Tint only the primary action.** "When every element is tinted, nothing stands out."
- **Use scroll edge effects, not hard divider lines,** where content scrolls under floating bars.
- **Honor `prefers-reduced-transparency`** (fall back to frosted or opaque) and `prefers-contrast: more` (solid fill plus a visible border).

### Motion → `references/motion.md`
- **Motion must be purposeful and brief.** It explains where something came from, confirms an action, or shows state — never decoration.
- **Use springs, not linear or generic `ease`.** Default to critically damped (no overshoot). Allow bounce only when a gesture carries momentum (flick, throw, drag release). Presets are in the tokens; generate custom ones with `scripts/spring.py`.
- **Keep everything interruptible.** Never make people wait for an animation to finish before they can act, and keep frequent interactions nearly motionless.
- **Things grow out of their source** (menus pop from their button, sheets rise from the bottom edge, detail views zoom from their tile) and return the same way.
- **Animate only `transform`, `opacity`, and `filter`,** at 60fps or better. Jank reads as cheapness faster than any visual flaw.
- **Under `prefers-reduced-motion`,** replace movement with cross-fades and remove parallax, zoom, and bounce.

### Components → `references/components.md`
- **Familiar placement:** Back at the top leading edge; Cancel leading and Done trailing in sheets; the primary action trailing or at the bottom on mobile; search at the bottom on iPhone when there's room.
- **One or two prominent (filled) buttons per view.** Distinguish the preferred choice by *style*, not size.
- **Every interactive element has a pressed state and a ≥44×44px hit area** (28px minimum on dense desktop). Keep ~12px between bezelled controls and ~24px around borderless ones.
- **Destructive actions are red, never the default or primary button,** and always come with a Cancel.
- **Use standard symbols for standard actions** (share, trash, plus, ellipsis for More, magnifying glass). Don't reinvent icons for common verbs.
- **Use tab bars for navigation and toolbars for actions,** never the other way round. Never hide or disable tabs.
- **Prefer inline, nonmodal UI.** Show at most one sheet or popover at a time, and never an alert at launch.

### Writing → `references/writing.md`
- **Start button labels with a verb** ("Save", "Add to Bag", "Send"), never "OK" for a consequential action and never "Click here". Use title case for buttons, menus, and titles, and sentence case for descriptions and messages.
- **Make errors specific and fixable:** "Choose a password with at least 8 characters", not "Invalid password". No "Oops!", and no "we".
- **Be concise.** Read it out loud and cut every word that doesn't carry meaning. Use the plain, obvious word (Apple named the feature "Balance", not "Spending Power").

### Accessibility → `references/accessibility.md`
Accessibility isn't a pass at the end; Apple calls it "a priority from the start." The essentials are contrast, 44px targets, visible `:focus-visible` rings, full keyboard operation, semantic HTML with labels for icon-only buttons, the reduced motion, transparency and contrast media queries, 200% text, and never conveying meaning by color alone.

## The instant tells — what makes a UI look *not* Apple

If you see these in your output, fix them before showing anyone:

- Purple-to-blue "AI gradient" backgrounds, gradient text everywhere, neon glows.
- Heavy or dark drop shadows; borders on every card; boxes inside boxes inside boxes.
- Glassmorphism on content cards; glass stacked on glass; frosted panels everywhere.
- Gray text that fails contrast (`#999` on white); tiny 10–11px body copy on the web.
- Three or more font families; weights of 800/900 on everything; ALL-CAPS letter-spaced labels everywhere.
- Random corner radii; nested corners that don't relate; square buttons next to pill buttons.
- Brand-colored nav or tab bars that letterbox content; the logo repeated across the UI.
- The generic 3-column "icon in a colored circle + title + two lines" feature grid.
- Bouncy, slow, or decorative animation on every hover; anything that blocks input while animating.
- Emoji used as interface icons; inconsistent icon stroke weights; mixed icon families.
- A modal or permission prompt on first load; disabled-looking tabs; "Oops! Something went wrong."
- Center-aligned paragraphs; walls of text without hierarchy; five equally loud CTAs.

## Reference map — read what the task needs

| File | Read when |
|---|---|
| `references/principles.md` | Always worth a skim for non-trivial work: Apple's 8 principles turned into decision questions, plus fluid-interface principles |
| `references/typography.md` | Setting up fonts, type scale, tracking, Dynamic Type, text styles |
| `references/color.md` | Palettes, dark mode, accent color, contrast, exact system color values |
| `references/layout.md` | Grids, spacing, breakpoints, safe areas, concentric corners, hierarchy |
| `references/materials.md` | Liquid Glass, blur, translucency, scroll edge effects — with CSS recipes |
| `references/motion.md` | Springs, transitions, gestures, reduced motion |
| `references/components.md` | Building any control: buttons, bars, lists, sheets, menus, fields, toggles… |
| `references/patterns.md` | Flows: onboarding, loading, search, forms, settings, errors, empty states, AI features, charts |
| `references/writing.md` | Any UI copy, labels, errors, naming |
| `references/accessibility.md` | Always before shipping; deep detail on each requirement |
| `references/platforms.md` | Native SwiftUI/UIKit/AppKit work; platform differences (iPhone, iPhone Duo, iPad, Mac, Vision Pro, Watch, TV) |
| `references/marketing-web.md` | Landing, product, or launch pages in the apple.com style |
| `references/review-checklist.md` | Reviewing or auditing an existing design; the final pass on your own work |

## Step 6 — Verify like an Apple engineer would

Craft is "an uncompromising commitment to the details." Before calling anything done:

1. **Look at it.** Render the page (browser screenshot or preview) at about 390px, 834px, and 1440px wide. Check alignment, optical balance, consistent spacing, and nested corners.
2. **Switch appearance:** light, dark, and increased contrast (`prefers-contrast: more`). Nothing should become illegible or lose its edges.
3. **Check contrast** for every text/background pair with `python3 scripts/contrast.py <fg> <bg>`.
4. **Stress it:** 200% text zoom, a long localized string (German is ~30% longer), RTL if relevant, an empty state, an error state, a loading state, and slow network.
5. **Operate it** with only the keyboard and with reduced motion on. Every action should be reachable, focus should be visible, and nothing essential should depend on motion or hover.
6. **Run the checklist** in `references/review-checklist.md`.

## Guardrails

- **The goal is Apple-quality design for the user's own product,** not a clone of Apple. Don't use the Apple logo, Apple product names or imagery, Apple trademarks, or apple.com's copy, and never build a page that could pass as Apple's own.
- **SF Pro, New York, and SF Symbols** are licensed only for designing and building software for Apple platforms. In native Apple apps, use them freely (SF Symbols is the right icon set there). On the web, rely on the system font stack — which shows SF on Apple devices without distributing it — and use an open icon set with a consistent stroke, such as Lucide or Phosphor, drawn at a weight that matches the adjacent text.
- **When the user's brand conflicts with these defaults** (a brand typeface or a strong brand color), keep the brand. Apply it the Apple way: brand type for headlines with system text for body; brand color in the content layer and on the one primary action, not painted across the chrome.
