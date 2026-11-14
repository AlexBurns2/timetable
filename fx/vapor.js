/* ═══════════════════════════════════════════════════════════════════
   Vaporwave's backgrounds (fx.js loads this for that theme only).

   A different scene for each page, all in one hand: flat gradients of
   pink, violet and cyan, a few simple solid things in a dreamlike place,
   nothing photographic. Night in the dark version, a pastel day in the
   light one. Drawn on a 2D canvas, slowly, at thirty frames a second.
   Nothing follows the pointer, and there is no tape noise over it.

     home               drive   a road to a banded sun and a far skyline,
                                low-poly hills rising either side and
                                passing (a real mesh, seen in perspective)
     timetable,         checker a chequered floor running to the horizon,
     resources, mahjong         two columns, a moon, a ball
     calendar, notes    sunrise a sun half in a calm sea, its light in bands
     games, finder      planets a ringed planet, small moons, a turning gem
     free, revision     clouds  slow clouds and a ring of light
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const rnd = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s/4294967296; }; };
const hash = (a, b) => { let h = (a*374761393 + b*668265263) | 0; h = (h ^ (h >>> 13))*1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0)/4294967296; };
const PAGE = { home:'drive', timetable:'checker', resources:'checker', mahjong:'checker', calendar:'sunrise', notes:'sunrise',
               games:'planets', finder:'planets', free:'clouds', revision:'clouds' };

FX.scenes.vapor = {
  dpr:1, maxPx:1.0e6, fps:30,
  create(canvas, env){
    const x = canvas.getContext('2d'); if (!x) return null;
    const scene = PAGE[env.page] || 'clouds';
    let e = env, W = canvas.width, H = canvas.height;
    const r0 = rnd(77);
    const stars = Array.from({ length:110 }, () => [r0(), r0(), .35 + r0()*.65, r0()*6.28]);
    const sparks = Array.from({ length:9 }, () => [.06 + r0()*.88, .05 + r0()*.5, .5 + r0(), r0()*6.28]);
    const sky = Array.from({ length:44 }, () => [.25 + r0()*.75, r0() < .3 ? 2 : 1, r0()]);
    const far = Array.from({ length:13 }, (_, i) => i % 2 ? .07 + r0()*.1 : .015 + r0()*.03);
    const clouds = Array.from({ length:9 }, (_, i) => [r0(), .08 + r0()*.62, .6 + r0()*1.1, .004 + r0()*.01, i]);

    const grad = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
    const fillSky = (hy, stops) => { const g = grad(0, hy, stops); x.fillStyle = g; x.fillRect(0, 0, W, hy + 1); return g; };
    const drawStars = (t, maxY) => { x.fillStyle = '#fff'; stars.forEach(s => { x.globalAlpha = s[2]*(.5 + .5*Math.sin(t*1.1 + s[3])); x.fillRect(Math.round(s[0]*W), Math.round(s[1]*maxY), 1.6, 1.6); }); x.globalAlpha = 1; };
    const sparkle = (px, py, s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(px, py - s); x.quadraticCurveTo(px, py, px + s, py); x.quadraticCurveTo(px, py, px, py + s); x.quadraticCurveTo(px, py, px - s, py); x.quadraticCurveTo(px, py, px, py - s); x.fill(); };
    const drawSparks = (t, col) => sparks.forEach(s => { x.globalAlpha = .35 + .65*Math.abs(Math.sin(t*.7 + s[3])); sparkle(s[0]*W, s[1]*H, H*.012*s[2]*(1 + .25*Math.sin(t*1.3 + s[3])), col); x.globalAlpha = 1; });
    const cloud = (cx, cy, s, col) => { x.fillStyle = col; x.beginPath();
      [[-1.5, .1, .7], [-.7, -.25, .95], [.2, -.4, 1.1], [1.1, -.1, .85], [1.8, .15, .6]].forEach(b => { x.moveTo(cx + (b[0] + b[2])*s, cy + b[1]*s); x.arc(cx + b[0]*s, cy + b[1]*s, b[2]*s, 0, 6.2832); });
      x.rect(cx - 2.1*s, cy + .1*s, 4.4*s, .65*s); x.fill(); };
    /* a sun cut by bands that sink through its lower half */
    const sun = (cx, cy, R, c0, c1, t, cut) => {
      x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.clip();
      x.fillStyle = grad(cy - R, cy + R, [[0, c0], [1, c1]]); x.fillRect(cx - R, cy - R, R*2, R*2);
      if (cut){ x.fillStyle = cut; const off = (t*.03) % 1;                 /* the bands show the sky through */
        for (let i = 0; i < 9; i++){ const u = (i + off)/9; x.fillRect(cx - R, cy - R*.22 + u*u*R*1.2, R*2, 1.5 + u*R*.09); } }
      x.restore(); };
    /* a floor of squares in perspective */
    const checker = (hy, cx, f, a, b, drift) => {
      x.fillStyle = a; x.fillRect(0, hy, W, H - hy);
      x.fillStyle = b;
      for (let k = 0; k < 16; k++){ const z0 = .9 + k*.9, z1 = z0 + .9, y0 = hy + f/z1, y1 = hy + f/z0;
        for (let i = -16; i < 16; i++){ if ((i + k) & 1) continue; const X0 = i*1.1 + drift, X1 = X0 + 1.1;
          x.beginPath(); x.moveTo(cx + X0/z1*f, y0); x.lineTo(cx + X1/z1*f, y0); x.lineTo(cx + X1/z0*f, y1); x.lineTo(cx + X0/z0*f, y1); x.closePath(); x.fill(); } }
      x.fillStyle = grad(hy, hy + (H - hy)*.5, [[0, a], [1, 'rgba(0,0,0,0)']]); x.globalAlpha = .75; x.fillRect(0, hy, W, (H - hy)*.5); x.globalAlpha = 1; };
    /* a fluted column standing at (cx, base) */
    const column = (cx, base, w, h, lit, shade) => {
      const g = x.createLinearGradient(cx - w/2, 0, cx + w/2, 0); g.addColorStop(0, shade); g.addColorStop(.35, lit); g.addColorStop(.7, lit); g.addColorStop(1, shade);
      x.fillStyle = g; x.fillRect(cx - w/2, base - h, w, h);
      x.strokeStyle = shade; x.lineWidth = Math.max(1, w*.03); x.globalAlpha = .55; x.beginPath();
      for (let i = 1; i < 6; i++){ const fx2 = cx - w/2 + w*i/6; x.moveTo(fx2, base - h*.94); x.lineTo(fx2, base - h*.05); } x.stroke(); x.globalAlpha = 1;
      x.fillStyle = lit; x.fillRect(cx - w*.72, base - h*1.0, w*1.44, h*.045); x.fillRect(cx - w*.6, base - h*.955, w*1.2, h*.03);
      x.fillRect(cx - w*.66, base - h*.045, w*1.32, h*.045);
      x.fillStyle = shade; x.globalAlpha = .35; x.fillRect(cx + w*.25, base - h*1.0, w*.47, h*.045); x.fillRect(cx + w*.22, base - h*.045, w*.44, h*.045); x.globalAlpha = 1; };
    const ball = (cx, cy, R, c0, c1) => { const g = x.createRadialGradient(cx - R*.35, cy - R*.4, R*.1, cx, cy, R); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.fill(); };

    const S = {
      drive(t, dk){
        const hy = Math.round(H*.58), f = H*.9, cx = W/2;
        fillSky(hy, dk ? [[0, '#0a0220'], [.5, '#2c0b58'], [.85, '#7c1d80'], [1, '#ff4fa3']] : [[0, '#8f7bff'], [.5, '#c3a2ff'], [.85, '#ff9fd6'], [1, '#ffd9b8']]);
        if (dk) drawStars(t, hy*.8);
        sun(cx, hy - H*.07, H*.27, dk ? '#ffe66d' : '#fff7bd', dk ? '#ff2a8a' : '#ff86c8', t, dk ? '#3a1068' : '#b89cff');
        /* far hills, then the skyline */
        x.fillStyle = dk ? '#1c0a3c' : '#cdb1ff'; x.strokeStyle = dk ? 'rgba(1,205,254,.55)' : 'rgba(255,255,255,.8)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(0, hy); far.forEach((v, i) => x.lineTo(i/(far.length - 1)*W, hy - v*H)); x.lineTo(W, hy); x.closePath(); x.fill(); x.stroke();
        let bx = cx - W*.3; const bw = W*.6/56;
        sky.forEach((b, i) => { const w = bw*b[1]*1.2, hgt = b[0]*H*(.03 + .1*Math.exp(-Math.pow((i - 22)/10, 2)));
          x.fillStyle = dk ? '#12062a' : '#a98ae6'; x.fillRect(bx, hy - hgt, w + .6, hgt);
          if (b[2] > .5){ x.fillStyle = dk ? '#ffd86b' : '#fff'; x.globalAlpha = .7; for (let wy = hy - hgt + 3; wy < hy - 3; wy += 5) if (((i*7 + wy) | 0) % 3) x.fillRect(bx + w*.3, wy, 1.4, 1.6); x.globalAlpha = 1; }
          bx += w; });
        /* the ground and the road */
        x.fillStyle = grad(hy, H, dk ? [[0, '#3a0d55'], [.3, '#0d0420'], [1, '#0d0420']] : [[0, '#ffd0e6'], [.3, '#e4d0ff'], [1, '#e4d0ff']]); x.fillRect(0, hy, W, H - hy);
        const px = (X, z) => cx + X/z*f, py = (z, h) => hy + (1 - (h || 0))/z*f, FAR = 34, ZS = 1.5;
        x.fillStyle = dk ? '#0a0318' : '#cdb6f5'; x.beginPath(); x.moveTo(px(-1.3, FAR), py(FAR)); x.lineTo(px(1.3, FAR), py(FAR)); x.lineTo(px(1.3, .8), py(.8)); x.lineTo(px(-1.3, .8), py(.8)); x.closePath(); x.fill();
        x.strokeStyle = dk ? 'rgba(1,205,254,.8)' : 'rgba(255,255,255,.95)'; x.lineWidth = 2; x.beginPath(); [-1.3, 1.3].forEach(X => { x.moveTo(px(X, FAR), py(FAR)); x.lineTo(px(X, .8), py(.8)); }); x.stroke();
        x.fillStyle = dk ? 'rgba(255,196,228,.5)' : 'rgba(255,255,255,.8)'; const dz = (t*2.2) % 3;
        for (let z = 3 - dz + .4; z < 28; z += 3){ const z2 = z + 1.1, w1 = .05/z*f, w2 = .05/z2*f;
          x.beginPath(); x.moveTo(px(0, z) - w1, py(z)); x.lineTo(px(0, z) + w1, py(z)); x.lineTo(px(0, z2) + w2, py(z2)); x.lineTo(px(0, z2) - w2, py(z2)); x.closePath(); x.fill(); }
        /* the hills beside the road: a mesh, its rows coming toward us */
        const adv = t*2.2/ZS, base = Math.floor(adv), frac = adv - base, NJ = 7;
        const hgt = (j, row) => j === 0 ? 0 : (.15 + 1.5*hash(j*31 + 7, row))*Math.min(1, j/2.4);
        x.lineWidth = 1; x.lineJoin = 'round';
        for (let k = Math.ceil(FAR/ZS); k >= 0; k--){ const zn = (k - frac)*ZS + .7, zf = zn + ZS; if (zn < .55) continue;
          x.globalAlpha = Math.min(1, (FAR - zn)/9);
          for (const side of [-1, 1]){
            x.beginPath();
            for (let j = 0; j < NJ; j++){ const X0 = side*(1.5 + j*1.3), X1 = side*(1.5 + (j + 1)*1.3), rn = base + k, rf = rn + 1;
              const a = [px(X0, zn), py(zn, hgt(j, rn))], b = [px(X1, zn), py(zn, hgt(j + 1, rn))], c = [px(X1, zf), py(zf, hgt(j + 1, rf))], d = [px(X0, zf), py(zf, hgt(j, rf))];
              x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.lineTo(d[0], d[1]); x.closePath(); x.moveTo(a[0], a[1]); x.lineTo(c[0], c[1]); }
            x.fillStyle = dk ? '#150730' : '#f3e6ff'; x.fill();
            x.strokeStyle = dk ? (side < 0 ? '#ff71ce' : '#01cdfe') : (side < 0 ? '#ff7fca' : '#58c8f0'); x.stroke();
          } }
        x.globalAlpha = 1;
      },
      checker(t, dk){
        const hy = Math.round(H*.62), f = H*.5, cx = W/2;
        fillSky(hy, dk ? [[0, '#120638'], [.6, '#5a1a86'], [1, '#ff6fb7']] : [[0, '#9be4ff'], [.55, '#c9c2ff'], [1, '#ffc9e6']]);
        if (dk) drawStars(t, hy*.7);
        /* a crescent */
        x.save(); x.beginPath(); x.arc(W*.82, H*.17, H*.07, 0, 6.2832); x.fillStyle = dk ? '#fff3c4' : '#ffffff'; x.fill();
        x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(W*.82 + H*.035, H*.17 - H*.012, H*.062, 0, 6.2832); x.fill(); x.restore();
        checker(hy, cx, f, dk ? '#1a0838' : '#ffffff', dk ? '#ff5fbf' : '#ff9ad5', (t*.06) % 2.2);
        const lit = dk ? '#e9dcff' : '#ffffff', sh = dk ? '#6a4fb0' : '#b9a7e8';
        column(W*.1, hy + f/2.4, W*.045, H*.46, lit, sh); column(W*.9, hy + f/2.4, W*.045, H*.46, lit, sh);
        x.fillStyle = 'rgba(40,10,80,.25)'; x.beginPath(); x.ellipse(W*.7, hy + f/1.55 + H*.06, H*.07, H*.014, 0, 0, 6.2832); x.fill();
        ball(W*.7, hy + f/1.55 - H*.01 + Math.sin(t*.6)*H*.012, H*.055, dk ? '#ff9bea' : '#ffb3f1', dk ? '#a512c9' : '#d05ae0');
        drawSparks(t, '#fff');
      },
      sunrise(t, dk){
        const hy = Math.round(H*.6), cx = W/2, R = H*.2;
        fillSky(hy, dk ? [[0, '#1b1147'], [.6, '#7a2c8f'], [1, '#ff7aa8']] : [[0, '#a9dcff'], [.55, '#ffc6e6'], [1, '#ffe9c9']]);
        if (dk) drawStars(t, hy*.6);
        const gl = x.createRadialGradient(cx, hy, R*.4, cx, hy, R*3); gl.addColorStop(0, dk ? 'rgba(255,170,150,.5)' : 'rgba(255,255,255,.7)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gl; x.fillRect(0, 0, W, hy);
        clouds.slice(0, 5).forEach(c => cloud(((c[0] + t*c[3]) % 1.3 - .15)*W, hy*(.2 + c[1]*.75), H*.03*c[2], dk ? 'rgba(255,190,230,.22)' : 'rgba(255,255,255,.7)'));
        x.save(); x.beginPath(); x.rect(0, 0, W, hy); x.clip(); sun(cx, hy + R*.12, R, dk ? '#ffd27a' : '#ffb199', dk ? '#ff5d8f' : '#ff8fa8', t, false); x.restore();
        /* the sea, and the sun's light on it in bands that shimmer */
        x.fillStyle = grad(hy, H, dk ? [[0, '#ff7aa8'], [.12, '#5a2a8a'], [1, '#120a3a']] : [[0, '#ffe9c9'], [.15, '#c9d6ff'], [1, '#9fc4ff']]); x.fillRect(0, hy, W, H - hy);
        x.fillStyle = dk ? '#ffb37a' : '#fff4e0';
        for (let i = 0; i < 16; i++){ const u = i/16, y = hy + 3 + u*u*(H - hy)*.95, w = R*(1.7 - u*1.1)*(1 + .12*Math.sin(t*.9 + i*1.7));
          x.globalAlpha = .75*(1 - u*.85); x.fillRect(cx - w/2 + Math.sin(t*.6 + i)*R*.06, y, w, 1.5 + u*H*.012); }
        x.globalAlpha = 1;
      },
      planets(t, dk){
        const hy = Math.round(H*.8), cx = W*.68, cy = H*.34, R = H*.2;
        fillSky(H, dk ? [[0, '#07021c'], [.6, '#2a0a5c'], [1, '#5a1478']] : [[0, '#b9a8ff'], [.6, '#f1b8ee'], [1, '#ffd7c2']]);
        drawStars(t, H*.8);
        const ring = (front) => { x.save(); x.translate(cx, cy); x.rotate(-.32); x.scale(1, .26);
          [[2.15, 9, dk ? '#ff71ce' : '#ff9ad5'], [1.82, 7, dk ? '#ffe66d' : '#fff3a8'], [1.56, 4, dk ? '#ff71ce' : '#ffffff']].forEach(r => { x.strokeStyle = r[2]; x.lineWidth = R*r[1]/100/.26;
            x.beginPath(); x.arc(0, 0, R*r[0], front ? 0 : Math.PI, front ? Math.PI : 6.2832); x.stroke(); }); x.restore(); };
        ring(false);
        ball(cx, cy, R, dk ? '#fff08a' : '#fff6c8', dk ? '#ff8a2a' : '#ffb07a');
        x.fillStyle = dk ? '#ff5fbf' : '#ff9ad5'; [[-.35, -.2, .2], [.3, .28, .13], [.08, -.5, .09]].forEach(s => { x.beginPath(); x.arc(cx + s[0]*R, cy + s[1]*R, s[2]*R, 0, 6.2832); x.fill(); });
        ring(true);
        ball(W*.16, H*.2 + Math.sin(t*.4)*H*.01, H*.045, dk ? '#9ff3ff' : '#d8fbff', dk ? '#1d7fd0' : '#6fbdf0');
        ball(W*.3, H*.56 + Math.sin(t*.33 + 2)*H*.012, H*.028, dk ? '#ffb3f1' : '#ffd3f6', dk ? '#b01fc0' : '#e07be6');
        /* a gem, turning */
        { const gx = W*.12, gy = H*.62, gr = H*.075, a = t*.35, ca = Math.cos(a), sa = Math.sin(a);
          const P = [[0, -1.3, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, 1.3, 0]].map(p => { const X = p[0]*ca + p[2]*sa, Z = -p[0]*sa + p[2]*ca; return [gx + X*gr, gy + (p[1] + Z*.22)*gr, Z]; });
          [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]].map(fc => [fc, (P[fc[0]][2] + P[fc[1]][2] + P[fc[2]][2])/3]).sort((p, q) => p[1] - q[1]).forEach((fc, i) => {
            x.beginPath(); x.moveTo(P[fc[0][0]][0], P[fc[0][0]][1]); x.lineTo(P[fc[0][1]][0], P[fc[0][1]][1]); x.lineTo(P[fc[0][2]][0], P[fc[0][2]][1]); x.closePath();
            x.fillStyle = ['#ff71ce', '#b967ff', '#01cdfe', '#fffb96'][(fc[0][1] + fc[0][2]) % 4]; x.globalAlpha = fc[1] > 0 ? .95 : .55; x.fill(); x.globalAlpha = 1; x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1; x.stroke(); }); }
        /* a faint floor */
        x.strokeStyle = dk ? 'rgba(255,113,206,.5)' : 'rgba(255,255,255,.8)'; x.lineWidth = 1; x.beginPath();
        for (let i = -16; i <= 16; i++){ x.moveTo(W/2 + i*10, hy); x.lineTo(W/2 + i*W/8, H); }
        const zo = (t*.25) % 1; for (let i = 1; i < 9; i++){ const z = i - zo; if (z < .7) continue; const y = hy + (H - hy)/z; x.moveTo(0, y); x.lineTo(W, y); }
        x.moveTo(0, hy); x.lineTo(W, hy); x.stroke();
        drawSparks(t, dk ? '#fff' : '#ffffff');
      },
      clouds(t, dk){
        fillSky(H, dk ? [[0, '#150a45'], [.55, '#6a2796'], [1, '#ff8fc3']] : [[0, '#8fd6ff'], [.5, '#c8c0ff'], [1, '#ffd0e8']]);
        if (dk) drawStars(t, H*.6);
        /* a ring of light, standing */
        const cx = W/2, cy = H*.56, R = Math.min(H*.3, W*.3);
        [[R*.05, .16], [R*.022, .5], [Math.max(1.5, R*.008), 1]].forEach(g => { x.strokeStyle = dk ? '#ff9bea' : '#ffffff'; x.globalAlpha = g[1]; x.lineWidth = g[0]; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.stroke(); });
        x.globalAlpha = 1;
        clouds.forEach(c => { const far2 = c[4] % 3; cloud(((c[0] + t*c[3]*(1 + far2*.6)) % 1.4 - .2)*W, H*(.12 + c[1]*1.1), H*(.03 + far2*.022)*c[2], dk ? 'rgba(255,200,240,' + (.16 + far2*.1) + ')' : 'rgba(255,255,255,' + (.55 + far2*.18) + ')'); });
        ball(W*.84, H*.24 + Math.sin(t*.45)*H*.012, H*.05, dk ? '#ffb3f1' : '#ffd3f6', dk ? '#b01fc0' : '#e07be6');
        drawSparks(t, '#fff');
      }
    };
    return {
      frame(t){ x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; S[scene](t, e.dark); },
      resize(w, h){ W = w; H = h; },
      env(n){ e = n; },
      dispose(){}
    };
  }
};
})();
