/* ══════════════════════════════════════════════════════════════════════════
   ENGINEERING STUDIES — YEAR 12

   Engineering Studies Stage 6 Syllabus (2011); no replacement announced. The
   HSC modules are Civil Structures, Personal and Public Transport,
   Aeronautical Engineering and Telecommunications Engineering, with the
   focus areas (mechanics, materials, communication, historical and societal
   influences, the profession) running through all of them.

   HSC paper: 100 marks, 3 hours, 5 minutes reading. Section I is 20
   objective-response marks; Section II is 80 marks over about seven
   questions, with the four modules weighted roughly equally.

   Engineering takes g = 10 m s⁻², as the course does. Physics keeps 9.8.
   ══════════════════════════════════════════════════════════════════════════ */

const EN_G = 10;

/* ── Civil structures: materials ────────────────────────────────────────── */
function genEnCivMat(){
  const k = ri(0, 3);
  if (k === 0){
    const e = pk([
      { ask:'concrete', a:'strong in compression but weak in tension', w:['strong in tension but weak in compression', 'equally strong in both', 'weak in both'],
        why:'which is why steel reinforcement is placed where the tension is' },
      { ask:'structural steel', a:'strong in both tension and compression, and ductile', w:['strong only in compression', 'brittle at room temperature', 'weak in tension'],
        why:'its ductility gives warning before failure, unlike a brittle material' },
      { ask:'cast iron', a:'strong in compression but brittle in tension', w:['ductile and tough', 'strong in tension', 'immune to corrosion'],
        why:'the graphite flakes act as internal notches, which is why old cast-iron bridges are arches' }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Which statement describes <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-civmat', ask:e.ask },
      note:'That is ' + e.why + '.' };
  }
  if (k === 1){
    const m = mc('The steel is tensioned before the load is applied, so the concrete stays in compression.',
      ['The steel is heated so it expands and grips the concrete.',
       'Extra cement is added so the concrete is stronger.',
       'The concrete is poured in layers to stop cracks.',
       'The steel is coated so it cannot corrode.']);
    return { q:'What makes a beam <b>prestressed</b> concrete?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-prestress' },
      note:'Concrete cracks in tension, so pre-compressing it means the working load has to overcome that compression first. It allows longer spans and thinner sections than ordinary reinforcement.' };
  }
  if (k === 2){
    const e = pk([
      { ask:'cathodic protection with a sacrificial anode', a:'a more reactive metal such as zinc or magnesium corrodes instead of the steel', w:['a coating stops oxygen reaching the steel', 'the steel is heated to remove stress', 'the steel is alloyed with carbon'] },
      { ask:'galvanising', a:'the steel is coated with zinc, which both seals it and protects it sacrificially', w:['the steel is coated with tin, which is less reactive', 'the steel is painted with a polymer', 'the steel is anodised'] },
      { ask:'the main cause of corrosion in reinforced concrete', a:'chlorides and carbonation let water and oxygen reach the reinforcement', w:['the concrete is too strong in compression', 'the steel is too ductile', 'the concrete expands in the heat'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Explain <b>' + e.ask + '</b>.',
      choices:m.choices, answer:m.answer, data:{ kind:'en-corrosion', ask:e.ask },
      note:'Corrosion is electrochemical: it needs an anode, a cathode, an electrolyte and oxygen. Protection works by removing one of those or by supplying a more willing anode.' };
  }
  const grade = pk([25, 32, 40, 50]), A = pk([200, 300, 400]) * pk([200, 300]);
  const load = grade * A / 1000;
  return { q:'A concrete column of grade <b>' + grade + ' MPa</b> has a cross-section of <b>' + A + ' mm²</b>. What <b>compressive load</b> would it carry at that stress? Give kilonewtons to 1 decimal place.',
    input:true, answer:rd(load, 1), accept:qty(load, { tol:Math.max(0.05, load * 0.002) }), data:{ kind:'en-colload', grade, A },
    note:'Stress = force/area, so F = ' + grade + ' N mm' + sup(-2) + ' × ' + A + ' mm² = ' + Math.round(grade * A) + ' N = ' + rd(load, 1) + ' kN. A real column is designed well below this.' };
}

/* ── Civil structures: mechanics ────────────────────────────────────────── */
function genEnCivMech(){
  const k = ri(0, 3);
  if (k === 0){                                   // reactions of a simply supported beam
    const L = ri(4, 12), a = ri(1, L - 1), W = ri(2, 20) * 10;
    const RB = W * a / L, RA = W - RB;
    const which = pk(['A', 'B']);
    return { q:'A simply supported beam of span <b>' + L + ' m</b> carries a point load of <b>' + W + ' kN</b> at <b>' + a + ' m</b> from support A. Find the reaction at <b>' + which + '</b>, in kN to 2 decimal places.',
      input:true, answer:rd(which === 'A' ? RA : RB, 2), accept:qty(which === 'A' ? RA : RB, { tol:0.02 }),
      data:{ kind:'en-beam', L, a, W, which },
      note:'Taking moments about A: R_B × ' + L + ' = ' + W + ' × ' + a + ', so R_B = ' + rd(RB, 2) + ' kN, and R_A = ' + W + ' − ' + rd(RB, 2) + ' = ' + rd(RA, 2) + ' kN.' };
  }
  if (k === 1){                                   // a uniformly distributed load
    const L = ri(4, 12), w = ri(2, 30);
    const R = w * L / 2, M = w * L * L / 8;
    const ask = pk(['R', 'M']);
    return { q:'A simply supported beam of span <b>' + L + ' m</b> carries a uniformly distributed load of <b>' + w + ' kN m' + sup(-1) + '</b>. Find ' + (ask === 'R' ? 'the <b>reaction at each support</b>, in kN' : 'the <b>maximum bending moment</b>, in kN m') + ', to 2 decimal places.',
      input:true, answer:rd(ask === 'R' ? R : M, 2), accept:qty(ask === 'R' ? R : M, { tol:0.02 }), data:{ kind:'en-udl', L, w, ask },
      note:'The total load is ' + w + ' × ' + L + ' = ' + (w * L) + ' kN, shared equally, so each reaction is ' + rd(R, 2) + ' kN. The greatest bending moment is at midspan: wL²/8 = ' + rd(M, 2) + ' kN m.' };
  }
  if (k === 2){                                   // stress and strain
    const F = ri(10, 200), A = ri(50, 800), E = pk([200, 70, 110]);
    const stress = F * 1000 / A;
    const strain = stress / (E * 1000);
    const ask = pk(['stress', 'strain']);
    return { q:'A member of cross-section <b>' + A + ' mm²</b> carries <b>' + F + ' kN</b>. Its Young’s modulus is <b>' + E + ' GPa</b>. Find the ' + (ask === 'stress' ? '<b>stress</b> in MPa, to 2 decimal places' : '<b>strain</b>, to 6 decimal places') + '.',
      input:true, answer:ask === 'stress' ? rd(stress, 2) : rd(strain, 6), accept:qty(ask === 'stress' ? stress : strain, { tol:ask === 'stress' ? 0.02 : 1e-6 }),
      data:{ kind:'en-stress', F, A, E, ask },
      note:'σ = F/A = ' + (F * 1000) + ' N/' + A + ' mm² = ' + rd(stress, 2) + ' MPa. Then ε = σ/E = ' + rd(stress, 2) + '/' + (E * 1000) + ' = ' + rd(strain, 6) + ', which has no units.' };
  }
  const F = ri(2, 20) * 10, deg = pk([30, 45, 60]);   // a truss member resolved
  const vert = F * Math.sin(deg * Math.PI / 180), horiz = F * Math.cos(deg * Math.PI / 180);
  const ask = pk(['vertical', 'horizontal']);
  return { q:'A truss member carries <b>' + F + ' kN</b> at <b>' + deg + '°</b> to the horizontal. Find the <b>' + ask + ' component</b> of that force, in kN to 2 decimal places.',
    input:true, answer:rd(ask === 'vertical' ? vert : horiz, 2), accept:qty(ask === 'vertical' ? vert : horiz, { tol:0.02 }),
    data:{ kind:'en-resolve', F, deg, ask },
    note:'The components are F sin θ = ' + rd(vert, 2) + ' kN vertically and F cos θ = ' + rd(horiz, 2) + ' kN horizontally. The method of joints balances each of these to zero at every pin.' };
}

/* ── Civil structures: types and loads ──────────────────────────────────── */
function genEnCivType(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk([
      { ask:'an arch bridge', a:'mainly compression, pushed outwards into the abutments', w:['mainly tension in the arch', 'only bending in the deck', 'only torsion'] },
      { ask:'a suspension bridge', a:'tension in the main cables, carried down into the towers as compression', w:['compression in the cables', 'bending in the cables', 'torsion in the towers'] },
      { ask:'a cable-stayed bridge', a:'tension in the stays running straight to the towers, with compression in the deck', w:['tension in the deck only', 'compression in the stays', 'bending in the stays'] },
      { ask:'a simple beam bridge', a:'bending, with compression on top and tension underneath', w:['compression throughout', 'tension throughout', 'torsion throughout'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What are the main forces in <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-bridge', ask:e.ask },
      note:'Working out which members are in tension and which in compression is what decides the material: steel cables for tension, concrete or masonry for compression.' };
  }
  if (k === 1){
    const e = pk([
      { ask:'dead load', a:'the permanent weight of the structure itself', w:['the weight of traffic crossing it', 'the force of the wind', 'an earthquake'] },
      { ask:'live load', a:'the changing weight of traffic, people and goods', w:['the weight of the structure itself', 'the long-term settlement of the foundations', 'the force of gravity on the earth'] },
      { ask:'dynamic load', a:'a load that changes quickly, such as wind gusts or an earthquake', w:['the permanent weight of the structure', 'the weight of parked cars', 'the pressure of the foundations'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What is a <b>' + e.ask + '</b> on a structure?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-load', ask:e.ask },
      note:'A design has to cover all of them at once, with a factor of safety on top, because the worst case is the combination rather than any one load.' };
  }
  const m = mc('It is a ratio comparing the strength of a member with the load it is expected to carry.',
    ['It is the mass of the structure divided by its volume.',
     'It is the number of supports in the structure.',
     'It is the cost of the structure divided by its span.',
     'It is the maximum deflection allowed.']);
  return { q:'What is a <b>factor of safety</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-fos' },
    note:'Factor of safety = ultimate (or yield) strength ÷ working stress. It covers variation in materials, loads beyond what was expected and errors in the modelling.' };
}

/* ── Civil structures: history and society ──────────────────────────────── */
function genEnCivHist(){
  const e = pk([
    { ask:'the introduction of Portland cement in the 19th century', a:'it made large-scale concrete construction possible', w:['it replaced steel in tension members', 'it removed the need for foundations', 'it made bridges lighter than timber ones'] },
    { ask:'the Bessemer process', a:'it made steel cheap enough for large structures', w:['it made concrete set faster', 'it produced the first aluminium alloys', 'it replaced riveting with welding'] },
    { ask:'the move from riveting to welding', a:'it produced lighter, stiffer joints with fewer stress concentrations', w:['it made joints heavier but cheaper', 'it removed the need for inspection', 'it made steel immune to fatigue'] },
    { ask:'computer-aided design and analysis', a:'it allowed complex structures to be modelled and optimised before building', w:['it removed the need for factors of safety', 'it made materials stronger', 'it replaced site inspection'] },
    { ask:'a social impact of a major bridge', a:'it reshapes where people live and work by cutting travel time', w:['it has no effect beyond the engineering', 'it only matters to the people who build it', 'it reduces the population of a city'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'What was the significance of <b>' + e.ask + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-civhist', ask:e.ask },
    note:'Engineering Studies asks for the link between a technological change and its effect on society, not just the date — material, method and consequence together.' };
}

/* ── Transport: materials ───────────────────────────────────────────────── */
function genEnTraMat(){
  const k = ri(0, 2);
  if (k === 0){
    const e = pk([
      { ask:'aluminium alloy body panels', a:'a good strength-to-weight ratio, which cuts fuel use', w:['a higher melting point than steel', 'a lower cost than steel', 'greater stiffness than steel for the same thickness'] },
      { ask:'high-strength low-alloy steel in a car body', a:'more strength for less weight than mild steel, at modest cost', w:['it cannot corrode', 'it is lighter than aluminium', 'it needs no painting'] },
      { ask:'fibre-reinforced polymer panels', a:'light, corrosion-free and able to be moulded into complex shapes', w:['cheaper than steel to make in large numbers', 'easier to repair than steel', 'stiffer than steel in every direction'] },
      { ask:'rubber in tyres', a:'high friction and the ability to absorb shock through elastic deformation', w:['high stiffness so the tyre keeps its shape', 'high melting point', 'electrical conductivity'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Why are <b>' + e.ask + '</b> used?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-tramat', ask:e.ask },
      note:'Material choice in a vehicle is a trade-off between strength, weight, cost, formability and how it behaves in a crash.' };
  }
  if (k === 1){
    const m = mc('It absorbs energy by deforming in a controlled way, so less of it reaches the occupants.',
      ['It is made as stiff as possible so the car is not damaged.',
       'It is made of brittle material so it shatters.',
       'It transfers the whole impact to the passenger cell.',
       'It has no structural purpose.']);
    return { q:'What is the purpose of a <b>crumple zone</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-crumple' },
      note:'Crushing over a longer distance stretches the impact out in time, and since force = change in momentum ÷ time, a longer time means a smaller force on the people inside.' };
  }
  const m = mc('Fatigue — repeated loading well below the yield stress eventually starts and grows a crack.',
    ['Creep at room temperature.', 'Melting under normal use.',
     'Corrosion alone, with no mechanical cause.', 'Elastic deformation.']);
  return { q:'A suspension component fails after years of normal use, with no overload. What is the likely cause?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-fatigue' },
    note:'Fatigue cracks start at a stress concentration — a sharp corner, a hole, a weld — and grow a little with each cycle until the remaining section cannot carry the load.' };
}

/* ── Transport: mechanics ───────────────────────────────────────────────── */
function genEnTraMech(){
  const k = ri(0, 4);
  if (k === 0){                                   // gear ratio
    const dr = ri(10, 40), dn = ri(20, 80), rpm = ri(10, 60) * 100;
    const ratio = dn / dr, out = rpm / ratio;
    const ask = pk(['ratio', 'speed']);
    return { q:'A driving gear with <b>' + dr + ' teeth</b> turns a driven gear with <b>' + dn + ' teeth</b> at an input of <b>' + rpm + ' rpm</b>. Find ' + (ask === 'ratio' ? 'the <b>gear ratio</b>' : 'the <b>output speed</b> in rpm') + ', to 2 decimal places.',
      input:true, answer:rd(ask === 'ratio' ? ratio : out, 2), accept:qty(ask === 'ratio' ? ratio : out, { tol:0.02 }),
      data:{ kind:'en-gear', dr, dn, rpm, ask },
      note:'The ratio is driven ÷ driving = ' + dn + '/' + dr + ' = ' + rd(ratio, 2) + ':1, so the output turns ' + rd(out, 2) + ' rpm. Gearing down multiplies torque by the same factor.' };
  }
  if (k === 1){                                   // power from torque
    const tau = ri(50, 400), rpm = ri(10, 60) * 100;
    const P = tau * 2 * Math.PI * rpm / 60;
    return { q:'An engine produces <b>' + tau + ' N m</b> of torque at <b>' + rpm + ' rpm</b>. Find its <b>power output</b>, in kilowatts to 2 decimal places.',
      input:true, answer:rd(P / 1000, 2), accept:qty(P / 1000, { tol:Math.max(0.02, P / 1000 * 0.002) }), data:{ kind:'en-power', tau, rpm },
      note:'P = τω, and ω = 2π × ' + rpm + '/60 = ' + rd(2 * Math.PI * rpm / 60, 2) + ' rad s' + sup(-1) + ', so P = ' + Math.round(P) + ' W = ' + rd(P / 1000, 2) + ' kW.' };
  }
  if (k === 2){                                   // braking distance from energy
    const m2 = ri(8, 20) * 100, v = ri(10, 30), F = ri(2, 12) * 1000;
    const d = 0.5 * m2 * v * v / F;
    return { q:'A <b>' + m2 + ' kg</b> car travelling at <b>' + v + ' m s' + sup(-1) + '</b> brakes with a constant force of <b>' + (F / 1000) + ' kN</b>. How far does it travel before stopping? Give metres to 2 decimal places.',
      input:true, answer:rd(d, 2), accept:qty(d, { tol:0.02, dim:'length' }), data:{ kind:'en-brake', m:m2, v, F },
      note:'All the kinetic energy is taken out by the braking force: ½mv² = Fd, so d = ½ × ' + m2 + ' × ' + (v * v) + '/' + F + ' = ' + rd(d, 2) + ' m. Doubling the speed quadruples the distance.' };
  }
  if (k === 3){                                   // momentum in a collision
    const m1 = ri(8, 20) * 100, u1 = ri(5, 25), m2b = ri(8, 20) * 100;
    const v = m1 * u1 / (m1 + m2b);
    return { q:'A <b>' + m1 + ' kg</b> car moving at <b>' + u1 + ' m s' + sup(-1) + '</b> runs into a stationary <b>' + m2b + ' kg</b> car and they move off together. Find their <b>common speed</b>, in m s' + sup(-1) + ' to 3 decimal places.',
      input:true, answer:rd(v, 3), accept:qty(v, { tol:0.002, dim:'speed' }), data:{ kind:'en-momentum', m1, u1, m2:m2b },
      note:'Momentum is conserved: ' + m1 + ' × ' + u1 + ' = (' + m1 + ' + ' + m2b + ')v, so v = ' + rd(v, 3) + ' m s' + sup(-1) + '. Kinetic energy is not conserved — the difference goes into deforming the cars.' };
  }
  const m2c = ri(8, 20) * 100, slope = pk([5, 8, 10, 12, 15]);     // a car on a gradient, g = 10
  const F = m2c * EN_G * Math.sin(slope * Math.PI / 180);
  return { q:'A <b>' + m2c + ' kg</b> vehicle sits on a slope of <b>' + slope + '°</b>. Taking g = 10 m s' + sup(-2) + ', find the <b>force down the slope</b>, in newtons to the nearest newton.',
    input:true, answer:Math.round(F), accept:qty(F, { tol:Math.max(1, F * 0.002) }), data:{ kind:'en-slope', m:m2c, slope },
    note:'The component of weight along the slope is mg sin θ = ' + m2c + ' × 10 × sin ' + slope + '° = ' + Math.round(F) + ' N. The handbrake or the engine has to match it.' };
}

/* ── Transport: electrical systems ──────────────────────────────────────── */
function genEnTraElec(){
  const k = ri(0, 2);
  if (k === 0){
    const V = pk([12, 24, 48, 400]), R = rd(ri(5, 100) / 10, 1);
    const I = V / R, P = V * I;
    const ask = pk(['I', 'P']);
    return { q:'A vehicle circuit runs at <b>' + V + ' V</b> through a resistance of <b>' + R + ' Ω</b>. Find the ' + (ask === 'I' ? '<b>current</b> in amperes' : '<b>power</b> in watts') + ', to 2 decimal places.',
      input:true, answer:rd(ask === 'I' ? I : P, 2), accept:qty(ask === 'I' ? I : P, { tol:Math.max(0.02, (ask === 'I' ? I : P) * 0.002) }),
      data:{ kind:'en-ohm', V, R, ask },
      note:'I = V/R = ' + V + '/' + R + ' = ' + rd(I, 2) + ' A, and P = VI = ' + rd(P, 2) + ' W.' };
  }
  if (k === 1){
    const e = pk([
      { ask:'a lead-acid battery', a:'it supplies a very high current briefly, which is what starting needs', w:['it stores more energy per kilogram than any other type', 'it cannot be recharged', 'it works without any chemical reaction'] },
      { ask:'a lithium-ion battery in an electric vehicle', a:'it stores far more energy per kilogram than lead-acid', w:['it is cheaper than lead-acid', 'it delivers more cranking current', 'it needs no cooling or management'] },
      { ask:'regenerative braking', a:'the motor is run as a generator, turning kinetic energy back into stored charge', w:['the brake pads are cooled by a fan', 'the engine is switched off while braking', 'the battery is disconnected while braking'] },
      { ask:'an alternator', a:'it converts mechanical rotation into electrical energy to charge the battery', w:['it converts electrical energy into motion', 'it stores charge chemically', 'it steps the voltage down'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What is the role of <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-vehelec', ask:e.ask },
      note:'Every one of these is an energy conversion: chemical to electrical, electrical to mechanical, or back again, and each conversion has losses.' };
  }
  const m = mc('A motor turns electrical energy into rotation; a generator turns rotation into electrical energy.',
    ['They are the same device used at different voltages.',
     'A motor uses AC and a generator uses DC, always.',
     'A generator has no moving parts.',
     'A motor stores energy chemically.']);
  return { q:'What is the difference between a <b>motor</b> and a <b>generator</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-motorgen' },
    note:'The same machine can often do both, which is exactly what regenerative braking exploits.' };
}

/* ── Transport: history and society ─────────────────────────────────────── */
function genEnTraHist(){
  const e = pk([
    { ask:'the moving assembly line', a:'it cut the cost of a car enough to put it within reach of ordinary families', w:['it made cars safer in a crash', 'it reduced fuel consumption', 'it made cars lighter'] },
    { ask:'the catalytic converter', a:'it cut carbon monoxide, hydrocarbon and nitrogen oxide emissions', w:['it increased engine power', 'it reduced the weight of the exhaust', 'it replaced the muffler'] },
    { ask:'the seatbelt and later the airbag', a:'they spread the force of a crash over a longer time and a wider area of the body', w:['they make the car stiffer', 'they reduce the mass of the car', 'they stop the car crumpling'] },
    { ask:'the shift to electric vehicles', a:'it moves the emissions from the vehicle to wherever the electricity is generated', w:['it removes all environmental impact', 'it makes vehicles lighter', 'it removes the need for brakes'] },
    { ask:'mass car ownership for cities', a:'it spread cities outwards and made them depend on road networks', w:['it had no effect on how cities grew', 'it made cities more compact', 'it ended public transport everywhere'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'What was the effect of <b>' + e.ask + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-trahist', ask:e.ask },
    note:'The marks come from linking the engineering to the consequence — and from being honest about the trade-offs, since most of these solved one problem and created another.' };
}

/* ── Aeronautical: forces in flight ─────────────────────────────────────── */
function genEnAerForce(){
  const k = ri(0, 3);
  if (k === 0){                                   // the lift equation
    const rho = 1.225, v = ri(50, 250), A = ri(10, 120), CL = rd(ri(20, 150) / 100, 2);
    const L = 0.5 * rho * v * v * A * CL;
    return { q:'An aircraft wing of area <b>' + A + ' m²</b> has a lift coefficient of <b>' + CL + '</b> at <b>' + v + ' m s' + sup(-1) + '</b>. Taking air density as 1.225 kg m' + sup(-3) + ', find the <b>lift</b>, in kilonewtons to 2 decimal places.',
      input:true, answer:rd(L / 1000, 2), accept:qty(L / 1000, { tol:Math.max(0.02, L / 1000 * 0.003) }), data:{ kind:'en-lift', v, A, CL },
      note:'L = ½ρv²AC_L = 0.5 × 1.225 × ' + (v * v) + ' × ' + A + ' × ' + CL + ' = ' + Math.round(L) + ' N = ' + rd(L / 1000, 2) + ' kN. Lift goes with the square of the speed, so halving the speed quarters it.' };
  }
  if (k === 1){                                   // steady level flight
    const m2 = ri(10, 400) * 100;
    const W = m2 * EN_G;
    return { q:'An aircraft of mass <b>' + m2 + ' kg</b> is in <b>steady level flight</b>. Taking g = 10 m s' + sup(-2) + ', what <b>lift</b> must the wings produce? Give kilonewtons to 1 decimal place.',
      input:true, answer:rd(W / 1000, 1), accept:qty(W / 1000, { tol:0.05 }), data:{ kind:'en-level', m:m2 },
      note:'Steady level flight means lift balances weight and thrust balances drag, so L = mg = ' + m2 + ' × 10 = ' + Math.round(W) + ' N = ' + rd(W / 1000, 1) + ' kN.' };
  }
  if (k === 2){
    const e = pk([
      { ask:'an increase in the angle of attack up to the stall', a:'lift increases, and so does drag', w:['lift increases and drag falls', 'lift falls and drag increases', 'neither changes'] },
      { ask:'exceeding the critical angle of attack', a:'the airflow separates from the upper surface and lift drops away sharply', w:['lift keeps increasing', 'drag drops to zero', 'the aircraft speeds up'] },
      { ask:'lowering the flaps', a:'it increases camber and lift at low speed, at the cost of extra drag', w:['it reduces lift so the aircraft descends', 'it reduces drag for cruising', 'it has no aerodynamic effect'] },
      { ask:'faster airflow over the curved upper surface', a:'the pressure there falls, so there is a net upward force', w:['the pressure there rises, pushing the wing down', 'the air temperature rises, lifting the wing', 'nothing, because pressure does not depend on speed'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What is the effect of <b>' + e.ask + '</b>?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-aero', ask:e.ask },
      note:'Faster flow means lower pressure (Bernoulli), and the wing also deflects air downwards — by Newton’s third law that pushes the wing up. Both descriptions give the same lift.' };
  }
  const m = mc('lift, weight, thrust and drag', ['lift, mass, power and friction',
    'lift, weight, torque and drag', 'thrust, drag, pressure and momentum']);
  return { q:'What are the <b>four forces</b> acting on an aircraft in flight?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-fourforces' },
    note:'In steady level flight at constant speed they balance in pairs: lift with weight, thrust with drag.' };
}

/* ── Aeronautical: materials ────────────────────────────────────────────── */
function genEnAerMat(){
  const e = pk([
    { ask:'aluminium alloys in airframes', a:'a high strength-to-weight ratio, and they are easy to form and join', w:['the highest strength of any metal', 'complete immunity to fatigue', 'a very high melting point'] },
    { ask:'titanium alloys in engine parts', a:'strength kept at high temperature, with good corrosion resistance', w:['the lowest density of any metal', 'the lowest cost of any aerospace metal', 'the best electrical conductivity'] },
    { ask:'carbon fibre composites', a:'very high stiffness and strength for their weight, with the fibres laid along the load', w:['equal properties in every direction', 'cheapness and ease of repair', 'high ductility'] },
    { ask:'anodising aluminium', a:'it grows a tough oxide layer that resists corrosion', w:['it makes the metal harder all the way through', 'it removes internal stresses', 'it increases its melting point'] },
    { ask:'why fatigue matters so much in aircraft', a:'pressurisation and flight loads cycle the structure thousands of times', w:['aircraft metals creep at room temperature', 'aircraft are always overloaded', 'corrosion is impossible at altitude'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'Explain <b>' + e.ask + '</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'en-aermat', ask:e.ask },
    note:'Aeronautical material choice is dominated by strength-to-weight, then by what happens over thousands of load cycles — which is why inspection intervals are part of the design.' };
}

/* ── Aeronautical: performance ──────────────────────────────────────────── */
function genEnAerPerf(){
  const k = ri(0, 2);
  if (k === 0){                                   // lift-to-drag ratio
    const L = ri(50, 400), ratio = pk([8, 10, 12, 15, 20]);
    const D = L / ratio;
    return { q:'An aircraft generates <b>' + L + ' kN</b> of lift with a lift-to-drag ratio of <b>' + ratio + '</b>. Find the <b>drag</b>, in kN to 2 decimal places.',
      input:true, answer:rd(D, 2), accept:qty(D, { tol:0.02 }), data:{ kind:'en-ld', L, ratio },
      note:'L/D = ' + ratio + ', so D = ' + L + '/' + ratio + ' = ' + rd(D, 2) + ' kN. A higher ratio means less thrust is needed to hold speed, so the aircraft goes further on the same fuel.' };
  }
  if (k === 1){                                   // thrust power
    const T = ri(20, 200), v = ri(50, 250);
    const P = T * 1000 * v / 1e6;
    return { q:'An aircraft flies at <b>' + v + ' m s' + sup(-1) + '</b> with <b>' + T + ' kN</b> of thrust. Find the <b>power</b> being delivered, in megawatts to 2 decimal places.',
      input:true, answer:rd(P, 2), accept:qty(P, { tol:Math.max(0.02, P * 0.002) }), data:{ kind:'en-thrustpower', T, v },
      note:'P = Fv = ' + (T * 1000) + ' N × ' + v + ' m s' + sup(-1) + ' = ' + rd(P, 2) + ' MW.' };
  }
  const m2 = ri(10, 400) * 100, climb = ri(2, 20);
  const P = m2 * EN_G * climb / 1000;
  return { q:'An aircraft of mass <b>' + m2 + ' kg</b> climbs at <b>' + climb + ' m s' + sup(-1) + '</b>. Taking g = 10 m s' + sup(-2) + ', what <b>extra power</b> does the climb need? Give kilowatts to 1 decimal place.',
    input:true, answer:rd(P, 1), accept:qty(P, { tol:Math.max(0.05, P * 0.002) }), data:{ kind:'en-climb', m:m2, climb },
    note:'Climbing means gaining potential energy at mgh per second: P = mg × rate of climb = ' + m2 + ' × 10 × ' + climb + ' = ' + Math.round(P * 1000) + ' W = ' + rd(P, 1) + ' kW, on top of what it takes to beat the drag.' };
}

/* ── Aeronautical: history and society ──────────────────────────────────── */
function genEnAerHist(){
  const e = pk([
    { ask:'the jet engine', a:'it made high-speed, high-altitude flight practical, and long-haul travel routine', w:['it made aircraft lighter than propeller types in every case', 'it removed the need for wings', 'it reduced fuel use per engine'] },
    { ask:'the pressurised cabin', a:'it let aircraft cruise high, where the air is thin and drag is low', w:['it made the fuselage lighter', 'it removed the need for oxygen masks on the ground', 'it had no effect on cruising altitude'] },
    { ask:'the move from aluminium to composite airframes', a:'lighter and more fatigue-resistant structures, but harder to inspect and repair', w:['cheaper airframes that are easier to repair', 'heavier but stronger airframes', 'no change in weight or strength'] },
    { ask:'radar and modern avionics', a:'they made flight in poor visibility and crowded airspace safe enough to be routine', w:['they increased aircraft speed', 'they replaced the need for pilots', 'they reduced the weight of the airframe'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'What was the significance of <b>' + e.ask + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-aerhist', ask:e.ask },
    note:'As always the mark is for the link: what the technology changed about the engineering, and what that changed for people.' };
}

/* ── Telecommunications: systems ────────────────────────────────────────── */
function genEnTelSys(){
  const k = ri(0, 3);
  if (k === 0){
    const e = pk([
      { ask:'amplitude modulation', a:'the height of the carrier wave varies with the signal', w:['the frequency of the carrier varies with the signal', 'the carrier is switched on and off', 'the phase alone carries the signal'] },
      { ask:'frequency modulation', a:'the frequency of the carrier varies with the signal', w:['the height of the carrier varies with the signal', 'the carrier is switched on and off', 'the amplitude alone carries the signal'] },
      { ask:'why FM resists noise better than AM', a:'most noise adds itself to the amplitude, which FM does not use to carry information', w:['FM uses a higher power transmitter', 'FM signals travel further', 'FM uses a lower frequency'] },
      { ask:'bandwidth', a:'the range of frequencies a channel occupies, which limits how much information it can carry', w:['the power of the transmitter', 'the distance a signal travels', 'the height of the antenna'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'Explain <b>' + e.ask + '</b>.',
      choices:m.choices, answer:m.answer, data:{ kind:'en-modulation', ask:e.ask },
      note:'Modulation puts a low-frequency signal onto a high-frequency carrier so it can be transmitted efficiently and so many channels can share the spectrum.' };
  }
  if (k === 1){                                   // wavelength of a carrier
    const f = pk([0.55, 1.0, 100, 900, 2400]) * 1e6;
    const lam = 3.0e8 / f;
    return { q:'A transmitter broadcasts at <b>' + phSci(f, 3) + ' Hz</b>. Taking the speed of radio waves as 3.00 × 10⁸ m s' + sup(-1) + ', find the <b>wavelength</b>, in metres to 3 significant figures.',
      input:true, answer:phSci(lam), accept:qty(lam, { tol:lam * 0.01, dim:'length' }), data:{ kind:'en-wavelength', f },
      note:'λ = c/f = 3.00 × 10⁸/' + phSci(f, 3) + ' = ' + phSci(lam) + ' m. Antenna length is usually a simple fraction of this, which is why low-frequency antennas are so large.' };
  }
  if (k === 2){                                   // decibels
    const ratio = pk([2, 10, 100, 1000, 0.5, 0.1]);
    const dB = 10 * Math.log10(ratio);
    return { q:'A signal’s power is multiplied by <b>' + ratio + '</b>. Express that as a <b>gain in decibels</b>, to 2 decimal places.',
      input:true, answer:rd(dB, 2), accept:qty(dB, { tol:0.02 }), data:{ kind:'en-db', ratio },
      note:'Gain in dB = 10 log₁₀(P_out/P_in) = 10 log₁₀(' + ratio + ') = ' + rd(dB, 2) + ' dB. A negative value is a loss, and every 3 dB is roughly a doubling.' };
  }
  const m = mc('It is sent as discrete levels, so noise can be stripped out by regenerating the signal.',
    ['It is sent at a higher power than an analogue signal.',
     'It cannot be affected by noise at all.',
     'It uses less bandwidth in every case.',
     'It travels faster than an analogue signal.']);
  return { q:'What is the advantage of sending information <b>digitally</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-digital' },
    note:'An analogue signal picks up noise that can never be removed, because the noise looks like signal. A digital repeater only has to decide which level was sent, so it can rebuild a clean copy.' };
}

/* ── Telecommunications: electronics ────────────────────────────────────── */
function genEnTelElec(){
  const k = ri(0, 3);
  if (k === 0){                                   // resistors in series and parallel
    const R1 = ri(10, 200), R2 = ri(10, 200);
    const series = Math.random() < 0.5;
    const R = series ? R1 + R2 : R1 * R2 / (R1 + R2);
    return { q:'Two resistors of <b>' + R1 + ' Ω</b> and <b>' + R2 + ' Ω</b> are connected in <b>' + (series ? 'series' : 'parallel') + '</b>. Find the <b>total resistance</b>, in ohms to 2 decimal places.',
      input:true, answer:rd(R, 2), accept:qty(R, { tol:0.02 }), data:{ kind:'en-resistors', R1, R2, series },
      note:series ? 'In series resistances simply add: ' + R1 + ' + ' + R2 + ' = ' + R + ' Ω.'
                  : 'In parallel 1/R = 1/' + R1 + ' + 1/' + R2 + ', so R = ' + rd(R, 2) + ' Ω — always less than the smaller of the two.' };
  }
  if (k === 1){                                   // logic gates
    const e = pk([
      { g:'AND', a:'1 only when both inputs are 1', w:['1 when either input is 1', '1 only when both inputs are 0', '1 when the inputs differ'] },
      { g:'OR', a:'1 when either input is 1', w:['1 only when both inputs are 1', '1 only when both inputs are 0', '1 when the inputs are the same'] },
      { g:'NAND', a:'0 only when both inputs are 1', w:['1 only when both inputs are 1', '1 when the inputs differ', '0 when either input is 1'] },
      { g:'XOR', a:'1 when the inputs differ', w:['1 when the inputs are the same', '1 only when both inputs are 1', '0 only when both inputs are 0'] },
      { g:'NOR', a:'1 only when both inputs are 0', w:['1 when either input is 1', '1 only when both inputs are 1', '1 when the inputs differ'] }
    ]);
    const m = mc(e.a, e.w);
    return { q:'What does a <b>' + e.g + '</b> gate output?',
      choices:m.choices, answer:m.answer, data:{ kind:'en-gate', g:e.g },
      note:'The truth table is the quickest way to tell them apart, and NAND on its own can be wired to make any of the others.' };
  }
  if (k === 2){                                   // power in a component
    const V = ri(3, 24), R = ri(10, 500);
    const P = V * V / R;
    return { q:'A component of resistance <b>' + R + ' Ω</b> has <b>' + V + ' V</b> across it. Find the <b>power dissipated</b>, in watts to 4 decimal places.',
      input:true, answer:rd(P, 4), accept:qty(P, { tol:Math.max(0.0005, P * 0.002) }), data:{ kind:'en-pdiss', V, R },
      note:'P = V²/R = ' + (V * V) + '/' + R + ' = ' + rd(P, 4) + ' W. It all becomes heat, which is why components have power ratings.' };
  }
  const m = mc('A transistor can switch or amplify a current, using a small input to control a larger output.',
    ['A transistor stores charge like a capacitor.',
     'A transistor converts AC to DC on its own.',
     'A transistor always reduces the voltage.',
     'A transistor has no effect on a signal.']);
  return { q:'What does a <b>transistor</b> do in a circuit?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-transistor' },
    note:'That one property — a small signal controlling a large one — is what makes both amplifiers and digital logic possible.' };
}

/* ── Telecommunications: materials ──────────────────────────────────────── */
function genEnTelMat(){
  const e = pk([
    { ask:'copper for cabling', a:'high electrical conductivity and enough ductility to be drawn into wire', w:['the highest conductivity of any element', 'immunity to corrosion', 'very low density'] },
    { ask:'optical fibre', a:'light is carried by total internal reflection in a glass core, with huge bandwidth and no electrical interference', w:['it conducts electricity better than copper', 'it carries sound waves rather than light', 'it needs no cladding'] },
    { ask:'a semiconductor such as silicon', a:'its conductivity sits between a conductor and an insulator and can be controlled by doping', w:['it conducts as well as copper at all temperatures', 'it is an insulator under every condition', 'its conductivity cannot be changed'] },
    { ask:'doping a semiconductor', a:'adding a trace of another element to supply extra electrons or holes', w:['heating it until it melts', 'coating it with copper', 'removing all its impurities'] },
    { ask:'why optical fibre is preferred over copper for long distances', a:'far lower signal loss and far greater bandwidth, with no electromagnetic interference', w:['it is cheaper to install', 'it is easier to splice', 'it carries electrical power as well'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'Explain <b>' + e.ask + '</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'en-telmat', ask:e.ask },
    note:'Telecommunications materials are chosen for how well they carry a signal and how little of it they lose along the way.' };
}

/* ── Across the course: engineering communication ───────────────────────── */
function genEnDraw(){
  const e = pk([
    { ask:'third-angle orthogonal projection', a:'the view you see from a side is drawn on that same side of the front view', w:['views are drawn on the opposite side from where you look', 'only one view is ever drawn', 'the object is drawn in perspective'] },
    { ask:'a sectional view', a:'it shows what a cut through the object would reveal, with hatching on the cut faces', w:['it shows the object from an angle', 'it shows only the outline', 'it is a scale drawing of the whole assembly'] },
    { ask:'a hidden detail line', a:'a dashed line showing an edge that cannot be seen from that view', w:['a solid thick line for a visible edge', 'a chain line for a centre', 'a thin line for a dimension'] },
    { ask:'a centre line', a:'a long-dash short-dash chain line marking the axis of a round feature', w:['a dashed line for a hidden edge', 'a thick line for a visible edge', 'a wavy line for a break'] },
    { ask:'an isometric drawing', a:'a pictorial view with the three axes at 120° and no perspective convergence', w:['a view with vanishing points', 'a flat view from directly above', 'a cut-away view'] },
    { ask:'why a drawing carries a scale and a title block', a:'so anyone reading it knows the size, the part, the revision and who approved it', w:['so it looks professional', 'so it can be copied more easily', 'so the drawing can be printed in colour'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'In engineering drawing, what is <b>' + e.ask + '</b>?',
    choices:m.choices, answer:m.answer, data:{ kind:'en-draw', ask:e.ask },
    note:'Drawing conventions exist so a drawing means exactly one thing to everyone who reads it, anywhere.' };
}

/* ── Across the course: the profession ──────────────────────────────────── */
function genEnProf(){
  const e = pk([
    { ask:'a civil engineer', a:'designs and oversees structures and infrastructure such as bridges, roads and water supply', w:['designs engines and moving machinery', 'designs circuits and communication systems', 'designs aircraft'] },
    { ask:'a mechanical engineer', a:'designs machines, engines and anything with moving parts', w:['designs bridges and dams', 'designs telecommunication networks', 'designs chemical plants only'] },
    { ask:'an electrical engineer', a:'designs the generation, distribution and use of electrical power and signals', w:['designs bridges', 'designs aircraft structures', 'designs concrete mixes'] },
    { ask:'a sustainability requirement on a modern design', a:'the whole life cycle — materials, energy in manufacture, use and disposal — is considered', w:['only the purchase price matters', 'only the strength matters', 'only the appearance matters'] },
    { ask:'an engineer’s duty of care', a:'a legal and ethical responsibility for public safety that outranks cost or schedule', w:['a duty to the employer before anyone else', 'a duty only to the client who pays', 'an optional code with no legal weight'] }
  ]);
  const m = mc(e.a, e.w);
  return { q:'Describe <b>' + e.ask + '</b>.',
    choices:m.choices, answer:m.answer, data:{ kind:'en-prof', ask:e.ask },
    note:'The scope-of-the-profession questions reward specific duties and specific consequences, not general praise for engineering.' };
}

/* ── the subject ───────────────────────────────────────────────────────── */
const MODULES_EN12 = [
  { id:'en-civ', name:'Civil structures', topics:[
    { id:'e12-civmat', name:'Materials', gen:genEnCivMat },
    { id:'e12-civmech', name:'Beams, trusses & stress', gen:genEnCivMech },
    { id:'e12-civtype', name:'Structures & loads', gen:genEnCivType },
    { id:'e12-civhist', name:'History & society', gen:genEnCivHist }]},
  { id:'en-tra', name:'Personal & public transport', topics:[
    { id:'e12-tramat', name:'Materials', gen:genEnTraMat },
    { id:'e12-tramech', name:'Vehicle mechanics', gen:genEnTraMech },
    { id:'e12-traelec', name:'Electrical systems', gen:genEnTraElec },
    { id:'e12-trahist', name:'History & society', gen:genEnTraHist }]},
  { id:'en-aer', name:'Aeronautical', topics:[
    { id:'e12-aerforce', name:'Forces in flight', gen:genEnAerForce },
    { id:'e12-aermat', name:'Materials', gen:genEnAerMat },
    { id:'e12-aerperf', name:'Performance', gen:genEnAerPerf },
    { id:'e12-aerhist', name:'History & society', gen:genEnAerHist }]},
  { id:'en-tel', name:'Telecommunications', topics:[
    { id:'e12-telsys', name:'Systems & signals', gen:genEnTelSys },
    { id:'e12-telelec', name:'Electronics', gen:genEnTelElec },
    { id:'e12-telmat', name:'Materials', gen:genEnTelMat }]},
  { id:'en-all', name:'Across the course', topics:[
    { id:'e12-draw', name:'Engineering drawing', gen:genEnDraw },
    { id:'e12-prof', name:'The profession', gen:genEnProf }]}
];
BUILD.eng12 = host => revGame(host, { title:'Engineering Studies (Year 12)',
  how:'The four HSC modules of the 2011 syllabus, plus drawing and the profession. Engineering takes g = 10.',
  statKey:'eng12', modules:MODULES_EN12 });

GAMES.push({ id:'eng12', cat:'Revision', year:12, ico:'🔧', name:'Engineering',
  blurb:'Civil, transport, aeronautical, telecommunications' });

/* ── Engineering: long-response questions for the mock paper ────────────── */
const LONG_EN12 = [
  /* a loaded beam */
  () => {
    const L = ri(6, 12), a = ri(2, L - 2), W = ri(4, 20) * 10;
    const RB = W * a / L, RA = W - RB, M = RA * a;
    return { mod:'en-civ',
      q:'A simply supported steel beam spans <b>' + L + ' m</b> and carries a point load of <b>' + W + ' kN</b> at <b>' + a + ' m</b> from support A.' +
        '<br>(a) Calculate the reactions at both supports. <b>(3 marks)</b>' +
        '<br>(b) Calculate the bending moment under the load. <b>(2 marks)</b>' +
        '<br>(c) Explain why steel rather than concrete is chosen for a beam like this. <b>(2 marks)</b>',
      guide:['(a) Takes moments about one support',
             '(a) R_B = ' + rd(RB, 2) + ' kN',
             '(a) R_A = ' + rd(RA, 2) + ' kN, checked against the total load',
             '(b) Uses the moment of the reaction about the load point',
             '(b) Bending moment ' + rd(M, 2) + ' kN m',
             '(c) States that a beam puts the lower fibres in tension',
             '(c) States that steel is strong in tension while plain concrete is weak in it'],
      model:'Taking moments about A: R_B × ' + L + ' = ' + W + ' × ' + a + ', so R_B = ' + rd(RB, 2) + ' kN, and vertical equilibrium gives R_A = ' + rd(RA, 2) + ' kN. The bending moment under the load is R_A × ' + a + ' = ' + rd(M, 2) + ' kN m. A simply supported beam sags, so the bottom is in tension: steel carries that directly, whereas plain concrete would crack and would need reinforcement placed in the tension zone.' };
  },
  /* bridges */
  () => {
    const e = pk([['an arch', 'a suspension'], ['a cable-stayed', 'a simple beam'], ['a truss', 'an arch']]);
    return { mod:'en-civ',
      q:'Compare <b>' + e[0] + ' bridge</b> with <b>' + e[1] + ' bridge</b>.' +
        '<br>(a) Describe the main forces carried by each. <b>(2 marks)</b>' +
        '<br>(b) Explain how those forces influence the choice of material in each case. <b>(2 marks)</b>' +
        '<br>(c) Identify one situation that would favour each design. <b>(2 marks)</b>',
      guide:['(a) Correctly identifies the dominant forces in ' + e[0] + ' bridge',
             '(a) Correctly identifies the dominant forces in ' + e[1] + ' bridge',
             '(b) Links a compression member to concrete, masonry or a closed steel section',
             '(b) Links a tension member to steel cable or rolled steel',
             '(c) Gives a site or span that suits ' + e[0],
             '(c) Gives a site or span that suits ' + e[1]],
      model:'Arches work almost entirely in compression and push outwards on their abutments, so they suit stone, concrete or steel and need solid ground at each end. Suspension and cable-stayed bridges put their cables in tension and their towers in compression, which suits high-tensile steel cable and allows much longer spans. A simple beam carries load in bending — compression on top, tension underneath — and is cheap for short spans, while a truss gets the same reach with less material by making every member carry pure tension or compression.' };
  },
  /* durability of concrete */
  () => {
    return { mod:'en-civ',
      q:'A reinforced concrete structure beside the sea shows rust stains and spalling concrete after twenty years.' +
        '<br>(a) Explain the process causing this damage. <b>(3 marks)</b>' +
        '<br>(b) Describe two measures that would have slowed it. <b>(2 marks)</b>',
      guide:['(a) States that chlorides and carbonation break down the protective alkaline layer around the steel',
             '(a) States that water and oxygen then reach the steel, which corrodes electrochemically',
             '(a) Explains that rust occupies more volume than steel, so it cracks and spalls the cover concrete',
             '(b) Gives one valid measure, such as greater cover or a lower water–cement ratio',
             '(b) Gives a second, such as galvanised or epoxy-coated bars, cathodic protection, or a sealant'],
      model:'Fresh concrete is alkaline and keeps a passive film on the reinforcement. Chloride from sea spray, and carbonation from carbon dioxide, destroy that film; water and oxygen then drive an electrochemical cell on the bar. The rust that forms takes up several times the volume of the steel it replaced, so it bursts the surrounding concrete off, which lets in more salt and water and accelerates the whole process. Thicker cover, denser concrete with a low water–cement ratio, coated or galvanised bars, sealants, and cathodic protection all slow it down.' };
  },
  /* vehicle performance */
  () => {
    const tau = ri(100, 400), rpm = ri(20, 60) * 100, dr = ri(10, 30), dn = ri(30, 90);
    const P = tau * 2 * Math.PI * rpm / 60 / 1000, ratio = dn / dr, outT = tau * ratio;
    return { mod:'en-tra',
      q:'An engine develops <b>' + tau + ' N m</b> at <b>' + rpm + ' rpm</b>, driving a gear with <b>' + dr + ' teeth</b> that turns a gear with <b>' + dn + ' teeth</b>.' +
        '<br>(a) Calculate the power output of the engine. <b>(2 marks)</b>' +
        '<br>(b) Calculate the gear ratio and the torque at the driven gear, assuming no losses. <b>(3 marks)</b>' +
        '<br>(c) Explain what is traded away when gearing down for more torque. <b>(1 mark)</b>',
      guide:['(a) Converts the speed to rad s' + sup(-1),
             '(a) Power ' + rd(P, 2) + ' kW',
             '(b) Gear ratio ' + rd(ratio, 2) + ':1',
             '(b) Multiplies the input torque by the ratio',
             '(b) Output torque ' + rd(outT, 1) + ' N m',
             '(c) States that rotational speed falls by the same factor, since power is unchanged'],
      model:'ω = 2π × ' + rpm + '/60 = ' + rd(2 * Math.PI * rpm / 60, 2) + ' rad s' + sup(-1) + ', so P = τω = ' + rd(P, 2) + ' kW. The gear ratio is ' + dn + '/' + dr + ' = ' + rd(ratio, 2) + ':1, so the output torque is ' + tau + ' × ' + rd(ratio, 2) + ' = ' + rd(outT, 1) + ' N m. Power cannot be created by gearing: whatever is gained in torque is lost in speed, and in practice a little more is lost to friction.' };
  },
  /* crash safety */
  () => {
    const m1 = ri(10, 18) * 100, u = ri(8, 25), t = rd(ri(5, 20) / 100, 2);
    const F = m1 * u / t;
    return { mod:'en-tra',
      q:'A <b>' + m1 + ' kg</b> car travelling at <b>' + u + ' m s' + sup(-1) + '</b> is brought to rest in a crash lasting <b>' + t + ' s</b>.' +
        '<br>(a) Calculate the average force on the car. <b>(3 marks)</b>' +
        '<br>(b) Explain how crumple zones, seatbelts and airbags reduce injury. <b>(3 marks)</b>',
      guide:['(a) Finds the change in momentum ' + Math.round(m1 * u) + ' kg m s' + sup(-1),
             '(a) Uses F = Δp/Δt',
             '(a) Average force ' + Math.round(F) + ' N',
             '(b) States that crumple zones extend the time of the collision, reducing the force',
             '(b) States that seatbelts spread the force over strong parts of the body and keep the occupant in place',
             '(b) States that airbags increase the stopping distance of the head and spread the load'],
      model:'Δp = ' + m1 + ' × ' + u + ' = ' + Math.round(m1 * u) + ' kg m s' + sup(-1) + ', and F = Δp/Δt = ' + Math.round(F) + ' N. Every safety feature works on the same equation: crumple zones and airbags make Δt larger so the force is smaller, while the seatbelt makes sure the occupant decelerates with the car rather than hitting the inside of it at full speed, and spreads what force remains across the pelvis and chest.' };
  },
  /* aircraft in flight */
  () => {
    const m2 = ri(20, 300) * 100, v = ri(60, 220), A = ri(20, 120);
    const W = m2 * EN_G, CL = W / (0.5 * 1.225 * v * v * A);
    return { mod:'en-aer',
      q:'An aircraft of mass <b>' + m2 + ' kg</b> is in steady level flight at <b>' + v + ' m s' + sup(-1) + '</b>. Its wing area is <b>' + A + ' m²</b> and air density is 1.225 kg m' + sup(-3) + '. Take g = 10 m s' + sup(-2) + '.' +
        '<br>(a) State the lift required and justify it. <b>(2 marks)</b>' +
        '<br>(b) Calculate the lift coefficient needed. <b>(2 marks)</b>' +
        '<br>(c) Explain what happens if the pilot raises the angle of attack past the critical angle. <b>(2 marks)</b>',
      guide:['(a) States that lift must equal weight in steady level flight',
             '(a) Lift ' + rd(W / 1000, 1) + ' kN',
             '(b) Rearranges L = ½ρv²AC_L',
             '(b) C_L = ' + rd(CL, 4),
             '(c) States that the airflow separates from the upper surface',
             '(c) States that lift falls away sharply and drag rises — the aircraft stalls'],
      model:'Steady level flight means lift equals weight, so L = ' + m2 + ' × 10 = ' + Math.round(W) + ' N = ' + rd(W / 1000, 1) + ' kN. From L = ½ρv²AC_L, C_L = ' + rd(CL, 4) + '. Raising the angle of attack increases lift up to the critical angle; past it the flow can no longer follow the upper surface, separates, and lift collapses while drag climbs. Recovery means lowering the nose to reduce the angle of attack, not adding power alone.' };
  },
  /* aeronautical materials */
  () => {
    return { mod:'en-aer',
      q:'An aircraft manufacturer is choosing between an <b>aluminium alloy</b> and a <b>carbon fibre composite</b> for a wing structure.' +
        '<br>(a) Compare the two on strength-to-weight ratio and fatigue behaviour. <b>(3 marks)</b>' +
        '<br>(b) Identify two disadvantages of the composite. <b>(2 marks)</b>',
      guide:['(a) States that the composite has the higher strength-to-weight ratio',
             '(a) States that the composite resists fatigue better than the aluminium alloy',
             '(a) Notes that the composite’s properties depend on fibre direction, while the alloy is much the same in all directions',
             '(b) Gives one disadvantage, such as cost or difficulty of repair',
             '(b) Gives a second, such as hard-to-detect internal damage or complex manufacture'],
      model:'Carbon fibre composite is stiffer and stronger for its weight than aluminium alloy, and it does not suffer the same fatigue crack growth under repeated pressurisation cycles — a major limit on aluminium airframes. Its properties are directional, so the laminate has to be laid up along the expected loads. Against that, it costs far more, is harder to repair in the field, and damage inside the laminate can be invisible from the surface, so inspection relies on ultrasonic or thermographic methods.' };
  },
  /* telecommunications systems */
  () => {
    const f = pk([0.7, 1.8, 2.4, 100]) * 1e6 * (Math.random() < 0.5 ? 1 : 1000);
    const lam = 3.0e8 / f;
    return { mod:'en-tel',
      q:'A transmitter operates at <b>' + phSci(f, 3) + ' Hz</b>.' +
        '<br>(a) Calculate the wavelength. <b>(2 marks)</b>' +
        '<br>(b) Compare amplitude modulation and frequency modulation, including why FM resists noise better. <b>(3 marks)</b>',
      guide:['(a) Uses λ = c/f',
             '(a) Wavelength ' + phSci(lam) + ' m',
             '(b) States that AM varies the amplitude of the carrier with the signal',
             '(b) States that FM varies the frequency of the carrier with the signal',
             '(b) Explains that noise mostly adds to the amplitude, which FM does not use to carry information'],
      model:'λ = c/f = 3.00 × 10⁸/' + phSci(f, 3) + ' = ' + phSci(lam) + ' m. In AM the height of the carrier follows the signal; in FM its frequency does. Electrical noise, from lightning to motors, adds itself to amplitude, so it lands directly on an AM signal, while an FM receiver can clip the amplitude flat and still recover the information from the frequency — at the cost of more bandwidth per channel.' };
  },
  /* electronics */
  () => {
    const R1 = ri(20, 200), R2 = ri(20, 200), V = pk([5, 9, 12, 24]);
    const series = R1 + R2, parallel = R1 * R2 / (R1 + R2);
    const I = V / series, P = V * I;
    return { mod:'en-tel',
      q:'Two resistors, <b>' + R1 + ' Ω</b> and <b>' + R2 + ' Ω</b>, are available, with a <b>' + V + ' V</b> supply.' +
        '<br>(a) Calculate the total resistance in series and in parallel. <b>(2 marks)</b>' +
        '<br>(b) For the series circuit, calculate the current and the total power. <b>(3 marks)</b>' +
        '<br>(c) Explain why the parallel arrangement draws more current from the same supply. <b>(1 mark)</b>',
      guide:['(a) Series ' + series + ' Ω',
             '(a) Parallel ' + rd(parallel, 2) + ' Ω',
             '(b) Uses I = V/R',
             '(b) Current ' + rd(I, 4) + ' A',
             '(b) Power ' + rd(P, 3) + ' W',
             '(c) States that the lower total resistance means a larger current for the same voltage'],
      model:'In series R = ' + R1 + ' + ' + R2 + ' = ' + series + ' Ω; in parallel R = ' + rd(parallel, 2) + ' Ω. The series current is I = ' + V + '/' + series + ' = ' + rd(I, 4) + ' A and the power is VI = ' + rd(P, 3) + ' W. Adding a parallel path gives the current somewhere else to go, so the total resistance falls below the smaller resistor and the supply delivers more current.' };
  },
  /* drawing and the profession */
  () => {
    return { mod:'en-all',
      q:'A design is being documented for manufacture.' +
        '<br>(a) Explain why third-angle orthogonal projection is used rather than a pictorial view alone. <b>(2 marks)</b>' +
        '<br>(b) State what a title block must carry and why. <b>(2 marks)</b>' +
        '<br>(c) Explain one sustainability consideration the engineer should document. <b>(2 marks)</b>',
      guide:['(a) States that orthogonal views show true shape and size without distortion',
             '(a) States that a pictorial view shows the object at a glance but cannot be dimensioned reliably',
             '(b) Lists what a title block carries — part name and number, scale, units, revision, who drew and approved it, and the date',
             '(b) Explains that this makes the drawing traceable, so the right version is built',
             '(c) Identifies a sustainability issue, such as material choice, energy in manufacture, or end-of-life recycling',
             '(c) Explains its effect across the life cycle of the product'],
      model:'Orthogonal views look straight at each face, so every dimension on them is true and can be measured and toleranced; a pictorial view is useful for understanding the shape but foreshortens everything. The title block makes the drawing traceable — part name and number, scale, units, revision, date and signatures — so a workshop can be sure it is building the current version of the right part. Sustainability is documented across the whole life cycle: the energy and emissions tied up in the material, how long the part lasts, whether it can be repaired, and whether it can be recycled rather than dumped.' };
  }
];

/* the minus-sign repair, as for the other Year 12 subjects */
[MODULES_EN12].forEach(ms => ms.forEach(m => m.topics.forEach(t => { t.gen = tidyQ(t.gen); })));

if (typeof REVISION_PAGE !== "undefined" && REVISION_PAGE) showGrid();
