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
| `games.html` | Guess Who ×2, Tetris, Classroom, Six Degrees, Odd One Out, Snake, 2048, Memory, Minesweeper, Typing race, Reaction |
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

## Settings sync (implemented — Phase 1)

Preferences now follow the **account**, not the browser. Every `tt.*` setting
(theme, colours, layout, accessibility, stats…) mirrors to a small table keyed
by the user's verified school email; `localStorage` stays as the offline cache.

**Identity, not a new login.** There is no second account system. The browser
sends the same `X-School-Email` / `X-School-Password` headers it already uses
for the timetable; the server re-authenticates them against the school API and
the email in the resulting JWT *is* the identity. Possession of settings follows
possession of the real school login. The database key is stored server-side with
the service-role key — the browser never touches the database.

**Never synced:** `tt.creds` (the password — the server strips it even if sent),
`tt.cache` (the bulky device-local timetable copy), `tt.notes` (stored as a raw
string, not JSON — would need its own row), and `tt.syncedat` (per-device sync
bookkeeping).

### Files

| File | Role |
|---|---|
| `api/_supabase.js` | `db` (service-role client) + `whoami(req)` — verifies the caller by their school login. Underscore prefix keeps it out of routing. |
| `api/prefs.js` | `GET`/`PUT /api/prefs`, keyed by `whoami().email`. |
| `theme.js` | client: `syncPull()` on load, debounced `syncPush()` on change, `pagehide` flush. |
| `index.html` | its local `set()` calls `TT.syncPush()`; the login handler calls `TT.syncPull()`. |

**How the client stays loop-free.** A pull is gated on the server's `updated_at`
stamp (stored locally as `tt.syncedat`), *not* on comparing values — jsonb does
not preserve object key order, so a value-diff would reload forever. When a pull
finds a newer stamp it adopts the settings and reloads **once** (so the page's
in-memory state and grid DOM rebind to the synced values); after the reload the
stamps match and it settles. A `pulling` flag stops adopted values bouncing
straight back out as a push.

### What you need to set up (one time)

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free
   tier). Project → **SQL Editor** → run:
   ```sql
   create table prefs (
     email      text primary key,
     data       jsonb not null default '{}',
     updated_at timestamptz not null default now()
   );
   ```
   RLS can stay **off** — only the service-role key (server-side) ever touches
   this table; the browser has no direct access.

2. **Copy two secrets** from Supabase → **Project Settings → API**:
   - Project URL → set Vercel env var `SUPABASE_URL`
   - `service_role` secret (NOT `anon`) → set `SUPABASE_SERVICE_ROLE_KEY`

3. **Add both env vars in Vercel** (Settings → Environment Variables), then
   **redeploy** (env vars only apply to deployments made after they're added).
   `package.json` already lists `@supabase/supabase-js`, so Vercel installs it.

4. **Verify.** With the site deployed and signed in, change a theme on one
   browser, open the site signed-in on another, and it should adopt the change on
   load. If `SUPABASE_*` is missing, `/api/prefs` returns `503 not configured`
   and the app simply runs local-only — nothing else breaks.

> **Why Supabase and not Vercel KV.** Vercel's own KV/Postgres were retired in
> 2024; storage now comes from the Vercel Marketplace (Supabase / Neon / Upstash).
> Supabase is chosen because Phases 2–3 (daily Guess Who, realtime boards) reuse
> the same Postgres + its Realtime/JWT layer — see `HANDOFF.md`.

---

## Daily Guess Who (Phase 2)

A once-a-day puzzle, Wordle-style: **one mystery student from your own year, the
same for everyone in that year, chosen and graded on the server.** The answer
never reaches the browser — guesses are POSTed and graded server-side. One hint
shows to start, one more per wrong guess; you get as many guesses as there are
hints. A streak counts consecutive winning days.

Scope is deliberately **your own year only** — the same footing as the practice
game's "My grade" mode. A whole-school daily would name strangers.

### How the pick works

The mystery person is a **deterministic** function of the date + year (an FNV
hash over a roster sorted by email), so the midnight cron and a lazy
first-request both land on the same person, and an `ignoreDuplicates` upsert
means whoever writes the row first wins. That also means **you don't strictly
need the cron** — `/api/daily` generates the day's puzzle on first request if
it's missing. The cron is just pre-warming so the first player doesn't wait for
the directory fetch.

### Files

| File | Role |
|---|---|
| `api/_daily.js` | the engine: `ensurePuzzle`, `resolveYear`, `computeStreak`, deterministic pick + name-shape hints. Underscore = not a route. |
| `api/daily.js` | `GET` (state) / `POST` (grade a guess), keyed by verified email + year. |
| `api/daily-generate.js` | cron target; builds years 7–12 for the day. Guarded by `CRON_SECRET`. |
| `api/timetable.js` | now exports `fetchAsOwner(path)` — fetches the directory as the server's own account (identity-independent, so the cron can run with no user). |
| `vercel.json` | the cron schedule. |
| `games.html` | the **Daily Guess Who** card + `BUILD.dailyguess`, using `TT.api`. |

### What you need to set up

1. **Run the table SQL** in Supabase → SQL Editor (reuses the Phase-1 project):
   ```sql
   create table daily_puzzle (
     date       date not null,
     year       text not null,
     target     jsonb not null,     -- { name, first, last, hints[] } — server-only
     candidates jsonb not null,     -- [names] for the datalist
     created_at timestamptz not null default now(),
     primary key (date, year)
   );
   create table daily_result (
     email      text not null,
     date       date not null,
     year       text not null,
     guesses    int  not null default 0,
     won        boolean not null default false,
     done       boolean not null default false,
     updated_at timestamptz not null default now(),
     primary key (email, date)
   );
   ```
   RLS stays **off** — only the service-role key touches these.

2. **(Optional) Enable the cron.** Add a `CRON_SECRET` env var in Vercel (any
   long random string). Vercel sends it to the cron automatically; without it the
   generator route refuses all callers, and puzzles are still built lazily. On
   the Hobby plan crons run about once a day — fine for this. The schedule in
   `vercel.json` is `0 14 * * *` (UTC), which is just after midnight in Sydney
   year-round.

3. **Redeploy.** No new npm dependency beyond Phase 1's `@supabase/supabase-js`.

4. **Verify.** Signed in, open **Games → Daily Guess Who**. Signed out,
   `curl https://…/api/daily` returns `401`; a `503` means `SUPABASE_*` is unset.

> **Privacy.** The candidate list sent to the browser is the player's own year
> roster (names only) — the same data the practice game's grade mode already
> exposes. It's fetched fresh behind the verified login and marked
> `private, no-store`; the target's identity is never sent until the round ends.

### Past puzzles, Unlimited, and live hints

- **Hints are recomputed from the stored name on every read** (`buildHints` in
  `_daily.js`), not baked into the puzzle row. So changing the hint logic applies
  immediately to *already-generated* puzzles — no regeneration or table wipe
  needed. Only the answer + candidate list are stored per day.
- **`GET/POST /api/daily` take an optional `date`** (default today, Sydney; up to
  30 days back, never the future), so you can **replay past days**. The game shows
  a row of day-chips (✓ won / ✗ lost / plain unplayed) from a `history` field, and
  an **Unlimited →** button that jumps to the practice Guess Who.
- **Reopen fix:** a finished puzzle now shows exactly the hints you saw
  (`shown = done ? guesses : guesses+1`), instead of revealing one phantom extra.
- Completing a past day still updates your streak (computed relative to today).

---

## Tetris (Sprint / Survival / Zen, tetr.io-style)

A tetr.io-style layout — **Hold + stats on the left, board centre, Next + buttons
on the right** — with three modes (pills at the top):

- **Sprint** — clear 40 lines fastest. Pieces are a **deterministic weekly 7-bag**
  (Monday-anchored), identical for everyone and replayed the same each attempt, so
  times are comparable. Local best per week (`tt.stats.tetris`); weekly board.
- **Survival** — survive the **rising speed**; random pieces, gravity ramps
  **hard and fast** (halves ~every 12s, floors near 20G) so games stay tense and
  don't drag. Local best all-time (`tt.stats.tetriszen`); all-time board.
- **Zen** — endless and **relaxed**: uses your chosen gravity, a simple **points
  score** (100/300/500/800 per 1–4 lines) in place of the clock, and a
  **scoreboard showing everyone's current score next to their all-time best**
  (never resets).

**Cross-device save** (Survival + Zen): a **Save** button uploads the current board
(grid, active piece, hold, next queue, cleared, elapsed) to `/api/gamestate`, keyed
by `(email, mode)` — manual, not continuous. Reopen the mode (any device) and it
offers **Resume / New game**. The save is cleared on top-out or when you start fresh.

It **does not auto-start** — a board overlay shows "Press Start" and the game
begins on the Start button or the hard-drop key; game-over shows a Restart prompt.

Rotation is proper **SRS** — spawn pieces in SRS boxes (3×3 for JLSTZ, 4×4 for I),
rotation states, and the standard **wall-kick tables** (JLSTZ + I), so wall kicks
and T-spins behave as in tetr.io. There's also a **180 spin** (default `A`) with a
compact 180 kick set.

Handling: one time-based loop drives gravity, **DAS/ARR** auto-shift, a **lock
delay** (15-move reset cap, so you can slide under overhangs), soft drop (hold
down), hold (once per piece), a hollow-outline landing preview, and hold-rotate
that spins after a brief pause.

**Layout** is tetr.io-style: **Hold on the left, board centre, Next on the right
showing the next 4 pieces**, buttons below. It stays that way on narrow screens —
the three columns don't wrap; the board scales down (`max-width`) so Next stays on
the right.

**Controls are configurable** (Controls button → panel): every action is
**rebindable** (click a key, press the new one) — including Rotate CW / CCW / 180.
Sliders: **DAS**, **ARR**, **soft drop** (down to 0 = instant), **DAS-cut-delay
(DCD)**, and **gravity** (normal fall speed for Sprint/Zen). A checkbox,
**"Accelerate side-to-side the longer you hold"**, ramps auto-shift up to instant
over ~0.4s of holding (an alternative to fixed ARR). Config is stored in
`tt.tetriscfg`, so it syncs with your other settings. Defaults: ← → move,
↑ CW (hold to spin) / Z CCW / A 180, ↓ soft drop, space hard drop, Shift hold,
**P pause, R restart**.

### Leaderboards

`/api/tetris` serves several boards, all `whoami`-verified with a server-derived
name (emails never leave the server; your own row is flagged `you`):

- **Sprint** — two tabs: `?mode=sprint&week=N` (this week, ranked by **shortest**
  time, resets weekly) and `?mode=sprintall` (**all-time fastest**, never resets).
- **Survival** — `?mode=zen`, ranked by **longest** survival, all-time. (The server
  mode name stays `zen`, backed by `zen_score` — it predates the rename; the client
  maps *Survival* → `zen`.)
- **Zen** — `?mode=zenscore`, each player's **current score next to their all-time
  best**, ranked by best, never resets.

Submitted on a 40-clear (Sprint, to both weekly + all-time), top-out (Survival), or
top-out/save (Zen). The two new modes use **separate tables** so existing weekly/
survival data is untouched.

**Setup:** run these tables in the same Supabase project; no new env vars.
`game_state` powers the Survival/Zen cross-device save; `sprint_best` and
`zen_board` are the new all-time boards.
```sql
create table tetris_score (
  email text not null, week int not null, name text not null,
  time_ms int not null, created_at timestamptz not null default now(),
  primary key (email, week)
);
create table zen_score (
  email text primary key, name text not null,
  ms int not null, created_at timestamptz not null default now()
);
create table game_state (
  email text not null, mode text not null, state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (email, mode)
);
create table sprint_best (
  email text primary key, name text not null,
  time_ms int not null, created_at timestamptz not null default now()
);
create table zen_board (
  email text primary key, name text not null,
  current int not null default 0, best int not null default 0,
  updated_at timestamptz not null default now()
);
```
RLS off (service-role only). Times are client-reported, as with any web
leaderboard — floor/ceiling bounds drop obvious garbage, but it isn't anti-cheat.
Signed out or unconfigured, the boards just hide and the game still plays locally.

---

## Game leaderboards (all games)

Beyond Tetris, the arcade games share a **generic leaderboard**: Snake, 2048,
Typing race, Reaction, Classroom, and Six Degrees. Each shows a panel under the
game with two tabs — **This week** (a weekly-reset challenge board) and **All time**
(the unlimited board). A new personal best submits automatically.

- `api/leaderboard.js` — `GET ?game=&metric=&week=N` / `POST {game,metric,score,week}`,
  both returning `{ week, all }`. Same `whoami` identity + server-derived name as the
  other boards; higher- or lower-is-better is per game (server-side `DIRS`).
- `games.html` — `recordStat` is the single submit point (a new best posts to the
  board); `openGame` mounts the panel; `LB_GAMES` maps each game to its metric,
  direction, and number formatting. Every score lands in **two buckets**: `all` and
  `w<week>`.

**Setup:** one more table, no new env vars.
```sql
create table game_score (
  game text not null, metric text not null, period text not null,
  email text not null, name text not null, score int not null,
  updated_at timestamptz not null default now(),
  primary key (game, metric, period, email)
);
```
RLS off (service-role only). Signed out / unconfigured → the panel shows a sign-in
note or hides, and the games still play with local high scores. Tetris keeps its own
dedicated boards (Sprint weekly, Zen all-time). To add a game: extend `LB_GAMES`
(client) and `DIRS` (server).

## Games polish & two new games (latest)

**No database changes.** These are client-only (`games.html` + a little CSS); the
leaderboard tables and the Classroom/Six Degrees metric keys are untouched, so
existing scores stay valid.

- **Minesweeper** — three sizes (Easy 9×9/10, Medium 13×13/28, Hard 16×16/45) via
  difficulty pills; **first dig is always safe** (the click *and its neighbours* are
  kept mine-free, so you always open a flood); higher-contrast raised/sunken cells +
  classic number colours that work in every skin; live mine counter and timer; **flag
  mode** toggle for touch; right-click flag; **chording** (click an opened number whose
  flags match to sweep the rest); win records a per-size best time.
- **Classroom** — was a fill-in with a giveaway autocomplete; now a **timed
  multiple-choice run** mixing *where is your X* / *who takes your X* / *which class in
  room Y*, all drawn from your own timetable, with a per-question clock, streak and
  3 lives. Score is still `high` = correct answers (same leaderboard).
- **Six Degrees** — longer chains (par 3–6, widening if the graph is small) and a
  **hop budget** (par + 2): run out and the target gets away. Still records fewest hops.
- **Odd One Out** (new, 🧠) — timetable recall: three of four people share one of your
  classes, tap the one who doesn't, against a shrinking bar; 3 lives. Local best only.
- **Memory** (new, 🃏) — match-pairs with three grid sizes; tracks best moves per size.
  Local only.
- **Snake** speeds up as you grow; **Typing race** has more lines + a New-text button.

New local stat keys: `mines.best<size>`, `memory.best<size>`/`plays`, `oddone.high`.
`oddone` and `memory` are deliberately **not** in `LB_GAMES`, so nothing hits the API.

## Second games pass + Resources + Daily upgrades (latest)

**Still no new tables.** Everything reuses `game_score` and `daily_result`. One new
**optional** env var: `OWNER_EMAIL`.

- **Leaderboards page** (`BUILD.leaderboards`, a 🏆 card) — one place for every board:
  a game picker, This-week / All-time tabs, and the Tetris boards (Sprint/Survival/Zen)
  folded in. Redeploy needs nothing new.
- **Wipe a board (owner only)** — `POST /api/leaderboard {action:'wipe', game, metric}`
  deletes that game's rows from `game_score`. Gated server-side to `OWNER_EMAIL`
  (set it to your school login, e.g. `alex.burns6@education.nsw.gov.au`; **unset ⇒ nobody
  can wipe**). The GET response now carries `canWipe` so the button only shows for you.
- **Six Degrees → timed gauntlet** — reach a target, get another instantly; chain as many
  as you can in 90s; targets sit further away as your score climbs. New metric
  `chain:targets` (higher = better). The old `chain:best` rows are left in place (not
  shown, not deleted); wipe if you want them gone.
- **Odd One Out** now has a leaderboard (`oddone:high`) and speeds up over the run.
- **Classroom** — countdown now accelerates; room questions throw in **one-digit-off red
  herrings** (GYM.1 → GYM.0/GYM.2) generated from the real code, so options look alike.
- **Typing race** — sentences are now random words (uncheeseable); **paste and drag are
  blocked**, big input jumps are rejected, and any run over 1000 wpm (or under 0.5 s) is
  **disqualified** (not recorded).
- **Sound & animation** (`SFX` in games.html) — synthesised Web-Audio blips, no files.
  Toggles live in Settings → Accessibility (`tt.gamesfx` default off, `tt.gameanim`
  default on, which also honours reduce-motion) and there's a 🔊 quick-toggle in the
  games header.
- **Tetris practice mode** — a 4th mode: zen-like, **undo/redo** (buttons + `U`/`Y`),
  nothing tracked, no board, no save.
- **Daily Guess Who** — graded **in the browser** now (the GET returns the day's `answer`
  + full hints), so guesses are instant; the guess still POSTs in the background to keep
  streaks, cross-device state and the summary correct. Added a **"How others did"**
  histogram (`?summary=1`) and a **Sept-1 archive** (`?archive=1`, days with results).
  `EPOCH = 2026-09-01` in `api/daily.js` bounds how far back you can go.
  *Trade-off:* the answer now reaches the client (needed for instant grading), so it's
  visible to anyone who opens dev-tools — fine for a casual game, but not secret.
- **Resources** (`resources.html`, linked from home) — textbooks by **year → subject**,
  seeded from the HSC Textbook Library Drive folder (real per-subject folder ids baked in;
  clicking a subject opens that Drive folder). Edit the `RES` map to add/replace subjects.
- **UI**: home controls moved top-right; timetable name/email vertically centred; games
  Home/Timetable buttons got real icons (🏠 / 🗓️) instead of the misleading back-arrow.

## Games UI pass + Admin panel (latest)

**No new tables.** One new server capability: owner-only score editing (reuses `game_score`).

- **Leaderboards** are no longer a card. A summarised strip (each board's #1) sits
  **under the game grid**, with "View all →" opening the full read-only board view.
  The full view lost its Reset button (controls moved to Admin).
- **Admin** (🛠️ in the header, shown only when the server says you're the owner via
  `OWNER_EMAIL`) → `BUILD.admin`: pick a board, **reset it**, or **edit / delete
  individual scores**. New `POST /api/leaderboard` actions, both owner-gated:
  `action:'set'` `{game,metric,period,email,score}` and `action:'delete'`
  `{game,metric,period,email}`. `period` is `'all'` or `'w<week>'` (whichever tab is
  open). The board GET now includes each row's `email` **only for the owner**, so the
  panel can target rows.
- **Six Degrees** pre-start now shows the real board **greyed out with hidden names and a
  blank "Reach ______"**; hitting Start flips the tiles in and fills the target/current.
- **Classroom** got a **Start screen** (prep time) and starts slower (~12s) then speeds up.
- **Daily Guess Who** decluttered: discrete text buttons (**Show/Hide archive**,
  **Show/Hide summary**), the day chips are **hidden until Archive**, and the summary sits
  **below your own result**. The summary now returns per-bucket **names** (`summary.names`)
  so hovering a histogram row shows exactly who solved it in that many guesses.
- **Sound**: much louder, and the header button is now **tap = mute, hold = volume slider**
  (`tt.gamevol`, 0–1, default 0.7; dragging also unmutes). Also in Settings.
- **Tetris practice** undo/redo hotkeys: **U / Ctrl+Z** undo, **Y / Ctrl+Y** redo (labelled
  on the buttons).
- Captions trimmed across the board and em-dashes removed.

## Tetris juice + Settings on the home page (latest)

- **Tetris** now has sound + animation: move / rotate / hold / soft-lock blips, a
  hard-drop **thud + board shake**, a **line-clear flash** (rainbow for a Tetris), and
  win/top-out stingers. All go through the same `SFX` object (respects the volume
  slider) and the flash/shake honour the reduce-motion setting.
- **Settings on the home page.** The timetable's settings are unchanged; the home page
  gets its own copy via two new files, `settings.css` + `settings.js` (loaded only by
  `home.html`; the gear button opens it). It covers Appearance, Custom theme, Login,
  Accessibility and Display — everything drives through `theme.js`'s `TT.apply`, so it
  themes every page identically. **Subject colours** and **.ics export** stay on the
  timetable only (they need the live parsed timetable, not just cached data).
  No new deploy steps — just ship `home.html`, `settings.css`, `settings.js`, `games.html`.

## Tetris in Admin + Flashcards (latest)

- **Admin now covers the Tetris boards** too (Sprint weekly, Sprint all-time, Survival, Zen),
  alongside the generic ones — edit a value, delete a row, or reset the board. `api/tetris.js`
  gained owner-gated actions (`OWNER_EMAIL`, same env var as the leaderboard): `?admin=1` on a
  GET returns each row's email to the owner; `POST {mode, action:'set'|'delete'|'wipe', email,
  value, week}` edits one board.
- **Sync weekly → all-time**: `POST /api/tetris {action:'sync'}` (owner only) backfills
  `sprint_best` from every `tetris_score` row (min time per player). Fixes the case where the
  all-time Sprint board was missing players who only had weekly times. The Admin panel has a
  "Sync weekly → all-time" button on the Sprint boards.
- **Flashcards** (new, Revision category) — a custom deck maker: create decks, add/edit/delete
  Q&A cards, and study (flip, self-grade Again/Got it, shuffle). Decks live in `tt.flashcards`,
  so they sync across devices like other settings. No server or DB involvement.
- The games grid is now grouped into **Revision / Timetable / Arcade** sections.

Deploy: ship `games.html` and redeploy `api/tetris.js`. No new tables.

## Shared flashcards + revision games (latest)

- **Public flashcard decks.** In Flashcards: **Share** a deck (pick a category) publishes it;
  **Browse public decks** lists everyone's by category and **Import** copies one into your decks.
  New endpoint `api/decks.js` (same `whoami` identity; authors can delete their own, `OWNER_EMAIL`
  can delete any). **One new table:**
  ```sql
  create table shared_deck (
    id text primary key, email text not null, name text not null,
    category text not null, cards jsonb not null,
    created_at timestamptz not null default now()
  );
  ```
  RLS off (service-role only). Categories: Maths, Physics, Chemistry, Biology, English, History,
  Geography, Languages, Business, Other.
- **Revision games** (new, in the Revision category) — all **procedurally generated** through a
  shared quiz engine (`revGame`); best streak saved locally per game:
  - **Maths** — differentiation & integration of polynomials (MC, mistake-based distractors),
    combinatorics incl. binomial coefficients (typed integer answers), graph transformations.
  - **Physics** — SUVAT, waves (v=fλ, period), energy (KE, PE with g=9.8, work, power). MC.
  - **Chemistry** — redox (oxidation states from a curated formula list + oxidised/reduced),
    solubility via **SNAAP** (soluble salts carry a SNAAP ion; the "insoluble" set is a curated
    list of genuinely insoluble salts, so the game never teaches wrong chemistry).
  - **Python** — predict-the-output of small generated snippets (arithmetic incl. // and %,
    strings, range loops, list ops, f-strings); outputs computed in-engine so they're exact.
  Answers were spot-checked (6C3=20, (2−2x)⁴ x² coeff=96, ∫/d-dx correct, SUVAT/PE numerics,
  Cr₂O₃→+3, etc.). MC everywhere except combinatorics/oxidation-state (typed integers).

Deploy: ship `games.html`, redeploy `api/decks.js`, and create the `shared_deck` table. No existing
tables touched.

## Scroller edge-fades + full revision syllabus (latest)

- **Scroller polish.** Each category row is now wrapped in `.gamesecrow`, whose `::before`/`::after`
  are **edge-fade gradients** that fade the cards where the row runs off the page. They toggle by
  scroll position (`edgeFades()` adds `can-left`/`can-right`): the neutral (just-opened) state shows
  only the right fade, and mid-scroll shows both. The fade uses `color-mix(... transparent 100%)` so
  it dissolves to nothing rather than a grey block, and matches any skin's `--bg`.
- **Hover no longer clips.** Cards used to grow their shadow on hover, which clipped back out of the
  padded row. They now **lift** instead — `.gamerow .gamecard:hover{transform:translateY(-6px)}` with
  the normal `--shadow` — staying inside the row's padding (bumped to 28/32px). No visible scrollbar
  on any skin (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`).
- **Revision tab filled out.** All revision games run through the same `revGame(host, opts)` engine,
  which now supports **modules with selectable subtopics**: a module pill row plus a subtopic
  multi-select row (at least one must stay on). Selection persists per subject in
  `tt.rev_<key>` / `tt.rev_<key>_mod` / `tt.rev_<key>_excl`. You can drill into one subtopic, a whole
  module, or the whole topic. **Formulas are no longer shown before you answer** (that was the point);
  the working is revealed *after*, in the feedback note.
  - **Chemistry** (4 modules): M1 naming, isotopes/Aᵣ, electron config, VSEPR shape + polarity + IMF;
    M2 moles↔mass, limiting reagent, empirical formula, solutions & gas volume; M3 reaction types,
    redox, galvanic cells, solubility; M4 calorimetry, bond energies, enthalpy of formation, Gibbs.
  - **Physics** (4 modules): Kinematics, Dynamics, Waves, Electricity & magnetism.
  - **Engineering** (new subject): materials (steels/irons, polymers, composites, heat treatment) and
    mechanics (moments, couples).
  - **Maths**: combinatorics is now **real word problems** (circular seating, committees, word
    arrangements) and transforms use **concrete functions** (x², x³, √x, |x|), not bare f(x).
  - **Software** (was "Python"): predict-output **plus** a write-code mode (pick the correct snippet
    for a task). New game id `software`.
  - Accuracy: answers are computed in-engine (or from curated, hand-checked lists), delivered as MC
    or integer input with the numbers **given in the question**. `physMC()` pads its distractors so
    options never collapse to one. All 43 generators were fuzzed (400+ runs each): no exceptions, no
    MC answer missing from its choices, no non-finite numbers, every numeric answer passes its own
    accept check. Two inline SVG diagrams (`vseprSVG`, `vectorSVG`) render for shape and vector Qs.

Client-only — ship `games.html`.

## Games grid rows + accurate reaction timer

- The games grid is now **one horizontal scroller per category** (Revision / Timetable / Arcade).
  It shows ~3½ cards (a peek of the next hints you can scroll), **no visible scrollbar**, and you
  scroll it with the **mouse wheel while hovering** or by **click-and-drag** (`dragScroll()`; a
  drag swallows the click so it never opens a game by accident). Touch uses native scrolling.
  `.gamerow` card basis `calc((100% - 42px)/3.5)`; container is `.gamesections`. The row is
  padded (24/32px) with equal negative margins (full-bleed) so the card **shadows aren't clipped**
  into a dark rectangle by `overflow-y:hidden` — important on Glass and other heavy-shadow skins.
- **Reaction test accuracy**: it now measures on **pointerdown** (the press) instead of `click`
  (which fires on release, adding the press-to-release time — the reason readings ran ~100 ms
  high). It also stamps the stimulus time in a `requestAnimationFrame` on the frame the green is
  painted, using `performance.now()`.

Client-only — ship `games.html`.

## Subject notes

The Notes page is **per subject**. A dropdown lists **General plus every subject from
your timetable** (from the class rows' course names, same cleaning the games use).
Notes are stored as `tt.subjectnotes = { subject: text }`, which **syncs with your
other settings** across devices; the last-open subject is remembered in `tt.notesubj`.
The old single scratchpad (`tt.notes`, device-only) migrates into **General** once.
Subjects come from `tt.cache` when the timetable's been opened, else a live fetch; a
`•` marks subjects that already have notes.

---

## Progress bar + header tweaks

- The Now-card **progress bar is now a fixed accent colour** (`--accent`) instead
  of the per-subject colour, which was often too pale to read.
- The **settings/home buttons are vertically centred** in the header widget
  (`.headbtns { align-self: center }`) in both header layouts.

### Timetable polish

- **Lunch** no longer shows a time range in compact view, matching Recess/Assembly
  (the block was just tall enough to trigger the time label; now suppressed by name).
- The **current-period outline is flush** with the card (`outline-offset:0`, was 2px).
- **Classic** marks the current day with **blue text only** — the blue dot under
  the day heading is removed.

---

## Dark-mode native controls + Guess Who hints

- **`color-scheme` is now set** (in `theme.js` `apply()`) to match the effective
  palette — dark in dark mode, always-dark for the fixed-dark skins, and by the
  custom background's own darkness for Custom. Without it, native controls stayed
  light on a dark page and the `<datalist>` autocomplete rendered white text on a
  white popup (illegible while typing a Guess Who guess). This fixes every page's
  inputs, dropdowns and scrollbars, not just the games.
- **Glass dark mode** is less shiny: the specular sheen on cards drops from
  `rgba(255,255,255,.4)` to `.1` (and card borders/topbar rim soften) in dark
  only — light-mode glass keeps its full gloss. Fixes the plasticky look and the
  washed-out text.
- **Guess Who hints** (both the practice game and the daily): first-name and
  surname *length* are now **separate hints** (together they gave too much away);
  the **year hint is dropped in "My grade"** mode (everyone's the same year); and
  the "shares a class with X" hint now only names someone who shares an
  **un-named** class, so it can't restate a class a previous hint already gave.

---

## Latest round of changes

- **Header layout toggle** (⚙ → Display → Header): *Classic* (everything in one
  rounded widget — identity left, Now/Next middle, controls right; default) or
  *Separated* (Now/Next drop to their own row). Applies to every theme.
- **Class rosters are links.** Each name in a class list opens that person's
  timetable — the username box up top drives it. Signing in is a one-time thing;
  switching whose timetable you view never re-authenticates (that box also
  auto-widens for long names).
- **Guess Who** (Games): picks a random person from your combined classmates and
  reveals hints — shared classes, year, name shape, letters — until you name
  them. Only ever mentions people already in a class with you.
- **Games page** is now a grid of cards with entrance/hover animations; click one
  to play, "All games" to go back. Respects Reduce motion.
- **Settings footer**: Access / Display / Colours open sub-panels; a light-dark
  toggle sits beside **Export .ics**. No Save button (everything applies live),
  no emoji labels.
- Click any popup's backdrop to close it. Week letters on day names are **off by
  default**. Glass light-mode has a properly frosted top widget. Settings no
  longer scroll sideways.

The Games page fetches your classes and rosters through the shared login via
`TT.apiGet` in `theme.js`, so it works on any page without duplicating the auth.

---

## Round of polish

- **Header toggle bug fixed** — the `tt.header` key was missing from the
  timetable's storage map, so the Classic/Separated switch never applied. Glass
  now drops its frosted panel entirely in Separated mode.
- **Classic outlines toggle** now works: off = plain border (the subject dot
  stays); on = the coloured ring.
- The **username box** is discreet by default (the `@domain` suffix only appears
  while editing) and grows for longer names without stretching to fill.
- **Guess Who** confirms whose classes it's drawn from, excludes teachers
  (by role *and* `@det.nsw.edu.au`), varies its hints (class count, a class or
  two, year, a classmate, name shape/letters), shows a hints-left counter, and
  no longer prints a dead "no year" hint. It can only pool people who share a
  class with you — a whole-year roster isn't exposed by the API, so that's the
  natural limit.
- **Games** open with a crossfade into a clean stage (a `[hidden]`/`display`
  specificity bug had been leaving the grid visible behind the game). Each game
  keeps a **local high score / stat** (`tt.stats`), shown on its card.
- **2048 tiles animate** — they slide to their new cell and pop on merge instead
  of teleporting, via position-tracked tiles with stable ids.

---

## Fixes & Guess Who difficulty

- The name pill on the timetable shows the full `@education.nsw.gov.au` again; the
  header (brand) is width-capped so a long name or username can't squeeze the
  Now/Next boxes. The username still auto-sizes and switches whose timetable you
  view without re-authenticating.
- Settings **Login** fields no longer overflow — a `.field input[type=text]`
  rule had been stretching only the email box to full width.
- **Guess Who** gained a difficulty picker: **My classes** (people who share a
  class, with class hints), **My grade**, **Whole school**, **Teachers**. The
  last three use the school directory endpoints `/api/group/student` and
  `/api/group/teacher` (proxied via `?group=`). Hints are tiered so vague ones
  (year, class count, name length) come first and near-answers (a shared
  classmate, partial name reveals) come last, shuffled within each tier; the two
  class hints are always different classes, and the classmate hint prefers
  someone who shares a *different* class than the one already named.

### Subject colours

Colours are **not** taken from the API's per-lesson `Colour` field. They come
from a built-in faculty palette matched on the course name (Maths pink, Science
cyan, English yellow, …), with per-mode values and manual overrides in
⚙ → Colours. If you'd rather use the school's own `Colour` values, that's a
small change to `defaultColour()` / `normalise()` — say the word.
