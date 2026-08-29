# Setup

Two pieces:

- **GitHub Pages** serves `index.html` — public, static, no secrets.
- **Vercel** runs `api/timetable.js` — holds your school login, talks to the school API.

Both deploy from the same repo.

```
you.github.io/timetable  ──fetch──▶  your-project.vercel.app/api/timetable
                                              │  SCHOOL_EMAIL / SCHOOL_PASSWORD
                                              ▼
                                     intranet.nbscmanlys-h.schools.nsw.edu.au
```

---

## 1. Push the repo

```bash
cd B:/Alex/timetable && git init && git add . && git commit -m "Timetable frontend and API proxy"
```

Create an empty repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/timetable.git && git branch -M main && git push -u origin main
```

Delete `sample/` before pushing if you don't want the old version public — it contains a hardcoded email address.

---

## 2. Deploy the Vercel function

1. Go to **vercel.com/new** and import the repo.
2. Framework preset: **Other**. Leave build/output settings empty — there's nothing to build.
3. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `SCHOOL_EMAIL` | `your.name1@education.nsw.gov.au` |
| `SCHOOL_PASSWORD` | your school password |
| `SCHOOL_API_BASE` | `https://intranet.nbscmanlys-h.schools.nsw.edu.au` |
| `ALLOWED_ORIGIN` | `https://YOUR-USERNAME.github.io` |

4. Deploy. You'll get a URL like `https://timetable-abc123.vercel.app`.

Check it works — this should return JSON, not an error:

```bash
curl "https://YOUR-PROJECT.vercel.app/api/timetable?email=your.name1"
```

See **Troubleshooting** below if it doesn't.

> Env vars only apply to deployments made *after* you add them. If you added them late, hit **Redeploy**.

---

## 3. Point the page at your endpoint

The endpoint lives **only** in the source — it is deliberately not shown or
editable in Settings. In `index.html`, near the top of the `<script>`:

```js
const CONFIG = {
  ENDPOINT: "https://YOUR-PROJECT.vercel.app/api/timetable",
  EMAIL_DOMAIN: "education.nsw.gov.au"
};
```

**Keep this absolute.** A relative path like `/api/timetable` resolves against
whichever origin is serving the page, so on GitHub Pages it hits Pages' own 404
instead of the function. An absolute URL works from Pages, from Vercel and from
a custom domain alike — every origin just has to be listed in `ALLOWED_ORIGIN`.

(When the page happens to be served from the same origin as the function, the
code drops to a relative request on its own, so nothing crosses origins
needlessly.)

Commit and push.

---

## 4. Turn on GitHub Pages

Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.

A minute later it's live at `https://YOUR-USERNAME.github.io/timetable/`.

Make sure `ALLOWED_ORIGIN` on Vercel is exactly that origin — scheme and host only, **no trailing slash and no path**:

- ✅ `https://yourname.github.io`
- ❌ `https://yourname.github.io/timetable/`

Wrong value = the page loads but every fetch fails with a CORS error in the console.

---

## What the user sees

1. Opens the page → prompted for their school email (username only; the domain is appended).
2. Types it, presses Enter → timetable appears.
3. Every visit after that goes straight to the timetable — the email is in `localStorage`.

The username also sits under the heading on the page itself, so it can be changed
without opening Settings. The endpoint is not exposed anywhere in the UI.

### Reading the grid

The timetable is a repeating ten-day cycle, so the grid shows **weekday names and
the week letter, not calendar dates**. Nothing is greyed out by default.

- The **Week A / Week B** button is the only week control — tap it to swap. Each
  day name carries its week letter (`Monday A`), which you can turn off under
  ⚙ → Display.
- The current day is highlighted only while the current week is on screen.
- The lesson happening right now is outlined.
- **Today** is a toggle: press it to jump to the current week and dim everything
  except today; press again to bring the whole week back.
- The **Now** card has a progress bar and the time remaining. **Next** rolls into
  following days — after the last lesson it shows tomorrow's first. On Friday
  afternoon it reads *Enjoy the weekend* with Monday's opener underneath.

### Compact and Full

⚙ → Layout offers two ways to read the same data:

Cells are separated by the same gap horizontally and vertically — a single
constant drives both the CSS grid gap and the inset on time-positioned blocks.

**Compact** (default) positions blocks by **real clock time**. The left gutter
shows actual bell boundaries and each card's height is its duration, so free
periods are simply empty space rather than blank rows, and Wednesday's different
bell lands lower in the column on its own. Cards carry the essentials.

**Full** gives every period its own row with all days aligned, times in the left
gutter, and roomier cards. Free periods show as empty cells.

Recess and assembly get their own blocks in both; the two lunch halves are
merged into a single **Lunch**. Wednesday's assembly at 10:45 pushes its recess
to 11:05 and lunch 35 minutes earlier — both layouts reflect that.

### Display toggles

⚙ → Display:

| Toggle | Default |
|---|---|
| Week letter on day names (`Monday A`) | on |
| Coloured subject outlines — off keeps the colour as a dot | on |
| Progress bar on the Now card | on |
| Transparent background — for browser wallpapers | off |

### Transparent background (Zen)

The page paints its background through `--page-bg` / `--page-img` rather than
directly, so one toggle can drop it entirely:

```css
html.zen{ --page-bg:transparent; --page-img:none; }
```

With it on, the page canvas is transparent and a browser wallpaper (Zen and
similar) shows through. Cards, the Now/Next panels and the dialogs stay opaque,
day headings and the time gutter paint nothing, break bars gain a backing so
their labels don't sit straight on the picture, and Terminal's scanline overlay
is suppressed — it uses `mix-blend-mode: multiply` and would tint the wallpaper.

Skins whose cards are deliberately translucent (Glass, and Custom with frosted
glass on) stay translucent, which is usually the point — but contrast then
depends on the wallpaper behind them.

---

## Pages

| File | Is |
|---|---|
| `index.html` | the timetable — stays at the root of the domain |
| `home.html` | hub with links to everything, room for more |
| `notes.html` | scratchpad, saves to the device as you type |
| `games.html` | Snake, 2048, Minesweeper, Typing race, Reaction |
| `theme.css` | tokens + every skin — **shared by all pages** |
| `theme.js` | applies the saved theme before first paint — shared |
| `site.css` | page furniture for home/notes/games |

Because the theme lives in `theme.css` + `theme.js`, a skin picked on the
timetable is already applied when you land on Notes — including text size and
zoom. A change in one tab also reaches the others via the `storage` event.

To add a page: copy `notes.html`, keep the three shared `<link>`/`<script>`
tags, and write the body.

Navigation: the timetable header has a **⌂** button to the hub; the hub and
inner pages each have **Home** / **Timetable** buttons and a light-dark toggle.
The hub also carries a theme picker (⚙) with the same Plain / Classic / all
behaviour as the timetable's.

`theme.js` sets `data-view` and the outline class **before first paint**. The
compact grid positions cards absolutely off `[data-view]`, so if that attribute
is missing the cards fall back to document flow and every column stacks out of
alignment — which is exactly what happened when the attribute was only being set
by the settings handlers.

---

## Appearance

⚙ → Appearance shows four tiles — **Plain**, **Classic**, **+** and
**Custom**. Pressing **+** reveals all twelve; **Fewer** collapses it again.

| Skin | Look |
|---|---|
| **Classic** | A faithful port of the original NBSC timetable — Apple system type, frosted white panels, pastel subject dots, coloured card outlines |
| **Retro** | Early-2000s desktop: teal ground, bevelled chrome, glossy gradient title bars, Tahoma |
| **Sci-fi** | Ship's console — notched panel corners, cyan glow, wide caps |
| **Newsprint** | Broadsheet: cream stock, hairline rules, serif headlines, small-caps rooms |

and the originals:

| Skin | Look |
|---|---|
| **Plain** *(default)* | White on white, grey on grey in dark mode. Subject colour reduced to a thin edge |
| **Custom** *(last in the picker)* | Your own colours, backdrop, frosted glass, shadows, borders, radius, tint and typeface. Saved on the device |
| **Notebook** | Ruled paper, lessons as taped-on post-it notes, handwriting (Caveat / Patrick Hand) |
| **Glass** | Frosted translucent tiles over a colour mesh, Space Grotesk |
| **Swiss** | Stark white, hairline rules, coloured top bars, no shadows |
| **Terminal** | Phosphor-green CRT with scanlines and `>` prompts, JetBrains Mono |
| **Blueprint** | Navy drafting grid, dashed outlines, Space Mono |
| **Brutal** | Yellow ground, 3px black borders, hard offset shadows, Archivo Black |

Plain, Notebook, Glass, Swiss and Brutal have light and dark variants; Terminal
and Blueprint have one fixed palette each (the light/dark buttons grey out).

Subject colours are editable per subject and stored per device.

Selecting **Custom** (bottom-right of the picker) shows six everyday controls —
**Background, Card, Text, Accent, Corner radius, Typeface** — with the rest
folded into an **Advanced** dropdown, collapsed by default:

| Advanced | Does |
|---|---|
| Border colour | card outline |
| Second colour | the other colour in gradient/mesh backdrops |
| Backdrop | solid, soft gradient, or colour mesh |
| Frosted glass | translucent blurred cards, as in the Glass skin |
| Shadow | none, soft, or hard offset |
| Border width | 0–4px |
| Subject tint | how strongly subject colour bleeds into a card |

It writes to `localStorage` on that device only, and the accent's text colour is
chosen automatically for contrast. Frosted glass + colour mesh reproduces the
Glass look with your own palette.

### Subject colours

Defaults now match the original timetable: one pastel per faculty, matched on
the course name — Maths `#FFA9A6`, English `#FEFB99`, Technology `#FFD5F4`,
Science `#A4FEFF`, Music, HSIE, Languages, Visual Arts, and a spread of
fallbacks for anything unrecognised. Dark mode has its own brighter set.

Each subject gets a dropdown: **Default**, any faculty colour, or **Custom…**
which reveals a colour picker.

### Accessibility

⚙ → Accessibility:

| Control | Does |
|---|---|
| Text size | 80–150%, scales type only (`--text-scale` on the root font size) |
| Zoom | 70–150%, scales the whole interface |
| High contrast | Drops muted greys to full-strength text, thickens card borders |
| Reduce motion | Collapses transitions and animations |

All four persist and apply across every page.

### Your own school login

⚙ → Your own school login. Enter a school email and password and the timetable
is fetched **under that account** rather than the site owner's — so other
people's lookups stop going through your credentials.

Sent as `X-School-Email` / `X-School-Password` headers, never as query
parameters, so they stay out of URLs, server logs and `Referer`. The server uses
them for that request only, caches the resulting token per account, and marks
those responses `private, no-store` so they are never held at the edge. The
`ALLOWED_EMAILS` allowlist doesn't apply to someone using their own login.

> **Worth understanding before you share this with people.** The password is
> kept in `localStorage` in plain text — anything that can run a script on the
> page, or anyone with access to that browser profile, can read it. It is also
> transmitted to whichever deployment `CONFIG.ENDPOINT` points at, so users are
> trusting the operator of that deployment. It is a real improvement over
> everyone sharing one account, but it is not a substitute for a proper OAuth
> flow, which this API doesn't offer.

### Room numbers

⚙ → Room numbers: **Full** (`CR1007.118`, default), **New** (`CR1007`), or
**Legacy** (`118`). Hovering each option shows an example. The lesson detail
sheet always shows the full code.

### What the cards show

The API returns both a roll code and a proper course name; the card shows the
readable one and hides the rest:

| API field | Example | On the card |
|---|---|---|
| `CourseName` | `Engineering Studies Yr11` | **Engineering Studies** |
| `ClassCode` | `11ENGST A4` | (detail sheet only) |
| `RoomCode` | `ER0020.166` | **166** |
| `Teacher` | `stephen.henne@det.nsw.edu.au` | **Stephen Henne** |

Room numbers keep only the part after the final dot. Teacher names are derived
from the email local-part when the API gives an address rather than a name.

To rename a subject for display, edit `SUBJECT_RENAMES` near the top of the
script in `index.html`:

```js
const SUBJECT_RENAMES = {
  'Mathematics Extension 1': 'Maths Ext 1',
};
```

Clicking any lesson opens a detail sheet with the full room code, the teacher's
email, the class code and the original course name.

---

## Putting it on mscunofficial.com

The domain is registered at Cloudflare and the site runs on Vercel, which serves
**both** `index.html` and `/api/timetable`. Pointing the domain at Vercel puts
everything on one origin, which means CORS stops mattering entirely.

### 1. Add the domain in Vercel

Project → **Settings** → **Domains** → add `mscunofficial.com`, then add
`www.mscunofficial.com` and set it to redirect to the apex.

Vercel then shows the exact DNS records to create. **Use the values Vercel
displays** — they occasionally change.

### 2. Create the records in Cloudflare

Cloudflare dashboard → `mscunofficial.com` → **DNS** → **Records**. Typically:

| Type | Name | Content |
|---|---|---|
| A | `@` | the IP Vercel shows |
| CNAME | `www` | `cname.vercel-dns.com` |

### 3. Set both records to "DNS only" — this is the part that bites

Click the orange cloud on each record so it turns **grey**.

With the proxy on, Cloudflare terminates TLS itself and intercepts the
verification handshake, so Vercel cannot issue its certificate. The symptoms are
`Failed to generate cert`, `Invalid Configuration`, or a redirect loop.

Once Vercel reports the domain as **Valid** with a certificate issued, you *can*
switch the proxy back on if you want Cloudflare's caching — set SSL/TLS mode to
**Full (strict)** first. Leaving it grey is perfectly fine and is the simpler
path.

### 4. Add the new origin to ALLOWED_ORIGIN

Set `ALLOWED_ORIGIN` in Vercel to a comma-separated list covering **every**
origin the page is served from, then redeploy:

```
https://mscunofficial.com,https://www.mscunofficial.com,https://alexburns2.github.io
```

Leave `CONFIG.ENDPOINT` absolute. When the page is served from the same origin
as the function the code uses a relative request automatically, so pointing the
domain at Vercel costs nothing — and anyone still on the Pages URL keeps
working.

### 5. Retire GitHub Pages

With the domain on Vercel, the Pages copy is redundant — repo → Settings →
Pages → set Source to **None**, so there is only one live version to keep
current.

---

## Troubleshooting

### Start here: the diagnostic probe

```bash
curl "https://YOUR-PROJECT.vercel.app/api/timetable?diag=1"
```

This POSTs **dummy** credentials to several candidate token paths and reports what
each one returns. It never sends or echoes your real email, password or token.

```json
{ "apiBase": "https://…",
  "env": { "SCHOOL_EMAIL": true, "SCHOOL_PASSWORD": true, "SCHOOL_API_BASE": true },
  "probes": [ { "path": "/token", "status": 302, "redirectsTo": "https://login…", "isHtml": false },
              { "path": "/api/token", "status": 401, "looksJson": true } ] }
```

Read it like this:

- **`apiBase` is not the school intranet** → `SCHOOL_API_BASE` is wrong. Fix and redeploy.
- **A path shows `looksJson: true`** (usually status 400/401 for dummy creds) → that
  is the real token endpoint. If it isn't `/token`, set `SCHOOL_TOKEN_PATH` to it.
- **Every path shows `isHtml: true` or `redirectsTo` an external host** → the intranet is
  answering with a sign-in page rather than the API. That's an authentication or
  network-origin problem, not a URL typo — see below.
- **`error` on every path** → the host is unreachable from Vercel.

Once it works, you can delete the `if (req.query.diag)` block from
`api/timetable.js` if you'd rather not leave it exposed.

The function also reports the *resolved URL* and the first bytes of any bad response
to the Vercel logs, so the logs will usually name the problem outright.

### `Unexpected token '<', "<!doctype "... is not valid JSON`

`POST {SCHOOL_API_BASE}/token` answered with a **web page instead of JSON**.
The base URL is pointing at something that serves HTML. Check, in order:

1. **Is it the Vercel or GitHub Pages URL by mistake?** This is the most common
   cause — the function then calls itself and gets its own HTML back.
2. **Does it have a trailing path?** It must be the bare origin.
   ✅ `https://intranet.nbscmanlys-h.schools.nsw.edu.au`
   ❌ `https://intranet.nbscmanlys-h.schools.nsw.edu.au/api`
3. **Did the value get saved with quotes around it?** Vercel takes the value
   literally, so `"https://…"` becomes part of the URL.
4. **Did you redeploy?** Env vars only apply to deployments made after they were
   added or changed.

The current code turns this into a readable message rather than a parse error:

```json
{ "error": "The school API returned a web page instead of JSON. Check that SCHOOL_API_BASE is the intranet origin with no trailing path.",
  "hint": "check-api-base" }
```

### `/token` returns a 200 HTML page

This is what NBSC's intranet does: it serves its single-page-app shell with a
**200** for any unrecognised path, so a wrong path looks like a success rather
than a 404. The auth endpoint lives at **`/api/token`**, which is the default —
`/token` (as used by the older sample) now hits the SPA catch-all.

If it moves again, find it with the probe and set `SCHOOL_TOKEN_PATH`.

### Every probe returns an HTML page (or a redirect)

If `SCHOOL_API_BASE` is definitely correct and `/token` still answers with a web
page, the intranet is serving a **sign-in page instead of the API**. Common causes:

- The token endpoint moved. Find it with the probe and set `SCHOOL_TOKEN_PATH`.
- The intranet sits behind DoE single sign-on, and an unauthenticated server-side
  request gets redirected to the login page. A browser session works because it
  already holds SSO cookies; Vercel has none. If `redirectsTo` points at
  `login.microsoftonline.com` or a DoE portal, this is what's happening — the
  `emailAddress`/`password` flow alone can't satisfy it.
- The school restricts the API by IP or blocks datacentre traffic.

The probe output distinguishes these: a moved path still answers JSON somewhere,
whereas an SSO wall redirects every path to the same external host.

### `The school rejected SCHOOL_EMAIL / SCHOOL_PASSWORD`

Exactly what it says — the credentials failed at `/token`. Retype them in Vercel
(watch for a trailing space) and redeploy.

### `Could not reach the school API`

DNS or network failure reaching `SCHOOL_API_BASE`. Usually a typo in the host.

### It works for you but 404s for someone else

Check the **host** of the failing request in their devtools, not just the status.
If it reads `yourname.github.io/api/timetable` rather than your Vercel domain,
`CONFIG.ENDPOINT` is relative — a relative path resolves against whatever origin
served the page, and GitHub Pages has no `/api/` route, so it returns its own
HTML 404. The giveaways are `server: GitHub.com`, `content-type: text/html` and
`Sec-Fetch-Site: same-origin`.

Make `CONFIG.ENDPOINT` absolute (see step 3) and confirm their origin is in
`ALLOWED_ORIGIN`. You can check the allowlist from a terminal:

```bash
curl -s -D - -o /dev/null -H "Origin: https://alexburns2.github.io" "https://YOUR-PROJECT.vercel.app/api/timetable?email=your.name1" | grep -i access-control-allow-origin
```

The header should echo the origin you sent. If it echoes a *different* one, that
origin isn't on the list.

GitHub Pages caches aggressively (`x-cache: HIT`), so after redeploying have
them hard-refresh.

### The page loads but every request fails with a CORS error

`ALLOWED_ORIGIN` doesn't match your GitHub Pages origin. It must be scheme and
host only — no trailing slash, no path.

### The timetable is out of date

The page sends `cache: no-store`, so the browser always revalidates; Vercel's
edge cache still answers for 15 minutes without touching the school API. To force
a fully fresh pull, open Settings and hit **Save & reload** (this clears the local
copy too).

---

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `SCHOOL_EMAIL` | yes | Account used to authenticate |
| `SCHOOL_PASSWORD` | yes | That account's password |
| `SCHOOL_API_BASE` | yes | School intranet base URL, no trailing slash |
| `ALLOWED_ORIGIN` | no | Comma-separated origins allowed to call the API. Defaults to `https://alexburns2.github.io` |
| `ALLOWED_EMAILS` | no | Comma-separated usernames allowed to be looked up. **Unset means anyone can look up anyone.** |
| `SCHOOL_TOKEN_PATH` | no | Auth path on the school API. Defaults to `/api/token` |
| `EMAIL_DOMAIN` | no | Defaults to the domain of `SCHOOL_EMAIL` |

### Locking it down

As shipped, anyone who opens the site can type any student's username and see that person's timetable — because the school API lets a token holder request any user's data, and the token is yours. Every one of those lookups is your account querying another student's schedule.

To restrict it to specific people, set:

```
ALLOWED_EMAILS = your.name1, mate.surname2, other.person3
```

Anything else gets a 403.

---

## Local development

```bash
npx vercel dev
```

Serves `index.html` and `/api/timetable` together on `http://localhost:3000`. Add `http://localhost:3000` to `ALLOWED_ORIGIN` while developing.

---

## How it works

**Auth.** The function POSTs `{emailAddress, password}` to `{SCHOOL_API_BASE}/token`, gets a JWT, and caches it in module scope. It decodes the `exp` claim (no signature check needed — the school API validates it when used) and re-authenticates an hour before expiry, or immediately if a request comes back 401. Warm Vercel instances reuse the token, so most requests involve no login at all.

**Data.** With a valid token it fetches four things in parallel:

| Path | Gives |
|---|---|
| `/api/timetable/{email}` | the lessons |
| `/api/timetable/bell-times` | period start/end times |
| `/api/timetable/settings/start-date` | when the A/B cycle began |
| `/api/user/{email}` | the student's name |

The last three are optional — if any fails the page still renders.

**The A/B cycle.** The API doesn't return calendar dates. It returns a repeating ten-day fortnight keyed by `DayName`: `MonA`, `TueA` … `FriB`. The frontend counts weekdays elapsed since the cycle start date, mods by 10, and maps that onto the grid. That's why the start-date call matters — without it the page can't tell Week A from Week B.

Day 0 of the cycle is treated as a **Monday**: the start date is snapped back to the Monday of its own week before counting. If the API ever returns a mid-week start date, this keeps the Monday column showing Monday's lessons instead of silently shifting every day.

**Caching.** Responses carry `s-maxage=900`, so Vercel's edge serves repeat opens without touching the school API. The browser also keeps the last payload in `localStorage` for 6 hours and renders it instantly on load, then refreshes in the background.

---

## Security notes

**The JWT never reaches the browser.** This is the main difference from `sample/token.js`, which returned the raw token to the page. `Access-Control-Allow-Origin` is enforced by browsers only — it does nothing against `curl`. Since the Vercel URL is visible in the public repo, that older endpoint would hand a working school-intranet token to anyone who asked, usable for anything your account can do. Here, the token stays server-side and only timetable JSON goes out.

**Your password lives only in Vercel env vars.** Never commit it. `.gitignore` covers `.env`.

**Errors are deliberately vague to the client.** Real causes go to the Vercel logs.

**Still worth knowing:** anyone who finds the endpoint can pull timetables through your account at whatever rate they like. `ALLOWED_EMAILS` is the fix if that matters to you.

---

## Recent additions

**Class lists.** Clicking a period opens the detail sheet with a **View class
list** button. It calls the proxy with `?class=<ClassCode>`, which fetches
`/api/timetable/class/{code}` from the school API and returns the roster. The
frontend pulls names tolerantly (FirstName/LastName/FullName/Email) since the
exact field shape isn't documented.

**Login is mandatory.** First run shows a sign-in modal requiring email **and**
password, stored on the device (`tt.creds`) and sent as `X-School-Email` /
`X-School-Password` headers. The identity pill in the header reopens it; Settings
has the same fields plus **Sign out**.

**Settings are split.** The main popup holds Appearance, Light/dark and Login
only. Three buttons open sub-panels — **Access** (text size, zoom, contrast,
motion), **Display** (layout, room format, options), **Colours** — and **Export
.ics** downloads the next four weeks as a calendar file.

**Classic is the default theme**, swapped with Plain in the picker.

**Header** is one rounded widget: identity left, Now/Next middle, settings + home
stacked right. Week A/B arrows sit centred above the grid. Click any day heading
to spotlight it; there is no separate Today button, and dark mode lives only in
Settings.

---

## Syncing settings to an account (not just the device)

Right now every preference — theme, credentials, notes, colours — lives in
`localStorage`, which is per-browser. To follow a user across devices you need a
tiny bit of server state keyed by identity. Options, cheapest first:

1. **A key-value store behind the existing Vercel function.** Add a
   `/api/prefs` route backed by Vercel KV (Upstash Redis) or Vercel Postgres.
   Key by the user's school email (they already sign in), value is the JSON blob
   currently in `localStorage`. On load, `GET /api/prefs?email=…` and merge over
   the local copy; on change, debounce a `PUT`. ~40 lines. The catch: the school
   email is the only identity you have, and it's not *authenticated* to you —
   anyone could request anyone's prefs unless you gate it. Since the user already
   supplies a password that the school validates, you can require the same
   `X-School-*` headers and only return prefs after the school API accepts the
   token — so possession of prefs follows possession of the real login.

2. **Their own storage, not yours.** A "Sync" toggle that reads/writes the
   settings JSON to the user's Google Drive *appDataFolder* or a GitHub Gist via
   OAuth. No database to run or secure, and the data never touches your server —
   but it's more UI and an OAuth flow per provider.

3. **Export / import.** A "Copy settings" / "Paste settings" pair (the JSON blob
   as text, or a URL hash). Zero backend; the user moves it manually. Good enough
   for a handful of power users.

For this project I'd do **(1) with the school-token gate**: it reuses the login
you already have, needs no new accounts, and Vercel KV has a free tier. Keep
`localStorage` as the offline cache and treat the server copy as the source of
truth on load. Notes should sync the same way but stored separately, since
they're larger and change more often.
