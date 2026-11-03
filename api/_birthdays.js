/*
 * Birthday register: day and month only (never the year), filled in by anyone
 * signed in, for Year 12 (graduating 2027) and anyone else found by name.
 *
 * Served by /api/calendar (anything with ?birthdays=1 comes here), so it
 * doesn't count as a function of its own: the Hobby plan allows twelve.
 *
 * GET  /api/calendar?birthdays=1                     → { people:[…], birthdays:[…] }
 * POST /api/calendar?birthdays=1 {email, day:"MM-DD"} → { ok:true }   ("" clears it)
 *
 * Both need the verified school login: these are students' names and birthdays.
 * Only addresses in the school's student directory can be given a birthday.
 *
 * Table (Supabase → SQL editor):
 *   create table birthday (
 *     email       text primary key,
 *     day         text not null,          -- MM-DD
 *     updated_by  text not null,
 *     updated_at  timestamptz not null default now()
 *   );
 *   -- RLS off: only the service-role key touches it.
 */

import { db, whoami } from "./_supabase.js";
import { nameOverrides, withName } from "./_names.js";
import { studentDirectory } from "./timetable.js";

/* The class of 2027 is whatever year group the owner is in, so the grid stays
   right while the directory still calls them yr11 and after it moves them to yr12.
   shortcut: after the 2027 HSC this needs another anchor */
const ANCHOR = "andre.kwok2@education.nsw.gov.au";
/* the table not existing yet is the usual cause of a failed read or write */
const missing = e => /does not exist|could not find the table|42P01|PGRST205/i.test(String(e && (e.code + " " + e.message)));
const failed = (e, what) => missing(e)
  ? "The birthday table isn't in Supabase yet: run the SQL in SETUP.md (Birthday register)."
  : "Couldn't " + what + ".";

/* MM-DD that exists in some year, so 02-29 is fine */
export function isMonthDay(v) {
  const m = String(v || "").match(/^(\d{2})-(\d{2})$/);
  if (!m) return false;
  const mo = +m[1], d = +m[2];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(2024, mo, 0).getDate();
}

const fullName = (names, p) => withName(names, p.email, [p.first, p.last].filter(Boolean).join(" ") || p.email.split("@")[0]);

export async function birthdayHandler(req, res) {
  if (!db) return res.status(503).json({ error: "Birthdays aren't set up on the server yet." });
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in on the main timetable to see and add birthdays." });

  let dir;
  try { dir = await studentDirectory(); }
  catch (e) { console.error("birthdays directory:", e.message); return res.status(502).json({ error: "Couldn't load the student list from the school." }); }
  const byEmail = new Map(dir.map(p => [p.email, p]));

  if (req.method === "GET") {
    const names = await nameOverrides();
    const { data, error } = await db.from("birthday").select("email, day").limit(5000);
    if (error) console.error("birthdays read:", error.message);       // still send the grid, so names show
    const cohort = (byEmail.get(ANCHOR) || {}).year || 12;
    const people = dir.filter(p => p.year === cohort)
      .sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first))
      .map(p => ({ email: p.email, name: fullName(names, p) }));
    const birthdays = (data || []).filter(r => byEmail.has(r.email) && isMonthDay(r.day))
      .map(r => ({ email: r.email, day: r.day, name: fullName(names, byEmail.get(r.email)) }));
    return res.status(200).json({ people, birthdays, warning: error ? failed(error, "load birthdays") : undefined });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  body = body || {};
  const email = String(body.email || "").trim().toLowerCase();
  if (!byEmail.has(email)) return res.status(400).json({ error: "That person isn't in the student list." });

  if (!body.day) {
    const { error } = await db.from("birthday").delete().eq("email", email);
    if (error) return res.status(502).json({ error: failed(error, "clear that") });
    return res.status(200).json({ ok: true });
  }
  if (!isMonthDay(body.day)) return res.status(400).json({ error: "That date isn't valid." });
  const { error } = await db.from("birthday").upsert({
    email, day: body.day, updated_by: String(me.email).toLowerCase(), updated_at: new Date().toISOString()
  });
  if (error) { console.error("birthdays save:", error.message); return res.status(502).json({ error: failed(error, "save that") }); }
  return res.status(200).json({ ok: true });
}
