import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadToolModule } from './helpers/load-tool.mjs';

const G = loadToolModule('assets/js/tool/flame-geom.js');

test('flame at 1 g is teardrop and taller than at 0 g sphere', () => {
  const earth = G.flameShape(1, 21);
  const iss = G.flameShape(0, 21);
  assert.equal(earth.mode, 'teardrop');
  assert.equal(iss.mode, 'sphere');
  assert.ok(earth.height > iss.height);
  assert.ok(earth.warmMix > iss.warmMix);
  assert.ok(earth.blueMix < iss.blueMix);
});

test('higher O2 increases brightness at fixed gravity', () => {
  const low = G.flameShape(0.38, 21);
  const high = G.flameShape(0.38, 34);
  assert.ok(high.brightness > low.brightness);
  assert.ok(high.height >= low.height * 0.99);
});