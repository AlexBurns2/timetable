# Platforms — native apps and platform-aware web

Sources: HIG "Designing for iOS / iPadOS / macOS / visionOS / watchOS / tvOS / iPhone Duo" (Sept 2026), "Layout", "Toolbars", "Tab bars", "Sidebars", "Keyboards", "Pointing devices"; Apple SwiftUI docs (API names below were checked against developer.apple.com).

## Contents
1. Platform characteristics at a glance
2. Mapping web surfaces to platform conventions
3. Building native: the SwiftUI way
4. iPhone Duo
5. macOS specifics worth copying on the desktop web
6. visionOS, watchOS, tvOS in brief

---

## 1. Platform characteristics at a glance

| | iPhone | iPad | Mac | Vision Pro | Watch | TV |
|---|---|---|---|---|---|---|
| Display | Medium, high-res | Large | Large, often multiple | Infinite canvas, windows in space | Small | Huge, 10 ft away |
| Distance | ≤ 1–2 ft | ≤ 3 ft | 1–3 ft | Varies | Wrist | Across the room |
| Input | Multi-Touch, keyboard, voice | Touch, Pencil, keyboard, trackpad | Keyboard + pointer | Eyes + hands, voice | Touch, Digital Crown | Remote, controller |
| Session | Minutes, on the go | Minutes to hours | Long, deep work, many apps | Immersive | Seconds | Lean-back |
| Default body text | 17pt | 17pt | 13pt | 17pt | 16pt | 29pt |
| Min hit target | 44pt | 44pt | 28pt | 60pt | 44pt | 66pt |

Best practices per platform (HIG):
- **iOS:** limit on-screen controls and make secondary actions discoverable with minimal interaction; adapt to orientation, Dark Mode, and Dynamic Type; put frequent controls in the middle or bottom (reachability); support swipe back and swipe actions; use system data (payments, Face ID, location) instead of asking people to type.
- **iPadOS:** elevate content with fewer modals and full-screen transitions; scale density to viewing distance; combine touch, keyboard, trackpad, and Pencil; adapt to window resizing and multitasking.
- **macOS:** more content in fewer nested levels with less modality; resizable windows and full screen; **every command in the menu bar**; high-precision selection; keyboard shortcuts everywhere; personalization (customizable toolbars, people's own accent color).

## 2. Mapping web surfaces to platform conventions

A web product is used on all of these devices, so let the *available space and input* decide which conventions apply:

| Web context | Borrow from | Concretely |
|---|---|---|
| Phone-width web app / PWA | iOS | Bottom floating tab bar (3–5 items), large collapsing title, bottom sheets with a grabber, swipe-friendly lists, 44px targets, 17px text, search at the bottom |
| Tablet-width | iPadOS | Sidebar-adaptable navigation, two-column list + detail, centered form sheets, popovers instead of full-screen modals |
| Desktop web app | macOS | Sidebar + toolbar + content (+ inspector), denser 13–15px UI text, keyboard shortcuts with a visible shortcut sheet, right-click context menus, hover tooltips, resizable split panes, ⌘K or ⌘F search |
| Marketing site | apple.com | See `marketing-web.md` |

Respond to the **input**, not just the width:
```css
@media (hover: hover) and (pointer: fine) { /* hover states, tooltips, denser rows, smaller targets OK (≥28px) */ }
@media (pointer: coarse)                  { /* 44px targets, no hover-dependent UI, bigger gaps */ }
```

## 3. Building native: the SwiftUI way

The fastest route to an authentic Apple feel in a native app is **less custom UI**. Standard SwiftUI components pick up Liquid Glass, Dynamic Type, Dark Mode, accessibility, and platform adaptations automatically.

**Structure**
```swift
TabView {
    Tab("Home", systemImage: "house.fill") { HomeView() }
    Tab("Library", systemImage: "books.vertical.fill") { LibraryView() }
    Tab(role: .search) { SearchView() }                    // dedicated search tab at the trailing end
}
.tabViewStyle(.sidebarAdaptable)                           // tab bar on iPhone, convertible sidebar on iPad and Mac
.tabBarMinimizeBehavior(.onScrollDown)                     // optional: minimize while reading
.tabViewBottomAccessory { NowPlayingBar() }                // persistent, app-wide accessory only

NavigationSplitView { Sidebar() } content: { ItemList() } detail: { ItemDetail() }
NavigationStack { List { … }.navigationTitle("Recipes") }  // large title collapses on scroll automatically
```

**Toolbars**
```swift
.toolbar {
    ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: cancel) }
    ToolbarItem(placement: .confirmationAction) { Button("Done", action: save) }  // renders prominent and tinted
    ToolbarItemGroup(placement: .primaryAction) { shareButton; moreMenu }          // grouped on shared glass
    ToolbarSpacer(.fixed)                                                          // separate groups
}
```
Remove custom `toolbarBackground` colors and borders from older code; let the glass and scroll edge effect work.

**Sheets, menus, search**
```swift
.sheet(isPresented: $showFilters) { FiltersView().presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
Menu { Button("Duplicate", systemImage: "plus.square.on.square") { … }; Button("Delete", systemImage: "trash", role: .destructive) { … } } label: { Image(systemName: "ellipsis") }
.searchable(text: $query, prompt: "Search Recipes")
.contextMenu { … }                                          // mirror every action elsewhere in the UI
```

**Text, color, symbols**
- `.font(.largeTitle | .title | .headline | .body | .subheadline | .footnote | .caption)` with `.bold()`, `.fontDesign(.rounded)`, `.fontWidth(.expanded)`. Never fixed sizes for text, so Dynamic Type works.
- `Color.primary`, `.secondary`, `Color(.systemGroupedBackground)`, `.tint(.accentColor)`; define custom colors in the asset catalog with light, dark, and high-contrast variants.
- `Image(systemName:)` with `.symbolRenderingMode(.hierarchical)`, `.symbolVariant(.fill)`, `.symbolEffect(.bounce, value:)`.

**Glass on custom controls** (sparingly) — see `materials.md §10`: `.glassEffect()`, `.buttonStyle(.glass)` and `.glassProminent`, `GlassEffectContainer`, `.scrollEdgeEffectStyle(.soft, for: .top)`, `.backgroundExtensionEffect()`. Shapes: `ConcentricRectangle()` and `.containerShape(...)` keep custom corners concentric with their container.

**Motion:** `withAnimation(.smooth)`, `.snappy`, `.bouncy`; `.navigationTransition(.zoom(sourceID:in:))` with `.matchedTransitionSource(id:in:)` for tile → detail zooms.

**Platform checks:** test the largest accessibility text size (AX5), Bold Text, Increase Contrast, Reduce Transparency, and Reduce Motion; run the app on iPad and Mac (Designed for iPad or Catalyst) and on iPhone Duo poses in Xcode's Device Hub.

## 4. iPhone Duo

The first folding iPhone (Sept 2026): two displays (outer and inner) with a center hinge and several poses (book, laptop-like, standing). "You're still designing for iPhone."
- **Build to resize:** compact width on the outer display and regular on the inner one. Use size classes, layout margins, and safe areas, with no fixed widths and no display-specific code.
- **Keep the experience consistent across displays;** show one extra level of hierarchy on the inner display when it helps (Mail: list *or* message closed; list *and* message open).
- **Vertical controls:** on the outer display (wider and shorter), toolbars, tab bars, and the status bar move to the **side**. Navigation (Back or Close) sits at the top of that axis, then prominent actions, then the rest. Provide a title *and* symbol for every toolbar item so the system can choose; keep text buttons to a minimum; use the system overflow menu (ellipsis only for overflow); set visibility priorities so frequent actions survive.
- **Reserved regions:** the outer camera (always), the inner camera (when active), and the fold (when partly open). Keep important content and controls clear of them. Prefer even column counts so grids split cleanly.
- **Don't override default bar placement,** and favor small adjustments over rearrangement when people fold the device.
- **Arrangement views** (`ArrangementView`) lay out a primary and secondary view as split or overlay and adapt to orientation and the fold. Keep navigation containers *outside* them.
- **Web on foldables:** use fluid layouts and container queries, and where supported the Viewport Segments API to avoid the fold.

## 5. macOS specifics worth copying on the desktop web

- **A complete command structure:** every action reachable from a menu or command palette, with standard shortcuts (⌘N new, ⌘O open, ⌘S save, ⌘W close, ⌘Z/⇧⌘Z undo and redo, ⌘F find, ⌘, settings, ⌘A select all, Delete, Space for Quick Look-style preview). Show shortcuts next to menu items, and never override system ones.
- **Toolbar items** are borderless symbols that get a subtle hover background. The window title sits at the leading edge next to navigation.
- **Sidebar** on the leading edge, inset and floating. Sidebar icons take the accent color.
- **Inspector** on the trailing edge for properties of the selection; collapsible.
- **Dense but calm:** 13px body, 24–28px rows, alternating row colors in wide tables, resizable and sortable columns.
- **Pointer feedback:** precise hover highlights on interactive elements only. The cursor is `default` on UI controls (Mac apps don't use a hand cursor on buttons); keep `pointer` for actual links if you prefer web convention, but be consistent.
- **Right-click** opens a context menu on objects, with the same actions available elsewhere.
- **Windows:** respect resizing, don't place critical things at the bottom edge, restore state on reopen, and support full-screen (⌃⌘F) for focus.

## 6. visionOS, watchOS, tvOS in brief

- **visionOS:** content in glass windows that adapt to the room, with no Dark Mode setting. Use bolder type, vibrancy for hierarchy, and color sparingly (prefer bold text and large areas). Targets are 60pt with centers 60pt apart; prefer circular and capsule buttons (easier to look at than sharp corners). Keep motion out of the periphery; never anchor content to the head. Toolbars sit at the window's bottom and tab bars are vertical on the leading side. Sidebars belong in a tab, and supplemental content goes in an adjacent window, not an ornament.
- **watchOS:** glanceable; SF Compact; full-width buttons for primary actions (at most 2–3 side by side); vertical scrolling with the Digital Crown; black backgrounds; background color only when it communicates something.
- **tvOS:** focus-driven (scale and lift on focus, not just color); safe area of 60pt top and bottom and 80pt sides; text is large (29pt body); a limited palette coordinated with the logo; grids with 40pt horizontal spacing.
