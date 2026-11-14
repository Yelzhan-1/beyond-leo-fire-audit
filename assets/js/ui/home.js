/* Index (tool workspace): destination chips, schematic flame and live verdict list. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;

  var DEST = [
    { id: 'iss', label: 'ISS', defaultEnv: 'iss' },
    { id: 'moon', label: 'Moon', defaultEnv: 'lander' },
    { id: 'mars', label: 'Mars', defaultEnv: 'mars' },
    { id: 'custom', label: 'Custom', defaultEnv: 'custom' }
  ];

  var state = { dest: 'moon', env: 'lander' };

  function envForId(id) {
    if (id === 'custom') return B.loadCustom();
    return A.envById(id);
  }

  function currentEnv() { return envForId(state.env); }

  function destForEnv(id) {
    if (id === 'iss' || id === 'orion') return 'iss';
    if (id === 'mars') return 'mars';
    if (id === 'custom') return 'custom';
    return 'moon';
  }

  function validEnv(id) {
    return id === 'custom' || A.ENVS.some(function (e) { return e.id === id; });
  }

  (function readUrl() {
    var e = B.params().get('env');
    if (e && validEnv(e)) {
      state.env = e;
      state.dest = destForEnv(e);
    }
  })();

  function renderDestinations() {
    $('destChips').innerHTML = DEST.map(function (d) {
      return '<button type="button" class="chip chip--dest" data-dest="' + d.id + '" aria-pressed="' + (state.dest === d.id) + '">' + esc(d.label) + '</button>';
    }).join('');
  }

  function renderPresets() {
    var presets = A.ENVS.concat([A.CUSTOM_DEFAULT]);
    $('presetChips').innerHTML = presets.map(function (e) {
      return '<button type="button" class="chip" data-env="' + e.id + '" aria-pressed="' + (state.env === e.id) + '">' + esc(e.name) + '</button>';
    }).join('');
  }

  function sliderRow(label, valText, pct) {
    return '<label class="tool-slider"><span class="tool-slider__label">' + esc(label) + '</span>' +
      '<span class="tool-slider__val mono num">' + esc(valText) + '</span>' +
      '<input type="range" disabled value="' + pct + '" min="0" max="100" step="1" aria-readonly="true" aria-label="' + esc(label) + ' ' + esc(valText) + '">' +
      '</label>';
  }

  function pct(val, min, max) {
    if (!(max > min)) return 0;
    return Math.max(0, Math.min(100, Math.round((val - min) / (max - min) * 100)));
  }

  function renderSliders() {
    var e = currentEnv();
    $('toolSliders').innerHTML =
      sliderRow('Gravity', B.gText(e.g), pct(e.g, 0, 1)) +
      sliderRow('Pressure', A.fmt(e.p, 1) + ' kPa', pct(e.p, 50, 101.3)) +
      sliderRow('Oxygen', B.o2Text(e.o2), pct(e.o2, 15, 34));
  }

  function renderVerdicts() {
    var e = currentEnv(), sum = A.summary(e);
    $('verdictSum').removeAttribute('aria-busy');
    $('verdictSum').innerHTML = '<span class="tool-verdicts__env">' + esc(e.name) + '</span><div class="count-pills" role="status">' + B.summaryPills(sum.counts) + '</div>';
    var rows = '';
    A.ROWS.forEach(function (r, idx) {
      var v = A.evaluate(r.id, e);
      rows += '<li class="verdict-list__item v-' + v.status + '">' +
        '<span class="verdict-list__rule" title="' + esc(r.short) + '"><span class="mono faint">R' + (idx < 9 ? '0' : '') + (idx + 1) + '</span> ' + esc(r.short) + '</span>' +
        '<a class="verdict-list__link" href="audit?env=' + e.id + '&amp;row=' + r.id + '#evidence-panel">' + B.verdict(v.status, true) + '</a></li>';
    });
    $('toolVerdicts').removeAttribute('aria-busy');
    $('toolVerdicts').innerHTML = rows;
  }

  function renderStage() {
    var e = currentEnv();
    $('stageViz').setAttribute('data-env', state.dest);
    var g = B.gText(e.g);
    $('stageGravity').textContent = g;
    var cap = $('stageCaption');
    cap.textContent = 'Schematic flame at ' + g;
    cap.hidden = false;
  }

  function paint() {
    renderDestinations();
    renderPresets();
    renderSliders();
    renderVerdicts();
    renderStage();
    if (window.__blfaFlameResize) window.__blfaFlameResize();
  }

  function pickDest(destId) {
    var d = DEST.filter(function (x) { return x.id === destId; })[0];
    if (!d) return;
    state.dest = d.id;
    state.env = d.defaultEnv;
    paint();
  }

  function pickEnv(envId) {
    if (!validEnv(envId)) return;
    state.env = envId;
    state.dest = destForEnv(envId);
    paint();
  }

  $('destChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-dest]');
    if (btn) pickDest(btn.getAttribute('data-dest'));
  });
  $('presetChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-env]');
    if (btn) pickEnv(btn.getAttribute('data-env'));
  });

  (function syncAdjustPanel() {
    var d = $('toolAdjust');
    if (!d || !window.matchMedia) return;
    var mq = window.matchMedia('(min-width: 1024px)');
    var apply = function () {
      if (mq.matches) d.setAttribute('open', '');
      else d.removeAttribute('open');
    };
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  })();

  paint();
  initFlame();

  function initFlame() {
    var cv = $('flameCanvas'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, raf = 0, visible = true;
    var reduce = B.reducedMotion();

    function gNow() { return currentEnv().g; }

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

    function one(cx, yb, g, s, t) {
      var r = 34 * s;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (g < 0.01) {
        var cy = yb - r - 8 * s, pulse = reduce ? 0 : Math.sin(t * 1.3) * 0.7 * s;
        var shell = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + pulse);
        shell.addColorStop(0, 'rgba(50,110,255,0.35)'); shell.addColorStop(1, 'rgba(50,110,255,0)');
        ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'var(--surface-3)';
        ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); return;
      }
      var flick = reduce ? 1 : 1 + 0.04 * g * Math.sin(t * 8);
      var h = 2 * r * (1 + 2.1 * Math.sqrt(g)) * flick, w = r * (1.02 - 0.18 * g);
      var sway = reduce ? 0 : Math.sin(t * 2.5) * 6 * g * s;
      var warm = Math.pow(g, 0.55);
      var body = ctx.createLinearGradient(0, yb, 0, yb - h);
      body.addColorStop(0, 'rgba(70,130,255,0.9)');
      body.addColorStop(0.5, 'rgba(255,' + Math.round(140 + 80 * warm) + ',80,0.75)');
      body.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = body; teardrop(cx, yb, w, h, sway); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }

    function draw(now) {
      var g = gNow(), t = (now || 0) / 1000, s = Math.min(W / 180, (H - 24) / 220);
      ctx.clearRect(0, 0, W, H);
      one(W / 2, H - 20, g, s, t);
      raf = (!reduce && visible) ? window.requestAnimationFrame(draw) : 0;
    }

    window.__blfaFlameResize = function () { resize(); draw(0); };
    resize(); draw(0);
    window.addEventListener('resize', B.debounce(function () { resize(); if (!raf) draw(0); }, 100));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !raf && !reduce) raf = window.requestAnimationFrame(draw);
      }).observe(cv);
    }
    document.addEventListener('blfa:theme', function () { draw(0); });
  }
});