/* ── The Jim Button ───────────────────────────────────────────────────
   A port of the standalone Jim Button (github.com/Pugmeowla/jim_button):
   press the button, it says your name. Players are just the first name they
   type — no school login, so it works even when the school API is down.
   Scores live in Supabase behind /api/jim (the original used Firebase).
   The button itself is styled exactly as the original; everything around it
   follows the site theme. Audio lives in /jim/. Loaded after games.js. */
const JIM_DIR = 'jim/';
/* ADD NEW MILESTONES HERE — each needs a matching jim/<score>.m4a */
const JIM_ACH = [1, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
                 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
const JIM_POLL = 4000;        // how often the open board refreshes
const JIM_FLUSH = 800;        // presses are sent in batches, this long after the last one

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
    $('jimerr').textContent = 'Loading…';
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
  function queue(){ pending++; clearTimeout(flushTimer); flushTimer = setTimeout(flush, JIM_FLUSH); }
  async function flush(keepalive){
    clearTimeout(flushTimer); flushTimer = null;
    if (!pending || (sending && !keepalive)) return;
    const add = Math.min(pending, 500);
    pending -= add; sending = true;
    try { await jimApi({ name:playerName, add }, keepalive); }
    catch(e){ pending += add; if (alive && !keepalive) flushTimer = setTimeout(flush, 3000); }
    finally { sending = false; }
    if (pending && alive && !flushTimer) flushTimer = setTimeout(flush, JIM_FLUSH);
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
            '<button class="btn" type="button" id="jimmode">🔊 Playing: <b id="jimmodelbl"></b></button>' +
            '<button class="btn jimreset" type="button" id="jimreset">↺ Reset progress</button>' +
          '</div>' +
          '<div class="jimachwrap"><div class="jimachhd">Achievements</div><div class="jimach" id="jimach"></div></div>' +
        '</div>' +
        '<div class="glb jimlb"><div class="glbhd"><h3>Hall of Pressers</h3>' +
          '<span class="jimlive"><i></i>live</span></div>' +
          '<div id="jimlbrows"><p class="how">Loading…</p></div></div>' +
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
