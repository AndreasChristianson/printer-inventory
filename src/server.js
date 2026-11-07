// Public, read-only front for Spoolman. Only ever issues GETs upstream, and only
// exposes the grouped filament list, never Spoolman's own API.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { groupSpools } from './filaments.js';

const PORT = Number(process.env.PORT ?? 8080);
const SPOOLMAN_URL = (process.env.SPOOLMAN_URL ?? 'http://spoolman.spoolman.svc:8000').replace(/\/$/, '');
const CACHE_MS = Number(process.env.CACHE_SECONDS ?? 60) * 1000;

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
// Fixed allowlist, so request paths never touch the filesystem directly.
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

let cache = { at: 0, body: null };

async function filaments() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  const res = await fetch(`${SPOOLMAN_URL}/api/v1/spool?allow_archived=false`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Spoolman responded ${res.status}`);
  const body = JSON.stringify({ updatedAt: new Date().toISOString(), filaments: groupSpools(await res.json()) });
  cache = { at: Date.now(), body };
  return body;
}

const send = (res, status, type, body, extra = {}) => {
  res.writeHead(status, { 'content-type': type, 'x-content-type-options': 'nosniff', ...extra });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain', 'read only', { allow: 'GET, HEAD' });
  }
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/healthz') return send(res, 200, 'text/plain', 'ok');

  if (pathname === '/api/filaments') {
    try {
      return send(res, 200, 'application/json', await filaments(), { 'cache-control': 'public, max-age=60' });
    } catch (err) {
      console.error('spoolman fetch failed:', err.message);
      // Serve stale data rather than nothing if Spoolman blips.
      if (cache.body) return send(res, 200, 'application/json', cache.body);
      return send(res, 502, 'application/json', JSON.stringify({ error: 'inventory unavailable' }));
    }
  }

  const entry = STATIC[pathname];
  if (!entry) return send(res, 404, 'text/plain', 'not found');
  try {
    send(res, 200, entry[1], await readFile(path.join(publicDir, entry[0])));
  } catch {
    send(res, 500, 'text/plain', 'error');
  }
});

server.listen(PORT, () => console.log(`listening on :${PORT}, spoolman at ${SPOOLMAN_URL}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
