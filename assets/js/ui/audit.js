/* Audit page: rule x cabin matrix, cabin builder, evidence panel and rankings. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var DESKTOP = window.matchMedia ? window.matchMedia('(min-width: 901px)') : { matches: true };

  var state = { env: 'rover', row: 'vent', custom: B.loadCustom() };

  function env() { return A.envById(state.env, state.custom); }
  function allEnvs() { return A.ENVS.concat([state.custom]); }
  function validEnv(id) { return id === 'custom' || A.ENVS.some(function (e) { return e.id === id; }); }
  function validRow(id) { return !!A.rowById(id); }

  /* Deep links: audit?env=rover&row=vent */
  (function readUrl() {
    var p = B.params(), e = p.get('env'), r = p.get('row');
    if (e && validEnv(e)) state.env = e;
    if (r && validRow(r)) state.row = r;
  })();

  /* ---------- readout in the page header ---------- */
  function renderReadout() {
    var e = env(), c = A.summary(e).counts;
    function n(k, word) { return '<span class="readout__n v-' + k + '">' + B.icon(k) + '<span class="num">' + c[k] + '</span> ' + word + '</span>'; }
    $('readout').removeAttribute('aria-busy');
    $('readout').innerHTML =
      '<p class="readout__line"><strong>' + esc(e.name) + '</strong><span class="readout__cond">' + esc(B.gText(e.g) + ' · ' + A.fmt(e.p, 1) + ' kPa · ' + B.o2Text(e.o2) + ' O₂ · ' + B.vText(e.v)) + '</span></p>' +
      '<p class="readout__line readout__line--counts" aria-label="Verdict counts for this cabin">' + n('breaks', 'break') + n('weakens', 'weaken') + n('unknown', 'unknown') + n('holds', 'hold') + '</p>';
  }

  /* ---------- legend ---------- */
  function renderLegend() {
    $('legend').innerHTML = B.legendPills(A.summary(env()).counts);
  }

  /* ---------- cabin picker (small screens) ---------- */
  function renderPicker() {
    $('picker').innerHTML = allEnvs().map(function (e) {
      var s = A.summary(e);
      return '<button type="button" class="picker__btn" data-env="' + e.id + '" aria-pressed="' + (state.env === e.id) + '">' + B.flame(e.g, 30) +
        '<span class="picker__text"><span class="picker__name">' + esc(e.name) + '</span><span class="picker__sum">' + esc(A.summaryText(s.counts)) + '</span></span></button>';
    }).join('');
  }

  /* ---------- matrix ---------- */
  function renderMatrix() {
    var envs = allEnvs(), h = '<table class="matrix matrix--compact"><thead><tr><th class="matrix__corner" scope="col">Rule</th>';
    envs.forEach(function (e) {
      var s = A.summary(e), as = e.assumed || {};
      function val(k, text) { return '<span class="v' + (as[k] ? ' assumed' : '') + '">' + text + '</span>'; }
      var anyAssumed = Object.keys(as).length > 0;
      h += '<th scope="col"><button type="button" class="colhead" data-env="' + e.id + '" aria-pressed="' + (state.env === e.id) + '" aria-label="' + esc(e.name + ': ' + A.summaryText(s.counts)) + '">' +
        '<span class="colhead__top">' + B.flame(e.g, 34) + '<span class="colhead__name">' + esc(e.name) + '</span></span>' +
        '<span class="colhead__kind">' + esc(e.kind) + '</span>' +
        '<span class="colhead__cond"><span class="k">Gravity</span>' + val('g', B.gText(e.g)) +
        '<span class="k">Pressure</span>' + val('p', A.fmt(e.p, 1) + ' kPa') +
        '<span class="k">Oxygen</span>' + val('o2', B.o2Text(e.o2)) +
        '<span class="k">Volume</span>' + val('v', B.vText(e.v)) + '</span>' +
        '<span class="colhead__note">' + (anyAssumed ? 'Italic values are assumed' : (e.custom ? 'Set in the builder below' : 'Values from agency sources')) + '</span>' +
        '<span class="colhead__bar" aria-hidden="true">' + s.verdicts.map(function (v) { return '<i class="v-' + v.status + '"></i>'; }).join('') + '</span>' +
        '<span class="colhead__count">' + esc(A.summaryText(s.counts)) + '</span></button></th>';
    });
    h += '</tr></thead><tbody>';
    var phase = null;
    A.ROWS.forEach(function (r, idx) {
      if (r.phase !== phase) { phase = r.phase; h += '<tr class="matrix__phase"><th scope="rowgroup">' + esc(phase) + '</th><td colspan="' + envs.length + '"></td></tr>'; }
      h += '<tr><th scope="row"><span class="rn">Rule ' + (idx < 9 ? '0' : '') + (idx + 1) + '</span>' + esc(r.title) + (r.context ? '<small>Programme context, not combustion data</small>' : '') + '</th>';
      envs.forEach(function (e) {
        var v = A.evaluate(r.id, e);
        h += '<td data-env="' + e.id + '"><button type="button" class="cell v-' + v.status + '" data-env="' + e.id + '" data-row="' + r.id + '" aria-pressed="false" aria-label="' + esc(e.name + ', ' + r.short + ': ' + A.STATUS[v.status].label + '. ' + v.reason) + '">' +
          '<span class="cell__status">' + B.icon(v.status) + A.STATUS[v.status].label + '</span><span class="cell__reason">' + esc(v.reason) + '</span></button></td>';
      });
      h += '</tr>';
    });
    var host = $('matrix'), left = host.scrollLeft;
    host.removeAttribute('aria-busy');
    host.innerHTML = h + '</tbody></table>';
    host.scrollLeft = left;
    markSelection();
  }

  /* Update pressed states and the focused column without rebuilding the table, so keyboard focus stays put. */
  function markSelection() {
    [].forEach.call(document.querySelectorAll('#matrix [data-env], #picker [data-env]'), function (n) {
      var id = n.getAttribute('data-env');
      if (n.classList.contains('colhead') || n.classList.contains('picker__btn')) n.setAttribute('aria-pressed', String(id === state.env));
      else if (n.classList.contains('cell')) n.setAttribute('aria-pressed', String(id === state.env && n.getAttribute('data-row') === state.row));
      else if (n.tagName === 'TD') n.classList.toggle('is-focus', id === state.env);
    });
  }

  function renderDetail() {
    var host = $('detail');
    host.removeAttribute('aria-busy');
    host.innerHTML = B.renderDetail(A, env(), state.row, { compact: false });
  }

  /* ---------- rankings ---------- */
  function renderRanks() {
    var e = env(), inv = A.rankInvestigations(e), gaps = A.rankGaps(e), top = inv.length ? inv[0].score : 1;
    var h = '<h3>Experiments ranked by how much they decide</h3><p class="note">Each rule counts 3 points if it breaks, 2 if it weakens or is unknown and 1 if it holds. An experiment gets full points when its record applies to this cabin and 40% when it was measured under other conditions.</p>';
    h += '<ol class="rank">';
    inv.forEach(function (x) {
      h += '<li><div class="rank__name">' + esc(x.inv.name) + ' <span class="rank__full">' + B.invLinks(x.inv) + '</span></div>' +
        '<div class="rank__full">' + esc(x.inv.full) + '. ' + esc(x.inv.where) + '.</div>' +
        '<div class="rank__bar" role="img" aria-label="Score ' + A.fmt(x.score, 1) + ' points"><i data-w="' + Math.max(4, Math.round(x.score / top * 100)) + '"></i></div>' +
        '<div class="rank__rows"><span class="num">' + A.fmt(x.score, 1) + '</span> points. ' + x.rows.map(function (rr) { return rr.how === 'direct' ? esc(rr.row.short) : '<span class="faint">' + esc(rr.row.short) + ' (other conditions)</span>'; }).join(', ') + '</div></li>';
    });
    var $inv = $('rankInv'); $inv.innerHTML = h + '</ol>';
    [].forEach.call($inv.querySelectorAll('.rank__bar i[data-w]'), function (bar) {
      bar.style.setProperty('width', bar.getAttribute('data-w') + '%');
    });
    var g = '<h3>Open questions ranked by distance from a measurement</h3><p class="note">Unknowns come first, then verdicts that rest on a NASA assessment, short ground tests or data carried over from 0 g.</p>';
    if (!gaps.length) g += '<div class="state state--empty"><h3>No open questions here</h3><p>Every verdict for this cabin rests on a measurement in matching conditions or on current practice.</p></div>';
    g += '<ol class="rank">';
    gaps.forEach(function (x) {
      g += '<li class="gap"><div class="gap__top"><span class="rank__name">' + esc(x.row.short) + '</span>' + B.verdict(x.status, true) + '<span class="rank__full">' + esc(x.basisLabel) + '</span></div>' +
        '<p class="gap__text">' + esc(x.text) + '</p>' + (x.src.length ? '<p class="srcs">Source: ' + B.srcLinks(x.src) + '</p>' : '') + '</li>';
    });
    $('rankGap').innerHTML = g + '</ol>';
    [].forEach.call(document.querySelectorAll('.ranks'), function (n) { n.removeAttribute('aria-busy'); });
  }

  /* ---------- builder ---------- */
  function syncBuilder() {
    var c = state.custom;
    $('oP').textContent = A.fmt(c.p, 1) + ' kPa'; $('oO').textContent = A.fmt(c.o2, 1) + '%'; $('oV').textContent = B.vText(c.v);
    $('ppO2').textContent = A.fmt(c.p * c.o2 / 100, 1) + ' kPa';
  }
  function customChanged() {
    syncBuilder(); B.saveCustom(state.custom);
    state.env = 'custom';
    B.setParams({ env: state.env, row: state.row });
    renderMatrix(); renderPicker(); markSelection(); renderDetail(); renderRanks(); renderReadout(); renderLegend();
  }
  function initBuilder() {
    var c = state.custom;
    $('cP').value = c.p; $('cO').value = c.o2; $('cV').value = B.sliderFromV(c.v); $('cDust').checked = c.dust; $('cBeyond').checked = c.beyond;
    [].forEach.call(document.querySelectorAll('input[name="cg"]'), function (r) {
      r.checked = Math.abs(parseFloat(r.value) - c.g) < 0.001;
      r.addEventListener('change', function () { if (r.checked) { c.g = parseFloat(r.value); customChanged(); } });
    });
    $('cP').addEventListener('input', function () { c.p = parseFloat(this.value); customChanged(); });
    $('cO').addEventListener('input', function () { c.o2 = parseFloat(this.value); customChanged(); });
    $('cV').addEventListener('input', function () { c.v = B.vFromSlider(parseFloat(this.value)); customChanged(); });
    $('cDust').addEventListener('change', function () { c.dust = this.checked; customChanged(); });
    $('cBeyond').addEventListener('change', function () { c.beyond = this.checked; customChanged(); });
    syncBuilder();
  }

  var drawerCtl = B.initEvidenceDrawer({
    root: $('evidence-panel'),
    bodyEl: $('detail'),
    onBodyClick: function (ev) {
      if (ev.target.closest('#backTop')) {
        drawerCtl.setOpen(false);
        var sel = document.querySelector('#matrix .cell[aria-pressed="true"]') || document.querySelector('#matrix .cell');
        var target = DESKTOP.matches ? $('matrix') : $('picker');
        B.scrollToNode(target);
        if (sel && sel.offsetParent !== null) { try { sel.focus({ preventScroll: true }); } catch (e) { sel.focus(); } }
      } else if (ev.target.closest('#copyLink')) {
        var msg = $('copyMsg');
        B.copyText(window.location.href).then(function () { msg.textContent = 'Link copied.'; }, function () { msg.textContent = 'Copy the address from the browser bar.'; });
        setTimeout(function () { msg.textContent = ''; }, 2500);
      }
    }
  });

  function select(envId, rowId, open) {
    state.env = envId; if (rowId) state.row = rowId;
    B.setParams({ env: state.env, row: state.row });
    markSelection(); renderDetail(); renderRanks(); renderReadout(); renderLegend();
    if (open) {
      drawerCtl.setOpen(true);
      try {
        history.replaceState(null, '', window.location.pathname + '?' + new URLSearchParams({ env: state.env, row: state.row }).toString() + '#evidence-panel');
      } catch (e) { /* */ }
      var h = $('detail-heading');
      if (h) {
        try { h.focus({ preventScroll: true }); } catch (e3) { h.focus(); }
      }
    }
  }

  function clearMatrixHover() {
    [].forEach.call(document.querySelectorAll('.matrix-row--hover, .matrix-col--hover'), function (n) {
      n.classList.remove('matrix-row--hover', 'matrix-col--hover');
    });
  }

  function setMatrixHover(cell) {
    clearMatrixHover();
    if (!cell) return;
    var tr = cell.closest('tr');
    if (tr) tr.classList.add('matrix-row--hover');
    var envId = cell.getAttribute('data-env');
    if (!envId) return;
    [].forEach.call(document.querySelectorAll('#matrix [data-env="' + envId + '"]'), function (n) {
      if (n.tagName === 'TD' || n.classList.contains('colhead')) n.classList.add('matrix-col--hover');
    });
  }

  function init() {
    renderLegend(); renderPicker(); renderMatrix(); renderDetail(); renderRanks(); renderReadout(); initBuilder();

    function onPick(ev) {
      var cell = ev.target.closest('.cell'), col = ev.target.closest('.colhead, .picker__btn');
      if (cell) { select(cell.getAttribute('data-env'), cell.getAttribute('data-row'), true); }
      else if (col) select(col.getAttribute('data-env'), null, false);
    }
    $('matrix').addEventListener('click', onPick);
    $('picker').addEventListener('click', onPick);

    $('matrix').addEventListener('mouseover', function (ev) {
      var cell = ev.target.closest('.cell');
      if (cell) setMatrixHover(cell);
    });
    $('matrix').addEventListener('mouseleave', function (ev) {
      if (!ev.relatedTarget || !ev.currentTarget.contains(ev.relatedTarget)) clearMatrixHover();
    });
    $('matrix').addEventListener('focusin', function (ev) {
      var cell = ev.target.closest('.cell');
      if (cell) setMatrixHover(cell);
    });
    $('matrix').addEventListener('focusout', function () {
      setTimeout(function () {
        if (!document.querySelector('#matrix .cell:focus')) clearMatrixHover();
      }, 0);
    });

    /* Arrow keys move between cells, as in a grid. */
    $('matrix').addEventListener('keydown', function (ev) {
      var t = ev.target.closest('.cell'); if (!t || !/^Arrow/.test(ev.key)) return;
      var envs = allEnvs().map(function (e) { return e.id; }), rows = A.ROWS.map(function (r) { return r.id; });
      var ci = envs.indexOf(t.getAttribute('data-env')), ri = rows.indexOf(t.getAttribute('data-row'));
      if (ev.key === 'ArrowRight') ci++; else if (ev.key === 'ArrowLeft') ci--; else if (ev.key === 'ArrowDown') ri++; else ri--;
      if (ci < 0 || ri < 0 || ci >= envs.length || ri >= rows.length) return;
      var next = document.querySelector('#matrix .cell[data-env="' + envs[ci] + '"][data-row="' + rows[ri] + '"]');
      if (next && next.offsetParent !== null) { ev.preventDefault(); next.focus(); }
    });

    if (window.location.hash === '#evidence-panel') {
      drawerCtl.setOpen(true);
      var dh = $('detail-heading');
      if (dh) B.scrollToNode(dh, true);
    }
  }
  init();
});
