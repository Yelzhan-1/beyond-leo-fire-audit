import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);

/* Load the DOM-free engine into a fresh node:vm context and return window.AUDIT. */
export function loadAudit() {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((code) => /root\.AUDIT\s*=/.test(code));
  if (blocks.length !== 1) throw new Error('expected exactly one engine <script> block defining root.AUDIT');
  const sandbox = { window: {} };
  vm.runInNewContext(blocks[0], sandbox, { filename: 'index.html[engine]' });
  return sandbox.window.AUDIT;
}
