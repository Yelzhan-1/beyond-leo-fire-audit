/* Method page: lightweight SVG charts from committed NASA PSI-69 subsets (data/*.json). */
(function () {
  'use strict';
  var host = document.getElementById('flexCharts');
  if (!host) return;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function svgScales(w, h, pad, xMin, xMax, yMin, yMax) {
    var iw = w - pad.l - pad.r;
    var ih = h - pad.t - pad.b;
    function x(v) { return pad.l + ((v - xMin) / (xMax - xMin || 1)) * iw; }
    function y(v) { return pad.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih; }
    return { x: x, y: y, iw: iw, ih: ih };
  }

  function axisSvg(w, h, pad, xMin, xMax, yMin, yMax, xLab, yLab, xFmt, yFmt) {
    var s = svgScales(w, h, pad, xMin, xMax, yMin, yMax);
    var ticks = 5;
    var g = '<g class="chart-axis" fill="none" stroke="currentColor" stroke-opacity="0.35">';
    g += '<line x1="' + pad.l + '" y1="' + (h - pad.b) + '" x2="' + (w - pad.r) + '" y2="' + (h - pad.b) + '"/>';
    g += '<line x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + (h - pad.b) + '"/>';
  for (var i = 0; i <= ticks; i++) {
      var xv = xMin + (xMax - xMin) * i / ticks;
      var yv = yMin + (yMax - yMin) * i / ticks;
      var X = s.x(xv);
      var Y = s.y(yv);
      g += '<line x1="' + X + '" y1="' + (h - pad.b) + '" x2="' + X + '" y2="' + (h - pad.b + 4) + '"/>';
      g += '<text class="chart-tick" x="' + X + '" y="' + (h - pad.b + 16) + '" text-anchor="middle">' + esc(xFmt(xv)) + '</text>';
      g += '<line x1="' + (pad.l - 4) + '" y1="' + Y + '" x2="' + pad.l + '" y2="' + Y + '"/>';
      g += '<text class="chart-tick" x="' + (pad.l - 8) + '" y="' + (Y + 4) + '" text-anchor="end">' + esc(yFmt(yv)) + '</text>';
    }
    g += '<text class="chart-lab" x="' + (pad.l + s.iw / 2) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(xLab) + '</text>';
    g += '<text class="chart-lab" transform="rotate(-90 ' + (14) + ',' + (pad.t + s.ih / 2) + ')" x="14" y="' + (pad.t + s.ih / 2) + '" text-anchor="middle">' + esc(yLab) + '</text>';
    g += '</g>';
    return { svg: g, scale: s };
  }

  function renderD2(data) {
    var pts = data.points || [];
    if (!pts.length) return '<p class="state state--error">Droplet time series could not be loaded.</p>';
    var tMax = pts[pts.length - 1].t_s;
    var d2Max = Math.max.apply(null, pts.map(function (p) { return p.d2_mm2; }));
    var w = 520; var h = 280;
    var pad = { l: 52, r: 16, t: 16, b: 44 };
    var ax = axisSvg(w, h, pad, 0, tMax, 0, d2Max * 1.05, 'Time since igniter (s)', 'Droplet diameter squared (mm\u00b2)',
      function (v) { return v.toFixed(1); }, function (v) { return v.toFixed(2); });
    var d = 'M' + ax.scale.x(pts[0].t_s) + ',' + ax.scale.y(pts[0].d2_mm2);
    pts.forEach(function (p, i) { if (i) d += ' L' + ax.scale.x(p.t_s) + ',' + ax.scale.y(p.d2_mm2); });
    var te = data.test || {};
    return '<figure class="chart-card"><svg class="chart-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Diameter squared versus time for FLEX test ' + esc(te.testId || '20CAL10') + '">' +
      ax.svg + '<path d="' + d + '" fill="none" stroke="var(--brand)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>' +
      '</svg><figcaption><b>d\u00b2 law during microgravity burning.</b> NASA PSI droplet track for <a class="ext" href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-69" rel="noopener" target="_blank">FLEX</a> test FLEX-002 (' +
      esc(te.testId || '20CAL10') + ', ' + esc(te.fuel || 'methanol') + ', ' + esc(String(te.o2 != null ? te.o2 * 100 : 21)) + '% O\u2082, ~1 atm). Summary <i>K</i> = ' +
      esc(String(te.K_mm2_per_s != null ? te.K_mm2_per_s : 0.6)) + ' mm\u00b2/s. Source: PSI-69, <a class="ext" href="https://doi.org/10.60555/mbq8-0451" rel="noopener" target="_blank">DOI 10.60555/mbq8-0451</a>.</figcaption></figure>';
  }

  function renderCo2(data) {
    var rows = (data.records || []).filter(function (r) { return r.p_mmHg >= 700; });
    if (!rows.length) return '';
    var fuels = ['Methanol', 'Heptane'];
    var cols = { Methanol: 'var(--brand)', Heptane: 'var(--link)' };
    var xMax = Math.max.apply(null, rows.map(function (r) { return r.co2; }));
    var yMax = Math.max.apply(null, rows.map(function (r) { return r.K_mm2_per_s; }));
    var w = 520; var h = 280;
    var pad = { l: 48, r: 16, t: 16, b: 44 };
    var ax = axisSvg(w, h, pad, 0, Math.max(0.75, xMax * 1.05), 0, yMax * 1.08, 'Ambient CO\u2082 mole fraction', 'Burning-rate constant K (mm\u00b2/s)',
      function (v) { return (v * 100).toFixed(0) + '%'; }, function (v) { return v.toFixed(2); });
    var dots = '';
    rows.forEach(function (r) {
      dots += '<circle cx="' + ax.scale.x(r.co2) + '" cy="' + ax.scale.y(r.K_mm2_per_s) + '" r="5" fill="' + cols[r.fuel] + '" opacity="0.9"><title>' +
        esc(r.fuel + ' ' + r.testId + ', CO\u2082=' + (r.co2 * 100).toFixed(0) + '%, K=' + r.K_mm2_per_s) + '</title></circle>';
    });
    var leg = fuels.map(function (f) {
      return '<span class="chart-leg"><i style="background:' + cols[f] + '"></i>' + f + '</span>';
    }).join('');
    return '<figure class="chart-card"><svg class="chart-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Burning rate constant versus carbon dioxide mole fraction from FLEX PSI data at about one atmosphere">' +
      ax.svg + dots +
      '<line x1="' + ax.scale.x(0.2) + '" y1="' + pad.t + '" x2="' + ax.scale.x(0.2) + '" y2="' + (h - pad.b) + '" stroke="var(--text-3)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>' +
      '<line x1="' + ax.scale.x(0.3) + '" y1="' + pad.t + '" x2="' + ax.scale.x(0.3) + '" y2="' + (h - pad.b) + '" stroke="var(--text-3)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>' +
      '</svg><div class="chart-leg-wrap" aria-hidden="true">' + leg + '<span class="small muted">Dashed: audit CO\u2082 limits cited for heptane (20%) and methanol (30%) from Dietrich et al.</span></div>' +
      '<figcaption><b>Burning rate vs CO\u2082 diluent (21% O\u2082, &asymp;1 atm).</b> Points from <a href="data/flex-co2-burn-rate.json">flex-co2-burn-rate.json</a>, derived from PSI experimental table. Supports the <a href="audit?env=iss&amp;row=co2#evidence-panel">CO\u2082 extinguisher rule</a> evidence record (FLEX), not the cabin-scale calculator.</figcaption></figure>';
  }

  function showError(msg) {
    host.innerHTML = '<div class="state state--error" role="alert"><h3>NASA FLEX charts unavailable</h3><p>' + esc(msg) + '</p></div>';
  }

  host.setAttribute('aria-busy', 'true');
  Promise.all([
    fetch('data/flex-002-d2-series.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('flex-002-d2-series.json HTTP ' + r.status); return r.json(); }),
    fetch('data/flex-co2-burn-rate.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('flex-co2-burn-rate.json HTTP ' + r.status); return r.json(); }),
  ]).then(function (all) {
    host.removeAttribute('aria-busy');
    host.innerHTML = '<div class="chart-grid">' + renderD2(all[0]) + renderCo2(all[1]) + '</div>';
  }).catch(function (e) {
    host.removeAttribute('aria-busy');
    showError(e && e.message ? e.message : 'Load failed');
  });
})();