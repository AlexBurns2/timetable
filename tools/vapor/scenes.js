/* The Vaporwave world, page by page. A job renders one part of one scene in one light:
     ?scene=tt|cal|home|stairs|planets|solids &mode=l|d &part=plate|platew|left|right|phone|<float name>
   plate: the floor (or water, or cloud sea) and anything far off, alpha where the sky is
   left / right: a group on its own, with the shadow and reflection it lays on the floor (a catcher floor)
   <float>: a floating thing on its own, so the page can let it bob
   phone: the whole thing framed for a tall screen, subjects at the edges */
import { THREE, P, makeStage, emit, done, crop, rnd, TAU, pending } from './core.js';
import { column, marble, tv, block, glossy, pearl } from './props.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const scene = P.scene || 'tt', mode = P.mode || 'l', part = P.part || 'plate', dk = mode === 'd';
const phone = part === 'phone', wide = part === 'platew', W = phone ? 900 : wide ? 5280 : 2880, H = phone ? 1600 : 1200;      /* platew: the plate again, wider (the same lens, so its middle is the plate exactly), for windows wider than 2.4 to 1 */
const SC = {
  tt:{ hy:.6, sun:-1 }, cal:{ hy:.62, sun:1 }, notes:{ hy:.62, sun:1 }, home:{ hy:.63, sun:-1 }, stairs:{ hy:.7, sun:-1 }, planets:{ hy:.8, sun:-1 }, solids:{ hy:.62, sun:-1 } }[scene];
const S = makeStage({ w:W, h:H, hy:SC.hy, fov:phone ? 44 : 30, camH:1.35 });

/* ── the light: pastel daylight, or a pastel twilight ── */
const HDR = '/ph-dl/kloofendal_48d_partly_cloudy_puresky/kloofendal_48d_partly_cloudy_puresky_2k.hdr';
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
await S.env(HDR, dk
  ? el => el > 0 ? [...mixc([1.05, .62, .8], [.32, .4, .78], Math.min(1, el * 2.6)), 1] : [.55, .48, .7, 1]
  : el => el > 0 ? [...mixc([1.1, .8, .93], [.62, .9, 1.08], Math.min(1, el * 2.4)), .82] : [1.05, .9, .97, .8], 1.8);
S.scene.environmentIntensity = dk ? .42 : .9;
const kEl = dk ? .3 : .78;
S.st.keyDir.set(SC.sun * Math.cos(kEl) * .9, Math.sin(kEl), Math.cos(kEl) * .42).normalize(); S.st.keySoft = dk ? .07 : .045;
S.key.color.set(dk ? 0xffb2cc : 0xfff2f6); S.key.intensity = dk ? 2.1 : 2.9;
S.sky.color.set(dk ? 0x9a9ce0 : 0xd8e8ff); S.sky.intensity = dk ? .5 : .75;
const LOOK = { exposure:dk ? 1.05 : 1.12, tm:1, grain:1.1, sat:dk ? 1.0 : 1.04 };
Object.assign(S.floorUni.uKmin, { value:dk ? .52 : .56 }); S.floorUni.uFade.value.set(24, 75);

const checker = (a, b, rep = 300, n = 256) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, n, n); g.fillStyle = b; g.fillRect(0, 0, n / 2, n / 2); g.fillRect(n / 2, n / 2, n / 2, n / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; t.repeat.set(rep, rep); t.offset.set(.5, .5); return t; };
const FLOORS = { bw:['#f7f5fb', '#17151f'], pink:['#ffffff', '#ffb8da'], lav:['#ffffff', '#cdbdf6'], teal:['#ffffff', '#a8e4ea'], dusk:['#b3a8dc', '#423f6e'] };
const glossyChecker = (k, o = {}) => S.glossyFloor(Object.assign({ map:checker(...FLOORS[dk ? 'dusk' : k], 300) }, o));

/* ── the pieces ── */
const at = (sx, sy) => S.floorAt(sx, sy), air = (sx, sy, d) => S.rayAt(sx, sy, d);
const marbleM = () => marble(1, dk ? 0xe9e4f6 : 0xffffff);
function screenTex(){                            /* the TV's picture: the boot screen of Opaline Systems, a company we made up (its logo is ours) */
  const c = document.createElement('canvas'); c.width = 640; c.height = 500; const g = c.getContext('2d'), cx = 320;
  let gr = g.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#d6c6ff'); gr.addColorStop(1, '#ffc6e2'); g.fillStyle = gr; g.fillRect(0, 0, 640, 500);
  for (let i = 0; i < 24; i++){ const a0 = i / 24 * TAU, a1 = a0 + TAU / 48; g.fillStyle = i % 2 ? 'rgba(255,255,255,.16)' : 'rgba(170,236,246,.12)';
    g.beginPath(); g.moveTo(cx, 190); g.lineTo(cx + Math.cos(a0) * 900, 190 + Math.sin(a0) * 900); g.lineTo(cx + Math.cos(a1) * 900, 190 + Math.sin(a1) * 900); g.closePath(); g.fill(); }
  /* the logo: an opal tile, a white ring, a glint */
  const T = 150, tx = cx - T / 2, ty = 115, rr = 26;
  g.save(); g.shadowColor = 'rgba(90,60,150,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  g.beginPath(); g.moveTo(tx + rr, ty); g.arcTo(tx + T, ty, tx + T, ty + T, rr); g.arcTo(tx + T, ty + T, tx, ty + T, rr); g.arcTo(tx, ty + T, tx, ty, rr); g.arcTo(tx, ty, tx + T, ty, rr); g.closePath();
  gr = g.createLinearGradient(tx, ty, tx + T, ty + T); gr.addColorStop(0, '#ffb3d9'); gr.addColorStop(.5, '#a9ecf6'); gr.addColorStop(1, '#cdb6f6'); g.fillStyle = gr; g.fill(); g.restore();
  g.strokeStyle = '#ffffff'; g.lineWidth = 15; g.beginPath(); g.arc(cx, ty + T / 2, 40, 0, TAU); g.stroke();
  const sx = cx + 46, sy = ty + 34, sr = 14; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(sx, sy - sr); g.quadraticCurveTo(sx, sy, sx + sr, sy); g.quadraticCurveTo(sx, sy, sx, sy + sr); g.quadraticCurveTo(sx, sy, sx - sr, sy); g.quadraticCurveTo(sx, sy, sx, sy - sr); g.fill();
  /* the name and the promise */
  g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(90,60,150,.45)'; g.shadowBlur = 6;
  g.font = '700 44px Verdana, Tahoma, sans-serif'; g.letterSpacing = '14px'; g.fillText('OPALINE', cx + 7, 322);
  g.font = '400 17px Verdana, Tahoma, sans-serif'; g.letterSpacing = '9px'; g.fillText('SYSTEMS', cx + 4, 350);
  g.letterSpacing = '0px'; g.font = 'italic 400 19px Georgia, serif'; g.fillStyle = '#6a4fa8'; g.shadowBlur = 0; g.fillText('Thank you for choosing tomorrow.', cx, 398);
  for (let i = 0; i < 12; i++){ g.fillStyle = i < 8 ? '#8a6ad6' : 'rgba(138,106,214,.25)'; g.fillRect(cx - 132 + i * 22, 430, 18, 12); }
  g.fillStyle = 'rgba(40,20,60,.08)'; for (let y = 0; y < 500; y += 4) g.fillRect(0, y, 640, 2);                                     /* scanlines */
  const vg = g.createRadialGradient(320, 250, 170, 320, 250, 430); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,10,40,.5)'); g.fillStyle = vg; g.fillRect(0, 0, 640, 500);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
async function crt(p, ry){
  const g = new THREE.Group(), t = await tv(); t.scale.setScalar(1.55); g.add(t);
  /* the glass's front, found from the model, and our picture just in front of it */
  let gz = -1; t.traverse(o => { if (o.isMesh){ const q = o.geometry.attributes.position; for (let i = 0; i < q.count; i++){ const x = q.getX(i), y = q.getY(i); if (Math.abs(x) < .03 && Math.abs(y - .25) < .03) gz = Math.max(gz, q.getZ(i)); } } });
  const geo = new THREE.PlaneGeometry(.302, .236, 24, 24), pp = geo.attributes.position; for (let i = 0; i < pp.count; i++){ const x = pp.getX(i), y = pp.getY(i); pp.setZ(i, -(x * x + y * y) * .35); }
  geo.computeVertexNormals();
  const scr = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color:0x080808, emissive:0xffffff, emissiveMap:screenTex(), emissiveIntensity:dk ? 2.2 : 1.6, roughness:.1, clearcoat:1, clearcoatRoughness:.04 }));
  scr.position.set(0, .2525, gz + .004); t.add(scr);
  g.position.copy(p); g.rotation.y = ry; return g;
}
function pyramidMesh(size, color){
  const geo = new THREE.ConeGeometry(size * .72, size * 1.05, 4, 1); geo.rotateY(Math.PI / 4); geo.translate(0, size * .525, 0);
  const g = new THREE.Group();
  const back = new THREE.Mesh(geo, glossy(color, { transparent:true, opacity:.45, side:THREE.BackSide, depthWrite:false, iridescence:.6, iridescenceIOR:1.3 }));
  const front = new THREE.Mesh(geo, glossy(color, { transparent:true, opacity:.5, side:THREE.FrontSide, depthWrite:false, iridescence:.6, iridescenceIOR:1.3, flatShading:true }));
  back.renderOrder = 1; front.renderOrder = 2; front.castShadow = true; g.add(back, front); return g;
}
const ball = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), mat); m.castShadow = m.receiveShadow = true; return m; };

/* a photograph standing in the scene (a cut-out on a card that faces the camera): it keeps its own light, casts its silhouette's shadow */
async function photoCard(url, hM, p){
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  const map = new THREE.Texture(img); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 16; map.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(hM * img.width / img.height, hM); geo.translate(0, hM / 2, 0);
  const k = dk ? .95 : .86;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent:true, alphaTest:.02, side:THREE.DoubleSide, color:new THREE.Color(k, k, k) }));
  m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking, map, alphaTest:.5 });
  m.position.copy(p); m.rotation.y = Math.atan2(S.cam.position.x - p.x, S.cam.position.z - p.z); return m;
}

/* the photographed head, life's scale times eight: sized so its eyes sit at the camera's height (on the horizon), where the photograph was taken from.
   youth4 is the same head turned a little, about 25 degrees (the museum's view alt4, mirrored so it looks to the right, into the page); youth34, turned
   further (alt2, three-quarters on); youth-g, the head-on photograph. -g: its eyes behind a glitched panel (eyes.py plane) or band */
const HEADS = { youth4:2.27, 'youth4-g':2.27, youth34:2.32, 'youth34-g':2.32, 'youth-g':2.43 }, HEADN = P.head in HEADS ? P.head : 'youth4-g', HEAD = HEADS[HEADN];
/* an unseen body for a photographed head, so it lays a round shadow and a contact shade on the floor, not a cardboard sliver */
function headBulk(card){
  const H = HEAD, inv = new THREE.MeshBasicMaterial({ colorWrite:false, depthWrite:false }), g = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), inv); skull.scale.set(.25 * H, .29 * H, .29 * H); skull.position.y = .63 * H;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.13 * H, .12 * H, .4 * H, 40), inv); neck.position.y = .2 * H;
  for (const o of [skull, neck]){ o.castShadow = true; g.add(o); }
  g.position.copy(card.position); g.rotation.y = card.rotation.y; g.translateZ(-.06 * H); return g;
}

/* ── the scenes: what's far off (plate), and the groups at the sides. One to three things a page ── */
const DEF = {
  tt:{                                           /* a great head resting on the floor, its eyes on the horizon, looking off into the page, against the sun */
    floor:() => glossyChecker('bw'),
    async left(){ const g = new THREE.Group(), p = phone ? at(.24, .74) : at(.17, .76), card = await photoCard('/photo/' + HEADN + '-' + mode + '.png', HEAD, new THREE.Vector3(p.x, 0, p.z));
      g.add(card, headBulk(card)); return { g, p }; },
  },
  cal:{                                          /* a television on the floor, showing light */
    floor:() => glossyChecker('bw'),
    async right(){ const g = new THREE.Group(), p = at(.85, .9), tvg = await crt(p, -.36); tvg.scale.setScalar(2.3); g.add(tvg); return { g, p }; },
  },
  notes:{ floor:() => glossyChecker('bw') },     /* the floor alone (its picture, the paint window, is laid on by the page) */
  home:{                                         /* two columns in still water, and the moon */
    floor:() => { const m = S.glossyFloor({ color:dk ? 0x5b6496 : 0xc9d2f6, roughness:.06, clearcoat:1, clearcoatRoughness:.03 }); m.userData.waterA = dk ? .5 : .42; return m; },
    water:true,
    async left(){ const g = new THREE.Group(), a = at(.12, .93); const c1 = column({ D:.56, H:3.4, mat:marbleM(), ionic:true }); c1.position.copy(a); g.add(c1); return { g, p:a }; },
    async right(){ const g = new THREE.Group(), a = at(.88, .93); const c1 = column({ D:.56, H:2.5, mat:marbleM(), broken:true, seed:5 }); c1.position.copy(a); g.add(c1); return { g, p:a }; },
  },
  stairs:{                                       /* steps in the open sky, up to a lit doorway (the cloud below is the sky's photograph, drawn by the page) */
    clouds:true,
    async right(){ const g = new THREE.Group(), m = marbleM(), p = at(.86, .9);
      const door = new THREE.Group(), dw = 1.1, dh = 1.9, sh = new THREE.Shape(); sh.moveTo(-dw / 2 - .18, 0); sh.lineTo(dw / 2 + .18, 0); sh.lineTo(dw / 2 + .18, dh); sh.absarc(0, dh, dw / 2 + .18, 0, Math.PI, false); sh.lineTo(-dw / 2 - .18, 0);
      const hole = new THREE.Path(); hole.moveTo(-dw / 2, 0); hole.lineTo(dw / 2, 0); hole.lineTo(dw / 2, dh); hole.absarc(0, dh, dw / 2, 0, Math.PI, false); hole.lineTo(-dw / 2, 0); sh.holes.push(hole);
      const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth:.3, bevelEnabled:true, bevelThickness:.02, bevelSize:.02, bevelSegments:3, curveSegments:48 }), m); frame.castShadow = frame.receiveShadow = true; door.add(frame);
      const ls = new THREE.Shape(); ls.moveTo(-dw / 2, 0); ls.lineTo(dw / 2, 0); ls.lineTo(dw / 2, dh); ls.absarc(0, dh, dw / 2, 0, Math.PI, false); ls.lineTo(-dw / 2, 0);
      const lightC = document.createElement('canvas'); lightC.width = 64; lightC.height = 256; const lg = lightC.getContext('2d'), gr = lg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.55, '#fff1dc'); gr.addColorStop(1, '#ffc4de'); lg.fillStyle = gr; lg.fillRect(0, 0, 64, 256);
      const lt = new THREE.CanvasTexture(lightC); lt.colorSpace = THREE.SRGBColorSpace;
      const lgeo = new THREE.ShapeGeometry(ls, 48), uv = lgeo.attributes.uv, pq = lgeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, .5, 1 - pq.getY(i) / (dh + dw / 2));
      const lm = new THREE.Mesh(lgeo, new THREE.MeshBasicMaterial({ map:lt, color:new THREE.Color(dk ? 2.4 : 1.9, dk ? 2.4 : 1.9, dk ? 2.4 : 1.9) })); lm.position.z = .15; door.add(lm);
      const pad = block(dw + 1.1, .16, 1.2, m, .03); pad.position.set(0, -.08, .15); door.add(pad);
      door.position.set(p.x + .4, 2.1, p.z - 2.6); door.rotation.y = -.35; g.add(door);
      /* the flight, set out from the landing in the doorway's own frame, so the landing is its first step: every step (the top one
         too) is one rise below the one before, one run further out and the same way along. (They were placed in the world's frame,
         from a point that was not the landing's: the top step sat half a rise under the landing and off to one side of the line the
         rest came down, which the owner saw at once.) */
      /* ALONG is how far each step stands to one side of the one above. It was -.31: the flight ran off diagonally, under the
         page's window, which hid most of it (the owner: "the staircase could be moved slightly to be less obstructed"). Now 0: a
         straight flight, square to the doorway, coming down towards us inside the margin. */
      const RISE = .3, RUN = .433, ALONG = 0, FRONT = .15 + .6, TH = .18, DEEP = .66;
      for (let i = 1; i <= 10; i++){ const st = block(1.25, TH, DEEP, m, .025); st.position.set(ALONG * i, -RISE * i - TH / 2, FRONT + RUN * i - DEEP / 2); door.add(st); }
      const kl = new THREE.PointLight(dk ? 0xffd9c8 : 0xfff2e8, dk ? 6 : 3, 6, 1.6); kl.position.set(p.x + .3, 2.9, p.z - 2.2); g.add(kl);
      return { g, p }; },
  },
  planets:{                                      /* a ringed planet and its moon */
    floor:() => glossyChecker('teal', { roughness:.32 }),
    floats:{
      async planet(){ const g = new THREE.Group(), p = air(.68, .34, 11.7);
        const bands = document.createElement('canvas'); bands.width = 8; bands.height = 512; const bg = bands.getContext('2d'), gr = bg.createLinearGradient(0, 0, 0, 512);
        [[0, '#fff3e6'], [.2, '#ffd0e2'], [.32, '#ffe6d8'], [.45, '#ffb9d6'], [.55, '#fff1f6'], [.7, '#ffc7de'], [.85, '#ffe2d6'], [1, '#ffd9ea']].forEach(s => gr.addColorStop(s[0], s[1])); bg.fillStyle = gr; bg.fillRect(0, 0, 8, 512);
        const bt = new THREE.CanvasTexture(bands); bt.colorSpace = THREE.SRGBColorSpace;
        const pl = ball(1.25, glossy(0xffffff, { map:bt, roughness:.32, clearcoat:.6, clearcoatRoughness:.2, sheen:.4, sheenColor:new THREE.Color(0xffe0f0) })); pl.position.copy(p); pl.rotation.z = .32; g.add(pl);
        const rc = document.createElement('canvas'); rc.width = 512; rc.height = 8; const rg = rc.getContext('2d'), rr = rg.createLinearGradient(0, 0, 512, 0);
        [[0, 'rgba(160,230,236,0)'], [.05, 'rgba(160,230,236,.95)'], [.3, 'rgba(160,230,236,.9)'], [.34, 'rgba(255,255,255,0)'], [.4, 'rgba(255,255,255,.95)'], [.62, 'rgba(255,255,255,.9)'], [.66, 'rgba(210,192,246,0)'], [.72, 'rgba(210,192,246,.95)'], [.96, 'rgba(210,192,246,.8)'], [1, 'rgba(210,192,246,0)']].forEach(s => rr.addColorStop(s[0], s[1]));
        rg.fillStyle = rr; rg.fillRect(0, 0, 512, 8); const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace;
        const rgeo = new THREE.RingGeometry(1.6, 2.75, 192, 1), ru = rgeo.attributes.uv, rp = rgeo.attributes.position; for (let i = 0; i < ru.count; i++){ const r = Math.hypot(rp.getX(i), rp.getY(i)); ru.setXY(i, (r - 1.6) / 1.15, .5); }
        const ring = new THREE.Mesh(rgeo, glossy(0xffffff, { map:rt, transparent:true, side:THREE.DoubleSide, roughness:.25, iridescence:.5, depthWrite:false })); ring.castShadow = true;
        ring.position.copy(pl.position); ring.rotation.set(-Math.PI / 2 + .62, .1, .32); g.add(ring);
        return { g, p, noFloor:true }; },
      async moon(){ const g = new THREE.Group(), a = air(.16, .24, 12); const m1 = ball(.42, glossy(dk ? 0x6cc2cc : 0x8fe2e6)); m1.position.copy(a); g.add(m1); return { g, p:a, noFloor:true }; } },
  },
  solids:{                                       /* a glossy ball, a glass pyramid */
    floor:() => glossyChecker('bw'),
    async left(){ const g = new THREE.Group(), p = at(.12, .9); const b = ball(.62, glossy(dk ? 0xd85aa8 : 0xff5cc0, { roughness:.1, clearcoat:1, clearcoatRoughness:.03, iridescence:.25 })); b.position.set(p.x, .62, p.z); g.add(b); return { g, p }; },
    async right(){ const g = new THREE.Group(), p = at(.88, .9); const py = pyramidMesh(1.3, dk ? 0xff9fcf : 0xff9cd0); py.position.copy(p); py.rotation.y = .3; g.add(py); return { g, p }; },
  },
};


/* ── render the part asked for ── */
const D = DEF[scene];
let meta = { W, H, hy:SC.hy };
if (part === 'plate' || wide || phone){
  if (!D.clouds) S.setFloor(D.floor());
  if (D.water){ S.floorUni.uStr.value = 1; S.floorUni.uF0.value = .35; S.floorUni.uBlur.value = .002; }
  if (D.bg) S.world.add(await D.bg());
  if (phone){ S.view(); for (const k of ['left', 'right']) if (D[k]){ const o = await D[k](); S.world.add(o.g); }
    for (const k in D.floats || {}){ const o = await D.floats[k](); S.world.add(o.g); } }
  S.st.shadowBox.c.set(0, 0, -10); S.st.shadowBox.r = 22;
  await S.render(+P.n || 96, 11);
  emit(`vw-${scene}-${part}-${mode}`, S.finish(LOOK), meta);
} else {
  const fn = D[part] || (D.floats || {})[part];
  const o = await fn(); S.world.add(o.g);
  const isFloat = !D[part];
  if (D.water){ S.floorUni.uStr.value = 1; S.floorUni.uF0.value = .35; S.floorUni.uBlur.value = .002; }
  if (!isFloat && !o.noFloor && !D.clouds) S.setFloor(S.catcherFloor());          /* a floating thing goes alone, with no floor at all */
  const bb = new THREE.Box3().setFromObject(o.g), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  S.st.shadowBox.c.set(c.x, 0, c.z); S.st.shadowBox.r = Math.max(sz.x, sz.z, sz.y) * 1.3 + 1;
  await S.render(+P.n || 128, 13);
  const full = S.finish(LOOK), cut = crop(full, 8), a = S.toScreen(isFloat ? o.p.clone() : new THREE.Vector3(o.p.x, 0, o.p.z));
  meta = Object.assign(meta, { x:cut.x, y:cut.y, w:cut.cv.width, h:cut.cv.height, ax:Math.round(a[0]), ay:Math.round(a[1]) });
  emit(`vw-${scene}-${part}-${mode}`, cut.cv, meta);
}
done();
