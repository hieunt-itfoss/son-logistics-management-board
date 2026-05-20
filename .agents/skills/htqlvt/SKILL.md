# HTQLVT - Transport Management System Skill

## Overview

Vietnamese transport management system (Hệ thống Quản lý Vận tải) for Son Logistics. Manages customers, suppliers, routes, vehicles, drivers, and trips. Runs entirely on Cloudflare Workers with D1 (SQLite) and server-side rendered HTML.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (`compatibility_date: 2026-05-18`, `nodejs_compat`) |
| Framework | Hono v4 (`hono`) - web framework with typed context |
| Database | Cloudflare D1 (SQLite) via `wrangler` migrations |
| UI | Tailwind CSS v4 + custom theme CSS, plain HTML SSR (no React/JSX) |
| Auth | Session-based, HMAC-SHA256 password hashing, HTTP-only cookies |
| Build | Wrangler CLI v4 |
| Test | Vitest v4 |
| TS | TypeScript v6, `@cloudflare/workers-types` |

## Project Structure

```
he-thong-quan-ly/
├── src/
│   ├── index.ts              # Hono app entry, route mounting, health check
│   ├── types.ts              # TypeScript interfaces (Env, User, Session, entities)
│   ├── middleware/
│   │   └── auth.ts           # Session auth middleware, password hashing, cookie utils
│   ├── routes/
│   │   ├── auth.ts           # Login/logout (public)
│   │   ├── dashboard.ts      # Dashboard page + /api/dashboard/stats
│   │   ├── khach-hang.ts     # Customers CRUD
│   │   ├── hang.ts           # Suppliers CRUD
│   │   ├── tuyen.ts          # Routes CRUD
│   │   ├── xe.ts             # Vehicles CRUD
│   │   ├── tai-xe.ts         # Drivers CRUD
│   │   └── chuyen-xe.ts      # Trips CRUD
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 0001_initial_schema.sql
│   │   └── seed.sql          # Seed data (admin user, sample routes/suppliers/vehicles/drivers/customers)
│   └── utils/
│       └── index.ts          # formatDate, formatCurrency, generateEntityId, generateMaChuyen
├── public/
│   └── assets/
│       ├── tailwind/tailwind.css
│       ├── css/theme.css
│       ├── js/
│       ├── fonts/
│       └── images/
├── views/                    # (empty - placeholder for future templates)
├── wrangler.jsonc            # Workers config, D1 binding, assets
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## D1 Database Schema

Binding name: `DB` (accessed via `c.env.DB`)

### Tables

| Table | Vietnamese | Purpose | Key Fields |
|-------|-----------|---------|------------|
| `users` | - | Auth & authorization | id, username, password_hash, display_name, role, active |
| `sessions` | - | Session tokens | id, user_id, token, expires_at |
| `khach_hang` | Khách hàng | Customers | id, ma_kh (unique), ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia |
| `hang` | Hãng | Suppliers | id, ten, nuoc, dia_chi |
| `tuyen` | Tuyến | Routes | id, ten, diem_di, diem_den, tien_to, khoang_cach_km |
| `xe` | Xe | Vehicles | id, bien_so (unique), so_xe, loai_xe, trong_tai |
| `tai_xe` | Tài xế | Drivers | id, ten, sdt, cmnd, ghi_chu |
| `chuyen_xe` | Chuyến xe | Trips | id, tuyen_id→tuyen, xe_id→xe, tai_xe_id→tai_xe, ngay_di, ngay_den, trang_thai, ghi_chu |

### Key Constraints
- All IDs are TEXT (generated: `{prefix}-{timestamp36}-{random6}`)
- `users.role`: `admin | ke_toan | tai_xe | kho`
- `chuyen_xe.trang_thai`: `planned | dang_chay | hoan_thanh | huy`
- `khach_hang.danh_gia`: `` | `binhthuong` | `canhbao`
- Timestamps: `created_at`, `updated_at` default to `datetime('now')`
- Indexes on: sessions(token), sessions(user_id), chuyen_xe(tuyen_id), chuyen_xe(ngay_di)

### Hono Context VariableMap
```typescript
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}
```
Access via `c.get('user')` and `c.get('session')` in protected routes.

## Authentication

- **Session mechanism**: Token stored in HTTP-only cookie (`session_token`), checked against `sessions` table
- **Password hashing**: HMAC-SHA256 using `SESSION_SECRET` env var. Auto-upgrades plaintext passwords on first login.
- **Session duration**: 24 hours
- **Cookie flags**: HttpOnly, Secure (when deployed), SameSite=Strict
- **Auth also via header**: `Authorization: Bearer <token>` for API access
- **Default credentials**: admin / admin123 (stored plaintext in seed, auto-hashed on first login)

### Role Permissions
```typescript
admin:   ['dashboard', 'khach-hang', 'hang', 'tuyen', 'xe', 'tai-xe', 'chuyen-xe', 'users']
ke_toan: ['dashboard', 'khach-hang', 'hang', 'chuyen-xe']
tai_xe:  ['dashboard', 'chuyen-xe']
kho:     ['dashboard', 'kho']
```

### Route Protection
- Public: `/health`, `/login`, `/api/auth/login`, `/api/auth/logout`
- All other routes: protected by `authMiddleware` → redirects to `/login` (HTML) or returns 401 (API)

## Code Conventions

### NO React/JSX
All UI is rendered as HTML string template literals returned via `c.html()`. Each route file has its own `layout()` function.

### Route File Pattern
Every route file follows this exact structure:

```typescript
import { Hono } from 'hono';
import type { Env, EntityType } from '../types';

export const entityRoutes = new Hono<{ Bindings: Env }>();

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
  <nav><!-- shared nav bar with active page highlighted --></nav>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">${content}</main>
</body>
</html>`;
}

// Page route (SSR HTML)
entityRoutes.get('/', async (c) => {
  const user = c.get('user');
  // D1 query, build HTML, return c.html(layout(...))
});

// API routes (JSON)
entityRoutes.get('/api/entity', ...);
entityRoutes.post('/api/entity', ...);
entityRoutes.put('/api/entity/:id', ...);
entityRoutes.delete('/api/entity/:id', ...);
```

### Route Mounting (index.ts)
```typescript
const app = new Hono<{ Bindings: Env }>();
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/', authRoutes);  // public
const protectedApp = new Hono<{ Bindings: Env }>();
protectedApp.use('*', authMiddleware);
protectedApp.route('/', dashboardRoutes);
protectedApp.route('/khach-hang', khachHangRoutes);
// ... more routes
app.route('/', protectedApp);
export default app;
```

### D1 Query Pattern
Always use prepared statements with `.bind()`:
```typescript
const { results } = await c.env.DB.prepare('SELECT * FROM table ORDER BY col').all<Type>();
const row = await c.env.DB.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();
await c.env.DB.prepare('INSERT INTO table (col1, col2) VALUES (?, ?)').bind(val1, val2).run();
```

### ID Generation
```typescript
const id = `prefix-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
```
Prefix conventions: `USR-`, `SES-`, `kh-`, `h-`, `t-`, `x-`, `tx-`, `cx-`

### Nav Bar
Each route file has its own copy of the `layout()` function with the nav bar. The active page is highlighted with `text-blue-700 font-semibold` class while others use `text-gray-600 hover:text-gray-900`.

### Frontend JS
Inline `<script>` tags at the end of page content. Uses vanilla JS with `fetch()` API calls. Pattern: show/hide form, submit via fetch, `location.reload()` on success.

## Development Workflow

```bash
# Install dependencies
npm install

# Local development (Wrangler dev server)
npm run dev

# Run tests
npm test

# Apply D1 migrations locally
npm run db:migrate:local
# Equivalent: wrangler d1 migrations apply DB --local

# Apply D1 migrations to production
npm run db:migrate:remote
# Equivalent: wrangler d1 migrations apply DB --remote

# Seed local database
npm run db:seed
# Equivalent: wrangler d1 execute DB --local --file=src/db/seed.sql

# Deploy to Cloudflare
npm run deploy

# Generate Worker types
npm run types
```

### First-Time Setup
```bash
npm install
npm run db:migrate:local
npm run db:seed
npm run dev
# Open http://localhost:8787, login with admin / admin123
```

## Adding a New Entity (Step-by-Step)

### 1. Add D1 Migration
Create `src/db/migrations/NNNN_entity_name.sql`:
```sql
CREATE TABLE IF NOT EXISTS entity_name (
  id TEXT PRIMARY KEY,
  field1 TEXT NOT NULL,
  field2 TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
Apply: `npm run db:migrate:local`

### 2. Add TypeScript Interface
In `src/types.ts`:
```typescript
export interface EntityName {
  id: string;
  field1: string;
  field2: string;
  created_at: string;
  updated_at: string;
}
```

### 3. Create Route File
Create `src/routes/entity-name.ts` following the route file pattern above.

### 4. Mount Route
In `src/index.ts`:
```typescript
import { entityNameRoutes } from './routes/entity-name';
// Add inside protectedApp:
protectedApp.route('/entity-name', entityNameRoutes);
```

### 5. Update Navigation
Add the new nav link to every route file's `layout()` function (or consider extracting to a shared layout).

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SESSION_SECRET` | `wrangler.jsonc` vars | HMAC-SHA256 key for password hashing |
| `APP_NAME` | `wrangler.jsonc` vars | Display name: "Hệ thống quản lý vận tải" |

For production, set `SESSION_SECRET` via `wrangler secret put SESSION_SECRET`.

## Wrangler Configuration (wrangler.jsonc)

- **name**: `he-thong-quan-ly`
- **main**: `src/index.ts`
- **compatibility_date**: `2026-05-18`
- **compatibility_flags**: `["nodejs_compat"]`
- **assets.directory**: `./public` (serves static files from public/)
- **d1_databases**: binding `DB`, database `he-thong-quan-ly-db`, migrations from `src/db/migrations`

## Key Business Terms (Vietnamese-English)

| Vietnamese | English | Entity |
|-----------|---------|--------|
| Khách hàng | Customer | `khach_hang` |
| Hãng | Supplier/Carrier | `hang` |
| Tuyến | Route | `tuyen` |
| Xe | Vehicle | `xe` |
| Tài xế | Driver | `tai_xe` |
| Chuyến xe | Trip | `chuyen_xe` |
| Lô hàng | Cargo batch | (planned) |
| Phiếu thu | Receipt/Income | (planned) |
| Phiếu chi | Expense | (planned) |
| Kho | Warehouse | (planned) |
| Điểm đi | Departure point | `tuyen.diem_di` |
| Điểm đến | Destination | `tuyen.diem_den` |
| Biển số | License plate | `xe.bien_so` |
| Trọng tải | Load capacity | `xe.trong_tai` |
| Hạn thanh toán | Payment term (days) | `khach_hang.han_tt` |
| Đánh giá | Rating | `khach_hang.danh_gia` |
| Kế hoạch / Đang chạy / Hoàn thành / Hủy | Planned / Running / Completed / Cancelled | `chuyen_xe.trang_thai` |

## Known Patterns & Caveats

- **Layout duplication**: Each route file has its own `layout()` function with duplicated nav. When adding nav items, update ALL route files.
- **views/ directory**: Exists but empty. HTML templates live inline in route files.
- **No shared layout module**: Consider extracting if the project grows.
- **services/ directory**: Exists but empty. Business logic is inline in routes.
- **Planned features**: `kho` (warehouse), `lo-hang` (cargo batches), `thu-chi` (income/expense) are mentioned in role permissions but not yet implemented as routes.
- **Edit pattern**: Edit forms reuse the add form by fetching all records client-side and filtering by ID. Could be optimized with dedicated GET /api/entity/:id endpoints.
