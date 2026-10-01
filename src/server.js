import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db, dbPath, projectRoot, projectById, projectDetails } from './db.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8000);
const WEB_DIR = path.join(projectRoot, 'public');
const VALID_STATUSES = new Set(['planning', 'in_progress', 'completed', 'on_hold']);
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/api-tests', ['api-tests.html', 'text/html; charset=utf-8']],
  ['/api-tests.html', ['api-tests.html', 'text/html; charset=utf-8']],
  ['/api-tests.js', ['api-tests.js', 'text/javascript; charset=utf-8']],
  ['/assets/erd.svg', ['assets/erd.svg', 'image/svg+xml']],
]);

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body, null, 2));
}

function fail(status, message, field) {
  const error = new Error(message);
  error.status = status;
  error.field = field;
  throw error;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) fail(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  if (!size) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    fail(400, 'Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'Request body must be a JSON object.');
  return parsed;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) fail(400, `${field} is required.`, field);
  const text = value.trim();
  if (text.length > maxLength) fail(400, `${field} must be ${maxLength} characters or fewer.`, field);
  return text;
}

function optionalText(value, field, maxLength) {
  if (value == null) return '';
  if (typeof value !== 'string') fail(400, `${field} must be text.`, field);
  const text = value.trim();
  if (text.length > maxLength) fail(400, `${field} must be ${maxLength} characters or fewer.`, field);
  return text;
}

function validDate(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    fail(400, `${field} must use YYYY-MM-DD format.`, field);
  }
  return value;
}

function normalizeProject(body) {
  const code = requiredText(body.code, 'code', 24).toUpperCase();
  const title = requiredText(body.title, 'title', 120);
  const description = optionalText(body.description, 'description', 1000);
  const status = body.status ?? 'planning';
  if (!VALID_STATUSES.has(status)) fail(400, 'status is not supported.', 'status');
  const advisorId = Number(body.advisorId);
  if (!Number.isInteger(advisorId) || advisorId < 1) fail(400, 'advisorId must be a positive integer.', 'advisorId');
  const advisor = db.prepare('SELECT id FROM advisors WHERE id = ?').get(advisorId);
  if (!advisor) fail(400, 'advisorId does not match an existing advisor.', 'advisorId');
  const startDate = validDate(body.startDate, 'startDate');
  const endDate = validDate(body.endDate, 'endDate');
  if (startDate && endDate && endDate < startDate) fail(400, 'endDate must be on or after startDate.', 'endDate');
  return { code, title, description, status, advisorId, startDate, endDate };
}

async function serveStatic(pathname, res) {
  const file = STATIC_FILES.get(pathname);
  if (!file) return false;
  const [relativePath, contentType] = file;
  const filePath = path.join(WEB_DIR, relativePath);
  try {
    const content = await readFile(filePath);
    const contentSecurityPolicy = contentType === 'image/svg+xml'
      ? "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"
      : "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
    res.writeHead(200, {
      'content-type': contentType,
      'content-length': content.length,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'content-security-policy': contentSecurityPolicy,
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

function requireId(value) {
  if (!/^\d+$/.test(value)) fail(400, 'id must be a positive integer.', 'id');
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) fail(400, 'id must be a positive integer.', 'id');
  return id;
}

async function handleApi(req, res, pathname, searchParams) {
  if (pathname === '/api/health' && req.method === 'GET') {
    const database = db.prepare('SELECT COUNT(*) AS projects FROM projects').get();
    return sendJson(res, 200, { status: 'ok', database: 'connected', projectCount: database.projects });
  }

  if (pathname === '/api/advisors' && req.method === 'GET') {
    return sendJson(res, 200, db.prepare('SELECT id, name, email, department FROM advisors ORDER BY name').all());
  }

  if (pathname === '/api/students' && req.method === 'GET') {
    return sendJson(res, 200, db.prepare('SELECT id, student_no, name, email, program, year_level FROM students ORDER BY student_no').all());
  }

  if (pathname === '/api/projects' && req.method === 'GET') {
    const conditions = [];
    const values = [];
    const status = searchParams.get('status');
    const query = searchParams.get('q')?.trim();
    if (status) {
      if (!VALID_STATUSES.has(status)) fail(400, 'status is not supported.', 'status');
      conditions.push('p.status = ?'); values.push(status);
    }
    if (query) {
      conditions.push('(p.title LIKE ? OR p.code LIKE ?)');
      values.push(`%${query}%`, `%${query}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT p.*, a.name AS advisor_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
        (SELECT percent_complete FROM progress_updates pu WHERE pu.project_id = p.id ORDER BY recorded_at DESC, id DESC LIMIT 1) AS progress
      FROM projects p JOIN advisors a ON a.id = p.advisor_id ${where}
      ORDER BY p.updated_at DESC, p.id DESC`).all(...values);
    return sendJson(res, 200, { items: rows, count: rows.length });
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    const body = await readJson(req);
    const project = normalizeProject(body);
    let result;
    try {
      result = db.prepare(`INSERT INTO projects
        (code, title, description, status, advisor_id, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(project.code, project.title, project.description, project.status, project.advisorId,
          project.startDate, project.endDate);
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed: projects.code')) {
        fail(409, 'A project with this code already exists.', 'code');
      }
      throw error;
    }
    return sendJson(res, 201, projectDetails(Number(result.lastInsertRowid)));
  }

  const projectIdMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
  if (projectIdMatch) {
    const id = requireId(projectIdMatch[1]);
    if (req.method === 'GET') {
      const project = projectDetails(id);
      if (!project) fail(404, 'Project not found.');
      return sendJson(res, 200, project);
    }
    if (req.method === 'POST' || req.method === 'PATCH') fail(405, 'Use PUT to update a project.');
    if (req.method === 'PUT') {
      if (!projectById(id)) fail(404, 'Project not found.');
      const body = await readJson(req);
      const project = normalizeProject(body);
      try {
        db.prepare(`UPDATE projects SET code = ?, title = ?, description = ?, status = ?,
          advisor_id = ?, start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(project.code, project.title, project.description, project.status, project.advisorId,
            project.startDate, project.endDate, id);
      } catch (error) {
        if (String(error.message).includes('UNIQUE constraint failed: projects.code')) {
          fail(409, 'A project with this code already exists.', 'code');
        }
        throw error;
      }
      return sendJson(res, 200, projectDetails(id));
    }
    if (req.method === 'DELETE') {
      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      if (!result.changes) fail(404, 'Project not found.');
      return sendJson(res, 200, { deleted: true, id });
    }
  }

  const membersMatch = pathname.match(/^\/api\/projects\/(\d+)\/members$/);
  if (membersMatch && req.method === 'GET') {
    const id = requireId(membersMatch[1]);
    if (!projectById(id)) fail(404, 'Project not found.');
    const members = db.prepare(`SELECT s.id, s.student_no, s.name, s.program, pm.role, pm.joined_at
      FROM project_members pm JOIN students s ON s.id = pm.student_id
      WHERE pm.project_id = ? ORDER BY s.student_no`).all(id);
    return sendJson(res, 200, { projectId: id, items: members, count: members.length });
  }

  const progressMatch = pathname.match(/^\/api\/projects\/(\d+)\/progress$/);
  if (progressMatch) {
    const id = requireId(progressMatch[1]);
    if (!projectById(id)) fail(404, 'Project not found.');
    if (req.method === 'GET') {
      const items = db.prepare(`SELECT pu.id, pu.title, pu.detail, pu.percent_complete, pu.recorded_at,
          s.id AS created_by, s.name AS created_by_name
        FROM progress_updates pu LEFT JOIN students s ON s.id = pu.created_by
        WHERE pu.project_id = ? ORDER BY pu.recorded_at DESC, pu.id DESC`).all(id);
      return sendJson(res, 200, { projectId: id, items, count: items.length });
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const title = requiredText(body.title, 'title', 120);
      const detail = optionalText(body.detail, 'detail', 1000);
      const percent = Number(body.percentComplete);
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) fail(400, 'percentComplete must be an integer from 0 to 100.', 'percentComplete');
      let createdBy = null;
      if (body.createdBy != null && body.createdBy !== '') {
        createdBy = Number(body.createdBy);
        if (!Number.isInteger(createdBy) || !db.prepare('SELECT id FROM students WHERE id = ?').get(createdBy)) {
          fail(400, 'createdBy must match an existing student.', 'createdBy');
        }
      }
      const result = db.prepare(`INSERT INTO progress_updates (project_id, title, detail, percent_complete, created_by)
        VALUES (?, ?, ?, ?, ?)`).run(id, title, detail, percent, createdBy);
      const item = db.prepare(`SELECT id, project_id, title, detail, percent_complete, recorded_at, created_by
        FROM progress_updates WHERE id = ?`).get(Number(result.lastInsertRowid));
      return sendJson(res, 201, item);
    }
  }

  return false;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url.pathname, url.searchParams);
      if (handled !== false) return;
      return sendJson(res, 404, { error: 'Endpoint not found.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    if (await serveStatic(url.pathname, res)) return;
    return sendJson(res, 404, { error: 'Page not found.' });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status === 500) console.error(error);
    const body = { error: status === 500 ? 'Internal server error.' : error.message };
    if (error.field) body.field = error.field;
    return sendJson(res, status, body);
  }
}

const server = createServer((req, res) => { void handleRequest(req, res); });
server.listen(PORT, HOST, () => {
  console.log(`Project Tracker running at http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${dbPath}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

