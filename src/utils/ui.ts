/**
 * TailwindAdmin SSR UI helpers — see DESIGN.md
 */

export function pageHeader(
  title: string,
  opts?: { subtitle?: string; actions?: string },
): string {
  const subtitle = opts?.subtitle
    ? `<p class="card-subtitle mt-1">${opts.subtitle}</p>`
    : "";
  const actions = opts?.actions
    ? `<div class="flex flex-wrap items-center gap-2">${opts.actions}</div>`
    : "";
  return `
    <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
      <div>
        <h1 class="text-xl font-semibold text-dark dark:text-white">${title}</h1>
        ${subtitle}
      </div>
      ${actions}
    </div>`;
}

export function card(opts: {
  title?: string;
  subtitle?: string;
  actions?: string;
  body: string;
  class?: string;
  id?: string;
}): string {
  const idAttr = opts.id ? ` id="${opts.id}"` : "";
  const cls = opts.class ? ` ${opts.class}` : "";
  const head =
    opts.title || opts.subtitle || opts.actions
      ? `<div class="card-body border-b border-light-dark pb-4 flex items-start justify-between gap-3">
          <div>
            ${opts.title ? `<h2 class="card-title">${opts.title}</h2>` : ""}
            ${opts.subtitle ? `<p class="card-subtitle mt-1">${opts.subtitle}</p>` : ""}
          </div>
          ${opts.actions ? `<div class="shrink-0">${opts.actions}</div>` : ""}
        </div>`
      : "";
  const bodyPad =
    opts.title || opts.subtitle || opts.actions ? "p-[30px]" : "card-body";
  return `<div class="card${cls}"${idAttr}>${head}<div class="${bodyPad}">${opts.body}</div></div>`;
}

export function statCard(
  label: string,
  value: string,
  opts?: {
    id?: string;
    hint?: string;
    hintHtml?: string;
    href?: string;
    color?: "primary" | "success" | "warning" | "error";
  },
): string {
  const valueId = opts?.id ? ` id="${opts.id}"` : "";
  const colorClass =
    opts?.color === "success"
      ? "text-success"
      : opts?.color === "warning"
        ? "text-warning"
        : opts?.color === "error"
          ? "text-error"
          : "htql-stat-value";
  const link = opts?.href
    ? `<a href="${opts.href}" class="text-xs text-primary hover:underline mt-2 inline-block">${opts.hint ?? "Xem →"}</a>`
    : opts?.hintHtml
      ? `<p class="text-xs text-bodytext dark:text-darklink mt-1">${opts.hintHtml}</p>`
      : opts?.hint
        ? `<p class="text-xs text-bodytext dark:text-darklink mt-1">${opts.hint}</p>`
        : "";
  return `
    <div class="card animate-card">
      <div class="card-body">
        <p class="card-subtitle">${label}</p>
        <p class="text-3xl font-semibold ${colorClass} mt-2"${valueId}>${value}</p>
        ${link}
      </div>
    </div>`;
}

/** Compact KPI tile — TailwindAdmin dashboard style (icon + value row) */
export function kpiCard(
  label: string,
  value: string,
  opts?: {
    id?: string;
    hintHtml?: string;
    href?: string;
    icon?: string;
    tone?: "primary" | "success" | "warning" | "error" | "info";
  },
): string {
  const tone = opts?.tone ?? "primary";
  const iconBg: Record<string, string> = {
    primary: "bg-lightprimary text-primary",
    success: "bg-lightsuccess text-success",
    warning: "bg-lightwarning text-warning",
    error: "bg-lighterror text-error",
    info: "bg-lightinfo text-info",
  };
  const valueColor: Record<string, string> = {
    primary: "text-dark dark:text-white",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
    info: "text-info",
  };
  const valueId = opts?.id ? ` id="${opts.id}"` : "";
  const icon = opts?.icon ?? "solar:chart-2-bold-duotone";
  const hint = opts?.hintHtml
    ? `<p class="text-[11px] text-bodytext dark:text-darklink mt-0.5 leading-snug">${opts.hintHtml}</p>`
    : "";
  const linkWrap = opts?.href
    ? `<a href="${opts.href}" class="block hover:opacity-90 transition-opacity">`
    : "";
  const linkClose = opts?.href ? "</a>" : "";

  return `
    <div class="card h-full">
      ${linkWrap}
      <div class="htql-kpi-body">
        <div class="htql-kpi-icon ${iconBg[tone]}">
          <iconify-icon icon="${icon}" width="24"></iconify-icon>
        </div>
        <div class="htql-kpi-content min-w-0">
          <p class="text-xs font-medium text-bodytext dark:text-darklink truncate">${label}</p>
          <p class="text-base font-semibold ${valueColor[tone]} leading-tight mt-0.5 line-clamp-2"${valueId}>${value}</p>
          ${hint}
        </div>
      </div>
      ${linkClose}
    </div>`;
}

/** Compact panel for charts / tables on dashboard */
export function panelCard(opts: {
  title: string;
  body: string;
  class?: string;
  id?: string;
}): string {
  const idAttr = opts.id ? ` id="${opts.id}"` : "";
  const cls = opts.class ? ` ${opts.class}` : "";
  return `<div class="card h-full${cls}"${idAttr}>
    <div class="htql-panel-head">
      <h5 class="text-sm font-semibold text-dark dark:text-white">${opts.title}</h5>
    </div>
    <div class="htql-panel-body">${opts.body}</div>
  </div>`;
}

export function tableStart(headerRowHtml: string): string {
  return `<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="htql-table min-w-full w-full text-sm"><thead><tr class="border-b border-light-dark">${headerRowHtml}</tr></thead><tbody>`;
}

export function tableEnd(footerHtml = ""): string {
  const foot = footerHtml ? `<tfoot>${footerHtml}</tfoot>` : "";
  return `</tbody>${foot}</table></div></div>`;
}

export function th(
  text: string,
  opts?: { align?: "left" | "right" | "center" },
): string {
  const align =
    opts?.align === "right"
      ? " text-right"
      : opts?.align === "center"
        ? " text-center"
        : "";
  return `<th scope="col" class="${align.trim()}">${text}</th>`;
}

export function dataTable(
  headers: string[],
  bodyRows: string,
  opts?: { class?: string; align?: "left" | "right" | "center" },
): string {
  const extra = opts?.class ? ` ${opts.class}` : "";
  const alignClass =
    opts?.align === "right"
      ? " text-right"
      : opts?.align === "center"
        ? " text-center"
        : "";
  const ths = headers
    .map((h) => `<th scope="col" class="${alignClass.trim()}">${h}</th>`)
    .join("");
  return card({
    body: `<div class="overflow-x-auto -mx-[30px] px-[30px]">
      <table class="htql-table min-w-full w-full text-sm">
        <thead>
          <tr class="border-b border-light-dark">${ths}</tr>
        </thead>
        <tbody class="divide-y divide-border dark:divide-darkborder">${bodyRows}</tbody>
      </table>
    </div>`,
    class: extra,
  });
}

export function tableRow(
  cells: string[],
  opts?: { class?: string; align?: "left" | "right" | "center" },
): string {
  const cls = opts?.class ?? "";
  const alignClass =
    opts?.align === "right"
      ? " text-right"
      : opts?.align === "center"
        ? " text-center"
        : "";
  return `<tr class="${cls}">${cells.map((c) => `<td class="${alignClass.trim()}">${c}</td>`).join("")}</tr>`;
}

export function tableEmpty(
  colspan: number,
  message = "Chưa có dữ liệu",
): string {
  return `<tr><td colspan="${colspan}" class="py-12 text-center text-bodytext dark:text-darklink">${message}</td></tr>`;
}

export function tableActionLink(href: string, title = "Sửa"): string {
  return `<a href="${href}" class="htql-table-action htql-table-action--edit" title="${title}" aria-label="${title}">
        <iconify-icon icon="solar:pen-2-linear" width="18"></iconify-icon>
      </a>`;
}

export function tableActions(
  editOnclick?: string,
  deleteOnclick?: string,
  permOnclick?: string,
  opts?: { center?: boolean },
): string {
  const edit = editOnclick
    ? `<button type="button" class="htql-table-action htql-table-action--edit" onclick="${editOnclick}" title="Sửa" aria-label="Sửa">
        <iconify-icon icon="solar:pen-2-linear" width="18"></iconify-icon>
      </button>`
    : "";
  const perm = permOnclick
    ? `<button type="button" class="htql-table-action" onclick="${permOnclick}" title="Cấu hình quyền" aria-label="Cấu hình quyền">
        <iconify-icon icon="solar:shield-keyhole-linear" width="18"></iconify-icon>
      </button>`
    : "";
  const del = deleteOnclick
    ? `<button type="button" class="htql-table-action htql-table-action--delete" onclick="${deleteOnclick}" title="Xóa" aria-label="Xóa">
        <iconify-icon icon="solar:trash-bin-trash-linear" width="18"></iconify-icon>
      </button>`
    : "";
  if (!edit && !perm && !del) return "—";
  const flexCls = opts?.center
    ? "flex items-center justify-center gap-1"
    : "flex items-center gap-1";
  return `<div class="${flexCls}">${edit}${perm}${del}</div>`;
}

export function btnPrimary(
  label: string,
  opts?: { type?: string; onclick?: string; icon?: string; class?: string },
): string {
  const type = opts?.type ?? "button";
  const onclick = opts?.onclick ? ` onclick="${opts.onclick}"` : "";
  const icon = opts?.icon
    ? `<iconify-icon icon="${opts.icon}" class="text-lg"></iconify-icon>`
    : "";
  const extra = opts?.class ? ` ${opts.class}` : "";
  return `<button type="${type}" class="btn flex items-center gap-2 cursor-pointer${extra}"${onclick}>${icon}${label}</button>`;
}

export function btnSecondary(
  label: string,
  opts?: { type?: string; onclick?: string },
): string {
  const type = opts?.type ?? "button";
  const onclick = opts?.onclick ? ` onclick="${opts.onclick}"` : "";
  return `<button type="${type}" class="btn-outline border-bordergray text-link dark:text-darklink cursor-pointer"${onclick}>${label}</button>`;
}

export function btnDanger(label: string, opts?: { onclick?: string }): string {
  const onclick = opts?.onclick ? ` onclick="${opts.onclick}"` : "";
  return `<button type="button" class="btn-error cursor-pointer"${onclick}>${label}</button>`;
}

export function formGroup(
  label: string,
  control: string,
  opts?: { required?: boolean },
): string {
  const star = opts?.required ? ' <span class="text-error">*</span>' : "";
  return `
    <div>
      <label class="block text-sm font-medium text-dark dark:text-white mb-2">${label}${star}</label>
      ${control}
    </div>`;
}

export function input(
  attrs: Record<string, string | boolean | undefined>,
): string {
  const parts = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) =>
      v === true ? k : `${k}="${String(v).replace(/"/g, "&quot;")}"`,
    )
    .join(" ");
  return `<input class="form-control" ${parts}>`;
}

export function select(
  attrs: Record<string, string | boolean | undefined> & { options: string },
): string {
  const { options, ...rest } = attrs;
  const parts = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) =>
      v === true ? k : `${k}="${String(v).replace(/"/g, "&quot;")}"`,
    )
    .join(" ");
  return `<select class="form-control w-full" ${parts}>${options}</select>`;
}

export function textarea(
  attrs: Record<string, string | boolean | undefined>,
): string {
  const value = attrs.value ?? "";
  const { value: _v, ...rest } = attrs;
  const parts = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) =>
      v === true ? k : `${k}="${String(v).replace(/"/g, "&quot;")}"`,
    )
    .join(" ");
  return `<textarea class="form-control" ${parts}>${value}</textarea>`;
}

export function alert(
  type: "error" | "success" | "warning" | "info",
  message: string,
): string {
  const map = {
    error: "bg-lighterror text-error border-error/20",
    success: "bg-lightsuccess text-success border-success/20",
    warning: "bg-lightwarning text-warning border-warning/20",
    info: "bg-lightinfo text-info border-info/20",
  };
  return `<div class="mb-4 p-3 rounded-md border text-sm ${map[type]}">${message}</div>`;
}

export function badge(
  text: string,
  variant: "primary" | "success" | "warning" | "error" | "neutral" = "neutral",
): string {
  const map = {
    primary: "bg-lightprimary text-primary",
    success: "bg-lightsuccess text-success",
    warning: "bg-lightwarning text-warning",
    error: "bg-lighterror text-error",
    neutral: "bg-lightgray text-bodytext dark:bg-darkgray dark:text-darklink",
  };
  return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${map[variant]}">${text}</span>`;
}

export function badgeIcon(
  text: string,
  variant: "primary" | "success" | "warning" | "error" | "neutral" = "neutral",
  icon?: string,
): string {
  const iconHtml = icon
    ? `<iconify-icon icon="${icon}" width="14" class="shrink-0"></iconify-icon>`
    : "";
  const map = {
    primary: "bg-lightprimary text-primary",
    success: "bg-lightsuccess text-success",
    warning: "bg-lightwarning text-warning",
    error: "bg-lighterror text-error",
    neutral: "bg-lightgray text-bodytext dark:bg-darkgray dark:text-darklink",
  };
  return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${map[variant]}">${iconHtml}${text}</span>`;
}

export function linkBtn(
  href: string,
  label: string,
  className = "text-primary hover:underline cursor-pointer",
): string {
  return `<a href="${href}" class="${className}">${label}</a>`;
}

export function hidden(id: string, inner: string): string {
  return `<div id="${id}" class="hidden">${inner}</div>`;
}

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

const MODAL_SIZE_CLASS: Record<ModalSize, string> = {
  sm: "htql-modal-panel--sm",
  md: "htql-modal-panel--md",
  lg: "htql-modal-panel--lg",
  xl: "htql-modal-panel--xl",
  "2xl": "htql-modal-panel--2xl",
};

/** Shared modal shell: centered high on viewport, draggable header, dark-safe. */
export function modalShell(opts: {
  id: string;
  title: string;
  titleId?: string;
  icon?: string;
  body: string;
  footer?: string;
  size?: ModalSize;
  panelClass?: string;
}): string {
  const titleId = opts.titleId ?? `${opts.id}Title`;
  const sizeCls = MODAL_SIZE_CLASS[opts.size ?? "lg"];
  const panelExtra = opts.panelClass ? ` ${opts.panelClass}` : "";
  const iconBlock = opts.icon
    ? `<div class="htql-modal-icon"><iconify-icon icon="${opts.icon}"></iconify-icon></div>`
    : "";
  const footerBlock = opts.footer
    ? `<div class="htql-modal-footer">${opts.footer}</div>`
    : "";

  return `<div id="${opts.id}" class="htql-modal-backdrop hidden" data-htql-modal>
  <div class="htql-modal-panel ${sizeCls}${panelExtra}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    <div class="htql-modal-header htql-modal-drag-handle">
      <div class="htql-modal-header-title">
        ${iconBlock}
        <h2 class="htql-modal-title" id="${titleId}">${opts.title}</h2>
      </div>
      <button type="button" class="htql-modal-close" data-htql-modal-close aria-label="Đóng">
        <iconify-icon icon="solar:close-square-outline"></iconify-icon>
      </button>
    </div>
    <div class="htql-modal-body">${opts.body}</div>
    ${footerBlock}
  </div>
</div>`;
}

export function modalFooterInner(...buttons: string[]): string {
  return `<div class="htql-modal-footer-inner">${buttons.join("")}</div>`;
}

export function modalFooterSplit(left: string, right: string): string {
  return `<div class="htql-modal-footer-inner htql-modal-footer-split"><div>${left}</div><div class="htql-modal-footer-actions">${right}</div></div>`;
}

export function btnModalChip(
  label: string,
  opts?: { onclick?: string; icon?: string },
): string {
  const onclick = opts?.onclick ? ` onclick="${opts.onclick}"` : "";
  const icon = opts?.icon
    ? `<iconify-icon icon="${opts.icon}"></iconify-icon>`
    : "";
  return `<button type="button" class="htql-modal-chip"${onclick}>${icon}${label}</button>`;
}

export function btnModalOutline(
  label: string,
  opts?: { onclick?: string; icon?: string; type?: string; disabled?: boolean },
): string {
  const type = opts?.type ?? "button";
  const onclick = opts?.onclick ? ` onclick="${opts.onclick}"` : "";
  const disabled = opts?.disabled ? " disabled" : "";
  const icon = opts?.icon
    ? `<iconify-icon icon="${opts.icon}"></iconify-icon>`
    : "";
  return `<button type="${type}" class="htql-modal-btn-outline"${onclick}${disabled}>${icon}${label}</button>`;
}

/**
 * Shared search input with magnifier icon.
 * Width auto-calculated from placeholder length via data-auto-width + JS.
 */
export function searchField(
  opts: {
    name?: string;
    value?: string;
    placeholder: string;
    extraInputClass?: string;
    auto?: boolean;
  },
): string {
  const name = opts.name ?? "q";
  const val = opts.value ?? "";
  const ph = opts.placeholder;
  const extra = opts.extraInputClass ? ` ${opts.extraInputClass}` : "";
  // auto: gõ chữ là tự tìm (debounce 350ms), không cần bấm nút/Enter
  const autoAttr = opts.auto
    ? ` oninput="clearTimeout(window.__htqlSearchT);window.__htqlSearchT=setTimeout(()=>this.form.submit(),350)"`
    : "";
  return `<div class="htql-search">
    <input type="text" name="${name}" autocomplete="off" value="${val}" placeholder="${ph}" class="htql-search-input${extra}" data-auto-width${autoAttr}>
    <button type="submit" class="htql-search-btn" title="Tìm" aria-label="Tìm">
      <iconify-icon icon="solar:magnifer-broken" class="text-lg"></iconify-icon>
    </button>
  </div>`;
}
