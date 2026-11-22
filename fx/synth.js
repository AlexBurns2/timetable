/* ═══════════════════════════════════════════════════════════════════
   Synthwave's backgrounds (fx.js loads this for that theme only).

   Real 3D, drawn with Three.js (lib/three, MIT). The towers are CC0
   models by Kenney (models/synth/towers.glb, a lean vertex-coloured copy
   with no textures); everything else is made here: the car (a generic
   wedge, from its sections), the palms (seeded: trunk, fronds, leaflets),
   the grid, the crags, the sea, a pyramid, a planet, the sun. One light:
   a low sun, which also fills the sky the models reflect. Then fog and a
   soft bloom on what is brighter than white. No film grain.
   One idea a page, kept out at the sides:

     home                            drive    the car (a coupé of the nineties), from
                                              behind, on a lit grid that runs between
                                              faceted crags, their edges lit, to the
                                              banded sun; going by fast
     timetable                       bay      towers across the water, their windows
                                              lit in strips, the sun going down behind
                                              them; palms on a spit to the right. The
                                              calm one, for the page with most to read
     games, finder                   pyramid  a pyramid of glass and lit edges in still
                                              water, turning very slowly, a planet over it
     calendar, free, revision        shoreA   the quiet ones: the sun on the sea and one
     notes, resources, mahjong       shoreB   palm (the sun to one side, then the other)

   Dusk in light mode, night (deep violet, stars) in dark. The camera never
   follows the pointer and nothing shakes: the road comes toward us (fast,
   on Home) and the water moves, slowly, and the car eases across
   its road after the pointer, a little behind it. That's all. Thirty frames a second at most, drawn at no more than
   the screen's own pixels (fewer on a phone); fx.js stops it while the
   tab is hidden.

   Three.js is fetched only here, only for this theme, and only when it
   will move: with Animation off, Reduce motion (the site's or the
   device's), a device that looks weak (2 GB or less, two cores or less,
   Data Saver) or no WebGL 2, nothing is fetched and the stylesheet's
   still picture of the same scene stays (images/synth, rendered from this
   file: see STILL below).
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;
const root = document.documentElement;
const mm = q => { try { return matchMedia(q).matches; } catch { return false; } };
const SMALL = mm('(pointer:coarse)') || mm('(max-width:700px)');
/* STILL: the stills in images/synth are this file's own frames, taken with the page hidden (sessionStorage synth.still = 1,
   synth.t = the moment). Nothing else uses it. */
let STILL = false, STILL_T = 0;
try { STILL = sessionStorage.getItem('synth.still') === '1'; STILL_T = +sessionStorage.getItem('synth.t') || 0; } catch {}
const PAGE = { timetable:'bay', home:'drive', games:'pyramid', finder:'pyramid',
               calendar:'shoreA', free:'shoreA', revision:'shoreA', notes:'shoreB', resources:'shoreB', mahjong:'shoreB', hkmahjong:'shoreB' };
const MODELS = { bay:['towers'] };                // the only models fetched; the car and the palms are built here
const LIB = '/lib/three/three.module.min.js', REFL = '/lib/three/addons/Reflector.js';

function weak(){
  try {
    const n = navigator, c = n.connection || {};
    if (c.saveData || mm('(prefers-reduced-data: reduce)')) return true;
    if (n.deviceMemory && n.deviceMemory <= 2) return true;
    if (n.hardwareConcurrency && n.hardwareConcurrency <= 2) return true;
  } catch {}
  return false;
}
const rnd = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/* ── smooth noise in three dimensions (value noise, a few octaves), for the road's terrain ── */
const hash3 = (x, y, z, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise3(x, y, z, s){
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = x - xi, v = y - yi, w = z - zi;
  const f = t => t * t * (3 - 2 * t), a = f(u), b = f(v), c = f(w), h = (i, j, k) => hash3(xi + i, yi + j, zi + k, s);
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), a), lerp(h(0, 1, 0), h(1, 1, 0), a), b), lerp(lerp(h(0, 0, 1), h(1, 0, 1), a), lerp(h(0, 1, 1), h(1, 1, 1), a), b), c);
}
const fbm3 = (x, y, z, s, oct) => { let a = .5, t = 0, n = 0; for (let i = 0; i < oct; i++){ t += a * vnoise3(x, y, z, s + i * 17); n += a; x *= 2; y *= 2; z *= 2; a *= .5; } return t / n; };
/* bold lines a world-space grid draws: a core about two pixels wide whatever the distance (fwidth), a soft halo round it,
   and nothing where the cells get smaller than a few pixels (no moiré in the distance) */
const GLSL_GRID = 'float syGrid(vec2 q, float w, float f, float h){ vec2 fw = max(fwidth(q), vec2(1e-4)); vec2 d = abs(fract(q - .5) - .5) / fw;\n' +
  '  vec2 l = max(1. - smoothstep(vec2(w - .6), vec2(w + .6), d), exp(-d * .55) * h) * (1. - smoothstep(vec2(f * .2), vec2(f), fw)); return max(l.x, l.y); }\n';      // f: how small a cell (in cells a pixel) before its lines have gone; h: the halo

/* ── a palm, made here (seeded, so each variant is always the same palm). Seen mostly against the sky, so what counts is
   its outline: a slender trunk that tapers and curves, ringed where old fronds fell; a crown of 9 to 14 fronds, the young
   ones raised, the old ones hanging, each a curved stalk carrying 40 to 70 narrow leaflets a side that fall away from it in
   a shallow V, longest mid-frond, a few missing. Flat triangles (about 5,500), coloured per vertex: trunk or leaf. ── */
function palmArrays(seed){
  const r = rnd(seed), P = [], C = [];
  const TRUNK = [.03, .012, .018], LEAF = [.009, .02, .016];
  const tri = (a, b, c, k) => { P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); C.push(k[0], k[1], k[2], k[0], k[1], k[2], k[0], k[1], k[2]); };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  /* the trunk: leaning out along +x, more towards the top */
  const Ht = 9.6 + r() * 2.4, lean = .5 + r() * 1.9, bend = 1.4 + r() * .9, N = 48, S = 7;
  const at = t => [lean * Math.pow(t, bend), Ht * t, .25 * lean * Math.sin(t * 2.2)];
  let prev = null;
  for (let i = 0; i <= N; i++){
    const t = i / N, c = at(t), rad = (.19 * (1 - .45 * t) + .15 * Math.pow(1 - t, 9)) * (i % 3 === 0 ? 1.07 : 1), ring = [];
    for (let k = 0; k < S; k++){ const a = k / S * 6.2832; ring.push([c[0] + Math.cos(a) * rad, c[1], c[2] + Math.sin(a) * rad]); }
    if (prev) for (let k = 0; k < S; k++){ const k2 = (k + 1) % S; quad(prev[k], prev[k2], ring[k2], ring[k], TRUNK); }
    prev = ring;
  }
  /* the crown */
  const top = at(1), nF = 9 + Math.floor(r() * 6), rank = Array.from({ length:nF }, (_, i) => i / (nF - 1)).sort(() => r() - .5);
  for (let f = 0; f < nF; f++){
    const phi = f / nF * 6.2832 + (r() - .5) * .5, age = rank[f];
    const el = lerp(.95, -.55, age) + (r() - .5) * .25, L = 3.3 + r() * 1.5 + age * .7, g = .32 + age * .55 + r() * .15;
    const h = [Math.cos(phi), 0, Math.sin(phi)], ce = Math.cos(el), se = Math.sin(el);
    const pt = u => [top[0] + h[0] * L * u * ce, top[1] + L * u * se - g * L * u * u, top[2] + h[2] * L * u * ce];
    const tint = mul(LEAF, .75 + .5 * r());
    /* the stalk */
    let pr = null;
    for (let i = 0; i <= 12; i++){
      const u = i / 12, p = pt(u), tg = norm(sub(pt(u + .01), p)), sd = norm(cross(tg, [0, 1, 0])), up = norm(cross(sd, tg)), rr = .05 * (1 - u) + .012, ring = [];
      for (let k = 0; k < 3; k++){ const a = k / 3 * 6.2832; ring.push(add(p, add(mul(sd, Math.cos(a) * rr), mul(up, Math.sin(a) * rr)))); }
      if (pr) for (let k = 0; k < 3; k++){ const k2 = (k + 1) % 3; quad(pr[k], pr[k2], ring[k2], ring[k], tint); }
      pr = ring;
    }
    /* the leaflets */
    const nl = 40 + Math.floor(r() * 31), lmax = .72 + r() * .38;
    for (const side of [-1, 1]) for (let j = 0; j < nl; j++){
      if (r() < .05) continue;
      const u = .1 + .88 * (j + r() * .6) / nl, p = pt(u), tg = norm(sub(pt(u + .01), p)), sd = norm(cross(tg, [0, 1, 0])), up = norm(cross(sd, tg));
      const len = lmax * Math.pow(Math.sin(Math.PI * (.12 + .86 * u)), .6) * (.78 + .44 * r());
      const d1 = norm(add(add(mul(sd, side * .82), mul(tg, .5)), mul(up, -.22 - .25 * age)));
      const d2 = norm(add(add(mul(sd, side * .5), mul(tg, .42)), mul(up, -.9)));
      const m = add(p, mul(d1, len * .5)), e = add(m, mul(d2, len * .55)), w = mul(tg, .03 + .012 * r());
      quad(sub(p, w), add(p, w), add(m, mul(w, .8)), sub(m, mul(w, .8)), tint);
      tri(sub(m, mul(w, .8)), add(m, mul(w, .8)), e, tint);
    }
  }
  return { pos:new Float32Array(P), col:new Float32Array(C), h:Ht };
}
const PALM_SEEDS = [11, 23, 37];

/* ── the car: a coupé of the nineteen-nineties, made here from its sections, tail (-z) to nose (+z). Rounded where the old wedge
   was creased: a high soft tail, a short boot with a small wing on it, a fastback rear window, a low rounded nose, the wheels
   set into arches. 4.4 m long, 1.79 m wide, 1.27 m high. Each station below gives: z, the floor's height, the sill's half-width,
   the widest half-width, the belt line's height and half-width, and the height and half-width of the roof (or, where there is no
   cabin, the deck). Stations in between are eased from these, and each cross-section is rounded off, so nothing is flat-faced.
   No real car's lines. ── */
const CAR_ST = [
  [-2.20, .36, .66, .76,  .74,  .73,  .775, .66],
  [-2.13, .28, .76, .835, .80,  .80,  .83,  .72],
  [-1.90, .22, .83, .885, .845, .85,  .87,  .76],
  [-1.50, .19, .85, .895, .86,  .86,  .89,  .76],
  [-1.12, .18, .85, .89,  .87,  .855, .915, .72],      // the foot of the rear window
  [-0.55, .18, .85, .885, .88,  .85, 1.245, .57],      // its head: the roof
  [-0.10, .18, .85, .885, .88,  .85, 1.27,  .575],
  [ 0.35, .18, .85, .88,  .875, .845, 1.25, .57],      // the head of the windscreen
  [ 1.02, .18, .85, .88,  .86,  .845, .885, .70],      // its foot
  [ 1.45, .19, .84, .875, .80,  .84,  .835, .70],
  [ 1.90, .22, .80, .85,  .70,  .80,  .74,  .66],
  [ 2.12, .27, .72, .78,  .60,  .72,  .63,  .58],
  [ 2.20, .32, .58, .66,  .54,  .60,  .56,  .48]
];
const CAR_WHEELS = [[.775, 1.36], [-.775, 1.36], [.775, -1.32], [-.775, -1.32]], CAR_ARCH = .385;
function carArrays(){
  /* the stations eased (a cubic that never overshoots: the slope at each is the harmonic mean of the slopes either side) */
  const NK = CAR_ST.length, slope = (i, k) => { if (i <= 0 || i >= NK - 1) return 0;
    const a = (CAR_ST[i][k] - CAR_ST[i - 1][k]) / (CAR_ST[i][0] - CAR_ST[i - 1][0]), b = (CAR_ST[i + 1][k] - CAR_ST[i][k]) / (CAR_ST[i + 1][0] - CAR_ST[i][0]); return a * b <= 0 ? 0 : 2 * a * b / (a + b); };
  const at = z => { let i = 0; while (i < NK - 2 && z > CAR_ST[i + 1][0]) i++;
    const z0 = CAR_ST[i][0], h = CAR_ST[i + 1][0] - z0, t = clamp((z - z0) / h, 0, 1), t2 = t * t, t3 = t2 * t, out = [z];
    for (let k = 1; k < 8; k++) out.push((2 * t3 - 3 * t2 + 1) * CAR_ST[i][k] + (t3 - 2 * t2 + t) * h * slope(i, k) + (-2 * t3 + 3 * t2) * CAR_ST[i + 1][k] + (t3 - t2) * h * slope(i + 1, k));
    return out; };
  /* a cross-section, half of it, from the middle of the floor round to the middle of the roof: the body, the glass, the top, each rounded off (corners cut, twice) */
  const cut = (p, n) => { for (let it = 0; it < n; it++){ const q = [p[0]]; for (let i = 0; i < p.length - 1; i++){ const a = p[i], b = p[i + 1]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } q.push(p[p.length - 1]); p = q; } return p; };
  const half = st => { const [, yb, ws, wm, hb, wb, hr, wr] = st, he = hr - .022;
    const body = cut([[0, yb], [ws * .8, yb], [ws, yb + .05], [wm, yb + (hb - yb) * .42], [wb, hb]], 2);
    const glass = cut([[wb, hb], [(wb + wr) / 2 + .012, (hb + he) / 2], [wr, he]], 1), top = cut([[wr, he], [wr * .62, hr - .005], [0, hr]], 2);
    return body.concat(glass.slice(1), top.slice(1)); };
  const NB = 20, NG = 6, NP = NB + NG - 1 + 12 - 1, NR = 2 * NP - 2, ZS = [];           // points in the body, in the glass; in half a section; in the whole ring
  for (let z = -2.2; z < 2.2001; z += .05) ZS.push(Math.round(z * 100) / 100);
  const NS = ZS.length, V = [], IN = [];
  for (let s = 0; s < NS; s++){ const h = half(at(ZS[s])), ring = [], ins = [];
    for (let r = 0; r < NR; r++){ const j = r < NP ? r : NR - r, sx = r < NP ? 1 : -1; let x = h[j][0] * sx; const y = h[j][1]; let inn = false;
      if (j < NB && Math.abs(x) > .5) for (const w of CAR_WHEELS) if (Math.sign(w[0]) === sx && Math.hypot(ZS[s] - w[1], y - .33) < CAR_ARCH){ x -= sx * .22; inn = true; }     /* the arches: the side pushed in round each wheel */
      ring.push([x, y, ZS[s]]); ins.push(inn); }
    V.push(ring); IN.push(ins); }
  /* a normal at each point, from its neighbours along and round the body, so the paint shades as one curved surface */
  const N = V.map((ring, s) => ring.map((p, r) => { const a = V[Math.min(NS - 1, s + 1)][r], b = V[Math.max(0, s - 1)][r], c = ring[(r + 1) % NR], d = ring[(r + NR - 1) % NR];
    let n = norm(cross(sub(a, b), sub(c, d))); if (n[0] * p[0] + n[1] * (p[1] - .7) < 0) n = mul(n, -1); return n; }));
  const o = { body:[[], []], glass:[[], []], well:[[], []], flat:[], trim:[], tail:[], hot:[], amber:[], lamp:[], plate:[], rim:[[], []] };
  const quad = (t, s, r) => { const r1 = (r + 1) % NR, id = [[s, r], [s, r1], [s + 1, r1], [s, r], [s + 1, r1], [s + 1, r]];
    for (const [a, b] of id){ t[0].push(V[a][b][0], V[a][b][1], V[a][b][2]); t[1].push(N[a][b][0], N[a][b][1], N[a][b][2]); } };
  for (let s = 0; s < NS - 1; s++) for (let r = 0; r < NR; r++){
    const seg = r < NP - 1 ? r : NR - 1 - r, z = (ZS[s] + ZS[s + 1]) / 2, r1 = (r + 1) % NR;
    const inn = IN[s][r] + IN[s][r1] + IN[s + 1][r] + IN[s + 1][r1];
    let t = o.body;
    if (inn >= 3) t = o.well;
    else if (seg >= NB - 1 && seg < NB + NG - 3){ if (z > -.9 && z < .82) t = o.glass; }                      /* the side glass (its top edge left as the roof rail) */
    else if (seg >= NB + NG - 1 && ((z > -1.06 && z < -.6) || (z > .4 && z < .97))) t = o.glass;         /* the rear window; the windscreen (their edges left as pillars) */
    quad(t, s, r);
  }
  const tri = (a, p, q, s) => a.push(p[0], p[1], p[2], q[0], q[1], q[2], s[0], s[1], s[2]);
  for (const s of [0, NS - 1]){                            /* the tail and the nose, closed */
    const ring = V[s], c = [0, ring.reduce((t, p) => t + p[1], 0) / NR, ZS[s]], nz = s ? 1 : -1;
    for (let r = 0; r < NR; r++){ for (const p of s ? [c, ring[r], ring[(r + 1) % NR]] : [c, ring[(r + 1) % NR], ring[r]]){ o.body[0].push(p[0], p[1], p[2]); o.body[1].push(0, 0, nz); } }      // each wound to face out (the tail's faced in, and the paint, two-sided, lit it as if it faced the sun: a flat white panel)
  }
  const box = (a, c, ax, ay, az) => {                    // a box from its centre and three half-axes
    const v = [];
    for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) v.push(add(c, add(mul(ax, i), add(mul(ay, j), mul(az, k)))));
    [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]].forEach(f => { tri(a, v[f[0]], v[f[1]], v[f[2]]); tri(a, v[f[0]], v[f[2]], v[f[3]]); });
  };
  const X = [1, 0, 0], Yv = [0, 1, 0], Zv = [0, 0, 1], T = -2.203;
  /* the tail: a lamp each side (red, with an amber and a white part inboard), a dark strip between them, the plate in its recess,
     a black skirt and two pipes under the bumper */
  for (const sx of [-1, 1]){
    box(o.tail, [sx * .53, .628, T], mul(X, .165), mul(Yv, .052), mul(Zv, .006));
    box(o.hot, [sx * .53, .628, T - .004], mul(X, .14), mul(Yv, .027), mul(Zv, .004));      // the lamp's middle, far brighter: it reads as lit, and the bloom takes it
    box(o.amber, [sx * .315, .628, T], mul(X, .042), mul(Yv, .052), mul(Zv, .006));
    box(o.lamp, [sx * .242, .628, T], mul(X, .026), mul(Yv, .052), mul(Zv, .006));
  }
  box(o.trim, [0, .628, T + .002], mul(X, .21), mul(Yv, .046), mul(Zv, .004));
  box(o.trim, [0, .475, T + .002], mul(X, .275), mul(Yv, .064), mul(Zv, .004));
  box(o.plate, [0, .475, T - .003], mul(X, .2), mul(Yv, .044), mul(Zv, .003));
  box(o.trim, [0, .375, -2.17], mul(X, .6), mul(Yv, .028), mul(Zv, .04));
  for (const x of [-.47, -.38]) box(o.trim, [x, .345, -2.2], mul(X, .034), mul(Yv, .03), mul(Zv, .05));
  /* the wing on the boot: a blade on two posts, a thin brake light in its trailing edge */
  const wz = [0, -.105, .995], wy = [0, .995, .105];
  box(o.flat, [0, 1.005, -1.93], mul(X, .74), mul(wy, .013), mul(wz, .085));
  for (const sx of [-1, 1]) box(o.flat, [sx * .6, .935, -1.915], mul(X, .022), mul(Yv, .07), mul(Zv, .055));
  /* the rim light on the wing: a hair of light along the top of its trailing edge, magenta at the left end (+x here: the car is
     turned round in the scene) to cyan at the right, in twelve lengths. The blade's top is edge-on to the camera, so the paint's
     own rim light can't show there. */
  for (let k = 0; k < 12; k++){ const x = -.74 + (k + .5) * 1.48 / 12, u = ss(-.42, .42, x), c = [lerp(.1, 1.25, u), lerp(.92, .1, u), lerp(1.25, .92, u)];
    box(o.rim[0], [x, 1.0225, -2.0172], mul(X, .74 / 12), mul(wy, .0042), mul(wz, .003)); for (let q = 0; q < 36; q++) o.rim[1].push(c[0] * .8, c[1] * .8, c[2] * .8); }
  box(o.tail, [0, .999, -2.017], mul(X, .15), mul(Yv, .007), mul(Zv, .004));
  /* the door mirrors */
  for (const sx of [-1, 1]) box(o.flat, [sx * .93, .93, .74], mul(X, .055), mul(Yv, .04), mul(Zv, .05));
  return o;
}

/* ── the two times of day. Colours are sRGB; light in arbitrary units (the picture is tone-mapped at the end). ── */
const DAY = {
  dusk:  { top:'#23104a', mid:'#a8386f', hor:'#ff9a5a', fog:'#7a2a58', glow:'#ff9a6a', sunTop:'#ffc56a', sunBot:'#ff3a78', sunI:1.0,
           light:'#ffa27a', lightI:2.2, hemiTop:'#8a4a9a', hemiBot:'#14081a', hemiI:.4, stars:0, neon:'#ff3d9a', neonI:2.2, env:.55, exposure:1.0, bloom:.5 },
  night: { top:'#04020a', mid:'#170a32', hor:'#5c1d5e', fog:'#240c34', glow:'#c23a8a', sunTop:'#ff9fd0', sunBot:'#a8145e', sunI:1.15,
           light:'#ff6fb0', lightI:1.1, hemiTop:'#3a1d70', hemiBot:'#06030c', hemiI:.4, stars:1, neon:'#ff3d9a', neonI:2.6, env:.5, exposure:1.05, bloom:.65 }
};

/* ── a .glb from models/synth (the lean copies: positions as int16, KHR_mesh_quantization; no textures): meshes, each
   split into its parts (paint, glass, leaf…), with normals worked out here. A node's scale and translation turn the
   int16 positions back into the model's units; extras.pivot is where a part turns about (the car's wheels). ── */
function parseGlb(T, buf){
  const dv = new DataView(buf), jl = dv.getUint32(12, true);
  const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bo = 20 + jl + 8;
  const N = { SCALAR:1, VEC3:3, VEC4:4 }, C = { 5126:Float32Array, 5123:Uint16Array, 5122:Int16Array, 5121:Uint8Array };
  const view = i => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], K = C[a.componentType], s = (v.byteStride || 0) / K.BYTES_PER_ELEMENT || N[a.type];
    return { a, s, d:new K(buf, bo + (v.byteOffset || 0) + (a.byteOffset || 0), (a.count - 1) * s + N[a.type]) }; };
  const lin = x => { x /= 255; return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); };
  const out = {};
  for (const nd of j.nodes){
    const parts = {}, sc = nd.scale || [1, 1, 1], pv = (nd.extras && nd.extras.pivot) || [0, 0, 0], tr = nd.translation || [0, 0, 0];
    for (const p of j.meshes[nd.mesh].primitives){
      const g = new T.BufferGeometry(), P = view(p.attributes.POSITION), n = P.a.count, pos = new Float32Array(n * 3), q = P.a.componentType === 5122 ? 1 / 32767 : 1;
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = P.d[i * P.s + k] * q * sc[k] + tr[k] - pv[k];
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setIndex(new T.BufferAttribute(view(p.indices).d.slice(), 1));
      /* the model's own shading (its colour map's gradients), kept as a light and dark around the part's average */
      const col = new Float32Array(n * 3).fill(1);
      if (p.attributes.COLOR_0 != null){
        const c = view(p.attributes.COLOR_0).d, lum = new Float32Array(n); let mean = 0;
        for (let i = 0; i < n; i++){ lum[i] = .2126 * lin(c[i * 4]) + .7152 * lin(c[i * 4 + 1]) + .0722 * lin(c[i * 4 + 2]); mean += lum[i]; }
        mean = mean / n || 1;
        for (let i = 0; i < n; i++){ const k = clamp(Math.pow(lum[i] / mean, .6), .6, 1.4); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.computeVertexNormals(); g.computeBoundingSphere();
      parts[j.materials[p.material].name] = g;
    }
    out[nd.name] = { parts, at:pv };
  }
  return out;
}

/* ═══════════════ the shaders ═══════════════ */
const GLSL_HASH = 'float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }\n' +
  'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }\n';
/* the sky: three colours top to horizon, a haze on the horizon, the sun's glow, stars at night */
const SKY_V = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w; }';
const SKY_F = 'uniform vec3 uTop, uMid, uHor, uGlow, uSun; uniform float uStars;\nvarying vec3 vDir;\n' +
  'float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }\n' +
  'void main(){\n' +
  '  vec3 d = normalize(vDir); float y = d.y;\n' +
  '  vec3 c = mix(uHor, uMid, smoothstep(-.01, .12, y)); c = mix(c, uTop, smoothstep(.07, .34, y));\n' +
  '  c += uHor * .3 * exp(-abs(y) * 30.);\n' +
  '  float s = max(dot(d, uSun), 0.); c += uGlow * (pow(s, 6.) * .22 + pow(s, 60.) * .45);\n' +
  '  if (uStars > 0.){ vec3 q = d * 300.; vec3 id = floor(q); float h = h31(id);\n' +
  '    vec3 f = fract(q) - .5 - (vec3(h31(id + 1.7), h31(id + 3.1), h31(id + 5.3)) - .5) * .6;\n' +
  '    c += vec3(1., .86, 1.) * smoothstep(.24, .0, length(f)) * step(.986, h) * smoothstep(.03, .3, y) * uStars * (.35 + 1.6 * fract(h * 37.)); }\n' +
  '  gl_FragColor = vec4(c, 1.);\n}';
/* the sun: a disc, warm at the top and hot pink below, cut by bands that thicken towards the horizon */
const SUN_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
/* the sun: its lower part cut by gaps that rise: each opens wide at its foot, thins as it climbs, and closes at .62 of its height
   (uT: how far the gaps have risen, in gap spacings; it only matters by its fraction) */
const SUN_F = 'uniform vec3 uTop, uBot; uniform float uI, uT;\nvarying vec2 vUv;\n' +
  'void main(){\n' +
  '  vec2 p = vUv * 2. - 1.; float r = length(p), w = fwidth(r);\n' +
  '  float a = 1. - smoothstep(1. - w * 1.5, 1., r);\n' +
  '  float y = vUv.y, g = fract(y * 13. + .35 - uT), th = clamp((.62 - y) * 1.15, 0., .9), gw = fwidth(y * 13.);\n' +
  '  a *= y < .62 ? smoothstep(th - gw, th + gw, g) : 1.;\n' +
  '  vec3 c = mix(uBot, uTop, smoothstep(.02, .98, y)) * uI;\n' +
  '  gl_FragColor = vec4(c * a, a);\n}';
/* the sea: what the mirror saw, broken up by long slow swells; deeper colour looking down into it; fog to the horizon */
const SEA = {
  name:'SynthSea',
  uniforms:{ color:{ value:null }, tDiffuse:{ value:null }, textureMatrix:{ value:null }, uTime:{ value:0 }, uDeep:{ value:null }, uFog:{ value:null },
             uFogR:{ value:null }, uRip:{ value:1 } },
  vertexShader:'uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;\n' +
    'void main(){ vUv = textureMatrix * vec4(position, 1.); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader:'uniform vec3 color, uDeep, uFog; uniform sampler2D tDiffuse; uniform float uTime, uRip; uniform vec2 uFogR;\nvarying vec4 vUv; varying vec3 vW;\n' + GLSL_HASH +
    'void main(){\n' +
    '  vec3 V = cameraPosition - vW; float d = length(V); V /= d;\n' +
    '  vec2 p = vW.xz;\n' +
    '  float n1 = vnoise(vec2(p.x * .035, p.y * .9 + uTime * .2));\n' +
    '  float n2 = vnoise(vec2(p.x * .09 - uTime * .02, p.y * 2.3 + uTime * .33));\n' +
    '  float n3 = vnoise(vec2(p.x * .3, p.y * 5.7 - uTime * .5));\n' +
    '  float k = uRip / (1. + d * .004);\n' +
    '  vec2 dis = vec2((n1 - .5) * .008, (n1 * .5 + n2 * .8 + n3 * .6 - .95) * .07) * k;\n' +
    '  vec4 uv = vUv; uv.xy += dis * uv.w;\n' +
    '  vec3 refl = texture2DProj(tDiffuse, uv).rgb;\n' +
    '  float fr = .02 + .98 * pow(1. - max(V.y, 0.), 5.);\n' +
    '  vec3 c = mix(uDeep, refl * color, clamp(fr * 1.15 + .08, 0., 1.));\n' +
    '  c = mix(c, uFog, smoothstep(uFogR.x, uFogR.y, d) * .85);\n' +
    '  gl_FragColor = vec4(c, 1.);\n}'
};
/* the bloom and the last pass */
const QUAD_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
/* A pixel of a tower's glass can come out as not a number, or as an absurd highlight, for one frame; blurred into the bloom that
   was a white flash over the city. So: a sample that isn't a sane number counts as black (SANE), and the four samples are
   averaged by how dim they are, so one wild one can't carry the average. */
const SANE = 'float sane1(float v){ return (v > -1e4 && v < 48.) ? max(v, 0.) : 0.; }\nvec3 sane(vec3 c){ return vec3(sane1(c.r), sane1(c.g), sane1(c.b)); }\n';
const PRE_F = 'uniform sampler2D tSrc; uniform vec2 uTx; uniform float uThr, uKnee; varying vec2 vUv;\n' + SANE +
  'vec4 tap(vec2 o){ vec3 c = sane(texture2D(tSrc, vUv + uTx * o).rgb); float w = 1. / (1. + max(c.r, max(c.g, c.b))); return vec4(c * w, w); }\n' +
  'void main(){ vec4 a = tap(vec2(-1., -1.)) + tap(vec2(1., -1.)) + tap(vec2(-1., 1.)) + tap(vec2(1., 1.)); vec3 c = a.rgb / max(a.a, 1e-4);\n' +
  '  float br = max(c.r, max(c.g, c.b)), so = clamp(br - uThr + uKnee, 0., 2. * uKnee); so = so * so / (4. * uKnee + 1e-4);\n' +
  '  gl_FragColor = vec4(min(c * max(so, br - uThr) / max(br, 1e-4), vec3(16.)), 1.); }';
const DOWN_F = 'uniform sampler2D tSrc; uniform vec2 uTx; varying vec2 vUv;\n' +
  'void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 4. + texture2D(tSrc, vUv + uTx * vec2(-1., -1.)).rgb + texture2D(tSrc, vUv + uTx * vec2(1., -1.)).rgb + texture2D(tSrc, vUv + uTx * vec2(-1., 1.)).rgb + texture2D(tSrc, vUv + uTx).rgb;\n' +
  '  gl_FragColor = vec4(c / 8., 1.); }';
/* steadying (TAA_F): each frame is drawn a fraction of a pixel off from the last (a different place in sixteen), and folded into
   the frames before it, so what is finer than a pixel (a palm's leaflets, far off) is seen as the average of all sixteen and no
   longer twinkles as the camera drifts. Nothing is reprojected: the scenes it runs in hardly move (the bay's camera drifts a
   twenty-fifth of a pixel a frame). The history is held within the range of this frame's neighbours (widened by uCl of that
   range), so nothing that moves can leave a trail. */
const TAA_F = 'uniform sampler2D tCur, tHist; uniform vec2 uTx; uniform float uK, uCl; varying vec2 vUv;\n' + SANE +
  'void main(){ vec3 c = sane(texture2D(tCur, vUv).rgb), lo = c, hi = c;\n' +
  '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec3 n = sane(texture2D(tCur, vUv + uTx * vec2(float(x), float(y))).rgb); lo = min(lo, n); hi = max(hi, n); }\n' +
  '  vec3 e = (hi - lo) * uCl, h = clamp(sane(texture2D(tHist, vUv).rgb), lo - e, hi + e);\n' +
  '  gl_FragColor = vec4(mix(h, c, uK), 1.); }';
const UP_F = 'uniform sampler2D tSrc; uniform vec2 uTx; uniform float uW; varying vec2 vUv;\n' +
  'void main(){ vec3 c = texture2D(tSrc, vUv + vec2(-2. * uTx.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(2. * uTx.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(0., -2. * uTx.y)).rgb + texture2D(tSrc, vUv + vec2(0., 2. * uTx.y)).rgb;\n' +
  '  c += (texture2D(tSrc, vUv + uTx * vec2(-1., 1.)).rgb + texture2D(tSrc, vUv + uTx).rgb + texture2D(tSrc, vUv - uTx).rgb + texture2D(tSrc, vUv + uTx * vec2(1., -1.)).rgb) * 2.;\n' +
  '  gl_FragColor = vec4(c * uW / 12., 1.); }';
const COMP_F = 'uniform sampler2D tScene, tBloom; uniform float uBloom, uExp, uGrain, uSeed, uVig; varying vec2 vUv;\n' + SANE +
  'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }\n' +
  'void main(){\n' +
  '  vec3 c = sane(texture2D(tScene, vUv).rgb) + sane(texture2D(tBloom, vUv).rgb) * uBloom;\n' +
  '  c = aces(c * uExp);\n' +
  '  vec2 q = vUv - .5; c *= 1. - uVig * dot(q, q);\n' +
  '  c = mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c));\n' +
  '  vec3 h3 = fract(vec3(gl_FragCoord.xy, uSeed) * .1031); h3 += dot(h3, h3.zyx + 31.32); c += (fract((h3.x + h3.y) * h3.z) - .5) * uGrain;\n' +
  '  gl_FragColor = vec4(c, 1.);\n}';

/* ═══════════════ building a scene ═══════════════ */
async function build(canvas, kind, dark){
  const want = MODELS[kind] || [];
  const water = kind !== 'drive';
  const [T, RF, ...bufs] = await Promise.all([import(LIB), water ? import(REFL) : null,
    ...want.map(n => fetch('/models/synth/' + n + '.glb').then(r => { if (!r.ok) throw new Error('model ' + n); return r.arrayBuffer(); }))]);
  const M = {}; want.forEach((n, i) => Object.assign(M, parseGlb(T, bufs[i])));

  const renderer = new T.WebGLRenderer({ canvas, antialias:false, alpha:false, depth:true, stencil:false, powerPreference:'low-power' });
  renderer.setPixelRatio(1); renderer.autoClear = false; renderer.info.autoReset = false;      // counted per frame (all passes), not per render call
  const ext = renderer.extensions, hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
  const RT_TYPE = hdr ? T.HalfFloatType : T.UnsignedByteType;
  const dispose = [];                                         // everything to give back at the end
  const keep = o => { dispose.push(o); return o; };

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, 16 / 9, .5, 1400);
  const fog = new T.Fog(0x000000, 60, 900); scene.fog = fog;

  /* the sky: a sphere that goes where the camera goes */
  const skyU = { uTop:{ value:new T.Color() }, uMid:{ value:new T.Color() }, uHor:{ value:new T.Color() }, uGlow:{ value:new T.Color() }, uSun:{ value:new T.Vector3(0, .07, -1) }, uStars:{ value:0 } };
  const skyMat = keep(new T.ShaderMaterial({ uniforms:skyU, vertexShader:SKY_V, fragmentShader:SKY_F, side:T.BackSide, depthWrite:false, fog:false }));
  const skyGeo = keep(new T.SphereGeometry(1000, 40, 20));
  const sky = new T.Mesh(skyGeo, skyMat); sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky);
  /* the sun */
  const sunU = { uTop:{ value:new T.Color() }, uBot:{ value:new T.Color() }, uI:{ value:2 }, uT:{ value:0 } };
  const sunMat = keep(new T.ShaderMaterial({ uniforms:sunU, vertexShader:SUN_V, fragmentShader:SUN_F, transparent:true, depthWrite:false, fog:false,
    blending:T.CustomBlending, blendSrc:T.OneFactor, blendDst:T.OneMinusSrcAlphaFactor }));
  const sunGeo = keep(new T.PlaneGeometry(2, 2));
  const sun = new T.Mesh(sunGeo, sunMat); sun.renderOrder = -1; sun.frustumCulled = false; scene.add(sun);
  const SUN_D = 900, SUN_RISE = .16;                          /* the gaps in the sun climb one spacing (a thirteenth of its height) in about six seconds: a few pixels a second */
  let sunDir = new T.Vector3(0, .07, -1).normalize(), sunR = 120;
  const placeSun = () => { sun.position.copy(camera.position).addScaledVector(sunDir, SUN_D); sun.scale.setScalar(sunR); sun.lookAt(camera.position); sky.position.copy(camera.position); };

  /* the one light, and what the sky gives back */
  const light = new T.DirectionalLight(0xffffff, 2); scene.add(light); scene.add(light.target);
  const hemi = new T.HemisphereLight(0xffffff, 0x000000, .5); scene.add(hemi);
  const pmrem = new T.PMREMGenerator(renderer);
  let envRT = null;
  const envScene = new T.Scene();
  const envSky = new T.Mesh(skyGeo, skyMat); envSky.scale.setScalar(.04); envScene.add(envSky);
  const envSun = new T.Mesh(sunGeo, sunMat); envScene.add(envSun);
  const makeEnv = () => {
    envSun.position.copy(sunDir).multiplyScalar(30); envSun.scale.setScalar(sunR * 30 / SUN_D); envSun.lookAt(0, 0, 0);
    const u = skyU.uStars.value; skyU.uStars.value = 0;
    const rt = pmrem.fromScene(envScene, 0, .1, 100);
    skyU.uStars.value = u;
    if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
    /* Three.js (r163 on) gives every material the scene's sky light at full strength, whatever its envMapIntensity says: that only
       counts for a material carrying the map itself. The scenes were tuned by eye with that, so they are left as they are; a
       material that sets userData.envK ([dusk, night]) carries the map, and gets that strength (see setMode). */
    scene.traverse(o => { const m = o.material; if (m && m.userData && m.userData.envK) m.envMap = rt.texture; });
  };

  /* materials */
  const std = o => keep(new T.MeshStandardMaterial(Object.assign({ roughness:.8, metalness:0 }, o)));
  const neonMats = [];                                        // lines and strips that glow in the theme's pink
  const neon = (k, o) => { const m = keep(new T.MeshBasicMaterial(Object.assign({ color:0xffffff }, o))); m.userData.k = k; neonMats.push(m); return m; };
  const neonLine = k => { const m = keep(new T.LineBasicMaterial({ color:0xffffff })); m.userData.k = k; neonMats.push(m); return m; };

  /* palms (palmArrays): a geometry per variant, made once and shared; dark against the sky, lit round the edges by the low sun */
  const palmMat = std({ color:'#ffffff', roughness:.8, vertexColors:true, side:T.DoubleSide, envMapIntensity:.35 });
  const palmGeo = [];
  const palm = (v, x, z, s, ry) => {
    if (!palmGeo[v]){
      const a = palmArrays(PALM_SEEDS[v]), g = keep(new T.BufferGeometry());
      g.setAttribute('position', new T.BufferAttribute(a.pos, 3)); g.setAttribute('color', new T.BufferAttribute(a.col, 3));
      g.computeVertexNormals(); g.computeBoundingSphere(); palmGeo[v] = g;
    }
    const m = new T.Mesh(palmGeo[v], palmMat); m.position.set(x, -.1, z); m.scale.setScalar(s); m.rotation.y = ry; scene.add(m); return m;
  };
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3(), _p = new T.Vector3();
  /* the sea */
  let sea = null;
  const makeSea = (size, rip) => {
    const g = keep(new T.PlaneGeometry(size, size));
    if (RF && hdr){
      sea = new RF.Reflector(g, { textureWidth:256, textureHeight:256, multisample:0, clipBias:.002, shader:SEA });
      const u = sea.material.uniforms; u.uDeep.value = new T.Color(); u.uFog.value = new T.Color(); u.uFogR.value = new T.Vector2(80, 900); u.uRip.value = rip || 1;
      u.color.value = new T.Color(.92, .9, .95);
      dispose.push({ dispose:() => sea.dispose() });
    } else sea = new T.Mesh(g, std({ color:'#0c0716', roughness:.12, metalness:.9 }));
    sea.rotation.x = -Math.PI / 2; scene.add(sea);
    return sea;
  };

  /* a low island of sand: a flattened dome, its edge ragged and its top uneven, so it isn't a disc */
  const islet = (x, z, rx, rz, h, seed) => {
    const r = rnd(seed), ph = [r() * 6.3, r() * 6.3, r() * 6.3];
    const g = keep(new T.SphereGeometry(1, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2)), p = g.attributes.position;
    for (let i = 0; i < p.count; i++){
      const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + .16 * Math.sin(a * 3 + ph[0]) + .09 * Math.sin(a * 7 + ph[1]) + .05 * Math.sin(a * 13 + ph[2]);
      const y = p.getY(i);
      p.setXYZ(i, x + p.getX(i) * rx * k, Math.pow(y, 1.7) * h * (1 + .25 * Math.sin(a * 5 + ph[1])) - .3, z + p.getZ(i) * rz * k);
    }
    g.computeVertexNormals();
    scene.add(new T.Mesh(g, std({ color:'#0d0810', roughness:.95, flatShading:true, envMapIntensity:.3 })));
  };
  /* a range of hills: a strip of ground raised into peaks, flat-shaded, and (glow) a lit line along the crest */
  const range = o => {
    const r = rnd(o.seed), W = o.x1 - o.x0, D = o.depth;
    const peaks = Array.from({ length:o.n }, () => ({ x:o.x0 + r() * W, w:o.wMin + r() * (o.wMax - o.wMin), h:o.h * (.35 + .65 * r()) }));
    if (o.peaks) peaks.push(...o.peaks);
    const H = (x, fz) => { let h = 0; for (const p of peaks) h = Math.max(h, p.h * Math.pow(Math.max(0, 1 - Math.abs(x - p.x) / p.w), 1.25));
      h *= Math.pow(Math.sin(Math.PI * clamp(fz, 0, 1)), .75); if (o.valley) h *= ss(o.valley[0], o.valley[1], Math.abs(x));
      return h * (.92 + .16 * Math.sin(x * .37 + o.seed) * Math.sin(fz * 7.1)); };
    const g = keep(new T.PlaneGeometry(W, D, o.sx, o.sz)); g.rotateX(-Math.PI / 2); g.translate((o.x0 + o.x1) / 2, 0, o.z);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++){ const x = pos.getX(i), fz = (pos.getZ(i) - (o.z - D / 2)) / D; pos.setY(i, H(x, fz)); }
    g.computeVertexNormals();
    const mesh = new T.Mesh(g, o.mat); scene.add(mesh);
    if (o.glow){
      const pts = []; for (let i = 0; i <= o.sx * 2; i++){ const x = o.x0 + W * i / (o.sx * 2); pts.push(new T.Vector3(x, H(x, .5) + .25, o.z + .4)); }
      const lg = keep(new T.BufferGeometry().setFromPoints(pts)); scene.add(new T.Line(lg, neonLine(o.glow)));
    }
    return mesh;
  };

  /* ═══ the scenes ═══ */
  let update = () => {}, cams = null, look = { bloom:1, exp:1, fogNear:60, fogFar:900, seaRip:1, sunEl:.07 };
  const pal = { };                                         // per-scene colour changes, applied over DAY in setMode
  const DIR = (az, el) => new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();

  if (kind === 'drive'){
    /* the road runs into the screen (-z), straight at the sun, through a canyon of crags; the car in its right-hand lane */
    sunDir = DIR(0, .095); sunR = 128; look.fogNear = 40; look.fogFar = 950;
    const SPEED = 9;                                       /* m/s: nearly seven grid rows (4/3 m) a second. The owner asked for the road to go by fast (it was 1.4). Under 13, so a row never moves half a cell in a frame even at twenty frames a second (past that the lines seem to run backwards) */
    /* the road: two lanes, each two of the floor's 4/3 m cells wide (2.67 m: the car, 1.93 m, with a little room either side),
       so its edges (at ROAD, either side of the middle) fall on grid lines */
    const ROAD = 8 / 3, LANE = ROAD / 2;
    /* the floor: one bold lit grid in cells of 4/3 m, the road
       part of it (its lines a little quieter) and its two edges brightest, going by */
    const gridU = { uGrid:{ value:new T.Color() }, uRoad:{ value:new T.Color() }, uOff:{ value:0 } };
    const floorM = keep(new T.MeshLambertMaterial({ color:'#07030c' }));
    floorM.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, gridU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSyW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSyW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSyW; uniform vec3 uGrid, uRoad; uniform float uOff;\n' + GLSL_GRID)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
          '{ float road = 1. - step(' + (ROAD + .01).toFixed(3) + ', abs(vSyW.x)), fx = max(fwidth(vSyW.x), 1e-4);\n' +
          '  float de = abs(abs(vSyW.x) - ' + ROAD.toFixed(4) + ') / fx, edge = max(1. - smoothstep(1.1, 2.3, de), exp(-de * .4) * .4);\n' +
          '  float fd = length(cameraPosition - vSyW);\n' +                              /* brightest at our feet, fading with distance: the foreground leads */
          '  totalEmissiveRadiance += uGrid * syGrid(vec2(vSyW.x, vSyW.z - uOff) * .75, 1.05, .36, .32) * mix(1., .62, road) * mix(1., .24, smoothstep(12., 230., fd)) + uRoad * edge * mix(1., .5, smoothstep(40., 420., fd)); }');
    };
    floorM.customProgramCacheKey = () => 'sy-floor';
    const fg = keep(new T.PlaneGeometry(2400, 2400, 1, 1)); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, -900);
    scene.add(new T.Mesh(fg, floorM));
    pal.floor = gridU;
    /* the hills either side: low and low-poly, big flat facets meeting at sharp ridges, a lit grid laid over them (measured
       along the surface, so the cells stay square on a slope, the same size as the floor's; the lines turn a little at each
       facet's edge). Their foot wanders: further back here, a spur of foothill nearly at the road's edge there; they stay
       low near the road and rise further out, so the sky and the sun stay open above them. Made of lengths that come
       round again and fade in from the haze; heights and jitter repeat once round the loop, so one length carries
       straight on into the next. */
    const terU = { value:new T.Color() }; pal.crag = terU;
    const terM = std({ color:'#1a0d30', roughness:.9, flatShading:true, envMapIntensity:.22, side:T.DoubleSide });      // light enough that each facet's angle to the light shows
    terM.onBeforeCompile = sh => {
      sh.uniforms.uTer = terU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 gq; attribute vec3 bary; varying vec2 vGq; varying vec3 vBary;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGq = gq; vBary = bary;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGq; varying vec3 vBary; uniform vec3 uTer;\n' + GLSL_GRID)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 bd = vBary / max(fwidth(vBary), vec3(1e-4)); float e = 1. - smoothstep(.7, 1.9, min(min(bd.x, bd.y), bd.z));\n' +
          '  totalEmissiveRadiance += uTer * max(syGrid(vGq, .8, .2, .12), e * 1.15) * mix(1., .1, smoothstep(16., 260., length(vViewPosition))); }');      /* and the hills recede */
    };
    terM.customProgramCacheKey = () => 'sy-terrain';
    const CH = 120, NC = 9, LOOP = CH * NC, NX = 14, NZ = 10, R = LOOP / (2 * Math.PI), CELL_H = 4 / 3;      // a coarse mesh (facets 7 to 25 m), the floor's cell size
    const chunks = [];
    for (const sd of [-1, 1]){
      const S = sd > 0 ? 400 : 700;
      const ring = w => { const a = w / R; return [R * Math.cos(a), R * Math.sin(a)]; };       // round the loop, so the noise repeats with it
      const foot = w => { const [c, s] = ring(w); return ROAD + 1 + 15 * clamp((fbm3(0, c / 75, s / 75, S + 1, 3) - .3) / .42, 0, 1); };   // where the hills start: never nearer the road's edge than 0.4 m
      const height = (x, w, d, dn) => {
        const [c, s] = ring(w);
        const big = (4 + 30 * dn) * (.3 + 1.05 * fbm3(x / 48, c / 48, s / 48, S + 2, 4));
        const rid = 1 - Math.abs(2 * vnoise3(x / 13, c / 13, s / 13, S + 3) - 1), jag = 6.5 * rid * rid * ss(0, 22, d);
        return .85 * ss(0, 8 + 6 * vnoise3(x / 30, c / 30, s / 30, S + 4), d) * (big + jag);
      };
      /* the whole loop's surface first (row g at distance w = g / NZ * CH along it), so the grid can be measured on it; each
         point nudged a little (seeded by its place in the loop, so the loop still closes) for facets that aren't in rows */
      const NG = NC * NZ, G = [], jit = (g, i, n) => hash3(g % NG, i, n, S) - .5;
      for (let g = 0; g <= NG; g++){
        const row = [];
        for (let i = 0; i <= NX; i++){
          const w = g / NZ * CH + (i ? jit(g, i, 1) * 7 : 0), x0 = foot(w), dn = i / NX;
          const x = x0 + Math.pow(dn, 1.25) * 175 + jit(g, i, 2) * (i ? 6 * (.4 + dn) : 1.2);
          row.push([x, i ? height(x, w, x - x0, dn) * (.78 + .44 * (jit(g, i, 3) + .5)) : 0, w]);
        }
        G.push(row);
      }
      /* the grid's coordinates are distances along the surface itself, in cells: across, from the hills' foot; along, down
         the loop. So a cell is about as wide as it is long on a steep face as on a gentle one (projected from above, the
         steep faces were long streaks). Along the loop each column's length is rounded to whole cells, so the lines meet
         themselves where the loop closes. */
      const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const U = G.map(row => { let u = 0; return row.map((p, i) => (u += i ? dist3(p, row[i - 1]) : 0) / CELL_H); });
      const Vc = [];
      for (let i = 0; i <= NX; i++){
        const acc = [0]; for (let g = 1; g <= NG; g++) acc.push(acc[g - 1] + dist3(G[g][i], G[g - 1][i]));
        const k = Math.max(1, Math.round(acc[NG] / CELL_H)) / acc[NG]; Vc.push(acc.map(a => a * k));
      }
      for (let k = 0; k < NC; k++){
        const pos = [], gq = [], idx = [];
        for (let j = 0; j <= NZ; j++){
          const g = k * NZ + j;
          for (let i = 0; i <= NX; i++){ const p = G[g][i]; pos.push(sd * p[0], p[1], -(p[2] - k * CH)); gq.push(U[g][i], Vc[i][g]); }
        }
        for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++){
          const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 2, d = a + NX + 1, q = (i + j) % 2 ? [a, b, c, a, c, d] : [a, b, d, b, c, d];      // the diagonals alternate, as on the old crags
          if (sd < 0) for (let t = 0; t < 6; t += 3){ const z = q[t + 1]; q[t + 1] = q[t + 2]; q[t + 2] = z; }
          idx.push(...q);
        }
        const P = [], Q = [], B = [];
        idx.forEach((v, n) => { P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); Q.push(gq[v * 2], gq[v * 2 + 1]); B.push(n % 3 === 0 ? 1 : 0, n % 3 === 1 ? 1 : 0, n % 3 === 2 ? 1 : 0); });
        const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('gq', new T.Float32BufferAttribute(Q, 2)); g.setAttribute('bary', new T.Float32BufferAttribute(B, 3));
        g.computeVertexNormals();
        const m = new T.Mesh(g, terM); m.frustumCulled = false; scene.add(m); chunks.push({ m, k });
      }
    }
    /* the car (carArrays): pearl white, so it takes the dusk's colours; dark glass; red lamps that glow; wheels in their arches */
    const car = new T.Group(); car.position.set(LANE, 0, 0); car.rotation.y = Math.PI; scene.add(car);          // in the middle of the right-hand lane
    const ca = carArrays(), geo = a => { const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(a, 3)); g.computeVertexNormals(); return g; };
    const geoN = a => { const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(a[0], 3)); g.setAttribute('normal', new T.Float32BufferAttribute(a[1], 3)); return g; };
    const paint = std({ color:'#e6e0f0', roughness:.46, metalness:.08, side:T.DoubleSide });      // not glossier: the low sun's glint on the roof bloomed into a white blob
    paint.userData.envK = [.6, 1];                            // the sky's light on it, [dusk, night]: the dusk's sky is many times the night's
    /* two things only the paint knows about (real lights lit the hills too).
       Shade: the sky lights the whole car evenly, from every side and from below, and at dusk that much light is past the top of
       the tone curve: the body was one flat pale tone. So what the paint gives back of it is turned down (uShade, by the time of
       day), and more so towards the road and on what doesn't face up (nothing comes back off a black road), and on what faces us
       (the sun is ahead: this side is the shaded one); and at dusk what doesn't face up leans cool (uTint: overhead the sky is
       violet, only its rim is orange, and an orange shade on a white car is brown). Its sheen is turned down where it mirrors
       the road: the sky's picture carries its orange rim on under the horizon, and the road is black.
       A rim light, as from lamps ahead of it and above: on the roof and the wing's blade (above 0.9 m, facing up, turning away
       from us), magenta on the left, cyan on the right. */
    const rimU = { uRimA:{ value:new T.Color(1.25, .1, .92) }, uRimB:{ value:new T.Color(.1, .92, 1.25) }, uRimK:{ value:1.75 }, uShade:{ value:1 }, uTint:{ value:new T.Color(1, 1, 1) } }; pal.paint = rimU;
    paint.onBeforeCompile = sh => { Object.assign(sh.uniforms, rimU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRim;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRim = position.xy;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimA, uRimB, uTint; uniform float uRimK, uShade; varying vec2 vRim;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
          '{ vec3 wn = inverseTransformDirection(normal, viewMatrix), wv = inverseTransformDirection(normalize(vViewPosition), viewMatrix);\n' +
          '  float up = smoothstep(-.2, .9, wn.y);\n' +
          '  diffuseColor.rgb *= uShade * mix(.4, 1., smoothstep(.14, .86, vRim.y)) * mix(.3, 1., up) * mix(1., .4, smoothstep(-.1, .85, wn.z)) * mix(uTint, vec3(1.), up);\n' +
          '  float fr = pow(1. - clamp(dot(wn, wv), 0., 1.), 4.) * smoothstep(.1, .62, wn.y) * smoothstep(.9, 1., vRim.y);\n' +
          '  totalEmissiveRadiance += mix(uRimB, uRimA, smoothstep(-.42, .42, vRim.x)) * fr * uRimK; }')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' +
          '{ vec3 wn = inverseTransformDirection(normal, viewMatrix), wv = inverseTransformDirection(normalize(vViewPosition), viewMatrix);\n' +
          '  reflectedLight.indirectSpecular *= mix(.12, 1., smoothstep(-.45, .2, reflect(-wv, wn).y)); }'); };
    paint.customProgramCacheKey = () => 'sy-paint';
    const trimM = std({ color:'#08060b', roughness:.6, metalness:.3, envMapIntensity:.5, side:T.DoubleSide });
    car.add(new T.Mesh(geoN(ca.body), paint), new T.Mesh(geo(ca.flat), paint));
    car.add(new T.Mesh(geoN(ca.glass), std({ color:'#06040a', roughness:.16, metalness:.9, envMapIntensity:1.3, side:T.DoubleSide })));
    car.add(new T.Mesh(geoN(ca.well), trimM), new T.Mesh(geo(ca.trim), trimM));
    car.add(new T.Mesh(geo(ca.tail), keep(new T.MeshBasicMaterial({ color:new T.Color(1.75, .06, .14) }))));
    car.add(new T.Mesh(geo(ca.hot), keep(new T.MeshBasicMaterial({ color:new T.Color(3.6, .7, 1.25) }))));      // white-hot through the tone curve, pink in the bloom
    const pale = o => { const m = std(o); m.userData.envK = [.3, 1]; return m; };      // the small pale parts: at dusk they outshone the lamps
    car.add(new T.Mesh(geo(ca.amber), pale({ color:'#c46a1c', roughness:.3 })), new T.Mesh(geo(ca.lamp), pale({ color:'#dcdce6', roughness:.25 })), new T.Mesh(geo(ca.plate), pale({ color:'#ece6cf', roughness:.6 })));
    { const g = geo(ca.rim[0]); g.setAttribute('color', new T.Float32BufferAttribute(ca.rim[1], 3)); car.add(new T.Mesh(g, keep(new T.MeshBasicMaterial({ vertexColors:true })))); }      // the wing's rim light
    const tyre = keep(new T.CylinderGeometry(.325, .325, .25, 28)); tyre.rotateZ(Math.PI / 2);
    const hub = keep(new T.CylinderGeometry(.215, .215, .02, 28)); hub.rotateZ(Math.PI / 2);
    const lip = keep(new T.RingGeometry(.345, .43, 44)); lip.rotateY(Math.PI / 2);                             // a black lip round each arch
    const tyreM = std({ color:'#060508', roughness:.9 }), hubM = pale({ color:'#c8c4d2', roughness:.36, metalness:.9 });
    const wheels = [];
    for (const [x, z] of CAR_WHEELS){
      const sx = Math.sign(x), w = new T.Group(); w.position.set(x, .325, z);
      const hb = new T.Mesh(hub, hubM); hb.position.x = sx * .12; w.add(new T.Mesh(tyre, tyreM), hb); car.add(w); wheels.push(w);
      const lp = new T.Mesh(lip, trimM); lp.position.set(sx * (z < 0 ? .899 : .881), .33, z); car.add(lp);
    }
    car.traverse(o => { if (o.isMesh) o.renderOrder = 3; });      // the order on the floor: its shadows and its lamps' light (1 to 2), its reflection over them (2, drawn without a depth test), then the car itself (3)
    /* soft round glows, made once: for the lamps, and for their light on the road */
    const glowTex = (w, h, stops) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); x.scale(w / 2, h / 2);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1); stops.forEach(q => gr.addColorStop(q[0], 'rgba(255,255,255,' + q[1] + ')')); x.fillStyle = gr; x.fillRect(-1, -1, 2, 2); return keep(new T.CanvasTexture(c)); };
    const soft = glowTex(128, 128, [[0, 1], [.25, .55], [.55, .16], [1, 0]]);
    /* the lamps bloom: a halo over each, pink */
    for (const sx of [-1, 1]){ const h = new T.Sprite(keep(new T.SpriteMaterial({ map:soft, color:new T.Color(1., .1, .42), blending:T.AdditiveBlending, depthWrite:false, transparent:true, opacity:.44 })));
      h.scale.set(1.55, .95, 1); h.position.set(sx * .5, .63, -2.3); h.renderOrder = 5; car.add(h); }
    /* its reflection in the floor: the tail and its lamps again, upside down under it, faint, gone within a metre of the road. Only
       what faces back: the floor pan, mirrored, was a pale slab under the car, and the flank a smear under the near wheel. The
       lamps' is drawn out down the road (a gloss smears a light). */
    const reflM = (c, k, far) => keep(new T.ShaderMaterial({ uniforms:{ uC:{ value:new T.Color(c[0], c[1], c[2]) }, uK:{ value:k }, uF:{ value:far } }, blending:T.AdditiveBlending, depthTest:false, depthWrite:false,
      vertexShader:'varying float vY, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vY = w.y; vN = -normal.z; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader:'uniform vec3 uC; uniform float uK, uF; varying float vY, vN; void main(){ gl_FragColor = vec4(uC * uK * (1. - smoothstep(uF * .15, uF, -vY)) * step(vY, 0.) * smoothstep(.25, .8, vN), 1.); }' }));
    const gBody = geoN(ca.body), gTail = geo(ca.tail);
    const mirror = (g, m, sy) => { const r = new T.Group(); r.scale.y = sy; const o = new T.Mesh(g, m); o.renderOrder = 2; o.frustumCulled = false; r.add(o); car.add(r); };
    mirror(gBody, reflM([.5, .36, .62], .12, .92), -1);
    [[-1, .7], [-1.13, .45], [-1.27, .28], [-1.42, .17], [-1.58, .1]].forEach(q => mirror(gTail, reflM([1.6, .16, .34], q[1], 1.5), q[0]));
    /* its shadows, multiplied onto the floor: a long soft one towards us (the sun is ahead), and a close dark one right under it, so it sits on the road */
    const shade = (w, h, cy, r, stops) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
      x.translate(w / 2, cy); x.scale(w / 2, r); const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1); stops.forEach(q => gr.addColorStop(q[0], 'rgba(0,0,0,' + q[1] + ')')); x.fillStyle = gr; x.fillRect(-1, -cy / r, 2, h / r); return keep(new T.CanvasTexture(c)); };
    const dark = (map, w, d, ro) => { const g = keep(new T.PlaneGeometry(w, d)); g.rotateX(-Math.PI / 2); const m = new T.Mesh(g, keep(new T.MeshBasicMaterial({ map, blending:T.MultiplyBlending, depthWrite:false }))); m.renderOrder = ro; scene.add(m); return m; };
    const sh = dark(shade(64, 128, 46, 62, [[0, .8], [.5, .45], [1, 0]]), 2.7, 7.4, 1); sh.position.set(LANE, .03, 2.6);
    /* the lamps' light on the road behind it: a soft round pink pool. Over the sun's shadow (light lands on a shadow too), under the
       dark beneath the car (it doesn't get in there): so the pool is cut off at the tail, and the car is seen to stand in it.
       (Not flagged transparent, or it would be drawn after everything else whatever its order; it adds all the same.) */
    const plg = keep(new T.PlaneGeometry(5.6, 5)); plg.rotateX(-Math.PI / 2);
    const pool = new T.Mesh(plg, keep(new T.MeshBasicMaterial({ map:soft, depthWrite:false, blending:T.AdditiveBlending, color:new T.Color(1., .1, .4), opacity:.62 })));
    pool.position.set(LANE, .032, 3.35); pool.renderOrder = 1.3; scene.add(pool);
    const cs = dark(shade(96, 192, 96, 96, [[0, 1], [.7, 1], [.88, .55], [1, 0]]), 2.25, 4.9, 1.6); cs.position.set(LANE, .034, 0);
    /* the car follows the pointer across its road, a long way behind it. Where the pointer wants it is smoothed first, then a soft
       spring carries the car there: so it gathers way from nothing, takes about five seconds to cross, and settles as slowly; it
       turns only a little into the move (three degrees at most), and that comes on and goes as gradually. With no pointer about
       it keeps its lane. Only the car: the camera stays where it is, so the picture never swings. */
    const FOLLOW = !STILL && mm('(hover:hover) and (pointer:fine)'), REACH = ROAD - 1.12;
    let carX = LANE, carV = 0, carT = LANE, lastT = null;
    update = t => {
      const dist = t * SPEED;
      gridU.uOff.value = dist % (4 / 3);                      // the floor comes toward us, as the hills do (it ran the other way, into the picture)
      for (const c of chunks){ const zz = (((c.k * CH - dist) % LOOP) + LOOP) % LOOP; c.m.position.z = 14 + CH - zz; }
      const a = (dist / .325) % (2 * Math.PI); wheels.forEach(w => { w.rotation.x = a; });
      const dt = lastT == null ? 0 : clamp(t - lastT, 0, .1); lastT = t;
      const p = FX.ptr, want = FOLLOW && p && p.on ? clamp((p.x - .5) * 2.4, -1, 1) * REACH : LANE;
      carT += (want - carT) * (1 - Math.exp(-dt / .5));
      const om = 1; carV += (om * om * (carT - carX) - 2 * om * carV) * dt; carX += carV * dt;       // critically damped: no overshoot, no snap
      car.position.x = sh.position.x = cs.position.x = pool.position.x = carX; car.rotation.y = Math.PI - carV * .055;
    };
    const cx = LANE - 2.05;                                   // the camera keeps its place behind the car (the road's end and the sun, at infinity, stay put)
    cams = { L:{ pos:[.3 + cx, 1.9, 10.4], at:[-3.6 + cx, 1.7, -60], fov:34 }, P:{ pos:[1.3 + cx, 2.7, 12.5], at:[1.1 + cx, 1.2, -40], fov:56 } };
  }

  if (kind === 'bay'){
    /* towers on the far shore, the sun just behind them; two palms in front, to the right */
    sunDir = DIR(-.06, .15); sunR = 98; look.fogNear = 140; look.fogFar = 1100; look.seaRip = 1.1;
    makeSea(3000, 1);
    const shore = std({ color:'#0b0712', roughness:.9 });
    const sg = keep(new T.BoxGeometry(1600, 4, 90)); sg.translate(-100, 1, -360); scene.add(new T.Mesh(sg, shore));
    const win = { uWin:{ value:new T.Color() }, uSeed:{ value:3 } };
    const wallMat = std({ color:'#0c0a12', roughness:.42, metalness:.35, envMapIntensity:.9, vertexColors:true });
    wallMat.onBeforeCompile = sh => {
      sh.uniforms.uWin = win.uWin;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSyW; varying vec3 vSyN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n#ifdef USE_INSTANCING\n vSyW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz; vSyN = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;\n#else\n vSyW = (modelMatrix * vec4(transformed, 1.)).xyz; vSyN = mat3(modelMatrix) * objectNormal;\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSyW; varying vec3 vSyN; uniform vec3 uWin;\n' + GLSL_HASH)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
          '{ vec3 n = normalize(vSyN); float side = step(.7, 1. - abs(n.y));\n' +
          '  vec2 td = normalize(vec2(-n.z, n.x) + 1e-5); float u = dot(vSyW.xz, td) / 3.2, fy = vSyW.y / 3.6;\n' +
          '  float row = floor(fy), cl = floor(u), h = h21(vec2(row, cl + floor(dot(vSyW.xz, vec2(n.x, n.z)) * .05) * 17.));\n' +
          '  float run = h21(vec2(row * 1.3, floor(u / 5.) + 3.)), on = step(.42, run) * step(.18, h);\n' +
          '  float inRow = smoothstep(.3, .36, fract(fy)) * (1. - smoothstep(.64, .7, fract(fy)));\n' +
          '  totalEmissiveRadiance += uWin * on * inRow * side * step(6., vSyW.y) * (.55 + .9 * fract(h * 7.)); }');
    };
    wallMat.customProgramCacheKey = () => 'sy-windows';
    const towerMat = { wall:wallMat, frame:std({ color:'#120e1a', roughness:.5, metalness:.4, envMapIntensity:.8 }), dark:std({ color:'#07050b', roughness:.7 }),
                       glass:std({ color:'#0a0812', roughness:.3, metalness:.75, envMapIntensity:1.1 }) };       // not a mirror: a mirror that small catches the sun for one frame at a time
    const r = rnd(5), list = [];
    const names = ['tower-a', 'tower-c', 'tower-e'];
    for (let x = -310; x < 50; x += 13 + r() * 15){
      const near = Math.exp(-Math.pow((x + 120) / 110, 2));     // the tallest round the middle of the cluster
      list.push({ n:names[(r() * names.length) | 0], x, z:-338 - r() * 40, s:7 + near * 16 + r() * 5, ry:((r() * 4) | 0) * Math.PI / 2 + (r() - .5) * .3 });
    }
    for (const n of names){
      const items = list.filter(t => t.n === n); if (!items.length || !M[n]) continue;
      for (const part in M[n].parts){
        const im = new T.InstancedMesh(M[n].parts[part], towerMat[part] || towerMat.dark, items.length);
        items.forEach((t, i) => { _e.set(0, t.ry, 0); _q.setFromEuler(_e); _s.set(t.s, t.s * 1.15, t.s); _p.set(t.x, 2.5, t.z); im.setMatrixAt(i, _m.compose(_p, _q, _s)); });
        im.computeBoundingSphere(); scene.add(im);
      }
    }
    pal.win = win.uWin;                                         // one uniform, shared by every tower
    /* the palms, and the low bank of sand they grow from */
    /* the palms: on a spit of sand on our side of the bay, off to the right */
    islet(44, -36, 34, 13, 2.4, 53);
    palm(1, 33, -34, 1.05, Math.PI); palm(0, 43, -40, 1.2, 2.2); palm(2, 55, -33, .95, -.5);
    cams = { L:{ pos:[0, 5, 60], at:[-10, 26, -300], fov:36 }, P:{ pos:[-50, 5, 70], at:[-95, 34, -300], fov:58 } };
    update = t => { const k = Math.sin(t * 2 * Math.PI / 140); camera.position.x += k * 2; };
  }

  if (kind === 'pyramid'){
    /* a pyramid standing in the sea off to the right, a planet low behind it, the sun off to the left */
    sunDir = DIR(-.9, .14); sunR = 0; look.fogNear = 140; look.fogFar = 1100;
    makeSea(3000, .8);
    const edgeU = { value:new T.Color() };
    const pyr = (() => {
      const n = 5, B = 34, Hh = 46, pos = [], bar = [];
      const apex = [0, Hh, 0], c = [[-B, 0, B], [B, 0, B], [B, 0, -B], [-B, 0, -B]];
      for (let f = 0; f < 4; f++){
        const A = c[f], Bv = c[(f + 1) % 4], P = (i, j) => { const u = i / n, v = j / n; return [A[0] + (Bv[0] - A[0]) * u + (apex[0] - A[0]) * v, A[1] + (Bv[1] - A[1]) * u + (apex[1] - A[1]) * v, A[2] + (Bv[2] - A[2]) * u + (apex[2] - A[2]) * v]; };
        for (let j = 0; j < n; j++) for (let i = 0; i < n - j; i++){
          pos.push(...P(i, j), ...P(i + 1, j), ...P(i, j + 1)); bar.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
          if (i < n - j - 1){ pos.push(...P(i + 1, j), ...P(i + 1, j + 1), ...P(i, j + 1)); bar.push(1, 0, 0, 0, 1, 0, 0, 0, 1); }
        }
      }
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('bary', new T.Float32BufferAttribute(bar, 3)); g.computeVertexNormals();
      const m = std({ color:'#0a0614', roughness:.18, metalness:.75, envMapIntensity:1.1, flatShading:true, side:T.DoubleSide });
      m.onBeforeCompile = sh => {
        sh.uniforms.uEdge = edgeU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 bary; varying vec3 vBary;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBary = bary;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBary; uniform vec3 uEdge;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 bw = fwidth(vBary); vec3 b = smoothstep(vec3(0.), bw * 1.3, vBary); totalEmissiveRadiance += uEdge * (1. - min(min(b.x, b.y), b.z)); }');
      };
      m.customProgramCacheKey = () => 'sy-bary';
      return new T.Mesh(g, m);
    })();
    pyr.position.set(62, -.5, -170); scene.add(pyr);
    /* the planet: a gas giant in bands, lit from the left */
    const pc = document.createElement('canvas'); pc.width = 8; pc.height = 256;
    { const x = pc.getContext('2d'), r = rnd(23), cs = ['#3a1450', '#6a2270', '#b2427e', '#f08a7a', '#5a1a66', '#2a0e40', '#c45a8a', '#7a2a6e'];
      for (let y = 0; y < 256;){ const h = 3 + (r() * 22) | 0; x.fillStyle = cs[(r() * cs.length) | 0]; x.fillRect(0, y, 8, h); y += h; }
      x.globalAlpha = .5; x.filter = 'blur(2px)'; x.drawImage(pc, 0, 0); }
    const ptex = keep(new T.CanvasTexture(pc)); ptex.colorSpace = T.SRGBColorSpace;
    const planet = new T.Mesh(keep(new T.SphereGeometry(1, 48, 32)), std({ map:ptex, roughness:.9, envMapIntensity:.25 }));
    planet.scale.setScalar(165); planet.position.set(330, 190, -820); planet.rotation.set(.35, 0, .28); scene.add(planet);
    /* low hills on the horizon behind, drawn as a lit grid */
    const gridU = { value:new T.Color() };
    const gm = std({ color:'#0b0614', roughness:.9 });
    gm.onBeforeCompile = sh => {
      sh.uniforms.uGrid = gridU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSyW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSyW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSyW; uniform vec3 uGrid;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec2 q = vSyW.xz / 14.; vec2 g = abs(fract(q - .5) - .5) / fwidth(q); totalEmissiveRadiance += uGrid * (1. - min(min(g.x, g.y), 1.)) * smoothstep(.5, 3., vSyW.y); }');
    };
    gm.customProgramCacheKey = () => 'sy-grid';
    range({ x0:-700, x1:760, z:-430, depth:150, sx:90, sz:10, n:12, h:34, wMin:40, wMax:120, seed:31, mat:gm });
    pal.grid = gridU; pal.edge = edgeU;
    /* two palms on a spit of sand, right of the pyramid */
    islet(128, -128, 22, 11, 2.2, 61);
    palm(1, 122, -126, 1.6, Math.PI + .2); palm(0, 134, -132, 1.8, 1.2);
    update = t => { pyr.rotation.y = t * 2 * Math.PI / 260; };
    cams = { L:{ pos:[0, 7, 40], at:[10, 28, -200], fov:38 }, P:{ pos:[40, 7, 60], at:[66, 34, -200], fov:60 } };
  }

  if (kind === 'shoreA' || kind === 'shoreB'){
    /* the quiet one: the sun on the sea to one side, one palm leaning in from the other */
    const sgn = kind === 'shoreA' ? -1 : 1;
    sunDir = DIR(sgn * .3, .055); sunR = 112; look.fogNear = 100; look.fogFar = 1000; look.seaRip = 1.15;
    makeSea(3000, 1.1);
    islet(-sgn * 13, -31, 11, 5.5, 1.3, kind === 'shoreA' ? 71 : 73);
    palm(2, -sgn * 11.3, -31, 1.02, sgn < 0 ? Math.PI : 0);          // leaning towards the sun; still (fine leaflets on the move would only shimmer)
    cams = { L:{ pos:[0, 3.4, 22], at:[sgn * 26, 9, -200], fov:36 }, P:{ pos:[-sgn * 14, 3.4, 30], at:[sgn * 32.4, 10, -200], fov:60 } };
  }

  /* ═══ the bloom, and the last pass: tone, a slight vignette, grain ═══ */
  const qg = keep(new T.BufferGeometry());
  qg.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); qg.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new T.Mesh(qg); quad.frustumCulled = false;
  const pscene = new T.Scene(); pscene.add(quad); const pcam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (frag, u, o) => keep(new T.ShaderMaterial(Object.assign({ uniforms:u, vertexShader:QUAD_V, fragmentShader:frag, depthTest:false, depthWrite:false }, o || {})));
  const mainRT = keep(new T.WebGLRenderTarget(2, 2, { type:RT_TYPE, samples:SMALL ? 0 : 4, depthBuffer:true }));
  const LV = [2, 4, 8, 16].map(() => keep(new T.WebGLRenderTarget(2, 2, { type:RT_TYPE, depthBuffer:false })));
  /* steadying (TAA_F), in every scene but the road (it moves too fast to fold frames together) and never in a still */
  const TAA = !STILL && kind !== 'drive', TAA_K = .1;                   // each frame's share: about the last ten frames are in the picture
  const histRT = TAA ? [0, 1].map(() => keep(new T.WebGLRenderTarget(2, 2, { type:RT_TYPE, depthBuffer:false }))) : [];
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0){ f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const JIT = Array.from({ length:16 }, (_, i) => [halton(i + 1, 2) - .5, halton(i + 1, 3) - .5]);
  let taaN = 0, taaI = 0;                                     // frames folded in since the last fresh start; which history is the latest
  const preM = pass(PRE_F, { tSrc:{ value:null }, uTx:{ value:new T.Vector2() }, uThr:{ value:hdr ? 1 : .8 }, uKnee:{ value:.5 } });
  const downM = pass(DOWN_F, { tSrc:{ value:null }, uTx:{ value:new T.Vector2() } });
  const upM = pass(UP_F, { tSrc:{ value:null }, uTx:{ value:new T.Vector2() }, uW:{ value:.75 } }, { blending:T.AdditiveBlending, transparent:true });       // uW < 1: the widest halo is the faintest
  const compU = { tScene:{ value:mainRT.texture }, tBloom:{ value:LV[0].texture }, uBloom:{ value:.6 }, uExp:{ value:1 }, uGrain:{ value:1.5 / 255 }, uSeed:{ value:0 }, uVig:{ value:.55 } };
  const compM = pass(COMP_F, compU);
  const taaM = pass(TAA_F, { tCur:{ value:mainRT.texture }, tHist:{ value:null }, uTx:{ value:new T.Vector2() }, uK:{ value:1 }, uCl:{ value:1 } });
  const blit = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(pscene, pcam); };
  const bloom = src => {
    preM.uniforms.tSrc.value = src; preM.uniforms.uTx.value.set(.5 / mainRT.width, .5 / mainRT.height);
    renderer.setRenderTarget(LV[0]); renderer.clear(); blit(preM, LV[0]);
    for (let i = 1; i < LV.length; i++){ downM.uniforms.tSrc.value = LV[i - 1].texture; downM.uniforms.uTx.value.set(.5 / LV[i - 1].width, .5 / LV[i - 1].height); blit(downM, LV[i]); }
    for (let i = LV.length - 1; i > 0; i--){ upM.uniforms.tSrc.value = LV[i].texture; upM.uniforms.uTx.value.set(.5 / LV[i].width, .5 / LV[i].height); blit(upM, LV[i - 1]); }
  };

  /* ═══ the camera: one framing for a wide screen, one for a tall one, and in between ═══ */
  let W = 2, H = 2;
  const frame = () => {
    const a = W / H, k = clamp((a - .56) / (1.6 - .56), 0, 1), L = cams.L, P = cams.P;
    camera.position.set(lerp(P.pos[0], L.pos[0], k), lerp(P.pos[1], L.pos[1], k), lerp(P.pos[2], L.pos[2], k));
    camera.fov = lerp(P.fov, L.fov, k); camera.aspect = a; camera.updateProjectionMatrix();
    camera.lookAt(lerp(P.at[0], L.at[0], k), lerp(P.at[1], L.at[1], k), lerp(P.at[2], L.at[2], k));
  };

  /* ═══ dusk or night ═══ */
  const setMode = dk => {
    const d = dk ? DAY.night : DAY.dusk;
    skyU.uTop.value.set(d.top); skyU.uMid.value.set(d.mid); skyU.uHor.value.set(d.hor); skyU.uGlow.value.set(d.glow); skyU.uStars.value = d.stars;
    skyU.uSun.value.copy(sunDir);
    sunU.uTop.value.set(d.sunTop); sunU.uBot.value.set(d.sunBot); sunU.uI.value = d.sunI; sun.visible = sunR > 0;
    fog.color.set(d.fog); fog.near = look.fogNear; fog.far = look.fogFar;
    light.color.set(d.light); light.intensity = d.lightI; light.position.copy(sunDir).multiplyScalar(200);
    hemi.color.set(d.hemiTop); hemi.groundColor.set(d.hemiBot); hemi.intensity = d.hemiI;
    for (const m of neonMats){ m.color.set(d.neon).multiplyScalar(d.neonI * m.userData.k); }
    scene.traverse(o => { if (o.material && o.material.userData && o.material.userData.pale) o.material.color.set('#ffd9ec').multiplyScalar(dk ? .9 : 1.1); });
    if (pal.win) pal.win.value.set(dk ? '#ff4fb4' : '#ffb27a').multiplyScalar(dk ? 2.2 : 1.1);
    if (pal.edge) pal.edge.value.set(d.neon).multiplyScalar(dk ? 2.4 : 1.8);
    if (pal.grid) pal.grid.value.set(dk ? '#9a3cff' : '#ff5fae').multiplyScalar(dk ? .9 : .6);
    if (pal.floor){ pal.floor.uGrid.value.set('#ff2a9c').multiplyScalar(dk ? 2.4 : 2.0); pal.floor.uRoad.value.set('#ff5fb8').multiplyScalar(dk ? 3.2 : 2.7); }
    if (pal.paint){ pal.paint.uShade.value = dk ? 1.9 : 1.4; pal.paint.uTint.value.setRGB(dk ? 1 : .72, dk ? 1 : .64, dk ? 1 : 1.3); }
    if (pal.crag) pal.crag.value.set(dk ? '#4d6dff' : '#6a78ff').multiplyScalar(dk ? .7 : .58);      // a third of what it was: the hills were as bright as the road
    if (sea && sea.material.uniforms && sea.material.uniforms.uDeep){
      const u = sea.material.uniforms; u.uDeep.value.set(dk ? '#07030e' : '#1a0a22'); u.uFog.value.set(d.fog); u.uFogR.value.set(look.fogNear, look.fogFar); u.uRip.value = look.seaRip;
    }
    scene.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial && m.userData.env == null) m.userData.env = m.envMapIntensity; if (m && m.isMeshStandardMaterial) m.envMapIntensity = m.userData.envK ? m.userData.envK[dk ? 1 : 0] : m.userData.env * d.env; });
    compU.uBloom.value = d.bloom * look.bloom; compU.uExp.value = d.exposure * look.exp;
    placeSun(); makeEnv(); taaN = 0;
  };
  const resize = (w, h) => {
    W = w; H = h; renderer.setSize(w, h, false);
    mainRT.setSize(w, h); histRT.forEach(rt => rt.setSize(w, h)); taaN = 0;
    LV.forEach((rt, i) => rt.setSize(Math.max(1, Math.round(w / Math.pow(2, i + 1))), Math.max(1, Math.round(h / Math.pow(2, i + 1)))));
    if (sea && sea.getRenderTarget) sea.getRenderTarget().setSize(Math.max(64, Math.round(w * .5)), Math.max(64, Math.round(h * .5)));
    frame(); placeSun();
  };
  const render = t => {
    renderer.info.reset();
    frame(); update(t); camera.updateMatrixWorld();
    if (TAA){ const j = JIT[taaN % 16]; camera.setViewOffset(W, H, j[0], j[1], W, H); }      // a fraction of a pixel off from the last frame
    placeSun();
    sunU.uT.value = STILL ? 0 : (t * SUN_RISE) % 1;             // the gaps in the sun rise (the owner asked): slowly, and not in the still pictures
    if (sea && sea.material.uniforms && sea.material.uniforms.uTime) sea.material.uniforms.uTime.value = t % 1000;
    renderer.setRenderTarget(mainRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
    let src = mainRT;
    if (TAA){ const a = histRT[taaI], b = histRT[1 - taaI], u = taaM.uniforms;
      u.tHist.value = a.texture; u.uK.value = taaN ? TAA_K : 1; u.uTx.value.set(1 / W, 1 / H); blit(taaM, b); taaI = 1 - taaI; taaN++; src = b; }
    compU.tScene.value = src.texture; bloom(src.texture);
    compU.uSeed.value = 0;                                      // no film grain (the owner found it noise, worst in the dark): only a still dither, a level and a half deep, so the night sky doesn't band
    blit(compM, null);
  };
  setMode(dark);
  frame();
  await (renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve());
  return {
    render, resize, mode:setMode,
    /* for measuring (STILL only): what one frame costs */
    stats(){ const i = renderer.info; return { calls:i.render.calls, triangles:i.render.triangles, lines:i.render.lines, programs:i.programs.length, geometries:i.memory.geometries, textures:i.memory.textures, size:[W, H], hdr, msaa:mainRT.samples }; },
    bench(n){ const gl = renderer.getContext(); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) render(40 + i / 30); gl.finish(); return (performance.now() - t0) / n; },
    dispose(){
      try { dispose.forEach(o => o && o.dispose && o.dispose()); if (envRT) envRT.dispose(); pmrem.dispose();
        scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); } catch {}
    }
  };
}

/* ═══════════════ the scene fx.js drives ═══════════════ */
FX.scenes.synth = {
  dpr:STILL ? 2 : SMALL ? .7 : 1, maxPx:STILL ? 4e6 : SMALL ? 5.5e5 : 1.35e6, fps:30,
  create(canvas, env){
    if (!STILL && (weak() || mm('(prefers-reduced-motion: reduce)'))) return null;      // the stylesheet's still picture stays, and Three.js is never fetched
    /* in a frame (the Mahjong board inside Games, a page previewed in the Theme finder) the page around it has its own
       scene, or should: a second one would only double the cost. The frame keeps the still (or, Mahjong, plain colour). */
    try { if (!STILL && (window.top !== window || env.page === 'hkmahjong')) return null; } catch { return null; }
    const kind = PAGE[env.page] || 'shoreA';
    let e = env, st = 'idle', R = null, W = canvas.width, H = canvas.height;
    canvas.classList.add('sy-wait');
    if (STILL){ root.classList.add('sy-still'); const s = document.createElement('style'); s.textContent = 'html.sy-still body{visibility:hidden}html.sy-still .fx-bg{transition:none!important;opacity:1!important}'; document.head.appendChild(s); }
    const fail = err => { st = 'failed'; if (R) try { R.dispose(); } catch {} R = null; canvas.classList.add('sy-wait'); root.classList.remove('synth-live'); if (err){ console.warn('synth:', err && err.message || err); if (STILL) window.__synthErr = String(err && err.stack || err); } };
    canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); fail('context lost'); }, { once:true });
    const start = () => {
      if (st !== 'idle') return; st = 'loading';
      build(canvas, kind, e.dark).then(r => {
        if (st !== 'loading'){ r.dispose(); return; }
        R = r; st = 'ready'; R.resize(W, H);
        R.render(STILL ? STILL_T : FX.now());
        if (STILL){ window.__synthStats = () => R && R.stats(); window.__synthBench = n => R && R.bench(n || 20); }
        requestAnimationFrame(() => { canvas.classList.remove('sy-wait'); root.classList.add('synth-live'); if (STILL) window.__synthReady = true; });
      }, fail);
    };
    if (e.animate || STILL) start();
    return {
      frame(t){ if (R) try { R.render(STILL ? STILL_T : t); } catch (err) { fail(err); } },
      resize(w, h){ W = w; H = h; if (R) R.resize(w, h); },
      env(n){ const was = e; e = n; if ((n.animate || STILL) && st === 'idle') start(); if (R && n.dark !== was.dark) R.mode(n.dark); },
      dispose(){ st = 'gone'; if (R) R.dispose(); R = null; root.classList.remove('synth-live'); }
    };
  }
};
})();
