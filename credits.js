/* ═══════════════════════════════════════════════════════════════════
   Credits (Home's footer → a full-screen overlay).

   "Made by" in the middle; the two names go round it on an ellipse,
   opposite each other and always the same size (equal parts), each with a
   faint trail in the page's text colour. Behind: the frosted page, a few
   stars drifting up and the orbit drawn as a faint track. Clean on purpose:
   no coloured glows. The names spiral out from the middle when it opens.
   Tap a name for a burst of sparks; moving the mouse tilts the scene a
   little. Click anywhere else, the ×, or Esc to close.

   The names come from the server (GET /api/forum?credits=1) and only for
   someone signed in, so they aren't in any page's source. Reduced motion:
   everything still, names to the left and right of "Made by".
   ═══════════════════════════════════════════════════════════════════ */
(function(){
"use strict";
/* opened by Credits.open() (Home: "MSC Unofficial" tapped three times), or a #creditsbtn if a page has one */
const dlg = document.getElementById('credits'), btn = document.getElementById('creditsbtn');
if (!dlg) return;
const stage = document.getElementById('crstage'), wait = document.getElementById('crwait'), by = document.getElementById('crby');
const sky = document.getElementById('crsky'), ctx = sky.getContext('2d');
const signedIn = !!(window.TT && TT.signedIn && TT.signedIn());
const still = () => document.documentElement.getAttribute('data-motion') === 'reduced' ||
  (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const TURN = 26000;                         // ms for one lap
const rand = (a, b) => a + Math.random() * (b - a);
const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

let names = null, els = [], raf = 0, opened = 0, W = 0, H = 0, dpr = 1;
let stars = [], sparks = [], trails = [[], []], hues = ['#4f4fd0', '#d6409f'], dark = false;
let px = 0, py = 0, tx = 0, ty = 0, lastSparkle = 0, lastBurst = 0, clue = null, lastClue = 0;
let closingAt = 0;                        // when closing began (the opening, played backwards)
const CLOSE_MS = 900;

/* "Made by", a letter at a time */
by.innerHTML = [...'Made by'].map((c, i) => '<span style="animation-delay:' + (120 + i * 45) + 'ms">' + (c === ' ' ? '&nbsp;' : c) + '</span>').join('');

/* the theme's accent, and a second colour from it (turned round the wheel) */
function colours(){
  const cs = getComputedStyle(document.documentElement);
  ctx.fillStyle = cs.getPropertyValue('--accent').trim() || '#4f4fd0';
  const a = ctx.fillStyle;                                   // normalised to #rrggbb
  const n = parseInt(a.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  if (d){ const R = r / 255, G = g / 255, B = b / 255;
    h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h *= 60; }
  /* one colour for both: the page's text colour (clean, and the same for each name) */
  ctx.fillStyle = cs.getPropertyValue('--text').trim() || '#fff';
  hues = [ctx.fillStyle, ctx.fillStyle];
  dark = document.documentElement.getAttribute('data-mode') === 'dark';
  dlg.style.setProperty('--cr1', hues[0]); dlg.style.setProperty('--cr2', hues[1]);
}

function size(){
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = dlg.clientWidth; H = dlg.clientHeight;
  sky.width = Math.round(W * dpr); sky.height = Math.round(H * dpr);
  sky.style.width = W + 'px'; sky.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round(Math.min(90, W * H / 14000));
  stars = Array.from({ length:n }, () => ({ x:rand(0, W), y:rand(0, H), r:rand(.5, 1.8), ph:rand(0, 6.28), sp:rand(.6, 1.8), vy:rand(4, 14) }));
}

/* the orbit, sized so a name never goes off the edge */
function orbit(){
  const widest = Math.max(0, ...els.map(n => n.offsetWidth));
  return { rx:Math.max(60, Math.min(W * 0.34, 260, W / 2 - widest / 2 - 16)), ry:Math.min(H * 0.21, 130) };
}

function burst(x, y, k, many){
  for (let i = 0; i < (many || 22); i++){
    const a = rand(0, 6.28), v = rand(40, 190);
    sparks.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 30, life:1, decay:rand(.7, 1.3), r:rand(1.2, 2.8), c:hues[k % 2] });
  }
}

function frame(now){
  raf = 0;
  if (!dlg.open) return;
  const t = now - opened, calm = still();
  let e = calm ? 1 : ease(t / 1500);
  /* closing: the same spiral in reverse, slow at first then quicker into the middle */
  const shut = closingAt ? Math.min(1, (now - closingAt) / CLOSE_MS) : 0;
  if (closingAt) e = Math.min(e, 1 - Math.pow(shut, 2.2));
  /* the scene leans towards the pointer a little */
  px += (tx - px) * .06; py += (ty - py) * .06;
  const cx = W / 2 + px, cy = H / 2 + py;
  const { rx, ry } = orbit();
  const turn = calm ? 0 : (t / TURN) * Math.PI * 2 - (1 - e) * Math.PI * 1.4;   // spirals out, then goes round

  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  /* stars */
  for (const s of stars){
    if (!calm){ s.y -= s.vy / 60; if (s.y < -4){ s.y = H + 4; s.x = rand(0, W); } }
    const a = (calm ? .35 : .18 + .45 * (0.5 + 0.5 * Math.sin(now / 1000 * s.sp + s.ph))) * (1 - shut);
    ctx.fillStyle = dark ? 'rgba(255,255,255,' + a + ')' : 'rgba(40,40,80,' + a * .55 + ')';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
  }
  /* the track */
  if (els.length){
    ctx.save(); ctx.setLineDash([2, 9]); ctx.lineDashOffset = -now / 60; ctx.lineWidth = 1.2;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,' + .16 * e + ')' : 'rgba(30,30,60,' + .14 * e + ')';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * e, ry * e, 0, 0, 6.283); ctx.stroke(); ctx.restore();
  }
  /* the names, and their comets */
  els.forEach((n, i) => {
    const a = turn + i * Math.PI, x = cx + Math.cos(a) * rx * e, y = cy + Math.sin(a) * ry * e;
    n.style.transform = 'translate(-50%,-50%) translate(' + (x - W / 2).toFixed(1) + 'px,' + (y - H / 2).toFixed(1) + 'px)';
    n.style.opacity = e.toFixed(3);
    n.style.filter = e < 1 ? 'blur(' + ((1 - e) * 8).toFixed(1) + 'px)' : '';
    if (calm) return;
    /* the comet: where it's been over the last few seconds, drawn only once it's
       clear of the name, so it streams out from behind it */
    const tr = trails[i]; tr.unshift({ x, y, t:now });
    while (tr.length && now - tr[tr.length - 1].t > 3200) tr.pop();
    const clear = n.offsetWidth / 2 + 6, room = n.offsetHeight / 2 + 4;
    for (let j = 1; j < tr.length; j++){
      const dx = tr[j].x - x, dy = tr[j].y - y;
      if (Math.abs(dx) < clear && Math.abs(dy) < room) continue;
      const k = 1 - (now - tr[j].t) / 3200;
      ctx.globalAlpha = Math.max(0, k) * (dark ? .32 : .26) * e; ctx.fillStyle = hues[i % 2];
      ctx.beginPath(); ctx.arc(tr[j].x, tr[j].y, 1.2 + k * 4.5, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  /* now and then, both at once */
  if (!calm && els.length && t > 1700 && now - lastBurst > 6500){
    lastBurst = now;
    els.forEach((n, i) => { const a = turn + i * Math.PI; burst(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, i, 14); });
  }
  /* now and then, for whoever's still watching, a word among the stars, barely there */
  if (!calm && els.length && t > 14000 && !clue && now - lastClue > 28000){
    for (let k = 0; k < 12 && !clue; k++){
      const x = rand(W * .08, W * .92), y = rand(H * .1, H * .9);
      if (Math.abs(x - cx) > rx + 90 || Math.abs(y - cy) > ry + 50) clue = { x, y, t0:now };
    }
    lastClue = now;
  }
  if (clue){
    const k = (now - clue.t0) / 3600;
    if (k >= 1) clue = null;
    else {
      ctx.globalAlpha = Math.sin(Math.PI * k) * (dark ? .32 : .26);
      ctx.fillStyle = dark ? '#fff' : '#222'; ctx.font = '11px ui-monospace,Menlo,Consolas,monospace';
      ctx.fillText('/vault', clue.x, clue.y); ctx.globalAlpha = 1;
    }
  }
  /* sparks */
  for (let i = sparks.length - 1; i >= 0; i--){
    const s = sparks[i];
    s.x += s.vx / 60; s.y += s.vy / 60; s.vy += 140 / 60; s.vx *= .985; s.life -= s.decay / 60;
    if (s.life <= 0){ sparks.splice(i, 1); continue; }
    ctx.globalAlpha = s.life; ctx.fillStyle = s.c;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.6 + s.life * .4), 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (!calm) raf = requestAnimationFrame(frame);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

function showNames(list){
  els.forEach(n => n.remove()); els = []; trails = [[], []];
  wait.textContent = '';
  list.forEach((nm, i) => {
    const s = document.createElement('span');
    s.className = 'crname'; s.textContent = nm;
    s.onclick = ev => { ev.stopPropagation(); if (closingAt) return; const r = s.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, i, 34);
      s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); kick(); };
    stage.appendChild(s); els.push(s);
  });
  dlg.setAttribute('aria-label', 'Credits: made by ' + list.join(' and ') + '. Not run by the school or the Department.');
  opened = performance.now();
  kick();
}

async function open(){
  if (dlg.open) return;
  if (window.Icon) Icon.fill(dlg);
  dlg.showModal();
  colours(); size();
  px = py = tx = ty = 0; sparks = []; clue = null; lastBurst = lastClue = performance.now();
  opened = performance.now();
  dlg.classList.remove('in'); void dlg.offsetWidth; dlg.classList.add('in');
  kick();
  if (!signedIn){ els.forEach(n => n.remove()); els = []; wait.innerHTML = 'Sign in to see who made this.<a class="btn primary" href="./">Sign in</a>'; return; }
  if (names){ showNames(names); return; }
  wait.innerHTML = '<span class="crspin" aria-hidden="true"></span>';
  try { const d = await TT.api('/api/forum', { params:{ credits:1 } }); names = (d && d.by) || []; if (dlg.open) showNames(names); }
  catch (e){ wait.textContent = 'Couldn’t load the credits.'; }
}
window.Credits = { open };
if (btn) btn.onclick = open;
/* closing fades it (and the frosted backdrop) out rather than snapping shut */
let closing = 0;
const finish = () => {
  clearTimeout(closing); closing = 0; closingAt = 0;
  dlg.classList.remove('out', 'closing');
  [...by.children].forEach((sp, i) => sp.style.animationDelay = (120 + i * 45) + 'ms');   // ready to open again
  cancelAnimationFrame(raf); raf = 0; if (dlg.open) dlg.close();
};
const close = () => {
  if (!dlg.open || closing) return;
  if (still()) return finish();
  closingAt = performance.now();
  /* "Made by" lets go of its letters from the end back */
  const ls = [...by.children]; ls.forEach((sp, i) => sp.style.animationDelay = ((ls.length - 1 - i) * 35) + 'ms');
  dlg.classList.add('closing');
  sparks = []; kick();
  closing = setTimeout(() => { dlg.classList.add('out'); closing = setTimeout(finish, 380); }, CLOSE_MS - 280);
};
dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });      // Esc: the same fade
document.getElementById('crx').onclick = e => { e.stopPropagation(); close(); };
dlg.addEventListener('click', e => { if (!e.target.closest('a, .crname, .crx')) close(); });
dlg.addEventListener('close', () => { if (!dlg.open){ cancelAnimationFrame(raf); raf = 0; } });   // (not if it was opened again straight away)
dlg.addEventListener('pointermove', e => {
  if (still() || closingAt) return;
  tx = (e.clientX - W / 2) / (W / 2) * -12; ty = (e.clientY - H / 2) / (H / 2) * -8;
  const now = performance.now();
  if (e.pointerType === 'mouse' && now - lastSparkle > 45){
    lastSparkle = now;
    sparks.push({ x:e.clientX, y:e.clientY, vx:rand(-20, 20), vy:rand(-30, 5), life:.8, decay:1.4, r:rand(.8, 1.8), c:hues[Math.random() < .5 ? 0 : 1] });
  }
});
addEventListener('resize', () => { if (dlg.open){ size(); kick(); } });
})();
