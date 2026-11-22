/* ═══════════════════════════════════════════════════════════════════
   Vaporwave's backgrounds (fx.js loads this for that theme only).

   A different scene for each page, all in one hand: deep violet skies
   running to pink at the horizon, a few solid things with real light
   and shade on them, set in a dreamlike place. Night in the dark
   version, a pastel dusk in the light one. Each scene keeps what there
   is to look at out at the sides, where the page doesn't cover it.
   Drawn on a 2D canvas, slowly, at thirty frames a second. Nothing
   follows the pointer, and there is no tape noise over it.

   (Moderators see a reworked set instead, for now: makeNext, at the end.)

     timetable          drive     a road to a banded sun and a far skyline,
                                  low-poly hills rising either side and
                                  passing (a real mesh, lit from the sun)
     home               ruins     marble columns standing in still water
                                  under a great moon
     calendar, notes    pyramids  pyramids on a plain, a crescent, a gem
                                  hanging over the tallest
     games, finder      planets   a ringed planet, small moons, a turning gem
     free, revision     stairs    steps hanging in the air above a sea of
                                  cloud, up to a lit doorway
     resources, mahjong solids    a cube, a cone and a ball over a
                                  chequered floor
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const TAU = 6.2831853;
const rnd = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s/4294967296; }; };
const hash = (a, b) => { let h = (a*374761393 + b*668265263) | 0; h = (h ^ (h >>> 13))*1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0)/4294967296; };
const mix = (a, b, k) => 'rgb(' + Math.round(a[0] + (b[0] - a[0])*k) + ',' + Math.round(a[1] + (b[1] - a[1])*k) + ',' + Math.round(a[2] + (b[2] - a[2])*k) + ')';
const PAGE = { timetable:'drive', home:'ruins', calendar:'pyramids', notes:'pyramids', games:'planets', finder:'planets',
               free:'stairs', revision:'stairs', resources:'solids', mahjong:'solids' };

/* The reworked Vaporwave is for moderators until it's released: everyone else gets the scenes above, as they were.
   <html> gets vw-next, which skins/vapor.css keys the new colours off. */
const root = document.documentElement;
const NEXT = (() => { try { return localStorage.getItem('msc.ismod') === '1'; } catch { return false; } })();
if (NEXT) root.classList.add('vw-next');
/* Each page's own arrangement in the reworked theme. On a wide screen its window stands off centre (shift: skins/vapor.css moves it, by
   html[data-vw-shift]; the timetable is too wide to) and the scene's main thing takes the bigger margin. Its word (the page's name, in
   Japanese, in big vertical type) stands in the margin named: 'l', 'r', or 'in', just right of the window, where that margin is the big one. */
const PAGE_LAY = { timetable:{ word:'r' }, home:{ shift:'l', word:'in' }, calendar:{ shift:'l', word:'l' }, notes:{ shift:'l', word:'l' }, games:{ shift:'l', word:'l' },
                   finder:{ shift:'l', word:'l' }, free:{ shift:'l', word:'l' }, revision:{ shift:'l', word:'l' }, resources:{ shift:'l', word:'l' }, mahjong:{ shift:'l', word:'l' }, themes:{ shift:'l', word:'l' } };
if (NEXT){ const pl = PAGE_LAY[root.getAttribute('data-pg') || FX.page || '']; if (pl && pl.shift) root.setAttribute('data-vw-shift', pl.shift); }

FX.scenes.vapor = {
  dpr:NEXT ? 1.5 : 1, maxPx:NEXT ? 6.2e6 : 2.1e6, fps:30,      /* the reworked scenes are still pictures, cheap to draw: at a big window's own pixels, not stretched up to it */
  create(canvas, env){
    if (NEXT) return makeNext(canvas, env);                    /* moderators: the reworked scenes, below */
    const x = canvas.getContext('2d'); if (!x) return null;
    const scene = PAGE[env.page] || 'stairs';
    let e = env, W = canvas.width, H = canvas.height, U = Math.min(H, W*.72);
    const r0 = rnd(77);
    const stars = Array.from({ length:150 }, () => [r0(), r0(), .3 + r0()*.7, r0()*TAU, r0()]);
    const sparks = Array.from({ length:7 }, () => [r0() < .5 ? .02 + r0()*.16 : .82 + r0()*.16, .06 + r0()*.5, .6 + r0()*.8, r0()*TAU]);
    const sky = Array.from({ length:46 }, () => [.25 + r0()*.75, r0() < .3 ? 2 : 1, r0()]);
    const ridge = Array.from({ length:25 }, () => r0());

    /* ── the things every scene is made from ── */
    const lin = (x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
    const vgrad = (y0, y1, stops) => lin(0, y0, 0, y1, stops);
    const paintSky = stops => { const g = vgrad(0, H, stops); x.fillStyle = g; x.fillRect(0, 0, W, H); return g; };
    const glow = (cx, cy, R, rgb, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(.45, 'rgba(' + rgb + ',' + a*.35 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      x.fillStyle = g; x.fillRect(cx - R, cy - R, R*2, R*2); };
    const drawStars = (t, maxY, a) => { x.fillStyle = '#fff';
      stars.forEach(s => { x.globalAlpha = (a || 1)*s[2]*(.55 + .45*Math.sin(t*.9 + s[3])); const r = U*.0011*(1 + s[4]*1.3); x.beginPath(); x.arc(s[0]*W, s[1]*maxY, r, 0, TAU); x.fill(); }); x.globalAlpha = 1; };
    const sparkle = (px, py, s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(px, py - s); x.quadraticCurveTo(px, py, px + s, py); x.quadraticCurveTo(px, py, px, py + s); x.quadraticCurveTo(px, py, px - s, py); x.quadraticCurveTo(px, py, px, py - s); x.fill(); };
    const drawSparks = (t, col) => sparks.forEach(s => { x.globalAlpha = .3 + .7*Math.abs(Math.sin(t*.6 + s[3])); sparkle(s[0]*W, s[1]*H, U*.013*s[2]*(1 + .2*Math.sin(t*1.1 + s[3])), col); x.globalAlpha = 1; });
    /* a ball with light on it */
    const ball = (cx, cy, R, hi, lo, rim) => { const g = x.createRadialGradient(cx - R*.36, cy - R*.42, R*.06, cx - R*.1, cy - R*.1, R*1.12); g.addColorStop(0, hi); g.addColorStop(.72, lo); g.addColorStop(1, rim || lo);
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill(); };
    const shadow = (cx, cy, rx, ry, a) => { x.fillStyle = 'rgba(12,2,34,' + a + ')'; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.fill(); };
    /* a sun cut by bands that widen toward its foot; the sky shows through them */
    const sun = (cx, cy, R, top, mid, bot, t, skyFill) => {
      x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip();
      x.fillStyle = vgrad(cy - R, cy + R, [[0, top], [.5, mid], [1, bot]]); x.fillRect(cx - R, cy - R, R*2, R*2);
      x.fillStyle = skyFill; const off = 1 - (t*.04) % 1, N = 7;          /* the gaps rise slowly, thinning as they go, and a new one opens at the foot */
      for (let i = 0; i < N; i++){ const u = (i + off)/N; x.fillRect(cx - R, cy + R*(-.1 + 1.12*Math.pow(u, 1.2)), R*2, R*(.01 + .085*u)); }
      x.restore(); };
    /* a floor of squares in perspective */
    const checker = (hy, cx, f, a, b, drift) => {
      x.fillStyle = a; x.fillRect(0, hy, W, H - hy);
      x.fillStyle = b;
      for (let k = 0; k < 18; k++){ const z0 = .8 + k*.9, z1 = z0 + .9, y0 = hy + f/z1, y1 = hy + f/z0;
        for (let i = -20; i < 20; i++){ if ((i + k) & 1) continue; const X0 = i*1.1 + drift, X1 = X0 + 1.1;
          x.beginPath(); x.moveTo(cx + X0/z1*f, y0); x.lineTo(cx + X1/z1*f, y0); x.lineTo(cx + X1/z0*f, y1); x.lineTo(cx + X0/z0*f, y1); x.closePath(); x.fill(); } } };
    /* lines on a plain, running to the horizon */
    const gridFloor = (hy, col, t, speed) => { x.strokeStyle = col; x.lineWidth = 1; x.beginPath();
      for (let i = -18; i <= 18; i++){ x.moveTo(W/2 + i*W*.012, hy); x.lineTo(W/2 + i*W*.16, H); }
      const zo = (t*speed) % 1; for (let i = 1; i < 12; i++){ const z = i - zo; if (z < .62) continue; const y = hy + (H - hy)/z; x.moveTo(0, y); x.lineTo(W, y); }
      x.stroke(); };
    /* a marble column: a plinth, a fluted shaft that narrows, a capital. (cx, base) is the middle of its foot. */
    const column = (cx, base, w, h, c, broken) => {
      const ph = h*.055, ch = broken ? 0 : h*.075, sy0 = base - ph, sy1 = base - h + ch, w1 = w*(broken ? .9 : .84);
      const slab = (y, bw, bh) => { x.fillStyle = lin(cx - bw/2, 0, cx + bw/2, 0, [[0, c.shade], [.2, c.mid], [.45, c.lit], [.7, c.mid], [1, c.shade]]); x.fillRect(cx - bw/2, y, bw, bh);
        x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(cx - bw/2, y, bw, Math.max(1, bh*.14)); };
      x.fillStyle = lin(cx - w/2, 0, cx + w/2, 0, [[0, c.shade], [.16, c.mid], [.42, c.lit], [.66, c.mid], [1, c.shade]]);
      x.beginPath(); x.moveTo(cx - w/2, sy0); x.lineTo(cx - w1/2, sy1); x.lineTo(cx + w1/2, sy1); x.lineTo(cx + w/2, sy0); x.closePath(); x.fill();
      x.strokeStyle = c.shade; x.lineWidth = Math.max(1, w*.02);
      for (let i = 1; i < 7; i++){ const k = (1 - Math.cos(i/7*Math.PI))/2 - .5;                     /* the flutes bunch toward the edges, as on a cylinder */
        x.globalAlpha = .2 + .3*Math.abs(k)*2; x.beginPath(); x.moveTo(cx + k*w, sy0 - h*.01); x.lineTo(cx + k*w1, sy1 + h*.01); x.stroke(); }
      x.globalAlpha = 1;
      slab(base - ph, w*1.24, ph*.5); slab(base - ph*.5, w*1.44, ph*.5);
      if (broken){ x.fillStyle = lin(cx - w/2, 0, cx + w/2, 0, [[0, c.shade], [.16, c.mid], [.42, c.lit], [.66, c.mid], [1, c.shade]]);            /* snapped off: a ragged top, no capital */
        x.beginPath(); x.moveTo(cx - w1/2, sy1 + 1); x.lineTo(cx - w1*.5, sy1 - w*.2); x.lineTo(cx - w1*.2, sy1 - w*.42); x.lineTo(cx + w1*.08, sy1 - w*.16); x.lineTo(cx + w1*.32, sy1 - w*.3); x.lineTo(cx + w1/2, sy1 - w*.06); x.lineTo(cx + w1/2, sy1 + 1); x.closePath(); x.fill(); return; }
      slab(sy1 - ch*.2, w1*1.08, ch*.2);
      x.fillStyle = lin(cx - w*.7, 0, cx + w*.7, 0, [[0, c.shade], [.2, c.mid], [.45, c.lit], [.7, c.mid], [1, c.shade]]);
      x.beginPath(); x.moveTo(cx - w1*.54, sy1 - ch*.2); x.lineTo(cx - w*.68, sy1 - ch*.62); x.lineTo(cx + w*.68, sy1 - ch*.62); x.lineTo(cx + w1*.54, sy1 - ch*.2); x.closePath(); x.fill();
      slab(base - h, w*1.46, ch*.38); };
    /* a pyramid seen from a little to one side: a lit face and one in shadow, meeting on a ridge */
    const pyramid = (ax, ay, base, bw, rdg, lit, shade, edge) => {
      const xl = ax - bw, xr = ax + bw, xm = ax + rdg*bw;
      x.fillStyle = lit; x.beginPath(); x.moveTo(ax, ay); x.lineTo(xl, base); x.lineTo(xm, base); x.closePath(); x.fill();
      x.save(); x.clip(); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1; x.beginPath();
      for (let i = 1; i < 11; i++){ const y = ay + (base - ay)*i/11; x.moveTo(xl, y); x.lineTo(xr, y); } x.stroke(); x.restore();
      x.fillStyle = shade; x.beginPath(); x.moveTo(ax, ay); x.lineTo(xm, base); x.lineTo(xr, base); x.closePath(); x.fill();
      x.strokeStyle = edge; x.lineWidth = 1.2; x.beginPath(); x.moveTo(xl, base); x.lineTo(ax, ay); x.lineTo(xr, base); x.moveTo(ax, ay); x.lineTo(xm, base); x.stroke(); };
    /* a gem: an octahedron turning on its axis */
    const gem = (gx, gy, gr, a, cols, edge) => { const ca = Math.cos(a), sa = Math.sin(a);
      const P = [[0, -1.35, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, 1.35, 0]].map(p => { const X = p[0]*ca + p[2]*sa, Z = -p[0]*sa + p[2]*ca; return [gx + X*gr, gy + (p[1] + Z*.2)*gr, Z]; });
      [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]].map(fc => [fc, (P[fc[0]][2] + P[fc[1]][2] + P[fc[2]][2])/3]).sort((p, q) => p[1] - q[1]).forEach(fc => {
        x.beginPath(); x.moveTo(P[fc[0][0]][0], P[fc[0][0]][1]); x.lineTo(P[fc[0][1]][0], P[fc[0][1]][1]); x.lineTo(P[fc[0][2]][0], P[fc[0][2]][1]); x.closePath();
        x.fillStyle = cols[(fc[0][1] + fc[0][2]) % cols.length]; x.globalAlpha = fc[1] > 0 ? .96 : .5; x.fill(); x.globalAlpha = 1; x.strokeStyle = edge; x.lineWidth = 1; x.stroke(); }); };
    /* a bank of cloud along a line: lobes of different sizes, lit from above, one period drawn twice so it can drift for ever */
    const bank = (y, s, seed, shift, top, bot) => { const r = rnd(seed), P = Math.max(W, s*22), N = 15, o = -(((shift % 1) + 1) % 1)*P, L = [];
      for (let i = 0; i < N; i++){ const rr = s*(.55 + r()*.75); L.push([(i + r()*.6)/N*P, y - rr*.25 + r()*s*.3, rr]); }
      x.fillStyle = vgrad(y - s*1.7, y + s*1.5, [[0, top], [1, bot]]); x.beginPath();
      for (let k = 0; k < 3; k++) L.forEach(l => { const cx = o + k*P + l[0]; if (cx < -l[2] || cx > W + l[2]) return; x.moveTo(cx + l[2], l[1]); x.arc(cx, l[1], l[2], 0, TAU); });
      x.rect(0, y, W, H - y); x.fill(); };
    /* a block drawn obliquely: its front face stands on (px, py); its depth runs up and to the right */
    const block = (px, py, w, h, d, c) => { const ox = d*.74, oy = -d*.4;
      x.fillStyle = c.side; x.beginPath(); x.moveTo(px + w, py); x.lineTo(px + w + ox, py + oy); x.lineTo(px + w + ox, py - h + oy); x.lineTo(px + w, py - h); x.closePath(); x.fill();
      x.fillStyle = c.top; x.beginPath(); x.moveTo(px, py - h); x.lineTo(px + ox, py - h + oy); x.lineTo(px + w + ox, py - h + oy); x.lineTo(px + w, py - h); x.closePath(); x.fill();
      x.fillStyle = c.front; x.fillRect(px, py - h, w, h); };

    const S = {
      /* ── the timetable: the drive ── */
      drive(t, dk){
        const hy = Math.round(H*.57), f = H*.9, cx = W/2, R = U*.25, sy = hy - R*.5;
        const skyG = paintSky(dk ? [[0, '#07021c'], [.3, '#24094e'], [.5, '#701c84'], [.57, '#ff4f9f'], [1, '#ff4f9f']] : [[0, '#8f9cff'], [.3, '#b9a6ff'], [.5, '#ff9fd6'], [.57, '#ffdcbc'], [1, '#ffdcbc']]);
        if (dk) drawStars(t, hy*.8);
        glow(cx, sy, R*2.5, dk ? '255,90,160' : '255,255,255', dk ? .5 : .6);
        sun(cx, sy, R, dk ? '#fff27a' : '#fffbd0', dk ? '#ff8a4a' : '#ffc08a', dk ? '#ff2a8a' : '#ff7fc4', t, skyG);
        /* far hills, low in the middle so the sun stands clear, then the skyline */
        x.fillStyle = vgrad(hy - H*.16, hy, dk ? [[0, '#3b1273'], [1, '#1a0838']] : [[0, '#c9b4ff'], [1, '#e9c9f5']]);
        x.beginPath(); x.moveTo(0, hy); ridge.forEach((v, i) => { const u = i/(ridge.length - 1), side = Math.pow(Math.abs(u - .5)*2, 1.3); x.lineTo(u*W, hy - H*(.012 + side*(.05 + v*.1))); }); x.lineTo(W, hy); x.closePath(); x.fill();
        let bx = cx - W*.22; const bw = W*.44/62;
        sky.forEach((b, i) => { const w = bw*b[1]*1.2, hgt = b[0]*H*(.018 + .085*Math.exp(-Math.pow((i - 23)/10, 2)));
          x.fillStyle = dk ? '#100526' : '#a487e6'; x.fillRect(bx, hy - hgt, w + .6, hgt + 1);
          if (b[2] > .45){ x.fillStyle = dk ? '#ffd86b' : '#fff8e0'; x.globalAlpha = .75; for (let wy = hy - hgt + 3; wy < hy - 3; wy += 5) if (((i*7 + wy) | 0) % 3) x.fillRect(bx + w*.3, wy, Math.max(1.2, w*.22), 1.8); x.globalAlpha = 1; }
          bx += w; });
        /* the ground, the line of light at its edge, the road */
        x.fillStyle = vgrad(hy, H, dk ? [[0, '#4a1166'], [.22, '#16062f'], [1, '#0b0320']] : [[0, '#ffcfe6'], [.25, '#e6d2ff'], [1, '#d9c6fb']]); x.fillRect(0, hy, W, H - hy);
        x.fillStyle = dk ? 'rgba(255,170,220,.9)' : 'rgba(255,255,255,.95)'; x.fillRect(0, hy - 1, W, 2);
        const px = (X, z) => cx + X/z*f, py = (z, h) => hy + (1 - (h || 0))/z*f, FAR = 34, ZS = 1.5;
        x.fillStyle = dk ? '#090217' : '#c8b0f2'; x.beginPath(); x.moveTo(px(-1.3, FAR), py(FAR)); x.lineTo(px(1.3, FAR), py(FAR)); x.lineTo(px(1.3, .8), py(.8)); x.lineTo(px(-1.3, .8), py(.8)); x.closePath(); x.fill();
        [[6, .18], [2, .95]].forEach(l => { x.strokeStyle = dk ? 'rgba(1,205,254,' + l[1] + ')' : 'rgba(255,255,255,' + l[1] + ')'; x.lineWidth = l[0]; x.beginPath(); [-1.3, 1.3].forEach(X => { x.moveTo(px(X, FAR), py(FAR)); x.lineTo(px(X, .8), py(.8)); }); x.stroke(); });
        x.fillStyle = dk ? 'rgba(255,214,235,.6)' : 'rgba(255,255,255,.85)'; const dz = (t*2) % 3;
        for (let z = 3 - dz + .4; z < 28; z += 3){ const z2 = z + 1.1, w1 = .045/z*f, w2 = .045/z2*f;
          x.beginPath(); x.moveTo(px(0, z) - w1, py(z)); x.lineTo(px(0, z) + w1, py(z)); x.lineTo(px(0, z2) + w2, py(z2)); x.lineTo(px(0, z2) - w2, py(z2)); x.closePath(); x.fill(); }
        /* the hills beside the road: a mesh whose rows come toward us, each face lit by how it stands to the sun */
        const adv = t*2/ZS, base = Math.floor(adv), frac = adv - base, NJ = 8, DX = 1.25;
        const hgt = (j, row) => j === 0 ? 0 : (.1 + 1.45*hash(j*31 + 7, row))*Math.min(1, j/2.2)*(1 + j*.16);
        const lo = dk ? [15, 5, 38] : [214, 196, 250], hi = dk ? [104, 34, 140] : [255, 244, 255];
        x.lineWidth = 1; x.lineJoin = 'round';
        const tri = (a, b, c, side) => {                      /* a, b, c: [X, height, z] */
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; if (ny < 0){ nx = -nx; ny = -ny; nz = -nz; }
          const l = Math.max(0, (-side*.3*nx + .5*ny + .82*nz)/(Math.hypot(nx, ny, nz) || 1));
          x.beginPath(); x.moveTo(px(a[0], a[2]), py(a[2], a[1])); x.lineTo(px(b[0], b[2]), py(b[2], b[1])); x.lineTo(px(c[0], c[2]), py(c[2], c[1])); x.closePath();
          x.fillStyle = mix(lo, hi, Math.pow(l, .8)); x.fill(); x.stroke(); };
        /* rows come in faded at the far end and go out faded as they pass the camera (no popping at either end) */
        for (let k = Math.ceil(FAR/ZS); k >= 0; k--){ const zn = (k - frac)*ZS + .7, zf = zn + ZS; if (zn < .2) continue;
          x.globalAlpha = Math.max(0, Math.min(1, (FAR - zn)/9, (zn - .2)/.75));
          for (const side of [-1, 1]){
            x.strokeStyle = dk ? (side < 0 ? 'rgba(255,113,206,.7)' : 'rgba(1,205,254,.7)') : (side < 0 ? 'rgba(255,127,202,.75)' : 'rgba(88,200,240,.8)');
            for (let j = NJ - 1; j >= 0; j--){ const X0 = side*(1.5 + j*DX), X1 = side*(1.5 + (j + 1)*DX), rn = base + k, rf = rn + 1;
              const A = [X0, hgt(j, rn), zn], B = [X1, hgt(j + 1, rn), zn], C = [X1, hgt(j + 1, rf), zf], D = [X0, hgt(j, rf), zf];
              tri(A, B, C, side); tri(A, C, D, side); } } }
        x.globalAlpha = 1;
      },
      /* ── home: ruins in still water under a great moon ── */
      ruins(t, dk){
        const hy = Math.round(H*.63), mx = W*.8, my = H*.2, R = U*.15;
        paintSky(dk ? [[0, '#070220'], [.3, '#200a52'], [.52, '#6a1f8c'], [.63, '#ff5aa6'], [1, '#ff5aa6']] : [[0, '#8fb4ff'], [.3, '#bcb0ff'], [.52, '#ffb5df'], [.63, '#ffe3cc'], [1, '#ffe3cc']]);
        if (dk) drawStars(t, hy*.85);
        glow(mx, my, R*3.2, dk ? '255,180,230' : '255,255,255', dk ? .42 : .7);
        x.fillStyle = lin(mx - R, my - R, mx + R, my + R, dk ? [[0, '#fffbe8'], [.6, '#ffd3ec'], [1, '#ff9fd8']] : [[0, '#ffffff'], [.6, '#fff4d8'], [1, '#ffd9b0']]); x.beginPath(); x.arc(mx, my, R, 0, TAU); x.fill();
        /* thin cloud across the moon and along the horizon */
        x.fillStyle = dk ? 'rgba(58,18,110,.55)' : 'rgba(201,182,255,.6)';
        [[-.2, .28, 1.9, .07], [.5, .55, 1.5, .055], [-1.3, .72, 1.7, .05]].forEach(c => { const cw = R*c[2], ch = R*c[3], cx2 = mx + R*c[0] + Math.sin(t*.05 + c[1]*9)*R*.3, cy2 = my + R*(c[1] - .2);
          x.beginPath(); x.moveTo(cx2 - cw, cy2); x.lineTo(cx2 + cw, cy2); x.arc(cx2 + cw, cy2 + ch, ch, -TAU/4, TAU/4); x.lineTo(cx2 - cw, cy2 + ch*2); x.arc(cx2 - cw, cy2 + ch, ch, TAU/4, TAU*.75); x.fill(); });
        /* far shores */
        x.fillStyle = dk ? '#2a0d5c' : '#c6b0fa';
        x.beginPath(); x.moveTo(0, hy); ridge.forEach((v, i) => { const u = i/(ridge.length - 1); x.lineTo(u*W, hy - H*(.008 + .05*v*(.35 + Math.abs(u - .45)))); }); x.lineTo(W, hy); x.closePath(); x.fill();
        /* the water, with the moon lying on it in broken lines */
        x.fillStyle = vgrad(hy, H, dk ? [[0, '#ff5aa6'], [.1, '#7a2496'], [.45, '#22093f'], [1, '#0d0322']] : [[0, '#ffe3cc'], [.12, '#ffc4e4'], [.5, '#c9bcff'], [1, '#a9b6ff']]); x.fillRect(0, hy, W, H - hy);
        x.fillStyle = dk ? '#ffe9f6' : '#ffffff';
        for (let i = 0; i < 20; i++){ const u = i/20, y = hy + 3 + Math.pow(u, 1.6)*(H - hy)*.9, w = R*(.9 - .45*u)*(.7 + .3*Math.sin(t*.7 + i*2.3));
          x.globalAlpha = (dk ? .55 : .85)*(1 - u*.8); x.fillRect(mx - w/2 + Math.sin(t*.45 + i*1.7)*R*.1, y, w, 1.4 + u*U*.005); }
        x.globalAlpha = 1;
        /* the columns: a far pair and a near pair, each with what the water returns of it */
        const c = dk ? { lit:'#f6ecff', mid:'#b89be6', shade:'#573a98' } : { lit:'#ffffff', mid:'#e7dbff', shade:'#a691de' };
        const wat = dk ? 'rgba(34,9,63,.72)' : 'rgba(201,188,255,.7)';
        [[.165, .74, .034, .42], [.835, .74, .034, .42], [.07, .9, .058, .7], [.93, .9, .058, .52]].forEach((p, i) => {
          const cx = p[0]*W, base = p[1]*H, w = p[2]*U*1.25, h = p[3]*U;
          x.save(); x.beginPath(); x.rect(0, base, W, H - base); x.clip(); x.translate(0, 2*base); x.scale(1, -1); x.globalAlpha = .34; column(cx, base, w, h, c, i === 3); x.restore();
          x.fillStyle = wat; for (let k = 0; k < 9; k++){ const yy = base + 5 + k*k*U*.0042; x.fillRect(cx - w*1.1 + Math.sin(t*.6 + k*1.9 + i)*w*.12, yy, w*2.2, 1.2 + k*.55); }
          column(cx, base, w, h, c, i === 3);                                  /* the near right one is broken off */
        });
        drawSparks(t, '#fff');
      },
      /* ── calendar, notes: pyramids ── */
      pyramids(t, dk){
        const hy = Math.round(H*.68);
        paintSky(dk ? [[0, '#08021f'], [.35, '#260a58'], [.58, '#7a2090'], [.68, '#ff6aa8'], [1, '#ff6aa8']] : [[0, '#93b8ff'], [.35, '#c3b2ff'], [.58, '#ffb8de'], [.68, '#ffe6c8'], [1, '#ffe6c8']]);
        if (dk) drawStars(t, hy*.85);
        /* a crescent */
        const mx = W*.13, my = H*.2, mr = U*.075;
        glow(mx, my, mr*3.4, dk ? '255,236,170' : '255,255,255', dk ? .3 : .6);
        x.save(); x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.clip(); x.fillStyle = dk ? '#fff3c4' : '#ffffff';
        x.beginPath(); x.rect(mx - mr*2, my - mr*2, mr*4, mr*4); x.arc(mx + mr*.46, my - mr*.14, mr*.9, 0, TAU); x.fill('evenodd'); x.restore();
        /* the ground, ruled toward the horizon */
        x.fillStyle = vgrad(hy, H, dk ? [[0, '#5a1676'], [.25, '#1c0838'], [1, '#0c0322']] : [[0, '#ffd3e6'], [.3, '#e3d0ff'], [1, '#cdbdfa']]); x.fillRect(0, hy, W, H - hy);
        gridFloor(hy, dk ? 'rgba(255,113,206,.34)' : 'rgba(255,255,255,.75)', t, .12);
        x.fillStyle = dk ? 'rgba(255,170,220,.85)' : 'rgba(255,255,255,.95)'; x.fillRect(0, hy - 1, W, 2);
        const lit = (y0, y1) => vgrad(y0, y1, dk ? [[0, '#ffb3ea'], [1, '#8a2fb4']] : [[0, '#ffffff'], [1, '#ffc9ea']]);
        const shd = (y0, y1) => vgrad(y0, y1, dk ? [[0, '#5a1e9a'], [1, '#1a0840']] : [[0, '#cdb4ff'], [1, '#a98ae8']]);
        const edge = dk ? 'rgba(255,220,245,.8)' : 'rgba(255,255,255,.95)';
        const P = [[.5, .1, .06, .3], [.13, .19, .15, -.35], [.87, .36, .25, -.3]];         /* centre x, height, half-width, ridge: far to near */
        P.forEach(p => { const ax = p[0]*W, ay = hy - p[1]*U, bw = p[2]*U*1.9;
          x.fillStyle = 'rgba(12,2,34,' + (dk ? .4 : .14) + ')'; x.beginPath(); x.moveTo(ax - bw, hy); x.lineTo(ax + bw, hy); x.lineTo(ax + bw*.2, hy + p[1]*U*.5); x.lineTo(ax - bw*1.5, hy + p[1]*U*.5); x.closePath(); x.fill();
          pyramid(ax, ay, hy, bw, p[3], lit(ay, hy), shd(ay, hy), edge); });
        /* a gem hanging over the tallest */
        const gx = W*.87, gy = hy - .36*U - U*.09 + Math.sin(t*.5)*U*.008;
        glow(gx, gy, U*.13, dk ? '255,251,150' : '255,255,255', dk ? .45 : .7);
        gem(gx, gy, U*.034, t*.3, ['#fffb96', '#ff71ce', '#01cdfe', '#b967ff'], 'rgba(255,255,255,.85)');
        drawSparks(t, '#fff');
      },
      /* ── games, finder: planets ── */
      planets(t, dk){
        const hy = Math.round(H*.8), cx = W*.68, cy = H*.34, R = H*.2;
        paintSky(dk ? [[0, '#07021c'], [.6, '#2a0a5c'], [1, '#5a1478']] : [[0, '#b9a8ff'], [.6, '#f1b8ee'], [1, '#ffd7c2']]);
        drawStars(t, H*.8);
        const ring = front => { x.save(); x.translate(cx, cy); x.rotate(-.32); x.scale(1, .26);
          [[2.15, 9, dk ? '#ff71ce' : '#ff9ad5'], [1.82, 7, dk ? '#ffe66d' : '#fff3a8'], [1.56, 4, dk ? '#ff71ce' : '#ffffff']].forEach(r => { x.strokeStyle = r[2]; x.lineWidth = R*r[1]/100/.26;
            x.beginPath(); x.arc(0, 0, R*r[0], front ? 0 : Math.PI, front ? Math.PI : TAU); x.stroke(); }); x.restore(); };
        ring(false);
        ball(cx, cy, R, dk ? '#fff08a' : '#fff6c8', dk ? '#ff8a2a' : '#ffb07a');
        x.fillStyle = dk ? '#ff5fbf' : '#ff9ad5'; [[-.35, -.2, .2], [.3, .28, .13], [.08, -.5, .09]].forEach(s => { x.beginPath(); x.arc(cx + s[0]*R, cy + s[1]*R, s[2]*R, 0, TAU); x.fill(); });
        ring(true);
        ball(W*.16, H*.2 + Math.sin(t*.4)*H*.01, H*.045, dk ? '#9ff3ff' : '#d8fbff', dk ? '#1d7fd0' : '#6fbdf0');
        ball(W*.3, H*.56 + Math.sin(t*.33 + 2)*H*.012, H*.028, dk ? '#ffb3f1' : '#ffd3f6', dk ? '#b01fc0' : '#e07be6');
        gem(W*.12, H*.62, H*.075, t*.35, ['#ff71ce', '#b967ff', '#01cdfe', '#fffb96'], 'rgba(255,255,255,.8)');
        x.strokeStyle = dk ? 'rgba(255,113,206,.5)' : 'rgba(255,255,255,.8)'; x.lineWidth = 1; x.beginPath();
        for (let i = -16; i <= 16; i++){ x.moveTo(W/2 + i*10, hy); x.lineTo(W/2 + i*W/8, H); }
        const zo = (t*.25) % 1; for (let i = 1; i < 9; i++){ const z = i - zo; if (z < .7) continue; const y = hy + (H - hy)/z; x.moveTo(0, y); x.lineTo(W, y); }
        x.moveTo(0, hy); x.lineTo(W, hy); x.stroke();
        drawSparks(t, '#fff');
      },
      /* ── free periods, revision: steps in the air above the clouds, up to a lit doorway ── */
      stairs(t, dk){
        paintSky(dk ? [[0, '#0a0330'], [.4, '#34107a'], [.72, '#a23aa4'], [1, '#ff8fbc']] : [[0, '#7fc0ff'], [.4, '#b6bcff'], [.72, '#ffc4e6'], [1, '#fff0d8']]);
        if (dk) drawStars(t, H*.6);
        /* the far cloud, then the doorway and its light, the steps, and the near cloud over their feet */
        bank(H*.7, U*.05, 11, t*.004, dk ? '#c98be6' : '#ffffff', dk ? '#6a2a9e' : '#e3d4ff');
        const ax = W*.905, ay = H*.4, aw = U*.13, ah = U*.2, col = dk ? { top:'#f7edff', front:'#c5a4f2', side:'#7447b8' } : { top:'#ffffff', front:'#efdfff', side:'#c0a6ee' };
        glow(ax, ay - ah*.55, U*.42, dk ? '255,236,150' : '255,255,255', dk ? .5 : .75);
        const arch = (w, h, inset) => { const r = w/2 - inset; x.beginPath(); x.moveTo(ax - r, ay); x.lineTo(ax - r, ay - h + w/2); x.arc(ax, ay - h + w/2, r, Math.PI, TAU); x.lineTo(ax + r, ay); x.closePath(); };
        block(ax - aw*.8 - U*.037, ay + U*.04, aw*1.6, U*.02, U*.1, col);
        x.fillStyle = lin(ax - aw/2, 0, ax + aw/2, 0, [[0, col.side], [.3, col.top], [.7, col.front], [1, col.side]]); arch(aw, ah, 0); x.fill();
        x.fillStyle = vgrad(ay - ah, ay, dk ? [[0, '#fffbe0'], [.55, '#ffd27a'], [1, '#ff7ab8']] : [[0, '#ffffff'], [.55, '#fff3c4'], [1, '#ffc0dc']]); arch(aw, ah, aw*.17); x.fill();
        for (let i = 5; i >= 0; i--){ const k = 1 + (5 - i)*.07, sw = U*.15*k, bob = Math.sin(t*.5 + i*.9)*U*.004;
          block(ax - aw*.62 - (5 - i)*U*.03 - sw*.5 + U*.02, ay + U*.11 + (5 - i)*U*.066 + bob, sw, U*.018, U*.075, col); }
        bank(H*.86, U*.085, 23, t*.007, dk ? '#e3a9f2' : '#ffffff', dk ? '#7c34ac' : '#ead9ff');
        bank(H*.97, U*.12, 37, t*.012, dk ? '#f3c9fb' : '#ffffff', dk ? '#9a48bd' : '#f3e6ff');
        ball(W*.09, H*.3 + Math.sin(t*.4)*U*.012, U*.05, dk ? '#ffd0f6' : '#ffe2fa', dk ? '#c33bd6' : '#e58cf0', dk ? '#5a0f88' : '#c468e0');
        ball(W*.16, H*.47 + Math.sin(t*.33 + 2)*U*.01, U*.024, dk ? '#b6f6ff' : '#e0fcff', dk ? '#1f8fe0' : '#79c4f2', dk ? '#0b3f8c' : '#4ea0e0');
        drawSparks(t, '#fff');
      },
      /* ── resources, mahjong: three solids over a chequered floor ── */
      solids(t, dk){
        const hy = Math.round(H*.62), f = H*.5;
        paintSky(dk ? [[0, '#08021f'], [.34, '#280a5a'], [.54, '#7a2090'], [.62, '#ff6fb4'], [1, '#ff6fb4']] : [[0, '#8fd0ff'], [.34, '#bcbaff'], [.54, '#ffbfe2'], [.62, '#ffe8d2'], [1, '#ffe8d2']]);
        if (dk) drawStars(t, hy*.85);
        checker(hy, W/2, f, dk ? '#190736' : '#ffffff', dk ? '#c63f9c' : '#ffb2de', 0);
        x.fillStyle = vgrad(hy, hy + (H - hy)*.55, dk ? [[0, 'rgba(255,111,180,.9)'], [1, 'rgba(26,8,56,0)']] : [[0, 'rgba(255,232,210,.95)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, hy, W, (H - hy)*.55);
        x.fillStyle = vgrad(hy, H, dk ? [[0, 'rgba(10,2,30,0)'], [1, 'rgba(10,2,30,.5)']] : [[0, 'rgba(255,255,255,0)'], [1, 'rgba(214,196,250,.45)']]); x.fillRect(0, hy, W, H - hy);      /* and it quietens toward us */
        /* a cone standing on the floor */
        const kx = W*.9, kb = H*.83, kw = U*.085, kh = U*.24;
        shadow(kx + kw*.5, kb + kw*.1, kw*1.5, kw*.34, dk ? .5 : .2);
        x.fillStyle = lin(kx - kw, 0, kx + kw, 0, dk ? [[0, '#fffbb0'], [.4, '#ffcf6a'], [1, '#e0582e']] : [[0, '#fffde0'], [.4, '#ffe9a6'], [1, '#ffb27c']]);
        x.beginPath(); x.moveTo(kx, kb - kh); x.lineTo(kx - kw, kb); x.ellipse(kx, kb, kw, kw*.26, 0, Math.PI, 0, true); x.closePath(); x.fill();
        /* a ball above it, and its shadow */
        const by = H*.3 + Math.sin(t*.45)*U*.012;
        ball(W*.84, by, U*.052, dk ? '#c8f8ff' : '#e6fdff', dk ? '#17a3e6' : '#7fcdf5', dk ? '#0a3a90' : '#4a9be0');
        /* a cube, turning in the air */
        const qx = W*.095, qy = H*.4 + Math.sin(t*.38 + 1)*U*.012, qs = U*.062, a = t*.22, ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(.52), st = Math.sin(.52);
        shadow(qx, H*.86, qs*1.5, qs*.36, dk ? .4 : .16);
        const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(p => { const X = p[0]*ca + p[2]*sa, Z0 = -p[0]*sa + p[2]*ca, Y = p[1]*ct - Z0*st, Z = p[1]*st + Z0*ct; return [qx + X*qs, qy + Y*qs, Z]; });
        const Nf = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]], F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]];
        const qlo = dk ? [74, 22, 140] : [190, 160, 240], qhi = dk ? [255, 150, 226] : [255, 240, 252];
        F.forEach((fc, i) => { const n = Nf[i], nx = n[0]*ca + n[2]*sa, nz0 = -n[0]*sa + n[2]*ca, ny = n[1]*ct - nz0*st, nz = n[1]*st + nz0*ct; if (nz >= 0) return;      /* faces turned away are not drawn */
          const l = Math.max(0, -.45*nx - .75*ny - .5*nz);
          x.fillStyle = mix(qlo, qhi, Math.min(1, l)); x.beginPath(); x.moveTo(V[fc[0]][0], V[fc[0]][1]); for (let k = 1; k < 4; k++) x.lineTo(V[fc[k]][0], V[fc[k]][1]); x.closePath(); x.fill();
          x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1; x.stroke(); });
        drawSparks(t, '#fff');
      }
    };
    return {
      frame(t){ x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; S[scene](t, e.dark); },
      resize(w, h){ W = w; H = h; U = Math.min(H, W*.72); },
      env(n){ e = n; },
      dispose(){}
    };
  }
};

/* ═══════════════════════════════════════════════════════════════════
   The reworked Vaporwave (moderators only for now; see NEXT above).

   One world, rendered offline with real materials and light (the Poly
   Haven CRT television and marble; the columns, steps and solids were
   modelled for it; the heads are museum photographs, CC0) and
   shown here as pictures, over a real sky (a Poly Haven photograph,
   tinted pastel) that drifts very slowly. Light mode: pastel daylight.
   Dark: the same places at a pastel twilight. What there is to see
   stands out at the sides of the page's column (measured, not guessed);
   a phone gets the whole picture framed for a tall screen. Drawn here in
   code: only the soft sun and the haze at the horizon. (The Windows 95
   windows are the visitors, further down: real windows, not pictures.)

     page               scene    rendered
     timetable          tt       a great marble head (a photograph) on the floor, looking into the page, against the sun;
                                 pale palms (photographed, drawn as silhouettes); the word 時間割 in the other margin
     calendar           cal      a television alone on the floor, showing light; the sun
     notes              notes    the same floor; a photograph of a head in a paint program's window
     home               home     two columns standing in still water, a great pale moon
     games, finder      planets  a ringed planet and its moon
     free, revision     stairs   steps in the open sky, over a floor of cloud, to a lit doorway
     resources, mahjong solids   a glossy ball and a glass pyramid on a chequered floor
   One to three things a page.
   Motion, barely: the sky drifting, the sun's haze breathing, a floating
   thing bobbing. With Animation off, one still frame.
   ═══════════════════════════════════════════════════════════════════ */
const PAGE_N = { timetable:'tt', home:'home', calendar:'cal', notes:'notes', games:'planets', finder:'planets',
                 free:'stairs', revision:'stairs', resources:'solids', mahjong:'solids' };
/* each scene's pictures: the plate's size and horizon; each piece's crop (x, y, w, h) and its foot or centre (ax, ay), in plate pixels, light and dark */
const META = /*META*/{"cal":{"d":{"phone":{"W":900,"H":1600,"hy":0.62},"plate":{"W":2880,"H":1200,"hy":0.62},"platew":{"W":5280,"H":1200,"hy":0.62},"right":{"W":2880,"H":1200,"hy":0.62,"x":1056,"y":704,"w":1824,"h":496,"ax":2448,"ay":1080}},"l":{"phone":{"W":900,"H":1600,"hy":0.62},"plate":{"W":2880,"H":1200,"hy":0.62},"platew":{"W":5280,"H":1200,"hy":0.62},"right":{"W":2880,"H":1200,"hy":0.62,"x":1454,"y":704,"w":1426,"h":496,"ax":2448,"ay":1080}}},"home":{"d":{"left":{"W":2880,"H":1200,"hy":0.63,"x":0,"y":198,"w":2852,"h":1002,"ax":346,"ay":1116},"phone":{"W":900,"H":1600,"hy":0.63},"plate":{"W":2880,"H":1200,"hy":0.63},"platew":{"W":5280,"H":1200,"hy":0.63},"right":{"W":2880,"H":1200,"hy":0.63,"x":1350,"y":464,"w":1530,"h":736,"ax":2534,"ay":1116}},"l":{"left":{"W":2880,"H":1200,"hy":0.63,"x":0,"y":198,"w":2169,"h":1002,"ax":346,"ay":1116},"phone":{"W":900,"H":1600,"hy":0.63},"plate":{"W":2880,"H":1200,"hy":0.63},"platew":{"W":5280,"H":1200,"hy":0.63},"right":{"W":2880,"H":1200,"hy":0.63,"x":1352,"y":464,"w":1528,"h":736,"ax":2534,"ay":1116}}},"notes":{"d":{"phone":{"W":900,"H":1600,"hy":0.62}},"l":{"phone":{"W":900,"H":1600,"hy":0.62}}},"planets":{"d":{"moon":{"W":2880,"H":1200,"hy":0.8,"x":366,"y":197,"w":188,"h":181,"ax":461,"ay":288},"phone":{"W":900,"H":1600,"hy":0.8},"planet":{"W":2880,"H":1200,"hy":0.8,"x":1426,"y":145,"w":1089,"h":524,"ax":1958,"ay":408},"plate":{"W":2880,"H":1200,"hy":0.8},"platew":{"W":5280,"H":1200,"hy":0.8}},"l":{"moon":{"W":2880,"H":1200,"hy":0.8,"x":366,"y":197,"w":188,"h":181,"ax":461,"ay":288},"phone":{"W":900,"H":1600,"hy":0.8},"planet":{"W":2880,"H":1200,"hy":0.8,"x":1426,"y":145,"w":1089,"h":524,"ax":1958,"ay":408},"plate":{"W":2880,"H":1200,"hy":0.8},"platew":{"W":5280,"H":1200,"hy":0.8}}},"solids":{"d":{"left":{"W":2880,"H":1200,"hy":0.62,"x":0,"y":763,"w":1887,"h":437,"ax":346,"ay":1080},"phone":{"W":900,"H":1600,"hy":0.62},"plate":{"W":2880,"H":1200,"hy":0.62},"platew":{"W":5280,"H":1200,"hy":0.62},"right":{"W":2880,"H":1200,"hy":0.62,"x":1731,"y":732,"w":1149,"h":468,"ax":2534,"ay":1080}},"l":{"left":{"W":2880,"H":1200,"hy":0.62,"x":0,"y":763,"w":1570,"h":437,"ax":346,"ay":1080},"phone":{"W":900,"H":1600,"hy":0.62},"plate":{"W":2880,"H":1200,"hy":0.62},"platew":{"W":5280,"H":1200,"hy":0.62},"right":{"W":2880,"H":1200,"hy":0.62,"x":1780,"y":732,"w":1100,"h":468,"ax":2534,"ay":1080}}},"stairs":{"d":{"phone":{"W":900,"H":1600,"hy":0.7},"plate":{"W":2880,"H":1200,"hy":0.7},"right":{"W":2880,"H":1200,"hy":0.7,"x":1788,"y":321,"w":772,"h":879,"ax":2477,"ay":1080}},"l":{"phone":{"W":900,"H":1600,"hy":0.7},"plate":{"W":2880,"H":1200,"hy":0.7},"right":{"W":2880,"H":1200,"hy":0.7,"x":1788,"y":321,"w":772,"h":879,"ax":2477,"ay":1080}}},"tt":{"d":{"left":{"W":2880,"H":1200,"hy":0.6,"x":0,"y":582,"w":1641,"h":618,"ax":490,"ay":912},"phone":{"W":900,"H":1600,"hy":0.6},"plate":{"W":2880,"H":1200,"hy":0.6},"platew":{"W":5280,"H":1200,"hy":0.6}},"l":{"left":{"W":2880,"H":1200,"hy":0.6,"x":0,"y":582,"w":1336,"h":618,"ax":490,"ay":912},"phone":{"W":900,"H":1600,"hy":0.6},"plate":{"W":2880,"H":1200,"hy":0.6},"platew":{"W":5280,"H":1200,"hy":0.6}}}};
/* the scenes' own arrangements: where the sun is; the side the scene fills (busy: the visitors keep to the other); a floor or a picture borrowed
   (base: another scene's plate; panel: a picture laid in the left margin); floating things (each bobs), by the group they belong to or a fraction of the width */
/* kw: about how wide each group's own thing is (not its shadow), as a fraction of the screen's height, so the visitors can keep off it.
   A floating thing's place: a fraction of the width, a group's name, or { s, dx, dy }: the margin (0 left, 1 right) and a nudge from its middle. */
const ARR = {
  tt:     { sun:'l', busy:'l', floats:[], kw:{ left:.2 } },     /* palms were here, out for now (the owner found them too much): palms:[{ n:'venice', s:'l', dx:-.1, h:.95 }, { n:'canary', s:'r', dx:.06, h:.6, flip:true }] */
  cal:    { sun:'r', busy:'r', floats:[], kw:{ right:.3 } },
  notes:  { sun:'r', busy:'r', base:'cal', panel:'paint', panelSide:'r', floats:[] },
  home:   { moon:true, floats:[], kw:{ left:.16, right:.14 }, nudge:{ right:.09 } },      /* nudge: a group moved over a little (of the screen's height) where its margin is the big one, to leave the word room */
  stairs: { busy:'r', cloudFloor:true, floats:[], kw:{ right:.42 } },
  planets:{ busy:'r', floats:[['moon', { s:1, dx:.2, dy:-.13 }, 12], ['planet', { s:1, dx:0 }, 0]] },
  solids: { busy:'r', floats:[], kw:{ left:.17, right:.24 } }
};
const IMV = FX.V ? '?v=' + FX.V : '';
const IM = {};
const pic = n => IM[n] || (IM[n] = (() => {
  const i = new Image(); i.decoding = 'async';
  i.onload = i.onerror = () => { gen++; if (FX.refresh) FX.refresh(); };       /* with Animation off nothing else would draw it */
  i.src = '/images/th/' + n + '.webp' + IMV; return i;
})());
let gen = 0;
const ok = i => !!(i && i.complete && i.naturalWidth > 0);
const rgba = (rgb, a) => 'rgba(' + rgb + ',' + a + ')';
const canvas2 = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; };

/* the student's first name the DOS way (upper case, eight letters at most, else six and ~1), for the Explorer window.
   Read from what Home greets you with; only ever drawn here, never kept or sent anywhere. */
const dosName = () => {
  try {
    const T = window.TT; if (!T || !T.signedIn || !T.signedIn() || !T.get) return 'USER';
    const c = T.get('tt.cache', null), cr = T.get('tt.creds', null), u = v => String(v || '').toLowerCase().split('@')[0];
    if (!c || !c.payload || !cr || !cr.email || u(c.email) !== u(cr.email)) return 'USER';
    const n = String((c.payload.profile || {}).firstname || '').normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return !n ? 'USER' : n.length > 8 ? n.slice(0, 6) + '~1' : n;
  } catch { return 'USER'; }
};

/* the view in the Sunrise window: a sun over the sea (at dusk, the same sun going down) */
const view95 = (g, vx, vy, vw, vh, dk) => {
  g.save(); g.beginPath(); g.rect(vx, vy, vw, vh); g.clip();
  const hz = vy + vh*.6, sx = vx + vw*.5, sy = hz - vh*.15, r = vw*.15;
  let gr = g.createLinearGradient(0, vy, 0, hz); (dk ? [[0, '#8c79b9'], [.55, '#d79bc2'], [1, '#ffc2c4']] : [[0, '#f0a4dc'], [.6, '#fac5e4'], [1, '#ffe1e8']]).forEach(s => gr.addColorStop(s[0], s[1]));
  g.fillStyle = gr; g.fillRect(vx, vy, vw, hz - vy);
  const rr = rnd(5);
  for (let i = 0; i < 5; i++){ const cx = vx + vw*(.1 + .8*rr()), cy = vy + vh*(.12 + .3*rr()), w = vw*(.12 + .14*rr()), h = vh*(.035 + .03*rr());
    g.save(); g.translate(cx, cy); g.scale(w/h, 1); const cg = g.createRadialGradient(0, 0, 0, 0, 0, h); cg.addColorStop(0, 'rgba(255,255,255,' + (dk ? .35 : .62) + ')'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, h, 0, TAU); g.fill(); g.restore(); }
  gr = g.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, dk ? '#ffa686' : '#ffa392'); gr.addColorStop(.78, dk ? '#ff8a8e' : '#ff8996'); gr.addColorStop(1, 'rgba(255,137,150,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
  gr = g.createLinearGradient(0, hz, 0, vy + vh); (dk ? [[0, '#c99ac6'], [.45, '#8f86c2'], [1, '#6587b8']] : [[0, '#f2c4ea'], [.45, '#c9bdf2'], [1, '#a2d6f5']]).forEach(s => gr.addColorStop(s[0], s[1]));
  g.fillStyle = gr; g.fillRect(vx, hz, vw, vy + vh - hz);
  g.fillStyle = dk ? '#ffc0b0' : '#ffb7c0';
  for (let i = 0; i < 9; i++){ const u = i/9, y = hz + 1.5 + u*u*vh*.36, w = r*(1.5 - .9*u); g.globalAlpha = .7*(1 - u*.7); g.fillRect(sx - w/2 + Math.sin(i*2.1)*r*.08, y, w, Math.max(1, vh*.008*(1 + u*2))); }
  g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(vx, hz, vw, Math.max(1, vh*.004));
  g.restore(); };
function makeNext(canvas, env){
  const x = canvas.getContext('2d'); if (!x) return null;
  const page = env.page, scene = PAGE_N[page] || 'stairs', A = ARR[scene], PL = PAGE_LAY[page] || {};
  let e = env, W = canvas.width, H = canvas.height, U = Math.min(H, W*.72);
  const r0 = rnd(91), stars = Array.from({ length:70 }, () => [r0(), r0(), .3 + r0()*.7, r0()*TAU, r0()]);

  /* ── where the page's column is (canvas px) ── */
  let col = null, colAt = -1e9;
  const measure = () => {
    const cw = canvas.clientWidth || innerWidth, s = W/cw, w = document.querySelector('.wrap');
    let l, r;
    if (w && w.offsetWidth){ const b = w.getBoundingClientRect(); l = b.left; r = b.right; }
    else { const mw = Math.min(cw, scene === 'tt' ? 1440 : 1040); l = (cw - mw)/2; r = cw - l; }
    return { l:Math.max(0, l*s), r:Math.min(W, r*s) };
  };
  const recheck = () => { const m = measure(); if (!col || Math.abs(m.l - col.l) > 2 || Math.abs(m.r - col.r) > 2){ col = null; if (FX.refresh) FX.refresh(); } };
  if (document.readyState !== 'complete') addEventListener('load', recheck, { once:true });
  const rt = [setTimeout(recheck, 1400), setTimeout(recheck, 4000)];
  const px = () => W/(canvas.clientWidth || innerWidth);

  /* ── the pictures ── */
  const tall = () => H > W*1.42;
  const src = p => (p === 'plate' || p === 'platew') && A.base ? A.base : scene;
  const piece = (p, dk) => pic('vw-' + src(p) + '-' + p + '-' + (dk ? 'd' : 'l'));
  const meta = (p, dk) => ((META[src(p)] || {})[dk ? 'd' : 'l'] || {})[p];

  /* ── the sky: the photograph, drifting; under it, a gradient for until it arrives ── */
  const SKY = dk => dk ? [[0, '#26425c'], [.42, '#46528a'], [.76, '#8a78ad'], [1, '#d9a0bd']] : [[0, '#80d9f5'], [.42, '#a9cbf7'], [.74, '#d2baf2'], [1, '#ffc2dd']];
  const HAZE = dk => dk ? '217,160,189' : '255,194,221';
  /* The photograph is scaled once to the size it's shown at, and moved a whole pixel at a time: drawn afresh at a new fraction of a
     pixel every frame, its grain shimmered (a faint crawling noise over the whole sky, plainest on a big screen). */
  let skyCv = null, skyKey = '';
  const skyAt = (im, sh, dk) => { const sw = Math.round(im.naturalWidth*sh/im.naturalHeight), k = [sw, sh, dk, gen].join();
    if (sw*sh > 9e6) return null;                              /* too big to keep a copy of: drawn straight from the photograph */
    if (k !== skyKey || !skyCv){ skyKey = k; skyCv = skyCv || canvas2(2, 2); skyCv.width = sw; skyCv.height = sh; const g = skyCv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, sw, sh); }
    return skyCv; };
  const skyBand = (hy, dk, t, flip) => {
    const g = x.createLinearGradient(0, 0, 0, hy); SKY(dk).forEach(s => g.addColorStop(s[0], s[1]));
    if (!flip){ x.fillStyle = g; x.fillRect(0, 0, W, H); }
    const im = pic('vw-sky-' + (dk ? 'd' : 'l')); if (!ok(im)) return;
    const sh = Math.round(hy) + 2, cv = skyAt(im, sh, dk), sw = cv ? cv.width : Math.round(im.naturalWidth*sh/im.naturalHeight), off = Math.round(((t*U*.0014) % sw + sw) % sw);
    x.save(); if (flip){ x.translate(0, 2*Math.round(hy)); x.scale(1, -1); }
    for (let px0 = -off; px0 < W; px0 += sw){ if (cv) x.drawImage(cv, px0, 0); else x.drawImage(im, px0, 0, sw, sh); }
    x.restore(); };
  const softStars = (t, maxY) => { x.fillStyle = '#fff';
    stars.forEach(s => { x.globalAlpha = .4*s[2]*(.7 + .3*Math.sin(t*.45 + s[3]))*Math.min(1, (1 - s[1])*2); x.beginPath(); x.arc(s[0]*W, s[1]*maxY, U*.001*(1 + s[4]), 0, TAU); x.fill(); });
    x.globalAlpha = 1; };
  /* a big soft sun (or moon), made once at each size; a haze about it that breathes */
  const discs = new Map();
  const disc = (R, top, bot) => { const k = Math.round(R) + top + bot; if (discs.has(k)) return discs.get(k);
    const S = Math.ceil(R*2) + 4, cv = canvas2(S, S), g = cv.getContext('2d'), m = S/2;
    const lg = g.createLinearGradient(0, m - R, 0, m + R); lg.addColorStop(0, top); lg.addColorStop(1, bot); g.fillStyle = lg; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'destination-in';
    const rg = g.createRadialGradient(m, m, 0, m, m, R); [[0, 1], [.86, 1], [.92, .62], [.97, .2], [1, 0]].forEach(s => rg.addColorStop(s[0], 'rgba(0,0,0,' + s[1] + ')'));
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    if (discs.size > 5) discs.clear(); discs.set(k, cv); return cv; };
  const sun = (cx, cy, R, top, bot, rgb, a) => {
    const g = x.createRadialGradient(cx, cy, R*.6, cx, cy, R*2.1); g.addColorStop(0, rgba(rgb, a)); g.addColorStop(.4, rgba(rgb, a*.4)); g.addColorStop(1, rgba(rgb, 0));
    x.fillStyle = g; x.fillRect(cx - R*2.1, cy - R*2.1, R*4.2, R*4.2);
    const cv = disc(R, top, bot); x.drawImage(cv, cx - cv.width/2, cy - cv.height/2); };
  const breathe = () => .94;                        /* the haze used to swell and fade; on a smooth sky its bands of colour crept as it did, so it holds still */
  /* palms: photographs of real palms against the sky, cut to their silhouettes (tools/vapor/palms.py), standing far off at the horizon
     and washed out pale by the haze; tinted here, once a size, from the top of the tree to its foot */
  const PALM = dk => dk ? ['rgba(196,178,240,.5)', 'rgba(217,160,189,.62)'] : ['rgba(255,255,255,.5)', 'rgba(255,214,234,.66)'];
  const tints = new Map();
  const tinted = (n, dk) => { const im = pic('vw-palm-' + n); if (!ok(im)) return null; const k = n + dk; if (tints.has(k)) return tints.get(k);
    const cv = canvas2(im.naturalWidth, im.naturalHeight), g = cv.getContext('2d'), c = PALM(dk); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in';
    const gr = g.createLinearGradient(0, 0, 0, cv.height); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    tints.set(k, cv); return cv; };
  const palms = (hy, dk) => { if (lay.tall || !A.palms) return;
    A.palms.forEach(p => { const cv = tinted(p.n, dk); if (!cv) return;
      const h = hy*p.h, w = h*cv.width/cv.height, cx = side(p.s === 'l' ? 0 : 1, U) + U*p.dx, y = hy + U*.02 - h;
      if (p.flip){ x.save(); x.translate(cx, 0); x.scale(-1, 1); x.drawImage(cv, -w/2, y, w, h); x.restore(); } else x.drawImage(cv, cx - w/2, y, w, h); }); };
  const haze = (hy, dk) => { const h = HAZE(dk), up = H*.05, dn = H*.12;
    let g = x.createLinearGradient(0, hy - up, 0, hy); g.addColorStop(0, rgba(h, 0)); g.addColorStop(1, rgba(h, .9)); x.fillStyle = g; x.fillRect(0, hy - up, W, up);
    g = x.createLinearGradient(0, hy, 0, hy + dn); g.addColorStop(0, rgba(h, 1)); g.addColorStop(.45, rgba(h, .75)); g.addColorStop(1, rgba(h, 0)); x.fillStyle = g; x.fillRect(0, hy, W, dn); };

  /* ── what doesn't move (the plate and the groups at the sides; on a phone, the whole picture), made again only when something changes ── */
  const front = canvas2(2, 2); let fkey = '';
  const side = (ax, Q) => ax < .5 ? Math.max(col.l/2, Q*.13) : Math.min(W - (W - col.r)/2, W - Q*.13);
  let lay = null;                                  /* where the picture went: scale, offset, horizon */
  const layout = dk => {
    if (tall()){ const s = Math.max(W/900, H/1600), ox = (W - 900*s)/2, oy = (H - 1600*s)/2, mm = meta('phone', dk) || { hy:.6 }; return { tall:true, s, ox, oy, hy:oy + mm.hy*1600*s }; }
    const pm = meta('plate', dk) || { W:2880, H:1200, hy:.6 }, s = H/pm.H; return { tall:false, s, ox:W/2 - pm.W*s/2, oy:0, hy:pm.hy*H, pm };
  };
  const build = dk => {
    const L = lay, key = [W, H, dk, Math.round(col.l), Math.round(col.r), gen].join();
    if (key === fkey && front.width === W && front.height === H) return;
    fkey = key; front.width = W; front.height = H; const g = front.getContext('2d');
    if (L.tall){ const im = piece('phone', dk); if (ok(im)) g.drawImage(im, L.ox, L.oy, 900*L.s, 1600*L.s); return; }
    /* the floor: the plate; in a window wider than it (wider than 2.4 to 1) the wide one, rendered with the same lens; wider even than that, the wide one enlarged about the horizon */
    const pw = W > L.pm.W*L.s + 1 ? meta('platew', dk) : null, pmm = pw || L.pm, pl = piece(pw ? 'platew' : 'plate', dk);
    if (ok(pl)){ const w = pmm.W*L.s, k = Math.max(1, W/w); g.drawImage(pl, W/2 - w*k/2, L.hy - pmm.hy*pmm.H*L.s*k, w*k, pmm.H*L.s*k); }
    keep = [];
    for (const p of ['left', 'right']){ const m = meta(p, dk), im = m && piece(p, dk); if (!m || !ok(im)) continue;
      const big = (p === 'left' ? col.l : W - col.r) > U*.5, ax = side(m.ax/m.W, U) + (big ? ((A.nudge || {})[p] || 0)*U : 0); g.drawImage(im, ax - (m.ax - m.x)*L.s, m.y*L.s, m.w*L.s, m.h*L.s);
      const kw = ((A.kw || {})[p] || .2)*U; keep.push([ax - kw/2, m.y*L.s, kw, (m.ay - m.y)*L.s + U*.03]); }
    if (A.panel){ const im = pic('vw-' + scene + '-' + A.panel + '-' + (dk ? 'd' : 'l')), right = A.panelSide === 'r', room = (right ? W - col.r : col.l) - U*.05;
      if (ok(im) && room >= 220*px()){ const w = Math.min(room, U*.5), h = w*im.naturalHeight/im.naturalWidth, x0 = right ? col.r + (W - col.r - w)/2 : (col.l - w)/2, y0 = Math.max(H*.08, L.hy*.5 - h*.55);
        g.save(); g.shadowColor = dk ? 'rgba(12,14,40,.45)' : 'rgba(70,44,130,.26)'; g.shadowBlur = U*.03; g.shadowOffsetX = U*.012; g.shadowOffsetY = U*.02;
        g.drawImage(im, x0, y0, w, h); g.restore(); keep.push([x0, y0, w, h]); } }
  };
  /* a faint still grain over the picture: specks of black and of white, most of them barely there. Only the picture: the page's windows
     and their text stay clean (over them it was hard on the eyes) */
  const grainCv = (() => { const c = canvas2(128, 128), g = c.getContext('2d'), d = g.createImageData(128, 128), r = rnd(4242);
    for (let i = 0; i < d.data.length; i += 4){ const v = r() < .5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.round(r()*r()*46); }
    g.putImageData(d, 0, 0); return c; })();
  let grainPat = null;
  const grain = dk => { grainPat = grainPat || x.createPattern(grainCv, 'repeat'); if (!grainPat) return; x.globalAlpha = dk ? .7 : .55; x.fillStyle = grainPat; x.fillRect(0, 0, W, H); x.globalAlpha = 1; };
  /* the page's word (tools/vapor/word.py): big vertical type in the margin beside the window. Its glitch is alive, a little: every few
     seconds a row of the type somewhere slips sideways (as the rows slipped in the picture itself have), holds a moment, sometimes
     jumps across once, and snaps back. One row at a time, small and brief, a step and never a slide; none with Animation off. (A pale
     glint passing down the word stood here before: the owner had asked for the glitch itself to move.) The word is drawn on a canvas
     of its own, wider than the picture, so a slipped row is never cut off at its edge. */
  let wordCv = null, wordKey = '', wordBox = null;
  const word = (t, dk) => { wordBox = null; const sd = PL.word; if (!sd || lay.tall) return;
    const im = pic('vw-word-' + page); if (!ok(im)) return;
    const room = sd === 'l' ? col.l : W - col.r; if (room < 170*px()) return;
    /* Every page's word is set in the same size of type: the pictures are all made at 220 px a character, and all shown at one scale, which
       the screen sets (about an eighth of its height a character, less if the longest word, five characters, would not fit). So a short
       word is shorter, not bigger. Only a margin too narrow for it makes one smaller. */
    const top = H*.09; let k = Math.min(U*.135, H*.72/5.27)/220; if (im.naturalWidth*k > room*.94) k = room*.94/im.naturalWidth;
    const w = Math.round(im.naturalWidth*k), h = Math.round(im.naturalHeight*k);
    const x0 = Math.round(sd === 'l' ? Math.max(side(0, U), col.l - U*.24) - w/2 : sd === 'r' ? Math.min(side(1, U), col.r + U*.24) - w/2 : col.r + U*.03), y0 = Math.round(top);
    const G = 220*k, pad = Math.ceil(G*.2);                                   // a character's size on the screen; room either side for a slipped row
    const wk = [w, h, gen].join(); if (wk !== wordKey || !wordCv){ wordKey = wk; wordCv = wordCv || canvas2(2, 2); wordCv.width = w + 2*pad; wordCv.height = h; }
    const g = wordCv.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w + 2*pad, h); g.imageSmoothingQuality = 'high'; g.drawImage(im, pad, 0, w, h);
    if (e.animate){                                                           /* the slip: time in spells of 3.7 s, each with (four times in five) one slip, made from the spell's number so it is the same on every frame of it */
      const P = 3.7, n = Math.floor(t/P), u = t - n*P, r = rnd(n*7919 + 101);
      const t0 = .2 + r()*1.4, hold = .3 + r()*1.1, yb = Math.round((.04 + r()*.9)*h), hb = Math.max(3, Math.round((.035 + r()*.07)*G)), dir = r() < .5 ? -1 : 1, amp = (.05 + r()*.08)*G,
            turn = r() < .45 ? .45 + r()*.3 : 2, back = .35 + r()*.4, none = r() < .2;       // (the same sizes as the slips in the picture: tools/vapor/word.py)
      if (!none && u >= t0 && u < t0 + hold){ const q = (u - t0)/hold, dx = Math.round(dir*amp*(u - t0 < .06 ? 1.45 : q > turn ? -back : 1)), sc = im.naturalHeight/h;      // it overshoots for an instant as it tears
        g.clearRect(0, yb, w + 2*pad, hb); g.drawImage(im, 0, yb*sc, im.naturalWidth, hb*sc, pad + dx, yb, w, hb); } }
    x.drawImage(wordCv, x0 - pad, y0); wordBox = [x0, y0, w, h]; };
  /* what stands where, in the page's own pixels, for the visitors (they keep off the scene's things and the word) */
  let keep = [], fkeep = [];
  const stage = () => { const k = px(), all = keep.concat(fkeep, wordBox ? [wordBox] : []);
    FX.vwStage = { keep:all.map(r => [r[0]/k, r[1]/k, r[2]/k, r[3]/k]), hy:lay.hy/k, tall:!!lay.tall }; };
  const floats = (t, dk) => { fkeep = []; if (lay.tall) return;
    A.floats.forEach((f, i) => { const m = meta(f[0], dk), im = m && piece(f[0], dk); if (!m || !ok(im)) return;
      let ax, dy = 0; if (typeof f[1] === 'number') ax = W*f[1]; else if (typeof f[1] === 'object'){ ax = side(f[1].s, U) + U*(f[1].dx || 0); dy = U*(f[1].dy || 0); }
      else { const gm = meta(f[1], dk); if (!gm) return; ax = side(gm.ax/gm.W, U) + (m.ax - gm.ax)*lay.s; }
      const bob = f[2] ? Math.sin(t*TAU/f[2] + i*2.1)*U*.006 : 0, fx0 = ax - (m.ax - m.x)*lay.s, fy0 = m.y*lay.s + dy;
      x.drawImage(im, fx0, fy0 + bob, m.w*lay.s, m.h*lay.s); fkeep.push([fx0 + m.w*lay.s*.12, fy0, m.w*lay.s*.76, m.h*lay.s]); }); };

  return {
    frame(t){
      const now = performance.now(); if (!col || now - colAt > 700){ colAt = now; col = measure(); }
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      const dk = e.dark; lay = layout(dk); const hy = lay.hy, Q = U;
      skyBand(hy, dk, t);
      if (dk) softStars(t, hy*.7);
      if (A.moon) sun(side(0, Q) + Q*.08, H*.2, U*.13, dk ? '#fff6ec' : '#ffffff', dk ? '#f2cadf' : '#ffe2ef', dk ? '255,226,236' : '255,255,255', (dk ? .26 : .4)*breathe(t));
      else if (A.sun === 'l') sun(side(0, Q) + Q*.05, hy - Q*.15, Q*.24, dk ? '#f6b3c4' : '#ffa6cb', dk ? '#d97c9f' : '#ff5c9c', dk ? '236,170,196' : '255,170,210', (dk ? .3 : .34)*breathe(t));
      else if (A.sun === 'r') sun(side(1, Q) + Q*.03, hy - Q*.09, Q*.22, dk ? '#f6b3c4' : '#ffa6cb', dk ? '#d97c9f' : '#ff5c9c', dk ? '236,170,196' : '255,170,210', (dk ? .3 : .34)*breathe(t));
      if (A.moon){ skyBand(hy, dk, t, true);                  /* still water: the sky again, upside down, and the moon on it */
        const g = x.createLinearGradient(0, hy, 0, H); g.addColorStop(0, dk ? 'rgba(255,240,246,.4)' : 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(side(0, Q) + Q*.08 - U*.08, hy, U*.16, H - hy); }
      if (A.cloudFloor){ skyBand(hy, dk, t*.6, true);                /* a floor of cloud: the sky's photograph again, upside down, under a veil */
        const g = x.createLinearGradient(0, hy, 0, H); g.addColorStop(0, rgba(HAZE(dk), .55)); g.addColorStop(1, rgba(HAZE(dk), .18)); x.fillStyle = g; x.fillRect(0, hy, W, H - hy); }
      palms(hy, dk);
      haze(hy, dk);
      build(dk); x.drawImage(front, 0, 0);
      floats(t, dk);
      grain(dk);
      word(t, dk);
      stage();
    },
    resize(w, h){ W = w; H = h; U = Math.min(H, W*.72); col = null; fkey = ''; },
    env(n){ e = n; },
    dispose(){ rt.forEach(clearTimeout); removeEventListener('load', recheck); front.width = front.height = 1; }
  };
}
/* ═══════════════════════════════════════════════════════════════════
   The visitors (moderators only, with the rest of NEXT).

   Windows 95 windows that turn up in the margins beside the page, as if
   something in the machine were keeping itself busy, and now and then
   trying to say something. Who comes, what they say and how often is
   fx/vapor-entity.js, a list written to be edited; this is how they
   behave.
     · Real windows, above the scene and below the site's own sheets and
       notes, dragged by the title bar. They stand in the page's places:
       the corners and middles of the margins, clear of the page's
       column, the scene's things, the page's word and the taskbar.
     · On a screen with margins somebody is usually about: one window,
       sometimes two, never more; a short pause between one going and
       the next coming. Most are passing windows (a note typing itself,
       something playing, a job that takes its time); some are the
       conversations, with their follow-ups hours later. On a narrow
       screen none of that: one small window in a bottom corner, rarely,
       and never on the timetable.
     · They arrive and leave in a glitch (bands slipping, the colours
       parting, a last bright line). Their words type themselves. When a
       window's time is up another pointer, not yours, comes and presses
       its X; a hung program is dragged off by it, leaving copies of
       itself behind. A shy one goes when your pointer comes near.
     · Not modal: they never take the focus or hold the keyboard. Their
       buttons are buttons; Escape closes the one you're in.
     · Remembered on this device only (msc.vwent: who came, what you
       answered, when). Off for good from any window's menu (the icon at
       the left of its title bar) or from Start (msc.vwent.off).
     · Animation off, or Reduce motion: no glitch, no typing, no other
       pointer, nothing moving in them; they come and go at once.
     · Moderators can call one up: ?vwent=<id> (or two: <id>,<id>),
       with &vwlife=<seconds> to see it taken away again; ?vwent=next
       (whoever would come next), ?vwent=reset (forget everything),
       ?vwent=on (after "Don't show these").
   ═══════════════════════════════════════════════════════════════════ */
const VKEY = 'msc.vwent', VOFF = 'msc.vwent.off';
const vget = () => { try { const s = JSON.parse(localStorage.getItem(VKEY) || 'null'); return s && typeof s === 'object' ? s : {}; } catch { return {}; } };
const vput = s => { try { localStorage.setItem(VKEY, JSON.stringify(s)); } catch {} };
const vupd = fn => { const s = vget(); s.seen = s.seen || {}; fn(s); vput(s); return s; };
const voff = () => { try { return localStorage.getItem(VOFF) === '1'; } catch { return false; } };
const setVoff = on => { try { if (on) localStorage.setItem(VOFF, '1'); else localStorage.removeItem(VOFF); } catch {} };
const dayOf = t => new Date(t).toDateString();

/* our own pixel icons, 16 × 16 ('.' is clear) */
const ICONS = {
  win:    [{ o:'#30304a', c:'#7cdff6', l:'#cda6f2', w:'#ffffff', g:'#9a9ab4' },
           ['................', '.oooooooooooooo.', '.occcccclllllwo.', '.occcccclllllwo.', '.oooooooooooooo.', '.owwwwwwwwwwwwo.', '.owggggggggwwwo.', '.owwwwwwwwwwwwo.',
            '.owggggggwwwwwo.', '.owwwwwwwwwwwwo.', '.owgggggggggwwo.', '.owwwwwwwwwwwwo.', '.oooooooooooooo.', '................', '................', '................']],
  door:   [{ o:'#4d4a1c', y:'#e4df8c', s:'#c4bd5c', k:'#4d4a1c' },
           ['................', '....oooooooo....', '....oyyyyyso....', '....oyyyyyso....', '....oyyyyyso....', '....oyyyyyso....', '....oyyyyyso....', '....okyyyyso....',
            '....oyyyyyso....', '....oyyyyyso....', '....oyyyyyso....', '....oyyyyyso....', '....oyyyyyso....', '..oooooooooooo..', '................', '................']],
  folder: [{ o:'#5a4a1e', y:'#f3d77a', l:'#fff2bd', d:'#c9a640' },
           ['................', '................', '.oooo...........', 'oyyyyo..........', 'oyyyyyoooooooo..', 'oyyyyyyyyyyyyyo.', 'olllllllllllllo.', 'olyyyyyyyyyyydo.',
            'olyyyyyyyyyyydo.', 'olyyyyyyyyyyydo.', 'olyyyyyyyyyyydo.', 'olyyyyyyyyyyydo.', 'odddddddddddddo.', '.ooooooooooooo..', '................', '................']],
  bin:    [{ o:'#3a3a4a', w:'#e6e6ee', g:'#9a9aaa' },
           ['................', '......oooo......', '..oooooooooooo..', '..owwwwwwwwwwo..', '..oooooooooooo..', '...owgwgwgwgo...', '...owgwgwgwgo...', '...owgwgwgwgo...',
            '...owgwgwgwgo...', '...owgwgwgwgo...', '...owgwgwgwgo...', '...owgwgwgwgo...', '...owgwgwgwgo...', '...oooooooooo...', '................', '................']],
  sun:    [{ p:'#f6b4de', r:'#ff8d96', w:'#ffffff', b:'#b9c4f2' },
           ['pppppppppppppppp', 'pppppppppppppppp', 'pppppprrrrpppppp', 'ppppprrrrrrppppp', 'pppprrrrrrrrpppp', 'pppprrrrrrrrpppp', 'pppprrrrrrrrpppp', 'wwwwwwwwwwwwwwww',
            'bbbbbrrrrrrbbbbb', 'bbbbbbrrrrbbbbbb', 'bbbbbbbrrbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb']],
  opaline:[{ a:'#ffb3d9', b:'#cfd8f8', c:'#a9ecf6', d:'#cdb6f6', w:'#ffffff', o:'#7a6ab0' },
           ['................', '..ooooooooooooo.', '.oaaaaabbbbcccco', '.oaaaawwwwbcccco', '.oaaawwbbwwcccco', '.oaawwbbbbwwccco', '.oaawbbbbbbwddco', '.oaawbbbbbbwddco',
            '.oaawwbbbbwwddco', '.oaaawwbbwwdddco', '.oaaaawwwwddddco', '.oaaaabbbbdddddo', '..ooooooooooooo.', '................', '................', '................']],
  monitor:[{ o:'#30304a', m:'#2b2440', p:'#ff9ad0' },
           ['................', '.oooooooooooooo.', '.ommmmmmmmmmmmo.', '.ommmmmmmmmmmmo.', '.ommmmmmmmmpmmo.', '.ommmmmmmmmpmmo.', '.ommmmmmpmmpmmo.', '.ommpmmmpmmpmpo.',
            '.ompmpmpmpmpmpo.', '.ommmmmmmmmmmmo.', '.oooooooooooooo.', '......oooo......', '....oooooooo....', '................', '................', '................']],
  home:   [{ o:'#30304a', r:'#ff9ad0', w:'#f4f0ff', b:'#8a7ad6' },
           ['................', '.......oo.......', '......orro......', '.....orrrro.....', '....orrrrrro....', '...orrrrrrrro...', '..orrrrrrrrrro..', '.oooooooooooooo.',
            '..owwwwwwwwwwo..', '..owwwoooowwwo..', '..owwwobbowwwo..', '..owwwobbowwwo..', '..owwwobbowwwo..', '..oooooooooooo..', '................', '................']],
  tt:     [{ o:'#30304a', c:'#7cdff6', w:'#f4f0ff', p:'#ff9ad0', b:'#b9a6f2' },
           ['................', '.oooooooooooooo.', '.occcccccccccco.', '.occcccccccccco.', '.oooooooooooooo.', '.owwwowwwwowwwo.', '.owwwowwwwowwwo.', '.oooooooooooooo.',
            '.owwwoppppowwwo.', '.owwwoppppowwwo.', '.oooooooooooooo.', '.owwwowwwwobbbo.', '.owwwowwwwobbbo.', '.oooooooooooooo.', '................', '................']],
  cal:    [{ o:'#30304a', r:'#ff8d96', w:'#f4f0ff', g:'#9a9ab4', p:'#ff5fb0' },
           ['................', '...oo......oo...', '.oooooooooooooo.', '.orrrrrrrrrrrro.', '.orrrrrrrrrrrro.', '.oooooooooooooo.', '.owwwwwwwwwwwwo.', '.owgwgwgwgwgwwo.',
            '.owwwwwwwwwwwwo.', '.owgwgwpwgwgwwo.', '.owwwwwwwwwwwwo.', '.owgwgwgwgwwwwo.', '.owwwwwwwwwwwwo.', '.oooooooooooooo.', '................', '................']],
  clock:  [{ o:'#30304a', w:'#f4f0ff', k:'#6a4fb0' },
           ['................', '.....oooooo.....', '...oowwwwwwoo...', '..owwwwkwwwwwo..', '..owwwwkwwwwwo..', '.owwwwwkwwwwwwo.', '.owwwwwkwwwwwwo.', '.owwwwwkkkkwwwo.',
            '.owwwwwwwwwwwwo.', '.owwwwwwwwwwwwo.', '..owwwwwwwwwwo..', '..owwwwwwwwwwo..', '...oowwwwwwoo...', '.....oooooo.....', '................', '................']],
  book:   [{ o:'#30304a', b:'#8a7ad6', w:'#f4f0ff', g:'#9a9ab4' },
           ['................', '..ooooooooooo...', '.obbbbbbbbbbbo..', '.obbbbbbbbbbbo..', '.obbwwwwwwwbbo..', '.obbwgggggwbbo..', '.obbwwwwwwwbbo..', '.obbbbbbbbbbbo..',
            '.obbbbbbbbbbbo..', '.obbbbbbbbbbbo..', '.obbbbbbbbbbbo..', '.oooooooooooooo.', '.owwwwwwwwwwwwo.', '..ooooooooooooo.', '................', '................']],
  joy:    [{ o:'#30304a', r:'#ff8d96', w:'#e6e6ee', p:'#ff5fb0' },
           ['................', '......oooo......', '.....orrrro.....', '.....orrrro.....', '......oooo......', '.......oo.......', '.......oo.......', '.......oo.......',
            '..oooooooooooo..', '.owwwwwwwwwwwwo.', '.owwwwwwwwppwwo.', '.owwwwwwwwwwwwo.', '.oooooooooooooo.', '................', '................', '................']],
  tile:   [{ o:'#30304a', w:'#f4f0ff', r:'#e5484d', g:'#7cc8a0' },
           ['................', '...oooooooooo...', '..owwwwwwwwwwo..', '..owwwwrrwwwwo..', '..owwrrrrrrwwo..', '..owwrwrrwrwwo..', '..owwrrrrrrwwo..', '..owwwwrrwwwwo..',
            '..owwwwrrwwwwo..', '..owwwwwwwwwwo..', '..oggggggggggo..', '..oggggggggggo..', '...oooooooooo...', '................', '................', '................']],
  paint:  [{ o:'#30304a', w:'#f3e6c8', r:'#ff8d96', c:'#7cdff6', p:'#ff5fb0', b:'#8a7ad6', y:'#f3d77a' },
           ['................', '.....oooooo.....', '...oowwwwwwoo...', '..owwrwwwwcwwo..', '.owwwwwwwwwwwwo.', '.owpwwwwwwwwbwo.', '.owwwwwwwwwwwwo.', '.owywwwwooowwwo.',
            '.owwwwwwo.owwwo.', '..owwwwwooowwo..', '...oowwwwwwoo...', '.....oooooo.....', '................', '................', '................', '................']],
  spk:    [{ o:'#30304a', g:'#9a9ab4', w:'#f4f0ff' },
           ['................', '................', '........oo......', '.......ogo..o...', '......oggo...o..', '..ooooogwo.o..o.', '..ogggggwo..o.o.', '..ogggggwo..o.o.',
            '..ooooogwo.o..o.', '......oggo...o..', '.......ogo..o...', '........oo......', '................', '................', '................', '................']],
  cursor: [{ k:'#14101f', w:'#ffffff' },
           ['k...............', 'kk..............', 'kwk.............', 'kwwk............', 'kwwwk...........', 'kwwwwk..........', 'kwwwwwk.........', 'kwwwwwwk........',
            'kwwwwwwwk.......', 'kwwwwwwwwk......', 'kwwwwwkkkkk.....', 'kwwkwwk.........', 'kwk.kwwk........', 'kk..kwwk........', 'k....kwwk.......', '.....kkkk.......']],
  note:   [{ o:'#30304a', c:'#7cdff6', w:'#f4f0ff', g:'#9a9ab4' },
           ['................', '..oooooooooooo..', '..occcccccccco..', '..oooooooooooo..', '..owwwwwwwwwwo..', '..owggggggggwo..', '..owwwwwwwwwwo..', '..owggggggwwwo..',
            '..owwwwwwwwwwo..', '..owggggggggwo..', '..owwwwwwwwwwo..', '..owggggwwwwwo..', '..owwwwwwwwwwo..', '..oooooooooooo..', '................', '................']],
  media:  [{ o:'#30304a', m:'#2b2440', p:'#ff9ad0', w:'#e6e6ee', g:'#9a9ab4' },
           ['................', '.oooooooooooooo.', '.ommmmmmmmmmmmo.', '.ommmmmppppmmmo.', '.ommmmmpmmpmmmo.', '.ommmmmpmmpmmmo.', '.ommmmmpmmpmmmo.', '.ommmppmmppmmmo.',
            '.ommmppmmppmmmo.', '.ommmmmmmmmmmmo.', '.oooooooooooooo.', '.owwgwwgwwgwwwo.', '.oooooooooooooo.', '................', '................', '................']],
  hour:   [{ o:'#30304a', w:'#f4f0ff', y:'#f3d77a' },
           ['................', '...oooooooooo...', '...owwwwwwwwo...', '....owwwwwwo....', '....oyyyyyyo....', '.....oyyyyo.....', '......oyyo......', '.......oo.......',
            '......owwo......', '.....owwywo.....', '....owwyywwo....', '....owyyyywo....', '...oyyyyyyyyo...', '...oooooooooo...', '................', '................']]
};
const iconURL = {};
const icon = n => { if (iconURL[n]) return iconURL[n]; const d = ICONS[n] || ICONS.win, c = canvas2(16, 16), g = c.getContext('2d');
  d[1].forEach((row, y) => { for (let x = 0; x < 16; x++){ const col = d[0][row[x]]; if (col){ g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return (iconURL[n] = c.toDataURL()); };

function startVisitors(){
  const go = () => {
    if (window.VW_ENTITY) return visitors();
    const s = document.createElement('script'); s.src = '/fx/vapor-entity.js' + IMV; s.async = true; s.onload = () => visitors(); (document.head || root).appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
}
function visitors(){
  const C = window.VW_ENTITY; if (!C || !Array.isArray(C.events) || !document.body || document.querySelector('.vw-ent')) return;
  const P = Object.assign({ quietSessions:2, sessionGapMinutes:30, minGapMinutes:100, chancePerPage:.2, maxPerDay:4, callbackChance:.6, rareAfter:5, rareGapHours:72,
    rareChance:.3, narrowChance:.35, appearAfterSeconds:[3, 9], fadeAfterSeconds:75,
    firstAfterSeconds:[2, 5], idleSeconds:2, staySeconds:[24, 44], gapSeconds:[5, 12], secondChance:.5, secondAfterSeconds:[12, 28], maxOpen:2, storyChance:.3, typeCps:30 }, C.pace || {});
  const EV = {}; C.events.forEach(e => { if (e && e.id) EV[e.id] = e; });
  const PG = root.getAttribute('data-pg') || FX.page || '';
  const q = (() => { try { return new URLSearchParams(location.search).get('vwent'); } catch { return null; } })();
  if (q === 'reset'){ vput({}); setVoff(false); try { sessionStorage.removeItem('msc.vwamb'); } catch {} } else if (q === 'on') setVoff(false);
  const preview = q && q !== 'reset' && q !== 'on' ? q : null;
  const lifeQ = (() => { try { return Math.max(0, +new URLSearchParams(location.search).get('vwlife') || 0); } catch { return 0; } })();      /* with ?vwent=<id>: &vwlife=<seconds> before the other pointer comes for it (else it stays) */
  /* a session: coming back after a while away */
  const t0 = Date.now();
  vupd(s => { if (!s.first) s.first = t0; if (!s.active || t0 - s.active > P.sessionGapMinutes*6e4) s.sessions = (s.sessions || 0) + 1; s.active = t0; });
  setInterval(() => { if (!document.hidden) vupd(s => { s.active = Date.now(); }); }, 3e5);

  const layer = document.createElement('div'); layer.className = 'vw-ent'; document.body.appendChild(layer);
  const sync = () => { layer.hidden = root.getAttribute('data-skin') !== 'vapor'; }; sync(); addEventListener('tt:look', sync);
  const instant = () => { if (root.getAttribute('data-fx') !== 'on') return true; try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const fill = v => String(v == null ? '' : v).replace(/\{NAME\}/g, dosName());
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const rand = a => a[0] + Math.random()*(a[1] - a[0]), wait = ms => new Promise(r => setTimeout(r, ms));
  const live = [];                                  /* the windows that are open */
  const openNow = () => live.filter(o => !o.gone);

  /* ── the stage: where a window may stand. In the margins beside the page's column, never over the column, the scene's things, the
        page's word, the taskbar or another window. Each margin offers its corners and its middle; the best three that are free are
        the page's places. (On a narrow screen there are no margins: one small window, in a bottom corner, as before.) ── */
  const M = 10, SIZE = { dialog:[196, 300], explorer:[250, 320], list:[240, 310], web:[230, 300], sunrise:[180, 220], notepad:[216, 300], player:[212, 250], progress:[216, 300] };
  const colNow = () => { const w = document.querySelector('.wrap'); if (w && w.offsetWidth){ const b = w.getBoundingClientRect(); return { l:b.left, r:b.right }; }
    const mw = Math.min(innerWidth, 1040); return { l:(innerWidth - mw)/2, r:(innerWidth + mw)/2 }; };
  const floorY = () => { const b = document.querySelector('.vw-task'), h = b ? b.offsetHeight : 0; return (h ? b.getBoundingClientRect().top : innerHeight) - M; };
  const hit = (a, b, pad) => a[0] < b[0] + b[2] + pad && a[0] + a[2] + pad > b[0] && a[1] < b[1] + b[3] + pad && a[1] + a[3] + pad > b[1];
  const gutters = () => { const c = colNow(); return [{ k:'l', x0:0, x1:c.l }, { k:'r', x0:c.r, x1:innerWidth }]; };
  const widthIn = (g, kind) => { const s = SIZE[kind] || SIZE.dialog, room = g.x1 - g.x0 - 2*M; return room >= s[0] ? Math.round(Math.min(s[1], room)) : 0; };
  const canFit = kind => gutters().some(g => widthIn(g, kind));
  const wide = () => canFit('dialog');
  const ORDER = ['lbo', 'rto', 'rmo', 'rbo', 'rti', 'lto', 'lmo', 'rbi', 'rmi'];       /* margin (left, right); top, middle, bottom; outer or inner edge */
  const free = (r, me) => { const st = FX.vwStage || {}, c = colNow();
    if (r[0] < 0 || r[1] < 0 || r[0] + r[2] > innerWidth || r[1] + r[3] > floorY() + 1) return false;
    if (r[0] < c.r && r[0] + r[2] > c.l) return false;
    return !(st.keep || []).some(k => hit(r, k, 6)) && !openNow().some(o => { if (o === me) return false; const b = o.win.getBoundingClientRect(); return hit(r, [b.left, b.top, b.width, b.height], 8); }); };
  const places = (c, kind) => { const out = [];
    for (const g of gutters()){ const w = widthIn(g, kind); if (!w) continue; c.win.style.width = w + 'px'; const h = c.win.offsetHeight, top = M + 4, bot = floorY() - h;
      ORDER.forEach((o, rank) => { if (o[0] !== g.k) return;
        const x = (o[2] === 'o') === (g.k === 'l') ? g.x0 + M : g.x1 - w - M, y = o[1] === 't' ? top : o[1] === 'b' ? bot : Math.round((top + bot)/2);
        if (!out.some(p => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8) && free([x, y, w, h], c)) out.push({ x, y, w, rank }); }); }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 3); };
  const narrowSpot = c => { const w = Math.round(Math.min(250, innerWidth - 2*M)); c.win.style.width = w + 'px'; const h = c.win.offsetHeight; return [M, innerWidth - w - M].map(x => ({ x, y:Math.max(M, innerHeight - h - M), w })); };
  const inView = (p, w, h) => p[0] >= 0 && p[1] >= 0 && p[0] + w <= innerWidth && p[1] + h <= innerHeight;

  /* ── who comes next ── */
  const named = ev => /\{NAME\}/.test(JSON.stringify(ev));
  const onPage = ev => !(ev.pages && ev.pages.indexOf(PG) < 0) && !(ev.notOn && ev.notOn.indexOf(PG) >= 0) && !(named(ev) && dosName() === 'USER');
  const eligible = (ev, s, t, ign, narrow) => {
    const seen = s.seen[ev.id];
    if (seen && !(ev.again && t - seen.at > ev.again*864e5)) return false;
    if (!onPage(ev)) return false;
    if (narrow ? (ev.kind || 'dialog') !== 'dialog' || PG === 'timetable' : !canFit(ev.kind || 'dialog')) return false;
    if (ev.after){ const p = s.seen[ev.after.id]; if (!p) return false; if (ev.after.button && p.b !== ev.after.button) return false;
      if (!ign){ const h = (t - p.at)/36e5; if (h < (ev.after.minHours == null ? 1 : ev.after.minHours) || h > (ev.after.maxHours || 20)) return false; } }
    if (ev.rare && !ign && ((s.count || 0) < P.rareAfter || (s.rareLast && t - s.rareLast < P.rareGapHours*36e5) || Math.random() >= P.rareChance)) return false;
    return true; };
  const weighted = pool => { let r = Math.random()*pool.reduce((a, e) => a + (e.weight || 1), 0); for (const e of pool){ r -= e.weight || 1; if (r < 0) return e; } return pool[0]; };
  /* a narrow screen: now and then, as it always was */
  const pickRare = ign => {
    const s = vget(), t = Date.now(); s.seen = s.seen || {};
    if (!ign){ if ((s.sessions || 0) <= P.quietSessions) return null;
      if (s.last && t - s.last < P.minGapMinutes*6e4) return null;
      if (s.day === dayOf(t) && (s.dayN || 0) >= P.maxPerDay) return null; }
    const due = C.events.filter(e => e.after && eligible(e, s, t, ign, true));
    if (due.length && (ign || Math.random() < P.callbackChance)) return due[0];
    if (!ign && Math.random() >= P.chancePerPage*P.narrowChance) return null;
    const pool = C.events.filter(e => !e.after && !e.smear && eligible(e, s, t, ign, true)); return pool.length ? weighted(pool) : null; };
  /* a screen with margins: a follow-up that's due; or one of the conversations; or one of the passing windows (not one that's just been) */
  const recent = (() => { try { const a = JSON.parse(sessionStorage.getItem('msc.vwamb') || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })();
  const remember = id => { recent.push(id); while (recent.length > 7) recent.shift(); try { sessionStorage.setItem('msc.vwamb', JSON.stringify(recent)); } catch {} };
  const pickNext = () => { const s = vget(), t = Date.now(); s.seen = s.seen || {}; const isOpen = e => openNow().some(o => o.ev.id === e.id);
    const due = C.events.filter(e => e.after && !isOpen(e) && eligible(e, s, t, false)); if (due.length && Math.random() < P.callbackChance) return due[0];
    if (Math.random() < P.storyChance){ const pool = C.events.filter(e => !e.after && !e.ambient && !isOpen(e) && eligible(e, s, t, false)); if (pool.length) return weighted(pool); }
    const amb = C.events.filter(e => e.ambient && !isOpen(e) && recent.indexOf(e.id) < 0 && onPage(e) && canFit(e.kind || 'dialog')); return amb.length ? weighted(amb) : null; };

  /* ── the other pointer: an arrow that isn't yours. When a window's time is up it comes over and presses the X itself; one window
        it takes by the title bar and drags, and the window leaves copies of itself behind, as a hung program's used to. With
        Animation off, or Reduce motion, there is no other pointer: windows simply go. ── */
  let cur = null, curAt = null, curBusy = false;
  const curEl = () => { if (!cur){ cur = el('img', 'vw-cur'); cur.alt = ''; cur.setAttribute('aria-hidden', 'true'); cur.src = icon('cursor'); layer.appendChild(cur); } return cur; };
  const curSet = (x, y, ms) => { const c = curEl(); c.style.transitionDuration = ms + 'ms, 300ms'; c.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; curAt = [x, y]; };
  const curGo = (x, y, ms) => { curSet(x, y, ms); return wait(ms + 30); };
  const curOut = () => { if (cur) cur.classList.remove('on'); };
  const approach = async (tx, ty) => {
    if (!cur || !cur.classList.contains('on') || !curAt){ curSet(tx + (tx > innerWidth/2 ? 1 : -1)*(70 + Math.random()*90), Math.min(innerHeight - 30, ty + 140 + Math.random()*120), 0); void curEl().offsetWidth; cur.classList.add('on'); await wait(160); }
    const d = Math.hypot(tx - curAt[0], ty - curAt[1]); await curGo(tx, ty, Math.round(Math.max(520, Math.min(1300, d*2.6)))); };
  const ghost = async job => { if (curBusy || instant() || layer.hidden) return false; curBusy = true; try { await job(); } catch {} curBusy = false; return true; };
  const ghostClose = c => ghost(async () => { const r = c.bX.getBoundingClientRect(); await approach(r.left + r.width/2 - 3, r.top + r.height/2 - 2); if (c.gone){ curOut(); return; }
    c.bX.classList.add('vw-press'); await wait(150); c.bX.classList.remove('vw-press'); c.leave(null); await wait(650); await curGo(curAt[0] + 22, curAt[1] + 30, 900); curOut(); });
  const stamp = c => { if (c.stamps.length >= 14) return; const k = c.win.cloneNode(true); k.className = k.className.replace(/\b(on|off|vw-drag)\b/g, '') + ' vw-stamp'; k.removeAttribute('role'); k.removeAttribute('aria-label'); k.removeAttribute('aria-describedby'); k.setAttribute('aria-hidden', 'true');
    k.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); k.querySelectorAll('button,a').forEach(b => { b.tabIndex = -1; }); layer.insertBefore(k, c.win); c.stamps.push(k); };
  const ghostSmear = c => ghost(async () => { const r = c.tb.getBoundingClientRect(); await approach(r.left + r.width*.4, r.top + r.height/2); if (c.gone){ curOut(); return; }
    const p0 = c.pos.slice(), cc = colNow(), dy = (p0[1] > innerHeight/2 ? -1 : 1)*14; let dx = (p0[0] >= cc.r ? 1 : -1)*12;      /* away from the page, unless there's no room that way */
    if (p0[0] + dx*9 < 0 || p0[0] + r.width + dx*9 > innerWidth) dx = -dx;
    for (let i = 1; i <= 9 && !c.gone; i++){ stamp(c); c.place([Math.max(0, Math.min(innerWidth - r.width, p0[0] + dx*i)), Math.max(0, Math.min(floorY() - 30, p0[1] + dy*i))]); curSet(curAt[0] + dx, curAt[1] + dy, 70); await wait(100); }
    await wait(1300); if (!c.gone) c.leave(null); await wait(500); curOut(); });

  /* ── a window ── */
  const show = (ev, how) => {
    if (layer.hidden || openNow().length >= P.maxOpen) return null;
    const kind = ev.kind || 'dialog', roomy = wide();
    if (roomy ? !canFit(kind) : kind !== 'dialog' || PG === 'timetable') return null;
    const win = el('div', 'vw-win vw-' + kind + (roomy ? '' : ' vw-small')), uid = 'vw' + Math.random().toString(36).slice(2, 8);
    const c = { ev, win, gone:false, stamps:[], pos:null };
    win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', fill(ev.title || 'Message'));
    /* the title bar: the window menu, the name, the caption buttons */
    const tb = el('div', 'vw-tb'), sys = el('button', 'vw-sys'); sys.type = 'button'; sys.setAttribute('aria-label', 'Window menu'); sys.setAttribute('aria-haspopup', 'menu'); sys.setAttribute('aria-expanded', 'false');
    const si = el('img'); si.alt = ''; si.src = icon(ev.icon || { explorer:'folder', notepad:'note', player:'media', progress:'hour' }[kind] || 'win'); sys.appendChild(si);
    tb.append(sys, el('span', 'vw-tt', fill(ev.title || '')));
    const cap = (cls, label, dis) => { const b = el('button', 'vw-cap ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); if (dis) b.disabled = true; tb.appendChild(b); return b; };
    const bMin = kind !== 'dialog' && kind !== 'progress' ? cap('vw-mn', 'Minimise') : null; if (bMin) cap('vw-mx', 'Maximise', true);
    const bX = cap('vw-x', 'Close'); win.appendChild(tb); c.tb = tb; c.bX = bX;
    /* what's in it */
    const body = el('div', 'vw-body'); win.appendChild(body); let msg = null, status = null, tick = 0, typing = 0, typeJob = null;
    /* words that type themselves: the whole text is there for a screen reader from the start; what's seen arrives a letter at a time */
    const typed = (holder, text, done) => { const sr = el('span', 'vw-sr', text), out = el('span', 'vw-typed'); out.setAttribute('aria-hidden', 'true'); holder.append(sr, out);
      const finish = () => { clearTimeout(typing); typeJob = null; out.textContent = text; if (done) done(); };
      if (instant() || how === 'again'){ finish(); return out; }
      let i = 0; const step = () => { if (c.gone) return; i++; out.textContent = text.slice(0, i); if (i >= text.length){ typeJob = null; if (done) done(); return; }
        const ch = text[i - 1]; typing = setTimeout(step, (ch === '\n' ? 520 : /[.,?:]/.test(ch) ? 240 : 1000/P.typeCps)*(.7 + Math.random()*.6)); };
      typeJob = finish; typing = setTimeout(step, 380); return out; };
    if (kind === 'explorer'){
      const a = el('div', 'vw-addr'); a.append(el('span', null, 'Address'), el('div', 'vw-field', fill(ev.path))); body.appendChild(a);
      const pane = el('div', 'vw-pane'); (ev.folders || []).forEach(f => { const b = el('button', 'vw-fold'); b.type = 'button'; const i = el('img'); i.alt = ''; i.src = icon('folder'); b.append(i, el('span', null, fill(f.label)));
        b.addEventListener('click', () => { status.textContent = fill(f.say || ''); }); pane.appendChild(b); }); body.appendChild(pane);
      status = el('div', 'vw-status', (ev.folders || []).length + ' object(s)'); body.appendChild(status);
    } else if (kind === 'list'){
      const tbl = el('table', 'vw-table'), th = el('thead'), hr = el('tr'), tbd = el('tbody'); (ev.columns || []).forEach(k => hr.appendChild(el('th', null, fill(k)))); th.appendChild(hr); tbl.appendChild(th);
      (ev.rows || []).forEach(r => { const tr = el('tr'); r.forEach(v => tr.appendChild(el('td', null, fill(v)))); tbd.appendChild(tr); }); tbl.appendChild(tbd);
      const box = el('div', 'vw-listbox'); box.appendChild(tbl); body.appendChild(box); status = el('div', 'vw-status', fill(ev.foot || '')); body.appendChild(status);
    } else if (kind === 'web'){
      const page = el('div', 'vw-page'); page.append(el('p', 'vw-h', fill(ev.heading || 'Welcome')), el('p', 'vw-uc', 'UNDER CONSTRUCTION'));
      const cnt = el('p', 'vw-cnt'); cnt.append(el('span', null, 'You are visitor no. '), el('b', null, fill(ev.counter || '000001'))); page.appendChild(cnt);
      if (ev.updated) page.appendChild(el('p', 'vw-upd', fill(ev.updated)));
      body.appendChild(page); status = el('div', 'vw-status', 'Done'); body.appendChild(status);
    } else if (kind === 'sunrise'){
      const cw = 220, ch = Math.round(cw*.8), cv = el('canvas', 'vw-view'); cv.width = cw*2; cv.height = ch*2; cv.setAttribute('aria-hidden', 'true');
      const g = cv.getContext('2d'); g.scale(2, 2); view95(g, 0, 0, cw, ch, FX.dark && FX.dark()); body.appendChild(cv); status = el('div', 'vw-status vw-grip', ''); body.appendChild(status);
    } else if (kind === 'notepad'){                 /* a note being written, by nobody */
      const bar = el('div', 'vw-mbar'); bar.setAttribute('aria-hidden', 'true'); ['File', 'Edit', 'Search', 'Help'].forEach(t => bar.appendChild(el('span', null, t))); body.appendChild(bar);
      const pad = el('div', 'vw-pad'); body.appendChild(pad); typed(pad, (ev.lines || []).map(fill).join('\n')); const caret = el('i', 'vw-caret'); caret.setAttribute('aria-hidden', 'true'); pad.appendChild(caret);
    } else if (kind === 'player'){                  /* something playing, quietly, with no sound */
      const lcd = el('div', 'vw-lcd'), top = el('div', 'vw-lcdt'), tm = el('span', null, ''); top.append(el('span', null, 'TRACK ' + fill(ev.track || '01')), tm);
      const bars = el('div', 'vw-bars'); bars.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 16; i++) bars.appendChild(el('i'));
      lcd.append(top, el('div', 'vw-lcdj', fill(ev.jp || '')), el('div', 'vw-lcde', fill(ev.en || '')), bars); body.appendChild(lcd);
      const seek = el('div', 'vw-seek'), knob = el('s'); seek.setAttribute('aria-hidden', 'true'); seek.appendChild(knob); body.appendChild(seek);
      const ctl = el('div', 'vw-ctl'); ['Play', 'Pause', 'Stop'].forEach(k => { const b = el('button', 'vw-pb vw-' + k.toLowerCase()); b.type = 'button'; b.setAttribute('aria-label', k); ctl.appendChild(b); }); body.appendChild(ctl);
      const len = ev.length || 213; let sec = Math.min(len - 1, ev.from || 0), playing = true;
      const two = n => (n < 10 ? '0' : '') + n, draw = () => { tm.textContent = two(Math.floor(sec/60)) + ':' + two(sec % 60); knob.style.left = (sec/len*92).toFixed(1) + '%'; };
      const beat = still => [...bars.children].forEach((b, i) => { b.style.height = (still ? 4 + (i*7) % 13 : 3 + Math.round((.5 + .5*Math.sin(sec*1.7 + i*1.3))*(7 + 12*Math.random()))) + 'px'; });
      draw(); beat(true); tick = setInterval(() => { if (!playing) return; sec = (sec + 1) % len; draw(); if (!instant()) beat(false); }, 1000);
      ctl.children[0].addEventListener('click', () => { playing = true; }); ctl.children[1].addEventListener('click', () => { playing = false; }); ctl.children[2].addEventListener('click', () => { playing = false; sec = 0; draw(); beat(true); });
    } else {
      const row = el('div', 'vw-msg'); if (ev.icon){ const i = el('img', 'vw-ico'); i.alt = ''; i.src = icon(ev.icon); row.appendChild(i); }
      msg = el('p'); msg.id = uid + 't'; typed(msg, fill(ev.text)); row.appendChild(msg); body.appendChild(row); win.setAttribute('aria-describedby', msg.id);
      if (kind === 'progress'){                     /* a job that takes its time */
        const well = el('div', 'vw-prog'), bar = el('i'); well.setAttribute('aria-hidden', 'true'); well.appendChild(bar); body.appendChild(well); status = el('div', 'vw-status', ''); body.appendChild(status);
        const end = ev.stopAt || 100; let pc = Math.min(end, ev.from || 0); const put = () => { bar.style.width = pc + '%'; status.textContent = pc + '%'; };
        put(); tick = setInterval(() => { pc = Math.min(end, pc + 1 + Math.floor(Math.random()*4)); put(); if (pc >= end){ clearInterval(tick); if (ev.done){ if (typeJob) typeJob(); msg.textContent = fill(ev.done); } } }, 850);
      }
    }
    const btns = el('div', 'vw-btns');
    (ev.buttons || []).forEach((bd, i) => { const b = el('button', 'vw-btn' + (i ? '' : ' vw-def'), fill(bd.label)); b.type = 'button'; if (bd.disabled) b.disabled = true; b.addEventListener('click', () => act(bd)); btns.appendChild(b); });
    if ((ev.buttons || []).length) body.appendChild(btns);
    /* the window menu */
    const menu = el('div', 'vw-menu'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', fill(ev.title || 'Window')); menu.hidden = true;
    const mi = (label, fn) => { const b = el('button', 'vw-mi', label); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.tabIndex = -1; b.addEventListener('click', fn); menu.appendChild(b); return b; };
    mi('Close', () => leave('close')); mi("Don't show these", () => { setVoff(true); dispatchEvent(new Event('vw:visitors')); });
    win.appendChild(menu);
    layer.appendChild(win);

    /* where */
    let jumps = 0, timer = 0, held = false, lastStamp = null;
    const place = p => { c.pos = p; win.style.left = Math.round(p[0]) + 'px'; win.style.top = Math.round(p[1]) + 'px'; }; c.place = place;
    const was = how === 'again' && vget().open, sp = roomy ? places(c, kind) : narrowSpot(c);
    if (!sp.length){ clearInterval(tick); clearTimeout(typing); win.remove(); return null; }
    const pk = sp[Math.random()*sp.length | 0]; win.style.width = pk.w + 'px';
    place(was && was.x != null && inView([was.x, was.y], win.offsetWidth, win.offsetHeight) ? [was.x, was.y] : [pk.x, pk.y]);
    if (instant()) win.classList.add('on'); else requestAnimationFrame(() => requestAnimationFrame(() => win.classList.add('on')));
    live.push(c);
    if (ev.ambient) remember(ev.id);
    else if (how !== 'again') vupd(s => { const t = Date.now(); s.seen[ev.id] = { at:t }; s.last = t; s.count = (s.count || 0) + 1;
      if (s.day !== dayOf(t)){ s.day = dayOf(t); s.dayN = 0; } s.dayN = (s.dayN || 0) + 1; if (ev.rare) s.rareLast = t; if (ev.stay === 'persist') s.open = { id:ev.id }; });

    /* going: it breaks up and is gone (the copies it left, if any, go after it, one at a time) */
    const answer = a => { if (!ev.ambient) vupd(s => { if (s.seen[ev.id]) s.seen[ev.id].b = a; }); };
    const leave = a => { if (c.gone) return; c.gone = true; clearTimeout(timer); clearInterval(tick); clearTimeout(typing); if (a != null) answer(a);
      if (ev.stay === 'persist') vupd(s => { s.open = null; });
      win.classList.remove('on'); win.classList.add('off');
      c.stamps.forEach((k, i) => setTimeout(() => k.remove(), instant() ? 0 : 60 + 45*i));
      const rm = () => { win.remove(); const i = live.indexOf(c); if (i >= 0) live.splice(i, 1); went(); }; if (instant()) rm(); else setTimeout(rm, 520); };
    c.leave = leave;
    const jump = () => { const sp2 = (roomy ? places(c, kind) : narrowSpot(c)).filter(p => Math.hypot(p.x - c.pos[0], p.y - c.pos[1]) > 120); if (!sp2.length) return false;
      const p = sp2[Math.random()*sp2.length | 0];
      if (instant()){ win.style.width = p.w + 'px'; place([p.x, p.y]); return true; }
      win.classList.remove('on'); win.classList.add('off'); setTimeout(() => { if (c.gone) return; win.style.width = p.w + 'px'; place([p.x, p.y]); win.classList.remove('off'); void win.offsetWidth; win.classList.add('on'); }, 500); return true; };
    const say = (text, ms) => { if (typeJob) typeJob(); if (msg) msg.textContent = text; else if (status) status.textContent = text; btns.remove(); clearTimeout(timer); timer = setTimeout(() => leave(null), ms); };
    const act = bd => { answer(bd.label);
      if (bd.do === 'reply') say(fill(bd.say || ''), 2600);
      else if (bd.do === 'flee'){ if (jumps < 2 && jump()){ jumps++; return; } leave(null); }
      else if (bd.do === 'open'){ leave(null); const nx = EV[bd.open]; if (nx) setTimeout(() => show(nx, 'open'), instant() ? 0 : 560); }
      else leave(null); };
    bX.addEventListener('click', () => {
      if (ev.stay === 'evade'){ if (jumps < 2 && jump()){ jumps++; return; } if (ev.lastWord){ answer('close'); say(fill(ev.lastWord), 1800); return; } }
      leave('close'); });
    if (bMin) bMin.addEventListener('click', () => leave(null));
    /* it leaves by itself after a while (not while you're in it), unless it stays: the other pointer comes and closes it */
    const life = how === 'preview' ? lifeQ*1000 : ev.stay === 'persist' ? 0 : !roomy ? P.fadeAfterSeconds*1000 : ev.ambient ? rand(P.staySeconds)*1000 : P.fadeAfterSeconds*1000;
    const arm = ms => { if (!ms) return; clearTimeout(timer); timer = setTimeout(() => { if (c.gone) return; if (held || curBusy){ arm(4000); return; }
      (ev.smear ? ghostSmear(c) : ghostClose(c)).then(done => { if (!done && !c.gone) leave(null); }); }, ms); };
    arm(life);
    win.addEventListener('pointerenter', () => { held = true; }); win.addEventListener('pointerleave', () => { held = false; });
    win.addEventListener('focusin', () => { held = true; }); win.addEventListener('focusout', () => { held = false; });
    /* a shy one goes as soon as your pointer comes near */
    if (ev.stay === 'shy'){ const born = Date.now(), near = e => { if (c.gone){ removeEventListener('pointermove', near); return; } if (Date.now() - born < 1600) return;
        const r = win.getBoundingClientRect(), dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        if (Math.hypot(dx, dy) < 70){ removeEventListener('pointermove', near); leave('shy'); } };
      addEventListener('pointermove', near, { passive:true }); }
    /* the menu */
    const items = () => [...menu.querySelectorAll('.vw-mi')];
    const openMenu = () => { menu.hidden = false; sys.setAttribute('aria-expanded', 'true'); items()[0].focus(); };
    const closeMenu = back => { menu.hidden = true; sys.setAttribute('aria-expanded', 'false'); if (back) sys.focus(); };
    sys.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu(true));
    menu.addEventListener('keydown', e => { const it = items(), i = it.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); it[(i + (e.key === 'ArrowDown' ? 1 : it.length - 1)) % it.length].focus(); } });
    const offMenu = e => { if (c.gone){ document.removeEventListener('pointerdown', offMenu, true); return; } if (!menu.hidden && !menu.contains(e.target) && !sys.contains(e.target)) closeMenu(false); };
    document.addEventListener('pointerdown', offMenu, true);
    /* Escape: the menu first, then the window */
    win.addEventListener('keydown', e => { if (e.key !== 'Escape') return; e.stopPropagation(); if (!menu.hidden) closeMenu(true); else leave('close'); });
    /* dragged by its title bar (a hung one leaves copies of itself along the way) */
    tb.addEventListener('pointerdown', e => {
      if (e.button || e.target.closest('button')) return; e.preventDefault();
      const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; try { tb.setPointerCapture(e.pointerId); } catch {} held = true; win.classList.add('vw-drag'); lastStamp = c.pos.slice();
      const mv = m => { const p = [Math.max(0, Math.min(innerWidth - r.width, m.clientX - dx)), Math.max(0, Math.min(innerHeight - 24, m.clientY - dy))];
        if (ev.smear && Math.hypot(p[0] - lastStamp[0], p[1] - lastStamp[1]) > 16){ stamp(c); lastStamp = p.slice(); } place(p); };
      const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); tb.removeEventListener('pointercancel', up); held = false; win.classList.remove('vw-drag');
        if (ev.stay === 'persist') vupd(s => { if (s.open){ s.open.x = c.pos[0]; s.open.y = c.pos[1]; } }); };
      tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up); });
    /* the screen changes size: it moves somewhere that still fits, or goes quietly */
    let rz = 0;
    const onResize = () => { if (c.gone){ removeEventListener('resize', onResize); return; } clearTimeout(rz); rz = setTimeout(() => { if (c.gone) return;
      const w = win.offsetWidth, h = win.offsetHeight; if (roomy ? free([c.pos[0], c.pos[1], w, h], c) : inView(c.pos, w, h)) return;
      const sp3 = wide() ? places(c, kind) : kind === 'dialog' ? narrowSpot(c) : []; if (sp3.length){ win.style.width = sp3[0].w + 'px'; place([sp3[0].x, sp3[0].y]); } else { c.gone = true; clearInterval(tick); clearTimeout(timer); c.stamps.forEach(k => k.remove()); win.remove(); const i = live.indexOf(c); if (i >= 0) live.splice(i, 1); } }, 200); };
    addEventListener('resize', onResize);
    return c;
  };

  /* ── the company: on a screen with margins somebody is usually about. The first turns up a few seconds after the page opens, once
        you've been still a moment; sometimes a second joins it; when the last one goes there's a short pause, then the next. Never
        more than two, and none while one of the site's own dialogs is open. ── */
  let nextAt = Date.now() + rand(P.firstAfterSeconds)*1000, secondAt = Infinity, waited = 0, lastAct = Date.now(), running = false;
  const went = () => { const n = openNow().length, t = Date.now(); if (!n){ nextAt = t + rand(P.gapSeconds)*1000; secondAt = Infinity; } else if (Math.random() < P.secondChance) secondAt = t + rand(P.secondAfterSeconds)*1000; };
  const stir = () => { lastAct = Date.now(); };
  const company = () => {
    if (!running || voff() || layer.hidden || document.hidden || !wide() || document.querySelector('dialog[open]')) return;
    const n = openNow().length, t = Date.now(); if (n >= P.maxOpen || t < (n ? secondAt : nextAt)) return;
    if (t - lastAct < P.idleSeconds*1000 && ++waited < 16) return;
    waited = 0;
    const ev = pickNext(), c = ev && show(ev, 'new'); if (!c){ if (n) secondAt = t + 6000; else nextAt = t + 3500; return; }
    secondAt = !n && Math.random() < P.secondChance ? t + rand(P.secondAfterSeconds)*1000 : Infinity; };
  ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(n => addEventListener(n, stir, { passive:true, capture:true }));
  setInterval(company, 700);
  /* turned off (a window's menu, or Start): they all go at once; turned on again: they come back in their own time */
  addEventListener('vw:visitors', () => { if (voff()) openNow().forEach(o => o.leave(null)); else if (wide()){ running = true; nextAt = Date.now() + 1500; } });

  /* ── this page: one called up to look at (?vwent=id, or a,b for two); a window that stays, back again; then the company, or on a narrow screen perhaps one visitor ── */
  if (preview){ const ids = preview === 'next' ? [null] : preview.split(',');
    ids.forEach((id, i) => setTimeout(() => { const ev = id ? EV[id] : (wide() ? pickNext() : pickRare(true)); if (ev) show(ev, 'preview'); }, 700 + i*900)); return; }
  if (voff()) return;
  const s0 = vget();
  if (s0.open && EV[s0.open.id]) setTimeout(() => show(EV[s0.open.id], 'again'), 700);
  if (wide()){ running = true; return; }
  if (s0.open && EV[s0.open.id]) return;
  const ev = pickRare(false); if (!ev) return;
  const a = P.appearAfterSeconds || [3, 9]; setTimeout(() => show(ev, 'new'), rand(a)*1000);
}
/* ═══════════════════════════════════════════════════════════════════
   The desktop's furniture (moderators only, with the rest of NEXT).
     · A taskbar along the foot of the screen: Start (the pages again,
       the Theme finder, Settings, the visitors on or off), a button for
       each page with this page's pressed in, a clock. Real links and
       buttons; nothing in it moves. Not on a narrow screen, and not
       while a game is open. (Only pages the site already links to.)
     (The faint grain is in the picture now, not over the page: over the
     windows and their text it was hard on the eyes. See makeNext.)
   ═══════════════════════════════════════════════════════════════════ */
const TASKS = [['home', 'Home', 'home.html', 'home'], ['timetable', 'Timetable', './', 'tt'], ['calendar', 'Calendar', 'calendar.html', 'cal'], ['free', 'Free periods', 'free.html', 'clock'],
  ['revision', 'Revision', 'revision.html', 'book'], ['resources', 'Resources', 'resources.html', 'folder'], ['games', 'Games', 'games.html', 'joy'], ['mahjong', 'Mahjong club', 'mahjong.html', 'tile']];
function desk(){
  if (!document.body || document.querySelector('.vw-task')) return;
  const PG = root.getAttribute('data-pg') || FX.page || '';
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const pix = n => { const i = el('img'); i.alt = ''; i.width = i.height = 16; i.src = icon(n); return i; };
  /* the taskbar */
  const bar = el('nav', 'vw-task'); bar.setAttribute('aria-label', 'Pages');
  const start = el('button', 'vw-start'); start.type = 'button'; start.setAttribute('aria-haspopup', 'menu'); start.setAttribute('aria-expanded', 'false'); start.append(pix('opaline'), el('span', null, 'Start'));
  const list = el('div', 'vw-tasks');
  TASKS.forEach(t => { const a = el('a', 'vw-tk'); a.href = t[2]; a.title = t[1]; if (t[0] === PG) a.setAttribute('aria-current', 'page'); a.append(pix(t[3]), el('span', null, t[1])); list.appendChild(a); });
  const tray = el('div', 'vw-tray'), clock = el('time', 'vw-clock');
  const tick = () => { const d = new Date(), h = d.getHours(), m = d.getMinutes(); clock.textContent = ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' AM' : ' PM');
    clock.dateTime = d.toISOString(); clock.title = d.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long', year:'numeric' }); };
  tick(); setInterval(tick, 15000);
  const spk = pix('spk'); spk.setAttribute('aria-hidden', 'true'); tray.append(spk, clock);
  /* the Start menu */
  const menu = el('div', 'vw-sm'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Start'); menu.hidden = true;
  const band = el('div', 'vw-smside'); band.setAttribute('aria-hidden', 'true'); band.appendChild(el('span', null, 'MSC Unofficial'));
  const items = el('div', 'vw-smlist'); menu.append(band, items);
  const mi = (node, ic, label) => { node.classList.add('vw-smi'); node.setAttribute('role', 'menuitem'); node.tabIndex = -1; node.append(pix(ic), el('span', null, label)); items.appendChild(node); return node; };
  const sep = () => items.appendChild(el('div', 'vw-smsep'));
  const all = () => [...items.querySelectorAll('.vw-smi')];
  const open = () => { menu.hidden = false; start.setAttribute('aria-expanded', 'true'); visSync(); all()[0].focus(); };
  const close = back => { if (menu.hidden) return; menu.hidden = true; start.setAttribute('aria-expanded', 'false'); if (back) start.focus(); };
  TASKS.forEach(t => { const a = el('a'); a.href = t[2]; mi(a, t[3], t[1]); });
  sep();
  { const a = el('a'); a.href = 'themes.html'; mi(a, 'paint', 'Theme finder'); }
  const gear = document.getElementById('themebtn');
  if (gear){ const b = el('button'); b.type = 'button'; mi(b, 'monitor', 'Settings…'); b.addEventListener('click', () => { close(false); gear.click(); }); }
  sep();
  const vis = el('button'); vis.type = 'button'; mi(vis, 'win', 'Visitors'); vis.setAttribute('role', 'menuitemcheckbox');
  const visSync = () => { vis.setAttribute('aria-checked', voff() ? 'false' : 'true'); };
  vis.addEventListener('click', () => { setVoff(!voff()); visSync(); dispatchEvent(new Event('vw:visitors')); });
  start.addEventListener('click', () => menu.hidden ? open() : close(true));
  menu.addEventListener('keydown', e => { const it = all(), i = it.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); it[(i + (e.key === 'ArrowDown' ? 1 : it.length - 1)) % it.length].focus(); }
    else if (e.key === 'Escape'){ e.preventDefault(); close(true); } else if (e.key === 'Tab') close(false); });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !start.contains(e.target)) close(false); }, true);
  bar.append(start, el('span', 'vw-tsep'), list, tray, menu);
  document.body.appendChild(bar);
  const sync = () => { const on = root.getAttribute('data-skin') === 'vapor'; bar.hidden = !on; root.classList.toggle('vw-desk', on); };
  sync(); addEventListener('tt:look', sync);
}
/* not inside a frame (the Mahjong board inside Games, a page previewed in the Theme finder): the page round it has its own */
const FRAMED = (() => { try { return window.top !== window; } catch { return true; } })();
if (NEXT && !FRAMED){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', desk, { once:true }); else desk(); }
if (NEXT && !FRAMED) startVisitors();
})();
