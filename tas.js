import * as E from "./tasengine.js?v=20261126a";

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
try { if (localStorage.getItem("tas.league") === "random") league = "random"; } catch {}
let movie = "", g = null, watch = null, board = null, live = null, seed = E.SEEDS[cat], clock = 0;
const kind = () => cat;
const random = () => league === "random";

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
  if (watch) stopWatch(true);
  if (random() && !live) return say("Press New seed first.", "bad");
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
    if (watch.pos >= watch.movie.length) { watch.paused = true; $("play").textContent = "Play"; showMovie(); say("End of the run. Press a key to carry on from here.", "good"); return; }
    watch.timer = setTimeout(tick, wait);
  };
  tick();
}
async function startWatch(rank) {
  say("Loading the run…");
  try {
    const d = await TT.api("/api/leaderboard", { params: { tas: cat, rank } });
    stopWatch(false);
    seed = d.seed; live = null; showSeed();
    g = fresh(); movie = "";
    watch = { movie: E.cleanMovie(d.movie), pos: 0, paused: false, timer: 0 };
    $("watchbar").hidden = false;
    say("Watching #" + rank + ": " + d.score + " in " + d.frames + " " + E.TAS[cat].unit + ".");
    playWatch();
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
  const secs = r => random() ? '<span class="tm">' + (r.ms == null ? "" : (r.ms / 1000).toFixed(1) + "s") + "</span>" : "";
  el.innerHTML = '<div class="tlbrow tlbhd"><span class="rk">#</span><span class="nm">Player</span><span class="tm">Score</span><span class="tm">' + esc(E.TAS[cat].unit) + "</span>" + (random() ? '<span class="tm">Took</span>' : "") + '<span class="watch" style="visibility:hidden">Watch</span></div>' +
    rows.slice(0, 25).map(r => '<div class="tlbrow' + (r.you ? " me" : "") + '"><span class="rk">' + r.rank + '</span><span class="nm">' + esc(r.name) +
    '</span><span class="tm">' + r.score + '</span><span class="tm">' + r.frames + "</span>" + secs(r) + '<button class="watch" type="button" data-rank="' + r.rank + '">Watch</button>' +
    (board.canEdit ? '<button class="watch" type="button" data-del="' + r.rank + '">Remove</button>' : "") + "</div>").join("");
  el.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => startWatch(+b.dataset.rank));
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!confirm("Take this run off the board?")) return;
    try { board = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", op: "delete", cat, league, rank: +b.dataset.del } }); paintBoard(); }
    catch (e) { say(e.message, "bad"); }
  });
}

async function send() {
  if (watch) stopWatch(true);
  if (!signedIn()) return say("Sign in on the timetable first.", "bad");
  if (random() && !live) return say("Press New seed first.", "bad");
  const r = E.runTas(cat, movie, seed);
  if (!r.ok) return say("Can't send that: " + r.why + ".", "bad");
  say("Sending…");
  try {
    const d = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", cat, movie, league, ticket: live && live.ticket } });
    if (random()) { live = null; showSeed(); }
    board = d.board; paintBoard();
    say(d.improved ? "On the board: " + d.score + " in " + d.frames + " " + E.TAS[cat].unit + "." : "Checked, but your best (" + d.best.score + " in " + d.best.frames + ") is still better.", "good");
  } catch (e) { say(e.message, "bad"); }
}

function showSeed() {
  clearInterval(clock);
  $("seedbar").hidden = !random();
  if (!random()) return;
  const paint = () => {
    if (!live) { $("seedtime").textContent = "Get a seed, then send a run on it within " + E.SEED_MS / 60000 + " minutes."; return; }
    const left = Math.max(0, live.until - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    $("seedtime").innerHTML = "Seed <b>" + live.seed + "</b> · " + (left ? m + ":" + String(s).padStart(2, "0") + " left" : "out of time, get a new one");
  };
  paint(); if (live) clock = setInterval(paint, 1000);
}
async function newSeed() {
  if (!signedIn()) return say("Sign in on the timetable first.", "bad");
  try {
    const d = await TT.api("/api/leaderboard", { method: "POST", body: { action: "tas", op: "seed", cat, league: "random" } });
    if (watch) stopWatch(false);
    live = { seed: d.seed, ticket: d.ticket, until: Date.now() + d.ms }; seed = d.seed;
    movie = ""; g = fresh(); say("New game. Go."); draw(); showMovie(); showSeed();
  } catch (e) { say(e.message, "bad"); }
}
function setLeague(lg) {
  league = lg; live = null;
  try { localStorage.setItem("tas.league", lg); } catch {}
  [...$("leagues").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lg === league)));
  pick(cat);
}

function pick(c) {
  if (watch) stopWatch(false);
  if (c !== cat) live = null;
  cat = c;
  try { localStorage.setItem("tas.cat", c); } catch {}
  seed = random() ? (live ? live.seed : E.SEEDS[cat]) : E.SEEDS[cat];
  movie = ""; g = fresh(); showSeed();
  [...$("cats").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
  $("studiotitle").textContent = E.TAS[cat].name;
  $("studiohow").textContent = HOW[kind()];
  $("rules").innerHTML = RULES[kind()].concat(random() ? ["Random seed: every game has its own seed instead of the one above. Each seed works once, for " + E.SEED_MS / 60000 + " minutes."] : []).map(r => "<li>" + r + "</li>").join("");
  $("keys").innerHTML = PADS[kind()].map(([k, l]) => '<button type="button" data-k="' + esc(k) + '">' + esc(k) + "<span>" + esc(l) + "</span></button>").join("");
  $("keys").querySelectorAll("button").forEach(b => b.onclick = () => input(b.dataset.k));
  const call = body => 'await fetch("' + location.origin + '/api/leaderboard", { method: "POST",\n  headers: { "Content-Type": "application/json", "X-School-Email": EMAIL, "X-School-Password": PASSWORD },\n  body: JSON.stringify(' + body + ') })';
  $("apiex").textContent = random()
    ? '// 1. a seed (and a ticket for it)\nconst { seed, ticket } = await (' + call('{ action: "tas", op: "seed", cat: "' + cat + '", league: "random" }') + ').json();\n\n' +
      '// 2. play it with your bot, then send the movie within ' + E.SEED_MS / 60000 + ' minutes\n' + call('{ action: "tas", cat: "' + cat + '", league: "random", ticket, movie }') + ';\n\n' +
      'GET /api/leaderboard?tas=' + cat + '&league=random   board'
    : call('{ action: "tas", cat: "' + cat + '", movie }') + ';\n\n' +
      'GET /api/leaderboard?tas=' + cat + '           board\n' +
      'GET /api/leaderboard?tas=' + cat + '&rank=1    top movie';
  say(""); draw(); showMovie(); loadBoard();
}

$("cats").innerHTML = Object.entries(E.TAS).map(([k, c]) => '<button type="button" class="diffpill" data-cat="' + k + '">' + esc(c.name) + "</button>").join("");
$("cats").querySelectorAll("button").forEach(b => b.onclick = () => { if (b.dataset.cat !== cat) pick(b.dataset.cat); });
$("leagues").innerHTML = [["fixed", "Fixed seed"], ["random", "Random seed"]].map(([k, l]) => '<button type="button" class="diffpill" data-lg="' + k + '" aria-pressed="' + (k === league) + '">' + l + "</button>").join("");
$("leagues").querySelectorAll("button").forEach(b => b.onclick = () => { if (b.dataset.lg !== league) setLeague(b.dataset.lg); });
$("newseed").onclick = newSeed;

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
