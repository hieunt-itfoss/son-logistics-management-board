# HTQLVT - Transport Management System Skill

## Overview

Vietnamese transport management system (Hệ thống Quản lý Vận tải) for Son Logistics. Manages customers, suppliers, routes, vehicles, drivers, trips, cargo batches, warehouse, income/expense, and staff. Runs entirely on Cloudflare Workers with D1 (SQLite) and server-side rendered HTML.

**Canonical references:** `AGENTS.md` (project map), `DESIGN.md` (UI/design system), `src/routes/AGENTS.md` (routes).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (`compatibility_date: 2026-05-18`, `nodejs_compat`) |
| Framework | Hono v4 (`hono`) — typed context |
| Database | Cloudflare D1 (SQLite) via `wrangler` migrations |
| UI | TailwindAdmin layout + Tailwind CSS v4 + `theme.css`, plain HTML SSR (no React/JSX) |
| Icons | Iconify Solar (`iconify-icon`) |
| Auth | Session-based, HMAC-SHA256 password hashing, HTTP-only cookies |
| Build | Wrangler CLI v4 |
| Test | Vitest v4 |
| TS | TypeScript v6, `@cloudflare/workers-types` |

## Project Structure

```
he-thong-quan-ly/
├── src/
│   ├── index.ts              # Hono app entry, route mounting (11 tabs)
│   ├── types.ts              # Interfaces, 6-role type, constants
│   ├── middleware/
│   │   └── auth.ts           # HMAC-SHA256 sessions, 6-role permissions
│   ├── routes/               # 12 route files (see src/routes/AGENTS.md)
│   ├── db/
│   │   ├── migrations/       # SQL migrations
│   │   └── seed.sql
│   └── utils/
│       ├── layout.ts         # TailwindAdmin shell: sidebar, topbar, role nav
│       └── ui.ts             # SSR UI helpers — see Design System below
├── DESIGN.md                 # Full design system doc
├── public/assets/
│   ├── tailwind/tailwind.css # Compiled CSS (run npm run build:css after edits)
│   ├── css/theme.css         # HTQLVT tokens + table overrides
│   └── js/                   # Sidebar/theme JS
└── wrangler.jsonc
```

## Code Conventions

### NO React/JSX
All UI is HTML string template literals returned via `c.html()`.

### Shared layout (do NOT duplicate per route)
Import `layout` from `../utils/layout` and UI helpers from `../utils/ui`:

```typescript
import { Hono } from 'hono';
import type { Env } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, btnPrimary, formGroup, input } from '../utils/ui';

export const fooRoutes = new Hono<{ Bindings: Env }>();

fooRoutes.get('/', async (c) => {
  const user = c.get('user');
  const content = pageHeader('Tiêu đề', { actions: btnPrimary('Thêm', { icon: 'solar:add-circle-linear', onclick: '...' }) });
  return c.html(layout('Tiêu đề', content, user, 'foo'));
});
```

Mount in `src/index.ts`: `protectedApp.route('/foo', fooRoutes)`. Add nav item to `ALL_NAV_ITEMS` in `layout.ts` with `roles`.

### D1 Query Pattern
Always use prepared statements with `.bind()`:
```typescript
const { results } = await c.env.DB.prepare('SELECT * FROM table ORDER BY col').all<Type>();
const row = await c.env.DB.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();
await c.env.DB.prepare('INSERT INTO table (col1, col2) VALUES (?, ?)').bind(val1, val2).run();
```

### HTML escaping
Always escape user data before embedding in templates. Use local `esc()` or equivalent in route files.

### Frontend JS
Inline `<script>` at end of page content. Vanilla JS + `fetch()`, `location.reload()` on success.

## Authentication

- Session cookie via middleware helpers (`setSessionCookie` / `clearSessionCookie`) — never construct cookie strings manually
- Password: HMAC-SHA256 with `SESSION_SECRET`; auto-upgrades plaintext on first login
- **6 roles:** `admin`, `ketoanTruong`, `ketoanVien`, `nhanvien`, `kho`, `laixe`
- Access: `const user = c.get('user')` in protected routes

## Development Workflow

```bash
npm install
npm run dev                    # Local dev server
npm test
npm run build:css              # After editing tailwind.input.css
npx wrangler d1 migrations apply he-thong-quan-ly-db --local
npx wrangler d1 execute he-thong-quan-ly-db --local --file src/db/seed.sql
npx wrangler deploy --dry-run  # Required before commit
npx wrangler deploy
```

Default login: `admin` / `admin123`

## Anti-Patterns

- **NEVER** reference `tai_xe` table in UI — use `nhan_vien WHERE vai_tro = 'laixe'`
- **NEVER** duplicate `layout()` per route — use `src/utils/layout.ts`
- **NEVER** use React/JSX or `cdn.tailwindcss.com`
- **NEVER** use `as any`, `@ts-ignore`, `@ts-expect-error`
- **NEVER** use Node.js `crypto` — use Web Crypto in Workers runtime
- **NEVER** use `INSERT OR REPLACE` for upserts — use `INSERT OR IGNORE` (FK-safe)

---

## Design System

> **Stack:** TailwindAdmin layout + Tatem-inspired tokens. SSR HTML only (no React).
> **Source:** `DESIGN.md` — read for full detail when building UI.

**Template:** [TailwindAdmin React](https://react.tailwind-admin.com/) — vertical sidebar, fixed topbar, `card` / `btn` / `form-control` utilities from `public/assets/tailwind/tailwind.css`.

**Visual direction:** [Tatem on Refero](https://styles.refero.design/style/cb6e4ab0-b8fe-45b0-bd22-6339b073e26d) — midnight-terminal clarity, restrained blue accent, Inter typography, comfortable spacing.

**Theme default:** light + `Blue_Theme`. Dark mode via `data-theme="dark"` on `<html>` (toggle in header).

### Design File Map

| Purpose | Path |
|---------|------|
| App shell (sidebar, header) | `src/utils/layout.ts` |
| Reusable HTML fragments | `src/utils/ui.ts` |
| TailwindAdmin source | `public/assets/tailwind/tailwind.input.css` |
| Compiled CSS (browser) | `public/assets/tailwind/tailwind.css` — run `npm run build:css` after editing source |
| HTQLVT overrides (font, tokens) | `public/assets/css/theme.css` |
| Sidebar/theme JS | `public/assets/js/app.init.js`, `app.min.js`, `theme.js` |
| Icons | Iconify Solar (`iconify-icon`) |

### Layout Shell (TailwindAdmin)

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

After changing `tailwind.input.css` or utilities under `public/assets/tailwind/`:

```bash
npm run build:css
```

### Tokens — Colors

#### TailwindAdmin (primary UI)

| Token | Role |
|-------|------|
| `--primary` | Buttons, active sidebar, links |
| `--secondary` | Secondary actions |
| `--info` / `--success` / `--warning` / `--error` | Status, alerts |
| `--border` / `--bordergray` | Card borders, inputs |
| `--bodytext` / `--link` | Body copy, nav text |
| `--dark` | Headings (light mode) |

Set via `data-color-theme="Blue_Theme"` on `<html>`.

#### HTQLVT semantic (Tatem-inspired, in `theme.css`)

| Name | Value | CSS variable | Role |
|------|-------|--------------|------|
| Cerulean Accent | `#007eed` | `--htql-accent` | KPI highlights, chart series |
| Twilight Ink | `#0f1419` | `--htql-ink` | Dark mode page bg |
| Polar White | `#ffffff` | `--htql-surface` | Cards (light) |
| Pewter Mist | `#919191` | `--htql-muted` | Secondary labels |
| Charcoal Panel | `#3b3b3b` | `--htql-panel` | Dark mode cards |

### Tokens — Typography

- **Font:** Inter (`--theme-font` in `theme.css`), fallback `system-ui, sans-serif`
- **Scale:** TailwindAdmin utilities — `card-title` (18px semibold), body `text-sm` (14px)
- **Headings in pages:** use `pageHeader()` from `ui.ts`
- **Vietnamese:** `lang="vi"` on `<html>`, `toLocaleString('vi-VN')` for numbers

| Role | Classes |
|------|---------|
| Page title | `text-xl font-semibold text-dark dark:text-white` |
| Card title | `card-title` |
| Card subtitle | `card-subtitle` |
| Table header | `caption` or `text-xs uppercase text-link` |
| Muted hint | `text-xs text-bodytext dark:text-darklink` |

### Tokens — Spacing & Shape

| Element | Value |
|---------|-------|
| Sidebar width | 270px |
| Card padding | `card-body` → 30px |
| Section gap | `mb-6` between blocks |
| Input/button radius | `rounded-md` (7px theme) |
| Container | `container` → max 1536px, px-5 |

### UI Components (`src/utils/ui.ts`)

#### Page header
```ts
pageHeader('Tuyến vận tải', {
  subtitle: 'Quản lý tuyến theo nhóm đầu mục VT',
  actions: btnPrimary('Tuyến mới', { icon: 'solar:add-circle-linear', onclick: 'showAddForm()' }),
});
```

#### Card
```ts
card({ title: 'Danh sách', body: tableHtml });
card({ body: formHtml }); // no title
```
Classes: `card` + optional `card-body`, `card-title`, `card-subtitle`.

#### Stat card (dashboard)
```ts
statCard('Khách hàng', '-', { id: 'stat-customers', href: '/doi-tac', hint: 'Xem danh sách →' });
```

#### Table
```ts
dataTable(['Mã', 'Tên', ...], rowsHtml);
dataTable(headers, rows, { align: 'center' }); // optional column alignment
tableRow(cells, { align: 'center' });
tableActions(editOnclick, deleteOnclick, permOnclick, { center: true });
tableEmpty(colspan, message);
th('Label', { align: 'right' });
```
Wraps table in `card` with `overflow-x-auto`. Table class: `htql-table`. Action buttons: `htql-table-action`.

#### Forms
```ts
formGroup('Tên tuyến', input({ name: 'ten', required: true }));
select({ name: 'dau_muc_group', options: [...] });
```
Inputs use `form-control` class (TailwindAdmin).

#### Buttons

| Helper | Class |
|--------|-------|
| `btnPrimary('Lưu')` | `btn` |
| `btnSecondary('Hủy')` | `btn-outline border-bordergray` |
| `btnDanger('Xóa')` | `btn-error` |
| `btnLightPrimary(...)` | `btn-light-primary` |

#### Alerts & badges
```ts
alert('error', 'Tên đăng nhập hoặc mật khẩu không đúng.');
badge('Đang chạy', 'success'); // primary | success | warning | error | neutral
```

### Page Patterns

#### List + inline form (CRUD)
1. `pageHeader` with primary action
2. Hidden `#addForm` → `card({ title: 'Thêm mới', body: form })`
3. `dataTable(...)` for list
4. Vanilla `fetch` to `/api/...`, `location.reload()` on success

#### Dashboard
1. Row of `statCard` (grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6`)
2. Chart cards: `card({ title, body: '<div id="chart-..."></div>' })`
3. ApexCharts CDN in content only on dashboard

#### Login (no layout)
Split panel: brand left (`lg:w-[55%]`, primary gradient), form right. Use `form-control`, `btn`, `card` classes. File: `src/routes/auth.ts`.

#### Toolbar with search (doi-tac pattern)
Single row: primary button left, filters/search right (`flex-nowrap`, `justify-end`). Search input: `type="text"` (not `search` — avoids browser clear button), icon submit button inside relative wrapper.

### Icons

Use Iconify Solar line icons:
```html
<iconify-icon icon="solar:bus-2-linear" class="text-xl"></iconify-icon>
```
Load: `https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js`

### Dark Mode

- Toggle sets `document.documentElement.setAttribute('data-theme', 'dark'|'light')`
- TailwindAdmin: `dark:` variants + `dark.css`
- Persist in `localStorage` key `htqlvt-theme`
- Login page: light only

### Design Do's and Don'ts

#### Do
- Import `layout` from `../utils/layout` and UI helpers from `../utils/ui`
- Escape user strings with `esc()` before embedding in HTML
- Use `card`, `btn`, `form-control` utilities from tailwind.css
- Keep sidebar nav in `ALL_NAV_ITEMS` with `roles` array
- Use `activePage` id matching nav `id` field

#### Don't
- Don't add React/JSX or `cdn.tailwindcss.com`
- Don't create per-route `layout()` copies
- Don't use heavy box-shadows; prefer `data-card="border"` (bordered cards)
- Don't introduce colors outside primary palette + semantic status colors
- Don't use `tai_xe` table name in UI labels (use Nhân viên / Lái xe)

### Agent Prompt — New List Page

```
Create src/routes/foo.ts following tuyen.ts:
- import { layout } from '../utils/layout'
- import { pageHeader, card, dataTable, btnPrimary, formGroup, input } from '../utils/ui'
- return c.html(layout('Tiêu đề', content, user, 'foo'))
- Mount in index.ts as protectedApp.route('/foo', fooRoutes)
- Add nav item to ALL_NAV_ITEMS in layout.ts with roles
```

### Quick Color Reference

- Text primary: `text-dark dark:text-white`
- Text muted: `text-bodytext` / `text-link`
- Background page: `bg-lightgray` (body default via theme)
- CTA: `btn` (primary)
- Accent KPI: `#007eed` / `text-primary`

### Visual References

- **TailwindAdmin** — sidebar + card dashboard structure
- **Tatem** — dark terminal restraint, single blue accent
- **Linear / Supabase dark** — data-dense tables, minimal chrome

---

## Key Business Terms (Vietnamese-English)

| Vietnamese | English | Entity |
|-----------|---------|--------|
| Khách hàng | Customer | `khach_hang` |
| Hãng | Supplier/Carrier | `hang` |
| Tuyến | Route | `tuyen` |
| Xe | Vehicle | `xe` |
| Nhân viên / Lái xe | Staff / Driver | `nhan_vien` |
| Chuyến xe | Trip | `chuyen_xe` |
| Lô hàng | Cargo batch | `lo_hang` |
| Phiếu thu / chi | Receipt / Expense | `thu_chi` |
| Kho | Warehouse | `kho` |
| Điểm đi / đến | Departure / Destination | `tuyen.diem_di` / `diem_den` |
| Biển số | License plate | `xe.bien_so` |
| Hạn thanh toán | Payment term (days) | `khach_hang.han_tt` |
| Đánh giá | Rating | `khach_hang.danh_gia` (`''`, `binhthuong`, `canhbao` only) |

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SESSION_SECRET` | `wrangler.jsonc` vars / secret | HMAC-SHA256 key for password hashing |
| `APP_NAME` | `wrangler.jsonc` vars | Display name |
