const runButton = document.querySelector('#run-tests');
const resultsBody = document.querySelector('#test-results');
const summary = document.querySelector('#test-summary');
const statusLabels = { planning: 'วางแผน', in_progress: 'กำลังทำ', completed: 'เสร็จแล้ว', on_hold: 'พักไว้' };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

async function callApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  const body = await response.json();
  return { response, body };
}

function appendResult(test) {
  const row = document.createElement('tr');
  row.innerHTML = `<td>${escapeHtml(test.name)}</td><td>${escapeHtml(test.request)}</td><td>${escapeHtml(test.expected)}</td><td class="response-cell">${escapeHtml(test.actual)}</td><td><span class="result-badge ${test.passed ? 'pass' : 'fail'}">${test.passed ? '✓ ผ่าน' : '× ไม่ผ่าน'}</span></td>`;
  resultsBody.append(row);
}

async function runTest(name, request, expectedStatus, operation) {
  try {
    const { response, body } = await operation();
    const passed = expectedStatus === response.status;
    const actual = `HTTP ${response.status} · ${JSON.stringify(body).slice(0, 150)}`;
    const item = { name, request, expected: `HTTP ${expectedStatus}`, actual, passed };
    appendResult(item);
    return { ...item, status: response.status };
  } catch (error) {
    const item = { name, request, expected: `HTTP ${expectedStatus}`, actual: error.message, passed: false };
    appendResult(item);
    return { ...item, status: 0 };
  }
}

async function runAll() {
  runButton.disabled = true;
  runButton.innerHTML = '<span class="spin" aria-hidden="true">◌</span> กำลังทดสอบ…';
  resultsBody.replaceChildren();
  summary.className = 'test-summary';
  summary.innerHTML = '<strong>กำลังทดสอบ</strong><span>รอผลจาก API…</span>';
  const testCode = `TEST-${Date.now().toString(36).toUpperCase()}`;
  let createdId = null;
  const results = [];

  results.push(await runTest('1. อ่านรายการโครงงาน', 'GET /api/projects', 200, () => callApi('/api/projects')));
  const created = await runTest('2. เพิ่มโครงงานทดสอบ', 'POST /api/projects', 201, () => callApi('/api/projects', {
    method: 'POST', body: JSON.stringify({ code: testCode, title: 'โครงงานทดสอบ API', description: 'ข้อมูลชั่วคราวสำหรับตรวจ POST', advisorId: 1, status: 'planning' }),
  }));
  results.push(created);

  if (created.status === 201) {
    try {
      const createdBody = JSON.parse(created.actual.split(' · ')[1]);
      createdId = createdBody.id;
    } catch { /* fallback query finds the unique test code */ }
    if (!createdId) {
      const { body } = await callApi(`/api/projects?q=${encodeURIComponent(testCode)}`);
      createdId = body.items?.find((item) => item.code === testCode)?.id;
    }
  }

  if (createdId) {
    results.push(await runTest('3. อ่านโครงงานรายรายการ', `GET /api/projects/${createdId}`, 200, () => callApi(`/api/projects/${createdId}`)));
    results.push(await runTest('4. แก้ไขโครงงาน', `PUT /api/projects/${createdId}`, 200, () => callApi(`/api/projects/${createdId}`, {
      method: 'PUT', body: JSON.stringify({ code: testCode, title: 'โครงงานทดสอบ API (แก้ไข)', description: 'ตรวจการแก้ไขข้อมูล', advisorId: 1, status: 'in_progress', startDate: null, endDate: null }),
    })));
    results.push(await runTest('5. ลบโครงงานทดสอบ', `DELETE /api/projects/${createdId}`, 200, () => callApi(`/api/projects/${createdId}`, { method: 'DELETE' })));
  } else {
    for (const [name, request] of [
      ['3. อ่านโครงงานรายรายการ', 'GET /api/projects/{id}'],
      ['4. แก้ไขโครงงาน', 'PUT /api/projects/{id}'],
      ['5. ลบโครงงานทดสอบ', 'DELETE /api/projects/{id}'],
    ]) {
      const item = { name, request, expected: '—', actual: 'ข้ามเพราะเพิ่มข้อมูลทดสอบไม่สำเร็จ', passed: false };
      appendResult(item); results.push(item);
    }
  }

  results.push(await runTest('6. ปฏิเสธข้อมูลไม่ครบ', 'POST /api/projects', 400, () => callApi('/api/projects', {
    method: 'POST', body: JSON.stringify({ code: '', title: '', advisorId: 1 }),
  })));

  const passed = results.filter((result) => result.passed).length;
  const allPassed = passed === results.length;
  summary.className = `test-summary ${allPassed ? 'pass' : 'fail'}`;
  summary.innerHTML = `<strong>${allPassed ? 'ผ่านครบทุกกรณี' : 'มีกรณีที่ไม่ผ่าน'}</strong><span>${passed}/${results.length} กรณี · ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}</span>`;
  runButton.disabled = false;
  runButton.innerHTML = '↻ ทดสอบอีกครั้ง';
  const health = await callApi('/api/health');
  document.querySelector('#db-status').textContent = `${health.body.database === 'connected' ? 'เชื่อมต่อแล้ว' : 'ไม่พร้อมใช้งาน'} · ${health.body.projectCount} โครงงาน`;
}

runButton.addEventListener('click', runAll);
callApi('/api/health').then(({ body }) => {
  document.querySelector('#db-status').textContent = `${body.database === 'connected' ? 'เชื่อมต่อแล้ว' : 'ไม่พร้อมใช้งาน'} · ${body.projectCount} โครงงาน`;
}).catch(() => { document.querySelector('#db-status').textContent = 'เชื่อมต่อไม่ได้'; });
