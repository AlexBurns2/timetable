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

In `index.html`, near the top of the `<script>`:

```js
const CONFIG = {
  ENDPOINT: "https://YOUR-PROJECT.vercel.app/api/timetable",
  EMAIL_DOMAIN: "education.nsw.gov.au"
};
```

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

To change it later: ⚙ → School email.

---

## Appearance

⚙ → Appearance. Six skins, each with its own typeface and treatment:

| Skin | Look |
|---|---|
| **Notebook** | Ruled paper, lessons as taped-on post-it notes, handwriting (Caveat / Patrick Hand) |
| **Glass** | Frosted translucent tiles over a colour mesh, Space Grotesk |
| **Swiss** | Stark white, hairline rules, coloured top bars, no shadows |
| **Terminal** | Phosphor-green CRT with scanlines and `>` prompts, JetBrains Mono |
| **Blueprint** | Navy drafting grid, dashed outlines, Space Mono |
| **Brutal** | Yellow ground, 3px black borders, hard offset shadows, Archivo Black |

Notebook, Glass, Swiss and Brutal have light and dark variants; Terminal and
Blueprint have one fixed palette each (the light/dark buttons grey out).

Subject colours are editable per subject and stored per device.

Clicking any lesson opens a detail sheet with the room, teacher, period, the
**class code** (`11PHYS A3`) and the original unabbreviated subject name — the
things stripped from the card to keep it readable.

---

## Troubleshooting

The function reports the *resolved URL* and the first bytes of any bad response
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

### `The school rejected SCHOOL_EMAIL / SCHOOL_PASSWORD`

Exactly what it says — the credentials failed at `/token`. Retype them in Vercel
(watch for a trailing space) and redeploy.

### `Could not reach the school API`

DNS or network failure reaching `SCHOOL_API_BASE`. Usually a typo in the host.

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
