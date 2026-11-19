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

/* Frutiger Aero: a thick wall of bubbles rushes up the screen, the way the old cartoons changed scene: a few strays
   first, then a mass of them packed so close the page behind is lost in them, then the last ones trailing off. Every
   bubble rises at its own speed (the big ones fastest), weaves from side to side, wobbles out of round, swells a little
   as it rises, and here and there one pops. The page changes behind the wall's thickest part: above it the page being
   left is still there, below it the next one. Frutiger Evil: a wall of fire instead, flames flickering all through it
   and licking up from its leading edge, loose flames and sparks flying on ahead, smoke left behind.
   The wall is drawn frame by frame (aeWallEngine), in a worker where the browser can hand it the canvas, so a page busy
   loading can't make it stutter; elsewhere on the page. The next page shows through a soft-edged mask that rises on the
   same curve and clock (the browser runs that part itself), its edge in the wall's thickest part.
   Where the browser has view transitions across pages (Chromium, Safari 18.2+) the page being left really is still
   there above the wall (theme.js opts in, as for Y2K; pagereveal below starts it); elsewhere it fades as it is left and
   the wall uncovers the next one over the background. */
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

/* ── the wall, frame by frame. Self-contained: everything it needs is passed in (cfg, and the two photographs of fire
   as they arrive), so the same code runs in a worker or on the page. G: the global scope (self, or window). ── */
function aeWallEngine(G){
  const mk = (w, h) => { w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = G.document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rnd = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bez = (a, b, c, d) => {                       // CSS cubic-bezier(a, b, c, d), so the wall keeps to the mask's curve
    const X = t => ((1 - 3 * c + 3 * a) * t + (3 * c - 6 * a)) * t * t + 3 * a * t, Y = t => ((1 - 3 * d + 3 * b) * t + (3 * d - 6 * b)) * t * t + 3 * b * t;
    return p => { if (p <= 0) return 0; if (p >= 1) return 1; let lo = 0, hi = 1; for (let i = 0; i < 24; i++){ const m = (lo + hi) / 2; if (X(m) < p) lo = m; else hi = m; } return Y((lo + hi) / 2); };
  };
  const now = () => (G.performance.timeOrigin || 0) + G.performance.now();
  const next = G.requestAnimationFrame ? f => G.requestAnimationFrame(f) : f => G.setTimeout(() => f(), 16);
  let cv = null, X = null, C = null, ease = null, start = 0, going = false, stopped = false;
  let B = null, nBack = 0, SPR = null, HZ = null;                                  // Aero
  let FL = null, WSP = null, BODY = null, GL = null, SPK = null, SMK = null, SP = null, WS = null, SM = null;      // Evil
  const lin = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
  function toon(v){                                   // a cartoon bubble: clear, a crisp white outline with a little blue round it, a crescent of light; four ways
    const R = 96, c = mk(R * 2 + 10, R * 2 + 10), x = c.getContext('2d'), m = R + 5, b = x.createRadialGradient(m - R * .2, m - R * .25, R * .1, m, m, R);
    b.addColorStop(0, 'rgba(235,250,255,.08)'); b.addColorStop(.78, 'rgba(195,236,255,.2)'); b.addColorStop(1, 'rgba(175,228,255,.42)');
    x.fillStyle = b; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill();
    x.strokeStyle = 'rgba(30,130,210,.7)'; x.lineWidth = R * .035; x.beginPath(); x.arc(m, m, R * 1.01, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(140,220,255,.8)'; x.lineWidth = R * .1; x.beginPath(); x.arc(m, m, R * .935, 0, 7); x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = R * (.05 + .012 * v); x.beginPath(); x.arc(m, m, R * .97, 0, 7); x.stroke();
    const a0 = [1.08, 1, 1.15, 1.04][v], a1 = [1.42, 1.3, 1.46, 1.52][v];
    x.lineCap = 'round'; x.lineWidth = R * [.11, .09, .13, .1][v]; x.beginPath(); x.arc(m, m, R * .7, Math.PI * a0, Math.PI * a1); x.stroke();
    const ad = Math.PI * (a1 + .1); x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(m + Math.cos(ad) * R * .7, m + Math.sin(ad) * R * .7, R * .065, 0, 7); x.fill();
    if (v !== 2){ x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = R * .05; x.beginPath(); x.arc(m, m, R * .72, Math.PI * .15, Math.PI * .35); x.stroke(); }
    return c;
  }
  /* the flames' cut-out with its faint haze taken out and its edges feathered, so where pieces of it meet or overlap no
     straight edge or pale rectangle shows; and five loose flames cut from it, each feathered into a soft oval */
  function soften(im){
    const iw = im.width, ih = im.height, c = mk(iw, ih), x = c.getContext('2d'); x.drawImage(im, 0, 0);
    try { const d = x.getImageData(0, 0, iw, ih), p = d.data; for (let i = 3; i < p.length; i += 4){ const a = p[i]; p[i] = a < 30 ? 0 : Math.min(255, (a - 30) * 1.14); } x.putImageData(d, 0, 0); } catch {}
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, 0, iw, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.13, '#000'); g.addColorStop(.87, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, iw, ih);
    const v = x.createLinearGradient(0, 0, 0, ih); v.addColorStop(0, '#000'); v.addColorStop(.88, '#000'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, iw, ih);
    return c;
  }
  function wisps(src){
    const iw = src.width, ih = src.height, sw = iw * .26, out = [];
    for (let i = 0; i < 5; i++){
      const c = mk(sw, ih), x = c.getContext('2d'); x.drawImage(src, Math.min(iw - sw, i * iw * .185), 0, sw, ih, 0, 0, sw, ih);
      x.globalCompositeOperation = 'destination-in'; x.translate(sw / 2, ih * .56); x.scale(sw / 2, ih * .5);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, '#000'); g.addColorStop(.55, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(-1, -1.2, 2, 2.4); out.push(c);
    }
    return out;
  }
  function glow(R, inner, outer){ const c = mk(R * 2, R * 2), x = c.getContext('2d'), g = x.createRadialGradient(R, R, 0, R, R, R); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2); return c; }
  function initAero(){
    const { w, h, T, s } = C, r = rnd(C.seed * 13 + 7), D = h + T;
    SPR = [0, 1, 2, 3].map(toon);
    HZ = lin(0, T, [[.1, 'rgba(225,246,255,0)'], [.3, 'rgba(225,246,255,.26)'], [.65, 'rgba(225,246,255,.26)'], [.92, 'rgba(225,246,255,0)']]);
    const dens = v => v < .05 ? 0 : v < .2 ? (v - .05) / .15 : v < .72 ? 1 : Math.max(.08, 1 - (v - .72) / .3);
    const N = [Math.round(w * T / 2700), Math.round(w * T / 1750 / (s * s)), Math.round(10 + w / 70)];
    B = [];
    for (let kind = 0; kind < 3; kind++) for (let tries = 0, n = 0; n < N[kind] && tries < N[kind] * 8; tries++){
      const v = r(); if (kind < 2 && r() > dens(v)) continue;
      const u = r(), rad = (kind === 0 ? 3 + 13 * u * u : kind === 1 ? 8 + 72 * Math.pow(u, 2.1) : 40 + 95 * u) * s;
      const y0 = h + rad * 1.2 + (kind === 2 ? T * .1 : 0) + v * (kind === 0 ? T * .95 : T);
      let sp = kind === 0 ? .86 + .1 * r() : kind === 1 ? .88 + .24 * Math.pow(rad / (80 * s), .8) + .06 * (r() - .5) : 1.12 + .18 * r();
      sp = Math.max(sp, (y0 + rad * 1.3 + 12) / D);                                  // whatever its speed, it is off the top by the end
      B.push({ kind, x0:r() * w, y0, rad, sp, n:n++,
        wa:(2 + 10 * r()) * Math.sqrt(rad / 20), wf:2 * Math.PI * (1.4 + 1.2 * r()) / (1 + rad / 50), wp:r() * 6.3, dx:(r() - .5) * 50 * s,
        qa:.025 + .05 * r(), qf:2 * Math.PI * (2.4 + 2 * r()), qp:r() * 6.3, rot:(r() - .5) * .9, v:(r() * 4) | 0,
        pop:kind && r() < .2 ? h * (.06 + .5 * r()) : -1e9, pt:-1 });
    }
    B.sort((a, b) => a.kind - b.kind || a.rad - b.rad);
    nBack = B.findIndex(b => b.kind > 0); if (nBack < 0) nBack = B.length;
  }
  function drawAero(e, tau){
    const { w, h, T, k } = C, D = h + T;
    for (let i = 0; i < B.length; i++){
      if (i === nBack){ X.globalAlpha = 1; X.setTransform(k, 0, 0, k, 0, k * (h - D * e)); X.fillStyle = HZ; X.fillRect(0, 0, w, T); }    // a little light in the thick of it
      const b = B[i], rr = b.rad * (1 + .1 * e), y = b.y0 - b.sp * D * e;
      if (y < -rr * 1.6 || y > h + rr * 1.6) continue;
      const x = b.x0 + b.wa * Math.sin(b.wf * tau + b.wp) + b.dx * e;
      if (!b.kind){ X.globalAlpha = .55; X.setTransform(k, 0, 0, k, k * x, k * y); X.drawImage(SPR[b.v], -rr, -rr, rr * 2, rr * 2); continue; }
      let al = b.kind === 1 ? .95 : .9, sc = 1, q = 0;
      if (b.pop > -1e8 && y < b.pop && e > .12){                                    // pop: it swells, thins and is gone, a few drops flying off
        if (b.pt < 0) b.pt = tau;
        q = (tau - b.pt) / .16; if (q >= 1) continue;
        sc = 1 + .45 * q; al *= 1 - q;
      }
      const sq = b.qa * Math.sin(b.qf * tau + b.qp), sx = (1 + sq) * sc, sy = (1 - sq * .8) * sc, ro = b.rot + .12 * Math.sin(.8 * tau + b.wp), co = Math.cos(ro), si = Math.sin(ro);
      X.globalAlpha = al;
      X.setTransform(k * sx * co, k * sy * si, -k * sx * si, k * sy * co, k * x, k * y);
      X.drawImage(SPR[b.v], -rr, -rr, rr * 2, rr * 2);
      if (q > 0){
        X.setTransform(k, 0, 0, k, 0, 0); X.fillStyle = '#fff'; X.globalAlpha = 1 - q;
        for (let j = 0; j < 6; j++){ const a = j * 1.047 + b.wp, d = rr * (1.05 + 1.1 * q); X.beginPath(); X.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, (1.2 + rr * .04) * (1 - q * .6), 0, 7); X.fill(); }
      }
    }
  }
  function initFire(){
    const { w, h, T, s } = C, r = rnd(C.seed * 17 + 3), D = h + T;
    GL = lin(0, T, [[0, 'rgba(255,150,30,0)'], [.14, 'rgba(255,150,30,0)'], [.22, 'rgba(255,130,20,.85)'], [.3, 'rgba(255,100,0,1)'], [.5, 'rgba(220,50,0,1)'],
                    [.66, 'rgba(140,15,0,1)'], [.76, 'rgba(50,4,0,.92)'], [.9, 'rgba(25,0,0,.5)'], [1, 'rgba(20,0,0,0)']]);
    SPK = glow(16, 'rgba(255,230,150,1)', 'rgba(255,90,0,0)');
    SMK = glow(64, 'rgba(22,6,2,.55)', 'rgba(22,6,2,0)');
    SP = []; for (let i = 0; i < 150; i++){ const y0 = h + T * (.04 + .4 * Math.pow(r(), 1.3)); SP.push({ x0:r() * w, y0, sp:1.15 + .45 * r(), wa:(6 + 26 * r()) * s, wf:2 * Math.PI * (.5 + 1.4 * r()), wp:r() * 6.3, rad:(1 + 2.6 * r() * r()) * s * 3, fl:6 + 10 * r(), g:130 + 110 * r() }); }
    WS = []; for (let i = 0; i < 34; i++) WS.push({ x0:r() * w, y0:h + T * (.18 + .5 * r()), sp:1.05 + .28 * r(), wd:(80 + 140 * r()) * s, c:(r() * 5) | 0, fp:r() < .5 ? -1 : 1, wf:2 * Math.PI * (.6 + .8 * r()), wp:r() * 6.3, a:.4 + .4 * r() });
    SM = []; for (let i = 0; i < 26; i++) SM.push({ x0:r() * w, y0:h + T * (.7 + .3 * r()), sp:.86 + .1 * r(), rad:(90 + 120 * r()) * s, dx:(r() - .5) * 120 * s });
  }
  function makeBody(){                                // the photograph of fire across the width: cross-faded copies from different parts of it, faded top and bottom
    const fire = C._fire; if (!fire || BODY) return;
    const { w, T, k } = C, ph = T * .52, iw = fire.width, ih = fire.height, n = Math.max(1, Math.ceil(w / (ph * iw / ih * .65))), cw = w / n, tw = cw * 1.35;
    const t = mk(w * k, ph * k), q = t.getContext('2d'); q.scale(k, k);
    for (let i = 0; i < n; i++){
      const c = mk(tw * k, ph * k), cx = c.getContext('2d'), sx = (i % 3) * iw * .12, kk = (tw - cw) / tw; cx.scale(k, k);
      cx.drawImage(fire, sx, 0, iw * .76, ih, 0, 0, tw, ph);
      const e = cx.createLinearGradient(0, 0, tw, 0);
      e.addColorStop(0, i ? 'rgba(0,0,0,0)' : '#000'); e.addColorStop(kk, '#000'); e.addColorStop(1 - kk, '#000'); e.addColorStop(1, i < n - 1 ? 'rgba(0,0,0,0)' : '#000');
      cx.globalCompositeOperation = 'destination-in'; cx.fillStyle = e; cx.fillRect(0, 0, tw, ph);
      q.drawImage(c, i * cw - (tw - cw) / 2, 0, tw, ph);
    }
    const fd = q.createLinearGradient(0, 0, 0, ph); fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(.2, '#000'); fd.addColorStop(.8, '#000'); fd.addColorStop(1, 'rgba(0,0,0,0)');
    q.globalCompositeOperation = 'destination-in'; q.fillStyle = fd; q.fillRect(0, 0, w, ph);
    BODY = t;
  }
  function tongues(by, tw, al, hk, tau, seed, S){     // a row of flames standing on y = by, each swaying in slices, the tips most
    const iw = FL.width, ih = FL.height, th = tw * ih / iw, r = rnd(seed), k = C.k, off = r() * tw * .5;
    X.globalAlpha = al;
    for (let c = 0, cx = -off; cx < C.w + tw * .5; c++, cx += tw * .45){
      const f1 = 7 + 4 * r(), ph = r() * 6.3, hh = th * hk * (.72 + .32 * r()) * (1 + .1 * Math.sin(tau * f1 + ph) + .05 * Math.sin(tau * 15.3 + c)), fp = c % 2 ? -1 : 1;
      for (let j = 0; j < S; j++){
        const sw = Math.sin(tau * 8.5 + j * .8 + ph) * tw * .024 * Math.pow(1 - j / S, 1.4);
        X.setTransform(k * fp, 0, 0, k, k * (cx + sw), 0);
        X.drawImage(FL, 0, j * ih / S, iw, ih / S, -tw / 2, by - hh + j * hh / S, tw, hh / S + .8);
      }
    }
  }
  function drawFire(e, tau){
    const { w, h, T, k, s } = C, D = h + T, top = h - D * e;
    X.globalCompositeOperation = 'source-over';
    const fade = 1 - ss(.72, 1, e);
    X.setTransform(k, 0, 0, k, 0, 0);
    for (const p of SM){                                 // smoke left behind, spreading and thinning
      const y = p.y0 - p.sp * D * e, rr = p.rad * (1 + .6 * e); if (y < -rr || y > h + rr) continue;
      X.globalAlpha = .9 * fade; X.drawImage(SMK, p.x0 + p.dx * e - rr, y - rr, rr * 2, rr * 2);
    }
    X.globalAlpha = 1; X.setTransform(k, 0, 0, k, 0, k * top); X.fillStyle = GL; X.fillRect(0, 0, w, T);        // the glow
    if (!BODY) makeBody();
    if (BODY){                                           // the body of the fire: its rows sway, the sway running upward, and it breathes
      const ph = T * .52, n = 32, by = top + T * .2, st = 1 + .035 * Math.sin(tau * 3.1) + .02 * Math.sin(tau * 7.7);
      X.globalAlpha = .92;
      for (let j = 0; j < n; j++){
        const yy = j * ph / n, dx = (Math.sin(yy * .012 - tau * 5.2) + .5 * Math.sin(yy * .027 - tau * 8.3 + 1)) * 5 * s;
        X.setTransform(k, 0, 0, k, k * dx, k * (by + yy * st + ph * (1 - st)));
        X.drawImage(BODY, 0, j * BODY.height / n, BODY.width, BODY.height / n, 0, 0, w, ph / n * st + .8);
      }
    }
    if (FL){
      const iw = FL.width, ih = FL.height, tw = Math.min(w * .55, T * .27 * iw / ih);
      tongues(top + T * .47, tw * .8, .42, .8, tau, C.seed * 3 + 5, 8);              // flames flickering inside it
      tongues(top + T * .64, tw * .7, .34, .7, tau * 1.13, C.seed * 3 + 9, 8);
      /* and the tall ones on its leading edge */
      tongues(top + T * .27 + tw * ih / iw * .06, tw, 1, 1, tau, C.seed * 3 + 1, 10);
      X.globalCompositeOperation = 'lighter';           // loose flames flying up ahead of it, growing and fading
      for (const f of WS){
        const y = f.y0 - f.sp * D * e, d = y - top, a = f.a * ss(-h * .22, 0, d) * (.75 + .25 * Math.sin(tau * 9 + f.wp)); if (a < .02) continue;
        const sp = WSP[f.c], wd = f.wd * (1 + .5 * ss(0, -h * .2, d)), hh = wd * sp.height / sp.width * (.85 + .15 * Math.sin(tau * 7 + f.wp)), x = f.x0 + Math.sin(f.wf * tau + f.wp) * 14 * s;
        X.globalAlpha = a; X.setTransform(k * f.fp, 0, 0, k, k * x, 0);
        X.drawImage(sp, -wd / 2, y - hh, wd, hh);
      }
    }
    X.globalCompositeOperation = 'lighter'; X.setTransform(k, 0, 0, k, 0, 0);
    for (const p of SP){                                // sparks, weaving, flickering, flying on ahead
      const y = p.y0 - p.sp * D * e; if (y < -10 || y > h + 10) continue;
      const a = (.55 + .45 * Math.sin(tau * p.fl + p.wp)) * (1 - ss(.85, 1, e)), rr = p.rad * (1 - .4 * e);
      X.globalAlpha = Math.max(0, a); X.drawImage(SPK, p.x0 + p.wa * Math.sin(p.wf * tau + p.wp) - rr, y - rr, rr * 2, rr * 2);
    }
    X.globalCompositeOperation = 'source-over';
  }
  function frame(){
    if (stopped) return;
    const t = now() - start, p = Math.min(1, Math.max(0, t / C.ms)), e = ease(p);
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.clearRect(0, 0, cv.width, cv.height);
    if (p < 1){ if (C.evil) drawFire(e, t / 1000); else drawAero(e, t / 1000); next(frame); }
  }
  return {
    init(canvas, cfg){ cv = canvas; C = cfg; X = cv.getContext('2d'); ease = bez.apply(null, cfg.ease); if (cfg.evil) initFire(); else initAero(); },
    image(n, im){ if (!C) return; if (n === 'ar-flames'){ FL = soften(im); WSP = wisps(FL); } if (n === 'ar-fire'){ C._fire = im; } },
    go(epoch){ if (going || !C) return; going = true; start = epoch; frame(); },
    stop(){ stopped = true; }
  };
}
/* the worker that runs it: made from that same function's source, so there is no second copy to keep in step */
let AE_URL = null;
const AE_OFF = (() => { try { return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && !!HTMLCanvasElement.prototype.transferControlToOffscreen; } catch { return false; } })();
const aeWorkerUrl = () => AE_URL || (AE_URL = URL.createObjectURL(new Blob(['"use strict";const E=(' + aeWallEngine.toString() + ')(self);' +
  'self.onmessage=e=>{const d=e.data;if(d.init)E.init(d.canvas,d.cfg);' +
  'if(d.pics)Object.keys(d.pics).forEach(n=>fetch(d.pics[n]).then(r=>r.blob()).then(b=>createImageBitmap(b)).then(b=>E.image(n,b)).catch(()=>{}));' +
  'if(d.go)E.go(d.go);if(d.stop){E.stop();close();}};'], { type:'text/javascript' })));
/* the wall's measurements: T its thickness (more than the screen is tall), the mask's edge (a fraction of the way down
   the wall) and how soft it is, s a size for bubbles and sparks */
const aeGeo = evil => { const w = innerWidth, h = innerHeight;
  return { w, h, T:Math.round(h * (evil ? 1.25 : 1.4)), s:Math.max(.6, Math.min(1.4, Math.min(w, h) / 800)),
           edge:evil ? .5 : .47, soft:Math.round(h * (evil ? .2 : .32)), ms:evil ? 1000 : 950 }; };
const AE_EASE = [.45, .05, .35, 1];
/* put the wall up (still empty: it is drawn once it is told when it started); vt: it is named, so a view transition draws it over both pages */
function aeSweepLayer(seed, vt){
  const evil = dark(), g = aeGeo(evil), k = Math.min(devicePixelRatio || 1, evil ? .75 : 1.25);
  const L = layer('ae-sweep'); if (vt) L.style.viewTransitionName = 'ae-sweep';
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(g.w * k)); c.height = Math.max(2, Math.round(g.h * k)); L.appendChild(c);
  const cfg = { w:g.w, h:g.h, T:g.T, s:g.s, k, evil, seed, ms:g.ms, ease:AE_EASE }, pics = evil ? ['ar-fire', 'ar-flames'] : [];
  let eng = null, wk = null;
  if (AE_OFF) try {
    wk = new Worker(aeWorkerUrl()); const off = c.transferControlToOffscreen();
    wk.postMessage({ init:1, canvas:off, cfg }, [off]);
    if (pics.length){ const P = {}; pics.forEach(n => { P[n] = new URL('/images/th/' + n + '.webp' + (V ? '?v=' + V : ''), location.href).href; }); wk.postMessage({ pics:P }); }
    eng = { go:ep => wk.postMessage({ go:ep }), stop:() => { try { wk.postMessage({ stop:1 }); } catch {} setTimeout(() => { try { wk.terminate(); } catch {} }, 100); } };
  } catch { eng = null; if (wk) try { wk.terminate(); } catch {} }
  if (!eng){                                          // no worker to hand it to: the page draws it
    const E = aeWallEngine(window); E.init(c, cfg);
    pics.forEach(n => { const i = aePic(n); if (aeOk(i)) E.image(n, i); else i.addEventListener('load', () => E.image(n, i), { once:true }); });
    eng = { go:E.go, stop:E.stop };
  }
  Object.assign(L, { g, eng });
  return L;
}
/* run it: the next page (target: the body, or the view transition's new page) shows through a soft-edged mask that rises
   on the wall's curve; the wall is told the moment it started, and keeps to the same clock */
const AE_MASK = (() => { try { return CSS.supports('mask-image', 'linear-gradient(#000,#000)') ? 'mask' : 'webkitMask'; } catch { return 'mask'; } })();
function aeSweepRun(L, target, pseudo, done){
  const { g } = L, o = { duration:g.ms, easing:'cubic-bezier(' + AE_EASE.join(',') + ')', fill:'both' };
  let z = 1; if (!pseudo) try { z = parseFloat(getComputedStyle(target).zoom) || 1; } catch {}
  const q = v => (v / z).toFixed(1) + 'px';
  const img = 'linear-gradient(to bottom,transparent 0,transparent ' + q(2 * g.h - g.soft / 2) + ',#000 ' + q(2 * g.h + g.soft / 2) + ',#000 100%)';
  const mk = y => ({ [AE_MASK + 'Image']:img, [AE_MASK + 'Size']:'100% ' + q(4 * g.h), [AE_MASK + 'Repeat']:'no-repeat', [AE_MASK + 'Position']:'0 ' + q(y - 2 * g.h) });
  let A;
  try { A = target.animate([mk(g.h + g.edge * g.T), mk(-g.T + g.edge * g.T)], pseudo ? Object.assign({ pseudoElement:pseudo }, o) : o); }
  catch { L.eng.stop(); if (done) done(); return null; }
  const st = document.timeline && document.timeline.currentTime;
  if (st != null) try { A.startTime = st; } catch {}
  L.eng.go((performance.timeOrigin || (Date.now() - performance.now())) + (st != null ? +st : performance.now()));
  A.finished.then(() => { if (!pseudo) A.cancel(); L.eng.stop(); if (done) done(); }, () => { L.eng.stop(); if (done) done(); });
  return A;
}
TR.aero = {
  outMs:140, inMs:1000,
  pics(){ if (dark()){ aePic('ar-fire'); aePic('ar-flames'); } },
  out(n, done){ if (vtArmed()){ n.vt = 1; done(); return; } this.pics(); root.classList.add('fx-out'); after(130, done); },
  cover(n){ this.pics(); this.L = aeSweepLayer(n.seed || 7, false); },
  in(n, done){ const L = this.L || aeSweepLayer(n.seed || 7, false); if (!aeSweepRun(L, document.body, null, done)) done(); }
};
if (skin() === 'aero') TR.aero.pics();

/* Gen X Soft Club */
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
/* The page change: the whole frame, photograph and all, smears sideways into a washed-out blur, the way a long exposure
   smears a train leaving, and the next page comes out of the same smear. (It was an SVG filter over the page, changed
   step by step on timers: the browser had to redraw the whole page through it each step, which stuttered, and it
   pulled the red apart from the blue.)
   With a view transition (Chromium, Safari 18.2+; theme.js opts in) the browser holds pictures of the page being left
   and of the next one, and scSmear works on those: the pair is squeezed sideways, blurred, and stretched back out, so
   the blur runs sideways only; it is washed out (brighter, paler, flatter); the old picture slides off to the left as
   the next one slides in from the right and settles. Only transforms, opacity and filters, which the browser animates
   by itself, so a page busy loading can't make it stutter. Without one, softclub.css washes the page and its
   photograph out as it is left and brings them back as the next one arrives. */
function scSmear(){
  const w = innerWidth, N = 24, P = [], O = [], NW = [];
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i <= N; i++){
    const t = i / N, s = Math.pow(Math.sin(Math.PI * t), 1.25), k = 1 + 5 * s, u = sm(.3, .7, t);
    P.push({ offset:t, transform:'scaleX(' + k.toFixed(4) + ')',
             filter:'blur(' + (4 * s).toFixed(2) + 'px) brightness(' + (1 + .42 * s).toFixed(3) + ') saturate(' + (1 - .5 * s).toFixed(3) + ') contrast(' + (1 - .2 * s).toFixed(3) + ')' });
    O.push({ offset:t, transform:'scaleX(' + (1 / k).toFixed(5) + ') translateX(' + (-w * .12 * Math.pow(sm(0, .7, t), 1.5)).toFixed(1) + 'px)', opacity:(1 - u).toFixed(3) });
    NW.push({ offset:t, transform:'scaleX(' + (1 / k).toFixed(5) + ') translateX(' + (w * .12 * Math.pow(1 - sm(.3, 1, t), 1.5)).toFixed(1) + 'px)', opacity:u.toFixed(3) });
  }
  const o = { duration:560, easing:'linear', fill:'both' }, el = document.documentElement;
  try {
    el.animate(P, Object.assign({ pseudoElement:'::view-transition-image-pair(root)' }, o));
    el.animate(O, Object.assign({ pseudoElement:'::view-transition-old(root)' }, o));
    el.animate(NW, Object.assign({ pseudoElement:'::view-transition-new(root)' }, o));
    return true;
  } catch { return false; }
}
TR.softclub = {
  outMs:240, inMs:520,
  out(n, done){ scPic(n.to); if (vtArmed()){ n.vt = 1; done(); return; } root.classList.add('fx-out'); after(230, done); },
  in(n, done){ after(520, done); }
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
  const fin = () => { root.classList.remove('fx-enter', 'fx-in'); root.querySelectorAll('.fx-layer').forEach(n => n.remove()); vpEnd(); };      /* vpEnd: never leave the page under Vaporwave's filter, whatever went wrong */
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
/* the view transition's way in (Y2K Futurism, Frutiger Aero, Gen X Soft Club): the wave goes up as the new page is first
   shown, starts with the browser's wipe, and comes down when it is done */
addEventListener('pagereveal', e => {
  const vt = e.viewTransition; if (!vt) return;
  if ((skin() !== 'y2k' && skin() !== 'aero' && skin() !== 'softclub') || !on()){ try { vt.skipTransition(); } catch {} return; }
  if (skin() === 'softclub'){                        /* Gen X Soft Club: both pages smear together */
    root.classList.add('sc-vt');
    vt.ready.then(() => { if (!scSmear()) try { vt.skipTransition(); } catch {} }, () => {});
    vt.finished.finally(() => root.classList.remove('sc-vt'));
    return;
  }
  if (skin() === 'aero'){                            /* Frutiger Aero: the wall rises over both pages; the next one is uncovered behind it */
    root.classList.add('ae-vt');
    const L = aeSweepLayer((nav && nav.seed) || (Date.now() % 100000) + 1, true);
    vt.ready.then(() => { if (!aeSweepRun(L, root, '::view-transition-new(root)')) try { vt.skipTransition(); } catch {} }, () => {});
    vt.finished.finally(() => { L.remove(); root.classList.remove('ae-vt'); });
    return;
  }
  const L = ykLayer(); L.classList.add('vt');
  vt.ready.then(() => L.classList.add('go'), () => L.remove());
  vt.finished.finally(() => L.remove());
});
})();
