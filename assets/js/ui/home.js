/* Index (tool workspace): destination chips, live sliders, flame, verdicts, evidence drawer. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var S = window.BLFA_SCENARIO;
  var G = window.BLFA_FLAME_GEOM;

  var DEST = [
    { id: 'iss', label: 'ISS', defaultEnv: 'iss' },
    { id: 'moon', label: 'Moon', defaultEnv: 'lander' },
    { id: 'mars', label: 'Mars', defaultEnv: 'mars' },
    { id: 'custom', label: 'Custom', defaultEnv: 'custom' }
  ];

  var state = {
    dest: 'moon',
    envId: 'lander',
    live: null,
    row: null
  };
  var prevStatuses = {};
  var paintRaf = 0;
  var drawerCtl = null;

  function cloneEnv(e) {
    var c = JSON.parse(JSON.stringify(e));
    c.id = e.id;
    if (e.custom) c.custom = true;
    return c;
  }

  function loadEnvById(id) {
    if (id === 'custom') return cloneEnv(B.loadCustom());
    var e = A.envById(id);
    return e ? cloneEnv(e) : cloneEnv(A.envById('lander'));
  }

  function currentEnv() { return state.live; }

  function validEnv(id) {
    return id === 'custom' || A.ENVS.some(function (e) { return e.id === id; });
  }

  function syncDestFromEnv() {
    state.dest = S.destFromEnvId(state.envId);
    if (state.envId === 'orion') state.dest = 'iss';
  }

  function pickLiveFromPreset(envId) {
    state.envId = envId;
    state.live = loadEnvById(envId);
    if (envId === 'custom') B.saveCustom(state.live);
    syncDestFromEnv();
    pushUrl();
    schedulePaint();
  }

  (function readUrl() {
    var parsed = S.parseScenarioQuery(window.location.search);
    if (parsed.envId && validEnv(parsed.envId)) {
      state.envId = parsed.envId;
      state.live = loadEnvById(parsed.envId);
      state.live = S.applyScenarioToEnv(state.live, parsed);
    } else if (parsed.dest && S.envIdFromDest(parsed.dest)) {
      state.envId = S.envIdFromDest(parsed.dest);
      state.live = loadEnvById(state.envId);
      state.live = S.applyScenarioToEnv(state.live, parsed);
    }
    state.dest = parsed.dest || S.destFromEnvId(state.envId);
    state.row = parsed.row && A.rowById(parsed.row) ? parsed.row : null;
    state.envId = S.matchPresetId(state.live, A.ENVS, A.CUSTOM_DEFAULT);
    if (state.envId === 'custom') {
      var c = B.loadCustom();
      ['g', 'p', 'o2', 'v', 'dust', 'beyond'].forEach(function (k) { c[k] = state.live[k]; });
      B.saveCustom(c);
      state.live = cloneEnv(c);
    }
    syncDestFromEnv();
  })();

  if (!state.live) {
    state.envId = 'lander';
    state.live = loadEnvById('lander');
    state.dest = 'moon';
  }

  function pushUrl() {
    var e = currentEnv();
    var preset = state.envId !== 'custom' ? A.envById(state.envId) : null;
    var q = S.serializeScenario({
      dest: state.dest,
      envId: state.envId,
      g: e.g,
      p: e.p,
      o2: e.o2
    }, preset);
    try {
      window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
    } catch (err) { /* */ }
  }

  function sliderPct(val, min, max) {
    if (!(max > min)) return 0;
    return Math.max(0, Math.min(100, Math.round((val - min) / (max - min) * 100)));
  }

  function ariaValText(key, e) {
    if (key === 'g') return B.gText(e.g);
    if (key === 'p') return A.fmt(e.p, 1) + ' kilopascals';
    return B.o2Text(e.o2);
  }

  function tickMarksHtml() {
    return '<div class="tool-slider__ticks" aria-hidden="true">' + S.GRAVITY_TICKS.map(function () {
      return '<span class="tool-slider__tick"></span>';
    }).join('') + '</div>';
  }

  function positionGravityTicks() {
    var wrap = $('toolSliders').querySelector('.tool-slider__ticks');
    if (!wrap) return;
    var min = S.SLIDER.g.min, max = S.SLIDER.g.max;
    [].forEach.call(wrap.querySelectorAll('.tool-slider__tick'), function (el, i) {
      var t = S.GRAVITY_TICKS[i];
      if (t == null) return;
      el.style.setProperty('left', ((t - min) / (max - min) * 100) + '%');
    });
  }

  function bindSliders() {
    var e = currentEnv();
    var host = $('toolSliders');
    var keys = ['g', 'p', 'o2'];
    keys.forEach(function (key) {
      var b = S.SLIDER[key];
      var id = 'sl-' + key;
      var row = host.querySelector('[data-key="' + key + '"]');
      if (!row) return;
      var input = row.querySelector('input[type="range"]');
      var valEl = row.querySelector('.tool-slider__val');
      input.min = b.min;
      input.max = b.max;
      input.step = b.step;
      input.value = e[key];
      input.disabled = false;
      input.removeAttribute('aria-readonly');
      input.setAttribute('aria-valuetext', ariaValText(key, e));
      valEl.textContent = key === 'g' ? B.gText(e.g) : (key === 'p' ? A.fmt(e.p, 1) + ' kPa' : B.o2Text(e.o2));
    });
  }

  function renderSliders() {
    var e = currentEnv();
    var labels = { g: 'Gravity', p: 'Pressure', o2: 'Oxygen' };
    var html = '';
    ['g', 'p', 'o2'].forEach(function (key) {
      var b = S.SLIDER[key];
      var val = key === 'g' ? B.gText(e.g) : (key === 'p' ? A.fmt(e.p, 1) + ' kPa' : B.o2Text(e.o2));
      html += '<label class="tool-slider" data-key="' + key + '"><span class="tool-slider__label">' + esc(labels[key]) + '</span>' +
        '<span class="tool-slider__val mono num">' + esc(val) + '</span>' +
        (key === 'g' ? tickMarksHtml() : '') +
        '<input type="range" id="sl-' + key + '" value="' + e[key] + '" min="' + b.min + '" max="' + b.max + '" step="' + b.step + '"' +
        ' aria-valuetext="' + esc(ariaValText(key, e)) + '" aria-labelledby="tool-env-label sl-' + key + '">' +
        '</label>';
    });
    $('toolSliders').innerHTML = html;
    bindSliders();
    positionGravityTicks();
    if (!$('toolSliders').dataset.bound) {
      $('toolSliders').dataset.bound = '1';
      $('toolSliders').addEventListener('input', onSliderInput);
    }
  }

  function onSliderInput(ev) {
    var input = ev.target.closest('input[type="range"]');
    if (!input) return;
    var row = input.closest('[data-key]');
    if (!row) return;
    var key = row.getAttribute('data-key');
    var e = currentEnv();
    e[key] = S.sliderToEnvField(key, input.value);
    state.envId = S.matchPresetId(e, A.ENVS, A.CUSTOM_DEFAULT);
    if (state.envId === 'custom') {
      e.id = 'custom';
      e.custom = true;
      e.name = A.CUSTOM_DEFAULT.name;
      e.phrase = A.CUSTOM_DEFAULT.phrase;
      e.kind = A.CUSTOM_DEFAULT.kind;
      B.saveCustom(e);
      state.live = cloneEnv(e);
    }
    state.dest = state.envId === 'custom' ? 'custom' : S.destFromEnvId(state.envId);
    syncDestFromEnv();
    pushUrl();
    schedulePaint(true);
  }

  function renderDestinations() {
    $('destChips').innerHTML = DEST.map(function (d) {
      return '<button type="button" class="chip chip--dest" data-dest="' + d.id + '" aria-pressed="' + (state.dest === d.id) + '">' + esc(d.label) + '</button>';
    }).join('');
  }

  function renderPresets() {
    var presets = A.ENVS.concat([A.CUSTOM_DEFAULT]);
    $('presetChips').innerHTML = presets.map(function (e) {
      var on = state.envId === e.id || (state.envId === 'custom' && e.id === 'custom' && false);
      var pressed = state.envId === e.id;
      return '<button type="button" class="chip" data-env="' + e.id + '" aria-pressed="' + pressed + '">' + esc(e.name) + '</button>';
    }).join('');
  }

  function renderVerdicts() {
    var e = currentEnv(), sum = A.summary(e);
    var sumEl = $('verdictSum');
    sumEl.removeAttribute('aria-busy');
    sumEl.innerHTML = '<span class="tool-verdicts__env">' + esc(e.name) + '</span><div class="count-pills" role="status">' + B.summaryPills(sum.counts) + '</div>';
    if (!B.reducedMotion() && sumEl.dataset.counts) {
      var prev = JSON.parse(sumEl.dataset.counts);
      ['breaks', 'weakens', 'unknown', 'holds'].forEach(function (k) {
        if (prev[k] !== sum.counts[k]) {
          var pill = sumEl.querySelector('.count-pill.v-' + k);
          if (pill) { pill.classList.add('count-pill--pulse'); setTimeout(function () { pill.classList.remove('count-pill--pulse'); }, 220); }
        }
      });
    }
    sumEl.dataset.counts = JSON.stringify(sum.counts);

    var rows = '';
    A.ROWS.forEach(function (r, idx) {
      var v = A.evaluate(r.id, e);
      var flash = prevStatuses[r.id] && prevStatuses[r.id] !== v.status ? ' verdict-list__item--flash' : '';
      prevStatuses[r.id] = v.status;
      rows += '<li class="verdict-list__item v-' + v.status + flash + '">' +
        '<button type="button" class="verdict-list__rule" data-row="' + r.id + '" title="' + esc(r.short) + '">' +
        '<span class="mono faint">R' + (idx < 9 ? '0' : '') + (idx + 1) + '</span> ' + esc(r.short) + '</button>' +
        '<span class="verdict-list__link">' + B.verdict(v.status, true) + '</span></li>';
    });
    $('toolVerdicts').removeAttribute('aria-busy');
    $('toolVerdicts').innerHTML = rows;
  }

  function renderStage() {
    var e = currentEnv();
    $('stageViz').setAttribute('data-env', state.dest);
    $('stageGravity').textContent = B.gText(e.g) + ' · ' + A.fmt(e.p, 1) + ' kPa · ' + B.o2Text(e.o2);
    var cap = $('stageCaption');
    cap.innerHTML = 'Schematic flame at ' + esc(B.gText(e.g)) + '. <a class="faint" href="method#flex-psi">NASA FLEX / PSI data</a>';
    cap.hidden = false;
  }

  function paint(skipSliders) {
    renderDestinations();
    renderPresets();
    if (!skipSliders) renderSliders(); else bindSliders();
    renderVerdicts();
    renderStage();
    if (window.__blfaFlameResize) window.__blfaFlameResize();
    if (drawerCtl && drawerCtl.isOpen() && state.row) openDrawer(state.row, true);
  }

  function schedulePaint(skipSliders) {
    if (paintRaf) return;
    paintRaf = window.requestAnimationFrame(function () {
      paintRaf = 0;
      paint(skipSliders);
    });
  }

  function pickDest(destId) {
    var d = DEST.filter(function (x) { return x.id === destId; })[0];
    if (!d) return;
    pickLiveFromPreset(d.defaultEnv);
  }

  function pickEnv(envId) {
    if (!validEnv(envId)) return;
    pickLiveFromPreset(envId);
  }

  function openDrawer(rowId, skipOpen) {
    state.row = rowId;
    var body = $('detail');
    body.removeAttribute('aria-busy');
    body.innerHTML = B.renderDetail(A, currentEnv(), rowId, { compact: true });
    if (!skipOpen) drawerCtl.setOpen(true);
    var h = $('detail-heading');
    if (h) B.scrollToNode(h, true);
  }

  $('destChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-dest]');
    if (btn) pickDest(btn.getAttribute('data-dest'));
  });
  $('presetChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-env]');
    if (btn) pickEnv(btn.getAttribute('data-env'));
  });
  $('toolVerdicts').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-row]');
    if (btn) openDrawer(btn.getAttribute('data-row'));
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

  drawerCtl = B.initEvidenceDrawer({ root: $('evidence-panel'), bodyEl: $('detail') });

  if (state.row && A.rowById(state.row) && window.location.hash === '#evidence-panel') {
    openDrawer(state.row);
  }

  paint();
  initFlame();

  function initFlame() {
    var cv = $('flameCanvas'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, raf = 0, visible = true, tabVisible = true;
    var reduce = B.reducedMotion();

    function envNow() { return currentEnv(); }

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

    function drawFrame(now) {
      var e = envNow(), shape = G.flameShape(e.g, e.o2);
      var t = (now || 0) / 1000, s = Math.min(W / 180, (H - 24) / 220);
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, yb = H - 20;
      var flick = reduce ? 1 : 1 + shape.flicker * 0.04 * Math.sin(t * 8);

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (shape.mode === 'sphere') {
        var r = shape.width * 0.5 * s * flick;
        var cy = yb - r - 8 * s;
        var pulse = reduce ? 0 : Math.sin(t * 1.3) * 0.7 * s;
        var shell = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + pulse);
        var br = shape.brightness;
        shell.addColorStop(0, 'rgba(50,110,255,' + (0.35 * br) + ')');
        shell.addColorStop(1, 'rgba(50,110,255,0)');
        ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'var(--surface-3)';
        ctx.beginPath(); ctx.arc(cx, cy, shape.coreRadius * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      var h = shape.height * s * flick, w = shape.width * s;
      var sway = reduce ? 0 : Math.sin(t * 2.5) * 6 * e.g * s;
      var br = shape.brightness;
      var body = ctx.createLinearGradient(0, yb, 0, yb - h);
      body.addColorStop(0, 'rgba(70,130,255,' + (0.9 * br) + ')');
      body.addColorStop(0.45, 'rgba(255,' + Math.round(140 + 80 * shape.warmMix) + ',80,' + (0.75 * br) + ')');
      body.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = body; teardrop(cx, yb, w, h, sway); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    }

    function draw(now) {
      drawFrame(now);
      raf = (!reduce && visible && tabVisible) ? window.requestAnimationFrame(draw) : 0;
    }

    window.__blfaFlameResize = function () { resize(); draw(0); };
    resize(); draw(0);
    window.addEventListener('resize', B.debounce(function () { resize(); if (!raf) draw(0); }, 100));
    document.addEventListener('visibilitychange', function () {
      tabVisible = !document.hidden;
      if (tabVisible && visible && !raf && !reduce) raf = window.requestAnimationFrame(draw);
      else if (!tabVisible && raf) { cancelAnimationFrame(raf); raf = 0; }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && tabVisible && !raf && !reduce) raf = window.requestAnimationFrame(draw);
        else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
      }).observe(cv);
    }
    document.addEventListener('blfa:theme', function () { draw(0); });
  }
});