import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadToolModule } from './helpers/load-tool.mjs';

const S = loadToolModule('assets/js/tool/scenario.js');

test('parseScenarioQuery reads d, g, p, o2 and legacy env', () => {
  const a = S.parseScenarioQuery('?d=moon&g=0.16&p=56.5&o2=34');
  assert.equal(a.dest, 'moon');
  assert.equal(a.envId, 'lander');
  assert.equal(a.g, 0.16);
  assert.equal(a.p, 56.5);
  assert.equal(a.o2, 34);

  const b = S.parseScenarioQuery('?env=rover&row=vent');
  assert.equal(b.envId, 'rover');
  assert.equal(b.row, 'vent');
});

test('serializeScenario omits values that match the preset', () => {
  const preset = { g: 0.16, p: 56.5, o2: 34 };
  const q = S.serializeScenario({ dest: 'moon', envId: 'lander', g: 0.16, p: 56.5, o2: 34 }, preset);
  assert.match(q, /d=moon/);
  assert.doesNotMatch(q, /g=/);
  assert.doesNotMatch(q, /p=/);
  assert.doesNotMatch(q, /o2=/);
});

test('serializeScenario includes overrides', () => {
  const preset = { g: 0.16, p: 56.5, o2: 34 };
  const q = S.serializeScenario({ dest: 'custom', envId: 'custom', g: 0.38, p: 56.5, o2: 34 }, preset);
  assert.match(q, /g=0\.38/);
});

test('matchPresetId returns lander for lunar defaults', () => {
  const envs = [{ id: 'iss', g: 0, p: 101.3, o2: 21, v: 1005, dust: false, beyond: false },
    { id: 'lander', g: 0.16, p: 56.5, o2: 34, v: 17, dust: true, beyond: true }];
  const live = { g: 0.16, p: 56.5, o2: 34, v: 17, dust: true, beyond: true };
  assert.equal(S.matchPresetId(live, envs, null), 'lander');
});