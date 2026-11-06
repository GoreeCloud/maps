import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {parsePoint, validPoint, cleanLabel} from '../src/lib/geo.js';

const MAX_BODY = 2_000_000;
const MAX_REQUEST_BYTES = 4096;

class InputError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readJsonRequest(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) {
    throw new InputError(415, 'Send application/json.');
  }
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) {
    throw new InputError(413, 'Request body is too large.');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.byteLength;
    if (total > MAX_REQUEST_BYTES) throw new InputError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new InputError(400, 'Send a JSON object.'); }
}
const JSON_HEADERS = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm'};

function trustedUrl(value, {template = false} = {}) {
  if (!value) return null;
  const text = String(value).trim();
  if (text.length > 300 || /[\s<>"'\\]/.test(text)) throw new Error('Invalid map provider URL');
  let url;
  try { url = new URL(text); } catch { throw new Error('Invalid map provider URL'); }
  const loopback = ['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Map providers must use HTTPS (or local loopback HTTP)');
  if (url.username || url.password || url.hash) throw new Error('Provider URLs cannot contain credentials or fragments');
  if (template && !['{z}','{x}','{y}'].every((part) => text.includes(part))) throw new Error('Tile URL must contain {z}, {x}, and {y}');
  if (!template && (url.search || url.hash)) throw new Error('Provider base URLs cannot include query strings or fragments');
  return url;
}

export function resolveConfig(env = process.env) {
  const geocoder = trustedUrl(env.MAPS_GEOCODER_URL);
  const router = trustedUrl(env.MAPS_ROUTER_URL);
  const tile = trustedUrl(env.MAPS_TILE_URL_TEMPLATE || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {template: true});
  return {
    geocoder, router,
    tileUrl: env.MAPS_TILE_URL_TEMPLATE || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: env.MAPS_TILE_ATTRIBUTION ? cleanLabel(env.MAPS_TILE_ATTRIBUTION).slice(0,120).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') : '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
    provider: env.MAPS_TILE_URL_TEMPLATE ? 'Configured tile provider' : 'OSM development tiles',
    tileOrigin: tile.origin
  };
}

async function limitedJson(response) {
  if (!response.ok) throw new Error('Map data provider returned an error');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body || []) {
    bytes += chunk.byteLength;
    if (bytes > MAX_BODY) {
      await response.body.cancel().catch(() => {});
      throw new Error('Provider response exceeds safety limit');
    }
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Provider response is not valid JSON'); }
}

async function upstreamJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method:'GET', redirect:'error',
    headers:{'Accept':'application/json','User-Agent':'GoreeCloud-Maps-Dev/0.1 (+https://github.com/GoreeCloud/maps)'},
    signal: AbortSignal.timeout(8000)
  });
  return limitedJson(response);
}

function sendJson(res, status, data, extra = {}) {
  res.writeHead(status, {...JSON_HEADERS,...extra}); res.end(JSON.stringify(data));
}

function safeContentPolicy(config) {
  // Map renderer workers are bundled and same origin. No user-provided upstream is included.
  return "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self' " + config.tileOrigin + "; img-src 'self' data: blob: " + config.tileOrigin + "; font-src 'self' data:";
}

export function createMapsServer({env = process.env, fetchImpl = globalThis.fetch, distDir = resolve(process.cwd(), 'dist')} = {}) {
  const config = resolveConfig(env);
  let lastSearchAt = 0;
  const requests = new Map();
  const headers = {
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY',
    'Permissions-Policy':'geolocation=(self), camera=(), microphone=()',
    'Content-Security-Policy':safeContentPolicy(config)
  };
  const withinBudget = (ip) => {
    const now = Date.now();
    if (requests.size > 2000) requests.clear();
    const list = (requests.get(ip) || []).filter((timestamp) => timestamp > now - 60_000);
    if (list.length >= 50) { requests.set(ip, list); return false; }
    list.push(now); requests.set(ip, list); return true;
  };
  return createServer(async (req, res) => {
    for (const [name,value] of Object.entries(headers)) res.setHeader(name, value);
    let url;
    try { url = new URL(req.url || '/', 'http://localhost'); }
    catch { sendJson(res, 400, {error:'Invalid URL'}); return; }
    const path = url.pathname;
    if (path.startsWith('/api/')) {
      if (path === '/api/health' || path === '/api/config') {
        if (req.method !== 'GET') { sendJson(res, 405, {error:'GET required'}, {'Allow':'GET'}); return; }
        if (path === '/api/health') {
          sendJson(res, 200, {ok:true, stage:'development-preview'}); return;
        }
        sendJson(res, 200, {tileUrl:config.tileUrl, attribution:config.attribution, provider:config.provider, search:!!config.geocoder, routing:!!config.router});
        return;
      }
      if (path !== '/api/search' && path !== '/api/route') {
        sendJson(res, 404, {error:'Unknown API endpoint'}); return;
      }
      if (req.method !== 'POST') { sendJson(res, 405, {error:'POST required'}, {'Allow':'POST'}); return; }
      if (url.search) { sendJson(res, 400, {error:'Send search and route inputs in the JSON request body.'}); return; }
      const origin = req.headers.origin;
      let validOrigin = true;
      if (origin) {
        try { validOrigin = new URL(origin).host === req.headers.host; }
        catch { validOrigin = false; }
      }
      if (!validOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
        sendJson(res, 403, {error:'Cross-origin requests are not permitted.'}); return;
      }
      if (!withinBudget(req.socket.remoteAddress || 'unknown')) { sendJson(res, 429, {error:'Too many requests. Try again shortly.'}); return; }
      try {
        const input = await readJsonRequest(req);
        if (path === '/api/search') {
          if (!config.geocoder) { sendJson(res, 503, {error:'Search provider has not been configured.'}); return; }
          const query = typeof input.q === 'string' ? input.q : '';
          if (query.trim().length < 2 || query.length > 120 || /[\u0000-\u001f\u007f]/.test(query)) {
            sendJson(res, 400, {error:'Search must contain 2–120 printable characters.'}); return;
          }
          // Submit-only geocoding, process-wide interval prevents autocomplete-like usage.
          if (Date.now() - lastSearchAt < 1100) { sendJson(res, 429, {error:'Search again in a moment.'}); return; }
          lastSearchAt = Date.now();
          const upstream = new URL('search', config.geocoder);
          upstream.searchParams.set('format','jsonv2'); upstream.searchParams.set('limit','5'); upstream.searchParams.set('q',query.trim());
          const body = await upstreamJson(upstream, fetchImpl);
          if (!Array.isArray(body)) throw new Error('Unexpected search payload');
          const results = body.slice(0,5).map((item) => ({
            name: cleanLabel(item.display_name).slice(0,140),
            lat: Number(item.lat), lon: Number(item.lon)
          })).filter((item) => item.name && validPoint([item.lon,item.lat]));
          sendJson(res, 200, {results}); return;
        }
        if (path === '/api/route') {
          if (!config.router) { sendJson(res, 503, {error:'Routing provider has not been configured.'}); return; }
          const start = parsePoint(input.start);
          const end = parsePoint(input.end);
          if (!start || !end) { sendJson(res, 400, {error:'Provide valid start and end longitude,latitude points.'}); return; }
          if (start[0] === end[0] && start[1] === end[1]) { sendJson(res, 400, {error:'Start and destination must be different.'}); return; }
          const points = [start,end].map((p) => p.join(',')).join(';');
          const upstream = new URL('route/v1/driving/' + points, config.router);
          upstream.searchParams.set('overview','full'); upstream.searchParams.set('geometries','geojson'); upstream.searchParams.set('steps','false');
          const body = await upstreamJson(upstream, fetchImpl);
          const route = body?.routes?.[0];
          const coords = route?.geometry?.coordinates;
          if (body?.code !== 'Ok' || !Array.isArray(coords) || coords.length < 2 || coords.length > 10000 ||
              !coords.every(validPoint) || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) ||
              route.distance < 0 || route.duration < 0) throw new Error('Route not available or invalid');
          sendJson(res, 200, {coordinates:coords, distance:route.distance, duration:route.duration}); return;
        }
        sendJson(res, 404, {error:'Unknown API endpoint'}); return;
      } catch (error) {
        if (error instanceof InputError) {
          sendJson(res, error.status, {error:error.message}); return;
        }
        // Never reflect geocoding queries, coordinates, provider URLs or raw provider errors.
        sendJson(res, 502, {error:'Map data provider is unavailable or returned invalid data.'}); return;
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {'Allow':'GET, HEAD'}); res.end(); return; }
    let decoded;
    try { decoded = decodeURIComponent(path); } catch { sendJson(res, 400, {error:'Invalid file path'}); return; }
    if (decoded.includes('\0') || decoded.includes('\\')) { sendJson(res, 400, {error:'Invalid file path'}); return; }
    const full = resolve(distDir, decoded === '/' ? 'index.html' : '.' + decoded);
    if (!(full === resolve(distDir) || full.startsWith(resolve(distDir) + sep))) { sendJson(res, 403, {error:'Forbidden path'}); return; }
    try {
      const data = await readFile(full);
      res.writeHead(200, {'Content-Type':MIME[extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
      if (req.method === 'HEAD') res.end(); else res.end(data);
    } catch { sendJson(res, 404, {error:'File not found. Run npm run build first.'}); }
  });
}
