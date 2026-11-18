# Patterns — flows and states

Sources: HIG Patterns (Onboarding, Launching, Loading, Feedback, Modality, Entering data, Settings, Searching, Undo and redo, Managing accounts, Privacy, Managing notifications, Offering help, Going full screen, Charting data, Generative AI, Drag and drop) and the Charts component page, current through Sept 2026; WWDC26 "Principles of great design".

## Contents
1. First run: launch, onboarding, permissions, sign-in
2. Loading and feedback
3. Empty, error, and offline states
4. Forms and data entry
5. Search
6. Modality and focus
7. Undo, forgiveness, and destructive actions
8. Settings
9. Notifications
10. Help and tips
11. Generative AI features
12. Charts and data
13. Drag and drop, full screen

---

## 1. First run: launch, onboarding, permissions, sign-in

**Launch**
- **Launch instantly.** On the web: server-render or pre-render the shell, inline critical CSS, and avoid blocking web fonts (`font-display: swap`; the system font needs no download).
- A launch or splash screen is not a branding moment. If you have one, it should look like the first screen *without text or logos*, so the transition is seamless.
- **Restore state:** scroll position, open tabs, drafts, filters. "Avoid making people retrace steps."

**Onboarding** — "fast, fun, and optional"
- Ideally there isn't any: people learn by using the product.
- If needed, **teach through interaction** (let people do the thing, safely), not slideshows of text. Prefer **contextual tips** near the feature, at the moment it's relevant, over an upfront tour.
- Keep it short and skippable, never shown again once skipped, and findable later (in Help or Settings).
- Don't teach the platform (how to scroll, what a button is). Don't put licensing or legal text in onboarding.
- Use defaults instead of setup questions. "Postpone nonessential setup flows."
- Ask for ratings or purchases only after people have experienced value.

**Permissions** — the "Hey! Give me your phone number" problem
- **Ask at the moment of need,** tied to the feature someone just tried to use (location when they tap "Use My Location"; notifications after they follow something). Never a battery of prompts on first load.
- Ask at launch only if the product can't function without it (a navigation app's location).
- **Explain the benefit in one specific sentence:** "Your location is used to show nearby stores", not "We need access."
- A pre-permission screen may have **exactly one button that leads to the real browser or system prompt.** No "Not now" button that skips it, no fake "Allow", and nothing that mimics the system dialog.
- Request the narrowest access possible, and keep the product useful when access is denied (with a clear way to enable it later).

**Accounts**
- **Delay sign-in as long as possible.** Let people browse and try first; ask at the point of commitment (save, purchase, sync).
- Explain why an account is needed, briefly, on the sign-in view.
- Prefer **passkeys and Sign in with Apple, Google, or other platform providers** over passwords. If passwords are used, support password managers (`autocomplete="username"` / `current-password` / `new-password`) and 2FA (`autocomplete="one-time-code"`).
- Name the method on the button: "Sign In with Face ID" or "Continue with Passkey", not a bare "Sign In".
- **Account deletion** must be as easy to find and complete as sign-up: in-app, not buried in the privacy policy. Say when deletion completes and explain billing implications.

## 2. Loading and feedback

**Loading** — "The best content-loading experience finishes before people become aware of it."
- **Show something immediately:** the chrome, cached data, skeleton placeholders shaped like the real content (in `--fill-quaternary`, with a slow, subtle shimmer or none at all under reduced motion).
- Let people keep working while content loads in the background.
- For long waits, show determinate progress and something useful (tips, a preview). Estimate honestly.
- Avoid layout shift: reserve space for images (`aspect-ratio`) and async content.

**Feedback** — match the interruption to the importance
| Situation | Delivery |
|---|---|
| Status (synced, last updated, unread count) | Passive, inline, near the thing it describes (Mail shows "Updated Just Now" in its toolbar) |
| Success of an important, uncertain action (payment) | Brief confirmation (checkmark animation, inline message, or a transient toast that's also announced to screen readers) |
| Routine success (saved a setting) | Usually nothing: people expect success. The visible state change is the confirmation |
| A command that can't run | Explain why, inline, with the fix |
| Unexpected, irreversible data loss ahead | Interrupt: an alert or confirmation |
- **Make feedback multimodal:** visual plus text, plus haptics on native and sound where appropriate, so it works when muted, unseen, or with VoiceOver (`aria-live="polite"` for status, `assertive` for errors).
- **Toasts:** Apple seldom uses them. If you use one, keep it non-blocking, keep it on screen long enough to read (≥ 4–6s, pausable on hover and focus), never put the only copy of important information or the only way to undo in it, and position it away from primary controls.

## 3. Empty, error, and offline states

**Empty states** — "Provide clear next steps on any blank screens."
- Say what goes here and how to start, in plain words, with **one button that does it** ("No Saved Recipes" / "Tap ♡ on any recipe to save it here." / [Browse Recipes]).
- Optionally add a simple symbol or illustration in the secondary color. Let the brand voice show lightly.
- Don't put crucial information in empty states (they're temporary), and don't treat a filtered-to-nothing list like a brand-new account: "No results for 'tacos'" plus Clear Filters.

**Errors**
- **Prevent first:** constrain inputs, validate inline, disable impossible options with explanations.
- Write what happened and what to do, close to the problem: "Choose a password with at least 8 characters", not "Invalid input". No blame, no "Oops", no "we", no error codes as the headline (put codes in selectable small text if support needs them).
- Keep people's work: never clear a form on error.
- If an error will affect many people, "use that as an opportunity to rethink the interaction."

**Offline and degraded**
- Show cached content with a quiet, nonintrusive indicator ("Offline — showing saved items"), not a full-screen error or an alert at launch.
- Queue actions and sync later where possible; tell people what's pending.

## 4. Forms and data entry

- **Ask for less.** Get information from the system or context (locale, timezone, autofill, address lookup, camera scanning) rather than asking.
- **Offer choices instead of typing** wherever the set is known (menus, segmented controls, steppers, date pickers).
- **Prefill sensible defaults.** Support paste and drag and drop into fields.
- **One column, top-aligned labels,** logical tab order, related fields grouped (name, address, payment) in inset groups with headers.
- **Validate dynamically and specifically;** show requirements before people fail them (password rules visible while typing, satisfied rules ticking off).
- **Make required data clear before people try to proceed:** an enabled-when-ready Continue button, or clear marking. Keep step labels consistent ("Continue" everywhere, "Done" at the end).
- **Multi-step flows:** show where people are (Step 2 of 3), allow Back without losing data, and save drafts.

## 5. Search

- **Search as people type,** with debounce, and keep the results stable as they refine.
- Before typing, show **recent searches and suggestions;** while typing, suggest completions.
- **Most relevant first,** categorized when results are mixed (Top Hits, Apps, Documents…), with matched terms highlighted subtly in bold rather than yellow fill.
- **Scope bars** for clear categories (default to the broadest scope); **tokens** for structured filters.
- **No-results state:** echo the query, suggest corrections, and offer to clear filters.
- **Placement** — see `components.md §11`: bottom of the screen on phones when there's room, the trailing end of the toolbar on desktop, and a keyboard shortcut (⌘F or `/`).

## 6. Modality and focus

- **Use modality only when there's a clear benefit:** a critical decision, a scoped task, or focus on complex content. Every modal takes people out of context.
- **Keep modal tasks short and simple.** Avoid "an app within your app": no deep hierarchies inside a modal.
- **Always offer an obvious way out:** a Cancel or ✕ button, swipe-down on phones, and Esc.
- **Confirm before discarding user-generated content** when dismissing (Discard Changes / Keep Editing / Save).
- **Title the modal with its task** ("New Event").
- **One modal at a time.** Close one before presenting the next; never stack alerts.
- **Full-screen modals** for media viewing and immersive multistep editing.

## 7. Undo, forgiveness, and destructive actions

Forgiveness is what makes people "feel free to explore."
- **Prefer undo over confirmation** for common actions: delete immediately and offer Undo (with ⌘Z / Ctrl+Z support and an inline Undo affordance), instead of "Are you sure?" on every delete.
- **Confirm only uncommon, irreversible, destructive actions** (empty trash, delete account, publish to everyone). Make the confirmation specific: "Delete 'Q3 Report'? This can't be undone." with [Cancel] [Delete].
- **Undo is multi-level and predictable:** label what will be undone ("Undo Typing", "Undo Move"). After undoing, scroll to and highlight what changed.
- **Soft delete** with a Recently Deleted area (30 days) for user content.

## 8. Settings

- **The best setting is a great default.** "Minimize the number of settings you offer."
- **Task-specific options belong in the task** (view options in the view, sort and filter in the list), not in a distant Settings page.
- **Don't duplicate system settings** (dark mode, text size, reduced motion). Respect them instead.
- **Settings pages:** grouped lists with clear headers, a one-line footer explaining a setting's effect when it's on, and changes applied immediately (no Save button for toggles). Open with ⌘, (Command-comma) on desktop.
- **Labels describe what happens when the setting is ON;** people infer off.

## 9. Notifications

- **Be honest about urgency.** Passive (whenever), active (default), time-sensitive (this hour, about something happening now), critical (health and safety only). Never use urgency for marketing.
- **Marketing notifications need explicit opt-in,** plus an in-app way to change that choice.
- **Content:** what happened and why it matters, briefly, and actionable. Group related notifications; don't send one per minor event.
- **Web push:** ask only after a user action shows clear intent ("Notify me when it's back in stock"), never on page load.

## 10. Help and tips

- **Help fits the task:** an inline hint for one- or two-step tasks, a tutorial for complex goals. Don't explain standard components.
- **Tips:** for simple features (three steps or fewer), one or two short, actionable sentences, a relevant filled symbol, and only for people who haven't used the feature yet. Show them as a popover next to the control or inline in the flow, and let them be dismissed for good.
- **Tooltips (pointer):** describe what the control does, starting with a verb ("Show Sidebar"), in sentence case, 60–75 characters at most, without repeating the control's name.

## 11. Generative AI features

From HIG "Generative AI" (June 2026):
- **Keep people in control.** Show results as proposals people can accept, edit, retry, or undo. Surface Edit, Undo, Retry, and Adjust *next to* generated content. Acknowledge when people's corrections take effect.
- **Be transparent:** clearly mark where AI is used. Never let people think AI output was written by a person. State capabilities and limitations up front; offer example prompts and curated suggestions to start.
- **Design for hallucinations.** Say that results may contain errors; avoid asking models for facts they can't verify; never use AI output where a mistake could cause harm without human review.
- **Confirm before irreversible actions** taken on someone's behalf (purchases, deletions, sending messages). Don't automate destructive actions.
- **Privacy:** process on-device where possible, ask before using personal data, show what's sent to servers, and offer opt-outs.
- **Waiting:** generation is slow, so show *specific* progress ("Summarizing key themes from your notes", not "Processing…"), stream results when possible, and let people keep working.
- **Offer meaningfully different alternatives** when one answer can't capture intent (several image options to pick from).
- **When blocked:** explain plainly ("Unable to use that description") and suggest a better request.
- **Easy feedback:** thumbs up/down near the output (optional and non-blocking), with a path to report problems.
- **Provide a non-AI fallback** where possible. The product should still work when AI is unavailable or declined.
- **Inclusive:** don't infer personal attributes (gender, culture); ask when it matters, and test with diverse people.

## 12. Charts and data

- **Use a chart only when it reveals something** (a trend, a comparison, the current state). Otherwise a sortable table is better.
- **Prefer common chart types** (bar, line, point; combine line and points for trend plus values). Teach any novel chart type the first time it appears.
- **Headline the takeaway:** a title and subtitle that state the main message ("Chance of light rain in the next hour"), not just "Precipitation".
- **The data is the hero.** Gridlines and axes are quiet (hairline, tertiary color), with familiar tick sequences (0, 5, 10). Start bar charts at zero; line charts may use a tight dynamic range.
- **Color carries meaning, but never alone:** add labels, shapes, or patterns, and separate adjacent color areas with thin gaps. Use system colors as series colors, each with its light/dark pair.
- **Interaction is optional:** never hide critical information behind hover or scrub. Make the whole plot area the scrubbing target (marks are too small to hit), keep it keyboard navigable, and give accessible summaries using actual values and unambiguous formats ("June 6", "60 minutes").
- **Keep consistency** across related charts (same type, colors, annotations) to signal the same dataset.

## 13. Drag and drop, full screen

- **Drag and drop:** support it wherever it saves steps (reordering, moving between panes, uploading). Show a lifted preview under the pointer or finger, highlight valid drop targets, and show the drop result in place. Always provide a non-drag alternative (Move to… menu).
- **Full screen and distraction-free:** offer it for media, reading, presenting, and deep editing. Hide chrome when content is the focus, and bring it back with a tap, pointer movement, or Esc. Keep essential controls reachable, and let people choose when to exit; never exit automatically.
