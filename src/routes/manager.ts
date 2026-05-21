import { Hono } from 'hono';
import type { Env, NhanVien } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, tableRow, tableEmpty, tableActions, btnPrimary, btnSecondary } from '../utils/ui';

export const managerRoutes = new Hono<{ Bindings: Env }>();

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return d.slice(0, 10);
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', ketoanTruong: 'Kế toán trưởng', ketoanVien: 'Kế toán viên',
  nhanvien: 'Nhân viên', kho: 'Thủ kho', laixe: 'Lái xe',
};
const ROLE_TAG: Record<string, string> = {
  admin: 'bg-lightprimary text-primary', ketoanTruong: 'bg-lightprimary text-primary',
  ketoanVien: 'bg-lightinfo text-info', nhanvien: 'bg-lightgray text-bodytext',
  kho: 'bg-lightwarning text-warning', laixe: 'bg-lightsuccess text-success',
};

managerRoutes.get('/', async (c) => {
  const user = c.get('user');

  const countTables = [
    { label: 'Khách hàng', sql: 'SELECT COUNT(*) as c FROM khach_hang' },
    { label: 'Hãng', sql: 'SELECT COUNT(*) as c FROM hang' },
    { label: 'Cty VT', sql: 'SELECT COUNT(*) as c FROM cty_van_tai' },
    { label: 'Tuyến', sql: 'SELECT COUNT(*) as c FROM tuyen' },
    { label: 'Chuyến', sql: 'SELECT COUNT(*) as c FROM chuyen_xe' },
    { label: 'Phiếu', sql: 'SELECT COUNT(*) as c FROM lo_hang' },
    { label: 'Phiếu thu', sql: 'SELECT COUNT(*) as c FROM phieu_thu', cls: 'text-success' },
    { label: 'Phiếu chi', sql: 'SELECT COUNT(*) as c FROM phieu_chi', cls: 'text-error' },
    { label: 'NV', sql: "SELECT COUNT(*) as c FROM nhan_vien WHERE active = 1" },
  ];

  const counts = await Promise.all(countTables.map(async (t) => {
    const row = await c.env.DB.prepare(t.sql).first<{ c: number }>();
    return { ...t, c: row?.c || 0 };
  }));

  const { results: nvs } = await c.env.DB.prepare(
    "SELECT * FROM nhan_vien WHERE active = 1 ORDER BY vai_tro, ten"
  ).all<NhanVien>();

  const { results: audits } = await c.env.DB.prepare(
    "SELECT * FROM audit_log ORDER BY ngay DESC, id DESC LIMIT 50"
  ).all<{ ngay: string; gio: string; nguoi_label: string; hanh_dong: string; target: string; chi_tiet: string }>();

  const summaryHtml = counts.map(t =>
    `<div class="card text-center py-3 ${t.cls || ''}">
      <div class="text-lg font-bold text-dark dark:text-white">${t.c}</div>
      <div class="text-xs text-bodytext dark:text-darklink">${t.label}</div>
    </div>`
  ).join('');

  const nvRows = (nvs as NhanVien[]).map(nv => {
    const color = ROLE_TAG[nv.vai_tro] || 'bg-lightgray text-bodytext';
    return tableRow([
      `<span class="font-mono text-bodytext">${nv.id}</span>`,
      `<span class="font-medium text-dark dark:text-white">${esc(nv.ten)}</span>`,
      `<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium ${color}">${ROLE_LABELS[nv.vai_tro] || nv.vai_tro}</span>`,
      esc(nv.sdt || '—'),
      tableActions(`editNV('${nv.id}')`, user.role === 'admin' ? `deleteNV('${nv.id}')` : undefined),
    ]);
  }).join('');

  const auditRows = audits.map(a =>
    `<div class="py-2 px-4 border-b border-light-dark text-sm text-bodytext flex flex-wrap gap-1">
      <span class="text-xs font-mono text-bodytext">${fmtDate(a.ngay)} ${a.gio || ''}</span>
      <span class="text-primary font-medium">${esc(a.nguoi_label || '')}</span>
      <span>— ${esc(a.hanh_dong || '')}</span>
      <strong class="text-dark dark:text-white">${esc(a.target || '')}</strong>
      <span class="text-bodytext">${esc(a.chi_tiet || '')}</span>
    </div>`
  ).join('');

  const content = `
    ${pageHeader('Quản lý hệ thống', {
      actions: user.role === 'admin' ? btnPrimary('Thêm NV', { icon: 'solar:add-circle-linear', onclick: 'showAddNVForm()' }) : '',
    })}

    <div class="grid gap-3 mb-6" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
      ${summaryHtml}
    </div>

    ${dataTable(
      ['Mã', 'Tên', 'Vai trò', 'SĐT', 'Thao tác'],
      nvRows || tableEmpty(5),
    )}

    ${card({
      title: `Audit log gần nhất (${audits.length})`,
      body: `<div class="max-h-[400px] overflow-y-auto">${auditRows || '<p class="py-12 text-center text-bodytext">Chưa có hoạt động</p>'}</div>`,
      class: 'mt-6',
    })}

    ${user.role === 'admin' ? `
    <div id="addNVModal" class="hidden fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="card max-w-lg w-full mx-4">
        <div class="card-body">
        <h2 id="nvModalTitle" class="card-title mb-4">Thêm nhân viên</h2>
        <form id="nvManagerForm" class="grid grid-cols-2 gap-4">
          <div class="col-span-2 sm:col-span-1">
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Mã NV</label>
            <input type="text" name="id" class="form-control w-full">
          </div>
          <div class="col-span-2 sm:col-span-1">
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Họ tên <span class="text-error">*</span></label>
            <input type="text" name="ten" required class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Vai trò</label>
            <select name="vai_tro" class="form-control w-full">
              ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">SĐT</label>
            <input type="text" name="sdt" class="form-control w-full">
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Địa chỉ</label>
            <input type="text" name="dia_chi" class="form-control w-full">
          </div>
          <div class="col-span-2 flex gap-3 pt-2">
            ${btnPrimary('Lưu', { type: 'submit' })}
            ${btnSecondary('Huỷ', { onclick: 'hideNVForm()' })}
          </div>
        </form>
        </div>
      </div>
    </div>
    <script>
    let editingNVId = null;
    function showAddNVForm() { editingNVId = null; document.getElementById('nvModalTitle').textContent = 'Thêm nhân viên'; document.getElementById('nvManagerForm').reset(); document.getElementById('addNVModal').classList.remove('hidden'); }
    function hideNVForm() { document.getElementById('addNVModal').classList.add('hidden'); }
    async function editNV(id) {
      editingNVId = id;
      const res = await fetch('/nhan-vien/api/nhan-vien/' + id);
      if (!res.ok) return alert('Không tìm thấy');
      const nv = await res.json();
      document.getElementById('nvModalTitle').textContent = 'Sửa ' + nv.id;
      const f = document.getElementById('nvManagerForm');
      f.id.value = nv.id || ''; f.ten.value = nv.ten || ''; f.vai_tro.value = nv.vai_tro || 'nhanvien'; f.sdt.value = nv.sdt || ''; f.dia_chi.value = nv.dia_chi || '';
      document.getElementById('addNVModal').classList.remove('hidden');
    }
    async function deleteNV(id) {
      if (!confirm('Xoá nhân viên ' + id + '?')) return;
      const res = await fetch('/nhan-vien/api/nhan-vien/' + id + '/delete', { method: 'POST' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    document.getElementById('nvManagerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch('/nhan-vien/api/nhan-vien', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });
    </script>
    ` : ''}
  `;

  return c.html(layout('Quản lý', content, user, 'manager'));
});

managerRoutes.get('/api/export-backup', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: 'Chỉ admin' }, 403);

  const tables = ['nhan_vien', 'cty_van_tai', 'khach_hang', 'hang', 'tuyen', 'xe', 'bang_gia', 'chuyen_xe', 'lo_hang', 'phieu_thu', 'phieu_chi', 'so_du_dau_ky', 'users', 'cham_cong', 'audit_log'];
  const data: Record<string, unknown> = {};
  for (const t of tables) {
    const { results } = await c.env.DB.prepare('SELECT * FROM ' + t).all();
    data[t] = results;
  }
  const json = JSON.stringify(data, null, 2);
  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="backup_' + new Date().toISOString().slice(0, 10) + '.json"',
    },
  });
});
