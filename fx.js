/* ═══════════════════════════════════════════════════════════════════
   fx.js — the moving backgrounds and the page transitions.

   Loaded by theme.js on every page (at once when arriving by a link, so
   the way in is seamless; otherwise in its own time). Nothing here is
   needed for the site to work: with it missing, or Animation off
   (Settings → Animation, html[data-fx="off"]), pages simply change, and
   a theme with a moving background shows one still frame of it.

   · Backgrounds: a theme with a scene (SCENES) gets a <canvas class="fx-bg">
     behind the page, drawn by /fx/<file>.js (loaded only for that theme).
     A scene is FX.scenes[skin] = { dpr, maxPx, fps, create(canvas, env, FX) }
     → { frame(t, dt, ptr), resize(w, h, scale), env(env), dispose() }.
     env = { page, dark, animate }. Time (FX.now) carries on across pages, so
     a background picks up where the last page left it. Frames stop while
     the tab is hidden and while a game is open; on battery or a phone they
     run at 30 a second; a slow device gets a smaller drawing.
   · Transitions: a click on a link to another page of the site plays the
     theme's way out (TR[skin].out), leaves a note (sessionStorage tt.nav)
     and goes; the next page starts under the same cover (TR[skin].cover)
     and plays the way in (TR[skin].in). Layers are .fx-layer children of
     <html>; their looks are in each theme's stylesheet.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
if (window.FX) return;
const root = document.documentElement, TT = window.TT || {};
const cur = document.currentScript;
const V = (cur && (cur.src.match(/[?&]v=([\w.-]+)/) || [])[1]) || TT.ASSET_V || '';
const FX = window.FX = { scenes:{}, V };
const attr = n => root.getAttribute(n) || '';
const on = () => attr('data-fx') === 'on';
const skin = () => attr('data-skin') || 'plain';
const PG = attr('data-pg') || TT.PG || '';
const dark = () => root.style.colorScheme === 'dark';
const ready = fn => { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true }); else fn(); };
FX.dark = dark; FX.page = PG;

/* ── the pointer, for anything that reacts to it ── */
const ptr = FX.ptr = { x:.5, y:.5, px:-9999, py:-9999, on:false, down:0 };
addEventListener('pointermove', e => { ptr.px = e.clientX; ptr.py = e.clientY; ptr.x = e.clientX / innerWidth; ptr.y = e.clientY / innerHeight; ptr.on = true; }, { passive:true });
addEventListener('pointerdown', e => { ptr.px = e.clientX; ptr.py = e.clientY; ptr.x = e.clientX / innerWidth; ptr.y = e.clientY / innerHeight; ptr.down = performance.now(); }, { passive:true });
root.addEventListener('mouseleave', () => { ptr.on = false; });

/* ── one clock for every page of a visit (seconds; starts again after two hours) ── */
let t0 = 0;
try { t0 = +sessionStorage.getItem('fx.t0') || 0; if (!t0 || Date.now() - t0 > 7200e3 || Date.now() < t0){ t0 = Date.now(); sessionStorage.setItem('fx.t0', String(t0)); } } catch { t0 = Date.now(); }
FX.now = () => (Date.now() - t0) / 1000;

/* ── a full-screen WebGL program (one fragment shader), for the scenes that are shaders ── */
FX.gl = function(canvas, frag, pre){
  const gl = canvas.getContext('webgl', { alpha:false, antialias:false, depth:false, stencil:false, powerPreference:'low-power' });
  if (!gl) return null;
  if (pre) pre(gl);                                    // e.g. switch an extension on before the shader is compiled
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);
  const U = {};
  return { gl, u: n => (n in U ? U[n] : (U[n] = gl.getUniformLocation(prog, n))),
    draw(){ gl.viewport(0, 0, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    lose(){ const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } };
};

/* ═══════════════ backgrounds ═══════════════ */
const SCENES = { maximal:'maximal', y2k:'y2k', vapor:'vapor', scifi:'scifi' };       // theme → /fx/<file>.js
const BG = { id:'', canvas:null, scene:null, def:null, env:null, raf:0, last:0, q:1, slow:0, fps:60 };
const loaded = {};
let quiet = false, saving = false;
const coarse = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch { return false; } })();
const envNow = () => ({ page:PG, dark:dark(), animate:on() && !quiet });
const setFps = () => { BG.fps = (BG.def && BG.def.fps) || ((coarse || saving) ? 30 : 60); };
function loadScript(src){
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = no; (document.head || root).appendChild(s); });
}
function sizeBg(force){
  const c = BG.canvas, def = BG.def; if (!c) return false;
  const w0 = c.clientWidth || innerWidth, h0 = c.clientHeight || innerHeight;
  let sc = Math.min(devicePixelRatio || 1, def.dpr || 1.5) * BG.q;
  const maxPx = def.maxPx || 2.2e6;
  if (w0 * h0 * sc * sc > maxPx) sc = Math.sqrt(maxPx / (w0 * h0));
  const w = Math.max(2, Math.round(w0 * sc)), h = Math.max(2, Math.round(h0 * sc));
  if (!force && c.width === w && c.height === h) return false;
  c.width = w; c.height = h;
  if (BG.scene && BG.scene.resize) BG.scene.resize(w, h, sc);
  return true;
}
function unmountBg(){
  if (BG.raf) cancelAnimationFrame(BG.raf);
  if (BG.scene && BG.scene.dispose) try { BG.scene.dispose(); } catch {}
  if (BG.canvas) BG.canvas.remove();
  BG.id = ''; BG.canvas = BG.scene = BG.def = null; BG.raf = 0; BG.last = 0;
  root.classList.remove('fx-live');
}
function mountBg(){
  const want = (!root.classList.contains('zen') && SCENES[skin()]) ? skin() : '';
  if (want === BG.id){
    if (BG.scene){ BG.env = envNow(); if (BG.scene.env) BG.scene.env(BG.env); setFps(); kick(); }
    return;
  }
  unmountBg(); BG.id = want;
  if (!want) return;
  const file = SCENES[want];
  (loaded[file] || (loaded[file] = loadScript('/fx/' + file + '.js?v=' + V))).then(() => ready(() => {
    if (BG.id !== want || BG.scene) return;
    const def = FX.scenes[want]; if (!def) return;
    const c = document.createElement('canvas'); c.className = 'fx-bg'; c.setAttribute('aria-hidden', 'true');
    root.appendChild(c);
    BG.canvas = c; BG.def = def; BG.q = 1; BG.slow = 0; BG.env = envNow(); setFps();
    sizeBg(true);
    let scene = null;
    try { scene = def.create(c, BG.env, FX); } catch (e) { console.warn('fx scene:', e && e.message); }
    if (!scene){ c.remove(); BG.canvas = BG.def = null; return; }     // no WebGL, say: the stylesheet's still background stays
    BG.scene = scene;
    if (scene.resize) scene.resize(c.width, c.height, c.width / (c.clientWidth || innerWidth));
    root.classList.add('fx-live');
    kick();
  }), () => {});
}
function frame(ts){
  BG.raf = 0;
  const sc = BG.scene; if (!sc) return;
  const animate = BG.env.animate && !document.hidden, gap = 1000 / BG.fps;
  if (!BG.last || ts - BG.last >= gap - 4){
    const dt = BG.last ? Math.min(.1, (ts - BG.last) / 1000) : 0;
    if (animate && BG.last){                         // a device that can't keep up gets a smaller drawing
      BG.slow = (ts - BG.last > gap * 1.8) ? BG.slow + 1 : Math.max(0, BG.slow - .3);
      if (BG.slow > 22 && BG.q > .45){ BG.q *= .8; BG.slow = 0; sizeBg(); }
    }
    BG.last = ts;
    try { sc.frame(FX.now(), dt, ptr); } catch (e) { console.warn('fx frame:', e && e.message); unmountBg(); return; }
  }
  if (animate) BG.raf = requestAnimationFrame(frame); else BG.last = 0;
}
function kick(){ if (!BG.raf && BG.scene) BG.raf = requestAnimationFrame(frame); }
FX.refresh = mountBg;

addEventListener('tt:look', mountBg);
let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (sizeBg()) kick(); else if (BG.scene && !BG.env.animate) kick(); }, 140); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
/* a game or a subject open (games.js TTBackOn): the background holds still, so the game has the machine */
setInterval(() => {
  const q = typeof window.TTBackOn === 'function' && !!window.TTBackOn();
  if (q !== quiet){ quiet = q; root.classList.toggle('fx-quiet', q); mountBg(); }
}, 700);
if (navigator.getBattery) navigator.getBattery().then(b => {
  const up = () => { saving = !b.charging; setFps(); };
  b.addEventListener('chargingchange', up); up();
}).catch(() => {});

/* ═══════════════ transitions ═══════════════ */
const NAMES = { home:'Home', timetable:'Timetable', calendar:'Calendar', free:'Free periods', revision:'Revision', resources:'Resources',
                games:'Games', finder:'Finder', mahjong:'Mahjong', notes:'Notes', hkmahjong:'Mahjong' };
FX.NAMES = NAMES;
const pageOf = url => { try { let f = new URL(url, location.href).pathname.split('/').pop().replace(/\.html$/, ''); if (!f || f === 'index') f = 'timetable'; if (f === 'poll') f = 'home'; return f; } catch { return ''; } };
const layer = (cls, html) => { const d = document.createElement('div'); d.className = 'fx-layer ' + (cls || ''); d.setAttribute('aria-hidden', 'true'); if (html) d.innerHTML = html; root.appendChild(d); return d; };
const clearLayers = () => { root.querySelectorAll('.fx-layer').forEach(n => n.remove()); root.classList.remove('fx-in', 'fx-out', 'fx-enter'); };
const after = (ms, fn) => setTimeout(fn, ms);
const ease = { io: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, out: p => 1 - Math.pow(1 - p, 3), in: p => p * p * p };
function run(ms, draw, done){
  const s = performance.now();
  (function step(now){ const p = Math.min(1, Math.max(0, (now - s) / ms)); draw(p); if (p < 1) requestAnimationFrame(step); else if (done) done(); })(s);
}
function canvasLayer(cls, scale){
  const L = layer(cls), c = document.createElement('canvas'), w = innerWidth, h = innerHeight;
  const sc = scale || Math.min(devicePixelRatio || 1, 1.5);
  c.width = Math.max(2, Math.round(w * sc)); c.height = Math.max(2, Math.round(h * sc));
  c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
  L.appendChild(c);
  const x = c.getContext('2d'); x.setTransform(sc, 0, 0, sc, 0, 0);
  return { L, c, x, w, h };
}
/* a small seeded random, so the page left and the page reached draw the same cover */
const rnd = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

/* Only a theme listed here changes page with a transition. Plain, Classic, a custom
     theme and the originals change at once, as they always did. */
const TR = {};
const fade = (o, i) => ({ outMs:o, inMs:i, out(n, done){ root.classList.add('fx-out'); after(o, done); }, in(n, done){ after(i, done); } });
TR.glass = fade(120, 260);                       // the page's contents fade; the clouds behind stay exactly where they were (theme.js keeps them)
TR.editorial = fade(90, 180);                    // quiet: no movement, barely there
TR.terminal = fade(60, 360);                     // the screen clears, then the page is printed from the top (terminal.css)
TR.brutal = fade(120, 470);                      // the blocks are pressed flat; the next page's are stamped down in turn (brutal.css)
TR.blueprint = fade(120, 440);                   // the sheet is plotted again, left to right (blueprint.css)

/* Maximalism: bands of type slide in from alternate sides, carrying the name of the page ahead, and on through */
TR.maximal = {
  outMs:560, inMs:560,
  build(name, cls){
    const cols = ['ink', 'pink', 'cream', 'yellow', 'blue', 'ink'], word = (name || 'MSC Unofficial').toUpperCase();
    return layer('mx-bands ' + (cls || ''), cols.map((c, i) => '<i class="mx-' + c + '" style="--i:' + i + '"><b>' + (word + ' ✳ ').repeat(7) + '</b></i>').join(''));
  },
  out(n, done){ const L = this.build(NAMES[n.to], ''); void L.offsetWidth; L.classList.add('in'); after(540, done); },
  cover(n){ this.build(NAMES[PG], 'in now'); },
  in(n, done){ const L = root.querySelector('.mx-bands'); if (!L) return done(); L.classList.remove('now'); void L.offsetWidth; L.classList.add('go'); after(540, done); }
};

/* Skeuomorphism: a brushed-metal shutter slides across and on */
TR.skeuo = {
  outMs:400, inMs:460,
  out(n, done){ root.classList.add('fx-out'); const L = layer('sk-shutter', '<i><b></b></i>'); void L.offsetWidth; L.classList.add('in'); after(380, done); },
  cover(){ layer('sk-shutter in now', '<i><b></b></i>'); },
  in(n, done){ const L = root.querySelector('.sk-shutter'); if (!L) return done(); L.classList.remove('now'); void L.offsetWidth; L.classList.add('go'); after(440, done); }
};

/* Notebook: a fresh sheet is laid over the page; the next page is written on it */
TR.paper = {
  outMs:380, inMs:380,
  out(n, done){ const L = layer('pp-sheet', '<i></i>'); void L.offsetWidth; L.classList.add('in'); after(360, done); },
  cover(){ layer('pp-sheet in now', '<i></i>'); },
  in(n, done){ const L = root.querySelector('.pp-sheet'); if (L) L.classList.add('go'); after(360, done); }
};

/* Y2K: a body of chrome slides across and on (a transform only, so it stays smooth while the next page loads) */
TR.y2k = {
  outMs:520, inMs:560,
  out(n, done){ const L = layer('yk-wipe', '<i></i>'); void L.offsetWidth; L.classList.add('in'); after(500, done); },
  cover(){ layer('yk-wipe in now', '<i></i>'); },
  in(n, done){ const L = root.querySelector('.yk-wipe'); if (!L) return done(); L.classList.remove('now'); void L.offsetWidth; L.classList.add('go'); after(540, done); }
};
/* Art Deco: two halves of a fan rise to meet; on the next page they fold away from the middle */
function fan(k, p){
  const { x, w, h } = k; x.clearRect(0, 0, w, h); if (p <= 0) return;
  const cx = w / 2, cy = h + 8, R = Math.hypot(w / 2, h) + 60, N = 9, Q = Math.PI / 2, dk = dark();
  const gold = dk ? '#d4af37' : '#a8842c', A = dk ? '#0d0f12' : '#f6efde', B = dk ? '#15191f' : '#ebe0c6';
  const sweep = p * Q;
  for (const side of [1, -1]){
    for (let i = 0; i < N; i++){
      const a0 = i * Q / N, a1 = Math.min(sweep, (i + 1) * Q / N + .002); if (a1 <= a0) break;
      x.beginPath(); x.moveTo(cx, cy);
      if (side === 1) x.arc(cx, cy, R, -a0, -a1, true); else x.arc(cx, cy, R, Math.PI + a0, Math.PI + a1, false);
      x.closePath(); x.fillStyle = i % 2 ? A : B; x.fill();
      x.strokeStyle = gold; x.lineWidth = 1.5; x.stroke();
    }
    x.strokeStyle = gold;
    [[.2, 1], [.215, 1], [.42, 2.5], [.44, 1], [.66, 1], [.675, 1], [.69, 2.5], [.9, 1]].forEach(f => {
      x.lineWidth = f[1]; x.beginPath();
      if (side === 1) x.arc(cx, cy, R * f[0], 0, -sweep, true); else x.arc(cx, cy, R * f[0], Math.PI, Math.PI + sweep, false);
      x.stroke();
    });
  }
}
TR.deco = {
  outMs:440, inMs:540,
  out(n, done){ const k = canvasLayer('dc-fan'); run(420, p => fan(k, ease.io(p)), done); },
  cover(){ const k = canvasLayer('dc-fan'); this.k = k; fan(k, 1); },
  in(n, done){ const k = this.k || canvasLayer('dc-fan'); run(520, p => fan(k, 1 - ease.io(p)), done); }
};

/* Swiss: the page is replaced, square by square, with a composition on the grid; the squares
   take a new arrangement, then leave in order */
TR.swiss = {
  outMs:420, inMs:520,
  build(seed, cls){
    const cols = innerWidth >= innerHeight ? 6 : 3, size = Math.ceil(innerWidth / cols), rows = Math.ceil(innerHeight / size), r = rnd(seed);
    const n = cols * rows, pick = () => Math.floor(r() * n), red = pick(), blacks = new Set([pick(), pick(), pick(), pick()]);
    let html = '';
    for (let y = 0; y < rows; y++) for (let c = 0; c < cols; c++){ const i = y * cols + c;
      html += '<i class="' + (i === red ? 'r' : blacks.has(i) ? 'k' : '') + '" style="left:' + c * size + 'px;top:' + y * size + 'px;width:' + (size + 1) + 'px;height:' + (size + 1) + 'px;--d:' + (c + y) + ';--e:' + (c * 2 + (c % 2 ? rows - y : y)) + '"></i>'; }
    const L = layer('sw-blocks ' + (cls || ''), html); L.style.setProperty('--n', cols + rows);
    return L;
  },
  out(n, done){ const L = this.build(n.seed, ''); void L.offsetWidth; L.classList.add('in'); after(400, done); },
  cover(n){ this.build(n.seed, 'in now'); },
  in(n, done){
    const L = root.querySelector('.sw-blocks'); if (!L) return done();
    const cells = [...L.children], r = rnd((n.seed || 7) * 31 + 5);
    cells.forEach(c => { c.className = ''; });                     // the new arrangement
    [0, 1, 2, 3].forEach(() => { cells[Math.floor(r() * cells.length)].className = 'k'; });
    cells[Math.floor(r() * cells.length)].className = 'r';
    after(110, () => { L.classList.remove('now'); L.classList.add('go'); });
    after(500, done);
  }
};

/* Vaporwave: the picture loses tracking and drops to static; the next page tunes in line by line */
function vhs(k, wipe, mode, label){
  const { x, w, h } = k, dk = dark();
  if (!k.noise){
    const n = document.createElement('canvas'); n.width = 192; n.height = 108; const nx = n.getContext('2d'), d = nx.createImageData(192, 108);
    for (let i = 0; i < d.data.length; i += 4){ const v = Math.random() * 255; d.data[i] = v * .9; d.data[i + 1] = v * .75; d.data[i + 2] = v; d.data[i + 3] = 255; }
    nx.putImageData(d, 0, 0); k.noise = n;
  }
  x.clearRect(0, 0, w, h);
  const y0 = mode === 'cover' ? 0 : wipe * h, y1 = mode === 'cover' ? wipe * h : h;
  if (y1 > y0){
    x.save(); x.beginPath(); x.rect(0, y0, w, y1 - y0); x.clip();
    x.fillStyle = dk ? '#12052a' : '#2b1a5a'; x.fillRect(0, y0, w, y1 - y0);
    x.globalAlpha = .34; x.imageSmoothingEnabled = false;
    x.drawImage(k.noise, Math.random() * 40, Math.random() * 30, 150, 78, 0, 0, w, h);
    x.globalAlpha = 1;
    for (let i = 0; i < 4; i++){ const by = Math.random() * h; x.fillStyle = i % 2 ? 'rgba(255,113,206,.22)' : 'rgba(1,205,254,.2)'; x.fillRect(0, by, w, 2 + Math.random() * 10); }
    x.fillStyle = 'rgba(0,0,0,.28)'; for (let y = y0 - (y0 % 4); y < y1; y += 4) x.fillRect(0, y, w, 1.5);
    if (label && wipe > .5){ x.font = '400 ' + Math.max(22, Math.min(44, w / 22)) + 'px VT323, ui-monospace, monospace'; x.textBaseline = 'top';
      x.fillStyle = 'rgba(1,205,254,.9)'; x.fillText(label, 34, 26); x.fillStyle = '#fff'; x.fillText(label, 32, 24); }
    x.restore();
  }
  const ly = mode === 'cover' ? y1 : y0;                      // the bright line where the picture ends
  if (wipe > 0 && wipe < 1){ x.fillStyle = '#fff'; x.fillRect(0, ly - 2, w, 3); x.fillStyle = 'rgba(255,113,206,.7)'; x.fillRect(0, ly - 8, w, 4); x.fillStyle = 'rgba(1,205,254,.7)'; x.fillRect(0, ly + 3, w, 4); }
}
TR.vapor = {
  outMs:470, inMs:560,
  out(n, done){
    root.classList.add('vp-track');
    const k = canvasLayer('vp-vhs', 1), label = '▶ PLAY  ' + (NAMES[n.to] || '').toUpperCase();
    after(130, () => run(320, p => vhs(k, ease.in(p) * 1.001, 'cover', label), done));
  },
  cover(n){ const k = canvasLayer('vp-vhs', 1); this.k = k; this.label = '▶ PLAY  ' + (NAMES[PG] || '').toUpperCase(); vhs(k, 1, 'cover', this.label);
    this.tick = setInterval(() => vhs(k, 1, 'cover', this.label), 60); },
  in(n, done){ clearInterval(this.tick); const k = this.k || canvasLayer('vp-vhs', 1);
    run(460, p => vhs(k, ease.out(p), 'reveal', ''), () => { root.classList.add('vp-settle'); after(90, () => { root.classList.remove('vp-settle'); done(); }); }); }
};

/* Cyberpunk: the panels shift off behind their angles, the signal breaks up for a moment, the next ones shift in */
function bars(L, n){
  let html = '';
  for (let i = 0; i < n; i++){ const hgt = Math.random() < .3 ? 14 + Math.random() * 60 : 1 + Math.random() * 7;
    html += '<u style="top:' + (Math.random() * 100).toFixed(1) + '%;height:' + hgt.toFixed(0) + 'px;left:' + (Math.random() * 30 - 5).toFixed(0) + '%;width:' + (40 + Math.random() * 70).toFixed(0) + '%;background:' +
      ['#d4ff00', '#0a0b0d', '#e8eae4', '#6b4dff', '#0a0b0d', '#ff3b5c'][Math.floor(Math.random() * 6)] + '"></u>'; }
  L.querySelector('s').innerHTML = html;
}
TR.scifi = {
  outMs:400, inMs:460,
  out(n, done){
    root.classList.add('fx-out');
    const L = layer('cy-link', '<s></s><em></em><b>LINK ' + (NAMES[n.to] || '').toUpperCase() + '</b>');
    after(150, () => { L.classList.add('burst'); bars(L, 12); });
    after(215, () => bars(L, 16));
    after(280, () => { L.classList.add('in'); bars(L, 5); });
    after(340, () => { L.querySelector('s').innerHTML = ''; });
    after(380, done);
  },
  cover(){ layer('cy-link in burst', '<s></s><em></em><b>LINK ' + (NAMES[PG] || '').toUpperCase() + '</b>'); },
  in(n, done){
    const L = root.querySelector('.cy-link'); if (!L) return done();
    bars(L, 14);
    after(70, () => bars(L, 8));
    after(140, () => { L.classList.remove('in'); bars(L, 4); });
    after(200, () => { L.remove(); });
    after(440, done);
  }
};

const trans = () => TR[skin()] || null;
FX.TR = TR;
let leaving = false;
function leave(url){
  const tr = trans();
  if (!tr){ location.href = url; return; }
  if (leaving) return; leaving = true;
  const note = { t:Date.now(), from:PG, to:pageOf(url), skin:skin(), seed:(Date.now() % 100000) + 1 };
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch {} });      // a dialog would sit over the cover
  let gone = false;
  const go = () => { if (gone) return; gone = true; try { sessionStorage.setItem('tt.nav', JSON.stringify(Object.assign(note, { t:Date.now() }))); } catch {} location.href = url; };
  try { tr.out(note, go); } catch { go(); }
  setTimeout(go, (tr.outMs || 400) + 300);
  setTimeout(() => { leaving = false; clearLayers(); root.classList.remove('vp-track'); }, 5000);   // still here (a download, a blocked page): put the page back
}
FX.go = url => { if (on()) leave(url); else location.href = url; };
document.addEventListener('click', e => {
  if (!on() || !trans() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  let u; try { u = new URL(a.href, location.href); } catch { return; }
  if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
  if (u.pathname === location.pathname && u.search === location.search) return;        // somewhere on this page
  if (/^\/(beta|andre|api|q|jim)(\/|$)/.test(u.pathname)) return;                       // not this site's pages
  if (!(/\.html$/.test(u.pathname) || u.pathname.endsWith('/') || u.pathname === '/poll')) return;
  e.preventDefault();
  leave(u.href);
});
/* back from the page cache: the cover from leaving is still up; take it down */
addEventListener('pageshow', e => { if (e.persisted){ leaving = false; clearLayers(); root.classList.remove('vp-track'); kick(); } });

/* arriving */
const nav = TT.nav;
if (nav && root.classList.contains('fx-in') && !trans()) root.classList.remove('fx-in');
if (nav && root.classList.contains('fx-in')){
  const tr = trans();
  try { if (tr.cover) tr.cover(nav); } catch {}
  let entered = false;
  const fin = () => { root.classList.remove('fx-enter', 'fx-in'); root.querySelectorAll('.fx-layer').forEach(n => n.remove()); };
  const enter = () => {
    if (entered) return; entered = true;
    root.classList.remove('fx-in'); root.classList.add('fx-enter');
    let done = false; const end = () => { if (done) return; done = true; fin(); };
    try { tr.in(nav, end); } catch { end(); }
    setTimeout(end, (tr.inMs || 400) + 500);
  };
  ready(() => requestAnimationFrame(() => requestAnimationFrame(enter)));
  setTimeout(enter, 1400);
}

ready(mountBg);
})();
