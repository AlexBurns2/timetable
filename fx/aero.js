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
   few things can move, slowly: the globe turns with a light circling it
   on its ring, the bubbles rise, the clouds drift, the light under the
   water sways, the surface glints now and then, and the gulls and the
   fish drift a little. Nothing follows the pointer. On a wide screen the
   globe and the monitor stand at the edges, where the page's own column
   leaves the picture showing, not in the middle behind it.

   Dark mode is FRUTIGER EVIL, the meme: the same picture gone wrong.
   A murky brown sky with bats, a pink globe, red water, the monitor's
   screen on fire (flames licking up over its top, embers drifting off
   it) with a fish skeleton bursting out of it,
   another skeleton and dead fish in the water, a skull on the bottom.
   Cut out a bit roughly, which is the joke.

   The still layers (sky, sea, splash, monitor) are drawn once into two
   canvases and copied each frame; only the globe, the clouds, the
   bubbles and a handful of cut-outs are drawn every frame.
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
const EVIL = ['ar-sky-e', 'ar-water-e', 'ar-splash-e', 'ar-mon-e', 'evil-bone', 'ar-fish-e', 'ar-skull', 'evil-bat1', 'evil-bat2', 'evil-bat3', 'ar-map', 'ar-flames'];
FX.aePics = evil => (evil ? EVIL : LIGHT).map(pic);

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
    /* the page's column sits in the middle, so the things to look at are measured in from the edges: the globe on the
       left, the monitor on the right with the fish bursting out of it towards the middle */
    const s = Math.min(w / 1600, h / 1000), Y0 = h * .6, mh = 540 * s, mw = mh * 680 / 748, mx = w - 235 * s, my = Y0 - mh * .44;
    return { port, s, Y0,
      globe:{ x:150 * s, y:h * .3, r:225 * s },
      mon:{ x:mx, y:my, h:mh },
      fish1:{ x:mx - mw * .355, y:my + mh * .345, w:mh * .534, rot:-.06 },
      fish2:{ x:310 * s, y:h * .81, w:280 * s, rot:.05 },
      fish3:{ x:w - 470 * s, y:h * .9, w:110 * s, rot:.08 },
      star:{ x:105 * s, y:h * .935, w:210 * s, rot:-.3 },
      skull:{ x:125 * s, y:h * .88, w:230 * s },
      bone2:{ x:330 * s, y:h * .8, w:300 * s },
      dead:[{ x:470 * s, y:h * .69, w:80 * s }, { x:w - 430 * s, y:h * .9, w:70 * s, flip:1 }],
      splash:{ x:-w * .04, w:w * 1.08, minH:h * .2 },
      clouds:{ x:-w * .07, w:Math.max(w * .6, 760 * s) },
      flyers:[{ i:0, x:w - 400 * s, y:h * .13, w:200 * s, flip:1 }, { i:2, x:340 * s, y:h * .52, w:250 * s }, { i:1, x:w - 120 * s, y:h * .06, w:95 * s }, { i:1, x:430 * s, y:h * .085, w:62 * s }],
      bubbles:[[355 * s, h * .24, 90 * s], [w - 70 * s, h * .15, 52 * s], [w - 450 * s, h * .3, 30 * s], [w - 490 * s, h * .345, 11 * s], [480 * s, h * .15, 17 * s],
               [45 * s, h * .55, 30 * s], [215 * s, h * .935, 60 * s], [470 * s, h * .83, 28 * s], [w - 35 * s, h * .66, 22 * s], [w - 300 * s, h * .94, 34 * s]]
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
/* Evil: a row of flames (the cut-out photograph ar-flames, every other one mirrored) standing on the line from (x0, y0) to
   (x1, y1). Each is drawn in slices that sway, the tips most and the roots not at all, and it stretches a little as it
   flickers: the way real fire moves, where squashing a whole picture up and down only looked like a picture squashing. */
function flames(x, fl, x0, x1, y0, y1, tw, t){
  const iw = fl.naturalWidth, ih = fl.naturalHeight, th = tw * ih / iw, S = 12, n = Math.max(2, Math.ceil((x1 - x0) / (tw * .55)));
  for (let c = 0; c < n; c++){
    const u = c / (n - 1), cx = x0 + (x1 - x0) * u, by = y0 + (y1 - y0) * u + th * .07;
    const hh = th * (.8 + .25 * hash(c, 41)) * (1 + .07 * Math.sin(t * 5.3 + c * 1.7) + .04 * Math.sin(t * 8.9 + c * 2.9)), f = c % 2 ? -1 : 1;
    for (let j = 0; j < S; j++){
      const sway = Math.sin(t * 6.1 + j * .75 + c * 2.1) * tw * .016 * Math.pow(1 - j / S, 1.4);
      x.save(); x.translate(cx + sway, 0); x.scale(f, 1);
      x.drawImage(fl, 0, j * ih / S, iw, ih / S, -tw / 2, by - hh + j * hh / S, tw, hh / S + .7); x.restore();
    }
  }
}
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
    /* (the clouds drift, so they are drawn every frame: CLOUDS, below) */
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
    /* (the rays of light under the water sway, so they are drawn every frame too: rays(), below) */
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
    sprite(x, IM['ar-star'], L.star.x, L.star.y, L.star.w, L.star.rot);
  } else {
    L.dead.forEach(d => sprite(x, IM['ar-fish-e'], d.x, d.y, d.w, .05, d.flip, .9));
    sprite(x, IM['ar-skull'], L.skull.x, L.skull.y, L.skull.w, .08);
    sprite(x, IM['evil-bone'], L.bone2.x, L.bone2.y, L.bone2.w, -.04, 0, .95);
    const v = x.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .42, w / 2, h * .5, Math.max(w, h) * .85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,0,.45)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
  }
  /* (the fish bursting out of the screen, and Evil's skeleton, bob a little: drawn every frame) */
  if (page === 'timetable'){ x.fillStyle = evil ? 'rgba(12,0,0,.3)' : 'rgba(238,249,255,.3)'; x.fillRect(0, 0, w, h); }     // the timetable is busy enough: the picture steps back a little
}

FX.scenes.aero = {
  dpr:1.25, maxPx:2e6, fps:30,
  create(canvas, env){
    const x = canvas.getContext('2d'); if (!x) return null;
    let e = env, W = canvas.width, H = canvas.height, U = 1, built = '', L = null;
    const back = document.createElement('canvas'), front = document.createElement('canvas');
    let globe = null, CL = null, RG = null;
    FX.aePics(!!e.dark);
    let shown = null, born = performance.now();
    setTimeout(() => { if (FX.refresh) FX.refresh(); }, 1600);      // with Animation off nothing else would draw it after the wait
    /* the clouds are drawn at their size once, each into its own canvas cut off at the horizon, and then only moved */
    const cloudsAt = (w, evil) => {
      const cl = IM['ar-clouds']; CL = null; if (evil || !ok(cl)) return;
      const Y0 = L.Y0, cw = L.clouds.w, ch = cw * cl.naturalHeight / cl.naturalWidth;
      const mk = (x0, top, cw2, ch2, flip, a) => {
        const c = document.createElement('canvas'), hh = Math.max(1, Y0 - top); c.width = Math.ceil(cw2 * U); c.height = Math.ceil(hh * U);
        const q = c.getContext('2d'); q.scale(U, U); q.globalAlpha = a; if (flip){ q.translate(cw2, 0); q.scale(-1, 1); } q.drawImage(cl, 0, 0, cw2, ch2);
        return { c, x:x0, top, w:cw2, h:hh };
      };
      CL = [mk(w * .62 + cw * .1, Y0 - ch * .78, cw * .8, ch * .8, 1, .55), mk(L.clouds.x, Y0 - ch * .9, cw, ch, 0, .96)];     // the faint far copy first
    };
    const build = () => {
      const w = W / U, h = H / U, evil = !!e.dark;
      L = layout(w, h);
      for (const c of [back, front]){ c.width = W; c.height = H; const cx = c.getContext('2d'); cx.setTransform(U, 0, 0, U, 0, 0); cx.clearRect(0, 0, w, h); }
      drawBack(back.getContext('2d'), w, h, L, evil);
      drawFront(front.getContext('2d'), w, h, L, evil, e.page);
      cloudsAt(w, evil);
      RG = x.createLinearGradient(0, L.Y0, 0, h); RG.addColorStop(0, 'rgba(255,255,255,.12)'); RG.addColorStop(1, 'rgba(255,255,255,0)');
      const D = Math.max(96, Math.min(360, Math.round(L.globe.r * 2 * U * .8)));
      if (!globe || globe.canvas.width !== D) globe = Globe(D);
    };
    /* the light under the water: five rays from the surface, their feet swaying slowly and their strength coming and going */
    const rays = (w, h, t) => {
      x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = RG;
      for (let i = 0; i < 5; i++){
        const bx = w * (.1 + .2 * i + .05 * hash(i, 3)), bw = w * (.03 + .04 * hash(i, 4)), sw = Math.sin(t * .09 + i * 1.7) * w * .05;
        x.globalAlpha = .7 + .3 * Math.sin(t * .21 + i * 2.3);
        x.beginPath(); x.moveTo(bx, L.Y0); x.lineTo(bx + bw, L.Y0); x.lineTo(bx + bw * 3 + w * .08 + sw, h); x.lineTo(bx + w * .08 + sw, h); x.fill();
      }
      x.restore();
    };
    /* now and then a glint of sun on the surface: a soft point of light with a short cross, there for a second or two, somewhere else next time */
    const glints = (w, t) => {
      const n = L.port ? 5 : 9, k = Math.max(.7, L.s);
      x.save(); x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++){
        const ph = t * .35 + hash(i, 21) * 6.283, cy = Math.floor(ph / 6.283), a = Math.pow(Math.max(0, Math.sin(ph)), 8);
        if (a < .02) continue;
        const gx = w * hash(i * 7 + cy, 22), gy = L.Y0 - 4 + 14 * hash(i * 7 + cy, 23), r = (5 + 7 * hash(i, 24)) * k;
        const g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(255,255,255,' + (.9 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(gx - r, gy - r, r * 2, r * 2);
        x.globalAlpha = a * .7; x.fillStyle = '#fff'; x.fillRect(gx - r * 2.4, gy - .6, r * 4.8, 1.2); x.fillRect(gx - .6, gy - r * 1.3, 1.2, r * 2.6); x.globalAlpha = 1;
      }
      x.restore();
    };
    /* Evil: embers drifting up off the burning monitor, each glowing for a few seconds and gone */
    const embers = t => {
      const M = L.mon, mw = M.h * 680 / 748, n = L.port ? 10 : 16, k = Math.max(.8, L.s);
      x.save(); x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++){
        const life = 6 + 6 * hash(i, 31), q = t / life + hash(i, 32), cy = Math.floor(q), u = q - cy;
        const ex = M.x - mw * .45 + mw * .9 * hash(i * 5 + cy, 33) + Math.sin(t * (.6 + .5 * hash(i, 34)) + i) * 12 * k + (hash(i, 35) - .5) * 70 * k * u;
        const ey = M.y + M.h * .04 - u * (150 + 150 * hash(i, 36)) * k;
        const a = Math.sin(Math.PI * u) * (.75 + .25 * Math.sin(t * 6 + i * 3));
        x.fillStyle = 'rgba(255,' + (120 + 100 * hash(i, 38) | 0) + ',40,' + a.toFixed(3) + ')';
        x.beginPath(); x.arc(ex, ey, (1.1 + 1.5 * hash(i, 37)) * k, 0, 7); x.fill();
      }
      x.restore();
    };
    const draw = t => {
      const evil = !!e.dark, key = W + 'x' + H + ':' + U + ':' + (evil ? 1 : 0) + ':' + gen;
      /* until its photographs are in (or a second and a half has gone), the canvas stays clear and the stylesheet's still
         frame of this same picture (ar-still*, under it) is what shows: no half-drawn sky with things popping into it */
      if (shown !== evil){
        if (!(evil ? EVIL : LIGHT).every(n => IM[n] && IM[n].complete) && performance.now() - born < 1500){ x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); return; }
        shown = evil; document.documentElement.classList.add('ae-drawn');
      }
      if (key !== built){ build(); built = key; }
      const w = W / U, h = H / U;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
      x.drawImage(back, 0, 0);
      x.setTransform(U, 0, 0, U, 0, 0);
      /* the clouds, drifting a little way and back over a few minutes (the far copy the other way); the light under the water */
      if (CL){ const dx = Math.sin(t * .045) * 36 * L.s; CL.forEach((c, i) => x.drawImage(c.c, c.x + (i ? dx : -dx * .6), c.top, c.w, c.h)); }
      if (!evil) rays(w, h, t);
      /* the globe, its halo, its glass */
      const G = L.globe, gl = globe.draw((t / 160) % 1, evil, IM['ar-map']);
      const halo = x.createRadialGradient(G.x, G.y, G.r * .85, G.x, G.y, G.r * 1.35);
      halo.addColorStop(0, evil ? 'rgba(255,240,226,.75)' : 'rgba(225,248,255,.8)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = halo; x.fillRect(G.x - G.r * 1.4, G.y - G.r * 1.4, G.r * 2.8, G.r * 2.8);
      x.drawImage(gl, G.x - G.r, G.y - G.r, G.r * 2, G.r * 2);
      if (!evil){
        /* its rings sway very slowly, and a light goes round the middle one, dimmer as it passes behind */
        const tilt = i => -.35 + i * .5 + Math.sin(t * .05 + i * 2) * .06;
        x.save(); x.strokeStyle = 'rgba(230,250,255,.55)'; x.lineWidth = 1.2; x.shadowColor = 'rgba(160,230,255,.9)'; x.shadowBlur = 6;
        for (let i = 0; i < 3; i++){ x.beginPath(); x.ellipse(G.x, G.y, G.r * (.98 - i * .02), G.r * (.25 + i * .28), tilt(i), 0, Math.PI * 2); x.stroke(); }
        x.restore();
        const rx = G.r * .96, ry = G.r * .53, ro = tilt(1), cr = Math.cos(ro), sr = Math.sin(ro), th = t * .42;
        x.save(); x.globalCompositeOperation = 'lighter';
        for (let k = 6; k >= 0; k--){
          const a = th - k * .06, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, px = G.x + ex * cr - ey * sr, py = G.y + ex * sr + ey * cr;
          const near = Math.min(1, Math.max(0, (Math.sin(a) + .25) / .5)), al = (.25 + .75 * near) * (1 - k / 7), rr = G.r * (k ? .025 : .06);
          const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(235,252,255,' + al.toFixed(3) + ')'); g.addColorStop(1, 'rgba(160,230,255,0)');
          x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
        }
        x.restore();
      }
      x.save(); x.translate(G.x - G.r * .38, G.y - G.r * .55); x.rotate(-.5);
      const hl = x.createRadialGradient(0, 0, 0, 0, 0, G.r * .5); hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      x.scale(1, .45); x.fillStyle = hl; x.beginPath(); x.arc(0, 0, G.r * .5, 0, 7); x.fill(); x.restore();
      x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(front, 0, 0); x.setTransform(U, 0, 0, U, 0, 0);
      const F = L.fish1, bob = [Math.sin(t * .31) * 3 * L.s, Math.sin(t * .43) * 4 * L.s, Math.sin(t * .37) * .015];
      if (!evil){
        glints(w, t);
        sprite(x, IM['ar-fish1'], F.x + bob[0], F.y + bob[1], F.w, F.rot + bob[2]);         // bursting out of the screen
      } else {
        /* the screen is on fire (the picture's in ar-mon-e): its light flickers on the air round it, flames lick up over
           the monitor's top, and embers drift off. The skeleton bursts out in front of it all. */
        const M = L.mon, mw = M.h * 680 / 748, mx = M.x - mw / 2, fk = .75 + .12 * Math.sin(t * 7.1) + .08 * Math.sin(t * 11.3 + 1) + .05 * Math.sin(t * 17.9 + 2);
        const gx = M.x, gy = M.y + M.h * .35, gr = M.h * .8;
        x.save(); x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(gx, gy, gr * .15, gx, gy, gr); g.addColorStop(0, 'rgba(255,90,10,' + (.17 * fk).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,60,0,0)');
        x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); x.restore();
        if (ok(IM['ar-flames'])) flames(x, IM['ar-flames'], mx + mw * .2, mx + mw * .8, M.y + M.h * .03, M.y + M.h * .045, mw * .46, t);
        sprite(x, IM['evil-bone'], F.x - F.w * .05 + bob[0], F.y - F.w * .08 + bob[1], F.w * 1.4, .1 + bob[2], 1);      // facing out
        embers(t);
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
      env(n){ if (!!n.dark !== !!e.dark) born = performance.now(); e = n; FX.aePics(!!e.dark); },
      dispose(){ document.documentElement.classList.remove('ae-drawn'); }
    };
  }
};
})();
