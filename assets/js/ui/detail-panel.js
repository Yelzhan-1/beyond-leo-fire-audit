/* Evidence detail markup shared by audit page and index tool drawer. */
(function (root) {
  'use strict';
  var B = root.BLFA;

  function renderDetail(A, env, rowId, opts) {
    var esc = B.esc;
    var v = A.evaluate(rowId, env);
    var r = v.row;
    var gap = r.gap(env);
    var idx = A.ROWS.indexOf(r);
    var ruleNum = 'R' + (idx < 9 ? '0' : '') + (idx + 1);
    var evidenceHref = 'evidence?rule=' + encodeURIComponent(rowId);
    var auditHref = 'audit?env=' + encodeURIComponent(env.id) + '&row=' + encodeURIComponent(rowId) + '#evidence-panel';

    var h = '<article class="detail"><div class="detail__main">' +
      '<p class="detail__where kicker"><span class="mono">' + esc(ruleNum) + '</span> · ' + esc(r.phase) + ' rule, checked for ' + esc(env.phrase) + '</p>' +
      '<h3 class="detail__title" id="detail-heading" tabindex="-1">' + esc(r.title) + '</h3>' +
      '<div class="detail__verdict">' + B.verdict(v.status) + '<span class="muted small">Basis: ' + esc(v.basisLabel) + '</span></div>' +
      '<p class="detail__why">' + esc(v.why) + '</p>' +
      '<div class="cluster">';
    if (!(opts && opts.compact)) {
      h += '<button type="button" class="btn btn--ghost btn--sm" id="backTop">Back to the table</button>';
    }
    h += '<a class="btn btn--ghost btn--sm" href="' + evidenceHref + '">Full rule in evidence</a>' +
      '<a class="btn btn--ghost btn--sm" href="' + auditHref + '">Open in audit table</a>';
    if (!(opts && opts.compact)) {
      h += '<button type="button" class="btn btn--ghost btn--sm" id="copyLink">Copy link to this cell</button><span class="small muted" id="copyMsg" role="status"></span>';
    }
    h += '</div>' +
      '<h4 class="detail__sub">Evidence that applies to this cabin</h4>';
    h += v.direct.length ? '<ul class="ev-list">' + v.direct.map(B.evItem).join('') + '</ul>' :
      '<p class="small muted">No record in this audit was measured under conditions that match this cabin.</p>';
    if (v.related.length) {
      h += '<details class="disclosure"><summary>Evidence on this rule measured under other conditions (' + v.related.length + ')</summary><div class="disclosure__body"><ul class="ev-list">' +
        v.related.map(B.evItem).join('') + '</ul></div></details>';
    }
    h += '</div><aside class="detail__side" aria-label="Context for this rule">' +
      '<h4 class="detail__sub">What the ISS does today</h4><p>' + esc(r.practice) + '</p><p class="srcs">Source: ' + B.srcLinks(r.practiceSrc) + '</p>' +
      '<h4 class="detail__sub">How this verdict is decided</h4><p>' + esc(r.rule) + '</p>' + (r.ruleSrc ? '<p class="srcs">Thresholds from: ' + B.srcLinks(r.ruleSrc) + '</p>' : '') +
      '<h4 class="detail__sub">What replaces the rule</h4><p>' + esc(r.next) + '</p><p class="srcs">Source: ' + B.srcLinks(r.nextSrc) + '</p>';
    if (r.earth) h += '<h4 class="detail__sub">Use on Earth</h4><p>' + esc(r.earth) + '</p><p class="srcs">Source: ' + B.srcLinks(r.earthSrc) + '</p>';
    if (gap) h += '<h4 class="detail__sub">Still open</h4><p>' + esc(gap) + '</p>';
    if (env.notes) h += '<h4 class="detail__sub">Cabin conditions</h4><p>' + esc(env.notes) + '</p>' + (env.src && env.src.length ? '<p class="srcs">Source: ' + B.srcLinks(env.src) + '</p>' : '');
    return h + '</aside></article>';
  }

  B.renderDetail = renderDetail;
})(window);