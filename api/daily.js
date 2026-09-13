/*
 * GET  /api/daily[?date=YYYY-MM-DD]   → that day's puzzle state for the caller
 *      { date, today, year, candidates:[names], hints:[revealed…], totalHints,
 *        guesses, done, won, streak, history:[{date,done,won}], answer? }
 * POST /api/daily {guess, date?}       → grade one guess (answer stays server-side)
 *      { correct, done, won, guesses, totalHints, streak, nextHint?, answer? }
 *
 * The mystery person is chosen and stored server-side (see _daily.js); the
 * browser only ever receives the candidate name list and the hints unlocked so
 * far. `date` lets you play past days (within the last 30); it defaults to today
 * (Sydney). Hints are recomputed from the stored name on every read, so hint
 * changes apply immediately without regenerating stored puzzles.
 */

import { db, whoami } from "./_supabase.js";
import { ensurePuzzle, resolveYear, computeStreak, sydneyDate, buildHints } from "./_daily.js";

const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const shiftDate = (d, delta) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + delta); return x.toISOString().slice(0, 10); };

const HISTORY_DAYS = 14;
const EPOCH = "2026-09-01";   // the first day the site had daily puzzles — nothing before this

/* a real YYYY-MM-DD, from EPOCH up to today (Sydney) */
function cleanDate(d, today) {
  if (!d) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return null;
  if (d > today || d < EPOCH) return null;
  return d;
}

async function wonDatesFor(email) {
  const { data } = await db.from("daily_result")
    .select("date").eq("email", email).eq("won", true)
    .order("date", { ascending: false }).limit(120);
  return (data || []).map(r => r.date);
}
async function historyFor(email, today) {
  const { data } = await db.from("daily_result")
    .select("date, done, won").eq("email", email)
    .gte("date", shiftDate(today, -(HISTORY_DAYS - 1))).lte("date", today);
  return (data || []).map(r => ({ date: r.date, done: !!r.done, won: !!r.won }));
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}
/* how everyone in the year went on one day: win/loss, a guess-count histogram,
   and the names in each bucket (for the hover tooltip; capped so it stays small) */
async function summaryFor(year, date, totalHints) {
  const { data } = await db.from("daily_result")
    .select("email, guesses, won, done").eq("year", String(year)).eq("date", date);
  const rows = data || [];
  const dist = {}, names = {}; for (let i = 1; i <= totalHints; i++){ dist[i] = 0; names[i] = []; }
  names.lost = [];
  let played = 0, wins = 0;
  const push = (k, email) => { if (names[k].length < 40) names[k].push(nameFromEmail(email)); };
  for (const r of rows) {
    if (r.done) played++;
    if (r.won) { wins++; if (r.guesses >= 1 && r.guesses <= totalHints){ dist[r.guesses]++; push(r.guesses, r.email); } }
    else if (r.done) push("lost", r.email);
  }
  return { played, wins, losses: played - wins, totalHints, dist, names };
}
/* every past day (from EPOCH) that actually has results, newest first */
async function archiveFor(year, today) {
  const { data } = await db.from("daily_result")
    .select("date, won, done").eq("year", String(year)).gte("date", EPOCH).lte("date", today);
  const by = {};
  for (const r of (data || [])) {
    const d = by[r.date] || (by[r.date] = { date: r.date, played: 0, wins: 0 });
    if (r.done) d.played++; if (r.won) d.wins++;
  }
  return Object.values(by).sort((a, b) => b.date.localeCompare(a.date));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The daily puzzle is not configured on the server." });

  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in with your school account to play." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const rawDate = req.method === "POST" ? (body && body.date) : req.query.date;

  let year, today, date, puzzle;
  try {
    year = await resolveYear(me);
    if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
    today = sydneyDate();
    date = cleanDate(rawDate, today);
    if (!date) return res.status(400).json({ error: "That day isn't available to play." });
    puzzle = await ensurePuzzle(db, year, date);
  } catch (e) {
    console.error("daily setup:", e.message);
    return res.status(502).json({ error: e.message || "Couldn't load the puzzle." });
  }

  const t = puzzle.target || {};
  const first = t.first || String(t.name || "").split(" ")[0];
  const last = t.last || String(t.name || "").split(" ").slice(1).join(" ");
  // recomputed each read → hint changes go live; the seed keeps the order the
  // same for everyone in the year all day. Older puzzles have no subjects and
  // simply fall back to name-shape hints.
  const hints = buildHints(first, last,
    { seed: date + ":" + year, subjects: t.subjects, teachers: t.teachers });
  const totalHints = hints.length;
  const answerName = t.name;

  const { data: result } = await db.from("daily_result")
    .select("guesses, won, done").eq("email", me.email).eq("date", date).maybeSingle();
  let guesses = (result && result.guesses) || 0;
  let done = !!(result && result.done);
  let won = !!(result && result.won);

  if (req.method === "GET") {
    if (req.query.archive) return res.status(200).json({ epoch: EPOCH, today, archive: await archiveFor(year, today) });
    if (req.query.summary) return res.status(200).json({ date, summary: await summaryFor(year, date, totalHints) });
    // how many hints the player has already seen (one per wrong guess).
    const shown = done ? Math.min(guesses, totalHints) : Math.min(guesses + 1, totalHints);
    const streak = computeStreak(await wonDatesFor(me.email), today);
    return res.status(200).json({
      date, today, epoch: EPOCH, year, candidates: puzzle.candidates || [],
      hints, shown, totalHints, guesses, done, won, streak,   // full hints + how many are already unlocked
      history: await historyFor(me.email, today),
      answer: answerName                                       // sent so the browser can grade instantly
    });
  }

  if (req.method === "POST") {
    if (done) {
      const streak = computeStreak(await wonDatesFor(me.email), today);
      return res.status(200).json({ correct: won, done: true, won, guesses, totalHints, streak, answer: answerName });
    }

    const guess = body && body.guess;
    if (!guess || typeof guess !== "string") return res.status(400).json({ error: "A guess is required." });

    const correct = norm(guess) === norm(answerName);
    guesses += 1;
    won = correct;
    done = correct || guesses >= totalHints;

    const { error } = await db.from("daily_result").upsert({
      email: me.email, date, year, guesses, won, done, updated_at: new Date().toISOString()
    });
    if (error) { console.error("daily result:", error.message); return res.status(502).json({ error: "Couldn't save your guess." }); }

    const streak = computeStreak(await wonDatesFor(me.email), today);
    const nextHint = (!done && guesses < totalHints) ? hints[guesses] : undefined;
    return res.status(200).json({
      correct, done, won, guesses, totalHints, streak, nextHint,
      answer: done ? answerName : undefined
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
