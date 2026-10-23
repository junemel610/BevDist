const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { webURL } = require('./settings.cjs');

// Test a production web export: SDK 57's development env module also reads local .env files.
const build = spawn(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'dist/playwright-web'], { stdio: 'inherit' });
build.on('error', error => { console.error(error.message); process.exit(1); });
build.on('exit', code => {
  if (code !== 0) process.exit(code || 1);
  const root = path.resolve('dist/playwright-web');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
  const server = createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, webURL).pathname);
      const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const contents = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch { res.writeHead(404).end(); }
  });
  server.listen(Number(new URL(webURL).port), '127.0.0.1');
  server.on('error', error => { console.error(error.message); process.exit(1); });
  process.once('SIGTERM', () => server.close());
  process.once('SIGINT', () => server.close());
});
