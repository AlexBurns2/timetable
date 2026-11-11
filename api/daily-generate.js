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
import { prebuildQuartets } from "./_connroute.js";
import { displayNames, refreshRosterCache, checkSomeClasses } from "./_names.js";

/* making six years of Quartets reads a lot of timetables */
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!db) return res.status(503).json({ error: "not configured" });

  const date = sydneyDate(), started = Date.now();
  const out = {}, quartets = {};
  /* first, the copy of the student directory every route reads its names and years from */
  let roster;
  try { roster = await refreshRosterCache(); } catch (e) { roster = "skip"; console.error("roster cache:", e.message); }
  /* then who actually has classes, a batch a night (people with none are left out of the games) */
  let checked;
  try { checked = await checkSomeClasses(10000); } catch (e) { checked = "skip"; console.error("class check:", e.message); }
  for (const year of ["7", "8", "9", "10", "11", "12"]) {
    try { await ensurePuzzle(db, year, date); out[year] = "ok"; }
    catch (e) { out[year] = "skip"; console.error(`daily-generate ${year}:`, e.message); }
  }
  /* Quartets too, two years at a time; any year not reached in time is simply
     made by its first player, as before */
  const NAMES = await displayNames();
  const years = ["12", "11", "10", "9", "8", "7"];
  const one = async () => { while (years.length && Date.now() - started < 45000) { const y = years.shift();
    try { quartets[y] = await prebuildQuartets(y, date, NAMES); } catch (e) { quartets[y] = "skip"; console.error(`quartets ${y}:`, e.message); } } };
  await Promise.all([one(), one()]);
  years.forEach(y => quartets[y] = "later");
  res.status(200).json({ date, roster, checked, generated: out, quartets });
}
