import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

const DATA_FILES = [
  'data/flex-meta.json',
  'data/flex-co2-burn-rate.json',
  'data/flex-002-d2-series.json',
];

test('FLEX data files exist, stay under 1 MB, and parse as JSON', () => {
  let total = 0;
  for (const f of DATA_FILES) {
    const url = new URL(f, root);
    assert.ok(existsSync(url), f + ' missing');
    const st = statSync(url);
    assert.ok(st.size > 0, f + ' empty');
    total += st.size;
    readJson(f);
  }
  assert.ok(total < 1024 * 1024, 'data/ subset should stay under 1 MB');
  assert.ok(existsSync(new URL('data/README.md', root)), 'data/README.md missing');
});

test('flex-meta.json schema', () => {
  const m = readJson('data/flex-meta.json');
  assert.equal(m.investigation, 'PSI-69');
  assert.match(m.landingPage, /^https:\/\/psi\.nasa\.gov\//);
  assert.match(m.doi, /^10\.60555\//);
  assert.ok(Array.isArray(m.sources) && m.sources.length >= 2);
  for (const s of m.sources) {
    assert.match(s.download, /^https:\/\/psi\.nasa\.gov\/geode-py\//);
  }
});

test('flex-co2-burn-rate.json schema and cohort size', () => {
  const j = readJson('data/flex-co2-burn-rate.json');
  assert.equal(j.investigation, 'PSI-69');
  assert.ok(Array.isArray(j.records) && j.records.length >= 40 && j.records.length <= 60);
  for (const r of j.records) {
    assert.ok(['Methanol', 'Heptane'].includes(r.fuel), 'fuel');
    assert.equal(r.o2, 0.21);
    assert.ok(typeof r.K_mm2_per_s === 'number' && r.K_mm2_per_s > 0);
    assert.ok(typeof r.co2 === 'number' && r.co2 >= 0 && r.co2 <= 1);
    assert.ok(typeof r.p_mmHg === 'number');
    assert.ok(typeof r.testId === 'string');
  }
});

test('flex-002-d2-series.json schema and time series', () => {
  const j = readJson('data/flex-002-d2-series.json');
  assert.equal(j.test.testId, '20CAL10');
  assert.ok(Array.isArray(j.points) && j.points.length >= 50);
  let prevT = -1;
  for (const p of j.points) {
    assert.ok(typeof p.t_s === 'number' && p.t_s >= 0);
    assert.ok(typeof p.d_mm === 'number' && p.d_mm > 0);
    assert.ok(typeof p.d2_mm2 === 'number' && p.d2_mm2 > 0);
    assert.ok(Math.abs(p.d2_mm2 - p.d_mm * p.d_mm) < 0.02, 'd² consistent with d');
    assert.ok(p.t_s >= prevT, 'time non-decreasing');
    prevT = p.t_s;
  }
});

test('method page wires FLEX chart assets', () => {
  const html = readFileSync(new URL('method.html', root), 'utf8');
  assert.match(html, /id="flexCharts"/);
  assert.match(html, /assets\/js\/ui\/flex-chart\.js/);
  assert.match(html, /id="flex-psi"/);
});