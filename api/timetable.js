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
 *   ALLOWED_ORIGIN    optional  comma-separated origins allowed to call this
 *                               (default: the GitHub Pages origin below)
 *   ALLOWED_EMAILS    optional  comma-separated usernames/addresses that may be
 *                               looked up. Unset = anyone may look up anyone.
 *   EMAIL_DOMAIN      optional  default: the domain of SCHOOL_EMAIL
 */

const DEFAULT_ORIGIN = "https://alexburns2.github.io";
const TOKEN_SKEW_MS = 60 * 60 * 1000;   // refresh an hour before expiry

let cachedToken = null;                  // { token, type, exp }  exp = seconds

/* ------------------------------------------------------------------ utils */

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normaliseEmail(input, domain) {
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

async function getToken(apiBase, emailAddress, password) {
  const now = Date.now();
  if (cachedToken && cachedToken.exp * 1000 - TOKEN_SKEW_MS > now) {
    return cachedToken;
  }

  const res = await fetch(`${apiBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ emailAddress, password })
  });

  if (!res.ok) {
    const err = new Error(`School authentication failed (${res.status}).`);
    err.status = res.status === 401 ? 502 : res.status;
    throw err;
  }

  const data = await res.json();
  const token = data && data.token;
  if (!token) {
    const err = new Error("School API did not return a token.");
    err.status = 502;
    throw err;
  }

  const payload = decodeJwtPayload(token);
  cachedToken = {
    token,
    type: data.type || "Bearer",
    exp: (payload && payload.exp) || Math.floor(Date.now() / 1000) + 3600
  };
  return cachedToken;
}

async function apiGet(apiBase, path, auth, retry = true) {
  const res = await fetch(apiBase + path, {
    method: "GET",
    headers: { Authorization: `${auth.type} ${auth.token}`, Accept: "application/json" }
  });

  if (res.status === 401 && retry) {
    cachedToken = null;                                   // force a re-login
    return null;                                          // caller retries
  }
  if (!res.ok) {
    const err = new Error(`School API returned ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const err = new Error("School API returned a non-JSON response.");
    err.status = 502;
    throw err;
  }
  return res.json();
}

/* ------------------------------------------------------------------ handler */

export default async function handler(req, res) {
  const allowed = listEnv("ALLOWED_ORIGIN");
  const origins = allowed.length ? allowed : [DEFAULT_ORIGIN];
  const origin = String(req.headers.origin || "").toLowerCase();

  res.setHeader("Vary", "Origin");
  if (origins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  else res.setHeader("Access-Control-Allow-Origin", origins[0]);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const schoolEmail = process.env.SCHOOL_EMAIL;
  const password = process.env.SCHOOL_PASSWORD;
  const apiBase = (process.env.SCHOOL_API_BASE || "").replace(/\/+$/, "");

  if (!schoolEmail || !password || !apiBase) {
    console.error("Missing SCHOOL_EMAIL / SCHOOL_PASSWORD / SCHOOL_API_BASE.");
    return res.status(500).json({ error: "Server authentication is not configured." });
  }

  const domain = (process.env.EMAIL_DOMAIN || schoolEmail.split("@")[1] || "").toLowerCase();
  const email = normaliseEmail(req.query.email || schoolEmail, domain);
  if (!email) return res.status(400).json({ error: "A valid email address is required." });

  const allowlist = listEnv("ALLOWED_EMAILS");
  if (allowlist.length) {
    const ok = allowlist.some(e => normaliseEmail(e, domain) === email);
    if (!ok) return res.status(403).json({ error: "That address is not permitted on this site." });
  }

  try {
    let auth = await getToken(apiBase, schoolEmail, password);

    const fetchAll = async a => Promise.all([
      apiGet(apiBase, `/api/timetable/${encodeURIComponent(email)}`, a),
      apiGet(apiBase, "/api/timetable/bell-times", a).catch(() => null),
      apiGet(apiBase, "/api/timetable/settings/start-date", a).catch(() => null),
      apiGet(apiBase, `/api/user/${encodeURIComponent(email)}`, a).catch(() => null)
    ]);

    let [timetable, bellTimes, startDate, profile] = await fetchAll(auth);

    if (timetable === null) {                             // 401 → token refreshed
      auth = await getToken(apiBase, schoolEmail, password);
      [timetable, bellTimes, startDate, profile] = await fetchAll(auth);
    }

    if (!timetable) {
      return res.status(502).json({ error: "The school API did not return a timetable." });
    }

    // Cache at the edge briefly so repeat opens don't re-hit the school API.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

    return res.status(200).json({ email, timetable, bellTimes, startDate, profile });
  } catch (error) {
    const status = error.status || 502;
    console.error("Timetable request failed:", error.message);
    return res.status(status).json({
      error: status === 404
        ? "No timetable was found for that address."
        : "Unable to load the timetable from the school API."
    });
  }
}
