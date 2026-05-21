# Hệ thống Quản lý Vận tải

A Vietnamese transport management system built on Cloudflare Workers + D1 database.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev)
- **Database**: Cloudflare D1 (SQLite)
- **UI**: TailwindAdmin (Tailwind CSS v4 + Preline UI)
- **Auth**: Session-based
- **CI/CD**: GitHub Actions

## Quick Start

```bash
npm install
npm run dev          # http://localhost:8787
npm run deploy       # Deploy to Cloudflare
```

## Project Structure

```
src/
  index.ts              # Hono app entry
  types.ts              # TypeScript interfaces
  middleware/auth.ts    # Session auth
  routes/               # Route handlers (SSR + API)
  db/migrations/        # D1 SQL migrations
  utils/                # Helpers
public/assets/          # TailwindAdmin CSS, JS, fonts
```

## Development

| Command                     | Description                    |
| --------------------------- | ------------------------------ |
| `npm run dev`               | Local dev server               |
| `npm run deploy`            | Deploy to Cloudflare           |
| `npm run typecheck`         | TypeScript (`tsc --noEmit`)    |
| `npm run check`             | Full CI checks locally         |
| `npm run db:migrate:local`  | Apply migrations locally       |
| `npm run db:migrate:remote` | Apply migrations to production |
| `npm run db:seed`           | Seed local database            |

## GitHub & CI

**CI** (`.github/workflows/ci.yml`) runs on every push/PR to `main` or `master`:

- TypeScript check
- Tailwind CSS build
- Vitest unit tests
- `wrangler deploy --dry-run` (bundle validation)

**Deploy** (`.github/workflows/deploy.yml`) runs on push to `main`/`master` after quality checks pass. Requires repository secret `CLOUDFLARE_API_TOKEN`.

### Create the repository

```bash
gh auth login
gh repo create he-thong-quan-ly --private --source=. --remote=origin --push
```

Or create the repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USER/he-thong-quan-ly.git
git push -u origin master
```

Add `CLOUDFLARE_API_TOKEN` under **Settings → Secrets and variables → Actions** for production deploys.


## License

MIT