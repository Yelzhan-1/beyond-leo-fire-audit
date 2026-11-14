import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';

const base = process.env.BLFA_URL || 'http://127.0.0.1:8080';
const paths = ['/', '/?g=0', '/?d=mars&cmp=iss', '/audit', '/evidence', '/calculators', '/method', '/about'];

let server = null;
if (!process.env.BLFA_URL) {
  server = spawn('node', ['scripts/serve.mjs'], { cwd: new URL('../', import.meta.url).pathname, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const results = [];
try {
  for (const path of paths) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(base + path, { waitUntil: 'networkidle0', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 500));
    results.push({ path, errors });
    await page.close();
  }
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}

for (const r of results) {
  console.log(r.path + ': ' + (r.errors.length ? 'ERRORS ' + JSON.stringify(r.errors) : 'OK'));
}
if (results.some((r) => r.errors.length)) process.exitCode = 1;