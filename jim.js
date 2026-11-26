/* ── The Jim Button ───────────────────────────────────────────────────
   A port of the standalone Jim Button:
   press the button, it says your name. Players are just the first name they
   type — no school login, so it works even when the school API is down.
   Scores live in Supabase behind /api/jim (the original used Firebase).
   The button itself is styled exactly as the original; everything around it
   follows the site theme. Audio lives in /jim/. Loaded after games.js. */
const JIM_DIR = 'jim/';
/* ADD NEW MILESTONES HERE — each needs a matching jim/<score>.m4a */
const JIM_ACH = [1, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
                 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
/* Server time (25 November 2026): the boards refresh every 5 minutes (was 15 s), and presses are counted on the page and
   sent at most every 5 minutes, or straight away once 500 are waiting, or when you leave or switch tabs. Your own count
   still goes up with every press. */
const JIM_POLL = 5 * 60e3;    // how often the open board refreshes
const JIM_SEND = 5 * 60e3;    // presses waiting this long are sent
const JIM_FLUSH = 800;        // the rest of a batch of more than 500, this soon after
const JIM_RETRY = 30e3;       // a send that failed is tried again after this

async function jimApi(body, keepalive){
  const init = body ? { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body), keepalive:!!keepalive }
                    : { cache:'no-store' };
  const res = await fetch('/api/jim', init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || res.status + ' ' + res.statusText);
  return data;
}
let jimNames = null;
const jimNameList = () => jimNames || (jimNames = fetch(JIM_DIR + 'names.json')
  .then(r => r.json()).catch(() => []));

/* the exact button from the original — sized by .jimbtn / .jimach */
const jimButtonHTML = (label, id) =>
  '<div class="btn-outer"' + (id ? ' id="' + id + '"' : '') + '><div class="btn-ring">' +
  '<button class="name-btn" tabindex="-1" aria-label="' + esc(label) + ' button">' + esc(label) + '</button>' +
  '</div></div>';

BUILD.jim = host => {
  let alive = true, pollTimer = null, flushTimer = null, pending = 0, sending = false;
  let playerName = '', myScore = 0, glowTimer = null, pressLocked = false;
  let audioMode = 'name', lbData = null, lbExpanded = false, turbo = false, secret = '';
  const nameAudio = new Audio(), randomAudio = new Audio(), achAudio = new Audio();
  const jimAudio = new Audio(JIM_DIR + 'jim.mp3'), stanleyAudio = new Audio(JIM_DIR + 'stanley.mp3');
  const play = a => { a.currentTime = 0; return a.play(); };

  head(host, 'The Jim Button', 'The button that says the name of the player playing the game.');
  const box = document.createElement('div');
  box.className = 'jim';
  host.appendChild(box);

  /* ── name entry ── */
  const guess = () => { const saved = TT.get('tt.jimname', '');
    if (saved) return saved;
    const e = TT.myEmail && TT.myEmail(); return e ? e.split('@')[0].split('.')[0].replace(/\d+$/, '') : ''; };
  box.innerHTML =
    '<div class="jimstart">' + jimButtonHTML('NAME') +
    '<div class="jimstartform"><h3>Enter your first name</h3>' +
    '<p class="how">Use the same name to keep your progress. If your name isn’t on the list it plays “Jim” instead. ' +
    'Switch modes with the button under the counter.</p>' +
    '<form id="jimform"><input id="jimname" type="text" maxlength="18" placeholder="YOUR NAME" autocomplete="off" spellcheck="false">' +
    '<button class="btn primary" type="submit">Start</button></form>' +
    '<div class="jimerr" id="jimerr"></div></div></div>';
  $('jimname').value = guess().toUpperCase();
  setTimeout(() => { const i = $('jimname'); if (i && !TOUCH) i.focus(); }, 30);
  $('jimform').onsubmit = ev => { ev.preventDefault(); start(); };

  async function start(){
    const raw = $('jimname').value.trim();
    if (!raw){ $('jimerr').textContent = 'Please enter a name'; return; }
    playerName = raw.toUpperCase();
    TT.set('tt.jimname', raw);
    nameAudio.src = JIM_DIR + raw.toLowerCase().replace(/\s+/g, '') + '.wav';
    nameAudio.load();
    $('jimerr').innerHTML = window.TT && TT.loader ? TT.loader('Loading the scoreboard…', '', { sm:true }) : 'Loading…';
    let rows = null;
    try { rows = (await jimApi()).scores || []; }
    catch(e){ if (!alive) return;
      $('jimerr').textContent = 'Couldn’t reach the scoreboard (' + e.message + ').'; return; }
    if (!alive) return;
    const mine = rows.find(r => r.name === playerName);
    myScore = mine ? +mine.score || 0 : 0;
    buildGame();
    gotBoard(rows);
    pollTimer = setInterval(poll, JIM_POLL);
  }
  function gotBoard(rows){
    lbData = {};
    rows.forEach(r => { lbData[r.name] = +r.score || 0; });
    renderLB();
  }
  async function poll(){
    if (document.hidden || !alive) return;
    try { const d = await jimApi(); if (alive) gotBoard(d.scores || []); }
    catch(e){ const el = $('jimlbrows'); if (el && !lbData) el.innerHTML = '<p class="how">Scoreboard unreachable.</p>'; }
  }

  /* presses are counted locally and sent in batches; a failed send is kept and retried */
  function queue(){ pending++; if (pending >= 500) flush(); else if (!flushTimer) flushTimer = setTimeout(flush, JIM_SEND); }
  async function flush(keepalive){
    clearTimeout(flushTimer); flushTimer = null;
    if (!pending || (sending && !keepalive)) return;
    const add = Math.min(pending, 500);
    pending -= add; sending = true;
    try { await jimApi({ name:playerName, add }, keepalive); }
    catch(e){ pending += add; if (alive && !keepalive) flushTimer = setTimeout(flush, JIM_RETRY); }
    finally { sending = false; }
    if (pending && alive && !flushTimer) flushTimer = setTimeout(flush, pending >= 500 ? JIM_FLUSH : JIM_SEND);
  }

  /* ── the game ── */
  function buildGame(){
    box.innerHTML =
      '<div class="jimplay">' +
        '<div class="jimmain">' +
          '<div class="jimpanel"><div class="jimlabel">The Button That Says The Name Of The Player Playing The Game</div>' +
          jimButtonHTML(playerName, 'jimbtn') + '</div>' +
          '<div class="jimcount" id="jimcount"><span class="lbl">Times pressed</span><span class="num" id="jimnum">' + myScore + '</span></div>' +
          '<div class="jimctl">' +
            '<button class="btn" type="button" id="jimmode">Playing: <b id="jimmodelbl"></b></button>' +
            '<button class="btn jimreset" type="button" id="jimreset">↺ Reset progress</button>' +
          '</div>' +
          '<div class="jimachwrap"><div class="jimachhd">Achievements</div><div class="jimach" id="jimach"></div></div>' +
        '</div>' +
        '<div class="glb jimlb"><div class="glbhd"><h3>Hall of Pressers</h3>' +
          '<span class="jimlive"><i></i>live</span></div>' +
          '<div id="jimlbrows">' + (window.TT && TT.loader ? TT.loader() : '<p class="how">Loading…</p>') + '</div></div>' +
      '</div>' +
      '<div class="jimconfirm" id="jimconfirm" hidden><div class="jimconfirmbox">' +
        '<h3>Are you sure?</h3><p>This will reset your click count back to zero. This cannot be undone.</p>' +
        '<div class="jimctl"><button class="btn jimreset" type="button" id="jimyes">Reset</button>' +
        '<button class="btn" type="button" id="jimno">Cancel</button></div></div></div>';

    setLabel(playerName);
    paintMode();
    buildAch();
    syncAch(myScore);
    const btn = $('jimbtn');
    btn.addEventListener('click', press);
    $('jimmode').onclick = () => {
      audioMode = { name:'jim', jim:'random', random:'name' }[audioMode];
      paintMode();
    };
    $('jimreset').onclick = () => { $('jimconfirm').hidden = false; };
    $('jimno').onclick = () => { $('jimconfirm').hidden = true; };
    $('jimconfirm').onclick = e => { if (e.target.id === 'jimconfirm') $('jimconfirm').hidden = true; };
    $('jimyes').onclick = async () => {
      $('jimconfirm').hidden = true;
      myScore = 0; pending = 0; $('jimnum').textContent = 0; syncAch(0);
      if (lbData) { lbData[playerName] = 0; renderLB(); }
      try { await jimApi({ name:playerName, reset:true }); } catch(e){}
    };
  }
  const paintMode = () => { const l = $('jimmodelbl');
    if (l) l.textContent = audioMode === 'jim' ? 'JIM' : audioMode === 'random' ? 'RANDOM' : playerName; };

  /* ── fit text to button (same steps as the original) ── */
  function setLabel(name){
    const b = document.querySelector('#jimbtn .name-btn'); if (!b) return;
    b.textContent = name;
    const n = name.length;
    b.style.fontSize = n <= 4 ? '2.4rem' : n <= 6 ? '1.9rem' : n <= 8 ? '1.5rem' : n <= 11 ? '1.2rem' : n <= 14 ? '0.95rem' : '0.78rem';
  }

  async function press(){
    if ((pressLocked && !turbo) || !playerName || !alive) return;
    pressLocked = true;
    myScore++;
    const num = $('jimnum'), btn = $('jimbtn');
    num.textContent = myScore;
    checkAch(myScore);
    queue();
    if (lbData){ lbData[playerName] = myScore; renderLB(); }

    num.classList.remove('pop', 'glowing'); void num.offsetWidth; num.classList.add('pop', 'glowing');
    btn.classList.remove('pressing', 'glowing'); void btn.offsetWidth; btn.classList.add('pressing', 'glowing');
    const flash = document.createElement('div'); flash.className = 'jimflash';
    document.body.appendChild(flash); setTimeout(() => flash.remove(), 800);

    if (audioMode === 'jim'){
      const stanley = Math.random() < 0.05;
      play(stanley ? stanleyAudio : jimAudio).catch(() => {});
      setLabel(stanley ? 'STANLEY' : 'JIM');
    } else if (audioMode === 'random'){
      const list = await jimNameList();
      if (list.length){ const pick = list[(Math.random() * list.length) | 0];
        randomAudio.src = JIM_DIR + pick + '.wav'; play(randomAudio).catch(() => {});
        setLabel(pick.toUpperCase()); }
    } else {
      play(nameAudio).catch(() => play(jimAudio).catch(() => {}));
      setLabel(playerName);
    }

    clearTimeout(glowTimer);
    if (turbo) pressLocked = false;
    glowTimer = setTimeout(() => {
      btn.classList.remove('glowing'); num.classList.remove('glowing');
      pressLocked = false;
    }, turbo ? 80 : 520);
  }

  /* ── achievements: unlocked ones, plus the next one to aim for ── */
  function buildAch(){
    $('jimach').innerHTML = JIM_ACH.map(s =>
      '<div class="jimachslot" data-score="' + s + '">' + jimButtonHTML(String(s)) + '</div>').join('');
    [...$('jimach').children].forEach(slot => slot.firstChild.addEventListener('click', () => {
      if (slot.classList.contains('locked')) return;
      achAudio.src = JIM_DIR + slot.dataset.score + '.m4a'; play(achAudio).catch(() => {});
    }));
  }
  function syncAch(score){
    const slots = [...($('jimach') || {children:[]}).children];
    let top = -1, next = false;
    slots.forEach((slot, i) => {
      const got = score >= +slot.dataset.score;
      slot.classList.toggle('locked', !got);
      slot.classList.remove('newest');
      slot.hidden = !got && next;
      if (got) top = i; else next = true;
    });
    if (top >= 0) slots[top].classList.add('newest');
  }
  function checkAch(score){
    if (JIM_ACH.includes(score)){ achAudio.src = JIM_DIR + score + '.m4a'; play(achAudio).catch(() => {}); }
    syncAch(score);
  }

  /* ── leaderboard ── */
  function renderLB(){
    const el = $('jimlbrows'); if (!el) return;
    if (!lbData){ el.innerHTML = '<p class="how">No presses yet — be first!</p>'; return; }
    if (playerName) lbData[playerName] = Math.max(lbData[playerName] || 0, myScore);   // presses still on their way
    const sorted = Object.entries(lbData).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!sorted.length){ el.innerHTML = '<p class="how">No presses yet — be first!</p>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    const shown = lbExpanded ? sorted : sorted.slice(0, 5);
    let html = shown.map(([name, score], i) =>
      '<div class="tlbrow' + (name === playerName ? ' me' : '') + '"><span class="rk">' + (medals[i] || (i + 1)) + '</span>' +
      '<span class="nm">' + esc(name) + '</span><span class="tm">' + esc(score) + '</span></div>').join('');
    const mine = sorted.findIndex(([n]) => n === playerName);
    if (!lbExpanded && mine >= 5)
      html += '<div class="tlbrow me"><span class="rk">' + (mine + 1) + '</span><span class="nm">' + esc(playerName) +
              '</span><span class="tm">' + esc(sorted[mine][1]) + '</span></div>';
    if (sorted.length > 5)
      html += '<button type="button" class="jimmore" id="jimmore">' +
              (lbExpanded ? 'Show top 5 ▲' : 'Show all ' + sorted.length + ' ▼') + '</button>';
    el.innerHTML = html;
    el.classList.toggle('open', lbExpanded);
    const more = $('jimmore'); if (more) more.onclick = () => { lbExpanded = !lbExpanded; renderLB(); };
  }

  /* space presses, typing TURBO toggles turbo mode (both as in the original) */
  const onKey = e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing || !playerName) return;
    if (e.key === ' ' && (t === document.body || box.contains(t)) && t.tagName !== 'BUTTON'){ e.preventDefault(); press(); return; }
    if (e.key.length === 1){
      secret = (secret + e.key.toUpperCase()).slice(-5);
      if (secret === 'TURBO'){ turbo = !turbo; box.classList.toggle('turbo', turbo); secret = ''; }
    }
  };
  document.addEventListener('keydown', onKey);
  const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    alive = false;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHide);
    clearTimeout(glowTimer); clearInterval(pollTimer);
    flush(true);                      // keepalive: the last presses still land if the page closes
    [nameAudio, randomAudio, achAudio, jimAudio, stanleyAudio].forEach(a => { try { a.pause(); } catch {} });
  };
};

/* ── Jim Together ──────────────────────────────────────────────────────
   The Jim Button for everyone at once: one shared count on an LED board above
   the button, synced across every player, and a board of who has pressed the
   most. No achievements or reset. The button says your first name when there's
   a recording of it (jim/<name>.wav), and JIM when there isn't; the mode button
   under it goes your name → JIM → a random name → your name.
   Shares /api/jim (?together=1). */
const JT_POLL = 5 * 60e3;     // Together: how often the shared count is fetched (was 2 s, then 15 s; your own presses still show at once)
/* 5×7 dot-matrix digits, one string of five 0/1 per row */
const JT_FONT = {
  0:['01110','10001','10011','10101','11001','10001','01110'], 1:['00100','01100','00100','00100','00100','00100','01110'],
  2:['01110','10001','00001','00010','00100','01000','11111'], 3:['11111','00010','00100','00010','00001','10001','01110'],
  4:['00010','00110','01010','10010','11111','00010','00010'], 5:['11111','10000','11110','00001','00001','10001','01110'],
  6:['00110','01000','10000','11110','10001','10001','01110'], 7:['11111','00001','00010','00100','01000','01000','01000'],
  8:['01110','10001','10001','01110','10001','10001','01110'], 9:['01110','10001','10001','01111','00001','00010','01100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000']
};
const jtDigit = ch => '<span class="jtdig">' + JT_FONT[ch].join('').split('').map(b => '<i' + (b === '1' ? ' class="on"' : '') + '></i>').join('') + '</span>';

BUILD.jimall = host => {
  let alive = true, pollTimer = null, flushTimer = null, glowTimer = null, tickTimer = null;
  let pending = 0, inflight = 0, sending = false, pressLocked = false, banned = false, lastPoll = 0;
  let server = 0, shown = 0, mine = 0, myName = null, top = null, anonTotal = 0;
  const jimAudio = new Audio(JIM_DIR + 'jim.mp3'), stanleyAudio = new Audio(JIM_DIR + 'stanley.mp3'), nameAudio = new Audio();
  /* muted: the button still presses and counts, just silently (remembered on this device) */
  let muted = !!TT.get('tt.jtmute', false);
  const play = a => { if (muted) return Promise.resolve(); a.currentTime = 0; return a.play(); };
  const signedIn = !!(window.TT && TT.myEmail && TT.myEmail());
  /* signed out: a random id this browser keeps, so its presses have a row of their own */
  const anon = (() => { let id = TT.get('tt.jtanon', '');
    if (!/^[a-z0-9]{8,40}$/.test(id)){ id = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 20); TT.set('tt.jtanon', id); }
    return id; })();

  /* who you are comes from your site login: your login's first name straight away, then
     the name the rest of the site shows for you (with any change made on the site) once
     the server answers. Not signed in: JIM. */
  const emailFirst = () => { const e = TT.myEmail && TT.myEmail(); return e ? e.split('@')[0].split(/[._]/)[0].replace(/\d+$/, '') : ''; };
  let label = 'JIM', hasName = false, nameFor = '', mode = 'name';
  const randomAudio = new Audio();

  /* It used to grow wider than the page column on a big screen, which spilled out of the window on themes that draw the
     page as one (Vaporwave). Since 24 November 2026 it keeps the page's own width: the layout (games.css, .jt) is by the
     game's width, so the board goes beside the button or under it as there's room. */
  head(host, 'Button Pushers');
  const box = document.createElement('div');
  box.className = 'jim jt';
  host.appendChild(box);
  box.innerHTML =
    '<div class="jimplay">' +
      '<div class="jimmain">' +
        '<div class="jtled" role="status" aria-live="off">' +
          '<div class="jtledhd"><span>Pressed by everyone</span><span class="jtlive"><i></i>live</span></div>' +
          '<div class="jtdigits" id="jtdigits" aria-hidden="true"></div>' +
          '<span class="sr" id="jtsr"></span>' +
        '</div>' +
        '<div class="jimpanel">' + jimButtonHTML(label, 'jtbtn') + '</div>' +
        '<div class="jimcount"><span class="lbl">Your presses</span><span class="num" id="jtmine">' + (signedIn ? '…' : '—') + '</span></div>' +
        '<div class="jimctl"><button class="btn" type="button" id="jtmode">Playing: <b id="jtmodelbl">JIM</b></button>' +
          '<button class="btn" type="button" id="jtmute" aria-pressed="false"></button></div>' +
        (signedIn ? '' : '<p class="how jtnote">Sign in on the timetable to get your presses on the board. They still count towards the total.</p>') +
      '</div>' +
      '<div class="glb jimlb"><div class="glbhd"><h3>Top pressers</h3><span class="jimlive"><i></i>live</span></div>' +
        '<div id="jtrows">' + (TT.loader ? TT.loader('', '', { sm:true }) : '<p class="how">Loading…</p>') + '</div></div>' +
    '</div>';

  /* the name on the button: yours if there's a recording of it, else JIM */
  const setLabel = name => {
    const b = document.querySelector('#jtbtn .name-btn'); if (!b) return;
    b.textContent = name;
    const n = name.length;
    /* Jim's sizes for a 200px button (rem at 16px), scaled to this one's size */
    const rem = n <= 4 ? 2.4 : n <= 6 ? 1.9 : n <= 8 ? 1.5 : n <= 11 ? 1.2 : n <= 14 ? 0.95 : 0.78;
    b.style.fontSize = 'calc(var(--jt-size, 200px) * ' + (rem * 16 / 200).toFixed(4) + ')';
  };
  /* what the mode button says, and what the button shows until it's next pressed */
  const paintMode = () => { const l = $('jtmodelbl'); if (!l) return;
    l.textContent = mode === 'jim' ? 'JIM' : mode === 'random' ? 'RANDOM' : (hasName ? label : 'YOUR NAME (JIM)');
    if (mode === 'jim') setLabel('JIM'); else if (mode === 'name') setLabel(label); else setLabel('???'); };
  /* the button says your first name when there's a recording of it, else JIM */
  function useName(full){
    const first = String(full || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z'-]/g, '');
    if (!first || first === nameFor) return;
    nameFor = first;
    /* the recording itself, not names.json (which misses a few) */
    fetch(JIM_DIR + first + '.wav', { method:'HEAD' }).then(r => r.ok, () => false).then(ok => {
      if (!alive || nameFor !== first) return;
      hasName = ok;
      label = hasName ? first.toUpperCase() : 'JIM'; paintMode();
      if (hasName){ nameAudio.src = JIM_DIR + first + '.wav'; nameAudio.load(); }
    });
  }
  setLabel(label);
  if (signedIn) useName(emailFirst());

  /* ── the LED board: blank leading places, digits re-drawn only when they change ── */
  const PLACES = 9;
  let drawn = [];
  function paintLED(n){
    const s = String(Math.max(0, Math.floor(n))), w = Math.max(PLACES, s.length), str = s.padStart(w, ' ');
    const el = $('jtdigits'); if (!el) return;
    if (drawn.length !== w){
      el.innerHTML = str.split('').map((ch, i) => (i && (w - i) % 3 === 0 ? '<span class="jtsep"></span>' : '') + jtDigit(ch)).join('');
      drawn = str.split('');
    } else {
      const digs = el.querySelectorAll('.jtdig');
      str.split('').forEach((ch, i) => { if (drawn[i] !== ch){ digs[i].outerHTML = jtDigit(ch); drawn[i] = ch; } });
    }
    $('jtsr').textContent = s + ' presses by everyone';
  }
  /* what the board should say: the server's count plus presses of yours it hasn't seen yet */
  const target = () => server + pending + inflight;
  function showTotal(){
    const t = target();
    if (t <= shown){ paintLED(shown); return; }
    if (t - shown <= 1){ shown = t; paintLED(shown); return; }
    /* other people's presses roll in over about a second */
    clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      const goal = target();
      if (!alive || shown >= goal){ clearInterval(tickTimer); tickTimer = null; return; }
      shown += Math.max(1, Math.ceil((goal - shown) / 8)); if (shown > goal) shown = goal;
      paintLED(shown);
    }, 60);
  }

  function renderLB(){
    const el = $('jtrows'); if (!el) return;
    if (!top){ return; }
    const rows = top.slice();
    /* your own presses still on their way */
    if (myName){ const me = rows.find(r => r.name === myName);
      if (me) me.score = Math.max(me.score, mine); else if (mine > 0) rows.push({ name:myName, score:mine });
      rows.sort((a, b) => b.score - a.score); }
    if (!rows.length && !anonTotal){ el.innerHTML = '<p class="how">No presses yet. Be first!</p>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    /* signed-out presses count towards the total too, so they get a row and the board adds up */
    el.innerHTML = rows.slice(0, 20).map((r, i) =>
      '<div class="tlbrow' + (r.name === myName ? ' me' : '') + '"><span class="rk">' + (medals[i] || (i + 1)) + '</span>' +
      '<span class="nm">' + esc(r.name) + '</span><span class="tm">' + esc(r.score.toLocaleString()) + '</span></div>').join('') +
      (anonTotal ? '<div class="tlbrow jtanon"><span class="rk">·</span><span class="nm">Not signed in</span><span class="tm">' + anonTotal.toLocaleString() + '</span></div>' : '');
  }

  /* a moderator has taken this player off (moderator page → Bans): nothing more is sent, the board still shows */
  function stopBanned(){
    banned = true; pending = 0; clearTimeout(flushTimer); flushTimer = null;
    const b = $('jtbtn'); if (b) b.classList.add('jtoff');
    const note = box.querySelector('.jtnote') || box.querySelector('.jimmain').appendChild(Object.assign(document.createElement('p'), { className:'how jtnote' }));
    note.textContent = 'A moderator has taken you off Button Pushers, so your presses don’t count.';
  }
  async function poll(){
    if (!alive || document.hidden) return;
    lastPoll = Date.now();
    try {
      const d = await TT.api('/api/jim', { params:{ together:1 } });
      if (!alive) return;
      server = Math.max(server, +d.total || 0); top = d.top || []; anonTotal = +d.anon || 0; showTotal(); renderLB();
    } catch(e){ const el = $('jtrows'); if (el && !top) el.innerHTML = '<p class="how">Couldn’t reach the board (' + esc(e.message) + ').</p>'; }
  }

  /* presses are counted here and sent in batches (at most every 5 minutes, see JIM_SEND); a failed batch is kept and tried again */
  function queue(){ pending++; if (pending >= 500) flush(); else if (!flushTimer) flushTimer = setTimeout(flush, JIM_SEND); }
  async function flush(keepalive){
    clearTimeout(flushTimer); flushTimer = null;
    if (banned || !pending || (sending && !keepalive)) return;
    const add = Math.min(pending, 500);
    pending -= add; inflight += add; sending = true;
    try {
      if (keepalive){
        const c = TT.get('tt.creds', null), h = { 'Content-Type':'application/json' };
        if (c && c.email && c.password){ h['X-School-Email'] = c.email; h['X-School-Password'] = c.password; }
        fetch('/api/jim', { method:'POST', headers:h, body:JSON.stringify({ together:true, add, anon }), keepalive:true }).catch(() => {});
        inflight -= add;
      } else {
        const d = await TT.api('/api/jim', { method:'POST', body:{ together:true, add, anon } });
        inflight -= add;
        server = Math.max(server, +d.total || 0);
        if (d.mine != null){ mine = Math.max(mine, +d.mine || 0); myName = d.name || myName; if (d.name) useName(d.name); }
        if (alive){ $('jtmine').textContent = signedIn && d.mine != null ? mine.toLocaleString() : $('jtmine').textContent; showTotal(); renderLB(); }
      }
    } catch(e){ inflight -= add;
      if (e && e.data && e.data.banned){ if (alive) stopBanned(); showTotal(); }
      else { pending += add; if (alive && !keepalive) flushTimer = setTimeout(flush, JIM_RETRY); } }
    finally { sending = false; }
    if (pending && alive && !flushTimer && !banned) flushTimer = setTimeout(flush, pending >= 500 ? JIM_FLUSH : JIM_SEND);
  }

  function press(){
    if (pressLocked || !alive || banned) return;
    pressLocked = true;
    if (signedIn && myName) mine++;
    queue();
    const btn = $('jtbtn'), num = $('jtmine'), led = box.querySelector('.jtled');
    if (signedIn && myName) num.textContent = mine.toLocaleString();
    showTotal(); renderLB();
    num.classList.remove('pop', 'glowing'); void num.offsetWidth; num.classList.add('pop', 'glowing');
    btn.classList.remove('pressing', 'glowing'); void btn.offsetWidth; btn.classList.add('pressing', 'glowing');
    led.classList.remove('flash'); void led.offsetWidth; led.classList.add('flash');
    const flash = document.createElement('div'); flash.className = 'jimflash';
    document.body.appendChild(flash); setTimeout(() => flash.remove(), 800);

    if (mode === 'random'){
      jimNameList().then(list => { if (!alive || !list.length || mode !== 'random') return;
        const pick = list[(Math.random() * list.length) | 0];
        randomAudio.src = JIM_DIR + pick + '.wav'; play(randomAudio).catch(() => {}); setLabel(pick.toUpperCase()); });
    } else if (mode === 'name' && hasName){ play(nameAudio).catch(() => play(jimAudio).catch(() => {})); setLabel(label); }
    else { const stanley = Math.random() < 0.05; play(stanley ? stanleyAudio : jimAudio).catch(() => {}); setLabel(stanley ? 'STANLEY' : 'JIM'); }

    clearTimeout(glowTimer);
    glowTimer = setTimeout(() => { btn.classList.remove('glowing'); num.classList.remove('glowing'); pressLocked = false; }, 520);
  }
  $('jtbtn').addEventListener('click', press);
  $('jtmode').onclick = () => { mode = { name:'jim', jim:'random', random:'name' }[mode]; paintMode(); };
  const paintMute = () => { const b = $('jtmute'); if (!b) return;
    b.textContent = muted ? '🔇 Muted' : '🔊 Sound on'; b.setAttribute('aria-pressed', String(muted)); b.title = muted ? 'Turn the sound back on' : 'Mute the button'; };
  $('jtmute').onclick = () => {
    muted = !muted; TT.set('tt.jtmute', muted); paintMute();
    if (muted) [nameAudio, randomAudio, jimAudio, stanleyAudio].forEach(a => { try { a.pause(); } catch {} });
  };
  paintMute();
  paintMode();

  /* your share so far: the board's row for you, once the server says who you are */
  async function whoAmI(){
    if (!signedIn) return;
    try {
      const d = await TT.api('/api/jim', { params:{ together:1, me:1 } });
      if (!alive) return;
      if (d.me){ myName = d.me.name; mine = Math.max(mine, +d.me.score || 0); useName(d.me.name); }
      else myName = myName || '';
      $('jtmine').textContent = mine.toLocaleString(); renderLB();
      if (d.banned) stopBanned();
    } catch(e){ $('jtmine').textContent = '—'; }
  }

  const onKey = e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    if (e.key === ' ' && (t === document.body || box.contains(t)) && t.tagName !== 'BUTTON'){ e.preventDefault(); press(); }
  };
  document.addEventListener('keydown', onKey);
  /* back on the tab: a fresh count, but not more than once a minute */
  const onHide = () => { if (document.visibilityState === 'hidden') flush(true); else if (Date.now() - lastPoll > 60e3) poll(); };
  document.addEventListener('visibilitychange', onHide);

  paintLED(0);
  poll(); whoAmI();
  pollTimer = setInterval(poll, JT_POLL);

  return () => {
    alive = false;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHide);
    clearTimeout(glowTimer); clearInterval(pollTimer); clearInterval(tickTimer);
    flush(true);
    [nameAudio, randomAudio, jimAudio, stanleyAudio].forEach(a => { try { a.pause(); } catch {} });
  };
};
