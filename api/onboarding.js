/*
 * GET  /api/onboarding            → { seen: ["email","week",…], updatedAt }
 * POST /api/onboarding {seen:[…]} → merges those step ids in, returns the union
 * GET  /api/onboarding?all=1      → { users:[{email, seen, updatedAt}] }  owner only
 *
 * Which parts of the site a person has already been shown, so a tutorial only
 * ever appears the first time. Kept server-side rather than in localStorage so
 * it follows you to a new phone or a school computer, and so the roster below
 * can show how far people actually get before they stop.
 *
 * Step ids are merged, never replaced: two devices doing different tours at the
 * same time both keep their progress, and nothing can un-see a step.
 *
 * Table (Supabase → SQL editor):
 *   create table onboarding (
 *     email      text primary key,
 *     seen       jsonb not null default '[]',
 *     updated_at timestamptz not null default now()
 *   );
 */

import { db, whoami } from "./_supabase.js";

const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();

/* The full tour, in the order people meet it. The roster reports progress
   against this list, so keep it in step with tour.js. */
export const STEPS = [
  "email", "week", "weekarrows", "settings", "home",
  "appearance", "settings-more", "games-scroll"
];
const KNOWN = new Set(STEPS);
const MAX_SEEN = 40;   // a client can only ever send ids we recognise anyway

const readSeen = v => (Array.isArray(v) ? v : []).filter(s => typeof s === "string");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "Onboarding is not configured on the server." });
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to track your progress." });
  const email = String(me.email).toLowerCase();

  /* ---- the roster, for the owner's admin panel ---- */
  if (req.method === "GET" && req.query && req.query.all) {
    if (!OWNER_EMAIL || email !== OWNER_EMAIL)
      return res.status(403).json({ error: "Owner only." });
    const { data, error } = await db.from("onboarding")
      .select("email, seen, updated_at").limit(2000);
    if (error) {
      console.error("onboarding roster:", error.message);
      return res.status(502).json({ error: "Could not read onboarding." });
    }
    return res.status(200).json({
      steps: STEPS,
      users: (data || []).map(r => ({
        email: r.email, seen: readSeen(r.seen), updatedAt: r.updated_at
      }))
    });
  }

  if (req.method === "GET") {
    const { data, error } = await db.from("onboarding")
      .select("seen, updated_at").eq("email", email).maybeSingle();
    if (error) {
      console.error("onboarding GET:", error.message);
      return res.status(502).json({ error: "Could not read your progress." });
    }
    return res.status(200).json({
      seen: readSeen(data && data.seen), updatedAt: (data && data.updated_at) || null
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const incoming = readSeen(body && body.seen).filter(s => KNOWN.has(s));

  const { data: row } = await db.from("onboarding")
    .select("seen").eq("email", email).maybeSingle();
  const merged = [...new Set([...readSeen(row && row.seen), ...incoming])].slice(0, MAX_SEEN);

  /* nothing new to write: skip the round trip rather than bump updated_at */
  if (row && merged.length === readSeen(row.seen).length)
    return res.status(200).json({ seen: merged });

  const { error } = await db.from("onboarding")
    .upsert({ email, seen: merged, updated_at: new Date().toISOString() });
  if (error) {
    console.error("onboarding POST:", error.message);
    return res.status(502).json({ error: "Could not save your progress." });
  }
  return res.status(200).json({ seen: merged });
}
