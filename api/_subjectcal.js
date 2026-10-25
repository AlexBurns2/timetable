/*
 * Subject calendar: events that belong to a course rather than to a person,
 * such as "Physics exam, Thu 5 Nov, 9:00". Everyone whose timetable has that
 * course sees them, and anyone signed in can add one, fix one that's wrong, or
 * take one down. Each row remembers who made it and who last changed it, and
 * that name is shown beside the event.
 *
 * GET  /api/subjectcal?courses=physics yr11|chemistry yr11  → { events:[…] }
 * POST /api/subjectcal {action:'save', event}                → { id }
 * POST /api/subjectcal {action:'delete', id}                 → { ok:true }
 *
 * A course is named the way the school timetable names it (its CourseName,
 * e.g. "Physics Yr11"), lowercased, so Year 11 and Year 12 Physics are kept
 * apart. Reading needs no login (the events are about subjects, not people);
 * writing needs the same verified school login as everything else.
 *
 * Table (Supabase → SQL editor):
 *   create table subject_event (
 *     id          text primary key,
 *     course      text not null,          -- "physics yr11"
 *     title       text not null,
 *     day         text not null,          -- YYYY-MM-DD
 *     starts      text,                   -- HH:MM, or null for all day
 *     ends        text,                   -- HH:MM
 *     notes       text,
 *     created_by  text not null,
 *     updated_by  text not null,
 *     updated_at  timestamptz not null default now()
 *   );
 *   create index subject_event_course_idx on subject_event (course, day);
 *   -- RLS off: only the service-role key touches it.
 */

import { db, whoami } from "./_supabase.js";
import { nameOverrides, withName } from "./_names.js";

let NAMES = new Map();
const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const parts = String(email).split("@")[0].split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(parts[0] || "") || "Someone";
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const course = v => clean(v, 80).toLowerCase().replace(/\s+/g, " ");
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const isTime = v => /^\d{2}:\d{2}$/.test(String(v || ""));
const MAX_COURSES = 20;
const MAX_PER_COURSE = 300;

const shape = r => ({
  id: r.id, course: r.course, title: r.title, day: r.day,
  start: r.starts || null, end: r.ends || null, notes: r.notes || "",
  by: withName(NAMES, r.updated_by, nameFromEmail(r.updated_by)), at: r.updated_at
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!db) return res.status(503).json({ error: "Subject events aren't set up on the server yet." });
  NAMES = await nameOverrides();

  if (req.method === "GET") {
    const courses = [...new Set(String(req.query.courses || "").split("|").map(course).filter(Boolean))].slice(0, MAX_COURSES);
    if (!courses.length) return res.status(200).json({ events: [] });
    const { data, error } = await db.from("subject_event")
      .select("id, course, title, day, starts, ends, notes, updated_by, updated_at")
      .in("course", courses).order("day", { ascending: true }).limit(2000);
    if (error) { console.error("subjectcal read:", error.message); return res.status(502).json({ error: "Couldn't load subject events." }); }
    return res.status(200).json({ events: (data || []).map(shape) });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in on the main timetable to add or change subject events." });
  const email = String(me.email).toLowerCase();

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  body = body || {};

  if (body.action === "delete") {
    const id = clean(body.id, 60);
    const { error } = await db.from("subject_event").delete().eq("id", id);
    if (error) return res.status(502).json({ error: "Couldn't remove that." });
    return res.status(200).json({ ok: true });
  }

  const ev = body.event || {};
  const row = {
    course: course(ev.course), title: clean(ev.title, 140), day: clean(ev.day, 10),
    starts: isTime(ev.start) ? ev.start : null, ends: isTime(ev.end) ? ev.end : null,
    notes: clean(ev.notes, 600), updated_by: email, updated_at: new Date().toISOString()
  };
  if (!row.course) return res.status(400).json({ error: "Pick the subject this is for." });
  if (!row.title) return res.status(400).json({ error: "Give the event a name." });
  if (!isDay(row.day)) return res.status(400).json({ error: "That date isn't valid." });
  if (row.starts && row.ends && row.ends < row.starts) row.ends = null;

  if (ev.id) {
    const { data: existing } = await db.from("subject_event").select("id").eq("id", String(ev.id)).maybeSingle();
    if (!existing) return res.status(404).json({ error: "That event has been removed." });
    const { error } = await db.from("subject_event").update(row).eq("id", String(ev.id));
    if (error) { console.error("subjectcal update:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
    return res.status(200).json({ id: String(ev.id) });
  }

  const { count } = await db.from("subject_event").select("id", { count: "exact", head: true }).eq("course", row.course);
  if ((count || 0) >= MAX_PER_COURSE) return res.status(400).json({ error: "That subject has too many events saved." });
  const id = newId();
  const { error } = await db.from("subject_event").insert({ id, ...row, created_by: email });
  if (error) { console.error("subjectcal insert:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
  return res.status(200).json({ id });
}
