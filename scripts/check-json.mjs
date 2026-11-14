import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const files = ['evidence.json', 'vercel.json', 'package.json'];
let failed = false;

for (const name of files) {
  const file = fileURLToPath(new URL('../' + name, import.meta.url));
  try {
    JSON.parse(readFileSync(file, 'utf8'));
    console.log(name + ': valid JSON');
  } catch (err) {
    failed = true;
    console.error(name + ': INVALID - ' + err.message);
  }
}

if (failed) process.exit(1);
