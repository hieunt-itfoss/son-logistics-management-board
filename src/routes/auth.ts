import { Hono } from "hono";
import type { Env, Role, AppVariables } from "../types";
import {
  verifyPassword,
  hashPassword,
  isHashed,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  hasPermission,
} from "../middleware/auth";
import { getDefaultHomePath } from "../middleware/rbac";
import { layout } from "../utils/layout";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get("/login", async (c) => {
  const token = c.req
    .header("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("session_token="))
    ?.split("=")[1];

  if (token) {
    const session = await c.env.DB.prepare(
      'SELECT s.*, u.active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime("now")',
    )
      .bind(token)
      .first();
    if (session && (session as any).active) {
      return c.redirect("/");
    }
  }

  const error = new URL(c.req.url).searchParams.get("error");

  return c.html(`<!DOCTYPE html>
<html lang="vi" class="h-full" data-color-theme="Blue_Theme">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng nhập - Hệ thống Quản lý Vận tải</title>
  <link rel="stylesheet" href="/assets/tailwind/tailwind.css">
  <link rel="stylesheet" href="/assets/css/theme.css">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
</head>
<body class="bg-lightgray h-full">
  <div class="flex min-h-screen">

    <!-- Left: Brand panel (hidden on mobile) -->
    <div class="hidden lg:flex lg:w-[55%] htql-brand-panel relative overflow-hidden items-center justify-center">
      <!-- Decorative circles -->
      <div class="absolute -top-24 -left-24 w-96 h-96 bg-blue-500 rounded-full opacity-30"></div>
      <div class="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-blue-700 rounded-full opacity-40"></div>
      <div class="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-400 rounded-full opacity-20"></div>

      <!-- Route line decoration -->
      <svg class="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <path d="M-50 400 Q200 100 400 300 T850 150" stroke="white" stroke-width="2" fill="none"/>
        <path d="M-50 500 Q250 200 450 400 T850 250" stroke="white" stroke-width="1.5" fill="none" opacity="0.5"/>
        <circle cx="400" cy="300" r="6" fill="white" opacity="0.8"/>
        <circle cx="650" cy="200" r="4" fill="white" opacity="0.6"/>
        <circle cx="150" cy="350" r="4" fill="white" opacity="0.5"/>
      </svg>

      <!-- Content -->
      <div class="relative z-10 max-w-lg px-12 text-white">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-12 h-12 rounded-md bg-white/15 backdrop-blur flex items-center justify-center">
            <iconify-icon icon="solar:bus-linear" class="text-3xl text-white"></iconify-icon>
          </div>
          <span class="font-semibold tracking-wider text-sm uppercase text-white/90">Son Logistics</span>
        </div>

        <h1 class="text-4xl font-semibold leading-tight mb-4 text-white">
          Hệ thống<br>
          <span class="text-white/75">Quản lý Vận tải</span>
        </h1>
        <p class="text-white/70 text-base leading-relaxed mb-10">
          Quản lý chuyến xe, lô hàng, thu chi và nhân viên.<br>
          Đồng bộ dữ liệu thời gian thực.
        </p>

        <!-- Stats -->
        <div class="flex gap-8">
          <div>
            <div class="text-2xl font-bold text-white">11</div>
            <div class="text-xs text-white/60 mt-1">Phân hệ</div>
          </div>
          <div class="w-px bg-white/25"></div>
          <div>
            <div class="text-2xl font-bold text-white">6</div>
            <div class="text-xs text-white/60 mt-1">Vai trò</div>
          </div>
          <div class="w-px bg-white/25"></div>
          <div>
            <div class="text-2xl font-bold text-white">24/7</div>
            <div class="text-xs text-white/60 mt-1">Hoạt động</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Login form -->
    <div class="flex-1 flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
      <div class="w-full max-w-md">
        <div class="lg:hidden flex items-center gap-3 mb-8">
          <img src="/assets/images/logos/logoIcon.svg" alt="" class="h-10 w-10" />
          <div>
            <div class="text-dark font-semibold">Son Logistics</div>
            <div class="text-bodytext text-xs">Quản lý Vận tải</div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h2 class="card-title">Đăng nhập</h2>
            <p class="card-subtitle mt-1 mb-6">Nhập thông tin tài khoản để truy cập hệ thống</p>

            ${error ? `<div class="mb-4 p-3 rounded-md bg-lighterror text-error text-sm border border-error/20">
              ${error === "1"
    ? "Tên đăng nhập hoặc mật khẩu không đúng."
    : error === "config"
      ? "Thiếu SESSION_SECRET. Tạo file .dev.vars từ .dev.vars.example rồi chạy lại npm run dev."
      : "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."}
            </div>` : ""}

            <form method="POST" action="/api/auth/login" class="space-y-5">
              <div>
                <label for="username" class="block text-sm font-medium text-dark mb-2">Tên đăng nhập</label>
                <input type="text" id="username" name="username" required autocomplete="username"
                  class="form-control w-full" placeholder="VD: admin">
              </div>
              <div>
                <label for="password" class="block text-sm font-medium text-dark mb-2">Mật khẩu</label>
                <input type="password" id="password" name="password" required autocomplete="current-password"
                  class="form-control w-full" placeholder="Nhập mật khẩu">
              </div>
              <button type="submit" class="btn w-full cursor-pointer">Đăng nhập</button>
            </form>
          </div>
        </div>

        <p class="text-center text-xs text-bodytext mt-8">&copy; 2026 Son Logistics</p>
      </div>
    </div>

  </div>
</body>
</html>`);
});

authRoutes.post("/api/auth/login", async (c) => {
  const formData = await c.req.formData();
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;

  if (!username || !password) {
    return c.redirect("/login?error=1");
  }

  const user = await c.env.DB.prepare(
    "SELECT id, username, password_hash, display_name, role, active FROM users WHERE username = ?",
  )
    .bind(username)
    .first();

  if (!user || !(user as any).active) {
    return c.redirect("/login?error=1");
  }

  const sessionSecret = (c.env.SESSION_SECRET ?? '').trim();
  if (!sessionSecret) {
    return c.redirect('/login?error=config');
  }

  const valid = await verifyPassword(
    password,
    (user as any).password_hash,
    sessionSecret,
  );
  if (!valid) {
    return c.redirect("/login?error=1");
  }

  if (!isHashed((user as any).password_hash)) {
    const properHash = await hashPassword(password, sessionSecret);
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(properHash, (user as any).id)
      .run();
  }

  const token = await createSession(
    c.env.DB,
    (user as any).id,
    sessionSecret,
  );
  setSessionCookie(c, token);
  const role = (user as { role: Role }).role;
  const home = hasPermission(role, 'dashboard') ? '/' : getDefaultHomePath(role);
  return c.redirect(home);
});

authRoutes.post("/api/auth/logout", async (c) => {
  const token = c.req
    .header("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("session_token="))
    ?.split("=")[1];

  if (token) {
    await deleteSession(c.env.DB, token);
  }

  clearSessionCookie(c);
  return c.redirect('/login');
});

// ── Change-password routes (mounted in protectedApp so user context is available) ──
export const changePasswordRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

changePasswordRoutes.get('/change-password', (c) => {
  const user = c.get('user');
  const error = new URL(c.req.url).searchParams.get('error');
  const forced = user.must_change_password === 1;

  const errorMsg = error === 'short'
    ? 'Mật khẩu mới phải có ít nhất 6 ký tự.'
    : error === 'mismatch'
      ? 'Mật khẩu mới và xác nhận không khớp.'
      : error === 'wrong'
        ? 'Mật khẩu hiện tại không đúng.'
        : null;

  const content = `
    <div class="max-w-md mx-auto mt-8">
      ${forced ? `
        <div class="mb-6 p-4 rounded-xl bg-lightwarning/40 border border-warning/30 text-warning text-sm flex gap-2 items-start">
          <iconify-icon icon="solar:lock-password-linear" class="text-xl shrink-0 mt-0.5"></iconify-icon>
          <span>Tài khoản của bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.</span>
        </div>` : ''}

      <div class="card">
        <div class="card-body space-y-5">
          <h2 class="text-xl font-semibold text-dark dark:text-white">Đổi mật khẩu</h2>

          ${errorMsg ? `<div class="p-3 rounded-lg bg-lighterror text-error text-sm">${errorMsg}</div>` : ''}

          <form method="POST" action="/api/auth/change-password" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-dark dark:text-white mb-1">Mật khẩu hiện tại</label>
              <input type="password" name="current_password" required class="form-control w-full" placeholder="Nhập mật khẩu hiện tại">
            </div>
            <div>
              <label class="block text-sm font-medium text-dark dark:text-white mb-1">Mật khẩu mới <span class="text-error">*</span></label>
              <input type="password" name="new_password" required minlength="6" class="form-control w-full" placeholder="Ít nhất 6 ký tự">
            </div>
            <div>
              <label class="block text-sm font-medium text-dark dark:text-white mb-1">Xác nhận mật khẩu mới <span class="text-error">*</span></label>
              <input type="password" name="confirm_password" required class="form-control w-full" placeholder="Nhập lại mật khẩu mới">
            </div>
            <div class="flex gap-3 pt-2">
              <button type="submit" class="btn">Đổi mật khẩu</button>
              ${!forced ? `<a href="/" class="btn-outline-secondary">Huỷ</a>` : ''}
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  return c.html(layout('Đổi mật khẩu', content, user, ''));
});

changePasswordRoutes.post('/api/auth/change-password', async (c) => {
  const user = c.get('user');
  const formData = await c.req.formData();
  const currentPassword = formData.get('current_password') as string;
  const newPassword = formData.get('new_password') as string;
  const confirmPassword = formData.get('confirm_password') as string;

  if (!newPassword || newPassword.length < 6) {
    return c.redirect('/change-password?error=short');
  }
  if (newPassword !== confirmPassword) {
    return c.redirect('/change-password?error=mismatch');
  }

  const secret = (c.env.SESSION_SECRET ?? '').trim();
  const valid = await verifyPassword(currentPassword, user.password_hash, secret);
  if (!valid) {
    return c.redirect('/change-password?error=wrong');
  }

  const newHash = await hashPassword(newPassword, secret);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(newHash, user.id).run();

  const home = hasPermission(user.role, 'dashboard') ? '/' : getDefaultHomePath(user.role);
  return c.redirect(home);
});
