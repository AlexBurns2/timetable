/* ═══════════════════════════════════════════════════════════════════
   mp.js — Multiplayer: the lobby (games.html; runs after games.js and
   uses its helpers: BUILD, head, esc, $, SFX, TT, loadRooms, playName…).

   A lobby is a room (rooms.js, the same online database as Hong Kong
   Mahjong) that outlives any one game: its members stay together while
   the host switches between games, and its chat runs across all of them.

   · The host's presence carries the lobby's state (ls): the game picked,
     each game's settings, and the round being played, if any. Presence
     stays put (messages delete themselves after 30 s), so someone joining
     late reads the state straight away.
   · A round: the host picks the players (everyone not sitting out, up to
     the game's limit) and a start time; every member's page mounts the
     game, as a player or as a watcher. The game is handed a session (S)
     whose room only hears that round's messages, and calls S.back() when
     it is over.
   · If the host leaves, the member who has been there longest takes over;
     the lobby only closes when everyone has gone.
   · Leaving the hub keeps you in the lobby (a small tab in the corner
     brings it back); leaving the page drops you, and coming back to the
     games page in the same tab puts you straight back in.
   · Chat: typed lines, quick lines that change with what is going on, and
     reactions. Names and lines go through the same word filter as Hong
     Kong Mahjong's chat. Someone joining gets the last 40 lines from the
     host.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
if (typeof BUILD === 'undefined') return;

/* ── the word filter (the same lists and rules as Hong Kong Mahjong's chat) ── */
const MPF = (() => {
  const BAD_SUB = ['fuck', 'fuk', 'fck', 'phuck', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'arsehole', 'dumbass', 'jackass', 'motherf', 'wank', 'twat', 'slut', 'whore',
    'nigg', 'faggot', 'fagot', 'retard', 'pussy', 'douche', 'bollock', 'piss', 'porn', 'rapist', 'wetback', 'spastic', 'cocksuck', 'dickhead', 'bullshit', 'goddamn'];
  const BAD_EXACT = ['ass', 'arse', 'dick', 'cock', 'prick', 'damn', 'crap', 'tits', 'rape', 'kys', 'fag', 'fags', 'chink', 'spic', 'kike', 'tranny', 'dyke', 'coon', 'gook', 'paki',
    'spaz', 'hoe', 'hoes', 'bugger', 'nazi', 'stfu', 'wtf', 'fu', 'mf', 'pos', 'dipshit', 'shite', 'feck', 'bloody'];
  const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '(': 'c' };
  const SAFE = ['scunthorpe', 'shiitake', 'cocktail', 'cocktails', 'peacock', 'hancock', 'niggle', 'niggling', 'snigger', 'sniggering', 'swank', 'swanky', 'retardant',
    'therapist', 'therapists', 'fukushima', 'assassin', 'classic', 'grape', 'drape', 'scrape', 'class', 'glass', 'grass', 'pass', 'mass', 'bass', 'cockpit', 'hoedown'];
  const norm = w => [...w.toLowerCase()].map(c => LEET[c] || c).join('').replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1');
  const bad = n => { if (!n || SAFE.includes(n)) return false; const sq = n.replace(/(.)\1+/g, '$1');
    if (BAD_EXACT.includes(n) || BAD_EXACT.includes(sq)) return true; return BAD_SUB.some(b => n.includes(b) || sq.includes(b.replace(/(.)\1+/g, '$1'))); };
  function censor(text){
    let s = String(text || '');
    s = s.replace(/[A-Za-z0-9@$!|+(*#]+/g, w => {
      if (bad(norm(w.replace(/[*#]/g, '')))) return '*'.repeat([...w].length);
      if (/[*#]/.test(w) && /^[a-z]/i.test(w)) for (const f of ['u', 'i', 'a', 'o', 'e']) if (bad(norm(w.replace(/[*#]/g, f)))) return '*'.repeat([...w].length);
      return w;
    });
    return s.replace(/\b(?:[A-Za-z0-9@$][\s._\-]+){2,}[A-Za-z0-9@$]\b/g, run => bad(norm(run)) ? run.replace(/[A-Za-z0-9@$]/g, '*') : run);
  }
  const name = n => censor(String(n || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16)) || 'Player';
  return { censor, name };
})();
window.MPF = MPF;

/* ── the games a lobby can play, and the settings the host can change ──
   opts: [key, label, [[value, label], …], default]. A game's build gets them as S.opts. */
const LGAMES = {
  tetris: { name:'Tetris', ico:'tetris', min:2, max:6, watch:true,
    blurb:'Clear lines to send garbage. Last one standing takes the round.',
    opts:[
      ['ft', 'Match', [[1, 'One round'], [2, 'First to 2'], [3, 'First to 3'], [5, 'First to 5'], [7, 'First to 7']], 3],
      ['w', 'Board width', [[8, '8'], [10, '10'], [12, '12'], [14, '14']], 10],
      ['h', 'Board height', [[16, '16'], [20, '20'], [24, '24']], 20],
      ['grav', 'Gravity', [['slow', 'Slow'], ['norm', 'Normal'], ['fast', 'Fast'], ['20g', 'Instant (20G)']], 'norm'],
      ['ramp', 'Speeds up', [['off', 'Never'], ['norm', 'Every 30 s'], ['fast', 'Every 15 s']], 'norm'],
      ['gmul', 'Garbage', [[0.5, 'Half'], [1, 'Normal'], [1.5, '1.5×'], [2, 'Double']], 1],
      ['gcap', 'Garbage per piece', [[4, 'Up to 4'], [8, 'Up to 8'], [12, 'Up to 12'], [99, 'No limit']], 8],
      ['mess', 'Garbage holes', [['clean', 'Lined up'], ['some', 'A bit messy'], ['messy', 'Messy']], 'some'],
      ['tgt', 'Targeting', [['even', 'Even'], ['random', 'Random'], ['kos', 'Knockouts'], ['attackers', 'Attackers'], ['manual', 'Pick your own']], 'even'],
      ['spin', 'T-spins and back-to-back', [[1, 'On'], [0, 'Off']], 1]
    ] },
  /* an option with a fifth entry only shows in those modes; picking a mode resets what modeSets says */
  snake: { name:'Snake', ico:'snake', min:1, max:6, watch:true,
    blurb:'Classic, Trails or Territory. Make everyone else crash.',
    blurbs:{ classic:'Eat, grow, and make everyone else crash. Last snake moving wins.',
             trails:'No fruit. Every snake leaves a line that never goes away. Last one moving wins.',
             territory:'Leave your land to draw a line, and get back to it to take everything inside. Cross anyone’s line and they’re out. Most land when time’s up wins.' },
    modeSets:{ classic:{ size:24, walls:'wrap' }, trails:{ size:40, walls:'walls' }, territory:{ size:40 } },
    opts:[
      ['mode', 'Mode', [['classic', 'Classic'], ['trails', 'Trails'], ['territory', 'Territory']], 'classic'],
      ['ft', 'Match', [[1, 'One round'], [2, 'First to 2'], [3, 'First to 3'], [5, 'First to 5']], 3],
      ['size', 'Arena', [[16, 'Small'], [24, 'Medium'], [32, 'Large'], [40, 'Huge'], [56, 'Giant']], 24],
      ['time', 'Time limit', [[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min']], 120, ['territory']],
      ['speed', 'Speed', [['slow', 'Slow'], ['norm', 'Normal'], ['fast', 'Fast'], ['insane', 'Insane']], 'norm'],
      ['fruit', 'Fruit', [[1, '1'], [3, '3'], [5, '5'], [8, '8'], [15, 'A feast']], 3, ['classic']],
      ['walls', 'Edges', [['wrap', 'Wrap around'], ['walls', 'Walls']], 'wrap', ['classic', 'trails']],
      ['pw', 'Power-ups', [['off', 'Off'], ['some', 'Some'], ['lots', 'Lots']], 'some', ['classic']],
      ['len', 'Starting length', [[3, '3'], [5, '5'], [8, '8']], 3, ['classic', 'trails']],
      ['rocks', 'Obstacles', [[0, 'None'], [1, 'A few'], [2, 'Plenty']], 0, ['classic', 'trails']]
    ] },
  relay: { name:'Sketch', ico:'relay', min:3, max:10, watch:false,
    blurb:'Write a prompt, draw someone else’s, guess what the next drawing is. See how far it drifts.',
    opts:[
      ['draw', 'Time to draw', [[45, '45 s'], [60, '1 min'], [90, '1½ min'], [120, '2 min']], 90],
      ['write', 'Time to write', [[20, '20 s'], [30, '30 s'], [45, '45 s']], 30],
      ['len', 'Each chain', [['all', 'Goes to everyone'], ['half', 'Goes halfway round']], 'all']
    ] },
  chess: { name:'Chess', ico:'chess', min:2, max:2, watch:true,
    blurb:'The first two players in the list play; everyone else watches.',
    opts:[
      ['tc', 'Clock', [['0', 'None'], ['1+0', '1 min'], ['3+2', '3 + 2'], ['5+0', '5 min'], ['10+0', '10 min'], ['15+10', '15 + 10']], '5+0'],
      ['col', 'Colours', [['r', 'Random'], ['w', 'First player is White'], ['b', 'First player is Black']], 'r']
    ] }
};
const GORDER = ['tetris', 'snake', 'relay', 'chess'];
const defOpts = () => { const o = {}; GORDER.forEach(g => { o[g] = {}; LGAMES[g].opts.forEach(([k, , , d]) => o[g][k] = d); }); return o; };
const MAXLOBBY = 10;
const QUICK = {
  lobby:['Hi!', 'Ready', 'Start it!', 'One sec', 'Let’s do another', 'Switch game?'],
  game:['GG', 'Nice one!', 'Oops', 'So close', 'Wait for me', 'Rematch?'],
  over:['GG', 'Rematch?', 'Again!', 'Close one', 'Too easy', 'Well played']
};
const REACT = ['👍', '😂', '😮', '🔥', '👏', '💀'];

/* ── the lobby itself: one per page, whether or not the hub is on screen ── */
const L = {
  room:null, code:'', me:'', name:'', isHost:false, pub:true, ls:null, chat:[], unread:0, ui:null, offs:[], joining:false,
  round:null, game:null, joinedAt:0, seen:new Set(), primed:false, left:'', lastNames:{}, pubRoom:null, pubLast:''
};
window.MPL = L;
const SS = 'mp.lobby';
const save = () => { try { if (L.room) sessionStorage.setItem(SS, JSON.stringify({ code:L.code, name:L.name })); else sessionStorage.removeItem(SS); } catch {} };
const nameOf = p => MPF.name(p && p.presence && p.presence.n);
const members = () => L.room ? L.room.peers().filter(p => !p.presence.w) : [];
const hostPeer = () => members().find(p => p.presence.h);
const ordered = () => members().slice().sort((a, b) => (b.presence.h ? 1 : 0) - (a.presence.h ? 1 : 0) || (a.presence.j || 0) - (b.presence.j || 0) || (a.id < b.id ? -1 : 1));
function readLs(){
  const h = hostPeer(); let ls = h && h.presence.ls;
  if (typeof ls === 'string'){ try { ls = JSON.parse(ls); } catch { ls = null; } }
  return ls && typeof ls === 'object' ? ls : null;
}
/* the host writes the lobby's state into its presence */
function writeLs(patch){
  if (!L.isHost || !L.room) return;
  const ls = Object.assign({}, L.ls || { g:'tetris', o:defOpts(), ph:'lobby', r:null, ban:[], pub:L.pub, v:0 }, patch);
  ls.v = (ls.v || 0) + 1; L.ls = ls;
  L.room.presence({ ls: JSON.stringify(ls) }).catch(() => {});
  announce();
}

async function connect(kind, code, name){
  if (L.joining) return; L.joining = true;
  try {
    const Rm = await loadRooms();
    L.name = MPF.name(name); TT.set('tt.mpname', L.name);
    let r;
    if (kind === 'host'){ r = await Rm.host('lb', L.name, MAXLOBBY); L.isHost = true; }
    else {
      try { r = await Rm.join('lb', code, L.name); }
      catch (e){ await new Promise(res => setTimeout(res, 2200)); r = await Rm.join('lb', code, L.name); }   // a host hand-over can leave a moment with nobody hosting
      L.isHost = false;
    }
    L.room = r.room; L.code = r.code; L.me = r.room.id; L.joinedAt = r.room.now(); L.chat = []; L.unread = 0; L.seen = new Set(); L.primed = false; L.round = null; L.left = '';
    await L.room.presence({ n:L.name, j:L.joinedAt, h:L.isHost ? 1 : 0 });
    if (L.isHost){ L.ls = null; writeLs({ pub:L.pub }); sys('You made the lobby. Share the code: ' + L.code); }
    wire(); save(); pill();
    if (!L.isHost) sys('You joined ' + L.code + '.');
  } finally { L.joining = false; }
}
function wire(){
  unwire();
  L.offs.push(L.room.onPeers(peersChanged));
  L.offs.push(L.room.on('chat', m => { const d = m.data || {}; if (typeof d.m !== 'string') return;
    const p = L.room.peers().find(x => x.id === m.peer);
    addChat({ who:m.peer, n:p ? nameOf(p) : MPF.name(d.n), m:MPF.censor(d.m.replace(/[\u0000-\u001f]/g, ' ').slice(0, 200)), k:d.k === 'rx' ? 'rx' : 't', t:Date.now() }); }));
  L.offs.push(L.room.on('hist', m => { const d = m.data || {}; const h = hostPeer();
    if (d.to !== L.me || !h || h.id !== m.peer || !Array.isArray(d.list) || L.chat.some(c => c.who !== 'sys')) return;
    const old = d.list.slice(-40).map(c => ({ who:String(c.who || ''), n:MPF.name(c.n), m:MPF.censor(String(c.m || '').slice(0, 200)), k:c.k === 'rx' ? 'rx' : c.k === 's' ? 's' : 't', t:+c.t || 0, old:1 }));
    L.chat = old.concat(L.chat); renderChat(); }));
}
function unwire(){ L.offs.forEach(f => { try { f(); } catch {} }); L.offs = []; }
async function leave(msg){
  if (!L.room) return;
  stopRound(); unwire();
  const r = L.room; L.room = null; L.isHost = false; L.ls = null; L.code = ''; save(); announce(); pill();
  try { await r.leave(); } catch {}
  if (L.ui) L.ui.menu(msg);
}

/* someone came, went, or the host changed something */
let lastV = -1;
function peersChanged(peers){
  if (!L.room) return;
  const ms = peers.filter(p => !p.presence.w);
  /* comings and goings, in the chat */
  const ids = new Set(ms.map(p => p.id));
  ms.forEach(p => { if (!L.seen.has(p.id) && p.id !== L.me && p.presence.n){ L.seen.add(p.id); if (L.primed){ sys(nameOf(p) + ' joined.'); if (L.isHost) sendHist(p.id); } } });
  [...L.seen].forEach(id => { if (!ids.has(id)){ L.seen.delete(id); const c = L.lastNames[id]; if (c) sys(c + ' left.'); } });
  L.lastNames = {}; ms.forEach(p => L.lastNames[p.id] = nameOf(p));
  L.primed = true;                                   // the people already here when you came aren't news
  /* no host: the member who has been here longest takes over */
  const hosts = ms.filter(p => p.presence.h);
  if (!hosts.length){
    const next = ms.slice().sort((a, b) => (a.presence.j || 9e15) - (b.presence.j || 9e15) || (a.id < b.id ? -1 : 1))[0];
    if (next && next.id === L.me && !L.isHost){
      L.isHost = true; const keep = L.ls; L.ls = keep ? Object.assign({}, keep, { ph:'lobby', r:null }) : null;
      L.room.presence({ h:1 }).catch(() => {}); writeLs({}); sys('The host left. You’re the host now.');
    }
  } else if (hosts.length > 1 && L.isHost){
    /* two took over at once: the earlier arrival keeps it */
    const keep = hosts.slice().sort((a, b) => (a.presence.j || 0) - (b.presence.j || 0) || (a.id < b.id ? -1 : 1))[0];
    if (keep.id !== L.me){ L.isHost = false; L.room.presence({ h:0, ls:'' }).catch(() => {}); }
  }
  const ls = L.isHost ? L.ls : readLs();
  if (ls && !L.isHost) L.ls = ls;
  if (L.ls && Array.isArray(L.ls.ban) && L.ls.ban.includes(L.me) && !L.isHost){ leave('The host removed you from the lobby.'); return; }
  /* a round started or ended */
  const r = L.ls && L.ls.ph === 'game' && L.ls.r ? L.ls.r : null;
  if (r && (!L.round || L.round.id !== r.id)) startRound(r);
  else if (!r && L.round) stopRound(true);
  if (L.game && L.game.peersFn) try { L.game.peersFn(peers); } catch {}
  if (L.ls && L.ls.v !== lastV){ lastV = L.ls.v; }
  if (L.ui) L.ui.refresh();
  pill();
  if (L.isHost) announce();
}

/* ── chat ── */
let lastSent = 0;
function say(text, kind){
  if (!L.room) return false;
  const m = String(text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200); if (!m) return false;
  if (Date.now() - lastSent < 650) return false; lastSent = Date.now();
  L.room.emit('chat', { m:MPF.censor(m), n:L.name, k:kind || 't' }).catch(() => {});
  return true;
}
function sys(text){ addChat({ who:'sys', n:'', m:text, k:'s', t:Date.now() }); }
function addChat(c){
  L.chat.push(c); if (L.chat.length > 150) L.chat.splice(0, L.chat.length - 150);
  if (c.who !== L.me && c.k !== 's' && !(L.ui && L.ui.chatOpen())){ L.unread++; pill(); }
  if (c.k === 'rx' && L.ui) L.ui.burst(c.m);
  if (c.k !== 's' && c.who !== L.me && L.ui) L.ui.toast(c);
  renderChat();
}
function sendHist(to){
  if (!L.room) return;
  const list = L.chat.filter(c => c.k !== 's' || c.who === 'sys').slice(-40).map(c => ({ who:c.who, n:c.n, m:c.m, k:c.k, t:c.t }));
  setTimeout(() => { if (L.room) L.room.emit('hist', { to, list }).catch(() => {}); }, 400);
}
function renderChat(){ if (L.ui) L.ui.chat(); }

/* ── the public list: public lobbies announce themselves in a shared room ── */
function announce(){
  if (!L.pubRoom) return;
  const ls = L.ls, on = L.room && L.isHost && ls && ls.pub;
  const p = on ? { code:L.code, n:L.name, players:members().length, max:MAXLOBBY, g:ls.g, playing:ls.ph === 'game' ? 1 : 0 } : { code:'' }, k = JSON.stringify(p);
  if (k === L.pubLast) return; L.pubLast = k;                 // only when it changes
  L.pubRoom.presence(p).catch(() => {});
}
let pubLoad = null;
function openPub(onList){
  if (!pubLoad) pubLoad = loadRooms().then(Rm => Rm.lobby ? Rm.lobby('lb') : null).then(p => { L.pubRoom = p; announce(); return p; }).catch(e => { pubLoad = null; throw e; });
  return pubLoad.then(p => p && onList ? p.onPeers(onList) : () => {});
}

/* ── rounds ── */
/* the round's own messages, on top of the lobby's room */
function scoped(rid){
  const room = L.room, pre = 'r.' + rid + '.';
  return { id:room.id, now:room.now, peers:() => room.peers(), onPeers:fn => room.onPeers(fn),
    emit:(t, d) => room.emit(pre + t, d), on:(t, fn) => room.on(pre + t, fn) };
}
function startRound(r){
  stopRound();
  L.round = r; L.left = '';
  const g = LGAMES[r.g]; if (!g) return;
  const mine = r.players.some(p => p.id === L.me);
  const S = L.game = {
    rid:r.id, g:r.g, room:scoped(r.id), players:r.players.map(p => ({ id:String(p.id), n:MPF.name(p.n) })), seed:r.seed >>> 0, at:+r.at || L.room.now(),
    isHost:L.isHost, me:L.me, hostId:(hostPeer() || {}).id, watch:!mine, opts:Object.assign({}, r.o || {}), peersFn:null, ended:false,
    /* the round is over (or this player is leaving it): the host takes everyone back to the lobby */
    back(){ if (S.ended) return; S.ended = true; if (L.isHost && L.round && L.round.id === r.id) writeLs({ ph:'lobby', r:null }); else if (L.ui) L.ui.refresh(); },
    say:t => sys(t),
    quick:k => { if (L.ui) L.ui.setQuick(k); },
    hostNow:() => L.isHost
  };
  if (L.ui) L.ui.refresh(true);
  if (!mine && !g.watch) sys('A round of ' + g.name + ' has started. You’ll be in the next one.');
  else if (mine) SFX.flip && SFX.flip();
}
function stopRound(toLobby){
  if (L.ui) L.ui.unmountGame();
  L.round = null; L.game = null;
  if (toLobby && L.ui) L.ui.refresh(true);
}
function hostStart(){
  if (!L.isHost || !L.ls) return;
  const g = LGAMES[L.ls.g], ps = ordered().filter(p => !p.presence.so).slice(0, g.max);
  if (ps.length < g.min) return;
  const r = { id:Math.random().toString(36).slice(2, 8), g:L.ls.g, players:ps.map(p => ({ id:p.id, n:nameOf(p) })), seed:(Math.random() * 4294967296) >>> 0,
              at:L.room.now() + 3600, o:Object.assign({}, L.ls.o[L.ls.g]) };
  writeLs({ ph:'game', r });
  L.room.emit('chat', { m:'Starting ' + g.name + '.', n:L.name, k:'t' }).catch(() => {});
}

/* the small tab in the corner while you're in a lobby but looking at something else */
function pill(){
  let el = document.getElementById('mppill');
  const show = !!L.room && !(L.ui && L.ui.visible());
  if (!show){ if (el) el.remove(); return; }
  if (!el){ el = document.createElement('button'); el.type = 'button'; el.id = 'mppill'; el.className = 'mppill'; el.onclick = () => openGame('mp'); document.body.appendChild(el); }
  el.innerHTML = '<span>Lobby <b>' + esc(L.code) + '</b></span><span class="mppn">' + members().length + '</span>' + (L.unread ? '<span class="mppu">' + L.unread + '</span>' : '');
  el.setAttribute('aria-label', 'Back to lobby ' + L.code + (L.unread ? ', ' + L.unread + ' new messages' : ''));
}

/* ═══════════════ the hub ═══════════════ */
const optLabel = (g, k, v) => { const d = LGAMES[g].opts.find(o => o[0] === k); const x = d && d[2].find(p => String(p[0]) === String(v)); return x ? x[1] : String(v); };
const gameIco = (id, fallback) => window.Icon && Icon.game ? Icon.game(id === 'relay' ? 'relay' : id, fallback) : fallback;
const GICO = { tetris:'🟦', snake:'🐍', relay:'✏️', chess:'♟️' };

function hub(host, opts){
  const pick = opts && opts.pick;
  host.innerHTML = '<div class="row"><div><h2>Multiplayer</h2><p class="how">Make a lobby, bring your friends, and switch games without starting over.</p></div></div>' +
    '<div class="mph" id="mph"><div class="mphmain" id="mphmain"></div>' +
    '<aside class="mphchat" id="mphchat" hidden><div class="mpchd"><b>Chat</b><button type="button" class="mpcx" id="mpcx" aria-label="Hide chat">Hide</button></div>' +
      '<div class="mpclog" id="mpclog" role="log" aria-live="polite"></div><div class="mpcrx" id="mpcrx"></div><div class="mpcq" id="mpcq"></div>' +
      '<form class="mpcin" id="mpcin" autocomplete="off"><input id="mpcmsg" maxlength="200" placeholder="Say something…" aria-label="Chat message" data-lpignore="true" data-1p-ignore>' +
      '<button class="btn primary" type="submit">Send</button></form></div></aside>' +
    '<button type="button" class="mpcopen" id="mpcopen" hidden>Chat<span id="mpcbadge"></span></button><div class="mpctoast" id="mpctoast" aria-hidden="true"></div></div>';
  const main = $('mphmain'), chatEl = $('mphchat');
  const narrow = () => matchMedia('(max-width: 860px)').matches;
  let screen = '', gameBox = null, gameStop = null, quickKind = 'lobby', unsubPub = null, chatHidden = narrow(), chatPref = { lobby:null, game:null };
  let alive = true;

  const ui = L.ui = {
    visible:() => alive && !!$('mph'),
    chatOpen:() => alive && !chatHidden && !chatEl.hidden,
    refresh(force){ if (!alive) return; if (!L.room){ if (screen !== 'menu') menu(); return; }
      const r = L.round, inIt = r && L.game && L.left !== r.id && (r.players.some(p => p.id === L.me) || LGAMES[r.g].watch);
      if (inIt){ if (screen !== 'game' || force) gameScreen(); else gameBar(); }
      else lobbyScreen(); },
    menu,
    chat:renderChatLog,
    toast,
    setQuick(k){ quickKind = k; renderQuick(); },
    burst,
    unmountGame
  };

  /* ── not in a lobby: make one, join by code, or pick a public one ── */
  function menu(msg){
    screen = 'menu'; unmountGame(); wide(false); chatEl.hidden = true; $('mpcopen').hidden = true;
    main.innerHTML = '<div class="mpbox lbmenu">' +
      '<label class="mpname">Your name<input id="lbn" maxlength="16" autocomplete="off" data-lpignore="true" data-1p-ignore value="' + esc(playName()) + '"></label>' +
      '<div class="mprow"><button class="btn primary" type="button" id="lbmake">Make a lobby</button>' +
        '<label class="chpub"><input type="checkbox" id="lbpub"' + (TT.get('tt.mpPub', true) ? ' checked' : '') + '> Public</label>' +
        '<span class="mpor">or</span><input id="lbcode" maxlength="5" placeholder="Code" autocomplete="off" data-lpignore="true" data-1p-ignore autocapitalize="characters" spellcheck="false" aria-label="Lobby code">' +
        '<button class="btn" type="button" id="lbjoin">Join</button></div>' +
      '<p class="mpmsg" id="lbmsg" role="status">' + esc(msg || 'Up to ' + MAXLOBBY + ' people. Everyone stays together while the host switches games, and the chat carries on throughout.') + '</p>' +
      '<h3 class="lbsub">Public lobbies</h3><div class="chlist" id="lbpubs">' + LD('Finding lobbies…', '', { sm:true }) + '</div></div>' +
      '<div class="lbgamelist">' + GORDER.map(id => { const g = LGAMES[id];
        return '<div class="lbgcard' + (id === pick ? ' pick' : '') + '"><span class="ico">' + gameIco(id, GICO[id]) + '</span><div><b>' + esc(g.name) + '</b><small>' + esc(g.blurb) + '</small>' +
          '<i>' + (g.min === g.max ? g.min + ' players' : g.min + '–' + g.max + ' players') + '</i></div></div>'; }).join('') + '</div>';
    const name = () => $('lbn').value.trim() || 'Player';
    const go = async fn => {
      $('lbmsg').textContent = 'Connecting…';
      try { await fn(); if (pick && L.isHost) writeLs({ g:pick }); ui.refresh(true); }
      catch (e){ if ($('lbmsg')) $('lbmsg').textContent = (e && e.message) || 'Couldn’t connect.'; }
    };
    $('lbpub').onchange = () => TT.set('tt.mpPub', $('lbpub').checked);
    $('lbmake').onclick = () => { L.pub = $('lbpub').checked; go(() => connect('host', '', name())); };
    $('lbjoin').onclick = () => go(() => connect('join', $('lbcode').value, name()));
    $('lbcode').onkeydown = e => { if (e.key === 'Enter') $('lbjoin').click(); };
    if (unsubPub) unsubPub();
    openPub(list).then(f => { if (alive) unsubPub = f; else f(); }).catch(() => { if ($('lbpubs')) $('lbpubs').innerHTML = '<p class="mpmsg">Couldn’t load the public lobbies.</p>'; });
    function list(peers){
      const el = $('lbpubs'); if (!el) return;
      const rows = peers.filter(p => !p.isMe && p.presence.code);
      el.innerHTML = rows.length ? '<ul class="mplist chgames">' + rows.map(p => { const x = p.presence, full = (x.players | 0) >= (x.max || MAXLOBBY);
        return '<li><span>' + esc(MPF.name(x.n)) + '’s lobby<small>' + (x.players | 0) + '/' + (x.max || MAXLOBBY) + ' · ' + esc((LGAMES[x.g] || {}).name || 'Lobby') + ' · ' + (x.playing ? 'playing' : 'waiting') + '</small></span>' +
          (full ? '<span class="mpbtns"><small>Full</small></span>' : '<span class="mpbtns"><button class="btn primary" type="button" data-code="' + esc(x.code) + '">Join</button></span>') + '</li>'; }).join('') + '</ul>'
        : '<p class="mpmsg">No public lobbies right now. Make one.</p>';
      el.querySelectorAll('[data-code]').forEach(b => b.onclick = () => go(() => connect('join', b.dataset.code, name())));
    }
  }

  /* ── in a lobby ── */
  function lobbyScreen(){
    if (screen === 'game') unmountGame();
    if (screen !== 'lobby') chatHidden = chatPref.lobby != null ? chatPref.lobby : narrow();
    screen = 'lobby'; wide(false); showChat(); ui.setQuick(L.round ? 'game' : 'lobby');
    const ls = L.ls || { g:'tetris', o:defOpts() }, gid = LGAMES[ls.g] ? ls.g : 'tetris', g = LGAMES[gid], o = Object.assign({}, defOpts()[gid], (ls.o || {})[gid]);
    const ms = ordered(), meP = ms.find(p => p.id === L.me), sitting = !!(meP && meP.presence.so);
    const playing = ms.filter(p => !p.presence.so), n = Math.min(playing.length, g.max);
    const roundOn = !!(L.round);
    main.innerHTML = '<div class="lbhead"><div><span class="mplabel">' + (ls.pub ? 'Public' : 'Private') + ' lobby' + (L.isHost ? ' · you’re the host' : '') + '</span><b class="mpcode">' + esc(L.code) + '</b></div>' +
        '<span class="mpbtns"><button class="btn" type="button" id="lbcopy">Copy code</button>' + (L.isHost ? '<button class="btn" type="button" id="lbvis">Make ' + (ls.pub ? 'private' : 'public') + '</button>' : '') +
        '<button class="btn" type="button" id="lbleave">Leave</button></span></div>' +
      '<section class="lbsec"><h3>People <small>' + ms.length + '/' + MAXLOBBY + '</small></h3><ul class="lbmem">' + ms.map((p, i) =>
        '<li class="' + (p.isMe ? 'me' : '') + (p.presence.so ? ' so' : '') + '"><i class="lbdot" style="--c:' + LCOL[i % LCOL.length] + '"></i><span>' + esc(nameOf(p)) + '</span>' +
          (p.presence.h ? '<em>host</em>' : '') + (p.isMe ? '<em>you</em>' : '') + (p.presence.so ? '<em>sitting out</em>' : '') +
          (L.isHost && !p.isMe ? '<button type="button" class="lbkick" data-kick="' + esc(p.id) + '" aria-label="Remove ' + esc(nameOf(p)) + '">Remove</button>' : '') + '</li>').join('') + '</ul>' +
        '<label class="lbso"><input type="checkbox" id="lbso"' + (sitting ? ' checked' : '') + '> Sit out the next game</label></section>' +
      '<section class="lbsec"><h3>Game</h3><div class="lbgames">' + GORDER.map(id => '<button type="button" class="lbg' + (id === gid ? ' cur' : '') + '" data-g="' + id + '"' + (L.isHost ? '' : ' disabled') + ' aria-pressed="' + (id === gid) + '">' +
          '<span class="ico">' + gameIco(id, GICO[id]) + '</span><b>' + esc(LGAMES[id].name) + '</b><small>' + (LGAMES[id].min === LGAMES[id].max ? LGAMES[id].min : LGAMES[id].min + '–' + LGAMES[id].max) + ' players</small></button>').join('') + '</div>' +
        '<p class="lbblurb">' + esc((g.blurbs && g.blurbs[o.mode]) || g.blurb) + '</p></section>' +
      '<section class="lbsec"><h3>Settings' + (L.isHost ? '' : ' <small>the host sets these</small>') + '</h3><div class="lbopts">' + g.opts.filter(d => !d[4] || d[4].includes(o.mode)).map(([k, label, vals]) =>
        '<label class="lbopt"><span>' + esc(label) + '</span>' + (L.isHost
          ? '<select data-o="' + k + '">' + vals.map(([v, l]) => '<option value="' + esc(String(v)) + '"' + (String(v) === String(o[k]) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>'
          : '<b>' + esc(optLabel(gid, k, o[k])) + '</b>') + '</label>').join('') + '</div></section>' +
      '<div class="lbgo">' + (roundOn
          ? '<p class="mpmsg">A round of ' + esc(LGAMES[L.round.g].name) + ' is on. You’ll be in the next one.</p>' + (L.isHost ? '<button class="btn" type="button" id="lbend">End the round</button>' : '')
          : L.isHost ? '<button class="btn primary big" type="button" id="lbstart"' + (n < g.min ? ' disabled' : '') + '>' + (n < g.min ? 'Need ' + g.min + ' players to start' : 'Start ' + esc(g.name) + ' · ' + n + (n === 1 ? ' player' : ' players')) + '</button>' +
              (playing.length > g.max ? '<p class="mpmsg">' + g.name + ' takes ' + g.max + '. The first ' + g.max + ' in the list play; the rest watch.</p>' : '')
            : '<p class="mpmsg">Waiting for ' + esc(nameOf(hostPeer())) + ' to start.</p>') + '</div>';
    $('lbcopy').onclick = () => { try { navigator.clipboard.writeText(L.code); $('lbcopy').textContent = 'Copied'; } catch {} };
    $('lbleave').onclick = () => leave();
    if ($('lbvis')) $('lbvis').onclick = () => writeLs({ pub:!ls.pub });
    $('lbso').onchange = () => L.room.presence({ so:$('lbso').checked ? 1 : 0 }).catch(() => {});
    main.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { if (!confirm('Remove ' + b.getAttribute('aria-label').slice(7) + ' from the lobby?')) return;
      writeLs({ ban:(L.ls.ban || []).concat(b.dataset.kick) }); });
    if (L.isHost){
      main.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { if (b.dataset.g !== gid) writeLs({ g:b.dataset.g }); });
      main.querySelectorAll('[data-o]').forEach(sel => sel.onchange = () => {
        const def = g.opts.find(x => x[0] === sel.dataset.o), raw = sel.value, val = typeof def[3] === 'number' ? +raw : raw;
        const all = Object.assign({}, L.ls.o); all[gid] = Object.assign({}, o, { [sel.dataset.o]:val },
          sel.dataset.o === 'mode' && g.modeSets ? g.modeSets[val] || {} : {}); writeLs({ o:all }); });
      if ($('lbstart')) $('lbstart').onclick = hostStart;
      if ($('lbend')) $('lbend').onclick = () => writeLs({ ph:'lobby', r:null });
    }
  }

  /* ── a round: the game, with a slim bar above it ── */
  function gameScreen(){
    unmountGame(); chatHidden = chatPref.game != null ? chatPref.game : true;
    screen = 'game'; wide(true); showChat(); ui.setQuick('game');
    const r = L.round, S = L.game;
    main.innerHTML = '<div class="lbbar" id="lbbar"></div><div class="lbgame" id="lbgame"></div>';
    gameBar();
    gameBox = $('lbgame');
    try { gameStop = BUILD[r.g === 'relay' ? 'relay' : r.g](gameBox, { lobby:S }); }
    catch (e){ console.error(e); gameBox.innerHTML = '<p class="mpmsg">That game didn’t start: ' + esc(e.message) + '</p>'; }
  }
  function gameBar(){
    const el = $('lbbar'); if (!el || !L.round) return;
    const S = L.game, g = LGAMES[L.round.g];
    el.innerHTML = '<span>Lobby <b>' + esc(L.code) + '</b> · ' + esc(g.name) + (S && S.watch ? ' · watching' : '') + '</span>' +
      '<span class="mpbtns">' + (L.isHost ? '<button class="btn" type="button" id="lbend2">End the round</button>' : '') +
      '<button class="btn" type="button" id="lbback">' + (S && S.watch ? 'Stop watching' : 'Back to lobby') + '</button></span>';
    if ($('lbend2')) $('lbend2').onclick = () => { if (confirm('End this round for everyone?')) writeLs({ ph:'lobby', r:null }); };
    $('lbback').onclick = () => {
      if (S && !S.watch && !S.ended && !confirm('Leave this round? You’ll be out of it.')) return;
      if (S && S.leaveFn && !S.watch) try { S.leaveFn(); } catch {}
      if (L.isHost){ writeLs({ ph:'lobby', r:null }); return; }
      L.left = L.round ? L.round.id : ''; unmountGame(); lobbyScreen();
    };
  }
  function unmountGame(){
    if (gameStop){ try { gameStop(); } catch (e){ console.error(e); } gameStop = null; }
    if (gameBox){ gameBox.innerHTML = ''; gameBox = null; }
  }

  /* ── the chat panel ── */
  function showChat(){
    chatEl.hidden = chatHidden; $('mpcopen').hidden = !chatHidden;
    if (!chatHidden){ L.unread = 0; pill(); }
    badge(); renderChatLog(); renderQuick();
  }
  function badge(){ const b = $('mpcbadge'); if (b) b.textContent = L.unread ? ' · ' + L.unread : ''; }
  $('mpcx').onclick = () => { chatHidden = true; if (screen === 'game' || screen === 'lobby') chatPref[screen] = true; showChat(); };
  $('mpcopen').onclick = () => { chatHidden = false; if (screen === 'game' || screen === 'lobby') chatPref[screen] = false; showChat(); try { $('mpcmsg').focus({ preventScroll:true }); } catch {} };
  /* a round gets the whole width of the window (up to a point), so the other players' boards fit beside yours */
  function wide(on){
    host.classList.toggle('mpwide', !!on);
    host.style.width = on ? 'min(calc(100vw - 24px), 1320px)' : '';
    host.style.marginLeft = on ? 'calc((100% - min(calc(100vw - 24px), 1320px)) / 2)' : '';
  }
  /* with the chat folded away, a new line shows for a moment beside its button */
  let toastT = 0;
  function toast(c){
    if (!alive || !chatHidden || screen === 'menu') return;
    const t = $('mpctoast'); if (!t) return;
    t.innerHTML = '<b>' + esc(c.n) + '</b> ' + esc(c.m); t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
  }
  $('mpcin').onsubmit = e => { e.preventDefault(); const i = $('mpcmsg'); if (say(i.value)) i.value = ''; };
  function renderChatLog(){
    if (!alive) return;
    if (chatHidden) badge(); else { L.unread = 0; pill(); }
    const log = $('mpclog'); if (!log) return;
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.innerHTML = L.chat.length ? L.chat.map(c => c.k === 's' ? '<p class="mpcs">' + esc(c.m) + '</p>'
      : '<p class="' + (c.who === L.me ? 'mine' : '') + (c.k === 'rx' ? ' rx' : '') + '"><b>' + esc(c.n) + '</b>' + (c.k === 'rx' ? '<span class="mpcrxm">' + esc(c.m) + '</span>' : esc(c.m)) + '</p>').join('')
      : '<p class="mpcs">Nothing yet. Say hello.</p>';
    if (near || !log.dataset.seen){ log.scrollTop = log.scrollHeight; log.dataset.seen = 1; }
  }
  function renderQuick(){
    const q = $('mpcq'), rx = $('mpcrx'); if (!q) return;
    const lines = (QUICK[quickKind] || QUICK.lobby).slice();
    if (quickKind === 'lobby' && L.ls && LGAMES[L.ls.g]) lines[4] = 'Let’s play ' + LGAMES[L.ls.g].name;
    q.innerHTML = lines.map(t => '<button type="button" data-q="' + esc(t) + '">' + esc(t) + '</button>').join('');
    q.querySelectorAll('[data-q]').forEach(b => b.onclick = () => say(b.dataset.q));
    rx.innerHTML = REACT.map(e => '<button type="button" data-rx="' + e + '" aria-label="React ' + e + '">' + e + '</button>').join('');
    rx.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => say(b.dataset.rx, 'rx'));
  }
  /* a reaction floats up over the hub */
  function burst(e){
    if (!alive || !gameAnim()) return;
    const m = $('mph'); if (!m) return;
    const s = document.createElement('span'); s.className = 'mpburst'; s.textContent = e; s.style.left = (20 + Math.random() * 60) + '%';
    m.appendChild(s); setTimeout(() => s.remove(), 1700);
  }

  /* back in from somewhere else on this page, or after a reload in this tab */
  if (L.room) ui.refresh(true);
  else {
    menu();
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem(SS) || 'null'); } catch {}
    if (saved && saved.code){ $('lbmsg').textContent = 'Rejoining ' + saved.code + '…';
      connect('join', saved.code, saved.name).then(() => ui.refresh(true)).catch(e => { try { sessionStorage.removeItem(SS); } catch {} if ($('lbmsg')) $('lbmsg').textContent = (e && e.message) || 'Couldn’t rejoin.'; }); }
  }
  pill();
  return () => { alive = false; unmountGame(); wide(false); if (unsubPub) unsubPub(); if (L.ui === ui) L.ui = null; pill(); };
}
const LCOL = ['#3b82f6', '#22c55e', '#ec4899', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444', '#84cc16', '#06b6d4', '#f97316'];
window.MP_COLOURS = LCOL;

/* ═══════════════ Sketch: write, draw, guess (a lobby game only) ═══════════════
   Everyone writes a prompt. Each prompt then passes round the lobby, one
   person at a time: the next draws it, the next guesses what the drawing
   is, the next draws that guess, and so on, each seeing only the step
   just before theirs. At the end every chain is shown from the start, one
   step at a time, so everyone sees how far it drifted.
   · Player i works, at step k, on the chain started by player (i − k) mod N.
   · The host times the steps ('step'), and moves on when everyone has
     handed in or time is up (anyone who hasn't is handed in for, with what
     they had). Hand-ins ('sub') go to everyone, so everyone has every chain
     for the end. Drawings travel as small WebP pictures.
   · Someone who missed a hand-in asks for it again ('need'); the host
     sends it. ── */
const IDEAS = ['A cat doing its homework', 'The canteen on fire', 'A dog driving a bus', 'Running late for an exam', 'A penguin at the beach', 'Dinosaur in a library',
  'The school on the moon', 'A very confused robot', 'Pizza delivery by helicopter', 'Fish riding a bicycle', 'A haunted vending machine', 'Snowman in summer',
  'A teacher who is secretly a spy', 'Volcano made of jelly', 'The world’s smallest elephant', 'A ghost learning to drive', 'Queue for the canteen', 'Basketball with an orange',
  'A frog in a suit', 'Science experiment gone wrong', 'Sleeping through the alarm', 'Alien at assembly', 'A tree with too many birds', 'Surfing on a pancake'];
const PALETTE = ['#111111', '#ffffff', '#8a8f98', '#e5484d', '#f76b15', '#ffcc1a', '#30a46c', '#12a594', '#0090ff', '#6e56cf', '#e93d82', '#8d5a3b'];
BUILD.relay = (host, o) => {
  const LB = o && o.lobby;
  if (!LB){ host.innerHTML = '<p class="mpmsg">Sketch is played in a lobby.</p>'; return () => {}; }
  const O = LB.opts || {}, R = LB.room, me = LB.me, isHost = LB.isHost;
  const P = LB.players, N = P.length, my = P.findIndex(p => p.id === me);
  const STEPS = O.len === 'half' ? Math.min(N, Math.max(3, Math.ceil(N / 2) + 1)) : N;
  const DRAW = (+O.draw || 90) * 1000, WRITE = (+O.write || 30) * 1000;
  const typeOf = k => k === 0 ? 'w' : k % 2 ? 'd' : 'g';             // write, draw, guess
  const chainFor = (i, k) => ((i - k) % N + N) % N;                     // the chain player i works on at step k
  const who = (c, k) => P[(c + k) % N];                                  // who works on chain c at step k
  const chains = Array.from({ length:N }, () => Array(STEPS).fill(null));
  let k = -1, at = 0, end = 0, done = false, phase = 'play', tick = 0, offs = [], alive = true, show = { c:0, i:0 }, strokes = null;
  host.innerHTML = '<div class="row"><div><h2>Sketch</h2><p class="how">Write something, draw what you’re given, guess what you’re shown.</p></div><span class="score" id="sc"></span></div>' +
    '<div class="skbar"><span id="sktask"></span><span class="sktime"><i id="sktimer"></i></span></div><div class="skmain" id="skmain"></div>';
  const main = $('skmain');
  const left = () => Math.max(0, end - R.now());
  /* ── the host times it ── */
  function hostStep(n){
    const len = typeOf(n) === 'd' ? DRAW : WRITE, a = R.now() + 900;
    R.emit('step', { k:n, at:a, end:a + len });
  }
  function hostCheck(){
    if (!isHost || phase !== 'play' || k < 0) return;
    const here = new Set(R.peers().map(p => p.id));
    const missing = P.map((p, i) => ({ p, c:chainFor(i, k) })).filter(x => !chains[x.c][k]);
    const absent = missing.filter(x => !here.has(x.p.id));
    absent.forEach(x => { const s = { k, c:x.c, t:typeOf(k), v:null, by:x.p.id, skip:1 }; chains[x.c][k] = s; R.emit('sub', s); });
    const still = missing.length - absent.length;
    if (!still || R.now() > end + 2500){
      if (still) missing.forEach(x => { if (!chains[x.c][k]){ const s = { k, c:x.c, t:typeOf(k), v:null, by:x.p.id, skip:1 }; chains[x.c][k] = s; R.emit('sub', s); } });
      if (k + 1 < STEPS) hostStep(k + 1); else R.emit('reveal', { c:0, i:0 });
    }
  }
  /* ── a step starts ── */
  function startStep(n, a, e){
    if (n <= k) return;
    k = n; at = a; end = e; done = false; strokes = null;
    const c = chainFor(my, k), t = typeOf(k);
    if (k > 0 && !chains[c][k - 1]) R.emit('need', { c, k:k - 1 });
    $('sktask').textContent = 'Step ' + (k + 1) + ' of ' + STEPS + ' · ' + (t === 'w' ? 'Write a prompt' : t === 'd' ? 'Draw it' : 'What is it?');
    if (my < 0){ main.innerHTML = '<p class="mpmsg">Watching. You’ll see the chains at the end.</p>'; return; }
    if (t === 'w') writeUI(c, 'Write something for someone else to draw', true);
    else if (t === 'd') drawUI(c);
    else guessUI(c);
    LB.quick('game');
  }
  function prevOf(c){ const p = chains[c][k - 1]; return p; }
  function submit(t, v){
    if (done || my < 0) return;
    done = true;
    const c = chainFor(my, k), s = { k, c, t, v, by:me };
    chains[c][k] = s; R.emit('sub', s);
    main.querySelectorAll('button,input').forEach(el => el.disabled = true);
    const w = document.createElement('p'); w.className = 'mpmsg skwait'; w.id = 'skwait'; main.appendChild(w); progress();
    SFX.flip && SFX.flip();
  }
  function progress(){
    const el = $('skwait'); if (!el || k < 0) return;
    const n = chains.filter(ch => ch[k]).length;
    el.textContent = 'Handed in. Waiting for the others (' + n + ' of ' + N + ').';
  }
  /* ── writing and guessing ── */
  function writeUI(c, label, idea){
    main.innerHTML = '<div class="skwrite"><label class="sklabel" for="skin">' + esc(label) + '</label>' +
      '<div class="skrow"><input id="skin" maxlength="80" autocomplete="off" data-lpignore="true" data-1p-ignore placeholder="' + (idea ? 'A cat doing its homework' : 'Your guess') + '">' +
      (idea ? '<button class="btn" type="button" id="skidea">Give me an idea</button>' : '') + '<button class="btn primary" type="button" id="skdone">Done</button></div></div>';
    const go = () => { const v = MPF.censor($('skin').value.trim().slice(0, 80)); if (!v && !idea) return; submit(typeOf(k), v || IDEAS[(Math.random() * IDEAS.length) | 0]); };
    $('skdone').onclick = go;
    $('skin').onkeydown = e => { if (e.key === 'Enter') go(); };
    if (idea) $('skidea').onclick = () => { $('skin').value = IDEAS[(Math.random() * IDEAS.length) | 0]; $('skin').focus(); };
    setTimeout(() => { try { $('skin').focus({ preventScroll:true }); } catch {} }, 50);
  }
  function guessUI(c){
    const p = prevOf(c);
    writeUI(c, 'What is this drawing?', false);
    const box = document.createElement('div'); box.className = 'skshow';
    box.innerHTML = p && p.v ? '<img alt="The drawing to guess" src="' + esc(p.v) + '">' : '<p class="mpmsg">Nobody drew anything here. Make something up.</p>';
    main.insertBefore(box, main.firstChild);
  }
  /* ── drawing ── */
  function drawUI(c){
    const p = prevOf(c);
    main.innerHTML = '<p class="skprompt">' + (p && p.v ? 'Draw: <b>' + esc(p.v) + '</b>' : 'Draw anything: there was nothing to go on.') + '</p>' +
      '<div class="skdraw"><div class="skcanv"><canvas id="skc" width="960" height="720"></canvas></div>' +
      '<div class="sktools"><div class="skpal">' + PALETTE.map((col, i) => '<button type="button" data-col="' + col + '" style="--c:' + col + '" aria-label="Colour ' + (i + 1) + '"' + (i === 0 ? ' aria-pressed="true"' : '') + '></button>').join('') + '</div>' +
      '<div class="sksizes">' + [4, 10, 24].map((w, i) => '<button type="button" data-w="' + w + '" aria-label="Brush ' + ['small', 'medium', 'large'][i] + '"' + (i === 1 ? ' aria-pressed="true"' : '') + '><i style="--s:' + (w / 2 + 3) + 'px"></i></button>').join('') + '</div>' +
      '<div class="skmode"><button type="button" class="diffpill" data-tool="pen" aria-pressed="true">Pen</button><button type="button" class="diffpill" data-tool="fill">Fill</button><button type="button" class="diffpill" data-tool="erase">Rubber</button></div>' +
      '<div class="skacts"><button class="btn" type="button" id="skundo">Undo</button><button class="btn" type="button" id="skclear">Clear</button><button class="btn primary" type="button" id="skdone">Done</button></div></div></div>';
    const cv = $('skc'), x = cv.getContext('2d', { willReadFrequently:true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    let col = PALETTE[0], width = 10, tool = 'pen', down = false, lastP = null, hist = [];
    const snap = () => { hist.push(x.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 25) hist.shift(); };
    const pos = e => { const r = cv.getBoundingClientRect(); return { x:(e.clientX - r.left) * cv.width / r.width, y:(e.clientY - r.top) * cv.height / r.height }; };
    const scaleW = () => width * cv.width / 480;
    cv.addEventListener('pointerdown', e => {
      if (done) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
      const p = pos(e); snap();
      if (tool === 'fill'){ flood(x, cv, p.x | 0, p.y | 0, col); return; }
      down = true; lastP = p;
      x.beginPath(); x.arc(p.x, p.y, scaleW() / 2, 0, 6.2832); x.fillStyle = tool === 'erase' ? '#fff' : col; x.fill();
    });
    cv.addEventListener('pointermove', e => {
      if (!down) return; const p = pos(e);
      x.strokeStyle = tool === 'erase' ? '#fff' : col; x.lineWidth = scaleW(); x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(lastP.x, lastP.y); x.quadraticCurveTo(lastP.x, lastP.y, (lastP.x + p.x) / 2, (lastP.y + p.y) / 2); x.lineTo(p.x, p.y); x.stroke();
      lastP = p;
    });
    const up = () => { down = false; lastP = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    main.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { col = b.dataset.col; if (tool === 'erase') setTool('pen'); main.querySelectorAll('[data-col]').forEach(z => z.setAttribute('aria-pressed', String(z === b))); });
    main.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { width = +b.dataset.w; main.querySelectorAll('[data-w]').forEach(z => z.setAttribute('aria-pressed', String(z === b))); });
    const setTool = t => { tool = t; main.querySelectorAll('[data-tool]').forEach(z => z.setAttribute('aria-pressed', String(z.dataset.tool === t))); };
    main.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    $('skundo').onclick = () => { const h = hist.pop(); if (h) x.putImageData(h, 0, 0); };
    $('skclear').onclick = () => { snap(); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); };
    strokes = () => picture(cv);
    $('skdone').onclick = () => submit('d', picture(cv));
  }
  /* the drawing, small enough to send: 480 × 360, WebP where the browser can */
  function picture(cv){
    const s = document.createElement('canvas'); s.width = 480; s.height = 360;
    s.getContext('2d').drawImage(cv, 0, 0, 480, 360);
    let u = ''; try { u = s.toDataURL('image/webp', .72); } catch {}
    if (!/^data:image\/webp/.test(u)) u = s.toDataURL('image/jpeg', .75);
    return u;
  }
  function flood(x, cv, sx, sy, hex){
    const w = cv.width, h = cv.height, img = x.getImageData(0, 0, w, h), d = img.data, i0 = (sy * w + sx) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const c = parseInt(hex.slice(1), 16), nr = c >> 16, ng = (c >> 8) & 255, nb = c & 255;
    if (Math.abs(tr - nr) + Math.abs(tg - ng) + Math.abs(tb - nb) < 10) return;
    const near = i => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) < 90;
    const stack = [[sx, sy]];
    while (stack.length){
      let [px, py] = stack.pop(); let i = (py * w + px) * 4;
      while (py >= 0 && near(i)){ py--; i -= w * 4; }
      py++; i += w * 4; let l = false, r = false;
      while (py < h && near(i)){
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
        if (px > 0){ if (near(i - 4)){ if (!l){ stack.push([px - 1, py]); l = true; } } else l = false; }
        if (px < w - 1){ if (near(i + 4)){ if (!r){ stack.push([px + 1, py]); r = true; } } else r = false; }
        py++; i += w * 4;
      }
    }
    x.putImageData(img, 0, 0);
  }
  /* ── the end: each chain, a step at a time ── */
  function reveal(c, i){
    phase = 'reveal'; show = { c, i };
    $('sktask').textContent = 'The chains · ' + (c + 1) + ' of ' + N;
    $('sktimer').style.width = '0';
    const ch = chains[c], starter = P[c];
    const entry = (s, j) => { const by = who(c, j), name = by.id === me ? 'You' : by.n;
      if (!s) return '<div class="skent miss"><b>' + esc(name) + '</b><span>(missed)</span></div>';
      if (s.t === 'd') return '<div class="skent draw"><b>' + esc(name) + ' drew</b>' + (s.v ? '<img alt="Drawing" src="' + esc(s.v) + '">' : '<span>(nothing)</span>') + '</div>';
      return '<div class="skent text"><b>' + esc(name) + (j === 0 ? ' wrote' : ' guessed') + '</b><q>' + esc(s.v || '(nothing)') + '</q></div>'; };
    main.innerHTML = '<div class="skalbum"><h3>' + esc(starter.id === me ? 'Your' : starter.n + '’s') + ' chain</h3>' +
      ch.slice(0, i + 1).map(entry).join('') + '</div>' +
      '<div class="skrevbtns">' + (isHost
        ? (i + 1 < STEPS ? '<button class="btn primary" type="button" id="sknext">Next</button>' : c + 1 < N ? '<button class="btn primary" type="button" id="sknext">Next chain</button>' : '<button class="btn primary" type="button" id="skend">Back to the lobby</button>')
        : '<p class="mpmsg">' + esc(LB.players.find(p => p.id === LB.hostId) ? LB.players.find(p => p.id === LB.hostId).n : 'The host') + ' moves it on.</p>') + '</div>';
    const last = main.querySelector('.skent:last-child'); if (last) last.classList.add('new');
    if ($('sknext')) $('sknext').onclick = () => R.emit('reveal', i + 1 < STEPS ? { c, i:i + 1 } : { c:c + 1, i:0 });
    if ($('skend')) $('skend').onclick = () => { R.emit('fin', {}); };
    LB.quick('over');
    const sc = main.querySelector('.skent.new'); if (sc && sc.scrollIntoView) try { sc.scrollIntoView({ block:'nearest', behavior:'smooth' }); } catch {}
  }
  /* ── messages ── */
  offs.push(R.on('step', m => { if (m.peer !== LB.hostId) return; const d = m.data || {}; if (phase === 'play') startStep(d.k | 0, +d.at, +d.end); }));
  offs.push(R.on('sub', m => { const d = m.data || {}; if (!(d.c >= 0 && d.c < N && d.k >= 0 && d.k < STEPS)) return;
    const s = { k:d.k, c:d.c, t:d.t === 'd' ? 'd' : d.t === 'g' ? 'g' : 'w', v:d.t === 'd' ? (/^data:image\/(webp|jpeg|png);base64,/.test(d.v || '') ? d.v : null) : d.v == null ? null : MPF.censor(String(d.v).slice(0, 80)), by:d.by, skip:d.skip };
    if (!chains[d.c][d.k] || (chains[d.c][d.k].skip && !d.skip)) chains[d.c][d.k] = s;
    progress(); if (isHost) hostCheck(); }));
  offs.push(R.on('need', m => { if (!isHost) return; const d = m.data || {}, s = chains[d.c] && chains[d.c][d.k]; if (s) R.emit('sub', s); }));
  offs.push(R.on('reveal', m => { if (m.peer !== LB.hostId) return; const d = m.data || {}; if (d.c < N) reveal(d.c | 0, d.i | 0); }));
  offs.push(R.on('fin', m => { if (m.peer !== LB.hostId) return; LB.say('That was Sketch. ' + N + ' chains, ' + STEPS + ' steps each.'); LB.back(); }));
  LB.peersFn = () => { if (isHost) hostCheck(); };
  /* the clock: the bar runs down; at the end you hand in what you have */
  tick = setInterval(() => {
    if (!alive || phase !== 'play' || k < 0) return;
    const total = end - at, l = left();
    $('sktimer').style.width = Math.max(0, Math.min(100, l / total * 100)) + '%';
    $('sc').textContent = Math.ceil(l / 1000) + 's';
    if (!done && my >= 0 && l < 400){
      const t = typeOf(k);
      if (t === 'd') submit('d', strokes ? strokes() : null);
      else { const i = $('skin'); const v = i ? MPF.censor(i.value.trim().slice(0, 80)) : ''; submit(t, v || (t === 'w' ? IDEAS[(Math.random() * IDEAS.length) | 0] : '')); }
    }
    if (isHost && l <= 0) hostCheck();
  }, 200);
  main.innerHTML = '<p class="mpmsg">Starting…</p>';
  if (isHost) setTimeout(() => { if (alive) hostStep(0); }, Math.max(0, LB.at - R.now()));
  return () => { alive = false; clearInterval(tick); offs.forEach(f => { try { f(); } catch {} }); };
};

BUILD.mp = (host, o) => hub(host, o);
GORDER.forEach(id => { BUILD['mp-' + id] = host => hub(host, { pick:id }); });

/* the games page: the lobby's tab follows you around it; leaving the page drops you (and coming back rejoins) */
addEventListener('pagehide', () => { if (L.room) try { L.room.leave(); } catch {} });
setTimeout(() => {
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem(SS) || 'null'); } catch {}
  if (saved && saved.code && !L.room && !(L.ui) && !/[?&]play=mp/.test(location.search))
    connect('join', saved.code, saved.name).catch(() => { try { sessionStorage.removeItem(SS); } catch {} });
}, 600);
})();
