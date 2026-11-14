import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const base = process.env.BLFA_URL || 'http://127.0.0.1:8080';
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

const shots = [
  ['index-default-dark', '/', 1440, 1000, 'dark'],
  ['index-default-light', '/', 1440, 1000, 'light'],
  ['index-g0-dark', '/?d=custom&g=0', 1440, 1000, 'dark'],
  ['index-g0-light', '/?d=custom&g=0', 1440, 1000, 'light'],
  ['index-mobile-default-dark', '/', 390, 844, 'dark'],
  ['index-drawer-desktop', '/?d=moon&row=mat#evidence-panel', 1440, 1000, 'dark'],
  ['audit-drawer-cell-desktop', '/audit?env=lander&row=vent', 1440, 1000, 'dark', 'click-cell'],
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
    }, theme);
    if (action === 'click-cell') {
      await page.waitForSelector('#matrix .cell', { timeout: 15000 });
      await page.click('#matrix .cell[data-env="lander"][data-row="vent"]');
      await page.waitForSelector('#detail-heading', { timeout: 15000 });
    } else if (path.includes('evidence-panel') || name.includes('drawer')) {
      await page.waitForSelector('#detail-heading', { timeout: 15000 }).catch(() => {});
    } else {
      await page.waitForSelector('#toolVerdicts .verdict-list__item', { timeout: 15000 }).catch(() => {});
    }
    const file = `${outDir}/pr2-${name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log('wrote', file);
    await page.close();
  }
} finally {
  await browser.close();
}