/*
 * GET /api/timetable?email=<username or full address>
 *
 * Authenticates against the school API with server-side credentials, then
 * fetches the timetable, bell times, cycle start date and profile and returns
 * them as one JSON payload.
 *
 * The JWT is cached in module scope (survives warm invocations) and refreshed
 * from its own `exp` claim. It is never included in the response — the browser
 * only ever sees timetable data.
 *
 * Environment variables (set in Vercel → Settings → Environment Variables):
 *   SCHOOL_EMAIL      required  e.g. your.name1@education.nsw.gov.au
 *   SCHOOL_PASSWORD   required  your school password
 *   SCHOOL_API_BASE   required  https://intranet.nbscmanlys-h.schools.nsw.edu.au
 *   SCHOOL_TOKEN_PATH optional  default: /api/token
 *   ALLOWED_ORIGIN    optional  comma-separated origins allowed to call this
 *                               (default: the GitHub Pages origin below)
 *   ALLOWED_EMAILS    optional  comma-separated usernames/addresses that may be
 *                               looked up. Unset = anyone may look up anyone.
 *   EMAIL_DOMAIN      optional  default: the domain of SCHOOL_EMAIL
 */

const DEFAULT_ORIGIN = "https://alexburns2.github.io";
const LOCAL_PREVIEW_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000"
];
const TOKEN_SKEW_MS = 60 * 60 * 1000;   // refresh an hour before expiry

/* One cached token per account. Visitors may supply their own credentials,
   in which case their timetable is fetched under their own login rather than
   the site owner's. Keyed by email so the two never mix. */
const tokenCache = new Map();            // email -> { token, type, exp }

/* ------------------------------------------------------------------ utils */

export function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function normaliseEmail(input, domain) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  const user = raw.includes("@") ? raw.split("@")[0] : raw;
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(user)) return "";   // reject path tricks
  return `${user}@${domain}`;
}

function listEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/* --------------------------------------------------------------- school API */

/*
 * The Department takes school intranets down for maintenance by redirecting
 * every request to its outage page (education.nsw.gov.au/error/outage-notice
 * .html, "We're currently performing maintenance…"). fetch follows that
 * redirect, so spot it by where the response ended up, or by the page itself,
 * and say so plainly instead of blaming the site's settings.
 */
export const OUTAGE_MESSAGE = "The school's system is down for maintenance. Try again later.";
export function isOutage(res, body) {
  return !!(res && res.redirected && /outage|maintenance/i.test(String(res.url || ""))) ||
         /outage-notice|performing maintenance/i.test(String(body || "").slice(0, 20000));
}
/* A failed sign-in check. Anything the school actually said no to stays "not
   accepted"; the school being down or unreachable is reported as that, so
   nobody is told their password is wrong during an outage. */
function signInFailed(res, e) {
  const down = e && (e.hint === "school-outage" || e.hint === "check-api-base" || e.hint === "bad-json");
  if (!down) return res.status(401).json({ error: "Those school sign-in details were not accepted." });
  return res.status(e.status === 503 ? 503 : 502).json({ error: e.message, hint: e.hint });
}
function outageError() {
  const err = new Error(OUTAGE_MESSAGE);
  err.status = 503;
  err.hint = "school-outage";
  return err;
}

/*
 * Read a response as JSON, but explain clearly when it is not JSON.
 * The school intranet answers some misconfigurations with an HTML page and a
 * 200, so `res.json()` alone produces a useless "Unexpected token '<'" error.
 */
async function readJson(res, url) {
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    if (isOutage(res, body)) {
      console.error(`School outage: ${url} ended at ${res.url || "?"} (status ${res.status}).`);
      throw outageError();
    }
    const looksHtml = /^\s*<(!doctype|html)/i.test(body);
    console.error(
      `Expected JSON from ${url} but got ${looksHtml ? "an HTML page" : "unparseable data"}. ` +
      `status=${res.status} content-type=${res.headers.get("content-type") || "none"} ` +
      `first bytes: ${JSON.stringify(body.slice(0, 120))}`
    );
    const err = new Error(
      looksHtml
        ? "The school API returned a web page instead of JSON. Check that SCHOOL_API_BASE is the intranet origin with no trailing path."
        : "The school API returned a response that could not be parsed as JSON."
    );
    err.status = 502;
    err.hint = looksHtml ? "check-api-base" : "bad-json";
    throw err;
  }
}

export async function getToken(apiBase, emailAddress, password) {
  const now = Date.now();
  const key = String(emailAddress).toLowerCase();
  const hit = tokenCache.get(key);
  if (hit && hit.exp * 1000 - TOKEN_SKEW_MS > now) return hit;

  /* The intranet serves its SPA shell (200 + HTML) for unknown paths, so a wrong
     path looks like success. Auth lives at /api/token; /token is the SPA. */
  const url = `${apiBase}${process.env.SCHOOL_TOKEN_PATH || "/api/token"}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ emailAddress, password })
    });
  } catch (e) {
    console.error(`Could not reach ${url}: ${e.message}`);
    const err = new Error("Couldn't reach the school's system. It may be down; try again later.");
    err.status = 502;
    err.hint = "check-api-base";
    throw err;
  }

  if (!res.ok) {
    if (isOutage(res, await res.text().catch(() => ""))) throw outageError();
    console.error(`POST ${url} returned ${res.status}.`);
    const err = new Error(
      res.status === 401
        ? "The school rejected those sign-in details."
        : `School authentication failed (${res.status}).`
    );
    err.status = 502;
    err.hint = res.status === 401 ? "check-credentials" : "auth-failed";
    throw err;
  }

  const data = await readJson(res, url);
  const token = data && data.token;
  if (!token) {
    const err = new Error("School API did not return a token.");
    err.status = 502;
    throw err;
  }

  const payload = decodeJwtPayload(token);
  const entry = {
    email: key,
    token,
    type: data.type || "Bearer",
    exp: (payload && payload.exp) || Math.floor(Date.now() / 1000) + 3600
  };
  tokenCache.set(key, entry);
  return entry;
}

async function apiGet(apiBase, path, auth, retry = true) {
  let res;
  try {
    res = await fetch(apiBase + path, {
      method: "GET",
      headers: { Authorization: `${auth.type} ${auth.token}`, Accept: "application/json" }
    });
  } catch (e) {
    console.error(`Could not reach ${apiBase + path}: ${e.message}`);
    const err = new Error("Couldn't reach the school's system. It may be down; try again later.");
    err.status = 502;
    err.hint = "check-api-base";
    throw err;
  }

  if (isOutage(res)) throw outageError();
  if (res.status === 401 && retry) {
    tokenCache.delete(String(auth.email || '').toLowerCase());   // force a re-login
    return null;                                                 // caller retries
  }
  if (!res.ok) {
    if (isOutage(res, await res.text().catch(() => ""))) throw outageError();
    const err = new Error(`School API returned ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }

  return readJson(res, apiBase + path);
}

/*
 * Fetch a school-API path authenticated as the SERVER's own account
 * (SCHOOL_EMAIL / SCHOOL_PASSWORD), retrying once on a 401. Used by shared,
 * identity-independent jobs like the daily-puzzle generator, which need the
 * directory but aren't tied to any one caller. Returns parsed JSON.
 */
export async function fetchAsOwner(path) {
  const apiBase = (process.env.SCHOOL_API_BASE || "").replace(/\/+$/, "");
  const email = process.env.SCHOOL_EMAIL, password = process.env.SCHOOL_PASSWORD;
  if (!apiBase || !email || !password) throw new Error("Server school credentials are not configured.");
  let auth = await getToken(apiBase, email, password);
  let out = await apiGet(apiBase, path, auth);
  if (out === null) {                       // token expired → refresh and retry
    auth = await getToken(apiBase, email, password);
    out = await apiGet(apiBase, path, auth);
  }
  return out;
}

/* --------------------------------------------------------- student finder */
/* The whole-school student list, read with the server's own login and kept
   for an hour per warm instance. Only students: anyone whose groups name them
   as staff, or whose address is a staff one, is left out. */
let directoryCache = { at: 0, list: null };
const DIRECTORY_TTL_MS = 60 * 60 * 1000;
export function isStudentRecord(r) {
  const groups = Array.isArray(r && r.groups) ? r.groups.map(g => String(g).toLowerCase()) : [];
  const mail = String((r && (r.emailAddress || r.email || r.Email)) || "").toLowerCase();
  if (groups.some(g => /^(teacher|staff|executive|admin)/.test(g))) return false;
  if (/@det\.nsw\.edu\.au$/.test(mail)) return false;
  return groups.includes("student") || /@education\.nsw\.gov\.au$/.test(mail);
}
export function shapeStudent(r) {
  const first = String(r.firstname || r.firstName || r.FirstName || "").trim();
  const last = String(r.lastname || r.lastName || r.LastName || "").trim();
  const email = String(r.emailAddress || r.email || r.Email || "").trim().toLowerCase();
  const yr = (Array.isArray(r.groups) ? r.groups : []).map(g => String(g).match(/^yr\.?\s*(\d{1,2})$/i)).find(Boolean);
  return { first, last, email, year: yr ? +yr[1] : null };
}
async function studentDirectory() {
  if (directoryCache.list && Date.now() - directoryCache.at < DIRECTORY_TTL_MS) return directoryCache.list;
  const raw = await fetchAsOwner("/api/group/student");
  const arr = Array.isArray(raw) ? raw : ((raw && (raw.people || raw.users || raw.data)) || []);
  const list = arr.filter(isStudentRecord).map(shapeStudent).filter(p => p.email);
  directoryCache = { at: Date.now(), list };
  return list;
}
/* Names are compared folded: lower case, accents off ("Zoë" is "zoe"), and
   also squashed to letters and digits so "obrien" finds O'Brien and
   "smithjones" finds Smith-Jones. */
const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const squash = s => s.replace(/[^a-z0-9]/g, "");
/* What was typed, as words: "Smith, John" is two words, and a pasted email
   address is just its user name. */
export function queryWords(q) {
  let s = fold(q);
  if (s.includes("@")) s = s.split("@")[0];
  return s.replace(/[,;]+/g, " ").split(/\s+/).filter(Boolean);
}
function nameParts(p) {
  const first = fold(p.first), last = fold(p.last), user = p.email.split("@")[0];
  const bits = s => s.split(/[\s'’.-]+/).filter(Boolean);
  return { first, last, parts: [first, last, user, ...bits(first), ...bits(last), ...bits(user),
                                squash(first), squash(last)] };
}
const wordHits = (parts, w) => parts.some(x => x.startsWith(w)) ||
                               (squash(w) !== "" && parts.some(x => x.startsWith(squash(w))));
const shapeResult = p => ({
  name: [p.first, p.last].filter(Boolean).join(" ") || p.email.split("@")[0],
  email: p.email,
  year: p.year
});
/* Every word typed has to start a first name, a last name or the email user
   name, in any order ("sam t" and "taylor, sam" both find Sam Taylor).
   Ranked: the whole name starts with the search (either way round), then
   first-name matches, then last-name matches, then everything else. */
export function searchStudents(list, q, max) {
  const words = queryWords(q), joined = words.join(" ");
  if (!words.length) return [];
  const scored = [];
  for (const p of list) {
    const { first, last, parts } = nameParts(p);
    if (!words.every(w => wordHits(parts, w))) continue;
    const full = (first + " " + last).trim();
    const score = full.startsWith(joined) || (last + " " + first).startsWith(joined) ? 0
                : first.startsWith(words[0]) ? 1 : last.startsWith(words[0]) ? 2 : 3;
    scored.push({ p, score, full });
  }
  scored.sort((a, b) => a.score - b.score || a.full.localeCompare(b.full));
  return scored.slice(0, max).map(({ p }) => shapeResult(p));
}
/* When nothing matches every word, the people who match all but one of them:
   a middle name the school doesn't have ("John Michael Smith"), or one word
   misspelt ("jon smith" still finds the Smiths). Needs two words or more, so a
   one-word typo never turns into a list of strangers. */
export function closeStudents(list, q, max) {
  const words = queryWords(q);
  if (words.length < 2) return [];
  const scored = [];
  for (const p of list) {
    const { first, last, parts } = nameParts(p);
    const hits = words.filter(w => wordHits(parts, w)).length;
    if (hits >= words.length - 1) scored.push({ p, miss: words.length - hits, full: first + " " + last });
  }
  scored.sort((a, b) => a.miss - b.miss || a.full.localeCompare(b.full));
  return scored.slice(0, max).map(({ p }) => shapeResult(p));
}

/* ------------------------------------------------------ free-period finder */
/* Which periods of the fortnight someone has a class in, as "mona|3" keys —
   nothing about what the class is, where, or who takes it. Kept for six hours
   per warm instance, so a page of classmates doesn't re-read the school API. */
const busyCache = new Map();             // email -> { at, busy }
const BUSY_TTL_MS = 6 * 60 * 60 * 1000;
export const FREE_MAX = 25;
export function busyKeys(timetable) {
  const arr = Array.isArray(timetable) ? timetable
    : ((timetable && (timetable.timetable || timetable.entries || timetable.data)) || []);
  const out = new Set();
  for (const r of Array.isArray(arr) ? arr : []) {
    const day = String((r && (r.DayName || r.dayName)) || "").trim().toLowerCase();
    const per = String((r && (r.Period ?? r.period)) ?? "").trim().toLowerCase()
      .replace(/^(?:period\s*|p)(\d+)$/, "$1");
    if (!/^(mon|tue|wed|thu|fri)[ab]$/.test(day) || !per) continue;
    out.add(day + "|" + per);
  }
  return [...out].sort();
}
async function busyFor(apiBase, authEmail, pw, who) {
  const hit = busyCache.get(who);
  if (hit && Date.now() - hit.at < BUSY_TTL_MS) return hit.busy;
  const path = `/api/timetable/${encodeURIComponent(who)}`;
  let auth = await getToken(apiBase, authEmail, pw);
  let tt = await apiGet(apiBase, path, auth);
  if (tt === null) {                       // token expired → refresh and retry
    auth = await getToken(apiBase, authEmail, pw);
    tt = await apiGet(apiBase, path, auth);
  }
  if (!tt) throw new Error("No timetable for " + who);
  const busy = busyKeys(tt);
  if (busyCache.size >= 3000) busyCache.clear();
  busyCache.set(who, { at: Date.now(), busy });
  return busy;
}
/* run fn over items, at most n at a time */
async function eachLimited(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

/* ------------------------------------------------------------------ handler */

export default async function handler(req, res) {
  const allowed = listEnv("ALLOWED_ORIGIN");
  const origins = [...new Set([...(allowed.length ? allowed : [DEFAULT_ORIGIN]), ...LOCAL_PREVIEW_ORIGINS])];
  const origin = String(req.headers.origin || "").toLowerCase();

  res.setHeader("Vary", "Origin");
  if (origins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  else res.setHeader("Access-Control-Allow-Origin", origins[0]);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",
                "Content-Type, X-School-Email, X-School-Password");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const schoolEmail = process.env.SCHOOL_EMAIL;
  const password = process.env.SCHOOL_PASSWORD;
  const apiBase = (process.env.SCHOOL_API_BASE || "").replace(/\/+$/, "");

  if (!schoolEmail || !password || !apiBase) {
    console.error("Missing SCHOOL_EMAIL / SCHOOL_PASSWORD / SCHOOL_API_BASE.");
    return res.status(500).json({ error: "Server authentication is not configured." });
  }

  /* ---- ?diag=1 -----------------------------------------------------------
   * Probes the school API with DUMMY credentials and reports what comes back,
   * so a misconfigured base URL or a moved token path is visible in one call.
   * Never echoes SCHOOL_EMAIL / SCHOOL_PASSWORD or any real token.
   */
  if (req.query.diag) {
    const paths = [process.env.SCHOOL_TOKEN_PATH, "/api/token", "/token",
                   "/api/auth/token", "/auth/token", "/api/login"].filter(Boolean);
    const seen = new Set();
    const probes = [];
    for (const path of paths) {
      if (seen.has(path)) continue;
      seen.add(path);
      try {
        const r = await fetch(apiBase + path, {
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ emailAddress: "probe@example.invalid", password: "probe" })
        });
        const body = await r.text().catch(() => "");
        const ct = r.headers.get("content-type") || "none";
        const isHtml = /^\s*<(!doctype|html)/i.test(body);
        console.error(`diag ${path}: status=${r.status} ct=${ct} location=${r.headers.get("location") || "-"} first=${JSON.stringify(body.slice(0,200))}`);
        probes.push({ path, status: r.status, contentType: ct,
                      redirectsTo: r.headers.get("location") || null,
                      isHtml, looksJson: /json/i.test(ct) || /^\s*[{[]/.test(body),
                      bytes: body.length });
      } catch (e) {
        console.error(`diag ${path}: unreachable ${e.message}`);
        probes.push({ path, error: e.message });
      }
    }
    return res.status(200).json({
      apiBase,
      env: { SCHOOL_EMAIL: !!schoolEmail, SCHOOL_PASSWORD: !!password,
             SCHOOL_API_BASE: !!apiBase, ALLOWED_ORIGIN: !!process.env.ALLOWED_ORIGIN,
             SCHOOL_TOKEN_PATH: process.env.SCHOOL_TOKEN_PATH || null },
      probes,
      note: "A real token endpoint answers dummy credentials with JSON (usually 400/401). isHtml:true means that path serves a web page."
    });
  }

  /* Own-credentials mode: sent as headers rather than query params so they
     never land in a URL, a log line or a Referer. Used for this request only
     and never written anywhere. */
  const ownEmail = String(req.headers["x-school-email"] || "").trim();
  const ownPassword = String(req.headers["x-school-password"] || "");
  const usingOwn = !!(ownEmail && ownPassword);

  const domain = (process.env.EMAIL_DOMAIN || schoolEmail.split("@")[1] || "").toLowerCase();
  const authEmail = usingOwn ? normaliseEmail(ownEmail, domain) : schoolEmail;
  if (usingOwn && !authEmail) {
    return res.status(400).json({ error: "That sign-in address is not valid." });
  }
  /* With your own login, the timetable fetched is your own by default. */
  const email = normaliseEmail(req.query.email || authEmail, domain);
  if (!email) return res.status(400).json({ error: "A valid email address is required." });

  /* The allowlist protects the owner's account; it does not apply to someone
     signing in with their own credentials. */
  const allowlist = listEnv("ALLOWED_EMAILS");
  if (!usingOwn && allowlist.length) {
    const ok = allowlist.some(e => normaliseEmail(e, domain) === email);
    if (!ok) return res.status(403).json({ error: "That address is not permitted on this site." });
  }

  /* ---- ?find=<name> ------------------------------------------------------
   * Student finder. Unlike the class and group lists below, this one needs the
   * caller's OWN working school login: it searches every student in the school
   * (Years 7–12, so mostly minors), so it is only for people who can sign in to
   * the school's own system. It hands back matches only — at most 20, for a
   * search of at least two letters — never the whole list, and nothing it
   * returns is cached on the way out. Students only: staff are never included.
   */
  if (req.query.find !== undefined) {
    res.setHeader("Cache-Control", "private, no-store");
    if (!usingOwn) {
      return res.status(401).json({ error: "Sign in with your school account to use the student finder." });
    }
    try { await getToken(apiBase, authEmail, ownPassword); }
    catch (e) { return signInFailed(res, e); }
    const q = String(req.query.find || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (q.length < 2) return res.status(400).json({ error: "Type at least two letters." });
    const yr = parseInt(req.query.year, 10);
    try {
      let people = await studentDirectory();
      if (yr >= 7 && yr <= 12) people = people.filter(p => p.year === yr);   // before the cap, so it hides nothing
      let results = searchStudents(people, q, 20), close = false;
      if (!results.length) { results = closeStudents(people, q, 20); close = results.length > 0; }
      return res.status(200).json({ query: q, results, close });
    } catch (error) {
      console.error("Student finder failed:", error.message);
      return res.status(error.status === 503 ? 503 : 502).json({
        error: error.hint === "school-outage" ? error.message : "Unable to search the school directory right now." });
    }
  }

  /* ---- ?free=<user>,<user>,… ---------------------------------------------
   * Free-period finder. For each person named, only the periods they have a
   * class in ("mona|3" …) — no subjects, rooms or teachers. Like ?find=, it
   * needs the caller's OWN working school login, it takes at most FREE_MAX
   * people per call, and nothing is cached on the way out. Addresses are
   * forced onto the student domain, so staff can't be asked about. Someone
   * whose timetable can't be read comes back as null, not as "always free".
   */
  if (req.query.free !== undefined) {
    res.setHeader("Cache-Control", "private, no-store");
    if (!usingOwn) {
      return res.status(401).json({ error: "Sign in with your school account to compare free periods." });
    }
    try { await getToken(apiBase, authEmail, ownPassword); }
    catch (e) { return signInFailed(res, e); }
    const wanted = [...new Set(String(req.query.free || "").split(",")
      .map(s => normaliseEmail(s, domain)).filter(Boolean))];
    if (!wanted.length) return res.status(400).json({ error: "Name at least one person." });
    if (wanted.length > FREE_MAX) return res.status(400).json({ error: `At most ${FREE_MAX} people at a time.` });
    const people = {};
    let outage = false;
    await eachLimited(wanted, 5, async who => {
      try { people[who] = await busyFor(apiBase, authEmail, ownPassword, who); }
      catch (error) {
        if (error.hint === "school-outage") outage = true;
        else if (error.hint) console.error("Free periods failed:", error.message);
        people[who] = null;
      }
    });
    /* the school being down is not "nobody's timetable can be read" */
    if (outage) return res.status(503).json({ error: OUTAGE_MESSAGE, hint: "school-outage" });
    return res.status(200).json({ people });
  }

  /* ---- ?class=<code> -----------------------------------------------------
   * Class roster. The school API exposes the students in a class at
   * /api/timetable/class/{ClassCode}. Returned as-is (minus caching), so the
   * page can list who is in a period.
   */
  if (req.query.class) {
    const code = String(req.query.class).trim();
    if (!code) return res.status(400).json({ error: "A class code is required." });
    try {
      let auth = await getToken(apiBase, authEmail, usingOwn ? ownPassword : password);
      let roster = await apiGet(apiBase, `/api/timetable/class/${encodeURIComponent(code)}`, auth);
      if (roster === null) {                              // token expired → retry once
        auth = await getToken(apiBase, authEmail, usingOwn ? ownPassword : password);
        roster = await apiGet(apiBase, `/api/timetable/class/${encodeURIComponent(code)}`, auth);
      }
      res.setHeader("Cache-Control", usingOwn ? "private, no-store"
                                              : "public, s-maxage=900, stale-while-revalidate=3600");
      return res.status(200).json({ class: code, roster });
    } catch (error) {
      const status = error.status || 502;
      console.error("Class roster failed:", error.message);
      return res.status(status).json({
        error: status === 404 ? "No class list was found for that class."
                              : error.hint === "school-outage" ? error.message : "Unable to load the class list from the school API.",
        hint: error.hint || undefined
      });
    }
  }

  /* ---- ?group=student|teacher -------------------------------------------
   * Whole-school directory. /api/group/{student|teacher} returns everyone,
   * used by the Guess Who difficulty picker (grade / school / teachers).
   */
  if (req.query.group) {
    const g = String(req.query.group).toLowerCase();
    if (g !== "student" && g !== "teacher") return res.status(400).json({ error: "Unknown group." });
    try {
      let auth = await getToken(apiBase, authEmail, usingOwn ? ownPassword : password);
      let list = await apiGet(apiBase, `/api/group/${g}`, auth);
      if (list === null) {
        auth = await getToken(apiBase, authEmail, usingOwn ? ownPassword : password);
        list = await apiGet(apiBase, `/api/group/${g}`, auth);
      }
      res.setHeader("Cache-Control", usingOwn ? "private, no-store"
                                              : "public, s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json({ group: g, people: list });
    } catch (error) {
      const status = error.status || 502;
      console.error("Group directory failed:", error.message);
      return res.status(status).json({
        error: status === 404 ? "That directory was not found."
                              : error.hint === "school-outage" ? error.message : "Unable to load the directory from the school API.",
        hint: error.hint || undefined
      });
    }
  }

  try {
    let auth = await getToken(apiBase, authEmail, usingOwn ? ownPassword : password);

    const fetchAll = async a => Promise.all([
      apiGet(apiBase, `/api/timetable/${encodeURIComponent(email)}`, a),
      apiGet(apiBase, "/api/timetable/bell-times", a).catch(() => null),
      apiGet(apiBase, "/api/timetable/settings/start-date", a).catch(() => null),
      apiGet(apiBase, `/api/user/${encodeURIComponent(email)}`, a).catch(() => null)
    ]);

    let [timetable, bellTimes, startDate, profile] = await fetchAll(auth);

    if (timetable === null) {                             // 401 → token refreshed
      auth = await getToken(apiBase, authEmail, usingOwn ? ownPassword : password);
      [timetable, bellTimes, startDate, profile] = await fetchAll(auth);
    }

    if (!timetable) {
      return res.status(502).json({ error: "The school API did not return a timetable." });
    }

    // Cache at the edge briefly so repeat opens don't re-hit the school API.
    res.setHeader("Cache-Control", usingOwn
      ? "private, no-store"                       // never cache a personal login
      : "public, s-maxage=900, stale-while-revalidate=3600");

    return res.status(200).json({ email, timetable, bellTimes, startDate, profile,
                                  ownLogin: usingOwn });
  } catch (error) {
    const status = error.status || 502;
    console.error("Timetable request failed:", error.message, `(apiBase=${apiBase})`);
    // Only surface messages this file authored (they carry a hint and contain no
    // secrets); anything else stays in the logs.
    return res.status(status).json({
      error: status === 404
        ? "No timetable was found for that address."
        : (error.hint ? error.message : "Unable to load the timetable from the school API."),
      hint: error.hint || undefined
    });
  }
}
