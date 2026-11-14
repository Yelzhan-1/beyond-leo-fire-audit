/* Shared shell behaviour: mobile menu and colour theme. Loaded on every page; needs no engine. */
(function () {
  'use strict';
  var doc = document.documentElement;

  /* ---------- mobile menu ---------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var mq = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
    var setOpen = function (open, returnFocus) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      if (!open && returnFocus) toggle.focus();
    };
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, true);
    });
    document.addEventListener('click', function (ev) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(ev.target) && !toggle.contains(ev.target)) setOpen(false);
    });
    if (mq) {
      var onChange = function () { if (!mq.matches) setOpen(false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------- theme ---------- */
  var themeBtn = document.querySelector('[data-theme-toggle]');
  var meta = document.querySelector('meta[name="theme-color"]');
  function current() { return doc.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function paint() {
    var t = current();
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#070a10' : '#f3f5f9');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      doc.setAttribute('data-theme', next);
      try { localStorage.setItem('blfa-theme', next); } catch (err) { /* private mode: the choice just lasts for this page */ }
      paint();
      document.dispatchEvent(new CustomEvent('blfa:theme', { detail: next }));
    });
  }
  paint();
})();
