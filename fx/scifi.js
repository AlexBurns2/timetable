/* ═══════════════════════════════════════════════════════════════════
   Cyberpunk's backgrounds and instruments (fx.js loads this for that
   theme only).

   A different wireframe study behind each page, all drawn the same way
   (thin pale lines on near-black, a little lime), on a 2D canvas:

     home               structure  a geodesic core in a gantry ring, a
                                   graduated dial, an outer track
     timetable, notes   tunnel     a square tunnel, coming on slowly
     calendar,          globe      a turning globe of meridians and
     resources                     parallels, its equator lit
     games, mahjong     blocks     a field of squares that switch on and off
     finder             radar      rings, a sweep, and what it finds
     free, revision     ridges     ridgelines, one behind another

   The first two lean a little toward the pointer; nothing else follows it.

   Also here, because they are this theme's and nobody else's:
   · the status strip at the top of each page (.cy-hud): the page, the
     time to the second, whether the device is online. All real.
   · a press on a button or a panel gives it a moment of interference
     (.cy-hit: colour only, it never moves or clips the element, or the
     click would be lost); the page title flickers about once a minute
     (.cy-glitch). Both only with Animation on.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const root = document.documentElement;
const on = () => root.getAttribute('data-fx') === 'on';
const PAGE = { home:'structure', timetable:'tunnel', notes:'tunnel', calendar:'globe', resources:'globe', games:'blocks', mahjong:'blocks',
               finder:'radar', free:'ridges', revision:'ridges' };
const hash = (a, b) => { let h = (a*374761393 + b*668265263) | 0; h = (h ^ (h >>> 13))*1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0)/4294967296; };
const pad = (n, l) => String(Math.abs(Math.round(n))).padStart(l, '0');
const INK = a => 'rgba(237,237,234,' + a + ')', LIME = a => 'rgba(212,255,0,' + a + ')';

function icosphere(){
  const t = (1 + Math.sqrt(5))/2, norm = p => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0]/l, p[1]/l, p[2]/l]; };
  const V = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
  const F = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const mid = {}, m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a;
    if (mid[k] == null){ mid[k] = V.length; V.push(norm([(V[a][0] + V[b][0])/2, (V[a][1] + V[b][1])/2, (V[a][2] + V[b][2])/2])); } return mid[k]; };
  const E = new Set();
  F.forEach(f => { const ab = m(f[0], f[1]), bc = m(f[1], f[2]), ca = m(f[2], f[0]);
    [[f[0], ab], [ab, ca], [ca, f[0]], [f[1], bc], [bc, ab], [ab, f[1]], [f[2], ca], [ca, bc], [bc, f[2]]].forEach(e => E.add(e[0] < e[1] ? e[0]*1000 + e[1] : e[1]*1000 + e[0])); });
  return { V, E:[...E].map(k => [Math.floor(k/1000), k % 1000]) };
}

FX.scenes.scifi = {
  dpr:1.5, maxPx:2.4e6,
  create(canvas, env){
    const x = canvas.getContext('2d'); if (!x) return null;
    const scene = PAGE[env.page] || 'tunnel', core = scene === 'structure' ? icosphere() : null;
    let e = env, S = 1, W = innerWidth, H = innerHeight, lx = .5, ly = .5;
    const blips = Array.from({ length:8 }, (_, i) => [hash(i, 3)*6.2832, .18 + hash(i, 9)*.78]);

    /* ── the status strip and the small interferences ── */
    const wrap = document.querySelector('.wrap');
    let hud = null, tick = 0, glitch = 0;
    if (wrap){
      hud = document.createElement('div'); hud.className = 'cy-hud'; hud.setAttribute('aria-hidden', 'true');
      hud.innerHTML = '<b>SYS</b><span>MSC-UNOFFICIAL/<em>' + (FX.page || 'page').toUpperCase() + '</em></span><span class="c"></span><span class="n"></span>';
      wrap.insertBefore(hud, wrap.firstChild);
      const q = s => hud.querySelector(s);
      const paint = () => { const d = new Date();
        q('.c').innerHTML = '<em>' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '</em>';
        q('.n').innerHTML = 'NET <em class="' + (navigator.onLine ? 'ok">ONLINE' : 'bad">OFFLINE') + '</em>'; };
      paint(); tick = setInterval(paint, 1000);
    }
    const HIT = '.btn,.qtile,.tday,.gamecard,.arrowbtn,.popt,.modes button,.dayswitch button';
    const onDown = ev => {
      if (!on()) return;
      const el = ev.target && ev.target.closest ? ev.target.closest(HIT) : null; if (!el) return;
      el.classList.remove('cy-hit'); void el.offsetWidth; el.classList.add('cy-hit');
      setTimeout(() => el.classList.remove('cy-hit'), 240);
    };
    document.addEventListener('pointerdown', onDown, { passive:true });
    const armGlitch = () => { glitch = setTimeout(() => {
      const h = document.querySelector('.hubid h1, .brand h1, .pagehead h1');
      if (h && on() && !document.hidden){ h.classList.add('cy-glitch'); setTimeout(() => h.classList.remove('cy-glitch'), 320); }
      armGlitch();
    }, 55000 + Math.random()*60000); };
    armGlitch();

    const line = (a, b) => { x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); };
    const loop = pts => { for (let i = 0; i < pts.length; i++) line(pts[i], pts[(i + 1) % pts.length]); };
    const S3 = {
      structure(t, px, py){
        const cx = W*(W > 900 ? .8 : .62), cy = H*.44, R = Math.min(H*.33, W*.36);
        const yaw = t*.07 + px*.5, pit = .42 + Math.sin(t*.05)*.1 + py*.3;
        const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
        const tf = p => { const X = p[0]*cyw + p[2]*syw, z0 = -p[0]*syw + p[2]*cyw, Y = p[1]*cp - z0*sp, Z = p[1]*sp + z0*cp, f = 4.4/(4.4 + Z); return [cx + X*R*f, cy + Y*R*f, Z]; };
        const P = core.V.map(tf);
        x.strokeStyle = INK(.1); x.beginPath(); core.E.forEach(ed => { if (P[ed[0]][2] + P[ed[1]][2] > 0) line(P[ed[0]], P[ed[1]]); }); x.stroke();
        x.strokeStyle = INK(.32); x.beginPath(); core.E.forEach(ed => { if (P[ed[0]][2] + P[ed[1]][2] <= 0) line(P[ed[0]], P[ed[1]]); }); x.stroke();
        const ring = (r, n, a0, tilt, twist) => { const ct = Math.cos(tilt), st = Math.sin(tilt), cw = Math.cos(twist), sw = Math.sin(twist), out = [];
          for (let i = 0; i < n; i++){ const a = a0 + i/n*6.2831853, X = Math.cos(a)*r, Z = Math.sin(a)*r, y1 = -Z*st, z1 = Z*ct; out.push(tf([X*cw - y1*sw, X*sw + y1*cw, z1])); }
          return out; };
        const ga = ring(1.52, 12, t*.11, .5, .2), gb = ring(1.7, 12, t*.11, .5, .2);
        x.strokeStyle = INK(.28); x.beginPath(); loop(ga); loop(gb); ga.forEach((p, i) => line(p, gb[i])); x.stroke();
        const da = ring(2.18, 72, -t*.05, -.32, -.14), db = ring(2.27, 72, -t*.05, -.32, -.14), dc = ring(2.4, 72, -t*.05, -.32, -.14);
        x.strokeStyle = INK(.2); x.beginPath(); loop(da); da.forEach((p, i) => line(p, i % 6 ? db[i] : dc[i])); x.stroke();
        const lit = Math.floor(t*2.2) % 72;
        x.strokeStyle = LIME(.9); x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 7; i++) line(da[(lit + i) % 72], da[(lit + i + 1) % 72]); x.stroke(); x.lineWidth = 1;
        const tr = ring(2.95, 90, t*.03, .08, .5);
        x.strokeStyle = INK(.14); x.setLineDash([5, 7]); x.beginPath(); loop(tr); x.stroke(); x.setLineDash([]);
        [0, 45].forEach((i, n) => { const p = tr[i]; x.fillStyle = n ? INK(.7) : LIME(1); x.fillRect(p[0] - 3, p[1] - 3, 7, 7); });
      },
      tunnel(t, px, py){
        const cx = W*(.5 - px*.1), cy = H*(.46 - py*.08), N = 13, fr = (t*.1) % 1, dim = W < 700 ? .5 : 1;
        for (let i = 0; i < N; i++){ const k = i + fr, s = Math.pow(1.42, k), hw = W*.018*s, hh = H*.016*s;
          x.strokeStyle = (Math.floor(t*.1) + i) % 4 === 0 ? LIME(.26*dim*Math.min(1, k/2)) : INK(.15*dim*Math.min(1, k/2)); x.strokeRect(cx - hw, cy - hh, hw*2, hh*2); }
        x.strokeStyle = INK(.1); x.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]].forEach(d => line([cx + d[0]*W*.018, cy + d[1]*H*.016], [cx + d[0]*W*1.6, cy + d[1]*H*1.5]));
        x.stroke();
      },
      globe(t){
        const cx = W*(W > 900 ? .8 : .6), cy = H*.46, R = Math.min(H*.36, W*.34), yaw = t*.09, tilt = .42, ct = Math.cos(tilt), st = Math.sin(tilt);
        const P = (la, lo) => { const c = Math.cos(la), X = c*Math.sin(lo + yaw), Y = Math.sin(la), Z = c*Math.cos(lo + yaw); return [cx + X*R, cy - (Y*ct - Z*st)*R, Y*st + Z*ct]; };
        const front = [], back = [], eq = [];
        const seg = (a, b, into) => (a[2] + b[2] > 0 ? (into || front) : back).push(a, b);
        for (let m = 0; m < 12; m++){ let prev = P(-1.5708, m/12*6.2832); for (let i = 1; i <= 24; i++){ const p = P(-1.5708 + i/24*3.1416, m/12*6.2832); seg(prev, p); prev = p; } }
        for (let k = -3; k <= 3; k++){ let prev = P(k*.3927, 0); for (let i = 1; i <= 48; i++){ const p = P(k*.3927, i/48*6.2832); seg(prev, p, k ? null : eq); prev = p; } }
        const draw = (arr, col) => { x.strokeStyle = col; x.beginPath(); for (let i = 0; i < arr.length; i += 2) line(arr[i], arr[i + 1]); x.stroke(); };
        draw(back, INK(.07)); draw(front, INK(.26)); draw(eq, LIME(.8));
        x.strokeStyle = INK(.14); x.beginPath(); x.arc(cx, cy, R*1.18, 0, 6.2832); x.stroke();
        /* three flattened globes, overlapping, as on a label */
        const gx = Math.min(150, W*.13), gy = H*.74, gw = Math.min(70, W*.07);
        x.strokeStyle = INK(.22); x.beginPath();
        for (let i = 0; i < 3; i++){ const ox = gx + i*gw*.8; x.moveTo(ox + gw, gy); x.ellipse(ox, gy, gw, gw*.5, 0, 0, 6.2832); x.moveTo(ox + gw*.5, gy); x.ellipse(ox, gy, gw*.5, gw*.5, 0, 0, 6.2832); x.moveTo(ox - gw, gy); x.lineTo(ox + gw, gy); }
        x.stroke();
      },
      blocks(t){
        const c = Math.max(64, Math.round(H/8)), cols = Math.ceil(W/c) + 1, rows = Math.ceil(H/c) + 1;
        x.strokeStyle = INK(.06); x.beginPath(); for (let i = 0; i <= cols; i++) line([i*c + .5, 0], [i*c + .5, H]); for (let j = 0; j <= rows; j++) line([0, j*c + .5], [W, j*c + .5]); x.stroke();
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++){ const h0 = hash(i, j), v = hash(i*7 + 3, j*13 + Math.floor(t/2.6 + h0*4));
          if (v < .05){ x.fillStyle = LIME(.1); x.fillRect(i*c + 1, j*c + 1, c - 1, c - 1); }
          else if (v < .12){ x.fillStyle = INK(.045); x.fillRect(i*c + 1, j*c + 1, c - 1, c - 1); }
          else if (v < .15){ x.fillStyle = INK(.3); x.fillRect(i*c + c/2 - 5, j*c + c/2, 11, 1); x.fillRect(i*c + c/2, j*c + c/2 - 5, 1, 11); }
          else if (v < .162){ x.fillStyle = LIME(.7); x.fillRect(i*c + c/2 - 4, j*c + c/2 - 4, 9, 9); } }
      },
      radar(t){
        const cx = W*(W > 900 ? .8 : .6), cy = H*.5, R = Math.min(H*.42, W*.4), a = t*.55;
        x.strokeStyle = INK(.14); x.beginPath(); for (let k = 1; k <= 5; k++){ x.moveTo(cx + R*k/5, cy); x.arc(cx, cy, R*k/5, 0, 6.2832); }
        line([cx - R, cy], [cx + R, cy]); line([cx, cy - R], [cx, cy + R]); x.stroke();
        for (let k = 0; k < 26; k++){ x.strokeStyle = LIME(.22*(1 - k/26)); x.beginPath(); line([cx, cy], [cx + Math.cos(a - k*.022)*R, cy + Math.sin(a - k*.022)*R]); x.stroke(); }
        blips.forEach(b => { const d = ((a - b[0]) % 6.2832 + 6.2832) % 6.2832, lum = Math.exp(-d*1.1);
          x.fillStyle = LIME(.12 + .85*lum); x.fillRect(cx + Math.cos(b[0])*R*b[1] - 2.5, cy + Math.sin(b[0])*R*b[1] - 2.5, 5, 5); });
      },
      ridges(t){
        const N = 22, y0 = H*.3, dy = H*.7/N;
        for (let i = 0; i < N; i++){ const by = y0 + i*dy, mid = W*(.5 + .22*Math.sin(i*.9 + 1)), wid = W*(.2 + .08*Math.sin(i*1.7));
          x.beginPath(); x.moveTo(-4, H + 4); x.lineTo(-4, by);
          for (let px = 0; px <= W + 8; px += 8){ const env2 = Math.exp(-Math.pow((px - mid)/wid, 2));
            const n = .5 + .5*Math.sin(px*.013 + i*1.7 + t*.28)*Math.sin(px*.031 - i*.9 - t*.2) + .25*Math.sin(px*.07 + i*3.1 + t*.5);
            x.lineTo(px, by - env2*H*.1*Math.max(0, n)); }
          x.lineTo(W + 4, H + 4); x.closePath();
          x.fillStyle = '#0a0a0c'; x.fill(); x.strokeStyle = i % 6 === 3 ? LIME(.6) : INK(.26); x.stroke(); }
      }
    };
    function draw(t, dt, ptr){
      x.setTransform(S, 0, 0, S, 0, 0);
      x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, W, H);
      const live = e.animate, k = dt ? Math.min(1, dt*2.5) : 1;
      lx += ((ptr.on && live ? ptr.x : .5) - lx)*k; ly += ((ptr.on && live ? ptr.y : .5) - ly)*k;
      x.lineWidth = 1; x.font = '500 9px "JetBrains Mono", ui-monospace, monospace'; x.textBaseline = 'middle';
      if (scene !== 'blocks'){                              /* the measured field: a cross every so far */
        x.strokeStyle = INK(.1); x.beginPath();
        for (let gx = 48; gx < W; gx += 96) for (let gy = 48; gy < H; gy += 96){ x.moveTo(gx - 4, gy + .5); x.lineTo(gx + 5, gy + .5); x.moveTo(gx + .5, gy - 4); x.lineTo(gx + .5, gy + 5); }
        x.stroke(); }
      S3[scene](t, lx - .5, ly - .5);
    }
    return {
      frame: draw,
      resize(w, h, sc){ S = sc; W = w/sc; H = h/sc; },
      env(n){ e = n; },
      dispose(){ clearInterval(tick); clearTimeout(glitch); document.removeEventListener('pointerdown', onDown); if (hud) hud.remove(); hud = null; }
    };
  }
};
})();
