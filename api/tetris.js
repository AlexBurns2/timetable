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
 *
 * Sprint sends every piece placed and gets replayed. Anything off is held for Alex.
 */

import { db, whoami, isAdmin } from "./_supabase.js";
import { displayNames, withName, yearTags, withYear } from "./_names.js";
import { yearMap, boardScope } from "./leaderboard.js";
import { ticketOf, scoreFits, boardWeek } from "./_runs.js";
import { inputSigns, vetSprint, paceSigns, botty } from "./_anticheat.js";
import { holdScore, writeTetris } from "./_review.js";

/* Year groups (as leaderboard.js): each board is your own year's unless you ask
   for another (?year=7…12) or everyone's (?year=all). Scores sent need a ticket
   from when the game started (POST /api/leaderboard {action:"ticket", game:"tetris"}),
   and have to fit the time since. */
/* one board: the top (20, or 200 for a moderator), and your best and place on it */
async function boardOf({ table, col, asc, narrow, extra }, me, adm) {
  const SCOPE = me.scope, YEARS = me.years || new Map();
  const cols = "name, email, " + col + (extra ? ", " + extra : "");
  let q = db.from(table).select(cols); if (narrow) q = narrow(q);
  const { data } = await q.order(col, { ascending: asc }).limit(SCOPE ? 5000 : (adm ? 200 : 20));
  let rows = data || [];
  if (SCOPE) rows = rows.filter(r => YEARS.get(r.email) === SCOPE);
  let mine = rows.find(r => r.email === me.email);
  if (!mine && !SCOPE) { let m = db.from(table).select(col + (extra ? ", " + extra : "")).eq("email", me.email); if (narrow) m = narrow(m);
    ({ data: mine } = await m.maybeSingle()); }
  const meBest = mine ? mine[col] : null;
  let meRank = null;
  if (meBest != null) {
    if (SCOPE) meRank = 1 + rows.filter(r => asc ? r[col] < meBest : r[col] > meBest).length;
    else { let c = db.from(table).select("*", { count: "exact", head: true }); if (narrow) c = narrow(c);
      const { count } = await (asc ? c.lt(col, meBest) : c.gt(col, meBest)); meRank = (count || 0) + 1; }
  }
  return { rows: rows.slice(0, adm ? 200 : 20), mine, meBest, meRank };
}

/* display-name overrides, loaded per request (see _names.js) */
let NAMES = new Map(), TAGS = new Map();      // TAGS: "Year 12" / "Graduate" after each name

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

const SPRINT_MIN = 3000, SPRINT_MAX = 3600000;   // 3s … 1h
const ZEN_MIN = 2000, ZEN_MAX = 7200000;         // 2s … 2h

const yr = me => ({ year: me.scope || "all" });
async function sprintBoard(me, week, adm) {
  const b = await boardOf({ table: "tetris_score", col: "time_ms", asc: true, narrow: q => q.eq("week", week) }, me, adm);
  return { mode: "sprint", ...yr(me), top: b.rows.map(r => ({ name: withYear(withName(NAMES, r.email, r.name), TAGS, r.email), time_ms: r.time_ms, you: r.email === me.email, email: adm ? r.email : undefined })), meBest: b.meBest, meRank: b.meRank, canWipe: adm };
}

async function zenBoard(me, adm) {
  const b = await boardOf({ table: "zen_score", col: "ms", asc: false }, me, adm);   // longer is better
  return { mode: "zen", ...yr(me), top: b.rows.map(r => ({ name: withYear(withName(NAMES, r.email, r.name), TAGS, r.email), time_ms: r.ms, you: r.email === me.email, email: adm ? r.email : undefined })), meBest: b.meBest, meRank: b.meRank, canWipe: adm };
}

/* all-time fastest Sprint clears (separate table from the weekly tetris_score) */
async function sprintAllBoard(me, adm) {
  const b = await boardOf({ table: "sprint_best", col: "time_ms", asc: true }, me, adm);
  return { mode: "sprintall", ...yr(me), top: b.rows.map(r => ({ name: withYear(withName(NAMES, r.email, r.name), TAGS, r.email), time_ms: r.time_ms, you: r.email === me.email, email: adm ? r.email : undefined })), meBest: b.meBest, meRank: b.meRank, canWipe: adm };
}

/* Zen scoreboard: each player's most recent score alongside their all-time best */
async function zenScoreBoard(me, adm) {
  const b = await boardOf({ table: "zen_board", col: "best", asc: false, extra: "current" }, me, adm);
  return { mode: "zenscore", ...yr(me), top: b.rows.map(r => ({ name: withYear(withName(NAMES, r.email, r.name), TAGS, r.email), current: r.current, best: r.best, you: r.email === me.email, email: adm ? r.email : undefined })),
    meBest: b.meBest, meCurrent: b.mine ? b.mine.current : null, meRank: b.meRank, canWipe: adm };
}

/* pick the right board for a mode (used by admin actions to return fresh data) */
function boardFor(mode, me, week, adm) {
  if (mode === "zen") return zenBoard(me, adm);
  if (mode === "sprintall") return sprintAllBoard(me, adm);
  if (mode === "zenscore") return zenScoreBoard(me, adm);
  return sprintBoard(me, week, adm);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The leaderboard is not configured on the server." });

  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to use the leaderboard." });
  [NAMES, TAGS] = await Promise.all([displayNames(), yearTags()]);
  /* which year's boards (kept on this request's own "me", so two requests at once never mix) */
  me.years = await yearMap();
  me.scope = boardScope((req.method === "GET" ? req.query : (typeof req.body === "object" && req.body) || {}).year, me, me.years);
  if (isAdmin(me.email) && ((req.query && req.query.admin) || (req.body && typeof req.body === "object" && req.body.action))) me.scope = null;   // the moderator page: everyone

  const weekOf = v => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= 0 && n < 100000 ? n : null; };

  const isOwner = isAdmin(me.email);

  if (req.method === "GET") {
    const mode = req.query.mode;
    const adm = !!req.query.admin && isOwner;                 // owner-only: include emails + full list
    if (mode === "zen") return res.status(200).json(await zenBoard(me, adm));
    if (mode === "sprintall") return res.status(200).json(await sprintAllBoard(me, adm));
    if (mode === "zenscore") return res.status(200).json(await zenScoreBoard(me, adm));
    const week = weekOf(req.query.week);
    if (week === null) return res.status(400).json({ error: "A valid week is required." });
    return res.status(200).json(await sprintBoard(me, week, adm));
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    const mode = (body && body.mode) || "sprint";
    const name = nameFromEmail(me.email);

    /* ── owner admin actions: edit / delete / wipe a board, or sync sprint bests ── */
    if (body && body.action) {
      if (!isOwner) return res.status(403).json({ error: "Only the owner can edit scores." });
      const action = body.action;
      const wk = weekOf(body.week);

      if (action === "sync") {                                // backfill sprint_best from every weekly time
        const { data: weekly } = await db.from("tetris_score").select("email, time_ms");
        const best = new Map();
        for (const r of (weekly || [])) if (!best.has(r.email) || r.time_ms < best.get(r.email)) best.set(r.email, r.time_ms);
        const { data: cur } = await db.from("sprint_best").select("email, time_ms");
        const curMap = new Map((cur || []).map(r => [r.email, r.time_ms]));
        const rows = [];
        for (const [e, t] of best) if (!curMap.has(e) || t < curMap.get(e)) rows.push({ email: e, name: nameFromEmail(e), time_ms: t });
        if (rows.length) { const { error } = await db.from("sprint_best").upsert(rows);
          if (error) { console.error("sprint sync:", error.message); return res.status(502).json({ error: "Couldn't sync." }); } }
        return res.status(200).json(await sprintAllBoard(me, true));
      }

      const TBL = {
        sprint:    { t: "tetris_score", val: "time_ms" },
        sprintall: { t: "sprint_best",  val: "time_ms" },
        zen:       { t: "zen_score",    val: "ms" },
        zenscore:  { t: "zen_board",    val: "best" }
      }[mode];
      if (!TBL) return res.status(400).json({ error: "Unknown board." });
      if (mode === "sprint" && wk === null) return res.status(400).json({ error: "A valid week is required." });

      if (action === "wipe") {
        let q = db.from(TBL.t).delete();
        q = mode === "sprint" ? q.eq("week", wk) : q.neq("email", "__none__");
        const { error } = await q;
        if (error) { console.error("tetris wipe:", error.message); return res.status(502).json({ error: "Couldn't clear the board." }); }
        return res.status(200).json(await boardFor(mode, me, wk, true));
      }

      const email = String((body && body.email) || "").toLowerCase();
      if (!email) return res.status(400).json({ error: "Which score?" });
      if (action === "delete") {
        let q = db.from(TBL.t).delete().eq("email", email);
        if (mode === "sprint") q = q.eq("week", wk);
        const { error } = await q;
        if (error) { console.error("tetris delete:", error.message); return res.status(502).json({ error: "Couldn't delete." }); }
      } else if (action === "set") {
        const val = Math.round(Number(body && body.value));
        if (!Number.isFinite(val) || val < 0) return res.status(400).json({ error: "That value is out of range." });
        const rec = { email, name: nameFromEmail(email), [TBL.val]: val };
        if (mode === "sprint") rec.week = wk;
        if (mode === "zenscore") rec.current = val;
        const { error } = await db.from(TBL.t).upsert(rec);
        if (error) { console.error("tetris set:", error.message); return res.status(502).json({ error: "Couldn't save." }); }
      } else return res.status(400).json({ error: "Unknown action." });
      return res.status(200).json(await boardFor(mode, me, wk, true));
    }

    /* a ticket from when the game started, and a score that fits the time since */
    const claim = mode === "zenscore" ? Math.round(Number(body && body.score)) : mode === "zen" ? Math.round(Number(body && body.ms)) : Math.round(Number(body && body.timeMs));
    const week = weekOf(body && body.week);
    if (mode === "sprint" && week === null) return res.status(400).json({ error: "A valid week is required." });
    if (mode === "sprint" || mode === "sprintall") {
      if (!Number.isFinite(claim) || claim < SPRINT_MIN || claim > SPRINT_MAX) return res.status(400).json({ error: "That time is out of range." });
    } else if (mode === "zen") {
      if (!Number.isFinite(claim) || claim < ZEN_MIN || claim > ZEN_MAX) return res.status(400).json({ error: "That time is out of range." });
    } else if (mode === "zenscore") {
      if (!Number.isFinite(claim) || claim < 0 || claim > 100000000) return res.status(400).json({ error: "That score is out of range." });
    } else return res.status(400).json({ error: "Unknown board." });

    const tk = await ticketOf(me, "tetris", body && body.ticket), why = [];
    if (!tk) why.push("no ticket from a game");
    else {
      if (!scoreFits("tetris:" + mode, null, claim, tk.age)) why.push("more than fits the time played");
      if (mode === "sprint" || mode === "sprintall") {
        const w = week != null && Math.abs(week - boardWeek()) <= 1 ? week : null;
        why.push(...vetSprint(w, body && body.run, claim, tk.age).why);
      } else why.push(...paceSigns(body && body.run && body.run.pt));
    }
    why.push(...inputSigns(body && body.ac));

    let held = null;
    try {
      if (why.length) {
        await holdScore(me.email, name, { key: "tetris:" + (mode === "sprintall" ? "sprint" : mode), kind: "t", game: "tetris", mode,
          dir: mode === "sprint" || mode === "sprintall" ? "min" : "max", score: claim, week, boards: [mode], why });
        held = { score: claim, tas: botty(why) };
      } else await writeTetris(me.email, name, mode, claim, week);
    } catch (e) { console.error("tetris " + mode + ":", e.message); return res.status(502).json({ error: "Couldn't save that." }); }
    const out = await boardFor(mode, me, week, false);
    return res.status(200).json(held ? { ...out, held } : out);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
