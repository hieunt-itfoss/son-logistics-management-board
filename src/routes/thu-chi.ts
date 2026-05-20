import { Hono } from 'hono';
import type { Env, PhieuThu, PhieuChi } from '../types';

export const thuChiRoutes = new Hono<{ Bindings: Env }>();

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
          <a href="/kho" class="ml-4 text-gray-600 hover:text-gray-900">Kho</a>
          <a href="/thu-chi" class="ml-4 text-blue-700 font-semibold">Thu chi</a>
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

thuChiRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { results: thuList } = await c.env.DB.prepare(
    `SELECT pt.*, kh.ten as khach_hang_ten, kh.ma_kh
     FROM phieu_thu pt
     LEFT JOIN khach_hang kh ON pt.khach_hang_id = kh.id
     ORDER BY pt.ngay DESC, pt.gio DESC`
  ).all();

  const { results: chiList } = await c.env.DB.prepare(
    'SELECT * FROM phieu_chi ORDER BY ngay DESC, created_at DESC'
  ).all();

  const khachHangList = await c.env.DB.prepare('SELECT id, ten, ma_kh FROM khach_hang ORDER BY ten').all();
  const khOptions = (khachHangList.results as any[]).map((kh) => `<option value="${kh.id}">${kh.ma_kh} - ${kh.ten}</option>`).join('');

  const thuRows = (thuList as any[]).map((pt) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${pt.ngay}</td>
      <td class="px-4 py-3 text-sm text-gray-900">${pt.khach_hang_ten || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pt.dau_muc || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pt.kieu_qt === 'trahet' ? 'Trả hết' : 'Ứng'}</td>
      <td class="px-4 py-3 text-sm font-medium text-green-600">${Number(pt.so_tien).toLocaleString('vi-VN')} ${pt.tien_te}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pt.hinh_thuc}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pt.ghi_chu || '-'}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="deleteThu('${pt.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const chiRows = (chiList as any[]).map((pc) => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-900">${pc.ngay}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pc.dau_muc || '-'}</td>
      <td class="px-4 py-3 text-sm font-medium text-red-600">${Number(pc.so_tien).toLocaleString('vi-VN')} ${pc.tien_te}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pc.hinh_thuc}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${pc.ghi_chu || '-'}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="deleteChi('${pc.id}')" class="text-red-600 hover:underline cursor-pointer">Xóa</button>
      </td>
    </tr>
  `).join('');

  const tongThu = (thuList as any[]).reduce((s, pt) => s + Number(pt.so_tien), 0);
  const tongChi = (chiList as any[]).reduce((s, pc) => s + Number(pc.so_tien), 0);

  const content = `
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Thu chi</h1>

    <div class="grid grid-cols-3 gap-6 mb-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Tổng thu</h3>
        <p class="text-2xl font-bold text-green-600 mt-2">${tongThu.toLocaleString('vi-VN')} PLN</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Tổng chi</h3>
        <p class="text-2xl font-bold text-red-600 mt-2">${tongChi.toLocaleString('vi-VN')} PLN</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Còn lại</h3>
        <p class="text-2xl font-bold ${tongThu - tongChi >= 0 ? 'text-blue-600' : 'text-red-600'} mt-2">${(tongThu - tongChi).toLocaleString('vi-VN')} PLN</p>
      </div>
    </div>

    <div class="mb-6">
      <div class="flex border-b border-gray-200">
        <button onclick="switchTab('thu')" id="tabThu" class="px-6 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 cursor-pointer">Phiếu thu</button>
        <button onclick="switchTab('chi')" id="tabChi" class="px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 cursor-pointer">Phiếu chi</button>
      </div>
    </div>

    <div id="panelThu">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Phiếu thu</h2>
        <button onclick="showThuForm()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 cursor-pointer">+ Thêm phiếu thu</button>
      </div>

      <div id="thuForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">Thêm phiếu thu</h3>
        <form id="formThu" class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
            <input type="date" name="ngay" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Giờ</label>
            <input type="time" name="gio" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Khách hàng</label>
            <select name="khach_hang_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">-- Chọn KH --</option>
              ${khOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Đầu mục</label>
            <input type="text" name="dau_muc" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kiểu QT</label>
            <select name="kieu_qt" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="trahet">Trả hết</option>
              <option value="ung">Ứng</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Loại tiền</label>
            <input type="text" name="loai_tien" value="vantai" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền</label>
            <input type="number" name="so_tien" required step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Hình thức</label>
            <select name="hinh_thuc" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="TM">Tiền mặt (TM)</option>
              <option value="CK">Chuyển khoản (CK)</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <input type="text" name="ghi_chu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div class="col-span-3 flex gap-2">
            <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 cursor-pointer">Lưu</button>
            <button type="button" onclick="hideThuForm()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer">Hủy</button>
          </div>
        </form>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đầu mục</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiểu QT</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số tiền</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HT</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ghi chú</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">${thuRows || '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Chưa có phiếu thu nào</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div id="panelChi" class="hidden">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Phiếu chi</h2>
        <button onclick="showChiForm()" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 cursor-pointer">+ Thêm phiếu chi</button>
      </div>

      <div id="chiForm" class="hidden bg-white rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">Thêm phiếu chi</h3>
        <form id="formChi" class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
            <input type="date" name="ngay" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Đầu mục</label>
            <input type="text" name="dau_muc" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền</label>
            <input type="number" name="so_tien" required step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Hình thức</label>
            <select name="hinh_thuc" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="TM">Tiền mặt (TM)</option>
              <option value="CK">Chuyển khoản (CK)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <input type="text" name="ghi_chu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div class="col-span-3 flex gap-2">
            <button type="submit" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 cursor-pointer">Lưu</button>
            <button type="button" onclick="hideChiForm()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer">Hủy</button>
          </div>
        </form>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đầu mục</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số tiền</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HT</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ghi chú</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">${chiRows || '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Chưa có phiếu chi nào</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <script>
    function switchTab(tab) {
      if (tab === 'thu') {
        document.getElementById('panelThu').classList.remove('hidden');
        document.getElementById('panelChi').classList.add('hidden');
        document.getElementById('tabThu').classList.add('border-blue-600', 'text-blue-600');
        document.getElementById('tabThu').classList.remove('border-transparent', 'text-gray-500');
        document.getElementById('tabChi').classList.remove('border-blue-600', 'text-blue-600');
        document.getElementById('tabChi').classList.add('border-transparent', 'text-gray-500');
      } else {
        document.getElementById('panelChi').classList.remove('hidden');
        document.getElementById('panelThu').classList.add('hidden');
        document.getElementById('tabChi').classList.add('border-blue-600', 'text-blue-600');
        document.getElementById('tabChi').classList.remove('border-transparent', 'text-gray-500');
        document.getElementById('tabThu').classList.remove('border-blue-600', 'text-blue-600');
        document.getElementById('tabThu').classList.add('border-transparent', 'text-gray-500');
      }
    }

    function showThuForm() { document.getElementById('thuForm').classList.remove('hidden'); }
    function hideThuForm() { document.getElementById('thuForm').classList.add('hidden'); document.getElementById('formThu').reset(); }
    function showChiForm() { document.getElementById('chiForm').classList.remove('hidden'); }
    function hideChiForm() { document.getElementById('chiForm').classList.add('hidden'); document.getElementById('formChi').reset(); }

    document.getElementById('formThu').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.so_tien = Number(body.so_tien) || 0;
      body.lo_ids = '[]';
      const res = await fetch('/api/thu-chi/thu', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    document.getElementById('formChi').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.so_tien = Number(body.so_tien) || 0;
      const res = await fetch('/api/thu-chi/chi', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function deleteThu(id) {
      if (!confirm('Xóa phiếu thu này?')) return;
      const res = await fetch('/api/thu-chi/thu/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }

    async function deleteChi(id) {
      if (!confirm('Xóa phiếu chi này?')) return;
      const res = await fetch('/api/thu-chi/chi/' + id, { method: 'DELETE' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Thu chi', content, user));
});

thuChiRoutes.get('/api/thu-chi/thu', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT pt.*, kh.ten as khach_hang_ten, kh.ma_kh
     FROM phieu_thu pt
     LEFT JOIN khach_hang kh ON pt.khach_hang_id = kh.id
     ORDER BY pt.ngay DESC, pt.gio DESC`
  ).all();
  return c.json(results);
});

thuChiRoutes.get('/api/thu-chi/chi', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM phieu_chi ORDER BY ngay DESC, created_at DESC'
  ).all();
  return c.json(results);
});

thuChiRoutes.post('/api/thu-chi/thu', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = `pt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    `INSERT INTO phieu_thu (id, ngay, khach_hang_id, dau_muc, kieu_qt, loai_tien, lo_ids, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.ngay, body.khach_hang_id, body.dau_muc || '', body.kieu_qt || 'trahet',
    body.loai_tien || 'vantai', body.lo_ids || '[]', body.so_tien || 0,
    body.tien_te || 'PLN', body.hinh_thuc || 'TM', body.ghi_chu || '',
    user.display_name, body.gio || ''
  ).run();
  return c.json({ id, ...body }, 201);
});

thuChiRoutes.post('/api/thu-chi/chi', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = `pc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  await c.env.DB.prepare(
    `INSERT INTO phieu_chi (id, ngay, dau_muc, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.ngay, body.dau_muc || '', body.so_tien || 0,
    body.tien_te || 'PLN', body.hinh_thuc || 'TM', body.ghi_chu || '',
    user.display_name
  ).run();
  return c.json({ id, ...body }, 201);
});

thuChiRoutes.delete('/api/thu-chi/thu/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM phieu_thu WHERE id=?').bind(id).run();
  return c.json({ success: true });
});

thuChiRoutes.delete('/api/thu-chi/chi/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM phieu_chi WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
