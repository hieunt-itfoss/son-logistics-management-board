# Migrations — src/db/migrations/

4 SQL migrations, applied sequentially. D1 tracks applied migrations in `_wrangler_migrations` table.

## Migration History
| File | Purpose |
|------|---------|
| `0001_initial_schema.sql` | Core tables: users, sessions, khach_hang, hang, tuyen, xe, tai_xe, chuyen_xe, lo_hang, phieu_thu, phieu_chi |
| `0002_phase2_tables.sql` | Phase 2 additions |
| `0003_full_schema.sql` | nhan_vien (replaces tai_xe), cty_van_tai, bang_gia, cham_cong, audit_log, so_du_dau_ky; adds missing columns to existing tables; recreates users with 6-role CHECK |
| `0004_fix_chuyen_xe_fk.sql` | Recreates chuyen_xe table: fixes `tai_xe_id` FK from `tai_xe(id)` → `nhan_vien(id)` |

## Conventions
- **Naming:** `NNNN_descriptive_name.sql` (4-digit zero-padded)
- **Idempotent:** Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` (fails silently if exists)
- **FK constraints:** D1 doesn't enforce by default at runtime, but wrangler enables them during `migrations apply`
- **ALTER TABLE limitations:** SQLite can't drop columns or change constraints — must DROP + CREATE table

## Adding a Migration
1. Create `0005_description.sql` in this directory
2. Run `npx wrangler d1 migrations apply he-thong-quan-ly-db --local` to test
3. Run `npx wrangler d1 migrations apply he-thong-quan-ly-db --remote` for production

## Gotchas
- `INSERT OR REPLACE` = DELETE + INSERT — triggers FK constraint failures. Use `INSERT OR IGNORE`
- `tai_xe` table still exists (from 0001, never dropped) but is empty — all driver data is in `nhan_vien`
- `danh_gia` CHECK: `('', 'binhthuong', 'canhbao')` — no `'tot'`
- Migration 0003 drops and recreates `users` table (role mapping) and `sessions` table
