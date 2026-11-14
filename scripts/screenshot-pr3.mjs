import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const base = process.env.BLFA_URL || 'http://127.0.0.1:8080';
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

let server = null;
if (!process.env.BLFA_URL) {
  server = spawn('node', ['scripts/serve.mjs'], { cwd: new URL('../', import.meta.url).pathname, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
}

const shots = [
  ['index-default-dark', '/', 1440, 1000, 'dark'],
  ['index-mars-cmp-toolbar', '/?d=mars&cmp=iss', 1440, 1000, 'dark'],
  ['index-default-light', '/', 1440, 1000, 'light'],
  ['index-compare-desktop', '/?d=mars&cmp=iss', 1440, 1000, 'dark', 'compare', 'tall'],
  ['index-compare-mobile', '/?d=mars&cmp=iss', 390, 844, 'dark', 'compare'],
  ['index-mobile-default-dark', '/', 390, 844, 'dark'],
  ['index-mobile-default-light', '/', 390, 844, 'light'],
  ['index-share-toast', '/?d=moon', 1440, 1000, 'dark', 'share'],
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  for (const row of shots) {
    const name = row[0];
    const path = row[1];
    const w = row[2];
    const h = row[3];
    const theme = row[4];
    const action = row[5];
    const variant = row[6];
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(base + path, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.evaluate((t) => {
      if (t === 'light') {
        localStorage.setItem('blfa-theme', 'light');
        document.documentElement.setAttribute('data-theme', 'light');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F5F0E8');
      } else {
        localStorage.setItem('blfa-theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0B0E14');
      }
      try { localStorage.setItem('blfa-coach-dismissed', '1'); } catch (e) { /* */ }
    }, theme);
    await page.waitForSelector('#toolVerdicts .verdict-list__item', { timeout: 15000 }).catch(() => {});
    if (action === 'compare') {
      await page.waitForSelector('.compare-table tbody tr', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => {
        document.getElementById('toolComparePanel')?.scrollIntoView({ block: 'start' });
      });
    }
    if (action === 'share') {
      await page.evaluate(() => {
        document.getElementById('toolShare')?.click();
      });
      await page.waitForSelector('#toolToast:not([hidden])', { timeout: 5000 }).catch(() => {});
    }
    const file = `${outDir}/pr3-${name}.png`;
    await page.screenshot({ path: file, fullPage: variant === 'tall' });
    console.log('wrote', file);
    await page.close();
  }

  const reportPage = await browser.newPage();
  await reportPage.goto(base + '/?d=moon', { waitUntil: 'networkidle0', timeout: 90000 });
  const pngB64 = await reportPage.evaluate(async () => {
    const e = window.AUDIT.envById('lander');
    const model = window.BLFA_REPORT.buildReportCardModel(window.AUDIT, e, {
      dest: 'moon',
      envId: 'lander',
      subtitle: 'Lunar lander or habitat',
      siteUrl: /localhost|127\.0\.0\.1/i.test(window.location.origin) ? 'https://blfa-wip.vercel.app' : window.location.origin
    });
    const cv = document.createElement('canvas');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    window.BLFA_REPORT.drawReportCard(cv, model, 'dark');
    return cv.toDataURL('image/png');
  });
  const raw = pngB64.replace(/^data:image\/png;base64,/, '');
  writeFileSync(`${outDir}/pr3-report-card.png`, Buffer.from(raw, 'base64'));
  console.log('wrote', `${outDir}/pr3-report-card.png`);
  await reportPage.close();
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}