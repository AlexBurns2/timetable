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
 * Hong Kong Mahjong (mode=hkmj) saves one small row of stats per person, written
 * once per finished game, so it is held to MAX_HKMJ.
 *
 * Online chess (mode=chess): one row per game under the key "chess:<CODE>".
 * GET ?mode=chess&code=X reads it; PUT {mode:"chess", action, …} changes it, where
 * GET ?mode=chess&list=1 lists public games that are waiting or being played.
 * action is create {color, mins, inc, pub} | join {code} | move {code, uci, ply} |
 * resign {code} | draw {code} (offer, or accept the other side's offer) | decline {code}.
 * Every move is checked against the full rules in /chess.js and must be the
 * mover's turn. Emails stay on the server; players see each other's names.
 *
 * Table:
 *   game_state(email, mode, state jsonb, updated_at, primary key (email, mode))
 */

import { db, whoami, isAdmin } from "./_supabase.js";
import { nameFromLocal } from "./_names.js";

const MODES = new Set(["zen", "survival", "mahjong", "hkmj", "chess"]);
const MAX_BYTES = 200000, MAX_HKMJ = 8000;

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
  if (mode === "mahjong") return mahjong(req, res, body, me);
  if (mode === "chess") return chess(req, res, body, me);

  if (req.method === "GET") {
    const { data, error } = await db.from("game_state")
      .select("state").eq("email", me.email).eq("mode", mode).maybeSingle();
    if (error) { console.error("gamestate get:", error.message); return res.status(502).json({ error: "Couldn't load your saved game." }); }
    return res.status(200).json({ state: data ? data.state : null });
  }

  if (req.method === "PUT") {
    const state = body && body.state;
    if (!state || typeof state !== "object") return res.status(400).json({ error: "No state to save." });
    if (JSON.stringify(state).length > (mode === "hkmj" ? MAX_HKMJ : MAX_BYTES)) return res.status(413).json({ error: "Saved game is too large." });
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

async function mahjong(req, res, body, me) {
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
  } else if (["renamePlayer", "removePlayer", "deleteRound"].includes(action)) {
    /* moderator clean-up: tidy a name, take someone off the sheet, or delete
       any one game (not just the last). A removed player's points leave the
       totals with them; everyone else's stay as they were. */
    if (!isAdmin(me && me.email)) return res.status(403).json({ error: "Only moderators can do that." });
    if (action === "deleteRound") {
      const at = Number(body.t);
      const i = state.rounds.findIndex(r => r.t === at);
      if (i < 0) return res.status(404).json({ error: "That game is already gone." });
      state.rounds.splice(i, 1);
    } else {
      const p = state.players.find(x => x.id === Number(body.id));
      if (!p) return res.status(404).json({ error: "That player is already gone." });
      if (action === "removePlayer") {
        state.players = state.players.filter(x => x !== p);
        state.rounds = state.rounds.map(r => { const d = { ...r.d }; delete d[p.id]; return { ...r, d }; })
                                   .filter(r => Object.keys(r.d).length);
      } else {
        const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 30);
        if (!name) return res.status(400).json({ error: "Give the player a name." });
        if (state.players.some(x => x !== p && x.name.toLowerCase() === name.toLowerCase()))
          return res.status(400).json({ error: name + " is already playing." });
        p.name = name;
      }
    }
  } else {
    return res.status(400).json({ error: "Unknown action." });
  }

  /* shortcut: read-modify-write, so two saves in the same instant can still lose one; fine for one table of friends */
  const { error } = await db.from("game_state")
    .upsert({ email: MJ_KEY, mode: "mahjong", state, updated_at: new Date().toISOString() });
  if (error) { console.error("mahjong put:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
  return res.status(200).json({ state });
}

/* ── online chess ── */
const CH_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CH_DAYS = 30;                         /* games left alone this long are cleared when a new one starts */
const chKey = code => "chess:" + code;
const chCode = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

async function chLoad(code) {
  const { data, error } = await db.from("game_state")
    .select("state").eq("email", chKey(code)).eq("mode", "chess").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.state : null;
}
const chSave = (code, state) => db.from("game_state")
  .upsert({ email: chKey(code), mode: "chess", state, updated_at: new Date().toISOString() });

/* the side to move runs out of time? Clocks start once both sides have moved once. */
function chFlag(st, now) {
  if (!st.clock || st.result || st.moves.length < 2) return false;
  const side = st.moves.length % 2 ? "b" : "w";
  if (st.clock[side] - (now - st.at) > 0) return false;
  /* shortcut: a flag always loses, even when the other side couldn't mate; add the FIDE insufficient-material check if anyone minds */
  st.clock[side] = 0; st.result = side === "w" ? "0-1" : "1-0"; st.reason = "time"; st.offer = null;
  return true;
}

/* what a player sees: names, not emails */
const chView = (code, st, me) => ({
  code, white: st.wn || null, black: st.bn || null,
  you: st.w === me.email ? "w" : st.b === me.email ? "b" : null,
  pub: !!st.pub, tc: st.tc || null, moves: st.moves, result: st.result || null, reason: st.reason || null, offer: st.offer || null,
  clock: st.clock || null, at: st.at || null, now: Date.now()
});

async function chess(req, res, body, me) {
  const name = nameFromLocal(String(me.email).split("@")[0]) || "Player";
  const action = req.method === "PUT" ? String((body && body.action) || "") : "";
  if (req.method !== "GET" && req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (action === "create") {
      const mins = Math.max(0, Math.min(60, Math.round(Number(body.mins) || 0)));
      const inc = Math.max(0, Math.min(30, Math.round(Number(body.inc) || 0)));
      let color = String(body.color || "");
      if (color !== "w" && color !== "b") color = Math.random() < 0.5 ? "w" : "b";
      let code = "";
      for (let i = 0; i < 6 && !code; i++) {
        const c = Array.from({ length: 6 }, () => CH_LETTERS[Math.floor(Math.random() * CH_LETTERS.length)]).join("");
        if (!(await chLoad(c))) code = c;
      }
      if (!code) return res.status(503).json({ error: "Couldn't make a game code. Try again." });
      const st = { pub: !!body.pub, w: null, b: null, wn: null, bn: null, moves: [], result: null, reason: null, offer: null,
                   clock: mins ? { w: mins * 60000, b: mins * 60000, inc: inc * 1000 } : null, tc: mins ? mins + "+" + inc : null, at: Date.now() };
      st[color] = me.email; st[color + "n"] = name;
      const { error } = await chSave(code, st);
      if (error) throw new Error(error.message);
      /* tidy up old games; failing this doesn't matter */
      db.from("game_state").delete().eq("mode", "chess")
        .lt("updated_at", new Date(Date.now() - CH_DAYS * 864e5).toISOString()).then(() => {}, () => {});
      return res.status(200).json({ game: chView(code, st, me) });
    }

    if (req.method === "GET" && req.query.list) {
      /* public games touched in the last 3 hours: open seats to join, games on to watch */
      const { data, error } = await db.from("game_state").select("email, state").eq("mode", "chess")
        .gt("updated_at", new Date(Date.now() - 3 * 3600e3).toISOString()).order("updated_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      const now = Date.now();
      const games = (data || []).filter(r => r.state && r.state.pub && !r.state.result && !chFlag(r.state, now))
        .slice(0, 30).map(r => ({ code: r.email.slice(6), white: r.state.wn || null, black: r.state.bn || null,
          ply: r.state.moves.length, tc: r.state.tc || null,
          mine: r.state.w === me.email || r.state.b === me.email }));
      return res.status(200).json({ games });
    }

    const code = chCode(req.method === "GET" ? req.query.code : body.code);
    if (!code) return res.status(400).json({ error: "Enter a game code." });
    const st = await chLoad(code);
    if (!st) return res.status(404).json({ error: "No game with that code." });
    const now = Date.now();

    if (req.method === "GET") {
      if (chFlag(st, now)) await chSave(code, st);
      return res.status(200).json({ game: chView(code, st, me) });
    }

    const seat = st.w === me.email ? "w" : st.b === me.email ? "b" : null;
    const other = seat === "w" ? "b" : "w";
    if (action === "join") {
      if (!seat) {
        const free = !st.w ? "w" : !st.b ? "b" : null;
        if (!free) return res.status(409).json({ error: "That game already has two players." });
        st[free] = me.email; st[free + "n"] = name; st.at = now;
      }
    } else {
      if (!seat) return res.status(403).json({ error: "You're not playing in this game." });
      if (chFlag(st, now)) { await chSave(code, st); return res.status(200).json({ game: chView(code, st, me) }); }
      if (st.result) return res.status(409).json({ error: "This game is over." });
      if (!st.w || !st.b) return res.status(409).json({ error: "Wait for someone to join." });

      if (action === "move") {
        if (Number(body.ply) !== st.moves.length) return res.status(409).json({ error: "The board changed. Try again." });
        if ((st.moves.length % 2 ? "b" : "w") !== seat) return res.status(409).json({ error: "It's not your turn." });
        await import("../chess.js");
        const C = globalThis.Chess;
        const { states, ok } = C.replay(st.moves);
        if (!ok) return res.status(500).json({ error: "This game's moves don't add up." });
        const m = C.fromUci(states[states.length - 1], body.uci);
        if (!m) return res.status(400).json({ error: "That move isn't legal." });
        states.push(C.make(states[states.length - 1], m));
        st.moves.push(C.uci(m));
        if (st.clock) {
          if (st.moves.length > 2) st.clock[seat] = Math.max(0, st.clock[seat] - (now - st.at)) + st.clock.inc;
          st.at = now;
        }
        st.offer = null;
        const end = C.outcome(states);
        if (end) { st.result = end.result; st.reason = end.reason; }
      } else if (action === "resign") {
        st.result = seat === "w" ? "0-1" : "1-0"; st.reason = "resignation"; st.offer = null;
      } else if (action === "draw") {
        if (st.offer === other) { st.result = "1/2-1/2"; st.reason = "agreement"; st.offer = null; }
        else st.offer = seat;
      } else if (action === "decline") {
        if (st.offer === other) st.offer = null;
      } else return res.status(400).json({ error: "Unknown action." });
    }

    /* shortcut: read-modify-write; the ply check stops two moves landing at once, a resign racing a move can still lose one */
    const { error } = await chSave(code, st);
    if (error) throw new Error(error.message);
    return res.status(200).json({ game: chView(code, st, me) });
  } catch (e) {
    console.error("chess:", e.message);
    return res.status(502).json({ error: "Couldn't reach the chess game." });
  }
}
