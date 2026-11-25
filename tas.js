import * as E from "./tasengine.js";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const signedIn = () => !!(window.TT && TT.myEmail && TT.myEmail());

const GOAL = { snake100: 100, snakefull: 253 };
const RULES = {
  snake: [
    "A 16 by 16 board that wraps at the edges. You start three long in the middle, heading right, the same as Snake's leaderboard tab.",
    "One character a step: <code>u</code> <code>d</code> <code>l</code> <code>r</code> to turn, <code>.</code> to go straight on. Turning back on yourself does nothing.",
    "Fruit lands on a free cell picked by seed " + E.SEEDS.snake + ": the free cells are counted row by row from the top left, and the seed picks one. Where you go changes where the next one lands.",
    "A crash ends the run and it doesn't count."
  ],
  g2048: [
    "The usual 4 by 4. Two tiles to start, and one more after every move, on a free cell picked by seed " + E.SEEDS.g2048 + " (counted row by row), a 4 one time in ten.",
    "One character a move: <code>u</code> <code>d</code> <code>l</code> <code>r</code>. A move that doesn't shift anything isn't allowed.",
    "Make a 2048 tile in as few moves as you can. Every move changes what spawns next, so the luck is yours to steer."
  ],
  tetris: [
    "A 10 by 20 board, seven-bag pieces from seed " + E.SEEDS.tetris + ", SRS rotation and kicks, 180 spins and hold, the same as the Tetris game.",
    "One character a frame: <code>L</code> <code>R</code> move one, <code>&lt;</code> <code>&gt;</code> slide to the wall, <code>D</code> down one, <code>V</code> down to the floor, <code>C</code> clockwise, <code>Z</code> anticlockwise, <code>A</code> 180, <code>H</code> hold, <code>X</code> hard drop, <code>.</code> wait.",
    "Pieces don't fall on their own and only lock on a hard drop. A move into a wall still costs its frame.",
    "Clear 40 lines in the fewest frames. 60 frames is a second."
  ]
};
const PADS = {
  snake: [["u", "Up"], ["l", "Left"], ["d", "Down"], ["r", "Right"], [".", "Straight"]],
  g2048: [["u", "Up"], ["l", "Left"], ["d", "Down"], ["r", "Right"]],
  tetris: [["<", "Wall"], ["L", "Left"], ["R", "Right"], [">", "Wall"], ["D", "Down"], ["V", "Floor"], ["Z", "Anti"], ["C", "Clock"], ["A", "180"], ["H", "Hold"], ["X", "Drop"], [".", "Wait"]]
};
const HOW = {
  snake: "Arrow keys or WASD turn and take a step, space goes one step straight on. Backspace takes a step back.",
  g2048: "Arrow keys or WASD. Backspace takes a move back.",
  tetris: "Left and right move, with shift they slide to the wall. Down drops one, shift and down to the floor. Up or X clockwise, Z anticlockwise, A for 180, C to hold, space to hard drop, full stop to wait. Backspace takes a frame back."
};
const TCOL = { I: "#38bdf8", O: "#facc15", T: "#c084fc", S: "#4ade80", Z: "#f87171", J: "#60a5fa", L: "#fb923c" };

let cat = "snake100";
try { const c = localStorage.getItem("tas.cat"); if (E.TAS[c]) cat = c; } catch {}
let movie = "", g = null, watch = null, board = null;
const kind = () => E.TAS[cat].game;

function fresh() {
  if (kind() === "snake") return E.snakeNew(E.SEEDS.snake);
  if (kind() === "g2048") return E.g2048New(E.SEEDS.g2048);
  return E.tetrisNew(E.SEEDS.tetris, 40);
}
function finished() {
  if (kind() === "snake") return g.dead ? "crashed" : g.eaten >= GOAL[cat] || g.full ? "done" : "";
  if (kind() === "g2048") return g.max >= 2048 ? "done" : E.g2048Over(g) ? "stuck" : "";
  return g.won ? "done" : g.over ? "topped out" : "";
}
function frames() { return kind() === "snake" ? g.steps : kind() === "g2048" ? g.moves : g.frames; }

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
  if (watch) stopWatch(true);
  if (!step(ch)) {
    say(kind() === "g2048" && !finished() ? "That move doesn't shift anything." : "The run is over. Undo, or start over.", "bad");
    return;
  }
  const f = finished();
  if (f === "done") {
    const r = E.runTas(cat, movie);
    say(r.ok ? "Finished in " + r.frames + " " + E.TAS[cat].unit + ". Send it in." : r.why, r.ok ? "good" : "bad");
  } else if (f) say("The run is over: " + f + ". Undo to try something else.", "bad");
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
  const u = E.TAS[cat].unit, f = finished(), st = f === "done" ? "Finished" : f ? "Over: " + f : watch ? "Watching" : "Playing";
  const rows = [[u[0].toUpperCase() + u.slice(1), frames()]];
  if (kind() === "snake") rows.push(["Fruit", g.eaten + " / " + GOAL[cat]]);
  else if (kind() === "g2048") rows.push(["Biggest tile", g.max], ["Score", g.score]);
  else rows.push(["Lines", g.lines + " / 40"], ["Pieces", g.pieces], ["Time at 60 fps", (g.frames / 60).toFixed(2) + " s"]);
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
    if (watch.pos >= watch.movie.length) { watch.paused = true; $("play").textContent = "Play"; showMovie(); say("That's the whole run. Press a key to branch off from here.", "good"); return; }
    watch.timer = setTimeout(tick, wait);
  };
  tick();
}
async function startWatch(rank) {
  say("Loading the run…");
  try {
    const d = await TT.api("/api/leaderboard", { params: { tas: cat, rank } });
    stopWatch(false);
    g = fresh(); movie = "";
    watch = { movie: E.cleanMovie(d.movie), pos: 0, paused: false, timer: 0 };
    $("watchbar").hidden = false;
    say("Watching number " + rank + ", " + d.frames + " " + E.TAS[cat].unit + ".");
    playWatch();
  } catch (e) { say(e.message, "bad"); }
}

/* the board */
async function loadBoard() {
  const el = $("lb");
  $("boardtitle").textContent = E.TAS[cat].name;
  if (!signedIn()) { el.innerHTML = '<p class="how">Sign in on the timetable to see the board and send runs.</p>'; return; }
  el.innerHTML = window.TT && TT.loader ? TT.loader("Loading the board…", "", { sm: true }) : "";
  try { board = await TT.api("/api/leaderboard", { params: { tas: cat } }); paintBoard(); }
  catch (e) { el.innerHTML = '<p class="how">' + esc(e.message) + "</p>"; }
}
function paintBoard() {
  const el = $("lb"), rows = (board && board.top) || [];
  if (!rows.length) { el.innerHTML = '<p class="how">No runs yet. The first one sets the record.</p>'; return; }
  el.innerHTML = rows.slice(0, 25).map(r => '<div class="tlbrow' + (r.you ? " me" : "") + '"><span class="rk">' + r.rank + '</span><span class="nm">' + esc(r.name) +
    '</span><span class="tm">' + r.frames + '</span><button class="watch" type="button" data-rank="' + r.rank + '">Watch</button>' +
    (board.canEdit ? '<button class="watch" type="button" data-del="' + r.rank + '">Remove</button>' : "") + "</div>").join("");
  el.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => startWatch(+b.dataset.rank));
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!confirm("Take this run off the board?")) return;
    try { board = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", op: "delete", cat, rank: +b.dataset.del } }); paintBoard(); }
    catch (e) { say(e.message, "bad"); }
  });
}

async function send() {
  if (watch) stopWatch(true);
  if (!signedIn()) return say("Sign in on the timetable first.", "bad");
  const r = E.runTas(cat, movie);
  if (!r.ok) return say("Not finished yet: " + r.why + ".", "bad");
  say("Sending…");
  try {
    const d = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", cat, movie } });
    board = d.board; paintBoard();
    say(d.improved ? "Checked and on the board: " + d.frames + " " + E.TAS[cat].unit + "." : "Checked: " + d.frames + ". Your best is still " + d.best + ".", "good");
  } catch (e) { say(e.message, "bad"); }
}

function pick(c) {
  if (watch) stopWatch(false);
  cat = c;
  try { localStorage.setItem("tas.cat", c); } catch {}
  movie = ""; g = fresh();
  [...$("cats").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
  $("studiotitle").textContent = E.TAS[cat].name;
  $("studiohow").textContent = HOW[kind()];
  $("rules").innerHTML = RULES[kind()].concat(cat === "snake100" ? ["Eat 100 fruit in the fewest steps."] : cat === "snakefull" ? ["Fill the whole board, 253 fruit, in the fewest steps."] : []).map(r => "<li>" + r + "</li>").join("");
  $("keys").innerHTML = PADS[kind()].map(([k, l]) => '<button type="button" data-k="' + esc(k) + '">' + esc(k) + "<span>" + esc(l) + "</span></button>").join("");
  $("keys").querySelectorAll("button").forEach(b => b.onclick = () => input(b.dataset.k));
  $("apiex").textContent =
    'const res = await fetch("' + location.origin + '/api/leaderboard", {\n' +
    '  method: "POST",\n' +
    '  headers: { "Content-Type": "application/json", "X-School-Email": EMAIL, "X-School-Password": PASSWORD },\n' +
    '  body: JSON.stringify({ action: "tas", cat: "' + cat + '", movie })\n' +
    '});\n\n' +
    'GET /api/leaderboard?tas=' + cat + '          the board\n' +
    'GET /api/leaderboard?tas=' + cat + '&rank=1   the record\'s movie';
  say(""); draw(); showMovie(); loadBoard();
}

$("cats").innerHTML = Object.entries(E.TAS).map(([k, c]) => '<button type="button" class="diffpill" data-cat="' + k + '">' + esc(c.name) + "</button>").join("");
$("cats").querySelectorAll("button").forEach(b => b.onclick = () => { if (b.dataset.cat !== cat) pick(b.dataset.cat); });

$("undo").onclick = () => { if (watch) stopWatch(true); if (!movie.length) return; rebuild(movie.length - 1); say(""); draw(); showMovie(); };
$("reset").onclick = () => { if (watch) stopWatch(false); if (movie.length > 50 && !confirm("Throw this movie away and start over?")) return; movie = ""; g = fresh(); say(""); draw(); showMovie(); };
$("load").onclick = () => {
  if (watch) stopWatch(false);
  const m = E.cleanMovie($("movie").value);
  movie = ""; g = fresh();
  let i = 0;
  for (; i < m.length; i++) if (!step(m[i])) break;
  const r = E.runTas(cat, movie);
  say(i < m.length ? "Stopped at input " + (i + 1) + ": it can't be played there." : r.ok ? "Loaded. It finishes in " + r.frames + " " + E.TAS[cat].unit + "." : "Loaded " + movie.length + " inputs. " + r.why + ".", i < m.length ? "bad" : r.ok ? "good" : "");
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
  const head = "# " + E.TAS[cat].name + ", " + frames() + " " + E.TAS[cat].unit + "\n";
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
