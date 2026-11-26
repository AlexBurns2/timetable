/* ═══════════════════════════════════════════════════════════════════
   Suggest: a clean suggestion list under a text box.

   Replaces the browser's own <datalist> dropdown, which was hard to read,
   looked different in every browser, and mixed in saved sign-in names. The
   box is also marked so browsers and password managers leave it alone.

   Suggest.attach(input, {
     source(q)  → items, or a promise of items: [{ value, label, sub? }]
     onPick(item)   called when one is chosen (click, or Enter on a highlighted one)
     min: 1         letters before anything is suggested
     max: 8         rows shown
     delay: 0       ms to wait after typing (for network sources)
     waiting        text (or q => text) shown while the source works; none by default
   A source may return [{ hint:'text' }]: shown as a line of text, not a choice.
   }) → { close(), refresh() }
   Up/Down move, Enter picks the highlighted row, Escape closes.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
"use strict";
const CSS = `
.sgwrap{position:relative}
.sglist{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:50;margin:0;padding:4px;list-style:none;
  background:var(--panel,#fff);color:var(--text,#18181b);border:1px solid var(--line,#e5e5e8);border-radius:var(--radius,12px);
  box-shadow:0 10px 30px rgba(0,0,0,.14);max-height:min(320px,50vh);overflow:auto;min-width:220px}
.sglist[hidden]{display:none}
/* in the top layer (a popover, placed under the box by place()): above everything on the page, whatever it sits in */
.sglist[popover]{inset:auto;margin:0;-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3)}
.sgitem{display:flex;flex-direction:column;gap:1px;padding:8px 10px;border-radius:calc(var(--radius,12px) - 4px);cursor:pointer;
  font-size:0.9375rem;line-height:1.25}
.sgitem .sgl{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sgitem .sgl b{font-weight:800;color:var(--accent,#4f4fd0)}
.sgitem .sgs{font-size:0.75rem;color:var(--muted,#696972);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sgitem[aria-selected="true"],.sgitem:hover{background:var(--panel-2,#f6f6f7)}
.sgempty{padding:8px 10px;font-size:0.8125rem;color:var(--muted,#696972)}
input.sgbox{-webkit-appearance:none;appearance:none}
input.sgbox::-webkit-search-cancel-button{display:none}`;
let styled = false;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/* bold the parts of the label that start with what was typed */
function mark(label, q){
  const words = fold(q).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return esc(label);
  return String(label).split(/(\s+)/).map(part => {
    const f = fold(part), w = words.find(x => f.startsWith(x));
    return w ? '<b>' + esc(part.slice(0, w.length)) + '</b>' + esc(part.slice(w.length)) : esc(part);
  }).join('');
}
let n = 0;

function attach(input, opts){
  opts = Object.assign({ min:1, max:8, delay:0 }, opts || {});
  if (!styled){ const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  /* keep browsers' saved logins and password managers out of it */
  input.type = 'search';
  input.classList.add('sgbox');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-1p-ignore', '');
  input.setAttribute('data-bwignore', '');
  input.setAttribute('data-form-type', 'other');
  input.removeAttribute('list');
  input.name = 'sg' + (++n) + '-' + Math.random().toString(36).slice(2, 7);

  const host = input.parentElement;
  const wrap = document.createElement('span');
  wrap.className = 'sgwrap';
  const cs = getComputedStyle(input);
  wrap.style.display = cs.display === 'block' ? 'block' : 'inline-block';
  if (cs.flexGrow && cs.flexGrow !== '0') wrap.style.flex = cs.flex;
  host.insertBefore(wrap, input);
  wrap.appendChild(input);
  const list = document.createElement('ul');
  const id = 'sglist' + n;
  list.id = id; list.className = 'sglist'; list.setAttribute('role', 'listbox'); list.hidden = true;
  wrap.appendChild(list);
  /* 26 November 2026 (the owner): the list showed under the timetable's own labels, and see-through in glass themes.
     Now it opens in the browser's top layer (a popover: above everything, but still where it is, so themes still style
     it) at the box's place, and gets a solid backing when the theme's panel colour is see-through (TT.solidBg). */
  const pop = typeof list.showPopover === 'function';
  if (pop) list.setAttribute('popover', 'manual');
  const place = () => {
    if (!pop || list.hidden) return;
    const r = wrap.getBoundingClientRect(), w = Math.max(r.width, parseFloat(getComputedStyle(list).minWidth) || 220);
    const left = Math.max(6, Math.min(r.left, innerWidth - w - 6)), top = r.bottom + 6;
    Object.assign(list.style, { position:'fixed', left: left + 'px', top: top + 'px', right:'auto', width: w + 'px',
      maxHeight: Math.max(120, Math.min(320, innerHeight - top - 10)) + 'px' });
  };
  const onMove = () => place();
  const show = () => {
    list.hidden = false;
    if (pop && !list.matches(':popover-open')){ try { list.showPopover(); } catch (e) {}
      addEventListener('scroll', onMove, true); addEventListener('resize', onMove); }
    place();
    if (window.TT && TT.solidBg) TT.solidBg(list);
  };
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');

  let items = [], active = -1, seq = 0, timer = null;
  const close = () => { list.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    if (pop && list.matches(':popover-open')){ try { list.hidePopover(); } catch (e) {} removeEventListener('scroll', onMove, true); removeEventListener('resize', onMove); } };
  const hintOnly = () => items.length === 1 && items[0].hint;
  const paint = q => {
    if (!items.length){ close(); return; }
    if (hintOnly()){        /* a line of text, not a choice: "Searching…", "No one matches" */
      list.innerHTML = '<li class="sgempty" role="status">' + esc(items[0].hint) + '</li>';
      show(); input.setAttribute('aria-expanded', 'true'); input.removeAttribute('aria-activedescendant');
      return;
    }
    list.innerHTML = items.map((it, i) =>
      '<li class="sgitem" role="option" id="' + id + '-' + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '">' +
      '<span class="sgl">' + mark(it.label, q) + '</span>' + (it.sub ? '<span class="sgs">' + esc(it.sub) + '</span>' : '') + '</li>').join('');
    show();
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', id + '-' + active); else input.removeAttribute('aria-activedescendant');
    const a = list.querySelector('[aria-selected="true"]'); if (a) a.scrollIntoView({ block:'nearest' });
  };
  const refresh = () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < opts.min){ items = []; close(); return; }
    const mine = ++seq;
    const wait = typeof opts.waiting === 'function' ? opts.waiting(q) : opts.waiting;
    if (wait && document.activeElement === input){ items = [{ hint:wait }]; active = -1; paint(q); }
    const run = async () => {
      let got = [];
      try { got = await opts.source(q); } catch { got = []; }
      if (mine !== seq || document.activeElement !== input) return;
      items = (got || []).slice(0, opts.max); active = -1; paint(q);
    };
    if (opts.delay) timer = setTimeout(run, opts.delay); else run();
  };
  const choose = i => {
    const it = items[i]; if (!it || it.hint) return;
    input.value = it.value; close();
    if (opts.onPick) opts.onPick(it);
  };
  input.addEventListener('input', refresh);
  input.addEventListener('focus', () => { if (input.value.trim().length >= opts.min) refresh(); });
  input.addEventListener('keydown', e => {
    if (list.hidden) return;
    if (hintOnly()){ if (e.key === 'Escape'){ e.preventDefault(); close(); } return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); active = (active + 1) % items.length; paint(input.value.trim()); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(input.value.trim()); }
    else if (e.key === 'Enter' && active >= 0){ e.preventDefault(); e.stopImmediatePropagation(); choose(active); }
    else if (e.key === 'Escape'){ e.preventDefault(); close(); }
  }, true);       // capture: runs before the page's own Enter handler on the same box
  /* mousedown, not click: it lands before the box loses focus */
  list.addEventListener('mousedown', e => { const li = e.target.closest('.sgitem'); if (li){ e.preventDefault(); choose(+li.dataset.i); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { close, refresh };
}

/* the usual source for a list of names: every word typed starts a word of the name */
function names(list, max){
  return q => {
    const words = fold(q).split(/[\s,]+/).filter(Boolean);
    const scored = [];
    for (const nm of list){
      const parts = fold(nm).split(/[\s'-]+/);
      if (!words.every(w => parts.some(p => p.startsWith(w)))) continue;
      scored.push({ nm, s: fold(nm).startsWith(words.join(' ')) ? 0 : parts[0].startsWith(words[0]) ? 1 : 2 });
    }
    return scored.sort((a, b) => a.s - b.s || a.nm.localeCompare(b.nm)).slice(0, max || 8).map(x => ({ value:x.nm, label:x.nm }));
  };
}

window.Suggest = { attach, names };
})();
