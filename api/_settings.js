/*
 * Site-wide settings the owner sets from the moderator page. They apply to
 * everyone, whoever opens the site, because they live on the server rather
 * than in anyone's browser.
 *
 * Right now there is one: weekly leaderboards. With it off, every page shows
 * the all-time board only and hides the weekly / all-time toggle. Scores are
 * still recorded to the weekly boards the whole time, so turning it back on
 * brings them back exactly as they were — nothing is deleted either way.
 *
 * Safe by construction: if the table doesn't exist yet, or the read fails,
 * this returns the defaults and the site behaves exactly as it did before.
 *
 * Table (Supabase → SQL editor):
 *   create table site_setting (
 *     key        text primary key,
 *     value      text not null,
 *     updated_at timestamptz not null default now()
 *   );
 */

import { db } from "./_supabase.js";

const TTL = 60_000;          // a warm function instance re-reads at most once a minute
const DEFAULTS = { weeklyBoards: true };
let cache = null, cachedAt = 0;

export async function siteSettings() {
  if (!db) return { ...DEFAULTS };
  if (cache && Date.now() - cachedAt < TTL) return cache;
  try {
    const { data, error } = await db.from("site_setting").select("key, value").limit(100);
    if (error) throw new Error(error.message);
    const out = { ...DEFAULTS };
    (data || []).forEach(r => {
      if (r.key === "weekly_boards") out.weeklyBoards = String(r.value) !== "off";
    });
    cache = out;
  } catch (e) {
    if (!cache) console.warn("site settings unavailable, using defaults:", e.message);
    cache = { ...DEFAULTS };
  }
  cachedAt = Date.now();
  return cache;
}

/* write one setting. Returns an error message, or null when it saved. */
export async function setSiteSetting(key, value) {
  if (!db) return "The database is not configured on the server.";
  const { error } = await db.from("site_setting")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return error.message;
  forgetSiteSettings();
  return null;
}

export function forgetSiteSettings() { cache = null; cachedAt = 0; }
