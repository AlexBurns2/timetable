/* ══════════════════════════════════════════════════════════════════════════
   YEAR 12 (HSC) REVISION CONTENT

   Loaded after games.js on the revision page, so it uses that file's helpers
   (mc, qty, ri, pk, rd, polyStr…) and registers itself into GAMES and BUILD.
   Kept separate because games.js is already ~440 KB and the HSC subjects add
   as much again.

   Which syllabus each subject follows for the 2027 HSC (checked against NESA):
     Maths Adv / Ext1 / Ext2   Mathematics 11–12 (2024)      first HSC 2027
     English Advanced          English 11–12 (2024)          first HSC 2027
     Physics                   Physics Stage 6 (2017)        new one is 2028
     Chemistry                 Chemistry Stage 6 (2017)      new one is 2029
     Engineering Studies       Engineering Studies (2011)    no replacement

   Questions are written to the syllabus and in HSC style. Nothing is copied
   from a past paper, a trial paper or a marking guideline: those inform the
   shape and the difficulty, not the words. Every computed answer carries
   `data` so a checker can re-derive it independently.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── small shared helpers ───────────────────────────────────────────────── */
/* The site writes a minus as − (U+2212). A generator that drops a negative
   number straight into a string gives an ASCII hyphen instead, which reads
   wrong beside the rest of the maths. This repairs a hyphen that sits in front
   of a number and leaves "x-axis" and "modulus–argument" alone. Applied to
   every Year 12 generator at the bottom of this file, so new content gets it
   without anyone having to remember. */
const MINUS_RE = /(^|[\s(>=,\[:+×÷\/−-])-(?=[\d.])/g;
const fixMinus = s => (typeof s === 'string' ? s.replace(MINUS_RE, '$1−') : s);
function tidyQ(gen){
  return function(){
    const q = gen();
    q.q = fixMinus(q.q);
    if (q.note) q.note = fixMinus(q.note);
    if (q.choices){                       // the answer must stay identical to its option
      const was = q.choices.slice();
      let fixed = was.map(fixMinus);
      const i = was.indexOf(q.answer);
      q.answer = i >= 0 ? fixed[i] : fixMinus(q.answer);
      /* two options that differed only in which minus sign they used are the
         same option once this has run, so keep the first of each */
      q.choices = fixed.filter((c, j) => fixed.indexOf(c) === j);
    }
    return q;
  };
}

/* games.js has sup() for superscript digits; subscripts and bracketed
   exponents need their own. Option buttons are plain text, so an exponent that
   isn't a bare number is written with a caret: e^(3x + 2), not e³ˣ⁺². */
const SUB_CH = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','-':'₋' };
const sub = n => String(n).split('').map(c => SUB_CH[c] || c).join('');
const pow = (base, ex) => base + (/^-?\d+$/.test(String(ex)) ? sup(ex) : '^(' + ex + ')');
const hscNum = (x, d) => {
  const v = rd(x, d == null ? 2 : d);
  return String(Object.is(v, -0) ? 0 : v);
};
/* multiple choice over numbers, with the near-misses rounded the same way */
function numMC(val, wrongs, dp){
  const a = neg(hscNum(val, dp));
  return mc(a, wrongs.map(w => neg(hscNum(w, dp))).filter(w => w !== a && isFinite(+String(w).replace('−', '-'))));
}
const money = v => '$' + (Math.round(v * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function moneyMC(val, wrongs){
  const a = money(val);
  return mc(a, wrongs.map(money).filter(w => w !== a));
}
/* a typed money answer: "$1,234.56", "1234.56" and "1235" all read the same */
const moneyQ = (val, tol) => qty(val, { tol: tol == null ? 0.5 : tol });
/* π as it is written in an answer: 2π/3, π/2, 4π */
function piStr(num, den){
  const g = gcd2(Math.abs(num), Math.abs(den));
  const n = num / g, d = den / g;
  const top = (Math.abs(n) === 1 ? '' : Math.abs(n)) + 'π';
  return (n < 0 ? '−' : '') + (d === 1 ? top : top + '/' + d);
}
const signed = n => (n < 0 ? '− ' + Math.abs(n) : '+ ' + n);
/* the minus sign the rest of the site uses, not a hyphen */
const neg = x => String(x).replace(/-/g, '−');
/* "+ 3x²" but nothing at all when the coefficient is zero */
const plusTerm = (c, body) => c === 0 ? '' : ' ' + (c < 0 ? '−' : '+') + ' ' + (Math.abs(c) === 1 && body ? '' : Math.abs(c)) + body;
/* exact fractions, the way an answer is written: 1/35, −3/4, 2 */
function fracStr(num, den){
  if (den < 0){ num = -num; den = -den; }
  const g = gcd2(Math.abs(num), Math.abs(den)) || 1;
  const n = num / g, d = den / g;
  return d === 1 ? String(n).replace('-', '−') : String(n).replace('-', '−') + '/' + d;
}
/* x-term the way it is written: 3x, −x, x */
const xTerm = (c, v) => (c === 1 ? '' : c === -1 ? '−' : String(c)) + (v || 'x');

/* ══ MATHEMATICS ADVANCED — YEAR 12 ══════════════════════════════════════
   Focus areas, as the 2024 syllabus names them:
     Further graph transformations and modelling · Sequences and series ·
     Differential calculus · Integral calculus · Applications of calculus ·
     Random variables · Financial mathematics                              */

/* ── Transformations of trigonometric functions ──────────────────────────
   y = a sin(b(x − c)) + d: amplitude |a|, period 2π/b, centre line y = d. */
function genMaTrig(){
  const a = pk([2, 3, 4, 5, 1.5]), b = pk([1, 2, 3, 4]), d = nzr(-4, 5), fn = pk(['sin', 'cos']);
  const k = ri(0, 3);
  const eq = (a === 1 ? '' : a) + ' ' + fn + '(' + xTerm(b) + ')' + ' ' + signed(d);
  if (k === 0){
    const m = numMC(a, [a + d, b, Math.abs(d), a * b]);
    return { q:'What is the amplitude of <b>y = ' + eq + '</b>?', choices:m.choices, answer:m.answer,
      data:{ kind:'amp', a, b, d }, note:'The amplitude is the number multiplying ' + fn + ': ' + a + '. The ' + signed(d).replace('+ ', '+') + ' moves the centre line, it does not stretch the curve.' };
  }
  if (k === 1){
    const right = piStr(2, b);
    const m = mc(right, [piStr(1, b), piStr(2 * b, 1), piStr(b, 2), piStr(2, b * 2)].filter(x => x !== right));
    return { q:'What is the period of <b>y = ' + eq + '</b>?', choices:m.choices, answer:m.answer,
      data:{ kind:'period', b }, note:'Period = 2π ÷ b = 2π ÷ ' + b + ' = ' + right + '.' };
  }
  if (k === 2){
    const lo = d - a, hi = d + a;
    const right = hscNum(lo) + ' ≤ y ≤ ' + hscNum(hi);
    const m = mc(right, [hscNum(-a) + ' ≤ y ≤ ' + hscNum(a), hscNum(d) + ' ≤ y ≤ ' + hscNum(hi),
                         hscNum(lo - a) + ' ≤ y ≤ ' + hscNum(hi + a), hscNum(d - a * b) + ' ≤ y ≤ ' + hscNum(d + a * b)]);
    return { q:'What is the range of <b>y = ' + eq + '</b>?', choices:m.choices, answer:m.answer,
      data:{ kind:'range', a, d }, note:'The curve swings ' + a + ' either side of y = ' + d + ', so ' + right + '.' };
  }
  const c = pk([1, 2, 3, 4]);
  const shifted = (a === 1 ? '' : a) + ' ' + fn + '(' + xTerm(b) + ' − ' + (b * c) + ')';
  const right = hscNum(c) + ' units right';
  const m = mc(right, [hscNum(c) + ' units left', hscNum(b * c) + ' units right', hscNum(b * c) + ' units left']);
  return { q:'<b>y = ' + shifted + '</b> is <b>y = ' + (a === 1 ? '' : a) + ' ' + fn + '(' + xTerm(b) + ')</b> moved how far?',
    choices:m.choices, answer:m.answer, data:{ kind:'shift', b, c },
    note:'Factorise the bracket first: ' + xTerm(b) + ' − ' + (b * c) + ' = ' + b + '(x − ' + c + '), so the shift is ' + c + ' to the right, not ' + (b * c) + '.' };
}

/* ── Modelling with functions ──────────────────────────────────────────── */
function genMaModel(){
  const k = ri(0, 2);
  if (k === 0){                                   // exponential growth or decay
    const P0 = ri(2, 9) * 500, pct = pk([3, 4, 5, 6, 8, 12]), grow = Math.random() < 0.6;
    const r = grow ? 1 + pct / 100 : 1 - pct / 100, t = ri(3, 12);
    const P = P0 * Math.pow(r, t);
    return { q:'A population of <b>' + P0 + '</b> ' + (grow ? 'grows' : 'falls') + ' by <b>' + pct + '%</b> each year. ' +
        'What is it after <b>' + t + ' years</b>, to the nearest whole number?',
      input:true, answer:Math.round(P), accept:qty(Math.round(P), { tol:Math.max(1, P * 0.005) }),
      data:{ kind:'exp', P0, r, t },
      note:'P = ' + P0 + ' × ' + rd(r, 2) + (t > 1 ? sup(t) : '') + ' = ' + rd(P, 1) + ', so ' + Math.round(P) + '.' };
  }
  if (k === 1){                                   // when does it reach a value
    const P0 = ri(2, 6) * 1000, pct = pk([4, 5, 6, 8, 10]), r = 1 + pct / 100;
    const target = P0 * pk([1.5, 2, 2.5, 3]);
    const t = Math.log(target / P0) / Math.log(r);
    return { q:'A population of <b>' + P0 + '</b> grows by <b>' + pct + '%</b> a year. After how many whole years does it first exceed <b>' + Math.round(target) + '</b>?',
      input:true, answer:Math.ceil(t), accept:qty(Math.ceil(t), { tol:0.001 }),
      data:{ kind:'when', P0, r, target },
      note:'Solve ' + P0 + ' × ' + rd(r, 2) + 'ᵗ = ' + Math.round(target) + ': t = log(' + rd(target / P0, 2) + ') ÷ log(' + rd(r, 2) + ') = ' + rd(t, 2) + ', so the ' + Math.ceil(t) + 'th year.' };
  }
  /* quadratic model: height of a projectile-style path, vertex gives the maximum */
  const u = ri(10, 30), g = 10, h0 = ri(0, 3) * 5;
  const tMax = u / g, hMax = h0 + u * tMax - g * tMax * tMax / 2;
  const m = numMC(hMax, [h0 + u * tMax, u * tMax - g * tMax * tMax, hMax + u / 2, u * u / g, hMax / 2], 1);
  return { q:'A ball is thrown so its height is <b>h = ' + (h0 ? h0 + ' + ' : '') + u + 't − 5t²</b> metres after t seconds. What is its greatest height, in metres?',
    choices:m.choices, answer:m.answer, data:{ kind:'vertex', u, h0 },
    note:'h is greatest where h′ = ' + u + ' − 10t = 0, so t = ' + rd(tMax, 2) + ' s, giving h = ' + rd(hMax, 1) + ' m.' };
}

/* ── Sequences and series: arithmetic ──────────────────────────────────── */
function genMaAP(){
  const a = nzr(-12, 20), d = nzr(-9, 9), k = ri(0, 3);
  if (k === 0){
    const n = ri(8, 40), T = a + (n - 1) * d;
    return { q:'An arithmetic sequence starts at <b>a = ' + a + '</b> with <b>d = ' + d + '</b>. Find <b>T<sub>' + n + '</sub></b>.',
      input:true, answer:T, accept:qty(T, { tol:0 }), data:{ kind:'ap-T', a, d, n },
      note:'Tₙ = a + (n − 1)d = ' + a + ' + ' + (n - 1) + '(' + d + ') = ' + T + '.' };
  }
  if (k === 1){
    const n = ri(8, 25), S = n / 2 * (2 * a + (n - 1) * d);
    return { q:'An arithmetic series starts at <b>a = ' + a + '</b> with <b>d = ' + d + '</b>. Find <b>S<sub>' + n + '</sub></b>.',
      input:true, answer:S, accept:qty(S, { tol:0.01 }), data:{ kind:'ap-S', a, d, n },
      note:'Sₙ = n/2 (2a + (n − 1)d) = ' + n + '/2 (' + (2 * a) + ' + ' + (n - 1) + '×' + d + ') = ' + S + '.' };
  }
  if (k === 2){                                   // two terms given, find d then a term
    const p = ri(3, 6), q = ri(9, 15), Tp = a + (p - 1) * d, Tq = a + (q - 1) * d, n = ri(16, 30);
    const T = a + (n - 1) * d;
    const m = numMC(T, [Tq + (n - q) * (Tq - Tp), a + n * d, Tp + (n - p) * d * 2, T + d]);
    return { q:'In an arithmetic sequence <b>T<sub>' + p + '</sub> = ' + Tp + '</b> and <b>T<sub>' + q + '</sub> = ' + Tq + '</b>. Find <b>T<sub>' + n + '</sub></b>.',
      choices:m.choices, answer:m.answer, data:{ kind:'ap-two', p, Tp, q, Tq, n },
      note:'d = (' + Tq + ' − ' + Tp + ') ÷ (' + q + ' − ' + p + ') = ' + d + ', so a = ' + a + ' and T' + sub(n) + ' = ' + T + '.' };
  }
  /* first term where the sequence passes a value */
  const a2 = ri(3, 15), d2 = ri(2, 9), limit = a2 + d2 * ri(10, 40) + ri(1, 5);
  const n = Math.floor((limit - a2) / d2) + 2;      // first term strictly greater
  const T = a2 + (n - 1) * d2;
  return { q:'An arithmetic sequence starts at <b>' + a2 + '</b> and goes up by <b>' + d2 + '</b> each term. Which is the first term greater than <b>' + limit + '</b>?',
    input:true, answer:T, accept:qty(T, { tol:0 }), data:{ kind:'ap-first', a:a2, d:d2, limit },
    note:'Solve ' + a2 + ' + (n − 1)(' + d2 + ') > ' + limit + ': n > ' + rd((limit - a2) / d2 + 1, 2) + ', so n = ' + n + ' and the term is ' + T + '.' };
}

/* ── Sequences and series: geometric ───────────────────────────────────── */
function genMaGP(){
  const k = ri(0, 5);
  if (k === 0){
    const a = nzr(-6, 8) * 2, r = pk([2, 3, -2, 0.5, -0.5, 1.5]), n = ri(5, 10);
    const T = a * Math.pow(r, n - 1);
    return { q:'A geometric sequence has <b>a = ' + a + '</b> and <b>r = ' + r + '</b>. Find <b>T<sub>' + n + '</sub></b>.',
      input:true, answer:rd(T, 4), accept:qty(T, { tol:Math.max(0.001, Math.abs(T) * 0.001) }), data:{ kind:'gp-T', a, r, n },
      note:'Tₙ = ar' + sup('n−1') + ' = ' + a + ' × (' + r + ')' + sup(n - 1) + ' = ' + rd(T, 4) + '.' };
  }
  if (k === 1){
    const a = ri(2, 9), r = pk([2, 3, 0.5, 1.5]), n = ri(5, 12);
    const S = a * (Math.pow(r, n) - 1) / (r - 1);
    return { q:'A geometric series has <b>a = ' + a + '</b> and <b>r = ' + r + '</b>. Find <b>S<sub>' + n + '</sub></b>, to 2 decimal places.',
      input:true, answer:rd(S, 2), accept:qty(S, { tol:0.05 }), data:{ kind:'gp-S', a, r, n },
      note:'Sₙ = a(rⁿ − 1)/(r − 1) = ' + a + '(' + rd(Math.pow(r, n), 4) + ' − 1)/(' + r + ' − 1) = ' + rd(S, 2) + '.' };
  }
  if (k === 2){
    const r = pk([0.5, -0.5, 0.25, 0.75, 1 / 3, 2 / 3]), a = ri(2, 12) * (Math.random() < 0.5 ? 1 : -1);
    const S = a / (1 - r);
    const rTxt = ({ '0.5':'½', '-0.5':'−½', '0.25':'¼', '0.75':'¾' })[String(r)] || (r === 1 / 3 ? '⅓' : r === 2 / 3 ? '⅔' : String(r));
    return { q:'Find the limiting sum of the geometric series with <b>a = ' + a + '</b> and <b>r = ' + rTxt + '</b>.',
      input:true, answer:rd(S, 3), accept:qty(S, { tol:0.01 }), data:{ kind:'gp-lim', a, r },
      note:'A limiting sum exists because |r| < 1: S = a/(1 − r) = ' + a + ' ÷ ' + rd(1 - r, 4) + ' = ' + rd(S, 3) + '.' };
  }
  if (k === 4){                                   // a later term, read off the first three
    const a = nzr(-5, 5), r = pk([2, 3, -2, -3]), n = ri(5, 9);
    const T = a * Math.pow(r, n - 1);
    const m = numMC(T, [a * Math.pow(r, n), a * Math.pow(r, n - 2), -T, a + (n - 1) * (a * r - a)]);
    return { q:'A geometric sequence begins <b>' + neg([a, a * r, a * r * r].join(', ')) + ', …</b>. What is <b>T<sub>' + n + '</sub></b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'gp-T', a, r, n },
      note:'r = ' + neg(a * r) + ' ÷ ' + neg(a) + ' = ' + neg(r) + ', so Tₙ = arⁿ⁻¹ = ' + neg(a) + ' × (' + neg(r) + ')' + sup(n - 1) + ' = ' + neg(T) + '. Using rⁿ instead of rⁿ⁻¹ lands one term too far along.' };
  }
  if (k === 5){                                   // limiting sum from the first two terms
    const f = pk([[1, 2], [-1, 2], [1, 3], [2, 3], [-1, 3], [-2, 3], [1, 4], [3, 4], [-1, 4], [-3, 4]]);
    const r = f[0] / f[1], mult = ri(1, 4) * (Math.random() < 0.8 ? 1 : -1);
    const a = f[1] * (f[1] - f[0]) * mult, T2 = f[0] * (f[1] - f[0]) * mult;
    const S = f[1] * f[1] * mult;                 // a/(1 − r), kept exact
    const m = numMC(S, [a / (1 + r), S - a, a + T2, 2 * a, a * r / (1 + r)]);
    return { q:'A geometric series has first term <b>' + neg(a) + '</b> and second term <b>' + neg(T2) + '</b>. What is its limiting sum?',
      choices:m.choices, answer:m.answer, data:{ kind:'gp-lim', a, r },
      note:'r = ' + neg(T2) + ' ÷ ' + neg(a) + ' = ' + fracStr(f[0], f[1]) + ', and |r| < 1, so the limiting sum exists: S = a/(1 − r) = ' + neg(a) + ' ÷ (' + fracStr(f[1] - f[0], f[1]) + ') = ' + neg(S) + '.' };
  }
  const r = pk([2, -3, 1.2, 0.8, -0.5, 1]);
  const has = Math.abs(r) < 1;
  return { q:'Does the geometric series with <b>r = ' + r + '</b> have a limiting sum?', choices:['Yes','No'],
    answer:has ? 'Yes' : 'No', data:{ kind:'gp-has', r },
    note:'A limiting sum exists only when |r| < 1. Here |r| = ' + Math.abs(r) + '.' };
}

/* ── Differential calculus: the rules ──────────────────────────────────── */
function genMaDiffRules(){
  const k = ri(0, 2);
  if (k === 0){                                   // chain rule on a bracket
    const a = nzr(-4, 5), b = nzr(-8, 9), n = ri(3, 7);
    const c = a * n;
    const right = xTerm(c, '(' + xTerm(a) + ' ' + signed(b) + ')' + sup(n - 1));
    const wrong = [xTerm(n, '(' + xTerm(a) + ' ' + signed(b) + ')' + sup(n - 1)),
                   xTerm(c, '(' + xTerm(a) + ' ' + signed(b) + ')' + sup(n)),
                   xTerm(a * n, '(' + xTerm(a) + ' ' + signed(b) + ')' + sup(n - 2)),
                   xTerm(c * b, '(' + xTerm(a) + ' ' + signed(b) + ')' + sup(n - 1))];
    const m = mc(right, wrong);
    return { q:'Differentiate <b>y = (' + xTerm(a) + ' ' + signed(b) + ')' + sup(n) + '</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'chain', a, b, n, fx:'(' + a + '*x+' + b + ')**' + n, dfx:'' + c + '*(' + a + '*x+' + b + ')**' + (n - 1) },
      note:'Chain rule: bring the ' + n + ' down, drop the power by one, then multiply by the derivative of the bracket (' + a + ').' };
  }
  if (k === 1){                                   // product rule, x^m (ax+b)^n with small powers
    const a = nzr(-3, 4), b = nzr(-6, 7);
    const expanded = xTerm(2 * a) + ' ' + signed(b);
    const m = mc(expanded, ['x(' + xTerm(a) + ' ' + signed(b) + ')', xTerm(a), xTerm(a * 2), xTerm(a) + ' ' + signed(2 * b)]);
    return { q:'Differentiate <b>y = x(' + xTerm(a) + ' ' + signed(b) + ')</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'product', a, b, fx:'x*(' + a + '*x+' + b + ')', dfx:'' + (2 * a) + '*x+' + b },
      note:'Either expand first (y = ' + xTerm(a, 'x²') + ' ' + signed(b) + 'x) or use the product rule; both give ' + expanded + '.' };
  }
  /* quotient rule: (ax+b)/(cx+d) → (ad − bc)/(cx+d)² */
  const a = nzr(1, 5), b = nzr(-7, 8), c = nzr(1, 4), d = nzr(-6, 7);
  const top = a * d - b * c;
  const den = '(' + xTerm(c) + ' ' + signed(d) + ')²';
  const right = neg(top) + '/' + den;
  const m = mc(right, [neg(b * c - a * d) + '/' + den, neg(a * d + b * c) + '/' + den,
    neg(a * d - b * c) + '/(' + xTerm(c) + ' ' + signed(d) + ')', neg(a - b) + '/' + den]);
  return { q:'Differentiate <b>y = (' + xTerm(a) + ' ' + signed(b) + ') / (' + xTerm(c) + ' ' + signed(d) + ')</b>',
    choices:m.choices, answer:m.answer,
    data:{ kind:'quotient', a, b, c, d, fx:'(' + a + '*x+' + b + ')/(' + c + '*x+' + d + ')', dfx:'' + top + '/(' + c + '*x+' + d + ')**2' },
    note:'Quotient rule: (u′v − uv′)/v² = (' + a + '×' + d + ' − ' + b + '×' + c + ')/' + den + ' = ' + right + '.' };
}

/* ── Differential calculus: exponential, logarithmic and trigonometric ─── */
function genMaDiffTrans(){
  const k = ri(0, 3), a = nzr(-5, 6), b = nzr(-7, 8);
  if (k === 0){
    const inner = xTerm(a) + ' ' + signed(b);
    const E = pow('e', inner);
    const co = a === 1 ? '' : a === -1 ? '−' : neg(a);
    const m = mc(co + E, [E, neg(a * b) + E, co + pow('e', 'x'), co + pow('e', xTerm(a)), neg(a) + 'x' + E]);
    return { q:'Differentiate <b>y = ' + E + '</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'d-exp', a, b, fx:'Math.exp(' + a + '*x+' + b + ')', dfx:'' + a + '*Math.exp(' + a + '*x+' + b + ')' },
      note:'The derivative of e^(f(x)) is f′(x)e^(f(x)), and f′(x) = ' + a + '.' };
  }
  if (k === 1){
    const inner = xTerm(a) + ' ' + signed(b);
    const right = neg(a) + '/(' + inner + ')';
    const m = mc(right, ['1/(' + inner + ')',
      Math.abs(a) === 1 ? null : fracStr(1, a) + '/(' + inner + ')',
      neg(a) + '/(' + inner + ')²', neg(a * b) + '/(' + inner + ')',
      'ln(' + inner + ')/' + neg(a)].filter(Boolean));
    return { q:'Differentiate <b>y = ln(' + inner + ')</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'d-log', a, b, fx:'Math.log(' + a + '*x+' + b + ')', dfx:'' + a + '/(' + a + '*x+' + b + ')' },
      note:'The derivative of ln(f(x)) is f′(x)/f(x) = ' + a + '/(' + inner + ').' };
  }
  if (k === 2){
    const c = ri(2, 6), right = xTerm(c, 'cos(' + xTerm(c) + ')');
    const m = mc(right, [xTerm(-c, 'cos(' + xTerm(c) + ')'), 'cos(' + xTerm(c) + ')', xTerm(c, 'sin(' + xTerm(c) + ')'), xTerm(-c, 'sin(' + xTerm(c) + ')')]);
    return { q:'Differentiate <b>y = sin(' + xTerm(c) + ')</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'d-sin', c, fx:'Math.sin(' + c + '*x)', dfx:'' + c + '*Math.cos(' + c + '*x)' },
      note:'d/dx sin(kx) = k cos(kx), with k = ' + c + '.' };
  }
  const c = ri(2, 6), right = xTerm(-c, 'sin(' + xTerm(c) + ')');
  const m = mc(right, [xTerm(c, 'sin(' + xTerm(c) + ')'), xTerm(-c, 'cos(' + xTerm(c) + ')'), 'sin(' + xTerm(c) + ')', xTerm(-1, 'sin(' + xTerm(c) + ')')]);
  return { q:'Differentiate <b>y = cos(' + xTerm(c) + ')</b>', choices:m.choices, answer:m.answer,
    data:{ kind:'d-cos', c, fx:'Math.cos(' + c + '*x)', dfx:'-' + c + '*Math.sin(' + c + '*x)' },
    note:'d/dx cos(kx) = −k sin(kx), with k = ' + c + '. The minus sign is the part people drop.' };
}

/* ── Integral calculus: antiderivatives ────────────────────────────────── */
function genMaAnti(){
  const k = ri(0, 3);
  if (k === 0){
    const a = nzr(-4, 5), b = nzr(-7, 8), n = ri(2, 6);
    const coefTxt = fracStr(1, a * (n + 1));
    const bracket = '(' + xTerm(a) + ' ' + signed(b) + ')' + sup(n + 1);
    const right = (coefTxt === '1' ? '' : coefTxt + ' ') + bracket + ' + c';
    const m = mc(right, [fracStr(1, n + 1) + ' ' + bracket + ' + c', fracStr(1, a) + ' ' + bracket + ' + c',
      bracket + ' + c', coefTxt + ' (' + xTerm(a) + ' ' + signed(b) + ')' + sup(n) + ' + c']);
    return { q:'Find <b>∫ (' + xTerm(a) + ' ' + signed(b) + ')' + sup(n) + ' dx</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'i-bracket', a, b, n, fx:'(' + a + '*x+' + b + ')**' + n },
      note:'Raise the power to ' + (n + 1) + ', divide by the new power and by the ' + a + ' inside: 1/(' + a + '×' + (n + 1) + ') = ' + coefTxt + '.' };
  }
  if (k === 1){
    const a = nzr(2, 6) * (Math.random() < 0.5 ? 1 : -1);
    const E = pow('e', xTerm(a));
    const right = fracStr(1, a) + ' ' + E + ' + c';
    const m = mc(right, [E + ' + c', a + ' ' + E + ' + c', fracStr(-1, a) + ' ' + E + ' + c',
      fracStr(1, a + 1) + ' ' + pow('e', xTerm(a) + ' + 1') + ' + c']);
    return { q:'Find <b>∫ ' + E + ' dx</b>', choices:m.choices, answer:m.answer,
      data:{ kind:'i-exp', a, fx:'Math.exp(' + a + '*x)' }, note:'∫e^(kx) dx = e^(kx)/k + c, with k = ' + a + '.' };
  }
  if (k === 2){
    const a = nzr(2, 5), b = nzr(1, 9);
    const inner = xTerm(a) + ' + ' + b;
    const right = fracStr(1, a) + ' ln(' + inner + ') + c';
    const m = mc(right, ['ln(' + inner + ') + c', a + ' ln(' + inner + ') + c',
      'ln(' + inner + ')/(' + inner + ') + c', fracStr(1, a) + ' ln(' + inner + ')² + c']);
    return { q:'Find <b>∫ 1/(' + inner + ') dx</b>, for ' + inner + ' > 0', choices:m.choices, answer:m.answer,
      data:{ kind:'i-log', a, b, fx:'1/(' + a + '*x+' + b + ')' }, note:'∫1/(ax+b) dx = (1/a) ln(ax+b) + c, with a = ' + a + '.' };
  }
  const c = ri(2, 6), useSin = Math.random() < 0.5;
  const right = useSin ? fracStr(-1, c) + ' cos(' + xTerm(c) + ') + c' : fracStr(1, c) + ' sin(' + xTerm(c) + ') + c';
  const m = mc(right, [useSin ? fracStr(1, c) + ' cos(' + xTerm(c) + ') + c' : fracStr(-1, c) + ' sin(' + xTerm(c) + ') + c',
    useSin ? '−' + c + ' cos(' + xTerm(c) + ') + c' : c + ' sin(' + xTerm(c) + ') + c',
    useSin ? '−cos(' + xTerm(c) + ') + c' : 'sin(' + xTerm(c) + ') + c']);
  return { q:'Find <b>∫ ' + (useSin ? 'sin' : 'cos') + '(' + xTerm(c) + ') dx</b>', choices:m.choices, answer:m.answer,
    data:{ kind:useSin ? 'i-sin' : 'i-cos', c, fx:'Math.' + (useSin ? 'sin' : 'cos') + '(' + c + '*x)' },
    note:useSin ? '∫sin(kx) dx = −cos(kx)/k + c.' : '∫cos(kx) dx = sin(kx)/k + c.' };
}

/* ── Integral calculus: definite integrals and area ────────────────────── */
function genMaDefInt(){
  const k = ri(0, 4);
  if (k === 0){                                   // a polynomial, chosen to come out tidy
    const a = ri(1, 4) * 3, b = ri(1, 5) * 2, c = ri(-5, 5), u = ri(1, 4);
    const F = x => a * x * x * x / 3 + b * x * x / 2 + c * x;
    const val = F(u) - F(0);
    return { q:'Evaluate <b>∫₀' + sup(u) + ' (' + a + 'x² + ' + b + 'x ' + signed(c) + ') dx</b>',
      input:true, answer:val, accept:qty(val, { tol:0.01 }), data:{ kind:'poly', a, b, c, u },
      note:'Antiderivative ' + (a / 3) + 'x³ + ' + (b / 2) + 'x² ' + signed(c) + 'x, evaluated from 0 to ' + u + ', gives ' + val + '.' };
  }
  if (k === 1){                                   // area under a parabola between its roots
    const p = ri(1, 5), q = p + ri(2, 5);         // y = (x − p)(q − x), positive between the roots
    const area = Math.pow(q - p, 3) / 6;
    return { q:'Find the area between the x-axis and <b>y = (x − ' + p + ')(' + q + ' − x)</b>, between its two x-intercepts.',
      input:true, answer:rd(area, 4), accept:qty(area, { tol:0.02 }), data:{ kind:'parabola', p, q },
      note:'The intercepts are x = ' + p + ' and x = ' + q + '. The area of this shape is (b − a)³/6 = (' + (q - p) + ')³/6 = ' + rd(area, 4) + ' square units.' };
  }
  if (k === 3){                                   // the polynomial again, as multiple choice
    const a = ri(1, 4) * 3, b = ri(1, 5) * 2, c = ri(-5, 5), u = ri(1, 4);
    const F = x => a * x * x * x / 3 + b * x * x / 2 + c * x;
    const val = F(u) - F(0);
    const m = numMC(val, [a * Math.pow(u, 3) + b * u * u + c * u, a * Math.pow(u, 3) / 3 + b * u * u + c * u,
                          a * u * u + b * u + c, 2 * a * u + b, -val, F(u) - F(1)]);
    return { q:'What is the value of <b>∫₀' + sup(u) + ' (' + a + 'x² + ' + b + 'x' + plusTerm(c, '') + ') dx</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'poly', a, b, c, u },
      note:'The antiderivative is ' + xTerm(a / 3, 'x³') + ' + ' + xTerm(b / 2, 'x²') + plusTerm(c, 'x') + '. At x = ' + u + ' it is ' + neg(val) + ', and at x = 0 it is 0, so the integral is ' + neg(val) + '. Forgetting to divide by the new powers is the usual slip.' };
  }
  if (k === 4){                                   // a parabola given expanded, so the roots come first
    const p = ri(1, 5), L = ri(2, 5), q = p + L;
    const area = Math.pow(L, 3) / 6;
    const G = x => -x * x * x / 3 + (p + q) * x * x / 2 - p * q * x;
    const m = numMC(area, [-area, G(q), Math.pow(L, 3) / 3, Math.pow(L, 3) / 2, L * L]);
    return { q:'What is the area of the region enclosed by <b>y = −x² + ' + (p + q) + 'x − ' + (p * q) + '</b> and the x-axis, in square units?',
      choices:m.choices, answer:m.answer, data:{ kind:'parabola', p, q },
      note:'Factorise first: y = (x − ' + p + ')(' + q + ' − x), so the curve cuts the axis at x = ' + p + ' and x = ' + q + ' and is above it in between. ∫' + sub(p) + sup(q) + ' y dx = ' + rd(area, 4) + ' square units. Integrating from 0 instead of from ' + p + ' takes in a piece below the axis.' };
  }
  /* area between a line and a parabola */
  const m0 = ri(1, 4), c0 = ri(1, 6);             // y = x², y = m0 x + c0 meet where x² − m0x − c0 = 0
  const disc = Math.sqrt(m0 * m0 + 4 * c0);
  const x1 = (m0 - disc) / 2, x2 = (m0 + disc) / 2;
  const area = Math.pow(x2 - x1, 3) / 6;
  return { q:'Find the area enclosed between <b>y = x²</b> and <b>y = ' + xTerm(m0) + ' + ' + c0 + '</b>, to 2 decimal places.',
    input:true, answer:rd(area, 2), accept:qty(area, { tol:0.05 }), data:{ kind:'between', m:m0, c:c0 },
    note:'They meet where x² − ' + m0 + 'x − ' + c0 + ' = 0, at x = ' + rd(x1, 3) + ' and x = ' + rd(x2, 3) + '. ' +
      'The enclosed area is (difference of roots)³/6 = ' + rd(area, 2) + ' square units.' };
}

/* ── Integral calculus: the trapezoidal rule ───────────────────────────── */
function genMaTrap(){
  const fns = [
    { s:'√x', f:x => Math.sqrt(x), concaveUp:false },
    { s:'x²', f:x => x * x, concaveUp:true },
    { s:'1/x', f:x => 1 / x, concaveUp:true },
    { s:'ln x', f:x => Math.log(x), concaveUp:false }
  ];
  const fn = pk(fns), a = ri(1, 3), n = pk([2, 4]), w = pk([1, 2]), b = a + n * w;
  const h = (b - a) / n;
  let est = fn.f(a) + fn.f(b);
  for (let i = 1; i < n; i++) est += 2 * fn.f(a + i * h);
  est *= h / 2;
  if (Math.random() < 0.3){                       // the estimate, as multiple choice
    const exact = { '√x':x => 2 / 3 * Math.pow(x, 1.5), 'x²':x => x * x * x / 3, '1/x':Math.log, 'ln x':x => x * Math.log(x) - x }[fn.s];
    let all = 0;
    for (let i = 0; i <= n; i++) all += fn.f(a + i * h);
    const m = numMC(est, [2 * est, all * h / 2, (b - a) / 2 * (fn.f(a) + fn.f(b)), exact(b) - exact(a), all * h], 3);
    return { q:'The trapezoidal rule with <b>' + n + ' subintervals</b> is used to estimate <b>∫' + sub(a) + sup(b) + ' ' + fn.s + ' dx</b>. What estimate does it give, to 3 decimal places?',
      choices:m.choices, answer:m.answer, data:{ kind:'trap', fn:fn.s, a, b, n },
      note:'h = ' + h + '. The end values count once and the ones between count twice, and the total is multiplied by h/2: ' + rd(est, 3) + '. The exact value is ' + rd(exact(b) - exact(a), 3) + ', so the estimate is a little ' + (fn.concaveUp ? 'high, because the curve bends upwards.' : 'low, because the curve bends downwards.') };
  }
  if (Math.random() < 0.65){
    return { q:'Use the trapezoidal rule with <b>' + n + ' subintervals</b> to estimate <b>∫' + sub(a) + sup(b) + ' ' + fn.s + ' dx</b>, to 3 decimal places.',
      input:true, answer:rd(est, 3), accept:qty(est, { tol:0.005 }), data:{ kind:'trap', fn:fn.s, a, b, n },
      note:'h = ' + h + '. Estimate = h/2 × (first + last + 2 × the ones between) = ' + rd(est, 3) + '.' };
  }
  const right = fn.concaveUp ? 'An overestimate' : 'An underestimate';
  return { q:'For <b>y = ' + fn.s + '</b> on this interval, a trapezoidal estimate of the area is…',
    choices:['An overestimate', 'An underestimate', 'Exactly right'], answer:right, data:{ kind:'trap-side', fn:fn.s },
    note:fn.concaveUp
      ? 'The curve bends upwards, so each chord sits above it and the trapezia hold too much.'
      : 'The curve bends downwards, so each chord sits below it and the trapezia miss a sliver.' };
}

const cubicStr = (p, q, r) => 'x³' + plusTerm(p, 'x²') + plusTerm(q, 'x') + plusTerm(r, '');
/* ── Applications of calculus: stationary points ───────────────────────── */
function genMaStat(){
  /* f(x) = x³ + px² + qx + r, built from the turning points so they are whole numbers */
  const x1 = nzr(-5, 4), x2 = x1 + 2 * ri(1, 3);        // an even gap keeps p, q and the inflection whole
  const p = -3 * (x1 + x2) / 2, q = 3 * x1 * x2, r = nzr(-6, 7);
  const fp = [3, 2 * p, q];                        // f′ = 3x² + 2px + q
  const k = ri(0, 2);
  if (k === 0){
    const right = 'x = ' + neg(x1) + ' and x = ' + neg(x2);
    const m = mc(right, ['x = ' + neg(-x1) + ' and x = ' + neg(-x2), 'x = ' + neg(x1) + ' only', 'x = ' + neg(x1 + x2) + ' and x = ' + neg(x1 * x2)]);
    return { q:'Where are the stationary points of <b>f(x) = ' + cubicStr(p, q, r) + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'stat-where', x1, x2, p, q },
      note:'f′(x) = 3x²' + plusTerm(2 * p, 'x') + plusTerm(q, '') + ', which is zero at x = ' + neg(x1) + ' and x = ' + neg(x2) + '.' };
  }
  if (k === 1){
    const askMax = Math.random() < 0.5;            // for a positive cubic, the smaller root is the maximum
    const right = 'x = ' + neg(askMax ? x1 : x2);
    const m = mc(right, ['x = ' + neg(askMax ? x2 : x1), 'x = ' + neg(rd((x1 + x2) / 2, 2)), 'x = ' + neg(-(askMax ? x1 : x2))]);
    return { q:'<b>f(x) = ' + cubicStr(p, q, r) + '</b> has stationary points at x = ' + neg(x1) + ' and x = ' + neg(x2) +
        '. Which is the local <b>' + (askMax ? 'maximum' : 'minimum') + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'stat-nature', x1, x2, askMax },
      note:'f″(x) = 6x' + plusTerm(2 * p, '') + '. At x = ' + neg(x1) + ' it is negative (a maximum); at x = ' + neg(x2) + ' it is positive (a minimum).' };
  }
  const xi = -p / 3;                               // point of inflection of the cubic
  const m = numMC(xi, [-p, p / 3, (x1 + x2), x1 * x2], 3);
  return { q:'Find the x-coordinate of the point of inflection of <b>f(x) = ' + cubicStr(p, q, r) + '</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'inflect', p },
    note:'f″(x) = 6x' + plusTerm(2 * p, '') + ' = 0 at x = ' + neg(rd(xi, 3)) + ', and the concavity changes there.' };
}

/* ── Applications of calculus: optimisation ────────────────────────────── */
function genMaOptim(){
  const k = ri(0, 2);
  if (k === 0){                                   // fixed perimeter, biggest rectangle
    const P = ri(6, 30) * 4;
    const side = P / 4, area = side * side;
    const m = numMC(area, [P * P / 16 / 2, P * P, side, P / 2 * P / 2]);
    return { q:'A rectangle has a perimeter of <b>' + P + ' m</b>. What is its greatest possible area, in m²?',
      choices:m.choices, answer:m.answer, data:{ kind:'rect', P },
      note:'With x + y = ' + (P / 2) + ', A = x(' + (P / 2) + ' − x) is greatest at x = ' + side + ', giving ' + area + ' m². The best rectangle is always the square.' };
  }
  if (k === 1){                                   // three sides of fencing against a wall
    const L = ri(10, 40) * 2;
    const x = L / 4, area = x * (L - 2 * x);
    return { q:'<b>' + L + ' m</b> of fencing encloses a rectangular paddock, using an existing wall as one long side. What is the greatest area, in m²?',
      input:true, answer:area, accept:qty(area, { tol:0.5 }), data:{ kind:'fence', L },
      note:'With two widths x and one length ' + L + ' − 2x, A = x(' + L + ' − 2x) is greatest at x = ' + x + ' m, giving ' + area + ' m².' };
  }
  /* open box from a square sheet: cut x from each corner */
  const s = ri(3, 8) * 6;
  const x = s / 6, vol = x * Math.pow(s - 2 * x, 2);
  const m = numMC(vol, [Math.pow(s, 3), s * s * x, Math.pow(s - 2 * x, 3), x * s * s], 1);
  return { q:'An open box is made by cutting a square of side x from each corner of a <b>' + s + ' cm</b> square sheet and folding up the sides. What is the greatest volume, in cm³?',
    choices:m.choices, answer:m.answer, data:{ kind:'box', s },
    note:'V = x(' + s + ' − 2x)². V′ = 0 at x = ' + rd(x, 2) + ' cm (the other root is x = ' + (s / 2) + ', which leaves no box), giving ' + rd(vol, 1) + ' cm³.' };
}

/* ── Applications of calculus: motion in a straight line ───────────────── */
function genMaMotion(){
  const a3 = ri(1, 3), b3 = nzr(-9, 9), c3 = nzr(-12, 12), t = ri(1, 5);
  /* x = a t³ + b t² + c t, so v = 3a t² + 2b t + c and acceleration 6a t + 2b */
  const v = t2 => 3 * a3 * t2 * t2 + 2 * b3 * t2 + c3;
  const acc = t2 => 6 * a3 * t2 + 2 * b3;
  const k = ri(0, 2);
  const xStr = (a3 === 1 ? '' : a3) + 't³ ' + signed(b3) + 't² ' + signed(c3) + 't';
  if (k === 0){
    return { q:'A particle has displacement <b>x = ' + xStr + '</b> metres at time t seconds. Find its velocity at <b>t = ' + t + '</b>, in m/s.',
      input:true, answer:v(t), accept:qty(v(t), { tol:0.01, dim:'speed' }), unit:'m/s', data:{ kind:'v', a:a3, b:b3, c:c3, t },
      note:'v = dx/dt = ' + (3 * a3) + 't² ' + signed(2 * b3) + 't ' + signed(c3) + ', so v(' + t + ') = ' + v(t) + ' m/s.' };
  }
  if (k === 1){
    return { q:'A particle has displacement <b>x = ' + xStr + '</b> metres. Find its acceleration at <b>t = ' + t + '</b>, in m/s².',
      input:true, answer:acc(t), accept:qty(acc(t), { tol:0.01 }), unit:'m/s²', data:{ kind:'a', a:a3, b:b3, t },
      note:'a = d²x/dt² = ' + (6 * a3) + 't ' + signed(2 * b3) + ', so a(' + t + ') = ' + acc(t) + ' m/s².' };
  }
  /* at rest: choose a velocity that factorises */
  const r1 = ri(1, 4), r2 = r1 + ri(1, 4);
  const right = 't = ' + r1 + ' and t = ' + r2;
  const m = mc(right, ['t = ' + neg(-r1) + ' and t = ' + neg(-r2), 't = ' + r1 + ' only', 't = ' + (r1 + r2)]);
  return { q:'A particle’s velocity is <b>v = (t − ' + r1 + ')(t − ' + r2 + ')</b> m/s. When is it at rest?',
    choices:m.choices, answer:m.answer, data:{ kind:'rest', r1, r2 },
    note:'At rest means v = 0, so t = ' + r1 + ' and t = ' + r2 + ' seconds.' };
}

/* ── Random variables: discrete ────────────────────────────────────────── */
function genMaDiscRV(){
  /* four outcomes with probabilities in twentieths, so everything stays exact */
  const parts = [];
  let left = 20;
  for (let i = 0; i < 3; i++){ const take = ri(2, Math.max(2, left - 2 * (2 - i))); parts.push(take); left -= take; }
  parts.push(left);
  const xs = [0, 1, 2, 3].map(i => i + ri(0, 1) * 0);
  const ps = parts.map(p => p / 20);
  const E = xs.reduce((s, x, i) => s + x * ps[i], 0);
  const E2 = xs.reduce((s, x, i) => s + x * x * ps[i], 0);
  const Var = E2 - E * E;
  const table = '<div class="rvcode">x      ' + xs.join('    ') + '\nP(X=x)  ' + ps.map(p => rd(p, 2)).join(' ') + '</div>';
  const k = ri(0, 4);
  if (k === 0){
    return { q:'A discrete random variable has this distribution. Find <b>E(X)</b>.' + table,
      input:true, answer:rd(E, 3), accept:qty(E, { tol:0.01 }), data:{ kind:'E', xs, ps },
      note:'E(X) = Σ x P(X = x) = ' + xs.map((x, i) => x + '×' + rd(ps[i], 2)).join(' + ') + ' = ' + rd(E, 3) + '.' };
  }
  if (k === 1){
    return { q:'A discrete random variable has this distribution. Find <b>Var(X)</b>, to 3 decimal places.' + table,
      input:true, answer:rd(Var, 3), accept:qty(Var, { tol:0.01 }), data:{ kind:'Var', xs, ps },
      note:'Var(X) = E(X²) − [E(X)]² = ' + rd(E2, 3) + ' − ' + rd(E * E, 3) + ' = ' + rd(Var, 3) + '.' };
  }
  if (k === 3){                                   // the expected value, as multiple choice
    const m = numMC(E, [1.5, E2, Var, 3 * ps[3], E + ps[0]]);
    return { q:'The table shows the probability distribution of a discrete random variable X. What is the <b>expected value</b> of X?' + table,
      choices:m.choices, answer:m.answer, data:{ kind:'E', xs, ps },
      note:'E(X) = Σ x P(X = x) = ' + xs.map((x, i) => x + '×' + rd(ps[i], 2)).join(' + ') + ' = ' + rd(E, 2) + '. Averaging the x values alone gives 1.5, which ignores how likely each one is.' };
  }
  if (k === 4){                                   // the variance, as multiple choice
    const m = numMC(Var, [E2, Math.sqrt(Var), E2 - E, E * E, E2 + E * E, E,
                          xs.reduce((s, x) => s + (x - E) * (x - E), 0) / xs.length], 4);
    return { q:'The table shows the probability distribution of a discrete random variable X. What is the <b>variance</b> of X?' + table,
      choices:m.choices, answer:m.answer, data:{ kind:'Var', xs, ps },
      note:'E(X) = ' + rd(E, 2) + ' and E(X²) = ' + rd(E2, 2) + ', so Var(X) = E(X²) − [E(X)]² = ' + rd(E2, 2) + ' − ' + rd(E * E, 4) + ' = ' + rd(Var, 4) + '. E(X²) on its own is not the variance, and its square root is the standard deviation.' };
  }
  const cut = ri(1, 2);
  const p = ps.filter((_, i) => xs[i] >= cut).reduce((s, x) => s + x, 0);
  return { q:'A discrete random variable has this distribution. Find <b>P(X ≥ ' + cut + ')</b>.' + table,
    input:true, answer:rd(p, 3), accept:qty(p, { tol:0.005 }), data:{ kind:'P', xs, ps, cut },
    note:'Add the probabilities from x = ' + cut + ' upwards: ' + rd(p, 3) + '.' };
}

/* ── Random variables: the normal distribution ─────────────────────────── */
function genMaNormal(){
  const mu = ri(10, 80), sd = ri(2, 12), k = ri(0, 2);
  if (k === 0){
    const z = pk([-2, -1.5, -1, 1, 1.5, 2, 2.5]);
    const x = mu + z * sd;
    return { q:'A normal distribution has mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>. What is the z-score of <b>x = ' + rd(x, 2) + '</b>?',
      input:true, answer:rd(z, 3), accept:qty(z, { tol:0.01 }), data:{ kind:'z', mu, sd, x },
      note:'z = (x − μ)/σ = (' + rd(x, 2) + ' − ' + mu + ')/' + sd + ' = ' + rd(z, 3) + '.' };
  }
  if (k === 1){
    const within = pk([1, 2, 3]), pct = { 1:68, 2:95, 3:99.7 }[within];
    const lo = mu - within * sd, hi = mu + within * sd;
    const m = mc(pct + '%', ['50%', (within === 1 ? 95 : 68) + '%', '99.7%', '34%'].filter(x => x !== pct + '%'));
    return { q:'For a normal distribution with mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>, roughly what percentage of values lie between <b>' + lo + '</b> and <b>' + hi + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'empirical', within },
      note:'That is ' + within + ' standard deviation' + (within === 1 ? '' : 's') + ' either side of the mean, so about ' + pct + '% by the empirical rule.' };
  }
  const z = pk([1, 2]), pct = z === 1 ? (100 - 68) / 2 : (100 - 95) / 2;
  const above = mu + z * sd;
  const m = mc(rd(pct, 1) + '%', [rd(100 - pct, 1) + '%', rd(pct * 2, 1) + '%', '50%', rd(50 - pct, 1) + '%']);
  return { q:'For a normal distribution with mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>, roughly what percentage of values are above <b>' + above + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'tail', z },
    note:'About ' + (z === 1 ? 68 : 95) + '% lie within ' + z + ' standard deviation' + (z === 1 ? '' : 's') + ', leaving ' + rd(100 - (z === 1 ? 68 : 95), 1) + '% split between the two tails, so ' + rd(pct, 1) + '% above.' };
}

/* ── Random variables: continuous ──────────────────────────────────────── */
function genMaContRV(){
  const k = ri(0, 2);
  const b = ri(2, 6);
  if (k === 0){                                   // f(x) = kx on [0, b]
    const kk = 2 / (b * b);
    return { q:'A continuous random variable has <b>f(x) = kx</b> for <b>0 ≤ x ≤ ' + b + '</b>, and 0 elsewhere. Find <b>k</b>.',
      input:true, answer:rd(kk, 4), accept:qty(kk, { tol:0.002 }), data:{ kind:'k', b },
      note:'The area under f must be 1: k × ' + b + '²/2 = 1, so k = 2/' + (b * b) + ' = ' + rd(kk, 4) + '.' };
  }
  if (k === 1){                                   // uniform
    const a = ri(0, 4), c = a + ri(2, 8), lo = a + 1, hi = Math.min(c, lo + ri(1, 4));
    const p = (hi - lo) / (c - a);
    return { q:'A continuous random variable is uniform on <b>[' + a + ', ' + c + ']</b>. Find <b>P(' + lo + ' ≤ X ≤ ' + hi + ')</b>.',
      input:true, answer:rd(p, 4), accept:qty(p, { tol:0.005 }), data:{ kind:'uniform', a, c, lo, hi },
      note:'For a uniform variable the probability is the fraction of the interval: (' + hi + ' − ' + lo + ')/(' + c + ' − ' + a + ') = ' + rd(p, 4) + '.' };
  }
  /* median of f(x) = kx on [0, b] is b/√2 */
  const med = b / Math.SQRT2;
  const m = numMC(med, [b / 2, b * Math.SQRT2, b / 4, 2 * b / 3], 3);
  return { q:'A continuous random variable has <b>f(x) = 2x/' + (b * b) + '</b> on <b>0 ≤ x ≤ ' + b + '</b>. Find its median, to 3 decimal places.',
    choices:m.choices, answer:m.answer, data:{ kind:'median', b },
    note:'Solve ∫₀ᵐ 2x/' + (b * b) + ' dx = ½: m²/' + (b * b) + ' = ½, so m = ' + b + '/√2 = ' + rd(med, 3) + '. Not the midpoint, because the density grows with x.' };
}

/* ── Financial mathematics: compound interest ──────────────────────────── */
function genMaCompound(){
  const k = ri(0, 4);
  const P = ri(2, 20) * 500, pct = pk([2, 2.5, 3, 4, 5, 6, 7.5]), n = ri(3, 15);
  if (k === 0){
    const A = P * Math.pow(1 + pct / 100, n);
    return { q:money(P) + ' is invested at <b>' + pct + '% per annum</b>, compounded yearly. What is it worth after <b>' + n + ' years</b>?',
      input:true, answer:rd(A, 2), accept:moneyQ(A, Math.max(0.5, A * 0.002)), data:{ kind:'fv', P, pct, n },
      note:'A = P(1 + r)ⁿ = ' + P + ' × ' + rd(1 + pct / 100, 4) + sup(n) + ' = ' + money(A) + '.' };
  }
  if (k === 1){                                   // compounded monthly
    const A = P * Math.pow(1 + pct / 100 / 12, n * 12);
    return { q:money(P) + ' is invested at <b>' + pct + '% per annum compounded monthly</b>. What is it worth after <b>' + n + ' years</b>?',
      input:true, answer:rd(A, 2), accept:moneyQ(A, Math.max(0.5, A * 0.002)), data:{ kind:'fv-monthly', P, pct, n },
      note:'Use the monthly rate and the number of months: ' + P + ' × (1 + ' + rd(pct / 100 / 12, 6) + ')' + sup(n * 12) + ' = ' + money(A) + '.' };
  }
  if (k === 3){                                   // monthly compounding, as multiple choice
    const r = pct / 100, A = P * Math.pow(1 + r / 12, n * 12);
    const m = moneyMC(A, [P * Math.pow(1 + r, n), P * Math.pow(1 + r / 12, n), P * (1 + r * n), A - P]);
    return { q:'<b>' + money(P) + '</b> is invested for <b>' + n + ' years</b> at <b>' + pct + '% per annum, compounded monthly</b>. What is the investment worth at the end?',
      choices:m.choices, answer:m.answer, data:{ kind:'fv-monthly', P, pct, n },
      note:'Monthly compounding applies ' + pct + '% ÷ 12 in each of ' + (n * 12) + ' months: ' + P + ' × (1 + ' + rd(r / 12, 6) + ')' + sup(n * 12) + ' = ' + money(A) + '. Compounding yearly gives ' + money(P * Math.pow(1 + r, n)) + ', a little less.' };
  }
  if (k === 4){                                   // reducing balance, as multiple choice
    const dep = pk([10, 12.5, 15, 20, 25]), yrs = ri(3, 8);
    const V = P * Math.pow(1 - dep / 100, yrs);
    const m = moneyMC(V, [P * (1 - dep / 100 * yrs), P * Math.pow(1 - dep / 100, yrs - 1), P - V, P * Math.pow(1 + dep / 100, yrs)].filter(w => w > 0));
    return { q:pk(['A car', 'A boat', 'A tractor', 'A printing press']) + ' bought for <b>' + money(P) + '</b> loses <b>' + dep + '%</b> of its value each year, on a reducing balance. What is it worth after <b>' + yrs + ' years</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'dep', P, dep, yrs },
      note:'S = V₀(1 − r)ⁿ = ' + P + ' × ' + rd(1 - dep / 100, 4) + sup(yrs) + ' = ' + money(V) + '. Taking ' + dep + '% of the original price off every year is straight-line depreciation, which is a different model.' };
  }
  const dep = pk([10, 12.5, 15, 20, 25]), yrs = ri(3, 8);
  const V = P * Math.pow(1 - dep / 100, yrs);
  return { q:'A machine worth ' + money(P) + ' depreciates by <b>' + dep + '% a year</b>. What is it worth after <b>' + yrs + ' years</b>?',
    input:true, answer:rd(V, 2), accept:moneyQ(V, Math.max(0.5, V * 0.002)), data:{ kind:'dep', P, dep, yrs },
    note:'V = ' + P + ' × ' + rd(1 - dep / 100, 4) + sup(yrs) + ' = ' + money(V) + '. Each year takes ' + dep + '% off what is left, not off the original.' };
}

/* ── Financial mathematics: annuities and loans ────────────────────────── */
function genMaAnnuity(){
  const k = ri(0, 4);
  if (k === 0){                                   // future value of an annuity
    const M = ri(2, 20) * 100, pct = pk([3, 4, 5, 6]), n = ri(5, 25), r = pct / 100;
    const FV = M * (Math.pow(1 + r, n) - 1) / r;
    return { q:money(M) + ' is paid into an account at the <b>end of each year</b> for <b>' + n + ' years</b>, earning <b>' + pct + '% per annum</b>. What is it worth at the end?',
      input:true, answer:rd(FV, 2), accept:moneyQ(FV, Math.max(1, FV * 0.002)), data:{ kind:'annuity', M, pct, n },
      note:'Each payment compounds for a different time, and the total is M[(1 + r)ⁿ − 1]/r = ' + money(FV) + '.' };
  }
  if (k === 1){                                   // loan repayment
    const P = ri(4, 40) * 10000, pct = pk([4, 5, 6, 7]), n = pk([10, 15, 20, 25]);
    const r = pct / 100 / 12, N = n * 12;
    const M = P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
    return { q:'A ' + money(P) + ' loan is taken over <b>' + n + ' years</b> at <b>' + pct + '% per annum, compounded monthly</b>. What is the monthly repayment?',
      input:true, answer:rd(M, 2), accept:moneyQ(M, Math.max(1, M * 0.005)), data:{ kind:'loan', P, pct, n },
      note:'With r = ' + rd(r, 6) + ' per month over ' + N + ' months, M = Pr(1 + r)ᴺ/[(1 + r)ᴺ − 1] = ' + money(M) + '.' };
  }
  if (k === 3){                                   // future value of an annuity, as multiple choice
    const M = ri(2, 20) * 100, pct = pk([3, 4, 5, 6]), n = ri(5, 25), r = pct / 100;
    const FV = M * (Math.pow(1 + r, n) - 1) / r;
    const m = moneyMC(FV, [M * n, FV * (1 + r), M * Math.pow(1 + r, n), M * (Math.pow(1 + r, n - 1) - 1) / r]);
    return { q:'At the <b>end</b> of each year for <b>' + n + ' years</b>, ' + money(M) + ' is deposited into an account earning <b>' + pct + '% per annum</b>, compounded annually. What is the balance straight after the last deposit?',
      choices:m.choices, answer:m.answer, data:{ kind:'annuity', M, pct, n },
      note:'The last deposit earns nothing and the first earns ' + (n - 1) + ' years of interest, so the balance is the geometric series M + M(1.0' + pct + ') + … + M(1.0' + pct + ')' + sup(n - 1) + ' = M[(1 + r)ⁿ − 1]/r = ' + money(FV) + '. Deposits at the start of each year would give ' + money(FV * (1 + r)) + '.' };
  }
  if (k === 4){                                   // loan repayment, as multiple choice
    const P = ri(4, 40) * 10000, pct = pk([4, 5, 6, 7]), n = pk([10, 15, 20, 25]);
    const r = pct / 100 / 12, N = n * 12;
    const M = P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
    const m = moneyMC(M, [P / N, P * (1 + pct / 100 * n) / N, P * r, M * 12, P * Math.pow(1 + pct / 100, n) / N]);
    return { q:'A loan of <b>' + money(P) + '</b> is repaid in equal monthly instalments over <b>' + n + ' years</b>, with interest at <b>' + pct + '% per annum</b> compounded monthly. What is each instalment?',
      choices:m.choices, answer:m.answer, data:{ kind:'loan', P, pct, n },
      note:'r = ' + pct + '/1200 per month and N = ' + N + ' months, so M = Pr(1 + r)ᴺ/[(1 + r)ᴺ − 1] = ' + money(M) + '. ' + money(P * r) + ' would only cover the first month’s interest.' };
  }
  /* amount still owing partway through */
  const P = ri(2, 20) * 10000, pct = pk([5, 6, 8]), yrs = pk([5, 10]), paid = ri(1, yrs - 1);
  const r = pct / 100, N = yrs, M = P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
  let owing = P;
  for (let i = 0; i < paid; i++) owing = owing * (1 + r) - M;
  return { q:'A ' + money(P) + ' loan at <b>' + pct + '% per annum</b> is repaid with <b>' + yrs + '</b> equal yearly payments of ' + money(M) +
      '. How much is still owing after <b>' + paid + '</b> payment' + (paid === 1 ? '' : 's') + '?',
    input:true, answer:rd(owing, 2), accept:moneyQ(owing, Math.max(1, Math.abs(owing) * 0.005)), data:{ kind:'owing', P, pct, yrs, paid },
    note:'Each year the balance grows by ' + pct + '% and then drops by the payment: after ' + paid + ' of them, ' + money(owing) + ' is left.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
/* the module list is a named constant so the mock HSC can draw Section I from
   the same generators without building a practice game */
const MODULES_MA12 = [
    { id:'ma-graphs', name:'Graphs & modelling', topics:[
      { id:'ma12-trig', name:'Transforming trig functions', gen:genMaTrig },
      { id:'ma12-model', name:'Modelling with functions', gen:genMaModel }]},
    { id:'ma-series', name:'Sequences & series', topics:[
      { id:'ma12-ap', name:'Arithmetic', gen:genMaAP },
      { id:'ma12-gp', name:'Geometric', gen:genMaGP }]},
    { id:'ma-diff', name:'Differential calculus', topics:[
      { id:'ma12-rules', name:'Chain, product, quotient', gen:genMaDiffRules },
      { id:'ma12-trans', name:'e^x, ln x and trig', gen:genMaDiffTrans }]},
    { id:'ma-int', name:'Integral calculus', topics:[
      { id:'ma12-anti', name:'Antiderivatives', gen:genMaAnti },
      { id:'ma12-def', name:'Definite integrals & area', gen:genMaDefInt },
      { id:'ma12-trap', name:'Trapezoidal rule', gen:genMaTrap }]},
    { id:'ma-apps', name:'Applications of calculus', topics:[
      { id:'ma12-stat', name:'Stationary points', gen:genMaStat },
      { id:'ma12-optim', name:'Optimisation', gen:genMaOptim },
      { id:'ma12-motion', name:'Motion', gen:genMaMotion }]},
    { id:'ma-rv', name:'Random variables', topics:[
      { id:'ma12-disc', name:'Discrete', gen:genMaDiscRV },
      { id:'ma12-norm', name:'Normal distribution', gen:genMaNormal },
      { id:'ma12-cont', name:'Continuous', gen:genMaContRV }]},
    { id:'ma-fin', name:'Financial mathematics', topics:[
      { id:'ma12-comp', name:'Compound interest', gen:genMaCompound },
      { id:'ma12-ann', name:'Annuities & loans', gen:genMaAnnuity }]}
];
BUILD.maths12 = host => revGame(host, { title:'Maths Advanced (Year 12)',
  how:'Pick a focus area, or do the lot. Questions are generated, so they never run out.',
  statKey:'maths12', modules:MODULES_MA12 });

GAMES.push({ id:'maths12', cat:'Revision', year:12, ico:'∫', name:'Maths Advanced',
  blurb:'Calculus, series, random variables, financial maths' });

/* ══ MATHEMATICS EXTENSION 1 — YEAR 12 ════════════════════════════════════
   Mathematics Extension 1 11–12 Syllabus (2024), first examined in 2027.
   The HSC paper is 70 marks in 2 hours (plus 10 minutes reading): Section I
   is ten multiple-choice marks, Section II is 60 marks over four questions.
   Year 11 Extension 1 content is examined in that paper too, so it has a
   module of its own here.
   ═════════════════════════════════════════════════════════════════════════ */

/* ── Proof by mathematical induction ────────────────────────────────────── */
/* Each identity carries its term and its sum as plain expressions in r and n,
   so a checker can re-derive both sides without trusting the prose. */
const kOff = j => j === 0 ? 'k' : 'k + ' + j;
const kBr = j => j === 0 ? 'k' : '(k + ' + j + ')';
const E1_SERIES = [
  { lhs:'1 + 3 + 5 + … + (2n − 1)', rhs:'n²',
    term:j => '2' + kBr(j) + ' − 1', rhsOf:j => kBr(j) + '²',
    termExpr:'2*r-1', termFn:r => 2 * r - 1, sumExpr:'n**2' },
  { lhs:'1² + 2² + 3² + … + n²', rhs:'n(n + 1)(2n + 1)/6',
    term:j => kBr(j) + '²',
    rhsOf:j => kBr(j) + kBr(j + 1) + '(2' + kBr(j) + ' + 1)/6',
    termExpr:'r**2', termFn:r => r * r, sumExpr:'n*(n+1)*(2*n+1)/6' },
  { lhs:'1³ + 2³ + 3³ + … + n³', rhs:'n²(n + 1)²/4',
    term:j => kBr(j) + '³',
    rhsOf:j => kBr(j) + '²' + kBr(j + 1) + '²/4',
    termExpr:'r**3', termFn:r => r * r * r, sumExpr:'n**2*(n+1)**2/4' },
  { lhs:'1×2 + 2×3 + 3×4 + … + n(n + 1)', rhs:'n(n + 1)(n + 2)/3',
    term:j => kBr(j) + kBr(j + 1),
    rhsOf:j => kBr(j) + kBr(j + 1) + kBr(j + 2) + '/3',
    termExpr:'r*(r+1)', termFn:r => r * (r + 1), sumExpr:'n*(n+1)*(n+2)/3' },
  { lhs:'1/(1×2) + 1/(2×3) + … + 1/(n(n + 1))', rhs:'n/(n + 1)',
    term:j => '1/[' + kBr(j) + kBr(j + 1) + ']',
    rhsOf:j => kBr(j) + '/' + kBr(j + 1),
    termExpr:'1/(r*(r+1))', termFn:r => 1 / (r * (r + 1)), sumExpr:'n/(n+1)' },
  { lhs:'2 + 2² + 2³ + … + 2ⁿ', rhs:'2ⁿ⁺¹ − 2',
    term:j => '2^(' + kOff(j) + ')', rhsOf:j => '2^(' + kOff(j + 1) + ') − 2',
    termExpr:'2**r', termFn:r => Math.pow(2, r), sumExpr:'2**(n+1)-2' },
  { lhs:'1 + 4 + 7 + … + (3n − 2)', rhs:'n(3n − 1)/2',
    term:j => '3' + kBr(j) + ' − 2',
    rhsOf:j => kBr(j) + '(3' + kBr(j) + ' − 1)/2',
    termExpr:'3*r-2', termFn:r => 3 * r - 2, sumExpr:'n*(3*n-1)/2' }
];
const e1Sum = (s, n) => { let t = 0; for (let r = 1; r <= n; r++) t += s.termFn(r); return t; };

function genE1IndSum(){
  const s = pk(E1_SERIES), k = ri(0, 3);
  const ident = '<b>' + s.lhs + ' = ' + s.rhs + '</b>';
  if (k === 0){                                   // the sum itself, as a number
    const n = ri(3, 7), val = e1Sum(s, n);
    const round = Number.isInteger(val) ? '' : ', to 4 decimal places';
    return { q:'A proof by induction is to show that ' + ident + ' for all integers n ≥ 1. What does the <b>left-hand side</b> come to when n = ' + n + round + '?',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:Math.max(1e-4, Math.abs(val) * 1e-4) }),
      data:{ kind:'ind-value', termExpr:s.termExpr, n },
      note:'Add the first ' + n + ' terms. The right-hand side gives the same thing, which is what makes the statement worth proving.' };
  }
  if (k === 1){                                   // the term the inductive step adds
    const m = mc(s.term(1), [s.term(0), s.term(2), s.rhsOf(1), s.rhsOf(0)]);
    return { q:'You are proving ' + ident + ' by induction and have assumed it is true for n = k. Moving to n = k + 1, which term is <b>added to the left-hand side</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ind-term', termExpr:s.termExpr },
      note:'The left-hand side is the general term with r running up to n, so going from k to k + 1 adds that term at r = k + 1.' };
  }
  if (k === 2){                                   // the target for the step
    const m = mc(s.rhsOf(1), [s.rhsOf(0), s.rhsOf(2), s.term(1), s.rhs + ' + 1']);
    return { q:'You are proving ' + ident + ' by induction. What must the sum of the first <b>k + 1</b> terms be shown to equal?',
      choices:m.choices, answer:m.answer, data:{ kind:'ind-target', sumExpr:s.sumExpr },
      note:'Substitute n = k + 1 into the right-hand side. The step is finished when the assumption plus the new term is rearranged into exactly that.' };
  }
  const v1 = e1Sum(s, 1);                         // the base case
  const right = 'When n = 1 both sides equal ' + rd(v1, 4) + '.';
  const m = mc(right, ['Assume the statement is true for n = k.',
    'When n = 1 the left-hand side equals ' + rd(v1 + 1, 4) + '.',
    'The statement is true for every n, so n = 1 needs no check.',
    'Assume the statement is true for all n.']);
  return { q:'You are proving ' + ident + ' by induction. Which of these is the <b>base case</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'ind-base', termExpr:s.termExpr, sumExpr:s.sumExpr, v1 },
    note:'The base case is a check, not an assumption: show the statement itself holds at the smallest n, here n = 1.' };
}

/* ── Proof by mathematical induction: divisibility ──────────────────────── */
const E1_DIVS = [
  { expr:'7ⁿ − 1', d:6, show:n => '7' + sup(n) + ' − 1', at:n => Math.pow(7, n) - 1, step:'42M + 6',
    wrongs:['7M + 6', '42M − 6', '6M + 7', '42M + 7'],
    why:'7^(k+1) − 1 = 7(6M + 1) − 1 = 42M + 6 = 6(7M + 1).' },
  { expr:'4ⁿ − 1', d:3, show:n => '4' + sup(n) + ' − 1', at:n => Math.pow(4, n) - 1, step:'12M + 3',
    wrongs:['4M + 3', '12M − 3', '3M + 4', '12M'],
    why:'4^(k+1) − 1 = 4(3M + 1) − 1 = 12M + 3 = 3(4M + 1).' },
  { expr:'3²ⁿ − 1', d:8, show:n => '3' + sup(2 * n) + ' − 1', at:n => Math.pow(9, n) - 1, step:'72M + 8',
    wrongs:['9M + 8', '72M − 8', '8M + 9', '24M + 8'],
    why:'3^(2k+2) − 1 = 9(8M + 1) − 1 = 72M + 8 = 8(9M + 1).' },
  { expr:'5ⁿ + 3', d:4, show:n => '5' + sup(n) + ' + 3', at:n => Math.pow(5, n) + 3, step:'20M − 12',
    wrongs:['5M + 3', '20M + 12', '4M − 12', '20M − 3'],
    why:'5ᵏ = 4M − 3, so 5^(k+1) + 3 = 5(4M − 3) + 3 = 20M − 12 = 4(5M − 3).' },
  { expr:'n³ + 2n', d:3, show:n => n + '³ + 2×' + n, at:n => n * n * n + 2 * n, step:'3M + 3(k² + k + 1)',
    wrongs:['3M + 3k²', '3M + k² + k + 1', '3M + 3k', '3M + 2'],
    why:'(k + 1)³ + 2(k + 1) = (k³ + 2k) + 3k² + 3k + 3 = 3M + 3(k² + k + 1).' },
  { expr:'9ⁿ − 5ⁿ', d:4, show:n => '9' + sup(n) + ' − 5' + sup(n), at:n => Math.pow(9, n) - Math.pow(5, n), step:'9(4M) + 4(5ᵏ)',
    wrongs:['4M + 5ᵏ', '9(4M) − 4(5ᵏ)', '4M', '36M'],
    why:'9^(k+1) − 5^(k+1) = 9(9ᵏ − 5ᵏ) + 9(5ᵏ) − 5(5ᵏ) = 9(4M) + 4(5ᵏ), and both parts are multiples of 4.' }
];

function genE1IndDiv(){
  const f = pk(E1_DIVS), k = ri(0, 2);
  if (k === 0){
    const n = ri(2, 4), val = f.at(n);
    return { q:'You are proving that <b>' + f.expr + '</b> is divisible by <b>' + f.d + '</b> for all integers n ≥ 1. What is the value of ' + f.show(n) + '?',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'div-value', expr:f.expr, d:f.d, n, val },
      note:'It comes to ' + val + ', which is ' + (val / f.d) + ' × ' + f.d + ', so the statement holds there.' };
  }
  if (k === 1){
    const m = mc(f.step, f.wrongs);
    return { q:'In proving <b>' + f.expr + '</b> is divisible by <b>' + f.d + '</b>, you assume that for n = k the expression equals <b>' + f.d + 'M</b> for some integer M. Which of these is the expression at <b>n = k + 1</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'div-step', d:f.d },
      note:f.why };
  }
  const m = mc('No base case is checked, so nothing is ever known to be true.',
    ['The assumption should be made for all n, not just n = k.',
     'Divisibility results cannot be proved by induction.',
     'M should be allowed to be a fraction.',
     'The result should be proved for n = k + 2 as well.']);
  return { q:'A student writes: “Assume ' + f.expr + ' = ' + f.d + 'M for n = k. Then at n = k + 1 the expression is a multiple of ' + f.d + '. Therefore it is divisible by ' + f.d + ' for all n.” What is <b>wrong</b> with the proof?',
    choices:m.choices, answer:m.answer, data:{ kind:'div-false', d:f.d },
    note:'The inductive step only passes truth along a chain. Without a verified starting link the chain hangs on nothing.' };
}

/* ── Vectors: components and magnitude ──────────────────────────────────── */
const E1_TRIP2 = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];
const E1_TRIP3 = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [3, 4, 12, 13], [6, 6, 7, 11], [2, 10, 11, 15]];
const vecTerm = (c, letter) => (c < 0 ? '− ' : '+ ') + (Math.abs(c) === 1 ? '' : Math.abs(c)) + letter;
const vecStr = (a, b, c) => neg(xTerm(a, 'i')) + ' ' + vecTerm(b, 'j') + (c == null ? '' : ' ' + vecTerm(c, 'k'));

function genE1VecBasic(){
  const k = ri(0, 4);
  if (k === 0){                                   // magnitude in two dimensions
    const t = pk(E1_TRIP2), a = t[0] * pk([1, -1]), b = t[1] * pk([1, -1]);
    return { q:'Find the magnitude of the vector <b>' + vecStr(a, b) + '</b>.',
      input:true, answer:t[2], accept:qty(t[2], { tol:0.05 }), data:{ kind:'mag2', a, b },
      note:'|v| = √((' + neg(a) + ')² + (' + neg(b) + ')²) = √' + (a * a + b * b) + ' = ' + t[2] + '. Signs make no difference to a length.' };
  }
  if (k === 1){                                   // magnitude in three dimensions
    const t = pk(E1_TRIP3), a = t[0] * pk([1, -1]), b = t[1] * pk([1, -1]), c = t[2] * pk([1, -1]);
    return { q:'Find the magnitude of the vector <b>' + vecStr(a, b, c) + '</b>.',
      input:true, answer:t[3], accept:qty(t[3], { tol:0.05 }), data:{ kind:'mag3', a, b, c },
      note:'|v| = √(' + (a * a) + ' + ' + (b * b) + ' + ' + (c * c) + ') = √' + (a * a + b * b + c * c) + ' = ' + t[3] + '.' };
  }
  if (k === 2){                                   // the unit vector
    const t = pk(E1_TRIP2), a = t[0] * pk([1, -1]), b = t[1] * pk([1, -1]), m = t[2];
    const right = '(1/' + m + ')(' + vecStr(a, b) + ')';
    const w = mc(right, ['(1/' + (a * a + b * b) + ')(' + vecStr(a, b) + ')', '(1/' + m + ')(' + vecStr(b, a) + ')',
      vecStr(a, b), '(1/' + m + ')(' + vecStr(-a, -b) + ')']);
    return { q:'Which of these is the <b>unit vector</b> in the direction of ' + vecStr(a, b) + '?',
      choices:w.choices, answer:w.answer, data:{ kind:'unit', a, b, m },
      note:'Divide by the magnitude: |v| = ' + m + ', so the unit vector is (1/' + m + ')(' + vecStr(a, b) + ').' };
  }
  if (k === 3){                                   // distance between two points in space
    const t = pk(E1_TRIP3);
    const P = [ri(-4, 4), ri(-4, 4), ri(-4, 4)];
    const Q = [P[0] + t[0], P[1] + t[1], P[2] + t[2]];
    return { q:'Points A(' + neg(P.join(', ')) + ') and B(' + neg(Q.join(', ')) + ') are in three dimensions. Find the <b>distance AB</b>.',
      input:true, answer:t[3], accept:qty(t[3], { tol:0.05 }), data:{ kind:'dist3', P, Q },
      note:'AB = B − A = ' + vecStr(t[0], t[1], t[2]) + ', and its magnitude is ' + t[3] + '.' };
  }
  const mag = ri(5, 20), deg = pk([25, 35, 40, 50, 55, 65, 70]);   // components from a direction
  const want = pk(['i', 'j']);
  const val = want === 'i' ? mag * Math.cos(deg * Math.PI / 180) : mag * Math.sin(deg * Math.PI / 180);
  return { q:'A vector of magnitude <b>' + mag + '</b> makes an angle of <b>' + deg + '°</b> with the positive x-axis. Find its <b>' + want + '-component</b>, to 2 decimal places.',
    input:true, answer:rd(val, 2), accept:qty(val, { tol:0.02 }), data:{ kind:'comp', mag, deg, want },
    note:'The components are |v|cos θ and |v|sin θ, so the ' + want + '-component is ' + mag + (want === 'i' ? ' cos ' : ' sin ') + deg + '° = ' + rd(val, 2) + '.' };
}

/* ── Vectors: operating with them ───────────────────────────────────────── */
function genE1VecOps(){
  const k = ri(0, 7);
  const a = [nzr(-6, 6), nzr(-6, 6)], b = [nzr(-6, 6), nzr(-6, 6)];
  while (a[0] * b[1] - a[1] * b[0] === 0) b[1] = nzr(-6, 6);      // never parallel: the angle would be 0° or 180°
  const dot = a[0] * b[0] + a[1] * b[1];
  if (k === 0){
    return { q:'Find <b>a · b</b> where a = ' + vecStr(a[0], a[1]) + ' and b = ' + vecStr(b[0], b[1]) + '.',
      input:true, answer:dot, accept:qty(dot, { tol:0.4 }), data:{ kind:'dot', a, b },
      note:'Multiply matching components and add: (' + neg(a[0]) + ')(' + neg(b[0]) + ') + (' + neg(a[1]) + ')(' + neg(b[1]) + ') = ' + neg(dot) + '.' };
  }
  if (k === 1){
    const ma = Math.sqrt(a[0] * a[0] + a[1] * a[1]), mb = Math.sqrt(b[0] * b[0] + b[1] * b[1]);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI;
    return { q:'Find the angle between <b>' + vecStr(a[0], a[1] ) + '</b> and <b>' + vecStr(b[0], b[1]) + '</b>, in degrees to 1 decimal place.',
      input:true, answer:rd(ang, 1), accept:qty(ang, { tol:0.1 }), data:{ kind:'angle', a, b },
      note:'cos θ = (a · b)/(|a||b|) = ' + neg(dot) + '/(' + rd(ma, 3) + ' × ' + rd(mb, 3) + '), giving θ = ' + rd(ang, 1) + '°.' };
  }
  if (k === 2){                                   // perpendicular: solve for the unknown
    const p = nzr(-5, 5), q = nzr(-5, 5), r = nzr(-5, 5);
    const lam = -(p * r) / q;                     // (p i + q j) · (r i + λ j) = 0
    return { q:'The vectors <b>' + vecStr(p, q) + '</b> and <b>' + xTerm(r, 'i') + ' + λj</b> are <b>perpendicular</b>. Find λ.',
      input:true, answer:rd(lam, 4), accept:qty(lam, { tol:0.01 }), data:{ kind:'perp', p, q, r },
      note:'Perpendicular vectors have a zero dot product: ' + neg(p * r) + ' ' + signed(q) + 'λ = 0, so λ = ' + neg(rd(lam, 4)) + '.' };
  }
  if (k === 3){                                   // parallel: solve for the unknown
    const p = nzr(-5, 5), q = nzr(-5, 5), s = nzr(2, 4);
    const lam = q * s;                            // (p i + q j) parallel to (sp i + λ j)
    return { q:'The vectors <b>' + vecStr(p, q) + '</b> and <b>' + xTerm(s * p, 'i') + ' + λj</b> are <b>parallel</b>. Find λ.',
      input:true, answer:lam, accept:qty(lam, { tol:0.01 }), data:{ kind:'para', p, q, s },
      note:'The second is ' + s + ' times the first, so both components scale: λ = ' + s + ' × ' + q + ' = ' + lam + '.' };
  }
  if (k === 5){                                   // the angle at the origin, as multiple choice
    const ma = Math.hypot(a[0], a[1]), mb = Math.hypot(b[0], b[1]);
    const deg = r => Math.acos(Math.max(-1, Math.min(1, r))) * 180 / Math.PI;
    const ang = deg(dot / (ma * mb));
    const m = numMC(ang, [180 - ang, ang * Math.PI / 180, deg((a[0] * b[1] + a[1] * b[0]) / (ma * mb)),
                          deg((a[0] * b[0] - a[1] * b[1]) / (ma * mb)), Math.abs(90 - ang), 360 - ang], 1);
    return { q:'Points A and B have position vectors <b>OA = ' + vecStr(a[0], a[1]) + '</b> and <b>OB = ' + vecStr(b[0], b[1]) + '</b>. What is the size of <b>∠AOB</b>, in degrees correct to 1 decimal place?',
      choices:m.choices, answer:m.answer, data:{ kind:'angle', a, b },
      note:'∠AOB is the angle between OA and OB, so cos θ = (OA · OB)/(|OA||OB|) = ' + neg(dot) + '/(' + rd(ma, 3) + ' × ' + rd(mb, 3) + ') and θ = ' + rd(ang, 1) + '°. '
        + (dot < 0 ? 'The dot product is negative, so the angle is obtuse.' : dot > 0 ? 'The dot product is positive, so the angle is acute.' : 'The dot product is zero, so OA and OB are perpendicular.')
        + ' A calculator left in radians gives ' + rd(ang * Math.PI / 180, 1) + ' instead.' };
  }
  if (k === 6){                                   // perpendicular, as multiple choice, with a whole-number λ
    const p = nzr(-5, 5), q = nzr(-4, 4), c = nzr(-3, 3), r = q * c, lam = -p * c;   // pr + qλ = pqc − qpc = 0
    const m = numMC(lam, [p * c, q * q * c / p, -q * q * c / p, r, -r, -(p + r) / q, (p + r) / q, c, -c,
                          2 * lam, -2 * lam]);   // the last two only when every slip above lands on ±1
    return { q:'For which value of λ are the vectors <b>u = ' + vecStr(p, q) + '</b> and <b>v = ' + neg(xTerm(r, 'i')) + ' + λj</b> perpendicular?',
      choices:m.choices, answer:m.answer, data:{ kind:'perp', p, q, r },
      note:'Perpendicular means u · v = 0: (' + neg(p) + ')(' + neg(r) + ') + (' + neg(q) + ')λ = 0, so ' + neg(p * r) + plusTerm(q, 'λ') + ' = 0 and λ = ' + neg(lam) + '. '
        + 'Making the components proportional instead would give the parallel vector.' };
  }
  if (k === 7){                                   // scalar projection, as multiple choice
    while (a[0] * b[0] + a[1] * b[1] === 0 || a[0] * b[1] - a[1] * b[0] === 0) b[1] = nzr(-6, 6);   // a zero dot product collapses the options
    const d = a[0] * b[0] + a[1] * b[1], ma = Math.hypot(a[0], a[1]), mb = Math.hypot(b[0], b[1]), pr = d / mb;
    const m = numMC(pr, [d / ma, d / (mb * mb), d, -pr]);
    return { q:'What is the <b>scalar projection</b> of ' + vecStr(a[0], a[1]) + ' in the direction of ' + vecStr(b[0], b[1]) + ', correct to 2 decimal places?',
      choices:m.choices, answer:m.answer, data:{ kind:'proj', a, b },
      note:'Divide the dot product by the length of the vector you are projecting onto: ' + neg(d) + '/|' + vecStr(b[0], b[1]) + '| = ' + neg(d) + '/' + rd(mb, 3) + ' = ' + neg(rd(pr, 2)) + '. '
        + 'Dividing by ' + rd(mb * mb, 0) + ' instead gives the multiple of b in the vector projection, not its length.' };
  }
  const mb = Math.sqrt(b[0] * b[0] + b[1] * b[1]);   // scalar projection
  const proj = dot / mb;
  return { q:'Find the <b>scalar projection</b> of a = ' + vecStr(a[0], a[1]) + ' onto b = ' + vecStr(b[0], b[1]) + ', to 2 decimal places.',
    input:true, answer:rd(proj, 2), accept:qty(proj, { tol:0.02 }), data:{ kind:'proj', a, b },
    note:'The scalar projection is (a · b)/|b| = ' + neg(dot) + '/' + rd(mb, 3) + ' = ' + neg(rd(proj, 2)) + '. It is negative when the vectors point apart.' };
}

/* ── Vectors: projectile motion ─────────────────────────────────────────── */
/* g is stated in every question rather than assumed, the way HSC questions do. */
function genE1Proj(){
  const g = 9.8, V = ri(10, 50), deg = pk([15, 20, 25, 30, 35, 40, 45, 50, 60, 65, 70]);
  const th = deg * Math.PI / 180, vx = V * Math.cos(th), vy = V * Math.sin(th);
  const lead = 'A projectile is fired from the ground at <b>' + V + ' m s' + sup(-1) + '</b>, at <b>' + deg + '°</b> to the horizontal. Take g = 9.8 m s' + sup(-2) + '. ';
  const k = ri(0, 7);
  if (k === 0){
    const T = 2 * vy / g;
    return { q:lead + 'How long is it in the <b>air</b>, in seconds to 2 decimal places?',
      input:true, answer:rd(T, 2), accept:qty(T, { tol:0.02, dim:'time' }), data:{ kind:'flight', V, deg, g },
      note:'Vertically ẏ = ' + rd(vy, 3) + ' − 9.8t, which is zero at the top; the flight lasts twice that, T = 2V sin θ/g = ' + rd(T, 2) + ' s.' };
  }
  if (k === 1){
    const H = vy * vy / (2 * g);
    return { q:lead + 'What is its <b>greatest height</b>, in metres to 2 decimal places?',
      input:true, answer:rd(H, 2), accept:qty(H, { tol:0.02, dim:'length' }), data:{ kind:'maxh', V, deg, g },
      note:'At the top the vertical velocity is zero, so H = V²sin²θ/(2g) = ' + rd(H, 2) + ' m.' };
  }
  if (k === 2){
    const R = V * V * Math.sin(2 * th) / g;
    return { q:lead + 'What is its <b>horizontal range</b>, in metres to 2 decimal places?',
      input:true, answer:rd(R, 2), accept:qty(R, { tol:0.03, dim:'length' }), data:{ kind:'range', V, deg, g },
      note:'R = V²sin 2θ/g = ' + rd(R, 2) + ' m. The same range comes from the complementary angle, ' + (90 - deg) + '°.' };
  }
  if (k === 3){
    const t = rd(ri(5, 25) / 10, 1), y = vy * t - g * t * t / 2;
    return { q:lead + 'What is its <b>height</b> after <b>' + t + ' s</b>, in metres to 2 decimal places? (A negative answer means it has already landed.)',
      input:true, answer:rd(y, 2), accept:qty(y, { tol:0.02, dim:'length' }), data:{ kind:'height', V, deg, g, t },
      note:'y = V sin θ · t − ½gt² = ' + rd(vy, 3) + ' × ' + t + ' − 4.9 × ' + t + '² = ' + neg(rd(y, 2)) + ' m.' };
  }
  if (k === 4){
    const t = rd(ri(5, 25) / 10, 1), vyt = vy - g * t;
    const sp = Math.sqrt(vx * vx + vyt * vyt);
    return { q:lead + 'What is its <b>speed</b> after <b>' + t + ' s</b>, in m s' + sup(-1) + ' to 2 decimal places?',
      input:true, answer:rd(sp, 2), accept:qty(sp, { tol:0.02, dim:'speed' }), data:{ kind:'speed', V, deg, g, t },
      note:'The horizontal part stays at ' + rd(vx, 3) + '; the vertical part is ' + rd(vy, 3) + ' − 9.8 × ' + t + ' = ' + neg(rd(vyt, 3)) + '. Speed is √(ẋ² + ẏ²) = ' + rd(sp, 2) + '.' };
  }
  /* the same launch in an everyday setting, for the multiple-choice versions,
     with nothing thrown by hand faster than a person could manage */
  const thing = V <= 25 ? pk(['A golf ball is struck', 'A soccer ball is kicked', 'A stone is thrown'])
                        : pk(['A golf ball is struck', 'A cricket ball is hit', 'A ball is fired from a launcher']);
  const ctx = thing + ' from level ground at <b>' + V + ' m s' + sup(-1) + '</b>, at <b>' + deg + '°</b> above the horizontal. Ignore air resistance and take g = 9.8 m s' + sup(-2) + '. ';
  if (k === 6){                                   // range, as multiple choice
    const R = V * V * Math.sin(2 * th) / g;
    const m = numMC(R, [R / 2, V * V * Math.sin(th) / g, 2 * R, V * V / g, V * V * Math.cos(th) / g], 1);
    return { q:ctx + 'How far from its starting point does it land, in metres correct to 1 decimal place?',
      choices:m.choices, answer:m.answer, data:{ kind:'range', V, deg, g },
      note:'It lands when y = 0, at t = 2V sin θ/g = ' + rd(2 * vy / g, 3) + ' s. Then x = V cos θ · t = V²sin 2θ/g = ' + rd(R, 1) + ' m. '
        + 'Using the time to the top, V sin θ/g, gives only half the range, ' + rd(R / 2, 1) + ' m.' };
  }
  if (k === 7){                                   // greatest height, as multiple choice
    const H = vy * vy / (2 * g);
    const m = numMC(H, [vy * vy / g, V * V * Math.sin(th) / (2 * g), V * V / (2 * g), vx * vx / (2 * g), H / 2], 1);
    return { q:ctx + 'What is its <b>greatest height</b>, in metres correct to 1 decimal place?',
      choices:m.choices, answer:m.answer, data:{ kind:'maxh', V, deg, g },
      note:'At the top ẏ = 0, so V sin θ = gt and t = ' + rd(vy / g, 3) + ' s. Putting that into y = V sin θ · t − ½gt² gives H = V²sin²θ/(2g) = ' + rd(H, 1) + ' m. '
        + 'Only the vertical component counts: V²/(2g) = ' + rd(V * V / (2 * g), 1) + ' m would be the height of a throw straight up.' };
  }
  const m = mc('The vertical component of the velocity is zero.',
    ['The speed is zero.', 'The acceleration is zero.', 'The horizontal component of the velocity is zero.',
     'The acceleration points upwards.']);
  return { q:'A projectile is fired at an angle to the horizontal and air resistance is ignored. Which statement is true at its <b>greatest height</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'apex' },
    note:'Only the vertical velocity dies away. The horizontal component never changes, and the acceleration stays g downwards throughout.' };
}

/* ── Inverse trigonometric functions ────────────────────────────────────── */
/* value, as a multiple of π, for each exact argument worth asking about */
const E1_EXACT = [
  { f:'sin', a:'1/2', n:1, d:6 },   { f:'sin', a:'1/√2', n:1, d:4 },  { f:'sin', a:'√3/2', n:1, d:3 },
  { f:'sin', a:'1', n:1, d:2 },     { f:'sin', a:'0', n:0, d:1 },     { f:'sin', a:'−1/2', n:-1, d:6 },
  { f:'sin', a:'−√3/2', n:-1, d:3 },
  { f:'cos', a:'1/2', n:1, d:3 },   { f:'cos', a:'1/√2', n:1, d:4 },  { f:'cos', a:'√3/2', n:1, d:6 },
  { f:'cos', a:'0', n:1, d:2 },     { f:'cos', a:'−1/2', n:2, d:3 },  { f:'cos', a:'−1', n:1, d:1 },
  { f:'cos', a:'−√3/2', n:5, d:6 },
  { f:'tan', a:'1', n:1, d:4 },     { f:'tan', a:'√3', n:1, d:3 },    { f:'tan', a:'1/√3', n:1, d:6 },
  { f:'tan', a:'0', n:0, d:1 },     { f:'tan', a:'−1', n:-1, d:4 },   { f:'tan', a:'−√3', n:-1, d:3 }
];

function genE1InvTrig(){
  const k = ri(0, 5);
  if (k === 0){                                   // an exact value
    const e = pk(E1_EXACT);
    const right = e.n === 0 ? '0' : piStr(e.n, e.d);
    const pool = [piStr(e.n === 0 ? 1 : -e.n, e.d), piStr(e.n === 0 ? 1 : e.n, e.d === 6 ? 3 : 6),
                  piStr(1, 2), piStr(1, 4), piStr(2, 3), '0'];
    const m = mc(right, pool.filter(x => x !== right));
    return { q:'Find the exact value of <b>' + e.f + sup(-1) + '(' + e.a + ')</b>.',
      choices:m.choices, answer:m.answer, data:{ kind:'inv-exact', f:e.f, n:e.n, d:e.d },
      note:e.f + sup(-1) + ' returns the angle in its own restricted range, and ' + e.f + '(' + right + ') = ' + e.a + '.' };
  }
  if (k === 1){                                   // domain of a stretched inverse sine or cosine
    const b = ri(2, 6), f = pk(['sin', 'cos']);
    const right = '−1/' + b + ' ≤ x ≤ 1/' + b;
    const m = mc(right, ['−' + b + ' ≤ x ≤ ' + b, '−1 ≤ x ≤ 1', '0 ≤ x ≤ 1/' + b, 'all real x']);
    return { q:'What is the <b>domain</b> of y = ' + f + sup(-1) + '(' + b + 'x)?',
      choices:m.choices, answer:m.answer, data:{ kind:'inv-domain', b },
      note:'The inside must stay between −1 and 1, so −1 ≤ ' + b + 'x ≤ 1, which is −1/' + b + ' ≤ x ≤ 1/' + b + '.' };
  }
  if (k === 2){                                   // the range, which is where the restriction bites
    const a = ri(2, 4), f = pk(['sin', 'cos', 'tan']);
    const right = f === 'sin' ? neg(piStr(-a, 2)) + ' ≤ y ≤ ' + piStr(a, 2)
                : f === 'cos' ? '0 ≤ y ≤ ' + piStr(a, 1)
                : neg(piStr(-a, 2)) + ' < y < ' + piStr(a, 2);
    const m = mc(right, ['0 ≤ y ≤ ' + piStr(a, 2), neg(piStr(-a, 2)) + ' ≤ y ≤ ' + piStr(a, 2),
      '0 ≤ y ≤ ' + piStr(a, 1), '−1 ≤ y ≤ 1', 'all real y'].filter(x => x !== right));
    return { q:'What is the <b>range</b> of y = ' + a + ' ' + f + sup(-1) + ' x?',
      choices:m.choices, answer:m.answer, data:{ kind:'inv-range', a, f },
      note:f + sup(-1) + ' x itself runs over ' + (f === 'sin' ? '[−π/2, π/2]' : f === 'cos' ? '[0, π]' : '(−π/2, π/2)') + ', and multiplying by ' + a + ' stretches that.' };
  }
  if (k === 3){                                   // sin⁻¹x + cos⁻¹x = π/2
    const v = rd(ri(10, 140) / 100, 2), other = Math.PI / 2 - v;
    return { q:'For a particular x, <b>sin' + sup(-1) + ' x = ' + v + '</b> radians. Find <b>cos' + sup(-1) + ' x</b>, in radians to 3 decimal places.',
      input:true, answer:rd(other, 3), accept:qty(other, { tol:0.002 }), data:{ kind:'inv-complement', v },
      note:'sin' + sup(-1) + ' x + cos' + sup(-1) + ' x = π/2 for every x in the domain, so cos' + sup(-1) + ' x = π/2 − ' + v + ' = ' + rd(other, 3) + '.' };
  }
  if (k === 4){                                   // a composite, done with a right triangle
    const t = pk(E1_TRIP2), flip = Math.random() < 0.5;
    const opp = flip ? t[1] : t[0], adj = flip ? t[0] : t[1], hyp = t[2];
    const want = pk(['cos', 'tan']);
    const val = want === 'cos' ? adj / hyp : opp / adj;
    return { q:'Find the exact value of <b>' + want + '(sin' + sup(-1) + '(' + opp + '/' + hyp + '))</b>, as a decimal to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }), data:{ kind:'inv-composite', opp, adj, hyp, want },
      note:'If sin θ = ' + opp + '/' + hyp + ' then the third side is ' + adj + ' (a ' + t[0] + '–' + t[1] + '–' + t[2] + ' triangle), so ' + want + ' θ = ' + (want === 'cos' ? adj + '/' + hyp : opp + '/' + adj) + ' = ' + rd(val, 4) + '.' };
  }
  const odd = Math.random() < 0.5;                // symmetry of the inverse functions
  const right = odd ? '−sin' + sup(-1) + ' x' : 'π − cos' + sup(-1) + ' x';
  const m = mc(right, [odd ? 'sin' + sup(-1) + ' x' : 'cos' + sup(-1) + ' x',
    odd ? 'π − sin' + sup(-1) + ' x' : '−cos' + sup(-1) + ' x',
    odd ? 'π/2 − sin' + sup(-1) + ' x' : 'π/2 − cos' + sup(-1) + ' x',
    odd ? '1/sin' + sup(-1) + ' x' : '1/cos' + sup(-1) + ' x']);
  return { q:'Which expression equals <b>' + (odd ? 'sin' : 'cos') + sup(-1) + '(−x)</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'inv-symmetry', odd },
    note:odd ? 'sin' + sup(-1) + ' is an odd function — its graph has point symmetry about the origin.'
             : 'cos' + sup(-1) + ' is not odd or even: its graph has point symmetry about (0, π/2), which gives cos' + sup(-1) + '(−x) = π − cos' + sup(-1) + ' x.' };
}

/* ── Further calculus skills: integration by substitution ───────────────── */
function genE1IntSub(){
  const k = ri(0, 5);
  if (k === 0){                                   // definite, u = x² + c
    const c = ri(1, 4), n = ri(2, 4), b = ri(1, 3);
    const F = x => Math.pow(x * x + c, n + 1) / (2 * (n + 1));
    const val = F(b) - F(0);
    return { q:'Evaluate <b>∫₀' + sup(b) + ' x(x² + ' + c + ')' + sup(n) + ' dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:Math.max(0.0005, Math.abs(val) * 2e-4) }),
      data:{ kind:'e1-defint', fx:'x*Math.pow(x*x+' + c + ',' + n + ')', a:0, b, val },
      note:'With u = x² + ' + c + ', du = 2x dx, so the integral is [(x² + ' + c + ')' + sup(n + 1) + '/' + (2 * (n + 1)) + '] from 0 to ' + b + ' = ' + rd(val, 4) + '.' };
  }
  if (k === 1){                                   // the same thing, left indefinite
    const c = ri(1, 6), n = ri(2, 5);
    const right = fracStr(1, 2 * (n + 1)) + '(x² + ' + c + ')' + sup(n + 1) + ' + C';
    const m = mc(right, [fracStr(1, n + 1) + '(x² + ' + c + ')' + sup(n + 1) + ' + C',
      fracStr(1, 2 * n) + '(x² + ' + c + ')' + sup(n) + ' + C',
      '2(x² + ' + c + ')' + sup(n + 1) + ' + C',
      fracStr(1, 2 * (n + 1)) + '(x² + ' + c + ')' + sup(n) + ' + C']);
    return { q:'Find <b>∫ x(x² + ' + c + ')' + sup(n) + ' dx</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-int', fx:'x*Math.pow(x*x+' + c + ',' + n + ')', Fx:'Math.pow(x*x+' + c + ',' + (n + 1) + ')/' + (2 * (n + 1)) },
      note:'u = x² + ' + c + ' turns it into ½∫u' + sup(n) + ' du = u' + sup(n + 1) + '/' + (2 * (n + 1)) + ', then put u back.' };
  }
  if (k === 2){                                   // the limits change with the substitution
    const c = ri(1, 5), lo = ri(0, 2), hi = lo + ri(1, 3);
    const u1 = lo * lo + c, u2 = hi * hi + c;
    const right = 'from u = ' + u1 + ' to u = ' + u2;
    const m = mc(right, ['from u = ' + lo + ' to u = ' + hi, 'from u = ' + (u1 - c) + ' to u = ' + (u2 - c),
      'from u = ' + (u2) + ' to u = ' + (u1), 'from u = 0 to u = ' + u2]);
    return { q:'The substitution <b>u = x² + ' + c + '</b> is used in <b>∫' + sub(lo) + sup(hi) + ' x(x² + ' + c + ')⁵ dx</b>. What do the <b>limits</b> become?',
      choices:m.choices, answer:m.answer, data:{ kind:'sub-limits', c, lo, hi, u1, u2 },
      note:'Put each x-limit through u = x² + ' + c + ': x = ' + lo + ' gives u = ' + u1 + ', and x = ' + hi + ' gives u = ' + u2 + '. Changing the limits means never having to substitute back.' };
  }
  if (k === 3){                                   // a trigonometric substitution
    const n = ri(2, 5);
    const val = 1 / (n + 1);
    return { q:'Evaluate <b>∫₀<sup>π/2</sup> sin' + sup(n) + ' x cos x dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e1-defint', fx:'Math.pow(Math.sin(x),' + n + ')*Math.cos(x)', a:0, b:Math.PI / 2, val },
      note:'u = sin x, du = cos x dx, so it is ∫₀¹ u' + sup(n) + ' du = 1/' + (n + 1) + ' = ' + rd(val, 4) + '.' };
  }
  if (k === 4){                                   // an exponential substitution
    const a = ri(1, 3);
    const val = (Math.exp(a) - 1) / (2 * a);
    return { q:'Evaluate <b>∫₀¹ x exp(' + xTerm(a) + '²) dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e1-defint', fx:'x*Math.exp(' + a + '*x*x)', a:0, b:1, val },
      note:'u = ' + xTerm(a) + '² gives du = ' + (2 * a) + 'x dx, so the integral is (e' + sup(a) + ' − 1)/' + (2 * a) + ' = ' + rd(val, 4) + '.' };
  }
  const c = ri(1, 9), b = ri(1, 4);               // x/√(x² + c)
  const val = Math.sqrt(b * b + c) - Math.sqrt(c);
  return { q:'Evaluate <b>∫₀' + sup(b) + ' x/√(x² + ' + c + ') dx</b>, to 4 decimal places.',
    input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
    data:{ kind:'e1-defint', fx:'x/Math.sqrt(x*x+' + c + ')', a:0, b, val },
    note:'u = x² + ' + c + ' turns it into ½∫u' + sup(-1) + '/² du = √(x² + ' + c + '), so the answer is √' + (b * b + c) + ' − √' + c + ' = ' + rd(val, 4) + '.' };
}

/* ── Further calculus skills: calculus of the inverse trig functions ────── */
function genE1InvCalc(){
  const k = ri(0, 5);
  const a = ri(2, 6);
  if (k === 0){
    const right = '1/√(' + (a * a) + ' − x²)';
    const m = mc(right, ['1/√(1 − x²)', '1/(' + (a * a) + ' − x²)', a + '/√(' + (a * a) + ' − x²)',
      '−1/√(' + (a * a) + ' − x²)']);
    return { q:'Differentiate <b>y = sin' + sup(-1) + '(x/' + a + ')</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-der', fx:'Math.asin(x/' + a + ')', dfx:'1/Math.sqrt(' + (a * a) + '-x*x)', lo:-a + 0.5, hi:a - 0.5 },
      note:'d/dx sin' + sup(-1) + '(x/a) = (1/a)/√(1 − x²/a²) = 1/√(a² − x²), here 1/√(' + (a * a) + ' − x²).' };
  }
  if (k === 1){
    const right = a + '/(1 + ' + (a * a) + 'x²)';
    const m = mc(right, ['1/(1 + ' + (a * a) + 'x²)', a + '/(1 + x²)', a + '/√(1 − ' + (a * a) + 'x²)',
      '1/(' + a + '(1 + x²))']);
    return { q:'Differentiate <b>y = tan' + sup(-1) + '(' + a + 'x)</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-der', fx:'Math.atan(' + a + '*x)', dfx:'' + a + '/(1+' + (a * a) + '*x*x)', lo:-2, hi:2 },
      note:'d/dx tan' + sup(-1) + ' u = u′/(1 + u²) with u = ' + a + 'x, giving ' + a + '/(1 + ' + (a * a) + 'x²).' };
  }
  if (k === 2){
    const right = '−' + a + '/√(1 − ' + (a * a) + 'x²)';
    const m = mc(right, [a + '/√(1 − ' + (a * a) + 'x²)', '−1/√(1 − ' + (a * a) + 'x²)',
      '−' + a + '/(1 + ' + (a * a) + 'x²)', '−' + a + '/√(' + (a * a) + ' − x²)']);
    return { q:'Differentiate <b>y = cos' + sup(-1) + '(' + a + 'x)</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-der', fx:'Math.acos(' + a + '*x)', dfx:'-' + a + '/Math.sqrt(1-' + (a * a) + '*x*x)', lo:-0.9 / a, hi:0.9 / a },
      note:'Same shape as the inverse sine but negative: −u′/√(1 − u²) with u = ' + a + 'x.' };
  }
  if (k === 3){
    const right = 'sin' + sup(-1) + '(x/' + a + ') + C';
    const m = mc(right, ['cos' + sup(-1) + '(x/' + a + ') + C', fracStr(1, a) + ' sin' + sup(-1) + '(x/' + a + ') + C',
      fracStr(1, a) + ' tan' + sup(-1) + '(x/' + a + ') + C', 'ln(' + (a * a) + ' − x²) + C']);
    return { q:'Find <b>∫ dx/√(' + (a * a) + ' − x²)</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-int', fx:'1/Math.sqrt(' + (a * a) + '-x*x)', Fx:'Math.asin(x/' + a + ')', lo:-a + 0.5, hi:a - 0.5 },
      note:'This is the standard form ∫dx/√(a² − x²) = sin' + sup(-1) + '(x/a) + C, with a = ' + a + '. No 1/a out the front.' };
  }
  if (k === 4){
    const right = fracStr(1, a) + ' tan' + sup(-1) + '(x/' + a + ') + C';
    const m = mc(right, ['tan' + sup(-1) + '(x/' + a + ') + C', fracStr(1, a * a) + ' tan' + sup(-1) + '(x/' + a + ') + C',
      fracStr(1, a) + ' sin' + sup(-1) + '(x/' + a + ') + C', 'ln(' + (a * a) + ' + x²) + C']);
    return { q:'Find <b>∫ dx/(' + (a * a) + ' + x²)</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-int', fx:'1/(' + (a * a) + '+x*x)', Fx:'Math.atan(x/' + a + ')/' + a, lo:-3, hi:3 },
      note:'∫dx/(a² + x²) = (1/a)tan' + sup(-1) + '(x/a) + C. This one does carry the 1/a.' };
  }
  const half = Math.random() < 0.5;               // a definite one that lands on a nice angle
  const val = half ? Math.PI / 6 : Math.PI / (4 * a);
  const top = half ? (a % 2 === 0 ? String(a / 2) : a + '/2') : String(a);
  const body = half ? 'dx/√(' + (a * a) + ' − x²)' : 'dx/(' + (a * a) + ' + x²)';
  return { q:'Evaluate <b>∫ ' + body + '</b> from <b>x = 0</b> to <b>x = ' + top + '</b>, to 4 decimal places.',
    input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
    data:{ kind:'e1-defint', fx:half ? '1/Math.sqrt(' + (a * a) + '-x*x)' : '1/(' + (a * a) + '+x*x)', a:0, b:half ? a / 2 : a, val },
    note:half ? 'It is sin' + sup(-1) + '(x/' + a + ') between 0 and ' + a + '/2, so sin' + sup(-1) + '(1/2) = π/6 = ' + rd(val, 4) + '.'
              : 'It is (1/' + a + ')tan' + sup(-1) + '(x/' + a + ') between 0 and ' + a + ', so (1/' + a + ')(π/4) = ' + rd(val, 4) + '.' };
}

/* ── Further calculus skills: double angles under the integral sign ─────── */
function genE1TrigInt(){
  const k = ri(0, 4), a = ri(1, 4), arg = a === 1 ? 'x' : a + 'x';
  if (k === 0){
    const right = 'x/2 − ' + (a === 1 ? 'sin 2x' : 'sin ' + (2 * a) + 'x') + '/' + (4 * a) + ' + C';
    const m = mc(right, ['x/2 + ' + (a === 1 ? 'sin 2x' : 'sin ' + (2 * a) + 'x') + '/' + (4 * a) + ' + C',
      'sin³ ' + arg + '/3 + C', 'x/2 − ' + (a === 1 ? 'sin 2x' : 'sin ' + (2 * a) + 'x') + '/' + (2 * a) + ' + C',
      '−cos³ ' + arg + '/3 + C']);
    return { q:'Find <b>∫ sin²' + (' ' + arg) + ' dx</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-int', fx:'Math.pow(Math.sin(' + a + '*x),2)', Fx:'x/2-Math.sin(' + (2 * a) + '*x)/' + (4 * a), lo:0.2, hi:1.2 },
      note:'sin²θ = (1 − cos 2θ)/2, so the integral is x/2 − sin(' + (2 * a) + 'x)/' + (4 * a) + ' + C. There is no chain rule shortcut for sin² on its own.' };
  }
  if (k === 1){
    const right = 'x/2 + ' + (a === 1 ? 'sin 2x' : 'sin ' + (2 * a) + 'x') + '/' + (4 * a) + ' + C';
    const m = mc(right, ['x/2 − ' + (a === 1 ? 'sin 2x' : 'sin ' + (2 * a) + 'x') + '/' + (4 * a) + ' + C',
      'cos³ ' + arg + '/3 + C', 'x/2 + ' + (a === 1 ? 'sin 2x' : 'sin ' + (2 * a) + 'x') + '/' + (2 * a) + ' + C',
      'sin ' + (2 * a) + 'x/' + (4 * a) + ' + C']);
    return { q:'Find <b>∫ cos²' + (' ' + arg) + ' dx</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-int', fx:'Math.pow(Math.cos(' + a + '*x),2)', Fx:'x/2+Math.sin(' + (2 * a) + '*x)/' + (4 * a), lo:0.2, hi:1.2 },
      note:'cos²θ = (1 + cos 2θ)/2. The two halves of the double-angle identity differ only in that sign.' };
  }
  if (k === 2){
    const val = Math.PI / 4;
    return { q:'Evaluate <b>∫₀<sup>π/2</sup> sin² x dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e1-defint', fx:'Math.pow(Math.sin(x),2)', a:0, b:Math.PI / 2, val },
      note:'x/2 − sin 2x/4 between 0 and π/2 gives π/4 − 0 = ' + rd(val, 4) + '. Sensible, since sin² averages ½ over a quarter turn.' };
  }
  if (k === 3){
    const right = '−cos ' + (2 * a) + 'x/' + (4 * a) + ' + C';
    const m = mc(right, ['cos ' + (2 * a) + 'x/' + (4 * a) + ' + C', '−cos ' + (2 * a) + 'x/' + (2 * a) + ' + C',
      'sin² ' + arg + '/2 + C', '−sin ' + (2 * a) + 'x/' + (4 * a) + ' + C']);
    return { q:'Find <b>∫ sin ' + xTerm(a) + ' cos ' + xTerm(a) + ' dx</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e1-int', fx:'Math.sin(' + a + '*x)*Math.cos(' + a + '*x)', Fx:'-Math.cos(' + (2 * a) + '*x)/' + (4 * a), lo:0.2, hi:1.2 },
      note:'sin θ cos θ = ½ sin 2θ, so this is ½∫sin(' + (2 * a) + 'x) dx = −cos(' + (2 * a) + 'x)/' + (4 * a) + ' + C.' };
  }
  const val = Math.PI / 8 + 0.25;                 // ∫₀^{π/4} cos²x dx
  return { q:'Evaluate <b>∫₀<sup>π/4</sup> cos² x dx</b>, to 4 decimal places.',
    input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
    data:{ kind:'e1-defint', fx:'Math.pow(Math.cos(x),2)', a:0, b:Math.PI / 4, val },
    note:'x/2 + sin 2x/4 between 0 and π/4 gives π/8 + ¼ = ' + rd(val, 4) + '.' };
}

/* ── Further applications of calculus: differential equations ───────────── */
function genE1DiffEq(){
  const k = ri(0, 5);
  if (k === 0){                                   // dy/dx = f(x) through a point
    const a = ri(2, 5), c = nzr(-6, 6), x0 = ri(1, 2), y0 = nzr(-5, 8), x1 = x0 + ri(1, 3);
    const F = x => a * x * x * x / 3 + c * x;     // ∫(ax² + c) dx
    const C = y0 - F(x0), y1 = F(x1) + C;
    return { q:'A curve has <b>dy/dx = ' + xTerm(a, 'x²') + plusTerm(c, '') + '</b> and passes through <b>(' + x0 + ', ' + neg(y0) + ')</b>. Find <b>y</b> when x = ' + x1 + ', to 3 decimal places if it is not a whole number.',
      input:true, answer:rd(y1, 3), accept:qty(y1, { tol:0.002 }), data:{ kind:'de-direct', a, c, x0, y0, x1 },
      note:'Integrate: y = ' + (a % 3 === 0 ? xTerm(a / 3, 'x³') : fracStr(a, 3) + 'x³') + plusTerm(c, 'x') + ' + C. The point gives C = ' + neg(rd(C, 3)) + ', so y(' + x1 + ') = ' + neg(rd(y1, 3)) + '.' };
  }
  if (k === 1){                                   // dP/dt = kP, with k to be found on the way
    const P0 = ri(2, 9) * 100, t1 = pk([2, 3, 4, 5]), grow = pk([1.5, 2, 2.5, 3]);
    const P1 = P0 * grow, kk = Math.log(grow) / t1, t2 = t1 + ri(1, 5);
    const P2 = P0 * Math.exp(kk * t2);
    return { q:'A population satisfies <b>dP/dt = kP</b>. It starts at <b>' + P0 + '</b> and reaches <b>' + P1 + '</b> after <b>' + t1 + ' years</b>. What is it after <b>' + t2 + ' years</b>, to the nearest whole number?',
      input:true, answer:Math.round(P2), accept:qty(P2, { tol:Math.max(1, P2 * 0.004) }), data:{ kind:'de-growth', P0, t1, grow, t2 },
      note:'P = P₀e^(kt). From P(' + t1 + ') = ' + P1 + ', k = ln(' + grow + ')/' + t1 + ' = ' + rd(kk, 5) + ', so P(' + t2 + ') = ' + Math.round(P2) + '.' };
  }
  if (k === 2){                                   // Newton's law of cooling
    const A = ri(15, 25), T0 = A + ri(50, 70), t1 = pk([5, 10, 15]), drop = pk([0.5, 0.6, 0.7]);
    const T1 = A + (T0 - A) * drop, kk = -Math.log(drop) / t1, t2 = t1 * 2;
    const T2 = A + (T0 - A) * Math.exp(-kk * t2);
    return { q:'A drink cools so that <b>dT/dt = −k(T − ' + A + ')</b>, where T is in °C and t in minutes. It starts at <b>' + T0 + '°C</b> and is <b>' + rd(T1, 1) + '°C</b> after <b>' + t1 + ' minutes</b>. What is its temperature after <b>' + t2 + ' minutes</b>, to 1 decimal place?',
      input:true, answer:rd(T2, 1), accept:qty(T2, { tol:0.15 }), data:{ kind:'de-cooling', A, T0, t1, drop, t2 },
      note:'T = ' + A + ' + (T₀ − ' + A + ')e^(−kt). Here the gap above room temperature falls by a factor of ' + drop + ' every ' + t1 + ' minutes, so after ' + t2 + ' it is ' + rd(T2, 1) + '°C.' };
  }
  if (k === 3){                                   // the general solution of a separable equation
    const kk = ri(2, 5);
    const right = 'y = Ae^(' + kk + 'x)';
    const m = mc(right, ['y = ' + kk + 'x + A', 'y = Ax' + sup(kk), 'y = e^(' + kk + 'x) + A', 'y = A ln(' + kk + 'x)']);
    return { q:'What is the general solution of <b>dy/dx = ' + kk + 'y</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'de-general', k:kk },
      note:'Separating gives ∫dy/y = ∫' + kk + ' dx, so ln|y| = ' + kk + 'x + c and y = Ae^(' + kk + 'x). The constant multiplies, it does not add.' };
  }
  if (k === 4){                                   // reading a direction field
    const f = pk([
      { de:'dy/dx = x − y', zero:'the line y = x', wrong:['the line y = −x', 'the x-axis', 'the y-axis', 'the parabola y = x²'] },
      { de:'dy/dx = x + y', zero:'the line y = −x', wrong:['the line y = x', 'the x-axis', 'the y-axis', 'the parabola y = x²'] },
      { de:'dy/dx = y − x²', zero:'the parabola y = x²', wrong:['the line y = x', 'the parabola y = −x²', 'the x-axis', 'the y-axis'] },
      { de:'dy/dx = xy', zero:'both axes', wrong:['the line y = x', 'the line y = −x', 'the x-axis only', 'the y-axis only'] }
    ]);
    const m = mc(f.zero, f.wrong);
    return { q:'On the direction field of <b>' + f.de + '</b>, where are the slopes <b>zero</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'de-field', de:f.de },
      note:'Set the right-hand side to zero and read off the points that satisfy it: that is exactly where the little line segments lie flat.' };
  }
  const f = pk([
    { words:'proportional to the square root of its size', de:'dN/dt = k√N', wrong:['dN/dt = kN²', 'dN/dt = kN', 'dN/dt = k/N', 'dN/dt = √(kN) + N'] },
    { words:'proportional to the size of the population', de:'dN/dt = kN', wrong:['dN/dt = k√N', 'dN/dt = kN²', 'dN/dt = k', 'dN/dt = kt'] },
    { words:'inversely proportional to its size', de:'dN/dt = k/N', wrong:['dN/dt = kN', 'dN/dt = −kN', 'dN/dt = k√N', 'dN/dt = kN²'] },
    { words:'proportional to how far the population is below a ceiling of 5000', de:'dN/dt = k(5000 − N)', wrong:['dN/dt = k(N − 5000)', 'dN/dt = kN(5000)', 'dN/dt = 5000 − kN', 'dN/dt = kN'] }
  ]);
  const m = mc(f.de, f.wrong);
  return { q:'A population N changes at a rate <b>' + f.words + '</b>. Which differential equation says that?',
    choices:m.choices, answer:m.answer, data:{ kind:'de-model' },
    note:'“Rate” is dN/dt and “proportional to” is k times the thing named, exactly as written.' };
}

/* ── Further applications of calculus: related rates ────────────────────── */
function genE1Rates(){
  const k = ri(0, 7);
  if (k === 0){                                   // a sphere being inflated
    const rate = ri(10, 60), r = ri(2, 9);
    const dr = rate / (4 * Math.PI * r * r);
    return { q:'A spherical balloon is inflated at <b>' + rate + ' cm³ s' + sup(-1) + '</b>. How fast is the radius growing when <b>r = ' + r + ' cm</b>, in cm s' + sup(-1) + ' to 4 decimal places?',
      input:true, answer:rd(dr, 4), accept:qty(dr, { tol:0.0005 }), data:{ kind:'rate-sphere', rate, r },
      note:'V = 4πr³/3 so dV/dr = 4πr². Then dr/dt = (dV/dt)/(dV/dr) = ' + rate + '/(4π×' + (r * r) + ') = ' + rd(dr, 4) + '.' };
  }
  if (k === 1){                                   // a circle of oil spreading
    const dr = rd(ri(5, 30) / 10, 1), r = ri(3, 15);
    const dA = 2 * Math.PI * r * dr;
    return { q:'A circular oil slick grows so its radius increases at <b>' + dr + ' m min' + sup(-1) + '</b>. How fast is the area growing when <b>r = ' + r + ' m</b>, in m² min' + sup(-1) + ' to 2 decimal places?',
      input:true, answer:rd(dA, 2), accept:qty(dA, { tol:0.02 }), data:{ kind:'rate-circle', dr, r },
      note:'A = πr², so dA/dt = 2πr dr/dt = 2π×' + r + '×' + dr + ' = ' + rd(dA, 2) + '.' };
  }
  if (k === 2){                                   // a cube
    const ds = rd(ri(2, 9) / 10, 1), sdim = ri(3, 12);
    const dV = 3 * sdim * sdim * ds;
    return { q:'The side of a cube grows at <b>' + ds + ' cm s' + sup(-1) + '</b>. How fast is its volume growing when the side is <b>' + sdim + ' cm</b>, in cm³ s' + sup(-1) + '?',
      input:true, answer:rd(dV, 2), accept:qty(dV, { tol:0.02 }), data:{ kind:'rate-cube', ds, s:sdim },
      note:'V = s³ so dV/dt = 3s² ds/dt = 3×' + (sdim * sdim) + '×' + ds + ' = ' + rd(dV, 2) + '.' };
  }
  if (k === 3){                                   // filling a cylinder
    const r = ri(2, 8), rate = ri(20, 200);
    const dh = rate / (Math.PI * r * r);
    return { q:'Water runs into a cylindrical tank of radius <b>' + r + ' m</b> at <b>' + rate + ' m³ h' + sup(-1) + '</b>. How fast is the depth rising, in m h' + sup(-1) + ' to 4 decimal places?',
      input:true, answer:rd(dh, 4), accept:qty(dh, { tol:0.0005 }), data:{ kind:'rate-cyl', r, rate },
      note:'V = πr²h with r fixed, so dV/dt = πr² dh/dt and dh/dt = ' + rate + '/(π×' + (r * r) + ') = ' + rd(dh, 4) + '.' };
  }
  if (k === 4){                                   // the sliding ladder
    const t = pk(E1_TRIP2), dx = rd(ri(2, 9) / 10, 1);
    const x = t[0], y = t[1], L = t[2];
    const dy = -(x / y) * dx;
    return { q:'A <b>' + L + ' m</b> ladder leans on a wall. Its foot slides away from the wall at <b>' + dx + ' m s' + sup(-1) + '</b>. How fast is the top sliding <b>down</b> when the foot is <b>' + x + ' m</b> from the wall? Give a positive number, in m s' + sup(-1) + ' to 4 decimal places.',
      input:true, answer:rd(-dy, 4), accept:qty(-dy, { tol:0.0005 }), data:{ kind:'rate-ladder', x, y, L, dx },
      note:'x² + y² = ' + (L * L) + ', so 2x dx/dt + 2y dy/dt = 0. With y = ' + y + ', dy/dt = −(' + x + '/' + y + ')(' + dx + ') = ' + neg(rd(dy, 4)) + ', i.e. ' + rd(-dy, 4) + ' downwards.' };
  }
  if (k === 6){                                   // a spreading ripple, as multiple choice
    const dr = rd(ri(5, 30) / 10, 1), r = ri(3, 15);
    const dA = 2 * Math.PI * r * dr;
    const m = numMC(dA, [Math.PI * r * r * dr, Math.PI * r * dr, 2 * Math.PI * dr, 2 * r * dr], 1);
    return { q:'A stone dropped into a still pond sends out a circular ripple whose radius grows at <b>' + dr + ' m s' + sup(-1) + '</b>. How fast is the area inside the ripple growing when the radius is <b>' + r + ' m</b>, in m² s' + sup(-1) + ' correct to 1 decimal place?',
      choices:m.choices, answer:m.answer, data:{ kind:'rate-circle', dr, r },
      note:'A = πr², so dA/dr = 2πr and dA/dt = dA/dr × dr/dt = 2π × ' + r + ' × ' + dr + ' = ' + rd(dA, 1) + '. '
        + 'Multiplying the area itself by dr/dt gives ' + rd(Math.PI * r * r * dr, 1) + ', which skips the derivative.' };
  }
  if (k === 7){                                   // the sliding ladder, as multiple choice
    const t = pk(E1_TRIP2), dx = rd(ri(2, 9) / 10, 1);
    const x = t[0], y = t[1], L = t[2], down = x / y * dx;
    const m = numMC(down, [y / x * dx, dx, x / L * dx, L / y * dx, y / L * dx], 3);
    return { q:'The foot of a <b>' + L + ' m</b> ladder is pulled away from a vertical wall at <b>' + dx + ' m s' + sup(-1) + '</b>, and the top slides down the wall. At what speed is the top moving when the foot is <b>' + x + ' m</b> from the wall, in m s' + sup(-1) + ' correct to 3 decimal places?',
      choices:m.choices, answer:m.answer, data:{ kind:'rate-ladder', x, y, L, dx },
      note:'With the foot x m out and the top y m up, x² + y² = ' + (L * L) + ', so 2x dx/dt + 2y dy/dt = 0. When x = ' + x + ', y = ' + y + ', and dy/dt = −(' + x + '/' + y + ') × ' + dx + ' = ' + neg(rd(-down, 3)) + '. '
        + 'The top moves at ' + rd(down, 3) + ' m s' + sup(-1) + '. Swapping x and y gives ' + rd(y / x * dx, 3) + ', the speed the top would have if the foot were ' + y + ' m out.' };
  }
  const m = mc('dV/dt = dV/dr × dr/dt', ['dV/dt = dV/dr + dr/dt', 'dV/dt = dr/dt ÷ dV/dr',
    'dV/dr = dV/dt × dr/dt', 'dr/dt = dV/dt × dV/dr']);
  return { q:'A balloon’s volume and radius both change with time. Which chain rule statement links the rates?',
    choices:m.choices, answer:m.answer, data:{ kind:'rate-chain' },
    note:'Rates multiply along the chain, and the inner variable cancels: (dV/dr)(dr/dt) leaves dV/dt.' };
}

/* ── Further applications of calculus: areas and volumes ────────────────── */
function genE1Vol(){
  const k = ri(0, 5);
  if (k === 0){                                   // y = xⁿ about the x-axis, exact
    const n = ri(1, 3), b = ri(1, 3), p = 2 * n + 1;
    const right = piStr(Math.pow(b, p), p);
    const m = mc(right, [piStr(Math.pow(b, p), p + 1), piStr(Math.pow(b, n + 1), n + 1),
      piStr(2 * Math.pow(b, p), p), piStr(Math.pow(b, p), p - 1)].filter(x => x !== right));
    return { q:'The region under <b>y = ' + (n === 1 ? 'x' : 'x' + sup(n)) + '</b> from x = 0 to x = ' + b + ' is rotated about the <b>x-axis</b>. Find the exact volume.',
      choices:m.choices, answer:m.answer, data:{ kind:'vol-x', n, b, val:Math.PI * Math.pow(b, p) / p },
      note:'V = π∫y² dx = π∫x' + sup(2 * n) + ' dx = πx' + sup(p) + '/' + p + ' from 0 to ' + b + ' = ' + right + '.' };
  }
  if (k === 1){                                   // the same, as a decimal
    const n = ri(1, 3), b = ri(1, 4), p = 2 * n + 1;
    const val = Math.PI * Math.pow(b, p) / p;
    return { q:'The region under <b>y = ' + (n === 1 ? 'x' : 'x' + sup(n)) + '</b> from x = 0 to x = ' + b + ' is rotated about the <b>x-axis</b>. Find the volume, to 3 decimal places.',
      input:true, answer:rd(val, 3), accept:qty(val, { tol:Math.max(0.002, val * 2e-4) }),
      data:{ kind:'vol-defint', fx:'Math.PI*Math.pow(x,' + (2 * n) + ')', a:0, b, val },
      note:'V = π∫₀' + sup(b) + ' x' + sup(2 * n) + ' dx = π×' + Math.pow(b, p) + '/' + p + ' = ' + rd(val, 3) + '.' };
  }
  if (k === 2){                                   // y = √(ax) about the x-axis
    const a = ri(2, 6), b = ri(1, 4);
    const val = Math.PI * a * b * b / 2;
    const right = piStr(a * b * b, 2);
    const m = mc(right, [piStr(a * b * b, 3), piStr(a * b, 2), piStr(2 * a * b * b, 3), piStr(a * b * b * b, 3)].filter(x => x !== right));
    return { q:'The region under <b>y = √(' + a + 'x)</b> from x = 0 to x = ' + b + ' is rotated about the <b>x-axis</b>. Find the exact volume.',
      choices:m.choices, answer:m.answer, data:{ kind:'vol-root', a, b, val },
      note:'y² = ' + a + 'x, so V = π∫₀' + sup(b) + ' ' + a + 'x dx = π×' + a + 'x²/2 at x = ' + b + ' = ' + right + '.' };
  }
  if (k === 3){                                   // area between a parabola and a line
    const a = ri(2, 7);
    const val = a * a * a / 6;
    return { q:'Find the <b>area</b> enclosed between <b>y = x²</b> and <b>y = ' + a + 'x</b>, to 3 decimal places.',
      input:true, answer:rd(val, 3), accept:qty(val, { tol:0.002 }),
      data:{ kind:'area-between', fx:'(' + a + '*x-x*x)', a:0, b:a, val },
      note:'They meet at x = 0 and x = ' + a + '. The area is ∫₀' + sup(a) + ' (' + a + 'x − x²) dx = ' + a + 'x²/2 − x³/3 = ' + rd(val, 3) + '.' };
  }
  if (k === 4){                                   // about the y-axis
    const c = ri(1, 3), p = 5;
    const right = piStr(Math.pow(c, p), p);
    const m = mc(right, [piStr(Math.pow(c, p), 3), piStr(Math.pow(c, 3), 3), piStr(Math.pow(c, p), 4),
      piStr(2 * Math.pow(c, p), p)].filter(x => x !== right));
    return { q:'The region between <b>x = y²</b>, the y-axis and <b>y = ' + c + '</b> is rotated about the <b>y-axis</b>. Find the exact volume.',
      choices:m.choices, answer:m.answer, data:{ kind:'vol-y', c, val:Math.PI * Math.pow(c, p) / p },
      note:'Rotating about the y-axis uses V = π∫x² dy = π∫₀' + sup(c) + ' y⁴ dy = πy⁵/5 = ' + right + '.' };
  }
  const a = ri(2, 6);                             // area between a curve and the axis
  const val = a * a * a / 3;
  return { q:'Find the <b>area</b> between <b>y = x²</b>, the x-axis and the line <b>x = ' + a + '</b>, to 3 decimal places.',
    input:true, answer:rd(val, 3), accept:qty(val, { tol:0.002 }),
    data:{ kind:'area-under', fx:'x*x', a:0, b:a, val },
    note:'∫₀' + sup(a) + ' x² dx = x³/3 = ' + rd(val, 3) + '. Rotating the same region would need π∫x⁴ dx instead.' };
}

/* ── Bernoulli distributions ────────────────────────────────────────────── */
function genE1Bern(){
  const k = ri(0, 6), num = ri(1, 9), p = num / 10;
  if (k === 0){
    return { q:'A Bernoulli random variable has <b>p = ' + p + '</b>. Find its <b>mean</b>.',
      input:true, answer:p, accept:qty(p, { tol:0.005 }), data:{ kind:'bern-mean', p },
      note:'For a single trial E(X) = p = ' + p + '. The mean of one trial is just the probability of success.' };
  }
  if (k === 1){
    const v = p * (1 - p);
    return { q:'A Bernoulli random variable has <b>p = ' + p + '</b>. Find its <b>variance</b>, to 4 decimal places.',
      input:true, answer:rd(v, 4), accept:qty(v, { tol:0.0005 }), data:{ kind:'bern-var', p },
      note:'Var(X) = p(1 − p) = ' + p + ' × ' + rd(1 - p, 2) + ' = ' + rd(v, 4) + ', which is biggest at p = 0.5.' };
  }
  if (k === 2){
    const sd = Math.sqrt(p * (1 - p));
    return { q:'A Bernoulli random variable has <b>p = ' + p + '</b>. Find its <b>standard deviation</b>, to 4 decimal places.',
      input:true, answer:rd(sd, 4), accept:qty(sd, { tol:0.0005 }), data:{ kind:'bern-sd', p },
      note:'√(p(1 − p)) = √' + rd(p * (1 - p), 4) + ' = ' + rd(sd, 4) + '.' };
  }
  if (k === 3){
    const q0 = 1 - p;
    return { q:'A Bernoulli random variable has <b>p = ' + p + '</b>. Find <b>P(X = 0)</b>.',
      input:true, answer:rd(q0, 2), accept:qty(q0, { tol:0.005 }), data:{ kind:'bern-fail', p },
      note:'There are only two outcomes, so P(X = 0) = 1 − ' + p + ' = ' + rd(q0, 2) + '.' };
  }
  if (k === 5){                                   // a variance in context, as multiple choice
    const pp = pk([ri(2, 45), ri(55, 98)]) / 100, v = pp * (1 - pp);
    const ctx = pk([
      'Each item from a production line is faulty with probability <b>' + pp + '</b>. X = 1 if an item chosen at random is faulty, and X = 0 if it is not.',
      'A basketballer makes a free throw with probability <b>' + pp + '</b>. X = 1 if the next throw goes in, and X = 0 if it misses.',
      'A seed germinates with probability <b>' + pp + '</b>. X = 1 if a particular seed germinates, and X = 0 if it does not.',
      'A proportion <b>' + pp + '</b> of voters support a proposal. X = 1 if a voter chosen at random supports it, and X = 0 otherwise.']);
    const m = numMC(v, [pp, pp * pp, Math.sqrt(v), 1 - pp], 4);
    return { q:ctx + ' What is <b>Var(X)</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'bern-var', p:pp },
      note:'X is Bernoulli with p = ' + pp + ', so Var(X) = p(1 − p) = ' + pp + ' × ' + rd(1 - pp, 2) + ' = ' + rd(v, 4) + '. The mean is p itself, and the standard deviation is √' + rd(v, 4) + '.' };
  }
  if (k === 6){                                   // p back from the variance
    const pp = pk([ri(2, 45), ri(55, 98)]) / 100, v = rd(pp * (1 - pp), 4), big = pp > 0.5;
    const m = numMC(pp, [1 - pp, v, Math.sqrt(v), 1 - v], 4);
    return { q:'A Bernoulli random variable has variance <b>' + v + '</b>, and its probability of success is ' + (big ? 'more' : 'less') + ' than ½. What is <b>p</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'bern-mean', p:pp },
      note:'p(1 − p) = ' + v + ' gives p² − p + ' + v + ' = 0, so p = ' + rd(Math.min(pp, 1 - pp), 2) + ' or p = ' + rd(Math.max(pp, 1 - pp), 2) + '. The two roots add to 1, and the condition picks p = ' + pp + '.' };
  }
  const m = mc('One attempt at a free throw, counting it as in or out.',
    ['The number of free throws made out of twenty.', 'The time taken to make ten free throws.',
     'The number of attempts needed before the first one goes in.', 'The average score over a season.']);
  return { q:'Which of these is a <b>Bernoulli</b> random variable?',
    choices:m.choices, answer:m.answer, data:{ kind:'bern-which' },
    note:'A Bernoulli variable is one trial with two outcomes. Counting successes over many trials is binomial instead.' };
}

/* ── The binomial distribution ──────────────────────────────────────────── */
function genE1Binom(){
  const k = ri(0, 7), n = ri(5, 20), num = ri(1, 9), p = num / 10, q0 = 1 - p;
  if (k === 0){
    const x = ri(1, Math.min(n - 1, 6));
    const pr = nCr(n, x) * Math.pow(p, x) * Math.pow(q0, n - x);
    return { q:'X is binomial with <b>n = ' + n + '</b> and <b>p = ' + p + '</b>. Find <b>P(X = ' + x + ')</b>, to 4 decimal places.',
      input:true, answer:rd(pr, 4), accept:qty(pr, { tol:0.0005 }), data:{ kind:'binom-pmf', n, p, x },
      note:'P(X = x) = C(n, x) p^x (1 − p)^(n−x), so here C(' + n + ', ' + x + ') × ' + p + sup(x) + ' × ' + rd(q0, 2) + sup(n - x) + ' = ' + rd(pr, 4) + '.' };
  }
  if (k === 1){
    const mu = n * p;
    return { q:'X is binomial with <b>n = ' + n + '</b> and <b>p = ' + p + '</b>. Find its <b>mean</b>.',
      input:true, answer:rd(mu, 2), accept:qty(mu, { tol:0.005 }), data:{ kind:'binom-mean', n, p },
      note:'E(X) = np = ' + n + ' × ' + p + ' = ' + rd(mu, 2) + '.' };
  }
  if (k === 2){
    const sd = Math.sqrt(n * p * q0);
    return { q:'X is binomial with <b>n = ' + n + '</b> and <b>p = ' + p + '</b>. Find its <b>standard deviation</b>, to 4 decimal places.',
      input:true, answer:rd(sd, 4), accept:qty(sd, { tol:0.0005 }), data:{ kind:'binom-sd', n, p },
      note:'Var(X) = np(1 − p) = ' + rd(n * p * q0, 4) + ', and the standard deviation is its square root, ' + rd(sd, 4) + '.' };
  }
  if (k === 3){
    const pr = 1 - Math.pow(q0, n);
    return { q:'X is binomial with <b>n = ' + n + '</b> and <b>p = ' + p + '</b>. Find <b>P(X ≥ 1)</b>, to 4 decimal places.',
      input:true, answer:rd(pr, 4), accept:qty(pr, { tol:0.0005 }), data:{ kind:'binom-atleast1', n, p },
      note:'Go by the complement: P(X ≥ 1) = 1 − P(X = 0) = 1 − ' + rd(q0, 2) + sup(n) + ' = ' + rd(pr, 4) + '.' };
  }
  if (k === 4){
    const pr = Math.pow(q0, n) + n * p * Math.pow(q0, n - 1);
    return { q:'X is binomial with <b>n = ' + n + '</b> and <b>p = ' + p + '</b>. Find <b>P(X ≤ 1)</b>, to 4 decimal places.',
      input:true, answer:rd(pr, 4), accept:qty(pr, { tol:0.0005 }), data:{ kind:'binom-atmost1', n, p },
      note:'P(X = 0) + P(X = 1) = ' + rd(q0, 2) + sup(n) + ' + ' + n + '×' + p + '×' + rd(q0, 2) + sup(n - 1) + ' = ' + rd(pr, 4) + '.' };
  }
  if (k === 6){                                   // an exact count in context, as multiple choice
    const nn = ri(5, 12), x = Math.max(1, Math.min(nn - 1, Math.round(nn * p) + ri(-1, 1)));
    const P = j => nCr(nn, j) * Math.pow(p, j) * Math.pow(q0, nn - j);
    const pr = P(x);
    const ctx = pk([
      'Each seed in a packet germinates with probability <b>' + p + '</b>, independently of the others. If <b>' + nn + '</b> seeds are planted, what is the probability that exactly <b>' + x + '</b> germinate?',
      'A basketballer makes each free throw with probability <b>' + p + '</b>, independently. In <b>' + nn + '</b> throws, what is the probability of making exactly <b>' + x + '</b>?',
      'Each bulb from a factory is faulty with probability <b>' + p + '</b>, independently. In a box of <b>' + nn + '</b> bulbs, what is the probability that exactly <b>' + x + '</b> are faulty?',
      'A tennis player wins each point on serve with probability <b>' + p + '</b>, independently. Over <b>' + nn + '</b> service points, what is the probability of winning exactly <b>' + x + '</b>?']);
    const m = numMC(pr, [nCr(nn, x) * Math.pow(p, x), Math.pow(p, x) * Math.pow(q0, nn - x), nCr(nn, x) * Math.pow(q0, x) * Math.pow(p, nn - x),
                         P(x + 1), P(x - 1), 1 - pr].filter(w => w <= 1), 4);
    return { q:ctx + ' Give 4 decimal places.',
      choices:m.choices, answer:m.answer, data:{ kind:'binom-pmf', n:nn, p, x },
      note:'X ~ Bin(' + nn + ', ' + p + '), so P(X = ' + x + ') = C(' + nn + ', ' + x + ') × ' + p + sup(x) + ' × ' + rd(q0, 2) + sup(nn - x) + ' = ' + rd(pr, 4) + '. Leaving out C(' + nn + ', ' + x + ') counts only one order of the successes.' };
  }
  if (k === 7){                                   // at least one, in context, as multiple choice
    const pl = pk([0.05, 0.1, 0.15, 0.2, 0.25, 0.3]), ql = rd(1 - pl, 2), nl = ri(3, 12);   // small p, so the answer is not just 1
    const pr = 1 - Math.pow(ql, nl);
    const ctx = pk([
      'Each scratch card wins a prize with probability <b>' + pl + '</b>, independently. If <b>' + nl + '</b> cards are bought, what is the probability of at least one prize?',
      'Each item made by a machine is defective with probability <b>' + pl + '</b>, independently. In a sample of <b>' + nl + '</b> items, what is the probability that at least one is defective?',
      'An archer hits the target with probability <b>' + pl + '</b> on each shot, independently. In <b>' + nl + '</b> shots, what is the probability of at least one hit?']);
    const m = numMC(pr, [Math.pow(ql, nl), 1 - Math.pow(pl, nl), nl * pl * Math.pow(ql, nl - 1), 1 - Math.pow(ql, nl - 1), Math.pow(pl, nl)], 4);
    return { q:ctx + ' Give 4 decimal places.',
      choices:m.choices, answer:m.answer, data:{ kind:'binom-atleast1', n:nl, p:pl },
      note:'Go by the complement: P(X ≥ 1) = 1 − P(X = 0) = 1 − ' + ql + sup(nl) + ' = ' + rd(pr, 4) + '. ' + ql + sup(nl) + ' on its own is the chance of none at all.' };
  }
  const m = mc('A fixed number of independent trials, each with the same two outcomes and the same probability.',
    ['Trials that continue until the first success.',
     'Trials whose probability of success changes as they go.',
     'A sample drawn without replacement from a small group.',
     'Any experiment with a numerical outcome.']);
  return { q:'What has to be true for a count to be <b>binomial</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'binom-cond' },
    note:'Fixed n, independent trials, two outcomes, constant p. Sampling without replacement from a small group breaks the last two.' };
}

/* ── The sampling distribution of the mean ──────────────────────────────── */
function genE1SampMean(){
  const k = ri(0, 6), mu = ri(20, 120), sd = ri(2, 20), n = pk([4, 9, 16, 25, 36, 49, 64, 100]);
  const se = sd / Math.sqrt(n);
  if (k === 0){
    return { q:'A population has mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>. Samples of size <b>' + n + '</b> are taken. What is the <b>standard deviation of the sample mean</b>, to 4 decimal places?',
      input:true, answer:rd(se, 4), accept:qty(se, { tol:0.0005 }), data:{ kind:'samp-se', sd, n },
      note:'σ/√n = ' + sd + '/' + Math.sqrt(n) + ' = ' + rd(se, 4) + '. Four times the sample size halves it.' };
  }
  if (k === 1){
    return { q:'A population has mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>. Samples of size <b>' + n + '</b> are taken. What is the <b>mean of the sample mean</b>?',
      input:true, answer:mu, accept:qty(mu, { tol:0.05 }), data:{ kind:'samp-mean', mu, n },
      note:'The sample mean is unbiased: its own mean is the population mean, ' + mu + ', whatever the sample size.' };
  }
  if (k === 2){
    const xb = rd(mu + pk([-2, -1.5, -1, 1, 1.5, 2]) * se, 4);
    const z = (xb - mu) / se;
    return { q:'A population has mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>. For a sample of <b>' + n + '</b>, find the <b>z-score of a sample mean of ' + xb + '</b>, to 3 decimal places.',
      input:true, answer:rd(z, 3), accept:qty(z, { tol:0.01 }), data:{ kind:'samp-z', mu, sd, n, xb },
      note:'z = (x̄ − μ)/(σ/√n) = (' + xb + ' − ' + mu + ')/' + rd(se, 4) + ' = ' + neg(rd(z, 3)) + '. The denominator is the standard error, not σ.' };
  }
  if (k === 3){
    const target = pk([0.5, 1, 2]);
    const need = Math.ceil(Math.pow(sd / target, 2));
    return { q:'A population has standard deviation <b>' + sd + '</b>. How large must a sample be for the <b>standard deviation of the sample mean</b> to be at most <b>' + target + '</b>?',
      input:true, answer:need, accept:qty(need, { tol:0.4 }), data:{ kind:'samp-size', sd, target },
      note:'σ/√n ≤ ' + target + ' means √n ≥ ' + sd + '/' + target + ', so n ≥ ' + rd(Math.pow(sd / target, 2), 2) + ' and the smallest whole sample is ' + need + '.' };
  }
  if (k === 5){                                   // the standard error in context, as multiple choice
    const what = pk(['times taken to finish a puzzle, in seconds,', 'lengths of a species of fish, in millimetres,',
                     'scores on a test marked out of 150', 'masses of eggs from a farm, in grams,']);
    const m = numMC(se, [sd / n, sd, sd * Math.sqrt(n), sd * sd / n], 4);
    return { q:'The ' + what + ' have mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>. Random samples of size <b>' + n + '</b> are taken. What is the standard deviation of the distribution of sample means?',
      choices:m.choices, answer:m.answer, data:{ kind:'samp-se', sd, n },
      note:'The sample mean has standard deviation σ/√n = ' + sd + '/√' + n + ' = ' + sd + '/' + Math.sqrt(n) + ' = ' + rd(se, 4) + '. Dividing by n instead of √n shrinks it far too much.' };
  }
  if (k === 6){                                   // a z-score for a sample mean, as multiple choice
    const xb = rd(mu + pk([-2, -1.5, -1, 1, 1.5, 2]) * se, 4);
    const z = (xb - mu) / se;
    const m = numMC(z, [(xb - mu) / sd, (xb - mu) / (sd / n), -z], 3);
    return { q:'A population has mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>. A random sample of <b>' + n + '</b> has mean <b>' + xb + '</b>. What is the z-score of this sample mean?',
      choices:m.choices, answer:m.answer, data:{ kind:'samp-z', mu, sd, n, xb },
      note:'Standardise with the standard error, not σ: z = (x̄ − μ)/(σ/√n) = (' + xb + ' − ' + mu + ')/' + rd(se, 4) + ' = ' + neg(rd(z, 3)) + '. Using σ gives ' + neg(rd((xb - mu) / sd, 3)) + ', which treats the sample mean as if it were one observation.' };
  }
  const m = mc('It clusters more tightly around μ, and its shape gets closer to normal.',
    ['It clusters more tightly around μ, and its spread stays the same.',
     'It spreads out further, and its shape gets closer to normal.',
     'It keeps the population’s shape exactly, whatever n is.',
     'Its mean moves closer to zero.']);
  return { q:'As the sample size <b>n</b> grows, what happens to the distribution of the <b>sample mean</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'samp-clt' },
    note:'The spread is σ/√n, which shrinks as n grows, and the central limit theorem pulls the shape towards normal even when the population is not.' };
}

/* ── Year 11 content, as the HSC examines it: polynomials ───────────────── */
function genE1Poly(){
  const k = ri(0, 5);
  if (k === 0){                                   // the remainder theorem
    const b = nzr(-5, 5), c = nzr(-8, 8), d = nzr(-9, 9), a = nzr(-3, 3);
    const P = x => x * x * x + b * x * x + c * x + d;
    const val = P(a);
    return { q:'Find the <b>remainder</b> when <b>' + polyStr([{ c:1, p:3 }, { c:b, p:2 }, { c, p:1 }, { c:d, p:0 }]) + '</b> is divided by <b>(x ' + signed(-a) + ')</b>.',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'poly-rem', b, c, d, a },
      note:'The remainder theorem says it is P(' + neg(a) + ') = ' + neg(val) + ' — no division needed.' };
  }
  if (k === 1){                                   // the factor theorem, solved for a coefficient
    const a = nzr(-3, 3), b = nzr(-5, 5), c = nzr(-6, 6);
    const kk = -(a * a * a + b * a * a + c * a);
    return { q:'<b>(x ' + signed(-a) + ')</b> is a factor of <b>' + polyStr([{ c:1, p:3 }, { c:b, p:2 }, { c, p:1 }]) + ' + k</b>. Find <b>k</b>.',
      input:true, answer:kk, accept:qty(kk, { tol:0.4 }), data:{ kind:'poly-factor', a, b, c },
      note:'A factor means P(' + neg(a) + ') = 0, so (' + neg(a * a * a) + ') + (' + neg(b * a * a) + ') + (' + neg(c * a) + ') + k = 0 and k = ' + neg(kk) + '.' };
  }
  if (k === 2){                                   // roots of a cubic
    const A = ri(1, 4), B = nzr(-9, 9), C = nzr(-9, 9), D = nzr(-9, 9);
    const want = pk(['sum', 'pairs', 'product']);
    const val = want === 'sum' ? -B / A : want === 'pairs' ? C / A : -D / A;
    const label = want === 'sum' ? 'α + β + γ' : want === 'pairs' ? 'αβ + αγ + βγ' : 'αβγ';
    return { q:'The cubic <b>' + polyStr([{ c:A, p:3 }, { c:B, p:2 }, { c:C, p:1 }, { c:D, p:0 }]) + ' = 0</b> has roots α, β and γ. Find <b>' + label + '</b>, to 4 decimal places if it is not a whole number.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }), data:{ kind:'poly-roots', A, B, C, D, want },
      note:'For ax³ + bx² + cx + d the roots sum to −b/a, add in pairs to c/a and multiply to −d/a. Here ' + label + ' = ' + neg(rd(val, 4)) + '.' };
  }
  if (k === 3){                                   // a symmetric function of the roots
    const A = ri(1, 3), B = nzr(-9, 9), C = nzr(-9, 9);
    const sum = -B / A, prod = C / A, val = sum * sum - 2 * prod;
    return { q:'α and β are the roots of <b>' + polyStr([{ c:A, p:2 }, { c:B, p:1 }, { c:C, p:0 }]) + ' = 0</b>. Find <b>α² + β²</b>, to 4 decimal places if it is not a whole number.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }), data:{ kind:'poly-sym', A, B, C },
      note:'α² + β² = (α + β)² − 2αβ = (' + neg(rd(sum, 4)) + ')² − 2(' + neg(rd(prod, 4)) + ') = ' + neg(rd(val, 4)) + '. The roots themselves are never needed.' };
  }
  if (k === 4){                                   // degrees
    const m = ri(3, 7), n = ri(2, 5), which = pk(['product', 'composite']);
    const val = which === 'product' ? m + n : m * n;
    return { q:'P(x) has degree <b>' + m + '</b> and Q(x) has degree <b>' + n + '</b>. What is the degree of <b>' + (which === 'product' ? 'P(x)Q(x)' : 'P(Q(x))') + '</b>?',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'poly-degree', m, n, which },
      note:which === 'product' ? 'Multiplying adds the degrees: ' + m + ' + ' + n + ' = ' + val + '.'
                               : 'Substituting multiplies them: the leading term becomes (xⁿ)' + sup(m) + ', so the degree is ' + m + ' × ' + n + ' = ' + val + '.' };
  }
  const a = nzr(-4, 4);
  const m = mc('It touches the x-axis at x = ' + a + ' and turns back.',
    ['It crosses the x-axis at x = ' + a + '.', 'It has a vertical asymptote at x = ' + a + '.',
     'It has a point of inflection on the x-axis at x = ' + a + '.', 'It never reaches the x-axis.']);
  return { q:'A polynomial has <b>(x ' + signed(-a) + ')²</b> as a factor and no other factor vanishing at x = ' + a + '. What does its graph do there?',
    choices:m.choices, answer:m.answer, data:{ kind:'poly-double', a },
    note:'An even multiplicity keeps the sign of the polynomial the same either side, so the curve touches and turns. An odd one would cut through.' };
}

/* ── Year 11 content: inverse and parametric functions ──────────────────── */
function genE1Funcs(){
  const k = ri(0, 5);
  if (k === 0){                                   // the inverse of a linear function
    const a = nzr(2, 5), b = nzr(-9, 9);
    const right = 'f' + sup(-1) + '(x) = (x ' + signed(-b) + ')/' + a;
    const m = mc(right, ['f' + sup(-1) + '(x) = (x ' + signed(b) + ')/' + a, 'f' + sup(-1) + '(x) = ' + a + 'x ' + signed(-b),
      'f' + sup(-1) + '(x) = 1/(' + xTerm(a) + ' ' + signed(b) + ')', 'f' + sup(-1) + '(x) = (' + a + ' − x)/' + b]);
    return { q:'Find the inverse of <b>f(x) = ' + xTerm(a) + ' ' + signed(b) + '</b>.',
      choices:m.choices, answer:m.answer, data:{ kind:'fn-inverse', a, b },
      note:'Swap x and y, then solve: x = ' + a + 'y ' + signed(b) + ' gives y = (x ' + signed(-b) + ')/' + a + '.' };
  }
  if (k === 1){                                   // domain and range swap over
    const m = mc('The domain of f' + sup(-1) + ' is the range of f.',
      ['The domain of f' + sup(-1) + ' is the domain of f.', 'The range of f' + sup(-1) + ' is the range of f.',
       'Both have the same domain and range.', 'f' + sup(-1) + ' has no domain restriction.']);
    return { q:'A function f has an inverse. Which statement is <b>always</b> true?',
      choices:m.choices, answer:m.answer, data:{ kind:'fn-domain' },
      note:'Reflecting in y = x swaps the axes, so it swaps domain and range.' };
  }
  if (k === 2){                                   // the parametric parabola
    const a = ri(1, 4);
    const right = 'y² = ' + (4 * a) + 'x';
    const m = mc(right, ['y² = ' + (2 * a) + 'x', 'y = ' + (4 * a) + 'x²', 'x² = ' + (4 * a) + 'y', 'y² = ' + (4 * a) + 'x²']);
    return { q:'A curve is given parametrically by <b>x = ' + a + 't²</b>, <b>y = ' + (2 * a) + 't</b>. What is its <b>Cartesian equation</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'fn-param-parab', a },
      note:'From y = ' + (2 * a) + 't, t = y/' + (2 * a) + '. Substituting: x = ' + a + 'y²/' + (4 * a * a) + ', i.e. y² = ' + (4 * a) + 'x.' };
  }
  if (k === 3){                                   // eliminating the parameter
    const b = nzr(-5, 5);
    const right = 'y = (x ' + signed(-b) + ')²';
    const m = mc(right, ['y = (x ' + signed(b) + ')²', 'y = x² ' + signed(b), 'y² = x ' + signed(-b), 'y = √(x ' + signed(-b) + ')']);
    return { q:'A curve is given parametrically by <b>x = t ' + signed(b) + '</b>, <b>y = t²</b>. What is its <b>Cartesian equation</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'fn-param-shift', b },
      note:'t = x ' + signed(-b) + ', and y = t², so y = (x ' + signed(-b) + ')².' };
  }
  if (k === 4){                                   // a point on a parametric curve
    const a = ri(2, 5), t = ri(2, 6), x = a * t;
    const y = t * t;
    return { q:'A curve has <b>x = ' + a + 't</b> and <b>y = t²</b>. Find <b>y</b> when <b>x = ' + x + '</b>.',
      input:true, answer:y, accept:qty(y, { tol:0.4 }), data:{ kind:'fn-param-point', a, x },
      note:'x = ' + x + ' gives t = ' + t + ', so y = ' + t + '² = ' + y + '.' };
  }
  const a = ri(2, 7);
  const right = 'x² + y² = ' + (a * a);
  const m = mc(right, ['x² + y² = ' + a, 'x²/' + (a * a) + ' + y²/' + (a * a) + ' = ' + a, 'x² − y² = ' + (a * a), 'x + y = ' + a]);
  return { q:'A curve is given by <b>x = ' + a + ' cos θ</b>, <b>y = ' + a + ' sin θ</b>. What is its <b>Cartesian equation</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'fn-param-circle', a },
    note:'Square and add, then use cos²θ + sin²θ = 1: x² + y² = ' + (a * a) + ', a circle of radius ' + a + '.' };
}

/* ── Year 11 content: further trigonometry ──────────────────────────────── */
const E1_TRIGCOUNT = [
  { eq:'sin 2x = sin x', n:5, why:'sin 2x − sin x = sin x(2cos x − 1), so sin x = 0 at x = 0, π, 2π and cos x = ½ at x = π/3, 5π/3.' },
  { eq:'cos 2x = cos x', n:4, why:'2cos²x − cos x − 1 = 0 factorises to (2cos x + 1)(cos x − 1), giving cos x = −½ at x = 2π/3, 4π/3 and cos x = 1 at x = 0, 2π.' },
  { eq:'sin 2x = cos x', n:4, why:'2 sin x cos x − cos x = cos x(2 sin x − 1), so cos x = 0 at x = π/2, 3π/2 and sin x = ½ at x = π/6, 5π/6.' },
  { eq:'tan x = sin x', n:3, why:'sin x(1/cos x − 1) = 0, so sin x = 0 at x = 0, π, 2π; cos x = 1 adds nothing new.' }
];

function genE1FurtherTrig(){
  const k = ri(0, 5);
  if (k === 0){                                   // double angle from a triangle
    const t = pk(E1_TRIP2), opp = t[0], adj = t[1], hyp = t[2];
    const want = pk(['sin', 'cos']);
    const val = want === 'sin' ? 2 * (opp / hyp) * (adj / hyp) : 1 - 2 * (opp / hyp) * (opp / hyp);
    return { q:'θ is <b>acute</b> and <b>sin θ = ' + opp + '/' + hyp + '</b>. Find <b>' + want + ' 2θ</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }), data:{ kind:'trig-double', opp, adj, hyp, want },
      note:want === 'sin' ? 'cos θ = ' + adj + '/' + hyp + ' because θ is acute, so sin 2θ = 2 sin θ cos θ = ' + neg(rd(val, 4)) + '.'
                          : 'cos 2θ = 1 − 2sin²θ = 1 − 2(' + opp + '/' + hyp + ')² = ' + neg(rd(val, 4)) + ', so no need for cos θ at all.' };
  }
  if (k === 1){                                   // the auxiliary angle: R
    const a = ri(1, 9), b = ri(1, 9);
    const R = Math.sqrt(a * a + b * b);
    return { q:'<b>' + xTerm(a, ' sin x') + ' + ' + b + ' cos x</b> is written as <b>R sin(x + α)</b>. Find <b>R</b>, to 4 decimal places.',
      input:true, answer:rd(R, 4), accept:qty(R, { tol:0.0005 }), data:{ kind:'trig-aux-r', a, b },
      note:'Expanding gives R cos α = ' + a + ' and R sin α = ' + b + '. Squaring and adding, R = √(' + (a * a) + ' + ' + (b * b) + ') = ' + rd(R, 4) + '.' };
  }
  if (k === 2){                                   // the auxiliary angle: α
    const a = ri(1, 9), b = ri(1, 9);
    const al = Math.atan2(b, a) * 180 / Math.PI;
    return { q:'<b>' + xTerm(a, ' sin x') + ' + ' + b + ' cos x</b> is written as <b>R sin(x + α)</b> with α acute. Find <b>α</b> in degrees, to 2 decimal places.',
      input:true, answer:rd(al, 2), accept:qty(al, { tol:0.02 }), data:{ kind:'trig-aux-a', a, b },
      note:'tan α = ' + b + '/' + a + ', so α = tan' + sup(-1) + '(' + b + '/' + a + ') = ' + rd(al, 2) + '°.' };
  }
  if (k === 3){                                   // an exact value from a compound angle
    const e = pk([
      { q:'sin 75°', a:'(√6 + √2)/4', w:['(√6 − √2)/4', '(√3 + 1)/4', '(√2 + 1)/2', '√3/2'], why:'sin 75° = sin(45° + 30°) = sin45cos30 + cos45sin30 = (√6 + √2)/4.' },
      { q:'cos 15°', a:'(√6 + √2)/4', w:['(√6 − √2)/4', '(√3 + 1)/4', '(√2 − 1)/2', '√2/2'], why:'cos 15° = cos(45° − 30°) = cos45cos30 + sin45sin30 = (√6 + √2)/4 — the same number as sin 75°, since the angles are complementary.' },
      { q:'sin 15°', a:'(√6 − √2)/4', w:['(√6 + √2)/4', '(√3 − 1)/4', '(√2 − 1)/2', '1/4'], why:'sin 15° = sin(45° − 30°) = sin45cos30 − cos45sin30 = (√6 − √2)/4.' },
      { q:'tan 75°', a:'2 + √3', w:['2 − √3', '√3 + 1', '(√3 + 1)/2', '√3'], why:'tan 75° = tan(45° + 30°) = (1 + 1/√3)/(1 − 1/√3) = 2 + √3.' }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Find the exact value of <b>' + e.q + '</b>.',
      choices:m.choices, answer:m.answer, data:{ kind:'trig-exact', ask:e.q },
      note:e.why };
  }
  if (k === 4){                                   // counting solutions in a domain
    const e = pk(E1_TRIGCOUNT);
    return { q:'How many solutions does <b>' + e.eq + '</b> have for <b>0 ≤ x ≤ 2π</b>?',
      input:true, answer:e.n, accept:qty(e.n, { tol:0.4 }), data:{ kind:'trig-count', eq:e.eq, n:e.n },
      note:e.why + ' Both endpoints count, which is easy to miss.' };
  }
  const which = pk(['cos', 'sin', 'tan']);
  const right = which === 'cos' ? 'cos 2θ = 1 − 2sin²θ' : which === 'sin' ? 'sin 2θ = 2 sin θ cos θ' : 'tan 2θ = 2 tan θ/(1 − tan²θ)';
  const m = mc(right, ['cos 2θ = 1 + 2sin²θ', 'sin 2θ = sin θ cos θ', 'tan 2θ = 2 tan θ/(1 + tan²θ)',
    'cos 2θ = cos²θ + sin²θ', 'sin 2θ = 2 sin θ'].filter(x => x !== right));
  return { q:'Which <b>double-angle</b> identity is correct?',
    choices:m.choices, answer:m.answer, data:{ kind:'trig-identity', which },
    note:right + '. Checking at θ = 0 or θ = π/4 kills off the wrong versions quickly.' };
}

/* ── Year 11 content: the binomial theorem ──────────────────────────────── */
function genE1BinomThm(){
  const k = ri(0, 5);
  if (k === 0){                                   // a particular coefficient
    const n = ri(5, 10), b = ri(2, 4), r = ri(1, 4), a = 1;
    const co = nCr(n, r) * Math.pow(a, n - r) * Math.pow(b, r);
    return { q:'Find the <b>coefficient of x' + sup(r) + '</b> in the expansion of <b>(1 + ' + xTerm(b) + ')' + sup(n) + '</b>.',
      input:true, answer:co, accept:qty(co, { tol:0.4 }), data:{ kind:'bt-coeff', n, b, r },
      note:'The term is C(' + n + ', ' + r + ')(' + b + 'x)' + sup(r) + ' = ' + nCr(n, r) + ' × ' + Math.pow(b, r) + 'x' + sup(r) + ', so the coefficient is ' + co + '.' };
  }
  if (k === 1){                                   // how many terms
    const n = ri(6, 20);
    return { q:'How many <b>terms</b> are there in the expansion of <b>(a + b)' + sup(n) + '</b>?',
      input:true, answer:n + 1, accept:qty(n + 1, { tol:0.4 }), data:{ kind:'bt-terms', n },
      note:'The power of b runs from 0 to ' + n + ', so there are ' + (n + 1) + ' terms — one more than the index.' };
  }
  if (k === 2){                                   // the sum of the coefficients
    const n = ri(4, 9), b = ri(2, 3);
    const val = Math.pow(1 + b, n);
    return { q:'What is the <b>sum of all the coefficients</b> in the expansion of <b>(1 + ' + xTerm(b) + ')' + sup(n) + '</b>?',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'bt-sum', n, b },
      note:'Put x = 1: every coefficient is then counted once, so the sum is (1 + ' + b + ')' + sup(n) + ' = ' + val + '.' };
  }
  if (k === 3){                                   // the term free of x
    const half = ri(2, 5), n = 2 * half, a = ri(2, 3);
    const val = nCr(n, half) * Math.pow(a, half);
    return { q:'Find the term <b>independent of x</b> in the expansion of <b>(x + ' + a + '/x)' + sup(n) + '</b>.',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'bt-constant', n, a, half },
      note:'The general term is C(' + n + ', r)x' + sup(n) + sup(-1) + 'ʳ(' + a + '/x)ʳ, whose power of x is ' + n + ' − 2r. That is zero at r = ' + half + ', giving C(' + n + ', ' + half + ') × ' + a + sup(half) + ' = ' + val + '.' };
  }
  if (k === 4){                                   // a combination on its own
    const n = ri(6, 12), r = ri(2, 4);
    const val = nCr(n, r);
    return { q:'Evaluate <b>' + sup(n) + 'C' + sub(r) + '</b> — the number of ways of choosing ' + r + ' things from ' + n + '.',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'bt-ncr', n, r },
      note:n + '!/(' + r + '!' + (n - r) + '!) = ' + val + '. It is also the coefficient of x' + sup(r) + ' in (1 + x)' + sup(n) + '.' };
  }
  const half = ri(2, 6), n = 2 * half;
  const m = mc('the ' + (half + 1) + 'th term', ['the ' + half + 'th term', 'the ' + (n / 2) + 'th term',
    'the ' + (n + 1) + 'th term', 'there is no single middle term']);
  return { q:'In the expansion of <b>(1 + x)' + sup(n) + '</b>, which is the <b>middle</b> term?',
    choices:m.choices, answer:m.answer, data:{ kind:'bt-middle', n },
    note:'There are ' + (n + 1) + ' terms, so the middle one is number ' + (n / 2 + 1) + ' — the one with x' + sup(half) + '.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
const MODULES_ME1 = [
    { id:'e1-ind', name:'Proof by induction', topics:[
      { id:'e112-indsum', name:'Sums', gen:genE1IndSum },
      { id:'e112-inddiv', name:'Divisibility', gen:genE1IndDiv }]},
    { id:'e1-vec', name:'Vectors', topics:[
      { id:'e112-vec', name:'2D and 3D vectors', gen:genE1VecBasic },
      { id:'e112-vecops', name:'Operating with vectors', gen:genE1VecOps },
      { id:'e112-proj', name:'Projectile motion', gen:genE1Proj }]},
    { id:'e1-inv', name:'Inverse trig functions', topics:[
      { id:'e112-inv', name:'Values, domain and range', gen:genE1InvTrig }]},
    { id:'e1-calc', name:'Further calculus skills', topics:[
      { id:'e112-sub', name:'Integration by substitution', gen:genE1IntSub },
      { id:'e112-invcalc', name:'Inverse trig calculus', gen:genE1InvCalc },
      { id:'e112-trigint', name:'Double angles in integrals', gen:genE1TrigInt }]},
    { id:'e1-apps', name:'Further applications', topics:[
      { id:'e112-de', name:'Differential equations', gen:genE1DiffEq },
      { id:'e112-rates', name:'Related rates', gen:genE1Rates },
      { id:'e112-vol', name:'Areas & volumes', gen:genE1Vol }]},
    { id:'e1-stats', name:'Binomial & sampling', topics:[
      { id:'e112-bern', name:'Bernoulli', gen:genE1Bern },
      { id:'e112-binom', name:'Binomial', gen:genE1Binom },
      { id:'e112-samp', name:'Sampling distribution of the mean', gen:genE1SampMean }]},
    { id:'e1-y11', name:'Year 11 in the HSC', topics:[
      { id:'e112-poly', name:'Polynomials', gen:genE1Poly },
      { id:'e112-fn', name:'Inverse & parametric functions', gen:genE1Funcs },
      { id:'e112-trig', name:'Further trigonometry', gen:genE1FurtherTrig },
      { id:'e112-bt', name:'Binomial theorem', gen:genE1BinomThm }]}
];
BUILD.maths12e1 = host => revGame(host, { title:'Maths Extension 1 (Year 12)',
  how:'Pick a focus area, or do the lot. The Year 11 module is the Extension 1 material the HSC still examines.',
  statKey:'maths12e1', modules:MODULES_ME1 });

GAMES.push({ id:'maths12e1', cat:'Revision', year:12, ico:'∑', name:'Maths Extension 1',
  blurb:'Induction, vectors, inverse trig, harder calculus, binomial' });

/* ══ MATHEMATICS EXTENSION 2 — YEAR 12 ════════════════════════════════════
   Mathematics Extension 2 11–12 Syllabus (2024), first examined in 2027.
   The HSC paper is 100 marks in 3 hours (plus 10 minutes reading): Section I
   is ten objective-response marks, Section II is 90 marks.
   Five focus areas: the nature of proof, further work with vectors, complex
   numbers, further integration, and calculus applied to mechanics.
   ═════════════════════════════════════════════════════════════════════════ */

/* ── The nature of proof: language and notation ─────────────────────────── */
const E2_IMPLY = [
  { p:'n is divisible by 6', q:'n is divisible by 3', conv:false, why:'every multiple of 6 is a multiple of 3, but 9 is a multiple of 3 and not of 6' },
  { p:'n is even', q:'n² is even', conv:true, why:'both directions hold, so this one is “if and only if”' },
  { p:'a shape is a square', q:'a shape is a rectangle', conv:false, why:'a 2 × 5 rectangle is not a square' },
  { p:'x > 3', q:'x > 1', conv:false, why:'x = 2 is bigger than 1 but not bigger than 3' },
  { p:'x = 2', q:'x² = 4', conv:false, why:'x = −2 also squares to 4' },
  { p:'a number is a multiple of 10', q:'its last digit is 0', conv:true, why:'each statement forces the other' }
];

function genE2Lang(){
  const k = ri(0, 4);
  if (k === 0){                                   // the contrapositive
    const e = pk(E2_IMPLY);
    const right = 'If ' + e.q + ' is false, then ' + e.p + ' is false.';
    const m = mc(right, ['If ' + e.p + ' is false, then ' + e.q + ' is false.',
      'If ' + e.q + ', then ' + e.p + '.', 'If ' + e.p + ', then ' + e.q + '.',
      'Either ' + e.p + ' or ' + e.q + '.']);
    return { q:'What is the <b>contrapositive</b> of “if ' + e.p + ', then ' + e.q + '”?',
      choices:m.choices, answer:m.answer, data:{ kind:'proof-contra' },
      note:'The contrapositive of P ⇒ Q is (not Q) ⇒ (not P). It is always equivalent to the original, which is why proving it counts as a proof.' };
  }
  if (k === 1){                                   // is the converse true?
    const e = pk(E2_IMPLY);
    const right = e.conv ? 'Yes — the converse is also true, so it is “if and only if”.' : 'No — the converse is false.';
    const m = mc(right, [e.conv ? 'No — the converse is false.' : 'Yes — the converse is also true, so it is “if and only if”.',
      'The converse is the same statement written backwards, so it is automatically true.',
      'A converse can never be decided without a counterexample.']);
    return { q:'“If ' + e.p + ', then ' + e.q + '” is true. Is its <b>converse</b> true?',
      choices:m.choices, answer:m.answer, data:{ kind:'proof-converse', conv:e.conv },
      note:'The converse is Q ⇒ P, a different claim: here ' + e.why + '.' };
  }
  if (k === 2){                                   // negating a quantifier
    const e = pk([
      { s:'every prime number is odd', n:'there is a prime number that is not odd', t:false, eg:'2 is prime and even',
        w:['every prime number is even', 'there is a prime number that is odd', 'no number is both prime and odd'] },
      { s:'for all real x, x² ≥ 0', n:'there is a real x with x² < 0', t:true, eg:'a square is never negative',
        w:['for all real x, x² < 0', 'there is a real x with x² ≥ 0', 'for all real x, x² ≤ 0'] },
      { s:'there is an integer n with n² = 2', n:'for every integer n, n² ≠ 2', t:false, eg:'no integer squares to 2',
        w:['there is an integer n with n² ≠ 2', 'for every integer n, n² = 2', 'for some integer n, n² ≠ 2'] },
      { s:'every integer greater than 2 is composite', n:'there is an integer greater than 2 that is not composite', t:false, eg:'3 is prime',
        w:['every integer greater than 2 is prime', 'there is an integer greater than 2 that is composite', 'no integer greater than 2 is composite'] }
    ]);
    const m = mc(e.n, e.w);
    return { q:'What is the <b>negation</b> of “' + e.s + '”?',
      choices:m.choices, answer:m.answer, data:{ kind:'proof-negate' },
      note:'Negating swaps the quantifier: “for all” becomes “there exists”, and the property inside is negated. (As it happens the original is ' + (e.t ? 'true' : 'false, since ' + e.eg) + '.)' };
  }
  if (k === 3){                                   // a counterexample
    const e = pk([
      { claim:'every prime number is odd', ce:2 },
      { claim:'n² + n + 11 is prime for every positive integer n', ce:10 },
      { claim:'2ⁿ > n³ for every positive integer n', ce:2 },
      { claim:'every number of the form 4k + 1, with k ≥ 1, is prime', ce:9 }
    ]);
    return { q:'Give the <b>smallest positive integer</b> that disproves this claim: “' + e.claim + '”.',
      input:true, answer:e.ce, accept:qty(e.ce, { tol:0.4 }), data:{ kind:'proof-counter', claim:e.claim, ce:e.ce },
      note:'One counterexample is enough to kill a universal claim: ' + e.ce + ' breaks it.' };
  }
  const m = mc('Assume it is rational, so it can be written as p/q in lowest terms.',
    ['Assume it is irrational and look for a contradiction.',
     'Assume p and q share a factor from the start.',
     'Show it is not an integer, which is enough.',
     'Assume the result is true for n = k.']);
  return { q:'A proof that <b>√2 is irrational</b> goes by contradiction. What is assumed at the start?',
    choices:m.choices, answer:m.answer, data:{ kind:'proof-contradiction' },
    note:'Contradiction assumes the <i>opposite</i> of what you want, then derives something impossible — here that p and q are both even despite being in lowest terms.' };
}

/* ── The nature of proof: inequalities ──────────────────────────────────── */
function genE2Ineq(){
  const k = ri(0, 4);
  if (k === 0){                                   // AM–GM as a minimum
    const c = pk([4, 9, 16, 25, 36, 49, 64]);
    const val = 2 * Math.sqrt(c);
    return { q:'For <b>x > 0</b>, what is the <b>smallest possible value</b> of <b>x + ' + c + '/x</b>?',
      input:true, answer:val, accept:qty(val, { tol:0.05 }), data:{ kind:'ineq-amgm', c },
      note:'By AM–GM, x + ' + c + '/x ≥ 2√(x × ' + c + '/x) = ' + val + ', with equality at x = ' + Math.sqrt(c) + '.' };
  }
  if (k === 1){                                   // (a + b)(1/a + 1/b) ≥ 4
    const m = mc('4', ['1', '2', '8', 'it has no minimum']);
    return { q:'For <b>a > 0</b> and <b>b > 0</b>, what is the <b>smallest possible value</b> of <b>(a + b)(1/a + 1/b)</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ineq-pair' },
      note:'Expanding gives 2 + a/b + b/a, and a/b + b/a ≥ 2 by AM–GM, so the whole thing is at least 4 — equality when a = b.' };
  }
  if (k === 2){                                   // which inequality is always true
    const e = pk([
      { right:'a² + b² ≥ 2ab for all real a and b', wrong:['a² + b² ≥ 2ab only when a and b are positive', 'a² + b² ≤ 2ab for all real a and b', 'a² + b² = 2ab for all real a and b'],
        why:'it rearranges to (a − b)² ≥ 0, which holds for every real a and b' },
      { right:'|a + b| ≤ |a| + |b| for all real a and b', wrong:['|a + b| ≥ |a| + |b| for all real a and b', '|a + b| = |a| + |b| for all real a and b', '|a + b| ≤ |a| − |b| for all real a and b'],
        why:'the two sides are equal when a and b have the same sign, and otherwise some of the size cancels' },
      { right:'a/b + b/a ≥ 2 for all positive a and b', wrong:['a/b + b/a ≥ 2 for all non-zero a and b', 'a/b + b/a ≤ 2 for all positive a and b', 'a/b + b/a = 2 only when a = b'],
        why:'it rearranges to (a − b)² ≥ 0 after multiplying by the positive ab — and the sign of ab is exactly why “positive” matters' }
    ]);
    const m = mc(e.right, e.wrong);
    return { q:'Which statement is <b>always true</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ineq-true' },
      note:'True because ' + e.why + '.' };
  }
  if (k === 3){                                   // the classic invalid step
    const m = mc('Both sides were divided by a − b, which can be zero.',
      ['Both sides were squared, which is never allowed.',
       'The inequality sign should have been reversed when adding.',
       'a and b were assumed to be integers.',
       'Nothing is wrong with the proof.']);
    return { q:'A student “proves” <b>1 = 2</b> like this: let a = b, so a² = ab, so a² − b² = ab − b², so (a − b)(a + b) = b(a − b), so a + b = b, and with a = b that gives 2b = b. What is <b>wrong</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ineq-bogus' },
      note:'a = b makes a − b exactly zero, and dividing by zero is what lets the nonsense through.' };
  }
  const n = ri(2, 6), c2 = pk([1, 2, 3]);         // a numeric minimum of a sum of powers
  const val = (n + 1) * Math.pow(c2 / n, n / (n + 1));
  return { q:'For <b>x > 0</b>, the expression <b>x' + sup(n) + ' + ' + c2 + '/x</b> has a least value. Find it, to 4 decimal places.',
    input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }), data:{ kind:'ineq-min', n, c:c2 },
    note:'Differentiating, ' + n + 'x' + sup(n - 1) + ' = ' + c2 + '/x², so x = (' + fracStr(c2, n) + ')^(1/' + (n + 1) + ') and the least value is ' + rd(val, 4) + '.' };
}

/* ── The nature of proof: further induction ─────────────────────────────── */
const E2_INDINEQ = [
  { claim:'2ⁿ > n²', f:n => Math.pow(2, n) > n * n, from:5 },
  { claim:'3ⁿ > n³', f:n => Math.pow(3, n) > n * n * n, from:4 },
  { claim:'n! > 2ⁿ', f:n => { let x = 1; for (let i = 2; i <= n; i++) x *= i; return x > Math.pow(2, n); }, from:4 },
  { claim:'2ⁿ > n + 10', f:n => Math.pow(2, n) > n + 10, from:4 }
];

function genE2Ind(){
  const k = ri(0, 2);
  if (k === 0){                                   // where the inequality takes hold
    const e = pk(E2_INDINEQ);
    return { q:'<b>' + e.claim + '</b> is true for every integer from some point on. What is the <b>smallest</b> integer n ≥ 1 from which it holds for good?',
      input:true, answer:e.from, accept:qty(e.from, { tol:0.4 }), data:{ kind:'ind2-start', claim:e.claim, from:e.from },
      note:'Testing small values is the whole job of the base case: it first holds for good at n = ' + e.from + ', and induction carries it from there.' };
  }
  if (k === 1){                                   // what the step has to produce
    const m = mc('2^(k+1) > (k + 1)², using 2 × 2ᵏ > 2k² and 2k² > (k + 1)² for k ≥ 3.',
      ['2ᵏ > k², which is what was assumed.',
       '2ᵏ > (k + 1)², which is stronger than needed.',
       '(k + 1)² > k², which is true for all k.',
       'k² > 2ᵏ for large k.']);
    return { q:'You are proving <b>2ⁿ > n²</b> for n ≥ 5 by induction and have assumed <b>2ᵏ > k²</b>. What must the inductive step show?',
      choices:m.choices, answer:m.answer, data:{ kind:'ind2-step' },
      note:'Double the assumption to reach 2^(k+1) > 2k², then show 2k² ≥ (k + 1)², which holds once k ≥ 3.' };
  }
  const base = pk([2, 3, 5, 7]), n = ri(2, 4);    // a divisibility result with two powers
  const val = Math.pow(base + 1, n) - 1;
  return { q:'You are proving that <b>' + (base + 1) + 'ⁿ − 1</b> is divisible by <b>' + base + '</b> for all n ≥ 1. What is its value at <b>n = ' + n + '</b>?',
    input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'ind2-div', base, n, val },
    note:'It comes to ' + val + ' = ' + (val / base) + ' × ' + base + '. In general ' + (base + 1) + '^(k+1) − 1 = ' + (base + 1) + '(' + base + 'M + 1) − 1 = ' + base + '(' + (base + 1) + 'M + 1).' };
}

/* ── Vectors in three dimensions ────────────────────────────────────────── */
function genE2Vec3(){
  const k = ri(0, 4);
  const a = [nzr(-5, 5), nzr(-5, 5), nzr(-5, 5)], b = [nzr(-5, 5), nzr(-5, 5), nzr(-5, 5)];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const A = vecStr(a[0], a[1], a[2]), B = vecStr(b[0], b[1], b[2]);
  if (k === 0){
    return { q:'Find <b>a · b</b> where a = ' + A + ' and b = ' + B + '.',
      input:true, answer:dot, accept:qty(dot, { tol:0.4 }), data:{ kind:'v3-dot', a, b },
      note:'In three dimensions the dot product is still the sum of the products of matching components: ' + neg(dot) + '.' };
  }
  if (k === 1){
    const ma = Math.hypot(a[0], a[1], a[2]), mb = Math.hypot(b[0], b[1], b[2]);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI;
    return { q:'Find the angle between ' + A + ' and ' + B + ', in degrees to 1 decimal place.',
      input:true, answer:rd(ang, 1), accept:qty(ang, { tol:0.1 }), data:{ kind:'v3-angle', a, b },
      note:'cos θ = (a · b)/(|a||b|) = ' + neg(dot) + '/(' + rd(ma, 3) + ' × ' + rd(mb, 3) + '), so θ = ' + rd(ang, 1) + '°.' };
  }
  if (k === 2){
    const lam = -(a[0] * b[0] + a[1] * b[1]) / a[2];
    return { q:'The vectors <b>' + A + '</b> and <b>' + neg(xTerm(b[0], 'i')) + ' ' + vecTerm(b[1], 'j') + ' + λk</b> are <b>perpendicular</b>. Find λ, to 4 decimal places.',
      input:true, answer:rd(lam, 4), accept:qty(lam, { tol:0.001 }), data:{ kind:'v3-perp', a, b },
      note:'Set the dot product to zero: ' + neg(a[0] * b[0] + a[1] * b[1]) + ' ' + signed(a[2]) + 'λ = 0, so λ = ' + neg(rd(lam, 4)) + '.' };
  }
  if (k === 3){
    const mb = Math.hypot(b[0], b[1], b[2]);
    const proj = dot / mb;
    return { q:'Find the <b>scalar projection</b> of ' + A + ' onto ' + B + ', to 3 decimal places.',
      input:true, answer:rd(proj, 3), accept:qty(proj, { tol:0.002 }), data:{ kind:'v3-proj', a, b },
      note:'(a · b)/|b| = ' + neg(dot) + '/' + rd(mb, 4) + ' = ' + neg(rd(proj, 3)) + '.' };
  }
  const s = pk([-3, -2, 2, 3]);                   // parallel or not
  const par = Math.random() < 0.5;
  const c = par ? [a[0] * s, a[1] * s, a[2] * s] : [a[0] * s, a[1] * s + nzr(1, 3), a[2] * s];
  const m = mc(par ? 'Yes — the second is ' + s + ' times the first.' : 'No — no single multiple works for all three components.',
    [par ? 'No — no single multiple works for all three components.' : 'Yes — the second is ' + s + ' times the first.',
     'Yes — their dot product is zero.', 'No — their dot product is not zero.']);
  return { q:'Are <b>' + A + '</b> and <b>' + vecStr(c[0], c[1], c[2]) + '</b> <b>parallel</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'v3-parallel', a, c, par },
    note:'Parallel means one is a scalar multiple of the other, so every component must scale by the same factor. A zero dot product would mean perpendicular, not parallel.' };
}

/* ── The vector equation of a line ──────────────────────────────────────── */
function genE2Line(){
  const k = ri(0, 4);
  const p = [nzr(-4, 4), nzr(-4, 4), nzr(-4, 4)];
  const d = [nzr(-3, 3), nzr(-3, 3), nzr(-3, 3)].map(x => Math.abs(x) === 1 ? x * 2 : x);
  const R = 'r = (' + neg(p.join(', ')) + ') + λ(' + neg(d.join(', ')) + ')';
  if (k === 0){                                   // a point on the line
    const lam = nzr(-3, 3);
    const hit = [p[0] + lam * d[0], p[1] + lam * d[1], p[2] + lam * d[2]];
    const m = mc('(' + neg(hit.join(', ')) + ')',
      ['(' + neg([p[0] + lam * d[0] + 1, p[1] + lam * d[1], p[2] + lam * d[2]].join(', ')) + ')',
       '(' + neg([p[0] - lam * d[0], p[1] - lam * d[1], p[2] - lam * d[2]].join(', ')) + ')',
       '(' + neg(d.join(', ')) + ')',
       '(' + neg([p[0] * lam, p[1] * lam, p[2] * lam].join(', ')) + ')']);
    return { q:'A line is <b>' + R + '</b>. Which point lies <b>on</b> it?',
      choices:m.choices, answer:m.answer, data:{ kind:'line-point', p, d, lam, hit },
      note:'Put λ = ' + neg(lam) + ' into the equation: every point on the line is the fixed point plus some multiple of the direction.' };
  }
  if (k === 1){                                   // find the parameter
    const lam = nzr(-4, 4);
    const hit = [p[0] + lam * d[0], p[1] + lam * d[1], p[2] + lam * d[2]];
    return { q:'The line <b>' + R + '</b> passes through <b>(' + neg(hit.join(', ')) + ')</b>. Find <b>λ</b> there.',
      input:true, answer:lam, accept:qty(lam, { tol:0.05 }), data:{ kind:'line-param', p, d, hit, lam },
      note:'Match any one component: ' + neg(p[0]) + ' ' + signed(d[0]) + 'λ = ' + neg(hit[0]) + ' gives λ = ' + neg(lam) + ', and the other two agree.' };
  }
  if (k === 2){                                   // the angle between two lines
    const e = [nzr(-3, 3), nzr(-3, 3), nzr(-3, 3)];
    const dotd = d[0] * e[0] + d[1] * e[1] + d[2] * e[2];
    const ang = Math.acos(Math.min(1, Math.abs(dotd) / (Math.hypot(...d) * Math.hypot(...e)))) * 180 / Math.PI;
    return { q:'Two lines have direction vectors <b>' + vecStr(d[0], d[1], d[2]) + '</b> and <b>' + vecStr(e[0], e[1], e[2]) + '</b>. Find the <b>acute angle</b> between them, in degrees to 1 decimal place.',
      input:true, answer:rd(ang, 1), accept:qty(ang, { tol:0.1 }), data:{ kind:'line-angle', d, e },
      note:'Use the directions only, and take the size of the dot product so the answer comes out acute: ' + rd(ang, 1) + '°.' };
  }
  if (k === 3){                                   // parallel lines
    const s = pk([-2, 2, 3]);
    const same = Math.random() < 0.5;
    const d2 = same ? [d[0] * s, d[1] * s, d[2] * s] : [d[0] * s, d[1] * s + 1, d[2] * s];
    const m = mc(same ? 'Parallel' : 'Not parallel', [same ? 'Not parallel' : 'Parallel', 'Perpendicular', 'The same line']);
    return { q:'One line has direction <b>' + vecStr(d[0], d[1], d[2]) + '</b> and another has direction <b>' + vecStr(d2[0], d2[1], d2[2]) + '</b>. How are they related?',
      choices:m.choices, answer:m.answer, data:{ kind:'line-parallel', d, d2, same },
      note:'Only the directions matter. They are parallel exactly when one direction is a multiple of the other; where the lines sit decides whether they are also the same line.' };
  }
  const m = mc('(x ' + signed(-p[0]) + ')/' + neg(d[0]) + ' = (y ' + signed(-p[1]) + ')/' + neg(d[1]) + ' = (z ' + signed(-p[2]) + ')/' + neg(d[2]),
    ['(x ' + signed(p[0]) + ')/' + neg(d[0]) + ' = (y ' + signed(p[1]) + ')/' + neg(d[1]) + ' = (z ' + signed(p[2]) + ')/' + neg(d[2]),
     '(x ' + signed(-d[0]) + ')/' + neg(p[0]) + ' = (y ' + signed(-d[1]) + ')/' + neg(p[1]) + ' = (z ' + signed(-d[2]) + ')/' + neg(p[2]),
     '(x ' + signed(-p[0]) + ') = (y ' + signed(-p[1]) + ') = (z ' + signed(-p[2]) + ')']);
  return { q:'Write the line <b>' + R + '</b> in <b>Cartesian form</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'line-cart', p, d },
    note:'Solve each component for λ and set them equal: λ = (x − p₁)/d₁ = (y − p₂)/d₂ = (z − p₃)/d₃.' };
}

/* ── Spheres ────────────────────────────────────────────────────────────── */
const sphTerm = (v, L) => v === 0 ? L + '²' : '(' + L + ' ' + signed(-v) + ')²';
function genE2Sphere(){
  const k = ri(0, 3);
  const c = [ri(-5, 5), ri(-5, 5), ri(-5, 5)], R = ri(2, 9);
  if (k === 0){
    const m = mc('centre (' + neg(c.join(', ')) + '), radius ' + R,
      ['centre (' + neg(c.map(x => -x).join(', ')) + '), radius ' + R,
       'centre (' + neg(c.join(', ')) + '), radius ' + (R * R),
       'centre (' + neg(c.map(x => -x).join(', ')) + '), radius ' + (R * R)]);
    return { q:'A sphere has equation <b>' + sphTerm(c[0], 'x') + ' + ' + sphTerm(c[1], 'y') + ' + ' + sphTerm(c[2], 'z') + ' = ' + (R * R) + '</b>. What are its <b>centre and radius</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'sph-read', c, R },
      note:'The equation says the distance from the centre is ' + R + ', and the number on the right is the radius <i>squared</i>.' };
  }
  if (k === 1){                                   // from the expanded form
    const dConst = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] - R * R;
    return { q:'A sphere has equation <b>x² + y² + z²' + plusTerm(-2 * c[0], 'x') + plusTerm(-2 * c[1], 'y') + plusTerm(-2 * c[2], 'z') + plusTerm(dConst, '') + ' = 0</b>. Find its <b>radius</b>.',
      input:true, answer:R, accept:qty(R, { tol:0.05 }), data:{ kind:'sph-expand', c, R, dConst },
      note:'Complete the square in each variable: the centre is (' + neg(c.join(', ')) + ') and the radius is √(' + neg(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]) + ' ' + signed(-dConst) + ') = ' + R + '.' };
  }
  if (k === 2){                                   // inside, on or outside
    const t = pk(E1_TRIP3);
    const dist = t[3];
    const P = [c[0] + t[0], c[1] + t[1], c[2] + t[2]];
    const R2 = pk([dist - ri(1, 2), dist, dist + ri(1, 2)].filter(x => x > 0));
    const where = dist < R2 ? 'inside' : dist > R2 ? 'outside' : 'on the surface of';
    const m = mc(where + ' the sphere', ['inside the sphere', 'outside the sphere', 'on the surface of the sphere'].filter(x => x !== where + ' the sphere'));
    return { q:'A sphere has centre <b>(' + neg(c.join(', ')) + ')</b> and radius <b>' + R2 + '</b>. Where is the point <b>(' + neg(P.join(', ')) + ')</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'sph-where', c, R:R2, P, dist },
      note:'Its distance from the centre is ' + dist + ', against a radius of ' + R2 + '.' };
  }
  const t = pk(E1_TRIP3);
  const P = [c[0] + t[0], c[1] + t[1], c[2] + t[2]];
  return { q:'Find the <b>distance</b> from <b>(' + neg(c.join(', ')) + ')</b>, the centre of a sphere, to the point <b>(' + neg(P.join(', ')) + ')</b>.',
    input:true, answer:t[3], accept:qty(t[3], { tol:0.05 }), data:{ kind:'sph-dist', c, P },
    note:'|P − C| = √(' + (t[0] * t[0]) + ' + ' + (t[1] * t[1]) + ' + ' + (t[2] * t[2]) + ') = ' + t[3] + '.' };
}

/* ── Complex numbers ────────────────────────────────────────────────────── */
/* a complex number the way it is written: 3 + 4i, −2i, 5, 3 − i */
function cx(a, b){
  const re = neg(rd(a, 4)), im = Math.abs(rd(b, 4));
  if (!im) return re;
  const body = (im === 1 ? '' : im) + 'i';
  return !a ? (b < 0 ? '−' : '') + body : re + (b < 0 ? ' − ' : ' + ') + body;
}
/* arguments that come out exactly, so modulus–argument questions stay clean */
const E2_CIS = [
  { a:1, b:0, deg:0 }, { a:1, b:1, deg:45 }, { a:0, b:1, deg:90 }, { a:-1, b:1, deg:135 },
  { a:-1, b:0, deg:180 }, { a:-1, b:-1, deg:-135 }, { a:0, b:-1, deg:-90 }, { a:1, b:-1, deg:-45 }
];

function genE2CxArith(){
  const k = ri(0, 5);
  const a = nzr(-6, 6), b = nzr(-6, 6), c = nzr(-5, 5), d = nzr(-5, 5);
  if (k === 0){                                   // a product
    const re = a * c - b * d, im = a * d + b * c;
    const m = mc(cx(re, im), [cx(a * c + b * d, a * d + b * c), cx(a * c - b * d, a * d - b * c),
      cx(a * c, b * d), cx(a * c + b * d, a * d - b * c)]);
    return { q:'Express <b>(' + cx(a, b) + ')(' + cx(c, d) + ')</b> in the form a + ib.',
      choices:m.choices, answer:m.answer, data:{ kind:'cx-mult', a, b, c, d },
      note:'Expand and use i² = −1: the real part is ' + neg(a * c) + ' − (' + neg(b * d) + ') = ' + neg(re) + ', and the imaginary part is ' + neg(im) + '.' };
  }
  if (k === 1){                                   // division, as a number
    const den = c * c + d * d;
    const re = (a * c + b * d) / den;
    return { q:'Find the <b>real part</b> of <b>(' + cx(a, b) + ')/(' + cx(c, d) + ')</b>, to 4 decimal places.',
      input:true, answer:rd(re, 4), accept:qty(re, { tol:0.0005 }), data:{ kind:'cx-div', a, b, c, d },
      note:'Multiply top and bottom by the conjugate ' + cx(c, -d) + '. The bottom becomes ' + den + ', and the real part of the top is ' + neg(a * c + b * d) + ', giving ' + neg(rd(re, 4)) + '.' };
  }
  if (k === 2){                                   // modulus squared
    const val = a * a + b * b;
    return { q:'For <b>z = ' + cx(a, b) + '</b>, find <b>z z̄</b> (that is, z times its conjugate).',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'cx-conj', a, b },
      note:'z z̄ = |z|² = ' + (a * a) + ' + ' + (b * b) + ' = ' + val + ' — always real, and never negative.' };
  }
  if (k === 3){                                   // a square
    const re = a * a - b * b, im = 2 * a * b;
    const m = mc(cx(re, im), [cx(a * a + b * b, 2 * a * b), cx(a * a, b * b), cx(re, a * b), cx(a * a - b * b, -2 * a * b)]);
    return { q:'Express <b>(' + cx(a, b) + ')²</b> in the form a + ib.',
      choices:m.choices, answer:m.answer, data:{ kind:'cx-square', a, b },
      note:'(x + iy)² = x² − y² + 2ixy, so the real part is ' + (a * a) + ' − ' + (b * b) + ' = ' + neg(re) + ' and the imaginary part is ' + neg(im) + '.' };
  }
  if (k === 4){                                   // the real quadratic with a given root
    const p = nzr(-5, 5), q = ri(1, 6);
    const B = -2 * p, C = p * p + q * q;
    const m = mc('x²' + plusTerm(B, 'x') + plusTerm(C, ''), ['x²' + plusTerm(-B, 'x') + plusTerm(C, ''),
      'x²' + plusTerm(B, 'x') + plusTerm(p * p - q * q, ''), 'x²' + plusTerm(B, 'x') + plusTerm(-C, ''),
      'x²' + plusTerm(2 * p, 'x') + plusTerm(q * q, '')]);
    return { q:'<b>' + cx(p, q) + '</b> is a root of a quadratic with <b>real</b> coefficients. Which quadratic is it?',
      choices:m.choices, answer:m.answer, data:{ kind:'cx-quad', p, q },
      note:'Real coefficients force the conjugate ' + cx(p, -q) + ' to be the other root, so the sum of the roots is ' + neg(2 * p) + ' and the product is ' + C + '.' };
  }
  const p = nzr(-5, 5), q = ri(1, 6);
  const m = mc(cx(p, -q), [cx(-p, q), cx(-p, -q), cx(q, p), cx(p, q)]);
  return { q:'A polynomial with <b>real</b> coefficients has <b>' + cx(p, q) + '</b> as a root. Which number must also be a root?',
    choices:m.choices, answer:m.answer, data:{ kind:'cx-conjroot', p, q },
    note:'Non-real roots of a real polynomial come in conjugate pairs, so ' + cx(p, -q) + ' is also a root. Negating is not the same as conjugating.' };
}

function genE2CxModArg(){
  const k = ri(0, 4);
  if (k === 0){                                   // modulus, exactly
    const t = pk(E1_TRIP2), a = t[0] * pk([1, -1]), b = t[1] * pk([1, -1]);
    return { q:'Find <b>|' + cx(a, b) + '|</b>.',
      input:true, answer:t[2], accept:qty(t[2], { tol:0.05 }), data:{ kind:'ma-mod', a, b },
      note:'|a + ib| = √(a² + b²) = √' + (a * a + b * b) + ' = ' + t[2] + '.' };
  }
  if (k === 1){                                   // the argument, in degrees
    const e = pk(E2_CIS), s = ri(1, 5);
    const a = e.a * s, b = e.b * s;
    return { q:'Find the <b>principal argument</b> of <b>' + cx(a, b) + '</b>, in degrees. (The principal argument lies in −180° < θ ≤ 180°.)',
      input:true, answer:e.deg, accept:qty(e.deg, { tol:0.5 }), data:{ kind:'ma-arg', a, b, deg:e.deg },
      note:'The point (' + neg(a) + ', ' + neg(b) + ') sits at ' + neg(e.deg) + '° from the positive real axis. Watch the quadrant: the inverse tangent alone cannot tell ' + neg(e.deg) + '° from ' + neg(e.deg > 0 ? e.deg - 180 : e.deg + 180) + '°.' };
  }
  if (k === 2){                                   // the modulus of a product
    const t1 = pk(E1_TRIP2), t2 = pk(E1_TRIP2);
    const val = t1[2] * t2[2];
    return { q:'<b>|z| = ' + t1[2] + '</b> and <b>|w| = ' + t2[2] + '</b>. Find <b>|zw|</b>.',
      input:true, answer:val, accept:qty(val, { tol:0.4 }), data:{ kind:'ma-prodmod', z:t1[2], w:t2[2] },
      note:'Moduli multiply: |zw| = |z||w| = ' + val + '. (Arguments add, which is the other half of the same rule.)' };
  }
  if (k === 3){                                   // arguments add
    const x = pk([20, 30, 45, 60, 110, 135]), y = pk([25, 40, 50, 70, 100]);
    let sum = x + y;
    if (sum > 180) sum -= 360;
    return { q:'<b>arg z = ' + x + '°</b> and <b>arg w = ' + y + '°</b>. Find the <b>principal argument of zw</b>, in degrees.',
      input:true, answer:sum, accept:qty(sum, { tol:0.5 }), data:{ kind:'ma-prodarg', x, y, sum },
      note:'Arguments add to ' + (x + y) + '°' + (x + y > 180 ? ', which is outside −180° < θ ≤ 180°, so take off 360° to get ' + sum + '°.' : '.') };
  }
  const e = pk(E2_CIS.filter(z => z.deg % 90 !== 0)), r = ri(2, 6);
  const m = mc(r + '(cos ' + e.deg + '° + i sin ' + e.deg + '°)',
    [r + '(cos ' + e.deg + '° − i sin ' + e.deg + '°)', r + '(sin ' + e.deg + '° + i cos ' + e.deg + '°)',
     (r * r) + '(cos ' + e.deg + '° + i sin ' + e.deg + '°)', r + '(cos ' + (-e.deg) + '° + i sin ' + (-e.deg) + '°)']);
  return { q:'A complex number has <b>modulus ' + r + '</b> and <b>argument ' + neg(e.deg) + '°</b>. Write it in <b>modulus–argument form</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'ma-polar', r, deg:e.deg },
    note:'z = r(cos θ + i sin θ), with the modulus outside and the same angle in both places.' };
}

function genE2DeMoivre(){
  const k = ri(0, 4);
  if (k === 0){                                   // the statement itself
    const n = ri(3, 8);
    const m = mc('cos ' + n + 'θ + i sin ' + n + 'θ', ['cos' + sup(n) + 'θ + i sin' + sup(n) + 'θ',
      n + ' cos θ + ' + n + 'i sin θ', 'cos ' + n + 'θ − i sin ' + n + 'θ', 'cos θ + i sin ' + n + 'θ']);
    return { q:'By de Moivre’s theorem, <b>(cos θ + i sin θ)' + sup(n) + '</b> equals what?',
      choices:m.choices, answer:m.answer, data:{ kind:'dm-statement', n },
      note:'Raising to the power n multiplies the argument by n and leaves the modulus (1 here) alone.' };
  }
  if (k === 1){                                   // the modulus of a power
    const t = pk([[1, 1, Math.SQRT2], [3, 4, 5], [1, 0, 1], [0, 2, 2], [5, 12, 13]]);
    const n = ri(2, 5);
    const val = Math.pow(t[2], n);
    return { q:'For <b>z = ' + cx(t[0], t[1]) + '</b>, find <b>|z' + sup(n) + '|</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:Math.max(0.0005, val * 2e-4) }), data:{ kind:'dm-mod', a:t[0], b:t[1], n },
      note:'|zⁿ| = |z|ⁿ = ' + rd(t[2], 4) + sup(n) + ' = ' + rd(val, 4) + '.' };
  }
  if (k === 2){                                   // the argument of a power, brought back into range
    const e = pk(E2_CIS.filter(z => z.deg !== 0)), n = ri(2, 6);
    let arg = e.deg * n;
    arg = ((arg + 180) % 360 + 360) % 360 - 180;
    if (arg === -180) arg = 180;
    return { q:'<b>arg z = ' + neg(e.deg) + '°</b>. Find the <b>principal argument of z' + sup(n) + '</b>, in degrees.',
      input:true, answer:arg, accept:qty(arg, { tol:0.5 }), data:{ kind:'dm-arg', deg:e.deg, n, arg },
      note:'Multiply the argument by ' + n + ' to get ' + neg(e.deg * n) + '°, then add or take off whole turns until it lies in −180° < θ ≤ 180°: ' + neg(arg) + '°.' };
  }
  if (k === 3){                                   // roots of unity
    const n = ri(3, 9);
    const which = pk(['count', 'spacing']);
    const val = which === 'count' ? n : 360 / n;
    return { q:which === 'count' ? 'How many <b>distinct solutions</b> does <b>z' + sup(n) + ' = 1</b> have?'
                                 : 'The solutions of <b>z' + sup(n) + ' = 1</b> are evenly spaced around the unit circle. What is the <b>angle between neighbours</b>, in degrees to 2 decimal places?',
      input:true, answer:rd(val, 2), accept:qty(val, { tol:0.01 }), data:{ kind:'dm-roots', n, which },
      note:'There are exactly ' + n + ' nth roots, spaced 360°/' + n + ' = ' + rd(360 / n, 2) + '° apart, all of modulus 1.' };
  }
  const n = pk([4, 8, 12]);                       // (1 + i)ⁿ, which is real for these n
  const val = Math.pow(Math.SQRT2, n) * Math.cos(n * 45 * Math.PI / 180);
  return { q:'Find <b>(1 + i)' + sup(n) + '</b>, which is a real number.',
    input:true, answer:Math.round(val), accept:qty(val, { tol:Math.max(0.5, Math.abs(val) * 1e-6) }), data:{ kind:'dm-power', n, val },
    note:'1 + i has modulus √2 and argument 45°, so (1 + i)' + sup(n) + ' has modulus (√2)' + sup(n) + ' = ' + Math.pow(2, n / 2) + ' and argument ' + (45 * n) + '°, which lands on the real axis: ' + neg(Math.round(val)) + '.' };
}

function genE2Locus(){
  const k = ri(0, 4);
  const a = nzr(-5, 5), b = nzr(-5, 5), r = ri(1, 6);
  if (k === 0){
    const m = mc('a circle of radius ' + r + ', centred at (' + neg(a) + ', ' + neg(b) + ')',
      ['a circle of radius ' + (r * r) + ', centred at (' + neg(a) + ', ' + neg(b) + ')',
       'a circle of radius ' + r + ', centred at (' + neg(-a) + ', ' + neg(-b) + ')',
       'a line through (' + neg(a) + ', ' + neg(b) + ')',
       'a disc of radius ' + r + ' including its inside']);
    return { q:'What does <b>|z − (' + cx(a, b) + ')| = ' + r + '</b> describe on the Argand diagram?',
      choices:m.choices, answer:m.answer, data:{ kind:'loc-circle', a, b, r },
      note:'|z − c| is the distance from z to c, so holding it at ' + r + ' traces a circle. An inequality would fill it in.' };
  }
  if (k === 1){
    const c = nzr(-5, 5), d = nzr(-5, 5);
    const m = mc('the perpendicular bisector of the segment joining them',
      ['a circle through both points', 'the segment joining them',
       'the line through both points', 'an ellipse with them as foci']);
    return { q:'What does <b>|z − (' + cx(a, b) + ')| = |z − (' + cx(c, d) + ')|</b> describe?',
      choices:m.choices, answer:m.answer, data:{ kind:'loc-bisector', a, b, c, d },
      note:'The condition says z is the same distance from both points, which is exactly the perpendicular bisector.' };
  }
  if (k === 2){
    const deg = pk([30, 45, 60, 90, 120, 135]);
    const m = mc('a ray from (' + neg(a) + ', ' + neg(b) + ') at ' + deg + '° to the positive real direction, not including that point',
      ['the whole line through (' + neg(a) + ', ' + neg(b) + ') at ' + deg + '°',
       'a circle centred at (' + neg(a) + ', ' + neg(b) + ')',
       'a ray from the origin at ' + deg + '°',
       'a ray from (' + neg(a) + ', ' + neg(b) + ') at ' + (90 - deg) + '°']);
    return { q:'What does <b>arg(z − (' + cx(a, b) + ')) = ' + deg + '°</b> describe?',
      choices:m.choices, answer:m.answer, data:{ kind:'loc-ray', a, b, deg },
      note:'The argument fixes a single direction, so it is half a line. The starting point itself is left out, since arg 0 is undefined.' };
  }
  if (k === 3){
    const v = nzr(-5, 5), re = Math.random() < 0.5;
    const m = mc(re ? 'a vertical line through x = ' + neg(v) : 'a horizontal line through y = ' + neg(v),
      [re ? 'a horizontal line through y = ' + neg(v) : 'a vertical line through x = ' + neg(v),
       'a circle of radius ' + Math.abs(v), 'a ray from the origin', 'the empty set']);
    return { q:'What does <b>' + (re ? 'Re' : 'Im') + '(z) = ' + neg(v) + '</b> describe?',
      choices:m.choices, answer:m.answer, data:{ kind:'loc-line', v, re },
      note:re ? 'Fixing the real part pins x and lets y run free, giving a vertical line.'
              : 'Fixing the imaginary part pins y and lets x run free, giving a horizontal line.' };
  }
  const t = pk(E1_TRIP2), ca = t[0], cb = t[1], R = ri(1, 4);   // furthest point of a circle from the origin
  const val = t[2] + R;
  return { q:'<b>|z − (' + cx(ca, cb) + ')| = ' + R + '</b>. What is the <b>greatest value of |z|</b>?',
    input:true, answer:val, accept:qty(val, { tol:0.05 }), data:{ kind:'loc-maxmod', ca, cb, R },
    note:'z runs over a circle of radius ' + R + ' centred ' + t[2] + ' from the origin, so |z| is largest straight out past the centre: ' + t[2] + ' + ' + R + ' = ' + val + '.' };
}

/* ── Further integration: by parts ──────────────────────────────────────── */
function genE2Parts(){
  const k = ri(0, 4);
  if (k === 0){                                   // ∫ x e^x
    const b = ri(1, 3);
    const val = (b - 1) * Math.exp(b) + 1;
    return { q:'Evaluate <b>∫₀' + sup(b) + ' x e' + sup('ˣ') + ' dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:Math.max(0.0005, val * 2e-4) }),
      data:{ kind:'e2-defint', fx:'x*Math.exp(x)', a:0, b, val },
      note:'By parts with u = x and v′ = e^x: xe^x − ∫e^x dx = (x − 1)e^x, so the answer is ' + rd(val, 4) + '.' };
  }
  if (k === 1){                                   // ∫ x sin x over a half turn
    const val = Math.PI;
    return { q:'Evaluate <b>∫₀<sup>π</sup> x sin x dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e2-defint', fx:'x*Math.sin(x)', a:0, b:Math.PI, val },
      note:'By parts with u = x and v′ = sin x: −x cos x + ∫cos x dx = −x cos x + sin x, which over [0, π] gives π.' };
  }
  if (k === 2){                                   // ∫ ln x
    const b = ri(2, 6);
    const val = b * Math.log(b) - b + 1;
    return { q:'Evaluate <b>∫₁' + sup(b) + ' ln x dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e2-defint', fx:'Math.log(x)', a:1, b, val },
      note:'Take u = ln x and v′ = 1: x ln x − ∫1 dx = x ln x − x, so the answer is ' + rd(val, 4) + '.' };
  }
  if (k === 3){                                   // the antiderivative itself
    const which = pk(['xe', 'xcos']);
    const right = which === 'xe' ? '(x − 1)e^x + C' : 'x sin x + cos x + C';
    const m = mc(right, which === 'xe'
      ? ['(x + 1)e^x + C', 'x e^x + C', 'x²e^x/2 + C', 'e^x + C']
      : ['x sin x − cos x + C', 'x cos x + sin x + C', '−x sin x − cos x + C', 'sin x + C']);
    return { q:'Find <b>∫ ' + (which === 'xe' ? 'x e^x' : 'x cos x') + ' dx</b>.',
      choices:m.choices, answer:m.answer,
      data:{ kind:'e2-int', fx:which === 'xe' ? 'x*Math.exp(x)' : 'x*Math.cos(x)',
             Fx:which === 'xe' ? '(x-1)*Math.exp(x)' : 'x*Math.sin(x)+Math.cos(x)', lo:0.2, hi:1.8 },
      note:'Differentiate the options to check: the product rule on ' + right.replace(' + C', '') + ' gives back the integrand.' };
  }
  const m = mc('u = ln x, because differentiating it is what simplifies the problem',
    ['u = x, because it is the simpler factor', 'u = x ln x, taken all together',
     'u = 1, so that v′ = x ln x', 'parts does not apply here']);
  return { q:'To find <b>∫ x ln x dx</b> by parts, which choice of <b>u</b> works?',
    choices:m.choices, answer:m.answer, data:{ kind:'parts-choice' },
    note:'Parts trades ∫uv′ for ∫u′v, so pick the u whose derivative is simpler. ln x differentiates to 1/x; going the other way would need ∫ln x anyway.' };
}

/* ── Further integration: partial fractions ─────────────────────────────── */
function genE2Partial(){
  const k = ri(0, 2);
  const p = ri(1, 4), q = p + ri(1, 4);           // distinct roots, both left of the limits
  if (k === 0){                                   // the coefficient itself
    const c = nzr(-5, 5), d = nzr(-9, 9);
    const A = (c * p + d) / (p - q);
    return { q:'Write <b>(' + neg(xTerm(c)) + ' ' + signed(d) + ')/((x − ' + p + ')(x − ' + q + '))</b> as <b>A/(x − ' + p + ') + B/(x − ' + q + ')</b>. Find <b>A</b>, to 4 decimal places.',
      input:true, answer:rd(A, 4), accept:qty(A, { tol:0.0005 }), data:{ kind:'pf-coeff', c, d, p, q },
      note:'Cover up (x − ' + p + ') and put x = ' + p + ' into what is left: (' + neg(c * p + d) + ')/(' + p + ' − ' + q + ') = ' + neg(rd(A, 4)) + '.' };
  }
  if (k === 1){                                   // a definite integral
    const lo = q + 1, hi = q + ri(2, 5);
    const F = x => (Math.log(Math.abs(x - q)) - Math.log(Math.abs(x - p))) / (q - p);
    const val = F(hi) - F(lo);
    return { q:'Evaluate <b>∫ dx/((x − ' + p + ')(x − ' + q + '))</b> from <b>x = ' + lo + '</b> to <b>x = ' + hi + '</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e2-defint', fx:'1/((x-' + p + ')*(x-' + q + '))', a:lo, b:hi, val },
      note:'Split into ' + fracStr(1, q - p) + '[1/(x − ' + q + ') − 1/(x − ' + p + ')], integrate to logs, and the answer is ' + neg(rd(val, 4)) + '.' };
  }
  const m = mc('A/(x − ' + p + ') + B/(x − ' + q + ')',
    ['A/((x − ' + p + ')(x − ' + q + '))', '(Ax + B)/(x − ' + p + ') + C/(x − ' + q + ')',
     'A/(x − ' + p + ') + B/(x − ' + p + ')²', 'Ax/(x − ' + p + ') + Bx/(x − ' + q + ')']);
  return { q:'What is the right <b>form</b> for the partial fractions of <b>(3x + 1)/((x − ' + p + ')(x − ' + q + '))</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'pf-form', p, q },
    note:'Each distinct linear factor gets one constant on top. A repeated factor would need a second term with the square underneath.' };
}

/* ── Further integration: other techniques ──────────────────────────────── */
function genE2Tech(){
  const k = ri(0, 3);
  if (k === 0){                                   // completing the square, into an inverse tangent
    const b = ri(1, 5), e = ri(1, 5);
    const c = b * b + e * e;                      // x² + 2bx + c = (x + b)² + e²
    const F = x => Math.atan((x + b) / e) / e;
    const lo = 0, hi = ri(1, 5);
    const val = F(hi) - F(lo);
    return { q:'Evaluate <b>∫₀' + sup(hi) + ' dx/(x²' + plusTerm(2 * b, 'x') + plusTerm(c, '') + ')</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
      data:{ kind:'e2-defint', fx:'1/(x*x+' + (2 * b) + '*x+' + c + ')', a:lo, b:hi, val },
      note:'Complete the square: x²' + plusTerm(2 * b, 'x') + plusTerm(c, '') + ' = (x + ' + b + ')² + ' + (e * e) + ', so the integral is (1/' + e + ')tan' + sup(-1) + '((x + ' + b + ')/' + e + ') = ' + rd(val, 4) + '.' };
  }
  if (k === 1){                                   // a quarter circle, by trigonometric substitution
    const a = ri(2, 6);
    const val = Math.PI * a * a / 4;
    return { q:'Evaluate <b>∫₀' + sup(a) + ' √(' + (a * a) + ' − x²) dx</b>, to 4 decimal places.',
      input:true, answer:rd(val, 4), accept:qty(val, { tol:Math.max(0.0005, val * 2e-4) }),
      data:{ kind:'e2-defint', fx:'Math.sqrt(' + (a * a) + '-x*x)', a:0, b:a, val },
      note:'x = ' + a + ' sin θ turns it into ' + (a * a) + '∫cos²θ dθ. It is also a quarter of a circle of radius ' + a + ': π×' + (a * a) + '/4 = ' + rd(val, 4) + '.' };
  }
  if (k === 2){                                   // the t-formulae
    const which = pk(['sin', 'cos']);
    const right = which === 'sin' ? '2t/(1 + t²)' : '(1 − t²)/(1 + t²)';
    const m = mc(right, [which === 'sin' ? '(1 − t²)/(1 + t²)' : '2t/(1 + t²)',
      '2t/(1 − t²)', 't/(1 + t²)', '(1 + t²)/(1 − t²)']);
    return { q:'With the substitution <b>t = tan(x/2)</b>, what does <b>' + which + ' x</b> become?',
      choices:m.choices, answer:m.answer, data:{ kind:'t-formula', which },
      note:'sin x = 2t/(1 + t²), cos x = (1 − t²)/(1 + t²) and dx = 2dt/(1 + t²). Checking at x = 0 (t = 0) sorts the two apart straight away.' };
  }
  const a2 = ri(1, 9), hi = ri(1, 4);             // ∫ x/(x² + a)
  const val = Math.log((hi * hi + a2) / a2) / 2;
  return { q:'Evaluate <b>∫₀' + sup(hi) + ' x/(x² + ' + a2 + ') dx</b>, to 4 decimal places.',
    input:true, answer:rd(val, 4), accept:qty(val, { tol:0.0005 }),
    data:{ kind:'e2-defint', fx:'x/(x*x+' + a2 + ')', a:0, b:hi, val },
    note:'The top is half the derivative of the bottom, so it is ½ln(x² + ' + a2 + '), giving ½ln(' + (hi * hi + a2) + '/' + a2 + ') = ' + rd(val, 4) + '.' };
}

/* ── Mechanics: simple harmonic motion ──────────────────────────────────── */
function genE2SHM(){
  const k = ri(0, 7);
  const n = ri(2, 6), amp = ri(2, 9);
  if (k === 0){
    const T = 2 * Math.PI / n;
    return { q:'A particle moves so that <b>ẍ = −' + (n * n) + 'x</b>. Find its <b>period</b>, to 4 decimal places.',
      input:true, answer:rd(T, 4), accept:qty(T, { tol:0.0005 }), data:{ kind:'shm-period', n },
      note:'ẍ = −n²x with n = ' + n + ', and the period is 2π/n = ' + rd(T, 4) + '. The amplitude has no effect on it.' };
  }
  if (k === 1){
    const v = n * amp;
    return { q:'A particle in simple harmonic motion has <b>ẍ = −' + (n * n) + 'x</b> and <b>amplitude ' + amp + '</b>. Find its <b>greatest speed</b>.',
      input:true, answer:v, accept:qty(v, { tol:0.05 }), data:{ kind:'shm-maxv', n, amp },
      note:'v² = n²(a² − x²) is largest at the centre, where it gives v = na = ' + n + ' × ' + amp + ' = ' + v + '.' };
  }
  if (k === 2){
    const x = ri(1, amp - 1);
    const v = n * Math.sqrt(amp * amp - x * x);
    return { q:'A particle in simple harmonic motion has <b>ẍ = −' + (n * n) + 'x</b> and <b>amplitude ' + amp + '</b>. Find its <b>speed at x = ' + x + '</b>, to 4 decimal places.',
      input:true, answer:rd(v, 4), accept:qty(v, { tol:0.0005 }), data:{ kind:'shm-speed', n, amp, x },
      note:'v² = n²(a² − x²) = ' + (n * n) + '(' + (amp * amp) + ' − ' + (x * x) + '), so v = ' + rd(v, 4) + '.' };
  }
  if (k === 3){                                   // read the motion out of v²
    const A = n * n * amp * amp, B = n * n;
    const want = pk(['amp', 'period']);
    const val = want === 'amp' ? amp : 2 * Math.PI / n;
    return { q:'A particle moves with <b>v² = ' + A + ' − ' + B + 'x²</b>. Find its <b>' + (want === 'amp' ? 'amplitude' : 'period, to 4 decimal places') + '</b>.',
      input:true, answer:want === 'amp' ? amp : rd(val, 4), accept:qty(val, { tol:0.0005 }), data:{ kind:'shm-read', n, amp, want },
      note:'Written as v² = n²(a² − x²) this is ' + B + '(' + (amp * amp) + ' − x²), so n = ' + n + ' and a = ' + amp + '. The period is 2π/' + n + ' = ' + rd(2 * Math.PI / n, 4) + '.' };
  }
  if (k === 4){                                   // displacement at a time
    const t = rd(ri(1, 20) / 10, 1);
    const x = amp * Math.cos(n * t);
    return { q:'A particle has <b>x = ' + amp + ' cos(' + n + 't)</b>, with t in seconds. Find <b>x</b> when <b>t = ' + t + '</b>, to 4 decimal places.',
      input:true, answer:rd(x, 4), accept:qty(x, { tol:0.0005 }), data:{ kind:'shm-x', n, amp, t },
      note:'Work in radians: ' + amp + ' cos(' + rd(n * t, 1) + ') = ' + neg(rd(x, 4)) + '.' };
  }
  if (k === 6){                                   // greatest speed, as multiple choice
    const m = numMC(n * amp, [n * n * amp, n + amp, 2 * n * amp, n * amp * amp, amp, n * n * amp * amp]);
    return { q:'A particle oscillates between <b>x = −' + amp + '</b> and <b>x = ' + amp + '</b>, with <b>ẍ = −' + (n * n) + 'x</b>. What is its greatest speed?',
      choices:m.choices, answer:m.answer, data:{ kind:'shm-maxv', n, amp },
      note:'The amplitude is ' + amp + ' and n = √' + (n * n) + ' = ' + n + '. From v² = n²(a² − x²), the speed is greatest at the centre x = 0, where v = na = ' + (n * amp) + '. Using n² = ' + (n * n) + ' in place of n is the slip to avoid.' };
  }
  if (k === 7){                                   // amplitude read out of v², as multiple choice
    const A = n * n * amp * amp, B = n * n;
    const m = numMC(amp, [2 * amp, amp * amp, n * amp, B, n, A, A / 2]);
    return { q:'A particle in simple harmonic motion has <b>v² = ' + A + ' − ' + B + 'x²</b>. What is its <b>amplitude</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'shm-read', n, amp, want:'amp' },
      note:'The particle turns round where v = 0: ' + B + 'x² = ' + A + ', so x² = ' + (amp * amp) + ' and the amplitude is ' + amp + '. ' + (n * amp) + ' is the greatest speed, not the amplitude.' };
  }
  const m = mc('The acceleration is proportional to the displacement from the centre and points back towards it.',
    ['The acceleration is constant.', 'The speed is constant.',
     'The acceleration is proportional to the displacement and points away from the centre.',
     'The acceleration is proportional to the speed.']);
  return { q:'What makes a motion <b>simple harmonic</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'shm-def' },
    note:'That is exactly what ẍ = −n²x says: the minus sign is the “back towards the centre” part.' };
}

/* ── Mechanics: resisted motion ─────────────────────────────────────────── */
function genE2Resist(){
  const k = ri(0, 5);
  const g = 9.8, mass = ri(1, 9) * 10, kk = rd(ri(5, 40) / 10, 1);
  if (k === 0){                                   // terminal velocity, resistance proportional to v
    const v = mass * g / kk;
    return { q:'A <b>' + mass + ' kg</b> object falls with air resistance <b>' + kk + 'v</b> newtons, where v is its speed in m s' + sup(-1) + '. Take g = 9.8 m s' + sup(-2) + '. Find its <b>terminal velocity</b>, to 3 decimal places.',
      input:true, answer:rd(v, 3), accept:qty(v, { tol:0.002, dim:'speed' }), data:{ kind:'res-term1', mass, k:kk, g },
      note:'Terminal velocity is where the acceleration dies: ' + mass + 'g = ' + kk + 'v, so v = ' + rd(v, 3) + ' m s' + sup(-1) + '.' };
  }
  if (k === 1){                                   // terminal velocity, resistance proportional to v²
    const v = Math.sqrt(mass * g / kk);
    return { q:'A <b>' + mass + ' kg</b> object falls with air resistance <b>' + kk + 'v²</b> newtons. Take g = 9.8 m s' + sup(-2) + '. Find its <b>terminal velocity</b>, to 3 decimal places.',
      input:true, answer:rd(v, 3), accept:qty(v, { tol:0.002, dim:'speed' }), data:{ kind:'res-term2', mass, k:kk, g },
      note:'Set the acceleration to zero: ' + mass + 'g = ' + kk + 'v², so v = √(' + rd(mass * g / kk, 3) + ') = ' + rd(v, 3) + ' m s' + sup(-1) + '.' };
  }
  if (k === 2){                                   // speed at a given time, from v = (g/k)(1 − e^−kt)
    const kr = rd(ri(2, 9) / 10, 1), t = rd(ri(5, 30) / 10, 1);
    const vT = g / kr;
    const v = vT * (1 - Math.exp(-kr * t));
    return { q:'A falling particle has <b>v̇ = 9.8 − ' + kr + 'v</b> and starts from rest. Find its <b>speed after ' + t + ' s</b>, to 4 decimal places.',
      input:true, answer:rd(v, 4), accept:qty(v, { tol:0.0005, dim:'speed' }), data:{ kind:'res-vt', k:kr, t, g },
      note:'Separating gives v = (9.8/' + kr + ')(1 − e^(−' + kr + 't)) = ' + rd(vT, 4) + '(1 − e^(−' + rd(kr * t, 4) + ')) = ' + rd(v, 4) + ', still short of the terminal ' + rd(vT, 4) + '.' };
  }
  if (k === 4){                                   // terminal velocity, resistance kv, as multiple choice
    const v = mass * g / kk;
    const m = numMC(v, [g / kk, kk / (mass * g), Math.sqrt(mass * g / kk), mass * g * kk], 3);
    return { q:'A body of mass <b>' + mass + ' kg</b> falls from rest. Air resistance is <b>' + kk + 'v</b> newtons at speed v m s' + sup(-1) + ', and g = 9.8 m s' + sup(-2) + '. What is its terminal velocity, in m s' + sup(-1) + '?',
      choices:m.choices, answer:m.answer, data:{ kind:'res-term1', mass, k:kk, g },
      note:'Newton’s second law gives ' + mass + 'v̇ = ' + mass + 'g − ' + kk + 'v, and the terminal velocity is where v̇ = 0: v = ' + mass + ' × 9.8/' + kk + ' = ' + rd(v, 3) + '. Treating ' + kk + 'v as an acceleration rather than a force gives ' + rd(g / kk, 3) + ' instead.' };
  }
  if (k === 5){                                   // terminal velocity, resistance kv², as multiple choice
    const v = Math.sqrt(mass * g / kk);
    const m = numMC(v, [mass * g / kk, Math.sqrt(g / kk), Math.sqrt(kk / (mass * g)), mass * g / (kk * kk)], 3);
    return { q:'A body of mass <b>' + mass + ' kg</b> falls from rest against air resistance of <b>' + kk + 'v²</b> newtons, with g = 9.8 m s' + sup(-2) + '. What is its terminal velocity, in m s' + sup(-1) + '?',
      choices:m.choices, answer:m.answer, data:{ kind:'res-term2', mass, k:kk, g },
      note:'At terminal velocity the resistance balances the weight: ' + kk + 'v² = ' + mass + ' × 9.8, so v = √(' + rd(mass * g / kk, 3) + ') = ' + rd(v, 3) + '. Forgetting the square root gives ' + rd(mass * g / kk, 3) + '.' };
  }
  const m = mc('It approaches a terminal velocity, never quite reaching it.',
    ['It keeps accelerating at a constant rate.', 'It slows down and stops.',
     'It reaches terminal velocity after a fixed time, then stays there exactly.',
     'It oscillates about the terminal velocity.']);
  return { q:'An object falls from rest with air resistance proportional to its speed. What happens to the <b>speed</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'res-shape' },
    note:'The acceleration is g − kv, which shrinks as v grows but never turns negative, so v climbs towards g/k without arriving.' };
}

/* ── Mechanics: acceleration as a function of displacement ──────────────── */
function genE2Mech(){
  const k = ri(0, 5);
  if (k === 0){                                   // ẍ = d(½v²)/dx
    const A = ri(2, 9), B = ri(1, 9), x = ri(1, 5);
    const acc = -A * x;                           // v² = C − A x² ⇒ ½v² = C/2 − Ax²/2 ⇒ ẍ = −Ax
    return { q:'A particle moves with <b>v² = ' + (A * x * x + 2 * B) + ' − ' + A + 'x²</b>. Find its <b>acceleration at x = ' + x + '</b>.',
      input:true, answer:acc, accept:qty(acc, { tol:0.05 }), data:{ kind:'mech-accel', A, x },
      note:'ẍ = d(½v²)/dx. Here ½v² = ' + rd((A * x * x + 2 * B) / 2, 3) + ' − ' + fracStr(A, 2) + 'x², so ẍ = −' + A + 'x = ' + neg(acc) + ' at x = ' + x + '.' };
  }
  if (k === 1){                                   // which expression is not the acceleration
    const m = mc('dx/dt', ['dv/dt', 'v dv/dx', 'd(½v²)/dx']);
    return { q:'Which of these is <b>not</b> an expression for the <b>acceleration</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'mech-forms' },
      note:'dx/dt is the velocity. The other three are the three standard forms of acceleration, and the last two are the ones to reach for when the acceleration depends on x.' };
  }
  if (k === 2){                                   // speed gained over a distance
    const A = ri(2, 6), x0 = ri(1, 3), x1 = x0 + ri(1, 4);
    const v0 = ri(1, 5);
    const v1 = Math.sqrt(v0 * v0 + 2 * A * (x1 - x0));
    return { q:'A particle has constant acceleration <b>' + A + ' m s' + sup(-2) + '</b>. It passes <b>x = ' + x0 + ' m</b> at <b>' + v0 + ' m s' + sup(-1) + '</b>. Find its speed at <b>x = ' + x1 + ' m</b>, to 4 decimal places.',
      input:true, answer:rd(v1, 4), accept:qty(v1, { tol:0.0005, dim:'speed' }), data:{ kind:'mech-vx', A, x0, x1, v0 },
      note:'Use ½v² as the thing that integrates: ½v² − ½(' + v0 + ')² = ' + A + '(' + x1 + ' − ' + x0 + '), so v = ' + rd(v1, 4) + '.' };
  }
  if (k === 4){                                   // ẍ = d(½v²)/dx, as multiple choice
    const A = ri(2, 9), B = ri(1, 9), x = ri(1, 5);
    const acc = -A * x;
    const m = numMC(acc, [-2 * A * x, A * x, -A, -A * x * x, 2 * B, -A * x / 2]);
    return { q:'The velocity of a particle satisfies <b>v² = ' + (A * x * x + 2 * B) + ' − ' + A + 'x²</b>. What is its acceleration when <b>x = ' + x + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'mech-accel', A, x },
      note:'ẍ = d(½v²)/dx = d/dx(' + rd((A * x * x + 2 * B) / 2, 3) + ' − ' + rd(A / 2, 1) + 'x²) = −' + A + 'x, which is ' + neg(acc) + ' at x = ' + x + '. Differentiating v² without the ½ doubles it.' };
  }
  if (k === 5){                                   // speed from v dv/dx, as multiple choice
    const A = ri(2, 6), x0 = ri(1, 3), x1 = x0 + ri(1, 4), v0 = ri(1, 5);
    const s = x1 - x0, v1 = Math.sqrt(v0 * v0 + 2 * A * s);
    const m = numMC(v1, [Math.sqrt(v0 * v0 + A * s), Math.sqrt(2 * A * s), v0 * v0 + 2 * A * s, Math.sqrt(v0 * v0 + 2 * A * x1), v0 + A * s], 3);
    return { q:'A particle moves in a straight line with <b>ẍ = ' + A + '</b>. At <b>x = ' + x0 + '</b> its velocity is <b>' + v0 + '</b>. What is its speed at <b>x = ' + x1 + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'mech-vx', A, x0, x1, v0 },
      note:'Write ẍ = d(½v²)/dx = ' + A + ' and integrate from x = ' + x0 + ' to x = ' + x1 + ': ½v² − ½(' + v0 + ')² = ' + A + ' × ' + s + ', so v² = ' + (v0 * v0 + 2 * A * s) + ' and v = ' + rd(v1, 3) + '. The starting point is x = ' + x0 + ', not the origin.' };
  }
  const m = mc('The horizontal speed falls away, so the path is no longer symmetric.',
    ['The path stays a parabola, just a smaller one.',
     'The horizontal speed stays constant, as it does without resistance.',
     'The particle lands further away than it would in a vacuum.',
     'The greatest height is reached later than the landing is.']);
  return { q:'A projectile is fired at an angle, now <b>with</b> air resistance. How does its path differ from the no-resistance case?',
    choices:m.choices, answer:m.answer, data:{ kind:'mech-proj' },
    note:'Resistance acts along the motion, so it eats the horizontal component too. The descent is steeper than the climb and the range is shorter.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
const MODULES_ME2 = [
    { id:'e2-proof', name:'The nature of proof', topics:[
      { id:'e212-lang', name:'Language & notation', gen:genE2Lang },
      { id:'e212-ineq', name:'Inequalities', gen:genE2Ineq },
      { id:'e212-ind', name:'Further induction', gen:genE2Ind }]},
    { id:'e2-vec', name:'Further work with vectors', topics:[
      { id:'e212-vec3', name:'Vectors in 3D', gen:genE2Vec3 },
      { id:'e212-line', name:'Lines in space', gen:genE2Line },
      { id:'e212-sphere', name:'Spheres', gen:genE2Sphere }]},
    { id:'e2-cx', name:'Complex numbers', topics:[
      { id:'e212-cxar', name:'Arithmetic & conjugates', gen:genE2CxArith },
      { id:'e212-cxma', name:'Modulus & argument', gen:genE2CxModArg },
      { id:'e212-cxdm', name:'De Moivre & roots', gen:genE2DeMoivre },
      { id:'e212-cxloc', name:'Curves & regions', gen:genE2Locus }]},
    { id:'e2-int', name:'Further integration', topics:[
      { id:'e212-parts', name:'Integration by parts', gen:genE2Parts },
      { id:'e212-pf', name:'Partial fractions', gen:genE2Partial },
      { id:'e212-tech', name:'Other techniques', gen:genE2Tech }]},
    { id:'e2-mech', name:'Mechanics', topics:[
      { id:'e212-shm', name:'Simple harmonic motion', gen:genE2SHM },
      { id:'e212-res', name:'Resisted motion', gen:genE2Resist },
      { id:'e212-mech', name:'Acceleration & displacement', gen:genE2Mech }]}
];
BUILD.maths12e2 = host => revGame(host, { title:'Maths Extension 2 (Year 12)',
  how:'Pick a focus area, or do the lot. Questions are generated, so they never run out.',
  statKey:'maths12e2', modules:MODULES_ME2 });

GAMES.push({ id:'maths12e2', cat:'Revision', year:12, ico:'ℂ', name:'Maths Extension 2',
  blurb:'Proof, vectors in space, complex numbers, harder integration, mechanics' });

/* every Year 12 generator goes through the minus-sign repair */
[MODULES_MA12, MODULES_ME1, MODULES_ME2].forEach(ms => ms.forEach(m => m.topics.forEach(t => { t.gen = tidyQ(t.gen); })));

if (typeof REVISION_PAGE !== 'undefined' && REVISION_PAGE) showGrid();
