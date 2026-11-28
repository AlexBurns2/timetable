// Same rules on the server and in the page, so a run can be replayed exactly.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const SEEDS = { snake: 271828, g2048: 314159, tetris: 161803 };

export const TAS = {
  snake:  { name: "Snake",  unit: "steps",  keys: "udlr." },
  g2048:  { name: "2048",   unit: "moves",  keys: "udlr" },
  tetris: { name: "Tetris", unit: "frames", keys: "LR<>DVCZAHX." }
};
/* the bots the TAS page starts you with (tas.js); the server knows them too, so two people sending a starter unchanged
   aren't copying each other (api/_tas.js) */
export const STARTER = {
  snake: `// Called every step with the game. Return u d l r, or . to go straight on.
// This one loops round the whole board, so it always fills it (slowly).
function move(g) {
  const [x, y] = g.body[0];
  if (x === 0) return y === 0 ? "r" : "u";
  if (y % 2 === 0) return x < 15 ? "r" : "d";
  return x > 1 ? "l" : y === 15 ? "l" : "d";
}`,
  g2048: `// Called every move with the game. Return u d l r.
// This one tries down, left, right, up, in that order.
function move(g) {
  for (const d of "dlru") if (E.g2048Slide(g.b, d)) return d;
}`,
  tetris: `// Called whenever the game needs input. Return one or more of L R < > D V C Z A H X . (a frame each).
// This one drops each piece where the stack stays lowest with the fewest holes.
let plan = null;
function move(g) {
  const p = g.piece;
  if (!plan || plan.piece !== g.pieces) plan = { piece: g.pieces, tries: 0, ...spot(g) };
  if (++plan.tries > 30) return "X";
  if (p.rot !== plan.r) return "C";
  if (p.x !== plan.x) return p.x > plan.x ? "L" : "R";
  return "X";
}
function spot(g) {
  const t = g.piece.type;
  let best = null;
  for (let r = 0; r < (t === "O" ? 1 : 4); r++) for (let x = -2; x < 10; x++) {
    if (E.tetrisHits(g.grid, t, r, x, 0)) continue;
    let y = 0; while (!E.tetrisHits(g.grid, t, r, x, y + 1)) y++;
    let rows = g.grid.map(row => row.slice());
    for (const [c, k] of E.CELLS[t][r]) if (y + k >= 0) rows[y + k][x + c] = 1;
    const full = rows.filter(row => row.every(Boolean)).length;
    rows = rows.filter(row => !row.every(Boolean));
    let holes = 0, height = 0, bumps = 0, prev = -1;
    for (let c = 0; c < 10; c++) {
      let h = 0;
      rows.forEach((row, k) => { if (row[c]) h = h || rows.length - k; else if (h) holes++; });
      height += h; if (prev >= 0) bumps += Math.abs(h - prev); prev = h;
    }
    const v = full * 0.76 - height * 0.51 - holes * 0.36 - bumps * 0.18;
    if (!best || v > best.v) best = { v, r, x };
  }
  return best || { r: 0, x: g.piece.x };
}`
};

export const MAX_MOVIE = 300000;
export const SEED_MS = 10 * 60e3;

export function cleanMovie(text) {
  return String(text == null ? "" : text).replace(/#[^\n]*/g, "").replace(/\s+/g, "");
}

const fail = why => ({ ok: false, why });

/* snake */

const DIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const BACK = { u: "d", d: "u", l: "r", r: "l" };

export function snakeNew(seed, n = 16) {
  const mid = n >> 1;
  const g = { n, rand: rng(seed), body: [[mid, mid], [mid - 1, mid], [mid - 2, mid]], dir: "r", fruit: null,
    steps: 0, eaten: 0, dead: false, full: false, occ: new Uint8Array(n * n), last: null };
  for (const [x, y] of g.body) g.occ[y * n + x] = 1;
  g.fruit = snakeFruit(g);
  return g;
}

function snakeFruit(g) {
  const free = [];
  for (let i = 0; i < g.occ.length; i++) if (!g.occ[i]) free.push(i);
  if (!free.length) return null;
  const k = free[(g.rand() * free.length) | 0];
  return [k % g.n, (k / g.n) | 0];
}

export function snakeStep(g, d) {
  if (g.dead || g.full) return g;
  if (DIR[d] && d !== g.dir && d !== BACK[g.dir]) g.dir = d;
  const n = g.n, [dx, dy] = DIR[g.dir], [hx, hy] = g.body[0];
  const x = (hx + dx + n) % n, y = (hy + dy + n) % n;
  const ate = !!g.fruit && g.fruit[0] === x && g.fruit[1] === y;
  g.last = null;
  if (!ate) { g.last = g.body.pop(); g.occ[g.last[1] * n + g.last[0]] = 0; }
  g.steps++;
  if (g.occ[y * n + x]) {
    if (g.last) { g.body.push(g.last); g.occ[g.last[1] * n + g.last[0]] = 1; }
    g.dead = true;
    return g;
  }
  g.body.unshift([x, y]);
  g.occ[y * n + x] = 1;
  if (ate) {
    g.eaten++;
    g.fruit = snakeFruit(g);
    if (!g.fruit) g.full = true;
  }
  return g;
}

export const snakeInterval = eaten => Math.max(55, 112 - eaten * 4);

// turns: [[step, dir], ...] as the page applied them; end: steps taken, the last one the crash
export function snakeReplay(seed, turns, end) {
  if (!Array.isArray(turns) || !Number.isInteger(end) || end < 1 || end > 400000) return fail("no run");
  const g = snakeNew(seed);
  let i = 0, ms = 0;
  while (g.steps < end) {
    let d = null;
    if (i < turns.length) {
      const t = turns[i];
      if (!Array.isArray(t) || !Number.isInteger(t[0]) || t[0] < g.steps) return fail("turns out of order");
      if (t[0] === g.steps) { d = t[1]; i++; if (!DIR[d] || d === BACK[g.dir]) return fail("bad turn"); }
    }
    ms += snakeInterval(g.eaten);
    snakeStep(g, d);
    if ((g.dead || g.full) && g.steps < end) return fail("crashed early");
  }
  if (i < turns.length) return fail("turns after the end");
  if (!g.dead && !g.full) return fail("still going");
  return { ok: true, score: g.eaten, steps: g.steps, ms, full: g.full };
}

export function snakeRun(movie, seed = SEEDS.snake) {
  const g = snakeNew(seed);
  let at = 0;
  for (let i = 0; i < movie.length && !g.dead && !g.full; i++) {
    const c = movie[i];
    if (!DIR[c] && c !== ".") return fail("unknown input '" + c + "' at step " + (i + 1));
    const had = g.eaten;
    snakeStep(g, c);
    if (g.eaten > had) at = g.steps;
  }
  return g.eaten ? { ok: true, score: g.eaten, frames: at } : fail("nothing eaten");
}

/* 2048 */

const LINE = {
  l: k => [k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 3],
  r: k => [k * 4 + 3, k * 4 + 2, k * 4 + 1, k * 4],
  u: k => [k, k + 4, k + 8, k + 12],
  d: k => [k + 12, k + 8, k + 4, k]
};

export function g2048New(seed) {
  const g = { rand: rng(seed), b: new Array(16).fill(0), score: 0, moves: 0, max: 0, spawned: -1 };
  g2048Spawn(g); g2048Spawn(g);
  return g;
}

function g2048Spawn(g) {
  const free = [];
  for (let i = 0; i < 16; i++) if (!g.b[i]) free.push(i);
  if (!free.length) return;
  const i = free[(g.rand() * free.length) | 0];
  g.b[i] = g.rand() < 0.9 ? 2 : 4;
  g.max = Math.max(g.max, g.b[i]);
  g.spawned = i;
}

export function g2048Move(g, d) {
  if (!LINE[d]) return false;
  let moved = false, gained = 0;
  for (let k = 0; k < 4; k++) {
    const idx = LINE[d](k), vals = idx.map(i => g.b[i]).filter(Boolean), out = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) { const v = vals[i] * 2; out.push(v); gained += v; if (v > g.max) g.max = v; i++; }
      else out.push(vals[i]);
    }
    while (out.length < 4) out.push(0);
    idx.forEach((p, j) => { if (g.b[p] !== out[j]) { moved = true; g.b[p] = out[j]; } });
  }
  if (!moved) return false;
  g.score += gained;
  g.moves++;
  g2048Spawn(g);
  return true;
}

// what a move would do to a board, without spawning a tile: { b, gained }, or null if nothing moves
export function g2048Slide(b, d) {
  if (!LINE[d]) return null;
  const out = b.slice(); let gained = 0, moved = false;
  for (let k = 0; k < 4; k++) {
    const idx = LINE[d](k), vals = idx.map(i => b[i]).filter(Boolean), row = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) { row.push(vals[i] * 2); gained += vals[i] * 2; i++; } else row.push(vals[i]);
    }
    while (row.length < 4) row.push(0);
    idx.forEach((p, j) => { if (out[p] !== row[j]) { moved = true; out[p] = row[j]; } });
  }
  return moved ? { b: out, gained } : null;
}

export const codeLines = code => String(code || "").split("\n").filter(l => l.trim() && !/^\s*\/\//.test(l)).length;

export function g2048Over(g) {
  for (let i = 0; i < 16; i++) {
    if (!g.b[i]) return false;
    if (i % 4 < 3 && g.b[i] === g.b[i + 1]) return false;
    if (i < 12 && g.b[i] === g.b[i + 4]) return false;
  }
  return true;
}

export function g2048Replay(seed, moves) {
  if (typeof moves !== "string" || moves.length > 100000) return fail("no run");
  const g = g2048New(seed);
  for (let i = 0; i < moves.length; i++) if (!g2048Move(g, moves[i])) return fail("move " + (i + 1) + " goes nowhere");
  return { ok: true, score: g.score, moves: g.moves, max: g.max, over: g2048Over(g) };
}

export function g2048Run(movie, seed = SEEDS.g2048) {
  const g = g2048New(seed);
  let at = 0;
  for (let i = 0; i < movie.length; i++) {
    if (!LINE[movie[i]]) return fail("unknown input '" + movie[i] + "' at move " + (i + 1));
    const had = g.score;
    if (!g2048Move(g, movie[i])) return fail("move " + (i + 1) + " goes nowhere");
    if (g.score > had) at = g.moves;
  }
  return g.score ? { ok: true, score: g.score, frames: at } : fail("no score");
}

/* tetris */

export const TW = 10, TH = 20;
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
};
export const PIECES = Object.keys(SHAPES);
const turn = m => m.map((row, r) => row.map((_, c) => m[m.length - 1 - c][r]));
export const CELLS = {};
for (const p of PIECES) {
  let m = SHAPES[p];
  CELLS[p] = [];
  for (let k = 0; k < 4; k++) {
    const cells = [];
    m.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([c, r]); }));
    CELLS[p].push(cells);
    m = turn(m);
  }
}
const KJ = {
  "0,1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "1,0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1,2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     "2,1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2,3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    "3,2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3,0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],  "0,3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};
const KI = {
  "0,1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],  "1,0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1,2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],  "2,1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2,3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],  "3,2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3,0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],  "0,3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};
const K180 = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1]];

export function tetrisHits(grid, type, rot, x, y) {
  for (const [c, r] of CELLS[type][rot]) {
    const cx = x + c, cy = y + r;
    if (cx < 0 || cx >= TW || cy >= TH) return true;
    if (cy >= 0 && grid[cy][cx]) return true;
  }
  return false;
}

function rotate(grid, p, dir) {
  if (p.type === "O") return false;
  const to = (p.rot + (dir === 2 ? 2 : dir) + 4) % 4;
  const kicks = dir === 2 ? K180 : (p.type === "I" ? KI : KJ)[p.rot + "," + to].map(([a, b]) => [a, -b]);
  for (const [dx, dy] of kicks) {
    if (!tetrisHits(grid, p.type, to, p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; p.rot = to; return true; }
  }
  return false;
}

function bag(seed) {
  const rand = rng(seed);
  let b = [];
  return () => {
    if (!b.length) {
      b = PIECES.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; }
    }
    return b.shift();
  };
}

const spawnX = type => (TW - SHAPES[type][0].length) >> 1;

export function tetrisNew(seed, goal = 40) {
  const g = { grid: Array.from({ length: TH }, () => new Array(TW).fill(0)), next: bag(seed), queue: [], hold: null, held: false,
    lines: 0, pieces: 0, frames: 0, score: 0, scoredAt: 0, goal, won: false, over: false, piece: null };
  tetrisSpawn(g, take(g));
  return g;
}

function take(g) {
  while (g.queue.length < 6) g.queue.push(g.next());
  const t = g.queue.shift();
  g.queue.push(g.next());
  return t;
}

function tetrisSpawn(g, type) {
  g.piece = { type, rot: 0, x: spawnX(type), y: 0 };
  if (tetrisHits(g.grid, type, 0, g.piece.x, 0)) g.over = true;
}

function lock(g) {
  const p = g.piece, id = PIECES.indexOf(p.type) + 1;
  for (const [c, r] of CELLS[p.type][p.rot]) if (p.y + r >= 0) g.grid[p.y + r][p.x + c] = id;
  const keep = g.grid.filter(row => !row.every(Boolean)), n = TH - keep.length;
  while (keep.length < TH) keep.unshift(new Array(TW).fill(0));
  g.grid = keep;
  g.lines += n;
  if (n) { g.score += [0, 100, 300, 500, 800][n]; g.scoredAt = g.frames; }
  g.pieces++;
  g.held = false;
  if (g.lines >= g.goal) { g.won = true; return n; }
  tetrisSpawn(g, take(g));
  return n;
}

function hold(g) {
  if (g.held) return false;
  g.held = true;
  const cur = g.piece.type;
  if (g.hold == null) { g.hold = cur; tetrisSpawn(g, take(g)); }
  else { const h = g.hold; g.hold = cur; tetrisSpawn(g, h); }
  return true;
}

const free = (g, dx, dy, p = g.piece) => !tetrisHits(g.grid, p.type, p.rot, p.x + dx, p.y + dy);

export function tetrisFrame(g, ch) {
  if (g.over || g.won) return false;
  const p = g.piece;
  g.frames++;
  switch (ch) {
    case "L": if (free(g, -1, 0)) p.x--; break;
    case "R": if (free(g, 1, 0)) p.x++; break;
    case "<": while (free(g, -1, 0)) p.x--; break;
    case ">": while (free(g, 1, 0)) p.x++; break;
    case "D": if (free(g, 0, 1)) p.y++; break;
    case "V": while (free(g, 0, 1)) p.y++; break;
    case "C": rotate(g.grid, p, 1); break;
    case "Z": rotate(g.grid, p, -1); break;
    case "A": rotate(g.grid, p, 2); break;
    case "H": hold(g); break;
    case "X": while (free(g, 0, 1)) p.y++; lock(g); break;
    case ".": break;
    default: g.frames--; return false;
  }
  return true;
}

export function tetrisGhost(g) {
  const p = g.piece;
  let y = p.y;
  while (!tetrisHits(g.grid, p.type, p.rot, p.x, y + 1)) y++;
  return y;
}

export function tetrisRun(movie, seed = SEEDS.tetris) {
  const g = tetrisNew(seed, 40);
  for (let i = 0; i < movie.length && !g.won && !g.over; i++) {
    if (!tetrisFrame(g, movie[i])) return fail("unknown input '" + movie[i] + "' at frame " + (i + 1));
  }
  return g.score ? { ok: true, score: g.score, frames: g.scoredAt } : fail("no lines cleared");
}

// every resting spot a piece can be moved into from where it spawns
function reach(grid, type) {
  const start = { type, rot: 0, x: spawnX(type), y: 0 }, key = s => s.x + "," + s.y + "," + s.rot;
  const seen = new Set([key(start)]), todo = [start], rest = new Set();
  const g = { grid };
  while (todo.length) {
    const s = todo.pop();
    if (tetrisHits(grid, type, s.rot, s.x, s.y + 1)) rest.add(key(s));
    const next = [];
    if (free(g, -1, 0, s)) next.push({ ...s, x: s.x - 1 });
    if (free(g, 1, 0, s)) next.push({ ...s, x: s.x + 1 });
    if (free(g, 0, 1, s)) next.push({ ...s, y: s.y + 1 });
    for (const d of [1, -1, 2]) { const t = { ...s }; if (rotate(grid, t, d)) next.push(t); }
    for (const t of next) { const k = key(t); if (!seen.has(k)) { seen.add(k); todo.push(t); } }
  }
  return rest;
}

// log: [t, type, rot, x, y] for each piece placed, [t, "h"] for a hold
export function tetrisCheck(seed, log, goal = 40) {
  if (!Array.isArray(log) || !log.length || log.length > 2000) return fail("no run");
  const g = tetrisNew(seed, goal);
  let t0 = 0;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (!Array.isArray(e)) return fail("bad entry");
    const t = Number(e[0]);
    if (!Number.isFinite(t) || t < t0) return fail("clock runs backwards");
    t0 = t;
    if (e[1] === "h") {
      if (!hold(g)) return fail("held twice");
      if (g.over) return fail("topped out");
      continue;
    }
    const [, type, rot, x, y] = e;
    if (type !== g.piece.type) return fail("wrong piece at " + (i + 1));
    if (![rot, x, y].every(Number.isInteger) || rot < 0 || rot > 3) return fail("bad entry");
    if (!reach(g.grid, type).has(x + "," + y + "," + rot)) return fail("piece " + (g.pieces + 1) + " couldn't get there");
    Object.assign(g.piece, { rot, x, y });
    lock(g);
    if (g.won) return i === log.length - 1 ? { ok: true, ms: t, pieces: g.pieces, lines: g.lines } : fail("kept going after the end");
    if (g.over) return fail("topped out");
  }
  return fail("never finished");
}

export function runTas(cat, text, seed) {
  const c = TAS[cat];
  if (!c) return fail("unknown category");
  const movie = cleanMovie(text);
  if (!movie.length) return fail("empty movie");
  if (movie.length > MAX_MOVIE) return fail("movie is too long");
  const sd = seed == null ? SEEDS[cat] : seed >>> 0;
  if (cat === "snake") return snakeRun(movie, sd);
  if (cat === "g2048") return g2048Run(movie, sd);
  return tetrisRun(movie, sd);
}
