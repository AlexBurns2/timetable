/* ═══════════════════════════════════════════════════════════════════
   Vaporwave's backgrounds (fx.js loads this for that theme only).

   A different scene for each page, all in one hand: deep violet skies
   running to pink at the horizon, a few solid things with real light
   and shade on them, set in a dreamlike place. Night in the dark
   version, a pastel dusk in the light one. Each scene keeps what there
   is to look at out at the sides, where the page doesn't cover it.
   Drawn on a 2D canvas, slowly, at thirty frames a second. Nothing
   follows the pointer, and there is no tape noise over it.

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

FX.scenes.vapor = {
  dpr:1, maxPx:2.1e6, fps:30,
  create(canvas, env){
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
})();
