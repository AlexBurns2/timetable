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
       Games, Mahjong  a straight slot cut through a butte; now and then a piece of its edge falls to the bottom
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
    /* Factory Butte with a slot cut through it (tools/surreal/slot.py): the slot's opening (top left, top right, foot right,
       foot left), where the far wall's top edge shows (rock breaks off there and falls down its face: further along the
       edge than this it's hidden behind the near wall, and the sky in the gap is beyond the butte), and 2 image px to the
       metre at the butte */
    slot: { w:1960, h:1520, px:.5, py:.16, open:[[1600, 120], [1696, 120], [1731, 992], [1614, 992]], lip:[1673, 1694, 124], floor:990, pxm:2 }
  };
  const sceneOf = pg => pg === 'home' ? 'home' : pg === 'timetable' ? 'tt' : ['calendar', 'free', 'revision', 'notes'].includes(pg) ? 'plan' :
    ['games', 'mahjong'].includes(pg) ? 'slot' : 'wreck';
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

  /* ── Games and Mahjong: the slot in the butte. Now and then a piece of the cut's top edge breaks off and falls the four
        hundred metres to the floor of the slot, as slowly as it really would from that far away (about seven seconds), and
        raises a little dust that drifts and settles. Drawn on a canvas only while something is falling or settling. ── */
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
    function fall(){
      if (!moving() || document.hidden) return;
      const n = 1 + Math.floor(R() * 3), xa = S.lip[0] + 2 + R() * (S.lip[1] - S.lip[0] - 4);
      for (let i = 0; i < n; i++)
        rocks.push({ x:xa + (R() - .5) * 5, y:S.lip[2] + R() * 3, vx:(R() - .5) * 1.2, t0:t + i * (.15 + R() * .5), s:.8 + R() * 1.4, hit:false });
      if (!raf){ last = 0; raf = requestAnimationFrame(frame); }
    }
    function frame(now){
      raf = 0;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
      /* only inside the slot's opening */
      x.save(); x.beginPath(); S.open.forEach(([a, b], i) => i ? x.lineTo(m.x(a), m.y(b)) : x.moveTo(m.x(a), m.y(b))); x.closePath(); x.clip();
      for (const d of dust){
        const age = t - d.t0; if (age < 0) continue;
        const r = (d.r0 + 30 * Math.sqrt(age)) * m.k, a = d.a * Math.max(0, 1 - age / d.life) * Math.min(1, age * 3);
        const cx = m.x(d.x + age * 2.2), cy = m.y(d.y - 34 * Math.sqrt(age));        // billowing up, drifting a little east
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(178,166,156,' + a.toFixed(3) + ')'); g.addColorStop(.55, 'rgba(178,166,156,' + (a * .5).toFixed(3) + ')'); g.addColorStop(1, 'rgba(178,166,156,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      }
      for (const r of rocks){
        const age = t - r.t0; if (age < 0 || r.hit) continue;
        const y = r.y + .5 * G * age * age, xx = r.x + r.vx * age;
        if (y >= S.floor){ r.hit = true; dust.push({ x:xx, y:S.floor - 6, t0:t, r0:8 + r.s * 5, a:.42 + r.s * .12, life:8 + R() * 3 }); continue; }
        const sz = Math.max(.9, r.s * m.k * 1.6), trail = Math.min(18, G * age * .035) * m.k;
        x.strokeStyle = 'rgba(70,58,52,.35)'; x.lineWidth = sz * .8; x.beginPath(); x.moveTo(m.x(xx), m.y(y) - trail); x.lineTo(m.x(xx), m.y(y)); x.stroke();
        x.fillStyle = 'rgba(66,54,48,.9)'; x.fillRect(m.x(xx) - sz / 2, m.y(y) - sz / 2, sz, sz);
      }
      x.restore();
      rocks = rocks.filter(r => !r.hit); dust = dust.filter(d => t - d.t0 < d.life);
      if (rocks.length || dust.length) raf = requestAnimationFrame(frame); else x.clearRect(0, 0, innerWidth, innerHeight);
    }
    let tm = 0;
    const next = () => { tm = setTimeout(() => { fall(); next(); }, 9000 + Math.random() * 16000); };
    tm = setTimeout(() => { fall(); next(); }, 2500);
    later(() => { clearTimeout(tm); cancelAnimationFrame(raf); });
  }

  function start(){
    live = true;
    notation();
    const sc = sceneOf(root.getAttribute('data-pg') || 'home');
    if (root.getAttribute('data-pg') === 'hkmahjong') return;
    const run = { home, tt:light, wreck, slot }[sc];         // (the planners' gateways are all in the picture)
    if (run) run();
  }
  function look(){
    if (on() && !live) start();
    else if (!on() && live) off();
  }
  function go(){ addEventListener('tt:look', look); look(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
})();
