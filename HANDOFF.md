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
> **Tables to create** (SQL in SETUP.md): `prefs`, `daily_puzzle`, `daily_result`,
> `tetris_score`, `zen_score`, `game_score`, `game_state`, `sprint_best`,
> `zen_board`, `shared_deck` (public flashcards), **`forum_post`** (home-page forum).
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
| `home.html` `notes.html` `games.html` | hub, scratchpad, games |
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
- `?diag=1` → connectivity probe (safe to delete later)

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
otherwise. `games.html` is a single self-contained file (all games, one `<script>`);
`home.html` is the hub. All of it is client-side plus the `api/` routes listed.

### 8.1 New / changed API routes

| Route | What it does | Table |
|---|---|---|
| `api/decks.js` | Public flashcard decks — publish, browse by category, import, delete own | `shared_deck` |
| `api/forum.js` | **New.** Home-page forum: threads + one level of replies, delete own (or owner) | `forum_post` |
| `api/leaderboard.js` | Generic arcade boards **+ `?users=1`** (owner-only roster of everyone who has used the site) | `game_score` |
| `api/_daily.js` | Daily Guess Who engine — **hint generation rewritten** (below) | `daily_puzzle` |

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

- Four tiles, then a **forum** (post, reply, relative timestamps, delete your own).
  Styles live in `site.css` under "forum (home page)".
- The old footer ("Theme follows you across every page." + "Back to timetable →")
  is **removed**.
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
- `games.html` has one big inline `<script>`; syntax-check it by extracting the
  script and running it through `new vm.Script(...)` (`node --check` won't take HTML).
- The mock server used for all of this lives in the scratchpad
  (`gamesmock.mjs`, port 8792) and mirrors every `/api/*` route including
  `/api/forum` and `?users=1`. It is not part of the repo — rebuild it if needed.

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
