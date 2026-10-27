/* ══════════════════════════════════════════════════════════════════════════
   Mahjong: not a game you play here, the score sheet for our real games.
   Everyone starts on MJ_START; each game recorded adds to or takes from people,
   and the sheet is shared by everyone (api/gamestate.js, mode=mahjong).
   mahjong.html mounts the sheet; home.html uses leaders() for its tile.
   Wrapped so it can load next to a page's own $ / esc.
   ══════════════════════════════════════════════════════════════════════════ */
window.Mahjong = (() => {
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MJ_START = 4096;
const MJ_COLORS = ['#0A84FF','#FF375F','#30C05A','#FF9F0A','#AF52DE','#32ADE6','#FFB800','#8E8E93','#AC8E68','#5E5CE6'];
const mjFetch = () => TT.api('/api/gamestate', { params:{ mode:'mahjong' } });
const mjSend = body => TT.api('/api/gamestate', { method:'PUT', body:Object.assign({ mode:'mahjong' }, body) });
/* players with their points now, most to least */
function mjStandings(state){
  const pts = {}; (state.players || []).forEach(p => pts[p.id] = MJ_START);
  (state.rounds || []).forEach(r => { for (const id in r.d) if (id in pts) pts[id] += r.d[id]; });
  return (state.players || []).map(p => ({ id:p.id, name:p.name, pts:pts[p.id] })).sort((a, b) => b.pts - a.pts);
}

/* who is on top and bottom, for the home tile: { who, val, low } or null with
   no players. Everyone on the same score (as before the first game) gets one
   line; a shared top or bottom names everyone on it. */
function mjLeaders(state){
  const s = mjStandings(state); if (!s.length) return null;
  const hi = s[0].pts, lo = s[s.length-1].pts, fmt = v => v.toLocaleString();
  if (hi === lo) return { who: s.length > 1 ? 'Everyone tied' : s[0].name, val:fmt(hi) };
  const at = v => { const n = s.filter(p => p.pts === v).map(p => p.name);
    return { who: n.length === 1 ? n[0] : n.length === 2 ? n.join(' & ') + ' tied' : n.length + ' tied', val:fmt(v) }; };
  return Object.assign(at(hi), { low:at(lo) });
}

/* the score sheet itself, into host (mahjong.html) */
function mount(host){
  host.innerHTML = '<div class="row"><div><h2>Mahjong</h2><p class="how">Everyone starts on ' + MJ_START.toLocaleString() +
    '. After each game, add points to whoever won and take them from whoever paid.</p></div><span class="score" id="sc"></span></div>' +
    '<div id="mj"><p class="how">Loading…</p></div>';
  const box = $('mj');
  if (!TT.myEmail()){ box.innerHTML = '<p class="how">Sign in on the timetable to see the scores.</p>'; return; }
  let state = null, busy = false;
  const color = id => MJ_COLORS[(id - 1) % MJ_COLORS.length];
  const fmt = v => v.toLocaleString();
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));

  /* every player's points after each game, for the graph: [game][player] */
  function series(){
    const cur = {}; state.players.forEach(p => cur[p.id] = MJ_START);
    const out = [Object.assign({}, cur)];
    state.rounds.forEach(r => { for (const id in r.d) if (id in cur) cur[id] += r.d[id]; out.push(Object.assign({}, cur)); });
    return out;
  }
  function graph(){
    const pts = series(), n = pts.length - 1;
    if (!n) return '<p class="how">The graph starts after the first game.</p>';
    const W = 640, H = 220, L = 52, R = 10, T = 10, B = 22;
    const all = pts.flatMap(o => Object.values(o));
    let lo = Math.min(...all), hi = Math.max(...all); if (lo === hi){ lo -= 100; hi += 100; }
    const x = i => L + (W - L - R) * i / n, y = v => T + (H - T - B) * (hi - v) / (hi - lo);
    const ticks = [hi, (hi + lo) / 2, lo].map(v => Math.round(v));
    return '<svg class="mjgraph" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Points after each game">' +
      ticks.map(v => '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="mjgrid"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v)+'</text>').join('') +
      (lo < MJ_START && hi > MJ_START ? '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(MJ_START)+'" y2="'+y(MJ_START)+'" class="mjstart"/>' : '') +
      '<text x="'+L+'" y="'+(H-6)+'">Start</text><text x="'+(W-R)+'" y="'+(H-6)+'" text-anchor="end">Game '+n+'</text>' +
      state.players.map(p => '<polyline fill="none" stroke="'+color(p.id)+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' +
        pts.map((o, i) => x(i).toFixed(1)+','+y(o[p.id]).toFixed(1)).join(' ')+'"><title>'+esc(p.name)+'</title></polyline>').join('') +
      '</svg><div class="mjkey">' + state.players.map(p => '<span><i style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</span>').join('') + '</div>';
  }
  function paint(err){
    const st = mjStandings(state), last = state.rounds[state.rounds.length - 1];
    $('sc').textContent = state.rounds.length + ' game' + (state.rounds.length === 1 ? '' : 's');
    box.innerHTML =
      (err ? '<p class="how mjerr">' + esc(err) + '</p>' : '') +
      '<h3 class="mjh">Standings</h3>' +
      (st.length ? '<div class="tlbrow tlbhd"><span class="rk">#</span><span class="nm">Player</span><span class="tm">Last game</span><span class="tm">Points</span></div>' +
        st.map((p, i) => { const d = last && last.d[p.id];
          return '<div class="tlbrow"><span class="rk">'+(i+1)+'</span><span class="nm"><i class="mjdot" style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</span>' +
            '<span class="tm '+(d > 0 ? 'mjup' : d < 0 ? 'mjdown' : '')+'">'+(d ? signed(d) : '')+'</span><span class="tm"><b>'+fmt(p.pts)+'</b></span></div>'; }).join('')
        : '<p class="how">No players yet. Add everyone at the table.</p>') +
      '<div class="fcrow mjadd"><input id="mjname" placeholder="New player’s name…" maxlength="30" autocomplete="off">' +
        '<button class="btn" id="mjaddp" type="button">Add player</button></div>' +
      (st.length > 1 ?
        '<h3 class="mjh">Record a game</h3><p class="how">Points won (+) or lost (−) this game. Leave anyone who didn’t change blank.</p>' +
        '<div class="mjround">' + state.players.map(p =>
          '<label><span><i class="mjdot" style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</span>' +
          '<input type="number" step="1" data-id="'+p.id+'" placeholder="0"></label>').join('') + '</div>' +
        '<div class="fcrow"><span class="how mjsum" id="mjsum"></span>' +
          '<button class="btn primary" id="mjsave" type="button">Save game</button>' +
          (state.rounds.length ? '<button class="btn" id="mjundo" type="button">Undo last game</button>' : '') + '</div>' +
        '<h3 class="mjh">Points over time</h3>' + graph() +
        (state.rounds.length ? '<h3 class="mjh">History</h3><div class="mjhist">' + state.rounds.map((r, i) => ({ r, i })).reverse().map(({ r, i }) =>
          '<div class="tlbrow"><span class="rk">'+(i+1)+'</span><span class="nm">' +
          Object.keys(r.d).sort((a, b) => r.d[b] - r.d[a]).map(id => { const p = state.players.find(q => q.id === +id);
            return p ? '<span class="'+(r.d[id] > 0 ? 'mjup' : 'mjdown')+'">'+esc(p.name)+' '+signed(r.d[id])+'</span>' : ''; }).join(' · ') +
          '</span><span class="tm">'+new Date(r.t).toLocaleDateString([], { day:'numeric', month:'short' })+'</span></div>').join('') + '</div>' : '')
        : '');
    const addP = () => { const v = $('mjname').value.trim(); if (v) act({ action:'player', name:v }); };
    $('mjaddp').onclick = addP;
    $('mjname').onkeydown = e => { if (e.key === 'Enter') addP(); };
    const inputs = [...box.querySelectorAll('.mjround input')];
    const sum = () => { const t = inputs.reduce((a, i) => a + (Math.round(+i.value) || 0), 0);
      $('mjsum').textContent = t ? 'Adds up to ' + signed(t) + ' (usually 0)' : ''; };
    inputs.forEach(i => i.oninput = sum);
    if ($('mjsave')) $('mjsave').onclick = () => { const d = {}; inputs.forEach(i => { const v = Math.round(+i.value); if (v) d[i.dataset.id] = v; });
      if (Object.keys(d).length) act({ action:'round', d }); };
    if ($('mjundo')) $('mjundo').onclick = () => { if (confirm('Undo the last game?')) act({ action:'undo' }); };
  }
  async function act(body){
    if (busy) return; busy = true;
    try { state = (await mjSend(body)).state; paint(); }
    catch (e){ paint(e.message); }
    busy = false;
  }
  mjFetch().then(d => { state = d.state; paint(); }, e => { box.innerHTML = '<p class="how">Could not load: ' + esc(e.message) + '</p>'; });
}

return { mount, leaders: async () => mjLeaders((await mjFetch()).state) };
})();
