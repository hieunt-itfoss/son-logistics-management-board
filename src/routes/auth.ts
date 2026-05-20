import { Hono } from 'hono';
import type { Env } from '../types';
import {
  verifyPassword,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/auth';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get('/login', async (c) => {
  const token = c.req.header('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('session_token='))
    ?.split('=')[1];

  if (token) {
    const session = await c.env.DB.prepare(
      'SELECT s.*, u.active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime("now")'
    )
      .bind(token)
      .first();
    if (session && (session as any).active) {
      return c.redirect('/dashboard');
    }
  }

  const error = new URL(c.req.url).searchParams.get('error');

  return c.html(`<!DOCTYPE html>
<html lang="vi" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng nhập - Hệ thống Quản lý Vận tải</title>
  <link rel="stylesheet" href="/assets/tailwind/tailwind.css">
  <link rel="stylesheet" href="/assets/css/theme.css">
</head>
<body class="bg-linear-to-br from-blue-50 via-white to-blue-100 h-full">
  <div class="flex items-center justify-center min-h-screen px-4 py-12 sm:px-6 lg:px-8">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div class="px-8 pt-10 pb-6 text-center bg-linear-to-r from-blue-600 to-blue-700">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-4">
            <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">Hệ thống Quản lý</h1>
          <p class="text-blue-100 text-sm mt-1">Quản lý Vận tải Việt Nam</p>
        </div>

        <div class="p-8">
          ${error ? `<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">${error === '1' ? 'Tên đăng nhập hoặc mật khẩu không đúng.' : 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.'}</div>` : ''}

          <form method="POST" action="/api/auth/login" class="space-y-5">
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập</label>
              <input
                type="text"
                id="username"
                name="username"
                required
                autocomplete="username"
                class="block w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Nhập tên đăng nhập"
              >
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autocomplete="current-password"
                class="block w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Nhập mật khẩu"
              >
            </div>

            <button
              type="submit"
              class="w-full py-3 px-4 bg-linear-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg shadow-blue-500/25 cursor-pointer"
            >
              Đăng nhập
            </button>
          </form>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">&copy; 2026 Hệ thống Quản lý Vận tải. Bảo lưu mọi quyền.</p>
    </div>
  </div>
</body>
</html>`);
});

authRoutes.post('/api/auth/login', async (c) => {
  const formData = await c.req.formData();
  const username = (formData.get('username') as string)?.trim();
  const password = formData.get('password') as string;

  if (!username || !password) {
    return c.redirect('/login?error=1');
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, password_hash, display_name, role, active FROM users WHERE username = ?'
  )
    .bind(username)
    .first();

  if (!user || !(user as any).active) {
    return c.redirect('/login?error=1');
  }

  const valid = await verifyPassword(password, (user as any).password_hash, c.env.SESSION_SECRET);
  if (!valid) {
    return c.redirect('/login?error=1');
  }

  const token = await createSession(c.env.DB, (user as any).id, c.env.SESSION_SECRET);
  setSessionCookie(c, token);

  return c.redirect('/dashboard');
});

authRoutes.post('/api/auth/logout', async (c) => {
  const token = c.req.header('cookie')
    ?.split(';')
    .find((c) => c.trim().startsWith('session_token='))
    ?.split('=')[1];

  if (token) {
    await deleteSession(c.env.DB, token);
  }

  clearSessionCookie(c);
  return c.redirect('/login');
});
