/* The things the scenes are made of: marble, columns, blocks, the Poly Haven television, glossy solids. */
import { THREE, tex, loadGLTF, TAU, rnd } from './core.js';

const PH = '/ph-dl/';
/* polished marble (Poly Haven marble_01) */
export function marble(rep = 1, tint = 0xffffff, opts = {}){
  const m = new THREE.MeshPhysicalMaterial(Object.assign({
    color:tint, map:tex(PH + 'marble_01/marble_01_diff_2k.jpg', true, rep), roughnessMap:tex(PH + 'marble_01/marble_01_rough_2k.jpg', false, rep),
    normalMap:tex(PH + 'marble_01/marble_01_nor_gl_2k.jpg', false, rep), normalScale:new THREE.Vector2(.6, .6), roughness:.9, clearcoat:.55, clearcoatRoughness:.18 }, opts));
  /* the photo's marble is warm and grey: keep its veins, lift it to white */
  const vein = opts.vein == null ? .4 : opts.vein; delete m.vein;
  m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    { float l = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)); diffuseColor.rgb = mix(vec3(.93), vec3(smoothstep(.05, .75, l)) * .93, ${vein.toFixed(2)}); diffuseColor.rgb *= diffuse; }`); };
  m.customProgramCacheKey = () => 'marble' + vein;
  return m;
}
export const glossy = (color, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness:.18, clearcoat:1, clearcoatRoughness:.06, metalness:0 }, o));
export const pearl = (color, o = {}) => glossy(color, Object.assign({ iridescence:1, iridescenceIOR:1.32, iridescenceThicknessRange:[180, 520], roughness:.14 }, o));

/* a fluted shaft: radius r0 at the foot, r1 at the top (with a little swelling), n flutes with fillets between.
   Wound to face out (it faced in: the near side was culled and the far side's inside showed, lit from the wrong way).
   cut: { sl, phi, rag, seed } breaks the top off on a slant: a plane rising sl metres a metre towards phi (an angle in x, z), its
   highest point just under the shaft's own top. rag (0 to 1 and over) is how ragged the break is: 0 is a saw cut; 1 leaves the
   face a little uneven, with one shallow step across it and a few flakes off its edge, none deeper than a few centimetres (the
   first break was a jagged open rim, which the owner found messy; a dead flat cut, they then found too clean). The break's face
   comes back as userData.cap, in facets (its edge follows the flutes). */
function shaftGeo(r0, r1, h, n = 24, vs = 48, per = 10, cut = null){
  const A = n * per, pos = [], uv = [], idx = [];
  const prof = (v, u) => { const R = r0 + (r1 - r0) * v + Math.sin(v * Math.PI) * r0 * .025, fd = R * .075 * Math.min(1, v / .04, cut ? 1 : (1 - v) / .04);
    return R - fd * (u < .16 ? 0 : Math.sqrt(Math.max(0, 1 - Math.pow((u - .16) / .84 * 2 - 1, 2)))); };
  const rag = cut && cut.rag || 0, sd = cut && cut.seed || 3, A1 = .016 * rag, A2 = .006 * rag;
  const cx = cut ? Math.cos(cut.phi) : 0, cz = cut ? Math.sin(cut.phi) : 0, hc = cut ? h - cut.sl * r1 * 1.03 - .004 - A1 - A2 : 0;
  /* smooth noise over the break's face */
  const hsh = (a, b, k) => { const v = Math.sin(a * 127.1 + b * 311.7 + (k + sd) * 74.7) * 43758.5453; return v - Math.floor(v); };
  const vn = (x, z, k) => { const a = Math.floor(x), b = Math.floor(z), fx = x - a, fz = z - b, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const p0 = hsh(a, b, k), p1 = hsh(a + 1, b, k), p2 = hsh(a, b + 1, k), p3 = hsh(a + 1, b + 1, k); return (p0 + (p1 - p0) * ux) + ((p2 + (p3 - p2) * ux) - (p0 + (p1 - p0) * ux)) * uz; };
  const st = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rg = rnd(sd * 977 + 11), bites = [], psi = rg() * TAU, off = (rg() - .5) * r1 * .5;
  /* the flakes off its edge: each a flat facet, a somewhat steeper plane that takes a wide, shallow sliver off the rim, so the
     break is a few planes meeting, not one. (A round scoop looked melted, not broken; a steep flake, falling fast across the
     flutes, left a row of teeth down their ridges, like icing.) Most where they show, on the low edge (towards the camera) and
     round the sides. [outward x, z; how far in from the rim it starts; how much more steeply it falls] */
  if (rag) for (let k = 0; k < 5; k++){ const th = cut.phi + Math.PI + (k < 3 ? (k - 1) * 1.15 + (rg() - .5) * .7 : (rg() - .5) * TAU); bites.push([Math.cos(th), Math.sin(th), (.015 + rg() * .03) * rag, .55 + rg() * .65]); }
  const cutY = (x, z) => { let y = hc + cut.sl * (x * cx + z * cz); if (!rag) return y;
    y += (vn(x / (r1 * .9) + 7, z / (r1 * .9) + 3, 1) - .5) * 2 * A1 + (vn(x / (r1 * .2), z / (r1 * .2), 2) - .5) * 2 * A2;                    // uneven, slowly and finely
    const along = -x * Math.sin(psi) + z * Math.cos(psi), acr = x * Math.cos(psi) + z * Math.sin(psi) - off + (vn(along / (r1 * .28) + 20, 5, 3) - .5) * r1 * .34;
    y -= .026 * rag * st(-.005, .005, acr);                                                                                               // one shallow step, its line wandering
    for (const b of bites){ const d = x * b[0] + z * b[1] - (r1 - b[2]); if (d > 0) y -= d * b[3]; }                                  // flakes off the edge
    return y; };
  for (let j = 0; j <= vs; j++){
    const v = j / vs;
    for (let i = 0; i <= A; i++){
      const a = i / A * TAU, u = (i % per) / per, sa = Math.sin(a), ca = Math.cos(a); let y = v * h, rr = prof(v, u);
      if (cut) for (let it = 0; it < 3; it++){ const yc = cutY(sa * rr, ca * rr); if (y <= yc && !it) break; y = yc; rr = prof(y / h, u); }       // above the break: brought down onto it, at the shaft's width there
      pos.push(sa * rr, y, ca * rr); uv.push(i / A * 3, y * 1.4);
    }
  }
  for (let j = 0; j < vs; j++) for (let i = 0; i < A; i++){ const a = j * (A + 1) + i, b = a + A + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (cut){                                                 /* the break's face: rings from its middle out to the shaft's last ring (every point of which is on the break), in facets */
    const o = vs * (A + 1), K = rag ? 16 : 1, cp = [0, cutY(0, 0), 0], cu = [.5, .5], ci = [];
    for (let k = 1; k <= K; k++) for (let i = 0; i <= A; i++){ const f = k / K, x = pos[(o + i) * 3] * f, z = pos[(o + i) * 3 + 2] * f;
      cp.push(x, k === K ? pos[(o + i) * 3 + 1] : cutY(x, z), z); cu.push(.5 + x * 1.6, .5 + z * 1.6); }
    for (let i = 0; i < A; i++) ci.push(0, i + 1, i + 2);
    for (let k = 1; k < K; k++) for (let i = 0; i < A; i++){ const a = 1 + (k - 1) * (A + 1) + i, b = a + A + 1; ci.push(a, b, a + 1, a + 1, b, b + 1); }
    let c = new THREE.BufferGeometry(); c.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); c.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2)); c.setIndex(ci);
    if (rag) c = c.toNonIndexed(); c.computeVertexNormals();
    g.userData.cap = c; g.userData.capTop = hc + cut.sl * r1 + A1 + A2;
  }
  return g;
}
const lathe = (pts, seg = 96) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); return g; };
/* a column: square plinth, mouldings, fluted shaft, and an Ionic capital (volutes) or a plain one; or broken off (broken: true, or { sl, phi, rag }; seed lays out the break) */
export function column({ D = .36, H = 1.5, mat, ionic = true, broken = false, seed = 3 }){
  const g = new THREE.Group(), r = D / 2, m = mat || marble(1);
  const add = (geo, y = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const ph = D * .22; add(new THREE.BoxGeometry(D * 1.42, ph, D * 1.42), ph / 2);
  const base = [[0, 0], [r * 1.36, 0], [r * 1.4, .02 * D], [r * 1.4, .1 * D], [r * 1.3, .16 * D], [r * 1.16, .2 * D], [r * 1.13, .26 * D], [r * 1.26, .3 * D], [r * 1.24, .38 * D], [r * 1.08, .42 * D], [r * 1.02, .46 * D], [0, .46 * D]];
  add(lathe(base), ph);
  const capH = ionic ? D * .62 : D * .34, sh = H - ph - .46 * D - (broken ? 0 : capH), sy = ph + .46 * D;
  /* broken: broken off on a slant, the face turned a little towards us and the middle of the picture; a little ragged (see shaftGeo) */
  const bo = typeof broken === 'object' ? broken : {};
  const s = shaftGeo(r, r * .84, sh, 24, 48, 10, broken ? { sl:bo.sl || .8, phi:bo.phi != null ? bo.phi : -1.1, rag:bo.rag != null ? bo.rag : 1.3, seed } : null); add(s, sy);
  if (broken){ add(s.userData.cap, sy); g.userData.top = sy + s.userData.capTop; return g; }
  const ty = sy + sh, r1 = r * .84;
  add(lathe([[0, 0], [r1 * 1.08, 0], [r1 * 1.1, .03 * D], [r1 * 1.08, .06 * D], [0, .06 * D]]), ty);                           /* astragal */
  if (ionic){
    add(lathe([[0, 0], [r1 * 1.02, 0], [r1 * 1.22, .1 * D], [r1 * 1.3, .2 * D], [r1 * 1.26, .26 * D], [0, .26 * D]]), ty + .06 * D);   /* echinus */
    const cy = ty + .3 * D, cw = D * 1.46, cd = D * .86, vr = D * .27;
    add(new THREE.BoxGeometry(cw, D * .14, cd), cy + D * .07);                                                                    /* the band between the volutes */
    for (const sx of [-1, 1]){
      const cx = sx * (cw / 2 - vr * .55), vy = cy - vr * .25;
      const cyl = new THREE.CylinderGeometry(vr, vr, cd, 64); cyl.rotateX(Math.PI / 2); const o = add(cyl, vy); o.position.x = cx;            /* the cushion */
      /* the spiral, standing proud of both faces */
      const shp = new THREE.Shape(), N = 220, turns = 2.6, w0 = vr * .2;
      const pt = (t, off) => { const th = t * turns * TAU, rad = vr * .95 * (1 - t * .86) - off; return [Math.cos(th * sx) * rad, Math.sin(th * sx) * rad]; };
      for (let k = 0; k <= N; k++){ const p = pt(k / N, 0); k ? shp.lineTo(p[0], p[1]) : shp.moveTo(p[0], p[1]); }
      for (let k = N; k >= 0; k--){ const p = pt(k / N, w0 * (1 - k / N * .7)); shp.lineTo(p[0], p[1]); }
      const sg = new THREE.ExtrudeGeometry(shp, { depth:cd + D * .05, bevelEnabled:true, bevelThickness:D * .012, bevelSize:D * .01, bevelSegments:2, curveSegments:4, steps:1 });
      sg.translate(0, 0, -(cd + D * .05) / 2); const so = add(sg, vy); so.position.x = cx;
      const eye = new THREE.SphereGeometry(vr * .16, 24, 16); eye.scale(1, 1, 3.2); const eo = add(eye, vy); eo.position.x = cx;
    }
    add(new THREE.BoxGeometry(D * 1.22, D * .07, D * 1.04), cy + D * .14 + D * .035);                                             /* abacus */
    g.userData.top = cy + D * .14 + D * .07;
  } else {
    add(lathe([[0, 0], [r1 * 1.02, 0], [r1 * 1.25, .1 * D], [r1 * 1.34, .17 * D], [0, .17 * D]]), ty + .06 * D);
    add(new THREE.BoxGeometry(D * 1.3, D * .11, D * 1.3), ty + .06 * D + .17 * D + D * .055);
    g.userData.top = ty + .06 * D + .17 * D + D * .11;
  }
  return g;
}
/* a block (plinth, step) with softened edges */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function block(w, h, d, mat, rad = .012){ const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad), mat); o.castShadow = o.receiveShadow = true; return o; }

/* the Poly Haven television */
let tvGLTF = null;
export async function tv(){
  if (!tvGLTF) tvGLTF = await loadGLTF(PH + 'television_02/television_02_2k.gltf');
  const o = tvGLTF.scene.clone(true); o.traverse(c => { if (c.isMesh){ c.castShadow = c.receiveShadow = true; } }); return o;
}
