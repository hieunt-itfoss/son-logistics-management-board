import { Hono } from 'hono';
import type { Env, Tuyen, DauMucGroup, DauMucNhom } from '../types';
import { DM_GROUP_LABEL, DM_GROUP_TIENTO, dmGroupLabel } from '../types';
import { layout } from '../utils/layout';
import {
  pageHeader,
  card,
  dataTable,
  tableRow,
  tableEmpty,
  tableActions,
  btnPrimary,
  btnSecondary,
  formGroup,
  formField,
  input,
  searchSelect,
  modalShell,
  modalFooterInner,
} from '../utils/ui';

export const tuyenRoutes = new Hono<{ Bindings: Env }>();

const MAU_COLORS: Record<string, { bg: string; text: string; badge: string; dot: string }> = {
  blue: { bg: '#dbeafe', text: '#1e40af', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  amber: { bg: '#fef3c7', text: '#d97706', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  green: { bg: '#dcfce7', text: '#16a34a', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  gray: { bg: '#f1f5f9', text: '#64748b', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' },
  purple: { bg: '#f3e8ff', text: '#7e22ce', badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  rose: { bg: '#ffe4e6', text: '#be123c', badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
  cyan: { bg: '#cffafe', text: '#0e7490', badge: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-500' },
};

const BUILTIN_GROUPS: DauMucGroup[] = ['phap', 'y', 'tiep', 'balan', 'khac'];

interface ChuyenRow {
  id: string;
  tuyen_id: string;
  xe_id: string;
  tai_xe_id: string;
  ngay_di: string;
  ngay_den: string;
  trang_thai: string;
  gia_chuyen: number;
  tien_te: string;
  da_thanh_toan: number;
  bien_so: string | null;
  so_xe: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  return d.slice(0, 10);
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || n === 0) return '-';
  return n.toLocaleString('vi-VN');
}

function khongDau(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function slugifyGroupId(ten: string, explicit?: string): string {
  const raw = (explicit || ten || '').trim();
  let slug = khongDau(raw)
    .replace(/^van\s*tai\s+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (!slug) slug = `g-${Date.now().toString(36)}`;
  return slug;
}

function colorsFor(mau: string, groupId: string) {
  if (MAU_COLORS[mau]) return MAU_COLORS[mau];
  const builtin: Record<string, string> = { phap: 'blue', y: 'amber', tiep: 'green', balan: 'gray', khac: 'gray' };
  return MAU_COLORS[builtin[groupId] || 'gray'] || MAU_COLORS.gray;
}

async function loadGroups(db: D1Database): Promise<DauMucNhom[]> {
  try {
    const { results } = await db.prepare(
      'SELECT id, ten, tien_to, mau FROM dau_muc_nhom ORDER BY ten'
    ).all<DauMucNhom>();
    if (results.length > 0) return results as DauMucNhom[];
  } catch {
    /* table may not exist yet before migration */
  }
  return BUILTIN_GROUPS.map((id) => ({
    id,
    ten: DM_GROUP_LABEL[id],
    tien_to: DM_GROUP_TIENTO[id],
    mau: id === 'phap' ? 'blue' : id === 'y' ? 'amber' : id === 'tiep' ? 'green' : 'gray',
  }));
}

function groupLabelMap(groups: DauMucNhom[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const g of groups) m[g.id] = g.ten;
  return m;
}

function resolveGroup(
  groups: DauMucNhom[],
  raw: string | undefined,
): { id: string; mau: string; tien_to: string } {
  const id = String(raw || '').trim();
  const found = groups.find((g) => g.id === id);
  if (found) return { id: found.id, mau: found.mau || 'gray', tien_to: found.tien_to || 'K' };
  if (BUILTIN_GROUPS.includes(id as DauMucGroup)) {
    const g = id as DauMucGroup;
    return {
      id: g,
      mau: g === 'phap' ? 'blue' : g === 'y' ? 'amber' : g === 'tiep' ? 'green' : 'gray',
      tien_to: DM_GROUP_TIENTO[g],
    };
  }
  return { id: 'khac', mau: 'gray', tien_to: DM_GROUP_TIENTO.khac };
}

// ── API routes (registered before /:id to avoid wildcard match) ──────

tuyenRoutes.get('/api/tuyen/:id', async (c) => {
  const id = c.req.param('id');
  const tuyen = await c.env.DB.prepare('SELECT * FROM tuyen WHERE id = ?').bind(id).first<Tuyen>();
  if (!tuyen) return c.json({ error: 'Không tìm thấy tuyến' }, 404);
  return c.json(tuyen);
});

tuyenRoutes.get('/api/dau-muc-group', async (c) => {
  const groups = await loadGroups(c.env.DB);
  return c.json(groups);
});

tuyenRoutes.post('/api/dau-muc-group', async (c) => {
  const body = await c.req.json<{ ten?: string; tien_to?: string; mau?: string; id?: string }>();
  const ten = String(body.ten || '').trim();
  if (!ten) return c.json({ error: 'Tên nhóm đầu mục là bắt buộc' }, 400);

  let id = slugifyGroupId(ten, body.id);
  const tienTo = String(body.tien_to || '').trim().toUpperCase().slice(0, 4) || 'K';
  const mau = String(body.mau || 'gray').trim() || 'gray';
  if (!MAU_COLORS[mau]) {
    return c.json({ error: 'Màu không hợp lệ' }, 400);
  }

  // Ensure unique id
  let n = 1;
  let candidate = id;
  while (await c.env.DB.prepare('SELECT id FROM dau_muc_nhom WHERE id = ?').bind(candidate).first()) {
    candidate = `${id}-${n++}`.slice(0, 36);
  }
  id = candidate;

  const existingTen = await c.env.DB.prepare(
    'SELECT id FROM dau_muc_nhom WHERE lower(ten) = lower(?)'
  ).bind(ten).first();
  if (existingTen) {
    return c.json({ error: 'Tên nhóm đã tồn tại', id: String((existingTen as { id: string }).id) }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO dau_muc_nhom (id, ten, tien_to, mau) VALUES (?, ?, ?, ?)'
  ).bind(id, ten, tienTo, mau).run();

  return c.json({ id, ten, tien_to: tienTo, mau }, 201);
});

tuyenRoutes.post('/api/tuyen', async (c) => {
  const body = await c.req.json();
  if (!body.ten) return c.json({ error: 'Tên tuyến là bắt buộc' }, 400);

  const groups = await loadGroups(c.env.DB);
  const resolved = resolveGroup(groups, body.dau_muc_group);
  const mau = body.mau || resolved.mau;

  const id = `t-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  await c.env.DB.prepare(
    'INSERT INTO tuyen (id, ten, diem_di, diem_den, tien_to, mau, dau_muc_group, khoang_cach_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, body.ten, body.diem_di || '', body.diem_den || '',
    body.tien_to || resolved.tien_to, mau, resolved.id, body.khoang_cach_km || 0
  ).run();

  return c.json({ id }, 201);
});

tuyenRoutes.put('/api/tuyen/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (!body.ten) return c.json({ error: 'Tên tuyến là bắt buộc' }, 400);

  const groups = await loadGroups(c.env.DB);
  const resolved = resolveGroup(groups, body.dau_muc_group);
  const mau = body.mau || resolved.mau;

  await c.env.DB.prepare(
    'UPDATE tuyen SET ten=?, diem_di=?, diem_den=?, tien_to=?, mau=?, dau_muc_group=?, khoang_cach_km=? WHERE id=?'
  ).bind(
    body.ten, body.diem_di || '', body.diem_den || '',
    body.tien_to || resolved.tien_to, mau, resolved.id, body.khoang_cach_km || 0, id
  ).run();

  return c.json({ success: true });
});

tuyenRoutes.post('/api/tuyen/:id/delete', async (c) => {
  const id = c.req.param('id');

  const { results: refs } = await c.env.DB.prepare(
    'SELECT id FROM chuyen_xe WHERE tuyen_id = ? LIMIT 1'
  ).bind(id).all<{ id: string }>();

  if (refs.length > 0) {
    return c.json({ error: 'Không thể xóa - tuyến vẫn còn chuyến xe' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM tuyen WHERE id=?').bind(id).run();
  return c.json({ success: true });
});

// ── GET / - List all tuyen ──────────────────────────────────────────

tuyenRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { results: tuyens } = await c.env.DB.prepare(
    'SELECT * FROM tuyen ORDER BY dau_muc_group, ten'
  ).all<Tuyen>();

  const groups = await loadGroups(c.env.DB);
  const labels = groupLabelMap(groups);
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const { results: chuyenCounts } = await c.env.DB.prepare(
    'SELECT tuyen_id, COUNT(*) as cnt FROM chuyen_xe GROUP BY tuyen_id'
  ).all<{ tuyen_id: string; cnt: number }>();
  const chuyenMap = new Map(chuyenCounts.map((r) => [r.tuyen_id, r.cnt]));

  const { results: loCounts } = await c.env.DB.prepare(
    'SELECT cx.tuyen_id, COUNT(lh.id) as cnt FROM lo_hang lh JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id GROUP BY cx.tuyen_id'
  ).all<{ tuyen_id: string; cnt: number }>();
  const loMap = new Map(loCounts.map((r) => [r.tuyen_id, r.cnt]));

  const groupCombo = groups.map((g) => ({
    value: g.id,
    label: g.ten,
    data: { tiento: g.tien_to, mau: g.mau },
  }));

  const rows = (tuyens as Tuyen[]).map((t) => {
    const g = groupById.get(t.dau_muc_group);
    const colors = colorsFor(t.mau || g?.mau || 'gray', t.dau_muc_group);
    const chCount = chuyenMap.get(t.id) || 0;
    const loCount = loMap.get(t.id) || 0;
    return tableRow([
      `<span class="font-mono text-bodytext">${t.id.slice(0, 8)}</span>`,
      `<a href="/tuyen/${t.id}" class="inline-flex items-center gap-2 hover:underline">
            <span class="inline-block px-2.5 py-1 rounded-md text-xs font-semibold" style="background:${colors.bg};color:${colors.text}">${esc(t.ten)}</span>
          </a>`,
      `<span class="inline-flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${colors.dot}"></span>
            <strong>${esc(dmGroupLabel(t.dau_muc_group, labels))}</strong>
          </span>`,
      `<span class="inline-block px-2 py-0.5 rounded-md bg-lightgray dark:bg-darkgray text-xs font-mono">${esc(t.tien_to)}</span>`,
      `<span class="tabular-nums">${chCount}</span>`,
      `<span class="tabular-nums">${loCount}</span>`,
      tableActions(`editTuyen('${t.id}')`, `deleteTuyen('${t.id}')`, undefined, { center: true }),
    ], { align: 'center' });
  }).join('');

  const mauOpts = Object.keys(MAU_COLORS).map((m) => ({ value: m, label: m }));

  const content = `
    ${pageHeader('Tuyến vận tải', {
      subtitle: 'Mỗi tuyến gắn với 1 nhóm đầu mục VT — có thể thêm nhóm mới',
      actions: btnPrimary('Tuyến mới', { icon: 'solar:add-circle-linear', onclick: 'showAddForm()' }),
    })}

    <div id="addForm" class="hidden mb-6">
      ${card({
        body: `<h3 id="formTitle" class="card-title mb-4">Thêm tuyến mới</h3>
        <form id="tuyenForm" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${formGroup('Tên tuyến', input({ type: 'text', name: 'ten', required: true }), { required: true })}
        <div>
          <label class="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Nhóm đầu mục VT</label>
          <div class="flex gap-2 items-start">
            <div class="min-w-0 flex-1">
              ${searchSelect({
                name: 'dau_muc_group', id: 'dau_muc_group', placeholder: 'Nhóm đầu mục',
                options: groupCombo,
              })}
            </div>
            <button type="button" class="btn-outline border-bordergray text-link dark:text-darklink shrink-0 h-[42px] px-3 inline-flex items-center gap-1 cursor-pointer" onclick="openGroupModal()" title="Thêm nhóm đầu mục">
              <iconify-icon icon="solar:add-circle-linear" class="text-lg"></iconify-icon>
              <span class="hidden sm:inline text-sm">Thêm</span>
            </button>
          </div>
        </div>
        ${formGroup('Tiền tố mã', input({ type: 'text', name: 'tien_to', placeholder: 'VD: F, W, C, P, K' }))}
        ${formGroup('Điểm đi', input({ type: 'text', name: 'diem_di' }))}
        ${formGroup('Điểm đến', input({ type: 'text', name: 'diem_den' }))}
        ${formGroup('Khoảng cách (km)', input({ type: 'number', name: 'khoang_cach_km' }))}
        <div class="col-span-full flex gap-2 pt-2">
          <button type="submit" class="btn cursor-pointer">Lưu</button>
          ${btnSecondary('Hủy', { onclick: 'hideAddForm()' })}
        </div>
      </form>`,
      })}
    </div>

    ${modalShell({
      id: 'dmGroupModal',
      title: 'Thêm nhóm đầu mục VT',
      size: 'md',
      icon: 'solar:tag-bold-duotone',
      body: `<form id="dmGroupForm" class="space-y-4">
        ${formField('Tên nhóm', input({ name: 'ten', id: 'dm_ten', required: true, placeholder: 'VD: Vận tải Đức' }), { required: true })}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${formField('Tiền tố mã', input({ name: 'tien_to', id: 'dm_tien_to', placeholder: 'VD: D', maxlength: '4' }))}
          ${formField('Màu', searchSelect({
            name: 'mau', id: 'dm_mau', value: 'gray', placeholder: 'Màu...', options: mauOpts,
          }))}
        </div>
        <p class="text-xs text-bodytext dark:text-darklink">Mã nhóm sẽ tự sinh từ tên (bỏ dấu). Có thể dùng ngay khi tạo tuyến.</p>
      </form>`,
      footer: modalFooterInner(
        btnSecondary('Hủy', { onclick: 'htqlCloseModal("dmGroupModal")' }),
        `<button type="submit" form="dmGroupForm" class="btn cursor-pointer">✓ Tạo nhóm</button>`,
      ),
    })}

    ${dataTable(
      ['Mã', 'Tên tuyến', 'Đầu mục VT', 'Tiền tố', 'Số chuyến', 'Số phiếu', 'Thao tác'],
      rows || tableEmpty(7, 'Chưa có tuyến nào'),
      { align: 'center' },
    )}

    <script>
    let editingId = null;
    const groupMeta = ${JSON.stringify(Object.fromEntries(groups.map((g) => [g.id, { tiento: g.tien_to, mau: g.mau }])))};

    function showAddForm() {
      editingId = null;
      document.getElementById('formTitle').textContent = 'Thêm tuyến mới';
      document.getElementById('tuyenForm').reset();
      htqlComboboxSet('dau_muc_group', '');
      document.getElementById('addForm').classList.remove('hidden');
    }

    function hideAddForm() {
      editingId = null;
      document.getElementById('addForm').classList.add('hidden');
      document.getElementById('tuyenForm').reset();
      htqlComboboxSet('dau_muc_group', '');
    }

    function openGroupModal() {
      document.getElementById('dmGroupForm').reset();
      htqlComboboxSet('dm_mau', 'gray');
      htqlOpenModal('dmGroupModal');
    }

    function syncPrefixFromGroup() {
      const form = document.getElementById('tuyenForm');
      if (!form || form.tien_to.value) return;
      const g = htqlComboboxGet('dau_muc_group');
      if (!g || !g.value) return;
      const meta = (g.data && g.data.tiento) || (groupMeta[g.value] && groupMeta[g.value].tiento);
      if (meta) form.tien_to.value = meta;
    }

    document.getElementById('dau_muc_group')?.addEventListener('change', syncPrefixFromGroup);

    document.getElementById('dmGroupForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch('/tuyen/api/dau-muc-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Lỗi tạo nhóm');
        return;
      }
      const data = await res.json();
      groupMeta[data.id] = { tiento: data.tien_to, mau: data.mau };
      htqlComboboxAdd('dau_muc_group', {
        value: data.id,
        label: data.ten,
        data: { tiento: data.tien_to, mau: data.mau },
      });
      const form = document.getElementById('tuyenForm');
      if (form && !form.tien_to.value) form.tien_to.value = data.tien_to || '';
      htqlCloseModal('dmGroupModal');
      document.getElementById('addForm').classList.remove('hidden');
    });

    document.getElementById('tuyenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      body.khoang_cach_km = Number(body.khoang_cach_km) || 0;

      const g = htqlComboboxGet('dau_muc_group');
      if (!g || !g.value) {
        alert('Chọn hoặc tạo nhóm đầu mục VT');
        return;
      }
      body.dau_muc_group = g.value;
      const meta = groupMeta[g.value] || {};
      body.mau = (g.data && g.data.mau) || meta.mau || 'gray';

      if (!body.tien_to) {
        body.tien_to = (g.data && g.data.tiento) || meta.tiento || '';
      }

      const url = editingId ? '/tuyen/api/tuyen/' + editingId : '/tuyen/api/tuyen';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });

    async function editTuyen(id) {
      const res = await fetch('/tuyen/api/tuyen/' + id);
      const t = await res.json();
      if (!t || t.error) return alert('Không tìm thấy tuyến');
      editingId = id;
      document.getElementById('formTitle').textContent = 'Sửa tuyến';
      const form = document.getElementById('tuyenForm');
      form.ten.value = t.ten || '';
      htqlComboboxSet('dau_muc_group', t.dau_muc_group || 'khac');
      form.tien_to.value = t.tien_to || '';
      form.diem_di.value = t.diem_di || '';
      form.diem_den.value = t.diem_den || '';
      form.khoang_cach_km.value = t.khoang_cach_km || '';
      document.getElementById('addForm').classList.remove('hidden');
    }

    async function deleteTuyen(id) {
      if (!confirm('Xóa tuyến này?')) return;
      const res = await fetch('/tuyen/api/tuyen/' + id + '/delete', { method: 'POST' });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Tuyến vận tải', content, user, 'tuyen'));
});

// ── GET /:id - Detail view ──────────────────────────────────────────

tuyenRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const tuyen = await c.env.DB.prepare('SELECT * FROM tuyen WHERE id = ?').bind(id).first<Tuyen>();
  if (!tuyen) {
    return c.redirect('/tuyen');
  }

  const groups = await loadGroups(c.env.DB);
  const labels = groupLabelMap(groups);
  const g = groups.find((x) => x.id === tuyen.dau_muc_group);
  const colors = colorsFor(tuyen.mau || g?.mau || 'gray', tuyen.dau_muc_group);

  const { results: chuyens } = await c.env.DB.prepare(
    `SELECT cx.*, x.bien_so, x.so_xe FROM chuyen_xe cx LEFT JOIN xe x ON cx.xe_id = x.id WHERE cx.tuyen_id = ? ORDER BY cx.ngay_di DESC LIMIT 30`
  ).bind(id).all<ChuyenRow>();

  const chuyenIds = (chuyens as ChuyenRow[]).map((ch) => `'${ch.id}'`).join(',');
  let loCountMap = new Map<string, number>();
  if (chuyenIds) {
    const { results: loCounts } = await c.env.DB.prepare(
      `SELECT chuyen_xe_id, COUNT(*) as cnt FROM lo_hang WHERE chuyen_xe_id IN (${chuyenIds}) GROUP BY chuyen_xe_id`
    ).all<{ chuyen_xe_id: string; cnt: number }>();
    loCountMap = new Map(loCounts.map((r) => [r.chuyen_xe_id, r.cnt]));
  }

  const { results: totalLo } = await c.env.DB.prepare(
    `SELECT COUNT(lh.id) as cnt FROM lo_hang lh JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id WHERE cx.tuyen_id = ?`
  ).bind(id).all<{ cnt: number }>();
  const totalLoCount = (totalLo[0] as { cnt: number } | undefined)?.cnt || 0;

  const chuyenRows = (chuyens as ChuyenRow[]).map((ch) => {
    const loC = loCountMap.get(ch.id) || 0;
    const ttLabel = ch.da_thanh_toan ? '<span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">✓</span>' : '<span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Chưa</span>';
    return `
      <tr class="hover:bg-gray-50 border-b border-gray-100">
        <td class="px-4 py-3 text-sm"><a href="/chuyen-xe" class="text-blue-600 hover:underline font-mono text-xs">${ch.id.slice(0, 8)}</a></td>
        <td class="px-4 py-3 text-sm text-gray-700">${ch.bien_so || ch.so_xe || '-'}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${fmtDate(ch.ngay_di)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${fmtDate(ch.ngay_den)}</td>
        <td class="px-4 py-3 text-sm text-right tabular-nums">${loC}</td>
        <td class="px-4 py-3 text-sm text-right tabular-nums">${fmtNum(ch.gia_chuyen)} ${ch.tien_te || 'PLN'}</td>
        <td class="px-4 py-3 text-sm">${ttLabel}</td>
      </tr>`;
  }).join('');

  const content = `
    <a href="/tuyen" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
      <iconify-icon icon="solar:arrow-left-linear" class="text-base"></iconify-icon>
      Quay lại
    </a>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <iconify-icon icon="solar:route-linear" class="text-2xl" style="color:${colors.text}"></iconify-icon>
            ${esc(tuyen.ten)}
          </h2>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>Mã: <span class="font-mono text-gray-700">${tuyen.id.slice(0, 8)}</span></span>
            <span>Đầu mục: <strong>${esc(dmGroupLabel(tuyen.dau_muc_group, labels))}</strong></span>
            <span>Tiền tố: <strong class="font-mono">${esc(tuyen.tien_to)}</strong></span>
            ${tuyen.diem_di ? `<span>Điểm đi: ${esc(tuyen.diem_di)}</span>` : ''}
            ${tuyen.diem_den ? `<span>Điểm đến: ${esc(tuyen.diem_den)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-4 text-sm">
          <div class="text-center px-4 py-2 bg-blue-50 rounded-lg">
            <div class="text-lg font-bold text-blue-700">${(chuyens as ChuyenRow[]).length}</div>
            <div class="text-xs text-blue-600">Chuyến</div>
          </div>
          <div class="text-center px-4 py-2 bg-amber-50 rounded-lg">
            <div class="text-lg font-bold text-amber-700">${totalLoCount}</div>
            <div class="text-xs text-amber-600">Phiếu</div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <strong class="text-sm text-gray-700">Chuyến (${(chuyens as ChuyenRow[]).length})</strong>
      </div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xe</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày đi</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày về</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Phiếu</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Giá</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${chuyenRows || '<tr><td colspan="7" class="px-4 py-12 text-center text-gray-400">Chưa có chuyến nào trên tuyến này</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  return c.html(layout('Tuyến vận tải', content, user, 'tuyen'));
});
