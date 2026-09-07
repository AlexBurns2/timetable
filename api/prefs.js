/*
 * GET  /api/prefs   → { data: {tt.*: value, …}, updated_at }
 * PUT  /api/prefs   body {tt.*: value, …}  → { ok: true, updated_at }
 *
 * Per-user settings, keyed by the caller's verified school email. The browser
 * mirrors its `tt.*` localStorage bag here so settings follow the person
 * rather than the device. Nothing here re-implements login: whoami() proves
 * identity from the school credentials already sent for the timetable.
 *
 * Table (Supabase → SQL editor):
 *   create table prefs (
 *     email      text primary key,
 *     data       jsonb not null default '{}',
 *     updated_at timestamptz not null default now()
 *   );
 */

import { db, whoami } from "./_supabase.js";

const ORIGINS = String(process.env.ALLOWED_ORIGIN || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

/* Never store these even if the client sends them: the password, the bulky
   device-local timetable cache, and per-device sync bookkeeping. */
const NEVER_STORE = new Set(["tt.creds", "tt.cache", "tt.syncedat"]);

const MAX_BYTES = 100_000;   // guard against a runaway client bloating the row

export default async function handler(req, res) {
  /* CORS — mirrors timetable.js. Harmless (and unused) when the page and the
     API share an origin on Vercel, but keeps it working if the page is ever
     served from a different origin. */
  const origin = String(req.headers.origin || "").toLowerCase();
  res.setHeader("Vary", "Origin");
  if (ORIGINS.length) {
    res.setHeader("Access-Control-Allow-Origin",
      ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",
                "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) {
    return res.status(503).json({ error: "Settings sync is not configured on the server." });
  }

  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in with your school account to sync settings." });

  if (req.method === "GET") {
    const { data, error } = await db.from("prefs")
      .select("data, updated_at").eq("email", me.email).maybeSingle();
    if (error) {
      console.error("prefs GET:", error.message);
      return res.status(502).json({ error: "Could not read your settings." });
    }
    return res.status(200).json(data || { data: {}, updated_at: null });
  }

  if (req.method === "PUT") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Expected a settings object." });
    }

    const clean = {};
    for (const k of Object.keys(body)) {
      if (k.startsWith("tt.") && !NEVER_STORE.has(k)) clean[k] = body[k];
    }
    if (JSON.stringify(clean).length > MAX_BYTES) {
      return res.status(413).json({ error: "Settings payload is too large." });
    }

    const updated_at = new Date().toISOString();
    const { error } = await db.from("prefs")
      .upsert({ email: me.email, data: clean, updated_at });
    if (error) {
      console.error("prefs PUT:", error.message);
      return res.status(502).json({ error: "Could not save your settings." });
    }
    return res.status(200).json({ ok: true, updated_at });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
