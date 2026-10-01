const statusLabels = {
  planning: 'วางแผน',
  in_progress: 'กำลังทำ',
  completed: 'เสร็จแล้ว',
  on_hold: 'พักไว้',
};

const form = document.querySelector('#project-form');
const formMessage = document.querySelector('#form-message');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#search-input');
const statusFilter = document.querySelector('#status-filter');
let allProjects = [];
let advisors = [];
let searchTimer;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function statusBadge(status) {
  return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabels[status] || status)}</span>`;
}

function renderProjects(items) {
  projectList.setAttribute('aria-busy', 'false');
  emptyState.hidden = items.length !== 0;
  projectList.innerHTML = items.map((project) => {
    const progress = Math.max(0, Math.min(100, Number(project.progress || 0)));
    return `<article class="project-card" data-id="${Number(project.id)}">
      <div class="project-main">
        <div class="project-code"><span>${escapeHtml(project.code)}</span>${statusBadge(project.status)}</div>
        <h3 title="${escapeHtml(project.title)}">${escapeHtml(project.title)}</h3>
        <p class="project-desc" title="${escapeHtml(project.description)}">${escapeHtml(project.description || 'ยังไม่มีรายละเอียด')}</p>
        <div class="project-meta"><span>♙ ${Number(project.member_count || 0)} คน</span><span>⌖ ${escapeHtml(project.advisor_name || 'ยังไม่กำหนด')}</span></div>
      </div>
      <div class="progress-wrap"><div class="progress-label"><span>ความก้าวหน้า</span><strong>${progress}%</strong></div><progress class="progress-native" value="${progress}" max="100" aria-label="ความก้าวหน้า: ${progress}%"></progress></div>
      <div class="card-actions"><button class="icon-button edit-project" type="button" aria-label="แก้ไข ${escapeHtml(project.title)}" title="แก้ไข">✎</button><button class="icon-button delete delete-project" type="button" aria-label="ลบ ${escapeHtml(project.title)}" title="ลบ">×</button></div>
    </article>`;
  }).join('');
  projectList.querySelectorAll('.edit-project').forEach((button) => button.addEventListener('click', () => startEdit(Number(button.closest('[data-id]').dataset.id))));
  projectList.querySelectorAll('.delete-project').forEach((button) => button.addEventListener('click', () => removeProject(Number(button.closest('[data-id]').dataset.id))));
  document.querySelector('#project-count').textContent = `${items.length} โครงงาน${items.length === 0 ? '' : 'ในรายการ'}`;
}

function renderStats(items, students) {
  document.querySelector('#stat-total').textContent = items.length;
  document.querySelector('#stat-active').textContent = items.filter((item) => item.status === 'in_progress').length;
  document.querySelector('#stat-completed').textContent = items.filter((item) => item.status === 'completed').length;
  document.querySelector('#stat-students').textContent = students;
}

async function loadData() {
  projectList.setAttribute('aria-busy', 'true');
  try {
    const [health, projects, advisorList, students] = await Promise.all([
      requestJson('/api/health'),
      requestJson('/api/projects'),
      requestJson('/api/advisors'),
      requestJson('/api/students'),
    ]);
    allProjects = projects.items;
    advisors = advisorList;
    document.querySelector('#db-status').textContent = `${health.database === 'connected' ? 'เชื่อมต่อแล้ว' : 'ไม่พร้อมใช้งาน'} · ${health.projectCount} โครงงาน`;
    document.querySelector('.note-dot').style.background = health.database === 'connected' ? '#5ed0ae' : '#e67b70';
    document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date());
    fillAdvisors(advisors);
    renderStats(allProjects, students.length);
    applyFilters();
  } catch (error) {
    projectList.setAttribute('aria-busy', 'false');
    projectList.innerHTML = `<div class="empty-state"><strong>โหลดข้อมูลไม่สำเร็จ</strong><p>${escapeHtml(error.message)}</p></div>`;
    document.querySelector('#db-status').textContent = 'เชื่อมต่อไม่ได้';
  }
}

function fillAdvisors(list, selectedId) {
  const select = document.querySelector('#project-advisor');
  const current = selectedId ?? select.value;
  select.innerHTML = '<option value="">เลือกอาจารย์ที่ปรึกษา</option>' + list.map((advisor) => `<option value="${Number(advisor.id)}">${escapeHtml(advisor.name)}</option>`).join('');
  if (current) select.value = String(current);
}

function applyFilters() {
  const q = searchInput.value.trim().toLocaleLowerCase('th');
  const status = statusFilter.value;
  const filtered = allProjects.filter((project) => {
    const matchesQuery = !q || `${project.title} ${project.code}`.toLocaleLowerCase('th').includes(q);
    return matchesQuery && (!status || project.status === status);
  });
  renderProjects(filtered);
}

function clearForm() {
  form.reset();
  document.querySelector('#project-id').value = '';
  document.querySelector('#form-title').textContent = 'เพิ่มโครงงานใหม่';
  document.querySelector('#save-project').innerHTML = 'บันทึกโครงงาน <span aria-hidden="true">→</span>';
  document.querySelector('#cancel-edit').hidden = true;
  fillAdvisors(advisors);
  formMessage.textContent = '';
  formMessage.classList.remove('error');
}

function startEdit(id) {
  const project = allProjects.find((item) => item.id === id);
  if (!project) return;
  document.querySelector('#project-id').value = String(id);
  document.querySelector('#project-code').value = project.code;
  document.querySelector('#project-title').value = project.title;
  document.querySelector('#project-description').value = project.description || '';
  fillAdvisors(advisors, project.advisor_id);
  document.querySelector('#project-status').value = project.status;
  document.querySelector('#project-start').value = project.start_date || '';
  document.querySelector('#project-end').value = project.end_date || '';
  document.querySelector('#form-title').textContent = 'แก้ไขโครงงาน';
  document.querySelector('#save-project').innerHTML = 'บันทึกการแก้ไข <span aria-hidden="true">→</span>';
  document.querySelector('#cancel-edit').hidden = false;
  formMessage.textContent = `กำลังแก้ไข ${project.code}`;
  formMessage.classList.remove('error');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function removeProject(id) {
  const project = allProjects.find((item) => item.id === id);
  if (!project || !window.confirm(`ลบโครงงาน “${project.title}” ใช่หรือไม่? ข้อมูลความก้าวหน้าของโครงงานนี้จะถูกลบด้วย`)) return;
  try {
    await requestJson(`/api/projects/${id}`, { method: 'DELETE' });
    await loadData();
    formMessage.textContent = 'ลบโครงงานแล้ว';
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add('error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';
  formMessage.classList.remove('error');
  const id = document.querySelector('#project-id').value;
  const payload = {
    code: document.querySelector('#project-code').value,
    title: document.querySelector('#project-title').value,
    description: document.querySelector('#project-description').value,
    advisorId: Number(document.querySelector('#project-advisor').value),
    status: document.querySelector('#project-status').value,
    startDate: document.querySelector('#project-start').value || null,
    endDate: document.querySelector('#project-end').value || null,
  };
  const save = document.querySelector('#save-project');
  save.disabled = true;
  try {
    await requestJson(id ? `/api/projects/${id}` : '/api/projects', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    clearForm();
    await loadData();
    formMessage.textContent = id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มโครงงานแล้ว';
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add('error');
  } finally {
    save.disabled = false;
  }
});

document.querySelector('#new-project-button').addEventListener('click', () => {
  clearForm();
  document.querySelector('#project-code').focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#cancel-edit').addEventListener('click', clearForm);
searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(applyFilters, 140);
});
statusFilter.addEventListener('change', applyFilters);

loadData();
