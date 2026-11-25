// node tools/snake-tas.mjs [--runs=10] [--salt=1]
// Plays TAS Snake to a full board and keeps the fastest run in tools/tas-snake.txt.
import * as E from '../tasengine.js';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
const N = 16, A = N * N;
const at = (x, y) => ((y + N) % N) * N + ((x + N) % N);
const MV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const nb = Array.from({ length: A }, (_, i) => Object.entries(MV).map(([, [dx, dy]]) => at(i % N + dx, (i / N | 0) + dy)));
const ch = Array.from({ length: A }, (_, i) => Object.fromEntries(Object.entries(MV).map(([c, [dx, dy]]) => [at(i % N + dx, (i / N | 0) + dy), c])));

class Sim {
  constructor(src) {
    if (src) { this.occ = src.occ.slice(); this.body = src.body.slice(); this.dir = src.dir; this.fruit = src.fruit; this.a = src.a; this.eaten = src.eaten; this.steps = src.steps; this.full = src.full; this.movie = src.movie; return; }
    this.occ = new Uint8Array(A); this.body = [at(8, 8), at(7, 8), at(6, 8)]; this.body.forEach(c => this.occ[c] = 1);
    this.dir = 'r'; this.a = E.SEEDS.snake >>> 0; this.eaten = 0; this.steps = 0; this.full = false; this.movie = ''; this.fruit = this.spawn();
  }
  rand() { let a = this.a | 0; a = a + 0x6D2B79F5 | 0; this.a = a; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  spawn() { const f = []; for (let i = 0; i < A; i++) if (!this.occ[i]) f.push(i); if (!f.length) return -1; return f[(this.rand() * f.length) | 0]; }
  move(m) {
    const eat = m === this.fruit;
    if (!eat) this.occ[this.body.pop()] = 0;
    if (this.occ[m]) return false;
    const c = ch[this.body[0]][m];
    if (c === { u: 'd', d: 'u', l: 'r', r: 'l' }[this.dir]) return false;
    this.movie += c === this.dir ? '.' : c; this.dir = c;
    this.body.unshift(m); this.occ[m] = 1; this.steps++;
    if (eat) { this.eaten++; this.fruit = this.spawn(); if (this.fruit < 0) this.full = true; }
    return true;
  }
}

// shortest paths to the fruit, knowing when each body cell frees up
function paths(s, count, rnd) {
  const b = s.body, L = b.length, h = b[0], f = s.fruit;
  const idx = new Int16Array(A).fill(-1); b.forEach((c, j) => idx[c] = j);
  const out = [];
  for (let k = 0; k < count; k++) {
    const seen = new Int16Array(A).fill(-1), from = new Int32Array(A); seen[h] = 0; let layer = [h], found = false;
    for (let t = 0; layer.length && !found && t < A; t++) {
      const nxt = [];
      const order = k ? layer.slice().sort(() => rnd() - .5) : layer;
      for (const c of order) for (const m of (k ? nb[c].slice().sort(() => rnd() - .5) : nb[c])) {
        if (seen[m] >= 0) continue;
        if (m !== f && idx[m] >= 0 && idx[m] < L - (t + 1)) continue;
        if (m === f && idx[m] >= 0) continue;
        seen[m] = t + 1; from[m] = c; nxt.push(m); if (m === f) found = true;
      }
      layer = nxt;
    }
    if (!found) break;
    const p = []; for (let c = f; c !== h; c = from[c]) p.push(c); out.push(p.reverse());
  }
  return out;
}

// a path from the head through every empty cell to the tail, so the snake can always loop safely
function closeLoop(s, budget, rnd) {
  const b = s.body, h = b[0], t = b[b.length - 1];
  const isFree = new Uint8Array(A); let total = 0;
  for (let i = 0; i < A; i++) if (!s.occ[i]) { isFree[i] = 1; total++; }
  if (!total) return [h];
  const nearT = new Uint8Array(A); for (const m of nb[t]) nearT[m] = 1;
  if (!nb[t].some(m => isFree[m])) return null;
  const deg = new Int8Array(A); for (let i = 0; i < A; i++) if (isFree[i]) for (const m of nb[i]) if (isFree[m]) deg[i]++;
  const path = [h]; let nodes = 0;
  const take = m => { isFree[m] = 0; for (const q of nb[m]) if (isFree[q]) deg[q]--; };
  const give = m => { isFree[m] = 1; for (const q of nb[m]) if (isFree[q]) deg[q]++; };
  const mark = new Int32Array(A); let stamp = 0;
  // true when the empty cells left can't all be reached from here (or the tail can't be)
  function split(c, left) {
    stamp++; let seen = 0, tailOk = false; const st = [c]; mark[c] = stamp;
    while (st.length) {
      const x = st.pop();
      for (const q of nb[x]) {
        if (q === t) tailOk = true;
        if (isFree[q] && mark[q] !== stamp) { mark[q] = stamp; seen++; st.push(q); }
      }
    }
    return seen < left || !tailOk;
  }
  function dfs(c, left) {
    if (++nodes > budget) return false;
    if (left === 0) return nearT[c] === 1;
    const opts = [];
    for (const m of nb[c]) if (isFree[m]) opts.push([deg[m] - (nearT[m] && left > 1 ? -2 : 0) + rnd() * 0.6, m]);
    opts.sort((x, y) => x[0] - y[0]);
    for (const [, m] of opts) {
      take(m); path.push(m);
      let bad = false, ends = 0;
      for (const q of nb[m]) if (isFree[q]) {
        if (deg[q] === 0 && left - 1 > 1) { bad = true; break; }
        if (deg[q] === 1 && !nearT[q] && left - 1 > 1) ends++;
      }
      if (ends > 1) bad = true;
      if (!bad && left > 3 && split(m, left - 1)) bad = true;
      if (!bad && dfs(m, left - 1)) return true;
      give(m); path.pop();
      if (nodes > budget) return false;
    }
    return false;
  }
  return dfs(h, total) ? path : null;
}

function solve(o = {}) {
  const { salt = 1, cands = 4, budget = 4000, tries = 2, log = false } = o;
  const rnd = E.rng(salt);
  const s0 = new Sim();
  let s = s0, loop = null;
  { const o = []; let x = 3; for (let k = 0; k < N; k++) { const y = (8 + k) % N; for (let i = 0; i < N; i++) o.push(at(x + i, y)); x = (x + N - 1) % N; } loop = new Int32Array(A); for (let i = 0; i < A; i++) loop[o[i]] = o[(i + 1) % A]; }
  let plans = 0, falls = 0;
  while (!s.full && s.steps < 60000) {
    let took = false, pick = null;
    for (const p of paths(s, cands, rnd)) {
      const t = new Sim(s); let ok = true;
      for (const m of p) if (!t.move(m)) { ok = false; break; }
      if (!ok) continue;
      if (t.full) { pick = { t, cyc: null, v: 0 }; break; }
      let cyc = null;
      for (let k = 0; k < tries && !cyc; k++) cyc = closeLoop(t, budget, rnd);
      if (!cyc) continue;
      const nx = o.look ? paths(t, 1, rnd)[0] : null;
      const v = t.steps + (o.look ? o.look * (nx ? nx.length : 60) : 0);
      if (!pick || v < pick.v) pick = { t, cyc, v };
      if (!o.look) break;
    }
    if (pick) {
      const t = pick.t, cyc = pick.cyc;
      if (cyc) {
        const nl = new Int32Array(A), bd = t.body;
        for (let i = bd.length - 1; i > 0; i--) nl[bd[i]] = bd[i - 1];
        for (let i = 0; i < cyc.length - 1; i++) nl[cyc[i]] = cyc[i + 1];
        nl[cyc[cyc.length - 1]] = bd[bd.length - 1];
        loop = nl;
      }
      s = t; took = true; plans++;
    }
    if (!took) { const t = new Sim(s); if (!t.move(loop[s.body[0]])) return { s, dead: true }; s = t; falls++; }
    if (log && s.eaten % 25 === 0 && took) console.log('  fruit', s.eaten, 'steps', s.steps, 'plans', plans, 'loop steps', falls);
  }
  return { s, plans, falls };
}

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v === undefined ? true : Number(v)]));
const out = new URL('./tas-snake.txt', import.meta.url);
let best = existsSync(out) ? E.runTas('snake', readFileSync(out, 'utf8')) : null;
best = best && best.ok ? best.frames : Infinity;
const from = args.salt || 1, runs = args.runs || 1;
for (let salt = from; salt < from + runs; salt++) {
  const t0 = Date.now(), r = solve({ budget: 20000, tries: 3, cands: 6, look: 0.5, ...args, salt });
  const v = E.runTas('snake', r.s.movie), good = v.ok && v.score === 253;
  if (good && v.frames < best) {
    best = v.frames;
    writeFileSync(out, '# Snake TAS, 253 fruit (full board) in ' + v.frames + ' steps\n' + r.s.movie.replace(/(.{80})/g, '$1\n') + '\n');
  }
  console.log('seed ' + salt + ': ' + (good ? v.frames + ' steps' : 'failed') + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's, best ' + best);
}
