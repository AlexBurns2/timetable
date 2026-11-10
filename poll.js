/* ═══════════════════════════════════════════════════════════════════
   The weekly anonymous poll on Home (server: api/_poll.js via /api/forum).

   Poll.mount(el, { signedIn, onVoted, onDraw }) draws the card and keeps it
   current. The week, in Sydney time:

     Monday 9:30 – Friday noon   vote; once you have, the live results
     Friday noon – Monday 9:30   closed. If you voted: the winner's celebration
                                 (once), then the final results. If you didn't:
                                 just the results, and "come back Monday".

   Your own answer is kept on this device only (a "poll." key, which the
   settings sync never copies), so the server never holds it against your name.

   The two moments, each set per week by a moderator:
   - Monday: the new question takes over the card the way you last saw it
     (results, "your vote is in", an unanswered question...). The card itself
     moves: dropped on, swung into, knocked over, blown up, flipped, spun.
     The very first poll someone sees gets its own drop that shoves the page
     down, so the new feature is impossible to miss.
   - Friday: a celebration inside the card and behind it (build-up, the
     question called back, a drumroll, the winner, confetti, the leaderboard).
   Each plays once per person, after the page has fully loaded. Anyone with
   Home open when the moment comes sees it at the same instant as everyone
   else (server clock). Other buttons are locked while one plays; Skip,
   a click on it, or Escape ends it.
   home.html?pollpreview=intro&anim=wreck&from=final (or =reveal&anim=curtain)
   replays one without marking anything as seen.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
"use strict";
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const reduced = () => document.documentElement.getAttribute('data-motion') === 'reduced' ||
  (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = ms => new Promise(r => setTimeout(r, ms));
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rand = (a, b) => a + Math.random() * (b - a);

const PLACEHOLDER = { student:'Type a name from your year…', teacher:'Type a teacher’s name…', class:'Type one of your classes…',
                      period:'Type a period…', custom:'Type your answer…' };
const CHIPS_UP_TO = 12;                       // this few answers: buttons instead of a box
const mineKey = w => 'poll.mine.' + w;        // device only, never synced
const SEEN = 'tt.poll_seen', REVEALED = 'tt.poll_revealed', VIEW = 'tt.poll_view';
const INTRO_SHOWS = ['drop', 'wreck', 'topple', 'explode', 'flip', 'slot'];
const CELEB_SHOWS = ['spotlight', 'countdown', 'curtain', 'envelope', 'slot'];
const introOf = p => { const a = p.anim === 'crash' ? 'drop' : p.anim; return INTRO_SHOWS.includes(a) ? a : INTRO_SHOWS[hash(p.week) % INTRO_SHOWS.length]; };
const celebOf = p => CELEB_SHOWS.includes(p.celebrate) ? p.celebrate : CELEB_SHOWS[hash(p.week + 'c') % CELEB_SHOWS.length];

let el = null, opts = {}, data = null, tick = null, prevView = null, offset = 0, timer = null;
const serverNow = () => Date.now() + offset;

function dur(sec){
  sec = Math.max(0, sec | 0);
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.max(1, Math.floor(sec % 3600 / 60));
  return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
}
const weekLabel = w => { const d = new Date(w + 'T00:00:00'); return 'Week of ' + d.getDate() + ' ' + d.toLocaleString('en-AU', { month:'short' }); };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* "Most likely to become state rank?" → "The person most likely to become state rank is…" */
function revealLine(p){
  if (p.reveal) return p.reveal;
  const q = String(p.question || '').trim().replace(/[?!.\s]+$/, '');
  const noun = { student:'person', teacher:'teacher', class:'class', period:'period', custom:'answer' }[p.kind] || 'winner';
  let m;
  if ((m = q.match(/^(?:who(?:'s| is)? )?most likely to (.+)$/i))) return 'The ' + noun + ' most likely to ' + m[1] + ' is…';
  if ((m = q.match(/^(?:who(?:'s| is| has)? (?:the )?)?(best|worst|funniest|smartest|nicest|loudest|quietest|biggest|hardest|easiest|coolest|scariest|most \w+|least \w+)\s+(.+)$/i)))
    return 'The ' + m[1].toLowerCase() + ' ' + m[2] + ' is…';
  return 'And the winner is…';
}

/* ── loading ─────────────────────────────────────────────────────────── */
async function refresh(first, startAt, again){
  const t0 = Date.now();
  let d;
  try { d = await TT.api('/api/forum', { params:{ poll:1 } }); if (!d || typeof d !== 'object') throw new Error('empty answer'); }
  catch (e){
    console.warn('poll:', e.message);
    /* at noon Friday / 9:30 Monday everyone asks at once: keep the card and try again shortly */
    if (again && data){ clearTimeout(timer); timer = setTimeout(() => refresh(true, null, true), rand(15000, 30000)); return; }
    /* a moderator's preview still plays with nothing set (or the table not there yet) */
    if (first && previewing()){ data = { poll:null, last:null, clock:null, loadedAt:Date.now() }; draw(true, startAt); return; }
    /* not set up yet, or the server had a moment: no card, rather than an error on everyone's Home */
    if (first) hideCard();
    return;
  }
  data = d;
  const t1 = Date.now();
  if (data.clock && typeof data.clock.now === 'number') offset = data.clock.now - (t0 + t1) / 2;   // the server's clock, for syncing
  data.loadedAt = t1;
  try { draw(first, startAt); }
  catch (e){ console.error('poll draw:', e); if (first) hideCard(); }
}
const previewing = () => new URLSearchParams(location.search).has('pollpreview');
function hideCard(){ el.hidden = true; el.innerHTML = ''; rememberHeight(); if (opts.onDraw) try { opts.onDraw(null); } catch {} }
const left = k => Math.max(0, ((data.clock && data.clock[k]) || 0) - (Date.now() - data.loadedAt) / 1000);

/* where this person is with this week's poll */
function stateOf(p){
  if (!p) return data && data.last ? 'last' : 'none';
  if (p.signedOut) return 'signin';
  if (p.phase === 'results') return p.voted ? 'final' : 'closed';
  return p.voted ? 'voted' : 'vote';
}

/* ── the card ────────────────────────────────────────────────────────── */
function frame(body, p, extra){
  extra = extra || {};
  return '<div class="pcard' + (extra.cls ? ' ' + extra.cls : '') + '">' +
    '<div class="phead"><span class="pchip">' + esc(extra.chip || 'This week’s poll · anonymous') + '</span>' +
      '<span class="pright"><span class="pcount" id="pcount" hidden></span><span class="pwhen" id="pwhen"></span>' +
      (extra.foot === false ? '' : '<button type="button" class="pminbtn" data-act="min" aria-expanded="true" aria-label="Minimise the poll" title="Minimise">' +
        (window.Icon ? Icon.svg('caret-up') : '^') + '</button>') +
      '</span></div>' +
    (p ? '<h2 class="pq" id="pq">' + esc(p.question) + '</h2>' : '') +
    '<div class="pbody">' + body + '</div>' +
    (extra.foot === false ? '' :
      '<div class="pfoot">' +
        '<button type="button" class="plink" data-act="history">Past polls</button>' +
        (opts.signedIn ? '<button type="button" class="plink" data-act="suggest">Suggest next week’s question</button>' : '') +
      '</div>' +
      '<form class="psug" id="psug" hidden>' +
        '<input id="psugq" maxlength="120" autocomplete="off" data-lpignore="true" data-1p-ignore data-bwignore ' +
          'placeholder="Most likely to…" aria-label="Your question">' +
        '<select id="psugk" aria-label="What people would answer with">' +
          '<option value="student">A student</option><option value="teacher">A teacher</option>' +
          '<option value="class">A subject</option><option value="period">A period</option>' +
          '<option value="custom">My own answers</option></select>' +
        '<button type="submit" class="btn">Send</button>' +
        '<span class="psugmsg" id="psugmsg" role="status"></span>' +
      '</form>') +
  '</div>';
}
const comeBack = () => '<p class="pcomeback">Voting’s closed. Come back on Monday for the next question.</p>';
/* the card's body for a state (also used to draw the card as it was, for a Monday show) */
function bodyFor(state, p, mine){
  if (state === 'final') return resultsHtml(p.results, p.total, p.others, mine, p.pick, false) + shareHtml(p, true);
  if (state === 'closed') return resultsHtml(p.results, p.total, p.others, null, p.pick, false) + comeBack();
  if (state === 'voted') return doneHtml(mine) + resultsHtml(p.results, p.total, p.others, mine, p.pick, true) + shareHtml(p, false);
  if (state === 'last') return resultsHtml(p.results, p.total, p.others, null, p.pick, false);
  /* vote */
  const body = p.canVote ? voteHtml(p) : '<p class="pnote">' + (p.optionsError ? 'Couldn’t load the answers. Try again soon.'
    : p.kind === 'student' || p.kind === 'class' ? 'This one is for students.' : 'There’s nothing for you to pick from on this one.') + '</p>';
  return body + teaseHtml();
}
const chipFor = state => state === 'final' || state === 'closed' ? 'Final results · anonymous' : state === 'last' ? 'Last week’s poll' : '';

function draw(first, startAt){
  clearInterval(tick);
  const p = data.poll;
  el.hidden = false;
  curKey = p ? p.week : data.last ? 'last:' + data.last.week : 'none';
  if (!p){
    /* no question has ever been set: no card at all, so the site can go live before the first one */
    if (!data.last){
      if (first && previewing()){ el.innerHTML = ''; afterDraw(first, startAt); return; }   // the preview draws its own card
      el.hidden = true; el.innerHTML = ''; rememberHeight(); if (opts.onDraw) try { opts.onDraw(null); } catch {} return;
    }
    el.innerHTML = frame(bodyFor('last', data.last), data.last, { chip:chipFor('last') });
    saveView(data.last, 'last');
    wire(); afterDraw(first, startAt); return;
  }
  if (p.signedOut){ el.innerHTML = frame(signInHtml(p.phase === 'results'), p, { foot:false }); wireSignIn(); whenText(); afterDraw(first, startAt); return; }
  const state = stateOf(p);
  el.innerHTML = frame(bodyFor(state, p, lsGet(mineKey(p.week))), p, { cls: state === 'final' || state === 'closed' ? 'isresults' : '', chip:chipFor(state) });
  saveView(p, state);
  wire();
  whenText();
  tick = setInterval(whenText, 30000);
  afterDraw(first, startAt);
}
/* how the card looked, so next week's question can take over from exactly that */
function saveView(p, state){
  const v = { week:p.week, question:p.question, kind:p.kind, state, total:p.total || 0, pick:p.pick || 1,
              results:(p.results || []).slice(0, 5).map(r => ({ label:r.label, pct:r.pct, votes:r.votes })) };
  const old = TT.get(VIEW, null);
  if (JSON.stringify(old) !== JSON.stringify(v)) TT.set(VIEW, v);
}

/* the vote count: only once you've voted, so a quiet start never looks empty */
let shownCount = null;
function setCount(n, fresh){
  const c = document.getElementById('pcount'); if (!c) return;
  const p = data && data.poll;
  if (!p || !p.voted || n == null || !n){ c.hidden = true; return; }
  c.hidden = false;
  const paint = v => { c.innerHTML = '<b>' + v.toLocaleString() + '</b> ' + (v === 1 ? 'vote' : 'votes'); };
  const from = shownCount == null ? 0 : shownCount;
  shownCount = n;
  if (reduced() || (from === n && !fresh)){ paint(n); return; }
  if (from !== n && !fresh){ paint(n); c.animate([{ transform:'scale(1)' }, { transform:'scale(1.2)' }, { transform:'none' }], { duration:420 }); return; }
  const t0 = performance.now(), ms = Math.min(1200, 400 + n * 5);
  (function up(){ const k = Math.min(1, (performance.now() - t0) / ms); paint(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(up); })();
}
let live = null;
function keepLive(){
  clearInterval(live);
  live = setInterval(async () => {
    if (document.visibilityState !== 'visible' || !data || !data.poll || !data.poll.voted) return;
    if (data.clock && data.clock.phase !== 'open') return;          // voting's closed: the count can't change
    try {
      const d = await TT.api('/api/forum', { params:{ poll:1 } });
      if (d && d.poll && d.poll.week === data.poll.week && typeof d.poll.total === 'number' && d.poll.total !== shownCount){
        data.poll.total = d.poll.total; setCount(d.poll.total, false);
      }
    } catch {}
  }, 45000);
}
/* the next change (noon Friday, 9:30 Monday): every open page refreshes then, and
   plays the moment together a few seconds later, by the server's clock */
function schedule(){
  clearTimeout(timer);
  const c = data && data.clock; if (!c || !c.resultsAt) return;
  const at = c.phase === 'open' ? c.resultsAt : c.nextAt, ms = at - serverNow();
  if (ms > 0 && ms < 2147483000) timer = setTimeout(async () => {
    await wait(rand(0, 1500));                        // don't all ask the server in the same millisecond
    prevView = TT.get(VIEW, null);
    refresh(true, at + 6000, true);
  }, ms);
  else if (ms <= 0 && ms > -120000) timer = setTimeout(() => refresh(true, null, true), 5000);   // the server hadn't turned over yet
}

function afterDraw(first, startAt){
  const p = data.poll;
  if (first) setTimeout(rememberHeight, 400);          // once it's settled (not mid-show: a show holds its own height)
  setCount(p && typeof p.total === 'number' ? p.total : null, first);
  if (first){ keepLive(); schedule(); }
  if (opts.onDraw) try { opts.onDraw(p); } catch {}
  if (!first) return;
  const q = new URLSearchParams(location.search), pv = q.get('pollpreview');
  if (pv){ if (isMin()) setMin(false); preview(pv, q); return; }
  if (!p) return;
  const state = stateOf(p), seenBefore = TT.get(SEEN, '');
  /* Friday: you voted, and the winner is out */
  if (state === 'final' && p.results && TT.get(REVEALED, '') !== p.week){
    TT.set(REVEALED, p.week); TT.set(SEEN, p.week);
    if (isMin()) setMin(false);
    celebrate(p, revealLine(p), celebOf(p), startAt).catch(e => console.error('poll show:', e));
    return;
  }
  if (seenBefore === p.week) return;
  TT.set(SEEN, p.week);
  if (state === 'closed' || state === 'final') return;   // missed it, or too few votes to show: no show
  const from = prevView && prevView.week !== p.week ? prevView : null;
  if (!from && !seenBefore) intro('first', null, startAt);    // the very first poll this person sees
  else intro(introOf(p), from || { state:'blank', question:'' }, startAt);
}
function whenText(){
  const w = document.getElementById('pwhen'); if (!w || !data) return;
  const p = data.poll;
  if (!p || !data.clock){ w.textContent = ''; return; }
  w.innerHTML = data.clock.phase === 'open' ? 'Closes in <b>' + dur(left('resultsIn')) + '</b>' : 'Opens in <b>' + dur(left('nextIn')) + '</b>';
}

/* ── voting ──────────────────────────────────────────────────────────── */
function voteHtml(p){
  const opt = p.options || [], many = (p.pick || 1) > 1;
  const pick = opt.length <= CHIPS_UP_TO
    ? '<div class="pchips" role="group" aria-labelledby="pq">' + opt.map(o =>
        '<button type="button" class="popt" role="' + (many ? 'checkbox' : 'radio') + '" aria-checked="false" data-id="' + esc(o.id) + '">' + esc(o.label) + '</button>').join('') + '</div>'
    : '<div class="pinwrap">' + (many ? '<div class="ptoks" id="ptoks"></div>' : '') +
        '<input class="pin" id="pin" type="search" placeholder="' + esc(PLACEHOLDER[p.kind] || 'Type your answer…') + '" ' +
        'aria-labelledby="pq" spellcheck="false"></div>';
  return '<div class="pvote">' + pick +
    '<button type="button" class="btn primary pgo" id="pgo" disabled>Vote</button></div>' +
    '<p class="pmeta" id="pmeta">' + (many ? '<b>' + (p.exact ? 'Pick ' + p.pick : 'Pick up to ' + p.pick) + '.</b> ' : '') + 'Anonymous: nobody can see what you pick.</p>';
}
/* blurred stand-in bars: decoration only, nothing real is sent before you vote */
function teaseHtml(){
  return '<div class="ptease" aria-hidden="true">' + [72, 54, 38, 22].map(x =>
      '<div class="pbar"><span class="pbl">··········</span><span class="pfill" style="width:' + x + '%"></span></div>').join('') +
    '<div class="plock"><span>Vote to see the live results</span></div></div>';
}
function wireVote(){
  const p = data.poll, go = document.getElementById('pgo');
  if (!go || !p) return;
  const most = p.pick || 1, opt = p.options || [];
  let chosen = [];
  const labelOf = id => (opt.find(o => o.id === id) || {}).label || '';
  const sync = () => {
    go.disabled = !chosen.length || (p.exact && chosen.length !== most);
    go.textContent = most > 1 && chosen.length ? 'Vote (' + chosen.length + ' of ' + most + ')' : 'Vote';
    el.querySelectorAll('.popt').forEach(b => {
      const on = chosen.includes(b.dataset.id);
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('full', most > 1 && !on && chosen.length >= most);
    });
    const toks = document.getElementById('ptoks');
    if (toks){
      toks.innerHTML = chosen.map(id => '<span class="ptok">' + esc(labelOf(id)) +
        '<button type="button" data-rm="' + esc(id) + '" aria-label="Remove ' + esc(labelOf(id)) + '">' + (window.Icon ? Icon.svg('x') : '&#10005;') + '</button></span>').join('');
      toks.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { chosen = chosen.filter(x => x !== b.dataset.rm); sync(); });
    }
    const box = document.getElementById('pin');
    if (box && most > 1){ box.disabled = chosen.length >= most; box.placeholder = chosen.length >= most ? 'That’s ' + most + '. Vote when ready.' : (PLACEHOLDER[p.kind] || 'Type your answer…'); }
  };
  const toggle = id => {
    if (most === 1) chosen = [id];
    else if (chosen.includes(id)) chosen = chosen.filter(x => x !== id);
    else if (chosen.length < most) chosen.push(id);
    sync();
  };
  el.querySelectorAll('.popt').forEach(b => b.onclick = () => toggle(b.dataset.id));
  const box = document.getElementById('pin');
  if (box){
    const exact = v => opt.find(o => fold(o.label) === fold(v));
    const dup = new Set(), seen = new Set();
    opt.forEach(o => { const k = fold(o.label); if (seen.has(k)) dup.add(k); seen.add(k); });
    const source = q => {
      const words = fold(q).split(/\s+/).filter(Boolean);
      return opt.filter(o => !chosen.includes(o.id) || most === 1).filter(o => { const parts = fold(o.label).split(/[\s'’-]+/);
          return words.every(w => parts.some(x => x.startsWith(w))) || fold(o.label).startsWith(fold(q)); })
        .slice(0, 8).map(o => ({ value:o.label, label:o.label, sub: dup.has(fold(o.label)) ? o.id : '', id:o.id }));
    };
    const take = item => {
      if (most === 1){ chosen = [item.id]; box.classList.add('ok'); }
      else { if (!chosen.includes(item.id) && chosen.length < most) chosen.push(item.id); box.value = ''; box.classList.remove('ok'); }
      sync();
    };
    if (window.Suggest) Suggest.attach(box, { source, min:1, max:8, onPick:take });
    box.addEventListener('input', () => { if (most > 1) return; const m = exact(box.value); chosen = m ? [m.id] : []; box.classList.toggle('ok', !!m); sync(); });
    box.addEventListener('keydown', e => { if (e.key === 'Enter' && chosen.length && !document.querySelector('.sglist:not([hidden])')) go.click(); });
  }
  go.onclick = async () => {
    if (!chosen.length) return;
    const labels = chosen.map(labelOf);
    go.disabled = true; go.textContent = 'Voting…';
    try {
      const r = await TT.api('/api/forum', { method:'POST', body:{ action:'pollvote', week:p.week, choice: most > 1 ? chosen : chosen[0] } });
      lsSet(mineKey(p.week), JSON.stringify(labels));
      p.voted = true; p.total = r.total || (p.total + 1);
      p.results = r.results || null; p.others = r.others || 0;
      await voted();
    } catch (e){
      go.disabled = false; go.textContent = 'Vote';
      const m = document.getElementById('pmeta'); if (m) m.innerHTML = '<span class="perr">' + esc(e.message) + '</span>';
      if (/already/i.test(e.message)) setTimeout(() => refresh(false), 900);
    }
  };
}
const mineList = raw => { if (!raw) return []; try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [String(v)]; } catch { return [raw]; } };
/* the moment after voting: the card turns into the live results */
async function voted(){
  const g = document.getElementById('pgo');
  if (!reduced() && g){ g.classList.add('pok'); g.textContent = '✓'; await wait(320); }
  draw(false);
  setCount(data.poll.total, true);
  if (!reduced()){
    const done = el.querySelector('.pdone'), share = el.querySelector('.pshare');
    if (done) done.animate([{ opacity:0, transform:'scale(.92)' }, { opacity:1, transform:'none' }], { duration:400, easing:'cubic-bezier(.2,.9,.3,1.3)' });
    el.querySelectorAll('.pbars .pbar').forEach((b, i) => {
      b.querySelector('.pfill').animate([{ width:'0%' }, { width:b.dataset.pct + '%' }], { duration:650, delay:220 + i * 80, easing:'cubic-bezier(.2,.7,.2,1)', fill:'backwards' });
      b.animate([{ opacity:0, transform:'translateX(-8px)' }, { opacity:1, transform:'none' }], { duration:300, delay:180 + i * 80, fill:'backwards' });
    });
    if (share) share.animate([{ opacity:0, transform:'translateY(12px)' }, { opacity:1, transform:'none' }], { duration:400, delay:600, fill:'backwards' });
  }
  if (opts.onVoted) opts.onVoted();
}
function doneHtml(mine){
  const m = mineList(mine);
  return '<div class="pdone"><span class="ptick" aria-hidden="true">✓</span><div><b>Your vote is in.</b>' +
    (m.length ? '<span class="pmine">You picked <b>' + m.map(esc).join('</b>, <b>') + '</b> <i>(shown on this device only)</i></span>' : '') +
    '</div></div>';
}

/* ── results ─────────────────────────────────────────────────────────── */
function barRow(r, i, m, extra){
  const mine = m.includes(fold(r.label));
  return '<div class="pbar' + (mine ? ' mine' : '') + (extra ? ' extra' : '') + '" data-pct="' + r.pct + '">' +
    '<span class="pbl"><i class="prk">' + (i + 1) + '</i>' + esc(r.label) + (mine ? ' <em>✓</em>' : '') + '</span>' +
    '<span class="pfill" style="width:' + r.pct + '%"></span><span class="ppc">' + r.pct + '%</span></div>';
}
function resultsHtml(results, total, others, mine, pick, live){
  if (!results || !results.length) return '<p class="pnote">No votes yet.</p>';
  const m = mineList(mine).map(fold);
  if (live) return '<div class="pbars" id="pbars">' + results.slice(0, 6).map((r, i) => barRow(r, i, m)).join('') + '</div>';
  const [w, ...rest] = results;
  const tie = rest.length && rest[0].votes === w.votes;
  const SHOW = 6;
  return '<div class="pwin" id="pwin"><span class="pwinico" aria-hidden="true">🏆</span>' +
      '<span class="pwinl">' + (tie ? 'Tied for first' : 'Winner') + '</span>' +
      '<span class="pwinn">' + esc(w.label) + (tie ? ' and ' + esc(rest[0].label) : '') + '</span>' +
      '<span class="pwinp">' + (pick > 1 ? 'picked by ' + w.pct + '% of ' : w.pct + '% of ') + plural(total, 'voter') + '</span></div>' +
    '<div class="pbars" id="pbars">' + results.map((r, i) => barRow(r, i, m, i >= SHOW)).join('') + '</div>' +
    (results.length > SHOW ? '<button type="button" class="plink pmore" data-act="more">Show all ' + results.length + '</button>' : '') +
    '<p class="pmeta">' + plural(total, 'voter') + (pick > 1 ? ' · up to ' + pick + ' picks each' : '') + (others ? ' · ' + others + ' more got a vote or two' : '') + '</p>';
}

/* ── sharing ─────────────────────────────────────────────────────────── */
const shareUrl = () => location.origin + '/poll';
const ic = n => window.Icon ? Icon.svg(n) : '';
function shareHtml(p, small){
  return '<div class="pshare' + (small ? ' small' : '') + '">' +
    (small ? '' : '<div class="pshtxt"><b>Get your friends in on it</b><span>They’ll see the question, not the answers.</span></div>') +
    '<div class="pshbtns">' +
      (navigator.share ? '<button type="button" class="btn primary" data-act="share">' + ic('share-network') + 'Share</button>' : '') +
      '<button type="button" class="btn' + (navigator.share ? '' : ' primary') + '" data-act="copy">' + ic('link') + '<span>Copy link</span></button>' +
    '</div></div>';
}
async function share(kind){
  const p = data.poll; if (!p) return;
  const url = shareUrl(), text = '“' + p.question + '” Vote anonymously to see what everyone said.';
  if (kind === 'share' && navigator.share){ try { await navigator.share({ title:'MSC poll', text, url }); } catch {} return; }
  const btn = el.querySelector('[data-act="copy"]');
  const lbl = btn && btn.querySelector('span');
  try { await navigator.clipboard.writeText(url); if (lbl){ lbl.textContent = 'Copied'; setTimeout(() => lbl.textContent = 'Copy link', 1600); } }
  catch { prompt('Copy this link:', url); }
}

/* ── signed out: the question, and signing in to answer it ────────────── */
function signInHtml(closed){
  return (closed ? comeBack() + '<p class="psignp">Sign in with your school login to see the results.</p>'
                 : '<p class="psignp">Sign in with your school login to vote. Nobody can see what you pick.</p>') +
    '<form class="psign" id="psign">' +
      '<input name="username" id="psu" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="first.last1" aria-label="School username">' +
      '<input name="password" id="psp" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password">' +
      '<button type="submit" class="btn primary">' + (closed ? 'Sign in' : 'Sign in and vote') + '</button>' +
    '</form><p class="pmeta" id="psmsg">Your login is saved only on this device.</p>';
}
function wireSignIn(){
  const f = document.getElementById('psign'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const user = f.username.value.trim().toLowerCase().split('@')[0], pass = f.password.value;
    const msg = document.getElementById('psmsg');
    if (!user || !pass){ msg.textContent = 'Enter your username and password.'; return; }
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
    const creds = { email: user + '@' + TT.EMAIL_DOMAIN, password: pass };
    TT.set('tt.creds', creds);
    if (!TT.get('tt.email', '')) TT.set('tt.email', creds.email);
    try {
      const d = await TT.api('/api/forum', { params:{ poll:1 } });
      if (d && d.poll && d.poll.signedOut) throw new Error('401');      // the login wasn't accepted
      const u = new URL(location.href); u.searchParams.set('poll', '1'); location.replace(u.toString());
    } catch (err){
      TT.set('tt.creds', null);
      btn.disabled = false; btn.textContent = 'Sign in and vote';
      msg.innerHTML = '<span class="perr">' + (/sign in|401|credential/i.test(err.message) ? 'That login didn’t work. Check it and try again.' : esc(err.message)) + '</span>';
    }
  };
}

/* ── minimised: just the question in one line, until you open it again.
   Remembered for that week's poll only, so a new question always arrives open. */
const MIN = 'tt.poll_min';
let curKey = '';
const isMin = () => !!curKey && TT.get(MIN, '') === curKey;
function applyMin(){
  const card = el.querySelector('.pcard'); if (!card) return;
  const m = isMin();
  card.classList.toggle('pmin', m);
  const b = card.querySelector('.pminbtn');
  if (b){ b.setAttribute('aria-expanded', String(!m)); b.setAttribute('aria-label', m ? 'Open the poll' : 'Minimise the poll'); b.title = m ? 'Open' : 'Minimise'; }
}
function setMin(on){
  const card = el.querySelector('.pcard'); if (!card) return;
  const h0 = card.offsetHeight;
  TT.set(MIN, on ? curKey : '');
  applyMin();
  if (!reduced() && card.animate){ const h1 = card.offsetHeight; card.animate([{ height:h0 + 'px' }, { height:h1 + 'px' }], { duration:280, easing:'cubic-bezier(.2,.7,.2,1)' }); }
  setTimeout(rememberHeight, 320);                     // a minimised card loads minimised-size next time
}

/* ── the footer: past polls, and suggesting one ───────────────────────── */
function wire(){
  wireVote();
  applyMin();
  const card = el.querySelector('.pcard');
  if (card) card.addEventListener('click', e => { if (card.classList.contains('pmin') && !e.target.closest('button')) setMin(false); });
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'min') setMin(!isMin());
    else if (a === 'history') history();
    else if (a === 'suggest'){ const f = document.getElementById('psug'); f.hidden = !f.hidden; if (!f.hidden) document.getElementById('psugq').focus(); }
    else if (a === 'share' || a === 'copy') share(a);
    else if (a === 'more'){ el.querySelectorAll('.pbar.extra').forEach(x => x.classList.remove('extra')); b.remove(); }
  });
  const f = document.getElementById('psug');
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const q = document.getElementById('psugq').value.trim(), msg = document.getElementById('psugmsg');
    if (q.length < 5){ msg.textContent = 'Write a question first.'; return; }
    try {
      await TT.api('/api/forum', { method:'POST', body:{ action:'pollsuggest', question:q, kind:document.getElementById('psugk').value } });
      document.getElementById('psugq').value = '';
      msg.textContent = 'Sent. The moderators pick from these.';
    } catch (err){ msg.textContent = err.message; }
  };
}
function history(){
  openSheet('Past polls', async body => {
    body.innerHTML = '<p class="pnote">Loading…</p>';
    try {
      const d = await TT.api('/api/forum', { params:{ poll:'history' } });
      const polls = d.polls || [];
      body.innerHTML = polls.length ? polls.map(p => '<section class="phist">' +
          '<div class="phwk">' + esc(weekLabel(p.week)) + '</div><h3>' + esc(p.question) + '</h3>' +
          (p.results ? '<div class="pbars">' + p.results.slice(0, 5).map((r, i) => barRow(r, i, [])).join('') + '</div>' +
              '<p class="pmeta">' + plural(p.total, 'voter') + '</p>'
            : '<p class="pmeta">' + (p.total ? 'Too few votes to show.' : 'No votes.') + '</p>') +
        '</section>').join('') : '<p class="pnote">No finished polls yet.</p>';
    } catch (e){ body.innerHTML = '<p class="pnote">' + esc(e.message) + '</p>'; }
  });
}
/* a sheet that slides up from the bottom (styles in site.css) */
function openSheet(title, fill){
  const opener = document.activeElement;
  const back = document.createElement('div'); back.className = 'sheetback';
  const sh = document.createElement('section'); sh.className = 'sheet';
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title);
  sh.innerHTML = '<div class="sheetgrab" aria-hidden="true"><i></i></div><div class="sheethd"><h2>' + esc(title) + '</h2>' +
    '<button class="btn icon sheetx" type="button" aria-label="Close">' + (window.Icon ? Icon.svg('x') : '&#10005;') + '</button></div><div class="sheetbody"></div>';
  document.body.append(back, sh);
  document.documentElement.classList.add('sheetopen');
  const close = () => {
    removeEventListener('keydown', key, true);
    document.documentElement.classList.remove('sheetopen');
    back.classList.remove('in'); sh.classList.remove('in'); sh.style.transform = '';
    setTimeout(() => { back.remove(); sh.remove(); }, reduced() ? 0 : 300);
    try { opener && opener.focus({ preventScroll:true }); } catch {}
  };
  const key = e => { if (e.key === 'Escape'){ e.preventDefault(); close(); } };
  addEventListener('keydown', key, true);
  back.onclick = close; sh.querySelector('.sheetx').onclick = close;
  [sh.querySelector('.sheetgrab'), sh.querySelector('.sheethd')].forEach(g => {
    let y0 = null, dy = 0;
    g.addEventListener('pointerdown', e => { if (e.button || e.target.closest('button')) return; y0 = e.clientY; dy = 0; sh.classList.add('drag'); try { g.setPointerCapture(e.pointerId); } catch {} });
    g.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; });
    const up = () => { if (y0 == null) return; y0 = null; sh.classList.remove('drag'); if (dy > 80) close(); else sh.style.transform = ''; };
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });
  fill(sh.querySelector('.sheetbody'));
  requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add('in'); sh.classList.add('in'); }));
  try { sh.querySelector('.sheetx').focus({ preventScroll:true }); } catch {}
}

/* ═══ the show ══════════════════════════════════════════════════════════
   Decoration only: never with reduced motion, always skippable. */

const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b5bd6';
const PARTY = () => [accent(), '#ffd43b', '#ff6b6b', '#51cf66', '#4dabf7', '#cc5de8', '#ff922b', '#ffffff'];
let skipping = false;
const anims = [];
/* fill both, so a delayed start holds its first frame; let go once finished unless told to keep it */
const play = (node, kf, o) => { o = o || {}; const a = node.animate(kf, Object.assign({ fill:'both' }, o)); anims.push(a);
  if (!o.keep) a.finished.then(() => { if (node.isConnected) try { a.cancel(); } catch {} }, () => {}); return a; };
const done = a => a.finished.catch(() => {});
const beat = ms => new Promise(r => { const t0 = performance.now(); (function chk(){ if (skipping || performance.now() - t0 >= ms) r(); else requestAnimationFrame(chk); })(); });
/* once everything on the page has loaded (fonts too), so nothing jumps mid-show,
   and the page is actually on screen: a tab in the background waits until it's looked at */
const visible = () => new Promise(r => {
  if (document.visibilityState === 'visible') return r();
  const f = () => { if (document.visibilityState === 'visible'){ document.removeEventListener('visibilitychange', f); setTimeout(r, 300); } };
  document.addEventListener('visibilitychange', f);
});
const pageReady = () => new Promise(r => {
  const go = () => Promise.resolve(document.fonts && document.fonts.ready).catch(() => {}).then(() => setTimeout(r, 250));
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once:true });
}).then(visible);
const untilServer = t => new Promise(r => { const ms = t ? t - serverNow() : 0; if (ms > 0 && ms < 20000) setTimeout(r, ms); else r(); });
/* the rest of the page can't be clicked while a show plays (with a safety release) */
let lockT = null;
function lock(on){
  document.body.classList.toggle('plockui', on);
  document.body.classList.toggle('pshow', on);
  clearTimeout(lockT); if (on) lockT = setTimeout(() => lock(false), 25000);
}
function skipper(target){
  skipping = false; anims.length = 0;
  const go = () => { skipping = true; anims.forEach(a => { try { a.finish(); } catch {} }); };
  const key = e => { if (e.key === 'Escape') go(); };
  addEventListener('keydown', key);
  if (target) target.addEventListener('click', go);
  return () => {
    removeEventListener('keydown', key);
    if (target) target.removeEventListener('click', go);
    anims.length = 0; skipping = false;
  };
}
const area = () => { const c = el.querySelector('.pcard') || el; return c.getBoundingClientRect(); };
async function toView(){
  const r = area();
  if (r.top < 60 || r.bottom > innerHeight - 20){ el.scrollIntoView({ block:'center', behavior:'smooth' }); await wait(500); }
}
function shake(node, px, ms){
  if (!node) return;
  const k = [{ transform:'none' }];
  for (let i = 0; i < 6; i++) k.push({ transform:'translate(' + rand(-px, px).toFixed(1) + 'px,' + rand(-px / 2, px / 2).toFixed(1) + 'px)' });
  k.push({ transform:'none' });
  node.animate(k, { duration:ms || 360, easing:'ease-out' });
}

/* ── particles: one canvas over the screen, gone when they've all faded ── */
let smokeImgs = null;
function smokeSprites(){
  if (smokeImgs) return smokeImgs;
  /* a lumpy puff: lots of soft blobs, so it billows instead of looking like a circle */
  const make = (rgb, a) => { const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d');
    for (let i = 0; i < 22; i++){ const px = 80 + rand(-38, 38), py = 80 + rand(-38, 38), r = rand(16, 44);
      const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill(); }
    return c; };
  return smokeImgs = [make('120,118,124', .18), make('92,90,96', .17), make('170,168,172', .17)];
}
function particles(spawn, ms){
  const cv = document.createElement('canvas'); cv.className = 'pfx';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const bits = spawn(), t0 = performance.now();
  const step = now => {
    const t = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits){
      if (b.at && t < b.at) continue;
      const age = t - (b.at || 0), life = 1 - Math.min(1, age / (b.life || ms));
      if (life <= 0) continue;
      b.vy += b.g; b.vx *= b.drag; b.vy *= b.drag; b.x += b.vx; b.y += b.vy; b.rot += b.vr || 0;
      if (b.grow) b.w += b.grow;
      ctx.save();
      const fadeIn = b.fadeIn ? Math.min(1, age / b.fadeIn) : 1;
      ctx.globalAlpha = (b.alpha || 1) * fadeIn * Math.min(1, life * 1.6);
      ctx.translate(b.x, b.y);
      if (b.streak){                                     // a spark: a short bright streak along its path
        ctx.strokeStyle = b.c; ctx.lineWidth = b.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-b.vx * b.streak, -b.vy * b.streak); ctx.stroke();
      } else if (b.sprite){
        ctx.rotate(b.rot); ctx.drawImage(b.sprite, -b.w / 2, -b.w / 2, b.w, b.w);
      } else {
        ctx.rotate(b.rot); ctx.fillStyle = b.c;
        if (b.round){ ctx.beginPath(); ctx.arc(0, 0, b.w / 2, 0, 6.283); ctx.fill(); }
        else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.rot * 1.7)) + 1);
      }
      ctx.restore();
    }
    if (t < ms) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}
/* dust kicked up along an edge when something lands */
function dust(r, n){
  const S = smokeSprites();
  particles(() => Array.from({ length:n || 26 }, (_, i) => {
    const side = i % 2 ? 1 : -1, x = r.left + rand(0, r.width);
    return { x, y:r.bottom - rand(0, 10), vx:side * rand(.8, 3.4), vy:-rand(.2, 1.2), g:-.004, drag:.965, rot:rand(0, 6), vr:rand(-.01, .01),
      w:rand(30, 70), grow:.7, sprite:S[i % 3], alpha:1, fadeIn:80, life:rand(700, 1100) };
  }).concat(Array.from({ length:14 }, () => ({ x:r.left + rand(0, r.width), y:r.bottom - 4, vx:rand(-4, 4), vy:-rand(2, 5), g:.28, drag:.98,
      rot:rand(0, 6), vr:rand(-.3, .3), w:rand(3, 6), h:rand(3, 6), c:getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#bbb', life:800 }))), 1200);
}
function confetti(r, ms){
  const cols = PARTY(), pad = Math.min(80, r.width * .08);
  const top = Math.max(-20, r.top - 40), bottom = Math.min(innerHeight, r.top + Math.max(r.height, 320) + 20);
  particles(() => {
    const out = [];
    for (let i = 0; i < 300; i++)
      out.push({ x:r.left - pad + Math.random() * (r.width + pad * 2), y:top - Math.random() * 30, vx:rand(-1, 1), vy:rand(1.5, 3.7), g:.035, drag:.992,
        rot:rand(0, 6), vr:rand(-.15, .15), w:rand(7, 12), h:rand(10, 17), c:cols[i % cols.length], life:Math.min(2600, (bottom - top) * 9), at:Math.random() * (ms - 2200) });
    for (let i = 0; i < 110; i++){
      const lf = i % 2 === 0, a = lf ? -Math.PI / 3 - rand(0, .5) : -2 * Math.PI / 3 + rand(0, .5), s = rand(11, 18);
      out.push({ x:lf ? r.left + 10 : r.right - 10, y:bottom - 10, vx:Math.cos(a) * s, vy:Math.sin(a) * s, g:.26, drag:.985,
        rot:rand(0, 6), vr:rand(-.2, .2), w:rand(7, 11), h:rand(9, 15), c:cols[(i + 3) % cols.length], life:ms - 400, at:200 });
    }
    return out;
  }, ms + 200);
}
function fireworks(r, n, delay){
  const cols = PARTY();
  particles(() => {
    const out = [];
    for (let k = 0; k < n; k++){
      const x = r.left + r.width * rand(.05, .95), y = r.top + Math.min(r.height, 360) * rand(.1, .65), c = cols[k % cols.length], at = (delay || 0) + k * 360;
      for (let i = 0; i < 64; i++){ const a = i / 64 * 6.283, s = rand(3, 7.5);
        out.push({ x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s, g:.06, drag:.972, streak:2.2, w:2.2, c, life:1200, at }); }
    }
    return out;
  }, (delay || 0) + n * 360 + 1400);
}

/* ═══ Monday: the new question takes over the card ═══════════════════════
   `from` is how the card looked last time (saved by draw). It's drawn exactly
   like that over the new card, and the two swap places in the week's show. */
function oldHtml(v){
  let body;
  const p = { question:v.question, kind:v.kind, total:v.total, results:v.results && v.results.length ? v.results : null, pick:v.pick || 1, canVote:true, options:[] };
  if (v.state === 'vote') body = '<div class="pvote"><div class="pinwrap"><div class="pin pfake">' + esc(PLACEHOLDER[v.kind] || 'Type your answer…') + '</div></div>' +
    '<span class="btn primary pgo" style="opacity:.45">Vote</span></div>' + teaseHtml();
  else if (v.state === 'signin') body = '<p class="psignp">Sign in with your school login to vote.</p>';
  else if (v.state === 'voted') body = doneHtml(null) + resultsHtml(p.results, p.total, 0, null, p.pick, true);
  else if (v.state === 'blank') body = '<div class="pblank"></div>';
  else body = resultsHtml(p.results, p.total, 0, null, p.pick, false) + (v.state === 'closed' ? comeBack() : '');
  return frame(body, v.question ? { question:v.question } : null, { chip:chipFor(v.state) || 'This week’s poll · anonymous' }).replace(/ id="[^"]*"/g, '');
}
function intro(show, from, startAt){
  if (reduced()) return;
  const card = el.querySelector('.pcard'); if (!card || !card.animate) return;
  /* set the scene straight away (the old card in front, the new one hidden), then wait for the page */
  let old = null;
  if (from){ old = document.createElement('div'); old.className = 'pold'; old.innerHTML = oldHtml(from); el.appendChild(old); }
  card.style.visibility = 'hidden';
  if (show === 'first'){ el.style.height = '0px'; el.style.marginBottom = '0px'; }
  /* the card keeps the old card's height during the show, then eases to its own,
     so nothing below jumps or gets covered */
  const oldH = old ? old.offsetHeight : 0, newH = card.offsetHeight;
  if (old && Math.abs(oldH - newH) > 2) el.style.height = oldH + 'px';
  lock(true);
  const stop = skipper(el);
  (async () => {
    await pageReady(); await untilServer(startAt); await toView();
    lock(true);                                       // (again: a long wait may have let the first lock lapse)
    /* a taller new card: the widgets below slide down to make room first, so
       nothing of the show ever lands on them */
    let fromH = old ? oldH : newH;
    if (old && newH > oldH + 2){
      await done(play(el, [{ height:oldH + 'px' }, { height:newH + 'px' }], { duration:skipping ? 1 : 420, easing:'cubic-bezier(.3,.7,.2,1)', keep:true }));
      el.style.height = newH + 'px'; fromH = newH;
    }
    card.style.visibility = '';
    el.dataset.oldh = String(fromH); el.dataset.newh = String(newH);
    await (INTROS[show] || INTROS.drop)(card, old ? old.firstElementChild : null);
    if (old && oldH - newH > 2 && el.dataset.grown !== '1')            // a shorter new card: close the gap after
      await done(play(el, [{ height:oldH + 'px' }, { height:newH + 'px' }], { duration:skipping ? 1 : 450, easing:'cubic-bezier(.3,.7,.2,1)', keep:true }));
  })().catch(e => console.error(e)).finally(() => {
    stop(); lock(false);
    if (old) old.remove();
    ['visibility', 'zIndex', 'transformOrigin', 'opacity', 'filter', 'overflow'].forEach(k => card.style[k] = '');
    el.getAnimations().forEach(a => { try { a.cancel(); } catch {} });
    el.style.height = ''; el.style.marginBottom = ''; el.style.perspective = ''; el.style.overflow = '';
    delete el.dataset.oldh; delete el.dataset.newh; delete el.dataset.grown;
    pushed.forEach(a => { try { a.cancel(); } catch {} }); pushed.length = 0;
    el.querySelectorAll('.pchain,.pshard,.preelwin').forEach(x => x.remove());
  });
}
const front = (card, z) => { card.style.zIndex = String(z); };
const pushed = [];                                     // animations on the widgets below, undone when a show ends
/* a cubic-bezier easing as a function, to know where an eased animation is at time t */
const bezier = (x1, y1, x2, y2) => t => {
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++){ const u = (lo + hi) / 2, x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; if (x < t) lo = u; else hi = u; }
  const u = (lo + hi) / 2; return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
};
const squash = card => play(card, [{ transform:'scale(1.03,.9)', transformOrigin:'50% 100%' }, { transform:'scale(.99,1.03)', transformOrigin:'50% 100%', offset:.45 },
  { transform:'none', transformOrigin:'50% 100%' }], { duration:420, easing:'cubic-bezier(.2,.8,.3,1)' });

const INTROS = {
  /* the very first poll someone sees: it lands, shoves the page down to make
     room, and then its question decodes itself letter by letter */
  async first(card){
    const H = card.offsetHeight, r = card.getBoundingClientRect();
    front(card, 6);
    const q = card.querySelector('.pq'), text = q ? q.textContent : '';
    const bits = [...card.querySelectorAll('.pbody > *, .pfoot')];
    if (q) q.style.visibility = 'hidden';
    bits.forEach(b => b.style.opacity = '0');
    try {
      const rest = document.getElementById('hubrest');
      play(el, [{ height:'0px', marginBottom:'0px' }, { height:H + 'px', marginBottom:'18px' }], { duration:720, delay:200, easing:'cubic-bezier(.5,0,.3,1)', keep:true });
      await done(play(card, [{ transform:'translateY(' + -(r.top + H + 120) + 'px) rotate(-3deg)' }, { transform:'none' }], { duration:900, easing:'cubic-bezier(.55,0,.85,.45)' }));
      squash(card); shake(el, 8, 380);
      if (rest) rest.animate([{ transform:'none' }, { transform:'translateY(12px)' }, { transform:'none' }], { duration:420, easing:'cubic-bezier(.2,.8,.3,1)' });
      dust(card.getBoundingClientRect(), 30);
      await beat(350);
      if (q){ q.style.visibility = ''; await decode(q, text, 1100); }
      bits.forEach((b, i) => play(b, [{ opacity:0, transform:'translateY(12px)' }, { opacity:1, transform:'none' }], { duration:450, delay:i * 110, easing:'cubic-bezier(.2,.7,.2,1)' }));
      bits.forEach(b => b.style.opacity = '');
      await beat(bits.length * 110 + 450);
    } finally { if (q){ q.style.visibility = ''; q.textContent = text; } bits.forEach(b => b.style.opacity = ''); }
  },
  /* The Drop: the new card falls out of the sky onto the old one */
  async drop(card, old){
    front(card, 6);
    const r = card.getBoundingClientRect();
    await done(play(card, [{ transform:'translateY(' + -(r.bottom + 80) + 'px) rotate(-3deg)' }, { transform:'none' }], { duration:640, easing:'cubic-bezier(.55,0,.9,.45)' }));
    if (old) play(old, [{ transform:'none', opacity:1 }, { transform:'translateY(16px) scaleY(.92)', opacity:0 }], { duration:220, keep:true });
    squash(card); shake(el, 9, 400);
    dust(card.getBoundingClientRect(), 30);
    await beat(520);
  },
  /* Wrecking ball: the new card swings in on a chain from off the page and knocks the old one away */
  async wreck(card, old){
    front(card, 6);
    const r = card.getBoundingClientRect(), A = 62;
    /* a chain long enough that at the top of the swing the card is fully off the left edge, on any screen */
    const L = Math.max(700, (r.right + 140) / Math.sin(A * Math.PI / 180));
    card.style.transformOrigin = '50% ' + -L + 'px';
    card.style.overflow = 'visible';                   // so the chain above it shows
    const chain = document.createElement('div'); chain.className = 'pchain'; chain.style.height = L + 'px'; card.appendChild(chain);
    const D = 900, EASE = [.42, 0, .78, .55];
    const swing = play(card, [{ transform:'rotate(' + A + 'deg)' }, { transform:'rotate(0deg)' }], { duration:D, easing:'cubic-bezier(' + EASE + ')' });
    /* The widgets below get out of the way: a tilted card's low corner reaches
       below where it will sit, so they're pushed down ahead of it (never
       overlapped), jolted on impact, kept clear through the wobble, then
       settle as the card takes its own height. */
    const rest = document.getElementById('hubrest');
    const oldH = +el.dataset.oldh || r.height, newH = +el.dataset.newh || r.height, w = r.width, h = r.height;
    const dip = deg => { const t = deg * Math.PI / 180; return w / 2 * Math.abs(Math.sin(t)) + h / 2 * Math.cos(t) - h / 2 - L * (1 - Math.cos(t)); };
    const room = deg => Math.max(0, newH + dip(deg) + 12 - oldH - 18);     // 18: the gap under the poll
    const ease = bezier(...EASE), N = 24, frames = []; let most = 0;
    for (let k = 0; k <= N; k++){ most = Math.max(most, room(A * (1 - ease(k / N)))); frames.push({ transform:'translateY(' + most.toFixed(1) + 'px)', offset:k / N }); }
    const hold = Math.max(most, room(6.5));                                  // the wobble tilts it 6° the other way
    if (rest && hold > 0) pushed.push(play(rest, frames, { duration:D, easing:'linear', keep:true }));
    await beat(D * .82);
    if (old){
      const o = old.getBoundingClientRect();
      /* knocked off to the side and up a little: it never comes down over the widgets below */
      play(old, [{ transform:'none', opacity:1 }, { transform:'translate(' + innerWidth * .55 + 'px,-80px) rotate(10deg)', opacity:1, offset:.6 },
        { transform:'translate(' + innerWidth * 1.15 + 'px,-170px) rotate(22deg)', opacity:0 }], { duration:1000, easing:'cubic-bezier(.12,.6,.3,1)', keep:true });
      particles(() => Array.from({ length:28 }, () => ({ x:o.left + rand(0, 30), y:o.top + rand(0, o.height), vx:rand(2, 9), vy:rand(-5, 2), g:.3, drag:.98,
        rot:rand(0, 6), vr:rand(-.3, .3), w:rand(4, 8), h:rand(3, 7), c:'#b8b8c0', life:900 })), 1000);
    }
    await done(swing);
    shake(el, 7, 320);
    if (rest && hold > 0) pushed.push(play(rest, [{ transform:'translateY(' + most + 'px)' }, { transform:'translateY(' + (hold + 16) + 'px)', offset:.35 },
      { transform:'translateY(' + hold + 'px)' }], { duration:skipping ? 1 : 360, easing:'cubic-bezier(.2,.8,.3,1)', keep:true }));
    await done(play(card, [{ transform:'rotate(0)' }, { transform:'rotate(-6deg)', offset:.3 }, { transform:'rotate(2.5deg)', offset:.6 },
      { transform:'rotate(-.8deg)', offset:.85 }, { transform:'rotate(0)' }], { duration:1000, easing:'ease-out' }));
    /* settle: the poll takes its own height while the widgets come back up to sit under it */
    if (rest && hold > 0){
      const settle = { duration:skipping ? 1 : 520, easing:'cubic-bezier(.3,.7,.2,1)', keep:true };
      if (Math.abs(newH - oldH) > 2){ pushed.push(play(el, [{ height:oldH + 'px' }, { height:newH + 'px' }], settle)); el.dataset.grown = '1'; }
      pushed.push(play(rest, [{ transform:'translateY(' + hold + 'px)' }, { transform:'translateY(0)' }], settle));
    }
    await done(play(chain, [{ opacity:1, transform:'translateY(0)' }, { opacity:0, transform:'translateY(-60px)' }], { duration:400, keep:true }));
  },
  /* Topple: the old card wobbles, a little at first, then more and more, until
     it goes over forwards (gathering speed like something heavy) and bounces */
  async topple(card, old){
    if (!old) return INTROS.drop(card, old);
    front(card, 4); old.parentElement.style.zIndex = '6';
    old.parentElement.style.perspective = '1100px'; old.parentElement.style.perspectiveOrigin = '50% 100%';
    play(card, [{ transform:'scale(.96)', filter:'brightness(.75)' }, { transform:'scale(.96)', filter:'brightness(.75)', offset:.6 }, { transform:'none', filter:'none' }],
      { duration:2600, easing:'ease-out' });
    old.style.transformOrigin = '50% 100%';
    const sway = 'cubic-bezier(.45,0,.55,1)';
    await done(play(old, [
      { transform:'rotateX(0deg)', easing:sway },
      { transform:'rotateX(1deg)', offset:.07, easing:sway },
      { transform:'rotateX(-1.4deg)', offset:.15, easing:sway },
      { transform:'rotateX(2.2deg)', offset:.24, easing:sway },
      { transform:'rotateX(-3.2deg)', offset:.34, easing:sway },
      { transform:'rotateX(4.6deg)', offset:.45, easing:sway },
      { transform:'rotateX(-6deg)', offset:.56, easing:'cubic-bezier(.45,0,1,.7)' },      // past the point of no return…
      { transform:'rotateX(-88deg)', filter:'brightness(.6)', offset:.9, easing:'cubic-bezier(.3,0,.6,1)' },
      { transform:'rotateX(-81deg)', filter:'brightness(.6)', offset:.95, easing:'cubic-bezier(.4,0,1,1)' },
      { transform:'rotateX(-88deg)', filter:'brightness(.55)' }], { duration:2600, easing:'linear', keep:true }));
    old.style.visibility = 'hidden';
    shake(el, 10, 420);
    const r = card.getBoundingClientRect();
    dust({ left:r.left, width:r.width, bottom:r.bottom + 6 }, 34);
    await beat(450);
  },
  /* Explode: cracks race out from the middle, the card shatters, and the new one comes through the smoke */
  async explode(card, old){
    if (!old) return INTROS.drop(card, old);
    const wrap = old.parentElement;
    wrap.style.zIndex = '6'; front(card, 4);
    card.style.opacity = '0';
    const W = old.offsetWidth, H = old.offsetHeight, cols = 5, rows = 3;
    /* the shards: a jittered grid cut into triangles */
    const P = [];
    for (let j = 0; j <= rows; j++){ P[j] = [];
      for (let i = 0; i <= cols; i++){
        const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
        P[j][i] = [ (i / cols) * 100 + (edgeX ? 0 : rand(-7, 7)), (j / rows) * 100 + (edgeY ? 0 : rand(-11, 11)) ];
      } }
    const tris = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++){
      const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
      if (Math.random() < .5){ tris.push([a, b, c]); tris.push([a, c, d]); } else { tris.push([a, b, d]); tris.push([b, c, d]); }
    }
    /* the cracks: jagged rays from the centre, a few branching, each one racing outwards */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pcracks'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const ox0 = W / 2, oy0 = H / 2, R = Math.hypot(W, H) / 2;
    const crack = (x, y, ang, steps, len, delay, width) => {
      const pts = [[x, y]];
      for (let k = 0; k < steps; k++){
        ang += rand(-.38, .38);
        x += Math.cos(ang) * len * rand(.75, 1.25); y += Math.sin(ang) * len * rand(.75, 1.25);
        pts.push([x, y]);
        if (k === 1 && steps > 3 && Math.random() < .65) crack(x, y, ang + (Math.random() < .5 ? -1 : 1) * rand(.5, 1.1), 3, len * .7, delay + 140, width * .7);
      }
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L'));
      p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; p.style.strokeWidth = width + 'px';
      p.style.animation = 'pcrack .5s ' + delay + 'ms cubic-bezier(.2,.6,.3,1) forwards';
      svg.appendChild(p);
    };
    const rays = 11;
    for (let i = 0; i < rays; i++) crack(ox0, oy0, (i / rays) * 6.283 + rand(-.2, .2), 6, R / 6, rand(0, 160), 2.6);
    old.appendChild(svg);
    /* the build-up: it strains and shudders */
    await done(play(old, Array.from({ length:16 }, (_, i) => ({ transform:'translate(' + rand(-i * .55, i * .55).toFixed(1) + 'px,' + rand(-i * .35, i * .35).toFixed(1) + 'px)',
      filter:'brightness(' + (1 + i * .03) + ')' })), { duration:skipping ? 1 : 1150, easing:'linear', keep:true }));
    /* it goes */
    const r = old.getBoundingClientRect();
    old.style.visibility = 'hidden';
    const shards = tris.map(t => {
      const s = wrap.cloneNode(true); s.className = 'pshard';
      s.firstElementChild.style.visibility = 'visible';
      s.style.clipPath = 'polygon(' + t.map(p => p[0] + '% ' + p[1] + '%').join(',') + ')';
      el.appendChild(s);
      const mx = (t[0][0] + t[1][0] + t[2][0]) / 3, my = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const dx = (mx - 50) / 50, dy = (my - 50) / 50, sp = rand(.8, 1.3);
      /* out to the sides and up, each spinning about its own middle, gone before
         it could come down over the widgets below */
      s.style.transformOrigin = mx + '% ' + my + '%';
      const tx = dx * W * .7 * sp, ty = Math.min(0, dy) * H * .5 * sp - rand(70, 170), rz = rand(-70, 70), rx = rand(-55, 55), ry = rand(-55, 55);
      play(s, [{ transform:'none', opacity:1 },
        { transform:'perspective(900px) translate3d(' + tx * .55 + 'px,' + (ty * .55 - 20) + 'px,' + rand(40, 140) + 'px) rotateX(' + rx * .5 + 'deg) rotateY(' + ry * .5 + 'deg) rotateZ(' + rz * .5 + 'deg)', opacity:1, offset:.35 },
        { transform:'perspective(900px) translate3d(' + tx + 'px,' + ty + 'px,' + rand(-40, 100) + 'px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) rotateZ(' + rz + 'deg)', opacity:0 }],
        { duration:rand(1100, 1500), easing:'cubic-bezier(.2,.6,.4,1)', keep:true });
      return s;
    });
    shake(el, 14, 520);
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2, S = smokeSprites();
    particles(() => Array.from({ length:110 }, () => { const a = rand(0, 6.283), s = rand(6, 19);
      return { x:ox + rand(-r.width * .3, r.width * .3), y:oy + rand(-r.height * .2, r.height * .2), vx:Math.cos(a) * s, vy:Math.sin(a) * s - 2, g:.22, drag:.955,
        streak:1.6, w:rand(1.2, 2.6), c:['#ffd43b', '#ffa94d', '#fff3bf', '#ff922b'][Math.floor(rand(0, 4))], life:rand(450, 900) }; }), 1000);
    particles(() => Array.from({ length:46 }, (_, i) => { const a = rand(0, 6.283), s = rand(.6, 3.2);
      return { x:ox + rand(-r.width * .35, r.width * .35), y:oy + rand(-r.height * .3, r.height * .3), vx:Math.cos(a) * s, vy:Math.sin(a) * s * .6 - rand(.2, .9),
        g:-.006, drag:.975, rot:rand(0, 6), vr:rand(-.006, .006), w:rand(110, 220), grow:rand(1.1, 2.2), sprite:S[i % 3], alpha:1, fadeIn:160,
        life:rand(1600, 2600), at:rand(0, 200) }; }), 2900);
    await beat(420);
    await done(play(card, [{ opacity:0, transform:'scale(.95)', filter:'blur(14px)' }, { opacity:1, transform:'none', filter:'blur(0)' }],
      { duration:skipping ? 1 : 1200, easing:'cubic-bezier(.3,.6,.2,1)' }));
    card.style.opacity = '';
    setTimeout(() => shards.forEach(s => s.remove()), 1200);
  },
  /* Flip: a quick spin like a sign, and the new side settles with a little wobble */
  async flip(card, old){
    if (!old) return INTROS.drop(card, old);
    const wrap = old.parentElement;
    wrap.style.zIndex = '6'; front(card, 4);
    /* edge-on, the near side of a turning card looms bigger; a deeper perspective
       and a slight shrink mid-turn keep it inside its own space */
    el.style.perspective = '3000px'; wrap.style.perspective = '3000px';
    card.style.visibility = 'hidden';
    await done(play(old, [{ transform:'rotateY(0deg) scale(1)' }, { transform:'rotateY(90deg) scale(.84)', filter:'brightness(.7)' }], { duration:260, easing:'cubic-bezier(.5,0,1,.6)', keep:true }));
    old.style.visibility = 'hidden';
    card.style.visibility = '';
    await done(play(card, [
      { transform:'rotateY(-90deg) scale(.84)', filter:'brightness(.7)', easing:'cubic-bezier(0,.5,.4,1)' },
      { transform:'rotateY(14deg) scale(1)', offset:.4, easing:'cubic-bezier(.45,0,.55,1)' },
      { transform:'rotateY(-6deg)', offset:.65, easing:'cubic-bezier(.45,0,.55,1)' },
      { transform:'rotateY(2deg)', offset:.85, easing:'cubic-bezier(.45,0,.55,1)' },
      { transform:'rotateY(0deg)' }], { duration:1100 }));
  },
  /* Slot reel: the card spins like a reel through gibberish cards, slows right down, and clunks to a stop */
  async slot(card, old){
    const H = card.offsetHeight;
    const win = document.createElement('div'); win.className = 'preelwin'; win.style.height = H + 'px';
    const blur = document.createElement('div');
    const strip = document.createElement('div'); strip.className = 'preelstrip';
    const frameOf = html => '<div class="preelcell" style="height:' + H + 'px">' + html + '</div>';
    const cells = [old ? frameOf(old.outerHTML) : frameOf(gibberishCard())];
    for (let i = 0; i < 9; i++) cells.push(frameOf(gibberishCard()));
    cells.push(frameOf(card.outerHTML.replace(/ id="[^"]*"/g, '')));
    strip.innerHTML = cells.join('');
    blur.appendChild(strip); win.appendChild(blur); el.appendChild(win);
    if (old) old.parentElement.style.visibility = 'hidden';
    card.style.visibility = 'hidden';
    const n = cells.length - 1, D = 3600;
    play(el, [{ transform:'none' }, { transform:'translateY(6px)' }, { transform:'none' }], { duration:260 });     // the lever
    play(blur, [{ filter:'blur(0)' }, { filter:'blur(4px)', offset:.18 }, { filter:'blur(3px)', offset:.5 }, { filter:'blur(0)', offset:.78 }, { filter:'blur(0)' }],
      { duration:skipping ? 1 : D, easing:'linear' });
    await done(play(strip, [
      { transform:'translateY(0)', easing:'cubic-bezier(.3,0,.6,1)' },
      { transform:'translateY(16px)', offset:.06, easing:'cubic-bezier(.35,.4,.2,1)' },        // a jolt back, then off it goes…
      { transform:'translateY(' + (-H * n - 26) + 'px)', offset:.93, easing:'cubic-bezier(.3,0,.4,1)' },   // …slowing, slowing…
      { transform:'translateY(' + -H * n + 'px)' }], { duration:skipping ? 1 : D, keep:true }));
    card.style.visibility = '';
    win.remove();
    shake(el, 6, 260);
    await done(play(card, [{ transform:'translateY(-5px)' }, { transform:'none' }], { duration:180 }));
  }
};
/* a made-up card for the reel: a gibberish question and gibberish answers */
function gibberishCard(){
  const L = 'abcdefghijklmnopqrstuvwxyz';
  const wd = (a, b) => Array.from({ length:Math.floor(rand(a, b)) }, () => L[Math.floor(Math.random() * 26)]).join('');
  const q = Array.from({ length:Math.floor(rand(3, 6)) }, wd.bind(null, 2, 8)).join(' ');
  const bars = [72, 50, 36, 20].map(w => '<div class="pbar"><span class="pbl">' + wd(4, 9) + ' ' + wd(3, 8) + '</span><span class="pfill" style="width:' + (w + rand(-8, 8)).toFixed(0) + '%"></span></div>').join('');
  return '<div class="pcard pfiller"><div class="phead"><span class="pchip">' + wd(4, 7) + ' ' + wd(3, 6) + '</span></div>' +
    '<h2 class="pq">' + q.charAt(0).toUpperCase() + q.slice(1) + '?</h2><div class="pbars">' + bars + '</div></div>';
}
/* the question scrambles into place, left to right */
function decode(node, text, ms){
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#%&?';
  return new Promise(res => {
    const t0 = performance.now();
    (function step(){
      const k = skipping ? 1 : Math.min(1, (performance.now() - t0) / ms);
      const upto = Math.floor(k * text.length);
      node.textContent = [...text].map((c, i) => i < upto || c === ' ' ? c : CH[Math.floor(Math.random() * CH.length)]).join('');
      if (k < 1) requestAnimationFrame(step); else { node.textContent = text; res(); }
    })();
  });
}

/* ═══ Friday: the celebration ═══════════════════════════════════════════
   Inside the card: a build-up, the question called back ("The person most
   likely to … is…"), a drumroll, the winner with a gold medal, then second and
   third rising in, confetti, and the full leaderboard on the card. */
function stage(cls){
  el.classList.add('pstaged');
  const s = document.createElement('div');
  s.className = 'pstage' + (cls ? ' ' + cls : '');
  s.innerHTML = '<div class="pbg" aria-hidden="true"></div><div class="pbulbs" aria-hidden="true"></div><div class="pstagein"></div><button type="button" class="pstskip">Skip</button>';
  el.appendChild(s);
  return s;
}
async function unstage(s){
  if (!s || !s.isConnected) return;
  await done(play(s, [{ opacity:1 }, { opacity:0 }], { duration:skipping ? 120 : 500, keep:true }));
  s.remove(); el.classList.remove('pstaged');
}
const put = (s, cls, html) => { const t = document.createElement('div'); t.className = 'pbig ' + cls; t.innerHTML = html; s.querySelector('.pstagein').appendChild(t); return t; };
const lettersHtml = s => String(s).split(' ').map(w => '<span class="pword">' + [...w].map(c => '<span class="plet">' + esc(c) + '</span>').join('') + '</span>').join(' ');
async function popLetters(node, gap){
  const ls = [...node.querySelectorAll('.plet')];
  ls.forEach((l, i) => play(l, [{ opacity:0, transform:'translateY(.35em) scale(1.6)' }, { opacity:1, transform:'none' }], { duration:340, delay:i * gap, easing:'cubic-bezier(.2,.9,.3,1.3)' }));
  await beat(ls.length * gap + 340);
}
async function sayLine(s, line, cls){ const t = put(s, 'pline ' + (cls || ''), lettersHtml(line)); await popLetters(t, Math.max(14, Math.min(40, 900 / line.length))); return t; }
async function drumroll(node, ms){
  el.classList.add('pdrum');
  const N = Math.max(2, Math.round(ms / 70));
  await done(play(node, Array.from({ length:N }, (_, i) => ({ transform:'translate(' + (rand(-1, 1) * (1 + i / N * 3)).toFixed(1) + 'px,' + (rand(-1, 1) * (1 + i / N * 2)).toFixed(1) + 'px)' })),
    { duration:skipping ? 1 : ms }));
  el.classList.remove('pdrum');
}
/* the winner (a gold medal on the name's corner); second and third come up from below */
async function nameIn(s, o, from){
  const n = put(s, 'pwinner', '<span class="pnamewrap"><span class="pname">' + esc(o.w.label) + (o.tie ? '<small> and </small>' + esc(o.second.label) : '') +
    '</span><span class="pmedal" aria-hidden="true">🥇</span></span>');
  play(n, from || [{ opacity:0, transform:'scale(.2)' }, { opacity:1, transform:'scale(1.15)', offset:.6 }, { opacity:1, transform:'none' }], { duration:800, easing:'cubic-bezier(.2,.9,.3,1.2)' });
  play(n.querySelector('.pmedal'), [{ opacity:0, transform:'scale(0) rotate(-40deg)' }, { opacity:1, transform:'scale(1.3) rotate(10deg)', offset:.7 }, { opacity:1, transform:'none' }],
    { duration:600, delay:650, easing:'cubic-bezier(.3,1.4,.5,1)' });
  /* the runners-up, slowly */
  const rest = o.results.slice(o.tie ? 2 : 1, o.tie ? 3 : 3);
  if (rest.length){
    const ru = document.createElement('div'); ru.className = 'prunners';
    ru.innerHTML = rest.map((r, i) => '<span class="prun"><span class="pmedal" aria-hidden="true">' + (o.tie ? '🥈' : i ? '🥉' : '🥈') + '</span>' + esc(r.label) + '</span>').join('');
    n.appendChild(ru);
    [...ru.children].forEach((x, i) => play(x, [{ opacity:0, transform:'translateY(46px)' }, { opacity:1, transform:'none' }], { duration:1100, delay:1500 + i * 900, easing:'cubic-bezier(.2,.7,.2,1)' }));
  }
  return n;
}
function flash(s, color){
  const f = document.createElement('div'); f.className = 'pflash'; if (color) f.style.background = color;
  s.appendChild(f);
  done(play(f, [{ opacity:.95 }, { opacity:0 }], { duration:650, easing:'ease-out', keep:true })).then(() => f.remove());
}
/* smooth back-and-forth keyframes, settling to `end` (no jerk at the finish) */
const sweep = (amp, turns, end, n) => Array.from({ length:n || 60 }, (_, i) => {
  const t = i / ((n || 60) - 1), damp = Math.pow(1 - t, 1.6);
  return { transform:'rotate(' + (end + amp * damp * Math.sin(t * turns * 6.283)).toFixed(2) + 'deg)' };
});
/* ease an endless spin's speed up or down, so nothing ever starts or stops with a jolt */
function rampRate(a, to, ms){
  return new Promise(res => {
    const from = a.playbackRate, t0 = performance.now();
    (function f(){
      const k = skipping ? 1 : Math.min(1, (performance.now() - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = from + (to - from) * e;
      if (a.updatePlaybackRate) a.updatePlaybackRate(v); else a.playbackRate = v;
      if (k < 1) requestAnimationFrame(f); else res();
    })();
  });
}

async function celebrate(p, line, show, startAt){
  if (reduced() || !p.results || !p.results.length) return;
  const card = el.querySelector('.pcard'); if (!card || !card.animate) return;
  const [w, second] = p.results;
  const o = { w, second, tie:!!(second && second.votes === w.votes), total:p.total, results:p.results, line, q:p.question, reel:p.reel || [] };
  /* the stage goes up straight away, so the winner on the card isn't seen early */
  const s = stage('pc-' + show);
  lock(true);
  const stop = skipper(s);
  try {
    await pageReady(); await untilServer(startAt); await toView();
    lock(true);
    await (CELEBS[show] || CELEBS.spotlight)(s, o);
    s.classList.add('pblast');
    const r = card.getBoundingClientRect();
    if (!skipping){ confetti(r, 4600); fireworks(r, 8, 200); await beat(3800); }
    await unstage(s);
  } finally { stop(); lock(false); if (s.isConnected){ s.remove(); el.classList.remove('pstaged'); } }
  /* then the whole leaderboard, bottom up */
  const bars = [...card.querySelectorAll('#pbars .pbar')].filter(b => !b.classList.contains('extra'));
  bars.forEach((bar, i) => play(bar.querySelector('.pfill'), [{ width:'0%' }, { width:bar.dataset.pct + '%' }], { duration:700, delay:(bars.length - 1 - i) * 110, easing:'cubic-bezier(.2,.7,.2,1)' }));
  const win = document.getElementById('pwin');
  if (win) play(win, [{ transform:'scale(.7)', opacity:0 }, { transform:'scale(1.04)', opacity:1, offset:.7 }, { transform:'none', opacity:1 }], { duration:600, delay:bars.length * 110 });
}

const CELEBS = {
  /* Spotlight: house lights down, two spotlights hunt the stage and land on the winner */
  async spotlight(s, o){
    s.querySelector('.pbg').insertAdjacentHTML('afterend', '<div class="pbeam l"></div><div class="pbeam r"></div><div class="ppool"></div>');
    const [l, r] = s.querySelectorAll('.pbeam');
    play(l, sweep(34, 2.2, 14, 70), { duration:6200, easing:'linear', keep:true });
    play(r, sweep(-34, 2.6, -14, 70).map(k => ({ transform:'scaleX(-1) ' + k.transform.replace(/-?[\d.]+deg/, m => (-parseFloat(m)) + 'deg') })), { duration:6200, easing:'linear', keep:true });
    const k = put(s, 'pkick', 'Friday’s results');
    play(k, [{ opacity:0, letterSpacing:'.5em' }, { opacity:1, letterSpacing:'.22em' }], { duration:800 });
    await beat(900);
    const t = await sayLine(s, o.line);
    await drumroll(t, 1800);
    play(k, [{ opacity:1 }, { opacity:0 }], { duration:300, keep:true });
    play(t, [{ transform:'none' }, { transform:'translateY(-40%) scale(.72)', opacity:.75 }], { duration:500, keep:true });
    await beat(1300);
    flash(s, 'rgba(255,250,220,.6)');
    s.querySelector('.ppool').classList.add('on');
    await nameIn(s, o);
    await beat(1400);
  },
  /* Countdown: the game-show set spins up, the ring ticks down 3, 2, 1, and bursts */
  async countdown(s, o){
    s.querySelector('.pbg').insertAdjacentHTML('afterend',
      '<svg class="pring" viewBox="0 0 120 120" aria-hidden="true">' + [0, 1, 2].map(i =>
        '<path class="pseg" data-i="' + i + '" d="' + arc(60, 60, 50, i * 120 + 6, i * 120 + 114) + '"/>').join('') + '</svg>');
    const bg = s.querySelector('.pbg');
    const spin = bg.animate([{ transform:'rotate(0deg)' }, { transform:'rotate(360deg)' }], { duration:18000, iterations:Infinity });
    spin.playbackRate = 0;
    play(bg, [{ opacity:0 }, { opacity:1 }], { duration:900, keep:true });
    rampRate(spin, 3.2, 6500);                         // one long, smooth build to full speed
    const t = await sayLine(s, o.line, 'top');
    await beat(400);
    const ring = s.querySelector('.pring');
    await done(play(ring, [{ opacity:0, transform:'scale(.8)' }, { opacity:1, transform:'none' }], { duration:600, easing:'cubic-bezier(.2,.7,.2,1)', keep:true }));
    for (const n of [3, 2, 1]){
      if (skipping) break;
      const num = put(s, 'pnum', String(n));
      await done(play(num, [{ opacity:0, transform:'scale(1.5)' }, { opacity:1, transform:'scale(1)', offset:.22 }, { opacity:1, transform:'scale(.96)', offset:.8 }, { opacity:0, transform:'scale(.85)' }],
        { duration:1000, easing:'cubic-bezier(.25,.7,.3,1)', keep:true }));
      const seg = ring.querySelector('.pseg[data-i="' + (3 - n) + '"]');
      if (seg) play(seg, [{ opacity:1 }, { opacity:.12 }], { duration:450, easing:'ease-out', keep:true });
      num.remove();
    }
    rampRate(spin, .45, 3000);                         // and settles to a slow, steady turn
    play(ring, [{ transform:'none', opacity:1 }, { transform:'scale(2.2)', opacity:0 }], { duration:700, easing:'cubic-bezier(.2,.7,.2,1)', keep:true });
    play(t, [{ transform:'none' }, { transform:'translateY(-30%) scale(.8)', opacity:.85 }], { duration:500, keep:true });
    flash(s, '#fff');
    shake(el, 8, 420);
    await nameIn(s, o, [{ opacity:0, transform:'scale(2.2)', filter:'blur(8px)' }, { opacity:1, transform:'scale(.96)', filter:'blur(0)', offset:.65 }, { opacity:1, transform:'none' }]);
    await beat(1400);
  },
  /* Curtain: velvet curtains, the line on them, a drumroll, and they part on the winner */
  async curtain(s, o){
    s.querySelector('.pbg').insertAdjacentHTML('afterend', '<div class="pstagelit"></div><div class="pcurtain l"></div><div class="pcurtain r"></div><div class="pvalance"></div>');
    const t = await sayLine(s, o.line, 'oncurtain');
    const cl = s.querySelector('.pcurtain.l'), cr = s.querySelector('.pcurtain.r');
    await drumroll(t, 1600);
    play(t, [{ opacity:1 }, { opacity:0 }], { duration:300, keep:true });
    const open = (node, side) => play(node, [
      { clipPath:side < 0 ? 'polygon(0 0,100% 0,100% 30%,100% 58%,100% 100%,0 100%)' : 'polygon(0 0,100% 0,100% 100%,0 100%,0 58%,0 30%)', backgroundSize:'100% 100%,100% 100%,64px 100%' },
      { clipPath:side < 0 ? 'polygon(0 0,40% 0,30% 30%,16% 58%,20% 100%,0 100%)' : 'polygon(60% 0,100% 0,100% 100%,80% 100%,84% 58%,70% 30%)', backgroundSize:'100% 100%,100% 100%,26px 100%' }],
      { duration:1400, easing:'cubic-bezier(.6,0,.25,1)', keep:true });
    open(cl, -1); open(cr, 1);
    await beat(700);
    s.querySelector('.pstagelit').classList.add('on');
    await nameIn(s, o);
    await beat(1500);
  },
  /* Envelope: a gold envelope rises, the flap slowly opens (the card inside
     shows nothing yet), the card slides out, and then the name */
  async envelope(s, o){
    s.querySelector('.pbg').insertAdjacentHTML('afterend',
      '<div class="penv"><div class="penvback"></div><div class="pletter"><span class="pletterstar">★</span></div>' +
      '<div class="penvfront"></div><div class="penvflap"></div><div class="penvseal">★</div></div>');
    const env = s.querySelector('.penv'), flap = s.querySelector('.penvflap'), seal = s.querySelector('.penvseal'), letter = s.querySelector('.pletter');
    const t = await sayLine(s, o.line, 'top');
    await done(play(env, [{ transform:'translateY(150%)' }, { transform:'none' }], { duration:1000, easing:'cubic-bezier(.2,.8,.25,1)', keep:true }));
    await beat(500);
    /* the seal lifts, and the flap opens slowly: up to upright in front, then down behind the card */
    play(seal, [{ opacity:1, transform:'none' }, { opacity:0, transform:'translateY(-14px) scale(.8)' }], { duration:500, keep:true });
    await done(play(flap, [{ transform:'rotateX(0deg)' }, { transform:'rotateX(90deg)' }], { duration:skipping ? 1 : 900, easing:'cubic-bezier(.4,0,.6,1)', keep:true }));
    flap.classList.add('back');
    await done(play(flap, [{ transform:'rotateX(90deg)' }, { transform:'rotateX(180deg)' }], { duration:skipping ? 1 : 700, easing:'cubic-bezier(.2,.6,.3,1)', keep:true }));
    await beat(600);
    /* the card comes up out of the envelope, slowly, still face down */
    await done(play(letter, [{ transform:'translateY(0)' }, { transform:'translateY(-58%)' }], { duration:skipping ? 1 : 1600, easing:'cubic-bezier(.35,.1,.25,1)', keep:true }));
    await beat(700);
    flash(s, 'rgba(255,240,200,.85)');
    play(env, [{ opacity:1, transform:'none' }, { opacity:0, transform:'translateY(40%) scale(.85)' }], { duration:500, keep:true });
    play(t, [{ transform:'none' }, { transform:'translateY(-30%) scale(.8)', opacity:.85 }], { duration:400, keep:true });
    await nameIn(s, o);
    await beat(1400);
  },
  /* Slot machine: people from the year (or the other answers) spin past, it slows
     and nearly stops on the runner-up… then clicks over onto the winner */
  async slot(s, o){
    const top = new Set([o.w.label, o.second && o.second.label].filter(Boolean));
    let pool = (o.reel.length ? o.reel : o.results.map(r => r.label)).filter(n => !top.has(n));
    if (!pool.length) pool = o.results.map(r => r.label);
    const list = [];
    while (list.length < 34) list.push(pool[Math.floor(Math.random() * pool.length)]);
    if (o.second && !o.tie) list.push(o.second.label);
    list.push(o.w.label);
    s.querySelector('.pbg').insertAdjacentHTML('afterend', '<div class="pslotbox"><div class="pslotwin"><div class="pslotblur"><div class="pslotreel">' +
      list.map(n => '<div class="pslotrow">' + esc(n) + '</div>').join('') + '</div></div></div></div>');
    const t = await sayLine(s, o.line, 'top');
    await beat(400);
    const reel = s.querySelector('.pslotreel'), row = s.querySelector('.pslotrow').offsetHeight;
    const end = -(list.length - 1) * row, near = end + row;       // the runner-up sits one row above the winner
    s.classList.add('pspinning');
    const D = 6200;
    play(s.querySelector('.pslotblur'), [{ filter:'blur(0)' }, { filter:'blur(3px)', offset:.15 }, { filter:'blur(2px)', offset:.45 }, { filter:'blur(0)', offset:.62 }, { filter:'blur(0)' }], { duration:skipping ? 1 : D });
    await done(play(reel, [
      { transform:'translateY(0)', easing:'cubic-bezier(.35,.1,.25,1)' },
      { transform:'translateY(' + (near - row * .15) + 'px)', offset:.66, easing:'cubic-bezier(.3,.6,.3,1)' },    // slowing on the runner-up…
      { transform:'translateY(' + (near - row * .02) + 'px)', offset:.8, easing:'cubic-bezier(.6,0,.3,1)' },      // …almost stopped…
      { transform:'translateY(' + (end - row * .1) + 'px)', offset:.94, easing:'ease-out' },                      // …click, one more
      { transform:'translateY(' + end + 'px)' }], { duration:skipping ? 1 : D, keep:true }));
    s.classList.remove('pspinning');
    flash(s, 'rgba(255,212,59,.6)');
    await beat(500);
    play(t, [{ transform:'none' }, { transform:'translateY(-30%) scale(.8)', opacity:.8 }], { duration:400, keep:true });
    await done(play(s.querySelector('.pslotbox'), [{ opacity:1, transform:'translate(-50%,-50%)' }, { opacity:0, transform:'translate(-50%,-50%) scale(1.15)' }], { duration:320, keep:true }));
    await nameIn(s, o);
    const r = s.getBoundingClientRect();
    particles(() => Array.from({ length:90 }, () => { const a = -Math.PI / 2 + rand(-1.2, 1.2), v = rand(6, 15);
      return { x:r.left + r.width / 2, y:r.top + r.height * .55, vx:Math.cos(a) * v, vy:Math.sin(a) * v, g:.3, drag:.985, rot:rand(0, 6), vr:.25,
        w:12, h:12, round:true, c:['#ffd43b', '#fab005', '#ffe066'][Math.floor(rand(0, 3))], life:1600 }; }), 1800);
    await beat(1400);
  }
};
function arc(cx, cy, r, a0, a1){
  const p = a => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
}

/* ── moderators choosing a show: home.html?pollpreview=intro&anim=…&from=…, or =reveal&anim=… ── */
async function preview(kind, q){
  const anim = q.get('anim') || '';
  if (kind === 'reveal'){
    const p = Object.assign({}, data.poll || {}, { phase:'results', voted:true });
    if (q.get('q')) p.question = q.get('q');
    if (q.get('kind')) p.kind = q.get('kind');
    if (!p.results) p.results = [{ label:'Ms Example', votes:41, pct:38 }, { label:'Mr Sample', votes:30, pct:28 }, { label:'Ms Demo', votes:21, pct:19 }, { label:'Mr Test', votes:9, pct:8 }];
    if (!p.total) p.total = 108;
    if (!p.reel) p.reel = ['Ava One', 'Ben Two', 'Cy Three', 'Dee Four', 'Eli Five', 'Fay Six', 'Gus Seven', 'Hana Eight', 'Ivy Nine', 'Jai Ten', 'Kai Eleven', 'Lou Twelve'];
    p.reveal = q.get('line') || p.reveal || '';
    el.innerHTML = frame(bodyFor('final', p, null), p, { cls:'isresults', chip:chipFor('final') });
    wire();
    celebrate(p, revealLine(p), CELEB_SHOWS.includes(anim) ? anim : 'spotlight').catch(e => console.error('poll show:', e));
    return;
  }
  const from = q.get('from') || 'final';
  /* the new card is what Monday really brings: a fresh, unanswered question */
  const fresh = Object.assign({}, data.poll || {}, { voted:false, phase:'open', results:null, canVote:true, week:'preview' });
  if (q.get('q')) fresh.question = q.get('q');
  if (!fresh.question) fresh.question = 'Most likely to become state rank?';
  if (!fresh.options || !fresh.options.length) fresh.options = ['Ava One', 'Ben Two', 'Cy Three', 'Dee Four', 'Eli Five', 'Fay Six', 'Gus Seven', 'Hana Eight', 'Ivy Nine', 'Jai Ten', 'Kai Eleven', 'Lou Twelve', 'Mia Thirteen'].map((l, i) => ({ id:'d' + i, label:l }));
  el.innerHTML = frame(bodyFor('vote', fresh, null), fresh, {});
  if (from === 'first') return intro('first', null);
  const demo = { week:'demo', question:(prevView && prevView.question) || 'Worst subject?', kind:'class', total:214, pick:1, state:from,
    results:(prevView && prevView.results && prevView.results.length) ? prevView.results
      : [{ label:'Mathematics Advanced', pct:33, votes:71 }, { label:'Chemistry', pct:24, votes:51 }, { label:'English Advanced', pct:18, votes:39 }, { label:'Physics', pct:14, votes:30 }] };
  intro(INTRO_SHOWS.includes(anim) ? anim : 'drop', demo);
}

/* While it loads, an empty card the height the poll was last time, so the
   page below doesn't jump when the real one arrives. (This device only; 0 means
   there was no card, so nothing is held open.) */
const HEIGHT = 'msc.pollh';
function rememberHeight(tries){
  /* not mid-show: a show holds the card at another height (the first one starts it at 0) */
  if (document.body.classList.contains('pshow') && (tries || 0) < 30){ setTimeout(() => rememberHeight((tries || 0) + 1), 1000); return; }
  requestAnimationFrame(() => { try { localStorage.setItem(HEIGHT, String(el.hidden ? 0 : Math.round(el.offsetHeight))); } catch {} });
}
function placeholder(){
  let h = 0; try { h = +localStorage.getItem(HEIGHT) || 0; } catch {}
  if (h < 60 || previewing()) return;
  el.hidden = false;
  el.innerHTML = '<div class="pcard pskel" style="height:' + h + 'px" aria-hidden="true">' +
    '<span class="pskl w30"></span><span class="pskl w70 big"></span><span class="pskl w90"></span><span class="pskl w60"></span></div>';
}

window.Poll = {
  mount(host, o){ el = host; opts = o || {}; prevView = TT.get(VIEW, null); placeholder(); refresh(true); },
  refresh:() => refresh(false), INTRO_SHOWS, CELEB_SHOWS, revealLine
};
})();
