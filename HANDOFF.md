# Handoff — adding a database (sync, daily Guess Who, realtime)

You're picking up an existing, working school-timetable web app. The owner (Alex)
wants to add server-side state in three phases. This doc is everything you need to
do it without the prior conversation. A visual version of the plan lives at
<https://claude.ai/code/artifact/6466d2e1-a842-4f5e-b19e-d59a33dfcf04>.

> **STATUS (2026-09-01):** Phases 0, 1 **and 2** are **built** and browser-tested
> against mocks:
> - Phase 1 (settings sync): `api/_supabase.js`, `api/prefs.js`, exported auth
>   helpers in `api/timetable.js`, sync client in `theme.js` / `index.html`.
> - Phase 2 (daily Guess Who): `api/_daily.js`, `api/daily.js`,
>   `api/daily-generate.js`, `vercel.json` cron, `fetchAsOwner` in
>   `api/timetable.js`, and `BUILD.dailyguess` + `TT.api` on the client.
> - Shared weekly Tetris leaderboard: `api/tetris.js` + `BUILD.tetris` — the
>   same whoami-verified, service-role pattern (table `tetris_score`).
>
> What remains is **provisioning** (create the Supabase project, run the `prefs`,
> `daily_puzzle`, `daily_result`, `tetris_score` table SQL, set `SUPABASE_URL` +
> `SUPABASE_SERVICE_ROLE_KEY`, optionally `CRON_SECRET`, redeploy) — all in
> SETUP.md. **Phase 3 (realtime boards/multiplayer) is still unbuilt**; the
> sections below are its plan. The realtime-token bridge there is the natural
> next build, and a shared Tetris weekly leaderboard would reuse the same pattern.

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
