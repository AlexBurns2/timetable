/* ═══════════════════════════════════════════════════════════════════
   Frutiger Eco's background in motion (fx.js loads this for that theme only).

   The picture itself is the stylesheet's (skins/eco.css): a sky, then four
   layers of cut-out photographs and drawings, set out differently on each
   page. This scene doesn't lay anything out of its own. It asks the
   stylesheet where every piece is (four invisible probes carrying the
   theme's --eco-far, --eco-mid, --eco-near and --eco-top, read back as
   pixels), draws the same picture onto its canvas, and brings a few things
   to life, slowly and only a little:
     · the clouds drift a short way and back over a couple of minutes;
     · the turbines' blades turn, slowly, each in its own tilted plane (the
       hub's nose, drawn over them, stays still);
     · the leaf sways on its stem, a degree or so;
     · now and then the light catches a drop of dew on the leaf.
   Everything that doesn't move is drawn once into two still layers. At the
   start every moving thing is where the stylesheet has it, so the canvas
   takes over from the still picture without a jump. Animation off: one
   still frame, the same as the stylesheet's. Nothing follows the pointer.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const root = document.documentElement;
const GROUPS = ['far', 'mid', 'near', 'top'];
const IMG = {};
let gen = 0;
const ok = i => !!(i && i.complete && i.naturalWidth > 0);
const pic = u => IMG[u] || (IMG[u] = (() => {
  const i = new Image(); i.decoding = 'async';
  i.onload = i.onerror = () => { gen++; if (FX.refresh) FX.refresh(); };
  i.src = u; return i;
})());
/* the rotor's plane: the photo's three blade tips (eco-turbine.webp, 520 × 792) put through the circle they turn on; the hub */
const HUB = [320, 310], A = [165, 244.22, -248, 235.56];       // [a b; c d]
const AD = A[0] * A[3] - A[1] * A[2], AI = [A[3] / AD, -A[1] / AD, -A[2] / AD, A[0] / AD];
/* the dew on the leaf (eco-leaf.webp is 820 × 499; eco-leaf-b is the same picture half turned, at 680 × 414): x, y, r */
const DEW = [[372, 232, 30], [300, 306, 18], [446, 172, 13], [246, 214, 11], [204, 338, 22], [404, 304, 9], [140, 354, 10], [334, 176, 7], [476, 240, 6.5], [270, 392, 8], [114, 300, 5.5], [180, 262, 6]];
const hash = (i, k) => { let h = (i * 374761393 + k * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/* a computed background-position or -size value, in px: 12px, 40%, calc(100% - 21.6px), left/right/center */
function len(t, free){
  if (!t) return 0;
  if (t === 'left' || t === 'top') return 0;
  if (t === 'right' || t === 'bottom') return free;
  if (t === 'center') return free / 2;
  if (t.startsWith('calc(')){
    let v = 0;
    for (const m of t.slice(5, -1).matchAll(/([+-])?\s*(-?[\d.]+(?:e-?\d+)?)(px|%)/g)){ const n = parseFloat(m[2]) * (m[3] === '%' ? free / 100 : 1); v += m[1] === '-' ? -n : n; }
    return v;
  }
  return t.endsWith('%') ? parseFloat(t) / 100 * free : parseFloat(t);
}
const words = s => s.match(/calc\([^)]*\)|[^\s]+/g) || [];
const listOf = s => s.split(/,\s*(?![^(]*\))/);

FX.scenes.eco = {
  dpr:1.5, maxPx:2.4e6, fps:30,
  create(canvas, env){
    const x = canvas.getContext('2d'); if (!x) return null;
    let e = env, W = canvas.width, H = canvas.height, S = 1, items = [], built = -1, dirty = true;
    const t0 = FX.now();
    /* the probes: invisible boxes the size of the window carrying the theme's layers, so the browser works out where everything goes */
    const probes = {};
    for (const g of GROUPS){
      const d = document.createElement('div'); d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-9;contain:strict';
      d.style.background = 'var(--eco-' + g + ')';
      (document.body || root).appendChild(d); probes[g] = d;
    }
    const layers = () => {
      const out = [];
      for (const g of GROUPS){
        const cs = getComputedStyle(probes[g]), bw = probes[g].clientWidth || innerWidth, bh = probes[g].clientHeight || innerHeight;
        const urls = [...cs.backgroundImage.matchAll(/url\("([^"]*)"\)|\bnone\b/g)].map(m => m[1] || '');
        const pos = listOf(cs.backgroundPosition), size = listOf(cs.backgroundSize), L = [];
        urls.forEach((u, i) => { if (u) L.push({ g, u, pos:words(pos[i % pos.length]), size:words(size[i % size.length]), bw, bh }); });
        out.push(...L.reverse());                                   // a background list is front first: drawn back to front
      }
      return out;
    };
    const box = (l, im) => {
      const iw = im.naturalWidth || 1, ih = im.naturalHeight || 1, s = l.size;
      let w = (!s[0] || s[0] === 'auto') ? null : len(s[0], l.bw), h = (!s[1] || s[1] === 'auto') ? null : len(s[1], l.bh);
      if (w == null && h == null){ w = iw; h = ih; } else if (w == null) w = h * iw / ih; else if (h == null) h = w * ih / iw;
      return { x:len(l.pos[0], l.bw - w), y:len(l.pos[1] || 'center', l.bh - h), w, h };
    };
    const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S)); return c; };
    /* a moving piece drawn once at its size (and, at night, already dimmed) */
    const sprite = (im, b, dim) => { const c = canvasOf(b.w, b.h), q = c.getContext('2d'); if (dim) q.filter = dim; q.drawImage(im, 0, 0, c.width, c.height); return c; };
    const build = () => {
      items = []; built = gen; dirty = false;
      if (e.page === 'hkmahjong') return;
      const dimV = (getComputedStyle(root).getPropertyValue('--eco-dim') || '').trim(), dim = dimV && dimV !== 'none' ? dimV : '';
      let run = null, rq = null, waiting = false, nT = 0, nL = 0, nC = 0;
      const flush = () => { if (run){ items.push({ k:'run', c:run }); run = rq = null; } };
      const still = () => { if (!run){ run = canvasOf(W / S, H / S); rq = run.getContext('2d'); rq.setTransform(S, 0, 0, S, 0, 0); } return rq; };
      for (const l of layers()){
        const im = pic(l.u); if (!ok(im)){ if (!im.complete) waiting = true; continue; }
        const b = box(l, im), f = l.g === 'far' ? '' : dim;
        if (/eco-clouds|ar-clouds/.test(l.u)){ flush(); items.push({ k:'cloud', b, c:sprite(im, b, f), i:nC++ }); continue; }
        if (/eco-turbine\.webp/.test(l.u)){
          const part = n => pic(l.u.replace('eco-turbine.webp', 'eco-turbine-' + n + '.webp')), tw = part('tower'), rt = part('rotor'), ns = part('nose');
          if (ok(tw) && ok(rt) && ok(ns)){ flush(); items.push({ k:'turbine', b, tower:sprite(tw, b, f), rotor:sprite(rt, b, f), nose:sprite(ns, b, f), i:nT++ }); continue; }
          if (!tw.complete || !rt.complete || !ns.complete) waiting = true;
        }
        const lm = l.u.match(/eco-leaf(-b)?\.webp/);
        if (lm){ flush(); items.push({ k:'leaf', b, c:sprite(im, b, f), flip:!!lm[1], i:nL++, dark:!!dim }); continue; }
        const q = still(); q.filter = f || 'none'; q.drawImage(im, b.x, b.y, b.w, b.h); q.filter = 'none';
      }
      flush();
      if (!waiting) root.classList.add('eco-drawn');
    };
    /* the light catching a drop: a soft glow and a four-pointed glint at the drop's highlight */
    const glint = (gx, gy, r, a) => {
      x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = a;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r * 2.2); g.addColorStop(0, 'rgba(255,255,240,.9)'); g.addColorStop(.25, 'rgba(255,255,230,.35)'); g.addColorStop(1, 'rgba(255,255,220,0)');
      x.fillStyle = g; x.fillRect(gx - r * 2.2, gy - r * 2.2, r * 4.4, r * 4.4);
      x.fillStyle = 'rgba(255,255,255,.95)';
      for (const [dx, dy] of [[1, 0], [0, 1]]){ x.beginPath(); x.moveTo(gx - dx * r * 2.6, gy - dy * r * 2.6); x.lineTo(gx + dy * r * .16, gy + dx * r * .16); x.lineTo(gx + dx * r * 2.6, gy + dy * r * 2.6); x.lineTo(gx - dy * r * .16, gy - dx * r * .16); x.closePath(); x.fill(); }
      x.restore();
    };
    const draw = t => {
      if (dirty || built !== gen) build();
      const tau = Math.max(0, t - t0);
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
      x.setTransform(S, 0, 0, S, 0, 0);
      const leaves = [];
      for (const it of items){
        const b = it.b;
        if (it.k === 'run'){ x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(it.c, 0, 0); x.setTransform(S, 0, 0, S, 0, 0); }
        else if (it.k === 'cloud'){
          /* a short way and back over a couple of minutes, each bank at its own pace and the other way to the last */
          const amp = Math.max(14, Math.min(40, b.w * .04)), dx = Math.sin(tau * 2 * Math.PI / (130 + 40 * it.i)) * amp * (it.i % 2 ? -1 : 1);
          x.drawImage(it.c, b.x + dx, b.y, b.w, b.h);
        } else if (it.k === 'turbine'){
          x.drawImage(it.tower, b.x, b.y, b.w, b.h);
          /* the rotor turns in its own plane: M = A · R(θ) · A⁻¹ about the hub (A's scale cancels out, so the photo's own px do) */
          const th = -tau * 2 * Math.PI / (11 + 3 * it.i), c = Math.cos(th), s = Math.sin(th), k = b.w / 520;
          const R = [A[0] * c + A[1] * s, -A[0] * s + A[1] * c, A[2] * c + A[3] * s, -A[2] * s + A[3] * c];
          const M = [R[0] * AI[0] + R[1] * AI[2], R[0] * AI[1] + R[1] * AI[3], R[2] * AI[0] + R[3] * AI[2], R[2] * AI[1] + R[3] * AI[3]];
          x.save(); x.translate(b.x + HUB[0] * k, b.y + HUB[1] * k); x.transform(M[0], M[2], M[1], M[3], 0, 0);
          x.drawImage(it.rotor, -HUB[0] * k, -HUB[1] * k, b.w, b.h); x.restore();
          x.drawImage(it.nose, b.x, b.y, b.w, b.h);                   // the hub's nose doesn't turn: it stays facing the way it faces
        } else if (it.k === 'leaf'){
          /* swaying on its stem: a degree and a half either way, about where the stem leaves the picture */
          const a = Math.sin(tau * 2 * Math.PI / (it.flip ? 10.5 : 8.5)) * .026 * (it.flip ? -1 : 1);
          const px = b.x + b.w * (it.flip ? .188 : .811), py = b.y + (it.flip ? b.h : 0);
          x.save(); x.translate(px, py); x.rotate(a); x.translate(-px, -py); x.drawImage(it.c, b.x, b.y, b.w, b.h); x.restore();
          leaves.push({ it, a, px, py });
        }
      }
      /* the dew: every three seconds or so the light catches one drop on one of the leaves, for a second and a half */
      if (leaves.length){
        const slot = Math.floor(tau / 3.1), p = (tau - slot * 3.1 - .4) / 1.6;
        if (slot > 0 && p > 0 && p < 1){
          const L = leaves[Math.floor(hash(slot, 1) * leaves.length)], it = L.it, d = DEW[Math.floor(hash(slot, 2) * DEW.length)];
          const sx = it.b.w / 820, sy = it.b.h / 499, dx = it.flip ? 820 - d[0] : d[0], dy = it.flip ? 499 - d[1] : d[1];
          const hx = (dx - d[2] * .36) * sx, hy = (dy - d[2] * .36) * sy;
          let gx = it.b.x + hx, gy = it.b.y + hy;
          const cs = Math.cos(L.a), sn = Math.sin(L.a), rx = gx - L.px, ry = gy - L.py;
          gx = L.px + rx * cs - ry * sn; gy = L.py + rx * sn + ry * cs;
          glint(gx, gy, Math.max(2.5, d[2] * sx * .5), Math.pow(Math.sin(Math.PI * p), 2) * (it.dark ? .5 : .9));
        }
      }
    };
    return {
      frame(t){ draw(t); },
      resize(w, h, sc){ W = w; H = h; S = sc || 1; dirty = true; },
      env(n){ if (n.dark !== e.dark || n.page !== e.page) dirty = true; e = n; },
      dispose(){ for (const g of GROUPS) probes[g].remove(); root.classList.remove('eco-drawn'); }
    };
  }
};
})();
