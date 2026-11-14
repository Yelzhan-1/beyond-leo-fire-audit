import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');

function block(selectorStart) {
  const i = css.indexOf(selectorStart);
  assert.ok(i >= 0, `tokens.css has a block starting with ${selectorStart}`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  const vars = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)) vars[m[1]] = m[2];
  return vars;
}

const themes = {
  dark: block(':root,\n[data-theme="dark"]'),
  light: block('[data-theme="light"] {')
};

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SURFACES = ['bg', 'bg-elev', 'surface', 'surface-2', 'surface-3'];
const pairs = [];
for (const fg of ['text', 'text-2', 'text-3', 'link']) for (const bg of SURFACES) pairs.push([fg, bg, 4.5, 'text']);
for (const v of ['holds', 'weakens', 'breaks', 'unknown']) {
  pairs.push([v, `${v}-bg`, 4.5, 'verdict label on its tint']);
  for (const bg of ['bg', 'surface', 'surface-2']) pairs.push([v, bg, 4.5, 'verdict label on surface']);
  pairs.push(['text', `${v}-bg`, 4.5, 'body text on verdict tint']);
  pairs.push(['text-2', `${v}-bg`, 4.5, 'secondary text on verdict tint']);
}
pairs.push(['on-brand', 'brand', 4.5, 'primary button label']);
for (const bg of ['bg', 'surface']) {
  pairs.push(['brand', bg, 3, 'brand accent (graphics, large text)']);
  pairs.push(['focus', bg, 3, 'focus ring']);
  pairs.push(['line-strong', bg, 3, 'control borders']);
}
pairs.push(['focus', 'surface-2', 3, 'focus ring']);
pairs.push(['line-strong', 'surface-2', 3, 'control borders']);

for (const [theme, vars] of Object.entries(themes)) {
  test(`${theme} theme: every token pair meets WCAG AA`, () => {
    const failures = [];
    for (const [fg, bg, min, what] of pairs) {
      assert.ok(vars[fg] && vars[bg], `${theme}: --${fg} and --${bg} are defined`);
      const r = ratio(vars[fg], vars[bg]);
      if (r < min) failures.push(`--${fg} ${vars[fg]} on --${bg} ${vars[bg]} = ${r.toFixed(2)} (< ${min}) [${what}]`);
    }
    assert.deepEqual(failures, []);
  });
}
