/*
 * GET  /api/prefs   → { data: {tt.*: value, …}, updated_at }
 * PUT  /api/prefs   body {tt.*: value, …}  → { ok: true, updated_at }
 *
 * Revision progress rides the same route (one function fewer on Vercel's
 * limit) but its own table, one row per subject:
 *   GET  /api/prefs?rev=chem   → { subject, data, updated_at }
 *   GET  /api/prefs?rev=*      → { subjects: { chem: {...}, … } }
 *   PUT  /api/prefs?rev=chem   body { "<question sig>": [...], … }
 * It is kept out of the settings blob on purpose: one entry per question is
 * ~86 KB for the Year 11 subjects alone, and the 100 KB guard below would
 * then reject the whole payload, stopping every other setting from syncing.
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
/* revision progress is one entry per question, so it needs far more room than
   the settings blob; still bounded so a bug can't fill the table */
const MAX_REV_BYTES = 400_000;
const SUBJECT_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

/* the revision_progress table may not exist yet (see SETUP.md). Treat that as
   "nothing saved" rather than an error, so the site works until it is created. */
async function revRead(email, subject) {
  let q = db.from("revision_progress").select("subject, data, updated_at").eq("email", email);
  if (subject !== "*") q = q.eq("subject", subject);
  const { data, error } = await q.limit(40);
  if (error) { console.warn("revision progress unavailable:", error.message); return null; }
  return data || [];
}

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

  const rev = typeof req.query.rev === "string" ? req.query.rev : null;

  if (rev !== null) {
    if (rev !== "*" && !SUBJECT_RE.test(rev))
      return res.status(400).json({ error: "Unknown subject." });

    if (req.method === "GET") {
      const rows = await revRead(me.email, rev);
      if (rows === null) return res.status(200).json(rev === "*" ? { subjects: {} } : { subject: rev, data: null, updated_at: null, unavailable: true });
      if (rev === "*") {
        const subjects = {};
        rows.forEach(r => { subjects[r.subject] = r.data || {}; });
        return res.status(200).json({ subjects });
      }
      const row = rows[0];
      return res.status(200).json({ subject: rev, data: row ? row.data : null, updated_at: row ? row.updated_at : null });
    }

    if (req.method === "PUT") {
      if (rev === "*") return res.status(400).json({ error: "Save one subject at a time." });
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return res.status(400).json({ error: "Expected a progress object." });
      if (JSON.stringify(body).length > MAX_REV_BYTES)
        return res.status(413).json({ error: "That subject's progress is too large." });

      const updated_at = new Date().toISOString();
      const { error } = await db.from("revision_progress")
        .upsert({ email: me.email, subject: rev, data: body, updated_at });
      if (error) {
        console.error("revision progress PUT:", error.message);
        return res.status(502).json({ error: "Couldn't save your revision progress. Has the revision_progress table been created?" });
      }
      return res.status(200).json({ ok: true, updated_at });
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

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
