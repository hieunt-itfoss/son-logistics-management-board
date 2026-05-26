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

> **Stack:** TailwindAdmin layout + Tatem tokens. SSR HTML only (no React).
> **Visual:** Midnight-terminal clarity — cool, precise, dark-mode-first with Cerulean Accent (`#007eed`).
> **Source:** `DESIGN.md` — read for full detail when building UI.
> **Similar brands:** Linear, Raycast, Notion (dark), Supabase (dark), Vercel (dark).

### Design File Map

| Purpose | Path |
|---------|------|
| App shell (sidebar, header) | `src/utils/layout.ts` |
| Reusable HTML fragments + modals | `src/utils/ui.ts` |
| Shared modal CSS (`.htql-modal-*`) | `public/assets/css/theme.css` |
| Shared modal JS (open/close/drag) | `public/assets/js/htql-modal.js` |
| TailwindAdmin compiled CSS | `public/assets/tailwind/tailwind.css` — run `npm run build:css` after editing |
| HTQLVT overrides (font, tokens) | `public/assets/css/theme.css` |
| Icons | Iconify Solar (`iconify-icon`) |

### Tatem Color Palette

| Name | Value | Role |
|------|-------|------|
| Twilight Ink | `#000000` | Page backgrounds (dark), primary dark neutral |
| Polar White | `#ffffff` | Primary text on dark, high-contrast elements |
| Pewter Mist | `#919191` | Secondary text, subtle borders, inactive states, icon strokes |
| Silver Tone | `#b5b5b5` | Muted headings and body text, softer contrast than white |
| Obsidian Grey | `#606060` | Tertiary text, subtle backgrounds, borders |
| Charcoal Black | `#3b3b3b` | Card/element backgrounds (dark), dividers |
| Mist Grey | `#c2c2c2` | Hover states on neutral elements |
| Cerulean Accent | `#007eed` | Interactive elements, links, active states — **only saturated color** |

### TailwindAdmin Token Mapping

| Token | Role | Dark variant |
|-------|------|-------------|
| `--primary` | Buttons, active sidebar, links | same |
| `--dark` | Headings | `--white` |
| `--bodytext` / `--link` | Body copy, nav text | `--darklink` |
| `--border` / `--bordergray` | Borders, inputs | `--darkborder` |
| `--lightgray` | Page bg, hover | `--darkgray` |
| `--light-dark` | Dividers | `--darkborder` |

### Typography

- **Font:** Inter 400 (`--theme-font`), fallback `system-ui, sans-serif`
- **Letter spacing:** tight (`-0.1px`) for compact functional feel
- **Scale:** caption 13px, body 16px, subheading 20px, display 40px

| Role | Classes |
|------|---------|
| Page title | `text-xl font-semibold text-dark dark:text-white` |
| Card title | `card-title` |
| Table header | `text-xs uppercase text-link` |
| Muted hint | `text-xs text-bodytext dark:text-darklink` |
| Modal title | `.htql-modal-title` |

### Spacing & Shape

| Element | Value |
|---------|-------|
| Base unit | 4px, section gap 28px, element gap 8px |
| Sidebar | 270px |
| Card padding | `card-body` → 30px |
| Section gap | `mb-6` between blocks |
| Radius | default 6px, buttons 7px, modals 16px |
| Container | max 1536px, px-5 |

### UI Components (`src/utils/ui.ts`)

```ts
pageHeader('Title', { subtitle: '...', actions: btnPrimary('New', { icon: '...', onclick: '...' }) });
card({ title: 'List', body: tableHtml });
dataTable(headers, rows, { align: 'center' });
formGroup('Label', input({ name: '...', required: true }));
```

| Helper | Class |
|--------|-------|
| `btnPrimary('Lưu')` | `btn` (Cerulean bg, white text) |
| `btnSecondary('Hủy')` | `btn-outline border-bordergray text-link dark:text-darklink` |
| `btnDanger('Xóa')` | `btn-error` |
| `btnModalChip(...)` | `.htql-modal-chip` (outlined chip inside modals) |
| `btnModalOutline(...)` | `.htql-modal-btn-outline` (bordered modal button) |

### Modals (shared system)

All modals use `modalShell()` from `ui.ts` + CSS in `theme.css` + JS in `htql-modal.js`:

```ts
modalShell({
  id: 'myModal', title: 'Title', size: 'lg', // sm|md|lg|xl|2xl
  body: `<form ...>...</form>`,
  footer: modalFooterInner(btnSecondary('Huỷ', { onclick: 'htqlCloseModal("myModal")' }), btnPrimary('Lưu')),
});
```

Open: `htqlOpenModal('id')`. Close: `htqlCloseModal('id')`.
Built-in: backdrop click dismiss, Escape key, header drag-to-move, body scroll lock, z-index 70.

Footer patterns:
- `modalFooterInner(...)` — right-aligned buttons
- `modalFooterSplit(leftHtml, rightHtml)` — delete left + save/cancel right

### Dark Mode

- Toggle adds/removes `.dark` on `<html>`, persists in `localStorage` key `htqlvt-theme`
- **All new UI must include `dark:` variants** — never use bare `text-gray-*`, `bg-white`, `border-gray-*`
- Modals are fully dark-safe via `.htql-modal-*` classes (theme tokens, not hardcoded colors)

### Do / Don't

**Do:** Use `layout` + `ui.ts` helpers. Use theme tokens with `dark:` variants. Use `modalShell()` for modals. Use Inter 400 for body. Use Cerulean Accent only for interactive highlights.

**Don't:** Add React/JSX or `cdn.tailwindcss.com`. Duplicate `layout()`. Use heavy shadows. Introduce colors beyond palette + status. Use bare `text-gray-*` without dark variant. Use `z-50` for modals (sidebar is z-60). Use `items-end` bottom-sheet positioning for modals.

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
