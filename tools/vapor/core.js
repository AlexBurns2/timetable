/* Offline renderer for the Vaporwave scenes (scratchpad only; its output is webp images).
   Progressive: every frame jitters the camera (anti-aliasing), the key light within a small cone (soft shadows)
   and a sky light over the hemisphere (ambient occlusion); frames are averaged in float.
   A glossy floor reflects the world through a mirrored pass, blurred by jitter. A "catcher" floor instead keeps
   only the shadows and reflections, so a group can be exported on its own and laid over a plate in 2D. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
export { THREE };
export const P = Object.fromEntries(new URLSearchParams(location.search));
export const rnd = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const TAU = Math.PI * 2;
const gltf = new GLTFLoader(), tl = new THREE.TextureLoader();
export const loadGLTF = u => gltf.loadAsync(u);
export const pending = [];
export const tex = (u, srgb, rep) => { let ok; pending.push(new Promise(r => ok = r)); const t = tl.load(u, ok, undefined, ok); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep, rep); t.anisotropy = 16; return t; };
export const lin = hex => new THREE.Color(hex);           // THREE.Color takes sRGB hex and stores linear

/* ── the renderer and its targets ── */
export function makeStage({ w, h, hy = .6, fov = 30, camH = 1.4, alpha = true }){
  const R = new THREE.WebGLRenderer({ antialias:false, alpha:true, preserveDrawingBuffer:true, powerPreference:'high-performance' });
  R.setPixelRatio(1); R.setSize(w, h, false); R.autoClear = false;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.NoToneMapping; R.outputColorSpace = THREE.LinearSRGBColorSpace;
  document.body.appendChild(R.domElement); R.domElement.style.width = '400px';
  const rt = (ww, hh, type, mips) => new THREE.WebGLRenderTarget(ww, hh, { type, format:THREE.RGBAFormat, depthBuffer:true, generateMipmaps:!!mips, minFilter:mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter:THREE.LinearFilter });
  const rtFrame = rt(w, h, THREE.HalfFloatType), rtMirror = rt(w >> 1, h >> 1, THREE.HalfFloatType), rtAcc = rt(w, h, THREE.FloatType), rtOut = rt(w, h, THREE.UnsignedByteType);
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  /* a camera that stays level (columns stay upright) with its lens shifted so the horizon sits at hy of the height */
  const cam = new THREE.PerspectiveCamera(2 * Math.atan(2 * Math.tan(fov / 2 * Math.PI / 180)) * 180 / Math.PI, w / (2 * h), .05, 600);
  cam.position.set(0, camH, 0); cam.lookAt(0, camH, -1);
  const view = (jx, jy) => { cam.setViewOffset(w, 2 * h, jx || 0, (1 - hy) * h + (jy || 0), w, h); cam.updateProjectionMatrix(); };
  view();
  /* a point on the floor under the screen point (sx, sy), both 0..1 of the picture */
  const floorAt = (sx, sy) => { const v = new THREE.Vector3(sx * 2 - 1, -(sy * 2 - 1), .5).unproject(cam), d = v.sub(cam.position).normalize(); const t = -cam.position.y / d.y; return cam.position.clone().add(d.multiplyScalar(t)); };
  /* a point on the ray through the screen point (sx, sy), d metres in front of the camera */
  const rayAt = (sx, sy, d) => { const v = new THREE.Vector3(sx * 2 - 1, -(sy * 2 - 1), .5).unproject(cam), dir = v.sub(cam.position).normalize(); return cam.position.clone().add(dir.multiplyScalar(d / -dir.z)); };
  const toScreen = p => { const v = p.clone().project(cam); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; };
  /* full-screen passes */
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quadScene.add(quad);
  const accMat = new THREE.ShaderMaterial({ uniforms:{ t:{ value:null }, k:{ value:1 } }, depthTest:false, depthWrite:false, blending:THREE.CustomBlending, blendSrc:THREE.OneFactor, blendDst:THREE.OneFactor, blendSrcAlpha:THREE.OneFactor, blendDstAlpha:THREE.OneFactor,
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader:'uniform sampler2D t; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv) * k; }' });
  const outMat = new THREE.ShaderMaterial({ uniforms:{ t:{ value:rtAcc.texture }, toneMappingExposure:{ value:1 }, grain:{ value:1.2 }, sat:{ value:1 }, tm:{ value:0 }, lift:{ value:new THREE.Vector3() } }, depthTest:false, depthWrite:false, blending:THREE.NoBlending,
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader:THREE.ShaderChunk.tonemapping_pars_fragment + `
      uniform sampler2D t; uniform float grain, sat; uniform int tm; uniform vec3 lift; varying vec2 vUv;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec4 c = texture2D(t, vUv); float a = clamp(c.a, 0., 1.); vec3 rgb = a > 1e-5 ? c.rgb / a : vec3(0.);
        rgb = tm == 0 ? AgXToneMapping(rgb) : tm == 1 ? NeutralToneMapping(rgb) : ACESFilmicToneMapping(rgb);
        float l = dot(rgb, vec3(.2126, .7152, .0722)); rgb = mix(vec3(l), rgb, sat) + lift;
        rgb = sRGBTransferOETF(vec4(clamp(rgb, 0., 1.), 1.)).rgb;
        rgb += (h21(gl_FragCoord.xy) - .5) * grain / 255.;
        gl_FragColor = vec4(clamp(rgb, 0., 1.), a);
      }` });
  const pass = (mat, target, clear) => { quad.material = mat; R.setRenderTarget(target); if (clear){ R.setClearColor(0, 0); R.clear(); } R.render(quadScene, quadCam); };

  /* the lights: a key (the sun, or at dusk the low light at the horizon) and a sky light that wanders over the hemisphere */
  const key = new THREE.DirectionalLight(0xffffff, 3), sky = new THREE.DirectionalLight(0xffffff, 1);
  for (const L of [key, sky]){ L.castShadow = true; L.shadow.bias = -.0004; L.shadow.normalBias = .02; world.add(L); world.add(L.target); }
  key.shadow.mapSize.set(4096, 4096); sky.shadow.mapSize.set(2048, 2048);
  const st = { keyDir:new THREE.Vector3(-1, 1, .3).normalize(), keySoft:.05, skyI:1, shadowBox:{ c:new THREE.Vector3(), r:4 } };
  const aimShadow = (L, dir, box) => { L.target.position.copy(box.c); L.position.copy(box.c).addScaledVector(dir, 30); const s = L.shadow.camera; s.left = s.bottom = -box.r; s.right = s.top = box.r; s.near = 1; s.far = 80; s.updateProjectionMatrix(); };
  const onSphere = (r, cone) => { const u = r(), v = r(), z = 1 - u * (1 - Math.cos(cone)), s = Math.sqrt(1 - z * z), a = v * TAU; return new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z); };
  const jitterDir = (dir, cone, r) => { const l = onSphere(r, cone), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); return l.applyQuaternion(q).normalize(); };

  /* the floor: glossy (it reflects the mirrored pass) or a catcher (only shadows and reflections, for a group on its own) */
  const floorUni = { tMirror:{ value:rtMirror.texture }, uRes:{ value:new THREE.Vector2(w, h) }, uJit:{ value:new THREE.Vector2() }, uBlur:{ value:.012 }, uF0:{ value:.06 }, uStr:{ value:.9 }, uFade:{ value:new THREE.Vector2(20, 60) }, uKmin:{ value:.5 } };
  function glossyFloor(opts){
    const m = new THREE.MeshPhysicalMaterial(Object.assign({ roughness:.28, clearcoat:.5, clearcoatRoughness:.15, transparent:true, depthWrite:true }, opts));
    m.onBeforeCompile = s => { Object.assign(s.uniforms, floorUni); s.uniforms.uWaterA = { value:m.userData.waterA || 1 };
      s.fragmentShader = 'uniform sampler2D tMirror; uniform vec2 uRes, uJit, uFade; uniform float uBlur, uF0, uStr, uWaterA;\n' + s.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        { vec4 rf = texture2D(tMirror, gl_FragCoord.xy / uRes + uJit * uBlur);
          float ndv = clamp(dot(normalize(vViewPosition), normal), 0., 1.), F = (uF0 + (1. - uF0) * pow(1. - ndv, 5.)) * uStr;
          gl_FragColor.rgb = gl_FragColor.rgb * (1. - F * rf.a) + rf.rgb * F;
          gl_FragColor.a *= (1. - smoothstep(uFade.x, uFade.y, length(vViewPosition))) * uWaterA; }`); };
    m.customProgramCacheKey = () => 'floor' + (m.userData.waterA || 1);
    return m; }
  function catcherFloor(){
    const m = new THREE.ShadowMaterial({ transparent:true, depthWrite:true });
    m.onBeforeCompile = s => { Object.assign(s.uniforms, floorUni);
      s.vertexShader = 'varying vec3 vWP;\n' + s.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n vWP = (modelMatrix * vec4(position, 1.)).xyz;');
      s.fragmentShader = 'uniform sampler2D tMirror; uniform vec2 uRes, uJit, uFade; uniform float uBlur, uF0, uStr, uKmin; varying vec3 vWP;\n' + s.fragmentShader.replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );', `
        vec3 V = cameraPosition - vWP; float ndv = clamp(normalize(V).y, 0., 1.), F = (uF0 + (1. - uF0) * pow(1. - ndv, 5.)) * uStr;
        vec4 rf = texture2D(tMirror, gl_FragCoord.xy / uRes + uJit * uBlur); float a = F * rf.a;
        float k = mix(uKmin, 1., getShadowMask());
        float Sa = 1. - k * (1. - a); vec3 Sc = rf.rgb * F;
        float fade = 1. - smoothstep(uFade.x, uFade.y, length(V));
        gl_FragColor = vec4(Sa > 1e-4 ? Sc / Sa : vec3(0.), Sa * fade);`); };
    return m; }
  const floorGeo = new THREE.PlaneGeometry(600, 600); floorGeo.rotateX(-Math.PI / 2);
  let floor = null;
  const setFloor = mat => { if (floor) scene.remove(floor); floor = new THREE.Mesh(floorGeo, mat); floor.receiveShadow = true; floor.renderOrder = -1; scene.add(floor); return floor; };

  /* the environment: an HDR, tinted toward a palette by height */
  const pmrem = new THREE.PMREMGenerator(R);
  async function env(url, tint, clampTo = 3){
    const t = await new RGBELoader().setDataType(THREE.FloatType).loadAsync(url);
    if (tint){ const d = t.image.data, W = t.image.width, H = t.image.height;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
      clampTo = clampTo * sum / (d.length / 4);                       /* relative to the sky's average: the sun's spot goes, its light stays in the key */
      for (let y = 0; y < H; y++){ const el = .5 - y / H; const c = tint(el);         // el: +.5 zenith .. 0 horizon .. -.5 nadir
        for (let x = 0; x < W; x++){ const i = (y * W + x) * 4, L = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
          d[i] = d[i] * (1 - c[3]) + L * c[0] * c[3]; d[i + 1] = d[i + 1] * (1 - c[3]) + L * c[1] * c[3]; d[i + 2] = d[i + 2] * (1 - c[3]) + L * c[2] * c[3];
          const mx = Math.max(d[i], d[i + 1], d[i + 2]); if (mx > clampTo){ const k = clampTo / mx; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } } }
      t.needsUpdate = true; }
    t.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose();
  }

  /* render N frames and average them */
  async function render(N, seed){
    const r = rnd(seed || 7);
    await Promise.all(pending);
    R.setRenderTarget(rtAcc); R.setClearColor(0, 0); R.clear(); accMat.uniforms.k.value = 1 / N; accMat.uniforms.t.value = rtFrame.texture;
    for (let i = 0; i < N; i++){
      view(r() - .5, r() - .5);
      const kd = jitterDir(st.keyDir, st.keySoft, r); aimShadow(key, kd, st.shadowBox);
      let sd = onSphere(r, Math.PI / 2); sd = new THREE.Vector3(sd.x, Math.abs(sd.z) * .9 + .1, Math.abs(sd.y) * .8 + .1).normalize();   /* the sky: anywhere above on the camera's side (in front, it would glint on the floor) */
      aimShadow(sky, sd, st.shadowBox);
      floorUni.uJit.value.set(r() * 2 - 1, r() * 2 - 1).multiplyScalar(Math.sqrt(r()));
      /* the mirrored world, for the floor's reflection */
      if (floor) floor.visible = false; world.scale.y = -1; world.updateMatrixWorld(true);
      R.setRenderTarget(rtMirror); R.setClearColor(0, 0); R.clear(); R.render(scene, cam);
      world.scale.y = 1; world.updateMatrixWorld(true); if (floor) floor.visible = true;
      R.setRenderTarget(rtFrame); R.setClearColor(0, 0); R.clear(); R.render(scene, cam);
      pass(accMat, rtAcc, false);
      if (i % 8 === 7) await new Promise(res => setTimeout(res, 0));
    }
    view();
  }
  /* tone map into 8 bits and hand back a canvas (straight alpha) */
  function finish({ exposure = 1, tm = 0, grain = 1.2, sat = 1, lift = [0, 0, 0] } = {}){
    Object.assign(outMat.uniforms.toneMappingExposure, { value:exposure }); outMat.uniforms.tm.value = tm; outMat.uniforms.grain.value = grain; outMat.uniforms.sat.value = sat; outMat.uniforms.lift.value.set(...lift);
    pass(outMat, rtOut, true);
    const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rtOut, 0, 0, w, h, px);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return cv;
  }
  return { R, scene, world, cam, w, h, st, key, sky, floorAt, rayAt, toScreen, view, glossyFloor, catcherFloor, setFloor, floorUni, env, render, finish };
}

/* crop a canvas to what isn't transparent (plus a margin); returns the piece and where it was */
export function crop(cv, pad = 6){
  const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 3){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { cv, x:0, y:0 };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.width - 1, x1 + pad); y1 = Math.min(cv.height - 1, y1 + pad);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(cv, -x0, -y0); return { cv:o, x:x0, y:y0 };
}
export function emit(name, cv, meta){ (window.__out = window.__out || []).push({ name, url:cv.toDataURL('image/png'), meta }); }
export function done(){ window.__done = true; }
