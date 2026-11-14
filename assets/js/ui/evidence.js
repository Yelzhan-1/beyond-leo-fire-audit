/* Evidence page: keyword search, experiments, evidence records and sources, all filterable. */
BLFA.boot(function (A) {
  'use strict';
  var B = window.BLFA, $ = B.$, esc = B.esc;
  var P = B.params();
  var custom = B.loadCustom();
  var invKeys = Object.keys(A.INV), srcKeys = Object.keys(A.SOURCES);

  function pluralize(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function ruleLabel(r) { var i = A.ROWS.indexOf(r); return 'Rule ' + (i < 9 ? '0' : '') + (i + 1) + ': ' + r.short; }
  function opt(value, label, selected) { return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function empty(title, text, resetId) {
    return '<div class="state state--empty" role="status"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (resetId ? '<button type="button" class="btn btn--sm" id="' + resetId + '">Reset filters</button>' : '') + '</div>';
  }

  /* ---------- search ---------- */
  var CHIPS = ['What breaks for the rover?', 'Can a CO\u2082 extinguisher be used in a small cabin?', 'Why do detectors miss smoke?', 'What is unknown on the Moon?', 'Does turning off the fans work on Mars?'];
  var lastSearch = null;
  function cellLink(c) { return 'audit?env=' + encodeURIComponent(c.env.id) + '&amp;row=' + encodeURIComponent(c.row.id) + '#evidence-panel'; }

  function runSearch(q) {
    var res = A.search(q, custom), out = $('askOut'), h = '';
    lastSearch = { q: q, res: res };
    out.removeAttribute('aria-busy');
    $('siOut').hidden = true; $('siOut').textContent = '';
    if (res.empty) {
      out.innerHTML = '<div class="state state--empty"><h3>Nothing in the audit matches those words</h3><p>Name a rule, such as ventilation, detector, extinguisher or mask, and a cabin, such as rover or Mars.</p></div>';
      $('si').hidden = true; return;
    }
    if (res.cells.length) {
      h += '<h3 class="ask__h">Verdicts</h3><ul class="ans-cells">' + res.cells.map(function (c) {
        return '<li><a class="ans-cell v-' + c.v.status + '" href="' + cellLink(c) + '"><span class="ans-cell__env">' + esc(c.env.name) + '</span><span class="ans-cell__rule">' + esc(c.row.title) + '</span>' + B.verdict(c.v.status, true) + '<span class="ans-cell__why">' + esc(c.v.why) + '</span></a></li>';
      }).join('') + '</ul>';
    }
    if (res.evidence.length) h += '<h3 class="ask__h">Evidence records</h3><ul class="ev-list">' + res.evidence.map(function (e) { return B.evItem(e, { rule: true }); }).join('') + '</ul>';
    out.innerHTML = h;
    renderSI();
  }

  /* SI explanation: one optional button, honest about whether it is switched on. */
  function renderSI() {
    var box = $('si'), st = window.BLFA_SI ? window.BLFA_SI.status() : { available: false, message: 'SI explanations are not available on this page.' };
    box.hidden = false;
    $('siStatus').textContent = st.message;
    $('siBtn').disabled = !st.available;
    $('siBtn').setAttribute('aria-disabled', String(!st.available));
  }
  function explain() {
    if (!lastSearch || !window.BLFA_SI) return;
    var s = lastSearch, out = $('siOut'), btn = $('siBtn');
    var records = {
      verdicts: s.res.cells.map(function (c) { return { cabin: c.env.name, rule: c.row.title, verdict: A.STATUS[c.v.status].label, basis: c.v.basisLabel, explanation: c.v.why }; }),
      evidence: s.res.evidence.map(function (e) { return { finding: e.finding, conditions: e.cond, source: A.SOURCES[e.src].cite }; })
    };
    out.hidden = false; out.textContent = 'Asking the SI service\u2026'; btn.disabled = true;
    window.BLFA_SI.explain({ question: s.q, records: records }).then(function (r) {
      out.textContent = r.text;
      var tag = document.createElement('p'); tag.className = 'small faint'; tag.textContent = 'Generated text. Check it against the records above; the verdicts do not depend on it.'; out.appendChild(tag);
    }, function (e) {
      out.textContent = e && e.code === 'unavailable' ? e.message : 'The SI service could not answer just now. The verdicts and records above are complete without it.';
    }).then(function () { btn.disabled = !window.BLFA_SI.status().available; });
  }

  $('askChips').innerHTML = CHIPS.map(function (c) { return '<button type="button" class="chip">' + esc(c) + '</button>'; }).join('');
  $('askChips').addEventListener('click', function (ev) {
    var b = ev.target.closest('.chip'); if (!b) return;
    $('askQ').value = b.textContent; runSearch(b.textContent); B.setParams({ ask: b.textContent });
  });
  $('askForm').addEventListener('submit', function (ev) { ev.preventDefault(); var q = $('askQ').value.trim(); if (q) { runSearch(q); B.setParams({ ask: q }); } });
  $('siBtn').addEventListener('click', explain);
  var ask = P.get('ask') || CHIPS[0];
  $('askQ').value = ask; runSearch(ask);
  if (window.BLFA_SI) window.BLFA_SI.ready().then(function () { if (lastSearch && !lastSearch.res.empty) renderSI(); });

  /* ---------- experiments ---------- */
  var SETTINGS = [['all', 'All experiments'], ['iss', 'On the ISS'], ['orbit', 'Other orbital flights'], ['ground', 'Ground tests'], ['psi', 'In the PSI repository']];
  function setting(inv) { return /^ISS/.test(inv.where) ? 'iss' : (/orbit/i.test(inv.where) ? 'orbit' : 'ground'); }
  var expState = { setting: P.get('setting') && SETTINGS.some(function (s) { return s[0] === P.get('setting'); }) ? P.get('setting') : 'all' };
  var recsByInv = {};
  A.EVIDENCE.forEach(function (e) { if (e.inv) (recsByInv[e.inv] = recsByInv[e.inv] || []).push(e); });

  function expMatches(k) {
    var inv = A.INV[k], s = expState.setting;
    return s === 'all' || (s === 'psi' ? !!inv.psi : setting(inv) === s);
  }
  function renderExpFilters() {
    $('expFilters').innerHTML = SETTINGS.map(function (s) {
      var n = invKeys.filter(function (k) { var o = expState.setting; expState.setting = s[0]; var m = expMatches(k); expState.setting = o; return m; }).length;
      return '<button type="button" class="chip" data-setting="' + s[0] + '" aria-pressed="' + (expState.setting === s[0]) + '">' + esc(s[1]) + ' <span class="faint">' + n + '</span></button>';
    }).join('');
  }
  function renderExperiments() {
    var keys = invKeys.filter(expMatches), host = $('expList');
    host.removeAttribute('aria-busy');
    $('expCount').textContent = 'Showing ' + keys.length + ' of ' + invKeys.length + ' experiments. Counts and conditions are taken from the records in this audit.';
    if (!keys.length) { host.innerHTML = empty('No experiments match', 'Choose another setting.'); return; }
    host.innerHTML = keys.map(function (k) {
      var inv = A.INV[k], recs = recsByInv[k] || [], rules = {};
      recs.forEach(function (e) { rules[e.row] = 1; });
      var conds = [];
      recs.forEach(function (e) { if (conds.indexOf(e.cond) < 0) conds.push(e.cond); });
      return '<article class="card exp" id="exp-' + k + '"><div class="exp__top"><span class="badge">' + esc(inv.where) + '</span>' + (inv.psi ? '<span class="badge badge--nasa">NASA PSI</span>' : '') + '</div>' +
        '<h3>' + esc(inv.name) + '</h3><p class="exp__full">' + esc(inv.full) + '</p>' +
        '<p class="exp__links">' + B.invLinks(inv) + '</p>' +
        (inv.note ? '<p class="exp__note">' + esc(inv.note) + '</p>' : '') +
        '<p class="exp__stat"><b class="num">' + recs.length + '</b> evidence ' + (recs.length === 1 ? 'record' : 'records') + ' across <b class="num">' + Object.keys(rules).length + '</b> ' + (Object.keys(rules).length === 1 ? 'rule' : 'rules') + '</p>' +
        '<p class="exp__rules">' + Object.keys(rules).map(function (id) { return '<a class="chip chip--sm" href="audit?row=' + id + '#evidence-panel">' + esc(A.rowById(id).short) + '</a>'; }).join(' ') + '</p>' +
        (conds.length ? '<details class="disclosure"><summary>Test conditions in this audit (' + conds.length + ')</summary><div class="disclosure__body"><ul class="exp__conds">' + conds.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div></details>' : '') +
        '<p><button type="button" class="btn btn--ghost btn--sm" data-view-inv="' + k + '">Show these records</button></p></article>';
    }).join('');
  }
  $('expFilters').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-setting]'); if (!b) return;
    expState.setting = b.getAttribute('data-setting'); B.setParams({ setting: expState.setting === 'all' ? '' : expState.setting });
    renderExpFilters(); renderExperiments();
    var again = document.querySelector('#expFilters [data-setting="' + expState.setting + '"]'); if (again) again.focus();
  });
  $('expList').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-view-inv]'); if (!b) return;
    rec.inv = b.getAttribute('data-view-inv'); syncRecControls(); renderRecords(); writeRecParams();
    B.scrollToNode($('records'));
  });

  /* ---------- evidence records ---------- */
  var rec = { q: P.get('q') || '', rule: P.get('rule') || '', dir: P.get('dir') || '', basis: P.get('basis') || '', inv: P.get('inv') || '' };
  if (rec.rule && !A.rowById(rec.rule)) rec.rule = '';
  if (rec.dir && !B.DIR[rec.dir]) rec.dir = '';
  if (rec.basis && !A.BASIS[rec.basis]) rec.basis = '';
  if (rec.inv && rec.inv !== '_none' && !A.INV[rec.inv]) rec.inv = '';

  function fillSelects() {
    $('fRule').innerHTML = opt('', 'All rules') + A.ROWS.map(function (r) { return opt(r.id, ruleLabel(r)); }).join('');
    $('fDir').innerHTML = opt('', 'Any direction') + Object.keys(B.DIR).map(function (d) { return opt(d, B.DIR[d]); }).join('');
    $('fBasis').innerHTML = opt('', 'Any basis') + Object.keys(A.BASIS).filter(function (b) { return A.EVIDENCE.some(function (e) { return e.basis === b; }); }).map(function (b) { return opt(b, A.BASIS[b]); }).join('');
    $('fInv').innerHTML = opt('', 'Any experiment') + invKeys.map(function (k) { return opt(k, A.INV[k].name); }).join('') + opt('_none', 'None (NASA assessments, reviews, practice)');
  }
  function syncRecControls() { $('fQ').value = rec.q; $('fRule').value = rec.rule; $('fDir').value = rec.dir; $('fBasis').value = rec.basis; $('fInv').value = rec.inv; }
  function writeRecParams() { B.setParams({ q: rec.q, rule: rec.rule, dir: rec.dir, basis: rec.basis, inv: rec.inv }); }
  function recMatches(e) {
    if (rec.rule && e.row !== rec.rule) return false;
    if (rec.dir && e.dir !== rec.dir) return false;
    if (rec.basis && e.basis !== rec.basis) return false;
    if (rec.inv === '_none' ? !!e.inv : (rec.inv && e.inv !== rec.inv)) return false;
    if (rec.q) {
      var hay = (e.finding + ' ' + e.cond + ' ' + e.loc + ' ' + A.SOURCES[e.src].cite + ' ' + (e.inv ? A.INV[e.inv].name + ' ' + A.INV[e.inv].full : '')).toLowerCase();
      return rec.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) >= 0; });
    }
    return true;
  }
  function renderRecords() {
    var list = A.EVIDENCE.filter(recMatches), host = $('recList');
    host.removeAttribute('aria-busy');
    $('recCount').textContent = 'Showing ' + list.length + ' of ' + A.EVIDENCE.length + ' evidence records.';
    host.innerHTML = list.length ? '<ul class="ev-list">' + list.map(function (e) { return B.evItem(e, { rule: true }); }).join('') + '</ul>' : empty('No records match these filters', 'Remove a filter or try fewer words.', 'fReset2');
    var r2 = $('fReset2'); if (r2) r2.addEventListener('click', resetRecords);
  }
  function resetRecords() { rec = { q: '', rule: '', dir: '', basis: '', inv: '' }; syncRecControls(); renderRecords(); writeRecParams(); }
  fillSelects(); syncRecControls();
  $('fQ').addEventListener('input', B.debounce(function () { rec.q = $('fQ').value.trim(); renderRecords(); writeRecParams(); }, 150));
  [['fRule', 'rule'], ['fDir', 'dir'], ['fBasis', 'basis'], ['fInv', 'inv']].forEach(function (x) {
    $(x[0]).addEventListener('change', function () { rec[x[1]] = this.value; renderRecords(); writeRecParams(); });
  });
  $('fReset').addEventListener('click', resetRecords);

  /* ---------- sources ---------- */
  var uses = {};
  function use(id) { if (id) uses[id] = (uses[id] || 0) + 1; }
  A.EVIDENCE.forEach(function (e) { use(e.src); });
  A.ROWS.forEach(function (r) { ['practiceSrc', 'ruleSrc', 'nextSrc', 'earthSrc', 'gapSrc'].forEach(function (f) { (r[f] || []).forEach(use); }); });
  A.ENVS.forEach(function (e) { (e.src || []).forEach(use); });

  var GROUPS = [['all', 'All sources'], ['official', 'Challenge resources'], ['nasa', 'NASA'], ['partner', 'Partner agency'], ['other', 'Other']];
  function groupOf(s) { return s.official ? 'official' : (s.nasa ? 'nasa' : (s.partner ? 'partner' : 'other')); }
  var GROUP_LABEL = { official: 'Challenge resource', nasa: 'NASA', partner: 'Partner agency', other: 'Publication' };
  var srcState = { group: GROUPS.some(function (g) { return g[0] === P.get('src'); }) ? P.get('src') : 'all' };
  function srcFiltered(g) { return srcKeys.filter(function (k) { return g === 'all' || groupOf(A.SOURCES[k]) === g; }); }
  function renderSources() {
    $('srcFilters').innerHTML = GROUPS.map(function (g) {
      return '<button type="button" class="chip" data-group="' + g[0] + '" aria-pressed="' + (srcState.group === g[0]) + '">' + esc(g[1]) + ' <span class="faint">' + srcFiltered(g[0]).length + '</span></button>';
    }).join('');
    var keys = srcFiltered(srcState.group), host = $('srcList');
    host.removeAttribute('aria-busy');
    $('srcCount').textContent = 'Showing ' + keys.length + ' of ' + srcKeys.length + ' sources.';
    host.innerHTML = keys.map(function (k) {
      var s = A.SOURCES[k], g = groupOf(s), n = uses[k] || 0;
      return '<li class="src"><div class="src__top"><span class="badge' + (g === 'other' ? '' : ' badge--nasa') + '">' + GROUP_LABEL[g] + '</span><span class="small faint">Cited ' + pluralize(n, 'time', 'times') + '</span></div>' +
        '<p class="src__cite">' + esc(s.cite) + '</p>' + (s.use ? '<p class="small muted">' + esc(s.use) + '</p>' : '') +
        '<p class="small">' + B.ext(s.url, 'Open the source') + '</p></li>';
    }).join('');
  }
  $('srcFilters').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-group]'); if (!b) return;
    srcState.group = b.getAttribute('data-group'); B.setParams({ src: srcState.group === 'all' ? '' : srcState.group });
    renderSources();
    var again = document.querySelector('#srcFilters [data-group="' + srcState.group + '"]'); if (again) again.focus();
  });

  renderExpFilters(); renderExperiments(); renderRecords(); renderSources();
});
