import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8000';
const results = [];
const testCode = `SMOKE-${Date.now().toString(36).toUpperCase()}`;
let createdId;

async function request(urlPath, options = {}) {
  const response = await fetch(new URL(urlPath, baseUrl), {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { status: response.status, body };
}

async function test(name, method, endpoint, expectedStatus, operation, check = () => true) {
  try {
    const actual = await operation();
    const passed = actual.status === expectedStatus && check(actual.body);
    const result = {
      name, method, endpoint,
      expected: `HTTP ${expectedStatus}`,
      actual: `HTTP ${actual.status}`,
      passed,
      response: actual.body,
    };
    results.push(result);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${method} ${endpoint}: ${result.actual}`);
    return actual;
  } catch (error) {
    const result = { name, method, endpoint, expected: `HTTP ${expectedStatus}`, actual: 'No response', passed: false, response: { error: error.message } };
    results.push(result);
    console.log(`FAIL ${method} ${endpoint}: ${error.message}`);
    return { status: 0, body: { error: error.message } };
  }
}

try {
  await test('GET project list', 'GET', '/api/projects', 200,
    () => request('/api/projects'), (body) => Array.isArray(body.items) && body.count >= 1);
  await test('GET advisors', 'GET', '/api/advisors', 200,
    () => request('/api/advisors'), (body) => Array.isArray(body) && body.length >= 1);
  await test('GET students', 'GET', '/api/students', 200,
    () => request('/api/students'), (body) => Array.isArray(body) && body.length >= 1);

  const created = await test('POST create project', 'POST', '/api/projects', 201,
    () => request('/api/projects', { method: 'POST', body: JSON.stringify({
      code: testCode, title: 'โครงงานทดสอบ API', description: 'ข้อมูลชั่วคราว',
      status: 'planning', advisorId: 1, startDate: null, endDate: null,
    }) }), (body) => body.code === testCode && Number.isInteger(body.id));
  if (created.status === 201) createdId = created.body.id;

  if (createdId) {
    await test('GET project detail', 'GET', `/api/projects/${createdId}`, 200,
      () => request(`/api/projects/${createdId}`), (body) => body.id === createdId && body.code === testCode);
    await test('GET members for new project', 'GET', `/api/projects/${createdId}/members`, 200,
      () => request(`/api/projects/${createdId}/members`), (body) => Array.isArray(body.items) && body.count === 0);
    await test('POST progress update', 'POST', `/api/projects/${createdId}/progress`, 201,
      () => request(`/api/projects/${createdId}/progress`, { method: 'POST', body: JSON.stringify({
        title: 'ผลทดสอบ API', detail: 'เพิ่มความก้าวหน้าชั่วคราว', percentComplete: 20, createdBy: 1,
      }) }), (body) => body.project_id === createdId && body.percent_complete === 20);
    await test('GET progress history', 'GET', `/api/projects/${createdId}/progress`, 200,
      () => request(`/api/projects/${createdId}/progress`), (body) => body.count === 1 && body.items[0]?.title === 'ผลทดสอบ API');
    await test('PUT update project', 'PUT', `/api/projects/${createdId}`, 200,
      () => request(`/api/projects/${createdId}`, { method: 'PUT', body: JSON.stringify({
        code: testCode, title: 'โครงงานทดสอบ API (แก้ไข)', description: 'ยืนยันการแก้ไข',
        status: 'in_progress', advisorId: 1, startDate: null, endDate: null,
      }) }), (body) => body.title === 'โครงงานทดสอบ API (แก้ไข)' && body.status === 'in_progress');
    await test('DELETE test project', 'DELETE', `/api/projects/${createdId}`, 200,
      () => request(`/api/projects/${createdId}`, { method: 'DELETE' }), (body) => body.deleted === true);
    createdId = undefined;
  } else {
    for (const [name, method, endpoint] of [
      ['GET project detail', 'GET', '/api/projects/{id}'],
      ['PUT update project', 'PUT', '/api/projects/{id}'],
      ['DELETE test project', 'DELETE', '/api/projects/{id}'],
    ]) {
      results.push({ name, method, endpoint, expected: 'not run', actual: 'skipped', passed: false, response: { reason: 'POST setup failed' } });
    }
  }

  await test('Reject missing required fields', 'POST', '/api/projects', 400,
    () => request('/api/projects', { method: 'POST', body: JSON.stringify({ code: '', title: '', advisorId: 1 }) }),
    (body) => Boolean(body.error && body.field));
  await test('Reject duplicate project code', 'POST', '/api/projects', 409,
    () => request('/api/projects', { method: 'POST', body: JSON.stringify({
      code: 'STU-2026-001', title: 'รหัสซ้ำ', description: '', status: 'planning', advisorId: 1,
    }) }), (body) => Boolean(body.error && body.field === 'code'));
  await test('Database health check', 'GET', '/api/health', 200,
    () => request('/api/health'), (body) => body.database === 'connected');
  await test('List project members', 'GET', '/api/projects/1/members', 200,
    () => request('/api/projects/1/members'), (body) => Array.isArray(body.items) && body.items.length > 0);
  await test('List project progress', 'GET', '/api/projects/1/progress', 200,
    () => request('/api/projects/1/progress'), (body) => Array.isArray(body.items) && body.items.length > 0);
} finally {
  if (createdId) {
    await request(`/api/projects/${createdId}`, { method: 'DELETE' }).catch(() => {});
  }
  const passed = results.filter((item) => item.passed).length;
  const report = {
    application: 'Student Project Tracker',
    baseUrl,
    testedAt: new Date().toISOString(),
    summary: { passed, total: results.length, successful: passed === results.length },
    results,
  };
  const evidenceDir = path.join(projectRoot, 'evidence');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, 'api-test-results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`\nResult: ${passed}/${results.length} passed`);
  console.log(`Evidence: ${path.join(evidenceDir, 'api-test-results.json')}`);
  if (passed !== results.length) process.exitCode = 1;
}
