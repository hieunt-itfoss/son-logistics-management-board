import { Hono } from 'hono';
import type { Env, Xe } from '../types';

export const xeRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/xe" class="ml-4 text-blue-700 font-semibold">Xe</a>
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

xeRoutes.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM xe ORDER BY bien_so').all<Xe>();

  const rows = (results as Xe[]).map((x) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${x.bien_so}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${x.so_xe || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${x.loai_xe || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${x.trong_tai || 0} tấn</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="editXe('${x.id}')" class="text-blue-600 hover:underline mr-2 cursor-pointer">Sửa</button>
        <button onclick="deleteXe('${x.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Xe</h1>
      <button onclick="showAddForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">+ Thêm xe</button>
    </div>

    <div id="addForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Thêm xe mới</h2>
      <form id="xeForm" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Biển số</label>
          <input type="text" name="bien_so" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Số xe</label>
          <input type="text" name="so_xe" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Loại xe</label>
          <input type="text" name="loai_xe" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Trọng tải (tấn)</label>
          <input type="number" name="trong_tai" step="0.1" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
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
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Biển số</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số xe</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại xe</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trọng tải</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Chưa có xe nào</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    function showAddForm() { document.getElementById('addForm').classList.remove('hidden'); }
    function hideAddForm() { document.getElementById('addForm').classList.add('hidden'); document.getElementById('xeForm').reset(); }

    document.getElementById('xeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.trong_tai = Number(body.trong_tai) || 0;
      const res = await fetch('/api/xe', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editXe(id) {
      const res = await fetch('/api/xe');
      const data = await res.json();
      const x = data.find(v => v.id === id);
      if (!x) return alert('Không tìm thấy');
      const form = document.getElementById('xeForm');
      form.bien_so.value = x.bien_so || '';
      form.so_xe.value = x.so_xe || '';
      form.loai_xe.value = x.loai_xe || '';
      form.trong_tai.value = x.trong_tai || '';
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const body = Object.fromEntries(fd.entries());
        body.trong_tai = Number(body.trong_tai) || 0;
        const ures = await fetch('/api/xe/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (ures.ok) { location.reload(); } else { const err = await ures.json(); alert(err.error || 'Lỗi'); }
      };
      showAddForm();
    }

    async function deleteXe(id) {
      if (!confirm('Xóa xe này?')) return;
      const res = await fetch('/api/xe/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Xe', content, user));
});

xeRoutes.get('/api/xe', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM xe ORDER BY bien_so').all<Xe>();
  return c.json(results);
});

xeRoutes.post('/api/xe', async (c) => {
  const body = await c.req.json();
  const id = `x-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    'INSERT INTO xe (id, bien_so, so_xe, loai_xe, trong_tai) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.bien_so, body.so_xe || '', body.loai_xe || '', body.trong_tai || 0).run();
  return c.json({ id, ...body }, 201);
});

xeRoutes.put('/api/xe/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE xe SET bien_so=?, so_xe=?, loai_xe=?, trong_tai=? WHERE id=?'
  ).bind(body.bien_so, body.so_xe || '', body.loai_xe || '', body.trong_tai || 0, id).run();
  return c.json({ success: true });
});

xeRoutes.delete('/api/xe/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM xe WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
