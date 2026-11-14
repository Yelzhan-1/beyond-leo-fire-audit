/* Runs before paint: JS class + saved theme (no inline script, CSP-friendly). */
document.documentElement.classList.add('js');
try {
  var t = localStorage.getItem('blfa-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}