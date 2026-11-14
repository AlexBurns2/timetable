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

/* the version on the shared files this script loads itself (each theme's
   stylesheet in /skins, fx.js and its scenes); the pages carry the same one */
const ASSET_V = '20261114';

/* Every theme, in the picker's order; `custom` last so it lands bottom-right.
   css:  its stylesheet, /skins/<css>.css (Plain, Classic and Glass are in theme.css)
   font: Google Fonts families it uses, fetched when it's chosen
   ic / is: its own icons (Icon colour: tile = a colour each, accent = the
         theme's colour; Icon style: icons or emoji), unless Display overrides them
   both: has a light and a dark version (false: always dark)
   legacy: an original, as the theme was before it was redrawn; not in the
         picker, but under Settings → Custom → Originals */
const SKINS = [
  { id:'plain',     name:'Plain',     both:true, ic:'tile', is:'icons' },
  { id:'classic',   name:'Classic',   both:true, ic:'tile', is:'emoji' },
  { id:'glass',     name:'Glass',     both:true, ic:'accent', is:'icons' },
  { id:'paper',     name:'Notebook',  both:true, ic:'tile', is:'emoji', css:'paper', font:'family=Caveat:wght@500;700&family=Patrick+Hand' },
  { id:'skeuo',     name:'Skeuomorphism', both:true, ic:'tile', is:'icons', css:'skeuo' },
  { id:'y2k',       name:'Y2K Futurism', both:true, ic:'accent', is:'icons', css:'y2k', font:'family=Michroma&family=Sora:wght@400;600;700' },
  { id:'vapor',     name:'Vaporwave', both:true, ic:'tile', is:'emoji', css:'vapor', font:'family=VT323&family=DotGothic16' },
  { id:'editorial', name:'Editorial', both:true, ic:'accent', is:'icons', css:'editorial', font:'family=Instrument+Serif:ital@0;1&family=Jost:wght@400;500;600' },
  { id:'swiss',     name:'Swiss',     both:true, ic:'accent', is:'icons', css:'swiss', font:'family=Inter+Tight:wght@400;500;600;700;800' },
  { id:'deco',      name:'Art Deco',  both:true, ic:'accent', is:'icons', css:'deco', font:'family=Big+Shoulders+Display:wght@500;700;900&family=Josefin+Sans:wght@400;600;700' },
  { id:'brutal',    name:'Neo Brutalism', both:true, ic:'tile', is:'icons', css:'brutal', font:'family=Archivo+Black&family=Space+Grotesk:wght@400;500;700' },
  { id:'maximal',   name:'Maximalism', both:true, ic:'tile', is:'icons', css:'maximal', font:'family=Archivo:wdth,wght@62..125,100..900&family=Instrument+Serif:ital@0;1' },
  { id:'scifi',     name:'Cyberpunk', both:false, ic:'accent', is:'icons', css:'scifi', font:'family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700;800&family=Doto:wght@500;700;900&family=JetBrains+Mono:wght@400;700' },
  { id:'terminal',  name:'Terminal',  both:false, ic:'accent', is:'icons', css:'terminal', font:'family=JetBrains+Mono:wght@400;700' },
  { id:'blueprint', name:'Blueprint', both:false, ic:'accent', is:'icons', css:'blueprint', font:'family=Space+Mono:wght@400;700' },
  { id:'custom',    name:'Custom',    both:false, custom:true },
  /* the originals */
  { id:'o-paper',     name:'Notebook',  legacy:true, both:true,  ic:'tile', is:'icons', css:'legacy', font:'family=Caveat:wght@500;700&family=Patrick+Hand' },
  { id:'o-swiss',     name:'Swiss',     legacy:true, both:true,  ic:'tile', is:'icons', css:'legacy' },
  { id:'o-brutal',    name:'Brutal',    legacy:true, both:true,  ic:'tile', is:'icons', css:'legacy' },
  { id:'o-scifi',     name:'Sci-fi',    legacy:true, both:false, ic:'tile', is:'icons', css:'legacy' },
  { id:'o-terminal',  name:'Terminal',  legacy:true, both:false, ic:'tile', is:'icons', css:'legacy' },
  { id:'o-blueprint', name:'Blueprint', legacy:true, both:false, ic:'tile', is:'icons', css:'legacy' },
  { id:'newsprint',   name:'Newsprint', legacy:true, both:true,  ic:'tile', is:'icons', css:'legacy' },
  { id:'retro',       name:'Retro',     legacy:true, both:true,  ic:'tile', is:'icons', css:'legacy' }
];
const SKIN_IDS = SKINS.map(s => s.id);

/* The picker's thumbnails: each theme as a miniature of itself, the same
   little page every time (a bar across the top, three tiles under it) drawn
   the way that theme draws it. SVG, 120 by 46, made here so they cost no
   requests. (Type in them is the device's own; a data-URI can't use a web font.) */
const THUMBS = (() => {
  const bar = (a, extra) => '<rect x="8" y="6" width="104" height="12" ' + a + '/>' + (extra || '');
  const tiles = (a, f) => [8, 44, 80].map((x, i) => '<rect x="' + x + '" y="23" width="32" height="17" ' + (f ? f(i) : a) + '/>').join('');
  return {
    plain: ['#ffffff', bar('rx="3" fill="#fff" stroke="#dcdce0"') + '<circle cx="15" cy="12" r="2.2" fill="#4f4fd0"/><rect x="21" y="10.5" width="30" height="3" rx="1.5" fill="#18181b"/>' + tiles('rx="3" fill="#fff" stroke="#dcdce0"')],
    classic: ['#e3e9f1', bar('rx="5" fill="#fff" fill-opacity=".8"') + '<rect x="14" y="10.5" width="34" height="3" rx="1.5" fill="#1d1d1f"/>' +
      tiles('', i => 'rx="5" fill="#fff" fill-opacity=".8" stroke="' + ['#ff9f0a', '#0a84ff', '#30d158'][i] + '" stroke-width="1.6"')],
    glass: ['#0d1220', '<defs><filter id="b"><feGaussianBlur stdDeviation="9"/></filter></defs><g filter="url(#b)"><circle cx="22" cy="6" r="20" fill="#7a5aff"/><circle cx="96" cy="14" r="20" fill="#00becc"/><circle cx="60" cy="48" r="18" fill="#ff50a0"/></g>' +
      bar('rx="6" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".4"') + tiles('rx="6" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".4"')],
    paper: ['#f7f3e8', '<g stroke="#9fb4d8" stroke-opacity=".5">' + [9, 18, 27, 36, 45].map(y => '<path d="M0 ' + y + 'H120"/>').join('') + '</g><path d="M22 0V46" stroke="#d66" stroke-opacity=".6"/>' +
      '<rect x="30" y="5" width="82" height="12" fill="#fffdf6" stroke="#ded4bd"/><rect x="36" y="2.5" width="16" height="5" fill="#c2571f" fill-opacity=".35" transform="rotate(-4 44 5)"/>' +
      '<rect x="30" y="23" width="24" height="17" fill="#fff3a0" transform="rotate(-3 42 31)"/><rect x="59" y="23" width="24" height="17" fill="#ffd6e2" transform="rotate(2 71 31)"/><rect x="88" y="23" width="24" height="17" fill="#d3eaff" transform="rotate(-2 100 31)"/>'],
    skeuo: ['#c69a63', '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f7f8"/><stop offset=".5" stop-color="#c4c9cf"/><stop offset="1" stop-color="#dfe2e6"/></linearGradient>' +
      '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset=".51" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<g stroke="#a67843" stroke-opacity=".5"><path d="M0 9h120M0 20h70M40 31h80M0 41h120"/></g>' + bar('rx="3" fill="url(#a)" stroke="#6c7178"') + '<rect x="62" y="8.5" width="34" height="7" rx="1.5" fill="#b9c7a6" stroke="#4a5140"/>' +
      [['#e5484d', 20], ['#f76b15', 52], ['#0090ff', 84]].map(c => '<rect x="' + c[1] + '" y="23" width="16" height="16" rx="4" fill="' + c[0] + '"/><rect x="' + c[1] + '" y="23" width="16" height="16" rx="4" fill="url(#g)"/>').join('')],
    y2k: ['#e6ebf0', '<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#b3bfcc"/><stop offset=".62" stop-color="#e6ecf1"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
      '<radialGradient id="o" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#cdb6ff"/><stop offset="1" stop-color="#9ff0c6"/></radialGradient></defs>' +
      '<circle cx="104" cy="40" r="17" fill="url(#c)" stroke="#8a98a8" stroke-width=".6"/>' + bar('rx="6" fill="url(#c)" stroke="#8a98a8" stroke-width=".7"') + '<rect x="58" y="8" width="40" height="8" rx="4" fill="#0b0d10"/><circle cx="64" cy="12" r="1.8" fill="#c8ff2e"/>' +
      tiles('rx="6" fill="#fff" fill-opacity=".8" stroke="#aab6c4" stroke-width=".7"') + [16, 52, 88].map(x => '<circle cx="' + x + '" cy="31.5" r="4.5" fill="url(#o)"/>').join('')],
    vapor: ['#2a0a52', '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0638"/><stop offset=".62" stop-color="#7a1a7a"/><stop offset="1" stop-color="#ff4fa3"/></linearGradient>' +
      '<linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff71ce"/><stop offset=".5" stop-color="#b967ff"/><stop offset="1" stop-color="#01cdfe"/></linearGradient>' +
      '<linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe66d"/><stop offset="1" stop-color="#ff2a8a"/></linearGradient></defs>' +
      '<rect width="120" height="31" fill="url(#s)"/><circle cx="60" cy="29" r="13" fill="url(#u)"/><g fill="#7a1a7a"><rect x="40" y="24" width="40" height="1.4"/><rect x="40" y="27.3" width="40" height="2"/></g>' +
      '<rect y="31" width="120" height="15" fill="#0d0420"/><g stroke="#ff71ce" stroke-width=".7"><path d="M0 34h120M0 39h120M60 31V46M40 31 22 46M80 31 98 46M20 31-14 46M100 31 134 46"/></g>' +
      '<rect x="8" y="5" width="60" height="16" fill="#23103e" stroke="#a98be0"/><rect x="9" y="6" width="58" height="4.5" fill="url(#t)"/><rect x="13" y="14" width="26" height="2.6" fill="#ffe8fb"/>'],
    editorial: ['#f4f0e8', '<rect x="8" y="6" width="104" height="2.4" fill="#1a1814"/><text x="8" y="31" font-family="Georgia,\'Times New Roman\',serif" font-size="24" letter-spacing="-1" fill="#1a1814">Aa</text>' +
      '<rect x="46" y="14" width="66" height=".8" fill="#1a1814"/>' + [20, 27, 34].map((y, i) => '<rect x="46" y="' + y + '" width="' + [44, 52, 36][i] + '" height="2.6" fill="#1a1814"/><rect x="46" y="' + (y + 4.2) + '" width="66" height=".5" fill="#b9b0a2"/>').join('') +
      '<rect x="8" y="38" width="12" height="1.6" fill="#b5432a"/>'],
    swiss: ['#ffffff', [0, 1, 2, 3, 4, 5].map(i => '<rect x="' + (8 + i * 18) + '" y="0" width="14" height="46" fill="#e8112d" fill-opacity=".07"/>').join('') + '<rect x="8" y="5" width="104" height="4" fill="#000"/>' +
      '<rect x="8" y="13" width="6" height="6" fill="#e8112d"/><rect x="44" y="13" width="56" height="6" fill="#000"/>' +
      '<g fill="#fff" stroke="#000" stroke-width=".8"><rect x="44" y="24" width="22.6" height="16"/><rect x="66.6" y="24" width="22.6" height="16"/></g><rect x="89.2" y="24" width="22.8" height="16" fill="#e8112d"/>'],
    deco: ['#0d0f12', '<g stroke="#d4af37" fill="none"><g stroke-width=".7">' + [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75].map(a => '<path d="M60 22V7" transform="rotate(' + a + ' 60 22)"/>').join('') + '</g>' +
      '<path d="M45 22a15 15 0 0 1 30 0M52 22a8 8 0 0 1 16 0" stroke-width=".9"/><rect x="6" y="22" width="108" height="20" stroke-width=".9"/><rect x="8.5" y="24.5" width="103" height="15" stroke-width=".5"/>' +
      [30, 60, 90].map(x => '<rect x="' + (x - 3.6) + '" y="28.4" width="7.2" height="7.2" transform="rotate(45 ' + x + ' 32)" stroke-width=".9"/>').join('') + '</g>'],
    brutal: ['#ffe94a', '<defs><pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#000" fill-opacity=".3"/></pattern></defs><rect width="120" height="46" fill="url(#d)"/>' +
      '<rect x="10.5" y="8.5" width="104" height="12" fill="#000"/>' + bar('fill="#fffdf5" stroke="#000" stroke-width="1.6"') + '<rect x="13" y="10" width="26" height="4" fill="#000"/>' +
      [8, 44, 80].map((x, i) => '<rect x="' + (x + 2.5) + '" y="25.5" width="32" height="17" fill="#000"/><rect x="' + x + '" y="23" width="32" height="17" fill="' + ['#fffdf5', '#0047ff', '#fffdf5'][i] + '" stroke="#000" stroke-width="1.6"/>').join('')],
    maximal: ['#fbf4e4', [['#14121a', 0], ['#fbf4e4', 11.5], ['#f5419e', 23], ['#2b6fd0', 34.5]].map(b => '<rect y="' + b[1] + '" width="120" height="11.5" fill="' + b[0] + '"/>').join('') +
      '<g font-family="\'Arial Black\',Impact,sans-serif" font-size="11" font-weight="900" letter-spacing="-.4"><text x="-6" y="9.6" fill="#fbf4e4">MSCUNOFFICIAL +++ MSC</text><text x="-30" y="21.1" fill="#14121a">UNOFFICIAL +++ MSCUNOF</text>' +
      '<text x="-14" y="32.6" fill="#14121a">OFFICIAL +++ MSCUNOFFI</text><text x="-40" y="44.1" fill="#fbf4e4">CUNOFFICIAL +++ MSCUNO</text></g>' +
      '<rect x="33" y="13" width="62" height="24" fill="#f6bd1e"/><rect x="29" y="9" width="62" height="24" fill="#fbf4e4" stroke="#14121a" stroke-width="1.4"/><rect x="34" y="14" width="34" height="5" fill="#14121a"/><rect x="34" y="23" width="20" height="5" fill="#f5419e"/>'],
    scifi: ['#08090b', '<rect width="9" height="46" fill="#d4ff00"/><g stroke="#e9ebe5" stroke-opacity=".3" fill="none" stroke-width=".6"><circle cx="100" cy="24" r="15"/><ellipse cx="100" cy="24" rx="21" ry="7" transform="rotate(-18 100 24)"/><path d="M88 15 100 9 112 15 112 33 100 39 88 33ZM88 15 112 33M112 15 88 33M100 9V39"/></g>' +
      '<path d="M16 6H74L80 12V19H16Z" fill="#101216" stroke="#2a2e36"/><path d="M16 6h9l-2.4 4.4H16Z" fill="#d4ff00"/><rect x="29" y="12.6" width="30" height="3" fill="#e9ebe5"/>' +
      [16, 40, 64].map(x => '<path d="M' + x + ' 24h14l5 5v11h-19Z" fill="#101216" stroke="#2a2e36"/><path d="M' + (x + 2.5) + ' 29.5v-3h3M' + (x + 16.5) + ' 34.5v3h-3" stroke="#d4ff00" fill="none" stroke-width=".8"/>').join('')],
    terminal: ['#05080a', '<rect x="6.5" y="5.5" width="107" height="35" fill="none" stroke="#1f7a4b" stroke-width="1"/><rect x="9" y="8" width="102" height="30" fill="none" stroke="#1f7a4b" stroke-width="1"/>' +
      '<text x="15" y="21" font-family="Consolas,Menlo,\'Courier New\',monospace" font-size="9.5" font-weight="700" fill="#39ff9e">&gt; msc --home</text><text x="15" y="32" font-family="Consolas,Menlo,\'Courier New\',monospace" font-size="9.5" fill="#5fae87">ready</text>' +
      '<rect x="46" y="25" width="5.5" height="8.5" fill="#39ff9e"/><g fill="#000" fill-opacity=".28">' + [3, 9, 15, 21, 27, 33, 39, 45].map(y => '<rect y="' + y + '" width="120" height="1.4"/>').join('') + '</g>'],
    blueprint: ['#0a2c52', '<g stroke="#fff" stroke-opacity=".12" stroke-width=".6">' + [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(x => '<path d="M' + x + ' 0V46"/>').join('') + [6, 16, 26, 36].map(y => '<path d="M0 ' + y + 'H120"/>').join('') + '</g>' +
      '<g fill="#0a2c52" stroke="#c4e4ff" stroke-opacity=".75" stroke-width=".8">' + bar('') + tiles('') + '</g><rect x="13" y="10.4" width="30" height="3" fill="#f2f9ff"/>' +
      '<g stroke="#7ff0ff" stroke-width=".7"><path d="M4 21.5h4M116 21.5h-4M60 44v-3"/></g>'],
    custom: ['#7ee8fa', '<defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset=".35" stop-color="#ffc371"/><stop offset=".68" stop-color="#7ee8fa"/><stop offset="1" stop-color="#a06cd5"/></linearGradient></defs><rect width="120" height="46" fill="url(#r)"/>' +
      '<g stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M34 13h52M34 23h52M34 33h52"/></g><g fill="#fff" stroke="#14121a" stroke-opacity=".35"><circle cx="50" cy="13" r="4.2"/><circle cx="74" cy="23" r="4.2"/><circle cx="42" cy="33" r="4.2"/></g>']
  };
})();
SKINS.forEach(s => {
  const t = THUMBS[s.id];
  /* (single quotes round the address, and none inside it: this goes into a style="…" attribute) */
  s.swatch = t ? "url('data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 46" preserveAspectRatio="xMidYMid slice"><rect width="120" height="46" fill="' + t[0] + '"/>' + t[1] + '</svg>').replace(/'/g, '%27') + "') center/cover no-repeat" : 'var(--panel-2)';
});
SKINS.find(s => s.id === 'plain').border = '#e5e5e8'; SKINS.find(s => s.id === 'swiss').border = '#111'; SKINS.find(s => s.id === 'editorial').border = '#d6cdbf';

/* kept for older callers; the picker shows every theme now */
const QUICK_SKINS = SKINS.filter(s => !s.legacy).map(s => s.id);

/* which page this is, for the themes that give each page its own look
   (html[data-pg]): timetable, home, games, calendar, free, revision, … */
const PG = (() => {
  let f = location.pathname.split('/').pop().replace(/\.html$/, '');
  if (!f || f === 'index' || f === 'index2') f = 'timetable';
  if (f === 'poll') f = 'home';
  return f;
})();

const CUSTOM_FONTS = ['DM Sans','Space Grotesk','JetBrains Mono','Space Mono',
                      'Instrument Serif','Caveat','Patrick Hand','Archivo Black'];
const CUSTOM_DEFAULTS = { bg:'#f2f4f8', panel:'#ffffff', text:'#16181d',
                          accent:'#6d4aff', line:'#d9dde5',
                          radius:12, tint:22, font:'DM Sans',
                          glass:false, backdrop:'solid', shadow:'soft',
                          border:1, accent2:'#00c2c7',
                          /* the Clouds backdrop: four colours, how strong, how big, moving or not */
                          cloud1:'#7a5cff', cloud2:'#00c2dc', cloud3:'#ff4fa3', cloud4:'#3a52f2',
                          cloudStrength:55, cloudSize:100, cloudAnim:false,
                          /* the theme's icons (Display can still override them) */
                          iconColour:'tile', iconStyle:'icons' };

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
/* ...and kept for the visit: the next page draws the very same clouds (no reshuffle, no fade-in), so going
   from page to page the background doesn't change under the contents */
let cloudsKept = false, cloudT0 = Date.now();
try {
  const k = JSON.parse(sessionStorage.getItem('tt.cloudrnd') || 'null');
  if (k && k.r && k.r.length === 4 && k.r.every(r => r && r.fx > 0 && r.fy > 0 && r.seed > 0) && Date.now() - k.t0 < 6 * 3600e3 && Date.now() >= k.t0){
    k.r.forEach((r, i) => Object.assign(CLOUD_RND[i], { fx:r.fx, fy:r.fy, seed:r.seed })); cloudT0 = k.t0; cloudsKept = true; }
} catch {}
const keepClouds = () => { try { sessionStorage.setItem('tt.cloudrnd', JSON.stringify({ r:CLOUD_RND, t0:cloudT0 })); } catch {} };
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
let cloudArgs = null, cloudVet = cloudsKept ? 'done' : 'todo';
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
    keepClouds();
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
/* Each theme has its own icon: what's behind the letters (FAV: a shape, and a
   painter for it; without one, a rounded square in the theme's accent), the
   letters' colour, and how they're drawn (FAV_STYLE): rounded for Classic,
   refracted for Glass, pixels for Terminal, an outline for Blueprint, a hard
   shadow for Neo Brutalism, a colour split for Vaporwave, a gloss for
   Skeuomorphism, a tilt for Notebook. */
const FAV_STYLE = { classic:'round', glass:'glass', paper:'tilt', skeuo:'gloss', vapor:'glitch', brutal:'shadow', terminal:'pixel', blueprint:'outline',
                    'o-paper':'tilt', 'o-brutal':'shadow', 'o-scifi':'glow', 'o-terminal':'pixel', 'o-blueprint':'outline', retro:'pixel' };
const FAV = {
  paper:     { shape:'square', ink:'#3a2f1c', bg(x, N){ x.fillStyle = '#fff3a0'; x.fillRect(0, 0, N, N); x.fillStyle = 'rgba(80,110,160,.35)'; for (let y = 24; y < N; y += 13) x.fillRect(0, y, N, 1.5);
               x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(N/2 - 13, 0, 26, 8); } },
  y2k:       { shape:'circle', ink:'#0b0d10', bg(x, N){ const g = x.createLinearGradient(0, 0, 0, N); [[0, '#fff'], [.36, '#e3e9ef'], [.5, '#9aa8b8'], [.62, '#dfe6ee'], [1, '#fff']].forEach(s => g.addColorStop(s[0], s[1]));
               x.fillStyle = g; x.fillRect(0, 0, N, N); x.strokeStyle = '#c8ff2e'; x.lineWidth = 5; x.beginPath(); x.arc(N/2, N/2, N/2 - 2.5, 0, 7); x.stroke(); } },
  vapor:     { ink:'#fff', bg(x, N){ const g = x.createLinearGradient(0, 0, 0, N); g.addColorStop(0, '#7a4dff'); g.addColorStop(.55, '#ff5fbf'); g.addColorStop(1, '#ffb36b');
               x.fillStyle = g; x.fillRect(0, 0, N, N); x.fillStyle = 'rgba(40,10,80,.55)'; [45, 52, 58].forEach((y, i) => x.fillRect(0, y, N, 2 + i)); } },
  editorial: { shape:'square', ink:'#1a1814', bg(x, N){ x.fillStyle = '#f4f0e8'; x.fillRect(0, 0, N, N); x.fillStyle = '#1a1814'; x.fillRect(0, 0, N, 5); x.fillStyle = '#b5432a'; x.fillRect(0, N - 4, N, 4); } },
  swiss:     { shape:'square', ink:'#fff', bg(x, N){ x.fillStyle = '#e8112d'; x.fillRect(0, 0, N, N); x.fillStyle = '#000'; x.fillRect(0, 0, N, 7); } },
  deco:      { shape:'square', ink:'#d4af37', bg(x, N){ x.fillStyle = '#0d0f12'; x.fillRect(0, 0, N, N); x.strokeStyle = '#d4af37'; x.lineWidth = 2; x.strokeRect(3, 3, N - 6, N - 6); x.lineWidth = 1; x.strokeRect(7.5, 7.5, N - 15, N - 15); } },
  brutal:    { shape:'square', ink:'#0047ff', bg(x, N){ x.fillStyle = '#ffe94a'; x.fillRect(0, 0, N, N); x.strokeStyle = '#000'; x.lineWidth = 8; x.strokeRect(0, 0, N, N); } },
  maximal:   { shape:'square', ink:'#14121a', bg(x, N){ [['#f5419e', 0, 0], ['#f6bd1e', N/2, 0], ['#2b6fd0', 0, N/2], ['#14a594', N/2, N/2]].forEach(q => { x.fillStyle = q[0]; x.fillRect(q[1], q[2], N/2, N/2); }); } },
  scifi:     { shape:'cut', ink:'#08090b', bg(x, N){ x.fillStyle = '#d4ff00'; x.fillRect(0, 0, N, N); x.fillStyle = '#08090b'; x.fillRect(0, N - 7, N, 7); } },
  terminal:  { shape:'square', ink:'#39ff9e', bg(x, N){ x.fillStyle = '#05080a'; x.fillRect(0, 0, N, N); x.strokeStyle = '#39ff9e'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, N - 3, N - 3); } },
  blueprint: { shape:'square', ink:'#fff', bg(x, N){ x.fillStyle = '#0b3a66'; x.fillRect(0, 0, N, N); x.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 8; i < N; i += 12){ x.fillRect(i, 0, 1, N); x.fillRect(0, i, N, 1); } } }
};
function favThreshold(x, n, cut, soft){            // alpha: a soft step at `cut` (rounds or squares off the edges)
  const d = x.getImageData(0, 0, n, n), a = d.data, h = (soft || 1) / 2;
  for (let i = 3; i < a.length; i += 4) a[i] = Math.max(0, Math.min(255, (a[i] - (cut - h)) / (2 * h) * 255));
  x.putImageData(d, 0, 0);
}
function paintFavicon(){
  try {
    const root = document.documentElement, cs = getComputedStyle(root);
    const sk = root.getAttribute('data-skin'), fv = FAV[sk] || {};
    const bg = cs.getPropertyValue('--accent').trim(), ink = fv.ink || cs.getPropertyValue('--accent-ink').trim() || '#fff';
    const style = FAV_STYLE[sk] || 'plain', key = sk + bg + ink + style;
    if (!bg || key === favLast) return;
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
      x.beginPath();
      if (fv.shape === 'circle') x.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2);
      else if (fv.shape === 'square') x.rect(0, 0, N, N);
      else if (fv.shape === 'cut'){ x.moveTo(0, 0); x.lineTo(N - 17, 0); x.lineTo(N, 17); x.lineTo(N, N); x.lineTo(0, N); x.closePath(); }
      else { x.moveTo(r, 0); x.arcTo(N, 0, N, N, r); x.arcTo(N, N, 0, N, r); x.arcTo(0, N, 0, 0, r); x.arcTo(0, 0, N, 0, r); x.closePath(); }
      x.fillStyle = bg; x.fill();
      x.save(); x.clip();
      if (fv.bg) fv.bg(x, N);
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
      } else if (style === 'glitch'){
        /* the letters split into two colours, slightly apart */
        x.globalAlpha = .9; x.drawImage(letters('#ff2e88'), -2, 0); x.drawImage(letters('#00e1ff'), 2, 0); x.globalAlpha = 1;
        x.drawImage(letters(ink), 0, 0);
      } else if (style === 'gloss'){
        /* an app icon: light falling from the top, a gloss over the upper half, the letters pressed in */
        const g = x.createLinearGradient(0, 0, 0, N); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
        x.fillStyle = g; x.fillRect(0, 0, N, N);
        x.drawImage(letters('rgba(0,0,0,.35)'), 0, 1.5); x.drawImage(letters(ink), 0, 0);
        x.beginPath(); x.ellipse(N / 2, -N * .12, N * .78, N * .52, 0, 0, Math.PI * 2);
        const s = x.createLinearGradient(0, 0, 0, N * .4); s.addColorStop(0, 'rgba(255,255,255,.55)'); s.addColorStop(1, 'rgba(255,255,255,.08)');
        x.fillStyle = s; x.fill();
      } else if (style === 'tilt'){
        x.translate(N / 2, N / 2); x.rotate(-0.1); x.scale(.92, .92); x.translate(-N / 2, -N / 2); x.drawImage(letters(ink, 'round'), 0, 0);
      } else x.drawImage(letters(ink, style === 'round' || style === 'pixel' ? style : ''), 0, 0);
      x.restore();
      const url = c.toDataURL('image/png');
      document.querySelectorAll('link[rel~="icon"]').forEach(l => { l.type = 'image/png'; l.href = url; });
      favLast = key;
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

/* ── each theme's icons ─────────────────────────────────────────────
   A theme picks its icons (SKINS ic / is; a custom theme its own). Display →
   Icon colour / Icon style can override them for every theme: tt.iconcolour
   (auto | tile | accent) and tt.iconstyle (auto | icons | emoji). Before
   these existed the two switches were tt.tileicons and tt.gameicons, whose
   defaults were tile and icons, so only someone who picked accent or emoji
   had made a choice; that choice is kept as an override. */
function iconsFor(st){
  const sk = SKINS.find(s => s.id === st.skin) || SKINS[0];
  let colour = sk.ic || 'tile', style = sk.is || 'icons';
  if (st.skin === 'custom'){
    colour = st.custom.iconColour === 'accent' ? 'accent' : 'tile';
    style = st.custom.iconStyle === 'emoji' ? 'emoji' : 'icons';
  }
  const oc = get('tt.iconcolour', null), os = get('tt.iconstyle', null);
  if (oc === 'tile' || oc === 'accent') colour = oc;
  else if (oc == null && get('tt.tileicons', '') === 'accent') colour = 'accent';
  if (os === 'icons' || os === 'emoji') style = os;
  else if (os == null && get('tt.gameicons', '') === 'emoji') style = 'emoji';
  return { colour, style };
}
/* what the Display switches show: auto, or the override (old switches included) */
function iconChoice(){
  const oc = get('tt.iconcolour', null), os = get('tt.iconstyle', null);
  return {
    colour: oc === 'tile' || oc === 'accent' ? oc : (oc == null && get('tt.tileicons', '') === 'accent' ? 'accent' : 'auto'),
    style: os === 'icons' || os === 'emoji' ? os : (os == null && get('tt.gameicons', '') === 'emoji' ? 'emoji' : 'auto')
  };
}
/* a theme's own typefaces, fetched only once someone picks it (the shared
   ones are already linked by every page) */
function skinFont(id){
  try {
    const sk = SKINS.find(s => s.id === id);
    if (!sk || !sk.font) return;
    const href = 'https://fonts.googleapis.com/css2?' + sk.font + '&display=swap';
    if (document.querySelector('link[data-skinfont="' + id + '"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-skinfont', id);
    (document.head || document.documentElement).appendChild(l);
  } catch {}
}

/* Each theme's own stylesheet (/skins/<file>.css). While the page is still
   loading it's written straight into the document, so it's there before the
   first paint. Later (a theme picked in Settings) it's fetched, and the theme
   goes on once it has arrived, so there's no moment of half a look.
   true = ready to wear. */
const skinCssState = {};
let skinWaiting = null;                           // the look asked for while its stylesheet was on the way
function skinCss(id){
  const sk = SKINS.find(s => s.id === id), file = sk && sk.css;
  if (!file || skinCssState[file] === 'ready') return true;
  if (skinCssState[file] === 'loading') return false;
  const href = '/skins/' + file + '.css?v=' + ASSET_V, cs = document.currentScript;
  if (document.readyState === 'loading' && cs && !cs.async && !cs.defer){
    document.write('<link rel="stylesheet" href="' + href + '" data-skincss="' + file + '">');
    skinCssState[file] = 'ready';
    return true;
  }
  skinCssState[file] = 'loading';
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-skincss', file);
  l.onload = l.onerror = () => { skinCssState[file] = 'ready'; const st = skinWaiting; skinWaiting = null; apply(st || undefined); };
  (document.head || document.documentElement).appendChild(l);
  return false;
}
/* fetch every theme's stylesheet ahead (Settings does, as it opens), so picking one is instant */
function warmSkins(){
  try { [...new Set(SKINS.map(s => s.css).filter(Boolean))].forEach(f => { if (!skinCssState[f]) fetch('/skins/' + f + '.css?v=' + ASSET_V).catch(() => {}); }); } catch {}
}

/* ── Animation: the moving backgrounds and the page transitions ───────
   One switch (Settings → Animation; tt.fx on | off). Off also with Reduce
   motion, and by default for anyone whose device asks for less motion.
   html[data-fx] carries it; fx.js and the themes' stylesheets read it. */
function fxOn(){
  if (get(LS.motion, 'normal') === 'reduced') return false;
  const v = get('tt.fx', null);
  if (v === 'off') return false;
  if (v === 'on') return true;
  try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

function apply(state){
  const st = paint(state);
  try { dispatchEvent(new CustomEvent('tt:look')); } catch {}
  return st;
}
function paint(state){
  const st = state || readState();
  const root = document.documentElement;
  if (!skinCss(st.skin)){ skinWaiting = state || null; return st; }   // its stylesheet is on the way: this runs again when it lands
  queueFavicon();

  root.setAttribute('data-skin', st.skin);
  root.setAttribute('data-pg', PG);
  root.setAttribute('data-fx', fxOn() ? 'on' : 'off');
  const ic = iconsFor(st);
  root.setAttribute('data-tileicons', ic.colour);   // icons: a colour each (tile) or the theme's (accent)
  root.setAttribute('data-gameicons', ic.style);    // icons or emoji
  skinFont(st.skin);
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
  if (clouds !== 'off'){ setCloudVars(root); vetClouds(root);
    root.style.setProperty('--cloud-d', '-' + ((Date.now() - cloudT0) / 1000).toFixed(2) + 's'); }     // where the drift has got to
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
    : (SKINS.find(s => s.id === st.skin) || {}).both === false
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

/* ── theme codes: a custom theme as a short line of text to share ─────
   MSC-<base64url>: a version byte, the six colours, the sizes, the font (by
   its place in CUSTOM_FONTS, so that list only ever grows at the end), the
   switches, the four cloud colours when the backdrop is Clouds, and a check
   byte so a mistyped code is caught rather than half-applied. */
const CODE_BACKDROPS = ['solid', 'gradient', 'mesh', 'clouds'], CODE_SHADOWS = ['none', 'soft', 'hard'];
const CODE_COLOURS = ['bg', 'panel', 'text', 'accent', 'line', 'accent2'], CODE_CLOUDS = ['cloud1', 'cloud2', 'cloud3', 'cloud4'];
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0)));
const hexOk = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
function themeCode(c){
  c = Object.assign({}, CUSTOM_DEFAULTS, c || {});
  const b = [1];
  const col = h => { const n = parseInt(hexOk(h) ? h.slice(1) : '000000', 16); b.push(n >> 16 & 255, n >> 8 & 255, n & 255); };
  CODE_COLOURS.forEach(k => col(c[k]));
  const bd = Math.max(0, CODE_BACKDROPS.indexOf(c.backdrop)), sh = Math.max(0, CODE_SHADOWS.indexOf(c.shadow));
  b.push(clampN(c.radius, 0, 26), clampN(c.tint, 0, 70), Math.max(0, CUSTOM_FONTS.indexOf(c.font)), clampN(c.border, 0, 4),
         bd | sh << 2 | (c.glass ? 16 : 0) | (c.iconColour === 'accent' ? 32 : 0) | (c.iconStyle === 'emoji' ? 64 : 0) | (c.cloudAnim ? 128 : 0));
  if (CODE_BACKDROPS[bd] === 'clouds'){ CODE_CLOUDS.forEach(k => col(c[k])); b.push(clampN(c.cloudStrength, 15, 90), clampN(c.cloudSize / 10, 5, 20)); }
  let sum = 7; b.forEach(x => { sum = (sum * 31 + x) & 255; }); b.push(sum);
  return 'MSC-' + btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/* the custom theme in a code, or null if it isn't one */
function parseThemeCode(text){
  try {
    const raw = String(text || '').replace(/\s+/g, '').replace(/^msc-?/i, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!raw || !/^[A-Za-z0-9+/]+$/.test(raw)) return null;
    const bin = atob(raw + '==='.slice((raw.length + 3) % 4)), b = Array.from(bin, ch => ch.charCodeAt(0));
    if (b.length < 25 || b[0] !== 1) return null;
    let sum = 7; b.slice(0, -1).forEach(x => { sum = (sum * 31 + x) & 255; });
    if (sum !== b[b.length - 1]) return null;
    let i = 1;
    const col = () => '#' + [b[i++], b[i++], b[i++]].map(x => x.toString(16).padStart(2, '0')).join('');
    const c = Object.assign({}, CUSTOM_DEFAULTS);
    CODE_COLOURS.forEach(k => { c[k] = col(); });
    c.radius = Math.min(26, b[i++]); c.tint = Math.min(70, b[i++]);
    c.font = CUSTOM_FONTS[b[i++]] || CUSTOM_DEFAULTS.font; c.border = Math.min(4, b[i++]);
    const f = b[i++];
    c.backdrop = CODE_BACKDROPS[f & 3]; c.shadow = CODE_SHADOWS[(f >> 2) & 3] || 'soft';
    c.glass = !!(f & 16); c.iconColour = f & 32 ? 'accent' : 'tile'; c.iconStyle = f & 64 ? 'emoji' : 'icons'; c.cloudAnim = !!(f & 128);
    if (c.backdrop === 'clouds'){
      if (b.length < i + 15) return null;
      CODE_CLOUDS.forEach(k => { c[k] = col(); });
      c.cloudStrength = clampN(b[i++], 15, 90); c.cloudSize = clampN(b[i++], 5, 20) * 10;
    }
    return c;
  } catch { return null; }
}
/* switch to the custom theme from a code. The custom theme it replaces is kept
   (tt.custom_prev) so it can be put back. Gives the theme, or null. */
function useThemeCode(text){
  const c = parseThemeCode(text);
  if (!c) return null;
  const cur = get(LS.custom, null);
  if (cur && themeCode(cur) !== themeCode(c)) set('tt.custom_prev', cur);
  set(LS.custom, c); set(LS.skin, 'custom');
  apply();
  return c;
}

/* The two Settings dialogs (settings.js, index.html) share these two pieces.
   codeBox: the custom theme's "Copy code / Enter a code" row, in el; after()
   runs once a code has changed the theme (to redraw the custom controls). */
function codeBox(el, after){
  if (!el) return;
  const DEF = 'A custom theme as a short code. Copy yours to share it, or enter one you were given.';
  el.innerHTML = '<div class="tcbtns"><button class="btn" type="button" data-a="copy">Copy my theme’s code</button>' +
    '<button class="btn" type="button" data-a="enter">Enter a code</button></div>' +
    '<div class="tcin" hidden><input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Paste a theme code" aria-label="Theme code">' +
    '<button class="btn primary" type="button" data-a="use">Use</button></div><div class="hint tcmsg" aria-live="polite"></div>';
  const q = s => el.querySelector(s), box = q('.tcin'), inp = q('input'), msg = q('.tcmsg');
  const say = (html) => { msg.innerHTML = html || DEF; const u = msg.querySelector('[data-a="undo"]'); if (u) u.onclick = undo; };
  const undo = () => {
    const prev = get('tt.custom_prev', null); if (!prev) return;
    set(LS.custom, Object.assign({}, CUSTOM_DEFAULTS, prev)); set('tt.custom_prev', null);
    apply(); say('Your previous custom theme is back.'); if (after) after();
  };
  /* a code used here or from What's new put a theme aside: offer it back */
  const offerBack = () => get('tt.custom_prev', null) ? ' <button class="flinklike" type="button" data-a="undo">Put back your previous custom theme</button>' : '';
  q('[data-a="copy"]').onclick = () => {
    const code = themeCode(get(LS.custom, {}));
    box.hidden = false; inp.value = code; inp.select();
    const done = () => say('Copied. Anyone can paste it into Enter a code.');
    try { navigator.clipboard.writeText(code).then(done, () => say('Select the code above and copy it.')); }
    catch { say('Select the code above and copy it.'); }
  };
  q('[data-a="enter"]').onclick = () => { box.hidden = false; inp.value = ''; say(''); inp.focus(); };
  const use = () => {
    const c = useThemeCode(inp.value);
    if (!c){ say('That code doesn’t look right. Check it was copied whole.'); return; }
    box.hidden = true;
    say('Theme applied.' + offerBack());
    if (after) after();
  };
  /* run each time the custom controls are shown: the offer appears if a theme was put aside meanwhile */
  el.tcRefresh = () => { if (!msg.innerHTML || msg.innerHTML === DEF) say(offerBack().trim()); };
  el.tcRefresh();
  q('[data-a="use"]').onclick = use;
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter'){ ev.preventDefault(); use(); } });
}
/* fxButtons: the Animation switch (a .modes holder with data-v on / off buttons, and a .hint after it) */
function fxButtons(el, hint){
  if (!el) return;
  const paint = () => {
    const on = fxOn(), reduced = get(LS.motion, 'normal') === 'reduced';
    [...el.children].forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v === 'on') === on)));
    if (hint) hint.textContent = reduced ? 'Off while Reduce motion is on (Accessibility).' : 'Moving backgrounds and page transitions. Off uses less battery.';
  };
  [...el.children].forEach(b => b.onclick = () => { set('tt.fx', b.dataset.v); apply(); paint(); });
  paint();
}
/* origBox: Settings → Custom → Originals. The themes as they were before they
   were rebuilt, in a box of their own at the top of the Custom panel: a tile
   each (its two main colours and its name). With one on, the custom controls
   give way to a way back. after(): redraw the dialog. */
const ORIG_SW = { 'o-paper':['#f7f3e8', '#c2571f'], 'o-swiss':['#ffffff', '#e8112d'], 'o-brutal':['#ffe94a', '#0047ff'], 'o-scifi':['#04070d', '#00e5ff'],
                  'o-terminal':['#05080a', '#39ff9e'], 'o-blueprint':['#07223d', '#7ff0ff'], newsprint:['#f4f1e8', '#8c1c13'], retro:['#008080', '#d4d0c8'] };
function origBox(el, after){
  if (!el) return;
  const cur = readState().skin, legacy = SKINS.filter(s => s.legacy), on = legacy.find(s => s.id === cur);
  el.innerHTML = '<div class="orighd"><b>Originals</b><span>' + (on ? 'You’re using the original ' + on.name + ', exactly as it was.' : 'The themes as they were before the rebuild.') + '</span></div>' +
    '<div class="origgrid">' + legacy.map(s => { const c = ORIG_SW[s.id] || ['#888', '#444'];
      return '<button type="button" class="origtile" data-o="' + s.id + '" aria-pressed="' + (s.id === cur) + '"><i style="background:linear-gradient(135deg,' + c[0] + ' 0 58%,' + c[1] + ' 58%)"></i><span>' + s.name + '</span></button>'; }).join('') + '</div>' +
    (on ? '<button type="button" class="btn origback" data-o="custom">Back to my custom theme</button>' : '');
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { set(LS.skin, b.dataset.o); apply(); if (after) after(); });
}
/* iconButtons: Display's Icon colour and Icon style rows (.modes holders with
   data-v buttons: auto, then the overrides) */
function iconButtons(colEl, styEl){
  const paint = () => {
    const c = iconChoice();
    if (colEl) [...colEl.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === c.colour)));
    if (styEl) [...styEl.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === c.style)));
  };
  if (colEl) [...colEl.children].forEach(b => b.onclick = () => { set('tt.iconcolour', b.dataset.v); apply(); paint(); });
  if (styEl) [...styEl.children].forEach(b => b.onclick = () => { set('tt.iconstyle', b.dataset.v); apply(); paint(); });
  paint();
}

/* Arriving from another page of the site by a link: fx.js left a note as it
   went (sessionStorage tt.nav), so this page can start under the theme's
   cover and play the way in. */
let nav = null;
try {
  const raw = sessionStorage.getItem('tt.nav');
  if (raw){ sessionStorage.removeItem('tt.nav'); const n = JSON.parse(raw); if (n && Date.now() - n.t < 6000) nav = n; }
} catch {}

/* Once, for anyone who was here before the themes were rebuilt (November 2026):
   a small note saying where the old ones are, and, if the theme they wear was
   one of the rebuilt ones, a button to keep the original. Closing it is kept
   with the account (tt.themes2_note). Someone new never sees it. */
function themesNotice(){
  try {
    if (get('tt.themes2_note', 0)) return;
    const had = ['tt.skin', 'tt.creds', 'tt.email', 'tt.cache', 'tt.mode'].some(k => localStorage.getItem(k) !== null);
    if (!had || Date.now() > Date.parse('2027-03-01T00:00:00')){ set('tt.themes2_note', 1); return; }
    if (!document.querySelector('.wrap') || document.querySelector('.ttnote')) return;
    const orig = { paper:'o-paper', swiss:'o-swiss', brutal:'o-brutal', scifi:'o-scifi', terminal:'o-terminal', blueprint:'o-blueprint' }[readState().skin];
    const name = orig ? (SKINS.find(k => k.id === orig) || {}).name : '';
    const n = document.createElement('div'); n.className = 'ttnote'; n.setAttribute('role', 'status');
    n.innerHTML = '<p><b>' + (orig ? name + ' has been rebuilt.' : 'The themes have been rebuilt.') + '</b> ' +
      (orig ? 'The original is' : 'The originals are') + ' still here: Settings → Custom → Originals.</p>' +
      '<div class="ttnotebtns">' + (orig ? '<button type="button" class="btn" data-a="old">Keep the original</button>' : '') + '<button type="button" class="btn primary" data-a="ok">Got it</button></div>';
    const done = () => { set('tt.themes2_note', 1); n.classList.add('out'); setTimeout(() => n.remove(), 280); };
    n.querySelector('[data-a="ok"]').onclick = done;
    const o = n.querySelector('[data-a="old"]');
    if (o) o.onclick = () => { set(LS.skin, orig); set('tt.themes2_note', 1); flushPush(true); setTimeout(() => location.reload(), 120); };
    document.body.appendChild(n);
  } catch {}
}
{ const later = () => setTimeout(themesNotice, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later, { once:true }); else later(); }

/* paint immediately so there is no flash of the wrong theme */
apply();

/* fx.js: the moving backgrounds and the page transitions. Arriving by a link
   with Animation on, it's loaded at once (before the first paint) so the cover
   is seamless; otherwise in its own time. */
(function(){
  const src = '/fx.js?v=' + ASSET_V, cs = document.currentScript, root = document.documentElement;
  if (nav && fxOn() && document.readyState === 'loading' && cs && !cs.async && !cs.defer){
    root.classList.add('fx-in');
    setTimeout(() => root.classList.remove('fx-in'), 1600);      // should fx.js never arrive, the page still shows
    document.write('<script src="' + src + '"><\/script>');
  } else {
    const sc = document.createElement('script'); sc.src = src; sc.async = true;
    (document.head || root).appendChild(sc);
  }
})();

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
  { id:'themes2', date:'2026-11-14', title:'Themes, rebuilt',
    text:'Nine themes rebuilt from the ground up, each with its own layout, its own way between pages and, for some, a moving background ' +
         '(Settings → Animation turns the motion off). New: Skeuomorphism, Y2K Futurism, Vaporwave, Editorial, Art Deco and Maximalism. ' +
         'Sci-fi is now Cyberpunk and Brutal is Neo Brutalism. Prefer an old look? Settings → Custom → Originals. Custom themes can be shared as a code.' },
  { id:'favicons', date:'2026-11-12', title:'Dynamic favicons',
    text:'Website favicons now dynamically update to match your selected theme.' },
  { id:'reactfix', date:'2026-11-12', title:'Reaction leaderboard fixed',
    text:'Reaction times under 80 ms were culled from the leaderboard to fix a bug.', href:'games.html?play=react' },
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

window.TT = { LS, get, set, SKINS, SKIN_IDS, QUICK_SKINS, ASSET_V, PG, nav, fxOn, warmSkins, fxButtons, origBox, iconChoice, themeCode, parseThemeCode, useThemeCode, codeBox, iconButtons,
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
