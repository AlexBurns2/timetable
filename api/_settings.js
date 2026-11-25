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
 * Game bans (25 November 2026): the row "game_bans" holds who a moderator has
 * taken off which games, as JSON { "<email>": { "g": [game ids], "at": iso } }
 * ("*" is every game). A banned person's results for that game are refused by
 * the server and they're left off its boards; nothing they had is deleted, so
 * lifting a ban brings it all back. The list is never sent to the pages: each
 * person is only told the games they're banned from (bannedFrom).
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
/* hiddenGames: game ids taken off the games page (and out of ?play= links) for everyone */
const DEFAULTS = { weeklyBoards: true, hiddenGames: ["jim"] };   // Jim stays off until a moderator turns it on
let cache = null, cachedAt = 0;
let bans = new Map();         // email → Set of game ids (kept as it was if a read fails)

/* the games a moderator can ban someone from: the ones whose results the server records */
export const BAN_GAMES = ["snake", "g2048", "typing", "react", "tetris", "hkmj", "chain", "oddone", "classroom",
  "dailyguess", "whose", "quartets", "fours", "jimall"];
const BAN_OK = new Set([...BAN_GAMES, "*"]);
const EMAIL = /^[^@\s,"]+@[^@\s,"]+\.[^@\s,"]+$/;
function parseBans(raw) {
  const out = new Map();
  let o = null;
  try { o = JSON.parse(String(raw || "{}")); } catch { return out; }
  if (!o || typeof o !== "object") return out;
  for (const [email, v] of Object.entries(o)) {
    const e = String(email).toLowerCase(), g = (v && Array.isArray(v.g) ? v.g : []).map(String).filter(x => BAN_OK.has(x));
    if (EMAIL.test(e) && g.length) out.set(e, { g: new Set(g), at: v && v.at ? String(v.at) : null });
  }
  return out;
}

export async function siteSettings() {
  if (!db) return { ...DEFAULTS, hiddenGames: [...DEFAULTS.hiddenGames] };
  if (cache && Date.now() - cachedAt < TTL) return cache;
  try {
    const { data, error } = await db.from("site_setting").select("key, value").limit(100);
    if (error) throw new Error(error.message);
    const out = { ...DEFAULTS, hiddenGames: [...DEFAULTS.hiddenGames] };
    let nextBans = new Map();
    (data || []).forEach(r => {
      if (r.key === "weekly_boards") out.weeklyBoards = String(r.value) !== "off";
      if (r.key === "hidden_games") out.hiddenGames = String(r.value).split(",").map(s => s.trim()).filter(s => /^[a-z0-9]{1,24}$/.test(s));
      if (r.key === "game_bans") nextBans = parseBans(r.value);
    });
    cache = out; bans = nextBans;
  } catch (e) {
    if (!cache) console.warn("site settings unavailable, using defaults:", e.message);
    cache = { ...DEFAULTS, hiddenGames: [...DEFAULTS.hiddenGames] };
  }
  cachedAt = Date.now();
  return cache;
}

/* ── game bans ── (read with the settings above, so they cost no extra trip to the database) */
const banOf = async email => { await siteSettings(); return bans.get(String(email || "").trim().toLowerCase()); };
/* is this person banned from this game? */
export async function isBanned(email, game) {
  if (!email) return false;
  const b = await banOf(email);
  return !!b && (b.g.has("*") || b.g.has(game));
}
/* the games this person is banned from (for their own pages) */
export async function bannedFrom(email) {
  const b = await banOf(email);
  return b ? [...b.g] : [];
}
/* everyone banned from this game, to leave off its boards */
export async function bannedIn(game) {
  await siteSettings();
  const out = new Set();
  for (const [e, b] of bans) if (b.g.has("*") || b.g.has(game)) out.add(e);
  return out;
}
/* the whole list, for the moderator page */
export async function banList() {
  forgetSiteSettings(); await siteSettings();
  return [...bans].map(([email, b]) => ({ email, games: [...b.g], at: b.at }));
}
/* set one person's bans (an empty list lifts them). Re-reads the row first, so two moderators
   saving one after the other don't undo each other. Returns an error message, or null. */
export async function setBans(email, games) {
  const e = String(email || "").trim().toLowerCase();
  if (!EMAIL.test(e)) return "That isn't an email address.";
  const g = [...new Set((games || []).map(String))];
  if (!g.every(x => BAN_OK.has(x))) return "Unknown game.";
  if (!db) return "The database is not configured on the server.";
  const { data, error } = await db.from("site_setting").select("value").eq("key", "game_bans").maybeSingle();
  if (error) return error.message;
  const all = parseBans(data && data.value);
  if (all.size >= 500 && !all.has(e) && g.length) return "That's too many bans.";
  if (g.length) all.set(e, { g: new Set(g.includes("*") ? ["*"] : g), at: new Date().toISOString() });
  else all.delete(e);
  const out = {};
  for (const [k, v] of all) out[k] = { g: [...v.g], at: v.at };
  return setSiteSetting("game_bans", JSON.stringify(out));
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
