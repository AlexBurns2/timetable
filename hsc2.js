/* ══════════════════════════════════════════════════════════════════════════
   YEAR 12 SCIENCES

   Loaded after hsc.js and before mock.js, so the mock papers can see the
   module lists. Physics and Chemistry both follow their Stage 6 (2017)
   syllabuses: the 2025 replacements are first examined in 2028 and 2029, after
   the 2027 HSC this site is built for (checked against NESA).

   HSC paper shape for both: 100 marks, 5 minutes reading, 3 hours working;
   Section I is 20 multiple-choice marks and Section II is 80.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── constants, as the HSC data sheet gives them ────────────────────────── */
const PH_G = 6.67e-11;          // N m² kg⁻²
const PH_LIGHT = 3.00e8;        // m s⁻¹
const PH_PLANCK = 6.626e-34;    // J s
const PH_Q = 1.602e-19;         // C
const PH_MASS_E = 9.109e-31;    // kg
const PH_MU0 = 4e-7 * Math.PI;  // T m A⁻¹
const PH_GRAV = 9.8;            // m s⁻² (Physics keeps 9.8; Engineering uses 10)
const PH_M_EARTH = 5.97e24, PH_R_EARTH = 6.371e6;
const PH_WIEN = 2.898e-3;       // m K
const PH_RYDBERG = 1.097e7;     // m⁻¹

/* 3.47 × 10⁵ when that is clearer, a plain number when it is not */
function phSci(x, sf){
  if (!isFinite(x)) return String(x);
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const digits = (sf || 3);
  if (e >= -2 && e <= 4) return neg(String(rd(x, Math.max(0, digits - 1 - e))));
  const m = x / Math.pow(10, e);
  return neg(rd(m, digits - 1) + ' × 10' + sup(e));
}
/* an answer with a unit, and the near misses written the same way */
function phMC(val, unit, wrongs, sf){
  const fmt = x => phSci(x, sf) + (unit ? ' ' + unit : '');
  const a = fmt(val);
  return mc(a, wrongs.filter(w => isFinite(w) && Math.abs(w - val) > Math.abs(val) * 1e-6).map(fmt).filter(w => w !== a));
}

/* ══ PHYSICS — YEAR 12 ════════════════════════════════════════════════════ */

/* ── Module 5: projectile motion ────────────────────────────────────────── */
function genPhProj(){
  const k = ri(0, 4), g = PH_GRAV;
  if (k === 4){                                   // launched horizontally from a height
    const h = ri(10, 80), u = ri(5, 30);
    const t = Math.sqrt(2 * h / g), x = u * t;
    const ask = pk(['time', 'range']);
    const val = ask === 'time' ? t : x;
    return { q:'A ball is thrown <b>horizontally</b> at <b>' + u + ' m s' + sup(-1) + '</b> from the top of a <b>' + h + ' m</b> cliff. Ignoring air resistance, find ' +
        (ask === 'time' ? 'the <b>time</b> it takes to land' : 'how <b>far from the base</b> it lands') + ', to 2 decimal places.',
      input:true, answer:rd(val, 2), accept:qty(val, { tol:0.02, dim:ask === 'time' ? 'time' : 'length' }),
      data:{ kind:'ph-proj-h', h, u, ask },
      note:'Vertically u = 0, so ' + h + ' = ½ × 9.8 × t² gives t = ' + rd(t, 3) + ' s. Horizontally the speed never changes, so x = ' + u + ' × ' + rd(t, 3) + ' = ' + rd(x, 2) + ' m.' };
  }
  const u = ri(15, 50), deg = pk([15, 25, 30, 35, 40, 45, 55, 60, 70]);
  const th = deg * Math.PI / 180, uy = u * Math.sin(th), ux = u * Math.cos(th);
  const T = 2 * uy / g, H = uy * uy / (2 * g), R = u * u * Math.sin(2 * th) / g;
  const lead = 'A projectile is launched from the ground at <b>' + u + ' m s' + sup(-1) + '</b>, <b>' + deg + '°</b> above the horizontal. Ignore air resistance and take g = 9.8 m s' + sup(-2) + '. ';
  if (k === 0) return { q:lead + 'Find its <b>time of flight</b>, to 2 decimal places.',
    input:true, answer:rd(T, 2), accept:qty(T, { tol:0.02, dim:'time' }), data:{ kind:'ph-proj', u, deg, ask:'T' },
    note:'u_y = ' + u + ' sin ' + deg + '° = ' + rd(uy, 2) + ' m s' + sup(-1) + '. It returns to the ground when the vertical displacement is zero, at t = 2u_y/g = ' + rd(T, 2) + ' s.' };
  if (k === 1) return { q:lead + 'Find the <b>maximum height</b> reached, to 2 decimal places.',
    input:true, answer:rd(H, 2), accept:qty(H, { tol:0.02, dim:'length' }), data:{ kind:'ph-proj', u, deg, ask:'H' },
    note:'At the top v_y = 0, so 0 = u_y² − 2gH and H = ' + rd(uy, 2) + '²/(2 × 9.8) = ' + rd(H, 2) + ' m.' };
  if (k === 2) return { q:lead + 'Find its <b>range</b>, to 2 decimal places.',
    input:true, answer:rd(R, 2), accept:qty(R, { tol:0.03, dim:'length' }), data:{ kind:'ph-proj', u, deg, ask:'R' },
    note:'R = u_x × T = ' + rd(ux, 2) + ' × ' + rd(T, 2) + ' = ' + rd(R, 2) + ' m. A launch at ' + (90 - deg) + '° would travel the same distance.' };
  const m = mc('The horizontal velocity stays the same and the vertical velocity changes at 9.8 m s' + sup(-2) + ' downwards.',
    ['Both components stay the same throughout.',
     'Both components change at 9.8 m s' + sup(-2) + '.',
     'The horizontal velocity falls to zero at the top of the flight.',
     'The acceleration is zero at the top of the flight.']);
  return { q:'For a projectile with no air resistance, which statement about its <b>velocity</b> is correct?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-proj-concept' },
    note:'Gravity acts only vertically, so the horizontal component is untouched. At the top only the vertical component is zero — the acceleration is still 9.8 m s' + sup(-2) + ' down.' };
}

/* ── Module 5: circular motion ──────────────────────────────────────────── */
function genPhCirc(){
  const k = ri(0, 4);
  if (k === 0){                                   // speed from period
    const r = ri(2, 20), T = rd(ri(5, 60) / 10, 1);
    const v = 2 * Math.PI * r / T;
    return { q:'An object moves in a circle of radius <b>' + r + ' m</b> with a period of <b>' + T + ' s</b>. Find its <b>speed</b>, to 2 decimal places.',
      input:true, answer:rd(v, 2), accept:qty(v, { tol:0.02, dim:'speed' }), data:{ kind:'ph-circ-v', r, T },
      note:'One lap covers 2πr = ' + rd(2 * Math.PI * r, 2) + ' m in ' + T + ' s, so v = 2πr/T = ' + rd(v, 2) + ' m s' + sup(-1) + '.' };
  }
  if (k === 1){                                   // centripetal force
    const m2 = ri(1, 50) / (Math.random() < 0.5 ? 1 : 10), v = ri(2, 30), r = ri(2, 40);
    const F = m2 * v * v / r;
    return { q:'A <b>' + rd(m2, 1) + ' kg</b> mass travels at <b>' + v + ' m s' + sup(-1) + '</b> in a circle of radius <b>' + r + ' m</b>. Find the <b>centripetal force</b>, to 2 decimal places.',
      input:true, answer:rd(F, 2), accept:qty(F, { tol:Math.max(0.02, F * 0.002) }), data:{ kind:'ph-circ-F', m:m2, v, r },
      note:'F = mv²/r = ' + rd(m2, 1) + ' × ' + (v * v) + '/' + r + ' = ' + rd(F, 2) + ' N, directed towards the centre.' };
  }
  if (k === 2){                                   // a banked track
    const v = ri(10, 40), r = ri(30, 200);
    const th = Math.atan(v * v / (r * PH_GRAV)) * 180 / Math.PI;
    return { q:'A car takes a bend of radius <b>' + r + ' m</b> at <b>' + v + ' m s' + sup(-1) + '</b>. At what <b>angle</b> must the track be banked for no sideways friction to be needed? Give degrees to 2 decimal places.',
      input:true, answer:rd(th, 2), accept:qty(th, { tol:0.02 }), data:{ kind:'ph-circ-bank', v, r },
      note:'tan θ = v²/(rg) = ' + (v * v) + '/(' + r + ' × 9.8) = ' + rd(v * v / (r * PH_GRAV), 4) + ', so θ = ' + rd(th, 2) + '°. The mass of the car makes no difference.' };
  }
  if (k === 3){                                   // a conical pendulum
    const L = rd(ri(5, 25) / 10, 1), deg = pk([15, 20, 25, 30, 40]);
    const th = deg * Math.PI / 180;
    const T = 2 * Math.PI * Math.sqrt(L * Math.cos(th) / PH_GRAV);
    return { q:'A conical pendulum of length <b>' + L + ' m</b> swings at <b>' + deg + '°</b> to the vertical. Find its <b>period</b>, to 3 decimal places.',
      input:true, answer:rd(T, 3), accept:qty(T, { tol:0.003, dim:'time' }), data:{ kind:'ph-circ-cone', L, deg },
      note:'The vertical component of the tension balances the weight and the horizontal component is the centripetal force, which gives T = 2π√(L cos θ/g) = ' + rd(T, 3) + ' s.' };
  }
  const m = mc('towards the centre of the circle', ['along the direction of motion', 'away from the centre of the circle',
    'vertically downwards', 'in whatever direction the object is turning next']);
  return { q:'In uniform circular motion, which way does the <b>net force</b> point?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-circ-concept' },
    note:'The speed is constant but the direction is not, so the acceleration — and the net force — is at right angles to the motion, pointing to the centre.' };
}

/* ── Module 5: torque and work ──────────────────────────────────────────── */
function genPhTorque(){
  const k = ri(0, 2);
  if (k === 0){
    const F = ri(5, 60), r = rd(ri(2, 20) / 10, 1), deg = pk([30, 45, 60, 90]);
    const tau = r * F * Math.sin(deg * Math.PI / 180);
    return { q:'A force of <b>' + F + ' N</b> acts <b>' + r + ' m</b> from a pivot, at <b>' + deg + '°</b> to the lever arm. Find the <b>torque</b>, to 2 decimal places.',
      input:true, answer:rd(tau, 2), accept:qty(tau, { tol:0.02 }), data:{ kind:'ph-torque', F, r, deg },
      note:'τ = rF sin θ = ' + r + ' × ' + F + ' × sin ' + deg + '° = ' + rd(tau, 2) + ' N m. Only the component at right angles to the arm turns anything.' };
  }
  if (k === 1){
    const tau = ri(5, 40), turns = ri(2, 10);
    const W = tau * turns * 2 * Math.PI;
    return { q:'A constant torque of <b>' + tau + ' N m</b> turns a wheel through <b>' + turns + ' complete turns</b>. How much <b>work</b> is done, to the nearest joule?',
      input:true, answer:Math.round(W), accept:qty(W, { tol:Math.max(1, W * 0.002), dim:'work' }), data:{ kind:'ph-torque-work', tau, turns },
      note:'W = τθ with θ in radians: ' + turns + ' turns is ' + rd(turns * 2 * Math.PI, 3) + ' rad, so W = ' + Math.round(W) + ' J.' };
  }
  const m = mc('It is greatest when the force is at right angles to the lever arm.',
    ['It is greatest when the force points along the lever arm.',
     'It does not depend on where the force is applied.',
     'It is the same as the force multiplied by the time.',
     'It is zero whenever the object is turning at a steady rate.']);
  return { q:'Which statement about <b>torque</b> is correct?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-torque-concept' },
    note:'τ = rF sin θ, which peaks at θ = 90°. A force pointing straight at (or away from) the pivot has no turning effect at all.' };
}

/* ── Module 5: gravitational fields ─────────────────────────────────────── */
function genPhGrav(){
  const k = ri(0, 4);
  if (k === 0){                                   // field strength above a planet
    const M = rd(ri(10, 90) / 10, 1) * 1e24, r = ri(2, 20) * 1e6;
    const g = PH_G * M / (r * r);
    return { q:'A planet has mass <b>' + phSci(M) + ' kg</b>. Find the <b>gravitational field strength</b> at a distance of <b>' + phSci(r) + ' m</b> from its centre, to 3 significant figures.',
      input:true, answer:rd(g, 3), accept:qty(g, { tol:Math.max(0.005, g * 0.005) }), data:{ kind:'ph-grav-g', M, r },
      note:'g = GM/r² = (6.67 × 10' + sup(-11) + ' × ' + phSci(M) + ')/(' + phSci(r) + ')² = ' + phSci(g) + ' N kg' + sup(-1) + '.' };
  }
  if (k === 1){                                   // orbital speed
    const h = ri(2, 36) * 1e5;
    const r = PH_R_EARTH + h;
    const v = Math.sqrt(PH_G * PH_M_EARTH / r);
    return { q:'A satellite orbits <b>' + phSci(h) + ' m</b> above the Earth’s surface. Taking the Earth’s mass as 5.97 × 10' + sup(24) + ' kg and its radius as 6.371 × 10⁶ m, find the <b>orbital speed</b>, to 3 significant figures.',
      input:true, answer:phSci(v), accept:qty(v, { tol:v * 0.01, dim:'speed' }),
      data:{ kind:'ph-grav-v', h, r, v },
      note:'The orbital radius is ' + phSci(r) + ' m, and v = √(GM/r) = ' + phSci(v) + ' m s' + sup(-1) + '.' };
  }
  if (k === 2){                                   // Kepler's third law
    const r1 = ri(1, 4) * 1e8, T1 = ri(100, 400);
    const f = pk([2, 3, 4]);
    const r2 = r1 * f;
    const T2 = T1 * Math.pow(f, 1.5);
    return { q:'Two moons orbit the same planet. The first has orbital radius <b>' + phSci(r1) + ' m</b> and period <b>' + T1 + ' days</b>. The second orbits at <b>' + f + ' times</b> that radius. Find its <b>period</b> in days, to 1 decimal place.',
      input:true, answer:rd(T2, 1), accept:qty(T2, { tol:Math.max(0.1, T2 * 0.002) }), data:{ kind:'ph-grav-kepler', T1, f },
      note:'Kepler’s third law gives T² ∝ r³, so T₂ = T₁ × ' + f + sup(3) + '/² = ' + T1 + ' × ' + rd(Math.pow(f, 1.5), 4) + ' = ' + rd(T2, 1) + ' days.' };
  }
  if (k === 3){                                   // gravitational potential energy
    const m2 = ri(100, 2000), r = PH_R_EARTH + ri(1, 20) * 1e5;
    const U = -PH_G * PH_M_EARTH * m2 / r;
    return { q:'Find the <b>gravitational potential energy</b> of a <b>' + m2 + ' kg</b> satellite at a distance of <b>' + phSci(r) + ' m</b> from the Earth’s centre, to 3 significant figures.',
      input:true, answer:phSci(U), accept:qty(U, { tol:Math.abs(U) * 0.01, dim:'work' }), data:{ kind:'ph-grav-U', m:m2, r, U },
      note:'U = −GMm/r = ' + phSci(U) + ' J. It is negative because zero potential energy is defined at infinity, and work must be done to get there.' };
  }
  const m = mc('It is the same for every mass, because the mass cancels out of the equation.',
    ['It is larger for a heavier satellite.', 'It is smaller for a heavier satellite.',
     'It depends on the satellite’s mass but not on its altitude.', 'It cannot be worked out without knowing the mass.']);
  return { q:'Two satellites of different masses orbit at the <b>same altitude</b>. How do their <b>orbital speeds</b> compare?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-grav-concept' },
    note:'Setting GMm/r² = mv²/r cancels the satellite’s mass, leaving v = √(GM/r). Everything at a given radius moves at the same speed.' };
}

/* ── Module 6: charged particles in electric fields ─────────────────────── */
function genPhEfield(){
  const k = ri(0, 4);
  if (k === 0){                                   // field between plates
    const V = ri(50, 5000), d = rd(ri(1, 50) / 1000, 3);
    const E = V / d;
    return { q:'Two parallel plates are <b>' + rd(d * 1000, 1) + ' mm</b> apart with <b>' + V + ' V</b> across them. Find the <b>electric field strength</b> between them, to 3 significant figures.',
      input:true, answer:phSci(E), accept:qty(E, { tol:E * 0.01 }), data:{ kind:'ph-E', V, d },
      note:'E = V/d = ' + V + '/' + d + ' = ' + phSci(E) + ' V m' + sup(-1) + ', uniform everywhere between the plates.' };
  }
  if (k === 1){                                   // force on a charge
    const E = ri(1, 90) * 100, n = ri(1, 3);
    const F = n * PH_Q * E;
    return { q:'A particle carrying <b>' + n + ' elementary charge' + (n === 1 ? '' : 's') + '</b> sits in a field of <b>' + phSci(E) + ' N C' + sup(-1) + '</b>. Find the <b>force</b> on it, to 3 significant figures.',
      input:true, answer:phSci(F), accept:qty(F, { tol:Math.abs(F) * 0.01 }), data:{ kind:'ph-EF', E, n },
      note:'F = qE = ' + n + ' × 1.602 × 10' + sup(-19) + ' × ' + phSci(E) + ' = ' + phSci(F) + ' N.' };
  }
  if (k === 2){                                   // work done accelerating an electron
    const V = ri(100, 9000);
    const W = PH_Q * V;
    const v = Math.sqrt(2 * W / PH_MASS_E);
    const ask = pk(['W', 'v']);
    return { q:'An electron is accelerated from rest through <b>' + V + ' V</b>. Find ' + (ask === 'W' ? 'the <b>work done</b> on it, in joules' : 'its <b>final speed</b>, in m s' + sup(-1)) + ', to 3 significant figures.',
      input:true, answer:phSci(ask === 'W' ? W : v), accept:qty(ask === 'W' ? W : v, { tol:(ask === 'W' ? W : v) * 0.01 }),
      data:{ kind:'ph-Ework', V, ask },
      note:'W = qV = ' + phSci(W) + ' J. All of it becomes kinetic energy, so ½mv² = ' + phSci(W) + ' gives v = ' + phSci(v) + ' m s' + sup(-1) + '.' };
  }
  if (k === 3){                                   // comparing the two fields
    const m = mc('Gravitational fields only attract, while electric fields can attract or repel.',
      ['Both can attract or repel.', 'Both only attract.',
       'Electric fields only attract, while gravitational fields can do both.',
       'Neither depends on the distance between the objects.']);
    return { q:'What is a key difference between <b>gravitational</b> and <b>electric</b> fields?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-E-concept' },
      note:'Mass comes in one sign only, so gravity always pulls. Charge comes in two, so the electric force can go either way. Both follow an inverse square law for point sources.' };
  }
  const V = ri(100, 2000), d = rd(ri(2, 20) / 100, 2), L = rd(ri(2, 10) / 100, 2);
  const E = V / d, a = PH_Q * E / PH_MASS_E;
  const v0 = ri(1, 9) * 1e6, t = L / v0, y = 0.5 * a * t * t;
  return { q:'An electron enters a <b>' + rd(d * 100, 1) + ' cm</b> gap between plates at <b>' + phSci(v0) + ' m s' + sup(-1) + '</b>, parallel to them. The plates are <b>' + rd(L * 100, 1) + ' cm</b> long with <b>' + V + ' V</b> across them. How far is the electron <b>deflected</b> sideways by the time it leaves, to 3 significant figures?',
    input:true, answer:phSci(y), accept:qty(y, { tol:Math.abs(y) * 0.02, dim:'length' }), data:{ kind:'ph-Edeflect', V, d, L, v0 },
    note:'E = V/d = ' + phSci(E) + ' V m' + sup(-1) + ', so a = qE/m = ' + phSci(a) + ' m s' + sup(-2) + '. It is between the plates for t = L/v = ' + phSci(t) + ' s, and y = ½at² = ' + phSci(y) + ' m.' };
}

/* ── Module 6: the motor effect ─────────────────────────────────────────── */
function genPhMotor(){
  const k = ri(0, 3);
  if (k === 0){
    const B = rd(ri(1, 50) / 100, 2), I = rd(ri(5, 100) / 10, 1), L = rd(ri(5, 100) / 100, 2), deg = pk([30, 45, 60, 90]);
    const F = B * I * L * Math.sin(deg * Math.PI / 180);
    return { q:'A wire of length <b>' + L + ' m</b> carries <b>' + I + ' A</b> through a <b>' + B + ' T</b> field, at <b>' + deg + '°</b> to the field. Find the <b>force</b> on it, to 4 decimal places.',
      input:true, answer:rd(F, 4), accept:qty(F, { tol:Math.max(0.0005, F * 0.005) }), data:{ kind:'ph-motor-F', B, I, L, deg },
      note:'F = BIL sin θ = ' + B + ' × ' + I + ' × ' + L + ' × sin ' + deg + '° = ' + rd(F, 4) + ' N.' };
  }
  if (k === 1){                                   // parallel conductors
    const I1 = rd(ri(5, 100) / 10, 1), I2 = rd(ri(5, 100) / 10, 1), r = rd(ri(1, 50) / 100, 2);
    const F = PH_MU0 * I1 * I2 / (2 * Math.PI * r);
    return { q:'Two long parallel wires <b>' + r + ' m</b> apart carry <b>' + I1 + ' A</b> and <b>' + I2 + ' A</b>. Find the <b>force per metre</b> between them, to 3 significant figures.',
      input:true, answer:phSci(F), accept:qty(F, { tol:F * 0.02 }), data:{ kind:'ph-motor-par', I1, I2, r },
      note:'F/L = μ₀I₁I₂/(2πr) = ' + phSci(F) + ' N m' + sup(-1) + '. Currents the same way attract; opposite currents repel.' };
  }
  if (k === 2){                                   // torque on a coil
    const n = ri(10, 200), B = rd(ri(5, 80) / 100, 2), I = rd(ri(5, 50) / 10, 1), A = rd(ri(10, 400) / 10000, 4);
    const tau = n * B * I * A;
    return { q:'A coil of <b>' + n + ' turns</b> and area <b>' + A + ' m²</b> carries <b>' + I + ' A</b> in a <b>' + B + ' T</b> field, with the plane of the coil <b>parallel</b> to the field. Find the <b>torque</b>, to 4 decimal places.',
      input:true, answer:rd(tau, 4), accept:qty(tau, { tol:Math.max(0.0005, tau * 0.005) }), data:{ kind:'ph-motor-torque', n, B, I, A },
      note:'τ = nBIA cos θ, and with the plane parallel to the field θ = 0, so τ = ' + n + ' × ' + B + ' × ' + I + ' × ' + A + ' = ' + rd(tau, 4) + ' N m — the largest it gets.' };
  }
  const m = mc('The force is at right angles to both the current and the field.',
    ['The force is along the current.', 'The force is along the field.',
     'The force is zero whenever the current is at right angles to the field.',
     'The force does not depend on the angle between the current and the field.']);
  return { q:'A current-carrying wire sits in a magnetic field. Which statement about the <b>force</b> on it is correct?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-motor-concept' },
    note:'F = BIL sin θ, and the right-hand rule puts the force perpendicular to both. The force is zero when the current runs <i>along</i> the field, and largest at right angles.' };
}

/* ── Module 6: electromagnetic induction ────────────────────────────────── */
function genPhInduct(){
  const k = ri(0, 3);
  if (k === 0){                                   // flux
    const B = rd(ri(5, 90) / 100, 2), A = rd(ri(5, 200) / 1000, 3), deg = pk([0, 30, 45, 60]);
    const flux = B * A * Math.cos(deg * Math.PI / 180);
    return { q:'A loop of area <b>' + A + ' m²</b> sits in a <b>' + B + ' T</b> field, with the field at <b>' + deg + '°</b> to the normal to the loop. Find the <b>magnetic flux</b>, to 5 decimal places.',
      input:true, answer:rd(flux, 5), accept:qty(flux, { tol:Math.max(1e-5, flux * 0.005) }), data:{ kind:'ph-flux', B, A, deg },
      note:'Φ = BA cos θ = ' + B + ' × ' + A + ' × cos ' + deg + '° = ' + rd(flux, 5) + ' Wb.' };
  }
  if (k === 1){                                   // Faraday's law
    const n = ri(10, 500), dPhi = rd(ri(1, 90) / 1000, 4), dt = rd(ri(1, 50) / 100, 2);
    const emf = n * dPhi / dt;
    return { q:'The flux through a <b>' + n + '-turn</b> coil changes by <b>' + dPhi + ' Wb</b> in <b>' + dt + ' s</b>. Find the <b>size of the induced emf</b>, to 3 decimal places.',
      input:true, answer:rd(emf, 3), accept:qty(emf, { tol:Math.max(0.002, emf * 0.005), dim:'voltage' }), data:{ kind:'ph-faraday', n, dPhi, dt },
      note:'|ε| = N ΔΦ/Δt = ' + n + ' × ' + dPhi + '/' + dt + ' = ' + rd(emf, 3) + ' V. The minus sign in Faraday’s law is Lenz’s law — it gives the direction, not the size.' };
  }
  if (k === 2){                                   // a rod moving through a field
    const B = rd(ri(5, 90) / 100, 2), L = rd(ri(5, 40) / 10, 1), v = ri(1, 30);
    const emf = B * L * v;
    return { q:'A <b>' + L + ' m</b> conducting rod moves at <b>' + v + ' m s' + sup(-1) + '</b> at right angles to a <b>' + B + ' T</b> field. Find the <b>emf</b> induced along it, to 3 decimal places.',
      input:true, answer:rd(emf, 3), accept:qty(emf, { tol:Math.max(0.002, emf * 0.005), dim:'voltage' }), data:{ kind:'ph-rod', B, L, v },
      note:'ε = BLv = ' + B + ' × ' + L + ' × ' + v + ' = ' + rd(emf, 3) + ' V.' };
  }
  const m = mc('in the direction that opposes the change in flux that caused it',
    ['in the direction that increases the flux that caused it',
     'always clockwise when seen from the magnet',
     'in whichever direction makes the current largest',
     'in a direction that depends only on the shape of the coil']);
  return { q:'<b>Lenz’s law</b> says the induced current flows…',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-lenz' },
    note:'Anything else would create energy from nothing: the induced current always fights the change, which is why you feel resistance pushing a magnet into a coil.' };
}

/* ── Module 6: transformers and applications ────────────────────────────── */
function genPhTrans(){
  const k = ri(0, 3);
  const Np = ri(10, 100) * 10, Vp = pk([240, 120, 415, 1000, 11000]);
  if (k === 0){
    const Ns = ri(5, 200) * 10;
    const Vs = Vp * Ns / Np;
    return { q:'An ideal transformer has <b>' + Np + '</b> primary turns and <b>' + Ns + '</b> secondary turns, with <b>' + Vp + ' V</b> across the primary. Find the <b>secondary voltage</b>, to 2 decimal places.',
      input:true, answer:rd(Vs, 2), accept:qty(Vs, { tol:Math.max(0.02, Vs * 0.002), dim:'voltage' }), data:{ kind:'ph-trans-V', Np, Ns, Vp },
      note:'V_s/V_p = N_s/N_p, so V_s = ' + Vp + ' × ' + Ns + '/' + Np + ' = ' + rd(Vs, 2) + ' V. This is a step-' + (Vs > Vp ? 'up' : 'down') + ' transformer.' };
  }
  if (k === 1){
    const Ns = ri(5, 200) * 10, Ip = rd(ri(5, 200) / 10, 1);
    const Is = Ip * Np / Ns;
    return { q:'An ideal transformer has <b>' + Np + '</b> primary turns, <b>' + Ns + '</b> secondary turns and a primary current of <b>' + Ip + ' A</b>. Find the <b>secondary current</b>, to 3 decimal places.',
      input:true, answer:rd(Is, 3), accept:qty(Is, { tol:Math.max(0.002, Is * 0.005) }), data:{ kind:'ph-trans-I', Np, Ns, Ip },
      note:'An ideal transformer passes all the power, so V_pI_p = V_sI_s and I_s = I_p × N_p/N_s = ' + rd(Is, 3) + ' A. Stepping the voltage up steps the current down.' };
  }
  if (k === 2){
    const I = rd(ri(10, 400) / 10, 1), R = rd(ri(1, 50) / 10, 1);
    const P = I * I * R;
    return { q:'A transmission line of resistance <b>' + R + ' Ω</b> carries <b>' + I + ' A</b>. Find the <b>power lost</b> in the line, to 2 decimal places.',
      input:true, answer:rd(P, 2), accept:qty(P, { tol:Math.max(0.02, P * 0.002) }), data:{ kind:'ph-trans-loss', I, R },
      note:'P = I²R = ' + (I * I) + ' × ' + R + ' = ' + rd(P, 2) + ' W. Because the loss goes as the current squared, power is sent at high voltage and low current.' };
  }
  const m = mc('Laminating the core, so eddy currents have less room to circulate.',
    ['Using a solid iron core, so the flux is stronger.',
     'Winding both coils in the same direction.',
     'Using direct current rather than alternating current.',
     'Making the secondary coil thicker than the primary.']);
  return { q:'Which design feature cuts <b>eddy current</b> losses in a transformer?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-eddy' },
    note:'Eddy currents are induced loops in the core that waste energy as heat. Thin laminations separated by insulation break up the paths they would otherwise take.' };
}

/* ── Module 7: the electromagnetic spectrum and spectra ─────────────────── */
function genPhEM(){
  const k = ri(0, 3);
  if (k === 0){                                   // c = fλ
    const which = pk(['f', 'lam']);
    const lam = pk([400e-9, 550e-9, 700e-9, 1e-6, 3e-2, 0.1, 1.5]);
    const f = PH_LIGHT / lam;
    return { q:which === 'f' ? 'Light has a wavelength of <b>' + phSci(lam) + ' m</b>. Find its <b>frequency</b>, to 3 significant figures.'
                             : 'An electromagnetic wave has a frequency of <b>' + phSci(f) + ' Hz</b>. Find its <b>wavelength</b> in metres, to 3 significant figures.',
      input:true, answer:phSci(which === 'f' ? f : lam), accept:qty(which === 'f' ? f : lam, { tol:(which === 'f' ? f : lam) * 0.01 }),
      data:{ kind:'ph-cflam', lam, which },
      note:'c = fλ, so ' + (which === 'f' ? 'f = c/λ = ' + phSci(f) + ' Hz' : 'λ = c/f = ' + phSci(lam) + ' m') + '.' };
  }
  if (k === 1){                                   // Wien's law
    const T = ri(3, 30) * 1000;
    const lam = PH_WIEN / T;
    return { q:'A star’s surface is at <b>' + T + ' K</b>. At what <b>wavelength</b> does it radiate most strongly? Give metres to 3 significant figures.',
      input:true, answer:phSci(lam), accept:qty(lam, { tol:lam * 0.01, dim:'length' }), data:{ kind:'ph-wien', T },
      note:'Wien’s law: λ_max = b/T = 2.898 × 10' + sup(-3) + '/' + T + ' = ' + phSci(lam) + ' m. Hotter stars peak at shorter wavelengths, which is why they look blue.' };
  }
  if (k === 2){                                   // inverse square law
    const I1 = ri(10, 500), r1 = ri(1, 10), f2 = pk([2, 3, 4, 5]);
    const I2 = I1 / (f2 * f2);
    return { q:'The intensity of light from a small source is <b>' + I1 + ' W m' + sup(-2) + '</b> at <b>' + r1 + ' m</b>. What is it at <b>' + (r1 * f2) + ' m</b>? Give 3 significant figures.',
      input:true, answer:phSci(I2), accept:qty(I2, { tol:Math.max(1e-6, I2 * 0.01) }), data:{ kind:'ph-inv2', I1, f2 },
      note:'Intensity falls as 1/r², and the distance is ' + f2 + ' times bigger, so the intensity is ' + (f2 * f2) + ' times smaller: ' + phSci(I2) + ' W m' + sup(-2) + '.' };
  }
  const e = pk([
    { ask:'a hot, dense object such as a filament', a:'a continuous spectrum', w:['an emission line spectrum', 'an absorption line spectrum', 'no spectrum at all'] },
    { ask:'a hot, thin gas', a:'an emission line spectrum', w:['a continuous spectrum', 'an absorption line spectrum', 'a spectrum with no lines'] },
    { ask:'a cool gas in front of a hot, dense source', a:'an absorption line spectrum', w:['a continuous spectrum', 'an emission line spectrum', 'no spectrum at all'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'What kind of spectrum comes from <b>' + e.ask + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-spectra', ask:e.ask },
    note:'Kirchhoff’s three rules: dense and hot gives every wavelength; a thin hot gas gives bright lines at its own wavelengths; a cooler gas in front of a continuous source takes those same wavelengths out again.' };
}

/* ── Module 7: the wave model of light ──────────────────────────────────── */
function genPhWave(){
  const k = ri(0, 3);
  if (k === 0){                                   // double slit, small angle
    const lam = pk([450, 500, 550, 600, 650]) * 1e-9, d = pk([0.1, 0.2, 0.25, 0.5]) * 1e-3, L = ri(1, 5), m2 = ri(1, 4);
    const y = m2 * lam * L / d;
    return { q:'In a double-slit experiment the slits are <b>' + phSci(d) + ' m</b> apart, the screen is <b>' + L + ' m</b> away and the light has wavelength <b>' + (lam * 1e9) + ' nm</b>. How far from the centre is the <b>' + (m2 === 1 ? 'first' : m2 === 2 ? 'second' : m2 === 3 ? 'third' : 'fourth') + ' bright fringe</b>? Give metres to 4 decimal places.',
      input:true, answer:rd(y, 4), accept:qty(y, { tol:Math.max(0.0002, y * 0.01), dim:'length' }), data:{ kind:'ph-dslit', lam, d, L, m:m2 },
      note:'For small angles y = mλL/d = ' + m2 + ' × ' + phSci(lam) + ' × ' + L + '/' + phSci(d) + ' = ' + rd(y, 4) + ' m.' };
  }
  if (k === 1){                                   // a diffraction grating
    const lines = pk([300, 600, 1000]) * 1000, lam = pk([450, 550, 650]) * 1e-9;
    const d = 1 / lines;
    /* only ask for an order that exists: sin θ = mλ/d can never exceed 1 */
    const m2 = ri(1, Math.max(1, Math.min(3, Math.floor(d / lam))));
    const sinth = m2 * lam / d;
    const th = Math.asin(sinth) * 180 / Math.PI;
    return { q:'A grating with <b>' + (lines / 1000) + ' lines per mm</b> is lit by <b>' + (lam * 1e9) + ' nm</b> light. At what <b>angle</b> does the order <b>m = ' + m2 + '</b> maximum appear? Give degrees to 2 decimal places.',
      input:true, answer:rd(th, 2), accept:qty(th, { tol:0.02 }), data:{ kind:'ph-grating', lines, lam, m:m2 },
      note:'The slit spacing is d = 1/' + lines + ' = ' + phSci(d) + ' m, and d sin θ = mλ gives sin θ = ' + rd(sinth, 4) + ', so θ = ' + rd(th, 2) + '°.' };
  }
  if (k === 2){                                   // Malus's law
    const I0 = ri(10, 200), deg = pk([0, 30, 45, 60, 90]);
    const I = I0 * Math.pow(Math.cos(deg * Math.PI / 180), 2);
    return { q:'Polarised light of intensity <b>' + I0 + ' W m' + sup(-2) + '</b> passes through a polariser at <b>' + deg + '°</b> to its plane of polarisation. Find the <b>transmitted intensity</b>, to 2 decimal places.',
      input:true, answer:rd(I, 2), accept:qty(I, { tol:Math.max(0.02, I * 0.005) }), data:{ kind:'ph-malus', I0, deg },
      note:'Malus’s law: I = I₀cos²θ = ' + I0 + ' × cos²' + deg + '° = ' + rd(I, 2) + ' W m' + sup(-2) + '.' };
  }
  const m = mc('Light spreads out and interferes, which only a wave can do.',
    ['Light carries energy in lumps of hf.',
     'Light travels in straight lines.',
     'Light can knock electrons out of a metal surface.',
     'Light slows down in glass.']);
  return { q:'What does the <b>double-slit experiment</b> show about light?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-wave-concept' },
    note:'An interference pattern needs two overlapping waves adding and cancelling. The photoelectric effect is the evidence on the other side of the argument.' };
}

/* ── Module 7: the quantum model of light ───────────────────────────────── */
function genPhQuantum(){
  const k = ri(0, 4);
  if (k === 0){                                   // photon energy
    const lam = pk([200, 400, 550, 700]) * 1e-9;
    const E = PH_PLANCK * PH_LIGHT / lam;
    const ask = pk(['J', 'eV']);
    const val = ask === 'J' ? E : E / PH_Q;
    return { q:'Find the <b>energy of a photon</b> of wavelength <b>' + (lam * 1e9) + ' nm</b>, in ' + (ask === 'J' ? 'joules' : 'electronvolts') + ', to 3 significant figures.',
      input:true, answer:phSci(val), accept:qty(val, ask === 'J' ? { tol:val * 0.01, dim:'work' } : { tol:val * 0.01 }),
      data:{ kind:'ph-photon', lam, ask },
      note:'E = hc/λ = (6.626 × 10' + sup(-34) + ' × 3.00 × 10⁸)/' + phSci(lam) + ' = ' + phSci(E) + ' J, which is ' + phSci(E / PH_Q) + ' eV.' };
  }
  if (k === 1){                                   // photoelectric maximum kinetic energy
    const phi = rd(ri(15, 50) / 10, 1), lam = pk([200, 250, 300, 350]) * 1e-9;
    const E = PH_PLANCK * PH_LIGHT / lam / PH_Q;
    const K = E - phi;
    return { q:'A metal has a work function of <b>' + phi + ' eV</b> and is lit by <b>' + (lam * 1e9) + ' nm</b> light. Find the <b>maximum kinetic energy</b> of the photoelectrons, in eV to 3 decimal places. (A negative answer means none are emitted.)',
      input:true, answer:rd(K, 3), accept:qty(K, { tol:0.01 }), data:{ kind:'ph-photoelec', phi, lam },
      note:'The photon carries ' + rd(E, 3) + ' eV. K_max = hf − φ = ' + rd(E, 3) + ' − ' + phi + ' = ' + rd(K, 3) + ' eV.' };
  }
  if (k === 2){                                   // threshold frequency
    const phi = rd(ri(15, 50) / 10, 1);
    const f0 = phi * PH_Q / PH_PLANCK;
    return { q:'A metal has a work function of <b>' + phi + ' eV</b>. Find its <b>threshold frequency</b>, to 3 significant figures.',
      input:true, answer:phSci(f0), accept:qty(f0, { tol:f0 * 0.01 }), data:{ kind:'ph-threshold', phi },
      note:'At the threshold the photon has just enough energy: hf₀ = φ, so f₀ = ' + phi + ' × 1.602 × 10' + sup(-19) + '/6.626 × 10' + sup(-34) + ' = ' + phSci(f0) + ' Hz.' };
  }
  if (k === 3){                                   // the famous mistake
    const m = mc('The brighter light releases more electrons, each with the same maximum energy.',
      ['The brighter light releases electrons with more energy each.',
       'The brighter light releases fewer but faster electrons.',
       'The brighter light releases no electrons at all.',
       'Brightness makes no difference to anything.']);
    return { q:'Light above the threshold frequency is shone on a metal, then made <b>brighter at the same frequency</b>. What happens?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-bright' },
      note:'Brightness is photons per second, so more electrons come out. The energy of each photon depends on frequency alone, so K_max does not move — this is exactly what the wave model got wrong.' };
  }
  const lam = pk([400, 500, 600]) * 1e-9;
  const p = PH_PLANCK / lam;
  return { q:'Find the <b>momentum of a photon</b> of wavelength <b>' + (lam * 1e9) + ' nm</b>, to 3 significant figures.',
    input:true, answer:phSci(p), accept:qty(p, { tol:p * 0.01 }), data:{ kind:'ph-pmom', lam },
    note:'p = h/λ = 6.626 × 10' + sup(-34) + '/' + phSci(lam) + ' = ' + phSci(p) + ' kg m s' + sup(-1) + '. A photon has momentum without having mass.' };
}

/* ── Module 7: light and special relativity ─────────────────────────────── */
function genPhRel(){
  const k = ri(0, 4);
  const frac = pk([0.5, 0.6, 0.8, 0.9, 0.95, 0.99]);
  const gamma = 1 / Math.sqrt(1 - frac * frac);
  if (k === 0){
    const t0 = ri(1, 60);
    const t = gamma * t0;
    return { q:'A clock on a spacecraft moving at <b>' + frac + 'c</b> records <b>' + t0 + ' s</b> for an event. How long does the event last as measured on <b>Earth</b>? Give 3 decimal places.',
      input:true, answer:rd(t, 3), accept:qty(t, { tol:Math.max(0.003, t * 0.002), dim:'time' }), data:{ kind:'ph-dilate', frac, t0 },
      note:'γ = 1/√(1 − ' + frac + '²) = ' + rd(gamma, 4) + ', and the moving clock runs slow, so t = γt₀ = ' + rd(t, 3) + ' s.' };
  }
  if (k === 1){
    const L0 = ri(10, 200);
    const L = L0 / gamma;
    return { q:'A rod <b>' + L0 + ' m</b> long in its own rest frame flies past at <b>' + frac + 'c</b>. How long is it in the <b>laboratory</b> frame? Give 3 decimal places.',
      input:true, answer:rd(L, 3), accept:qty(L, { tol:Math.max(0.003, L * 0.002), dim:'length' }), data:{ kind:'ph-contract', frac, L0 },
      note:'L = L₀/γ = ' + L0 + '/' + rd(gamma, 4) + ' = ' + rd(L, 3) + ' m. Lengths contract only along the direction of motion.' };
  }
  if (k === 2){
    const m0 = rd(ri(1, 50) / 10, 1);
    const p = gamma * m0 * frac * PH_LIGHT;
    return { q:'Find the <b>relativistic momentum</b> of a <b>' + m0 + ' kg</b> object moving at <b>' + frac + 'c</b>, to 3 significant figures.',
      input:true, answer:phSci(p), accept:qty(p, { tol:p * 0.01 }), data:{ kind:'ph-relp', frac, m0 },
      note:'p = γm₀v = ' + rd(gamma, 4) + ' × ' + m0 + ' × ' + frac + ' × 3.00 × 10⁸ = ' + phSci(p) + ' kg m s' + sup(-1) + '.' };
  }
  if (k === 3){
    const mg = ri(1, 500);
    const E = (mg / 1000) * PH_LIGHT * PH_LIGHT;
    return { q:'How much <b>energy</b> is equivalent to a mass of <b>' + mg + ' g</b>? Give 3 significant figures.',
      input:true, answer:phSci(E), accept:qty(E, { tol:E * 0.01, dim:'work' }), data:{ kind:'ph-emc2', mg },
      note:'E = mc² = ' + (mg / 1000) + ' × (3.00 × 10⁸)² = ' + phSci(E) + ' J.' };
  }
  const m = mc('The laws of physics are the same in every inertial frame, and the speed of light in a vacuum is the same for every observer.',
    ['Everything moves relative to a fixed aether.',
     'The speed of light depends on how fast the source is moving.',
     'Time is the same for all observers.',
     'Only the speed of light is relative; everything else is absolute.']);
  return { q:'What are the <b>two postulates</b> of special relativity?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-postulates' },
    note:'Everything else — dilation, contraction, the lot — follows from those two statements.' };
}

/* ── Module 8: the origin of the elements ───────────────────────────────── */
function genPhStars(){
  const k = ri(0, 3);
  if (k === 0){
    const e = pk([
      { ask:'a main sequence star like the Sun', a:'the proton–proton chain', w:['the CNO cycle', 'the triple alpha process', 'neutron capture in a supernova'] },
      { ask:'a massive main sequence star, hotter in its core', a:'the CNO cycle', w:['the proton–proton chain', 'the triple alpha process', 'nuclear fission'] },
      { ask:'a red giant fusing helium into carbon', a:'the triple alpha process', w:['the proton–proton chain', 'the CNO cycle', 'nuclear fission'] },
      { ask:'elements heavier than iron', a:'neutron capture, mostly in supernovae', w:['the proton–proton chain', 'the CNO cycle', 'the triple alpha process'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Which process makes the energy or the elements in <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-nucleo', ask:e.ask },
      note:'Fusion runs up to iron, where binding energy per nucleon peaks. Past that, fusion costs energy, so heavier elements are built by neutron capture instead.' };
  }
  if (k === 1){
    const e = pk([
      { ask:'hot and very luminous, top left', a:'a blue main sequence star', w:['a red giant', 'a white dwarf', 'a red dwarf'] },
      { ask:'cool but very luminous, top right', a:'a red giant', w:['a blue main sequence star', 'a white dwarf', 'the Sun'] },
      { ask:'hot but very dim, bottom left', a:'a white dwarf', w:['a red giant', 'a blue main sequence star', 'a red dwarf'] },
      { ask:'cool and dim, bottom right of the main sequence', a:'a red dwarf', w:['a white dwarf', 'a red giant', 'a blue supergiant'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'On a Hertzsprung–Russell diagram, what sits <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-hr', ask:e.ask },
      note:'The axes are temperature (increasing to the left) against luminosity. The main sequence runs from hot and bright at the top left down to cool and dim at the bottom right.' };
  }
  if (k === 2){                                   // luminosity from the Stefan-Boltzmann relation
    const f = pk([2, 3, 4]), g = pk([2, 3]);
    const ratio = f * f * Math.pow(g, 4);
    return { q:'Star A has <b>' + f + ' times</b> the radius of star B and <b>' + g + ' times</b> its surface temperature. How many times more <b>luminous</b> is star A?',
      input:true, answer:ratio, accept:qty(ratio, { tol:0.5 }), data:{ kind:'ph-lum', f, g },
      note:'L ∝ r²T⁴, so the ratio is ' + f + '² × ' + g + '⁴ = ' + (f * f) + ' × ' + Math.pow(g, 4) + ' = ' + ratio + '.' };
  }
  const m = mc('Hydrogen and helium, made in the first few minutes after the Big Bang.',
    ['Carbon and oxygen, made in the first stars.',
     'Iron, made in supernovae.',
     'Equal amounts of every element.',
     'Only hydrogen, with everything else made later.']);
  return { q:'Which elements made up almost all the <b>ordinary matter</b> in the early universe?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-bbn' },
    note:'Big Bang nucleosynthesis made roughly three quarters hydrogen and a quarter helium by mass, with traces of lithium. Everything heavier was made later, inside stars.' };
}

/* ── Module 8: the structure of the atom ────────────────────────────────── */
function genPhAtom(){
  const k = ri(0, 3);
  if (k === 0){                                   // Bohr energy levels
    const n = ri(2, 6);
    const E = -13.6 / (n * n);
    return { q:'In the Bohr model of hydrogen, find the <b>energy of the n = ' + n + ' level</b>, in eV to 3 decimal places.',
      input:true, answer:rd(E, 3), accept:qty(E, { tol:0.005 }), data:{ kind:'ph-bohr', n },
      note:'E_n = −13.6/n² = −13.6/' + (n * n) + ' = ' + rd(E, 3) + ' eV. It is negative because the electron is bound.' };
  }
  if (k === 1){                                   // a transition
    const n2 = ri(3, 6), n1 = ri(1, n2 - 1);
    const dE = 13.6 * (1 / (n1 * n1) - 1 / (n2 * n2));
    const lam = PH_PLANCK * PH_LIGHT / (dE * PH_Q);
    const ask = pk(['E', 'lam']);
    return { q:'An electron in hydrogen falls from <b>n = ' + n2 + '</b> to <b>n = ' + n1 + '</b>. Find ' + (ask === 'E' ? 'the <b>energy of the photon</b> emitted, in eV to 3 decimal places' : 'the <b>wavelength</b> of the photon emitted, in metres to 3 significant figures') + '.',
      input:true, answer:ask === 'E' ? rd(dE, 3) : phSci(lam), accept:qty(ask === 'E' ? dE : lam, { tol:ask === 'E' ? 0.01 : lam * 0.01 }),
      data:{ kind:'ph-transition', n1, n2, ask },
      note:'ΔE = 13.6(1/' + (n1 * n1) + ' − 1/' + (n2 * n2) + ') = ' + rd(dE, 3) + ' eV, and λ = hc/E = ' + phSci(lam) + ' m.' };
  }
  if (k === 2){                                   // de Broglie
    const v = pk([1, 2, 5]) * 1e6;
    const lam = PH_PLANCK / (PH_MASS_E * v);
    return { q:'Find the <b>de Broglie wavelength</b> of an electron moving at <b>' + phSci(v) + ' m s' + sup(-1) + '</b>, to 3 significant figures.',
      input:true, answer:phSci(lam), accept:qty(lam, { tol:lam * 0.01, dim:'length' }), data:{ kind:'ph-debroglie', v },
      note:'λ = h/mv = 6.626 × 10' + sup(-34) + '/(9.109 × 10' + sup(-31) + ' × ' + phSci(v) + ') = ' + phSci(lam) + ' m.' };
  }
  const e = pk([
    { ask:'Rutherford’s gold foil experiment', a:'the atom has a tiny, dense, positive nucleus', w:['electrons orbit in fixed energy levels', 'the atom is a positive pudding with electrons in it', 'electrons behave as waves'] },
    { ask:'Bohr’s model', a:'electrons sit in fixed energy levels and emit a photon when they drop between them', w:['the atom has a dense nucleus', 'electrons are spread evenly through the atom', 'the nucleus contains neutrons'] },
    { ask:'de Broglie’s hypothesis', a:'matter has a wavelength, which explains why only whole numbers of waves fit an orbit', w:['the atom has a dense nucleus', 'light comes in photons', 'the nucleus can split'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'What did <b>' + e.ask + '</b> establish?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-models', ask:e.ask },
    note:'Each model fixed a failing in the one before: Rutherford placed the nucleus, Bohr explained the spectral lines, de Broglie explained why Bohr’s orbits were quantised at all.' };
}

/* ── Module 8: properties of the nucleus ────────────────────────────────── */
function genPhNuclear(){
  const k = ri(0, 4);
  if (k === 0){                                   // half-life
    const T = pk([5, 8, 12, 20, 30, 60]), n = ri(1, 5), N0 = ri(1, 9) * 100;
    const t = T * n, N = N0 / Math.pow(2, n);
    return { q:'A sample starts with <b>' + N0 + ' g</b> of an isotope whose half-life is <b>' + T + ' days</b>. How much is left after <b>' + t + ' days</b>? Give 3 decimal places.',
      input:true, answer:rd(N, 3), accept:qty(N, { tol:Math.max(0.002, N * 0.005), dim:'mass' }), data:{ kind:'ph-half', T, n, N0 },
      note:t + ' days is ' + n + ' half-li' + (n === 1 ? 'fe' : 'ves') + ', so the amount is halved ' + n + ' times: ' + N0 + '/' + Math.pow(2, n) + ' = ' + rd(N, 3) + ' g.' };
  }
  if (k === 1){                                   // how many half-lives
    const T = pk([4, 6, 10, 25]), n = ri(2, 6);
    const frac = 1 / Math.pow(2, n);
    return { q:'An isotope has a half-life of <b>' + T + ' years</b>. How <b>long</b> until only <b>1/' + Math.pow(2, n) + '</b> of a sample is left? Give years.',
      input:true, answer:T * n, accept:qty(T * n, { tol:0.5 }), data:{ kind:'ph-halfn', T, n },
      note:'1/' + Math.pow(2, n) + ' is ' + n + ' halvings, so it takes ' + n + ' × ' + T + ' = ' + (T * n) + ' years.' };
  }
  if (k === 2){                                   // mass defect and binding energy
    const A = ri(4, 60), defect = rd(ri(1, 500) / 1000, 3);
    const E = defect * 1.661e-27 * PH_LIGHT * PH_LIGHT;
    const MeV = E / PH_Q / 1e6;
    return { q:'A nucleus has a <b>mass defect of ' + defect + ' u</b>. Find its <b>binding energy</b> in MeV, to 2 decimal places. (1 u = 1.661 × 10' + sup(-27) + ' kg.)',
      input:true, answer:rd(MeV, 2), accept:qty(MeV, { tol:Math.max(0.02, MeV * 0.005) }), data:{ kind:'ph-binding', defect },
      note:'Δm = ' + defect + ' u = ' + phSci(defect * 1.661e-27) + ' kg, so E = Δmc² = ' + phSci(E) + ' J = ' + rd(MeV, 2) + ' MeV. One atomic mass unit is worth about 931.5 MeV.' };
  }
  if (k === 3){                                   // decay equations
    const e = pk([
      { ask:'alpha decay', a:'the mass number drops by 4 and the atomic number by 2', w:['the mass number stays the same and the atomic number rises by 1', 'the mass number drops by 1 and the atomic number stays the same', 'both numbers stay the same'] },
      { ask:'beta-minus decay', a:'the mass number stays the same and the atomic number rises by 1', w:['the mass number drops by 4 and the atomic number by 2', 'the atomic number drops by 1', 'both numbers drop by 1'] },
      { ask:'gamma decay', a:'both the mass number and the atomic number stay the same', w:['the mass number drops by 4', 'the atomic number rises by 1', 'the atomic number drops by 1'] },
      { ask:'beta-plus decay', a:'the mass number stays the same and the atomic number drops by 1', w:['the atomic number rises by 1', 'the mass number drops by 4 and the atomic number by 2', 'both numbers stay the same'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'In <b>' + e.ask + '</b>, what happens to the mass number and the atomic number?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-decay', ask:e.ask },
      note:'Nucleon number and charge are both conserved. Beta-minus turns a neutron into a proton (plus an electron and an antineutrino), which is why Z goes up but A does not.' };
  }
  const m = mc('Iron, where the binding energy per nucleon is greatest.',
    ['Hydrogen, the lightest nucleus.', 'Uranium, the heaviest common nucleus.',
     'Helium, because it is doubly magic.', 'Carbon, because life is based on it.']);
  return { q:'Which nucleus is the <b>most stable</b>, and the turning point between fusion and fission releasing energy?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-bepn' },
    note:'Binding energy per nucleon peaks near iron-56. Below it, fusing releases energy; above it, splitting does.' };
}

/* ── Module 8: deep inside the atom ─────────────────────────────────────── */
function genPhStandard(){
  const k = ri(0, 3);
  if (k === 0){
    const e = pk([
      { ask:'a proton', a:'two up quarks and one down quark', w:['two down quarks and one up quark', 'three up quarks', 'one up quark and one down quark'] },
      { ask:'a neutron', a:'two down quarks and one up quark', w:['two up quarks and one down quark', 'three down quarks', 'one up quark and one anti-down quark'] },
      { ask:'a meson', a:'one quark and one antiquark', w:['three quarks', 'two quarks', 'three antiquarks'] },
      { ask:'a baryon', a:'three quarks', w:['one quark and one antiquark', 'two quarks', 'a quark and a lepton'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What is <b>' + e.ask + '</b> made of?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-quark', ask:e.ask },
      note:'Quarks come in threes (baryons) or quark–antiquark pairs (mesons). Up carries +⅔ and down −⅓, which is how uud adds to +1 and udd to 0.' };
  }
  if (k === 1){
    const e = pk([
      { ask:'the electron', a:'a lepton', w:['a baryon', 'a meson', 'a quark'] },
      { ask:'the neutrino', a:'a lepton', w:['a baryon', 'a meson', 'a quark'] },
      { ask:'the proton', a:'a baryon', w:['a lepton', 'a meson', 'a quark'] },
      { ask:'the photon', a:'a force-carrying boson', w:['a lepton', 'a baryon', 'a quark'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'In the standard model, what kind of particle is <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-particle', ask:e.ask },
      note:'Matter particles are quarks and leptons; the forces are carried by bosons. Hadrons (baryons and mesons) are made of quarks, so they are not fundamental.' };
  }
  if (k === 2){
    const e = pk([
      { ask:'the strong nuclear force', a:'the gluon', w:['the photon', 'the W and Z bosons', 'the graviton'] },
      { ask:'the electromagnetic force', a:'the photon', w:['the gluon', 'the W and Z bosons', 'the graviton'] },
      { ask:'the weak nuclear force', a:'the W and Z bosons', w:['the photon', 'the gluon', 'the graviton'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Which particle carries <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ph-force', ask:e.ask },
      note:'Gluons bind quarks, photons carry electromagnetism, and the W and Z bosons are behind beta decay. Gravity has no confirmed carrier in the standard model.' };
  }
  const m = mc('to give particles enough energy that new, heavier particles can be created from it',
    ['to slow particles down so they can be seen more easily',
     'to turn particles into light',
     'to cool particles to absolute zero',
     'to separate isotopes by mass']);
  return { q:'Why are <b>particle accelerators</b> used to study the standard model?',
    choices:m.choices, answer:m.answer, data:{ kind:'ph-accel' },
    note:'E = mc² works both ways: enough collision energy can be converted into mass, which is how short-lived heavy particles are made and detected.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
const MODULES_PH12 = [
  { id:'ph-m5', name:'Advanced mechanics', topics:[
    { id:'p12-proj', name:'Projectile motion', gen:genPhProj },
    { id:'p12-circ', name:'Circular motion', gen:genPhCirc },
    { id:'p12-torque', name:'Torque & work', gen:genPhTorque },
    { id:'p12-grav', name:'Gravitational fields', gen:genPhGrav }]},
  { id:'ph-m6', name:'Electromagnetism', topics:[
    { id:'p12-efield', name:'Charges in electric fields', gen:genPhEfield },
    { id:'p12-motor', name:'The motor effect', gen:genPhMotor },
    { id:'p12-induct', name:'Induction', gen:genPhInduct },
    { id:'p12-trans', name:'Transformers', gen:genPhTrans }]},
  { id:'ph-m7', name:'The nature of light', topics:[
    { id:'p12-em', name:'Spectrum & spectra', gen:genPhEM },
    { id:'p12-wave', name:'The wave model', gen:genPhWave },
    { id:'p12-quantum', name:'The quantum model', gen:genPhQuantum },
    { id:'p12-rel', name:'Special relativity', gen:genPhRel }]},
  { id:'ph-m8', name:'Universe to the atom', topics:[
    { id:'p12-stars', name:'Origin of the elements', gen:genPhStars },
    { id:'p12-atom', name:'Structure of the atom', gen:genPhAtom },
    { id:'p12-nucl', name:'The nucleus', gen:genPhNuclear },
    { id:'p12-std', name:'Deep inside the atom', gen:genPhStandard }]}
];
BUILD.phys12 = host => revGame(host, { title:'Physics (Year 12)',
  how:'Modules 5 to 8 of the 2017 syllabus. Pick a module, or do the lot.', statKey:'phys12', modules:MODULES_PH12 });

GAMES.push({ id:'phys12', cat:'Revision', year:12, ico:'🔭', name:'Physics',
  blurb:'Mechanics, electromagnetism, light, the atom' });

/* ── Physics: long-response questions for the mock paper ────────────────── */
const LONG_PH12 = [
  /* projectile motion, worked right through */
  () => {
    const u = ri(20, 45), deg = pk([25, 30, 35, 40, 50]);
    const th = deg * Math.PI / 180, uy = u * Math.sin(th), ux = u * Math.cos(th);
    const T = 2 * uy / PH_GRAV, R = ux * T, H = uy * uy / (2 * PH_GRAV);
    return { mod:'ph-m5',
      q:'A ball is kicked from level ground at <b>' + u + ' m s' + sup(-1) + '</b>, <b>' + deg + '°</b> above the horizontal. Air resistance is negligible and g = 9.8 m s' + sup(-2) + '.' +
        '<br>(a) Calculate the time of flight. <b>(2 marks)</b>' +
        '<br>(b) Calculate the horizontal range. <b>(2 marks)</b>' +
        '<br>(c) Explain why the horizontal component of the velocity does not change. <b>(1 mark)</b>',
      guide:['(a) Resolves the launch velocity: u_y = ' + rd(uy, 2) + ' m s' + sup(-1),
             '(a) Time of flight ' + rd(T, 2) + ' s',
             '(b) Uses the horizontal component with the time of flight',
             '(b) Range ' + rd(R, 1) + ' m',
             '(c) States that gravity acts vertically only, so there is no horizontal acceleration'],
      model:'u_x = ' + u + ' cos ' + deg + '° = ' + rd(ux, 2) + ' m s' + sup(-1) + ' and u_y = ' + rd(uy, 2) + ' m s' + sup(-1) + '. The ball returns to the ground when the vertical displacement is zero, at t = 2u_y/g = ' + rd(T, 2) + ' s, so the range is u_x t = ' + rd(R, 1) + ' m (and the greatest height is ' + rd(H, 1) + ' m). The only force is weight, which is vertical, so the horizontal velocity stays at ' + rd(ux, 2) + ' m s' + sup(-1) + ' the whole way.' };
  },
  /* satellites */
  () => {
    const h = ri(3, 35) * 1e5, r = PH_R_EARTH + h;
    const v = Math.sqrt(PH_G * PH_M_EARTH / r), T = 2 * Math.PI * r / v;
    return { mod:'ph-m5',
      q:'A satellite orbits the Earth at an altitude of <b>' + phSci(h) + ' m</b>. (Earth: mass 5.97 × 10' + sup(24) + ' kg, radius 6.371 × 10⁶ m.)' +
        '<br>(a) Show that the orbital speed is given by v = √(GM/r). <b>(2 marks)</b>' +
        '<br>(b) Calculate the orbital speed and the period. <b>(3 marks)</b>' +
        '<br>(c) A second satellite of twice the mass orbits at the same altitude. Compare their speeds. <b>(1 mark)</b>',
      guide:['(a) Equates the gravitational force with the centripetal force: GMm/r² = mv²/r',
             '(a) Cancels and rearranges to v = √(GM/r)',
             '(b) Uses the orbital radius ' + phSci(r) + ' m, not the altitude',
             '(b) Speed ' + phSci(v) + ' m s' + sup(-1),
             '(b) Period ' + phSci(T) + ' s (from T = 2πr/v)',
             '(c) States the speeds are the same, because the satellite’s mass cancels'],
      model:'Gravity supplies the centripetal force: GMm/r² = mv²/r, and cancelling m and one r gives v = √(GM/r). The orbital radius is 6.371 × 10⁶ + ' + phSci(h) + ' = ' + phSci(r) + ' m, so v = ' + phSci(v) + ' m s' + sup(-1) + ' and T = 2πr/v = ' + phSci(T) + ' s. The satellite’s own mass cancelled out, so a heavier satellite at the same altitude orbits at exactly the same speed.' };
  },
  /* the DC motor */
  () => {
    const n = ri(20, 200), B = rd(ri(10, 90) / 100, 2), I = rd(ri(5, 50) / 10, 1), A = rd(ri(20, 300) / 10000, 4);
    const tau = n * B * I * A;
    return { mod:'ph-m6',
      q:'A simple DC motor has a coil of <b>' + n + ' turns</b> and area <b>' + A + ' m²</b> carrying <b>' + I + ' A</b> in a magnetic field of <b>' + B + ' T</b>.' +
        '<br>(a) Calculate the maximum torque on the coil. <b>(2 marks)</b>' +
        '<br>(b) Explain the role of the split-ring commutator. <b>(2 marks)</b>' +
        '<br>(c) Explain why the torque varies as the coil turns. <b>(2 marks)</b>',
      guide:['(a) Uses τ = nBIA with the plane of the coil parallel to the field',
             '(a) Torque ' + rd(tau, 4) + ' N m',
             '(b) States that it reverses the current in the coil every half turn',
             '(b) Relates this to keeping the torque acting the same way round, so rotation continues',
             '(c) States that τ = nBIA cos θ, with θ the angle between the coil plane and the field',
             '(c) Explains that the torque falls to zero when the coil plane is perpendicular to the field, where momentum carries it past'],
      model:'τ = nBIA = ' + n + ' × ' + B + ' × ' + I + ' × ' + A + ' = ' + rd(tau, 4) + ' N m when the plane of the coil lies along the field. As the coil turns the torque follows cos θ and drops to zero when the plane is at right angles to the field; the commutator reverses the current just as it passes that point, so the force on each side swaps and the turning continues the same way instead of reversing.' };
  },
  /* transmission and transformers */
  () => {
    const Vp = pk([240, 415]), Np = ri(20, 80) * 10, Ns = ri(100, 900) * 10;
    const Vs = Vp * Ns / Np, I = rd(ri(10, 200) / 10, 1), R = rd(ri(5, 40) / 10, 1);
    const loss = I * I * R;
    return { mod:'ph-m6',
      q:'An ideal transformer has <b>' + Np + '</b> primary turns and <b>' + Ns + '</b> secondary turns, with <b>' + Vp + ' V</b> across the primary.' +
        '<br>(a) Calculate the secondary voltage. <b>(2 marks)</b>' +
        '<br>(b) A transmission line of resistance ' + R + ' Ω carries ' + I + ' A. Calculate the power lost in the line. <b>(2 marks)</b>' +
        '<br>(c) Explain why electricity is transmitted at high voltage. <b>(2 marks)</b>',
      guide:['(a) Uses V_s/V_p = N_s/N_p',
             '(a) Secondary voltage ' + rd(Vs, 1) + ' V',
             '(b) Uses P = I²R',
             '(b) Power lost ' + rd(loss, 2) + ' W',
             '(c) States that for a given power, higher voltage means lower current',
             '(c) Relates this to P_loss = I²R, so the loss falls with the square of the current'],
      model:'V_s = ' + Vp + ' × ' + Ns + '/' + Np + ' = ' + rd(Vs, 1) + ' V. The line wastes P = I²R = ' + (I * I) + ' × ' + R + ' = ' + rd(loss, 2) + ' W. Since the power delivered is VI, sending it at a high voltage means a small current, and because the loss goes as the current squared, halving the current quarters the waste.' };
  },
  /* induction */
  () => {
    const n = ri(50, 400), dPhi = rd(ri(5, 90) / 1000, 4), dt = rd(ri(2, 40) / 100, 2);
    const emf = n * dPhi / dt;
    return { mod:'ph-m6',
      q:'A magnet is pushed into a coil of <b>' + n + ' turns</b>, changing the flux through it by <b>' + dPhi + ' Wb</b> in <b>' + dt + ' s</b>.' +
        '<br>(a) Calculate the average emf induced. <b>(2 marks)</b>' +
        '<br>(b) State the direction of the induced current and justify it. <b>(2 marks)</b>' +
        '<br>(c) Explain why a force is needed to push the magnet in. <b>(1 mark)</b>',
      guide:['(a) Uses ε = N ΔΦ/Δt',
             '(a) Emf ' + rd(emf, 3) + ' V',
             '(b) States that the current opposes the increase in flux (Lenz’s law)',
             '(b) Describes the coil face nearest the magnet becoming a like pole, repelling it',
             '(c) Links the opposing force to conservation of energy — the work done pushing is what becomes electrical energy'],
      model:'ε = N ΔΦ/Δt = ' + n + ' × ' + dPhi + '/' + dt + ' = ' + rd(emf, 3) + ' V. By Lenz’s law the induced current flows so as to oppose the increasing flux, making the near face of the coil the same pole as the approaching magnet, so the magnet is repelled. The push needed against that repulsion is the energy source for the current — if the force helped instead, energy would appear from nowhere.' };
  },
  /* the photoelectric effect */
  () => {
    const phi = rd(ri(18, 45) / 10, 1), lam = pk([200, 250, 300]) * 1e-9;
    const E = PH_PLANCK * PH_LIGHT / lam / PH_Q, K = E - phi;
    const f0 = phi * PH_Q / PH_PLANCK;
    return { mod:'ph-m7',
      q:'Light of wavelength <b>' + (lam * 1e9) + ' nm</b> falls on a metal with a work function of <b>' + phi + ' eV</b>.' +
        '<br>(a) Calculate the maximum kinetic energy of the photoelectrons, in eV. <b>(2 marks)</b>' +
        '<br>(b) Calculate the threshold frequency of the metal. <b>(1 mark)</b>' +
        '<br>(c) The light is made brighter at the same wavelength. Explain what changes and what does not, and why the wave model could not account for this. <b>(3 marks)</b>',
      guide:['(a) Finds the photon energy ' + rd(E, 3) + ' eV',
             '(a) K_max = hf − φ = ' + rd(K, 3) + ' eV',
             '(b) Threshold frequency ' + phSci(f0) + ' Hz',
             '(c) States that the number of photoelectrons per second increases',
             '(c) States that the maximum kinetic energy does not change',
             '(c) Explains that the wave model predicts brighter light should give more energetic electrons, because a wave delivers energy continuously'],
      model:'The photon carries hc/λ = ' + rd(E, 3) + ' eV, so K_max = ' + rd(E, 3) + ' − ' + phi + ' = ' + rd(K, 3) + ' eV. The threshold is where hf₀ = φ, giving f₀ = ' + phSci(f0) + ' Hz. Brighter light at the same wavelength is more photons per second, not more energetic ones, so the current rises while K_max stays put — the opposite of the wave prediction, which is why the photon model was needed.' };
  },
  /* relativity */
  () => {
    const frac = pk([0.6, 0.8, 0.9, 0.95]), t0 = ri(2, 40);
    const gamma = 1 / Math.sqrt(1 - frac * frac), t = gamma * t0, L0 = ri(20, 200);
    return { mod:'ph-m7',
      q:'A spacecraft travels at <b>' + frac + 'c</b> relative to the Earth. A clock on board measures a journey as taking <b>' + t0 + ' years</b>.' +
        '<br>(a) Calculate the Lorentz factor. <b>(1 mark)</b>' +
        '<br>(b) Calculate the journey time measured on Earth. <b>(2 marks)</b>' +
        '<br>(c) The journey is ' + L0 + ' light years as measured from Earth. Calculate its length in the spacecraft’s frame, and explain why the two frames disagree without either being wrong. <b>(3 marks)</b>',
      guide:['(a) γ = ' + rd(gamma, 4),
             '(b) Identifies the on-board time as the proper time t₀',
             '(b) Earth time t = γt₀ = ' + rd(t, 2) + ' years',
             '(c) Contracted length L₀/γ = ' + rd(L0 / gamma, 2) + ' light years',
             '(c) States that each frame measures proper quantities in its own rest frame',
             '(c) Explains that both are correct because simultaneity and measurement are frame-dependent, with the speed of light the same for both'],
      model:'γ = 1/√(1 − ' + frac + '²) = ' + rd(gamma, 4) + '. The on-board clock measures the proper time, so Earth measures γt₀ = ' + rd(t, 2) + ' years. The crew measure the distance contracted to ' + L0 + '/' + rd(gamma, 4) + ' = ' + rd(L0 / gamma, 2) + ' light years. Neither frame is privileged: each measures proper time and proper length only for events at rest in it, and the two sets of measurements are related by the Lorentz transformations, which keep c the same for everyone.' };
  },
  /* nuclear */
  () => {
    const T = pk([5, 8, 12, 30]), n = ri(2, 5), N0 = ri(2, 9) * 100;
    const defect = rd(ri(50, 400) / 1000, 3);
    const MeV = defect * 1.661e-27 * PH_LIGHT * PH_LIGHT / PH_Q / 1e6;
    return { mod:'ph-m8',
      q:'An isotope has a half-life of <b>' + T + ' days</b>. A sample starts with <b>' + N0 + ' g</b>.' +
        '<br>(a) Calculate the mass remaining after ' + (T * n) + ' days. <b>(2 marks)</b>' +
        '<br>(b) The nucleus has a mass defect of ' + defect + ' u. Calculate its binding energy in MeV. <b>(2 marks)</b>' +
        '<br>(c) Explain what binding energy per nucleon tells you about stability. <b>(2 marks)</b>',
      guide:['(a) Identifies ' + (T * n) + ' days as ' + n + ' half-lives',
             '(a) Mass remaining ' + rd(N0 / Math.pow(2, n), 3) + ' g',
             '(b) Converts the mass defect and uses E = Δmc²',
             '(b) Binding energy ' + rd(MeV, 1) + ' MeV',
             '(c) States that a higher binding energy per nucleon means a more stable nucleus',
             '(c) Relates the peak near iron to fusion releasing energy below it and fission above it'],
      model:(T * n) + ' days is ' + n + ' half-lives, so ' + N0 + '/2' + sup(n) + ' = ' + rd(N0 / Math.pow(2, n), 3) + ' g is left. The mass defect is ' + defect + ' u = ' + phSci(defect * 1.661e-27) + ' kg, and E = Δmc² = ' + rd(MeV, 1) + ' MeV (about 931.5 MeV per u). Binding energy per nucleon measures how tightly each nucleon is held; it peaks near iron-56, so light nuclei release energy by fusing and heavy ones by splitting.' };
  },
  /* spectra and the Bohr model */
  () => {
    const n2 = ri(3, 6), n1 = ri(1, 2);
    const dE = 13.6 * (1 / (n1 * n1) - 1 / (n2 * n2));
    const lam = PH_PLANCK * PH_LIGHT / (dE * PH_Q);
    return { mod:'ph-m8',
      q:'An electron in a hydrogen atom falls from <b>n = ' + n2 + '</b> to <b>n = ' + n1 + '</b>.' +
        '<br>(a) Calculate the energy of the photon emitted, in eV. <b>(2 marks)</b>' +
        '<br>(b) Calculate its wavelength. <b>(2 marks)</b>' +
        '<br>(c) Explain why a hot, thin gas gives bright lines while a cool gas in front of a hot source gives dark ones at the same wavelengths. <b>(2 marks)</b>',
      guide:['(a) Uses E_n = −13.6/n² for both levels',
             '(a) Photon energy ' + rd(dE, 3) + ' eV',
             '(b) Converts to joules and uses λ = hc/E',
             '(b) Wavelength ' + phSci(lam) + ' m',
             '(c) States that emission happens when electrons drop between the same fixed levels',
             '(c) States that absorption removes exactly those photons from a continuous spectrum, leaving dark lines in the same places'],
      model:'E = 13.6(1/' + (n1 * n1) + ' − 1/' + (n2 * n2) + ') = ' + rd(dE, 3) + ' eV, so λ = hc/E = ' + phSci(lam) + ' m. The energy levels are fixed, so only certain photon energies can be emitted or absorbed. A hot thin gas emits them (bright lines); a cooler gas in front of a continuous source absorbs those same energies and re-radiates them in all directions, so they are missing from the line of sight (dark lines).' };
  },
  /* the standard model */
  () => {
    return { mod:'ph-m8',
      q:'The standard model groups the fundamental particles.' +
        '<br>(a) State the quark composition of a proton and of a neutron. <b>(2 marks)</b>' +
        '<br>(b) Explain the difference between a baryon and a meson. <b>(2 marks)</b>' +
        '<br>(c) Explain why high-energy accelerators are needed to study heavy particles. <b>(2 marks)</b>',
      guide:['(a) Proton: two up quarks and a down quark (uud)',
             '(a) Neutron: two down quarks and an up quark (udd)',
             '(b) States that a baryon is three quarks and a meson is a quark–antiquark pair',
             '(b) Gives a correct example of each',
             '(c) States that mass can be created from energy, via E = mc²',
             '(c) Relates the collision energy needed to the mass of the particle being made'],
      model:'A proton is uud (charges +⅔ + ⅔ − ⅓ = +1) and a neutron is udd (+⅔ − ⅓ − ⅓ = 0). Baryons are three-quark particles such as the proton; mesons are quark–antiquark pairs such as the pion. Heavy particles are short-lived and are not lying around to be studied, so they have to be made: E = mc² says the collision must supply at least the rest energy of the particle, which is why accelerator energy sets what can be discovered.' };
  }
];

/* ══ CHEMISTRY — YEAR 12 ══════════════════════════════════════════════════
   Modules 5 to 8 of the Chemistry Stage 6 Syllabus (2017). The 2025
   replacement is first examined in 2029, after the 2027 HSC.
   ═════════════════════════════════════════════════════════════════════════ */

/* ── Module 5: equilibrium and Le Chatelier ─────────────────────────────── */
const CH_EQ = [
  { eq:'N₂(g) + 3H₂(g) ⇌ 2NH₃(g)', dh:'exothermic', gasL:4, gasR:2, name:'the Haber process' },
  { eq:'2SO₂(g) + O₂(g) ⇌ 2SO₃(g)', dh:'exothermic', gasL:3, gasR:2, name:'the contact process' },
  { eq:'N₂O₄(g) ⇌ 2NO₂(g)', dh:'endothermic', gasL:1, gasR:2, name:'the dinitrogen tetroxide equilibrium' },
  { eq:'H₂(g) + I₂(g) ⇌ 2HI(g)', dh:'exothermic', gasL:2, gasR:2, name:'the hydrogen iodide equilibrium' },
  { eq:'CaCO₃(s) ⇌ CaO(s) + CO₂(g)', dh:'endothermic', gasL:0, gasR:1, name:'the decomposition of limestone' }
];

function genChEquil(){
  const e = pk(CH_EQ), k = ri(0, 3);
  if (k === 0){                                   // a temperature change
    const up = Math.random() < 0.5;
    const toward = (e.dh === 'exothermic') === up ? 'left' : 'right';
    const m = mc('shifts to the ' + toward, ['shifts to the ' + (toward === 'left' ? 'right' : 'left'),
      'does not shift', 'stops reacting altogether']);
    return { q:'<b>' + e.eq + '</b> is <b>' + e.dh + '</b> in the forward direction. If the temperature is <b>' + (up ? 'increased' : 'decreased') + '</b>, the equilibrium…',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-lechat-T', dh:e.dh, up, toward },
      note:'Heat behaves like a ' + (e.dh === 'exothermic' ? 'product' : 'reactant') + ' here, so ' + (up ? 'adding' : 'removing') + ' it pushes the system to the ' + toward + '. Temperature is the only change that also moves K.' };
  }
  if (k === 1){                                   // a pressure change
    const up = Math.random() < 0.5;
    const fewer = e.gasL === e.gasR ? 'neither side' : (e.gasL < e.gasR ? 'left' : 'right');
    const toward = fewer === 'neither side' ? 'does not shift' : 'shifts to the ' + (up ? fewer : (fewer === 'left' ? 'right' : 'left'));
    const m = mc(toward, ['shifts to the left', 'shifts to the right', 'does not shift'].filter(x => x !== toward));
    return { q:'For <b>' + e.eq + '</b>, the <b>pressure is ' + (up ? 'increased' : 'decreased') + '</b> by changing the volume. The equilibrium…',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-lechat-P', gasL:e.gasL, gasR:e.gasR, up },
      note:'Count gas particles: ' + e.gasL + ' on the left and ' + e.gasR + ' on the right. ' +
        (e.gasL === e.gasR ? 'They are equal, so pressure has no effect on this one.'
          : (up ? 'Raising the pressure favours the side with fewer gas particles, which is the ' + fewer + '.'
                 : 'Lowering the pressure favours the side with more gas particles, which is the ' + (fewer === 'left' ? 'right' : 'left') + '.')) };
  }
  if (k === 2){                                   // a catalyst
    const m = mc('reaches equilibrium faster, with the position of equilibrium unchanged',
      ['shifts to the right', 'shifts to the left', 'increases the equilibrium constant',
       'increases the yield at equilibrium']);
    return { q:'A <b>catalyst</b> is added to <b>' + e.eq + '</b>. What happens?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-catalyst' },
      note:'A catalyst lowers the activation energy of both directions equally, so equilibrium arrives sooner but at the same place. It is used in industry for rate, not yield.' };
  }
  const m = mc('The forward and reverse reactions are still happening, at the same rate.',
    ['Both reactions have stopped.', 'All the reactants have been used up.',
     'The concentrations of reactants and products are equal.',
     'The reaction only goes forwards from then on.']);
  return { q:'What does it mean to say a system is at <b>dynamic equilibrium</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-dynamic' },
    note:'Nothing observable changes, but both reactions continue at matching rates. The concentrations are constant, which is not the same as being equal.' };
}

/* ── Module 5: the equilibrium constant ─────────────────────────────────── */
function genChKeq(){
  const k = ri(0, 3);
  if (k === 0){                                   // K from concentrations
    const a = rd(ri(5, 90) / 100, 2), b = rd(ri(5, 90) / 100, 2), c = rd(ri(5, 90) / 100, 2);
    const K = c * c / (a * b * b * b);
    return { q:'At equilibrium <b>N₂(g) + 3H₂(g) ⇌ 2NH₃(g)</b> has [N₂] = <b>' + a + '</b>, [H₂] = <b>' + b + '</b> and [NH₃] = <b>' + c + '</b> mol L' + sup(-1) + '. Find <b>K</b>, to 3 significant figures.',
      input:true, answer:phSci(K), accept:qty(K, { tol:Math.abs(K) * 0.01 }), data:{ kind:'ch-keq', a, b, c },
      note:'K = [NH₃]²/([N₂][H₂]³) = ' + (c * c).toPrecision(4) + '/(' + a + ' × ' + rd(b * b * b, 6) + ') = ' + phSci(K) + '. The powers are the coefficients from the equation.' };
  }
  if (k === 1){                                   // Q against K
    const K = pk([0.5, 2, 10, 50]), f = pk([0.1, 0.5, 2, 10]);
    const Q = K * f;
    const dir = Q < K ? 'right' : Q > K ? 'left' : 'neither way';
    const m = mc(Q === K ? 'It is already at equilibrium.' : 'It shifts to the ' + dir + ' to reach equilibrium.',
      ['It shifts to the left to reach equilibrium.', 'It shifts to the right to reach equilibrium.',
       'It is already at equilibrium.', 'It cannot reach equilibrium.'].filter(x => x !== (Q === K ? 'It is already at equilibrium.' : 'It shifts to the ' + dir + ' to reach equilibrium.')));
    return { q:'A reaction has <b>K = ' + K + '</b>. At one moment the reaction quotient is <b>Q = ' + rd(Q, 3) + '</b>. What happens?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-Q', K, Q },
      note:'Q &lt; K means too few products, so the reaction runs forwards; Q &gt; K means too many, so it runs back. Here Q is ' + (Q < K ? 'less' : Q > K ? 'greater' : 'equal') + ' than K.' };
  }
  if (k === 2){                                   // what a large K means
    const big = Math.random() < 0.5;
    const m = mc(big ? 'The products are strongly favoured at equilibrium.' : 'The reactants are strongly favoured at equilibrium.',
      [big ? 'The reactants are strongly favoured at equilibrium.' : 'The products are strongly favoured at equilibrium.',
       'The reaction is very fast.', 'The reaction is very slow.',
       'The reaction is exothermic.']);
    return { q:'A reaction has <b>K = ' + (big ? '2.5 × 10⁶' : '3.0 × 10' + sup(-7)) + '</b> at 25 °C. What does this tell you?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-Ksize', big },
      note:'K compares products with reactants at equilibrium, so a large K means the equilibrium lies well to the right. It says nothing at all about how fast equilibrium is reached.' };
  }
  const a0 = rd(ri(10, 90) / 100, 2), x = rd(a0 * ri(20, 60) / 100, 3);   // an ICE table
  const left = rd(a0 - x, 4);
  return { q:'<b>H₂(g) + I₂(g) ⇌ 2HI(g)</b> starts with <b>' + a0 + ' mol L' + sup(-1) + '</b> of each reactant in a 1 L vessel. At equilibrium <b>' + rd(2 * x, 4) + ' mol L' + sup(-1) + '</b> of HI has formed. Find <b>K</b>, to 3 significant figures.',
    input:true, answer:phSci(4 * x * x / (left * left)), accept:qty(4 * x * x / (left * left), { tol:Math.abs(4 * x * x / (left * left)) * 0.015 }),
    data:{ kind:'ch-ice', a0, x },
    note:'Each mole of HI uses half a mole of H₂ and half of I₂, so ' + x + ' mol L' + sup(-1) + ' of each is used, leaving ' + left + '. Then K = ' + rd(2 * x, 4) + '²/(' + left + ' × ' + left + ') = ' + phSci(4 * x * x / (left * left)) + '.' };
}

/* ── Module 5: solubility equilibria ────────────────────────────────────── */
const CH_SALTS = [
  { f:'AgCl', cat:1, an:1, ksp:1.8e-10 }, { f:'BaSO₄', cat:1, an:1, ksp:1.1e-10 },
  { f:'CaCO₃', cat:1, an:1, ksp:3.4e-9 }, { f:'PbI₂', cat:1, an:2, ksp:9.8e-9 },
  { f:'Ag₂CrO₄', cat:2, an:1, ksp:1.1e-12 }, { f:'CaF₂', cat:1, an:2, ksp:3.5e-11 }
];
function genChKsp(){
  const s = pk(CH_SALTS), k = ri(0, 2);
  const n = s.cat + s.an;
  const coef = Math.pow(s.cat, s.cat) * Math.pow(s.an, s.an);
  const sol = Math.pow(s.ksp / coef, 1 / n);
  if (k === 0){
    return { q:'<b>' + s.f + '</b> has K<sub>sp</sub> = <b>' + phSci(s.ksp, 2) + '</b>. Find its <b>molar solubility</b> in water, to 3 significant figures.',
      input:true, answer:phSci(sol), accept:qty(sol, { tol:sol * 0.02 }), data:{ kind:'ch-ksp-sol', f:s.f, cat:s.cat, an:s.an, ksp:s.ksp },
      note:'If the solubility is s, then K_sp = ' + (coef === 1 ? 's' + sup(n) : coef + 's' + sup(n)) + ', so s = ' + phSci(sol) + ' mol L' + sup(-1) + '.' };
  }
  if (k === 1){
    const sol2 = rd(ri(10, 90) / 10, 1) * Math.pow(10, -ri(3, 5));
    const ksp2 = coef * Math.pow(sol2, n);
    return { q:'The molar solubility of <b>' + s.f + '</b> is <b>' + phSci(sol2, 2) + ' mol L' + sup(-1) + '</b>. Find its <b>K<sub>sp</sub></b>, to 3 significant figures.',
      input:true, answer:phSci(ksp2), accept:qty(ksp2, { tol:ksp2 * 0.02 }), data:{ kind:'ch-ksp-calc', cat:s.cat, an:s.an, sol:sol2 },
      note:'The ions come off in the ratio ' + s.cat + ':' + s.an + ', so K_sp = ' +
        (s.cat > 1 ? '(' + s.cat + 's)' + sup(s.cat) : 's') + (s.an > 1 ? '(' + s.an + 's)' + sup(s.an) : 's') + ' = ' + phSci(ksp2) + '.' };
  }
  const m = mc('Less of it dissolves, because the common ion pushes the equilibrium back towards the solid.',
    ['More of it dissolves, because there are more ions in solution.',
     'The solubility does not change, because K_sp is a constant.',
     'It all precipitates out immediately.',
     'The K_sp value gets smaller.']);
  return { q:'Some <b>' + s.f + '</b> is shaken with water, then a soluble salt sharing one of its ions is added. What happens to how much <b>' + s.f + '</b> dissolves?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-common-ion', f:s.f },
    note:'K_sp itself is fixed at a given temperature, so raising one ion’s concentration must lower the other’s — which means less solid dissolves. That is the common ion effect.' };
}

/* ── Module 6: pH and strong acids ──────────────────────────────────────── */
function genChPH(){
  const k = ri(0, 4);
  if (k === 0){                                   // pH from concentration
    const m2 = ri(1, 9), e = ri(1, 5);
    const conc = m2 * Math.pow(10, -e);
    const pH = -Math.log10(conc);
    return { q:'Find the <b>pH</b> of a <b>' + phSci(conc, 2) + ' mol L' + sup(-1) + '</b> solution of hydrochloric acid, to 2 decimal places.',
      input:true, answer:rd(pH, 2), accept:qty(pH, { tol:0.02 }), data:{ kind:'ch-ph', conc },
      note:'HCl is a strong acid, so [H⁺] = ' + phSci(conc, 2) + ' mol L' + sup(-1) + ' and pH = −log₁₀[H⁺] = ' + rd(pH, 2) + '.' };
  }
  if (k === 1){                                   // concentration from pH
    const pH = rd(ri(100, 650) / 100, 2);
    const conc = Math.pow(10, -pH);
    return { q:'A solution has <b>pH ' + pH + '</b>. Find <b>[H⁺]</b>, to 3 significant figures.',
      input:true, answer:phSci(conc), accept:qty(conc, { tol:conc * 0.02, dim:'conc' }), data:{ kind:'ch-h-from-ph', pH },
      note:'[H⁺] = 10^(−pH) — that is, 10 to the power of −' + pH + ' = ' + phSci(conc) + ' mol L' + sup(-1) + '.' };
  }
  if (k === 2){                                   // a strong base
    const m2 = ri(1, 9), e = ri(1, 4);
    const conc = m2 * Math.pow(10, -e);
    const pOH = -Math.log10(conc), pH = 14 - pOH;
    return { q:'Find the <b>pH</b> of a <b>' + phSci(conc, 2) + ' mol L' + sup(-1) + '</b> solution of sodium hydroxide at 25 °C, to 2 decimal places.',
      input:true, answer:rd(pH, 2), accept:qty(pH, { tol:0.02 }), data:{ kind:'ch-poh', conc },
      note:'NaOH is a strong base, so [OH⁻] = ' + phSci(conc, 2) + ', giving pOH = ' + rd(pOH, 2) + ' and pH = 14 − pOH = ' + rd(pH, 2) + '.' };
  }
  if (k === 3){                                   // dilution
    const c1 = rd(ri(10, 90) / 100, 2), V1 = ri(10, 50), V2 = V1 * pk([2, 5, 10]);
    const c2 = c1 * V1 / V2;
    const pH = -Math.log10(c2);
    return { q:'<b>' + V1 + ' mL</b> of <b>' + c1 + ' mol L' + sup(-1) + '</b> HCl is diluted to <b>' + V2 + ' mL</b>. Find the <b>pH</b> of the diluted solution, to 2 decimal places.',
      input:true, answer:rd(pH, 2), accept:qty(pH, { tol:0.02 }), data:{ kind:'ch-dilute', c1, V1, V2 },
      note:'c₁V₁ = c₂V₂ gives c₂ = ' + c1 + ' × ' + V1 + '/' + V2 + ' = ' + phSci(c2, 3) + ' mol L' + sup(-1) + ', so pH = ' + rd(pH, 2) + '. Diluting tenfold raises the pH by exactly 1.' };
  }
  const m = mc('Each unit of pH is a factor of ten in [H⁺].',
    ['Each unit of pH is a factor of two in [H⁺].',
     'pH and [H⁺] are directly proportional.',
     'A higher pH means a higher [H⁺].',
     'pH has no relationship to [H⁺].']);
  return { q:'What does the <b>pH scale</b> being logarithmic mean?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-logscale' },
    note:'pH = −log₁₀[H⁺], so pH 3 is ten times more acidic than pH 4 and a hundred times more than pH 5. Higher pH means lower [H⁺].' };
}

/* ── Module 6: weak acids and Ka ────────────────────────────────────────── */
const CH_WEAK = [
  { n:'ethanoic acid', f:'CH₃COOH', ka:1.74e-5 }, { n:'methanoic acid', f:'HCOOH', ka:1.77e-4 },
  { n:'propanoic acid', f:'CH₃CH₂COOH', ka:1.34e-5 }, { n:'hydrofluoric acid', f:'HF', ka:7.2e-4 },
  { n:'benzoic acid', f:'C₆H₅COOH', ka:6.3e-5 }
];
function genChKa(){
  const a = pk(CH_WEAK), k = ri(0, 3);
  if (k === 0){
    const pKa = -Math.log10(a.ka);
    return { q:'<b>' + a.n + '</b> has K<sub>a</sub> = <b>' + phSci(a.ka, 3) + '</b>. Find its <b>pK<sub>a</sub></b>, to 2 decimal places.',
      input:true, answer:rd(pKa, 2), accept:qty(pKa, { tol:0.02 }), data:{ kind:'ch-pka', ka:a.ka },
      note:'pK_a = −log₁₀K_a = ' + rd(pKa, 2) + '. A smaller pK_a means a stronger acid.' };
  }
  if (k === 1){
    const conc = pk([0.01, 0.05, 0.1, 0.5, 1.0]);
    const h = Math.sqrt(a.ka * conc);
    const pH = -Math.log10(h);
    return { q:'Find the <b>pH</b> of a <b>' + conc + ' mol L' + sup(-1) + '</b> solution of <b>' + a.n + '</b> (K<sub>a</sub> = ' + phSci(a.ka, 3) + '), to 2 decimal places.',
      input:true, answer:rd(pH, 2), accept:qty(pH, { tol:0.03 }), data:{ kind:'ch-weak-ph', ka:a.ka, conc },
      note:'For a weak acid [H⁺] ≈ √(K_a × c) = √(' + phSci(a.ka, 3) + ' × ' + conc + ') = ' + phSci(h, 3) + ', so pH = ' + rd(pH, 2) + '. The approximation works because so little of it ionises.' };
  }
  if (k === 2){
    const conc = pk([0.01, 0.1, 1.0]);
    const h = Math.sqrt(a.ka * conc);
    const pct = h / conc * 100;
    return { q:'What <b>percentage</b> of a <b>' + conc + ' mol L' + sup(-1) + '</b> solution of <b>' + a.n + '</b> (K<sub>a</sub> = ' + phSci(a.ka, 3) + ') is ionised? Give 3 significant figures.',
      input:true, answer:rd(pct, 3), accept:qty(pct, { tol:Math.max(0.005, pct * 0.02) }), data:{ kind:'ch-ionised', ka:a.ka, conc },
      note:'[H⁺] ≈ √(K_a c) = ' + phSci(h, 3) + ' mol L' + sup(-1) + ', and as a percentage of ' + conc + ' that is ' + rd(pct, 3) + '%. Diluting a weak acid raises the percentage ionised.' };
  }
  const m = mc('A strong acid ionises completely; a concentrated acid simply has a lot of acid per litre.',
    ['They mean the same thing.',
     'A strong acid is always more concentrated.',
     'A concentrated acid always has a lower pH than any dilute one.',
     'Strength depends on the volume of the solution.']);
  return { q:'What is the difference between a <b>strong</b> acid and a <b>concentrated</b> one?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-strong-conc' },
    note:'Strength is about how completely it ionises — a property of the acid. Concentration is how much is dissolved. A dilute strong acid can easily have a higher pH than a concentrated weak one.' };
}

/* ── Module 6: titration ────────────────────────────────────────────────── */
function genChTitr(){
  const k = ri(0, 3);
  if (k === 0){                                   // monoprotic
    const cB = rd(ri(50, 200) / 1000, 3), vB = rd(ri(100, 300) / 10, 1), vA = rd(ri(150, 300) / 10, 1);
    const cA = cB * vB / vA;
    return { q:'<b>' + vA + ' mL</b> of hydrochloric acid is neutralised by <b>' + vB + ' mL</b> of <b>' + cB + ' mol L' + sup(-1) + '</b> sodium hydroxide. Find the <b>concentration of the acid</b>, to 4 decimal places.',
      input:true, answer:rd(cA, 4), accept:qty(cA, { tol:0.0005, dim:'conc' }), data:{ kind:'ch-titr', cB, vB, vA, ratio:1 },
      note:'n(NaOH) = ' + cB + ' × ' + rd(vB / 1000, 5) + ' = ' + phSci(cB * vB / 1000, 3) + ' mol. The ratio is 1:1, so c(HCl) = n/V = ' + rd(cA, 4) + ' mol L' + sup(-1) + '.' };
  }
  if (k === 1){                                   // diprotic
    const cB = rd(ri(50, 200) / 1000, 3), vB = rd(ri(100, 300) / 10, 1), vA = rd(ri(150, 300) / 10, 1);
    const cA = cB * vB / vA / 2;
    return { q:'<b>' + vA + ' mL</b> of sulfuric acid needs <b>' + vB + ' mL</b> of <b>' + cB + ' mol L' + sup(-1) + '</b> sodium hydroxide to reach the end point. Find the <b>concentration of the acid</b>, to 4 decimal places.',
      input:true, answer:rd(cA, 4), accept:qty(cA, { tol:0.0005, dim:'conc' }), data:{ kind:'ch-titr', cB, vB, vA, ratio:2 },
      note:'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O, so the acid is half the moles of base: n(acid) = ' + phSci(cB * vB / 1000 / 2, 3) + ' mol in ' + rd(vA / 1000, 4) + ' L, giving ' + rd(cA, 4) + ' mol L' + sup(-1) + '.' };
  }
  if (k === 2){                                   // choosing an indicator
    const e = pk([
      { t:'a strong acid with a strong base', a:'any indicator changing between pH 4 and 10, since the jump is very steep', eq:'7' },
      { t:'a weak acid with a strong base', a:'phenolphthalein, which changes above pH 7', eq:'above 7' },
      { t:'a strong acid with a weak base', a:'methyl orange, which changes below pH 7', eq:'below 7' }
    ]);
    const m = mc(e.a, ['phenolphthalein, which changes above pH 7', 'methyl orange, which changes below pH 7',
      'any indicator changing between pH 4 and 10, since the jump is very steep', 'an indicator that changes at pH 1'].filter(x => x !== e.a));
    return { q:'Which indicator suits a titration of <b>' + e.t + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-indicator', t:e.t },
      note:'The indicator must change colour inside the steep part of the curve, which is centred on the equivalence pH — here ' + e.eq + '. The salt formed is what pulls the equivalence point away from 7.' };
  }
  const m = mc('The equivalence point is where the amounts react exactly; the end point is where the indicator changes.',
    ['They are two names for the same thing.',
     'The end point always comes first.',
     'The equivalence point is always at pH 7.',
     'The end point is where the solution becomes neutral.']);
  return { q:'What is the difference between the <b>equivalence point</b> and the <b>end point</b> of a titration?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-endpoint' },
    note:'A well-chosen indicator makes the two almost coincide; a poor one puts the colour change outside the steep section and introduces an error.' };
}

/* ── Module 6: conjugates and buffers ───────────────────────────────────── */
const CH_PAIRS = [
  { a:'HCl', b:'Cl⁻' }, { a:'CH₃COOH', b:'CH₃COO⁻' }, { a:'H₂CO₃', b:'HCO₃⁻' },
  { a:'HCO₃⁻', b:'CO₃²⁻' }, { a:'NH₄⁺', b:'NH₃' }, { a:'H₂O', b:'OH⁻' }, { a:'H₃O⁺', b:'H₂O' },
  { a:'H₂PO₄⁻', b:'HPO₄²⁻' }, { a:'HF', b:'F⁻' }
];
function genChBuffer(){
  const k = ri(0, 3);
  if (k === 0){
    const p = pk(CH_PAIRS);
    const askBase = Math.random() < 0.5;
    const right = askBase ? p.b : p.a;
    const pool = CH_PAIRS.flatMap(x => [x.a, x.b]).filter(x => x !== right);
    const m = mc(right, shuffle(pool).slice(0, 4));
    return { q:'What is the <b>conjugate ' + (askBase ? 'base of ' + p.a : 'acid of ' + p.b) + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-conjugate', a:p.a, b:p.b, askBase },
      note:'A conjugate pair differs by exactly one proton: ' + p.a + ' ⇌ ' + p.b + ' + H⁺.' };
  }
  if (k === 1){
    const p = pk(CH_PAIRS.filter(x => /COOH|H₂CO₃|NH₄|H₂PO₄/.test(x.a)));
    const m = mc('a weak acid together with its conjugate base, in similar amounts',
      ['a strong acid together with a strong base', 'any acid at a concentration above 1 mol L' + sup(-1),
       'a weak acid on its own', 'a salt of a strong acid and a strong base']);
    return { q:'What makes a <b>buffer</b> solution?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-buffer-what' },
      note:'With both ' + p.a + ' and ' + p.b + ' present in quantity, added acid is mopped up by the base and added base by the acid, so the pH barely moves.' };
  }
  if (k === 2){
    const a = pk(CH_WEAK);
    const pKa = -Math.log10(a.ka);
    const ratio = pk([0.1, 0.5, 1, 2, 10]);
    const pH = pKa + Math.log10(ratio);
    return { q:'A buffer contains <b>' + a.n + '</b> (pK<sub>a</sub> = ' + rd(pKa, 2) + ') and its conjugate base, with <b>[base]/[acid] = ' + ratio + '</b>. Find the <b>pH</b>, to 2 decimal places.',
      input:true, answer:rd(pH, 2), accept:qty(pH, { tol:0.02 }), data:{ kind:'ch-henderson', ka:a.ka, ratio },
      note:'pH = pK_a + log₁₀([base]/[acid]) = ' + rd(pKa, 2) + ' + log₁₀(' + ratio + ') = ' + rd(pH, 2) + '. Equal amounts put the pH exactly at the pK_a.' };
  }
  const m = mc('The added H⁺ reacts with the conjugate base, so most of it never stays as free H⁺.',
    ['The buffer neutralises the acid completely, so nothing changes at all.',
     'The buffer dilutes the acid.', 'The pH does not change because water is a buffer.',
     'The added acid evaporates.']);
  return { q:'A small amount of strong acid is added to a buffer. Why does the <b>pH barely change</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-buffer-how' },
    note:'The reservoir of conjugate base absorbs the H⁺, converting it to the weak acid. The ratio shifts a little, and the Henderson–Hasselbalch equation shows a logarithm of a ratio moves slowly.' };
}

/* ── Module 7: naming organic compounds ─────────────────────────────────── */
const CH_STEM = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'];
const CH_FAM = [
  { name:'alkane', suffix:'ane', group:'C–C only', eg:'propane' },
  { name:'alkene', suffix:'ene', group:'C=C', eg:'propene' },
  { name:'alkyne', suffix:'yne', group:'C≡C', eg:'propyne' },
  { name:'alcohol', suffix:'anol', group:'–OH', eg:'propan-1-ol' },
  { name:'aldehyde', suffix:'anal', group:'–CHO', eg:'propanal' },
  { name:'ketone', suffix:'anone', group:'C=O in the chain', eg:'propanone' },
  { name:'carboxylic acid', suffix:'anoic acid', group:'–COOH', eg:'propanoic acid' },
  { name:'amine', suffix:'anamine', group:'–NH₂', eg:'propan-1-amine' },
  { name:'amide', suffix:'anamide', group:'–CONH₂', eg:'propanamide' },
  { name:'ester', suffix:'anoate', group:'–COO–', eg:'methyl propanoate' }
];
const CH_MM = [
  { n:'methane', f:'CH₄', m:16.04 }, { n:'ethane', f:'C₂H₆', m:30.07 }, { n:'ethene', f:'C₂H₄', m:28.05 },
  { n:'ethanol', f:'C₂H₅OH', m:46.07 }, { n:'methanol', f:'CH₃OH', m:32.04 },
  { n:'ethanoic acid', f:'CH₃COOH', m:60.05 }, { n:'propan-1-ol', f:'C₃H₇OH', m:60.10 },
  { n:'propanone', f:'CH₃COCH₃', m:58.08 }, { n:'ethanal', f:'CH₃CHO', m:44.05 },
  { n:'chloroethane', f:'C₂H₅Cl', m:64.51 }
];
function genChName(){
  const k = ri(0, 4);
  if (k === 4){                                   // a hydrogen count, which is a calculation
    const n = ri(2, 8), fam = pk(['ane', 'ene', 'yne']);
    const hyd = fam === 'ane' ? 2 * n + 2 : fam === 'ene' ? 2 * n : 2 * n - 2;
    return { q:'How many <b>hydrogen atoms</b> are in one molecule of <b>' + CH_STEM[n - 1] + fam + '</b>?',
      input:true, answer:hyd, accept:qty(hyd, { tol:0.4 }), data:{ kind:'ch-hcount', n, fam },
      note:'With ' + n + ' carbons: an alkane is C_nH_{2n+2}, an alkene has one double bond so two fewer, and an alkyne four fewer. Here that is ' + hyd + '.' };
  }
  if (k === 0){                                   // family from the functional group
    const f = pk(CH_FAM);
    const m = mc(f.name, shuffle(CH_FAM.filter(x => x.name !== f.name).map(x => x.name)).slice(0, 4));
    return { q:'Which family has the functional group <b>' + f.group + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-family', group:f.group, name:f.name },
      note:f.name + 's end in <b>-' + f.suffix + '</b>, for example ' + f.eg + '.' };
  }
  if (k === 1){                                   // the formula of a straight-chain alkane
    const n = ri(2, 8);
    const right = 'C' + sub(n) + 'H' + sub(2 * n + 2);
    const m = mc(right, ['C' + sub(n) + 'H' + sub(2 * n), 'C' + sub(n) + 'H' + sub(2 * n - 2),
      'C' + sub(n) + 'H' + sub(n * 2 + 4), 'C' + sub(n) + 'H' + sub(n)]);
    return { q:'What is the molecular formula of <b>' + CH_STEM[n - 1] + 'ane</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-alkane', n },
      note:'Alkanes are C_nH_{2n+2}, so with ' + n + ' carbons there are ' + (2 * n + 2) + ' hydrogens. Alkenes have two fewer, alkynes four fewer.' };
  }
  if (k === 2){                                   // isomers
    const e = pk([
      { q:'C₄H₁₀', a:'2', why:'butane and 2-methylpropane' },
      { q:'C₅H₁₂', a:'3', why:'pentane, 2-methylbutane and 2,2-dimethylpropane' },
      { q:'C₃H₈', a:'1', why:'only propane — a three-carbon chain cannot branch' },
      { q:'C₃H₈O (alcohols only)', a:'2', why:'propan-1-ol and propan-2-ol' }
    ]);
    const m = mc(e.a, ['1', '2', '3', '4', '5'].filter(x => x !== e.a));
    return { q:'How many <b>structural isomers</b> does <b>' + e.q + '</b> have?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-isomer', f:e.q },
      note:'They are ' + e.why + '. Isomers share a molecular formula but differ in how the atoms are joined, so their properties differ too.' };
  }
  const e = pk([
    { name:'propan-2-ol', a:'a secondary alcohol', w:['a primary alcohol', 'a tertiary alcohol', 'an aldehyde'] },
    { name:'butan-1-ol', a:'a primary alcohol', w:['a secondary alcohol', 'a tertiary alcohol', 'a ketone'] },
    { name:'2-methylpropan-2-ol', a:'a tertiary alcohol', w:['a primary alcohol', 'a secondary alcohol', 'a carboxylic acid'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'Classify <b>' + e.name + '</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-classify', name:e.name },
    note:'Count the carbons attached to the carbon carrying the –OH: one makes it primary, two secondary, three tertiary. It matters because only primary and secondary alcohols oxidise easily.' };
}

/* ── Module 7: reactions of organic compounds ───────────────────────────── */
function genChOrgRxn(){
  if (Math.random() < 0.25){                      // a molar mass, so this topic is not all multiple choice
    const c = pk(CH_MM);
    return { q:'Find the <b>molar mass</b> of <b>' + c.n + '</b> (' + c.f + '), in g mol' + sup(-1) + ' to 2 decimal places.',
      input:true, answer:c.m, accept:qty(c.m, { tol:0.08, dim:'molarmass' }), data:{ kind:'ch-mm', n:c.n, m:c.m },
      note:'Add the atomic masses in ' + c.f + ': ' + c.m + ' g mol' + sup(-1) + '.' };
  }
  const e = pk([
    { q:'ethene with bromine water', a:'an addition reaction, giving 1,2-dibromoethane', w:['a substitution reaction, giving bromoethane', 'an oxidation, giving ethanoic acid', 'a condensation, giving a polymer'],
      why:'the C=C opens up and a bromine adds to each carbon, which is why the brown colour disappears — the test for unsaturation' },
    { q:'ethane with chlorine in ultraviolet light', a:'a substitution reaction, giving chloroethane', w:['an addition reaction, giving 1,2-dichloroethane', 'an oxidation, giving ethanol', 'no reaction at all'],
      why:'alkanes are saturated, so a halogen can only swap places with a hydrogen, and it needs UV to get started' },
    { q:'a primary alcohol with acidified potassium dichromate', a:'oxidation, first to an aldehyde and then to a carboxylic acid', w:['reduction to an alkane', 'addition across a double bond', 'no reaction, since alcohols do not oxidise'],
      why:'the orange dichromate turns green as it is reduced; a tertiary alcohol would not react at all' },
    { q:'a carboxylic acid with an alcohol and concentrated sulfuric acid', a:'esterification, giving an ester and water', w:['a substitution, giving an alkane', 'an addition, giving a ketone', 'a neutralisation, giving a salt only'],
      why:'the acid catalyst also removes water, pushing this equilibrium towards the ester' },
    { q:'ethene with steam over a catalyst', a:'hydration, giving ethanol', w:['hydrogenation, giving ethane', 'oxidation, giving ethanoic acid', 'polymerisation, giving polyethene'],
      why:'water adds across the double bond — this is how industrial ethanol is made from petrochemicals' },
    { q:'a carboxylic acid with sodium hydroxide', a:'neutralisation, giving a salt and water', w:['esterification, giving an ester', 'oxidation, giving carbon dioxide', 'addition across the C=O'],
      why:'the –COOH group is acidic enough to react with a base, which is what separates carboxylic acids from alcohols' }
  ]);
  const m = mc(e.a, e.w);
  return { q:'What happens when <b>' + e.q + '</b> react?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-rxn', ask:e.q },
    note:'This is ' + e.why + '.' };
}

/* ── Module 7: properties and intermolecular forces ─────────────────────── */
function genChProps(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk([
      { a:'propan-1-ol', b:'propane', higher:'propan-1-ol', why:'the –OH group lets it hydrogen bond, which takes much more energy to break than the dispersion forces between propane molecules' },
      { a:'butane', b:'ethane', higher:'butane', why:'both have only dispersion forces, but butane has more electrons and a bigger surface, so those forces are stronger' },
      { a:'ethanoic acid', b:'ethanal', higher:'ethanoic acid', why:'the carboxylic acid hydrogen bonds (and even pairs up into dimers), while the aldehyde has only dipole–dipole forces' },
      { a:'propanone', b:'propane', higher:'propanone', why:'the C=O makes it polar, so dipole–dipole attraction adds to the dispersion forces' }
    ]);
    const m = mc(e.higher, [e.higher === e.a ? e.b : e.a, 'they are the same', 'it cannot be predicted']);
    return { q:'Which has the <b>higher boiling point</b>, <b>' + e.a + '</b> or <b>' + e.b + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-bp', a:e.a, b:e.b, higher:e.higher },
      note:'It is ' + e.higher + ', because ' + e.why + '.' };
  }
  if (k === 1){
    const e = pk([
      { a:'ethanol', why:'its –OH group hydrogen bonds with water', sol:'very soluble' },
      { a:'hexane', why:'it is non-polar, so it cannot hydrogen bond with water', sol:'insoluble' },
      { a:'ethanoic acid', why:'the –COOH group hydrogen bonds with water', sol:'very soluble' },
      { a:'octan-1-ol', why:'the long non-polar chain outweighs the single –OH group', sol:'barely soluble' }
    ]);
    const m = mc(e.sol, ['very soluble', 'insoluble', 'barely soluble'].filter(x => x !== e.sol));
    return { q:'How soluble in <b>water</b> is <b>' + e.a + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-sol', a:e.a },
      note:'It is ' + e.sol + ' because ' + e.why + '. Solubility falls away as the carbon chain grows.' };
  }
  const m = mc('hydrogen bonding > dipole–dipole > dispersion forces',
    ['dispersion forces > dipole–dipole > hydrogen bonding',
     'dipole–dipole > hydrogen bonding > dispersion forces',
     'they are all about equally strong',
     'only hydrogen bonding affects boiling points']);
  return { q:'Rank the <b>intermolecular forces</b> from strongest to weakest, for molecules of similar size.',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-imf' },
    note:'All molecules have dispersion forces; polar ones add dipole–dipole; and an O–H, N–H or F–H bond adds hydrogen bonding. Size matters too — a big non-polar molecule can out-boil a small polar one.' };
}

/* ── Module 7: polymers ─────────────────────────────────────────────────── */
function genChPoly(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk([
      { p:'polyethene', m:'ethene', t:'addition' }, { p:'polyvinyl chloride', m:'chloroethene', t:'addition' },
      { p:'polystyrene', m:'styrene (ethenylbenzene)', t:'addition' }, { p:'polypropene', m:'propene', t:'addition' },
      { p:'nylon', m:'a diamine and a dicarboxylic acid', t:'condensation' },
      { p:'polyester (PET)', m:'a diol and a dicarboxylic acid', t:'condensation' }
    ]);
    const m = mc(e.m, shuffle(['ethene', 'chloroethene', 'propene', 'styrene (ethenylbenzene)',
      'a diamine and a dicarboxylic acid', 'a diol and a dicarboxylic acid'].filter(x => x !== e.m)).slice(0, 4));
    return { q:'Which <b>monomer</b> makes <b>' + e.p + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-monomer', p:e.p },
      note:e.p + ' is a ' + e.t + ' polymer. ' + (e.t === 'addition' ? 'Addition polymers come from monomers with a C=C, and nothing is lost when they join.' : 'Condensation polymers form by losing a small molecule — water here — at every link.') };
  }
  if (k === 1){
    const add = Math.random() < 0.5;
    const m = mc(add ? 'The monomers have a C=C that opens, and no atoms are lost.'
                     : 'A small molecule such as water is lost at every link.',
      [add ? 'A small molecule such as water is lost at every link.' : 'The monomers have a C=C that opens, and no atoms are lost.',
       'The polymer always has a higher melting point than its monomer only in this type.',
       'Only this type can be recycled.']);
    return { q:'What makes a polymer an <b>' + (add ? 'addition' : 'condensation') + '</b> polymer?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-polytype', add },
      note:'Addition keeps every atom of every monomer; condensation loses a small molecule each time, so the repeating unit is lighter than the monomers it came from.' };
  }
  const n = ri(100, 5000), M = pk([28, 42, 62.5, 104]);
  const mass = n * M;
  return { q:'A sample of an addition polymer contains <b>' + n + '</b> repeating units of mass <b>' + M + ' g mol' + sup(-1) + '</b>. Find the <b>molar mass</b> of the polymer chain.',
    input:true, answer:mass, accept:qty(mass, { tol:Math.max(1, mass * 0.002), dim:'molarmass' }), data:{ kind:'ch-polymass', n, M },
    note:'Addition polymerisation loses nothing, so the chain is simply ' + n + ' × ' + M + ' = ' + mass + ' g mol' + sup(-1) + '.' };
}

/* ── Module 8: analysing inorganic substances ───────────────────────────── */
function genChInorg(){
  const k = ri(0, 3);
  if (k === 0){
    const e = pk([
      { ion:'Ba²⁺', test:'a green flame', w:['a lilac flame', 'a brick-red flame', 'a yellow flame'] },
      { ion:'Ca²⁺', test:'a brick-red flame', w:['a green flame', 'a lilac flame', 'a yellow flame'] },
      { ion:'K⁺', test:'a lilac flame', w:['a green flame', 'a brick-red flame', 'a yellow flame'] },
      { ion:'Na⁺', test:'a yellow flame', w:['a green flame', 'a lilac flame', 'a brick-red flame'] },
      { ion:'Cu²⁺', test:'a blue-green flame', w:['a lilac flame', 'a brick-red flame', 'a yellow flame'] }
    ]);
    const m = mc(e.test, e.w);
    return { q:'What does a <b>flame test</b> show for <b>' + e.ion + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-flame', ion:e.ion },
      note:'Heating excites the outer electrons; as they fall back they emit photons at wavelengths set by the energy levels, which is why each metal has its own colour.' };
  }
  if (k === 1){
    const e = pk([
      { ion:'Cl⁻', test:'a white precipitate with silver nitrate that does not dissolve in dilute nitric acid', w:['a white precipitate with barium nitrate', 'a bubbling gas with dilute acid', 'a blue precipitate with sodium hydroxide'] },
      { ion:'SO₄²⁻', test:'a white precipitate with barium nitrate', w:['a white precipitate with silver nitrate', 'a bubbling gas with dilute acid', 'a brown precipitate with sodium hydroxide'] },
      { ion:'CO₃²⁻', test:'bubbling with dilute acid, giving a gas that turns limewater milky', w:['a white precipitate with barium nitrate', 'a white precipitate with silver nitrate', 'a green flame'] },
      { ion:'Cu²⁺', test:'a blue precipitate with sodium hydroxide', w:['a white precipitate with silver nitrate', 'a green precipitate with sodium hydroxide', 'no reaction with sodium hydroxide'] },
      { ion:'Fe³⁺', test:'a red-brown precipitate with sodium hydroxide', w:['a green precipitate with sodium hydroxide', 'a blue precipitate with sodium hydroxide', 'a white precipitate with barium nitrate'] }
    ]);
    const m = mc(e.test, e.w);
    return { q:'Which test identifies <b>' + e.ion + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-iontest', ion:e.ion },
      note:'Analysis works by elimination: each step must rule out ions that would otherwise interfere, which is why the order of the tests matters.' };
  }
  if (k === 2){                                   // AAS calibration
    const slope = rd(ri(5, 40) / 100, 2), A = rd(ri(10, 90) / 100, 2);
    const conc = A / slope;
    return { q:'An atomic absorption spectrometer gives a calibration line of <b>absorbance = ' + slope + ' × concentration</b> (in mg L' + sup(-1) + '). A sample reads <b>' + A + '</b>. Find its <b>concentration</b>, to 3 significant figures.',
      input:true, answer:rd(conc, 3), accept:qty(conc, { tol:Math.max(0.002, conc * 0.005) }), data:{ kind:'ch-aas', slope, A },
      note:'Rearranging, concentration = absorbance/slope = ' + A + '/' + slope + ' = ' + rd(conc, 3) + ' mg L' + sup(-1) + '. AAS suits trace metals because each element absorbs at its own wavelength.' };
  }
  const m = mc('Gravimetric analysis, where the ion is precipitated, filtered, dried and weighed.',
    ['A flame test, judged by eye.', 'A pH measurement.',
     'A colour change with an indicator.', 'Measuring the volume of gas released.']);
  return { q:'Which method gives a <b>quantitative</b> result for an ion that forms an insoluble salt?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-gravimetric' },
    note:'Flame tests and precipitate colours identify an ion; weighing a dried precipitate of known formula measures how much there was.' };
}

/* ── Module 8: analysing organic substances ─────────────────────────────── */
function genChOrgAnalysis(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk([
      { tech:'infrared spectroscopy', a:'which functional groups are present, from the bonds that absorb', w:['the exact molar mass', 'the number of hydrogen environments', 'the concentration of a metal ion'] },
      { tech:'mass spectrometry', a:'the molar mass, from the molecular ion peak', w:['which functional groups are present', 'the number of carbon environments', 'the pH of the sample'] },
      { tech:'¹H NMR spectroscopy', a:'how many hydrogen environments there are, and how many hydrogens in each', w:['the molar mass', 'the concentration of a metal ion', 'the boiling point'] },
      { tech:'¹³C NMR spectroscopy', a:'how many different carbon environments there are', w:['the molar mass', 'which metals are present', 'the melting point'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What does <b>' + e.tech + '</b> tell you about an organic compound?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-technique', tech:e.tech },
      note:'A structure is usually pieced together from several of these: mass spectrometry fixes the formula, infrared names the groups, and NMR shows how they are arranged.' };
  }
  if (k === 1){
    const e = pk([
      { peak:'a broad absorption around 3300 cm' + sup(-1), a:'an O–H group in an alcohol', w:['a C=O group', 'a C≡N group', 'a C–Cl bond'] },
      { peak:'a strong sharp absorption near 1700 cm' + sup(-1), a:'a C=O group', w:['an O–H group', 'a C–H bond', 'a C=C bond'] },
      { peak:'a very broad absorption from 2500 to 3300 cm' + sup(-1) + ' with a peak near 1700', a:'a carboxylic acid', w:['an alcohol', 'an alkane', 'an amine'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'In an infrared spectrum, what does <b>' + e.peak + '</b> indicate?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-ir', peak:e.peak },
      note:'Each bond absorbs where it vibrates. Hydrogen bonding is what broadens the O–H absorption, and a carboxylic acid shows both the broad O–H and the sharp C=O.' };
  }
  const e = pk([
    { c:'CH₃CH₂OH', n:3 }, { c:'CH₃OCH₃', n:1 }, { c:'CH₃COCH₃', n:1 }, { c:'CH₃CH₂CH₂OH', n:4 }
  ]);
  return { q:'How many <b>hydrogen environments</b> does <b>' + e.c + '</b> have, so how many peaks appear in its ¹H NMR spectrum?',
    input:true, answer:e.n, accept:qty(e.n, { tol:0.4 }), data:{ kind:'ch-nmr', c:e.c, n:e.n },
    note:'Hydrogens are in the same environment when the molecule is symmetric about them. ' + e.c + ' has ' + e.n + '.' };
}

/* ── Module 8: synthesis and design ─────────────────────────────────────── */
function genChSynth(){
  const k = ri(0, 3);
  if (k === 0){                                   // percentage yield
    const theory = rd(ri(50, 400) / 10, 1), actual = rd(theory * ri(40, 95) / 100, 2);
    const y = actual / theory * 100;
    return { q:'A synthesis has a theoretical yield of <b>' + theory + ' g</b> and actually produces <b>' + actual + ' g</b>. Find the <b>percentage yield</b>, to 2 decimal places.',
      input:true, answer:rd(y, 2), accept:qty(y, { tol:0.05 }), data:{ kind:'ch-yield', theory, actual },
      note:'% yield = actual/theoretical × 100 = ' + actual + '/' + theory + ' × 100 = ' + rd(y, 2) + '%. Losses come from side reactions, transfers and equilibria that do not run to completion.' };
  }
  if (k === 1){                                   // the Haber process conditions
    const e = pk([
      { p:'the Haber process', c:'around 400–500 °C, 200–400 atm, with an iron catalyst',
        w:['room temperature and pressure, with no catalyst', 'very low temperature and low pressure', '1000 °C and 1 atm'],
        why:'the reaction is exothermic, so a low temperature would give a better yield but far too slowly — the temperature chosen is a compromise, and the high pressure favours the side with fewer gas molecules' },
      { p:'the contact process', c:'around 400–450 °C, about 2 atm, with a vanadium(V) oxide catalyst',
        w:['1000 °C and 300 atm', 'room temperature with no catalyst', 'low temperature and very high pressure'],
        why:'the yield is already high at modest pressure, so there is no reason to pay for more; the temperature is again a compromise between rate and yield' }
    ]);
    const m = mc(e.c, e.w);
    return { q:'Which conditions are used for <b>' + e.p + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'ch-industrial', p:e.p },
      note:'They are chosen because ' + e.why + '.' };
  }
  if (k === 2){                                   // atom economy
    const wanted = ri(20, 180), total = wanted + ri(10, 120);
    const ae = wanted / total * 100;
    return { q:'A reaction makes <b>' + wanted + ' g mol' + sup(-1) + '</b> of wanted product out of <b>' + total + ' g mol' + sup(-1) + '</b> of total products. Find the <b>atom economy</b>, to 2 decimal places.',
      input:true, answer:rd(ae, 2), accept:qty(ae, { tol:0.05 }), data:{ kind:'ch-atomecon', wanted, total },
      note:'Atom economy = mass of wanted product/total mass of products × 100 = ' + rd(ae, 2) + '%. It measures waste built into the equation itself, which a high percentage yield cannot fix.' };
  }
  const m = mc('Yield measures how much of the possible product you actually got; atom economy measures how much of the reactant mass ends up in the product you want.',
    ['They are two names for the same measurement.',
     'Atom economy is yield measured in moles.',
     'Yield counts only the catalyst.',
     'Atom economy can be improved by running the reaction for longer.']);
  return { q:'What is the difference between <b>percentage yield</b> and <b>atom economy</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'ch-yield-vs-ae' },
    note:'A reaction can have a perfect yield and a poor atom economy if the equation itself throws away half the mass as by-products. Green chemistry cares about both.' };
}

/* ── Module 8: quantitative analysis ────────────────────────────────────── */
function genChQuant(){
  const k = ri(0, 2);
  if (k === 0){                                   // back titration
    const nExcess = rd(ri(10, 90) / 1000, 4), nAdded = rd(nExcess + ri(10, 90) / 1000, 4);
    const nReacted = rd(nAdded - nExcess, 4);
    return { q:'In a back titration, <b>' + nAdded + ' mol</b> of acid is added to a solid, and the excess acid left over is found to be <b>' + nExcess + ' mol</b>. How many <b>moles of acid reacted</b> with the solid?',
      input:true, answer:nReacted, accept:qty(nReacted, { tol:0.0005, dim:'amount' }), data:{ kind:'ch-back', nAdded, nExcess },
      note:'What reacted is what was added minus what was left: ' + nAdded + ' − ' + nExcess + ' = ' + nReacted + ' mol. Back titration suits a solid that dissolves too slowly to titrate directly.' };
  }
  if (k === 1){                                   // gravimetric analysis
    const mass = rd(ri(100, 900) / 100, 2), pct = rd(ri(200, 800) / 10, 1);
    const found = mass * pct / 100;
    return { q:'A <b>' + mass + ' g</b> sample is analysed and found to contain <b>' + pct + '%</b> of a compound by mass. What <b>mass</b> of the compound is present? Give 4 decimal places.',
      input:true, answer:rd(found, 4), accept:qty(found, { tol:0.0005, dim:'mass' }), data:{ kind:'ch-gravcalc', mass, pct },
      note:mass + ' × ' + pct + '/100 = ' + rd(found, 4) + ' g. In practice the precipitate is washed and dried to constant mass first, so nothing else is weighed with it.' };
  }
  const c1 = rd(ri(5, 90) / 10, 1), V2 = pk([100, 250, 500, 1000]), V1 = rd(ri(5, 50), 0);
  const c2 = c1 * V1 / V2;
  return { q:'<b>' + V1 + ' mL</b> of a <b>' + c1 + ' mol L' + sup(-1) + '</b> stock solution is diluted to <b>' + V2 + ' mL</b>. Find the <b>new concentration</b>, to 4 decimal places.',
    input:true, answer:rd(c2, 4), accept:qty(c2, { tol:0.0005, dim:'conc' }), data:{ kind:'ch-dilution', c1, V1, V2 },
    note:'The moles do not change, so c₁V₁ = c₂V₂ and c₂ = ' + c1 + ' × ' + V1 + '/' + V2 + ' = ' + rd(c2, 4) + ' mol L' + sup(-1) + '.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
const MODULES_CH12 = [
  { id:'ch-m5', name:'Equilibrium & acids', topics:[
    { id:'c12-eq', name:'Equilibrium & Le Chatelier', gen:genChEquil },
    { id:'c12-keq', name:'The equilibrium constant', gen:genChKeq },
    { id:'c12-ksp', name:'Solubility equilibria', gen:genChKsp }]},
  { id:'ch-m6', name:'Acid/base reactions', topics:[
    { id:'c12-ph', name:'pH & strong acids', gen:genChPH },
    { id:'c12-ka', name:'Weak acids & Ka', gen:genChKa },
    { id:'c12-titr', name:'Titration', gen:genChTitr },
    { id:'c12-buff', name:'Conjugates & buffers', gen:genChBuffer }]},
  { id:'ch-m7', name:'Organic chemistry', topics:[
    { id:'c12-name', name:'Naming & isomers', gen:genChName },
    { id:'c12-rxn', name:'Organic reactions', gen:genChOrgRxn },
    { id:'c12-prop', name:'Properties & forces', gen:genChProps },
    { id:'c12-poly', name:'Polymers', gen:genChPoly }]},
  { id:'ch-m8', name:'Applying chemical ideas', topics:[
    { id:'c12-inorg', name:'Inorganic analysis', gen:genChInorg },
    { id:'c12-org', name:'Organic analysis', gen:genChOrgAnalysis },
    { id:'c12-synth', name:'Synthesis & design', gen:genChSynth },
    { id:'c12-quant', name:'Quantitative analysis', gen:genChQuant }]}
];
BUILD.chem12 = host => revGame(host, { title:'Chemistry (Year 12)',
  how:'Modules 5 to 8 of the 2017 syllabus. Pick a module, or do the lot.', statKey:'chem12', modules:MODULES_CH12 });

GAMES.push({ id:'chem12', cat:'Revision', year:12, ico:'⚗️', name:'Chemistry',
  blurb:'Equilibrium, acids and bases, organic, analysis' });

/* ── Chemistry: long-response questions for the mock paper ──────────────── */
const LONG_CH12 = [
  /* equilibrium and the industrial compromise */
  () => {
    const T = pk([400, 450, 500]), P = pk([200, 250, 350]);
    return { mod:'ch-m5',
      q:'The Haber process is <b>N₂(g) + 3H₂(g) ⇌ 2NH₃(g)</b>, ΔH = −92 kJ mol' + sup(-1) + '. Industrially it is run at about <b>' + T + ' °C</b> and <b>' + P + ' atm</b> over an iron catalyst.' +
        '<br>(a) Predict and explain the effect of increasing the pressure on the yield of ammonia. <b>(2 marks)</b>' +
        '<br>(b) Explain why a temperature of ' + T + ' °C is used even though a lower temperature would give a higher yield. <b>(2 marks)</b>' +
        '<br>(c) Explain the role of the catalyst and its effect on the position of equilibrium. <b>(2 marks)</b>',
      guide:['(a) States that the yield increases',
             '(a) Explains that there are 4 gas molecules on the left and 2 on the right, so the system shifts right to oppose the pressure rise',
             '(b) States that the forward reaction is exothermic, so a lower temperature would favour ammonia',
             '(b) Explains that the rate would be far too slow, so the temperature is a compromise between rate and yield',
             '(c) States that the catalyst lowers the activation energy and speeds both directions equally',
             '(c) States that it does not change the position of equilibrium or the value of K'],
      model:'Raising the pressure shifts the equilibrium to the side with fewer gas molecules — the right — so the yield of ammonia rises. The forward reaction is exothermic, so cooling would raise the yield, but the rate would collapse and the plant would take far too long to reach equilibrium; ' + T + ' °C is the compromise. The iron catalyst speeds up both the forward and reverse reactions by the same factor, so equilibrium arrives sooner but at exactly the same place.' };
  },
  /* an ICE table */
  () => {
    const a0 = rd(ri(20, 90) / 100, 2), used = rd(a0 * ri(20, 50) / 100, 3);
    const left = rd(a0 - used, 4), hi = rd(2 * used, 4);
    const K = hi * hi / (left * left);
    return { mod:'ch-m5',
      q:'<b>H₂(g) + I₂(g) ⇌ 2HI(g)</b>. A 1.00 L flask is charged with <b>' + a0 + ' mol</b> of H₂ and <b>' + a0 + ' mol</b> of I₂. At equilibrium <b>' + hi + ' mol</b> of HI is present.' +
        '<br>(a) Calculate the equilibrium concentrations of H₂ and I₂. <b>(2 marks)</b>' +
        '<br>(b) Calculate the equilibrium constant. <b>(2 marks)</b>' +
        '<br>(c) State what the value of K tells you about this equilibrium. <b>(1 mark)</b>',
      guide:['(a) Uses the 1:1:2 ratio to find that ' + used + ' mol of each reactant was used',
             '(a) Equilibrium concentrations ' + left + ' mol L' + sup(-1) + ' each',
             '(b) Writes K = [HI]²/([H₂][I₂])',
             '(b) K = ' + rd(K, 3),
             '(c) States that K ' + (K > 1 ? 'is greater than 1, so products are favoured' : 'is less than 1, so reactants are favoured')],
      model:'Each mole of HI formed uses half a mole of H₂ and half of I₂, so ' + used + ' mol of each is consumed, leaving ' + left + ' mol L' + sup(-1) + ' of each. Then K = ' + hi + '²/(' + left + ' × ' + left + ') = ' + rd(K, 3) + ', which being ' + (K > 1 ? 'greater' : 'less') + ' than 1 means the equilibrium lies towards the ' + (K > 1 ? 'products' : 'reactants') + '.' };
  },
  /* solubility */
  () => {
    const s = pk(CH_SALTS);
    const n = s.cat + s.an, coef = Math.pow(s.cat, s.cat) * Math.pow(s.an, s.an);
    const sol = Math.pow(s.ksp / coef, 1 / n);
    return { mod:'ch-m5',
      q:'<b>' + s.f + '</b> has K<sub>sp</sub> = <b>' + phSci(s.ksp, 2) + '</b> at 25 °C.' +
        '<br>(a) Write the equation for its dissolution and the expression for K<sub>sp</sub>. <b>(2 marks)</b>' +
        '<br>(b) Calculate its molar solubility in pure water. <b>(2 marks)</b>' +
        '<br>(c) Explain what happens to that solubility if a soluble salt containing one of the same ions is added. <b>(2 marks)</b>',
      guide:['(a) Writes the dissolution equation with the correct ' + s.cat + ':' + s.an + ' ratio',
             '(a) Writes K_sp as the product of the ion concentrations raised to those powers',
             '(b) Sets up K_sp = ' + (coef === 1 ? 's' + sup(n) : coef + 's' + sup(n)),
             '(b) Molar solubility ' + phSci(sol) + ' mol L' + sup(-1),
             '(c) States that the solubility decreases',
             '(c) Explains that K_sp is fixed, so raising one ion’s concentration forces the other down and the equilibrium shifts back to the solid'],
      model:'Writing s for the molar solubility, the ions appear in a ' + s.cat + ':' + s.an + ' ratio, so K_sp = ' + (coef === 1 ? 's' + sup(n) : coef + 's' + sup(n)) + ' and s = ' + phSci(sol) + ' mol L' + sup(-1) + '. Adding a common ion raises one concentration, and since their product must stay at K_sp, the other falls — less solid dissolves. This is the common ion effect, and K_sp itself does not change unless the temperature does.' };
  },
  /* titration */
  () => {
    const cB = rd(ri(80, 150) / 1000, 3), vB = rd(ri(180, 260) / 10, 1), vA = 25.0;
    const cA = cB * vB / vA;
    return { mod:'ch-m6',
      q:'A <b>25.0 mL</b> aliquot of hydrochloric acid of unknown concentration is titrated against <b>' + cB + ' mol L' + sup(-1) + '</b> sodium hydroxide. The average titre is <b>' + vB + ' mL</b>.' +
        '<br>(a) Calculate the concentration of the acid. <b>(3 marks)</b>' +
        '<br>(b) Name a suitable indicator and justify the choice. <b>(2 marks)</b>' +
        '<br>(c) Explain why the burette is rinsed with the solution it will hold, but the conical flask is rinsed with distilled water only. <b>(2 marks)</b>',
      guide:['(a) n(NaOH) = cV = ' + phSci(cB * vB / 1000, 3) + ' mol',
             '(a) Uses the 1:1 mole ratio',
             '(a) c(HCl) = ' + rd(cA, 4) + ' mol L' + sup(-1),
             '(b) Names an indicator that changes in the steep part of the curve (the equivalence point is pH 7 here, so almost any will do)',
             '(b) Justifies it by the range of the colour change against the equivalence pH',
             '(c) States that water left in the burette would dilute the titrant and change its concentration',
             '(c) States that water in the flask does not change the number of moles of aliquot, so it has no effect on the result'],
      model:'n(NaOH) = ' + cB + ' × ' + rd(vB / 1000, 5) + ' = ' + phSci(cB * vB / 1000, 3) + ' mol. The reaction is 1:1, so the same number of moles of HCl was in 25.0 mL, giving c = ' + rd(cA, 4) + ' mol L' + sup(-1) + '. A strong acid with a strong base has a very steep curve through pH 7, so phenolphthalein or bromothymol blue both work. Rinsing the burette with titrant stops residual water diluting it; the flask may stay wet because extra water changes the volume but not the moles of acid delivered by the pipette.' };
  },
  /* strong against weak */
  () => {
    const a = pk(CH_WEAK), conc = pk([0.1, 0.5, 1.0]);
    const h = Math.sqrt(a.ka * conc), pHw = -Math.log10(h), pHs = -Math.log10(conc);
    return { mod:'ch-m6',
      q:'Two solutions are both <b>' + conc + ' mol L' + sup(-1) + '</b>: one of hydrochloric acid, the other of <b>' + a.n + '</b> (K<sub>a</sub> = ' + phSci(a.ka, 3) + ').' +
        '<br>(a) Calculate the pH of each. <b>(3 marks)</b>' +
        '<br>(b) Explain the difference in terms of ionisation. <b>(2 marks)</b>' +
        '<br>(c) Both are titrated with sodium hydroxide. Compare the pH at the equivalence point. <b>(2 marks)</b>',
      guide:['(a) pH of the strong acid = ' + rd(pHs, 2),
             '(a) Uses [H⁺] = √(K_a c) for the weak acid',
             '(a) pH of ' + a.n + ' = ' + rd(pHw, 2),
             '(b) States that the strong acid ionises completely while the weak acid only partly ionises',
             '(b) Links the smaller [H⁺] of the weak acid to its higher pH at the same concentration',
             '(c) States that the strong acid gives pH 7 at equivalence',
             '(c) States that the weak acid gives a pH above 7, because its conjugate base hydrolyses'],
      model:'HCl is fully ionised, so [H⁺] = ' + conc + ' and pH = ' + rd(pHs, 2) + '. For ' + a.n + ', [H⁺] ≈ √(K_a c) = ' + phSci(h, 3) + ', so pH = ' + rd(pHw, 2) + '. The difference is ionisation, not concentration: only a small fraction of the weak acid donates its proton. On titration with a strong base, the strong acid reaches equivalence at pH 7, while the weak acid leaves behind its conjugate base, which takes a proton from water and lifts the equivalence pH above 7.' };
  },
  /* buffers */
  () => {
    const a = pk(CH_WEAK), pKa = -Math.log10(a.ka), ratio = pk([0.5, 1, 2]);
    const pH = pKa + Math.log10(ratio);
    return { mod:'ch-m6',
      q:'A buffer is made from <b>' + a.n + '</b> (pK<sub>a</sub> = ' + rd(pKa, 2) + ') and its sodium salt, with <b>[base]/[acid] = ' + ratio + '</b>.' +
        '<br>(a) Calculate the pH of the buffer. <b>(2 marks)</b>' +
        '<br>(b) Explain, with equations, how it resists a change in pH when a small amount of strong acid is added. <b>(3 marks)</b>',
      guide:['(a) Uses pH = pK_a + log([base]/[acid])',
             '(a) pH = ' + rd(pH, 2),
             '(b) Writes the reaction of added H⁺ with the conjugate base',
             '(b) Explains that the added H⁺ is converted into the weak acid rather than staying free',
             '(b) Notes that the ratio changes only slightly, and the pH depends on its logarithm'],
      model:'pH = ' + rd(pKa, 2) + ' + log(' + ratio + ') = ' + rd(pH, 2) + '. Added H⁺ reacts with the conjugate base A⁻ + H⁺ → HA, so most of it is removed from solution; added OH⁻ would instead react with HA. Because only the ratio of the two matters, and only through a logarithm, a small shift in it barely moves the pH — until one component runs out, which is where the buffer capacity ends.' };
  },
  /* an organic pathway */
  () => {
    const n = ri(2, 4), stem = CH_STEM[n - 1];
    return { mod:'ch-m7',
      q:'Consider this sequence: <b>' + stem + 'ene → ' + stem + 'an-1-ol → ' + stem + 'anoic acid → an ester</b>.' +
        '<br>(a) State the reagents and conditions for each step. <b>(3 marks)</b>' +
        '<br>(b) Name the type of reaction in each step. <b>(2 marks)</b>' +
        '<br>(c) Explain why the esterification is carried out with concentrated sulfuric acid. <b>(1 mark)</b>',
      guide:['(a) Step 1: steam and an acid catalyst (hydration)',
             '(a) Step 2: acidified potassium dichromate, heated under reflux',
             '(a) Step 3: an alcohol with concentrated sulfuric acid, heated',
             '(b) Names step 1 as addition (hydration) and step 2 as oxidation',
             '(b) Names step 3 as esterification, a condensation reaction',
             '(c) States that the sulfuric acid is a catalyst and a dehydrating agent, pushing the equilibrium towards the ester'],
      model:stem + 'ene adds water across its double bond with steam over an acid catalyst to give ' + stem + 'an-1-ol. The primary alcohol is oxidised by acidified dichromate under reflux — reflux so the volatile intermediate aldehyde is not lost — to ' + stem + 'anoic acid. The acid and an alcohol then condense into an ester, with concentrated sulfuric acid acting as both catalyst and dehydrating agent, removing the water and shifting the equilibrium towards the product.' };
  },
  /* physical properties */
  () => {
    const n = ri(3, 5), stem = CH_STEM[n - 1];
    return { mod:'ch-m7',
      q:'Compare <b>' + stem + 'ane</b>, <b>' + stem + 'an-1-ol</b> and <b>' + stem + 'anoic acid</b>, which all have the same number of carbons.' +
        '<br>(a) Rank them in order of increasing boiling point. <b>(1 mark)</b>' +
        '<br>(b) Explain the ranking in terms of intermolecular forces. <b>(3 marks)</b>' +
        '<br>(c) Explain how their solubility in water differs. <b>(2 marks)</b>',
      guide:['(a) ' + stem + 'ane < ' + stem + 'an-1-ol < ' + stem + 'anoic acid',
             '(b) States that the alkane has dispersion forces only',
             '(b) States that the alcohol can hydrogen bond through its –OH',
             '(b) States that the carboxylic acid hydrogen bonds more strongly, pairing into dimers',
             '(c) States that the alkane is insoluble while the alcohol and acid are soluble',
             '(c) Explains that hydrogen bonding with water is what dissolves them, and that solubility falls as the chain lengthens'],
      model:'The order is ' + stem + 'ane < ' + stem + 'an-1-ol < ' + stem + 'anoic acid. The alkane is non-polar, so only dispersion forces hold it together. The alcohol’s –OH hydrogen bonds, which takes much more energy to separate. The carboxylic acid has both a C=O and an O–H and forms hydrogen-bonded dimers, so it boils highest of the three. The same hydrogen bonding makes the alcohol and the acid soluble in water while the alkane is not, though solubility drops away as the non-polar chain grows.' };
  },
  /* identifying an unknown */
  () => {
    const e = pk([
      { ion:'Ba²⁺ and SO₄²⁻', t1:'a green flame test', t2:'a white precipitate with barium nitrate' },
      { ion:'Ca²⁺ and CO₃²⁻', t1:'a brick-red flame test', t2:'bubbling with dilute acid, turning limewater milky' },
      { ion:'Cu²⁺ and Cl⁻', t1:'a blue precipitate with sodium hydroxide', t2:'a white precipitate with silver nitrate that will not dissolve in dilute nitric acid' }
    ]);
    return { mod:'ch-m8',
      q:'An unknown ionic compound gives <b>' + e.t1 + '</b> and <b>' + e.t2 + '</b>.' +
        '<br>(a) Identify the two ions present. <b>(2 marks)</b>' +
        '<br>(b) Explain how each test supports your answer. <b>(2 marks)</b>' +
        '<br>(c) Explain why the order of the tests in a scheme of analysis matters. <b>(2 marks)</b>',
      guide:['(a) Identifies the cation correctly',
             '(a) Identifies the anion correctly',
             '(b) Links the first test to the ion it identifies',
             '(b) Links the second test to the ion it identifies',
             '(c) States that one ion can interfere with the test for another',
             '(c) Gives an example, such as removing interfering ions by precipitation before testing for the next'],
      model:'The compound contains ' + e.ion + '. Each test is characteristic: the first is specific to the cation, and the second to the anion. Order matters because some ions mask others — several form white precipitates with silver nitrate, for instance — so a scheme removes or rules out interfering ions before the next test, and a test that is not specific on its own only narrows the possibilities.' };
  },
  /* polymers */
  () => {
    const e = pk([{ p:'polyethene', m:'ethene', t:'addition' }, { p:'polyvinyl chloride', m:'chloroethene', t:'addition' },
                  { p:'polypropene', m:'propene', t:'addition' }]);
    const n = ri(200, 4000), M = pk([28, 42, 62.5]);
    return { mod:'ch-m7',
      q:'<b>' + e.p + '</b> is made from <b>' + e.m + '</b>.' +
        '<br>(a) Name the type of polymerisation and explain what happens to the monomer. <b>(2 marks)</b>' +
        '<br>(b) A chain contains ' + n + ' repeating units of molar mass ' + M + ' g mol' + sup(-1) + '. Calculate the molar mass of the chain. <b>(2 marks)</b>' +
        '<br>(c) Explain why this polymer softens on heating, while a cross-linked polymer does not. <b>(2 marks)</b>',
      guide:['(a) Names addition polymerisation',
             '(a) Explains that the C=C opens so the monomers join with nothing lost',
             '(b) Multiplies the repeating unit mass by the number of units',
             '(b) Molar mass ' + (n * M) + ' g mol' + sup(-1),
             '(c) States that the chains are held by dispersion forces only, which are overcome by heating',
             '(c) States that cross-links are covalent bonds between chains, so the material cannot flow'],
      model:'The double bond in ' + e.m + ' opens and the monomers join end to end, losing nothing, so the chain is simply ' + n + ' × ' + M + ' = ' + (n * M) + ' g mol' + sup(-1) + '. Separate chains are held together only by dispersion forces, so heat lets them slide past each other — the polymer is thermosoftening. Cross-linking replaces those weak attractions with covalent bonds, which do not let go, so the material keeps its shape until it decomposes.' };
  },
  /* identifying an organic compound from spectra */
  () => {
    const e = pk([
      { c:'ethanol', ir:'a broad absorption near 3300 cm' + sup(-1), nmr:'three hydrogen environments', ms:'46' },
      { c:'ethanoic acid', ir:'a very broad absorption from 2500 to 3300 cm' + sup(-1) + ' and a sharp peak near 1700 cm' + sup(-1), nmr:'two hydrogen environments', ms:'60' },
      { c:'propanone', ir:'a strong sharp absorption near 1700 cm' + sup(-1) + ' and no O–H', nmr:'one hydrogen environment', ms:'58' }
    ]);
    return { mod:'ch-m7',
      q:'An unknown organic liquid gives a molecular ion peak at <b>m/z = ' + e.ms + '</b>, <b>' + e.ir + '</b> in its infrared spectrum, and <b>' + e.nmr + '</b> in its ¹H NMR spectrum.' +
        '<br>(a) Identify the compound. <b>(1 mark)</b>' +
        '<br>(b) Explain how each piece of evidence supports your answer. <b>(3 marks)</b>' +
        '<br>(c) Explain why no single technique would have been enough. <b>(2 marks)</b>',
      guide:['(a) Identifies the compound as ' + e.c,
             '(b) Links the mass spectrum peak to the molar mass',
             '(b) Links the infrared absorption to the functional group present (or absent)',
             '(b) Links the number of NMR environments to the symmetry of the structure',
             '(c) States that each technique gives only part of the picture',
             '(c) Gives an example of two compounds that one technique alone could not separate'],
      model:'The compound is ' + e.c + '. The molecular ion at m/z = ' + e.ms + ' fixes the molar mass; the infrared evidence identifies the functional group; and the count of hydrogen environments shows how the atoms are arranged. On its own the mass spectrum cannot separate isomers of the same formula, infrared names a group without saying where it sits, and NMR counts environments without giving the formula — together they pin the structure down.' };
  },
  /* yield and green chemistry */
  () => {
    const theory = rd(ri(80, 300) / 10, 1), actual = rd(theory * ri(50, 92) / 100, 2);
    const y = actual / theory * 100;
    const wanted = ri(40, 120), total = wanted + ri(20, 90);
    const ae = wanted / total * 100;
    return { mod:'ch-m8',
      q:'A synthesis has a theoretical yield of <b>' + theory + ' g</b> and produces <b>' + actual + ' g</b>. Of the <b>' + total + ' g mol' + sup(-1) + '</b> of products formed by the equation, <b>' + wanted + ' g mol' + sup(-1) + '</b> is the wanted product.' +
        '<br>(a) Calculate the percentage yield. <b>(2 marks)</b>' +
        '<br>(b) Calculate the atom economy. <b>(2 marks)</b>' +
        '<br>(c) Explain why a chemist designing an industrial process cares about both. <b>(2 marks)</b>',
      guide:['(a) Uses actual/theoretical × 100',
             '(a) Percentage yield ' + rd(y, 1) + '%',
             '(b) Uses the mass of wanted product/total mass of products × 100',
             '(b) Atom economy ' + rd(ae, 1) + '%',
             '(c) States that yield measures how well the reaction was carried out, while atom economy measures waste built into the equation',
             '(c) Relates a poor atom economy to waste disposal and cost even when the yield is high'],
      model:'Percentage yield = ' + actual + '/' + theory + ' × 100 = ' + rd(y, 1) + '%, and atom economy = ' + wanted + '/' + total + ' × 100 = ' + rd(ae, 1) + '%. The first can be improved by better technique, conditions or purification; the second cannot, because it is fixed by the equation itself. A route with a perfect yield but a poor atom economy still throws away most of its reactant mass as by-products, which costs money to buy and money to dispose of.' };
  }
];

/* every Year 12 science generator goes through the minus-sign repair too */
[MODULES_PH12, MODULES_CH12].forEach(ms => ms.forEach(m => m.topics.forEach(t => { t.gen = tidyQ(t.gen); })));

if (typeof REVISION_PAGE !== "undefined" && REVISION_PAGE) showGrid();
