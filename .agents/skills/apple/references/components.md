# Components

Sources: HIG component pages (Buttons, Toolbars, Tab bars, Sidebars, Split views, Lists and tables, Collections, Segmented controls, Toggles, Text fields, Search fields, Sheets, Alerts, Action sheets, Popovers, Menus, Context menus, Pull-down and Pop-up buttons, Progress indicators, Page controls, Sliders, Labels, Icons), current through Sept 2026; WWDC25 "Get to know the new design system".

The meta-rule: **use the standard component and the standard placement.** "When you use components that people already know, the experience feels immediately reliable and familiar." Customize appearance only where it creates real value, and keep sizing, placement, and behavior familiar. Building on the web? Recreate the *behavior* faithfully (states, keyboard, focus, roles), not just the look.

## Contents
1. Buttons
2. Icons & symbols (with web icon mapping)
3. Toolbars & navigation bars
4. Tab bars
5. Sidebars & split views
6. Lists & tables
7. Collections, cards & tiles
8. Segmented controls
9. Toggles, checkboxes, radio buttons
10. Text fields & forms
11. Search fields
12. Sheets & modals
13. Alerts
14. Action sheets / confirmation dialogs
15. Popovers
16. Menus, context menus, pull-down & pop-up buttons
17. Progress indicators & loading
18. Sliders, steppers, pickers, page controls
19. Labels, badges, tooltips, disclosure

---

## 1. Buttons

**Anatomy:** style (size, color, shape) + content (symbol and/or label) + role (normal, primary, cancel, destructive).

**Styles, from most to least prominent:**
| Style | Look | Use |
|---|---|---|
| Filled / prominent | Accent background, white label | The *one* most likely action in a view ("keep the number of prominent buttons to one or two per view") |
| Glass prominent | Tinted glass, white label | Primary action floating in the glass layer (Done ✓, Buy, Send) |
| Tinted | Accent at ~12–15% alpha, accent label | Secondary actions that still need presence |
| Gray / bordered | `systemFill`-type neutral fill, label color | Neutral secondary actions |
| Glass | Regular glass, monochrome label | Controls floating over content |
| Plain / borderless | Accent text only | Tertiary actions, inline actions, "Learn more ›" |

**Sizes (web):** small 28–32px tall (dense toolbars, desktop), regular 36–44px (44px whenever touch is likely), large 50–56px (full-width primary on phones, onboarding). Use capsules for touch and standalone actions, and rounded rectangles (`--radius-sm`) for dense desktop controls. apple.com's buttons are capsules: 14px text with 9×16px padding, or 17px text with 12×22px padding for the "elevated" size.

**Rules:**
- **A hit region of at least 44×44px** even if the visible button is smaller. Give the button enough space to be distinguished from its surroundings.
- **"Always include a press state."** Without one, the button "can feel unresponsive." Also add a hover state on pointer devices and a focus ring on keyboard focus.
- **Show the preferred choice by style, not size.** Same-sized buttons signal a coherent set; mixing sizes looks inconsistent.
- **Labels:** a verb first, in title case ("Add to Cart", "Send", "Save Draft"). Use a symbol when it's universally understood (share, plus, trash), and text when no symbol is clear: "Select" and "Edit" have no unambiguous symbol, so use text.
- **Never put a text button and a symbol button in one group;** they read as a single control.
- **Destructive** buttons use red and are **never** the primary or default button: "people sometimes choose a primary button without reading it first."
- **Primary responds to Return/Enter;** Cancel responds to Esc.
- **Async actions:** show a spinner inside the button with a progressive label ("Checkout" → "Checking Out…"), keep the width stable, and prevent double submission.
- **Disabled:** reduce opacity to about 40% (apple.com uses .42), set `aria-disabled`, and say why nearby if it isn't obvious. Prefer enabling the button and validating over a mysteriously disabled one.
- **macOS convention:** append "…" when the button opens another window or needs more input ("Edit…").

## 2. Icons & symbols

- **Native Apple platforms:** use SF Symbols (7,000+ symbols, nine weights matching the SF font weights, three scales, and rendering modes: monochrome, hierarchical, palette, multicolor). A tab bar prefers the *fill* variant; toolbars and lists use *outline*.
- **Web:** SF Symbols can't be used, so use one open set with SF-like geometry. **Lucide** (default; 2px stroke, rounded joins) or **Phosphor** (pick one weight). Don't mix sets.
- Match icon weight to adjacent text weight; keep one size, stroke, perspective, and level of detail across the app.
- **Optical centering:** asymmetric icons (play ▶, download) need nudging to look centered.
- **Accessible names on every icon-only control** (`aria-label="Share"`), plus decorative `aria-hidden="true"` on icons that sit next to text.
- **Don't add borders or circles around toolbar icons;** the bar is the container.
- **Don't draw Apple hardware or Apple logos;** they date quickly and are trademarked.

**Standard actions** (HIG "Standard icons" → closest Lucide icon):
| Action | SF Symbol (native) | Lucide (web) |
|---|---|---|
| Share / Export | `square.and.arrow.up` | `share` |
| Add | `plus` | `plus` |
| More | `ellipsis` | `ellipsis` |
| Delete | `trash` | `trash-2` |
| Done / Confirm | `checkmark` | `check` |
| Cancel / Close | `xmark` | `x` |
| Compose / New | `square.and.pencil` | `square-pen` |
| Rename / Edit | `pencil` | `pencil` |
| Copy | `document.on.document` | `copy` |
| Paste | `document.on.clipboard` | `clipboard-paste` |
| Cut | `scissors` | `scissors` |
| Undo / Redo | `arrow.uturn.backward` / `.forward` | `undo-2` / `redo-2` |
| Search | `magnifyingglass` | `search` |
| Filter | `line.3.horizontal.decrease` | `list-filter` |
| Folder / Move to | `folder` | `folder` |
| Attach | `paperclip` | `paperclip` |
| Account / Profile | `person.crop.circle` | `circle-user-round` |
| Print | `printer` | `printer` |
| Select | `checkmark.circle` | `circle-check` |
| Archive | `archivebox` | `archive` |
| Calendar | `calendar` | `calendar` |
| Like / Dislike | `hand.thumbsup` / `hand.thumbsdown` | `thumbs-up` / `thumbs-down` |
| Settings | `gearshape` | `settings` |
| Back (navigation) | `chevron.backward` | `chevron-left` (flip for RTL) |

Reserve the ellipsis icon for "More"/overflow only.

## 3. Toolbars & navigation bars

A toolbar holds the view title, navigation controls (Back, search), and actions. A *navigation bar* is the iOS term for a top toolbar used for navigation.

**Layout (leading → trailing):**
- **Leading:** Back (and sidebar toggle on wide screens), then the title. Not customizable.
- **Center:** common controls, or the title. Overflows into a system "More" menu as space shrinks.
- **Trailing:** important actions that must always be visible, inspector toggles, search, the More menu, and the **primary action (Done/Save) — tinted, prominent, rightmost.**

**Rules:**
- **Use the standard Back and Close controls:** a chevron for Back and ✕ for Close, without text labels saying "Back" or "Close".
- **The title is concise** (under ~15 characters), never the app name, and can be left empty if the content already says what it is.
- **At most about three groups.** Group by function and frequency, and keep text-labeled items separate from symbol items.
- **Prefer symbols without borders.** The bar is the container; hover and selection states come from the system.
- **Clean bars:** no custom backgrounds or brand-color fills. "Use the content layer to inform the color and appearance of the toolbar," and a scroll edge effect for separation.
- **iOS large titles:** a large bold title at the top that collapses into the bar's inline title as you scroll, and expands again at the top.
- **iPad:** a toolbar and tab bar can share the top row. **Mac:** every toolbar command must also exist in the menu bar, and toolbars can be customizable.
- **Space for content:** consider hiding bars temporarily (reading or media), always with a reliable way back (tap, scroll up, pointer hover).

**Web recipe:** a sticky header of 44–52px plus `env(safe-area-inset-top)`, on regular glass (or apple.com's `rgba(250,250,252,.8)` + `saturate(180%) blur(20px)`), with a scroll edge effect once content scrolls under it. On marketing sites, the global nav is 44px with a centered 12px link row. The local nav (product name left, links plus a small "Buy" pill right) becomes sticky beneath it.

## 4. Tab bars

For **navigation between top-level sections**, never for actions. Tab state is preserved per tab.

- **Keep tabs few:** 3–5 on phones. Avoid an overflow "More" tab.
- **Each tab has a filled symbol and a short label** (one word where possible). The selected tab takes the accent; the others are neutral.
- **Never hide, disable, or remove tabs** based on state. If a section is empty, open it and explain why.
- **Always visible** while moving between sections (except under a modal).
- **Badges** (red with white text) only for critical, actionable counts.
- **iOS 26+ look:** a floating glass capsule inset from the bottom edges, with an optional *search tab* at the trailing end. It can minimize on scroll, carrying an accessory such as a mini player. Never put screen-specific actions (like "Checkout") in the accessory.
- **iPad:** the tab bar sits at the top and can convert into a sidebar. **Mac:** use a sidebar or toolbar instead. **iPhone Duo outer display:** tabs move to the side.

**Web recipe (mobile):**
```css
.tab-bar { position: fixed; inset-inline: 16px; bottom: max(12px, env(safe-area-inset-bottom));
  height: 62px; border-radius: 999px; display: grid; grid-auto-flow: column; padding: 4px; /* + .glass */ }
.tab-bar a { display: grid; place-items: center; gap: 2px; font-size: 10px; font-weight: 600; border-radius: 999px; color: var(--label); }
.tab-bar a[aria-current="page"] { color: var(--accent); background: var(--fill-tertiary); }
```
Use `<nav aria-label="Primary">` containing links with `aria-current="page"` — these are links, not ARIA tabs, because each one changes the page.

## 5. Sidebars & split views

**Sidebar:** leading-edge navigation between areas or top-level collections.
- **Two levels of hierarchy at most;** go deeper with a split view (sidebar | list | detail).
- **Use succinct group titles and disclosure for long groups,** with a symbol per item (all items or none).
- **Icons use the accent color** (users' accent on Mac). Fixed colors only where meaningful, such as a yellow VIP star.
- **Let people hide it** (toolbar button, edge swipe, ⌃⌘S on Mac — View › Show/Hide Sidebar), but don't hide it by default. Let people customize the items when possible.
- **Liquid Glass era:** the sidebar is an inset, floating glass panel, and content (hero images, carousels) extends beneath it.
- **Mac:** avoid critical items at the bottom of the sidebar.

**Split view:** persistently highlight the current selection in each pane that leads to the detail, use a 1px "thin" divider, set reasonable minimum and maximum pane widths, allow hiding panes (with a menu command and shortcut to restore them), and support drag and drop between panes. On compact widths, collapse to one pane and navigate with push and Back.

**Tab bar or sidebar?** "Consider using a tab bar first"; it leaves more room for content. Use a sidebar (or a tab bar that adapts into one) when the information architecture is broader.

## 6. Lists & tables

- **Prefer lists for text** (scannable rows); use collections for images.
- **Row anatomy (iOS-style):** optional leading icon (a 28–30px rounded colored square with a white symbol, Settings-style, *or* a plain symbol), title (17px body), optional subtitle (15px secondary), trailing value (17px secondary), then the accessory: a chevron `›` to drill in, a switch, a checkmark for a selected option, or an info button for details. Rows are at least 44px tall.
- **Grouped (inset) style** for settings and forms: rounded groups on a `systemGroupedBackground`, a small secondary header above, and an explanatory footer below.
- **Selection feedback:** navigation lists keep the selected row highlighted (on wide layouts); option lists flash the row, then show a checkmark.
- **Succinct row text.** For long text, show titles only and put content in the detail view. Use a middle ellipsis for long names whose ends matter.
- **Swipe actions on touch** (trailing: Delete in red, plus one or two more; leading: a primary toggle like Read/Unread), always mirrored in a context menu or edit mode.
- **Desktop tables:** sortable column headers (click again to reverse), resizable columns, optional alternating row colors for wide tables, title-case noun headings, and right-aligned tabular numerals.
- **Don't add an alphabetical index** when rows have trailing accessories.

## 7. Collections, cards & tiles

- **Standard row or grid layouts;** "avoid creating a custom layout that might confuse people or draw undue attention to itself."
- **Cards are defined by surface contrast, not borders:** a white card on `#F5F5F7`, `#1D1D1F` on black in dark mode, with `--radius-lg` (18px) or `--radius-xl` (28px). At most a whisper of shadow; shadows almost never on dark.
- **Image-led:** media fills the tile edge to edge (with a concentric inner radius if inset), with text on the surface below or overlaid on a scrim. Never put text directly on busy imagery.
- **Pointer hover:** a gentle lift (scale 1.02 plus a soft shadow) for standalone tiles with space around them. For tightly packed items or rows, use only a tint change; scaling them crowds the neighbors.
- **Animate insert, delete, and reorder;** never shift the layout under someone's pointer or finger unprompted.

## 8. Segmented controls

- **Use for closely related choices within one context:** switching subviews (Day / Week / Month) or filtering a view. Use a tab bar for app sections.
- **Two to five segments on phones** (up to about seven on wide screens), equal widths, nouns in title case, and **either text or icons, never mixed.**
- **Don't mix "selection" segments with "action" segments** in one control.
- **Look:** a capsule track in `tertiarySystemFill` with a raised thumb (white in light mode, `#636366` in dark) that slides between segments with a snappy spring. Separators between unselected segments are optional and fade next to the thumb.
- **Web semantics:** a `role="radiogroup"` of radio inputs, or a tablist when it switches panels, operable with the arrow keys.

## 9. Toggles, checkboxes, radio buttons

- **The iOS switch belongs in list rows.** The row's text is its label. The track is a capsule about 51×31px; on is system green (or the accent, if it has enough contrast with the off state). In the Liquid Glass era the knob lifts into glass while being dragged.
- **Outside lists, use a toggle *button*** (an icon button whose background fills when on) rather than a floating switch.
- **Don't rely on color alone** for state; position and fill must also change.
- **Mac and dense desktop:** use checkboxes for settings and hierarchies (with a mixed state for partial selection), and radio buttons for 2–5 mutually exclusive options (more than five → a pop-up menu). Use a switch only for emphasized settings that turn on a whole group.
- **Web:** use the native `<input type="checkbox" role="switch">` styled with `appearance: none`, or `accent-color` for native checkboxes and radios. Keep the real input for accessibility.

## 10. Text fields & forms

- **Use a visible label** (above the field, or a floating label inside it) **plus a hint** in the placeholder ("name@example.com"). The placeholder disappears, so it can't be the only label.
- **Match the field width to the expected input;** stack fields vertically with consistent widths and even spacing.
- **Validate at the right moment:** an email when the person leaves the field, a new password or username *before* they move on, and dynamically wherever possible. Show the error **next to the field**, with the fix ("Use only letters for your name").
- **Give the right keyboard:** `type="email|tel|url|number"`, `inputmode`, `autocomplete` (`email`, `given-name`, `one-time-code`, `new-password`), `enterkeyhint`.
- **Secure fields for secrets.** Never prefill passwords; support passkeys and password managers.
- **Add a clear button (ⓧ) in the trailing end** of single-line fields on touch.
- **Prefer choices over typing** (menus, pickers, segmented controls) and prefill sensible defaults. Never ask for information you can get otherwise.
- **Require data clearly:** enable Continue once the required data is entered, or mark what's missing on submit, with focus moved to the first error.
- **Look:** 44–52px tall with `--radius-md` corners (or a capsule for search), `tertiarySystemFill` background or a 1px separator border, a focus ring in the accent, and 17px text (16px minimum on iOS Safari, or the page zooms on focus).

## 11. Search fields

- **Magnifying glass, a placeholder that states the scope** ("Search Recipes"), a clear button, and Cancel (on mobile).
- **Search as people type;** show recent and suggested searches before typing; put the most relevant results first, categorized if helpful.
- **Use a scope bar** for clear categories (default to the broadest scope) and **tokens** for structured filters (pair them with suggestions so people discover them).
- **Placement (iOS):** a dedicated search tab in the tab bar (standard style for discovery-rich apps, button style for quick lookups), or a bottom toolbar field ("place search at the bottom if there's room" — easy to reach), or the top bar when bottom content must stay unobstructed, or inline above the list it filters.
- **Placement (iPad, Mac, desktop web):** the trailing end of the toolbar for global search; the top of the sidebar for filtering navigation; a dedicated sidebar item for discovery-heavy apps. Support ⌘F (and `/` on the web) to focus it.

## 12. Sheets & modals

- **For scoped tasks closely related to the current context.** For complex or long tasks, use a full-screen view or a new window instead.
- **One sheet at a time.** Close the first before showing another.
- **Buttons (iOS):** Cancel (or ✕) at the leading edge and Done or Save at the trailing edge, tinted. Never show Cancel, Done, *and* Back together; in multi-step sheets use Back plus Cancel, with the final step getting Done. Always pair Done with a way out.
- **Resizable sheets (phone):** a grabber, *detents* (medium about half height and large), and swipe-down to dismiss. If there are unsaved changes, confirm with an action sheet (Discard Changes / Keep Editing).
- **iPad and desktop:** a centered form sheet (about 540–720px wide) over a dimmed backdrop. **Mac:** a card attached to its window; other windows stay usable.
- **Modal vs parallel:** if the task interrupts the main flow, dim the background. If it runs in parallel (a formatting panel), skip the dim and keep the parent interactive (a nonmodal sheet or inspector).
- **Web recipe:** `<dialog>` with `showModal()` for modal sheets (focus is trapped, Esc closes it, `::backdrop` dims). Use `--radius-xl` top corners on phones (all corners on desktop), the elevated background, and present with `--spring-smooth`. Title the task ("New Event"); don't use generic "Modal".

## 13. Alerts

- **Rare and critical:** a problem, a destructive action people may not intend, or a purchase or important confirmation. **Never informational-only, never at app launch,** and never for common undoable actions like deleting an email.
- **Content:** a title that says what happened specifically (no "Error", no "Error 329347"), up to two lines; a message only if it adds value; and up to three buttons. Since 2025, alert text is bolder and left-aligned.
- **Buttons:** one or two words, verbs that match the text ("Delete", "Keep Editing", "View All"). Use "OK" only for purely informational alerts, and always "Cancel" for cancel. The default action goes trailing (or top in a stack) and Cancel leading (or bottom). Use the destructive style only for destructive actions people didn't deliberately choose. If you don't want people pressing Return blindly, make no button the default.
- **Escape routes:** Esc and ⌘-period cancel.
- **Web:** `<dialog role="alertdialog">`, 270–340px wide on phones, focus on the safest action.

## 14. Action sheets / confirmation dialogs

- **Choices related to an action people just took intentionally** (canceling a draft → Delete Draft / Save Draft / Keep Editing). Use an alert when there's no choice beyond confirm or cancel.
- **Destructive options in red,** a Cancel that's always available, and the most likely option where it's easiest to reach. Keep the list short.
- **iOS 26+:** springs out from the control that triggered it (popover-like on wide screens) rather than always rising from the bottom.

## 15. Popovers

- **A small amount of information or functionality,** closely tied to the element that opened it. The arrow points at the source and doesn't cover it.
- **One at a time,** never cascading, and nothing displayed over it except an alert. Closing one and opening another takes a single tap or click.
- **Light dismissal:** tapping outside closes it, so *save work automatically*; only an explicit Cancel discards. Don't use a popover for warnings (people miss them).
- **On compact widths, use a sheet** instead. Keep it no bigger than its content; animate size changes so it doesn't look replaced.
- **Web:** the Popover API (`popover` attribute) with CSS anchor positioning where supported (`anchor-name`, `position-anchor`, `position-try-fallbacks`), on glass or the elevated background, with `--radius-xl`, materializing from the anchor.

## 16. Menus, context menus, pull-down & pop-up buttons

**All menus:**
- **Verb labels for actions, title case, no articles** ("Add Bookmark", not "Add a bookmark").
- **"…" when more input is needed** before the action completes ("Rename…", "Export…").
- **Frequent items first;** group related items with separators; keep logically related commands together even if their importance differs.
- **Icons:** use standard symbols for standard actions, and give icons to all items in a group or none. Introduce a closely related set with a symbol once rather than repeating near-identical icons.
- **Submenus:** sparingly, one level deep, about five items or fewer. Prefer them over indentation.
- **Toggles:** a checkmark for an attribute currently in effect, or a changeable label ("Show Map" ↔ "Hide Map").
- **Unavailable items** are dimmed in regular menus. The menu itself stays openable even if everything inside is unavailable.
- **Destructive items** go at the end, in red.

**Context menus:** only the most relevant actions for the item; short (≤ about three groups); available consistently on every comparable item; everything also reachable elsewhere in the UI; **hide** unavailable items rather than dimming them; no keyboard shortcuts shown. Trigger with long press, right-click, or the Menu key / Shift+F10.

**Pull-down button** = a button that reveals a menu of *actions* (the More ⋯ button). **Pop-up button** = shows the *currently selected option* with an up/down chevron and opens a list to pick one (a styled select).

**Look (web):** glass or elevated background, `--radius-xl` outer corners with concentric item highlights, 6px padding, about 36–44px rows (touch) or 24–28px (desktop), separators as 8px gaps or hairlines, materializing from the trigger with `transform-origin` at the trigger. Full keyboard support: arrows, Home and End, type-ahead, Enter, Esc, and focus returned to the trigger.

## 17. Progress indicators & loading

- **Show something immediately:** layout skeletons or placeholder shapes in `--fill-quaternary`, cached content, or the real chrome. A blank screen reads as broken.
- **Determinate when possible** (a bar or ring with real progress, paced honestly — no 90% in 5 seconds then a stall). Switch from indeterminate to determinate once duration is knowable. Never morph a spinner into a bar.
- **Indeterminate:** a small spinner (the iOS style: 8–12 tapered spokes, or a simple arc), in a consistent location. Don't label it with vague words like "Loading…"; describe the task if helpful ("Importing 24 photos").
- **Keep it moving.** If something stalls, say so and offer a fix.
- **Let people cancel or pause** when it's safe; warn if canceling loses work.
- **Spinner inside the button** that started the action, for short async actions.
- **Pull to refresh** on touch lists, plus automatic refresh — "don't make people responsible for initiating every update."

## 18. Sliders, steppers, pickers, page controls

- **Slider:** a capsule track filled with the accent up to the thumb, optional min and max symbols at the ends (speaker.fill … speaker.wave.3.fill), and a thumb that enlarges into glass while dragging. Use native `<input type="range">` with custom styling.
- **Stepper:** − / + capsule pair for small, discrete changes, with the value displayed next to it.
- **Pickers and date pickers:** prefer native inputs on the web (`<input type="date">`, `<select>`) — "prefer system-provided controls" — and style the container, not the OS picker.
- **Page control** (dots): for swipeable pages; the current dot uses the label color and the rest are faded. Keep it centered at the bottom, with fewer than about 10 dots. Don't show it together with a scroll indicator on the same axis.

## 19. Labels, badges, tooltips, disclosure

- **Labels:** use the four label colors for importance (primary, secondary, tertiary, quaternary). Make useful text selectable (error codes, addresses).
- **Badges:** a red oval with a white number or "!" for critical, actionable counts only. Status badges in content can use a tinted fill (accent at 12–15%) with colored text.
- **Tooltips** (pointer platforms): a brief phrase describing what a control *does* ("Show Sidebar"), appearing after a short hover delay (~0.5s) and also on keyboard focus. Not needed on buttons that have visible text.
- **Disclosure:** a chevron that rotates 90° (spring) to reveal nested content. Show "Show More" / "Show Less" text for in-place text expansion.
