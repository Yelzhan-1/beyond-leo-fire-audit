#!/usr/bin/env node
/* Tiny static server for local work: npm start  (PORT=8080 npm start to change the port).
   Mirrors Vercel's cleanUrls: /audit serves audit.html, /audit.html redirects to /audit, unknown paths get 404.html. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('.html')) {
    res.writeHead(308, { Location: (path.replace(/\.html$/, '').replace(/\/index$/, '/') || '/') + url.search });
    return res.end();
  }
  if (path.endsWith('/')) path += 'index';
  const base = normalize(join(root, path));
  if (base !== root.replace(/[\\/]$/, '') && !base.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  const hidden = base.slice(root.length).split(sep).some((s) => s.startsWith('.') || s === 'node_modules' || s === 'tests' || s === 'scripts');
  let file = null;
  if (!hidden) for (const c of [base, base + '.html']) if (await isFile(c)) { file = c; break; }
  let status = 200;
  if (!file) { file = join(root, '404.html'); status = 404; }
  try {
    const body = await readFile(file);
    res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`Serving http://localhost:${port}  (clean URLs on)`));
