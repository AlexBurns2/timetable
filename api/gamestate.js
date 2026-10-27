/*
 * GET    /api/gamestate?mode=zen|survival   → { state } (or { state: null })
 * PUT    /api/gamestate {mode, state}        → save the board state
 * DELETE /api/gamestate?mode=zen|survival    → clear it (on game over / new game)
 *
 * One saved board per (email, mode) so Zen and Survival games can continue on
 * another device. Manual — the client saves on a button press, not continuously.
 * Same identity model as the rest (whoami-verified school login).
 *
 * Mahjong (mode=mahjong) is the exception: one score sheet shared by everyone,
 * stored in the same table under the non-email key "mahjong". It is changed by
 * actions applied on the server (PUT {mode, action, …}), not whole-state saves,
 * so two people recording at once don't overwrite each other's games.
 *   state = { players:[{id, name}], rounds:[{t, d:{playerId: points}}] }
 *
 * Table:
 *   game_state(email, mode, state jsonb, updated_at, primary key (email, mode))
 */

import { db, whoami } from "./_supabase.js";

const MODES = new Set(["zen", "survival", "mahjong"]);
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
  if (mode === "mahjong") return mahjong(req, res, body);

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

/* ── the shared Mahjong score sheet ── */
const MJ_KEY = "mahjong";
const MJ_MAX_PLAYERS = 30, MJ_MAX_ROUNDS = 5000, MJ_MAX_POINTS = 1000000;

async function mjLoad() {
  const { data, error } = await db.from("game_state")
    .select("state").eq("email", MJ_KEY).eq("mode", "mahjong").maybeSingle();
  if (error) throw new Error(error.message);
  const s = (data && data.state) || {};
  return { players: Array.isArray(s.players) ? s.players : [], rounds: Array.isArray(s.rounds) ? s.rounds : [] };
}

async function mahjong(req, res, body) {
  let state;
  try { state = await mjLoad(); }
  catch (e) { console.error("mahjong get:", e.message); return res.status(502).json({ error: "Couldn't load the scores." }); }
  if (req.method === "GET") return res.status(200).json({ state });
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const action = String((body && body.action) || "");
  if (action === "player") {
    const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 30);
    if (!name) return res.status(400).json({ error: "Give the player a name." });
    if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: name + " is already playing." });
    if (state.players.length >= MJ_MAX_PLAYERS) return res.status(400).json({ error: "That's enough players." });
    state.players.push({ id: Math.max(0, ...state.players.map(p => p.id)) + 1, name });
  } else if (action === "round") {
    const d = {};
    for (const p of state.players) {
      const v = Math.round(Number(body.d && body.d[p.id]));
      if (Number.isFinite(v) && v !== 0) {
        if (Math.abs(v) > MJ_MAX_POINTS) return res.status(400).json({ error: "That's too many points." });
        d[p.id] = v;
      }
    }
    if (!Object.keys(d).length) return res.status(400).json({ error: "Nobody's points changed." });
    if (state.rounds.length >= MJ_MAX_ROUNDS) return res.status(400).json({ error: "The score sheet is full." });
    state.rounds.push({ t: Date.now(), d });
  } else if (action === "undo") {
    if (!state.rounds.length) return res.status(400).json({ error: "No games to undo." });
    state.rounds.pop();
  } else {
    return res.status(400).json({ error: "Unknown action." });
  }

  /* shortcut: read-modify-write, so two saves in the same instant can still lose one; fine for one table of friends */
  const { error } = await db.from("game_state")
    .upsert({ email: MJ_KEY, mode: "mahjong", state, updated_at: new Date().toISOString() });
  if (error) { console.error("mahjong put:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
  return res.status(200).json({ state });
}
