// Dependency-free static file server with live reload, used only for the
// Base44 sandbox preview (`docker-compose.base44.yml`). The app itself is a
// single static index.html, so there is no build step and no package manifest.
//
// It serves the repo directory, injects a tiny live-reload client into HTML
// responses, and pushes a reload over SSE whenever an HTML/CSS/JS file changes.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const RELOAD_CLIENT =
  "<script>(function(){var e=new EventSource('/__dev_reload');" +
  'e.onmessage=function(){location.reload();};})();<\/script>';

const clients = new Set();

function injectReload(html) {
  return html.includes('</body>')
    ? html.replace('</body>', RELOAD_CLIENT + '</body>')
    : html + RELOAD_CLIENT;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__dev_reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  const target = path.join(ROOT, pathname);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    const body = ext === '.html' ? injectReload(data.toString('utf8')) : data;
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  });
});

function notifyReload() {
  for (const client of clients) client.write('data: reload\n\n');
}

try {
  fs.watch(ROOT, { recursive: true }, (_event, filename) => {
    const name = filename ? String(filename) : '';
    if (!name || /\.(html|css|js|mjs)$/i.test(name)) notifyReload();
  });
} catch (err) {
  console.warn('live reload watcher unavailable:', err.message);
}

server.listen(PORT, HOST, () => {
  console.log(`Base44 dev server listening on http://${HOST}:${PORT}`);
});
