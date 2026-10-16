/* ══════════════════════════════════════════════════════════════════════════
   STUDY: the HSC dates, the countdown, today's revision plan, and focus mode

   Loaded on the home, revision, games and calendar pages, before games.js
   where that is loaded. It only defines things; the pages call into it.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){

/* ── the official dates ────────────────────────────────────────────────────
   Only dates NESA has published go here — nothing estimated. When NESA
   releases the 2027 written exam timetable (the 2026 one came out in May
   2026), set `start` to the first exam and fill `exams` with this student's
   papers in the same shape the calendar used for the Year 11 exams:
     { id:'eng-p1', subj:'English Advanced Paper 1', d:'2027-10-12', s:'09:25', e:'11:00' }
   Everything else — the countdown, the calendar, the plan — follows from it. */
const HSC_DATES = {
  year: 2027,
  start: null,
  source: 'https://www.nsw.gov.au/education-and-training/nesa/key-dates/hsc-written-exam-timetable',
  milestones: [
    { d:'2026-11-03', what:'2027 HSC student entries open' }
  ],
  exams: []
};

const DAY = 86400000;
const midnight = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dateOf = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const daysUntil = s => Math.round((midnight(dateOf(s)) - midnight(new Date())) / DAY);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate = s => { const d = dateOf(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* What the countdown should say right now: days to the first exam once it is
   published, otherwise the next real milestone, otherwise just the year. */
function countdown(){
  if (HSC_DATES.start){
    const n = daysUntil(HSC_DATES.start);
    if (n > 0) return { kind:'exam', days:n, label:'until the ' + HSC_DATES.year + ' HSC', date:HSC_DATES.start };
    const last = HSC_DATES.exams.map(e => e.d).sort().pop();
    if (last && daysUntil(last) >= 0) return { kind:'during', label:'The HSC is under way' };
  }
  const next = HSC_DATES.milestones.filter(m => daysUntil(m.d) >= 0).sort((a, b) => a.d < b.d ? -1 : 1)[0];
  return { kind:'unpublished', next, year:HSC_DATES.year };
}

/* ── focus mode ────────────────────────────────────────────────────────────
   While it is on, the games page is locked and the home page hides the games
   and the forum. It lives in tt.* so starting it on a laptop locks the phone
   too. Ending early is allowed — this is a tool, not a cage — but it takes a
   deliberate three-second hold, which is usually long enough to change one's
   mind. */
const Focus = {
  get(){ const f = window.TT ? TT.get('tt.focus', null) : null; return f && +f.until > Date.now() ? f : null; },
  active(){ return !!this.get(); },
  left(){ const f = this.get(); return f ? Math.max(0, +f.until - Date.now()) : 0; },
  start(mins){ TT.set('tt.focus', { until:Date.now() + mins * 60000, started:Date.now(), mins }); },
  end(){ TT.set('tt.focus', null); },
  fmt(ms){
    const m = Math.ceil(ms / 60000);
    return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min';
  },
  /* the button that ends it: has to be held down */
  holdButton(label, onDone){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn focushold'; b.textContent = label;
    let t = null, raf = null, t0 = 0;
    const stopHold = () => { clearTimeout(t); cancelAnimationFrame(raf); b.style.setProperty('--hold', '0'); b.textContent = label; };
    const tick = () => { const p = Math.min(1, (Date.now() - t0) / 3000);
      b.style.setProperty('--hold', String(p)); if (p < 1) raf = requestAnimationFrame(tick); };
    const down = e => { e.preventDefault(); t0 = Date.now(); b.textContent = 'Keep holding…'; tick();
      t = setTimeout(() => { stopHold(); onDone(); }, 3000); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !t0) down(e); });
    ['pointerup', 'pointerleave', 'pointercancel', 'keyup'].forEach(ev => b.addEventListener(ev, () => { t0 = 0; stopHold(); }));
    return b;
  },
  /* what the games page shows instead of the games */
  lockCard(){
    const d = document.createElement('div');
    d.className = 'focuslock';
    d.innerHTML = '<div class="focusico">🎯</div><h2>Focus mode is on</h2>' +
      '<p>The games are locked for another <b class="focusleft">' + Focus.fmt(Focus.left()) + '</b>. They will unlock on their own.</p>' +
      '<div class="focusrow"><a class="btn primary" href="revision.html">Back to revision</a></div>';
    const row = d.querySelector('.focusrow');
    row.appendChild(Focus.holdButton('Hold to end focus early', () => { Focus.end(); location.reload(); }));
    const iv = setInterval(() => {
      if (!document.body.contains(d)){ clearInterval(iv); return; }
      if (!Focus.active()){ clearInterval(iv); location.reload(); return; }
      d.querySelector('.focusleft').textContent = Focus.fmt(Focus.left());
    }, 15000);
    return d;
  }
};

/* ── today's plan ──────────────────────────────────────────────────────────
   Built from the same history the practice uses. Generated questions record
   one entry per topic (`<topic>:~topic`, see revGame), so each topic has a
   last answer, a run of right answers and a due day, just like a saved
   question. The plan prefers, in order: topics due that were last got wrong,
   topics due, then topics never started — and spreads them over subjects. */
/* The module lists, RV and dayOf are top-level consts in other scripts. They
   are not properties of window, so they are read by name — inside try, because
   reading a const before its declaration has run throws even under typeof (the
   temporal dead zone), and which scripts have run depends on load order. A
   missing one just leaves that subject out. */
const grab = f => { try { return f(); } catch { return null; } };
const Y12 = () => [
  ['maths12', 'Maths Advanced', grab(() => MODULES_MA12)],
  ['maths12e1', 'Extension 1', grab(() => MODULES_ME1)],
  ['maths12e2', 'Extension 2', grab(() => MODULES_ME2)],
  ['phys12', 'Physics', grab(() => MODULES_PH12)],
  ['chem12', 'Chemistry', grab(() => MODULES_CH12)],
  ['eng12', 'Engineering', grab(() => MODULES_EN12)],
  ['english12', 'English Advanced', grab(() => MODULES_EN_ADV)]
].filter(x => Array.isArray(x[2]));
const histOf = sk => grab(() => RV.load(sk)) || {};
const todayNum = () => { const d = grab(() => dayOf(Date.now())); return d != null ? d : Math.floor(Date.now() / DAY); };

/* a stable shuffle for the day, so the plan does not reshuffle on every visit */
const dayKey = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function topicState(hist, tid, today){
  const h = hist[tid + ':~topic'];
  const keyed = Object.keys(hist).filter(k => (k.startsWith(tid + ':') || k.startsWith(tid + '#')) && !k.endsWith(':~topic'));
  if (!h && !keyed.length) return { st:'new' };
  const entries = (h ? [h] : []).concat(keyed.map(k => hist[k])).filter(Array.isArray);
  const lastWrong = entries.some(x => x.length > 4 ? !(x[4] > 0) : !(x[2]));
  const due = entries.some(x => x[6] != null ? x[6] <= today : true);
  const doneToday = !!h && h[5] === today && h[4] > 0;
  return { st:due ? (lastWrong ? 'weak' : 'due') : 'resting', doneToday };
}

function plan(max){
  const today = todayNum();
  const seed = dayKey();
  const items = [];
  Y12().forEach(([sk, subj, mods]) => {
    const hist = histOf(sk);
    mods.forEach(m => m.topics.forEach(t => {
      const s = topicState(hist, t.id, today);
      const rank = s.doneToday ? 0 : s.st === 'weak' ? 3 : s.st === 'due' ? 2 : s.st === 'new' ? 1 : 0;
      items.push({ sk, subj, mod:m.id, modName:m.name, tid:t.id, name:t.name, st:s.st, doneToday:s.doneToday,
                   rank, tie:hash(seed + t.id) });
    }));
  });
  const done = items.filter(x => x.doneToday);
  const pool = items.filter(x => x.rank > 0).sort((a, b) => b.rank - a.rank || a.tie - b.tie);
  const out = [], perSubject = {};
  for (const it of pool){                         // no more than one topic a subject until every subject has had a turn
    if (out.length >= max) break;
    if (perSubject[it.sk]) continue;
    perSubject[it.sk] = 1; out.push(it);
  }
  for (const it of pool){
    if (out.length >= max) break;
    if (!out.includes(it) && (perSubject[it.sk] || 0) < 2){ perSubject[it.sk] = (perSubject[it.sk] || 0) + 1; out.push(it); }
  }
  return { items:out, done };
}

/* open a subject straight onto one topic, the way picking it by hand would */
function practise(it){
  const mods = (Y12().find(x => x[0] === it.sk) || [])[2] || [];
  const mod = mods.find(m => m.id === it.mod);
  if (!mod) return;
  const excl = {};
  mod.topics.forEach(t => { if (t.id !== it.tid) excl[t.id] = true; });
  TT.set('tt.rev_' + it.sk + '_mod', it.mod);
  TT.set('tt.rev_' + it.sk + '_excl', excl);
  grab(() => openGame(it.sk));
}

const WHY = { weak:'got it wrong last time', due:'due for review', new:'not started yet' };

/* the panel at the top of the Year 12 revision page */
function render(){
  const wrap = document.createElement('section');
  wrap.className = 'studypanel';
  const cd = countdown();
  const cdHtml = cd.kind === 'exam'
    ? '<div class="cdbig">' + cd.days + '</div><div class="cdlbl">day' + (cd.days === 1 ? '' : 's') + ' ' + esc(cd.label) + '</div>' +
      '<div class="cdsub">First exam ' + esc(longDate(cd.date)) + '</div>'
    : cd.kind === 'during'
    ? '<div class="cdlbl">' + esc(cd.label) + '</div>'
    : '<div class="cdlbl">The ' + cd.year + ' HSC</div>' +
      '<div class="cdsub">NESA has not published the ' + cd.year + ' exam timetable yet — it usually comes out around May. ' +
      'The countdown starts the day it does.</div>' +
      (cd.next ? '<div class="cdnext"><b>' + daysUntil(cd.next.d) + ' day' + (daysUntil(cd.next.d) === 1 ? '' : 's') + '</b> until ' +
                 esc(cd.next.what.charAt(0).toLowerCase() + cd.next.what.slice(1)) + ' (' + esc(longDate(cd.next.d)) + ')</div>' : '');
  const p = plan(4);
  const list = p.items.length
    ? '<ol class="planlist">' + p.items.map((it, i) =>
        '<li><button type="button" class="planitem" data-i="' + i + '">' +
        '<span class="plansubj">' + esc(it.subj) + '</span>' +
        '<span class="plantopic">' + esc(it.name) + '</span>' +
        '<span class="planwhy pw-' + it.st + '">' + esc(WHY[it.st] || '') + '</span></button></li>').join('') + '</ol>'
    : '<p class="planempty">Nothing is due today. Anything you do now is a head start.</p>';
  const doneTxt = p.done.length ? '<p class="plandone">Done today: ' + p.done.slice(0, 6).map(d => esc(d.name)).join(', ') +
    (p.done.length > 6 ? ' and ' + (p.done.length - 6) + ' more' : '') + '</p>' : '';

  const f = Focus.get();
  const focusHtml = f
    ? '<div class="focusstate">🎯 Focus mode — games locked for <b>' + Focus.fmt(Focus.left()) + '</b></div>'
    : '<div class="focusstart"><span>Focus mode</span>' +
      '<button type="button" class="btn" data-focus="30">30 min</button>' +
      '<button type="button" class="btn" data-focus="60">1 hour</button>' +
      '<button type="button" class="btn" data-focus="120">2 hours</button></div>';

  wrap.innerHTML =
    '<div class="sp-cd">' + cdHtml + '</div>' +
    '<div class="sp-plan"><h3>Today’s revision</h3>' + list + doneTxt + '</div>' +
    '<div class="sp-focus">' + focusHtml + '<p class="sp-hint">Locks the games and hides the forum until the time is up — on every device you are signed in on.</p></div>';

  wrap.querySelectorAll('.planitem').forEach(b => { b.onclick = () => practise(p.items[+b.dataset.i]); });
  wrap.querySelectorAll('[data-focus]').forEach(b => { b.onclick = () => {
    Focus.start(+b.dataset.focus);
    grab(() => showGrid());
  }; });
  if (f){
    const row = wrap.querySelector('.sp-focus');
    row.insertBefore(Focus.holdButton('Hold to end early', () => { Focus.end(); grab(() => showGrid()); }), row.querySelector('.sp-hint'));
  }
  return wrap;
}

window.HSC_DATES = HSC_DATES;
window.Study = { countdown, plan, practise, render, daysUntil, longDate, topicState };
window.Focus = Focus;
})();
