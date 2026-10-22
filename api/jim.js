/*
 * GET  /api/jim                    → { scores: [{ name, score }, …] }  (highest first)
 * POST /api/jim { name, add }      → { score }   add 1–500 presses to that name
 * POST /api/jim { name, reset:true } → { score:0 }
 *
 * The Jim Button's shared "Hall of Pressers". Unlike every other board this one
 * does NOT use whoami: a player is just the first name they type, exactly as
 * in the original Firebase version, so it keeps working when the school API is
 * down. Anyone can press under any name — that is the game.
 *
 * Presses are batched by the client (one POST per ~second of pressing), and
 * the increment is done in SQL so two tabs pressing at once never lose a press.
 *
 * Table + function (SQL in SETUP.md):
 *   jim_score(name text primary key, score bigint, updated_at timestamptz)
 *   jim_press(p_name text, p_add int) returns bigint
 */

import { db } from "./_supabase.js";

const MAX_ADD = 500;          // presses per request; turbo mode at full tilt stays well under
const MAX_ROWS = 1000;

/* same shape the original accepted: up to 18 characters, stored uppercase */
function cleanName(raw) {
  const n = String(raw || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!n || n.length > 18) return null;
  if (!/^[A-Z0-9][A-Z0-9 .'_-]*$/.test(n)) return null;
  return n;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The scoreboard isn't configured on the server." });

  if (req.method === "GET") {
    const { data, error } = await db.from("jim_score")
      .select("name, score").gt("score", 0)
      .order("score", { ascending: false }).limit(MAX_ROWS);
    if (error) { console.error("jim get:", error.message); return res.status(502).json({ error: "Couldn't load the scoreboard." }); }
    return res.status(200).json({ scores: data || [] });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    const name = cleanName(body && body.name);
    if (!name) return res.status(400).json({ error: "That name can't be used." });

    if (body.reset === true) {
      const { error } = await db.from("jim_score")
        .upsert({ name, score: 0, updated_at: new Date().toISOString() });
      if (error) { console.error("jim reset:", error.message); return res.status(502).json({ error: "Couldn't reset." }); }
      return res.status(200).json({ score: 0 });
    }

    const add = Math.floor(Number(body.add));
    if (!(add >= 1 && add <= MAX_ADD)) return res.status(400).json({ error: "Bad press count." });
    const { data, error } = await db.rpc("jim_press", { p_name: name, p_add: add });
    if (error) { console.error("jim press:", error.message); return res.status(502).json({ error: "Couldn't save the press." }); }
    return res.status(200).json({ score: Number(data) || 0 });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
