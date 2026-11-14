/* Shared UI helpers, exposed as window.BLFA. Needs window.AUDIT (engine) for the data-aware helpers. */
(function (root) {
  'use strict';
  var doc = root.document;

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- boot with loading / error handling ---------- */
  function errorState(title, detail) {
    return '<div class="state state--error" role="alert"><h3>' + esc(title) + '</h3><p>' + esc(detail) + '</p>' +
      '<button type="button" class="btn btn--sm" data-reload>Reload the page</button></div>';
  }
  function showError(title, detail) {
    var targets = doc.querySelectorAll('[data-app]');
    [].forEach.call(targets, function (el, i) {
      el.removeAttribute('aria-busy');
      if (i === 0) el.innerHTML = errorState(title, detail); else el.hidden = true;
    });
    [].forEach.call(doc.querySelectorAll('[data-reload]'), function (b) { b.addEventListener('click', function () { root.location.reload(); }); });
  }
  /* Runs fn(AUDIT) once the DOM is ready and the engine has loaded; shows an error state if it did not. */
  function boot(fn) {
    function go() {
      if (!root.AUDIT) { showError('The audit data did not load', 'A script file could not be fetched. Check your connection and reload the page. Nothing on this page works without it.'); return; }
      try { fn(root.AUDIT); } catch (e) {
        if (root.console) root.console.error(e);
        showError('Something went wrong on this page', 'The audit engine loaded, but this page could not be drawn (' + (e && e.message ? e.message : 'unknown error') + ').');
      }
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
  }

  /* ---------- URL state ---------- */
  function params() { return new root.URLSearchParams(root.location.search); }
  function setParams(obj) {
    var p = params();
    Object.keys(obj).forEach(function (k) { if (obj[k] === null || obj[k] === '' || obj[k] === undefined) p.delete(k); else p.set(k, obj[k]); });
    var q = p.toString();
    try { root.history.replaceState(null, '', root.location.pathname + (q ? '?' + q : '') + root.location.hash); } catch (e) { /* file:// or sandbox */ }
  }

  /* ---------- formatting ---------- */
  function gText(g) { return g < 0.01 ? '0 g' : root.AUDIT.fmt(g, 2) + ' g'; }
  function vText(v) { return root.AUDIT.sig(v) + ' m\u00b3'; }
  function o2Text(o) { return root.AUDIT.fmt(o, o % 1 ? 1 : 0) + '%'; }

  /* ---------- icons ---------- */
  function icon(st) {
    var open = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false">';
    if (st === 'holds') return open + '<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.6 8.3l2.3 2.3 4.5-4.8" fill="none" stroke="var(--v-bg, var(--bg))" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (st === 'weakens') return open + '<circle cx="8" cy="8" r="6.1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 1.9a6.1 6.1 0 0 0 0 12.2z" fill="currentColor"/></svg>';
    if (st === 'breaks') return open + '<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="var(--v-bg, var(--bg))" stroke-width="1.9" stroke-linecap="round"/></svg>';
    return open + '<circle cx="8" cy="8" r="6.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.4 2"/><path d="M6.4 6.3a1.7 1.7 0 1 1 2.5 1.5c-.6.3-.9.7-.9 1.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.5" r=".85" fill="currentColor"/></svg>';
  }
  function verdict(st, small) {
    return '<span class="verdict v-' + st + (small ? ' verdict--sm' : '') + '">' + icon(st) + root.AUDIT.STATUS[st].label + '</span>';
  }

  /* Schematic flame: a sphere without gravity, stretching upward as buoyancy returns. */
  function flame(g, h) {
    var H = h || 34, W = Math.round(H * 28 / 34);
    var s = '<svg class="flame" width="' + W + '" height="' + H + '" viewBox="0 0 28 34" aria-hidden="true" focusable="false">';
    if (g < 0.01) return s + '<circle class="fl-outer" cx="14" cy="23" r="8"/><circle class="fl-core0" cx="14" cy="23" r="4"/></svg>';
    var base = 31, r = 7.5, ht = 2 * r * (1 + 1.25 * Math.sqrt(g)), tip = base - ht, mid = base - ht * 0.42;
    var ht2 = ht * 0.5, tip2 = base - 1.5 - ht2, mid2 = base - 1.5 - ht2 * 0.42;
    return s + '<path class="fl-outer" d="M14 ' + base + 'C' + (14 - r * 1.25) + ' ' + base + ' ' + (14 - r * 1.2) + ' ' + mid.toFixed(1) + ' 14 ' + tip.toFixed(1) + 'C' + (14 + r * 1.2) + ' ' + mid.toFixed(1) + ' ' + (14 + r * 1.25) + ' ' + base + ' 14 ' + base + 'Z"/>' +
      '<path class="fl-core" d="M14 ' + (base - 1.5) + 'C' + (14 - r * 0.6) + ' ' + (base - 1.5) + ' ' + (14 - r * 0.55) + ' ' + mid2.toFixed(1) + ' 14 ' + tip2.toFixed(1) + 'C' + (14 + r * 0.55) + ' ' + mid2.toFixed(1) + ' ' + (14 + r * 0.6) + ' ' + (base - 1.5) + ' 14 ' + (base - 1.5) + 'Z"/></svg>';
  }

  /* ---------- links and citations ---------- */
  function ext(url, text) { return '<a class="ext" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + '</a>'; }
  function srcLinks(ids) {
    var S = root.AUDIT.SOURCES;
    return (ids || []).map(function (id) { return S[id] ? ext(S[id].url, S[id].short || id) : ''; }).join(', ');
  }
  function invLinks(inv) { return inv.links.map(function (l) { return ext(l.url, l.label); }).join(' '); }

  var DIR = { supports: 'Supports the rule', weakens: 'Weakens the rule', refutes: 'Contradicts the rule', open: 'Open question', context: 'Context' };

  /* One evidence record as an <li>. */
  function evItem(ev) {
    var A = root.AUDIT, inv = ev.inv ? A.INV[ev.inv] : null;
    var invHtml = inv ? '<span class="ev__inv">' + esc(inv.name) + ' ' + invLinks(inv) + '</span>' : '';
    return '<li class="ev ev--' + ev.dir + '"><div class="ev__top"><span class="ev__dir">' + DIR[ev.dir] + '</span>' + invHtml + '<span class="ev__inv">' + esc(A.BASIS[ev.basis]) + '</span></div>' +
      '<p class="ev__find">' + esc(ev.finding) + '</p>' +
      '<p class="ev__meta">Conditions: ' + esc(ev.cond) + '. Source: ' + srcLinks([ev.src]) + ', ' + esc(ev.loc.charAt(0).toLowerCase() + ev.loc.slice(1)) + '.</p></li>';
  }

  /* ---------- misc ---------- */
  function scrollToNode(node, focus) {
    try { node.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { node.scrollIntoView(); }
    if (focus) { if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1'); try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); } }
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function copyText(text) {
    if (root.navigator.clipboard && root.navigator.clipboard.writeText) return root.navigator.clipboard.writeText(text);
    return Promise.reject(new Error('clipboard unavailable'));
  }
  /* Log-scaled cabin volume slider (5 m3 .. 1005 m3), as in the original page. */
  function vFromSlider(s) { var v = 5 * Math.pow(201, s / 1000); return v < 20 ? Math.round(v * 10) / 10 : Math.round(v); }
  function sliderFromV(v) { return Math.round(1000 * Math.log(v / 5) / Math.log(201)); }

  /* The cabin built on the audit page is kept for the session so the calculators can start from it. */
  var CUSTOM_KEY = 'blfa-custom-cabin';
  function loadCustom() {
    var base = JSON.parse(JSON.stringify(root.AUDIT.CUSTOM_DEFAULT));
    try {
      var s = JSON.parse(root.sessionStorage.getItem(CUSTOM_KEY) || 'null');
      if (s && typeof s === 'object') ['g', 'p', 'o2', 'v'].forEach(function (k) { if (typeof s[k] === 'number' && isFinite(s[k])) base[k] = s[k]; });
      if (s && typeof s.dust === 'boolean') base.dust = s.dust;
      if (s && typeof s.beyond === 'boolean') base.beyond = s.beyond;
    } catch (e) { /* storage unavailable */ }
    return base;
  }
  function saveCustom(c) {
    try { root.sessionStorage.setItem(CUSTOM_KEY, JSON.stringify({ g: c.g, p: c.p, o2: c.o2, v: c.v, dust: c.dust, beyond: c.beyond })); } catch (e) { /* storage unavailable */ }
  }

  root.BLFA = {
    loadCustom: loadCustom, saveCustom: saveCustom,
    $: $, esc: esc, boot: boot, showError: showError, errorState: errorState, reducedMotion: reducedMotion,
    params: params, setParams: setParams, gText: gText, vText: vText, o2Text: o2Text,
    icon: icon, verdict: verdict, flame: flame, ext: ext, srcLinks: srcLinks, invLinks: invLinks, DIR: DIR, evItem: evItem,
    scrollToNode: scrollToNode, debounce: debounce, copyText: copyText, vFromSlider: vFromSlider, sliderFromV: sliderFromV
  };
})(window);
