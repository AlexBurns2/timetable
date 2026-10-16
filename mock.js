/* ══════════════════════════════════════════════════════════════════════════
   MOCK HSC

   A timed paper in the shape of the real one: reading time, Section I auto
   marked, Section II written out and then self-marked against criteria worth
   one mark each. Raw marks only — no band is predicted, because a raw mark
   only becomes a band after NESA aligns the whole cohort.

   Loaded after hsc.js, so it has the subject module lists (MODULES_MA12 …)
   and every helper from games.js.

   Paper shapes are the published HSC examination specifications for the 2024
   mathematics syllabuses (first examined 2027). The questions are written for
   this site: nothing is taken from a past paper, a trial paper or a marking
   guideline.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── long-response questions ────────────────────────────────────────────────
   Each returns { mod, q, guide, model }. Every criterion in `guide` is worth
   exactly one mark, so the marks for a question are `guide.length` and
   self-marking never needs a judgement call about half marks. */

const LONG_MA12 = [
  /* optimisation */
  () => {
    const P = ri(12, 30) * 10;                     // perimeter of three sides
    const x = P / 4, area = x * (P - 2 * x);
    return { mod:'ma-apps',
      q:'A rectangular paddock is fenced on three sides, with a long straight river forming the fourth side. There are <b>' + P + ' m</b> of fencing available. The two sides at right angles to the river are each <b>x</b> metres long.' +
        '<br>(a) Show that the area enclosed is A = x(' + P + ' − 2x). <b>(1 mark)</b>' +
        '<br>(b) Find the value of x that makes the area as large as possible, and find that area. <b>(3 marks)</b>',
      guide:['(a) States the third side as ' + P + ' − 2x and writes A = x(' + P + ' − 2x)',
             '(b) Differentiates: A′ = ' + P + ' − 4x',
             '(b) Solves A′ = 0 to get x = ' + x,
             '(b) Justifies a maximum (A″ = −4 < 0, or a sign test) and gives A = ' + area + ' m²'],
      model:'The side parallel to the river is ' + P + ' − 2x, so A = x(' + P + ' − 2x) = ' + P + 'x − 2x². Then A′ = ' + P + ' − 4x, which is zero at x = ' + x + '. A″ = −4 < 0, so this is a maximum, and A = ' + x + ' × ' + (P - 2 * x) + ' = ' + area + ' m².' };
  },
  /* area between curves */
  () => {
    const a = ri(2, 6);
    const area = a * a * a / 6;
    return { mod:'ma-int',
      q:'The curves <b>y = x²</b> and <b>y = ' + a + 'x</b> meet at two points.' +
        '<br>(a) Find the x-coordinates of the two points of intersection. <b>(1 mark)</b>' +
        '<br>(b) Find the exact area enclosed between the curves. <b>(2 marks)</b>',
      guide:['(a) Solves x² = ' + a + 'x to get x = 0 and x = ' + a,
             '(b) Sets up ∫₀' + sup(a) + ' (' + a + 'x − x²) dx with the line on top',
             '(b) Integrates and evaluates to ' + fracStr(a * a * a, 6) + (Number.isInteger(area) ? '' : ' (' + rd(area, 3) + ')') + ' square units'],
      model:'x² = ' + a + 'x gives x(x − ' + a + ') = 0, so x = 0 or x = ' + a + '. Between them the line is above the parabola, so the area is ∫₀' + sup(a) + ' (' + a + 'x − x²) dx = [' + fracStr(a, 2) + 'x² − x³/3]₀' + sup(a) + ' = ' + rd(area, 4) + ' square units.' };
  },
  /* series in context */
  () => {
    const start = ri(3, 9) * 100, step = ri(2, 9) * 10, n = ri(8, 15);
    const last = start + (n - 1) * step, total = n * (start + last) / 2;
    return { mod:'ma-series',
      q:'In the first week of training an athlete runs <b>' + start + ' m</b>, and each week after that she runs <b>' + step + ' m</b> further than the week before.' +
        '<br>(a) How far does she run in week ' + n + '? <b>(1 mark)</b>' +
        '<br>(b) What is the total distance run over the first ' + n + ' weeks? <b>(2 marks)</b>',
      guide:['(a) Uses Tₙ = a + (n − 1)d to get ' + last + ' m',
             '(b) Uses Sₙ = n(a + l)/2 or n[2a + (n − 1)d]/2 with the right values',
             '(b) Arrives at ' + total + ' m'],
      model:'This is an arithmetic sequence with a = ' + start + ' and d = ' + step + '. T' + sub(n) + ' = ' + start + ' + ' + (n - 1) + '×' + step + ' = ' + last + ' m. S' + sub(n) + ' = ' + n + '(' + start + ' + ' + last + ')/2 = ' + total + ' m.' };
  },
  /* tangent to a curve */
  () => {
    const a = ri(2, 5), b = nzr(-6, 6), x0 = ri(1, 4);
    const y0 = a * x0 * x0 + b * x0, grad = 2 * a * x0 + b;
    const c = y0 - grad * x0;
    return { mod:'ma-diff',
      q:'A curve has equation <b>y = ' + xTerm(a, 'x²') + plusTerm(b, 'x') + '</b>.' +
        '<br>(a) Find dy/dx. <b>(1 mark)</b>' +
        '<br>(b) Find the equation of the tangent to the curve at the point where x = ' + x0 + '. <b>(2 marks)</b>',
      guide:['(a) dy/dx = ' + xTerm(2 * a, 'x') + plusTerm(b, ''),
             '(b) Finds the gradient ' + grad + ' and the point (' + x0 + ', ' + neg(y0) + ')',
             '(b) Gives the tangent y = ' + xTerm(grad, 'x') + plusTerm(c, '') + ' (or an equivalent form)'],
      model:'dy/dx = ' + xTerm(2 * a, 'x') + plusTerm(b, '') + '. At x = ' + x0 + ' the gradient is ' + grad + ' and y = ' + neg(y0) + '. Using y − y₁ = m(x − x₁): y = ' + xTerm(grad, 'x') + plusTerm(c, '') + '.' };
  },
  /* the normal distribution */
  () => {
    const mu = ri(50, 80), sd = ri(4, 12), z = pk([1, 2]);
    const lo = mu - z * sd, hi = mu + z * sd, pct = z === 1 ? 68 : 95;
    return { mod:'ma-rv',
      q:'The marks in a test are normally distributed with mean <b>' + mu + '</b> and standard deviation <b>' + sd + '</b>.' +
        '<br>(a) Find the z-score of a mark of <b>' + hi + '</b>. <b>(1 mark)</b>' +
        '<br>(b) Roughly what percentage of students scored between ' + lo + ' and ' + hi + '? <b>(1 mark)</b>' +
        '<br>(c) Roughly what percentage scored above ' + hi + '? <b>(1 mark)</b>',
      guide:['(a) z = (' + hi + ' − ' + mu + ')/' + sd + ' = ' + z,
             '(b) States about ' + pct + '% (the empirical rule for ' + z + ' standard deviation' + (z === 1 ? '' : 's') + ')',
             '(c) Halves what is left outside: about ' + rd((100 - pct) / 2, 1) + '%'],
      model:'z = (x − μ)/σ = ' + z + '. About ' + pct + '% of a normal distribution lies within ' + z + ' standard deviation' + (z === 1 ? '' : 's') + ' of the mean, so about ' + pct + '% scored between ' + lo + ' and ' + hi + '. The remaining ' + (100 - pct) + '% is split evenly between the two tails, so about ' + rd((100 - pct) / 2, 1) + '% scored above ' + hi + '.' };
  },
  /* motion in a straight line */
  () => {
    const a = ri(2, 5), b = ri(2, 9), t1 = ri(2, 4);
    const v = t => 3 * a * t * t - 2 * b * t;         // x = at³ − bt²
    const x = t => a * t * t * t - b * t * t;
    const tRest = rd(2 * b / (3 * a), 4);
    return { mod:'ma-apps',
      q:'A particle moves so that its displacement from the origin is <b>x = ' + xTerm(a, 't³') + ' − ' + xTerm(b, 't²') + '</b> metres after t seconds, for t ≥ 0.' +
        '<br>(a) Find an expression for the velocity. <b>(1 mark)</b>' +
        '<br>(b) Find the times when the particle is at rest. <b>(2 marks)</b>' +
        '<br>(c) Find the acceleration when t = ' + t1 + '. <b>(1 mark)</b>',
      guide:['(a) v = dx/dt = ' + xTerm(3 * a, 't²') + ' − ' + xTerm(2 * b, 't'),
             '(b) Sets v = 0 and factorises: t(' + (3 * a) + 't − ' + (2 * b) + ') = 0',
             '(b) Gives t = 0 and t = ' + tRest + ' seconds',
             '(c) a = ' + xTerm(6 * a, 't') + ' − ' + (2 * b) + ', so at t = ' + t1 + ' the acceleration is ' + (6 * a * t1 - 2 * b) + ' m s' + sup(-2)],
      model:'v = ' + xTerm(3 * a, 't²') + ' − ' + xTerm(2 * b, 't') + ', which is zero when t(' + (3 * a) + 't − ' + (2 * b) + ') = 0, that is t = 0 or t = ' + tRest + ' s. Differentiating again, a = ' + xTerm(6 * a, 't') + ' − ' + (2 * b) + ', so at t = ' + t1 + ' it is ' + (6 * a * t1 - 2 * b) + ' m s' + sup(-2) + '.' };
  },
  /* trigonometric modelling */
  () => {
    const mean = ri(12, 20), amp = ri(2, 6), period = pk([12, 24]);
    const n = rd(2 * Math.PI / period, 4);
    return { mod:'ma-graphs',
      q:'The depth of water at a wharf is modelled by <b>D = ' + mean + ' + ' + amp + ' cos(' + n + 't)</b> metres, where t is the time in hours after midnight.' +
        '<br>(a) Write down the greatest and least depths. <b>(1 mark)</b>' +
        '<br>(b) Find the period of the model, and say what it means here. <b>(2 marks)</b>' +
        '<br>(c) Find the first time after midnight when the depth is ' + mean + ' m. <b>(1 mark)</b>',
      guide:['(a) Greatest ' + (mean + amp) + ' m and least ' + (mean - amp) + ' m',
             '(b) Period = 2π/' + n + ' = ' + rd(period, 1) + ' hours',
             '(b) Explains that the tide repeats every ' + rd(period, 1) + ' hours',
             '(c) Sets cos(' + n + 't) = 0, giving t = ' + rd(period / 4, 3) + ' hours'],
      model:'The cosine runs between −1 and 1, so D runs between ' + (mean - amp) + ' m and ' + (mean + amp) + ' m. The period is 2π/' + n + ' ≈ ' + rd(period, 1) + ' hours, which is how long the tide takes to repeat. D = ' + mean + ' when cos(' + n + 't) = 0, first at ' + n + 't = π/2, so t = ' + rd(period / 4, 3) + ' hours.' };
  },
  /* compound interest and annuities */
  () => {
    const M = ri(2, 9) * 100, pct = pk([4, 5, 6]), n = pk([10, 15, 20]);
    const r = pct / 100, FV = M * (Math.pow(1 + r, n) - 1) / r;
    return { mod:'ma-fin',
      q:money(M) + ' is invested at the <b>end of each year</b> for <b>' + n + ' years</b> in an account paying <b>' + pct + '% per annum</b>, compounded annually.' +
        '<br>(a) Write an expression for the value of the first payment at the end of the ' + n + ' years. <b>(1 mark)</b>' +
        '<br>(b) Find the total value of the investment at the end of the ' + n + ' years. <b>(2 marks)</b>',
      guide:['(a) The first payment earns interest for ' + (n - 1) + ' years: ' + M + '(1.0' + pct + ')' + sup(n - 1),
             '(b) Recognises a geometric series and uses Sₙ = a(rⁿ − 1)/(r − 1)',
             '(b) Arrives at ' + money(FV) + ' (accept ±$1 for rounding)'],
      model:'Each payment compounds for a different number of years, giving ' + M + ' + ' + M + '(1.0' + pct + ') + … + ' + M + '(1.0' + pct + ')' + sup(n - 1) + '. That is a geometric series with a = ' + M + ' and r = 1.0' + pct + ', so the total is ' + M + '(1.0' + pct + sup(n) + ' − 1)/0.0' + pct + ' = ' + money(FV) + '.' };
  },
  /* exponential growth */
  () => {
    const P0 = ri(2, 9) * 1000, pct = ri(3, 12), yrs = ri(5, 20);
    const k = Math.log(1 + pct / 100), P = P0 * Math.exp(k * yrs);
    const dbl = Math.log(2) / k, f = (1 + pct / 100).toFixed(2);
    return { mod:'ma-graphs',
      q:'A town’s population is <b>' + P0 + '</b> and grows by <b>' + pct + '% each year</b>.' +
        '<br>(a) Write a model for the population P after t years. <b>(1 mark)</b>' +
        '<br>(b) Find the population after ' + yrs + ' years, to the nearest whole number. <b>(1 mark)</b>' +
        '<br>(c) How long does the population take to double? <b>(2 marks)</b>',
      guide:['(a) P = ' + P0 + ' × ' + f + '^t, or P = ' + P0 + 'e^(kt) with k = ln ' + f,
             '(b) Gives ' + Math.round(P),
             '(c) Sets the population to ' + (2 * P0) + ' and takes logarithms',
             '(c) Gives about ' + rd(dbl, 2) + ' years'],
      model:'P = ' + P0 + ' × ' + f + '^t. After ' + yrs + ' years that is ' + Math.round(P) + '. Doubling needs ' + f + '^t = 2, so t = ln 2/ln ' + f + ' ≈ ' + rd(dbl, 2) + ' years.' };
  },
  /* the trapezoidal rule */
  () => {
    const h = pk([1, 2]), ys = [ri(2, 9), ri(4, 12), ri(6, 15), ri(4, 12), ri(2, 9)];
    const est = h / 2 * (ys[0] + 2 * (ys[1] + ys[2] + ys[3]) + ys[4]);
    const table = '<div class="rvcode">x    ' + [0, h, 2 * h, 3 * h, 4 * h].map(v => String(v).padEnd(5)).join('') +
                  '\ny    ' + ys.map(v => String(v).padEnd(5)).join('') + '</div>';
    return { mod:'ma-int',
      q:'The table shows values of a function y = f(x).' + table +
        '<br>(a) Use the trapezoidal rule with all five values to estimate ∫₀' + sup(4 * h) + ' f(x) dx. <b>(2 marks)</b>' +
        '<br>(b) The curve is concave down over this interval. Does the estimate over- or under-estimate the integral? <b>(1 mark)</b>',
      guide:['(a) Sets up (h/2)[y₀ + 2(y₁ + y₂ + y₃) + y₄] with h = ' + h,
             '(a) Arrives at ' + rd(est, 3),
             '(b) Says it is an underestimate, because the chords lie below a concave-down curve'],
      model:'With h = ' + h + ', the estimate is (' + h + '/2)[' + ys[0] + ' + 2(' + ys[1] + ' + ' + ys[2] + ' + ' + ys[3] + ') + ' + ys[4] + '] = ' + rd(est, 3) + '. On a concave-down curve each chord sits below the curve, so the trapezoidal rule underestimates.' };
  },
  /* a discrete random variable */
  () => {
    const ps = [2, 3, 4, 1].map(x => x / 10);
    const xs = [0, 1, 2, 3];
    const E = xs.reduce((s, x, i) => s + x * ps[i], 0);
    const E2 = xs.reduce((s, x, i) => s + x * x * ps[i], 0);
    const V = E2 - E * E;
    const table = '<div class="rvcode">x      ' + xs.join('    ') + '\nP(X=x)  ' + ps.map(p => rd(p, 1)).join('  ') + '</div>';
    return { mod:'ma-rv',
      q:'A discrete random variable X has this probability distribution.' + table +
        '<br>(a) Show that the probabilities add to 1. <b>(1 mark)</b>' +
        '<br>(b) Find E(X). <b>(1 mark)</b>' +
        '<br>(c) Find Var(X). <b>(2 marks)</b>',
      guide:['(a) Adds the four probabilities to get 1',
             '(b) E(X) = Σ xP(X = x) = ' + rd(E, 2),
             '(c) Finds E(X²) = ' + rd(E2, 2),
             '(c) Var(X) = E(X²) − [E(X)]² = ' + rd(V, 3)],
      model:'The probabilities add to 1. E(X) = ' + xs.map((x, i) => x + '×' + rd(ps[i], 1)).join(' + ') + ' = ' + rd(E, 2) + '. E(X²) = ' + rd(E2, 2) + ', so Var(X) = ' + rd(E2, 2) + ' − ' + rd(E * E, 2) + ' = ' + rd(V, 3) + '.' };
  },
  /* a loan, by recurrence */
  () => {
    const P = ri(20, 60) * 10000, pct = pk([6, 7, 8]), n = pk([20, 25]);
    const r = pct / 100 / 12, N = n * 12;
    const M = P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
    return { mod:'ma-fin',
      q:'A loan of ' + money(P) + ' is taken out at <b>' + pct + '% per annum, compounded monthly</b>, and repaid with equal monthly repayments of $M over <b>' + n + ' years</b>.' +
        '<br>(a) Write an expression for the amount owing after one repayment. <b>(1 mark)</b>' +
        '<br>(b) Show that the amount owing after n repayments is ' + P + '(1 + r)ⁿ − M[(1 + r)ⁿ − 1]/r. <b>(2 marks)</b>' +
        '<br>(c) Find the monthly repayment. <b>(2 marks)</b>',
      guide:['(a) A₁ = ' + P + '(1 + r) − M, with r = ' + rd(r, 6),
             '(b) Writes A₂ = A₁(1 + r) − M and expands',
             '(b) Identifies the geometric series in M and sums it',
             '(c) Sets the amount owing after ' + N + ' repayments to zero',
             '(c) Solves to get ' + money(M) + ' (accept ±$2 for rounding)'],
      model:'With r = ' + pct + '%/12 = ' + rd(r, 6) + ', A₁ = ' + P + '(1 + r) − M and A₂ = A₁(1 + r) − M = ' + P + '(1 + r)² − M[(1 + r) + 1]. Carrying on, Aₙ = ' + P + '(1 + r)ⁿ − M[(1 + r)ⁿ − 1]/r. Setting A' + sub(N) + ' = 0 gives M = ' + money(M) + '.' };
  }
];

const LONG_ME1 = [
  /* induction */
  () => {
    const s = pk(E1_SERIES.filter(x => x.sumExpr !== '2**(n+1)-2'));
    return { mod:'e1-ind',
      q:'Prove by mathematical induction that <b>' + s.lhs + ' = ' + s.rhs + '</b> for all integers n ≥ 1. <b>(3 marks)</b>',
      guide:['Checks the base case n = 1, showing both sides are equal',
             'States the assumption for n = k and writes the n = k + 1 statement to be proved',
             'Adds the (k + 1)th term to the assumption and rearranges it into ' + s.rhsOf(1) + ', then concludes by induction'],
      model:'Base case: at n = 1 both sides come to the same value. Assume the result at n = k. Adding the next term, ' + s.term(1) + ', to the assumed sum gives ' + s.rhsOf(0) + ' + ' + s.term(1) + ', which factorises to ' + s.rhsOf(1) + ' — the n = k + 1 statement. So by induction the result holds for all n ≥ 1. (A proof with no base case, or with no statement of what is being proved at n = k + 1, loses marks even if the algebra is right.)' };
  },
  /* projectile motion */
  () => {
    const V = ri(20, 45), deg = pk([30, 40, 45, 50, 60]);
    const th = deg * Math.PI / 180, g = 9.8;
    const T = 2 * V * Math.sin(th) / g, R = V * V * Math.sin(2 * th) / g, H = Math.pow(V * Math.sin(th), 2) / (2 * g);
    return { mod:'e1-vec',
      q:'A ball is thrown from ground level at <b>' + V + ' m s' + sup(-1) + '</b> at <b>' + deg + '°</b> to the horizontal. Take g = 9.8 m s' + sup(-2) + ' and ignore air resistance.' +
        '<br>(a) Write down expressions for the horizontal and vertical components of the velocity at time t. <b>(1 mark)</b>' +
        '<br>(b) Find the time of flight. <b>(1 mark)</b>' +
        '<br>(c) Find the horizontal range. <b>(1 mark)</b>' +
        '<br>(d) Find the greatest height reached. <b>(1 mark)</b>',
      guide:['(a) ẋ = ' + rd(V * Math.cos(th), 3) + ' and ẏ = ' + rd(V * Math.sin(th), 3) + ' − 9.8t',
             '(b) Time of flight ' + rd(T, 3) + ' s (from ẏ = 0 doubled, or y = 0)',
             '(c) Range ' + rd(R, 2) + ' m',
             '(d) Greatest height ' + rd(H, 2) + ' m'],
      model:'ẋ stays at ' + V + ' cos ' + deg + '° = ' + rd(V * Math.cos(th), 3) + '; ẏ = ' + V + ' sin ' + deg + '° − 9.8t = ' + rd(V * Math.sin(th), 3) + ' − 9.8t. The vertical velocity is zero at t = ' + rd(T / 2, 3) + ' s, so the flight lasts ' + rd(T, 3) + ' s and the range is ' + rd(V * Math.cos(th), 3) + ' × ' + rd(T, 3) + ' = ' + rd(R, 2) + ' m. The greatest height is V²sin²θ/(2g) = ' + rd(H, 2) + ' m.' };
  },
  /* a differential equation */
  () => {
    const A = ri(15, 25), T0 = A + ri(50, 70), t1 = pk([10, 15]), drop = pk([0.5, 0.6]);
    const T1 = A + (T0 - A) * drop, k = -Math.log(drop) / t1;
    const t2 = t1 * 3, T2 = A + (T0 - A) * Math.exp(-k * t2);
    return { mod:'e1-apps',
      q:'A cup of coffee cools according to <b>dT/dt = −k(T − ' + A + ')</b>, where T is in °C and t in minutes. It starts at <b>' + T0 + '°C</b> and after <b>' + t1 + ' minutes</b> it is <b>' + rd(T1, 1) + '°C</b>.' +
        '<br>(a) Show that T = ' + A + ' + Ae^(−kt) satisfies the equation, and find A. <b>(2 marks)</b>' +
        '<br>(b) Find k. <b>(1 mark)</b>' +
        '<br>(c) Find the temperature after ' + t2 + ' minutes. <b>(1 mark)</b>',
      guide:['(a) Differentiates T = ' + A + ' + Ae^(−kt) and shows dT/dt = −k(T − ' + A + ')',
             '(a) Uses T(0) = ' + T0 + ' to get A = ' + (T0 - A),
             '(b) Substitutes t = ' + t1 + ' and solves for k = ' + rd(k, 5),
             '(c) Gives ' + rd(T2, 1) + '°C'],
      model:'Differentiating T = ' + A + ' + Ae^(−kt) gives dT/dt = −kAe^(−kt) = −k(T − ' + A + '). At t = 0, T = ' + T0 + ', so A = ' + (T0 - A) + '. At t = ' + t1 + ', ' + rd(T1, 1) + ' = ' + A + ' + ' + (T0 - A) + 'e^(−' + t1 + 'k) gives k = ' + rd(k, 5) + '. Then T(' + t2 + ') = ' + rd(T2, 1) + '°C.' };
  },
  /* volumes of revolution */
  () => {
    const n = ri(1, 2), b = ri(2, 4), p = 2 * n + 1;
    const V = Math.PI * Math.pow(b, p) / p;
    return { mod:'e1-apps',
      q:'The region bounded by <b>y = ' + (n === 1 ? 'x' : 'x' + sup(n)) + '</b>, the x-axis and <b>x = ' + b + '</b> is rotated about the <b>x-axis</b>.' +
        '<br>(a) Write down an integral for the volume of the solid formed. <b>(1 mark)</b>' +
        '<br>(b) Find the exact volume. <b>(2 marks)</b>',
      guide:['(a) V = π∫₀' + sup(b) + ' x' + sup(2 * n) + ' dx',
             '(b) Integrates to πx' + sup(p) + '/' + p,
             '(b) Evaluates to ' + piStr(Math.pow(b, p), p)],
      model:'V = π∫y² dx = π∫₀' + sup(b) + ' x' + sup(2 * n) + ' dx = π[x' + sup(p) + '/' + p + ']₀' + sup(b) + ' = ' + piStr(Math.pow(b, p), p) + ' cubic units.' };
  },
  /* the binomial distribution */
  () => {
    const n = ri(8, 15), num = ri(2, 8), pr = num / 10;
    const p0 = Math.pow(1 - pr, n), mean = n * pr, sd = Math.sqrt(n * pr * (1 - pr));
    return { mod:'e1-stats',
      q:'A biased coin shows heads with probability <b>' + pr + '</b>. It is tossed <b>' + n + '</b> times, and X is the number of heads.' +
        '<br>(a) Find P(X = 0). <b>(1 mark)</b>' +
        '<br>(b) Find P(X ≥ 1). <b>(1 mark)</b>' +
        '<br>(c) Find the mean and standard deviation of X. <b>(2 marks)</b>',
      guide:['(a) P(X = 0) = ' + rd(1 - pr, 1) + sup(n) + ' = ' + rd(p0, 4),
             '(b) Uses the complement: 1 − ' + rd(p0, 4) + ' = ' + rd(1 - p0, 4),
             '(c) Mean np = ' + rd(mean, 2),
             '(c) Standard deviation √(np(1 − p)) = ' + rd(sd, 4)],
      model:'X is binomial with n = ' + n + ' and p = ' + pr + '. P(X = 0) = ' + rd(1 - pr, 1) + sup(n) + ' = ' + rd(p0, 4) + ', so P(X ≥ 1) = ' + rd(1 - p0, 4) + '. The mean is np = ' + rd(mean, 2) + ' and the standard deviation is √(np(1 − p)) = ' + rd(sd, 4) + '.' };
  },
  /* related rates */
  () => {
    const rate = ri(10, 50), r = ri(3, 9);
    const dr = rate / (4 * Math.PI * r * r), dA = 8 * Math.PI * r * dr;
    return { mod:'e1-apps',
      q:'A spherical balloon is inflated at a constant <b>' + rate + ' cm³ s' + sup(-1) + '</b>.' +
        '<br>(a) Find the rate at which the radius is increasing when r = ' + r + ' cm. <b>(2 marks)</b>' +
        '<br>(b) Find the rate at which the surface area is increasing at that moment. <b>(2 marks)</b>' +
        '<br><i>(V = 4πr³/3 and S = 4πr².)</i>',
      guide:['(a) dV/dr = 4πr², and links the rates with dV/dt = (dV/dr)(dr/dt)',
             '(a) dr/dt = ' + rd(dr, 5) + ' cm s' + sup(-1),
             '(b) dS/dr = 8πr, and uses dS/dt = (dS/dr)(dr/dt)',
             '(b) dS/dt = ' + rd(dA, 4) + ' cm² s' + sup(-1)],
      model:'dV/dr = 4πr² = ' + rd(4 * Math.PI * r * r, 3) + ', so dr/dt = ' + rate + '/' + rd(4 * Math.PI * r * r, 3) + ' = ' + rd(dr, 5) + ' cm s' + sup(-1) + '. Then dS/dt = 8πr × dr/dt = ' + rd(dA, 4) + ' cm² s' + sup(-1) + '.' };
  },
  /* vectors */
  () => {
    const a = [nzr(-4, 4), nzr(-4, 4)], b = [nzr(-4, 4), nzr(-4, 4)];
    const dot = a[0] * b[0] + a[1] * b[1];
    const ma = Math.hypot(...a), mb = Math.hypot(...b);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI;
    return { mod:'e1-vec',
      q:'Two vectors are <b>a = ' + vecStr(a[0], a[1]) + '</b> and <b>b = ' + vecStr(b[0], b[1]) + '</b>.' +
        '<br>(a) Find a · b. <b>(1 mark)</b>' +
        '<br>(b) Find the angle between a and b, to the nearest degree. <b>(2 marks)</b>',
      guide:['(a) a · b = ' + neg(dot),
             '(b) Uses cos θ = (a · b)/(|a||b|) with |a| = ' + rd(ma, 3) + ' and |b| = ' + rd(mb, 3),
             '(b) θ = ' + Math.round(ang) + '°'],
      model:'a · b = ' + neg(dot) + '. |a| = ' + rd(ma, 3) + ' and |b| = ' + rd(mb, 3) + ', so cos θ = ' + neg(dot) + '/(' + rd(ma, 3) + ' × ' + rd(mb, 3) + ') and θ = ' + Math.round(ang) + '°.' };
  },
  /* integration by substitution */
  () => {
    const c = ri(1, 5), n = ri(2, 4), b = ri(1, 3);
    const F = x => Math.pow(x * x + c, n + 1) / (2 * (n + 1));
    const val = F(b) - F(0);
    return { mod:'e1-calc',
      q:'Evaluate <b>∫₀' + sup(b) + ' x(x² + ' + c + ')' + sup(n) + ' dx</b> using the substitution u = x² + ' + c + '. <b>(3 marks)</b>',
      guide:['States du = 2x dx and changes the limits to u = ' + c + ' and u = ' + (b * b + c),
             'Rewrites the integral as ½∫u' + sup(n) + ' du',
             'Evaluates to ' + rd(val, 4)],
      model:'With u = x² + ' + c + ', du = 2x dx, and the limits become u = ' + c + ' to u = ' + (b * b + c) + '. The integral is ½∫u' + sup(n) + ' du = [u' + sup(n + 1) + '/' + (2 * (n + 1)) + '], giving ' + rd(val, 4) + '. (Changing the limits and then substituting back are both acceptable; marks are lost for keeping x-limits with a u-integral.)' };
  },
  /* polynomials */
  () => {
    const r1 = nzr(-4, 4), r2 = nzr(-4, 4), r3 = nzr(-4, 4);
    const B = -(r1 + r2 + r3), C = r1 * r2 + r1 * r3 + r2 * r3, D = -r1 * r2 * r3;
    return { mod:'e1-y11',
      q:'The cubic <b>' + polyStr([{ c:1, p:3 }, { c:B, p:2 }, { c:C, p:1 }, { c:D, p:0 }]) + ' = 0</b> has roots α, β and γ.' +
        '<br>(a) Write down α + β + γ and αβγ. <b>(2 marks)</b>' +
        '<br>(b) Hence find α² + β² + γ². <b>(2 marks)</b>',
      guide:['(a) α + β + γ = ' + neg(-B),
             '(a) αβγ = ' + neg(-D),
             '(b) Uses α² + β² + γ² = (α + β + γ)² − 2(αβ + αγ + βγ)',
             '(b) Gets ' + neg(B * B - 2 * C)],
      model:'For x³ + bx² + cx + d the roots sum to −b = ' + neg(-B) + ', add in pairs to c = ' + neg(C) + ', and multiply to −d = ' + neg(-D) + '. Then α² + β² + γ² = (' + neg(-B) + ')² − 2(' + neg(C) + ') = ' + neg(B * B - 2 * C) + '.' };
  },
  /* inverse trigonometric functions */
  () => {
    const a = ri(2, 5);
    return { mod:'e1-inv',
      q:'Consider <b>y = ' + a + ' sin' + sup(-1) + '(x/' + a + ')</b>.' +
        '<br>(a) State the domain and range. <b>(2 marks)</b>' +
        '<br>(b) Find dy/dx. <b>(2 marks)</b>',
      guide:['(a) Domain −' + a + ' ≤ x ≤ ' + a,
             '(a) Range ' + neg(piStr(-a, 2)) + ' ≤ y ≤ ' + piStr(a, 2),
             '(b) Uses d/dx sin' + sup(-1) + 'u = u′/√(1 − u²) with u = x/' + a,
             '(b) dy/dx = ' + a + '/√(' + (a * a) + ' − x²)'],
      model:'The inside must satisfy −1 ≤ x/' + a + ' ≤ 1, so the domain is −' + a + ' ≤ x ≤ ' + a + '. sin' + sup(-1) + ' runs over [−π/2, π/2], and multiplying by ' + a + ' gives the range ' + neg(piStr(-a, 2)) + ' ≤ y ≤ ' + piStr(a, 2) + '. Differentiating: dy/dx = ' + a + ' × (1/' + a + ')/√(1 − x²/' + (a * a) + ') = ' + a + '/√(' + (a * a) + ' − x²).' };
  }
];

const LONG_ME2 = [
  /* complex numbers and de Moivre */
  () => {
    const n = pk([4, 6, 8]);
    return { mod:'e2-cx',
      q:'Let <b>z = cos θ + i sin θ</b>.' +
        '<br>(a) Use de Moivre’s theorem to write z' + sup(n) + ' in modulus–argument form. <b>(1 mark)</b>' +
        '<br>(b) Find all solutions of <b>z' + sup(n) + ' = 1</b>, giving the arguments in degrees. <b>(3 marks)</b>',
      guide:['(a) z' + sup(n) + ' = cos ' + n + 'θ + i sin ' + n + 'θ',
             '(b) Writes 1 as cos(360k)° + i sin(360k)°',
             '(b) Gets θ = 360k/' + n + ' degrees',
             '(b) Lists the ' + n + ' distinct solutions, spaced ' + rd(360 / n, 1) + '° apart on the unit circle'],
      model:'z' + sup(n) + ' = cos ' + n + 'θ + i sin ' + n + 'θ. Setting that equal to 1 = cos(360k)° + i sin(360k)° gives ' + n + 'θ = 360k°, so θ = ' + rd(360 / n, 1) + 'k°. Taking k = 0, 1, …, ' + (n - 1) + ' gives the ' + n + ' distinct roots, equally spaced around the unit circle. (Listing more than ' + n + ' “solutions” repeats the same numbers and earns nothing.)' };
  },
  /* a locus */
  () => {
    const a = nzr(-4, 4), b = nzr(-4, 4), r = ri(2, 5);
    const far = Math.hypot(a, b) + r;
    return { mod:'e2-cx',
      q:'On an Argand diagram, z satisfies <b>|z − (' + cx(a, b) + ')| = ' + r + '</b>.' +
        '<br>(a) Describe and sketch the locus. <b>(2 marks)</b>' +
        '<br>(b) Find the greatest value of |z|, as an exact value. <b>(2 marks)</b>',
      guide:['(a) Identifies a circle of radius ' + r + ' centred at (' + neg(a) + ', ' + neg(b) + ')',
             '(a) Sketch shows the centre and radius correctly',
             '(b) Sees that the greatest |z| is the distance from the origin to the centre plus the radius',
             '(b) Gives √' + (a * a + b * b) + ' + ' + r + ' = ' + rd(far, 4)],
      model:'|z − c| = ' + r + ' is the set of points ' + r + ' from c, a circle centred at (' + neg(a) + ', ' + neg(b) + '). The origin is √' + (a * a + b * b) + ' ≈ ' + rd(Math.hypot(a, b), 3) + ' from the centre, so |z| is greatest at the far side of the circle: √' + (a * a + b * b) + ' + ' + r + ' ≈ ' + rd(far, 4) + '.' };
  },
  /* integration by parts */
  () => {
    const b = ri(2, 3);
    const val = (b - 1) * Math.exp(b) + 1;
    return { mod:'e2-int',
      q:'Evaluate <b>∫₀' + sup(b) + ' x e' + sup('ˣ') + ' dx</b>, giving an exact answer. <b>(3 marks)</b>',
      guide:['Chooses u = x and v′ = e^x and writes the parts formula',
             'Reaches [xe^x]₀' + sup(b) + ' − ∫₀' + sup(b) + ' e^x dx',
             'Evaluates to ' + (b - 1 === 1 ? '' : (b - 1) + '') + 'e' + sup(b) + ' + 1 (≈ ' + rd(val, 4) + ')'],
      model:'∫uv′ = uv − ∫u′v with u = x, v = e^x gives xe^x − ∫e^x dx = (x − 1)e^x. Between 0 and ' + b + ' that is ' + (b - 1) + 'e' + sup(b) + ' − (−1) = ' + (b - 1) + 'e' + sup(b) + ' + 1 ≈ ' + rd(val, 4) + '.' };
  },
  /* partial fractions */
  () => {
    const p = ri(1, 3), q = p + ri(2, 4);
    const lo = q + 1, hi = q + ri(2, 4);
    const F = x => (Math.log(Math.abs(x - q)) - Math.log(Math.abs(x - p))) / (q - p);
    const val = F(hi) - F(lo);
    return { mod:'e2-int',
      q:'Evaluate <b>∫</b> from <b>x = ' + lo + '</b> to <b>x = ' + hi + '</b> of <b>dx/((x − ' + p + ')(x − ' + q + '))</b>. <b>(4 marks)</b>',
      guide:['Sets up A/(x − ' + p + ') + B/(x − ' + q + ')',
             'Finds A = ' + fracStr(1, p - q) + ' and B = ' + fracStr(1, q - p),
             'Integrates to ' + fracStr(1, q - p) + ' ln|(x − ' + q + ')/(x − ' + p + ')|',
             'Substitutes the limits to get ' + rd(val, 4)],
      model:'1/((x − ' + p + ')(x − ' + q + ')) = ' + fracStr(1, q - p) + '[1/(x − ' + q + ') − 1/(x − ' + p + ')]. Integrating gives ' + fracStr(1, q - p) + ' ln|(x − ' + q + ')/(x − ' + p + ')|, and between ' + lo + ' and ' + hi + ' that comes to ' + rd(val, 4) + '.' };
  },
  /* simple harmonic motion */
  () => {
    const n = ri(2, 5), amp = ri(2, 8);
    const T = 2 * Math.PI / n, vmax = n * amp, x1 = ri(1, amp - 1);
    const v1 = n * Math.sqrt(amp * amp - x1 * x1);
    return { mod:'e2-mech',
      q:'A particle moves in simple harmonic motion with <b>ẍ = −' + (n * n) + 'x</b> and amplitude <b>' + amp + ' m</b>.' +
        '<br>(a) Show that v² = ' + (n * n) + '(' + (amp * amp) + ' − x²). <b>(2 marks)</b>' +
        '<br>(b) Find the period. <b>(1 mark)</b>' +
        '<br>(c) Find the greatest speed. <b>(1 mark)</b>' +
        '<br>(d) Find the speed when x = ' + x1 + ' m. <b>(1 mark)</b>',
      guide:['(a) Writes ẍ = d(½v²)/dx and integrates to ½v² = −' + fracStr(n * n, 2) + 'x² + c',
             '(a) Uses v = 0 at x = ' + amp + ' to fix c and reach v² = ' + (n * n) + '(' + (amp * amp) + ' − x²)',
             '(b) Period 2π/' + n + ' = ' + rd(T, 4) + ' s',
             '(c) Greatest speed na = ' + vmax + ' m s' + sup(-1) + ' (at the centre)',
             '(d) v = ' + rd(v1, 4) + ' m s' + sup(-1)],
      model:'Writing ẍ = d(½v²)/dx = −' + (n * n) + 'x and integrating gives ½v² = −' + fracStr(n * n, 2) + 'x² + c. The particle is momentarily at rest at the extremes, so v = 0 at x = ' + amp + ', which gives v² = ' + (n * n) + '(' + (amp * amp) + ' − x²). The period is 2π/' + n + ' = ' + rd(T, 4) + ' s, the greatest speed is ' + vmax + ' m s' + sup(-1) + ' at the centre, and at x = ' + x1 + ' the speed is ' + rd(v1, 4) + ' m s' + sup(-1) + '.' };
  },
  /* resisted motion */
  () => {
    const kr = rd(ri(2, 8) / 10, 1), t = rd(ri(10, 40) / 10, 1);
    const g = 9.8, vT = g / kr, v = vT * (1 - Math.exp(-kr * t));
    return { mod:'e2-mech',
      q:'A particle falls from rest with <b>v̇ = 9.8 − ' + kr + 'v</b>, where v is in m s' + sup(-1) + '.' +
        '<br>(a) Find the terminal velocity. <b>(1 mark)</b>' +
        '<br>(b) Show that v = ' + rd(vT, 4) + '(1 − e^(−' + kr + 't)). <b>(3 marks)</b>' +
        '<br>(c) Find the speed after ' + t + ' s. <b>(1 mark)</b>',
      guide:['(a) Sets v̇ = 0: terminal velocity ' + rd(vT, 4) + ' m s' + sup(-1),
             '(b) Separates the variables: ∫dv/(9.8 − ' + kr + 'v) = ∫dt',
             '(b) Integrates to −(1/' + kr + ')ln|9.8 − ' + kr + 'v| = t + c',
             '(b) Uses v = 0 at t = 0 and rearranges to the required form',
             '(c) v = ' + rd(v, 4) + ' m s' + sup(-1)],
      model:'Terminal velocity is where the acceleration dies: 9.8 = ' + kr + 'v, so v = ' + rd(vT, 4) + ' m s' + sup(-1) + '. Separating, ∫dv/(9.8 − ' + kr + 'v) = ∫dt gives −(1/' + kr + ')ln(9.8 − ' + kr + 'v) = t + c; with v = 0 at t = 0, c = −(1/' + kr + ')ln 9.8, and rearranging gives v = ' + rd(vT, 4) + '(1 − e^(−' + kr + 't)). At t = ' + t + ', v = ' + rd(v, 4) + ' m s' + sup(-1) + '.' };
  },
  /* vectors and a sphere */
  () => {
    const c = [ri(-4, 4), ri(-4, 4), ri(-4, 4)], R = ri(3, 7);
    const t = pk(E1_TRIP3);
    const P = [c[0] + t[0], c[1] + t[1], c[2] + t[2]];
    const where = t[3] < R ? 'inside' : t[3] > R ? 'outside' : 'on';
    return { mod:'e2-vec',
      q:'A sphere has centre <b>C(' + neg(c.join(', ')) + ')</b> and radius <b>' + R + '</b>.' +
        '<br>(a) Write down its vector equation and its Cartesian equation. <b>(2 marks)</b>' +
        '<br>(b) Determine whether <b>P(' + neg(P.join(', ')) + ')</b> lies inside, on or outside the sphere. <b>(2 marks)</b>',
      guide:['(a) |r − c| = ' + R + ' with c = (' + neg(c.join(', ')) + ')',
             '(a) (x ' + signed(-c[0]) + ')² + (y ' + signed(-c[1]) + ')² + (z ' + signed(-c[2]) + ')² = ' + (R * R),
             '(b) Finds |CP| = ' + t[3],
             '(b) Compares with ' + R + ' and concludes P is ' + where + ' the sphere'],
      model:'The sphere is |r − c| = ' + R + ', or (x ' + signed(-c[0]) + ')² + (y ' + signed(-c[1]) + ')² + (z ' + signed(-c[2]) + ')² = ' + (R * R) + '. |CP| = √(' + (t[0] * t[0]) + ' + ' + (t[1] * t[1]) + ' + ' + (t[2] * t[2]) + ') = ' + t[3] + ', which is ' + (t[3] === R ? 'exactly the radius, so P lies on the sphere' : t[3] < R ? 'less than ' + R + ', so P is inside' : 'more than ' + R + ', so P is outside') + '.' };
  },
  /* proof of an inequality */
  () => {
    const c = pk([4, 9, 16, 25]);
    return { mod:'e2-proof',
      q:'Prove that <b>x + ' + c + '/x ≥ ' + (2 * Math.sqrt(c)) + '</b> for all <b>x > 0</b>, and state when equality holds. <b>(3 marks)</b>',
      guide:['Starts from a true statement such as (√x − ' + Math.sqrt(c) + '/√x)² ≥ 0, or uses AM–GM correctly',
             'Expands and rearranges without dividing by anything that could be negative or zero',
             'States that equality holds exactly when x = ' + Math.sqrt(c)],
      model:'For x > 0, (√x − ' + Math.sqrt(c) + '/√x)² ≥ 0. Expanding gives x − ' + (2 * Math.sqrt(c)) + ' + ' + c + '/x ≥ 0, that is x + ' + c + '/x ≥ ' + (2 * Math.sqrt(c)) + '. Equality needs the square to be zero, so x = ' + Math.sqrt(c) + '. (Multiplying through by x is only valid because x > 0 — a proof that divides by a possibly negative quantity loses the mark.)' };
  },
  /* induction with an inequality */
  () => {
    const e = pk(E2_INDINEQ);
    return { mod:'e2-proof',
      q:'Prove by mathematical induction that <b>' + e.claim + '</b> for all integers n ≥ ' + e.from + '. <b>(3 marks)</b>',
      guide:['Checks the base case n = ' + e.from,
             'Assumes the result at n = k ≥ ' + e.from + ' and states what must be shown at n = k + 1',
             'Completes the step with a valid chain of inequalities and concludes by induction'],
      model:'Base case: the statement is true at n = ' + e.from + '. Assume it at n = k for some k ≥ ' + e.from + '. The step multiplies or adds to both sides of the assumption and then compares the result with the n = k + 1 statement, using k ≥ ' + e.from + ' to justify the final comparison. By induction it holds for all n ≥ ' + e.from + '. (An inequality proof must say where the assumption is used; a step that simply asserts the result earns nothing.)' };
  },
  /* lines in space */
  () => {
    const p = [nzr(-4, 4), nzr(-4, 4), nzr(-4, 4)], d = [nzr(-3, 3), nzr(-3, 3), nzr(-3, 3)];
    const e = [nzr(-3, 3), nzr(-3, 3), nzr(-3, 3)];
    const dotd = d[0] * e[0] + d[1] * e[1] + d[2] * e[2];
    const ang = Math.acos(Math.min(1, Math.abs(dotd) / (Math.hypot(...d) * Math.hypot(...e)))) * 180 / Math.PI;
    const lam = nzr(-3, 3);
    const hit = [p[0] + lam * d[0], p[1] + lam * d[1], p[2] + lam * d[2]];
    return { mod:'e2-vec',
      q:'A line has vector equation <b>r = (' + neg(p.join(', ')) + ') + λ(' + neg(d.join(', ')) + ')</b>.' +
        '<br>(a) Show that the point (' + neg(hit.join(', ')) + ') lies on the line. <b>(1 mark)</b>' +
        '<br>(b) A second line has direction (' + neg(e.join(', ')) + '). Find the acute angle between the two lines, to 1 decimal place. <b>(3 marks)</b>',
      guide:['(a) Shows λ = ' + neg(lam) + ' gives all three coordinates',
             '(b) Uses only the direction vectors in cos θ = (d · e)/(|d||e|)',
             '(b) Computes d · e = ' + neg(dotd) + ', |d| = ' + rd(Math.hypot(...d), 3) + ', |e| = ' + rd(Math.hypot(...e), 3),
             '(b) Takes the acute angle: ' + rd(ang, 1) + '°'],
      model:'Putting λ = ' + neg(lam) + ' into the equation gives exactly (' + neg(hit.join(', ')) + '), so the point is on the line. For the angle, use the directions: cos θ = |d · e|/(|d||e|) = ' + Math.abs(dotd) + '/(' + rd(Math.hypot(...d), 3) + ' × ' + rd(Math.hypot(...e), 3) + '), so θ = ' + rd(ang, 1) + '°. Taking the size of the dot product is what makes the angle acute.' };
  }
];

/* ── the papers ─────────────────────────────────────────────────────────── */
const MOCK_PAPERS = [
  { id:'maths12', name:'Mathematics Advanced', marks:100, mins:180, reading:10,
    mcN:10, sect2:90, group:15, first:11, modules:MODULES_MA12, long:LONG_MA12 },
  { id:'maths12e1', name:'Mathematics Extension 1', marks:70, mins:120, reading:10,
    mcN:10, sect2:60, group:15, first:11, modules:MODULES_ME1, long:LONG_ME1 },
  { id:'maths12e2', name:'Mathematics Extension 2', marks:100, mins:180, reading:10,
    mcN:10, sect2:90, group:15, first:11, modules:MODULES_ME2, long:LONG_ME2 },
  /* Physics Section II is a run of separately numbered questions of 2 to 9
     marks, at least two of them worth 7 to 9 */
  { id:'phys12', name:'Physics', marks:100, mins:180, reading:5,
    mcN:20, sect2:80, first:21, modules:MODULES_PH12, long:LONG_PH12,
    shape:[2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 8] },
  { id:'chem12', name:'Chemistry', marks:100, mins:180, reading:5,
    mcN:20, sect2:80, first:21, modules:MODULES_CH12, long:LONG_CH12,
    shape:[2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 8] },
  /* Engineering Studies Section II is about seven longer questions, with the
     four HSC modules weighted roughly equally */
  { id:'eng12', name:'Engineering Studies', marks:100, mins:180, reading:5,
    mcN:20, sect2:80, first:21, modules:MODULES_EN12, long:LONG_EN12,
    shape:[11, 11, 12, 11, 12, 11, 12] }
];
const mockSpec = id => MOCK_PAPERS.find(p => p.id === id);

/* ── building a paper ───────────────────────────────────────────────────── */
/* Section I is drawn from the same generators as practice, taking only the
   multiple-choice ones and spreading them across the modules. Section II is
   the authored bank, topped up with short generated parts worth two marks. */
function mockBuild(spec){
  const topics = spec.modules.flatMap(m => m.topics.map(t => ({ gen:t.gen, name:t.name, mod:m.id, modName:m.name })));
  const seen = new Set();
  const fresh = (want, tries) => {                 // a question of the kind we want, not already used
    for (let i = 0; i < (tries || 60); i++){
      const t = want.pool ? pk(want.pool) : (want.topic || pk(topics));   // a whole module, not one topic
      let q; try { q = t.gen(); } catch { continue; }
      const text = String(q.q).replace(/\s+/g, ' ');
      if (seen.has(text)) continue;
      if (want.mc && !(q.choices && q.choices.length >= (want.opts || 4))) continue;   // Section I is always four options
      if (want.typed && !q.input) continue;
      seen.add(text);
      return { q, topic:t };
    }
    return null;
  };

  /* one from each module, then round again, drawing from the whole module so a
     topic with no multiple choice can't cost the module its turn. A module that
     has run out of four-option questions drops out of the round instead of
     giving its turn away, and only once every module has run out does a
     question come from anywhere. The round starts at a random module: when the
     questions don't divide evenly (10 over 7 modules), the leftovers would
     otherwise always go to the first few modules in the list. */
  const sec1 = [];
  const addMC = got => sec1.push({ q:got.q.q, choices:got.q.choices, answer:got.q.answer, note:got.q.note,
                                   mod:got.topic.mod, modName:got.topic.modName, marks:1 });
  const pools = spec.modules.map(m => topics.filter(t => t.mod === m.id)).filter(p => p.length);
  const dry = new Set();
  for (let i = ri(0, pools.length - 1); sec1.length < spec.mcN && dry.size < pools.length; i = (i + 1) % pools.length){
    if (dry.has(i)) continue;
    const got = fresh({ mc:true, pool:pools[i] });
    if (got) addMC(got); else dry.add(i);
  }
  for (let i = 0; sec1.length < spec.mcN && i < spec.mcN * 4; i++){
    const got = fresh({ mc:true }) || fresh({ mc:true, opts:3 });
    if (got) addMC(got);
  }

  /* Section II is built question by question so every one lands on exactly the
     marks the real paper gives it. Each starts with authored long-response
     questions and is topped up with short generated parts worth two marks.
     A bank question can appear twice in a paper, with different numbers, but
     no more than that. */
  /* `shape` is the marks for each Section II question, so a paper can have the
     even 15s of a maths paper or the 2-to-8 spread of a science one */
  const shape = spec.shape || Array.from({ length:Math.max(1, Math.round(spec.sect2 / spec.group)) }, () => spec.group);
  const bank = spec.long.slice().sort(() => Math.random() - 0.5);
  const used = new Map();
  let bi = 0;
  const qs = [];
  /* keep a running tally so Section II spreads over the modules the way the
     real paper does, rather than following whatever the bank happened to give */
  const modMarks = {};
  spec.modules.forEach(mm => { modMarks[mm.id] = 0; });
  const shortPart = left => {
    const thin = Object.keys(modMarks).sort((a, b) => modMarks[a] - modMarks[b])[0];
    const pool = topics.filter(x => x.mod === thin);
    const got = (pool.length && fresh({ typed:true, pool })) || fresh({ typed:true });
    if (!got) return null;
    const ans = String(got.q.answer) + (got.q.unit ? ' ' + got.q.unit : '');
    const marks = Math.min(2, left);
    return { mod:got.topic.mod, marks, short:true, q:got.q.q,
      guide: (marks === 2 ? ['Sets out a correct method', 'Gives the correct answer: ' + ans]
                          : ['Gives the correct answer: ' + ans]).map(fixMinus),
      model:fixMinus(got.q.note || ('The answer is ' + ans + '.')) };
  };
  for (let i = 0; i < shape.length; i++){
    const target = shape[i];
    const g = { n:spec.first + i, parts:[], marks:0 };
    for (let guard = 0; guard < bank.length * 2 && g.marks <= target - 4; guard++){
      const f = bank[bi % bank.length];
      bi++;
      if ((used.get(f) || 0) >= 2) continue;
      /* a bank question may come up twice in a paper, but only with different
         numbers — the same words twice would look like a mistake */
      let it = null;
      for (let tryN = 0; tryN < 4 && !it; tryN++){
        let cand; try { cand = f(); } catch { break; }
        const text = String(cand.q).replace(/\s+/g, ' ');
        if (seen.has(text)) continue;
        seen.add(text); it = cand;
      }
      if (!it) continue;
      it.q = fixMinus(it.q); it.model = fixMinus(it.model); it.guide = it.guide.map(fixMinus);
      it.marks = it.guide.length;
      if (g.marks + it.marks > target) continue;            // never overshoot the question
      used.set(f, (used.get(f) || 0) + 1);
      g.parts.push(it); g.marks += it.marks;
      if (modMarks[it.mod] != null) modMarks[it.mod] += it.marks;
    }
    for (let guard = 0; g.marks < target && guard < 40; guard++){
      const part = shortPart(target - g.marks);
      if (!part) break;
      g.parts.push(part); g.marks += part.marks;
      if (modMarks[part.mod] != null) modMarks[part.mod] += part.marks;
    }
    g.parts.sort(() => Math.random() - 0.5);
    qs.push(g);
  }

  const modName = {};
  spec.modules.forEach(m => { modName[m.id] = m.name; });
  return { id:spec.id, name:spec.name, marks:spec.marks, mins:spec.mins, reading:spec.reading,
           sec1, sec2:qs, modName, built:Date.now() };
}

/* ── the game ───────────────────────────────────────────────────────────── */
const MOCK_RUN = 'mk.run';
const mkTime = s => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s % 60).padStart(2, '0');
};
const partLabel = i => '(' + String.fromCharCode(97 + i) + ')';

function mockGame(host){
  head(host, 'Mock HSC', 'A full paper under exam conditions, then marked against criteria. Raw marks only — a band needs the whole state’s marks, not yours.', '<div id="mk"></div>');
  const box = $('mk');
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const localDay = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  let run = null;            // { paper, mode, phase, answers, started, endsAt, readingEnds, marks }
  let tick = null;
  const stopTick = () => { if (tick){ clearInterval(tick); tick = null; } };
  const leaving = e => { e.preventDefault(); e.returnValue = ''; };
  const guard = on => { try { on ? addEventListener('beforeunload', leaving) : removeEventListener('beforeunload', leaving); } catch {} };

  const save = () => { if (run && (run.phase === 'reading' || run.phase === 'writing')) lsSet(MOCK_RUN, run); };

  /* ── screens ── */
  function chooser(){
    stopTick(); guard(false);
    const hist = TT.get('tt.mock_hist', []);
    const rows = (Array.isArray(hist) ? hist : []).slice(0, 12).map(h =>
      '<tr><td>' + esc(h.d) + '</td><td>' + esc(h.s) + '</td><td>' + h.raw + ' / ' + h.max + '</td><td>' + (h.mins != null ? h.mins + ' min' : '—') + '</td></tr>').join('');
    const saved = lsGet(MOCK_RUN);
    box.innerHTML =
      (saved && saved.paper ? '<div class="mkresume"><b>You have a paper in progress</b> — ' + esc(saved.paper.name) +
        ', started ' + esc(new Date(saved.started).toLocaleString()) + '.' +
        '<div class="mkrow"><button type="button" class="btn primary" id="mkres">Carry on</button>' +
        '<button type="button" class="btn" id="mkdrop">Throw it away</button></div></div>' : '') +
      '<div class="mkpick">' + MOCK_PAPERS.map(p =>
        '<button type="button" class="mkcard" data-p="' + p.id + '">' +
          '<span class="mkcn">' + esc(p.name) + '</span>' +
          '<span class="mkcm">' + p.marks + ' marks · ' + (p.mins / 60) + ' hours · ' + p.reading + ' min reading</span>' +
          '<span class="mkcd">Section I — ' + p.mcN + ' multiple choice · Section II — ' + p.sect2 + ' marks</span>' +
        '</button>').join('') + '</div>' +
      (rows ? '<h3 class="mkh">Past attempts</h3><table class="mktab"><thead><tr><th>Date</th><th>Paper</th><th>Mark</th><th>Time</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      '<p class="rvsmall">Papers are generated fresh each time, in the shape of the real one. Nothing here is taken from a past paper.</p>';
    box.querySelectorAll('.mkcard').forEach(b => { b.onclick = () => intro(b.dataset.p); });
    const res = $('mkres'), drop = $('mkdrop');
    if (res) res.onclick = () => { run = saved; resume(); };
    if (drop) drop.onclick = () => { if (confirm('Throw away the paper in progress? Your answers so far are lost.')){ lsSet(MOCK_RUN, null); chooser(); } };
  }

  function intro(id){
    const spec = mockSpec(id);
    box.innerHTML =
      '<div class="mkintro"><h3>' + esc(spec.name) + '</h3>' +
      '<p class="mkspec"><b>' + spec.marks + ' marks</b> · reading time <b>' + spec.reading + ' minutes</b> · working time <b>' + (spec.mins / 60) + ' hours</b></p>' +
      '<ul class="mklist">' +
        '<li>Section I — ' + spec.mcN + ' objective-response questions, ' + spec.mcN + ' marks. Marked for you.</li>' +
        '<li>Section II — ' + spec.sect2 + ' marks. Write your working on paper, as you would in the exam; the boxes are for your answers and anything you want to check later.</li>' +
        '<li>At the end you mark Section II yourself against criteria worth one mark each.</li>' +
      '</ul>' +
      '<div class="mkmode"><button type="button" class="mkm on" data-m="exam">Exam conditions</button>' +
      '<button type="button" class="mkm" data-m="relaxed">No timer</button></div>' +
      '<p class="rvsmall" id="mkmodenote">The clock runs down and the paper is marked when it reaches zero.</p>' +
      '<div class="mkrow"><button type="button" class="btn primary" id="mkgo">Start the paper</button>' +
      '<button type="button" class="btn" id="mkback">Back</button></div></div>';
    let mode = 'exam';
    box.querySelectorAll('.mkm').forEach(b => { b.onclick = () => {
      mode = b.dataset.m;
      box.querySelectorAll('.mkm').forEach(x => x.classList.toggle('on', x === b));
      $('mkmodenote').textContent = mode === 'exam'
        ? 'The clock runs down and the paper is marked when it reaches zero.'
        : 'No clock. Take as long as you like — useful the first time through a paper.';
    }; });
    $('mkback').onclick = chooser;
    $('mkgo').onclick = () => {
      const paper = mockBuild(spec);
      const now = Date.now();
      run = { paper, mode, phase:mode === 'exam' ? 'reading' : 'writing', answers:{}, started:now,
              readingEnds:now + spec.reading * 60000, endsAt:now + (spec.reading + spec.mins) * 60000 };
      if (mode !== 'exam'){ run.readingEnds = now; run.endsAt = null; }
      save(); resume();
    };
  }

  function resume(){
    if (!run || !run.paper) return chooser();
    if (run.phase === 'marking') return marking();
    paper();
  }

  /* ── the paper itself ── */
  function paperHTML(locked){
    const p = run.paper;
    const s1 = p.sec1.map((q, i) =>
      '<div class="mkq" id="mks1-' + i + '"><div class="mkqh"><b>' + (i + 1) + '</b><span class="mkmk">1 mark</span></div>' +
      '<div class="mkqt">' + q.q + '</div>' +
      '<div class="mkopts">' + q.choices.map((c, j) =>
        '<label class="mkopt"><input type="radio" name="s1-' + i + '" value="' + esc(c) + '"' +
        (run.answers['s1-' + i] === c ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
        '<span>' + esc(String.fromCharCode(65 + j)) + '. ' + esc(c) + '</span></label>').join('') +
      '</div></div>').join('');
    const s2 = p.sec2.map(g =>
      '<div class="mkgroup"><h4>Question ' + g.n + ' <span class="mkmk">' + g.marks + ' marks</span></h4>' +
      g.parts.map((part, j) => {
        const key = 's2-' + g.n + '-' + j;
        return '<div class="mkq"><div class="mkqh"><b>' + partLabel(j) + '</b><span class="mkmk">' + part.marks + ' mark' + (part.marks === 1 ? '' : 's') + '</span></div>' +
          '<div class="mkqt">' + part.q + '</div>' +
          '<textarea class="mkta" data-k="' + key + '" rows="' + (part.marks > 2 ? 5 : 3) + '" placeholder="Your answer…"' +
          (locked ? ' disabled' : '') + '>' + esc(run.answers[key] || '') + '</textarea></div>';
      }).join('') + '</div>').join('');
    return '<h3 class="mkh">Section I <span class="mkmk">' + p.sec1.length + ' marks</span></h3>' +
           '<p class="rvsmall">Attempt all questions. Allow about ' + Math.round(p.sec1.length * 1.5) + ' minutes.</p>' + s1 +
           '<h3 class="mkh">Section II <span class="mkmk">' + p.sec2.reduce((s, g) => s + g.marks, 0) + ' marks</span></h3>' +
           '<p class="rvsmall">Attempt all questions. Show relevant mathematical reasoning and/or calculations.</p>' + s2;
  }

  function paper(){
    const p = run.paper, reading = run.phase === 'reading';
    guard(true);
    box.innerHTML =
      '<div class="mkbar"><span class="mkclock" id="mkclock">—</span>' +
      '<span class="mkbarn">' + esc(p.name) + (reading ? ' · reading time' : '') + '</span>' +
      '<span class="mkbarb">' + (reading ? '<button type="button" class="btn primary mkbtn" id="mkskip">Start writing</button>'
                                         : '<button type="button" class="btn primary mkbtn" id="mkdone">Finish and mark</button>') + '</span></div>' +
      '<div class="mkpaper' + (reading ? ' mkreading' : '') + '">' +
      (reading ? '<p class="mknote">Reading time. You can read the whole paper but not write yet.</p>' : '') +
      paperHTML(reading) + '</div>' +
      (reading ? '' : '<div class="mkrow"><button type="button" class="btn primary" id="mkdone2">Finish and mark</button>' +
                      '<button type="button" class="btn" id="mkquit">Leave without marking</button></div>');
    if (!reading){
      box.querySelectorAll('.mkta').forEach(t => {
        t.oninput = () => { run.answers[t.dataset.k] = t.value; };
        t.onblur = save;
      });
      box.querySelectorAll('input[type=radio]').forEach(r => {
        r.onchange = () => { run.answers[r.name] = r.value; save(); };
      });
      const fin = () => { if (confirm('Finish the paper and go to marking?')) toMarking(); };
      $('mkdone').onclick = fin; $('mkdone2').onclick = fin;
      $('mkquit').onclick = () => { if (confirm('Leave the paper? It stays saved, so you can carry on later.')){ save(); guard(false); stopTick(); chooser(); } };
    } else {
      $('mkskip').onclick = () => { startWriting(); };
    }
    startClock();
  }

  /* reading time ends (or is skipped): the working clock starts now */
  function startWriting(){
    run.phase = 'writing';
    run.readingEnds = Date.now();
    run.endsAt = run.mode === 'exam' ? Date.now() + run.paper.mins * 60000 : null;
    save(); paper();
  }

  function startClock(){
    stopTick();
    const el = $('mkclock');
    if (!el) return;
    if (run.mode !== 'exam'){ el.textContent = 'no timer'; el.classList.add('mkfree'); return; }
    const paint = () => {
      const now = Date.now();
      if (run.phase === 'reading'){
        const left = (run.readingEnds - now) / 1000;
        if (left <= 0){ startWriting(); return; }
        el.textContent = 'reading ' + mkTime(left);
        return;
      }
      const left = (run.endsAt - now) / 1000;
      el.textContent = mkTime(left);
      el.classList.toggle('mkwarn', left <= 300);
      if (left <= 0){ stopTick(); toMarking(true); }
    };
    paint();
    tick = setInterval(paint, 1000);
  }

  /* ── marking ── */
  function toMarking(ranOut){
    stopTick(); guard(false);
    run.phase = 'marking';
    run.minsUsed = Math.round((Date.now() - run.started) / 60000);
    run.ticks = run.ticks || {};
    lsSet(MOCK_RUN, null);
    if (ranOut) alert('Time is up. The paper is now ready to mark.');
    marking();
  }

  function marking(){
    const p = run.paper;
    const s1 = p.sec1.map((q, i) => {
      const given = run.answers['s1-' + i];
      const right = given === q.answer;
      return '<div class="mkq ' + (given == null ? 'mkskip' : right ? 'mkright' : 'mkwrong') + '">' +
        '<div class="mkqh"><b>' + (i + 1) + '</b><span class="mkmk">' + (right ? '1' : '0') + ' / 1</span></div>' +
        '<div class="mkqt">' + q.q + '</div>' +
        '<div class="mkans">Your answer: <b>' + esc(given == null ? 'nothing' : given) + '</b>' +
        (right ? '' : '<br>Correct answer: <b>' + esc(q.answer) + '</b>') + '</div>' +
        (q.note ? '<div class="rvnote">' + q.note + '</div>' : '') + '</div>';
    }).join('');
    const s2 = p.sec2.map(g =>
      '<div class="mkgroup"><h4>Question ' + g.n + ' <span class="mkmk">' + g.marks + ' marks</span></h4>' +
      g.parts.map((part, j) => {
        const key = 's2-' + g.n + '-' + j;
        return '<div class="mkq"><div class="mkqh"><b>' + partLabel(j) + '</b><span class="mkmk" id="mkm-' + key + '">0 / ' + part.marks + '</span></div>' +
          '<div class="mkqt">' + part.q + '</div>' +
          '<div class="mkyours"><div class="mkylab">What you wrote</div><pre class="mkpre">' + esc(run.answers[key] || '(nothing)') + '</pre></div>' +
          '<div class="mkmodel"><div class="mkylab">One way to do it</div>' + part.model + '</div>' +
          '<div class="mkcrit"><div class="mkylab">Marking criteria — tick each one you earned</div>' +
          part.guide.map((c, k) =>
            '<label class="mkc"><input type="checkbox" data-k="' + key + '" data-i="' + k + '"' +
            ((run.ticks[key] || [])[k] ? ' checked' : '') + '><span>' + esc(c) + '</span></label>').join('') +
          '</div></div>';
      }).join('') + '</div>').join('');
    const got1 = p.sec1.filter((q, i) => run.answers['s1-' + i] === q.answer).length;
    box.innerHTML =
      '<div class="mkbar"><span class="mkclock mkfree">marking</span>' +
      '<span class="mkbarn">' + esc(p.name) + '</span>' +
      '<span class="mkbarb"><b id="mktot">' + got1 + ' / ' + p.marks + '</b></span></div>' +
      '<p class="mknote">Section I is marked for you. For Section II, tick every criterion your working earned — each is worth one mark. Be strict: a mark you did not earn here is a mark you will not get in November.</p>' +
      '<h3 class="mkh">Section I <span class="mkmk">' + got1 + ' / ' + p.sec1.length + '</span></h3>' + s1 +
      '<h3 class="mkh">Section II</h3>' + s2 +
      '<div class="mkrow"><button type="button" class="btn primary" id="mkrep">See the report</button></div>';
    const retotal = () => {
      let s2got = 0;
      p.sec2.forEach(g => g.parts.forEach((part, j) => {
        const key = 's2-' + g.n + '-' + j;
        const got = (run.ticks[key] || []).filter(Boolean).length;
        s2got += got;
        const el = $('mkm-' + key); if (el) el.textContent = got + ' / ' + part.marks;
      }));
      run.raw = got1 + s2got;
      $('mktot').textContent = run.raw + ' / ' + p.marks;
    };
    box.querySelectorAll('.mkcrit input').forEach(cb => {
      cb.onchange = () => {
        const key = cb.dataset.k;
        run.ticks[key] = run.ticks[key] || [];
        run.ticks[key][+cb.dataset.i] = cb.checked;
        retotal();
      };
    });
    retotal();
    $('mkrep').onclick = report;
    box.scrollIntoView({ block:'start' });
  }

  /* ── the report ── */
  function report(){
    const p = run.paper;
    const got1 = p.sec1.filter((q, i) => run.answers['s1-' + i] === q.answer).length;
    const mods = {};
    const add = (mod, got, max) => { const m = mods[mod] = mods[mod] || { got:0, max:0 }; m.got += got; m.max += max; };
    p.sec1.forEach((q, i) => add(q.mod, run.answers['s1-' + i] === q.answer ? 1 : 0, 1));
    let s2got = 0;
    p.sec2.forEach(g => g.parts.forEach((part, j) => {
      const got = (run.ticks['s2-' + g.n + '-' + j] || []).filter(Boolean).length;
      s2got += got; add(part.mod, got, part.marks);
    }));
    const raw = got1 + s2got;
    const rows = Object.keys(mods).sort((a, b) => mods[a].got / mods[a].max - mods[b].got / mods[b].max).map(k =>
      '<tr><td>' + esc(p.modName[k] || k) + '</td><td>' + mods[k].got + ' / ' + mods[k].max + '</td>' +
      '<td>' + Math.round(mods[k].got / mods[k].max * 100) + '%</td></tr>').join('');
    const weak = Object.keys(mods).filter(k => mods[k].got / mods[k].max < 0.6)
      .sort((a, b) => mods[a].got / mods[a].max - mods[b].got / mods[b].max)
      .slice(0, 3).map(k => p.modName[k] || k);

    if (!run.logged){
      const hist = TT.get('tt.mock_hist', []);
      const list = Array.isArray(hist) ? hist : [];
      list.unshift({ d:localDay(), s:p.name, raw, max:p.marks, mins:run.minsUsed });
      TT.set('tt.mock_hist', list.slice(0, 12));
      run.logged = true;
    }

    box.innerHTML =
      '<div class="mkrepbig"><div class="mkbig">' + raw + ' <span>/ ' + p.marks + '</span></div>' +
      '<p>' + esc(p.name) + ' · ' + Math.round(raw / p.marks * 100) + '%' +
      (run.minsUsed != null ? ' · ' + run.minsUsed + ' minute' + (run.minsUsed === 1 ? '' : 's') : '') + '</p></div>' +
      '<table class="mktab"><thead><tr><th>Section</th><th>Mark</th></tr></thead><tbody>' +
      '<tr><td>Section I</td><td>' + got1 + ' / ' + p.sec1.length + '</td></tr>' +
      '<tr><td>Section II</td><td>' + s2got + ' / ' + (p.marks - p.sec1.length) + '</td></tr></tbody></table>' +
      '<h3 class="mkh">Where the marks went</h3>' +
      '<table class="mktab"><thead><tr><th>Focus area</th><th>Mark</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (weak.length ? '<p class="mkadvice">Worth a practice session' + (weak.length > 1 ? ', weakest first' : '') + ': <b>' + esc(weak.join(', ')) + '</b>.</p>'
                   : '<p class="mkadvice">No focus area came out under 60%.</p>') +
      '<p class="rvsmall">Raw marks only. A raw mark becomes a band after NESA aligns the whole state’s marks, so nothing here predicts one.</p>' +
      '<div class="mkrow"><button type="button" class="btn primary" id="mkagain">Another paper</button>' +
      '<button type="button" class="btn" id="mkback2">Look at the marking again</button></div>';
    $('mkagain').onclick = chooser;
    $('mkback2').onclick = marking;
  }

  chooser();
  return () => { stopTick(); guard(false); save(); };     // tidy up when the game is left
}

BUILD.mockhsc = host => mockGame(host);
GAMES.push({ id:'mockhsc', cat:'Revision', year:12, ico:'⏱️', name:'Mock HSC',
  blurb:'A timed paper, marked against criteria' });

if (typeof REVISION_PAGE !== 'undefined' && REVISION_PAGE) showGrid();
