import { Hono } from 'hono';
import type { Env, LoHang } from '../types';

export const loHangRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/chuyen-xe" class="ml-4 text-gray-600 hover:text-gray-900">Chuyến xe</a>
          <a href="/lo-hang" class="ml-4 text-blue-700 font-semibold">Lô hàng</a>
          <a href="/kho" class="ml-4 text-gray-600 hover:text-gray-900">Kho</a>
          <a href="/thu-chi" class="ml-4 text-gray-600 hover:text-gray-900">Thu chi</a>
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

loHangRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, kh.ma_kh, h.ten as hang_ten,
            cx.ngay_di, t.ten as tuyen_ten, x.bien_so
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     LEFT JOIN xe x ON cx.xe_id = x.id
     ORDER BY lh.created_at DESC`
  ).all();

  const khachHangList = await c.env.DB.prepare('SELECT id, ten, ma_kh FROM khach_hang ORDER BY ten').all();
  const hangList = await c.env.DB.prepare('SELECT id, ten FROM hang ORDER BY ten').all();
  const chuyenXeList = await c.env.DB.prepare(
    `SELECT cx.id, t.ten as tuyen_ten, x.bien_so, cx.ngay_di FROM chuyen_xe cx LEFT JOIN tuyen t ON cx.tuyen_id = t.id LEFT JOIN xe x ON cx.xe_id = x.id ORDER BY cx.ngay_di DESC`
  ).all();

  const khOptions = (khachHangList.results as any[]).map((kh) => `<option value="${kh.id}">${kh.ma_kh} - ${kh.ten}</option>`).join('');
  const hangOptions = (hangList.results as any[]).map((h) => `<option value="${h.id}">${h.ten}</option>`).join('');
  const cxOptions = (chuyenXeList.results as any[]).map((cx) => `<option value="${cx.id}">${cx.tuyen_ten || '-'} | ${cx.bien_so || '-'} | ${cx.ngay_di || '-'}</option>`).join('');

  const rows = (results as any[]).map((lh) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${lh.khach_hang_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${lh.hang_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${lh.tuyen_ten || '-'} (${lh.bien_so || '-'})</td>
      <td class="px-4 py-3 text-sm text-gray-900 font-medium">${lh.so_kien}</td>
      <td class="px-4 py-3 text-sm text-green-600">${lh.da_tra_hang}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${Number(lh.don_gia).toLocaleString('vi-VN')}</td>
      <td class="px-4 py-3 text-sm font-medium text-blue-700">${Number(lh.thanh_tien).toLocaleString('vi-VN')} ${lh.tien_te}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editLoHang('${lh.id}')" class="text-blue-600 hover:underline mr-2 cursor-pointer">Sửa</button>
        <button onclick="deleteLoHang('${lh.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Lô hàng</h1>
      <button onclick="showAddForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">+ Thêm lô hàng</button>
    </div>

    <div id="addForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 id="formTitle" class="text-lg font-semibold mb-4">Thêm lô hàng mới</h2>
      <form id="loHangForm" class="grid grid-cols-3 gap-4">
        <input type="hidden" name="id" id="editId">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Khách hàng</label>
          <select name="khach_hang_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn KH --</option>
            ${khOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Hãng</label>
          <select name="hang_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn hãng --</option>
            ${hangOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Chuyến xe</label>
          <select name="chuyen_xe_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn chuyến --</option>
            ${cxOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Số kiện</label>
          <input type="number" name="so_kien" required min="1" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Đơn giá</label>
          <input type="number" name="don_gia" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tiền tệ</label>
          <select name="tien_te" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="PLN">PLN</option>
            <option value="VND">VND</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Thành tiền</label>
          <input type="number" name="thanh_tien" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền hàng</label>
          <input type="number" name="so_tien_hang" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Giảm giá</label>
          <input type="number" name="giam_gia" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Người tạo</label>
          <input type="text" name="nguoi_tao" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Người thu</label>
          <input type="text" name="nguoi_thu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Lý do thiếu</label>
          <input type="text" name="ly_do_thieu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-3 flex gap-2">
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer">Lưu</button>
          <button type="button" onclick="hideAddForm()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer">Hủy</button>
        </div>
      </form>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hãng</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chuyến</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SL kiện</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đã trả</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đơn giá</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thành tiền</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Chưa có lô hàng nào</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    let editingId = null;

    function showAddForm() {
      editingId = null;
      document.getElementById('formTitle').textContent = 'Thêm lô hàng mới';
      document.getElementById('loHangForm').reset();
      document.getElementById('editId').value = '';
      document.getElementById('addForm').classList.remove('hidden');
    }

    function hideAddForm() {
      editingId = null;
      document.getElementById('addForm').classList.add('hidden');
      document.getElementById('loHangForm').reset();
    }

    document.getElementById('loHangForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.so_kien = Number(body.so_kien) || 0;
      body.don_gia = Number(body.don_gia) || 0;
      body.thanh_tien = Number(body.thanh_tien) || 0;
      body.so_tien_hang = Number(body.so_tien_hang) || 0;
      body.giam_gia = Number(body.giam_gia) || 0;

      const url = editingId ? '/api/lo-hang/' + editingId : '/api/lo-hang';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editLoHang(id) {
      const res = await fetch('/api/lo-hang');
      const data = await res.json();
      const lh = data.find(x => x.id === id);
      if (!lh) return alert('Không tìm thấy');
      editingId = id;
      document.getElementById('formTitle').textContent = 'Sửa lô hàng';
      const form = document.getElementById('loHangForm');
      form.khach_hang_id.value = lh.khach_hang_id || '';
      form.hang_id.value = lh.hang_id || '';
      form.chuyen_xe_id.value = lh.chuyen_xe_id || '';
      form.so_kien.value = lh.so_kien || '';
      form.don_gia.value = lh.don_gia || '';
      form.tien_te.value = lh.tien_te || 'PLN';
      form.thanh_tien.value = lh.thanh_tien || '';
      form.so_tien_hang.value = lh.so_tien_hang || '';
      form.giam_gia.value = lh.giam_gia || '';
      form.nguoi_tao.value = lh.nguoi_tao || '';
      form.nguoi_thu.value = lh.nguoi_thu || '';
      form.ly_do_thieu.value = lh.ly_do_thieu || '';
      document.getElementById('addForm').classList.remove('hidden');
    }

    async function deleteLoHang(id) {
      if (!confirm('Xóa lô hàng này?')) return;
      const res = await fetch('/api/lo-hang/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Lô hàng', content, user));
});

loHangRoutes.get('/api/lo-hang', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, kh.ma_kh, h.ten as hang_ten,
            cx.ngay_di, t.ten as tuyen_ten, x.bien_so
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     LEFT JOIN xe x ON cx.xe_id = x.id
     ORDER BY lh.created_at DESC`
  ).all();
  return c.json(results);
});

loHangRoutes.post('/api/lo-hang', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = `lh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    `INSERT INTO lo_hang (id, chuyen_xe_id, khach_hang_id, hang_id, so_kien, da_tra_hang, ly_do_thieu, don_gia, tien_te, thanh_tien, so_tien_hang, giam_gia, nguoi_tao, nguoi_thu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.chuyen_xe_id, body.khach_hang_id, body.hang_id, body.so_kien,
    body.da_tra_hang || 0, body.ly_do_thieu || '', body.don_gia || 0,
    body.tien_te || 'PLN', body.thanh_tien || 0, body.so_tien_hang || 0,
    body.giam_gia || 0, body.nguoi_tao || user.display_name, body.nguoi_thu || ''
  ).run();
  return c.json({ id, ...body }, 201);
});

loHangRoutes.put('/api/lo-hang/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE lo_hang SET chuyen_xe_id=?, khach_hang_id=?, hang_id=?, so_kien=?, ly_do_thieu=?,
     don_gia=?, tien_te=?, thanh_tien=?, so_tien_hang=?, giam_gia=?, nguoi_tao=?, nguoi_thu=?,
     updated_at=datetime('now') WHERE id=?`
  ).bind(
    body.chuyen_xe_id, body.khach_hang_id, body.hang_id, body.so_kien,
    body.ly_do_thieu || '', body.don_gia || 0, body.tien_te || 'PLN',
    body.thanh_tien || 0, body.so_tien_hang || 0, body.giam_gia || 0,
    body.nguoi_tao || '', body.nguoi_thu || '', id
  ).run();
  return c.json({ success: true });
});

loHangRoutes.delete('/api/lo-hang/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM lo_hang WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
