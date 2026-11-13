/*
 * Online rooms for the arcade games (Tetris and Snake versus).
 *
 * The same Firebase Realtime Database that Hong Kong Mahjong uses for its
 * rooms (hkmahjong.html), under the same rooms/<name> path, so it works with
 * the same database rules. Nothing about a player is stored but the name they
 * play under, and a room's messages delete themselves after 30 seconds; a
 * player's entry goes when they close the page.
 *
 *   const r = await Rooms.host('tt', 'Alex', 4)   → { code, room }  (a fresh room)
 *   const r = await Rooms.join('tt', 'K7QX2', 'Sam') → { code, room }
 *   const r = await Rooms.join('tt', 'K7QX2', 'Sam', true) → watch: presence { w: 1 }, never plays
 *   const pub = await Rooms.lobby('tt') → the room public hosts announce themselves in
 *   room.emit(topic, data)  room.on(topic, fn)  room.presence(patch)
 *   room.peers()  room.onPeers(fn)  room.id  room.leave()  room.now()
 *
 * Every player in a room sees every message. The host decides (who plays, the
 * seed, the snake arena); a message's `peer` says who sent it.
 */
(function(){
  const CONFIG = {
    apiKey: "AIzaSyACB58WZ04Xw0bGpFs8ZsZ67EI34kDJhI0",
    authDomain: "mscunofficialmahjong.firebaseapp.com",
    databaseURL: "https://mscunofficialmahjong-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mscunofficialmahjong",
    storageBucket: "mscunofficialmahjong.firebasestorage.app",
    messagingSenderId: "179376283673",
    appId: "1:179376283673:web:fcd31b35ae68f7081f4a88"
  };
  const SOURCES = ['https://www.gstatic.com/firebasejs/10.12.2/', 'https://cdn.jsdelivr.net/npm/firebase@10.12.2/', 'https://unpkg.com/firebase@10.12.2/'];
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });

  let ready = null;
  function connect(){
    if (ready) return ready;
    ready = (async () => {
      if (!window.firebase || !window.firebase.database){
        let ok = false;
        for (const src of SOURCES){
          try {
            if (!window.firebase) await loadScript(src + 'firebase-app-compat.js');
            await loadScript(src + 'firebase-database-compat.js');
            if (window.firebase && window.firebase.database){ ok = true; break; }
          } catch (e) { /* try the next one */ }
        }
        if (!ok) throw new Error('Couldn’t load the online rooms. This network may be blocking them.');
      }
      const fb = window.firebase;
      const app = fb.apps.length ? fb.app() : fb.initializeApp(CONFIG);
      const db = fb.database(app);
      await new Promise((res, rej) => {
        const r = db.ref('.info/connected');
        const t = setTimeout(() => { r.off(); rej(new Error('Couldn’t reach the online rooms. Check your connection.')); }, 12000);
        r.on('value', s => { if (s.val() === true){ clearTimeout(t); r.off(); res(); } });
      });
      let offset = 0;
      try { offset = (await db.ref('.info/serverTimeOffset').once('value')).val() || 0; } catch (e) {}
      return { fb, db, offset };
    })();
    ready.catch(() => { ready = null; });       // let a later try start again
    return ready;
  }

  async function open(name){
    const { fb, db, offset } = await connect();
    const me = 'p' + Math.random().toString(36).slice(2, 12);
    const TS = fb.database.ServerValue.TIMESTAMP;
    const base = db.ref('rooms/' + name), peersRef = base.child('peers'), evRef = base.child('events'), myRef = peersRef.child(me);
    const mine = {};
    let peers = [], gone = false;
    const peerFns = [], topicFns = {};
    const onPeers = snap => {
      const v = snap.val() || {}, list = [];
      for (const id in v){ let p = {}; try { p = JSON.parse(v[id].p || '{}'); } catch (e) {} list.push({ id, isMe: id === me, presence: p }); }
      peers = list;
      peerFns.slice().forEach(f => { try { f(peers); } catch (e) { console.error(e); } });
    };
    const evQuery = evRef.orderByChild('t').startAt(Date.now() + offset - 3000);
    const onEv = snap => {
      const v = snap.val(); if (!v || typeof v.topic !== 'string' || typeof v.d !== 'string') return;
      let data; try { data = JSON.parse(v.d); } catch (e) { return; }
      const msg = { topic: v.topic, data, peer: v.peer, isMe: v.peer === me };
      (topicFns[v.topic] || []).slice().forEach(f => { try { f(msg); } catch (e) { console.error(e); } });
    };
    await myRef.onDisconnect().remove();
    await myRef.set({ p: '{}', t: TS });
    peersRef.on('value', onPeers);
    evQuery.on('child_added', onEv);
    return {
      id: me, name,
      now: () => Date.now() + offset,
      emit: async (topic, data) => {
        if (gone) return;
        const r = evRef.push();
        await r.set({ topic, d: JSON.stringify(data), peer: me, t: TS });
        setTimeout(() => r.remove().catch(() => {}), 30000);
      },
      on: (topic, fn) => { (topicFns[topic] = topicFns[topic] || []).push(fn); return () => { topicFns[topic] = (topicFns[topic] || []).filter(f => f !== fn); }; },
      presence: async patch => { Object.assign(mine, patch); if (!gone) await myRef.set({ p: JSON.stringify(mine), t: TS }); },
      peers: () => peers,
      onPeers: fn => { peerFns.push(fn); if (peers.length) setTimeout(() => fn(peers), 0); return () => { const i = peerFns.indexOf(fn); if (i >= 0) peerFns.splice(i, 1); }; },
      leave: async () => {
        if (gone) return; gone = true;
        peersRef.off('value', onPeers); evQuery.off('child_added', onEv);
        await myRef.remove().catch(() => {});
        try { await myRef.onDisconnect().cancel(); } catch (e) {}
      }
    };
  }

  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';                 // no 0/O or 1/I
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), b => ALPHA[b % ALPHA.length]).join('');
  const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player';
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* a fresh room: pick a code nobody is hosting */
  async function host(game, name, max){
    for (let i = 0; i < 4; i++){
      const code = newCode(), room = await open(game + '-' + code.toLowerCase());
      await room.presence({ n: cleanName(name), h: 1, max: max || 4 });
      await wait(900);
      if (!room.peers().some(p => !p.isMe && p.presence.h)) return { code, room };
      await room.leave();
    }
    throw new Error('Couldn’t make a room. Try again.');
  }
  /* someone else's room: there must be a host there, and space (a watcher needs neither space nor a round off) */
  async function join(game, code, name, watch){
    code = cleanCode(code);
    if (code.length !== 5) throw new Error('Room codes are 5 letters and numbers.');
    const room = await open(game + '-' + code.toLowerCase());
    await wait(900);
    const others = room.peers().filter(p => !p.isMe), h = others.find(p => p.presence.h);
    if (!h){ await room.leave(); throw new Error('There’s no room with that code.'); }
    if (watch){ await room.presence({ n: cleanName(name), w: 1 }); return { code, room }; }
    if (others.filter(p => !p.presence.w).length >= (h.presence.max || 4)){ await room.leave(); throw new Error('That room is full.'); }
    if (h.presence.playing){ await room.leave(); throw new Error('That game has already started. Watch it, or ask them to let you in next round.'); }
    await room.presence({ n: cleanName(name) });
    return { code, room };
  }
    /* the public list: a shared room per game where each public host's presence is { code, n, players, playing } */
  const lobby = game => open(game + '-public');
  window.Rooms = { host, join, lobby, cleanName, cleanCode };
})();
