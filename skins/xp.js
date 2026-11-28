/* Windows XP: its own script (theme.js skinJs), for what the stylesheet can't do. Loaded once, the first time the theme is
   on; it watches html[data-skin] (tt:look) and takes everything of its own away again when another theme is picked.
   - The desktop is one page: Home, at the top of the tab. Every other page opens on it as a window holding a frame of that
     page (the owner's "option A", 27 November 2026; before, the browser went to the page, and Home's windows went with it).
     The desktop, Home's own windows and the other windows all stay where they are, whatever opened the page: the desktop's
     icons, Home's tiles and links, the Start menu's All Programs, a window's Favorites or Address bar, or a link inside
     another window. At most six windows (four on a phone or a tablet): past that, the one minimised longest ago closes
     (else the one used longest ago). A minimised window isn't drawn, and its page's animations wait until it is back.
   - A page opened on its own (its address typed, a bookmark, a new tab) goes to the desktop and opens there as a window.
     The windows open in this tab are kept in sessionStorage (msc.xpopen), so a reload brings them back; a minimised one's
     page loads when it is first brought up.
   - A page in a window's frame (html.xpframed) shows only its own content: no wallpaper, taskbar or title bar of its own.
   - A window: its title bar (dragged with a mouse or a pen; a double-click maximises), the caption buttons (minimise,
     maximise, remembered in msc.xpmax, close), its right and bottom edges to resize, a menu bar (File, View, Favorites,
     Tools, Help, each doing something real), on the pages other than the timetable Explorer's Back / Forward / Up and
     Address bar, and XP's small title-bar zoom as it opens, minimises and comes back. On a phone or a tablet a window fills
     the screen above the taskbar, one at a time.
   - The taskbar: Quick Launch's Desktop (every window away, and back), a button for each window (it brings the window up,
     puts it away, or brings it to the front; a right click can close it), the clock, XP's yellow tooltips. The Start menu
     gets the name banner and All Programs; a click outside closes it; Ctrl+Esc opens it, from inside a window too. A right
     click on the desktop gives XP's desktop menu, and pages are fetched ahead when an icon is pointed at.
   - Home's own windows (MSC Unofficial, the poll, today's games, the forum), on a computer with a mouse, are dragged,
     raised and minimised the same way, among the pages' windows; where they are is remembered on this device (msc.xpwin).
   - In someone else's frame (the Theme finder's preview) a page is still one window on a desktop of its own, as it was
     before, and its links go where they always went.
   Nothing here is needed to use a page; keyboard and screen reader use stays the page's own. */
(() => {
'use strict';
const D = document, R = D.documentElement;
const WINKEY = 'msc.xpwin', MAXKEY = 'msc.xpmax', FROMKEY = 'msc.xpfrom', OPENKEY = 'msc.xpopen', HELPKEY = 'msc.xphelp';
const WM_Q = '(min-width:1000px) and (hover:hover) and (pointer:fine)';
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ssGet = (k, d) => { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const ssSet = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };
const pg = () => R.dataset.pg || '';
const want = () => R.dataset.skin === 'xp' && pg() !== 'hkmahjong' && !!D.body;
/* the taskbar's height, from the stylesheet (--xp-tbh) */
const tbh = () => parseFloat(getComputedStyle(R).getPropertyValue('--xp-tbh')) || 38;
/* moving things only with Animation on, and never with Reduce motion or the device asking for less */
const moving = () => R.dataset.fx === 'on' && R.dataset.motion !== 'reduced' && !(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const mouseish = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let live = null;

/* ── where this page is: the top of the tab, a window's frame on an XP desktop, or someone else's frame ── */
const TOP = (() => { try { return window.top === window; } catch { return false; } })();
/* the desktop this page is a window of (its handle), or null: only a frame the desktop made (iframe.xpframe), same site */
function deskOf(){
  try { const f = window.frameElement, d = f && f.classList.contains('xpframe') && parent.__xpDesk; return d && d.live() ? d : null; }
  catch { return null; }
}
/* the pages that open as windows: every page at the top of the site (the timetable at "/", any name.html), so a page added
   later opens as one by itself, but these: Home (the desktop itself), Hong Kong Mahjong (no XP: a game of its own), the vault
   (its own thing), and the pages without the site's theme (index2, the q code page, 404). Anything else (/beta/, /api/, an
   address with no .html) goes in the whole tab, as before. */
const NOWIN = ['home', 'hkmahjong', 'vault', 'index2', 'q', '404'];
const NAMES = { notes:'Notes', finder:'Student finder', tas:'TAS' };
/* a page's name from its address, as theme.js names it (html[data-pg]) */
const pageOf = u => { let f = u.pathname.split('/').pop().replace(/\.html$/, ''); if (!f || f === 'index') f = 'timetable'; if (f === 'poll') f = 'home'; return f; };
const winPg = p => !!p && !NOWIN.includes(p);
const winPage = u => u.origin === location.origin && /^\/(?:[\w-]+\.html)?$/.test(u.pathname) && winPg(pageOf(u));
/* an address as a window keeps it: relative to the site's root ("./" for the timetable) */
const relHref = u => (u.pathname.replace(/^\//, '') || './') + u.search + u.hash;
/* where a link goes, from here: null (a place on this page, or not a page), 'home', 'here' (this page at another address),
   'win' (another of the site's pages: a window of its own) or 'out' (anywhere else) */
function where(href){
  let u; try { u = new URL(href, D.baseURI); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (u.origin !== location.origin) return { to:'out', u };
  if (u.pathname === location.pathname && u.search === location.search && u.hash) return null;
  const p = /^\/(?:[\w-]+(?:\.html)?)?$/.test(u.pathname) ? pageOf(u) : '';
  if (p === 'home') return { to:'home', u };
  if (p && p === pg()) return { to:'here', u };
  if (winPage(u)) return { to:'win', u, pg:p };
  return { to:'out', u };
}
/* the link a plain click is following (not one the page has dealt with, not to a new tab or a download) */
function linkOf(e){
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a || (a.getAttribute('target') && a.getAttribute('target') !== '_self') || a.hasAttribute('download')) return null;
  return a;
}

function look(){
  if (!live && toDesk()) return;
  if (D.readyState === 'loading') return;
  if (want()){ if (!live) start(); else live.refresh(); }
  else if (live) stop();
}

function stop(){ closeMenu(); hideTip(); const l = live; live = null; if (l) for (let i = l.off.length - 1; i >= 0; i--) try { l.off[i](); } catch {} }

/* ── a page opened on its own, at the top of the tab: it goes to the desktop (Home), where it opens as a window, the one in
      front. Only if this tab can keep the list of windows (sessionStorage); else the page stays as it is. ── */
let going = false;
function toDesk(){
  if (going) return true;
  if (R.dataset.skin !== 'xp' || !TOP || !winPg(pg())) return false;
  const u = new URL(location.href), t = Date.now();
  const a = opened().filter(w => w.pg !== pg());
  a.push({ v:2, pg:pg(), href:relHref(u), label:labelOf(pg()), t });
  ssSet(OPENKEY, a);
  if (!opened().some(w => w.pg === pg() && w.t === t)) return false;
  going = true;
  R.classList.add('xppagemin');                 // (the window goes out of sight first, so fx.js doesn't shrink it into the taskbar)
  location.replace('home.html');
  return true;
}

/* ── the caption buttons: real buttons, in the title bar ── */
function caption(kinds){
  const c = D.createElement('span'); c.className = 'xpcap';
  const L = { min:'Minimise', max:'Maximise', close:'Close' };
  kinds.forEach(k => {
    const b = D.createElement('button'); b.type = 'button'; b.className = k === 'close' ? 'xpx' : 'xp' + k;
    b.dataset.cap = k; b.dataset.xptip = L[k]; b.setAttribute('aria-label', L[k]);
    if (k === 'max') b.setAttribute('aria-pressed', 'false');
    c.appendChild(b);
  });
  return c;
}
function setMaxBtn(b, on){ if (!b) return; b.setAttribute('aria-pressed', String(on)); b.dataset.xptip = on ? 'Restore' : 'Maximise'; b.setAttribute('aria-label', b.dataset.xptip); }

/* who is signed in, for the Start menu's banner */
function who(){
  try {
    const T = window.TT, g = (k, d) => T && T.get ? T.get(k, d) : lsGet(k, d);
    const cr = g('tt.creds', null), c = g('tt.cache', null);
    if (!cr || !cr.email) return 'Guest';
    const p = c && c.email === cr.email && c.payload && c.payload.profile;
    const n = p ? [p.firstname, p.lastname].filter(Boolean).join(' ').trim() : '';
    return n || String(cr.email).split('@')[0];
  } catch { return 'Guest'; }
}

/* ── XP's window animation: a title bar flying from one place to another (opening, minimising, restoring).
      Small (a title bar's height) and quick; never with motion off. ── */
const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x:r.left, y:r.top, w:r.width, h:r.height } : null; };
function zoom(from, to, ms, done){
  let fin = false;
  const z = D.createElement('div'); z.className = 'xpzoom'; z.setAttribute('aria-hidden', 'true');
  const end = () => { if (fin) return; fin = true; z.remove(); if (done) done(); };
  if (!from || !to || !moving() || !z.animate){ fin = true; if (done) done(); return; }
  const H = 30, top = r => Math.max(0, Math.min(r.y, innerHeight - H));
  const k = (r, h) => ({ left:r.x + 'px', top:top(r) + 'px', width:Math.max(24, r.w) + 'px', height:h + 'px' });
  D.body.appendChild(z);
  const a = z.animate([k(from, Math.min(H, from.h)), k(to, H)], { duration:ms, easing:'cubic-bezier(.25,.6,.35,1)', fill:'forwards' });
  a.onfinish = end; a.oncancel = end;
  setTimeout(end, ms + 250);
}
/* what was clicked to open the next page (or window), for its opening */
function remember(el){ const r = box(el); if (r) ssSet(FROMKEY, Object.assign(r, { t:Date.now() })); }
function recalled(){ const s = ssGet(FROMKEY, null); ssSet(FROMKEY, null); return s && Date.now() - s.t < 6000 ? s : null; }

/* ── a menu (the menu bar's, a right click's, a taskbar button's, All Programs): made when it opens, gone when
      it closes. Arrow keys, Home / End, Enter, Escape (back to what opened it), Tab, a click outside. ── */
let menuNow = null;
function closeMenu(back){
  const m = menuNow; if (!m) return; menuNow = null;
  m.el.remove(); m.cleanup();
  if (m.opener){ m.opener.setAttribute('aria-expanded', 'false'); m.opener.classList.remove('xpopen'); if (back) m.opener.focus(); }
}
function openMenu(items, at, o){
  o = o || {}; closeMenu();
  const el = D.createElement('div'); el.className = 'xpmenu' + (o.cls ? ' ' + o.cls : ''); el.setAttribute('role', 'menu');
  if (o.label) el.setAttribute('aria-label', o.label);
  items.forEach(it => {
    if (!it) return;
    if (it.sep){ const s = D.createElement('div'); s.className = 'xpsep'; s.setAttribute('role', 'separator'); el.appendChild(s); return; }
    const b = D.createElement(it.href ? 'a' : 'button');
    if (it.href) b.href = it.href; else b.type = 'button';
    b.className = 'xpmi' + (it.cls ? ' ' + it.cls : ''); b.tabIndex = -1;
    b.setAttribute('role', it.check != null ? 'menuitemcheckbox' : 'menuitem');
    if (it.check != null) b.setAttribute('aria-checked', String(!!it.check));
    if (it.disabled) b.setAttribute('aria-disabled', 'true');
    if (it.style) b.setAttribute('style', it.style);
    b.innerHTML = (it.ico ? '<i class="xpmico" aria-hidden="true">' + it.ico + '</i>' : '') + '<span>' + esc(it.label) + '</span>' + (it.key ? '<kbd>' + esc(it.key) + '</kbd>' : '');
    b.addEventListener('click', e => {
      if (it.disabled){ e.preventDefault(); return; }
      if (!it.href) e.preventDefault();
      if (it.href) remember(b);
      closeMenu(); if (it.act) it.act(e);
    });
    el.appendChild(b);
  });
  (o.host || D.body).appendChild(el);
  const r = el.getBoundingClientRect(), lim = innerHeight - (o.host ? 0 : tbh());
  let x, y;
  if (at && at.nodeType){ const a = at.getBoundingClientRect(); x = o.right ? a.right - 2 : a.left; y = o.up ? a.top - r.height : (o.right ? a.bottom - r.height : a.bottom); }
  else { x = at.x; y = at.y; }
  x = Math.max(2, Math.min(x, innerWidth - r.width - 2)); y = Math.max(2, Math.min(y, lim - r.height - 2));
  el.style.left = x + 'px'; el.style.top = y + 'px';
  const list = () => [...el.querySelectorAll('.xpmi:not([aria-disabled])')];
  el.addEventListener('keydown', e => {
    const l = list(), i = l.indexOf(D.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); (l[i + 1] || l[0]).focus(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); (l[i - 1] || l[l.length - 1]).focus(); }
    else if (e.key === 'Home'){ e.preventDefault(); l[0].focus(); }
    else if (e.key === 'End'){ e.preventDefault(); l[l.length - 1].focus(); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === 'Tab'){ closeMenu(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && o.side){ e.preventDefault(); o.side(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === ' ' && D.activeElement && D.activeElement.tagName === 'A'){ e.preventDefault(); D.activeElement.click(); }
  });
  const opener = at && at.nodeType ? at : null;
  const down = e => { if (!el.contains(e.target) && !(opener && opener.contains(e.target))) closeMenu(); };
  const gone = () => closeMenu();
  const t = setTimeout(() => D.addEventListener('pointerdown', down, true), 0);
  addEventListener('blur', gone); addEventListener('resize', gone);
  menuNow = { el, opener, cleanup(){ clearTimeout(t); D.removeEventListener('pointerdown', down, true); removeEventListener('blur', gone); removeEventListener('resize', gone); } };
  if (opener){ opener.setAttribute('aria-expanded', 'true'); opener.classList.add('xpopen'); }
  const f = list()[0]; if (f) f.focus({ preventScroll:true });
  return el;
}
/* a menu bar (File, View, ...): [name, () => items] each; the arrow keys go along it, a menu open follows the pointer */
function menuBar(MENUS){
  const bar = D.createElement('div'); bar.className = 'xpmenubar';
  bar.innerHTML = MENUS.map(([name]) => '<button type="button" aria-haspopup="menu" aria-expanded="false">' + name + '</button>').join('');
  const mbs = [...bar.children];
  const openAt = i => { const b = mbs[(i + mbs.length) % mbs.length]; openMenu(MENUS[mbs.indexOf(b)][1](), b, { label:b.textContent, side:d => openAt(mbs.indexOf(b) + d) }); };
  mbs.forEach((b, i) => {
    b.addEventListener('click', () => { if (menuNow && menuNow.opener === b) closeMenu(); else openAt(i); });
    b.addEventListener('pointerenter', () => { if (menuNow && mbs.includes(menuNow.opener) && menuNow.opener !== b) openAt(i); });
    b.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown'){ e.preventDefault(); openAt(i); }
      else if (e.key === 'ArrowRight'){ e.preventDefault(); mbs[(i + 1) % mbs.length].focus(); }
      else if (e.key === 'ArrowLeft'){ e.preventDefault(); mbs[(i - 1 + mbs.length) % mbs.length].focus(); }
    });
  });
  return bar;
}

/* ── XP's tooltips: the pale yellow box, a moment after the pointer stops on something (the taskbar's, the caption
      buttons', the toolbar's, the tray's). An element's own title is held back while its tip shows. ── */
let tipEl = null, tipFor = null, tipT = 0;
function hideTip(){
  clearTimeout(tipT); tipT = 0;
  if (tipEl){ tipEl.remove(); tipEl = null; }
  if (tipFor && tipFor.dataset.xptitle != null){ tipFor.setAttribute('title', tipFor.dataset.xptitle); delete tipFor.dataset.xptitle; }
  tipFor = null;
}
const TIPS = '[data-xptip],#xptb .xpclock,:is(.pagehead .crumbs,.topbar .headbtns,#xptray .headbtns,.hubbar .headbtns) .btn[title],#themebtn,#settings';
function tipOver(e){
  if (e.pointerType && e.pointerType !== 'mouse') return;
  const el = e.target.closest && e.target.closest(TIPS);
  if (el === tipFor) return;
  hideTip();
  if (!el) return;
  tipFor = el;
  const text = el.dataset.xptip || el.getAttribute('title') || el.dataset.xptitle; if (!text) return;
  if (el.hasAttribute('title')){ el.dataset.xptitle = el.getAttribute('title'); el.removeAttribute('title'); }
  const x = e.clientX, y = e.clientY;
  tipT = setTimeout(() => {
    if (tipFor !== el || !el.isConnected) return;
    tipEl = D.createElement('div'); tipEl.className = 'xptip'; tipEl.setAttribute('role', 'tooltip'); tipEl.textContent = text;
    (el.closest('dialog[open]') || D.body).appendChild(tipEl);
    const r = tipEl.getBoundingClientRect(), low = y > innerHeight - tbh() - 40;
    tipEl.style.left = Math.max(2, Math.min(x - 4, innerWidth - r.width - 4)) + 'px';
    tipEl.style.top = (low ? y - r.height - 12 : y + 20) + 'px';
  }, 550);
}

/* ── pages fetched ahead (same site only, once each), when an icon or a window's button is pointed at ── */
const ahead = new Set();
function prefetch(href){
  try {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search) || ahead.has(u.href) || !/(\.html|\/)$/.test(u.pathname)) return;
    ahead.add(u.href);
    const l = D.createElement('link'); l.rel = 'prefetch'; l.href = u.href; l.className = 'xpahead';
    D.head.appendChild(l);
  } catch {}
}

/* the site's pages, as Home's icons have them (Home's own tiles there) */
const HOUSE = '<svg class="ph" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="M216,120v96H152V152H104v64H40V120l88-88Z" opacity="0.2"/>' +
  '<path d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"/></svg><span class="ie">🏠</span>';
const ICONS = [
  ['home.html', 'Home', '#1c55c6', '', '🏠', ['home']],
  ['./', 'Timetable', '#e5484d', 'd:table', '📋', ['timetable']],
  ['calendar.html', 'Calendar', '#f76b15', 'd:calendar-dots', '📅', ['calendar']],
  ['free.html', 'Free periods', '#ffb224', 'd:users-three', '☕', ['free']],
  ['revision.html', 'Revision', '#30a46c', 'd:pencil-simple-line', '📝', ['revision']],
  ['resources.html', 'Resources', '#12a594', 'd:books', '📚', ['resources']],
  ['games.html', 'Games', '#8e4ec6', 'd:game-controller', '🎮', ['games']],
  ['themes.html', 'Theme finder', '#af52de', 'd:palette', '🎨', ['themes', 'finder']],
  ['mahjong.html', 'Mahjong club', '#d6409f', 'd:cards-three', '🀄', ['mahjong']]
];
const iconOf = p => p === 'finder' ? null : ICONS.find(i => i[5].includes(p));
const labelOf = p => { const i = iconOf(p); return i ? i[1] : NAMES[p] || 'MSC Unofficial'; };
/* a page's picture, small (a menu, a taskbar button): its own icon in its tile colour */
const pic = i => !i ? '' : i[3] ? (window.Icon && Icon.svg ? Icon.svg(i[3]) : '') : HOUSE.replace(/<span class="ie">.*<\/span>/, '');
const progItem = i => ({ label:i[1], href:i[0], cls:'xpprog', style:'--tc:' + i[2], ico:pic(i) });
/* the windows open in this tab: [{ v, pg, href, label, t, min, max, x, y, w, h }], in the order they were opened */
const opened = () => { const a = ssGet(OPENKEY, []); return Array.isArray(a) ? a.filter(w => w && w.pg && w.href) : []; };
const keepOpen = a => ssSet(OPENKEY, a.slice(-6));
function closeWin(p){ keepOpen(opened().filter(w => w.pg !== p)); }

function start(){
  const off = [];
  live = { off, refresh(){} };
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); off.push(() => t.removeEventListener(ev, fn, opt)); };
  R.classList.add('xpjs'); off.push(() => R.classList.remove('xpjs', 'xpopening'));
  /* a window's frame on the desktop: only the page's own content */
  const dk = deskOf();
  if (dk){ framed(dk, off, on); return; }
  live.refresh = () => fit();
  const isHome = pg() === 'home', desktop = isHome && TOP;

  /* arriving from another page: keep the window out of sight (xp.css hides it under fx.js's cover) until it opens */
  const opening = !isHome && R.classList.contains('fx-in') && moving();
  if (opening){ R.classList.add('xpopening'); setTimeout(() => R.classList.remove('xpopening'), 900); }

  /* (a page on its own that couldn't go to the desktop) this page joins the windows open in this tab */
  if (!isHome && TOP){
    const ic = iconOf(pg()), h1 = D.querySelector('.pagehead h1');
    const me = { pg:pg(), href:ic ? ic[0] : location.pathname.split('/').pop() || './', label:ic ? ic[1] : (h1 && h1.textContent.trim()) || D.title };
    const a = opened(); const i = a.findIndex(w => w.pg === me.pg);
    if (i < 0) a.push(me); else a[i] = me;
    keepOpen(a);
  }

  /* the taskbar's own layer, first on the page: Quick Launch's Desktop, the window buttons, the clock
     (the bar, the start button and the tray are the page's own, drawn by xp.css) */
  const tb = D.createElement('div'); tb.id = 'xptb';
  tb.innerHTML = '<div class="xpql"></div><div class="xptasks" role="group" aria-label="Windows"></div><span class="xpclock"></span>';
  D.body.insertBefore(tb, D.body.firstChild); off.push(() => tb.remove());
  const ql = tb.querySelector('.xpql'), tasks = tb.querySelector('.xptasks'), clock = tb.querySelector('.xpclock');
  const desk = D.createElement(isHome ? 'button' : 'a');
  desk.className = 'xpdesk'; desk.innerHTML = '<span>Desktop</span>';
  if (isHome){ desk.type = 'button'; desk.dataset.xptip = 'Show the desktop'; desk.setAttribute('aria-label', 'Show the desktop'); desk.setAttribute('aria-pressed', 'false'); }
  else { desk.href = 'home.html'; desk.dataset.xptip = 'Show the desktop (Home)'; desk.setAttribute('aria-label', 'Desktop (Home)'); }
  ql.appendChild(desk);
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('en-AU', { hour:'numeric', minute:'2-digit' }).toUpperCase();
    clock.dataset.xptip = d.toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  };
  tick(); const clk = setInterval(tick, 15000); off.push(() => clearInterval(clk));
  /* Quick Launch after the start button, the window buttons between it and the tray */
  function fit(){
    const s = D.querySelector('#themebtn,#settings'), tray = D.querySelector('#xptray .headbtns,.hubbar .headbtns,.topbar .headbtns,.pagehead .crumbs');
    const l = s ? Math.round(s.getBoundingClientRect().right) + 4 : 110;
    tb.style.setProperty('--xp-ql', l + 'px');
    const q = ql.hidden ? l : Math.round(ql.getBoundingClientRect().right) + 4;
    const r = tray ? Math.round(innerWidth - tray.getBoundingClientRect().left) + 6 : 190;
    tb.style.setProperty('--xp-tl', q + 'px'); tb.style.setProperty('--xp-tr', r + 'px');
  }
  fit(); on(window, 'resize', fit);
  /* a window's button; Home's own windows go before the pages', so the order holds when the poll turns up late */
  const task = (id, label, first) => {
    const b = D.createElement('button'); b.type = 'button'; b.className = 'xptask'; b.dataset.w = id;
    b.innerHTML = '<span></span>'; b.firstChild.textContent = label; b.dataset.xptip = label;
    tasks.insertBefore(b, first ? tasks.querySelector('[data-open]') : null); return b;
  };
  /* (a page on its own) the other pages visited in this tab: minimised; a click goes back to one, a right click can close it */
  const openBtn = w => {
    const b = task('page', w.label); b.dataset.open = w.pg; b.dataset.href = w.href; b.setAttribute('aria-pressed', 'false');
    const ic = iconOf(w.pg); if (ic){ b.style.setProperty('--tc', ic[2]); b.insertAdjacentHTML('afterbegin', '<i class="xpti" aria-hidden="true">' + pic(ic) + '</i>'); }
    b.addEventListener('click', () => { if (b.dataset.open === pg()) return; remember(b); location.href = w.href; });
    b.xpMenu = () => {
      const me = b.dataset.open === pg();
      return [
        { label:me ? 'Minimise' : 'Restore', act:() => b.click() },
        { sep:true },
        { label:'Close', act:() => { closeWin(b.dataset.open); if (me) location.href = 'home.html'; else { b.remove(); fit(); } } }
      ];
    };
    return b;
  };
  const curBtn = { el:null };
  if (TOP && !desktop) opened().forEach(w => { const b = openBtn(w); if (w.pg === pg()) curBtn.el = b; });
  on(tasks, 'contextmenu', e => {
    const b = e.target.closest('.xptask'); if (!b || !b.xpMenu) return;
    e.preventDefault();
    openMenu(b.xpMenu(), b, { up:true, label:b.textContent });
  });

  /* pointing at an icon, a window's button or a menu's link fetches its page ahead; pressing it, at once */
  const AHEAD = 'a.qtile,.xpicons a,.xptask[data-href],.xpmenu a[href],a.xpdesk';
  let aheadT = 0;
  on(D, 'pointerover', e => {
    clearTimeout(aheadT);
    const a = e.pointerType === 'mouse' && e.target.closest && e.target.closest(AHEAD);
    if (a) aheadT = setTimeout(() => prefetch(a.getAttribute('href') || a.dataset.href), 90);
  });
  on(D, 'pointerdown', e => { const a = e.target.closest && e.target.closest(AHEAD); if (a) prefetch(a.getAttribute('href') || a.dataset.href); }, true);
  off.push(() => { clearTimeout(aheadT); D.querySelectorAll('link.xpahead').forEach(l => l.remove()); ahead.clear(); });
  /* what's clicked to go to another page: where its window will open from */
  on(D, 'click', e => { const a = e.target.closest && e.target.closest('a.qtile,.xpicons a,a.xpdesk'); if (a && !e.defaultPrevented) remember(a.querySelector('.ico') || a); }, true);

  /* tooltips */
  on(D, 'pointerover', tipOver);
  on(D, 'pointerdown', hideTip, true);
  on(D, 'keydown', hideTip, true);

  /* the desktop's icons: the arrow keys go from one to the next; pressed, an icon is picked (XP's blue) on its way */
  on(D, 'keydown', e => {
    const a = D.activeElement, list = a && a.closest && a.closest('.qtiles,.xpicons');
    if (!list || !a.matches('a.qtile') || !/^Arrow(Up|Down|Left|Right)$/.test(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const all = [...list.querySelectorAll('a.qtile')].filter(x => x.getClientRects().length), i = all.indexOf(a);
    const n = all[i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1)];
    if (n){ e.preventDefault(); n.focus(); }
  });
  const pick = a => D.querySelectorAll('.qtiles .qtile.xpsel').forEach(x => { if (x !== a) x.classList.remove('xpsel'); });
  on(D, 'pointerdown', e => {
    const a = e.target.closest && e.target.closest('.qtiles a.qtile');
    pick(a); if (a && e.button === 0) a.classList.add('xpsel');
  });
  off.push(() => pick(null));

  /* Ctrl+Esc opens the Start menu, as on XP */
  on(D, 'keydown', e => {
    if (e.key !== 'Escape' || !e.ctrlKey || e.altKey || e.metaKey) return;
    if (D.querySelector('dialog[open]')) return;
    const s = D.querySelector('#themebtn,#settings'); if (s){ e.preventDefault(); s.click(); }
  });

  /* ── the Start menu (Settings): the name on the banner, All Programs; a click outside closes it ── */
  [D.getElementById('setDlg'), D.getElementById('dlg')].filter(Boolean).forEach(dlg => {
    const head = dlg.querySelector('.dlg-h'); if (!head) return;
    const u = D.createElement('span'); u.className = 'xpuser'; u.setAttribute('aria-hidden', 'true');
    u.innerHTML = '<i></i><b></b>';
    const name = () => { u.lastChild.textContent = who(); };
    name(); head.insertBefore(u, head.firstChild); off.push(() => u.remove());
    const mo = new MutationObserver(() => { if (dlg.open) name(); else if (menuNow && dlg.contains(menuNow.el)) closeMenu(); });
    mo.observe(dlg, { attributes:true, attributeFilter:['open'] }); off.push(() => mo.disconnect());
    /* All Programs: every page, in a menu beside the white column */
    const all = D.createElement('button'); all.type = 'button'; all.className = 'xpallbtn';
    all.setAttribute('aria-haspopup', 'menu'); all.setAttribute('aria-expanded', 'false'); all.innerHTML = '<span>All Programs</span><i aria-hidden="true"></i>';
    dlg.appendChild(all); off.push(() => all.remove());
    const programs = () => ICONS.map(progItem);
    all.addEventListener('click', () => { if (menuNow && menuNow.opener === all) closeMenu(); else openMenu(programs(), all, { host:dlg, right:innerWidth > 600, up:innerWidth <= 600, label:'All Programs', cls:'xpallmenu' }); });
    all.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp'){ e.preventDefault(); all.click(); } });
    /* (pressed and let go outside it: a text selection that ends outside doesn't count) */
    let downOut = false;
    const outside = e => { if (e.target !== dlg) return false; const r = dlg.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    on(dlg, 'pointerdown', e => { downOut = outside(e); });
    on(dlg, 'click', e => { if (dlg.open && downOut && outside(e)) dlg.close(); downOut = false; });
  });
  /* the start button says "start", so its name says it too */
  const sb = D.querySelector('#themebtn,#settings');
  if (sb){ const was = sb.getAttribute('aria-label'); sb.setAttribute('aria-label', 'Start: Settings'); off.push(() => { if (was == null) sb.removeAttribute('aria-label'); else sb.setAttribute('aria-label', was); }); }

  /* the things a menu can do, the same on every page */
  const act = {
    settings(){ const s = D.querySelector('#themebtn,#settings'); if (s) s.click(); },
    display(){ const b = D.getElementById('openDisplay'); if (b) b.click(); },
    a11y(){ const b = D.getElementById('openA11y'); if (b) b.click(); },
    dark(){ const T = window.TT; if (!T || !T.set || !T.apply || !T.readState) return; const st = T.readState(); T.set('tt.mode', st.mode === 'dark' ? 'light' : 'dark'); T.apply(T.readState()); },
    isDark: () => R.dataset.mode === 'dark',
    help(what){ const b = D.getElementById(what === 'news' ? 'newsbtn' : 'aboutbtn'); if (b) b.click(); else { ssSet(HELPKEY, what); location.href = 'home.html'; } }
  };
  /* Help from another page lands here: open it now */
  if (isHome){ const h = ssGet(HELPKEY, null); if (h){ ssSet(HELPKEY, null); setTimeout(() => act.help(h), 300); } }

  /* a right click on the desktop itself (the wallpaper, not a window or an icon): XP's desktop menu */
  const deskItems = { home:null, page:null };
  on(D, 'contextmenu', e => {
    if (!mouseish() || e.shiftKey) return;
    const t = e.target;
    if (!(t === R || t === D.body || (t.matches && t.matches('.wrap.hub,.qtiles,.xpicons')))) return;
    e.preventDefault();
    openMenu([].concat(deskItems.home ? deskItems.home() : [], deskItems.page ? deskItems.page() : [], [
      { label:'Refresh', key:'F5', act:() => location.reload() },
      { sep:true },
      { label:'Properties', act:act.display }
    ]), { x:e.clientX, y:e.clientY }, { label:'Desktop' });
  });

  if (isHome) home({ off, on, task, fit, desk, ql, act, deskItems, desktop });
  else pageWindow(off, on, task, fit, opening, act, curBtn, deskItems);
}

/* ── a page in a window's frame on the desktop (html.xpframed): only its own content; the wallpaper, the taskbar and the
      window's title bar, menus and caption buttons are the desktop's. A link to another of the site's pages opens that
      page's window, to Home brings up the desktop, to anywhere else takes the whole tab there; a click anywhere in here
      brings this window to the front. Minimised, the page sleeps: no animation frames, CSS animations paused. ── */
let sleeping = false;
const rafQ = new Map(); let rafN = 0, rafOwn = null;
function sleep(v){
  v = !!v; if (v === sleeping) return;
  sleeping = v; R.classList.toggle('xpasleep', v);
  if (!v && rafOwn){ const a = [...rafQ.values()]; rafQ.clear(); a.forEach(cb => rafOwn.call(window, cb)); }
}
function holdFrames(){
  if (rafOwn || !window.requestAnimationFrame) return;
  const raf = rafOwn = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
  window.requestAnimationFrame = function(cb){ if (!sleeping) return raf.call(window, cb); const id = -(++rafN); rafQ.set(id, cb); return id; };
  window.cancelAnimationFrame = function(id){ if (id < 0) rafQ.delete(id); else caf.call(window, id); };
}
function framed(desk, off, on){
  const me = window.frameElement;
  R.classList.add('xpframed'); off.push(() => { R.classList.remove('xpframed'); sleep(false); });
  holdFrames();
  window.__xpFrame = { sleep }; off.push(() => { try { delete window.__xpFrame; } catch {} });
  const title = () => {
    if (pg() === 'timetable'){ const h = D.getElementById('title'), t = h ? h.textContent.trim() : ''; return t && t !== 'Timetable' ? t + ' - Timetable' : 'Timetable'; }
    const h = D.querySelector('.pagehead h1'), t = (h && h.textContent.trim()) || labelOf(pg());
    return t + ' - MSC Unofficial';
  };
  const label = () => { const i = iconOf(pg()); if (i) return i[1]; const h = D.querySelector('.pagehead h1'); return (h && h.textContent.trim()) || labelOf(pg()); };
  const info = () => ({ pg:pg(), href:relHref(new URL(location.href)), title:title(), label:label() });
  const tell = () => { try { desk.info(me, info()); } catch {} };
  try { desk.ready(me, info()); } catch {}
  /* its name, as it changes (the timetable's is whose it is), and its address, as it changes without loading */
  const mo = new MutationObserver(tell);
  [D.querySelector('title'), D.getElementById('title'), D.querySelector('.pagehead h1')].filter(Boolean).forEach(n => mo.observe(n, { childList:true, characterData:true, subtree:true }));
  off.push(() => mo.disconnect());
  if (window.navigation && navigation.addEventListener) on(navigation, 'currententrychange', tell);
  on(window, 'popstate', tell); on(window, 'hashchange', tell);
  /* going to another address in here: the window shows its own face until the next one is ready */
  on(window, 'pagehide', () => { try { desk.leaving(me); } catch {} });
  /* to the front, from a click or the keyboard */
  on(D, 'pointerdown', () => { try { desk.front(me); } catch {} }, true);
  on(D, 'focusin', () => { try { desk.front(me); } catch {} });
  /* Ctrl+Esc: the desktop's Start menu */
  on(D, 'keydown', e => {
    if (e.key !== 'Escape' || !e.ctrlKey || e.altKey || e.metaKey || D.querySelector('dialog[open]')) return;
    e.preventDefault(); try { desk.start(); } catch {}
  });
  const go = (r, a) => {
    try {
      if (r.to === 'win'){
        let from = null;
        const f = me.getBoundingClientRect(), b = a && box(a.querySelector('.ico') || a);
        if (b) from = { x:b.x + f.left, y:b.y + f.top, w:b.w, h:b.h };
        desk.open(r.u.href, from);
      }
      else if (r.to === 'home') desk.home();
      else window.top.location.href = r.u.href;
    } catch { location.href = r.u.href; }
  };
  /* links (on the body, so the page's own handlers on a link have had their say, and before fx.js's on the document) */
  on(D.body, 'click', e => {
    const a = linkOf(e); if (!a) return;
    const r = where(a.getAttribute('href')); if (!r || r.to === 'here') return;
    e.preventDefault(); go(r, a);
  });
  /* and the page's own goings (location.href = ...), where the browser tells (the Navigation API); a page replacing itself
     (a year's redirect) still goes, in its window */
  if (window.navigation && navigation.addEventListener) on(navigation, 'navigate', e => {
    if (!e.cancelable || e.hashChange || e.downloadRequest || e.formData || e.navigationType !== 'push' || (e.destination && e.destination.sameDocument)) return;
    const r = where(e.destination.url); if (!r || r.to === 'here') return;
    e.preventDefault(); go(r, null);
  });
}

/* ── the timetable and the other pages, on their own (in someone else's frame, or a tab that can't keep a list of windows):
      one window on a desktop of their own, the desktop's icons beside it ── */
function pageWindow(off, on, task, fit, opening, act, curBtn, deskItems){
  const tt = pg() === 'timetable';
  const wrap = D.querySelector('.wrap'), head = D.querySelector(tt ? '.topbar' : '.pagehead');
  if (!wrap || !head){ R.classList.remove('xpopening'); return; }
  const titleOf = () => box(tt ? head.querySelector('h1') || head : head);
  const ic = iconOf(pg());

  /* the desktop's icons, after the page (shown by xp.css on a computer-sized screen) */
  const nav = D.createElement('nav'); nav.className = 'xpicons'; nav.setAttribute('aria-label', 'Desktop');
  nav.innerHTML = ICONS.map(i => '<a class="qtile" href="' + i[0] + '" style="--tc:' + i[2] + '"' + (i[5].includes(pg()) ? ' aria-current="page"' : '') + '>' +
    (i[3] ? '<span class="ico" data-icon="' + i[3] + '" data-emoji="' + i[4] + '"></span>' : '<span class="ico">' + HOUSE + '</span>') +
    '<span class="tname">' + i[1] + '</span></a>').join('');
  wrap.after(nav); off.push(() => nav.remove());
  if (window.Icon && Icon.fill) Icon.fill(nav);
  const cur = nav.querySelector('[aria-current="page"]'); if (cur) cur.classList.add('xpsel');

  const cap = caption(['min', 'max', 'close']);
  head.appendChild(cap); off.push(() => cap.remove());
  const tb = curBtn.el || task('page', ic ? ic[1] : (head.querySelector('h1') || {}).textContent || D.title);
  delete tb.dataset.href; tb.setAttribute('aria-pressed', 'true');
  /* maximised or not (msc.xpmax: the timetable on its own, the other pages together); not, to begin with */
  const key = tt ? 'timetable' : 'page';
  const isMax = () => { const m = lsGet(MAXKEY, {}) || {}; return !!m[key]; };
  const paintMax = () => { const m = isMax(); R.classList.toggle('xpmaxed', m); setMaxBtn(cap.querySelector('[data-cap="max"]'), m); fit(); };
  const flipMax = () => { const m = lsGet(MAXKEY, {}) || {}; m[key] = !isMax(); lsSet(MAXKEY, m); paintMax(); };
  paintMax(); off.push(() => R.classList.remove('xpmaxed', 'xppagemin'));
  const minimise = v => {
    if (v){
      const from = titleOf();
      R.classList.add('xppagemin'); tb.setAttribute('aria-pressed', 'false');
      if (wrap.contains(D.activeElement)) tb.focus();
      zoom(from, box(tb), 170);
    } else {
      tb.setAttribute('aria-pressed', 'true');
      zoom(box(tb), titleOf(), 170, () => R.classList.remove('xppagemin'));
    }
  };
  const close = () => { closeWin(pg()); location.href = 'home.html'; };
  deskItems.page = () => [{ label:R.classList.contains('xppagemin') ? 'Show the window' : 'Show the desktop', act:() => minimise(!R.classList.contains('xppagemin')) }, { sep:true }];
  off.push(() => { deskItems.page = null; });
  on(cap, 'click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.cap;
    if (k === 'min') minimise(true);
    else if (k === 'max') flipMax();
    else if (k === 'close') close();
  });
  /* its own button: minimise / restore (every other window's button goes back to that page) */
  on(tb, 'click', () => minimise(!R.classList.contains('xppagemin')));
  /* a double-click on the title bar maximises, as in XP */
  on(head, 'dblclick', e => {
    if (e.target.closest('button,a,input,select,textarea,.crumbs,.headbtns,.idrow,.now,.xpmenubar')) return;
    const r = head.getBoundingClientRect(); if (e.clientY - r.top > 30) return;
    flipMax();
  });

  /* the menu bar: File, View, Favorites, Tools, Help */
  const bar = menuBar([
    ['File', () => [
      { label:'Desktop', href:'home.html' },
      { sep:true },
      { label:'Close', act:close }
    ]],
    ['View', () => [
      { label:isMax() ? 'Restore' : 'Maximise', act:flipMax },
      { label:'Refresh', key:'F5', act:() => location.reload() },
      { sep:true },
      { label:'Dark mode', check:act.isDark(), act:act.dark }
    ]],
    ['Favorites', () => ICONS.map(progItem)],
    ['Tools', () => [
      { label:'Settings…', act:act.settings },
      { label:'Display…', act:act.display },
      { label:'Accessibility…', act:act.a11y }
    ]],
    ['Help', () => [
      { label:'What’s new', act:() => act.help('news') },
      { sep:true },
      { label:'About MSC Unofficial', act:() => act.help('about') }
    ]]
  ]);
  if (tt){ const h1 = head.querySelector('h1'); (h1 || head.firstChild).after(bar); }
  else head.after(bar);
  off.push(() => bar.remove());

  /* the other pages: Explorer's Back / Forward / Up and the Address bar (C:\MSC Unofficial\Page) */
  if (!tt){
    const tool = explorerBar(ic ? ic[1] : (head.querySelector('h1') || {}).textContent || '');
    tool.querySelector('.xpback').addEventListener('click', () => history.back());
    tool.querySelector('.xpfwd').addEventListener('click', () => history.forward());
    if (history.length < 2) tool.querySelector('.xpback').setAttribute('aria-disabled', 'true');
    bar.after(tool); off.push(() => tool.remove());
  }
  R.classList.add('xpchrome'); off.push(() => R.classList.remove('xpchrome'));

  /* opening: from what was clicked on the last page, else from this window's taskbar button */
  if (opening){
    const from = recalled() || box(tb);
    requestAnimationFrame(() => zoom(from, titleOf(), 210, () => R.classList.remove('xpopening')));
  } else ssSet(FROMKEY, null);
}
/* Explorer's Back / Forward / Up and the Address bar; the Address bar's drop-down is the places it can go (as Favorites) */
function explorerBar(name, icon){
  const tool = D.createElement('div'); tool.className = 'xptoolbar';
  tool.innerHTML =
    '<button type="button" class="xpback" data-xptip="Back" aria-label="Back"><i aria-hidden="true"></i><span>Back</span></button>' +
    '<button type="button" class="xpfwd" data-xptip="Forward" aria-label="Forward"><i aria-hidden="true"></i></button>' +
    '<a class="xpup" href="home.html" data-xptip="Up to the desktop" aria-label="Up to the desktop"><i aria-hidden="true"></i></a>' +
    '<span class="xpaddr" aria-hidden="true"><span class="xpaddrl">Address</span><span class="xpaddrf"><i></i><b></b></span></span>';
  tool.querySelector('.xpaddrf b').textContent = 'C:\\MSC Unofficial\\' + String(name || '').trim();
  if (icon) tool.querySelector('.xpaddrf i').innerHTML = icon;
  const field = tool.querySelector('.xpaddrf');
  field.addEventListener('click', () => { if (menuNow && menuNow.opener === field) closeMenu(); else openMenu(ICONS.map(progItem), field, { label:'Address' }); });
  return tool;
}

/* ── the windows on the desktop, Home's own and the pages', in one order: which is in front (its title bar the bright
      blue, its taskbar button pressed), and how they stack ── */
function stackOf(){
  const S = {
    z:10, cur:null, sets:new Set(),
    all(){ const a = []; S.sets.forEach(f => a.push(...f())); return a; },
    raise(el){
      if (S.z > 4000){ S.z = 10; S.all().sort((p, q) => +p.el.style.zIndex - +q.el.style.zIndex).forEach(x => { x.el.style.zIndex = ++S.z; }); }
      el.style.zIndex = ++S.z;
    },
    front(w){
      if (w && +w.el.style.zIndex !== S.z) S.raise(w.el);
      S.cur = w || null;
      S.all().forEach(x => { x.el.classList.toggle('xpon', x === w); if (x.task) x.task.setAttribute('aria-pressed', String(x === w && x.shown())); });
    },
    topmost(){ let b = null; S.all().forEach(x => { if (x.shown() && (!b || +x.el.style.zIndex > +b.el.style.zIndex)) b = x; }); return b; }
  };
  return S;
}

/* ── Home: the desktop ── */
function home(X){
  const { off, on, task, fit, desk, ql, act, deskItems, desktop } = X;
  const mq = matchMedia(WM_Q);
  let wm = null, pw = null;
  const body = D.body, S = stackOf();
  const can = () => mq.matches && !body.classList.contains('pollfocus');
  /* Quick Launch's Desktop: every window away to the taskbar; again, and they come back */
  let hidden = null;
  const undesk = () => { hidden = null; desk.setAttribute('aria-pressed', 'false'); };
  function deskToggle(){
    if (hidden){ const back = hidden; undesk(); back.forEach(w => w.show()); S.front(back[back.length - 1] || S.topmost()); return; }
    const open = S.all().filter(w => w.shown()).sort((a, b) => +a.el.style.zIndex - +b.el.style.zIndex);
    if (!open.length) return;
    open.forEach(w => w.hide(true)); S.front(null);
    hidden = open; desk.setAttribute('aria-pressed', 'true');
  }
  /* Quick Launch's Desktop is for when there are windows to put away */
  const sync = () => {
    if (can() && !wm) wm = wmOn(); else if (!can() && wm){ wm.off(); wm = null; }
    if (pw) pw.mode(mq.matches);
    ql.hidden = !wm && !(pw && pw.count());
    fit();
  };
  sync();
  /* (after Home's own windows are placed, so the pages' windows brought back by a reload stay in front of them) */
  if (desktop){ pw = pagesOn({ off, on, task, fit, act, S, undesk, sync:() => sync(), homeFront:() => { if (wm) wm.show(); } }); sync(); }
  on(mq, 'change', sync);
  on(desk, 'click', deskToggle);
  const bo = new MutationObserver(sync); bo.observe(body, { attributes:true, attributeFilter:['class'] }); off.push(() => bo.disconnect());
  off.push(() => { if (wm){ wm.off(); wm = null; } });
  deskItems.home = () => wm ? [{ label:'Arrange windows', act:wm.reset }, { label:'Show the desktop', act:deskToggle }, { sep:true }] : [];
  off.push(() => { deskItems.home = null; });

  function wmOn(){
    const offw = [];
    const onw = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offw.push(() => t.removeEventListener(ev, fn, opt)); };
    const WINS = [
      { id:'welcome', el:D.querySelector('.hubbar'), label:'MSC Unofficial', cap:['min'] },
      { id:'poll', el:D.getElementById('poll'), label:'This week’s poll', cap:[] },
      { id:'today', el:D.getElementById('hubtoday'), label:'Today’s games', cap:['min'] },
      { id:'forum', el:D.getElementById('forum'), label:'Forum', cap:['min', 'max'] }
    ].filter(w => w.el);
    const shown = w => !w.el.hidden && w.el.getClientRects().length > 0 || w.el.classList.contains('xpmin');
    const saved = () => { const s = lsGet(WINKEY, null); return s && s.v === 1 && s.w ? s.w : {}; };
    const save = () => { const s = {}; WINS.forEach(w => { if (w.placed) s[w.id] = { x:Math.round(w.x), y:Math.round(w.y) }; }); lsSet(WINKEY, { v:1, w:s }); };
    const titleOf = w => { const r = box(w.el); return r && { x:r.x, y:r.y, w:r.w, h:30 }; };
    /* (in the desktop's one order with the pages' windows) */
    WINS.forEach(w => {
      w.shown = () => w.placed && !w.el.hidden && !w.el.classList.contains('xpmin');
      w.hide = q => minimise(w, q);
      w.show = () => { w.el.classList.remove('xpmin'); clamp(w); };
    });
    const mine = () => WINS.filter(w => w.placed);
    S.sets.add(mine); offw.push(() => S.sets.delete(mine));
    const front = w => S.front(w), topmost = () => S.topmost();
    scrollTo(0, 0);

    /* Settings and Timetable sit in the taskbar, out of the window that holds them (so a window in front can't
       cover them), at the start of the page, so they are still the first buttons for a keyboard or a screen reader */
    const btns = D.querySelector('.hubbar .headbtns');
    if (btns){
      const home0 = btns.parentNode, next0 = btns.nextSibling;
      const tray = D.createElement('div'); tray.id = 'xptray';
      body.insertBefore(tray, body.firstChild); tray.appendChild(btns);
      offw.push(() => { if (home0.isConnected) home0.insertBefore(btns, next0 && next0.parentNode === home0 ? next0 : null); tray.remove(); });
    }

    /* where the stylesheet would put each window (measured with every window back in the page, in the same moment, so nothing flickers) */
    function defaults(){
      const keep = WINS.map(w => w.el.getAttribute('style'));
      const was = R.classList.contains('xpwm');
      R.classList.remove('xpwm');
      WINS.forEach(w => { w.el.style.left = w.el.style.top = w.el.style.width = w.el.style.height = w.el.style.maxHeight = w.el.style.zIndex = ''; });
      const sx = scrollX, sy = scrollY, out = {};
      WINS.forEach(w => { const r = w.el.getBoundingClientRect(); out[w.id] = { x:r.left + sx, y:r.top + sy, w:r.width }; });
      if (was) R.classList.add('xpwm');
      WINS.forEach((w, i) => { if (keep[i] == null) w.el.removeAttribute('style'); else w.el.setAttribute('style', keep[i]); });
      return out;
    }
    const avail = () => innerHeight - tbh();
    function clamp(w){
      if (!w.placed || w.el.classList.contains('xpmaxw')) return;
      const el = w.el, ww = el.offsetWidth, hh = el.offsetHeight;
      w.x = Math.max(0, Math.min(w.x, innerWidth - ww));
      w.y = Math.max(0, Math.min(w.y, avail() - hh));
      el.style.left = w.x + 'px'; el.style.top = w.y + 'px';
    }
    function place(w, d){
      const el = w.el, s = saved()[w.id];
      w.x = s ? s.x : d.x; w.y = s ? s.y : d.y;
      el.classList.add('xpwin');
      el.style.width = Math.round(d.w) + 'px';
      el.style.maxHeight = (avail() - 8) + 'px';
      if (w.id === 'forum') el.style.height = Math.max(260, Math.min(avail() - 8, avail() - w.y - 14)) + 'px';
      S.raise(el);
      w.placed = true;
      if (w.cap.length && !w.capEl){
        w.capEl = caption(w.cap);
        (w.id === 'forum' ? el.querySelector('.fhead') || el : el).appendChild(w.capEl);
      }
      if (!w.task){ w.task = task(w.id, w.label, true); w.task.onclick = () => taskClick(w); }
      clamp(w);
    }
    function minimise(w, quiet){
      const had = w.el.contains(D.activeElement), from = titleOf(w);
      w.el.classList.add('xpmin'); w.el.classList.remove('xpon');
      if (!quiet){ front(topmost()); zoom(from, box(w.task), 170); }
      if (w.task){ w.task.setAttribute('aria-pressed', 'false'); if (had) w.task.focus(); }
    }
    function restore(w){
      w.el.classList.remove('xpmin'); clamp(w); const to = titleOf(w); w.el.classList.add('xpmin');
      zoom(box(w.task), to, 170, () => { w.el.classList.remove('xpmin'); front(w); clamp(w); });
    }
    function taskClick(w){
      undesk();
      const el = w.el;
      if (el.classList.contains('xpmin')) restore(w);
      else if (el.classList.contains('xpon')) minimise(w);
      else front(w);
    }
    function maxToggle(w){
      const m = !w.el.classList.contains('xpmaxw');
      w.el.classList.toggle('xpmaxw', m);
      setMaxBtn(w.capEl && w.capEl.querySelector('[data-cap="max"]'), m);
      front(w); if (!m) clamp(w);
    }
    /* Arrange windows (the Start menu's Reset windows, the desktop's right-click menu): back where they started */
    function reset(){
      lsSet(WINKEY, null); undesk();
      const d = defaults();
      WINS.forEach(w => { if (!w.placed) return; w.el.classList.remove('xpmin', 'xpmaxw'); setMaxBtn(w.capEl && w.capEl.querySelector('[data-cap="max"]'), false); w.placed = false; place(w, d[w.id]); });
      front(WINS.find(w => w.id === 'poll' && w.placed) || topmost());
    }
    /* Home (a link to it, Up, File's Desktop): its windows in front, MSC Unofficial back if it was put away */
    function show(){
      const ws = mine().sort((a, b) => +a.el.style.zIndex - +b.el.style.zIndex);
      const wl = ws.find(w => w.id === 'welcome'); if (wl && wl.el.classList.contains('xpmin')){ wl.el.classList.remove('xpmin'); clamp(wl); }
      ws.forEach(w => { if (w.shown()) S.raise(w.el); });
      front(topmost());
    }

    /* first placing: every window showing now (a page's window in front stays in front) */
    const pageFront = () => S.cur && !WINS.includes(S.cur) && S.cur.shown() ? S.cur : null;
    R.classList.add('xpwm');
    { const pf = pageFront(), d = defaults(); WINS.forEach(w => { if (shown(w)) place(w, d[w.id]); }); front(pf || WINS.find(w => w.id === 'poll' && w.placed) || topmost()); }

    /* a window that turns up later (the poll, once it has loaded), or goes */
    const mo = new MutationObserver(() => {
      let d = null;
      WINS.forEach(w => {
        if (!w.placed && shown(w)){ const pf = pageFront(); d = d || defaults(); place(w, d[w.id]); if (pf) front(pf); else if (w.id === 'poll') front(w); }
        if (w.task) w.task.hidden = w.el.hidden;
      });
    });
    WINS.forEach(w => mo.observe(w.el, { attributes:true, attributeFilter:['hidden'] }));
    offw.push(() => mo.disconnect());
    /* one that grows (the poll's results) is moved up to stay above the taskbar */
    const ro = new ResizeObserver(() => WINS.forEach(clamp));
    WINS.forEach(w => ro.observe(w.el)); offw.push(() => ro.disconnect());
    onw(window, 'resize', () => WINS.forEach(w => { if (!w.placed) return; w.el.style.maxHeight = (avail() - 8) + 'px'; clamp(w); }));

    /* dragging by the title bar (a mouse or a pen; the top 30px of a window, not on its buttons) */
    let drag = null;
    WINS.forEach(w => {
      onw(w.el, 'pointerdown', e => {
        if (!w.placed) return;
        front(w);
        if (e.button !== 0 || e.pointerType === 'touch' || w.el.classList.contains('xpmaxw')) return;
        const r = w.el.getBoundingClientRect();
        if (e.clientY - r.top > 30) return;
        if (e.target.closest('button,a,input,select,textarea,label,[contenteditable="true"],.xpcap')) return;
        e.preventDefault();
        drag = { w, dx:e.clientX - r.left, dy:e.clientY - r.top, id:e.pointerId, x0:e.clientX, y0:e.clientY, moved:false };
        w.el.classList.add('xpdrag'); R.classList.add('xpfdrag');
        try { w.el.setPointerCapture(e.pointerId); } catch {}
      });
      onw(w.el, 'focusin', () => { if (w.placed) front(w); });
      onw(w.el, 'dblclick', e => {
        if (!w.cap.includes('max') || e.target.closest('button,a,input,select,textarea')) return;
        const r = w.el.getBoundingClientRect(); if (e.clientY - r.top <= 30) maxToggle(w);
      });
      if (w.cap.length) onw(w.el, 'click', e => {
        const b = e.target.closest('.xpcap button'); if (!b || !w.el.contains(b)) return;
        if (b.dataset.cap === 'min') minimise(w); else if (b.dataset.cap === 'max') maxToggle(w);
      });
    });
    onw(window, 'pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 3) return;
      drag.moved = true;
      drag.w.x = e.clientX - drag.dx; drag.w.y = e.clientY - drag.dy; clamp(drag.w);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null; d.w.el.classList.remove('xpdrag'); R.classList.remove('xpfdrag');
      if (d.moved){
        save();
        /* the click that ends a drag isn't a click (a minimised poll would open) */
        const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
        addEventListener('click', eat, { capture:true, once:true }); setTimeout(() => removeEventListener('click', eat, true), 0);
      }
    };
    onw(window, 'pointerup', end); onw(window, 'pointercancel', end);

    /* the Start menu's Reset windows */
    const dlg = D.getElementById('setDlg'), col = dlg && dlg.querySelector('.dlg-f .tabbtns');
    if (col){
      const b = D.createElement('button'); b.type = 'button'; b.className = 'btn xpreset'; b.textContent = 'Reset windows';
      b.onclick = () => { if (dlg.open) dlg.close(); reset(); };
      col.appendChild(b); offw.push(() => b.remove());
    }

    /* and all of it away again */
    offw.push(() => {
      R.classList.remove('xpwm', 'xpfdrag');
      undesk();
      WINS.forEach(w => {
        const el = w.el;
        el.classList.remove('xpwin', 'xpon', 'xpmin', 'xpmaxw', 'xpdrag');
        el.style.left = el.style.top = el.style.width = el.style.height = el.style.maxHeight = el.style.zIndex = '';
        if (!el.getAttribute('style')) el.removeAttribute('style');
        if (w.capEl) w.capEl.remove();
        if (w.task) w.task.remove();
        w.placed = false; w.capEl = w.task = null;
      });
    });
    return { off(){ for (let i = offw.length - 1; i >= 0; i--) try { offw[i](); } catch {} }, reset, show };
  }
}

/* ── the pages' windows on the desktop (Home at the top of the tab): each a window holding a frame of its page. One a page;
      opening one already open brings it up (and takes it to the new address, if the link had one of its own). ── */
function pagesOn(X){
  const { off, on, task, fit, act, S, undesk } = X;
  const body = D.body, list = [];
  let float = matchMedia(WM_Q).matches, drag = null;
  const avail = () => innerHeight - tbh();
  const cap = () => float ? 6 : 4;
  const byFrame = f => list.find(w => w.frame === f);
  R.classList.add('xptop'); R.classList.toggle('xpfloat', float);
  S.sets.add(() => list);
  const save = () => ssSet(OPENKEY, list.map(w => {
    const o = { v:2, pg:w.pg, href:w.href, label:w.label, t:w.t };
    if (w.min) o.min = 1; if (w.max) o.max = 1;
    if (w.g) Object.assign(o, { x:Math.round(w.g.x), y:Math.round(w.g.y), w:Math.round(w.g.w), h:Math.round(w.g.h) });
    return o;
  }));
  const mode = () => R.classList.toggle('xpfull', !float && list.some(w => !w.min));
  const titleBox = w => { const r = box(w.bar); return r && { x:r.x, y:r.y, w:r.w, h:30 }; };

  /* where a new window goes: beside the desktop's icons, a step down and along from the last, at the page's own width */
  function defaults(p){
    const k = list.filter(w => w.frame && !w.min).length % 6, dl = innerWidth >= 1000 ? 112 : 0;
    const x = dl + 14 + k * 26, y = 10 + k * 26;
    return { x, y, w:Math.min(p === 'timetable' ? 1400 : 1000, innerWidth - x - 14), h:avail() - y - 12 };
  }
  function place(w){
    const el = w.el;
    el.classList.toggle('xpfmax', float && w.max);
    if (!float || w.max){ el.style.left = el.style.top = el.style.width = el.style.height = ''; return; }
    const g = w.g || (w.g = defaults(w.pg));
    const W = Math.max(300, Math.min(g.w, innerWidth)), H = Math.max(180, Math.min(g.h, avail()));
    g.x = Math.max(0, Math.min(g.x, innerWidth - W)); g.y = Math.max(0, Math.min(g.y, avail() - H));
    el.style.left = g.x + 'px'; el.style.top = g.y + 'px'; el.style.width = W + 'px'; el.style.height = H + 'px';
  }

  /* its name, picture and address, wherever they show */
  function dress(w){
    const ic = iconOf(w.pg), t = w.title || (w.pg === 'timetable' ? 'Timetable' : w.label + ' - MSC Unofficial');
    w.ico.innerHTML = pic(ic); w.el.style.setProperty('--tc', ic ? ic[2] : '#316ac5');
    w.titleEl.textContent = t; w.el.setAttribute('aria-label', w.label);
    if (w.frame) w.frame.title = w.label;
    if (w.task){
      w.task.querySelector('span').textContent = w.label; w.task.dataset.xptip = t; w.task.dataset.open = w.pg;
      const ti = w.task.querySelector('.xpti'); if (ti) ti.remove();
      if (ic){ w.task.style.setProperty('--tc', ic[2]); w.task.insertAdjacentHTML('afterbegin', '<i class="xpti" aria-hidden="true">' + pic(ic) + '</i>'); }
    }
    /* Explorer's bar on every page but the timetable (it has its own address bar, whose timetable) */
    const want = w.pg !== 'timetable';
    if (want && !w.tool){
      w.tool = explorerBar(w.label, pic(ic));
      w.tool.querySelector('.xpback').addEventListener('click', () => step(w, -1));
      w.tool.querySelector('.xpfwd').addEventListener('click', () => step(w, 1));
      w.menus.after(w.tool);
    } else if (!want && w.tool){ w.tool.remove(); w.tool = null; }
    if (w.tool){ w.tool.querySelector('.xpaddrf b').textContent = 'C:\\MSC Unofficial\\' + w.label; w.tool.querySelector('.xpaddrf i').innerHTML = pic(ic); }
    history_(w);
  }
  /* Back and Forward: the window's own (its frame's), never the tab's */
  const fnav = w => { try { return w.frame && w.frame.contentWindow.navigation || null; } catch { return null; } };
  function history_(w){
    if (!w.tool) return;
    const n = fnav(w), set = (b, ok) => { if (ok) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); };
    set(w.tool.querySelector('.xpback'), !!(n && n.canGoBack)); set(w.tool.querySelector('.xpfwd'), !!(n && n.canGoForward));
  }
  function step(w, d){
    const n = fnav(w); if (!n || !(d < 0 ? n.canGoBack : n.canGoForward)) return;
    try { const r = d < 0 ? n.back() : n.forward(); if (r){ if (r.committed) r.committed.catch(() => {}); if (r.finished) r.finished.catch(() => {}); } } catch {}
  }
  /* a button in the page's own Settings (Tools → Settings…: the timetable's has its own), else the desktop's */
  function inPage(w, sel, alt){
    try { const b = w.frame && w.frame.contentDocument.querySelector(sel); if (b){ w.frame.focus(); b.click(); return; } } catch {}
    alt();
  }
  /* its frame: loaded when it is first shown, kept out of sight until the page in it is ready (or has loaded, or 6 s) */
  function wait(w){ w.el.classList.add('xpfwait'); clearTimeout(w.waitT); w.waitT = setTimeout(() => reveal(w), 6000); }
  function reveal(w){ clearTimeout(w.waitT); w.el.classList.remove('xpfwait'); }
  function load(w){
    if (w.frame) return;
    const f = w.frame = D.createElement('iframe');
    f.className = 'xpframe'; f.title = w.label; f.setAttribute('allowfullscreen', ''); f.src = w.href;
    f.addEventListener('load', () => {
      let u = null; try { u = new URL(f.contentWindow.location.href); } catch {}
      if (u && u.origin === location.origin){
        const p = pageOf(u);
        if (p === 'home' && /^\/(?:home(?:\.html)?)?$/.test(u.pathname)){ close(w); showHome(); return; }   // (Home in a window: the desktop instead)
        if (winPg(p) && p !== w.pg) info(w, { pg:p, href:relHref(u) });
        else if (winPg(p)) w.href = relHref(u);
      }
      reveal(w); history_(w); save();
    });
    wait(w);
    w.body.appendChild(f);
    if (w.min) sleepIn(w, true);
  }
  const sleepIn = (w, v) => { try { const F = w.frame && w.frame.contentWindow.__xpFrame; if (F) F.sleep(v); } catch {} };
  function info(w, i){
    if (!i) return;
    if (i.pg && i.pg !== w.pg && winPg(i.pg)){ const d = list.find(x => x !== w && x.pg === i.pg); if (d) close(d, true); w.pg = i.pg; w.el.dataset.pg = i.pg; }
    if (i.href) w.href = i.href;
    if (i.label) w.label = i.label;
    if (i.title) w.title = i.title;
    dress(w); save();
  }

  function make(rec){
    const w = { pg:rec.pg, href:rec.href, label:rec.label || labelOf(rec.pg), title:'', t:rec.t || Date.now(), min:!!rec.min, max:!!rec.max, g:null, frame:null, tool:null };
    if ([rec.x, rec.y, rec.w, rec.h].every(n => typeof n === 'number' && isFinite(n))) w.g = { x:rec.x, y:rec.y, w:rec.w, h:rec.h };
    const el = w.el = D.createElement('section'); el.className = 'xpfwin'; el.dataset.pg = w.pg;
    el.innerHTML = '<div class="xpfbar"><i class="xpfico" aria-hidden="true"></i><span class="xpftitle"></span></div><div class="xpfbody"></div>' +
      '<span class="xpfedge xpfe" aria-hidden="true"></span><span class="xpfedge xpfs" aria-hidden="true"></span><span class="xpfedge xpfse" aria-hidden="true"></span>';
    w.bar = el.firstChild; w.ico = w.bar.firstChild; w.titleEl = w.bar.lastChild; w.body = el.querySelector('.xpfbody');
    const capEl = caption(['min', 'max', 'close']); w.bar.appendChild(capEl); w.maxBtn = capEl.querySelector('[data-cap="max"]');
    setMaxBtn(w.maxBtn, w.max);
    /* the menu bar: File, View, Favorites, Tools, Help */
    w.menus = menuBar([
      ['File', () => [
        { label:'Desktop', act:showHome },
        { sep:true },
        { label:'Close', act:() => close(w) }
      ]],
      ['View', () => [
        float ? { label:w.max ? 'Restore' : 'Maximise', act:() => maxToggle(w) } : null,
        { label:'Refresh', key:'F5', act:() => { try { w.frame.contentWindow.location.reload(); } catch {} } },
        { sep:true },
        { label:'Dark mode', check:act.isDark(), act:act.dark }
      ]],
      ['Favorites', () => ICONS.map(progItem)],
      ['Tools', () => [
        { label:'Settings…', act:() => inPage(w, '#themebtn,#settings', act.settings) },
        { label:'Display…', act:act.display },
        { label:'Accessibility…', act:act.a11y }
      ]],
      ['Help', () => [
        { label:'What’s new', act:() => act.help('news') },
        { sep:true },
        { label:'About MSC Unofficial', act:() => act.help('about') }
      ]]
    ]);
    w.bar.after(w.menus);
    capEl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cap === 'min') minimise(w); else if (b.dataset.cap === 'max') maxToggle(w); else if (b.dataset.cap === 'close') close(w);
    });
    el.addEventListener('pointerdown', e => { if (S.cur !== w) front(w); grab(w, e); });
    el.addEventListener('focusin', () => { if (S.cur !== w) front(w); });
    w.bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) maxToggle(w); });
    w.shown = () => !w.min;
    w.hide = q => minimise(w, q);
    w.show = () => restore(w, null, true);
    if (w.min) el.classList.add('xpmin');
    w.task = task('page', w.label); w.task.addEventListener('click', () => taskClick(w));
    w.task.xpMenu = () => [
      { label:w.min ? 'Restore' : 'Minimise', act:() => w.min ? restore(w) : minimise(w) },
      float ? { label:w.max ? 'Restore down' : 'Maximise', act:() => { if (w.min) restore(w); maxToggle(w); } } : null,
      { sep:true },
      { label:'Close', act:() => close(w) }
    ];
    dress(w);
    body.appendChild(el);
    place(w);
    return w;
  }

  function front(w){ S.front(w); if (w){ w.t = Date.now(); save(); } }
  function minimise(w, quiet){
    if (w.min) return;
    const had = w.el.contains(D.activeElement), from = titleBox(w);
    w.min = true; w.el.classList.add('xpmin'); w.el.classList.remove('xpon'); sleepIn(w, true);
    if (!quiet){ S.front(S.topmost()); zoom(from, box(w.task), 170); }
    w.task.setAttribute('aria-pressed', 'false'); if (had) w.task.focus();
    mode(); save();
  }
  /* back on the screen (on a phone, alone there): from its taskbar button, or from what opened it */
  function restore(w, from, quiet){
    const was = w.min;
    if (!float) list.forEach(x => { if (x !== w && !x.min) minimise(x, true); });
    w.min = false; w.el.classList.remove('xpmin');
    load(w); place(w); sleepIn(w, false);
    front(w); mode();
    if (!quiet && (was || from)){
      const to = titleBox(w);
      w.el.classList.add('xpfopen');
      zoom(from || box(w.task), to, from ? 210 : 170, () => w.el.classList.remove('xpfopen'));
    }
    save();
  }
  function close(w, quiet){
    const i = list.indexOf(w); if (i < 0) return;
    const had = w.el.contains(D.activeElement);
    list.splice(i, 1); clearTimeout(w.waitT);
    w.el.remove(); w.task.remove();
    if (!quiet){
      const n = float ? S.topmost() : null;   // (on a phone: back to the desktop)
      S.front(n);
      if (had && n && n.frame) try { n.frame.focus({ preventScroll:true }); } catch {}
    }
    mode(); save(); X.sync();
  }
  function maxToggle(w){
    if (!float) return;
    w.max = !w.max; setMaxBtn(w.maxBtn, w.max); place(w);
    const m = lsGet(MAXKEY, {}) || {}; m[w.pg === 'timetable' ? 'timetable' : 'page'] = w.max; lsSet(MAXKEY, m);
    front(w); save();
  }
  function taskClick(w){
    undesk();
    if (w.min) restore(w);
    else if (S.cur === w) minimise(w);
    else front(w);
  }
  /* Home (a link to it, Up, File's Desktop): the pages' windows to the taskbar, Home's own in front */
  function showHome(){
    if (!alive) return;
    undesk();
    const vis = list.filter(w => !w.min).sort((a, b) => +a.el.style.zIndex - +b.el.style.zIndex);
    vis.forEach((w, i) => minimise(w, i < vis.length - 1));
    X.homeFront();
  }
  /* past the most windows: the one minimised longest ago closes, else the one used longest ago */
  function trim(){
    while (list.length >= cap()){
      const pool = list.filter(w => w.min), v = (pool.length ? pool : list).reduce((a, b) => a.t <= b.t ? a : b);
      close(v, true);
    }
  }
  function open(href, from){
    if (!alive) return;
    let u; try { u = new URL(href, location.href); } catch { return; }
    const p = pageOf(u);
    if (!winPage(u)){ location.href = u.href; return; }
    closeMenu();
    D.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch {} });
    undesk();
    const rel = relHref(u);
    let w = list.find(x => x.pg === p);
    if (w){
      /* already open: up it comes; a link with an address of its own (a game, someone's timetable) takes it there */
      if ((u.search || u.hash) && rel !== w.href){ w.href = rel; if (w.frame) try { w.frame.contentWindow.location.assign(u.href); } catch { w.frame.src = rel; } }
      if (w.min) restore(w, from); else { if (!float) list.forEach(x => { if (x !== w && !x.min) minimise(x, true); }); front(w); mode(); }
    } else {
      trim();
      const m = lsGet(MAXKEY, {}) || {};
      w = make({ pg:p, href:rel, max:!!m[p === 'timetable' ? 'timetable' : 'page'], min:true });
      list.push(w); X.sync();
      restore(w, from || null, !from);
    }
    w.focusNext = true;
    if (!w.el.classList.contains('xpfwait')) focusIn(w);
    save();
  }
  const focusIn = w => { w.focusNext = false; try { w.frame.focus({ preventScroll:true }); } catch {} };

  /* the handle a page in a window reaches the desktop by (skins/xp.js in the frame) */
  let alive = true;
  window.__xpDesk = {
    live: () => alive,
    open: (href, from) => open(href, from),
    home: () => showHome(),
    start: () => act.settings(),
    front: f => { const w = byFrame(f); if (w && S.cur !== w && !w.min) front(w); },
    ready: (f, i) => { const w = byFrame(f); if (!w) return; info(w, i); reveal(w); if (w.min) sleepIn(w, true); if (w.focusNext) focusIn(w); },
    info: (f, i) => { const w = byFrame(f); if (w) info(w, i); },
    leaving: f => { const w = byFrame(f); if (w) wait(w); }
  };

  /* links on the desktop (Home's icons and tiles, its Timetable button, the Start menu's programs, a window's Favorites):
     on the body, so a link's own handlers have had their say, and before fx.js's on the document */
  on(body, 'click', e => {
    const a = linkOf(e); if (!a) return;
    const r = where(a.getAttribute('href')); if (!r) return;
    if (r.to === 'win'){ e.preventDefault(); const b = box(a.querySelector('.ico') || a); open(r.u.href, b || recalled()); }
    else if (r.to === 'home'){ e.preventDefault(); showHome(); }
  });
  /* and Home's own goings (location.href = ...), where the browser tells (the Navigation API) */
  if (window.navigation && navigation.addEventListener) on(navigation, 'navigate', e => {
    if (!e.cancelable || e.hashChange || e.downloadRequest || e.formData || e.navigationType !== 'push' || (e.destination && e.destination.sameDocument)) return;
    const r = where(e.destination.url); if (!r || r.to !== 'win') return;
    e.preventDefault(); open(r.u.href, null);
  });

  /* dragging a window by its title bar, resizing it by its right and bottom edges (a mouse or a pen) */
  function grab(w, e){
    if (!float || w.max || e.button !== 0 || e.pointerType === 'touch') return;
    const edge = e.target.closest('.xpfedge'), bar = e.target.closest('.xpfbar');
    if (!edge && (!bar || e.target.closest('button,a,input,.xpcap'))) return;
    e.preventDefault();
    const r = w.el.getBoundingClientRect();
    drag = { w, edge:edge ? (edge.classList.contains('xpfe') ? 'e' : edge.classList.contains('xpfs') ? 's' : 'se') : '', x0:e.clientX, y0:e.clientY, r, id:e.pointerId, moved:false };
    R.classList.add('xpfdrag');
    try { (edge || bar).setPointerCapture(e.pointerId); } catch {}
  }
  on(window, 'pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    drag.moved = true;
    const g = drag.w.g, r = drag.r;
    if (!drag.edge){ g.x = r.left + dx; g.y = r.top + dy; }
    else {
      if (drag.edge !== 's') g.w = Math.max(320, Math.min(r.width + dx, innerWidth - r.left));
      if (drag.edge !== 'e') g.h = Math.max(200, Math.min(r.height + dy, avail() - r.top));
    }
    place(drag.w);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; R.classList.remove('xpfdrag');
    if (d.moved){
      save();
      const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
      addEventListener('click', eat, { capture:true, once:true }); setTimeout(() => removeEventListener('click', eat, true), 0);
    }
  };
  on(window, 'pointerup', end); on(window, 'pointercancel', end);
  on(window, 'resize', () => list.forEach(place));

  /* the windows this tab had open: back as they were (a page from the time before windows had frames comes back
     minimised); a minimised one's page loads when it is first brought up */
  {
    const seen = new Map();
    opened().forEach(r => { if (winPg(r.pg)) seen.set(r.pg, r); });
    let recs = [...seen.values()];
    const n = recs.length - cap();
    if (n > 0){ const drop = new Set(recs.slice().sort((a, b) => (a.t || 0) - (b.t || 0)).slice(0, n)); recs = recs.filter(r => !drop.has(r)); }
    recs.forEach(r => list.push(make(Object.assign({}, r, { min:r.v === 2 ? !!r.min : true }))));
    const vis = list.filter(w => !w.min).sort((a, b) => a.t - b.t);
    if (!float) vis.slice(0, -1).forEach(w => { w.min = true; w.el.classList.add('xpmin'); });
    vis.forEach(w => { if (!w.min){ load(w); S.raise(w.el); } });
    const top = vis[vis.length - 1]; if (top) S.front(top);
    mode(); save();
  }

  /* and all of it away again (another theme): the windows go, the list stays for the next time. Picked from inside a
     window (the Theme finder, its own Settings), the tab goes to that window's page. */
  off.push(() => {
    const a = D.activeElement, w = a && a.classList && a.classList.contains('xpframe') ? byFrame(a) : null;
    const to = w && R.dataset.skin !== 'xp' ? w.href : null;
    alive = false; try { delete window.__xpDesk; } catch {}
    list.forEach(x => { clearTimeout(x.waitT); x.el.remove(); x.task.remove(); });
    list.length = 0;
    R.classList.remove('xptop', 'xpfloat', 'xpfull', 'xpfdrag');
    if (to) setTimeout(() => { location.href = to; }, 0);      // (once everything else is away, the desktop's own link catching too)
  });
  return {
    count: () => list.length,
    mode(v){
      if (v === float) return;
      float = v; R.classList.toggle('xpfloat', v);
      if (!float){ const f = list.filter(w => !w.min).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0]; list.forEach(w => { if (w !== f && !w.min) minimise(w, true); }); }
      list.forEach(place); mode();
    }
  };
}

/* (last, once everything above is defined: the page may already be loaded; a page on its own goes to the desktop at once) */
addEventListener('tt:look', look);
if (D.readyState === 'loading'){ if (!toDesk()) D.addEventListener('DOMContentLoaded', look, { once:true }); } else look();
})();
