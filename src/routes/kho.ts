import { Hono } from 'hono';
import type { Env, LoHang } from '../types';

export const khoRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/lo-hang" class="ml-4 text-gray-600 hover:text-gray-900">Lô hàng</a>
          <a href="/kho" class="ml-4 text-blue-700 font-semibold">Kho</a>
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

khoRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, h.ten as hang_ten, cx.ngay_di, t.ten as tuyen_ten,
            (lh.so_kien - lh.da_tra_hang) as chua_tra
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.so_kien > lh.da_tra_hang
     ORDER BY lh.created_at DESC`
  ).all();

  const rows = (results as any[]).map((lh) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${lh.id.substring(0, 12)}...</td>
      <td class="px-4 py-3 text-sm text-gray-900">${lh.khach_hang_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${lh.hang_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${lh.tuyen_ten || '-'} (${lh.ngay_di || '-'})</td>
      <td class="px-4 py-3 text-sm text-gray-900 font-medium">${lh.so_kien}</td>
      <td class="px-4 py-3 text-sm text-green-600 font-medium">${lh.da_tra_hang}</td>
      <td class="px-4 py-3 text-sm text-red-600 font-medium">${lh.chua_tra}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="showUpdateForm('${lh.id}', ${lh.so_kien}, ${lh.da_tra_hang})" class="text-blue-600 hover:underline cursor-pointer">Cập nhật</button>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Kho - Hàng chưa giao</h1>

    <div id="updateForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Cập nhật đã trả hàng</h2>
      <form id="khoForm" class="grid grid-cols-3 gap-4">
        <input type="hidden" name="id" id="khoId">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tổng kiện</label>
          <input type="text" id="khoTongKien" disabled class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Đã trả (trước)</label>
          <input type="text" id="khoDaTraCu" disabled class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Đã trả (mới)</label>
          <input type="number" name="da_tra_hang" id="khoDaTraMoi" required min="0" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-3">
          <label class="block text-sm font-medium text-gray-700 mb-1">Lý do thiếu (nếu có)</label>
          <input type="text" name="ly_do_thieu" id="khoLyDo" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-3 flex gap-2">
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer">Lưu</button>
          <button type="button" onclick="hideUpdateForm()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer">Hủy</button>
        </div>
      </form>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã lô</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hãng</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chuyến</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tổng kiện</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đã trả</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Còn lại</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">${rows || '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Không có hàng trong kho</td></tr>'}</tbody>
      </table>
    </div>

    <script>
    function showUpdateForm(id, tongKien, daTra) {
      document.getElementById('khoId').value = id;
      document.getElementById('khoTongKien').value = tongKien;
      document.getElementById('khoDaTraCu').value = daTra;
      document.getElementById('khoDaTraMoi').value = daTra;
      document.getElementById('khoDaTraMoi').max = tongKien;
      document.getElementById('updateForm').classList.remove('hidden');
    }

    function hideUpdateForm() {
      document.getElementById('updateForm').classList.add('hidden');
      document.getElementById('khoForm').reset();
    }

    document.getElementById('khoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('khoId').value;
      const da_tra_hang = Number(document.getElementById('khoDaTraMoi').value);
      const ly_do_thieu = document.getElementById('khoLyDo').value;
      const res = await fetch('/api/kho/update-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, da_tra_hang, ly_do_thieu })
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });
    </script>
  `;

  return c.html(layout('Kho', content, user));
});

khoRoutes.get('/api/kho', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, h.ten as hang_ten, cx.ngay_di, t.ten as tuyen_ten,
            (lh.so_kien - lh.da_tra_hang) as chua_tra
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.so_kien > lh.da_tra_hang
     ORDER BY lh.created_at DESC`
  ).all();
  return c.json(results);
});

khoRoutes.post('/api/kho/update-delivered', async (c) => {
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE lo_hang SET da_tra_hang=?, ly_do_thieu=?, updated_at=datetime(\'now\') WHERE id=?'
  ).bind(body.da_tra_hang, body.ly_do_thieu || '', body.id).run();
  return c.json({ success: true });
});
