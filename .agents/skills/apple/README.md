# /apple — Apple-quality design skill for Claude Code

A Claude Code skill that makes websites, web apps, and native Apple-platform apps look and feel like Apple's own design team made them.

It's grounded in Apple's current guidance, not memory:
- **Human Interface Guidelines** — all 173 pages from developer.apple.com/design, current through September 2026 (the eight design principles, Liquid Glass, iOS/macOS 27, iPhone Duo).
- **WWDC design sessions** — the reasoning behind the rules (springs, Liquid Glass, typography, branding, naming).
- **apple.com's production CSS** — the real web type scale, colors, buttons, nav material, easing curves, and breakpoints.

## Install

```bash
git clone https://github.com/KanishkRanjan/apple-design-skill.git ~/.claude/skills/apple
```

Then type `/apple` in Claude Code, or just ask for a UI that should feel premium or "like Apple" — the skill triggers on its own.

## What's inside

| Path | What it is |
|---|---|
| `SKILL.md` | The workflow, core rules, and the "instant tells" of non-Apple design |
| `references/` | 13 deep references: principles, typography, color, layout & shape, materials (Liquid Glass), motion, components, patterns, writing, accessibility, platforms (incl. SwiftUI), marketing web, review checklist |
| `assets/apple-tokens.css` | Drop-in design tokens: system colors (light, dark, increased contrast), type scales, spacing, radii, materials, spring easings, accessibility media queries |
| `assets/apple-components.css` | Reference components: buttons, glass bars, inset grouped lists, switch, segmented control, fields, sheets, alerts, menus, progress |
| `assets/demo.html` | A full sample page built only from the two CSS files (supports `?theme=light\|dark` and `?open=<dialog-id>`) |
| `scripts/contrast.py` | WCAG contrast checker (composites translucent colors first) |
| `scripts/spring.py` | Converts Apple-style springs (damping, response) into CSS `linear()` easings |

## Notes

- **Licensing:** SF Pro, New York, and SF Symbols are licensed only for Apple-platform software. The skill never self-hosts them on the web; it uses the system font stack (which shows SF on Apple devices) and recommends open icon sets such as Lucide.
- **Not affiliated with Apple.** The goal is Apple-*quality* design for your own product, not a copy of Apple's branding. The skill tells Claude never to use Apple's logo, product names, imagery, or copy.
