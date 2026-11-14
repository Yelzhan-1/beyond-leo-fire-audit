/* Beyond LEO Fire Audit: data and verdict engine.
   No DOM access in this file, so it can be tested on its own. */
(function (root) {
  'use strict';

  /* ---------- constants ---------- */
  var R = 8.314462618;          // J/(mol K)
  var T = 296.15;               // K, 23 C cabin temperature used for every calculation
  var MMHG_PER_KPA = 7.500617;
  var M_CO2 = 44.01;            // g/mol
  var PFE_CO2_KG = 2.7;         // ISS US-segment CO2 extinguisher charge (Guibaud et al.)
  var LIMITS = {
    co2_1h_mmHg: 3,             // NASA-STD-3001 one-hour average, as cited in the Saffire VI paper
    co_1h_ppm: 425,             // SMAC, JSC 20584, as cited in the Saffire VI paper
    co_24h_ppm: 100,            // SMAC, JSC 20584, as cited in the Saffire VI paper
    co2_idlh_ppm: 40000         // NIOSH IDLH
  };
  var CO2_IDLH_MMHG = LIMITS.co2_idlh_ppm / 1e6 * 760; // 30.4 mmHg at sea-level pressure
  /* Saffire VI sample 3: two-sided PMMA, the largest toxic-gas release reported */
  var SAF6 = { v: 16.7, p: 54.6, co_ppm: 308, co2_mmHg: 3.51, kJ: 1280 };
  var ORION_PRESSURIZED_M3 = 19.6;  // 690.6 cubic feet
  var ISS_HABITABLE_M3 = 388;
  var BRE_STEADY_O2 = 26.5;         // lowest oxygen level with steady still-air flames in ACME BRE
  var FLEX = { heptane: 0.20, methanol: 0.30 }; // CO2 fraction at the limiting oxygen index, air at 1 atm

  /* ---------- physics helpers (ideal gas, perfectly mixed cabin) ---------- */
  function moles(pKPa, vM3) { return pKPa * 1000 * vM3 / (R * T); }

  function co2Discharge(env, kg) {
    var nAdd = (kg == null ? PFE_CO2_KG : kg) * 1000 / M_CO2;
    var n = moles(env.p, env.v);
    var pKPa = nAdd * R * T / env.v / 1000;
    return {
      molAdded: nAdd,
      fractionPct: nAdd / (n + nAdd) * 100,
      mmHg: pKPa * MMHG_PER_KPA,
      timesLimit: pKPa * MMHG_PER_KPA / LIMITS.co2_1h_mmHg,
      newPressureKPa: env.p * (n + nAdd) / n
    };
  }

  function floodKg(env, fraction) {       // CO2 mass that brings the cabin gas to a given CO2 fraction
    return fraction / (1 - fraction) * moles(env.p, env.v) * M_CO2 / 1000;
  }

  function fireScale(env, mult) {         // the Saffire VI-3 fire, moved into another cabin
    var m = mult == null ? 1 : mult;
    var coMol = SAF6.co_ppm / 1e6 * moles(SAF6.p, SAF6.v);
    return {
      coMol: coMol * m,
      coGrams: coMol * m * 28.01,
      coPpm: m * coMol / moles(env.p, env.v) * 1e6,
      co2mmHg: m * SAF6.co2_mmHg * SAF6.v / env.v
    };
  }

  function maskO2(env) {                  // oxygen released into the cabin that lifts O2 by one point
    var n = moles(env.p, env.v), x = env.o2 / 100;
    var d = 0.01 * n / (1 - x - 0.01);
    return { mol: d, litresSTP: d * 22.414 };
  }

  function o2After(env, litresSTP) {      // cabin oxygen after releasing pure O2
    var n = moles(env.p, env.v), d = litresSTP / 22.414;
    return (env.o2 / 100 * n + d) / (n + d) * 100;
  }

  function cleanupMinutes(v, c0, target, cfm, eff) {
    if (!(c0 > target)) return 0;
    var q = cfm * 0.0283168;              // m3 per minute
    if (!(q > 0) || !(eff > 0)) return Infinity;
    return v / (q * eff) * Math.log(c0 / target);
  }

  function gClass(g) { return g < 0.01 ? 'zero' : (g < 0.9 ? 'partial' : 'one'); }
  function isMarsLike(g) { return g > 0.3 && g < 0.5; }
  function bodyName(g) { return isMarsLike(g) ? 'Martian' : 'lunar'; }

  function fmt(x, d) {
    if (!isFinite(x)) return 'no limit';
    var p = Math.pow(10, d == null ? 0 : d);
    var s = (Math.round(x * p) / p).toFixed(d == null ? 0 : d);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function sig(x) {                        // sensible digits for display
    if (!isFinite(x)) return 'no limit';
    var a = Math.abs(x);
    if (a >= 100) return fmt(x, 0);
    if (a >= 10) return fmt(x, 0);
    if (a >= 1) return fmt(x, 1);
    return fmt(x, 2);
  }

  /* ---------- data (see assets/js/data/*.js) ---------- */
  var D = root.AUDIT_DATA;
  if (!D || !D.SOURCES || !D.INV || !D.ENVS || !D.CUSTOM_DEFAULT) throw new Error('AUDIT_DATA is missing: load assets/js/data/*.js before engine.js');
  var SOURCES = D.SOURCES, INV = D.INV, ENVS = D.ENVS, CUSTOM_DEFAULT = D.CUSTOM_DEFAULT;


  /* ---------- evidence records ----------
     dir: supports | weakens | refutes | open | context
     when(env): does this record apply to the cabin?                        */
  var zero = function (e) { return gClass(e.g) === 'zero'; };
  var partial = function (e) { return gClass(e.g) === 'partial'; };
  var any = function () { return true; };

  var EVIDENCE = [
    /* --- mat: 1 g flammability screening --- */
    { id: 'mat-bass', row: 'mat', dir: 'weakens', when: zero, basis: 'orbit', inv: 'bass', src: 'bass13', loc: 'Thin-fuel results',
      cond: 'ISS glovebox, cotton and fibreglass fabric, airflow against the flame, station air',
      finding: 'The fabric held a flame spreading against the airflow. In normal-gravity air the matching downward spread goes out by itself.' },
    { id: 'mat-mist', row: 'mat', dir: 'weakens', when: zero, basis: 'orbit', inv: 'mist', src: 'mist', loc: 'Principal investigator statement',
      cond: 'ISS, acrylic samples, oxygen and pressure varied',
      finding: 'The team reports a flammability limit near 15% oxygen on the station against roughly 18% in normal gravity. They note that airflow speed or gravity could be the cause.' },
    { id: 'mat-urban', row: 'mat', dir: 'weakens', when: zero, basis: 'nasa', inv: null, src: 'urban21', loc: 'Slide 12',
      cond: 'NASA Glenn research summary',
      finding: 'A microgravity flame is weaker than a 1 g flame, yet it keeps spreading at lower oxygen percentages.' },
    { id: 'mat-cent', row: 'mat', dir: 'refutes', when: partial, basis: 'ground', inv: 'pg', src: 'ferkul11', loc: 'Abstract',
      cond: 'Centrifuge inside the NASA Glenn 5.2 s drop tower, three thin materials, lunar gravity',
      finding: 'All three materials burned at lower oxygen concentrations in lunar gravity than in normal gravity. The authors caution that the short test time changes the limit criteria.' },
    { id: 'mat-moc', row: 'mat', dir: 'refutes', when: partial, basis: 'ground', inv: 'pg', src: 'urban21', loc: 'Slides 13 and 14',
      cond: 'Nomex, Mylar and Ultem 1000 at zero, lunar, Martian and normal gravity',
      finding: 'At the highest oxygen level each material passes in normal gravity, flames still spread in partial gravity for all three. Lunar gravity can give a lower limit than zero or Martian gravity, and the trend depends on the material.' },
    { id: 'mat-sibal', row: 'mat', dir: 'refutes', when: partial, basis: 'ground', inv: 'pg', src: 'fm2', loc: 'Abstract',
      cond: 'Cotton and fibreglass fabric in air, lunar gravity from a drop-tower centrifuge and parabolic flight',
      finding: 'The fabric burns downward in lunar gravity. In Earth gravity it goes out right after ignition.' },
    { id: 'mat-f26', row: 'mat', dir: 'refutes', when: partial, basis: 'nasa', inv: 'pg', src: 'ferkul26', loc: 'Pages 2 and 17',
      cond: 'NASA and USRA summary, March 2026',
      finding: 'Evidence is mounting that a material which passes the standard test can fail below 1 g. Models and experiments point to lunar gravity as close to the most flammable condition.' },

    { id: 'mat-apollo1', row: 'mat', dir: 'context', when: any, basis: 'review', inv: null, src: 'apollo1', loc: 'Lessons learned',
      cond: 'Apollo 1 ground test, 1967, cabin pressurized with 100% oxygen',
      finding: 'The fire spread quickly in the pure oxygen atmosphere. Afterwards NASA severely restricted and controlled the combustible materials allowed in the cabin.' },

    /* --- det: detector sensitivity --- */
    { id: 'det-same', row: 'det', dir: 'weakens', when: any, basis: 'orbit', inv: 'same', src: 'wp', loc: 'Introduction',
      cond: 'ISS glovebox, smoke from overheated Teflon, Kapton, silicone rubber, cellulose and Pyrell',
      finding: 'The ISS detector failed to alarm for Kapton smoke in half of the tests and for Teflon smoke in two-thirds.' },
    { id: 'det-fsj', row: 'det', dir: 'weakens', when: any, basis: 'orbit', inv: 'same', src: 'nist18', loc: 'Results summary',
      cond: 'Same experiment, ISS light-scattering detector and Shuttle ionization detector side by side',
      finding: 'Neither detector caught every smoke type. Large particles from cellulose, silicone and Pyrell were picked up easily, while the smaller Teflon and Kapton particles were often missed. Both plastics are common in electronics.' },
    { id: 'det-abs', row: 'det', dir: 'weakens', when: any, basis: 'orbit', inv: 'same', src: 'meyer18', loc: 'Abstract',
      cond: 'Same experiment, journal paper',
      finding: 'The two spacecraft smoke detectors did not detect every type of smoke. Particles made on the station were not significantly different from those made in matching ground tests.' },
    { id: 'det-981', row: 'det', dir: 'weakens', when: any, basis: 'orbit', inv: 'saffire', src: 'saf6', loc: 'Section III',
      cond: 'Saffire VI, Cygnus with 16.7 m³ free volume',
      finding: 'Smoke at the far-field sensor unit reached the alarm threshold at 981 s. By then much of the hazardous gas had been released.' },
    { id: 'det-pg', row: 'det', dir: 'open', when: partial, basis: 'nasa', inv: null, src: 'fort23', loc: 'Abstract',
      cond: 'NASA and USRA poster, 2023',
      finding: 'Smoke particle properties under partial gravity, elevated oxygen and reduced pressure are listed as ongoing and future measurements.' },

    /* --- dust: false alarms --- */
    { id: 'dust-daft', row: 'dust', dir: 'supports', when: function (e) { return !e.dust; }, basis: 'orbit', inv: 'daft', src: 'urban07', loc: 'Slides 25 and 26',
      cond: 'ISS cabin air sampled with a particle counter and a dust monitor',
      finding: 'Cabin air averaged about 0.005 mg/m³ and 15 particles per cm³, substantially cleaner than the Shuttle or a typical office.' },
    { id: 'dust-nuis', row: 'dust', dir: 'weakens', when: any, basis: 'practice', inv: null, src: 'wp', loc: 'Introduction',
      cond: 'ISS operations',
      finding: 'The ISS detector does not select for smoke particles, so suspended dust causes nuisance alarms. Crews typically disable the detectors while vacuuming.' },
    { id: 'dust-maint', row: 'dust', dir: 'weakens', when: any, basis: 'nasa', inv: null, src: 'ruff21', loc: 'Slide 15',
      cond: 'NASA Glenn technology summary',
      finding: 'Habitat maintenance can release particles and cause false fire alarms.' },
    { id: 'dust-lunar', row: 'dust', dir: 'refutes', when: function (e) { return e.dust; }, basis: 'ground', inv: 'gasp', src: 'gasp26', loc: 'Preliminary results',
      cond: 'NASA Glenn chamber tests with a lunar highlands regolith simulant',
      finding: 'Smoke and lunar dust have overlapping particle sizes that set off the detector. NASA states that the detection system has to tell combustion particles from cabin dust and lunar dust.' },

    { id: 'dust-spinoff', row: 'dust', dir: 'context', when: any, basis: 'review', inv: null, src: 'firedet', loc: 'Article text',
      cond: 'Fire detector described by NASA Spinoff in 1978',
      finding: 'A detector that samples the air for combustion particles can tell them from dust, which makes it less susceptible to false alarms.' },

    /* --- place: smoke transport to detectors --- */
    { id: 'place-iss', row: 'place', dir: 'supports', when: zero, basis: 'practice', inv: null, src: 'wp', loc: 'Introduction',
      cond: 'ISS design',
      finding: 'Microgravity has no buoyant smoke plume, so ISS detectors sit in the cabin air return vents ahead of the filters and the ventilation brings the smoke to them.' },
    { id: 'place-slow', row: 'place', dir: 'context', when: zero, basis: 'nasa', inv: null, src: 'urban08', loc: 'Abstract',
      cond: 'NASA and NIST smoke transport study',
      finding: 'Detection takes longer than in normal gravity.' },
    { id: 'place-unclear', row: 'place', dir: 'open', when: partial, basis: 'nasa', inv: null, src: 'urban21', loc: 'Slide 16',
      cond: 'NASA Glenn research summary',
      finding: 'It is unclear how limited buoyancy will move smoke. Modelling is needed to choose between ceiling detectors and detectors at floor-level air intakes.' },
    { id: 'place-cfd', row: 'place', dir: 'open', when: partial, basis: 'model', inv: null, src: 'fort23', loc: 'Poster results',
      cond: 'Computer model of a 2 m cabin volume in lunar gravity',
      finding: 'Buoyant and forced flow are expected to be of similar size. A smoke layer partly survives at 1 cm/s of forced flow and is mixed through the volume at 5 cm/s. Where to put detectors stays an open question.' },
    { id: 'place-ruff', row: 'place', dir: 'open', when: partial, basis: 'nasa', inv: null, src: 'ruff21', loc: 'Slides 9 and 13',
      cond: 'NASA Glenn technology summary',
      finding: 'In partial gravity smoke production, buoyancy and life-support air circulation compete. Lunar gravity can change the detection strategy depending on vehicle design.' },

    /* --- vent: ventilation shutdown --- */
    { id: 'vent-bass', row: 'vent', dir: 'supports', when: function (e) { return zero(e) && e.o2 < BRE_STEADY_O2; }, basis: 'orbit', inv: 'bass', src: 'basstb', loc: 'Results paragraph',
      cond: 'ISS glovebox, station air',
      finding: 'After two minutes of burning the airflow was switched off and the flame went out rapidly.' },
    { id: 'vent-bass2', row: 'vent', dir: 'supports', when: function (e) { return zero(e) && e.o2 < BRE_STEADY_O2; }, basis: 'orbit', inv: 'bass2', src: 'bass2', loc: 'Extinction images',
      cond: 'ISS glovebox, 0.1 mm thick sample, airflow against the flame',
      finding: 'The flame quenched when the flow fell below about 2 cm/s and neared blow-off as it passed 40 cm/s.' },
    { id: 'vent-bre21', row: 'vent', dir: 'supports', when: function (e) { return zero(e) && e.o2 <= 21.5; }, basis: 'orbit', inv: 'bre', src: 'dehghani22', loc: 'Abstract',
      cond: 'ISS, 25 mm gas burner emulating solid and liquid fuels, no forced flow',
      finding: 'Every flame at 21% oxygen went out by itself within 40 s.' },
    { id: 'vent-pmma', row: 'vent', dir: 'weakens', when: zero, basis: 'orbit', inv: 'saffire', src: 'saf45', loc: 'Section III.A',
      cond: 'Saffire IV, Cygnus, acrylic slab burning on two sides, 100 kPa, 22% oxygen',
      finding: 'When the fan was cut the hot sample kept bubbling, and its jets of fuel vapour stirred enough mixing to keep the flame alive through 15 s without flow.' },
    { id: 'vent-cotton', row: 'vent', dir: 'weakens', when: zero, basis: 'orbit', inv: 'saffire', src: 'saf45', loc: 'Section III.A',
      cond: 'Saffire V, Cygnus, cotton jersey, 70.7 kPa, 26.2% oxygen',
      finding: 'With the fan off for about 70 s, glowing embers and small blue flamelets remained. The flame grew back when the flow returned and burned about 150 s more.' },
    { id: 'vent-v34', row: 'vent', dir: 'context', when: zero, basis: 'orbit', inv: 'saffire', src: 'saf45', loc: 'Section III.A',
      cond: 'Saffire V, acrylic samples, 71 to 73 kPa, about 25.5% oxygen',
      finding: 'After 300 s at 5 cm/s the fan was turned off and both samples went out immediately. The authors still conclude that extinction cannot be assumed to come quickly in still conditions.' },
    { id: 'vent-brehi', row: 'vent', dir: 'refutes', when: function (e) { return zero(e) && e.o2 >= BRE_STEADY_O2; }, basis: 'orbit', inv: 'bre', src: 'dehghani22', loc: 'Abstract',
      cond: 'ISS, 25 mm gas burner emulating solid and liquid fuels, no forced flow',
      finding: 'Steady flames were observed at 26.5, 34 and 40% oxygen.' },
    { id: 'vent-partial', row: 'vent', dir: 'refutes', when: partial, basis: 'nasa', inv: null, src: 'urban21', loc: 'Slide 14',
      cond: 'NASA Glenn research summary',
      finding: 'Stopping the ventilation flow is not an effective way to put out a fire in lunar or Martian gravity, because natural convection keeps supplying air.' },
    { id: 'vent-gollner', row: 'vent', dir: 'open', when: partial, basis: 'nasa', inv: null, src: 'gollner', loc: 'Past investigations',
      cond: 'Community white paper',
      finding: 'The lack of direct tests in partial gravity is called troubling, because available results suggest lunar and Martian gravity could make flame spread more likely.' },

    /* --- gap: confined spaces --- */
    { id: 'gap-quench', row: 'gap', dir: 'supports', when: zero, basis: 'orbit', inv: 'cc', src: 'li21', loc: 'Abstract',
      cond: 'ISS glovebox, thin fabric burning between two baffles in forced flow',
      finding: 'Below a limiting distance between the baffles the flame fails to spread.' },
    { id: 'gap-opt', row: 'gap', dir: 'context', when: zero, basis: 'orbit', inv: 'cc', src: 'li21', loc: 'Abstract',
      cond: 'Same experiment',
      finding: 'Spread rate and flame length peak at an intermediate gap. Confinement speeds up the flow and reflects heat back, until short oxygen supply and heat loss to the walls take over.' },
    { id: 'gap-chimney', row: 'gap', dir: 'refutes', when: partial, basis: 'nasa', inv: null, src: 'urban21', loc: 'Slide 14',
      cond: 'NASA Glenn research summary',
      finding: 'In partial gravity buoyant flow can drive a fire inside a small space, a chimney effect.' },

    /* --- co2: CO2 extinguisher --- */
    { id: 'co2-concern', row: 'co2', dir: 'weakens', when: any, basis: 'nasa', inv: null, src: 'spinoff', loc: 'Article text',
      cond: 'ISS operations',
      finding: 'Station emergency breathing equipment does not filter carbon dioxide, which NASA calls a serious concern. Nine water-mist extinguishers were built to replace the original CO₂ units, and the last one reached the station in 2016.' },
    { id: 'co2-flex', row: 'co2', dir: 'weakens', when: any, basis: 'orbit', inv: 'flex', src: 'dietrich14', loc: 'Abstract',
      cond: 'ISS, heptane and methanol droplets, CO₂ dispersed into air at 1 atm',
      finding: 'Steady droplet burning stopped only once the gas reached about 17% oxygen with 20% CO₂ for heptane, and 14% oxygen with 30% CO₂ for methanol.' },
    { id: 'co2-pfe', row: 'co2', dir: 'context', when: any, basis: 'review', inv: null, src: 'guibaud', loc: 'Suppression section',
      cond: 'ISS US segment equipment',
      finding: 'The portable CO₂ extinguishers hold 2.7 kg of gas compressed to 58 atm.' },
    { id: 'co2-orion', row: 'co2', dir: 'context', when: any, basis: 'nasa', inv: null, src: 'ruff21', loc: 'Slide 18',
      cond: 'NASA Glenn technology summary',
      finding: 'Orion carries a water-mist extinguisher.' },

    { id: 'co2-mir', row: 'co2', dir: 'context', when: any, basis: 'review', inv: null, src: 'mir', loc: 'Account of the fire',
      cond: 'Mir, 24 February 1997, burning solid-fuel oxygen generator',
      finding: 'Three foam extinguishers were used on the flame, which lasted several minutes and finally went out by itself.' },

    /* --- mask: oxygen masks --- */
    { id: 'mask-iss', row: 'mask', dir: 'supports', when: function (e) { return e.v >= ISS_HABITABLE_M3; }, basis: 'practice', inv: null, src: 'guibaud', loc: 'ISS response section',
      cond: 'ISS procedure',
      finding: 'Crews are told to put on emergency masks that supply pure oxygen when smoke builds up.' },
    { id: 'mask-orion', row: 'mask', dir: 'refutes', when: function (e) { return e.v <= ORION_PRESSURIZED_M3; }, basis: 'nasa', inv: null, src: 'ruff21', loc: 'Slide 18',
      cond: 'NASA Glenn technology summary, Orion',
      finding: 'The ISS breathing apparatus does not suit Orion. In so small a volume the oxygen given to the crew would raise the cabin oxygen level and add to the fire risk. Water mist could also film over the ISS mask filter.' },
    { id: 'mask-gap', row: 'mask', dir: 'context', when: any, basis: 'nasa', inv: null, src: 'ruff16', loc: 'Slide 4',
      cond: 'NASA capability gap list',
      finding: 'NASA lists an emergency crew mask that is compatible with small cabin volumes and adds no oxygen to the cabin.' },

    { id: 'mask-mir', row: 'mask', dir: 'context', when: any, basis: 'review', inv: null, src: 'mir', loc: 'Account of the fire',
      cond: 'Mir, 24 February 1997, six crew members aboard',
      finding: 'The crew quickly put on oxygen masks. The station life support system cleared the smoke over the next several hours.' },

    /* --- air: toxic gas after the fire --- */
    { id: 'air-saf6', row: 'air', dir: 'weakens', when: any, basis: 'orbit', inv: 'saffire', src: 'saf6', loc: 'Table 2 and Section III',
      cond: 'Saffire VI, Cygnus with 16.7 m³ free volume, 54 to 55 kPa, 29 to 30% oxygen, two acrylic fires releasing 1,280 and 830 kJ',
      finding: 'Carbon monoxide at the far-field inlet rose by 308 and 320 ppm and CO₂ by 3.51 and 3.37 mmHg. Both fires passed the 3 mmHg one-hour CO₂ limit. CO was well above the 100 ppm 24-hour limit and close to the 425 ppm one-hour limit.' },
    { id: 'air-heat', row: 'air', dir: 'context', when: any, basis: 'orbit', inv: 'saffire', src: 'saf6', loc: 'Abstract',
      cond: 'Saffire IV to VI, fires of 1.5 to 3.2 kW in 17 to 19 m³ of free volume',
      finding: 'Temperature and pressure rise mattered less than the rise in carbon dioxide and carbon monoxide.' },
    { id: 'air-eater', row: 'air', dir: 'context', when: any, basis: 'orbit', inv: 'saffire', src: 'fort21', loc: 'Slides 17 and 18',
      cond: 'Saffire IV and V, prototype smoke eater with a CO oxidation catalyst and activated carbon',
      finding: 'Little carbon monoxide was removed during the burns. The cause was still under investigation, with catalyst fouling and bed packing as suspects.' },
    { id: 'air-pg', row: 'air', dir: 'open', when: partial, basis: 'nasa', inv: null, src: 'saf6', loc: 'Section IV',
      cond: 'Saffire VI conclusions',
      finding: 'Extending these results to the partial gravity of the Moon and Mars needs further work.' },

    /* --- home: resupply and return --- */
    { id: 'home-iss', row: 'home', dir: 'supports', when: function (e) { return !e.beyond; }, basis: 'review', inv: null, src: 'guibaud', loc: 'Deep space challenges',
      cond: 'Review of spacecraft fire incidents and protocols',
      finding: 'ISS protocols lean on contingency resupply and on the crew being able to leave in docked return vehicles.' },
    { id: 'home-mir', row: 'home', dir: 'context', when: any, basis: 'review', inv: null, src: 'mir', loc: 'Account of the fire',
      cond: 'Mir, 24 February 1997, six crew members and two docked Soyuz vehicles',
      finding: 'The flame blocked the evacuation route to one of the two Soyuz spacecraft.' },
    { id: 'home-a13', row: 'home', dir: 'context', when: function (e) { return e.beyond; }, basis: 'review', inv: null, src: 'apollo13', loc: 'Mission account',
      cond: 'Apollo 13, on the way to the Moon',
      finding: 'When an oxygen tank blew up on the third day of the flight, the crew moved into the lunar module and used it as a lifeboat until splashdown.' },
    { id: 'home-deep', row: 'home', dir: 'refutes', when: function (e) { return e.beyond; }, basis: 'review', inv: null, src: 'guibaud', loc: 'Deep space challenges',
      cond: 'Review of spacecraft fire incidents and protocols',
      finding: 'Deep-space expeditions have no emergency resupply, and lunar and Martian plans call for more self-reliance. A fire that uses up the response resources leaves the crew exposed to a second accident.' }
  ];

  /* ---------- the ten rules ---------- */
  var ROWS = [
    { id: 'mat', phase: 'Prevent', title: 'A material that passes the 1 g flame test is safe to fly', short: '1 g flame test',
      practice: 'NASA screens cabin materials with an upward-burning test in normal gravity, NASA-STD-6001 Test 1. A sample that burns more than 15 cm fails.', practiceSrc: ['ferkul26'],
      rule: 'Weakens at 0 g, where orbit data show lower oxygen limits. Breaks in partial gravity, where ground tests show materials burning below their 1 g limit.',
      verdict: function (e) {
        if (gClass(e.g) === 'partial') return { status: 'breaks', basis: 'ground', reason: 'Burns below its 1 g limit',
          why: 'Ground tests at ' + bodyName(e.g) + ' gravity found materials burning at oxygen levels where the normal-gravity test passes them. At ' + fmt(e.o2, 0) + '% oxygen the margin shrinks further.' + (isMarsLike(e.g) ? ' The Martian-gravity data are thinner than the lunar data.' : '') };
        return { status: 'weakens', basis: 'orbit', reason: 'Lower oxygen limit in orbit',
          why: 'Station experiments show flames surviving at lower oxygen in microgravity than in the 1 g test. A pass on the ground is not a worst case.' };
      },
      next: 'Screen materials at the oxygen level, pressure and gravity of the real cabin. FM2, which NASA describes as the first combustion experiment on another planetary body, is built to burn four fabric samples on the lunar surface at 8.2 psi, starting at 37, 33, 29 and 25% oxygen. The LUCI sounding rocket has already run lunar-gravity burns lasting over two and a half minutes.',
      nextSrc: ['ferkul26', 'luci', 'combsci'],
      earth: 'Light, fire-resistant, heat-protective materials first developed for spacesuits were applied to firefighter clothing in a programme of NASA and the U.S. Fire Administration.', earthSrc: ['attire'],
      gap: function (e) {
        if (gClass(e.g) === 'partial') return 'No burn has yet run for minutes in true ' + bodyName(e.g) + ' gravity inside a habitat atmosphere. Drop-tower centrifuge tests last about five seconds and the LUCI rocket reached two and a half minutes at lunar gravity.';
        return 'Station tests are still separating whether the lower limit comes from slow airflow or from the missing gravity.';
      }, gapSrc: ['ferkul11', 'luci', 'mist'] },

    { id: 'det', phase: 'Detect', title: 'The smoke detector responds to smoke from any likely fuel', short: 'Detector sensitivity',
      practice: 'ISS uses laser light-scattering detectors. They respond best to particles above about 1 µm and reach down to about 0.6 µm.', practiceSrc: ['urban08'],
      rule: 'Weakens everywhere. Orbit tests show the ISS detector missing smoke from two common wire and insulation plastics.',
      verdict: function (e) {
        var extra = gClass(e.g) === 'partial' ? ' Smoke from overheated materials has not been measured in partial gravity, so this result is carried over from orbit.' : '';
        return { status: 'weakens', basis: 'orbit', carried: gClass(e.g) === 'partial', reason: 'Misses Kapton and Teflon smoke',
          why: 'On the station the detector stayed silent for Kapton smoke in half of the tests and for Teflon smoke in two-thirds. Both plastics are widely used in electronics, the most likely source of fire and smoke in a spacecraft.' + extra };
      },
      next: 'Detectors that read more than one property of the smoke. The SAME team reports that a sensor measuring several moments of the particle size distribution may detect better and reject false alarms better than a single-property detector. NASA lists early detection with particle size discrimination as a capability gap.',
      nextSrc: ['urban13', 'ruff16'],
      gap: function (e) {
        if (gClass(e.g) === 'partial') return 'Smoke from overheated materials has not been characterised in partial gravity, at elevated oxygen or at reduced pressure. NASA lists these measurements as ongoing and future work.';
        return null;
      }, gapSrc: ['fort23'] },

    { id: 'dust', phase: 'Detect', title: 'An alarm means fire, not dust', short: 'False alarms',
      practice: 'A light-scattering detector reacts to any particle of the right size. DAFT found ISS cabin air substantially cleaner than the Shuttle or a typical office.', practiceSrc: ['urban07', 'wp'],
      rule: 'Weakens in any cabin, because ISS crews already see nuisance alarms from dust. Breaks where planetary dust enters the cabin.',
      verdict: function (e) {
        if (e.dust) return { status: 'breaks', basis: 'ground', reason: isMarsLike(e.g) ? 'Surface dust trips detectors' : 'Lunar dust trips detectors',
          why: 'Chamber tests with lunar regolith simulant show smoke and dust overlapping in particle size and setting off the detector.' + (isMarsLike(e.g) ? ' The tests used lunar simulant. Carrying the result to Martian dust is an assumption of this audit.' : ' NASA states that a lunar detection system has to tell combustion particles from cabin dust and lunar dust.') };
        return { status: 'weakens', basis: 'practice', reason: 'Cabin dust causes nuisance alarms',
          why: 'Station air is clean, yet suspended dust still causes nuisance alarms and crews switch detectors off while vacuuming. This cabin is assumed to use the same kind of detector.' };
      },
      next: 'A sensor that tells smoke from dust. The NASA Fire Detection System Project is testing photoelectric and ionization detectors against smoke mixed with regolith simulant, and names a low-cost discriminating sensor as the key need.',
      nextSrc: ['gasp26'],
      earth: 'A fire detector described in 1978 samples the air for combustion particles and tells them from dust, so it gives fewer false alarms. Linked sensors can cover large areas such as mines.', earthSrc: ['firedet'],
      gap: function (e) {
        if (!e.dust) return null;
        return 'Detector behaviour with smoke mixed with lunar dust is at the chamber-test stage, using regolith simulant.' + (isMarsLike(e.g) ? ' This record holds no detector data for Martian dust.' : '');
      }, gapSrc: ['gasp26'] },

    { id: 'place', phase: 'Detect', title: 'Cabin airflow carries the smoke to the detectors', short: 'Detector placement',
      practice: 'With no up or down, ISS detectors sit in the cabin air return vents and wait for the ventilation to bring smoke to them.', practiceSrc: ['wp', 'nist18'],
      rule: 'Holds at 0 g as ISS design practice. Unknown in partial gravity: NASA says smoke transport there is unclear and only models exist.',
      verdict: function (e) {
        if (gClass(e.g) === 'partial') return { status: 'unknown', basis: 'model', reason: 'Smoke path not yet measured',
          why: 'With some gravity a weak buoyant smoke plume competes with the ventilation flow. NASA modelling for lunar gravity expects the two to be of similar strength. There are computer models but no measurements, and NASA has not settled whether detectors belong on the ceiling or at the air intakes.' + (isMarsLike(e.g) ? ' No model for Martian gravity is in this record.' : '') };
        return { status: 'holds', basis: 'practice', reason: 'Detectors sit in air returns',
          why: 'Without buoyancy the ventilation is the only thing moving smoke, so detectors in the return vents see it. Detection is slower than on Earth.' };
      },
      next: 'Measure smoke transport in partial gravity. Until then detector placement in surface habitats rests on simulations.',
      nextSrc: ['fort23', 'urban21'],
      gap: function (e) {
        if (gClass(e.g) === 'partial') return 'Where smoke goes in partial gravity is known only from simulations. No measurement exists to place detectors by.';
        return null;
      }, gapSrc: ['fort23', 'urban21'] },

    { id: 'vent', phase: 'Respond', title: 'Stop the airflow and the fire goes out', short: 'Ventilation shutdown',
      practice: 'The first response to a fire in microgravity is to turn off forced airflow. BASS results on the station supported that protocol.', practiceSrc: ['basstb'],
      ruleSrc: ['urban21', 'dehghani22', 'saf45'],
      rule: 'Breaks in partial gravity, where NASA says natural convection keeps feeding the fire. Breaks at 0 g from 26.5% oxygen, where station burner tests held steady flames in still gas. Weakens at 0 g below that, where some Saffire fuels kept burning without flow.',
      verdict: function (e) {
        if (gClass(e.g) === 'partial') return { status: 'breaks', basis: 'nasa', reason: 'Buoyancy keeps feeding it',
          why: 'With some gravity, hot gas rises and pulls fresh air in after it, fans or no fans. NASA Glenn states that stopping ventilation is not an effective way to put out a fire in lunar or Martian gravity.' + (e.o2 >= BRE_STEADY_O2 ? ' Station burner tests also held steady flames in still gas at 26.5% oxygen and above, and this cabin runs at ' + fmt(e.o2, e.o2 % 1 ? 1 : 0) + '%.' : '') };
        if (e.o2 >= BRE_STEADY_O2) return { status: 'breaks', basis: 'orbit', reason: 'Steady flames in still gas',
          why: 'In station burner tests with no forced flow, flames at 21% oxygen died within 40 s but flames at 26.5% and above burned steadily. This cabin runs at ' + fmt(e.o2, 1) + '% oxygen.' };
        return { status: 'weakens', basis: 'orbit', reason: 'Some fuels keep burning',
          why: 'Small samples on the station went out quickly once the flow stopped. On Saffire IV a thick acrylic slab stayed alight through 15 s without flow, kept going by its own jets of fuel vapour. The Saffire authors conclude that quick extinction cannot be assumed in still conditions.' };
      },
      next: 'Suppression that does not rely on starving the flame of airflow. The Saffire team notes that reduced flow, instead of zero flow, may help extinction but carries risks of its own.',
      nextSrc: ['saf45'],
      gap: function (e) {
        if (gClass(e.g) === 'partial') return 'The statement that fan shutdown fails in partial gravity rests on short tests and modelling. A full-length demonstration in ' + bodyName(e.g) + ' gravity is missing.';
        if (e.o2 > 21.5 && e.o2 < BRE_STEADY_O2) return 'The burner tests jump from 21% oxygen, where flames died, to 26.5%, where they held. The switch point in between is not pinned down in this record.';
        return null;
      }, gapSrc: ['urban21', 'gollner', 'dehghani22'] },

    { id: 'gap', phase: 'Respond', title: 'A narrow gap smothers a flame', short: 'Hidden spaces',
      practice: 'On the station a flame squeezed between two surfaces stops spreading once the gap is tight enough.', practiceSrc: ['li21'],
      rule: 'Holds at 0 g, measured on the station, with a caveat about intermediate gaps. Breaks in partial gravity, where NASA expects a chimney effect.',
      verdict: function (e) {
        if (gClass(e.g) === 'partial') return { status: 'breaks', basis: 'nasa', reason: 'Chimney effect feeds it',
          why: 'With gravity present a gap behaves like a chimney. NASA Glenn states that buoyant flow can drive a fire inside a small space in partial gravity.' };
        return { status: 'holds', basis: 'orbit', reason: 'Flame fails below a limiting gap',
          why: 'Station tests found a limiting gap below which the flame fails to spread. The same tests found the fastest spread at an intermediate gap, so a moderately tight space can burn faster than a wider one.' };
      },
      next: 'Treat closed-out volumes behind panels in a surface habitat as places where a fire can live. This is the reading of this audit, drawn from the NASA statement on chimney-driven fires.',
      nextSrc: ['urban21'],
      gap: function (e) {
        if (gClass(e.g) === 'partial') return 'The chimney effect in gaps is a NASA assessment. The station experiment on confined flames has no partial-gravity counterpart in this record.';
        return null;
      }, gapSrc: ['urban21', 'li21'] },

    { id: 'co2', phase: 'Respond', title: 'A CO₂ extinguisher can be emptied into the cabin', short: 'CO₂ extinguisher',
      practice: 'The ISS US segment was equipped with portable CO₂ extinguishers holding 2.7 kg of gas.', practiceSrc: ['guibaud'],
      ruleSrc: ['saf6', 'niosh'],
      rule: 'Calculated: one 2.7 kg discharge, mixed through the cabin. Breaks above 30.4 mmHg of CO₂, the NIOSH immediate-danger level at sea-level pressure. Otherwise weakens, because NASA already replaced the units on the ISS over crew exposure.',
      verdict: function (e) {
        var c = co2Discharge(e);
        var txt = 'One 2.7 kg discharge mixed through ' + sig(e.v) + ' m³ gives ' + sig(c.mmHg) + ' mmHg of CO₂, about ' + sig(c.fractionPct) + '% of the cabin gas. The one-hour limit is 3 mmHg and the immediate-danger level is about 30 mmHg.';
        if (c.mmHg > CO2_IDLH_MMHG) return { status: 'breaks', basis: 'calc', reason: 'One discharge: ' + sig(c.mmHg) + ' mmHg CO₂', why: txt + ' The extinguisher itself becomes the hazard.' };
        return { status: 'weakens', basis: 'calc', reason: 'One discharge: ' + sig(c.mmHg) + ' mmHg CO₂',
          why: txt + ' Station emergency breathing equipment does not filter CO₂, a concern NASA cites for the move to water mist. Near the nozzle the level is higher than this cabin average.' };
      },
      next: 'Fine water mist. Water-mist extinguishers replaced the CO₂ units on the ISS, the last arriving in 2016, and Orion carries one. NASA lists suppression that is compatible with small cabin volumes as a capability gap.',
      nextSrc: ['spinoff', 'ruff21', 'ruff16'],
      earth: 'A commercial handheld water-mist extinguisher based on the ISS design was built for hospitals and mine operators.', earthSrc: ['fwm'],
      gap: function (e) {
        if (e.o2 > 21.5) return 'This audit uses the FLEX limits for CO₂ dispersed into air at 1 atm. FLEX also ran other oxygen levels, pressures and helium, so the CO₂ fraction needed at ' + fmt(e.o2, 0) + '% oxygen can be worked out from PSI-69.';
        return null;
      }, gapSrc: ['dietrich14'] },

    { id: 'mask', phase: 'Respond', title: 'The crew can breathe from oxygen masks', short: 'Oxygen masks',
      practice: 'ISS crews are told to put on emergency masks that supply pure oxygen when smoke builds up.', practiceSrc: ['guibaud'],
      ruleSrc: ['orion', 'issfacts'],
      rule: 'Breaks at or below 19.6 m³, the pressurized volume of Orion, where NASA says mask oxygen would enrich the cabin. Holds at ISS scale, 388 m³ and above. Unknown in between: no published threshold.',
      verdict: function (e) {
        var m = maskO2(e);
        var calc = ' In this cabin about ' + sig(m.litresSTP) + ' standard litres of released oxygen lift the oxygen level by one percentage point.';
        if (e.v <= ORION_PRESSURIZED_M3) return { status: 'breaks', basis: 'nasa', reason: 'Mask oxygen enriches the cabin',
          why: 'NASA judged the ISS breathing apparatus unsuitable for Orion, because in so small a volume the oxygen fed to the crew raises the cabin oxygen level and feeds the fire. This cabin is no larger than Orion.' + calc };
        if (e.v >= ISS_HABITABLE_M3) return { status: 'holds', basis: 'practice', reason: 'Large volume absorbs it',
          why: 'This is station practice. In a volume this large the oxygen released by masks changes the cabin level very little.' + calc };
        return { status: 'unknown', basis: 'none', reason: 'No published threshold',
          why: 'NASA ruled oxygen masks out for Orion and uses them on the ISS. No published cabin volume marks where the change happens.' + calc };
      },
      next: 'A filtering mask that adds no oxygen to the cabin. NASA lists it as a capability gap and reported in 2021 that work on the emergency mask was progressing.',
      nextSrc: ['ruff16', 'ruff21'],
      earth: 'NASA Johnson Space Center worked with Scott Aviation on firefighter air tanks: a 20-pound backpack for a 30-minute air supply, 13 pounds lighter than conventional tanks, with a face mask redesigned for better vision.', earthSrc: ['airtanks'],
      gap: function (e) {
        if (e.v > ORION_PRESSURIZED_M3 && e.v < ISS_HABITABLE_M3) return 'No published cabin volume marks where oxygen masks stop being acceptable between Orion scale and ISS scale.';
        return null;
      }, gapSrc: ['ruff21'] },

    { id: 'air', phase: 'Recover', title: 'The cabin dilutes smoke and gases to tolerable levels', short: 'Air after the fire',
      practice: 'A large station spreads combustion products through a large volume. Saffire tested what the same kind of fire does in 17 to 19 m³.', practiceSrc: ['saf6'],
      ruleSrc: ['saf6'],
      rule: 'Calculated: the largest Saffire VI gas release, rescaled to this cabin. Breaks above the 425 ppm one-hour CO limit. Weakens above the 100 ppm 24-hour CO limit or the 3 mmHg one-hour CO₂ limit. Otherwise holds.',
      verdict: function (e) {
        var f = fireScale(e);
        var carried = gClass(e.g) === 'partial';
        var txt = 'The Saffire VI acrylic fire, about 1.3 MJ, would raise carbon monoxide by ' + sig(f.coPpm) + ' ppm and CO₂ by ' + sig(f.co2mmHg) + ' mmHg in this cabin if perfectly mixed. Limits: 100 ppm CO for 24 hours, 425 ppm for one hour, 3 mmHg CO₂ for one hour.' + (carried ? ' The gas yields were measured at 0 g and are carried over to partial gravity.' : '');
        var reason = 'Same fire: ' + sig(f.coPpm) + ' ppm CO';
        if (f.coPpm > LIMITS.co_1h_ppm) return { status: 'breaks', basis: 'calc', carried: carried, reason: reason, why: txt };
        if (f.coPpm > LIMITS.co_24h_ppm || f.co2mmHg > LIMITS.co2_1h_mmHg) return { status: 'weakens', basis: 'calc', carried: carried, reason: reason, why: txt };
        return { status: 'holds', basis: 'calc', carried: carried, reason: reason, why: txt + ' Near the fire the levels are higher than this cabin average.' };
      },
      next: 'Post-fire cleanup and monitoring. The Saffire team names rapid removal of toxic by-products as the need after a survivable fire. Its prototype smoke eater removed little carbon monoxide on Saffire IV and V, so this equipment is still open work.',
      nextSrc: ['fort21', 'ruff16'],
      gap: function (e) {
        if (gClass(e.g) === 'partial') return 'Toxic gas release was measured at 0 g in 17 to 19 m³ of free volume. Yields in partial gravity are unmeasured, and the Saffire authors say extending the results needs further work.';
        return 'The rescaling assumes the same fire and perfect mixing, and treats the far-field sensor reading as the cabin average.';
      }, gapSrc: ['saf6'] },

    { id: 'home', phase: 'Recover', title: 'Emergency resupply and a ride home are close', short: 'Resupply and return', context: true,
      practice: 'ISS fire protocols lean on contingency resupply and on docked vehicles that can bring the crew home.', practiceSrc: ['guibaud'],
      rule: 'Programme context, not combustion data. Holds in low Earth orbit. Breaks beyond it.',
      verdict: function (e) {
        if (e.beyond) return { status: 'breaks', basis: 'review', reason: 'No resupply, no quick return',
          why: 'A published review of spacecraft fire safety notes that deep-space expeditions have no emergency resupply and must be more self-reliant. Response resources used up on one fire leave the crew exposed to a second accident.' };
        return { status: 'holds', basis: 'review', reason: 'Resupply and return vehicles',
          why: 'In low Earth orbit the protocols can count on contingency resupply and on docked vehicles for leaving the station.' };
      },
      next: 'The reading of this audit: size the fire response for more than one event, and plan to recover the cabin instead of leaving it.',
      nextSrc: ['guibaud'],
      gap: function () { return null; }, gapSrc: [] }
  ];

  var STATUS = {
    holds:   { label: 'Holds',   weight: 1 },
    weakens: { label: 'Weakens', weight: 2 },
    breaks:  { label: 'Breaks',  weight: 3 },
    unknown: { label: 'Unknown', weight: 2 }
  };
  var BASIS = {
    orbit:    'Measured in orbit',
    ground:   'Ground tests',
    nasa:     'NASA assessment',
    calc:     'Calculated from flight data',
    model:    'Models only',
    practice: 'ISS practice',
    review:   'Published review',
    none:     'No data'
  };

  /* ---------- evaluation ---------- */
  function rowById(id) { for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) return ROWS[i]; return null; }
  function envById(id, custom) {
    if (id === 'custom') return custom;
    for (var i = 0; i < ENVS.length; i++) if (ENVS[i].id === id) return ENVS[i];
    return null;
  }

  function evaluate(rowId, env) {
    var row = rowById(rowId), v = row.verdict(env);
    var direct = [], related = [];
    EVIDENCE.forEach(function (ev) {
      if (ev.row !== rowId) return;
      (ev.when(env) ? direct : related).push(ev);
    });
    v.basisLabel = BASIS[v.basis] + (v.carried ? ', carried over from 0 g' : '');
    v.direct = direct; v.related = related; v.row = row;
    return v;
  }

  function summary(env) {
    var c = { holds: 0, weakens: 0, breaks: 0, unknown: 0 }, list = [];
    ROWS.forEach(function (r) { var v = evaluate(r.id, env); c[v.status]++; list.push(v); });
    return { counts: c, verdicts: list };
  }

  function summaryText(c) {
    var parts = [];
    if (c.breaks) parts.push(c.breaks + (c.breaks === 1 ? ' breaks' : ' break'));
    if (c.weakens) parts.push(c.weakens + (c.weakens === 1 ? ' weakens' : ' weaken'));
    if (c.unknown) parts.push(c.unknown + ' unknown');
    if (c.holds) parts.push(c.holds + (c.holds === 1 ? ' holds' : ' hold'));
    return parts.join(', ');
  }

  /* Rank investigations for a cabin.
     Each rule gives points by verdict (breaks 3, weakens 2, unknown 2, holds 1).
     An investigation earns the full points when one of its records applies to the
     cabin, and 40% when its record on that rule was measured under other conditions. */
  function rankInvestigations(env) {
    var out = {};
    ROWS.forEach(function (r) {
      var v = evaluate(r.id, env), w = STATUS[v.status].weight, seen = {};
      v.direct.forEach(function (ev) {
        if (!ev.inv || ev.dir === 'context') return;
        seen[ev.inv] = 'direct';
      });
      v.related.forEach(function (ev) {
        if (!ev.inv || ev.dir === 'context' || seen[ev.inv]) return;
        seen[ev.inv] = 'carried';
      });
      Object.keys(seen).forEach(function (k) {
        if (!out[k]) out[k] = { id: k, inv: INV[k], score: 0, rows: [] };
        out[k].score += seen[k] === 'direct' ? w : w * 0.4;
        out[k].rows.push({ row: r, status: v.status, how: seen[k] });
      });
    });
    return Object.keys(out).map(function (k) { return out[k]; })
      .sort(function (a, b) { return b.score - a.score || a.inv.name.localeCompare(b.inv.name); });
  }

  /* Rank open questions for a cabin: how far the verdict is from a measurement
     in matching conditions, then how severe the verdict is. */
  function rankGaps(env) {
    var gc = gClass(env.g), out = [];
    ROWS.forEach(function (r) {
      var v = evaluate(r.id, env), text = r.gap(env);
      if (!text) return;
      var u;
      if (v.status === 'unknown') u = 5;
      else if (v.basis === 'nasa' && gc === 'partial') u = 4;
      else if (v.basis === 'ground') u = 3;
      else if (v.carried) u = 3;
      else if (v.basis === 'calc') u = 1;
      else u = 2;
      out.push({ row: r, status: v.status, basisLabel: v.basisLabel, text: text, src: r.gapSrc, u: u, w: STATUS[v.status].weight });
    });
    return out.sort(function (a, b) { return b.u - a.u || b.w - a.w; });
  }

  /* ---------- plain search over the audit ---------- */
  var STOP = { the: 1, a: 1, an: 1, of: 1, to: 1, in: 1, on: 1, for: 1, is: 1, are: 1, do: 1, does: 1, can: 1, i: 1, and: 1, or: 1, what: 1, which: 1, why: 1, how: 1, it: 1, with: 1, at: 1, be: 1, my: 1, we: 1, use: 1, about: 1, that: 1, this: 1, s: 1, there: 1, still: 1, will: 1, would: 1, should: 1, if: 1, when: 1, cabin: 1, cabins: 1, small: 1, used: 1, turning: 1, off: 1, work: 1, into: 1, from: 1, any: 1, not: 1, t: 1, after: 1, behind: 1, fire: 1, fires: 1 };
  var SYN = {
    moon: ['lunar', 'lander', 'rover'], lunar: ['lunar'], mars: ['martian', 'mars'], martian: ['mars', 'martian'],
    rover: ['rover'], orion: ['orion', 'capsule'], capsule: ['orion', 'capsule'], iss: ['iss', 'station'], station: ['iss', 'station'],
    lander: ['lander', 'habitat'], habitat: ['habitat'], base: ['habitat'],
    extinguisher: ['extinguisher', 'co₂', 'co2', 'mist'], co2: ['co₂', 'co2', 'extinguisher', 'dioxide'], mist: ['mist', 'extinguisher'], suppression: ['extinguisher', 'mist', 'suppression'],
    mask: ['mask', 'masks', 'oxygen'], masks: ['mask', 'masks'], breathe: ['mask', 'breathe'],
    detector: ['detector', 'detectors', 'alarm', 'smoke'], detectors: ['detector', 'detectors'], alarm: ['alarm', 'detector'], detection: ['detector', 'detection', 'alarm'],
    dust: ['dust', 'regolith'], regolith: ['dust', 'regolith'],
    fan: ['airflow', 'ventilation', 'fan', 'flow'], fans: ['airflow', 'ventilation', 'fan', 'flow'], ventilation: ['ventilation', 'airflow', 'fan', 'flow'], airflow: ['airflow', 'ventilation', 'flow'],
    material: ['material', 'materials', 'test'], materials: ['material', 'materials'], fabric: ['fabric', 'material'], flammability: ['material', 'flame', 'oxygen', 'limit'],
    toxic: ['monoxide', 'gases', 'toxic', 'air'], gas: ['gases', 'monoxide', 'air'], gases: ['gases', 'air'], monoxide: ['monoxide'], co: ['monoxide'], air: ['air', 'gases', 'dilutes'], cleanup: ['cleanup', 'eater', 'smoke'],
    gap: ['gap', 'narrow', 'chimney', 'confined'], panel: ['gap', 'chimney', 'confined', 'panels'], hidden: ['gap', 'chimney', 'confined'], confined: ['gap', 'confined'],
    resupply: ['resupply', 'return'], evacuate: ['return', 'leave', 'resupply'], escape: ['return', 'leave'],
    gravity: ['gravity', 'partial', 'lunar'], oxygen: ['oxygen'], smoke: ['smoke'], fire: ['fire', 'flame'], flame: ['flame'],
    earth: ['hospitals', 'mine', 'earth'], spinoff: ['hospitals', 'mine'],
    mir: ['mir'], apollo: ['apollo'], firefighter: ['firefighter', 'firefighters'], firefighters: ['firefighter', 'firefighters'],
    miss: ['responds', 'sensitivity'], misses: ['responds', 'sensitivity'], sensitivity: ['sensitivity', 'responds'], placement: ['placement', 'carries']
  };
  var ENV_WORDS = { iss: ['iss', 'station'], orion: ['orion', 'capsule'], lander: ['lander', 'moon', 'lunar', 'habitat'], rover: ['rover', 'moon', 'lunar'], mars: ['mars', 'martian'], custom: ['custom', 'my', 'our'] };

  function tokens(q) {
    return String(q).toLowerCase().replace(/co₂/g, 'co2').replace(/[^a-z0-9]+/g, ' ').split(' ')
      .filter(function (t) { return t && !STOP[t]; });
  }

  function search(q, custom) {
    var toks = tokens(q), terms = {};
    toks.forEach(function (t) { terms[t] = 1; (SYN[t] || []).forEach(function (s) { terms[s] = 1; }); });
    var termList = Object.keys(terms);
    var envIds = [];
    Object.keys(ENV_WORDS).forEach(function (id) {
      if (ENV_WORDS[id].some(function (w) { return toks.indexOf(w) >= 0; })) envIds.push(id);
    });
    /* "the Moon" means both lunar cabins; a named cabin narrows it to that one */
    if (toks.indexOf('rover') >= 0 && toks.indexOf('lander') < 0 && toks.indexOf('habitat') < 0) envIds = envIds.filter(function (x) { return x !== 'lander'; });
    if ((toks.indexOf('lander') >= 0 || toks.indexOf('habitat') >= 0) && toks.indexOf('rover') < 0) envIds = envIds.filter(function (x) { return x !== 'rover'; });
    if (toks.indexOf('habitat') >= 0 && envIds.indexOf('mars') >= 0) envIds = envIds.filter(function (x) { return x !== 'lander'; });
    var wantStatus = null;
    if (toks.some(function (t) { return /^(break|breaks|broken|fail|fails|worst)$/.test(t); })) wantStatus = 'breaks';
    else if (toks.some(function (t) { return /^(unknown|unknowns|untested|open|gap|gaps|missing)$/.test(t); })) wantStatus = 'unknown';
    else if (toks.some(function (t) { return /^(hold|holds|survive|survives)$/.test(t); })) wantStatus = 'holds';
    else if (toks.some(function (t) { return /^(weaken|weakens|weaker|degrade|degrades)$/.test(t); })) wantStatus = 'weakens';

    function score(text) {
      var low = ' ' + text.toLowerCase().replace(/[^a-z0-9₂]+/g, ' ') + ' ', s = 0;
      termList.forEach(function (t) { if (low.indexOf(' ' + t + ' ') >= 0 || low.indexOf(' ' + t + 's ') >= 0) s += (toks.indexOf(t) >= 0 ? 2 : 1); });
      return s;
    }

    var rowScores = ROWS.map(function (r) { return { row: r, s: 2 * score(r.title + ' ' + r.short) + score(r.practice + ' ' + (r.earth || '')) }; });
    var topRow = rowScores.slice().sort(function (a, b) { return b.s - a.s; });
    var best = topRow.length ? topRow[0].s : 0;
    var rowsHit = topRow.filter(function (x) { return x.s >= 3 && x.s >= 0.6 * best; }).slice(0, 2).map(function (x) { return x.row; });

    var cells = [];
    var envList = envIds.length ? envIds : (wantStatus && !rowsHit.length ? ['rover'] : []);
    if (envList.length) {
      envList.forEach(function (id) {
        var env = envById(id, custom); if (!env) return;
        ROWS.forEach(function (r) {
          var v = evaluate(r.id, env);
          var rowOk = !rowsHit.length || rowsHit.indexOf(r) >= 0;
          var statusOk = !wantStatus || v.status === wantStatus;
          if ((wantStatus ? statusOk && (rowsHit.length ? rowOk : true) : rowOk)) cells.push({ env: env, row: r, v: v });
        });
      });
    } else if (rowsHit.length) {
      rowsHit.slice(0, 2).forEach(function (r) {
        ENVS.forEach(function (env) { var v = evaluate(r.id, env); if (!wantStatus || v.status === wantStatus) cells.push({ env: env, row: r, v: v }); });
      });
    }
    var hitIds = rowsHit.map(function (r) { return r.id; });
    var ev = EVIDENCE.map(function (e) {
      var s = score(e.finding + ' ' + e.cond + ' ' + (e.inv ? INV[e.inv].name + ' ' + INV[e.inv].full : ''));
      var inRow = hitIds.indexOf(e.row);
      if (inRow === 0) s += 4; else if (inRow > 0) s += 2;
      return { e: e, s: s, inRow: inRow >= 0 };
    }).filter(function (x) { return hitIds.length ? (x.inRow && x.s >= 2) : x.s >= 2; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 5).map(function (x) { return x.e; });
    if (!hitIds.length && wantStatus) ev = [];

    return { cells: cells.slice(0, 12), evidence: ev, rows: rowsHit, envIds: envList, wantStatus: wantStatus, empty: !cells.length && !ev.length };
  }

  /* ---------- export for reuse ---------- */
  function exportData(custom) {
    var envs = ENVS.concat(custom ? [custom] : []);
    return {
      title: 'Beyond LEO Fire Audit: evidence and verdicts',
      note: 'Evidence records were drafted with an AI model from the cited documents and checked against them. Verdicts are computed by fixed rules. Screening estimates only.',
      assumptions: { temperatureK: T, model: 'ideal gas, perfectly mixed cabin', co2ExtinguisherKg: PFE_CO2_KG, limits: LIMITS, saffireReference: SAF6 },
      environments: envs.map(function (e) { return { id: e.id, name: e.name, gravity_g: e.g, pressure_kPa: e.p, oxygen_pct: e.o2, volume_m3: e.v, planetaryDust: e.dust, beyondLowEarthOrbit: e.beyond, assumedFields: Object.keys(e.assumed || {}), notes: e.notes }; }),
      rules: ROWS.map(function (r) { return { id: r.id, phase: r.phase, rule: r.title, issPractice: r.practice, verdictRule: r.rule }; }),
      verdicts: [].concat.apply([], envs.map(function (e) {
        return ROWS.map(function (r) { var v = evaluate(r.id, e); return { environment: e.id, rule: r.id, status: v.status, basis: v.basisLabel, reason: v.reason, explanation: v.why }; });
      })),
      evidence: EVIDENCE.map(function (ev) {
        return { id: ev.id, rule: ev.row, direction: ev.dir, basis: ev.basis, investigation: ev.inv ? INV[ev.inv].name : null, conditions: ev.cond, finding: ev.finding, source: SOURCES[ev.src].cite, url: SOURCES[ev.src].url, locator: ev.loc };
      }),
      sources: Object.keys(SOURCES).map(function (k) { return { id: k, citation: SOURCES[k].cite, url: SOURCES[k].url }; })
    };
  }

  root.AUDIT = {
    R: R, T: T, LIMITS: LIMITS, CO2_IDLH_MMHG: CO2_IDLH_MMHG, SAF6: SAF6, PFE_CO2_KG: PFE_CO2_KG, FLEX: FLEX,
    ORION_PRESSURIZED_M3: ORION_PRESSURIZED_M3, ISS_HABITABLE_M3: ISS_HABITABLE_M3, BRE_STEADY_O2: BRE_STEADY_O2,
    SOURCES: SOURCES, INV: INV, ENVS: ENVS, CUSTOM_DEFAULT: CUSTOM_DEFAULT, EVIDENCE: EVIDENCE, ROWS: ROWS, STATUS: STATUS, BASIS: BASIS,
    moles: moles, co2Discharge: co2Discharge, floodKg: floodKg, fireScale: fireScale, maskO2: maskO2, o2After: o2After, cleanupMinutes: cleanupMinutes,
    gClass: gClass, isMarsLike: isMarsLike, fmt: fmt, sig: sig,
    rowById: rowById, envById: envById, evaluate: evaluate, summary: summary, summaryText: summaryText,
    rankInvestigations: rankInvestigations, rankGaps: rankGaps, search: search, exportData: exportData
  };
})(typeof window !== 'undefined' ? window : globalThis);

