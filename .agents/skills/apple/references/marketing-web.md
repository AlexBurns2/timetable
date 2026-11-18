# Marketing web — the apple.com way

Source: apple.com production HTML and CSS (homepage, iPhone, MacBook Pro, AirPods Pro pages, captured Oct 2026), cross-checked against HIG typography, color, and motion guidance. Use this for landing pages, product and launch pages, pricing pages, portfolios, and company sites.

**Guardrail:** this is a *craft* reference. Build the user's brand with this level of quality and these structural ideas. Don't reuse Apple's logo, product names, product imagery, taglines, or copy, and don't make anything that could be mistaken for an Apple page.

## Contents
1. What makes apple.com feel the way it does
2. Page anatomy
3. Navigation
4. Hero patterns
5. Section patterns
6. Type, color, spacing (marketing tokens)
7. Imagery and media
8. Motion and scroll storytelling
9. Copywriting
10. Calls to action
11. Footer and legal
12. Performance and polish checklist

---

## 1. What makes apple.com feel the way it does

- **The product is the hero; the interface disappears.** Neutral backgrounds (white, `#F5F5F7`, black), no decorative chrome, no gradients for their own sake.
- **Typographic confidence:** enormous semibold headlines with tight leading, set in just one family, plus short lines and a lot of space.
- **Rhythm:** sections alternate between `#FFF` and `#F5F5F7` (or full black for dramatic chapters). Each section makes one point.
- **Restraint with color:** the accent is reserved for links and buttons. Color comes from photography and product renders.
- **Precision:** every size, line-height, and letter-spacing value comes from one scale; every tile shares the same radius; everything aligns.
- **Motion that reveals, not decorates:** product renders rotate, pin, and assemble as you scroll; text fades up once.

## 2. Page anatomy

A typical product page, in order (each line is a `<section>`):
1. **Global nav** (thin, translucent, site-wide).
2. **Local nav** (sticky; product name + chapter links + "Buy" pill).
3. **Welcome / hero:** product-name eyebrow (an `h1`, small and semibold) + giant marquee headline (`h2`) + optional short subhead + CTAs + hero media.
4. **Highlights:** "Get the highlights." — a horizontally scrolling media-card gallery, each card a short caption over a video or image, with a play/pause control.
5. **Closer look:** a product viewer (switch colors or angles).
6. **Feature chapters** (repeated): a topic eyebrow ("Audio performance") + an expressive headline ("The sound of science.") + 1–2 short paragraphs + media. Within a chapter: caption tiles in a grid, stat callouts, and inline media. Chapters alternate background (`background-alt`).
7. **Comparison / lineup:** "Explore the lineup." — product tiles (image, name, one-line positioning, price, "Learn more" + "Buy").
8. **Why buy here:** a horizontal gallery of feature cards (small label, headline, body), each opening a modal for detail.
9. **Values:** icon cards (environment, privacy, accessibility) with "Learn more about…" links.
10. **Index footer:** "Keep exploring" links plus the legal footnotes ("sosumi") with numbered references.

The homepage is a **stack of full-width promo tiles** (alternating light and dark): product name, one-line subhead, two CTAs ("Learn more" + "Buy"), and a big image. Below that, a grid of half-width tiles with the same anatomy.

## 3. Navigation

- **Global nav:** 44px tall (48px on small screens), with links at 12px. The background is `rgba(250,250,252,.8)` with `backdrop-filter: saturate(180%) blur(20px)` (dark: `rgba(22,22,23,.8)`); link color `rgba(0,0,0,.8)`, hover full black; flyout menus open with `cubic-bezier(.4,0,.6,1)` over about 320ms. On small screens the links collapse into a menu.
- **Local / product nav:** sticky below the global nav, 52px. The product name (21px semibold) sits at the leading edge; chapter links (12px) and a small filled "Buy" capsule (12px text, about 28px tall) at the trailing edge. It goes translucent once it sticks.
- **Minimal:** no mega-menus with icons, no hamburger on desktop, no more than 7–9 top-level items.

## 4. Hero patterns

1. **Typographic + product render** (the default): centered eyebrow (28–32px semibold product name) → headline (64–80px semibold, `text-wrap: balance`) → a short subhead (21–28px, in secondary or a single brand color) → CTAs → a large render or video, often full-bleed.
2. **Full-bleed media with text overlay:** video or photo filling the viewport (use `100svh` minus the nav), text on a quiet region, with a scrim if needed. Light text on dark media.
3. **Split, for software and SaaS:** headline and CTAs at the leading edge, a large product screenshot in a device-free frame (rounded `--radius-xl` with a soft shadow) at the trailing edge, overflowing slightly.

Rules: one headline, one supporting line, at most two CTAs. The hero must make sense with images off. Don't autoplay with sound.

## 5. Section patterns

- **Section header:** an optional eyebrow (24–32px semibold, colored or secondary) above a headline (48–56px semibold), with an intro paragraph (21px, secondary) in a narrow column. **Center-aligned** for chapter openers; **leading-aligned** for denser sections.
- **Media-card gallery:** horizontally scrolling cards (`scroll-snap-type: x mandatory`) about 70–80% of the viewport wide on mobile and fixed widths on desktop, with `--radius-xl`, a caption at the top or bottom in 17–21px semibold, and previous/next arrow buttons plus play/pause for video. Scrollbar hidden; the arrows are 36px circular gray buttons.
- **Caption tiles grid:** two or three columns of tiles (`--radius-lg` or `--radius-xl`, white on `#F5F5F7` or `#1D1D1F` on black), each with a short bold lead-in followed by regular text in the same paragraph ("**Adaptive Audio.** Automatically tunes noise control…").
- **Stat callouts:** a large number (48–80px semibold, sometimes gradient-colored *within the content layer*) + a small label ("Up to 24 hrs battery life"), in rows of two to four.
- **Feature cards that open modals:** a card with label, headline, and a ⊕ button that opens a full-screen modal with more depth. Keeps the page scannable.
- **Comparison tiles:** product images bottom-aligned on a shared baseline, names, positioning lines, color dots, "From $X", "Learn more" link + "Buy" button.
- **Sticky storytelling:** a pinned media panel while text steps scroll past (chapters change the media). Use sparingly; one or two per page.

## 6. Type, color, spacing (marketing tokens)

Type (see `typography.md §3` for the full responsive table): headline-super 80→64→48, headline 48→40→32, eyebrow 28→24→21, intro 21→19, body 17, caption 12 — all headlines weight 600.

Color:
| | Light chapter | Dark chapter |
|---|---|---|
| Background | `#FFFFFF` / alternate `#F5F5F7` | `#000000` / `#161617` |
| Tile | `#FFFFFF` on alt, `#F5F5F7` on white | `#1D1D1F` / `#272729` |
| Headline | `#1D1D1F` | `#F5F5F7` |
| Body | `#1D1D1F` | `#F5F5F7` |
| Secondary | `#6E6E73` | `#86868B`–`#A1A1A6` |
| Link | `#0066CC` | `#2997FF` |
| Button | `#0071E3`, white text | `#0071E3`, white text |

Spacing and widths:
- Section padding: about 80px (small), 120px (medium), 160px (large) top and bottom. Hero sections often have less padding at the bottom (`no-pad-bottom`) so media can bleed into the next section.
- Content width: 980px (large), 692px (medium), 87.5% (small); galleries up to 1440px.
- Headline → intro: 12–20px. Intro → CTAs: 24–32px. CTAs → media: 40–64px.
- Gaps in tile grids: 12–24px.

## 7. Imagery and media

- **Product renders and real photography,** lit beautifully, on clean backgrounds that match the section color (render on `#F5F5F7` for alt sections, on black for dark ones). Never generic stock photos of people pointing at laptops.
- **Software:** show the real UI in real states with real-looking data. Crop into the interesting part at large scale rather than showing an entire screen small.
- Use responsive images (`<picture>` with `srcset` at 1x/2x/3x, AVIF or WebP), with an explicit `width` and `height` or `aspect-ratio` so nothing shifts.
- **Video:** muted, inline, with a visible pause control; a poster image; no autoplay under `prefers-reduced-motion` (show the poster and a play button instead).
- Keep illustrations and icons simple, consistent in stroke, and in at most one or two colors. Avoid 3D clip-art blobs.

## 8. Motion and scroll storytelling

- **Reveal once:** elements fade up (opacity 0→1, translateY 24–40px→0) over about 600–900ms with `--ease-out-soft` as they enter the viewport. Don't re-animate on scroll back.
- **Product choreography:** pinned sections where a render rotates or explodes as you scroll (scroll-driven animations, `animation-timeline: view()` or `scroll()`), with progress tied to scroll position, never on timers.
- **Galleries** snap with momentum; arrows scroll by one card with smooth behavior.
- **Hover:** links underline; tiles may scale media subtly (1.02–1.03) over 300–500ms.
- **Never** scroll-jack, block scrolling, run long intros, or animate body text letter by letter. Everything must work, and be readable, with reduced motion (static frames, no pinning travel).

## 9. Copywriting

Patterns from Apple's pages:
- **Headlines are short declaratives ending in a period:** "Get the highlights." "Take a closer look." "Explore the lineup." Short sentences give a confident cadence.
- **Wordplay and rhythm, earned by substance:** "Fast that lasts." "Love it. Lease it. Upgrade it." — triads, parallel structure, gentle puns. Use them sparingly; the next line must deliver a concrete fact.
- **Eyebrow + headline pairing:** a plain topic label ("Battery") above an expressive line ("A battery you can't outrun.").
- **Specifics over superlatives:** numbers, units, comparisons ("Up to 8 hours", "40% recycled material"), with numbered footnotes for qualified claims.
- **Benefit first, feature second:** "Helpful in all the right places." then what it does.
- **Lead-ins in captions:** a bold short phrase with a period, then the explanation.
- **Plain, warm, and brief:** no jargon walls, no hype adjectives ("revolutionary", "game-changing"), no exclamation points.

## 10. Calls to action

- **Pair a primary and a secondary:** a filled capsule ("Buy", "Get Started", "Download", "Try It Free") and a text link with a chevron ("Learn more ›").
- **Buttons:** apple.com's standard capsule is 14px text with 9×16px padding; the "elevated" size is 17px text with 12×22px padding. Fill `#0071E3`, hover `#0076DF`, active `#006EDB`, about 980px radius.
- **Links:** `#0066CC`, no underline at rest, underline on hover; append a chevron `›` or an inline arrow icon for "go somewhere".
- **At most two CTAs per section,** consistently placed. On dark sections, use the same blue button and a `#2997FF` link.
- **Accessible names should be specific:** "Learn more about Battery Life", via visually hidden text if the visible text is just "Learn more".

## 11. Footer and legal

- **"Sosumi" footnotes:** numbered superscripts in the content link to a legal block at the bottom (12px, `#6E6E73`, generous line-height); each note links back.
- **Directory footer:** many columns of 12px links in `#424245` / `#6E6E73` on `#F5F5F7`, column headings 12px semibold, and a hairline separator above the copyright line. Calm, dense, organized.
- A breadcrumb at the top of the footer, and a locale or region picker.

## 12. Performance and polish checklist

- [ ] Largest Contentful Paint under 2.5s on 4G; the hero image preloaded and correctly sized; video loads lazily.
- [ ] No layout shift (reserved media boxes, the system font so there's no font swap on Apple devices).
- [ ] Every section is readable with images off, motion off, and at 200% zoom.
- [ ] Headline wrapping is balanced at every breakpoint (check 390, 744, 1024, 1440, 1920px).
- [ ] The light and dark chapters each pass contrast; dark sections have antialiased text.
- [ ] One accent color, one type family, one radius scale, one icon set.
- [ ] Footnotes link both ways; legal text is real text (selectable, translatable).
