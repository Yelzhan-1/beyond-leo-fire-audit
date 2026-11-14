/* Index (tool workspace): destination chips, live sliders, flame, verdicts, evidence drawer. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var S = window.BLFA_SCENARIO;
  var G = window.BLFA_FLAME_GEOM;
  var RPT = window.BLFA_REPORT;

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
    row: null,
    compareOn: false,
    compareDest: 'iss',
    compareEnvId: 'iss',
    compareLive: null
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
    var seed = S.resolveScenarioFromUrl(parsed, A.ENVS, A.CUSTOM_DEFAULT, B.loadCustom);
    state.envId = seed.envId;
    state.live = cloneEnv(seed.live);
    state.dest = seed.dest;
    state.row = parsed.row && A.rowById(parsed.row) ? parsed.row : null;
    if (state.envId === 'custom') B.saveCustom(state.live);
    syncDestFromEnv();
    if (parsed.compareOn && parsed.compare) {
      state.compareOn = true;
      var cmp = S.resolveCompareFromUrl(parsed.compare, A.ENVS, A.CUSTOM_DEFAULT, B.loadCustom);
      if (cmp) {
        state.compareDest = cmp.dest || parsed.compare.dest;
        state.compareEnvId = cmp.envId;
        state.compareLive = cloneEnv(cmp.live);
      }
    }
  })();

  function scenarioFmt() {
    return {
      fmtG: function (g) { return B.gText(g); },
      fmtP: function (p) { return A.fmt(p, 1); },
      fmtO2: function (o2) { return B.o2Text(o2); }
    };
  }

  function envSubtitle(e) {
    return S.scenarioSubtitle({
      envId: state.envId,
      dest: state.dest,
      env: e,
      fmtG: scenarioFmt().fmtG,
      fmtP: scenarioFmt().fmtP,
      fmtO2: function (o) { return B.o2Text(o); }
    });
  }

  function compareSnapshot() {
    if (!state.compareOn || !state.compareLive) return null;
    return {
      dest: state.compareDest,
      envId: state.compareEnvId,
      g: state.compareLive.g,
      p: state.compareLive.p,
      o2: state.compareLive.o2
    };
  }

  function comparePreset() {
    return state.compareEnvId !== 'custom' ? A.envById(state.compareEnvId) : null;
  }

  function pushUrl() {
    var e = currentEnv();
    var preset = state.envId !== 'custom' ? A.envById(state.envId) : null;
    var main = { dest: state.dest, envId: state.envId, g: e.g, p: e.p, o2: e.o2 };
    var q = state.compareOn
      ? S.serializeScenarioFull(main, preset, compareSnapshot(), comparePreset())
      : S.serializeScenario(main, preset);
    try {
      window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
    } catch (err) { /* */ }
  }

  function refreshCompareLive(destId) {
    var d = DEST.filter(function (x) { return x.id === destId; })[0];
    if (!d) return;
    state.compareDest = destId;
    state.compareEnvId = d.defaultEnv;
    state.compareLive = loadEnvById(d.defaultEnv);
    pushUrl();
    schedulePaint();
  }

  function toggleCompare(on) {
    state.compareOn = !!on;
    $('toolCompare').setAttribute('aria-pressed', state.compareOn ? 'true' : 'false');
    if (state.compareOn && !state.compareLive) refreshCompareLive(state.compareDest || 'iss');
    if (!state.compareOn) {
      state.compareLive = null;
    }
    pushUrl();
    schedulePaint();
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

  function isDesktopTool() {
    return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
  }

  function tickMarksHtml() {
    return '<div class="tool-slider__ticks tool-slider__ticks--above" aria-hidden="true">' + S.GRAVITY_TICKS.map(function (_, i) {
      var mid = i === 1 || i === 2;
      return '<span class="tool-slider__tick' + (mid ? ' tool-slider__tick--mid' : '') + '"></span>';
    }).join('') + '</div>';
  }

  function tickLabelsHtml() {
    return '<div class="tool-slider__tick-labels mono faint" aria-hidden="true">' +
      S.GRAVITY_TICK_LABELS.map(function (t, i) {
        var extra = i === 0 ? ' tool-slider__tick-label--start' : (i === 3 ? ' tool-slider__tick-label--end' : ' tool-slider__tick-label--mid');
        return '<span class="tool-slider__tick-label' + extra + '" data-tick="' + i + '"></span>';
      }).join('') +
      '</div>';
  }

  function positionGravityTicks(root) {
    if (!root) return;
    var min = S.SLIDER.g.min, max = S.SLIDER.g.max;
    var tickWrap = root.querySelector('.tool-slider__ticks');
    if (tickWrap) {
      [].forEach.call(tickWrap.querySelectorAll('.tool-slider__tick'), function (el, i) {
        var t = S.GRAVITY_TICKS[i];
        if (t == null) return;
        el.style.setProperty('left', ((t - min) / (max - min) * 100) + '%');
        if (i === 1 || i === 2) el.setAttribute('title', S.GRAVITY_TICK_LABELS[i].title);
      });
    }
    var labWrap = root.querySelector('.tool-slider__tick-labels');
    if (labWrap) {
      [].forEach.call(labWrap.querySelectorAll('.tool-slider__tick-label'), function (el, i) {
        var t = S.GRAVITY_TICK_LABELS[i];
        if (!t) return;
        var pct = (t.g - min) / (max - min) * 100;
        var transform = 'translateX(-50%)';
        if (i === 0) transform = 'translateX(0)';
        else if (i === 3) transform = 'translateX(-100%)';
        el.textContent = t.short;
        el.setAttribute('title', t.title);
        el.style.setProperty('left', pct + '%');
        el.style.setProperty('transform', transform);
      });
    }
  }

  function sliderRow(key, e, labelId) {
    var labels = { g: 'Gravity', p: 'Pressure', o2: 'Oxygen' };
    var b = S.SLIDER[key];
    var val = key === 'g' ? B.gText(e.g) : (key === 'p' ? A.fmt(e.p, 1) + ' kPa' : B.o2Text(e.o2));
    var input = '<input type="range" id="sl-' + key + '" value="' + e[key] + '" min="' + b.min + '" max="' + b.max + '" step="' + b.step + '"' +
      ' aria-valuetext="' + esc(ariaValText(key, e)) + '" aria-labelledby="' + esc(labelId) + ' sl-' + key + '">';
    var gBits = key === 'g'
      ? '<div class="tool-slider__tick-rail">' + tickMarksHtml() + input + '</div>' + tickLabelsHtml()
      : input;
    return '<label class="tool-slider' + (key === 'g' ? ' tool-slider--g' : '') + '" data-key="' + key + '"><span class="tool-slider__label">' + esc(labels[key]) + '</span>' +
      '<span class="tool-slider__val mono num">' + esc(val) + '</span>' + gBits + '</label>';
  }

  function bindSliders() {
    var e = currentEnv();
    [].forEach.call(document.querySelectorAll('.tool-slider[data-key]'), function (row) {
      var key = row.getAttribute('data-key');
      var b = S.SLIDER[key];
      if (!b) return;
      var input = row.querySelector('input[type="range"]');
      var valEl = row.querySelector('.tool-slider__val');
      if (!input || !valEl) return;
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
    var desktop = isDesktopTool();
    var mob = $('toolMobileG');
    var rail = $('toolSliders');
    if (mob) {
      mob.innerHTML = desktop ? '' : sliderRow('g', e, 'tool-mobile-g-label');
      if (!desktop) mob.setAttribute('aria-label', 'Gravity');
      if (!desktop) positionGravityTicks(mob);
    }
    if (rail) {
      var html = '';
      if (desktop) html += sliderRow('g', e, 'tool-env-label');
      html += sliderRow('p', e, 'tool-env-label') + sliderRow('o2', e, 'tool-env-label');
      rail.innerHTML = html;
      if (desktop) positionGravityTicks(rail);
    }
    bindSliders();
    if (!document.documentElement.dataset.slidersBound) {
      document.documentElement.dataset.slidersBound = '1';
      document.addEventListener('input', function (ev) {
        if (ev.target.closest('.tool-slider')) onSliderInput(ev);
      });
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

  function renderCompareDest() {
    var bar = $('compareDestChips');
    if (!bar) return;
    bar.innerHTML = DEST.map(function (d) {
      return '<button type="button" class="chip chip--dest" data-cmp-dest="' + d.id + '" aria-pressed="' + (state.compareDest === d.id) + '">' + esc(d.label) + '</button>';
    }).join('');
  }

  function compareSubtitle(env, envId, dest) {
    return S.scenarioSubtitle({
      envId: envId,
      dest: dest,
      env: env,
      fmtG: scenarioFmt().fmtG,
      fmtP: scenarioFmt().fmtP,
      fmtO2: function (o) { return B.o2Text(o); }
    });
  }

  function renderCompareTable() {
    var panel = $('toolComparePanel');
    var wrap = $('toolCompareTableWrap');
    if (!panel || !wrap) return;
    panel.hidden = !state.compareOn;
    if (!state.compareOn || !state.compareLive) {
      wrap.innerHTML = '';
      return;
    }
    var e = currentEnv();
    var bEnv = state.compareLive;
    var aName = envSubtitle(e);
    var bName = compareSubtitle(bEnv, state.compareEnvId, state.compareDest);
    var rows = '';
    A.ROWS.forEach(function (r, idx) {
      var va = A.evaluate(r.id, e);
      var vb = A.evaluate(r.id, bEnv);
      var diff = va.status !== vb.status;
      var num = 'R' + (idx < 9 ? '0' : '') + (idx + 1);
      rows += '<tr class="compare-table__row' + (diff ? ' compare-table__row--diff' : '') + '">' +
        '<th scope="row" class="compare-table__rule-cell">' +
        '<button type="button" class="compare-table__rule" data-row="' + r.id + '">' +
        '<span class="mono faint compare-table__id">' + num + '</span> <span class="compare-table__name">' + esc(r.short) + '</span></button></th>' +
        '<td class="compare-table__a" data-col="A"><span class="compare-table__mob-label mono faint">A · ' + esc(aName) + '</span>' + B.verdict(va.status, true) + '</td>' +
        '<td class="compare-table__b" data-col="B"><span class="compare-table__mob-label mono faint">B · ' + esc(bName) + '</span>' + B.verdict(vb.status, true) + '</td>' +
        '<td class="compare-table__chg">' + (diff ? '<span class="compare-table__changed">changed</span>' : '<span class="compare-table__same faint" aria-hidden="true">—</span>') + '</td></tr>';
    });
    wrap.innerHTML =
      '<table class="compare-table">' +
      '<caption class="visually-hidden">Verdict comparison between ' + esc(aName) + ' and ' + esc(bName) + '</caption>' +
      '<thead><tr>' +
      '<th scope="col">Rule</th>' +
      '<th scope="col" class="compare-table__head-a">A · ' + esc(aName) + '</th>' +
      '<th scope="col" class="compare-table__head-b">B · ' + esc(bName) + '</th>' +
      '<th scope="col"><span class="visually-hidden">Changed</span></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
    wrap.removeAttribute('aria-busy');
  }

  function renderVerdicts() {
    var e = currentEnv(), sum = A.summary(e);
    var sumEl = $('verdictSum');
    sumEl.removeAttribute('aria-busy');
    sumEl.innerHTML = '<span class="tool-verdicts__env">' + esc(envSubtitle(e)) + '</span><div class="count-pills" role="status">' + B.summaryPills(sum.counts) + '</div>';
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

    var listEl = $('toolVerdicts');
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
    listEl.className = 'verdict-list';
    listEl.innerHTML = rows;
    listEl.removeAttribute('aria-busy');
    renderCompareTable();
  }

  function renderStage() {
    var e = currentEnv();
    $('stageViz').setAttribute('data-env', state.dest);
    $('stageGravity').textContent = B.gText(e.g) + ' · ' + A.fmt(e.p, 1) + ' kPa · ' + B.o2Text(e.o2);
    var cap = $('stageCaption');
    cap.innerHTML = 'Schematic flame at ' + esc(B.gText(e.g)) + '. <a class="faint" href="method#flex-psi">NASA FLEX / PSI data</a>';
    cap.hidden = false;
    var fb = G.flameBehaviourLabel(e.g);
    var stats = $('stageStats');
    if (stats) {
      stats.innerHTML = '<div><dt>Shape</dt><dd>' + esc(fb.shape) + '</dd></div>' +
        '<div><dt>Behaviour</dt><dd>' + esc(fb.behaviour) + '</dd></div>' +
        '<div><dt>Gravity</dt><dd class="mono">' + esc(B.gText(e.g)) + '</dd></div>';
    }
  }

  function paint(skipSliders) {
    renderDestinations();
    renderPresets();
    renderCompareDest();
    $('toolCompare').setAttribute('aria-pressed', state.compareOn ? 'true' : 'false');
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
    if (h) {
      try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    }
  }

  $('destChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-dest]');
    if (btn) pickDest(btn.getAttribute('data-dest'));
  });
  $('presetChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-env]');
    if (btn) pickEnv(btn.getAttribute('data-env'));
  });
  function onRuleClick(ev) {
    var btn = ev.target.closest('[data-row]');
    if (btn) openDrawer(btn.getAttribute('data-row'));
  }
  $('toolVerdicts').addEventListener('click', onRuleClick);
  $('toolCompareTableWrap').addEventListener('click', onRuleClick);

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

  var toastTimer = 0;
  function showToast(msg, withUrl) {
    var el = $('toolToast');
    if (!el) return;
    var html = esc(msg);
    if (withUrl) {
      html += '<label class="tool-toast__fallback visually-hidden" for="toolShareUrl">Share URL</label>' +
        '<input class="tool-toast__url mono" id="toolShareUrl" type="text" readonly value="' + esc(withUrl) + '">';
    }
    el.innerHTML = html;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, withUrl ? 12000 : 3200);
  }

  function shareUrl() {
    var e = currentEnv();
    var preset = state.envId !== 'custom' ? A.envById(state.envId) : null;
    var url = S.buildShareUrl(window.location.origin, window.location.pathname, {
      dest: state.dest,
      envId: state.envId,
      g: e.g,
      p: e.p,
      o2: e.o2
    }, preset, state.compareOn ? compareSnapshot() : null, comparePreset());
    if (navigator.share) {
      navigator.share({ title: document.title, url: url }).catch(function () { /* user cancelled */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showToast('Link copied to clipboard');
      }).catch(function () {
        showToast('Copy this link', url);
      });
      return;
    }
    showToast('Copy this link', url);
  }

  function reportSiteUrl() {
    var o = window.location.origin || '';
    if (/localhost|127\.0\.0\.1/i.test(o)) return 'https://blfa-wip.vercel.app';
    return o;
  }

  function downloadReport() {
    if (!RPT) return;
    var e = currentEnv();
    var model = RPT.buildReportCardModel(A, e, {
      dest: state.dest,
      envId: state.envId,
      subtitle: envSubtitle(e),
      scenarioLine: B.gText(e.g) + ' · ' + A.fmt(e.p, 1) + ' kPa · ' + B.o2Text(e.o2),
      siteUrl: reportSiteUrl()
    });
    var cv = document.createElement('canvas');
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    var run = function () {
      RPT.drawReportCard(cv, model, theme);
      RPT.downloadReportPng(cv, 'beyond-leo-audit-report.png').catch(function () {
        showToast('Could not download report card');
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(run);
    else run();
  }

  $('toolShare').addEventListener('click', shareUrl);
  $('toolReport').addEventListener('click', downloadReport);
  $('toolCompare').addEventListener('click', function () { toggleCompare(!state.compareOn); });
  $('compareDestChips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-cmp-dest]');
    if (btn) refreshCompareLive(btn.getAttribute('data-cmp-dest'));
  });

  function placeCoach() {
    var coach = $('toolCoach');
    if (!coach) return;
    var desktop = isDesktopTool();
    var slot = desktop ? $('toolCoachSlotTop') : $('toolCoachSlotMobile');
    if (slot && coach.parentElement !== slot) slot.appendChild(coach);
  }

  (function initCoach() {
    var coach = $('toolCoach');
    var key = 'blfa-coach-dismissed';
    if (!coach) return;
    try {
      if (localStorage.getItem(key) === '1') return;
      placeCoach();
      coach.hidden = false;
      $('toolCoachDismiss').addEventListener('click', function () {
        coach.hidden = true;
        try { localStorage.setItem(key, '1'); } catch (e) { /* */ }
      });
      if (window.matchMedia) {
        var mq = window.matchMedia('(min-width: 1024px)');
        var onMq = function () { if (!coach.hidden) placeCoach(); };
        if (mq.addEventListener) mq.addEventListener('change', onMq);
        else if (mq.addListener) mq.addListener(onMq);
      }
    } catch (e) {
      coach.hidden = true;
    }
  })();

  paint();
  initFlame();
  window.addEventListener('resize', B.debounce(function () { renderSliders(); positionGravityTicks($('toolSliders')); positionGravityTicks($('toolMobileG')); }, 120));

  function initFlame() {
    var cv = $('flameCanvas'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, raf = 0, visible = true, tabVisible = true;
    var reduce = B.reducedMotion();
    var themeFill = '#1a2230';

    function readThemeFill() {
      try {
        var v = getComputedStyle(cv.parentElement || document.documentElement).getPropertyValue('--surface-3').trim();
        if (v) themeFill = v;
      } catch (e) { /* */ }
    }
    readThemeFill();

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
        var pulse = reduce ? 0 : Math.sin(t * 1.3) * 0.04 * r;
        var br = shape.brightness;
        var haloA = shape.haloAlpha != null ? shape.haloAlpha : 0.55;
        var shell = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 1.35 + pulse);
        shell.addColorStop(0, 'rgba(120,190,255,' + Math.min(1, 0.92 * br) + ')');
        shell.addColorStop(0.35, 'rgba(70,140,255,' + Math.min(1, haloA * br) + ')');
        shell.addColorStop(0.72, 'rgba(45,100,255,' + (0.35 * br) + ')');
        shell.addColorStop(1, 'rgba(30,70,200,0)');
        ctx.fillStyle = shell; ctx.beginPath(); ctx.arc(cx, cy, r * 1.35 + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        var core = ctx.createRadialGradient(cx, cy - r * 0.08, 0, cx, cy, r * 0.85);
        core.addColorStop(0, 'rgba(200,230,255,' + (0.95 * br) + ')');
        core.addColorStop(0.55, 'rgba(90,150,255,' + (0.85 * br) + ')');
        core.addColorStop(1, themeFill);
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx.fill();
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
    document.addEventListener('blfa:theme', function () { readThemeFill(); draw(0); });
  }
});