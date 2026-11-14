import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listPages } from '../scripts/sync-partials.mjs';

const root = new URL('../', import.meta.url);
const pages = listPages().filter((f) => f !== '404.html');
const read = (f) => readFileSync(new URL(f, root), 'utf8');

test('every main page has meta description and Open Graph tags', () => {
  for (const f of pages) {
    const html = read(f);
    const desc = html.match(/<meta name="description" content="([^"]+)">/);
    assert.ok(desc && desc[1].length >= 30 && desc[1].length <= 200, `${f}: description length`);
    assert.match(html, /<meta property="og:title" content="[^"]+">/, `${f}: og:title`);
    assert.match(html, /<meta property="og:description" content="[^"]+">/, `${f}: og:description`);
    assert.match(html, /theme-boot\.js/, `${f}: theme-boot.js`);
  }
});

test('shared partial exposes social preview image', () => {
  const head = readFileSync(new URL('partials/head.html', root), 'utf8');
  assert.match(head, /og:image/);
  assert.match(head, /twitter:card/);
});