/* ═══════════════════════════════════════════════════════════════════
   Frutiger Aero's background (fx.js loads this for that theme only).

   The archetypal Frutiger Aero picture, put together in the browser
   from cut-out photographs (images/th/ar-*.webp, credited in About):
   a deep blue sky with gulls and clouds on the horizon, a glass globe
   with the world map in it, a clear water splash along the waterline,
   a monitor standing in the sea with a butterflyfish bursting out of
   its screen, another under the water, a starfish on the sand, and
   bubbles. Built here rather than baked into one picture so it can be
   laid out for any screen (a phone gets its own arrangement) and so a
   few things can move, slowly: the globe turns, the bubbles rise, the
   gulls and the lower fish drift a little. Nothing follows the pointer.

   Dark mode is FRUTIGER EVIL, the meme: the same picture gone wrong.
   A murky brown sky with bats, a pink globe, red water, the monitor's
   black screen on fire with a fish skeleton bursting out of it,
   another skeleton and dead fish in the water, a skull on the bottom.
   Cut out a bit roughly, which is the joke.

   The still layers (sky, sea, splash, monitor) are drawn once into two
   canvases and copied each frame; only the globe, the bubbles and a
   handful of cut-outs are drawn every frame.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const V = FX.V ? '?v=' + FX.V : '';
const IM = {};
let gen = 0;                                          // goes up as each picture arrives: the still layers are drawn again then
const pic = n => IM[n] || (IM[n] = (() => {
  const i = new Image(); i.decoding = 'async';
  i.onload = () => { gen++; if (FX.refresh) FX.refresh(); };
  i.src = '/images/th/' + n + '.webp' + V; return i;
})());
const ok = i => !!(i && i.complete && i.naturalWidth > 0);
const LIGHT = ['ar-clouds', 'ar-splash', 'ar-mon', 'ar-fish1', 'ar-fish2', 'ar-gull1', 'ar-gull2', 'ar-gull3', 'ar-star', 'ar-sand', 'ar-map'];
const EVIL = ['ar-sky-e', 'ar-water-e', 'ar-splash-e', 'ar-mon-e', 'ar-flame', 'evil-bone', 'ar-fish-e', 'ar-skull', 'evil-bat1', 'evil-bat2', 'evil-bat3', 'ar-map', 'ar-fire', 'ar-flames'];
FX.aePics = evil => (evil ? EVIL : LIGHT).map(pic);   // also used by the page change (fx.js TR.aero), which wants the fire ready

/* the bubbles are fx.js's (FX.aeBubble), shared with the page change */

/* the bats get their cheap red glow once, not every frame */
const GLOW = {};
function glowed(im){
  if (GLOW[im.src]) return GLOW[im.src];
  const p = 24, c = document.createElement('canvas'); c.width = im.naturalWidth + p * 2; c.height = im.naturalHeight + p * 2;
  const x = c.getContext('2d'); x.shadowColor = 'rgba(255,40,10,.95)'; x.shadowBlur = 18; x.drawImage(im, p, p);
  return (GLOW[im.src] = c);
}

/* ── the globe: the world map (images/th/ar-map.webp, land white) laid on a sphere, turning slowly ── */
function Globe(D){
  const c = document.createElement('canvas'); c.width = c.height = D;
  const x = c.getContext('2d'), id = x.createImageData(D, D), px = id.data;
  const R = D / 2 - 1, tilt = .4, ct = Math.cos(tilt), st = Math.sin(tilt);
  let n = 0; for (let j = 0; j < D; j++) for (let i = 0; i < D; i++){ const a = (i + .5 - D / 2) / R, b = (j + .5 - D / 2) / R; if (a * a + b * b < 1.0001 + 2 / R) n++; }
  const at = new Uint32Array(n), U = new Float32Array(n), Vv = new Float32Array(n), LT = new Float32Array(n), RM = new Float32Array(n), ED = new Float32Array(n);
  let k = 0;
  for (let j = 0; j < D; j++) for (let i = 0; i < D; i++){
    const a = (i + .5 - D / 2) / R, b = (j + .5 - D / 2) / R, d2 = a * a + b * b;
    if (d2 >= 1.0001 + 2 / R) continue;
    const dd = Math.min(1, Math.sqrt(d2)), z = Math.sqrt(Math.max(0, 1 - dd * dd)), Y = -b;
    const sy = Y * ct + z * st, sz = z * ct - Y * st;
    at[k] = (j * D + i) * 4;
    U[k] = Math.atan2(a, sz) / (2 * Math.PI) + .5;
    Vv[k] = .5 - Math.asin(Math.max(-1, Math.min(1, sy))) / Math.PI;
    LT[k] = Math.max(0, -a * .42 + Y * .5 + z * .76);
    RM[k] = Math.pow(1 - z, 2.4);
    ED[k] = Math.max(0, Math.min(1, (1 - Math.sqrt(d2)) * R + .5));
    k++;
  }
  let mask = null, MW = 0, MH = 0;
  const loadMask = im => {
    if (mask || !ok(im)) return;
    MW = im.naturalWidth; MH = im.naturalHeight;
    const t = document.createElement('canvas'); t.width = MW; t.height = MH; const tx = t.getContext('2d'); tx.drawImage(im, 0, 0);
    const d = tx.getImageData(0, 0, MW, MH).data; mask = new Uint8Array(MW * MH);
    for (let q = 0; q < MW * MH; q++) mask[q] = d[q * 4];
  };
  const PAL = {
    light:{ sea:[200, 236, 255], seaA:.34, land:[24, 104, 228], landA:.96, rim:[225, 246, 255], rimA:.95, amb:.5, dif:.75 },
    evil: { sea:[246, 206, 198], seaA:.95, land:[118, 44, 34], landA:.98, rim:[90, 26, 20], rimA:.55, amb:.62, dif:.5 }
  };
  return {
    canvas:c,
    draw(rot, evil, mapImg){
      loadMask(mapImg);
      const P = PAL[evil ? 'evil' : 'light'];
      for (let q = 0; q < n; q++){
        let L = 0;
        if (mask){ let u = U[q] + rot; u -= Math.floor(u); const col = (u * MW) | 0, row = Math.min(MH - 1, (Vv[q] * MH) | 0); L = mask[row * MW + col] / 255; }
        const lit = P.amb + P.dif * LT[q], rm = RM[q];
        let r = (P.sea[0] + (P.land[0] - P.sea[0]) * L) * lit, g = (P.sea[1] + (P.land[1] - P.sea[1]) * L) * lit, b = (P.sea[2] + (P.land[2] - P.sea[2]) * L) * lit;
        let al = P.seaA + (P.landA - P.seaA) * L;
        r += (P.rim[0] - r) * rm * P.rimA; g += (P.rim[1] - g) * rm * P.rimA; b += (P.rim[2] - b) * rm * P.rimA;
        if (!evil) al = Math.max(al, rm * P.rimA);
        const o = at[q]; px[o] = r > 255 ? 255 : r; px[o + 1] = g > 255 ? 255 : g; px[o + 2] = b > 255 ? 255 : b; px[o + 3] = al * ED[q] * 255;
      }
      x.putImageData(id, 0, 0);
      return c;
    }
  };
}

/* ── where everything goes: a landscape screen gets the picture as it was; a tall one (a phone) its own arrangement ── */
function layout(w, h){
  const port = w / h < .9;
  if (!port){
    const s = Math.min(w / 1600, h / 1000), Y0 = h * .6;
    return { port, s, Y0,
      globe:{ x:w * .8, y:h * .45, r:235 * s },
      mon:{ x:w * .585, y:h * .345, h:580 * s },
      fish1:{ x:w * .468, y:h * .545, w:310 * s, rot:-.06 },
      fish2:{ x:w * .3, y:h * .86, w:280 * s, rot:.05 },
      fish3:{ x:w * .9, y:h * .745, w:110 * s, rot:.08 },
      star:{ x:w * .15, y:h * .935, w:210 * s, rot:-.3 },
      skull:{ x:w * .87, y:h * .87, w:230 * s },
      bone2:{ x:w * .27, y:h * .86, w:300 * s },
      dead:[{ x:w * .37, y:h * .74, w:80 * s }, { x:w * .73, y:h * .81, w:70 * s, flip:1 }],
      splash:{ x:-w * .04, w:w * 1.08, minH:h * .2 },
      clouds:{ x:-w * .07, w:Math.max(w * .6, 760 * s) },
      flyers:[{ i:0, x:w * .545, y:h * .175, w:200 * s, flip:1 }, { i:2, x:w * .345, y:h * .37, w:270 * s }, { i:1, x:w * .455, y:h * .14, w:95 * s }, { i:1, x:w * .27, y:h * .045, w:62 * s }],
      bubbles:[[w * .415, h * .27, 98 * s], [w * .865, h * .155, 52 * s], [w * .755, h * .235, 30 * s], [w * .718, h * .272, 11 * s], [w * .62, h * .06, 17 * s],
               [w * .335, h * .4, 34 * s], [w * .27, h * .935, 62 * s], [w * .41, h * .79, 30 * s], [w * .035, h * .83, 36 * s], [w * .965, h * .62, 22 * s]]
    };
  }
  const s = Math.min(w / 900, h / 1500), Y0 = h * .54;
  return { port, s, Y0,
    globe:{ x:w * .74, y:h * .3, r:300 * s },
    mon:{ x:w * .61, y:h * .335, h:520 * s },
    fish1:{ x:w * .31, y:h * .5, w:310 * s, rot:-.06 },
    fish2:{ x:w * .32, y:h * .8, w:330 * s, rot:.05 },
    fish3:{ x:w * .86, y:h * .69, w:130 * s, rot:.08 },
    star:{ x:w * .8, y:h * .94, w:240 * s, rot:-.3 },
    skull:{ x:w * .8, y:h * .9, w:250 * s },
    bone2:{ x:w * .32, y:h * .82, w:330 * s },
    dead:[{ x:w * .22, y:h * .66, w:100 * s }, { x:w * .78, y:h * .74, w:90 * s, flip:1 }],
    splash:{ x:-w * .35, w:w * 1.7, minH:h * .14 },
    clouds:{ x:-w * .3, w:w * 1.1 },
    flyers:[{ i:0, x:w * .3, y:h * .14, w:230 * s, flip:1 }, { i:2, x:w * .24, y:h * .275, w:290 * s }, { i:1, x:w * .62, y:h * .07, w:110 * s }],
    bubbles:[[w * .16, h * .2, 90 * s], [w * .9, h * .1, 50 * s], [w * .55, h * .2, 30 * s], [w * .12, h * .46, 40 * s], [w * .2, h * .92, 70 * s], [w * .62, h * .86, 34 * s]]
  };
}
const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
const sprite = (x, im, cx, cy, w, rot, flip, alpha) => {
  if (!ok(im)) return;
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, h = w * ih / iw;
  x.save(); x.translate(cx, cy); if (rot) x.rotate(rot); if (flip) x.scale(-1, 1); if (alpha != null) x.globalAlpha = alpha;
  x.drawImage(im, -w / 2, -h / 2, w, h); x.restore();
};
const coverImg = (x, im, X, Y, W, H, fx, fy) => {
  if (!ok(im)) return;
  const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
  x.drawImage(im, X + (W - w) * (fx == null ? .5 : fx), Y + (H - h) * (fy == null ? .5 : fy), w, h);
};

/* ── the still layers ── */
function drawBack(x, w, h, L, evil){
  const Y0 = L.Y0;
  if (!evil){
    const g = x.createLinearGradient(0, 0, 0, Y0);
    g.addColorStop(0, '#08378f'); g.addColorStop(.4, '#1269c4'); g.addColorStop(.78, '#36a8e8'); g.addColorStop(1, '#a9e6fc');
    x.fillStyle = g; x.fillRect(0, 0, w, Y0 + 2);
    const sun = x.createRadialGradient(w * .32, Y0, 0, w * .32, Y0, Math.max(w, h) * .45);
    sun.addColorStop(0, 'rgba(235,252,255,.55)'); sun.addColorStop(1, 'rgba(235,252,255,0)'); x.fillStyle = sun; x.fillRect(0, 0, w, Y0 + 2);
    const cl = IM['ar-clouds'];
    if (ok(cl)){
      const cw = L.clouds.w, ch = cw * cl.naturalHeight / cl.naturalWidth;
      x.globalAlpha = .55; x.save(); x.translate(w * .62 + cw * .5, 0); x.scale(-1, 1); x.drawImage(cl, -cw * .4, Y0 - ch * .78, cw * .8, ch * .8); x.restore();
      x.globalAlpha = .96; x.drawImage(cl, L.clouds.x, Y0 - ch * .9, cw, ch); x.globalAlpha = 1;
    }
    /* under the water: bright at the top, sand at the bottom, a few rays of light */
    const u = x.createLinearGradient(0, Y0, 0, h);
    u.addColorStop(0, '#86e0f4'); u.addColorStop(.3, '#3db4de'); u.addColorStop(.62, '#4cbfdc'); u.addColorStop(1, '#8ccfd2');
    x.fillStyle = u; x.fillRect(0, Y0, w, h - Y0);
    const sd = IM['ar-sand'], ys = Y0 + (h - Y0) * .5;
    if (ok(sd)){
      const sh = (h - ys) * 1.15, sw = sh * sd.naturalWidth / sd.naturalHeight;
      for (let X = 0, k = 0; X < w; X += sw, k++){ x.save(); x.translate(X + (k % 2 ? sw : 0), ys); x.scale(k % 2 ? -1 : 1, 1); x.drawImage(sd, 0, 0, sw, sh); x.restore(); }      // mirrored every other time, so no seams
      const f = x.createLinearGradient(0, ys, 0, ys + (h - ys) * .55);
      f.addColorStop(0, 'rgba(76,191,220,1)'); f.addColorStop(1, 'rgba(76,191,220,0)'); x.fillStyle = f; x.fillRect(0, ys, w, (h - ys) * .55);
    }
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++){
      const bx = w * (.1 + .2 * i + .05 * hash(i, 3)), bw = w * (.03 + .04 * hash(i, 4));
      const rg = x.createLinearGradient(0, Y0, 0, h); rg.addColorStop(0, 'rgba(255,255,255,.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.beginPath(); x.moveTo(bx, Y0); x.lineTo(bx + bw, Y0); x.lineTo(bx + bw * 3 + w * .08, h); x.lineTo(bx + w * .08, h); x.fill();
    }
    x.restore();
    const lip = x.createLinearGradient(0, Y0 - 5, 0, Y0 + 8);
    lip.addColorStop(0, 'rgba(255,255,255,0)'); lip.addColorStop(.4, 'rgba(255,255,255,.9)'); lip.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = lip; x.fillRect(0, Y0 - 5, w, 13);
  } else {
    x.fillStyle = '#2a2117'; x.fillRect(0, 0, w, Y0 + 2);
    coverImg(x, IM['ar-sky-e'], 0, 0, w, Y0 + 2, .5, .7);
    const haze = x.createLinearGradient(0, Y0 * .45, 0, Y0); haze.addColorStop(0, 'rgba(214,196,160,0)'); haze.addColorStop(1, 'rgba(226,208,170,.55)');
    x.fillStyle = haze; x.fillRect(0, Y0 * .45, w, Y0 * .55 + 2);
    x.fillStyle = '#4a0606'; x.fillRect(0, Y0, w, h - Y0);
    coverImg(x, IM['ar-water-e'], 0, Y0, w, h - Y0, .5, .3);
    const dk = x.createLinearGradient(0, Y0, 0, h); dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(.55, 'rgba(20,0,0,.25)'); dk.addColorStop(1, 'rgba(8,0,0,.82)');
    x.fillStyle = dk; x.fillRect(0, Y0, w, h - Y0);
    const lip = x.createLinearGradient(0, Y0 - 4, 0, Y0 + 7);
    lip.addColorStop(0, 'rgba(255,90,70,0)'); lip.addColorStop(.45, 'rgba(255,110,80,.55)'); lip.addColorStop(1, 'rgba(255,90,70,0)'); x.fillStyle = lip; x.fillRect(0, Y0 - 4, w, 11);
  }
}
function drawFront(x, w, h, L, evil, page){
  const Y0 = L.Y0, sp = IM[evil ? 'ar-splash-e' : 'ar-splash'];
  if (ok(sp)){
    const sw = L.splash.w, sh = Math.max(L.splash.minH, sw * sp.naturalHeight / sp.naturalWidth), swh = sh * sp.naturalWidth / sp.naturalHeight;
    x.drawImage(sp, L.splash.x - (swh - sw) / 2, Y0 - sh * .8, swh, sh);
  }
  const mon = IM[evil ? 'ar-mon-e' : 'ar-mon'];
  if (ok(mon)){
    /* standing in the sea: below the waterline it takes the water's colour, the surface crosses in front of it, and the splash with it */
    const mh = L.mon.h, mw = mh * mon.naturalWidth / mon.naturalHeight, mx = L.mon.x - mw / 2, my = L.mon.y, k = x.getTransform().a || 1;
    const mc = document.createElement('canvas'); mc.width = Math.ceil(mw * k); mc.height = Math.ceil(mh * k);
    const m = mc.getContext('2d'); m.scale(k, k); m.drawImage(mon, 0, 0, mw, mh);
    const wy = Y0 - my;
    if (wy < mh){
      m.globalCompositeOperation = 'source-atop';
      const g = m.createLinearGradient(0, wy, 0, mh);
      if (evil){ g.addColorStop(0, 'rgba(110,0,0,.34)'); g.addColorStop(1, 'rgba(50,0,0,.62)'); }
      else { g.addColorStop(0, 'rgba(120,214,240,.26)'); g.addColorStop(.5, 'rgba(70,184,222,.4)'); g.addColorStop(1, 'rgba(90,190,214,.52)'); }
      m.fillStyle = g; m.fillRect(0, wy, mw, mh - wy);
      const lip = m.createLinearGradient(0, wy - 4, 0, wy + 6);
      lip.addColorStop(0, 'rgba(255,255,255,0)'); lip.addColorStop(.45, evil ? 'rgba(255,120,90,.6)' : 'rgba(255,255,255,.95)'); lip.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = lip; m.fillRect(0, wy - 4, mw, 10);
    }
    x.drawImage(mc, mx, my, mw, mh);
    if (ok(sp) && wy < mh){
      const sw = L.splash.w, sh = Math.max(L.splash.minH, sw * sp.naturalHeight / sp.naturalWidth), swh = sh * sp.naturalWidth / sp.naturalHeight;
      x.save(); x.beginPath(); x.rect(mx - mw * .05, Y0 - sh * .42, mw * 1.1, sh * .62); x.clip();
      x.globalAlpha = evil ? .8 : .9; x.drawImage(sp, L.splash.x - (swh - sw) / 2 - mw * .37, Y0 - sh * .8, swh, sh); x.restore();
    }
  }
  if (!evil){
    sprite(x, IM['ar-fish1'], L.fish1.x, L.fish1.y, L.fish1.w, L.fish1.rot);
    sprite(x, IM['ar-star'], L.star.x, L.star.y, L.star.w, L.star.rot);
  } else {
    L.dead.forEach(d => sprite(x, IM['ar-fish-e'], d.x, d.y, d.w, .05, d.flip, .9));
    sprite(x, IM['ar-skull'], L.skull.x, L.skull.y, L.skull.w, .08);
    sprite(x, IM['evil-bone'], L.bone2.x, L.bone2.y, L.bone2.w, -.04, 0, .95);
    sprite(x, IM['evil-bone'], L.fish1.x - L.fish1.w * .05, L.fish1.y - L.fish1.w * .08, L.fish1.w * 1.4, .1, 1);      // bursting out of the screen, facing out
    const v = x.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .35, w / 2, h * .5, Math.max(w, h) * .78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,0,.6)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
  }
  if (page === 'timetable'){ x.fillStyle = evil ? 'rgba(12,0,0,.3)' : 'rgba(238,249,255,.3)'; x.fillRect(0, 0, w, h); }     // the timetable is busy enough: the picture steps back a little
}

FX.scenes.aero = {
  dpr:1.25, maxPx:2e6, fps:30,
  create(canvas, env){
    const x = canvas.getContext('2d'); if (!x) return null;
    let e = env, W = canvas.width, H = canvas.height, U = 1, built = '', L = null;
    const back = document.createElement('canvas'), front = document.createElement('canvas');
    let globe = null;
    FX.aePics(!!e.dark);
    const build = () => {
      const w = W / U, h = H / U, evil = !!e.dark;
      L = layout(w, h);
      for (const c of [back, front]){ c.width = W; c.height = H; const cx = c.getContext('2d'); cx.setTransform(U, 0, 0, U, 0, 0); cx.clearRect(0, 0, w, h); }
      drawBack(back.getContext('2d'), w, h, L, evil);
      drawFront(front.getContext('2d'), w, h, L, evil, e.page);
      const D = Math.max(96, Math.min(360, Math.round(L.globe.r * 2 * U * .8)));
      if (!globe || globe.canvas.width !== D) globe = Globe(D);
    };
    const draw = t => {
      const evil = !!e.dark, key = W + 'x' + H + ':' + U + ':' + (evil ? 1 : 0) + ':' + gen;
      if (key !== built){ build(); built = key; }
      const w = W / U, h = H / U;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
      x.drawImage(back, 0, 0);
      x.setTransform(U, 0, 0, U, 0, 0);
      /* the globe, its halo, its glass */
      const G = L.globe, gl = globe.draw((t / 160) % 1, evil, IM['ar-map']);
      const halo = x.createRadialGradient(G.x, G.y, G.r * .85, G.x, G.y, G.r * 1.35);
      halo.addColorStop(0, evil ? 'rgba(255,240,226,.75)' : 'rgba(225,248,255,.8)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = halo; x.fillRect(G.x - G.r * 1.4, G.y - G.r * 1.4, G.r * 2.8, G.r * 2.8);
      x.drawImage(gl, G.x - G.r, G.y - G.r, G.r * 2, G.r * 2);
      if (!evil){
        x.save(); x.strokeStyle = 'rgba(230,250,255,.55)'; x.lineWidth = 1.2; x.shadowColor = 'rgba(160,230,255,.9)'; x.shadowBlur = 6;
        for (let i = 0; i < 3; i++){ x.beginPath(); x.ellipse(G.x, G.y, G.r * (.98 - i * .02), G.r * (.25 + i * .28), -.35 + i * .5, 0, Math.PI * 2); x.stroke(); }
        x.restore();
      }
      x.save(); x.translate(G.x - G.r * .38, G.y - G.r * .55); x.rotate(-.5);
      const hl = x.createRadialGradient(0, 0, 0, 0, 0, G.r * .5); hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      x.scale(1, .45); x.fillStyle = hl; x.beginPath(); x.arc(0, 0, G.r * .5, 0, 7); x.fill(); x.restore();
      x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(front, 0, 0); x.setTransform(U, 0, 0, U, 0, 0);
      /* Evil: the fire out of the screen, flickering */
      if (evil && ok(IM['ar-flame'])){
        const M = L.mon, fw = M.h * .82, fl = IM['ar-flame'], fh = fw * fl.naturalHeight / fl.naturalWidth;
        const k1 = 1 + .05 * Math.sin(t * 7.3) + .03 * Math.sin(t * 12.1), k2 = 1 + .05 * Math.sin(t * 5.9 + 1) + .03 * Math.sin(t * 13.7);
        x.save(); x.globalCompositeOperation = 'screen';
        const bx = M.x - M.h * .32, by = M.y + M.h * .26;
        x.save(); x.translate(bx, by); x.scale(1, k1); x.globalAlpha = .95; x.drawImage(fl, -fw * .2, -fh * .95, fw, fh); x.restore();
        x.save(); x.translate(bx + fw * .12, by); x.scale(-.8, k2 * .9); x.globalAlpha = .6; x.drawImage(fl, -fw * .35, -fh * .95, fw, fh); x.restore();
        x.restore();
      }
      /* gulls (Aero) or bats (Evil), drifting a very little */
      L.flyers.forEach((f, i) => {
        const im = evil ? IM['evil-bat' + [1, 2, 3][f.i]] : IM['ar-gull' + (f.i + 1)]; if (!ok(im)) return;
        const dx = Math.sin(t * .11 + i * 2) * 5 * (evil ? .4 : 1), dy = Math.sin(t * .17 + i) * 4 * (evil ? .4 : 1), r = Math.sin(t * .13 + i * 3) * .02;
        if (evil){ const gi = glowed(im), k = f.w * (f.i === 2 ? .8 : .55) / im.naturalWidth; x.save(); x.translate(f.x + dx, f.y + dy); x.rotate(r - .1 + .2 * hash(i, 4)); x.drawImage(gi, -gi.width * k / 2, -gi.height * k / 2, gi.width * k, gi.height * k); x.restore(); }
        else sprite(x, im, f.x + dx, f.y + dy, f.w, r, f.flip);
      });
      /* the fish under the water, bobbing */
      if (!evil){
        sprite(x, IM['ar-fish2'], L.fish2.x + Math.sin(t * .2) * 6, L.fish2.y + Math.sin(t * .31) * 4, L.fish2.w, L.fish2.rot + Math.sin(t * .27) * .02);
        sprite(x, IM['ar-fish1'], L.fish3.x + Math.sin(t * .23 + 2) * 5, L.fish3.y + Math.sin(t * .37 + 1) * 3, L.fish3.w, L.fish3.rot);
      }
      /* the bubbles: the picture's own, bobbing where they are, and a few small ones rising (Evil: sinking) */
      const spr = FX.aeBubble(evil);
      L.bubbles.forEach((b, i) => { const r = b[2]; x.globalAlpha = .92; x.drawImage(spr, b[0] - r + Math.sin(t * .21 + i) * 4, b[1] - r + Math.sin(t * .29 + i * 2) * 5, r * 2, r * 2); });
      const n = e.page === 'timetable' ? 5 : (L.port ? 6 : 10);
      for (let i = 0; i < n; i++){
        const r = (6 + 22 * Math.pow(hash(i, 5), 1.7)) * Math.max(.7, L.s * 1.2), v = 9 + 14 * hash(i, 6), span = h + r * 2 + 40;
        let y = (hash(i, 7) * span + t * v * (evil ? .5 : 1)) % span; y = evil ? y - r - 20 : h + r + 20 - y;
        const side = hash(i, 8), col = side < .4 ? hash(i, 9) * .25 : side < .8 ? .75 + hash(i, 9) * .25 : hash(i, 9);
        x.globalAlpha = .55 + .4 * hash(i, 11); x.drawImage(spr, col * w + Math.sin(t * (.25 + .3 * hash(i, 10)) + i) * 10 - r, y - r, r * 2, r * 2);
      }
      x.globalAlpha = 1;
    };
    return {
      frame(t){ draw(t); },
      resize(w, h, sc){ W = w; H = h; U = sc || 1; },
      env(n){ e = n; FX.aePics(!!e.dark); },
      dispose(){}
    };
  }
};
})();
