# Apple's design principles — as decisions you can make

Source: HIG "Design principles" (reintroduced June 8, 2026), WWDC26 "Principles of great design", WWDC25 "Meet Liquid Glass" and "Get to know the new design system", WWDC18 "Designing Fluid Interfaces".

Apple's own framing: "There's no one right way to apply these principles. They're tools to help you weigh competing priorities." Leaning into one may cost another; that tension is the job. Use the questions below to make each call deliberately.

## Contents
1. The eight principles
2. The two-layer model (Liquid Glass era)
3. Fluid interface principles
4. How Apple thinks about branding
5. A decision procedure

---

## 1. The eight principles

### Purpose — *Make something meaningful*
"Design starts with intention. Identify what matters most to the people you're designing for. Focus on making those things great."
- **Create value.** At every stage ask what the product is for and whether this design serves that.
- **Keep focused.** Prioritize the most important features and make *those* great. A product with a clear use helps people more than one that does everything.
- **Find new ways to solve the problem.** Don't re-create existing solutions; define what sets this one apart.

Ask: *What is the one job of this screen? If I removed this element, would anyone miss it?* "Choosing what to build is often a matter of deciding what not to include."

### Agency — *Let people do things their own way*
- **Stay out of the way.** Get people directly to the task or content. "The best designs are unobtrusive and present when people need them."
- **Give people freedom to explore.** Don't lock people into flows or modes. When a guided flow is needed, make it easy to skip or escape.
- **Help people recover from mistakes.** Build in forgiveness: undo, a confirmation only before something destructive and irreversible, restoring state. "When people know they can reverse an action, they feel free to explore."

Ask: *Can someone bail out of this at any point? Can they undo it? Am I forcing an order they don't need?*

### Responsibility — *Act in people's best interest*
- **Be transparent about what the product does and why.** Ask for permissions in context, with a clear reason, at the moment they're needed — never all at launch. ("Hey! Give me your phone number. — For what?" Interfaces do this all the time.)
- **Keep people's information safe.** Collect only what's needed. Anticipate misuse and put protections in place. For AI features, anticipate wrong or harmful output and add safeguards — or drop the feature if the risk outweighs the value.

### Familiarity — *Build on what people know*
- **Use concepts people know.** Real-world metaphors (trash, folders, pages) and established software conventions. A metaphor that's too literal or too abstract fails.
- **Be consistent.** "Things that look the same should behave the same." Consistent placement speeds people up (the close button is always in the same corner).
- **Give clear feedback.** Show what's available, what changed, and what's happening, using system patterns.

Ask: *Would someone who has used an iPhone or Mac know what this does without being told?* For common actions, "there's no need to reinvent the wheel."

### Flexibility — *Adapt to diverse contexts and needs*
- **Design for everyone.** Treat accessibility as a priority from the start.
- **Preserve context.** Keep content and controls in consistent, predictable positions as the layout adapts; use natural animation to ease the transitions.
- **Support many inputs:** touch, pointer, keyboard, voice, assistive technology.
- **Approach every platform with intention.** Give each the same level of care. iPhone is quick touch interactions, Mac is deep workflows with precise pointer and keyboard, and iPad sits between them.
- **Let people personalize** when no single layout suits everyone (rearrangeable controls, hidden extras).

### Simplicity — *Be clear and direct*
- **Include just what's necessary.** "Simplicity isn't minimalism." Burying everything in one menu looks minimal but isn't simple. Sometimes simple means *adding* context — a video scrubber that shows elapsed and remaining time is simpler to use than a bare play button.
- **Be concise.** Plain language, no jargon, no redundancy, fewer steps.
- **Establish hierarchy.** Order, spacing, and contrast guide people to what matters. "When your hierarchy is strong, the most important item on the screen is always the most obvious one." A clear interface answers: *What do I pay attention to? What can I interact with? How?*

"You'll know you've arrived at simplicity when you have exactly enough."

### Craft — *Care about every detail*
- **Quality sets the tone.** Use beautiful fonts, colors that adapt to light and dark, clear iconography, and responsive animation that gives immediate, natural feedback. "Precise wording, and thoughtful audio."
- **Experiment and iterate.** Prototype early, discard what doesn't work, test in real conditions.
- **Maintain your craft.** "Shipping isn't the finish line."

Cheap software feels like a rickety door: you tap and wait, scrolling is jittery, icons are misaligned, rotating the device breaks the layout. A carefully crafted design does the opposite — "it inspires confidence."

### Delight — *Make it human*
- **Identify the emotion you want to inspire.** A fitness app energizes, a meditation app calms, a game thrills.
- **Create defining moments.** Even a button press or an error message can carry character.
- **Don't mistake delight for decoration.** "The way to make a design delightful isn't by adding confetti or tacking on extra flourishes at the end."
- **Consider the whole.** Delight is "the sum of the consideration you put into your product": the freedom to act, the safety to explore, the comfort of familiar metaphors, the flexibility to move between contexts.

---

## 2. The two-layer model (Liquid Glass era)

Introduced with iOS 26 and macOS Tahoe (2025) and carried forward in iOS 27 (2026). It's the single most important structural idea for a contemporary Apple look.

| | Content layer | Functional layer |
|---|---|---|
| Contains | Text, media, data, lists, cards, the app's unique features | Navigation and controls: tab bar, toolbars and nav bar, sidebar, menus, popovers, sheets, floating buttons |
| Material | Opaque surfaces, standard materials where needed | Liquid Glass (translucent, adaptive) |
| Color | **Brand color lives here**; it scrolls beneath the glass and tints it dynamically | Monochrome by default; tint only the primary action |
| Behavior | Scrolls, extends edge to edge, under the bars | Floats, stays put, stays quiet, defers to content |

Apple's practical guidance:
- "If you've customized your bars, now's the time to clean them up." Remove the extra backgrounds and borders. "Instead of relying on decoration, hierarchy should be expressed through layout and grouping."
- Move solid brand color out of top bars and into the scroll view, so the controls float over it. Before iOS 26, solid bars "letterboxed the content."
- Group bar items by function and frequency. Don't put a symbol button next to a text button: "Select" next to a share icon reads as a single button.
- A primary action like Done sits apart and tinted, often as a blue checkmark on iOS or a prominent text button on macOS.
- Sheets and menus *grow from their source*. An action sheet springs from the button that opened it instead of always rising from the bottom.

---

## 3. Fluid interface principles

From WWDC18 "Designing Fluid Interfaces", the foundation of iPhone X-era interaction that Liquid Glass extends. "It's not that our interfaces should be fluid — it's that *we're* fluid, and our interfaces need to respond to that."

1. **Response.** Eliminate latency. People are extremely sensitive to delay; it severs the feeling that the interface is an extension of you. Hunt down every timer and wait you've introduced.
2. **Redirection and interruption.** People change their minds mid-gesture. Every transition must be interruptible and reversible in flight, so thought and gesture happen in parallel.
3. **Spatial consistency.** Things leave the way they came. If a view slides down from the top, dismiss it by sliding up, not sideways. Symmetric transitions build a mental map.
4. **Hint in the direction of the gesture.** As a press begins, controls grow slightly toward their final state, so people can predict what happens.
5. **Lightweight interactions, amplified output.** A small flick moves a lot. Preserve momentum: scroll inertia, and projecting where a thrown object would land, then snapping there.
6. **Soft boundaries.** Rubber-band at edges instead of hitting a wall.
7. **Smooth frames.** It's not just frame rate; it's how much changes between frames. Fast movement strobes — keep velocities reasonable, use motion blur or stretch for very fast moves.
8. **Behavior over animation.** Physical behaviors (springs, friction) instead of fixed timed curves, so motion is a conversation with the person rather than a pre-baked movie.

---

## 4. How Apple thinks about branding

From HIG "Branding" (updated Sept 2026) and WWDC26 "Communicate your brand identity":

- **Express brand in the content layer;** keep the UI layer familiar. Apps with strong identity (Gentler Streak, Slack, NYT Cooking, Moonlitt, Crumbl) still use native tab bars, toolbars, sheets, and context menus.
- **Customize components only where it creates the biggest impact.** Utilitarian custom controls don't reinforce a brand — they "make the product appear less native, or even dated."
- **Use the accent color judiciously:** primary actions, unread badges, the selected tab. Not on every control.
- **A custom font works best for headlines,** with system fonts for body and captions, which are optimized for legibility at small sizes. Custom fonts must still scale with Dynamic Type and Bold Text.
- **Use the logo sparingly.** "People seldom need to be reminded which app they're using." NYT Cooking shows its logo only on the Home tab, and it fades on scroll.
- **Not a launch screen.** Launch screens aren't a branding opportunity; they should look like the first screen, without text.
- **Motion and transitions are part of the brand,** but "delayed load times or dropped frames translate poorly to people's perception of your app."
- **Platform-appropriate, not identical everywhere.** The same brand can draw its Share icon differently on iOS, Android, and web, true to each platform's convention.

---

## 5. A decision procedure

When choosing between two options, run through these in order:

1. Does it serve the screen's **purpose**? If neither does, cut both.
2. Is it **familiar** — does it use the convention people already know? Prefer the standard component or placement.
3. Does it keep the **hierarchy** obvious, with exactly one most-prominent thing?
4. Does it work for **everyone**: large text, dark mode, keyboard, screen reader, reduced motion, small and large screens?
5. Is it **forgiving** — can people undo it or escape it?
6. Is it **crafted** — aligned, on-scale, concentric, smooth, with precise words?
7. Only then: is it **delightful**, and does that delight fit the emotion you chose?
