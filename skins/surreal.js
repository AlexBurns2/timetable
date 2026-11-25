/* Surrealism: its own script (theme.js skinJs), loaded the first time the theme is on. It adds what a stylesheet
   can't, and takes it all away again when another theme is picked (it watches html[data-skin], tt:look):
   - the notation, top left on every page: dots on a grid with some missing, a different arrangement on every page,
     the same each visit (nobody is meant to read it);
   - on a wide screen, the unexplainable thing in each place, live, over the photograph (tools/surreal/render.py made
     the backdrops; a phone held upright gets the whole picture baked and none of this):
       Home       the chrome sphere hangs over the flooded flat, rising and sinking very slowly, its reflection under it
       Timetable  a great square of light over the dunes, its light on the sand following every slope; it breathes a little, a few stars
                  twinkle, and now and then it glitches out and turns up over a dune further back, then comes forward
       planners   (nothing live: the line of gateways and their shadows are all in the picture)
       Games, Mahjong  a slice taken clean out of a butte and the ground under it; now and then rock breaks off the cut's
                  top edge and falls down the face out of sight, and a little later some dust comes up out of it
       Resources, Finder  the surf on a Baltic beach (a phone's clip, held still, looping), a black slab standing in the
                  sea, its shadow running at us across the waves and the sand
       the rest   a ship driven bow-first into the dunes at dusk, clouds rolling slowly past behind its masts
     Everything is placed in the photograph's own pixels and moved with it, so it sits in the same spot at any window
     size. With Animation off (or the system asking for less motion) it all holds still. */
(() => {
  'use strict';
  const root = document.documentElement;
  const on = () => root.getAttribute('data-skin') === 'surreal';
  const moving = () => root.getAttribute('data-fx') === 'on' && root.getAttribute('data-motion') !== 'reduced' &&
    !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let undo = [], live = false;
  const later = f => undo.push(f);
  function off(){ undo.splice(0).reverse().forEach(f => { try { f(); } catch {} }); live = false; }
  const IMG = n => '/images/surreal/' + n + '.webp';

  /* where each photograph sits on the screen: its size, and the background-position surreal.css gives it (keep the two
     in step); render.py printed the objects' places (LAYOUT) */
  const SCENE = {
    home: { w:1920, h:1280, px:.94, py:.34, orb:[1699, 384, 147], water:749 },
    tt:   { w:1920, h:1440, px:.5, py:.62 },
    /* the stranded ship (tools/surreal/wreck.py printed these): its cut-out's box, and the band of sky the clouds roll in */
    wreck: { w:1920, h:1440, px:.8, py:.52, ship:[1401, 271, 1805, 803], clouds:[0, 40, 1920, 584], tile:[876, 292] },
    /* Factory Butte with a slice taken out of it (tools/surreal/slot.py printed these): the cut's outline (rock falls
       inside it and is hidden past it, behind the near side's slopes), the far wall's top edge from the notch up to the
       prow (a line of points; rock breaks away anywhere along it), and 2.1 image px to the metre at the butte */
    slot: { w:1960, h:1520, px:.5, py:.16, pxm:2.1,
      lip:[[1621,329], [1632,320], [1642,319], [1651,318], [1661,311], [1670,298], [1680,281], [1690,262], [1699,242], [1709,224], [1718,207], [1728,202], [1738,186], [1747,183], [1757,179], [1766,179], [1776,175], [1779,174]],
      open:[[1637,154],[1623,163],[1599,168],[1598,178],[1602,202],[1610,206],[1601,221],[1605,269],[1615,278],[1614,293],[1618,312],[1614,317],[1617,322],[1614,326],[1619,341],[1694,494],[1700,509],[1722,514],[1725,528],[1754,581],[1761,600],[1772,643],[1791,648],[1792,667],[1810,672],[1814,696],[1819,701],[1842,706],[1820,710],[1822,715],[1848,720],[1829,725],[1838,734],[1867,739],[1876,754],[1887,758],[1905,787],[1905,792],[1924,797],[1924,806],[1950,811],[1960,816],[1958,566],[1945,542],[1906,490],[1905,485],[1910,480],[1902,470],[1902,461],[1877,456],[1858,408],[1839,403],[1798,346],[1804,293],[1798,206],[1790,197],[1786,173],[1786,154]] }
  };
  const sceneOf = pg => pg === 'home' ? 'home' : pg === 'timetable' ? 'tt' : ['calendar', 'free', 'revision', 'notes'].includes(pg) ? 'plan' :
    ['games', 'mahjong'].includes(pg) ? 'slot' : ['resources', 'finder'].includes(pg) ? 'surf' : 'wreck';
  /* photo pixels to the screen (cover, positioned) */
  function mapper(S){
    const vw = innerWidth, vh = innerHeight, k = Math.max(vw / S.w, vh / S.h);
    const ox = (vw - S.w * k) * S.px, oy = (vh - S.h * k) * S.py;
    return { k, ox, oy, x:x => ox + x * k, y:y => oy + y * k };
  }

  /* ── the notation: 2 rows of 11, about a third of the dots missing, seeded by the page ── */
  function notation(){
    const pg = root.getAttribute('data-pg') || 'home';
    let h = 2166136261; for (const c of 'surreal:' + pg) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const C = 11, R = 2, S = 6;
    let dots = '';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++){
      const keep = rnd() > 0.34 || (c === 0 && r === 0);          // (it always starts with a dot)
      if (keep) dots += '<circle cx="' + (c * S + 3) + '" cy="' + (r * S + 3) + '" r="1.55"/>';
    }
    const el = document.createElement('div');
    el.className = 'sunote'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 0 ' + (C * S) + ' ' + (R * S) + '" fill="currentColor">' + dots + '</svg>';
    document.body.appendChild(el);
    later(() => el.remove());
  }

  /* the layer the live things go in (under the page, over the photograph; hidden on an upright phone by surreal.css) */
  function stage(cls){
    const L = document.createElement('div');
    L.className = 'sulive ' + cls; L.setAttribute('aria-hidden', 'true');
    document.body.appendChild(L);
    later(() => L.remove());
    return L;
  }
  function onResize(fn){ addEventListener('resize', fn); later(() => removeEventListener('resize', fn)); fn(); }

  /* ── Home: the sphere ── */
  function home(){
    const S = SCENE.home, L = stage('suhome');
    L.innerHTML = '<img class="orbr" alt="" src="' + IMG('orb') + '"><img class="orb" alt="" src="' + IMG('orb') + '">';
    const orb = L.querySelector('.orb'), refl = L.querySelector('.orbr');
    onResize(() => {
      const m = mapper(S), [cx, cy, R] = S.orb, r = R * m.k, ry = 2 * S.water - cy;
      Object.assign(orb.style, { left:(m.x(cx) - r) + 'px', top:(m.y(cy) - r) + 'px', width:2 * r + 'px', height:2 * r + 'px' });
      Object.assign(refl.style, { left:(m.x(cx) - r) + 'px', top:(m.y(ry) - r) + 'px', width:2 * r + 'px', height:2 * r + 'px' });
      L.style.setProperty('--bob', (r * .16).toFixed(1) + 'px');
    });
  }

  /* ── the timetable: the square of light ── */
  const SPOTS = [
    /* centre and size in the photograph's pixels; the corners, as a square turned a little away (its far edge longer, the
       top running up toward it), like the one in the owner's reference; the light it throws on the dunes, rendered from
       the photograph so it follows the terrain (render.py glows(): the whole width, from row 854 down; keep in step) */
    { x:1180, y:770, s:420, glow:'glow-a', q:[[-.5, -.36], [.5, -.56], [.5, .5], [-.5, .56]] },
    { x:620, y:935, s:140, glow:'glow-b', q:[[-.5, -.36], [.5, -.56], [.5, .5], [-.5, .56]] }
  ];
  const GLOW = [0, 854, 1920, 586];
  function light(){
    const S = SCENE.tt, L = stage('sulight');
    /* a few stars that twinkle, seeded so they're always the same ones */
    let h = 99991; const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const stars = Array.from({ length:18 }, () => [rnd() * S.w, rnd() * 900, .7 + rnd() * 1.1, (rnd() * 6).toFixed(2), (3.5 + rnd() * 4).toFixed(2)]);
    L.innerHTML = '<svg><g class="stars"></g><g class="sqg"><image class="pool" preserveAspectRatio="none"/><polygon class="sq"/></g></svg>';
    SPOTS.forEach(p => { const i = new Image(); i.src = IMG(p.glow); });        // (both lights ready before the first jump)
    const g = L.querySelector('.sqg'), sq = L.querySelector('.sq'), pool = L.querySelector('.pool'), sg = L.querySelector('.stars');
    let at = 0;
    function place(){
      const m = mapper(S), p = SPOTS[at], cx = m.x(p.x), cy = m.y(p.y), s = p.s * m.k;
      sq.setAttribute('points', p.q.map(([a, b]) => (cx + a * s).toFixed(1) + ',' + (cy + b * s).toFixed(1)).join(' '));
      sq.setAttribute('stroke-width', Math.max(1.6, s * .011).toFixed(2));
      /* the light it throws on the dunes under it */
      pool.setAttribute('href', IMG(p.glow));
      pool.setAttribute('x', m.x(GLOW[0]).toFixed(1)); pool.setAttribute('y', m.y(GLOW[1]).toFixed(1));
      pool.setAttribute('width', (GLOW[2] * m.k).toFixed(1)); pool.setAttribute('height', (GLOW[3] * m.k).toFixed(1));
      sg.innerHTML = stars.map(([x, y, r, d, t]) => '<circle cx="' + m.x(x).toFixed(1) + '" cy="' + m.y(y).toFixed(1) + '" r="' + r.toFixed(2) + '" style="animation-delay:-' + d + 's;animation-duration:' + t + 's"/>').join('');
    }
    onResize(place);
    /* now and then: out with a glitch, back over the other dune */
    let t = 0;
    const cycle = () => {
      t = setTimeout(() => {
        if (!moving() || document.hidden){ cycle(); return; }
        g.classList.remove('come'); void g.getBoundingClientRect(); g.classList.add('go');
        t = setTimeout(() => {
          at = 1 - at; place();
          g.classList.remove('go'); void g.getBoundingClientRect(); g.classList.add('come');
          cycle();
        }, 260 + 420);           // (a beat of nothing between)
      }, at === 0 ? 9000 : 6500);
    };
    cycle();
    later(() => clearTimeout(t));
  }

  /* ── the rest: the ship driven into the dunes, and the dusk clouds rolling past behind its masts ── */
  function wreck(){
    const S = SCENE.wreck, L = stage('suwreck');
    L.innerHTML = '<div class="clouds"><i style="background-image:url(' + IMG('wreck-clouds') + ')"></i></div><img class="ship" alt="" src="' + IMG('wreck-ship') + '">';
    const cl = L.querySelector('.clouds'), ship = L.querySelector('.ship');
    onResize(() => {
      const m = mapper(S), [sx0, sy0, sx1, sy1] = S.ship, [cx0, cy0, cw, ch] = S.clouds;
      Object.assign(ship.style, { left:m.x(sx0) + 'px', top:m.y(sy0) + 'px', width:(sx1 - sx0) * m.k + 'px', height:(sy1 - sy0) * m.k + 'px' });
      Object.assign(cl.style, { left:'0px', top:m.y(cy0) + 'px', width:'100%', height:ch * m.k + 'px' });
      const T = ch * m.k * S.tile[0] / S.tile[1];
      cl.style.setProperty('--T', T.toFixed(0) + 'px');
    });
  }

  /* ── Games and Mahjong: the slice through the butte (with a notch in its top, rubble at its foot and a crack across the
        plain toward us, all in the picture). Now and then a few pieces of the far wall's top edge break away and
        fall down its face, as slowly as they really would from that far away, until the near side's slopes hide them
        (the cut has no bottom anyone can see); a few seconds later a little dust comes up out of it, drifts and thins.
        Drawn on a canvas only while something is falling or settling. ── */
  function slot(){
    const S = SCENE.slot, L = stage('suslot');
    const cv = document.createElement('canvas'); L.appendChild(cv);
    const x = cv.getContext('2d');
    let m = null, dpr = 1;
    onResize(() => { m = mapper(S); dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; });
    const G = 9.8 * S.pxm;                               // gravity in image px per second squared
    let rocks = [], dust = [], raf = 0, t = 0, last = 0;
    const R = Math.random;
    /* inside the cut's outline (photo px) */
    const inside = (px, py) => {
      let c = false; const P = S.open;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++){
        const [xi, yi] = P[i], [xj, yj] = P[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    /* the far wall's top edge, down from the prow into the notch: its length, piece by piece */
    const segs = S.lip.slice(1).map((p, i) => Math.hypot(p[0] - S.lip[i][0], p[1] - S.lip[i][1]));
    const edge = segs.reduce((a, b) => a + b, 0);
    function fall(){
      if (!moving() || document.hidden) return;
      const n = 1 + Math.floor(R() * 3);
      let a = R() * edge, i = 0;
      while (i < segs.length - 1 && a > segs[i]){ a -= segs[i]; i++; }
      const k = a / segs[i], xa = S.lip[i][0] + (S.lip[i + 1][0] - S.lip[i][0]) * k, ya = S.lip[i][1] + (S.lip[i + 1][1] - S.lip[i][1]) * k;
      for (let i = 0; i < n; i++)
        rocks.push({ x:xa + (R() - .5) * 5, y:ya + 1 + R() * 2, vx:(R() - .5) * 1.2, t0:t + i * (.15 + R() * .5), s:.8 + R() * 1.4, gone:false });
      if (!raf){ last = 0; raf = requestAnimationFrame(frame); }
    }
    function frame(now){
      raf = 0;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
      /* only inside the cut */
      x.save(); x.beginPath(); S.open.forEach(([a, b], i) => i ? x.lineTo(m.x(a), m.y(b)) : x.moveTo(m.x(a), m.y(b))); x.closePath(); x.clip();
      for (const d of dust){
        const age = t - d.t0; if (age < 0) continue;
        const r = (d.r0 + 22 * Math.sqrt(age)) * m.k, a = d.a * Math.max(0, 1 - age / d.life) * Math.min(1, age * 1.5);
        const cx = m.x(d.x + age * 1.6), cy = m.y(d.y - 26 * Math.sqrt(age));        // coming up out of the cut, drifting a little east
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(168,162,160,' + a.toFixed(3) + ')'); g.addColorStop(.55, 'rgba(168,162,160,' + (a * .5).toFixed(3) + ')'); g.addColorStop(1, 'rgba(168,162,160,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      }
      for (const r of rocks){
        const age = t - r.t0; if (age < 0 || r.gone) continue;
        const y = r.y + .5 * G * age * age, xx = r.x + r.vx * age;
        /* gone behind the near side: some time later, its dust comes up from about there */
        if (age > .4 && !inside(xx, y)){ r.gone = true; dust.push({ x:xx, y:y - 4, t0:t + 1.5 + R() * 2, r0:6 + r.s * 4, a:.26 + r.s * .08, life:9 + R() * 3 }); continue; }
        const sz = Math.max(.9, r.s * m.k * 1.6), trail = Math.min(18, G * age * .035) * m.k;
        x.strokeStyle = 'rgba(70,58,52,.35)'; x.lineWidth = sz * .8; x.beginPath(); x.moveTo(m.x(xx), m.y(y) - trail); x.lineTo(m.x(xx), m.y(y)); x.stroke();
        x.fillStyle = 'rgba(66,54,48,.9)'; x.fillRect(m.x(xx) - sz / 2, m.y(y) - sz / 2, sz, sz);
      }
      x.restore();
      rocks = rocks.filter(r => !r.gone); dust = dust.filter(d => t - d.t0 < d.life);
      if (rocks.length || dust.length) raf = requestAnimationFrame(frame); else x.clearRect(0, 0, innerWidth, innerHeight);
    }
    let tm = 0;
    const next = () => { tm = setTimeout(() => { fall(); next(); }, 9000 + Math.random() * 16000); };
    tm = setTimeout(() => { fall(); next(); }, 2500);
    later(() => { clearTimeout(tm); cancelAnimationFrame(raf); });
  }

  /* ── Resources and Finder: the surf. The clip (tools/surreal/surf.py; its first frame is the backdrop, so nothing
        jumps when it starts) plays only with Animation on, on a screen that isn't an upright phone, and not when the page
        is hidden or the connection is set to save data; it isn't even fetched otherwise. Animation off mid-way: it holds
        still where it is. ── */
  function surf(){
    const L = stage('susurf');
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.disablePictureInPicture = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    L.appendChild(v);
    let armed = false;                                    // (its sources only once it's to play: nothing fetched before)
    const upright = matchMedia('(max-aspect-ratio:4/5)'), less = matchMedia('(prefers-reduced-motion: reduce)');
    const thrift = () => !!(navigator.connection && navigator.connection.saveData);
    const sync = () => {
      if (moving() && !document.hidden && !upright.matches && !thrift()){
        if (!armed){ armed = true; v.preload = 'auto';
          v.innerHTML = '<source src="/images/surreal/surf.webm" type="video/webm"><source src="/images/surreal/surf.mp4" type="video/mp4">'; v.load(); }
        const p = v.play(); if (p) p.catch(() => {});
      }
      else if (!v.paused) v.pause();
    };
    v.addEventListener('playing', () => v.classList.add('on'), { once:true });
    const mo = new MutationObserver(sync); mo.observe(root, { attributes:true, attributeFilter:['data-fx', 'data-motion'] });
    document.addEventListener('visibilitychange', sync);
    upright.addEventListener && upright.addEventListener('change', sync); less.addEventListener && less.addEventListener('change', sync);
    sync();
    later(() => { mo.disconnect(); document.removeEventListener('visibilitychange', sync);
      upright.removeEventListener && upright.removeEventListener('change', sync); less.removeEventListener && less.removeEventListener('change', sync);
      v.pause(); v.innerHTML = ''; v.load(); });
  }

  function start(){
    live = true;
    notation();
    const sc = sceneOf(root.getAttribute('data-pg') || 'home');
    if (root.getAttribute('data-pg') === 'hkmahjong') return;
    const run = { home, tt:light, wreck, slot, surf }[sc];         // (the planners' gateways are all in the picture)
    if (run) run();
  }
  function look(){
    if (on() && !live) start();
    else if (!on() && live) off();
  }
  function go(){ addEventListener('tt:look', look); look(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
})();
