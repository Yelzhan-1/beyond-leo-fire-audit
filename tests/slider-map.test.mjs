import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAudit } from './helpers/load-engine.mjs';
import { loadToolModule } from './helpers/load-tool.mjs';

const S = loadToolModule('assets/js/tool/scenario.js');

const A = loadAudit();

test('slider bounds match audit builder pressure and oxygen range', () => {
  assert.equal(S.SLIDER.p.min, 30);
  assert.equal(S.SLIDER.p.max, 101.3);
  assert.equal(S.SLIDER.o2.min, 15);
  assert.equal(S.SLIDER.o2.max, 40);
});

test('slider values map into fields the engine accepts', () => {
  const base = A.envById('lander');
  const parsed = { g: 0.38, p: 70, o2: 26.5 };
  const env = S.applyScenarioToEnv(base, parsed);
  const v = A.evaluate('mat', env);
  assert.ok(['holds', 'weakens', 'breaks', 'unknown'].includes(v.status));
  assert.equal(env.g, 0.38);
  assert.equal(env.p, 70);
  assert.equal(env.o2, 26.5);
});