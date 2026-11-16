import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deleteOrder, saveCatalog, saveOrder, setPlanDate, updateOperation, updateStock, workspaceView, WorkspaceError } from './domain.mjs';
import { centers, products, seedWorkspace, todayInSamara } from './seed.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
let database;

function db() {
  if (!database) {
    const path = process.env.RITM_DB || join(project, 'data', 'ritm.sqlite');
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const store = new DatabaseSync(path);
    store.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, content TEXT NOT NULL)');
    const initial = process.env.RITM_SEED === 'empty'
      ? { sequence: 0, planDate: todayInSamara(), orders: [], centers: [], products: [], materials: [], output: [], movements: [], quality: [], history: [] }
      : seedWorkspace();
    store.prepare('INSERT OR IGNORE INTO workspace (id, content) VALUES (1, ?)').run(JSON.stringify(initial));
    database = store;
  }
  return database;
}

function read() {
  const state = JSON.parse(db().prepare('SELECT content FROM workspace WHERE id = 1').get().content);
  return { centers: structuredClone(centers), products: structuredClone(products), output: [], ...state };
}

function transact(action) {
  const store = db();
  store.exec('BEGIN IMMEDIATE');
  try {
    const state = read();
    const resultId = action(state);
    const result = { ...workspaceView(state), resultId };
    store.prepare('UPDATE workspace SET content = ? WHERE id = 1').run(JSON.stringify(state));
    store.exec('COMMIT');
    return result;
  } catch (error) {
    store.exec('ROLLBACK');
    throw error;
  }
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function bodyOf(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16000) throw new WorkspaceError('Запрос слишком велик.', 413);
  }
  try {
    const body = raw ? JSON.parse(raw) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new WorkspaceError('Проверьте формат запроса.');
  }
}

export async function api(request, response) {
  try {
    const route = new URL(request.url, 'http://localhost').pathname;
    const method = request.method;
    if (method === 'GET' && route === '/api/workspace') return json(response, 200, workspaceView(read()));
    if (method === 'POST' && route === '/api/orders') {
      const body = await bodyOf(request);
      return json(response, 201, transact(state => saveOrder(state, body)));
    }
    const order = route.match(/^\/api\/orders\/(\d+)$/);
    if (method === 'PATCH' && order) {
      const body = await bodyOf(request);
      return json(response, 200, transact(state => saveOrder(state, body, order[1])));
    }
    if (method === 'DELETE' && order) return json(response, 200, transact(state => deleteOrder(state, order[1])));
    const operation = route.match(/^\/api\/operations\/([\d-]+)\/(start|report)$/);
    if (method === 'POST' && operation) {
      const body = await bodyOf(request);
      return json(response, 200, transact(state => updateOperation(state, operation[1], operation[2], body)));
    }
    const material = route.match(/^\/api\/materials\/([a-z\d]+)\/movements$/);
    if (method === 'POST' && material) {
      const body = await bodyOf(request);
      return json(response, 200, transact(state => updateStock(state, material[1], body)));
    }
    if (method === 'POST' && route === '/api/plan') {
      const body = await bodyOf(request);
      return json(response, 200, transact(state => setPlanDate(state, body.date)));
    }
    const catalog = route.match(/^\/api\/catalog\/(centers|products|materials)(?:\/([a-z\d]+))?$/);
    if (catalog && ((!catalog[2] && method === 'POST') || (catalog[2] && method === 'PATCH'))) {
      const body = await bodyOf(request);
      return json(response, catalog[2] ? 200 : 201, transact(state => saveCatalog(state, catalog[1], body, catalog[2])));
    }
    json(response, 404, { error: 'Путь не найден.' });
  } catch (error) {
    if (!(error instanceof WorkspaceError)) console.error(error);
    if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Не удалось обработать запрос.' });
  }
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function staticFile(request, response) {
  const dist = join(project, 'dist');
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = resolve(dist, '.' + path);
  if (target !== dist && !target.startsWith(dist + sep)) return json(response, 404, { error: 'Файл не найден.' });
  const file = target !== dist && statSync(target, { throwIfNoEntry: false })?.isFile() ? target : join(dist, 'index.html');
  const ext = extname(file);
  try {
    const data = readFileSync(file);
    response.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    json(response, 404, { error: 'Выполните npm run build перед запуском.' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4280);
  const host = process.env.RITM_HOST || '127.0.0.1';
  createServer((request, response) => {
    if (request.url?.startsWith('/api/')) return api(request, response);
    try {
      staticFile(request, response);
    } catch {
      json(response, 400, { error: 'Некорректный запрос.' });
    }
  }).listen(port, host, () => console.log('Ритм ОКП: http://' + host + ':' + port));
}
