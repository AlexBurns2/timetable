/*
 * GET  /api/tetris?mode=sprint&week=N   → this week's fastest 40-line clears
 * GET  /api/tetris?mode=zen             → all-time longest Zen survivals
 * POST /api/tetris {mode:'sprint',week,timeMs}  → submit a clear time (keeps best)
 * POST /api/tetris {mode:'zen',ms}              → submit a survival time (keeps best)
 *
 * Two leaderboards, both keyed by verified school email with a server-derived
 * display name (emails never returned; your own row is flagged `you`):
 *   - Sprint: weekly, ranked by SHORTEST time, resets with the piece seed.
 *   - Zen:    all-time (never resets), ranked by LONGEST survival.
 *
 * Also (added later, separate tables so existing data is untouched):
 *   ?mode=sprintall  → all-time fastest Sprint clears (sprint_best)
 *   ?mode=zenscore   → Zen scoreboard: each player's current score + all-time best (zen_board)
 *
 * Tables:
 *   tetris_score(email, week, name, time_ms, created_at, pk(email, week))
 *   zen_score(email primary key, name, ms, created_at)
 *   sprint_best(email primary key, name, time_ms, created_at)
 *   zen_board(email primary key, name, current, best, updated_at)
 */

import { db, whoami } from "./_supabase.js";

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

const SPRINT_MIN = 3000, SPRINT_MAX = 3600000;   // 3s … 1h
const ZEN_MIN = 2000, ZEN_MAX = 7200000;         // 2s … 2h

async function sprintBoard(me, week) {
  const { data: top } = await db.from("tetris_score")
    .select("name, time_ms, email").eq("week", week)
    .order("time_ms", { ascending: true }).limit(20);
  const { data: mine } = await db.from("tetris_score")
    .select("time_ms").eq("email", me.email).eq("week", week).maybeSingle();
  const meBest = mine ? mine.time_ms : null;
  let meRank = null;
  if (meBest != null) {
    const { count } = await db.from("tetris_score")
      .select("*", { count: "exact", head: true }).eq("week", week).lt("time_ms", meBest);
    meRank = (count || 0) + 1;
  }
  return { mode: "sprint", top: (top || []).map(r => ({ name: r.name, time_ms: r.time_ms, you: r.email === me.email })), meBest, meRank };
}

async function zenBoard(me) {
  const { data: top } = await db.from("zen_score")
    .select("name, ms, email").order("ms", { ascending: false }).limit(20);
  const { data: mine } = await db.from("zen_score")
    .select("ms").eq("email", me.email).maybeSingle();
  const meBest = mine ? mine.ms : null;
  let meRank = null;
  if (meBest != null) {
    const { count } = await db.from("zen_score")
      .select("*", { count: "exact", head: true }).gt("ms", meBest);   // longer is better
    meRank = (count || 0) + 1;
  }
  return { mode: "zen", top: (top || []).map(r => ({ name: r.name, time_ms: r.ms, you: r.email === me.email })), meBest, meRank };
}

/* all-time fastest Sprint clears (separate table from the weekly tetris_score) */
async function sprintAllBoard(me) {
  const { data: top } = await db.from("sprint_best")
    .select("name, time_ms, email").order("time_ms", { ascending: true }).limit(20);
  const { data: mine } = await db.from("sprint_best")
    .select("time_ms").eq("email", me.email).maybeSingle();
  const meBest = mine ? mine.time_ms : null;
  let meRank = null;
  if (meBest != null) {
    const { count } = await db.from("sprint_best").select("*", { count: "exact", head: true }).lt("time_ms", meBest);
    meRank = (count || 0) + 1;
  }
  return { mode: "sprintall", top: (top || []).map(r => ({ name: r.name, time_ms: r.time_ms, you: r.email === me.email })), meBest, meRank };
}

/* Zen scoreboard: each player's most recent score alongside their all-time best */
async function zenScoreBoard(me) {
  const { data: top } = await db.from("zen_board")
    .select("name, current, best, email").order("best", { ascending: false }).limit(20);
  const { data: mine } = await db.from("zen_board")
    .select("current, best").eq("email", me.email).maybeSingle();
  const meBest = mine ? mine.best : null, meCurrent = mine ? mine.current : null;
  let meRank = null;
  if (meBest != null) {
    const { count } = await db.from("zen_board").select("*", { count: "exact", head: true }).gt("best", meBest);
    meRank = (count || 0) + 1;
  }
  return { mode: "zenscore", top: (top || []).map(r => ({ name: r.name, current: r.current, best: r.best, you: r.email === me.email })), meBest, meCurrent, meRank };
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

  if (req.method === "GET") {
    const mode = req.query.mode;
    if (mode === "zen") return res.status(200).json(await zenBoard(me));
    if (mode === "sprintall") return res.status(200).json(await sprintAllBoard(me));
    if (mode === "zenscore") return res.status(200).json(await zenScoreBoard(me));
    const week = weekOf(req.query.week);
    if (week === null) return res.status(400).json({ error: "A valid week is required." });
    return res.status(200).json(await sprintBoard(me, week));
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    const mode = (body && body.mode) || "sprint";
    const name = nameFromEmail(me.email);

    if (mode === "sprintall") {
      const timeMs = Math.round(Number(body && body.timeMs));
      if (!Number.isFinite(timeMs) || timeMs < SPRINT_MIN || timeMs > SPRINT_MAX) return res.status(400).json({ error: "That time is out of range." });
      const { data: ex } = await db.from("sprint_best").select("time_ms").eq("email", me.email).maybeSingle();
      if (!ex || timeMs < ex.time_ms) {
        const { error } = await db.from("sprint_best").upsert({ email: me.email, name, time_ms: timeMs });
        if (error) { console.error("sprint_best upsert:", error.message); return res.status(502).json({ error: "Couldn't save your time." }); }
      }
      return res.status(200).json(await sprintAllBoard(me));
    }

    if (mode === "zenscore") {
      const score = Math.round(Number(body && body.score));
      if (!Number.isFinite(score) || score < 0 || score > 100000000) return res.status(400).json({ error: "That score is out of range." });
      const { data: ex } = await db.from("zen_board").select("best").eq("email", me.email).maybeSingle();
      const best = Math.max(score, ex ? ex.best : 0);
      const { error } = await db.from("zen_board").upsert({ email: me.email, name, current: score, best, updated_at: new Date().toISOString() });
      if (error) { console.error("zen_board upsert:", error.message); return res.status(502).json({ error: "Couldn't save your score." }); }
      return res.status(200).json(await zenScoreBoard(me));
    }

    if (mode === "zen") {
      const ms = Math.round(Number(body && body.ms));
      if (!Number.isFinite(ms) || ms < ZEN_MIN || ms > ZEN_MAX) return res.status(400).json({ error: "That time is out of range." });
      const { data: existing } = await db.from("zen_score").select("ms").eq("email", me.email).maybeSingle();
      if (!existing || ms > existing.ms) {                 // keep the LONGEST survival
        const { error } = await db.from("zen_score").upsert({ email: me.email, name, ms });
        if (error) { console.error("zen upsert:", error.message); return res.status(502).json({ error: "Couldn't save your time." }); }
      }
      return res.status(200).json(await zenBoard(me));
    }

    const week = weekOf(body && body.week);
    const timeMs = Math.round(Number(body && body.timeMs));
    if (week === null) return res.status(400).json({ error: "A valid week is required." });
    if (!Number.isFinite(timeMs) || timeMs < SPRINT_MIN || timeMs > SPRINT_MAX) return res.status(400).json({ error: "That time is out of range." });
    const { data: existing } = await db.from("tetris_score").select("time_ms").eq("email", me.email).eq("week", week).maybeSingle();
    if (!existing || timeMs < existing.time_ms) {          // keep the FASTEST clear
      const { error } = await db.from("tetris_score").upsert({ email: me.email, week, name, time_ms: timeMs });
      if (error) { console.error("tetris upsert:", error.message); return res.status(502).json({ error: "Couldn't save your time." }); }
    }
    return res.status(200).json(await sprintBoard(me, week));
  }

  return res.status(405).json({ error: "Method not allowed" });
}
