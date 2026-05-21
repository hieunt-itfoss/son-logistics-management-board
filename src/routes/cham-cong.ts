import { Hono } from 'hono';
import type { Env, ChamCong, NhanVien } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, tableRow, tableEmpty, btnPrimary, btnSecondary } from '../utils/ui';

export const chamCongRoutes = new Hono<{ Bindings: Env }>();

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
    ]);
  }).join('');

  const canEdit = ['admin', 'ketoanTruong', 'nhanvien'].includes(user.role);

  const content = `
    ${pageHeader('Chấm công', {
      actions: canEdit ? btnPrimary('Điểm danh', { icon: 'solar:add-circle-linear', onclick: 'showAddForm()' }) : '',
    })}

    <div class="card mb-6">
      <div class="card-body">
      <form method="GET" action="/cham-cong" class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Tháng</label>
          <input type="month" name="thang" value="${esc(month)}" class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">NV</label>
          <select name="nv" class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả</option>
            ${nvOpts}
          </select>
        </div>
        <button type="submit" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm cursor-pointer">Lọc</button>
        ${month || nvFilter ? '<a href="/cham-cong" class="text-sm text-primary hover:underline self-center">Xoá lọc</a>' : ''}
      </form>
      </div>
    </div>

    ${dataTable(['Ngày', 'Nhân viên', 'Trạng thái', 'Ghi chú'], rows || tableEmpty(4))}

    ${canEdit ? `
    <div id="addForm" class="hidden fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Điểm danh</h2>
        <form id="ccForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngày <span class="text-red-500">*</span></label>
            <input type="date" name="ngay" value="${new Date().toISOString().slice(0, 10)}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nhân viên <span class="text-red-500">*</span></label>
            <select name="nhan_vien_id" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              ${(nvs as NhanVien[]).map(n => `<option value="${n.id}">${esc(n.ten)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
            <select name="trang_thai" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="co">Có mặt</option>
              <option value="vang">Vắng</option>
              <option value="nua_ngay">Nửa ngày</option>
              <option value="phep">Phép</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <input type="text" name="ghi_chu" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer">Lưu</button>
            <button type="button" onclick="hideAddForm()" class="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 text-sm cursor-pointer">Huỷ</button>
          </div>
        </form>
      </div>
    </div>
    <script>
    function showAddForm() { document.getElementById('addForm').classList.remove('hidden'); }
    function hideAddForm() { document.getElementById('addForm').classList.add('hidden'); document.getElementById('ccForm').reset(); }
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
  const canEdit = ['admin', 'ketoanTruong', 'nhanvien'].includes(user.role);
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
