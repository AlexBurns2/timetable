/* ══════════════════════════════════════════════════════════════════════════
   STUDY TRACKER: tasks for each subject, and a timer to time them

   Loaded on the revision page only, after study.js and before games.js. It only
   defines things: Study.area() (study.js) puts Tracker.render() at the top of
   the revision page's study area, and showGrid() (games.js) draws that.

   The subjects are your timetable's (the cached copy, only when it is your own),
   remembered in the data so a phone with no timetable cache still has them;
   with neither, the revision subjects of the year shown. Subjects can also be
   added by hand.

   Storage is one tt.* key, so it follows the account like tt.focus: a timer
   started on a laptop is running on the phone too. It rides the settings blob,
   which /api/prefs caps at 100 KB for everything together, so it is short-keyed
   and pruned (log 21 days, done tasks 14 days, at most 200 tasks):
     tt.study = {
       v:1, at:<ms of the last change>,
       n:{ <subject id>:<name> },        subjects added by hand, or not on the timetable but used
       y:[<name>],                        the timetable's subjects, last seen
       k:[{ i, s, x, d?, m?, t? }],       tasks: id, subject id, text, done (yyyymmdd),
                                          target minutes last used, seconds timed
       r:{ s, i?, a, e, m?, z? },         the one timer: subject, task, started at (ms; 0 while
                                          paused), ms already counted, target minutes, finished at
       l:{ <yyyymmdd>:{ <subject id>:<seconds> } }   time per subject per day
     }
   Only start/pause/stop and edits write it, never the ticking clock: the time is
   worked out from the start stamp, so it survives reloads, page changes and a
   closed laptop. A timer with a target stops itself at the target (counted up
   to exactly then, even if the page was closed); one without stops after four
   hours, so a forgotten one can't fill the week.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const KEY = 'tt.study';
const OPEN_KEY = 'msc.trkopen';            // which subjects are expanded: this device only, not synced
const MAX_TASKS = 200, MAX_TEXT = 120, MAX_NAME = 40;
const LOG_DAYS = 21, DONE_DAYS = 14;
const CAP_MS = 4 * 3600e3;
const SUGGEST = [25, 45, 60];

const grab = f => { try { return f(); } catch { return null; } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ic = n => (window.Icon && Icon.svg ? Icon.svg(n) : '');
const BASE_TITLE = document.title;

/* ── dates and times ── */
const dk = t => { const d = new Date(t); return String(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()); };
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const nextMidnight = t => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); };
const mondayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
function weekKeys(){
  const out = [], d = new Date(mondayStart()); d.setHours(12);
  for (const today = dk(Date.now()); out.length < 7; d.setDate(d.getDate() + 1)){ const k = dk(d.getTime()); out.push(k); if (k === today) break; }
  return out;
}
const two = n => String(n).padStart(2, '0');
function clock(ms, up){
  const s = Math.max(0, up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? h + ':' + two(m) + ':' + two(x) : m + ':' + two(x);
}
const mins = m => m + (m === 1 ? ' minute' : ' minutes');
function dur(sec){
  const m = Math.floor(sec / 60);
  if (m < 1) return sec >= 1 ? 'under 1 min' : '0 min';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : m + ' min';
}

/* ── the data ── */
function clean(x){
  const o = { v:1, at:0, n:{}, y:[], k:[], r:null, l:{} };
  if (!x || typeof x !== 'object') return o;
  o.at = +x.at || 0;
  if (x.n && typeof x.n === 'object') for (const id in x.n) if (typeof x.n[id] === 'string') o.n[id] = x.n[id].slice(0, MAX_NAME);
  if (Array.isArray(x.y)) o.y = x.y.filter(s => typeof s === 'string').slice(0, 24);
  if (Array.isArray(x.k)) o.k = x.k.filter(t => t && typeof t.i === 'string' && typeof t.s === 'string' && typeof t.x === 'string');
  if (x.r && typeof x.r === 'object' && typeof x.r.s === 'string') o.r = { s:x.r.s, a:+x.r.a || 0, e:+x.r.e || 0 };
  if (o.r){ if (typeof x.r.i === 'string') o.r.i = x.r.i; if (+x.r.m > 0) o.r.m = +x.r.m; if (+x.r.z > 0) o.r.z = +x.r.z; }
  if (x.l && typeof x.l === 'object') for (const d in x.l) if (/^\d{8}$/.test(d) && x.l[d] && typeof x.l[d] === 'object') o.l[d] = x.l[d];
  return o;
}
const load = () => clean(window.TT ? TT.get(KEY, null) : null);
let D = load();

function prune(){
  const cut = dk(Date.now() - LOG_DAYS * 864e5), dcut = +dk(Date.now() - DONE_DAYS * 864e5);
  Object.keys(D.l).forEach(d => { if (d < cut) delete D.l[d]; });
  D.k = D.k.filter(t => !t.d || t.d >= dcut || (D.r && D.r.i === t.i));
}
function save(){
  prune();
  const tt = timetableSubjects();
  if (tt && tt.join('|') !== D.y.join('|')) D.y = tt;
  D.at = Date.now();
  const o = { v:1, at:D.at };
  if (Object.keys(D.n).length) o.n = D.n;
  if (D.y.length) o.y = D.y;
  if (D.k.length) o.k = D.k;
  if (D.r) o.r = D.r;
  if (Object.keys(D.l).length) o.l = D.l;
  TT.set(KEY, o);
}
/* every change: start from what is saved (another tab may have written), change, save, redraw */
function mutate(fn){ D = load(); const r = fn(); if (r !== false){ save(); refresh(); } }

const uid = () => { let id; do { id = Math.random().toString(36).slice(2, 8); } while (D.k.some(t => t.i === id)); return id; };
const sid = n => String(n || '').toLowerCase().replace(/\bmathematics\b/g, 'maths').replace(/\bstudies\b/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
const tidy = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/* ── subjects ── */
const cleanName = name => String(name || '')
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, '')
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, '')
  .replace(/^[\s:\-–—]+/, '').trim();
/* your own timetable's subjects, from the cached copy (as Notes does), or null */
function timetableSubjects(){
  const c = TT.get('tt.cache', null), cr = TT.get('tt.creds', null);
  const user = e => String(e || '').toLowerCase().split('@')[0];
  if (!c || !c.payload || !Array.isArray(c.payload.timetable) || !cr || !cr.email || user(c.email) !== user(cr.email)) return null;
  const out = [];
  c.payload.timetable.forEach(r => {
    if (!r || !r.ClassCode || /assembly|recess|lunch|roll/i.test((r.Period || '') + ' ' + (r.CourseName || ''))) return;
    const n = cleanName(r.CourseName).slice(0, MAX_NAME);
    if (n && sid(n) && !/^(private )?study$/i.test(n) && !out.includes(n)) out.push(n);
  });
  return out.length ? out.sort((a, b) => a.localeCompare(b)) : null;
}
const revGames = () => (grab(() => GAMES) || []).filter(g => g.cat === 'Revision' && !/^(flashcards|mockhsc)$/.test(g.id));
const yearNow = () => grab(() => yearShown()) || 12;
function subjects(){
  const base = timetableSubjects() || (D.y.length ? D.y : revGames().filter(g => (g.year || 11) === yearNow()).map(g => g.name));
  const map = new Map();
  base.forEach(n => { const id = sid(n); if (id && !map.has(id)) map.set(id, { id, name:n, fixed:true }); });
  Object.keys(D.n).forEach(id => { if (!map.has(id)) map.set(id, { id, name:D.n[id], fixed:false }); });
  D.k.forEach(t => { if (!map.has(t.s)) map.set(t.s, { id:t.s, name:t.s, fixed:false }); });
  if (D.r && !map.has(D.r.s)) map.set(D.r.s, { id:D.r.s, name:D.r.s, fixed:false });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
let SUBS = null;                            // the list as last drawn
const subjName = id => { const s = (SUBS || subjects()).find(x => x.id === id); return s ? s.name : id; };
/* keep a subject that has data, even after it drops off the timetable (Notes does the same) */
function remember(id){ if (!D.n[id]){ const s = subjects().find(x => x.id === id); if (s) D.n[id] = s.name; } }
/* the revision subject that matches, for the Practise button: the year shown first */
function quizFor(name){
  const G = revGames(), yr = yearNow(), c = sid(name);
  const same = g => (g.year || 11) === yr;
  const tests = [g => same(g) && sid(g.name) === c, g => same(g) && c.startsWith(sid(g.name) + '-'),
                 g => !same(g) && sid(g.name) === c, g => !same(g) && c.startsWith(sid(g.name) + '-')];
  for (const t of tests){ const g = G.find(t); if (g) return g; }
  return null;
}

/* ── the timer ── */
const stopAt = r => r.a + (r.m ? r.m * 60000 : CAP_MS) - r.e;          // when this stretch ends by itself
const elapsed = r => r.e + (r.a ? Math.max(0, Math.min(Date.now(), stopAt(r)) - r.a) : 0);
const running = () => !!(D.r && D.r.a);
/* count the running stretch: into the day log (split at midnight) and the task */
function bank(r, end){
  if (!r.a) return;
  end = Math.min(end, stopAt(r));
  const ms = Math.max(0, end - r.a);
  for (let t0 = r.a; t0 < end;){
    const t1 = Math.min(end, nextMidnight(t0)), L = D.l[dk(t0)] || (D.l[dk(t0)] = {});
    L[r.s] = Math.round((+L[r.s] || 0) + (t1 - t0) / 1000);
    t0 = t1;
  }
  const task = r.i && D.k.find(t => t.i === r.i);
  if (task && ms) task.t = Math.round((task.t || 0) + ms / 1000);
  r.e += ms; r.a = 0;
}
function start(s, i){
  const now = Date.now();
  if (D.r && D.r.a) bank(D.r, now);
  const task = i && D.k.find(t => t.i === i);
  D.r = { s, a:now, e:0 };
  if (task){ D.r.i = i; if (task.m) D.r.m = task.m; }
  remember(s);
}
/* has the running timer reached its end? `live`: it happened while the page was open */
function check(live){
  if (!D.r || !D.r.a || Date.now() < stopAt(D.r)) return;
  D = load();
  const R = D.r;
  if (!R || !R.a || Date.now() < stopAt(R)){ refresh(); return; }       // another tab got there first
  const end = stopAt(R);
  bank(R, end);
  if (R.m) R.z = end;
  save(); refresh();
  if (R.m && live){
    const task = R.i && D.k.find(t => t.i === R.i);
    grab(() => SFX.win());
    grab(() => say(mins(R.m) + ' done on ' + (task ? task.x : subjName(R.s)) + '.'));
  }
}

/* ── per-subject and overall totals, in seconds, with the running stretch ── */
function totals(id){
  const today = dk(Date.now()), week = weekKeys();
  const sum = d => { const L = D.l[d] || {}; return id ? (+L[id] || 0) : Object.values(L).reduce((a, b) => a + (+b || 0), 0); };
  let t = sum(today), w = week.reduce((a, d) => a + sum(d), 0);
  const r = D.r;
  if (r && r.a && (!id || r.s === id)){
    const now = Math.min(Date.now(), stopAt(r));
    t += Math.max(0, now - Math.max(r.a, dayStart(Date.now()))) / 1000;
    w += Math.max(0, now - Math.max(r.a, mondayStart())) / 1000;
  }
  return { t, w };
}
const taskSecs = task => (task.t || 0) + (D.r && D.r.a && D.r.i === task.i ? Math.max(0, Math.min(Date.now(), stopAt(D.r)) - D.r.a) / 1000 : 0);

/* ── what is expanded (this device) ── */
function openSet(){
  try { const v = JSON.parse(localStorage.getItem(OPEN_KEY)); if (Array.isArray(v)) return new Set(v); } catch {}
  return new Set(D.r ? [D.r.s] : []);                           // until you open or close one: all closed but the timer's
}
function setOpen(id, on){
  const s = openSet(); on ? s.add(id) : s.delete(id);
  try { localStorage.setItem(OPEN_KEY, JSON.stringify([...s].slice(0, 40))); } catch {}
}

/* ── drawing ── */
let ROOT = null, editing = null, addingSubject = false, note = '', rmArm = null;

const totText = () => { const T = totals(); return T.t || T.w ? 'Today <b>' + dur(T.t) + '</b> · This week <b>' + dur(T.w) + '</b>' : ''; };
function subMeta(id){
  const n = D.k.filter(t => t.s === id && !t.d).length, T = totals(id), parts = [];
  if (n) parts.push(n + (n === 1 ? ' task' : ' tasks'));
  if (T.t) parts.push(dur(T.t) + ' today');
  if (T.w > T.t) parts.push(dur(T.w) + ' this week');
  return esc(parts.join(' · '));
}
const taskTime = task => { const s = taskSecs(task); return s >= 60 ? dur(s) : ''; };
function clockText(r){
  return r.m ? clock(r.m * 60000 - elapsed(r), true) : clock(elapsed(r));
}
function clockLabel(r){
  if (r.m) return (r.a ? 'left of ' : 'paused, left of ') + r.m + ' min';
  return r.a ? '' : 'paused';
}
const barPct = r => r.m ? Math.min(100, elapsed(r) / (r.m * 600)).toFixed(1) : 0;

function runCard(){
  const r = D.r; if (!r) return '';
  const task = r.i && D.k.find(t => t.i === r.i);
  const what = '<div class="trk-rl"><span class="trk-rs">' + esc(subjName(r.s)) + '</span>' +
    (task ? '<span class="trk-rx">' + esc(task.x) + '</span>' : '') + '</div>';
  if (r.z){
    const when = Date.now() - r.z > 120000 ? ' at ' + fmtTime(new Date(r.z)) : '';
    return '<div class="trk-run done" role="status">' + what +
      '<p class="trk-msg">' + mins(r.m) + ' done' + esc(when) + '.</p>' +
      '<div class="trk-rb">' +
        '<button type="button" class="btn primary" data-act="again" data-fk="again">' + ic('play') + 'Another ' + r.m + ' min</button>' +
        (task && !task.d ? '<button type="button" class="btn" data-act="markdone" data-fk="markdone">Mark task done</button>' : '') +
        '<button type="button" class="btn" data-act="close" data-fk="close">Close</button>' +
      '</div></div>';
  }
  const f = window.Focus && Focus.active && Focus.active();
  return '<div class="trk-run' + (r.a ? '' : ' paused') + '">' + what +
    '<div class="trk-rc"><span class="trk-clock" data-live="clock">' + clockText(r) + '</span>' +
      '<span class="trk-of" data-live="label">' + esc(clockLabel(r)) + '</span>' +
      '<span class="trk-rb">' +
        (r.a ? '<button type="button" class="btn" data-act="pause" data-fk="pause">' + ic('pause') + 'Pause</button>'
             : '<button type="button" class="btn primary" data-act="resume" data-fk="resume">' + ic('play') + 'Resume</button>') +
        '<button type="button" class="btn" data-act="stop" data-fk="stop">' + ic('stop') + 'Stop</button>' +
      '</span></div>' +
    (r.m ? '<div class="trk-bar"><i data-live="bar" style="width:' + barPct(r) + '%"></i></div>' : '') +
    '<div class="trk-tg"><label class="trk-tgl">Target <input type="number" inputmode="numeric" min="1" max="600" step="1" placeholder="none" ' +
      'value="' + (r.m || '') + '" data-chg="target" data-fk="target" aria-label="Target in minutes"> min</label>' +
      '<span class="trk-chips">' + SUGGEST.map(m => '<button type="button" class="trk-chip diffpill" data-act="tg" data-m="' + m + '" aria-pressed="' + (r.m === m) + '" data-fk="tg' + m + '">' + m + '</button>').join('') + '</span>' +
      (r.m && r.a && !f && window.Focus ? '<button type="button" class="trk-link" data-act="focus" data-fk="focus">Lock the games until it ends</button>' : '') +
    '</div></div>';
}
function fmtTime(d){ const h = d.getHours(); return ((h + 11) % 12 + 1) + ':' + two(d.getMinutes()) + (h < 12 ? ' am' : ' pm'); }

function taskRow(task){
  const r = D.r, on = r && r.i === task.i && !r.z, live = on && r.a;
  if (editing === task.i){
    return '<li class="trk-task editing"><form class="trk-ed" data-i="' + esc(task.i) + '">' +
      '<input type="text" name="x" value="' + esc(task.x) + '" maxlength="' + MAX_TEXT + '" aria-label="Task" data-fk="ed:' + esc(task.i) + '" enterkeyhint="done" autocomplete="off">' +
      '<span class="trk-edb"><button type="submit" class="btn primary">Save</button>' +
      '<button type="button" class="btn danger" data-act="del" data-i="' + esc(task.i) + '">Delete</button>' +
      '<button type="button" class="btn" data-act="cancel">Cancel</button></span></form></li>';
  }
  const tm = taskTime(task);
  return '<li class="trk-task' + (task.d ? ' done' : '') + (on ? ' on' : '') + '">' +
    '<input type="checkbox" class="trk-cb" data-chg="tick" data-i="' + esc(task.i) + '"' + (task.d ? ' checked' : '') +
      ' aria-label="Done: ' + esc(task.x) + '" data-fk="cb:' + esc(task.i) + '">' +
    '<button type="button" class="trk-tx" data-act="edit" data-i="' + esc(task.i) + '" title="Edit" data-fk="tx:' + esc(task.i) + '">' + esc(task.x) + '</button>' +
    '<span class="trk-tt" data-live="task" data-i="' + esc(task.i) + '">' + tm + '</span>' +
    (task.d ? '' : '<button type="button" class="trk-ib' + (live ? ' on' : '') + '" data-act="go" data-s="' + esc(task.s) + '" data-i="' + esc(task.i) + '" data-fk="go:' + esc(task.i) + '"' +
      ' aria-label="' + (live ? 'Pause' : 'Start a timer for') + ' ' + esc(task.x) + '" title="' + (live ? 'Pause' : 'Start timer') + '">' + ic(live ? 'pause' : 'play') + '</button>') +
    '</li>';
}

function subjectBlock(s, open){
  const r = D.r, live = r && r.s === s.id && !r.i && r.a && !r.z;
  const tasks = D.k.filter(t => t.s === s.id);
  const todo = tasks.filter(t => !t.d), done = tasks.filter(t => t.d).sort((a, b) => b.d - a.d);
  const q = open ? quizFor(s.name) : null;
  const has = r && r.s === s.id && !r.z && (r.a || r.e);
  let h = '<li class="trk-sub' + (open ? ' open' : '') + (has ? ' on' : '') + '" data-s="' + esc(s.id) + '">' +
    '<div class="trk-sh"><button type="button" class="trk-st" data-act="toggle" data-s="' + esc(s.id) + '" aria-expanded="' + open + '" data-fk="tog:' + esc(s.id) + '">' +
      '<span class="trk-car">' + ic('caret-right') + '</span><span class="trk-sn">' + esc(s.name) + '</span>' +
      '<span class="trk-sm" data-live="sub" data-s="' + esc(s.id) + '">' + subMeta(s.id) + '</span></button>' +
    '<button type="button" class="trk-ib' + (live ? ' on' : '') + '" data-act="go" data-s="' + esc(s.id) + '" data-fk="go:' + esc(s.id) + '"' +
      ' aria-label="' + (live ? 'Pause' : 'Start a timer for') + ' ' + esc(s.name) + '" title="' + (live ? 'Pause' : 'Start timer') + '">' + ic(live ? 'pause' : 'play') + '</button></div>';
  if (open){
    h += '<div class="trk-body">' +
      (todo.length || done.length ? '<ul class="trk-tasks">' + todo.concat(done).map(taskRow).join('') + '</ul>' : '') +
      '<form class="trk-add" data-s="' + esc(s.id) + '"><input type="text" name="x" maxlength="' + MAX_TEXT + '" placeholder="Add a task" aria-label="Add a task for ' + esc(s.name) + '"' +
        ' data-fk="add:' + esc(s.id) + '" enterkeyhint="done" autocomplete="off">' +
        '<button type="submit" class="btn icon" aria-label="Add" title="Add">' + ic('plus') + '</button></form>' +
      (q || done.length || !s.fixed ? '<div class="trk-foot">' +
        (q ? '<button type="button" class="trk-link" data-act="practise" data-g="' + esc(q.id) + '">Practise ' + esc(q.name) + '</button>' : '') +
        (done.length ? '<button type="button" class="trk-link" data-act="cleardone" data-s="' + esc(s.id) + '">Clear done (' + done.length + ')</button>' : '') +
        (!s.fixed ? '<button type="button" class="trk-link danger" data-act="rmsub" data-s="' + esc(s.id) + '">' + (rmArm === s.id ? 'Tap again to remove' : 'Remove subject') + '</button>' : '') +
      '</div>' : '') +
    '</div>';
  }
  return h + '</li>';
}

function draw(){
  if (!ROOT) return;
  const ae = document.activeElement, fk = ae && ROOT.contains(ae) && ae.dataset ? ae.dataset.fk : null;
  const sel = fk && ae.type === 'text' ? [ae.selectionStart, ae.selectionEnd] : null;
  const typed = {};
  ROOT.querySelectorAll('input[data-fk]:not([type="checkbox"])').forEach(i => { if (i.value !== i.defaultValue) typed[i.dataset.fk] = i.value; });
  const subs = SUBS = subjects(), open = openSet();
  const fresh = !D.k.length && !Object.keys(D.l).length && !D.r;
  ROOT.innerHTML =
    '<div class="trk-head"><h3>Study tracker</h3><span class="trk-tot" data-live="tot">' + totText() + '</span></div>' +
    (fresh ? '<p class="trk-hint">Open a subject to add tasks. The play button times it, with a target if you want one.</p>' : '') +
    runCard() +
    (note ? '<p class="trk-note" role="status">' + esc(note) + '</p>' : '') +
    '<ul class="trk-subs">' + subs.map(s => subjectBlock(s, open.has(s.id))).join('') + '</ul>' +
    (addingSubject
      ? '<form class="trk-add trk-addsub"><input type="text" name="x" maxlength="' + MAX_NAME + '" placeholder="Subject name" aria-label="Subject name" data-fk="addsub" autocomplete="off" enterkeyhint="done">' +
        '<button type="submit" class="btn">Add</button><button type="button" class="btn" data-act="nosub">Cancel</button></form>'
      : '<div class="trk-foot"><button type="button" class="trk-link" data-act="addsub" data-fk="addsubbtn">' + ic('plus') + 'Add a subject</button></div>');
  for (const k in typed){ const i = ROOT.querySelector('input[data-fk="' + CSS.escape(k) + '"]'); if (i) i.value = typed[k]; }
  if (fk){
    const el = ROOT.querySelector('[data-fk="' + CSS.escape(fk) + '"]');
    if (el){ try { el.focus({ preventScroll:true }); if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
}
/* the parts that change by the second, without redrawing (so nothing loses focus) */
function live(){
  const r = D.r;
  document.querySelectorAll('.trk [data-live], .trkmini [data-live]').forEach(el => {
    const k = el.dataset.live;
    if (k === 'tot') el.innerHTML = totText();
    else if (k === 'sub') el.innerHTML = subMeta(el.dataset.s);
    else if (k === 'task'){ const t = D.k.find(x => x.i === el.dataset.i); if (t) el.textContent = taskTime(t); }
    else if (!r || r.z) return;
    else if (k === 'clock') el.textContent = clockText(r);
    else if (k === 'label') el.textContent = clockLabel(r);
    else if (k === 'bar') el.style.width = barPct(r) + '%';
  });
}
function title(){
  const r = D.r;
  if (!r || (!r.a && !r.z)){ if (document.title !== BASE_TITLE) document.title = BASE_TITLE; return; }
  document.title = r.z ? 'Time’s up · ' + subjName(r.s) + ' · ' + BASE_TITLE : clockText(r) + ' · ' + subjName(r.s) + ' · ' + BASE_TITLE;
}

/* a slim line over an open quiz while a timer is going, so it is not out of sight */
function mini(){
  const st = document.getElementById('gamestage');
  if (!st) return;
  let m = document.getElementById('trkmini');
  const r = D.r;
  if (!r || st.hidden || !document.body.dataset.page || document.body.dataset.page !== 'revision'){ if (m) m.remove(); return; }
  if (!m){
    m = document.createElement('div'); m.id = 'trkmini'; m.className = 'trkmini';
    m.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b); });
    st.insertBefore(m, st.firstChild);
  }
  const label = esc(subjName(r.s));
  m.classList.toggle('done', !!r.z);
  m.innerHTML = r.z
    ? '<span class="trkm-t">' + mins(r.m) + ' done · ' + label + '</span><button type="button" class="trk-link" data-act="close">Close</button>'
    : '<span class="trkm-t"><b data-live="clock">' + clockText(r) + '</b> ' + label + '</span>' +
      '<button type="button" class="trk-ib' + (r.a ? ' on' : '') + '" data-act="' + (r.a ? 'pause' : 'resume') + '" aria-label="' + (r.a ? 'Pause' : 'Resume') + '" title="' + (r.a ? 'Pause' : 'Resume') + '">' + ic(r.a ? 'pause' : 'play') + '</button>';
}

let iv = null;
function tick(){ check(true); live(); title(); }
function refresh(){
  draw(); mini(); title();
  const need = running();
  if (need && !iv) iv = setInterval(tick, 1000);
  if (!need && iv){ clearInterval(iv); iv = null; }
}

/* ── actions ── */
function act(b){
  const a = b.dataset.act, s = b.dataset.s, i = b.dataset.i;
  if (a !== 'rmsub') rmArm = null;
  note = '';
  switch (a){
    case 'toggle': { const on = !openSet().has(s); setOpen(s, on); draw(); return; }
    case 'go': return mutate(() => {
      const r = D.r, same = r && r.s === s && (r.i || null) === (i || null) && !r.z;
      if (same && r.a) bank(r, Date.now());
      else if (same) r.a = Date.now();
      else start(s, i);
    });
    case 'pause': return mutate(() => { if (!D.r || !D.r.a) return false; bank(D.r, Date.now()); });
    case 'resume': return mutate(() => { if (!D.r || D.r.a || D.r.z) return false; D.r.a = Date.now(); });
    case 'stop': case 'close': return mutate(() => { if (!D.r) return false; if (D.r.a) bank(D.r, Date.now()); D.r = null; });
    case 'again': return mutate(() => { const r = D.r; if (!r) return false; D.r = { s:r.s, a:Date.now(), e:0 }; if (r.i) D.r.i = r.i; if (r.m) D.r.m = r.m; });
    case 'markdone': return mutate(() => { const r = D.r, t = r && r.i && D.k.find(x => x.i === r.i); if (!t) return false; t.d = +dk(Date.now()); D.r = null; });
    case 'tg': return setTarget(D.r && D.r.m === +b.dataset.m ? 0 : +b.dataset.m);
    case 'focus': {                                    // focus mode (study.js) for what is left of the target
      const r = D.r;
      if (!window.Focus || Focus.active() || !r || !r.m) return;
      Focus.start(Math.max(1, Math.ceil((r.m * 60000 - elapsed(r)) / 60000)));
      grab(() => showGrid());
      return;
    }
    case 'edit': editing = i; draw(); { const el = ROOT.querySelector('.trk-ed input'); if (el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } } return;
    case 'cancel': editing = null; draw(); return;
    case 'del': editing = null; return mutate(() => {
      if (D.r && D.r.i === i){ if (D.r.a) bank(D.r, Date.now()); D.r = null; }
      D.k = D.k.filter(t => t.i !== i);
    });
    case 'cleardone': return mutate(() => { D.k = D.k.filter(t => !(t.s === s && t.d && !(D.r && D.r.i === t.i))); });
    case 'rmsub':
      if (rmArm !== s){ rmArm = s; draw(); setTimeout(() => { if (rmArm === s){ rmArm = null; draw(); } }, 4000); return; }
      rmArm = null;
      return mutate(() => {
        if (D.r && D.r.s === s){ if (D.r.a) bank(D.r, Date.now()); D.r = null; }
        D.k = D.k.filter(t => t.s !== s); delete D.n[s];
      });
    case 'practise': grab(() => openGame(b.dataset.g)); return;
    case 'addsub': addingSubject = true; draw(); { const el = ROOT.querySelector('[data-fk="addsub"]'); if (el) el.focus(); } return;
    case 'nosub': addingSubject = false; draw(); return;
  }
}
function setTarget(m){
  m = Math.round(+m);
  if (!(m > 0)) m = 0;
  m = Math.min(m, 600);
  mutate(() => {
    const r = D.r; if (!r || r.z) return false;
    if (r.a){ bank(r, Date.now()); r.a = Date.now(); }       // count so far under the old target, then carry on
    if (m) r.m = m; else delete r.m;
    const t = r.i && D.k.find(x => x.i === r.i);
    if (t){ if (m) t.m = m; else delete t.m; }               // the task's next timer starts with it
    if (m && r.e >= m * 60000){ r.a = 0; r.z = Date.now(); } // already past it
  });
}
function onSubmit(e){
  e.preventDefault();
  const f = e.target, inp = f.querySelector('input[name="x"]');
  note = '';
  if (f.classList.contains('trk-addsub')){
    const name = tidy(inp.value, MAX_NAME), id = sid(name);
    if (!id){ inp.focus(); return; }
    addingSubject = false;
    if (subjects().some(x => x.id === id)){ setOpen(id, true); draw(); return; }
    setOpen(id, true);
    return mutate(() => { D.n[id] = name; });
  }
  if (f.classList.contains('trk-ed')){
    const x = tidy(inp.value, MAX_TEXT), id = f.dataset.i;
    editing = null;
    if (!x){ draw(); return; }
    return mutate(() => { const t = D.k.find(t => t.i === id); if (!t || t.x === x) return false; t.x = x; });
  }
  if (f.classList.contains('trk-add')){
    const x = tidy(inp.value, MAX_TEXT), s = f.dataset.s;
    if (!x) return;
    mutate(() => {
      if (D.k.length >= MAX_TASKS){ note = 'That is as many tasks as the tracker keeps. Clear some done ones first.'; return false; }
      D.k.push({ i:uid(), s, x });
      remember(s);
    });
    if (note){ draw(); return; }
    const el = ROOT && ROOT.querySelector('[data-fk="add:' + CSS.escape(s) + '"]');
    if (el){ el.value = ''; el.focus(); }
  }
}
function onChange(e){
  const el = e.target, k = el.dataset && el.dataset.chg;
  if (k === 'tick') return mutate(() => {
    const t = D.k.find(x => x.i === el.dataset.i); if (!t) return false;
    if (el.checked){
      t.d = +dk(Date.now());
      if (D.r && D.r.i === t.i){ if (D.r.a) bank(D.r, Date.now()); D.r = null; }   // done: its timer stops
    } else delete t.d;
  });
  if (k === 'target') setTarget(el.value);
}

/* ── wiring ── */
function render(){
  D = load();
  const tt = timetableSubjects();
  if (D.at && tt && tt.join('|') !== D.y.join('|')) save();          // only once the tracker has been used
  const el = document.createElement('div');
  el.className = 'trk';
  el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && el.contains(b)) act(b); });
  el.addEventListener('submit', onSubmit);
  el.addEventListener('change', onChange);
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (editing || addingSubject)){ editing = null; addingSubject = false; draw(); }
  });
  ROOT = el;
  editing = null; addingSubject = false; note = ''; rmArm = null;
  check(false);
  if (D.r && D.r.z && Date.now() - D.r.z > 6 * 3600e3) mutate(() => { if (!D.r || !D.r.z) return false; D.r = null; });   // a "time's up" left overnight
  draw(); title();
  if (running() && !iv) iv = setInterval(tick, 1000);
  watchStage();
  return el;
}

let stageObs = null;
function watchStage(){
  const st = document.getElementById('gamestage');
  if (!st || stageObs || typeof MutationObserver !== 'function') return;
  stageObs = new MutationObserver(() => mini());
  stageObs.observe(st, { attributes:true, attributeFilter:['hidden'] });
}

/* another tab on this device changed it */
addEventListener('storage', e => { if (e.key === KEY && ROOT){ D = load(); refresh(); } });

/* Back to a tab that has been in the background: catch up on a target that
   passed meanwhile, and, when signed in, pick up a newer copy from another
   device (the settings sync only reads the server when a page loads, and a
   laptop's tab can sit open for days). Read only, at most every 20 seconds. */
let lastPull = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !ROOT) return;
  check(false); live(); title();
  if (!(window.TT && TT.signedIn && TT.signedIn() && TT.api) || Date.now() - lastPull < 20000) return;
  lastPull = Date.now();
  TT.api('/api/prefs').then(p => {
    const v = p && p.data && p.data[KEY];
    if (!v || typeof v !== 'object' || !(+v.at > D.at)) return;
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { return; }
    D = load(); check(false); refresh();
  }).catch(() => {});
});

window.Tracker = { render, totals:() => totals(), running, data:() => load() };
})();
