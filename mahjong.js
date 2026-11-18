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
const MJ_START = 4096, MJ_RECENT = 5;
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
  const at = v => ({ who: mjNames(s.filter(p => p.pts === v)), val:fmt(v) });
  return Object.assign(at(hi), { low:at(lo) });
}
const mjNames = l => l.length === 1 ? l[0].name : l.length === 2 ? l[0].name + ' & ' + l[1].name + ' tied' : l.length + ' tied';

/* the score sheet itself, into host (mahjong.html) */
function mount(host){
  host.innerHTML = '<div class="row"><div><h2>Mahjong</h2><p class="how">Everyone starts on ' + MJ_START.toLocaleString() +
    '. After each game, add points to whoever won and take them from whoever paid.</p></div><span class="score" id="sc"></span></div>' +
    '<div id="mj">' + (window.TT && TT.loader ? TT.loader('Loading the scores…') : '<p class="how">Loading…</p>') + '</div>';
  const box = $('mj');
  if (!TT.myEmail()){ box.innerHTML = '<p class="how">Sign in on the timetable to see the scores.</p>'; return; }
  let state = null, busy = false;
  const color = id => MJ_COLORS[(id - 1) % MJ_COLORS.length];
  const fmt = v => v.toLocaleString();
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
  /* Studio draws the sheet as the beta (/beta/) does: standings as bars on the left, the
     awards and graph on the right; the graph's hover replaces the History list */
  const studio = () => ['studio','canvas'].includes(document.documentElement.getAttribute('data-skin'));
  /* the beta's scale: spread out around the middle, so a pack of close scores doesn't merge into one line */
  function spread(now){
    const v = [...now].sort((a, b) => a - b), gaps = v.slice(1).map((x, i) => x - v[i]).sort((a, b) => a - b);
    const mid = v[v.length >> 1], size = Math.max(8, gaps[gaps.length >> 1] || 0);
    return x => Math.asinh((x - mid) / size);
  }

  /* every player's points after each game, for the graph: [game][player] */
  function series(){
    const cur = {}; state.players.forEach(p => cur[p.id] = MJ_START);
    const out = [Object.assign({}, cur)];
    state.rounds.forEach(r => { for (const id in r.d) if (id in cur) cur[id] += r.d[id]; out.push(Object.assign({}, cur)); });
    return out;
  }
  /* ── the graph: scroll or pinch to zoom in on some games, drag to move along,
     double-click (or Show all) to see everything again. The points scale fits
     whatever games are in view. view is { a, b } in games, or null for all. */
  let view = null, tipAt = null;
  let GW = 640, GH = 240; const GL = 52, GR = 12, GT = 10, GB = 24;   /* drawn at the page's own size, so the text stays small */
  function graph(){
    if (!state.rounds.length) return '<h3 class="mjh">Points over time</h3><p class="how">The graph starts after the first game.</p>';
    return '<div class="mjghead"><h3 class="mjh">Points over time</h3><div class="mjgtools"><button class="btn" id="mjgin" type="button" title="Zoom in" aria-label="Zoom in">+</button>' +
      '<button class="btn" id="mjgout" type="button" title="Zoom out" aria-label="Zoom out">−</button>' +
      '<button class="btn" id="mjgall" type="button" hidden>Show all</button></div></div>' +
      '<div class="mjgwrap"><svg class="mjgraph" id="mjg" viewBox="0 0 '+GW+' '+GH+'" role="img" tabindex="0" aria-label="Points after each game. Scroll or pinch to zoom, drag to move."></svg>' +
      '<div class="mjgtip" id="mjgtip" hidden></div></div>' +
      '<div class="mjkey">' + state.players.map(p => '<span><i style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</span>').join('') + '</div>';
  }
  /* a round step near raw: 1, 2, 5, 10, 20, 50… */
  const niceStep = raw => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  function drawGraph(){
    const svg = $('mjg'); if (!svg) return;
    const cw = Math.round(svg.clientWidth || 640); GW = Math.max(280, cw); GH = studio() ? Math.max(300, Math.round(svg.clientHeight || 420)) : cw < 560 ? 230 : 260;
    svg.setAttribute('viewBox', '0 0 ' + GW + ' ' + GH);
    const pts = series(), n = pts.length - 1;
    const a = view ? view.a : 0, b = view ? view.b : n;
    const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(n, Math.ceil(b));
    const vis = []; for (let i = i0; i <= i1; i++) state.players.forEach(p => vis.push(pts[i][p.id]));
    const at = studio() ? spread(state.players.map(p => pts[n][p.id])) : v => v;
    let lo = Math.min(...vis.map(at)), hi = Math.max(...vis.map(at)); if (lo === hi){ lo -= studio() ? 1 : 100; hi += studio() ? 1 : 100; }
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const x = i => GL + (GW - GL - GR) * (i - a) / (b - a), y = v => GT + (GH - GT - GB) * (hi - at(v)) / (hi - lo);
    let yt = [];
    if (studio()){      /* labels at the start ± powers of 2, nearest first, wherever there's room */
      for (const v of [MJ_START, ...[...Array(14).keys()].slice(1).flatMap(k => [MJ_START + 2 ** k, MJ_START - 2 ** k])])
        if (at(v) >= lo && at(v) <= hi && yt.every(u => Math.abs(y(u) - y(v)) >= 22)) yt.push(v);
    } else { const ys = niceStep((hi - lo) / 5); for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) yt.push(v); }
    const xs = Math.max(1, niceStep((b - a) / 6)), xt = []; for (let i = Math.ceil(a / xs) * xs; i <= b + 1e-9; i += xs) xt.push(Math.round(i));
    const from = Math.max(0, i0 - 1), to = Math.min(n, i1 + 1), dots = b - a <= 24;
    let s = '<defs><clipPath id="mjgclip"><rect x="'+GL+'" y="0" width="'+(GW - GL - GR)+'" height="'+(GH - GB + 4)+'"/></clipPath></defs>' +
      yt.map(v => '<line x1="'+GL+'" x2="'+(GW-GR)+'" y1="'+y(v).toFixed(1)+'" y2="'+y(v).toFixed(1)+'" class="mjgrid"/><text x="'+(GL-6)+'" y="'+(y(v)+4).toFixed(1)+'" text-anchor="end">'+fmt(v)+'</text>').join('') +
      (at(MJ_START) > lo && at(MJ_START) < hi ? '<line x1="'+GL+'" x2="'+(GW-GR)+'" y1="'+y(MJ_START).toFixed(1)+'" y2="'+y(MJ_START).toFixed(1)+'" class="mjstart"/>' : '') +
      xt.map((i, k) => '<text x="'+x(i).toFixed(1)+'" y="'+(GH-6)+'" text-anchor="'+(x(i) < GL + 20 ? 'start' : x(i) > GW - GR - 20 ? 'end' : 'middle')+'">'+
        (i === 0 ? 'Start' : (k === 0 || xt[0] === 0 && k === 1 ? 'Game ' : '') + i)+'</text>').join('') +
      '<g clip-path="url(#mjgclip)">' +
      (tipAt != null ? '<line class="mjghov" x1="'+x(tipAt).toFixed(1)+'" x2="'+x(tipAt).toFixed(1)+'" y1="'+GT+'" y2="'+(GH-GB)+'"/>' : '') +
      state.players.map(p => { const c = color(p.id), seg = [];
        for (let i = from; i <= to; i++) seg.push(x(i).toFixed(1)+','+y(pts[i][p.id]).toFixed(1));
        let g = '<polyline fill="none" stroke="'+c+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+seg.join(' ')+'"/>';
        if (dots) for (let i = i0; i <= i1; i++) g += '<circle class="mjgpt" cx="'+x(i).toFixed(1)+'" cy="'+y(pts[i][p.id]).toFixed(1)+'" r="3.5" fill="'+c+'"/>';
        return g; }).join('') + '</g>';
    svg.innerHTML = s;
    const all = $('mjgall'); if (all) all.hidden = !view;
    const tip = $('mjgtip');
    if (tip){ if (tipAt == null || tipAt < a || tipAt > b) tip.hidden = true;
      else if (studio()) { tip.innerHTML = gameTip(tipAt, pts); tip.hidden = false;
        const fx = x(tipAt) / GW; tip.style.left = (fx * 100) + '%'; tip.classList.toggle('mjgtipl', fx > 0.55); }
      else { const prev = pts[Math.max(0, tipAt - 1)];
        tip.innerHTML = '<b>'+(tipAt ? 'After game ' + tipAt : 'Start')+'</b>' + state.players.slice().sort((p, q) => pts[tipAt][q.id] - pts[tipAt][p.id]).map(p => {
          const v = pts[tipAt][p.id], d = tipAt ? v - prev[p.id] : 0;
          return '<span><i class="mjdot" style="background:'+color(p.id)+'"></i>'+esc(p.name)+' <em>'+fmt(v)+'</em>'+(d ? ' <small class="'+(d > 0 ? 'mjup' : 'mjdown')+'">'+signed(d)+'</small>' : '')+'</span>'; }).join('');
        tip.hidden = false;
        const fx = x(tipAt) / GW; tip.style.left = (fx * 100) + '%'; tip.classList.toggle('mjgtipl', fx > 0.55); } }
  }
  /* Studio's hover: everything the History list said about a game, and what it did to the table */
  function gameTip(g, pts){
    if (!g) return '<b>Start</b><span class="mjtn">Everyone on ' + fmt(MJ_START) + '</span>';
    const r = state.rounds[g - 1], prev = pts[g - 1], now = pts[g];
    const place = (o, id) => 1 + state.players.filter(q => o[q.id] > o[id]).length;
    const when = r.t ? new Date(r.t).toLocaleDateString([], { weekday:'short', day:'numeric', month:'short' }) : '';
    const rows = Object.keys(r.d).filter(id => state.players.some(q => q.id === +id)).sort((p, q) => r.d[q] - r.d[p]).map(id => {
      const p = state.players.find(q => q.id === +id), v = r.d[id], a = place(prev, +id), b = place(now, +id);
      return '<span class="mjtr"><i class="mjdot" style="background:'+color(+id)+'"></i><span class="mjtnm">'+esc(p.name)+'</span>' +
        '<em class="'+(v > 0 ? 'mjup' : 'mjdown')+'">'+signed(v)+'</em><span class="mjttot">'+fmt(now[id])+'</span>' +
        '<small>'+(a === b ? '#' + b : '#' + a + ' → #' + b)+'</small></span>'; }).join('');
    const top = state.players.slice().sort((p, q) => now[q.id] - now[p.id])[0];
    return '<b>Game ' + g + (when ? ' <small>' + esc(when) + '</small>' : '') + '</b>' + rows +
      (top ? '<span class="mjtn">Leading: ' + esc(top.name) + ', ' + fmt(now[top.id]) + '</span>' : '');
  }
  function wireGraph(){
    const svg = $('mjg'); if (!svg) return;
    const n = () => state.rounds.length, minSpan = () => Math.min(n(), 2);
    let raf = 0; const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawGraph(); }); };
    const span = () => view ? view.b - view.a : n();
    const sx = cx => { const r = svg.getBoundingClientRect(); return (cx - r.left) * GW / r.width; };
    const gameAt = cx => { const a = view ? view.a : 0; return a + (sx(cx) - GL) / (GW - GL - GR) * span(); };
    const setView = (a, w) => { const N = n(); w = Math.max(minSpan(), Math.min(N, w));
      if (w >= N - 1e-6){ view = null; return; }
      a = Math.max(0, Math.min(N - w, a)); view = { a, b: a + w }; };
    const zoomAt = (g, f) => { const a = view ? view.a : 0, w = span(), nw = w * f; setView(g - (g - a) * nw / w, nw); redraw(); };
    const panBy = dg => { if (!view) return; setView(view.a + dg, span()); redraw(); };
    svg.addEventListener('wheel', e => {
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1, dy = e.deltaY * k, dx = e.deltaX * k;
      if (Math.abs(dx) > Math.abs(dy)){ if (!view) return; e.preventDefault(); panBy(dx / (GW - GL - GR) * span()); return; }
      if (dy > 0 && !view) return;                       // nothing more to zoom out: let the page scroll
      e.preventDefault(); zoomAt(Math.max(0, Math.min(n(), gameAt(e.clientX))), Math.exp(dy * 0.0015));
    }, { passive: false });
    /* drag to move; two fingers pinch to zoom; a tap or hover shows that game's points */
    const ptr = new Map(); let pinch = null, moved = 0;
    const showTip = cx => { const a = view ? view.a : 0, b = view ? view.b : n();
      const g = Math.round(gameAt(cx)); tipAt = Math.max(Math.ceil(a - 1e-9), Math.min(Math.floor(b + 1e-9), g)); redraw(); };
    svg.addEventListener('pointerdown', e => { if (e.button) return; try { svg.setPointerCapture(e.pointerId); } catch (_){} ptr.set(e.pointerId, e.clientX); moved = 0;
      if (ptr.size === 2){ const [p, q] = [...ptr.values()]; pinch = { d: Math.abs(p - q) || 1, w: span(), g: gameAt((p + q) / 2) }; } });
    svg.addEventListener('pointermove', e => {
      if (!ptr.has(e.pointerId)){ if (e.pointerType === 'mouse') showTip(e.clientX); return; }
      const last = ptr.get(e.pointerId); ptr.set(e.pointerId, e.clientX);
      if (ptr.size >= 2 && pinch){ const [p, q] = [...ptr.values()], d = Math.abs(p - q) || 1, w = pinch.w * pinch.d / d;
        const frac = (sx((p + q) / 2) - GL) / (GW - GL - GR); setView(pinch.g - frac * w, w); moved = 99; redraw(); return; }
      const dpx = e.clientX - last; moved += Math.abs(dpx);
      if (moved > 4 && view){ tipAt = null; panBy(-(sx(e.clientX) - sx(last)) / (GW - GL - GR) * span()); }
    });
    const up = e => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null;
      if (e.type === 'pointerup' && moved <= 4 && e.pointerType !== 'mouse') showTip(e.clientX); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptr.size){ tipAt = null; redraw(); } });
    svg.addEventListener('dblclick', () => { view = null; redraw(); });
    svg.addEventListener('keydown', e => { const w = span(), a = view ? view.a : 0, mid = a + w / 2;
      if (e.key === '+' || e.key === '=') zoomAt(mid, 1 / 1.5); else if (e.key === '-') zoomAt(mid, 1.5);
      else if (e.key === 'ArrowLeft') panBy(-w / 5); else if (e.key === 'ArrowRight') panBy(w / 5);
      else if (e.key === '0' || e.key === 'Escape'){ view = null; redraw(); } else return;
      e.preventDefault(); });
    const mid = () => (view ? view.a : 0) + span() / 2;
    $('mjgin').onclick = () => zoomAt(mid(), 1 / 1.5);
    $('mjgout').onclick = () => zoomAt(mid(), 1.5);
    $('mjgall').onclick = () => { view = null; redraw(); };
    if (view && view.b > n()) setView(view.a, span());
    if (window.ResizeObserver){ let lw = 0, lh = 0; new ResizeObserver(() => { const w = svg.clientWidth, h = svg.clientHeight; if (w && (w !== lw || h !== lh)){ lw = w; lh = h; redraw(); } }).observe(svg); }
    drawGraph();
  }

  /* ── the score calculator: who won, off whom, how many faan → everyone's points,
     using the Hong Kong tables from the Mahjong game. It only fills in "Record a
     game"; nothing is saved until Save game. The table and payment choices are
     kept on this device. */
  const HALF_SPICY = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384];
  const FULL_SPICY = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
  const FAAN = [
    ['Hand', [['ch', 'Common Hand', 1], ['tr', 'All in Triplets', 3], ['sp', 'Seven Pairs', 4], ['mx', 'Mixed One Suit', 3], ['os', 'All One Suit', 7],
      ['mo', 'Mixed Orphans', 1], ['ci', 'Concealed Hand', 1]]],
    ['Honours', [['dp', 'Dragon pung (each)', 1, 3], ['sw', 'Seat wind pung', 1], ['pw', 'Prevailing wind pung', 1],
      ['sd', 'Small Dragons (plus the pungs)', 3], ['gd', 'Great Dragons (plus the pungs)', 5], ['sn', 'Small Winds', 6]]],
    ['Flowers', [['nf', 'No flowers', 1], ['of', 'Own flower', 1], ['ou', 'Own season', 1], ['af', 'All four flowers', 2], ['as', 'All four seasons', 2]]],
    ['The win', [['rk', 'Robbing the kong', 1], ['lc', 'Last catch', 1], ['wk', 'Win by kong', 1], ['dk', 'Win by double kong', 8]]],
    ['Limit hands', [['to', 'Thirteen Orphans', 13, 0, 1], ['gw', 'Great Winds', 13, 0, 1], ['ak', 'All Kongs', 13, 0, 1], ['hv', 'Heavenly / Earthly Hand', 13, 0, 1],
      ['ah', 'All Honours', 10, 0, 1], ['or', 'Orphans', 10, 0, 1], ['st', 'Self Triplets', 10, 0, 1], ['ng', 'Nine Gates', 10, 0, 1]]]
  ];
  const calc = { w: null, from: 'self', faan: '3', table: null, ticks: {}, open: false, count: false };
  try { Object.assign(calc, { scale: 'half', pay: 'all', unit: '1' }, JSON.parse(localStorage.getItem('mj.calc') || '{}')); }
  catch (e){ Object.assign(calc, { scale: 'half', pay: 'all', unit: '1' }); }
  const keepCalc = () => { try { localStorage.setItem('mj.calc', JSON.stringify({ scale: calc.scale, pay: calc.pay, unit: calc.unit })); } catch (e){} };
  /* the faan the checklist adds up to (limit hands count alone), or null with nothing ticked */
  function countFaan(){
    let sum = 0, lim = 0, any = false;
    FAAN.forEach(([, items]) => items.forEach(([k, , v, many, isLim]) => { const t = +calc.ticks[k] || 0; if (!t) return; any = true;
      if (isLim) lim = Math.max(lim, v); else sum += v * (many ? Math.min(t, many) : 1); }));
    if (!any) return null;
    return lim || sum + (calc.from === 'self' ? 1 : 0);
  }
  /* each player's change: { id: points } (or a reason it can't be worked out) */
  function calcPay(){
    const ids = state.players.map(p => p.id), w = +calc.w, from = calc.from === 'self' ? 'self' : +calc.from;
    if (!ids.includes(w)) return { err: 'Pick who won.' };
    if (from !== 'self' && (!ids.includes(from) || from === w)) return { err: 'Pick who paid.' };
    const counted = countFaan(), faan = Math.round(counted != null ? counted : +calc.faan);
    if (!isFinite(faan) || counted == null && calc.faan === '') return { err: 'Enter the faan.' };
    const unit = +calc.unit; if (!isFinite(unit) || !unit) return { err: 'Enter how many points one unit is.' };
    const base = (calc.scale === 'full' ? FULL_SPICY : HALF_SPICY)[Math.max(0, Math.min(13, faan))] * unit;
    const table = new Set((calc.table || []).filter(id => ids.includes(id))); table.add(w); if (from !== 'self') table.add(from);
    const others = [...table].filter(id => id !== w), d = {};
    if (from === 'self'){ if (!others.length) return { err: 'Tap who else was at the table.' }; others.forEach(id => d[id] = -base / 2); }
    else if (calc.pay === 'all') d[from] = -base;
    else others.forEach(id => d[id] = id === from ? -base / 2 : -base / 4);
    for (const id in d) d[id] = Math.round(d[id]);
    d[w] = -Object.values(d).reduce((s, v) => s + v, 0);
    return { d, base, faan };
  }
  function calcHTML(){
    const ps = state.players, opt = (v, label, on) => '<option value="'+v+'"'+(on ? ' selected' : '')+'>'+esc(label)+'</option>';
    if (calc.table == null) calc.table = ps.length <= 4 ? ps.map(p => p.id) : [];
    const counted = countFaan();
    return '<details class="mjcalc" id="mjcalc"'+(calc.open ? ' open' : '')+'><summary>Score calculator</summary><div class="mjcbody">' +
      '<div class="mjcgrid">' +
        '<label>Winner<select id="mjcw">'+opt('', 'Who won?', calc.w == null)+ps.map(p => opt(p.id, p.name, +calc.w === p.id)).join('')+'</select></label>' +
        '<label>Won by<select id="mjcfrom">'+opt('self', 'Self-drawn', calc.from === 'self')+ps.filter(p => p.id !== +calc.w).map(p => opt(p.id, p.name + '’s discard', +calc.from === p.id)).join('')+'</select></label>' +
        '<label>Faan<input id="mjcf" type="number" step="1" list="mjcfl" value="'+esc(counted != null ? counted : calc.faan)+'"'+(counted != null ? ' readonly' : '')+'>' +
          '<datalist id="mjcfl">'+[3,4,5,6,7,8,9,10,13].map(v => '<option value="'+v+'">').join('')+'</datalist></label>' +
        '<label>Table<select id="mjcscale">'+opt('half', 'Half spicy', calc.scale === 'half')+opt('full', 'Full spicy (doubles)', calc.scale === 'full')+'</select></label>' +
        '<label>Discards<select id="mjcpay">'+opt('all', 'Discarder pays all', calc.pay === 'all')+opt('share', 'Everyone pays a share', calc.pay === 'share')+'</select></label>' +
        '<label>Unit<input id="mjcu" type="number" step="any" list="mjcul" value="'+esc(calc.unit)+'"><datalist id="mjcul"><option value="1"><option value="2"><option value="4"><option value="8"><option value="16"></datalist></label>' +
      '</div>' +
      '<div class="mjctable"><span class="how">At the table</span>' + ps.map(p => '<button type="button" class="mjcp" data-id="'+p.id+'" aria-pressed="'+(calc.table.includes(p.id) || p.id === +calc.w || p.id === +calc.from)+'">' +
        '<i class="mjdot" style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</button>').join('') + '</div>' +
      '<details class="mjcfaan"'+(calc.count ? ' open' : '')+'><summary>Count the faan</summary>' +
        FAAN.map(([head, items]) => '<div class="mjcgrp"><small>'+head+'</small>' + items.map(([k, name, v, many, isLim]) => many
          ? '<label class="mjcit"><input type="number" min="0" max="'+many+'" step="1" data-k="'+k+'" value="'+(+calc.ticks[k] || 0)+'"><span>'+name+'</span><em>'+v+'</em></label>'
          : '<label class="mjcit"><input type="checkbox" data-k="'+k+'"'+(calc.ticks[k] ? ' checked' : '')+'><span>'+name+'</span><em>'+(isLim ? 'limit ' : '')+v+'</em></label>').join('') + '</div>').join('') +
        '<div class="fcrow mjcfoot"><span class="how" id="mjccount">'+(counted == null ? 'Tick what the hand has.' : 'Adds up to '+counted+' faan'+(calc.from === 'self' && !FAAN[4][1].some(([k]) => calc.ticks[k]) ? ', with 1 for self-drawn' : '')+(counted > 13 ? ' (13 is the most that counts)' : '')+'.')+'</span>' +
        '<button class="btn" id="mjcclear" type="button">Clear</button></div></details>' +
      '<div class="mjcout" id="mjcout"></div>' +
      '<div class="fcrow"><button class="btn" id="mjcfill" type="button">Fill in the game below</button></div></div></details>';
  }
  function showCalc(){
    const out = $('mjcout'); if (!out) return;
    const r = calcPay(), btn = $('mjcfill');
    if (r.err){ out.innerHTML = '<p class="how">'+r.err+'</p>'; btn.disabled = true; return; }
    btn.disabled = false;
    out.innerHTML = '<p class="how">'+r.faan+' faan'+(r.faan > 13 ? ' (counts as 13)' : '')+' is '+fmt(r.base)+(+calc.unit === 1 ? '' : ' points')+(calc.from === 'self' ? ', each player paying half.' : calc.pay === 'all' ? ', all paid by the discarder.' : ', half from the discarder and a quarter from each other player.')+'</p>' +
      '<div class="mjcres">' + Object.keys(r.d).sort((a, b) => r.d[b] - r.d[a]).map(id => { const p = state.players.find(q => q.id === +id), v = r.d[id];
        return '<span class="'+(v > 0 ? 'mjup' : v < 0 ? 'mjdown' : '')+'"><i class="mjdot" style="background:'+color(+id)+'"></i>'+esc(p.name)+' <b>'+signed(v)+'</b></span>'; }).join('') + '</div>';
  }
  function wireCalc(){
    const box2 = $('mjcalc'); if (!box2) return;
    const re = () => { const open = box2.open; box2.outerHTML = calcHTML(); wireCalc(); if (open) $('mjcalc').open = true; };
    box2.ontoggle = () => { calc.open = box2.open; };
    box2.querySelector('.mjcfaan').ontoggle = e => { calc.count = e.target.open; };
    $('mjcw').onchange = e => { calc.w = e.target.value || null; if (+calc.from === +calc.w) calc.from = 'self'; re(); };
    $('mjcfrom').onchange = e => { calc.from = e.target.value; re(); };
    $('mjcf').oninput = e => { if (countFaan() == null){ calc.faan = e.target.value; showCalc(); } };
    $('mjcscale').onchange = e => { calc.scale = e.target.value; keepCalc(); showCalc(); };
    $('mjcpay').onchange = e => { calc.pay = e.target.value; keepCalc(); showCalc(); };
    $('mjcu').oninput = e => { calc.unit = e.target.value; keepCalc(); showCalc(); };
    box2.querySelectorAll('.mjcp').forEach(b => b.onclick = () => { const id = +b.dataset.id, t = calc.table, i = t.indexOf(id);
      if (i >= 0) t.splice(i, 1); else t.push(id); re(); });
    box2.querySelectorAll('.mjcit input').forEach(i => i.onchange = () => { const k = i.dataset.k;
      calc.ticks[k] = i.type === 'checkbox' ? (i.checked ? 1 : 0) : Math.max(0, Math.round(+i.value) || 0); re(); });
    $('mjcclear').onclick = () => { calc.ticks = {}; re(); };
    $('mjcfill').onclick = () => { const r = calcPay(); if (r.err) return;
      box.querySelectorAll('.mjround input').forEach(i => { const v = r.d[i.dataset.id]; i.value = v ? v : ''; i.dispatchEvent(new Event('input')); });
      const save = $('mjsave'); if (save){ save.scrollIntoView({ block: 'center', behavior: 'smooth' }); save.focus({ preventScroll: true }); }
      $('mjsum').textContent = 'Filled in from the calculator. Check it, then Save game.'; };
    showCalc();
  }
  /* award cards, as Kahoot does between questions; an award nobody has earned is left
     out. Rates and places cover the last MJ_RECENT games, as all-time ones would only
     repeat the standings. A streak ignores games a player sat out. */
  function awards(){
    const { players, rounds } = state, n = Math.min(rounds.length, MJ_RECENT);
    if (!n) return '';
    const span = n === 1 ? 'last game' : 'last ' + n + ' games';
    const total = rs => { const t = {}; players.forEach(p => t[p.id] = MJ_START);
      rs.forEach(r => { for (const id in r.d) if (id in t) t[id] += r.d[id]; }); return t; };
    const before = total(rounds.slice(0, -n)), now = total(rounds);
    const rank = (t, p) => 1 + players.filter(q => t[q.id] > t[p.id]).length;
    const rate = p => Math.round((now[p.id] - before[p.id]) / n);
    const streak = (p, sign) => { let s = 0;
      for (let i = rounds.length - 1; i >= 0; i--){ const v = Math.sign(rounds[i].d[p.id] || 0);
        if (!v) continue; if (v !== sign) break; s++; }
      return s; };
    const cards = [
      ['🚀', 'Fastest climber', '#0A84FF', 1, p => rank(before, p) - rank(now, p), v => 'Up ' + v + (v === 1 ? ' place, ' : ' places, ') + span],
      ['🔥', 'On fire', '#FF9F0A', 2, p => streak(p, 1), v => v + ' wins in a row'],
      ['📈', 'Highest riser', '#30C05A', 1, rate, v => signed(v) + ' a game, ' + span],
      ['🥶', 'Ice cold', '#32ADE6', 2, p => streak(p, -1), v => v + ' losses in a row'],
      ['📉', 'Lowest rate of change', '#FF375F', 1, p => -rate(p), v => signed(-v) + ' a game, ' + span]
    ].map(([ico, title, c, min, score, say]) => { const v = players.map(score), best = Math.max(...v, 0);
      return best < min ? '' : '<div class="mjaward" style="--c:'+c+'"><i aria-hidden="true">'+ico+'</i><small>'+title+'</small><b>' +
        esc(mjNames(players.filter((p, i) => v[i] === best)))+'</b><small>'+say(best)+'</small></div>'; }).filter(Boolean);
    return '<div class="mjawards" style="--n:'+cards.length+';--r:'+Math.ceil(cards.length / 2)+'">' + cards.join('') + '</div>';
  }
  /* Studio's sheet: the beta's two columns */
  function studioHTML(err){
    const st = mjStandings(state), n = st.length;
    const at = spread(st.map(p => p.pts)), hi = n ? at(st[0].pts) : 0, lo = n ? at(st[n - 1].pts) : 0;
    const fill = v => hi === lo ? 100 : 12 + 88 * (at(v) - lo) / (hi - lo);       /* the lowest still shows some colour */
    const rows = st.map(p => { const rank = 1 + st.filter(q => q.pts > p.pts).length;
      return '<div class="mjsrow" data-id="'+p.id+'" style="--c:'+color(p.id)+'"><i class="mjfill" style="width:'+fill(p.pts).toFixed(1)+'%"></i>' +
        '<span class="mjrk">'+rank+'</span><span class="mjnm">'+esc(p.name)+'</span><b class="mjpts">'+fmt(p.pts)+'</b>' +
        '<span class="mjbox"><input type="number" step="1" data-id="'+p.id+'" placeholder="+ / −" aria-label="'+esc(p.name)+'’s points this game"></span></div>'; }).join('');
    return (err ? '<p class="how mjerr">' + esc(err) + '</p>' : '') + '<div class="mjs">' +
      '<section class="mjscol"><h3 class="mjsh">Standings</h3>' +
        (n ? '<div class="mjround mjslist">' + rows + '</div>' : '<p class="how">No players yet. Add everyone at the table.</p>') +
        (n > 1 ? '<div class="mjsblk mjssave"><span class="mjsum how" id="mjsum">+ for winners, − for whoever paid</span><div class="mjsbtns">' +
          (state.rounds.length ? '<button class="btn" id="mjundo" type="button">Undo</button>' : '') + '<button class="btn primary" id="mjsave" type="button">Save</button></div></div>' : '') +
        '<div class="mjsblk mjsadd"><input id="mjname" placeholder="'+(n ? 'Add a player' : 'Add everyone at the table')+'" maxlength="30" autocomplete="off"><button class="btn" id="mjaddp" type="button">Add</button></div>' +
      '</section>' +          /* (no score calculator in Studio, at the user's request) */
      '<section class="mjscol mjsgcol"><h3 class="mjsh">Over time</h3>' +
        '<div class="mjsblk mjschart">' + (state.rounds.length ? graph() : '<p class="how mjnone">Nothing here until the first game.</p>') + '</div>' +
      '</section>' +
      (state.rounds.length ? '<section class="mjscol mjsacol"><h3 class="mjsh">Awards</h3>' + awards() + '</section>' : '') + '</div>';
  }
  /* Studio: when the rankings change, each player's bar slides from its old place to its new one */
  function reorder(was){
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-motion') === 'reduced') return;
    box.querySelectorAll('.mjsrow').forEach(r => { const t = was[r.dataset.id]; if (t == null) return;
      const dy = t - r.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
      r.animate([{ transform:'translateY(' + dy + 'px)' }, { transform:'none' }], { duration:520, easing:'cubic-bezier(.25,.8,.3,1)' }); });
  }
  function paint(err){
    const st = mjStandings(state), last = state.rounds[state.rounds.length - 1];
    $('sc').textContent = state.rounds.length + ' game' + (state.rounds.length === 1 ? '' : 's');
    const was = {}; box.querySelectorAll('.mjsrow').forEach(r => was[r.dataset.id] = r.getBoundingClientRect().top);
    if (studio()){ box.innerHTML = studioHTML(err); reorder(was); } else box.innerHTML =
      (err ? '<p class="how mjerr">' + esc(err) + '</p>' : '') +
      '<h3 class="mjh">Standings</h3>' +
      (st.length ? '<div class="tlbrow tlbhd"><span class="rk">#</span><span class="nm">Player</span><span class="tm">Last game</span><span class="tm">Points</span></div>' +
        st.map((p, i) => { const d = last && last.d[p.id];
          return '<div class="tlbrow"><span class="rk">'+(i+1)+'</span><span class="nm"><i class="mjdot" style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</span>' +
            '<span class="tm '+(d > 0 ? 'mjup' : d < 0 ? 'mjdown' : '')+'">'+(d ? signed(d) : '')+'</span><span class="tm"><b>'+fmt(p.pts)+'</b></span></div>'; }).join('')
        : '<p class="how">No players yet. Add everyone at the table.</p>') +
      awards() +
      '<div class="fcrow mjadd"><input id="mjname" placeholder="New player’s name…" maxlength="30" autocomplete="off">' +
        '<button class="btn" id="mjaddp" type="button">Add player</button></div>' +
      (st.length > 1 ?
        '<h3 class="mjh">Record a game</h3><p class="how">Points won (+) or lost (−) this game. Leave anyone who didn’t change blank.</p>' +
        calcHTML() +
        '<div class="mjround">' + state.players.map(p =>
          '<label><span><i class="mjdot" style="background:'+color(p.id)+'"></i>'+esc(p.name)+'</span>' +
          '<input type="number" step="1" data-id="'+p.id+'" placeholder="0"></label>').join('') + '</div>' +
        '<div class="fcrow"><span class="how mjsum" id="mjsum"></span>' +
          '<button class="btn primary" id="mjsave" type="button">Save game</button>' +
          (state.rounds.length ? '<button class="btn" id="mjundo" type="button">Undo last game</button>' : '') + '</div>' +
        graph() +
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
      $('mjsum').textContent = t ? 'Adds up to ' + signed(t) + ' (usually 0)' : studio() ? '+ for winners, − for whoever paid' : ''; };
    inputs.forEach(i => i.oninput = sum);
    /* Studio: Enter in a box saves the game */
    box.querySelectorAll('.mjsrow input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter' && $('mjsave')) $('mjsave').click(); });
    if ($('mjsave')) $('mjsave').onclick = () => { const d = {}; inputs.forEach(i => { const v = Math.round(+i.value); if (v) d[i.dataset.id] = v; });
      if (Object.keys(d).length) act({ action:'round', d }); };
    if ($('mjundo')) $('mjundo').onclick = () => { if (confirm('Undo the last game?')) act({ action:'undo' }); };
    wireCalc(); wireGraph();
  }
  async function act(body){
    if (busy) return; busy = true;
    try { state = (await mjSend(body)).state; tipAt = null;
      if (body.action === 'round') Object.assign(calc, { w: null, from: 'self', ticks: {} });
      paint(); }
    catch (e){ paint(e.message); }
    busy = false;
  }
  addEventListener('tt:look', () => { fitPage(); if (state && !busy) paint(); });
  /* Studio on a computer: the sheet is exactly one window high, like the timetable, so
     nothing needs scrolling. Accessibility → Zoom scales <body>, and browsers disagree on
     whether a set height is zoomed too, so set it, measure, and correct once. */
  function fitPage(){
    const w = host.closest('.wrap'); if (!w) return;
    if (!studio() || innerWidth <= 860){ w.style.height = ''; return; }
    w.style.height = innerHeight + 'px';
    const h = w.getBoundingClientRect().height;
    if (h && Math.abs(h - innerHeight) > .5) w.style.height = (innerHeight * innerHeight / h) + 'px';
  }
  addEventListener('resize', fitPage);
  fitPage();
  mjFetch().then(d => { state = d.state; paint(); }, e => { box.innerHTML = '<p class="how">Could not load: ' + esc(e.message) + '</p>'; });
}

return { mount, leaders: async () => mjLeaders((await mjFetch()).state) };
})();
