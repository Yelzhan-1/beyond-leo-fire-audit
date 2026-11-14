/* Method and data page: rules table, calculations, NASA data lists and the evidence.json check. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var ids = Object.keys(A.SOURCES);
  var presets = A.ENVS;

  /* ---------- context: heat map and CO2 example ---------- */
  var rover = A.envById('rover');
  if (rover && $('methodCo2')) {
    var co2 = A.co2Discharge(rover, A.PFE_CO2_KG);
    $('methodCo2').textContent = 'One ' + A.fmt(A.PFE_CO2_KG, 1) + ' kg CO\u2082 extinguisher emptied into the ' + A.fmt(rover.v, 0) + ' m\u00b3 rover gives about ' + A.sig(co2.mmHg) + ' mmHg of CO\u2082, against a one-hour limit of ' + A.LIMITS.co2_1h_mmHg + ' mmHg.';
  }
  if ($('legend')) {
    var tally = { breaks: 0, weakens: 0, unknown: 0, holds: 0 };
    presets.forEach(function (e) {
      var c = A.summary(e).counts;
      Object.keys(tally).forEach(function (k) { tally[k] += c[k]; });
    });
    $('legend').innerHTML = B.legendPills(tally);
  }
  if ($('heat')) {
    var h = '<table class="table heat"><caption class="visually-hidden">Verdict of each rule in each preset cabin. Each verdict links to its evidence.</caption><thead><tr><th scope="col">Rule</th>';
    presets.forEach(function (e) { h += '<th scope="col">' + esc(e.name) + '</th>'; });
    h += '</tr></thead><tbody>';
    A.ROWS.forEach(function (r) {
      h += '<tr><th scope="row">' + esc(r.short) + '</th>';
      presets.forEach(function (e) {
        var v = A.evaluate(r.id, e);
        h += '<td class="heat__td v-' + v.status + '"><a class="heat__cell" href="audit?env=' + e.id + '&amp;row=' + r.id + '#evidence-panel" title="' + esc(v.reason) + '">' + B.icon(v.status) + '<span>' + A.STATUS[v.status].label + '</span><span class="visually-hidden">: ' + esc(e.name + ', ' + r.short + '. ' + v.reason) + '</span></a></td>';
      });
      h += '</tr>';
    });
    $('heat').removeAttribute('aria-busy');
    $('heat').innerHTML = h + '</tbody></table>';
  }

  /* ---------- rules ---------- */
  $('rulesTable').removeAttribute('aria-busy');
  $('rulesTable').innerHTML = '<table class="table"><thead><tr><th scope="col">Rule of thumb</th><th scope="col">How the verdict is decided</th></tr></thead><tbody>' +
    A.ROWS.map(function (r, i) {
      return '<tr><th scope="row"><span class="kicker">' + esc(r.phase) + ' / Rule ' + (i < 9 ? '0' : '') + (i + 1) + '</span><br>' + esc(r.title) + '</th><td>' + esc(r.rule) + (r.ruleSrc ? ' <span class="faint">Thresholds from: ' + B.srcLinks(r.ruleSrc) + '.</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';

  /* ---------- SI status: honest about whether it is switched on ---------- */
  if (window.BLFA_SI) {
    var paintSI = function (st) { $('siStatus').textContent = st.available ? 'It is switched on in this deployment.' : 'It is not switched on in this deployment.'; };
    paintSI(window.BLFA_SI.status());
    window.BLFA_SI.ready().then(paintSI);
  } else { $('siStatus').textContent = 'It is not available on this page.'; }

  /* ---------- calculations, with the live constants from the engine ---------- */
  var L = A.LIMITS, S = A.SAF6;
  $('calcCards').removeAttribute('aria-busy');
  $('calcCards').innerHTML =
    '<article class="card"><h3>CO\u2082 extinguisher</h3><p>Partial pressure of CO\u2082 after one ' + A.fmt(A.PFE_CO2_KG, 1) + ' kg discharge, mixed through the cabin.</p>' +
    '<p>Breaks above ' + A.fmt(A.CO2_IDLH_MMHG, 1) + ' mmHg, the NIOSH immediate-danger level (' + A.fmt(L.co2_idlh_ppm, 0) + ' ppm) at sea-level pressure. Otherwise weakens. The one-hour limit is ' + L.co2_1h_mmHg + ' mmHg.</p><p class="srcs">Sources: ' + B.srcLinks(['guibaud', 'saf6', 'niosh']) + '</p></article>' +
    '<article class="card"><h3>Oxygen masks</h3><p>Cabin volume compared with two measured cases.</p>' +
    '<p>Breaks at or below ' + A.ORION_PRESSURIZED_M3 + ' m\u00b3, the pressurized volume of Orion, where NASA ruled the ISS masks out. Holds at ' + A.ISS_HABITABLE_M3 + ' m\u00b3 and above, the ISS habitable volume. Unknown in between: no published threshold.</p><p class="srcs">Sources: ' + B.srcLinks(['orion', 'issfacts', 'ruff21']) + '</p></article>' +
    '<article class="card"><h3>Air after the fire</h3><p>The largest Saffire VI gas release (' + S.co_ppm + ' ppm CO and ' + S.co2_mmHg + ' mmHg CO\u2082 in ' + S.v + ' m\u00b3 at ' + S.p + ' kPa, ' + A.fmt(S.kJ, 0) + ' kJ), rescaled to the cabin volume and pressure.</p>' +
    '<p>Breaks above ' + L.co_1h_ppm + ' ppm CO (one hour). Weakens above ' + L.co_24h_ppm + ' ppm (24 hours) or ' + L.co2_1h_mmHg + ' mmHg CO\u2082. Otherwise holds.</p><p class="srcs">Source: ' + B.srcLinks(['saf6']) + '</p></article>';

  /* ---------- NASA data and challenge resources ---------- */
  var psi = Object.keys(A.INV).filter(function (k) { return A.INV[k].psi; }).map(function (k) { var v = A.INV[k]; return esc(v.name) + ' (' + B.invLinks(v) + ')'; });
  $('psiList').removeAttribute('aria-busy');
  $('psiList').innerHTML = 'Investigations in the NASA Physical Sciences Informatics (PSI) system used here: ' + psi.join(', ') + '.';
  $('official').removeAttribute('aria-busy');
  $('official').innerHTML = ids.filter(function (id) { return A.SOURCES[id].official; }).map(function (id) {
    var o = A.SOURCES[id]; return '<li>' + B.ext(o.url, o.short) + '. ' + esc(o.use) + '</li>';
  }).join('');

  /* ---------- evidence.json: loading, error and consistency states ---------- */
  var card = $('dataCard');
  function dataCard(inner) { card.removeAttribute('aria-busy'); card.innerHTML = inner; }
  function actions() {
    return '<div class="cluster"><a class="btn btn--primary btn--sm" href="evidence.json" download>Download evidence.json</a>' +
      '<button type="button" class="btn btn--ghost btn--sm" id="copyJson">Copy as JSON, with your custom cabin</button><span class="small muted" id="copyMsg" role="status"></span></div>';
  }
  function bindCopy() {
    var btn = $('copyJson'); if (!btn) return;
    btn.addEventListener('click', function () {
      var text = JSON.stringify(A.exportData(B.loadCustom()), null, 2), ta = $('jsonOut'), msg = $('copyMsg');
      B.copyText(text).then(function () { msg.textContent = 'Copied.'; setTimeout(function () { msg.textContent = ''; }, 2000); }, function () {
        ta.hidden = false; ta.value = text; ta.focus(); ta.select(); msg.textContent = 'Select all and copy from the box below.';
      });
    });
  }
  function load() {
    card.setAttribute('aria-busy', 'true');
    card.innerHTML = '<div class="skeleton" role="status"><span class="visually-hidden">Loading evidence.json</span><i></i><i></i><i></i></div>';
    fetch('evidence.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (d) {
      if (!d || !Array.isArray(d.verdicts) || !Array.isArray(d.evidence)) throw new Error('unexpected shape');
      var ok = d.rules.length === A.ROWS.length && d.evidence.length === A.EVIDENCE.length && d.sources.length === ids.length && d.environments.length === A.ENVS.length;
      dataCard('<h3>evidence.json loaded</h3><p class="muted small">' + d.rules.length + ' rules, ' + d.environments.length + ' cabins, ' + d.verdicts.length + ' verdicts, ' + d.evidence.length + ' evidence records, ' + d.sources.length + ' sources.</p>' +
        '<p class="verdict-line ' + (ok ? 'v-holds' : 'v-weakens') + '">' + B.icon(ok ? 'holds' : 'weakens') + '<span>' + (ok ? 'The counts match the engine running on this page.' : 'The counts differ from the engine running on this page. Reload to refresh.') + '</span></p>' + actions());
      bindCopy();
    }).catch(function (e) {
      dataCard('<div class="state state--error" role="alert"><h3>Could not load evidence.json</h3><p>' + esc(e && e.message ? e.message : 'Unknown error') + '. The file is also linked directly below.</p><div class="cluster"><button type="button" class="btn btn--sm" id="retryData">Try again</button><a class="btn btn--ghost btn--sm" href="evidence.json">Open evidence.json</a></div></div>' + actions());
      $('retryData').addEventListener('click', load);
      bindCopy();
    });
  }
  load();
});
