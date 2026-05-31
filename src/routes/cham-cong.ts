import { Hono } from 'hono';
import type { Env, ChamCong, NhanVien, AppVariables } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, tableRow, tableEmpty, btnPrimary, btnSecondary, modalShell, modalFooterInner, formGroup, formField, input, select, FILTER_LABEL_CLASS } from '../utils/ui';

export const chamCongRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return d.slice(0, 10);
}

const TT_LABEL: Record<string, string> = { co: 'Có mặt', vang: 'Vắng', nua_ngay: 'Nửa ngày', phep: 'Phép' };
const TT_COLOR: Record<string, string> = { co: 'bg-green-100 text-green-700', vang: 'bg-red-100 text-red-700', nua_ngay: 'bg-amber-100 text-amber-700', phep: 'bg-blue-100 text-blue-700' };

chamCongRoutes.get('/', async (c) => {
  const user = c.get('user');
  const month = c.req.query('thang') || '';
  const nvFilter = c.req.query('nv') || '';

  const { results: nvs } = await c.env.DB.prepare(
    "SELECT id, ten, vai_tro FROM nhan_vien WHERE active = 1 ORDER BY vai_tro, ten"
  ).all<NhanVien>();

  let sql = 'SELECT cc.*, nv.ten as nhan_vien_ten FROM cham_cong cc JOIN nhan_vien nv ON cc.nhan_vien_id = nv.id WHERE 1=1';
  const binds: string[] = [];
  if (month) { sql += ' AND cc.ngay LIKE ?'; binds.push(month + '%'); }
  if (nvFilter) { sql += ' AND cc.nhan_vien_id = ?'; binds.push(nvFilter); }
  sql += ' ORDER BY cc.ngay DESC, nv.ten LIMIT 500';

  const { results: records } = await c.env.DB.prepare(sql).bind(...binds).all<ChamCong & { nhan_vien_ten: string }>();

  const nvOpts = (nvs as NhanVien[]).map(n =>
    `<option value="${n.id}"${n.id === nvFilter ? ' selected' : ''}>${esc(n.ten)}</option>`
  ).join('');

  const rows = records.map((r) => {
    const color = TT_COLOR[r.trang_thai] || 'bg-lightgray text-bodytext';
    return tableRow([
      fmtDate(r.ngay),
      `<span class="font-medium text-dark dark:text-white">${esc(r.nhan_vien_ten)}</span>`,
      `<span class="inline-block px-2.5 py-1 rounded-md text-xs font-medium ${color}">${TT_LABEL[r.trang_thai] || r.trang_thai}</span>`,
      esc(r.ghi_chu || '—'),
    ], { align: 'center' });
  }).join('');

  const canEdit = c.get('perms').canEdit;

  const content = `
    ${pageHeader('Chấm công', {
      actions: canEdit ? btnPrimary('Điểm danh', { icon: 'solar:add-circle-linear', onclick: 'showAddForm()' }) : '',
    })}

    <div class="card mb-6">
      <div class="card-body">
      <form method="GET" action="/cham-cong" class="flex flex-wrap items-end gap-3">
        ${formField('Tháng', input({ type: 'month', name: 'thang', value: esc(month), class: 'w-auto' }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('NV', select({ name: 'nv', class: 'w-auto', options: `<option value="">Tất cả</option>${nvOpts}` }), { labelClass: FILTER_LABEL_CLASS })}
        <button type="submit" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm cursor-pointer">Lọc</button>
        ${month || nvFilter ? '<a href="/cham-cong" class="text-sm text-primary hover:underline self-center">Xoá lọc</a>' : ''}
      </form>
      </div>
    </div>

    ${dataTable(['Ngày', 'Nhân viên', 'Trạng thái', 'Ghi chú'], rows || tableEmpty(4), { align: 'center' })}

    ${canEdit ? `
    ${modalShell({
      id: 'addForm',
      title: 'Điểm danh',
      size: 'md',
      body: `<form id="ccForm" class="space-y-4">
          ${formGroup('Ngày', input({ type: 'date', name: 'ngay', value: new Date().toISOString().slice(0, 10), required: true }), { required: true })}
          ${formGroup('Nhân viên', select({ name: 'nhan_vien_id', options: (nvs as NhanVien[]).map(n => `<option value="${n.id}">${esc(n.ten)}</option>`).join('') }), { required: true })}
          ${formGroup('Trạng thái', select({ name: 'trang_thai', options: '<option value="co">Có mặt</option><option value="vang">Vắng</option><option value="nua_ngay">Nửa ngày</option><option value="phep">Phép</option>' }))}
          ${formGroup('Ghi chú', input({ type: 'text', name: 'ghi_chu' }))}
        </form>`,
      footer: modalFooterInner(
        btnSecondary('Huỷ', { onclick: 'hideAddForm()' }),
        `<button type="submit" form="ccForm" class="btn cursor-pointer">Lưu</button>`,
      ),
    })}
    <script>
    function showAddForm() { htqlOpenModal('addForm'); }
    function hideAddForm() { htqlCloseModal('addForm'); document.getElementById('ccForm').reset(); }
    document.getElementById('ccForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch('/cham-cong/api/cham-cong', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });
    </script>
    ` : ''}
  `;

  return c.html(layout('Chấm công', content, user, 'cham-cong'));
});

chamCongRoutes.post('/api/cham-cong', async (c) => {
  const user = c.get('user');
  const canEdit = c.get('perms').canEdit;
  if (!canEdit) return c.json({ error: 'Không có quyền' }, 403);

  const body = await c.req.json();
  if (!body.ngay || !body.nhan_vien_id) return c.json({ error: 'Ngày và Nhân viên bắt buộc' }, 400);

  const id = 'CC-' + body.nhan_vien_id + '-' + body.ngay.replace(/-/g, '');
  const trangThai = ['co', 'vang', 'nua_ngay', 'phep'].includes(body.trang_thai) ? body.trang_thai : 'co';

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO cham_cong (id, nhan_vien_id, ngay, trang_thai, ghi_chu) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.nhan_vien_id, body.ngay, trangThai, body.ghi_chu || '').run();

  return c.json({ success: true, id }, 201);
});
