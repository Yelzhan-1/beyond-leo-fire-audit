import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadToolModule } from './helpers/load-tool.mjs';
import { loadAudit } from './helpers/load-engine.mjs';

const R = loadToolModule('assets/js/tool/report-card.js');
const A = loadAudit();

test('buildReportCardModel returns 10 rules and counts', () => {
  const env = A.envById('lander');
  const model = R.buildReportCardModel(A, env, { dest: 'moon', envId: 'lander', subtitle: env.name, siteUrl: 'test.local' });
  assert.equal(model.rules.length, 10);
  assert.equal(model.rules[0].num, 'R01');
  assert.ok(model.counts.breaks >= 0);
  assert.match(model.footer, /NASA PSI/);
  assert.match(model.scenario.line, /kPa/);
  assert.match(model.scenario.line, /O\u2082/);
});

test('countLine omits zero buckets', () => {
  const line = R.countLine({ breaks: 2, weakens: 0, unknown: 1, holds: 0 });
  assert.match(line, /2 breaks/);
  assert.doesNotMatch(line, /weaken/);
  assert.match(line, /1 unknown/);
});