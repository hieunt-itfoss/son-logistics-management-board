import { Hono } from 'hono';
import type { Env, Tuyen } from '../types';

export const tuyenRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/tuyen" class="ml-4 text-blue-700 font-semibold">Tuyến</a>
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

tuyenRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM tuyen ORDER BY ten').all<Tuyen>();

  const rows = (results as Tuyen[]).map((t) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${t.ten}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${t.diem_di || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${t.diem_den || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${t.tien_to || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${t.khoang_cach_km || 0} km</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editTuyen('${t.id}')" class="text-blue-600 hover:underline mr-2 cursor-pointer">Sửa</button>
        <button onclick="deleteTuyen('${t.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Tuyến đường</h1>
      <button onclick="showAddForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">+ Thêm tuyến</button>
    </div>

    <div id="addForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Thêm tuyến mới</h2>
      <form id="tuyenForm" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tên tuyến</label>
          <input type="text" name="ten" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tiền tố</label>
          <input type="text" name="tien_to" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Điểm đi</label>
          <input type="text" name="diem_di" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Điểm đến</label>
          <input type="text" name="diem_den" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Khoảng cách (km)</label>
          <input type="number" name="khoang_cach_km" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên tuyến</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Điểm đi</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Điểm đến</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiền tố</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khoảng cách</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Chưa có tuyến nào</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    function showAddForm() { document.getElementById('addForm').classList.remove('hidden'); }
    function hideAddForm() { document.getElementById('addForm').classList.add('hidden'); document.getElementById('tuyenForm').reset(); }

    document.getElementById('tuyenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.khoang_cach_km = Number(body.khoang_cach_km) || 0;
      const res = await fetch('/api/tuyen', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editTuyen(id) {
      const res = await fetch('/api/tuyen');
      const data = await res.json();
      const t = data.find(x => x.id === id);
      if (!t) return alert('Không tìm thấy');
      const form = document.getElementById('tuyenForm');
      form.ten.value = t.ten || '';
      form.tien_to.value = t.tien_to || '';
      form.diem_di.value = t.diem_di || '';
      form.diem_den.value = t.diem_den || '';
      form.khoang_cach_km.value = t.khoang_cach_km || '';
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const body = Object.fromEntries(fd.entries());
        body.khoang_cach_km = Number(body.khoang_cach_km) || 0;
        const ures = await fetch('/api/tuyen/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (ures.ok) { location.reload(); } else { const err = await ures.json(); alert(err.error || 'Lỗi'); }
      };
      showAddForm();
    }

    async function deleteTuyen(id) {
      if (!confirm('Xóa tuyến này?')) return;
      const res = await fetch('/api/tuyen/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Tuyến đường', content, user));
});

tuyenRoutes.get('/api/tuyen', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tuyen ORDER BY ten').all<Tuyen>();
  return c.json(results);
});

tuyenRoutes.post('/api/tuyen', async (c) => {
  const body = await c.req.json();
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    'INSERT INTO tuyen (id, ten, diem_di, diem_den, tien_to, khoang_cach_km) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, body.ten, body.diem_di || '', body.diem_den || '', body.tien_to || '', body.khoang_cach_km || 0).run();
  return c.json({ id, ...body }, 201);
});

tuyenRoutes.put('/api/tuyen/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE tuyen SET ten=?, diem_di=?, diem_den=?, tien_to=?, khoang_cach_km=? WHERE id=?'
  ).bind(body.ten, body.diem_di || '', body.diem_den || '', body.tien_to || '', body.khoang_cach_km || 0, id).run();
  return c.json({ success: true });
});

tuyenRoutes.delete('/api/tuyen/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM tuyen WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
