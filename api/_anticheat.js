// Checks a score before it goes on a board. Anything odd gets held (_review.js), not thrown away.
//
// Loosened on 27 November 2026 (the owner: "its basically only catching legit players"). A score is held now only for
// what a person can't do: a browser driven by automation, key presses made by a script, a score bigger than its own
// replay gives, or a pace beyond anyone's. Gone: the timing heuristics (turns locked to the game clock, timing "too
// even", pieces within a frame, a machine pace, near a full board), a replay that doesn't follow (the in-page games
// are their own code, not tasengine.js, so an honest run can drift from the copy), and the typing limit (the 250 cap
// in _runs.js scoreFits still holds). Honest players play fast and evenly; none of those proved anything.
import { snakeReplay, g2048Replay, tetrisCheck } from "../tasengine.js";

const nums = (a, max) => Array.isArray(a) ? a.slice(-max).map(Number).filter(Number.isFinite) : [];

export function spread(xs) {
  if (!xs.length) return { mean: 0, cv: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, cv: mean > 0 ? sd / mean : 0 };
}

// 0 = presses all over the place between steps, 1 = always at the same moment (kept for the TAS tools; not a reason to hold)
export function clockLock(phases) {
  let c = 0, s = 0;
  for (const p of phases) { c += Math.cos(2 * Math.PI * p); s += Math.sin(2 * Math.PI * p); }
  return phases.length ? Math.hypot(c, s) / phases.length : 0;
}

// ac.u: made-up key presses since the game began (games.js counts only keydown/keyup now; a few can come from an
// extension, a script playing sends hundreds). ac.wd: the browser says it's driven by automation.
export function inputSigns(ac) {
  const why = [];
  if (!ac || typeof ac !== "object") return why;
  if (Number(ac.u) >= 20) why.push("keys pressed by a script, not a keyboard");
  if (ac.wd === true) why.push("browser driven by automation");
  return why;
}

// placement times in ms from the start of the game: only an average beyond anyone's (the 40-line record is about 7 a second)
export function paceSigns(times) {
  const why = [], t = nums(times, 3000);
  if (t.length < 40) return why;
  const span = (t[t.length - 1] - t[0]) / 1000;
  if (span > 0 && (t.length - 1) / span > 12) why.push("placing pieces faster than any person");
  return why;
}

// Snake: the replay only stops a score that's been made bigger than the run. If the replay can't follow, the score is
// kept (it still has to fit the time played).
export function vetSnake(seed, run, score, age) {
  if (seed == null || !run || typeof run !== "object") return { why: [] };
  const r = snakeReplay(seed, run.turns, run.end);
  if (!r || !r.ok) return { why: [] };
  const why = [];
  if (score > r.score + 3) why.push("sent " + score + " but the replay scores " + r.score);
  if (age < r.ms * 0.5 - 3000) why.push("finished faster than the game runs");
  return { why };
}

export function vet2048(seed, run, score, age) {
  if (seed == null || !run || typeof run !== "object") return { why: [] };
  const r = g2048Replay(seed, run.moves);
  if (!r || !r.ok) return { why: [] };
  const why = [];
  if (score > r.score * 1.25 + 200) why.push("sent " + score + " but the replay scores " + r.score);
  if (age < r.moves * 40 - 3000) why.push("moved faster than any person");          // 25 moves a second, all game
  return { why };
}

export const sprintSeed = week => 0x9e3779b9 ^ week;

export function vetSprint(week, run, timeMs, age) {
  const why = [];
  if (timeMs > age + 3000) why.push("finished faster than the clock allows");
  const log = run && Array.isArray(run.log) ? run.log : null;
  if (week == null || !log) return { why };
  why.push(...paceSigns(log.filter(e => e[1] !== "h").map(e => e[0])));
  const r = tetrisCheck(sprintSeed(week), log);
  if (r && r.ok && timeMs < r.ms - 1000) why.push("time is well under the last piece");
  return { score: r && r.ok ? r.ms : null, why };
}

export function vetOther(game, metric, score) {
  const why = [];
  if (game === "react" && metric === "avg3" && score < 100) why.push("faster than human reactions");
  return why;
}

export const botty = why => why.some(w => /script|automation|any person/.test(w));
