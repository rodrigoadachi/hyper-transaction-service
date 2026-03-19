import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const host = '0.0.0.0';
const port = Number(process.env.PORT || process.env.WEB_PORT || 3000);
const apiUrl = process.env.API_URL || 'http://localhost:3333';
const distDir = resolve(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function setSecurityHeaders(response) {
  response.setHeader('Referrer-Policy', 'strict-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function sendFile(response, filePath, cacheControl) {
  const extension = extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream');
  response.setHeader('Cache-Control', cacheControl);
  setSecurityHeaders(response);
  createReadStream(filePath).pipe(response);
}

async function proxyApiRequest(request, response) {
  console.log('request::', request)
  const incomingUrl = request.url || '/';
  const rewrittenPath = incomingUrl.replace(/^\/api(?=\/|$)/, '') || '/';
  const targetUrl = new URL(rewrittenPath, apiUrl);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
      continue;
    }
    headers.set(key, value);
  }

  headers.set('host', targetUrl.host);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request : undefined,
    duplex: hasBody ? 'half' : undefined,
  });

  response.statusCode = upstreamResponse.status;

  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    response.setHeader(key, value);
  });

  setSecurityHeaders(response);

  if (!upstreamResponse.body) {
    response.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    response.write(Buffer.from(value));
  }
  response.end();
}

const server = createServer(async (request, response) => {
  const requestPath = request.url ? request.url.split('?')[0] : '/';

  if (requestPath === '/health') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    response.end('ok');
    return;
  }

  if (requestPath.startsWith('/api')) {
    try {
      await proxyApiRequest(request, response);
    } catch {
      response.statusCode = 502;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      setSecurityHeaders(response);
      response.end(JSON.stringify({ message: 'Bad Gateway' }));
    }
    return;
  }

  const normalizedPath = normalize(requestPath).replace(/^\/+/, '');
  const candidatePath = resolve(distDir, normalizedPath);

  try {
    if (normalizedPath && candidatePath.startsWith(distDir) && existsSync(candidatePath)) {
      const fileStats = await stat(candidatePath);
      if (fileStats.isFile()) {
        const isHashedAsset = normalizedPath.startsWith('assets/');
        sendFile(
          response,
          candidatePath,
          isHashedAsset
            ? 'public, max-age=31536000, immutable'
            : 'no-store, no-cache, must-revalidate',
        );
        return;
      }
    }

    sendFile(response, indexPath, 'no-store, no-cache, must-revalidate');
  } catch {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('internal server error');
  }
});

server.listen(port, host, () => {
  console.log(`Web server listening on http://${host}:${port}`);
});