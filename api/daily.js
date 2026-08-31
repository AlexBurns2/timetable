/*
 * GET  /api/daily            → today's puzzle state for the caller's year
 *      { date, year, candidates:[names], hints:[revealed…], totalHints,
 *        guesses, done, won, streak, answer? }
 * POST /api/daily {guess}     → grade one guess (answer stays server-side)
 *      { correct, done, won, guesses, totalHints, streak, nextHint?, answer? }
 *
 * The mystery person is chosen and stored server-side (see _daily.js); the
 * browser only ever receives the candidate name list and the hints unlocked so
 * far. One hint is shown to start, one more per wrong guess; you get as many
 * guesses as there are hints.
 */

import { db, whoami } from "./_supabase.js";
import { ensurePuzzle, resolveYear, computeStreak, sydneyDate } from "./_daily.js";

const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

async function wonDatesFor(email) {
  const { data } = await db.from("daily_result")
    .select("date").eq("email", email).eq("won", true)
    .order("date", { ascending: false }).limit(120);
  return (data || []).map(r => r.date);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The daily puzzle is not configured on the server." });

  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in with your school account to play." });

  let year, date, puzzle;
  try {
    year = await resolveYear(me);
    if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
    date = sydneyDate();
    puzzle = await ensurePuzzle(db, year, date);
  } catch (e) {
    console.error("daily setup:", e.message);
    return res.status(502).json({ error: e.message || "Couldn't load today's puzzle." });
  }

  const hints = (puzzle.target && puzzle.target.hints) || [];
  const totalHints = hints.length;
  const answerName = puzzle.target && puzzle.target.name;

  const { data: result } = await db.from("daily_result")
    .select("guesses, won, done").eq("email", me.email).eq("date", date).maybeSingle();
  let guesses = (result && result.guesses) || 0;
  let done = !!(result && result.done);
  let won = !!(result && result.won);

  if (req.method === "GET") {
    const revealed = hints.slice(0, Math.min(guesses + 1, totalHints));
    const streak = computeStreak(await wonDatesFor(me.email), date);
    return res.status(200).json({
      date, year, candidates: puzzle.candidates || [],
      hints: revealed, totalHints, guesses, done, won, streak,
      answer: done ? answerName : undefined
    });
  }

  if (req.method === "POST") {
    if (done) {
      const streak = computeStreak(await wonDatesFor(me.email), date);
      return res.status(200).json({ correct: won, done: true, won, guesses, totalHints, streak, answer: answerName });
    }

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
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

    const streak = computeStreak(await wonDatesFor(me.email), date);
    const nextHint = (!done && guesses < totalHints) ? hints[guesses] : undefined;
    return res.status(200).json({
      correct, done, won, guesses, totalHints, streak, nextHint,
      answer: done ? answerName : undefined
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
