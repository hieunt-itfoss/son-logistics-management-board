import { Hono } from "hono";
import type { Env, NhanVien, Role, AppVariables } from "../types";
import { layout } from "../utils/layout";
import {
  pageHeader,
  card,
  dataTable,
  tableRow,
  tableEmpty,
  tableActions,
  btnPrimary,
  btnSecondary,
  modalShell,
  modalFooterInner,
} from "../utils/ui";
import { ROLE_LABELS, hashPassword } from "../middleware/auth";
import {
  getEffectivePerms,
  parseCustomPerms,
  serializeCustomPerms,
  countCustomOverrides,
  OVERRIDABLE_PERM_KEYS,
  PERM_OVERRIDE_LABELS,
  type PermOverrideKey,
  type CustomPermOverrides,
} from "../utils/permissions";

export const managerRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

const NV_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  ketoanTruong: "Kế toán trưởng",
  ketoanVien: "Kế toán viên",
  nhanvien: "Nhân viên",
  kho: "Thủ kho",
  laixe: "Lái xe",
};
const ROLE_TAG: Record<string, string> = {
  admin: "bg-lightprimary text-primary",
  ketoanTruong: "bg-lightprimary text-primary",
  ketoanVien: "bg-lightinfo text-info",
  nhanvien: "bg-lightgray text-bodytext",
  kho: "bg-lightwarning text-warning",
  laixe: "bg-lightsuccess text-success",
};

const PERM_MATRIX_ROLES: Role[] = [
  "admin",
  "ketoanTruong",
  "ketoanVien",
  "nhanvien",
  "kho",
  "laixe",
];

function permCell(role: Role, key: PermOverrideKey): string {
  const v = getEffectivePerms(role, "{}")[key];
  return v
    ? '<span class="text-success font-bold">✓</span>'
    : '<span class="text-bodytext">—</span>';
}

const BACKUP_TABLES = [
  "nhan_vien",
  "cty_van_tai",
  "khach_hang",
  "hang",
  "tuyen",
  "xe",
  "bang_gia",
  "chuyen_xe",
  "lo_hang",
  "phieu_thu",
  "phieu_chi",
  "so_du_dau_ky",
  "users",
  "cham_cong",
  "audit_log",
];

const RESTORE_DELETE_ORDER = [
  "audit_log",
  "cham_cong",
  "phieu_chi",
  "phieu_thu",
  "lo_hang",
  "chuyen_xe",
  "bang_gia",
  "so_du_dau_ky",
  "xe",
  "tuyen",
  "hang",
  "khach_hang",
  "cty_van_tai",
  "nhan_vien",
];

managerRoutes.get("/", async (c) => {
  const user = c.get("user");
  const isAdmin = user.role === "admin";

  const countTables = [
    { label: "Khách hàng", sql: "SELECT COUNT(*) as c FROM khach_hang" },
    { label: "Hãng", sql: "SELECT COUNT(*) as c FROM hang" },
    { label: "Cty VT", sql: "SELECT COUNT(*) as c FROM cty_van_tai" },
    { label: "Tuyến", sql: "SELECT COUNT(*) as c FROM tuyen" },
    { label: "Chuyến", sql: "SELECT COUNT(*) as c FROM chuyen_xe" },
    { label: "Phiếu", sql: "SELECT COUNT(*) as c FROM lo_hang" },
    {
      label: "Phiếu thu",
      sql: "SELECT COUNT(*) as c FROM phieu_thu",
      cls: "text-success",
    },
    {
      label: "Phiếu chi",
      sql: "SELECT COUNT(*) as c FROM phieu_chi",
      cls: "text-error",
    },
    {
      label: "NV",
      sql: "SELECT COUNT(*) as c FROM nhan_vien WHERE active = 1",
    },
  ];

  const counts = await Promise.all(
    countTables.map(async (t) => {
      const row = await c.env.DB.prepare(t.sql).first<{ c: number }>();
      return { ...t, c: row?.c || 0 };
    }),
  );

  const { results: nvs } = await c.env.DB.prepare(
    `SELECT id, ten, vai_tro, sdt, so_giay_to, dia_chi, ghi_chu, active,
            COALESCE(custom_perms, '{}') as custom_perms
     FROM nhan_vien WHERE active = 1 ORDER BY vai_tro, ten`,
  ).all<NhanVien & { custom_perms: string }>();

  const { results: usersRaw } = await c.env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.active, u.must_change_password,
            COALESCE(u.nhan_vien_id, '') as nhan_vien_id,
            nv.ten as nv_ten
     FROM users u
     LEFT JOIN nhan_vien nv ON nv.id = u.nhan_vien_id
     ORDER BY u.role, u.username`,
  ).all<{
    id: string;
    username: string;
    display_name: string;
    role: string;
    active: number;
    must_change_password: number;
    nhan_vien_id: string;
    nv_ten: string | null;
  }>();

  const { results: nvsForSelect } = await c.env.DB.prepare(
    `SELECT id, ten, vai_tro FROM nhan_vien WHERE active = 1 ORDER BY ten`,
  ).all<{ id: string; ten: string; vai_tro: string }>();

  const { results: audits } = await c.env.DB.prepare(
    "SELECT * FROM audit_log ORDER BY ngay DESC, id DESC LIMIT 50",
  ).all<{
    ngay: string;
    gio: string;
    nguoi_label: string;
    hanh_dong: string;
    target: string;
    chi_tiet: string;
  }>();

  const summaryHtml = counts
    .map(
      (t) =>
        `<div class="card text-center py-3 ${t.cls || ""}">
      <div class="text-lg font-bold text-dark dark:text-white">${t.c}</div>
      <div class="text-xs text-bodytext dark:text-darklink">${t.label}</div>
    </div>`,
    )
    .join("");

  const matrixHead = PERM_MATRIX_ROLES.map(
    (r) =>
      `<th class="text-center text-xs">${esc(ROLE_LABELS[r]?.split("/")[0]?.trim() || r)}</th>`,
  ).join("");
  const matrixBody = OVERRIDABLE_PERM_KEYS.map((key) => {
    const cells = PERM_MATRIX_ROLES.map(
      (r) => `<td class="text-center">${permCell(r, key)}</td>`,
    ).join("");
    return `<tr><td class="text-sm font-medium">${esc(PERM_OVERRIDE_LABELS[key])}</td>${cells}</tr>`;
  }).join("");

  const nvRows = (nvs || [])
    .map((nv) => {
      const color = ROLE_TAG[nv.vai_tro] || "bg-lightgray text-bodytext";
      const n = countCustomOverrides(nv.custom_perms);
      const customBadge =
        n > 0
          ? `<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-lightwarning text-warning">${n} ghi đè</span>`
          : '<span class="text-xs text-bodytext">— mặc định —</span>';
      return tableRow(
        [
          `<span class="font-mono text-bodytext">${esc(nv.id)}</span>`,
          `<span class="font-medium text-dark dark:text-white">${esc(nv.ten)}</span>`,
          `<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium ${color}">${NV_ROLE_LABELS[nv.vai_tro] || nv.vai_tro}</span>`,
          customBadge,
          esc(nv.sdt || "—"),
          tableActions(
            `editNV('${nv.id}')`,
            isAdmin ? `deleteNV('${nv.id}')` : undefined,
            isAdmin ? `openNvPermModal('${nv.id}')` : undefined,
            { center: true },
          ),
        ],
        { align: "center" },
      );
    })
    .join("");

  const auditRows = audits
    .map(
      (a) =>
        `<div class="py-2 px-4 border-b border-light-dark text-sm text-bodytext flex flex-wrap gap-1">
      <span class="text-xs font-mono text-bodytext">${fmtDate(a.ngay)} ${a.gio || ""}</span>
      <span class="text-primary font-medium">${esc(a.nguoi_label || "")}</span>
      <span>— ${esc(a.hanh_dong || "")}</span>
      <strong class="text-dark dark:text-white">${esc(a.target || "")}</strong>
      <span class="text-bodytext">${esc(a.chi_tiet || "")}</span>
    </div>`,
    )
    .join("");

  const backupSection = isAdmin
    ? `
    ${card({
      title: "Backup / Restore",
      body: `
        <p class="text-sm text-bodytext mb-4">Tải backup JSON hoặc restore từ file backup (thay thế dữ liệu nghiệp vụ, giữ phiên đăng nhập).</p>
        <div class="flex flex-wrap gap-2">
          <a href="/manager/api/export-backup" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
            <iconify-icon icon="solar:download-linear"></iconify-icon> Tải backup JSON
          </a>
          <button type="button" onclick="pickRestoreBackup()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm hover:bg-amber-100">
            <iconify-icon icon="solar:upload-linear"></iconify-icon> Restore từ JSON
          </button>
          <button type="button" onclick="resetAllData()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm hover:bg-red-100">
            <iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon> Reset dữ liệu
          </button>
        </div>
        <input type="file" id="restoreFile" accept=".json" class="hidden">
      `,
      class: "mt-6",
    })}
    <script>
    document.getElementById('restoreFile')?.addEventListener('change', async function(ev) {
      const f = ev.target.files?.[0];
      if (!f) return;
      if (!confirm('Restore sẽ thay thế dữ liệu hiện tại. Tiếp tục?')) { ev.target.value = ''; return; }
      const text = await f.text();
      let data;
      try { data = JSON.parse(text); } catch { alert('File JSON không hợp lệ'); return; }
      const res = await fetch('/manager/api/import-backup', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      const err = await res.json().catch(() => ({}));
      if (res.ok) { alert('Đã restore backup'); location.reload(); }
      else { alert(err.error || 'Lỗi restore'); }
      ev.target.value = '';
    });
    function pickRestoreBackup() { document.getElementById('restoreFile').click(); }
    async function resetAllData() {
      if (!confirm('Xoá TOÀN BỘ dữ liệu nghiệp vụ? (giữ tài khoản đăng nhập)')) return;
      if (!confirm('Xác nhận lần 2: hành động không thể hoàn tác.')) return;
      const res = await fetch('/manager/api/reset-data', { method: 'POST' });
      if (res.ok) { alert('Đã reset'); location.reload(); }
      else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `
    : "";

  const content = `
    ${pageHeader("Quản lý hệ thống", {
      actions: isAdmin
        ? btnPrimary("Thêm NV", {
            icon: "solar:add-circle-linear",
            onclick: "showAddNVForm()",
          })
        : "",
    })}

    <div class="grid gap-3 mb-6" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
      ${summaryHtml}
    </div>

    ${card({
      title: "Bảng phân quyền theo vai trò",
      subtitle:
        "Quyền mặc định theo vai trò (vai_tro). Admin ghi đè từng NV ở cột Thao tác.",
      body: `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr><th class="text-left py-2">Tính năng</th>${matrixHead}</tr></thead><tbody>${matrixBody}</tbody></table></div>`,
      class: "mb-6",
    })}

    ${dataTable(
      ["Mã", "Tên", "Vai trò", "Quyền tuỳ chỉnh", "SĐT", "Thao tác"],
      nvRows || tableEmpty(6),
      { align: "center" },
    )}

    ${
      isAdmin
        ? (() => {
            const userRows = (usersRaw || [])
              .map((u) => {
                const roleColor =
                  ROLE_TAG[u.role] || "bg-lightgray text-bodytext";
                const statusBadge = u.active
                  ? '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-lightsuccess text-success">Hoạt động</span>'
                  : '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-lighterror text-error">Đã khoá</span>';
                const mustChangeBadge = u.must_change_password
                  ? '<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-lightwarning text-warning">Phải đổi MK</span>'
                  : "—";
                const nvLink = u.nv_ten
                  ? `<span class="text-xs text-primary">${esc(u.nv_ten)}</span>`
                  : '<span class="text-xs text-bodytext">—</span>';
                const actions = `<div class="flex items-center gap-1">
          <button type="button" class="htql-table-action" onclick="openResetPwdModal('${u.id}','${esc(u.username)}')" title="Reset mật khẩu">
            <iconify-icon icon="solar:key-linear" width="18"></iconify-icon>
          </button>
          <button type="button" class="htql-table-action ${u.active ? "htql-table-action--delete" : ""}" onclick="toggleUser('${u.id}',${u.active})" title="${u.active ? "Khoá tài khoản" : "Mở khoá"}">
            <iconify-icon icon="${u.active ? "solar:forbidden-circle-linear" : "solar:check-circle-linear"}" width="18"></iconify-icon>
          </button>
        </div>`;
                return tableRow([
                  `<span class="font-mono text-bodytext text-xs">${esc(u.id)}</span>`,
                  `<div><div class="font-medium text-dark dark:text-white">${esc(u.username)}</div><div class="text-xs text-bodytext">${esc(u.display_name)}</div></div>`,
                  `<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium ${roleColor}">${NV_ROLE_LABELS[u.role] || u.role}</span>`,
                  nvLink,
                  mustChangeBadge,
                  statusBadge,
                  actions,
                ]);
              })
              .join("");
            return card({
              title: "Tài khoản đăng nhập",
              subtitle: `${(usersRaw || []).length} tài khoản`,
              actions: btnPrimary("Tạo tài khoản", {
                icon: "solar:add-circle-linear",
                onclick: "openCreateUserModal()",
              }),
              body: `<div class="overflow-x-auto"><table class="w-full text-sm">
          <thead><tr class="border-b border-light-dark">
            <th class="text-left py-2 px-3">Mã</th>
            <th class="text-left py-2 px-3">Tên đăng nhập / Họ tên</th>
            <th class="text-left py-2 px-3">Vai trò</th>
            <th class="text-left py-2 px-3">NV liên kết</th>
            <th class="text-left py-2 px-3">Đổi MK</th>
            <th class="text-left py-2 px-3">Trạng thái</th>
            <th class="text-left py-2 px-3">Thao tác</th>
          </tr></thead>
          <tbody>${userRows || `<tr><td colspan="7" class="py-12 text-center text-bodytext">Chưa có tài khoản</td></tr>`}</tbody>
        </table></div>`,
              class: "mt-6",
            });
          })()
        : ""
    }

    ${
      isAdmin
        ? `
    ${modalShell({
      id: "userPermModal",
      title: "Cấu hình quyền",
      titleId: "userPermTitle",
      size: "lg",
      body: `<div class="space-y-4">
          <p class="text-xs text-bodytext bg-lightprimary/30 dark:bg-darkborder rounded-lg p-3" id="userPermHint"></p>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Vai trò <span class="text-xs text-bodytext">(chỉ admin đổi được)</span></label>
            <select id="userPermRole" class="form-control w-full" title="Chỉ admin được đổi vai trò">
              ${PERM_MATRIX_ROLES.map((r) => `<option value="${r}">${esc(ROLE_LABELS[r] || r)}</option>`).join("")}
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="border-b border-light-dark dark:border-darkborder">
                <th class="text-left py-2 text-dark dark:text-white">Quyền</th>
                <th class="text-center py-2 text-dark dark:text-white">Mặc định</th>
                <th class="text-center py-2 text-dark dark:text-white">Ghi đè?</th>
                <th class="text-center py-2 text-dark dark:text-white">Giá trị</th>
              </tr></thead>
              <tbody id="userPermRows"></tbody>
            </table>
          </div>
        </div>`,
      footer: modalFooterInner(
        btnSecondary("Huỷ", { onclick: "closeUserPermModal()" }),
        btnPrimary("Lưu", { onclick: "saveUserPermModal()" }),
      ),
    })}
    <script>
    let editingNvId = null;
    let userPermDefaults = {};
    function closeUserPermModal() {
      htqlCloseModal('userPermModal');
      editingNvId = null;
    }
    function permBoolLabel(v) { return v ? '✓' : '—'; }
    async function openNvPermModal(nvId) {
      editingNvId = nvId;
      const res = await fetch('/manager/api/nhan-vien/' + encodeURIComponent(nvId) + '/perms');
      if (!res.ok) { alert('Không tải được nhân viên'); return; }
      const data = await res.json();
      document.getElementById('userPermTitle').textContent = '🔐 ' + data.ten;
      document.getElementById('userPermHint').innerHTML =
        'NV <b>' + data.id + '</b> — ' + data.ten + '. Tích &quot;Ghi đè&quot; để khác mặc định vai trò; bỏ tích = kế thừa.'
        + (data.linked_username ? ' Tài khoản <b>' + data.linked_username + '</b> sẽ đồng bộ khi lưu.' : '');
      document.getElementById('userPermRole').value = data.role;
      userPermDefaults = data.defaults || {};
      const overrides = data.overrides || {};
      const labels = ${JSON.stringify(PERM_OVERRIDE_LABELS)};
      const keys = ${JSON.stringify(OVERRIDABLE_PERM_KEYS)};
      let tbody = '';
      keys.forEach(function(k) {
        const def = userPermDefaults[k];
        const has = overrides[k] !== undefined;
        const val = has ? overrides[k] : true;
        tbody += '<tr class="border-b border-light-dark"><td>' + (labels[k] || k) + '</td>'
          + '<td class="text-center">' + permBoolLabel(def) + '</td>'
          + '<td class="text-center"><input type="checkbox" data-perm-key="' + k + '" data-override-cb ' + (has ? 'checked' : '') + '></td>'
          + '<td class="text-center"><select data-perm-key="' + k + '" data-perm-val ' + (has ? '' : 'disabled') + '>'
          + '<option value="true"' + (val === true ? ' selected' : '') + '>✓ Có</option>'
          + '<option value="false"' + (val === false ? ' selected' : '') + '>✗ Không</option></select></td></tr>';
      });
      document.getElementById('userPermRows').innerHTML = tbody;
      document.querySelectorAll('[data-override-cb]').forEach(function(cb) {
        cb.addEventListener('change', function() {
          const k = cb.getAttribute('data-perm-key');
          const sel = document.querySelector('[data-perm-val][data-perm-key="' + k + '"]');
          if (sel) sel.disabled = !cb.checked;
        });
      });
      document.getElementById('userPermRole').onchange = async function() {
        const r = this.value;
        const dr = await fetch('/manager/api/role-defaults/' + r);
        if (dr.ok) { userPermDefaults = await dr.json(); refreshDefaultCells(); }
      };
      htqlOpenModal('userPermModal');
    }
    function refreshDefaultCells() {
      const rows = document.getElementById('userPermRows').querySelectorAll('tr');
      const keys = ${JSON.stringify(OVERRIDABLE_PERM_KEYS)};
      rows.forEach(function(tr, i) {
        const td = tr.querySelectorAll('td')[1];
        if (td && keys[i]) td.textContent = permBoolLabel(userPermDefaults[keys[i]]);
      });
    }
    async function saveUserPermModal() {
      if (!editingNvId) return;
      const overrides = {};
      document.querySelectorAll('[data-override-cb]').forEach(function(cb) {
        const k = cb.getAttribute('data-perm-key');
        if (cb.checked) {
          const sel = document.querySelector('[data-perm-val][data-perm-key="' + k + '"]');
          overrides[k] = sel && sel.value === 'true';
        }
      });
      const res = await fetch('/manager/api/nhan-vien/' + encodeURIComponent(editingNvId) + '/perms', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          vai_tro: document.getElementById('userPermRole').value,
          custom_perms: overrides
        })
      });
      if (res.ok) { closeUserPermModal(); location.reload(); }
      else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
    `
        : ""
    }

    ${card({
      title: `Audit log gần nhất (${audits.length})`,
      body: `<div class="max-h-[400px] overflow-y-auto">${auditRows || '<p class="py-12 text-center text-bodytext">Chưa có hoạt động</p>'}</div>`,
      class: "mt-6",
    })}

    ${backupSection}

    ${
      isAdmin
        ? `
    ${modalShell({
      id: "createUserModal",
      title: "Tạo tài khoản đăng nhập",
      size: "md",
      body: `<form id="createUserForm" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-dark dark:text-white mb-1">Tên đăng nhập <span class="text-error">*</span></label>
                <input type="text" name="username" required class="form-control w-full" placeholder="VD: nhanvien01">
              </div>
              <div>
                <label class="block text-sm font-medium text-dark dark:text-white mb-1">Mật khẩu <span class="text-error">*</span></label>
                <input type="password" name="password" required minlength="6" class="form-control w-full" placeholder="Ít nhất 6 ký tự">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-dark dark:text-white pt-2 mb-1">Họ tên hiển thị <span class="text-error">*</span></label>
              <input type="text" name="display_name" required class="form-control w-full" placeholder="VD: Nguyễn Văn A">
            </div>
            <div class="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label class="block text-sm font-medium text-dark dark:text-white mb-1">Vai trò</label>
                <select name="role" class="form-control w-full">
                  ${PERM_MATRIX_ROLES.map((r) => `<option value="${r}">${esc(ROLE_LABELS[r] || r)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-dark dark:text-white mb-1">Liên kết NV</label>
                <select name="nhan_vien_id" class="form-control w-full">
                  <option value="">— Không liên kết —</option>
                  ${(nvsForSelect || []).map((nv) => `<option value="${nv.id}">${esc(nv.ten)} (${nv.id})</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="flex items-center gap-2 pt-2">
              <input type="checkbox" name="must_change_password" id="cuCreateMustChange" checked class="w-4 h-4 rounded border-bordergray text-primary">
              <label for="cuCreateMustChange" class="text-sm text-dark dark:text-white">Yêu cầu đổi mật khẩu lần đăng nhập đầu tiên</label>
            </div>
          </form>`,
      footer: modalFooterInner(
        btnSecondary("Huỷ", { onclick: "closeCreateUserModal()" }),
        `<button type="submit" form="createUserForm" class="btn cursor-pointer">Tạo tài khoản</button>`,
      ),
    })}

    ${modalShell({
      id: "resetPwdModal",
      title: "Reset mật khẩu",
      size: "sm",
      body: `<div class="space-y-3">
          <p class="text-sm text-bodytext">Tài khoản: <strong id="resetPwdUsername" class="text-dark dark:text-white"></strong></p>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Mật khẩu mới <span class="text-error">*</span></label>
            <input type="password" id="resetPwdNew" required minlength="6" class="form-control w-full" placeholder="Ít nhất 6 ký tự">
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="resetMustChange" checked class="w-4 h-4 rounded border-bordergray text-primary">
            <label for="resetMustChange" class="text-sm text-dark dark:text-white">Yêu cầu đổi mật khẩu lần đăng nhập đầu tiên</label>
          </div>
        </div>`,
      footer: modalFooterInner(
        btnSecondary("Huỷ", { onclick: "closeResetPwdModal()" }),
        btnPrimary("Lưu", { onclick: "saveResetPwd()" }),
      ),
    })}

    <script>
    let resetPwdUserId = null;

    function openCreateUserModal() { document.getElementById('createUserForm').reset(); htqlOpenModal('createUserModal'); }
    function closeCreateUserModal() { htqlCloseModal('createUserModal'); }

    document.getElementById('createUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        username: fd.get('username'),
        password: fd.get('password'),
        display_name: fd.get('display_name'),
        role: fd.get('role'),
        nhan_vien_id: fd.get('nhan_vien_id') || '',
        must_change_password: document.getElementById('cuCreateMustChange').checked ? 1 : 0,
      };
      const res = await fetch('/manager/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { closeCreateUserModal(); location.reload(); }
      else { const err = await res.json(); alert(err.error || 'Lỗi tạo tài khoản'); }
    });

    function openResetPwdModal(userId, username) {
      resetPwdUserId = userId;
      document.getElementById('resetPwdUsername').textContent = username;
      document.getElementById('resetPwdNew').value = '';
      document.getElementById('resetMustChange').checked = true;
      htqlOpenModal('resetPwdModal');
    }
    function closeResetPwdModal() { htqlCloseModal('resetPwdModal'); resetPwdUserId = null; }

    async function saveResetPwd() {
      if (!resetPwdUserId) return;
      const newPwd = document.getElementById('resetPwdNew').value;
      if (!newPwd || newPwd.length < 6) { alert('Mật khẩu phải có ít nhất 6 ký tự'); return; }
      const res = await fetch('/manager/api/users/' + encodeURIComponent(resetPwdUserId) + '/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd, must_change_password: document.getElementById('resetMustChange').checked ? 1 : 0 }),
      });
      if (res.ok) { closeResetPwdModal(); location.reload(); }
      else { const err = await res.json(); alert(err.error || 'Lỗi reset mật khẩu'); }
    }

    async function toggleUser(userId, currentActive) {
      const action = currentActive ? 'khoá' : 'mở khoá';
      if (!confirm('Bạn muốn ' + action + ' tài khoản này?')) return;
      const res = await fetch('/manager/api/users/' + encodeURIComponent(userId) + '/toggle', { method: 'POST' });
      if (res.ok) { location.reload(); }
      else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
    `
        : ""
    }

    ${
      isAdmin
        ? `
    ${modalShell({
      id: "addNVModal",
      title: "Thêm nhân viên",
      titleId: "nvModalTitle",
      size: "lg",
      body: `<form id="nvManagerForm" class="grid grid-cols-2 gap-4">
          <div class="col-span-2 sm:col-span-1">
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Mã NV</label>
            <input type="text" name="id" class="form-control w-full">
          </div>
          <div class="col-span-2 sm:col-span-1">
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Họ tên <span class="text-error">*</span></label>
            <input type="text" name="ten" required class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Vai trò</label>
            <select name="vai_tro" class="form-control w-full">
              ${Object.entries(NV_ROLE_LABELS)
                .map(([k, v]) => `<option value="${k}">${v}</option>`)
                .join("")}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">SĐT</label>
            <input type="text" name="sdt" class="form-control w-full">
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Địa chỉ</label>
            <input type="text" name="dia_chi" class="form-control w-full">
          </div>
        </form>`,
      footer: modalFooterInner(
        btnSecondary("Huỷ", { onclick: "hideNVForm()" }),
        `<button type="submit" form="nvManagerForm" class="btn cursor-pointer">Lưu</button>`,
      ),
    })}
    <script>
    let editingNVId = null;
    function showAddNVForm() { editingNVId = null; document.getElementById('nvModalTitle').textContent = 'Thêm nhân viên'; document.getElementById('nvManagerForm').reset(); htqlOpenModal('addNVModal'); }
    function hideNVForm() { htqlCloseModal('addNVModal'); }
    async function editNV(id) {
      editingNVId = id;
      const res = await fetch('/nhan-vien/api/nhan-vien/' + id);
      if (!res.ok) return alert('Không tìm thấy');
      const nv = await res.json();
      document.getElementById('nvModalTitle').textContent = 'Sửa ' + nv.id;
      const f = document.getElementById('nvManagerForm');
      f.id.value = nv.id || ''; f.ten.value = nv.ten || ''; f.vai_tro.value = nv.vai_tro || 'nhanvien'; f.sdt.value = nv.sdt || ''; f.dia_chi.value = nv.dia_chi || '';
      htqlOpenModal('addNVModal');
    }
    async function deleteNV(id) {
      if (!confirm('Xoá nhân viên ' + id + '?')) return;
      const res = await fetch('/nhan-vien/api/nhan-vien/' + id + '/delete', { method: 'POST' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    document.getElementById('nvManagerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch('/nhan-vien/api/nhan-vien', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });
    </script>
    `
        : ""
    }
  `;

  return c.html(layout("Quản lý", content, user, "manager"));
});

managerRoutes.get("/api/role-defaults/:role", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);
  const role = c.req.param("role") as Role;
  if (!PERM_MATRIX_ROLES.includes(role))
    return c.json({ error: "Invalid role" }, 400);
  const defaults = getEffectivePerms(role, "{}");
  const out: Record<string, boolean> = {};
  for (const k of OVERRIDABLE_PERM_KEYS) out[k] = defaults[k];
  return c.json(out);
});

async function findLinkedUser(
  db: D1Database,
  nvId: string,
  ten: string,
  vaiTro: Role,
): Promise<{ id: string; username: string } | null> {
  const byLink = await db
    .prepare(
      "SELECT id, username FROM users WHERE nhan_vien_id = ? AND active = 1",
    )
    .bind(nvId)
    .first<{ id: string; username: string }>();
  if (byLink) return byLink;

  const byName = await db
    .prepare(
      "SELECT id, username FROM users WHERE display_name = ? AND active = 1",
    )
    .bind(ten)
    .first<{ id: string; username: string }>();
  if (byName) return byName;

  const { results } = await db
    .prepare("SELECT id, username FROM users WHERE role = ? AND active = 1")
    .bind(vaiTro)
    .all<{ id: string; username: string }>();
  if (results?.length === 1) return results[0];
  return null;
}

managerRoutes.get("/api/nhan-vien/:id/perms", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, ten, vai_tro, COALESCE(custom_perms, '{}') as custom_perms
     FROM nhan_vien WHERE id = ? AND active = 1`,
  )
    .bind(id)
    .first<{ id: string; ten: string; vai_tro: Role; custom_perms: string }>();

  if (!row) return c.json({ error: "Not found" }, 404);

  const role = row.vai_tro;
  const overrides = parseCustomPerms(row.custom_perms);
  const defaults = getEffectivePerms(role, "{}");
  const defaultOut: Record<string, boolean> = {};
  for (const k of OVERRIDABLE_PERM_KEYS) defaultOut[k] = defaults[k];

  const linked = await findLinkedUser(c.env.DB, row.id, row.ten, role);

  return c.json({
    id: row.id,
    ten: row.ten,
    role,
    overrides,
    defaults: defaultOut,
    effective: getEffectivePerms(role, row.custom_perms),
    linked_username: linked?.username || null,
  });
});

managerRoutes.post("/api/nhan-vien/:id/perms", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const id = c.req.param("id");
  const body = await c.req.json<{
    vai_tro?: Role;
    custom_perms?: CustomPermOverrides;
  }>();

  const nv = await c.env.DB.prepare(
    "SELECT id, ten, vai_tro FROM nhan_vien WHERE id = ? AND active = 1",
  )
    .bind(id)
    .first<{ id: string; ten: string; vai_tro: Role }>();
  if (!nv) return c.json({ error: "Not found" }, 404);

  let role = nv.vai_tro;
  if (body.vai_tro && body.vai_tro !== nv.vai_tro) {
    if (!PERM_MATRIX_ROLES.includes(body.vai_tro)) {
      return c.json({ error: "Invalid role" }, 400);
    }
    role = body.vai_tro;
  }

  const customJson = serializeCustomPerms(body.custom_perms || {});

  await c.env.DB.prepare(
    `UPDATE nhan_vien SET vai_tro = ?, custom_perms = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(role, customJson, id)
    .run();

  const linked = await findLinkedUser(c.env.DB, id, nv.ten, role);
  if (linked) {
    await c.env.DB.prepare(
      `UPDATE users SET nhan_vien_id = ?, role = ?, custom_perms = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(id, role, customJson, linked.id)
      .run();
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Cấu hình quyền NV', ?, ?)`,
  )
    .bind(
      `AL-${Date.now()}`,
      user.role,
      user.display_name,
      id,
      `vai_tro=${role}; perms=${customJson}${linked ? "; user=" + linked.username : ""}`,
    )
    .run();

  return c.json({ success: true, linked_username: linked?.username || null });
});

// ── User account management APIs ──────────────────────────────────────────────

managerRoutes.post("/api/users", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const body = await c.req.json<{
    username: string;
    password: string;
    display_name: string;
    role: Role;
    nhan_vien_id?: string;
    must_change_password?: number;
  }>();

  if (!body.username?.trim() || !body.password || !body.display_name?.trim()) {
    return c.json({ error: "Tên đăng nhập, mật khẩu và họ tên bắt buộc" }, 400);
  }
  if (body.password.length < 6)
    return c.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, 400);
  if (!PERM_MATRIX_ROLES.includes(body.role))
    return c.json({ error: "Vai trò không hợp lệ" }, 400);

  const exists = await c.env.DB.prepare(
    "SELECT id FROM users WHERE username = ?",
  )
    .bind(body.username.trim())
    .first();
  if (exists) return c.json({ error: "Tên đăng nhập đã tồn tại" }, 409);

  const lastRow = await c.env.DB.prepare(
    "SELECT id FROM users WHERE id LIKE 'USR-%' ORDER BY id DESC LIMIT 1",
  ).first<{ id: string }>();
  const lastNum = lastRow ? parseInt(lastRow.id.replace("USR-", ""), 10) : 0;
  const newId = `USR-${String(lastNum + 1).padStart(3, "0")}`;

  const secret = (c.env.SESSION_SECRET ?? "").trim();
  const hash = await hashPassword(body.password, secret);
  const mustChange = body.must_change_password ?? 1;
  const nvId = body.nhan_vien_id?.trim() || "";

  await c.env.DB.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, nhan_vien_id, must_change_password, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(
      newId,
      body.username.trim(),
      hash,
      body.display_name.trim(),
      body.role,
      nvId,
      mustChange,
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Tạo tài khoản', ?, ?)`,
  )
    .bind(
      `AL-${Date.now()}`,
      user.role,
      user.display_name,
      newId,
      `username=${body.username}; role=${body.role}`,
    )
    .run();

  return c.json({ success: true, id: newId }, 201);
});

managerRoutes.post("/api/users/:id/reset-password", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const id = c.req.param("id");
  const body = await c.req.json<{
    password: string;
    must_change_password?: number;
  }>();

  if (!body.password || body.password.length < 6) {
    return c.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, 400);
  }

  const target = await c.env.DB.prepare(
    "SELECT id, username FROM users WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; username: string }>();
  if (!target) return c.json({ error: "Không tìm thấy tài khoản" }, 404);

  const secret = (c.env.SESSION_SECRET ?? "").trim();
  const hash = await hashPassword(body.password, secret);
  const mustChange = body.must_change_password ?? 1;

  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(hash, mustChange, id)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Reset mật khẩu', ?, ?)`,
  )
    .bind(
      `AL-${Date.now()}`,
      user.role,
      user.display_name,
      id,
      `username=${target.username}`,
    )
    .run();

  return c.json({ success: true });
});

managerRoutes.post("/api/users/:id/toggle", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const id = c.req.param("id");
  if (id === user.id)
    return c.json({ error: "Không thể khoá tài khoản đang đăng nhập" }, 400);

  const target = await c.env.DB.prepare(
    "SELECT id, username, active FROM users WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; username: string; active: number }>();
  if (!target) return c.json({ error: "Không tìm thấy tài khoản" }, 404);

  const newActive = target.active ? 0 : 1;
  await c.env.DB.prepare(
    `UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(newActive, id)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, ?, ?, ?)`,
  )
    .bind(
      `AL-${Date.now()}`,
      user.role,
      user.display_name,
      newActive ? "Mở khoá tài khoản" : "Khoá tài khoản",
      id,
      `username=${target.username}`,
    )
    .run();

  return c.json({ success: true, active: newActive });
});

// ── Backup / Restore APIs ──────────────────────────────────────────────────────

managerRoutes.get("/api/export-backup", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const data: Record<string, unknown> = {};
  for (const t of BACKUP_TABLES) {
    const { results } = await c.env.DB.prepare(`SELECT * FROM ${t}`).all();
    data[t] = results;
  }
  const json = JSON.stringify(data, null, 2);
  return new Response(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

managerRoutes.post("/api/import-backup", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const data = await c.req.json<Record<string, unknown[]>>();
  const db = c.env.DB;

  for (const t of RESTORE_DELETE_ORDER) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }

  const insertOrder = [
    "users",
    "nhan_vien",
    "cty_van_tai",
    "khach_hang",
    "hang",
    "tuyen",
    "xe",
    "bang_gia",
    "chuyen_xe",
    "lo_hang",
    "phieu_thu",
    "phieu_chi",
    "so_du_dau_ky",
    "cham_cong",
    "audit_log",
  ];

  for (const table of insertOrder) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows as Record<string, unknown>[]) {
      const cols = Object.keys(row);
      const placeholders = cols.map(() => "?").join(",");
      const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`;
      await db
        .prepare(sql)
        .bind(...cols.map((k) => row[k]))
        .run();
    }
  }

  await db
    .prepare(
      `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Restore backup', 'system', '')`,
    )
    .bind(`AL-${Date.now()}`, user.role, user.display_name)
    .run();

  return c.json({ success: true });
});

managerRoutes.post("/api/reset-data", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") return c.json({ error: "Chỉ admin" }, 403);

  const db = c.env.DB;
  for (const t of RESTORE_DELETE_ORDER) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }

  await db
    .prepare(
      `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Reset dữ liệu', 'system', 'Giữ users/sessions')`,
    )
    .bind(`AL-${Date.now()}`, user.role, user.display_name)
    .run();

  return c.json({ success: true });
});
