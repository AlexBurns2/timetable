const $ = id => document.getElementById(id);

/* ── game sound & animation ─────────────────────────────────────────
   Synthesised Web-Audio blips — no audio files. Sound defaults OFF,
   volume in tt.gamevol (0–1). Animations honour reduce-motion. Tap the
   header button to mute/unmute; hold it for a volume slider. */
const SFX = (() => {
  let ctx = null;
  const on  = () => TT.get('tt.gamesfx', false);
  const vol = () => { let v = +TT.get('tt.gamevol', 0.7); return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7; };
  const ac = () => { if (!on() || vol() <= 0) return null;
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; } };
  function tone(freq, dur, type = 'sine', gain = 0.15, when = 0){
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + when, g0 = Math.max(0.0001, gain * vol());
    g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  }
  const seq = (notes, type = 'triangle') => notes.forEach(([f, w]) => tone(f, 0.13, type, 0.17, w));
  return {
    move:  () => tone(200, 0.05, 'square', 0.09),
    place: () => tone(150, 0.09, 'square', 0.14),
    good:  () => { tone(523, 0.08, 'sine', 0.17); tone(784, 0.10, 'sine', 0.17, 0.06); },
    bad:   () => tone(150, 0.22, 'sawtooth', 0.15),
    /* The note CYCLES through a pentatonic scale rather than climbing away, so it
       never turns shrill however long the streak runs. What grows instead is the
       texture: every five correct adds another voice — a fifth, then a root
       underneath, an octave shimmer, a major third to complete the chord, and
       finally a sub-bass — so it keeps getting richer indefinitely. Every tenth
       gets a short rising flourish on top. */
    streak: n => {
      n = Math.max(1, n);
      const PENT = [523.25, 587.33, 659.25, 783.99, 880.00];   // C D E G A
      const f = PENT[(n - 1) % PENT.length];
      const tier = Math.min(Math.floor((n - 1) / PENT.length), 5);
      tone(f, 0.09 + tier * 0.012, 'sine', 0.17);
      if (tier >= 1) tone(f * 1.5, 0.11, 'sine',     0.10, 0.045);  // a fifth above
      if (tier >= 2) tone(f / 2,   0.17, 'triangle', 0.12);         // root underneath
      if (tier >= 3) tone(f * 2,   0.13, 'triangle', 0.06, 0.085);  // octave shimmer
      if (tier >= 4) tone(f * 1.25,0.12, 'sine',     0.07, 0.02);   // major third
      if (tier >= 5) tone(f / 4,   0.24, 'sine',     0.09);         // sub-bass
      if (n % 10 === 0) seq([[f,0.10],[f*1.25,0.17],[f*1.5,0.24],[f*2,0.31]], 'triangle');
    },
    /* losing a good streak — power draining away */
    discharge: () => { seq([[392,0],[330,0.10],[262,0.21],[196,0.33]], 'sawtooth');
      tone(98, 0.45, 'sine', 0.10, 0.30); },
    win:   () => seq([[523,0],[659,0.09],[784,0.18],[1047,0.28]]),
    lose:  () => seq([[440,0],[349,0.1],[262,0.22]], 'sawtooth'),
    tick:  () => tone(900, 0.04, 'sine', 0.09),
    flip:  () => tone(430, 0.05, 'sine', 0.12),
    clear: () => seq([[660,0],[880,0.06]], 'triangle'),
    /* tetris flavour */
    rotate:() => tone(340, 0.05, 'triangle', 0.10),
    drop:  () => { tone(120, 0.10, 'sawtooth', 0.16); tone(70, 0.12, 'sine', 0.12, 0.01); },
    lock:  () => tone(180, 0.06, 'square', 0.10),
    hold:  () => tone(520, 0.06, 'sine', 0.11),
    line:  n => { const notes=[[523,0],[659,0.05],[784,0.10]].slice(0, Math.min(3, n)); seq(notes); },
    tetris:() => seq([[523,0],[659,0.07],[784,0.14],[1047,0.21],[1319,0.30]]),
    level: () => tone(880, 0.06, 'triangle', 0.10)
  };
})();
const gameAnim = () => TT.get('tt.gameanim', true) && !reduced();
(function initSound(){
  const b = $('sfx'), pop = $('volpop'), sl = $('volsl'), wrap = $('volwrap');
  if (!b || !sl) return;
  const icon = () => { const on = TT.get('tt.gamesfx', false), v = +TT.get('tt.gamevol', 0.7);
    b.textContent = !on ? '🔇' : (v < 0.34 ? '🔈' : v < 0.67 ? '🔉' : '🔊');
    b.setAttribute('aria-pressed', String(on)); };
  sl.value = Math.round((+TT.get('tt.gamevol', 0.7)) * 100);
  let held = false, timer = null;
  const open = () => { held = true; pop.hidden = false; };
  const cancel = () => { if (timer){ clearTimeout(timer); timer = null; } };
  b.addEventListener('pointerdown', () => { held = false; cancel(); timer = setTimeout(open, 300); });
  b.addEventListener('pointerup', () => { cancel(); if (held) return;    // a hold opened the slider
    TT.set('tt.gamesfx', !TT.get('tt.gamesfx', false)); icon(); if (TT.get('tt.gamesfx', false)) SFX.flip(); });
  b.addEventListener('pointercancel', cancel);
  sl.addEventListener('input', () => { const v = +sl.value / 100; TT.set('tt.gamevol', v);
    if (v > 0 && !TT.get('tt.gamesfx', false)) TT.set('tt.gamesfx', true); icon(); SFX.tick(); });
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !wrap.contains(e.target)) pop.hidden = true; });
  icon();
})();
/* the Admin button appears only for the owner (server says canWipe) */
let isAdmin = false;
(async function initAdmin(){
  if (!TT.myEmail() || !$('admin')) return;
  try { const d = await TT.api('/api/leaderboard', { params:{ game:'chain', metric:'targets', week:tetrisWeek() } });
    if (d && d.canWipe){ isAdmin = true; const a = $('admin'); if (a){ a.hidden = false; a.onclick = () => openGame('admin'); } }
  } catch(e){}
})();

/* every game returns a cleanup fn so switching never leaves a timer running */
/* Phones and tablets get on-screen controls and "tap" wording. A laptop with a
   touchscreen still has a mouse as its main pointer, so it keeps the desktop
   version exactly as it was. */
const TOUCH = (() => { try { return matchMedia('(hover: none) and (pointer: coarse)').matches; } catch { return false; } })();
const tap = (desktop, touch) => TOUCH ? touch : desktop;
/* swipe detection for a board: calls fn('l'|'r'|'u'|'d') once per swipe, or on
   every `step` pixels of travel when `repeat` is set (Snake turns mid-swipe) */
function onSwipe(el, fn, { step = 26, repeat = false, tapFn = null } = {}){
  let sx = 0, sy = 0, t0 = 0, active = false, fired = false;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return;
    active = true; fired = false; sx = e.clientX; sy = e.clientY; t0 = Date.now(); });
  el.addEventListener('pointermove', e => {
    if (!active || (fired && !repeat)) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < step) return;
    fn(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'l' : 'r') : (dy < 0 ? 'u' : 'd'));
    fired = true; sx = e.clientX; sy = e.clientY;
  });
  const end = e => { if (!active) return; active = false;
    if (!fired && tapFn && e.type === 'pointerup' && Date.now() - t0 < 350 &&
        Math.hypot(e.clientX - sx, e.clientY - sy) < 12) tapFn(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
/* a row of hold-able on-screen buttons: down(act) on press, up(act) on release */
function wirePad(pad, down, up){
  if (!pad) return;
  pad.querySelectorAll('button[data-act]').forEach(b => {
    const act = b.dataset.act; let held = false;
    b.addEventListener('pointerdown', e => { e.preventDefault(); held = true; b.classList.add('on');
      try { b.setPointerCapture(e.pointerId); } catch {}
      down(act); });
    const release = () => { if (!held) return; held = false; b.classList.remove('on'); if (up) up(act); };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}

let stop = null;
const GAMES = [
  { id:'flashcards', cat:'Revision', ico:'🗂️', name:'Flashcards', blurb:'Make, share and study decks' },
  { id:'maths',   cat:'Revision', ico:'➗', name:'Maths', blurb:'Differentiation, integration, combinatorics, graphs' },
  { id:'physics', cat:'Revision', ico:'🔭', name:'Physics', blurb:'Kinematics, dynamics, waves, electricity' },
  { id:'chem',    cat:'Revision', ico:'⚗️', name:'Chemistry', blurb:'Bonding, moles, reactions, energy' },
  { id:'engineering', cat:'Revision', ico:'🔧', name:'Engineering', blurb:'Steels, heat treatment, levers, gears and mechanics' },
  { id:'software', cat:'Revision', ico:'💻', name:'Software', blurb:'Read code and write it' },
  { id:'dailyguess', cat:'Timetable', ico:'📅', name:'Daily Guess Who', blurb:'One mystery student a day, same for your whole year' },
  { id:'guesswho', cat:'Timetable', ico:'🕵️', name:'Guess Who', blurb:'Guess the mystery classmate, grade or teacher' },
  { id:'classroom', cat:'Timetable', ico:'🚪', name:'Classroom', blurb:'Rooms, teachers and classes from your timetable' },
  { id:'chain',  cat:'Timetable', ico:'🔗', name:'Six Degrees', blurb:'Chain classmate to classmate through shared classes' },
  { id:'oddone', cat:'Timetable', ico:'🧠', name:'Odd One Out', blurb:'Three share a class of yours, one doesn’t' },
  { id:'tetris', cat:'Arcade', ico:'🟦', name:'Tetris', blurb:'Sprint, Survival, Zen and Practice' },
  { id:'snake',  cat:'Arcade', ico:'🐍', name:'Snake', blurb:'Eat the dot, don’t bite yourself' },
  { id:'g2048',  cat:'Arcade', ico:'🧩', name:'2048', blurb:'Slide and merge to the big number' },
  { id:'memory', cat:'Arcade', ico:'🃏', name:'Memory', blurb:'Match every pair in the fewest moves' },
  { id:'mines',  cat:'Arcade', ico:'💣', name:'Minesweeper', blurb:'Clear the board, flag the mines' },
  { id:'typing', cat:'Arcade', ico:'⌨️', name:'Typing race', blurb:'How fast can you type it?' },
  { id:'react',  cat:'Arcade', ico:'🎯', name:'Reaction', blurb:tap('Click', 'Tap') + ' the moment it turns green' }
];
const CAT_ORDER = ['Timetable', 'Arcade'];

/* This file runs both pages. games.html gets the side-scrolling shelves;
   revision.html gets every subject on screen at once, because when you sit
   down to revise you want to pick a subject, not go hunting for one. */
const PAGE = document.body.dataset.page || 'games';
const REVISION_PAGE = PAGE === 'revision';

function gameCard(g, i){
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'gamecard';
  c.style.animationDelay = (i * 45) + 'ms';
  const stat = statLine(g.id);
  c.innerHTML = '<span class="ico">' + g.ico + '</span>' +
    '<h2>' + g.name + '</h2><p>' + g.blurb + '</p>' +
    (stat ? '<span class="stat">' + stat + '</span>' : '') +
    '<span class="go">' + (REVISION_PAGE ? 'Start' : 'Play') + ' &#8594;</span>';
  c.onclick = () => openGame(g.id);
  return c;
}

function showGrid(){
  if (stop){ stop(); stop = null; }
  lbState = null; lbSeq++;
  $('gamestage').hidden = true;
  const grid = $('gamegrid');
  grid.hidden = false;
  grid.innerHTML = '';

  if (REVISION_PAGE){
    const box = document.createElement('div'); box.className = 'gamegrid';
    GAMES.filter(g => g.cat === 'Revision').forEach((g, i) => box.appendChild(gameCard(g, i)));
    grid.appendChild(box);
    return;
  }

  CAT_ORDER.forEach(cat => {
    const inCat = GAMES.filter(g => g.cat === cat);
    if (!inCat.length) return;
    const h = document.createElement('div'); h.className = 'cathd'; h.textContent = cat;
    grid.appendChild(h);
    const wrap = document.createElement('div'); wrap.className = 'gamesecrow';
    const row = document.createElement('div'); row.className = 'gamerow';
    inCat.forEach((g, i) => row.appendChild(gameCard(g, i)));
    wrap.appendChild(row); grid.appendChild(wrap);
    dragScroll(row);
  });
  renderLBSum();
  scrollHint();
}

/* The shelves scroll sideways, which is not obvious from a still screen, so
   the first visit gets one demonstration on the real cards. Only worth showing
   if there is actually something off the right-hand edge. */
function scrollHint(){
  if (!window.Tour) return;
  requestAnimationFrame(() => {
    const row = document.querySelector('.gamerow');
    if (row && row.scrollWidth > row.clientWidth + 40) Tour.start('games');
  });
}
/* mouse-wheel and click-drag horizontal scrolling for a card row (touch uses
   the browser's own horizontal scroll; a drag swallows the click that follows). */
function dragScroll(row){
  row.addEventListener('wheel', e => {
    if (row.scrollWidth <= row.clientWidth) return;
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (d){ row.scrollLeft += d; e.preventDefault(); }
  }, { passive:false });
  let down = false, moved = false, sx = 0, sl = 0;
  row.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true; moved = false; sx = e.clientX; sl = row.scrollLeft; });
  row.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx;
    if (Math.abs(dx) > 6){ moved = true; row.classList.add('dragging'); }
    if (moved){ row.scrollLeft = sl - dx; e.preventDefault(); } });
  const end = () => { if (!down) return; down = false; row.classList.remove('dragging');
    if (moved){ row.classList.add('nodrag'); setTimeout(() => row.classList.remove('nodrag'), 0); } };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointerleave', end);
  row.addEventListener('click', e => { if (row.classList.contains('nodrag')){ e.stopPropagation(); e.preventDefault(); } }, true);
}

/* ── leaderboard catalogue (shared by the summary strip + the full view) ── */
const LB_CAT = [
  { id:'chain',     name:'Six Degrees',    g:{metric:'targets'}, fmt:v=>String(v) },
  { id:'oddone',    name:'Odd One Out',    g:{metric:'high'},    fmt:v=>String(v) },
  { id:'classroom', name:'Classroom',      g:{metric:'high'},    fmt:v=>String(v) },
  { id:'snake',     name:'Snake',          g:{metric:'high'},    fmt:v=>String(v) },
  { id:'g2048',     name:'2048',           g:{metric:'high'},    fmt:v=>String(v) },
  { id:'typing',    name:'Typing race',    g:{metric:'wpm'},     fmt:v=>v+' wpm' },
  { id:'react',     name:'Reaction',       g:{metric:'fastest'}, fmt:v=>v+' ms' },
  { id:'tsprint',   name:'Tetris Sprint',  t:'sprint',   fmt:v=>fmtHMS(v) },
  { id:'tsurv',     name:'Tetris Survival',t:'zen',      fmt:v=>fmtHMS(v) },
  { id:'tzen',      name:'Tetris Zen',     t:'zenscore', fmt:v=>String(v) }
];
let lbFocus = null;          // which board the full view should open on
let lbSumCache = null;       // cached leaders for the summary strip (per session)
async function fetchLeaders(){
  if (lbSumCache) return lbSumCache;
  const wk = tetrisWeek();
  lbSumCache = await Promise.all(LB_CAT.map(async cat => {
    try {
      if (cat.g){ const d = await TT.api('/api/leaderboard', { params:{ game:cat.id, metric:cat.g.metric, week:wk } });
        const r = (d.all.top||[])[0]; return r ? { who:r.name, val:cat.fmt(r.score) } : null; }
      if (cat.t==='sprint'){   const d = await TT.api('/api/tetris',{params:{mode:'sprintall'}}); const r=(d.top||[])[0]; return r?{who:r.name,val:cat.fmt(r.time_ms)}:null; }
      if (cat.t==='zen'){      const d = await TT.api('/api/tetris',{params:{mode:'zen'}});       const r=(d.top||[])[0]; return r?{who:r.name,val:cat.fmt(r.time_ms)}:null; }
      if (cat.t==='zenscore'){ const d = await TT.api('/api/tetris',{params:{mode:'zenscore'}});  const r=(d.top||[])[0]; return r?{who:r.name,val:cat.fmt(r.best)}:null; }
    } catch(e){ return null; }
    return null;
  }));
  return lbSumCache;
}
async function renderLBSum(){
  const el = $('lbsum'); if (!el) return;
  el.hidden = false;
  if (!TT.myEmail()){ el.innerHTML = '<div class="lbsumhd"><h2>Leaderboards</h2></div><p class="how">Sign in on the timetable to see the leaderboards.</p>'; return; }
  el.innerHTML = '<div class="lbsumhd"><h2>Leaderboards</h2><a id="lbsumall">View all →</a></div><p class="how">Loading leaders…</p>';
  $('lbsumall').onclick = () => { lbFocus = null; openGame('leaderboards'); };
  const leaders = await fetchLeaders();
  if ($('gamegrid').hidden) return;               // user already opened a game
  const cards = LB_CAT.map((cat,i) => { const L = leaders[i];
    return '<button class="lbsumcard" data-i="'+i+'"><div class="g">'+esc(cat.name)+'</div>' +
      (L ? '<div class="lead"><span class="who">'+esc(L.who)+'</span><span class="val">'+esc(L.val)+'</span></div>'
         : '<div class="empty">No scores yet</div>') + '</button>'; }).join('');
  el.innerHTML = '<div class="lbsumhd"><h2>Leaderboards</h2><a id="lbsumall">View all →</a></div><div class="lbsumgrid">'+cards+'</div>';
  $('lbsumall').onclick = () => { lbFocus = null; openGame('leaderboards'); };
  [...el.querySelectorAll('.lbsumcard')].forEach(c => c.onclick = () => { lbFocus = LB_CAT[+c.dataset.i].id; openGame('leaderboards'); });
}
const reduced = () => document.documentElement.getAttribute('data-motion') === 'reduced';
function openGame(id){
  if (stop){ stop(); stop = null; }
  const grid = $('gamegrid'), st = $('gamestage');
  const go = () => {
    grid.hidden = true; grid.classList.remove('leaving');
    $('lbsum').hidden = true;
    st.hidden = false;
    st.style.animation = 'none'; void st.offsetWidth; st.style.animation = '';
    stop = BUILD[id]($('stage'));
    lbState = null; lbSeq++;
    if (LB_GAMES[id]) mountLB(id);
  };
  if (reduced()){ go(); return; }
  grid.classList.add('leaving');           /* fade the grid away, then swap in */
  setTimeout(go, 130);
}
$('back').onclick = () => {
  const grid = $('gamegrid'), st = $('gamestage');
  if (stop){ stop(); stop = null; }
  if (reduced()){ showGrid(); return; }
  st.classList.add('leaving');
  setTimeout(() => { st.classList.remove('leaving'); showGrid(); }, 130);
};

const head = (host, title, how, extra) =>
  host.innerHTML = '<div class="row"><div><h2>' + title + '</h2>' +
                   '<p class="how">' + how + '</p></div>' +
                   '<span class="score" id="sc"></span></div>' + (extra || '');

const BUILD = {};

/* ── Guess Who ─────────────────────────────────────────────────────
   Picks a random person from your combined classmates and drips hints
   (shared classes, year, name shape, letters). No privacy concern — it
   only ever names people already in a class with you.                 */
let gwData = null;              /* {pool, viewer} cached across opens this session */
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ── local stats / high scores (item 6) ──────────────────────────────
   recordStat updates a per-game record; mode 'max' keeps the highest,
   'min' the lowest, 'count' increments. statVal reads one back. */
function allStats(){ return TT.get('tt.stats', {}); }
function recordStat(game, { key, mode, value }){
  const s = allStats(); s[game] = s[game] || {};
  const cur = s[game][key];
  if (mode === 'max') s[game][key] = cur == null ? value : Math.max(cur, value);
  else if (mode === 'min') s[game][key] = cur == null ? value : Math.min(cur, value);
  else if (mode === 'count') s[game][key] = (cur || 0) + (value || 1);
  else s[game][key] = value;
  TT.set('tt.stats', s);
  const lb = LB_GAMES[game];      // a score good enough for the shared board goes to it
  if (lb && key === lb.metric && (mode === 'max' || mode === 'min')) lbConsider(game, value, s[game][key] === value);
  return s[game][key];
}
const statVal = (game, key) => { const s = allStats()[game]; return s ? s[key] : undefined; };
const statLine = game => {
  const s = allStats()[game]; if (!s) return '';
  if (game === 'tetris')                       // weekly best, hidden once the week rolls over
    return (s.week === tetrisWeek() && s.best != null) ? 'Best this week ' + fmtHMS(s.best*1000) : '';
  return Object.entries(s).map(([k,v]) => STAT_LABEL[k] ? STAT_LABEL[k]+' '+v : '').filter(Boolean).join(' · ');
};
const STAT_LABEL = { best:'Best', high:'High', fastest:'Fastest', plays:'Played', wpm:'Top WPM', cleared:'Cleared', streak:'Streak', targets:'Best run' };

/* Monday-anchored week index (local time); drives Tetris's weekly reset */
function tetrisWeek(){
  const n = new Date();
  const day = Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(2024,0,1)) / 86400000);
  return Math.floor(day / 7);   // 2024-01-01 was a Monday
}

/* milliseconds → HH:MM:SS.d (tenths kept so sprint times stay precise) */
function fmtHMS(ms){
  const total = Math.max(0, +ms||0);
  const t = Math.floor(total/1000), p = n => String(n).padStart(2,'0');
  return p(Math.floor(t/3600))+':'+p(Math.floor((t%3600)/60))+':'+p(t%60)+'.'+Math.floor((total%1000)/100);
}

/* ── shared game leaderboards ─────────────────────────────────────────
   Each of these games gets both an all-time ("unlimited") board and a
   this-week board, keyed by the metric a new personal best is recorded on.
   recordStat submits automatically; the panel is mounted by openGame. */
const LB_GAMES = {
  snake:     { metric:'high',    dir:'max', label:'High score',      fmt:v=>String(v) },
  g2048:     { metric:'high',    dir:'max', label:'Score',           fmt:v=>String(v) },
  typing:    { metric:'wpm',     dir:'max', label:'Words / min',     fmt:v=>v+' wpm' },
  react:     { metric:'fastest', dir:'min', label:'Reaction',        fmt:v=>v+' ms' },
  classroom: { metric:'high',    dir:'max', label:'Correct',         fmt:v=>String(v) },
  chain:     { metric:'targets', dir:'max', label:'Targets reached', fmt:v=>String(v) },
  oddone:    { metric:'high',    dir:'max', label:'Best score',      fmt:v=>String(v) }
};
/* ── site-wide settings (api/_settings.js) ────────────────────────────
   Set by the owner on the moderator page and stored on the server, so they
   apply to everyone whoever opens the site. Weekly boards can be turned off
   when there isn't the traffic for them: every page then shows the all-time
   board only, with no weekly / all-time toggle. Read once per page load, and
   if the read fails nothing changes from how the site behaved before. */
let sitePromise = null, siteCfg = { weeklyBoards:true };
function siteSettings(){
  if (!sitePromise) sitePromise = TT.api('/api/leaderboard', { params:{ settings:1 } })
    .then(d => { siteCfg = { weeklyBoards: d && d.weeklyBoards !== false }; return siteCfg; })
    .catch(() => siteCfg);
  return sitePromise;
}
const weeklyOn = () => siteCfg.weeklyBoards;
const forgetSiteSettings = () => { sitePromise = null; };
if (typeof TT !== 'undefined' && TT.myEmail && TT.myEmail()) siteSettings();   // warm before a board is opened

let lbSeq = 0;        // bumped whenever the stage changes, so a slow mount can't land on the wrong game
let lbState = null;   // { game, period, week, all, canWipe } for the mounted panel

/* What the server holds for you on each board: { week, all } (null = no score
   there). A score is sent when it beats either one, not just when it beats the
   personal best saved in your settings. Going only by that saved best meant
   that once a moderator deleted someone's score, nothing they scored below the
   deleted one was ever sent again, which worked like a permanent ban. It also
   left the weekly board empty until you beat your all-time best. */
const lbBest = {}, lbKnowing = {}, lbFlight = {};
const lbBetter = (game, v, cur) => cur == null || (LB_GAMES[game].dir === 'max' ? v > cur : v < cur);
function lbRemember(game, d){ if (d && d.week && d.all) lbBest[game] = { wk:tetrisWeek(), week:d.week.meBest, all:d.all.meBest }; }
/* the server's copy, fetched once per page if the game's panel hasn't loaded it yet */
function lbKnow(game){
  if (lbBest[game] && lbBest[game].wk === tetrisWeek()) return Promise.resolve(lbBest[game]);   // a new week means a new weekly board
  if (!lbKnowing[game]) lbKnowing[game] = TT.api('/api/leaderboard', { params:{ game, metric:LB_GAMES[game].metric, week:tetrisWeek() } })
    .then(d => { lbRemember(game, d); return lbBest[game] || null; })
    .catch(() => null)
    .finally(() => { lbKnowing[game] = null; });
  return lbKnowing[game];
}
async function lbConsider(game, value, newPersonalBest){
  if (!TT.myEmail() || !LB_GAMES[game]) return;
  if (newPersonalBest) return lbSubmit(game, value);
  const b = await lbKnow(game);
  if (b && (lbBetter(game, value, b.week) || lbBetter(game, value, b.all))) lbSubmit(game, value);
}
async function lbSubmit(game, score){
  if (!TT.myEmail()) return;
  const lb = LB_GAMES[game]; if (!lb) return;
  /* 2048 and Odd One Out record a new score on every merge or answer: while one
     is being sent, keep only the best of the rest and send that afterwards */
  const f = lbFlight[game] || (lbFlight[game] = { busy:false, next:null });
  if (f.busy){ if (f.next == null || lbBetter(game, score, f.next)) f.next = score; return; }
  f.busy = true;
  try {
    const d = await TT.api('/api/leaderboard', { method:'POST', body:{ game, metric:lb.metric, score, week:tetrisWeek() } });
    lbSumCache = null;   // summary strip is now stale
    lbRemember(game, d);
    if (lbState && lbState.game === game){ lbState.week = d.week; lbState.all = d.all; paintLB(); }
  } catch(e){}
  f.busy = false;
  if (f.next != null){ const n = f.next; f.next = null;
    const b = lbBest[game];
    if (!b || b.wk !== tetrisWeek() || lbBetter(game, n, b.week) || lbBetter(game, n, b.all)) lbSubmit(game, n); }
}
async function mountLB(game){
  const lb = LB_GAMES[game]; if (!lb) return;
  const seq = lbSeq;
  await siteSettings();
  if (seq !== lbSeq) return;                       // the player has already moved on
  const weekly = weeklyOn();
  const panel = document.createElement('div');
  panel.className = 'glb'; panel.id = 'glb';
  panel.innerHTML =
    '<div class="glbhd"><h3>Leaderboard · '+esc(lb.label)+'</h3>' +
    (weekly ? '<div class="glbtabs"><button type="button" class="glbtab cur" data-p="week">This week</button>' +
    '<button type="button" class="glbtab" data-p="all">All time</button></div>' : '') + '</div>' +
    '<div id="glbbody"><p class="how">Loading…</p></div>';
  $('stage').appendChild(panel);
  lbState = { game, period: weekly ? 'week' : 'all', week:null, all:null };
  [...panel.querySelectorAll('.glbtab')].forEach(b => b.onclick = () => {
    lbState.period = b.dataset.p;
    [...panel.querySelectorAll('.glbtab')].forEach(t => t.classList.toggle('cur', t===b));
    paintLB();
  });
  loadLBoard(game);
}
async function loadLBoard(game){
  const lb = LB_GAMES[game], body = $('glbbody');
  if (!TT.myEmail()){ if (body) body.innerHTML = '<p class="how">Sign in on the timetable to see the leaderboard.</p>'; return; }
  try {
    const d = await TT.api('/api/leaderboard', { params:{ game, metric:lb.metric, week:tetrisWeek() } });
    lbRemember(game, d);                            // fresh each time the game opens, so a deletion is noticed
    if (lbState && lbState.game === game){ lbState.week = d.week; lbState.all = d.all; paintLB(); }
  } catch(e){ if (body) body.innerHTML = ''; }
}
function paintLB(){
  const body = $('glbbody'); if (!body || !lbState) return;
  const lb = LB_GAMES[lbState.game];
  const b = lbState.period === 'week' ? lbState.week : lbState.all;
  if (!b){ body.innerHTML = '<p class="how">Loading…</p>'; return; }
  const rows = b.top || [];
  if (!rows.length && b.meBest == null){ body.innerHTML = '<p class="how">No scores yet. Be the first.</p>'; return; }
  let html = rows.map((r,i) => '<div class="tlbrow'+(r.you?' me':'')+'"><span class="rk">'+(i+1)+'</span>'+
    '<span class="nm">'+esc(r.name)+'</span><span class="tm">'+esc(lb.fmt(r.score))+'</span></div>').join('');
  if (b.meRank && b.meRank > rows.length)
    html += '<div class="tlbrow me"><span class="rk">'+b.meRank+'</span><span class="nm">You</span><span class="tm">'+esc(lb.fmt(b.meBest))+'</span></div>';
  body.innerHTML = html;
}

const cleanSubject = name => String(name||'')
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i,'')
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/,'')
  .replace(/^[\s:\-–—]+/,'').trim();
const personName = r => {
  const full = r.FullName||r.fullName||r.Name||r.name||'';
  const first = r.FirstName||r.firstName||r.firstname||r.GivenName||r.preferredName||'';
  const last  = r.LastName||r.lastName||r.lastname||r.Surname||r.surname||'';
  const mail  = r.Email||r.email||r.emailAddress||'';
  const nm = full || [first,last].filter(Boolean).join(' ');
  if (nm) return nm;
  if (mail){ const p = mail.split('@')[0].split('.');
    if (p.length>=2) return cap(p[0])+' '+cap(p[1].replace(/\d+$/,'')); }
  return '';
};
const cap = s => s ? s[0].toUpperCase()+s.slice(1).toLowerCase() : s;
/* "stephen.henne@det.nsw.edu.au" / "HENNE, Stephen" -> "Stephen Henne" */
const tidyName = t => {
  t = String(t||'').trim();
  if (!t) return '';
  if (t.includes('@')) t = t.split('@')[0];
  if (/[.,]/.test(t)) return t.split(/[.,]\s*/).filter(Boolean).map(cap).join(' ').replace(/\s+\d+/g,'').trim();
  return t;
};
/* students are @education.nsw.gov.au; staff are @det.nsw.edu.au or role-tagged */
const isStaff = r => {
  const mail = String(r.Email||r.email||r.emailAddress||'').toLowerCase();
  return /teacher|staff/i.test(r.Role||r.role||r.Type||r.type||'') ||
         /@det\.nsw\.edu\.au$/.test(mail);
};
const shuffle = a => { for (let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* pool of everyone sharing a class with the loaded timetable, plus that
   viewer's name so the game confirms whose classes it is drawn from */
async function loadGuessData(){
  const email = TT.myEmail();
  const tt = await TT.apiGet({ email });
  const viewer = personName({ Email: email }) || String(email).split('@')[0];
  const me = String(email).toLowerCase();
  const groups = (tt.profile && (tt.profile.groups || tt.profile.Groups)) || [];
  let grade = '';
  for (const g of groups){ const m = String(g).match(/(?:yr|year)\s*(\d{1,2})/i); if (m){ grade = m[1]; break; } }

  /* people who share a class with you, tagged with the subjects you share */
  const rows = (tt.timetable||[]).filter(r =>
    r.ClassCode && !/assembly|recess|lunch|roll/i.test((r.Period||'') + ' ' + (r.CourseName||'')));
  const codeSubject = {};
  rows.forEach(r => { codeSubject[r.ClassCode] = cleanSubject(r.CourseName) || r.ClassCode; });
  const codes = [...new Set(rows.map(r => r.ClassCode))].slice(0, 10);
  const cp = new Map();
  for (const code of codes){
    let data; try { data = await TT.apiGet({ class: code }); } catch { continue; }
    const arr = Array.isArray(data) ? data : (data.roster || data.students || []);
    for (const r of arr){
      if (isStaff(r)) continue;
      const mail = String(r.Email||r.email||r.emailAddress||'').toLowerCase();
      const name = personName(r);
      if (!name || (mail && mail === me)) continue;
      const key = mail || name.toLowerCase();
      if (!cp.has(key)) cp.set(key, { name, email:mail,
        year:String(r.Year||r.year||r.Form||r.form||'').replace(/\D/g,''), subjects:new Set() });
      cp.get(key).subjects.add(codeSubject[code]);
    }
  }
  const classPool = [...cp.values()].map(p => ({ name:p.name, email:p.email, year:p.year, subjects:[...p.subjects] }));

  /* one representative room / teacher / period per class, for the Classroom
     game — take the first row of each class that actually names a room */
  const rmOf  = r => String(r.RoomCode||r.RoomNumber||r.RoomName||r.Room||r.Location||'').trim();
  const tchOf = r => String(r.TeacherName||r.TeacherFullName||r.Teacher||r.StaffName||'').trim();
  const rooms = [];
  const seenRoom = new Set();
  rows.forEach(r => {
    const room = rmOf(r);
    if (!room || seenRoom.has(r.ClassCode)) return;
    seenRoom.add(r.ClassCode);
    rooms.push({ subject: codeSubject[r.ClassCode], room,
                 teacher: tidyName(tchOf(r)), period: String(r.Period||'').trim() });
  });

  /* subject → the teacher who takes it for you, so Guess Who can hint
     "they have a class with Mr X" for any class you share with the target */
  const subjTeacher = {};
  rows.forEach(r => {
    const s = codeSubject[r.ClassCode], t = tidyName(tchOf(r));
    if (s && t && !subjTeacher[s]) subjTeacher[s] = t;
  });

  return { email:me, viewer, grade, classPool, rooms, subjTeacher, students:null, teachers:null };
}

/* the directory doesn't name its year field consistently — pull a year number
   out of whichever of the usual fields carries it (Year / Form / Grade / roll
   class / cohort), keeping only the digits so "Year 8", "8", "8B" all give 8 */
const yearOf = r => {
  const direct = String(
    r.year || r.Year || r.grade || r.Grade || r.yearGroup || r.YearGroup ||
    r.form || r.Form || r.rollClass || r.RollClass || r.RollGroup || r.rollGroup ||
    r.cohort || r.Cohort || r.stage || r.Stage || ''
  ).replace(/\D/g, '');
  if (direct) return direct;
  const gs = r.groups || r.Groups || [];       // real directory carries year here, e.g. "yr11"
  for (const g of (Array.isArray(gs) ? gs : [])){ const m = String(g).match(/(?:yr|year)\.?\s*(\d{1,2})/i); if (m) return m[1]; }
  return '';
};

/* map a raw directory record to a person */
function dirPerson(r){
  const name = personName(r);
  const mail = String(r.emailAddress||r.Email||r.email||'').toLowerCase();
  return name ? { name, email:mail, year:yearOf(r), subjects:[] } : null;
}

/* Load the whole-school student directory once. While we still have the raw
   list, find the viewer's own record so we can read their year straight from
   the directory — far more reliable than scraping it out of the profile's
   group names, which is what left "My year" empty and unplayable before. */
async function loadStudents(){
  if (gwData.students) return;
  const d = await TT.apiGet({ group:'student' });
  const all = (Array.isArray(d) ? d : (d.people || d)).map(dirPerson).filter(Boolean);
  if (!gwData.grade){
    const mine = all.find(p => p.email && p.email === gwData.email);
    if (mine && mine.year) gwData.grade = mine.year;
  }
  gwData.students = all.filter(p => p.email !== gwData.email);
}

/* the directory knows names and years but not classes; fold in whatever the
   shared-class pool knows about the same person so "My grade" / "Whole school"
   can still give subject and teacher hints instead of only name shapes */
function withClassInfo(list){
  const byMail = new Map((gwData.classPool||[]).filter(p=>p.email).map(p => [p.email, p]));
  return list.map(p => {
    const c = p.email && byMail.get(p.email);
    return c && c.subjects.length ? Object.assign({}, p, { subjects: c.subjects }) : p;
  });
}

async function poolFor(diff){
  if (diff === 'myclasses') return gwData.classPool;
  if (diff === 'teachers'){
    if (!gwData.teachers){
      const d = await TT.apiGet({ group:'teacher' });
      gwData.teachers = (Array.isArray(d)?d:(d.people||d)).map(dirPerson).filter(Boolean);
    }
    return gwData.teachers.filter(p => p.email !== gwData.email);
  }
  await loadStudents();
  if (diff === 'grade'){
    if (!gwData.grade)
      throw new Error("Couldn't work out which year you're in. Try another mode.");
    return withClassInfo(gwData.students.filter(p => p.year && p.year === gwData.grade));
  }
  return withClassInfo(gwData.students);   /* whole school */
}

const DIFFS = [
  { id:'myclasses', name:'My classes', desc:'People in a class with you' },
  { id:'grade',     name:'My grade',   desc:'Everyone in your year' },
  { id:'school',    name:'Whole school', desc:'Any student' },
  { id:'teachers',  name:'Teachers',   desc:'Any teacher' }
];

BUILD.guesswho = host => {
  head(host, 'Guess Who', 'Guess the mystery person from the hints.', '<div id="gw"></div>');
  const box = document.getElementById('gw');
  let alive = true, diff = TT.get('tt.gwdiff', 'myclasses');

  (async () => {
    box.innerHTML = '<p class="how">Loading…</p>';
    try {
      if (!gwData) gwData = await loadGuessData();
      if (!alive) return;
      start();
    } catch (err){
      if (alive) box.innerHTML = '<p class="how">Could not load: ' + esc(err.message) + '</p>';
    }
  })();

  async function start(){
    box.innerHTML =
      '<div class="gwtop"><div class="gwdiffs" id="gwdiffs"></div>' +
      '<div class="gwyou">as <b>' + esc(gwData.viewer) + '</b></div></div>' +
      '<div id="gwbody"><p class="how">Loading people…</p></div>';
    const dd = document.getElementById('gwdiffs');
    DIFFS.forEach(d => {
      const b = document.createElement('button');
      b.type='button'; b.className='gwdiff'; b.textContent=d.name; b.title=d.desc;
      b.setAttribute('aria-pressed', String(d.id===diff));
      b.onclick = () => { diff=d.id; TT.set('tt.gwdiff',diff);
        [...dd.children].forEach(c=>c.setAttribute('aria-pressed',String(c===b))); load(); };
      dd.appendChild(b);
    });
    load();
  }

  async function load(){
    const body = document.getElementById('gwbody');
    body.innerHTML = '<p class="how">Loading people…</p>';
    let pool;
    try { pool = await poolFor(diff); } catch(err){ body.innerHTML = '<p class="how">Could not load: '+esc(err.message)+'</p>'; return; }
    if (!alive) return;
    if (!pool || pool.length < 3){
      body.innerHTML = '<p class="how">Not enough people in this pool to play. Try another difficulty, or open a timetable first.</p>';
      return;
    }
    play(pool.slice());
  }

  function play(pool){
    const body = document.getElementById('gwbody');
    const target = pool[(Math.random()*pool.length)|0];
    const names = [...new Set(pool.map(p => p.name))].sort();
    let guesses = 0, wonlost = false;
    const first = target.name.split(' ')[0], last = target.name.split(' ').slice(1).join(' ');
    const subs = shuffle(target.subjects.slice());
    const hasClasses = target.subjects.length > 0;
    /* a classmate who shares a class the target has but that we never NAME in a
       hint, so "shares a class with X" can't overlap a class we already gave.
       (With ≤2 classes every class gets named, so there's simply no peer hint.) */
    const firstClass = subs[0];
    const namedClasses = new Set([firstClass, subs[1]].filter(Boolean));
    const peer = shuffle(pool.filter(p => p !== target &&
        p.subjects.some(s => target.subjects.includes(s) && !namedClasses.has(s))))[0];

    /* Hints grouped by how much they give away and shuffled inside each tier,
       so the order is fresh every game but the near-answer ones always land
       last. Tier 0 is trimmed so a round stays about 8 hints. */
    const VOW = 'AEIOU', nVow = w => [...w.toUpperCase()].filter(c => VOW.includes(c)).length;
    const whole = (first + last).replace(/\s/g, '');
    const teach = subs.map(s => (gwData.subjTeacher||{})[s]).filter(Boolean);
    const T = [[], [], [], []];

    /* what they do — the freshest hints, so use them whenever we know them */
    if (target.year && diff !== 'grade')                    // pointless in My-grade — all one year
      T[0].push(() => 'They are in year <b>' + target.year + '</b>.');
    if (hasClasses){
      T[0].push(() => 'They take <b>' + firstClass + '</b>.');
      if (diff === 'myclasses' || target.subjects.length > 1)
        T[0].push(() => 'They are in <b>' + target.subjects.length + '</b> of your classes.');
      if (subs[1]) T[1].push(() => 'They also take <b>' + subs[1] + '</b>.');
      if (subs[2]) T[1].push(() => 'They take <b>' + subs[2] + '</b> too.');
    }
    if (teach[0]) T[1].push(() => 'They have a class with <b>' + teach[0] + '</b>.');
    if (teach[1]) T[2].push(() => 'They also have a class with <b>' + teach[1] + '</b>.');
    if (peer) T[2].push(() => 'They share a class with <b>' + peer.name + '</b>.');

    /* vague name shape */
    T[0].push(() => 'Their first name has <b>' + first.length + '</b> letters.');
    T[0].push(() => 'Their first name has <b>' + nVow(first) + '</b> vowel' + (nVow(first)===1?'':'s') + '.');
    T[0].push(() => 'Their first name starts with a <b>' + (VOW.includes(first[0].toUpperCase())?'vowel':'consonant') + '</b>.');
    T[0].push(() => 'Their whole name has <b>' + whole.length + '</b> letters.');
    T[0].push(() => 'Their name ' + (/(.)\1/i.test(whole) ? 'has a' : 'has no') + ' <b>double letter</b> in it.');
    if (last){
      T[0].push(() => 'Their surname has <b>' + last.length + '</b> letters.');
      T[0].push(() => 'Their surname starts with a letter in the <b>' +
        (last[0].toUpperCase() <= 'M' ? 'first' : 'second') + ' half</b> of the alphabet.');
    }
    /* medium */
    T[1].push(() => 'Their first name ends with <b>' + first[first.length-1].toUpperCase() + '</b>.');
    if (last) T[1].push(() => 'Their surname ends with <b>' + last[last.length-1].toUpperCase() + '</b>.');
    /* strong — an actual letter of the name */
    T[2].push(() => 'Their first name starts with <b>' + first[0].toUpperCase() + '</b>.');
    if (last) T[2].push(() => 'Their surname starts with <b>' + last[0].toUpperCase() + '</b>.');
    if (last) T[2].push(() => 'Their initials are <b>' + first[0].toUpperCase() + '.' + last[0].toUpperCase() + '.</b>');
    /* nearly the answer */
    T[3].push(() => 'Their first name looks like <b>' + reveal(first, 0.5) + '</b>.');
    if (last) T[3].push(() => 'Their surname looks like <b>' + reveal(last, 0.45) + '</b>.');

    const hints = [].concat(shuffle(T[0]).slice(0, 3), shuffle(T[1]).slice(0, 3),
                            shuffle(T[2]).slice(0, 3), shuffle(T[3]));
    let level = 0;

    render();
    function render(){
      body.innerHTML =
        '<div class="gwhints" id="gwhints"></div>' +
        '<div class="gwrow">' +
          '<input id="gwin" list="gwlist" autocomplete="off" placeholder="Name the mystery person…">' +
          '<datalist id="gwlist">' + names.map(n => '<option value="' + n.replace(/"/g,'&quot;') + '">').join('') + '</datalist>' +
          '<button class="btn primary" id="gwguess" type="button">Guess</button>' +
        '</div><div class="gwlog" id="gwlog"></div>';
      paintHints();
      document.getElementById('gwguess').onclick = guess;
      document.getElementById('gwin').addEventListener('keydown', e => { if (e.key==='Enter') guess(); });
      document.getElementById('gwin').focus();
    }
    function paintHints(){
      document.getElementById('gwhints').innerHTML =
        hints.slice(0, level+1).map((h,i) =>
          '<div class="gwhint' + (i===level ? ' fresh' : '') + '">' + h() + '</div>').join('');
      const leftN = hints.length - (level+1);
      document.getElementById('sc').textContent = wonlost ? ''
        : 'Guess ' + (guesses+1) + ' · ' + (leftN>0 ? leftN + ' hint' + (leftN===1?'':'s') + ' left' : 'last hint');
    }
    function guess(){
      if (wonlost) return;
      const inp = document.getElementById('gwin'), v = inp.value.trim();
      if (!v) return;
      guesses++;
      const right = v.toLowerCase() === target.name.toLowerCase();
      const row = document.createElement('div');
      row.className = 'gwguessrow ' + (right ? 'win' : 'miss');
      row.textContent = (right ? '✓ ' : '✗ ') + v;
      document.getElementById('gwlog').prepend(row);
      inp.value = '';
      if (right){
        wonlost = true;
        recordStat('guesswho', { key:'best', mode:'min', value:guesses });
        document.getElementById('sc').textContent = 'Got them in ' + guesses + '! (best ' + statVal('guesswho','best') + ')';
        document.getElementById('gwhints').innerHTML =
          '<div class="gwhint win">It was <b>' + esc(target.name) + '</b>.' +
          (target.subjects.length ? ', shares ' + esc(target.subjects.join(', ')) : '') + '.</div>';
        inp.disabled = true; endBtn();
      } else if (level < hints.length - 1){ level++; paintHints(); }
      else { wonlost = true;
        document.getElementById('gwhints').innerHTML +=
          '<div class="gwhint lose">Out of hints. It was <b>' + esc(target.name) + '</b>.</div>';
        endBtn();
      }
    }
    function endBtn(){ const b=document.getElementById('gwguess'); b.textContent='Play again'; b.disabled=false; b.onclick=()=>play(pool); }
  }
  function reveal(word, frac){
    return [...word].map((ch,i) => (i===0 || Math.random()<frac) ? ch : '_').join(' ');
  }
  return () => { alive = false; };
};

/* ── Daily Guess Who ───────────────────────────────────────────────
   The same mystery student for everyone in your year, once a day. The
   server still records every guess (streak, cross-device, the community
   summary), but grading is done in the browser off the day's answer so
   feedback is instant. A "how others did" summary and a Sept-1 archive
   sit under the game. */
BUILD.dailyguess = host => {
  head(host, 'Daily Guess Who', 'One mystery student from your year, the same one for everyone. You can replay past days too.', '<div id="dg"></div>');
  const box = document.getElementById('dg');
  let alive = true;
  const norm = x => String(x==null?'':x).trim().toLowerCase().replace(/\s+/g,' ');
  const shiftISO = (d, delta) => { const x=new Date(d+'T00:00:00Z'); x.setUTCDate(x.getUTCDate()+delta); return x.toISOString().slice(0,10); };
  const shortDate = d => new Date(d+'T00:00:00Z').toLocaleDateString('en-AU',{month:'short',day:'numeric',timeZone:'UTC'});

  async function loadDay(date){       // date=null → today
    box.innerHTML = '<p class="how">Loading…</p>';
    let s;
    try { s = await TT.api('/api/daily', { params: date ? { date } : {} }); }
    catch (err){ if (alive) box.innerHTML = '<p class="how">Could not load: ' + esc(err.message) + '</p>'; return; }
    if (alive) render(s);
  }
  loadDay(null);

  function render(s){
    const isToday = s.date === s.today, epoch = s.epoch || '2026-09-01';
    const answer = s.answer, total = s.totalHints;
    let guesses = s.guesses||0, done = !!s.done, won = !!s.won, streak = s.streak||0;
    let shown = s.shown != null ? s.shown : Math.min(guesses+1, total);

    box.innerHTML =
      '<div class="gwtop"><div class="gwyou">Year <b>' + esc(s.year) + '</b> · <b>' + esc(isToday ? 'Today' : shortDate(s.date)) + '</b></div>' +
      '<div style="margin-left:auto;display:flex;gap:10px;align-items:center">' +
        '<span class="gwyou" style="margin:0">Streak <b id="dgstreak">' + streak + '</b></span>' +
        '<button class="btn" id="dgunlimited" type="button">Unlimited →</button></div></div>' +
      '<div class="dgtoolbar"><button class="dgtool" id="dgarchbtn" type="button">Show archive</button>' +
        '<button class="dgtool" id="dgsumbtn" type="button">Show summary</button></div>' +
      '<div id="dgdayswrap" hidden><div class="dgdays" id="dgdays"></div><div class="dgarch" id="dgarch"></div></div>' +
      '<div class="gwhints" id="dghints"></div>' +
      '<div class="gwrow" id="dgrow">' +
        '<input id="dgin" list="dglist" autocomplete="off" placeholder="Name the mystery student…">' +
        '<datalist id="dglist">' + (s.candidates||[]).map(n => '<option value="' + esc(n).replace(/"/g,'&quot;') + '">').join('') + '</datalist>' +
        '<button class="btn primary" id="dgguess" type="button">Guess</button>' +
      '</div><div class="gwlog" id="dglog"></div>' +
      '<div id="dgsummary" hidden></div>';

    document.getElementById('dgunlimited').onclick = () => openGame('guesswho');
    document.getElementById('dgarchbtn').onclick = toggleDays;
    document.getElementById('dgsumbtn').onclick = () => toggleSummary(s.date);
    renderDays(s);

    const hintsEl = document.getElementById('dghints');
    const allHints = s.hints || [];
    const paint = fresh => hintsEl.innerHTML = allHints.slice(0, shown).map((h,i) =>
      '<div class="gwhint' + (i===fresh?' fresh':'') + '">' + h + '</div>').join('');
    paint(-1);

    const sc = document.getElementById('sc');
    const setScore = () => sc.textContent = done ? '' : 'Guess ' + (guesses+1) + ' of ' + total;
    setScore();
    recordStat('dailyguess', { key:'streak', mode:'set', value:streak });

    function finish(){
      SFX[won ? 'win' : 'lose']();
      const row = document.getElementById('dgrow'); if (row) row.style.display = 'none';
      sc.textContent = '';
      const banner = document.createElement('div');
      banner.className = 'gwhint ' + (won ? 'win' : 'lose');
      banner.innerHTML = won
        ? 'You got it in <b>' + guesses + '</b>! It was <b>' + esc(answer) + '</b>.'
        : 'Out of guesses. It was <b>' + esc(answer) + '</b>.';
      hintsEl.appendChild(banner);
      const chip = document.querySelector('.dgday.cur');
      if (chip){ chip.classList.remove('open','won','lost'); chip.classList.add(won?'won':'lost');
        let ic = chip.querySelector('.dgi'); if(!ic){ ic=document.createElement('span'); ic.className='dgi'; chip.appendChild(ic); }
        ic.textContent = won ? '✓' : '✗'; }
      const note = document.createElement('p');
      note.className = 'gwyou'; note.style.marginTop = '12px';
      note.innerHTML = (isToday ? 'Come back tomorrow for a new one. ' : 'Pick another day above. ') +
                       'Current streak: <b id="dgstreaknote">' + streak + '</b>.';
      hintsEl.parentNode.insertBefore(note, hintsEl.nextSibling);
      openSummary(s.date);
    }

    if (done){ finish(); return; }

    const input = document.getElementById('dgin'), btn = document.getElementById('dgguess');
    function doGuess(){
      const v = input.value.trim(); if (!v || done) return;
      guesses++;
      const correct = norm(v) === norm(answer);          // graded locally — instant, no round-trip
      const row = document.createElement('div');
      row.className = 'gwguessrow ' + (correct ? 'win' : 'miss');
      row.textContent = (correct ? '✓ ' : '✗ ') + v;
      document.getElementById('dglog').prepend(row);
      input.value = '';
      if (correct){ won = true; done = true; }
      else if (guesses >= total){ done = true; }
      else { shown = Math.min(guesses+1, total); paint(shown-1); }
      /* record in the background so streak, the summary and cross-device stay right */
      TT.api('/api/daily', { method:'POST', body:{ guess:v, date:s.date } })
        .then(r => { if (!alive || !r) return; streak = r.streak != null ? r.streak : streak;
          const a=document.getElementById('dgstreak'); if(a) a.textContent = streak;
          const b=document.getElementById('dgstreaknote'); if(b) b.textContent = streak;
          recordStat('dailyguess', { key:'streak', mode:'set', value:streak }); })
        .catch(()=>{});
      if (done) finish(); else { setScore(); input.focus(); }
    }
    btn.onclick = doGuess;
    input.addEventListener('keydown', e => { if (e.key==='Enter') doGuess(); });
    input.focus();
  }

  /* a chip per day for the last two weeks (never before the epoch) */
  function renderDays(s){
    const daysEl = document.getElementById('dgdays');
    const hist = {}; (s.history||[]).forEach(h => hist[h.date] = h);
    const epoch = s.epoch || '2026-09-01';
    let html = '';
    for (let i=0;i<14;i++){
      const d = shiftISO(s.today, -i); if (d < epoch) break;
      const h = hist[d];
      const status = h && h.won ? 'won' : (h && h.done ? 'lost' : 'open');
      const icon = h && h.won ? '✓' : (h && h.done ? '✗' : '');
      html += '<button class="dgday ' + status + (d===s.date ? ' cur' : '') + '" data-date="' + d + '">' +
        '<span class="dgd">' + (i===0 ? 'Today' : esc(shortDate(d))) + '</span>' +
        (icon ? '<span class="dgi">' + icon + '</span>' : '') + '</button>';
    }
    daysEl.innerHTML = html;
    [...daysEl.querySelectorAll('.dgday')].forEach(b => b.onclick = () => loadDay(b.dataset.date));
  }

  /* day picker: recent chips + every past day since the epoch that has results */
  let archLoaded = false;
  async function toggleDays(){
    const wrap = document.getElementById('dgdayswrap'), btn = document.getElementById('dgarchbtn');
    if (!wrap.hidden){ wrap.hidden = true; btn.textContent = 'Show archive'; return; }
    wrap.hidden = false; btn.textContent = 'Hide archive';
    if (archLoaded) return;
    const el = document.getElementById('dgarch');
    try {
      const d = await TT.api('/api/daily', { params:{ archive:1 } });
      const arr = d.archive || [];
      el.innerHTML = arr.map(a => '<button class="dgday" data-date="'+a.date+'" title="'+a.wins+' of '+a.played+' solved it">' +
        '<span class="dgd">'+esc(shortDate(a.date))+'</span><span class="dgi">'+a.wins+'/'+a.played+'</span></button>').join('');
      [...el.querySelectorAll('.dgday')].forEach(b => b.onclick = () => loadDay(b.dataset.date));
      archLoaded = true;
    } catch(e){}
  }

  /* "how others did": win/loss + guess-count histogram for the loaded day */
  async function openSummary(date){ document.getElementById('dgsummary').hidden = false;
    document.getElementById('dgsumbtn').textContent = 'Hide summary'; await loadSummary(date); }
  async function toggleSummary(date){ const el = document.getElementById('dgsummary');
    if (!el.hidden){ el.hidden = true; document.getElementById('dgsumbtn').textContent = 'Show summary'; return; }
    await openSummary(date); }
  async function loadSummary(date){
    const el = document.getElementById('dgsummary'); el.innerHTML = '<p class="how" style="margin:0">Loading…</p>';
    try { const d = await TT.api('/api/daily', { params:{ date, summary:1 } }); renderSummary(el, d.summary); }
    catch(e){ el.innerHTML = '<p class="how" style="margin:0">Could not load the summary.</p>'; }
  }
  function renderSummary(el, sum){
    if (!sum || !sum.played){ el.innerHTML = '<p class="how" style="margin:0">No one in your year has finished this one yet. Be the first.</p>'; return; }
    const rate = Math.round(sum.wins / sum.played * 100);
    const names = sum.names || {};                       // {bucket: [names]} for hover
    const max = Math.max(1, sum.losses, ...Object.keys(sum.dist).map(k => sum.dist[k]));
    const tip = key => { const list = names[key]; return list && list.length ? ' title="' + esc(list.join(', ')) + '"' : ''; };
    const bar = (label, n, key, miss) => '<div class="dgbar' + (miss?' miss':'') + '"' + tip(key) + '><span class="dgbl">' + label + '</span>' +
      '<span class="dgbt"><i style="width:' + (n/max*100) + '%"></i></span><span class="dgbn">' + n + '</span></div>';
    let rows = '';
    for (let i=1;i<=sum.totalHints;i++) rows += bar(i, sum.dist[i]||0, String(i), false);
    rows += bar('✗', sum.losses, 'lost', true);
    el.innerHTML =
      '<div class="dgsumhd"><span class="big">' + sum.played + '</span> played · <span class="big">' + rate + '%</span> solved · ' +
        '<b>' + sum.wins + '</b> won, <b>' + sum.losses + '</b> lost</div>' +
      '<div class="dgbars">' + rows + '</div>' +
      '<p class="how" style="margin:8px 0 0">Guesses taken to solve it. Hover a row to see who.</p>';
  }

  return () => { alive = false; };
};

/* ── Tetris ────────────────────────────────────────────────────────
   Two modes — Sprint (clear 40 lines; deterministic weekly pieces; best
   time per week) and Zen (survive as long as you can; gravity ramps with
   time; all-time board). tetr.io-style layout, rebindable keys + handling. */
BUILD.tetris = host => {
  const COLS = 10, ROWS = 20, CELL = 24, TARGET = 40, LOCK_DELAY = 500, MAX_RESETS = 15, ROT_DAS = 250, ROT_ARR = 130;
  const wk = tetrisWeek();

  /* ── config: keybinds + handling, persisted (syncs with other settings) ── */
  const DEFAULTS = {
    keys: { left:'ArrowLeft', right:'ArrowRight', softDrop:'ArrowDown', hardDrop:' ',
            rotateCW:'ArrowUp', rotateCCW:'z', rotate180:'a', hold:'Shift', pause:'p', restart:'r' },
    das:160, arr:45, sdf:20, dcd:0, grav:800, accel:false
  };
  const ACCEL_TIME = 400;   // ms of holding over which side-movement ramps to instant
  function loadCfg(){
    const c = TT.get('tt.tetriscfg', {}) || {};
    return { keys: Object.assign({}, DEFAULTS.keys, c.keys||{}),
             das:c.das==null?DEFAULTS.das:c.das, arr:c.arr==null?DEFAULTS.arr:c.arr,
             sdf:c.sdf==null?DEFAULTS.sdf:c.sdf, dcd:c.dcd==null?DEFAULTS.dcd:c.dcd,
             grav:c.grav==null?DEFAULTS.grav:c.grav, accel:!!c.accel };
  }
  let cfg = loadCfg();
  const saveCfg = () => TT.set('tt.tetriscfg', cfg);
  let mode = TT.get('tt.tetrismode', 'sprint');

  head(host, 'Tetris', 'Sprint, Survival, Zen and Practice. Keys and handling under Controls.', '<div id="twrap"></div>');
  document.getElementById('twrap').innerHTML =
    '<div class="tmodes" id="tmodes"></div>' +
    '<div class="tgame">' +
      '<div class="tside tleft">' +
        '<div class="tpanel"><div class="tlabel">Hold</div><canvas id="thold" width="80" height="60"></canvas></div>' +
        '<div class="tstats">' +
          '<div class="tstat"><span id="tgoallabel">Lines left</span><b id="tgoal">40</b></div>' +
          '<div class="tstat"><span id="ttimelabel">Time</span><b id="ttime">00:00:00.0</b></div>' +
          '<div class="tstat"><span id="tbestlabel">Best</span><b id="tbest">—</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="tboardwrap">' +
        '<canvas id="tcan" width="240" height="480"></canvas>' +
        '<div class="tflash" id="tflash"></div>' +
        '<div class="tover" id="tover"></div>' +
      '</div>' +
      '<div class="tside tright">' +
        '<div class="tpanel"><div class="tlabel">Next</div><canvas id="tnext" width="80" height="224"></canvas></div>' +
      '</div>' +
    '</div>' +
    (TOUCH ? '<div class="tpad" id="tpad">' +
      '<button type="button" data-act="left" aria-label="Move left">◀</button>' +
      '<button type="button" data-act="right" aria-label="Move right">▶</button>' +
      '<button type="button" data-act="rotateCCW" aria-label="Rotate anticlockwise">↺</button>' +
      '<button type="button" data-act="rotateCW" aria-label="Rotate clockwise">↻</button>' +
      '<button type="button" data-act="hold" class="lbl">Hold</button>' +
      '<button type="button" data-act="softDrop" aria-label="Soft drop">▼</button>' +
      '<button type="button" data-act="hardDrop" class="lbl wide">Drop</button></div>' : '') +
    '<div class="tbtns">' +
      '<button class="btn primary" id="tstart" type="button">Start</button>' +
      '<button class="btn" id="tpause" type="button">Pause</button>' +
      '<button class="btn" id="tundo" type="button" hidden>↶ Undo (U)</button>' +
      '<button class="btn" id="tredo" type="button" hidden>↷ Redo (Y)</button>' +
      '<button class="btn" id="tsave" type="button" hidden>Save</button>' +
      '<button class="btn" id="tcontrols" type="button">Controls</button>' +
    '</div>' +
    '<div class="tkeyhint" id="tkeyhint"></div>' +
    '<div class="tcfg" id="tcfg" hidden></div>' +
    '<div class="tlb" id="tlb"></div>';

  const $$ = id => document.getElementById(id);
  const can = $$('tcan'), ctx = can.getContext('2d');
  const ncan = $$('tnext'), nctx = ncan.getContext('2d');
  const hcan = $$('thold'), hctx = hcan.getContext('2d');
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  /* juice: brief flash overlay + canvas shake, both gated on the animation setting */
  function flash(kind){ if (!gameAnim()) return; const f=$$('tflash'); if(!f) return;
    f.className='tflash'; void f.offsetWidth; f.classList.add(kind); }
  function shake(){ if (!gameAnim()) return; const c=$$('tcan'); if(!c) return;
    c.classList.remove('tshake'); void c.offsetWidth; c.classList.add('tshake'); }

  /* SRS spawn states in padded boxes (3×3 for JLSTZ, 4×4 for I, 2×2 for O) */
  const SPAWN = {
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]]
  };
  const COLORS = { I:'#38bdf8', O:'#facc15', T:'#c084fc', S:'#4ade80', Z:'#f87171', J:'#60a5fa', L:'#fb923c' };
  const KEYS = Object.keys(SPAWN);

  /* SRS kick tables — offsets in SRS coords (y up); applied with y negated for the
     screen grid. States: 0 spawn, 1 CW, 2 flipped, 3 CCW. */
  const KICK_JLSTZ = {
    '0,1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '1,0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1,2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],     '2,1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2,3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],    '3,2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3,0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  '0,3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  };
  const KICK_I = {
    '0,1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],  '1,0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1,2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],  '2,1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2,3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],  '3,2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3,0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],  '0,3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  };
  /* a compact 180 kick set (already in grid coords: negative y = up) */
  const KICK_180 = [[0,0],[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1]];

  const rotCW = m => { const n=m.length, o=Array.from({length:n},()=>Array(n).fill(0));
    for(let r=0;r<n;r++)for(let c=0;c<n;c++) o[c][n-1-r]=m[r][c]; return o; };
  const rotCCW = m => { const n=m.length, o=Array.from({length:n},()=>Array(n).fill(0));
    for(let r=0;r<n;r++)for(let c=0;c<n;c++) o[n-1-c][r]=m[r][c]; return o; };

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  let rnd, bag = [], queue = [];
  let undoStack = [], redoStack = [];        // practice mode only — history of committed states
  function newRng(){ rnd = mode==='sprint' ? mulberry32(0x9e3779b9 ^ wk) : mulberry32((Math.random()*4294967296)>>>0); bag = []; }
  function nextType(){
    if (!bag.length){ bag = KEYS.slice();
      for (let i=bag.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; [bag[i],bag[j]]=[bag[j],bag[i]]; } }
    return bag.shift();
  }
  function fillQueue(){ while (queue.length < 7) queue.push(nextType()); }

  let grid, piece, hold, holdUsed, cleared, score = 0, elapsedMs = 0;
  let phase = 'ready';            // 'ready' | 'playing' | 'paused' | 'over'
  let loopId, lastTick, baseTime, dropAcc = 0, pauseAt = 0, alive = true;
  let moveDir = 0, dasStart = 0, arrLast = 0, dasCharged = false, softHeld = false;
  let rotHeld = false, rotStart = 0, rotLast = 0, rotCharged = false;
  let grounded = false, lockStart = 0, lockResets = 0;
  let rebinding = null, savedState = null, saveFlashTimer = null;

  /* ── piece mechanics (SRS) ── */
  function collides(cells, px, py){
    for (let r=0;r<cells.length;r++) for (let c=0;c<cells[r].length;c++){
      if (!cells[r][c]) continue;
      const x=px+c, y=py+r;
      if (x<0 || x>=COLS || y>=ROWS) return true;
      if (y>=0 && grid[y][x]) return true;
    }
    return false;
  }
  function updateGround(now, isAction){
    if (!collides(piece.cells, piece.x, piece.y+1)){ grounded=false; if (isAction) lockResets=0; }
    else { if (!grounded){ grounded=true; lockStart=now; }
           else if (isAction && lockResets<MAX_RESETS){ lockStart=now; lockResets++; } }
  }
  /* DAS cut delay: after a rotate/hold while a direction is held, cut the DAS
     charge down to at most cfg.dcd so the piece doesn't slam into the wall. */
  function applyDCD(now){ if (cfg.dcd>0 && moveDir!==0 && now-dasStart>cfg.dcd){ dasStart=now-cfg.dcd; dasCharged=false; } }
  function tryMove(dx, now){ if (collides(piece.cells, piece.x+dx, piece.y)) return false; piece.x+=dx; updateGround(now,true); return true; }
  function tryRotate(dir, now){
    if (piece.type==='O') return false;                  // O is rotationally symmetric
    const from = piece.rot, to = (from + (dir===2?2:dir) + 4) % 4;
    const m = dir===2 ? rotCW(rotCW(piece.cells)) : dir>0 ? rotCW(piece.cells) : rotCCW(piece.cells);
    const kicks = dir===2 ? KICK_180
      : (piece.type==='I' ? KICK_I : KICK_JLSTZ)[from+','+to].map(([kx,ky])=>[kx,-ky]);
    for (const [dx,dy] of kicks){
      if (!collides(m, piece.x+dx, piece.y+dy)){
        piece.cells=m; piece.x+=dx; piece.y+=dy; piece.rot=to; updateGround(now,true); applyDCD(now); return true;
      }
    }
    return false;
  }
  function spawnFrom(type, now){
    const cells = SPAWN[type].map(r=>r.slice());
    piece = { type, cells, rot:0, x:(COLS-cells[0].length)>>1, y:0 };
    grounded=false; lockStart=0; lockResets=0; dropAcc=0;
    if (collides(piece.cells, piece.x, piece.y)) end(false);   // block out
  }
  function spawnNext(now){ fillQueue(); const type=queue.shift(); fillQueue(); spawnFrom(type, now); }
  function doHold(now){
    if (holdUsed) return; holdUsed=true;
    const cur=piece.type;
    if (hold==null){ hold=cur; spawnNext(now); } else { const h=hold; hold=cur; spawnFrom(h, now); }
    SFX.hold(); applyDCD(now);
  }
  function hardDrop(now){ while (!collides(piece.cells, piece.x, piece.y+1)) piece.y++; SFX.drop(); shake(); commitLock(now); }
  function commitLock(now){
    piece.cells.forEach((row,r)=>row.forEach((v,c)=>{ if (v && piece.y+r>=0) grid[piece.y+r][piece.x+c]=piece.type; }));
    let lines=0;
    for (let r=ROWS-1;r>=0;r--){ if (grid[r].every(Boolean)){ grid.splice(r,1); grid.unshift(new Array(COLS).fill(null)); lines++; r++; } }
    if (lines){ cleared+=lines; score += [0,100,300,500,800][lines] || 800;
      if (lines>=4){ SFX.tetris(); flash('big'); } else { SFX.line(lines); flash('on'); } }
    else SFX.lock();
    if (mode==='sprint' && cleared>=TARGET){ end(true); return; }
    holdUsed=false; spawnNext(now); updateStats();
    if (mode==='practice') pushHistory();          // snapshot each placement so it can be undone
  }

  /* ── loop ── */
  /* Survival ramps hard and fast (halves ~every 12s, floors near 20G) so games
     stay tense and don't drag; Sprint/Zen use the player's chosen gravity. */
  const gravityMs = () => mode==='survival'
    ? Math.max(17, 700 * Math.pow(0.55, (elapsedMs/1000)/12))
    : cfg.grav;
  const saveable = () => mode==='zen' || mode==='survival';
  const scored = () => mode==='zen' || mode==='practice';    // score-based (not a clock)
  const modeName = () => ({sprint:'Sprint',survival:'Survival',zen:'Zen',practice:'Practice'}[mode] || mode);
  /* ── practice: undo / redo of committed placements (nothing is tracked) ── */
  function pushHistory(){ undoStack.push(serialize()); if (undoStack.length>300) undoStack.shift(); redoStack.length=0; updatePracticeBtns(); }
  function restoreInto(s){
    applyState(s);
    if (phase!=='playing'){ phase='playing'; hideOver(); clearInterval(loopId); loopId=setInterval(loop,16); }
    baseTime = Date.now()-elapsedMs; lastTick=performance.now();
    renderStatsLabels(); updateStats(); draw(); updatePracticeBtns();
  }
  function undo(){ if (mode!=='practice' || undoStack.length<=1) return; redoStack.push(undoStack.pop()); restoreInto(undoStack[undoStack.length-1]); }
  function redo(){ if (mode!=='practice' || !redoStack.length) return; const s=redoStack.pop(); undoStack.push(s); restoreInto(s); }
  function updatePracticeBtns(){
    const u=$$('tundo'), r=$$('tredo'); if (!u||!r) return;
    const on = mode==='practice';
    /* .btn sets display:inline-flex, which beats the [hidden] attribute — so toggle
       display directly, else undo/redo would show in every mode. */
    u.style.display = on ? '' : 'none'; r.style.display = on ? '' : 'none';
    if (on){ u.disabled = undoStack.length<=1; r.disabled = redoStack.length===0; }
  }
  function loop(){
    if (phase!=='playing') return;
    const now = performance.now();
    const dt = Math.min(100, now-lastTick); lastTick=now;
    elapsedMs = Date.now() - baseTime;
    if (moveDir!==0 && now-dasStart>=cfg.das){
      if (!dasCharged){ dasCharged=true; arrLast=now; tryMove(moveDir,now); }
      else {
        let arr = cfg.arr;
        if (cfg.accel){ const held = now - dasStart - cfg.das; arr = Math.max(0, cfg.arr*(1 - Math.min(1, held/ACCEL_TIME))); }
        if (arr <= 1){ while (tryMove(moveDir, now)) {} arrLast = now; }   // ramped to instant → slide to the wall
        else while (now-arrLast>=arr){ arrLast+=arr; if (!tryMove(moveDir,now)) break; }
      }
    }
    if (rotHeld && now-rotStart>=ROT_DAS){
      if (!rotCharged){ rotCharged=true; rotLast=now; tryRotate(1,now); }
      else while (now-rotLast>=ROT_ARR){ rotLast+=ROT_ARR; tryRotate(1,now); }
    }
    /* soft drop resets dropAcc on keypress (see onKey), so lowering sdf gives a
       genuinely faster drop — multiple cells/frame — without dumping banked gravity */
    const interval = Math.max(1, softHeld ? cfg.sdf : gravityMs());
    dropAcc += dt;
    let steps = 0;
    while (dropAcc>=interval && steps<ROWS){ dropAcc-=interval; steps++;
      if (!collides(piece.cells, piece.x, piece.y+1)) piece.y++;
      updateGround(now, false);
      if (phase!=='playing') return;
    }
    if (dropAcc > interval) dropAcc = interval;   // discard backlog after a lag spike
    if (grounded && now-lockStart>=LOCK_DELAY){ commitLock(now); if (phase!=='playing') return; }
    updateStats(); draw();
  }

  /* ── render ── */
  function cellPx(cx,cy,type,g){ g.fillStyle=COLORS[type]; g.fillRect(cx+1,cy+1,CELL-2,CELL-2);
    g.fillStyle='rgba(255,255,255,.18)'; g.fillRect(cx+1,cy+1,CELL-2,4); }
  function drawPieceBox(g, type, ox, oy, w, h){
    if (!type) return;
    const sh=SPAWN[type]; let minR=99,maxR=-1,minC=99,maxC=-1;
    sh.forEach((row,r)=>row.forEach((v,c)=>{ if(v){ if(r<minR)minR=r; if(r>maxR)maxR=r; if(c<minC)minC=c; if(c>maxC)maxC=c; } }));
    const pw=maxC-minC+1, ph=maxR-minR+1, s=Math.min((w-10)/pw,(h-8)/ph,16);
    const px=ox+(w-pw*s)/2, py=oy+(h-ph*s)/2;
    for(let r=minR;r<=maxR;r++)for(let c=minC;c<=maxC;c++) if(sh[r][c]){
      g.fillStyle=COLORS[type]; g.fillRect(px+(c-minC)*s+1, py+(r-minR)*s+1, s-2, s-2);
      g.fillStyle='rgba(255,255,255,.18)'; g.fillRect(px+(c-minC)*s+1, py+(r-minR)*s+1, s-2, 3); }
  }
  function drawNext(){ nctx.clearRect(0,0,ncan.width,ncan.height); const slot=ncan.height/4;
    for(let i=0;i<4;i++) drawPieceBox(nctx, queue[i], 0, i*slot, ncan.width, slot); }
  function drawHold(){ hctx.clearRect(0,0,hcan.width,hcan.height); drawPieceBox(hctx, hold, 0, 0, hcan.width, hcan.height); }
  function draw(){
    ctx.fillStyle = cssVar('--panel-2') || '#111'; ctx.fillRect(0,0,can.width,can.height);
    ctx.strokeStyle='rgba(128,128,128,.15)'; ctx.lineWidth=1;
    for (let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,ROWS*CELL); ctx.stroke(); }
    for (let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(COLS*CELL,y*CELL); ctx.stroke(); }
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c]) cellPx(c*CELL,r*CELL,grid[r][c],ctx);
    if (piece && phase==='playing'){
      let gy=piece.y; while (!collides(piece.cells, piece.x, gy+1)) gy++;
      ctx.strokeStyle=COLORS[piece.type]; ctx.lineWidth=2;
      piece.cells.forEach((row,r)=>row.forEach((v,c)=>{ if(v) ctx.strokeRect((piece.x+c)*CELL+2,(gy+r)*CELL+2,CELL-4,CELL-4); }));
      ctx.lineWidth=1;
      piece.cells.forEach((row,r)=>row.forEach((v,c)=>{ if(v && piece.y+r>=0) cellPx((piece.x+c)*CELL,(piece.y+r)*CELL,piece.type,ctx); }));
    }
    drawNext(); drawHold();
  }

  /* ── stats / overlay ── */
  function fmtBest(){
    if (mode==='sprint'){ const s=allStats().tetris; return (s && s.week===wk && s.best!=null) ? fmtHMS(s.best*1000) : '—'; }
    if (mode==='survival'){ const z=allStats().tetriszen; return (z && z.best!=null) ? fmtHMS(z.best) : '—'; }
    const zs=allStats().tetriszenscore; return (zs && zs.best!=null) ? String(zs.best) : '—';   // Zen best score
  }
  function renderStatsLabels(){
    $$('tgoallabel').textContent = mode==='sprint' ? 'Lines left' : 'Lines';
    $$('ttimelabel').textContent = scored() ? 'Score' : 'Time';
    const bestRow = $$('tbest').closest('.tstat');
    if (bestRow) bestRow.style.display = mode==='practice' ? 'none' : 'flex';   // practice isn't tracked
    $$('tbestlabel').textContent = mode==='sprint' ? 'Best (wk)' : (mode==='survival' ? 'Best (all-time)' : 'Best score');
    $$('tbest').textContent = fmtBest();
    updatePracticeBtns();
  }
  function updateStats(){
    $$('ttime').textContent = scored() ? String(score) : fmtHMS(elapsedMs);
    $$('tgoal').textContent = mode==='sprint' ? Math.max(0, TARGET-cleared) : cleared;
  }
  function showOver(title, sub, actions){
    const o=$$('tover');
    let html='<div><div class="tovt">'+title+'</div>'+(sub?'<div class="tovs">'+sub+'</div>':'');
    if (actions && actions.length) html+='<div class="tovbtns">'+actions.map((a,i)=>'<button class="btn'+(i===0?' primary':'')+'" type="button" data-i="'+i+'">'+a.label+'</button>').join('')+'</div>';
    html+='</div>';
    o.innerHTML=html; o.hidden=false; o._actions=actions||null;
    if (actions) [...o.querySelectorAll('.tovbtns .btn')].forEach(b=>b.onclick=e=>{ e.stopPropagation(); actions[+b.dataset.i].fn(); });
  }
  function hideOver(){ $$('tover').hidden=true; $$('tover')._actions=null; }

  /* ── game flow ── */
  function emptyBoard(){ grid=Array.from({length:ROWS},()=>new Array(COLS).fill(null)); piece=null; hold=null; queue=[]; cleared=0; score=0; elapsedMs=0; }
  function begin(){
    if (saveable()) clearState();              // starting fresh discards any saved game
    emptyBoard(); newRng();
    holdUsed=false; moveDir=0; dasCharged=false; softHeld=false; rotHeld=false; rotCharged=false;
    grounded=false; lockStart=0; lockResets=0; dropAcc=0;
    spawnNext(performance.now());
    undoStack.length=0; redoStack.length=0; if (mode==='practice') pushHistory();   // initial snapshot
    phase='playing'; baseTime=Date.now(); lastTick=performance.now(); hideOver();
    $$('tstart').textContent='Restart'; $$('tpause').textContent='Pause';
    clearInterval(loopId); loopId=setInterval(loop,16);
    renderStatsLabels(); updateSaveBtn(); updateStats(); draw();
  }

  /* ── save / resume across devices (Zen + Survival) ── */
  function serialize(){
    return { grid: grid.map(r=>r.slice()),
             piece: piece ? { type:piece.type, x:piece.x, y:piece.y, rot:piece.rot, cells:piece.cells.map(r=>r.slice()) } : null,
             queue: queue.slice(), hold, holdUsed, cleared, score, elapsedMs, bag: bag.slice() };
  }
  function applyState(s){
    grid = (s.grid||[]).map(r=>r.slice());
    if (grid.length!==ROWS) emptyBoard();      // guard against a malformed save
    piece = s.piece ? { type:s.piece.type, x:s.piece.x, y:s.piece.y, rot:s.piece.rot||0, cells:s.piece.cells.map(r=>r.slice()) } : null;
    queue = Array.isArray(s.queue) ? s.queue.slice() : [];
    hold = s.hold||null; holdUsed = !!s.holdUsed; cleared = s.cleared||0; score = s.score||0; elapsedMs = s.elapsedMs||0;
    rnd = mulberry32((Math.random()*4294967296)>>>0); bag = Array.isArray(s.bag) ? s.bag.slice() : [];
    moveDir=0; dasCharged=false; softHeld=false; rotHeld=false; rotCharged=false;
    grounded=false; lockStart=0; lockResets=0; dropAcc=0;
    fillQueue();
    if (!piece) spawnNext(performance.now());
  }
  function resumeGame(s){
    applyState(s);
    phase='playing'; baseTime=Date.now()-elapsedMs; lastTick=performance.now(); hideOver();
    $$('tstart').textContent='Restart'; $$('tpause').textContent='Pause';
    clearInterval(loopId); loopId=setInterval(loop,16);
    renderStatsLabels(); updateSaveBtn(); updateStats(); draw();
  }
  function updateSaveBtn(){ const b=$$('tsave'); if (b){ b.style.display = saveable() ? '' : 'none'; b.textContent='Save'; } }
  function flashSave(msg){ const b=$$('tsave'); if (!b) return; b.textContent=msg;
    clearTimeout(saveFlashTimer); saveFlashTimer=setTimeout(()=>{ const x=$$('tsave'); if (x) x.textContent='Save'; }, 1600); }
  async function saveGame(){
    if (!saveable()) return;
    if (phase!=='playing' && phase!=='paused'){ flashSave('Nothing to save'); return; }
    if (!TT.myEmail()){ flashSave('Sign in to save'); return; }
    flashSave('Saving…');
    try {
      await TT.api('/api/gamestate', { method:'PUT', body:{ mode, state: serialize() } });
      if (mode==='zen') submitZen(score);      // reflect the ongoing game's score on the board
      flashSave('Saved ✓');
    } catch(e){ flashSave('Save failed'); }
  }
  async function clearState(){
    savedState = null;
    if (!saveable() || !TT.myEmail()) return;
    try { await TT.api('/api/gamestate', { method:'DELETE', params:{ mode } }); } catch(e){}
  }
  function togglePause(){
    if (phase==='playing'){ phase='paused'; pauseAt=Date.now(); $$('tpause').textContent='Resume'; showOver('Paused', tap('Press '+keyLabel(cfg.keys.pause)+' to resume', 'Tap to resume')); }
    else if (phase==='paused'){ phase='playing'; baseTime += Date.now()-pauseAt; lastTick=performance.now(); $$('tpause').textContent='Pause'; hideOver(); }
  }
  function end(won){
    phase='over'; clearInterval(loopId);
    if (won){ SFX.win(); flash('big'); } else { SFX.lose(); flash('redon'); shake(); }
    const restart = tap('Restart ('+keyLabel(cfg.keys.restart)+')', 'Tap to restart');
    if (mode==='sprint'){
      if (won){ const el=elapsedMs/1000; const s=allStats(); const t=(s.tetris&&s.tetris.week===wk)?s.tetris:{week:wk,best:null};
        if (t.best==null||el<t.best) t.best=el; s.tetris={week:wk,best:t.best}; TT.set('tt.stats',s);
        submitScore(Math.round(elapsedMs)); showOver('Cleared 40 in '+fmtHMS(elapsedMs)+'!', restart); }
      else showOver('Topped out.', restart);
    } else if (mode==='survival'){
      const ms=Math.round(elapsedMs); const s=allStats(); const z=s.tetriszen||{best:null};
      if (z.best==null||ms>z.best) z.best=ms; s.tetriszen={best:z.best}; TT.set('tt.stats',s);
      submitScore(ms); showOver('Survived '+fmtHMS(ms), restart);
      clearState();
    } else if (mode==='practice'){   // nothing tracked — offer undo of the fatal piece
      showOver('Topped out on '+score, cleared+' lines · '+tap('Undo the last piece, or '+restart, 'Undo the last piece, or tap to restart'));
    } else {   // zen — track best score locally + push current/best to the Zen board
      const s=allStats(); const zs=s.tetriszenscore||{best:null};
      if (zs.best==null||score>zs.best) zs.best=score; s.tetriszenscore={best:zs.best}; TT.set('tt.stats',s);
      submitZen(score);
      showOver('Topped out on '+score, cleared+' lines · '+restart);
      clearState();
    }
    renderStatsLabels(); draw();
  }

  /* ── leaderboards ──
     Sprint: weekly (tetris_score) + all-time (sprint_best) as two tabs.
     Survival: all-time longest survival (zen_score).
     Zen: everyone's current score next to their all-time best (zen_board). ── */
  let sprintBoards = { week:null, all:null }, sprintTab = 'week';
  async function submitScore(ms){        // sprint (40-clear) or survival (top-out)
    if (!TT.myEmail()) return;
    try {
      if (mode==='survival'){ renderTimeLB(await TT.api('/api/tetris',{method:'POST',body:{mode:'zen',ms}}), 'Longest survivals (all-time)'); }
      else {
        /* the weekly board is still written to even while it is hidden, so turning
           weekly boards back on brings every score back with it */
        const [w,a] = await Promise.all([
          TT.api('/api/tetris',{method:'POST',body:{mode:'sprint',week:wk,timeMs:ms}}),
          TT.api('/api/tetris',{method:'POST',body:{mode:'sprintall',timeMs:ms}})
        ]);
        sprintBoards={week:w,all:a}; renderSprintLB();
      }
    } catch(e){}
  }
  async function submitZen(sc){
    if (!TT.myEmail()) return;
    try { renderZenLB(await TT.api('/api/tetris',{method:'POST',body:{mode:'zenscore',score:sc}})); } catch(e){}
  }
  async function loadLB(){
    const el=$$('tlb'); if (!el) return;
    if (mode==='practice'){ el.innerHTML=''; return; }   // practice has no board
    if (!TT.myEmail()){ el.innerHTML=''; return; }
    try {
      if (mode==='sprint'){
        await siteSettings();
        if (!weeklyOn()){ sprintTab='all';
          sprintBoards={week:null,all:await TT.api('/api/tetris',{params:{mode:'sprintall'}})}; renderSprintLB(); return; }
        const [w,a] = await Promise.all([ TT.api('/api/tetris',{params:{mode:'sprint',week:wk}}), TT.api('/api/tetris',{params:{mode:'sprintall'}}) ]);
        sprintBoards={week:w,all:a}; renderSprintLB();
      } else if (mode==='survival'){ renderTimeLB(await TT.api('/api/tetris',{params:{mode:'zen'}}), 'Longest survivals (all-time)'); }
      else { renderZenLB(await TT.api('/api/tetris',{params:{mode:'zenscore'}})); }
    } catch(e){ if($$('tlb')) $$('tlb').innerHTML=''; }
  }
  function rowsHTML(d, fmt){
    const rows=(d && d.top)||[];
    let html=rows.map((r,i)=>'<div class="tlbrow'+(r.you?' me':'')+'"><span class="rk">'+(i+1)+'</span>'+
      '<span class="nm">'+esc(r.name)+'</span><span class="tm">'+fmt(r)+'</span></div>').join('');
    if (d && d.meRank && d.meRank>rows.length)
      html+='<div class="tlbrow me"><span class="rk">'+d.meRank+'</span><span class="nm">You</span><span class="tm">'+fmt({time_ms:d.meBest})+'</span></div>';
    return html;
  }
  function renderTimeLB(d, title){
    const el=$$('tlb'); if (!el || !alive) return;
    const rows=(d && d.top)||[];
    if (!rows.length && (!d || d.meBest==null)){ el.innerHTML='<h3>'+title+'</h3><p class="how">No times yet. Set the first one.</p>'; return; }
    el.innerHTML='<h3>'+title+'</h3>'+rowsHTML(d, r=>fmtHMS(r.time_ms));
  }
  function renderSprintLB(){
    const el=$$('tlb'); if (!el || !alive) return;
    if (!weeklyOn()) sprintTab='all';
    const d = sprintTab==='week' ? sprintBoards.week : sprintBoards.all;
    const tabs = weeklyOn() ? '<div class="glbtabs"><button type="button" class="glbtab'+(sprintTab==='week'?' cur':'')+'" data-t="week">This week</button>'+
      '<button type="button" class="glbtab'+(sprintTab==='all'?' cur':'')+'" data-t="all">All time</button></div>' : '';
    const rows=(d && d.top)||[];
    const body = (!rows.length && (!d||d.meBest==null)) ? '<p class="how">No times yet. Set the first one.</p>' : rowsHTML(d, r=>fmtHMS(r.time_ms));
    el.innerHTML='<div class="glbhd"><h3>Sprint, fastest times'+(weeklyOn()?'':' (all-time)')+'</h3>'+tabs+'</div>'+body;
    [...el.querySelectorAll('.glbtab')].forEach(b=>b.onclick=()=>{ sprintTab=b.dataset.t; renderSprintLB(); });
  }
  function renderZenLB(d){
    const el=$$('tlb'); if (!el || !alive) return;
    const rows=(d && d.top)||[];
    if (!rows.length && (!d || d.meBest==null)){ el.innerHTML='<h3>Zen scores</h3><p class="how">No scores yet. Set the first one.</p>'; return; }
    let html='<h3>Zen scores</h3><div class="tlbrow tlbhd"><span class="rk">#</span><span class="nm">Player</span><span class="tm">Now</span><span class="tm">Best</span></div>'+
      rows.map((r,i)=>'<div class="tlbrow'+(r.you?' me':'')+'"><span class="rk">'+(i+1)+'</span>'+
        '<span class="nm">'+esc(r.name)+'</span><span class="tm">'+r.current+'</span><span class="tm">'+r.best+'</span></div>').join('');
    if (d && d.meRank && d.meRank>rows.length)
      html+='<div class="tlbrow me"><span class="rk">'+d.meRank+'</span><span class="nm">You</span><span class="tm">'+(d.meCurrent||0)+'</span><span class="tm">'+(d.meBest||0)+'</span></div>';
    el.innerHTML=html;
  }

  /* ── modes ── */
  const MODES=[
    ['sprint','Sprint','Clear 40 lines as fast as you can. Weekly board.'],
    ['survival','Survival','Endless, and it gets faster. All-time board.'],
    ['zen','Zen','Endless and relaxed. No clock, no leaderboard.'],
    ['practice','Practice','Undo and redo as much as you like. Nothing is tracked.']
  ];
  function renderModes(){
    $$('tmodes').innerHTML = MODES.map(([id,name,desc])=>'<button class="tmode'+(id===mode?' cur':'')+'" data-mode="'+id+'" title="'+desc+'">'+name+'</button>').join('');
    [...$$('tmodes').querySelectorAll('.tmode')].forEach(b=>b.onclick=()=>{ if (b.dataset.mode===mode) return; mode=b.dataset.mode; TT.set('tt.tetrismode',mode); toReady(); });
  }
  async function toReady(){
    phase='ready'; clearInterval(loopId); emptyBoard(); newRng();
    renderModes(); renderStatsLabels(); updateStats(); updateSaveBtn(); draw();
    $$('tstart').textContent='Start'; $$('tpause').textContent='Pause';
    const titles = { sprint:'Sprint: 40 lines', survival:'Survival: rising speed', zen:'Zen: endless and relaxed', practice:'Practice: undo and redo' };
    showOver(titles[mode], tap('Press Start or '+keyLabel(cfg.keys.hardDrop), 'Tap to start'));
    loadLB();
    if (saveable() && TT.myEmail()){          // offer to resume a saved game
      const forMode = mode;
      try {
        const r = await TT.api('/api/gamestate', { params:{ mode: forMode } });
        if (r && r.state && phase==='ready' && mode===forMode){
          savedState = r.state;
          showOver('Saved '+modeName()+' game', 'Pick up where you left off?',
            [{ label:'Resume', fn:()=>resumeGame(savedState) }, { label:'New game', fn:begin }]);
        }
      } catch(e){}
    }
  }

  /* ── controls / config panel ── */
  const ACTIONS=[['left','Move left'],['right','Move right'],['softDrop','Soft drop'],['hardDrop','Hard drop'],
                 ['rotateCW','Rotate CW'],['rotateCCW','Rotate CCW'],['rotate180','Rotate 180'],['hold','Hold'],['pause','Pause'],['restart','Restart']];
  function keyLabel(k){ return k===' '?'Space':k==='ArrowLeft'?'←':k==='ArrowRight'?'→':k==='ArrowUp'?'↑':k==='ArrowDown'?'↓':(k&&k.length===1)?k.toUpperCase():k; }
  function renderKeyHint(){ const K=cfg.keys;
    if (TOUCH){ $$('tkeyhint').textContent = 'Hold ◀ ▶ to slide. Tap the board to rotate.'; return; }
    $$('tkeyhint').innerHTML =
    keyLabel(K.left)+' '+keyLabel(K.right)+' move · '+keyLabel(K.rotateCW)+' cw · '+keyLabel(K.rotateCCW)+' ccw · '+keyLabel(K.rotate180)+' 180 · '+
    keyLabel(K.softDrop)+' soft · '+keyLabel(K.hardDrop)+' drop · '+keyLabel(K.hold)+' hold · '+keyLabel(K.pause)+' pause · '+keyLabel(K.restart)+' restart'; }
  function slider(k,label,unit,min,max){ return '<div class="tslider"><label>'+label+': <b id="tslv_'+k+'">'+cfg[k]+'</b>'+unit+'</label>'+
    '<input type="range" id="tsl_'+k+'" min="'+min+'" max="'+max+'" value="'+cfg[k]+'"></div>'; }
  function renderCfg(){
    const c=$$('tcfg');
    c.innerHTML =
      '<div class="tcfghd"><b>Controls &amp; handling</b><button class="btn" id="tcfgclose" type="button">Close</button></div>' +
      '<p class="how" style="margin:0 0 10px">Click a key, then press the new one. Handling is in milliseconds.</p>' +
      '<div class="tkeys">' + ACTIONS.map(([a,label])=>'<div class="tkeyrow"><span>'+label+'</span>'+
        '<button class="btn tkeybtn" type="button" data-act="'+a+'">'+(rebinding===a?'press a key…':keyLabel(cfg.keys[a]))+'</button></div>').join('') + '</div>' +
      '<div class="tsliders">'+slider('das','DAS (delay before auto-shift)','ms',0,400)+slider('arr','ARR (auto-shift repeat)','ms',0,120)+
        slider('sdf','Soft drop (lower = faster, 0 = instant)','ms/cell',0,120)+slider('dcd','DAS cut delay','ms',0,100)+
        slider('grav','Gravity: how fast pieces fall (lower is faster)','ms/cell',20,1200)+'</div>' +
      '<label class="tcheck"><input type="checkbox" id="tacc"'+(cfg.accel?' checked':'')+'> Accelerate side-to-side the longer you hold</label>' +
      '<div style="margin-top:12px"><button class="btn" id="tcfgreset" type="button">Reset to defaults</button></div>';
    $$('tcfgclose').onclick=()=>{ rebinding=null; c.hidden=true; };
    $$('tcfgreset').onclick=()=>{ cfg=JSON.parse(JSON.stringify(DEFAULTS)); saveCfg(); renderCfg(); renderKeyHint(); };
    [...c.querySelectorAll('.tkeybtn')].forEach(b=>b.onclick=()=>{ rebinding=b.dataset.act; renderCfg(); });
    ['das','arr','sdf','dcd','grav'].forEach(k=>{ const el=$$('tsl_'+k); if (el) el.oninput=()=>{ cfg[k]=+el.value; $$('tslv_'+k).textContent=el.value; saveCfg(); }; });
    const acc=$$('tacc'); if (acc) acc.onchange=()=>{ cfg.accel=acc.checked; saveCfg(); };
  }

  /* ── input ── */
  const keyMatch = (e, bound) => !!bound && (e.key===bound || (e.key.length===1 && e.key.toLowerCase()===String(bound).toLowerCase()));
  function onKey(e){
    if (rebinding){ if (e.key!=='Escape'){ cfg.keys[rebinding]=e.key; saveCfg(); } rebinding=null; renderCfg(); renderKeyHint(); e.preventDefault(); return; }
    const K=cfg.keys;
    if (keyMatch(e,K.restart)){ begin(); e.preventDefault(); return; }
    if (keyMatch(e,K.pause) && (phase==='playing'||phase==='paused')){ togglePause(); e.preventDefault(); return; }
    if (mode==='practice'){                                  // U / Ctrl+Z = undo, Y / Ctrl+Y = redo, any time
      const k = e.key.toLowerCase();
      if (k==='u' || (k==='z' && (e.ctrlKey||e.metaKey) && !e.shiftKey)){ undo(); e.preventDefault(); return; }
      if (k==='y' || ((e.ctrlKey||e.metaKey) && (k==='y' || (k==='z' && e.shiftKey)))){ redo(); e.preventDefault(); return; }
    }
    if (phase==='ready' || phase==='over'){ if (keyMatch(e,K.hardDrop)){ begin(); e.preventDefault(); } return; }
    if (phase!=='playing') return;
    const now=performance.now();
    if (keyMatch(e,K.left)){ if(!e.repeat){ moveDir=-1; dasStart=now; dasCharged=false; if (tryMove(-1,now)) SFX.move(); } }
    else if (keyMatch(e,K.right)){ if(!e.repeat){ moveDir=1; dasStart=now; dasCharged=false; if (tryMove(1,now)) SFX.move(); } }
    else if (keyMatch(e,K.softDrop)){ if(!e.repeat) dropAcc=0; softHeld=true; }
    else if (keyMatch(e,K.rotateCW)){ if(!e.repeat){ rotHeld=true; rotStart=now; rotCharged=false; if (tryRotate(1,now)) SFX.rotate(); } }
    else if (keyMatch(e,K.rotateCCW)){ if(!e.repeat){ if (tryRotate(-1,now)) SFX.rotate(); } }
    else if (keyMatch(e,K.rotate180)){ if(!e.repeat){ if (tryRotate(2,now)) SFX.rotate(); } }
    else if (keyMatch(e,K.hardDrop)){ if(!e.repeat){ hardDrop(now); } }
    else if (keyMatch(e,K.hold)){ if(!e.repeat){ doHold(now); } }
    else return;
    e.preventDefault(); draw();
  }
  function onKeyUp(e){
    const K=cfg.keys;
    if (keyMatch(e,K.left)){ if (moveDir===-1){ moveDir=0; dasCharged=false; } }
    else if (keyMatch(e,K.right)){ if (moveDir===1){ moveDir=0; dasCharged=false; } }
    else if (keyMatch(e,K.softDrop)){ softHeld=false; }
    else if (keyMatch(e,K.rotateCW)){ rotHeld=false; rotCharged=false; }
  }

  /* ── wire up ── */
  /* ── touch: the pad does what the keys do; tapping the board rotates ── */
  if (TOUCH){
    wirePad($$('tpad'), act => {
      if (phase==='ready' || phase==='over'){ if (act==='hardDrop') begin(); return; }
      if (phase!=='playing') return;
      const now=performance.now();
      if (act==='left' || act==='right'){ const d = act==='left' ? -1 : 1;
        moveDir=d; dasStart=now; dasCharged=false; if (tryMove(d,now)) SFX.move(); }
      else if (act==='softDrop'){ dropAcc=0; softHeld=true; }
      else if (act==='rotateCW'){ if (tryRotate(1,now)) SFX.rotate(); }
      else if (act==='rotateCCW'){ if (tryRotate(-1,now)) SFX.rotate(); }
      else if (act==='hardDrop'){ hardDrop(now); }
      else if (act==='hold'){ doHold(now); }
      if (phase==='playing') draw();
    }, act => {
      if (act==='left' && moveDir===-1){ moveDir=0; dasCharged=false; }
      else if (act==='right' && moveDir===1){ moveDir=0; dasCharged=false; }
      else if (act==='softDrop') softHeld=false;
    });
    onSwipe(can, () => {}, { step:40, tapFn:() => {
      if (phase==='playing'){ if (tryRotate(1, performance.now())) SFX.rotate(); draw(); } } });
  }
  /* on a phone, starting brings the board and pad into view */
  const toBoard = () => { if (!TOUCH) return; const g = document.querySelector('#twrap .tgame');
    if (g && g.scrollIntoView) g.scrollIntoView({ block:'start', behavior: reduced() ? 'auto' : 'smooth' }); };
  $$('tstart').onclick = () => { begin(); toBoard(); };
  $$('tpause').onclick = () => { if (phase==='playing'||phase==='paused') togglePause(); };
  $$('tundo').onclick = undo;
  $$('tredo').onclick = redo;
  $$('tsave').onclick = saveGame;
  $$('tcontrols').onclick = () => { const c=$$('tcfg'); c.hidden=!c.hidden; if (!c.hidden) renderCfg(); };
  $$('tover').onclick = () => { if ($$('tover')._actions) return; if (phase==='paused') togglePause(); else begin(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);

  renderModes(); renderKeyHint(); toReady();   // ready, NOT auto-started

  return () => { alive=false; clearInterval(loopId);
                 document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); };
};

/* ── Classroom ─────────────────────────────────────────────────────
   Uses the rooms from your own timetable: each round names a class and
   you type which room it runs in. Self-contained — no directory calls. */
BUILD.classroom = host => {
  head(host, 'Classroom',
    'Multiple choice from your own timetable: rooms, teachers and classes. It speeds up as you go, three slips and the run ends.',
    '<div id="cr"></div>');
  const box = $('cr');
  let alive = true, timer = null;
  (async () => {
    box.innerHTML = '<p class="how">Loading…</p>';
    try {
      if (!gwData) gwData = await loadGuessData();
      if (!alive) return;
      ready();
    } catch (err){
      if (alive) box.innerHTML = '<p class="how">Could not load: ' + esc(err.message) + '</p>';
    }
  })();

  function ready(){
    if (timer){ clearInterval(timer); timer = null; }
    const rooms = (gwData.rooms || []).filter(r => r.room && r.subject);
    if (rooms.length < 3){
      box.innerHTML = '<p class="how">Your timetable doesn’t list enough rooms to play. Open your timetable first.</p>';
      return;
    }
    box.innerHTML =
      '<div class="crq"><div class="crsub">Ready?</div>' +
        '<div class="crclue">Name the room, teacher or class. You get 3 lives and the clock speeds up.</div></div>' +
      '<div class="gwrow"><button class="btn primary" id="crstart" type="button">Start</button></div>';
    $('sc').textContent = 'Best ' + (statVal('classroom','high') != null ? statVal('classroom','high') : '—');
    $('crstart').onclick = run;
  }

  function run(){
    if (timer){ clearInterval(timer); timer = null; }
    const rooms = (gwData.rooms || []).filter(r => r.room && r.subject);
    if (rooms.length < 3){
      box.innerHTML = '<p class="how">Your timetable doesn’t list enough rooms to play. Open your timetable first.</p>';
      return;
    }
    const uniq = a => [...new Set(a)];
    const norm = s => String(s).toLowerCase().replace(/\s+/g,'');
    const allRooms    = uniq(rooms.map(r => r.room));
    const allSubjects = uniq(rooms.map(r => r.subject));
    const withTeacher = rooms.filter(r => r.teacher);
    const allTeachers = uniq(withTeacher.map(r => r.teacher));
    const roomTxt   = r => r ? 'Room ' + r : '';
    const periodTxt = p => p ? (/^\d+$/.test(p) ? 'Period ' + p : p) : '';

    const types = ['room'];                                    /* only offer types with 4+ answers */
    if (allTeachers.length >= 3 && withTeacher.length >= 2) types.push('teacher');
    if (allSubjects.length >= 3) types.push('subject');

    let correct = 0, streak = 0, lives = 3, lastKey = '', qStart = 0;
    const timeFor = () => Math.max(4000, 12000 - correct*450 - streak*150);   // starts slow, speeds up

    /* a plausible wrong room code: one digit nudged by ±1 (ER0018.169 → ER0019.168) */
    function nearMiss(code){
      const pos = []; for (let i=0;i<code.length;i++) if (/\d/.test(code[i])) pos.push(i);
      if (!pos.length) return code + '2';
      const i = pos[(Math.random()*pos.length)|0];
      let d = +code[i], nd = Math.random()<0.5 ? d+1 : d-1;
      if (nd < 0) nd = 1; if (nd > 9) nd = 8; if (nd === d) nd = (d+1)%10;
      return code.slice(0,i) + nd + code.slice(i+1);
    }
    /* 4 options: the answer plus distinct distractors from the same field */
    function opts4(pool, answer){
      const out = [answer];
      for (const v of shuffle(pool.slice())){
        if (out.length >= 4) break;
        if (!out.some(o => norm(o) === norm(v))) out.push(v);
      }
      return shuffle(out);
    }
    /* rooms get one-digit-off red herrings mixed with real other rooms, so the
       options look confusingly alike rather than obviously different buildings */
    function roomOpts(answer){
      const out = [answer];
      const pool = shuffle([ nearMiss(answer), nearMiss(answer), nearMiss(answer),
                             ...shuffle(allRooms.filter(r => norm(r) !== norm(answer))).slice(0,2) ]);
      for (const v of pool){ if (out.length >= 4) break;
        if (v && !out.some(o => norm(o) === norm(v))) out.push(v); }
      let guard = 0;
      while (out.length < 4 && guard++ < 30){ const v = nearMiss(answer);
        if (v && !out.some(o => norm(o) === norm(v))) out.push(v); }
      return shuffle(out);
    }
    function nextQ(){
      let type, cls, tries = 0;
      do {
        type = types[(Math.random()*types.length)|0];
        cls = (type === 'teacher' ? withTeacher : rooms)[(Math.random() * (type === 'teacher' ? withTeacher.length : rooms.length))|0];
      } while (type + ':' + cls.subject === lastKey && tries++ < 10);
      lastKey = type + ':' + cls.subject;

      let prompt, clue, answer, options;
      if (type === 'room'){
        prompt = 'Where is your ' + esc(cls.subject) + '?';
        clue = [cls.teacher ? 'with ' + cls.teacher : '', periodTxt(cls.period)].filter(Boolean).join(' · ');
        answer = cls.room; options = roomOpts(cls.room);
      } else if (type === 'teacher'){
        prompt = 'Who takes your ' + esc(cls.subject) + '?';
        clue = [roomTxt(cls.room), periodTxt(cls.period)].filter(Boolean).join(' · ');
        answer = cls.teacher; options = opts4(allTeachers, cls.teacher);
      } else {
        prompt = 'Which class runs in ' + esc(cls.room) + '?';
        clue = [cls.teacher ? 'with ' + cls.teacher : '', periodTxt(cls.period)].filter(Boolean).join(' · ');
        answer = cls.subject; options = opts4(allSubjects, cls.subject);
      }
      renderQ(prompt, clue, answer, options);
    }
    function renderQ(prompt, clue, answer, options){
      box.innerHTML =
        '<div class="crtimer"><i id="crbar" style="width:100%"></i></div>' +
        '<div class="crq"><div class="crprog">Correct ' + correct + ' · streak ' + streak + '</div>' +
          '<div class="crsub">' + prompt + '</div>' +
          (clue ? '<div class="crclue">' + esc(clue) + '</div>' : '') +
        '</div>' +
        '<div class="mcq" id="cropts"></div>' +
        '<div class="crlives" id="crlives"></div>';
      $('crlives').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
      $('sc').textContent = correct + ' correct';
      const wrap = $('cropts');
      options.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mcopt'; b.textContent = o;
        b.onclick = () => resolve(b, o === answer, answer, wrap);
        wrap.appendChild(b);
      });
      qStart = Date.now();
      const TIME = timeFor();
      const bar = $('crbar');
      timer = setInterval(() => {
        const left = Math.max(0, TIME - (Date.now() - qStart));
        bar.style.width = (left / TIME * 100) + '%';
        if (left <= 0){ clearInterval(timer); timer = null; resolve(null, false, answer, wrap); }
      }, 80);
    }
    function resolve(btn, right, answer, wrap){
      if (timer){ clearInterval(timer); timer = null; }
      [...wrap.children].forEach(b => { b.disabled = true; if (b.textContent === answer) b.classList.add('right'); });
      if (right){ correct++; streak++; SFX.good(); setTimeout(() => { if (alive) nextQ(); }, 520); }
      else { if (btn) btn.classList.add('wrong'); SFX.bad(); streak = 0; lives--;
        setTimeout(() => { if (!alive) return; lives ? nextQ() : finish(); }, 950); }
    }
    function finish(){
      SFX.lose();
      const best = recordStat('classroom', { key:'high', mode:'max', value:correct });
      box.innerHTML =
        '<div class="crq"><div class="crsub">' + correct + ' correct</div>' +
          '<div class="crmeta">best ' + best + '</div></div>' +
        '<div class="gwrow"><button class="btn primary" id="cragain" type="button">Play again</button></div>';
      $('sc').textContent = correct + ' correct';
      $('cragain').onclick = run;
    }
    nextQ();
  }
  return () => { alive = false; if (timer) clearInterval(timer); };
};

/* ── Six Degrees (timed gauntlet) ───────────────────────────────────
   Graph of your classmates linked by shared classes. You're dropped on a
   node and given a target; reach it and a NEW target appears instantly.
   Chain as many as you can before the clock runs out. Targets sit further
   away as your score climbs, so a lucky short hop can't carry the board.  */
BUILD.chain = host => {
  head(host, 'Six Degrees',
    'Chain classmate to classmate through a shared class. How many targets can you reach before the clock runs out?',
    '<div id="ch"></div>');
  const box = document.getElementById('ch');
  let alive = true, timer = null;
  const RUN_TIME = 90000;
  const clearTimer = () => { if (timer){ clearInterval(timer); timer = null; } };
  (async () => {
    box.innerHTML = '<p class="how">Loading…</p>';
    try {
      if (!gwData) gwData = await loadGuessData();
      if (!alive) return;
      startScreen();
    } catch (err){
      if (alive) box.innerHTML = '<p class="how">Could not load: ' + esc(err.message) + '</p>';
    }
  })();

  function build(){
    const nodes = (gwData.classPool || []).filter(p => p.subjects && p.subjects.length);
    if (nodes.length < 6) return null;
    const bySubj = new Map();
    nodes.forEach((p,i) => p.subjects.forEach(s => { if (!bySubj.has(s)) bySubj.set(s, []); bySubj.get(s).push(i); }));
    const adj = nodes.map(() => new Set());
    for (const arr of bySubj.values())
      for (let a=0; a<arr.length; a++) for (let b=a+1; b<arr.length; b++){ adj[arr[a]].add(arr[b]); adj[arr[b]].add(arr[a]); }
    const bfs = src => {
      const dist = nodes.map(() => Infinity); dist[src] = 0; const q = [src];
      for (let h=0; h<q.length; h++){ const c = q[h]; for (const n of adj[c]) if (dist[n] === Infinity){ dist[n] = dist[c]+1; q.push(n); } }
      return dist;
    };
    const sharedClass = (a,b) => nodes[a].subjects.find(s => nodes[b].subjects.includes(s));
    return { nodes, adj, bfs, sharedClass };
  }
  const rand = n => (Math.random()*n)|0;

  function startScreen(){
    const g = build();
    if (!g){ box.innerHTML = '<p class="how">Not enough classmates with shared classes to play. Open your timetable first.</p>'; return; }
    run(g);
  }

  function run(g){
    const { nodes, adj, bfs, sharedClass } = g;
    let cur = rand(nodes.length), tries = 0;
    while (adj[cur].size === 0 && tries++ < 50) cur = rand(nodes.length);   // start with edges
    let score = 0, target = null, dist = null, ended = false, started = false, t0 = 0;

    function pickTarget(){
      dist = bfs(cur);
      const minD = 2 + Math.min(4, Math.floor(score / 4));                  // further as you climb
      let cands = [];
      for (let d = minD; d >= 1 && !cands.length; d--)
        for (let i=0; i<nodes.length; i++) if (i !== cur && dist[i] !== Infinity && dist[i] >= d) cands.push(i);
      target = cands.length ? cands[rand(cands.length)] : null;
    }
    const tgtLine  = () => 'Reach <b>' + esc(nodes[target].name) + '</b>' + (nodes[target].year ? ' <span class="chyr">Yr ' + esc(nodes[target].year) + '</span>' : '');
    const metaLine = () => 'On <b>' + esc(nodes[cur].name) + '</b> · reached <b>' + score + '</b> · <b id="chclock">' + Math.ceil(RUN_TIME/1000) + 's</b> left';
    pickTarget();
    render();

    function render(){
      if (started && target == null){ finish(); return; }
      const nbrs = [...adj[cur]];
      let show = shuffle(nbrs.slice()).slice(0, 14);
      if (target != null && nbrs.includes(target) && !show.includes(target)) show[show.length-1] = target;
      show = shuffle(show);
      box.innerHTML =
        '<div class="crtimer"><i id="chbar" style="width:100%"></i></div>' +
        '<div id="chboard"' + (started ? '' : ' class="chdim"') + '>' +
          '<div class="chhead">' +
            '<div class="chtarget" id="chtgt">' + (started ? tgtLine() : 'Reach <b class="chblank">______</b>') + '</div>' +
            '<div class="chmeta" id="chmeta">' + (started ? metaLine() : 'On <b class="chblank">______</b> · ' + (RUN_TIME/1000) + 's') + '</div>' +
          '</div>' +
          '<div class="chopts" id="chopts"></div>' +
        '</div>' +
        (started ? '' : '<div class="chstartwrap"><button class="btn primary" id="chstart" type="button">Start run</button></div>');
      const opts = document.getElementById('chopts');
      show.forEach((n, idx) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chopt' + (started ? ' chflip' : ' chface');
        if (started) b.style.animationDelay = (idx*25) + 'ms';
        b.innerHTML = '<span class="cnm">' + esc(nodes[n].name) + '</span><em>via ' + esc(sharedClass(cur,n) || 'shared class') + '</em>';
        b.onclick = () => move(n);
        opts.appendChild(b);
      });
      if (!started){
        document.getElementById('chstart').onclick = startRun;
        document.getElementById('sc').textContent = 'Best ' + (statVal('chain','targets') != null ? statVal('chain','targets') : '—');
      } else document.getElementById('sc').textContent = 'Reached ' + score;
    }
    function startRun(){
      started = true; t0 = Date.now();
      render();                                   // reveal names (flip) + fill the target/on lines
      timer = setInterval(() => {
        if (ended) return;
        const left = Math.max(0, RUN_TIME - (Date.now() - t0));
        const bar = document.getElementById('chbar'); if (bar) bar.style.width = (left / RUN_TIME * 100) + '%';
        const clock = document.getElementById('chclock'); if (clock) clock.textContent = Math.ceil(left/1000) + 's';
        if (left <= 0) finish();
      }, 100);
    }
    function move(n){
      if (!started || ended) return;
      const hit = n === target;
      cur = n;
      if (hit){ score++; SFX.good(); pickTarget(); } else SFX.move();
      render();
    }
    function finish(){
      if (ended) return;
      ended = true; clearTimer();
      const best = recordStat('chain', { key:'targets', mode:'max', value:score });  // metric matches LB → auto-submits
      recordStat('chain', { key:'runs', mode:'count', value:1 });
      SFX.win();
      box.innerHTML =
        '<div class="chhead"><div class="chtarget">Time! You reached <b>' + score + '</b> ' + (score===1?'target':'targets') + '.</div>' +
          '<div class="chmeta">Best run <b>' + best + '</b></div></div>' +
        '<div class="gwrow"><button class="btn primary" id="chagain" type="button">Play again</button></div>';
      document.getElementById('sc').textContent = 'Reached ' + score;
      document.getElementById('chagain').onclick = () => startScreen();
    }
  }
  return () => { alive = false; clearTimer(); };
};

/* ── Odd One Out ───────────────────────────────────────────────────
   Fast recall on your own classes: three of four people are in a class
   of yours, one isn't — spot the outsider before the bar empties.     */
BUILD.oddone = host => {
  head(host, 'Odd One Out',
    'Three of the four share a class of yours. Tap the one who doesn’t before the bar empties. Three misses ends the run.',
    '<div id="oo"></div>');
  const box = $('oo');
  let alive = true, timer = null;
  (async () => {
    box.innerHTML = '<p class="how">Loading…</p>';
    try { if (!gwData) gwData = await loadGuessData(); if (!alive) return; start(); }
    catch (err){ if (alive) box.innerHTML = '<p class="how">Could not load: ' + esc(err.message) + '</p>'; }
  })();
  function start(){
    if (timer){ clearInterval(timer); timer = null; }
    const pool = (gwData.classPool || []).filter(p => p.subjects && p.subjects.length);
    const bySubj = new Map();
    pool.forEach(p => p.subjects.forEach(s => { if (!bySubj.has(s)) bySubj.set(s, []); bySubj.get(s).push(p); }));
    const subjects = [...bySubj.keys()].filter(s => bySubj.get(s).length >= 3 && bySubj.get(s).length < pool.length);
    if (!subjects.length){
      box.innerHTML = '<p class="how">Not enough classmates across your classes to play yet. Open your timetable first.</p>';
      return;
    }
    let score = 0, streak = 0, lives = 3, lastSubj = '';
    const TIME0 = 8000, TMIN = 3000, runStart = Date.now();
    function round(){
      let subj, tries = 0;
      do { subj = subjects[(Math.random()*subjects.length)|0]; } while (subj === lastSubj && subjects.length > 1 && tries++ < 6);
      lastSubj = subj;
      const three = shuffle(bySubj.get(subj).slice()).slice(0, 3);
      const odd = shuffle(pool.filter(p => !p.subjects.includes(subj)))[0];
      if (!odd){ start(); return; }
      render(subj, shuffle([...three, odd]), odd);
    }
    function render(subj, cards, odd){
      /* speeds up with your streak AND with time survived in the run */
      const elapsed = Date.now() - runStart;
      const time = Math.max(TMIN, TIME0 - streak*300 - Math.floor(elapsed/8000)*300);
      box.innerHTML =
        '<div class="crtimer"><i id="oobar" style="width:100%"></i></div>' +
        '<div class="crq"><div class="crprog">Score ' + score + ' · streak ' + streak + '</div>' +
          '<div class="crsub">Who is <u>not</u> in your ' + esc(subj) + '?</div></div>' +
        '<div class="mcq" id="ooopts"></div>' +
        '<div class="crlives">' + '❤️'.repeat(lives) + '🖤'.repeat(3 - lives) + '</div>';
      $('sc').textContent = 'Score ' + score;
      const wrap = $('ooopts');
      cards.forEach(p => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'mcopt';
        if (p === odd) b.dataset.odd = '1';
        b.innerHTML = '<span>' + esc(p.name) + '</span>' + (p.year ? '<em>Yr ' + esc(p.year) + '</em>' : '');
        b.onclick = () => resolve(b, p === odd, wrap);
        wrap.appendChild(b);
      });
      const t0 = Date.now(), bar = $('oobar');
      timer = setInterval(() => {
        const left = Math.max(0, time - (Date.now() - t0));
        bar.style.width = (left / time * 100) + '%';
        if (left <= 0){ clearInterval(timer); timer = null; resolve(null, false, wrap); }
      }, 80);
    }
    function resolve(btn, right, wrap){
      if (timer){ clearInterval(timer); timer = null; }
      [...wrap.children].forEach(b => { b.disabled = true; if (b.dataset.odd) b.classList.add('right'); });
      if (right){ score++; streak++; SFX.good(); recordStat('oddone', { key:'high', mode:'max', value:score });
        setTimeout(() => { if (alive) round(); }, 520); }
      else { if (btn) btn.classList.add('wrong'); SFX.bad(); streak = 0; lives--;
        setTimeout(() => { if (!alive) return; lives ? round() : finish(); }, 1000); }
    }
    function finish(){
      SFX.lose();
      const best = statVal('oddone', 'high') || score;
      box.innerHTML =
        '<div class="crq"><div class="crsub">Score ' + score + '</div><div class="crmeta">best ' + best + '</div></div>' +
        '<div class="gwrow"><button class="btn primary" id="ooagain" type="button">Play again</button></div>';
      $('sc').textContent = 'Score ' + score;
      $('ooagain').onclick = start;
    }
    round();
  }
  return () => { alive = false; if (timer) clearInterval(timer); };
};

/* ── Memory (match pairs) ─────────────────────────────────────────── */
BUILD.memory = host => {
  const LV = { easy:{r:3,c:4,label:'Easy'}, med:{r:4,c:4,label:'Medium'}, hard:{r:4,c:6,label:'Hard'} };
  let lvl = TT.get('tt.memLvl', 'easy'); if (!LV[lvl]) lvl = 'easy';
  const FACES = ['🐶','🐱','🦊','🐼','🐧','🦉','🐢','🐙','🦋','🌵','🍩','🍕','⚽','🎸','🚀','🎲','🔥','🌈','⭐','🍉','🐝','🦕','🎧','🧩'];
  head(host, 'Memory', 'Flip two cards a turn. Clear every pair in as few moves as you can.',
    '<div class="minesbar"><div class="diffbar" id="memlvl"></div>' +
      '<div class="minesinfo"><span id="memmoves">Moves 0</span><span id="memtime">⏱ 0</span></div></div>' +
    '<div id="memgrid"></div>' +
    '<div class="minesfoot"><button class="btn primary" id="memnew" type="button">New game</button></div>');
  const grid = $('memgrid');
  let cards, up, matched, moves, locked, tstart, timer = null, started;
  const stopTimer = () => { if (timer){ clearInterval(timer); timer = null; } };
  const startTimer = () => { tstart = Date.now();
    timer = setInterval(() => { $('memtime').textContent = '⏱ ' + Math.floor((Date.now()-tstart)/1000); }, 250); };
  function paint(){
    grid.innerHTML = '';
    cards.forEach((c,i) => {
      const d = document.createElement('div');
      d.className = 'memcard' + (matched.has(i) ? ' done' : (up.includes(i) ? ' up' : ''));
      d.innerHTML = '<span class="face">' + c + '</span>';
      d.onclick = () => flip(i);
      grid.appendChild(d);
    });
    $('memmoves').textContent = 'Moves ' + moves;
  }
  function flip(i){
    if (locked || up.includes(i) || matched.has(i)) return;
    if (!started){ started = true; startTimer(); }
    up.push(i); SFX.flip(); paint();
    if (up.length === 2){
      moves++; $('memmoves').textContent = 'Moves ' + moves;
      const [a,b] = up;
      if (cards[a] === cards[b]){ matched.add(a); matched.add(b); up = []; SFX.good(); paint();
        if (matched.size === cards.length) win(); }
      else { locked = true; setTimeout(() => { up = []; locked = false; paint(); }, 700); }
    }
  }
  function win(){
    stopTimer(); SFX.win();
    const secs = Math.round((Date.now()-tstart)/1000);
    const best = recordStat('memory', { key:'best'+lvl, mode:'min', value:moves });
    recordStat('memory', { key:'plays', mode:'count', value:1 });
    $('sc').textContent = 'Cleared ' + LV[lvl].label + ' in ' + moves + ' moves · ' + secs + 's · best ' + best;
  }
  function reset(){
    const L = LV[lvl], n = L.r*L.c/2;
    const faces = shuffle(FACES.slice()).slice(0, n);
    cards = shuffle([...faces, ...faces]);
    grid.style.gridTemplateColumns = 'repeat(' + L.c + ',1fr)';
    up = []; matched = new Set(); moves = 0; locked = false; started = false; stopTimer();
    $('memtime').textContent = '⏱ 0'; $('sc').textContent = n + ' pairs';
    paint();
  }
  const bar = $('memlvl');
  Object.entries(LV).forEach(([k,L]) => {
    const p = document.createElement('button'); p.type = 'button'; p.className = 'diffpill'; p.textContent = L.label;
    p.setAttribute('aria-pressed', k === lvl);
    p.onclick = () => { lvl = k; TT.set('tt.memLvl', k);
      [...bar.children].forEach(c => c.setAttribute('aria-pressed', c === p)); reset(); };
    bar.appendChild(p);
  });
  $('memnew').onclick = reset;
  reset();
  return () => stopTimer();
};

/* ── Snake ─────────────────────────────────────────────────────── */
BUILD.snake = host => {
  head(host, 'Snake', tap('Arrow keys or WASD. Press R after a crash.', 'Swipe on the board or use the arrows. Tap the board after a crash.'),
       '<canvas id="cv" width="320" height="320"></canvas>' +
       (TOUCH ? '<div class="tpad dpad" id="snpad">' +
         '<button type="button" data-act="u" aria-label="Up">▲</button>' +
         '<button type="button" data-act="l" aria-label="Left">◀</button>' +
         '<button type="button" data-act="d" aria-label="Down">▼</button>' +
         '<button type="button" data-act="r" aria-label="Right">▶</button></div>' : ''));
  const ctx = $('cv').getContext('2d'), N = 16, S = 20;
  let snake = [{x:8,y:8}], dir = {x:1,y:0}, next = dir,
      food = {x:4,y:4}, score = 0, dead = false, recorded = false;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const steer = m => {
    if (m[0] === -dir.x && m[1] === -dir.y) return;   /* no instant reverse */
    next = {x:m[0], y:m[1]};
  };
  const key = e => {
    const k = e.key.toLowerCase();
    const m = {arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],
               arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
    if (!m) return;
    e.preventDefault();
    steer(m);
  };
  const DIRS = { u:[0,-1], d:[0,1], l:[-1,0], r:[1,0] };
  const again = () => { snake=[{x:8,y:8}]; dir={x:1,y:0}; next=dir; score=0; dead=false; recorded=false; };
  if (TOUCH){
    onSwipe($('cv'), d => steer(DIRS[d]), { step:22, repeat:true, tapFn:() => { if (dead) again(); } });
    wirePad($('snpad'), a => { if (dead) again(); else steer(DIRS[a]); });
  }
  addEventListener('keydown', key);
  const tick = () => {
    if (dead) return;
    dir = next;
    const h = {x:(snake[0].x+dir.x+N)%N, y:(snake[0].y+dir.y+N)%N};
    if (snake.some(p => p.x===h.x && p.y===h.y)){ dead = true; }
    else {
      snake.unshift(h);
      if (h.x===food.x && h.y===food.y){
        score++; SFX.tick();
        do { food = {x:(Math.random()*N)|0, y:(Math.random()*N)|0}; }
        while (snake.some(p => p.x===food.x && p.y===food.y));
      } else snake.pop();
    }
    if (dead && !recorded){ recorded = true; SFX.lose(); recordStat('snake', {key:'high', mode:'max', value:score}); }
    $('sc').textContent = dead ? 'Dead on ' + score + ' (best ' + (statVal('snake','high')||score) + ') · ' + tap('press R', 'tap to restart')
                               : 'Score ' + score + (statVal('snake','high') ? ' · best ' + statVal('snake','high') : '');
    ctx.clearRect(0,0,320,320);
    ctx.fillStyle = css('--accent');
    snake.forEach(p => ctx.fillRect(p.x*S+1, p.y*S+1, S-2, S-2));
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(food.x*S+3, food.y*S+3, S-6, S-6);
  };
  const restart = e => {
    if (e.key.toLowerCase() !== 'r' || !dead) return;
    again();
  };
  addEventListener('keydown', restart);
  let t = null;                                     /* self-scheduling so pace can ramp with score */
  const loop = () => { tick(); t = setTimeout(loop, dead ? 130 : Math.max(55, 112 - score*4)); };
  loop();
  return () => { clearTimeout(t); removeEventListener('keydown', key); removeEventListener('keydown', restart); };
};

/* ── 2048 (animated) ───────────────────────────────────────────────
   Tiles are absolutely positioned and keep a stable id, so a move
   transitions each one to its new cell instead of teleporting.       */
BUILD.g2048 = host => {
  head(host, '2048', tap('Arrow keys or WASD. Combine matching tiles.', 'Swipe to slide the tiles. Combine matching ones.'),
       '<div id="g2048wrap"><div id="g2048bg"></div><div id="g2048tiles"></div></div>');
  const GAP = 8, FULL = 74;
  let CELL = FULL, STEP = CELL + GAP;
  const wrap = $('g2048wrap'), bg = $('g2048bg'), layer = $('g2048tiles');
  wrap.style.cssText = 'position:relative;width:' + (4*STEP-GAP) + 'px;max-width:100%;aspect-ratio:1';
  /* tiles are placed in pixels, so on a screen narrower than the board the
     cells shrink to fit rather than the tiles running off the grid */
  const fit = () => {
    wrap.style.width = (4*(FULL+GAP)-GAP) + 'px';
    const w = wrap.clientWidth, cell = w ? Math.min(FULL, Math.floor((w - 3*GAP) / 4)) : FULL;
    const changed = cell !== CELL;
    CELL = cell; STEP = CELL + GAP;
    wrap.style.width = (4*STEP-GAP) + 'px';
    return changed;
  };
  fit();
  bg.style.cssText = 'position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);gap:' + GAP + 'px';
  for (let i=0;i<16;i++){ const d=document.createElement('div'); d.className='cell2048'; bg.appendChild(d); }
  layer.style.cssText = 'position:absolute;inset:0';

  let tiles = [], score = 0, uid = 0, busy = false;
  const at = (r,c) => tiles.find(t => t.r===r && t.c===c);
  const spawn = () => {
    const free = [];
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) if (!at(r,c)) free.push([r,c]);
    if (!free.length) return;
    const [r,c] = free[(Math.random()*free.length)|0];
    tiles.push({ id:++uid, r, c, val: Math.random()<0.9?2:4, isNew:true });
  };
  const tint = v => 'color-mix(in srgb, var(--accent) ' + Math.min(82, 10+Math.log2(v)*9) + '%, var(--panel))';
  const paint = () => {
    const seen = new Set();
    tiles.forEach(t => {
      let el = layer.querySelector('[data-id="' + t.id + '"]');
      if (!el){
        el = document.createElement('div'); el.className='tile2048'; el.dataset.id=t.id;
        el.style.cssText = 'position:absolute;width:' + CELL + 'px;height:' + CELL + 'px;'+
          'display:flex;align-items:center;justify-content:center;border-radius:calc(var(--card-radius)*.5);'+
          'font-family:var(--font-num);font-weight:700;font-size:1.375rem;color:var(--text);'+
          'transition:transform .13s ease;will-change:transform';
        el.style.transform = 'translate(' + (t.c*STEP) + 'px,' + (t.r*STEP) + 'px)';
        layer.appendChild(el);
        if (t.isNew){ el.animate([{transform:el.style.transform+' scale(.1)',opacity:0},
                                   {transform:el.style.transform+' scale(1)',opacity:1}],
                                  {duration:130,easing:'ease'}); }
      }
      el.textContent = t.val;
      el.style.width = el.style.height = CELL + 'px';
      el.style.background = tint(t.val);
      el.style.fontSize = (t.val>=1000?17:t.val>=100?20:22)+'px';
      el.style.transform = 'translate(' + (t.c*STEP) + 'px,' + (t.r*STEP) + 'px)';
      if (t.pop){ el.animate([{transform:el.style.transform+' scale(1)'},
                              {transform:el.style.transform+' scale(1.18)'},
                              {transform:el.style.transform+' scale(1)'}],{duration:150,easing:'ease'}); t.pop=false; }
      seen.add(String(t.id));
    });
    layer.querySelectorAll('.tile2048').forEach(el => { if (!seen.has(el.dataset.id)) el.remove(); });
    $('sc').textContent = 'Score ' + score + (statVal('g2048','high') ? ' · best ' + statVal('g2048','high') : '');
  };

  /* slide/merge one ordered line of tiles (already sorted in travel direction) */
  function collapse(lineTiles){
    let moved = false;
    const out = [];
    for (let i=0;i<lineTiles.length;i++){
      const t = lineTiles[i], nxt = lineTiles[i+1];
      if (nxt && nxt.val === t.val && !t._merged && !nxt._merged){
        t._merged = true; nxt._merged = true; nxt._gone = true;
        out.push({ keep:t, absorbed:nxt, val:t.val*2 });
        i++;                                   /* skip the absorbed one */
      } else out.push({ keep:t, val:t.val });
    }
    return out;
  }
  function move(dir){
    if (busy) return;
    const before = tiles.map(t => t.id+':'+t.r+','+t.c+'='+t.val).join('|');
    tiles.forEach(t => { t._merged=false; t._gone=false; });
    const lines = [];
    for (let k=0;k<4;k++){
      let line = tiles.filter(t => (dir==='l'||dir==='r') ? t.r===k : t.c===k);
      line.sort((a,b) => (dir==='l'||dir==='u') ? (a.c+a.r)-(b.c+b.r) : (b.c+b.r)-(a.c+a.r));
      lines.push({ k, line });
    }
    lines.forEach(({k, line}) => {
      const merged = collapse(line);
      merged.forEach((m, idx) => {
        const pos = (dir==='l'||dir==='u') ? idx : 3-idx;
        if (dir==='l'){ m.keep.r=k; m.keep.c=pos; }
        if (dir==='r'){ m.keep.r=k; m.keep.c=pos; }
        if (dir==='u'){ m.keep.c=k; m.keep.r=pos; }
        if (dir==='d'){ m.keep.c=k; m.keep.r=pos; }
        if (m.absorbed){ m.absorbed.r=m.keep.r; m.absorbed.c=m.keep.c; }   /* slide onto target */
      });
    });
    /* first move the absorbed tiles onto their target (animate), then merge values */
    paint();
    const changed = tiles.map(t => t.id+':'+t.r+','+t.c).join('|') !== before.replace(/=\d+/g,'');
    const anyGone = tiles.some(t => t._gone);
    if (!changed && !anyGone) return;
    busy = true;
    setTimeout(() => {
      tiles = tiles.filter(t => !t._gone);
      let didMerge = false;
      tiles.forEach(t => { if (t._merged && !t._gone){ t.val*=2; score+=t.val; t.pop=true; didMerge = true;
        recordStat('g2048', {key:'high', mode:'max', value:score}); } });
      if (didMerge) SFX.place();
      spawn();
      paint();
      busy = false;
      if (isOver()){ SFX.lose(); $('sc').textContent = 'Game over on ' + score + ' · best ' + statVal('g2048','high'); }
    }, 130);
  }
  function isOver(){
    if (tiles.length < 16) return false;
    for (const t of tiles){
      for (const [dr,dc] of [[0,1],[1,0]]){ const n=at(t.r+dr,t.c+dc); if (n && n.val===t.val) return false; }
    }
    return true;
  }
  const key = e => {
    const m = {arrowleft:'l',a:'l',arrowright:'r',d:'r',arrowup:'u',w:'u',arrowdown:'d',s:'d'}[e.key.toLowerCase()];
    if (!m) return; e.preventDefault(); move(m);
  };
  addEventListener('keydown', key);
  const refit = () => { if (fit()) paint(); };
  addEventListener('resize', refit);
  if (TOUCH) onSwipe(wrap, move, { step:30 });
  spawn(); spawn(); paint();
  return () => { removeEventListener('keydown', key); removeEventListener('resize', refit); };
};

/* ── Minesweeper ───────────────────────────────────────────────── */
BUILD.mines = host => {
  const LV = {
    easy: { n:9,  m:10, label:'Easy' },
    med:  { n:13, m:28, label:'Medium' },
    hard: { n:16, m:45, label:'Hard' }
  };
  let lvl = TT.get('tt.minesLvl', 'easy'); if (!LV[lvl]) lvl = 'easy';
  head(host, 'Minesweeper',
    tap('Dig to open, right-click (or Flag mode) to flag. Your first dig is always safe. Click a number once its flags match to sweep the rest.',
        'Tap to dig, hold a square (or use Flag mode) to flag it. Your first dig is always safe. Tap a number once its flags match to sweep the rest.'),
    '<div class="minesbar"><div class="diffbar" id="mlvl"></div>' +
      '<div class="minesinfo"><span id="mflags">💣 0</span><span id="mtime">⏱ 0</span></div></div>' +
    '<div id="mines"></div>' +
    '<div class="minesfoot"><button class="btn primary" id="mnew" type="button">New game</button>' +
    '<button class="btn" id="mflagmode" type="button" aria-pressed="false">🚩 Flag mode: off</button></div>');
  const grid = $('mines');
  let N, MINES, bomb, open, flag, over, first, tstart, timer = null, flagMode = false;
  let holdTimer = null, heldAt = 0;
  const idx = (r,c) => r*N+c;
  const around = i => {
    const r=(i/N)|0, c=i%N, out=[];
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++){
      const nr=r+dr, nc=c+dc;
      if ((dr||dc) && nr>=0 && nr<N && nc>=0 && nc<N) out.push(idx(nr,nc));
    }
    return out;
  };
  const count = i => around(i).filter(j => bomb[j]).length;
  const seed = safe => {                       /* first dig and its neighbours are always mine-free */
    const banned = new Set([safe, ...around(safe)]);
    bomb = Array(N*N).fill(false);
    let placed = 0, guard = 0;
    while (placed < MINES && guard++ < 200000){
      const i = (Math.random()*N*N)|0;
      if (bomb[i] || banned.has(i)) continue;
      bomb[i] = true; placed++;
    }
  };
  const info = () => { $('mflags').textContent = '💣 ' + (MINES - flag.filter(Boolean).length); };
  const startTimer = () => { tstart = Date.now();
    timer = setInterval(() => { if (!over) $('mtime').textContent = '⏱ ' + Math.floor((Date.now()-tstart)/1000); }, 250); };
  const dig = i => {
    if (over || open[i] || flag[i]) return;
    if (first){ seed(i); first = false; startTimer(); }
    open[i] = true;
    if (bomb[i]){ lose(); return; }
    if (count(i) === 0) around(i).forEach(dig);
  };
  const chord = i => {                          /* sweep neighbours when their flags equal the number */
    if (!open[i] || bomb[i]) return;
    const n = count(i); if (!n) return;
    const nb = around(i);
    if (nb.filter(j => flag[j]).length !== n) return;
    nb.forEach(j => { if (!flag[j]) dig(j); });
  };
  const stopTimer = () => { if (timer){ clearInterval(timer); timer = null; } };
  const lose = () => { over = true; stopTimer(); SFX.lose();
    for (let i=0;i<N*N;i++) if (bomb[i]) open[i] = true;   /* reveal every mine */
    paint(); $('sc').textContent = 'Boom. Hit New game to try again.'; };
  const win = () => { over = true; stopTimer(); SFX.win();
    const secs = Math.round((Date.now()-tstart)/1000);
    recordStat('mines', { key:'cleared', mode:'count', value:1 });
    const best = recordStat('mines', { key:'best'+lvl, mode:'min', value:secs });
    for (let i=0;i<N*N;i++) if (bomb[i]) flag[i] = true;
    info(); paint(); $('sc').textContent = 'Cleared ' + LV[lvl].label + ' in ' + secs + 's · best ' + best + 's'; };
  const check = () => {
    if (over) return;
    const opened = open.filter(Boolean).length;
    if (opened === N*N - MINES) win();
    else $('sc').textContent = (N*N - MINES - opened) + ' safe square' + (N*N-MINES-opened===1?'':'s') + ' left';
  };
  const paint = () => {
    grid.innerHTML = '';
    for (let i=0;i<N*N;i++){
      const b = document.createElement('button'); b.type = 'button';
      if (open[i]){
        if (bomb[i]){ b.className = 'open boom'; b.textContent = '💣'; }
        else { const n = count(i); b.className = 'open' + (n ? ' n'+n : ''); b.textContent = n || ''; }
      } else if (flag[i]){
        if (over && !bomb[i]){ b.className = 'flag wrong'; b.textContent = '✕'; }
        else { b.className = 'flag'; b.textContent = '🚩'; }
      }
      const ii = i;
      if (TOUCH){                                /* hold to flag, since there's no right-click */
        b.addEventListener('pointerdown', () => { clearTimeout(holdTimer);
          holdTimer = setTimeout(() => { holdTimer = null;
            if (over || open[ii]) return;
            flag[ii] = !flag[ii]; heldAt = Date.now(); SFX.flip();
            try { if (navigator.vibrate) navigator.vibrate(15); } catch {}
            paint(); info(); }, 380); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => clearTimeout(holdTimer)));
      }
      b.onclick = () => {
        if (over) return;
        if (TOUCH && Date.now() - heldAt < 700) return;   // the lift after a hold isn't a dig
        if (flagMode && !open[ii]){ flag[ii] = !flag[ii]; SFX.flip(); paint(); info(); return; }
        const wasOpen = open[ii];
        if (wasOpen) chord(ii); else dig(ii);
        if (!over && open[ii] && !wasOpen) SFX.place();
        paint(); info(); check();
      };
      b.oncontextmenu = e => { e.preventDefault();
        if (TOUCH && Date.now() - heldAt < 1200) return;  // a phone's long-press menu, already handled
        if (over || open[ii]) return; flag[ii] = !flag[ii]; SFX.flip(); paint(); info(); };
      grid.appendChild(b);
    }
  };
  const reset = () => {
    const L = LV[lvl]; N = L.n; MINES = L.m;
    grid.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';
    bomb = []; open = []; flag = []; over = false; first = true; stopTimer();
    $('mtime').textContent = '⏱ 0'; info(); paint(); check();
  };
  const bar = $('mlvl');
  Object.entries(LV).forEach(([k,L]) => {
    const p = document.createElement('button');
    p.type = 'button'; p.className = 'diffpill'; p.textContent = L.label;
    p.setAttribute('aria-pressed', k === lvl);
    p.onclick = () => { lvl = k; TT.set('tt.minesLvl', k);
      [...bar.children].forEach(c => c.setAttribute('aria-pressed', c === p)); reset(); };
    bar.appendChild(p);
  });
  $('mnew').onclick = reset;
  const fm = $('mflagmode');
  fm.onclick = () => { flagMode = !flagMode; fm.setAttribute('aria-pressed', flagMode);
    fm.textContent = '🚩 Flag mode: ' + (flagMode ? 'on' : 'off'); fm.classList.toggle('primary', flagMode); };
  reset();
  return () => stopTimer();
};

/* ── Typing race ───────────────────────────────────────────────── */
BUILD.typing = host => {
  head(host, 'Typing race', 'A fresh random line every time. The clock starts on your first keystroke.',
       '<div id="typetext"></div><input id="typein" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Start typing…">' +
       '<div class="minesfoot"><button class="btn" id="typenew" type="button">New text</button></div>');
  /* random-word lines so nothing can be memorised or looked up */
  const WORDS = ('time year people way day man thing woman life child world school state family student group '+
    'country problem hand part place case week company system program question work government number night point '+
    'home water room mother area money story fact month lot right study book eye job word business issue side kind '+
    'head house friend father power hour game line end member law car city community name team minute idea body '+
    'back parent face level office door health person art war history party result change morning reason research '+
    'girl guy moment air teacher force education foot boy age policy music market sense nation plan college '+
    'quick brown fox jumps lazy dog river light stone bright cloud simple garden window paper coffee ').split(/\s+/).filter(Boolean);
  const makeLine = () => {
    const n = 9 + ((Math.random()*4)|0);          // 9–12 words
    const out = [];
    for (let i=0;i<n;i++) out.push(WORDS[(Math.random()*WORDS.length)|0]);
    return out.join(' ');
  };
  let target = makeLine(), started = 0, done = false, prevLen = 0, cheated = false;
  const paint = val => {
    $('typetext').innerHTML = [...target].map((ch,i) => {
      const c = ch === ' ' ? '&nbsp;' : ch;
      if (i >= val.length) return '<b>' + c + '</b>';
      return val[i] === ch ? '<u>' + c + '</u>' : '<i>' + c + '</i>';
    }).join('');
  };
  const inp = $('typein');
  /* block the obvious cheats: paste, drop, autofill dumps, and any single
     input event that leaps more than 2 chars forward (a programmatic paste) */
  inp.addEventListener('paste', e => { e.preventDefault(); cheated = true; $('sc').textContent = 'No pasting, type it out'; });
  inp.addEventListener('drop',  e => e.preventDefault());
  const onInput = () => {
    let v = inp.value;
    if (v.length - prevLen > 2){        // a jump this big isn't human keystrokes
      cheated = true; v = v.slice(0, prevLen + 1); inp.value = v;
    }
    prevLen = v.length;
    if (!started && v.length) started = Date.now();
    paint(v);
    if (!done && v === target){
      done = true;
      const secs = (Date.now() - started) / 1000;
      const wpm = Math.round((target.split(' ').length / secs) * 60);
      if (cheated || wpm > 1000 || secs < 0.5){    // disqualify implausible runs
        $('sc').textContent = 'Disqualified for pasting (' + wpm + ' wpm)';
      } else {
        recordStat('typing', {key:'wpm', mode:'max', value:wpm});
        $('sc').textContent = wpm + ' wpm in ' + secs.toFixed(1) + 's · top ' + statVal('typing','wpm');
      }
      inp.disabled = true;
    } else if (!done){
      const wrong = [...v].filter((ch,i) => ch !== target[i]).length;
      $('sc').textContent = wrong ? wrong + ' wrong' : v.length + '/' + target.length;
    }
  };
  function reset(){
    target = makeLine(); started = 0; done = false; prevLen = 0; cheated = false;
    inp.value = ''; inp.disabled = false;
    paint(''); $('sc').textContent = '0/' + target.length; inp.focus();
  }
  inp.addEventListener('input', onInput);
  $('typenew').onclick = reset;
  paint(''); $('sc').textContent = '0/' + target.length;
  return () => {};
};

/* ── Reaction test ─────────────────────────────────────────────── */
BUILD.react = host => {
  head(host, 'Reaction', 'Best of five.',
       '<div id="react">' + tap('Click', 'Tap') + ' to start</div>');
  const el = $('react');
  let state = 'idle', t = null, at = 0, times = [];
  const show = (cls, text) => { el.className = cls; el.textContent = text; };
  const arm = () => {
    show('wait', 'Wait for green…');
    state = 'wait';
    /* record the stimulus time on the frame the green is actually painted, using a
       monotonic clock — so the timer starts when you SEE green, not a tick before */
    t = setTimeout(() => { state = 'go'; show('go', tap('CLICK', 'TAP'));
                           requestAnimationFrame(() => { at = performance.now(); }); },
                   900 + Math.random()*2200);
  };
  /* measure on pointerDOWN (the press), not click — click fires on release, which
     added the press-to-release time and inflated every reading */
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (state === 'idle'){ arm(); return; }
    if (state === 'wait'){ clearTimeout(t); state = 'idle'; SFX.bad(); show('', 'Too soon. ' + tap('Click', 'Tap') + ' to retry.'); return; }
    if (state === 'go'){
      const ms = Math.max(0, Math.round(performance.now() - at));
      times.push(ms); SFX.good();
      const avg = Math.round(times.reduce((a,b)=>a+b,0) / times.length);
      recordStat('react', {key:'fastest', mode:'min', value:ms});
      $('sc').textContent = ms + ' ms · avg ' + avg + ' · fastest ' + statVal('react','fastest');
      if (times.length >= 5){
        state = 'idle'; times = [];
        show('', ms + ' ms. ' + tap('Click', 'Tap') + ' to go again.');
      } else { state = 'idle'; setTimeout(arm, 700); show('', ms + ' ms'); }
    }
  });
  return () => clearTimeout(t);
};

/* ── Leaderboards (read-only; owner controls live in Admin) ─────────── */
BUILD.leaderboards = host => {
  const howText = () => weeklyOn() ? 'Pick a game. Weekly resets each Monday, all-time never does.' : 'Pick a game. These are all-time boards.';
  head(host, 'Leaderboards', howText(), '<div id="lbp"></div>');
  const box = $('lbp');
  if (!TT.myEmail()){ box.innerHTML = '<p class="how">Sign in on the timetable to see the leaderboards.</p>'; return () => {}; }
  const wk = tetrisWeek();
  let cur = LB_CAT.find(c => c.id === lbFocus) || LB_CAT[0], period = 'all', data = null;
  box.innerHTML =
    '<div class="diffbar" id="lbpick" style="margin-bottom:14px"></div>' +
    '<div class="glbhd"><h3 id="lbtitle"></h3>' +
      '<div class="glbtabs"><button type="button" class="glbtab" data-p="week">This week</button>' +
      '<button type="button" class="glbtab cur" data-p="all">All time</button></div></div>' +
    '<div id="lbbody"><p class="how">Loading…</p></div>';
  const pick = $('lbpick');
  LB_CAT.forEach(c => { const b = document.createElement('button');
    b.type='button'; b.className='diffpill'; b.textContent=c.name; b.setAttribute('aria-pressed', c===cur);
    b.onclick = () => { cur=c; [...pick.children].forEach(x=>x.setAttribute('aria-pressed', x===b)); load(); };
    pick.appendChild(b); });
  [...box.querySelectorAll('.glbtab[data-p]')].forEach(b => b.onclick = () => {
    period = b.dataset.p; [...box.querySelectorAll('.glbtab[data-p]')].forEach(t=>t.classList.toggle('cur', t===b)); paint(); });
  load();

  const remap = (arr, key) => (arr||[]).map(r => ({ name:r.name, score:r[key], you:r.you }));
  async function load(){
    $('lbtitle').textContent = 'Leaderboard · ' + cur.name;
    const body = $('lbbody'); body.innerHTML = '<p class="how">Loading…</p>'; data=null;
    try {
      await siteSettings();
      const how = host.querySelector('.how'); if (how) how.textContent = howText();   // the setting may have landed since
      if (cur.g){
        data = await TT.api('/api/leaderboard', { params:{ game:cur.id, metric:cur.g.metric, week:wk } });
      } else if (cur.t === 'sprint'){
        const [w,a] = await Promise.all([ weeklyOn() ? TT.api('/api/tetris',{params:{mode:'sprint',week:wk}}) : null,
                                          TT.api('/api/tetris',{params:{mode:'sprintall'}}) ]);
        data = { week:w ? { top:remap(w.top,'time_ms'), meBest:w.meBest, meRank:w.meRank } : null,
                 all: { top:remap(a.top,'time_ms'), meBest:a.meBest, meRank:a.meRank } };
      } else if (cur.t === 'zen'){
        const d = await TT.api('/api/tetris',{params:{mode:'zen'}});
        const b = { top:remap(d.top,'time_ms'), meBest:d.meBest, meRank:d.meRank }; data = { week:b, all:b };
      } else if (cur.t === 'zenscore'){
        const d = await TT.api('/api/tetris',{params:{mode:'zenscore'}});
        const b = { top:remap(d.top,'best'), meBest:d.meBest, meRank:d.meRank }; data = { week:b, all:b };
      }
      syncTabs(); paint();
    } catch(e){ body.innerHTML = '<p class="how">Could not load: ' + esc(e.message) + '</p>'; }
  }
  function syncTabs(){
    /* survival and zen are all-time only — and so is everything, when the owner
       has turned weekly boards off */
    const single = (!cur.g && cur.t !== 'sprint') || !weeklyOn();
    const tabs = [...box.querySelectorAll('.glbtab[data-p]')];
    tabs.forEach(t => { if (t.dataset.p==='week') t.style.display = single ? 'none' : ''; });
    if (single){ period='all'; tabs.forEach(t=>t.classList.toggle('cur', t.dataset.p==='all')); }
  }
  function paint(){
    const body = $('lbbody'); if (!data){ body.innerHTML='<p class="how">Loading…</p>'; return; }
    const b = period==='week' ? data.week : data.all;
    if (!b){ body.innerHTML='<p class="how">No board.</p>'; return; }
    const rows = b.top || [];
    if (!rows.length && b.meBest==null){ body.innerHTML='<p class="how">No scores yet, be the first.</p>'; return; }
    let html = rows.map((r,i)=>'<div class="tlbrow'+(r.you?' me':'')+'"><span class="rk">'+(i+1)+'</span>'+
      '<span class="nm">'+esc(r.name)+'</span><span class="tm">'+esc(cur.fmt(r.score))+'</span></div>').join('');
    if (b.meRank && b.meRank>rows.length)
      html += '<div class="tlbrow me"><span class="rk">'+b.meRank+'</span><span class="nm">You</span><span class="tm">'+esc(cur.fmt(b.meBest))+'</span></div>';
    body.innerHTML = html;
  }
  return () => {};
};

/* ── Admin (owner only): reset a board, or edit/delete individual scores ── */
BUILD.admin = host => {
  head(host, 'Admin', 'Owner tools for the game boards. Changes happen straight away and everyone sees them.', '<div id="adm"></div>');
  const box = $('adm');
  if (!TT.myEmail()){ box.innerHTML = '<p class="how">Sign in on the timetable first.</p>'; return () => {}; }
  const wk = tetrisWeek();
  /* generic game_score boards + the Tetris boards (separate tables via /api/tetris) */
  const GEN = LB_CAT.filter(c => c.g).map(c => ({ id:c.id, name:c.name, kind:'g', metric:c.g.metric, fmt:c.fmt, valOf:r=>r.score }));
  const TET = [
    { id:'tsprint',    name:'Tetris Sprint (weekly)',    kind:'t', mode:'sprint',    fmt:fmtHMS,       valOf:r=>r.time_ms, sync:true, unit:'ms' },
    { id:'tsprintall', name:'Tetris Sprint (all-time)',  kind:'t', mode:'sprintall', fmt:fmtHMS,       valOf:r=>r.time_ms, sync:true, unit:'ms' },
    { id:'tsurv',      name:'Tetris Survival',           kind:'t', mode:'zen',       fmt:fmtHMS,       valOf:r=>r.time_ms, unit:'ms' },
    { id:'tzen',       name:'Tetris Zen',                kind:'t', mode:'zenscore',  fmt:v=>String(v), valOf:r=>r.best,    unit:'pts' }
  ];
  /* not a board: a roster of everyone who has actually used the site */
  const USERS = { id:'users', name:'Signed-in users', kind:'u' };
  /* not a board either: switches that apply to the whole site, for everyone */
  const SETTINGS = { id:'settings', name:'Site settings', kind:'s' };
  const CATS = [USERS, SETTINGS, ...GEN, ...TET];
  let cur = CATS[0], period = 'all', data = null, onboard = null;
  box.innerHTML =
    '<div class="diffbar" id="admpick" style="margin-bottom:14px"></div>' +
    '<div class="glbhd"><h3 id="admtitle"></h3>' +
      '<div class="glbtabs">' +
        '<button type="button" class="glbtab" data-p="week">This week</button>' +
        '<button type="button" class="glbtab cur" data-p="all">All time</button>' +
        '<button type="button" class="glbtab" id="admsync" hidden>Sync weekly → all-time</button>' +
        '<button type="button" class="glbtab glbwipe" id="admwipe">Reset board</button></div></div>' +
    '<p class="adminnote" id="admnote"></p>' +
    '<div id="admbody"><p class="how">Loading…</p></div>';
  const pick = $('admpick');
  CATS.forEach(c => { const b = document.createElement('button');
    b.type='button'; b.className='diffpill'; b.textContent=c.name; b.setAttribute('aria-pressed', c===cur);
    b.onclick = () => { cur=c; [...pick.children].forEach(x=>x.setAttribute('aria-pressed', x===b)); load(); };
    pick.appendChild(b); });
  [...box.querySelectorAll('.glbtab[data-p]')].forEach(b => b.onclick = () => {
    period = b.dataset.p; [...box.querySelectorAll('.glbtab[data-p]')].forEach(t=>t.classList.toggle('cur', t===b)); render(); });
  $('admwipe').onclick = wipeBoard;
  $('admsync').onclick = syncSprint;
  load();

  function syncTabsUI(){
    /* with weekly boards turned off there is only the all-time board to edit */
    const gen = cur.kind === 'g' && weeklyOn(), plain = cur.kind === 'u' || cur.kind === 's';
    if (!weeklyOn()) period = 'all';
    [...box.querySelectorAll('.glbtab[data-p]')].forEach(t => t.style.display = gen ? '' : 'none');
    $('admsync').hidden = !cur.sync;
    $('admwipe').style.display = plain ? 'none' : '';
  }
  async function load(){
    $('admtitle').textContent = cur.name; syncTabsUI();
    const body = $('admbody'); body.innerHTML = '<p class="how">Loading…</p>'; data = null;
    try {
      if (cur.kind === 's'){                       // site-wide switches, read fresh
        /* the server refuses a change from anyone but the owner; this is only so
           the switch isn't dangled in front of someone who can't use it */
        if (!isAdmin){ body.innerHTML = '<p class="how">You are not the owner. Set OWNER_EMAIL on the server to your school login.</p>'; return; }
        forgetSiteSettings(); await siteSettings();
        render(); return;
      }
      if (cur.kind === 'u'){                       // roster, not a board, so no canWipe on it
        data = await TT.api('/api/leaderboard', { params:{ users:1 } });
        /* onboarding lives in its own table; fold it in by email. Optional —
           if that endpoint is unavailable the roster still renders. */
        try { onboard = await TT.api('/api/onboarding', { params:{ all:1 } }); }
        catch { onboard = null; }
        render(); return;
      }
      if (cur.kind === 'g') data = await TT.api('/api/leaderboard', { params:{ game:cur.id, metric:cur.metric, week:wk } });
      else data = await TT.api('/api/tetris', { params:{ mode:cur.mode, week:wk, admin:1 } });
      if (!data.canWipe){ body.innerHTML = '<p class="how">You are not the owner. Set OWNER_EMAIL on the server to your school login.</p>'; return; }
      render();
    } catch(e){ body.innerHTML = '<p class="how">Could not load: ' + esc(e.message) + '</p>'; }
  }
  /* "3h" / "5d" / a date, for the last-seen column */
  function seenAgo(iso){
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '—';
    const s = Math.max(0, (Date.now() - t)/1000);
    if (s < 3600) return Math.max(1,Math.floor(s/60)) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    if (s < 2592000) return Math.floor(s/86400) + 'd ago';
    return new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short'});
  }
  function curRows(){
    if (!data) return [];
    if (cur.kind === 'g'){ const b = period==='week' ? data.week : data.all; return (b && b.top) || []; }
    return data.top || [];
  }
  function render(){
    syncTabsUI();
    $('admtitle').textContent = cur.name;
    if (cur.kind === 's'){
      const on = weeklyOn();
      $('admnote').textContent = 'These apply to the whole site, for everyone who opens it, not just to you.';
      $('admbody').innerHTML =
        '<div class="adminrow setrow"><span class="nm"><b>Weekly leaderboards</b><em>' +
        (on ? 'Every board has a “This week” tab next to “All time”.'
            : 'Every page shows the all-time board only, with no weekly tab. Scores still go to the weekly boards while it is off, so turning it back on brings them back.') +
        '</em></span><button class="btn' + (on ? ' primary' : '') + '" id="setweekly" type="button">' + (on ? 'On' : 'Off') + '</button></div>';
      $('setweekly').onclick = async () => {
        const b = $('setweekly'); b.disabled = true;
        try {
          const d = await TT.api('/api/leaderboard', { method:'POST', body:{ action:'settings', weeklyBoards:!on } });
          siteCfg = { weeklyBoards: d && d.weeklyBoards !== false };
          render();
        } catch (e){ alert('Could not save that: ' + e.message); b.disabled = false; }
      };
      return;
    }
    if (cur.kind === 'u'){
      const us = (data && data.users) || [];
      const active = us.filter(u => u.last && (Date.now() - new Date(u.last).getTime()) < 7*864e5).length;
      const steps = (onboard && onboard.steps) || [];
      const byEmail = {};
      ((onboard && onboard.users) || []).forEach(o => { byEmail[String(o.email).toLowerCase()] = o.seen || []; });
      const doneCount = us.filter(u => steps.length &&
        (byEmail[String(u.email).toLowerCase()] || []).length >= steps.length).length;

      $('admnote').textContent = us.length + ' ' + (us.length===1?'person has':'people have') +
        ' used the site, ' + active + ' in the last 7 days' +
        (steps.length ? ', ' + doneCount + ' through the whole tutorial.' : '.');

      const stage = email => {
        if (!steps.length) return '';
        const n = (byEmail[String(email).toLowerCase()] || []).filter(s => steps.includes(s)).length;
        const pct = Math.round(n / steps.length * 100);
        return '<span class="ob" title="' + n + ' of ' + steps.length + ' tutorial steps seen">' +
          '<span class="obbar' + (n >= steps.length ? ' done' : '') + '"><i style="width:' + pct + '%"></i></span>' +
          '<b>' + n + '/' + steps.length + '</b></span>';
      };

      $('admbody').innerHTML = us.length
        ? us.map((u,i) => '<div class="adminrow userrow">' +
            '<span class="rk">'+(i+1)+'</span>' +
            '<span class="nm">'+esc(u.name)+(u.renamed ? ' <span class="was" title="Name from their email">('+esc(u.auto)+')</span>' : '')+'</span>' +
            '<span class="ue">'+esc(u.email)+'</span>' +
            '<span class="uc">'+u.scores+' score'+(u.scores===1?'':'s')+' · '+u.days+' daily</span>' +
            stage(u.email) +
            '<span class="ul">'+esc(seenAgo(u.last))+'</span>' +
            '<button class="btn rename" type="button" data-email="'+esc(u.email)+'" data-name="'+esc(u.name)+'" data-auto="'+esc(u.auto || u.name)+'">Rename</button></div>').join('')
        : '<p class="how">Nobody has signed in yet.</p>';
      /* some people go by a different name from the one in their email; this
         changes what everyone else sees on leaderboards, the forum and shared events */
      $('admbody').querySelectorAll('.rename').forEach(b => b.onclick = async () => {
        const next = prompt('What should ' + b.dataset.email + ' be shown as?\nLeave it empty to go back to "' + b.dataset.auto + '".', b.dataset.name);
        if (next === null) return;
        b.disabled = true;
        try {
          await TT.api('/api/leaderboard', { method:'POST', body:{ action:'rename', email:b.dataset.email, name:next } });
          lbSumCache = null;
          load();
        } catch (e){ alert('Could not rename: ' + e.message); b.disabled = false; }
      });
      return;
    }
    $('admnote').textContent = cur.kind === 'g'
      ? 'Editing the ' + (period==='week' ? 'this-week' : 'all-time') + ' board.'
      : (cur.mode === 'sprint' ? 'Editing this week’s Sprint clears.' : 'Editing the ' + cur.name + ' board.');
    const rows = curRows(), body = $('admbody');
    if (!rows.length){ body.innerHTML = '<p class="how">No scores on this board.</p>'; return; }
    body.innerHTML = rows.map((r,i) => { const v = cur.valOf(r);
      return '<div class="adminrow" data-email="'+esc(r.email||'')+'">' +
        '<span class="rk">'+(i+1)+'</span><span class="nm">'+esc(r.name)+' · '+esc(cur.fmt(v))+'</span>' +
        '<input class="sc" type="number" value="'+v+'" aria-label="value"'+(cur.unit?' title="'+cur.unit+'"':'')+'>' +
        '<button class="btn" type="button" data-act="save">Save</button>' +
        '<button class="del" type="button" data-act="del">Delete</button></div>'; }).join('');
    [...body.querySelectorAll('.adminrow')].forEach(row => {
      const email = row.dataset.email;
      row.querySelector('[data-act=save]').onclick = () => edit('set', email, +row.querySelector('.sc').value);
      row.querySelector('[data-act=del]').onclick  = () => { if (confirm('Delete this score?')) edit('delete', email); };
    });
  }
  async function edit(action, email, value){
    try {
      if (cur.kind === 'g'){
        data = await TT.api('/api/leaderboard', { method:'POST',
          body:{ game:cur.id, metric:cur.metric, week:wk, action, email, period: period==='week' ? 'w'+wk : 'all', score:value } });
      } else {
        data = await TT.api('/api/tetris', { method:'POST', body:{ mode:cur.mode, action, email, value, week:wk } });
      }
      lbSumCache = null; render();
    } catch(e){ alert('Could not save: ' + e.message); }
  }
  async function wipeBoard(){
    if (!confirm('Clear the entire "'+cur.name+'" board for everyone? This cannot be undone.')) return;
    try {
      if (cur.kind === 'g') data = await TT.api('/api/leaderboard', { method:'POST', body:{ game:cur.id, metric:cur.metric, week:wk, score:0, action:'wipe' } });
      else data = await TT.api('/api/tetris', { method:'POST', body:{ mode:cur.mode, action:'wipe', week:wk } });
      lbSumCache = null; render();
    } catch(e){ alert('Could not reset: ' + e.message); }
  }
  async function syncSprint(){
    if (!confirm('Copy everyone’s best weekly Sprint time into the all-time board?')) return;
    try {
      data = await TT.api('/api/tetris', { method:'POST', body:{ action:'sync' } });
      lbSumCache = null;
      cur = TET.find(c => c.id === 'tsprintall'); [...pick.children].forEach((x,i)=>x.setAttribute('aria-pressed', String(CATS[i]===cur)));
      render();
    } catch(e){ alert('Could not sync: ' + e.message); }
  }
  return () => {};
};

/* ── Flashcards (revision): make decks and study them; saved to your account ── */
BUILD.flashcards = host => {
  head(host, 'Flashcards', 'Make your own decks and study them. Saved to your account and synced across devices.', '<div id="fc"></div>');
  const box = $('fc');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  let decks = TT.get('tt.flashcards', []); if (!Array.isArray(decks)) decks = [];
  const saveDecks = () => TT.set('tt.flashcards', decks);
  const deckById = id => decks.find(d => d.id === id);
  let deckId = null, study = null;
  list();

  function list(){
    let html = '<div class="fcrow"><button class="btn" id="fcbrowse" type="button">🌐 Browse public decks</button></div><div class="fcdecks">';
    html += decks.length ? decks.map(d => '<div class="fcdeck" data-id="'+d.id+'">' +
        '<span class="nm">'+esc(d.name)+'</span><span class="ct">'+d.cards.length+' card'+(d.cards.length===1?'':'s')+'</span>' +
        '<button class="btn" type="button" data-act="study">Study</button>' +
        '<button class="btn" type="button" data-act="edit">Edit</button>' +
        '<button class="btn" type="button" data-act="share">Share</button>' +
        '<button class="del" type="button" data-act="del">✕</button></div>').join('')
      : '<p class="how" style="margin:0">No decks yet. Create one below.</p>';
    html += '</div><div class="fcrow"><input id="fcnew" placeholder="New deck name…" maxlength="60" autocomplete="off">' +
      '<button class="btn primary" id="fcaddd" type="button">Create deck</button></div>';
    box.innerHTML = html;
    $('sc').textContent = decks.length + ' deck' + (decks.length===1?'':'s');
    const addDeck = () => { const v = $('fcnew').value.trim(); if (!v) return;
      const d = { id:uid(), name:v, cards:[] }; decks.push(d); saveDecks(); deckId = d.id; edit(); };
    $('fcaddd').onclick = addDeck;
    $('fcnew').addEventListener('keydown', e => { if (e.key==='Enter') addDeck(); });
    $('fcbrowse').onclick = browse;
    [...box.querySelectorAll('.fcdeck')].forEach(row => { const d = deckById(row.dataset.id);
      row.querySelector('[data-act=study]').onclick = () => { deckId=d.id; startStudy(); };
      row.querySelector('[data-act=edit]').onclick  = () => { deckId=d.id; edit(); };
      row.querySelector('[data-act=share]').onclick = () => shareDeck(d);
      row.querySelector('[data-act=del]').onclick   = () => { if (confirm('Delete deck "'+d.name+'"?')){ decks=decks.filter(x=>x.id!==d.id); saveDecks(); list(); } };
    });
  }

  const CATS = ['Maths','Physics','Chemistry','Biology','English','History','Geography','Languages','Business','Other'];
  function shareDeck(d){
    if (!TT.myEmail()){ alert('Sign in on the timetable to share decks.'); return; }
    if (!d.cards.length){ alert('Add some cards before sharing.'); return; }
    box.innerHTML =
      '<div class="fcrow"><button class="btn" id="fcback" type="button">← Decks</button></div>' +
      '<div class="crq"><div class="crsub">Share “'+esc(d.name)+'”</div>' +
        '<div class="crclue">'+d.cards.length+' cards will be public for anyone at school to import.</div></div>' +
      '<div class="fcrow"><span style="align-self:center">Category</span>' +
        '<select id="fccat" class="colsel" style="max-width:none;flex:1">'+CATS.map(c=>'<option>'+c+'</option>').join('')+'</select>' +
        '<button class="btn primary" id="fcpub" type="button">Publish</button></div>' +
      '<div class="fcprog" id="fcpubmsg"></div>';
    $('fcback').onclick = list;
    $('fcpub').onclick = async () => {
      $('fcpub').disabled = true; $('fcpubmsg').textContent = 'Publishing…';
      try { await TT.api('/api/decks', { method:'POST', body:{ name:d.name, category:$('fccat').value, cards:d.cards } });
        $('fcpubmsg').textContent = 'Published to '+$('fccat').value+' ✓'; SFX.good && SFX.good();
      } catch(e){ $('fcpub').disabled = false; $('fcpubmsg').textContent = 'Could not publish: ' + e.message; }
    };
  }

  let browseCat = '';
  async function browse(){
    if (!TT.myEmail()){ alert('Sign in on the timetable to browse decks.'); return; }
    box.innerHTML =
      '<div class="fcrow"><button class="btn" id="fcback" type="button">← My decks</button></div>' +
      '<div class="diffbar" id="fccats" style="margin-bottom:12px"></div>' +
      '<div id="fcpublist"><p class="how">Loading…</p></div>';
    $('fcback').onclick = list;
    let data;
    try { data = await TT.api('/api/decks', { params: browseCat ? { category:browseCat } : {} }); }
    catch(e){ $('fcpublist').innerHTML = '<p class="how">Could not load: '+esc(e.message)+'</p>'; return; }
    const cats = ['All', ...(data.categories||CATS)];
    $('fccats').innerHTML = cats.map(c => '<button class="diffpill" type="button" data-c="'+(c==='All'?'':c)+'" aria-pressed="'+((c==='All'?'':c)===browseCat)+'">'+c+'</button>').join('');
    [...$('fccats').children].forEach(b => b.onclick = () => { browseCat = b.dataset.c; browse(); });
    const decksP = data.decks || [];
    $('fcpublist').innerHTML = decksP.length ? decksP.map(d => '<div class="fcdeck" data-id="'+d.id+'">' +
        '<span class="nm">'+esc(d.name)+'</span>' +
        '<span class="ct">'+esc(d.category)+' · '+d.count+' · '+esc(d.author)+'</span>' +
        '<button class="btn primary" type="button" data-act="import">Import</button>' +
        (d.mine ? '<button class="del" type="button" data-act="del">✕</button>' : '') + '</div>').join('')
      : '<p class="how">No decks here yet. Share one from your list.</p>';
    [...$('fcpublist').querySelectorAll('.fcdeck')].forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-act=import]').onclick = async () => {
        try { const full = await TT.api('/api/decks', { params:{ id } });
          decks.push({ id:uid(), name: full.name + ' (imported)', cards: full.cards || [] }); saveDecks();
          alert('Imported “'+full.name+'” ('+(full.cards||[]).length+' cards).'); list();
        } catch(e){ alert('Could not import: ' + e.message); }
      };
      const del = row.querySelector('[data-act=del]');
      if (del) del.onclick = async () => { if (!confirm('Remove this public deck?')) return;
        try { await TT.api('/api/decks', { method:'POST', body:{ action:'delete', id } }); browse(); } catch(e){ alert(e.message); } };
    });
  }

  function edit(){
    const d = deckById(deckId); if (!d){ list(); return; }
    box.innerHTML =
      '<div class="fcrow"><button class="btn" id="fcback" type="button">← Decks</button>' +
        '<input id="fcname" value="'+esc(d.name)+'" maxlength="60" aria-label="Deck name"></div>' +
      '<div class="fcrow"><input id="fcq" placeholder="Front (question)…" autocomplete="off">' +
        '<input id="fca" placeholder="Back (answer)…" autocomplete="off">' +
        '<button class="btn primary" id="fccadd" type="button">Add card</button></div>' +
      '<div id="fclist"></div>';
    $('fcback').onclick = list;
    $('fcname').onchange = () => { d.name = $('fcname').value.trim() || 'Untitled'; saveDecks(); };
    const addCard = () => { const q=$('fcq').value.trim(), a=$('fca').value.trim(); if (!q||!a) return;
      d.cards.push({ q, a }); saveDecks(); $('fcq').value=''; $('fca').value=''; $('fcq').focus(); paintCards(); };
    $('fccadd').onclick = addCard;
    $('fca').addEventListener('keydown', e => { if (e.key==='Enter') addCard(); });
    paintCards();
    function paintCards(){
      $('sc').textContent = d.cards.length + ' card' + (d.cards.length===1?'':'s');
      $('fclist').innerHTML = d.cards.length ? d.cards.map((c,idx) => '<div class="fccardrow" data-i="'+idx+'">' +
        '<span class="qa"><b>'+esc(c.q)+'</b><em>'+esc(c.a)+'</em></span>' +
        '<button class="del" type="button">✕</button></div>').join('') : '<p class="how">No cards yet.</p>';
      [...$('fclist').querySelectorAll('.fccardrow')].forEach(row =>
        row.querySelector('.del').onclick = () => { d.cards.splice(+row.dataset.i,1); saveDecks(); paintCards(); });
    }
  }

  function startStudy(){
    const d = deckById(deckId); if (!d){ list(); return; }
    if (!d.cards.length){ alert('Add some cards to this deck first.'); edit(); return; }
    study = { order: shuffle(d.cards.map((_,i)=>i)), pos:0, showBack:false, got:0, again:0 };
    renderStudy();
  }
  function renderStudy(){
    const d = deckById(deckId);
    if (study.pos >= study.order.length){ studyDone(d); return; }
    const c = d.cards[study.order[study.pos]];
    box.innerHTML =
      '<div class="fcrow"><button class="btn" id="fcback" type="button">← Decks</button>' +
        '<button class="btn" id="fcshuffle" type="button">Shuffle</button></div>' +
      '<div class="fcface" id="fcface"><span class="lbl" id="fclbl">Front, tap to flip</span>' +
        '<span class="txt" id="fctxt">'+esc(c.q)+'</span></div>' +
      '<div class="fcbar" id="fcgrade" hidden><button class="btn" id="fcagain" type="button">Again</button>' +
        '<button class="btn primary" id="fcgot" type="button">Got it</button></div>' +
      '<div class="fcprog">Card '+(study.pos+1)+' of '+study.order.length+' · '+esc(d.name)+'</div>';
    $('sc').textContent = 'Studying ' + d.name;
    const face = $('fcface');
    face.onclick = () => { if (study.showBack) return; study.showBack = true; SFX.flip();
      $('fclbl').textContent = 'Back'; $('fctxt').textContent = c.a;
      if (gameAnim()){ face.classList.remove('flip'); void face.offsetWidth; face.classList.add('flip'); }
      $('fcgrade').hidden = false; };
    $('fcback').onclick = list;
    $('fcshuffle').onclick = () => { study.order = shuffle(study.order); study.pos = 0; study.showBack = false; renderStudy(); };
    const next = () => { study.pos++; study.showBack = false; renderStudy(); };
    $('fcagain').onclick = () => { study.again++; study.order.push(study.order[study.pos]); next(); };
    $('fcgot').onclick   = () => { study.got++; SFX.good(); next(); };
  }
  function studyDone(d){
    SFX.win();
    box.innerHTML =
      '<div class="fcface"><span class="lbl">Done</span><span class="txt">'+esc(d.name)+'<br>'+study.got+' got it · '+study.again+' to review</span></div>' +
      '<div class="fcbar"><button class="btn" id="fcback" type="button">← Decks</button>' +
        '<button class="btn primary" id="fcredo" type="button">Study again</button></div>';
    $('sc').textContent = '';
    $('fcback').onclick = list; $('fcredo').onclick = startStudy;
  }
  return () => {};
};

/* ── revision quiz engine (shared by the subject games) ───────────────
   opts = { title, how, statKey (also the game id), topics:[{id,name,gen}] }
   gen() returns { q(html), choices:[str], answer:str } for multiple choice,
   or { q, input:true, answer, accept?:fn } for a typed answer. Optional clue/note. */
/* topic id → the set of question keys it can ask (null = procedural, uncountable).
   Sampling a generator costs a few hundred draws, so it is done once per page
   load rather than every time a game is opened. */
const KEYSPACE = new Map();
function revGame(host, opts){
  head(host, opts.title, opts.how, '<div id="rv"></div>');
  const box = $('rv'), sk = opts.statKey;
  const modular = !!opts.modules;
  let score = 0, cur = null, answered = false, checking = false;
  /* the streak persists and rides the tt.* prefs sync, so it survives leaving
     the game and follows you to another device; `score` stays per-session */
  let streak = Math.max(0, +TT.get('tt.rev_'+sk+'_streak', 0) || 0);
  /* flat mode (Maths/Software): one topic pill row with a Mixed option */
  let topic = modular ? null : TT.get('tt.rev_'+sk, (opts.topics.length>1?'mix':opts.topics[0].id));
  if (!modular && topic!=='mix' && !opts.topics.some(t=>t.id===topic)) topic = opts.topics[0].id;
  /* modular mode (Chem/Physics/Eng): a module row + a subtopic multi-select row */
  let modId = modular ? TT.get('tt.rev_'+sk+'_mod','all') : null;
  if (modular && modId!=='all' && !opts.modules.some(m=>m.id===modId)) modId='all';
  let excl = (modular && TT.get('tt.rev_'+sk+'_excl',{})) || {};   // excluded subtopic ids
  /* spaced-repetition memory: hist[sig] = [seen, wrong] for keyed questions,
     persisted + synced so we favour ones you haven't done or got wrong.
     `recent` avoids repeating the last few within a session. */
  const hist = TT.get('tt.rev_'+sk+'_hist', {}) || {};
  const recent = [];
  const RECENT_MAX = 12;
  /* Enter drives the whole game: the first press checks your answer, the next
     one moves to the following question. Inside the code box a plain Enter still
     makes a newline (you're writing Python), so Ctrl/Cmd+Enter checks there.
     When the Next button already has focus we let it handle its own Enter, so a
     single press never advances twice. */
  function onEnter(e){
    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
    if (!isEnter || e.isComposing || e.altKey || checking) return;
    /* a focused module / subtopic pill keeps its own Enter, so keyboard users can
       still toggle topics rather than skipping the question */
    /* same for the practice/test switch and the test's own buttons: without this,
       Enter on "Practice" would also press Start on the screen being left */
    if (e.target && e.target.closest && e.target.closest('.rvsel, .rvsub, .rvmode, .rvend, .rvtabs, .rvrep, .rvlink, .rvhist')) return;
    if (!cur){ const s = $('rvstart'); if (s){ e.preventDefault(); s.click(); } return; }
    if (answered){
      /* handled here rather than letting the focused Next button activate, so
         one press always advances exactly once. A test moves on by itself, so
         Enter there would skip the following question. */
      e.preventDefault(); if (mode !== 'test') nextQ(); return;
    }
    if (cur.typed){                       // you're writing Python — Enter is a newline
      if (!(e.ctrlKey || e.metaKey)) return;
      if ($('rvta')){ e.preventDefault(); submit($('rvta').value); }
      return;
    }
    if (cur.input && $('rvin')){ e.preventDefault(); submit($('rvin').value); }
    /* multiple choice has nothing to check until you pick an option */
  }
  document.addEventListener('keydown', onEnter);

  const curMod = () => opts.modules.find(m=>m.id===modId);

  /* ── progress & streak ──────────────────────────────────────────────────
     Every question sits in one of four states, which is what the bar shows:
       correct (green)  right, and never wrong or right twice in a row since the miss
       fixed   (yellow) was wrong, and right once since; one more right turns it green
       wrong   (red)    the last attempt was wrong — still needs another go
       new     (grey)   not attempted yet
     hist[sig] = [seen, wrongness, lastOk, everWrong]. The first two drive the
     spaced-repetition picker; the last two drive these colours. Entries saved
     before this existed only have two slots and are migrated as they're read. */
  const STREAK_FULL = 8;
  const stateOf = sig => stateOfHist(hist[sig]);
  /* Every question a topic can ask. A bank knows exactly; a keyed generator is
     sampled until it stops yielding new keys; a purely procedural one (fresh
     numbers every time, no key) isn't countable and stays out of the bar. */
  function keySpace(t){
    const cacheId = sk + ':' + t.id;
    if (KEYSPACE.has(cacheId)) return KEYSPACE.get(cacheId);
    let val;
    if (t.bank) val = new Set(t.bank.map((raw,i)=>(raw&&raw.key)||(t.id+'#'+i)));
    else {
      const seen = new Set(); let dry = 0;
      for (let i=0;i<1200 && dry<250;i++){
        let q; try { q = t.gen(); } catch { break; }
        const k = q && q.key ? t.id+':'+q.key : null;
        if (!k || seen.has(k)) dry++; else { seen.add(k); dry = 0; }
      }
      val = seen.size ? seen : null;
    }
    KEYSPACE.set(cacheId, val);
    return val;
  }
  function statsFor(list){
    const c = { correct:0, fixed:0, wrong:0, new:0, total:0 };
    (list||[]).forEach(t => { const ks = keySpace(t); if (!ks) return;
      ks.forEach(k => { c[stateOf(k)]++; c.total++; }); });
    return c;
  }
  const BOLT_D = 'M7 2v11h3v9l7-12h-4l3-8z';
  function statusUI(){
    return '<div class="rvstatus" id="rvstatus">' +
      '<span class="rvbolt" id="rvbolt" title="Answer streak"><svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path class="bg" d="'+BOLT_D+'"/><path class="fill" d="'+BOLT_D+'"/></svg>' +
        '<b id="rvstreakn">0</b></span>' +
      '<div class="rvbar" id="rvbar" hidden><i class="g"></i><i class="y"></i><i class="r"></i></div>' +
      '<span class="rvlegend" id="rvlegend"></span></div>';
  }
  /* `broke` = a streak worth mourning just ended, so play the discharge */
  /* An endlessly-generated pool has no total to work towards, so you can set
     your own: click the grey number and type a target. The bar then fills with
     the questions you have completed against it. */
  const goalOf  = () => Math.max(0, +TT.get('tt.rev_'+sk+'_goal', 0) || 0);
  const tallyOf = () => { const t = TT.get('tt.rev_'+sk+'_tally', [0,0]); return Array.isArray(t) ? t : [0,0]; };
  function setGoal(n){
    TT.set('tt.rev_'+sk+'_goal', Math.max(0, Math.min(9999, n|0)));
    TT.set('tt.rev_'+sk+'_tally', [0,0]);            // a new target starts a new count
    paintStatus();
  }
  function bumpTally(ok){
    const t = tallyOf(); t[ok ? 0 : 1]++;
    TT.set('tt.rev_'+sk+'_tally', t);
  }
  function wireGoal(){
    const el = $('rvgoal'); if (!el) return;
    el.onclick = () => {
      const box = $('rvstatus'); if (!box) return;
      const cur0 = goalOf() || 20;
      el.outerHTML = '<input class="rvgoalin" id="rvgoalin" type="number" min="1" max="9999" value="'+cur0+'" aria-label="Questions to aim for">';
      const inp = $('rvgoalin'); if (!inp) return;
      inp.focus(); inp.select();
      const done = () => { const v = parseInt(inp.value, 10); setGoal(isFinite(v) && v > 0 ? v : 0); };
      inp.onblur = done;
      inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); done(); }
                             if (e.key === 'Escape'){ paintStatus(); } };
    };
  }
  function paintStatus(broke){
    const bolt = $('rvbolt'), bar = $('rvbar'), leg = $('rvlegend');
    if (!bolt) return;
    bolt.style.setProperty('--drain', ((1 - Math.min(1, streak / STREAK_FULL)) * 100) + '%');
    bolt.classList.toggle('full', streak >= STREAK_FULL);
    const n = $('rvstreakn'); if (n) n.textContent = streak;
    if (broke){ bolt.classList.remove('zap'); void bolt.offsetWidth; bolt.classList.add('zap'); }
    const c = statsFor(pool());
    if (c.total){                                   /* a finite pool — show the real thing */
      if (bar){
        bar.hidden = false;
        const pct = v => (v / c.total * 100) + '%';
        bar.children[0].style.width = pct(c.correct);
        bar.children[1].style.width = pct(c.fixed);
        bar.children[2].style.width = pct(c.wrong);
        bar.title = c.correct+' correct · '+c.fixed+' right once since a miss · '+c.wrong+' to review · '+c.new+' not tried yet';
      }
      if (leg) leg.innerHTML =
        '<i class="g" title="correct"></i>'+c.correct+'<i class="y" title="right once since a miss, get it right again to turn it green"></i>'+c.fixed+
        '<i class="r" title="still to review"></i>'+c.wrong+'<i class="n" title="not tried yet"></i>'+c.new;
      return;
    }
    /* endless pool — fall back to a goal you set yourself */
    const goal = goalOf(), t = tallyOf(), doneN = t[0] + t[1], left = Math.max(0, goal - doneN);
    if (bar){
      bar.hidden = !goal;
      if (goal){
        const pct = v => Math.min(100, v / goal * 100) + '%';
        bar.children[0].style.width = pct(t[0]);
        bar.children[1].style.width = '0%';
        bar.children[2].style.width = pct(t[1]);
        bar.title = t[0]+' right · '+t[1]+' wrong · '+left+' left of your goal of '+goal;
      }
    }
    if (leg) leg.innerHTML = goal
      ? '<i class="g" title="right"></i>'+t[0]+'<i class="r" title="wrong"></i>'+t[1]+
        '<i class="n" title="left to go, click to change your goal"></i>' +
        '<b class="rvgoaln" id="rvgoal" title="Click to change your goal">'+(left || '✓')+'</b>'
      : '<i class="n"></i><b class="rvgoaln" id="rvgoal" title="Set yourself a target">Set a goal</b>';
    wireGoal();
  }
  const pool = () => {
    if (!modular) return topic==='mix' ? opts.topics : [opts.topics.find(t=>t.id===topic)];
    if (modId==='all') return opts.modules.flatMap(m=>m.topics);
    const on = curMod().topics.filter(t=>!excl[t.id]); return on.length ? on : curMod().topics;
  };
  const pill = (id,name,on,multi) => '<button class="diffpill'+(multi?' rvmulti':'')+'" type="button" data-id="'+id+'" aria-pressed="'+on+'">'+esc(name)+'</button>';
  function selUI(){
    if (!modular){
      const all = opts.topics.length>1 ? [{id:'mix',name:'Mixed'},...opts.topics] : opts.topics;
      return '<div class="diffbar rvsel" style="margin-bottom:12px">'+all.map(t=>pill(t.id,t.name,t.id===topic)).join('')+'</div>';
    }
    let h = '<div class="diffbar rvsel" style="margin-bottom:8px">'+pill('all','Whole topic',modId==='all')+opts.modules.map(m=>pill(m.id,m.name,m.id===modId)).join('')+'</div>';
    if (modId!=='all') h += '<div class="diffbar rvsub" style="margin-bottom:12px">'+curMod().topics.map(t=>pill(t.id,t.name,!excl[t.id],true)).join('')+'</div>';
    return h;
  }
  function wireSel(){
    const bar = box.querySelector('.rvsel');
    if (bar) [...bar.children].forEach(b => b.onclick = () => {
      if (!modular){ topic=b.dataset.id; TT.set('tt.rev_'+sk,topic); }
      else { modId=b.dataset.id; TT.set('tt.rev_'+sk+'_mod',modId); }
      nextQ();
    });
    const sub = box.querySelector('.rvsub');
    if (sub) [...sub.children].forEach(b => b.onclick = () => {
      const id=b.dataset.id, isOn=!excl[id], active=curMod().topics.filter(t=>!excl[t.id]).length;
      if (isOn){ if (active<=1) return; excl[id]=true; } else delete excl[id];
      TT.set('tt.rev_'+sk+'_excl',excl); b.setAttribute('aria-pressed',String(!excl[id])); nextQ();
    });
  }
  /* ── test mode ────────────────────────────────────────────────────────────
     The picking and the report are the plain functions above revGame; this is
     the screens. A run in progress is saved after every answer, so leaving
     halfway (or losing the tab) can be resumed.

     Where things are kept, and why:
       revtest.<sk>.run      the run in progress. localStorage only, not tt.*,
       revtest.<sk>.report   the last full report. so they never ride the synced
                             settings: question text with diagrams in it is far
                             too big for that, and the sync refuses anything
                             over 100 KB, which would break it for everything.
       tt.rev_<sk>_tests     a few bytes per test (score and per-topic counts),
                             which does sync, so "last test" shows on any device. */
  let mode = 'practice', test = null, testTops = null;
  const RUN_KEY = 'revtest.' + sk + '.run', REPORT_KEY = 'revtest.' + sk + '.report';
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const resumable = r => !!(r && r.v === 1 && Array.isArray(r.log) && r.i > 0 && r.i < r.n);

  function getTestTopics(){
    if (testTops) return testTops;
    const list = modular
      ? opts.modules.flatMap(m => m.topics.map(t => [t, m.id, m.name]))
      : opts.topics.map(t => [t, t.id, t.name]);
    testTops = list.map(([t, mod, modName]) => {
      let typed = false;
      try { const q = t.bank ? null : t.gen(); typed = !!(q && q.typed); } catch {}
      const ks = keySpace(t);
      return { id:t.id, name:t.name, mod, modName, gate:t.gate || null, typed, size: ks ? ks.size : Infinity, src:t };
    });
    return testTops;
  }
  function modeUI(){
    const dot = mode !== 'test' && resumable(lsGet(RUN_KEY));
    return '<div class="rvmode" role="group" aria-label="Practice or test">' +
      '<button type="button" data-mode="practice" aria-pressed="' + (mode === 'practice') + '">Practice</button>' +
      '<button type="button" data-mode="test" aria-pressed="' + (mode === 'test') + '">Test' +
        (dot ? '<i class="rvdot" title="You have a test in progress"></i>' : '') + '</button></div>';
  }
  function wireMode(){
    /* the line under the title is about picking topics, which a test doesn't do */
    const how = host.querySelector && host.querySelector('.how');
    if (how) how.textContent = mode === 'test' ? 'One test across the whole subject, adapting as you answer.' : opts.how;
    box.querySelectorAll('.rvmode button').forEach(b => b.onclick = () => {
      if (b.dataset.mode === mode) return;
      mode = b.dataset.mode; cur = null; clearNudge();
      if (mode === 'test') testIntro(); else start();
    });
  }
  const localDay = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function daysAgo(ymd){
    if (!ymd) return '';
    const [y, m, d] = String(ymd).split('-').map(Number), t = new Date(), then = new Date(y, m - 1, d);
    const n = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - then) / 864e5);
    return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
  }

  function testIntro(){
    mode = 'test'; cur = null; clearNudge();
    const tops = getTestTopics(), n = testLength(tops.length);
    const run = lsGet(RUN_KEY), canResume = resumable(run);
    const past = TT.get('tt.rev_' + sk + '_tests', []), last = Array.isArray(past) ? past[0] : null;
    const saved = lsGet(REPORT_KEY);
    const typedN = Math.min(TEST_TYPED_MAX, tops.filter(t => t.typed).length);
    const mins = Math.max(5, Math.round(((n - typedN) * 35 + typedN * 240) / 60 / 5) * 5);
    const scope = modular ? 'all ' + opts.modules.length + ' modules' : 'all ' + tops.length + ' topics';
    box.innerHTML = modeUI() +
      '<div class="rvq"><div class="rvprompt">Test yourself on everything</div>' +
        '<div class="rvclue">' + n + ' questions across ' + scope + ', about ' + mins + ' minutes. ' +
          'Get a topic right and it moves on. Get one wrong and it comes back to it later, to check whether ' +
          'that was a slip or a gap. You won’t see what you got right until the end, so one answer can’t give ' +
          'away another. Then you get a breakdown and every question you missed.</div>' +
        (last && last.n ? '<div class="rvclue">Last test: <b>' + last.pct + '%</b>, ' + daysAgo(last.d) + '.' +
          (saved && saved.run ? ' <button class="rvlink" id="rvlastrep" type="button">See that report</button>' : '') + '</div>' : '') +
      '</div>' +
      '<div class="gwrow">' + (canResume
        ? '<button class="btn primary" id="rvstart" type="button">Carry on from question ' + (run.i + 1) + ' of ' + run.n + '</button>' +
          '<button class="btn" id="rvrestart" type="button">Start again</button>'
        : '<button class="btn primary" id="rvstart" type="button">Start the test</button>') + '</div>';
    const hist = historyHTML();
    if (hist) box.insertAdjacentHTML('beforeend', '<div class="rvsec rvintrohist"><h4>Your test scores</h4>' + hist + '</div>');
    wireHistory();
    wireMode();
    $('rvstart').onclick = canResume ? resumeTest : beginTest;
    if ($('rvrestart')) $('rvrestart').onclick = () => {
      if (confirm('Throw away the test in progress and start a new one?')){ lsSet(RUN_KEY, null); beginTest(); }
    };
    if ($('rvlastrep')) $('rvlastrep').onclick = () => {
      const s = lsGet(REPORT_KEY); if (s && s.run) renderReport(analyseTest(s.run, getTestTopics(), s.prev), s.run);
    };
    $('sc').textContent = '';
  }
  function beginTest(){
    const tops = getTestTopics(), n = testLength(tops.length), S = {};
    tops.forEach(t => { const p = historyPrior(hist, t.id); S[t.id] = testStat(p.prior, p.conf); });
    test = { v:1, n, i:0, cap:Math.max(3, Math.ceil(n / tops.length) + 2), ids:tops.map(t => t.id),
             S, log:[], sigs:[], lastIds:[], typedUsed:0 };
    lsSet(RUN_KEY, test);
    mode = 'test';
    nextTestQ();
  }
  function resumeTest(){
    const r = lsGet(RUN_KEY), tops = getTestTopics();
    /* the topics have changed since it was saved (an update landed): start
       fresh rather than resume against a different list */
    if (!resumable(r) || !r.S || tops.some(t => !r.S[t.id])){ lsSet(RUN_KEY, null); return beginTest(); }
    test = r; mode = 'test';
    nextTestQ();
  }
  function nextTestQ(){
    if (!test) return testIntro();
    if (test.i >= test.n) return completeTest(false);
    const tops = getTestTopics();
    const t = testPick(tops, test.S, test.i, test.n, {
      lastIds:test.lastIds, typedUsed:test.typedUsed,
      cap:tp => tp.typed ? 2 : Math.max(2, Math.min(test.cap, tp.size)) });
    if (!t) return completeTest(false);
    const q = chooseQuestion(t.src, hist, test.sigs, PRACTICE_TRIES);
    q._topic = t.name; q._tid = t.id; q._mod = t.modName;
    cur = q; answered = false; checking = false;
    render();
  }
  function logAnswer(result, given, detail){
    if (!test || !cur) return;
    const s = test.S[cur._tid]; if (!s) return;
    s.asked++; s[result]++; s.last = test.i; s.lastOk = result === 'right'; s.seq.push(result);
    if (cur.typed) test.typedUsed++;
    test.log.push({
      topic:cur._tid, tname:cur._topic, mod:cur._mod || '',
      q:cur.q, answer:String(cur.answer) + (cur.unit ? ' ' + cur.unit : ''), given:result === 'skip' || given == null ? null : String(given),
      /* a typed number as it reads in the question's unit ("0.18 kg" → 180), for the mistake patterns */
      gv:result !== 'skip' && given != null && cur.accept && cur.accept.read ? cur.accept.read(String(given)) : null,
      result, note:cur.note || '', detail:detail || '',
      kind:cur.typed ? 'typed' : cur.input ? 'input' : 'mc',
      choices:cur.choices ? cur.choices.slice() : null,
      pics:cur.optHtml || null,                                // picture options, redrawn in the review
      code:!!(cur.code || cur.typed || /class="rvcode"/.test(cur.q)),
      ms:Math.max(0, Math.min(600000, Date.now() - (cur._shownAt || Date.now())))
    });
    test.sigs.push(cur._sig); test.lastIds.push(cur._tid);
    test.i++;
    lsSet(RUN_KEY, test);
    paintTestBar();
  }
  /* In a test an answer is locked in and the test moves on by itself, without
     saying whether it was right. Showing it would hand you the answer to later
     questions on the same topic; the report at the end shows everything. */
  function settleTestQuestion(msg, btn){
    const fb = $('rvfb'); if (fb){ fb.className = 'rvfb'; fb.textContent = msg; }
    ['rvta', 'rvin', 'rvgo', 'rvskip'].forEach(id => { const el = $(id); if (el) el.disabled = true; });
    const opts = $('rvopts');
    if (opts) [...opts.children].forEach(b => { b.disabled = true; if (b === btn) b.classList.add('picked'); });
    const q = cur;
    setTimeout(() => { if (mode === 'test' && cur === q && answered) nextQ(); }, btn ? 320 : 450);
  }
  /* answered or skipped, never right or wrong, until the report */
  const segClass = (e, k) => e ? (e.result === 'skip' ? 's' : 'a') : (test && k === test.i ? 'cur' : '');
  function testBarUI(){
    let segs = '';
    for (let k = 0; k < test.n; k++) segs += '<i class="' + segClass(test.log[k], k) + '"></i>';
    return '<div class="rvtest"><div class="rvtbar" id="rvtbar" aria-hidden="true">' + segs + '</div>' +
      '<button class="rvend" id="rvend" type="button">End test</button></div>';
  }
  function paintTestBar(){
    const bar = $('rvtbar'); if (!bar || !test) return;
    [...bar.children].forEach((el, k) => { el.className = segClass(test.log[k], k); });
  }
  function wireTestBar(){
    const b = $('rvend'); if (!b) return;
    b.onclick = () => {
      const n = test ? test.log.length : 0;
      if (!n){
        if (confirm('Stop this test? You haven’t answered anything yet.')){ lsSet(RUN_KEY, null); test = null; testIntro(); }
        return;
      }
      if (confirm('End the test now? You’ll get a report on the ' + n + ' question' + (n === 1 ? '' : 's') + ' you’ve answered.'))
        completeTest(true);
    };
  }
  function completeTest(ended){
    if (!test) return testIntro();
    cur = null; clearNudge();
    const tops = getTestTopics();
    const past = TT.get('tt.rev_' + sk + '_tests', []), list = Array.isArray(past) ? past : [];
    const prev = list[0] || null;
    const run = { log:test.log, n:test.n, ended:!!ended, date:localDay() };
    lsSet(RUN_KEY, null); test = null;
    if (!run.log.length) return testIntro();
    const rep = analyseTest(run, tops, prev);
    /* a test stopped after a handful of questions would skew "last test", so
       only a proper attempt is recorded; the report is still shown */
    if (!ended || run.log.length >= Math.min(10, run.n)){
      /* the newest keeps its per-topic counts (for "since your last test");
         older ones keep only the score, for the chart. 20 slim entries is about
         1 KB a subject, well clear of the sync's 100 KB ceiling. */
      const slim = p => ({ d:p.d, n:p.n, r:p.r, s:p.s, pct:p.pct, ms:p.ms });
      TT.set('tt.rev_' + sk + '_tests', [rep.summary].concat(list.slice(0, TEST_HISTORY - 1).map(slim)));
      let saved = { run, prev };
      try { if (JSON.stringify(saved).length > 1500000)
        saved = { run:Object.assign({}, run, { log:run.log.map(e => Object.assign({}, e, {
          q:e.q.replace(/<svg[\s\S]*?<\/svg>/g, '<i>[diagram]</i>'),
          pics:null, choices:e.pics ? null : e.choices })) }), prev }; } catch {}
      lsSet(REPORT_KEY, saved);
    }
    if (rep.pct >= 75) SFX.win();
    renderReport(rep, run);
  }

  /* ── score history ─────────────────────────────────────────────────────
     One series over time, so a line with a light wash beneath, no legend (the
     heading says what it is), and a label on the latest point only. Every point
     has a hover and keyboard tooltip, and the same numbers sit in a table under
     "Show as a table", so nothing needs a pointer to read. Drawn at the width
     it will actually occupy, so text is never scaled. */
  const shortDate = ymd => { const [y, m, d] = String(ymd || '').split('-').map(Number);
    return d ? d + ' ' + MONTHS_SHORT[m - 1] : ''; };
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function historyHTML(){
    const past = TT.get('tt.rev_' + sk + '_tests', []);
    const tests = (Array.isArray(past) ? past : []).filter(t => t && t.n && t.pct != null).slice(0, TEST_HISTORY).reverse();
    if (tests.length < 2) return '';
    const W = Math.max(240, Math.min(640, (box.clientWidth || 560) - 28)), H = 150;   // margin for the section's own padding
    const L = 38, R = 46, T = 16, B = 24, iw = W - L - R, ih = H - T - B;
    const x = i => L + (tests.length === 1 ? iw / 2 : i * iw / (tests.length - 1));
    const y = p => T + ih - p / 100 * ih;
    const pts = tests.map((t, i) => [x(i), y(t.pct)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + y(0) + ' L' + pts[0][0].toFixed(1) + ' ' + y(0) + ' Z';
    const grid = [0, 50, 100].map(v => '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="g"/>' +
      '<text x="' + (L - 8) + '" y="' + y(v) + '" class="ax" text-anchor="end" dominant-baseline="central">' + v + '%</text>').join('');
    const last = tests[tests.length - 1], lp = pts[pts.length - 1];
    const dots = pts.map((p, i) => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" class="d"/>').join('');
    const hits = pts.map((p, i) => {
      const t = tests[i], left = i ? (pts[i - 1][0] + p[0]) / 2 : L - 6, right = i < pts.length - 1 ? (p[0] + pts[i + 1][0]) / 2 : L + iw + 6;
      return '<rect x="' + left.toFixed(1) + '" y="' + T + '" width="' + (right - left).toFixed(1) + '" height="' + ih + '" class="h" data-i="' + i + '" tabindex="0"' +
        ' aria-label="' + esc(shortDate(t.d) + ': ' + t.pct + '%, ' + t.r + ' of ' + t.n + ' right') + '"/>';
    }).join('');
    const svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Test scores over time">' +
      grid + '<path d="' + area + '" class="w"/><path d="' + line + '" class="l"/>' +
      '<line class="x" y1="' + T + '" y2="' + (T + ih) + '" x1="0" x2="0" hidden/>' + dots +
      '<text x="' + (lp[0] + 9) + '" y="' + lp[1] + '" class="v" dominant-baseline="central">' + last.pct + '%</text>' +
      '<text x="' + L + '" y="' + (H - 6) + '" class="ax">' + esc(shortDate(tests[0].d)) + '</text>' +
      '<text x="' + (L + iw) + '" y="' + (H - 6) + '" class="ax" text-anchor="end">' + esc(shortDate(last.d)) + '</text>' +
      hits + '</svg>';
    const rows = tests.slice().reverse().map(t => '<tr><td>' + esc(shortDate(t.d)) + '</td><td>' + t.pct + '%</td><td>' + t.r + ' of ' + t.n + '</td></tr>').join('');
    return '<div class="rvhist" data-tests="' + esc(JSON.stringify(tests.map(t => [t.d, t.pct, t.r, t.n]))) + '">' +
      '<div class="rvhistplot">' + svg + '<div class="rvtip" hidden></div></div>' +
      '<details class="rvhisttab"><summary>Show as a table</summary><table><thead><tr><th>Test</th><th>Score</th><th>Right</th></tr></thead><tbody>' + rows + '</tbody></table></details></div>';
  }
  function wireHistory(){
    const wrap = box.querySelector('.rvhist'); if (!wrap) return;
    const data = JSON.parse(wrap.dataset.tests), plot = wrap.querySelector('.rvhistplot'), tip = wrap.querySelector('.rvtip');
    const cross = wrap.querySelector('line.x'), dots = [...wrap.querySelectorAll('circle.d')];
    const show = i => {
      const [d, pct, r, n] = data[i], c = dots[i], cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy');
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.hidden = false;
      dots.forEach((el, k) => el.classList.toggle('on', k === i));
      tip.textContent = '';
      const b = document.createElement('b'); b.textContent = pct + '%';
      const s = document.createElement('span'); s.textContent = shortDate(d) + ' · ' + r + ' of ' + n + ' right';
      tip.append(b, s); tip.hidden = false;
      const w = tip.offsetWidth, pw = plot.clientWidth;
      tip.style.left = Math.max(0, Math.min(pw - w, cx - w / 2)) + 'px';
      tip.style.top = Math.max(0, cy - tip.offsetHeight - 12) + 'px';
    };
    const hide = () => { tip.hidden = true; cross.hidden = true; dots.forEach(el => el.classList.remove('on')); };
    wrap.querySelectorAll('rect.h').forEach(h => {
      h.addEventListener('pointerenter', () => show(+h.dataset.i));
      h.addEventListener('focus', () => show(+h.dataset.i));
      h.addEventListener('blur', hide);
    });
    /* a finger "leaves" the moment it lifts, so on touch the tip stays until the next tap */
    plot.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') hide(); });
  }

  /* ── the report ── */
  const bandColour = p => p >= 75 ? '#2f9e44' : p >= 50 ? '#f0a500' : '#e5484d';
  const VERDICT = { top:'You know this really well.', good:'Solid, with a few gaps.',
    mid:'Getting there. A few areas need work.', low:'Some real gaps to fill.', poor:'Plenty to work on. Start with the list below.' };
  const TAG = { gap:'Gap', shaky:'Shaky', miss:'Missed once' };
  const section = (title, body) => '<div class="rvsec"><h4>' + title + '</h4>' + body + '</div>';
  /* each pattern as a short label, then what it means in plain words */
  function mistakeLine(m){
    const answers = n => n + (n === 1 ? ' answer' : ' answers');
    const lines = {
      mixup:   ['Mixed up', '<b>' + esc(m.a) + '</b> and <b>' + esc(m.b) + '</b>, ' + m.n + ' times.'],
      calc:    ['Calculations', (m.calc && m.calc.r) + ' of ' + (m.calc && m.calc.n) + ' right, against ' + (m.concept && m.concept.r) +
                ' of ' + (m.concept && m.concept.n) + ' for concept questions. You know the ideas; the marks are going in the working.'],
      concept: ['Concepts', (m.concept && m.concept.r) + ' of ' + (m.concept && m.concept.n) + ' right, against ' + (m.calc && m.calc.r) +
                ' of ' + (m.calc && m.calc.n) + ' for calculations. Go back over the definitions.'],
      sign:    ['Wrong sign', answers(m.n) + ' had the right number but the wrong sign.'],
      ten:     ['Out by a power of ten', answers(m.n) + '. Usually a unit conversion or a misplaced decimal point.'],
      two:     ['Double or half', answers(m.n) + ' came out at exactly twice or half the right value. Look for a missing ½ or something counted twice.'],
      close:   ['Rounding', answers(m.n) + (m.n === 1 ? ' was' : ' were') + ' within 10% of the right value but not exact. Keep full precision until the last step.'],
      rushed:  ['Rushed', m.n + ' wrong answers took under 6 seconds, while your right answers took about ' + m.typical + ' seconds.'],
      tired:   ['Late slips', m.n + ' questions near the end were wrong on topics you had already answered correctly. Possibly tiredness.'],
      skips:   ['Skipped', m.n + ' questions. Skips count as gaps, so they are included in the list above.']
    }[m.type];
    return lines ? '<b>' + lines[0] + ':</b> ' + lines[1] : '';
  }
  function reviewCard(e, i){
    const res = e.result === 'right' ? ['g', 'Right'] : e.result === 'skip' ? ['s', 'Skipped'] : ['r', 'Wrong'];
    const where = e.mod && e.mod !== e.tname ? e.mod + ' · ' + e.tname : e.tname;
    let body = '<div class="qq">' + e.q + '</div>';
    if (e.kind === 'mc' && e.choices){
      body += '<div class="ch' + (e.code ? ' code' : '') + (e.pics ? ' pics' : '') + '">' + e.choices.map(c =>
        '<span class="' + (c === e.answer ? 'ans' : c === e.given ? 'pick' : '') + '">' +
          (e.pics && e.pics[c] ? e.pics[c] : esc(c)) + '</span>').join('') + '</div>';
    } else if (e.kind === 'typed'){
      if (e.given) body += '<div class="ya">Your code</div><pre class="rvans">' + esc(e.given) + '</pre>';
      if (e.detail && e.result !== 'right') body += '<div class="rvwhy">' + esc(e.detail) + '</div>';
      body += '<div class="ya">One way to write it</div><pre class="rvans">' + esc(e.answer) + '</pre>';
    } else if (e.kind === 'input'){
      body += '<div class="ya">' + (e.given != null
        ? 'Your answer: <b class="' + (e.result === 'right' ? 'ok' : 'no') + '">' + esc(e.given) + '</b>' : 'Skipped') +
        (e.result !== 'right' ? ' · Answer: <b class="ok">' + esc(e.answer) + '</b>' : '') + '</div>';
    }
    if (e.note) body += '<div class="rvnote">' + e.note + '</div>';
    return '<div class="rvcard"><div class="hd"><span>Q' + (i + 1) + '</span><span>' + esc(where) + '</span>' +
      '<span class="res ' + res[0] + '">' + res[1] + '</span></div>' + body + '</div>';
  }
  function renderReport(rep, run){
    mode = 'test'; cur = null; clearNudge();
    const byTopic = modular ? 'module' : 'topic';
    const mins = Math.max(1, Math.round(rep.ms / 60000));
    let h = modeUI() + '<div class="rvrep">';

    const ch = rep.change;
    h += '<div class="rvhero"><div class="rvring" style="--p:' + rep.pct + ';--ring:' + bandColour(rep.pct) + '"><b>' + rep.pct + '%</b></div>' +
      '<div class="rvherot"><h3>' + (rep.answered < 10 ? 'Too few answers to judge.' : VERDICT[rep.band]) + '</h3>' +
      '<p>' + rep.right + ' of ' + rep.answered + ' right' + (rep.skip ? ' · ' + rep.skip + ' skipped' : '') + ' · ' + mins + ' min</p>' +
      (rep.ended ? '<p>You ended it after ' + rep.answered + ' of ' + rep.n + ' questions.</p>' : '') +
      (ch ? '<p>' + (ch.delta > 0 ? 'Up ' + ch.delta + ' points on your last test (' + ch.was + '%).'
                   : ch.delta < 0 ? 'Down ' + (-ch.delta) + ' points on your last test (' + ch.was + '%).'
                   : 'The same as your last test.') + '</p>' : '') +
      '</div></div>';

    const hist = historyHTML();
    if (hist) h += section('Your test scores', hist);

    const mods = rep.modules.filter(m => m.asked);
    if (mods.length > 1) h += section('By ' + byTopic, '<div class="rvmods">' + mods.map(m => {
      const p = Math.round(m.right / m.asked * 100);
      return '<div class="rvmodrow"><span class="nm">' + esc(m.name) + '</span>' +
        '<span class="bar"><i style="width:' + Math.max(3, p) + '%;background:' + bandColour(p) + '"></i></span>' +
        '<span class="n">' + m.right + '/' + m.asked + '</span></div>';
    }).join('') + '</div>');

    if (rep.weak.length || rep.notReached.length) h += section('Work on these',
      (rep.weak.length ? '<ul class="rvlist">' + rep.weak.map(w =>
        '<li><span class="nm">' + esc(w.name) + (modular ? '<span class="sub">' + esc(w.mod) + '</span>' : '') + '</span>' +
        '<span class="rvtag ' + w.tag + '">' + TAG[w.tag] + ' · ' + w.right + '/' + w.asked + '</span>' +
        '<button class="btn rvpract" type="button" data-practise="' + esc(w.id) + '">Practise</button></li>').join('') + '</ul>' : '') +
      (rep.notReached.length ? '<p class="rvsmall">Not reached: ' + rep.notReached.map(x =>
        '<b>' + esc(x.name) + '</b>' + (x.gate ? ' (it comes after ' + esc(x.gate) + ')' : '')).join(', ') + '.</p>' : '') +
      (rep.ended && rep.unasked.length ? '<p class="rvsmall">Not asked before you ended: ' + rep.unasked.map(esc).join(', ') + '.</p>' : ''));

    /* Patterns need enough answers to mean anything, and something right to
       compare the misses against. Saying "nothing stood out" after three wrong
       answers would suggest a clean bill of health that nobody has earned. */
    if (rep.wrong || rep.skip) h += section('Common mistakes',
      rep.answered < 12
        ? '<p class="rvsmall">Only ' + rep.answered + ' answer' + (rep.answered === 1 ? '' : 's') + ', which isn’t enough to spot patterns. A full test gives a much clearer picture.</p>'
      : rep.mistakes.length
        ? '<ul class="rvmist">' + rep.mistakes.map(m => '<li>' + mistakeLine(m) + '</li>').join('') + '</ul>'
      : !rep.right
        ? '<p class="rvsmall">Nothing was answered correctly, so there’s nothing to compare the mistakes against. Start with the list above.</p>'
        : '<p class="rvsmall">No repeated pattern in the mistakes. They look like one-offs.</p>');

    const strong = rep.strengths.concat(rep.firstTime);
    if (strong.length) h += section('Strengths',
      '<ul class="rvlist">' + strong.map(s =>
        '<li><span class="nm">' + esc(s.name) + (modular ? '<span class="sub">' + esc(s.mod) + '</span>' : '') + '</span>' +
        '<span class="rvtag good">' + s.right + ' of ' + s.asked + ' right</span></li>').join('') + '</ul>' +
      (rep.firstTime.length ? '<p class="rvsmall">A topic you get right first time isn’t asked again, so “1 of 1” is one question’s worth of evidence.</p>' : ''));

    if (rep.slips.length) h += section('Probably slips',
      '<p class="rvsmall">Wrong once, then right every time after: ' +
      rep.slips.map(s => '<b>' + esc(s.name) + '</b>').join(', ') + '.</p>');

    if (ch && (ch.better.length || ch.worse.length)) h += section('Since your last test',
      (ch.better.length ? '<p class="rvsmall">Better than last time: <b>' + ch.better.map(esc).join('</b>, <b>') + '</b>.</p>' : '') +
      (ch.worse.length ? '<p class="rvsmall">Weaker than last time: <b>' + ch.worse.map(esc).join('</b>, <b>') + '</b>.</p>' : ''));

    const lists = {
      wrong:run.log.map((e, i) => [e, i]).filter(([e]) => e.result === 'wrong'),
      skip:run.log.map((e, i) => [e, i]).filter(([e]) => e.result === 'skip'),
      all:run.log.map((e, i) => [e, i])
    };
    const first = lists.wrong.length ? 'wrong' : lists.skip.length ? 'skip' : 'all';
    const tab = (id, label) => '<button class="diffpill" type="button" data-tab="' + id + '" aria-pressed="' + (id === first) + '">' + label + '</button>';
    h += section('Go back over the questions',
      '<div class="diffbar rvtabs" id="rvtabs">' +
        (lists.wrong.length ? tab('wrong', 'Wrong (' + lists.wrong.length + ')') : '') +
        (lists.skip.length ? tab('skip', 'Skipped (' + lists.skip.length + ')') : '') +
        tab('all', 'All (' + lists.all.length + ')') +
      '</div><div class="rvrev" id="rvrev"></div>');

    h += '<div class="gwrow"><button class="btn primary" id="rvagain" type="button">Take another test</button>' +
      '<button class="btn" id="rvtopractice" type="button">Back to practice</button></div></div>';

    box.innerHTML = h;
    wireMode();
    wireHistory();
    const showTab = id => {
      $('rvrev').innerHTML = lists[id].map(([e, i]) => reviewCard(e, i)).join('');
      box.querySelectorAll('#rvtabs [data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === id)));
    };
    box.querySelectorAll('#rvtabs [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
    showTab(first);
    box.querySelectorAll('[data-practise]').forEach(b => b.onclick = () => practiseTopic(b.dataset.practise));
    $('rvagain').onclick = beginTest;
    $('rvtopractice').onclick = () => { mode = 'practice'; start(); };
    $('sc').textContent = rep.right + ' / ' + rep.answered;
    if (host.scrollIntoView) host.scrollIntoView({ block:'start' });
  }
  /* from a weak topic in the report straight into practising just that */
  function practiseTopic(id){
    mode = 'practice';
    if (!modular){ topic = id; TT.set('tt.rev_' + sk, topic); }
    else {
      const m = opts.modules.find(mm => mm.topics.some(t => t.id === id));
      if (!m) return start();
      modId = m.id; TT.set('tt.rev_' + sk + '_mod', modId);
      excl = {}; m.topics.forEach(t => { if (t.id !== id) excl[t.id] = true; });
      TT.set('tt.rev_' + sk + '_excl', excl);
    }
    nextQ();
    if (host.scrollIntoView) host.scrollIntoView({ block:'start' });
  }

  start();
  function start(){
    mode = 'practice';
    box.innerHTML = modeUI() + selUI() + statusUI() + '<div class="rvq"><div class="rvprompt">'+esc(opts.title)+'</div>' +
      '<div class="rvclue">'+(modular?'Pick a module (or the whole topic), then start.':'Pick a topic, then start.')+' Answers reveal the working.</div></div>' +
      '<div class="gwrow"><button class="btn primary" id="rvstart" type="button">Start</button></div>';
    wireMode(); wireSel(); paintStatus(); $('rvstart').onclick = nextQ;
    $('sc').textContent = 'Best streak ' + (statVal(sk,'streak') || 0);
  }
  function nextQ(){
    if (mode === 'test') return nextTestQ();
    const list = pool();
    /* recent window: never the whole pool, so even a small subtopic always has an
       eligible (non-recent) question and never repeats back-to-back. */
    const winN = Math.max(1, Math.min(RECENT_MAX, poolSize(list) - 1));
    const recentSet = recent.slice(-winN);
    /* pick the subtopic fairly (so every subtopic gets airtime, including the
       procedural ones), then bias which question WITHIN it toward unseen/wrong. */
    const t = list[(Math.random()*list.length)|0];
    const q = chooseQuestion(t, hist, recentSet, PRACTICE_TRIES);
    q._topic = t.name; q._tid = t.id; cur = q; answered = false; checking = false;
    recent.push(cur._sig); if (recent.length > RECENT_MAX) recent.shift();
    render();
  }
  /* count of distinct question slots in the current pool (bank items + generators) */
  function poolSize(list){ return list.reduce((n,t)=> n + (t.bank ? t.bank.length : 1), 0); }
  function render(){
    const inTest = mode === 'test' && test;
    const where = cur._mod && cur._mod !== cur._topic ? cur._mod + ' · ' + cur._topic : cur._topic;
    let html = (inTest ? modeUI() + testBarUI() : modeUI() + selUI() + statusUI()) +
      '<div class="rvq"><div class="rvprog">' + (inTest
        ? 'Question ' + (test.i + 1) + ' of ' + test.n + ' · ' + esc(where)
        : 'Score '+score+' · streak '+streak+' · '+esc(cur._topic)) + '</div>' +
        '<div class="rvprompt">'+cur.q+'</div></div>';   /* no formula shown up front — that's the point */
    /* a test takes your answer without marking it, so the buttons say so */
    const goLabel = inTest ? 'Submit' : 'Check';
    html += cur.typed
      ? '<div class="rvtyped"><textarea id="rvta" spellcheck="false" autocapitalize="off" autocorrect="off"' +
        ' placeholder="Write your code here…">' + esc(cur.stub || '') + '</textarea>' +
        '<div class="rvsyn" id="rvsyn"></div>' +
        '<div class="gwrow"><button class="btn primary" id="rvgo" type="button">' + goLabel + '</button>' +
        '<button class="btn" id="rvskip" type="button">' + (inTest ? 'Skip' : 'Show answer') + '</button>' +
        '<span class="rvnudge" id="rvnudge"></span></div></div>'
      : cur.input
      ? '<div class="gwrow"><input id="rvin" autocomplete="off" placeholder="Your answer…">' +
        '<button class="btn primary" id="rvgo" type="button">' + goLabel + '</button>' +
        '<button class="btn" id="rvskip" type="button">Skip</button><span class="rvnudge" id="rvnudge"></span></div>'
      : '<div class="mcq" id="rvopts"></div>' +
        '<div class="gwrow"><button class="btn" id="rvskip" type="button">Skip</button>' +
        '<span class="rvnudge" id="rvnudge"></span></div>';
    html += '<div class="rvfb" id="rvfb"></div><div class="gwrow" id="rvnextrow" hidden><button class="btn primary" id="rvnext" type="button">Next →</button></div>';
    box.innerHTML = html; wireMode();
    if (inTest){
      wireTestBar();
      cur._shownAt = Date.now();                               // time taken feeds the "rushed" check
      $('sc').textContent = '';                                // no running score: it would give answers away
    } else { wireSel(); paintStatus(); $('sc').textContent = 'Score ' + score; }
    if (cur.typed){ const ta = $('rvta'); ta.focus();
      /* Live syntax check, like the exam environment gives you. It only
         compiles — a logic error compiles fine, so this never claims the answer
         is right, just that Python can parse it. */
      let synTimer = null;
      const syntaxCheck = () => {
        const out = $('rvsyn');
        if (!out || $('rvta') !== ta) return;            // moved on to another question
        if (typeof PY === 'undefined' || PY.dead || !PY.ready) return;
        if (!ta.value.trim()){ out.textContent = ''; out.className = 'rvsyn'; return; }
        PY.syntax(ta.value).then(r => {
          const now = $('rvsyn');
          if (!now || $('rvta') !== ta) return;
          if (r.ok){ now.textContent = '✓ No syntax errors'; now.className = 'rvsyn good'; }
          else { now.textContent = '✗ ' + r.msg + (r.line ? ' (line ' + r.line + ')' : ''); now.className = 'rvsyn bad'; }
        }).catch(() => {});
      };
      ta.addEventListener('input', () => { clearTimeout(synTimer); synTimer = setTimeout(syntaxCheck, 450); });
      if (typeof PY !== 'undefined' && !PY.ready && !PY.dead) PY.warm().then(syntaxCheck);   // pre-download while they type
      $('rvgo').onclick = () => submit(ta.value);
      $('rvskip').onclick = inTest ? skipCur : () => submit('', null, true);   // practice: give up and see a model answer
      ta.addEventListener('keydown', e => {                    // Tab indents instead of leaving the box
        if (e.key === 'Tab'){ e.preventDefault();
          const s = ta.selectionStart, t = ta.selectionEnd;
          ta.value = ta.value.slice(0,s) + '    ' + ta.value.slice(t);
          ta.selectionStart = ta.selectionEnd = s + 4;
        }
      });
    } else if (cur.input){ const inp = $('rvin'); inp.focus();
      $('rvgo').onclick = () => submit(inp.value);
      $('rvskip').onclick = skipCur;
    } else { const wrap = $('rvopts'); if (cur.code) wrap.classList.add('rvcodeopts');
      /* options that are pictures (Lewis diagrams) carry their drawing in optHtml;
         either way the value lives in data-val, since a picture's text isn't its answer */
      if (cur.optHtml) wrap.classList.add('rvpicopts');
      cur.choices.forEach((c, i) => { const b = document.createElement('button'); b.type='button'; b.className='mcopt'; b.dataset.val = c;
        if (cur.optHtml){ b.innerHTML = cur.optHtml[c]; b.setAttribute('aria-label', 'Option ' + 'ABCD'[i]); }
        else b.textContent = c;
        b.onclick = () => submit(c, b); wrap.appendChild(b); });
      /* sentence-length options get a column each on a phone (see games.css) */
      if (!cur.optHtml && !cur.code && cur.choices.some(c => String(c).length > 22)) wrap.classList.add('rvlong');
      $('rvskip').onclick = skipCur;
    }
    startNudge();
    $('rvnext').onclick = nextQ;
  }
  /* If a question has sat unanswered for a while, gently point at Skip — a
     skip costs nothing, whereas a guess can mark the question wrong and break
     the streak. */
  const NUDGE_AFTER = 5 * 60 * 1000;
  let nudgeTimer = null;
  function clearNudge(){ if (nudgeTimer){ clearTimeout(nudgeTimer); nudgeTimer = null; } }
  function startNudge(){
    clearNudge();
    nudgeTimer = setTimeout(() => {
      const el = $('rvnudge');
      if (el && !answered) el.textContent = 'No idea? Skipping costs you nothing. A wrong guess does.';
    }, NUDGE_AFTER);
  }
  /* Skip: reveal the answer and move on. Deliberately does NOT touch the score,
     the streak or the saved history — you neither gain nor lose by being honest.
     In a test it is logged, though: not knowing is exactly what a test is for. */
  function skipCur(){
    if (answered || checking) return;
    answered = true; clearNudge();
    if (mode === 'test'){ logAnswer('skip', null); settleTestQuestion('Skipped.'); return; }
    const fb = $('rvfb'); fb.className = 'rvfb';
    fb.innerHTML = 'Skipped' + (cur.typed ? '. One way to write it:' : cur.optHtml ? '. The right one is outlined in green.' : '. The answer was <b>' + esc(String(cur.answer)) + '</b>') +
      (cur.note ? '<div class="rvnote">' + cur.note + '</div>' : '');
    if (cur.typed) revealAnswer();
    if (cur.typed){ $('rvta').disabled = true; $('rvgo').disabled = true; $('rvskip').disabled = true; }
    else if (cur.input){ $('rvin').disabled = true; $('rvgo').disabled = true; $('rvskip').disabled = true; }
    else { [...$('rvopts').children].forEach(b => { b.disabled = true; if (b.dataset.val === cur.answer) b.classList.add('right'); });
           $('rvskip').disabled = true; }
    $('rvnextrow').hidden = false; $('rvnext').focus();
  }
  function submit(val, btn, gaveUp){
    if (answered || checking) return;
    if (cur.typed && !gaveUp && !String(val).trim()){   // nothing typed — don't spend the question
      const ta = $('rvta'); if (ta) ta.focus();
      return;
    }
    cur._given = val == null ? null : String(val);      // kept for the test's review
    /* write-code answers are actually executed, which takes a moment (and the
       very first one downloads Python), so grade them asynchronously */
    if (cur.acceptAsync && !gaveUp){
      checking = true;
      const fb = $('rvfb'); fb.className = 'rvfb';
      fb.textContent = PY.ready ? 'Running your code…' : 'Starting Python. The first run has to download it.';
      $('rvgo').disabled = true; if ($('rvskip')) $('rvskip').disabled = true;
      cur.acceptAsync(String(val)).then(
        r => { checking = false; finish(!!r.ok, false, r.detail, btn); },
        () => { checking = false; finish(false, false, 'That could not be run.', btn); });
      return;
    }
    finish(gaveUp ? false
      : (cur.typed || cur.input) ? (cur.accept ? cur.accept(String(val)) : normEq(val, cur.answer))
      : (val === cur.answer), gaveUp, null, btn);
  }
  /* drop a sample solution into the feedback, once */
  function revealAnswer(){
    const fb = $('rvfb');
    if (!fb || fb.querySelector('.rvans')) return;
    const pre = document.createElement('pre');
    pre.className = 'rvans';
    pre.textContent = String(cur.answer);
    const note = fb.querySelector('.rvnote');
    if (note) fb.insertBefore(pre, note); else fb.appendChild(pre);
  }
  function finish(ok, gaveUp, detail, btn){
    if (answered) return; answered = true; clearNudge();
    const hadStreak = streak, inTest = mode === 'test';
    /* the streak, score and goal belong to practice; a test keeps its own tally,
       and plays the same neutral tick whether you were right or not */
    if (inTest) SFX.tick();
    else if (ok){ score++; streak++; SFX.streak(streak); recordStat(opts.statKey, { key:'streak', mode:'max', value:streak }); }
    else { streak = 0; if (hadStreak >= 3) SFX.discharge(); else SFX.bad(); }
    /* a test answer is real evidence too, so it goes into the same history:
       what you miss in a test comes back to you in practice */
    if (cur._keyed){
      recordAnswer(hist, cur._sig, ok);
      TT.set('tt.rev_'+sk+'_hist', hist);
    }
    if (inTest){
      logAnswer(ok ? 'right' : gaveUp ? 'skip' : 'wrong', cur._given, detail);
      settleTestQuestion('Saved.', btn);
      return;
    }
    bumpTally(ok);                                            // feeds the self-set goal
    TT.set('tt.rev_'+sk+'_streak', streak);                   // synced with everything else
    paintStatus(!ok && hadStreak >= 3);
    const fb = $('rvfb'); fb.className = 'rvfb ' + (ok ? 'good' : 'bad');
    if (cur.typed)        // code answers are multi-line — shown as a block below
      fb.innerHTML = (ok ? '✓ Correct' : (gaveUp ? 'One way to write it:' : '✗ Not quite'))
        + (detail ? '<div class="rvwhy">' + esc(detail) + '</div>' : '')
        + (cur.note ? '<div class="rvnote">'+cur.note+'</div>' : '');
    else
      fb.innerHTML = (ok ? '✓ Correct' : cur.optHtml ? '✗ Not that one. The right one is outlined in green.' : '✗ Answer: <b>' + esc(String(cur.answer) + (cur.unit ? ' ' + cur.unit : '')) + '</b>') + (cur.note ? '<div class="rvnote">'+cur.note+'</div>' : '');
    if (cur.typed){
      $('rvta').disabled = true; $('rvgo').disabled = true;
      if (!ok) revealAnswer();                 // got it wrong → show a working version
      const skip = $('rvskip');
      if (skip){
        /* even when you got it right, leave the button working so you can compare
           your version with a sample one */
        skip.disabled = !!$('rvfb').querySelector('.rvans');
        skip.onclick = () => { revealAnswer(); skip.disabled = true; };
      }
    }
    else if (cur.input){ $('rvin').disabled = true; $('rvgo').disabled = true; }
    else [...$('rvopts').children].forEach(b => { b.disabled = true; if (b.dataset.val === cur.answer) b.classList.add('right'); if (b===btn && !ok) b.classList.add('wrong'); });
    $('rvnextrow').hidden = false; $('rvnext').focus();
    if (!inTest) $('sc').textContent = 'Score ' + score;
  }
  return () => { document.removeEventListener('keydown', onEnter); clearNudge(); };
}
function normEq(val, answer){
  const a = String(answer).trim(), v = String(val).trim();
  if (v === a) return true;
  const na = Number(a);
  if (a !== '' && isFinite(na)){ const r = readQuantity(v); return !!r && !r.extra && Math.abs(r.value - na) < 1e-9; }
  const flat = s => s.toLowerCase().replace(/\s+/g, ' ');
  return flat(v) === flat(a);
}

/* ══ TYPED NUMBER ANSWERS ═════════════════════════════════════════════════
   A typed answer shouldn't be marked wrong for how it's written. "180g",
   "180 g", "180 grams", "m = 180 g", "0.18 kg", "1.8 × 10² g", "−92" (the
   minus sign the notes use), "5,040", "5 040" and "3+" all read as what they
   mean. A number on its own is taken in the question's unit, a written unit
   is converted, and a unit for a different kind of quantity (grams for a
   volume) is wrong, since that is a real mistake rather than formatting.
   Each table is in the unit the questions use, so that one has scale 1. */
const UNIT_TABLES = {
  mass:    { g:1, gm:1, gms:1, gram:1, grams:1, gramme:1, grammes:1, mg:1e-3, milligram:1e-3, milligrams:1e-3,
             kg:1e3, kilogram:1e3, kilograms:1e3, kilo:1e3, kilos:1e3, 'µg':1e-6, ug:1e-6, t:1e6, tonne:1e6, tonnes:1e6 },
  amount:  { mol:1, mols:1, mole:1, moles:1, mmol:1e-3, millimole:1e-3, millimoles:1e-3, kmol:1e3 },
  volume:  { L:1, litre:1, litres:1, liter:1, liters:1, dm3:1, mL:1e-3, millilitre:1e-3, millilitres:1e-3,
             milliliter:1e-3, milliliters:1e-3, cm3:1e-3, cc:1e-3, 'µL':1e-6, uL:1e-6, kL:1e3, m3:1e3 },
  conc:    { 'mol/L':1, 'mol/dm3':1, 'mol L':1, M:1, molar:1, 'mmol/L':1e-3, mM:1e-3, 'mol/mL':1e3, 'mol/cm3':1e3, 'mol/m3':1e-3 },
  voltage: { V:1, volt:1, volts:1, mV:1e-3, millivolt:1e-3, millivolts:1e-3, kV:1e3 },
  energy:  { kJ:1, J:1e-3, MJ:1e3, 'kJ/mol':1, 'J/mol':1e-3, 'MJ/mol':1e3,
             kilojoule:1, kilojoules:1, joule:1e-3, joules:1e-3 },
  speed:   { 'm/s':1, mps:1, 'km/h':1/3.6, kph:1/3.6, kmh:1/3.6, 'km/hr':1/3.6, 'cm/s':0.01, 'km/s':1e3 },
  molarmass:{ 'g/mol':1, u:1, amu:1, Da:1, g:1 }
};
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺';
/* "mol·L⁻¹", "mol dm^-3", "m s-1", "kJ per mol" → "mol/L", "mol/dm3", "m/s", "kJ/mol" */
function unitKey(s){
  return String(s).trim()
    .replace(/μ/g, 'µ')                                        // Greek mu → micro sign
    .replace(/^ms\s*\^?\s*-\s*1$/i, 'm/s')
    .replace(/\s+per\s+/gi, '/')
    .replace(/\b(milli)?lit(?:re|er)s?\b/gi, (w, milli) => milli ? 'mL' : 'L')
    .replace(/\^/g, '')
    .replace(/\s*[·.*]\s*(?=[a-zµ])/gi, ' ')
    .replace(/\s*([a-zµ]+)\s*-\s*1(?![\d])/gi, '/$1')
    .replace(/\s*([a-zµ]+)\s*-\s*([23])(?![\d])/gi, '/$1$2')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/[.,;!]+$/, '');
}
function unitScale(table, key){
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  const low = key.toLowerCase();
  const hits = Object.keys(table).filter(k => k.toLowerCase() === low).map(k => table[k]);
  return hits.length && hits.every(x => x === hits[0]) ? hits[0] : undefined;   // skip anything case makes ambiguous
}
/* the unit at the start of `rest`, trying the longest run of words first:
   { scale } for the expected kind, { wrong:true } for another kind, or null */
function matchUnit(rest, dim){
  const words = String(rest).trim().split(/\s+/).filter(Boolean);
  const own = dim && UNIT_TABLES[dim];
  let other = false;
  for (let n = words.length; n >= 1; n--){
    const key = unitKey(words.slice(0, n).join(' '));
    if (!key) continue;
    if (own){ const s = unitScale(own, key); if (s !== undefined) return { scale:s }; }
    if (Object.keys(UNIT_TABLES).some(d => d !== dim && unitScale(UNIT_TABLES[d], key) !== undefined)) other = true;
  }
  return other && own ? { wrong:true } : null;
}
/* the number a typed answer starts with: { value, rest, signed, extra } or null.
   `extra` is set when a second number follows ("720 or 5040"), so a hedge
   can't be marked right. */
function readQuantity(raw){
  let s = String(raw == null ? '' : raw)
    .replace(/[−–—‒]/g, '-')
    .replace(new RegExp('[' + SUPERSCRIPT + ']+', 'g'), m => '^' + [...m].map(c => '0123456789-+'[SUPERSCRIPT.indexOf(c)]).join(''))
    .replace(/\\times/g, '×')
    .trim();
  if (s.includes('=')) s = s.slice(s.lastIndexOf('=') + 1).trim();     // "n = 0.25 mol"
  s = s.replace(/^\D*?(?=[+-]?\s*[.,]?\d)/, '');                     // "about 0.25", "≈0.25"
  /* 5,040 and 5 040 are thousands; 0,5 and 1,25 are a decimal comma */
  const m = s.match(/^([+-]?)\s*([1-9]\d{0,2}(?:,\d{3})+(?![\d,])(?:\.\d+)?|[1-9]\d{0,2}(?: \d{3})+(?![\d])(?:[.,]\d+)?|\d+(?:[.,]\d*)?|[.,]\d+)/);
  if (!m) return null;
  let body = m[2];
  if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?$/.test(body)) body = body.replace(/,/g, '');
  body = body.replace(/ /g, '').replace(',', '.');
  let value = parseFloat(body.endsWith('.') ? body.slice(0, -1) : body);
  if (!isFinite(value)) return null;
  let rest = s.slice(m[0].length), signed = !!m[1];
  const sci = rest.match(/^\s*(?:[eE]\s*([+-]?\d+)(?![\d.])|[x×*·]\s*10\s*(?:\^|\*\*)?\s*\(?\s*([+-]?\d+)\s*\)?)/);
  if (sci){ value *= Math.pow(10, +(sci[1] != null ? sci[1] : sci[2])); rest = rest.slice(sci[0].length); }
  const frac = rest.match(/^\s*\/\s*(\d+(?:\.\d+)?)(?![\d])/);
  if (frac && +frac[1]){ value /= +frac[1]; rest = rest.slice(frac[0].length); }
  if (m[1] === '-') value = -value;
  const trail = rest.match(/^\s*\^?\s*([+-])(?=\s*$|\s+\D)/);         // "3+", "2-", "3⁺" for a charge
  if (trail && !signed){ if (trail[1] === '-') value = -value; signed = true; rest = rest.slice(trail[0].length); }
  rest = rest.trim();
  const extra = /(?:^|[\s(=,;&]|or|and)[+-]?\.?\d/i.test(rest);
  return { value, rest, signed, extra };
}
/* rounding to three significant figures always counts, however tight the tolerance */
const sfSlack = a => a ? 0.5 * Math.pow(10, Math.floor(Math.log10(Math.abs(a))) - 2) : 0;
/* build a question's `accept`. dim picks the unit table; tol is how far off
   still counts (0 = exact); dir reads "left"/"right" as a sign. The returned
   function also carries .read, the typed value in the question's unit, which
   the test report uses to spot a wrong sign or a power of ten. */
function qty(answer, { tol = 0, dim = null, dir = false } = {}){
  const read = raw => {
    const r = readQuantity(raw);
    if (!r || r.extra) return null;
    let v = r.value;
    if (r.rest){
      const u = matchUnit(r.rest, dim);
      if (u && u.wrong) return null;
      if (u) v *= u.scale;
      if (dir && !r.signed && /\b(left|west|backwards?)\b/i.test(r.rest)) v = -v;
    }
    return v;
  };
  const accept = raw => {
    const v = read(raw);
    if (v == null) return false;
    const slack = tol > 0 ? Math.max(tol, sfSlack(answer)) : 0;
    return Math.abs(v - answer) <= slack + 1e-9 * Math.max(1, Math.abs(answer));
  };
  accept.read = read;
  return accept;
}
/* oxidation states: "+3", "3+", "3", "III", "+III", "−2", "2−" */
const ROMAN_VALUE = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8 };
function oxAccept(ox){
  const read = raw => {
    const s = String(raw == null ? '' : raw).replace(/[−–—‒]/g, '-').trim();
    const rm = s.match(/^([+-]?)\s*(viii|vii|vi|iv|v|iii|ii|i)\s*([+-]?)$/i);
    if (rm) return (rm[1] === '-' || rm[3] === '-' ? -1 : 1) * ROMAN_VALUE[rm[2].toLowerCase()];
    const r = readQuantity(s);
    return r && !r.extra && Number.isInteger(r.value) ? r.value : null;
  };
  const accept = raw => read(raw) === ox;
  accept.read = read;
  return accept;
}

/* ══ CHOOSING A QUESTION WITHIN A TOPIC ═══════════════════════════════════
   Shared by practice and tests. Kept outside revGame, with the history passed
   in, so the choice can be checked without a page. */
const PRACTICE_TRIES = 16;
/* turn a bank entry (a static {q,a,w} object, or a function) into a question */
function materialiseBank(raw){
  if (typeof raw === 'function') return raw();
  if (raw.w){ const m = mc(raw.a, raw.w); return { q:raw.q, choices:m.choices, answer:m.answer, note:raw.note, code:raw.code }; }
  return Object.assign({}, raw);
}
/* A question's history: hist[sig] = [seen, wrongness, lastOk, everWrong, rightRun].
   rightRun is how many times in a row it has been right since the last miss.
   Older saves have fewer slots, so these read each field the way it was meant. */
const lastOkOf    = h => h.length > 2 ? !!h[2] : !(h[1] > 0);
const everWrongOf = h => h.length > 3 ? !!h[3] : (h[1] > 0);
function rightRunOf(h){
  if (h.length > 4 && h[4] != null) return h[4];
  /* not recorded yet: never wrong means every view was right; a fixed one
     (yellow) is counted as just fixed, so it gets its consolidation turns */
  return !lastOkOf(h) ? 0 : everWrongOf(h) ? 1 : h[0];
}
/* The colour a question shows:
     new      grey    never answered
     wrong    red     the last answer was wrong
     fixed    yellow  was wrong, and has been right once since
     correct  green   never wrong, or right at least twice in a row since the miss
   A yellow turns green with one more right answer. (It used to stay yellow for
   good once a question had ever been wrong, so it could never go green.) */
function stateOfHist(h){
  if (!h) return 'new';
  if (!lastOkOf(h)) return 'wrong';
  return everWrongOf(h) && rightRunOf(h) < 2 ? 'fixed' : 'correct';
}
function recordAnswer(hist, sig, ok){
  const prev = hist[sig];
  const everWrong = prev ? everWrongOf(prev) : false, run = prev ? rightRunOf(prev) : 0;
  const h = prev ? prev.slice() : [0, 0];
  h[0] = (h[0] || 0) + 1;
  h[1] = ok ? Math.max(0, (h[1] || 0) - 1) : (h[1] || 0) + 1;
  h[2] = ok ? 1 : 0;                                      // was the last go right?
  h[3] = everWrong || !ok ? 1 : 0;                        // has it ever been wrong?
  h[4] = ok ? run + 1 : 0;
  hist[sig] = h;
  return h;
}
/* How much a question wants asking next. Unseen first, then still-wrong, then
   recently fixed, then whatever has gone longest without being proven.

   This used to take points off for every time a question had been SEEN. That
   quietly buried two kinds of question: a fixed one (yellow) had been seen more
   than a green precisely because it went wrong first, so it always lost to
   greens and never came back; and a question you kept getting wrong sank
   further with every miss. Only times it has been right since its last miss
   count against it now. For a green that is every view, so greens are ordered
   exactly as before. */
function sigScore(h, keyed, avoided, rand){
  let s = 1 + rand()*0.4;
  if (avoided) s -= 50;                                     // don't repeat recent ones
  if (!keyed) return s;
  if (!h) return s + 8;                                     // never seen: strongly prefer
  if (!lastOkOf(h)) return s + Math.min(h[1], 4) * 2.5;     // still wrong: revisit soon
  s -= Math.min(rightRunOf(h), 6) * 0.7;
  if (stateOfHist(h) === 'fixed') s += 1.0 + Math.min(h[1], 4) * 0.5;   // yellow: bring it back to confirm
  return s;
}
function chooseQuestion(t, hist, avoid, tries, rand){
  rand = rand || Math.random;
  const avoided = sig => avoid.includes(sig);
  let q;
  if (t.bank){
    let bi = 0, bs = -Infinity;
    for (let idx = 0; idx < t.bank.length; idx++){
      const raw = t.bank[idx], sig = (raw && raw.key) || (t.id+'#'+idx);
      const s = sigScore(hist[sig], true, avoided(sig), rand);
      if (s > bs){ bs = s; bi = idx; }
    }
    const raw = t.bank[bi];
    q = materialiseBank(raw); q._sig = (raw && raw.key) || (t.id+'#'+bi); q._keyed = true;
  } else {
    /* A generator can't be asked for a particular question, only sampled, so
       draw several and keep the best. Stop early only on an unseen one, which
       nothing can beat; stopping on a still-wrong one too would let whichever
       came up first win, and unseen ones are meant to go first. The draw is
       bigger than it was because with only a few samples, a handful of yellows
       in a large pool were rarely even looked at, whatever they scored. */
    let bs = -Infinity;
    for (let i = 0; i < tries; i++){
      const c = t.gen(), keyed = !!c.key, sig = t.id+':'+(c.key || c.q), h = hist[sig];
      const s = sigScore(h, keyed, avoided(sig), rand);
      c._sig = sig; c._keyed = keyed;
      if (s > bs){ bs = s; q = c; }
      if (keyed && !h && !avoided(sig)) break;
    }
  }
  return q;
}

/* ══ TESTS ═══════════════════════════════════════════════════════════════
   A test is a fixed-length run across every topic in a subject that adapts as
   it goes. Choosing the next topic and making sense of the results are plain
   functions with no DOM, so they can be checked on their own; revGame
   supplies the screens.

   What decides the next topic:
     coverage   every topic is asked at least once. Once the questions left
                equal the topics still unasked, nothing else is allowed.
     probing    a mistake raises that topic's weight so it comes back, which is
                how a slip (right next time) is told apart from a gap.
     moving on  a topic answered right with no mistakes is pushed back.
     freshness  the longer since a topic came up, the more it wants to return.
     spread     never the same topic twice running, rarely two apart, and a
                push away from whichever module was just asked.
   The pick is then drawn at random from the best three, weighted by score, so
   two tests for the same person don't run in the same order.

   Topics here are {id, name, mod, modName, gate, typed, size}. `gate` names a
   topic that must be answered right first (Hard code waits for Medium), and
   `typed` marks write-code questions, which are capped because each one takes
   minutes rather than seconds. */
const TEST_TYPED_MAX = 3;
const TEST_HISTORY = 20;        // tests kept for the score chart
/* an answer that is a number, optionally followed by a unit: "24", "12.5 m/s".
   Deliberately not "6x² − 4", which starts with a digit but is an expression. */
const TEST_NUMERIC = /^\s*[−-]?\d+(?:\.\d+)?(?:\s+\S.*)?$/;

function testLength(nTopics){
  return Math.max(30, Math.min(50, Math.round(12 + nTopics * 1.6)));
}
function testStat(prior, conf){
  return { asked:0, right:0, wrong:0, skip:0, last:-99, lastOk:null, seq:[], prior:prior || 0, conf:conf || 0 };
}
/* How shaky a topic looked in practice: the share of its questions whose last
   attempt was wrong, and how far to trust that (more history, more trust). It
   only nudges the order a topic first comes up in; the test itself decides. */
function historyPrior(hist, topicId){
  let seen = 0, bad = 0;
  for (const k in hist){
    if (!(k.startsWith(topicId + ':') || k.startsWith(topicId + '#'))) continue;
    const h = hist[k]; if (!Array.isArray(h)) continue;
    seen++;
    if (!(h.length > 2 ? !!h[2] : !(h[1] > 0))) bad++;
  }
  return { prior: seen ? bad / seen : 0, conf: Math.min(seen, 6) / 6 };
}
function testEligible(t, S, ctx){
  const s = S[t.id];
  if (t.gate && !(S[t.gate] && S[t.gate].right > 0)) return false;
  if (s.asked >= ctx.cap(t)) return false;
  if (t.typed){
    if (s.asked && !(s.wrong + s.skip)) return false;     // one good code answer per level is plenty
    if (ctx.typedUsed >= TEST_TYPED_MAX) return false;
  }
  return true;
}
function testWeight(t, s, i, n, unaskedN, ctx){
  let v = ctx.rand() * 1.5;
  const since = i - s.last, errs = s.wrong + s.skip;
  if (!s.asked){
    v += 6 + 4 * Math.min(1, unaskedN / Math.max(1, n - i));  // pressure rises as questions run out
    v += s.prior * s.conf * 3;                                // shaky in practice: ask it sooner
  } else {
    /* chance of getting this topic right: a Beta(1,1) estimate, leaning a
       little on practice history while the test has little to go on */
    const p = (s.right + 1 + (1 - s.prior) * s.conf) / (s.asked + 2 + s.conf);
    /* right the last two times since a miss: that miss was a slip, so stop
       chasing it. Without this one early mistake kept a topic "in doubt" for
       the whole test, and it got probed as hard as a real gap. */
    const settled = errs && s.seq.length >= 2 && s.seq.slice(-2).every(r => r === 'right');
    if (errs && !settled){
      v += 7 * (1 - p);
      if (s.lastOk === false) v += 2.5;                       // come back after a miss
    } else v -= s.right >= 2 ? 6 : 2.5;                       // known: move on
    v += Math.min(since, 12) * 0.3;
  }
  /* recently asked: two apart is unlikely, three and four less so. Scaled
     rather than a single step, because with only a handful of topics (Maths
     has five) a flat penalty still let it bounce between two of them */
  if (since >= 2 && since < 5) v -= 6 / since;
  if (ctx.lastMod != null && t.mod === ctx.lastMod) v -= 1.5;
  if (t.typed && (i < 5 || ctx.lastTyped)) v -= 4;            // don't open with, or stack, code writing
  return v;
}
/* the next topic to ask, or null when nothing is left to ask */
function testPick(topics, S, i, n, ctx){
  const lastId = ctx.lastIds[ctx.lastIds.length - 1];
  const last = lastId ? topics.find(t => t.id === lastId) : null;
  const c = Object.assign({ rand:Math.random }, ctx, {
    lastMod: last ? last.mod : null, lastTyped: !!(last && last.typed) });
  const open = topics.filter(t => testEligible(t, S, c));
  if (!open.length) return null;
  const unasked = open.filter(t => !S[t.id].asked);
  let pool = unasked.length && n - i <= unasked.length ? unasked : open;
  /* not either of the last two topics, as long as that still leaves a real
     choice; failing that, at least not the last one. A penalty alone wasn't
     enough: with five topics a missed one bounced straight back as A, B, A. */
  const recentIds = ctx.lastIds.slice(-2);
  const fresh = pool.filter(t => !recentIds.includes(t.id));
  if (fresh.length >= 2) pool = fresh;
  else { const notLast = pool.filter(t => t.id !== lastId); if (notLast.length) pool = notLast; }
  const scored = pool.map(t => ({ t, v:testWeight(t, S[t.id], i, n, unasked.length, c) }))
                     .sort((a, b) => b.v - a.v).slice(0, 3);
  const floor = scored[scored.length - 1].v;
  const w = scored.map(x => Math.pow(x.v - floor + 1, 2));
  let r = c.rand() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < scored.length; k++){ r -= w[k]; if (r <= 0) return scored[k].t; }
  return scored[0].t;
}

/* Turn a finished run into a report. Everything is recomputed from the answer
   log rather than trusted from the running totals, so a saved report can be
   reopened and re-read against the current topic list. `prev` is the compact
   summary of the test before, for the comparison lines. */
function analyseTest(run, topics, prev){
  const log = run.log || [];
  const S = {};
  topics.forEach(t => { S[t.id] = { asked:0, right:0, wrong:0, skip:0, seq:[] }; });
  log.forEach(e => { const s = S[e.topic]; if (!s) return; s.asked++; s[e.result]++; s.seq.push(e.result); });

  const answered = log.length;
  const right = log.filter(e => e.result === 'right').length;
  const skip = log.filter(e => e.result === 'skip').length;
  const pct = answered ? Math.round(right / answered * 100) : 0;
  const errsOf = s => s.wrong + s.skip;
  const acc = s => s.asked ? s.right / s.asked : 0;
  const est = s => (s.right + 1) / (s.asked + 2);
  /* one miss, then right at least twice and right last: a slip, not a gap */
  const isSlip = s => errsOf(s) === 1 && s.right >= 2 && s.seq[s.seq.length - 1] === 'right';
  const row = t => ({ id:t.id, name:t.name, mod:t.modName, right:S[t.id].right, asked:S[t.id].asked });

  const modules = [];
  topics.forEach(t => {
    let m = modules.find(x => x.id === t.mod);
    if (!m){ m = { id:t.mod, name:t.modName, asked:0, right:0 }; modules.push(m); }
    m.asked += S[t.id].asked; m.right += S[t.id].right;
  });

  const asked = topics.filter(t => S[t.id].asked);
  const strengths = asked.filter(t => S[t.id].asked >= 2 && !errsOf(S[t.id]))
    .sort((a, b) => S[b.id].right - S[a.id].right).map(row);
  const firstTime = asked.filter(t => S[t.id].asked === 1 && S[t.id].right === 1).map(row);
  const slips = asked.filter(t => isSlip(S[t.id])).map(row);
  const weak = asked.filter(t => errsOf(S[t.id]) && !isSlip(S[t.id]))
    .sort((a, b) => est(S[a.id]) - est(S[b.id]) || S[b.id].asked - S[a.id].asked)
    .map(t => { const s = S[t.id];
      return Object.assign(row(t), { tag: s.asked === 1 ? 'miss' : acc(s) < 0.34 ? 'gap' : 'shaky' }); });
  const byId = {}; topics.forEach(t => { byId[t.id] = t; });
  const notReached = topics.filter(t => t.gate && !S[t.id].asked)
    .map(t => ({ name:t.name, gate:(byId[t.gate] || {}).name || '' }));
  const unasked = topics.filter(t => !t.gate && !S[t.id].asked).map(t => t.name);

  /* ── patterns across the misses ── */
  const mistakes = [];
  const misses = log.filter(e => e.result === 'wrong');

  /* the same two options confused more than once */
  const pairs = new Map();
  misses.forEach(e => {
    if (e.kind !== 'mc' || e.code || e.pics || !e.given) return;   // picture options have ids, not words
    if (e.given.length > 48 || e.answer.length > 48 || TEST_NUMERIC.test(e.answer)) return;
    const key = [e.given, e.answer].sort().join('');
    const p = pairs.get(key) || { a:e.answer, b:e.given, n:0 };
    p.n++; pairs.set(key, p);
  });
  [...pairs.values()].filter(p => p.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3)
    .forEach(p => mistakes.push({ type:'mixup', a:p.a, b:p.b, n:p.n }));

  /* calculations against concept questions */
  const kindOf = e => e.code ? 'code' : (e.kind === 'input' || TEST_NUMERIC.test(e.answer)) ? 'calc' : 'concept';
  const tally = k => { const xs = log.filter(e => kindOf(e) === k);
    return { n:xs.length, r:xs.filter(e => e.result === 'right').length }; };
  const calc = tally('calc'), concept = tally('concept');
  if (calc.n >= 4 && concept.n >= 4){
    const d = calc.r / calc.n - concept.r / concept.n;
    if (Math.abs(d) >= 0.25) mistakes.push({ type: d < 0 ? 'calc' : 'concept', calc, concept });
  }

  /* numbers that were nearly right, and in what way */
  const numOf = s => { const m = String(s).replace(/−/g, '-').replace(/,/g, '').match(/^\s*-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN; };
  const near = { sign:0, ten:0, two:0, close:0 };
  misses.forEach(e => {
    if (e.code || e.given == null || !TEST_NUMERIC.test(e.answer)) return;
    const a = numOf(e.answer), g = e.gv != null ? e.gv : numOf(e.given);
    if (!isFinite(a) || !isFinite(g) || !a || g === a) return;
    const r = g / a, l = r > 0 ? Math.log10(r) : NaN;
    if (Math.abs(r + 1) < 1e-6) near.sign++;
    else if (isFinite(l) && Math.round(l) !== 0 && Math.abs(l - Math.round(l)) < 0.01) near.ten++;
    else if (Math.abs(r - 2) < 0.03 || Math.abs(r - 0.5) < 0.015) near.two++;
    else if (Math.abs(r - 1) <= 0.1) near.close++;
  });
  ['sign', 'ten', 'two', 'close'].forEach(k => { if (near[k]) mistakes.push({ type:k, n:near[k] }); });

  /* fast misses, when right answers were taking much longer */
  const fast = misses.filter(e => !e.code && e.ms > 0 && e.ms < 6000);
  const rightMs = log.filter(e => e.result === 'right' && !e.code && e.ms > 0).map(e => e.ms).sort((a, b) => a - b);
  const median = rightMs.length ? rightMs[rightMs.length >> 1] : 0;
  if (fast.length >= 3 && median >= 12000)
    mistakes.push({ type:'rushed', n:fast.length, typical:Math.round(median / 1000) });

  /* Late misses on topics already answered right earlier in the test. Simply
     comparing accuracy early and late would be misleading here: the probing
     deliberately saves weak topics for later, so the end is harder anyway. */
  if (answered >= 24){
    const cut = Math.floor(answered * 2 / 3), gotRight = new Set();
    let late = 0;
    log.forEach((e, k) => {
      if (k >= cut && e.result !== 'right' && gotRight.has(e.topic)) late++;
      if (e.result === 'right') gotRight.add(e.topic);
    });
    if (late >= 3) mistakes.push({ type:'tired', n:late });
  }
  if (skip >= 3) mistakes.push({ type:'skips', n:skip });

  let change = null;
  if (prev && prev.n){
    const was = prev.pct != null ? prev.pct : Math.round(prev.r / prev.n * 100);
    const better = [], worse = [];
    /* only topics with at least two questions both times: one question each
       way is a coin flip, not a trend */
    if (prev.t) topics.forEach(t => {
      const p = prev.t[t.id], s = S[t.id];
      if (!p || p[0] < 2 || s.asked < 2) return;
      const pa = p[1] / p[0], na = acc(s);
      if (na - pa >= 0.4 && na >= 0.6) better.push(t.name);
      else if (pa - na >= 0.4 && na <= 0.5) worse.push(t.name);
    });
    change = { was, delta:pct - was, better, worse };
  }

  const t = {};
  asked.forEach(tp => { t[tp.id] = [S[tp.id].asked, S[tp.id].right]; });
  return {
    n:run.n || answered, answered, right, skip, wrong:answered - right - skip, pct,
    ms:log.reduce((a, e) => a + (e.ms || 0), 0), ended:!!run.ended,
    band: pct >= 90 ? 'top' : pct >= 75 ? 'good' : pct >= 60 ? 'mid' : pct >= 40 ? 'low' : 'poor',
    modules, strengths, firstTime, slips, weak, notReached, unasked, mistakes, change,
    summary:{ d:run.date, n:answered, r:right, s:skip, pct, ms:log.reduce((a, e) => a + (e.ms || 0), 0), t }
  };
}

/* ── question generators ── */
const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const nzr = (a,b) => { let x=0; while (x===0) x = ri(a,b); return x; };
const pk = a => a[(Math.random()*a.length)|0];
const SUP = {'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
const sup = n => String(n).split('').map(c => SUP[c]||c).join('');
function polyStr(terms){
  const t = terms.filter(x => x.c!==0).sort((a,b) => b.p-a.p);
  if (!t.length) return '0';
  return t.map((x,i) => { const ac = Math.abs(x.c);
    let body = x.p===0 ? String(ac) : (ac===1?'':String(ac)) + 'x' + (x.p===1?'':sup(x.p));
    return i===0 ? (x.c<0?'−':'')+body : ' ' + (x.c<0?'−':'+') + ' ' + body;
  }).join('');
}
function mc(answer, distractors){
  const opts = [answer];
  for (const d of distractors){ if (opts.length>=4) break; if (d!=null && d!==answer && !opts.includes(d)) opts.push(d); }
  return { choices: shuffle(opts.slice()), answer };
}
function physMC(val, unit, wrongs){
  const fmt = x => (Math.round(x*100)/100) + ' ' + unit;
  const pad = [val*2, val/2, val+1, Math.abs(val)*1.5, val*3];  // fallbacks so options never collapse
  return mc(fmt(val), wrongs.concat(pad).map(fmt));
}
const nCr = (n,r) => { if (r<0||r>n) return 0; r=Math.min(r,n-r); let x=1; for (let i=0;i<r;i++) x = x*(n-i)/(i+1); return Math.round(x); };
const nPr = (n,r) => { let x=1; for (let i=0;i<r;i++) x*=(n-i); return x; };

function genDiff(){
  const powers = shuffle([1,2,3,4,5]).slice(0, ri(2,3));
  const terms = powers.map(p => ({ c:nzr(-6,6), p }));
  if (Math.random()<0.4) terms.push({ c:nzr(-9,9), p:0 });
  const d = terms.map(t => ({ c:t.c*t.p, p:Math.max(0,t.p-1) })).filter(t => t.c!==0);
  const ans = polyStr(d);
  const dis = [
    polyStr(terms.filter(t=>t.p>0).map(t=>({c:t.c*t.p,p:t.p}))),            // forgot to reduce power
    polyStr(terms.filter(t=>t.p>0).map(t=>({c:t.c,p:t.p-1}))),              // forgot to multiply
    polyStr(terms.map(t=>t.p===0?t:{c:t.c*t.p,p:t.p-1}).filter(t=>t.c!==0)),// kept the constant
    polyStr(d.map((t,i)=>i===0?{c:-t.c,p:t.p}:t))                           // a sign slip
  ];
  const m = mc(ans, dis);
  return { q:'Differentiate <b>f(x) = ' + polyStr(terms) + '</b>', choices:m.choices, answer:m.answer };
}
function genInt(){
  const powers = shuffle([0,1,2,3,4]).slice(0, ri(2,3));
  const terms = powers.map(p => ({ c:nzr(1,4)*(p+1)*(Math.random()<0.5?1:-1), p }));
  const I = terms.map(t => ({ c:t.c/(t.p+1), p:t.p+1 }));
  const ans = polyStr(I) + ' + C';
  const dis = [
    polyStr(terms.map(t=>({c:t.c,p:t.p+1}))) + ' + C',   // forgot to divide
    polyStr(terms.map(t=>({c:t.c/(t.p+1),p:t.p}))) + ' + C', // forgot to raise power
    polyStr(I),                                          // forgot + C
    polyStr(terms) + ' + C'                              // did nothing
  ];
  const m = mc(ans, dis);
  return { q:'Integrate <b>' + polyStr(terms) + '</b> with respect to x', choices:m.choices, answer:m.answer };
}
const fact = n => { let x=1; for (let i=2;i<=n;i++) x*=i; return x; };
function genComb(){
  const type = ri(0,5);
  if (type===0){ const n=ri(4,7); return { q:'In how many ways can <b>'+n+' people</b> be seated around a <b>circular table</b>?', input:true, answer:fact(n-1), note:'Fix one seat: ('+n+'−1)! = '+fact(n-1)+'.' }; }
  if (type===1){ const n=ri(4,7); return { q:'In how many ways can <b>'+n+' different books</b> be lined up on a shelf?', input:true, answer:fact(n), note:n+'! = '+fact(n)+'.' }; }
  if (type===2){ const a=ri(4,7), b=ri(3,6), r=ri(2,3), s=ri(1,2);
    return { q:'A team needs <b>'+r+'</b> people from a group of <b>'+a+'</b> and <b>'+s+'</b> from a group of <b>'+b+'</b>. How many ways?', input:true, answer:nCr(a,r)*nCr(b,s), note:'C('+a+','+r+')×C('+b+','+s+') = '+nCr(a,r)+'×'+nCr(b,s)+' = '+(nCr(a,r)*nCr(b,s))+'.' }; }
  if (type===3){ const m=ri(4,6), w=ri(3,5), k=ri(3,4), j=ri(1,Math.min(2,w)), men=k-j;
    if (men<1||men>m) return genComb();
    return { q:'From <b>'+m+' boys</b> and <b>'+w+' girls</b>, a committee of <b>'+k+'</b> is picked with exactly <b>'+j+' girl'+(j>1?'s':'')+'</b>. How many committees?', input:true, answer:nCr(w,j)*nCr(m,men), note:'C('+w+','+j+')×C('+m+','+men+') = '+(nCr(w,j)*nCr(m,men))+'.' }; }
  if (type===4){ const [wd,ans] = pk([['BOOK',12],['LEVEL',30],['APPLE',60],['BANANA',60],['ERROR',20],['CANADA',120]]);
    return { q:'How many distinct arrangements are there of the letters of <b>'+wd+'</b>?', input:true, answer:ans, note:wd.length+"! divided by the factorials of the repeated letters = "+ans+'.' }; }
  const b=ri(2,3), g=ri(2,3);
  return { q:'<b>'+b+' boys</b> and <b>'+g+' girls</b> sit in a row with <b>all the girls together</b>. How many arrangements?', input:true, answer:fact(b+1)*fact(g), note:'Treat the girls as one block: ('+b+'+1)!×'+g+'! = '+fact(b+1)+'×'+fact(g)+' = '+(fact(b+1)*fact(g))+'.' };
}
function genGraph(){
  const B = pk([{n:'x²',f:i=>'('+i+')²'},{n:'x³',f:i=>'('+i+')³'},{n:'√x',f:i=>'√('+i+')'},{n:'|x|',f:i=>'|'+i+'|'}]);
  const h=ri(1,4), k=ri(1,4), a=ri(2,3);
  const forms = [
    { eq:B.f('x − '+h), d:'Translation '+h+' unit'+(h>1?'s':'')+' right' },
    { eq:B.f('x + '+h), d:'Translation '+h+' unit'+(h>1?'s':'')+' left' },
    { eq:B.n+' + '+k,   d:'Translation '+k+' unit'+(k>1?'s':'')+' up' },
    { eq:B.n+' − '+k,   d:'Translation '+k+' unit'+(k>1?'s':'')+' down' },
    { eq:a+B.n,         d:'Vertical stretch, scale factor '+a },
    { eq:B.f(a+'x'),    d:'Horizontal stretch, scale factor 1/'+a },
    { eq:'−'+B.n,       d:'Reflection in the x-axis' },
    { eq:B.f('−x'),     d:'Reflection in the y-axis' }
  ];
  const chosen = pk(forms);
  if (Math.random()<0.5){ const m = mc(chosen.d, shuffle(forms.filter(o=>o.d!==chosen.d)).map(o=>o.d));
    return { q:'The graph of <b>y = '+B.n+'</b> becomes <b>y = '+chosen.eq+'</b>. Describe the transformation.', choices:m.choices, answer:m.answer }; }
  const m = mc(chosen.eq, shuffle(forms.filter(o=>o.eq!==chosen.eq)).map(o=>o.eq));
  return { q:'The graph of <b>y = '+B.n+'</b> undergoes a <b>'+chosen.d.toLowerCase()+'</b>. Which is the new equation?', choices:m.choices, answer:m.answer };
}
/* ══ SOFTWARE ══
   Write-code tasks are typed for real. We can't run Python in the browser, so a
   task lists the key parts a working answer must contain and we match those
   against a normalised version of what you typed — whitespace, quote style and
   variable names are free, and the model answer is always shown afterwards. */
const normCode = s => String(s || '')
  .replace(/#[^\n]*/g, '')                                   // comments
  .replace(/"/g, "'")                                        // quote style
  .replace(/\s+/g, ' ')                                      // all whitespace → one space
  .replace(/\s*([(),:;=+\-*/%<>\[\]!])\s*/g, '$1')           // tighten around punctuation
  .trim();

/* Each task has:
     need — parts every valid answer must contain (the signature, a return, …)
     any  — a list of alternative approaches; ANY ONE fully matching is enough,
            so `return n % 2 == 0` and an if/else both pass
     ban  — patterns that defeat the point of the exercise (e.g. max() in the
            "find the largest without max()" task)                              */
/* Every write-code task carries `check`: Python assertions run after the
   student's code, in the same namespace, so they can call what was defined.
   `OUT` is whatever the student printed; `stdin` feeds a fake input().
   These are what actually decide right or wrong — `need`/`any` below are only
   the fallback for when Pyodide can't load, and `ban` still blocks answers that
   sidestep the point of the exercise (sum() in the "add it with a loop" task). */
const CODE_TASKS = [
  /* ---- easy: one idea each ---- */
  { id:'e-range', lv:1, task:'Write a loop that prints the numbers <b>0 to 4</b>, one per line.',
    answer:'for i in range(5):\n    print(i)',
    check:"assert OUT.split() == ['0','1','2','3','4'], 'it printed: ' + repr(OUT.strip())",
    need:[/print\(/], any:[[/range\(5\)/], [/range\(0,5\)/], [/while/, /<5|<=4/]] },
  { id:'e-double', lv:1, task:'Write a function <code>double(n)</code> that returns <b>n times 2</b>.',
    answer:'def double(n):\n    return n * 2',
    check:"assert double(3) == 6, 'double(3) gave ' + repr(double(3))\nassert double(0) == 0\nassert double(-4) == -8",
    need:[/def double\(n\):/, /return/], any:[[/n\*2/], [/2\*n/], [/n\+n/]] },
  { id:'e-add', lv:1, task:'Write a function <code>add(a, b)</code> that returns their <b>sum</b>.',
    answer:'def add(a, b):\n    return a + b',
    check:"assert add(2, 3) == 5, 'add(2, 3) gave ' + repr(add(2, 3))\nassert add(-1, 1) == 0",
    need:[/def add\(a,b\):/, /return/], any:[[/a\+b/], [/b\+a/], [/sum\(/]] },
  { id:'e-max', lv:1, task:'Write a function <code>largest(xs)</code> that returns the <b>biggest value</b> in the list.',
    answer:'def largest(xs):\n    return max(xs)',
    check:"assert largest([3, 9, 2]) == 9, 'largest([3, 9, 2]) gave ' + repr(largest([3, 9, 2]))\nassert largest([-5, -2]) == -2\nassert largest([7]) == 7",
    need:[/def largest\(xs\):/, /return/], any:[[/max\(xs\)/], [/for \w+ in xs/, /[<>]/], [/sorted\(/]] },
  { id:'e-len', lv:1, task:'Write a function <code>count(xs)</code> that returns <b>how many items</b> the list has.',
    answer:'def count(xs):\n    return len(xs)',
    check:"assert count([1, 2, 3]) == 3, 'count([1, 2, 3]) gave ' + repr(count([1, 2, 3]))\nassert count([]) == 0",
    need:[/def count\(xs\):/, /return/], any:[[/len\(xs\)/], [/for \w+ in xs/, /\+=1/]] },
  { id:'e-rev', lv:1, task:'Write a function <code>backwards(s)</code> that returns the string <b>reversed</b>.',
    answer:'def backwards(s):\n    return s[::-1]',
    check:"assert backwards('abc') == 'cba', \"backwards('abc') gave \" + repr(backwards('abc'))\nassert backwards('') == ''\nassert backwards('a') == 'a'",
    need:[/def backwards\(s\):/, /return/], any:[[/s\[::-1\]/], [/reversed\(s\)/], [/for \w+ in s/]] },
  { id:'e-even', lv:1, task:'Write a function <code>is_even(n)</code> that returns <b>True</b> only when n is even.',
    answer:'def is_even(n):\n    return n % 2 == 0',
    check:"assert is_even(4) == True, 'is_even(4) gave ' + repr(is_even(4))\nassert is_even(7) == False, 'is_even(7) gave ' + repr(is_even(7))\nassert is_even(0) == True\nassert is_even(-3) == False",
    need:[/def is_even\(n\):/, /return/],
    any:[[/n%2==0/], [/0==n%2/], [/not n%2/], [/n%2!=1/],
         [/if n%2==0:/, /return True/, /return False/],
         [/if n%2!=0:/, /return False/, /return True/],
         [/if n%2==1:/, /return False/, /return True/]] },
  { id:'e-input', lv:1, task:'Read a name from the user and print <b>Hello</b> followed by that name.',
    answer:"name = input()\nprint('Hello ' + name)",
    stdin:['Ana'],
    check:"assert 'Ana' in OUT, 'it printed: ' + repr(OUT.strip())\nassert 'ello' in OUT, 'it printed: ' + repr(OUT.strip())",
    need:[/input\(\)/, /print\(/] },
  { id:'e-sum', lv:1, task:'Write a function <code>total(xs)</code> that returns the <b>sum</b> of the list.',
    answer:'def total(xs):\n    return sum(xs)',
    check:"assert total([1, 2, 3]) == 6, 'total([1, 2, 3]) gave ' + repr(total([1, 2, 3]))\nassert total([]) == 0",
    need:[/def total\(xs\):/, /return/], any:[[/sum\(xs\)/], [/for \w+ in xs/]] },
  { id:'e-area', lv:1, task:'Write a function <code>area(w, h)</code> that returns the <b>area of a rectangle</b>.',
    answer:'def area(w, h):\n    return w * h',
    check:"assert area(3, 4) == 12, 'area(3, 4) gave ' + repr(area(3, 4))\nassert area(0, 5) == 0",
    need:[/def area\(w,h\):/, /return/], any:[[/w\*h/], [/h\*w/]] },

  /* ---- medium: classes, methods, loops that build something ---- */
  { id:'m-dog', lv:2, task:'Define a class <code>Dog</code> with a method <code>speak()</code> that returns <b>\'Woof\'</b>.',
    answer:"class Dog:\n    def speak(self):\n        return 'Woof'",
    check:"d = Dog()\nassert d.speak().lower() == 'woof', 'speak() gave ' + repr(d.speak())",
    need:[/class Dog:/, /def speak\(self\):/, /return 'woof'/i] },
  { id:'m-init', lv:2, task:'Define a class <code>Student</code> whose constructor takes a <code>name</code> and stores it on the object.',
    answer:'class Student:\n    def __init__(self, name):\n        self.name = name',
    check:"s = Student('Ana')\nassert s.name == 'Ana', 'the name was stored as ' + repr(getattr(s, 'name', None))",
    need:[/class Student:/, /def __init__\(self,name\):/, /self.name=name/] },
  { id:'m-loopsum', lv:2, task:'Write <code>total(xs)</code> that adds the list up <b>with a loop</b>, not <code>sum()</code>.',
    answer:'def total(xs):\n    t = 0\n    for x in xs:\n        t += x\n    return t',
    check:"assert total([1, 2, 3]) == 6, 'total([1, 2, 3]) gave ' + repr(total([1, 2, 3]))\nassert total([]) == 0",
    need:[/def total\(xs\):/, /for \w+ in xs:/, /return/], ban:[/sum\(/],
    any:[[/\+=/], [/=\w+\+\w+/]] },
  { id:'m-vowels', lv:2, task:'Write <code>count_vowels(s)</code> that returns how many vowels the string contains.',
    answer:"def count_vowels(s):\n    n = 0\n    for ch in s:\n        if ch in 'aeiou':\n            n += 1\n    return n",
    check:"assert count_vowels('hello') == 2, \"count_vowels('hello') gave \" + repr(count_vowels('hello'))\nassert count_vowels('xyz') == 0\nassert count_vowels('aeiou') == 5",
    need:[/def count_vowels\(s\):/, /return/],
    any:[[/aeiou/i], [/'a','e'/i], [/\['a'/i], [/'a'.*'e'.*'i'/i]] },
  { id:'m-squares', lv:2, task:'Write <code>squares(xs)</code> that returns a <b>new list</b> of every value squared.',
    answer:'def squares(xs):\n    return [x * x for x in xs]',
    check:"assert squares([1, 2, 3]) == [1, 4, 9], 'squares([1, 2, 3]) gave ' + repr(squares([1, 2, 3]))\nassert squares([]) == []",
    need:[/def squares\(xs\):/, /return/], any:[[/for \w+ in xs/], [/map\(/]] },
  { id:'m-evens', lv:2, task:'Write <code>evens(xs)</code> that returns a new list of only the <b>even</b> numbers.',
    answer:'def evens(xs):\n    return [x for x in xs if x % 2 == 0]',
    check:"assert evens([1, 2, 3, 4]) == [2, 4], 'evens([1, 2, 3, 4]) gave ' + repr(evens([1, 2, 3, 4]))\nassert evens([1, 3]) == []",
    need:[/def evens\(xs\):/, /return/],
    any:[[/%2==0/], [/%2!=1/], [/not \w+%2/], [/filter\(/]] },
  { id:'m-nomax', lv:2, task:'Write <code>biggest(xs)</code> that finds the largest value <b>without</b> using <code>max()</code>.',
    answer:'def biggest(xs):\n    best = xs[0]\n    for x in xs:\n        if x > best:\n            best = x\n    return best',
    check:"assert biggest([3, 9, 2]) == 9, 'biggest([3, 9, 2]) gave ' + repr(biggest([3, 9, 2]))\nassert biggest([-5, -2]) == -2\nassert biggest([7]) == 7",
    need:[/def biggest\(xs\):/, /return/], ban:[/max\(/],
    any:[[/for \w+ in xs/, /[<>]/], [/sorted\(/]] },
  { id:'m-rect', lv:2, task:'Define a class <code>Rectangle</code> that stores <code>w</code> and <code>h</code>, with an <code>area()</code> method.',
    answer:'class Rectangle:\n    def __init__(self, w, h):\n        self.w = w\n        self.h = h\n\n    def area(self):\n        return self.w * self.h',
    check:"r = Rectangle(3, 4)\nassert r.area() == 12, 'Rectangle(3, 4).area() gave ' + repr(r.area())\nassert Rectangle(0, 5).area() == 0",
    need:[/class Rectangle:/, /def __init__\(self,w,h\):/, /def area\(self\):/, /self\.w/, /self\.h/, /\*/, /return/] },
  { id:'m-bank', lv:2, task:'Define a class <code>BankAccount</code> starting at a balance of 0, with a <code>deposit(amount)</code> method that adds to it.',
    answer:'class BankAccount:\n    def __init__(self):\n        self.balance = 0\n\n    def deposit(self, amount):\n        self.balance += amount',
    check:"b = BankAccount()\nassert b.balance == 0, 'a new account started at ' + repr(b.balance)\nb.deposit(50)\nassert b.balance == 50, 'after depositing 50 the balance was ' + repr(b.balance)\nb.deposit(25)\nassert b.balance == 75",
    need:[/class BankAccount:/, /def deposit\(self,\w+\):/],
    any:[[/self.balance\+=/], [/self.balance=self.balance\+/]] },
  { id:'m-words', lv:2, task:'Write <code>word_count(sentence)</code> that returns <b>how many words</b> the sentence has.',
    answer:'def word_count(sentence):\n    return len(sentence.split())',
    check:"assert word_count('a b c') == 3, \"word_count('a b c') gave \" + repr(word_count('a b c'))\nassert word_count('hello   world') == 2",
    need:[/def word_count\(sentence\):/, /split\(\)/, /return/],
    any:[[/len\(/], [/for \w+ in/, /\+=1/]] },

  /* ---- hard: several steps held together ---- */
  { id:'h-magic', lv:3, task:'Write <code>is_magic(grid)</code> for a square 2-D list. Return <b>True</b> only if every row, every column and both diagonals add to the same total.',
    answer:'def is_magic(grid):\n    n = len(grid)\n    target = sum(grid[0])\n    for row in grid:\n        if sum(row) != target:\n            return False\n    for c in range(n):\n        if sum(grid[r][c] for r in range(n)) != target:\n            return False\n    if sum(grid[i][i] for i in range(n)) != target:\n        return False\n    if sum(grid[i][n - 1 - i] for i in range(n)) != target:\n        return False\n    return True',
    check:"assert is_magic([[2,7,6],[9,5,1],[4,3,8]]) == True, 'a real magic square was rejected'\nassert is_magic([[1,2,3],[4,5,6],[7,8,9]]) == False, 'rows 6/15/24 are not a magic square'\nassert is_magic([[1,1],[1,1]]) == True\nassert is_magic([[2,7,6],[9,5,1],[4,8,3]]) == False, 'that grid fails on the columns/diagonals'",
    need:[/def is_magic\(grid\):/, /for/, /return/], any:[[/sum\(/], [/\+=/]] },
  { id:'h-pal', lv:3, task:'Write <code>is_palindrome(s)</code> that ignores <b>spaces and capitals</b>, so "Never odd or even" counts.',
    answer:"def is_palindrome(s):\n    t = s.lower().replace(' ', '')\n    return t == t[::-1]",
    check:"assert is_palindrome('Never odd or even') == True, 'that one is a palindrome once you drop spaces and capitals'\nassert is_palindrome('hello') == False\nassert is_palindrome('Racecar') == True, 'capitals should be ignored'",
    need:[/def is_palindrome\(s\):/, /return/, /lower\(\)|upper\(\)/, /replace\(|join\(|split\(\)|isalnum/],
    any:[[/\[::-1\]/], [/reversed\(/]] },
  { id:'h-fizz', lv:3, task:'Write <code>fizzbuzz(n)</code> that prints 1 to n, but <b>Fizz</b> for multiples of 3, <b>Buzz</b> for 5 and <b>FizzBuzz</b> for both.',
    answer:"def fizzbuzz(n):\n    for i in range(1, n + 1):\n        if i % 15 == 0:\n            print('FizzBuzz')\n        elif i % 3 == 0:\n            print('Fizz')\n        elif i % 5 == 0:\n            print('Buzz')\n        else:\n            print(i)",
    check:"import io, contextlib\n_b = io.StringIO()\nwith contextlib.redirect_stdout(_b):\n    fizzbuzz(15)\n_got = [w.strip().lower() for w in _b.getvalue().split()]\n_want = ['1','2','fizz','4','buzz','fizz','7','8','fizz','buzz','11','fizz','13','14','fizzbuzz']\nassert _got == _want, 'fizzbuzz(15) printed ' + repr(_got)",
    need:[/def fizzbuzz\(n\):/, /fizz/i, /buzz/i, /for/, /%3|%15/, /%5|%15/] },
  { id:'h-bubble', lv:3, task:'Write <code>bubble_sort(xs)</code> that sorts the list <b>in place</b> with nested loops and returns it.',
    answer:'def bubble_sort(xs):\n    for i in range(len(xs)):\n        for j in range(len(xs) - 1 - i):\n            if xs[j] > xs[j + 1]:\n                xs[j], xs[j + 1] = xs[j + 1], xs[j]\n    return xs',
    check:"assert bubble_sort([3, 1, 2]) == [1, 2, 3], 'bubble_sort([3, 1, 2]) gave ' + repr(bubble_sort([3, 1, 2]))\nassert bubble_sort([]) == []\nassert bubble_sort([5, 4, 3, 2, 1]) == [1, 2, 3, 4, 5]",
    need:[/def bubble_sort\(xs\):/, /for .*for /, /[<>]/, /return/], ban:[/sorted\(|\.sort\(/] },
  { id:'h-second', lv:3, task:'Write <code>second_largest(xs)</code> that returns the <b>second biggest</b> value in the list.',
    answer:'def second_largest(xs):\n    return sorted(set(xs))[-2]',
    check:"assert second_largest([3, 9, 2]) == 3, 'second_largest([3, 9, 2]) gave ' + repr(second_largest([3, 9, 2]))\nassert second_largest([1, 2]) == 1\nassert second_largest([10, 4, 7]) == 7",
    need:[/def second_largest\(xs\):/, /return/], any:[[/sorted\(/], [/for \w+ in xs/], [/max\(/]] },
  { id:'h-inherit', lv:3, task:'Define <code>Animal</code> with a <code>speak()</code> method, then <code>Dog</code> which <b>inherits</b> from it and <b>overrides</b> <code>speak()</code> to return \'Woof\'.',
    answer:"class Animal:\n    def speak(self):\n        return '...'\n\nclass Dog(Animal):\n    def speak(self):\n        return 'Woof'",
    check:"d = Dog()\nassert isinstance(d, Animal), 'Dog should inherit from Animal'\nassert d.speak().lower() == 'woof', 'Dog().speak() gave ' + repr(d.speak())\nassert Dog.speak is not Animal.speak, 'Dog should override speak(), not just inherit it'",
    need:[/class Animal:/, /class Dog\(Animal\):/, /def speak\(self\):.*def speak\(self\):/, /return 'woof'/i] },
  { id:'h-freq', lv:3, task:'Write <code>count_words(text)</code> that returns a <b>dictionary</b> mapping each word to how many times it appears.',
    answer:'def count_words(text):\n    counts = {}\n    for w in text.split():\n        counts[w] = counts.get(w, 0) + 1\n    return counts',
    check:"_r = count_words('a b a')\nassert _r['a'] == 2, \"count_words('a b a') gave \" + repr(dict(_r))\nassert _r['b'] == 1\nassert len(_r) == 2",
    need:[/def count_words\(text\):/, /split\(\)/, /return/],
    any:[[/\{\}/], [/dict\(\)/], [/Counter\(/], [/setdefault/], [/\.get\(/]] }
];

/* ── the Pyodide worker, lazily started ────────────────────────────────
   Grading runs the student's code for real. The worker keeps the download and
   any endless loop off the main thread; if it can't load (offline, blocked)
   `dead` goes true and genWrite falls back to the pattern check. */
const PY = (() => {
  let worker = null, seq = 0, ready = false, dead = false;
  const pending = new Map();
  function fail(err){
    [...pending.values()].forEach(p => { clearTimeout(p.timer); p.reject(err); });
    pending.clear();
  }
  function spawn(){
    try { worker = new Worker('pyworker.js'); }
    catch { dead = true; return false; }
    worker.onmessage = e => {
      const m = e.data || {}, p = pending.get(m.id);
      if (m.fatal) dead = true;
      if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer);
      if (m.fatal) p.reject(new Error(m.fatal)); else { ready = true; p.resolve(m); }
    };
    worker.onerror = () => { dead = true; fail(new Error('python unavailable')); };
    return true;
  }
  function send(msg, ms){
    if (dead) return Promise.reject(new Error('python unavailable'));
    if (!worker && !spawn()) return Promise.reject(new Error('python unavailable'));
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        try { worker.terminate(); } catch {}
        worker = null; ready = false;            // a fresh one next time
        reject(new Error('timeout'));
      }, ms);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage(Object.assign({ id }, msg));
    });
  }
  return {
    get dead(){ return dead; },
    get ready(){ return ready; },
    warm(){ return send({ warm:true }, 120000).then(()=>true).catch(()=>false); },
    /* generous while Pyodide is still downloading, tight once it's up so an
       endless loop is caught quickly */
    run(src, check, stdin){ return send({ src, check, stdin }, ready ? 12000 : 120000); },
    /* compile-only: reports syntax errors without executing anything */
    syntax(src){ return send({ syntax:src }, 10000)
      .then(r => r.syntaxErr ? { ok:false, msg:r.syntaxErr.msg, line:r.syntaxErr.line } : { ok:true }); }
  };
})();

function genWrite(lv){
  const t = pk(CODE_TASKS.filter(x => x.lv === lv));
  const patternOK = c =>
    t.need.every(re => re.test(c)) && (!t.any || t.any.some(g => g.every(re => re.test(c))));
  return {
    q:t.task, typed:true, answer:t.answer, key:'write:'+t.id,
    note:'Your code is run against the task\u2019s test cases.',
    acceptAsync: async v => {
      const c = normCode(v);
      if (c.length < 5) return { ok:false, detail:'Write something first.' };
      if (t.ban && t.ban.some(re => re.test(c)))
        return { ok:false, detail:'That uses something this task asks you to do without.' };
      if (t.check && !PY.dead){
        try {
          const r = await PY.run(v, t.check, t.stdin || null);
          return r.ok ? { ok:true, detail:'Every test case passed.' }
                      : { ok:false, detail:r.err };
        } catch (e){
          if (e && e.message === 'timeout')
            return { ok:false, detail:'That took too long to run. Is there a loop that never ends?' };
          /* Pyodide unavailable — fall through to the pattern check */
        }
      }
      return { ok:patternOK(c),
        detail:'Python couldn\u2019t load, so this was checked against the shape of an answer instead.' };
    }
  };
}

/* ══ SOFTWARE ENGINEERING (NSW HSC Year 11) ══
   Content follows the three course modules — Programming fundamentals, The
   object-oriented paradigm, and Programming mechatronics. Terms live in tables
   of {n, d, ex?, bad?} and are asked both ways (definition→term and term→
   definition), plus "which does this example show?" where an example reads
   unambiguously.

   `bad` matters: it lists terms that would ALSO be a fair answer for that row's
   example, so they are never offered as distractors. Without it a question like
   "which idea does `class Dog(Animal):` show?" could offer both Inheritance and
   Class, and both would be defensible. */
function termQ(rows, keyp, askDef, askName, askEx){
  const r = pk(rows);
  const safe = rows.filter(x => x !== r && !(r.bad || []).includes(x.n));
  const useEx = askEx && r.ex && Math.random() < 0.34;
  if (useEx){
    const m = mc(r.n, shuffle(safe).map(x => x.n));
    return { q: askEx(r), choices:m.choices, answer:m.answer, key:keyp+'-x:'+r.n };
  }
  if (Math.random() < 0.5){
    const m = mc(r.n, shuffle(safe).map(x => x.n));
    return { q: askDef(r), choices:m.choices, answer:m.answer, key:keyp+'-d:'+r.n };
  }
  const m = mc(r.d, shuffle(rows.filter(x => x !== r)).map(x => x.d));
  return { q: askName(r), choices:m.choices, answer:m.answer, key:keyp+'-n:'+r.n };
}
const exBlock = r => '<pre class="rvans">' + esc(r.ex) + '</pre>';

/* ── the paradigms the course asks you to experiment with ───────────────── */
const PARADIGMS = [
  { n:'Object-oriented', d:'organises a program around objects that bundle data together with the methods acting on it',
    ex:'class Account:\n    def deposit(self, n):\n        self.balance += n', bad:['Imperative','Procedural'] },
  { n:'Procedural', d:'organises a program as an ordered set of procedures and functions that act on data passed to them',
    ex:'def main():\n    data = read()\n    show(process(data))', bad:['Imperative','Object-oriented'] },
  { n:'Imperative', d:'gives an explicit, ordered list of statements that change the program’s state as they run',
    ex:'total = 0\nfor x in xs:\n    total = total + x', bad:['Procedural','Object-oriented'] },
  { n:'Functional', d:'builds a program out of functions that return values and avoid changing stored state',
    ex:'total = reduce(lambda a, b: a + b, map(square, xs))', bad:['Logic'] },
  { n:'Logic', d:'states facts and rules and lets the system infer the answers for itself',
    ex:'parent(tom, bob).\ngrandparent(X, Y) :- parent(X, Z), parent(Z, Y).', bad:['Functional'] }
];
const PARA_EXTRA = [
  {q:'Compared with procedural programming, OOP mainly differs by…', a:'Bundling data together with the methods that act on it', w:['Running faster in every case','Removing the need for any loops, branching or variables','Avoiding the use of functions entirely']},
  {q:'A strength of OOP for large, shared projects is that…', a:'Classes can be built and tested separately', w:['It removes the need for version control on the project','It makes every program shorter','It avoids the need for any testing']},
  {q:'In procedural programming, data and the code that acts on it are…', a:'Kept separate, with data passed into procedures', w:['Always bundled into one object','Stored only in a database','Hidden from the programmer']},
  {q:'Which paradigm is Python able to support?', a:'Both object-oriented and procedural', w:['Only object-oriented programming','Only procedural programming','Only logic programming']},
  {q:'Message passing in OOP means…', a:'Objects interacting by calling each other’s methods', w:['Sending data over a network','Printing messages to the screen','Passing comments between developers']}
];
function genParadigm(){
  if (Math.random() < 0.28) return bankQ(PARA_EXTRA, 'parax');
  return termQ(PARADIGMS, 'par',
    r => 'Which paradigm <b>' + r.d + '</b>?',
    r => 'What best describes the <b>' + r.n + '</b> paradigm?',
    r => 'Which paradigm does this show?' + exBlock(r));
}

/* ── OOP key features (objects, classes, encapsulation, abstraction,
      inheritance, generalisation, polymorphism) ─────────────────────────── */
const OOPC = [
  { n:'Object', d:'an instance created from a class, holding its own attribute values',
    ex:"s = Student('Ana')", bad:['Class'] },
  { n:'Class', d:'a blueprint that defines the attributes and methods its objects will have',
    ex:'class Student:', bad:['Object'] },
  { n:'Encapsulation', d:'bundling data with the methods that use it, and restricting direct access to that data',
    ex:'keeping balance private and only changing it through deposit()', bad:['Abstraction'] },
  { n:'Abstraction', d:'hiding the complicated implementation and exposing only the essential features',
    ex:'calling car.start() without knowing anything about the engine', bad:['Encapsulation'] },
  { n:'Inheritance', d:'one class taking on the attributes and methods of a parent class',
    ex:'class Dog(Animal):', bad:['Class','Generalisation'] },
  { n:'Generalisation', d:'pulling features shared by several classes up into a common superclass',
    ex:'moving name and age out of Dog and Cat into a shared Animal class', bad:['Inheritance','Abstraction'] },
  { n:'Polymorphism', d:'the same method call behaving differently depending on the object it acts on',
    ex:'Dog and Cat each define speak(), and one loop calls speak() on both', bad:['Overriding','Inheritance'] },
  { n:'Method', d:'a function defined inside a class that acts on the object',
    ex:'def deposit(self, amount):', bad:['Constructor'] },
  { n:'Attribute', d:'a named piece of data stored on an object',
    ex:'self.balance' },
  { n:'Constructor', d:'the method that runs as an object is created, setting up its starting state',
    ex:'def __init__(self):', bad:['Method'] },
  { n:'Overriding', d:'a subclass replacing an inherited method with its own version',
    ex:'Dog redefines speak(), which it inherited from Animal', bad:['Inheritance','Polymorphism'] },
  { n:'Message passing', d:'objects interacting by calling one another’s methods',
    ex:'account.deposit(50) sends a message to the account object', bad:['Method'] }
];
function genOOP(){
  return termQ(OOPC, 'oop',
    r => 'Which OOP idea is <b>' + r.d + '</b>?',
    r => 'In OOP, what does <b>' + r.n + '</b> mean?',
    r => 'Which OOP idea does this show?' + exBlock(r));
}

/* ── OOP design, documentation and quality ─────────────────────────────── */
const OOP_DESIGN = [
  { n:'Task definition', d:'stating clearly what the program has to do before any design begins' },
  { n:'Top-down design', d:'starting from the whole problem and breaking it down into smaller subproblems' },
  { n:'Bottom-up design', d:'building and testing small components first, then combining them into the system' },
  { n:'Facade pattern', d:'a single simple interface placed in front of a complicated subsystem' },
  { n:'Agility', d:'working in short cycles and adapting the plan as requirements change' },
  { n:'Class diagram', d:'a diagram showing classes, their attributes and methods, and how they relate' },
  { n:'Data flow diagram', d:'a diagram showing how data moves between processes, stores and outside entities' },
  { n:'Structure chart', d:'a diagram showing the hierarchy of subroutines and the data passed between them' },
  { n:'Code optimisation', d:'rewriting working code so it runs faster or uses fewer resources' },
  { n:'Stub', d:'a placeholder subroutine that lets the rest of the program be tested before it is written' },
  { n:'Clear mainline', d:'a short, uncluttered top level that mostly just calls subroutines' },
  { n:'One task per subroutine', d:'keeping each subroutine responsible for a single logical job' },
  { n:'Version control', d:'keeping a history of changes so work can be tracked, shared and rolled back' },
  { n:'Code commenting', d:'notes in the source that explain the intent to whoever reads it next' },
  { n:'Quality assurance', d:'the process that checks the product is being built to the required standard' },
  { n:'Regular backup', d:'keeping spare copies of the project so work is not lost' }
];
function genOopDesign(){
  return termQ(OOP_DESIGN, 'oopd',
    r => 'Which term means <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── Programming fundamentals: the development steps ───────────────────── */
const DEV_STEPS = [
  { n:'Requirements definition', d:'working out what the client actually needs the software to do' },
  { n:'Determining specifications', d:'turning those needs into precise, testable technical requirements' },
  { n:'Design', d:'planning the structure, algorithms and interface before any code is written' },
  { n:'Development', d:'writing the actual program code' },
  { n:'Integration', d:'combining the separate modules so they work together as one system' },
  { n:'Testing and debugging', d:'finding faults in the software and correcting them' },
  { n:'Installation', d:'putting the finished system into its real environment for users' },
  { n:'Maintenance', d:'fixing and improving the software after it has been released' },
  { n:'Waterfall model', d:'a sequential approach where each stage is completed before the next begins' },
  { n:'Agile model', d:'an iterative approach delivering working software in short cycles with frequent feedback' }
];
const DEV_EXTRA = [
  {q:'Which stage comes <b>first</b> in the software development steps?', a:'Requirements definition', w:['Design','Development','Testing and debugging']},
  {q:'Which stage happens <b>after</b> the software has been released?', a:'Maintenance', w:['Integration','Design','Determining specifications']},
  {q:'A key advantage of the Agile model over Waterfall is that…', a:'Requirements can change between short cycles', w:['No testing is needed','Documentation never has to be written or kept up to date','The cost is always lower']},
  {q:'A weakness of the Waterfall model is that…', a:'Going back to an earlier stage is difficult and costly', w:['It cannot be documented','It has no design stage','It cannot be used for large projects with many developers']},
  {q:'Online code collaboration tools mainly help a team by…', a:'Letting a team share one codebase', w:['Writing the code automatically','Removing the need for testing','Making programs run faster']}
];
function genDevStep(){
  if (Math.random() < 0.3) return bankQ(DEV_EXTRA, 'devx');
  return termQ(DEV_STEPS, 'dev',
    r => 'Which step is <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── Programming fundamentals: algorithms ──────────────────────────────── */
const ALGO = [
  { n:'Sequence', d:'steps carried out one after another, in order' },
  { n:'Selection', d:'choosing between different paths depending on a condition' },
  { n:'Iteration', d:'repeating a set of steps while some condition holds' },
  { n:'Subprogram', d:'a named block of code that can be called from elsewhere in the program' },
  { n:'Procedure', d:'a subprogram that carries out a task without returning a value' },
  { n:'Function', d:'a subprogram that returns a value to whatever called it' },
  { n:'Parameter passing', d:'sending values into a subprogram when it is called' },
  { n:'Divide and conquer', d:'splitting a problem into smaller independent subproblems, solving each, then combining the results' },
  { n:'Backtracking', d:'trying one path and, when it fails, undoing the last choice and trying another' },
  { n:'Pseudocode', d:'a structured, language-independent way of writing an algorithm in near-English' },
  { n:'Flowchart', d:'a diagram using standard shapes to show an algorithm’s flow of control' },
  { n:'Desk checking', d:'tracing an algorithm by hand with chosen test values to find logic errors' },
  { n:'Peer checking', d:'having another programmer review your algorithm or code' },
  { n:'Refinement diagram', d:'a diagram that breaks each step down into progressively more detailed steps' }
];
function genAlgo(){
  return termQ(ALGO, 'alg',
    r => 'Which term means <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── Programming fundamentals: data types and structures ───────────────── */
const DATA_T = [
  { n:'Boolean', d:'a value that can only be True or False' },
  { n:'Integer', d:'a whole number, with no fractional part' },
  { n:'Real (floating point)', d:'a number that may have a fractional part' },
  { n:'Single precision floating point', d:'a real number stored in 32 bits' },
  { n:'Char', d:'a single character' },
  { n:'String', d:'a sequence of characters' },
  { n:'Date and time', d:'a value holding a calendar date and/or a time of day' },
  { n:'Array', d:'a fixed-size collection of items of the same type, reached by index' },
  { n:'Multidimensional array', d:'an array whose elements are themselves arrays, like a grid' },
  { n:'Record', d:'a group of related fields, possibly of different types, stored as one item' },
  { n:'List', d:'an ordered collection that can grow and shrink as the program runs' },
  { n:'Tree', d:'a hierarchical structure of nodes descending from a single root' },
  { n:'Stack', d:'a last-in, first-out structure: the last item pushed is the first popped' },
  { n:'Hash table', d:'a structure that maps keys to values using a hash function for fast lookup' },
  { n:'Sequential file', d:'a file whose records are read one after another from the beginning' },
  { n:'Data dictionary', d:'a table describing each data item’s name, data type, size, format and purpose' }
];
function genDataType(){
  return termQ(DATA_T, 'dat',
    r => 'Which one is <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── Programming fundamentals: number systems (fully computed) ─────────── */
function genNumber(){
  const k = ri(0, 4);
  const hex = n => n.toString(16).toUpperCase();
  if (k === 0){                                     // decimal → binary
    const n = ri(5, 255), a = n.toString(2);
    const m = mc(a, [(n+1).toString(2), (n-1).toString(2), (n^0b1010).toString(2)]);
    return { q:'What is decimal <b>' + n + '</b> in <b>binary</b>?', choices:m.choices, answer:m.answer,
      note:n + ' = ' + a + ' in binary.' };
  }
  if (k === 1){                                     // binary → decimal
    const n = ri(5, 255), b = n.toString(2);
    const m = mc(String(n), [String(n+1), String(n-1), String(n*2)]);
    return { q:'What is binary <b>' + b + '</b> in <b>decimal</b>?', choices:m.choices, answer:m.answer,
      note:b + ' = ' + n + '.' };
  }
  if (k === 2){                                     // decimal → hex
    const n = ri(10, 255), h = hex(n);
    const m = mc(h, [hex(n+1), hex(n-1), hex(n+16)]);
    return { q:'What is decimal <b>' + n + '</b> in <b>hexadecimal</b>?', choices:m.choices, answer:m.answer,
      note:n + ' = 0x' + h + '.' };
  }
  if (k === 3){                                     // hex → decimal
    const n = ri(10, 255), h = hex(n);
    const m = mc(String(n), [String(n+1), String(n-1), String(n+16)]);
    return { q:'What is hexadecimal <b>' + h + '</b> in <b>decimal</b>?', choices:m.choices, answer:m.answer,
      note:'0x' + h + ' = ' + n + '.' };
  }
  const v = ri(1, 120);                             // two's complement of a negative
  const tc = ((256 - v) >>> 0).toString(2).padStart(8, '0');
  const m = mc(tc, [v.toString(2).padStart(8,'0'), ((256-v+1)&255).toString(2).padStart(8,'0'),
                    (((~v)>>>0)&255).toString(2).padStart(8,'0')]);
  return { q:'How is <b>−' + v + '</b> written as an <b>8-bit two’s complement</b> number?',
    choices:m.choices, answer:m.answer,
    note:'Invert the bits of ' + v + ' and add 1 → ' + tc + '.' };
}

/* ── Programming fundamentals: testing and debugging ───────────────────── */
const TESTING = [
  { n:'Syntax error', d:'code that breaks the rules of the language, so it will not run at all' },
  { n:'Logic error', d:'the program runs to completion but produces the wrong result' },
  { n:'Runtime error', d:'the program crashes part-way through, such as on a division by zero' },
  { n:'Boundary values', d:'test data taken from right at the edges of the acceptable range' },
  { n:'Path coverage', d:'choosing test data so that every branch through the code is executed' },
  { n:'Faulty or abnormal data', d:'deliberately invalid input used to check the program copes with it' },
  { n:'Breakpoint', d:'a marker that pauses execution at a chosen line so you can inspect the state' },
  { n:'Single line stepping', d:'running the program one line at a time to watch what each line does' },
  { n:'Watch', d:'a variable the debugger keeps displaying as the program runs' },
  { n:'Debugging output statement', d:'a temporary print added to reveal a value while the program runs' },
  { n:'Unit testing', d:'testing one subroutine or component on its own' },
  { n:'Subsystem testing', d:'testing a group of related modules working together' },
  { n:'System testing', d:'testing the complete, integrated program against its requirements' },
  { n:'Black box testing', d:'testing against the specification without looking at the code inside' },
  { n:'White box testing', d:'testing with full knowledge of the internal code and its paths' },
  { n:'Grey box testing', d:'testing with partial knowledge of how the code works inside' }
];
function genTestDebug(){
  return termQ(TESTING, 'tst',
    r => 'Which term means <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── Mechatronics: hardware ────────────────────────────────────────────── */
const MECH_HW = [
  { n:'Microcontroller', d:'a small self-contained computer on a single chip, with processor, memory and I/O, built into a device' },
  { n:'CPU', d:'the processor that fetches, decodes and executes a program’s instructions' },
  { n:'Instruction set', d:'the complete set of machine instructions a particular processor understands' },
  { n:'Opcode', d:'the part of a machine instruction that says which operation to carry out' },
  { n:'Address register', d:'a register holding the memory location that an instruction refers to' },
  { n:'Data register', d:'a register holding a value the processor is currently working with' },
  { n:'Sensor', d:'an input component that measures something about the environment' },
  { n:'Motion sensor', d:'a sensor that detects movement nearby' },
  { n:'Light level sensor', d:'a sensor that measures how bright the surroundings are' },
  { n:'Actuator', d:'an output component that turns a control signal into physical movement' },
  { n:'Hydraulic actuator', d:'an actuator driven by pressurised fluid, giving large forces' },
  { n:'End effector', d:'the tool on the end of a robotic arm that acts on the object' },
  { n:'Robotic gripper', d:'an end effector that grasps and holds objects' }
];
function genMechHw(){
  return termQ(MECH_HW, 'mhw',
    r => 'Which component is <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── Mechatronics: control ─────────────────────────────────────────────── */
const MECH_CTL = [
  { n:'Open loop control', d:'control that acts without checking the result, so there is no feedback' },
  { n:'Closed loop control', d:'control that measures the result and feeds it back to correct the output' },
  { n:'Feedback', d:'measured output returned to the controller so it can adjust what it is doing' },
  { n:'Degrees of freedom', d:'the number of independent ways a mechanism is able to move' },
  { n:'Motion constraint', d:'a physical limit on how far or in what way a part may move' },
  { n:'Autonomous control', d:'a system that senses its situation and decides for itself, with no operator' },
  { n:'Diagnostic data', d:'data collected to show how the system is performing or where it is faulting' },
  { n:'Subsystem', d:'sensors, actuators and effectors combined to carry out one part of the overall job' },
  { n:'Wiring diagram', d:'a drawing showing how the components are connected for power and data' },
  { n:'Prototype', d:'an early working model built to test whether the design actually works' },
  { n:'Simulation', d:'a software model used to test control code without the physical hardware' },
  { n:'Unit test', d:'a repeatable test of one component’s control algorithm on its own' }
];
const MECH_EXTRA = [
  {q:'A thermostat that measures room temperature and switches the heater on or off is an example of…', a:'Closed loop control', w:['Open loop control','Autonomous navigation','Manual control']},
  {q:'A toaster that runs for a set time regardless of how brown the bread gets is…', a:'Open loop control', w:['Closed loop control','Feedback control','Adaptive control']},
  {q:'A robotic arm with three independent joints has how many degrees of freedom?', a:'Three', w:['One','Six','Zero']},
  {q:'Which of these is <b>not</b> usually a mechatronic system?', a:'A manual hand saw', w:['An industrial robot arm','A car’s anti-lock brakes','An automatic insulin pump']},
  {q:'When designing a mechatronic system for a person with disability, the main extra consideration is…', a:'The specific access needs of the intended user', w:['Making it as fast as possible','Reducing the number of sensors','Using the cheapest possible parts']}
];
function genMechControl(){
  if (Math.random() < 0.28) return bankQ(MECH_EXTRA, 'mecx');
  return termQ(MECH_CTL, 'mct',
    r => 'Which term means <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

function genPython(){
  const t = ri(0,4); let code, out, dis = [];
  if (t===0){ const a=ri(6,20), b=ri(2,6); const [op,val] = pk([['+',a+b],['-',a-b],['*',a*b],['//',Math.floor(a/b)],['%',a%b]]);
    code = 'a = '+a+'\nb = '+b+'\nprint(a '+op+' b)'; out = String(val);
    dis = [String(a+b),String(a-b),String(a*b),String(Math.floor(a/b)),String(a%b)]; }
  else if (t===1){ if (Math.random()<0.5){ const s=pk(['ab','xy','go','hi']), n=ri(2,4);
      code = 's = "'+s+'"\nprint(s * '+n+')'; out = s.repeat(n); dis = [s.repeat(n+1), s+' '+n, String(n)+s]; }
    else { const s=pk(['ba','na','lo']), u=pk(['ha','na','do']); code = 'print("'+s+'" + "'+u+'")'; out = s+u; dis = [s+' '+u, u+s, s+u+s]; } }
  else if (t===2){ const n=ri(4,7); let acc=0; for (let i=0;i<n;i++) acc+=i;
    code = 't = 0\nfor i in range('+n+'):\n    t += i\nprint(t)'; out = String(acc);
    dis = [String(acc+n), String(n*(n+1)/2), String(n)]; }
  else if (t===3){ const xs = Array.from({length:ri(3,5)},()=>ri(1,9)); const kind = pk(['len','sum','max','index']);
    const arr = '['+xs.join(', ')+']';
    if (kind==='len'){ code='xs = '+arr+'\nprint(len(xs))'; out=String(xs.length); dis=[String(xs.length+1),String(xs.reduce((a,b)=>a+b,0)),String(Math.max(...xs))]; }
    else if (kind==='sum'){ code='xs = '+arr+'\nprint(sum(xs))'; out=String(xs.reduce((a,b)=>a+b,0)); dis=[String(xs.length),String(Math.max(...xs)),String(xs.reduce((a,b)=>a+b,0)+1)]; }
    else if (kind==='max'){ code='xs = '+arr+'\nprint(max(xs))'; out=String(Math.max(...xs)); dis=[String(Math.min(...xs)),String(xs.length),String(xs.reduce((a,b)=>a+b,0))]; }
    else { const i=ri(0,xs.length-1); code='xs = '+arr+'\nprint(xs['+i+'])'; out=String(xs[i]); dis=xs.filter((_,j)=>j!==i).map(String).concat(String(i)); } }
  else { const x=ri(2,9), mby=ri(2,4); code = 'x = '+x+'\nprint(f"{x} x '+mby+' = {x * '+mby+'}")';
    out = x+' x '+mby+' = '+(x*mby); dis = [x+' x '+mby+' = '+(x+mby), 'x x '+mby+' = '+(x*mby), x+' x '+mby+' = {x * '+mby+'}']; }
  const m = mc(out, dis);
  return { q:'What does this print?<div class="rvcode">'+esc(code)+'</div>', choices:m.choices, answer:m.answer };
}
function genSuvat(){
  const u=ri(0,20), a=nzr(-5,5), t=ri(1,4)*2;   // even t keeps s a whole number
  if (Math.random()<0.5){ const v=u+a*t; const m=physMC(v,'m/s',[u+a*t+a, u+t, u-a*t]);
    return { q:'A body starts at <b>u = '+u+' m/s</b> and accelerates at <b>a = '+a+' m/s'+sup(2)+'</b>. Find v after <b>t = '+t+' s</b>.', clue:'v = u + at', choices:m.choices, answer:m.answer, note:'v = '+u+' + ('+a+')('+t+') = '+v+' m/s.' }; }
  const s=u*t + a*t*t/2; const m=physMC(s,'m',[u*t, u*t+a*t*t, s+t]);
  return { q:'A body starts at <b>u = '+u+' m/s</b> and accelerates at <b>a = '+a+' m/s'+sup(2)+'</b>. Find its displacement after <b>t = '+t+' s</b>.', clue:'s = ut + ½at²', choices:m.choices, answer:m.answer, note:'s = '+u+'·'+t+' + ½('+a+')('+t+'²) = '+s+' m.' };
}
function genWaves(){
  const kind=ri(0,2), f=ri(2,12), lam=ri(2,9), v=f*lam;
  if (kind===0){ const m=physMC(v,'m/s',[f+lam, v*2, Math.round(f/lam*100)/100]);
    return { q:'A wave has frequency <b>f = '+f+' Hz</b> and wavelength <b>λ = '+lam+' m</b>. Find its speed.', clue:'v = fλ', choices:m.choices, answer:m.answer, note:'v = '+f+' × '+lam+' = '+v+' m/s.' }; }
  if (kind===1){ const m=physMC(lam,'m',[v*f, v-f, Math.round(v/lam/lam*100)/100]);
    return { q:'A wave travels at <b>v = '+v+' m/s</b> with frequency <b>f = '+f+' Hz</b>. Find its wavelength.', clue:'λ = v / f', choices:m.choices, answer:m.answer, note:'λ = '+v+' / '+f+' = '+lam+' m.' }; }
  const T=Math.round(1/f*1000)/1000; const m=physMC(T,'s',[f, Math.round(f/2*1000)/1000, Math.round(2/f*1000)/1000]);
  return { q:'A wave has frequency <b>f = '+f+' Hz</b>. Find its period.', clue:'T = 1 / f', choices:m.choices, answer:m.answer, note:'T = 1 / '+f+' ≈ '+T+' s.' };
}
function genEnergy(){
  const kind=ri(0,3);
  if (kind===0){ const mass=ri(1,6)*2, v=ri(2,10), ke=0.5*mass*v*v; const m=physMC(ke,'J',[mass*v*v, 0.5*mass*v, mass*v]);
    return { q:'Find the kinetic energy of a <b>'+mass+' kg</b> object moving at <b>'+v+' m/s</b>.', clue:'KE = ½mv²', choices:m.choices, answer:m.answer, note:'KE = ½·'+mass+'·'+v+'² = '+ke+' J.' }; }
  if (kind===1){ const mass=ri(1,10), h=ri(1,12), pe=Math.round(mass*9.8*h*10)/10; const m=physMC(pe,'J',[mass*h, mass*h*10, Math.round(mass*9.8*10)/10]);
    return { q:'Find the gravitational PE of a <b>'+mass+' kg</b> mass raised <b>'+h+' m</b> (g = 9.8).', clue:'PE = mgh', choices:m.choices, answer:m.answer, note:'PE = '+mass+' × 9.8 × '+h+' = '+pe+' J.' }; }
  if (kind===2){ const F=ri(2,20), d=ri(2,12), w=F*d; const m=physMC(w,'J',[F+d, w/2, 2*w]);
    return { q:'A <b>'+F+' N</b> force moves an object <b>'+d+' m</b> in its direction. Find the work done.', clue:'W = Fd', choices:m.choices, answer:m.answer, note:'W = '+F+' × '+d+' = '+w+' J.' }; }
  const E=ri(2,10)*10, tt=ri(2,10), p=Math.round(E/tt*100)/100; const m=physMC(p,'W',[E*tt, E-tt, Math.round(tt/E*100)/100]);
  return { q:'<b>'+E+' J</b> is transferred in <b>'+tt+' s</b>. Find the power.', clue:'P = E / t', choices:m.choices, answer:m.answer, note:'P = '+E+' / '+tt+' = '+p+' W.' };
}
const OX_STATES = [
  ['Mn','KMnO₄',7],['Cr','K₂Cr₂O₇',6],['S','H₂SO₄',6],['S','SO₂',4],['N','HNO₃',5],['N','NH₃',-3],
  ['Cl','HCl',-1],['Cl','HClO',1],['Fe','Fe₂O₃',3],['Fe','FeCl₂',2],['C','CO₂',4],['C','CH₄',-4],
  ['P','H₃PO₄',5],['Mn','MnO₂',4],['Cu','CuSO₄',2],['Cr','Cr₂O₃',3],['S','H₂S',-2]
];
/* Full redox reactions, checked by hand. ox/red are [element, before, after];
   oa/ra are the oxidising and reducing agents as written in the equation;
   els is every element in it, which is where the wrong options come from. */
const REDOX_RX = [
  { eq:'Zn + Cu²⁺ → Zn²⁺ + Cu',           ox:['Zn',0,2],  red:['Cu',2,0],  oa:'Cu²⁺',    ra:'Zn',    els:['Zn','Cu'] },
  { eq:'Cu + 2Ag⁺ → Cu²⁺ + 2Ag',          ox:['Cu',0,2],  red:['Ag',1,0],  oa:'Ag⁺',     ra:'Cu',    els:['Cu','Ag'] },
  { eq:'Zn + CuSO₄ → ZnSO₄ + Cu',         ox:['Zn',0,2],  red:['Cu',2,0],  oa:'CuSO₄',   ra:'Zn',    els:['Zn','Cu','S','O'] },
  { eq:'Fe + CuSO₄ → FeSO₄ + Cu',         ox:['Fe',0,2],  red:['Cu',2,0],  oa:'CuSO₄',   ra:'Fe',    els:['Fe','Cu','S','O'] },
  { eq:'2Mg + O₂ → 2MgO',                 ox:['Mg',0,2],  red:['O',0,-2],  oa:'O₂',      ra:'Mg',    els:['Mg','O'] },
  { eq:'2Na + Cl₂ → 2NaCl',               ox:['Na',0,1],  red:['Cl',0,-1], oa:'Cl₂',     ra:'Na',    els:['Na','Cl'] },
  { eq:'Mg + 2HCl → MgCl₂ + H₂',          ox:['Mg',0,2],  red:['H',1,0],   oa:'HCl',     ra:'Mg',    els:['Mg','H','Cl'] },
  { eq:'Zn + 2HCl → ZnCl₂ + H₂',          ox:['Zn',0,2],  red:['H',1,0],   oa:'HCl',     ra:'Zn',    els:['Zn','H','Cl'] },
  { eq:'2Al + 3CuCl₂ → 2AlCl₃ + 3Cu',     ox:['Al',0,3],  red:['Cu',2,0],  oa:'CuCl₂',   ra:'Al',    els:['Al','Cu','Cl'] },
  { eq:'Fe₂O₃ + 3CO → 2Fe + 3CO₂',        ox:['C',2,4],   red:['Fe',3,0],  oa:'Fe₂O₃',   ra:'CO',    els:['Fe','O','C'] },
  { eq:'2Al + Fe₂O₃ → Al₂O₃ + 2Fe',       ox:['Al',0,3],  red:['Fe',3,0],  oa:'Fe₂O₃',   ra:'Al',    els:['Al','Fe','O'] },
  { eq:'CuO + H₂ → Cu + H₂O',             ox:['H',0,1],   red:['Cu',2,0],  oa:'CuO',     ra:'H₂',    els:['Cu','O','H'] },
  { eq:'Cl₂ + 2KBr → 2KCl + Br₂',         ox:['Br',-1,0], red:['Cl',0,-1], oa:'Cl₂',     ra:'KBr',   els:['Cl','K','Br'] },
  { eq:'Cl₂ + 2KI → 2KCl + I₂',           ox:['I',-1,0],  red:['Cl',0,-1], oa:'Cl₂',     ra:'KI',    els:['Cl','K','I'] },
  { eq:'Br₂ + 2I⁻ → 2Br⁻ + I₂',           ox:['I',-1,0],  red:['Br',0,-1], oa:'Br₂',     ra:'I⁻',    els:['Br','I'] },
  { eq:'Cl₂ + 2Fe²⁺ → 2Cl⁻ + 2Fe³⁺',      ox:['Fe',2,3],  red:['Cl',0,-1], oa:'Cl₂',     ra:'Fe²⁺',  els:['Cl','Fe'] },
  { eq:'2Fe³⁺ + Sn²⁺ → 2Fe²⁺ + Sn⁴⁺',     ox:['Sn',2,4],  red:['Fe',3,2],  oa:'Fe³⁺',    ra:'Sn²⁺',  els:['Fe','Sn'] },
  { eq:'C + O₂ → CO₂',                    ox:['C',0,4],   red:['O',0,-2],  oa:'O₂',      ra:'C',     els:['C','O'] },
  { eq:'2H₂ + O₂ → 2H₂O',                 ox:['H',0,1],   red:['O',0,-2],  oa:'O₂',      ra:'H₂',    els:['H','O'] },
  { eq:'CH₄ + 2O₂ → CO₂ + 2H₂O',           ox:['C',-4,4],  red:['O',0,-2],  oa:'O₂',      ra:'CH₄',   els:['C','H','O'] },
  { eq:'3CuO + 2NH₃ → 3Cu + N₂ + 3H₂O',   ox:['N',-3,0],  red:['Cu',2,0],  oa:'CuO',     ra:'NH₃',   els:['Cu','O','N','H'] },
  { eq:'MnO₂ + 4HCl → MnCl₂ + Cl₂ + 2H₂O', ox:['Cl',-1,0], red:['Mn',4,2],  oa:'MnO₂',    ra:'HCl',   els:['Mn','O','H','Cl'] }
];
/* nothing changes oxidation number in these */
const NOT_REDOX = ['HCl + NaOH → NaCl + H₂O', 'AgNO₃ + NaCl → AgCl + NaNO₃', 'CaCO₃ → CaO + CO₂',
  'BaCl₂ + Na₂SO₄ → BaSO₄ + 2NaCl', 'H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O', 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂',
  'NH₃ + HCl → NH₄Cl', 'Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃'];
/* half-equations, as { oxidised form, electrons, reduced form } */
const HALF_EQ = [
  { o:'Zn²⁺', n:2, r:'Zn' }, { o:'Cu²⁺', n:2, r:'Cu' }, { o:'Ag⁺', n:1, r:'Ag' }, { o:'Mg²⁺', n:2, r:'Mg' },
  { o:'Al³⁺', n:3, r:'Al' }, { o:'Pb²⁺', n:2, r:'Pb' }, { o:'Fe²⁺', n:2, r:'Fe' }, { o:'Fe³⁺', n:1, r:'Fe²⁺' },
  { o:'Sn⁴⁺', n:2, r:'Sn²⁺' }, { o:'Cl₂', n:2, r:'2Cl⁻' }, { o:'Br₂', n:2, r:'2Br⁻' }, { o:'I₂', n:2, r:'2I⁻' },
  { o:'2H⁺', n:2, r:'H₂' }, { o:'O₂ + 4H⁺', n:4, r:'2H₂O' }
];
const electrons = n => (n === 1 ? '' : n) + 'e⁻';
const asReduction = h => h.o + ' + ' + electrons(h.n) + ' → ' + h.r;
const asOxidation = h => h.r + ' → ' + h.o + ' + ' + electrons(h.n);
const oxNum = n => n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0';
function genRedox(){
  const k = Math.random();
  if (k < 0.2){ const [el,formula,ox] = pk(OX_STATES);
    return { q:'What is the oxidation state of <b>'+el+'</b> in <b>'+formula+'</b>?', input:true, answer:ox,
      accept:oxAccept(ox), note:el+' is '+(ox>0?'+':'')+ox+' in '+formula+'.', key:'ox:'+el+':'+formula }; }
  if (k < 0.3){
    let before = nzr(-3,5), after = nzr(-3,6); if (after===before) after = before+1;
    const rose = after > before;
    return { q:'An element’s oxidation number changes from <b>'+(before>0?'+':'')+before+'</b> to <b>'+(after>0?'+':'')+after+'</b>. Is it oxidised or reduced?',
      choices:['Oxidised','Reduced'], answer: rose?'Oxidised':'Reduced', note:'A rise in oxidation number (loss of electrons) is oxidation.' };
  }
  const r = pk(REDOX_RX);
  const why = '<b>' + r.ox[0] + '</b> goes from ' + oxNum(r.ox[1]) + ' to ' + oxNum(r.ox[2]) + ', so it loses electrons and is oxidised. <b>' +
    r.red[0] + '</b> goes from ' + oxNum(r.red[1]) + ' to ' + oxNum(r.red[2]) + ', so it gains electrons and is reduced.';
  /* which element is oxidised / reduced: the other half of the reaction is always one of the wrong options */
  if (k < 0.5){
    const wantOx = Math.random() < 0.5, right = wantOx ? r.ox[0] : r.red[0], other = wantOx ? r.red[0] : r.ox[0];
    const m = mc(right, [other].concat(shuffle(r.els.filter(e => e !== right && e !== other))));
    return { q:'In <b>' + r.eq + '</b>, which element is <b>' + (wantOx ? 'oxidised' : 'reduced') + '</b>?',
      choices:m.choices, answer:m.answer, note:why, key:'rx-' + (wantOx ? 'ox' : 'red') + ':' + r.eq };
  }
  /* oxidising / reducing agent: the agent is the reactant that makes the other change */
  if (k < 0.62){
    const wantOA = Math.random() < 0.5, right = wantOA ? r.oa : r.ra;
    const m = mc(right, [wantOA ? r.ra : r.oa]);
    return { q:'In <b>' + r.eq + '</b>, which is the <b>' + (wantOA ? 'oxidising' : 'reducing') + ' agent</b>?',
      choices:m.choices, answer:m.answer, key:'rx-' + (wantOA ? 'oa' : 'ra') + ':' + r.eq,
      note:why + ' The oxidising agent is the one that is reduced (' + r.oa + '); the reducing agent is the one that is oxidised (' + r.ra + ').' };
  }
  /* is it redox at all? */
  if (k < 0.74){
    if (Math.random() < 0.5){ const eq = pk(NOT_REDOX);
      return { q:'Is <b>' + eq + '</b> a redox reaction?', choices:['Yes','No'], answer:'No', key:'isredox:' + eq,
        note:'No element changes oxidation number, so nothing is oxidised or reduced.' }; }
    return { q:'Is <b>' + r.eq + '</b> a redox reaction?', choices:['Yes','No'], answer:'Yes', key:'isredox:' + r.eq, note:why };
  }
  /* half-equations */
  const [a, b] = shuffle(HALF_EQ.slice()).slice(0, 2);
  if (k < 0.87){
    const wantRed = Math.random() < 0.5;
    const right = wantRed ? asReduction(a) : asOxidation(a), wrong = wantRed ? asOxidation(b) : asReduction(b);
    return { q:'Which of these half-equations is ' + (wantRed ? 'a <b>reduction</b>' : 'an <b>oxidation</b>') + '?',
      choices:shuffle([right, wrong]), answer:right, key:'half-' + (wantRed ? 'red' : 'ox') + ':' + a.o + '|' + b.o,
      note:'Reduction gains electrons, so the electrons are on the left. Oxidation loses them, so they are on the right.' };
  }
  const isRed = Math.random() < 0.5, eq = isRed ? asReduction(a) : asOxidation(a);
  return { q:'Is <b>' + eq + '</b> an oxidation or a reduction?', choices:['Oxidation','Reduction'],
    answer:isRed ? 'Reduction' : 'Oxidation', key:'half-kind:' + eq,
    note:isRed ? 'Electrons are gained (on the left), so it is a reduction.' : 'Electrons are lost (on the right), so it is an oxidation.' };
}
const SOL_SOLUBLE = ['NaCl','KNO₃','Na₂SO₄','NH₄Cl','KOH','Na₂CO₃','KI','NH₄NO₃','NaOH','K₂SO₄','AgNO₃','Ca(NO₃)₂','Pb(NO₃)₂','Ba(NO₃)₂','(NH₄)₂SO₄','CH₃COONa'];
const SOL_INSOL   = ['AgCl','BaSO₄','CaCO₃','PbSO₄','Fe(OH)₃','Mg(OH)₂','CuS','PbI₂','Ag₂S','CaSO₄','FeS','ZnCO₃','PbCl₂','Cu(OH)₂'];
function genSol(){
  const soluble = Math.random()<0.5;
  const salt = soluble ? pk(SOL_SOLUBLE) : pk(SOL_INSOL);
  return { q:'Is <b>'+salt+'</b> soluble in water?', choices:['Soluble','Insoluble'], answer: soluble?'Soluble':'Insoluble',
    note:'SNAAP: salts of Sodium, Nitrate, Ammonium, Acetate and Potassium are soluble; most other carbonates, hydroxides, sulfides and these salts are not.', key:'sol:'+salt };
}

const rd = (x,d) => { const f = Math.pow(10,d||0); return Math.round(x*f)/f; };

/* ── diagrams ── */
/* ── Lewis dot diagrams ───────────────────────────────────────────────────
   Drawn the way a textbook does: symbols on a square grid, each shared pair as
   two dots between atoms (a double bond is two pairs, a triple three), and
   lone pairs as dots on the free sides. Lone pairs go opposite a bond first,
   except a pair of them on an end atom, which sit either side for balance.

   A molecule is { f, atoms:[[symbol, x, y]], bonds:[[a, b, order]], lp:[per atom] }.
   Half values draw a single dot, which is only ever used for a wrong option. */
const LEWIS_VALENCE = { H:1, B:3, C:4, N:5, O:6, F:7, P:5, S:6, Cl:7 };
const LEWIS = [
  { f:'Cl₂',  atoms:[['Cl',0,0],['Cl',1,0]], bonds:[[0,1,1]], lp:[3,3] },
  { f:'O₂',   atoms:[['O',0,0],['O',1,0]],   bonds:[[0,1,2]], lp:[2,2] },
  { f:'N₂',   atoms:[['N',0,0],['N',1,0]],   bonds:[[0,1,3]], lp:[1,1] },
  { f:'HCl',  atoms:[['H',0,0],['Cl',1,0]],  bonds:[[0,1,1]], lp:[0,3] },
  { f:'H₂O',  atoms:[['H',-1,0],['O',0,0],['H',0,1]], bonds:[[1,0,1],[1,2,1]], lp:[0,2,0] },
  { f:'NH₃',  atoms:[['N',0,0],['H',-1,0],['H',1,0],['H',0,1]], bonds:[[0,1,1],[0,2,1],[0,3,1]], lp:[1,0,0,0] },
  { f:'CH₄',  atoms:[['C',0,0],['H',-1,0],['H',1,0],['H',0,-1],['H',0,1]], bonds:[[0,1,1],[0,2,1],[0,3,1],[0,4,1]], lp:[0,0,0,0,0] },
  { f:'CO₂',  atoms:[['O',-1,0],['C',0,0],['O',1,0]], bonds:[[1,0,2],[1,2,2]], lp:[2,0,2] },
  { f:'HCN',  atoms:[['H',-1,0],['C',0,0],['N',1,0]], bonds:[[1,0,1],[1,2,3]], lp:[0,0,1] },
  { f:'CCl₄', atoms:[['C',0,0],['Cl',-1,0],['Cl',1,0],['Cl',0,-1],['Cl',0,1]], bonds:[[0,1,1],[0,2,1],[0,3,1],[0,4,1]], lp:[0,3,3,3,3] },
  { f:'PCl₃', atoms:[['P',0,0],['Cl',-1,0],['Cl',1,0],['Cl',0,1]], bonds:[[0,1,1],[0,2,1],[0,3,1]], lp:[1,3,3,3] },
  { f:'BF₃',  atoms:[['B',0,0],['F',-1,0],['F',1,0],['F',0,1]], bonds:[[0,1,1],[0,2,1],[0,3,1]], lp:[0,3,3,3] },
  { f:'HOCl', atoms:[['H',-1,0],['O',0,0],['Cl',1,0]], bonds:[[1,0,1],[1,2,1]], lp:[0,2,3] },
  { f:'H₂O₂', atoms:[['H',-1,0],['O',0,0],['O',1,0],['H',2,0]], bonds:[[1,0,1],[1,2,1],[2,3,1]], lp:[0,2,2,0] },
  { f:'CH₂O', atoms:[['C',0,0],['O',1,0],['H',0,-1],['H',0,1]], bonds:[[0,1,2],[0,2,1],[0,3,1]], lp:[0,2,0,0] },
  { f:'H₂S',  atoms:[['H',-1,0],['S',0,0],['H',0,1]], bonds:[[1,0,1],[1,2,1]], lp:[0,2,0] }
];
const LEWIS_BY = Object.fromEntries(LEWIS.map(m => [m.f, m]));

/* electrons in total, and around each atom (shared pairs count for both) */
function lewisCount(m){
  const around = m.atoms.map(() => 0);
  let total = 0;
  m.bonds.forEach(([a, b, o]) => { total += 2 * o; around[a] += 2 * o; around[b] += 2 * o; });
  m.lp.forEach((n, i) => { total += 2 * n; around[i] += 2 * n; });
  return { total, around, want:m.atoms.reduce((s, [el]) => s + LEWIS_VALENCE[el], 0) };
}
/* A structure that could be right: the right number of electrons, and every
   atom full (2 for H, 8 otherwise; boron may stop at 6). Any wrong option has
   to fail this, so an alternative drawing that is actually valid can never be
   offered as a wrong answer. */
function lewisValid(m){
  const { total, around, want } = lewisCount(m);
  if (total !== want) return false;
  return m.atoms.every(([el], i) => el === 'H' ? around[i] === 2 : el === 'B' ? around[i] === 6 || around[i] === 8 : around[i] === 8);
}
const LEWIS_SIDES = [[0,-1],[0,1],[-1,0],[1,0]];
function lewisSides(m, i){
  const [, x, y] = m.atoms[i];
  const used = m.bonds.filter(([a, b]) => a === i || b === i)
    .map(([a, b]) => { const j = a === i ? b : a, [, xj, yj] = m.atoms[j]; return [Math.sign(xj - x), Math.sign(yj - y)]; });
  const isUsed = s => used.some(u => u[0] === s[0] && u[1] === s[1]);
  const free = LEWIS_SIDES.filter(s => !isUsed(s));
  const n = Math.ceil(m.lp[i]);
  if (n === 2 && used.length === 1) return free.filter(s => s[0] * used[0][0] + s[1] * used[0][1] === 0);
  const opposite = s => used.some(u => u[0] === -s[0] && u[1] === -s[1]);
  return free.filter(opposite).concat(free.filter(s => !opposite(s))).slice(0, n);
}
const lewisDrawable = m => m.atoms.every((a, i) => {
  if (m.lp[i] < 0) return false;
  const dirs = new Set(m.bonds.filter(([p, q]) => p === i || q === i).map(([p, q]) => (p === i ? q : p)));
  return dirs.size + Math.ceil(m.lp[i]) <= 4;
});
function lewisSVG(m, width){
  const S = 58, pad = 26, xs = m.atoms.map(a => a[1]), ys = m.atoms.map(a => a[2]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const W = (Math.max(...xs) - minX) * S + pad * 2, H = (Math.max(...ys) - minY) * S + pad * 2;
  const px = i => (m.atoms[i][1] - minX) * S + pad, py = i => (m.atoms[i][2] - minY) * S + pad;
  const dot = (x, y) => '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4"/>';
  let dots = '';
  /* shared electrons: pairs spaced along the bond, each pair across it */
  m.bonds.forEach(([a, b, o]) => {
    const dx = Math.sign(px(b) - px(a)), dy = Math.sign(py(b) - py(a));
    const mx = (px(a) + px(b)) / 2, my = (py(a) + py(b)) / 2;
    const pairs = Math.floor(o), single = o % 1 !== 0, cols = pairs + (single ? 1 : 0);
    for (let k = 0; k < cols; k++){
      const t = (k - (cols - 1) / 2) * 7;
      const cx = mx + dx * t, cy = my + dy * t;
      if (k < pairs){ dots += dot(cx - dy * 4, cy + dx * 4) + dot(cx + dy * 4, cy - dx * 4); }
      else dots += dot(cx, cy);
    }
  });
  /* lone pairs, a little further out for two-letter symbols */
  m.atoms.forEach(([el], i) => {
    const sides = lewisSides(m, i), pairs = Math.floor(m.lp[i]), single = m.lp[i] % 1 !== 0;
    sides.forEach(([sx, sy], k) => {
      const reach = sx ? (el.length > 1 ? 19 : 14) : 15;
      const cx = px(i) + sx * reach, cy = py(i) + sy * reach;
      if (k < pairs) dots += dot(cx - sy * 4, cy + sx * 4) + dot(cx + sy * 4, cy - sx * 4);
      else if (single) dots += dot(cx, cy);
    });
  });
  const labels = m.atoms.map(([el], i) =>
    '<text x="' + px(i) + '" y="' + py(i) + '" text-anchor="middle" dominant-baseline="central">' + el + '</text>').join('');
  return '<svg class="rvdiagram rvlewis" viewBox="0 0 ' + W + ' ' + H + '" width="' + Math.min(width || 220, W * 1.25) +
    '" role="img" aria-label="Lewis dot diagram">' +
    '<g fill="var(--text)" font-size="19" font-weight="600" font-family="var(--font-ui)">' + labels + '</g>' +
    '<g fill="var(--text)">' + dots + '</g></svg>';
}

/* Wrong versions of a structure, one change each. The ones that keep the
   electron count right but leave an atom short or over are listed first,
   because they are the ones that actually make you count. */
function lewisWrong(m){
  /* `last` holds the more obvious slips on hydrogen, only used when a molecule
     has nothing better (methane: every bond is to H and carbon is full) */
  const subtle = [], plain = [], last = [];
  const H = i => m.atoms[i][0] === 'H', el = i => m.atoms[i][0];
  const copy = () => ({ f:m.f, atoms:m.atoms, bonds:m.bonds.map(b => b.slice()), lp:m.lp.slice() });
  /* `kind` names the mistake by what it does and to which elements, so the
     same slip mirrored onto an identical atom (left Cl vs right Cl) counts as
     one mistake and isn't offered twice */
  const add = (c, list, kind) => { if (lewisDrawable(c) && !lewisValid(c)){ c.kind = kind; list.push(c); } };
  m.bonds.forEach(([a, b, o], k) => {
    const pair = [el(a), el(b)].sort().join('-');
    if (!H(a) && !H(b)){
      [a, b].forEach(e => {
        if (o < 3 && m.lp[e] >= 1){ const c = copy(); c.bonds[k][2]++; c.lp[e]--; add(c, subtle, 'up:' + pair + ':' + el(e)); }   // extra bond, one lone pair fewer
        if (o > 1){ const c = copy(); c.bonds[k][2]--; c.lp[e]++; add(c, subtle, 'down:' + pair + ':' + el(e)); }                // bond demoted to a lone pair
      });
      if (o < 3){ const c = copy(); c.bonds[k][2]++; add(c, plain, 'up+:' + pair); }
      if (o > 1){ const c = copy(); c.bonds[k][2]--; add(c, plain, 'down-:' + pair); }
    } else if (o === 1){ const c = copy(); c.bonds[k][2]++; add(c, last, 'up+:' + pair); }               // a double bond to H
    const c = copy(); c.bonds[k][2] -= 0.5; add(c, plain, 'half:' + pair);                                                     // a "bond" of one electron
  });
  m.lp.forEach((n, i) => {
    if (H(i)){ const c = copy(); c.lp[i]++; add(c, last, 'lpH'); return; }                                 // H given a lone pair
    m.atoms.forEach((_, j) => { if (j !== i && !H(j) && n >= 1){ const c = copy(); c.lp[i]--; c.lp[j]++; add(c, subtle, 'move:' + el(i) + '>' + el(j)); } });
    if (n >= 1){ const c = copy(); c.lp[i]--; add(c, plain, 'lp-:' + el(i)); const d = copy(); d.lp[i] -= 0.5; add(d, plain, 'lp~:' + el(i)); }
    { const c = copy(); c.lp[i]++; add(c, plain, 'lp+:' + el(i)); }
  });
  const sig = c => JSON.stringify([c.bonds.map(b => b[2]), c.lp]);
  const seen = new Set([sig(m)]), kinds = new Set(), out = [];
  const take = (list, anyKind) => {
    for (const c of shuffle(list)){
      if (seen.has(sig(c)) || (!anyKind && kinds.has(c.kind))) continue;
      seen.add(sig(c)); kinds.add(c.kind); out.push(c); return true;
    }
    return false;
  };
  take(subtle); take(subtle);
  while (out.length < 3 && (take(plain) || take(subtle) || take(last)));
  while (out.length < 3 && (take(plain, true) || take(subtle, true) || take(last, true)));
  return out;
}
function lewisNote(m){
  const { total } = lewisCount(m);
  const bonding = m.bonds.reduce((s, b) => s + b[2], 0), lone = m.lp.reduce((s, n) => s + n, 0);
  const full = m.atoms.some(a => a[0] === 'B') ? 'Boron ends up with only 6, which it is allowed to do. Every other atom has 8.'
             : m.atoms.some(a => a[0] === 'H') ? 'Each H has 2 electrons around it and every other atom has 8.'
             : 'Every atom has 8 electrons around it.';
  return m.f + ' has ' + total + ' valence electrons: ' + bonding + ' shared pair' + (bonding === 1 ? '' : 's') +
    ' and ' + lone + ' lone pair' + (lone === 1 ? '' : 's') + '. ' + full;
}
function vectorSVG(a,b){
  return '<svg class="rvdiagram" viewBox="0 0 200 135" width="220" role="img" aria-label="vector diagram">'+
    '<defs><marker id="vah" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--muted)"/></marker></defs>'+
    '<line x1="34" y1="108" x2="160" y2="108" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#vah)"/>'+
    '<line x1="34" y1="108" x2="34" y2="24" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#vah)"/>'+
    '<line x1="34" y1="108" x2="160" y2="24" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#vah)"/>'+
    '<text x="92" y="126" fill="var(--muted)" font-size="12">'+a+' N</text>'+
    '<text x="4" y="70" fill="var(--muted)" font-size="12">'+b+' N</text>'+
    '<text x="104" y="60" fill="var(--muted)" font-size="12">R = ?</text></svg>';
}
/* ── schematic steel / cast-iron microstructures ──────────────────────────
   A microscope field of view drawn as a Voronoi grain tessellation, in the
   style of the Year 11 study guide. Convention: hatching = pearlite (each
   colony gets its own lamellae direction), solid fill = graphite. Grains are
   generated from a seeded PRNG so each kind always looks the same.          */
const mulberry32 = a => () => {
  a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
/* keep the half-plane of `poly` nearer seed s than seed t (Sutherland–Hodgman) */
function clipHalf(poly, nx, ny, c){
  const out = [], n = poly.length, f = p => nx*p[0] + ny*p[1] - c;
  for (let i=0;i<n;i++){
    const a = poly[i], b = poly[(i+1)%n], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)){
      const t = fa/(fa-fb);
      out.push([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])]);
    }
  }
  return out;
}
/* parallel lamellae lines across one cell, at `ang` degrees */
function hatchOf(poly, ang, gap){
  const rad = ang*Math.PI/180, dx = Math.cos(rad), dy = Math.sin(rad), nx = -dy, ny = dx;
  const on = poly.map(p=>p[0]*nx+p[1]*ny), od = poly.map(p=>p[0]*dx+p[1]*dy);
  const mn = Math.min(...on), mx = Math.max(...on), t0 = Math.min(...od)-1, t1 = Math.max(...od)+1;
  let out = '';
  for (let o = Math.ceil(mn/gap)*gap; o <= mx; o += gap)
    out += '<line x1="'+(o*nx+t0*dx).toFixed(1)+'" y1="'+(o*ny+t0*dy).toFixed(1)+
           '" x2="'+(o*nx+t1*dx).toFixed(1)+'" y2="'+(o*ny+t1*dy).toFixed(1)+'"/>';
  return out;
}
/* a thin curved graphite flake (lens shape) */
function flakeOf(x, y, ang, L, w){
  const rad = ang*Math.PI/180, dx = Math.cos(rad), dy = Math.sin(rad), nx = -dy, ny = dx;
  const ax = x-dx*L/2, ay = y-dy*L/2, bx = x+dx*L/2, by = y+dy*L/2;
  const f = (o)=>[(x+nx*o).toFixed(1), (y+ny*o).toFixed(1)];
  const m1 = f(w), m2 = f(-w*0.35);
  return '<path d="M'+ax.toFixed(1)+' '+ay.toFixed(1)+' Q'+m1[0]+' '+m1[1]+' '+bx.toFixed(1)+' '+by.toFixed(1)+
         ' Q'+m2[0]+' '+m2[1]+' '+ax.toFixed(1)+' '+ay.toFixed(1)+'Z"/>';
}
/* an irregular temper-carbon rosette */
function rosetteOf(x, y, rad, rnd){
  const pts = [];
  for (let i=0;i<9;i++){
    const a = i/9*Math.PI*2, rr = rad*(0.62+rnd()*0.55);
    pts.push((x+Math.cos(a)*rr).toFixed(1)+','+(y+Math.sin(a)*rr).toFixed(1));
  }
  return '<polygon points="'+pts.join(' ')+'"/>';
}
function microSVG(kind){
  const CFG = {
    low:       { seed: 7, hatch:0.25, over:null },
    med:       { seed:23, hatch:0.55, over:null },
    eutectoid: { seed:37, hatch:1,    over:null },
    high:      { seed:41, hatch:1,    over:'cementite' },
    grey:      { seed:53, hatch:1,    over:'flakes' },
    nodular:   { seed:67, hatch:1,    over:'nodules' },
    white:     { seed:79, hatch:0.45, over:null },
    malleable: { seed:89, hatch:0,    over:'rosettes' }
  }[kind] || { seed:7, hatch:0.3, over:null };
  const cx=100, cy=100, r=86, uid='m'+kind, rnd = mulberry32(CFG.seed);
  /* jittered grid of grain seeds, a little beyond the field so edge cells close */
  const pts = [];
  for (let x=cx-r-30; x<=cx+r+30; x+=40)
    for (let y=cy-r-30; y<=cy+r+30; y+=40){
      const px = x+(rnd()-0.5)*26, py = y+(rnd()-0.5)*26;
      if (Math.hypot(px-cx, py-cy) < r+28) pts.push([px,py]);
    }
  const box = [[cx-r-70,cy-r-70],[cx+r+70,cy-r-70],[cx+r+70,cy+r+70],[cx-r-70,cy+r+70]];
  const cells = pts.map((s,i) => {
    let poly = box.slice();
    for (let j=0;j<pts.length && poly.length;j++){
      if (j===i) continue;
      const t = pts[j];
      poly = clipHalf(poly, 2*(t[0]-s[0]), 2*(t[1]-s[1]),
                      t[0]*t[0]+t[1]*t[1]-s[0]*s[0]-s[1]*s[1]);
    }
    return poly;
  });
  const ptStr = p => p.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
  let defs = '<clipPath id="'+uid+'f"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'"/></clipPath>';
  let fills = '', hatches = '', strokes = '';
  cells.forEach((poly,i) => {
    if (poly.length < 3) return;
    const s = ptStr(poly);
    fills += '<polygon points="'+s+'" fill="var(--panel)"/>';
    strokes += '<polygon points="'+s+'"/>';
    if (rnd() < CFG.hatch){
      defs += '<clipPath id="'+uid+'c'+i+'"><polygon points="'+s+'"/></clipPath>';
      hatches += '<g clip-path="url(#'+uid+'c'+i+')">'+hatchOf(poly, rnd()*170, 4.6)+'</g>';
    }
  });
  /* overlays: graphite and the hypereutectoid cementite network */
  const scatter = (rMax, n, minDist) => {   // spaced sampling so features never clump
    const out = [];
    for (let t=0; t<n*80 && out.length<n; t++){
      const a = rnd()*Math.PI*2, d = Math.sqrt(rnd())*rMax;
      const p = [cx+Math.cos(a)*d, cy+Math.sin(a)*d];
      if (out.every(q => Math.hypot(q[0]-p[0], q[1]-p[1]) >= minDist)) out.push(p);
    }
    return out;
  };
  let over = '';
  if (CFG.over === 'cementite')
    over = '<g fill="none" stroke="var(--panel)" stroke-width="6.5">'+strokes+'</g>';
  else if (CFG.over === 'flakes')
    over = '<g fill="var(--text)">'+scatter(r-18, 11, 25)
      .map(p => flakeOf(p[0], p[1], rnd()*180, 20+rnd()*15, 2.6+rnd()*1.4)).join('')+'</g>';
  else if (CFG.over === 'nodules')
    over = '<g fill="var(--text)">'+scatter(r-22, 9, 30)
      .map(p => '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(5.5+rnd()*2).toFixed(1)+'"/>').join('')+'</g>';
  else if (CFG.over === 'rosettes')
    over = '<g fill="var(--text)">'+scatter(r-24, 7, 34)
      .map(p => rosetteOf(p[0], p[1], 7+rnd()*3, rnd)).join('')+'</g>';
  return '<svg class="rvdiagram" viewBox="0 0 200 200" width="228" role="img" aria-label="microstructure diagram">'
    + '<defs>'+defs+'</defs>'
    + '<g clip-path="url(#'+uid+'f)">'
    +   fills
    +   '<g stroke="var(--text)" stroke-width="0.9" opacity="0.5" fill="none">'+hatches+'</g>'
    +   over
    +   '<g fill="none" stroke="var(--text)" stroke-width="1.1" opacity="0.75">'+strokes+'</g>'
    + '</g>'
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--text)" stroke-width="1.6" opacity="0.85"/></svg>';
}

/* ══ CHEMISTRY ══ */
/* ── Naming compounds ─────────────────────────────────────────────────────
   Built from the rules rather than a list of answers, so every wrong option is
   a specific mistake someone actually makes, not a random other compound that
   anyone who knows the symbols could rule out. Wrong options come mostly from:
     convention  treating an ionic compound as covalent or the reverse
                 ("dialuminium trioxide", "nitrogen oxide", AlO for Al₂O₃)
     counts      the wrong number of atoms or the wrong charge
                 (Al₃O₂, iron(II) for Fe₂(SO₄)₃ because of the ₂)
   and less often from a similar ion (sulfate/sulfite/sulfide) or a similar-
   sounding element (potassium/phosphorus). Formula options are compared by what
   atoms they contain, so a wrong option can never be the right compound written
   differently. */
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const subN = n => n === 1 ? '' : String(n).split('').map(d => SUBD[+d]).join('');
const chargeSup = q => (Math.abs(q) === 1 ? '' : sup(Math.abs(q))) + (q > 0 ? '⁺' : '⁻');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const PREFIX = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta'];
const gcd2 = (a, b) => b ? gcd2(b, a % b) : Math.abs(a);
/* "mono" + "oxide" is "monoxide", "tetra" + "oxide" is "tetroxide" */
const withPrefix = (n, word) => { const p = PREFIX[n]; return /^o/.test(word) && /[ao]$/.test(p) ? p.slice(0, -1) + word : p + word; };

/* what a formula contains, e.g. Al₂(SO₄)₃ → {Al:2, O:12, S:3}, as a string to compare */
function composition(f){
  const s = String(f).replace(/[₀-₉]/g, c => SUBD.indexOf(c));
  let i = 0;
  const group = () => {
    const out = {};
    while (i < s.length && s[i] !== ')'){
      let part;
      if (s[i] === '('){ i++; part = group(); i++; }
      else { const m = /^[A-Z][a-z]?/.exec(s.slice(i)); if (!m) { i++; continue; } part = { [m[0]]: 1 }; i += m[0].length; }
      const n = /^\d+/.exec(s.slice(i)); const k = n ? +n[0] : 1; if (n) i += n[0].length;
      for (const e in part) out[e] = (out[e] || 0) + part[e] * k;
    }
    return out;
  };
  const c = group();
  return Object.keys(c).sort().map(e => e + c[e]).join(' ');
}

const CATIONS = {
  Li:{n:'lithium',s:'Li',q:1}, Na:{n:'sodium',s:'Na',q:1}, K:{n:'potassium',s:'K',q:1}, Ag:{n:'silver',s:'Ag',q:1},
  NH4:{n:'ammonium',s:'NH₄',q:1,poly:true},
  Mg:{n:'magnesium',s:'Mg',q:2}, Ca:{n:'calcium',s:'Ca',q:2}, Ba:{n:'barium',s:'Ba',q:2}, Zn:{n:'zinc',s:'Zn',q:2},
  Al:{n:'aluminium',s:'Al',q:3},
  Fe2:{n:'iron',s:'Fe',q:2,v:true}, Fe3:{n:'iron',s:'Fe',q:3,v:true},
  Cu1:{n:'copper',s:'Cu',q:1,v:true}, Cu2:{n:'copper',s:'Cu',q:2,v:true}, Pb:{n:'lead',s:'Pb',q:2,v:true}
};
const ANIONS = {
  F:{n:'fluoride',s:'F',q:-1}, Cl:{n:'chloride',s:'Cl',q:-1}, Br:{n:'bromide',s:'Br',q:-1}, I:{n:'iodide',s:'I',q:-1},
  O:{n:'oxide',s:'O',q:-2}, S:{n:'sulfide',s:'S',q:-2}, N:{n:'nitride',s:'N',q:-3}, P:{n:'phosphide',s:'P',q:-3},
  OH:{n:'hydroxide',s:'OH',q:-1,poly:true}, NO3:{n:'nitrate',s:'NO₃',q:-1,poly:true}, NO2:{n:'nitrite',s:'NO₂',q:-1,poly:true},
  HCO3:{n:'hydrogen carbonate',s:'HCO₃',q:-1,poly:true}, SO4:{n:'sulfate',s:'SO₄',q:-2,poly:true},
  SO3:{n:'sulfite',s:'SO₃',q:-2,poly:true}, CO3:{n:'carbonate',s:'CO₃',q:-2,poly:true}, PO4:{n:'phosphate',s:'PO₄',q:-3,poly:true}
};
/* anions that get mistaken for each other */
/* anions whose names get mixed up. Not the halides: chloride for bromide is a
   question of knowing symbols, which is taken as read here. */
const ANION_KIN = { SO4:['SO3','S'], SO3:['SO4','S'], S:['SO4','SO3'], NO3:['NO2','N'], NO2:['NO3','N'], N:['NO3','NO2'],
  CO3:['HCO3'], HCO3:['CO3'], OH:['O'], O:['OH'], PO4:['P'], P:['PO4'] };
/* similar-sounding elements, used sparingly: [name, symbol] it gets confused with */
const ELEMENT_KIN = { K:['phosphorus','P'], P:['potassium','K'], Na:['sulfur','S'], S:['sodium','Na'], Mg:['manganese','Mn'],
  Ag:['silicon','Si'], Si:['silver','Ag'], Cu:['cobalt','Co'], Ca:['carbon','C'], C:['calcium','Ca'], Ba:['boron','B'], B:['barium','Ba'] };

const IONIC = [['Na','Cl'],['Mg','O'],['Ca','F'],['Al','O'],['Na','SO4'],['NH4','Cl'],['Fe3','O'],['Cu2','SO4'],['K','CO3'],
  ['Ca','OH'],['Mg','NO3'],['K','I'],['Li','O'],['Mg','Cl'],['Al','Cl'],['Ca','S'],['Na','S'],['Mg','N'],['Li','N'],['Al','S'],
  ['Fe2','Cl'],['Fe3','Cl'],['Cu1','O'],['Cu2','O'],['Pb','NO3'],['Na','OH'],['Al','OH'],['Ba','SO4'],['Ca','CO3'],['Na','HCO3'],
  ['K','NO3'],['Na','NO2'],['K','SO3'],['Ca','PO4'],['NH4','SO4'],['NH4','PO4'],['Al','SO4'],['Fe3','SO4'],['Ag','NO3'],
  ['Zn','Cl'],['K','PO4'],['Ba','OH'],['Zn','O'],['Fe2','SO4'],['Ca','HCO3']];

const ELEMENTS = { C:['carbon','carbide'], N:['nitrogen','nitride'], O:['oxygen','oxide'], F:['fluorine','fluoride'],
  P:['phosphorus','phosphide'], S:['sulfur','sulfide'], Cl:['chlorine','chloride'], Si:['silicon','silicide'],
  B:['boron','boride'], I:['iodine','iodide'], Br:['bromine','bromide'] };
/* the combining number an element usually shows, for the "criss-cross it like
   an ionic compound" mistake on a covalent one */
const USUAL_VALENCY = { C:4, N:3, O:2, F:1, P:3, S:2, Cl:1, Si:4, B:3, I:1, Br:1 };
const COVALENT = [['C',1,'O',1],['C',1,'O',2],['S',1,'O',2],['S',1,'O',3],['N',1,'O',1],['N',1,'O',2],['N',2,'O',1],
  ['N',2,'O',3],['N',2,'O',4],['N',2,'O',5],['P',1,'Cl',3],['P',1,'Cl',5],['C',1,'Cl',4],['Si',1,'O',2],['S',1,'F',6],
  ['N',1,'F',3],['C',1,'S',2],['Si',1,'Cl',4],['B',1,'F',3],['P',2,'O',5],['O',1,'F',2],['Cl',2,'O',1],['S',1,'Cl',2],['I',1,'Cl',1]];

const ionPart = (ion, n) => n === 1 ? ion.s : ion.poly ? '(' + ion.s + ')' + subN(n) : ion.s + subN(n);
const ionicRatio = (cat, an) => { const g = gcd2(cat.q, -an.q); return [-an.q / g, cat.q / g]; };
const ionicFormula = (cat, an, nc, na) => { if (nc == null) [nc, na] = ionicRatio(cat, an); return ionPart(cat, nc) + ionPart(an, na); };
const cationName = (cat, q) => cat.v || q ? cat.n + '(' + ROMAN[q || cat.q] + ')' : cat.n;
const ionicName = (cat, an) => cationName(cat) + ' ' + an.n;
const covFormula = (a, na, b, nb) => a + subN(na) + b + subN(nb);
const covName = (a, na, b, nb) => (na > 1 ? PREFIX[na] : '') + ELEMENTS[a][0] + ' ' + withPrefix(nb, ELEMENTS[b][1]);

/* Choose three wrong options: mostly convention and counts, sometimes a
   similar ion, now and then a similar element. `same` says whether a candidate
   is really the right answer in disguise. */
function pickWrong(right, pools, same){
  const seen = [right], ok = x => x && !seen.some(s => same(s, x));
  const from = name => { const list = shuffle((pools[name] || []).slice()); for (const x of list) if (ok(x)){ seen.push(x); return x; } return null; };
  const out = [];
  const take = name => { const x = from(name); if (x) out.push(x); return x; };
  take('conv'); take('count');
  const r = Math.random();
  if (!(r < 0.3 && take('swap')) && !(r < 0.7 && take('ion'))) take('count') || take('conv');
  /* `spare` holds weaker mistakes, only reached when a simple compound has run
     out of better ones, so every question still gets four options */
  for (const name of ['count', 'conv', 'ion', 'swap', 'spare']) while (out.length < 3 && take(name));
  return out.slice(0, 3);
}
const sameName = (a, b) => a === b;
const sameFormula = (a, b) => a === b || composition(a) === composition(b);

function genChemName(){
  const covalent = Math.random() < 0.35, toFormula = Math.random() < 0.5;
  if (!covalent){
    const [ck, ak] = pk(IONIC), cat = CATIONS[ck], an = ANIONS[ak];
    const [nc, na] = ionicRatio(cat, an), f = ionicFormula(cat, an), name = ionicName(cat, an);
    const kin = (ANION_KIN[ak] || []).map(k => ANIONS[k]);
    const swap = ELEMENT_KIN[cat.s];
    const note = 'Ionic, so no prefixes: ' + cat.s + chargeSup(cat.q) + ' and ' + an.s + chargeSup(an.q) +
      (nc === 1 && na === 1 ? ' cancel one to one.' : ' balance as ' + nc + ' : ' + na + '.') +
      (cat.v ? ' The (' + ROMAN[cat.q] + ') is the charge on ' + cat.n + ', not how many there are.' : '');
    if (toFormula){
      const counts = [[na, nc], [1, 1], [nc, na + 1], [nc + 1, na]].filter(([x, y]) => gcd2(x, y) === 1)
        .map(([x, y]) => ionicFormula(cat, an, x, y));
      if (cat.v){                                          // built from the wrong charge
        const other = Object.values(CATIONS).find(c => c.s === cat.s && c.q !== cat.q);
        if (other) counts.push(ionicFormula(other, an));
      }
      const conv = [ionicFormula(cat, an, 1, 1)];          // no prefixes read as "one of each"
      if (ak === 'OH' && na > 1) conv.push(cat.s + subN(nc) + 'OH' + subN(na));   // brackets left off
      const ion = kin.map(k => ionicFormula(cat, k));
      if (ck === 'NH4') ion.push(ionPart({ s:'NH₃', poly:true }, nc) + ionPart(an, na));    // ammonia for ammonium
      const wrong = pickWrong(f, {
        conv, count:counts, ion,
        swap: swap ? [swap[1] + subN(nc) + ionPart(an, na)] : [],
        spare:[[nc, na + 2], [nc + 2, na]].filter(([x, y]) => gcd2(x, y) === 1).map(([x, y]) => ionicFormula(cat, an, x, y))
      }, sameFormula);
      const m = mc(f, wrong);
      return { q:'What is the formula of <b>' + name + '</b>?', choices:m.choices, answer:m.answer, note, key:'name-f:' + f };
    }
    const conv = [(nc > 1 ? PREFIX[nc] : '') + cat.n + ' ' + withPrefix(na, an.n)];   // named like a covalent one
    if (ELEMENTS[an.s]) conv.push(cationName(cat) + ' ' + ELEMENTS[an.s][0]);          // "chlorine" for chloride
    const counts = [];
    if (cat.v){
      conv.push(cat.n + ' ' + an.n);                                                 // the charge left out
      counts.push(cationName(cat, nc !== cat.q && nc <= 4 ? nc : cat.q === 2 ? 3 : 2) + ' ' + an.n);
    } else if (!cat.poly){
      /* a charge numeral on a metal that only has one charge, and the wrong one */
      [cat.q - 1, cat.q + 1].filter(q => q >= 1 && q <= 4).forEach(q => counts.push(cat.n + '(' + ROMAN[q] + ') ' + an.n));
    }
    counts.push((nc > 1 ? PREFIX[nc] : '') + cat.n + ' ' + an.n);
    const ion = kin.map(k => cationName(cat) + ' ' + k.n);
    if (ck === 'NH4') ion.push('ammonia ' + an.n);
    const wrong = pickWrong(name, {
      conv, count:counts, ion,
      swap: swap ? [swap[0] + ' ' + an.n] : [],
      spare:[cationName(cat) + ' ' + withPrefix(na + 1, an.n)]
    }, sameName);
    const m = mc(name, wrong);
    return { q:'What is the name of <b>' + f + '</b>?', choices:m.choices, answer:m.answer, note, key:'name-n:' + f };
  }
  const [a, na, b, nb] = pk(COVALENT), f = covFormula(a, na, b, nb), name = covName(a, na, b, nb);
  const note = 'Covalent, so the prefixes give the number of each atom' +
    (na === 1 ? ', and the first element never takes mono.' : '.');
  const inRange = ([x, y]) => x >= 1 && y >= 1 && x <= 7 && y <= 7 && !(x === na && y === nb);
  const shifts = [[na, nb + 1], [na, nb - 1], [na + 1, nb], [na - 1, nb], [nb, na]].filter(inRange);
  const spares = [[na, nb + 2], [na + 2, nb]].filter(inRange);
  const swap = ELEMENT_KIN[a];
  if (toFormula){
    const va = USUAL_VALENCY[a], vb = USUAL_VALENCY[b], g = gcd2(va, vb);
    const wrong = pickWrong(f, {
      conv:[covFormula(a, vb / g, b, va / g), covFormula(a, 1, b, 1)],              // criss-crossed, or one of each
      count:shifts.map(([x, y]) => covFormula(a, x, b, y)),
      swap: swap ? [covFormula(swap[1], na, b, nb)] : [],
      spare:spares.map(([x, y]) => covFormula(a, x, b, y))
    }, sameFormula);
    const m = mc(f, wrong);
    return { q:'What is the formula of <b>' + name + '</b>?', choices:m.choices, answer:m.answer, note, key:'name-f:' + f };
  }
  const conv = [ELEMENTS[a][0] + ' ' + ELEMENTS[b][1]];                            // named like an ionic one
  if (na === 1) conv.push('mono' + ELEMENTS[a][0] + ' ' + withPrefix(nb, ELEMENTS[b][1]));
  else conv.push(PREFIX[na] + ELEMENTS[a][0] + ' ' + ELEMENTS[b][1]);
  const wrong = pickWrong(name, {
    conv, count:shifts.map(([x, y]) => covName(a, x, b, y)),
    swap: swap ? [(na > 1 ? PREFIX[na] : '') + swap[0] + ' ' + withPrefix(nb, ELEMENTS[b][1])] : [],
    spare:spares.map(([x, y]) => covName(a, x, b, y))
  }, sameName);
  const m = mc(name, wrong);
  return { q:'What is the name of <b>' + f + '</b>?', choices:m.choices, answer:m.answer, note, key:'name-n:' + f };
}
function genChemIso(){ const m1=ri(10,60), m2=m1+ri(1,3), p=ri(20,80); const ram=rd((m1*p+m2*(100-p))/100,2);
  return {q:'An element has two isotopes: mass <b>'+m1+'</b> ('+p+'%) and mass <b>'+m2+'</b> ('+(100-p)+'%). Find the relative atomic mass.', input:true, answer:ram, accept:qty(ram,{tol:0.05,dim:'molarmass'}), note:'('+m1+'×'+p+' + '+m2+'×'+(100-p)+')/100 = '+ram+'.'}; }
const ECONFIG=[[1,'H','1s¹'],[2,'He','1s²'],[3,'Li','1s² 2s¹'],[4,'Be','1s² 2s²'],[5,'B','1s² 2s² 2p¹'],
  [6,'C','1s² 2s² 2p²'],[7,'N','1s² 2s² 2p³'],[8,'O','1s² 2s² 2p⁴'],[9,'F','1s² 2s² 2p⁵'],[10,'Ne','1s² 2s² 2p⁶'],
  [11,'Na','1s² 2s² 2p⁶ 3s¹'],[12,'Mg','1s² 2s² 2p⁶ 3s²'],[13,'Al','1s² 2s² 2p⁶ 3s² 3p¹'],[14,'Si','1s² 2s² 2p⁶ 3s² 3p²'],
  [15,'P','1s² 2s² 2p⁶ 3s² 3p³'],[16,'S','1s² 2s² 2p⁶ 3s² 3p⁴'],[17,'Cl','1s² 2s² 2p⁶ 3s² 3p⁵'],[18,'Ar','1s² 2s² 2p⁶ 3s² 3p⁶'],
  [19,'K','1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹'],[20,'Ca','1s² 2s² 2p⁶ 3s² 3p⁶ 4s²']];
function genChemEconfig(){ const [z,sym,cfg]=pk(ECONFIG); const m=mc(cfg, shuffle(ECONFIG.filter(e=>e[2]!==cfg)).map(e=>e[2]));
  return {q:'What is the ground-state electron configuration of <b>'+sym+'</b> (Z = '+z+')?', choices:m.choices, answer:m.answer, key:'econf:'+sym}; }
const VSEPR=[{f:'CH₄',shape:'Tetrahedral',polar:false,imf:'Dispersion'},{f:'NH₃',shape:'Trigonal pyramidal',polar:true,imf:'Hydrogen bonding'},
  {f:'H₂O',shape:'Bent',polar:true,imf:'Hydrogen bonding'},{f:'CO₂',shape:'Linear',polar:false,imf:'Dispersion'},
  {f:'BF₃',shape:'Trigonal planar',polar:false,imf:'Dispersion'},{f:'HCl',shape:'Linear',polar:true,imf:'Dipole–dipole'},
  {f:'CCl₄',shape:'Tetrahedral',polar:false,imf:'Dispersion'},{f:'PCl₃',shape:'Trigonal pyramidal',polar:true,imf:'Dipole–dipole'}];
function genChemShape(){ const v=pk(VSEPR), k=ri(0,2);
  /* the Lewis diagram rather than a picture of the shape: you work the shape
     out from the bonding pairs and lone pairs on the central atom */
  if(k===0){ const shapes=['Linear','Bent','Trigonal planar','Trigonal pyramidal','Tetrahedral']; const m=mc(v.shape, shuffle(shapes.filter(s=>s!==v.shape)));
    return {q:'Here is the Lewis dot diagram for <b>'+v.f+'</b>. What shape is the molecule?'+lewisSVG(LEWIS_BY[v.f]), choices:m.choices, answer:m.answer, key:'shape:'+v.f}; }
  if(k===1) return {q:'Is <b>'+v.f+'</b> a polar molecule?', choices:['Polar','Non-polar'], answer:v.polar?'Polar':'Non-polar', note:v.f+' is '+(v.polar?'polar':'non-polar')+' overall.', key:'polar:'+v.f};
  const imfs=['Dispersion','Dipole–dipole','Hydrogen bonding']; const m=mc(v.imf, imfs.filter(i=>i!==v.imf));
  return {q:'What is the strongest intermolecular force between <b>'+v.f+'</b> molecules?', choices:m.choices, answer:m.answer, key:'imf:'+v.f}; }
/* Pick the right Lewis diagram out of four. The options are pictures, so the
   choices are ids ('ok', 'w0'…) and `optHtml` holds what each one looks like. */
function genLewis(){
  const m = pk(LEWIS), wrong = lewisWrong(m);
  const optHtml = { ok:lewisSVG(m, 170) };
  wrong.forEach((w, i) => { optHtml['w' + i] = lewisSVG(w, 170); });
  return { q:'Which is the correct Lewis dot diagram for <b>' + m.f + '</b>?', choices:shuffle(Object.keys(optHtml)),
    answer:'ok', optHtml, note:lewisNote(m), key:'lewis:' + m.f };
}
const MR=[['H₂O',18.0],['CO₂',44.0],['NaCl',58.5],['CaCO₃',100.1],['H₂SO₄',98.1],['C₆H₁₂O₆',180.2],['NaOH',40.0],['NH₃',17.0],['O₂',32.0],['CH₄',16.0],['MgO',40.3],['KCl',74.6]];
function genChemMoles(){ const [f,mr]=pk(MR);
  if(Math.random()<0.5){ const mass=ri(2,20)*5, n=mass/mr; return {q:'How many moles are in <b>'+mass+' g</b> of '+f+'? (M = '+mr+' g/mol)', input:true, answer:rd(n,3), unit:'mol', accept:qty(n,{tol:0.01,dim:'amount'}), note:'n = m/M = '+mass+'/'+mr+' = '+rd(n,3)+' mol.'}; }
  const n=ri(1,10)/2, mass=n*mr; return {q:'What is the mass of <b>'+n+' mol</b> of '+f+'? (M = '+mr+' g/mol)', input:true, answer:rd(mass,2), unit:'g', accept:qty(mass,{tol:0.05,dim:'mass'}), note:'m = nM = '+n+'×'+mr+' = '+rd(mass,2)+' g.'}; }
const LIMRX=[{eq:'N₂ + 3H₂ → 2NH₃',A:['N₂',1],B:['H₂',3]},{eq:'2H₂ + O₂ → 2H₂O',A:['H₂',2],B:['O₂',1]},
  {eq:'C + O₂ → CO₂',A:['C',1],B:['O₂',1]},{eq:'2Mg + O₂ → 2MgO',A:['Mg',2],B:['O₂',1]},
  {eq:'2Al + 3Cl₂ → 2AlCl₃',A:['Al',2],B:['Cl₂',3]},{eq:'CH₄ + 2O₂ → CO₂ + 2H₂O',A:['CH₄',1],B:['O₂',2]},
  {eq:'4Fe + 3O₂ → 2Fe₂O₃',A:['Fe',4],B:['O₂',3]},{eq:'2Na + 2H₂O → 2NaOH + H₂',A:['Na',2],B:['H₂O',2]},
  {eq:'N₂ + O₂ → 2NO',A:['N₂',1],B:['O₂',1]},{eq:'Zn + 2HCl → ZnCl₂ + H₂',A:['Zn',1],B:['HCl',2]},
  {eq:'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂',A:['CaCO₃',1],B:['HCl',2]},
  {eq:'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O',A:['C₃H₈',1],B:['O₂',5]},{eq:'2Mg + CO₂ → 2MgO + C',A:['Mg',2],B:['CO₂',1]}];
function genChemLimiting(){ const r=pk(LIMRX), nA=ri(2,10), nB=ri(2,10), ra=nA/r.A[1], rb=nB/r.B[1];
  if(ra===rb) return genChemLimiting(); const lim=ra<rb?r.A[0]:r.B[0];
  return {q:'For <b>'+r.eq+'</b>, you have <b>'+nA+' mol '+r.A[0]+'</b> and <b>'+nB+' mol '+r.B[0]+'</b>. Which is the limiting reagent?', choices:[r.A[0],r.B[0]], answer:lim, note:'Compare mol ÷ coefficient: '+r.A[0]+' → '+rd(ra,2)+', '+r.B[0]+' → '+rd(rb,2)+'. Smaller limits.', key:'lim:'+r.eq}; }
/* ── Empirical formula ────────────────────────────────────────────────────
   Wrong options used to be the answers to other questions, so they usually
   contained different elements and gave the answer away. Now every option uses
   the elements in the question, and each wrong one is a real slip:
     no ÷ M      using the masses or percentages as if they were moles
     flipped     dividing molar mass by mass instead of the other way round
     rounded     rounding 2.5 or 1.33 instead of multiplying up (P₂O₅ → PO₃)
     not simple  a multiple of the right ratio, which isn't the empirical formula
     swapped / one off   the subscripts on the wrong elements, or one out
   The first 20 keep their old keys (emp:0…19), so practice history carries over. */
const ATOMIC_MASS = { H:1.008, C:12.01, N:14.01, O:16.00, Na:22.99, Mg:24.31, Al:26.98, P:30.97, S:32.07, Cl:35.45,
  K:39.10, Ca:40.08, Cr:52.00, Mn:54.94, Fe:55.85, Cu:63.55 };
const ELEMENT_NAME = { H:'hydrogen', C:'carbon', N:'nitrogen', O:'oxygen', Na:'sodium', Mg:'magnesium', Al:'aluminium',
  P:'phosphorus', S:'sulfur', Cl:'chlorine', K:'potassium', Ca:'calcium', Cr:'chromium', Mn:'manganese', Fe:'iron', Cu:'copper' };
const EMP_LEGACY = [
  ['CH₂O','%',[40,6.7,53.3]], ['C₂H₆O','%',[52.2,13.0,34.8]], ['CH₃','g',[2.4,0.6]], ['CO₂','%',[27.3,72.7]], ['CH₄','%',[75,25]],
  ['CH','%',[92.3,7.7]], ['CH₂','%',[85.7,14.3]], ['CH₃','%',[80,20]], ['SO₃','%',[40,60]], ['SO₂','%',[50,50]],
  ['CO₂','g',[1.2,3.2]], ['P₂O₅','%',[43.7,56.3]], ['N₂O','%',[63.6,36.4]], ['NO','%',[46.7,53.3]], ['NO₂','%',[30.4,69.6]],
  ['Al₂O₃','%',[52.9,47.1]], ['Na₂O','%',[74.2,25.8]], ['CaCl₂','%',[36.1,63.9]], ['NaCl','%',[39.3,60.7]], ['MgO','%',[60.3,39.7]]
];
const EMP_MORE = ['C₂H₄O','CH₄O','C₃H₈','C₂H₅','C₃H₄O₃','CO','N₂O₅','Fe₂O₃','Fe₃O₄','K₂O','MgCl₂','CuO','Cu₂O',
  'Na₂SO₄','CaCO₃','Na₂CO₃','C₂H₃Cl','K₂Cr₂O₇'];
/* 'Na₂SO₄' → [['Na',2],['S',1],['O',4]], keeping the written order */
function orderedElements(f){
  const s = String(f).replace(/[₀-₉]/g, c => SUBD.indexOf(c)), out = [];
  for (const m of s.matchAll(/([A-Z][a-z]?)(\d*)/g)) out.push([m[1], m[2] ? +m[2] : 1]);
  return out;
}
const empFormula = (syms, counts) => syms.map((el, i) => el + subN(counts[i])).join('');
/* a ratio of amounts → the smallest whole numbers, if a multiplier up to 6 gets there */
function wholeRatio(amounts, tol){
  const min = Math.min(...amounts), r = amounts.map(a => a / min);
  for (let k = 1; k <= 6; k++) if (r.every(x => Math.abs(x * k - Math.round(x * k)) < (tol || 0.1))) return r.map(x => Math.round(x * k));
  return null;
}
function genChemEmp(){
  let f, unit, values, key;
  if (Math.random() < 0.5){
    const ix = (Math.random() * EMP_LEGACY.length) | 0;
    [f, unit, values] = EMP_LEGACY[ix]; key = 'emp:' + ix;
  } else {
    f = pk(EMP_MORE); unit = Math.random() < 0.65 ? '%' : 'g';
    const els = orderedElements(f), masses = els.map(([el, n]) => n * ATOMIC_MASS[el]), total = masses.reduce((a, b) => a + b, 0);
    /* the numbers shown are rounded, so check the question can still be solved
       from them: a small sample rounded to 0.01 g can blur hydrogen too much */
    const solvable = vals => { const r = wholeRatio(vals.map((v, i) => v / ATOMIC_MASS[els[i][0]])); return !!r && r.every((n, i) => n === els[i][1]); };
    if (unit === '%') values = masses.map(m => +(m / total * 100).toFixed(1));
    else {
      for (const sample of shuffle([2.5, 3, 4, 5, 6, 8, 10])){
        values = masses.map(m => +(m * sample / total).toFixed(2));
        if (solvable(values)) break;
      }
    }
    if (!solvable(values)){ unit = '%'; values = masses.map(m => +(m / total * 100).toFixed(2)); }
    key = 'emp:' + f + ':' + unit;
  }
  const els = orderedElements(f), syms = els.map(e => e[0]), right = els.map(e => e[1]);
  const moles = values.map((v, i) => v / ATOMIC_MASS[syms[i]]);
  const exact = right.map(n => n / Math.min(...right));

  const wrong = [];
  const push = (counts, why) => { if (counts && counts.every(n => n >= 1 && n <= 9)) wrong.push([empFormula(syms, counts), why]); };
  /* where a slip would lead, kept to something a person might actually write
     down: small multipliers only, otherwise just the rounded ratio */
  const slip = amounts => {
    const min = Math.min(...amounts), r = amounts.map(a => a / min);
    for (let k = 1; k <= 3; k++) if (r.every(x => Math.abs(x * k - Math.round(x * k)) < 0.12)) return r.map(x => Math.round(x * k));
    return r.map(x => Math.max(1, Math.round(x)));
  };
  push(slip(values), 'no-divide');
  push(slip(syms.map((el, i) => ATOMIC_MASS[el] / values[i])), 'flipped');
  if (exact.some(x => Math.abs(x - Math.round(x)) > 0.05)){
    push(exact.map(x => Math.round(x) || 1), 'rounded');
    push(exact.map(x => Math.floor(x) || 1), 'rounded');
  }
  const simple = [];
  simple.push([empFormula(syms, right.map(n => n * 2)), 'multiple']);
  if (syms.length > 1){
    const i = (Math.random() * syms.length) | 0, j = (i + 1 + ((Math.random() * (syms.length - 1)) | 0)) % syms.length;
    const sw = right.slice(); [sw[i], sw[j]] = [sw[j], sw[i]];
    if (sw[i] !== sw[j]) simple.push([empFormula(syms, sw), 'swap']);
  }
  syms.forEach((_, i) => { const c = right.slice(); c[i]++; simple.push([empFormula(syms, c), 'one-off']); });
  syms.forEach((_, i) => { const c = right.slice(); if (c[i] > 1){ c[i]--; simple.push([empFormula(syms, c), 'one-off']); } });

  /* the real slips first, then the rest; never two options that are the same compound */
  const chosen = [], seen = [composition(f)];
  const take = ([opt]) => { const c = composition(opt); if (seen.includes(c) || chosen.length >= 3) return; seen.push(c); chosen.push(opt); };
  shuffle(wrong).forEach(take);
  shuffle(simple.filter(s => s[1] !== 'multiple')).slice(0, 1).forEach(take);
  if (chosen.length < 3) take(simple.find(s => s[1] === 'multiple'));
  shuffle(simple).forEach(take);
  const m = mc(f, chosen);

  const given = syms.map((el, i) => unit === '%' ? values[i] + '% ' + el : values[i] + ' g of ' + ELEMENT_NAME[el]);
  const list = given.length === 2 ? given.join(' and ') : given.slice(0, -1).join(', ') + ' and ' + given[given.length - 1];
  const q = unit === '%'
    ? 'A compound is ' + list + ' by mass. What is its empirical formula?'
    : 'A sample of a compound contains ' + list + '. What is its empirical formula?';
  const ratio = moles.map(n => n / Math.min(...moles));
  const note = 'Moles of each: ' + syms.map((el, i) => el + ' ' + values[i] + ' ÷ ' + ATOMIC_MASS[el] + ' = ' + rd(moles[i], 3)).join(', ') +
    '. Divide by the smallest: ' + ratio.map(x => rd(x, 2)).join(' : ') +
    (ratio.some(x => Math.abs(x - Math.round(x)) > 0.1) ? ', then multiply up to whole numbers: ' + right.join(' : ') : '') + ', so ' + f + '.';
  return { q, choices:m.choices, answer:m.answer, note, key };
}
function genChemSol2(){ const k=ri(0,2);
  if(k===0){ const n=ri(1,10)/2, V=ri(1,5)*0.5, c=n/V; return {q:'Find the concentration of a solution containing <b>'+n+' mol</b> in <b>'+V+' L</b>.', input:true, answer:rd(c,2), unit:'mol/L', accept:qty(c,{tol:0.02,dim:'conc'}), note:'c = n/V = '+n+'/'+V+' = '+rd(c,2)+' mol/L.'}; }
  if(k===1){ const c1=ri(1,4), v1=ri(1,5)*10, v2=v1*ri(2,4), c2=c1*v1/v2; return {q:'<b>'+v1+' mL</b> of <b>'+c1+' mol/L</b> solution is diluted to <b>'+v2+' mL</b>. Find the new concentration.', input:true, answer:rd(c2,3), unit:'mol/L', accept:qty(c2,{tol:0.01,dim:'conc'}), note:'c₁V₁ = c₂V₂ → '+rd(c2,3)+' mol/L.'}; }
  const n=ri(1,5)/2, vol=rd(n*24.79,2); return {q:'What volume does <b>'+n+' mol</b> of gas occupy at 25 °C and 100 kPa? (molar volume 24.79 L/mol)', input:true, answer:vol, unit:'L', accept:qty(vol,{tol:0.1,dim:'volume'}), note:'V = n × 24.79 = '+vol+' L.'}; }
const RXNTYPE=[['2H₂ + O₂ → 2H₂O','Synthesis'],['CaCO₃ → CaO + CO₂','Decomposition'],
  ['Zn + CuSO₄ → ZnSO₄ + Cu','Displacement'],['CH₄ + 2O₂ → CO₂ + 2H₂O','Combustion'],
  ['HCl + NaOH → NaCl + H₂O','Neutralisation'],['2Na + Cl₂ → 2NaCl','Synthesis'],
  ['AgNO₃ + NaCl → AgCl + NaNO₃','Precipitation'],['2KClO₃ → 2KCl + 3O₂','Decomposition'],
  ['Mg + 2HCl → MgCl₂ + H₂','Displacement'],['C₃H₈ + 5O₂ → 3CO₂ + 4H₂O','Combustion'],
  ['H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O','Neutralisation'],['Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃','Precipitation'],
  ['2H₂O₂ → 2H₂O + O₂','Decomposition'],['Fe + CuSO₄ → FeSO₄ + Cu','Displacement'],
  ['N₂ + 3H₂ → 2NH₃','Synthesis'],['BaCl₂ + Na₂SO₄ → BaSO₄ + 2NaCl','Precipitation'],
  ['2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O','Combustion'],['Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag','Displacement'],
  ['HNO₃ + KOH → KNO₃ + H₂O','Neutralisation'],['S + O₂ → SO₂','Synthesis']];
function genChemType(){ const [eq,t]=pk(RXNTYPE); const types=['Synthesis','Decomposition','Displacement','Combustion','Neutralisation','Precipitation']; const m=mc(t, shuffle(types.filter(x=>x!==t))); return {q:'Classify this reaction: <b>'+eq+'</b>', choices:m.choices, answer:m.answer, key:'rxntype:'+eq}; }
/* [couple, E° in volts, charge on the ion]. Al and Ni use the NSW data sheet values. */
const SRP=[['Zn²⁺/Zn',-0.76,2],['Cu²⁺/Cu',0.34,2],['Ag⁺/Ag',0.80,1],['Fe²⁺/Fe',-0.44,2],['Mg²⁺/Mg',-2.37,2],['Pb²⁺/Pb',-0.13,2],
  ['Al³⁺/Al',-1.68,3],['Ni²⁺/Ni',-0.24,2]];
function genGalvanic(){ let a=pk(SRP), b=pk(SRP); while(b[0]===a[0]) b=pk(SRP); const [hi,lo]=a[1]>b[1]?[a,b]:[b,a]; const emf=rd(hi[1]-lo[1],2);
  const pair=[a[0],b[0]].sort().join('|');
  const ev = x => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2);   // as the data sheet prints E°
  const k = Math.random();
  if(k<0.25) return {q:'A galvanic cell is built from '+a[0]+' (E° = '+ev(a[1])+' V) and '+b[0]+' (E° = '+ev(b[1])+' V). Find the cell potential.', input:true, answer:emf, unit:'V', accept:qty(emf,{tol:0.01,dim:'voltage'}), note:'E°cell = E°cathode − E°anode = '+ev(hi[1])+' − ('+ev(lo[1])+') = '+emf.toFixed(2)+' V.', key:'galv-emf:'+pair};
  const anode=lo[0].split('/')[1];
  if(k<0.37) return {q:'In a cell of '+a[0]+' (E° = '+ev(a[1])+' V) and '+b[0]+' (E° = '+ev(b[1])+' V), which metal is the <b>anode</b>?', choices:[hi[0].split('/')[1],anode], answer:anode, note:'The more negative E° ('+lo[0]+') is oxidised, so it is the anode.', key:'galv-anode:'+pair};
  /* everything else about the same cell, worked out from which couple has the higher E° */
  const cathode = hi[0].split('/')[1], anIon = lo[0].split('/')[0], caIon = hi[0].split('/')[0];
  const setup = 'A galvanic cell is made from ' + a[0] + ' (E° = ' + ev(a[1]) + ' V) and ' + b[0] + ' (E° = ' + ev(b[1]) + ' V).';
  const base = 'The higher E° (' + hi[0] + ') is reduced at the cathode; ' + anode + ' is oxidised at the anode.';
  const two = (q, right, wrong, id, note) => ({ q:setup + ' ' + q, choices:shuffle([right, wrong]), answer:right, note:base + (note ? ' ' + note : ''), key:'galv-' + id + ':' + pair });
  const redHalf = { o:caIon, n:hi[2], r:cathode }, oxHalf = { o:anIon, n:lo[2], r:anode };
  const kind = pk(['cathode','where','where','species','species','half','half','electrons','mass','positive','bridge','overall','overall']);
  if (kind === 'cathode') return two('Which metal is the <b>cathode</b>?', cathode, anode, 'cathode');
  if (kind === 'where'){ const red = Math.random() < 0.5;
    return two('At which electrode does <b>' + (red ? 'reduction' : 'oxidation') + '</b> happen?',
      (red ? cathode : anode) + ' electrode', (red ? anode : cathode) + ' electrode', red ? 'redat' : 'oxat',
      'Oxidation is always at the anode and reduction at the cathode.'); }
  if (kind === 'species'){ const red = Math.random() < 0.5, right = red ? caIon : anode;
    const m = mc(right, red ? [anIon, cathode, anode] : [anIon, cathode, caIon]);
    return { q:setup + ' Which species is <b>' + (red ? 'reduced' : 'oxidised') + '</b>?', choices:m.choices, answer:m.answer,
      note:base + ' So ' + (red ? caIon + ' ions gain electrons to become ' + cathode + ' metal.' : anode + ' atoms lose electrons to become ' + anIon + ' ions.'),
      key:'galv-' + (red ? 'redsp' : 'oxsp') + ':' + pair }; }
  if (kind === 'half'){ const atCathode = Math.random() < 0.5, right = atCathode ? asReduction(redHalf) : asOxidation(oxHalf);
    const m = mc(right, shuffle([asReduction(redHalf), asOxidation(redHalf), asReduction(oxHalf), asOxidation(oxHalf)]));
    return { q:setup + ' Which half-equation happens at the <b>' + (atCathode ? 'cathode' : 'anode') + '</b>?', choices:m.choices, answer:m.answer,
      note:base + ' Cathode: ' + asReduction(redHalf) + '. Anode: ' + asOxidation(oxHalf) + '.', key:'galv-' + (atCathode ? 'cahalf' : 'anhalf') + ':' + pair }; }
  if (kind === 'electrons') return two('Which way do electrons flow through the external wire?', 'From ' + anode + ' to ' + cathode, 'From ' + cathode + ' to ' + anode, 'eflow',
    'Electrons are released by the oxidation at the anode and flow through the wire to the cathode.');
  if (kind === 'mass'){ const gain = Math.random() < 0.5;
    return two('Which electrode <b>' + (gain ? 'gains' : 'loses') + ' mass</b> as the cell runs?', gain ? cathode : anode, gain ? anode : cathode, gain ? 'gain' : 'lose',
      'The anode dissolves as ' + anode + ' becomes ' + anIon + ' ions; ' + cathode + ' metal is deposited on the cathode.'); }
  if (kind === 'positive') return two('Which electrode is <b>positive</b>?', cathode, anode, 'positive',
    'In a galvanic cell the cathode is positive: electrons arrive there and are used up by the reduction.');
  if (kind === 'bridge'){ const anions = Math.random() < 0.5;
    return two('In the salt bridge, which half-cell do the <b>' + (anions ? 'anions' : 'cations') + '</b> move towards?',
      'The ' + (anions ? anode : cathode) + ' half-cell', 'The ' + (anions ? cathode : anode) + ' half-cell', anions ? 'anions' : 'cations',
      'Anions move towards the anode, where positive ions are being made; cations move towards the cathode, where positive ions are being used up.'); }
  /* the overall equation, balanced for electrons */
  const L = lo[2] * hi[2] / gcd2(lo[2], hi[2]), cm = L / lo[2], cn = L / hi[2], co = c => c === 1 ? '' : String(c);
  const right = co(cm) + anode + ' + ' + co(cn) + caIon + ' → ' + co(cm) + anIon + ' + ' + co(cn) + cathode;
  const m = mc(right, shuffle([
    co(cn) + cathode + ' + ' + co(cm) + anIon + ' → ' + co(cn) + caIon + ' + ' + co(cm) + anode,     // runs backwards
    anode + ' + ' + caIon + ' → ' + anIon + ' + ' + cathode,                                        // electrons not balanced (when charges differ)
    co(cn) + anode + ' + ' + co(cm) + caIon + ' → ' + co(cn) + anIon + ' + ' + co(cm) + cathode,     // coefficients swapped
    anode + ' + ' + cathode + ' → ' + anIon + ' + ' + caIon,                                        // both oxidised
    anIon + ' + ' + caIon + ' → ' + anode + ' + ' + cathode                                         // both reduced
  ]));
  return { q:setup + ' Which is the balanced overall equation for the cell?', choices:m.choices, answer:m.answer, key:'galv-overall:' + pair,
    note:base + ' Balance the electrons: ' + (cm === 1 ? '' : cm + ' × ') + '(' + asOxidation(oxHalf) + ') and ' + (cn === 1 ? '' : cn + ' × ') + '(' + asReduction(redHalf) + ').' }; }
function genCalor(){ const m=ri(50,300), dT=ri(5,40), q=rd(m*4.18*dT/1000,2); return {q:'How much heat (kJ) warms <b>'+m+' g</b> of water by <b>'+dT+' °C</b>? (c = 4.18 J/g·°C)', input:true, answer:q, unit:'kJ', accept:qty(q,{tol:0.1,dim:'energy'}), note:'q = mcΔT = '+m+'×4.18×'+dT+' = '+(m*4.18*dT)+' J = '+q+' kJ.'}; }
const BONDRX=[{eq:'H₂ + Cl₂ → 2HCl',broken:[['H–H',436],['Cl–Cl',242]],formed:[['H–Cl',431,2]]},
  {eq:'H₂ + Br₂ → 2HBr',broken:[['H–H',436],['Br–Br',193]],formed:[['H–Br',366,2]]},
  {eq:'N₂ + 3H₂ → 2NH₃',broken:[['N≡N',945],['H–H',436,3]],formed:[['N–H',391,6]]},
  {eq:'H₂ + F₂ → 2HF',broken:[['H–H',436],['F–F',158]],formed:[['H–F',565,2]]},
  {eq:'CH₄ + Cl₂ → CH₃Cl + HCl',broken:[['C–H',413],['Cl–Cl',242]],formed:[['C–Cl',328],['H–Cl',431]]},
  {eq:'2HI → H₂ + I₂',broken:[['H–I',298,2]],formed:[['H–H',436],['I–I',151]]},
  {eq:'C₂H₄ + H₂ → C₂H₆',broken:[['C=C',614],['H–H',436]],formed:[['C–C',348],['C–H',413,2]]},
  {eq:'2H₂ + O₂ → 2H₂O',broken:[['H–H',436,2],['O=O',498]],formed:[['O–H',463,4]]}];
function genBondE(){ const r=pk(BONDRX); const sum=arr=>arr.reduce((s,x)=>s+x[1]*(x[2]||1),0); const dH=sum(r.broken)-sum(r.formed);
  const tbl=[...r.broken,...r.formed].map(x=>x[0]+' = '+x[1]).join(', ');
  return {q:'For <b>'+r.eq+'</b>, bond energies (kJ/mol): '+tbl+'. Find ΔH.', input:true, answer:dH, unit:'kJ/mol', accept:qty(dH,{tol:1,dim:'energy'}), note:'ΔH = Σ(bonds broken) − Σ(bonds formed) = '+sum(r.broken)+' − '+sum(r.formed)+' = '+dH+' kJ/mol.'}; }
const FORMRX=[{eq:'CH₄ + 2O₂ → CO₂ + 2H₂O',t:[['CO₂',-394,1],['H₂O',-286,2],['CH₄',-75,-1],['O₂',0,-2]]},
  {eq:'2H₂ + O₂ → 2H₂O',t:[['H₂O',-286,2],['H₂',0,-2],['O₂',0,-1]]},
  {eq:'C + O₂ → CO₂',t:[['CO₂',-394,1],['C',0,-1],['O₂',0,-1]]},
  {eq:'2CO + O₂ → 2CO₂',t:[['CO₂',-394,2],['CO',-111,-2],['O₂',0,-1]]},
  {eq:'CaCO₃ → CaO + CO₂',t:[['CaO',-635,1],['CO₂',-394,1],['CaCO₃',-1207,-1]]},
  {eq:'2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O',t:[['CO₂',-394,4],['H₂O',-286,6],['C₂H₆',-84,-2],['O₂',0,-7]]},
  {eq:'N₂ + 3H₂ → 2NH₃',t:[['NH₃',-46,2],['N₂',0,-1],['H₂',0,-3]]},
  {eq:'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O',t:[['CO₂',-394,3],['H₂O',-286,4],['C₃H₈',-104,-1],['O₂',0,-5]]}];
function genFormation(){ const r=pk(FORMRX); const dH=r.t.reduce((s,x)=>s+x[1]*x[2],0); const given=r.t.filter(x=>x[1]!==0).map(x=>'ΔHf('+x[0]+') = '+x[1]).join(', ');
  return {q:'Using standard enthalpies of formation (kJ/mol): '+given+', find ΔH for <b>'+r.eq+'</b>.', input:true, answer:dH, unit:'kJ/mol', accept:qty(dH,{tol:1,dim:'energy'}), note:'ΔH = ΣΔHf(products) − ΣΔHf(reactants) = '+dH+' kJ/mol.'}; }
function genGibbs(){ const dH=ri(-100,100), dS=ri(-200,200), T=ri(1,6)*100, dG=rd(dH-T*dS/1000,1);
  if(Math.random()<0.5) return {q:'A reaction has ΔH = <b>'+dH+' kJ</b>, ΔS = <b>'+dS+' J/K</b>, at <b>T = '+T+' K</b>. Find ΔG (kJ).', input:true, answer:dG, unit:'kJ', accept:qty(dG,{tol:0.5,dim:'energy'}), note:'ΔG = ΔH − TΔS = '+dH+' − '+T+'×'+dS+'/1000 = '+dG+' kJ.'};
  return {q:'A reaction has ΔG = <b>'+dG+' kJ</b>. Is it spontaneous?', choices:['Spontaneous','Non-spontaneous'], answer:dG<0?'Spontaneous':'Non-spontaneous', note:'A reaction is spontaneous when ΔG < 0.'}; }

/* ══ PHYSICS ══ */
function genVectors(){ const [a,b,c]=pk([[3,4,5],[6,8,10],[5,12,13],[8,15,17],[9,12,15],[7,24,25]]); const m=physMC(c,'N',[a+b,Math.abs(a-b),rd(Math.sqrt(a*b),1)]);
  return {q:'Two perpendicular forces of <b>'+a+' N</b> and <b>'+b+' N</b> act at a point. Find the magnitude of the resultant.'+vectorSVG(a,b), choices:m.choices, answer:m.answer, note:'R = √('+a+'² + '+b+'²) = '+c+' N.'}; }
function genRelVel(){ let va=nzr(-30,30), vb=nzr(-30,30); if(va===vb) return genRelVel(); const rel=va-vb;
  return {q:'Along a straight road (right = positive), car A travels at <b>'+va+' m/s</b> and car B at <b>'+vb+' m/s</b>. Find the velocity of A relative to B.', input:true, answer:rel, unit:'m/s', accept:qty(rel,{tol:0.05,dim:'speed',dir:true}), note:'v(A rel B) = vA − vB = '+va+' − ('+vb+') = '+rel+' m/s.'}; }
function genKinematics(){ const u=ri(0,15), v=ri(16,40), t=ri(2,8), a=rd((v-u)/t,2); const m=physMC(a,'m/s²',[v-u, rd((v+u)/t,2), rd((v-u)/t/2,2)]);
  return {q:'A car speeds up from <b>'+u+' m/s</b> to <b>'+v+' m/s</b> in <b>'+t+' s</b>. Find its acceleration.', choices:m.choices, answer:m.answer, note:'a = Δv/Δt = ('+v+'−'+u+')/'+t+' = '+a+' m/s².'}; }
function genNewton(){ const mass=ri(2,20), a=ri(1,10), F=mass*a; const m=physMC(F,'N',[mass+a, rd(F/2,1), rd(mass/a,2)]);
  return {q:'What net force gives a <b>'+mass+' kg</b> mass an acceleration of <b>'+a+' m/s²</b>?', choices:m.choices, answer:m.answer, note:'F = ma = '+mass+'×'+a+' = '+F+' N.'}; }
function genFriction(){ const mu=[0.1,0.2,0.3,0.4,0.5][ri(0,4)], N=ri(10,60)*10, Ff=rd(mu*N,1); const m=physMC(Ff,'N',[rd(N/mu,1), rd(mu+N,1), rd(N-mu,1)]);
  return {q:'A block has coefficient of friction <b>μ = '+mu+'</b> and normal force <b>N = '+N+' N</b>. Find the friction force.', choices:m.choices, answer:m.answer, note:'Ff = μN = '+mu+'×'+N+' = '+Ff+' N.'}; }
function genMomentum(){ if(Math.random()<0.5){ const mass=ri(2,20), v=ri(2,20), p=mass*v; const m=physMC(p,'kg·m/s',[mass+v, rd(p/2,1), Math.abs(mass-v)]);
    return {q:'Find the momentum of a <b>'+mass+' kg</b> object moving at <b>'+v+' m/s</b>.', choices:m.choices, answer:m.answer, note:'p = mv = '+mass+'×'+v+' = '+p+' kg·m/s.'}; }
  const m1=ri(2,6), v1=ri(2,10), m2=ri(2,6), vf=rd(m1*v1/(m1+m2),2); const m=physMC(vf,'m/s',[v1, rd(m1*v1,2), rd(v1/2,2)]);
  return {q:'A <b>'+m1+' kg</b> trolley at <b>'+v1+' m/s</b> collides with and sticks to a stationary <b>'+m2+' kg</b> trolley. Find their common velocity.', choices:m.choices, answer:m.answer, note:'m₁v₁ = (m₁+m₂)v → v = '+vf+' m/s.'}; }
function genSnell(){ if(Math.random()<0.5){ const vf=ri(15,25), v=vf*1e7, n=rd(3e8/v,2); const m=physMC(n,'',[rd(v/3e8,2), rd(3e8/v/2,2), rd(3e8/v+1,2)]);
    return {q:'Light travels at <b>'+(v/1e8)+'×10⁸ m/s</b> inside a material. Find its refractive index. (c = 3×10⁸ m/s)', choices:m.choices, answer:m.answer, note:'n = c/v = 3×10⁸ / '+(v/1e8)+'×10⁸ = '+n+'.'}; }
  const media=[['air',1.0],['water',1.33],['glass',1.5],['diamond',2.4]]; let f=pk(media), t=pk(media); while(t[1]===f[1]) t=pk(media);
  const toward=t[1]>f[1]; return {q:'Light passes from <b>'+f[0]+' (n = '+f[1]+')</b> into <b>'+t[0]+' (n = '+t[1]+')</b>. How does it bend?', choices:['Toward the normal','Away from the normal'], answer:toward?'Toward the normal':'Away from the normal', note:'Entering a '+(toward?'denser':'less dense')+' medium (higher→lower speed) bends light '+(toward?'toward':'away from')+' the normal.'}; }
function genSuper(){ const inPhase=Math.random()<0.5; return {q:'Two identical waves overlap '+(inPhase?'<b>in phase</b> (crest on crest)':'<b>out of phase</b> (crest on trough)')+'. What interference results?', choices:['Constructive','Destructive'], answer:inPhase?'Constructive':'Destructive', note:'In phase → constructive; exactly out of phase → destructive.'}; }
function genSound(){ const t=ri(1,6), d=rd(340*t/2,0); const m=physMC(d,'m',[340*t, rd(340/t,0), rd(340*t/4,0)]);
  return {q:'An echo returns <b>'+t+' s</b> after a shout (speed of sound 340 m/s). How far away is the wall?', choices:m.choices, answer:m.answer, note:'d = vt/2 = 340×'+t+'/2 = '+d+' m.'}; }
function genEM(){ const order=['radio','microwave','infrared','visible light','ultraviolet','X-rays','gamma rays']; let a=ri(0,6), b=ri(0,6); while(b===a) b=ri(0,6);
  const higher = a>b?order[a]:order[b]; return {q:'Which has the higher frequency: <b>'+order[a]+'</b> or <b>'+order[b]+'</b>?', choices:[order[a],order[b]], answer:higher, note:'Increasing frequency: radio → microwave → infrared → visible → UV → X-rays → gamma.'}; }
function genOhm(){ const k=ri(0,2), I=ri(1,10), R=ri(1,20), V=I*R;
  if(k===0){ const m=physMC(V,'V',[I+R, rd(V/2,1), rd(R/I,2)]); return {q:'A <b>'+R+' Ω</b> resistor carries <b>'+I+' A</b>. Find the voltage across it.', choices:m.choices, answer:m.answer, note:'V = IR = '+I+'×'+R+' = '+V+' V.'}; }
  if(k===1){ const m=physMC(I,'A',[V, rd(R/V,2), V*R]); return {q:'A <b>'+V+' V</b> supply is across a <b>'+R+' Ω</b> resistor. Find the current.', choices:m.choices, answer:m.answer, note:'I = V/R = '+V+'/'+R+' = '+I+' A.'}; }
  const m=physMC(V*I,'W',[V+I, rd(V/I,2), 2*V*I]); return {q:'A device draws <b>'+I+' A</b> at <b>'+V+' V</b>. Find the power.', choices:m.choices, answer:m.answer, note:'P = VI = '+V+'×'+I+' = '+(V*I)+' W.'}; }
function genResistors(){ const R1=ri(1,12), R2=ri(1,12);
  if(Math.random()<0.5){ const m=physMC(R1+R2,'Ω',[Math.abs(R1-R2), R1*R2, rd(R1*R2/(R1+R2),2)]); return {q:'Resistors of <b>'+R1+' Ω</b> and <b>'+R2+' Ω</b> in <b>series</b>. Find the total resistance.', choices:m.choices, answer:m.answer, note:'Series: '+R1+' + '+R2+' = '+(R1+R2)+' Ω.'}; }
  const rp=rd(R1*R2/(R1+R2),2); const m=physMC(rp,'Ω',[R1+R2, Math.abs(R1-R2), rd((R1+R2)/2,2)]); return {q:'Resistors of <b>'+R1+' Ω</b> and <b>'+R2+' Ω</b> in <b>parallel</b>. Find the total resistance.', choices:m.choices, answer:m.answer, note:'Parallel: R₁R₂/(R₁+R₂) = '+rp+' Ω.'}; }
function genEfield(){ const V=ri(10,100)*10, d=ri(2,10)/100, E=rd(V/d,0); const m=physMC(E,'V/m',[V*d, rd(d/V,4), V+d]);
  return {q:'Two plates <b>'+d+' m</b> apart have a potential difference of <b>'+V+' V</b>. Find the electric field strength.', choices:m.choices, answer:m.answer, note:'E = V/d = '+V+'/'+d+' = '+E+' V/m.'}; }
function genMag(){ const B=[0.1,0.2,0.5,1,2][ri(0,4)], I=ri(1,10), L=ri(1,5), F=rd(B*I*L,2); const m=physMC(F,'N',[rd(B+I+L,2), rd(B*I,2), I*L]);
  return {q:'A <b>'+L+' m</b> wire carries <b>'+I+' A</b> perpendicular to a <b>'+B+' T</b> field. Find the force on it.', choices:m.choices, answer:m.answer, note:'F = BIL = '+B+'×'+I+'×'+L+' = '+F+' N.'}; }

/* ══ ENGINEERING ══
   Content from the Year 11 Engineering Studies "Materials & grain structure"
   study guide. Facts live in small curated tables and the generators below ask
   about them from several angles (name→fact and fact→name), which is what keeps
   a subtopic from looping after half a dozen questions. Distractors always come
   from the same table, so every wrong option is a real, plausible alternative. */

/* turn a curated {q,a,w} list into a keyed MC question */
function bankQ(list, keyp){
  const i = (Math.random()*list.length)|0, it = list[i];
  const m = mc(it.a, it.w);
  return { q:it.q, choices:m.choices, answer:m.answer, note:it.note, key:keyp+'#'+i };
}
/* ask about one field of a row, either direction, distractors from the table */
function fieldQ(rows, row, field, askName, askField, keyp){
  const others = rows.filter(x => x !== row);
  if (Math.random() < 0.5){
    const m = mc(row.n, shuffle(others).map(x => x.n));
    return { q:askName(row), choices:m.choices, answer:m.answer, key:keyp+':n:'+field+':'+row.n };
  }
  const m = mc(row[field], shuffle(others).map(x => x[field]));
  return { q:askField(row), choices:m.choices, answer:m.answer, key:keyp+':'+field+':'+row.n };
}

const MATS_STEEL = [
  { n:'Low-carbon (mild) steel', c:'up to about 0.25–0.30%',
    key:'relatively soft and ductile, and it welds easily',
    use:'car-body sheet, rivets and general fabrication',
    lim:'low hardness and wear resistance, and it rusts without protection',
    micro:'mostly ferrite with only a little pearlite' },
  { n:'Medium-carbon steel', c:'about 0.30–0.60%',
    key:'a useful balance of strength and toughness, and it can be quenched and tempered',
    use:'shafts, axles and gears',
    lim:'harder to form and weld, often needing preheating and controlled cooling',
    micro:'roughly equal amounts of ferrite and pearlite' },
  { n:'Eutectoid steel', c:'about 0.76%, usually rounded to 0.8%',
    key:'comparatively strong and wear resistant, but noticeably less ductile',
    use:'high-carbon pearlitic wire, including some cables',
    lim:'much less ductile than lower-carbon steel',
    micro:'essentially all pearlite' },
  { n:'High-carbon steel', c:'above about 0.60%, commonly 0.6–1.4%',
    key:'reaches high hardness after treatment and holds a cutting edge well',
    use:'knives, files, cutting tools and springs',
    lim:'brittle conditions crack easily, and it is difficult to weld or form',
    micro:'pearlite colonies with a proeutectoid cementite network' }
];
function genSteelFact(){
  if (Math.random() < 0.18) return pk(MICRO_STEEL)();     // a diagram question now and then
  const r = pk(MATS_STEEL), f = pk(['c','key','use','lim','micro']);
  const ask = {
    c:     [x=>'Which steel has a carbon content of <b>'+x.c+'</b>?',      x=>'What is the typical carbon content of <b>'+x.n+'</b>?'],
    key:   [x=>'Which steel is <b>'+x.key+'</b>?',                          x=>'Which best describes the properties of <b>'+x.n+'</b>?'],
    use:   [x=>'Which steel is typically used for <b>'+x.use+'</b>?',       x=>'What is <b>'+x.n+'</b> typically used for?'],
    lim:   [x=>'Which steel has this main limitation: <b>'+x.lim+'</b>?',   x=>'What is the main limitation of <b>'+x.n+'</b>?'],
    micro: [x=>'Which slow-cooled steel shows <b>'+x.micro+'</b>?',         x=>'What does the microstructure of <b>'+x.n+'</b> look like after slow cooling?']
  }[f];
  return fieldQ(MATS_STEEL, r, f, ask[0], ask[1], 'steel');
}

const MATS_IRON = [
  { n:'Grey cast iron', main:'graphite flakes',
    key:'good vibration damping, castability and machinability',
    use:'engine cylinder blocks, machine-tool beds and brake discs',
    lim:'sharp flake tips concentrate tensile stress, so it is weak in tension',
    micro:'black graphite flakes in a pearlitic matrix' },
  { n:'Nodular (ductile) cast iron', main:'rounded graphite nodules',
    key:'higher tensile ductility and toughness than comparable grey iron',
    use:'pressure pipes, crankshafts, gears and piston rings',
    lim:'it needs controlled melt treatment, usually with magnesium',
    micro:'rounded black graphite nodules in a pearlitic matrix' },
  { n:'White cast iron', main:'cementite (carbides) rather than free graphite',
    key:'very hard and highly abrasion resistant',
    use:'wear liners, grinding components and crusher parts',
    lim:'low ductility and poor impact toughness, and it is difficult to machine',
    micro:'pale cementite regions around pearlite, with no graphite' },
  { n:'Malleable cast iron', main:'temper-carbon rosettes',
    key:'more ductile and tougher than white iron, so it tolerates shock better',
    use:'pipe fittings, brackets and small general engineering castings',
    lim:'the prolonged heat treatment takes time and adds cost',
    micro:'irregular dark temper-carbon clusters in a ferritic matrix' }
];
function genIronFact(){
  if (Math.random() < 0.18) return pk(MICRO_IRON)();      // a diagram question now and then
  const r = pk(MATS_IRON), f = pk(['main','key','use','lim','micro']);
  const ask = {
    main:  [x=>'In which cast iron is the carbon present mainly as <b>'+x.main+'</b>?', x=>'In <b>'+x.n+'</b>, how is most of the carbon present?'],
    key:   [x=>'Which cast iron has <b>'+x.key+'</b>?',                                  x=>'Which best describes the properties of <b>'+x.n+'</b>?'],
    use:   [x=>'Which cast iron is typically used for <b>'+x.use+'</b>?',                x=>'What is <b>'+x.n+'</b> typically used for?'],
    lim:   [x=>'Which cast iron has this main limitation: <b>'+x.lim+'</b>?',            x=>'What is the main limitation of <b>'+x.n+'</b>?'],
    micro: [x=>'Which cast iron shows <b>'+x.micro+'</b>?',                              x=>'What does the microstructure of <b>'+x.n+'</b> look like?']
  }[f];
  return fieldQ(MATS_IRON, r, f, ask[0], ask[1], 'iron');
}

const TREATS = [
  { n:'Full annealing', proc:'heating to the austenitising temperature, holding, then cooling slowly in the furnace',
    why:'soften the steel, improve ductility and relieve residual stress',
    out:'relatively coarse ferrite and pearlite' },
  { n:'Process annealing', proc:'heating a cold-worked steel below the lower critical temperature (A₁), then cooling',
    why:'restore ductility after cold work without needing to form austenite',
    out:'new equiaxed ferrite grains formed by recrystallisation' },
  { n:'Normalising', proc:'austenitising above the upper critical temperature, then cooling in still air',
    why:'refine a coarse structure and give greater strength than full annealing',
    out:'finer ferrite and pearlite than furnace cooling gives' },
  { n:'Quench hardening', proc:'austenitising, then cooling fast enough in oil, water or polymer to suppress diffusion',
    why:'raise hardness and wear resistance',
    out:'martensite, commonly described as body-centred tetragonal' },
  { n:'Tempering', proc:'reheating quenched steel below A₁, holding, then cooling',
    why:'reduce brittleness and residual stress, improving toughness at some cost in hardness',
    out:'tempered martensite: fine carbides in a ferritic matrix' },
  { n:'Carburising', proc:'holding low-carbon steel at high temperature in a carbon-rich environment so carbon diffuses inward',
    why:'give a hard, wear-resistant case around a tougher, lower-carbon core',
    out:'a high-carbon case that becomes martensitic after a later quench' },
  { n:'Nitriding', proc:'treating a suitable steel in a nitrogen-bearing environment below its austenitising temperature',
    why:'give high surface hardness and better fatigue life with relatively little distortion',
    out:'hard nitrides in a surface layer and diffusion zone, with no quench needed' },
  { n:'Induction hardening', proc:'heating selected surfaces rapidly by electromagnetic induction, then quenching them',
    why:'harden chosen surfaces quickly using the carbon already in the steel',
    out:'a martensitic surface layer over a largely unchanged core' }
];
function genTreatFact(){
  const r = pk(TREATS), f = pk(['proc','why','out']);
  const ask = {
    proc: [x=>'Which process is <b>'+x.proc+'</b>?',        x=>'What does <b>'+x.n+'</b> actually involve?'],
    why:  [x=>'Which process is done to <b>'+x.why+'</b>?', x=>'Why is <b>'+x.n+'</b> carried out?'],
    out:  [x=>'Which process produces <b>'+x.out+'</b>?',   x=>'What structure does <b>'+x.n+'</b> produce?']
  }[f];
  return fieldQ(TREATS, r, f, ask[0], ask[1], 'treat');
}

const ENG_PHASE = [
  { n:'Ferrite', d:'the iron-rich BCC phase: relatively soft and ductile, with low carbon solubility' },
  { n:'Cementite', d:'iron carbide, Fe₃C: hard and brittle' },
  { n:'Austenite', d:'the FCC iron phase present at elevated temperature in plain-carbon steel' },
  { n:'Pearlite', d:'a constituent, not a phase: alternating layers of ferrite and cementite' },
  { n:'Martensite', d:'the hard, distorted body-centred tetragonal structure formed by fast cooling' },
  { n:'Temper carbon', d:'compact graphite clusters formed by the prolonged annealing of white iron' },
  { n:'Graphite', d:'free carbon in a cast iron, appearing as flakes or nodules' },
  { n:'Grain', d:'a region of the structure with a single crystal orientation' },
  { n:'Phase', d:'a structurally and chemically distinct region of a material' },
  { n:'Constituent', d:'a recognisable part of a microstructure, which may contain more than one phase' }
];
function genPhaseFact(){
  const r = pk(ENG_PHASE);
  return fieldQ(ENG_PHASE, r, 'd',
    x=>'Which term is <b>'+x.d+'</b>?', x=>'What is <b>'+x.n+'</b>?', 'phase');
}

const ENG_PROP = [
  { n:'Strength', d:'the stress a material can withstand under a stated loading mode' },
  { n:'Stiffness', d:'resistance to elastic deformation, measured in tension by Young’s modulus' },
  { n:'Elasticity', d:'the ability to return to the original shape once the load is removed' },
  { n:'Ductility', d:'the capacity for plastic deformation in tension, such as drawing into wire' },
  { n:'Malleability', d:'the capacity for plastic deformation under compression, such as rolling sheet' },
  { n:'Hardness', d:'resistance to local indentation or scratching' },
  { n:'Toughness', d:'the energy absorbed per unit volume before fracture' },
  { n:'Resilience', d:'the recoverable elastic energy stored per unit volume' },
  { n:'Brittleness', d:'fracture with little or no plastic deformation first' },
  { n:'Plasticity', d:'the ability to deform permanently without immediately fracturing' },
  { n:'Wear resistance', d:'resistance to material being lost from a surface in service' },
  { n:'Ultimate tensile strength', d:'the maximum engineering tensile stress, based on the original area' }
];
function genPropFact(){
  const r = pk(ENG_PROP);
  return fieldQ(ENG_PROP, r, 'd',
    x=>'Which property is <b>'+x.d+'</b>?', x=>'What does <b>'+x.n+'</b> mean?', 'prop');
}

/* carbon content, pearlite balance and cold work — mixed curated + computed */
const ENG_CARBON = [
  {q:'For slow-cooled plain-carbon steel below the eutectoid, increasing the carbon content…', a:'Increases the proportion of pearlite', w:['Decreases the proportion of pearlite','Removes all of the ferrite','Has no effect on the structure']},
  {q:'Does adding more carbon always give more pearlite?', a:'Only up to the eutectoid', w:['Yes, with no limit at all','No, carbon has no effect on it','Only in cast irons'], note:'Above about 0.8% C, extra proeutectoid cementite forms instead.'},
  {q:'Welding gets harder as a steel’s carbon content rises because…', a:'It needs preheating to avoid cracking', w:['Its melting point drops sharply','It starts to form graphite flakes','It can no longer be formed at all']},
  {q:'A plain-carbon steel above ~0.76% C, with cementite at the grain boundaries, is…', a:'Hypereutectoid', w:['Hypoeutectoid','Eutectoid','Austenitic']},
  {q:'A plain-carbon steel below ~0.76% C, with proeutectoid ferrite, is…', a:'Hypoeutectoid', w:['Hypereutectoid','Eutectoid','Martensitic']},
  {q:'Cementite inside pearlite is…', a:'Already present below the eutectoid composition', w:['Only present above the eutectoid','Never present in pearlite','Only present after quenching']},
  {q:'Cold working a metal raises its dislocation density, which usually…', a:'Increases yield strength and hardness but reduces ductility', w:['Reduces strength and increases ductility','Has no effect on mechanical properties','Simply makes the grains smaller and softer']},
  {q:'How is cold-rolled steel identified in a longitudinal section?', a:'Grains stretched along the rolling direction', w:['Rounded graphite nodules in the grains','A dark nitride layer at the surface','Coarse, evenly shaped equiaxed grains']},
  {q:'Work hardening is best explained as…', a:'More dislocations that block slip', w:['Grains simply growing larger','Carbon diffusing into the steel','Graphite forming into nodules']},
  {q:'Ductility lost during cold working can be restored by…', a:'Recrystallisation annealing', w:['Quench hardening','Carburising the surface','Adding magnesium']},
  {q:'On a tensile stress–strain curve, the initial straight slope represents…', a:'Young’s modulus', w:['The UTS','Tensile toughness','The fracture strain']},
  {q:'On a tensile stress–strain curve, the total area under it to fracture represents…', a:'Tensile toughness', w:['Young’s modulus','Hardness','Resilience only']},
  {q:'Engineering stress is defined as…', a:'Force divided by the original cross-sectional area (F/A₀)', w:['Force multiplied by length','Change in length over original length','Force divided by the final area']},
  {q:'Engineering strain is defined as…', a:'Change in length divided by the original length (ΔL/L₀)', w:['Force over area','Stress multiplied by modulus','Original length over change in length']},
  {q:'Necking on a tensile test happens…', a:'After the UTS, before fracture', w:['During the elastic region','Before any yielding occurs','Only in brittle materials']},
  {q:'Silicon in a cast iron…', a:'Promotes the formation of graphite', w:['Prevents graphite forming','Raises the carbon content','Makes it non-magnetic']},
  {q:'The carbon content of cast iron is typically about…', a:'2.5–4%', w:['up to 0.3%','about 0.8%','about 1.2%']},
  {q:'In a cast iron, much of the strength and hardness is controlled by…', a:'The matrix around the graphite', w:['The graphite on its own','The carbon percentage alone','The pouring temperature alone'], note:'For example, a ferrite or pearlite matrix.'},
  /* these two show their own diagram: they used to refer to "these schematics" with nothing on screen */
  {q:'In this slow-cooled steel, the striped grains are…'+microSVG('med'), a:'Pearlite', w:['Ferrite','Graphite','Austenite'],
    note:'Pearlite is fine alternating layers of ferrite and cementite, so it looks striped. The plain grains are ferrite.'},
  {q:'In this cast iron, the solid dark shapes are…'+microSVG('grey'), a:'Graphite', w:['Pearlite','Ferrite','Cementite'],
    note:'These are graphite flakes in a striped pearlite matrix, which makes it grey cast iron. Cementite shows up pale, not dark.'}
];
function genCarbonFact(){
  const lever = ri(20, 70) / 100;                 // a computed lever-rule question now and then
  if (Math.random() < 0.25){
    const frac = Math.round((lever - 0.02) / (0.76 - 0.02) * 100);
    const m = mc(frac + '%', [Math.round(100-frac)+'%', Math.round(frac/2)+'%', Math.min(99, Math.round(frac*1.6))+'%']);
    return { q:'For a slow-cooled <b>' + lever.toFixed(2) + '% C</b> steel, roughly what fraction of the structure is pearlite?',
      choices:m.choices, answer:m.answer,
      note:'Lever rule between 0.02% and 0.76% C: (' + lever.toFixed(2) + ' − 0.02) / (0.76 − 0.02) ≈ ' + (frac/100).toFixed(2) + '.' };
  }
  return bankQ(ENG_CARBON, 'carb');
}

/* the microstructure diagrams — kept as their own subtopic */
const MICRO_STEEL = [
  () => { const m = mc('Low-carbon steel', ['Eutectoid steel','High-carbon steel','White cast iron']);
    return { q:'This slow-cooled microstructure, light ferrite grains with only a little hatched pearlite, is which steel?'+microSVG('low'), choices:m.choices, answer:m.answer, key:'micro:low' }; },
  () => { const m = mc('Medium-carbon steel', ['Low-carbon (mild) steel','Eutectoid steel','Grey cast iron']);
    return { q:'This slow-cooled steel shows roughly equal ferrite and hatched pearlite. Which steel is it?'+microSVG('med'), choices:m.choices, answer:m.answer, key:'micro:med' }; },
  () => { const m = mc('Eutectoid steel (~0.8% C)', ['Low-carbon steel','Pure ferrite','Grey cast iron']);
    return { q:'This slow-cooled microstructure is essentially all pearlite (hatched colonies). Which steel is it?'+microSVG('eutectoid'), choices:m.choices, answer:m.answer, key:'micro:eutectoid' }; },
  () => { const m = mc('Hypereutectoid (high-carbon) steel', ['Low-carbon steel','Eutectoid steel','Nodular cast iron']);
    return { q:'This structure is pearlite colonies with a pale proeutectoid cementite network at the boundaries. Which steel is it?'+microSVG('high'), choices:m.choices, answer:m.answer, key:'micro:high' }; }
];
const MICRO_IRON = [
  () => { const m = mc('Grey cast iron', ['Nodular cast iron','White cast iron','Malleable cast iron']);
    return { q:'The solid shapes in this iron matrix are graphite flakes. Which cast iron is it?'+microSVG('grey'), choices:m.choices, answer:m.answer, key:'micro:grey' }; },
  () => { const m = mc('Nodular (ductile) cast iron', ['Grey cast iron','White cast iron','Eutectoid steel']);
    return { q:'The solid shapes here are rounded graphite nodules. Which cast iron is it?'+microSVG('nodular'), choices:m.choices, answer:m.answer, key:'micro:nodular' }; },
  () => { const m = mc('White cast iron', ['Grey cast iron','Nodular cast iron','Malleable cast iron']);
    return { q:'This iron has pale cementite regions and hatched pearlite, with no graphite. Which cast iron is it?'+microSVG('white'), choices:m.choices, answer:m.answer, key:'micro:white' }; },
  () => { const m = mc('Malleable cast iron', ['Grey cast iron','White cast iron','Nodular cast iron']);
    return { q:'The irregular solid clusters (temper-carbon rosettes) in this matrix identify which cast iron?'+microSVG('malleable'), choices:m.choices, answer:m.answer, key:'micro:malleable' }; }
];

/* ── physics: quantities, units and vector/scalar ──────────────────────── */
const PH_QUANT = [
  { n:'Velocity',     m:'kin',  vec:true,  u:'m/s',      d:'the rate of change of displacement' },
  { n:'Speed',        m:'kin',  vec:false, u:'m/s',      d:'how fast something moves, with no direction attached' },
  { n:'Displacement', m:'kin',  vec:true,  u:'m',        d:'the straight-line change in position, with direction' },
  { n:'Distance',     m:'kin',  vec:false, u:'m',        d:'the total length of the path travelled' },
  { n:'Acceleration', m:'kin',  vec:true,  u:'m/s²',     d:'the rate of change of velocity' },
  { n:'Time',         m:'kin',  vec:false, u:'s',        d:'how long something takes' },
  { n:'Force',        m:'dyn',  vec:true,  u:'N',        d:'a push or pull that can change an object’s motion' },
  { n:'Mass',         m:'dyn',  vec:false, u:'kg',       d:'the amount of matter in an object' },
  { n:'Weight',       m:'dyn',  vec:true,  u:'N',        d:'the gravitational force acting on a mass' },
  { n:'Momentum',     m:'dyn',  vec:true,  u:'kg·m/s',   d:'mass multiplied by velocity' },
  { n:'Work',         m:'dyn',  vec:false, u:'J',        d:'force multiplied by the distance moved in the force’s direction' },
  { n:'Energy',       m:'dyn',  vec:false, u:'J',        d:'the capacity to do work' },
  { n:'Power',        m:'dyn',  vec:false, u:'W',        d:'the rate at which work is done' },
  { n:'Frequency',    m:'wave', vec:false, u:'Hz',       d:'the number of complete cycles per second' },
  { n:'Wavelength',   m:'wave', vec:false, u:'m',        d:'the distance between two matching points on a wave' },
  { n:'Period',       m:'wave', vec:false, u:'s',        d:'the time taken for one complete cycle' },
  { n:'Amplitude',    m:'wave', vec:false, u:'m',        d:'the maximum displacement from the rest position' },
  { n:'Wave speed',   m:'wave', vec:false, u:'m/s',      d:'how fast the wave transfers energy through the medium' },
  { n:'Charge',       m:'em',   vec:false, u:'C',        d:'the property of matter that causes electrical force' },
  { n:'Current',      m:'em',   vec:false, u:'A',        d:'the rate of flow of electric charge' },
  { n:'Voltage',      m:'em',   vec:false, u:'V',        d:'the energy transferred per unit of charge' },
  { n:'Resistance',   m:'em',   vec:false, u:'Ω',        d:'how strongly a component opposes the flow of current' },
  { n:'Magnetic field strength', m:'em', vec:true, u:'T', d:'the strength of a magnetic field at a point' }
];
function genPhysQuant(mod){
  const rows = PH_QUANT.filter(x => x.m === mod), r = pk(rows), k = ri(0,3);
  if (k === 0)
    return { q:'Is <b>' + r.n + '</b> a vector or a scalar?', choices:['Vector','Scalar'],
      answer: r.vec ? 'Vector' : 'Scalar', key:'phq-v:'+r.n,
      note: r.vec ? 'A vector has direction as well as size.' : 'A scalar has size only, with no direction.' };
  if (k === 1){
    const units = [...new Set(PH_QUANT.map(x => x.u))].filter(u => u !== r.u);
    const m = mc(r.u, shuffle(units));
    return { q:'What is the SI unit of <b>' + r.n + '</b>?', choices:m.choices, answer:m.answer, key:'phq-u:'+r.n };
  }
  return fieldQ(PH_QUANT, r, 'd',
    x=>'Which quantity is <b>'+x.d+'</b>?', x=>'How is <b>'+x.n+'</b> defined?', 'phq');
}

/* ── maths: named rules and terms ──────────────────────────────────────── */
const MATH_TERMS = [
  { n:'Derivative', d:'the gradient of the tangent: the instantaneous rate of change' },
  { n:'Definite integral', d:'the signed area between a curve and the x-axis over an interval' },
  { n:'Stationary point', d:'a point on a curve where the derivative equals zero' },
  { n:'Second derivative', d:'the rate of change of the gradient, used to test concavity' },
  { n:'Factorial n!', d:'the product of every whole number from 1 up to n' },
  { n:'Permutation ⁿPᵣ', d:'the number of ordered arrangements of r items chosen from n' },
  { n:'Combination ⁿCᵣ', d:'the number of unordered selections of r items chosen from n' },
  { n:'Domain', d:'the set of inputs a function accepts' },
  { n:'Range', d:'the set of outputs a function can produce' },
  { n:'Asymptote', d:'a line that a graph approaches but never quite reaches' },
  { n:'Gradient', d:'the change in y divided by the change in x' },
  { n:'Chain rule', d:'the rule for differentiating one function nested inside another' },
  { n:'Product rule', d:'the rule for differentiating two functions multiplied together' },
  { n:'Quotient rule', d:'the rule for differentiating one function divided by another' },
  { n:'Turning point', d:'a stationary point where the gradient changes sign' },
  { n:'Constant of integration', d:'the unknown constant added to every indefinite integral' }
];
function genMathTerm(){
  const r = pk(MATH_TERMS);
  return fieldQ(MATH_TERMS, r, 'd',
    x=>'Which term means <b>'+x.d+'</b>?', x=>'What is <b>'+x.n+'</b>?', 'mterm');
}

function genMoments(){ const F=ri(5,50), d=rd(ri(2,20)/10,1), M=rd(F*d,2); const m=physMC(M,'N·m',[rd(F+d,1), rd(F/d,2), 2*F*d]);
  return {q:'A force of <b>'+F+' N</b> acts <b>'+d+' m</b> from a pivot (perpendicular). Find the moment.', choices:m.choices, answer:m.answer, note:'M = F × d = '+F+'×'+d+' = '+M+' N·m.'}; }
function genCouple(){ const F=ri(5,40), d=rd(ri(2,16)/10,1), T=rd(F*d,2); const m=physMC(T,'N·m',[rd(F+d,1), rd(F*d/2,2), 2*F*d]);
  return {q:'A couple is two equal <b>'+F+' N</b> forces acting <b>'+d+' m</b> apart in opposite directions. Find its moment.', choices:m.choices, answer:m.answer, note:'Couple moment = F × d = '+F+'×'+d+' = '+T+' N·m.'}; }

/* ══ CONCEPT BANKS (keyed MC — definitions & laws, biased by the spaced-repetition engine) ══ */
const PHYS_KIN = [
  {q:'Which of these is a vector quantity?', a:'Velocity', w:['Speed','Distance','Time']},
  {q:'Which of these is a scalar quantity?', a:'Speed', w:['Velocity','Acceleration','Displacement']},
  {q:'Acceleration is defined as the rate of change of…', a:'Velocity', w:['Displacement','Speed only','Force']},
  {q:'For a projectile (ignoring air resistance), the horizontal velocity…', a:'Stays constant', w:['Increases steadily','Decreases to zero','Equals the vertical velocity']},
  {q:'For a projectile (ignoring air resistance), the vertical acceleration is…', a:'≈9.8 m/s² downward', w:['Zero','9.8 m/s² upward','Equal to the launch speed']},
  {q:'The area under a velocity–time graph gives…', a:'Displacement', w:['Acceleration','Force','Speed']},
  {q:'The gradient (slope) of a displacement–time graph gives…', a:'Velocity', w:['Acceleration','Distance','Momentum']},
  {q:'The velocity of A relative to B is…', a:'vₐ − v_b', w:['vₐ + v_b','v_b − vₐ','vₐ × v_b']}];
const PHYS_DYN = [
  {q:'Newton’s first law says an object stays at rest or constant velocity unless…', a:'Acted on by a net external force', w:['It runs out of energy','Its mass changes','Only friction is removed']},
  {q:'Newton’s second law is written as…', a:'F = ma', w:['F = mv','F = m/a','a = Fm']},
  {q:'Newton’s third law states that…', a:'Every force has an equal, opposite pair', w:['The forces acting on any object always cancel out','Heavier objects fall faster','A force is needed to keep moving']},
  {q:'Weight differs from mass because weight is…', a:'The gravitational force on the mass', w:['Measured in kilograms','The same on every planet','A measure of how hard the object is to accelerate'], note:'W = mg, measured in newtons.'},
  {q:'Friction acts…', a:'Against the direction of motion', w:['In the direction of motion','Straight out of the surface','Toward the centre of mass']},
  {q:'Momentum is conserved in a collision when…', a:'No net external force acts on the system', w:['The objects have equal mass','Kinetic energy is conserved during the collision','The collision is elastic only']},
  {q:'Work done by a force equals…', a:'Force × distance in its direction', w:['Force × the time it acts for','Mass × velocity','Force ÷ the area it acts on']},
  {q:'Which type of collision conserves kinetic energy?', a:'An elastic collision', w:['An inelastic collision','A perfectly inelastic collision','Any collision']}];
const PHYS_WAVE = [
  {q:'In a transverse wave, the particles oscillate…', a:'Perpendicular to the direction of energy travel', w:['Parallel to the direction of travel','In circles only','Not at all']},
  {q:'In a longitudinal wave, the particles oscillate…', a:'Parallel to the direction of energy travel', w:['Perpendicular to the travel','At 45° to the travel','Randomly']},
  {q:'Sound travelling through air is…', a:'A longitudinal wave', w:['A transverse wave','An electromagnetic wave','A standing wave only']},
  {q:'The wave equation linking speed, frequency and wavelength is…', a:'v = fλ', w:['v = f/λ','v = λ/f','f = vλ']},
  {q:'When a wave passes into a slower (denser) medium, it bends…', a:'Toward the normal', w:['Away from the normal','Straight back','Along the surface']},
  {q:'Constructive interference happens when waves meet…', a:'In phase (crest on crest)', w:['Out of phase (crest on trough)','At right angles','With different speeds']},
  {q:'Which lists the EM spectrum from low to high frequency?', a:'Radio → infrared → visible → X-rays', w:['X-rays → visible → radio','Visible → radio → gamma','Gamma → X-rays → radio']},
  {q:'The law of reflection states that…', a:'The angle of incidence equals the angle of reflection', w:['Incidence equals the refraction angle','Light always bends toward the normal','Frequency changes on reflection']}];
const PHYS_EM = [
  {q:'Ohm’s law is…', a:'V = IR', w:['V = I/R','P = IR','I = VR']},
  {q:'Adding resistors in series makes the total resistance…', a:'Larger than any single resistor', w:['Smaller than any single resistor','Equal to the smallest','Zero']},
  {q:'Adding resistors in parallel makes the total resistance…', a:'Smaller than the smallest resistor', w:['Larger than the largest resistor','Equal to the sum of them all','Equal to their average value']},
  {q:'Electric current is the rate of flow of…', a:'Charge', w:['Voltage','Energy','Resistance']},
  {q:'Electrical power can be calculated as…', a:'P = VI', w:['P = V/I','P = IR','P = V + I']},
  {q:'The force on a current-carrying wire in a magnetic field is greatest when the wire is…', a:'Perpendicular to the field', w:['Parallel to the field','At 45° to the field','Stationary']},
  {q:'Two like electric charges…', a:'Repel each other', w:['Attract each other','Exert no force','Merge together']},
  {q:'A material that lets charge flow easily is…', a:'A conductor', w:['An insulator','A dielectric','A vacuum']}];
const MATH_CONCEPTS = [
  {q:'The power rule: the derivative of xⁿ is…', a:'n·xⁿ⁻¹', w:['xⁿ⁻¹','n·xⁿ⁺¹','(n−1)·xⁿ']},
  {q:'The derivative of a constant is…', a:'0', w:['1','the constant itself','x']},
  {q:'The derivative of a sum equals…', a:'The sum of the derivatives', w:['The product of the derivatives','Always zero','The derivative of the first term only']},
  {q:'Integration is the reverse process of…', a:'Differentiation', w:['Multiplication','Factorising','Taking a limit']},
  {q:'An indefinite integral includes “+ C” because…', a:'A constant’s derivative is zero', w:['It keeps the answer positive','It marks the upper limit','It is the gradient at x = 0'], note:'So any constant could have been there, and C stands for it.'},
  {q:'You use a permutation (ⁿPᵣ) rather than a combination (ⁿCᵣ) when…', a:'Order matters', w:['Order does not matter','The two groups are equal','Repetition is allowed']},
  {q:'The number of ways to arrange n distinct objects in a line is…', a:'n!', w:['n²','2ⁿ','n(n−1)/2']},
  {q:'The graph of y = f(x − h), for h > 0, is y = f(x) shifted…', a:'h units to the right', w:['h units to the left','h units up','h units down']},
  {q:'The graph of y = f(x) + k, for k > 0, is shifted…', a:'k units up', w:['k units down','k units right','k units left']},
  {q:'The graph of y = −f(x) is a reflection of y = f(x) in the…', a:'x-axis', w:['y-axis','line y = x','origin only']}];

/* ══ EXPANSION: chemistry, physics and engineering ══
   Sourced from the KISS Chemistry PhotoMasters (Modules 1–4), the NSW Physics
   Stage 6 syllabus, and the Engineering Studies textbook (Engineering
   Fundamentals, Engineered Products, Braking Systems, Biomedical). The
   textbook's historical chronologies are deliberately reduced to the concept
   that actually matters — e.g. "guarding moving parts" rather than who patented
   which lawnmower. */

/* ── chemistry: mixtures & separation (Module 1) ───────────────────────── */
const SEPARATION = [
  { n:'Filtration', d:'separates an insoluble solid from a liquid by passing the mixture through a porous barrier' },
  { n:'Evaporation', d:'drives off the solvent to leave a dissolved solid behind' },
  { n:'Distillation', d:'separates liquids by boiling one off and condensing it back, using the difference in boiling points' },
  { n:'Fractional distillation', d:'separates several liquids whose boiling points are close, using a fractionating column' },
  { n:'Chromatography', d:'separates components by how strongly each is carried along by a solvent versus held by the paper' },
  { n:'Decanting', d:'pours the liquid off a settled solid without disturbing it' },
  { n:'Sieving', d:'separates solid particles from each other by size' },
  { n:'Separating funnel', d:'separates two liquids that do not mix, by draining off the denser layer' },
  { n:'Magnetic separation', d:'pulls out a magnetic component such as iron filings' },
  { n:'Centrifuging', d:'spins a mixture so the denser component is forced to the bottom' }
];
const MIX_CONCEPT = [
  {q:'What makes a mixture different from a compound?', a:'Its parts keep their own properties', w:['Its parts are chemically bonded','It always has a fixed ratio','It can only be split chemically'], note:'So a mixture can be separated by physical means.'},
  {q:'A solution is best described as…', a:'A solute evenly dissolved in a solvent', w:['A pure substance of one element','A mixture with visible parts','A compound in a fixed ratio']},
  {q:'"Homogeneous" means the mixture…', a:'Has a uniform composition throughout', w:['Has visibly separate parts','Contains only one element','Cannot be separated']},
  {q:'Separation techniques work because they exploit differences in…', a:'Physical properties', w:['Chemical formulas','Atomic numbers','Numbers of protons'], note:'Such as particle size, boiling point or solubility.'},
  {q:'Allotropes are…', a:'Different structures of one element', w:['Atoms of one element, different masses','Different elements with equal masses','Compounds sharing one formula']},
  {q:'Diamond and graphite are allotropes because they…', a:'Are both carbon, arranged differently', w:['Contain different elements','Have different numbers of protons','Are both compounds of carbon']},
  {q:'Graphite conducts electricity but diamond does not, because graphite has…', a:'Delocalised electrons', w:['A higher melting point','More protons per atom','Ionic bonding'], note:'Each carbon uses three electrons in bonds, leaving one free to move between the layers.'},
  {q:'Isotopes of an element differ in their number of…', a:'Neutrons', w:['Protons','Electrons in a neutral atom','Energy levels']}
];
function genSeparation(){
  if (Math.random() < 0.4) return bankQ(MIX_CONCEPT, 'mixc');
  return termQ(SEPARATION, 'sep',
    r => 'Which technique <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── chemistry: balancing equations (Module 2), computed ───────────────── */
const BALANCE = [
  { eq:'__ H₂ + __ O₂ → __ H₂O',                 c:[2,1,2] },
  { eq:'__ N₂ + __ H₂ → __ NH₃',                 c:[1,3,2] },
  { eq:'__ CH₄ + __ O₂ → __ CO₂ + __ H₂O',       c:[1,2,1,2] },
  { eq:'__ Fe + __ O₂ → __ Fe₂O₃',               c:[4,3,2] },
  { eq:'__ Na + __ Cl₂ → __ NaCl',               c:[2,1,2] },
  { eq:'__ Al + __ Cl₂ → __ AlCl₃',              c:[2,3,2] },
  { eq:'__ Mg + __ HCl → __ MgCl₂ + __ H₂',      c:[1,2,1,1] },
  { eq:'__ C₃H₈ + __ O₂ → __ CO₂ + __ H₂O',      c:[1,5,3,4] },
  { eq:'__ KClO₃ → __ KCl + __ O₂',              c:[2,2,3] },
  { eq:'__ H₂O₂ → __ H₂O + __ O₂',               c:[2,2,1] },
  { eq:'__ Na + __ H₂O → __ NaOH + __ H₂',       c:[2,2,2,1] },
  { eq:'__ CaCO₃ + __ HCl → __ CaCl₂ + __ H₂O + __ CO₂', c:[1,2,1,1,1] },
  { eq:'__ Zn + __ HCl → __ ZnCl₂ + __ H₂',      c:[1,2,1,1] },
  { eq:'__ C₂H₆ + __ O₂ → __ CO₂ + __ H₂O',      c:[2,7,4,6] },
  { eq:'__ Ca + __ O₂ → __ CaO',                 c:[2,1,2] },
  { eq:'__ SO₂ + __ O₂ → __ SO₃',                c:[2,1,2] },
  { eq:'__ P₄ + __ O₂ → __ P₄O₁₀',               c:[1,5,1] },
  { eq:'__ NH₃ + __ O₂ → __ NO + __ H₂O',        c:[4,5,4,6] },
  { eq:'__ Fe₂O₃ + __ C → __ Fe + __ CO₂',       c:[2,3,4,3] },
  { eq:'__ Cu + __ O₂ → __ CuO',                 c:[2,1,2] },
  { eq:'__ K + __ H₂O → __ KOH + __ H₂',         c:[2,2,2,1] },
  { eq:'__ C₄H₁₀ + __ O₂ → __ CO₂ + __ H₂O',     c:[2,13,8,10] }
];
function genBalance(){
  const r = pk(BALANCE), right = r.c.join(', ');
  const bump = (i, by) => r.c.map((v,j) => j === i ? Math.max(1, v + by) : v).join(', ');
  const wrong = [bump(0,1), bump(r.c.length-1,1), bump(1,1), r.c.map(v=>v+1).join(', ')]
    .filter(x => x !== right);
  const m = mc(right, shuffle(wrong));
  return { q:'Balance this equation. What are the coefficients, left to right?<br><b>' + r.eq + '</b>',
    choices:m.choices, answer:m.answer, key:'bal:'+r.eq,
    note:'Balanced: ' + r.eq.replace(/__ /g, () => '').trim() + ' with coefficients ' + right + '. Atoms of each element must be equal on both sides.' };
}

/* ── chemistry: gas laws (Module 2), computed ──────────────────────────── */
function genGasLaw(){
  const k = ri(0,3);
  if (k === 0){                                        // Boyle: P1V1 = P2V2
    const p1 = ri(100,300), v1 = ri(2,10), v2 = v1 * ri(2,4);
    const p2 = rd(p1*v1/v2, 1);
    const m = physMC(p2, 'kPa', [rd(p1*v2/v1,1), p1+v1, rd(p1/2,1)]);
    return { q:'A gas at <b>'+p1+' kPa</b> occupies <b>'+v1+' L</b>. At constant temperature it expands to <b>'+v2+' L</b>. What is the new pressure?',
      choices:m.choices, answer:m.answer, note:'Boyle’s law: P₁V₁ = P₂V₂ → '+p1+'×'+v1+'/'+v2+' = '+p2+' kPa.' };
  }
  if (k === 1){                                        // Charles: V1/T1 = V2/T2
    const t1 = ri(250,320), v1 = ri(2,9), t2 = t1 + ri(40,150);
    const v2 = rd(v1*t2/t1, 2);
    const m = physMC(v2, 'L', [rd(v1*t1/t2,2), rd(v1+t2-t1,2), v1]);
    return { q:'A gas occupies <b>'+v1+' L</b> at <b>'+t1+' K</b>. At constant pressure it is heated to <b>'+t2+' K</b>. What is the new volume?',
      choices:m.choices, answer:m.answer, note:'Charles’ law: V₁/T₁ = V₂/T₂ → '+v1+'×'+t2+'/'+t1+' = '+v2+' L.' };
  }
  if (k === 2){                                        // combined
    const p1 = ri(100,200), v1 = ri(2,8), t1 = ri(270,310);
    const p2 = p1 + ri(40,120), t2 = t1 + ri(30,120);
    const v2 = rd(p1*v1*t2/(t1*p2), 2);
    const m = physMC(v2, 'L', [rd(v1*p2/p1,2), rd(v1*t2/t1,2), v1]);
    return { q:'A gas is <b>'+v1+' L</b> at <b>'+p1+' kPa</b> and <b>'+t1+' K</b>. It changes to <b>'+p2+' kPa</b> and <b>'+t2+' K</b>. What is the new volume?',
      choices:m.choices, answer:m.answer, note:'Combined: P₁V₁/T₁ = P₂V₂/T₂ → '+v2+' L.' };
  }
  const n = ri(1,6)/2, t = ri(280,340), v = rd(n*8.314*t/101.3, 2);   // ideal, P in kPa
  const m = physMC(v, 'L', [rd(n*8.314*t,2), rd(v/2,2), rd(n*t/101.3,2)]);
  return { q:'What volume does <b>'+n+' mol</b> of an ideal gas occupy at <b>'+t+' K</b> and <b>101.3 kPa</b>? (R = 8.314 J/mol·K)',
    choices:m.choices, answer:m.answer, note:'PV = nRT → V = nRT/P = '+n+'×8.314×'+t+'/101.3 = '+v+' L.' };
}

/* ── chemistry: reaction rates & collision theory (Module 3) ───────────── */
const RATE_C = [
  {q:'Collision theory says a reaction happens only when particles collide…', a:'With enough energy, and in the right orientation', w:['At any speed at all','Exactly head-on every time','Only when a catalyst is present to lower the energy']},
  {q:'The minimum energy a collision needs for a reaction to proceed is the…', a:'Activation energy', w:['Enthalpy of formation','Bond energy','Lattice energy']},
  {q:'Raising the temperature speeds a reaction up mainly because particles…', a:'Collide more often and more energetically', w:['Grow larger as they are heated','Lower their own activation energy as they warm up','Break apart before they collide'], note:'The bigger effect is that more collisions now exceed the activation energy.'},
  {q:'Raising the concentration of a dissolved reactant speeds the reaction up because…', a:'More particles means more collisions', w:['The particles move faster','The activation energy falls','The temperature rises']},
  {q:'For a gas, increasing the pressure has the same effect as…', a:'Increasing the concentration', w:['Lowering the temperature','Adding a catalyst','Increasing the surface area'], note:'Squeezing the gas packs the particles closer together.'},
  {q:'Powdering a solid reactant speeds the reaction up because it…', a:'Increases the surface area exposed to the other reactant', w:['Raises the temperature','Lowers the activation energy','Increases the concentration of the solid reactant present']},
  {q:'A catalyst speeds up a reaction by…', a:'Providing an alternative pathway with a lower activation energy', w:['Raising the temperature of the whole mixture so particles collide harder','Being used up to release energy','Increasing the concentration of reactants']},
  {q:'After a reaction, a catalyst is…', a:'Chemically unchanged and can be recovered', w:['Consumed and must be replaced','Converted into product','Always a gas']},
  {q:'Does a catalyst change the enthalpy change (ΔH) of a reaction?', a:'No, it only lowers the activation energy', w:['Yes, it makes ΔH more negative','Yes, it makes ΔH more positive','Yes, it makes an endothermic reaction exothermic']},
  {q:'Which of these is NOT a valid indication that a chemical change has occurred?', a:'The mixture changes shape', w:['A gas is produced','A precipitate forms','The temperature changes without heating']},
  {q:'A precipitate forming when two solutions are mixed indicates…', a:'A new insoluble solid has formed', w:['The solvent has evaporated','Only a physical change','The solution was diluted'], note:'That makes it a chemical change.'},
  {q:'In the reaction Mg + 2HCl → MgCl₂ + H₂, the rate could be measured by…', a:'How fast hydrogen gas is made', w:['The colour of the magnesium','The mass of the test tube','The volume of acid added']}
];
const RATE_FACTORS = [
  { n:'Temperature', d:'particles move faster, so collisions are both more frequent and more energetic' },
  { n:'Concentration', d:'more particles are packed into the same volume, so collisions happen more often' },
  { n:'Gas pressure', d:'the same particles are forced into a smaller space, raising the collision frequency' },
  { n:'Surface area', d:'more of the solid is exposed, so more particles are available to be hit' },
  { n:'Catalyst', d:'an alternative reaction pathway with a lower activation energy is provided' }
];
function genRates(){
  if (Math.random() < 0.45)
    return termQ(RATE_FACTORS, 'ratef',
      r => 'Which factor speeds a reaction up because <b>' + r.d + '</b>?',
      r => 'How does <b>' + r.n + '</b> increase the rate of a reaction?');
  return bankQ(RATE_C, 'ratec');
}

/* ── chemistry: activity series (Module 3), computed from the order ────── */
const ACTIVITY = ['Potassium','Sodium','Calcium','Magnesium','Aluminium','Zinc','Iron','Lead','Copper','Silver','Gold'];
function genActivity(){
  const k = ri(0,2);
  let i = ri(0, ACTIVITY.length-2), j = ri(i+1, ACTIVITY.length-1);
  const more = ACTIVITY[i], less = ACTIVITY[j];          // earlier in the list = more reactive
  if (k === 0)
    return { q:'Which metal is <b>more reactive</b>: '+more+' or '+less+'?', choices:shuffle([more,less]),
      answer:more, key:'act-cmp:'+more+'|'+less,
      note:'Activity series (most → least reactive): '+ACTIVITY.join(' > ')+'.' };
  if (k === 1)
    return { q:'Will <b>'+more+'</b> displace <b>'+less+'</b> from a solution of its salt?', choices:['Yes','No'],
      answer:'Yes', key:'act-dis:'+more+'|'+less,
      note:more+' is above '+less+' in the activity series, so it displaces it.' };
  return { q:'Will <b>'+less+'</b> displace <b>'+more+'</b> from a solution of its salt?', choices:['Yes','No'],
    answer:'No', key:'act-nod:'+less+'|'+more,
    note:less+' is below '+more+' in the activity series, so no reaction occurs.' };
}

/* ── chemistry: energy profiles (Module 4) ─────────────────────────────── */
const ENERGY_C = [
  {q:'In an exothermic reaction, the products…', a:'Have less energy than the reactants', w:['Have more energy than the reactants','Have the same energy as the reactants','Always include a gas'], note:'The difference is released as heat.'},
  {q:'The sign of ΔH for an exothermic reaction is…', a:'Negative', w:['Positive','Always zero','Undefined']},
  {q:'In an endothermic reaction the surroundings…', a:'Get colder, because energy is absorbed from them', w:['Get hotter','Stay at exactly the same temperature','Always produce a gas']},
  {q:'Breaking chemical bonds is…', a:'Endothermic, energy must be put in', w:['Exothermic, energy is released','Neither, bonds break freely','Always spontaneous']},
  {q:'Forming chemical bonds is…', a:'Exothermic, energy is released', w:['Endothermic, energy is absorbed','Energy neutral','Only possible with a catalyst']},
  {q:'A reaction is exothermic overall when…', a:'Forming bonds releases more than breaking uses', w:['Breaking bonds uses more than forming releases','No bonds are broken at all','The activation energy is zero']},
  {q:'On an energy profile diagram, the activation energy is the gap between…', a:'The reactants and the peak of the curve', w:['The reactants and the products','The peak and the products','Zero and the products']},
  {q:'Adding a catalyst changes an energy profile diagram by…', a:'Lowering the peak only', w:['Lowering the product level','Raising the reactant level','Removing the peak entirely'], note:'The reactant and product levels, and so ΔH, stay the same.'},
  {q:'The heat of combustion of a fuel is the energy released when…', a:'One mole of the fuel burns completely', w:['A mole of fuel forms from its elements','A mole of the fuel evaporates','One mole of oxygen is used up'], note:'It is sometimes given per gram instead of per mole.'},
  {q:'Entropy is best described as a measure of…', a:'Disorder, or the ways energy can spread', w:['The total energy of a system','How fast a reaction happens','How strong the bonds are']},
  {q:'Which change increases entropy the most?', a:'A solid turning into a gas', w:['A gas turning into a liquid','A liquid freezing','A gas being compressed']},
  {q:'A reaction that produces more moles of gas than it consumes has…', a:'A positive entropy change (ΔS > 0)', w:['A negative entropy change','No entropy change','Zero enthalpy change']},
  {q:'A reaction with negative ΔH and positive ΔS is…', a:'Spontaneous at all temperatures', w:['Never spontaneous','Spontaneous only when hot','Spontaneous only when cold']},
  {q:'A reaction with positive ΔH and negative ΔS is…', a:'Never spontaneous at any temperature', w:['Always spontaneous','Spontaneous only when hot','Spontaneous only when cold']},
  {q:'Hess’s law says the enthalpy change of a reaction…', a:'Is the same whatever route is taken', w:['Depends on the route taken','Is always negative','Changes if a catalyst is used']},
  {q:'Specific heat capacity is the energy needed to…', a:'Heat 1 g of a substance by 1 °C', w:['Melt 1 mol of a substance','Break 1 mol of its bonds','Heat any mass of it by 1 °C']},
  {q:'Water is used in calorimetry largely because it has…', a:'A high, well-known heat capacity', w:['The lowest heat capacity known','No heat capacity at all','A very low boiling point']},
  {q:'Using bond energies, ΔH is calculated as…', a:'Bonds broken minus bonds formed', w:['Bonds formed minus bonds broken','Bonds broken plus bonds formed','Bonds formed divided by bonds broken']},
  {q:'The standard enthalpy of formation of an element in its standard state is…', a:'Zero, by definition', w:['Always negative','Always positive','Equal to its bond energy']},
  {q:'The Gibbs free energy equation is…', a:'ΔG = ΔH − TΔS', w:['ΔG = ΔH + TΔS','ΔG = TΔS − ΔH','ΔG = ΔH × TΔS']},
  {q:'A reaction is spontaneous when…', a:'ΔG is negative', w:['ΔG is positive','ΔH is positive','ΔS is negative']},
  {q:'Why must temperature be in kelvin in the Gibbs equation?', a:'It is an absolute scale', w:['Kelvin numbers are always smaller','Celsius cannot go below zero','It keeps ΔG positive'], note:'TΔS only scales properly when zero really means zero.'}
];
function genEnergyProfile(){ return bankQ(ENERGY_C, 'enp'); }

/* ── physics: thermodynamics (Module 3) ────────────────────────────────── */
const THERMO_C = [
  { n:'Temperature', d:'a measure of the average kinetic energy of the particles in a substance' },
  { n:'Heat', d:'energy transferred between objects because of a temperature difference' },
  { n:'Thermal equilibrium', d:'the state where two objects in contact have reached the same temperature, so no net heat flows' },
  { n:'Specific heat capacity', d:'the energy needed to raise one kilogram of a substance by one degree' },
  { n:'Latent heat', d:'the energy absorbed or released during a change of state, with no temperature change' },
  { n:'Conduction', d:'heat transfer through direct particle contact and vibration, without the material itself flowing' },
  { n:'Convection', d:'heat transfer carried by the bulk movement of a heated fluid, as warm fluid rises' },
  { n:'Radiation', d:'heat transfer by electromagnetic waves, needing no medium at all' },
  { n:'Thermal conductivity', d:'how readily a material lets heat pass through it' },
  { n:'Absolute zero', d:'the temperature at which particle motion is at its minimum, 0 K or −273 °C' }
];
function genThermoCalc(){
  const k = ri(0,2);
  if (k === 0){                                       // Q = mcΔT
    const m0 = ri(2,20)/10, c = pk([390,900,4180,2100]), dT = ri(5,60);
    const q = rd(m0*c*dT/1000, 2);
    const mm = physMC(q, 'kJ', [rd(m0*c/1000,2), rd(c*dT/1000,2), rd(q*2,2)]);
    return { q:'How much energy is needed to raise <b>'+m0+' kg</b> of a substance by <b>'+dT+' °C</b>? (c = '+c+' J/kg·°C)',
      choices:mm.choices, answer:mm.answer, note:'Q = mcΔT = '+m0+'×'+c+'×'+dT+' = '+(m0*c*dT).toFixed(0)+' J = '+q+' kJ.' };
  }
  if (k === 1){                                       // latent heat Q = mL
    const m0 = ri(1,20)/10, L = pk([334000, 2260000, 205000]);
    const q = rd(m0*L/1000, 1);
    const mm = physMC(q, 'kJ', [rd(L/1000,1), rd(m0*L/2000,1), rd(m0+L/1000,1)]);
    return { q:'How much energy is needed to change the state of <b>'+m0+' kg</b> of a substance with a latent heat of <b>'+(L/1000)+' kJ/kg</b>?',
      choices:mm.choices, answer:mm.answer, note:'Q = mL = '+m0+'×'+(L/1000)+' = '+q+' kJ (the temperature does not change).' };
  }
  const kk = pk([0.04, 0.6, 50, 200]), A = ri(1,6)/2, dT = ri(10,60), d = ri(1,20)/100;
  const rate = rd(kk*A*dT/d, 1);
  const mm = physMC(rate, 'W', [rd(kk*A*dT*d,1), rd(kk*dT/(A*d),1), rd(A*dT/d,1)]);
  return { q:'A slab of area <b>'+A+' m²</b> and thickness <b>'+d+' m</b> has <b>'+dT+' °C</b> across it (k = '+kk+' W/m·K). What is the rate of heat flow?',
    choices:mm.choices, answer:mm.answer, note:'Q/t = kAΔT/d = '+kk+'×'+A+'×'+dT+'/'+d+' = '+rate+' W.' };
}
function genThermo(){
  if (Math.random() < 0.45) return genThermoCalc();
  return termQ(THERMO_C, 'thm',
    r => 'Which term means <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* extra wave ideas the syllabus names */
const WAVE_EXTRA = [
  {q:'A standing wave is produced when…', a:'Identical waves travel opposite ways and overlap', w:['One wave slows down in a medium','Waves of different frequency meet','A wave passes through a narrow gap']},
  {q:'On a standing wave, a point that never moves is called a…', a:'Node', w:['Antinode','Crest','Trough']},
  {q:'On a standing wave, a point of maximum movement is called an…', a:'Antinode', w:['Node','Wavefront','Origin']},
  {q:'Resonance occurs when a system is driven at…', a:'Its natural frequency, giving a large amplitude response', w:['Any frequency at all','A frequency far from its natural one','Zero frequency']},
  {q:'Diffraction is the…', a:'Spreading of a wave through a gap', w:['Bending as it changes speed','Bouncing of a wave off a surface','Cancelling of two waves'], note:'It also happens around an obstacle.'},
  {q:'Diffraction is most noticeable when the gap is…', a:'About the same size as the wavelength', w:['Much larger than the wavelength','Much smaller than an atom','Perfectly square']},
  {q:'The Doppler effect describes the change in observed…', a:'Frequency due to relative motion', w:['Amplitude when a wave reflects','Speed of light in a medium','Wavelength during diffraction']},
  {q:'As an ambulance siren approaches you, the pitch you hear is…', a:'Higher, then drops as it passes', w:['Lower, then rises as it passes','Unchanged the whole time','Louder but at the same pitch']},
  {q:'Refraction happens because a wave…', a:'Changes speed in a new medium', w:['Loses energy as it travels','Changes frequency at a boundary','Is absorbed by the medium']},
  {q:'When light refracts, the quantity that stays the same is its…', a:'Frequency', w:['Speed','Wavelength','Direction']},
  {q:'Progressive (travelling) waves differ from standing waves because they…', a:'Carry energy from place to place', w:['Have fixed nodes and antinodes','Can never be reflected','Cannot travel through air']},
  {q:'The inverse square law means that doubling your distance from a point source…', a:'Reduces the intensity to a quarter', w:['Halves the intensity','Doubles the intensity','Leaves intensity unchanged']}
];

/* extra electricity / magnetism ideas */
const EM_EXTRA = [
  {q:'The magnetic field around a straight current-carrying wire is…', a:'A series of concentric circles around the wire', w:['Straight lines along the wire','A single loop at one end','Zero everywhere']},
  {q:'The field inside a current-carrying solenoid is…', a:'Strong and nearly uniform', w:['Zero everywhere inside','In circles around the axis','Pointing straight outwards'], note:'Like the field of a bar magnet.'},
  {q:'Adding an iron core to a solenoid…', a:'Greatly strengthens the field', w:['Cancels the magnetic field','Reverses the current','Has no effect on the field']},
  {q:'Reversing the current in a solenoid…', a:'Reverses the magnetic field', w:['Doubles the field strength','Switches the field off','Has no effect on the field']},
  {q:'Conventional current is defined as flowing…', a:'From positive to negative', w:['From negative to positive','The way electrons move','Only through a vacuum']},
  {q:'In a series circuit, the current through each component is…', a:'The same everywhere', w:['Divided between components','Largest at the first component','Zero at the last component']},
  {q:'In a parallel circuit, the potential difference across each branch is…', a:'The same across every branch', w:['Divided between branches','Highest in the longest branch','Always zero']},
  {q:'An ammeter must be connected…', a:'In series with the component', w:['In parallel with the component','Across the battery terminals','Anywhere in the circuit']},
  {q:'A voltmeter must be connected…', a:'In parallel with the component', w:['In series with the component','In series with the ammeter','In place of the battery']},
  {q:'Electromotive force (emf) is the energy supplied per…', a:'Unit of charge by the source', w:['Second by the resistor','Unit of current','Metre of wire']},
  {q:'The electric field between two parallel charged plates is…', a:'Uniform, and equal to V/d', w:['Strongest near one plate','Zero in the middle','Circular']},
  {q:'Two unlike charges placed near each other will…', a:'Attract', w:['Repel','Exert no force','Neutralise instantly']}
];

/* ── engineering: mechanical advantage, velocity ratio and efficiency ──── */
function genMachines(){
  const k = ri(0,3);
  if (k === 0){                                     // MA = L / E
    const E = ri(20,120), ma = ri(2,6), L = E*ma;
    const m = physMC(ma, '', [rd(E/L,2), rd(L+E,0), rd(L-E,0)]);
    return { q:'A machine lifts a load of <b>'+L+' N</b> using an effort of <b>'+E+' N</b>. What is its mechanical advantage?',
      choices:m.choices, answer:m.answer, note:'MA = Load / Effort = '+L+'/'+E+' = '+ma+'.' };
  }
  if (k === 1){                                     // VR of an inclined plane = 1/sinθ
    const deg = pk([15,20,30,45]), vr = rd(1/Math.sin(deg*Math.PI/180), 2);
    const m = physMC(vr, '', [rd(Math.sin(deg*Math.PI/180),2), rd(1/Math.cos(deg*Math.PI/180),2), deg]);
    return { q:'A ramp is inclined at <b>'+deg+'°</b>. What is its velocity ratio?',
      choices:m.choices, answer:m.answer, note:'For an inclined plane VR = 1/sin θ = 1/sin '+deg+'° = '+vr+'.' };
  }
  if (k === 2){                                     // efficiency = MA/VR
    const vr = ri(2,8), eff = pk([50,60,75,80,90]), ma = rd(eff/100*vr, 2);
    const m = physMC(ma, '', [vr, rd(vr/(eff/100),2), rd(eff/100,2)]);
    return { q:'A machine has a velocity ratio of <b>'+vr+'</b> and is <b>'+eff+'%</b> efficient. What is its mechanical advantage?',
      choices:m.choices, answer:m.answer, note:'η = MA/VR, so MA = η × VR = '+(eff/100)+'×'+vr+' = '+ma+'.' };
  }
  const ma = ri(2,6), vr = ma + ri(1,3), eff = rd(ma/vr*100, 1);
  /* was offering VR ÷ MA as a wrong option, which is always over 100% and so ruled out on sight */
  const m = pctMC(eff, [rd(100-eff,1), rd(ma/(vr+1)*100,1), rd((vr-ma)/vr*100,1)]);
  return { q:'A machine has a mechanical advantage of <b>'+ma+'</b> and a velocity ratio of <b>'+vr+'</b>. What is its efficiency?',
    choices:m.choices, answer:m.answer, note:'η = MA/VR × 100 = '+ma+'/'+vr+' × 100 = '+eff+'%.' };
}

/* ── engineering: harder mechanics ──────────────────────────────────────
   Modelled on HSC-style questions: forces at angles, levers held in balance by
   a cable, pulley and gear efficiency, bicycle drives. Diagrams show only what
   the question needs. Each wrong option is a specific slip (ignoring the angle,
   sin for cos, mm left as m, a ratio upside down, efficiency left out), and
   every question carries `data` so its answer can be re-derived and checked. */
/* NSW Engineering Studies uses g = 10 m/s² (Physics keeps 9.8 in its own questions).
   Every Engineering question that turns a mass into a weight reads this. */
const G_ACCEL = 10;
const rad = d => d * Math.PI / 180;
const svgArrow = (x1, y1, x2, y2, cls) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 8, w = 4.5;
  const p1 = [x2 - h * Math.cos(a) + w * Math.sin(a), y2 - h * Math.sin(a) - w * Math.cos(a)];
  const p2 = [x2 - h * Math.cos(a) - w * Math.sin(a), y2 - h * Math.sin(a) + w * Math.cos(a)];
  return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" class="' + (cls || 'mf') + '"/>' +
    '<path d="M' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + ' Z" class="' + (cls || 'mf') + 'h"/>';
};
const svgText = (x, y, s, anchor, cls) => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (anchor || 'middle') + '" class="' + (cls || 'mt') + '">' + s + '</text>';
const mechSVG = (w, h, body, label) => '<svg class="rvdiagram rvmech" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" font-size="13" role="img" aria-label="' + label + '">' + body + '</svg>';

/* a straight lever: fulcrum triangle, load and effort arrows, distances below */
function leverFig(cls, dL, dE, loadLabel){
  let xf, xl, xe;
  if (cls === 1){ const s = 260 / (dL + dE); xf = 40 + dL * s; xl = xf - dL * s; xe = xf + dE * s; }
  else if (cls === 2){ const s = 260 / dE; xf = 40; xl = xf + dL * s; xe = xf + dE * s; }
  else { const s = 260 / dL; xf = 40; xe = xf + dE * s; xl = xf + dL * s; }
  const by = 64;
  let b = '<line x1="' + (Math.min(xf, xl, xe) - 12) + '" y1="' + by + '" x2="' + (Math.max(xf, xl, xe) + 12) + '" y2="' + by + '" class="mb"/>';
  b += '<path d="M' + xf + ' ' + (by + 3) + ' L' + (xf - 11) + ' ' + (by + 22) + ' L' + (xf + 11) + ' ' + (by + 22) + ' Z" class="mp"/>';
  b += svgArrow(xl, by - 44, xl, by - 4) + svgText(xl, by - 50, loadLabel);
  if (cls === 1){ b += svgArrow(xe, by - 44, xe, by - 4, 'me') + svgText(xe, by - 50, 'E', 'middle', 'mte'); }
  else { b += svgArrow(xe, by + 42, xe, by + 5, 'me') + svgText(xe + 10, by + 38, 'E', 'start', 'mte'); }
  const dim = (x1, x2, y, s) => '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" class="md"/>' +
    '<line x1="' + x1 + '" y1="' + (y - 4) + '" x2="' + x1 + '" y2="' + (y + 4) + '" class="md"/><line x1="' + x2 + '" y1="' + (y - 4) + '" x2="' + x2 + '" y2="' + (y + 4) + '" class="md"/>' +
    svgText((x1 + x2) / 2, y - 4, s, 'middle', 'mtd');
  b += dim(Math.min(xf, xl), Math.max(xf, xl), 124, dL + ' mm') + dim(Math.min(xf, xe), Math.max(xf, xe), 150, dE + ' mm');
  return mechSVG(340, 160, b, 'lever diagram');
}
/* a pedal: pivot O, horizontal arm, cable from a post above O, force at an angle to the vertical */
function pedalFig(a, h, theta, F){
  const ox = 70, oy = 112, px = 300, qy = 42;
  let b = '<line x1="' + ox + '" y1="' + oy + '" x2="' + px + '" y2="' + oy + '" class="mb"/>' +
    '<line x1="' + ox + '" y1="' + oy + '" x2="' + ox + '" y2="' + qy + '" class="mb"/>' +
    '<circle cx="' + ox + '" cy="' + oy + '" r="6" class="mp"/>' + svgText(ox - 14, oy + 18, 'O');
  b += svgArrow(ox, qy, ox - 52, qy, 'me') + svgText(ox - 58, qy + 4, 'T', 'end', 'mte');
  const len = 70, sx = px + len * Math.sin(rad(theta)), sy = oy - len * Math.cos(rad(theta));
  b += '<line x1="' + px + '" y1="' + oy + '" x2="' + px + '" y2="' + (oy - len - 6) + '" class="md" stroke-dasharray="3 3"/>';
  b += svgArrow(sx, sy, px + 1.5 * Math.sin(rad(theta)), oy - 2, 'mf') + svgText(sx + 6, sy - 6, F + ' N', 'start');
  b += svgText(px - 7, oy - 30, theta + '°', 'end', 'mtd');
  b += svgText((ox + px) / 2, oy + 20, a + ' mm', 'middle', 'mtd') + svgText(ox + 8, (oy + qy) / 2 + 4, h + ' mm', 'start', 'mtd');
  return mechSVG(380, 132, b, 'pedal diagram');
}
/* point A with two arms: a vertical force on one, a perpendicular force on the other */
function twoArmFig(F1, L1, alpha, F2, L2){
  const ax = 200, ay = 170, beta = 35, ca = Math.cos(rad(alpha)), sa = Math.sin(rad(alpha)), cb = Math.cos(rad(beta)), sb = Math.sin(rad(beta));
  const s1 = 105 + L1 * 60, s2 = 115 + L2 * 60;
  const e1 = [ax - s1 * ca, ay - s1 * sa], e2 = [ax + s2 * cb, ay - s2 * sb];
  const line = (x1, y1, x2, y2, cls, dash) => '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" class="' + cls + '"' + (dash ? ' stroke-dasharray="3 3"' : '') + '/>';
  let b = line(ax, ay, e1[0], e1[1], 'mb') + line(ax, ay, e2[0], e2[1], 'mb') +
    '<circle cx="' + ax + '" cy="' + ay + '" r="5" class="mp"/>' + svgText(ax, ay + 22, 'A');
  /* the angle, marked against a dashed horizontal and labelled inside it */
  b += line(ax - 100, ay, ax, ay, 'md', true) + svgText(ax - 44 * Math.cos(rad(alpha / 2)), ay - 44 * Math.sin(rad(alpha / 2)) + 4, alpha + '°', 'middle', 'mtd');
  /* arm lengths sit just above each arm */
  b += svgText((ax + e1[0]) / 2 + 12 * sa, (ay + e1[1]) / 2 - 12 * ca, L1 + ' m', 'start', 'mtd');
  b += svgText((ax + e2[0]) / 2 - 16 * sb, (ay + e2[1]) / 2 - 16 * cb + 4, L2 + ' m', 'middle', 'mtd');
  /* the vertical force, labelled beside its arrow */
  b += svgArrow(e1[0], e1[1], e1[0], e1[1] + 56) + svgText(e1[0] - 9, e1[1] + 38, F1 + ' kN', 'end');
  /* the force at right angles to its arm, with a small square to show it */
  const d = [sb, cb];
  b += svgArrow(e2[0], e2[1], e2[0] + d[0] * 56, e2[1] + d[1] * 56) + svgText(e2[0] + d[0] * 56 + 8, e2[1] + d[1] * 56 + 4, F2 + ' kN', 'start');
  const k = 9, p1 = [e2[0] - cb * k, e2[1] + sb * k], p2 = [p1[0] + d[0] * k, p1[1] + d[1] * k], p3 = [e2[0] + d[0] * k, e2[1] + d[1] * k];
  b += '<path d="M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + ' L' + p3[0].toFixed(1) + ' ' + p3[1].toFixed(1) + '" class="md" fill="none"/>';
  return mechSVG(430, 206, b, 'forces about a point');
}
function pulleyFig(n, mass){
  const w = n * 16 + 24, x0 = 110 - w / 2;
  let b = '<line x1="' + (x0 - 10) + '" y1="12" x2="' + (x0 + w + 10) + '" y2="12" class="mb"/>';
  for (let i = 0; i < n; i++){ const x = x0 + 12 + i * 16; b += '<line x1="' + x + '" y1="14" x2="' + x + '" y2="92" class="mr"/>'; }
  b += '<rect x="' + x0 + '" y="92" width="' + w + '" height="14" rx="3" class="mp"/>' +
    '<rect x="' + (110 - 26) + '" y="116" width="52" height="26" rx="3" class="mbox"/>' + svgText(110, 134, mass + ' kg') +
    '<line x1="110" y1="106" x2="110" y2="116" class="mr"/>';
  const ex = x0 + w + 26;
  b += '<line x1="' + (x0 + w - 4) + '" y1="14" x2="' + ex + '" y2="14" class="mr"/>' + svgArrow(ex, 14, ex, 70, 'me') + svgText(ex + 8, 64, 'Effort', 'start', 'mte');
  b += svgText(x0 - 8, 58, n + ' ropes', 'end', 'mtd');
  return mechSVG(230, 150, b, 'pulley system');
}
function gearFig(Ta, Tb){
  const ra = 16 + Ta * 0.9, rb = 16 + Tb * 0.9, ca = 20 + ra, cb = ca + ra + rb + 2, cy = Math.max(ra, rb) + 8;
  const H = cy + Math.max(ra, rb) + 28;
  let b = '<circle cx="' + ca + '" cy="' + cy + '" r="' + ra + '" class="mg"/><circle cx="' + cb + '" cy="' + cy + '" r="' + rb + '" class="mg"/>' +
    '<circle cx="' + ca + '" cy="' + cy + '" r="3" class="mp"/><circle cx="' + cb + '" cy="' + cy + '" r="3" class="mp"/>';
  b += svgText(ca, cy + ra + 18, 'A: ' + Ta + ' teeth') + svgText(cb, cy + rb + 18, 'B: ' + Tb + ' teeth');
  return mechSVG(Math.round(cb + rb + 20), Math.round(H), b, 'gear pair');
}
const ratioStr = x => rd(x, 2) + ':1';
/* Efficiency options. A slip that lands above 100% is physically impossible, so
   anyone can rule it out; those are dropped in favour of near misses. */
function pctMC(val, wrongs){
  const real = wrongs.filter(w => isFinite(w) && w > 3 && w < 100 && Math.abs(w - val) >= 2).map(w => rd(w, 1));
  const near = [val - 12, val + 8, val - 21, val + 14, val - 6].filter(w => w > 3 && w < 100 && Math.abs(w - val) >= 2).map(w => rd(w, 1));
  return physMC(rd(val, 1), '%', real.concat(near));
}
/* ratio options, padded so two slips that happen to agree never leave three */
const ratioMC = (val, wrongs) => mc(ratioStr(val), wrongs.concat([val * 2, val / 2, val + 1, val * 1.5]).filter(w => isFinite(w) && w > 0).map(ratioStr));

function genMomentsHard(){
  const k = ri(0, 2);
  if (k === 0){                                     // spanner, force at an angle to it
    const F = ri(4, 30) * 10, L = pk([150, 200, 250, 300, 350, 400]), th = pk([30, 40, 45, 50, 60, 70]);
    const M = F * L / 1000 * Math.sin(rad(th));
    const m = physMC(rd(M, 2), 'N·m', [rd(F * L / 1000, 2), rd(F * L / 1000 * Math.cos(rad(th)), 2), rd(F * L * Math.sin(rad(th)), 0)]);
    const fig = '<svg class="rvdiagram rvmech" viewBox="0 0 360 120" width="360" font-size="13" role="img" aria-label="spanner">' +
      '<circle cx="40" cy="80" r="14" class="mp"/><line x1="54" y1="80" x2="300" y2="80" class="mb"/>' +
      svgArrow(300 - 70 * Math.cos(rad(th)), 80 - 70 * Math.sin(rad(th)), 298, 79) +
      svgText(300 - 70 * Math.cos(rad(th)) - 6, 80 - 70 * Math.sin(rad(th)) - 4, F + ' N', 'end') +
      svgText(250, 74, th + '°', 'middle', 'mtd') + svgText(170, 104, L + ' mm', 'middle', 'mtd') + '</svg>';
    return { q:'A force of <b>' + F + ' N</b> acts at the end of a <b>' + L + ' mm</b> spanner, at <b>' + th + '°</b> to the spanner. What moment does it apply to the nut?' + fig,
      choices:m.choices, answer:m.answer, data:{ kind:'spanner', F, L, th },
      note:'Only the part of the force perpendicular to the spanner turns it: M = F sin θ × d = ' + F + ' × sin ' + th + '° × ' + (L / 1000) + ' = ' + rd(M, 2) + ' N·m.' };
  }
  if (k === 1){                                     // pedal held by a cable
    const F = ri(4, 18) * 50, a = pk([150, 200, 250, 300]), h = pk([50, 60, 80, 100, 120]), th = pk([15, 20, 30, 40, 45]);
    const T = F * a * Math.cos(rad(th)) / h;
    const m = physMC(rd(T, 0), 'N', [rd(F * a / h, 0), rd(F * a * Math.sin(rad(th)) / h, 0), rd(F * h / (a * Math.cos(rad(th))), 0)]);
    return { q:'A pedal pivots at O and its arm is horizontal. A <b>' + F + ' N</b> force is applied at the end of the <b>' + a + ' mm</b> arm, at <b>' + th + '°</b> to the vertical. ' +
      'A cable fixed <b>' + h + ' mm</b> directly above O pulls horizontally. What cable tension T holds the pedal in balance?' + pedalFig(a, h, th, F),
      choices:m.choices, answer:m.answer, data:{ kind:'pedal', F, a, h, th },
      note:'Take moments about O. The force’s horizontal part acts along the arm, so only F cos θ turns it: T × ' + h + ' = ' + F + ' × cos ' + th + '° × ' + a + ', so T = ' + rd(T, 0) + ' N.' };
  }
  let F1, L1, al, F2, L2, net;                     // two forces about a point
  do {
    F1 = rd(ri(10, 40) / 2, 1); L1 = rd(ri(2, 6) / 10, 1); al = pk([30, 45, 60]);
    F2 = rd(ri(6, 30) / 2, 1); L2 = rd(ri(4, 9) / 10, 1);
    net = F1 * L1 * Math.cos(rad(al)) - F2 * L2;          // anticlockwise positive
  } while (Math.abs(net) < 0.3);
  const sense = v => rd(Math.abs(v), 2) + ' kN·m ' + (v > 0 ? 'anticlockwise' : 'clockwise');
  const wrong = [F1 * L1 - F2 * L2, F1 * L1 * Math.cos(rad(al)) + F2 * L2, -net, F1 * L1 * Math.sin(rad(al)) - F2 * L2,
    -(F1 * L1 * Math.cos(rad(al)) + F2 * L2), F2 * L2, -F1 * L1 * Math.cos(rad(al))]
    .filter(v => Math.abs(v) > 0.05).map(sense);
  const m = mc(sense(net), wrong);
  return { q:'Two forces act on a bracket that pivots at A (see the diagram). The ' + F1 + ' kN force is vertical, on an arm of ' + L1 + ' m at ' + al + '° above the horizontal. ' +
    'The ' + F2 + ' kN force is perpendicular to its ' + L2 + ' m arm. What is the resultant moment about A?' + twoArmFig(F1, L1, al, F2, L2),
    choices:m.choices, answer:m.answer, data:{ kind:'twoarm', F1, L1, al, F2, L2 },
    note:'The vertical force’s perpendicular distance is ' + L1 + ' cos ' + al + '° = ' + rd(L1 * Math.cos(rad(al)), 3) + ' m, giving ' + rd(F1 * L1 * Math.cos(rad(al)), 2) +
      ' kN·m anticlockwise. The other is already perpendicular: ' + F2 + ' × ' + L2 + ' = ' + rd(F2 * L2, 2) + ' kN·m clockwise. Net: ' + sense(net) + '.' };
}
function genMomentsAll(){ return Math.random() < 0.2 ? genMoments() : genMomentsHard(); }

/* ── levers ── */
const LEVER_EXAMPLES = [['wheelbarrow',2],['nutcracker',2],['bottle opener',2],['crowbar lifting a rock',1],['seesaw',1],
  ['pair of scissors',1],['pair of pliers',1],['claw hammer pulling a nail',1],['pair of tweezers',3],['fishing rod',3],
  ['human forearm lifting a weight',3],['pair of kitchen tongs',3]];
const LEVER_CLASS = ['', 'First class', 'Second class', 'Third class'];
const LEVER_MIDDLE = ['', 'Fulcrum', 'Load', 'Effort'];
function genLevers(){
  const k = ri(0, 6);
  if (k === 0){
    const [name, c] = pk(LEVER_EXAMPLES);
    return { q:'What class of lever is a <b>' + name + '</b>?', choices:[1, 2, 3].map(i => LEVER_CLASS[i]), answer:LEVER_CLASS[c],
      note:'First class: fulcrum in the middle. Second: load in the middle. Third: effort in the middle.', key:'lever-ex:' + name };
  }
  if (k === 1){
    const c = ri(1, 3);
    if (Math.random() < 0.5) return { q:'In a <b>' + LEVER_CLASS[c].toLowerCase() + '</b> lever, which sits between the other two?',
      choices:['Fulcrum', 'Load', 'Effort'], answer:LEVER_MIDDLE[c], key:'lever-mid:' + c };
    return { q:'A lever has the <b>' + LEVER_MIDDLE[c].toLowerCase() + '</b> between the other two. What class is it?',
      choices:[1, 2, 3].map(i => LEVER_CLASS[i]), answer:LEVER_CLASS[c], key:'lever-arr:' + c };
  }
  if (k === 2){
    const v = ri(0, 2), ask = ['always has a mechanical advantage less than 1', 'always has a mechanical advantage greater than 1 (ignoring friction)',
      'can have a mechanical advantage above or below 1, depending on where the fulcrum is'][v];
    return { q:'Which class of lever ' + ask + '?', choices:[1, 2, 3].map(i => LEVER_CLASS[i]), answer:LEVER_CLASS[[3, 2, 1][v]],
      note:'MA = effort distance ÷ load distance. The effort is closer in a third-class lever and further in a second-class one; in a first-class lever it depends.', key:'lever-ma:' + v };
  }
  if (k === 3 || k === 4){                          // effort to balance, then efficiency
    const c = ri(1, 3);
    let dL, dE;
    if (c === 1){ dL = pk([100, 150, 200, 250]); dE = pk([300, 400, 500, 600, 750]); }
    else if (c === 2){ dL = pk([100, 150, 200, 300]); dE = dL + pk([200, 300, 450, 600]); }
    else { dE = pk([50, 75, 100, 150]); dL = dE + pk([150, 250, 300, 450]); }
    const L = ri(4, 24) * 50, Ei = L * dL / dE;
    if (k === 3){
      const other = c === 1 ? dL + dE : Math.abs(dE - dL);
      const m = physMC(rd(Ei, 1), 'N', [rd(L * dE / dL, 1), rd(L * dL / other, 1), L]);
      return { q:'This ' + LEVER_CLASS[c].toLowerCase() + ' lever is ideal (no friction). What effort E balances the load?' + leverFig(c, dL, dE, 'L = ' + L + ' N'),
        choices:m.choices, answer:m.answer, data:{ kind:'lever-effort', L, dL, dE },
        note:'Moments about the fulcrum: E × ' + dE + ' = ' + L + ' × ' + dL + ', so E = ' + rd(Ei, 1) + ' N.' };
    }
    const eff = pk([0.6, 0.7, 0.75, 0.8, 0.85, 0.9]), E = rd(Ei / eff, 0);
    const ma = L / E, vr = dE / dL, eta = ma / vr * 100;
    /* slips: measuring a distance from the load instead of the fulcrum, or taking MA as the efficiency */
    const vrSlip = c === 1 ? (dL + dE) / dL : dE / Math.abs(dE - dL);
    const m = pctMC(eta, [ma / vrSlip * 100, ma * 100, ma / (dE / Math.abs(dE - dL || dE)) * 100]);
    return { q:'In practice this lever needs an effort of <b>' + E + ' N</b> to lift the load. What is its efficiency?' + leverFig(c, dL, dE, 'L = ' + L + ' N'),
      choices:m.choices, answer:m.answer, data:{ kind:'lever-eff', L, dL, dE, E },
      note:'MA = L ÷ E = ' + L + ' ÷ ' + E + ' = ' + rd(ma, 2) + '. VR = ' + dE + ' ÷ ' + dL + ' = ' + rd(vr, 2) + '. η = MA ÷ VR = ' + rd(eta, 1) + '%.' };
  }
  /* compound lever: the load end of lever 1 pushes the effort end of lever 2 */
  const a1 = pk([200, 300, 400, 500]), b1 = pk([100, 150, 200]), a2 = pk([200, 250, 300, 400]), b2 = pk([50, 100, 150, 200]);
  if (a1 === b1 || a2 === b2) return genLevers();
  const vr = (a1 / b1) * (a2 / b2);
  const m = ratioMC(vr, [(b1 / a1) * (b2 / a2), a1 / b1 + a2 / b2, a1 / b1, (a1 + a2) / (b1 + b2)]);
  return { q:'A compound lever is two levers in series: the load end of the first pushes the effort end of the second. ' +
    'Lever 1 has an effort arm of <b>' + a1 + ' mm</b> and a load arm of <b>' + b1 + ' mm</b>; lever 2 has <b>' + a2 + ' mm</b> and <b>' + b2 + ' mm</b>. What is the velocity ratio of the system?',
    choices:m.choices, answer:m.answer, data:{ kind:'compound', a1, b1, a2, b2 },
    note:'Velocity ratios multiply through a series: (' + a1 + ' ÷ ' + b1 + ') × (' + a2 + ' ÷ ' + b2 + ') = ' + ratioStr(vr) + '.' };
}

/* ── pulleys and gears ── */
function genPulleyGear(){
  const k = ri(0, 5);
  if (k === 0 || k === 1){
    const n = ri(2, 6), mass = ri(3, 30) * 10, eta = pk([0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]);
    const E = Math.round(mass * G_ACCEL / (eta * n) / 5) * 5;
    if (k === 0){
      const ma = mass * G_ACCEL / E, e = ma / n * 100;
      /* slips: counting pulleys rather than supporting ropes (one more or fewer), or leaving out g */
      const m = pctMC(e, [ma / (n + 1) * 100, n > 2 ? ma / (n - 1) * 100 : NaN, mass / E / n * 100]);
      return { q:'A <b>' + E + ' N</b> effort lifts a <b>' + mass + ' kg</b> load with this pulley system. What is its efficiency? (g = ' + G_ACCEL + ' m/s²)' + pulleyFig(n, mass),
        choices:m.choices, answer:m.answer, data:{ kind:'pulley-eff', n, mass, E },
        note:'MA = load ÷ effort = (' + mass + ' × ' + G_ACCEL + ') ÷ ' + E + ' = ' + rd(ma, 2) + '. VR = the ' + n + ' supporting ropes. η = MA ÷ VR = ' + rd(e, 1) + '%.' };
    }
    const need = mass * G_ACCEL / (eta * n);
    const m = physMC(rd(need, 0), 'N', [rd(mass * G_ACCEL / n, 0), rd(mass * G_ACCEL * eta / n, 0), rd(mass / (eta * n), 1)]);
    return { q:'This pulley system is <b>' + Math.round(eta * 100) + '%</b> efficient. What effort is needed to lift the <b>' + mass + ' kg</b> load? (g = ' + G_ACCEL + ' m/s²)' + pulleyFig(n, mass),
      choices:m.choices, answer:m.answer, data:{ kind:'pulley-effort', n, mass, eta },
      note:'VR = ' + n + ', so MA = η × VR = ' + rd(eta * n, 2) + '. Effort = load ÷ MA = (' + mass + ' × ' + G_ACCEL + ') ÷ ' + rd(eta * n, 2) + ' = ' + rd(need, 0) + ' N.' };
  }
  if (k === 2 || k === 3){
    const Ta = pk([12, 15, 18, 20, 24, 25, 30, 36, 40]); let Tb = pk([20, 30, 40, 45, 50, 60, 72, 80]);
    if (Tb === Ta) Tb += 10;
    if (k === 2){
      const eta = pk([0.7, 0.75, 0.8, 0.85, 0.9, 0.95]), vr = Tb / Ta, ma = eta * vr;
      const m = ratioMC(ma, [vr, eta * Ta / Tb, Ta / Tb, vr / eta]);
      return { q:'In a simple gear train, driving gear A has <b>' + Ta + ' teeth</b> and driven gear B has <b>' + Tb + ' teeth</b>. The efficiency is <b>' + Math.round(eta * 100) + '%</b>. What is the mechanical advantage?' + gearFig(Ta, Tb),
        choices:m.choices, answer:m.answer, data:{ kind:'gear-ma', Ta, Tb, eta },
        note:'VR = driven teeth ÷ driver teeth = ' + Tb + ' ÷ ' + Ta + ' = ' + rd(vr, 2) + '. MA = η × VR = ' + rd(ma, 2) + '.' };
    }
    const rpm = ri(6, 36) * 50, out = rpm * Ta / Tb;
    const m = physMC(rd(out, 1), 'rpm', [rd(rpm * Tb / Ta, 1), rpm, rd(rpm * Ta / Tb / 2, 1)]);
    return { q:'Gear A (<b>' + Ta + ' teeth</b>) turns at <b>' + rpm + ' rpm</b> and drives gear B (<b>' + Tb + ' teeth</b>). How fast does B turn?' + gearFig(Ta, Tb),
      choices:m.choices, answer:m.answer, data:{ kind:'gear-speed', Ta, Tb, rpm },
      note:'Teeth pass at the same rate on both gears, so speed × teeth is the same: ' + rpm + ' × ' + Ta + ' ÷ ' + Tb + ' = ' + rd(out, 1) + ' rpm.' };
  }
  if (k === 4){                                     // compound gear train
    const T1 = pk([10, 12, 15, 20]), T2 = pk([30, 40, 45, 60]), T3 = pk([12, 15, 20, 25]), T4 = pk([36, 40, 50, 60, 75]);
    const vr = (T2 / T1) * (T4 / T3);
    const m = ratioMC(vr, [(T1 / T2) * (T3 / T4), T2 / T1 + T4 / T3, (T2 + T4) / (T1 + T3), T4 / T1]);
    return { q:'In a compound gear train, gear 1 (<b>' + T1 + ' teeth</b>) drives gear 2 (<b>' + T2 + '</b>). Gear 3 (<b>' + T3 + '</b>) is on the same shaft as gear 2 and drives gear 4 (<b>' + T4 + '</b>). What is the velocity ratio?',
      choices:m.choices, answer:m.answer, data:{ kind:'gear-compound', T1, T2, T3, T4 },
      note:'Multiply the pairs: (' + T2 + ' ÷ ' + T1 + ') × (' + T4 + ' ÷ ' + T3 + ') = ' + ratioStr(vr) + '.' };
  }
  /* bicycle drive: effort on the pedal, resistance at the rim */
  const r = pk([150, 160, 165, 170, 175]), Tf = pk([38, 42, 44, 46, 48, 50, 52]), Tr = pk([14, 16, 17, 18, 20, 22]), D = pk([600, 622, 650, 675, 700]);
  const F = ri(30, 50) * 10, vr = 2 * r * Tr / (D * Tf), target = pk([0.8, 0.85, 0.88, 0.9, 0.93, 0.95]);
  const R = Math.max(1, Math.round(target * vr * F)), ma = R / F, eta = ma / vr * 100;
  /* slips: leaving the gears out of VR, turning the gear ratio upside down, or quoting MA as a percentage */
  const m = pctMC(eta, [ma / (2 * r / D) * 100, ma / (2 * r * Tf / (D * Tr)) * 100, ma * 100]);
  return { q:'On a bicycle, a vertical force of <b>' + F + ' N</b> on a <b>' + r + ' mm</b> pedal crank just turns the rear wheel (diameter <b>' + D + ' mm</b>) against a resistance of <b>' + R + ' N</b>. ' +
    'The chainwheel has <b>' + Tf + ' teeth</b> and the rear sprocket <b>' + Tr + '</b>. What is the efficiency of the drive?',
    choices:m.choices, answer:m.answer, data:{ kind:'bike', F, r, D, R, Tf, Tr },
    note:'MA = ' + R + ' ÷ ' + F + ' = ' + rd(ma, 3) + '. One turn of the pedals moves the effort 2π × ' + r + ' and turns the wheel ' + Tf + ' ÷ ' + Tr + ' times, moving the load π × ' + D + ' × ' + Tf + '/' + Tr +
      '. VR = (2 × ' + r + ' × ' + Tr + ') ÷ (' + D + ' × ' + Tf + ') = ' + rd(vr, 3) + '. η = MA ÷ VR = ' + rd(eta, 1) + '%.' };
}

/* ── engineering: stress, strain and the tensile test ──────────────────── */
function genStressCalc(){
  const k = ri(0,2);
  if (k === 0){                                     // stress = F / A
    const F = ri(2,40)*500, A = ri(1,20)/10000;     // m²
    const sig = rd(F/A/1e6, 2);                     // MPa
    const m = physMC(sig, 'MPa', [rd(F*A/1e6,2), rd(F/A/1e3,2), rd(A/F,4)]);
    return { q:'A bar of cross-sectional area <b>'+(A*1e4)+' cm²</b> carries a load of <b>'+F+' N</b>. What is the stress?',
      choices:m.choices, answer:m.answer, note:'σ = F/A = '+F+'/'+A+' = '+(F/A/1e6).toFixed(2)+' MPa.' };
  }
  if (k === 1){                                     // strain = e / L
    const L = ri(1,30)/10, e = ri(1,40)/10000;      // m
    const eps = rd(e/L, 5);
    const m = mc(String(eps), [String(rd(L/e,2)), String(rd(e*L,5)), String(rd(eps*10,4))]);
    return { q:'A cable <b>'+L+' m</b> long stretches by <b>'+(e*1000)+' mm</b>. What is the strain?',
      choices:m.choices, answer:m.answer, note:'ε = e/L = '+e+'/'+L+' = '+eps+' (strain has no units).' };
  }
  const eps = ri(5,40)/10000, sig = ri(50,300);
  const E = rd(sig/eps/1000, 0);                    // GPa
  const m = physMC(E, 'GPa', [rd(eps/sig*1000,4), rd(sig*eps,3), rd(E/2,0)]);
  return { q:'A material under <b>'+sig+' MPa</b> shows a strain of <b>'+eps+'</b>. What is its Young’s modulus?',
    choices:m.choices, answer:m.answer, note:'E = σ/ε = '+sig+'/'+eps+' = '+(sig/eps).toFixed(0)+' MPa ≈ '+E+' GPa.' };
}
const TENSILE_C = [
  { n:'Proportional limit', d:'the point up to which stress and strain stay directly proportional, so the graph is a straight line' },
  { n:'Elastic limit', d:'the last point from which the material still returns to its original shape once unloaded' },
  { n:'Upper yield point', d:'where the material suddenly gives and begins to deform plastically' },
  { n:'Lower yield point', d:'the slightly lower stress at which plastic deformation then continues' },
  { n:'Ultimate tensile strength', d:'the greatest stress the material withstands before necking begins' },
  { n:'Necking', d:'the local thinning of the specimen that starts once the maximum stress is passed' },
  { n:'Breaking point', d:'the stress at which the specimen finally fractures' },
  { n:'Work hardening', d:'the strengthening that occurs as a metal is plastically deformed' },
  { n:'Plastic deformation', d:'permanent change of shape that remains after the load is removed' },
  { n:'Elastic deformation', d:'temporary change of shape that reverses completely when unloaded' }
];
function genStress(){
  if (Math.random() < 0.45) return genStressCalc();
  return termQ(TENSILE_C, 'ten',
    r => 'On a stress–strain curve, which point or term is <b>' + r.d + '</b>?',
    r => 'Which of these best describes <b>' + r.n + '</b>?');
}

/* ── engineering: braking systems ──────────────────────────────────────── */
const BRAKES = [
  {q:'A brake works by converting the vehicle’s kinetic energy into…', a:'Heat, through friction', w:['Electrical energy only','Potential energy','Sound alone']},
  {q:'Compared with drum brakes, disc brakes mainly have the advantage of…', a:'Better cooling, so they resist brake fade', w:['Lower cost always','Working without friction','Needing no hydraulic fluid']},
  {q:'Brake fade is caused by…', a:'Overheating that lowers the pads’ grip', w:['Air bubbles trapped in the brake lines','Worn tyres losing grip on the road','Low tyre pressure adding drag'], note:'Hot pads and discs lose friction, so the same pedal force slows the car less.'},
  {q:'Hydraulic brakes work on the principle that…', a:'Pressure in an enclosed fluid acts equally throughout', w:['Force in a fluid fades along a long pipe','A fluid gains pressure as it flows faster','Pressure builds only where the fluid is heated']},
  {q:'Hydraulic fluid is used rather than a gas because liquids are…', a:'Practically incompressible', w:['Much lighter than gases','Easier to compress, for a softer pedal','Better electrical insulators'], note:'So pedal movement goes straight to the brakes instead of squashing the fluid.'},
  {q:'If the master cylinder is smaller in area than the slave cylinder, the system gives…', a:'More force at the slave cylinder', w:['Less force at the slave cylinder','Higher pressure at the slave cylinder','The same force at both cylinders'], note:'Pressure is the same throughout, and force = pressure × area, so the larger slave piston pushes harder.'},
  {q:'A brake disc is usually made of cast iron because it…', a:'Resists wear and absorbs heat well', w:['Is lighter than aluminium alloys','Does not rust in wet weather','Has very high tensile strength']},
  {q:'Brake pads must have a high coefficient of friction and also…', a:'Resist fading and wear at high temperature', w:['Melt easily to lubricate the disc','Conduct electricity','Be perfectly elastic']},
  {q:'Ventilated discs improve braking because they…', a:'Increase the surface area for cooling airflow', w:['Reduce the friction available','Make the disc heavier','Remove the need for pads']},
  {q:'The friction force available at a brake is proportional to…', a:'The normal force on the pad', w:['The speed of the vehicle','The contact area of the pad','The mass of the brake disc'], note:'F = μN. In this model friction does not depend on contact area or speed.'},
  {q:'ABS (anti-lock braking) improves safety mainly by…', a:'Stopping the wheels from locking', w:['Braking before the driver reacts','Increasing the grip of the tyres','Cooling the discs on long descents'], note:'A rolling wheel can still steer; a locked, skidding wheel cannot.'},
  {q:'A handbrake is usually mechanical rather than hydraulic so that it…', a:'Still works if the hydraulic system fails', w:['Is cheaper to make','Applies more force than the footbrake','Works only when moving']},
  {q:'The brake pedal is a lever so that it…', a:'Multiplies the driver’s foot force', w:['Shortens how far the pedal moves','Keeps the brake fluid pressurised','Stops the pedal springing back']},
  {q:'Cars use two independent hydraulic circuits so that…', a:'One leak can’t disable every brake', w:['Each wheel gets a different pressure','The pedal needs half the force','Fluid can be topped up while driving']},
  {q:'A brake booster (servo) uses engine vacuum to…', a:'Reduce the pedal force needed', w:['Cool the fluid on long descents','Lock the wheels more quickly','Store fluid if a line leaks']},
  {q:'A higher coefficient of friction between pad and disc gives…', a:'More braking force for the same pedal', w:['Less braking force for the same pedal','A longer stopping distance','Cooler discs under hard braking']},
  {q:'Brake discs can warp because…', a:'Uneven heating makes them expand unevenly', w:['The brake fluid becomes too thick','The pads are softer than the disc','The disc is too light for the car']},
  {q:'Regenerative braking in an electric vehicle…', a:'Turns kinetic energy back into electricity', w:['Uses larger pads to absorb more heat','Removes the need for friction brakes','Stores the energy as heat in the disc'], note:'The motor runs as a generator and charges the battery, instead of wasting all of the energy as heat.'},
  {q:'Stopping distance is the sum of…', a:'Reaction distance and braking distance', w:['Braking distance only','Reaction distance only','Speed multiplied by mass']},
  {q:'Doubling a vehicle’s speed increases its braking distance by roughly…', a:'Four times', w:['Two times','Three times','Eight times'], note:'Kinetic energy goes with v², so twice the speed means four times the energy to remove.'},
  {q:'Asbestos was removed from brake linings primarily because…', a:'Its dust is a serious health hazard', w:['It wore down too quickly in use','It gave too little friction when wet','It was too costly to mine']}
];

/* ── engineering: engineered products (concepts, not the history) ──────── */
const PRODUCTS = [
  {q:'Guarding the moving parts of a machine, for example enclosing a mower blade, is an example of…', a:'Designing safety into the product', w:['Designing for easier manufacture','Designing for a better appearance','Designing to cut material costs']},
  {q:'A dead-man switch, which stops a machine as soon as the operator lets go, is a…', a:'Fail-safe design feature', w:['Cost-saving measure','Decorative feature','Way to increase speed']},
  {q:'Ergonomics in product design is concerned with…', a:'Fitting the product to the people using it', w:['Choosing the cheapest raw materials','Making the parts as strong as they can possibly be','Speeding up the manufacturing line']},
  {q:'Planned obsolescence means a product is…', a:'Designed to need replacing after a while', w:['Built to last as long as possible','Made entirely from recycled or recyclable material','Designed so it is easy to repair']},
  {q:'Life-cycle analysis of a product considers…', a:'Its impact from raw material to disposal', w:['Only the energy used in the factory to make it','Only its selling price over time','Only how long the warranty lasts']},
  {q:'Choosing a material for a product is mainly a balance between…', a:'Properties, cost and ease of manufacture', w:['Colour, weight and brand image','The designer’s personal preference','Whichever process is the oldest']},
  {q:'Mass production lowers unit cost mainly because…', a:'Setup costs are spread over many items', w:['The materials get stronger when made in bulk','Workers are paid less per hour','Quality checks can be skipped']},
  {q:'Die casting is best suited to…', a:'Many identical, detailed metal parts', w:['One-off metal prototypes','Joining two metal parts together','Hardening a metal surface']},
  {q:'Injection moulding is the standard process for…', a:'Thermoplastic parts in high volume', w:['Cast iron engine blocks','Welded steel frames','Heat-treated alloy gears']},
  {q:'A prototype is built mainly to…', a:'Test the design before production', w:['Sell to the first customers','Replace the finished product','Avoid needing any testing']},
  {q:'Quality control during manufacture exists to…', a:'Catch faults and meet the specification', w:['Push the production line to run as fast as possible','Allow a cheaper material grade','Replace the design stage']},
  {q:'Designing a product so it can be taken apart for repair or recycling is called…', a:'Design for disassembly', w:['Planned obsolescence','Mass production','Reverse engineering']},
  {q:'A tolerance on a dimension specifies…', a:'The allowable variation from the stated size', w:['The exact size every part must be','The strength of the material','The surface finish required']},
  {q:'Standardisation of components means…', a:'Parts come in common, interchangeable sizes', w:['Each part is custom made to fit its own product','Every part is shaped by hand','A design is only ever used once']},
  {q:'Reverse engineering is…', a:'Taking apart a product to see how it was made', w:['Designing a product in reverse order','Recycling a product into raw material','Running a machine backwards to test how it performs']},
  {q:'CAD is mainly valuable in design because it…', a:'Lets designs be changed and tested before building', w:['Removes the need to ever build or test a physical model','Manufactures the part directly','Replaces the need for a designer']},
  {q:'A jig or fixture is used in manufacture to…', a:'Hold the workpiece in the same position', w:['Cut the material to size','Harden the finished surface','Measure each finished part against the drawing']},
  {q:'Anthropometric data is used in design to…', a:'Size products to fit people’s bodies', w:['Calculate the strength of materials','Estimate the cost of production','Choose a suitable colour scheme']},
  {q:'Surface finish matters on a moving part mainly because it affects…', a:'Friction, wear and fatigue life', w:['Only the appearance','The density of the metal','The melting point']},
  {q:'Choosing a recycled or recyclable material mainly improves a product’s…', a:'Environmental impact', w:['Tensile strength','Production speed','Electrical conductivity']},
  {q:'A factor of safety is applied in design to…', a:'Allow for uncertainty in loads and materials', w:['Make the product cheaper to build','Reduce the amount of material the product needs','Speed up the production process']}
];

/* ── engineering: biomedical ───────────────────────────────────────────── */
const BIOMED = [
  {q:'Biocompatibility means a material…', a:'Is not harmful or rejected in the body', w:['Breaks down harmlessly in the body within a few days','Conducts electrical signals well','Is metallic so it can be sterilised']},
  {q:'Titanium is widely used for implants mainly because it is…', a:'Biocompatible, strong and light', w:['The cheapest metal available','Magnetic, so it shows on scans','Softer than the surrounding bone'], note:'It also resists corrosion in body fluids.'},
  {q:'Osseointegration is…', a:'Bone bonding directly to an implant', w:['The body rejecting an implant','An implant corroding over time','Bone being removed to make space for an implant']},
  {q:'Stainless steel used for implants must be…', a:'Highly resistant to corrosion', w:['As hard as possible','Strongly magnetic','Porous all the way through']},
  {q:'A key requirement of a hip-replacement joint is…', a:'Low friction and high wear resistance', w:['High electrical conductivity through the joint','As much weight as possible','A completely rigid joint']},
  {q:'UHMWPE (ultra-high molecular weight polyethylene) is used in joint replacements as the…', a:'Low-friction bearing surface', w:['Load-bearing metal stem','Electrical insulator','Adhesive']},
  {q:'A material used in a heart valve must above all…', a:'Not cause blood to clot', w:['Be as stiff as possible','Dissolve away slowly','Be strongly magnetic']},
  {q:'A major design consideration for a prosthetic limb is…', a:'Being light but strong enough', w:['Being as heavy as possible','Having as many parts as possible','Allowing no movement at all']},
  {q:'Fatigue failure matters in implants because they are…', a:'Loaded millions of times', w:['Never put under any force','Only loaded once in their life','Always made from ceramics']},
  {q:'X-ray imaging works because different tissues…', a:'Absorb X-rays by different amounts', w:['Give off their own X-rays','Reflect X-rays back to the detector at different angles','Glow when struck by visible light'], note:'Bone absorbs the most, so it shows up brightest.'},
  {q:'Ultrasound imaging is generally preferred for a foetus because it…', a:'Uses sound waves rather than ionising radiation', w:['Gives much sharper images than any other method','Is the cheapest possible option','Works through bone easily']},
  {q:'A biomedical engineer’s designs must satisfy medical regulators mainly to ensure…', a:'The device is safe and effective for patients', w:['It is the cheapest option on the market for hospitals','It looks attractive','It can be mass produced']},
  {q:'An implant material must tolerate sterilisation, which usually means withstanding…', a:'Heat, steam or radiation', w:['Being frozen solid','Being painted over','Long exposure to sunlight']},
  {q:'Body fluids are corrosive to metals because they are…', a:'Warm, salty and slightly acidic', w:['Completely chemically inert','Almost pure water','Strongly alkaline']},
  {q:'Stress shielding happens when an implant is…', a:'Much stiffer than the bone', w:['Much weaker than the bone','Made from a soft plastic','Too small for the patient'], note:'The implant carries the load, so the bone around it is under-used and weakens.'},
  {q:'Ceramics such as alumina are used in joints because they are…', a:'Very hard and wear resistant', w:['Very ductile and tough','Good electrical conductors','Easily shaped when cold'], note:'They are brittle, though, so they can crack under impact.'},
  {q:'Shape memory alloys such as nitinol are useful in stents because they…', a:'Return to a set shape when warmed', w:['Dissolve in the bloodstream','Conduct electricity to the heart','Stay magnetised in the body']},
  {q:'A dialysis machine substitutes for the kidneys by…', a:'Filtering waste products out of the blood', w:['Pumping blood around the body in place of the heart','Adding oxygen to the blood','Replacing bone marrow']},
  {q:'A pacemaker works by…', a:'Sending timed electrical pulses to the heart', w:['Pumping blood with a small motor attached to the heart','Replacing a damaged heart valve','Filtering waste out of the blood']},
  {q:'MRI is often preferred over CT for soft tissue because it…', a:'Shows soft tissue better, without X-rays', w:['Is always much faster than CT','Uses stronger X-rays than CT to see through tissue','Only produces images of bone']},
  {q:'The main reason an implant may be rejected is…', a:'The immune system attacking it', w:['The implant being too light','The implant being sterilised','The patient being too young']}
];
function genBrakes(){ return bankQ(BRAKES, 'brk'); }
function genProducts(){ return bankQ(PRODUCTS, 'prd'); }
function genBiomed(){ return bankQ(BIOMED, 'bio'); }

BUILD.software = host => revGame(host, { title:'Software', how:'Pick one of the three Year 11 modules, or do the lot.', statKey:'software',
  modules:[
    {id:'fund',name:'Fundamentals',topics:[
      {id:'sf-dev',name:'Development steps',gen:genDevStep},
      {id:'sf-alg',name:'Algorithms',gen:genAlgo},
      {id:'sf-data',name:'Data types & structures',gen:genDataType},
      {id:'sf-num',name:'Number systems',gen:genNumber},
      {id:'sf-test',name:'Testing & debugging',gen:genTestDebug}]},
    {id:'oop',name:'OOP',topics:[
      {id:'so-con',name:'Key features',gen:genOOP},
      {id:'so-par',name:'Paradigms',gen:genParadigm},
      {id:'so-des',name:'Design & quality',gen:genOopDesign}]},
    {id:'mech',name:'Mechatronics',topics:[
      {id:'sm-hw',name:'Hardware & sensors',gen:genMechHw},
      {id:'sm-ctl',name:'Control systems',gen:genMechControl}]},
    {id:'read',name:'Read code',topics:[{id:'s-out',name:'Predict output',gen:genPython}]},
    /* `gate`: in a test, Medium is only set once Easy is right, and Hard once
       Medium is, so nobody sits through five minutes of a task they can't start */
    {id:'write',name:'Write code',topics:[
      {id:'s-e',name:'Easy',gen:()=>genWrite(1)},
      {id:'s-m',name:'Medium',gen:()=>genWrite(2),gate:'s-e'},
      {id:'s-h',name:'Hard',gen:()=>genWrite(3),gate:'s-m'}]}
  ] });
BUILD.maths = host => revGame(host, { title:'Maths', how:'Pick a topic. The questions are generated, so they never run out.', statKey:'maths',
  topics:[{id:'concepts',name:'Concepts',gen:()=>Math.random()<0.35?bankQ(MATH_CONCEPTS,'mcn'):genMathTerm()},{id:'diff',name:'Differentiation',gen:genDiff},{id:'int',name:'Integration',gen:genInt},{id:'comb',name:'Combinatorics',gen:genComb},{id:'graph',name:'Graph transforms',gen:genGraph}] });
BUILD.chem = host => revGame(host, { title:'Chemistry', how:'Pick a module, or do all four.', statKey:'chem',
  modules:[
    {id:'m1',name:'Module 1',topics:[{id:'c-name',name:'Naming',gen:genChemName},{id:'c-mix',name:'Mixtures & separation',gen:genSeparation},{id:'c-iso',name:'Isotopes & Ar',gen:genChemIso},{id:'c-econf',name:'Electron config',gen:genChemEconfig},{id:'c-shape',name:'Bonding & shape',gen:genChemShape},{id:'c-lewis',name:'Lewis diagrams',gen:genLewis}]},
    {id:'m2',name:'Module 2',topics:[{id:'c-mole',name:'Moles & mass',gen:genChemMoles},{id:'c-bal',name:'Balancing equations',gen:genBalance},{id:'c-gas',name:'Gas laws',gen:genGasLaw},{id:'c-lim',name:'Limiting reagent',gen:genChemLimiting},{id:'c-emp',name:'Empirical formula',gen:genChemEmp},{id:'c-soln',name:'Solutions & gases',gen:genChemSol2}]},
    {id:'m3',name:'Module 3',topics:[{id:'c-type',name:'Reaction types',gen:genChemType},{id:'c-rate',name:'Reaction rates',gen:genRates},{id:'c-act',name:'Activity series',gen:genActivity},{id:'c-redox',name:'Redox',gen:genRedox},{id:'c-galv',name:'Galvanic cells',gen:genGalvanic},{id:'c-sol',name:'Solubility',gen:genSol}]},
    {id:'m4',name:'Module 4',topics:[{id:'c-cal',name:'Calorimetry',gen:genCalor},{id:'c-enp',name:'Energy & entropy',gen:genEnergyProfile},{id:'c-bond',name:'Bond energies',gen:genBondE},{id:'c-form',name:'Enthalpy of formation',gen:genFormation},{id:'c-gibbs',name:'Entropy & Gibbs',gen:genGibbs}]}
  ] });
BUILD.physics = host => revGame(host, { title:'Physics', how:'Pick a module, or do all four.', statKey:'physics',
  modules:[
    {id:'m1',name:'Kinematics',topics:[{id:'p-kc',name:'Concepts',gen:()=>Math.random()<0.4?bankQ(PHYS_KIN,'kin'):genPhysQuant('kin')},{id:'p-suvat',name:'Equations of motion',gen:genSuvat},{id:'p-kin',name:'Acceleration',gen:genKinematics},{id:'p-vec',name:'Vectors',gen:genVectors},{id:'p-rel',name:'Relative velocity',gen:genRelVel}]},
    {id:'m2',name:'Dynamics',topics:[{id:'p-dc',name:'Concepts',gen:()=>Math.random()<0.4?bankQ(PHYS_DYN,'dyn'):genPhysQuant('dyn')},{id:'p-newt',name:'Newton’s 2nd law',gen:genNewton},{id:'p-fric',name:'Friction',gen:genFriction},{id:'p-energy',name:'Energy & work',gen:genEnergy},{id:'p-mom',name:'Momentum',gen:genMomentum}]},
    {id:'m3',name:'Waves & thermodynamics',topics:[{id:'p-thermo',name:'Thermodynamics',gen:genThermo},{id:'p-wc',name:'Concepts',gen:()=>{const r=Math.random();return r<0.3?bankQ(PHYS_WAVE,'wave'):r<0.62?bankQ(WAVE_EXTRA,'wavex'):genPhysQuant('wave');}},{id:'p-wave',name:'Wave equation',gen:genWaves},{id:'p-sound',name:'Sound & echoes',gen:genSound},{id:'p-super',name:'Superposition',gen:genSuper},{id:'p-snell',name:'Reflection & refraction',gen:genSnell},{id:'p-em',name:'EM spectrum',gen:genEM}]},
    {id:'m4',name:'Electricity & magnetism',topics:[{id:'p-ec',name:'Concepts',gen:()=>{const r=Math.random();return r<0.3?bankQ(PHYS_EM,'em'):r<0.62?bankQ(EM_EXTRA,'emx'):genPhysQuant('em');}},{id:'p-ohm',name:'Ohm’s law & power',gen:genOhm},{id:'p-res',name:'Resistors',gen:genResistors},{id:'p-efield',name:'Electric fields',gen:genEfield},{id:'p-mag',name:'Magnetism',gen:genMag}]}
  ] });
BUILD.engineering = host => revGame(host, { title:'Engineering', how:'Pick a module, or do all five.', statKey:'engineering',
  modules:[
    {id:'steel',name:'Steels',topics:[
      {id:'e-steel',name:'Carbon steels',gen:genSteelFact},
      {id:'e-carb',name:'Carbon & pearlite',gen:genCarbonFact},
      {id:'e-iron',name:'Cast irons',gen:genIronFact}]},
    {id:'heat',name:'Heat treatment',topics:[
      {id:'e-treat',name:'Processes',gen:genTreatFact}]},
    {id:'struct',name:'Structure & properties',topics:[
      {id:'e-phase',name:'Phases & constituents',gen:genPhaseFact},
      {id:'e-prop',name:'Mechanical properties',gen:genPropFact}]},
    {id:'mech',name:'Mechanics',topics:[
      {id:'e-mom',name:'Moments',gen:genMomentsAll},
      {id:'e-couple',name:'Couples',gen:genCouple},
      {id:'e-lever',name:'Levers',gen:genLevers},
      {id:'e-gear',name:'Pulleys & gears',gen:genPulleyGear},
      {id:'e-mach',name:'Machines & efficiency',gen:genMachines},
      {id:'e-stress',name:'Stress & strain',gen:genStress}]},
    {id:'app',name:'Applications',topics:[
      {id:'e-brk',name:'Braking systems',gen:genBrakes},
      {id:'e-prd',name:'Engineered products',gen:genProducts},
      {id:'e-bio',name:'Biomedical',gen:genBiomed}]}
  ] });

showGrid();
