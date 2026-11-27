import * as E from "./tasengine.js?v=20261127b";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const signedIn = () => !!(window.TT && TT.myEmail && TT.myEmail());

const RULES = {
  snake: [
    "16 by 16, wraps at the edges, seed " + E.SEEDS.snake + ". Same start as the normal game.",
    "One letter a step: <code>u</code> <code>d</code> <code>l</code> <code>r</code> to turn, <code>.</code> to go straight.",
    "Fruit lands on a free cell the seed picks, counting row by row from the top left.",
    "The run ends when you crash, fill the board, or the movie ends."
  ],
  g2048: [
    "Seed " + E.SEEDS.g2048 + ". New tiles land on a free cell the seed picks, a 4 one time in ten.",
    "One letter a move: <code>u</code> <code>d</code> <code>l</code> <code>r</code>. A move that shifts nothing isn't allowed."
  ],
  tetris: [
    "40 lines, seed " + E.SEEDS.tetris + ", SRS with 180s and hold.",
    "One letter a frame: <code>L</code> <code>R</code> move, <code>&lt;</code> <code>&gt;</code> to the wall, <code>D</code> down one, <code>V</code> to the floor, <code>C</code> <code>Z</code> <code>A</code> rotate, <code>H</code> hold, <code>X</code> drop, <code>.</code> wait.",
    "Nothing falls on its own. 100, 300, 500 or 800 a clear."
  ]
};
const PADS = {
  snake: [["u", "Up"], ["l", "Left"], ["d", "Down"], ["r", "Right"], [".", "Straight"]],
  g2048: [["u", "Up"], ["l", "Left"], ["d", "Down"], ["r", "Right"]],
  tetris: [["<", "Wall"], ["L", "Left"], ["R", "Right"], [">", "Wall"], ["D", "Down"], ["V", "Floor"], ["Z", "Anti"], ["C", "Clock"], ["A", "180"], ["H", "Hold"], ["X", "Drop"], [".", "Wait"]]
};
const HOW = {
  snake: "Arrows to turn, space to go straight. Backspace to undo.",
  g2048: "Arrows to move. Backspace to undo.",
  tetris: "Arrows move, shift slides. Up/X/Z/A rotate, C holds, space drops, full stop waits. Backspace to undo."
};
const TCOL = { I: "#38bdf8", O: "#facc15", T: "#c084fc", S: "#4ade80", Z: "#f87171", J: "#60a5fa", L: "#fb923c" };

let cat = "snake";
try { const c = localStorage.getItem("tas.cat"); if (E.TAS[c]) cat = c; } catch {}
let league = "fixed";
try { if (localStorage.getItem("tas.league") === "bot") league = "bot"; } catch {}
let movie = "", g = null, watch = null, board = null, seed = E.SEEDS[cat], worker = null, ran = null;
const kind = () => cat;
const bots = () => league === "bot";

const STARTER = {
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
const BOTRULES = {
  snake: "<code>g.body</code> is the snake as [x, y] cells, head first. <code>g.dir</code>, <code>g.fruit</code> ([x, y]), <code>g.occ</code> (256 cells, y * 16 + x, 1 where the snake is), <code>g.steps</code>, <code>g.eaten</code>.",
  g2048: "<code>g.b</code> is the 16 cells row by row, 0 when empty. <code>g.score</code>, <code>g.moves</code>. <code>E.g2048Slide(b, d)</code> gives what a move would do, or null if nothing moves.",
  tetris: "<code>g.grid</code> is 20 rows of 10, 0 when empty. <code>g.piece</code> ({ type, rot, x, y }), <code>g.queue</code>, <code>g.hold</code>, <code>g.lines</code>, <code>g.pieces</code>. <code>E.tetrisHits(grid, type, rot, x, y)</code> and <code>E.CELLS[type][rot]</code> help you look ahead."
};

function fresh(sd = seed) {
  if (kind() === "snake") return E.snakeNew(sd);
  if (kind() === "g2048") return E.g2048New(sd);
  return E.tetrisNew(sd, 40);
}
function finished() {
  if (kind() === "snake") return g.dead ? "crashed" : g.full ? "board full" : "";
  if (kind() === "g2048") return E.g2048Over(g) ? "no moves left" : "";
  return g.won ? "40 lines" : g.over ? "topped out" : "";
}
function frames() { return kind() === "snake" ? g.steps : kind() === "g2048" ? g.moves : g.frames; }
function scoreNow() { return kind() === "snake" ? g.eaten : g.score; }

// one input; false when it can't be taken
function step(ch) {
  if (finished()) return false;
  if (kind() === "snake") {
    const back = { u: "d", d: "u", l: "r", r: "l" };
    if (ch !== "." && (ch === g.dir || ch === back[g.dir])) ch = ".";
    E.snakeStep(g, ch === "." ? null : ch);
  } else if (kind() === "g2048") {
    if (!E.g2048Move(g, ch)) return false;
  } else if (!E.tetrisFrame(g, ch)) return false;
  movie += ch;
  return true;
}
function rebuild(upTo) {
  const m = movie.slice(0, upTo == null ? movie.length : upTo);
  g = fresh(); movie = "";
  for (const ch of m) if (!step(ch)) break;
}

function say(text, tone) { const m = $("msg"); m.textContent = text || ""; m.className = "tasmsg" + (tone ? " " + tone : ""); }
function showMovie() { const t = $("movie"); t.value = movie; t.scrollTop = t.scrollHeight; }

function input(ch) {
  if (bots()) return;
  if (watch) stopWatch(true);
  if (!step(ch)) {
    say(kind() === "g2048" && !finished() ? "That move doesn't shift anything." : "Run's over. Undo or start over.", "bad");
    return;
  }
  const f = finished();
  if (f) { const r = E.runTas(cat, movie, seed); say(r.ok ? "Over (" + f + "): " + r.score + " in " + r.frames + " " + E.TAS[cat].unit + "." : "Over: " + f + ".", r.ok ? "good" : "bad"); }
  else say("");
  draw(); showMovie();
}

/* drawing */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function draw() {
  const cv = $("board"), x = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
  const W = kind() === "tetris" ? 260 : 320, H = 320;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; }
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = css("--panel-2") || "#eee", line = css("--line") || "#ccc", accent = css("--accent") || "#4e7cf6", text = css("--text") || "#111";
  x.clearRect(0, 0, W, H); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  if (kind() === "snake") {
    const c = 20;
    x.fillStyle = "rgba(128,128,128,.07)";
    for (let yy = 0; yy < 16; yy++) for (let xx = yy & 1; xx < 16; xx += 2) x.fillRect(xx * c, yy * c, c, c);
    if (g.fruit) { x.fillStyle = "#e5484d"; x.beginPath(); x.arc(g.fruit[0] * c + c / 2, g.fruit[1] * c + c / 2, c * .34, 0, 6.2832); x.fill(); }
    g.body.forEach(([bx, by], i) => {
      x.fillStyle = i ? accent : text; x.globalAlpha = g.dead ? .45 : i ? .85 : 1;
      x.beginPath(); x.roundRect ? x.roundRect(bx * c + 2, by * c + 2, c - 4, c - 4, 5) : x.rect(bx * c + 2, by * c + 2, c - 4, c - 4); x.fill();
    });
    x.globalAlpha = 1;
  } else if (kind() === "g2048") {
    const gap = 8, c = (320 - gap * 5) / 4;
    for (let i = 0; i < 16; i++) {
      const v = g.b[i], cx = gap + (i % 4) * (c + gap), cy = gap + ((i / 4) | 0) * (c + gap);
      const box = () => { x.beginPath(); x.roundRect ? x.roundRect(cx, cy, c, c, 8) : x.rect(cx, cy, c, c); x.fill(); };
      x.fillStyle = v ? css("--panel") || "#fff" : "rgba(128,128,128,.12)"; box();
      if (v) { x.fillStyle = accent; x.globalAlpha = Math.min(.82, .1 + Math.log2(v) * .09); box(); x.globalAlpha = 1; }
      if (v) { x.fillStyle = text; x.font = "700 " + (v >= 1000 ? 20 : 26) + "px " + (css("--font-num") || "monospace"); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(v, cx + c / 2, cy + c / 2 + 1); }
    }
  } else {
    const c = 16;
    x.strokeStyle = "rgba(128,128,128,.15)";
    for (let i = 0; i <= 10; i++) { x.beginPath(); x.moveTo(i * c + .5, 0); x.lineTo(i * c + .5, 320); x.stroke(); }
    for (let i = 0; i <= 20; i++) { x.beginPath(); x.moveTo(0, i * c + .5); x.lineTo(160, i * c + .5); x.stroke(); }
    const cell = (cx, cy, col, s = c) => { x.fillStyle = col; x.fillRect(cx + 1, cy + 1, s - 2, s - 2); };
    g.grid.forEach((row, r) => row.forEach((v, k) => { if (v) cell(k * c, r * c, TCOL[E.PIECES[v - 1]]); }));
    if (g.piece && !g.won && !g.over) {
      const p = g.piece, gy = E.tetrisGhost(g);
      x.strokeStyle = TCOL[p.type]; x.lineWidth = 2;
      E.CELLS[p.type][p.rot].forEach(([cc, rr]) => x.strokeRect((p.x + cc) * c + 2, (gy + rr) * c + 2, c - 4, c - 4));
      x.lineWidth = 1;
      E.CELLS[p.type][p.rot].forEach(([cc, rr]) => { if (p.y + rr >= 0) cell((p.x + cc) * c, (p.y + rr) * c, TCOL[p.type]); });
    }
    const mini = (type, ox, oy) => { if (!type) return; E.CELLS[type][0].forEach(([cc, rr]) => cell(ox + cc * 10, oy + rr * 10, TCOL[type], 10)); };
    x.fillStyle = css("--muted") || "#888"; x.font = "11px " + (css("--font-ui") || "sans-serif"); x.textAlign = "left"; x.textBaseline = "top";
    x.fillText("Hold", 176, 4); mini(g.hold, 178, 20);
    x.fillText("Next", 176, 64); g.queue.slice(0, 5).forEach((t, i) => mini(t, 178, 80 + i * 46));
  }
  x.strokeStyle = line; x.strokeRect(.5, .5, (kind() === "tetris" ? 160 : W) - 1, H - 1);
  side();
}
function side() {
  const u = E.TAS[cat].unit, f = finished(), st = f ? "Over: " + f : watch ? "Watching" : "Playing";
  const rows = [["Score", scoreNow()], [u[0].toUpperCase() + u.slice(1), frames()]];
  if (kind() === "g2048") rows.push(["Biggest tile", g.max]);
  if (kind() === "tetris") rows.push(["Lines", g.lines + " / 40"]);
  rows.push(["", st]);
  $("side").innerHTML = rows.map(([k, v]) => "<div>" + esc(k) + "<b>" + esc(v) + "</b></div>").join("");
}

/* watching a run from the board */
function stopWatch(keep) {
  if (!watch) return;
  clearTimeout(watch.timer);
  if (keep) rebuild(watch.pos);
  watch = null;
  $("watchbar").hidden = true;
  draw(); showMovie();
}
function playWatch() {
  if (!watch) return;
  clearTimeout(watch.timer);
  if (watch.paused) { $("play").textContent = "Play"; return; }
  $("play").textContent = "Pause";
  const fps = +$("speed").value, per = Math.max(1, Math.round(fps / 60)), wait = Math.max(16, 1000 / fps);
  const tick = () => {
    for (let i = 0; i < per && watch.pos < watch.movie.length; i++) { step(watch.movie[watch.pos]); watch.pos++; }
    $("watchpos").textContent = watch.pos + " / " + watch.movie.length;
    draw();
    if (watch.pos >= watch.movie.length) { watch.paused = true; $("play").textContent = "Play"; showMovie(); if (!bots()) say("End of the run. Press a key to carry on from here.", "good"); return; }
    watch.timer = setTimeout(tick, wait);
  };
  tick();
}
function watchMovie(m, sd, label) {
  stopWatch(false);
  seed = sd; g = fresh(); movie = "";
  watch = { movie: E.cleanMovie(m), pos: 0, paused: false, timer: 0 };
  $("watchbar").hidden = false;
  say(label);
  playWatch();
}
async function startWatch(rank, wantCode) {
  say("Loading the run…");
  try {
    const d = await TT.api("/api/leaderboard", { params: { tas: cat, league, rank } });
    if (wantCode && d.code) { $("code").value = d.code; showLines(); }
    watchMovie(d.movie, d.seed, (wantCode ? "Loaded #" + rank + "'s code. " : "") + "Watching #" + rank + ": " + d.score + " in " + d.frames + " " + E.TAS[cat].unit + (d.lines ? ", " + d.lines + " lines" : "") + ".");
  } catch (e) { say(e.message, "bad"); }
}

/* the board */
async function loadBoard() {
  const el = $("lb");
  $("boardtitle").textContent = E.TAS[cat].name;
  if (!signedIn()) { el.innerHTML = '<p class="how">Sign in on the timetable to see the board.</p>'; return; }
  el.innerHTML = window.TT && TT.loader ? TT.loader("Loading the board…", "", { sm: true }) : "";
  try { board = await TT.api("/api/leaderboard", { params: { tas: cat, league } }); paintBoard(); }
  catch (e) { el.innerHTML = '<p class="how">' + esc(e.message) + "</p>"; }
}
function paintBoard() {
  const el = $("lb"), rows = (board && board.top) || [];
  if (!rows.length) { el.innerHTML = '<p class="how">No runs yet.</p>'; return; }
  const lines = r => bots() ? '<span class="tm">' + (r.lines == null ? "" : r.lines) + "</span>" : "";
  el.innerHTML = '<div class="tlbrow tlbhd"><span class="rk">#</span><span class="nm">Player</span><span class="tm">Score</span><span class="tm">' + esc(E.TAS[cat].unit) + "</span>" + (bots() ? '<span class="tm">Lines</span>' : "") + '<span class="watch" style="visibility:hidden">Watch</span></div>' +
    rows.slice(0, 25).map(r => '<div class="tlbrow' + (r.you ? " me" : "") + '"><span class="rk">' + r.rank + '</span><span class="nm">' + esc(r.name) +
    '</span><span class="tm">' + r.score + '</span><span class="tm">' + r.frames + "</span>" + lines(r) +
    (bots() ? '<button class="watch" type="button" data-code="' + r.rank + '">View</button>' : '<button class="watch" type="button" data-rank="' + r.rank + '">Watch</button>') +
    (board.canEdit ? '<button class="watch" type="button" data-del="' + r.rank + '">Remove</button>' : "") + "</div>").join("");
  el.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => startWatch(+b.dataset.rank));
  el.querySelectorAll("[data-code]").forEach(b => b.onclick = () => startWatch(+b.dataset.code, true));
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!confirm("Take this run off the board?")) return;
    try { board = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", op: "delete", cat, league, rank: +b.dataset.del } }); paintBoard(); }
    catch (e) { say(e.message, "bad"); }
  });
}

async function send() {
  if (watch) stopWatch(true);
  if (!signedIn()) return say("Sign in on the timetable first.", "bad");
  const r = E.runTas(cat, movie, seed);
  if (!r.ok) return say("Can't send that: " + r.why + ".", "bad");
  say("Sending…");
  try {
    const d = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", cat, movie } });
    board = d.board; paintBoard();
    say(d.improved ? "On the board: " + d.score + " in " + d.frames + " " + E.TAS[cat].unit + "." : "Checked, but your best (" + d.best.score + " in " + d.best.frames + ") is still better.", "good");
  } catch (e) { say(e.message, "bad"); }
}

/* bots: the code runs in a worker of its own, on a seed from the server */
const ENGINE = new URL("tasengine.js?v=20261127b", location.href).href;
const BOT_MS = 9 * 60e3;
const showLines = () => { $("lines").textContent = E.codeLines($("code").value) + " lines"; };
function workerSource(code) {
  return "import * as E from " + JSON.stringify(ENGINE) + ";\n" + code + `
;self.onmessage = ({ data: { cat, seed } }) => {
  const g = cat === "snake" ? E.snakeNew(seed) : cat === "g2048" ? E.g2048New(seed) : E.tetrisNew(seed, 40);
  const keys = E.TAS[cat].keys, cap = cat === "snake" ? 200000 : cat === "g2048" ? 100000 : 30000;
  const over = () => cat === "snake" ? g.dead || g.full : cat === "g2048" ? E.g2048Over(g) : g.won || g.over;
  let movie = "", last = Date.now();
  try {
    while (!over() && movie.length < cap) {
      const out = String(move(g, E) ?? "");
      if (!out) break;
      for (const c of out) {
        if (over()) break;
        if (!keys.includes(c)) throw new Error("move() gave " + JSON.stringify(c) + ", which isn't an input");
        if (cat === "snake") E.snakeStep(g, c === "." ? null : c);
        else if (cat === "g2048") { if (!E.g2048Move(g, c)) throw new Error("move " + (movie.length + 1) + " (" + c + ") doesn't shift anything"); }
        else E.tetrisFrame(g, c);
        movie += c;
      }
      if (Date.now() - last > 300) { last = Date.now(); self.postMessage({ movie }); }
    }
    self.postMessage({ movie, done: true });
  } catch (e) { self.postMessage({ movie, done: true, error: String(e && e.message || e) }); }
};`;
}
async function runBot() {
  if (worker || $("runbot").disabled) return;
  if (watch) stopWatch(false);
  const code = $("code").value;
  try { localStorage.setItem("tas.bot." + cat, code); } catch {}
  let tk = null;
  if (signedIn()) {
    $("runbot").disabled = true;
    try { tk = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", op: "seed", cat, league: "bot" } }); }
    catch (e) { return say(e.message, "bad"); }
    finally { $("runbot").disabled = false; }
  }
  const sd = tk ? tk.seed : crypto.getRandomValues(new Uint32Array(1))[0];
  const url = URL.createObjectURL(new Blob([workerSource(code)], { type: "text/javascript" }));
  const t0 = performance.now();
  let last = { movie: "" }, timer = 0;
  worker = new Worker(url, { type: "module" });
  $("runbot").hidden = true; $("stopbot").hidden = false; $("sendbot").disabled = true; ran = null;
  const finish = (why, bad) => {
    if (!worker) return;
    clearTimeout(timer); worker.terminate(); worker = null; URL.revokeObjectURL(url);
    $("runbot").hidden = false; $("stopbot").hidden = true;
    const r = E.runTas(cat, last.movie, sd), secs = ((performance.now() - t0) / 1000).toFixed(1);
    ran = r.ok ? { seed: sd, ticket: tk && tk.ticket, movie: last.movie, code, r } : null;
    $("sendbot").disabled = !(ran && tk);
    const head = r.ok ? "Score " + r.score + " in " + r.frames + " " + E.TAS[cat].unit + ", " + E.codeLines(code) + " lines, ran " + secs + "s." : "No score (" + r.why + ").";
    watchMovie(last.movie, sd, [why, head, ran && !tk ? "Sign in to send it." : ""].filter(Boolean).join(" "));
    if (bad) $("msg").className = "tasmsg bad";
  };
  stopBot = () => finish("Stopped.");
  worker.onmessage = e => {
    last = e.data;
    if (e.data.done) finish(e.data.error ? "Your bot stopped: " + e.data.error + "." : "", !!e.data.error);
    else say("Running… " + e.data.movie.length + " " + E.TAS[cat].unit);
  };
  worker.onerror = e => { e.preventDefault(); finish("Your bot didn't run: " + (e.message || "check it for a syntax error") + ".", true); };
  timer = setTimeout(() => finish("Stopped after " + BOT_MS / 60000 + " minutes."), BOT_MS);
  say("Running…");
  worker.postMessage({ cat, seed: sd });
}
let stopBot = () => {};
async function sendBot() {
  if (!ran) return;
  say("Sending…");
  try {
    const d = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", cat, league: "bot", ticket: ran.ticket, movie: ran.movie, code: ran.code } });
    ran = null; $("sendbot").disabled = true;
    board = d.board; paintBoard();
    say(d.improved ? "On the board: " + d.score + " in " + d.frames + " " + E.TAS[cat].unit + ", " + d.lines + " lines." : "Checked, but your best (" + d.best.score + " in " + d.best.frames + ", " + d.best.lines + " lines) is still better.", "good");
  } catch (e) { say(e.message, "bad"); }
}
function setLeague(lg) {
  league = lg;
  try { localStorage.setItem("tas.league", lg); } catch {}
  [...$("leagues").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lg === league)));
  pick(cat);
}

function pick(c) {
  if (watch) stopWatch(false);
  if (worker) stopBot();
  cat = c; ran = null;
  try { localStorage.setItem("tas.cat", c); } catch {}
  seed = E.SEEDS[cat];
  movie = ""; g = fresh();
  $("manual").hidden = bots(); $("botpanel").hidden = !bots(); $("sendbot").disabled = true;
  let saved = null; try { saved = localStorage.getItem("tas.bot." + cat); } catch {}
  $("code").value = saved || STARTER[cat]; showLines();
  [...$("cats").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
  $("studiotitle").textContent = E.TAS[cat].name;
  $("studiohow").textContent = bots() ? "Write move(g) below and press Run bot. It plays a fresh random seed in the background, then you can send it." : HOW[kind()];
  $("rules").innerHTML = (bots()
    ? RULES[kind()].slice(1).concat(["Your code defines <code>move(g)</code>. It gets the game and returns the next input, or several in a row. " + BOTRULES[kind()] + " <code>E</code> is the whole engine.",
        "Each run gets its own random seed, which works once, for " + E.SEED_MS / 60000 + " minutes. Ranked by score, then fewest " + E.TAS[cat].unit + ", then fewest lines of code (blank lines and // comments don't count). No anticheat."])
    : RULES[kind()]).map(r => "<li>" + r + "</li>").join("");
  $("keys").innerHTML = PADS[kind()].map(([k, l]) => '<button type="button" data-k="' + esc(k) + '">' + esc(k) + "<span>" + esc(l) + "</span></button>").join("");
  $("keys").querySelectorAll("button").forEach(b => b.onclick = () => input(b.dataset.k));
  const call = body => 'await fetch("' + location.origin + '/api/leaderboard", { method: "POST",\n  headers: { "Content-Type": "application/json", "X-School-Email": EMAIL, "X-School-Password": PASSWORD },\n  body: JSON.stringify(' + body + ') })';
  $("apiex").textContent = bots()
    ? '// 1. a seed (and a ticket for it)\nconst { seed, ticket } = await (' + call('{ action: "tas", op: "seed", cat: "' + cat + '", league: "bot" }') + ').json();\n\n' +
      '// 2. run your bot on it, then send its moves and its code within ' + E.SEED_MS / 60000 + ' minutes\n' + call('{ action: "tas", cat: "' + cat + '", league: "bot", ticket, movie, code }') + ';\n\n' +
      'GET /api/leaderboard?tas=' + cat + '&league=bot           board\n' +
      'GET /api/leaderboard?tas=' + cat + '&league=bot&rank=1    top bot, with its code'
    : call('{ action: "tas", cat: "' + cat + '", movie }') + ';\n\n' +
      'GET /api/leaderboard?tas=' + cat + '           board\n' +
      'GET /api/leaderboard?tas=' + cat + '&rank=1    top movie';
  say(""); draw(); showMovie(); loadBoard();
}

$("cats").innerHTML = Object.entries(E.TAS).map(([k, c]) => '<button type="button" class="diffpill" data-cat="' + k + '">' + esc(c.name) + "</button>").join("");
$("cats").querySelectorAll("button").forEach(b => b.onclick = () => { if (b.dataset.cat !== cat) pick(b.dataset.cat); });
$("leagues").innerHTML = [["fixed", "TAS"], ["bot", "Bots"]].map(([k, l]) => '<button type="button" class="diffpill" data-lg="' + k + '" aria-pressed="' + (k === league) + '">' + l + "</button>").join("");
$("leagues").querySelectorAll("button").forEach(b => b.onclick = () => { if (b.dataset.lg !== league) setLeague(b.dataset.lg); });
$("runbot").onclick = runBot;
$("stopbot").onclick = () => stopBot();
$("sendbot").onclick = sendBot;
$("starter").onclick = () => { $("code").value = STARTER[cat]; showLines(); };
$("code").addEventListener("input", showLines);
$("code").addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); const t = e.target, a = t.selectionStart; t.setRangeText("  ", a, t.selectionEnd, "end"); showLines(); } });

$("undo").onclick = () => { if (watch) stopWatch(true); if (!movie.length) return; rebuild(movie.length - 1); say(""); draw(); showMovie(); };
$("reset").onclick = () => { if (watch) stopWatch(false); if (movie.length > 50 && !confirm("Throw this movie away and start over?")) return; movie = ""; g = fresh(); say(""); draw(); showMovie(); };
$("load").onclick = () => {
  if (watch) stopWatch(false);
  const m = E.cleanMovie($("movie").value);
  movie = ""; g = fresh();
  let i = 0;
  for (; i < m.length; i++) if (!step(m[i])) break;
  const r = E.runTas(cat, movie, seed);
  say(i < m.length ? "Stopped at input " + (i + 1) + ", it can't be played there." : r.ok ? "Loaded: " + r.score + " in " + r.frames + " " + E.TAS[cat].unit + "." : "Loaded " + movie.length + " inputs.", i < m.length ? "bad" : r.ok ? "good" : "");
  draw(); showMovie();
};
$("file").onclick = () => $("picker").click();
$("picker").onchange = () => {
  const f = $("picker").files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { $("movie").value = String(rd.result || ""); $("load").click(); $("picker").value = ""; };
  rd.readAsText(f);
};
$("save").onclick = () => {
  const head = "# " + E.TAS[cat].name + ", " + scoreNow() + " in " + frames() + " " + E.TAS[cat].unit + "\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([head + movie.replace(/(.{80})/g, "$1\n") + "\n"], { type: "text/plain" }));
  a.download = "tas-" + cat + ".txt";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("send").onclick = send;
$("play").onclick = () => { if (!watch) return; watch.paused = !watch.paused; if (!watch.paused && watch.pos >= watch.movie.length) { g = fresh(); movie = ""; watch.pos = 0; } playWatch(); };
$("speed").onchange = () => { if (watch && !watch.paused) playWatch(); };

addEventListener("keydown", e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key, low = k.toLowerCase();
  if (k === "Backspace") { e.preventDefault(); $("undo").click(); return; }
  let ch = null;
  if (kind() === "tetris") {
    if (k === "ArrowLeft") ch = e.shiftKey ? "<" : "L";
    else if (k === "ArrowRight") ch = e.shiftKey ? ">" : "R";
    else if (k === "ArrowDown") ch = e.shiftKey ? "V" : "D";
    else if (k === "ArrowUp" || low === "x") ch = "C";
    else if (low === "z") ch = "Z";
    else if (low === "a") ch = "A";
    else if (low === "c") ch = "H";
    else if (k === " ") ch = "X";
    else if (k === ".") ch = ".";
  } else {
    ch = { arrowup: "u", w: "u", arrowdown: "d", s: "d", arrowleft: "l", a: "l", arrowright: "r", d: "r" }[low] || null;
    if (kind() === "snake" && (k === " " || k === ".")) ch = ".";
  }
  if (!ch) return;
  if (e.repeat && kind() !== "snake") return;
  e.preventDefault();
  input(ch);
});
addEventListener("tt:look", draw);

pick(cat);
