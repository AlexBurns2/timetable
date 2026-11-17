/* ═══════════════════════════════════════════════════════════════════
   Frutiger Aero's background (fx.js loads this for that theme only).

   The photograph is the stylesheet's (body::before); this canvas sits
   over it, transparent, and lets a few bubbles drift up: big soap
   bubbles in the sky pages, small air bubbles underwater. Every bubble's
   place is worked out from the clock, so a page picks up where the last
   left off and the still frame (Animation off) is just one moment of it.
   Slow on purpose, slowest on Home and the timetable.

   Dark mode (Frutiger Evil): the bubbles are red and sink, a few bats
   cross the sky and fish skeletons drift through the water. They are
   cut-out stock photographs (images/th/evil-*.webp), a little rough at
   the edges, which is the joke.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const V = FX.V ? '?v=' + FX.V : '';
const img = n => { const i = new Image(); i.decoding = 'async'; i.onload = () => { if (FX.refresh) FX.refresh(); }; i.src = '/images/th/' + n + '.webp' + V; return i; };   // drawn again once it arrives (a still frame too)
let SPR = null;                                       // loaded the first time it is dark
const sprites = () => SPR || (SPR = { bats:[img('evil-bat1'), img('evil-bat2'), img('evil-bat3')], bone:img('evil-bone') });
const ok = i => i && i.complete && i.naturalWidth > 0;

/* one bubble drawn once, large, then scaled: light (clear, with a faint film of colour) or evil (red) */
function bubble(evil){
  const R = 128, c = document.createElement('canvas'); c.width = c.height = R * 2 + 4;
  const x = c.getContext('2d'), m = R + 2;
  const body = x.createRadialGradient(m, m, R * .2, m, m, R);
  if (evil){ body.addColorStop(0, 'rgba(255,40,30,.04)'); body.addColorStop(.75, 'rgba(255,40,30,.14)'); body.addColorStop(1, 'rgba(255,90,70,.42)'); }
  else { body.addColorStop(0, 'rgba(255,255,255,.02)'); body.addColorStop(.72, 'rgba(255,255,255,.1)'); body.addColorStop(1, 'rgba(255,255,255,.42)'); }
  x.fillStyle = body; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill();
  /* the film: a little cyan and pink on the rim, lower right (none in Evil) */
  if (!evil){
    const f = x.createLinearGradient(m - R, m - R, m + R, m + R);
    f.addColorStop(0, 'rgba(120,220,255,0)'); f.addColorStop(.55, 'rgba(120,220,255,.35)'); f.addColorStop(.8, 'rgba(255,150,220,.32)'); f.addColorStop(1, 'rgba(255,230,140,.25)');
    x.strokeStyle = f; x.lineWidth = R * .07; x.beginPath(); x.arc(m, m, R * .955, 0, 7); x.stroke();
  }
  x.strokeStyle = evil ? 'rgba(255,150,130,.55)' : 'rgba(255,255,255,.7)'; x.lineWidth = R * .025; x.beginPath(); x.arc(m, m, R * .985, 0, 7); x.stroke();
  /* the highlights: a window of light up on the left, a small one opposite */
  x.save(); x.translate(m - R * .4, m - R * .44); x.rotate(-.7);
  const h = x.createRadialGradient(0, 0, 0, 0, 0, R * .3); h.addColorStop(0, 'rgba(255,255,255,.95)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  x.scale(1, .55); x.fillStyle = h; x.beginPath(); x.arc(0, 0, R * .3, 0, 7); x.fill(); x.restore();
  x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(m + R * .46, m + R * .5, R * .06, 0, 7); x.fill();
  return c;
}
const BUB = {}; FX.aeBubble = evil => BUB[evil ? 1 : 0] || (BUB[evil ? 1 : 0] = bubble(!!evil));     // shared with the page change (fx.js TR.aero)
/* how each page's bubbles behave: how many, how big (CSS px), how fast they rise (px a second), how far they sway */
const KIND = { home:'sky', timetable:'calm' };            // everything else: 'world'
const CFG = {
  sky:  { n:9,  r:[22, 74], v:[7, 13],  sway:16, bats:2, bones:0 },
  calm: { n:6,  r:[16, 50], v:[4, 8],   sway:10, bats:1, bones:0 },
  sea:  { n:24, r:[4, 22],  v:[14, 30], sway:7,  bats:1, bones:3 },
  world:{ n:12, r:[8, 52],  v:[7, 14],  sway:12, bats:2, bones:0 }
};
const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

FX.scenes.aero = {
  dpr:1.25, maxPx:2e6, fps:30,
  create(canvas, env){
    const x = canvas.getContext('2d'); if (!x) return null;
    let e = env, W = canvas.width, H = canvas.height, U = 1;
    const B = { light:FX.aeBubble(false), evil:FX.aeBubble(true) };
    const draw = (t) => {
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
      const cfg = CFG[KIND[e.page] || 'world'], evil = !!e.dark, spr = B[evil ? 'evil' : 'light'];
      const w = W / U, h = H / U;                        // in CSS pixels
      x.setTransform(U, 0, 0, U, 0, 0);
      /* the margins either side of the page, where the background shows (on a phone there are none: they go behind the glass) */
      const g = Math.max(120, (w - 1140) / 2), gx = side => side ? w - g / 2 : g / 2;
      /* Evil: bats hanging about in the margins, high up, behind the bubbles */
      if (evil){
        const S = sprites();
        for (let i = 0; i < cfg.bats; i++){
          const b = S.bats[i % 3]; if (!ok(b)) continue;
          const ph = hash(i, 2) * 6.3, sp = .05 + .03 * hash(i, 1), rx = 7 + 5 * hash(i, 4);           // barely moving: the bubbles are the motion
          const sz = Math.min(90 + 70 * hash(i, 3), g * .95), k = sz / Math.max(b.naturalWidth, b.naturalHeight), bw = b.naturalWidth * k, bh = b.naturalHeight * k;
          const X = gx(i % 2) + (hash(i, 6) - .5) * g * .3 + Math.cos(t * sp + ph) * rx, Y = h * (.12 + .4 * (i / Math.max(1, cfg.bats)) + .08 * hash(i, 5)) + Math.sin(t * sp * 1.3 + ph) * 6;
          const dir = hash(i, 7) < .5 ? 1 : -1;
          x.save(); x.translate(X, Y); x.scale(dir, 1); x.rotate(-.12 + .24 * hash(i, 8) + Math.sin(t * .15 + i) * .015);
          x.shadowColor = 'rgba(255,45,20,.9)'; x.shadowBlur = 16 * U;                 // the cheap red outer glow they always had
          x.drawImage(b, -bw / 2, -bh / 2, bw, bh); x.restore();
        }
      }
      /* the bubbles */
      for (let i = 0; i < cfg.n; i++){
        const r = cfg.r[0] + (cfg.r[1] - cfg.r[0]) * Math.pow(hash(i, 5), 1.6), v = cfg.v[0] + (cfg.v[1] - cfg.v[0]) * hash(i, 6);
        const span = h + r * 2 + 40;
        let y = (hash(i, 7) * span + t * v * (evil ? .55 : 1)) % span;
        y = evil ? y - r - 20 : h + r + 20 - y;            // rising (Aero) or sinking (Evil)
        /* mostly towards the sides, where the page leaves the background showing */
        const side = hash(i, 8), col = side < .42 ? hash(i, 9) * .24 : side < .84 ? .76 + hash(i, 9) * .24 : hash(i, 9);
        const X = col * w + Math.sin(t * (.25 + .3 * hash(i, 10)) + i) * cfg.sway;
        x.globalAlpha = .62 + .38 * hash(i, 11);
        x.drawImage(spr, X - r, y - r, r * 2, r * 2);
      }
      x.globalAlpha = 1;
      /* Evil: fish skeletons drifting low, through the water */
      if (evil && cfg.bones){
        const bone = sprites().bone;
        if (ok(bone)) for (let i = 0; i < cfg.bones; i++){
          const ph = hash(i, 13) * 6.3, bw = Math.min(150 + 90 * hash(i, 14), g * 1.1), bh = bw * bone.naturalHeight / bone.naturalWidth;
          const X = gx((i + 1) % 2) + (hash(i, 16) - .5) * g * .3 + Math.sin(t * .04 + ph) * 8, Y = h * (.6 + .3 * hash(i, 15)) + Math.sin(t * .09 + i * 3) * 4;
          const dir = hash(i, 17) < .5 ? 1 : -1;                                             // drifting, hardly at all
          x.save(); x.translate(X, Y); x.scale(-dir, 1); x.rotate(Math.sin(t * .06 + i) * .02); x.globalAlpha = .9;
          x.drawImage(bone, -bw / 2, -bh / 2, bw, bh); x.restore();
        }
        x.globalAlpha = 1;
      }
    };
    return {
      frame(t){ draw(t); },
      resize(w, h, sc){ W = w; H = h; U = sc || 1; },
      env(n){ e = n; },
      dispose(){}
    };
  }
};
})();
