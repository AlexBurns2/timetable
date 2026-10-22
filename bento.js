/* ── packed tile grid (games, home, resources) ────────────────────────────
   Every tile takes w × h cells (1×1 by default). They are placed in list
   order, each in the first gap it fits (so a big tile never leaves a hole
   behind it), then any cell still empty is closed up by stretching a
   neighbouring tile into it — the grid never shows a gap, whatever the
   column count. Re-packed whenever the column count changes.

   Bento.layout(box, items, colsFor)
     box      the grid element (give it class "bento" plus a row height)
     items    [{ el, w, h }] in the order they should appear
     colsFor  width → column count (default: 4 / 3 / 2)
   Returns a function that stops watching for resizes. */
(function(){
const defaultCols = width => width >= 860 ? 4 : width >= 540 ? 3 : 2;

function pack(sizes, cols){
  const at = [], tiles = [];
  const cell = (r, c) => (at[r] || [])[c];
  const put = (t, r, c) => { (at[r] = at[r] || [])[c] = t; };
  const claim = t => { for (let y = t.r; y < t.r + t.h; y++) for (let x = t.c; x < t.c + t.w; x++) put(t, y, x); };
  const fits = (r, c, w, h) => { if (c + w > cols) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (cell(y, x)) return false;
    return true; };
  sizes.forEach(({ w, h }) => {
    w = Math.min(w || 1, cols); h = h || 1;
    for (let r = 0; ; r++) for (let c = 0; c < cols; c++) if (fits(r, c, w, h)){
      const t = { r, c, w, h }; tiles.push(t); claim(t);
      return;
    }
  });
  const colFree = (t, x) => { for (let y = t.r; y < t.r + t.h; y++) if (cell(y, x)) return false; return true; };
  const rowFree = (t, y) => { for (let x = t.c; x < t.c + t.w; x++) if (cell(y, x)) return false; return true; };
  const rows = at.length;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){
    if (cell(r, c)) continue;
    const L = cell(r, c - 1), U = r ? cell(r - 1, c) : null, R = cell(r, c + 1), D = cell(r + 1, c);
    let t;
    if (L && L.c + L.w === c && colFree(L, c)){ t = L; t.w++; }
    else if (U && U.r + U.h === r && rowFree(U, r)){ t = U; t.h++; }
    else if (R && R.c === c + 1 && colFree(R, c)){ t = R; t.c--; t.w++; }
    else if (D && D.r === r + 1 && rowFree(D, r)){ t = D; t.r--; t.h++; }
    else { t = { r, c, w:1, h:1, filler:true }; tiles.push(t); }   // nothing can stretch: a plain tile
    claim(t);
  }
  return tiles;
}

function layout(box, items, colsFor){
  colsFor = colsFor || defaultCols;
  if (box._bentoStop) box._bentoStop();
  let cols = 0;
  const lay = () => {
    const n = colsFor(box.clientWidth || window.innerWidth);
    if (n === cols) return; cols = n;
    box.style.setProperty('--cols', n);
    box.querySelectorAll(':scope > .bentofill').forEach(f => f.remove());
    pack(items.map(it => ({ w:it.w, h:it.h })), n).forEach((t, i) => {
      let el = t.filler ? null : items[i].el;
      if (!el){ el = document.createElement('div'); el.className = 'bentofill'; box.appendChild(el); }
      el.style.gridColumn = (t.c + 1) + ' / span ' + t.w;
      el.style.gridRow = (t.r + 1) + ' / span ' + t.h;
      el.classList.toggle('wide', t.w > 1); el.classList.toggle('tall', t.h > 1);
    });
  };
  lay();
  let obs = null;
  if (window.ResizeObserver){ obs = new ResizeObserver(lay); obs.observe(box); }
  return box._bentoStop = () => { if (obs) obs.disconnect(); obs = null; box._bentoStop = null; };
}

window.Bento = { pack, layout };
})();
