/* Overview page: live headline numbers, mini verdict map and the schematic flames. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var presets = A.ENVS;

  /* ---------- headline numbers, all derived from the engine ---------- */
  var tally = { breaks: 0, weakens: 0, unknown: 0, holds: 0 };
  presets.forEach(function (e) { var c = A.summary(e).counts; Object.keys(tally).forEach(function (k) { tally[k] += c[k]; }); });
  function vfact(k, label) { return '<div class="stat v-' + k + '"><b>' + B.icon(k) + tally[k] + '</b><span>' + label + '</span></div>'; }
  $('stats').removeAttribute('aria-busy');
  $('stats').innerHTML = '<div class="stats__row stats__row--hero">' + vfact('breaks', 'break') + vfact('weakens', 'weaken') + vfact('unknown', 'unknown') + vfact('holds', 'hold') + '</div>';

  /* ---------- a figure computed live, so the page cannot drift from the engine ---------- */
  var rover = A.envById('rover');
  if (rover) {
    var c = A.co2Discharge(rover, A.PFE_CO2_KG);
    $('homeCo2').textContent = 'one ' + A.fmt(A.PFE_CO2_KG, 1) + ' kg CO\u2082 extinguisher emptied into the ' + A.fmt(rover.v, 0) + ' m\u00b3 rover gives about ' + A.sig(c.mmHg) + ' mmHg of CO\u2082, against a one-hour limit of ' + A.LIMITS.co2_1h_mmHg + ' mmHg.';
  }

  /* ---------- legend ---------- */
  var items = [['holds', 'Evidence supports the rule.'], ['weakens', 'Works in part or with an exception.'], ['breaks', 'Evidence contradicts the rule.'], ['unknown', 'Not measured in matching conditions.']];
  $('legend').innerHTML = items.map(function (x) { return '<li class="v-' + x[0] + '">' + B.verdict(x[0]) + '<span>' + x[1] + '</span></li>'; }).join('');

  /* ---------- mini verdict map ---------- */
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

  initFlames();

  /* Four schematic flames on a canvas: a sphere at 0 g, stretching as gravity returns. */
  function initFlames() {
    var cv = $('flameCanvas'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), G = [0, 0.16, 0.38, 1], W = 0, H = 0, raf = 0, visible = true;
    var reduce = B.reducedMotion();
    function resize() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function teardrop(cx, yb, w, h, sway) {
      ctx.beginPath(); ctx.moveTo(cx, yb);
      ctx.bezierCurveTo(cx - w, yb, cx - w * 0.9, yb - h * 0.48, cx + sway, yb - h);
      ctx.bezierCurveTo(cx + w * 0.9, yb - h * 0.48, cx + w, yb, cx, yb);
      ctx.closePath();
    }
    function rgba(r, g, b, a) { return 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + a + ')'; }
    function one(cx, yb, g, s, t, k) {
      var r = 30 * s;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (g < 0.01) {
        var cy = yb - r - 6 * s, pulse = reduce ? 0 : Math.sin(t * 1.3) * 0.7 * s;
        var h0 = Math.min(r * 2.1, cx, W - cx, cy) - 1;
        var halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, h0);
        halo.addColorStop(0, 'rgba(60,120,255,0.22)'); halo.addColorStop(1, 'rgba(60,120,255,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, h0, 0, Math.PI * 2); ctx.fill();
        var shell = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + pulse);
        shell.addColorStop(0, 'rgba(30,70,200,0.10)'); shell.addColorStop(0.62, 'rgba(50,110,255,0.30)');
        shell.addColorStop(0.88, 'rgba(120,175,255,0.85)'); shell.addColorStop(1, 'rgba(120,175,255,0)');
        ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#232B3B';
        ctx.beginPath(); ctx.arc(cx, cy, 4 * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); return;
      }
      var flick = reduce ? 1 : 1 + 0.035 * g * Math.sin(t * 8.3 + k * 2.1);
      var h = 2 * r * (1 + 2.15 * Math.sqrt(g)) * flick, w = r * (1.02 - 0.18 * g);
      var sway = reduce ? 0 : (Math.sin(t * 2.6 + k * 1.7) * 5 + Math.sin(t * 6.1 + k) * 2.2) * g * s;
      var warm = Math.pow(g, 0.55), cyh = yb - h * 0.45;
      var hr = Math.min(h * 0.6, cx, W - cx) - 1;
      var halo2 = ctx.createRadialGradient(cx, cyh, r * 0.2, cx, cyh, hr);
      halo2.addColorStop(0, rgba(60 + 195 * warm, 120 + 40 * warm, 255 - 195 * warm, 0.16)); halo2.addColorStop(1, 'rgba(60,120,255,0)');
      ctx.fillStyle = halo2; ctx.beginPath(); ctx.arc(cx, cyh, hr, 0, Math.PI * 2); ctx.fill();
      var body = ctx.createLinearGradient(0, yb, 0, yb - h);
      body.addColorStop(0, 'rgba(70,130,255,0.9)');
      body.addColorStop(0.22, rgba(90 + 165 * warm, 140 + 30 * warm, 255 - 185 * warm, 0.85));
      body.addColorStop(0.7, rgba(110 + 145 * warm, 150 + 50 * warm, 255 - 165 * warm, 0.55));
      body.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = body; teardrop(cx, yb, w, h, sway); ctx.fill();
      var core = ctx.createLinearGradient(0, yb, 0, yb - h * 0.62);
      core.addColorStop(0, 'rgba(120,170,255,0.15)');
      core.addColorStop(0.35, rgba(255, 225 + 20 * warm, 170 + 40 * warm, (0.25 + 0.6 * warm).toFixed(2)));
      core.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = core; teardrop(cx, yb - 3 * s, w * 0.52, h * 0.62, sway * 0.6); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#232B3B';
      ctx.fillRect(cx - 1.5 * s, yb - 5 * s, 3 * s, 13 * s);
      ctx.restore();
    }
    function draw(now) {
      var t = (now || 0) / 1000, colW = W / 4, s = Math.min(colW / 140, (H - 20) / 232);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < 4; i++) one((i + 0.5) * colW, H - 16, G[i], s, t, i);
      raf = (!reduce && visible) ? window.requestAnimationFrame(draw) : 0;
    }
    resize(); draw(0);
    window.addEventListener('resize', B.debounce(function () { resize(); if (!raf) draw(0); }, 100));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !raf && !reduce) raf = window.requestAnimationFrame(draw);
      }).observe(cv);
    }
  }
});
