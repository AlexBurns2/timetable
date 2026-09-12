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

import { db, whoami } from "./_supabase.js";

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
/* who may clear a board (server-side, never trust the client). Set OWNER_EMAIL
   in the environment to your school login; unset ⇒ nobody can wipe. */
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();

async function board(game, metric, period, dir, meEmail, withEmail) {
  const asc = dir === "min";
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
  return { top: (top || []).map(r => { const o = { name: r.name, score: r.score, you: r.email === meEmail };
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

  const game = String(src.game || "");
  const metric = String(src.metric || "");
  const dir = DIRS[game + ":" + metric];
  if (!dir) return res.status(400).json({ error: "Unknown leaderboard." });
  const week = weekOf(src.week);
  if (week === null) return res.status(400).json({ error: "A valid week is required." });
  const wperiod = "w" + week;
  const isOwner = !!OWNER_EMAIL && String(me.email).toLowerCase() === OWNER_EMAIL;

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
