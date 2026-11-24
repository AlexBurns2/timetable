/* Surrealism: its own script (theme.js skinJs), loaded the first time the theme is on. It adds the two things a
   stylesheet can't, and takes them away again when another theme is picked (it watches html[data-skin], tt:look):
   - the notation, top left on every page: dots on a grid with some missing, a different arrangement on every page,
     the same each visit (nobody is meant to read it);
   - the timetable: a square of light floating over the dunes. Now and then it glitches out and turns up over a dune
     further back, and later glitches forward again. With Animation off (or the system asking for less motion) it just
     stays where it is. Drawn in the photograph's own coordinates, so it sits on the same dune at any window size. */
(() => {
  'use strict';
  const root = document.documentElement;
  const on = () => root.getAttribute('data-skin') === 'surreal';
  const moving = () => root.getAttribute('data-fx') === 'on' && root.getAttribute('data-motion') !== 'reduced' &&
    !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let undo = [], live = false;
  const later = f => undo.push(f);
  function off(){ undo.splice(0).reverse().forEach(f => { try { f(); } catch {} }); live = false; }

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

  /* ── the timetable: the square of light ── */
  const PHOTO = { w:1920, h:1280, posX:.5, posY:.4 };        // images/surreal/tt.webp, placed as surreal.css does (50% 40%, cover)
  const SPOTS = [
    /* centre and size in the photograph's pixels; the corners, as a square turned a little away (its far side shorter) */
    { x:250, y:560, s:240, q:[[-.42, -.5], [.4, -.44], [.4, .44], [-.42, .5]] },
    { x:1480, y:330, s:112, q:[[-.4, -.44], [.42, -.5], [.42, .5], [-.4, .44]] }
  ];
  function light(){
    const box = document.createElement('div');
    box.className = 'sulight'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<svg><defs><radialGradient id="supool"><stop offset="0" stop-color="#dbe8ff" stop-opacity=".55"/><stop offset=".55" stop-color="#9fb8e6" stop-opacity=".16"/>' +
      '<stop offset="1" stop-color="#9fb8e6" stop-opacity="0"/></radialGradient></defs><g><ellipse class="pool" fill="url(#supool)"/><polygon class="sq"/></g></svg>';
    document.body.appendChild(box);
    later(() => box.remove());
    const g = box.querySelector('g'), sq = box.querySelector('.sq'), pool = box.querySelector('.pool');
    let at = 0;
    function place(){
      const vw = innerWidth, vh = innerHeight, k = Math.max(vw / PHOTO.w, vh / PHOTO.h);
      const ox = (vw - PHOTO.w * k) * PHOTO.posX, oy = (vh - PHOTO.h * k) * PHOTO.posY;
      const p = SPOTS[at], cx = ox + p.x * k, cy = oy + p.y * k, s = p.s * k;
      sq.setAttribute('points', p.q.map(([a, b]) => (cx + a * s).toFixed(1) + ',' + (cy + b * s).toFixed(1)).join(' '));
      sq.setAttribute('stroke-width', Math.max(1.4, s * .012).toFixed(2));
      /* the light it throws on the sand below it */
      pool.setAttribute('cx', cx.toFixed(1)); pool.setAttribute('cy', (cy + s * .86).toFixed(1));
      pool.setAttribute('rx', (s * .95).toFixed(1)); pool.setAttribute('ry', (s * .17).toFixed(1));
    }
    place();
    addEventListener('resize', place); later(() => removeEventListener('resize', place));
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

  function start(){
    live = true;
    notation();
    if (root.getAttribute('data-pg') === 'timetable') light();
  }
  function look(){
    if (on() && !live) start();
    else if (!on() && live) off();
  }
  function go(){ addEventListener('tt:look', look); look(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
})();
