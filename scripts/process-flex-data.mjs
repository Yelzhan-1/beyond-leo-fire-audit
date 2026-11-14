#!/usr/bin/env node
/* Fetch NASA PSI-69 FLEX files and write small JSON subsets under data/.
   Source (CC0-1.0): https://psi.nasa.gov/physci/repo/data/investigations/PSI-69 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = join(root, 'data');
const PSI = 'https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download';
const V = '5';

async function dl(file) {
  const url = `${PSI}?file=${encodeURIComponent(file)}&version=${V}&redirect=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function decodeCsv(buf) {
  const text = buf.toString('latin1').replace(/\r\n/g, '\n');
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',');
  return lines.filter(Boolean).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (cols[i] || '').trim(); });
    return row;
  });
}

function num(s) {
  if (!s || s === '–' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normSummary(rows) {
  return rows.map((r) => ({
    flexNumber: num(r['FLEX Test #']),
    testId: r['FLEX Identifier'],
    date: r['Test Date'],
    fuel: r.Fuel,
    p_mmHg: num(r['Ambient pressure; mmHg']),
    o2: num(r['O initial ambient composition; mole fraction']),
    n2: num(r['N initial ambient composition; mole fraction']),
    co2: num(r['CO initial ambient composition; mole fraction']),
    he: num(r['He initial ambient composition; mole fraction']),
    d0_mm: num(r['Droplet initial diameter; mm']),
    dExt_mm: num(r['Visible flame extinction diameter; mm']),
    K_mm2_per_s: num(r['Burning rate; mm']),
    burnTime_s: num(r['Burn time; s']),
    end: r['Test end'],
  })).filter((r) => r.testId);
}

function parseDropletTsv(buf) {
  const text = buf.toString('utf8').trim();
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.includes('\t'));
  if (!lines.length) return [];
  const header = lines[0].split('\t').map((h) => h.trim());
  const ti = header.indexOf('DropletTime_sec');
  const di = header.indexOf('DropletDiameter_mm');
  const pts = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t');
    const t = num(c[ti]);
    const d = num(c[di]);
    if (t == null || d == null) continue;
    pts.push({ t_s: Math.round(t * 1000) / 1000, d_mm: Math.round(d * 10000) / 10000, d2_mm2: Math.round(d * d * 10000) / 10000 });
  }
  return pts;
}

function downsample(pts, tMax) {
  const burn = pts.filter((p) => p.t_s >= 0 && p.t_s <= tMax);
  const step = Math.max(1, Math.floor(burn.length / 120));
  return burn.filter((_, i) => i % step === 0 || i === burn.length - 1);
}

const meta = {
  investigation: 'PSI-69',
  title: 'Flame Extinguishment Experiment (FLEX)',
  doi: '10.60555/mbq8-0451',
  license: 'CC0-1.0',
  landingPage: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69',
  processedAt: new Date().toISOString().slice(0, 10),
};

const csvBuf = await dl('PSI-69_Experimental table_FLEX.csv');
const all = normSummary(decodeCsv(csvBuf));

const co2Chart = all.filter((r) => r.o2 === 0.21 && r.K_mm2_per_s != null && r.co2 != null && r.co2 <= 0.75 && ['Methanol', 'Heptane'].includes(r.fuel));

const dropletBuf = await dl('PSI-69_Raw Data_FLEX-002_DropletData.txt');
const flex002 = all.find((r) => r.testId === '20CAL10');
const series = downsample(parseDropletTsv(dropletBuf), flex002?.burnTime_s ?? 5.2);

mkdirSync(dataDir, { recursive: true });

writeFileSync(join(dataDir, 'flex-meta.json'), JSON.stringify({
  ...meta,
  sources: [
    {
      file: 'PSI-69_Experimental table_FLEX.csv',
      download: `${PSI}?file=${encodeURIComponent('PSI-69_Experimental table_FLEX.csv')}&version=${V}&redirect=true`,
      rows: all.length,
    },
    {
      file: 'PSI-69_Raw Data_FLEX-002_DropletData.txt',
      download: `${PSI}?file=${encodeURIComponent('PSI-69_Raw Data_FLEX-002_DropletData.txt')}&version=${V}&redirect=true`,
      flexTest: 'FLEX-002',
      flexIdentifier: '20CAL10',
    },
  ],
}, null, 2));

writeFileSync(join(dataDir, 'flex-co2-burn-rate.json'), JSON.stringify({
  ...meta,
  description: 'Burning-rate constant K (mm²/s) from the PSI experimental summary table. Ambient O₂ mole fraction 0.21; CO₂ mole fraction as measured for each test.',
  units: { K_mm2_per_s: 'mm²/s', co2: 'mole fraction', p_mmHg: 'mmHg' },
  records: co2Chart,
}, null, 2));

writeFileSync(join(dataDir, 'flex-002-d2-series.json'), JSON.stringify({
  ...meta,
  description: 'Droplet diameter and diameter squared versus time for ISS test FLEX-002 (identifier 20CAL10): methanol in cabin air (21% O₂, 1 atm), from PSI reduced droplet track.',
  test: flex002,
  units: { t_s: 's', d_mm: 'mm', d2_mm2: 'mm²' },
  points: series,
}, null, 2));

console.log('wrote data/flex-meta.json, flex-co2-burn-rate.json (' + co2Chart.length + ' rows), flex-002-d2-series.json (' + series.length + ' points)');