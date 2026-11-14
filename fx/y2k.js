/* ═══════════════════════════════════════════════════════════════════
   Y2K Futurism's background (fx.js loads this for that theme only).

   Kept quiet on purpose: the look is white, silver and icy blue with a
   lot of air in it. One fragment shader draws a soft glow of light, a
   faint wire floor low on the screen, three thin rings and a crosshair
   (the "technical drawing" lines of the time), and a little chrome: one
   body of liquid metal resting in the bottom corner, a smaller one in
   the top corner, and two small spheres that barely move. The chrome
   reflects a plain white-and-blue room; there is no rainbow film on it.
   Nothing follows the pointer. Cheap enough for a school laptop.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const FX = window.FX; if (!FX) return;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uT; uniform float uDark;
/* the room the chrome reflects: white light, icy blue above, a dark line at the horizon, a pale floor */
vec3 room(vec3 n){
  vec3 r = reflect(vec3(0., 0., -1.), n);
  float y = r.y;
  vec3 up = mix(vec3(1.), vec3(.60, .76, .94), smoothstep(0., .9, y));
  vec3 dn = mix(vec3(.17, .21, .28), vec3(.82, .87, .93), smoothstep(0., -.9, y));
  if (uDark > .5){ up = mix(vec3(.78, .87, .96), vec3(.10, .16, .26), smoothstep(0., .9, y)); dn = mix(vec3(.012, .014, .02), vec3(.20, .24, .31), smoothstep(0., -.95, y)); }
  vec3 c = mix(dn, up, smoothstep(-.03, .03, y));
  c += pow(max(dot(r, normalize(vec3(.5, .62, .6))), 0.), 60.)*1.1;
  c = mix(c, c*vec3(.88, .95, 1.07), .5*(1. - max(n.z, 0.)));          /* a cool edge, nothing more */
  c = mix(c, mix(vec3(.93, .95, .97), vec3(.30, .35, .42), uDark), smoothstep(.72, 1., n.z)*.8);     /* facing us, it mirrors the bright room behind us */
  return c; }
void blob(vec2 p, vec2 c, float r, inout float F, inout vec2 G){ vec2 d = p - c; float q = dot(d, d) + 1e-5, v = r*r/q; F += v; G += -2.*v*d/q; }
float ring(vec2 p, vec2 c, float r, float px){ return 1. - smoothstep(0., px*1.2, abs(length(p - c) - r)); }
void main(){
  float asp = uRes.x/uRes.y, px = 1.5/uRes.y, t = uT*.5;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y)/uRes.y;
  /* the air: white to ice, with a glow of light up on the left */
  vec3 col = mix(mix(vec3(1.), vec3(.86, .915, .96), smoothstep(-.1, 1.1, p.y)), mix(vec3(.03, .04, .055), vec3(.012, .016, .024), smoothstep(-.1, 1.1, p.y)), uDark);
  float glow = exp(-dot(p - vec2(asp*.28, .2), p - vec2(asp*.28, .2))/.22);
  col += mix(vec3(-.06, -.015, .03), vec3(.03, .07, .13), uDark)*glow;
  vec3 ink = mix(vec3(.45, .55, .68), vec3(.75, .85, .96), uDark);
  /* a wire floor, low down */
  vec2 uv = vec2(p.x - .5*asp, .5 - p.y);
  vec3 rd = normalize(vec3(uv.x, uv.y + .2, 1.15));
  if (rd.y < -.012){
    float tp = -.5/rd.y; vec2 g = rd.xz*tp*1.7 + vec2(0., t*.2);
    vec2 fw = fwidth(g) + 1e-4, gl = abs(fract(g) - .5)/fw;
    col = mix(col, ink, (1. - smoothstep(0., 1.3, min(gl.x, gl.y)))*exp(-tp*.16)*mix(.32, .22, uDark));
  }
  /* rings and a crosshair about the corner the metal sits in */
  vec2 C = vec2(asp*.87, .8);
  float ln = max(max(ring(p, C, .3, px), ring(p, C, .44, px)*.7), ring(p, C, .66, px)*.45);
  ln = max(ln, (1. - smoothstep(0., px*1.2, abs(p.y - C.y)))*.3*step(abs(p.x - C.x), .74));
  ln = max(ln, (1. - smoothstep(0., px*1.2, abs(p.x - C.x)))*.3*step(abs(p.y - C.y), .74));
  col = mix(col, ink, ln*mix(.5, .3, uDark));
  vec2 dot1 = C + .44*vec2(cos(t*.21), sin(t*.21));                                   /* a mark going round the middle ring */
  col = mix(col, mix(vec3(.12, .15, .2), vec3(.78, 1., .18), uDark), 1. - smoothstep(.006, .006 + px, length(p - dot1)));
  /* two small spheres */
  for (int i = 0; i < 2; i++){ float fi = float(i), R = .046 - .014*fi;
    vec2 c = mix(vec2(asp*.13, .63), vec2(asp*.7, .15), fi) + .018*vec2(cos(t*.37 + fi*2.), sin(t*.31 + fi));
    vec2 d = (p - c)/R; float q = dot(d, d);
    if (q < 1.){ vec3 n = vec3(d.x, -d.y, sqrt(1. - q)); col = mix(col, room(n), smoothstep(1., 1. - px/R*2., q)); } }
  /* the liquid metal */
  float F = 0.; vec2 G = vec2(0.);
  vec2 c2 = vec2(asp*.06, .1);
  blob(p, C + .07*vec2(cos(t*.19), sin(t*.16)), .17, F, G);
  blob(p, C + .2*vec2(cos(t*.12 + 2.3), sin(t*.15 + 1.)), .1, F, G);
  blob(p, C + .25*vec2(cos(-t*.1 + 4.2), sin(t*.085 + 3.)), .075, F, G);
  blob(p, c2 + .05*vec2(cos(t*.17 + 1.), sin(t*.14)), .1, F, G);
  blob(p, c2 + .13*vec2(cos(-t*.13 + 3.), sin(t*.18 + 2.)), .06, F, G);
  if (F > 1.){
    float k = clamp((F - 1.)*1.5, 0., 1.), gl = length(G) + 1e-5;
    vec2 o = -G/gl*sqrt(1. - k*k);
    col = mix(col, room(normalize(vec3(o.x, -o.y, k + .03))), smoothstep(1., 1. + gl*px*.9, F));
  }
  gl_FragColor = vec4(col, 1.);
}`;

FX.scenes.y2k = {
  dpr:1.25, maxPx:1.7e6,
  create(canvas, env){
    const g = FX.gl(canvas, FRAG, gl => gl.getExtension('OES_standard_derivatives'));
    if (!g) return null;
    const gl = g.gl;
    let e = env;
    return {
      frame(t){
        gl.uniform2f(g.u('uRes'), canvas.width, canvas.height);
        gl.uniform1f(g.u('uT'), t);
        gl.uniform1f(g.u('uDark'), e.dark ? 1 : 0);
        g.draw();
      },
      env(n){ e = n; },
      dispose(){ g.lose(); }
    };
  }
};
})();
