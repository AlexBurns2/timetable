/* ═══════════════════════════════════════════════════════════════════
   Shared theme + accessibility layer.

   Every page loads this in <head> so the look is applied before first
   paint and follows you between the timetable, home, notes and games.
   It owns nothing page-specific — just reads settings and paints <html>.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";

const LS = {
  skin:'tt.skin', mode:'tt.mode', zen:'tt.zen', custom:'tt.custom',
  textScale:'tt.textscale', zoom:'tt.zoom', contrast:'tt.contrast', motion:'tt.motion',
  view:'tt.view', outline:'tt.outline', header:'tt.header'
};

const get = (k, d) => {
  try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
  catch { return d; }
};
/* true only while syncPull writes server values in, so those writes don't
   bounce straight back out as a push. */
let pulling = false;
const set = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  if (!pulling && k.startsWith('tt.') && !SYNC_SKIP.has(k)) scheduleSync();
};

/* every skin in picker order; `custom` last so it lands bottom-right */
const SKINS = [
  { id:'plain',     name:'Plain',     both:true, border:'#e5e5e8',
    swatch:'linear-gradient(#fff,#fff)' },
  { id:'classic',   name:'Classic',   both:true,
    swatch:'linear-gradient(160deg,#dfe7f2,#f4f7fb 60%),radial-gradient(circle at 78% 22%,#0a84ff55,transparent 60%)' },
  { id:'paper',     name:'Notebook',  both:true,
    swatch:'linear-gradient(#f7f3e8,#f7f3e8) padding-box, repeating-linear-gradient(to bottom,#f7f3e8 0 7px,#c8d4e8 7px 8px)' },
  { id:'glass',     name:'Glass',     both:true,
    swatch:'radial-gradient(circle at 25% 20%,#7a5aff,transparent 60%),radial-gradient(circle at 80% 30%,#00becc,transparent 62%),radial-gradient(circle at 50% 90%,#ff50a0,transparent 60%),#0d1220' },
  { id:'swiss',     name:'Swiss',     both:true, border:'#111',
    swatch:'linear-gradient(#fff,#fff)' },
  { id:'newsprint', name:'Newsprint', both:true, border:'#241f18',
    swatch:'linear-gradient(#f4f1e8,#f4f1e8) padding-box, repeating-linear-gradient(45deg,rgba(0,0,0,.08) 0 3px,transparent 3px 6px)' },
  { id:'retro',     name:'Retro',     both:true,
    swatch:'linear-gradient(180deg,#3a6ea5 0 34%,#d4d0c8 34%),linear-gradient(#008080,#008080)' },
  { id:'scifi',     name:'Sci-fi',    both:false,
    swatch:'radial-gradient(circle at 50% 0%,rgba(0,229,255,.5),transparent 65%),repeating-linear-gradient(to bottom,rgba(0,229,255,.22) 0 1px,transparent 1px 8px),#04070d' },
  { id:'terminal',  name:'Terminal',  both:false,
    swatch:'repeating-linear-gradient(to bottom,#05080a 0 2px,#0d1a14 2px 4px)' },
  { id:'blueprint', name:'Blueprint', both:false,
    swatch:'repeating-linear-gradient(to right,rgba(255,255,255,.25) 0 1px,transparent 1px 9px),repeating-linear-gradient(to bottom,rgba(255,255,255,.25) 0 1px,transparent 1px 9px),#07223d' },
  { id:'brutal',    name:'Brutal',    both:true,
    swatch:'linear-gradient(135deg,#ffe94a 50%,#0047ff 50%)' },
  { id:'custom',    name:'Custom',    both:false, custom:true,
    swatch:'conic-gradient(from 210deg,#ff5f6d,#ffc371,#7ee8fa,#a06cd5,#ff5f6d)' }
];
const SKIN_IDS = SKINS.map(s => s.id);

/* the four shown before the picker is expanded */
const QUICK_SKINS = ['plain','classic','custom'];

const CUSTOM_FONTS = ['DM Sans','Space Grotesk','JetBrains Mono','Space Mono',
                      'Instrument Serif','Caveat','Patrick Hand','Archivo Black'];
const CUSTOM_DEFAULTS = { bg:'#f2f4f8', panel:'#ffffff', text:'#16181d',
                          accent:'#6d4aff', line:'#d9dde5',
                          radius:12, tint:22, font:'DM Sans',
                          glass:false, backdrop:'solid', shadow:'soft',
                          border:1, accent2:'#00c2c7',
                          /* the Clouds backdrop: four colours, how strong, how big, moving or not */
                          cloud1:'#7a5cff', cloud2:'#00c2dc', cloud3:'#ff4fa3', cloud4:'#3a52f2',
                          cloudStrength:55, cloudSize:100, cloudAnim:false };

const CUSTOM_VARS = ['--bg','--bg-img','--panel','--panel-2','--line','--text','--muted',
                     '--accent','--accent-ink','--card-radius','--radius','--tint',
                     '--card-border','--card-accent','--shadow','--shadow-hi',
                     '--font-ui','--font-display','--font-num','--display-tt','--display-ls'];

/* black or white text on top of a chosen accent */
function inkFor(hex){
  const h = String(hex).replace('#','');
  if (h.length !== 6) return '#fff';
  const v = [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255)
                   .map(c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4));
  return (0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2]) > 0.42 ? '#000' : '#fff';
}

function readState(){
  let skin = get(LS.skin, 'plain');
  if (SKIN_IDS.indexOf(skin) === -1) skin = 'plain';
  return {
    skin,
    mode: get(LS.mode, matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    zen: get(LS.zen, false),
    custom: Object.assign({}, CUSTOM_DEFAULTS, get(LS.custom, {})),
    textScale: get(LS.textScale, 1),
    zoom: get(LS.zoom, 1),
    contrast: get(LS.contrast, 'normal'),
    motion: get(LS.motion, 'normal'),
    view: get(LS.view, 'compact'),
    outline: get(LS.outline, true),
    header: get(LS.header, 'unified')
  };
}

/* ── Glass: the colour behind everything ─────────────────────────────
   Four fields of fractal noise (SVG feTurbulence), one per colour, each showing
   only where it peaks, softened, drawn small (480×300) and stretched over the
   window on two fixed layers (theme.css). Low frequency, so each cloud is
   bigger than the screen and runs off its edges: no centres or outlines to
   spot. Seeded at random once per page open, so it's never quite the same. */
const GLASS = {
  dark:  [[.47, .35, 1, 3.4], [0, .74, .86, 3.2], [1, .31, .63, 3.0], [.22, .32, .96, 2.6]],
  light: [[.49, .36, 1, 3.4], [0, .77, .91, 3.2], [1, .38, .66, 3.0], [.35, .45, 1, 2.6]]
};
/* however the seeds fall, never more colour than this (dark keeps its dark, so
   text and icons stay readable) */
const GLASS_CAP = { dark: .5, light: .62 };
/* The random part, chosen once per page open: each of the four colour fields
   gets its own seed and stretch. Kept for the page's life, so changing a
   custom theme's colours recolours the same clouds rather than reshuffling. */
const CLOUD_RND = Array.from({ length: 4 }, () => ({
  fx: 0.0013 + Math.random() * 0.0008, fy: 0.0013 + Math.random() * 0.0008, seed: 1 + Math.floor(Math.random() * 99998) }));
const cloudMemo = {};
/* fields: four [r, g, b (0–1), k (how sharply it shows)]; cap: the most colour
   ever; thr: where a field starts to show; size: 1 normal, 2 twice as big.
   Gives the two layers' backgrounds (fields 1–2 and 3–4). */
function cloudLayers(fields, cap, thr, size){
  const key = JSON.stringify([fields, cap, thr, size]); if (cloudMemo[key]) return cloudMemo[key];
  const one = from => {
    const parts = [0, 1].map(i => {
      const [r, g, b, k] = fields[from + i], rnd = CLOUD_RND[from + i];
      return "<feTurbulence type='fractalNoise' baseFrequency='" + (rnd.fx / size).toFixed(5) + ' ' + (rnd.fy / size).toFixed(5) + "' numOctaves='2' seed='" + rnd.seed + "' result='n" + i + "'/>" +
        "<feColorMatrix in='n" + i + "' type='matrix' values='0 0 0 0 " + r.toFixed(3) + ' 0 0 0 0 ' + g.toFixed(3) + ' 0 0 0 0 ' + b.toFixed(3) + ' ' + k.toFixed(2) + ' 0 0 0 ' + (-thr * k).toFixed(2) + "' result='c" + i + "'/>";
    }).join('');
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='300' viewBox='0 0 480 300'><filter id='f' x='0' y='0' width='100%' height='100%'>" +
      parts + "<feMerge result='m'><feMergeNode in='c0'/><feMergeNode in='c1'/></feMerge><feGaussianBlur in='m' stdDeviation='10'/>" +
      "<feComponentTransfer><feFuncA type='table' tableValues='0 " + cap.toFixed(2) + "'/></feComponentTransfer></filter>" +
      "<rect width='100%' height='100%' filter='url(#f)'/></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  };
  return (cloudMemo[key] = [one(0), one(2)]);
}
/* Some draws put a big cloud right in the middle, which washes out the page
   (and the point of dark mode). So before the clouds show, the page draws its
   draw small, measures how much colour lands in the middle, and rerolls (up to
   ten times) until the middle stays clear and there's still some colour about.
   The layers fade in once it's settled (theme.css, data-clouds-ready). Only
   once per page open; if the browser won't let the page read the drawing back
   (some Safari versions), the first draw is kept. */
let cloudArgs = null, cloudVet = 'todo';
function setCloudVars(root){
  const [a, b] = cloudLayers(cloudArgs.fields, cloudArgs.cap, cloudArgs.thr, cloudArgs.size);
  root.style.setProperty('--glass-a', a); root.style.setProperty('--glass-b', b);
}
function vetClouds(root){
  if (cloudVet !== 'todo') return; cloudVet = 'busy';
  root.setAttribute('data-clouds-ready', '0');
  const load = u => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u.replace(/^url\("|"\)$/g, ''); });
  const W = 72, H = Math.max(20, Math.round(72 * innerHeight / Math.max(1, innerWidth)));
  const measure = async () => {
    const [a, b] = cloudLayers(cloudArgs.fields, cloudArgs.cap, cloudArgs.thr, cloudArgs.size);
    const imgs = await Promise.all([load(a), load(b)]);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), lw = W * 1.28, lh = H * 1.28, sc = Math.max(lw / 480, lh / 300);   // as the layers: 14% over each edge, cover
    imgs.forEach(im => x.drawImage(im, (W - 480 * sc) / 2, (H - 300 * sc) / 2, 480 * sc, 300 * sc));
    const d = x.getImageData(0, 0, W, H).data;
    let mid = 0, nm = 0, all = 0;
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++){
      const al = d[(y * W + i) * 4 + 3] / 255; all += al;
      if (Math.abs(i / W - .5) < .3 && Math.abs(y / H - .45) < .33){ mid += al; nm++; }
    }
    return { mid: mid / nm, all: all / (W * H), edge: (all - mid) / (W * H - nm) };
  };
  const dark = cloudArgs.dark, okMid = dark ? .12 : .2, okAll = .08;
  (async () => {
    let best = null;
    try {
      for (let t = 0; t < 10; t++){
        const m = await measure();
        const score = m.mid - (m.edge - m.mid) * .5 + (m.all < okAll ? 1 : 0);   // a clear middle, colour round the edges
        if (!best || score < best.score) best = { score, rnd: CLOUD_RND.map(r => Object.assign({}, r)) };
        if (m.mid <= okMid && m.all >= okAll && m.edge >= m.mid + .05) break;
        CLOUD_RND.forEach(r => { r.fx = 0.0013 + Math.random() * 0.0008; r.fy = 0.0013 + Math.random() * 0.0008; r.seed = 1 + Math.floor(Math.random() * 99998); });
        for (const k in cloudMemo) delete cloudMemo[k];                        // new seeds: draw afresh
      }
      best.rnd.forEach((r, i) => Object.assign(CLOUD_RND[i], r));
      for (const k in cloudMemo) delete cloudMemo[k];
      if (cloudArgs) setCloudVars(root);
    } catch { /* can't read the drawing back: keep the first */ }
    cloudVet = 'done';
    root.setAttribute('data-clouds-ready', '1');
  })();
}
const hex01 = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x7a5cff;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
/* a fine grain over the clouds, light on a dark page and dark on a light one */
const cloudGrain = dark => 'url("data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'>" +
  "<feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 " + (dark ? '1 0 0 0 0 1 0 0 0 0 1 0 0 0 .09 0' : '.1 0 0 0 0 .1 0 0 0 0 .25 0 0 0 .07 0') +
  "'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>") + '")';

/* ── The favicon in the theme's colours ───────────────────────────────
   The pages link a fixed one (images/favicon-*.png: the MSCU square in its
   own blue, rounded). Here it's redrawn in the theme's accent with the letters
   in its accent ink (and drawn in the theme's way, FAV_STYLE), whenever the
   look changes. Browsers that don't take a favicon from a script (Safari)
   keep the fixed one. */
let favImg = null, favTimer = 0, favLast = '';
/* The letters get a little of each theme's character: rounded for Classic,
   refracted for Glass, pixels for Terminal and Retro, an outline for
   Blueprint, a hard shadow for Brutal, a glow for Sci-fi, a tilt for Notebook.
   The rest keep the logo's letters as they are. */
const FAV_STYLE = { classic:'round', glass:'glass', terminal:'pixel', retro:'pixel', blueprint:'outline', brutal:'shadow', scifi:'glow', paper:'tilt' };
function favThreshold(x, n, cut, soft){            // alpha: a soft step at `cut` (rounds or squares off the edges)
  const d = x.getImageData(0, 0, n, n), a = d.data, h = (soft || 1) / 2;
  for (let i = 3; i < a.length; i += 4) a[i] = Math.max(0, Math.min(255, (a[i] - (cut - h)) / (2 * h) * 255));
  x.putImageData(d, 0, 0);
}
function paintFavicon(){
  try {
    const root = document.documentElement, cs = getComputedStyle(root);
    const bg = cs.getPropertyValue('--accent').trim(), ink = cs.getPropertyValue('--accent-ink').trim() || '#fff';
    const style = FAV_STYLE[root.getAttribute('data-skin')] || 'plain';
    if (!bg || bg + ink + style === favLast) return;
    const draw = () => {
      const N = 64, mk = n => { const c = document.createElement('canvas'); c.width = c.height = n || N; return c; };
      /* the letters, in a colour (or a gradient, made by fill(x)), in a shape */
      const letters = (fill, shape) => {
        const c = mk(), x = c.getContext('2d');
        if (shape === 'pixel'){
          const s = mk(23), sx = s.getContext('2d'); sx.drawImage(favImg, 0, 0, 23, 23); favThreshold(sx, 23, 112);
          x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, N, N);
        } else if (shape === 'round'){
          x.filter = 'blur(2.4px)'; x.drawImage(favImg, 0, 0, N, N); x.filter = 'none'; favThreshold(x, N, 128, 40);
        } else x.drawImage(favImg, 0, 0, N, N);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = typeof fill === 'function' ? fill(x) : fill; x.fillRect(0, 0, N, N);
        return c;
      };
      const c = mk(), x = c.getContext('2d'), r = N * 0.22;
      x.beginPath(); x.moveTo(r, 0); x.arcTo(N, 0, N, N, r); x.arcTo(N, N, 0, N, r); x.arcTo(0, N, 0, 0, r); x.arcTo(0, 0, N, 0, r); x.closePath();
      x.fillStyle = bg; x.fill();
      x.save(); x.clip();
      if (style === 'glass'){
        /* a pane: a sheen across the top, the letters with light through them and a colour fringe */
        const g = x.createLinearGradient(0, 0, N * .7, N); g.addColorStop(0, 'rgba(255,255,255,.38)'); g.addColorStop(.45, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, N, N);
        x.globalAlpha = .7; x.drawImage(letters('#00d6ff'), -1.6, 0); x.drawImage(letters('#ff4fc0'), 1.6, 0); x.globalAlpha = 1;
        /* a diagonal band where the letters thin out, as if light passes through them */
        const L = letters(ink), lx = L.getContext('2d'), band = lx.createLinearGradient(0, 0, N * .45, N);
        band.addColorStop(.38, 'rgba(0,0,0,0)'); band.addColorStop(.5, 'rgba(0,0,0,.5)'); band.addColorStop(.62, 'rgba(0,0,0,0)');
        lx.globalCompositeOperation = 'destination-out'; lx.fillStyle = band; lx.fillRect(0, 0, N, N);
        x.drawImage(L, 0, 0);
      } else if (style === 'outline'){
        const o = mk(), ox = o.getContext('2d'), L = letters(ink);
        for (let a = 0; a < 16; a++) ox.drawImage(L, Math.cos(a / 8 * Math.PI) * 2.2, Math.sin(a / 8 * Math.PI) * 2.2);
        ox.globalCompositeOperation = 'destination-out'; ox.drawImage(L, 0, 0);
        x.drawImage(o, 0, 0);
      } else if (style === 'shadow'){
        x.drawImage(letters('rgba(0,0,0,.85)'), 3, 3); x.drawImage(letters(ink), 0, 0);
      } else if (style === 'glow'){
        /* neon: a white glow behind the letters */
        x.shadowColor = 'rgba(255,255,255,.95)'; x.shadowBlur = 6; const L = letters(ink); x.drawImage(L, 0, 0); x.drawImage(L, 0, 0); x.shadowBlur = 0;
      } else if (style === 'tilt'){
        x.translate(N / 2, N / 2); x.rotate(-0.1); x.scale(.92, .92); x.translate(-N / 2, -N / 2); x.drawImage(letters(ink, 'round'), 0, 0);
      } else x.drawImage(letters(ink, style === 'round' || style === 'pixel' ? style : ''), 0, 0);
      x.restore();
      const url = c.toDataURL('image/png');
      document.querySelectorAll('link[rel~="icon"]').forEach(l => { l.type = 'image/png'; l.href = url; });
      favLast = bg + ink + style;
    };
    if (favImg && favImg.complete && favImg.naturalWidth) draw();
    else if (!favImg){ favImg = new Image(); favImg.onload = draw; favImg.src = '/images/msc-letters.png'; }
  } catch { /* no canvas: the fixed icon stays */ }
}
/* after the look has settled and the page's <link>s exist */
function queueFavicon(){
  clearTimeout(favTimer);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintFavicon, { once:true });
  else favTimer = setTimeout(paintFavicon, 0);
}

function apply(state){
  const st = state || readState();
  const root = document.documentElement;
  queueFavicon();

  root.setAttribute('data-skin', st.skin);
  root.setAttribute('data-tileicons', get('tt.tileicons', 'tile') === 'accent' ? 'accent' : 'tile');   // Home's tile icons
  root.setAttribute('data-gameicons', get('tt.gameicons', 'icons') === 'emoji' ? 'emoji' : 'icons');   // games: icons or emoji
  /* the colour clouds behind everything (theme.css): Glass always, a custom
     theme with the Clouds backdrop. data-clouds: off | still | move */
  let clouds = 'off';
  root.style.removeProperty('--glass-a'); root.style.removeProperty('--glass-b');
  if (st.skin === 'glass'){
    const m = st.mode === 'light' ? 'light' : 'dark';
    cloudArgs = { fields: GLASS[m], cap: GLASS_CAP[m], thr: m === 'dark' ? 0.55 : 0.52, size: 1, dark: m === 'dark' };   // only the higher peaks show
    clouds = get('tt.glassanim', '') === 'on' ? 'move' : 'still';
  }
  if (st.skin === 'custom' && st.custom.backdrop === 'clouds'){
    const c = st.custom, K = [3.4, 3.2, 3.0, 2.6];
    const fields = [c.cloud1, c.cloud2, c.cloud3, c.cloud4].map((h, i) => hex01(h).concat(K[i]));
    cloudArgs = { fields, cap: Math.max(.1, Math.min(.95, (+c.cloudStrength || 55) / 100)), thr: 0.53,
                  size: Math.max(.5, Math.min(2, (+c.cloudSize || 100) / 100)), dark: inkFor(c.bg) === '#fff' };
    clouds = c.cloudAnim ? 'move' : 'still';
  }
  if (clouds !== 'off'){ setCloudVars(root); vetClouds(root); }
  root.setAttribute('data-clouds', clouds);
  root.setAttribute('data-mode', st.mode);
  /* Keep native controls (the datalist autocomplete popup, text inputs,
     scrollbars) in step with the effective palette. Without this a dark page
     keeps a light native popup, and its option text — which inherits the
     input's light colour — renders white-on-white. Custom follows its own
     background's darkness; the fixed-dark skins are always dark. */
  root.style.colorScheme =
      st.skin === 'custom'
        ? (inkFor(st.custom.bg) === '#fff' ? 'dark' : 'light')
    : (st.skin === 'scifi' || st.skin === 'terminal' || st.skin === 'blueprint')
        ? 'dark'
        : (st.mode === 'dark' ? 'dark' : 'light');
  root.classList.toggle('zen', !!st.zen);
  root.setAttribute('data-contrast', st.contrast);
  /* The compact grid positions cards absolutely via [data-view]; without this
     set before first paint they flow in document order and every column
     stacks out of alignment. */
  root.setAttribute('data-view', st.view);
  root.setAttribute('data-header', st.header);
  root.classList.toggle('nooutline', !st.outline);
  root.setAttribute('data-motion', st.motion);
  root.style.setProperty('--text-scale', st.textScale);
  root.style.setProperty('--ui-zoom', st.zoom);

  CUSTOM_VARS.forEach(v => root.style.removeProperty(v));
  if (st.skin !== 'custom') return st;

  const c = st.custom, S = (k,v) => root.style.setProperty(k, v);
  S('--bg', c.bg);
  S('--bg-img',
      c.backdrop === 'gradient'
        ? 'linear-gradient(160deg, ' + c.accent + '22, transparent 55%), ' +
          'linear-gradient(20deg, ' + c.accent2 + '1f, transparent 60%)'
    : c.backdrop === 'clouds'
        ? cloudGrain(inkFor(c.bg) === '#fff')
    : c.backdrop === 'mesh'
        ? 'radial-gradient(58vw 58vw at 12% 8%, ' + c.accent + '66, transparent 60%),' +
          'radial-gradient(52vw 52vw at 88% 16%, ' + c.accent2 + '5c, transparent 62%),' +
          'radial-gradient(56vw 56vw at 50% 96%, ' + c.accent + '40, transparent 60%)'
        : 'none');

  if (c.glass){
    S('--panel',   'rgba(255,255,255,' + (inkFor(c.bg) === '#fff' ? '.10' : '.55') + ')');
    S('--panel-2', 'rgba(255,255,255,' + (inkFor(c.bg) === '#fff' ? '.06' : '.38') + ')');
    S('--line',    'rgba(255,255,255,' + (inkFor(c.bg) === '#fff' ? '.22' : '.8')  + ')');
  } else {
    S('--panel', c.panel);
    S('--panel-2', 'color-mix(in srgb, ' + c.panel + ' 90%, ' + c.text + ')');
    S('--line', c.line);
  }

  S('--text', c.text);
  S('--muted', 'color-mix(in srgb, ' + c.text + ' 58%, ' + (c.glass ? c.bg : c.panel) + ')');
  S('--accent', c.accent);
  S('--accent-ink', inkFor(c.accent));
  S('--card-radius', c.radius + 'px');
  S('--radius', Math.max(4, Math.round(c.radius * 0.85)) + 'px');
  S('--tint', c.tint + '%');
  S('--card-border', c.border + 'px solid ' + (c.glass ? 'rgba(255,255,255,.24)' : c.line));
  S('--card-accent', '4px');
  S('--shadow',
      c.shadow === 'none' ? 'none'
    : c.shadow === 'hard' ? (c.border >= 2 ? '5px 5px 0 ' + c.line : '0 3px 0 ' + c.line)
    : '0 1px 3px rgba(0,0,0,.10)');
  S('--shadow-hi',
      c.shadow === 'none' ? 'none'
    : c.shadow === 'hard' ? (c.border >= 2 ? '8px 8px 0 ' + c.line : '0 5px 0 ' + c.line)
    : '0 4px 16px rgba(0,0,0,.16)');
  const f = '"' + c.font + '", system-ui, sans-serif';
  S('--font-ui', f); S('--font-display', f); S('--font-num', f);
  S('--display-tt', 'normal'); S('--display-ls', '-.01em');
  root.classList.toggle('customglass', !!c.glass);
  return st;
}

/* paint immediately so there is no flash of the wrong theme */
apply();

/* a change made in another tab should follow here too */
addEventListener('storage', ev => { if (ev.key && ev.key.startsWith('tt.')) apply(); });
/* the tile layout: always the even grid now (the gallery option was removed).
   Kept as a function so older code that asks still gets an answer. */
const layout = () => 'classic';
addEventListener('storage', ev => { if (ev.key === 'tt.layout') dispatchEvent(new CustomEvent('tt:layout')); });

/* ── shared API helper (used by the games page's Guess-Who) ──────────── */
const API_ENDPOINT = '/api/timetable';
const EMAIL_DOMAIN = 'education.nsw.gov.au';
function apiHeaders(){
  const h = { Accept:'application/json' };
  const c = get('tt.creds', null);
  if (c && c.email && c.password){
    h['X-School-Email'] = c.email;
    h['X-School-Password'] = c.password;
  }
  return h;
}
async function apiGet(params){
  const u = new URL(API_ENDPOINT, location.href);
  for (const k in params) u.searchParams.set(k, params[k]);
  const url = u.origin === location.origin ? u.pathname + u.search : u.toString();
  const res = await fetch(url, { headers: apiHeaders(), cache:'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || (res.status + ' ' + res.statusText));
  return data;
}
/* generic call to any /api/* route with the school-login headers attached.
   api('/api/daily'), api('/api/daily', { method:'POST', body:{guess} }). */
async function api(path, opts){
  opts = opts || {};
  const u = new URL(path, location.href);
  if (opts.params) for (const k in opts.params) u.searchParams.set(k, opts.params[k]);
  const url = u.origin === location.origin ? u.pathname + u.search : u.toString();
  const headers = Object.assign({}, apiHeaders());
  const init = { method: opts.method || 'GET', headers, cache: 'no-store' };
  if (opts.body !== undefined){ headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  /* never hang for ever: give up after 70 s (the server's own limit is 60) */
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), opts.timeout || 70000) : null;
  if (ctl) init.signal = ctl.signal;
  let res;
  try { res = await fetch(url, init); }
  catch (e){
    throw new Error(e && e.name === 'AbortError' ? 'The server took too long to answer. Try again in a moment.'
                                                 : 'Couldn’t reach the server. Check your connection and try again.');
  } finally { if (timer) clearTimeout(timer); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || (res.status === 504 ? 'The server took too long to answer. Try again in a moment.' : res.status + ' ' + res.statusText));
  return data;
}
/* the loading indicator (styles in theme.css): what's loading, then "still
   loading" after 6 s and a plain note after 20 s. sm: a compact one. */
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
function loader(text, late, opts){
  opts = opts || {};
  return '<span class="ld' + (opts.sm ? ' sm' : '') + '" role="status" aria-live="polite"><span class="ldspin" aria-hidden="true"></span><span>' +
    '<span class="ldt">' + escHtml(text || 'Loading…') + '</span>' +
    (opts.sm ? '' : '<span class="ldlate">' + escHtml(late || 'Still loading…') + '</span>' +
      '<span class="ldslow"><b>This is taking much longer than usual.</b> The school’s system may be slow right now. Wait a little, or reload the page.</span>') +
    '</span></span>';
}
const myEmail = () => {
  const c = get('tt.creds', null);
  return get('tt.email', (c && c.email) || '');
};

/* ── settings sync (Phase 1) ───────────────────────────────────────────
   Mirror the tt.* bag to /api/prefs, keyed by school login, so settings
   follow the user rather than the device. localStorage stays the offline
   cache; the server copy wins on load. Never synced: the password, the
   device-local timetable cache, the raw-string notes, and the local sync
   bookkeeping key. */
const SYNC_SKIP = new Set(['tt.creds', 'tt.cache', 'tt.notes', 'tt.syncedat']);

function hasCreds(){
  const c = get('tt.creds', null);
  return !!(c && c.email && c.password);
}
function apiUrl(path){
  const u = new URL(path, location.href);
  return u.origin === location.origin ? u.pathname + u.search : u.toString();
}
function collectPrefs(){
  const blob = {};
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if (k && k.startsWith('tt.') && !SYNC_SKIP.has(k)) blob[k] = get(k);
  }
  return blob;
}

let pushTimer = null;
function scheduleSync(){
  if (!hasCreds()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; flushPush(); }, 900);
}
async function flushPush(keepalive){
  if (!hasCreds()) return;
  try {
    const res = await fetch(apiUrl('/api/prefs'), {
      method: 'PUT', keepalive: !!keepalive,
      headers: Object.assign({ 'Content-Type': 'application/json' }, apiHeaders()),
      body: JSON.stringify(collectPrefs())
    });
    if (res.ok){
      const out = await res.json().catch(() => null);
      if (out && out.updated_at) set('tt.syncedat', out.updated_at);  // in SYNC_SKIP → no echo
    }
  } catch {}
}
/* Public: schedule a debounced push. Pages that write tt.* through their own
   set() (index.html) call this so their changes sync too. */
const syncPush = scheduleSync;

async function syncPull(){
  if (!hasCreds()) return;
  let payload = null;
  try {
    const res = await fetch(apiUrl('/api/prefs'), { headers: apiHeaders(), cache: 'no-store' });
    if (!res.ok) return;
    payload = await res.json();
  } catch { return; }

  const data = payload && payload.data;
  if (!data || typeof data !== 'object') return;

  /* Gate on the server's version stamp, not on comparing values: jsonb does
     not preserve object key order, so a value-diff would loop forever. */
  const stamp = payload.updated_at || null;
  if (stamp === get('tt.syncedat', null)) return;   // already in sync

  pulling = true;
  try {
    for (const k in data){
      if (!k.startsWith('tt.') || SYNC_SKIP.has(k)) continue;
      try { localStorage.setItem(k, JSON.stringify(data[k])); } catch {}
    }
  } finally { pulling = false; }
  set('tt.syncedat', stamp);
  apply();

  /* The page captured its state from localStorage before this async pull
     resolved (grid DOM, view mode, colours). A one-time reload rebinds it to
     the synced values. Gated by the stamp above, so it never loops. */
  try { location.reload(); } catch {}
}

/* flush a pending change when leaving the page */
addEventListener('pagehide', () => {
  if (!pushTimer) return;
  clearTimeout(pushTimer); pushTimer = null;
  flushPush(true);
});

/* ── What's new ──────────────────────────────────────────────────────
   One list for the "What's new" sheet (Home's footer) and the NEW tags.
   Newest first. key: the thing a NEW tag sits on ('game:<id>'), cleared when
   you open it; no key, no tag (just the list). A tag also stops after
   NEWS_DAYS. What you've seen is kept with your account (tt. keys sync).
   To announce something: add a line at the top. */
const NEWS = [
  { id:'qtdiff', date:'2026-11-12', key:'game:quartets', title:'How hard was today?',
    text:'Quartets results now show how hard the day was for your year, group by group.', href:'games.html?play=quartets' },
  { id:'quartets', date:'2026-11-10', key:'game:quartets', title:'Quartets',
    text:'A new daily puzzle: sort 16 people from your year into four groups of four.', href:'games.html?play=quartets' },
  { id:'multiplayer', date:'2026-11-10', title:'Multiplayer Tetris and Snake',
    text:'Play Tetris Versus or Snake online against a friend.', href:'games.html?play=tetris' },
  { id:'poll', date:'2026-11-09', title:'The weekly poll',
    text:'An anonymous question for your year every week, at the top of Home. Results on Friday at noon.', href:'home.html' },
  { id:'dgarchive', date:'2026-11-09', key:'game:dailyguess', title:'Daily Guess Who archive',
    text:'Play past days from the calendar, and see how your year went each day.', href:'games.html?play=dailyguess' }
];
const NEWS_DAYS = 21;
const ymd = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const recent = n => Date.now() - Date.parse(n.date + 'T00:00:00') < NEWS_DAYS * 864e5;
/* a NEW tag on this key? (something newer than the day you last opened it) */
function newsActive(key){
  const seen = (get('tt.news_seen', {}) || {})[key] || '';
  return NEWS.some(n => n.key === key && recent(n) && n.date > seen);
}
function newsSeen(key){
  if (!newsActive(key)) return;
  const m = Object.assign({}, get('tt.news_seen', {}) || {}); m[key] = ymd(); set('tt.news_seen', m);
}
/* the sheet: anything recent you haven't seen there yet */
const newsUnread = () => { const r = get('tt.news_read', '') || ''; return NEWS.filter(n => recent(n) && n.date > r); };
function newsRead(){ if (NEWS.length && newsUnread().length) set('tt.news_read', NEWS[0].date); }

window.TT = { LS, get, set, SKINS, SKIN_IDS, QUICK_SKINS,
              NEWS, newsActive, newsSeen, newsUnread, newsRead,
              CUSTOM_FONTS, CUSTOM_DEFAULTS, inkFor, readState, apply,
              apiGet, api, loader, myEmail, EMAIL_DOMAIN, syncPull, syncPush, layout,
              /* has a school login saved on this device. Note this is not the
                 same as myEmail(), which is whose timetable you are looking at
                 and can be set without ever signing in. */
              signedIn: hasCreds };

/* returning users: pull the server copy on load */
if (hasCreds()) syncPull();

/* ── offline ───────────────────────────────────────────────────────────────
   Register the service worker so the site opens without a network. Pages are
   network-first inside it, so this can never serve a stale build; /sw-off
   removes it again if it ever needs undoing. Registration is deliberately
   quiet: a browser that refuses it just carries on online-only. */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))){
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
})();

/* ── a Back button at the start of the header, only where Home isn't enough:
   the games and revision pages, while a game or subject is open (games.js shows
   and hides it). It goes back if you came from another page of this site,
   otherwise to Home; a page can handle it first (window.TTBack returning true). */
(function(){
  function addBack(){
    const crumbs = document.querySelector('.pagehead .crumbs');
    const page = document.body && document.body.dataset.page;
    if (!crumbs || document.getElementById('hdrback') || (page !== 'games' && page !== 'revision')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn icon'; b.id = 'hdrback'; b.title = 'Back'; b.setAttribute('aria-label', 'Back');
    b.innerHTML = window.Icon ? Icon.svg('arrow-left') : '&#8592;';
    b.onclick = () => {
      if (typeof window.TTBack === 'function' && window.TTBack()) return;
      let fromHere = false;
      try { fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1; } catch {}
      if (fromHere) history.back(); else location.href = 'home.html';
    };
    b.hidden = !(window.TTBackOn && window.TTBackOn());
    crumbs.insertBefore(b, crumbs.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBack); else addBack();
})();
