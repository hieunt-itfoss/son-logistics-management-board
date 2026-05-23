# Routes — `src/routes/`

Hono route modules mounted from `src/index.ts`. Auth required except login/logout in `auth.ts`.

**Conventions:** follow `tuyen.ts`; use `layout` + `ui.ts` helpers — see root `AGENTS.md` and `DESIGN.md`.

## Files

| File | Mount path | Purpose |
|------|------------|---------|
| `auth.ts` | `/` (public + protected) | Login, logout, change password |
| `dashboard.ts` | `/` | Home: stats, charts, recent activity |
| `doi-tac.ts` | `/doi-tac` | Khách / Hãng / Cty VT (sub-tabs, debt) |
| `tuyen.ts` | `/tuyen` | Routes (tuyến), color by `dau_muc_group` |
| `chuyen-xe.ts` | `/chuyen-xe` | Trips: list, create, edit, detail |
| `lo-hang.ts` | `/lo-hang` | Freight lots: grid, detail, bulk |
| `kho.ts` | `/kho` | Warehouse: delivery, storage fees |
| `nhan-vien.ts` | `/nhan-vien` | Staff CRUD, filters, soft delete |
| `cham-cong.ts` | `/cham-cong` | Attendance |
| `thu-chi.ts` | `/thu-chi` | Income / expense receipts |
| `cong-cu.ts` | `/cong-cu` | Tools: links, fuel calculator |
| `manager.ts` | `/manager` | System: permissions matrix, users, backup |

## New route checklist

1. Add `src/routes/foo.ts` (export `fooRoutes`)
2. `protectedApp.route('/foo', fooRoutes)` in `src/index.ts`
3. Nav item in `ALL_NAV_ITEMS` (`src/utils/layout.ts`) with `roles`
4. Register `/api/...` routes **before** `/:id` wildcards
