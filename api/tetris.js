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
 * Tables:
 *   tetris_score(email, week, name, time_ms, created_at, pk(email, week))
 *   zen_score(email primary key, name, ms, created_at)
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
    const mode = req.query.mode === "zen" ? "zen" : "sprint";
    if (mode === "zen") return res.status(200).json(await zenBoard(me));
    const week = weekOf(req.query.week);
    if (week === null) return res.status(400).json({ error: "A valid week is required." });
    return res.status(200).json(await sprintBoard(me, week));
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    const mode = body && body.mode === "zen" ? "zen" : "sprint";
    const name = nameFromEmail(me.email);

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
