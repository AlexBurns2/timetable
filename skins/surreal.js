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
  /* what to take away again: the page's (the notation, the gallery) and the place's (its live things; a new place
     replaces them, see swapTo). later() adds to whichever is being set up. */
  let undo = [], sceneUndo = [], bin = undo, live = false;
  const later = f => bin.push(f);
  const stopScene = () => sceneUndo.splice(0).reverse().forEach(f => { try { f(); } catch {} });
  function off(){ stopScene(); undo.splice(0).reverse().forEach(f => { try { f(); } catch {} }); live = false; }
  /* (with the site's version, so a changed picture is fetched fresh) */
  const VQ = () => (window.TT && TT.ASSET_V) ? '?v=' + TT.ASSET_V : '';
  const IMG = n => '/images/surreal/' + n + '.webp' + VQ();

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
  /* It's drawn the way the photograph is (the owner, 26 November 2026: it read as a sharper thing sliding over a softer
     picture): on two small canvases at the photograph's own resolution, laid exactly on its pixel grid and enlarged with
     it, and redrawn at its new height as it moves, so it's never sharper than the photo and its pixels line up with the
     photo's. It rises and sinks over 26 s; its reflection, softer and darker, moves the other way. */
  function home(){
    const S = SCENE.home, L = stage('suhome'), [cx, cy, R] = S.orb, B = Math.round(R * .16), PAD = 3;
    const W = 2 * R + 2 * PAD, H = 2 * R + 2 * B + 2 * PAD, ry = 2 * S.water - cy;
    const x0 = Math.floor(cx - R) - PAD, y0 = Math.floor(cy - R - B) - PAD, ry0 = Math.floor(ry - R - B) - PAD;
    const mk = cls => { const c = document.createElement('canvas'); c.className = cls; c.width = W; c.height = H; L.appendChild(c); return c; };
    const refl = mk('orbr'), orb = mk('orb'), ox = orb.getContext('2d'), rx = refl.getContext('2d');
    const img = new Image();
    let ready = false, raf = 0, last = 0;
    function draw(dy){                                   // dy: photo pixels, up is negative
      if (!ready) return;
      ox.clearRect(0, 0, W, H); ox.imageSmoothingQuality = 'high';
      ox.drawImage(img, cx - R - x0, cy - R - y0 + dy, 2 * R, 2 * R);
      const c = ry - dy - ry0;                             // the reflection's centre, moving the other way, upside down
      rx.setTransform(1, 0, 0, 1, 0, 0); rx.clearRect(0, 0, W, H);
      rx.filter = 'blur(0.6px) brightness(0.88)'; rx.globalAlpha = .78;
      rx.setTransform(1, 0, 0, -1, 0, 2 * c); rx.drawImage(img, cx - R - x0, c - R, 2 * R, 2 * R);
    }
    const dyAt = t => -B * Math.cos(Math.PI * t / 13000);   // (as the old 13 s alternate ease)
    function tick(now){
      raf = 0;
      if (!moving() || document.hidden){ draw(0); return; }
      if (now - last > 33){ last = now; draw(dyAt(now)); }   // about 30 a second is plenty for something this slow
      raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    img.onload = () => { ready = true; draw(0); kick(); };
    img.src = IMG('orb');
    onResize(() => {
      const m = mapper(S);
      Object.assign(orb.style, { left:m.x(x0) + 'px', top:m.y(y0) + 'px', width:W * m.k + 'px', height:H * m.k + 'px' });
      Object.assign(refl.style, { left:m.x(x0) + 'px', top:m.y(ry0) + 'px', width:W * m.k + 'px', height:H * m.k + 'px' });
    });
    const mo = new MutationObserver(kick); mo.observe(root, { attributes:true, attributeFilter:['data-fx', 'data-motion'] });
    document.addEventListener('visibilitychange', kick);
    later(() => { cancelAnimationFrame(raf); mo.disconnect(); document.removeEventListener('visibilitychange', kick); });
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
  /* The square, its glow and the stars are drawn at the photograph's own resolution (photoCanvas), so on a big screen they
     are no sharper than the photo they're in (the owner, 26 November 2026); the light on the dunes was already the photo's. */
  function light(){
    const S = SCENE.tt, L = stage('sulight');
    /* a few stars that twinkle, seeded so they're always the same ones */
    let h = 99991; const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const stars = Array.from({ length:18 }, () => [rnd() * S.w, rnd() * 900, .55 + rnd() * .9, rnd() * 6, 3.5 + rnd() * 4]);
    L.innerHTML = '<div class="sqg"><svg><image class="pool" preserveAspectRatio="none"/></svg></div>';
    SPOTS.forEach(p => { const i = new Image(); i.src = IMG(p.glow); });        // (both lights ready before the first jump)
    const g = L.querySelector('.sqg'), pool = L.querySelector('.pool');
    /* the square's canvas: over both of its places, with room for the glow */
    const M = 46, cs = SPOTS.flatMap(p => p.q.map(([a, b]) => [p.x + a * p.s, p.y + b * p.s]));
    const QX0 = Math.floor(Math.min(...cs.map(c => c[0]))) - M, QY0 = Math.floor(Math.min(...cs.map(c => c[1]))) - M;
    const QW = Math.ceil(Math.max(...cs.map(c => c[0]))) + M - QX0, QH = Math.ceil(Math.max(...cs.map(c => c[1]))) + M - QY0;
    const sqc = photoCanvas(g, S, QX0, QY0, QW, QH); sqc.className = 'sqc';
    const sx = sqc.getContext('2d');
    const starc = photoCanvas(L, S, 0, 0, S.w, 900); starc.className = 'stc';
    const tx = starc.getContext('2d');
    let at = 0;
    function drawSquare(){
      const p = SPOTS[at], pts = p.q.map(([a, b]) => [p.x + a * p.s - QX0, p.y + b * p.s - QY0]);
      sx.clearRect(0, 0, QW, QH); sx.lineJoin = 'round'; sx.strokeStyle = '#fff'; sx.lineWidth = Math.max(1.2, p.s * .011);
      const path = () => { sx.beginPath(); pts.forEach(([a, b], i) => i ? sx.lineTo(a, b) : sx.moveTo(a, b)); sx.closePath(); };
      /* its glow, widest and faintest first (as the old drop shadows, in the photo's pixels) */
      for (const [c, b] of [['rgba(170,205,255,.55)', 40], ['rgba(214,232,255,.9)', 14], ['#fff', 3]]){ sx.shadowColor = c; sx.shadowBlur = b; path(); sx.stroke(); }
      sx.shadowBlur = 0; path(); sx.stroke();
    }
    function place(){
      const m = mapper(S), p = SPOTS[at];
      pool.setAttribute('href', IMG(p.glow));
      pool.setAttribute('x', m.x(GLOW[0]).toFixed(1)); pool.setAttribute('y', m.y(GLOW[1]).toFixed(1));
      pool.setAttribute('width', (GLOW[2] * m.k).toFixed(1)); pool.setAttribute('height', (GLOW[3] * m.k).toFixed(1));
    }
    onResize(place);
    drawSquare();
    /* the stars: each slowly brighter and dimmer (redrawn about 12 times a second, only with Animation on) */
    let raf = 0, last = 0;
    function stars0(now){
      tx.clearRect(0, 0, S.w, 900);
      const tt = now / 1000;
      for (const [x, y, r, d, T] of stars){
        const a = moving() ? .15 + .8 * (.5 + .5 * Math.sin((tt + d) / T * Math.PI * 2)) : .7;
        tx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; tx.beginPath(); tx.arc(x, y, r, 0, 7); tx.fill();
      }
    }
    function tick(now){
      raf = 0;
      if (now - last > 80){ last = now; stars0(now); }
      if (moving() && !document.hidden) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    kick();
    const mo = new MutationObserver(kick); mo.observe(root, { attributes:true, attributeFilter:['data-fx', 'data-motion'] });
    document.addEventListener('visibilitychange', kick);
    /* now and then: out with a glitch, back over the other dune */
    let t = 0;
    const cycle = () => {
      t = setTimeout(() => {
        if (!moving() || document.hidden){ cycle(); return; }
        g.classList.remove('come'); void g.getBoundingClientRect(); g.classList.add('go');
        t = setTimeout(() => {
          at = 1 - at; place(); drawSquare();
          g.classList.remove('go'); void g.getBoundingClientRect(); g.classList.add('come');
          cycle();
        }, 260 + 420);           // (a beat of nothing between)
      }, at === 0 ? 9000 : 6500);
    };
    cycle();
    later(() => { clearTimeout(t); cancelAnimationFrame(raf); mo.disconnect(); document.removeEventListener('visibilitychange', kick); });
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
    sway(L, S);
  }

  /* The branch hanging in at the left, and the bush along the crest behind it, moving a little in the wind (the owner,
     26 November 2026). Two layers made from the photograph: the branch cut out
     (wreck-brush) and the sand with it painted out (wreck-brush-bg; tools/surreal/brush.py). Each frame the branch is drawn bent by a pixel or
     two (most at its tip, from where it hangs off the left edge; the bush tops less), at the photograph's own resolution
     (photoCanvas), over the painted-out sand, which only ever shows in slivers. A slow sway (5.5 s) with gentler gusts;
     only with Animation on: otherwise the canvas is empty and the photograph shows the branch still. */
  const BRUSH = [0, 690, 280, 310];                      // its box in the photograph (keep in step with brush.py)
  function sway(L, S){
    const [X0, Y0, W, H] = BRUSH, cv = photoCanvas(L, S, X0, Y0, W, H), x = cv.getContext('2d');
    const load = n => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = IMG(n); });
    let raf = 0, last = 0, gone = false, P = null, B = null, out = null, act = null, amp = null, ph = null, vy = null;
    Promise.all([load('wreck-brush-bg'), load('wreck-brush')]).then(([bg, br]) => {
      if (gone) return;
      const t = document.createElement('canvas'); t.width = W; t.height = H; const tx = t.getContext('2d');
      tx.drawImage(bg, 0, 0); P = tx.getImageData(0, 0, W, H).data;
      tx.clearRect(0, 0, W, H); tx.drawImage(br, 0, 0); B = tx.getImageData(0, 0, W, H).data;
      out = x.createImageData(W, H);
      /* where it moves and how far: the hanging branch from its attachment (0, 155), the bush tops above the crest (row 105) */
      amp = new Float32Array(W * H); ph = new Float32Array(W * H); vy = new Float32Array(W * H);
      const list = [];
      for (let v = 0; v < H; v++) for (let u = 0; u < W; u++){
        const i = v * W + u;
        let near = false;
        for (let dv = -3; dv <= 3 && !near; dv++) for (let du = -3; du <= 3; du++){
          const uu = u + du, vv = v + dv; if (uu >= 0 && vv >= 0 && uu < W && vv < H && B[(vv * W + uu) * 4 + 3] > 10){ near = true; break; } }
        if (!near) continue;
        const reach = Math.min(1, Math.hypot(u, v - 155) / 260);
        amp[i] = v > 105 ? 1.7 * Math.pow(reach, 1.3) : 0.9 * Math.min(1, Math.max(0, (105 - v) / 70));
        vy[i] = v > 105 ? .25 : .08;
        ph[i] = u * .018 + v * .011;
        list.push(i);
      }
      act = Uint32Array.from(list);
      kick();
    }).catch(() => {});
    const W2 = Math.PI * 2 / 5.5;
    function draw(ts){
      const t = ts / 1000, gust = .6 + .4 * Math.pow(Math.sin(Math.PI * 2 * t / 23), 2), O = out.data;
      for (let n = 0; n < act.length; n++){
        const i = act[n], u = i % W, v = (i - u) / W;
        const d = amp[i] * gust * (.75 * Math.sin(W2 * t + ph[i]) + .25 * Math.sin(2.7 * W2 * t + u * .05));
        /* where this pixel's branch came from (bilinear), laid over the painted-out sand */
        const sx = u - d, sy = v - d * vy[i];
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, o = i * 4;
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0; k < 4; k++){
          const xx = x0 + (k & 1), yy = y0 + (k >> 1);
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const w = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy), j = (yy * W + xx) * 4, al = B[j + 3] * w;
          r += B[j] * al; g += B[j + 1] * al; b += B[j + 2] * al; a += al;
        }
        const A = Math.min(255, a) / 255, inv = 1 - A, nr = a > 0 ? 1 / a : 0;
        O[o] = P[o] * inv + r * nr * A; O[o + 1] = P[o + 1] * inv + g * nr * A; O[o + 2] = P[o + 2] * inv + b * nr * A; O[o + 3] = 255;
      }
      x.putImageData(out, 0, 0);
    }
    function tick(now){
      raf = 0;
      if (!act || gone) return;
      if (!moving() || document.hidden){ x.clearRect(0, 0, W, H); out.data.fill(0); return; }
      if (now - last > 50){ last = now; draw(now); }       // 20 a second is plenty for something this small and slow
      raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf && act) raf = requestAnimationFrame(tick); };
    const mo = new MutationObserver(kick); mo.observe(root, { attributes:true, attributeFilter:['data-fx', 'data-motion'] });
    document.addEventListener('visibilitychange', kick);
    later(() => { gone = true; cancelAnimationFrame(raf); mo.disconnect(); document.removeEventListener('visibilitychange', kick); });
  }

  /* A canvas at the photograph's own resolution over part of it, laid on its pixel grid and enlarged with it (like the
     sphere), so what's drawn there is no sharper than the photo and its pixels line up with the photo's. */
  function photoCanvas(L, S, X0, Y0, W, H){
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.style.position = 'absolute'; L.appendChild(c);
    onResize(() => { const m = mapper(S);
      Object.assign(c.style, { left:m.x(X0) + 'px', top:m.y(Y0) + 'px', width:W * m.k + 'px', height:H * m.k + 'px' }); });
    return c;
  }

  /* ── Games and Mahjong: the slice through the butte (its notch, rubble and the crack across the plain are all in the
        picture). Now and then a few small rocks break off the far wall's top edge and tumble down its face, as slowly as
        they would from that far away: lit on one side, turning as they go, knocking off ledges with a little spray of
        dust, a faint trail of it behind them, until the near side's slopes hide them; a few seconds later a little dust
        comes up out of the cut. And sometimes a few birds cross the sky, far off. All drawn at the photograph's own
        resolution (photoCanvas), and kept very small and quiet (the owner, 26 November 2026). ── */
  function slot(){
    const S = SCENE.slot, L = stage('suslot');
    const xs = S.open.map(p => p[0]), ys = S.open.map(p => p[1]);
    const X0 = Math.floor(Math.min(...xs)) - 2, Y0 = Math.floor(Math.min(...ys)) - 2;
    const CW = Math.ceil(Math.max(...xs)) + 2 - X0, CH = Math.ceil(Math.max(...ys)) + 2 - Y0;
    const cv = photoCanvas(L, S, X0, Y0, CW, CH), x = cv.getContext('2d');
    const BW = S.w, BH = 330, bcv = photoCanvas(L, S, 0, 0, BW, BH), bx = bcv.getContext('2d');      // the sky, for the birds
    const G = 9.8 * S.pxm;                               // gravity in image px per second squared
    const R = Math.random;
    let rocks = [], bits = [], puffs = [], birds = [], raf = 0, t = 0, last = 0;
    const inside = (px, py) => {                          // inside the cut's outline (photo px)
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
    /* a rock: an irregular little polygon, lit from the upper left like the butte */
    const shape = () => { const n = 4 + Math.floor(R() * 3);
      return Array.from({ length:n }, (_, i) => { const a = i / n * Math.PI * 2 + R() * .5, d = .65 + R() * .45; return [Math.cos(a) * d, Math.sin(a) * d]; }); };
    const kick = () => { if (!raf){ last = 0; raf = requestAnimationFrame(frame); } };
    function fall(){
      if (!moving() || document.hidden) return;
      const n = 1 + Math.floor(R() * 3);
      let a = R() * edge, i = 0;
      while (i < segs.length - 1 && a > segs[i]){ a -= segs[i]; i++; }
      const k = a / segs[i], xa = S.lip[i][0] + (S.lip[i + 1][0] - S.lip[i][0]) * k, ya = S.lip[i][1] + (S.lip[i + 1][1] - S.lip[i][1]) * k;
      for (let j = 0; j < n; j++)
        rocks.push({ x:xa + (R() - .5) * 4, y:ya + 1 + R() * 2, vx:(R() - .5) * 1.2, vy:0, t0:t + j * (.2 + R() * .6), r:.7 + R() * 1.3,
                     rot:R() * 6.3, spin:(R() - .5) * 5, poly:shape(), nextHit:ya + 20 + R() * 60, trail:0, gone:false });
      kick();
    }
    const spray = (px, py, n, sp) => { for (let i = 0; i < n; i++){ const a = -Math.PI * (.15 + R() * .7);
      bits.push({ x:px, y:py, vx:Math.cos(a) * sp * (.4 + R()) * (R() < .5 ? -1 : 1), vy:Math.sin(a) * sp * (.4 + R()), life:1.2 + R() * 1.6, age:0, s:.35 + R() * .5, a:.22 + R() * .2 }); } };
    function birdsGo(){
      if (!moving() || document.hidden) return;
      const n = 2 + Math.floor(R() * 4), dir = R() < .5 ? 1 : -1, y = 40 + R() * 170, sp = 16 + R() * 14;
      for (let i = 0; i < n; i++)
        birds.push({ x:dir > 0 ? -10 - i * (6 + R() * 8) : BW + 10 + i * (6 + R() * 8), y:y + (R() - .5) * 14, vx:dir * sp * (.92 + R() * .16),
                     ph:R() * 6.3, f:3 + R() * 1.2, span:2.4 + R() * 1.6, bob:R() * 6.3 });
      kick();
    }
    function frame(now){
      raf = 0;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      /* ── the rocks and their dust, in the cut ── */
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, CW, CH);
      x.save(); x.beginPath(); S.open.forEach(([a, b], i) => i ? x.lineTo(a - X0, b - Y0) : x.moveTo(a - X0, b - Y0)); x.closePath(); x.clip();
      for (const p of puffs){                              // the dust coming up out of the cut: fine specks, very faint
        p.age += dt; if (p.age < 0) continue;
        for (const q of p.q){ q.x += (q.vx + 1.2) * dt; q.y += q.vy * dt; q.vy *= .985;
          const al = q.a * Math.min(1, p.age * 1.2) * Math.max(0, 1 - p.age / p.life);
          x.fillStyle = 'rgba(176,166,156,' + al.toFixed(3) + ')'; x.fillRect(q.x - X0, q.y - Y0, q.s, q.s); }
      }
      for (const b of bits){                               // sprays and trails: drag, a little gravity
        b.age += dt; b.vx *= .94; b.vy = b.vy * .94 + G * .15 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        const al = b.a * Math.max(0, 1 - b.age / b.life);
        x.fillStyle = 'rgba(184,170,156,' + al.toFixed(3) + ')'; x.fillRect(b.x - X0, b.y - Y0, b.s, b.s);
      }
      for (const r of rocks){
        if (t < r.t0 || r.gone) continue;
        r.vy += G * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
        /* a ledge: knocked off it, a little spray, turning faster */
        if (r.y > r.nextHit){ r.vy *= -.22; r.vx = (R() - .5) * 5; r.spin = (R() - .5) * 9; r.nextHit = r.y + 30 + R() * 90; spray(r.x, r.y, 4 + Math.floor(R() * 5), 5 + R() * 4); }
        if ((r.trail += dt) > .12){ r.trail = 0; bits.push({ x:r.x, y:r.y, vx:(R() - .5) * .8, vy:-.5 - R(), life:1.6 + R() * 1.6, age:0, s:.4, a:.12 }); }
        /* gone behind the near side: some time later, its dust comes up from about there */
        if (t - r.t0 > .4 && !inside(r.x, r.y)){
          r.gone = true;
          puffs.push({ age:-(1.5 + R() * 2), life:8 + R() * 3, q:Array.from({ length:26 + Math.floor(r.r * 12) }, () => ({
            x:r.x + (R() - .5) * 6, y:r.y - 3 + (R() - .5) * 4, vx:(R() - .5) * 2.4, vy:-(2 + R() * 4.5), s:.45 + R() * .6, a:.10 + R() * .1 })) });
          continue;
        }
        const c = Math.cos(r.rot), sn = Math.sin(r.rot), px = r.x - X0, py = r.y - Y0;
        x.beginPath();
        r.poly.forEach(([u, v], i) => { const qx = px + (u * c - v * sn) * r.r, qy = py + (u * sn + v * c) * r.r; if (i) x.lineTo(qx, qy); else x.moveTo(qx, qy); });
        x.closePath();
        const g = x.createLinearGradient(px - r.r, py - r.r, px + r.r, py + r.r);
        g.addColorStop(0, 'rgba(178,158,138,.95)'); g.addColorStop(1, 'rgba(78,64,56,.95)');
        x.fillStyle = g; x.fill();
      }
      x.restore();
      rocks = rocks.filter(r => !r.gone); bits = bits.filter(b => b.age < b.life); puffs = puffs.filter(p => p.age < p.life);
      /* ── the birds, far off: a small dark V each, wings beating ── */
      bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, BW, BH);
      bx.strokeStyle = 'rgba(42,42,50,.72)'; bx.lineWidth = .7; bx.lineCap = 'round';
      for (const b of birds){
        b.x += b.vx * dt; b.ph += b.f * 6.283 * dt; b.bob += .8 * dt;
        const w = Math.sin(b.ph), yy = b.y + Math.sin(b.bob) * 1.4, tip = w * b.span * .55;
        bx.beginPath(); bx.moveTo(b.x - b.span, yy - tip); bx.lineTo(b.x, yy + .4); bx.lineTo(b.x + b.span, yy - tip); bx.stroke();
      }
      birds = birds.filter(b => b.x > -60 && b.x < BW + 60);
      if (rocks.length || bits.length || puffs.length || birds.length) raf = requestAnimationFrame(frame);
      else { x.clearRect(0, 0, CW, CH); bx.clearRect(0, 0, BW, BH); }
    }
    let tm = 0, tb = 0;
    const next = () => { tm = setTimeout(() => { fall(); next(); }, 9000 + R() * 16000); };
    const nextBirds = () => { tb = setTimeout(() => { birdsGo(); nextBirds(); }, 25000 + R() * 45000); };
    tm = setTimeout(() => { fall(); next(); }, 2500);
    tb = setTimeout(() => { birdsGo(); nextBirds(); }, 6000 + R() * 8000);
    window.__suslot = { fall, birdsGo, state:() => ({ rocks:rocks.map(r => [Math.round(r.x), Math.round(r.y), +r.r.toFixed(1)]), bits:bits.length, puffs:puffs.length, birds:birds.map(b => [Math.round(b.x), Math.round(b.y)]) }) };   // (for testing)
    later(() => { clearTimeout(tm); clearTimeout(tb); cancelAnimationFrame(raf); delete window.__suslot; });
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
          v.innerHTML = '<source src="/images/surreal/surf.webm' + VQ() + '" type="video/webm"><source src="/images/surreal/surf.mp4' + VQ() + '" type="video/mp4">'; v.load(); }
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

  /* the place on now (theme.js surScene puts it on the page as data-su), and its live things */
  const pg = () => root.getAttribute('data-pg') || 'home';
  const sceneNow = () => root.getAttribute('data-su') || sceneOf(pg());
  function runScene(){
    bin = sceneUndo;
    try { const run = { home, tt:light, wreck, slot, surf }[sceneNow()]; if (run) run(); }   // (the planners' gateways are all in the picture)
    finally { bin = undo; }
  }

  /* ── the gallery (the owner, 26 November 2026): the six places are slides that something is studying. Each page has its
        own, and they all move on at midnight; the buttons at the left edge (up, three dots, down) slide this page's on or
        back for the rest of the day. The place going and the one coming slide together, slowly, the way the chevron
        points (with Animation off they just change). ── */
  const SC = { home:['home', '94% 34%', '#9cc3e6'], tt:['tt', '50% 62%', '#0c1426'], plan:['plan', '70% 62%', '#b9bfdc'],
               slot:['slot', '50% 16%', '#b9c4d8'], surf:['surf', '88% 30%', '#8fb0cf'], wreck:['wreck', '80% 52%', '#8d93ad'] };   // (as surreal.css)
  let sliding = false;
  function swapTo(next, up){
    const cur = sceneNow();
    if (!next || !SC[next] || next === cur || sliding) return;
    if (!moving() || document.hidden){ stopScene(); root.setAttribute('data-su', next); runScene(); return; }
    sliding = true;
    const upright = matchMedia('(max-aspect-ratio:4/5)').matches;
    const bg = k => { const c = SC[k]; return { img:IMG(c[0] + (upright ? '-p' : '')), pos:upright ? '50% 50%' : c[1], fill:c[2] }; };
    const a = bg(cur), b = bg(next), pre = new Image();
    const go = () => {
      stopScene();                                              // the live things go first
      const L = document.createElement('div');
      L.className = 'suslide'; L.setAttribute('aria-hidden', 'true');
      const pane = (x, y) => '<div style="background-image:url(' + x.img + ');background-position:' + x.pos + ';background-color:' + x.fill + ';transform:translateY(' + y + '%)"></div>';
      L.innerHTML = pane(a, 0) + pane(b, up ? 100 : -100);
      document.body.appendChild(L);
      root.setAttribute('data-su', next);                       // (underneath, and the page's glass with it)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        L.children[0].style.transform = 'translateY(' + (up ? -100 : 100) + '%)'; L.children[1].style.transform = 'translateY(0)'; }));
      setTimeout(() => { L.remove(); runScene(); sliding = false; }, 1150);
    };
    pre.src = b.img;
    if (pre.decode) pre.decode().then(go, go); else { pre.onload = pre.onerror = go; }
  }
  function gallery(){
    const G = document.createElement('div');
    G.className = 'sugal'; G.setAttribute('role', 'group'); G.setAttribute('aria-label', 'Backgrounds');
    const chev = up => '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + (up ? 'M3.5 10 8 5.5l4.5 4.5' : 'M3.5 6 8 10.5 12.5 6') + '"/></svg>';
    G.innerHTML = '<button type="button" data-d="1" title="Next background" aria-label="Next background">' + chev(true) + '</button>' +
      '<i></i><i></i><i></i><button type="button" data-d="-1" title="Previous background" aria-label="Previous background">' + chev(false) + '</button>';
    G.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (sliding || !window.TT || !TT.surShift) return;
      const d = +b.dataset.d; swapTo(TT.surShift(pg(), d), d > 0);
    });
    document.body.appendChild(G);
    later(() => G.remove());
    /* only where there's room beside the page, so it never sits over anything */
    onResize(() => { const w = document.querySelector('.wrap'); G.hidden = !w || w.getBoundingClientRect().left < 56; });
    /* midnight: every page moves on to its next place */
    let t = 0;
    const midnight = () => { const d = new Date(), n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 3);
      t = setTimeout(() => { if (window.TT && TT.surScene) swapTo(TT.surScene(pg()), true); midnight(); }, n - d); };
    midnight();
    later(() => clearTimeout(t));
  }

  function start(){
    live = true;
    notation();
    if (pg() === 'hkmahjong') return;
    gallery();
    runScene();
  }
  function look(){
    if (on() && !live) start();
    else if (!on() && live) off();
  }
  function go(){ addEventListener('tt:look', look); look(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
})();
