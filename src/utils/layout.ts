import type { Role } from '../types';

const ALL_NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: 'solar:widget-linear', id: 'dashboard', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Phiếu', href: '/lo-hang', icon: 'solar:box-linear', id: 'lo-hang', roles: ['admin','ketoanTruong','ketoanVien','nhanvien','kho','laixe'] },
  { label: 'Đối tác', href: '/doi-tac', icon: 'solar:users-group-rounded-linear', id: 'doi-tac', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Tuyến vận tải', href: '/tuyen', icon: 'solar:route-linear', id: 'tuyen', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Chuyến xe', href: '/chuyen-xe', icon: 'solar:bus-linear', id: 'chuyen-xe', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Kho', href: '/kho', icon: 'solar:box-linear', id: 'kho', roles: ['admin','ketoanTruong','ketoanVien','nhanvien','kho'] },
  { label: 'Nhân viên', href: '/nhan-vien', icon: 'solar:user-id-linear', id: 'nhan-vien', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Chấm công', href: '/cham-cong', icon: 'solar:clock-circle-linear', id: 'cham-cong', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Thu / Chi', href: '/thu-chi', icon: 'solar:wallet-money-linear', id: 'thu-chi', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Công cụ', href: '/cong-cu', icon: 'solar:settings-linear', id: 'cong-cu', roles: ['admin','ketoanTruong','ketoanVien','nhanvien'] },
  { label: 'Manager', href: '/manager', icon: 'solar:shield-check-linear', id: 'manager', roles: ['admin','ketoanTruong'] },
];

function sidebarLink(item: typeof ALL_NAV_ITEMS[0], activePage: string): string {
  const isActive = item.id === activePage;
  const linkClass = isActive
    ? 'sidebar-link gap-3 activemenu'
    : 'sidebar-link gap-3 dark-sidebar-link';
  return `<li class="sidebar-item">
          <a class="${linkClass}" href="${item.href}">
            <iconify-icon icon="${item.icon}" class="text-xl shrink-0" width="22" height="22"></iconify-icon>
            <span class="hide-menu">${item.label}</span>
          </a>
        </li>`;
}

export function layout(title: string, content: string, user: { display_name: string; role: string }, activePage: string): string {
  const userRole = user.role as Role;
  const visibleItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(userRole));
  const sidebarLinks = visibleItems.map(item => sidebarLink(item, activePage)).join('\n          ');

  return `<!DOCTYPE html>
<html lang="vi" dir="ltr" data-color-theme="Blue_Theme" data-layout="vertical" data-card="border" data-header-position="fixed">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Hệ thống Quản lý</title>
  <link rel="stylesheet" href="/assets/tailwind/tailwind.css">
  <link rel="stylesheet" href="/assets/css/theme.css">
  <script>
    (function () {
      if (localStorage.getItem('htqlvt-theme') === 'dark') {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
<body class="bg-lightgray dark:bg-dark" data-sidebartype="full">

  <aside id="application-sidebar-brand"
    class="left-sidebar hs-overlay hs-overlay-open:translate-x-0 -translate-x-full xl:translate-x-0 fixed top-0 left-0 bottom-0 z-[60] w-[270px] bg-white dark:bg-dark border-r border-border dark:border-darkborder transition-transform duration-300 print:hidden">
    <div class="brand-logo py-5 px-5 flex justify-between items-center border-b border-light-dark">
      <a href="/" class="flex items-center gap-2.5">
        <img src="/assets/images/logos/logoIcon.svg" alt="HTQLVT" class="h-8 w-8" />
        <span class="hide-menu text-lg font-semibold text-dark dark:text-white">Hệ thống Quản lý</span>
      </a>
      <button type="button" class="xl:hidden header-link-btn p-0" data-hs-overlay="#application-sidebar-brand" aria-label="Đóng menu">
        <iconify-icon icon="solar:close-circle-linear" class="text-xl"></iconify-icon>
      </button>
    </div>
    <div class="scroll-sidebar" data-simplebar="">
      <nav class="hs-accordion-group p-4 w-full flex flex-col">
        <ul id="sidebarnav" class="flex flex-col gap-0.5">
          ${sidebarLinks}
        </ul>
      </nav>
    </div>
  </aside>

  <div class="page-wrapper">
    <header class="topbar app-header fixed top-0 right-0 z-50 bg-white dark:bg-dark border-b border-light-dark print:hidden">
      <div class="flex items-center justify-between h-16 px-5 lg:px-6">
        <div class="flex items-center gap-3">
          <button type="button" class="xl:hidden header-link-btn" data-hs-overlay="#application-sidebar-brand" aria-label="Mở menu">
            <iconify-icon icon="solar:hamburger-menu-linear" class="text-xl"></iconify-icon>
          </button>
          <h2 class="text-lg font-semibold text-dark dark:text-white hidden sm:block">${title}</h2>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <button type="button" id="theme-toggle" class="header-link-btn" aria-label="Đổi giao diện">
            <iconify-icon icon="solar:moon-linear" class="text-xl htql-icon-moon"></iconify-icon>
            <iconify-icon icon="solar:sun-2-linear" class="text-xl htql-icon-sun hidden"></iconify-icon>
          </button>
          <div class="flex items-center gap-2 px-2 border-l border-light-dark pl-3">
            <iconify-icon icon="solar:user-circle-linear" class="text-xl text-link dark:text-darklink"></iconify-icon>
            <span class="text-sm text-dark dark:text-white hidden md:inline">${user.display_name}</span>
            <span class="text-xs text-bodytext dark:text-darklink hidden lg:inline">(${user.role})</span>
          </div>
          <form method="POST" action="/api/auth/logout" class="inline-flex">
            <button type="submit" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-error border border-error/30 bg-lighterror hover:bg-error hover:text-white dark:bg-darkerror dark:border-error/40 dark:hover:bg-error transition-colors cursor-pointer">
              <iconify-icon icon="solar:logout-2-linear" class="text-lg"></iconify-icon>
              <span class="hidden sm:inline">Đăng xuất</span>
            </button>
          </form>
        </div>
      </div>
    </header>

    <div class="body-wrapper pt-16 min-h-screen">
      <div class="container py-6">
        ${content}
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/preline@2.7.0/dist/preline.min.js"></script>
  <script src="/assets/js/app.init.js"></script>
  <script src="/assets/js/app.min.js"></script>
  <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
  <script>
    (function () {
      var btn = document.getElementById('theme-toggle');
      if (!btn) return;
      function syncIcons() {
        var dark = document.documentElement.classList.contains('dark');
        document.querySelectorAll('.htql-icon-moon').forEach(function (el) {
          el.classList.toggle('hidden', dark);
        });
        document.querySelectorAll('.htql-icon-sun').forEach(function (el) {
          el.classList.toggle('hidden', !dark);
        });
      }
      syncIcons();
      btn.addEventListener('click', function () {
        var html = document.documentElement;
        html.classList.toggle('dark');
        localStorage.setItem('htqlvt-theme', html.classList.contains('dark') ? 'dark' : 'light');
        syncIcons();
      });
    })();
  </script>
</body>
</html>`;
}
