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
  { id:'classic',   name:'Classic',   both:true,
    swatch:'linear-gradient(160deg,#dfe7f2,#f4f7fb 60%),radial-gradient(circle at 78% 22%,#0a84ff55,transparent 60%)' },
  { id:'plain',     name:'Plain',     both:true, border:'#e5e5e8',
    swatch:'linear-gradient(#fff,#fff)' },
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
const QUICK_SKINS = ['classic','plain','custom'];

const CUSTOM_FONTS = ['DM Sans','Space Grotesk','JetBrains Mono','Space Mono',
                      'Instrument Serif','Caveat','Patrick Hand','Archivo Black'];
const CUSTOM_DEFAULTS = { bg:'#f2f4f8', panel:'#ffffff', text:'#16181d',
                          accent:'#6d4aff', line:'#d9dde5',
                          radius:12, tint:22, font:'DM Sans',
                          glass:false, backdrop:'solid', shadow:'soft',
                          border:1, accent2:'#00c2c7' };

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
  let skin = get(LS.skin, 'classic');
  if (SKIN_IDS.indexOf(skin) === -1) skin = 'classic';
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

function apply(state){
  const st = state || readState();
  const root = document.documentElement;

  root.setAttribute('data-skin', st.skin);
  root.setAttribute('data-mode', st.mode);
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

window.TT = { LS, get, set, SKINS, SKIN_IDS, QUICK_SKINS,
              CUSTOM_FONTS, CUSTOM_DEFAULTS, inkFor, readState, apply,
              apiGet, myEmail, EMAIL_DOMAIN, syncPull, syncPush };

/* returning users: pull the server copy on load */
if (hasCreds()) syncPull();
})();
