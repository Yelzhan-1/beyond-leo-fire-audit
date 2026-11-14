/* Focus-trapped evidence drawer (audit + index). */
(function (root) {
  'use strict';
  var B = root.BLFA;
  var FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  function initEvidenceDrawer(opts) {
    var drawer = opts.root;
    if (!drawer) return { open: function () {}, close: function () {}, isOpen: function () { return false; } };
    var sheet = drawer.querySelector('.ev-drawer__sheet');
    var body = opts.bodyEl;
    var lastFocus = null;

    function focusables() {
      return [].filter.call(sheet.querySelectorAll(FOCUSABLE), function (el) {
        return el.offsetParent !== null && !el.hasAttribute('disabled');
      });
    }

    function trapFocus(ev) {
      if (ev.key !== 'Tab' || drawer.hidden) return;
      var list = focusables();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault(); last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault(); first.focus();
      }
    }

    function setOpen(open) {
      drawer.hidden = !open;
      root.document.documentElement.classList.toggle('ev-drawer-open', open);
      if (open) {
        lastFocus = root.document.activeElement;
        drawer.removeAttribute('aria-hidden');
        try { sheet.focus(); } catch (e) { /* */ }
        root.document.addEventListener('keydown', trapFocus);
      } else {
        drawer.setAttribute('aria-hidden', 'true');
        root.document.removeEventListener('keydown', trapFocus);
        if (lastFocus && lastFocus.focus) {
          try { lastFocus.focus({ preventScroll: true }); } catch (e2) { lastFocus.focus(); }
        }
      }
      if (opts.onOpenChange) opts.onOpenChange(open);
    }

    [].forEach.call(drawer.querySelectorAll('[data-drawer-close]'), function (btn) {
      btn.addEventListener('click', function () { setOpen(false); });
    });
    root.document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !drawer.hidden) { ev.preventDefault(); setOpen(false); }
    });

    if (body && opts.onBodyClick) {
      body.addEventListener('click', opts.onBodyClick);
    }

    return {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      isOpen: function () { return !drawer.hidden; },
      setOpen: setOpen
    };
  }

  B.initEvidenceDrawer = initEvidenceDrawer;
})(window);