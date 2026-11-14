import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadToolModule } from './helpers/load-tool.mjs';

const S = loadToolModule('assets/js/tool/scenario.js');

test('buildShareUrl includes compare params when requested', () => {
  const url = S.buildShareUrl('https://example.test', '/', {
    dest: 'mars',
    envId: 'mars',
    g: 0.38,
    p: 56.5,
    o2: 34
  }, { g: 0.38, p: 56.5, o2: 34 }, {
    dest: 'iss',
    envId: 'iss',
    g: 0,
    p: 101.3,
    o2: 21
  }, { g: 0, p: 101.3, o2: 21 });
  assert.match(url, /^https:\/\/example\.test\/\?/);
  assert.match(url, /d=mars/);
  assert.match(url, /cmp=iss/);
  assert.doesNotMatch(url, /cg=/);
});

test('serializeCompare encodes custom overrides', () => {
  const q = S.serializeCompare({ dest: 'custom', envId: 'custom', g: 0, p: 56.5, o2: 34 }, { g: 0.16, p: 56.5, o2: 34 });
  assert.match(q, /cmp=custom/);
  assert.match(q, /cg=0/);
});