#!/usr/bin/env node
/* Keeps the shared <head> block, header and footer identical on every page.
   Pages hold the markers  <!-- partial:NAME --> ... <!-- /partial:NAME -->  and this script rewrites what is
   between them from partials/NAME.html. The active nav link (aria-current="page") is set per page.

     node scripts/sync-partials.mjs          rewrite the pages
     node scripts/sync-partials.mjs --check  exit 1 if any page has drifted (also run by tests/pages.test.mjs) */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const PARTIALS = ['head', 'header', 'footer'];

export function listPages() {
  return readdirSync(root).filter((f) => f.endsWith('.html')).sort();
}

/* "audit.html" -> the nav href that should be marked current; index.html -> "./" */
export function navHrefFor(file) {
  if (file === 'index.html') return './';
  if (file === '404.html') return null;
  return file.replace(/\.html$/, '');
}

export function renderPartial(name, file) {
  let html = readFileSync(new URL(`partials/${name}.html`, root), 'utf8').replace(/\n$/, '');
  if (name === 'header') {
    const href = navHrefFor(file);
    if (href) {
      const needle = `<a href="${href}">`;
      if (!html.includes(needle)) throw new Error(`header partial has no nav link ${needle} for ${file}`);
      html = html.replace(needle, `<a href="${href}" aria-current="page">`);
    }
  }
  return html;
}

export function renderPage(source, file) {
  let out = source;
  for (const name of PARTIALS) {
    const re = new RegExp(`(<!-- partial:${name} -->)[\\s\\S]*?(<!-- /partial:${name} -->)`);
    if (!re.test(out)) throw new Error(`${file}: missing <!-- partial:${name} --> markers`);
    out = out.replace(re, (_m, a, b) => `${a}\n${renderPartial(name, file)}\n${b}`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const drift = [];
  for (const file of listPages()) {
    const path = new URL(file, root);
    const src = readFileSync(path, 'utf8');
    const out = renderPage(src, file);
    if (out !== src) {
      drift.push(file);
      if (!check) writeFileSync(path, out);
    }
  }
  if (check && drift.length) {
    console.error('Shared header/footer drifted in: ' + drift.join(', ') + '\nRun: npm run sync');
    process.exit(1);
  }
  console.log(check ? 'partials: in sync' : drift.length ? 'partials: updated ' + drift.join(', ') : 'partials: already in sync');
}
