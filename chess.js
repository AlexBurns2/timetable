/* Chess rules and a small bot, shared by three places:
     - games.js (the Chess game), loaded with a <script> tag, as globalThis.Chess
     - itself as a Web Worker, so the bot thinks without freezing the page
     - api/gamestate.js (mode=chess), which imports it to check every online move
   No DOM and no exports, so the same file works in all three.

   A position: { b: 64 squares (index = row*8+col, row 0 is rank 8; 'P' white, 'p' black, null empty),
                 t: 'w'|'b' to move, c: castling rights 'KQkq' or '', ep: en-passant square or -1,
                 h: half-moves since a capture or pawn move, n: full-move number }
   A move: { from, to, promo } with promo 'q'|'r'|'b'|'n' (lower case), written as UCI 'e2e4', 'e7e8q'. */
(function () {
  'use strict';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';
  const sqName = i => FILES[i & 7] + (8 - (i >> 3));
  const sqIndex = s => (8 - +s[1]) * 8 + FILES.indexOf(s[0]);
  const isW = p => p && p === p.toUpperCase();
  const colorOf = p => p ? (isW(p) ? 'w' : 'b') : null;
  const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]], ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

  function parseFen(fen) {
    const [rows, t, c, ep, h, n] = fen.split(' ');
    const b = [];
    for (const ch of rows.replace(/\//g, '')) {
      if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) b.push(null); else b.push(ch);
    }
    return { b, t, c: c === '-' ? '' : c, ep: ep === '-' ? -1 : sqIndex(ep), h: +h || 0, n: +n || 1 };
  }
  function fen(s) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let f = 0; f < 8; f++) { const p = s.b[r * 8 + f]; if (!p) e++; else { if (e) out += e; e = 0; out += p; } }
      if (e) out += e; if (r < 7) out += '/';
    }
    return out + ' ' + s.t + ' ' + (s.c || '-') + ' ' + (s.ep < 0 ? '-' : sqName(s.ep)) + ' ' + s.h + ' ' + s.n;
  }

  /* is square sq attacked by colour by? */
  function attacked(b, sq, by) {
    const r = sq >> 3, f = sq & 7, w = by === 'w';
    const at = (rr, ff) => rr >= 0 && rr < 8 && ff >= 0 && ff < 8 ? b[rr * 8 + ff] : undefined;
    const pr = w ? r + 1 : r - 1, P = w ? 'P' : 'p';
    if (at(pr, f - 1) === P || at(pr, f + 1) === P) return true;
    const N = w ? 'N' : 'n', K = w ? 'K' : 'k';
    for (const [dr, df] of KN) if (at(r + dr, f + df) === N) return true;
    for (const [dr, df] of KG) if (at(r + dr, f + df) === K) return true;
    const slide = (dirs, a, c) => {
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const p = b[rr * 8 + ff];
          if (p) { if (p === a || p === c) return true; break; }
          rr += dr; ff += df;
        }
      }
      return false;
    };
    return slide(DIAG, w ? 'B' : 'b', w ? 'Q' : 'q') || slide(ORTH, w ? 'R' : 'r', w ? 'Q' : 'q');
  }
  const kingSq = (b, col) => b.indexOf(col === 'w' ? 'K' : 'k');
  const inCheck = (s, col = s.t) => attacked(s.b, kingSq(s.b, col), col === 'w' ? 'b' : 'w');

  /* every move the side to move could make, before checking it leaves its king safe */
  function pseudo(s) {
    const { b, t } = s, out = [], opp = t === 'w' ? 'b' : 'w';
    const add = (from, to) => {
      if ((b[from] === 'P' && to < 8) || (b[from] === 'p' && to >= 56)) for (const promo of 'qrbn') out.push({ from, to, promo });
      else out.push({ from, to });
    };
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || colorOf(p) !== t) continue;
      const r = i >> 3, f = i & 7, k = p.toLowerCase();
      if (k === 'p') {
        const d = t === 'w' ? -1 : 1, r1 = r + d;
        if (r1 < 0 || r1 > 7) continue;
        if (!b[r1 * 8 + f]) {
          add(i, r1 * 8 + f);
          const home = t === 'w' ? 6 : 1;
          if (r === home && !b[(r + 2 * d) * 8 + f]) add(i, (r + 2 * d) * 8 + f);
        }
        for (const df of [-1, 1]) {
          const ff = f + df; if (ff < 0 || ff > 7) continue;
          const to = r1 * 8 + ff;
          if ((b[to] && colorOf(b[to]) === opp) || to === s.ep) add(i, to);
        }
      } else if (k === 'n' || k === 'k') {
        for (const [dr, df] of k === 'n' ? KN : KG) {
          const rr = r + dr, ff = f + df;
          if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
          const to = rr * 8 + ff;
          if (!b[to] || colorOf(b[to]) === opp) add(i, to);
        }
        if (k === 'k') {
          const home = t === 'w' ? 60 : 4, [KS, QS] = t === 'w' ? ['K', 'Q'] : ['k', 'q'];
          if (i === home && !inCheck(s)) {
            if (s.c.includes(KS) && !b[home + 1] && !b[home + 2] && !attacked(b, home + 1, opp) && !attacked(b, home + 2, opp)) out.push({ from: i, to: home + 2 });
            if (s.c.includes(QS) && !b[home - 1] && !b[home - 2] && !b[home - 3] && !attacked(b, home - 1, opp) && !attacked(b, home - 2, opp)) out.push({ from: i, to: home - 2 });
          }
        }
      } else {
        const dirs = k === 'b' ? DIAG : k === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [dr, df] of dirs) {
          let rr = r + dr, ff = f + df;
          while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
            const to = rr * 8 + ff;
            if (b[to]) { if (colorOf(b[to]) === opp) out.push({ from: i, to }); break; }
            out.push({ from: i, to });
            rr += dr; ff += df;
          }
        }
      }
    }
    return out;
  }

  /* the position after move m (m assumed pseudo-legal). The new position remembers what was taken in .x */
  function make(s, m) {
    const b = s.b.slice(), p = b[m.from], k = p.toLowerCase();
    let x = b[m.to];
    if (k === 'p' && m.to === s.ep && !x) { const cap = m.to + (s.t === 'w' ? 8 : -8); x = b[cap]; b[cap] = null; }
    b[m.to] = m.promo ? (s.t === 'w' ? m.promo.toUpperCase() : m.promo) : p;
    b[m.from] = null;
    if (k === 'k' && Math.abs(m.to - m.from) === 2) {             // castling: bring the rook across
      const rFrom = m.to > m.from ? m.from + 3 : m.from - 4, rTo = m.to > m.from ? m.from + 1 : m.from - 1;
      b[rTo] = b[rFrom]; b[rFrom] = null;
    }
    let c = s.c;
    const drop = (sq, rights) => { if (m.from === sq || m.to === sq) c = c.replace(new RegExp('[' + rights + ']', 'g'), ''); };
    drop(60, 'KQ'); drop(4, 'kq'); drop(63, 'K'); drop(56, 'Q'); drop(7, 'k'); drop(0, 'q');
    return {
      b, t: s.t === 'w' ? 'b' : 'w', c,
      ep: k === 'p' && Math.abs(m.to - m.from) === 16 ? (m.to + m.from) / 2 : -1,
      h: k === 'p' || x ? 0 : s.h + 1, n: s.t === 'b' ? s.n + 1 : s.n, x: x || null
    };
  }

  const moves = s => pseudo(s).filter(m => !inCheck(make(s, m), s.t));
  const uci = m => sqName(m.from) + sqName(m.to) + (m.promo || '');
  const fromUci = (s, u) => moves(s).find(m => uci(m) === String(u).toLowerCase()) || null;

  /* standard algebraic notation, e.g. Nbd7, exd6, O-O, e8=Q+ */
  function san(s, m) {
    const p = s.b[m.from], k = p.toLowerCase(), after = make(s, m);
    let out;
    if (k === 'k' && Math.abs(m.to - m.from) === 2) out = m.to > m.from ? 'O-O' : 'O-O-O';
    else {
      const cap = !!s.b[m.to] || (k === 'p' && m.to === s.ep);
      if (k === 'p') out = (cap ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      else {
        const rivals = moves(s).filter(o => o.to === m.to && o.from !== m.from && s.b[o.from] === p);
        let dis = '';
        if (rivals.length) {
          const sameFile = rivals.some(o => (o.from & 7) === (m.from & 7)), sameRank = rivals.some(o => (o.from >> 3) === (m.from >> 3));
          dis = !sameFile ? FILES[m.from & 7] : !sameRank ? sqName(m.from)[1] : sqName(m.from);
        }
        out = k.toUpperCase() + dis + (cap ? 'x' : '') + sqName(m.to);
      }
    }
    if (inCheck(after)) out += moves(after).length ? '+' : '#';
    return out;
  }

  /* what counts for threefold repetition: pieces, side to move, castling, and en passant only when a pawn could take */
  function key(s) {
    let ep = '-';
    if (s.ep >= 0) {
      const P = s.t === 'w' ? 'P' : 'p', r = (s.ep >> 3) + (s.t === 'w' ? 1 : -1), f = s.ep & 7;
      if ((f > 0 && s.b[r * 8 + f - 1] === P) || (f < 7 && s.b[r * 8 + f + 1] === P)) ep = s.ep;
    }
    return s.b.map(p => p || '.').join('') + s.t + s.c + ep;
  }

  function insufficient(b) {
    const rest = [];
    b.forEach((p, i) => { if (p && p.toLowerCase() !== 'k') rest.push([p.toLowerCase(), ((i >> 3) + (i & 7)) & 1]); });
    if (!rest.length) return true;
    if (rest.length === 1 && (rest[0][0] === 'b' || rest[0][0] === 'n')) return true;
    return rest.every(([k]) => k === 'b') && rest.every(([, sq]) => sq === rest[0][1]);   // bishops all on one colour
  }

  /* play a list of UCI moves from the start. Returns { states, sans, ok } — ok false at the first illegal move */
  function replay(list) {
    const states = [parseFen(START)], sans = [];
    for (const u of list || []) {
      const s = states[states.length - 1], m = fromUci(s, u);
      if (!m) return { states, sans, ok: false };
      sans.push(san(s, m)); states.push(make(s, m));
    }
    return { states, sans, ok: true };
  }

  /* is the game over at the last state? → { result:'1-0'|'0-1'|'1/2-1/2', reason } or null */
  function outcome(states) {
    const s = states[states.length - 1];
    if (!moves(s).length) return inCheck(s) ? { result: s.t === 'w' ? '0-1' : '1-0', reason: 'checkmate' } : { result: '1/2-1/2', reason: 'stalemate' };
    if (insufficient(s.b)) return { result: '1/2-1/2', reason: 'insufficient material' };
    if (s.h >= 100) return { result: '1/2-1/2', reason: 'the 50-move rule' };
    const k = key(s);
    if (states.filter(x => key(x) === k).length >= 3) return { result: '1/2-1/2', reason: 'threefold repetition' };
    return null;
  }

  /* ── the bot: negamax with alpha-beta, captures searched to the end, piece-square tables ── */
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  /* from White's side, row 0 = rank 8 */
  const PST = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    ke: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
  };
  /* score for the side to move, in centipawns */
  function evaluate(s) {
    let sc = 0, heavy = 0;
    for (const p of s.b) if (p && 'qQ'.includes(p)) heavy++;
    const endgame = heavy === 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i]; if (!p) continue;
      const k = p.toLowerCase(), w = p !== k, sq = w ? i : (7 - (i >> 3)) * 8 + (i & 7);
      const v = VAL[k] + PST[k === 'k' && endgame ? 'ke' : k][sq];
      sc += w ? v : -v;
    }
    return s.t === 'w' ? sc : -sc;
  }
  const MATE = 100000;
  const order = (s, list) => list.map(m => [m, (s.b[m.to] ? 10 * VAL[s.b[m.to].toLowerCase()] - VAL[s.b[m.from].toLowerCase()] + 1000 : 0) + (m.promo === 'q' ? 900 : 0)])
    .sort((a, b) => b[1] - a[1]).map(x => x[0]);

  function search(root, depth, deadline, noise) {
    let nodes = 0;
    const timeUp = () => (++nodes & 1023) === 0 && Date.now() > deadline;
    let stop = false;
    function quiesce(s, a, b, qd) {
      const stand = evaluate(s);
      if (stand >= b) return b;
      if (stand > a) a = stand;
      if (qd > 6) return a;
      for (const m of order(s, pseudo(s).filter(m => s.b[m.to] || m.promo))) {
        const n = make(s, m);
        if (inCheck(n, s.t)) continue;
        const v = -quiesce(n, -b, -a, qd + 1);
        if (v >= b) return b;
        if (v > a) a = v;
      }
      return a;
    }
    function nega(s, d, a, b, ply) {
      if (stop || (stop = timeUp())) return 0;
      if (d <= 0) return quiesce(s, a, b, 0);
      let any = false;
      for (const m of order(s, pseudo(s))) {
        const n = make(s, m);
        if (inCheck(n, s.t)) continue;
        any = true;
        const v = -nega(n, d - 1, -b, -a, ply + 1);
        if (v >= b) return b;
        if (v > a) a = v;
      }
      if (!any) return inCheck(s) ? -MATE + ply : 0;
      return a;
    }
    let best = null, bestV = -Infinity;
    for (const m of order(root, moves(root))) {
      const v = -nega(make(root, m), depth - 1, -MATE - 1, MATE + 1, 1) + (noise ? (Math.random() * 2 - 1) * noise : 0);
      if (stop) break;
      if (v > bestV) { bestV = v; best = m; }
    }
    return stop ? null : best;
  }

  const LEVELS = { easy: { depth: 1, noise: 220, ms: 400 }, medium: { depth: 3, noise: 25, ms: 1200 }, hard: { depth: 5, noise: 0, ms: 2500 } };
  /* the bot's move as UCI for a list of UCI moves played so far, or null if the game is over */
  function botMove(list, level) {
    const L = LEVELS[level] || LEVELS.medium, { states } = replay(list), s = states[states.length - 1];
    const legal = moves(s);
    if (!legal.length) return null;
    const deadline = Date.now() + L.ms;
    let best = null;
    for (let d = 1; d <= L.depth; d++) {                          // deepen while time allows
      const m = search(s, d, deadline, L.noise);
      if (!m) break;
      best = m;
    }
    return uci(best || legal[0]);
  }

  const Chess = { START, parseFen, fen, sqName, sqIndex, moves, make, inCheck, san, uci, fromUci, key, replay, outcome, botMove, colorOf, LEVELS };
  globalThis.Chess = Chess;
  /* run as a Web Worker: { moves, level } in, { move } out */
  if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope)
    globalThis.onmessage = e => globalThis.postMessage({ id: e.data.id, move: botMove(e.data.moves, e.data.level) });
})();
