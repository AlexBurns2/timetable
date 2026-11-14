/* ═══════════════════════════════════════════════════════════════════
   Maximalism's backgrounds (fx.js loads this for that theme only).

   One fragment shader per page, all cut from the same cloth: the same
   eight colours on cream or ink, the same heavy type, and the same fine
   weave over everything, as if every page were printed on one fabric.

     home       fabric   rows of enormous type on rippling cloth; the rows
                         run in alternate directions, and the pointer
                         presses the cloth down
     timetable  grid     a grid pulled out of true by slow lenses
     calendar   radial   rings of type, rays and segments turning about a sun
     finder     radial   the same, centred, like a target
     free       fluid    slow cut-out shapes, some of them spotted
     games      collage  a wall of tiles that keep flipping to new patterns
     mahjong    collage  the same, slower
     revision   waves    stripes with a swell running through them
     resources  waves    upright, like spines on a shelf
     notes      fabric   plain striped cloth, no type

   The type is drawn once on a 2D canvas (the theme's own face, once it
   has loaded) and used as a texture.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;

const HEAD = `
#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uT; uniform vec3 uM; uniform float uDark; uniform float uVar; uniform float uAsp; uniform sampler2D uTex;
const float PI = 3.14159265;
const vec3 INK = vec3(.078,.071,.102), CREAM = vec3(.984,.957,.894);
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
float hash1(float n){ return fract(sin(n*127.1 + 3.3)*43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a*vnoise(p); p = p*2.03 + vec2(17., 9.); a *= .5; } return s; }
vec3 pal(float i){ i = mod(floor(i), 8.);
  if (i < 1.) return vec3(.961,.255,.620);
  if (i < 2.) return vec3(.965,.741,.118);
  if (i < 3.) return vec3(.169,.435,.816);
  if (i < 4.) return vec3(.078,.647,.580);
  if (i < 5.) return vec3(.886,.220,.176);
  if (i < 6.) return vec3(.663,.522,.839);
  if (i < 7.) return vec3(.184,.541,.271);
  return vec3(.953,.655,.467); }
vec3 ground(){ return mix(CREAM, INK, uDark); }
vec3 mark(){ return mix(INK, CREAM, uDark); }
vec2 P(){ return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y)/uRes.y; }
/* the cloth everything is printed on: fine threads, three pixels apart, each a little its own shade */
vec3 cloth(vec3 col, vec2 c, float amt){
  vec2 w = c*uRes.y/3.;
  float a = abs(sin(w.x*PI)), b = abs(sin(w.y*PI));
  float over = step(0., sin(w.x*PI*.5)*sin(w.y*PI*.5));
  col *= 1. - amt*.11*(1. - mix(a, b, over));
  col += (hash(floor(w)) - .5)*.04*amt;
  return col; }
`;

const SC = {};

SC.fabric = `
float fold(vec2 p, out vec2 g){
  float h = 0.; g = vec2(0.);
  vec2 d1 = vec2(.898,.44); float w1 = 1.2*sin(p.y*1.3 + uT*.07), a1 = dot(p, d1)*3.1 + uT*.21 + w1;
  h += .55*sin(a1); g += .55*cos(a1)*(d1*3.1 + vec2(0., 1.56*cos(p.y*1.3 + uT*.07)));
  vec2 d2 = vec2(-.349,.937); float a2 = dot(p, d2)*4.7 - uT*.16 + 2.;
  h += .3*sin(a2); g += .3*cos(a2)*d2*4.7;
  vec2 d3 = vec2(.702,-.712); float a3 = dot(p, d3)*7.9 + uT*.27;
  h += .12*sin(a3); g += .12*cos(a3)*d3*7.9;
  vec2 q = p - uM.xy; float k = uM.z*exp(-dot(q, q)/.03);      /* the pointer presses the cloth down */
  h -= 1.1*k; g += 1.1*k*2.*q/.03;
  return h; }
void main(){
  vec2 p = P(), g; float h = fold(p, g);
  vec2 c = p + g*.024 + vec2(0., h*.05);                      /* where on the cloth this pixel looks: its slopes pull the print with them */
  float rows = mix(5.2, 11., uVar);
  float ry = c.y*rows + .3, row = floor(ry), v = fract(ry);
  float dir = mod(row, 2.) < 1. ? 1. : -1.;
  float u = c.x*rows/uAsp + dir*uT*(.011 + .013*hash1(row + 3.)) + hash1(row)*.71;
  float ink = smoothstep(.4, .6, texture2D(uTex, vec2(u, v)).r)*(1. - uVar);
  float s = mod(row, 6.);
  vec3 gr = ground(), mk = mark();
  if (s < 1.) {} else if (s < 2.){ gr = mark(); mk = ground(); } else if (s < 3.){ mk = pal(0.); }
  else if (s < 4.){ gr = pal(2.); mk = CREAM; } else if (s < 5.) {} else { gr = pal(1.); mk = INK; }
  vec3 col = mix(gr, mk, ink);
  col *= .86 + .14*smoothstep(0., .02, v)*smoothstep(0., .02, 1. - v);     /* a seam between the rows */
  vec3 n = normalize(vec3(-g*.2, 1.)), L = normalize(vec3(-.5, -.55, .68));
  float dif = dot(n, L);
  col *= .36 + .9*dif;                                         /* folds catch the light on one side and fall into shadow on the other */
  col += pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 22.)*.2;
  col = cloth(col, c, mix(1., .4, ink));                       /* the print lies flat on the threads */
  gl_FragColor = vec4(col, 1.);
}`;

SC.grid = `
vec2 warp(vec2 p){
  float asp = uRes.x/uRes.y; vec2 q = p;
  for (int i = 0; i < 3; i++){ float fi = float(i);
    vec2 c = vec2(asp*(.5 + .42*sin(uT*.05*(1. + fi*.3) + fi*2.1)), .5 + .38*cos(uT*.043*(1. + fi*.2) + fi*1.7));
    vec2 d = q - c; q = c + d*(1. + (mod(fi, 2.) < 1. ? .5 : -.34)*exp(-dot(d, d)/(.1 + .04*fi))); }
  vec2 d = q - uM.xy; q = uM.xy + d*(1. - .42*uM.z*exp(-dot(d, d)/.035));
  return q; }
void main(){
  vec2 p = P(), q = warp(p)*7.5, id = floor(q), f = fract(q), fw = fwidth(q) + 1e-4;
  vec3 gr = ground(), mk = mark(), col = gr;
  col = mix(col, mix(gr, mk, .07), mod(id.x + id.y, 2.));
  float k = hash(id + floor(uT*.04 + hash(id + 11.)*7.)*3.7);  /* now and then a square changes what it holds */
  if (k < .1) col = pal(k*73.);
  else if (k < .16) col = mix(pal(k*91.), col, smoothstep(.36 - fw.x, .36 + fw.x, length(f - .5)));
  else if (k < .2) col = mix(pal(k*57.), col, smoothstep(.92 - fw.x, .92 + fw.x, length(f)));
  else if (k < .235) col = mix(col, mk, step(.5, fract((f.x + f.y)*3.)));
  vec2 dl = min(f, 1. - f)/fw;
  col = mix(col, mk, 1. - smoothstep(.7, 1.7, min(dl.x, dl.y)));
  col = cloth(col, p, .55);
  gl_FragColor = vec4(col, 1.);
}`;

SC.radial = `
void main(){
  vec2 p = P(); float asp = uRes.x/uRes.y;
  vec2 cen = mix(vec2(asp*.84, .16), vec2(asp*.5, .46), uVar);
  cen += (uM.xy - cen)*.05*uM.z;
  vec2 d = p - cen; float r = length(d), th = atan(d.y, d.x), W = .082;
  float rr = r/W, k = floor(rr), v = fract(rr), fw = fwidth(rr) + 1e-4;
  float dir = mod(k, 2.) < 1. ? 1. : -1.;
  float a = th + uT*dir*(.02 + .05*hash1(k + 5.))/(.5 + k*.22);
  float kind = floor(hash1(k*1.7 + 2.)*5.), rm = (k + .5)*W, tau = 6.2831853;
  vec3 gr = ground(), mk = mark(), col = gr;
  if (k < 1.) col = pal(1.);
  else if (kind < 1. || k == 3.){
    float n = max(1., floor(tau*rm/(W*uAsp) + .5));
    float ink = smoothstep(.4, .6, texture2D(uTex, vec2(a/tau*n, 1. - v)).r);
    col = mod(k, 4.) < 2. ? mix(gr, mk, ink) : mix(mk, gr, ink);
  } else if (kind < 2.){
    float n = 6. + floor(hash1(k)*5.)*2.;
    col = mix(pal(k), pal(k + 3.), step(.5, fract(a/tau*n)));
  } else if (kind < 3.){
    float n = floor(tau*rm/W);
    vec2 cell = vec2(fract(a/tau*n) - .5, v - .5);
    col = mix(pal(k + 1.), gr, smoothstep(.25, .3, length(cell)));
  } else if (kind < 4.){
    float n = 24. + floor(hash1(k + 9.)*4.)*12.;
    col = mix(gr, mk, step(.5, fract(a/tau*n)));
  } else col = pal(k + 2.);
  col = mix(col, mk, 1. - smoothstep(.6, 1.6, min(v, 1. - v)/fw));     /* each ring has an edge */
  col = cloth(col, p, .55);
  gl_FragColor = vec4(col, 1.);
}`;

SC.fluid = `
vec3 lev(float i){ i = mod(i, 9.);
  if (i < 1.) return ground(); if (i < 2.) return pal(0.); if (i < 3.) return pal(6.); if (i < 4.) return ground();
  if (i < 5.) return pal(1.); if (i < 6.) return pal(5.); if (i < 7.) return pal(4.); if (i < 8.) return ground(); return pal(2.); }
void main(){
  vec2 p = P(), m = p - uM.xy; float push = uM.z*exp(-dot(m, m)/.05);
  vec2 q = p*1.1 + .95*vec2(fbm(p*1.25 + vec2(0., uT*.021)), fbm(p*1.25 + vec2(5.2, -uT*.017))) + m*push*.5;
  float b = (fbm(q*1.35 + 3.) - .18)*15., i = floor(b), f = fract(b), fw = fwidth(b) + 1e-4;
  vec3 col = mix(lev(i), lev(i + 1.), smoothstep(1. - fw, 1., f));
  float spotted = mod(i, 3.);                                  /* every third shape is spotted, as cut paper is sometimes painted */
  if (spotted < 1.){ vec2 dq = fract(q*13.) - .5; float fd = fwidth(q.x*13.) + 1e-4;
    col = mix(mod(i, 2.) < 1. ? pal(4.) : pal(6.), col, smoothstep(.2 - fd, .2 + fd, length(dq))); }
  col = cloth(col, p, .55);
  gl_FragColor = vec4(col, 1.);
}`;

SC.collage = `
float pat(float kind, vec2 f, float s){
  if (kind < 1.) return mod(floor(f.x*4.) + floor(f.y*4.), 2.);
  if (kind < 2.) return step(.5, fract((f.x + f.y)*4.));
  if (kind < 3.){ vec2 c = vec2(step(.5, s), step(.5, fract(s*7.))); return step(length(f - c), 1.); }
  if (kind < 4.) return step(length(fract(f*3.) - .5), .28);
  if (kind < 5.) return 0.;
  if (kind < 6.) return step(.5, fract(max(abs(f.x - .5), abs(f.y - .5))*6.));
  if (kind < 7.) return s < .5 ? step(f.x, f.y) : step(1. - f.x, f.y);
  if (kind < 8.) return step(.5, hash(floor(f*5.) + s*31.));
  if (kind < 9.) return step(.5, fract(atan(f.y - .5, f.x - .5)/6.2831853*12.))*step(length(f - .5), .48);
  if (kind < 10.) return step(abs(length(f - .5) - .3), .1);
  return step(.5, fract(f.y*5.)); }
vec3 pick(float h){ float i = floor(h*11.); if (i < 1.) return INK; if (i < 2.) return CREAM; if (i < 3.) return mark(); return pal(i); }
void main(){
  vec2 p = P(), q = p*6.5 + vec2(.3, .2);
  vec2 id = floor(q), f = fract(q);
  vec2 big = floor(q/2.);
  if (hash(big + 3.) < .2){ id = big + 100.; f = fract(q/2.); }   /* some tiles are four times the size */
  float h = hash(id), per = mix(5., 13., hash(id + 7.))*mix(1., 3., uVar);
  float tt = uT/per + h*9., e = floor(tt), pr = fract(tt), w = .35/per;   /* each tile turns over to a new pattern, in its own time */
  vec2 m = (id + .5) - uM.xy*6.5 - vec2(.3, .2);
  if (id.x < 99. && uM.z > .5 && dot(m, m) < 1.2) e += 1.;      /* and the ones under the pointer turn at once */
  float sq = 1.;
  if (pr < w){ float s = pr/w; sq = abs(cos(PI*s)); if (s < .5) e -= 1.; }
  float x = .5 + (f.x - .5)/max(sq, .001);
  vec3 col = ground();
  if (x > 0. && x < 1.){
    vec2 ff = vec2(x, f.y); float s1 = hash(id + e*1.7), s2 = hash(id + e*2.9 + 5.), kind = floor(hash(id + e*4.3 + 1.)*11.);
    vec3 a = pick(s1), b = pick(fract(s2 + .37));
    col = mix(a, b, pat(kind, ff, s2));
  }
  vec2 fw = fwidth(q) + 1e-4, dl = min(f, 1. - f)*(id.x > 99. ? 2. : 1.)/fw;
  col = mix(col, mark(), 1. - smoothstep(.8, 1.8, min(dl.x, dl.y)));
  col = cloth(col, p, .55);
  gl_FragColor = vec4(col, 1.);
}`;

SC.waves = `
void main(){
  vec2 p = P(); float asp = uRes.x/uRes.y; vec2 m = p - uM.xy; float bump = uM.z*exp(-dot(m, m)/.04);
  vec3 gr = ground(), mk = mark(), col;
  if (uVar < .5){
    float y = p.y*15. + 1.5*sin(p.x*2.1 + uT*.11)*sin(p.x*.75 - uT*.05 + 1.) + .7*sin(p.x*5.2 - uT*.17) + 2.2*bump;
    float k = floor(y), f = fract(y), fw = fwidth(y) + 1e-4;
    vec3 a = mod(k, 2.) < 1. ? gr : mk, b = mod(k + 1., 2.) < 1. ? gr : mk;
    if (mod(k, 6.) < 1.) a = pal(k/6.); if (mod(k + 1., 6.) < 1.) b = pal((k + 1.)/6.);
    col = mix(a, b, smoothstep(1. - fw, 1., f));
  } else {
    float x = p.x*13. + .4*sin(p.x*3. + 1.), k = floor(x), f = fract(x), fw = fwidth(x) + 1e-4, h = hash1(k);
    float y = p.y + .04*sin(uT*.13 + k*1.9) + .08*h + .25*bump;
    col = h < .16 ? gr : (h < .3 ? mk : pal(h*40.));
    float lab = step(abs(fract(y*1.4 + h) - .5), .06 + .05*hash1(k + 4.));          /* a label round each spine */
    col = mix(col, h < .16 ? pal(k) : gr, lab*step(.12, f)*step(f, .88));
    col = mix(col, mk, step(abs(fract(y*1.4 + h + .22) - .5), .008)*step(.12, f)*step(f, .88));
    col = mix(col, mk, 1. - smoothstep(.8, 1.8, min(f, 1. - f)/fw));
  }
  col = cloth(col, p, .55);
  gl_FragColor = vec4(col, 1.);
}`;

const PAGE = { home:['fabric', 0], timetable:['grid', 0], calendar:['radial', 0], finder:['radial', 1], free:['fluid', 0],
               games:['collage', 0], mahjong:['collage', 1], revision:['waves', 0], resources:['waves', 1], notes:['fabric', 1] };

/* the row of type, as a texture: white letters on black, one period, repeating sideways */
function typeTexture(gl, tex, word){
  const c = document.createElement('canvas'); c.width = 4096; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
  x.font = '900 560px Archivo, "Arial Black", Impact, sans-serif';
  try { x.fontStretch = 'expanded'; } catch {}
  const txt = word + ' +++ ', m = x.measureText(txt);
  x.save(); x.scale(c.width/m.width, 1); x.fillText(txt, 0, 448); x.restore();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return m.width/c.height;
}

FX.scenes.maximal = {
  dpr:1.25, maxPx:1.9e6,
  create(canvas, env){
    const pick = PAGE[env.page] || ['fabric', 1];
    const g = FX.gl(canvas, HEAD + SC[pick[0]], gl => gl.getExtension('OES_standard_derivatives'));
    if (!g) return null;
    const gl = g.gl, tex = gl.createTexture();
    let asp = 8, e = env, mx = innerWidth/2, my = innerHeight/2, mz = 0, alive = true;
    const usesType = pick[0] === 'fabric' || pick[0] === 'radial';
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    if (usesType){
      const draw = () => { if (!alive) return; asp = typeTexture(gl, tex, 'MSCUNOFFICIAL'); FX.refresh(); };
      if (document.fonts && document.fonts.load) document.fonts.load('900 64px Archivo').then(draw, draw); else draw();
      setTimeout(draw, 2500);                              // the face may land late on a first visit
    }
    return {
      frame(t, dt, ptr){
        const k = dt ? Math.min(1, dt*5) : 1;
        if (ptr.on){ mx += (ptr.px - mx)*k; my += (ptr.py - my)*k; }
        mz += ((ptr.on && e.animate ? 1 : 0) - mz)*(dt ? Math.min(1, dt*3) : 1);
        const H = canvas.clientHeight || innerHeight;
        gl.uniform2f(g.u('uRes'), canvas.width, canvas.height);
        gl.uniform1f(g.u('uT'), t);
        gl.uniform3f(g.u('uM'), mx/H, my/H, mz);
        gl.uniform1f(g.u('uDark'), e.dark ? 1 : 0);
        gl.uniform1f(g.u('uVar'), pick[1]);
        gl.uniform1f(g.u('uAsp'), asp);
        gl.uniform1i(g.u('uTex'), 0);
        g.draw();
      },
      env(n){ e = n; },
      dispose(){ alive = false; g.lose(); }
    };
  }
};
})();
