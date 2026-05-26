# HTQLVT — Design System for AI Agents

> **Stack:** TailwindAdmin layout + Tatem tokens. SSR HTML only (no React).
> **Visual:** Midnight-terminal clarity — cool, precise, dark-mode-first with restrained blue accent.

**Template:** [TailwindAdmin React](https://react.tailwind-admin.com/) — vertical sidebar, fixed topbar, `card` / `btn` / `form-control` utilities from `public/assets/tailwind/tailwind.css`.

**Visual direction:** [Tatem](https://styles.refero.design/style/cb6e4ab0-b8fe-45b0-bd22-6339b073e26d) — a dark command-line interface with subtle interactive glows. Calm, quiet, systematic. Very sparing use of color; readability and information hierarchy through typographic sizing and achromatic value contrasts.

**Theme default:** light + `Blue_Theme`. Dark mode via `.dark` class on `<html>` (toggle in header). Dark mode is the primary visual design target.

**Similar brands:** Linear, Raycast, Notion (dark), Supabase (dark), Vercel (dark).

---

## File Map

| Purpose | Path |
|---------|------|
| App shell (sidebar, header) | `src/utils/layout.ts` |
| Reusable HTML fragments | `src/utils/ui.ts` |
| Shared modal system (CSS) | `public/assets/css/theme.css` (`.htql-modal-*` classes) |
| Shared modal system (JS) | `public/assets/js/htql-modal.js` (open/close/drag/Escape) |
| TailwindAdmin source | `public/assets/tailwind/tailwind.input.css` |
| Compiled CSS (browser) | `public/assets/tailwind/tailwind.css` — run `npm run build:css` after editing source |
| HTQLVT overrides (font, tokens) | `public/assets/css/theme.css` |
| Sidebar/theme JS | `public/assets/js/app.init.js`, `app.min.js` |
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

After changing `tailwind.input.css` or utilities under `public/assets/tailwind/`:

```bash
npm run build:css
```

---

## Tokens — Colors

### Tatem palette (source of truth)

| Name | Value | CSS variable | Role |
|------|-------|--------------|------|
| Twilight Ink | `#000000` | `--color-twilight-ink` | Page backgrounds (dark), section backgrounds, primary dark neutral |
| Polar White | `#ffffff` | `--color-polar-white` | Primary text on dark, header text, high-contrast elements |
| Pewter Mist | `#919191` | `--color-pewter-mist` / `--htql-muted` | Secondary text, subtle borders, inactive states, icon strokes |
| Silver Tone | `#b5b5b5` | `--color-silver-tone` | Muted headings and body text, softer contrast than white |
| Obsidian Grey | `#606060` | `--color-obsidian-grey` | Tertiary text, subtle backgrounds, borders |
| Charcoal Black | `#3b3b3b` | `--color-charcoal-black` / `--htql-panel` | Card/element backgrounds (dark), dividers, deeper shadows |
| Mist Grey | `#c2c2c2` | `--color-mist-grey` | Hover states on neutral elements, subtle accent backgrounds |
| Cerulean Accent | `#007eed` | `--color-cerulean-accent` / `--htql-accent` | Interactive elements, links, active states, indicators — the only saturated color |

### TailwindAdmin mapping (primary UI)

| Token | Role |
|-------|------|
| `--primary` | Buttons, active sidebar, links (maps to Cerulean Accent) |
| `--secondary` | Secondary actions |
| `--info` / `--success` / `--warning` / `--error` | Status, alerts |
| `--border` / `--bordergray` | Card borders, inputs |
| `--bodytext` / `--link` | Body copy, nav text |
| `--dark` | Headings (light mode) |
| `--darkborder` / `--darkgray` / `--darklink` | Dark mode variants |

Set via `data-color-theme="Blue_Theme"` on `<html>` (see `default_theme.css`).

### HTQLVT semantic (in `theme.css`)

| Name | Value | CSS variable | Role |
|------|-------|--------------|------|
| Cerulean Accent | `#007eed` | `--htql-accent` | KPI highlights, chart series |
| Twilight Ink | `#0f1419` | `--htql-ink` | Dark mode page bg |
| Polar White | `#ffffff` | `--htql-surface` | Cards (light) |
| Pewter Mist | `#919191` | `--htql-muted` | Secondary labels |
| Charcoal Panel | `#3b3b3b` | `--htql-panel` | Dark mode cards |

### Quick color reference

- Text (primary): `text-dark dark:text-white` — maps to Polar White on dark
- Text (muted): `text-bodytext` / `text-link` — maps to Silver Tone / Pewter Mist
- Background (page): `bg-lightgray` light / Twilight Ink dark
- CTA: `btn` class (primary Cerulean Accent)
- Accent KPI: `#007eed` / `text-primary`
- Borders: `border-bordergray dark:border-darkborder` — maps to Obsidian Grey

---

## Tokens — Typography

### Font: Inter (Tatem standard)

- **Family:** Inter (`--theme-font`), fallback `system-ui, sans-serif`
- **Weight:** 400 (regular) for body; 500–600 for headings and labels
- **Letter spacing:** subtly tight (`-0.007em` / `-0.1px`) for compact, functional feel
- **Vietnamese:** `lang="vi"` on `<html>`, `toLocaleString('vi-VN')` for numbers

### Type scale (Tatem reference)

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| Caption | 13px | 1.5 | -0.1px | `--text-caption` |
| Body | 16px | 1.5 | -0.1px | `--text-body` |
| Subheading | 20px | 1.2 | -0.14px | `--text-subheading` |
| Display | 40px | 1.2 | -0.28px | `--text-display` |

### TailwindAdmin mapping (what we actually use)

| Role | Classes |
|------|---------|
| Page title | `text-xl font-semibold text-dark dark:text-white` |
| Card title | `card-title` (18px semibold) |
| Card subtitle | `card-subtitle` |
| Table header | `caption` or `text-xs uppercase text-link` |
| Muted hint | `text-xs text-bodytext dark:text-darklink` |
| Modal title | `.htql-modal-title` (17px semibold, `text-dark dark:text-white`) |
| Modal label | `.htql-modal-label` (11px uppercase, letter-spacing 0.06em) |

---

## Tokens — Spacing & Shape

### Tatem reference

- **Base unit:** 4px
- **Density:** comfortable
- **Section gap:** 28px
- **Element gap:** 8px
- **Border radius:** default 6px, large 10px, hero elements 16px

### TailwindAdmin mapping (what we use)

| Element | Value |
|---------|-------|
| Sidebar width | 270px |
| Card padding | `card-body` → 30px |
| Section gap | `mb-6` (24px) between blocks |
| Input/button radius | `rounded-md` (7px theme) |
| Modal panel radius | `1rem` (16px) |
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
dataTable(headers, rows, { align: 'center' });
tableRow(cells, { align: 'center' });
tableActions(editOnclick, deleteOnclick, permOnclick, { center: true });
tableEmpty(colspan, message);
th('Label', { align: 'right' });
```

Wraps table in `card` with `overflow-x-auto`. Table class: `htql-table`. Action buttons: `htql-table-action`.

### Forms

```ts
formGroup('Tên tuyến', input({ name: 'ten', required: true }));
select({ name: 'dau_muc_group', options: [...] });
```

Inputs use `form-control` class (TailwindAdmin). Labels: `text-sm font-medium text-dark dark:text-white mb-2`.

### Buttons

| Helper | Class | Tatem mapping |
|--------|-------|---------------|
| `btnPrimary('Lưu')` | `btn` | Cerulean Accent bg, white text |
| `btnSecondary('Hủy')` | `btn-outline border-bordergray text-link dark:text-darklink` | Ghost/outline on dark |
| `btnDanger('Xóa')` | `btn-error` | Status error color |
| `btnLightPrimary(...)` | `btn-light-primary` | Soft accent bg |
| `btnModalChip(...)` | `.htql-modal-chip` | Outlined chip inside modals |
| `btnModalOutline(...)` | `.htql-modal-btn-outline` | Bordered button inside modals |

### Alerts & badges

```ts
alert('error', 'Tên đăng nhập hoặc mật khẩu không đúng.');
badge('Đang chạy', 'success'); // primary | success | warning | error | neutral
```

---

## Modals (shared system)

All modals use the unified system: CSS in `theme.css` (`.htql-modal-*`), JS in `htql-modal.js`, helpers in `ui.ts`.

### Structure

```ts
import { modalShell, modalFooterInner, modalFooterSplit, btnSecondary, btnPrimary } from '../utils/ui';

modalShell({
  id: 'myModal',
  title: 'Tiêu đề',
  icon: 'solar:document-text-linear',  // optional icon in header
  size: 'lg',                           // sm | md | lg | xl | 2xl
  body: `<form id="myForm" class="space-y-4">...</form>`,
  footer: modalFooterInner(
    btnSecondary('Huỷ', { onclick: 'htqlCloseModal("myModal")' }),
    btnPrimary('Lưu', { type: 'submit' }),
  ),
});
```

### Open / Close (client-side JS)

```js
htqlOpenModal('myModal');   // show modal, lock body scroll
htqlCloseModal('myModal');  // hide modal, restore scroll
```

Built-in behaviors (from `htql-modal.js`, loaded in every page via `layout.ts`):
- **Backdrop click** dismisses
- **Escape key** dismisses
- **`[data-htql-modal-close]`** button dismisses
- **Header drag** — grab `.htql-modal-drag-handle` (the header) to reposition
- **Body scroll lock** while open
- **z-index: 70** (above sidebar z-60)

### Sizes

| Size | `max-width` |
|------|-------------|
| `sm` | 24rem (384px) |
| `md` | 28rem (448px) |
| `lg` | 32rem (512px) |
| `xl` | 36rem (576px) |
| `2xl` | 42rem (672px) |
| Import modal | 48rem (768px, `.htql-import-modal`) |

### Footer patterns

```ts
// Right-aligned buttons
modalFooterInner(btnSecondary('Huỷ', ...), btnPrimary('Lưu', ...))

// Left danger + right actions (e.g. edit forms with delete)
modalFooterSplit(
  `<span id="delBtn" class="hidden">${btnDanger('Xoá', ...)}</span>`,
  `${btnSecondary('Hủy', ...)}${btnPrimary('Lưu', ...)}`,
)
```

### Dark mode safety

All modal classes use theme tokens (not hardcoded `text-gray-*` / `bg-white`):
- Panel: `var(--white)` / `dark: var(--dark)` with `var(--darkborder)` border
- Title: `var(--dark)` / `dark: var(--white)`
- Close button: `var(--bodytext)` → hover `var(--dark)` / dark variants
- Footer: `var(--light-dark)` border / `var(--darkborder)` dark
- Form labels inside modals: `text-dark dark:text-white`

### Import modal extras

The import modal uses additional CSS classes for its tabbed interface:
- `.htql-import-tab` / `.htql-import-tab.active` — type selector chips
- `.htql-import-dropzone` / `.dz-dragover` — file drop area
- `.htql-import-dropzone-text`, `.htql-import-dropzone-hint`, `.htql-import-file-name`

---

## Page Patterns

### List + inline form (CRUD)

1. `pageHeader` with primary action
2. Hidden `#addForm` → `card({ title: 'Thêm mới', body: form })`
3. `dataTable(...)` for list
4. Vanilla `fetch` to `/api/...`, `location.reload()` on success

### List + modal form (doi-tac pattern)

1. `pageHeader` with primary action opening modal
2. `modalShell(...)` with form in body
3. `htqlOpenModal(id)` / `htqlCloseModal(id)` in script
4. Fetch in form submit, `location.reload()` on success

### Dashboard

1. Row of `statCard` (grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6`)
2. Chart cards: `card({ title, body: '<div id="chart-..."></div>' })`
3. ApexCharts CDN in content only on dashboard

### Login (no layout)

Split panel: brand left (`lg:w-[55%]`, primary gradient), form right. Use `form-control`, `btn`, `card` classes. File: `src/routes/auth.ts`.

### Toolbar with search (doi-tac pattern)

Single row: primary button left, filters/search right (`flex-nowrap`, `justify-end`). Search input: `type="text"` (not `search` — avoids browser clear button), icon submit button inside relative wrapper.

---

## Icons

Use Iconify Solar line icons (consistent with TailwindAdmin demo):

```html
<iconify-icon icon="solar:bus-2-linear" class="text-xl"></iconify-icon>
```

Load: `https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js`

Icon color: inherit from parent. In dark mode, icons naturally pick up `--darklink` / `--white` from text color. For inactive/muted icons, use Pewter Mist (`#919191`).

---

## Dark Mode

- Toggle adds/removes `.dark` class on `<html>`
- TailwindAdmin: `dark:` variants from compiled CSS
- Persist in `localStorage` key `htqlvt-theme`
- Login page: light only
- **All new UI must include `dark:` variants** — never use bare `text-gray-*`, `bg-white`, `border-gray-*` without dark equivalents

### Dark mode color mapping

| Light | Dark | Usage |
|-------|------|-------|
| `--white` | `--dark` | Card/panel backgrounds |
| `--dark` | `--white` | Headings, primary text |
| `--bodytext` | `--darklink` | Secondary text |
| `--link` | `--darklink` | Nav text, table headers |
| `--lightgray` | `--darkgray` | Page bg, hover states |
| `--border` / `--bordergray` | `--darkborder` | Borders |
| `--light-dark` | `--darkborder` | Dividers |

---

## Tatem Component Patterns

### Ghost button (Tatem primary CTA)

```
Background: rgba(252, 252, 252, 0.08)
Text: rgba(255, 255, 255, 0.95)
Border: rgba(255, 255, 255, 0.06)
Radius: 8px
Padding: 10px 16px
```

In HTQLVT, this maps to `btnSecondary` in dark mode.

### Section divider

Height: 1px, Background: `#3b3b3b` (`--color-charcoal-black`). Provides subtle structural cues. In HTQLVT: `border-b border-light-dark dark:border-darkborder`.

### Accent label

Text: `#007eed`, Background: transparent, Font: Inter 13px. In HTQLVT: `text-primary text-xs`.

---

## Do's and Don'ts

### Do

- Import `layout` from `../utils/layout` and UI helpers from `../utils/ui`
- Escape user strings with `esc()` before embedding in HTML
- Use `card`, `btn`, `form-control` utilities from tailwind.css
- Keep sidebar nav in `ALL_NAV_ITEMS` with `roles` array
- Use `activePage` id matching nav `id` field
- Use Inter weight 400 for body text, 500–600 for labels/headings
- Apply Twilight Ink (`#000000`) for dark mode backgrounds
- Use Cerulean Accent (`#007eed`) exclusively for interactive highlights
- Maintain 6px default radius, 8px for buttons, 16px for hero/modal panels
- Use 8px element gap, 24–28px section gap
- **Always provide `dark:` variants** for text, bg, and border colors
- Use `modalShell()` for all new modals — never hand-roll modal structure
- Use `htqlOpenModal()` / `htqlCloseModal()` — never manipulate modal visibility directly

### Don't

- Don't add React/JSX or `cdn.tailwindcss.com`
- Don't create per-route `layout()` copies
- Don't use heavy shadows; prefer `data-card="border"` (bordered cards) and value contrast
- Don't introduce saturated colors beyond Cerulean Accent and status colors
- Don't use `tai_xe` table name in UI labels (use Nhân viên / Lái xe)
- Don't vary font families — Inter is the only typeface
- Don't use bare `text-gray-*`, `bg-white`, `border-gray-*` without dark counterparts
- Don't use `z-50` for modals (sidebar is z-60) — modals use z-70 via `.htql-modal-backdrop`
- Don't use `items-end` (bottom sheet) for modal positioning — modals center ~8vh from top
- Don't use busy backgrounds or textures; stick to solid dark neutrals

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

### New modal

```
Use modalShell() from '../utils/ui':
- modalShell({ id, title, size, body, footer })
- Footer: modalFooterInner(btnSecondary('Huỷ', ...), btnPrimary('Lưu', ...))
- Open: htqlOpenModal('id') / Close: htqlCloseModal('id')
- Form: use form-control, formGroup(), input(), select() inside body
- All labels: text-dark dark:text-white
```

---

## CSS Custom Properties (Tatem reference)

```css
:root {
  /* Tatem palette */
  --color-twilight-ink: #000000;
  --color-polar-white: #ffffff;
  --color-pewter-mist: #919191;
  --color-silver-tone: #b5b5b5;
  --color-obsidian-grey: #606060;
  --color-charcoal-black: #3b3b3b;
  --color-mist-grey: #c2c2c2;
  --color-cerulean-accent: #007eed;

  /* Typography */
  --font-inter: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --text-caption: 13px;
  --text-body: 16px;
  --text-subheading: 20px;
  --text-display: 40px;

  /* Spacing */
  --spacing-unit: 4px;
  --section-gap: 28px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-default: 6px;
  --radius-large: 10px;
  --radius-hero: 16px;
}
```
