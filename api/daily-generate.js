/*
 * POST/GET /api/daily-generate  — invoked by the Vercel cron once a day to
 * pre-build each year's puzzle so the first player of the day doesn't wait for
 * the directory fetch. Because /api/daily generates lazily too (and the pick is
 * deterministic), this is an optimisation, not a requirement.
 *
 * Guarded by CRON_SECRET: Vercel cron sends `Authorization: Bearer <secret>`
 * automatically when the CRON_SECRET env var is set. If it's unset, the route
 * refuses everything (so it can't be triggered by a stranger).
 */

import { db } from "./_supabase.js";
import { ensurePuzzle, sydneyDate } from "./_daily.js";

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!db) return res.status(503).json({ error: "not configured" });

  const date = sydneyDate();
  const out = {};
  for (const year of ["7", "8", "9", "10", "11", "12"]) {
    try { await ensurePuzzle(db, year, date); out[year] = "ok"; }
    catch (e) { out[year] = "skip"; console.error(`daily-generate ${year}:`, e.message); }
  }
  res.status(200).json({ date, generated: out });
}
