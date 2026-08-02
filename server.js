const http = require('http');
const path = require('path');
const fs = require('fs/promises');
const { createReadStream } = require('fs');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STATE_FILE = path.join(DATA_DIR, 'surang-state.json');
const BGM_FILE = path.join(DATA_DIR, 'homepage-bgm.bin');
const PORT = Number(process.argv[2] || process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const BODY_LIMIT = 100 * 1024 * 1024;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function emptyState() {
  return {
    version: 1,
    initialized: false,
    books: [],
    booksUpdatedAt: 0,
    bgm: null,
    updatedAt: 0
  };
}

async function ensureDataDirectory() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readState() {
  try {
    const parsed = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
    return {
      ...emptyState(),
      ...parsed,
      books: Array.isArray(parsed.books) ? parsed.books : [],
      bgm: parsed.bgm && typeof parsed.bgm === 'object' ? parsed.bgm : null
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('저장 데이터를 읽지 못했습니다.', error);
    return emptyState();
  }
}

async function writeState(state) {
  await ensureDataDirectory();
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, limit = BODY_LIMIT) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('요청 데이터가 너무 큽니다.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const body = await readBody(request);
  if (!body.length) return {};
  return JSON.parse(body.toString('utf8'));
}

async function handleApi(request, response, pathname) {
  if (pathname === '/api/state' && request.method === 'GET') {
    sendJson(response, 200, await readState());
    return true;
  }

  if (pathname === '/api/initialize' && request.method === 'POST') {
    const current = await readState();
    if (current.initialized) {
      sendJson(response, 200, current);
      return true;
    }
    const body = await readJson(request);
    const now = Date.now();
    const next = await writeState({
      ...current,
      initialized: true,
      books: Array.isArray(body.books) ? body.books : [],
      booksUpdatedAt: now,
      updatedAt: now
    });
    sendJson(response, 200, next);
    return true;
  }

  if (pathname === '/api/books' && request.method === 'PUT') {
    const body = await readJson(request);
    if (!Array.isArray(body.books)) {
      sendJson(response, 400, { error: 'books 배열이 필요합니다.' });
      return true;
    }
    const current = await readState();
    const now = Date.now();
    const next = await writeState({
      ...current,
      initialized: true,
      books: body.books,
      booksUpdatedAt: now,
      updatedAt: now
    });
    sendJson(response, 200, next);
    return true;
  }

  if (pathname === '/api/bgm' && request.method === 'GET') {
    const state = await readState();
    if (!state.bgm) {
      sendJson(response, 404, { error: '등록된 BGM이 없습니다.' });
      return true;
    }
    try {
      const stat = await fs.stat(BGM_FILE);
      response.writeHead(200, {
        'Content-Type': state.bgm.type || 'audio/mpeg',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(state.bgm.name || 'homepage-bgm.mp3')}`
      });
      createReadStream(BGM_FILE).pipe(response);
    } catch (error) {
      sendJson(response, 404, { error: 'BGM 파일을 찾을 수 없습니다.' });
    }
    return true;
  }

  if (pathname === '/api/bgm' && request.method === 'PUT') {
    const file = await readBody(request);
    if (!file.length) {
      sendJson(response, 400, { error: 'BGM 파일이 비어 있습니다.' });
      return true;
    }
    await ensureDataDirectory();
    await fs.writeFile(BGM_FILE, file);
    const current = await readState();
    const now = Date.now();
    const name = decodeURIComponent(request.headers['x-file-name'] || 'homepage-bgm.mp3');
    const next = await writeState({
      ...current,
      initialized: true,
      bgm: {
        name,
        type: request.headers['content-type'] || 'audio/mpeg',
        size: file.length,
        updatedAt: now
      },
      updatedAt: now
    });
    sendJson(response, 200, next);
    return true;
  }

  if (pathname === '/api/bgm' && request.method === 'DELETE') {
    try {
      await fs.unlink(BGM_FILE);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const current = await readState();
    const now = Date.now();
    const next = await writeState({
      ...current,
      initialized: true,
      bgm: null,
      updatedAt: now
    });
    sendJson(response, 200, next);
    return true;
  }

  return false;
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const absolutePath = path.resolve(ROOT_DIR, `.${decodedPath}`);
  const relativePath = path.relative(ROOT_DIR, absolutePath);
  const firstSegment = relativePath.split(path.sep)[0].toLowerCase();
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    firstSegment === 'data' ||
    firstSegment === '.git'
  ) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    createReadStream(absolutePath).pipe(response);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(request, response, url.pathname);
      if (!handled) sendJson(response, 404, { error: 'API를 찾을 수 없습니다.' });
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, { error: error.message || '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Surang server running at http://localhost:${PORT}`);
});
