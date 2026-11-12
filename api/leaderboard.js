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
 *   period is 'all' or 'w<week>'.
 */

import { db, whoami, isAdmin } from "./_supabase.js";
import { nameOverrides, displayNames, withName, forgetNameOverrides } from "./_names.js";
import { siteSettings, setSiteSetting } from "./_settings.js";

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
  "react:fastest": "min", "classroom:high": "max",
  "chain:best": "min",         // legacy single-puzzle Six Degrees (kept readable)
  "chain:targets": "max",      // new Six Degrees gauntlet — most targets in a run
  "oddone:high": "max"         // Odd One Out — best score in a run
};
const MAX_SCORE = 100000000;

/* Owner-only engagement view: everyone who has actually used the site.
 * `prefs` gets a row the first time someone's settings sync after they log in,
 * so it is the closest thing to a sign-in log; game scores and daily results
 * fill in anyone who played before settings synced, and give an activity count.
 * Read-only — it never writes, and it is gated to admins by the caller. */
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

async function board(game, metric, period, dir, meEmail, withEmail) {
  const asc = dir === "min", names = await displayNames();
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
  return { top: (top || []).map(r => { const o = { name: withName(names, r.email, r.name), score: r.score, you: r.email === meEmail };
    if (withEmail) o.email = r.email; return o; }), meBest, meRank };
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
    rowsOf("jim_score", "score", null, 5000),
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
  for (const r of states || []) if (r.email !== "mahjong") perMode[r.mode] = (perMode[r.mode] || 0) + 1;
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

const MIN_REACTION_MS = 60;              // under this isn't a human reaction (the page refuses it too)

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
    return res.status(200).json({ ...(await siteSettings()), isMod: isAdmin(me.email) });
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

  const game = String(src.game || "");
  const metric = String(src.metric || "");
  const dir = DIRS[game + ":" + metric];
  if (!dir) return res.status(400).json({ error: "Unknown leaderboard." });
  const week = weekOf(src.week);
  if (week === null) return res.status(400).json({ error: "A valid week is required." });
  const wperiod = "w" + week;
  const isOwner = isAdmin(me.email);

  const validPeriod = p => p === "all" || p === wperiod;

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
    const score = Math.round(Number(src.score));
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return res.status(400).json({ error: "That score is out of range." });
    /* faster than a person can react: an autoclicker or a script, not a score */
    if (game === "react" && metric === "fastest" && score < MIN_REACTION_MS) return res.status(400).json({ error: "That's faster than anyone can react." });
    const name = nameFromEmail(me.email);
    try {
      await writeBest(game, metric, "all", me.email, name, score, dir);
      await writeBest(game, metric, wperiod, me.email, name, score, dir);
    } catch (e) { console.error("leaderboard write:", e.message); return res.status(502).json({ error: "Couldn't save your score." }); }
  } else if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    week: await board(game, metric, wperiod, dir, me.email, isOwner),
    all:  await board(game, metric, "all", dir, me.email, isOwner),
    canWipe: isOwner
  });
}
