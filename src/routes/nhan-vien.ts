import { Hono } from 'hono';
import type { Env, NhanVien, VaiTro, AppVariables } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, dataTable, tableRow, tableEmpty, tableActionLink, tableActions, btnPrimary, searchField, formField, input, select, textarea } from '../utils/ui';

export const nhanVienRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const ROLE_LABELS: Record<VaiTro, string> = {
  admin: 'Admin / Điều hành',
  ketoanTruong: 'Kế toán trưởng',
  ketoanVien: 'Kế toán viên',
  nhanvien: 'Nhân viên',
  kho: 'Thủ kho',
  laixe: 'Lái xe',
};

const ROLE_COLORS: Record<VaiTro, { bg: string; text: string }> = {
  admin: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ketoanTruong: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ketoanVien: { bg: 'bg-blue-50', text: 'text-blue-600' },
  nhanvien: { bg: 'bg-gray-100', text: 'text-gray-600' },
  kho: { bg: 'bg-amber-100', text: 'text-amber-700' },
  laixe: { bg: 'bg-green-100', text: 'text-green-700' },
};

const ALL_ROLES: VaiTro[] = ['admin', 'ketoanTruong', 'ketoanVien', 'nhanvien', 'kho', 'laixe'];

function roleTag(vaiTro: VaiTro): string {
  const c = ROLE_COLORS[vaiTro] || ROLE_COLORS.nhanvien;
  const label = ROLE_LABELS[vaiTro] || vaiTro;
  return `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}">${label}</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===================== LIST =====================
nhanVienRoutes.get('/', async (c) => {
  const user = c.get('user');
  const filterRole = c.req.query('vai_tro') || '';
  const search = c.req.query('q') || '';

  let sql = 'SELECT * FROM nhan_vien WHERE active = 1';
  const binds: string[] = [];

  if (filterRole) {
    sql += ' AND vai_tro = ?';
    binds.push(filterRole);
  }

  if (search) {
    sql += ' AND (LOWER(ten) LIKE ? OR LOWER(id) LIKE ? OR LOWER(sdt) LIKE ?)';
    const q = `%${search.toLowerCase()}%`;
    binds.push(q, q, q);
  }

  sql += ' ORDER BY vai_tro, ten';

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<NhanVien>();
  const nvs = results as NhanVien[];

  const { results: countRows } = await c.env.DB.prepare(
    "SELECT vai_tro, COUNT(*) as cnt FROM nhan_vien WHERE active = 1 GROUP BY vai_tro"
  ).all<{ vai_tro: string; cnt: number }>();
  const roleCounts: Record<string, number> = {};
  let totalCount = 0;
  for (const r of countRows) {
    roleCounts[r.vai_tro] = r.cnt;
    totalCount += r.cnt;
  }

  const allFilterClass = !filterRole ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  let filterHtml = `<a href="/nhan-vien" class="px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${allFilterClass}">Tất cả (${totalCount})</a>`;
  for (const r of ALL_ROLES) {
    const cnt = roleCounts[r] || 0;
    if (cnt === 0) continue;
    const isActive = filterRole === r;
    const c2 = ROLE_COLORS[r as VaiTro];
    const activeCls = isActive ? `${c2.bg} ${c2.text} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    filterHtml += `<a href="/nhan-vien?vai_tro=${r}" class="px-3 py-1 rounded-full text-sm font-medium cursor-pointer ${activeCls}">${ROLE_LABELS[r]} (${cnt})</a>`;
  }

  const canEdit = c.get('perms').canEdit;
  const canDelete = c.get('perms').canDelete;

  const headers = ['Mã', 'Tên', 'Vai trò', 'SĐT', 'Địa chỉ', ...(canEdit ? ['Thao tác'] : [])];
  const rows = nvs.map((nv) => {
    const actions = canEdit
      ? `<div class="flex items-center justify-center gap-1">${tableActionLink(`/nhan-vien/${nv.id}/edit`)}${canDelete ? tableActions(undefined, `deleteNV('${nv.id}','${escapeHtml(nv.ten)}')`, undefined, { center: true }) : ''}</div>`
      : '';
    return tableRow([
      `<span class="font-mono text-bodytext">${nv.id}</span>`,
      `<span class="font-medium text-dark dark:text-white">${escapeHtml(nv.ten)}</span>`,
      roleTag(nv.vai_tro as VaiTro),
      escapeHtml(nv.sdt || '—'),
      escapeHtml(nv.dia_chi || '—'),
      ...(canEdit ? [actions] : []),
    ], { align: 'center' });
  }).join('');

  const content = `
    ${pageHeader('Nhân viên', {
      subtitle: `${nvs.length} nhân viên${filterRole ? ' (đã lọc)' : ''}`,
      actions: canEdit ? btnPrimary('Thêm nhân viên', { icon: 'solar:add-circle-linear', onclick: "location.href='/nhan-vien/create'" }) : '',
    })}

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      ${filterHtml}
    </div>

    <!-- Search -->
    <form method="GET" action="/nhan-vien" class="mb-4">
      <div class="flex items-center gap-2">
        ${filterRole ? `<input type="hidden" name="vai_tro" value="${filterRole}">` : ''}
        ${searchField({ value: escapeHtml(search), placeholder: 'Tìm theo tên, mã, SĐT...', auto: true })}
        ${search ? `<a href="/nhan-vien${filterRole ? '?vai_tro=' + filterRole : ''}" class="htql-dt-btn">✕</a>` : ''}
      </div>
    </form>

    ${dataTable(headers, rows || tableEmpty(canEdit ? 6 : 5), { align: 'center' })}

    ${canDelete ? `
    <script>
    async function deleteNV(id, ten) {
      if (!confirm('Xoá NV ' + ten + ' (' + id + ')?')) return;
      const res = await fetch('/nhan-vien/api/nhan-vien/' + id + '/delete', { method: 'POST' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>` : ''}
  `;

  return c.html(layout('Nhân viên', content, user, 'nhan-vien'));
});

// ===================== CREATE FORM =====================
nhanVienRoutes.get('/create', async (c) => {
  const user = c.get('user');
  if (!c.get('perms').canEdit) return c.redirect('/nhan-vien');

  const { results: maxRows } = await c.env.DB.prepare(
    "SELECT id FROM nhan_vien WHERE id LIKE 'NV-%' ORDER BY id DESC LIMIT 1"
  ).all<{ id: string }>();
  const lastNum = maxRows.length > 0 ? parseInt(maxRows[0].id.replace('NV-', ''), 10) : 0;
  const nextId = `NV-${String(lastNum + 1).padStart(3, '0')}`;

  const roleOptions = ALL_ROLES.map(r =>
    `<option value="${r}">${ROLE_LABELS[r]}</option>`
  ).join('');

  const content = nvFormHtml('Thêm nhân viên mới', nextId, '', '', 'laixe', '', '', '', '', roleOptions, false);

  return c.html(layout('Thêm nhân viên', content, user, 'nhan-vien'));
});

// ===================== EDIT FORM =====================
nhanVienRoutes.get('/:id/edit', async (c) => {
  const user = c.get('user');
  if (!c.get('perms').canEdit) return c.redirect('/nhan-vien');

  const id = c.req.param('id');
  const nv = await c.env.DB.prepare('SELECT * FROM nhan_vien WHERE id = ? AND active = 1').bind(id).first<NhanVien>();
  if (!nv) return c.redirect('/nhan-vien');

  const roleOptions = ALL_ROLES.map(r =>
    `<option value="${r}" ${r === nv.vai_tro ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`
  ).join('');

  const content = nvFormHtml(
    `Sửa NV ${nv.id}`,
    nv.id, nv.ten, nv.id, nv.vai_tro,
    nv.sdt, nv.so_giay_to, nv.dia_chi, nv.ghi_chu,
    roleOptions, true
  );

  return c.html(layout('Sửa nhân viên', content, user, 'nhan-vien'));
});

function nvFormHtml(
  title: string,
  id: string, ten: string, idField: string, vaiTro: string,
  sdt: string, soGiayTo: string, diaChi: string, ghiChu: string,
  roleOptions: string, isEdit: boolean,
): string {
  return `
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a href="/nhan-vien" class="text-gray-500 hover:text-gray-700">
          <iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon>
        </a>
        <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form id="nvForm" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${formField('Mã NV', input({
            type: 'text', name: 'id', value: escapeHtml(id),
            ...(isEdit ? { readonly: true, class: 'bg-lightgray dark:bg-darkgray text-bodytext' } : { required: true }),
          }), { required: !isEdit })}
          ${formField('Họ tên', input({ type: 'text', name: 'ten', value: escapeHtml(ten), required: true }), { required: true })}
          ${formField('Vai trò', select({ name: 'vai_tro', options: roleOptions }))}
          ${formField('SĐT', input({ type: 'text', name: 'sdt', value: escapeHtml(sdt), placeholder: '+48 ...' }))}
          ${formField('Số giấy tờ', input({ type: 'text', name: 'so_giay_to', value: escapeHtml(soGiayTo), placeholder: 'PESEL ...' }))}
          ${formField('Địa chỉ', input({ type: 'text', name: 'dia_chi', value: escapeHtml(diaChi) }))}
          <div class="sm:col-span-2">
            ${formField('Ghi chú', textarea({ name: 'ghi_chu', rows: 2, value: escapeHtml(ghiChu) }))}
          </div>
          <div class="sm:col-span-2 flex gap-3 pt-2">
            <button type="submit"
              class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm cursor-pointer">
              💾 ${isEdit ? 'Lưu' : 'Thêm'}
            </button>
            <a href="/nhan-vien"
              class="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 font-medium text-sm">
              Huỷ
            </a>
          </div>
        </form>
      </div>

      <script>
      document.getElementById('nvForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = {
          id: fd.get('id'),
          ten: fd.get('ten'),
          vai_tro: fd.get('vai_tro'),
          sdt: fd.get('sdt') || '',
          so_giay_to: fd.get('so_giay_to') || '',
          dia_chi: fd.get('dia_chi') || '',
          ghi_chu: fd.get('ghi_chu') || '',
        };
        if (!body.id || !body.ten) { alert('Mã và Họ tên bắt buộc'); return; }
        const res = await fetch('/nhan-vien/api/nhan-vien', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) { window.location.href = '/nhan-vien'; }
        else { const err = await res.json(); alert(err.error || 'Lỗi'); }
      });
      </script>
    </div>
  `;
}

// ===================== API: CREATE / UPDATE =====================
nhanVienRoutes.post('/api/nhan-vien', async (c) => {
  const user = c.get('user');
  if (!c.get('perms').canEdit) return c.json({ error: 'Không có quyền' }, 403);

  const body = await c.req.json();
  const { id, ten, vai_tro, sdt, so_giay_to, dia_chi, ghi_chu } = body;
  if (!id || !ten) return c.json({ error: 'Mã và Họ tên bắt buộc' }, 400);

  const validRoles = ALL_ROLES;
  const roleValue = validRoles.includes(vai_tro) ? vai_tro : 'nhanvien';

  const existing = await c.env.DB.prepare('SELECT id FROM nhan_vien WHERE id = ?').bind(id).first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE nhan_vien SET ten=?, vai_tro=?, sdt=?, so_giay_to=?, dia_chi=?, ghi_chu=?, updated_at=datetime('now') WHERE id=?`
    ).bind(ten, roleValue, sdt || '', so_giay_to || '', dia_chi || '', ghi_chu || '', id).run();
    return c.json({ success: true, action: 'updated' });
  }

  await c.env.DB.prepare(
    `INSERT INTO nhan_vien (id, ten, vai_tro, sdt, so_giay_to, dia_chi, ghi_chu, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(id, ten, roleValue, sdt || '', so_giay_to || '', dia_chi || '', ghi_chu || '').run();
  return c.json({ success: true, action: 'created' }, 201);
});

// ===================== API: GET SINGLE =====================
nhanVienRoutes.get('/api/nhan-vien/:id', async (c) => {
  const id = c.req.param('id');
  const nv = await c.env.DB.prepare('SELECT * FROM nhan_vien WHERE id = ? AND active = 1').bind(id).first<NhanVien>();
  if (!nv) return c.json({ error: 'Không tìm thấy' }, 404);
  return c.json(nv);
});

// ===================== API: SOFT DELETE =====================
nhanVienRoutes.post('/api/nhan-vien/:id/delete', async (c) => {
  const user = c.get('user');
  if (!c.get('perms').canDelete) return c.json({ error: 'Không có quyền xoá' }, 403);

  const id = c.req.param('id');
  await c.env.DB.prepare(
    "UPDATE nhan_vien SET active = 0, updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();
  return c.json({ success: true });
});
