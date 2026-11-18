# Writing — UI copy the Apple way

Sources: HIG "Writing" (Dec 2025), "Alerts", "Buttons", "Menus", "Privacy", "Offering help"; WWDC26 "Craft clear names for features and labels in your app"; WWDC22 "Writing for interfaces". Apple's voice is **clear, direct, warm, and confident**: never cute at the expense of clarity, never robotic.

## Contents
1. Voice and tone
2. Mechanics: capitalization, punctuation, numbers
3. Buttons, links, and menu items
4. Titles, headings, and labels
5. Errors, alerts, and confirmations
6. Empty states, onboarding, permissions
7. Naming features and settings
8. Writing for everyone (inclusive, localizable)
9. Before/after examples

---

## 1. Voice and tone

- **Decide the voice once** (who you're talking to, how they should feel) and keep a short list of preferred terms. A banking app conveys trust and stability; a game, excitement.
- **Vary the tone with the situation.** Celebratory when someone closes their rings; plain and serious when a payment fails.
- **Be clear:** the obvious word, the fewest words. "If you can use fewer words, do so. When in doubt, read your writing out loud."
- **Be action-oriented:** active voice, and verbs on controls.
- **Talk to people, not about the system.** Describe what something does *for them*, not the technology ("Enhance Dialogue", not "Vocal Isolation").
- **No "we"** ("We're having trouble loading this" → "Unable to load content"). Who is "we"?
- **Possessives sparingly** ("Favorites", not "Your Favorites"). If you use them, stay consistent and don't switch between "my" and "your".
- **No fake enthusiasm:** skip "Oops!", "Uh-oh!", and "Awesome!" for routine events. Emoji and exclamation points only when they're truly part of the brand's voice, and never in errors.

## 2. Mechanics

- **Title case** for button labels, menu items, navigation and window titles, tab labels, segmented-control labels, column headings, and alert titles that are fragments. Capitalize every word except articles (a, an, the), coordinating conjunctions (and, but, or, nor, for, so, yet), and short prepositions (four letters or fewer: as, at, by, for, from, in, into, of, on, onto, over, to, up, with), and always capitalize the first and last words. Examples: "Add to Cart", "Save as PDF", "Turn On Notifications", "Sign In with Passkey".
- **Sentence case** for descriptions, messages, footers, tooltips, placeholder hints, and complete-sentence alert titles. Pick a rule for each element type and apply it everywhere.
- **Ellipsis (…)** — the single character — on menu items and buttons that need more input before acting ("Rename…", "Export…"), and in progress labels ("Checking Out…"). Never on buttons that act immediately.
- **No ending punctuation** on labels, buttons, titles, or headings. Use periods in full-sentence messages and footers.
- **Numbers:** numerals for counts and measurements ("3 items", "Up to 24 hours"). Format dates, times, numbers, and currency with the user's locale (`Intl.DateTimeFormat`, `Intl.NumberFormat`). Prefer unambiguous formats ("June 6", not "6/6"; "60 minutes", not "60m").
- **Curly quotes and apostrophes** (" " ' '), en dashes for ranges (9–5), em dashes sparingly, and × for dimensions.

## 3. Buttons, links, and menu items

- **Start with a verb** that names the result: "Send", "Add to Bag", "Create Account", "Download Report". Prefer clarity to cleverness: "Send" beats "Let's do it!"
- **A single, consistent verb set** across a flow: "Get Started" to begin, "Continue" or "Next" in the middle (pick one), "Done" to finish.
- **Specific over generic** in consequential moments: "Delete Photo", not "OK"; "Discard Changes", not "Yes". Use "OK" only to acknowledge purely informational alerts.
- **"Cancel"** is always the label for backing out of an action.
- **Links:** describe the destination ("Learn more about privacy", "Compare all models ›"), never "click here". Say "tap" on touch devices and "click" for pointers, or use "choose" or "select" to stay device-neutral.
- **Menu items:** drop articles ("Show Sidebar", not "Show the Sidebar"). For toggles, use a changeable label ("Show Map" ↔ "Hide Map") or add a verb when state and action could be confused ("Turn HDR On").
- **Name the authentication method** on sign-in buttons ("Sign In with Face ID", "Continue with Passkey"), and only mention methods the device actually has.

## 4. Titles, headings, and labels

- **Screen and window titles:** short (under about 15 characters for toolbar titles), naming the place or task ("Settings", "New Event"), **never the app name**.
- **Section headers** in grouped lists: short nouns ("Notifications", "Privacy"), with an explanatory footer below if needed.
- **Settings labels** describe what turning the setting *on* does; add a one-line footer only if the label isn't self-explanatory. People infer the off state.
- **Field labels** are nouns ("Email"); hints show the format ("name@example.com"). Placeholders are hints, never the only label.
- **Column headings:** nouns or short noun phrases in title case.
- **Marketing headlines** (apple.com style): short, declarative, confident, sometimes a little wordplay — but always about a benefit people feel. A product-name eyebrow, then a tagline. Specific numbers beat superlatives ("Up to 24 hours of battery life" > "Amazing battery life").

## 5. Errors, alerts, and confirmations

- **Help people avoid errors first.** When one happens, show it as close to the problem as possible, with no blame, and say how to fix it.
  - "That password is too short" → "Choose a password with at least 8 characters."
  - "Invalid name" → "Use only letters for your name."
  - "Don't use numbers or symbols" → "Use only letters." (Instruct; don't scold.)
- **Alert titles** describe the situation specifically and completely, without verbosity (one or two lines). Never just "Error" or "Error 329347 occurred."
- **Alert messages** only if they add value: short, complete sentences.
- **Don't explain the buttons;** clear titles make that unnecessary.
- **Destructive confirmations** name the object and the consequence: "Delete 'Trip Notes'? This note will be deleted from all your devices." → [Cancel] [Delete].
- **Neutral, approachable tone,** but don't soften or hide severity.

## 6. Empty states, onboarding, permissions

- **Empty states:** what will appear here, plus how to get started, plus one action. "No Favorites Yet" / "Tap ☆ on any article to save it here."
- **Onboarding:** one idea per screen, short, benefit-first; "Get Started" to begin and "Continue" to proceed.
- **Permission purpose strings:** one brief, specific, complete sentence in sentence case explaining the benefit. "Your location is used to show nearby stores and their hours." Not "This app needs your location."
- **Generative AI status:** specific, reassuring progress ("Finding substitutions for ingredients"), and plain-language failures with a next step.

## 7. Naming features and settings (WWDC26)

A good name passes three tests — Apple weighs them; it doesn't require all three:
1. **Belongs:** it fits the app's voice and sits naturally among the other names, at every level of the UI.
2. **Sets the right expectation:** people can predict what they'll find. Avoid names that sound like judgments ("Spending Power" at zero feels like a verdict; "Balance" is neutral).
3. **Works everywhere:** it survives translation, markets, platforms, and being read aloud.

Process: for the audience, list what they should **think**, **feel**, and **do** when they meet the feature; group those into themes; draft names; drop the names into real sentences out loud ("Check out Visited Places"). Prefer the obvious industry-standard word when it does the job ("Balance"). Use a verb when the feature is something you *do* ("Enhance Dialogue"), emotion when the feature is about meaning ("Memories"), and a coined compound only when its parts make it self-explanatory ("AutoMix").

## 8. Writing for everyone

- **Plain language:** no jargon, idioms, or culture-specific references; gender-neutral terms ("they"; "people", not "guys"); inclusive examples and names.
- **Localization:** strings grow 30–40% in German and Finnish and shrink in CJK. Design layouts for long labels, avoid concatenating sentence fragments, and don't put text in images.
- **Accessibility text:** concise labels for icon-only controls describing the action ("Share", not "Share icon button"). Chart and image descriptions convey meaning, not appearance.
- **Write for the device:** brevity on phones and watches; big, short text for TV and shared screens.

## 9. Before/after examples

| Instead of | Write |
|---|---|
| Oops! Something went wrong. | Unable to load your orders. Check your connection and try again. |
| We couldn't save your changes | Unable to save changes. |
| Click here to learn more | Learn more about Family Sharing |
| Submit | Place Order / Send Message / Create Account |
| Are you sure? [Yes] [No] | Delete 3 photos? [Cancel] [Delete] |
| Error: Invalid email | Enter an email address like name@example.com. |
| Your Favorites | Favorites |
| Welcome to the all-new, AI-powered, next-gen dashboard! | Your projects, at a glance. |
| Loading… | Importing 24 photos… (or nothing, if it's quick) |
| Spending Power | Balance |
| Allow notifications? (on first load) | (After tapping "Notify Me") Get notified when your order ships? |
