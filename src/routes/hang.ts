import { Hono } from 'hono';
import type { Env, Hang } from '../types';

export const hangRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/hang" class="ml-4 text-blue-700 font-semibold">Hãng</a>
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

hangRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM hang ORDER BY ten').all<Hang>();

  const rows = (results as Hang[]).map((h) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${h.ten}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${h.nuoc || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${h.dia_chi || '-'}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editHang('${h.id}')" class="text-blue-600 hover:underline mr-2 cursor-pointer">Sửa</button>
        <button onclick="deleteHang('${h.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Hãng vận tải</h1>
      <button onclick="showAddForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">+ Thêm hãng</button>
    </div>

    <div id="addForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Thêm hãng mới</h2>
      <form id="hangForm" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tên hãng</label>
          <input type="text" name="ten" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quốc gia</label>
          <input type="text" name="nuoc" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
          <input type="text" name="dia_chi" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên hãng</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quốc gia</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Địa chỉ</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">Chưa có hãng nào</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    function showAddForm() { document.getElementById('addForm').classList.remove('hidden'); }
    function hideAddForm() { document.getElementById('addForm').classList.add('hidden'); document.getElementById('hangForm').reset(); }

    document.getElementById('hangForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch('/api/hang', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editHang(id) {
      const res = await fetch('/api/hang');
      const data = await res.json();
      const h = data.find(x => x.id === id);
      if (!h) return alert('Không tìm thấy');
      const form = document.getElementById('hangForm');
      form.ten.value = h.ten || '';
      form.nuoc.value = h.nuoc || '';
      form.dia_chi.value = h.dia_chi || '';
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const body = Object.fromEntries(fd.entries());
        const ures = await fetch('/api/hang/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (ures.ok) { location.reload(); } else { const err = await ures.json(); alert(err.error || 'Lỗi'); }
      };
      showAddForm();
    }

    async function deleteHang(id) {
      if (!confirm('Xóa hãng này?')) return;
      const res = await fetch('/api/hang/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Hãng vận tải', content, user));
});

hangRoutes.get('/api/hang', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM hang ORDER BY ten').all<Hang>();
  return c.json(results);
});

hangRoutes.post('/api/hang', async (c) => {
  const body = await c.req.json();
  const id = `h-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    'INSERT INTO hang (id, ten, nuoc, dia_chi) VALUES (?, ?, ?, ?)'
  ).bind(id, body.ten, body.nuoc || '', body.dia_chi || '').run();
  return c.json({ id, ...body }, 201);
});

hangRoutes.put('/api/hang/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE hang SET ten=?, nuoc=?, dia_chi=? WHERE id=?'
  ).bind(body.ten, body.nuoc || '', body.dia_chi || '', id).run();
  return c.json({ success: true });
});

hangRoutes.delete('/api/hang/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM hang WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
