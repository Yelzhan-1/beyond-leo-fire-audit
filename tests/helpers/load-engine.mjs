import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const root = new URL('../../', import.meta.url);

/* Scripts that make up the DOM-free engine, in load order.
   tests/pages.test.mjs checks that every page that uses the engine loads exactly these. */
export const ENGINE_SCRIPTS = [
  'assets/js/data/sources.js',
  'assets/js/data/investigations.js',
  'assets/js/data/environments.js',
  'assets/js/engine.js'
];

/* Load the engine into a fresh node:vm context and return window.AUDIT. */
export function loadAudit() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const file of ENGINE_SCRIPTS) {
    vm.runInContext(readFileSync(new URL(file, root), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.window.AUDIT;
}
