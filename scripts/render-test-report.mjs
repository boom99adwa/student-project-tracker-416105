import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(await readFile(path.join(root, 'evidence', 'api-test-results.json'), 'utf8'));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const testedAt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(report.testedAt));
const rowHeight = 42;
const height = 220 + report.results.length * rowHeight + 36;
const rows = report.results.map((item, index) => {
  const y = 224 + index * rowHeight;
  const fill = item.passed ? '#eff9f4' : '#fff2f0';
  const color = item.passed ? '#26795e' : '#ad4848';
  const response = JSON.stringify(item.response ?? {}).replace(/\s+/g, ' ');
  const responseText = response.length > 44 ? `${response.slice(0, 41)}…` : response;
  return `<g><rect x="38" y="${y - 22}" width="1324" height="${rowHeight}" rx="6" fill="${fill}"/><text x="54" y="${y + 2}" class="name">${esc(item.name)}</text><text x="300" y="${y + 2}" class="mono">${esc(item.method)} ${esc(item.endpoint)}</text><text x="720" y="${y + 2}" class="mono">${esc(item.expected)}</text><text x="860" y="${y + 2}" class="mono">${esc(item.actual)}</text><text x="1010" y="${y + 2}" class="response">${esc(responseText)}</text><text x="1314" y="${y + 2}" class="badge" fill="${color}">${item.passed ? '✓ PASS' : '× FAIL'}</text></g>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${height}" viewBox="0 0 1400 ${height}" role="img" aria-labelledby="title desc"><title id="title">API test report</title><desc id="desc">${report.summary.passed} of ${report.summary.total} REST API tests passed on ${esc(testedAt)}</desc><style>text{font-family:'Segoe UI',Tahoma,Arial,sans-serif}.title{font-size:25px;font-weight:700;fill:#16323f}.sub{font-size:13px;fill:#71838b}.name{font-size:12px;font-weight:650;fill:#36555f}.mono{font-family:Consolas,monospace;font-size:11px;fill:#48616a}.response{font-family:Consolas,monospace;font-size:9px;fill:#72878e}.badge{font-size:11px;font-weight:700}</style><rect width="1400" height="${height}" rx="16" fill="#f3f7f7"/><rect x="24" y="20" width="1352" height="${height - 40}" rx="14" fill="#fff" stroke="#e4ecec"/><text x="48" y="62" class="title">Project Hub · REST API Test Report</text><text x="48" y="88" class="sub">ทดสอบกับ ${esc(report.baseUrl)} · ${esc(testedAt)} · temporary records cleaned up</text><rect x="1172" y="42" width="164" height="48" rx="12" fill="${report.summary.successful ? '#e7f6ee' : '#fff0ee'}"/><text x="1191" y="72" style="font:700 17px 'Segoe UI';fill:${report.summary.successful ? '#26795e' : '#ad4848'}">${report.summary.passed}/${report.summary.total} ${report.summary.successful ? 'ผ่าน' : 'ผ่าน'}</text><text x="54" y="188" class="sub">กรณีทดสอบ</text><text x="300" y="188" class="sub">METHOD / ENDPOINT</text><text x="720" y="188" class="sub">ผลที่คาด</text><text x="860" y="188" class="sub">ผลที่ได้</text><text x="1010" y="188" class="sub">Response</text>${rows}</svg>`;
await writeFile(path.join(root, 'evidence', 'api-test-report.svg'), `${svg}\n`, 'utf8');
console.log(path.join(root, 'evidence', 'api-test-report.svg'));
