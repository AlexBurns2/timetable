/*
 * GET  /api/tetris?week=N        → this week's top clear-times + your standing
 *      { week, top:[{name,time_ms,you}], meBest, meRank }
 * POST /api/tetris {week,timeMs}  → submit a 40-line time (keeps your best), returns the same
 *
 * Weekly leaderboard for the Tetris sprint. Partitioned by the client's
 * Monday-anchored week number (the same value that seeds the weekly piece
 * order and resets the local best), so the board resets with the game.
 *
 * The display name is derived SERVER-side from the verified school email, so it
 * can't be spoofed and no directory lookup is needed. Emails are never returned
 * to the browser — the caller's own row is flagged with `you` instead.
 *
 * Table:
 *   create table tetris_score (
 *     email text not null, week int not null, name text not null,
 *     time_ms int not null, created_at timestamptz not null default now(),
 *     primary key (email, week)
 *   );
 *
 * Times are client-reported (as with any web leaderboard) — a floor/ceiling
 * rejects obvious garbage, but this is a low-stakes school board, not anti-cheat.
 */

import { db, whoami } from "./_supabase.js";

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

const MIN_MS = 3000, MAX_MS = 3600000;   // 3s floor (anti-garbage), 1h ceiling

async function board(me, week) {
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

  return {
    week,
    top: (top || []).map(r => ({ name: r.name, time_ms: r.time_ms, you: r.email === me.email })),
    meBest, meRank
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

  if (req.method === "GET") {
    const week = weekOf(req.query.week);
    if (week === null) return res.status(400).json({ error: "A valid week is required." });
    return res.status(200).json(await board(me, week));
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    const week = weekOf(body && body.week);
    const timeMs = Math.round(Number(body && body.timeMs));
    if (week === null) return res.status(400).json({ error: "A valid week is required." });
    if (!Number.isFinite(timeMs) || timeMs < MIN_MS || timeMs > MAX_MS) {
      return res.status(400).json({ error: "That time is out of range." });
    }

    const name = nameFromEmail(me.email);
    const { data: existing } = await db.from("tetris_score")
      .select("time_ms").eq("email", me.email).eq("week", week).maybeSingle();

    if (!existing || timeMs < existing.time_ms) {          // keep only the best per person per week
      const { error } = await db.from("tetris_score")
        .upsert({ email: me.email, week, name, time_ms: timeMs });
      if (error) { console.error("tetris upsert:", error.message); return res.status(502).json({ error: "Couldn't save your time." }); }
    }
    return res.status(200).json(await board(me, week));
  }

  return res.status(405).json({ error: "Method not allowed" });
}
