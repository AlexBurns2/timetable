/* Surrealism: its own script (theme.js skinJs), loaded the first time the theme is on. It adds what a stylesheet
   can't, and takes it all away again when another theme is picked (it watches html[data-skin], tt:look):
   - the notation, top left on every page: dots on a grid with some missing, a different arrangement on every page,
     the same each visit (nobody is meant to read it);
   - on a wide screen, the unexplainable thing in each place, live, over the photograph (tools/surreal/render.py made
     the backdrops; a phone held upright gets the whole picture baked and none of this):
       Home       the chrome sphere hangs over the flooded flat, rising and sinking very slowly, its reflection under it
       Timetable  a great square of light over the dunes, its light on the sand following every slope; it breathes a little, a few stars
                  twinkle, and now and then it glitches out and turns up over a dune further back, then comes forward
       planners   the mirrors on the salt show a sky drifting by that isn't there
       the rest   the mountain inside the lifted disc drifts slowly, out of step with the one around it
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
    plan: { w:1920, h:1280, px:.7, py:.62, panes:[
      { q:[[144, 784], [144, 1158], [346, 1154.5], [346, 774]], sky:'rose', edge:'r' },
      { q:[[547, 805], [547, 911], [610, 910.3], [610, 803]], sky:'pale', edge:'r' },
      { q:[[1181, 813], [1181, 979], [1281, 980.4], [1281, 817]], sky:'rose', edge:'l' },
      { q:[[1411, 743], [1411, 1197], [1651, 1201.9], [1651, 757]], sky:'pale', edge:'l' } ] },
    mist: { w:1920, h:985, px:.88, py:.42, disc:[1555, 424, 266], shift:[-67, -197] }
  };
  const sceneOf = pg => pg === 'home' ? 'home' : pg === 'timetable' ? 'tt' : ['calendar', 'free', 'revision', 'notes'].includes(pg) ? 'plan' : 'mist';
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

  /* ── the planners: the mirrors' skies ── */
  function mirrors(){
    const S = SCENE.plan, L = stage('suplan');
    L.innerHTML = S.panes.map(p => '<div class="pane ' + p.edge + '"><i style="background-image:url(' + IMG('sky-' + p.sky) + ')"></i></div>').join('');
    const els = [...L.children];
    onResize(() => {
      const m = mapper(S);
      S.panes.forEach((p, i) => {
        const pts = p.q.map(([x, y]) => [m.x(x), m.y(y)]);
        const x0 = Math.min(...pts.map(v => v[0])), y0 = Math.min(...pts.map(v => v[1])), x1 = Math.max(...pts.map(v => v[0])), y1 = Math.max(...pts.map(v => v[1]));
        const el = els[i], w = x1 - x0, hh = y1 - y0;
        Object.assign(el.style, { left:x0 + 'px', top:y0 + 'px', width:w + 'px', height:hh + 'px',
          clipPath:'polygon(' + pts.map(([x, y]) => (x - x0).toFixed(1) + 'px ' + (y - y0).toFixed(1) + 'px').join(',') + ')' });
        /* the sky strip, at the pane's height (its tile: 2160 × 315, the strip and its mirror), drifting one tile's width */
        const T = hh * 1.6 * 2160 / 315;
        el.style.setProperty('--T', T.toFixed(0) + 'px'); el.style.setProperty('--th', (hh * 1.6).toFixed(0) + 'px');
        el.style.setProperty('--dur', (140 + i * 37) + 's');
      });
    });
  }

  /* ── the rest: the lifted disc ── */
  function disc(){
    const S = SCENE.mist, L = stage('sumist');
    L.innerHTML = '<div class="disc"><i style="background-image:url(' + IMG('mist') + ')"></i></div>';
    const d = L.firstChild, img = d.firstChild;
    onResize(() => {
      const m = mapper(S), [cx, cy, R] = S.disc, r = R * m.k;
      const left = m.x(cx) - r, top = m.y(cy) - r;
      Object.assign(d.style, { left:left + 'px', top:top + 'px', width:2 * r + 'px', height:2 * r + 'px' });
      /* inside it, the same photograph moved by the shift render.py gave it */
      Object.assign(img.style, { left:(m.ox + S.shift[0] * m.k - left) + 'px', top:(m.oy + S.shift[1] * m.k - top) + 'px',
        width:S.w * m.k + 'px', height:S.h * m.k + 'px' });
      d.style.setProperty('--drift', (S.h * m.k * .035).toFixed(1) + 'px');
    });
  }

  function start(){
    live = true;
    notation();
    const sc = sceneOf(root.getAttribute('data-pg') || 'home');
    if (root.getAttribute('data-pg') === 'hkmahjong') return;
    ({ home, tt:light, plan:mirrors, mist:disc })[sc]();
  }
  function look(){
    if (on() && !live) start();
    else if (!on() && live) off();
  }
  function go(){ addEventListener('tt:look', look); look(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
})();
