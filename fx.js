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
const SCENES = { maximal:'maximal', y2k:'y2k', vapor:'vapor', scifi:'scifi', aero:'aero' };       // theme → /fx/<file>.js
const BG = { id:'', canvas:null, scene:null, def:null, env:null, raf:0, last:0, q:1, slow:0, fps:60 };
const loaded = {};
let quiet = false, saving = false;
const coarse = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch { return false; } })();
const envNow = () => ({ page:PG, dark:dark(), animate:on() });
const setFps = () => { BG.fps = (BG.def && BG.def.fps) || ((coarse || saving) ? 30 : 60); if (quiet) BG.fps = Math.min(BG.fps, 20); };
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
function mountBg(early){
  const want = (!root.classList.contains('zen') && SCENES[skin()]) ? skin() : '';
  if (want === BG.id){
    if (BG.scene){ BG.env = envNow(); if (BG.scene.env) BG.scene.env(BG.env); setFps(); kick(); }
    return;
  }
  unmountBg(); BG.id = want;
  if (!want) return;
  const file = SCENES[want];
  const make = () => {
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
    if (early){
      try { scene.frame(FX.now(), 0, ptr); } catch {}           // drawn now, so the first paint already has it
      root.classList.add('fx-live');
    } else {
      /* arriving any other way, the page has already been painted with the stylesheet's still picture: the scene fades in over it */
      c.classList.add('fx-late'); setTimeout(() => { if (BG.canvas === c) root.classList.add('fx-live'); }, 460);
    }
    kick();
  };
  (loaded[file] || (loaded[file] = loadScript('/fx/' + file + '.js?v=' + V))).then(() => early ? make() : ready(make), () => {});
}
/* Arriving by a link, this script was written into the page as it loaded, so the scene's script can be
   too: it runs before the page is first painted, and the background carries straight on from the last
   page instead of dropping to the stylesheet's still picture for a moment (that drop was a flicker).
   Only for the themes whose way in shows the background while the page loads: the others put up an
   opaque cover, and their bigger shaders would only hold the cover up longer. */
const EARLY = { y2k:1, vapor:1, aero:1 };
function writeScene(){
  const want = (!root.classList.contains('zen') && SCENES[skin()]) ? skin() : '';
  try { const nt = performance.getEntriesByType('navigation')[0]; if (nt && nt.type === 'reload' && !(nav && root.classList.contains('fx-in'))) return false; } catch {}
  if (!want || !EARLY[want] || document.readyState !== 'loading' || !cur || cur.async || cur.defer) return false;
  const file = SCENES[want];
  loaded[file] = new Promise((ok, no) => {
    const hit = e => { const el = e.target; if (!el || el.tagName !== 'SCRIPT' || (el.src || '').indexOf('/fx/' + file + '.js') < 0) return false;
      document.removeEventListener('load', onLoad, true); document.removeEventListener('error', onErr, true); return true; };
    const onLoad = e => { if (hit(e)) ok(); }, onErr = e => { if (hit(e)) no(); };
    document.addEventListener('load', onLoad, true); document.addEventListener('error', onErr, true);
  });
  try { document.write('<script src="/fx/' + file + '.js?v=' + V + '"><\/script>'); } catch { delete loaded[file]; return false; }
  return true;
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
FX.refresh = () => mountBg();

addEventListener('tt:look', () => mountBg());
let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (sizeBg()) kick(); else if (BG.scene && !BG.env.animate) kick(); }, 140); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
/* a game or a subject open (games.js TTBackOn): the background keeps moving, but at twenty frames a second, so the game has most of the machine.
   (It used to stop altogether, which looked like a fault.) */
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
TR.editorial = fade(90, 180);
TR.coquette = fade(120, 300);
TR.apple = fade(80, 160);
TR.studio = fade(80, 160);                       // a short cross-fade, nothing else                    // quiet: no movement, barely there
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

/* Skeuomorphism: what is on the desk is picked up; the next page's things are set down in turn (skeuo.css). Nothing covers the screen. */
TR.skeuo = fade(300, 540);

/* Notebook: a fresh sheet is laid over the page; the next page is written on it */
TR.paper = {
  outMs:380, inMs:380,
  out(n, done){ const L = layer('pp-sheet', '<i></i>'); void L.offsetWidth; L.classList.add('in'); after(360, done); },
  cover(){ layer('pp-sheet in now', '<i></i>'); },
  in(n, done){ const L = root.querySelector('.pp-sheet'); if (L) L.classList.add('go'); after(360, done); }
};

/* Y2K Futurism: the page fades; on the next one a wave of liquid chrome crosses the screen once, on a
   slant, and the page is left behind it (y2k.css clips the page to a line inside the wave's solid part,
   so the edge never shows). The wave is drawn once, as an SVG whose bands follow its curved front the way
   reflections run along a rounded surface, and its back fades out, so it reads as a body of metal rather
   than a column. It goes up under the cover, before the page is first shown, so it is ready to move; after
   that only its position and, at the end, its opacity change, and the browser does both off the main
   thread, so a page busy loading can't make it stutter. */
function ykWave(dk){
  const F = d => 'M' + (392 - d) + ' 0C' + (452 - d) + ' 260 ' + (418 - d) + ' 520 ' + (446 - d) + ' 760S' + (404 - d) + ' 1180 ' + (420 - d) + ' 1400';
  const bands = dk ? [[0, '#e3ecf7', 6], [10, '#06080c', 12], [28, '#8597ac', 22], [56, '#0f141b', 26], [92, '#a9bacd', 34], [140, '#19202a', 44], [200, '#55647a', 64], [270, '#0e1319', 80]]
                   : [[0, '#ffffff', 6], [10, '#6f7d8d', 12], [28, '#f7fafd', 22], [56, '#a3afbd', 26], [92, '#ffffff', 34], [140, '#b9c4d0', 44], [200, '#f1f5f9', 64], [270, '#c9d3de', 80]];
  let h = '<svg viewBox="0 0 480 1400" preserveAspectRatio="none" aria-hidden="true"><defs>' +
    '<linearGradient id="yk-m" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="480" y2="0"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".64" stop-color="#fff"/></linearGradient>' +
    '<mask id="yk-k" maskUnits="userSpaceOnUse" x="-40" y="0" width="560" height="1400"><rect x="-40" y="0" width="560" height="1400" fill="url(#yk-m)"/></mask>' +
    '<clipPath id="yk-c"><path d="' + F(0) + 'L0 1400L0 0Z"/></clipPath></defs><g mask="url(#yk-k)">' +
    '<path d="' + F(-6) + '" fill="none" stroke="' + (dk ? '#9fc0e6' : '#ffffff') + '" stroke-width="18" stroke-opacity=".32"/>' +
    '<g clip-path="url(#yk-c)"><rect width="480" height="1400" fill="' + (dk ? '#232b36' : '#dde4ec') + '"/>';
  bands.slice().reverse().forEach(b => [[1.7, .2], [1, .5], [.5, 1]].forEach(k => {
    h += '<path d="' + F(b[0]) + '" fill="none" stroke="' + b[1] + '" stroke-width="' + (b[2] * k[0]).toFixed(1) + '" stroke-opacity="' + k[1] + '"/>'; }));
  return h + '</g><path d="' + F(0) + '" fill="none" stroke="' + (dk ? 'rgba(200,220,245,.55)' : 'rgba(60,80,110,.5)') + '" stroke-width="1.4"/></g></svg>';
}
const ykLayer = () => root.querySelector('.yk-wave') || layer('yk-wave', '<i><b>' + ykWave(dark()) + '</b></i>');
/* Where the browser can (Chromium): a view transition. Nothing happens on the page being left; the browser
   keeps it on screen, and on the next page the wave and the wipe run over it (pagereveal, below; y2k.css). */
const vtArmed = () => !!document.getElementById('tt-vt');
TR.y2k = {
  outMs:130, inMs:540,
  out(n, done){ if (vtArmed()){ n.vt = 1; done(); return; } root.classList.add('fx-out'); after(120, done); },
  cover(){ ykLayer(); },
  in(n, done){ const L = ykLayer(); void L.offsetWidth; L.classList.add('go'); after(540, done); }
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

/* Vaporwave: the tape loses tracking. It is the page itself that distorts, not a cover laid over it: an SVG filter
   shifts the page's own pixels sideways in bands (a small picture of grey bands is the displacement map; a new one each
   step) and pulls its red apart from its green and blue. It worsens until the picture is gone; the next page arrives
   torn the same way and settles. Over it: scanlines, a tracking bar rolling up the screen, and the deck's PLAY mark.
   Where SVG filters on a page are unreliable (Safari), the page jitters and its colour runs instead (vapor.css). */
const VP_SVG = !!window.chrome || /Firefox\//.test(navigator.userAgent);
const vpMap = (bands, amp) => {                      /* grey = no shift; a band's red says how far it is pushed */
  const c = document.createElement('canvas'); c.width = 4; c.height = 96;
  const x = c.getContext('2d'), put = (y, h, v) => { x.fillStyle = 'rgb(' + Math.max(0, Math.min(255, Math.round(128 + v*127))) + ',128,128)'; x.fillRect(0, y, 4, h); };
  put(0, 96, 0);
  for (let y = 0; y < 96; y += 2) put(y, 2, (Math.random() - .5)*.06*amp);
  for (let i = 0; i < bands; i++) put(Math.floor(Math.random()*92), 1 + Math.floor(Math.random()*Math.random()*12), (Math.random() < .5 ? -1 : 1)*(.25 + Math.random()*.75)*amp);
  return c.toDataURL('image/png');
};
function vpStart(osd){
  const L = layer('vp-vhs', '<i></i><b></b><em>&#9654; ' + osd + '</em>');
  if (VP_SVG){
    const d = layer('vp-defs', '<svg width="0" height="0" aria-hidden="true"><filter id="vp-tear" x="-10%" y="-2%" width="120%" height="104%" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">' +
      '<feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="m"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="m" scale="0" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
      '<feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="0" dy="0" result="r2"/>' +
      '<feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="g"/><feOffset in="g" dx="0" dy="0" result="g2"/>' +
      '<feBlend in="r2" in2="g2" mode="screen"/></filter></svg>');
    L.img = d.querySelector('feImage'); L.dis = d.querySelector('feDisplacementMap'); L.off = d.querySelectorAll('feOffset');
  }
  /* one step of the fault: k 0..1 how bad it is */
  L.set = k => {
    root.style.setProperty('--vp-o', String(Math.max(0, 1 - Math.max(0, k - .55)*2.1)));
    if (!L.img) return;
    L.img.setAttribute('href', vpMap(3 + Math.round(k*9), .35 + k*.65));
    L.dis.setAttribute('scale', (.004 + k*k*.2).toFixed(4));
    L.off[0].setAttribute('dx', (.0012 + k*.011).toFixed(4)); L.off[1].setAttribute('dx', (-.0012 - k*.011).toFixed(4));
  };
  root.classList.add(VP_SVG ? 'vp-tear' : 'vp-jit');
  const w = document.querySelector('.wrap'); if (VP_SVG && w) w.style.filter = 'url(#vp-tear)';      /* set here, in the page, so the reference is to this document */
  return L;
}
const vpEnd = () => { root.classList.remove('vp-tear', 'vp-jit'); root.style.removeProperty('--vp-o'); const w = document.querySelector('.wrap'); if (w) w.style.filter = ''; };
TR.vapor = {
  outMs:340, inMs:400,
  out(n, done){
    const L = vpStart('PLAY'), K = [.08, .16, .28, .42, .6, .8, 1];
    K.forEach((k, i) => after(i*45, () => L.set(k)));
    void L.offsetWidth; L.classList.add('roll');
    after(325, done);
  },
  cover(){ root.style.setProperty('--vp-o', '0'); const L = layer('vp-vhs hold', '<i></i><b></b><em>&#9654; PLAY</em>'); this.hold = L; },
  in(n, done){
    if (this.hold) this.hold.remove();
    const L = vpStart('PLAY'), K = [1, .78, .58, .4, .26, .15, .07];
    L.set(1);
    K.forEach((k, i) => after(i*45, () => L.set(k)));
    void L.offsetWidth; L.classList.add('roll');
    after(330, () => { vpEnd(); L.classList.add('off'); });
    after(390, done);
  }
};

/* Frutiger Aero: a thick wall of bubbles rushes up the screen, the way the old cartoons changed scene, and the
   page changes behind its thickest part. Frutiger Evil: a wall of fire instead. Both are drawn from the note's seed,
   so the page left and the page reached draw the same wall and the rush carries straight on across the change.
   (Asked for by name: the one place a page change covers the whole screen, and only for a moment.) */
function aeBubble(evil){
  const R = 128, c = document.createElement('canvas'); c.width = c.height = R * 2 + 4;
  const x = c.getContext('2d'), m = R + 2, body = x.createRadialGradient(m, m, R * .2, m, m, R);
  if (evil){ body.addColorStop(0, 'rgba(255,220,210,.03)'); body.addColorStop(.75, 'rgba(255,200,190,.12)'); body.addColorStop(1, 'rgba(255,215,200,.45)'); }
  else { body.addColorStop(0, 'rgba(255,255,255,.02)'); body.addColorStop(.72, 'rgba(255,255,255,.1)'); body.addColorStop(1, 'rgba(255,255,255,.45)'); }
  x.fillStyle = body; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill();
  const f = x.createLinearGradient(m - R, m - R, m + R, m + R);           // the film: colour round the rim, lower right
  if (evil){ f.addColorStop(0, 'rgba(120,255,200,0)'); f.addColorStop(.45, 'rgba(120,255,200,.4)'); f.addColorStop(.7, 'rgba(255,120,220,.45)'); f.addColorStop(1, 'rgba(255,230,120,.4)'); }
  else { f.addColorStop(0, 'rgba(120,220,255,0)'); f.addColorStop(.55, 'rgba(120,220,255,.35)'); f.addColorStop(.8, 'rgba(255,150,220,.3)'); f.addColorStop(1, 'rgba(255,230,140,.25)'); }
  x.strokeStyle = f; x.lineWidth = R * .08; x.beginPath(); x.arc(m, m, R * .95, 0, 7); x.stroke();
  x.strokeStyle = evil ? 'rgba(255,225,215,.6)' : 'rgba(255,255,255,.75)'; x.lineWidth = R * .025; x.beginPath(); x.arc(m, m, R * .985, 0, 7); x.stroke();
  x.save(); x.translate(m - R * .4, m - R * .44); x.rotate(-.7);                // the window of light, up on the left
  const h = x.createRadialGradient(0, 0, 0, 0, 0, R * .3); h.addColorStop(0, 'rgba(255,255,255,.95)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  x.scale(1, .55); x.fillStyle = h; x.beginPath(); x.arc(0, 0, R * .3, 0, 7); x.fill(); x.restore();
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(m + R * .46, m + R * .5, R * .06, 0, 7); x.fill();
  return c;
}
const AEB = {}; FX.aeBubble = evil => AEB[evil ? 1 : 0] || (AEB[evil ? 1 : 0] = aeBubble(!!evil));     // the background's bubbles too (fx/aero.js)
const AEP = {};
const aePic = n => AEP[n] || (AEP[n] = (() => { const i = new Image(); i.decoding = 'async'; i.src = '/images/th/' + n + '.webp' + (V ? '?v=' + V : ''); return i; })());
const aeOk = i => !!(i && i.complete && i.naturalWidth > 0);
let aeList = null;
function aeWall(k, seed, p){
  const { x, w, h } = k, evil = dark();
  x.clearRect(0, 0, w, h);
  const yc = h * (2 - 3 * p), top = yc - h, bot = yc + h;        // the wall is twice the screen tall; its solid middle more than the screen
  if (bot < 0 || top > h) return;
  const g = x.createLinearGradient(0, top, 0, bot);
  if (!evil){ g.addColorStop(0, 'rgba(200,240,255,0)'); g.addColorStop(.12, 'rgba(170,228,252,.85)'); g.addColorStop(.18, 'rgba(120,205,248,1)'); g.addColorStop(.5, 'rgba(40,150,228,1)');
              g.addColorStop(.82, 'rgba(20,110,205,1)'); g.addColorStop(.9, 'rgba(20,110,205,.7)'); g.addColorStop(1, 'rgba(20,110,205,0)'); }
  else { g.addColorStop(0, 'rgba(255,120,0,0)'); g.addColorStop(.1, 'rgba(255,110,0,.85)'); g.addColorStop(.18, 'rgba(255,150,10,1)'); g.addColorStop(.42, 'rgba(255,70,0,1)');
         g.addColorStop(.7, 'rgba(170,10,0,1)'); g.addColorStop(.84, 'rgba(70,0,0,1)'); g.addColorStop(.92, 'rgba(30,0,0,.7)'); g.addColorStop(1, 'rgba(20,0,0,0)'); }
  x.fillStyle = g; const y0 = Math.max(0, top), y1 = Math.min(h, bot); x.fillRect(0, y0, w, y1 - y0);
  if (!evil){
    /* the bubbles: a couple of hundred, a few big ones in front, each rising a little faster or slower than the wall */
    const key = seed + ':' + w + ':' + h;
    if (!aeList || aeList.key !== key){
      const r = rnd(seed), N = Math.min(260, Math.round(90 + w * h / 9000)), L = [];
      for (let i = 0; i < N; i++){ const rad = 5 + 105 * Math.pow(r(), 2.8); L.push({ bx:r() * w, dy:(r() * 2.5 - 1.25) * h, rad, sp:.88 + .26 * r(), sw:(r() - .5) * 40, ph:r() * 6.3 }); }
      L.sort((a, b) => a.rad - b.rad); aeList = { key, L };
    }
    const spr = FX.aeBubble(false);
    x.globalAlpha = .95;
    for (const b of aeList.L){
      const y = h * (2 - 3 * p * b.sp) + b.dy; if (y < -b.rad || y > h + b.rad) continue;
      x.drawImage(spr, b.bx + Math.sin(p * 9 + b.ph) * b.sw - b.rad, y - b.rad, b.rad * 2, b.rad * 2);
    }
    x.globalAlpha = 1;
    return;
  }
  /* fire: the photograph's flames rising through the middle, tongues of flame along the top edge, sparks above */
  const fire = aePic('ar-fire'), tongues = aePic('ar-flames'), r = rnd(seed);
  if (aeOk(fire)){                                    // one photograph of fire across the wall's middle, stretched a little as it goes
    const c0 = top + 2 * h * .03, ch = 2 * h * .9, cw = Math.max(w * 1.1, ch * fire.naturalWidth / fire.naturalHeight * .9);
    x.save(); x.globalAlpha = .92; x.translate(w / 2, c0); x.scale(1, 1 + .04 * Math.sin(p * 23)); x.drawImage(fire, -cw / 2, 0, cw, ch); x.restore();
  }
  if (aeOk(tongues)){
    const tw = Math.max(w / 2.2, 380), th = tw * tongues.naturalHeight / tongues.naturalWidth;
    x.save();
    for (let xx = -tw * r(), c = 0; xx < w; xx += tw * .8, c++){
      const k2 = 1 + .12 * Math.sin(p * 37 + c * 1.7) + .06 * Math.sin(p * 61 + c);
      x.save(); x.translate(xx + tw / 2, top + 2 * h * .16); x.scale(c % 2 ? -1 : 1, k2 * 1.25); x.drawImage(tongues, -tw / 2, -th, tw, th); x.restore();
    }
    x.restore();
  }
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++){
    const ex = r() * w, ey = top + 2 * h * .12 - r() * h * .55 - p * h * .4 * r(), er = 1 + 2.5 * r(), gch = 140 + 100 * r() | 0, ea = .5 + .5 * r();
    if (ey < -10 || ey > h + 10) continue;
    x.fillStyle = 'rgba(255,' + gch + ',40,' + ea + ')'; x.beginPath(); x.arc(ex + Math.sin(p * 20 + i) * 8, ey, er, 0, 7); x.fill();
  }
  x.restore();
}
TR.aero = {
  outMs:430, inMs:620,
  pics(){ if (dark()){ aePic('ar-fire'); aePic('ar-flames'); } },
  layer(){ return canvasLayer('ae-wall', dark() ? .6 : undefined); },
  out(n, done){ this.pics(); const k = this.layer(); run(420, p => aeWall(k, n.seed, p * .5), done); },
  cover(n){ this.pics(); this.k = this.layer(); aeWall(this.k, n.seed, .5); },
  in(n, done){ const k = this.k || this.layer(); run(600, p => aeWall(k, n.seed, .5 + ease.out(p) * .5), done); }
};
if (skin() === 'aero') TR.aero.pics();

/* Gen X Soft Club: the page smears sideways and breaks into a digital glitch (a horizontal blur, bands of it pushed
   along, the red pulled from the blue), and the next one comes in the same way and settles. Same SVG-filter-on-the-page
   approach as Vaporwave, with the same fallback (a plain slide, softclub.css) where filters on a page are unreliable. */
if (VP_SVG) root.classList.add('sc-svg');
/* Soft Club's photographs, one per kind of page (skins/softclub.css), so the next one can be fetched while this page
   leaves and decoded before the next one smears in (a photograph still arriving was the stutter). The others are
   fetched quietly once the page has settled, so every page after the first finds its photograph waiting. */
const SC_PH = { home:'sc-home', timetable:'sc-calm', games:'sc-green', mahjong:'sc-green', free:'sc-lounge', revision:'sc-lounge', notes:'sc-lounge',
                calendar:'sc-crowd', finder:'sc-crowd', resources:'sc-crowd' };
const scUrl = pg => { const n = SC_PH[pg] || 'sc-home', mm = q => { try { return matchMedia(q).matches; } catch { return false; } };
  return '/images/th/' + n + (mm('(max-aspect-ratio:4/5)') ? '-p' : mm('(max-width:700px)') ? '-s' : '') + '.webp'; };
const SCI = {};
const scPic = pg => { const u = scUrl(pg); if (!SCI[u]){ const i = new Image(); i.decoding = 'async'; i.src = u; SCI[u] = i; } return SCI[u]; };
if (skin() === 'softclub') ready(() => setTimeout(() => (window.requestIdleCallback || (f => setTimeout(f, 1)))(() => {
  if (skin() === 'softclub') [...new Set(Object.values(SC_PH))].forEach((n, k) => setTimeout(() => scPic(Object.keys(SC_PH).find(pg => SC_PH[pg] === n)), k * 300));
}), 1500));
/* the smear: a horizontal blur, bands pushed sideways (a few displacement maps made once, not every step), red split
   from green and blue. Kept light: the filter covers the whole page, however long it is. */
let SC_MAPS = null;
function scStart(dir){
  if (!SC_MAPS) SC_MAPS = [vpMap(2, .3), vpMap(4, .55), vpMap(6, .8), vpMap(8, 1)];
  const d = layer('sc-defs', '<svg width="0" height="0" aria-hidden="true"><filter id="sc-smear" x="-25%" y="-2%" width="150%" height="104%" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="0 0" result="b"/>' +
    '<feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="m"/>' +
    '<feDisplacementMap in="b" in2="m" scale="0" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
    '<feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="0" dy="0" result="r2"/>' +
    '<feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="g"/><feOffset in="g" dx="0" dy="0" result="g2"/>' +
    '<feBlend in="r2" in2="g2" mode="screen"/></filter></svg>');
  const blur = d.querySelector('feGaussianBlur'), img = d.querySelector('feImage'), dis = d.querySelector('feDisplacementMap'), off = d.querySelectorAll('feOffset');
  const wr = document.querySelector('.wrap'); if (wr) wr.style.filter = 'url(#sc-smear)';
  let lastMap = -1;
  return k => {                                       /* k 0..1: how far gone */
    blur.setAttribute('stdDeviation', (k * k * .03).toFixed(4) + ' 0');
    const m = Math.min(3, Math.floor(k * 4)); if (m !== lastMap){ img.setAttribute('href', SC_MAPS[m]); lastMap = m; }
    dis.setAttribute('scale', (k * k * .12).toFixed(4));
    off[0].setAttribute('dx', (k * .012).toFixed(4)); off[1].setAttribute('dx', (-k * .012).toFixed(4));
    if (wr){ wr.style.transform = 'translateX(' + (dir * k * k * 7).toFixed(2) + 'vw)'; wr.style.opacity = String(Math.max(0, 1 - Math.max(0, k - .55) * 2.3)); }
  };
}
const scEnd = () => { const wr = document.querySelector('.wrap'); if (wr){ wr.style.filter = wr.style.transform = wr.style.opacity = ''; } };
/* the way in waits (a fifth of a second at most) for this page's photograph to be decoded, so the smear runs on a finished picture */
const scReady = go => { let gone = false; const once = () => { if (!gone){ gone = true; go(); } }; const i = scPic(PG);
  if (i.decode) i.decode().then(once, once); else if (i.complete) once(); else i.onload = once; after(200, once); };
TR.softclub = VP_SVG ? {
  outMs:300, inMs:420,
  out(n, done){ scPic(n.to); const set = scStart(-1), K = [.15, .35, .6, .85, 1]; set(.05); K.forEach((k, i) => after(45 + i * 50, () => set(k))); after(300, done); },
  in(n, done){ const set = scStart(1); set(1); scReady(() => { const K = [.8, .58, .38, .2, .07, 0]; K.forEach((k, i) => after(i * 50, () => set(k))); after(320, () => { scEnd(); done(); }); }); }
} : {
  outMs:200, inMs:420,
  out(n, done){ scPic(n.to); root.classList.add('fx-out'); after(200, done); },
  in(n, done){ after(420, done); }
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
  setTimeout(() => { leaving = false; clearLayers(); vpEnd(); }, 5000);   // still here (a download, a blocked page): put the page back
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
addEventListener('pageshow', e => { if (e.persisted){ leaving = false; clearLayers(); vpEnd(); kick(); } });

/* arriving */
const nav = TT.nav;
if (nav && root.classList.contains('fx-in') && !trans()) root.classList.remove('fx-in');
if (nav && root.classList.contains('fx-in')){
  const tr = trans();
  try { if (tr.cover) tr.cover(nav); } catch {}
  let entered = false;
  const fin = () => { root.classList.remove('fx-enter', 'fx-in'); root.querySelectorAll('.fx-layer').forEach(n => n.remove()); vpEnd(); scEnd(); };      /* vpEnd: never leave the page under Vaporwave's filter, whatever went wrong */
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

if (((nav && root.classList.contains('fx-in')) || vtArmed()) && writeScene()) mountBg(true); else ready(() => mountBg());
/* the view transition's way in (Y2K Futurism): the wave goes up as the new page is first shown, starts with the
   browser's wipe, and comes down when it is done */
addEventListener('pagereveal', e => {
  const vt = e.viewTransition; if (!vt) return;
  if (skin() !== 'y2k' || !on()){ try { vt.skipTransition(); } catch {} return; }
  const L = ykLayer(); L.classList.add('vt');
  vt.ready.then(() => L.classList.add('go'), () => L.remove());
  vt.finished.finally(() => L.remove());
});
})();
