# PROJECT KNOWLEDGE BASE — Hệ thống Quản lý Vận tải

**Stack:** Cloudflare Workers + Hono (SSR) + D1 (SQLite) + TailwindAdmin
**Deploy:** `npx wrangler deploy` → https://he-thong-quan-ly.xde-vietnam.workers.dev
**DB:** `npx wrangler d1 execute he-thong-quan-ly-db --local|--remote`

## STRUCTURE
```
he-thong-quan-ly/
├── src/
│   ├── index.ts              # Hono app entry, route mounting (11 tabs)
│   ├── types.ts              # 15 interfaces, 6-role type, constants
│   ├── middleware/
│   │   └── auth.ts           # HMAC-SHA256 sessions, 6-role permissions
│   ├── routes/               # 12 route files (see src/routes/AGENTS.md)
│   ├── db/
│   │   ├── migrations/       # 4 SQL migrations (see src/db/migrations/AGENTS.md)
│   │   └── seed.sql          # Sample data (6 users, 15 staff, 20 trips...)
│   └── utils/
│       ├── layout.ts         # TailwindAdmin shell: sidebar, topbar, role nav
│       └── ui.ts             # SSR UI helpers (card, table, forms) — see DESIGN.md
├── DESIGN.md                 # Design system for AI agents (TailwindAdmin + Tatem tokens)
├── public/                   # Static assets (TailwindAdmin template)
└── wrangler.jsonc            # CF config: D1 binding, assets, vars
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add new route | `src/routes/*.ts` + mount in `src/index.ts` | Follow `tuyen.ts` pattern |
| Change DB schema | `src/db/migrations/` | Add 0005_*.sql, apply with `wrangler d1 migrations apply` |
| Change auth/roles | `src/middleware/auth.ts` + `src/types.ts` | 6 roles: admin, ketoanTruong, ketoanVien, nhanvien, kho, laixe |
| Change UI layout | `src/utils/layout.ts` + `DESIGN.md` | TailwindAdmin shell; use `ui.ts` for pages |
| UI components (cards, tables) | `src/utils/ui.ts` | `pageHeader`, `card`, `dataTable`, `btnPrimary`, etc. |
| Change types | `src/types.ts` | All interfaces, Role/VaiTro unions |
| Seed data | `src/db/seed.sql` | INSERT OR IGNORE into all tables |
| Static assets | `public/assets/` | CSS, JS, fonts — served by Wrangler assets |
| Compile Tailwind | `npm run build:css` | Source: `tailwind.input.css` → output: `tailwind.css` |

## CONVENTIONS
- **DB access:** `c.env.DB.prepare(sql).bind(...).all<T>()` or `.first<T>()`
- **Auth:** `const user = c.get('user')` — typed as `{id, username, role, display_name}`
- **Layout:** `return c.html(layout('Page Title', content, user, 'active-tab-id'))`
- **Routes:** Each file exports `const xxxRoutes = new Hono<{Bindings: Env}>()`
- **Mounting:** `protectedApp.route('/path', xxxRoutes)` in index.ts
- **API endpoints:** Prefix with `/api/` within route file, e.g. `xxxRoutes.post('/api/xxx/:id/delete', ...)`
- **HTML escaping:** `function esc(s: string)` — always escape user data in templates
- **Role guards:** Check `user.role` at route level, not just in layout

## ANTI-PATTERNS
- **NEVER** reference `tai_xe` table — renamed to `nhan_vien WHERE vai_tro = 'laixe'`
- **NEVER** use `as any`, `@ts-ignore`, `@ts-expect-error`
- **NEVER** construct cookie strings manually — use `setSessionCookie()` / `clearSessionCookie()` from middleware
- **NEVER** use Node.js APIs (Workers runtime) — use Web Crypto, not crypto
- **NEVER** commit without `wrangler deploy --dry-run` passing first

## UNIQUE STYLES
- `danh_gia` CHECK constraint: only `''`, `'binhthuong'`, `'canhbao'` — no `'tot'`
- `INSERT OR IGNORE` for upserts (not `INSERT OR REPLACE` — triggers FK deletes)
- Session cookie: `Secure` flag set via middleware helpers only
- Password auto-upgrade: plaintext hashes upgraded to HMAC-SHA256 on first login

## COMMANDS
```bash
npx wrangler dev                    # Local dev server
npx wrangler deploy                 # Deploy to Cloudflare
npx wrangler deploy --dry-run       # Build check only
npx wrangler d1 migrations apply he-thong-quan-ly-db --local   # Apply local migrations
npx wrangler d1 migrations apply he-thong-quan-ly-db --remote  # Apply remote migrations
npx wrangler d1 execute he-thong-quan-ly-db --local --file src/db/seed.sql  # Seed local
```

## NOTES
- D1 does NOT enforce FK constraints by default, but wrangler enables them during migration apply
- `INSERT OR REPLACE` does DELETE+INSERT — breaks FK constraints. Use `INSERT OR IGNORE`
- Old `tai_xe` table still exists in DB (created in migration 0001, never dropped) but is empty
- `khach_hang.danh_gia_manual` column has no CHECK constraint (added via ALTER TABLE)
