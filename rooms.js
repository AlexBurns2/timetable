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
 *
 * Faster paths (the owner, 26 November 2026: Firebase is in Singapore, about
 * 0.1 s each way from Sydney). Firebase still knows who's in a room, and is the
 * fallback; a message takes the quickest way to each player instead:
 *   - straight to them, when they're on the same network (WebRTC data channel,
 *     set up through the room's own messages). Same network only, by the
 *     owner's choice: no STUN server, and only a browser's anonymous ".local"
 *     names are ever passed on, never an IP address. School Wi-Fi often keeps
 *     devices apart, and then this just doesn't happen;
 *   - else through the Sydney relay (RELAY below: Supabase Realtime broadcast,
 *     a separate free project that holds nothing and only carries game rooms),
 *     when every other player has it;
 *   - else through Firebase, exactly as before (and always for the public lobby
 *     list, for anyone still on an older copy of this file, and when you're
 *     alone in a room, so someone joining a moment later still hears it).
 * Firebase's writes keep exactly the shapes they had (its rules aren't in this
 * repo). What a player can do is advertised in their presence as _v (this
 * version) and _r (the relay is up), which the games never see.
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
  /* The Sydney relay: a free Supabase project in ap-southeast-2 used only for game rooms (no tables, nothing stored).
     The key is its public anon / publishable key, which is meant to be in web pages. Empty: the relay is off. Its address
     also has to be in the CSP's connect-src (vercel.json). On localhost a test can point it elsewhere (window.__relayTest). */
  const RELAY = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.__relayTest) || { url: 'https://vhtjhllzlytvrnophuhh.supabase.co', key: 'sb_publishable_9SHCIotQd-NXDHripQHlYA_DLE-I5Ui' };

  /* Supabase Realtime broadcast over one WebSocket (protocol 2.0.0, arrays: [join_ref, ref, topic, event, payload]).
     No library: join a channel, send, receive, heartbeat every 25 s, and rejoin with backoff if it drops. */
  const Relay = (() => {
    const usable = !!(RELAY.url && RELAY.key && typeof WebSocket === 'function');
    let ws = null, ref = 0, hb = 0, backoff = 1000;
    const chans = new Map();                                   // topic → { joinRef, ok, onMsg, onState }
    const raw = m => { if (ws && ws.readyState === 1){ try { ws.send(JSON.stringify(m)); return true; } catch (e) {} } return false; };
    const setOk = (c, ok) => { if (c.ok !== ok){ c.ok = ok; try { c.onState(ok); } catch (e) {} } };
    const joinCh = (topic, c) => { setOk(c, false); c.joinRef = String(++ref);
      raw([c.joinRef, c.joinRef, topic, 'phx_join', { config:{ broadcast:{ ack:false, self:false }, presence:{ enabled:false }, private:false, postgres_changes:[] } }]); };
    function connect(){
      if (ws || !usable) return;
      try { ws = new WebSocket(RELAY.url.replace(/^http/, 'ws').replace(/\/+$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(RELAY.key) + '&vsn=2.0.0'); }
      catch (e) { ws = null; return; }
      ws.onopen = () => { backoff = 1000; for (const [t, c] of chans) joinCh(t, c);
        clearInterval(hb); hb = setInterval(() => raw([null, String(++ref), 'phoenix', 'heartbeat', {}]), 25000); };
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (er) { return; }
        if (!Array.isArray(m)) return;
        const jr = m[0], topic = m[2], ev = m[3], pl = m[4], c = chans.get(topic);
        if (!c) return;
        if (ev === 'phx_reply'){ if (jr === c.joinRef) setOk(c, !!(pl && pl.status === 'ok')); }
        else if (ev === 'broadcast'){ if (pl && pl.event === 'm') c.onMsg(pl.payload); }
        else if (ev === 'phx_error' || ev === 'phx_close'){
          setOk(c, false);
          setTimeout(() => { if (chans.get(topic) === c && ws && ws.readyState === 1) joinCh(topic, c); }, 2000 + Math.random() * 2000);
        }
      };
      ws.onclose = () => { ws = null; clearInterval(hb); for (const c of chans.values()) setOk(c, false);
        if (chans.size){ setTimeout(connect, backoff); backoff = Math.min(10000, backoff * 2); } };
    }
    return {
      usable,
      join(topic, onMsg, onState){
        const c = { joinRef:'', ok:false, onMsg, onState: onState || (() => {}) };
        chans.set(topic, c);
        if (ws && ws.readyState === 1) joinCh(topic, c); else connect();
        return {
          ready: () => c.ok && !!ws && ws.readyState === 1,
          send: payload => c.ok && raw([c.joinRef, String(++ref), topic, 'broadcast', { event:'m', type:'broadcast', payload }]),
          leave: () => {
            if (chans.get(topic) !== c) return;
            chans.delete(topic); raw([c.joinRef, String(++ref), topic, 'phx_leave', {}]);
            if (!chans.size && ws){ const w = ws; ws = null; clearInterval(hb); w.onclose = null; try { w.close(); } catch (e) {} }
          }
        };
      }
    };
  })();
  const canDirect = typeof RTCPeerConnection === 'function';
  const VERSION = 2;                                          // what this file can do, in presence as _v
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
    let peers = [], gone = false, raw = {}, lastKey = '';
    const peerFns = [], topicFns = {};
    /* the faster paths: not for a public lobby list (many hosts, little traffic) */
    const fast = !/-public$/.test(name);
    let relayOk = false, rch = null, seq = 0;
    const direct = new Map();                                  // peer id → { pc, dc, open, at, failed, cands, remote }
    const seen = new Set(), seenQ = [];                        // ids of messages already handled (the fast paths can repeat one)
    const pres = () => JSON.stringify(Object.assign({}, mine, fast ? { _v: VERSION } : {}, fast && relayOk ? { _r: 1 } : {}));
    const writeMe = () => myRef.set({ p: pres(), t: TS });
    /* Ghosts: a peer is removed when its browser disconnects, but a phone that sleeps or a
       connection that drops can leave it behind for good (a public lobby nobody is in, still
       listed). So every open room says it's still here every BEAT, and anyone not heard from
       for STALE is treated as gone. */
    const BEAT = 30000, STALE = 150000;
    const build = () => {
      const list = [], now = Date.now() + offset;
      /* what someone else's computer wrote: always a plain object, whatever they sent */
      for (const id in raw){ const r = raw[id] || {};
        if (id !== me && typeof r.t === 'number' && now - r.t > STALE) continue;
        let p = {}; try { p = JSON.parse(r.p || '{}'); } catch (e) {}
        if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
        /* what their copy of this file can do (kept out of what the games see) */
        const v = Number(p._v) || 0, relay = p._r === 1; delete p._v; delete p._r;
        list.push({ id, isMe: id === me, presence: p, _v: v, _relay: relay }); }
      const key = JSON.stringify(list.map(q => [q.id, q.presence, q._v, q._relay]));
      if (key === lastKey) return; lastKey = key;
      peers = list;
      linkUp();
      const shown = list.map(q => ({ id: q.id, isMe: q.isMe, presence: q.presence }));
      peerFns.slice().forEach(f => { try { f(shown); } catch (e) { console.error(e); } });
    };
    const onPeers = snap => { raw = snap.val() || {}; lastKey = ''; build(); };

    /* one message, however it came: handed to the games once */
    function deliver(v, from){
      if (!v || typeof v.topic !== 'string' || typeof v.d !== 'string') return;
      if (v.id){ if (seen.has(v.id)) return; seen.add(v.id); seenQ.push(v.id); if (seenQ.length > 3000) seen.delete(seenQ.shift()); }
      let data; try { data = JSON.parse(v.d); } catch (e) { return; }
      const peer = from || v.peer, msg = { topic: v.topic, data, peer, isMe: peer === me };
      (topicFns[v.topic] || []).slice().forEach(f => { try { f(msg); } catch (e) { console.error(e); } });
    }
    /* Firebase, as before: the same shape of entry, gone after 30 s */
    const fbWrite = async (topic, d) => {
      const r = evRef.push();
      await r.set({ topic, d, peer: me, t: TS });
      setTimeout(() => r.remove().catch(() => {}), 30000);
    };
    const evQuery = evRef.orderByChild('t').startAt(Date.now() + offset - 3000);
    const onEv = snap => {
      const v = snap.val(); if (!v || typeof v.topic !== 'string' || typeof v.d !== 'string') return;
      if (v.topic === SIG){ if (v.peer !== me) onSig(v.peer, v.d); return; }
      if (v.peer === me) return;                               // your own were handed over when you sent them
      deliver({ topic: v.topic, d: v.d, peer: v.peer });
    };

    /* ── straight to players on the same network (WebRTC) ── */
    const SIG = 'zsig';                                        // connection set-up, through Firebase; older copies ignore it
    const localOnly = s => String(s || '').split(/\r?\n/).filter(l => !/^a=candidate:/.test(l) || /\.local\s/i.test(l)).join('\r\n');
    const sig = (to, s) => fbWrite(SIG, JSON.stringify({ to, s })).catch(() => {});
    function dropLink(id, failed){
      const l = direct.get(id); if (!l) return;
      try { l.dc && l.dc.close(); } catch (e) {} try { l.pc.close(); } catch (e) {}
      if (failed) direct.set(id, { failed: Date.now() }); else direct.delete(id);
    }
    function newLink(id){
      const pc = new RTCPeerConnection({ iceServers: [] });    // no STUN: same network only
      const l = { pc, dc: null, open: false, at: Date.now(), cands: [], remote: false };
      direct.set(id, l);
      pc.onicecandidate = e => { const c = e.candidate;
        if (c && c.candidate && /\.local\s/i.test(c.candidate)) sig(id, { c: c.toJSON ? c.toJSON() : { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex } }); };
      pc.onconnectionstatechange = () => { if (/failed|closed/.test(pc.connectionState)) dropLink(id, true); };
      setTimeout(() => { const x = direct.get(id); if (x === l && !l.open) dropLink(id, true); }, 12000);
      return l;
    }
    function wire(id, l, dc){
      l.dc = dc;
      dc.onopen = () => { l.open = true; };
      dc.onclose = () => { l.open = false; if (direct.get(id) === l) dropLink(id, false); };
      dc.onmessage = e => { let v; try { v = JSON.parse(e.data); } catch (er) { return; } deliver(v, id); };
    }
    /* the one with the smaller id offers; each pair tries again after two minutes if it didn't work */
    function linkUp(){
      if (!fast || !canDirect || gone) return;
      const here = new Set(peers.map(p => p.id));
      for (const id of [...direct.keys()]) if (!here.has(id)) dropLink(id, false);
      for (const p of peers){
        if (p.isMe || p._v < 2 || me > p.id) continue;
        const l = direct.get(p.id);
        if (l && !(l.failed && Date.now() - l.failed > 120000)) continue;
        const n = newLink(p.id);
        wire(p.id, n, n.pc.createDataChannel('m', { ordered: true }));
        n.pc.createOffer().then(o => n.pc.setLocalDescription(o))
          .then(() => sig(p.id, { sdp: { type: 'offer', sdp: localOnly(n.pc.localDescription.sdp) } })).catch(() => dropLink(p.id, true));
      }
    }
    async function onSig(from, d){
      let m; try { m = JSON.parse(d); } catch (e) { return; }
      if (!m || m.to !== me || !m.s || !fast || !canDirect || gone) return;
      const s = m.s;
      try {
        if (s.sdp && s.sdp.type === 'offer' && from < me){
          dropLink(from, false);
          const l = newLink(from);
          l.pc.ondatachannel = e => wire(from, l, e.channel);
          await l.pc.setRemoteDescription({ type: 'offer', sdp: localOnly(s.sdp.sdp) }); l.remote = true;
          for (const c of l.cands.splice(0)) await l.pc.addIceCandidate(c).catch(() => {});
          await l.pc.setLocalDescription(await l.pc.createAnswer());
          sig(from, { sdp: { type: 'answer', sdp: localOnly(l.pc.localDescription.sdp) } });
        } else if (s.sdp && s.sdp.type === 'answer'){
          const l = direct.get(from); if (!l || !l.pc || l.remote) return;
          await l.pc.setRemoteDescription({ type: 'answer', sdp: localOnly(s.sdp.sdp) }); l.remote = true;
          for (const c of l.cands.splice(0)) await l.pc.addIceCandidate(c).catch(() => {});
        } else if (s.c && typeof s.c.candidate === 'string' && /\.local\s/i.test(s.c.candidate)){
          const l = direct.get(from); if (!l || !l.pc) return;
          if (l.remote) await l.pc.addIceCandidate(s.c).catch(() => {}); else l.cands.push(s.c);
        }
      } catch (e) { dropLink(from, true); }
    }

    /* ── the Sydney relay ── */
    if (fast && Relay.usable) rch = Relay.join('realtime:mp-' + name, v => deliver(v), ok => { relayOk = ok; if (!gone) writeMe().catch(() => {}); });

    await myRef.onDisconnect().remove();
    await writeMe();
    peersRef.on('value', onPeers);
    evQuery.on('child_added', onEv);
    const beat = setInterval(() => { if (gone) return; writeMe().catch(() => {}); build(); }, BEAT);
    return {
      id: me, name,
      now: () => Date.now() + offset,
      /* You get your own straight away. Then: straight to whoever is linked, the relay for the rest when they all have
         it, otherwise Firebase for everyone (never both: a Firebase entry carries no id to tell a repeat by) */
      emit: async (topic, data) => {
        if (gone) return;
        const d = JSON.stringify(data), id = me + '.' + (++seq).toString(36), v = { topic, d, peer: me, id };
        deliver(v);
        const others = peers.filter(p => !p.isMe);
        if (fast && others.length){
          const linked = others.filter(p => { const l = direct.get(p.id); return l && l.open && l.dc && l.dc.readyState === 'open'; });
          const rest = others.filter(p => !linked.includes(p));
          const relayAll = rest.length && rch && rch.ready() && rest.every(p => p._v >= 2 && p._relay);
          /* the relay first: if it can't take it, nothing has gone anywhere yet and Firebase carries it to everyone */
          if (!rest.length || (relayAll && rch.send(v))){
            const s = JSON.stringify(v);
            for (const p of linked){ try { direct.get(p.id).dc.send(s); } catch (e) {} }
            return;
          }
        }
        await fbWrite(topic, d);
      },
      on: (topic, fn) => { (topicFns[topic] = topicFns[topic] || []).push(fn); return () => { topicFns[topic] = (topicFns[topic] || []).filter(f => f !== fn); }; },
      presence: async patch => { Object.assign(mine, patch); if (!gone) await writeMe(); },
      peers: () => peers.map(q => ({ id: q.id, isMe: q.isMe, presence: q.presence })),
      onPeers: fn => { peerFns.push(fn); if (peers.length) setTimeout(() => fn(peers.map(q => ({ id: q.id, isMe: q.isMe, presence: q.presence }))), 0); return () => { const i = peerFns.indexOf(fn); if (i >= 0) peerFns.splice(i, 1); }; },
      /* which way messages to each player go now (for testing and the curious): direct, relay or firebase */
      paths: () => peers.filter(p => !p.isMe).map(p => { const l = direct.get(p.id);
        return { id: p.id, via: l && l.open ? 'direct' : rch && rch.ready() && p._relay ? 'relay' : 'firebase' }; }),
      leave: async () => {
        if (gone) return; gone = true; clearInterval(beat);
        peersRef.off('value', onPeers); evQuery.off('child_added', onEv);
        for (const id of [...direct.keys()]) dropLink(id, false);
        if (rch) rch.leave();
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
