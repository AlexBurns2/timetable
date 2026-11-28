// Checks a score before it goes on a board. Anything odd gets held (_review.js), not thrown away.
import { snakeReplay, g2048Replay, tetrisCheck } from "../tasengine.js";

const nums = (a, max) => Array.isArray(a) ? a.slice(-max).map(Number).filter(Number.isFinite) : [];

export function spread(xs) {
  if (!xs.length) return { mean: 0, cv: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, cv: mean > 0 ? sd / mean : 0 };
}

// 0 = presses all over the place between steps, 1 = always at the same moment
export function clockLock(phases) {
  let c = 0, s = 0;
  for (const p of phases) { c += Math.cos(2 * Math.PI * p); s += Math.sin(2 * Math.PI * p); }
  return phases.length ? Math.hypot(c, s) / phases.length : 0;
}

export function inputSigns(ac) {
  const why = [];
  if (!ac || typeof ac !== "object") return why;
  if (Number(ac.u) > 0) why.push("input sent by a script, not a keyboard or screen");
  if (ac.wd === true) why.push("browser driven by automation");
  return why;
}

// placement times in ms from the start of the game
export function paceSigns(times) {
  const why = [], t = nums(times, 3000);
  if (t.length < 20) return why;
  const span = (t[t.length - 1] - t[0]) / 1000;
  if (span > 0 && (t.length - 1) / span > 9) why.push("placing pieces faster than the world record pace");
  const gaps = t.slice(1).map((v, i) => v - t[i]);
  if (gaps.filter(g => g < 17).length >= 12) why.push("pieces placed within a frame of each other");
  if (gaps.length >= 60 && spread(gaps).cv < 0.08) why.push("placement timing too even");
  return why;
}

export function vetSnake(seed, run, score, age) {
  if (seed == null) return { why: ["no seed on the ticket"] };
  const r = run && typeof run === "object" ? snakeReplay(seed, run.turns, run.end) : null;
  if (!r || !r.ok) return { why: ["replay doesn't match the game" + (r && r.why ? " (" + r.why + ")" : "")] };
  const why = [];
  if (r.score !== score) why.push("sent " + score + " but the replay scores " + r.score);
  if (age < r.ms * 0.9 - 1500) why.push("finished faster than the game runs");
  if (r.score > 230) why.push("close to a full board");
  const ph = nums(run.ph, 500).filter(p => p >= 0 && p <= 1);
  if (ph.length >= 40 && clockLock(ph) > 0.9) why.push("turns locked to the game clock");
  return { score: r.score, why };
}

export function vet2048(seed, run, score, age) {
  if (seed == null) return { why: ["no seed on the ticket"] };
  const r = run && typeof run === "object" ? g2048Replay(seed, run.moves) : null;
  if (!r || !r.ok) return { why: ["replay doesn't match the game" + (r && r.why ? " (" + r.why + ")" : "")] };
  const why = [];
  if (score > r.score) why.push("sent " + score + " but the replay scores " + r.score);
  if (age < r.moves * 117 - 1500) why.push("moved faster than the game allows");
  if (r.moves >= 600 && r.moves / Math.max(1, age / 1000) > 7) why.push("kept up a machine pace");
  const dt = nums(run.dt, 800).filter(v => v > 0 && v < 5000);
  if (dt.length >= 200 && spread(dt).cv < 0.07) why.push("move timing too even");
  return { score: r.score, why };
}

export const sprintSeed = week => 0x9e3779b9 ^ week;

export function vetSprint(week, run, timeMs, age) {
  if (week == null) return { why: ["no week on the run"] };
  const log = run && Array.isArray(run.log) ? run.log : null;
  const r = log ? tetrisCheck(sprintSeed(week), log) : null;
  if (!r || !r.ok) return { why: ["replay doesn't match the game" + (r && r.why ? " (" + r.why + ")" : "")] };
  const why = [];
  if (Math.abs(r.ms - timeMs) > 50) why.push("time doesn't match the last piece");
  if (timeMs > age + 3000) why.push("finished faster than the clock allows");
  why.push(...paceSigns(log.filter(e => e[1] !== "h").map(e => e[0])));
  return { score: r.ms, why };
}

export function vetOther(game, metric, score) {
  const why = [];
  if (game === "react" && metric === "avg3" && score < 100) why.push("faster than human reactions");
  if (game === "typing" && score > 200) why.push("faster than the typing world record");
  return why;
}
