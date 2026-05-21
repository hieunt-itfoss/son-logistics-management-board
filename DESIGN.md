# HTQLVT — Design System for AI Agents

> **Stack:** TailwindAdmin layout + Tatem-inspired tokens. SSR HTML only (no React).

**Template:** [TailwindAdmin React](https://react.tailwind-admin.com/) — vertical sidebar, fixed topbar, `card` / `btn` / `form-control` utilities from `public/assets/tailwind/tailwind.css`.

**Visual direction:** [Tatem on Refero](https://styles.refero.design/style/cb6e4ab0-b8fe-45b0-bd22-6339b073e26d) — midnight-terminal clarity, restrained blue accent, Inter typography, comfortable spacing.

**Theme default:** light + `Blue_Theme`. Dark mode via `data-theme="dark"` on `<html>` (toggle in header).

---

## File Map

| Purpose | Path |
|---------|------|
| App shell (sidebar, header) | `src/utils/layout.ts` |
| Reusable HTML fragments | `src/utils/ui.ts` |
| TailwindAdmin source | `public/assets/tailwind/tailwind.input.css` |
| Compiled CSS (browser) | `public/assets/tailwind/tailwind.css` — run `npm run build:css` after editing source |
| HTQLVT overrides (font, tokens) | `public/assets/css/theme.css` |
| Sidebar/theme JS | `public/assets/js/app.init.js`, `app.min.js`, `theme.js` |
| Icons | Iconify Solar (`iconify-icon`) |

---

## Layout Shell (TailwindAdmin)

Every authenticated page uses `layout(title, content, user, activePageId)` from `src/utils/layout.ts`.

```html
<html lang="vi" dir="ltr"
  data-color-theme="Blue_Theme"
  data-layout="vertical"
  data-sidebartype="full"
  data-card="border"
  data-header-position="fixed">
<body>
  <aside class="left-sidebar ...">  <!-- 270px, role-filtered nav -->
  <div class="page-wrapper">
    <header class="topbar app-header">  <!-- page title, user, theme toggle -->
    <div class="body-wrapper">
      <div class="container py-6">  <!-- page content -->
```

**Do not** duplicate `layout()` per route. **Do not** load `cdn.tailwindcss.com` — use compiled `/assets/tailwind/tailwind.css` only.

After changing `tailwind.input.css` or utilities under `public/assets/tailwind/`, run:

```bash
npm run build:css
```

---

## Tokens — Colors

### TailwindAdmin (primary UI)

| Token | Role |
|-------|------|
| `--primary` | Buttons, active sidebar, links |
| `--secondary` | Secondary actions |
| `--info` / `--success` / `--warning` / `--error` | Status, alerts |
| `--border` / `--bordergray` | Card borders, inputs |
| `--bodytext` / `--link` | Body copy, nav text |
| `--dark` | Headings (light mode) |

Set via `data-color-theme="Blue_Theme"` on `<html>` (see `default_theme.css`).

### HTQLVT semantic (Tatem-inspired, in `theme.css`)

| Name | Value | CSS variable | Role |
|------|-------|--------------|------|
| Cerulean Accent | `#007eed` | `--htql-accent` | KPI highlights, chart series |
| Twilight Ink | `#0f1419` | `--htql-ink` | Dark mode page bg |
| Polar White | `#ffffff` | `--htql-surface` | Cards (light) |
| Pewter Mist | `#919191` | `--htql-muted` | Secondary labels |
| Charcoal Panel | `#3b3b3b` | `--htql-panel` | Dark mode cards |

---

## Tokens — Typography

- **Font:** Inter (`--theme-font` in `theme.css`), fallback `system-ui, sans-serif`
- **Scale:** TailwindAdmin utilities — `card-title` (18px semibold), body `text-sm` (14px)
- **Headings in pages:** use `pageHeader()` from `ui.ts` — `h1` via `card-title` scale
- **Vietnamese:** `lang="vi"` on `<html>`, `toLocaleString('vi-VN')` for numbers

| Role | Classes |
|------|---------|
| Page title | `text-xl font-semibold text-dark dark:text-white` |
| Card title | `card-title` |
| Card subtitle | `card-subtitle` |
| Table header | `caption` or `text-xs uppercase text-link` |
| Muted hint | `text-xs text-bodytext dark:text-darklink` |

---

## Tokens — Spacing & Shape

| Element | Value |
|---------|-------|
| Sidebar width | 270px (`layout.css` @1300px) |
| Card padding | `card-body` → 30px |
| Section gap | `mb-6` between blocks |
| Input/button radius | `rounded-md` (7px theme) |
| Container | `container` → max 1536px, px-5 |

---

## Components (use `src/utils/ui.ts`)

### Page header

```ts
pageHeader('Tuyến vận tải', {
  subtitle: 'Quản lý tuyến theo nhóm đầu mục VT',
  actions: btnPrimary('Tuyến mới', { icon: 'solar:add-circle-linear', onclick: 'showAddForm()' }),
});
```

### Card

```ts
card({ title: 'Danh sách', body: tableHtml });
card({ body: formHtml }); // no title
```

Classes: `card` + optional `card-body`, `card-title`, `card-subtitle`.

### Stat card (dashboard)

```ts
statCard('Khách hàng', '-', { id: 'stat-customers', href: '/doi-tac', hint: 'Xem danh sách →' });
```

### Table

```ts
dataTable(['Mã', 'Tên', ...], rowsHtml);
```

Wraps table in `card` with `overflow-x-auto`, thead uses muted uppercase headers.

### Forms

```ts
formGroup('Tên tuyến', input({ name: 'ten', required: true }));
select({ name: 'dau_muc_group', options: [...] });
```

Inputs use `form-control` class (TailwindAdmin).

### Buttons

| Helper | Class |
|--------|-------|
| `btnPrimary('Lưu')` | `btn` |
| `btnSecondary('Hủy')` | `btn-outline border-bordergray` |
| `btnDanger('Xóa')` | `btn-error` |
| `btnLightPrimary(...)` | `btn-light-primary` |

### Alerts

```ts
alert('error', 'Tên đăng nhập hoặc mật khẩu không đúng.');
```

### Badges

```ts
badge('Đang chạy', 'success'); // primary | success | warning | error | neutral
```

---

## Page Patterns

### List + inline form (CRUD)

1. `pageHeader` with primary action
2. Hidden `#addForm` → `card({ title: 'Thêm mới', body: form })`
3. `dataTable(...)` for list
4. Vanilla `fetch` to `/api/...`, `location.reload()` on success

### Dashboard

1. Row of `statCard` (grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6`)
2. Chart cards: `card({ title, body: '<div id="chart-..."></div>' })`
3. ApexCharts CDN in content only on dashboard

### Login (no layout)

Split panel: brand left (`lg:w-[55%]`, primary gradient), form right. Use `form-control`, `btn`, `card` classes. File: `src/routes/auth.ts`.

---

## Icons

Use Iconify Solar line icons (consistent with TailwindAdmin demo):

```html
<iconify-icon icon="solar:bus-2-linear" class="text-xl"></iconify-icon>
```

Load: `https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js`

---

## Dark Mode

- Toggle sets `document.documentElement.setAttribute('data-theme', 'dark'|'light')`
- TailwindAdmin: `dark:` variants + `dark.css`
- Persist in `localStorage` key `htqlvt-theme`
- Login page: light only

---

## Do's and Don'ts

### Do

- Import `layout` from `../utils/layout` and UI helpers from `../utils/ui`
- Escape user strings with `esc()` before embedding in HTML
- Use `card`, `btn`, `form-control` utilities from tailwind.css
- Keep sidebar nav in `ALL_NAV_ITEMS` with `roles` array
- Use `activePage` id matching nav `id` field

### Don't

- Don't add React/JSX or `cdn.tailwindcss.com`
- Don't create per-route `layout()` copies
- Don't use heavy box-shadows; prefer `data-card="border"` (bordered cards)
- Don't introduce colors outside primary palette + semantic status colors
- Don't use `tai_xe` table name in UI labels (use Nhân viên / Lái xe)

---

## Agent Prompt Guide

### New list page

```
Create src/routes/foo.ts following tuyen.ts:
- import { layout } from '../utils/layout'
- import { pageHeader, card, dataTable, btnPrimary, formGroup, input } from '../utils/ui'
- return c.html(layout('Tiêu đề', content, user, 'foo'))
- Mount in index.ts as protectedApp.route('/foo', fooRoutes)
- Add nav item to ALL_NAV_ITEMS in layout.ts with roles
```

### Quick color reference

- Text primary: `text-dark dark:text-white`
- Text muted: `text-bodytext` / `text-link`
- Background page: `bg-lightgray` (body default via theme)
- CTA: `btn` (primary)
- Accent KPI: `#007eed` / `text-primary`

---

## Similar References

- **TailwindAdmin** — sidebar + card dashboard structure
- **Tatem** — dark terminal restraint, single blue accent
- **Linear / Supabase dark** — data-dense tables, minimal chrome
