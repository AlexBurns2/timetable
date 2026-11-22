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

/* a fluted shaft: radius r0 at the foot, r1 at the top (with a little swelling), n flutes with fillets between */
function shaftGeo(r0, r1, h, n = 24, vs = 48, per = 10){
  const A = n * per, pos = [], uv = [], idx = [];
  for (let j = 0; j <= vs; j++){
    const v = j / vs, y = v * h, R = r0 + (r1 - r0) * v + Math.sin(v * Math.PI) * r0 * .025, fd = R * .075 * Math.min(1, v / .04, (1 - v) / .04);
    for (let i = 0; i <= A; i++){
      const a = i / A * TAU, u = (i % per) / per, f = u < .16 ? 0 : Math.sqrt(Math.max(0, 1 - Math.pow((u - .16) / .84 * 2 - 1, 2)));
      const rr = R - fd * f; pos.push(Math.sin(a) * rr, y, Math.cos(a) * rr); uv.push(i / A * 3, v * h * 1.4);
    }
  }
  for (let j = 0; j < vs; j++) for (let i = 0; i < A; i++){ const a = j * (A + 1) + i, b = a + A + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const lathe = (pts, seg = 96) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); return g; };
/* a broken top: the shaft's last ring pulled into a jagged break */
function breakTop(g, h, seed){
  const r = rnd(seed), p = g.attributes.position, top = [];
  for (let k = 0; k < p.count; k++) if (p.getY(k) > h * .999) top.push(k);
  const bumps = Array.from({ length:7 }, () => [r() * TAU, .02 + r() * .1]);
  for (const k of top){ const a = Math.atan2(p.getX(k), p.getZ(k)); let d = 0; for (const b of bumps) d += b[1] * Math.exp(-Math.pow(Math.atan2(Math.sin(a - b[0]), Math.cos(a - b[0])) * 2.2, 2)); p.setY(k, h - .12 + d * 1.6); }
  g.computeVertexNormals();
}
/* a column: square plinth, mouldings, fluted shaft, and an Ionic capital (volutes) or a plain one; or broken off */
export function column({ D = .36, H = 1.5, mat, ionic = true, broken = false, seed = 3 }){
  const g = new THREE.Group(), r = D / 2, m = mat || marble(1);
  const add = (geo, y = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const ph = D * .22; add(new THREE.BoxGeometry(D * 1.42, ph, D * 1.42), ph / 2);
  const base = [[0, 0], [r * 1.36, 0], [r * 1.4, .02 * D], [r * 1.4, .1 * D], [r * 1.3, .16 * D], [r * 1.16, .2 * D], [r * 1.13, .26 * D], [r * 1.26, .3 * D], [r * 1.24, .38 * D], [r * 1.08, .42 * D], [r * 1.02, .46 * D], [0, .46 * D]];
  add(lathe(base), ph);
  const capH = ionic ? D * .62 : D * .34, sh = H - ph - .46 * D - (broken ? 0 : capH), sy = ph + .46 * D;
  const s = shaftGeo(r, r * .84, sh); if (broken) breakTop(s, sh, seed); add(s, sy);
  if (broken){ const cap = lathe([[0, 0], [r * .7, 0]], 48); return g; }
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
