import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const base = process.env.BLFA_URL || 'http://127.0.0.1:8080';
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

const shots = [
  ['index-g1-dark', '/?d=iss&g=1&p=101.3&o2=21', 1440, 1000, 'dark'],
  ['index-g1-light', '/?d=iss&g=1&p=101.3&o2=21', 1440, 1000, 'light'],
  ['index-g038-dark', '/?d=mars&g=0.38&p=56.5&o2=34', 1440, 1000, 'dark'],
  ['index-g038-light', '/?d=mars&g=0.38&p=56.5&o2=34', 1440, 1000, 'light'],
  ['index-g0-dark', '/?d=iss&g=0&p=101.3&o2=21', 1440, 1000, 'dark'],
  ['index-g0-light', '/?d=iss&g=0&p=101.3&o2=21', 1440, 1000, 'light'],
  ['index-drawer-desktop', '/?d=moon&row=mat#evidence-panel', 1440, 1000, 'dark'],
  ['index-drawer-mobile', '/?d=moon&row=mat#evidence-panel', 390, 844, 'dark'],
  ['audit-drawer-desktop', '/audit?env=lander&row=mat#evidence-panel', 1440, 1000, 'dark'],
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  for (const [name, path, w, h, theme] of shots) {
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
    if (path.includes('drawer') || path.includes('evidence-panel')) {
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