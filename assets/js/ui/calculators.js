/* Calculators page: CO2 extinguisher discharge, oxygen from masks, CO after a fire. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var custom = B.loadCustom ? B.loadCustom() : JSON.parse(JSON.stringify(A.CUSTOM_DEFAULT));
  var state = { env: 'rover', k: { v: 13, p: 56.5, o2: 34, kg: A.PFE_CO2_KG, litres: 500, mult: 1, cfm: 20, eff: 100 } };

  function allEnvs() { return A.ENVS.concat([custom]); }

  /* A bar on a log scale with labelled limits. */
  function meter(x, min, max, ticks, cls) {
    function pos(v) { var p = (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)); return Math.max(0, Math.min(1, p)) * 100; }
    return '<div class="meter ' + cls + '" role="img" aria-label="' + esc(ticks.map(function (t) { return t.label; }).join('; ')) + '"><span class="meter__fill" style="width:' + pos(Math.max(x, min)).toFixed(1) + '%"></span>' +
      ticks.map(function (t, i) { return '<span class="meter__tick' + (i % 2 ? ' meter__tick--up' : '') + '" style="left:' + pos(t.v).toFixed(1) + '%"><span>' + esc(t.label) + '</span></span>'; }).join('') + '</div>';
  }
  function big(cls, value, unit, flagStatus, flagText) {
    return '<div class="calc__big ' + cls + '"><span class="num">' + value + '</span><small>' + unit + '</small></div>' +
      (flagStatus ? '<p class="calc__flag v-' + flagStatus + '">' + B.icon(flagStatus) + '<span>' + flagText + '</span></p>' : '');
  }

  function loadEnv(id) {
    var e = A.envById(id, custom);
    state.k.v = e.v; state.k.p = e.p; state.k.o2 = e.o2;
    $('kV').value = B.sliderFromV(e.v); $('kP').value = e.p; $('kO').value = e.o2;
    render();
  }

  function render() {
    var k = state.k, e = { v: k.v, p: k.p, o2: k.o2 };
    $('okV').textContent = B.vText(k.v); $('okP').textContent = A.fmt(k.p, 1) + ' kPa'; $('okO').textContent = A.fmt(k.o2, 1) + '%';
    $('okKg').textContent = A.fmt(k.kg, 1) + ' kg'; $('okL').textContent = A.fmt(k.litres, 0) + ' L';
    $('okMult').textContent = A.fmt(k.mult * A.SAF6.kJ / 1000, 2) + ' MJ'; $('okCfm').textContent = A.fmt(k.cfm, 0) + ' cfm'; $('okEff').textContent = A.fmt(k.eff, 0) + '%';

    var c = A.co2Discharge(e, k.kg), st1 = c.mmHg > A.CO2_IDLH_MMHG ? 'breaks' : (c.mmHg > A.LIMITS.co2_1h_mmHg ? 'weakens' : 'holds');
    $('c1').innerHTML = big('v-' + st1, A.sig(c.mmHg), 'mmHg of CO\u2082', st1, st1 === 'breaks' ? 'Above the 30 mmHg immediate-danger level' : (st1 === 'weakens' ? 'Above the 3 mmHg one-hour limit' : 'Below the 3 mmHg one-hour limit')) +
      '<p class="calc__read">' + A.sig(c.fractionPct) + '% of the cabin gas, ' + A.sig(c.timesLimit) + ' times the one-hour limit. Cabin pressure rises to ' + A.fmt(c.newPressureKPa, 1) + ' kPa.</p>' +
      meter(c.mmHg, 0.3, 400, [{ v: 3, label: '3 mmHg, 1 h limit' }, { v: A.CO2_IDLH_MMHG, label: '30 mmHg, immediate danger' }], 'v-' + st1) +
      '<p class="calc__read">To stop steady droplet burning by flooding, FLEX needed 20% CO\u2082 for heptane and 30% for methanol. In this cabin that is ' + A.sig(A.floodKg(e, A.FLEX.heptane)) + ' kg and ' + A.sig(A.floodKg(e, A.FLEX.methanol)) + ' kg of CO\u2082.</p>';

    var m = A.maskO2(e), after = A.o2After(e, k.litres);
    var crossing = after >= A.BRE_STEADY_O2 && k.o2 < A.BRE_STEADY_O2;
    $('c2').innerHTML = big('', A.fmt(after, 1), '% oxygen afterwards') +
      '<p class="calc__read">Starting from ' + A.fmt(k.o2, 1) + '%. In this cabin ' + A.sig(m.litresSTP) + ' standard litres of released oxygen add one percentage point.</p>' +
      '<p class="calc__read">' + (crossing ? 'This crosses 26.5%, the level where station burner tests held steady flames in still gas.' : (after >= A.BRE_STEADY_O2 ? 'The cabin is already at or above 26.5%, the level where station burner tests held steady flames in still gas.' : 'The cabin stays below 26.5%, the level where station burner tests held steady flames in still gas.')) + '</p>';

    var f = A.fireScale(e, k.mult), st3 = f.coPpm > A.LIMITS.co_1h_ppm ? 'breaks' : ((f.coPpm > A.LIMITS.co_24h_ppm || f.co2mmHg > A.LIMITS.co2_1h_mmHg) ? 'weakens' : 'holds');
    var t = A.cleanupMinutes(k.v, f.coPpm, A.LIMITS.co_24h_ppm, k.cfm, k.eff / 100);
    $('c3').innerHTML = big('v-' + st3, A.sig(f.coPpm), 'ppm of carbon monoxide', st3, st3 === 'breaks' ? 'Above the 425 ppm one-hour limit' : (st3 === 'weakens' ? 'Above the 100 ppm 24-hour limit or the CO\u2082 limit' : 'Within the CO and CO\u2082 limits')) +
      '<p class="calc__read">' + A.sig(f.coGrams) + ' g of CO in the cabin, with CO\u2082 up by ' + A.sig(f.co2mmHg) + ' mmHg' + (f.co2mmHg > A.LIMITS.co2_1h_mmHg ? ', above the 3 mmHg one-hour limit.' : ', below the 3 mmHg one-hour limit.') + '</p>' +
      meter(f.coPpm, 3, 3000, [{ v: A.LIMITS.co_24h_ppm, label: '100 ppm, 24 h limit' }, { v: A.LIMITS.co_1h_ppm, label: '425 ppm, 1 h limit' }], 'v-' + st3) +
      '<p class="calc__read">' + (t > 0 ? 'A scrubber at this flow and efficiency needs about ' + (t >= 120 ? A.fmt(t / 60, 1) + ' hours' : A.fmt(t, 0) + ' minutes') + ' to bring CO back under 100 ppm.' : 'CO stays under the 100 ppm 24-hour limit, so no scrubbing time is needed.') + '</p>';
    [].forEach.call(document.querySelectorAll('.calc__out'), function (n) { n.removeAttribute('aria-busy'); });
  }

  function bind(id, key, conv) {
    $(id).addEventListener('input', function () { state.k[key] = conv ? conv(parseFloat(this.value)) : parseFloat(this.value); render(); });
  }

  var sel = $('calcEnv');
  sel.innerHTML = allEnvs().map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + '</option>'; }).join('');
  var want = B.params().get('env');
  if (want && allEnvs().some(function (e) { return e.id === want; })) state.env = want;
  sel.value = state.env;
  sel.addEventListener('change', function () { state.env = sel.value; B.setParams({ env: state.env }); loadEnv(state.env); });
  bind('kV', 'v', B.vFromSlider); bind('kP', 'p'); bind('kO', 'o2');
  bind('kKg', 'kg'); bind('kL', 'litres'); bind('kMult', 'mult'); bind('kCfm', 'cfm'); bind('kEff', 'eff');
  $('kKg').value = state.k.kg; $('kL').value = state.k.litres; $('kMult').value = state.k.mult; $('kCfm').value = state.k.cfm; $('kEff').value = state.k.eff;
  loadEnv(state.env);
});
