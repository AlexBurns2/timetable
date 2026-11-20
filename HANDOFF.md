# Handoff — adding a database (sync, daily Guess Who, realtime)

You're picking up an existing, working school-timetable web app. The owner (Alex)
wants to add server-side state in three phases. This doc is everything you need to
do it without the prior conversation. A visual version of the plan lives at
<https://claude.ai/code/artifact/6466d2e1-a842-4f5e-b19e-d59a33dfcf04>.

> **STATUS (2026-09-12):** Phases 0, 1 and 2 are **built** and browser-tested
> against mocks, and a lot has been added on top since. See
> **§8 "Built since the original handoff"** for everything newer — that section is
> the current picture; §§2–7 are still accurate as background and as the Phase 3 plan.
> - Phase 1 (settings sync): `api/_supabase.js`, `api/prefs.js`, exported auth
>   helpers in `api/timetable.js`, sync client in `theme.js` / `index.html`.
> - Phase 2 (daily Guess Who): `api/_daily.js`, `api/daily.js`,
>   `api/daily-generate.js`, `vercel.json` cron, `fetchAsOwner` in
>   `api/timetable.js`, and `BUILD.dailyguess` + `TT.api` on the client.
> - Shared weekly Tetris leaderboard: `api/tetris.js` + `BUILD.tetris` — the
>   same whoami-verified, service-role pattern (table `tetris_score`).
>
> **Tables to create** (SQL in SETUP.md): `prefs`, `daily_puzzle`, `daily_result`, `calendar_event`,
> `tetris_score`, `zen_score`, `game_score`, `game_state`, `sprint_best`,
> `zen_board`, `shared_deck` (public flashcards), `forum_post` (home-page forum),
> **`onboarding`** (first-run tutorials).
> Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL` (owner-only admin
> tools), optionally `CRON_SECRET`, then redeploy.
> **Phase 3 (realtime boards/multiplayer) is still unbuilt**; §6 is its plan. The
> home-page forum (§8) is a plain request/response board, not the realtime one.

**Golden rules**
- The browser never gets a database key. All DB access goes through the Vercel
  serverless function in `api/`, which already authenticates the caller.
- Identity = the user's **school email**, proven by their school login. No new
  accounts, no passwords stored in your DB.
- Keep each phase shippable on its own. Do Phase 1 fully before touching Phase 2.
- After any change, verify: `node --check` the JS, and test the route locally.

---

## 1. The project as it stands

**Location:** `B:\Alex\timetable` (Windows; the shell is Git Bash / PowerShell).
Not currently a git repo unless Alex has since run `git init`.

**Deploy:** Vercel project, live at `https://timetable-iota-ten.vercel.app`
(custom domain `mscunofficial.com` may be in progress). Vercel serves **both** the
static pages and the `/api/*` function from the same origin.

**Files:**
| File | What it is |
|---|---|
| `index.html` | the timetable app (all its own JS/CSS inline) |
| `theme.js` | **shared** theme + settings + a small API helper; loaded by every page |
| `theme.css` | shared design tokens + all skins |
| `site.css` | shared furniture for the non-timetable pages |
| `home.html` `notes.html` | hub, scratchpad |
| `games.html` `revision.html` | two pages over the shared `games.css` + `games.js` (see 8.10) |
| `calendar.html` | shared calendar (see 8.9) |
| `tour.js` | first-run tutorials, loaded by every page that has one (see 8.11) |
| `api/timetable.js` | the Vercel serverless proxy (Node, ESM) — **all server code lives here today** |
| `package.json` | `{"type":"module","private":true}` — add deps here |
| `SETUP.md` | deploy + feature docs (read it for context) |

**Local testing pattern used throughout this project:** a tiny Node http server
that serves the files and mocks `/api/*`. Example that proxies the real school
API is unnecessary — mock the JSON. Start it with `node srv.mjs` in a scratch dir,
open `http://localhost:8790/`. Seed a login in the browser console:
```js
localStorage.setItem('tt.creds', JSON.stringify({email:'alex.burns6@education.nsw.gov.au', password:'x'}));
localStorage.setItem('tt.email', JSON.stringify('alex.burns6@education.nsw.gov.au'));
```

---

## 2. The auth model (critical — reuse it, don't reinvent)

Everyone signs in with **their own** school credentials, stored on-device:
- `localStorage['tt.creds']` = `{ email, password }`
- The browser sends them as **headers** `X-School-Email` / `X-School-Password`
  (never query params) on every API call.
- `api/timetable.js` reads those headers, calls `getToken(apiBase, email, password)`
  against the school API, and gets a **JWT**. That JWT's decoded payload is:
  ```json
  { "emailAddress": "alex.burns6@education.nsw.gov.au", "groups": ["student","yr11"], ... }
  ```
  So a valid token **proves** the caller owns that email, and tells you their year.

Helpers **already in `api/timetable.js`** you will reuse:
- `getToken(apiBase, email, password)` → cached JWT (per-account cache).
- `decodeJwtPayload(token)` → the claims object above.
- `normaliseEmail`, `listEnv`, CORS header logic at the top of `handler()`.

Existing query routes in `api/timetable.js` (all in one `handler`):
- `?email=<user>` → timetable + bellTimes + startDate + profile
- `?class=<ClassCode>` → class roster (`/api/timetable/class/{code}`)
- `?group=student|teacher` → whole-school directory (`/api/group/{g}`) — **already added**
- `?diag=1` → connectivity probe (moderators only since 8.115)

**Env vars on Vercel** (Settings → Environment Variables):
`SCHOOL_EMAIL`, `SCHOOL_PASSWORD`, `SCHOOL_API_BASE`
(`https://intranet.nbscmanlys-h.schools.nsw.edu.au`), `SCHOOL_TOKEN_PATH`
(`/api/token`), `ALLOWED_ORIGIN`, `ALLOWED_EMAILS` (optional), `EMAIL_DOMAIN`.

**Frontend API helper** — `theme.js` exposes `window.TT`:
- `TT.apiGet(params)` — GETs `/api/timetable` with `params` as query, adds the
  `X-School-*` headers from `tt.creds`, returns parsed JSON. **Use this** for new
  client calls (works same-origin; drops to a relative URL automatically).
- `TT.myEmail()` — the currently-viewed email.
- `TT.get(key, default)` / `TT.set(key, value)` — JSON-safe localStorage.

**localStorage keys** are all `tt.*`: `skin mode view header custom room weekletter
outline progress zen textscale zoom contrast motion email creds colours stats
notes gwdiff cache`. Phase 1 syncs exactly this set (minus `creds` and `cache`).

---

## 3. Phase 0 — provision Supabase (do this first)

Vercel's own KV/Postgres are retired; databases come from the **Vercel
Marketplace** now. Use **Supabase** (Postgres + Realtime + a JWT layer) — it's the
only option that carries all three phases without a rewrite.

1. Vercel project → **Storage** → **Browse Marketplace** → **Supabase** → Create.
   It injects env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (names may vary slightly —
   check what the integration actually adds).
2. Add the dep: in `package.json` add `"dependencies": { "@supabase/supabase-js": "^2" }`
   (and `"jsonwebtoken": "^9"` for Phase 3). Vercel installs on deploy.
3. Create `api/_supabase.js`:
   ```js
   import { createClient } from "@supabase/supabase-js";
   import { getToken, decodeJwtPayload } from "./timetable.js"; // export these two if not already
   export const db = createClient(process.env.SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
   export async function whoami(req){
     const email = req.headers["x-school-email"], pass = req.headers["x-school-password"];
     if (!email || !pass) return null;
     const apiBase = (process.env.SCHOOL_API_BASE||"").replace(/\/+$/,"");
     try {
       const auth = await getToken(apiBase, email, pass);
       const c = decodeJwtPayload(auth.token) || {};
       const year = (c.groups||[]).map(g => (String(g).match(/yr?(\d+)/i)||[])[1]).find(Boolean);
       return { email: String(c.emailAddress||email).toLowerCase(), year };
     } catch { return null; }
   }
   ```
   > `api/timetable.js` currently keeps `getToken`/`decodeJwtPayload` as module-local
   > functions. Add `export` to both (they have no side effects on import), or copy
   > the auth snippet into `_supabase.js`. Confirm importing `timetable.js` doesn't
   > run the handler at import time — it only exports `default`, so it's fine.

**GUARD:** `SUPABASE_SERVICE_ROLE_KEY` bypasses all row security. It may only ever
appear in `api/*`. Never put it in any `.html`, `theme.js`, or client bundle.

**CORS note:** new `api/*.js` files don't inherit the CORS headers that
`timetable.js` sets. Since the page and API share an origin on Vercel, same-origin
requests need no CORS. But if the app is *also* served from GitHub Pages, either
(a) serve only from Vercel, or (b) copy the `Access-Control-Allow-*` + `OPTIONS`
handling from the top of `timetable.js`'s `handler` into each new route.

---

## 4. Phase 1 — per-user settings sync

Mirror the `tt.*` bag to a row keyed by email. localStorage stays as the offline
cache + instant paint; the server copy wins on load.

**SQL** (Supabase → SQL editor):
```sql
create table prefs (
  email      text primary key,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
```

**Route** `api/prefs.js`:
```js
import { db, whoami } from "./_supabase.js";
export default async function handler(req, res){
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in first." });
  if (req.method === "GET"){
    const { data } = await db.from("prefs").select("data,updated_at")
      .eq("email", me.email).maybeSingle();
    return res.json(data || { data: {} });
  }
  if (req.method === "PUT"){
    await db.from("prefs").upsert({ email: me.email, data: req.body,
      updated_at: new Date().toISOString() });
    return res.json({ ok: true });
  }
  res.status(405).end();
}
```

**Client wiring** in `theme.js` (it already has `get`/`set`/`apply` and reads
`tt.creds`). Add:
```js
function authHeaders(){
  const c = get('tt.creds', null), h = { 'Content-Type':'application/json' };
  if (c && c.email && c.password){ h['X-School-Email']=c.email; h['X-School-Password']=c.password; }
  return h;
}
async function syncPull(){
  try {
    const r = await fetch('/api/prefs', { headers: authHeaders(), cache:'no-store' });
    if (!r.ok) return;
    const { data } = await r.json();
    for (const [k,v] of Object.entries(data||{})) set(k, v);  // server wins
    apply();
  } catch {}
}
let pushT; function syncPush(){
  clearTimeout(pushT);
  pushT = setTimeout(() => {
    const blob = {};
    for (let i=0;i<localStorage.length;i++){ const k = localStorage.key(i);
      if (k.startsWith('tt.') && k!=='tt.creds' && k!=='tt.cache') blob[k]=get(k); }
    fetch('/api/prefs', { method:'PUT', headers: authHeaders(), body: JSON.stringify(blob) }).catch(()=>{});
  }, 800);
}
```
Call `syncPull()` once after a login exists; call `syncPush()` from wherever
settings are written (the `set()` helper is a good single choke point — but don't
push on *every* keystroke; the debounce handles that). **Test:** change a setting
on one browser profile, `syncPull()` in another, confirm it lands.

**Conflict policy:** last-write-wins on `updated_at`. Fine for one person, few
devices. Don't build per-key merge unless it becomes a real problem.

---

## 5. Phase 2 — daily Guess Who (Wordle-style)

The repo already has a Guess Who game in `games.html` with tiered hints and a
`?group=student` directory + `?class=` rosters. The daily version:
- picks the mystery person **on the server** so everyone in a year sees the **same**
  one, chosen **once per day**;
- **never sends the answer to the browser** — guesses are graded server-side.

Keep the pool to the **player's own year** (privacy — same footing as the existing
"grade" mode). A whole-school daily would surface strangers.

**SQL:**
```sql
create table daily_puzzle (
  date    date not null,
  year    text not null,
  target  jsonb not null,     -- {name, hints...} — server-held, never returned raw
  candidates jsonb not null,  -- the year's name list for the picker/datalist
  primary key (date, year)
);
create table daily_result (
  email   text not null,
  date    date not null,
  year    text not null,
  guesses int,
  won     boolean,
  primary key (email, date)
);
```

**Generation** — a Vercel Cron writes the day's puzzle for each year at midnight
Sydney. `vercel.json`:
```json
{ "crons": [ { "path": "/api/daily-generate", "schedule": "0 13 * * *" } ] }
```
(13:00 UTC ≈ 00:00 AEDT; adjust for DST if it matters.) Vercel sends
`Authorization: Bearer <CRON_SECRET>` if you set a `CRON_SECRET` env var — check it
in the route so only cron can trigger generation. `api/daily-generate.js`:
- fetch the student directory (reuse the `/api/group/student` logic or call it),
- for each year `7..12`: filter, pick a **date-seeded** index (`hash(date+':'+year) %
  n`) so it's deterministic, `upsert` into `daily_puzzle` with
  `onConflict:"date,year", ignoreDuplicates:true` (first write wins, so a re-run
  can't change today's answer),
- precompute the hint payload (reuse the hint tiers from the existing game).
- Add a **lazy fallback**: if `/api/daily` is asked for a (date,year) with no row,
  generate it on the spot then. Covers cold starts and missed crons.

**Play routes:**
- `GET /api/daily?year=11` → `{ attempt, hints:[…revealed so far], candidates:[…names], done }`
  (reads `daily_result` for this user to know their attempt count; returns hints up
  to that many; **omits the answer**).
- `POST /api/daily/guess` `{ guess }` → compares to `daily_puzzle.target.name`
  server-side, upserts `daily_result`, returns `{ correct, nextHint?, streak,
  answer? (only once finished) }`.

**Streak** = consecutive prior dates in `daily_result` where `won` — compute on read.

**Frontend:** add a "Daily" toggle/mode to the Guess Who game in `games.html`. It
should call `TT.apiGet` won't fit (that hits `/api/timetable`), so add a small
`TT.api(path, params, opts)` or just `fetch('/api/daily…', {headers: authHeaders})`.
Show the streak on the game card via the existing `tt.stats` pattern, or read it
from the server response.

---

## 6. Phase 3 — realtime multiplayer + message boards (later)

Only phase where the browser talks to Supabase **directly** (websockets can't be
proxied through serverless). Safe because the browser must first get a
short-lived Supabase JWT from your function, and Row-Level Security enforces
"act only as yourself".

**Token bridge** `api/realtime-token.js`:
```js
import jwt from "jsonwebtoken";
import { whoami } from "./_supabase.js";
export default async function handler(req, res){
  const me = await whoami(req);
  if (!me) return res.status(401).end();
  const token = jwt.sign(
    { sub: me.email, role: "authenticated", year: me.year,
      exp: Math.floor(Date.now()/1000) + 3600 },
    process.env.SUPABASE_JWT_SECRET);
  res.json({ token });   // browser: supabase.realtime.setAuth(token)
}
```

**Board table + RLS:**
```sql
create table messages (
  id bigint generated always as identity primary key,
  board text not null, email text not null, name text not null,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz default now()
);
alter table messages enable row level security;
create policy read  on messages for select using (true);
create policy write on messages for insert with check (email = auth.jwt() ->> 'sub');
```
Client: create a browser `supabase` client with `SUPABASE_ANON_KEY` (public,
fine), call `setAuth(token)`, then
`supabase.channel('board:general').on('postgres_changes', {event:'INSERT',
schema:'public', table:'messages'}, cb).subscribe()`. Insert via the same client
(RLS lets you insert only rows where `email` matches your token's `sub`).

Realtime primitives: **Postgres Changes** (boards, leaderboards), **Broadcast**
(ephemeral game moves), **Presence** (lobby/who's-online). A turn-based game =
a `rooms` row + Broadcast for moves + one final result write. **Build the board
first** — it exercises the whole auth bridge with the least game logic.

**Moderation:** every post carries a verified school email → real accountability.
Add a `hidden boolean` column + a report action before opening a board school-wide.

---

## 7. Build order & cautions

1. Provision Supabase; get `_supabase.js` + `whoami` working via a throwaway test route.
2. Ship **Phase 1** (sync). Once two devices agree, the identity plumbing is proven.
3. Add **Phase 2** (daily). Reuses existing directory + hint code; only new idea is
   server-side selection/grading + a cron.
4. **Phase 3**: token route is the hard 20%, the board is the easy 80%.

- **Never cache the whole-school directory publicly.** It's real personal data —
  every read behind a verified token, store only fields a game needs, use
  `Cache-Control: private, no-store` (the existing code already does this for
  own-login responses; match it).
- Confirm `package.json` deps deploy (Vercel installs them). ESM only (`type:module`).
- The owner's threat model is low-stakes (a school tool), but the school password
  still lives in `localStorage` in plain text — don't widen that exposure.

---

## 8. Built since the original handoff (current picture)

Everything below is **built and browser-tested against the mock** unless marked
otherwise. `home.html` is the hub. All of it is client-side plus the `api/`
routes listed.

> **Note on file layout (changed).** `games.html` used to be one self-contained
> file. Its CSS and JS now live in `games.css` and `games.js`, and **two pages
> share them**: `games.html` and `revision.html`. See 8.10.

### 8.1 New / changed API routes

| Route | What it does | Table |
|---|---|---|
| `api/decks.js` | Public flashcard decks — publish, browse by category, import, delete own | `shared_deck` |
| `api/forum.js` | **New.** Home-page forum: threads + one level of replies, delete own (or owner) | `forum_post` |
| `api/leaderboard.js` | Generic arcade boards **+ `?users=1`** (owner-only roster of everyone who has used the site) | `game_score` |
| `api/_daily.js` | Daily Guess Who engine — **hint generation rewritten** (below) | `daily_puzzle` |
| `api/calendar.js` | Shared calendar, Google iCal import | `calendar_event` |
| `api/onboarding.js` | **New.** Which first-run tutorials a person has been shown, **+ `?all=1`** (owner-only roster) | `onboarding` |

`forum_post` SQL:

```sql
create table forum_post (
  id         text primary key,
  email      text not null,
  body       text not null,
  parent     text,                       -- null = thread, else the thread id
  created_at timestamptz not null default now()
);
create index forum_post_parent_idx on forum_post (parent, created_at);
```

**`?users=1`** is the engagement view behind the Admin game's first tab. It unions
`prefs` (a row appears the first time someone's settings sync after login — the
closest thing to a sign-in log), `game_score` and `daily_result`, and returns
`{email, name, last, scores, days}` sorted by last-seen. Gated to `OWNER_EMAIL`;
read-only, it never writes.

### 8.2 Guess Who hints — randomised, and no longer name-only

The complaint was that the daily and "My grade" games always opened with the same
hints in the same order (letter counts, then first letters).

- **Tiered + shuffled.** Hints are grouped by how much they give away (vague →
  medium → strong → nearly the answer) and shuffled *within* each tier, so the
  order is fresh but the giveaways still land last. The full-name reveal
  (`Their name reads J o _ d a n L e _`) is kept out of the shuffle entirely and
  is **always the final hint**.
- **Much bigger vocabulary:** vowel counts, whole-name length, double letters,
  vowel/consonant start, alphabet half, name endings, initials — on top of the
  original lengths/first letters.
- **Daily (`api/_daily.js`)** seeds its shuffle from `date + ":" + year`, so the
  order varies day to day but is **identical for everyone in the year all day**
  and stable across reloads — the Wordle property is preserved.
- **Real content hints.** `studiesOf()` reads the target's own timetable via
  `fetchAsOwner('/api/timetable/<email>')` at generation time and stores
  `subjects` + `teachers` on the puzzle, giving hints like *"They take Drama"* and
  *"One of their teachers is Mr Nguyen"*. Viewer-independent, so the daily stays shared.
- **Existing puzzles keep working.** Hints are recomputed from the stored target on
  every read, and older `daily_puzzle` rows simply have no `subjects` — those
  hints are skipped and it falls back to name shapes. Nothing is regenerated and
  no target ever changes.
- **Infinite Guess Who** (`BUILD.guesswho`) got the same vocabulary, plus
  `withClassInfo()`, which folds the shared-class pool's subject data into the
  **My grade** and **Whole school** pools. That's why those modes can now say
  *"They take PDHPE"*, *"They are in 2 of your classes"* and *"They have a class
  with A Smith"* (via the new `gwData.subjTeacher` map) instead of only name shapes.
- A round is ~9 hints (was 7).

### 8.3 Revision games — content + spaced repetition

`revGame(host, opts)` drives every Revision game. A topic is either
`{id, name, gen}` (a procedural generator) or `{id, name, bank}` (a curated
array of `{q, a, w}` MC items). Games are either flat (`topics`) or modular
(`modules: [{id, name, topics}]`, with a module pill row + subtopic multi-select).

- **Subjects:** Maths, Chemistry (4 modules), Physics (4 modules), **Engineering**
  (5 modules), **Software** (renamed from Python; predict-output + write-code).
- **Engineering content** is drawn from the Year 11 *Materials & grain structure*
  study guide: steels, cast irons, heat treatment, structure & properties,
  mechanics — ~72 curated questions.
- **Microstructure diagrams** (`microSVG(kind)`): a **Voronoi grain tessellation**
  clipped to a circle, matching the study guide's drawing style. Hatching =
  pearlite (each colony gets its own lamellae angle, drawn as real clipped lines,
  not a `<pattern>`); solid fill = graphite. Kinds: `low`, `med`, `eutectoid`,
  `high` (pale cementite network), `grey` (flakes), `nodular`, `white`,
  `malleable` (rosettes). Grains come from a **seeded PRNG** (`mulberry32`) so each
  kind always looks the same. All theme tokens — works light and dark.
- **Spaced repetition** (the fix for "it asks the same question repeatedly"):
  `revGame` keeps `tt.rev_<key>_hist` = `{sig: [seen, wrong]}`, persisted and
  synced. `nextQ()` picks a **subtopic fairly** (so procedural subtopics aren't
  starved by a big unseen bank), then biases **which question within it** toward
  never-seen (big boost) and previously-wrong (revisit boost), decaying ones you
  keep getting right. A recent-window capped just below the pool size guarantees
  **no back-to-back repeats**. Curated questions carry a stable `key` (bank index,
  or an explicit `key:` on the chem/software generators); purely numeric
  generators stay fresh via new numbers and aren't tracked (which would bloat the
  history).

### 8.4 Home page

- Six tiles (Timetable, Revision, Calendar, Notes, Games, Resources), then a
  **forum** (post, reply, relative timestamps, delete your own). Styles live in
  `site.css` under "forum (home page)".
- Removed: the old footer ("Theme follows you across every page." + "Back to
  timetable →"), the "Your timetable, your notes…" lede, and the "What's new"
  list (its `.features` CSS went with it).
- Gotcha worth remembering: `.freplybox{display:flex}` beats the `[hidden]`
  attribute, so there is an explicit `.freplybox[hidden]{display:none}`. The same
  bug bit the Tetris undo/redo buttons earlier — if something won't hide, check
  for a `display` rule outranking `[hidden]`.

### 8.5 Cautions for the next person

- **Don't regenerate or mutate `daily_puzzle` rows.** Targets must stay put;
  change hints only through `buildHints`, which is recomputed on read.
- `studiesOf()` is best-effort and wrapped in try/catch — if the school API
  changes shape, the daily silently falls back to name-only hints rather than
  failing to build a puzzle. Keep it that way.
- `games.js` is now a plain `.js` file, so `node --check games.js` works. Pages
  still carry inline `<script>` blocks; syntax-check those by extracting them and
  running each through `new vm.Script(...)` (`node --check` won't take HTML). One
  script does both; keep using it, because it is what catches the classic
  own-goal of putting an apostrophe inside a single-quoted string while editing
  copy.
- The mock server used for all of this lives in the scratchpad
  (`gamesmock.mjs`, port 8792; `calmock.mjs`, port 8793) and mirrors every
  `/api/*` route including `/api/forum`, `/api/calendar`, `/api/onboarding` and
  `?users=1`. It is not part of the repo — rebuild it if needed.

### 8.6 Guess Who hints — the rollback, and why (read before touching hints)

The varied-hint rewrite in §8.2 shipped a real bug: hints described the **wrong
person**. Two causes, both now fixed, both worth remembering.

1. **`fetchAsOwner('/api/timetable/<someone-else>')` is not trustworthy.** Read as
   the server's own account it can return the *server account's* timetable rather
   than the person you asked about — so "They take Drama" described Alex, not the
   target. `studiesOf()` now proves ownership before believing the data: it takes a
   class code off the timetable it just read, fetches that class's roster, and
   checks the target's email is on it. Only then does it return `verified: true`,
   and `buildHints` ignores subjects/teachers without that flag. **If you add any
   other "what do they do" hint, verify it the same way or don't ship it.**
2. **Concatenating first+last invented letter patterns.** `/(.)/i` on
   `first + last` matched the join ("Ada"+"Adams" → "aA"), so the double-letter
   hint lied. Check name parts separately.

**`LEGACY_UNTIL = '2026-09-12'` in `api/_daily.js`.** Any puzzle dated on or before
it returns `legacyHints()` — the original seven hints, unchanged. Past days were
played against those, so they must keep reading the same way. **Do not edit
`legacyHints()`, and do not move the date backwards.** New hint work goes in
`buildHints` and only affects days after the cutoff.

### 8.7 Question volume — tables, not lists

Topics were looping after a handful of questions. The pattern now used everywhere:
keep a small **curated table** of rows, and write a generator that asks about one
field from several angles, in both directions, with distractors taken from the
same table (`fieldQ()` does exactly this, `bankQ()` wraps a plain `{q,a,w}` list).
Four steel rows × five fields × two directions = 40 questions from ~20 lines of
data. That is the cheapest way to add coverage without risking accuracy — the
facts are written once and checked once.

Measured distinct questions per subtopic: engineering 20–71, physics concepts
28–36, maths concepts 42, software paradigms/OOP 24/30, chemistry 13–30.
There is a browser check for this worth re-running after adding content — sample a
generator a few thousand times, count distinct `key`s, and assert the answer is
always among the choices.

### 8.8 Typed code answers

`revGame` supports a third answer mode beside multiple-choice and single-line
input: `typed: true` renders a **textarea** (Tab indents, Ctrl/Cmd+Enter submits,
plus a *Show answer* button) and grades with `cur.accept(text)`.

There is no Python interpreter in the browser, so `CODE_TASKS` entries carry a
`need: [regex]` list of the key parts a working answer must contain, matched
against `normCode(text)` — which strips comments, unifies quotes, collapses all
whitespace and tightens around punctuation, so the normalised form is one tight
line. Whitespace, quote style and most variable names are therefore free.

Two invariants to keep if you add tasks:
- every task's own `answer` must pass its own `need` (there's a browser check for
  this — it caught nothing last run, but it is the first thing to break), and
- test a wrong answer too; it is easy to write a `need` list so loose that
  `return True` passes.

### 8.9 Calendar

`calendar.html` + `api/calendar.js`, table `calendar_event`. Events are owned by a
verified school email and can be shared to other emails; repeats are stored as a
rule (`repeat` + `repeat_until`) and expanded client-side by `occursOn()` rather
than as rows, so a daily event is one row forever.

The Year 11 exam timetable is **client-side seed data** in `calendar.html`, not
rows — which exams you see is guessed from your timetable subjects and corrected
with tick boxes stored in `tt.calexams`.

**Google import:** no OAuth, no password. The user pastes the secret iCal address
from their own Google Calendar; the server fetches it once, parses the VEVENTs,
saves the events with `source='google'`, and **never stores the URL**. Two things
to preserve if you touch this:
- the host allowlist (`ICS_HOSTS`) — without it this endpoint is an SSRF hole,
  since it fetches a user-supplied URL from the server. Verified that internal
  IPs, localhost, other hosts and plain http are all refused.
- the re-import path deletes the previous `source='google'` rows first, so
  syncing again updates rather than duplicates.

**Time zones (do not "simplify" this).** Google writes almost every event as a
wall-clock time plus `TZID=Australia/Sydney`. The first version treated anything
with a TZID as UTC and converted it to Sydney, which silently added ten hours —
a 4pm event imported as 2am the next day. `parseICS` now resolves the wall clock
through `fromZone()`, which asks ICU for the zone's offset via `Intl` and does a
second pass so a DST changeover lands on the correct side. Handled and tested:
Sydney either side of the 4 Oct 2026 switch, explicit `Z`, floating times (no
zone — kept as written), foreign zones, quoted TZIDs, and a zone ICU doesn't
know (kept as written rather than shifted by a guess).

#### Views

A dropdown picks **day / weekdays / week / month / year**; the choice is stored
in `tt.calview`, so it syncs. Day, weekdays and week are a real time grid —
`HOUR` px per hour, each event absolutely positioned by its start and sized by
its duration, with a red "now" line on today. `layoutDay()` groups overlapping
events into clusters and assigns each a column, so two things at 4:30pm sit side
by side instead of on top of each other. Month is the 6×7 grid; year is twelve
mini-months with a coloured dot on any day that has something.

Cells are deliberately uniform: `grid-template-columns: repeat(7, minmax(0,1fr))`
(**`minmax(0,1fr)`, not `1fr`** — a bare `1fr` refuses to shrink below its
content and a long event title made one column wider than the rest) plus a fixed
`.day` height.

On phones (≤600px) month chips become 4px colour bars rather than text truncated
to "4p…", and a first visit with nothing stored opens on the day view.

#### Repeats

`repeat` is one of `none, daily, weekdays, weekly, fortnightly, bydays, monthly,
yearly`. `bydays` means "certain days each week" and reads its weekday list from
`by_day` (jsonb, JS weekday numbers, Sunday = 0, so `[1,2,5]` is Mon/Tue/Fri).
If you already created the table, `SETUP.md` has the `alter table … add column
if not exists` for it. `weekdays()` validates the list server-side and the
`typeof` guard in it is load-bearing: `Number(null)` is `0`, so without it a
stray null in the array becomes "every Sunday".

An RRULE like `FREQ=WEEKLY;BYDAY=MO,WE,FR` imports as `bydays`; a single BYDAY
stays plain `weekly`.

#### Other behaviour worth knowing

- **"Coming up" used to be empty.** `loadSubjects()` and `load()` are fired
  concurrently, and `loadSubjects()` only re-rendered the exam tick list — so
  whenever it resolved second, `renderUpcoming()` had already run with an empty
  `mySubjects`, every `examOn()` was false, and nothing refreshed it. It now
  calls `render()`. If you add another async source of `mySubjects`, it has to
  repaint too.
- The list caps any one repeating event at two rows, so a daily event can't
  crowd out the exams, and drops things that already finished earlier today.
- **"Next day" toggle** on the end time writes the end as the following date, so
  a 10pm–1:30am shift is stored as one event spanning midnight. `itemsOn()`
  clamps such an event to `24:00` on its start day; `fmtTime` takes `h % 24` so
  that renders as "12am", not "12pm".
- The Google instructions sit behind an **"i"** next to the heading: hover peeks,
  click pins it open. Both are needed — hover alone is useless on a phone, and
  an earlier version that toggled on click broke with a mouse, because the
  `mouseenter` fired first and the click then closed what hover had opened.

### 8.10 Revision split off the games page

`games.html` used to hold everything. Revision now has its own page, because
picking a subject to study is a different job from browsing for something to
play, and the side-scrolling shelves actively got in the way of it.

What actually changed is small: `games.html`'s inline `<style>` and `<script>`
were lifted out verbatim into **`games.css`** and **`games.js`**, and
**`revision.html`** loads the same two files. Nothing was duplicated and no game
code moved, so there is one implementation to maintain, not two. It also means
the 370 KB of JS is now cacheable across both pages instead of being re-parsed
inline on every visit.

The pages differ by one attribute:

```html
<body data-page="games">        <!-- games.html -->
<body data-page="revision">     <!-- revision.html -->
```

`games.js` reads it into `PAGE` / `REVISION_PAGE`, and `showGrid()` branches:
the revision page renders every `cat:'Revision'` game into one plain
`.gamegrid` (all subjects visible at once, no shelves, no leaderboard strip);
the games page renders `CAT_ORDER` (now just Timetable and Arcade) as
scrolling shelves. `gameCard()` is shared and only swaps "Play" for "Start".

If you add a page that reuses `games.js`, give it the same element ids
(`gamegrid`, `lbsum`, `gamestage`, `stage`, `back`, `sfx`, `volpop`, `volsl`,
`volwrap`, `themebtn`) — `admin` is optional and its absence is handled.

### 8.11 First-run tutorials (`tour.js` + `onboarding` table)

A tour is a list of steps; each spotlights one element and captions it. Steps
are shown **once ever per person, not per device** — progress lives in the
`onboarding` table with localStorage as the offline mirror, so signing in on a
school computer doesn't replay everything.

```sql
create table onboarding (
  email      text primary key,
  seen       jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
```

Step ids are **merged, never replaced**. That is not a detail — it is what lets
one step be offered from two places. The Settings step is defined on both the
timetable and the home page; whichever you reach first retires it for both, and
opening Settings yourself (`Tour.mark('settings')` in both dialogs' open
handlers) retires it without any tutorial showing at all. Replacing instead of
merging would let two devices erase each other's progress.

The tours themselves live in `TOURS` at the bottom of `tour.js`, so a caption is
written once even when two pages can show it. `title` and `text` may each be a
function, which is how the Settings caption says "and the colour each subject
gets" on the timetable (where a Colours button exists) and not on the home page.

Things that are the way they are for a reason:

- **Nothing runs until the person is signed in.** `run()` bails on
  `TT.signedIn()` (which is `hasCreds`, *not* `myEmail()` — that one is whose
  timetable you are looking at and can be set without ever logging in). Without
  this the timetable tour captioned the sign-in gate, which is useless, and any
  progress recorded would belong to nobody, since the table is keyed by email.
  The guard lives in `tour.js` rather than at each call site so a new page
  can't forget it.
- On the timetable there is a second condition: `startTour()` also checks
  `gate.hidden`, so a *failed* load that put the gate back doesn't trigger it
  either. It is called from two places — after a successful boot load, and
  right after a first-time sign-in through the gate, which is the moment a new
  user most wants showing around.
- **Advance on a tap anywhere**, plus a Next button, Enter/Space/→, Escape to
  skip. Skip marks every remaining step seen, so it means "stop showing me this".
- **A missing target is skipped, not marked seen.** If the element isn't on the
  page yet, the step waits for a visit where it is, rather than being burned.
- **The veil is appended inside `dialog[open]` when the target is in one.** A
  modal `<dialog>` sits in the browser's top layer, so a veil parented to
  `<body>` renders *underneath* it and the settings tour would be invisible.
- `Tour.run` waits for the server copy (2.5s cap) before showing anything, so a
  step you finished on your phone doesn't replay on a slow connection here.
- The key is `onboard.seen`, deliberately **not** `tt.*`: it syncs through its
  own table and must not also ride the prefs blob.

The games page's step is a demonstration rather than a caption: `scrollDemo()`
glides a pointer across the real shelf and scrolls it out and back on a loop, so
the gesture is shown on the actual cards. It only runs when there is something
off the right-hand edge, and it restores `scrollLeft` on teardown.

The Admin game's "Signed-in users" tab merges `/api/onboarding?all=1` by email
and shows an `n/8` bar per person, green once they finish. That fetch is
optional — if it fails the roster still renders.

### 8.12 Text size actually works now

`theme.css` has always had `html{font-size:calc(16px * var(--text-scale,1))}`,
but **every size on the site was in px**, so the slider moved nothing. All 229
`font-size` declarations (plus five `clamp()` bounds and two `font:` shorthands)
were converted to `rem` at a 16px base, so rendering at 100% is byte-identical
and the slider now has something to scale.

One place needed more than CSS: the compact timetable positions and sizes every
card from JS (`PX` pixels per minute in `renderCompact`). Bigger text in a card
whose height never changed would just overflow, so `PX` is multiplied by
`tt.textscale` and the whole grid grows with the type.

If you add CSS, **use rem for font sizes.** A px one silently opts out of the
setting, which is exactly the bug this fixed.

### 8.13 Plain is the default theme again

`data-skin="plain"` on every page's `<html>`, `'plain'` as the fallback in
`theme.js` `readState()`, `index.html` and `settings.js`. Plain and Classic also
swapped places in `SKINS`, in `QUICK_SKINS`, and in the timetable's collapsed
picker, so Plain reads first. Anyone who has already chosen a theme is
unaffected: these are only defaults for someone with nothing stored.

### 8.14 Tests in every revision subject

Each revision game (Maths, Physics, Chemistry, Engineering, Software) has a
**Practice | Test** switch. Flashcards doesn't: it is decks, not modules, so
there is nothing for a test to cover.

A test is 30 to 50 questions (`testLength`: 12 + 1.6 per topic, clamped), covers
every topic, adapts as it goes, and ends in a report. Everything that decides
things is a **plain function outside `revGame`**, which is what made it
checkable: `testPick` (next topic), `testWeight`, `testEligible`,
`historyPrior`, `analyseTest` (the report), and `chooseQuestion` (which question
within a topic, shared with practice). `revGame` only draws the screens.

**How the next topic is chosen.** Hard rules first, then a score:
- Every topic is asked at least once. When the questions left equal the topics
  still unasked, only unasked ones are allowed.
- Never either of the last two topics, if that still leaves two to choose from.
- A topic stops at a cap (`ceil(n / topics) + 2`, and never more than its
  question pool). Write-code questions are capped at 3 per test, and `gate`
  means Medium waits for Easy to be right and Hard for Medium.

Then `testWeight` scores what's left: unasked topics score high, with pressure
rising as questions run out; a topic with a miss gets `7 × (1 − p)` (p is a
Beta(1,1) estimate of getting it right) plus a bump straight after the miss; a
topic answered right with no misses is pushed back; and time since it was last
asked pulls it forward. The pick is drawn from the top three, weighted, so two
tests don't run in the same order.

**Settled slips.** A topic answered right the last two times since a miss stops
being probed. Without that rule one early mistake kept a topic "in doubt" all
test and it was chased as hard as a real gap (both got 5 questions).

**Numbers it was tuned to** (`testsim.mjs` in the scratchpad, 61 checks, run
against the real `games.js` with every subject's real topics):
- every topic covered, full length, zero back-to-back, under 3% two apart, in
  200 runs per subject
- three weak topics get about 4.5 questions each against about 1.8 for the rest
- a perfect student never gets more than 3 on one topic
- a slip is let go at 3 questions, a gap is chased to the cap of 5
- 30 runs give 30 different openings
- about 45% of topics from the first third come back in the last third
- write-code never opens a test, never stacks, Hard never before Medium

**The report** (`analyseTest`) recomputes everything from the answer log, so a
saved report can be reopened later. It gives: score and verdict, a bar per
module, **Work on these** (sorted by estimated mastery, tagged Gap / Shaky /
Missed once, each with a Practise button that jumps straight into practising
that one topic), **Common mistakes**, **Strengths**, **Probably slips**,
**Since your last test**, and a review of every question with Wrong / Skipped /
All tabs showing your answer against the right one.

Common mistakes are detected, not written per question:
- the same two options confused at least twice (either way round)
- calculations against concept questions, if 25+ points apart
- numeric misses that were the wrong sign, out by a power of ten, exactly double
  or half, or within 10%
- three or more misses under 6 seconds when right answers took 12+
- late misses on topics already answered right earlier. **Not** "accuracy fell
  in the last third": the probing deliberately pushes weak topics later, so the
  end of an adaptive test is harder anyway and that comparison would always
  cry tiredness.
- three or more skips

**Where test data lives, and why it matters.**
- `revtest.<sk>.run` and `revtest.<sk>.report` are **localStorage, not `tt.*`**.
  They hold question text, which can include SVG diagrams. The settings sync
  refuses anything over 100 KB with a 413, and a 413 stops *all* settings from
  syncing, so these must never become `tt.*` keys.
- `tt.rev_<sk>_tests` does sync: the newest test's score and per-topic counts
  (a few hundred bytes), plus just the score for the two before. That is what
  lets "Last test: 70%" show on any device.
- A run is saved after every answer and can be resumed. A test ended with fewer
  than 10 answers still shows its report but isn't recorded as "last test".
- Test answers **do** go into the practice history, so what you miss in a test
  comes back in practice. Skips don't, same as practice.

### 8.15 Fixed questions (yellow) never came back in practice

Reported: with no red or grey left, practice only ever served greens.

It was real, and reproduced with the real picker before touching it: across 35
topics where a third of the questions were yellow, yellows were picked **0.2%**
of the time. `sigScore` took points off for every time a question had been
*seen*. A yellow has always been seen more than a green, because it went wrong
before it went right, so it lost to every green. The same penalty meant a
question you kept missing sank further with each miss.

History entries gained a fifth slot, `rightRun` (right answers in a row since
the last miss), and only that counts against a question now. For a green it
equals every view, so greens order exactly as before. A yellow gets a
consolidation bonus of 1.0, tuned by playing sessions forward: on a 30-question
topic, yellows fill nearly the first 15 picks and then settle to about their
share of the pool once each has been right twice more. Reds no longer take the
penalty at all. `lastOkOf`, `everWrongOf` and `rightRunOf` read older four-,
three- and two-slot saves the way they were meant; an old yellow is treated as
just fixed so it gets its turns.

The generator draw also went from 6 to 16 samples. A generator can only be
sampled, not asked for a specific question, so with 6 draws a handful of
yellows in a big topic were rarely even looked at. It still stops early only on
an unseen question. Stopping on a red too was tried and **broke grey-before-red**,
because whichever turned up first won; `yellowbug.mjs` checks that ordering
(grey, red, yellow, green) along with the migrations, 12 checks in all.

### 8.16 Chemistry Module 1: naming, and Lewis diagrams

**Naming (`genChemName`)** used to pick wrong options at random from its own
list of 15 compounds, so anyone who knew the symbols could rule them out. It is
now built from the rules: `CATIONS` and `ANIONS` with charges (criss-crossed by
`ionicFormula`), and `COVALENT` pairs with prefix counts (`covName`). 45 ionic +
24 covalent = 138 questions. The old 15 build the **exact same formula strings**,
so their `name-f:` / `name-n:` history keys still match and nobody's progress
was lost.

Wrong options come from `pickWrong` in pools, in this order of preference:
- `conv`: the wrong naming system (an ionic compound given prefixes,
  "dialuminium trioxide"; a covalent one without, "nitrogen oxide"; AlO for
  Al₂O₃ because no prefix was read as one of each; "zinc chlorine").
- `count`: the wrong numbers (Al₃O₂; iron(II) for Fe₂(SO₄)₃ because of the ₂;
  a charge numeral on a fixed-charge metal; the formula from copper's other
  charge).
- `ion`: similar ions only (sulfate/sulfite/sulfide, nitrate/nitrite/nitride,
  carbonate/hydrogen carbonate, hydroxide/oxide, ammonium/ammonia). Not the
  halides: chloride for bromide is a symbol question, which the brief said to
  take as known.
- `swap`: a similar-sounding element (`ELEMENT_KIN`: potassium/phosphorus,
  sodium/sulfur…), taken about 30% of the time, which lands at ~7% of options.
- `spare`: weaker count slips, only reached when a simple compound (NH₄Cl, ICl)
  runs out, so every question has four options.

Wrong **formulas are compared by composition** (`composition()` parses
subscripts and brackets), so a wrong option can never be the right compound
written another way. Non-reduced ratios (Mg₂O₂) are never offered, since they
would be "wrong" only on a technicality.

**Lewis diagrams (`LEWIS`, `lewisSVG`)** replace the ball-and-stick VSEPR
pictures (`vseprSVG` is gone). Molecules sit on a square grid; shared pairs are
dots between atoms, lone pairs dots on free sides. The shape question now says
"here is the Lewis diagram, what shape is it", which is how you actually work a
shape out. A new subtopic, **Lewis diagrams** (`c-lewis`, `genLewis`), asks you
to pick the right diagram from four.

Wrong diagrams (`lewisWrong`) are single mutations of the right one, and must
fail `lewisValid` (right electron total *and* every atom full, boron allowed 6
or 8). That rule is the guard against offering a genuinely valid resonance form
as "wrong", e.g. O≡C–O for CO₂ or a B=F form of BF₃. Mutations that keep the
electron total but break an atom's octet are taken first, because they make you
count per atom rather than just totting up dots. Each mutation also carries a
`kind` (what it did, to which elements) so the same slip mirrored onto an
identical atom isn't offered twice; before that, PCl₃ often showed the left and
right Cl=P double bond as two separate options.

Picture options are a general mechanism, not Lewis-specific: a question may
return `optHtml` (choice id → HTML), and the choices are ids. The option buttons
now keep their value in `data-val`, since matching on `textContent` (as before)
breaks as soon as an option is a picture. The test log keeps `pics` for the
review, and the mistake detector skips them (it would otherwise report "you
mixed up w1 and ok").

`chemcheck.mjs` (scratchpad, 36 checks): 47 compounds hand-written and compared;
no duplicate names or formulas; all 30 old keys still produced; 80,000 questions
with four distinct options, one right, no disguised duplicates; 84% of wrong
formulas use the right elements; every correct Lewis structure valid electron by
electron; no wrong diagram valid; never two wrong diagrams of the same kind.

### 8.17 Tests: no right/wrong until the end, clearer report, score history

**Correctness is hidden during a test.** Showing right or wrong after each
answer gave away later questions on the same topic. In a test, `finish()` and
`skipCur()` now log the answer and call `settleTestQuestion`, which shows
"Saved." or "Skipped.", marks the picked option with a neutral `.picked`, and
moves on by itself after 320 ms (450 ms for typed answers). The progress bar
marks segments answered or skipped (`i.a` / `i.s`), never green or red, and the
running score is blank. Enter does nothing while a question is settling, so a
held Enter can't skip one. Practice is unchanged.

**The questions still adapt.** Hiding the result from the screen doesn't hide it
from the engine. `testsim.mjs` checks this directly: two tests with the same
random seed and the same answers, except one answer flipped from right to wrong.
In 300 runs they were identical up to that answer 300/300, different after it
300/300, and the missed topic came back within 7 questions *only because of the
miss* in 283/300.

**Report wording.**
- Common mistakes are one line each, with a bold label (Mixed up, Calculations,
  Concepts, Wrong sign, Out by a power of ten, Double or half, Rounding, Rushed,
  Late slips, Skipped) and a plain sentence after it.
- Not enough data is said as such. Fewer than 10 answers: the hero reads "Too few
  answers to judge." Fewer than 12: common mistakes says there aren't enough
  answers to see patterns. No right answers at all: it says there's nothing to
  compare the mistakes against. Only with real data does it say "No repeated
  pattern in the mistakes." It used to say "Nothing systematic stood out" in all
  three cases, which read as a clean bill of health after an abandoned test.
- Strengths merges what used to be two lists (proven strengths, and "Also right
  first time, so it moved on") into one, each tagged "X of Y right", with a
  caption explaining why "1 of 1" is common: a topic answered right first time
  isn't asked again.
- Slips read "Wrong once, then right every time after". Since your last test
  reads "Better than last time" / "Weaker than last time".

**Score history.** `historyHTML()` draws an inline SVG line chart of the last
`TEST_HISTORY` (20) tests from `tt.rev_<sk>_tests`, on the test intro ("Your test
scores") and in the report under the score. It appears once there are 2 tests.
Single series, 0/50/100% gridlines, the latest value labelled, a hover and
keyboard-focus tooltip (`wireHistory()`), and a `<details>` table of the same
numbers. Width follows the container (`clientWidth − 28`, clamped 240 to 640)
with `overflow:hidden`, because a 1px overhang put scrollbars on the card.

Only the newest entry in `tt.rev_<sk>_tests` keeps per-topic counts (`t`); the
rest are slimmed to `{d, n, r, s, pct, ms}`, so 20 tests stay far under the
100 KB sync limit.

### 8.18 Yellow turns green after one more right answer

`stateOfHist(h)` is now the one place colour is decided: grey if unseen, red if
the last answer was wrong, yellow if it was ever wrong **and** `rightRun < 2`,
otherwise green. So wrong then right is yellow, and one more right makes it
green. Before, `everWrong` alone kept a question yellow forever. The
consolidation bonus in `sigScore` now applies only while a question is yellow, so
a question that has turned green competes as a green. The legend's tooltip says
this. `node yellowbug.mjs after` (12 checks) covers the ordering and old saves.

### 8.19 Empirical formula, and other giveaways

**Empirical formula (`genChemEmp`)** was a fixed list whose wrong options were
other compounds' formulas, so usually three of the four didn't even contain the
right elements. It now generates questions from `EMP_LEGACY` (the original 20,
still keyed `emp:0` to `emp:19`, so history carries over) plus `EMP_MORE` (18
more, including three-element compounds), with `ATOMIC_MASS` and `ELEMENT_NAME`.
Questions give either percentages or grams in a sample. Each is checked to be
solvable from the rounded numbers shown; if a sample size doesn't work it tries
others, then falls back to percentages to 2 dp.

Every wrong option uses the same elements and is a real slip: not dividing by the
smallest, the ratio flipped, rounding 1.5 or 1.33 instead of multiplying up, a
multiple of the right answer, two subscripts swapped, or one subscript out by one.
Subscripts are capped at 9 and multiples at 3, which stops absurd options such as
Fe₁₃O₅. The note after answering shows the working. `empcheck.mjs` (5 checks).

**Answer-is-the-longest giveaway.** An audit of the 206 hand-written bank
questions (BRAKES, PRODUCTS, BIOMED, ENERGY_C, ENG_CARBON, MIX_CONCEPT, PHYS_DYN,
RATE_C, PHYS_EM, EM_EXTRA, WAVE_EXTRA, PHYS_WAVE, PHYS_KIN, PARA_EXTRA,
DEV_EXTRA, MATH_CONCEPTS, MECH_EXTRA) found 98 where the right answer was at
least 1.6× the length of every wrong one (`banklen.mjs`). All 98 were rewritten
with tighter right answers and fuller, plausible wrong ones. **Items were edited
in place, never added, removed or reordered**, because bank keys are array
indices and moving one would hand someone's history to a different question. The
right answer is still the longest option 45% of the time (`longest.mjs`; it was
74%, and chance for four options is 25%), so this is better, not solved.

**Efficiency options over 100%.** `genMachines` could offer 117.6% or 836.6%.
`pctMC(value, wrongs)` now drops anything over 100% or under 3% and fills the gap
with near misses. Across 19,096 generated options none exceed 100%.

### 8.20 Engineering: harder mechanics, levers, pulleys and gears; cast irons moved

Built to match the HSC-style sheets supplied. Diagrams are deliberately plain
line drawings (`mechSVG`, `leverFig`, `pedalFig`, `twoArmFig`, `pulleyFig`,
`gearFig`). Their text is sized with a `font-size="13"` attribute, because CSS
must stay in `rem`.

- **Moments** (`genMomentsAll`, 20% the old simple ones): a force at an angle on
  a spanner (`M = F·L·sin θ`); a pedal with an angled force held by a horizontal
  cable (`T = F·a·cos θ / h`); two forces on a bent bracket, one vertical on an
  angled arm and one perpendicular to its arm, asking for the resultant moment
  and its sense.
- **Levers** (`genLevers`, new topic `e-lever`): classes from real examples
  (`LEVER_EXAMPLES`), what's in the middle, MA above or below 1, effort from
  moments, efficiency, compound lever VR.
- **Pulleys & gears** (`genPulleyGear`, new topic `e-gear`): pulley efficiency
  and effort (g = 10, see 8.26), gear train MA at an efficiency (`η·Tb/Ta`), output speed,
  compound gear VR, and bicycle drive efficiency with
  `VR = 2·crank·Tsprocket / (D·Tchainwheel)`.
- Ratio options always number four (`ratioMC`), and percentages go through
  `pctMC`.

Each generator returns `data`, and `mechcheck.mjs` (14 checks, see 8.26) recomputes 30,000
answers with independent physics and reproduces the sheets' own examples: gears
30/50 at 85% gives MA 1.42:1; bicycle 446 N, 72 N, 168 mm, Ø675, 49/17 gives
about 93.5%; pulley 120 kg, 400 N, 4 ropes gives 75% (g = 10); the bracket example gives 3.69 kN·m clockwise.

**Cast irons** (`e-iron`) moved from their own module into Steels. The topic id is
unchanged, so progress is kept. Engineering is now five modules and 15 topics,
and a test is 36 questions (was 33). Because the topic list changed, an
Engineering test that was in progress starts again: `resumeTest` discards a run
whose saved state lacks any current topic.

### 8.21 Moderator: override someone's display name

For people who go by something other than their email name. On the Signed-in
users tab each row has a **Rename** button; an empty name clears the override.
Renamed rows also show the email-derived name in brackets after the new one.

- `api/_names.js`: `nameOverrides()` reads the table into a Map, cached for 60 s
  per instance. If the table doesn't exist or the read fails it returns an empty
  Map and logs a warning, so every page keeps working exactly as before.
  Also `withName(map, email, fallback)` and `forgetNameOverrides()`.
- The write is `POST /api/leaderboard {action:'rename', email, name}`, owner only
  (`OWNER_EMAIL`), name trimmed, spaces collapsed, capped at 40 characters. It
  lives in `leaderboard.js` rather than its own route because the project uses 11
  of the 12 functions Vercel Hobby allows. Returns 502 with a hint if the table
  is missing.
- Names are applied **when read**, never written into other tables:
  leaderboards, Tetris, the forum, calendar, shared decks and Daily results all
  wrap their display name in `withName`. Stored rows keep the email name, so
  removing an override (or the whole table) puts everything back.
- Other server instances pick up a change within the 60 s cache.
- **Naming someone before their first visit.** The note above the roster ends
  with *Name someone who hasn't opened it yet*, which asks for a school email and
  a name and posts the same `rename` action. `siteUsers()` in `leaderboard.js`
  walks the override map after collecting activity and adds any email it hasn't
  already seen with `pending: true`; those rows show 0 scores, 0 days and
  "not yet" in the last-seen column, and the pending flag disappears by itself
  once the person turns up in prefs, scores, daily results or the forum. The
  email is checked against `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` on both sides.

```sql
create table name_override (
  email      text primary key,
  name       text not null,
  updated_at timestamptz not null default now()
);
```

`namestest.mjs` (16 checks) runs the real routes against an in-memory database:
everything loads before the table exists, a student gets 403, the rename shows on
the roster, both boards and the forum, the score rows are untouched, clearing
restores the email name, and names cap at 40.

### 8.22 Phones and tablets

The brief was "mobile compatible without changing desktop". Two gates keep those
apart, and anything new should use one of them:

- **Narrow-screen CSS** in `max-width` queries (640, 600, 560, 520, 480px). All
  the new rules sit at the end of `games.css`, in the existing 640/560 blocks of
  `site.css`, a new 600px block in `index.html`, and the 600px block in
  `calendar.html`.
- **Touch** as `(hover: none) and (pointer: coarse)`: `TOUCH` and `tap(desktop,
  touch)` in `games.js`, `TOUCH` in `tour.js`, and the matching media query in
  `games.css`. A touchscreen laptop reports a fine primary pointer, so it keeps
  the desktop version. On-screen pads are only *rendered* when `TOUCH` is true,
  and the desktop strings are passed through `tap()` unchanged.

Shared helpers in `games.js`: `onSwipe(el, fn, {step, repeat, tapFn})` (ignores
mouse pointers) and `wirePad(pad, down, up)` (hold-able buttons with pointer
capture, so a slide off the button still releases it).

Per game:
- **Tetris:** the pad's handler mirrors `onKey`/`onKeyUp` rather than calling
  them, so key handling is untouched. Rotation doesn't auto-repeat on touch.
  Below 560px `.tgame` becomes a grid (Hold | board | Next, stats underneath)
  using `display:contents` on `.tleft`, which took the board from ~120px to
  ~183px wide at 375px. Start scrolls the board into view on touch.
- **2048:** tiles are placed in pixels, so `fit()` shrinks `CELL` when the
  wrapper is narrower than 320px (it was 74px tiles on a ~70px grid, visibly
  misaligned). At desktop widths it computes 74, the original value.
- **Minesweeper:** hold (380 ms) flags. The click that follows the lift, and
  Android's own long-press `contextmenu`, are ignored for a moment afterwards,
  or the flag would be dug or toggled straight back.
- **Revision:** options over 22 characters get `.rvlong`, which only has an
  effect below 520px. The score chart ignores `pointerleave` from touch, because
  a finger "leaves" the moment it lifts.
- `theme.css` forces text inputs to 16px on iOS only
  (`@supports (-webkit-touch-callout:none)`), since Safari zooms into anything
  smaller when tapped.

Checked at 320 and 375px with touch emulated (pads, swipes, hold-to-flag and
tap-to-rotate driven with real pointer events, no horizontal overflow on any
page), and at 1280px to confirm the desktop computed styles, strings, board
sizes and layouts match what was there before. `index2.html` isn't linked from
anywhere and was left alone.

### 8.23 Typed number answers

Before this, 13 typed questions graded with `Math.abs(Number(v) - x) < tol`, so
`180 g`, `180g`, `−92` (U+2212, which the notes themselves print) and `5,040` were
all `NaN` and marked wrong. Now:

- `readQuantity(raw)` → `{ value, rest, signed, extra }`. It handles:
  - thousands (`5,040`, `5 040`) and decimal commas (`0,5`)
  - `e`, `× 10^n` and superscript notation
  - simple fractions, a trailing charge sign (`3+`)
  - a prefix such as `n =` or `about`
  - `extra` flags a second number in the rest (`720 or 5040`), which is always rejected
- `qty(answer, { tol, dim, dir })` builds `accept`. `dim` picks a table in
  `UNIT_TABLES`, each scaled to the unit the questions use. Units are matched by
  `matchUnit`, longest run of words first, after `unitKey` normalises spellings
  (`mol·L⁻¹` → `mol/L`, `per`, `litres` → `L`). Matching is case-sensitive first,
  then case-insensitive only where that isn't ambiguous within the table.
  - A unit from the expected table is converted.
  - A unit found only in another table makes the answer wrong.
  - Unknown words (`of NaCl`, `ways`) are ignored.
  - Rounding to 3 s.f. is always within tolerance (`sfSlack`), except for exact (tol 0) answers.
- `oxAccept(ox)` adds Roman numerals. `normEq` (the default for questions with
  no `accept`, such as Maths counting) uses `readQuantity` for numeric answers.
- Each question now has a display `unit`. It is shown after "Answer:" and logged
  with the answer, which `TEST_NUMERIC` still matches. `accept.read` gives the
  typed value in the question's unit. The test log stores it as `gv`, so the
  report's wrong-sign and power-of-ten checks see `1.8 kg` for 180 g as ×10
  rather than as the number 1.8.

To add a typed-number question: `input:true, answer, unit:'mol', accept:qty(x, {tol, dim:'amount'})`.
Add units to `UNIT_TABLES` rather than special-casing a question.

`qtycheck.mjs` (scratchpad, 3,644 checks) covers:
- about 200 hand-written accept/reject cases across every table
- every real typed generator accepting its own shown answer written four ways,
  and rejecting a different number and the opposite sign (400 draws each)
- the report reading `gv`

### 8.24 Redox and galvanic cells: more question kinds

`genRedox` keeps its two original kinds, now 30% of draws. The oxidation state
question keeps the `ox:` key; the change question is still unkeyed. It adds:
- `rx-ox` / `rx-red`: which element is oxidised or reduced
- `rx-oa` / `rx-ra`: which reactant is the oxidising or reducing agent (two options)
- `isredox`: yes or no
- `half-red` / `half-ox`: pick the reduction or oxidation out of two half-equations
- `half-kind`: is this half-equation an oxidation or a reduction

The data:
- `REDOX_RX`: 22 reactions, each with `ox`/`red` as [element, before, after],
  the agents, and every element present. The wrong options come from `els`, and
  the other half of the reaction is always one of them.
- `NOT_REDOX`: the "no" cases.
- `HALF_EQ`: half-equations stored once as {oxidised form, electrons, reduced
  form} and written either way by `asReduction`/`asOxidation`, so the electrons
  can't end up on the wrong side.

`genGalvanic` keeps `galv-emf` and `galv-anode` (37% of draws, same keys). It
adds `cathode`, `redat`/`oxat`, `redsp`/`oxsp`, `cahalf`/`anhalf`, `eflow`,
`gain`/`lose`, `positive`, `anions`/`cations` and `overall`, all keyed
`galv-<kind>:<pair>`. `SRP` entries gained a third field, the ion's charge, used
to write half-equations and to balance the overall equation by the lowest common
multiple of the two charges. Al³⁺/Al (−1.68 V) and Ni²⁺/Ni (−0.24 V) were added
from the NSW data sheet. Mg stays at −2.37 V, as before; the data sheet says −2.36.

`redoxcheck.mjs` (scratchpad, ~42,500 checks) doesn't trust the data. It parses
every species (subscripts, brackets, charges), and checks that:
- every equation balances by atoms and charge
- each claimed oxidation number matches one it works out itself from the usual
  rules, only the named elements change, and nothing changes in `NOT_REDOX`
- each agent contains the right element
- half-equations balance their charge with the electrons
- over 20,000 draws of each generator, every kind appears and every answer
  matches an independent derivation (cathode = higher E°, and so on)
- options are 2 to 4 and distinct, exactly one overall equation is balanced in
  the right direction, and E° is printed signed to 2 dp

### 8.25 Site-wide settings, and turning weekly boards off

The first setting that belongs to the site rather than to a person. The pattern
to copy for the next one:

- `api/_settings.js` is a helper, not a route (the `_` prefix keeps it off
  Vercel's function count, which is at 11 of 12). `siteSettings()` reads the
  `site_setting` table into `{ weeklyBoards }`, cached 60 s per warm instance,
  and falls back to the defaults if the table is missing or the read fails, so
  the site behaves exactly as before until the table exists.
  `setSiteSetting(key, value)` upserts and clears the cache.
- Both ends live in `leaderboard.js`, again to avoid a new function:
  `GET ?settings=1` is readable by **anyone signed in** (every page needs it to
  decide whether to draw the weekly tab), while `POST {action:'settings',
  weeklyBoards:bool}` is owner-only and rejects a non-boolean. Values are
  stored as the strings `on` / `off` under the key `weekly_boards`.

Client side (`games.js`): `siteSettings()` fetches once per page load into
`siteCfg`, `weeklyOn()` reads it, and `forgetSiteSettings()` re-fetches (used by
the moderator tab). Anything that draws the week/all tabs awaits the fetch
first, so the tabs are never drawn and then removed:
- `mountLB` (the panel under a game) omits the tabs and starts on `all`. It also
  checks `lbSeq`, bumped by `openGame`/`showGrid`, so a slow settings fetch can't
  append a panel to a game the player has already left.
- Tetris `loadLB` skips the weekly request entirely and titles the board
  "Sprint, fastest times (all-time)".
- `BUILD.leaderboards` folds it into the existing `single` flag (survival and
  zen were already all-time only) and re-reads its "how" line after the fetch.
- `BUILD.admin` hides the period tabs, forces `period = 'all'`, and adds the
  `Site settings` category (`kind:'s'`). That category is gated on `isAdmin` for
  looks only — the server is what actually refuses a change.

**Scores keep being written to the weekly boards while it is off** (both in
`lbSubmit` and Tetris's `submitScore`), which is what makes turning it back on
lossless. The switch is display-only by design.

```sql
create table site_setting (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
```

`weeklytest.mjs` (scratchpad, 17 checks) runs the real route against an
in-memory database: defaults and boards before the table exists, the 502 hint,
a student refused (and nothing written), a non-boolean refused, the owner
toggling it, everyone else reading the new value, weekly rows surviving and new
scores still reaching both boards while off, the weekly board coming back
intact, and the rest of the route unchanged. `namestest.mjs` copies the new
helper into its temp API folder too.

### 8.26 Engineering uses g = 10

The NSW Engineering Studies course takes g = 10 m/s², so every Engineering
question does too. Physics is deliberately left at 9.8 (its gravitational PE
question) and so are the Physics concept cards that mention 9.8 m/s².

In Engineering, gravity only comes into the two pulley questions in
`genPulleyGear` (efficiency, and the effort needed). Both read `G_ACCEL`, now
`10`, for the arithmetic *and* for the "(g = … m/s²)" in the question and the
"mass × g" in the working, so the text can't disagree with the answer again. No
other Engineering generator or bank turns a mass into a weight: moments, levers,
stress, gears and machines are all given in newtons. The pulley efficiency
answers stay realistic, and 'forgot g' is still a wrong option, now out by a
factor of exactly 10.

`mechcheck.mjs` now does its independent physics with g = 10, expects the
sheet's 120 kg / 400 N / 4-rope example to give exactly 75%, and adds three
checks over 1,500 draws of every Engineering topic:
- nothing uses 9.8 as gravity (`g = 9.8`, `× 9.8)`, `9.8 m/s²`), while ordinary
  answers that happen to be 9.8 N·m don't trip it
- every "g =" says 10
- Physics still says g = 9.8

The checks were confirmed to fail against a copy with g put back to 9.8.

### 8.27 Bank cards that talked about a picture they didn't show

Reported: "In these microstructure schematics, the hatching represents…" came up
with no picture. It and the card after it (`ENG_CARBON` 18 and 19, the solid
dark shapes in a cast iron) were written to sit beside the microstructure
diagrams, but bank cards are plain text, so they turned up alone and couldn't
be answered. A White cast iron card also said "hatched pearlite".

- Card 18 now draws `microSVG('med')` and asks what the striped grains are
  (pearlite). Its note explains why pearlite looks striped: alternating layers of
  ferrite and cementite.
- Card 19 draws `microSVG('grey')` and asks what the solid dark shapes are
  (graphite).
- White cast iron's `micro` text now reads "pale cementite regions around
  pearlite, with no graphite".

They were **edited in place**. Bank history is keyed by position (`carb#18`), so
moving or removing a card would hand someone's progress to a different question.

`picturecheck.mjs` (scratchpad) samples 2,500 draws of every topic in every
subject. Any question whose wording only makes sense with something on screen
fails unless it actually carries a diagram, code block or picture options. That
means "schematic", "hatch", "striped", "this lever/pulley/circuit…", "shown
below" and the like. Definitions such as "a data flow diagram is…" and maths
questions like "the graph of y = x²…" deliberately don't count. It found only
these three, and it fails if the original wording is put back.

### 8.28 Deleted scores no longer lock a player out

Reported: once a moderator removed someone's score, they could never get back
on the board. It wasn't the server: `api/leaderboard.js` and `api/tetris.js`
both simply save the next score when there's no row. It was `recordStat`, which
only sent a score to the board when it beat the **personal best saved in the
player's settings** (`tt.stats`, synced across devices). Deleting the row on the
server didn't touch that saved best, so nothing below the removed score was ever
sent. If the removed score was bogus, that was effectively permanent. The same
rule also left the weekly board empty each week until you beat your all-time
best.

Now `recordStat` calls `lbConsider`, which sends a score when it is a new personal
best (as before) **or** when it beats what the server holds for you on either
board:
- `lbBest[game] = { wk, week, all }` is refreshed from every board response
  (`loadLBoard` each time the game opens, and each submit).
- If it's missing, `lbKnow` fetches the board once.
- A new week invalidates it, so this week's empty board is never judged by last
  week's score.
- `lbSubmit` sends one request at a time per game, and afterwards sends only the
  best score that came in meanwhile, so 2048 (every merge) and Odd One Out
  (every answer) don't fire a request each time.

The saved personal best in settings is untouched; it still drives the "best"
shown on game cards. Tetris was never affected: it sends every finished game and
lets the server keep the best.

`resubmitcheck.mjs` (scratchpad, 13 checks) runs the real
`recordStat`/`lbConsider`/`lbSubmit` against an in-memory server with the same
keep-the-best rules. It covers:
- a deleted player's lower score getting back on both boards
- worse scores not sent, better ones sent
- the server being asked when the game hadn't been opened
- the weekly board filling
- lower-is-better (Reaction)
- 5 rapid 2048 merges sending at most 2 requests and ending on the right score
- a week rollover

On the old code 8 of the 13 fail.

### 8.29 Tetris: a soft landing bump, and a readable board on see-through themes

**Landing.** The side-to-side `tshake` CSS animation is gone. `thud(px, ms)` in
`BUILD.tetris` animates the board wrapper (board, flash and overlay together)
straight down and back with the Web Animations API: 4 px for a hard drop, 1.5 px
for a piece that locks on its own (`commitLock(now, hard)`), and 8 px over 360 ms
on topping out. It is gated on `gameAnim()` like the flash, so reduced motion and
the game-animation setting still turn it off.

**Board background.** `draw()` used to fill the board with `--panel-2` over the
previous frame without clearing. Where that colour is see-through, which Glass is
at 5.5% white, every old frame showed through. Falling pieces left trails, and
within a couple of seconds the board had built up to near-solid white with thick
grey grid lines. That was the poor dark-mode visibility. Now `draw()` clears,
paints `--bg` (the theme's solid page colour), then `--panel-2`. Glass dark
becomes a dark navy board and Glass light a pale one. Blueprint and the other
tinted themes get the same solid base. Themes whose `--panel-2` is already
opaque draw pixel-for-pixel as before (checked on Plain).

### 8.30 Resetting one subtopic's progress

Practice history is `tt.rev_<sk>_hist`, one entry per keyed question, with
signatures `<topicId>:<key>` (older bank-style ones are `<topicId>#<index>`). So a
subtopic's share is every entry with its id plus a separator. Three plain
functions sit next to `historyPrior`, which uses the same prefix rule:
- `topicSigs(hist, id)` lists that subtopic's entries.
- `topicProgress(hist, id)` counts them by colour for the confirmation. It counts
  every saved entry, including any left from retired questions, so the number
  shown is exactly the number removed. The bar above the questions counts only
  current questions, so the two can differ slightly.
- `resetTopic(hist, id)` deletes them in place and returns what it removed.

In `revGame`, `resetUI()` adds a "Reset progress…" link to the bottom of both
practice screens (never during a test), wired in `wireSel`. `openReset()` builds
a fresh `<dialog class="setdlg rvresetdlg">` each time, reusing the settings
dialog styles, with two views:
- **List:** every subtopic, grouped by module where there are modules.
- **Confirm:** the exact counts, what is kept, the sync note, and Cancel focused
  by default.

Resetting saves with `TT.set`, and settings sync replaces the whole value, so
the deletion reaches other devices. The removed entries stay in memory for
**Undo** until the box closes. Closing with ✕ or the backdrop tidies up and
repaints the progress bar directly. The dialog's `close` event is only relied on
for Escape, because it is queued, and in the preview window it wasn't delivered
at all. `onEnter` now ignores Enter while any dialog is open, so Enter in the box
can't press Start or Next behind it.

Two caveats. Another open tab or device with the old history still in memory
could write it back the next time it saves (settings sync is last writer wins).
And the goal and tally for endless subjects are subject-wide, so they are left
alone and the confirmation says so.

`resetcheck.mjs` (scratchpad, 8 checks) covers:
- exact counts and exactly the right entries removed
- a neighbouring id that merely starts the same way left alone
- `historyPrior` seeing the subtopic as fresh, and undo restoring it
  byte-for-byte
- across all 79 real subtopics, no reset reaching into another's entries or
  missing any of its own

### 8.31 Revision progress moved out of the settings blob, and got a schedule

Measured before changing anything: the keyed question pools are 42 (Maths), 168
(Physics), 1,347 (Chemistry), 304 (Engineering) and 287 (Software), about 86 KB
of history once answered. `api/prefs.js` rejects a settings payload over 100 KB
with a 413, and that stops every other setting syncing, so Year 12 subjects
could not be added until this moved.

**Storage.** New table `revision_progress(email, subject, data, updated_at)`,
served by `api/prefs.js` under `?rev=` so Vercel's function count is unchanged:
`GET ?rev=<subject>`, `GET ?rev=*` (for the daily plan), `PUT ?rev=<subject>`.
Its own cap is 400 KB per subject. A missing table reads as "nothing saved"
rather than an error, and the PUT says so plainly.

Client side, `RV` in games.js:
- `RV.load(sk)` returns the subject's history synchronously from
  `localStorage['rev.<sk>']` — deliberately not a `tt.` key — then pulls the
  server copy in the background and merges.
- `RV.save(sk)` writes locally at once and uploads 2 s after you stop, plus on
  `pagehide` and when the browser comes back `online`.
- `merge` works per question: the entry with the later answered-on date wins,
  falling back to more attempts for entries saved before dates existed. Two
  devices combine instead of one overwriting the other, which was the caveat
  noted in 8.30.
- `migrate` folds any old `tt.rev_<sk>_hist` into the new store, removes it and
  pushes the smaller settings blob. Idempotent, so a stale copy arriving from
  another device is absorbed the same way.

**Scheduling.** History entries gained two slots:
`[seen, wrongness, lastOk, everWrong, rightRun, answeredOnDay, dueDay]`, whole
days since the epoch. `REST_DAYS = [0, 0, 3, 7, 16, 35, 60]` indexed by
`rightRun`: index 1 is deliberately 0 so a just-fixed (yellow) question still
comes back in the same session to be confirmed, which is what 8.18 is about.
`sigScore` keeps its old ordering — unseen, then wrong, then yellow — and adds
a term for due questions (`+1.5` plus `0.1` per day overdue, capped) against
`-2.5` for anything resting. Entries with no date, i.e. everything saved before
this, count as due now. `dueNow(hist, sigs, today)` is the counter the daily
plan will use.

`schedcheck.mjs` (25 checks): the interval ladder, the ranking (unseen > wrong >
yellow > due > resting, and more overdue ranks higher), a week of practice on a
real topic, that practice still serves something when everything is resting, and
the two-device merge. `prefscheck.mjs` (16 checks): the route before and after
the table exists, per-subject rows, `?rev=*`, the separate size caps, bad
subject names, and that settings never contain progress.

Scratchpad note: the earlier sessions' scripts were wiped when Windows cleaned
the temp folder. `gameharness.mjs`, `checkall.mjs` and `mock.mjs` were rewritten;
the older suites (testsim, chemcheck, redoxcheck, mechcheck, qtycheck,
picturecheck, resetcheck, resubmitcheck, weeklytest, namestest, colours,
empcheck, yellowbug) are gone and would need rewriting if something they cover
is changed again.

### 8.32 Year 12 content: hsc.js, and Maths Advanced

**Where it lives.** `hsc.js`, loaded after games.js on revision.html only. A
classic script shares the global lexical scope, so it uses games.js's helpers
(`mc`, `qty`, `ri`, `pk`, `rd`, `sup`, `gcd2`) and pushes into `GAMES`/`BUILD`
directly, then calls `showGrid()` because games.js has already drawn the page.
games.js was 440 KB before this; the HSC subjects would roughly double it.

**The year split.** Revision cards carry `year: 11 | 12`. `showGrid`'s revision
branch draws a year switch when both exist and filters by `yearShown()`, which
is `tt.rev_year` if set, else `defaultYear()`: Year 12 from Term 4 of the year
before the HSC (`HSC_YEAR = 2027`, `YEAR12_FROM`), Year 11 before that. Year 11
ids and `statKey`s are untouched, so progress carries over; Year 12 subjects use
new keys (`maths12`), which the per-subject storage in 8.31 keeps apart.

**Maths Advanced.** Seven modules, 17 topics, 56 question kinds, all generated.
Deliberately unkeyed: parameterised questions have no fixed identity to schedule
or store, which also keeps the new progress rows small. Conventions worth
keeping if more subjects are added:
- `fracStr` for exact coefficients (1/35, not 0.0286), `neg` for the typographic
  minus, `plusTerm`/`cubicStr` so a zero coefficient prints nothing, `pow` for
  exponents that are expressions (option buttons are plain text, so `e^(3x + 2)`
  rather than superscripts).
- Typed answers go through `qty` from 8.23, so units and `$1,234.56` are read
  properly; money uses `moneyQ`.
- Every computed question carries `data`, and the calculus ones also carry `fx`
  plus `dfx` as plain expressions.

`mathscheck.mjs` (13 checks) does not trust the generators. Over 400 draws of
each topic it checks the shape (four distinct options including the answer, or a
typed answer its own marker accepts, with and without its unit), re-derives
every numeric answer from `data` with independent maths (sums by loop, areas by
Simpson's rule, loan repayments by bisection rather than the formula), and
**reads the printed answer back as an expression** (`toJS` handles superscripts,
implicit multiplication, the typographic minus, ln/sin/cos) to differentiate or
integrate it numerically and compare it with the function asked about. That last
check is what caught the antiderivative coefficients being printed as rounded
decimals.

### 8.33 Maths Extension 1 (Year 12)

Nineteen topics in seven modules, `BUILD.maths12e1` / `GAMES` id `maths12e1`, all
in hsc.js under the conventions in 8.32. Topic names follow the labels NESA uses
to tag questions in its own sample HSC materials for the 2024 syllabus, which is
also where the paper's shape comes from (70 marks, 2 hours, Section I ten
multiple-choice marks, Section II 60 over four questions). Those materials were
read for structure only; no question, number or wording is taken from them.

- The **Year 11 in the HSC** module exists because the Extension 1 paper examines
  Year 11 Extension 1 content (polynomials, parametric and inverse functions,
  further trigonometry, the binomial theorem) and the Year 11 `maths` game is
  Advanced-only.
- Helpers added: `kOff` (writes k, k + 1, k + 2 so no option ever reads
  "k + 1 + 1"), `vecTerm`/`vecStr` (components with the typographic minus and no
  "+ 1j"), `E1_SERIES` (each identity carries `termFn` and `termExpr`/`sumExpr`
  so a checker can re-derive both sides), `E1_DIVS`, `E1_TRIP2`/`E1_TRIP3`
  (Pythagorean triples, so magnitudes and triangles stay exact), `E1_EXACT`,
  `E1_TRIGCOUNT`.
- `sup()` only knows digits. Letter exponents are written `e^(kt)`, never
  `'e' + sup('kt')`, which silently renders as "ekt".

**New unit tables.** `UNIT_TABLES` gained `length` (m, cm, mm, km and spellings)
and `time` (s, min, h and spellings). `ms` is deliberately absent — too easily
meant as m s⁻¹ — and so is `t`, which is tonnes under `mass`. The only behaviour
change for the eleven existing `dim:` call sites is that a length or time unit
typed on, say, a mass answer is now rejected as the wrong kind instead of being
ignored. `unitcheck.mjs` (31 checks) covers both the new dims and the old ones.

`ext1check.mjs` re-derives every numeric answer from the question's own `data`,
independently of the note: Simpson's rule for integrals, central differences for
derivatives (including checking a printed antiderivative differentiates back to
the integrand), stepping the cooling equation rather than solving it, finding the
roots of a cubic numerically to confirm the sum/product of roots, expanding
brackets term by term for binomial coefficients, and counting the solutions of
the trig equations by hunting roots on a fine grid. Every question is also fed
its own printed answer through its own `accept`. 3040 questions, 6080 checks.

Two bugs it caught in itself rather than the content are worth remembering: a
comparison tighter than the printed rounding (judge an answer at its own number
of decimals), and a flat root (tan x − sin x ≈ x³/2 near 0) registering as
hundreds of separate grid zeros unless roots are clustered.

### 8.34 Maths Extension 2 (Year 12)

Sixteen topics in five modules, `BUILD.maths12e2` / id `maths12e2`, matching the
2024 syllabus's Year 12 focus areas (the nature of proof, further work with
vectors, complex numbers, further integration, mechanics). Paper shape from
NESA's assessment page: 100 marks, 3 hours, Section I ten objective-response
marks, Section II 90.

- New helpers: `cx(a, b)` writes a complex number the way it is read (`3 − i`,
  `−2i`, `5`), `E2_CIS` holds the eight exact arguments, `sphTerm` keeps a
  sphere centred on an axis from printing `(x + 0)²`, `E2_IMPLY` and
  `E2_INDINEQ` carry the proof statements with the facts needed to mark them.
- Arguments are in degrees throughout, with the principal range quoted in the
  question — the alternative is parsing `−3π/4` out of a text box.
- Cross products are deliberately absent: the NSW course does not have them.

`ext2check.mjs` re-derives everything with maths written separately from the
generators: complex arithmetic component by component (so `dm-power` is checked
by repeated multiplication, not by de Moivre), minima by search over a grid plus
refinement rather than by calculus, Simpson's rule for the integrals, the
partial-fraction coefficient tested by making the identity hold at three
arbitrary points, the t-formulae checked numerically at three angles, the
counterexample questions checked against independently written predicates, and
**the mechanics by integrating the equation of motion with RK4** — the SHM
period is measured from zero crossings of the simulated path and the resisted
speed is stepped from v̇ = g − kv. 2560 questions, 5120 checks.

Two content bugs it caught: n² + n + 11 first fails at n = 10 (121 = 11²), not
11, and “every number of the form 4k + 1 is prime” is broken by 1 itself unless
the claim says k ≥ 1.

### 8.35 The mock HSC engine

`mock.js`, loaded after hsc.js on revision.html. It adds one card (`mockhsc`)
which opens a chooser rather than a practice game, and it needs hsc.js's module
lists, so those are now named constants (`MODULES_MA12`, `MODULES_ME1`,
`MODULES_ME2`) with `BUILD.maths12…` built from them.

**Building a paper** (`mockBuild`). Section I draws from the same generators as
practice, taking only multiple-choice questions with four options and going
round the modules so the ten are spread. Section II is built question by
question so each lands on exactly the marks the real paper gives it (15): each
starts with authored long-response questions from the subject's bank and is
topped up with two-mark parts made from typed practice questions. A bank
question may appear twice in a paper but only with different numbers, and one
`seen` set covers both sections so nothing is ever asked twice.

**Marking.** Every criterion in a `guide` is worth exactly one mark, so a part's
marks are `guide.length` and self-marking never needs a judgement about halves.
Section I is marked outright. `mockcheck.mjs` builds 90 papers and checks the
totals, the spread, that criteria add up to the marks, that the focus-area
breakdown adds back to the paper total, and that ticking everything gives
exactly full marks.

**Timing.** Reading time disables every input. The working clock starts when
reading ends or is skipped — `startWriting()` sets `endsAt` from that moment, so
skipping reading time cannot hand out extra working time. At zero the paper goes
to marking by itself. A run is saved to `mk.run` in localStorage (not synced —
it is too big and only matters on the machine you are sitting at) and the chooser
offers to carry on. Attempt history is twelve small rows in `tt.mock_hist`, which
does ride the settings sync.

**The minus-sign repair.** Writing `'y = ' + a + 'x'` with a negative `a` gives
an ASCII hyphen, which reads wrong next to the typographic minus everywhere
else. Rather than fixing dozens of call sites, `tidyQ` wraps every Year 12
generator (one line at the bottom of hsc.js) and `fixMinus` repairs a hyphen
sitting in front of a number; `x-axis` is left alone. It also de-duplicates
options, because two that differed only in which minus they used are the same
option once repaired — which is how a long-standing bug in the Maths Advanced
`ln(ax + b)` question was found, where the answer and one distractor were the
same number written two ways.

`typocheck.mjs` scans every Year 12 question, option, note, criterion and model
answer (about 15,000 a run) for ASCII minus signs, stray `undefined`/`NaN`,
doubled spaces and dangling operators. It is the permanent guard for this class
of bug; run it after adding content.

### 8.36 Physics (Year 12), and papers that are not all the same shape

`hsc2.js` holds the Year 12 sciences and loads between hsc.js and mock.js, so
the mock papers can see `MODULES_PH12` and `LONG_PH12`. Sixteen topics in the
four HSC modules of the **2017** syllabus — rechecked against NESA, because a
Physics 11–12 (2025) syllabus exists but is first examined in 2028 (Chemistry's
is 2029), both after this site's 2027 HSC.

- Constants live at the top (`PH_G`, `PH_LIGHT`, `PH_PLANCK`, `PH_Q`,
  `PH_MASS_E`, `PH_MU0`, `PH_GRAV`, `PH_M_EARTH`, `PH_R_EARTH`, `PH_WIEN`) with
  the values from the HSC data sheet. `phSci` prints 3.47 × 10⁵ when that reads
  better than a long decimal, and `readQuantity` already understands typed
  answers in that form.
- `UNIT_TABLES` gained **`work`**, a joule-based table including eV/keV/MeV/GeV.
  The older `energy` table is kJ-based for chemistry, so physics answers in
  joules use `dim:'work'` — passing `dim:'energy'` there would have divided by a
  thousand.
- Section II shapes are now per paper. `MOCK_PAPERS` entries may carry
  `shape: [2, 3, 3, …]`, the marks for each Section II question; maths papers
  keep `group`/`sect2` and get an even run of 15s. An authored bank question may
  fill a short question exactly rather than always leaving room for a two-mark
  part.

`physcheck.mjs` re-derives every numeric answer with constants and formulas
written out again in the test, and **steps projectiles through the air** rather
than using the range formula. 2400 questions, 4800 checks. It caught a real
physics bug: a diffraction-grating question could ask for an order where
sin θ = mλ/d exceeds 1, which does not exist — the generator now picks the order
from `floor(d/λ)`.

### 8.37 Chemistry (Year 12)

Fifteen topics in the four HSC modules of the 2017 syllabus, in hsc2.js beside
Physics, with `MODULES_CH12`, `BUILD.chem12` and a `LONG_CH12` bank of twelve
long-response questions. Its mock paper matches Physics: 100 marks, 20
multiple-choice marks, the same Section II shape.

`chemcheck.mjs` re-derives the numbers with the chemistry written out again —
K from the concentrations, K_sp from the ion ratio (checked by feeding the
printed solubility back through K_sp = (cat·s)^cat(an·s)^an), pH from a
logarithm, weak-acid pH from √(K_a c), titres from the mole ratio, and **molar
masses by parsing the formula in the question and adding atomic masses**. The
qualitative questions are checked where the answer follows from data: a Le
Chatelier shift must follow from the sign of ΔH or from counting gas molecules,
and a conjugate pair must differ by one proton. 2250 questions, 4500 checks.

Two things worth remembering:

- **`<` in a note is HTML.** "Q < K means too few products" was being swallowed
  by the browser's tag parser. Question and note text goes through `innerHTML`,
  so comparisons must be written `&lt;` and `&gt;`; options are `textContent`
  and need no escaping. `typocheck.mjs` catches this because the stripped text
  comes out mangled.
- **Section II now spreads across modules.** The short generated parts are drawn
  from whichever module has the fewest marks so far, and the draw tries the whole
  module rather than one topic. Organic chemistry exposed the need: it is mostly
  conceptual multiple choice, so before this it could get as little as 6 of the
  80 marks. Two more authored organic questions and the spread fix bring it to
  about 16, and every paper now covers all four modules.

### 8.38 Engineering Studies and English Advanced

**Engineering** (`hsc3.js`, `MODULES_EN12`, 17 topics) follows the 2011
syllabus: the four HSC modules plus a fifth group for drawing and the
profession, which the syllabus threads through all of them. `EN_G = 10` is
declared at the top of the file and `engcheck.mjs` has a test of its own that
re-derives a slope question with g = 10 and fails if 9.8 was used anywhere.
The beam questions are checked by equilibrium — reactions must sum to the load
*and* balance moments about the far support — rather than by repeating the
formula. 2550 questions, 5101 checks. Its paper is
`shape:[11, 11, 12, 11, 12, 11, 12]`, which is the seven longer questions the
specifications describe.

**English Advanced** (`hsc4.js`, `MODULES_EN_ADV`, 7 topics) deliberately has
**no mock paper** — there is no honest way to mark an essay here. It is
multiple choice throughout, which is what can be marked truthfully.

Two things are load-bearing:

- **Copyright.** Harwood and Ondaatje are in copyright, so nothing of theirs is
  quoted: `EN_HARWOOD` and `EN_WAR` ask about form, structure, concerns and
  context. `engadvcheck.mjs` enforces this — it pulls every quoted span out of
  those questions and fails if any runs past six words, so a future edit cannot
  quietly paste a stanza in. The unseen extracts in `EN_UNSEEN` are all out of
  copyright (Owen, Dickinson, Lawson, Rossetti, Arnold, Mansfield), which is why
  they can be printed in full, and the test checks every extract comes from that
  list and carries its attribution.
- **Option length was giving the answer away.** The correct option was the
  longest one 89% of the time, so the drill could be beaten without reading.
  `enOptions()` now builds each question's distractors from two of its own wrong
  options plus a correct answer borrowed from a *different* item in the same
  bank — same length and register, plainly wrong for the question asked — and
  the deliberately weak theses and sentences were rewritten to be wordy rather
  than short. That took it to 49%, and the test fails above 80%.

### 8.39 The timetable: what was actually wrong

Reported as "the timetable has stopped working". It was not the revision work
and it was not the school API. What was checked, in order:

- **The page.** `index.html` loads only `theme.js` and `tour.js`; neither was
  touched. `api/timetable.js` has not been modified since 31 August.
- **The school API.** Still healthy and unchanged. `POST /api/token` with
  `{emailAddress, password}` returns a JSON 401 for a bad login, and all four
  data paths (`/api/timetable/{email}`, `/api/timetable/bell-times`,
  `/api/timetable/settings/start-date`, `/api/user/{email}`) still answer JSON
  401 unauthenticated. A first probe that looked like a 404 was a GET on a
  POST-only route with the wrong field name — `emailAddress`, not `email`.
- **The deployment.** `timetable-iota-ten.vercel.app` is live and current: it
  serves the new revision files and `/api/timetable` returns a full payload (50
  entries, 130 bell times, profile). **`timetable-ivory-nine.vercel.app` is
  dead** — its root is a 3 KB stub and every other path, including
  `/api/timetable`, 404s. A bookmark or installed PWA pointing there would look
  exactly like "the timetable stopped working".

**The real bug: the A/B week drifts.** The school API still reports
`startDate: "2025-02-03"` — the start of the *2025* school year. `cycleDayFor`
counts every weekday from there, school holidays included, so the computed week
slides by roughly a week per two terms of holidays. It is not cosmetic: the
computed cycle day drives the NOW/NEXT panel and the "today" column, so a wrong
week means the whole page shows the wrong classes.

Fixed with a correction the student can set rather than by guessing at the
school's intent: **Settings → Cycle week → "Today is [Week A] [Week B]"**. It
stores `tt.cycleshift` (0 or 5 — half a cycle), which `cycleDayFor` adds before
the modulo, so it flips A↔B while keeping the weekday. It rides the `tt.*` sync,
calibrates against Monday when set at a weekend, and disables itself with an
explanation when the school sends no start date at all.

**Still open — a privacy hole.** `GET /api/timetable` with no credentials
returns the owner's full timetable, including teachers' email addresses and room
numbers. Passing a made-up `X-School-Email` and a wrong password returns the
same data: the route falls back to the server's own school login rather than
refusing. Not changed here, because tightening an auth path could lock the owner
out and that is the user's call. The fix is to require a signed-in site session
(the `whoami` check `prefs.js` and the others already use) or to set
`ALLOWED_EMAILS`.

### 8.40 Offline support

`sw.js`, registered from the end of theme.js (so every page gets it) on https
or a local host. Written to be hard to wedge, because a bad service worker can
break a site permanently:

- **Pages are network-first.** A deploy always wins; the cache answers only when
  the network does not. A stale shell can never stick.
- **Static files are stale-while-revalidate**, so a second visit is instant and
  never more than one visit behind.
- **Nothing under `/api` is touched**, and neither are writes or other origins.
  Timetables, marks and settings are personal and some are per-account; they
  stay in localStorage, which the pages already manage.
- The cache name carries `CACHE_VERSION`; `activate` deletes every other cache.
- **`/sw-off` is the escape hatch** — it unregisters the worker, deletes every
  cache and says so. Worth remembering if a release ever misbehaves.

The Year 12 question banks are deliberately *not* pre-cached: they are picked up
on first use, so a first visit is not held up by 400 KB of generators.

`swcheck.mjs` (17 checks) runs the real sw.js in a fake worker global with a
stub cache and network: that nothing under /api is ever handled or written,
that POSTs and other origins pass through, that a page comes from the network
when there is one and from the cache when there is not, that an unvisited page
offline answers 503 rather than hanging, that static files serve from cache and
refresh behind you, that /sw-off empties everything, and that activate removes
old versions. The browser pane refuses to register workers, so this suite is
how the routing is verified.


### 8.41 The 16 October outage, and the check that now guards against it

The timetable page went blank in production — header drawn, no grid, no
sign-in screen. Two bugs, both invisible to a syntax check:

- **Introduced in 8.39:** `cycleShift = …` was written on an earlier line than
  `let cycleShift`. A `let` cannot be touched before its declaration runs (the
  temporal dead zone), so the script threw at start-up and nothing after it ran.
  The saved value is now read on the declaration line itself.
- **Latent since the Friday message was added:** `render()` called
  `weekendCard()` on Friday afternoons, but the function was never written, so
  every Friday after the last lesson the render stopped before drawing the grid.
  The older GitHub Pages copy has the same call. It now shows "Enjoy the
  weekend" and what Monday opens with, built on `nowCard`'s existing weekend
  mode.

Hotfix `bd7224b` (index.html only) was pushed to main and was live about 30
seconds later; a fresh visitor gets the sign-in screen and the console is clean.

**How this folder deploys:** it *is* a git repo (`origin` is
AlexBurns2/timetable), and Vercel deploys main on every push — commits are made
from GitHub Desktop. Anything committed here goes to production.

**`pagecheck.mjs`** runs over every page's inline script and fails on exactly
these two classes of mistake: a column-0 assignment to a name declared later
with let/const, and a call to a function defined nowhere the page can see (its
own scripts plus the shared ones it loads). Strings, comments and regex literals
are stripped first, so `/\bm(a|x)/` is not mistaken for a call. Run against the
broken commit it reports precisely `cycleShift` and `weekendCard()`; against the
current pages it is clean. **Run it before committing any page.**

The service worker shipped in the same 20:03 push. It fetches pages
network-first, so nobody online is served a cached copy of the broken page.

### 8.42 Study tools: dates, countdown, daily plan, focus mode, and the leftovers

**`study.js`** (loaded straight after theme.js on home, revision, games and
calendar — it only defines things) holds:

- `HSC_DATES` — **published dates only**: `year`, `start` (null until NESA
  publishes the 2027 written timetable), `milestones` (currently 3 Nov 2026,
  entries open) and `exams` (same shape the calendar used). `Study.countdown()`
  reports days to `start` once set, otherwise the next real milestone.
- `Study.plan(n)` — ranks every Year 12 topic: due-and-last-wrong (3), due (2),
  never started (1), done today or resting (0); one per subject first, then up to
  two; ties broken by a hash of the date so the list is stable for the day.
  `Study.practise(item)` sets `tt.rev_<sk>_mod`/`_excl` to that one topic and
  calls `openGame`.
- `Focus` — `tt.focus = {until}` (syncs). `showGrid()` on the games page renders
  `Focus.lockCard()` instead of the shelves, and `openGame()` refuses non-revision
  games while active, so there is no back door. Ending early is a three-second
  hold (`Focus.holdButton`), keyboard-operable.

**Cross-script reads go through `grab(() => NAME)`.** The module lists, `RV` and
`dayOf` are top-level consts in other files: not on `window`, and reading one
before its declaration has run throws *even under `typeof`*. The browser happens
to load the files in a safe order, but the test harness (one concatenated
script) did hit the dead zone — so every such read is wrapped in try and
degrades to "leave that subject out".

**Topic-level history.** Generated questions used to record nothing. `finish()`
in revGame now records `<topicId>:~topic` through the ordinary `recordAnswer`,
so topics get the same rest-and-return scheduling as saved questions.
`topicProgress` skips these entries (they are not questions, so reset counts are
unchanged); `resetTopic` still removes them.

**Leftovers done:**
- Tetris shows **Best** (all-time) instead of **Best (wk)** when weekly boards are
  off; `s.tetris.allBest` is kept alongside the weekly best and seeded from an
  older record's best.
- **Longest-option giveaway** in the Year 11 banks: six topics were at 43–55%
  (chance is ~25%). Parallel resistors offered whole-number distractors against
  a decimal answer — the distractors are now the real mistakes (series sum,
  forgetting to invert, doubling), mostly decimal too. 29 bank items had their
  wrong options rewritten **in place**, so index keys and saved progress are
  untouched. Worst topic is now 40%; overall 15%.
- **Accessibility**: an audit found every button and input named, but no live
  regions anywhere. `say()` writes into one persistent visually-hidden
  `role=status aria-live=polite` element, so screen readers hear each new
  question with its options and each result with its explanation. (A live region
  on the rebuilt question box would not work: one that arrives already full is
  not announced.)

`plancheck.mjs` (18 checks) covers the ranking rules, determinism, practise()
targeting, the countdown's published-dates-only rule and focus expiry. All
seventeen suites pass.

### 8.43 Student finder, and teachers out of class lists

**`?find=` on /api/timetable** (no new function — the project is at 11 of 12).
Requires the caller's own school login in the X-School headers and checks it
with `getToken`; without one it is 401. Two-letter minimum, at most 20 results,
`Cache-Control: private, no-store`, optional `year=7..12` applied before the cap.
The directory is `/api/group/student` read with the server's login
(`fetchAsOwner`), filtered by `isStudentRecord` and cached an hour per warm
instance. `searchStudents` needs every typed word to start a first name, a last
name or the email user name; results are `{name, email, year}` only. The page is
`finder.html`, linked from a home tile.

**Why the gate:** the directory is 771 students, Years 7–12 — mostly minors. The
finder is deliberately only for people who can sign in to the school's system,
and only ever hands back matches.

**Still open, worth deciding:** the older `?group=student` (used by Guess Who)
returns that whole list — names, school emails and years — to *anyone* who
requests it, with no sign-in and `Cache-Control: public`. Gating it the same way
as `?find=` would not break Guess Who for signed-in users.

**Class lists.** The school API marks people with `groups`: students carry
`student` and `yrNN`; the teacher carries `teacher`/`staff`/`executive` and a
`@det.nsw.edu.au` address. `rosterPeople` in index.html looked for a `Role` or
`Type` field that this API never sends, so the teacher was listed as a student.
It now checks `groups` and the staff domain (keeping Role/Type for any older
shape), drops staff from the list, and reads the year from `yrNN`. Guess Who's
`isStaff` checks `groups` too.

`findercheck.mjs` (19 checks) runs the real timetable.js against a fake school
API — refusals, a staff member named Sam who must never appear, the result
shape, the year filter, the cap, the cache — and lifts the real `rosterPeople`
out of index.html to check the teacher is dropped. Run against the previous
index.html, that same check lists the teacher.


### 8.44 Free periods, and no year in class lists

**`?free=<user>,<user>,…` on /api/timetable** (again no new function; still 11
of 12). It has the same gate as `?find=`: the caller's own school login, checked
with `getToken`, or 401. It takes at most `FREE_MAX` = 25 people per call and
sends `Cache-Control: private, no-store`. Each name goes through
`normaliseEmail`, so it is forced onto the student domain: path tricks are
dropped and a staff (`@det`) address is never fetched as staff. For each
person it reads `/api/timetable/{email}` with the caller's token, five at a
time (`eachLimited`). It returns only `busyKeys`: sorted `"mona|3"` strings,
with no subject, room, class code or teacher. A person who can't be read
comes back `null`. One person's error doesn't fail the call. Answers are kept
6 h per warm instance in `busyCache` (cleared at 3000 entries).

**`free.html`** has its own home tile.
- Your own timetable comes from `tt.cache` if it is yours and under 6 h old,
  otherwise from `TT.apiGet({})`.
- Lesson slots come from the bell table. Only `Type` `T` rows count, so P0, P7,
  assembly and the Tue/Thu P6 sport afternoon (`O`), and recess and lunch
  (`R`), are never "free periods". It falls back to periods 1–6 when the table
  has no types.
- Candidates are the students in your classes' rosters (`?class=`, staff
  dropped by groups or domain, yourself dropped), plus anyone added through
  `?find=`.
- Busy sets are fetched in batches of 25, two batches at a time, with a
  progress bar, and rendered as they arrive.
- An empty busy list means "no timetable" (someone who has left). It is shown
  as unknown, never as always free.
- The A/B week uses the same weekday count and `tt.cycleshift` as
  `cycleDayFor`.
- "Next time you're all free" looks six weeks ahead, so a once-a-fortnight slot
  still shows three dates.

**Storage.**
- `tt.freepick` (picked usernames), `tt.freeextra` (people added from search)
  and `tt.freeme` ("Include me") are normal settings and sync.
- Other people's busy periods and the rosters are cached under `msc.free`.
  Deliberately not a `tt.*` key, so theme.js never uploads them. The entry is
  tagged with the signed-in username and discarded if that changes.
- Busy sets are kept 24 h, unreadable people 1 h, rosters 24 h.

**Class lists.** The `<em>Year NN</em>` beside each name is gone, and so is
reading the year from `yrNN` in `rosterPeople`. Staff filtering is unchanged.

**Tests.**
- `freecheck.mjs` (18) runs the real timetable.js against a fake school API. It
  covers the refusals, path tricks, the 25 cap, duplicates folded, "P2" and
  "Period 3" normalised, unknown people as `null`, no field leaking, staff
  addresses, the cache, and at most 5 reads in flight.
- `freelogic.mjs` (30) lifts the page's logic block. It covers slots from a
  realistic typed bell table, roster filtering, group cells, the
  next-occurrence dates, and that `cycleDay` agrees with index.html's
  `cycleDayFor` on every date for two years at both shift settings.
- `findercheck` now asserts the year label is gone.
- The mock server serves the real flat bell-table shape with types, a timetable
  with gaps, a different roster per class, and a fake `?free=`.

### 8.45 Year filter, name search, and finder links

**Search** (`api/timetable.js`, shared by the finder and free periods):
- `queryWords` folds case and accents (NFD, combining marks stripped), turns
  commas and semicolons into spaces, and reduces a pasted email to its user
  name.
- `nameParts` adds the hyphen and apostrophe pieces of each name, plus a
  letters-only squash of first and last. `wordHits` tries each typed word raw
  and squashed.
- Ranking now also scores "last first" as a whole-name match.
- `closeStudents` is the fallback when nothing matches every word: people who
  match all but one word, needing two words or more.
- `?find=` returns `close: true` when it falls back. The finder page says "No
  exact match … The closest:".

**free.html.**
- **Year filter:** pills (All, 7–12), saved as `tt.freeyear`. `inYear`/`pool()`
  narrow the grid counts, the detail panel and the people list. `?find=` gets
  `year=`. Picked people are never filtered.
- **Years:** rosters now carry `year` (`yearOfGroups`), so the `msc.free` cache
  went to `v: 2` and older caches are discarded. Extras store `{id, name,
  year}`.
- **People box:**
  - `nameMatches` mirrors the server's rules, using squashed tails of the full
    name.
  - Classmates and school results are one list (`candidates()`). A school
    result who is a classmate keeps the classmate row.
  - Enter adds only an unambiguous match, never a lone close guess.
  - `summary()` restores the status line after a later add; it used to stay on
    "Checking… 0 of 1".

**index.html `?user=<username>`.** This block runs right after `let email` is
declared, before the first load.
- It validates the username like `viewUser`, sets `email` and `tt.email`, drops
  `tt.cache`, then `history.replaceState`s the parameter away.
- Anything invalid is ignored: the timetable shown and the cache are untouched.

Finder result names link there.

**Tests.**
- `findercheck` is now 40 checks: names typed every way, the close-match rules
  and the year filter, plus the `?user=` block lifted out of index.html (valid,
  a full address, a path trick, absent).
- `freelogic` is now 39 checks: name matching, years, and parity with the
  server's `searchStudents` over 16 queries.
- The mock's `?find=` imports the real `searchStudents`/`closeStudents` over a
  fake directory with mixed years and awkward names.

**Known flaky test, unrelated:** `mockcheck`'s "Section I is spread over at
least four focus areas" fails about 6 runs in 20. The Maths Advanced mock paper
sometimes draws Section I from three areas; that's a mock.js selection issue.

### 8.46 School outages, and the saved timetable

**What happened (23 October).** Every request to the intranet, the API and the
home page alike, came back as a 302 to
`education.nsw.gov.au/error/outage-notice.html` ("We're currently performing
maintenance…"). fetch follows the redirect, so `readJson` got HTML and reported
"returned a web page… check SCHOOL_API_BASE". The code was fine; the school
was down.

**Server (`api/timetable.js`).**
- `isOutage(res, body)` is true when the response was *redirected* to an
  outage/maintenance URL, or the page says "outage-notice" / "performing
  maintenance". The redirect is required so an address containing
  "maintenance" can't trip it.
- `getToken`, `apiGet` and `readJson` check it and throw 503 with hint
  `school-outage` and `OUTAGE_MESSAGE` ("The school's system is down for
  maintenance. Try again later.").
- "Could not reach" now says the school may be down, not to check a setting.
- `signInFailed` is used by `?find=` and `?free=`. Only a real refusal is 401
  "not accepted"; an outage or unreachable school is reported as such, so no
  one is told their password is wrong.
- `?free=` returns 503 on an outage instead of everyone as `null`.
- Class and directory errors pass the outage message through.

**Timetable page (`index.html`).**
- `load()` attaches `status`/`hint` to the error. On failure, if `tt.cache`
  holds a copy for the person being viewed (any age), it applies that copy
  and sets `staleNote`, e.g. "Saved copy from yesterday at 1:57 pm. The
  school's system is down…". The note shows amber in the header and in
  Settings.
- A wrong password (`check-credentials`) or an unknown person (404) still
  fails as before.
- The 15-minute refresh no longer wipes the timetable on screen when the
  school drops out.
- With no saved copy (a new device), the sign-in screen shows the outage
  message. Saved sign-ins are never cleared by an outage; they only clear by
  hand.

**Tests.**
- `outagecheck.mjs` (18): redirect-to-notice, the notice as a 503, an outage
  starting with a token cached, unreachable, and nothing changing when the
  school is up (a wrong password is still a wrong password).
- The mock server has `/__outage?on=1|0`.
- `swcheck` now reads `CACHE_VERSION` from sw.js; it had `msc-v2` hard-coded
  and broke when 412fc25 moved to v3.

### 8.47 Gallery or classic layout (a setting)

412fc25 (Pugmeowla) replaced three layouts with the packed `bento.js` gallery:
the home page's even tile grid, the games page's sideways-scrolling category
shelves, and the resources page's grid of one-line cards. This entry adds a
switch between the two.

**The setting.**
- `tt.layout` is `'gallery'` (the default) or `'classic'`. It syncs like other
  settings.
- `TT.layout()` in theme.js reads it. Pages redraw on the `tt:layout` event,
  which Settings fires on a change and theme.js fires when another tab
  changes it.
- It appears as "Home, games & resources: Gallery / Classic" in the shared
  Settings dialog (settings.js, so the home page and every subpage) and in the
  timetable page's own Settings.
- `Bento.clear(box)` undoes a layout: it stops the resize watcher, removes the
  fillers, and clears placements and the wide/tall classes.

**Per page.**
- **Home:** `layTiles()` adds or removes `.bento` on `#tiles`. Classic falls
  back to the existing `.tiles` CSS.
- **Games:**
  - In classic, `showGrid()` builds the old shelves again: `CAT_ORDER`
    (Timetable, Arcade), with `.cathd`, `.gamesecrow` and `.gamerow`.
  - `dragScroll` and `scrollHint`, plus the "games-scroll" tour step and the
    shelf CSS, are restored from before 412fc25.
  - Classic cards leave out the category tag, since the shelf already names
    it.
  - `showGrid()` now stops any previous gallery before drawing.
- **Resources:**
  - In classic, the grid gets `.classic` instead of `.bento`. The overrides
    scoped to `.subjgrid.classic` restore the one-line cards.
  - The "whole library" tile becomes the old link in the intro text
    (`#reslib`).

### 8.48 Cleanup after a new-user audit (Home, Games, headers, Settings)

**How it was decided.** A role-played Year 10 newcomer audited every page
except `/andre/`. They scored clarity, readability, friendliness and
aesthetics, and the changes follow their comments. The timetable page is the
design reference: a panel header, small-caps labels, Now/Next cards.

**Home (`home.html`).**
- `.hubbar` uses the timetable's header panel and honours `[data-header=split]`.
  It holds a greeting (the first name from the cached profile), the date and
  week, Now/Next cards built from `tt.cache`, and ⚙.
  - Only your own cache is used (its email must match `tt.creds`).
  - The cycle is counted the same way as `cycleDayFor`, with `tt.cycleshift`.
- Signed out, the panel shows what the site is and a Sign in button, and the
  forum composer is disabled.
- Tiles are in three `.hubsec` groups. Each `.tiles` gets its own `Bento.layout`
  in gallery mode, or the plain grid in classic. The `data-size` format is
  unchanged.
- The beta tile moved to `.hubfoot`. The Mahjong tile moved to Games, so
  mahjong.js is no longer loaded on Home. No home tour.
- In gallery mode the 2×2 Timetable tile lists the day's classes
  (`paintDay`, `.ttday`; hidden when the tile isn't tall).
- The HSC strip shows only for `yr11`/`yr12` profiles. `.hscstrip[hidden]`
  needed its own rule, because `display:flex` beat the attribute.

**Shared header (`site.css .pagehead`).**
- Every subpage now has `.phtitle` (an `a.sitename` link plus h1) and crumbs
  with `.bi` icon and `.bl` label spans.
- Under 600px only the icons show, so the header stays on one row.
- It's a panel like `.topbar`, and `[data-header=split]` removes the panel.
- `.btn[hidden]{display:none}` fixes the owner-only Admin button, which had
  been visible to everyone.

**Games (`games.js`).**
- `SECTIONS` (title plus one-line lede) replaces `CAT_ORDER`. Both layouts
  render a `.gsec` heading per section; gallery mode uses one bento per
  section, and `bentoStop` stops them all.
- Category tags are gone, and `.newbanner` is a small pill. The Jim Button is
  a normal 1×1 card.
- `gameCard` navigates for an entry with `href` (none at present), and `?play=`
  ignores such entries. The Mahjong scoreboard link lives in the leaderboard
  strip header (`.lbsumlinks`).
- In gallery cards `.go` is absolutely positioned (hidden on phones), so it
  never takes a line from the description. Wide cards clamp to 3 lines and
  phone rows are 156px.
- Classic shelves get `shelfArrows` (‹ ›, hidden on touch, disabled at the
  ends). `dragScroll`'s wheel handler lets the page scroll once the row is at
  its end.
- The card fade-in is 0.28s with a stagger capped at 180ms. The leaderboard
  strip shows the first 4 boards. Revision draws its subjects before
  `Study.render()`.

**Settings.**
- settings.js collapses the themes like the timetable does (Plain, Classic,
  More, Custom).
- Labels are now Gallery/**Grid**, **Panel**/Separated and **Accessibility**.
  Sign in is `.btn.primary`; Sign out is the new `.btn.danger`.
- `Tour.start('settings')` was removed from both dialogs; `Tour.mark` stays.

**Contrast.** Plain's `--muted` went from #8b8b93 (about 3.4:1) to #696972
(about 5.4:1).

**Cache busting.**
- Pages link site.css, games.css, settings.css, theme.css, games.js,
  settings.js and mahjong.js with `?v=20261104`. sw.js pre-caches the same
  URLs (`ASSET_V`), and CACHE_VERSION is v5.
- Bump `ASSET_V` and the `?v=` together whenever those files change in a way
  new HTML depends on.
- Pages are network-first but static files are stale-while-revalidate, so
  without this the first visit after a deploy pairs new HTML with old CSS.

**Not changed.**
- `/andre/` and Pugmeowla's game code (hkmahjong.html only had its links
  versioned).
- The timetable grid itself.
- The timetable page's separate Settings dialog. Merging it with settings.js
  is the next consistency step; it is larger and riskier.

### 8.49 Moderator page, hidden games, Mahjong club, name suggestions

**Moderators.** `isAdmin` in `api/_supabase.js` hard-codes
alex.burns6@education.nsw.gov.au and andre.kwok2@education.nsw.gov.au, plus
an optional `OWNER_EMAIL` env var.
- `GET /api/leaderboard?settings=1` now also returns `isMod`, which pages use
  only to show the way in. Every action is still checked on the server.
- Ways in: the 🛠️ "Moderator" button on Games (`initAdmin`, now called from
  the start-up block, because reading `siteCfg` earlier throws a TDZ error),
  a Moderator tile on Home (`#tileMod`, hidden until `isMod`), and
  `games.html?play=admin`.

**The moderator page (`BUILD.admin`).** New tabs:
- **Overview**: `GET /api/leaderboard?stats=1`, moderators only. These are
  read-only counts of users, forum, decks, calendar, players per board,
  Tetris, Daily Guess Who, saved games by mode, Mahjong club, Jim presses,
  revision and birthdays. A missing table reads as 0 or null.
- **Forum** and **Shared decks**: list everything with Delete, using the
  existing delete routes (moderators already had permission).
- **Site settings**: one Shown/Hidden switch per game, stored as
  `site_setting.hidden_games` (a comma list).
  - `_settings.js` defaults to `["jim"]`, so the Jim Button stays hidden until
    it's switched on.
  - `games.js` `gameHidden()` checks this and the `hidden:true` flag. `?play=`
    waits for the settings, so a hidden game can't be opened by link.
- The existing tabs (users, renames, weekly boards, every board) are
  unchanged.

**Mahjong club.** The tile is in Home → More, and the page is titled "Mahjong
club". The link was removed from the Games leaderboards.

**Layout default.** `TT.layout()` now defaults to `classic` (Grid).

**Timetable name box (index.html).**
- `<datalist id="whoamilist">` is filled from `?find=` as you type (2+ letters,
  250ms debounce, signed-in only). Picking a suggestion blurs the box, which
  runs `viewUser`.
- `#whoback` (‹) shows while the timetable on screen isn't yours, and takes
  you back to your own.

**Tests.** `modcheck.mjs` (21 checks, in the scratchpad) runs
leaderboard.js against a fake database. It covers who is a moderator, the
stats being moderator-only and read-only, and hiding games.

### 8.50 Forum reactions, Mahjong club moderation, animated mode, moderator button

**Forum reactions (`api/forum.js`, `home.html`).**
- New table `forum_reaction (post_id, email, emoji, created_at, primary key
  (post_id, email, emoji))`; the SQL is in the file's header comment. Until it
  exists, the forum works without reactions.
- `POST {action:'react', id, emoji}` toggles a reaction. It accepts exactly one
  emoji grapheme (checked with `\p{Extended_Pictographic}` and
  `Intl.Segmenter`), at most 6 different emoji per person per post.
- `GET` returns `reactions: [{emoji, count, mine}]` per post and reply, most
  used first, never emails.
- Deleting a thread removes its reactions and its replies' reactions.
- In the page: chips toggle, ♡ is a one-tap heart, and + opens a palette with
  "Other…" (any emoji). Changes show optimistically and roll back if the save
  fails.

**Mahjong club moderation (`api/gamestate.js` plus a moderator tab).**
- New moderator-only actions: `renamePlayer`, `removePlayer` (takes only that
  player's points; a game left empty goes) and `deleteRound` by its `t` (any
  game, not just the last).
- Add, record and undo stay open to everyone.

**Moderator button.**
- The Home tile is gone. settings.js adds a small 🛠️ before ⚙ on every page
  with the shared Settings when `isMod`; Games keeps `#admin`.
- The page layout is otherwise the same for moderators.
- "← All games" removes `?play=` from the address.

**Animated mode (index.html, off by default).**
- `tt.anim` is set in Settings → Display → Animations, on both dialogs.
- `turnWeek` is ported from andre/index.html, with the same MAZE timings,
  waves, lanes and `composite:'add'`. A week change clones the old `.lesson`
  cards into `.ttghost`, which slide off; the new ones slide on, middle days
  first. A lesson with the same `data-sig` in the same spot stays put.
- `laneShifts` also keeps a day's cards in order when one is pushed off the
  bottom of the page (the beta can overlap there).
- `growFrom` grows the detail sheet out of the pressed card.
- It is skipped on phones, with reduced motion, or when off.
- Checked by freezing every 25ms: no visible overlap in Compact or Full, in
  either direction.

**Tests (scratchpad):** `reactcheck.mjs` (25 checks: reactions and Mahjong
moderation against a fake database), `modcheck.mjs` (21) and `pagecheck.mjs`.

### 8.51 Daily Guess Who hints v3, results spotlight, archive calendar, name suggestions, card summaries, leaderboards sheet

**Hints by date (`api/_daily.js`).** Hints are still recomputed from the stored
`daily_puzzle.target` on every read, so the set is chosen by the puzzle's date:
- up to `LEGACY_UNTIL` (2026-09-12): `legacyHints`;
- up to `V2_UNTIL` (2026-11-09): `v2Hints`, a frozen copy of the previous
  engine. Don't edit it: past days must keep the hints people played with
  (checked by `hintcheck.mjs` against 3,000 old puzzles from git `HEAD`);
- from 2026-11-10: `v3Hints`.

**v3 engine.**
- A pool of candidate hints, each with a tier (1 vague … 4 near giveaway), a
  "fun" weight, `tags` (the facts it reveals) and a `kind`.
- Eight slots with tiers `[1,1,1,2,2,3,3,4]` and a weighted pick by fun².
  Only the gentle slots swap (p = 0.3, one place, no cascades); `fits()`
  keeps tier 3 (first letters, "share four classes") at hints 6–7 and tier 4
  (masks, initials) at hint 8, so a strong hint is never followed by a weaker
  one. "Their name reads …" is always 9th.
- A hint whose tags are all already known is skipped; `IMPLIES` covers the
  name masks. `fresh` lists facts that must still be unknown (initials only
  while neither letter is out; "both A and B" only while neither is named).
  `who:` tags stop the same classmate or teacher appearing twice. Soft caps
  per kind (`teacher:1, subject:3, trivia:2, ending:1`; every course hint is
  `subject`).
- A "sparse" round (fewer than 4 timetable hints: no verified timetable, or a
  junior who takes only the common subjects) relaxes a cap before giving more
  away, gets two extra gentle hints (surname length, "first name is shorter
  than their surname"), and may give a first letter at hint 5. Every round is
  9 hints.
- Removed as frustrating: vowel counts, "starts with a consonant", surname
  length (except sparse rounds), "no double letter", subject counts.
- Names: letters are counted with accents (`\p{L}`), "starts with" uses the
  plain letter (Élise → E). `maskV3` keeps hyphens, apostrophes and spaces,
  never shows a whole name, and the final reveal always shows more than the
  earlier mask; an em space separates first name and surname.
- Years 7–8 also treat music, visual arts, technology and languages as
  common subjects (`STAGE4_CORE`). Extension subjects are tier 2.
- Social hints: "They share four classes with X", "They're in Physics with X",
  "They have two classes with Mr Y", "One of their teachers is Mr Y". Course
  hints: sciences, no maths, extensions (Years 11–12 only), "They take X".
  Name hints come later. Timetable hints need `verified`, as before.
- New puzzles store `email`, `classes` (≤ 12) and `classmates` (top 60
  students by shared classes) in `target`. Classmates come from up to 10
  class rosters (real subjects first), count real subjects only, and are
  limited to the same year (a combined class can hold other years).
- The server's `tidyTeacher` now matches index.html's, so hints name teachers
  as the timetable shows them. The directory's own FirstName / LastName are
  used for the split when they make up the full name exactly.
- An independent audit (scratchpad `audit/`) checked every hint type for how
  knowable and how fun it is, plus ordering; its fixes are all in.
  `withV3Details` adds those fields once to a v3-era row made by older code
  (additive update of `target` only; nothing else in the row changes).

**Results and archive (`api/daily.js`, `games.js`).**
- `?summary=1` also returns `spotlight` (best guesser, first solver, stumped,
  longest recent streak, most improved: display names only) and `mine`
  (`{done, won, guesses}`, for the games-page card).
- `?archive=1` returns `{epoch, today, archive, mine}`; the page draws one
  month calendar (✓ won, ✗ lost, small player count), loaded once. This
  replaces the two lists that used to race each other.
- The results panel shows one spotlight line at a time (rotating every 4.5 s),
  "N played · X% solved" and the guess histogram.
- Buttons are plain words: Archive, Results, Unlimited →.

**Name suggestions (`suggest.js`).** `Suggest.attach(input, {source, onPick,
min, max, delay})`: its own list (bold match, optional second line), keyboard
and ARIA combobox. It sets `type=search`, `autocomplete=off`, a random `name`
and `data-lpignore` / `data-1p-ignore` / `data-bwignore` /
`data-form-type=other`, so browsers and password managers don't offer the
saved school login. Used by the timetable name box (`?find=` search), Daily
Guess Who and Guess Who. The finder and free-periods search boxes carry the
same ignore attributes.

**Games page.**
- Cards have no description. Under the name: the top two on that game's
  all-time board (Tetris: Sprint), today's Daily Guess Who ("N played today ·
  X% solved", then your result or one spotlight line), or your own best from
  this device. `fillSums` fills them after drawing; `localSum` is the instant
  fallback.
- The leaderboards strip is gone. A "Leaderboards" button on the first section
  heading opens `openLBSheet()`: a sheet that slides up from the bottom (✕,
  Escape, tap outside, or drag the top edge down to close; Tab stays inside).
  `lbBoard(box, focus)` draws the boards and is shared with
  `?play=leaderboards&embed=1`. A plain `?play=leaderboards` opens the sheet
  over the games.
- `head()` leaves out the "how" line when it is empty; each game's line is one
  short sentence.
- `#lbsum` stays in games.html and revision.html (hidden by CSS) only so a
  browser still running a cached older games.js doesn't throw.

**Site-wide.** No emojis in buttons or headings; emoji as icons (game and tile
icons, the streak flame, spotlight markers) are fine. Home tiles have no
descriptions (the span is kept for the focus-lock text) and are shorter; the
free periods, finder, resources and Settings descriptions are cut to a line.

**Tests (scratchpad):** `hintcheck.mjs` (12 checks plus sample rounds),
`pagecheck.mjs`, `modcheck.mjs` (21), `reactcheck.mjs` (25). The mock server
`mock.mjs` (port 8793) runs the real hint engine.

### 8.52 The weekly anonymous poll, Home and Games cleanup, revision spacing

**The poll (`api/_poll.js` via `/api/forum`, `poll.js`, `poll.css`).**
- Served through the forum route (`?poll=1|history|admin`, POST actions
  `pollvote`, `pollsuggest`, `pollset`, `polldel`, `suggestdel`), so it costs
  no Vercel function. `/poll` is a rewrite (vercel.json) to `/api/forum?og=1`:
  a page whose link preview shows the question (never results), which then
  sends you on to `home.html?poll=1`.
- The week, Sydney time: a moderator-set question opens Monday 00:00. Once
  you've voted you see the live results. Friday 12:00 voting closes and the
  winner is announced; the final results are then shown to everyone until the
  next Monday, when it moves to "Past polls".
- Kinds: `period` (0–7), `student` (your own year only; results are per year),
  `teacher` (school directory), `class` (your own subjects, from your
  timetable), `custom` (2–8 moderator answers). `pick` lets people choose up
  to 3; results are then the share of voters who picked each.
- Answers are always checked on the server against that list. The box on the
  page only accepts an answer from the list (Suggest), and a short list shows
  as buttons instead.
- **Anonymity is in the data model.** `poll_voter (week, email)` records that
  you voted and nothing else. `poll_tally (week, scope, choice, votes)` holds
  counts with no names or times, bumped by one `poll_bump()` call per vote
  (every pick plus a hidden `__n` voter count). Nothing links a voter to an
  answer, and the server never logs one. Results stay hidden until a scope has
  5 voters. Your own pick is kept only on your device (`poll.mine.<week>`, not
  a synced `tt.` key).
- Signed out (a friend's link): the card shows the question and a sign-in form
  (saves the same `tt.creds` as Settings), and Home shows only the poll until
  you vote or skip.
- The live "N votes" counter refreshes every 45 s (count only).
- A round button in the card's corner minimises it to one line (the question);
  clicking the card opens it again. Remembered per week (`tt.poll_min`), so a
  new question arrives open, and Friday's winner announcement opens it too.
- **The show.** Each week has an `anim`, chosen on the moderator Polls tab:
  The Drop, Explode (last week's card blows up, the new one rises out of the
  smoke), Spotlight, Countdown, Curtain, Slot machine, or Surprise me (picked
  from the week). It plays once per person (`tt.poll_seen`) when they first
  see the new question. Friday noon has one shared celebration (stage, chasing
  lights, drumroll, the winner in gold, fireworks, confetti), once per person
  (`tt.poll_revealed`).
- Shows play over the card (a stage just bigger than it); the page dims, but
  nothing else is covered or blocked. Click, Skip or Escape ends one, and
  reduced motion turns them off.
- `home.html?pollpreview=intro&anim=curtain` (or `=reveal`) replays one without
  marking it seen; the moderator tab's Preview buttons open these.
- Moderators: set a question per week (this week or later; kind, picks and
  answers lock once anyone has voted, but wording and show can still change),
  see voter counts, and use or dismiss student suggestions (3 per person a
  week).
- SQL: in the header of `api/_poll.js` and in SETUP.md. Until it's run, Home
  simply shows no poll.

**Home.** The HSC strip is gone. The poll sits under the header. The tiles are
eight small ones in a 4 × 2 grid on every screen (Notes removed; the page
still exists). The forum shows the newest thread with "Show N more", and the
composer is one line until clicked. The server now sends `mine` (yours) and
`canDelete` (yours, or a moderator's); a moderator's delete on other people's
posts shows only on hover.

**Games.** No sideways shelves: small cards (emoji, name, your own best). The
leaderboards are back at the bottom, as a card per board with its top three
that opens the sheet. `.sheet` styles now live in site.css (shared with the
poll's Past polls).

**Revision.** The study panel's margin was being overridden (it sat flush
against the subjects). It now has room, theme borders and shadow, and plan
items put the topic on its own line. The countdown and focus text is shorter.

**Assets.** `?v=` bumped to 20261109 and the service worker cache to v6, so the
new CSS loads on the first visit after deploy.

**Tests (scratchpad):** `pollcheck.mjs` (33 checks against a fake database:
one vote each, no answer in the voter row, no names in the tally, the 5-voter
minimum, per-year student polls, pick-several percentages, Friday noon
closing, history, suggestions limit, moderator locks, preview escaping).
`reactcheck.mjs` now stubs the poll imports.

### 8.53 Poll shows reworked, Monday 9:30 opening, traceability cleanup

**Timing.** Questions open **Monday 09:30** Sydney (not before school), voting
closes and the winner is announced **Friday 12:00**. `pollClock()` works in
wall-clock seconds and returns exact instants (`resultsAt`, `nextAt`, `now`;
correct across daylight-saving changes). Every open Home page sets a timer for
the next change, refreshes then (with a little jitter), and starts the moment 6
seconds after it by the server's clock, so everyone with Home open sees it at
the same time.

**What people see.** The vote count only shows once you've voted. The corner
says "Closes in …" (open) or "Opens in …" (closed). After voting there are just
"Your vote is in" and the live bars. Not voted and closed: the final results
with "Come back on Monday for the next question", and no show.

**Monday reveals (`anim`)** move the card itself, from exactly how it looked
last time (`tt.poll_view`: the question, state and top results) to the new
question:
- **drop:** falls onto the old card;
- **wreck:** swings in on a chain and knocks the old card away;
- **topple:** the old card tips over forwards;
- **explode:** jagged cracks, irregular shards, spark streaks, lumpy smoke, and
  the new card fades in with its question;
- **flip:** turns over like a sign;
- **slot:** the card spins like a reel.

A person's very first poll gets `first`, a drop that pushes the page down.

**Friday celebrations (`celebrate`)**, for people who voted:
- **spotlight:** smooth damped sweeps;
- **countdown:** a bright game-show set with a ring timer;
- **curtain:** velvet folds that draw up into swags with gold tie-backs;
- **envelope;**
- **slot:** a reel of the answers with a near miss.

Each builds up, says the reveal line (`reveal`, or one made from the question:
"The person most likely to … is…"), drumrolls, names the winner, then confetti,
and the leaderboard grows on the card.

**Rules for every show:** shows wait for the page to finish loading and to be
on screen. The rest of Home is locked while one plays (25 s safety release).
Skip, a click or Escape ends one. They're off with reduced motion. The page
behind a celebration is darkened by the stage's own shadow (`.pstage`
box-shadow), not an overlay.

**Moderator form:** "Monday reveal", "Friday celebration" and "Friday's line"
(its placeholder is the automatic line). The preview buttons pass the show,
question and line to `home.html?pollpreview=…`.

**Traceability.** `.vercelignore` keeps the `.md` docs, `index2.html`,
`backup` and `graphify-out` out of the deployment (they named the people
behind the site). Names are also out of the comments in served files (index.html,
jim.js). The GitHub repo is still public with author emails in its history:
make it private (GitHub → Settings → Change visibility); Vercel keeps
deploying from a private repo.

**Footer easter egg:** hovering "students" scrambles it into random characters.

### 8.54 Icons: Phosphor, inlined

`icons.js` holds the 24 Phosphor Icons (2.1.1, MIT) the site uses, as path
data. No icon font or CDN script loads on the live site.
- `Icon.svg(name)` returns an `<svg>`, and `<span data-icon="name">` is filled
  in on load (`Icon.fill(root)` after drawing new markup).
- Regular weight for small UI: the header's Home (house) and Timetable (table)
  buttons, now icon-only with aria-label and title on every page; Settings
  (gear); Moderator (wrench); sound (speaker-high/low/none/x); close (x); week
  and month arrows; back; the poll's minimise, Share and Copy link.
- Duotone for the eight Home tiles, a colour each. Settings → Home icons →
  "Theme colour" switches them to the accent (`tt.tileicons`, applied by
  theme.js as `html[data-tileicons]`). Focus mode swaps the Games tile to the
  duotone target.
- Emoji stay where they're fun: game icons, reactions, the crown, flame and
  trophy.
- To add an icon: copy its `<path>`s from
  `@phosphor-icons/core/assets/<weight>/<name>.svg` into `icons.js`.
- Base sizing is in theme.css (the timetable page doesn't load site.css).
- **Back.** theme.js adds a Back button (arrow-left, icon-only) at the start
  of every sub-page header (`.pagehead .crumbs`, so not Home or the
  timetable). It runs `history.back()` when the last page was this site,
  otherwise it goes to Home. A page can handle it first through
  `window.TTBack()`: games.js closes an open game. The timetable's "back to
  your timetable" button (`#whoback`) uses the same arrow.

### 8.55 Show polish (round 2)

- Explode: the cracks are now jagged rays from the centre with a few branches,
  each racing outwards.
- Wreck: the chain length is worked out from the card's position, so the
  swing always starts fully off the page, on any monitor.
- Topple: it rocks back, teeters, then falls with gravity and a small bounce
  (2.3 s).
- Flip: it lifts, winds back, spins and lands with a thud (about 2 s).
- Slot reel: 9 gibberish cards (made-up question and answers), a 3.6 s spin
  that slows right down, then a clunk.
- First poll: after landing, the question decodes letter by letter and the
  rest of the card fades in.
- Celebrations: the stage is exactly the card (not bigger). There's no
  percentage under the name. The winner gets a gold medal on the corner, and
  2nd and 3rd rise in with silver and bronze. The gold tie-backs are gone.
- Countdown: the background spin eases up and down (`rampRate` on the
  animation's playback rate); no sudden starts.
- Envelope: it starts hidden below, so it no longer appears, drops and rises
  again.
- Slot machine: the server sends `reel`, a shuffled set of up to 30 of the
  possible answers (people from the year for a student poll), on Fridays only.
  The reel slows and almost stops on the runner-up, then clicks onto the
  winner.
- Back only shows on the games and revision pages while a game or subject is
  open (`TTBackOn`). Other pages have Home.
- Game cards lift 2px on hover like the Home tiles. The entrance animation
  used to pin their transform.
- The sheet (leaderboards, past polls) always opens at `min(78vh, 700px)` and
  scrolls inside.
- Account vs device: voting, "seen", "revealed", the saved card view and the
  minimised state follow the account (server, or synced `tt.` keys). Only
  "You picked X" stays on the device, on purpose: syncing it would store your
  answer against your login.

### 8.56 Show polish (round 3), moderator page via Settings

- Topple: wobbles that start small and grow until it goes over. Flip: a quick
  spin, then a settling wobble.
- Winner medal: it now sits beside the gold name (`.pnamewrap`), not inside
  its background-clipped text, where it was invisible.
- Countdown: one long, smooth build to full speed, then it eases to a slow,
  steady turn as the winner appears.
- Envelope: rises; the seal lifts; the flap opens slowly to upright, then
  falls behind the card; the card (face down, a star) slides out; then the
  name. Layers, back to front: inside, card, pocket, flap.
- Moderator page: it's now a "Moderator" button in Settings (shared Settings
  and the timetable's), only for moderators. The header wrench buttons are
  gone, so the pages look exactly as everyone else sees them.
  `games.html?play=admin` still works.
- Poll load errors (tables missing, server hiccup) hide the card instead of
  showing an error on everyone's Home.

### 8.57 Exact picks, share image, Monday height easing

- `pickexact`: moderators choose "Up to two/three" or "Exactly two/three". The
  server refuses any other number, and Vote stays off until it's right. New
  column in the poll SQL; SETUP.md is regenerated from `_poll.js`.
- Share link: `images/poll-og.png` (1200 × 630, made for this) is the preview
  image, with `summary_large_image`. The question is the preview's title; the
  results are never in it. `.preview/share-preview.html` (git-ignored) mocks
  how it looks in iMessage, WhatsApp and Instagram.
- Monday reveals keep the card at the old card's height during the show, then
  ease to the new height, so the page below doesn't jump.
  `?pollpreview=intro` now ends on a fresh, unanswered question, like a real
  Monday.

### 8.58 Pre-push audit fixes
- Poll: after a Monday show, the click-to-skip listener is removed (it used to
  pin `#poll` to the old height on the next click). Skipping a Friday show also
  skips the confetti.
- Poll: if the noon/9:30 refresh fails, the card stays and retries in 15–30 s
  instead of disappearing. A draw error hides the card instead of leaving
  "from a link" visitors stuck.
- Poll: signed-out visitors after Friday noon see "Voting's closed". There's no
  Monday-style show over a final card that has too few votes, and no
  background polling once voting has closed.
- Server: "Opens in / Closes in" are right across daylight-saving changes.
  Moderator voter counts come from the `__n` tally rows (no 1,000-row cap). The
  signed-out count reads only `__n`. HEAD works on `/poll`. The suggestion limit
  counts from 9:30 Monday. Staff's missing year comes from the cached directory
  (`yearOf` in forum.js).
- Site: the signed-out forum "Sign in" button shows. "Show N more" hides
  properly. The timetable page's Home icons setting works. Icon-only buttons are
  centred again (`.btn:not(.icon) > .ph`).

### 8.59 Class polls: every subject in the year
- Class questions are now per year, like student ones (`scopeOf`). Voters pick
  from every subject taken in their year, not just their own; staff can't vote
  on them.
- No list of a year's subjects exists, so saving a class question in the
  moderator page builds one. The page calls `pollsubjects {week, year, from}`
  for Years 7–12, 24 timetables at a time, and the server merges the subjects
  into `poll.choices` as `{ years:{ "9":[…] }, done:["9"] }`. Years already
  done are skipped, and saving again finishes any that failed.
- Until a year is collected, its students pick from their own subjects. Your own
  subjects are always included either way. Re-saving keeps the collected
  lists. The moderator list shows which years are collected.

### 8.60 One tile height, no layout toggle, multiplayer Tetris and Snake
- **Layout setting removed.** The Grid / Gallery choice is gone from both
  Settings dialogs. `TT.layout()` always returns `'classic'`. The games page's
  gallery branch and the resources page's bento layout were removed;
  `bento.js` stays, but nothing uses it.
- **Tile height.** `--tile-h` is defined in theme.css:
  `clamp(96px,12vh,132px)`, or `clamp(92px,11.5vh,112px)` up to 560px wide.
  Home tiles, game cards, revision cards and resource cards all use it, so
  they're the same height on every page and grow a little on taller screens.
  Cards show the icon on top and the name at the bottom (two lines at most).
  Revision cards no longer show progress under the name.
- **Multiplayer tag.** The NEW pill is now MULTIPLAYER (`mp:true` in `GAMES`)
  on Hong Kong Mahjong, Tetris and Snake. The Jim Button lost its NEW tag.
- **Online rooms.** `rooms.js` is loaded only when someone opens Versus or
  Online. It uses the same Firebase Realtime Database as Hong Kong Mahjong's
  rooms, under `rooms/tt-<code>` and `rooms/sn-<code>`. It stores only the
  name each player types, messages delete themselves after 30 s, and a
  player's entry goes when they close the page.
  - `mpLobby()` in games.js is the shared lobby: your name, Make a room or Join
    by code, and the host starts a round. After the round, everyone returns to
    the room for a rematch.
- **Tetris Versus** (the 5th mode), for 2–4 players:
  - Everyone gets the same seeded piece order.
  - Clearing 2/3/4 lines sends 1/2/4 garbage rows, plus a bit more for combos
    and a clear board, to a random opponent who's still in. Your own clears
    cancel incoming garbage first, which shows as a red bar on the left edge.
  - Gravity speeds up every 30 s. Each placement sends your board for the mini
    views. The last one standing wins.
- **Snake Online** (Solo / Online switch), for 2–4 snakes on a 24×24 arena:
  - The host runs the game and sends the arena out every 140 ms; the others
    only send their turns.
  - Hitting any snake, or a head-on, puts you out, and your body becomes food.
    The last snake left wins.
  - Players other than the host see their own turns a moment late.
- **Testing without the real database:** `.preview/rooms-mock.js` is a stand-in
  `window.Rooms` that links two tabs locally. Load it on the page before
  opening Versus or Online.

### 8.61 Quartets, a daily four-groups-of-four puzzle
- **What it is.** Each day, everyone in a year gets the same sixteen people,
  split into four hidden groups of four, levels 1 to 4:
  1. a plain name theme (first names that are flowers, gems or months; surnames
     that are jobs, colours, animals, birds or places)
  2. a subject they take
  3. a class or a teacher they share
  4. wordplay (another name hidden in a first name, an animal hidden across the
     name, a first name that's an anagram of a word, a palindrome, matching or
     consecutive initials, initials that spell a chemical symbol)

  It's called Quartets, with its own colours. I didn't use the NYT game's name
  or look.
- **Files.**
  - `api/_conn.js` is the pure generator and its word lists (about 19 KB).
  - `api/_connroute.js` is the route, served by `api/daily.js` under `?conn=1`
    / `{conn:1}`, so there's no new function. `daily.js` now sets
    `config.maxDuration = 60`.
  - The client is `BUILD.quartets` in games.js, plus the `.qt*` styles in
    games.css.
- **How a puzzle is made** (`makeQuartets`):
  - It reads 24 sample timetables to find the common subjects. Subjects in more
    than 35% of the sample are skipped, as are English, plain Maths and
    Religion. Then it reads up to 8 class rosters.
  - It picks one category per level. Each person must fit only their own group
    among the four, checked against their own timetable. People in different
    groups can't share a first name or surname.
  - It rejects a puzzle if another name theme covers four of the sixteen, or the
    same first initial appears four times. It prefers 2 or 3 red herrings.
  - A second seed is tried if the first fails. It uses at most 120 school-API
    calls per try. If the sampled timetables look identical (the API giving one
    account's timetable for everyone), it stops.
  - A day that can't be made is stored as `groups: []`.
- **Storage.** Only display names, labels and the "how" text (e.g. "(emu)") are
  stored. Answers go to the page with the puzzle, the same as Daily Guess Who.
  Results (`found`, `log`, `mistakes`) are saved per person for the streak, the
  past days and the share grid. The server only lets mistakes and found groups
  go up.
- **Tables.** `conn_puzzle` and `conn_result`; the idempotent SQL is in
  SETUP.md under Quartets.
- **Tests.** Synthetic years (`.preview/synth.mjs`, from the side session's
  prototype) power the mock's `?conn=1`. Across 120 synthetic days, 115 made a
  puzzle, and an independent check found nobody fitting another group's
  category.
- **Also:** poll previews (`?pollpreview=…`) now play even when no poll has
  ever been set, or the poll table is missing. The mock's
  `/mock/poll?none=2` covers this.

### 8.62 Names as people go by, everywhere; Quartets on real-shaped data
- **One name source on the server.** `displayNames()` in `_names.js` merges:
  1. the moderator's override, if set
  2. otherwise the school directory's name, which already carries the name a
     student goes by (the directory says "Ari" where the email says arianna)
  3. a name made from the email only as a last resort (staff, or people who
     have left)

  Every route that shows names now loads `NAMES = await displayNames()`:
  forum, polls, daily, Quartets, calendar, subject events, decks, Tetris,
  leaderboards and birthdays. `nameOverrides()` is only the overrides now, for
  the moderator editor.
- **School data sent to pages** goes through `renamePerson` / `renameRoster` in
  `api/timetable.js`. That covers class lists (`?class=`), the directory
  (`?group=`), your own profile, and the student finder (`?find=`), which
  searches and shows by the override. Every page and game that reads these
  (Guess Who, Six Degrees, Odd One Out, timetable class lists, free periods,
  the Home greeting) therefore shows the override.
- **Search never matches an old name.** The finder (server) and free periods
  (client) only match the email username when the search looks like one
  (contains `.` or a digit, or is a pasted address). So typing an old name that
  appears only in an email finds no one.
- **Stored names are re-mapped when read.** Daily Guess Who's answer, its hints
  (worked out from the current name) and its name list (rebuilt from the
  directory) follow renames. Quartets stores emails beside names on the server
  and shows current names; a renamed person's "how" text is dropped, since it
  came from the old name. Free periods' cached class lists were bumped
  (`CACHE_V` 3).
- **Quartets is now random, with steady difficulty.**
  - Any four categories can be drawn (`pickFour`): at most two of a family
    (theme, wordplay or timetable), at most one teacher, and no two timetable
    groups about the same subject.
  - Each category has a `hardness` score. The four must total within `BAND`
    (9.25–11.5), and at least one must be easy (2.25 or under). Levels 1–4 are
    the four sorted by hardness.
  - Categories from the last 3 days are mostly skipped (85%).
  - New themes fit the real year: surnames that are everyday words, first names
    that are everyday words, and first names that could be surnames. Hidden
    names must be 4+ letters, and a name only counts as hidden at the start
    when 4+ letters are left over, so Christopher → Chris counts but Joshua →
    Josh doesn't.
- **Tested** on a real Year 11 name list with made-up timetables: 120/120 days
  made, every one correct, difficulty totals 9.25–11.5 (average 10.9). The name
  list was used in the scratchpad only, and deleted afterwards.

### 8.63 Quartets: fewer cheesy themes, nothing extra stored
- "First names that could be surnames" is gone; the user found it too cheesy.
- The per-person "why" text ("emu", "G.G.") is no longer stored. `conn_puzzle`
  keeps `{lv, id, label, kind, names, emails}`, and `howFor(id, name)` in
  `_conn.js` works the text out each time the puzzle is shown, from the name
  the person goes by then. If that name no longer fits the category, the text
  is left blank.

### 8.64 Quartets: whole-timetable groups, a Guess Who-style page, a share card
- **New groups from whole timetables** (Years 11–12 only, `PROFILES` in
  `_conn.js`):
  - Don't take any maths (2.5)
  - Don't take any science (2.5)
  - Take three sciences (3)
  - Take two or more extension subjects (3)
  - Take a language (2.25)

  Members come from every timetable read (the sample is now 36) and from the
  science, extension and language class lists, which are now always read for
  seniors. How common each one is comes from the timetables read, and it must
  be at most 45%.

  A whole-timetable group is never paired with one about the same thing (for
  example, "three sciences" with "Take Physics"). There are at most three
  non-name groups, and the fetch cap is now 150.

  Rare subjects such as Maths Extension 2 become plain subject groups once
  their class list is read.
- **Puzzles are kept** (like Daily Guess Who's) so past days can be played.
  There's no older-version handling: a puzzle is shown as it was made.
- **The page now matches Daily Guess Who:**
  - The streak, an **Archive** month calendar (✓/✗, played counts, any day
    playable) and a **Results** button. Results opens when you finish and
    closes again to show your board.
  - Results shows a spotlight line (first to solve with no mistakes, or first
    to solve), played and solved %, a bar per mistakes count (0–3 and missed)
    with names on hover, and the % who found each group.
  - Group labels appear in Results only once you've finished.
  - New route reads: `?conn=1&archive=1` and `?conn=1&summary=1&date=`.
- **Share card:** a drawn image (title, year and date, verdict, the colour grid
  of your guesses; no names or answers). **Share** sends the image where the
  device can, or copies it, or falls back to text. **Copy as text** gives the
  emoji grid and a link.

### 8.65 Quartets: generator versions, 6 chances, more groups
- **Versions.** `QUARTETS_VERSION` (currently 4) in `_conn.js`. Puzzles and
  results are stored under `year` = `"11#v4"`. On a year's first request per
  warm instance, `dropOldVersions` deletes that year's puzzles and results
  from any other version, including the unversioned ones made by the first
  generator, and each day is made again on demand. Bump the version whenever
  categories or rules change. This was the user's explicit request: games from
  older generators are not kept.
- **6 chances** (`MAX_MISTAKES` = 6). Results bars run 0–5 plus missed.
  The description is now "Find the four similar groups of four from your year."
- **Teachers** are named from the staff directory ("Ms Kubo"), with any
  override, never an email address (`staffNames`, `tidyTeacher`).
- **Not subjects:** band, choir, ensembles, clubs, co-curricular, and anything
  named after a weekday ("Friday Band").
- **New groups:**
  - A body part hidden in their name (Victoria Pearson: ear)
  - First name ends with the letter their surname starts with
  - Initials spell a word (O.H., A.S.)
  - Take an arts subject
  - Take a technology subject
- **The name.** Still "Quartets": I won't name it after the NYT game. It's
  just the title in the `GAMES` entry and `head()` in games.js.

### 8.66 An email address is never shown as a name
- `stripEmails(text)` in `_names.js` turns any address into a name: everything
  from the @ on goes, and the rest is tidied ("kiyoka.kubo@det.nsw.edu.au" →
  "Kiyoka Kubo").
- `withName()` now runs every name it returns through it, so every route that
  shows a name has the guard.
- Quartets labels and Daily Guess Who hints are also run through it when
  they're sent.
- The pages already tidied teacher emails (index.html `tidyTeacher`, games.js
  `tidyName`). The email in the user's screenshot came from the first Quartets
  generator, whose puzzles version 4 deletes.

### 8.67 Reaction: autoclickers can't score
- Anything under 100 ms doesn't count: the page refuses it ("faster than anyone
  can react"), and `api/leaderboard.js` refuses a `react:fastest` score under
  `MIN_REACTION_MS`.
- Rapid clicking (4 presses inside 400 ms), or 6 presses at a machine-steady
  rhythm (gaps within 4 ms of each other), stops the round, wipes the run of
  five and locks the box for 3 s.
- Scripted clicks (`!e.isTrusted`) are ignored.
- Existing leaderboard scores under 100 ms aren't removed automatically; the
  moderator page can delete them.

### 8.68 Quartets hints
- 3 wrong guesses in a row highlight two people from the easiest group still
  unsolved; a 4th in a row highlights a third from that group. That's all:
  two hints per puzzle at most, and if the hinted group is solved first, the
  second hint is used up.
- `hintNames()` works the hints out from the saved guess log, so nothing new is
  stored and they survive a reload. The people are picked by the date, so
  everyone gets the same hint.
- Highlighted tiles are `.qttile.hint` (gold outline), and a message says when
  a hint unlocks.

### 8.69 Poll: results from the first vote; a loading placeholder
- `MIN_SHOW` is now 1 in `_poll.js`, so results show from the first vote. This
  was the owner's choice; the anonymity threshold of 5 is gone. The "Only N
  votes so far…" note went with it; with no votes it just says "No votes yet."
- **Loading placeholder.** While the poll loads, Home shows an empty card with
  soft shimmering bars, at the height the card had on this device last time
  (`localStorage` `msc.pollh`), so the tiles below don't jump.
  - The height is saved after each draw, after minimising, and as 0 when
    there's no card, so then nothing is held open.
  - `/mock/poll?slow=3000` slows the mock to show it.

### 8.70 Poll shows never cover the widgets below
- **Measured, not guessed:** `.preview/clipcheck.js` steps every animation
  forward by hand (8 ms at a time) and reports how far anything visible of the
  poll reaches below the top of `#hubrest`. Run it on a page opened with
  `&rafshim=1`, which the mock uses to drive frames from a timer so shows run
  in a hidden pane. It follows shard triangles through their 3D transforms and
  ignores anything inside a container that clips its contents.
- **Every Monday reveal** (first, drop, wreck, topple, explode, flip, slot),
  starting from a short card and from a tall one, and **every Friday
  celebration** were measured at desktop width, and the risky ones at 375 px
  too. Nothing reaches the widgets any more; the closest is about 9 px above
  them.
- **Fixes:**
  - When the new card is taller than the old one, the widgets slide down to
    make room before the show starts. A shorter new card still closes the gap
    afterwards.
  - Wrecking ball: the widgets are pushed down ahead of the swinging card's low
    corner, jolt on impact, stay clear through the wobble, then settle. The
    knocked-off old card now flies sideways and up instead of down over the
    widgets.
  - Explode: shards spin about their own middles and burst outwards and up,
    fading before they could come down. (They used to fall more than 1,000 px
    over the page.)
  - Flip: a deeper perspective (3000 px) and a slight shrink mid-turn
    (`scale(.84)`) keep the looming near edge inside its space.

### 8.71 Quartets v5: more name groups, rescored difficulty
- `QUARTETS_VERSION` = 5, so older puzzles are deleted and made again.
- **New name groups** (checked against a real Year 11 list; most have 5+
  people, though the prime-minister one may be thin in some years):
  - First name shared with a famous singer (Taylor, Billie, Ariana, Sia, Ed…)
  - First name shared with a Harry Potter character
  - Shares a name with an Australian prime minister (first name or surname)
  - Three-letter first names
  - Two-letter surnames
  - First name starts and ends with the same letter
  - A double letter in the first name

  The "how" text names the singer, character or PM.
- **Mostly name groups:** usually 2 timetable-type groups per puzzle, 3 about
  15% of the time, and at most one "same class" or "same teacher" group.
- **Difficulty (hardness):**
  - Easy, about 1–1.5: matching initials (was 2.5), short names, double
    letters, surnames that are everyday words, and a kind of subject (arts,
    technology, language, no maths, no science).
  - Middling, 2–2.5: one subject, Harry Potter, PM.
  - Hard, 3+: wordplay, same teacher (3.5), same class (3.75).
  - The four must total 8.5–11, the easiest at most 1.75 and the hardest at
    least 3.
- **One answer:** class and teacher groups are still exclusive, so nobody in
  another group shares that class or teacher (checked against their own
  timetable). A stricter rule (no *other* class or teacher shared by four of
  the sixteen) was tried and dropped: it removed every class and teacher group.
- **Tested:** the real name list with made-up timetables made 120/120 days,
  every one correct. Timetable groups per puzzle: 2 in 104 days, 1 in 8, 3 in 8.

### 8.72 Daily Guess Who: name hints show at most two letters and never the length
- The current hint set (`v3Hints`, used from 10 Nov) no longer has:
  - "has N letters" (first name or surname)
  - "same length / shorter / longer than"
  - the "looks like E m _ _ y" patterns
  - the final "Their name reads…"
- The strongest name hints are now "starts with **Em**", via `startOf()`: the
  first two letters, or just the first letter for a name under 3 letters. Only
  one of first name and surname gets this before the last hint (kind
  `start2`, kept apart by `fresh`).
- The last hint is "Their name starts **Em… Ch…**".
- A round with no verified timetable now has about 6 hints instead of 9. Its
  padding was the letter counts, and the alternatives (double letters,
  alphabet halves) were banned earlier.
- The frozen earlier sets (`legacyHints`, `v2Hints`, for days before 10 Nov)
  are unchanged, so those past days read as they were played.
- `hintcheck.mjs` now bans lengths, masks and more than two letters
  (13/13 pass).

### 8.73 Follow-ups to 8.71 and 8.72
- **Quartets v6:**
  - The Harry Potter group is gone.
  - The prime-minister group now covers every PM's first name and its
    everyday forms: Billy, Bill and Billie for Billy Hughes; William for
    William McMahon; Ben for Ben Chifley; Chris and Christopher for Chris
    Watson; Edmund, Alfred, George, Andrew, Joseph, Stanley, James, Earle,
    Robert, Bob, Arthur, John, Frank, Harold, Gough, Malcolm, Paul, Kevin,
    Julia, Tony, Anthony and Scott. PM surnames still count too.
  - On the real Year 11 list that matches 8 people.
- **Daily Guess Who:** the letter-count hints are back. The user only wants
  hints that give several things at once removed, like the length plus three
  letters in "E m _ _ y". So "has N letters", "same length / shorter /
  longer", "starts with Em" and the final "Their name starts Em… Ch…" are all
  allowed. Rounds without a timetable have 9 hints again (8 if a name is too
  short for a two-letter hint).

### 8.74 Quartets v7: British monarchs and first names that are places
- **"Share a first name with a British king or queen"** (`MONARCH`, hardness
  2.25): Henry, William, James, Victoria, Charlie/Charles, George, Edward,
  Elizabeth, Mary, Anne… The "how" names the monarch. It matches 8 people on
  the real Year 11 list.
- **"First names that are also places"** (`FPLACE`, hardness 1.75): Georgia,
  Victoria, Jordan, Sydney, Florence, Brooklyn, Austin… The "how" says what
  the place is. It matches 4 people on that list, so it's only used in years
  with 5 or more.
- **Considered and not added:** Wiggles names, and surnames that could be first
  names (the user's call).

### 8.75 Quartets made overnight
- The nightly cron (`api/daily-generate.js`, 14:00 UTC, which is just after
  midnight in Sydney) now also makes each year's Quartets via
  `prebuildQuartets` in `_connroute.js`, after Daily Guess Who.
- It works on two years at a time, with a 45 s budget inside
  `maxDuration: 60`. Any year it doesn't reach is made by that year's first
  player, as before. The response lists each year as `ok`, `none`, `skip` or
  `later`.
- The cron needs `CRON_SECRET` set in Vercel, as it already did.

### 8.76 Faster loads: a student cache, and one request for Home
- **`student_cache`** is a copy of the school student directory: email, first
  name, surname, year. The SQL is in SETUP.md.
  - The nightly cron refreshes it first (`refreshRosterCache`). It adds and
    updates rows and never deletes.
  - `rosterList()` in `_names.js` reads it a page of 1,000 at a time, with a
    15 min in-memory cache. If the table is missing or more than 36 h old, it
    falls back to `studentDirectory()` (the school's system).
  - It's used by `displayNames()` (every route's names), the poll's year lists
    (`yearMates`), forum's `yearOf`, and Daily Guess Who's candidate list. A
    function waking up now reads one table instead of the school's whole
    directory.
- **Home's first load is one request:** `GET /api/forum?withpoll=1` returns the
  posts and the poll payload together. The poll part is worked out alongside
  the posts; if it fails, it's null and the card stays hidden.
  - home.html starts it straight away (`firstLoad`). `loadForum` takes the posts
    the first time, and `Poll.mount({ initial })` takes the poll, measuring the
    server's clock from when the shared request was sent.
  - Later refreshes are separate, as before, and so is the signed-out view.

### 8.77 Only students who have classes; Quartets icon
- **No-classes list:** `student_cache.has_classes` marks students the directory
  lists but whose timetable comes back empty (left, or an old second account,
  e.g. william.logan3). `null` means not checked yet and counts as having
  classes. Two more columns are needed; the SQL is in SETUP.md.
- **How it fills:**
  - Every night `checkSomeClasses(10 s)` checks a batch: never-checked students
    first, then anyone not checked in 14 days.
  - It also learns from Quartets generation (every timetable it reads) and from
    Daily Guess Who's pick.
  - `markClasses()` saves results; `hasClassesIn(raw)` decides (an empty array
    means no classes; an error or odd shape means unknown).
- **Left out wherever people are picked:**
  - Quartets: people are filtered, and members need a timetable with real
    subjects.
  - Daily Guess Who: the mystery person is checked; if they have no classes,
    the next in a fixed order is used, up to 6 tries. Their name list is
    filtered too.
  - The poll's student options.
  - `?group=student` (the Guess Who games) and the student finder.
  - `QUARTETS_VERSION` is now 8.
- **Icon:** Quartets uses 🍀 (2048 has 🧩).

### 8.78 Quartets: easier-to-read hints
- **Solved and missed rows:** each person is a chip (dark text on a pale
  backing, `.qtp`). The "why" (emu, Mg, Kevin Rudd) is a small dark label
  inside the chip (`.qtp em`), instead of 70%-opacity grey text in brackets.
- **Missed groups** stay at full strength, marked by a dashed edge (they used to
  be faded to 80%).
- **Hinted tiles** get a solid gold outline and a gold dot in the corner. The
  tile's own background and text are unchanged, so it reads in every theme.
  The old version was a faint gold tint behind the text.

### 8.79 Quartets: friendlier for newcomers
- 7 mistakes allowed (`MAX_MISTAKES` = 7; the page's fallback is 7 too).
  Results bars run 0–6 plus missed.
- Hints come sooner: 2 wrong guesses in a row highlight two people from the
  easiest group still unsolved, and a 3rd in a row highlights a third. It's
  still two hints at most per puzzle.

### 8.80 Quartets: a last-chance hint; results always shown
- **Last-chance hint.** With one mistake left (after the 6th), two people from
  another group still unsolved, the easiest one not already hinted, are
  outlined in blue (`.qttile.hint2`). The message says "Last chance: the two
  people outlined in blue are in the same group."
  - `hints()` works out both kinds from the guess log and returns
    `{ gold, blue, n }`.
  - The gold hints are unchanged: two people after 2 wrong in a row, a third
    after 3 in a row.
- **No Results button.** How the year went is shown under your board once
  you've finished, and isn't shown before.

### 8.81 Loading indicators everywhere
- One loader for the whole site: `TT.loader(text, late, { sm })` in theme.js writes it, styles `.ld*` at the end of theme.css. A spinner and what's loading; after 6 s a "still loading" line (or the `late` text); after 20 s "This is taking much longer than usual… wait a little, or reload". Pure CSS timing, so it keeps going while the page is busy. `.ldinline` puts a small spinner in front of a line or button (index's subtitle and Now/Next cards, Home's "more posts", the class-list button, free periods' status line).
- Used in games.js (`LD()`, hoisted; leaderboard cards, Quartets "Loading today's puzzle…", Guess Who, admin, flashcards), poll.js history, jim.js, mahjong.js, home.html forum, calendar.html. home.html and calendar.html write the same markup statically.
- `TT.api` now gives up after 70 s (AbortController; `opts.timeout` to change) with "The server took too long to answer", and a failed fetch says "Couldn't reach the server". index.html's timetable fetch does the same, so a stall falls back to the saved copy like any other failure; its subtitle turns to "Still loading. The school's system is slow right now…" after 8 s, and Now/Next say "Loading…" instead of "Nothing scheduled" while there's nothing yet.
- Preview: `/mock/lag?ms=…&match=…` delays every /api/ answer (or those whose URL contains `match`).

### 8.82 Quartets: a puzzle every day
- Why "No Quartets for this day" showed: the search gave up after 160 draws (most rejected by the difficulty band, especially with the "skip recent categories" rule) or when its 200-timetable allowance ran out, and the route then **kept the failure** (`groups: []`), so that day stayed empty for good.
- `_conn.js` now searches tier by tier (`TIERS`): the proper band; the same band ignoring recent categories; two looser bands; any four that work together; name themes only; and name themes trusting the roster when timetables can't be read (school system down, or one timetable for everyone). Each tier keeps the fairness rules (each person fits only their own group, no overlapping groups, no fifth theme in the sixteen). `deadline` (default 40 s) bounds the timetable reading; the last tier reads nothing and always runs. `made.tier` says which tier was used (logged when > 0).
- Synthetic years: 120/120 made (119 in the proper band, 0 wrong); school API down, half the timetables failing, one timetable for everyone: 20/20 each. Only a year under ~40 people can still fail.
- `_connroute.js` never keeps a failure: it answers `{ none, retry }` and the page shows "This puzzle couldn't be made just now" with Try again. A day kept empty by the old code is remade when opened (only that empty row is replaced: `update … filter groups eq []`, falling back to its key if the filter doesn't match), is listed in the archive, and the nightly job repairs up to 3 such days per year. `QUARTETS_VERSION` is unchanged, so existing puzzles and results stay.
- Preview: `/mock/connnone?on=1` makes the mock answer `none`.

### 8.83 Quartets "from 0 people", and nothing is deleted any more
- Cause: `markClasses` **upserted** `{email, has_classes}` rows into `student_cache` before the nightly job had filled it, and `rosterList()` took any fresh rows as the whole school, so every year came out empty (Quartets made from 0 people; the poll's names and the forum's year lookups were affected too).
- `rosterList()` now uses only complete rows (name and year), needs at least 50 and a recent `updated_at`; otherwise the school directory, with any `has_classes` known merged in. `markClasses()` only **updates** existing rows (never inserts), and won't save "no classes" when most of a batch came back empty. `noClassesSet()` ignores a list covering over 30% of the school. The stray email-only rows are harmless: they're ignored, and the nightly roster refresh fills in their names.
- `ensureConn` falls back to the school directory if the roster gives under 40 people in the year.
- Nothing in Quartets deletes any more (`dropOldVersions` is gone). A day that already has a puzzle, from this version of the generator or an older one, is played as it was made, and its results are read and saved under that day's own key (`pickDay`: a real puzzle, newest version first). The archive, summary and POST all use the day's key. New days are made under the current `QUARTETS_VERSION`.
- The page never shows a button: if the puzzle isn't there (or the request fails) it asks again by itself, every 2.5 s, then 5 s, and so on up to every 30 s, with the loader showing.

### 8.85 Quartets results: how hard the day was
- Results has a folded section (`<details class="qtdiff">`) under "N played · X% solved": "Today's challenge was **hard** on average", which opens to a note and each group with 4 pips and a word (Easy / Medium / Hard / Very hard).
- With 5 or more finished in the year it's from how they went: the day from solve rate + average mistakes (`(1 - solved) + avg/7`), each group from the share who found it. With fewer, from the design (so it never points at one or two people): `summaryFor` sends `rated` (1–4) per group from `hardness()` and `design` (-1 / 0 / 1) for the day against the usual band. Only these words go out: no scores, ids or kinds. Group names show only once you've finished, as before.
- Preview: `/mock/connsum?few=1` gives a 3-player summary.

### 8.84 More Quartets name groups
- Ten new name categories in `api/_conn.js` (word lists, `nameFeatures`, `HARD`); `howFor` picks up their reasons automatically. `QUARTETS_VERSION` unchanged, so they show up on days made from now on.
  - Easy: `n:long` First names with eight or more letters (1.25), `n:ie` First names ending in -ie (1.5), `n:yend` First names ending in -y (1.5; a deliberate red herring for -ie), `n:son` Surnames ending in -son (1.5).
  - Knowledge: `n:f1` Share a name with a 2026 F1 driver (2.5). `F1_FIRST`/`F1_LAST` is the 2026 grid: update it (and the label's year) each season.
  - Wordplay, found anywhere in first + surname: `n:food` A food or drink in their name (3.5), `n:monthhid` A month (Jan, Feb…) hidden in their name (3.5; not for someone actually named a month), `n:schoolhid` A school subject hidden in their name (art, geo, maths…, 3.5), `n:trig` sin, cos, tan or log in their name (3.75), `n:backwards` A name that spells a word backwards (3.75; curated `BACKWARDS` list, e.g. Leon/noel, Reed/deer).
- Then `n:country` Initials are a country code (3), from `COUNTRY_INIT`: 34 codes that look like the country's English name (AU, NZ, JP, IT, BR...; no DE or CH). The reason shown is e.g. "JP (Japan)". With it: synthetic 120/120, wrong 0, tier 0 85; real year 120/120 in tier 0, wrong 0; names-only 60/60.
- Checked: synthetic years 120/120, wrong 0, tier 0 unchanged (88); a real year's names 120/120 all in tier 0, wrong 0; names-only fallback 60/60, wrong 0.
- Tried and left out: four-letter first names (too common, so the "no fifth theme" rule pushed synthetic tier-0 days from 88 to 70); hidden Aussie slang, Aussie animals, Gen Z slang, car brands, numbers, Greek letters; Matildas, Bluey, award, Aussie suburb and brand names (too few matches, or too fuzzy to be exact).

### 8.86 Getting people to new things: Today strip, NEW tags, What's new, Credits, a faster poll
- **Today strip** (home.html `#hubtoday`, under the tiles): Daily Guess Who and Quartets, each "Play today's" or "Solved · 🔥 n" / "Done for today". No request: games.js `markDay(game, s, {done, won, streak})` keeps `tt.day_<game>` (today's only; tt. so it follows the account). Signed in only; hidden in focus mode.
- **What's new + NEW tags**: one list, `NEWS` in theme.js (newest first; add a line to announce something). An entry with `key:'game:<id>'` puts a NEW tag on that game's card (games.js `gameCard`) and on its Today chip until you open it (`openGame` → `TT.newsSeen`) or `NEWS_DAYS` (21) pass; `tt.news_seen` remembers the day you opened each. Multiplayer games keep their Multiplayer banner. The Home Games tile gets a tag only for a new game not already in the Today strip. Footer "What's new" opens a `<dialog>` with the list; a dot shows until you've opened it since the newest entry (`tt.news_read`).
- **Credits**: the footer line is now "Not run by the school or the Department." + What's new · Credits · the /andre/ link (the "students" scramble egg went with the old line). Credits opens a frosted full-screen `<dialog>`: "Made by" in the middle, the names going round it on an ellipse, opposite each other, always the same size (26 s a turn; still with reduced motion; kept on screen on phones). The names come from `GET /api/forum?credits=1` and only for a signed-in request (`whoami`); signed out, it says to sign in. They're in api/forum.js, so they are in the repository.
- **Poll speed**: `pollGet` asks for voted / total / answers / results at once (`settle`d, unused ones dropped) instead of one after another, and logs `poll slow:` over 1.5 s; forum.js logs `home load slow:` over 2.5 s. poll.js keeps this week's card as it last came from the server (`msc.pollsnap`, this device only, per account) and draws it at once on the next visit, only while nothing can have changed (same account, over a minute before the next Friday-noon / Monday-9:30 change, no Monday or Friday show due). The server's answer then replaces it; if it's the same vote card it's kept as is (typing isn't lost) and only the numbers are taken; a vote cast on the saved copy wins over the older answer. If the request fails, the saved card stays and it asks again shortly. Voting updates the saved copy.

### 8.87 Big text, Home's header shape, livelier Credits
- **Footer**: What's new and Credits on the left, the beta link on the right. "Not run by the school or the Department." now sits at the bottom of the Credits overlay (and in its accessible label).
- **Home's header** (`.hubbar > .hubin`, a CSS grid; `.hubbar` is a size container): the greeting, one class box of a fixed height (5rem), and Settings. One row when the header is ≥ 44em wide, else two rows (greeting + Settings, then the box). em, not px: bigger Text size gets the two-row layout sooner instead of squashing. The box always has the same shape: Now and Next side by side (`.hubnow.pair`), one card, "Open your timetable", or signing in (button beside the words). Under 26em (phones with big text) Now and Next become two lines in one card, with just the times. The greeting stays on one line: `fitHello()` shrinks it to a floor, then uses the short form ("Afternoon, Demo"), then cuts it; the date line switches to "Thu 12 Nov · Week B" when the long one won't fit.
- **Tiles with big text**: `--tile-h` is in rem now (the same px at 100%), so tiles grow with the text. `.hubnav` (tiles + Today) is a container: under 19em the tiles become a two-column list (icon beside the name, whole words only), under 20em Today stacks.
- **Other pages' header** (`.pagehead`, a container): under 19em the buttons go to their own row under the title; the site name is cut with "…" rather than running under the buttons. Games' compact cards shrink a long one-word name a little (`12.5cqi`) rather than cut it.
- **Credits** moved to `credits.js`: aurora blobs drifting (CSS), a canvas sky of twinkling stars drifting up, the orbit drawn as a faint moving dashed track, each name trailing a comet in its own colour (the theme accent and one 150° round the wheel) that streams out from behind it, the names spiralling out from the middle on open, "Made by" coming in letter by letter then gently glowing, a burst of sparks from both names every few seconds, a bigger burst when you tap a name, and a few sparkles following the mouse with a slight tilt. Click anywhere else, ×, or Esc closes. Reduced motion: still. Dark mode uses additive glow.

### 8.88 Names only in Credits, /beta/, the poll note, and things for those who look
- **No names in the pages.** The creators' names exist only in `api/forum.js` (`?credits=1`, signed in). Server-only references stay (admin emails, the birthday anchor). `api/timetable.js` no longer sends `Access-Control-Allow-Origin` with the old GitHub Pages address on every response; it only echoes an allowed origin. The beta integration in games.html / hkmahjong.html is now `betaLook()`, `html.beta`, and spots the beta page by its frame (`#gmframe`) or `?beta`. **One alias remains in each file: `window.andreLook`**, because the beta page (/andre/index.html, not ours to edit) calls that name. Once it calls `betaLook()` (and loads frames with `?beta=1` or no flag), delete the two alias lines.
- **/beta/** (vercel.json): a rewrite to the beta's folder, files untouched; `/beta` → `/beta/`. Home's link goes there. The old /andre/ address still works (no redirect, to avoid any rewrite/redirect loop).
- **Poll note on the timetable** (index.html `#pollnote`, under Home): "New poll this week" while there's an open poll you haven't voted on or seen on Home; × hides it for that week (`tt.pollnote_off`, synced). Asks `/api/forum?pollpeek=1` (has / open / voted only) 1.2 s after load.
- **Credits are an easter egg**: no footer link. Tap "MSC Unofficial" at the top of Home three times within ~1.3 s (`#sitemark`, styled not to look clickable, a faint tick on each tap) → `Credits.open()` (credits.js). The disclaimer is in the overlay, and still on the sign-in screen.
- **The vault**: `/vault` → vault.html (rewrite), `noindex`, linked from nowhere. Signed in: POST `/api/forum?vault=1` records your first visit (table `vault_visit`, SQL in SETUP.md) and returns everyone in order by display name: "You're the 13th person to find this." typed out, then the list. Signed out: "This door needs a key." No table yet: "The vault is sealed for now."
- **Clues, sparse on purpose**: (1) Home, about one load in eight (was thirty), 5–14 s in, "MSC Unofficial" scrambles into "/vault" and back; (2) in Credits, after 14 s, "/vault" fades in among the stars for ~3.5 s every ~28 s, away from the names; (3) the new 404.html ("Nothing here. Not everything is where you'd expect it.") has `title="/vault"` on its "· · ·"; (4) Home's console: "· · ·  not everything is on the map" (no path).
- **Greetings** (home.html `greeting()`): just "Good morning/afternoon/evening", "Welcome" (before 5am) or "Welcome back" (7+ days since the last visit, `tt.hello_last`). The playful variants were removed at the user's request (8.111).
- Cache stamps bumped to `?v=20261112`, sw.js `ASSET_V` 20261112 and `CACHE_VERSION` v7.

### 8.89 Suggest a feature
- Home's footer: What's new · **Suggest a feature** (signed in only), opening a one-line form under it like the poll's "Suggest next week's question" (shares its `.psug` styles). Also linked from the bottom of the What's new sheet ("Something missing?").
- `POST /api/forum {action:'featuresuggest', idea}` (api/_poll.js): up to 300 characters, three a week each. Stored in `poll_suggestion` with `kind = 'feature'`, so there's no new table; the weekly question-suggestion limit and the Polls tab's suggestion list leave them out.
- The moderator page has a **Feature ideas** tab (games.js `renderIdeas`): each idea, who sent it, when, and Dismiss (`suggestdel`).
- The social/groups idea was dropped.

### 8.90 A Timetable button on Home's header
- Home's header has Timetable (`#ttbtn`, the table icon, to `./`) under Settings, as the timetable page has Home under its Settings. Wide: the two stack and the class box stretches to their height, so the edges line up. Narrow (two-row layout): side by side beside the greeting.
- `fitHello()` now re-runs from a ResizeObserver on `.hubid` (after layout), not the window's resize event, so the greeting refits correctly when the space changes either way.

### 8.91 Glass background: noise, not three circles; an icon mockup
- **Glass skin** (theme.css): the three big radial gradients read as three circles on wide screens. Now `--glass-clouds` is an SVG of four fractal-noise fields (feTurbulence, one per colour: violet, cyan, pink, deep blue), each showing only its peaks in its colour, merged and softly blurred, drawn at 480×300 and stretched over the window on a fixed `body::before` (cheap to render, smooth when scaled). `--bg-img` is now a 160px grain tile on top. Light and dark have their own versions; Zen mode hides the layer. The scratchpad generator `glassbg.py [freq-scale] [strength-scale]` rewrote both values (current: 1.15, 1.9).
- **Icon mockup** (preview only, not on the site): `.preview/iconmock.js`, turned on with `/mock/iconmock?on=1`, swaps every game and subject card's emoji (and Home's Today strip) for a Phosphor duotone icon in a colour of its own, the same style as Home's tiles. Screenshots in `.preview/mockups/`. The 25 icons were downloaded (with the owner's OK) only for this; if it's adopted they go into icons.js as `d:<name>` and `ico` in GAMES becomes an icon name.

### 8.92 Glass: bigger clouds, a fresh pattern each visit, an animated option; game icons with a switch
- **Glass clouds** are made in theme.js (`glassClouds(mode, half)`) on every page open with random seeds and frequencies, so the static look differs each visit; theme.css keeps a fixed fallback. Lower frequency than 8.91 (0.0013–0.0021 at 480×300), so each cloud is bigger than the screen and runs off its edges: no centres or outlines. Two layers, `body::before` (`--glass-a`: violet, cyan) and `body::after` (`--glass-b`: pink, deep blue), each `inset:-14%`. Alpha is capped (`GLASS_CAP`: dark .5, light .62) so however the seeds fall the base shows through and text and icons stay readable.
- **Settings → Glass → Animated background** (only shown with Glass selected; settings.js and the timetable page's own Settings): `tt.glassanim` → `html[data-glassanim="on"]`; the two layers drift, turn and swell against each other (26 s / 33 s, alternating). Off with reduced motion. Off by default (moving glass re-blurs every card each frame, which is heavier on old phones).
- **Game icons**: the 25 duotone icons are in icons.js (`d:<name>`), with `Icon.GAMES` (game/subject id → [icon, colour]) and `Icon.game(id, emoji)`, which outputs both the icon (`.gi`) and the emoji (`.ie`). Used on every game and subject card (games.js `gameCard`) and Home's Today strip. **Settings → Game icons: Icons (default) / Emoji** (`tt.gameicons` → `html[data-gameicons]`), pure CSS, so it switches instantly. "Theme colour" under Home icons also colours these.
- **Contrast**: in dark mode, and in glass dark, game icons and Home's tile icons are mixed a third of the way to white (`color-mix`), so the deep blues and violets stay visible.
- The preview's `iconmock.js` is now redundant (the real icons are in).

### 8.93 The MSCU favicon (in the theme's colours), emoji on Home's tiles, a little type per theme
- **Favicon**: from images/MSCU.png (the owner's logo). New files: `favicon-32/48/192/512.png` (rounded corners, radius 22%, so the M and U stay clear; a circle would cut them), `apple-touch-icon.png` (square, iOS rounds it), `msc-letters.png` (the letters alone, white, 128 px). Every page links favicon-32, favicon-192 and the touch icon (the old icon.png and the logo's .ai/.svg sources are untouched; the SVGs use live text in Franklin Gothic, so they aren't used). theme.js `paintFavicon()` redraws it on a canvas in the theme's `--accent` with the letters in `--accent-ink` after every look change (Chrome, Edge, Firefox; Safari keeps the fixed one). vault.html and 404.html keep the fixed blue.
- **Icon style: Emoji now covers Home's tiles too** (`data-emoji` on each tile's `.ico`; `Icon.fill` adds the emoji beside the drawn icon and CSS shows one). Focus mode's target tile has 🎯. The two settings are renamed: Home icons → **Icon colour**, Game icons → **Icon style**.
- **Type per theme**: Glass's big headings (Home's greeting, page titles, the timetable's name, the poll question) have a light band through the letters and a faint cyan/pink fringe, like glass bending light (off with High contrast). Classic's headings are rounded (`ui-rounded`, so SF Pro Rounded on Apple devices, else Nunito, now in every page's font link). The other themes already have their own type.

### 8.94 Correction to 8.93: the favicon's letters change per theme, not the site's type
- The Glass heading effect and Classic's rounded headings from 8.93 are **removed** (theme.css back as it was, Nunito out of the font links). The site's theme fonts stay as they were.
- Instead the **favicon's letters** take on each theme (theme.js `FAV_STYLE`, drawn in `paintFavicon()` on a 64 px canvas from msc-letters.png): Classic rounded (blur then a soft alpha step); Glass a sheen across the pane, a cyan/pink fringe and a band where the letters thin out; Terminal and Retro pixels (drawn at 23 px, then scaled up unsmoothed); Blueprint outlined; Brutal a hard shadow; Sci-fi a white neon glow; Notebook tilted and rounded; the rest as the logo. Preview: `.preview/favtest.html?seed=0` shows every theme's icon side by side.

### 8.95 Clouds for custom themes
- Custom theme → Advanced → Backdrop has **Clouds**: the Glass background with its own options (shown only with Clouds chosen, in settings.js and the timetable page's Settings): **Cloud colours** (four), **Cloud strength** (15–90%: the most colour that shows), **Cloud size** (0.5–2×) and **Animated**. Stored in the custom theme (`cloud1`–`cloud4`, `cloudStrength`, `cloudSize`, `cloudAnim`; defaults in `CUSTOM_DEFAULTS`). Pairs well with Frosted glass.
- theme.js now has one maker, `cloudLayers(fields, cap, thr, size)`, for Glass and custom; the random seeds and stretches (`CLOUD_RND`) are picked once per page open, so changing a colour recolours the same clouds. The layers in theme.css follow `html[data-clouds]` (off / still / move), set by `apply()` for Glass (its Animated switch, `tt.glassanim`) and for a custom theme with Clouds. The Clouds backdrop's `--bg-img` is the fine grain (light or dark to suit the background).

### 8.96 Clouds that keep dark mode dark; no edge when moving
- **Picking a good draw** (theme.js `vetClouds`): before the clouds show, the page draws the two layers small (72 px wide, as they sit on screen: 14% over each edge, cover), measures the colour in the middle (the central 60% × 66%) against the edges, and rerolls the seeds (up to ten) until the middle is clear (dark ≤ .12, light ≤ .2 average alpha), there's some colour overall (≥ .08), and the edges have more than the middle (+.05); otherwise the best of the ten. The layers start hidden (`html[data-clouds-ready="0"]`) and fade in over .9 s once it's picked. Once per page open; if the browser won't let the page read the drawing back, the first draw is kept.
- The clouds are sparser: a field shows only where its noise is above .55 (dark), .52 (light), .53 (custom), so most draws leave the page mostly its own colour with clouds round the edges.
- **Moving without showing an edge**: the drift no longer turns (a few degrees tips a layer's edge into view on a wide screen); it drifts at most 8% of the layer (inside its 14% margin) and swells.
- A centre "veil" was tried and removed (it showed as a ring).

### 8.97 Credits: plainer, and a fade on the way out
- The coloured aurora blobs behind the credits are gone (it read as romantic), the names have no coloured glow, "Made by" only brightens, and the trails and sparks are in the page's text colour (fainter). What's left: the frosted page, a few stars, the faint orbit track, the two names.
- Closing (click away, ×, or Esc via the dialog's `cancel` event) fades the overlay and its backdrop out over .38 s (`.credits.out`, then `close()`); the backdrop also fades in on open. Instant with reduced motion.

### 8.98 Credits close as they opened, backwards
- Closing (click away, ×, Esc) plays the opening in reverse over 0.9 s (credits.js `close()`, `closingAt`, `CLOSE_MS`): the names keep orbiting while they spiral back into the middle, blurring and fading (the same spiral, slow at first then quicker); the track, trails and stars fade with them; "Made by" drops its letters from the end back (`.credits.closing`, `crletterout`); the note and any message fade. The overlay and its backdrop then fade (`.out`, .38 s) and it closes (about 1 s in all). Taps and sparkles are ignored while closing. Instant with reduced motion.

### 8.99 QR codes: /q/<name>
- Every printed QR code points at `mscunofficial.com/q/<name>` (vercel.json rewrites `/q/:code` and `/q` to **q.html**), e.g. `/q/library`, `/q/canteen`; any name (a–z, 0–9, hyphen, up to 32) works and is counted on its own. q.html shows the MSCU square for a moment, notes the scan (`navigator.sendBeacon` → `POST /api/forum?scan=<name>&device=phone|tablet|computer&first=0|1&signedin=0|1`, no sign-in needed, bots skipped) and goes to the timetable (`/`). Without JavaScript it goes straight there. Later it can show something first.
- Nothing about who: the code, the time, the kind of device, whether that device had scanned one before (`msc.qrseen` in its localStorage) and whether it's signed in to the site. Table **qr_scan** (SQL in SETUP.md); without it scans still go through, uncounted.
- Moderator page → **QR scans** (`GET /api/forum?scans=1`, moderators only): each code's scans, new devices, % already signed in, % on a phone, last scan, and the last 14 days as bars.
- (8.99, later) q.html now takes its time so it doesn't look like a flash of some redirect: the MSCU square comes in, at 0.9 s it lifts a touch and "Welcome to / MSC Unofficial" fades in under it with "mscunofficial.com" quietly at the bottom, at 2.7 s it all fades and the timetable opens (about 3.1 s in all). A tap or key skips ahead; without JavaScript it moves on after 2 s.

### 8.100 Reaction: the floor is 60 ms
- `MIN_REACTION_MS` (api/leaderboard.js) and the page's `MIN_MS` (games.js BUILD.react) are now 60 ms (were 100). Only checked when a score is saved; nothing on the board is filtered when it's read. What's new has an entry (`reactfix`): times under 100 ms were culled from the leaderboard to fix a bug, and from now on anything from 60 ms counts.
- (8.100, later) The Reaction game shows a small note above the box: "Missing a time? While fixing a bug we cleared every reaction time under 100 ms, so yours may have gone with them." with a × (`.gnote` in games.css). Closing it is remembered with the account (`tt.react_cullnote`); it stops showing by itself after 19 Dec 2026.

### 8.101 Moderator page → Themes
- `GET /api/leaderboard?themes=1` (moderators only) reads just the theme keys from everyone's synced settings (`prefs`: `data->>"tt.skin"`, `tt.mode`, `tt.glassanim`, `tt.gameicons`, `tt.tileicons`, `tt.zen`, and `tt.custom`'s backdrop), not whole settings, so it's one small query. If the database won't pick keys out that way it reads the settings whole instead (same answer, slower). "Active" = settings synced in the last 30 days; never having picked a theme counts as Plain.
- The tab: each theme with its colour swatch, a bar for active people, the count and share, and the all-time count; then Dark mode, Glass animated, Emoji icons, Icons in theme colour, Custom with clouds and Transparent background as shares of the active.

### 8.102 Themes, redrawn
- **Retired:** Newsprint and Retro. Anyone still on one reads as its successor (`RETIRED` in theme.js: newsprint → Editorial, retro → Vaporwave); their stored `tt.skin` isn't rewritten. Both old looks (and the old Sci-fi, Swiss and Brutal) are custom theme codes in What's new (`themes2`), each with a Use button.
- **New:** Skeuomorphism (`skeuo`), Y2K Futurism (`y2k`), Vaporwave (`vapor`), Editorial (`editorial`), Art Deco (`deco`), Maximalism (`maximal`). Art Nouveau was skipped: it depends on hand-drawn ornament that doesn't translate into a UI kit; Art Deco instead.
- **Renamed and redrawn:** Sci-fi → Cyberpunk (id stays `scifi`), Brutal → Neo Brutalism (`brutal`). Swiss, Notebook, Terminal and Blueprint were strengthened. **Plain, Classic and Glass are untouched.**
- **Terminal vs Blueprint:** Blueprint keeps its colours and type (it's popular) and gains drawing-sheet details (registration marks, a dimension line on section headings, "SCALE 1:1"). Terminal became a text-mode program: double-line frames, `[ bracketed ]` buttons that go inverse, a blinking cursor, glow. Blueprint stays dark-only, so nobody's look flipped to white.
- Each theme's look is in theme.css (structure, not only colours: headers, tiles, buttons, section headings, the timetable's cards). Shared selectors used: headers `.topbar/.hubbar/.pagehead` (skipped in Display → Header: Separated), tiles `.qtile/.tday/.gamecard/.tile/.game`, section headings `.sechd/.cathd`. Backgrounds: Y2K draws its chrome blobs on `body::before` (an SVG); Vaporwave uses `body::before` (grid floor) and `body::after` (sun); both hidden in Transparent background.
- **Fonts** a theme alone uses load only when it's picked: `SKINS[].font` → `skinFont()` adds a Google Fonts link (Michroma + Sora, VT323, Instrument Serif + Jost, Inter Tight, Big Shoulders Display + Josefin Sans, Bricolage Grotesque, Barlow + Barlow Condensed).
- **Icons follow the theme:** `SKINS[].ic` (tile = a colour each, accent = theme colour) and `.is` (icons / emoji). Plain colourful icons, Classic emoji, Glass theme colour; the rest as fits. Display → Icon colour / Icon style override them for every theme (`tt.iconcolour`, `tt.iconstyle`: auto | …). The old switches (`tt.tileicons`, `tt.gameicons`) count as an override only where someone had picked the non-default (accent / emoji), so nobody's choice was lost. A custom theme has its own icon choice (`custom.iconColour/iconStyle`).
- **Settings:** every theme shows (no More/Fewer). Icon colour/style moved from Settings to Display. Custom gained Icons and a **Theme code** row: Copy code / Enter a code. `TT.themeCode(custom)` → `MSC-…` (base64url: version, six colours, sizes, font by its index in `CUSTOM_FONTS` (**only ever add fonts at the end**), switches, cloud colours if Clouds, check byte); `TT.parseThemeCode`, `TT.useThemeCode` (sets the custom theme, keeping the replaced one in `tt.custom_prev`, offered back in Custom until used). Custom themes can't copy a built-in theme: the built-ins' structure isn't a custom option.
- Favicon styles for the new themes (`FAV_STYLE`: gloss, glitch). Moderator → Themes counts the new icon keys and names retired themes. Asset version 20261114.

### 8.103 Themes, rebuilt (supersedes the theme parts of 8.102)
8.102's first pass was judged skin-deep. Nine themes were rebuilt around what each style is for, with moving backgrounds, page transitions, the old looks kept, drawn thumbnails and a favicon each. Plain, Classic and Glass are untouched.

**Where things live**
- `theme.css`: base tokens, Plain, Glass, Classic, shared rules only. Every other theme has its own stylesheet, `/skins/<id>.css`, loaded by theme.js (`SKINS[].css`): written into the page while it is loading (so it is there before first paint), fetched when a theme is picked in Settings (the theme goes on once the file lands; Settings warms them all as it opens, `TT.warmSkins`). `ASSET_V` in theme.js is the version on those files and must match the pages' `?v=`; `theme.js` itself is now linked with `?v=` too.
- `skins/skeuo.css`, `skins/deco.css`, `skins/paper.css` were **built** (procedural SVG textures and drawings) from templates and scripts in the session scratchpad (`skeuo_tpl.css` + `tex.py`, `deco_tpl.css` + `deco.py`, `paper_tpl.css` + `paper.py`). Edit the built files by hand from now on. The other skins are plain files.
- `/skins/legacy.css`: **the originals**, each theme exactly as production had it, as real skins: `o-paper`, `o-swiss`, `o-brutal`, `o-scifi`, `o-terminal`, `o-blueprint`, `newsprint`, `retro` (`SKINS[].legacy`). Not in the picker; under Settings → Custom → Originals (`TT.origBox`). Not to be restyled. (8.102's `RETIRED` mapping and the What's new theme codes are gone; theme codes remain for sharing custom themes.)
- `fx.js` (loaded by theme.js on every page): the canvas background manager and all page transitions. `/fx/<skin>.js`: a theme's background scene, loaded only for that theme (`maximal`, `y2k`: WebGL fragment shaders; `vapor`, `scifi`: 2D canvas). No libraries.
- `html[data-pg]` (which page), `html[data-fx]` (on/off). **Animation** switch: Settings, right under Appearance (`tt.fx`; off with Reduce motion or when the device asks for less motion). Off: no transitions, backgrounds draw one still frame. Decorative CSS animation is only ever under `html[data-fx="on"]`. Display's old "Animations" is now labelled "Timetable animations".
- Power: frames stop while the tab is hidden and while a game is open (`TTBackOn`); 30 a second on battery or a phone; a slow device gets a smaller drawing (`BG.q`); WebGL asks for the low-power GPU; Vaporwave draws at about a third of the screen's pixels.

**Transitions** (fx.js `TR`): a click on an internal link plays `TR[skin].out`, notes it in `sessionStorage tt.nav`, navigates; theme.js sees the note before first paint (class `fx-in`, loads fx.js at once), `TR[skin].cover` puts the same cover up, `TR[skin].in` plays the way in. Everything has timer fallbacks, so nothing sticks (also cleared on `pageshow` from the page cache). Maximalism: bands of type naming the page ahead; Skeuomorphism: a metal shutter; Y2K: a chrome ripple; Vaporwave: tracking loss, static, tune-in; Art Deco: a fan; Swiss: squares on the grid; Cyberpunk: panels shift behind angles, interference, "LINK PAGE"; Notebook: a fresh sheet; Terminal: clear and redraw; Editorial and the rest: a short fade.

**The themes**
- **Maximalism**: a magazine over printed cloth. A shader per page (`fx/maximal.js` `PAGE`): home = rows of enormous MSCUNOFFICIAL type on rippling fabric (alternate directions, the pointer presses it down, visible weave); timetable = warped grid; calendar/finder = rings of type and rays; free = cut-out shapes; games/mahjong = a wall of flipping tiles; revision/resources = stripes. On top everything is square: cream sheets stacked on colour, wide headlines, flat colour blocks, a spine and page number on wide screens.
- **Cyberpunk** (`scifi`): equipment panel. Status strip `.cy-hud` with real readouts (time, online, battery, window), left rail, ruler, angled tabs, cut corners with **L-shaped calibration marks in the corners** (the user asked for these instead of tick rows), dot-matrix numerals, a turning wireframe structure, dither blocks, scan line, pointer crosshair. Interference only on a press (`.cy-hit`), a page change, and the title about once a minute.
- **Skeuomorphism**: a desk. Materials are SVG turbulence + lighting: maple/walnut desk, felt for games, cork board for free periods, brushed-aluminium unit with an LCD, leather planner for the timetable, legal-pad forum, clipboard poll, playing-card games, brass plates. Aqua controls: gel buttons that depress, sliding switches, grooved sliders, segmented controls, blue scrollbars, sheet dialogs with a red close button.
- **Y2K Futurism**: liquid chrome scene (blobs, spheres, ribbon, wire grid; a drop follows the pointer), chrome bars, black glass displays, lime primary with vermilion beside it, iridescent icon bubbles.
- **Vaporwave**: a drive toward a striped sun past palms and columns on worn tape (VHS readout, tracking band), bevelled windows with gradient title bars and the page's name in Japanese.
- **Editorial**: masthead, one very large serif headline, hanging page number, Home's pages as a table of contents, poll as a pull quote, timetable as a listing. No motion.
- **Swiss**: a visible twelve-column grid; Home in three label columns + nine content columns; lower case; index squares closed by a red block; black block = now, red bar = today.
- **Art Deco**: scalloped wall, sunburst, fan crest over every bar, stepped-corner frames and stepped-cut buttons, strict symmetry (a header button in each top corner). Home's icons sit in **diamonds** (the user preferred these to arches).
- **Notebook**: paper fibres, creases, punched holes, margin doodles on wide screens, torn-and-taped header, paperclipped poll, dog-eared cards, hover star and hand-drawn underlines, "today!" in red pen.
- Neo Brutalism, Terminal, Blueprint: as 8.102 (their originals are in Originals too).

**Also**: the picker's swatches are drawn miniatures of each theme (`THUMBS` in theme.js); each theme paints its own favicon (`FAV`, `FAV_STYLE`); What's new entry `themes2` rewritten; moderator Themes labels originals; offline shell caches `theme.js` and `fx.js` by version (`CACHE_VERSION` v8).

**Not checked here**: smoothness. The preview pane was hidden for most of the work, which pauses frames, so states and layouts were checked but frame rate on a real school laptop was not. If a background is heavy there, lower `maxPx` / `dpr` in that scene's file.

### 8.104 Themes, third pass (restraint)
Feedback on 8.103: Maximalism loved (left alone, apart from a two-line greeting on phones); most others had too much going on. What changed:
- **Plain, Classic, custom themes, the originals**: change page instantly again (`TR` in fx.js has no entry for them).
- **Cyberpunk**: rewritten as a few bold flat blocks (lime title block, grey Next block, panels turn lime under the pointer), one status strip (page, time, connection), no barcode. A different wireframe study per page (`fx/scifi.js` `PAGE`: structure, tunnel, globe, blocks, radar, ridges). A press only changes colour (`.cy-hit` is filter-only): the old one moved the element and lost clicks.
- **Y2K**: calm white/ice shader, no rainbow film, chrome kept to two corners; the page change is a CSS capsule wipe (`.yk-wipe`).
- **Vaporwave**: a scene per page (`fx/vapor.js`: drive with banded sun and 3D mesh hills, checker floor, sunrise, planets, clouds); no scanlines, tape or pointer effects.
- **Editorial**: one rule at the head of a page, hairlines only inside lists, no boxes on header buttons, more white space.
- **Notebook**: refined scrapbook. Margin doodles, punched holes, creases, hover star, "today!" and "where to?" are gone; tape, torn edge, highlighter, sticky notes, paperclip and hand underlines stay. Still built by `paper.py` from `paper_tpl.css` in the scratchpad.
- **Blueprint, Neo Brutalism, Terminal**: rewritten to the standard of the rest (see each file's header). Blueprint: title block with sheet number, hatching for now/hover, plotted in left to right. Neo Brutalism: flat blocks, hard shadows, pink swipe behind titles, blocks stamped in. Terminal: directory listing for Home, `./games`, frame legends, a status line along the bottom (CSS only, hidden on phones and over games), printed in from the top.
- **Skeuomorphism**: the shutter has a door handle rather than a slot; Free periods is a pinned sheet on the cork board.
- **Glass**: cloud seeds and phase are kept for the session (`sessionStorage tt.cloudrnd`), so the background does not jump between pages.
- **Settings**: Theme code sits under Animation; Originals is its own box at the top of the Custom panel. One-time notice (`themesNotice` in theme.js, `tt.themes2_note`) tells returning visitors where the originals are, with "Keep the original" when their theme was rebuilt.
- **A trap**: `--bg-img` is used as `background-image`, so it cannot carry a position or size. A sized pattern needs `background-size` on `body, .gate` (see blueprint.css, brutal.css). Maximalism's and Cyberpunk's fallback patterns still have the invalid form and so do not show; left that way on purpose (no flash before the canvas draws).
- On phones a tall font could be clipped in Home's Next card (fixed 5rem height); Notebook, Vaporwave and Neo Brutalism let that card grow.

**Checked** with headless Chrome screenshots (script `shot.mjs` in the scratchpad; the preview pane was hidden): every theme's Home at phone width, the reworked themes on Home / Timetable / Games, the arrival frames of each new transition, Settings, the notice. Regression scripts all pass. **Not checked**: frame rate on a school laptop.

### 8.105 Themes, fourth pass (motion sickness, Vaporwave again, Settings)
Feedback on 8.104 (deployed as `20261114`). Asset version is now `20261115`, `CACHE_VERSION` v9.
- **Vaporwave** (`fx/vapor.js`, rewritten; drawn at full resolution now, `maxPx` 2.1e6). The road, banded sun and skyline are on the **timetable** (`drive`; the hills are a mesh with each face lit from the sun). Home is `ruins` (marble columns in still water under a moon, with reflections). Calendar/notes `pyramids`; free/revision `stairs` (floating steps to a lit doorway above cloud); resources/mahjong `solids` (cube, cone, ball over a quieter chequered floor); games/finder `planets` unchanged (the one the user singled out as done well: bold solid things with light on them, kept to the sides of the page, is the standard for the rest). **Page change**: no more block of static. `TR.vapor` in fx.js puts an SVG filter (`#vp-tear`: `feImage` band map → `feDisplacementMap`, then red split from green/blue) on `.wrap` by inline style, so the page's own pixels tear and split, stepping worse on the way out and settling on the way in; scanlines, a tracking bar and a PLAY mark over it. Chromium and Firefox only (`VP_SVG`); elsewhere a CSS jitter (`.vp-jit`).
- **Skeuomorphism**: the metal shutter is gone. Things on the desk lift and fade, the next page's are set down in turn (`skup` / `skdown` on `.wrap > *`, or on `.wrap` itself for one-sheet pages). `TR.skeuo` is the plain `fade`. Edit `skeuo_tpl.css` + `tex.py` and rebuild, as before.
- **Maximalism**: the shader clock runs at 0.42 on Home, 0.38 on the timetable, 0.78 elsewhere (`pace`), and the pointer's dent is 0.38 of what it was: the user felt sick at full speed. The Home greeting may take two lines (three at most) instead of cutting the name off.
- **Cyberpunk**: no pointer lean except Home's structure (the timetable's tunnel made the user queasy). The barcode is back, once a page: foot of the rail on wide screens, corner of the page's name on narrow ones (`--cy-code`).
- **Editorial Home**: no Next panel (`.hubnow` hidden on Home), more space, and the poll's results set as a listing (winner in large italic, thin underline bars, no boxes or trophy).
- **Notebook**: hovering a card swipes its name with highlighter (was a scribbled underline).
- **Y2K**: the Now/Next card is ice-white glass in light mode, black only in dark. Page change: the old page fades, then one wave of chrome crosses the new one (`.yk-wave`, with `body` clipped to the wave's middle, same trick as Blueprint).
- **Swiss timetable**: its own grid. `--tcol` (58px, 86px in full view) for the times, then `--sw-n` columns (10; 4 on a phone), two to a day; the stripes behind the page, the header (a CSS grid on the same tracks), the week switch and the day columns all use it. Column gap is `--g` (10px under 1100px wide). Lesson names clamp to two lines; `.s` needs `flex:none` or short lessons lose their name.
- **Settings**: the Appearance heading folds the theme grid (`TT.skinFold`, `tt.skinsfold`); folded, it names the theme. **Originals** is its own box directly under Animation for every theme (`TT.origBox`; "Back to …" returns to `tt.skin_prev`). **Theme code** is inside the Custom panel only. No theme tile is pressed while an original is on. Wording elsewhere now says Settings → Originals.
- Headless screenshots: `shot.mjs` in the session scratchpad (blocks `/api/prefs`, which otherwise overrides the theme under test; `frames` / `jf` capture a transition mid-way).

### 8.106 Flicker fixes (asset version `20261115b`, `CACHE_VERSION` v10)
- **Settings sync was reloading pages.** `syncPull` (theme.js) reloaded whenever the server's `updated_at` differed from `tt.syncedat`. A change made just before leaving a page is pushed on `pagehide` with `keepalive`, and that page never reads the reply, so the stamp is lost and the next page saw a "new" stamp and reloaded; a reloading page writes keys of its own (Home writes `tt.poll_view` every load), so quick clicking could reload a page three or four times. Now it compares values (`canon()`: key order ignored, since jsonb doesn't keep it), skips keys the page has already written (`touched`), only writes and reloads for keys that really differ, and never reloads twice for one stamp in a tab (`sessionStorage tt.pullreload`).
- **Backgrounds dropped out between pages.** The canvas was only mounted at DOMContentLoaded, so a page arriving by a transition was first painted with the stylesheet's still picture and the scene popped back. For Y2K and Vaporwave (whose ways in show the background), fx.js now writes the scene script into the page as it loads and mounts the canvas before the first paint (`writeScene`, `EARLY`, `mountBg(true)`). Other themes keep the late mount (their covers are opaque) and the canvas fades in (`.fx-bg.fx-late`).
- **Y2K page change**: the wave is now a slanted (9°), curved body of chrome drawn once as an SVG (`ykWave` in fx.js: bands follow its front, its back fades out), put up under the cover before the page shows, moved by transform only and faded at the end; the page is clipped to a slanted line inside its solid part (`ykreveal`, `--yk-w`, `--yk-s` in y2k.css).
- Flicker checks: `flick.mjs` / `fdiff.py` in the session scratchpad record a page change as a run of screenshots and print the frame-to-frame difference; `diag.mjs` walks the site with a saved login and logs every load and reload. Run them with `MSYS_NO_PATHCONV=1` under Git Bash, or a path like `/games.html` gets rewritten.

### 8.107 Multiplayer rebuilt around a lobby; Settings tidied (asset version `20261115c`, `CACHE_VERSION` v11)
**Settings** (both dialogs: settings.js and index.html's own): Appearance folds by default once a theme has been picked (`TT.skinFold`); Dark mode and Animation are two switches in one row (`TT.lookRow`; the footer's Dark mode button is gone); Original themes is one row that opens (`TT.origBox`); signed in, Login is one line ("Signed in as … · Change · Sign out", fields only while changing); shorter hints. Theme codes only in the Custom panel.
**Y2K page change** uses a cross-document view transition where the browser has them (`CSSViewTransitionRule`; Chromium): theme.js writes `@view-transition{navigation:auto}` while Y2K and Animation are on (`vtOptIn`), the page being left stays on screen, and on the next one the wave (`.yk-wave.vt`, `view-transition-name:yk-wave`) and a slanted wipe of `::view-transition-new(root)` run over it (fx.js `pagereveal`, y2k.css). Elsewhere it falls back to fade-then-wave.
**Maximalism**: Home tiles' numbers in the top-right corner (they overlapped names). **Backgrounds keep moving while a game is open** (20 fps instead of stopping; fx.js `quiet`).
**Multiplayer** (`mp.js`, new; loaded by games.html after games.js and uses its globals):
- A lobby is a Firebase room `rooms/lb-<code>` (rooms.js, same database and rules as Mahjong's rooms; public lobbies announce in `rooms/lb-public`). The host's presence holds the lobby state (`ls`: game, every game's settings, the round in play, kicked ids, public). Rounds: the host writes `ls.r = {id, g, players, seed, at, o}`; every member's page mounts `BUILD[g](box, { lobby:S })` as player or watcher; the round's messages are prefixed `r.<id>.` (`scoped()`); `S.back()` returns everyone to the lobby. Host leaves → the longest-standing member takes over (the round ends). Leaving the hub keeps you in (a corner tab); reloading or coming back to the games page in the same tab rejoins (`sessionStorage mp.lobby`).
- Chat (`chat` events, 650 ms throttle, 200 chars, the same word filter as Mahjong's chat, now `MPF.censor`), quick lines that change with the moment, reactions; the host sends the last 40 lines to anyone who joins (`hist`). During a round the chat folds to a button with a count and new lines pop up beside it.
- Games (`LGAMES`): **Tetris** (host settings: first to N, board size, gravity and ramp, garbage multiplier/cap/messiness, targeting, T-spins and back-to-back; tetr.io attack table; aim by clicking a board or Even/Knockouts/Attackers/Random; knocked-out players and watchers get the other boards large; live boards at ~4 Hz only while someone is watching), **Snake** (arena: size, speed, fruit, walls, power-ups speed/ghost/shield/golden fruit, starting length, obstacles, first to N; host-authoritative, clients blend the last two steps), **Sketch** (new: write → draw → guess chains, host-timed steps, drawings sent as ~20–40 KB WebP, reveal at the end), **Chess** (the first two play peer to peer with the server's rules and clocks, the rest watch; no sign-in needed). Hong Kong Mahjong keeps its own rooms and is listed under Multiplayer.
- games.js: a Multiplayer section (`mp`, `mp-tetris`, `mp-snake`, `mp-relay`, `mp-chess`, `hkmj`); Tetris lost its Versus tab (`BUILD.tetris(host, {lobby})` plays it); Snake rewritten (`SNK` renderer: interpolated, rounded, eyes; solo settings, only Classic counts for the leaderboard; `snakeArena`); the old `mpLobby` is gone. icons.js: a pawn for chess; icons for the multiplayer cards.
- Testing: `/mock/rooms?on=1` on the preview server swaps in `.preview/rooms-mock.js` (BroadcastChannel between tabs, now with `lobby()`); `mpt.mjs` in the session scratchpad drives several headless tabs (scenarios tetris, snake, sketch, chess).
- Not checked against the real database: if making a lobby fails on the live site, check the Firebase rules allow `rooms/lb-*` (the rules aren't in the repo).

### 8.108 Snake modes and looks; Trails and Territory in the lobby (asset version `20261115d`, `CACHE_VERSION` v12)
- Solo Snake has two tabs. **Leaderboard** always plays the default rules (Classic, Normal speed that ramps, Medium 16×16, one fruit, wrap) and is the only thing that calls `recordStat('snake')`. **Custom** (`tt.snakecfg`, now with `tab` and `mode`) is never ranked; per-settings bests stay in `tt.snakebest` (key `mode.sp.sz.fr.ed`; old keys without a mode are simply ignored).
- Custom modes: Classic; **Bun** (a turn waits until you've gone two cells since the last one; drawn as a bun band under the snake); **Statues** (each fruit leaves a stone copy of up to 6 tail cells that blocks and crumbles over 70 steps); **Holey** (a piece laid on a step that's a multiple of three is a hole you can pass through; `s.n` counts steps so holes stay put; drawn with a dash pattern sized for the line caps); **Rubble** (each fruit drops a permanent rock); **Runaway** (fruit within 2 cells may hop away).
- Look (`tt.snakelook`, both tabs, cosmetic only): fruit (apple, grape, orange, cherry, banana, strawberry, watermelon, lemon, mixed; all drawn on the canvas), colour (theme, 9 colours, rainbow), pattern (plain, stripes, spots, fade), shape (round, blocky, slim), eyes (round, sleepy, sunglasses). In lobby games your own snake wears your pattern/shape/eyes on your screen and fruit is drawn as your choice; colours stay the lobby's.
- Any arrow now starts a solo game (before, pressing the way the snake already faced did nothing).
- Lobby Snake (`mp.js LGAMES.snake`) has a **Mode**: Classic, **Trails** (no fruit or power-ups, everyone grows every step, the ones that are out stay as walls; host sends the first 3 cells + length per step and whole bodies every 10 steps or on `sreq`), **Territory** (`snakeTerritory`: 5×5 starting land; off your land you draw a line, back on it you take the line and everything it encloses; crossing any line knocks its owner out; head to head, whoever is on their own land survives; edges and losing all land knock you out; most land at the time limit or last one left wins; host sends changed cells per step and an RLE of the whole board every 30 steps or on `treq`). Options carry a 5th entry listing the modes they apply to; `modeSets` resets size (24/40/40) and edges when the mode changes. New sizes: Giant 56; new option: Time limit (territory).
- Cells are now 3 base-36 characters on boards over 36×36 (the old 2-character encoding broke on the 40 board). The board also fits the window height.
- `window.__SNDBG`, if a test script sets it, receives the Territory state each step; nothing sets it on the site.
- Tested with `mpt.mjs trails`, `territory`, `terr1` against the fake rooms (identical boards across three tabs); not against the real database.

### 8.109 Impostor; pause, votes, nerfs, hand-over; free numbers; no word filter (asset version `20261115e`, `CACHE_VERSION` v13)
- **Impostor** (`mp.js BUILD.impostor`, 3–10 players, `mp-impostor` card, self-drawn `d:mask` icon): a secret picker chooses a word (3 suggestions from `WORDS` or typed), a secret impostor isn't told it, everyone gives clues in turn (`rounds` × players), then votes. Most votes on the impostor (no tie) = caught. Secrets: each page makes an ECDH P-256 key pair and sends the public half ('pk'); the host's page deals roles ('deal') and the word ('word') sealed per player with AES-GCM, padded to 192 bytes; the picker sends the word to the host the same way ('wd'). Only the host's page holds everything. 'pkreq' re-sends anything missed.
- **Pause** (host button in the round bar, or a vote): `ls.pz = {rid, on, at, tot}`. `S.paused()`, `S.clock()` (lobby time minus time paused) and `S.pauseFn(on)`. Every lobby game's timers now run on `S.clock()`: Tetris countdown/next round, Snake/Territory countdown, Territory time limit, Sketch steps, Chess clocks (paused: the side to move shows what it had), Impostor phases. A card covers the game while paused.
- **Leaving mid-round** no longer knocks anyone out: Snake/Trails/Territory snakes keep going straight; Chess clocks run on (no auto-resign); Tetris boards are run by the host's page (`vsGhost`: pieces fall at the round's gravity and lock, garbage still lands, top-out sends 'out' with `as`), also when someone goes back to the lobby ('lft'). The host gets a note offering to pause.
- **Votes** ('vote'/'ballot' in the lobby room, 30 s, more than half of the lobby, 10 s between calls by one person): remove someone, make someone host, pause/resume, nerf. Every page counts; the host's page applies. The host can do all of it directly (Make host, Nerf/Un-nerf, Remove; People menu in the round bar).
- **Hand-over**: `ls.hand = id` (ends the round); the named member takes `h:1`, the old host steps down when it sees that; two-hosts resolution prefers the named one.
- **Nerfs**: `ls.nerf = {id: 1..3}`, persists in the lobby. Tetris: one piece per 500/800/1200 ms at most (hard drop waits, soft drop = gravity). Snake/Trails/Territory: misses one step in 4/3/2. Not applied to Chess, Sketch, Impostor.
- **Numbers**: `LGAMES.*.num = {key: [min, max, step, unit]}` turns those settings into number boxes with the old values as suggestions (datalist); limits are only what the game can run (Tetris 4–40 × 8–60, Snake boards 8–200, fruit 0–500, length 1–100, times in seconds, etc.). The games' own clamps were widened to match.
- **No word filter**: removed from the lobby chat, names, Sketch and Hong Kong Mahjong's chat (`censor()` there now passes text through). Control characters and lengths are still trimmed.
- Tested with `mpt.mjs impostor`, `pause` (number entry, nerf vote, host pause, vote to resume, leaver note and board) plus the earlier scenarios, against the fake rooms.

### 8.110 Quartets repeats less; Maximalism tiles; Tetris Save visible again (asset version `20261115i`, `CACHE_VERSION` v17)
- **Quartets** (`QUARTETS_VERSION` unchanged at 8, so no stored puzzle is touched; only new days are picked differently):
  - `_connroute.js` reads the last 60 days of `conn_puzzle` (read only) into `avoid` (category → days ago) and `usedBy` (category → email → days ago).
  - `TIERS` now start: (0) nothing used in the last `AVOID_DAYS` = 10 days and no category with fewer than 4 people it hasn't used in `PEOPLE_DAYS` = 60 days; (1) the 10 days only; (2) 5 days; then the old tiers. Within a category, the people it used least lately are picked first; among candidate puzzles, each group that reuses 3+ recent people costs 2.5 points.
  - A simulated year on the real Year 11 name list (made-up timetables; the list was only in the scratchpad and deleted afterwards): categories back within a week 338 → 1, median gap 11 → 15 days, the exact same four in a category within 60 days 148 → 86. On the synthetic year: 403 → 181, 10 → 13, 55 → 50. Every day still made a puzzle.
- **Maximalism**: the games page's collage tiles turn about 2.5× less often (13–30 s each, from 5–13) and a little more gently.
- **Tetris**: Save (Zen, Survival) and Undo/Redo (Practice) were invisible since site.css's `.btn[hidden]{display:none}`; they're now shown by clearing `hidden`. Saving and resuming had kept working.
- **Mahjong frame**: Maximalism's spine and page number and Cyberpunk's rail and barcode no longer draw inside `hkmahjong.html` (`data-pg="hkmahjong"`). The 快/練 card tiles have their own ink colour. Home's `/vault` scramble: 1 load in 8.
- **Vaporwave**: the road's near hill rows fade out instead of popping; the sun's gaps rise.

## 8.111 Plainer greetings (asset version `20261116a`, `CACHE_VERSION` v18)

The home greeting is now only "Good morning", "Good afternoon", "Good evening", "Welcome" (midnight to 5am, and when signed out) or "Welcome back" after a week away. "Still up", "Early start", "New week", "Nearly the weekend", "Happy Saturday", "Good to see you" and the short "Morning"/"Afternoon"/"Evening" are gone.

## 8.112 Mahjong club: score calculator; the graph zooms (asset version `20261116b`, `CACHE_VERSION` v19)

**Score calculator** (mahjong.js `calcHTML`/`calcPay`/`wireCalc`, a collapsible box under "Record a game"):
- Winner, "Won by" (self-drawn or someone's discard), faan, then Half spicy / Full spicy, "Discarder pays all" / "Everyone pays a share", and a Unit multiplier (free number, suggestions 1–16). The last three are kept on the device (`localStorage` `mj.calc`).
- The tables and payments are the HK game's (`HALF_SPICY`, `FULL_SPICY`, `win()` in hkmahjong.html): self-drawn, everyone else at the table pays half; discard, either the discarder pays all, or half from the discarder and a quarter from the others. Over 13 faan counts as 13. Losers are rounded; the winner gets exactly what they pay, so a game always adds to 0.
- "At the table" chips pick who pays for a self-draw or a shared payment (all players by default when there are 4 or fewer; the winner and the discarder are always in).
- "Count the faan" is an optional checklist using the HK game's own faan values (dragon pungs counted separately from Small/Great Dragons, as in the game; a limit hand counts alone; 1 is added for self-drawn).
- "Fill in the game below" only fills the Record a game boxes; nothing is saved until Save game. After a save the winner and checklist reset.

**Graph** (`graph`/`drawGraph`/`wireGraph`): scroll wheel or pinch zooms around the pointer, dragging moves along, double-click / Show all / Esc / 0 shows everything, + and − buttons and keys, arrow keys move. The points scale fits the games in view. Hover (or tap on touch) shows that game's points and change for everyone. Dots appear once 24 or fewer games are in view. The wheel only zooms out until everything is shown, then the page scrolls as normal. The SVG is drawn at the page's own width now (it was a 640-wide picture scaled up or down, which made the text tiny on phones).

Preview: `/mock/mj?n=60` adds 60 made-up games to the mock Mahjong sheet (`n=0` to go back).

## 8.113 Studio, a macOS-style theme (asset version `20261117a`, `CACHE_VERSION` v20)

Everything here shows only while **Studio** (`tt.skin = 'studio'`) is on; other themes draw as before.
- **Look** (`skins/studio.css`, decisions at the top of the file): warm cream page, content on single grouped surfaces split by hairlines (Home's pages, games, forum, Now/Next) instead of grids of cards; violet accent for actions, selection, today and focus; peach for today's things; lavender for the poll. SF Pro Display/Text, SF Mono only for times and codes. No coloured bars down the side of anything (lessons, Resources' library card, revision answer marks, quotes, Mahjong notes): state is a tint.
- **Timetable** (index.html, the block after `const $`): `studioRender(ctx)` draws the beta's (/beta/, andre/index.html) layout from the page's own data. Header: Term · Week · dates (`#stterm`, `TERMS` copied from the beta), the user search in the middle (`.idglass`), buttons right. Day headings "Mon 16 Nov" between round arrows; no time column, the time is on each block; touching breaks and free periods merge ("Recess · Free"). A lesson opens in place with the beta's spring, room fly-in and FLIP glide; the class list is tinted in the lesson's colour. Week changes have no animation in Studio. **No scrolling, by layout not measurement**: on the Studio timetable `.wrap` is a window-high flex column; `#grid` takes the height that is left (`grid-template-rows:auto minmax(0,1fr)`), and every block is placed in percentages of its day column (`top:calc(P% + 4px)`), so the day always fits, at any zoom or window shape, with no JS sizing. `fit()` (rerun by a ResizeObserver on `#grid`) only does what needs real sizes: `--bw` (each block's width in px; container units placed the room badge wrongly in some browsers, clipping it), one-line breaks (`.gap.sm`), `.tight` / `.sm` lessons, and `.up`. The body's height is set by `fitHeight()`: Accessibility → Zoom is `body{zoom}`, and Firefox/Zen zooms a percentage height while Chromium doesn't (110% zoom put the last period off-screen in Zen), so it sets the body to the window height, measures `.wrap`, and corrects once (on render, resize and `tt:look`). The page is pinned to the top (`html,body{overflow:hidden}`, a scroll listener, `history.scrollRestoration='manual'`). The gap under the day equals the page's top padding (20px, 14px on phones). The lesson on now has the beta's veil and line (`--p`); Now card keeps its bar. Studio is second in the picker, shown as "Studio - Beta". Backdrop: a fixed peach→mauve wash in light, deep plum in dark; Transparent background clears it. Lessons in the lower half of a day open upwards (`.blk.up`, card anchored at its bottom), so an opened card stays inside the window. Shown in Settings as "Studio - Beta". The page is pinned to the top (a scroll listener resets it, `history.scrollRestoration='manual'`): a restored or focus-nudged scroll had hidden the last lesson. The gap under the day equals `.wrap`'s top padding. Light mode's page is plain white, dark mode plain `#1c1820` (no washes). Break bars stack name over time only when 72px+ tall. Lesson lines never shrink (`flex-shrink:0`), so a squeezed lesson overflows and `fit()` drops the teacher. **User search (Studio)**: the beta's bar (38px, filled, a glass, sized to its text via canvas measuring in `sizeWhoami`, violet ring on focus); suggestions span the whole bar, show the year, say "Searching…" / "No students match" / "needs your school login" (`suggest.js` gained `waiting` and `{hint}` rows, used only when Studio is on); a name with a space hides the domain, and leaving the box mid-name puts the current person back. `suggest.js` is now linked with `?v=` on the timetable page. **Pages under the timetable (Studio)**: the page scrolls again; the first screen is exactly the timetable (`fitHeight()` now sizes `.wrap`, not the body, with the same zoom correction), and below it `#sthome` (index.html) holds the beta's tiles for Calendar, Free periods, Revision, Resources, Games, Student finder and Mahjong club, linking straight to each page, on the day columns' grid (5 across, 4 under 1100px, 2 on phones). The timetable's Home button scrolls to them; on every other page theme.js `homeLinks()` points the Home button and the "MSC Unofficial" link at the timetable (`./`) while Studio is on, and back to home.html otherwise. No heading over the tiles (the beta's "MSC Unofficial" was left out on request). **No Home page in Studio**: theme.js `studioAway()` sends home.html to the timetable (`location.replace('./')`) on load and on `tt:look` (picking Studio there), except a moderator's poll preview (`?pollpreview=`). On the sign-in card "Look around first" closes the card and shows the tiles; the timetable's "New poll this week" note is hidden (the poll is only on Home). Forum and Poll tiles too (9 tiles): they open `home.html?show=forum` / `?show=poll`, which Studio lets through (`studioAway()` sets `html[data-show]`) and studio.css trims Home to just that section, titled "Forum" / "Poll" ("No poll is open right now." when poll.js leaves it hidden). **Mahjong club in Studio** (mahjong.js `studioHTML`, only while Studio is on): the beta's two columns: Standings as bars (fill by the beta's asinh `spread` scale, rank, name, points, a +/− box; Enter saves) with Save/Undo, Add a player and the score calculator under them; Over time: the award cards in one row, then a tall graph (same zoom/drag as before, the beta's spread scale and start ± powers-of-2 labels, no key). The History list is gone in Studio: hovering a game shows its date, who won or paid what, their new totals and place changes, and who leads (`gameTip`). When the order changes after a save, the bars slide to their new places (`reorder`, FLIP; nothing else animates; off with reduced motion). On a computer the sheet is one window high (mahjong.js `fitPage`, zoom-corrected like the timetable): Standings (bars share the column's height, max 60px), the graph taking the rest, and the awards in a column of their own (their text wraps instead of being cut). No score calculator in Studio (user's call). **Every menu page fits one window in Studio (computer widths)**: the header is one small line ("MSC Unofficial · Games", like the term line) with only Home and Settings (the Timetable button is hidden: both go to the same place; Forum/Poll's header button becomes Home). theme.js `studioFit()` adds `html.stfit` and sizes `.wrap` (zoom-corrected) on Calendar, Free periods, Resources, Student finder and Forum/Poll; games.js `fitGames()` does Games and Revision (and lets go while a game is open, so games scroll as before); mahjong.js `fitPage()` Mahjong. The page never scrolls; a long list scrolls inside its panel. Layouts: Calendar = month filling the height + side cards; Free = week + group/people panels; Finder = results in columns; Resources = subjects as coloured tiles; Revision = coloured subject tiles + the Year 12 study tools in a column; Forum = posts scrolling under the box; **Games** = three columns (Play with your year / Multiplayer / Arcade), tiles in each game's colour (`Icon.GAMES`), each game with a leaderboard listing every place inside its tile (`TILE_BOARDS`, `fetchBoardsFull`; Tetris shows Sprint, Survival and Zen); the bottom Leaderboards section is a header "Leaderboards" button (`#stlbbtn`) opening the full sheet. Games, second pass: wide tiles (Play with your year one column, the board beside the name; Multiplayer and Arcade two across, the board under the name), each board the top three plus your own place when lower (Tetris: each board's leader); no Leaderboards button (the sheet still opens from inside each game). Studio's tile colour (`--c`, `data-g`) and boards are only added while Studio is on, and games.js redraws the cards on a theme change (`lookSkin`), so other themes never see them. Settings' theme thumbnails have a fixed strip shape in Studio (a report of round, squashed thumbnails in Zen couldn't be reproduced). Games tiles, third pass: Plain's proportions (32px icon, 1.125rem name; without a board, icon top-left and name at the foot; with one, the board fills the tile). Asset version `20261118h`, `CACHE_VERSION` v41

### 8.116 Studio: smoother lessons opening, wider (asset `20261118n`, `CACHE_VERSION` v47)
- The Apple theme is out of the picker (`HIDDEN_SKINS` in theme.js; its files stay, a saved choice reads as Plain). Hiding a skin removes it from `SKINS`, so per-skin lines like `SKINS.find(...).border` must guard with `|| {}` (an unguarded one threw and stopped theme.js on every page).
- Opening a lesson: the details used `max-height: 0 → 900px`, which reaches the real ~110px almost at once, so the card snapped to full height (a lesson low in the day, which grows upwards, jumped its top edge, room number and time ~50px in one frame). Now `.open .blk-detail` is `max-height:none` and onClick animates the card's own height (`h0 → h1`, the width's spring, 550ms); `glide` measures each line relative to the card, so lines ride the card as it grows either way. Filmed with Playwright before/after: largest move per frame went from 55px to under 14px.
- Width: `--st-wide: max(1400px, 16:9 of the window height)` for the timetable, its tiles and Mahjong; day columns are `1fr` (were capped at 320px).

### 8.115 Apple theme (`skins/apple.css`, id `apple`, "Apple - Beta"; asset `20261118m`, `CACHE_VERSION` v46)
Written from scratch to look like a Mac app made by Apple (skills `.agents/skills/apple`, `apple-design`). Nothing in apple.css comes from Studio.
- **Window:** theme.js `appleShell()` adds `html.apshell` and a fixed translucent sidebar `#apside` on every page (computers only): the pages (`APNAV`, colours match the timetable's icons), Settings at the foot (clicks the page's own Settings button), and on the timetable `#apnow` (Now and Next). Each page's header becomes just its large title.
- **Timetable:** its own renderer in index.html (the "Apple theme" block after Studio's; `window.appleRender`, asked before `studioRender`). Toolbar in `#stterm` ("Week 6A", term and dates, ‹ Today ›), the search beside it. The week is Calendar-style: hour ruler, hairlines, lessons placed by real time (`.apev`), red now-line on today. A lesson opens a popover (`.appop`) beside it; clicking another lesson moves it from where it is (interruptible), Escape or a click outside closes. The class list reuses Studio's roster code through `ttRosterHtml` / `ttToggleRoster`. Under the week, `#sthome` is drawn as app icons.
- `studioOn()` is Studio only again; `studioLike()` (Studio or Apple) gates the shared behaviour: fitting `.wrap` to the window, the tiles below, no week animation, the search hints. theme.js (`studioHome`, `studioFit`), games.js and mahjong.js still treat both alike, so the menu pages fit one window in Apple too; apple.css lays them out its own way (Games as three shelves, Mahjong with the graph as the hero, Calendar month + side column, Revision subjects + study column).
- Width: the window (sidebar included) is capped at 16:9 of its height (`--ap-max`).
- Studio's expanding lessons (shared JS, both themes before the split): `onClick` clears a pending `closingTimer` on reopen; `flyRoom` starts from the badge's current transform; `glide` cancels running glides after measuring.
- Checked in the preview at 1440×900 (temporary `api/timetable` / `api/gamestate` files, removed): timetable light/dark, popover and rapid clicks, app icons, Games, Mahjong, Calendar, Free periods, Resources, Revision, Forum; Studio still draws and opens lessons. Not checked: phones, Finder with results, Poll, switching themes without a reload.

### 8.114 No more ghost lobbies (all themes)
A public lobby stayed listed when its host's browser never disconnected cleanly (a phone asleep, a dropped connection): Firebase's onDisconnect only removes a peer on a clean disconnect. rooms.js now re-writes each open room's own peer node every 30 s (`BEAT`), and anyone not heard from for 150 s (`STALE`, server time) is left out of `peers()` / `onPeers` (re-checked every beat, so a ghost drops off without any change in the room). Public lobbies, their members and Mahjong-style rooms all benefit. games.js loads `rooms.js?v=20261118h`. What's new entry `ghostlobbies`. Caution: a tab still running the old rooms.js (open since before the deploy) doesn't beat, so after 2½ minutes newer clients treat it as gone until it reloads. (a cached studio.css with the old 70px page padding was the likely cause of the live scroll). `weekOff` counts calendar weeks so the dates follow the arrows. Phones: the day strip, then that day's blocks under its date.
- **Display → Now and Next** (`tt.nownext`, all themes, default on): off hides the timetable's pair and Home's Next card (not Home's sign-in prompt); `html[data-nownext]` from theme.js.
- Libraries: `pick-ui-library` was run. Base UI, cmdk, Sonner and Vaul are React components; this site has no React or build step, so none were added.
- Checked in the preview (fake `/api/timetable`): timetable light/dark at 1440 and 375, opening a lesson and its class list, the Now and Next switch, Plain unchanged; Home and Games light/dark; Home filmed with Stageshow's `film.mjs`. Not checked: Calendar, Free periods, Finder, Revision, Resources, Notes and Mahjong in v2; the timetable with real class lists.

## 8.114 Credits removed; an open About on Home (asset version `20261117j`, `CACHE_VERSION` v29)

Supersedes the Credits parts of 8.86–8.88, 8.97 and 8.98.
- **Gone:** the Credits overlay (`credits.js` deleted, its `<dialog>` and the `.credits`/`.cr*` styles), the three-taps-on-"MSC Unofficial" trigger and its tick, and the names route in `api/forum.js` (`GET ?credits=1`) plus its mock. The creators' names are now in no page and no API response. Still in the repo but never deployed (`.vercelignore`): `index2.html`, `*.md`, `backup/`, `.preview/`. Server code still has the admin and birthday-anchor emails (`api/_supabase.js`, `api/_birthdays.js`); they are never sent to a page.
- **About** (Home's footer, between What's new and Suggest a feature; `#aboutdlg`, the same box as What's new): what the site is (free, unofficial, not the school or the Department, no ads, nothing sold); how it was made (nearly all by AI, Claude through Claude Code, from short plain-English requests, little written or checked by hand, "vibe coded"); why there are no names (little human work); what that means (mistakes possible, check official sources for anything that matters); AI while you use it (none: nothing is sent to an AI). **If a feature ever calls an AI at run time, update that last paragraph.**
- Vault clues: clue (2), "/vault" among the Credits stars, went with Credits. Left: the Home scramble (one load in eight), 404.html's title, and the console line.

## 8.115 Security and privacy pass (asset version `20261117k`, `CACHE_VERSION` v30)

A full review of the server routes, the browser code and what gets deployed. What was wrong, what changed, and what is still open. Tests: `authtest.mjs` (21 sign-in checks against a pretend school API, run against the old code too: it failed 12 of them), a headless run of every page and theme with the live headers switched on (nothing blocked), and the six older regression checks (all pass).

**Fixed on the server (`api/`)**
- **Any password worked while a token was cached** (`timetable.js` `getToken`). The token cache was keyed by address only and a hit skipped the password, so `X-School-Email: someone` with any password signed in as them for as long as their token was cached. The owner's token is nearly always cached, so this also gave moderator powers. Now a hit must carry the same password: the entry keeps an HMAC of it (key made fresh per server instance; the password itself is never kept) compared in constant time.
- **No sign-in was needed for other people's data.** Without a login the server used its own (`SCHOOL_EMAIL`) for anyone's timetable and profile, any class list and the whole student and teacher directory, with the answers cached publicly. Now: class lists, directories, the finder and free periods always need the caller's own school login; a timetable without a login is only given for an address listed in `ALLOWED_EMAILS` (**unset now means nobody**, it used to mean everybody). Nothing on the site or the beta used the open mode (both show a sign-in first).
- **Wrong passwords** are remembered for a minute per address (the same wrong one isn't sent to the school again: a stale saved password is sent by every request a page makes) and counted: 8 per address+network, 20 per address, 60 per network in 10 minutes, then `429`. In memory per instance, so a brake, not a guarantee.
- `?diag=1` is moderators only (it named the school's server to anyone).
- `scrub()` drops private-looking fields (date of birth, phone, address, guardians, password, token…) from class lists, directories and profiles passed on from the school, in case it ever sends them. Names, addresses of the email kind and groups are untouched.
- **Calendar:** the iCal reader checks the address (https, Google's calendar host, an `/calendar/ical/` path, no port or user), follows redirects by hand checking each, and limits time and size; the older `import` action used a plain `fetch` that followed redirects anywhere and now uses the same reader. `?ical=1` still needs no sign-in (the beta calls it without one) but only answers this site's own pages and is rate limited.
- **Subject events** need a sign-in to read as well as write (they carry what students wrote and who last changed them).
- `_limit.js` (new, private): `limited()` in-memory rate limits on forum posts and reactions, deck publishing, subject events, Google import, QR scans and Jim presses; `crossSite()` so the routes that need no sign-in (iCal, QR scan, Jim) refuse requests a browser says came from another site; `safeEqual()` for the cron secret.
- Daily Guess Who hints are text with `<b>` only: any other tag in a subject, teacher or classmate name is neutralised (server and page).

**Fixed in the browser**
- **Public lobby list (`mp.js`)**: a lobby's `max` came from another player's computer and was put into the page as HTML. Anyone could write a presence to the public room with markup in it and run code in the browser of everyone who opened Multiplayer (which could read the saved school password). It is a number now. `rooms.js` also makes every presence a plain object (a `null` one used to break the list for everyone).
- **Hong Kong Mahjong online (`hkmahjong.html`)**: a client drew whatever the host sent, and several fields weren't escaped. Everything a client receives now goes through `tame()` first: in every string the characters that can start a tag or end an attribute are swapped for look-alikes, except text made only of the tile alphabet (hands are sent that way, and it can't carry anything that runs) and the replay list `hx` (read one character at a time). Checked against 1,580 states of a real bot game: identical apart from straight apostrophes becoming curly.
- Guess Who hints and Free periods escape the school's strings; a `?pollpreview=` link only plays for moderators (it used to play for anyone, with a question and line taken from the link over the real results).

**Headers (`vercel.json` `headers`)**: a content-security policy (scripts only from the site, the three Firebase SDK addresses at their exact version and the regional database host; connections only to the site and the database; images, media and fonts from the site and Google Fonts; no plugins, no framing by other sites, forms only to the site), plus `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and a `Permissions-Policy` turning off camera, microphone, location and the like. `pyworker.js` has its own (Pyodide needs `eval`; a worker can't reach the page or its storage). **Adding anything from a new outside host (a font host, a CDN, an image host) now needs that host added to the policy**, or the browser will block it. The local preview (`.preview/mock.mjs`) sends the same headers, so it shows up there first.

**Not deployed any more (`.vercelignore`)**: `.agents`, `.claude`, `skills-lock.json`, and `images/*.ai` (the two Illustrator files carry the name of the computer account that made them in their metadata; no page uses them).

**Checked and fine**: no secrets in the repo or its history; `npm audit` clean; the service worker never caches `/api`; the forum, polls, decks, calendar, leaderboards and moderator page escape everything they show; moderator actions are all checked on the server; the Firebase database refuses reads of its root and of the room list.

**Still open (decisions for the owner, not code I could safely change)**
1. **The school password is kept in the browser** (`tt.creds` in `localStorage`) and sent with every request. Any script that runs on the site can read it; the policy above makes that much harder to exploit and to send anywhere, but can't rule it out because the site's own code is inline. The real fix is a sign-in that swaps the password for an encrypted, `HttpOnly` cookie the page can't read. It wasn't done because the beta (`/andre/`, not ours to edit) reads `tt.creds.password` itself and would be signed out.
2. **Row-level security** is off on the older Supabase tables. Nothing reads them except the server's key, but turning it on (SQL in SETUP.md, "Security checklist") closes the door if the project's public key ever gets out. It changes no data and nothing the site does.
3. **The repository**: if it is public, everything in it is public whatever `.vercelignore` says: these notes, the moderators' addresses in `api/_supabase.js` and `api/_birthdays.js`, `index2.html`, the `.ai` files and their history.
4. **Firebase scripts** come from Google's CDN with two fallbacks (jsDelivr, unpkg), pinned to one version by the policy but not checked by hash. Keeping a copy of the two files on the site would remove the outside dependency (needs the files downloaded).
5. **Rooms trust the players in them**: a message says who sent it, and the sender writes that. Someone in a room can pretend to be its host and spoil a game (not run code). The database rules aren't in the repo, so they couldn't be reviewed.
6. The rate limits are per server instance. A determined flood wants a shared store (a small Supabase table) or Vercel's firewall.

## 8.116 Three photo themes: Frutiger Aero (Frutiger Evil in dark mode), Gen X Soft Club, Coquette (asset version `20261117l`, `CACHE_VERSION` v31)

The themes leaned blue and black; these three use **real stock photographs** (Gen Z spots AI imagery at once, so none is generated). Code draws only what looks right in code (bubbles, gloss, lace, pearls, frames). Photos: 37 from Wikimedia Commons (CC0, public domain, CC BY, CC BY-SA), cropped/recoloured/combined; credited in Home → About → Photo credits (required by the BY licences; BY-SA edits are shared under the same licence). Files: `images/th/*.webp`, each page background 1600×1000 plus a `-s` 900px version for phones (`@media (max-width:700px)`), sprites without `-s`. Built by `img/build.py` in the session scratchpad from `img/full/` (originals, `credits.json`); search/fetch scripts `commons.py`, `fetch.py` (Commons only serves thumbnails at standard widths: 960, 1280, 1920…).
- **Frutiger Aero** (`aero`, `skins/aero.css`, `fx/aero.js`): glossy frosted glass over nature photos, gel buttons (aqua; green for the primary), glossy app-tile icons. Photo per page via `--ae-ph`: hill (home, and the sky of it on the timetable under a white veil), coral (games), leaf (calendar, notes), reef (free, revision), drop (resources, finder), fish (mahjong). `fx/aero.js` is a transparent 2D canvas over the photo: bubbles positioned purely from the clock (continuous across pages; still frame with Animation off), mostly at the sides; slowest on Home and the timetable. Fonts: Segoe UI where present, else Hind.
- **Frutiger Evil** = Aero in dark mode (an easter egg; the What's new entry doesn't name it). Settings calls the theme "Frutiger Evil" while dark (`SKINS[].darkName`, `TT.skinName`; settings.js re-renders the grid on `tt:look`). Same layout, black-red glass, hot gradient headings; backgrounds `evil-*.webp` are the Aero photos folded into reds plus a deliberately cheap collage on Home (blood moon, half-sunk earth, burning monitor, skull, red water). The canvas adds red sinking bubbles, bats with a red outer glow and fish skeletons, all kept in the margins either side of the page (behind the glass on phones).
- **Gen X Soft Club** (`softclub`, `skins/softclub.css`): researched as the quiet, cold side of 1997–2004 (CARI's "urbane/gentrified image of club culture", chill-out sleeves, transit spaces, long-exposure crowds, terrestrial futurism; not Y2K). Washed-out cyan/teal photos of platforms, walkways, escalators, a glass lobby, the Barcelona Pavilion; a second, bluer view of the same photo in a hairline frame drifting very slowly (`body::after`, 90 s); a faint column of data text on the left (SVG in `--sc-data`); Lexend Giga lower case over Arimo; square hairline panels; Now/Next is the one deep-blue block; numbered Home tiles; page change slides away like a train (`TR.softclub` + `.fx-out`/`.fx-enter`). Dark mode multiplies the same photo to a cold night teal.
- **Coquette** (`coquette`, `skins/coquette.css`): cream paper header with a lace hem (`--cq-lacemask`, SVG mask) and a real satin bow photo tied at the hem (`cq-bow.webp`), pearl strings after section names and under today, Playfair Display italic headings, Pinyon Script site name, DM Sans for everything else, raspberry accent, soft-focus photos veiled in cream (peony, tulle, cherries, rose, pointe shoes, pearls, ribbons). Dark mode: wine, with the photos multiplied down.
- What's new: `themes3`. Favicons: `FAV.aero` (red in dark), `FAV.softclub`, `FAV.coquette`. Thumbnails in `THUMBS`.
- Checked with headless screenshots: every page type in light and dark for each theme, phone width Home, Settings names. Not checked: frame rate on a school laptop (the canvas is 30 fps, a few drawImage calls a frame; backdrop blur is on panels, not on timetable lessons).

## 8.117 The photo themes, second pass (asset version `20261117m`, `CACHE_VERSION` v32)

Feedback on 8.116: Coquette's photos were "a bit too tryhard"; Aero's pages were mostly washed-out nature stock photos without Aero's optimism (technology meets nature); Evil's Home was the best part but its other pages were just recolours, and its bats and fish moved too much; Soft Club felt like lightly recoloured photos. **Quality over quantity**: a few composed backgrounds, not one per page.
- **Coquette**: no photographs. Cream paper with the faintest blush in two corners (wine in dark mode). Bow, lace hem and pearls stay; the bow now hangs off the left end of the hem. Playfair gets lining figures (`font-feature-settings:"lnum"`; its default "1" read as "i").
- **Frutiger Aero**: one composed world, `images/th/aero-world.webp` (`img/build_aero.py` in the scratchpad): a cumulus sky, the rolling hill, a glossy wavy water line with real tropical fish (keyed off white, grey and blue grounds) over coral, the Earth in a bubble top right, a monitor on the grass showing the same sky, a big bubble with fish in it, a sun and soft flare. Same layout as Evil's Home on purpose (earth ↔ blood moon, clean monitor ↔ burning one, clear water ↔ red). The timetable gets `aero-calm` (sky and hill only) under a white veil. Section headings have a white halo so they read over the scene.
- **Frutiger Evil**: its Home scene (`evil-hill`) on every page, `evil-sky` behind the timetable; the recoloured photos are gone. Bats and fish skeletons hardly move now (a few pixels, very slowly, no flapping, fixed facing); the bubbles are the motion.
- **Gen X Soft Club**: five backgrounds instead of nine (`img/build_sc.py`): Home `sc-home` (the platform with a second and third view framed on the right and a block of dots, baked in), timetable `sc-calm` (the moving walkway), games and Mahjong club `sc-green` (the escalators, green like a club flyer), free/revision/notes `sc-lounge` (the pavilion), calendar/finder/resources `sc-crowd` (the long-exposure concourse). The grade is a blue/cyan/green gradient map with a little real colour kept, haze, strong bloom on the lights, horizontal motion blur and the fine screen of an LCD. Header and buttons are translucent plastic and brushed metal; the Now block glows. The drifting framed pane (`body::after`) shows on the other pages, not Home (baked in) or the timetable.
- **A bug this found**: games.css styles every `canvas` like a game board (background, border, `height:auto`), which put a pale sheet over Aero's see-through bubble canvas on Games and Mahjong club. `.fx-bg` in theme.css now resets those.
- Photo credits (Home → About) regenerated for the 28 photographs still in use (`credits_html.py`).

## 8.118 Aero and Evil simplified; page changes for Aero and Soft Club (asset version `20261117n`, `CACHE_VERSION` v33)

Feedback on 8.117: Soft Club liked; the Aero and Evil scenes were "a mess, no coherent composition or focus" (logic like coral inside a bubble and fish kept in bubbles; real Frutiger Aero is simple building blocks placed freely).
- **Scenes rebuilt** (`img/build_aero2.py` in the scratchpad, helpers in `build_aero.py`): bright cumulus sky with the sun top left, the lush hill, one glossy wavy waterline across the bottom (the ripple photo squashed into perspective and coloured tropical aqua), the Earth in a glass globe resting on the water at the right, a monitor on the left with its foot in the water (screen: the same water), a sergeant major leaping over the line (cut out by hand: a traced outline, `FISH_OUTLINE`), a betta and a cardinal in the water, one small fish in the sky, a few clean bubbles. **Evil** is the same frame gone wrong: red storm sky, the hill dead, red water, the blood moon in a red glass globe (round mask from the disc's area), the monitor on fire, a fish skeleton where the fish leaps, a skull in the water, red bubbles, dark corners. Evil's canvas no longer adds fish skeletons; two bats at most. `over(..., glow=)` pads the sprite so a glow no longer stops at a square.
- **Page changes**: **Aero** (`TR.aero`, `aeRise`): a rush of the background's own bubbles (`FX.aeBubble`, red in Evil) rises up the screen across the change, seeded from the nav note so both pages draw the same ones; the page fades under it; nothing covers the screen. `EARLY` includes `aero` so the bubble sprite exists when the next page draws. **Soft Club** (`TR.softclub`, `scStart`): an SVG filter on `.wrap` (horizontal Gaussian blur, a displacement map of horizontal bands from `vpMap`, red split from green/blue) with the page sliding sideways: smears out to the left, the next page smears in from the right and settles (≈0.3 s + 0.4 s). Chromium/Firefox only (`html.sc-svg`); elsewhere the old CSS slide (`softclub.css`).
- **games.css** gives every `canvas` a background and border; the transition layers' canvases (`.fx-layer canvas`) now reset that too (as `.fx-bg` did in 8.117).
- Credits regenerated (26 photographs).

## 8.119 Coquette and Frutiger Aero held back for now (asset version `20261118a`, `CACHE_VERSION` v34)
- Not finished, so hidden for a push. `HIDDEN_SKINS = ['coquette', 'aero']` in theme.js filters them out of `SKINS`, so they leave the picker (both Settings dialogs), `SKIN_IDS` and the CSS prefetch; a saved `tt.skin` of either reads as Plain (`readState`, and settings.js now checks `SKIN_IDS` too) without being overwritten, so anyone who had one gets it back when it returns. **To bring one back, take its id out of `HIDDEN_SKINS`** (and add a What's new entry for it).
- Their files stay as they are (`skins/aero.css`, `skins/coquette.css`, `fx/aero.js`, `TR.aero`/`TR.coquette` in fx.js, thumbnails and favicons in theme.js, `images/th/aero-*`, `evil-*`, `cq-bow`).
- What's new `themes3` now announces Gen X Soft Club only. The About's photo note no longer names themes ("Some of the themes use real photographs…"); the credit list still has all 26, since the held-back images are still deployed.

## 8.120 Frutiger Aero and Evil as the archetypal pictures; walls of bubbles and fire (asset version `20261119a`, `CACHE_VERSION` v47)
- Users asked for the two archetypal pictures themselves (the monitor in the sea with a butterflyfish bursting out of the screen, the glass globe with the world map, gulls, a clear splash along the waterline; and the Frutiger Evil meme: brown sky, bats, a pink globe, red water, a burning black screen, a fish skeleton, a skull). The originals weren't copied (one is an artist's own work); the layout is recreated from free-licensed photographs.
- **fx/aero.js** now puts the whole picture together in the browser from cut-outs (`images/th/ar-*.webp`, built by the scratchpad's `img/build_ar.py`: threadfin butterflyfish traced by hand and keyed, gulls and a starfish keyed, two water-drop crown photos turned into the clear splash (white light with alpha), the LCD monitor turned a little with a perspective warp and its screen filled with water (Evil: black), sand, Evil's sky/water/fire/skull). `layout(w, h)` gives a landscape arrangement and its own one for a tall screen (aspect < .9), so it fits any screen. Still layers (sky, sea, splash, monitor, fish, sand) are drawn once into two offscreen canvases (`back`, `front`) and copied each frame; per frame only: the globe (`Globe(D)`: `ar-map.webp`, land white, projected onto a tilted sphere into an ImageData, one turn per 160 s), the gulls/bats drifting a few px, the lower fish bobbing, Evil's flame flickering over the screen (`screen` blend), the composition's bubbles bobbing and a few rising (Evil: sinking). The timetable gets a light veil over the picture. Pictures arriving bump `gen`, which redraws the still layers (and a still frame with Animation off).
- The stylesheet's still (`ar-still*.webp`, a frame of the scene; `-p` tall ones for `max-aspect-ratio:4/5`) shows before the scene draws or without it. The old `aero-world`, `aero-calm`, `evil-hill`, `evil-sky` pictures are gone, and the timetable-only scene with them.
- **Page change** (`TR.aero` in fx.js, `aeWall`): asked for by name, so it is the one theme whose change covers the screen, briefly: a wall twice the screen tall rises from the bottom (out 0 → .5, cover at .5, in .5 → 1 eased), its middle opaque. Aero: a blue gradient with ~90–260 bubbles (`FX.aeBubble`, now defined in fx.js so the cover can draw them before fx/aero.js loads), each rising a little faster or slower. Evil: a fire photograph across the middle, tongues of flame along the top edge (`ar-flames`), sparks, on a red/orange gradient core (so the cover is solid even before the photographs arrive); its canvas is drawn at 0.6 scale. The fire photographs are light-on-black turned into colour with alpha (`lit()` in build_ar.py) so they lie over an empty canvas.
- Aero's timetable times, day names and week label have a white halo (Evil: dark).
- Credits regenerated (29 photographs; new: the butterflyfish, gulls, water drops, splash, sand, starfish, NASA's land/ocean map, the flames, the fire).

## 8.121 Gen X Soft Club, second UI pass (asset version `20261119a`)
- Feedback: poor contrast in places, transitions lag slightly, headings should be bolder and part of the composition, the images don't fit other screen sizes, the UI felt like a website on top of backdrops; keep the data column and the dots and squares.
- **Type**: Archivo at its widest (font-stretch 125%, loaded with Soft Club's fonts) for page names and the greeting (800, capitals) and section names (700, capitals, with a hairline running out); Lexend Giga stays for Home's tile names; Arimo for reading. The site's name (`.sitename`, `.eyebrow`) sits on a bar of signal blue in italic expanded capitals, like the strip across a sleeve.
- **Set into the picture** (laid out by CSS, not baked, so they fit any screen): `html::after` is the page's name, huge and expanded, overlay-blended into the photograph with a ghost of itself above (on a phone it stands on its side down the right edge); `html::before` is the block of dots and squares (an SVG in `--sc-dots`); `body::after` the framed second view (now on Home too); the data column stays on `body::before`. `sc-home.webp` no longer has frames or dots baked in. Each photograph has a tall crop (`sc-*-p.webp`, `max-aspect-ratio:4/5`) besides the landscape and its 900px copy.
- **UI**: the header has a hairline frame set 6px off it; the inner pages' sheet has a bar of signal blue along its top edge and a frame 8px off; rooms on the timetable are numbered like platforms (a dark plate tinted with the subject's colour); today's day name is a solid chip; times, day names and the week label are dark with a soft halo; break bars are frosted.
- **Page change**: the smear is lighter (the blur is less than half, four displacement maps are made once and reused), the next page's photograph is fetched while the page leaves, the way in waits up to 200 ms for its own photograph to be decoded, and every Soft Club photograph is fetched quietly 1.5 s after a page settles (`SC_PH`, `scPic`, `scReady` in fx.js).

## 8.122 Coquette redesigned (asset version `20261119a`)
- Feedback: "pinkwashed version of the default". One idea: a love letter on good stationery, laid on Marie Antoinette wallpaper, with what matters tied in satin ribbon. **Walls** (`--cq-wall`, `body::before`, a soft edge shade in `body::after`): blush/cream stripes on Home, Swiss dots on the timetable, a trellis with a pearl at each crossing on the inner pages, pink gingham on Games and Mahjong. Dark mode is a claret velvet boudoir: the same patterns tone on tone, antique-gold hairlines (`--cq-rule`, `--cq-edge`), blush text. **Paper**: Home, the timetable and Games open on a cream letter with an inner rule (`--cq-frame`), the lace hem, and the bow photo (`cq-bow.webp`) pinned at the top-left corner. Calendar, Free, Finder, Resources, Notes, Mahjong and Revision are one sheet (`.wrap`) with a centred letterhead, a satin band across the sheet (`--cq-band`) and the bow tied at its middle. **Ribbon**: the main button and the chosen tab are satin (`--cq-satin`) with notched ends (`--cq-notch`, clip-path; focus shows as an inner ring); NEW pills and poll result bars are ribbon too; each timetable class has a bookmark ribbon in its subject colour (`.lesson::after`), the current class wears the bow. **Pearls** (`--cq-pearl`): after section names, either side of break names, under today, as the progress bar, the round icon buttons (`--cq-pearlbtn`), a ring round Home's tile icons (`--cq-cameo`). **Type**: page titles in Pinyon Script, section names in Playfair italic, Playfair spaced capitals for the site name, DM Sans for everything else. Motion: only the page-change fade with an 8px lift. theme.js: new `THUMBS.coquette` and `FAV.coquette` (pearl ring). Built from the scratchpad's `cq/gen/`. No new photos.

## 8.123 Study tracker; Revision reshuffled into Study and Practice (asset version `20261119a`)
- `tracker.js` (revision page only, after study.js; in sw.js's SHELL) adds a study tracker: tasks per subject (your own timetable's, from the cached copy and remembered in the data; otherwise the year's revision subjects; or added by hand), one timer site-wide on a task or a whole subject, an optional typed target (25/45/60 as suggestions), totals per subject for today and this week. Data is one synced key, `tt.study` = `{v, at, n:{id:name}, y:[timetable names], k:[{i,s,x,d?,m?,t?}], r:{s,i?,a,e,m?,z?}, l:{yyyymmdd:{id:secs}}}`, written only on actions, never per tick; time comes from the start stamp, so it survives reloads and closed tabs. A target stops the timer exactly at the target (counted even if the page was closed): the card shows "N minutes done", the title says "Time's up", `say()` announces it and `SFX.win()` plays if sound is on. No target: it stops at 4 h. Pruned to 21 days of log, done tasks for 14 days, at most 200 tasks (the prefs blob limit is 100 KB in total). Not created until first used. Expanded subjects are device-only (`msc.trkopen`). The Revision tab re-reads `/api/prefs` when it becomes visible again (signed in, at most every 20 s) and takes a newer `tt.study` (by `at`), because syncPull only runs on page load.
- The page is now two `.gsec` sections: **Study** (`Study.area({hsc})` in study.js: tracker plus a side column of countdown, focus and plan; countdown and plan only for Year 12, tracker and focus for everyone; "Go to practice" jumps down) and **Practice** (`.rvyear` holds the heading and `.rvpills`, then the grid). Studio/Apple still place `.rvyear`/`.gamegrid`/`.rvstudy` by name; the section headings are hidden under `html.stfit`. While a quiz is open and a timer runs, `#trkmini` floats beside Back. The running card offers "Lock the games until it ends" (Focus mode for the rest of the target). Icons `play`, `pause`, `plus`, `stop` were added to icons.js.
- What's new: `study` and `themes4` (Frutiger Aero and Coquette back in the picker; `HIDDEN_SKINS` in theme.js is empty again).
- calendar.html's colour swatch rule is scoped to `.swatches .sw`: it was squashing Settings' theme thumbnails into 26px circles on the Calendar page.

## 8.124 Frutiger Aero's monitor redone (asset version `20261119b`, `CACHE_VERSION` v48)
- Feedback: the stand faced the wrong way and the picture on the screen didn't follow the monitor's shape. Cause: the LCD photograph faces a little right, and the screen alone had been bent to face left; the screen was also found by a brightness test that took in the bezel, so the picture was pasted as an upright rectangle.
- `ar-mon.webp` / `ar-mon-e.webp` are now built by the scratchpad's `img/build_mon.py`: the whole photograph is flipped (screen and stand face left together, towards the fish), the screen's four corners are traced by hand and the picture is warped into them with the recess's shadow and a glass sheen in the same perspective, the buttons (now bottom left) are cloned away and a power light put bottom right (blue; Evil red), and the matt grey plastic is glossy black with a cool cast (the neck stays silver).
- fx/aero.js `drawFront`: the monitor is drawn through its own canvas so that below the waterline it takes the water's colour (Evil: red), the surface's bright line crosses it, and a strip of the splash is drawn again in front of it, so it stands in the sea rather than in front of it. Phones: the monitor is larger (`h:520*s`), the fish moved left so it only overlaps the screen's edge, one gull moved off the corner.
- The four stills (`ar-still*.webp`) were taken again from the new scene.

## 8.125 Coquette held back again; "Beta" dropped (asset version `20261119c`, `CACHE_VERSION` v49)
- `HIDDEN_SKINS = ['coquette']` in theme.js (a saved choice reads as Plain; the files stay). What's new `themes4` now reads "A new theme / Frutiger Aero is in Settings".
- Studio and Apple are named plainly (no " - Beta").
- About → Photo credits starts "Some themes use real photographs…" so it holds whether or not Coquette is shown; the bow photograph's credit stays (the file is still served).
- Merged with Pugmeowla's "fixes" (2f011e3: Studio's lesson opening and width, the Apple theme held back). Version lines took ours (`20261119c`, v49); `HIDDEN_SKINS` is `['coquette', 'apple']` (Aero shown again by us, Apple hidden by them).

## 8.126 Frutiger Aero: picture to the edges, more gentle movement, a sweep for the page change (asset version `20261119d`, `CACHE_VERSION` v50)
- Feedback: the gulls and fish were hidden behind the page; the bubble-wall page change was ugly ("more like a moving ripple/sweep, like Y2K"); Evil's flames in the middle looked janky.
- fx/aero.js `layout` (landscape): the page's column is in the middle, so the globe stands at the left edge and the monitor at the right (measured in from the edges in `s` units, so a wide screen keeps them in its margins), with the fish bursting out of the screen towards the middle; gulls, fish, starfish, skull and bubbles moved out to the sides too. Phones keep their own arrangement.
- New movement, all slow: the clouds drift a little way and back (drawn once into their own canvases, then only moved), the rays under the water sway, a glint of sun shows on the surface now and then, the globe's rings sway and a light goes round the middle one, the fish out of the screen bobs. Evil: embers drift up off the monitor.
- Evil's monitor: the screen itself is on fire (`ar-mon-e.webp` rebuilt by `img/build_mon.py` with `ar-fire` warped into the screen), with a row of flames (`ar-flames`) along its top drawn in swaying slices (`flames()`), and its light flickering on the air round it. The old sideways flame (`ar-flame`) is no longer used.
- The canvas stays clear until its photographs have loaded (1.5s at most), so the stylesheet's still frame shows instead of a half-drawn sky; it then sets `html.ae-drawn`. The stills were retaken from the new layout.
- Page change (fx.js `TR.aero`, `aeSweep*`, `aeWallEngine`): a thick wall crossing the screen from the bottom, "literally just like the spongebob bubble transition". A thin waterline was too thin; pre-drawn layers that only slid looked "like a still image flying upward", so the wall is now drawn frame by frame.
  - Aero: cartoon bubbles (four variants: white outline, a little blue round it, a crescent of light) in a wall about 1.4 screens deep. Each rises at its own speed (big ones fastest), weaves, wobbles out of round, turns its highlight, swells a little, and about one in five pops with a few drops.
  - Evil: a wall of fire. The `ar-fire` photograph in cross-faded copies, its rows swaying with the sway running upward and the whole breathing; two rows of flames flickering inside it and tall ones on its leading edge (each flame swaying in slices, the tips most); loose flames and sparks flying ahead; smoke left behind. `ar-flames` is cleaned in the engine (faint haze taken out, edges feathered) so pieces of it never show as rectangles.
  - `aeWallEngine` is self-contained and runs in a worker made from its own source (blob URL; CSP `worker-src blob:` allows it) on a canvas handed over with `transferControlToOffscreen`, so a page busy loading can't make it stutter; without that it runs on the page. The wall keeps to the mask's curve (`AE_EASE`) and clock (`performance.timeOrigin` + the mask animation's `startTime`).
  - The next page shows through a soft-edged mask (`mask-position` animated by the browser) whose edge rides in the wall's thickest part, so the page being left is still there above the wall and the next one below it.
  - With cross-document view transitions (theme.js `vtOptIn` opts Aero in, as Y2K): `pagereveal` puts up the wall (named `ae-sweep`), adds `html.ae-vt` (theme.css turns the browser's own cross-fade off) and masks `::view-transition-new(root)`.
  - Without them (Firefox): the page fades as it is left and the body is masked on the way in (lengths divided by the body's zoom). Masking the body lifts aero.css's still frame (`body::before`) over the canvas, so it is hidden during the change once `ae-drawn` is set.

## 8.127 Gen X Soft Club's page change: a washed-out haze with light streaking past, smooth (asset version `20261119f`, `CACHE_VERSION` v52)
- Feedback, in turn: stuttery and laggy next to the others, with a red/blue split ("remove the redshift … more like a washed out smear, ideally with the background also transitioning"); then a first smear (the page stretched and slid sideways) looked "stiff and artificial" and "you can see the page scaling and moving side to side".
- Cause of the stutter: an SVG filter (blur, displacement, red/blue split) over the whole page, changed step by step on timers, so the browser redrew the page through it every step on the main thread. Removed (`scStart`, `scEnd`, `scReady`, `SC_MAPS`, `html.sc-svg`).
- Now nothing moves or changes size but light. The whole frame, photograph and all, washes out into a bright blur (blur, brightness up, saturation and contrast down); the two pages cross in the haze (their opacities always add up to one) and the next one comes clear. Over it, soft streaks of light run past like a platform's lights from a train pulling out (`scStreaks`: a haze and two layers of streaks drawn once on canvases twice the screen's width, far ones fainter and a third as fast; `scLightAt`/`scStreakRun` only move and fade them).
  - With a view transition (theme.js `vtOptIn` opts Soft Club in): fx.js `scSmear` animates the filter and opacity of `::view-transition-old/new(root)`, and the streaks are named `sc-light` so they are drawn over both. `html.sc-vt` turns the browser's own animations off (softclub.css). Only opacity, filters and the streaks' transforms change, which the browser animates by itself.
  - Without one: softclub.css washes `.wrap` and the photograph (`body::before`) out as the page is left (`fx-out`), the next page's photograph starts washed out (`fx-in`) and both come back (`fx-enter`, `scin`/`scbg`); the streaks run 0–40% of their way on the page being left and the rest on the next one (`TR.softclub.cover` puts them where they were).

## 8.128 Settings: the themes come first, the originals go quiet (asset version `20261120`, `CACHE_VERSION` v53)
Feedback: the original themes stood out more than the new ones, and many people never noticed the new ones were there. Folded (8.107), Appearance was a small heading ("APPEARANCE › Plain") while Original themes was a full-width box under Animation, so people opened the originals and took those for the whole set.
- **theme.js `skinPicker(field, after)`** now draws Appearance in both dialogs (settings.js, and index.html's own). `field` holds the `<label>`, the `.skins` grid and the `.origrow` box; `after()` runs once a picked theme is saved and on, so the page can redraw its own parts.
- **Folded** (still the default once a theme has been picked, `tt.skinsfold`): one row of pictures (`.skins.peek`). It shows the theme that's on, then the first two of `SHOWCASE` (Frutiger Aero, Y2K Futurism, … skipping the one that's on), then an **All 19 themes** tile with the next four in miniature (`.sw.mos`). On a phone (under 480px) the row holds three, and the third theme is hidden by CSS. While an original is on, there's no tile for the current theme, just three showcase ones, and the originals row shows open.
- **Open**: every theme plus a **Fewer** tile at the end; the heading still folds and unfolds too.
- **Original themes** (`origBox`) is now a quiet line under the full grid (`.origrow`, muted text and no box), shown only while every theme is shown or an original is on. Its tiles and "Back to …" are unchanged. It used to be `.origs`, so studio.css's and coquette.css's `.origs` rules no longer match anything (left alone).
- The picker redraws itself on `tt:look` while its dialog is open, so the timetable now also says "Frutiger Evil" in dark mode. Keyboard focus stays on the same tile across a redraw (More → first tile, Fewer → the All tile).
- `skinFold` is kept, unused, for old pages. Wording: the returning-visitor notice and the "Themes, rebuilt" news entry now say Settings → All themes → Original themes. The tour's `#skins, #s_skins` step can point at the row now, since the grid is never hidden.

## 8.129 Polls: locked once open, a planner to the HSC, one Save (asset version `20261120b`, `CACHE_VERSION` v54)
Asked for: no editing polls that have votes, and the owner stressed that live, voted polls and their votes must not be touchable at all; every Year 12 school week from now to the HSC; and a Save button so many changes go at once.
- **The lock (api/_poll.js `lockedWeek`)**: a question can't be changed, removed or have class subjects collected once it has opened, so this week's (live) and every past one, whether or not anyone has voted yet. That way no edit can land while votes are coming in.
  - Next week's locks 2 minutes before it opens (`LOCK_AHEAD`; no request runs that long), so a save can't land as the first votes do.
  - This week can still get a question if it has none: it's an insert, which fails if a row appeared meanwhile.
  - `votedOn` is checked as well, as a second guard.
  - The only other writes to the poll tables are voting itself and the existing undo of a voter's own record when their vote failed to count.
- **Optional database lock**: SQL in the header of api/_poll.js adds two triggers. `poll_locked` stops update or delete of a poll row that has voters; `poll_tally_up` stops tally rows being deleted or lowered. It adds rules only and changes no data. **Not run**; it's the owner's call. Drop the triggers if data ever has to be fixed by hand.
- **School weeks**: `TERMS` and `PLAN_END` (2027-09-24, the end of Term 3, Year 12's last term before the HSC; they sit the exams in Term 4) in api/_poll.js. `schoolWeeks(from)` gives every week with a student day in it: 35 weeks from Term 4 Week 6 2026. 2027 Term 1 Week 1 is staff days only, so the list starts at Week 2. The admin GET returns `schoolWeeks` and `planEnd`. To plan further, add terms and move `PLAN_END`.
- **Batch save**: the `pollbatch` action takes `{ set:[…pollset bodies], remove:[weeks] }` and checks each with `pollSetOne`/`pollDelOne`, up to 4 at a time. It returns `{ results:[{ week, ok, error, removed }] }`. `pollset`/`polldel` still work.
- **Moderator page** (games.js `renderPolls`, games.css "the planner"):
  - Week picker grouped by term.
  - The form saves into `pollDrafts` as you type; this module-level state survives switching tabs, and leaving the page warns.
  - The list shows every school week with tags (New/Changed, not saved; Removed when you save; Live/Voted on, locked). It has Set/Edit/Undo/Remove, and a sticky bar "N changes not saved yet · Discard · Save N changes".
  - One request saves everything, then the list refreshes once. A week that fails keeps its change and shows why.
  - Live and past weeks have no buttons and a disabled form.
- **Class questions**: subjects are collected after saving, but only for weeks that haven't opened and are in the current year. The next year's cohorts and classes aren't set yet, so the row gets a "Collect subjects" button to use once that year starts.
- The `.preview` mock (local only) now returns `schoolWeeks` and answers `pollbatch`; it needs a restart to pick that up. Tested in headless Chrome with a stand-in API in the page (scratchpad `pollfake.js`/`pollgen.mjs`).

## 8.130 The school holidays on Home: a greeting, when school's back, and the poll looking back (asset version `20261120c`, `CACHE_VERSION` v55)
- **theme.js `TT.schoolBreak(date)`**: the NSW Eastern-division terms (`TERM_DAYS`, the same dates as index.html's and api/_poll.js's tables). It returns `{ name, back, summer }` in the holidays; it returns null in term (weekends included) and past the table. The breaks are named after the term just ended: Autumn, Winter, Spring, Summer holidays. The days before students return, such as staff development days, count as holidays.
- **Home** (home.html `paintHub`):
  - Signed in: the greeting becomes "Happy holidays, …". Christmas Day says "Merry Christmas" and New Year's Day "Happy New Year".
  - The date line says "· Summer holidays" instead of the week letter.
  - The class card becomes "Summer holidays · Back Wednesday 3 Feb · In 5 weeks" (`breakCard`). The timetable's A/B count doesn't know about holidays and would otherwise name a class.
  - Signed out: the line under "Welcome" names the break and the day back.
- **The poll card** (api/_poll.js `breakOf`, `lookbackFor`; poll.js `lookbackHtml`): when there's no question this week and the week is in the holidays, the answer carries `lookback`.
  - It covers every question from the term just ended, or from the whole year over summer, newest first. Each comes with its top two answers for the reader's scope, plus how many of them the reader voted in (their own `poll_voter` rows only).
  - Closed weeks' results are cached for 6 hours per instance.
  - The card: chip "Summer holidays · looking back", title "2026 in polls" or "Term 2 in polls", a facts line, two moments (the closest call and the one with the most votes), and the list with "You picked …" where this device remembers it (`poll.mine.*`, never sent anywhere). It also has "Show all", when the polls are back, "Suggest a question for next term", and "Back in 5 weeks" in the header.
  - A question set for a holiday week still shows as normal. Signed-out visitors get no card in the holidays, as before when no question is set.
- api/_poll.js `TERMS` now includes Term 4 2027, for the spring holidays; the planner still stops at `PLAN_END`.
- Tested with the page's clock moved (scratchpad `holgen.mjs`). Not yet handled: the timetable page itself (and Studio, which opens it as Home) still shows classes and a Now card in the holidays.

## 8.131 Whose timetable? (a new daily game; asset version `20261120d`, `CACHE_VERSION` v56)
Asked for (passed on from a side session): one day of a student's timetable as blank tiles, guess a student from your year, one more thing revealed per wrong guess (about 8 hints, fast like Guess Who). The day must belong to exactly one person, and exactly one person must fit by about the 6th to 8th hint.
- **Server** (`api/_whose.js`, routed by `/api/daily?whose=1`, so no new function):
  - `buildYear` reads every timetable in the year (the roster from `rosterList`, `hasClasses !== false`; 12 at a time, cached per instance for 6 h so a retry carries on). Fewer than ~85% read means it tries again later, with nothing stored. One timetable shared by over a quarter of the year (the API handing back one for everyone) means no puzzle.
  - `makeWhose` is pure and testable offline. Each student's 10 days become a shape (`shapeOf`: periods 0–9, free, class, or the same class as before = a double) and tiles (`tilesOf`: doubles merged; a room or teacher that differs inside a double is dropped).
  - Only days whose full signature (day, shape, every tile's subject, teacher and room) nobody else has are tried, in seeded order, skipping anyone used in the last 40 days.
  - Facts are the weekday, the week, and each tile's subject, teacher and room. `planHints` tries 500 seeded orders of 8 and checks each against every same-shaped day in the year: someone fits if any one of their days fits everything shown so far.
  - It requires exactly one person after hint 8 and nobody uniquely fitting before hint 5, prefers hint 6 or 7, scores a steady narrowing, and prefers a subject or the weekday as the opener. It never ends on the day or week, nor opens with both.
  - The answer is proven theirs by finding them on the roster of one of that day's classes.
  - A year where no day can be made certain (whole roll classes sharing identical timetables) stores `{ none }` for the day, and the page says so.
- **Tables** `whose_puzzle` and `whose_result` (SQL in SETUP.md; **not created yet**: the user runs it). Until then the game says it isn't set up yet.
- **Nightly**: a second cron in vercel.json, `/api/daily-generate?whose=1` at 14:20 UTC, builds every year (`prebuildWhose`); a year it doesn't reach is built by its first player, which takes a few seconds.
- **Page** (games.js `BUILD.whose`, games.css "Whose timetable?"):
  - The day on the left, with "Which day? · Week ?" and blank tiles that fill in; hints, guess and Skip on the right. The newest fill is lit briefly (none with Reduce motion).
  - A name not in your year doesn't cost a guess. Guesses are marked locally and saved in the background, as in Daily Guess Who; also streak, Results (played, solved, guess histogram) and `markDay('whose')`.
  - Added to `GAMES` (Timetable, after Daily Guess Who), icons.js (`table`, teal), Home's Today strip (three games: three across, or two and one on a phone, via `--td` in site.css), and What's new.
- **Tested offline** (scratchpad `whose_test.mjs`, made-up years only):
  - Senior years on lines (150 and 220 students): 12 of 12 days made, unique first at hint 6 (mostly), 5 or 7; about 30–40 ms.
  - Junior with electives: 12 of 12.
  - Junior where classes share identical timetables: none, as it should be.
  - The page was tested in headless Chrome with a stand-in API. Never run on real timetables.
- Not done: an archive of past days (the route accepts `date` for the last 30 days, the page only plays today), a spotlight in Results, a share line.
- Results' bars show who's in each on hover, as Daily Guess Who's do: the summary returns `names` per guess count and `lost` (display names, 40 per bar). Asset version `20261120e`, v57.

## 8.132 Whose timetable?, redesigned: the whole fortnight, a plain count, easier (asset version `20261120f`, `CACHE_VERSION` v58)
The user found 8.131 much too hard and agreed a new design (through the side session). The first version's days needn't be kept. 8.131's server notes are replaced by these; the tables, routes, cron and Home strip are unchanged.
- **Board**: the answer's whole fortnight. Week A over Week B on wide screens, two tabs under 640px. A new hint's tiles light up, and on a phone the tab moves to them.
  - It starts as the school's grid: every period a grey rectangle at its bell time (`/api/timetable/bell-times`, `readBells`; Type O or R is not a teaching period). Breaks are gaps, and free periods look the same as the rest, so the first guess is blind.
  - The template (`templateOf`) is the same for everyone: a bell-time teaching period, or a period a sixth of the year has a class in (sport); times fall back to the commonest row times.
  - Shown tiles carry the subject in its colour (hashed into 12 colours) or an outlined "Free".
- **Count**: "N students still fit", plain. The guess box only suggests those who still fit and haven't been guessed (`Suggest` with a function source).
- **Hints** (`planFor`), in a fixed order of kinds, details picked per day. There are no room hints, and a board hint never re-shows a tile (the slot and day hints must show 3 or more new tiles).
  1. how many subjects they take
  2. the classes you share with them (each player's own, `whoseView`; never counted on for certainty)
  3. every lesson of their most common subject (juniors, median 9+ subjects: a pair of common ones)
  4. one period on every day
  5. a whole day
  6. every lesson of a rarer subject (rarest first)
  7. a teacher who has them more than once ("teaches two of their classes"), else a double on a day, else any teacher
  8. all their free periods
- **Certainty**: everyone is checked over the whole fortnight (`fits`, `profileOf`). Exactly one person must fit after hint 6 (the third from last), more than one after hint 1, and best is first fitting at hint 5 or 6 (4 fine, 3 at a push). Only people whose whole grid is unique are tried.
- **Stored puzzle (v2)**: `template`, the answer's `cells`, `hints`, `counts`, `fit` (who fits after each hint, as indices), `people` (emails, server-only), `codes`/`pc` (each person's class codes, for hint 2) and `classes` (the answer's code → subject).
  - The browser gets `whoseView`: names (never emails), the board, `fit`, `shareAt`/`shareFit` for the player, and the hint texts.
  - A first-version day for today is rebuilt and overwritten (`ensureWhose`, with `created_at` reset); a result saved before that counts as not started, and the day's results ignore it. Nothing is deleted.
- **Tested offline** (made-up years, scratchpad `whose_test.mjs`, `whose_fake2.mjs`): senior on lines (150 and 220 students) 12 of 12, one person first fitting at hint 4 mostly, otherwise 5; junior with electives 12 of 12 at hint 5; junior with identical class timetables: none. About 15 ms per day.
- The page was shot in headless Chrome with a stand-in API: wide, phone and dark. Never run on real timetables or bell times.
