import { Hono } from 'hono';
import type { Env, KhachHang } from '../types';

export const khachHangRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/khach-hang" class="ml-4 text-blue-700 font-semibold">Khách hàng</a>
          <a href="/hang" class="ml-4 text-gray-600 hover:text-gray-900">Hãng</a>
          <a href="/tuyen" class="ml-4 text-gray-600 hover:text-gray-900">Tuyến</a>
          <a href="/xe" class="ml-4 text-gray-600 hover:text-gray-900">Xe</a>
          <a href="/tai-xe" class="ml-4 text-gray-600 hover:text-gray-900">Tài xế</a>
          <a href="/chuyen-xe" class="ml-4 text-gray-600 hover:text-gray-900">Chuyến xe</a>
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

khachHangRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM khach_hang ORDER BY ten').all<KhachHang>();

  const rows = (results as KhachHang[]).map((kh) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${kh.ma_kh}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${kh.ten}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${kh.nip || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${kh.sdt || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${kh.han_tt || 0} ngày</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editKhachHang('${kh.id}')" class="text-blue-600 hover:underline mr-2 cursor-pointer">Sửa</button>
        <button onclick="deleteKhachHang('${kh.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Khách hàng</h1>
      <button onclick="showAddForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">+ Thêm khách hàng</button>
    </div>

    <div id="addForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Thêm khách hàng mới</h2>
      <form id="khForm" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Mã KH</label>
          <input type="text" name="ma_kh" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tên</label>
          <input type="text" name="ten" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">NIP</label>
          <input type="text" name="nip" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
          <input type="text" name="dia_chi" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
          <input type="text" name="sdt" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Hạn TT (ngày)</label>
          <input type="number" name="han_tt" value="30" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Đánh giá</label>
          <input type="text" name="danh_gia" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã KH</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NIP</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SĐT</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hạn TT</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Chưa có khách hàng nào</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    function showAddForm() { document.getElementById('addForm').classList.remove('hidden'); }
    function hideAddForm() { document.getElementById('addForm').classList.add('hidden'); document.getElementById('khForm').reset(); }

    document.getElementById('khForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.han_tt = Number(body.han_tt) || 30;
      const res = await fetch('/api/khach-hang', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editKhachHang(id) {
      const res = await fetch('/api/khach-hang');
      const data = await res.json();
      const kh = data.find(k => k.id === id);
      if (!kh) return alert('Không tìm thấy');
      const form = document.getElementById('khForm');
      form.ma_kh.value = kh.ma_kh || '';
      form.ten.value = kh.ten || '';
      form.nip.value = kh.nip || '';
      form.dia_chi.value = kh.dia_chi || '';
      form.sdt.value = kh.sdt || '';
      form.han_tt.value = kh.han_tt || 30;
      form.danh_gia.value = kh.danh_gia || '';
      form.ghi_chu.value = kh.ghi_chu || '';
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const body = Object.fromEntries(fd.entries());
        body.han_tt = Number(body.han_tt) || 30;
        const ures = await fetch('/api/khach-hang/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (ures.ok) { location.reload(); } else { const err = await ures.json(); alert(err.error || 'Lỗi'); }
      };
      showAddForm();
    }

    async function deleteKhachHang(id) {
      if (!confirm('Xóa khách hàng này?')) return;
      const res = await fetch('/api/khach-hang/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Khách hàng', content, user));
});

khachHangRoutes.get('/api/khach-hang', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM khach_hang ORDER BY ten').all<KhachHang>();
  return c.json(results);
});

khachHangRoutes.post('/api/khach-hang', async (c) => {
  const body = await c.req.json();
  const id = `kh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    'INSERT INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, body.ma_kh, body.ten, body.nip || '', body.dia_chi || '', body.sdt || '',
    body.han_tt || 30, body.ghi_chu || '', body.danh_gia || ''
  ).run();
  return c.json({ id, ...body }, 201);
});

khachHangRoutes.put('/api/khach-hang/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE khach_hang SET ma_kh=?, ten=?, nip=?, dia_chi=?, sdt=?, han_tt=?, ghi_chu=?, danh_gia=? WHERE id=?'
  ).bind(
    body.ma_kh, body.ten, body.nip || '', body.dia_chi || '', body.sdt || '',
    body.han_tt || 30, body.ghi_chu || '', body.danh_gia || '', id
  ).run();
  return c.json({ success: true });
});

khachHangRoutes.delete('/api/khach-hang/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM khach_hang WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
