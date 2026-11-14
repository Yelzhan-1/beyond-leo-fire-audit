import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const base = process.env.BLFA_URL || 'http://127.0.0.1:8080';
const outDir = process.env.OUT_DIR || '/opt/cursor/artifacts';
const prefix = process.env.PREFIX || 'ux-after';
mkdirSync(outDir, { recursive: true });

const pages = [
  ['index', '/'],
  ['audit', '/audit'],
  ['evidence', '/evidence'],
  ['calculators', '/calculators'],
  ['method', '/method#flex-psi'],
  ['about', '/about'],
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  for (const [name, path] of pages) {
    for (const [tag, width, height] of [['desktop-1440', 1440, 900], ['mobile-390', 390, 844]]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(base + path, { waitUntil: 'networkidle0', timeout: 90000 });
      if (path.includes('audit')) {
        await page.waitForSelector('#matrix .cell', { timeout: 30000 }).catch(() => {});
      }
      if (path.includes('method')) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForSelector('#flexCharts .chart-svg', { timeout: 45000 }).catch(() => {});
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.screenshot({ path: `${outDir}/${prefix}-${name}-${tag}.png`, fullPage: true });
      await page.close();
      console.log('wrote', `${prefix}-${name}-${tag}.png`);
    }
  }
} finally {
  await browser.close();
}