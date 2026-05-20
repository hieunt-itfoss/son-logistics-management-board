import { Hono } from 'hono';
import type { Env } from '../types';

export const dashboardRoutes = new Hono<{ Bindings: Env }>();

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

dashboardRoutes.get('/', async (c) => {
  const user = c.get('user');

  const customers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM khach_hang').first();
  const trips = await c.env.DB.prepare('SELECT COUNT(*) as count FROM chuyen_xe').first();
  const vehicles = await c.env.DB.prepare('SELECT COUNT(*) as count FROM xe').first();
  const routes = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tuyen').first();
  const drivers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tai_xe').first();
  const activeTrips = await c.env.DB.prepare("SELECT COUNT(*) as count FROM chuyen_xe WHERE trang_thai = 'dang_chay'").first();

  const content = `
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Trang chủ</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Khách hàng</h3>
        <p class="text-3xl font-bold text-blue-600 mt-2">${(customers as any)?.count ?? 0}</p>
        <a href="/khach-hang" class="text-sm text-blue-500 hover:underline mt-2 inline-block">Xem danh sách →</a>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Chuyến xe</h3>
        <p class="text-3xl font-bold text-green-600 mt-2">${(trips as any)?.count ?? 0}</p>
        <p class="text-sm text-gray-500 mt-1">Đang chạy: ${(activeTrips as any)?.count ?? 0}</p>
        <a href="/chuyen-xe" class="text-sm text-blue-500 hover:underline mt-2 inline-block">Xem danh sách →</a>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Xe</h3>
        <p class="text-3xl font-bold text-purple-600 mt-2">${(vehicles as any)?.count ?? 0}</p>
        <a href="/xe" class="text-sm text-blue-500 hover:underline mt-2 inline-block">Xem danh sách →</a>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Tuyến đường</h3>
        <p class="text-3xl font-bold text-orange-600 mt-2">${(routes as any)?.count ?? 0}</p>
        <a href="/tuyen" class="text-sm text-blue-500 hover:underline mt-2 inline-block">Xem danh sách →</a>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Tài xế</h3>
        <p class="text-3xl font-bold text-teal-600 mt-2">${(drivers as any)?.count ?? 0}</p>
        <a href="/tai-xe" class="text-sm text-blue-500 hover:underline mt-2 inline-block">Xem danh sách →</a>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700">Hãng vận tải</h3>
        <p class="text-3xl font-bold text-indigo-600 mt-2">${((await c.env.DB.prepare('SELECT COUNT(*) as count FROM hang').first()) as any)?.count ?? 0}</p>
        <a href="/hang" class="text-sm text-blue-500 hover:underline mt-2 inline-block">Xem danh sách →</a>
      </div>
    </div>
  `;

  return c.html(layout('Trang chủ', content, user));
});

dashboardRoutes.get('/dashboard', async (c) => {
  return c.redirect('/');
});

dashboardRoutes.get('/api/dashboard/stats', async (c) => {
  const customers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM khach_hang').first();
  const trips = await c.env.DB.prepare('SELECT COUNT(*) as count FROM chuyen_xe').first();
  const vehicles = await c.env.DB.prepare('SELECT COUNT(*) as count FROM xe').first();
  const routes = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tuyen').first();
  const drivers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tai_xe').first();
  const activeTrips = await c.env.DB.prepare("SELECT COUNT(*) as count FROM chuyen_xe WHERE trang_thai = 'dang_chay'").first();

  return c.json({
    khach_hang: (customers as any)?.count ?? 0,
    chuyen_xe: (trips as any)?.count ?? 0,
    xe: (vehicles as any)?.count ?? 0,
    tuyen: (routes as any)?.count ?? 0,
    tai_xe: (drivers as any)?.count ?? 0,
    dang_chay: (activeTrips as any)?.count ?? 0,
  });
});
