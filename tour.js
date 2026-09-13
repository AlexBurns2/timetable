/* ═══════════════════════════════════════════════════════════════════
   First-run tutorials.

   A tour is a list of steps. Each step spotlights one element and puts a
   short caption next to it. A step is shown once ever, per person, not per
   device: progress lives in the `onboarding` table (api/onboarding.js) with
   localStorage as the offline mirror, so signing in on a school computer
   doesn't replay everything you have already seen.

   Steps are addressed by id, and ids are merged rather than replaced, so a
   step can be shown from more than one page and still only appear once. That
   is what makes the Settings step work: it is offered on the timetable and on
   the home page, and whichever you reach first retires it for both.

   Usage:
     Tour.run([{ id:'week', target:'#weeklabel', title:'Current week' }, …])
     Tour.mark('settings')        // the user found it on their own
     Tour.seen('settings')        // → boolean (only reliable after Tour.ready)
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";

const LSK = 'onboard.seen';        /* deliberately not a tt.* key: this syncs
                                      through its own table, not through prefs */
const PUSH_AFTER = 600;
const SERVER_WAIT = 2500;          // don't make a new user wait on a slow network

const load = () => { try { const v = JSON.parse(localStorage.getItem(LSK)); return Array.isArray(v) ? v : []; }
                     catch { return []; } };
const save = () => { try { localStorage.setItem(LSK, JSON.stringify([...seen])); } catch {} };

let seen = new Set(load());
let pending = new Set();
let pushTimer = null;
let active = false;

/* "Signed in" means a school login is saved, not merely that a page is open.
   Deliberately not myEmail(), which is whose timetable you are viewing and can
   be set without ever signing in. */
const signedIn = () => {
  if (window.TT && TT.signedIn) return TT.signedIn();
  try { const c = JSON.parse(localStorage.getItem('tt.creds') || 'null');
        return !!(c && c.email && c.password); }
  catch { return false; }
};

async function pull(){
  if (!signedIn()) return;
  try {
    const d = await TT.api('/api/onboarding');
    const before = seen.size;
    (d.seen || []).forEach(s => seen.add(s));
    if (seen.size !== before) save();
    /* anything this device saw while signed out still needs to go up */
    const extra = [...seen].filter(s => !(d.seen || []).includes(s));
    if (extra.length){ extra.forEach(s => pending.add(s)); push(); }
  } catch {}
}
const ready = pull();

function push(){
  if (!signedIn() || !pending.size) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    const batch = [...pending]; pending.clear();
    try { await TT.api('/api/onboarding', { method:'POST', body:{ seen: batch } }); }
    catch { batch.forEach(s => pending.add(s)); }     // try again next time
  }, PUSH_AFTER);
}

function mark(id){
  if (!id || seen.has(id)) return;
  seen.add(id); save(); pending.add(id); push();
}

/* ── styling, injected so a page only has to add one script tag ───────── */
const CSS = `
.tourveil{position:fixed;inset:0;z-index:2147483000;cursor:pointer}
.tourhole{position:absolute;border-radius:10px;pointer-events:none;
  box-shadow:0 0 0 9999px rgba(8,10,16,.58), 0 0 0 2px var(--accent, #3b6ef0) inset;
  transition:top .22s cubic-bezier(.2,.7,.2,1),left .22s cubic-bezier(.2,.7,.2,1),
             width .22s cubic-bezier(.2,.7,.2,1),height .22s cubic-bezier(.2,.7,.2,1)}
.tourtip{position:absolute;max-width:min(300px,calc(100vw - 24px));box-sizing:border-box;
  background:var(--panel,#fff);color:var(--text,#16181d);border:1px solid var(--line,#d9dde5);
  border-radius:var(--card-radius,12px);box-shadow:0 12px 34px rgba(0,0,0,.3);
  padding:13px 15px;pointer-events:none;animation:tourIn .2s cubic-bezier(.2,.7,.2,1)}
@keyframes tourIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.tourtip h4{margin:0 0 3px;font-size:0.9375rem;font-family:var(--font-display,inherit)}
.tourtip p{margin:0;font-size:0.8125rem;line-height:1.5;color:var(--muted,#667)}
.tourbar{display:flex;align-items:center;gap:10px;margin-top:11px;pointer-events:auto}
.tourdots{display:flex;gap:5px;margin-right:auto}
.tourdots i{width:5px;height:5px;border-radius:50%;background:var(--line,#d9dde5)}
.tourdots i.on{background:var(--accent,#3b6ef0)}
.tourskip{background:none;border:0;color:var(--muted,#667);font:inherit;font-size:0.78125rem;cursor:pointer;padding:4px}
.tourskip:hover{color:var(--text,#16181d)}
.tournext{background:var(--accent,#3b6ef0);color:var(--accent-ink,#fff);border:0;font:inherit;
  font-size:0.8125rem;font-weight:700;border-radius:var(--radius,9px);padding:7px 15px;cursor:pointer}
.tourarrow{position:absolute;width:11px;height:11px;background:var(--panel,#fff);
  border:1px solid var(--line,#d9dde5);transform:rotate(45deg);pointer-events:none}
/* the sideways-scroll demo: a ghost pointer gliding across the shelf */
.tourhand{position:absolute;width:26px;height:26px;pointer-events:none;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));animation:tourHand 2.6s ease-in-out infinite}
@keyframes tourHand{
  0%{opacity:0;transform:translateX(0)}
  12%{opacity:1}
  70%{opacity:1;transform:translateX(var(--tour-sweep,-150px))}
  85%,100%{opacity:0;transform:translateX(var(--tour-sweep,-150px))}
}
[data-motion="reduced"] .tourhole{transition:none}
[data-motion="reduced"] .tourtip{animation:none}
[data-motion="reduced"] .tourhand{animation:none;opacity:.9}
`;
let styled = false;
function ensureStyle(){
  if (styled) return; styled = true;
  const s = document.createElement('style'); s.textContent = CSS;
  document.head.appendChild(s);
}

const resolve = t => {
  if (!t) return null;
  const el = typeof t === 'function' ? t() : document.querySelector(t);
  if (!el || !el.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return (r.width || r.height) ? el : null;      // laid out and visible
};

/* ── the sideways-scroll demonstration ─────────────────────────────────
   Nudges the real shelf along and glides a pointer across it, so the hint
   shows the gesture on the actual cards rather than describing it. */
function scrollDemo(row, veil){
  const hand = document.createElement('div');
  hand.className = 'tourhand';
  hand.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5.5 3.2v9.1l-1.6-1.7a1.7 1.7 0 0 0-2.5 2.3l4.4 5.4a6 6 0 0 0 4.7 2.3h3.8a6 6 0 0 0 6-6V8.6a1.6 1.6 0 0 0-3.2 0V7.4a1.6 1.6 0 0 0-3.2 0V6.6a1.6 1.6 0 0 0-3.2 0V3.2a1.6 1.6 0 0 0-3.2 0Z" ' +
    'fill="#fff" stroke="#1b1d22" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  veil.appendChild(hand);

  const r = row.getBoundingClientRect();
  const sweep = Math.min(180, Math.max(90, r.width * 0.32));
  hand.style.setProperty('--tour-sweep', (-sweep) + 'px');
  hand.style.left = (r.left + r.width * 0.62) + 'px';
  hand.style.top  = (r.top + r.height / 2 - 13) + 'px';

  const reduced = document.documentElement.getAttribute('data-motion') === 'reduced';
  if (reduced) return () => hand.remove();

  /* scroll the shelf out and back, in time with the pointer */
  const start = row.scrollLeft, reach = Math.min(sweep, row.scrollWidth - row.clientWidth);
  let t0 = null, raf = 0;
  const ease = x => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
  const frame = now => {
    if (t0 === null) t0 = now;
    const p = ((now - t0) % 2600) / 2600;
    const k = p < .12 ? 0 : p < .70 ? ease((p - .12) / .58) : p < .85 ? 1 : 0;
    row.scrollLeft = start + reach * k;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); row.scrollLeft = start; hand.remove(); };
}

/* ── running a tour ───────────────────────────────────────────────────── */
function present(queue){
  ensureStyle();
  active = true;
  let i = 0, cleanupDemo = null, veil = null, host = null;

  const teardown = () => {
    if (cleanupDemo){ cleanupDemo(); cleanupDemo = null; }
    removeEventListener('resize', place);
    removeEventListener('scroll', place, true);
    removeEventListener('keydown', onKey, true);
    if (veil) veil.remove();
    veil = null; active = false;
  };
  const skipAll = () => { queue.slice(i).forEach(s => mark(s.id)); teardown(); };
  const next = () => { mark(queue[i].id); i++; step(); };
  const onKey = e => {
    if (!veil) return;
    if (e.key === 'Escape'){ e.preventDefault(); skipAll(); }
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight'){ e.preventDefault(); next(); }
  };

  function build(inDialog){
    const parent = inDialog || document.body;
    if (veil && host === parent) return;
    if (veil) veil.remove();
    host = parent;
    veil = document.createElement('div');
    veil.className = 'tourveil';
    veil.innerHTML = '<div class="tourhole"></div><div class="tourarrow"></div>' +
      '<div class="tourtip"><h4></h4><p></p><div class="tourbar">' +
        '<span class="tourdots"></span>' +
        '<button type="button" class="tourskip">Skip</button>' +
        '<button type="button" class="tournext"></button></div></div>';
    parent.appendChild(veil);
    veil.addEventListener('click', e => {
      if (e.target.closest('.tourskip')) return skipAll();
      next();                                   // a tap anywhere moves on
    });
  }

  let curEl = null;
  function place(){
    if (!veil || !curEl) return;
    const r = curEl.getBoundingClientRect(), pad = 7;
    const hole = veil.querySelector('.tourhole');
    hole.style.top = (r.top - pad) + 'px';
    hole.style.left = (r.left - pad) + 'px';
    hole.style.width = (r.width + pad*2) + 'px';
    hole.style.height = (r.height + pad*2) + 'px';

    const tip = veil.querySelector('.tourtip'), arrow = veil.querySelector('.tourarrow');
    const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 14;
    const below = r.bottom + gap + th <= innerHeight - 10;
    const top = below ? r.bottom + gap : Math.max(10, r.top - gap - th);
    let left = r.left + r.width/2 - tw/2;
    left = Math.max(12, Math.min(left, innerWidth - tw - 12));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';

    const ax = Math.max(left + 14, Math.min(r.left + r.width/2 - 5.5, left + tw - 25));
    arrow.style.left = ax + 'px';
    arrow.style.top = (below ? top - 6 : top + th - 5) + 'px';
    arrow.style.clipPath = below ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(100% 0, 100% 100%, 0 100%)';
  }

  function step(){
    if (cleanupDemo){ cleanupDemo(); cleanupDemo = null; }
    if (i >= queue.length) return teardown();
    const s = queue[i];
    const el = resolve(s.target);
    if (!el){ i++; return step(); }              // not on screen: leave it for next time

    build(el.closest('dialog[open]'));
    curEl = el;
    if (el.scrollIntoView){
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block:'center', behavior:'auto' });
    }
    const val = v => (typeof v === 'function' ? v() : v) || '';
    veil.querySelector('.tourtip h4').textContent = val(s.title);
    const p = veil.querySelector('.tourtip p'), body = val(s.text);
    p.textContent = body;
    p.hidden = !body;
    veil.querySelector('.tournext').textContent = i === queue.length - 1 ? 'Got it' : 'Next';
    veil.querySelector('.tourskip').hidden = queue.length < 2;
    veil.querySelector('.tourdots').innerHTML =
      queue.length > 1 ? queue.map((_, n) => '<i class="' + (n === i ? 'on' : '') + '"></i>').join('') : '';

    place();
    requestAnimationFrame(place);                // again once fonts/layout settle
    if (s.demo === 'scroll') cleanupDemo = scrollDemo(el, veil);
  }

  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  addEventListener('keydown', onKey, true);
  step();
}

async function run(steps){
  /* Nothing is shown to a signed-out visitor. On the timetable that would mean
     captioning a login screen, and everywhere else the progress would be
     recorded against nobody, since the table is keyed by email. */
  if (active || !signedIn()) return;
  const wanted = (steps || []).filter(s => s && s.id && !seen.has(s.id));
  if (!wanted.length) return;
  /* wait for the server's copy first, so a step you finished on your phone
     doesn't play again here — but never hang on a bad connection */
  await Promise.race([ready, new Promise(r => setTimeout(r, SERVER_WAIT))]);
  const queue = wanted.filter(s => !seen.has(s.id));
  if (!queue.length || active || !signedIn()) return;
  if (document.readyState === 'loading')
    await new Promise(r => addEventListener('DOMContentLoaded', r, { once:true }));
  present(queue);
}

addEventListener('pagehide', () => {
  if (pushTimer){ clearTimeout(pushTimer); pushTimer = null; }
});

/* ── the tours themselves ──────────────────────────────────────────────
   Written once here rather than at each call site, because the Settings step
   is offered from two different pages and the wording has to match. */
const SETTINGS_TEXT = 'Change how the site looks and works. Your settings follow you to other devices.';
const TOURS = {
  timetable: [
    { id:'email',      target:'.idrow',      title:'Anyone’s timetable',
      text:'Enter an email address to see whose classes you like.' },
    { id:'week',       target:'#weeklabel',  title:'Current week' },
    { id:'weekarrows', target:'.weekswitch', title:'Click to switch week' },
    { id:'settings',   target:'#settings',   title:'Settings', text:SETTINGS_TEXT },
    { id:'home',       target:'#homebtn',    title:'Home',
      text:'Notes, revision, your calendar and the rest of the site.' }
  ],
  /* both settings dialogs use these ids, so one tour covers both pages */
  settings: [
    { id:'appearance',    target:'#skins, #s_skins', title:'Pick an appearance',
      text:'Every page follows whichever one you choose.' },
    { id:'settings-more', target:'#moresettings',    title:'More settings',
      text:() => document.querySelector('#openColours')
        ? 'Accessibility, display, and the colour each subject gets.'
        : 'Accessibility and display options.' }
  ],
  home: [
    { id:'settings', target:'#themebtn', title:'Settings', text:SETTINGS_TEXT }
  ],
  games: [
    { id:'games-scroll', target:'.gamerow', title:'More this way',
      text:'Drag the row sideways, or scroll.', demo:'scroll' }
  ]
};

window.Tour = {
  run, mark, ready,
  start: name => run(TOURS[name] || []),
  seen: id => seen.has(id),
  all: () => [...seen]
};
})();
