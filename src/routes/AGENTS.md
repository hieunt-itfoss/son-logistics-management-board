# Routes — src/routes/

12 Hono route files, all mounted in `src/index.ts` under `protectedApp` (auth required).

## Files
| File | Lines | Purpose |
|------|-------|---------|
| `auth.ts` | 172 | Login page + POST /api/auth/login + logout |
| `dashboard.ts` | 175 | Home page: summary cards, charts, recent activity |
| `doi-tac.ts` | 1478 | Combined KH/Hang/CtyVT CRUD with debt calculation |
| `tuyen.ts` | 394 | Route management (7 endpoints, color-coded by dau_muc_group) |
| `chuyen-xe.ts` | 740 | Trip management: list, create, edit, detail |
| `lo-hang.ts` | 1384 | Freight lot management: grid, detail, create, bulk |
| `kho.ts` | 139 | Warehouse: delivery tracking, storage fees |
| `nhan-vien.ts` | 346 | Staff CRUD with role filters, search, soft delete |
| `cham-cong.ts` | 166 | Attendance tracker with modal entry |
| `thu-chi.ts` | 804 | Income/expense receipts |
| `cong-cu.ts` | 165 | Tools dashboard: external links, fuel calculator |
| `manager.ts` | 205 | System mgmt: counts, staff list, audit log, JSON backup |

## Pattern (follow `tuyen.ts` as template)
```ts
import { Hono } from 'hono';
import type { Env, SomeType } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, btnPrimary, formGroup, input } from '../utils/ui';
// See DESIGN.md for UI conventions

export const xxxRoutes = new Hono<{ Bindings: Env }>();

// API endpoints (register BEFORE /:id to avoid wildcard match)
xxxRoutes.get('/api/xxx/:id', async (c) => { ... });
xxxRoutes.post('/api/xxx', async (c) => { ... });
xxxRoutes.put('/api/xxx/:id', async (c) => { ... });
xxxRoutes.post('/api/xxx/:id/delete', async (c) => { ... });

// List page
xxxRoutes.get('/', async (c) => {
  const user = c.get('user');
  // ... query DB, render HTML
  return c.html(layout('Page Title', content, user, 'xxx'));
});
```

## Role Visibility
Each route's nav item has `roles` array in `src/utils/layout.ts` ALL_NAV_ITEMS.
- `admin`, `ketoanTruong` → all tabs
- `ketoanVien`, `nhanvien` → most tabs (no manager)
- `kho` → lo-hang, kho tabs
- `laixe` → lo-hang tab only

## Mounting
Add to `src/index.ts`:
```ts
import { xxxRoutes } from './routes/xxx';
protectedApp.route('/xxx', xxxRoutes);
```
