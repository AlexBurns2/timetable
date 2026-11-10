/*
 * Daily poll for /andre/. The question is picked on the page (one a day, the
 * same for everyone); this only keeps the votes.
 *
 * GET  /api/poll?day=YYYY-MM-DD            → { counts:[n,…], mine: 0-5 | null }
 * POST /api/poll {day, choice}             → same shape, after saving the vote
 *
 * One vote per person per day, changeable that day. Stored in the existing
 * game_state table (email, mode, state), with mode "poll:<day>", so there is
 * no new table to create. Same whoami-verified identity as the rest.
 */

import { db, whoami } from "./_supabase.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHOICES = 6;

async function tally(day, email) {
  const { data, error } = await db.from("game_state").select("email, state").eq("mode", "poll:" + day).limit(5000);
  if (error) throw error;
  const counts = Array(MAX_CHOICES).fill(0);
  let mine = null;
  for (const r of data || []) {
    const c = r.state && r.state.choice;
    if (!Number.isInteger(c) || c < 0 || c >= MAX_CHOICES) continue;
    counts[c]++;
    if (r.email === email) mine = c;
  }
  return { counts, mine };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!db) return res.status(503).json({ error: "The poll is not configured on the server." });
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to use the poll." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const day = String((req.method === "POST" ? body && body.day : req.query.day) || "");
  // the page's own date, but never far from the server's, so stray days can't pile up
  if (!DAY.test(day) || Math.abs(Date.parse(day) - Date.now()) > 2 * 864e5)
    return res.status(400).json({ error: "That is not today's poll." });

  try {
    if (req.method === "POST") {
      const choice = body && body.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice >= MAX_CHOICES)
        return res.status(400).json({ error: "Pick one of the options." });
      const { error } = await db.from("game_state")
        .upsert({ email: me.email, mode: "poll:" + day, state: { choice }, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    return res.status(200).json(await tally(day, me.email));
  } catch (e) {
    console.error("poll:", e.message);
    return res.status(502).json({ error: "Couldn't reach the poll." });
  }
}
