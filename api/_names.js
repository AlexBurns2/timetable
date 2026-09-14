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
