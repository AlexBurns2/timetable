/*
 * GET    /api/gamestate?mode=zen|survival   → { state } (or { state: null })
 * PUT    /api/gamestate {mode, state}        → save the board state
 * DELETE /api/gamestate?mode=zen|survival    → clear it (on game over / new game)
 *
 * One saved board per (email, mode) so Zen and Survival games can continue on
 * another device. Manual — the client saves on a button press, not continuously.
 * Same identity model as the rest (whoami-verified school login).
 *
 * Table:
 *   game_state(email, mode, state jsonb, updated_at, primary key (email, mode))
 */

import { db, whoami } from "./_supabase.js";

const MODES = new Set(["zen", "survival"]);
const MAX_BYTES = 200000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "Saving isn't configured on the server." });

  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to save your game." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const mode = String((req.method === "PUT" ? (body && body.mode) : req.query.mode) || "");
  if (!MODES.has(mode)) return res.status(400).json({ error: "That mode can't be saved." });

  if (req.method === "GET") {
    const { data, error } = await db.from("game_state")
      .select("state").eq("email", me.email).eq("mode", mode).maybeSingle();
    if (error) { console.error("gamestate get:", error.message); return res.status(502).json({ error: "Couldn't load your saved game." }); }
    return res.status(200).json({ state: data ? data.state : null });
  }

  if (req.method === "PUT") {
    const state = body && body.state;
    if (!state || typeof state !== "object") return res.status(400).json({ error: "No state to save." });
    if (JSON.stringify(state).length > MAX_BYTES) return res.status(413).json({ error: "Saved game is too large." });
    const { error } = await db.from("game_state")
      .upsert({ email: me.email, mode, state, updated_at: new Date().toISOString() });
    if (error) { console.error("gamestate put:", error.message); return res.status(502).json({ error: "Couldn't save your game." }); }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { error } = await db.from("game_state").delete().eq("email", me.email).eq("mode", mode);
    if (error) { console.error("gamestate delete:", error.message); return res.status(502).json({ error: "Couldn't clear the saved game." }); }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
