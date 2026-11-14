import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { loadAudit, ENGINE_SCRIPTS } from './helpers/load-engine.mjs';
import { listPages, renderPage, navHrefFor } from '../scripts/sync-partials.mjs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const PAGES = listPages();
const html = Object.fromEntries(PAGES.map((f) => [f, read(f)]));

const NAV = [
  ['./', 'Tool'],
  ['audit', 'Audit'],
  ['evidence', 'Evidence'],
  ['calculators', 'Calculators'],
  ['method', 'Method'],
  ['about', 'About'],
];
const EXPECTED_PAGES = ['404.html', 'about.html', 'audit.html', 'calculators.html', 'evidence.html', 'index.html', 'method.html'];

const attr = (src, name) => [...src.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map((m) => m[1]);
const ids = (src) => new Set(attr(src, 'id'));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

/* "audit?env=rover#x" and "./" and "evidence.json" -> { file, query, hash } for local targets, null for external */
function target(href) {
  if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(href)) return null;
  const [pathAndQuery, hash = ''] = decode(href).split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  let file = path;
  if (file === '' ) return { file: null, query, hash };
  if (file === './' || file === '.' || file === '/') file = 'index.html';
  else if (!/\.[a-z0-9]+$/i.test(file)) file += '.html';
  return { file: file.replace(/^\//, ''), query, hash };
}

test('the site has exactly the expected pages', () => {
  assert.deepEqual(PAGES, EXPECTED_PAGES);
});

test('shared head, header and footer are identical on every page (no drift)', () => {
  for (const f of PAGES) assert.equal(renderPage(html[f], f), html[f], `${f} drifted from partials/. Run: npm run sync`);
});

test('every page has the shared navbar with the right links and exactly one current page', () => {
  for (const f of PAGES) {
    const nav = html[f].match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${f}: no site-nav`);
    const links = [...nav[0].matchAll(/<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], extra: m[2], text: decode(m[3]).trim() }));
    assert.deepEqual(links.map((l) => [l.href, l.text]), NAV, `${f}: nav links`);
    const current = links.filter((l) => /aria-current="page"/.test(l.extra));
    const want = navHrefFor(f);
    if (want) {
      assert.equal(current.length, 1, `${f}: one aria-current`);
      assert.equal(current[0].href, want, `${f}: current link`);
    } else assert.equal(current.length, 0, `${f}: no current link expected`);
    assert.match(html[f], /aria-label="Main"/, `${f}: nav has a label`);
    const toggle = html[f].match(/<button[^>]*data-nav-toggle[^>]*>/);
    assert.ok(toggle && /aria-expanded="false"/.test(toggle[0]) && /aria-controls="site-nav"/.test(toggle[0]), `${f}: mobile menu toggle`);
    assert.match(html[f], /<a class="skip-link" href="#main">/, `${f}: skip link`);
  }
});

test('every page has the basics: lang, title, one h1, main landmark', () => {
  for (const f of PAGES) {
    const s = html[f];
    assert.match(s, /<html lang="en">/, `${f}: lang`);
    assert.match(s, /<meta name="viewport" content="width=device-width, initial-scale=1">/, `${f}: viewport`);
    assert.match(s, /<title>[^<]{5,}<\/title>/, `${f}: title`);
    assert.equal((s.match(/<h1[\s>]/g) || []).length, 1, `${f}: exactly one h1`);
    assert.equal((s.match(/<main id="main"/g) || []).length, 1, `${f}: main#main`);
    if (f !== '404.html') assert.match(s, /<meta name="description" content="[^"]{30,}">/, `${f}: description`);
  }
  const titles = PAGES.map((f) => html[f].match(/<title>([^<]*)<\/title>/)[1]);
  assert.equal(new Set(titles).size, titles.length, 'page titles are unique');
});

test('no broken internal links, assets or fragments in any page', () => {
  for (const f of PAGES) {
    const refs = [...attr(html[f], 'href'), ...attr(html[f], 'src')];
    for (const ref of refs) {
      const t = target(ref);
      if (!t) continue;
      const file = t.file ?? f;
      assert.ok(existsSync(new URL(file, root)), `${f}: ${ref} -> missing file ${file}`);
      if (t.hash && file.endsWith('.html')) {
        assert.ok(ids(html[file]).has(t.hash), `${f}: ${ref} -> no element with id="${t.hash}" in ${file}`);
      }
    }
  }
});

test('links written in the UI scripts point at real pages, fragments and valid ids', () => {
  const A = loadAudit();
  const envIds = new Set([...A.ENVS.map((e) => e.id), 'custom']);
  const rowIds = new Set(A.ROWS.map((r) => r.id));
  const uiDir = new URL('assets/js/ui/', root);
  for (const f of readdirSync(uiDir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, uiDir), 'utf8');
    for (const m of src.matchAll(/["'](?:\.\/)?(audit|evidence|calculators|method|about)(\?[^"'#]*)?(#[A-Za-z0-9_-]+)?["'+]/g)) {
      const page = `${m[1]}.html`;
      assert.ok(existsSync(new URL(page, root)), `${f}: link to ${m[1]}`);
      if (m[3]) assert.ok(ids(html[page]).has(m[3].slice(1)), `${f}: ${m[0]} -> no id ${m[3]} in ${page}`);
    }
  }
  for (const e of A.ENVS) for (const r of A.ROWS) {
    assert.ok(envIds.has(e.id) && rowIds.has(r.id), `deep link audit?env=${e.id}&row=${r.id} is valid`);
  }
  for (const f of PAGES) {
    for (const ref of attr(html[f], 'href')) {
      const t = target(ref);
      if (!t || t.file !== 'audit.html' || !t.query) continue;
      const q = new URLSearchParams(t.query);
      if (q.get('env')) assert.ok(envIds.has(q.get('env')), `${f}: ${ref} has an unknown env`);
      if (q.get('row')) assert.ok(rowIds.has(q.get('row')), `${f}: ${ref} has an unknown row`);
    }
  }
});

test('pages that use the engine load the data files and engine.js in the right order', () => {
  const using = PAGES.filter((f) => html[f].includes('assets/js/engine.js'));
  assert.ok(using.length >= 5, 'audit, calculators, evidence, method and home use the engine');
  for (const f of using) {
    const scripts = attr(html[f], 'src').filter((s) => ENGINE_SCRIPTS.includes(s));
    assert.deepEqual(scripts, ENGINE_SCRIPTS, `${f}: engine scripts and their order`);
    const all = attr(html[f], 'src').filter((s) => s.endsWith('.js'));
    assert.ok(all.indexOf('assets/js/ui/common.js') > all.indexOf(ENGINE_SCRIPTS.at(-1)), `${f}: common.js after the engine`);
  }
  for (const f of PAGES.filter((p) => !using.includes(p))) assert.ok(!/assets\/js\/ui\/(audit|evidence|calculators|method|home)\.js/.test(html[f]), `${f}: page script without engine`);
});

test('every source has a short label for citations', () => {
  const A = loadAudit();
  for (const [id, s] of Object.entries(A.SOURCES)) assert.ok(typeof s.short === 'string' && s.short.length > 2, `source ${id} has a short label`);
});

test('vercel.json turns on clean URLs', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.equal(v.cleanUrls, true);
});

test('index tool workspace lists ten rules via the engine for every preset cabin', () => {
  const A = loadAudit();
  const index = read('index.html');
  assert.match(index, /id="toolVerdicts"/, 'index has a verdict list mount');
  assert.match(index, /id="destChips"/, 'index has destination chips');
  for (const e of A.ENVS) {
    assert.equal(A.summary(e).verdicts.length, 10, `${e.id} yields ten verdicts`);
  }
  assert.equal(A.summary(A.CUSTOM_DEFAULT).verdicts.length, 10, 'custom default yields ten verdicts');
});
