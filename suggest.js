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
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');

  let items = [], active = -1, seq = 0, timer = null;
  const close = () => { list.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const paint = q => {
    if (!items.length){ close(); return; }
    list.innerHTML = items.map((it, i) =>
      '<li class="sgitem" role="option" id="' + id + '-' + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '">' +
      '<span class="sgl">' + mark(it.label, q) + '</span>' + (it.sub ? '<span class="sgs">' + esc(it.sub) + '</span>' : '') + '</li>').join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', id + '-' + active); else input.removeAttribute('aria-activedescendant');
    const a = list.querySelector('[aria-selected="true"]'); if (a) a.scrollIntoView({ block:'nearest' });
  };
  const refresh = () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < opts.min){ items = []; close(); return; }
    const mine = ++seq;
    const run = async () => {
      let got = [];
      try { got = await opts.source(q); } catch { got = []; }
      if (mine !== seq || document.activeElement !== input) return;
      items = (got || []).slice(0, opts.max); active = -1; paint(q);
    };
    if (opts.delay) timer = setTimeout(run, opts.delay); else run();
  };
  const choose = i => {
    const it = items[i]; if (!it) return;
    input.value = it.value; close();
    if (opts.onPick) opts.onPick(it);
  };
  input.addEventListener('input', refresh);
  input.addEventListener('focus', () => { if (input.value.trim().length >= opts.min) refresh(); });
  input.addEventListener('keydown', e => {
    if (list.hidden) return;
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
