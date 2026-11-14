import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAudit } from './helpers/load-engine.mjs';

const evidence = JSON.parse(readFileSync(new URL('../evidence.json', import.meta.url), 'utf8'));
const A = loadAudit();

const STATUSES = ['holds', 'weakens', 'breaks', 'unknown'];

test('window.AUDIT exists with 10 rows and the expected environments', () => {
  assert.ok(A, 'window.AUDIT is defined');
  assert.equal(A.ROWS.length, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(A.ENVS.map((e) => e.id))), ['iss', 'orion', 'lander', 'rover', 'mars']);
});

test('verdict is holds/weakens/breaks/unknown for every row x environment', () => {
  for (const env of A.ENVS) {
    for (const row of A.ROWS) {
      const v = A.evaluate(row.id, env);
      assert.ok(STATUSES.includes(v.status), `${row.id} x ${env.id} -> ${v.status}`);
    }
  }
});

test('evidence references existing sources, rows and investigations', () => {
  const rowIds = new Set(A.ROWS.map((r) => r.id));
  assert.ok(A.EVIDENCE.length > 0);
  for (const ev of A.EVIDENCE) {
    assert.ok(A.SOURCES[ev.src], `evidence ${ev.id}: unknown source "${ev.src}"`);
    assert.ok(rowIds.has(ev.row), `evidence ${ev.id}: unknown row "${ev.row}"`);
    if (ev.inv) assert.ok(A.INV[ev.inv], `evidence ${ev.id}: unknown investigation "${ev.inv}"`);
  }
});

test('exportData() matches evidence.json', () => {
  const exported = JSON.parse(JSON.stringify(A.exportData()));
  assert.deepEqual(exported, evidence);
});