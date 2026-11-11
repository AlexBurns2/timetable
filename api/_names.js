/*
 * Display-name overrides, set by the owner from the moderator page for anyone
 * who goes by a different name from the one in their school email.
 *
 * Every route that shows a person's name to someone else runs it through
 * withName(), so an override shows up everywhere at once: leaderboards, the
 * Tetris boards, the forum, shared calendar events and flashcard decks.
 *
 * Safe by construction: if the table doesn't exist yet, or the lookup fails,
 * this returns an empty map and every page shows exactly what it did before.
 * Nothing here ever writes to another table.
 *
 * Table (Supabase → SQL editor):
 *   create table name_override (
 *     email      text primary key,
 *     name       text not null,
 *     updated_at timestamptz not null default now()
 *   );
 */

import { db } from "./_supabase.js";

const TTL = 60_000;          // a warm function instance re-reads at most once a minute
let cache = null, cachedAt = 0;

export async function nameOverrides() {
  if (!db) return new Map();
  if (cache && Date.now() - cachedAt < TTL) return cache;
  try {
    const { data, error } = await db.from("name_override").select("email, name").limit(5000);
    if (error) throw new Error(error.message);
    cache = new Map((data || []).map(r => [String(r.email).toLowerCase(), String(r.name)]));
  } catch (e) {
    if (!cache) console.warn("name overrides unavailable, using email names:", e.message);
    cache = new Map();
  }
  cachedAt = Date.now();
  return cache;
}

/* An email address is never shown as a name: "kiyoka.kubo@det.nsw.edu.au"
   becomes "Kiyoka Kubo" (everything from the @ on goes, the rest is tidied).
   Any text can be run through this; it only touches what looks like an address. */
const EMAIL = /([A-Za-z0-9._%+'-]+)@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const cap = w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
export const nameFromLocal = local => String(local || "").split(/[._]+/).filter(Boolean)
  .map(w => cap(w.replace(/\d+$/, ""))).filter(Boolean).join(" ") || "Someone";
export function stripEmails(text) {
  return text == null ? text : String(text).replace(EMAIL, (m, local) => nameFromLocal(local));
}

/* the override for this email if there is one, otherwise the name it would have had */
export function withName(map, email, fallback) {
  const hit = email && map && map.get(String(email).toLowerCase());
  return stripEmails(hit || fallback);
}

export function forgetNameOverrides() { cache = null; cachedAt = 0; }

/* Everyone's name as people know them, for anything shown to anyone: an
   override if one is set, otherwise the school directory's name (which already
   carries the name a student goes by: "Ari", not the "Arianna" in her email).
   A name made from an email address is only ever the last resort, for someone
   in neither (staff, or someone who has left), because an email can carry a
   name the person no longer uses. Routes load this once per request:
     NAMES = await displayNames();  …  withName(NAMES, email, fallback)
   If the school directory can't be reached, it is overrides only, as before. */
/* The year lists, fast: a copy of the school's student directory kept in the
   student_cache table and refreshed by the nightly job (refreshRosterCache), so
   a function waking up reads one table instead of asking the school's system.
   Falls back to the school directory itself if the copy is missing (the table
   not made yet) or more than a day and a half old.
   Returns [{ email, first, last, year }], the same shape as studentDirectory(). */
let roster = null, rosterAt = 0;
const ROSTER_TTL = 15 * 60e3, ROSTER_STALE = 36 * 3600e3;
export async function rosterList() {
  if (roster && Date.now() - rosterAt < ROSTER_TTL) return roster;
  if (db) {
    try {
      const rows = [];
      for (let from = 0; from < 10000; from += 1000) {           // a page at a time (the database hands back 1,000 at most)
        const { data, error } = await db.from("student_cache").select("email, first, last, year, updated_at").order("email").range(from, from + 999);
        if (error) throw new Error(error.message);
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const newest = rows.reduce((a, r) => Math.max(a, Date.parse(r.updated_at) || 0), 0);
      if (rows.length && Date.now() - newest < ROSTER_STALE) {
        roster = rows.map(r => ({ email: r.email, first: r.first || "", last: r.last || "", year: r.year == null ? null : +r.year }));
        rosterAt = Date.now();
        return roster;
      }
    } catch (e) { /* no table yet, or it failed: the school directory instead */ }
  }
  const { studentDirectory } = await import("./timetable.js");
  roster = await studentDirectory(); rosterAt = Date.now();
  return roster;
}
/* the nightly job: copy the school directory into student_cache (adds and updates; never deletes) */
export async function refreshRosterCache() {
  if (!db) return 0;
  const { studentDirectory } = await import("./timetable.js");
  const list = await studentDirectory(), now = new Date().toISOString();
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await db.from("student_cache").upsert(list.slice(i, i + 500)
      .map(p => ({ email: p.email, first: p.first || "", last: p.last || "", year: p.year || null, updated_at: now })), { onConflict: "email" });
    if (error) throw new Error(error.message);
  }
  roster = list; rosterAt = Date.now();
  return list.length;
}

let dirNames = null, dirAt = 0, dirFailAt = 0;
const DIR_TTL = 6 * 3600e3;
async function directoryNames() {
  if (dirNames && Date.now() - dirAt < DIR_TTL) return dirNames;
  if (Date.now() - dirFailAt < 60_000) return dirNames || new Map();
  try {
    const list = await Promise.race([rosterList(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("directory timed out")), 4000))]);
    dirNames = new Map((list || []).filter(p => p.email && (p.first || p.last))
      .map(p => [String(p.email).toLowerCase(), [p.first, p.last].filter(Boolean).join(" ")]));
    dirAt = Date.now();
  } catch (e) {
    dirFailAt = Date.now();
    console.warn("display names: directory unavailable:", e.message);
  }
  return dirNames || new Map();
}
export async function displayNames() {
  const [dir, over] = await Promise.all([directoryNames(), nameOverrides()]);
  if (!dir.size) return over;
  const all = new Map(dir);
  for (const [k, v] of over) all.set(k, v);
  return all;
}

/* A person straight from the school API (a class list, the directory, a
   profile), with their override written over every name field it has, so the
   page never sees the old name. Returns a copy; anyone without an override is
   returned as is. */
const FIRST_KEYS = ["FirstName", "firstName", "firstname", "GivenName", "givenName", "preferredName", "PreferredName"];
const LAST_KEYS = ["LastName", "lastName", "lastname", "Surname", "surname"];
const FULL_KEYS = ["FullName", "fullName", "Name", "name", "displayName", "DisplayName"];
export function renamePerson(map, p) {
  if (!p || typeof p !== "object" || !map || !map.size) return p;
  const email = String(p.emailAddress || p.EmailAddress || p.Email || p.email || "").toLowerCase();
  const hit = email && map.get(email);
  if (!hit) return p;
  const parts = String(hit).trim().split(/\s+/), first = parts[0], last = parts.slice(1).join(" ");
  const out = { ...p };
  let any = false;
  for (const k of FIRST_KEYS) if (k in out) { out[k] = first; any = true; }
  for (const k of LAST_KEYS) if (k in out && last) { out[k] = last; any = true; }
  for (const k of FULL_KEYS) if (k in out && typeof out[k] === "string") { out[k] = hit; any = true; }
  if (!any) { out.firstname = first; if (last) out.lastname = last; }
  return out;
}
export const renameList = (map, list) => Array.isArray(list) ? list.map(p => renamePerson(map, p)) : list;
