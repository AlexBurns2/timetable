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

/* the override for this email if there is one, otherwise the name it would have had */
export function withName(map, email, fallback) {
  const hit = email && map && map.get(String(email).toLowerCase());
  return hit || fallback;
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
let dirNames = null, dirAt = 0, dirFailAt = 0;
const DIR_TTL = 6 * 3600e3;
async function directoryNames() {
  if (dirNames && Date.now() - dirAt < DIR_TTL) return dirNames;
  if (Date.now() - dirFailAt < 60_000) return dirNames || new Map();
  try {
    const { studentDirectory } = await import("./timetable.js");
    const list = await Promise.race([studentDirectory(),
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
