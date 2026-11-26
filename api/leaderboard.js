/*
 * GET  /api/leaderboard?game=&metric=&week=N   → { week:{…}, all:{…} }
 * POST /api/leaderboard {game, metric, score, week}  → same shape, after saving
 *
 * One generic leaderboard for the arcade games. Every score is kept in TWO
 * buckets: an all-time board ("unlimited") and a per-week board ("weekly
 * challenge") that resets with the Monday-anchored week number. Each board keeps
 * a player's best (higher- or lower-is-better per game) and returns the top 20
 * plus the caller's own rank. Same identity model as the Tetris board: verified
 * by whoami, display name derived server-side, emails never returned.
 *
 * Table:
 *   game_score(game, metric, period, email, name, score, updated_at,
 *              primary key (game, metric, period, email))
 *   period is 'all', 'w<week>', or 'd<YYYYMMDD>' for the daily boards.
 *
 * Daily boards (DAILY_GAMES, e.g. Hong Kong Mahjong's daily deal): pass
 * day=YYYYMMDD (the player's local date, within a day of the server's) and the
 * score is also kept on that day's board, returned as `day`.
 *
 * Year groups: every board is your own year's unless you ask for another
 * (?year=7…12) or everyone's (?year=all). Scores are kept as before (one row
 * per person); the year comes from the school directory when a board is read,
 * so someone moving up a year moves boards with them.
 *
 * Six Degrees, Odd One Out and Classroom are run by the server (_runs.js:
 * POST {action:"run", …}) and record their own scores; a score posted for them
 * is refused. Snake, 2048, Typing, Reaction and Tetris need a ticket from when
 * the game started (POST {action:"ticket", game}), and the score has to fit the
 * time since. Snake and 2048 get replayed from the ticket's seed, and anything off
 * is held for Alex (_anticheat.js, _review.js). TAS boards: _tas.js.
 */

import { db, whoami, isAdmin, isReviewer } from "./_supabase.js";
import { nameOverrides, displayNames, withName, forgetNameOverrides, rosterList, yearTags, withYear } from "./_names.js";
import { runHandler, RUN_GAMES, issueTicket, ticketOf, scoreFits, TICKET_GAMES } from "./_runs.js";
import { inputSigns, vetSnake, vet2048, vetOther, botty } from "./_anticheat.js";
import { holdScore, heldList, takeHeld, writeTetris } from "./_review.js";
import { tasHandler } from "./_tas.js";

/* the server runs Six Degrees' map-making and the runs: give it time */
export const config = { maxDuration: 60 };

/* ── year groups ─────────────────────────────────────────────────────────
   Who is in which year, from the copy of the school directory (rosterList,
   refreshed nightly). A board for one year is the full board filtered to them. */
export async function yearMap() {
  try { return new Map((await rosterList()).filter(p => p.email && p.year).map(p => [p.email, String(p.year)])); }
  catch { return new Map(); }
}
/* which board was asked for: "all", a year 7–12, or (nothing asked) your own year, else everyone's */
export function boardScope(raw, me, years) {
  const v = String(raw == null ? "" : raw).toLowerCase();
  if (v === "all") return null;
  const n = parseInt(v, 10);
  if (n >= 7 && n <= 12) return String(n);
  const mine = me.year || years.get(me.email);
  return mine ? String(mine) : null;
}
import { siteSettings, setSiteSetting, isBanned, bannedIn, bannedFrom, banList, setBans, BAN_GAMES } from "./_settings.js";
const BANNED = { error: "A moderator has stopped your scores counting in this game.", banned: true };

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

/* which (game:metric) pairs are allowed, and whether higher or lower wins */
const DIRS = {
  "snake:high": "max", "g2048:high": "max", "typing:wpm": "max",
  "react:fastest": "min",      // legacy single-click Reaction (kept readable; no longer sent)
  "react:avg3": "min",         // Reaction: the average of three tries in a row
  "classroom:high": "max",
  "chain:best": "min",         // legacy single-puzzle Six Degrees (kept readable)
  "chain:targets": "max",      // new Six Degrees gauntlet — most targets in a run
  "oddone:high": "max",        // Odd One Out — best score in a run
  "hkmj:dailyfaan": "max"      // Hong Kong Mahjong daily deal — faan won in the day's game
};
/* games with a board per day (period 'd<YYYYMMDD>'), and the most a score can be */
const DAILY_GAMES = { "hkmj:dailyfaan": 1000 };
/* a YYYYMMDD within a day of now (the player's local date), or null */
const dayOf = v => {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v == null ? "" : v));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.abs(t - Date.now()) < 1.6 * 864e5 ? m[0] : null;
};
const MAX_SCORE = 100000000;
let themePop = { at: 0, order: [] };
/* the Cities Collection's weather: each city's coordinates, and WMO weather codes in words */
const CITY_AT = { sydney: [-33.8688, 151.2093], tokyo: [35.6762, 139.6503], hongkong: [22.3193, 114.1694], chongqing: [29.5630, 106.5516],
  la: [34.0522, -118.2437], losangeles: [34.0522, -118.2437], edinburgh: [55.9533, -3.1883], singapore: [1.3521, 103.8198], taipei: [25.0330, 121.5654], london: [51.5072, -0.1276] };
const cityWx = new Map();
const WX_TEXT = c => c === 0 ? "Clear" : c === 1 ? "Mostly clear" : c === 2 ? "Partly cloudy" : c === 3 ? "Overcast" : c === 45 || c === 48 ? "Fog" :
  c >= 51 && c <= 57 ? "Drizzle" : c >= 61 && c <= 67 ? "Rain" : c >= 71 && c <= 77 ? "Snow" : c >= 80 && c <= 82 ? "Showers" :
  c === 85 || c === 86 ? "Snow showers" : c >= 95 ? "Thunderstorms" : "—";      // the Theme finder's "Popular" order (?themepop=1), kept an hour

/* Owner-only engagement view: everyone who has actually used the site.
 * `prefs` gets a row the first time someone's settings sync after they log in,
 * so it is the closest thing to a sign-in log; game scores and daily results
 * fill in anyone who played before settings synced, and give an activity count.
 * Read-only — it never writes, and it is gated to admins by the caller. */
/* every email in a table (a page of 1000 at a time, the database's limit, up to 60 pages); a missing
   table is simply empty */
async function emailsIn(table) {
  const out = new Set();
  for (let from = 0; from < 60000; from += 1000) {
    const { data, error } = await db.from(table).select("email").range(from, from + 999);
    if (error || !data) break;
    data.forEach(r => r.email && out.add(String(r.email).toLowerCase()));
    if (data.length < 1000) break;
  }
  return out;
}
/* each year's students (with classes here), and how many of them have done each thing */
async function siteReach() {
  const roster = (await rosterList()).filter(p => p.year && p.hasClasses !== false);
  const groups = { signedIn: ["prefs", "onboarding"], played: ["game_score", "daily_result", "conn_result", "whose_result", "sprint_best", "tetris_score", "zen_board"],
                   voted: ["poll_voter"], posted: ["forum_post"] };
  const sets = {};
  for (const [k, tables] of Object.entries(groups)) {
    const s = new Set();
    for (const t of tables) (await emailsIn(t)).forEach(e => s.add(e));
    sets[k] = s;
  }
  /* anyone who played, voted or posted has signed in, whether or not their settings were saved */
  ["played", "voted", "posted"].forEach(k => sets[k].forEach(e => sets.signedIn.add(e)));
  const years = [];
  for (const y of [7, 8, 9, 10, 11, 12]) {
    const people = roster.filter(p => Number(p.year) === y).map(p => String(p.email).toLowerCase());
    const row = { year: y, total: people.length };
    for (const k of Object.keys(groups)) row[k] = people.filter(e => sets[k].has(e)).length;
    years.push(row);
  }
  return { years, at: new Date().toISOString() };
}

async function siteUsers() {
  const out = new Map(), names = await displayNames();
  const touch = (email, when, key) => {
    const e = String(email || "").toLowerCase();
    if (!e) return;
    let u = out.get(e);
    if (!u) {
      const auto = nameFromEmail(e);
      /* auto is what the email gives; name is what everyone else sees */
      u = { email: e, auto, name: withName(names, e, auto), renamed: names.has(e), last: null, scores: 0, days: 0 };
      out.set(e, u);
    }
    if (when && (!u.last || String(when) > u.last)) u.last = String(when);
    if (key) u[key]++;
  };
  const grab = async (table, col) => {
    const { data, error } = await db.from(table).select("email, " + col).limit(5000);
    if (error) { console.error("siteUsers " + table + ":", error.message); return []; }
    return data || [];
  };
  (await grab("prefs", "updated_at")).forEach(r => touch(r.email, r.updated_at));
  (await grab("game_score", "updated_at")).forEach(r => touch(r.email, r.updated_at, "scores"));
  (await grab("daily_result", "updated_at")).forEach(r => touch(r.email, r.updated_at, "days"));
  /* Anyone with a name set but no activity yet: the owner can name someone
     before their first visit, so they show up here waiting rather than
     vanishing until they open the site. */
  names.forEach((_, email) => { if (!out.has(email)){ touch(email, null); out.get(email).pending = true; } });
  return [...out.values()].sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")));
}

/* A ban only stops new scores: banned people stay on the boards until a moderator removes their scores, marked
   `banned` (the page puts a "!" by the name: "User banned from this game"). The owner, 26 November 2026. */
async function board(game, metric, period, dir, meEmail, withEmail, year, years, banned) {
  const asc = dir === "min", [names, tags] = await Promise.all([displayNames(), yearTags()]);
  const flag = (o, r) => { if (banned && banned.has(String(r.email).toLowerCase())) o.banned = true; return o; };
  /* one year's board: everyone's scores, filtered to that year, ranked here */
  if (year) {
    const { data } = await db.from("game_score")
      .select("name, score, email").eq("game", game).eq("metric", metric).eq("period", period)
      .order("score", { ascending: asc }).limit(5000);
    const rows = (data || []).filter(r => years.get(r.email) === year);
    const mine = rows.find(r => r.email === meEmail);
    const meBest = mine ? mine.score : null;
    const meRank = meBest == null ? null : 1 + rows.filter(r => asc ? r.score < meBest : r.score > meBest).length;
    return { year, top: rows.slice(0, withEmail ? 200 : 20).map(r => { const o = { name: withYear(withName(names, r.email, r.name), tags, r.email), score: r.score, you: r.email === meEmail };
      if (withEmail) o.email = r.email; return flag(o, r); }), meBest, meRank };
  }
  const { data: top } = await db.from("game_score")
    .select("name, score, email").eq("game", game).eq("metric", metric).eq("period", period)
    .order("score", { ascending: asc }).limit(withEmail ? 200 : 20);   // owner gets the full list to edit
  const { data: mine } = await db.from("game_score")
    .select("score").eq("game", game).eq("metric", metric).eq("period", period).eq("email", meEmail).maybeSingle();
  const meBest = mine ? mine.score : null;
  let meRank = null;
  if (meBest != null) {
    let q = db.from("game_score").select("*", { count: "exact", head: true })
      .eq("game", game).eq("metric", metric).eq("period", period);
    q = asc ? q.lt("score", meBest) : q.gt("score", meBest);
    const { count } = await q;
    meRank = (count || 0) + 1;
  }
  return { top: (top || []).map(r => { const o = { name: withYear(withName(names, r.email, r.name), tags, r.email), score: r.score, you: r.email === meEmail };
    if (withEmail) o.email = r.email; return flag(o, r); }), meBest, meRank };
}

async function writeBest(game, metric, period, email, name, score, dir) {
  const { data: ex } = await db.from("game_score")
    .select("score").eq("game", game).eq("metric", metric).eq("period", period).eq("email", email).maybeSingle();
  const better = !ex || (dir === "max" ? score > ex.score : score < ex.score);
  if (better) {
    const { error } = await db.from("game_score").upsert({ game, metric, period, email, name, score });
    if (error) throw new Error(error.message);
  }
}

/* the ban list for the moderator page: each person by the name the site shows, newest ban first */
async function bansOut() {
  const [list, names, tags] = await Promise.all([banList(), displayNames(), yearTags()]);
  return { games: BAN_GAMES, bans: list.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .map(b => ({ ...b, name: withYear(withName(names, b.email, nameFromEmail(b.email)), tags, b.email) })) };
}

/* ── moderator stats: counts only, every query a read ─────────────────────── */
async function countOf(table, narrow) {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (narrow) q = narrow(q);
  const { count, error } = await q;
  return error ? null : count;              // null: that table isn't there (yet)
}
async function rowsOf(table, cols, narrow, limit = 20000) {
  let q = db.from(table).select(cols).limit(limit);
  if (narrow) q = narrow(q);
  const { data, error } = await q;
  return error ? null : (data || []);
}
async function siteStats() {
  const now = Date.now(), iso = t => new Date(t).toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
  const [users, forum, forumWeek, decks, events, scores, daily, dailyToday, dailyWins, states, mj, jim,
         sprint, tetris, zenBoard, onboard, prefs, revision, renamed, birthdays, subjectEvents] = await Promise.all([
    siteUsers().catch(() => []),
    countOf("forum_post"),
    countOf("forum_post", q => q.gte("created_at", iso(now - 7 * 864e5))),
    countOf("shared_deck"),
    countOf("calendar_event"),
    rowsOf("game_score", "game, email", q => q.eq("period", "all")),
    countOf("daily_result"),
    countOf("daily_result", q => q.eq("date", today)),
    countOf("daily_result", q => q.eq("won", true)),
    rowsOf("game_state", "mode, email, updated_at", null, 5000),
    rowsOf("game_state", "state", q => q.eq("email", "mahjong").eq("mode", "mahjong"), 1),
    rowsOf("jim_score", "score", q => q.not("name", "like", "~%"), 5000),   // ~ rows are Jim Together's
    countOf("sprint_best"),
    countOf("tetris_score"),
    countOf("zen_board"),
    countOf("onboarding"),
    countOf("prefs"),
    rowsOf("revision_progress", "email", null, 20000),
    countOf("name_override"),
    countOf("birthday"),
    countOf("subject_event")
  ]);
  const seen = ms => users.filter(u => u.last && now - new Date(u.last).getTime() < ms).length;
  const perGame = {};
  for (const r of scores || []) (perGame[r.game] = perGame[r.game] || new Set()).add(r.email);
  const perMode = {};
  for (const r of states || []) if (r.email !== "mahjong" && !/^run:/.test(r.mode)) perMode[r.mode] = (perMode[r.mode] || 0) + 1;
  const mjState = (mj && mj[0] && mj[0].state) || {};
  return {
    users: { total: users.filter(u => !u.pending).length, day: seen(864e5), week: seen(7 * 864e5),
             named: renamed, tutorialStarted: onboard, settingsSaved: prefs },
    forum: { posts: forum, week: forumWeek },
    decks: { shared: decks },
    calendar: { events, subjectEvents },
    games: Object.fromEntries(Object.entries(perGame).map(([g, s]) => [g, s.size])),
    tetris: { sprintPlayers: sprint, scores: tetris, zenPlayers: zenBoard },
    daily: { plays: daily, today: dailyToday, wins: dailyWins },
    saved: perMode,
    mahjongClub: { players: Array.isArray(mjState.players) ? mjState.players.length : 0,
                   games: Array.isArray(mjState.rounds) ? mjState.rounds.length : 0 },
    jim: jim ? { names: jim.length, presses: jim.reduce((a, r) => a + (+r.score || 0), 0) } : null,
    revision: revision ? { students: new Set(revision.map(r => r.email)).size } : null,
    birthdays
  };
}


export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The leaderboard is not configured on the server." });

  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to use the leaderboard." });

  const weekOf = v => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= 0 && n < 100000 ? n : null; };

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const src = req.method === "POST" ? (body || {}) : req.query;

  /* site-wide settings. Readable by anyone signed in, because every page needs
     to know whether to show the weekly boards; only the owner can change them. */
  if (req.method === "GET" && src.settings) {
    /* isMod only decides whether pages show the way in to the moderator page;
       every moderator action is still checked here on the server */
    /* your year (from your login, else the directory) and whether you're staff: Years 7 to 9 only see the timetable
       games, and staff get a note about the site the first time (theme.js, games.js; the owner, 25 November 2026) */
    const staff = (me.groups || []).some(g => /^(teacher|staff|executive|admin)/i.test(String(g))) || /@det\.nsw\.edu\.au$/i.test(me.email);
    const year = staff ? null : Number(me.year || (await yearMap()).get(me.email)) || null;
    return res.status(200).json({ ...(await siteSettings()), isMod: isAdmin(me.email), canReview: isReviewer(me.email),
      bannedFrom: await bannedFrom(me.email),             // only your own bans, never anyone else's
      year, staff });
  }
  /* moderator-only: who is banned from which games (Bans on the moderator page), and changing it.
     A ban refuses that person's results for the game and leaves them off its boards; nothing is deleted. */
  if (req.method === "GET" && src.bans) {
    if (!isAdmin(me.email)) return res.status(403).json({ error: "Only moderators can see this." });
    return res.status(200).json(await bansOut());
  }
  if (req.method === "POST" && src.action === "ban") {
    if (!isAdmin(me.email)) return res.status(403).json({ error: "Only moderators can ban people." });
    if (!Array.isArray(src.games) || src.games.length > 40) return res.status(400).json({ error: "Which games?" });
    const failed = await setBans(src.email, src.games);
    if (failed) {
      console.error("bans:", failed);
      return res.status(/email|game/i.test(failed) ? 400 : 502).json({ error: /email|game|many/i.test(failed) ? failed : "Couldn't save that." });
    }
    return res.status(200).json(await bansOut());
  }
  /* EDinburgh, a secret theme Ed asked for (theme.js SKINS 'ed'): his photo, to signed-in people only. It is not in the
     repo, which is public: it's the ED_PHOTO environment variable (the picture as base64). Without it, nothing. */
  if (req.method === "GET" && src.edphoto) {
    const b64 = String(process.env.ED_PHOTO || "").replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]{200,}$/.test(b64)) return res.status(404).json({ error: "Not here." });
    const type = b64.startsWith("/9j/") ? "jpeg" : b64.startsWith("iVBOR") ? "png" : "webp";
    return res.status(200).json({ img: "data:image/" + type + ";base64," + b64 });
  }
  if (req.method === "POST" && src.action === "settings") {
    if (!isAdmin(me.email))
      return res.status(403).json({ error: "Only the owner can change site settings." });
    const hasWeekly = src.weeklyBoards !== undefined, hasHidden = src.hiddenGames !== undefined;
    if (!hasWeekly && !hasHidden) return res.status(400).json({ error: "Nothing to change." });
    if (hasWeekly && typeof src.weeklyBoards !== "boolean")
      return res.status(400).json({ error: "weeklyBoards must be true or false." });
    if (hasHidden && (!Array.isArray(src.hiddenGames) || src.hiddenGames.length > 60 ||
                      !src.hiddenGames.every(g => /^[a-z0-9]{1,24}$/.test(String(g)))))
      return res.status(400).json({ error: "hiddenGames must be a list of game ids." });
    const failed = (hasWeekly && await setSiteSetting("weekly_boards", src.weeklyBoards ? "on" : "off")) ||
                   (hasHidden && await setSiteSetting("hidden_games", [...new Set(src.hiddenGames.map(String))].join(",")));
    if (failed) {
      console.error("site settings:", failed);
      return res.status(502).json({ error: "Couldn't save that. Has the site_setting table been created?" });
    }
    return res.status(200).json({ ...(await siteSettings()), isMod: true });
  }

  /* Cities Collection: the city's weather now, for its Home card (skins/cities.js). Only the city's own
     coordinates go to Open-Meteo (free, no key, no account); nothing about who asked. Kept 15 minutes per city. */
  if (req.method === "GET" && src.weather) {
    const C = CITY_AT[String(src.weather)];
    if (!C) return res.status(400).json({ error: "Unknown city." });
    const hit = cityWx.get(src.weather);
    if (hit && Date.now() - hit.at < 15 * 60e3) return res.status(200).json(hit.d);
    try {
      const u = "https://api.open-meteo.com/v1/forecast?latitude=" + C[0] + "&longitude=" + C[1] +
        "&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=1";
      const r = await fetch(u, { headers: { "User-Agent": "school-site-weather/1.0" }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error("status " + r.status);
      const j = await r.json(), c = j.current || {}, d = j.daily || {};
      const out = { city: String(src.weather), temp: Math.round(c.temperature_2m), code: c.weather_code, text: WX_TEXT(c.weather_code), day: c.is_day === 1,
        wind: Math.round(c.wind_speed_10m), hi: Math.round((d.temperature_2m_max || [])[0]), lo: Math.round((d.temperature_2m_min || [])[0]),
        sunrise: (d.sunrise || [])[0] || null, sunset: (d.sunset || [])[0] || null, at: c.time || null };
      cityWx.set(src.weather, { at: Date.now(), d: out });
      res.setHeader("Cache-Control", "private, max-age=600");
      return res.status(200).json(out);
    } catch (e) {
      console.warn("weather:", e.message);
      if (hit) return res.status(200).json(hit.d);
      return res.status(502).json({ error: "No weather just now." });
    }
  }

  /* the Theme finder's "Popular" strip: theme ids in order of how many people have them on (active in the
     last 30 days first, then everyone), from synced settings. The order only: no counts, nobody's choice.
     Read-only, worked out at most once an hour per warm instance. */
  if (req.method === "GET" && src.themepop) {
    if (!themePop.at || Date.now() - themePop.at > 3600e3) {
      const { data: rows, error } = await db.from("prefs").select('updated_at, skin:data->>"tt.skin"').limit(5000);
      if (!error) {
        const since = Date.now() - 30 * 864e5, n = {};
        for (const r of rows || []) { const k = String(r.skin || "plain"); const t = n[k] || (n[k] = { a: 0, all: 0 }); t.all++; if (Date.parse(r.updated_at) > since) t.a++; }
        themePop = { at: Date.now(), order: Object.entries(n).sort((x, y) => y[1].a - x[1].a || y[1].all - x[1].all).map(([k]) => k).filter(k => /^[a-z0-9-]{1,24}$/.test(k)) };
      } else console.warn("theme order:", error.message);
    }
    res.setHeader("Cache-Control", "private, max-age=600");
    return res.status(200).json({ order: themePop.order || [] });
  }

  /* moderator-only: which themes people use, from their synced settings (prefs).
     Only the few keys it needs are read, not whole settings. "Active" is anyone
     whose settings synced in the last 30 days. */
  if (req.method === "GET" && src.themes) {
    if (!isAdmin(me.email))
      return res.status(403).json({ error: "Only moderators can see this." });
    let rows, error;
    ({ data: rows, error } = await db.from("prefs")
      .select('updated_at, skin:data->>"tt.skin", mode:data->>"tt.mode", glassanim:data->>"tt.glassanim", gameicons:data->>"tt.gameicons", tileicons:data->>"tt.tileicons", iconstyle:data->>"tt.iconstyle", iconcolour:data->>"tt.iconcolour", backdrop:data->"tt.custom"->>backdrop, zen:data->>"tt.zen"')
      .limit(5000));
    if (error) {                                      // the keys couldn't be picked out: read the settings whole instead
      console.warn("themes (picked):", error.message);
      ({ data: rows, error } = await db.from("prefs").select("updated_at, data").limit(5000));
      if (error) return res.status(502).json({ error: "Couldn't read the settings." });
      rows = rows.map(r => { const d = r.data || {}, s = v => v == null ? null : String(v);
        return { updated_at: r.updated_at, skin: s(d["tt.skin"]), mode: s(d["tt.mode"]), glassanim: s(d["tt.glassanim"]), gameicons: s(d["tt.gameicons"]),
                 tileicons: s(d["tt.tileicons"]), iconstyle: s(d["tt.iconstyle"]), iconcolour: s(d["tt.iconcolour"]), backdrop: s(d["tt.custom"] && d["tt.custom"].backdrop), zen: s(d["tt.zen"]) }; });
    }
    const since = Date.now() - 30 * 864e5, skins = {}, tally = (o, k, act) => { const t = o[k] || (o[k] = { all: 0, active: 0 }); t.all++; if (act) t.active++; };
    const flags = { dark: {}, glassAnim: {}, emoji: {}, accentIcons: {}, clouds: {}, zen: {} };
    let active = 0;
    for (const r of rows || []) {
      const act = Date.parse(r.updated_at) > since; if (act) active++;
      tally(skins, r.skin || "plain", act);
      if (r.mode === "dark") tally(flags.dark, "n", act);
      if (r.skin === "glass" && r.glassanim === "on") tally(flags.glassAnim, "n", act);
      /* icons chosen in Display (over the theme's own); before that, the old two switches */
      const style = r.iconstyle != null ? r.iconstyle : (r.gameicons === "emoji" ? "emoji" : null);
      const colour = r.iconcolour != null ? r.iconcolour : (r.tileicons === "accent" ? "accent" : null);
      if (style === "emoji") tally(flags.emoji, "n", act);
      if (colour === "accent") tally(flags.accentIcons, "n", act);
      if (r.skin === "custom" && r.backdrop === "clouds") tally(flags.clouds, "n", act);
      if (r.zen === "true") tally(flags.zen, "n", act);
    }
    const f = k => flags[k].n || { all: 0, active: 0 };
    return res.status(200).json({ total: (rows || []).length, active,
      skins: Object.entries(skins).map(([id, c]) => ({ id, ...c })).sort((a, b) => b.active - a.active || b.all - a.all),
      dark: f("dark"), glassAnim: f("glassAnim"), emoji: f("emoji"), accentIcons: f("accentIcons"), clouds: f("clouds"), zen: f("zen") });
  }

  /* moderator-only: how far the site has spread, year by year: of the students in each year (with
     classes here), how many have signed in, played a game, voted in a poll, posted on the forum.
     Counts only; read-only. */
  if (req.method === "GET" && src.reach) {
    if (!isAdmin(me.email))
      return res.status(403).json({ error: "Only moderators can see this." });
    return res.status(200).json(await siteReach());
  }

  /* moderator-only: how much each part of the site is used. Read-only counts. */
  if (req.method === "GET" && src.stats) {
    if (!isAdmin(me.email))
      return res.status(403).json({ error: "Only moderators can see this." });
    return res.status(200).json(await siteStats());
  }

  /* owner-only roster of who has signed in — answered before the game/metric
     checks below, since it isn't tied to any one board */
  if (req.method === "GET" && src.users) {
    if (!isAdmin(me.email))
      return res.status(403).json({ error: "Only the owner can see this." });
    return res.status(200).json({ users: await siteUsers() });
  }

  /* owner-only: set the name someone is shown as, or clear it with an empty name.
     Kept in this route rather than a new file: the project is near Vercel's
     per-deployment function limit. */
  if (req.method === "POST" && src.action === "rename") {
    if (!isAdmin(me.email))
      return res.status(403).json({ error: "Only the owner can rename people." });
    const email = String(src.email || "").trim().toLowerCase();
    const name = String(src.name || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "That isn't an email address." });
    const { error } = name
      ? await db.from("name_override").upsert({ email, name, updated_at: new Date().toISOString() })
      : await db.from("name_override").delete().eq("email", email);
    if (error) {
      console.error("rename:", error.message);
      return res.status(502).json({ error: "Couldn't save that. Has the name_override table been created?" });
    }
    forgetNameOverrides();
    return res.status(200).json({ ok: true, name: name || nameFromEmail(email) });
  }

  if (src.tas || src.action === "tas") {
    try { return await tasHandler(req, res, me, src, nameFromEmail(me.email)); }
    catch (e) { console.error("tas:", e.message); return res.status(502).json({ error: "Couldn't reach the TAS boards." }); }
  }

  if (req.method === "GET" && src.held) {
    if (!isReviewer(me.email)) return res.status(403).json({ error: "Only Alex can check held scores." });
    try { return res.status(200).json({ held: await heldList() }); }
    catch (e) { console.error("held:", e.message); return res.status(502).json({ error: "Couldn't read the held scores." }); }
  }
  if (req.method === "POST" && src.action === "held") {
    if (!isReviewer(me.email)) return res.status(403).json({ error: "Only Alex can check held scores." });
    const email = String(src.email || "").toLowerCase(), key = String(src.key || "");
    if (!email || !/^[a-z0-9:]{1,40}$/.test(key)) return res.status(400).json({ error: "Which score?" });
    try {
      const h = await takeHeld(email, key);
      if (h && src.op === "ok") {
        const name = h.name || nameFromEmail(email);
        for (const b of h.boards || []) {
          if (h.kind === "t") await writeTetris(email, name, b, h.score, h.week);
          else if (DIRS[h.game + ":" + h.metric]) await writeBest(h.game, h.metric, b, email, name, h.score, DIRS[h.game + ":" + h.metric]);
        }
      }
      return res.status(200).json({ held: await heldList() });
    } catch (e) { console.error("held:", e.message); return res.status(502).json({ error: "Couldn't do that." }); }
  }

  /* the games the server runs (Six Degrees, Odd One Out, Classroom) */
  if (req.method === "POST" && src.action === "run") {
    if (await isBanned(me.email, String(src.game || ""))) return res.status(403).json(BANNED);
    const record = async (g, m, score, week) => {
      const name = nameFromEmail(me.email), d = DIRS[g + ":" + m];
      await writeBest(g, m, "all", me.email, name, score, d);
      await writeBest(g, m, "w" + week, me.email, name, score, d);
    };
    return runHandler(req, res, me, src, record);
  }
  /* a ticket for a game played in the page (Snake, 2048, Typing, Reaction, Tetris) */
  if (req.method === "POST" && src.action === "ticket") {
    try { const t = await issueTicket(me, String(src.game || ""));
      return t ? res.status(200).json({ ticket: t.id, seed: t.seed }) : res.status(400).json({ error: "Unknown game." }); }
    catch (e) { console.error("ticket:", e.message); return res.status(502).json({ error: "Couldn't start that." }); }
  }

  const game = String(src.game || "");
  const metric = String(src.metric || "");
  const dir = DIRS[game + ":" + metric];
  if (!dir) return res.status(400).json({ error: "Unknown leaderboard." });
  const week = weekOf(src.week);
  if (week === null) return res.status(400).json({ error: "A valid week is required." });
  const wperiod = "w" + week;
  const isOwner = isAdmin(me.email);

  const dmax = DAILY_GAMES[game + ":" + metric], day = dmax ? dayOf(src.day) : null;
  if (dmax && src.day != null && !day) return res.status(400).json({ error: "That isn't today." });
  const dperiod = day ? "d" + day : null;
  let held = null;
  const validPeriod = p => p === "all" || p === wperiod || (dperiod && p === dperiod);

  if (req.method === "POST" && src.action === "wipe") {
    if (!isOwner) return res.status(403).json({ error: "Only the owner can clear this board." });
    const { error } = await db.from("game_score").delete().eq("game", game).eq("metric", metric);
    if (error) { console.error("leaderboard wipe:", error.message); return res.status(502).json({ error: "Couldn't clear the board." }); }
  } else if (req.method === "POST" && (src.action === "set" || src.action === "delete")) {
    if (!isOwner) return res.status(403).json({ error: "Only the owner can edit scores." });
    const email = String(src.email || "").toLowerCase();
    const period = String(src.period || "");
    if (!email || !validPeriod(period)) return res.status(400).json({ error: "Which score?" });
    if (src.action === "delete") {
      const { error } = await db.from("game_score").delete()
        .eq("game", game).eq("metric", metric).eq("period", period).eq("email", email);
      if (error) { console.error("leaderboard delete:", error.message); return res.status(502).json({ error: "Couldn't delete that score." }); }
    } else {
      const score = Math.round(Number(src.score));
      if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return res.status(400).json({ error: "That score is out of range." });
      const { error } = await db.from("game_score").upsert({ game, metric, period, email, name: nameFromEmail(email), score });
      if (error) { console.error("leaderboard set:", error.message); return res.status(502).json({ error: "Couldn't save that score." }); }
    }
  } else if (req.method === "POST") {
    let score = Math.round(Number(src.score));
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return res.status(400).json({ error: "That score is out of range." });
    /* the games the server runs keep their own scores */
    if (RUN_GAMES.has(game)) return res.status(400).json({ error: "This game records its own scores." });
    if (await isBanned(me.email, game)) return res.status(403).json(BANNED);
    if (dmax && (!day || score > dmax)) return res.status(400).json({ error: day ? "That score doesn't fit the game." : "Which day?" });
    /* the rest: a ticket from when the game started, and a score that fits the time since */
    const why = [];
    if (TICKET_GAMES.has(game)) {
      const tk = await ticketOf(me, game, src.ticket);
      if (!tk) why.push("no ticket from a game");
      else {
        const v = game === "snake" ? vetSnake(tk.seed, src.run, score, tk.age)
                : game === "g2048" ? vet2048(tk.seed, src.run, score, tk.age) : { why: [] };
        if (v.score != null) score = v.score;
        why.push(...v.why);
        if (!scoreFits(game, metric, score, tk.age)) why.push("more than fits the time played");
      }
      why.push(...inputSigns(src.ac), ...vetOther(game, metric, score));
    }
    const name = nameFromEmail(me.email);
    try {
      if (why.length) {
        await holdScore(me.email, name, { key: game + ":" + metric, kind: "g", game, metric, dir, score, week, boards: ["all", wperiod, ...(dperiod ? [dperiod] : [])], why });
        held = { score, tas: botty(why) };
      } else {
        await writeBest(game, metric, "all", me.email, name, score, dir);
        await writeBest(game, metric, wperiod, me.email, name, score, dir);
        if (dperiod) await writeBest(game, metric, dperiod, me.email, name, score, dir);
      }
    } catch (e) { console.error("leaderboard write:", e.message); return res.status(502).json({ error: "Couldn't save your score." }); }
  } else if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const years = await yearMap();
  /* a moderator's edit answers with everyone's board (the moderator page shows them all) */
  const scope = isOwner && ["wipe", "set", "delete"].includes(src.action) ? null : boardScope(src.year, me, years);
  const banned = await bannedIn(game);                 // (read with the settings: no extra trip)
  return res.status(200).json({
    week: await board(game, metric, wperiod, dir, me.email, isOwner, scope, years, banned),
    all:  await board(game, metric, "all", dir, me.email, isOwner, scope, years, banned),
    ...(dperiod ? { day: await board(game, metric, dperiod, dir, me.email, isOwner, scope, years, banned) } : {}),
    year: scope || "all", myYear: me.year || years.get(me.email) || null,
    canWipe: isOwner, ...(held ? { held } : {})
  });
}
