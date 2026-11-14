import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);

export function loadToolModule(relativePath) {
  const sandbox = { globalThis: {}, module: { exports: {} }, exports: {}, URLSearchParams };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = readFileSync(new URL(relativePath, root), 'utf8');
  vm.runInContext(src, sandbox, { filename: relativePath });
  return sandbox.module.exports;
}