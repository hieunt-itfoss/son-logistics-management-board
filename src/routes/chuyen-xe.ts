import { Hono } from 'hono';
import type { Env, ChuyenXe, Tuyen, Xe, TaiXe } from '../types';

export const chuyenXeRoutes = new Hono<{ Bindings: Env }>();

function layout(title: string, content: string, user: any): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - HTQLVT</title>
  <link rel="stylesheet" href="/assets/tailwind/tailwind.css">
  <link rel="stylesheet" href="/assets/css/theme.css">
</head>
<body class="bg-gray-50 min-h-screen">
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <a href="/dashboard" class="text-xl font-bold text-blue-700">HTQLVT</a>
          <span class="ml-4 text-gray-400">|</span>
          <a href="/khach-hang" class="ml-4 text-gray-600 hover:text-gray-900">Khách hàng</a>
          <a href="/hang" class="ml-4 text-gray-600 hover:text-gray-900">Hãng</a>
          <a href="/tuyen" class="ml-4 text-gray-600 hover:text-gray-900">Tuyến</a>
          <a href="/xe" class="ml-4 text-gray-600 hover:text-gray-900">Xe</a>
          <a href="/tai-xe" class="ml-4 text-gray-600 hover:text-gray-900">Tài xế</a>
          <a href="/chuyen-xe" class="ml-4 text-blue-700 font-semibold">Chuyến xe</a>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-600">${user.display_name} (${user.role})</span>
          <form method="POST" action="/api/auth/logout">
            <button type="submit" class="text-sm text-red-600 hover:text-red-800 cursor-pointer">Đăng xuất</button>
          </form>
        </div>
      </div>
    </div>
  </nav>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">${content}</main>
</body>
</html>`;
}

const trangThaiLabels: Record<string, string> = {
  planned: 'Kế hoạch',
  dang_chay: 'Đang chạy',
  hoan_thanh: 'Hoàn thành',
  huy: 'Hủy',
};

const trangThaiColors: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  dang_chay: 'bg-blue-100 text-blue-700',
  hoan_thanh: 'bg-green-100 text-green-700',
  huy: 'bg-red-100 text-red-700',
};

chuyenXeRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    'SELECT cx.*, t.ten as tuyen_ten, x.bien_so, tx.ten as tai_xe_ten FROM chuyen_xe cx LEFT JOIN tuyen t ON cx.tuyen_id = t.id LEFT JOIN xe x ON cx.xe_id = x.id LEFT JOIN tai_xe tx ON cx.tai_xe_id = tx.id ORDER BY cx.ngay_di DESC'
  ).all<ChuyenXe & { tuyen_ten: string; bien_so: string; tai_xe_ten: string }>();

  const tuyenList = await c.env.DB.prepare('SELECT id, ten FROM tuyen ORDER BY ten').all<Tuyen>();
  const xeList = await c.env.DB.prepare('SELECT id, bien_so FROM xe ORDER BY bien_so').all<Xe>();
  const taiXeList = await c.env.DB.prepare('SELECT id, ten FROM tai_xe ORDER BY ten').all<TaiXe>();

  const tuyenOptions = (tuyenList.results as Tuyen[]).map((t) => `<option value="${t.id}">${t.ten}</option>`).join('');
  const xeOptions = (xeList.results as Xe[]).map((x) => `<option value="${x.id}">${x.bien_so}</option>`).join('');
  const taiXeOptions = `<option value="">-- Chọn tài xế --</option>` + (taiXeList.results as TaiXe[]).map((tx) => `<option value="${tx.id}">${tx.ten}</option>`).join('');

  const rows = (results as (ChuyenXe & { tuyen_ten: string; bien_so: string; tai_xe_ten: string })[]).map((cx) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${cx.tuyen_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${cx.bien_so || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${cx.tai_xe_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${cx.ngay_di || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${cx.ngay_den || '-'}</td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-1 rounded-full text-xs font-medium ${trangThaiColors[cx.trang_thai] || 'bg-gray-100 text-gray-700'}">${trangThaiLabels[cx.trang_thai] || cx.trang_thai}</span>
      </td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editChuyenXe('${cx.id}')" class="text-blue-600 hover:underline mr-2 cursor-pointer">Sửa</button>
        <button onclick="deleteChuyenXe('${cx.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Chuyến xe</h1>
      <button onclick="showAddForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">+ Thêm chuyến</button>
    </div>

    <div id="addForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 id="formTitle" class="text-lg font-semibold mb-4">Thêm chuyến xe mới</h2>
      <form id="chuyenXeForm" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tuyến</label>
          <select name="tuyen_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn tuyến --</option>
            ${tuyenOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Xe</label>
          <select name="xe_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn xe --</option>
            ${xeOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tài xế</label>
          <select name="tai_xe_id" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            ${taiXeOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
          <select name="trang_thai" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="planned">Kế hoạch</option>
            <option value="dang_chay">Đang chạy</option>
            <option value="hoan_thanh">Hoàn thành</option>
            <option value="huy">Hủy</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ngày đi</label>
          <input type="date" name="ngay_di" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ngày đến</label>
          <input type="date" name="ngay_den" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
          <input type="text" name="ghi_chu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-2 flex gap-2">
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer">Lưu</button>
          <button type="button" onclick="hideAddForm()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer">Hủy</button>
        </div>
      </form>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tuyến</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xe</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tài xế</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày đi</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày đến</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Chưa có chuyến xe nào</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    let editingId = null;

    function showAddForm() {
      editingId = null;
      document.getElementById('formTitle').textContent = 'Thêm chuyến xe mới';
      document.getElementById('chuyenXeForm').reset();
      document.getElementById('addForm').classList.remove('hidden');
    }

    function hideAddForm() {
      editingId = null;
      document.getElementById('addForm').classList.add('hidden');
      document.getElementById('chuyenXeForm').reset();
    }

    document.getElementById('chuyenXeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.tai_xe_id = body.tai_xe_id || null;
      body.ngay_den = body.ngay_den || null;

      const url = editingId ? '/api/chuyen-xe/' + editingId : '/api/chuyen-xe';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editChuyenXe(id) {
      const res = await fetch('/api/chuyen-xe');
      const data = await res.json();
      const cx = data.find(x => x.id === id);
      if (!cx) return alert('Không tìm thấy');
      editingId = id;
      document.getElementById('formTitle').textContent = 'Sửa chuyến xe';
      const form = document.getElementById('chuyenXeForm');
      form.tuyen_id.value = cx.tuyen_id || '';
      form.xe_id.value = cx.xe_id || '';
      form.tai_xe_id.value = cx.tai_xe_id || '';
      form.trang_thai.value = cx.trang_thai || 'planned';
      form.ngay_di.value = cx.ngay_di || '';
      form.ngay_den.value = cx.ngay_den || '';
      form.ghi_chu.value = cx.ghi_chu || '';
      document.getElementById('addForm').classList.remove('hidden');
    }

    async function deleteChuyenXe(id) {
      if (!confirm('Xóa chuyến xe này?')) return;
      const res = await fetch('/api/chuyen-xe/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Chuyến xe', content, user));
});

chuyenXeRoutes.get('/api/chuyen-xe', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM chuyen_xe ORDER BY ngay_di DESC').all<ChuyenXe>();
  return c.json(results);
});

chuyenXeRoutes.post('/api/chuyen-xe', async (c) => {
  const body = await c.req.json();
  const id = `cx-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    'INSERT INTO chuyen_xe (id, tuyen_id, xe_id, tai_xe_id, ngay_di, ngay_den, trang_thai, ghi_chu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, body.tuyen_id, body.xe_id, body.tai_xe_id || null, body.ngay_di, body.ngay_den || null,
    body.trang_thai || 'planned', body.ghi_chu || ''
  ).run();
  return c.json({ id, ...body }, 201);
});

chuyenXeRoutes.put('/api/chuyen-xe/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE chuyen_xe SET tuyen_id=?, xe_id=?, tai_xe_id=?, ngay_di=?, ngay_den=?, trang_thai=?, ghi_chu=? WHERE id=?'
  ).bind(
    body.tuyen_id, body.xe_id, body.tai_xe_id || null, body.ngay_di, body.ngay_den || null,
    body.trang_thai || 'planned', body.ghi_chu || '', id
  ).run();
  return c.json({ success: true });
});

chuyenXeRoutes.delete('/api/chuyen-xe/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM chuyen_xe WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
