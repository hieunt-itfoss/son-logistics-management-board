import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { layout } from '../utils/layout';
import {
  pageHeader, card, dataTable, tableRow, tableEmpty, tableActions,
  formGroup, input, btnPrimary, btnSecondary, badge,
} from '../utils/ui';

export const khoRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtNum = (n: number): string => n.toLocaleString('vi-VN');

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return d;
}

/* ══════════════════════════════════════════════════════════════
   GET / — Main Kho view (warehouse — unreturned cargo)
   ══════════════════════════════════════════════════════════════ */
khoRoutes.get('/', async (c) => {
  const user = c.get('user');
  const perms = c.get('perms');
  const canEdit = perms.canEdit;
  const sortOpt = c.req.query('sort') || 'newest';
  const dgKho = Number(c.req.query('dg')) || 5;

  let orderBy: string;
  switch (sortOpt) {
    case 'oldest': orderBy = 'cx.ngay_di ASC, cx.id ASC'; break;
    case 'ten': orderBy = 'kh.ten ASC'; break;
    case 'tuyen': orderBy = 't.ten ASC'; break;
    default: orderBy = 'cx.ngay_di DESC, cx.id DESC'; break;
  }

  const { results } = await c.env.DB.prepare(
    `SELECT lh.id, lh.so_kien, lh.da_tra_hang, lh.ly_do_thieu,
            lh.khach_hang_id, lh.hang_id,
            kh.ten AS khach_hang_ten, kh.ma_kh,
            h.ten AS hang_ten,
            cx.id AS chuyen_id, cx.ngay_di, cx.ngay_den AS ngay_ve,
            t.ten AS tuyen_ten, t.mau AS tuyen_mau,
            (lh.so_kien - lh.da_tra_hang) AS chua_tra
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.so_kien > lh.da_tra_hang
     ORDER BY ${orderBy}`,
  ).all();

  type KhoRow = Record<string, unknown>;
  const lots = results as KhoRow[];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let totalKien = 0;
  let tongTienKho = 0;

  const rowData: {
    id: string; khTen: string; maKh: string; hangTen: string;
    tuyenTen: string; tuyenMau: string; chuyenId: string;
    ngayDi: string; ngayVe: string; soNgayKho: number;
    conLuu: number; dgKhoVal: number; tienKho: number;
    lyDoThieu: string; khachId: string;
  }[] = [];

  for (const lh of lots) {
    const conLuu = Number(lh.chua_tra) || 0;
    totalKien += conLuu;
    const ngayVe = String(lh.ngay_ve || '');
    let soNgayKho = 0;
    if (ngayVe) {
      soNgayKho = Math.floor((today.getTime() - new Date(ngayVe).getTime()) / 86400000);
      if (soNgayKho < 0) soNgayKho = 0;
    }
    const tienKho = soNgayKho > 0 ? conLuu * dgKho * soNgayKho : 0;
    tongTienKho += tienKho;

    rowData.push({
      id: String(lh.id),
      khTen: String(lh.khach_hang_ten || '—'),
      maKh: String(lh.ma_kh || ''),
      hangTen: String(lh.hang_ten || '—'),
      tuyenTen: String(lh.tuyen_ten || '—'),
      tuyenMau: String(lh.tuyen_mau || ''),
      chuyenId: String(lh.chuyen_id || ''),
      ngayDi: String(lh.ngay_di || ''),
      ngayVe,
      soNgayKho,
      conLuu,
      dgKhoVal: dgKho,
      tienKho,
      lyDoThieu: String(lh.ly_do_thieu || ''),
      khachId: String(lh.khach_hang_id || ''),
    });
  }

  const rows = rowData.map((r) => {
    const khoColor = r.soNgayKho > 14 ? 'text-error' : r.soNgayKho > 7 ? 'text-warning' : '';
    const khoWeight = r.soNgayKho > 7 ? 'font-bold' : '';
    const tienColor = r.tienKho > 500 ? 'text-error' : '';

    const editBtn = canEdit
      ? `<button type="button" class="htql-table-action htql-table-action--edit" onclick="showUpdateForm('${esc(r.id)}', ${r.conLuu + (Number(r.conLuu) === Number(r.conLuu) ? 0 : 0)}, 0)" title="Cập nhật trả hàng" aria-label="Sửa">
          <iconify-icon icon="solar:pen-2-linear" width="18"></iconify-icon>
        </button>`
      : '—';

    return tableRow([
      `<input type="checkbox" class="kho-check rounded" data-id="${esc(r.id)}" data-con="${r.conLuu}" data-kh="${esc(r.khachId)}" data-phi="${r.tienKho}" />`,
      `<a href="/lo-hang/${esc(r.id)}" class="text-primary hover:underline font-mono text-xs">${esc(r.id)}</a>`,
      `<a href="/doi-tac?tab=kh" class="hover:underline"><strong>${esc(r.khTen)}</strong></a> <span class="text-bodytext text-xs">(${esc(r.maKh)})</span>`,
      esc(r.hangTen),
      r.tuyenMau ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium" style="background:${esc(r.tuyenMau)}20;color:${esc(r.tuyenMau)}">${esc(r.tuyenTen)}</span>` : esc(r.tuyenTen),
      r.chuyenId ? `<a href="/chuyen-xe/${esc(r.chuyenId)}" class="text-primary hover:underline font-mono text-xs">${esc(r.chuyenId)}</a>` : '<span class="text-bodytext">—</span>',
      fmtDate(r.ngayDi),
      fmtDate(r.ngayVe),
      `<span class="${khoColor} ${khoWeight}">${r.soNgayKho > 0 ? r.soNgayKho + 'd' : '—'}</span>`,
      `<span class="font-semibold">${r.conLuu}</span>`,
      `${dgKho} PLN`,
      `<span class="${tienColor}">${r.tienKho > 0 ? fmtNum(r.tienKho) + ' PLN' : '—'}</span>`,
      `<span class="text-xs text-bodytext max-w-[120px] truncate inline-block">${esc(r.lyDoThieu) || '—'}</span>`,
      `<div class="flex items-center justify-center gap-1">${editBtn}</div>`,
    ]);
  }).join('');

  const sortOptions = [
    { value: 'newest', label: 'Mới → Cũ' },
    { value: 'oldest', label: 'Cũ → Mới' },
    { value: 'ten', label: 'Theo tên khách' },
    { value: 'tuyen', label: 'Theo tuyến' },
  ];
  const sortSelect = sortOptions.map(o =>
    `<option value="${o.value}" ${sortOpt === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');

  const content = `
    ${pageHeader('Kho — Hàng còn lưu', {
      subtitle: `Tổng <strong class="text-primary text-lg">${totalKien}</strong> kiện · ${lots.length} phiếu · Tiền lưu kho dự kiến: <strong class="text-warning">${fmtNum(tongTienKho)} PLN</strong>`,
    })}

    <!-- Sort + unit price toolbar -->
    ${card({
      body: `<form method="get" action="/kho" class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-semibold text-warning uppercase flex items-center gap-1">
          <iconify-icon icon="solar:sort-by-alphabet-linear" width="16"></iconify-icon> Sắp xếp
        </span>
        <select name="sort" class="form-control w-auto">${sortSelect}</select>
        <span class="text-xs text-bodytext dark:text-darklink ml-2">Đơn giá lưu kho/kiện/ngày:</span>
        <input type="number" name="dg" value="${dgKho}" step="0.5" min="0" class="form-control w-20" />
        <span class="text-xs text-bodytext">PLN</span>
        ${btnPrimary('Áp dụng', { type: 'submit', icon: 'solar:check-circle-linear' })}
      </form>`,
      class: 'mb-4',
    })}

    <!-- Bulk action bar (hidden, shown via JS) -->
    <div id="bulkBar" class="hidden mb-4">
      ${card({
        body: `<div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-semibold text-dark dark:text-white" id="bulkCount">0 phiếu đã chọn</span>
          ${canEdit ? `
            <button type="button" class="btn bg-success hover:bg-successemphasis text-white text-sm flex items-center gap-1.5 cursor-pointer" onclick="bulkXuatKho()">
              <iconify-icon icon="solar:export-linear"></iconify-icon> Đã xuất kho (trả hết)
            </button>
            <button type="button" class="btn bg-warning hover:bg-warningemphasis text-white text-sm flex items-center gap-1.5 cursor-pointer" onclick="bulkTinhPhi()">
              <iconify-icon icon="solar:wallet-money-linear"></iconify-icon> Tính phí lưu kho (tạo phiếu thu)
            </button>
          ` : ''}
          <button type="button" class="btn-outline border-bordergray text-bodytext dark:text-darklink text-sm ml-auto cursor-pointer" onclick="clearSelection()">✕ Bỏ chọn</button>
        </div>`,
        class: 'border-primary border-2',
      })}
    </div>

    <!-- Update form (hidden) -->
    <div id="updateForm" class="hidden mb-6">
      ${card({
        title: 'Cập nhật đã trả hàng',
        body: `<form id="khoForm" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <input type="hidden" name="id" id="khoId">
        ${formGroup('Tổng kiện', input({ type: 'text', id: 'khoTongKien', disabled: true }))}
        ${formGroup('Đã trả (trước)', input({ type: 'text', id: 'khoDaTraCu', disabled: true }))}
        ${formGroup('Đã trả (mới)', input({ type: 'number', name: 'da_tra_hang', id: 'khoDaTraMoi', required: true }))}
        <div class="sm:col-span-3">${formGroup('Lý do thiếu (nếu có)', input({ type: 'text', name: 'ly_do_thieu', id: 'khoLyDo' }))}</div>
        <div class="sm:col-span-3 flex gap-2">
          ${btnPrimary('Lưu', { type: 'submit' })}
          ${btnSecondary('Hủy', { onclick: 'hideUpdateForm()' })}
        </div>
      </form>`,
      })}
    </div>

    ${dataTable(
      ['<input type="checkbox" id="selectAllKho" class="rounded" />', 'Phiếu', 'Khách', 'Hãng', 'Tuyến', 'Chuyến', 'Ngày đi', 'Ngày về', 'Ngày kho', 'Còn lưu', 'Đơn giá', 'Tiền kho', 'Ghi chú', '⚙'],
      rows || tableEmpty(14, 'Không có hàng trong kho'),
    )}

    <script>
    const selectedKho = new Set();
    const dgKho = ${dgKho};

    function updateBulkBar() {
      const bar = document.getElementById('bulkBar');
      const cnt = document.getElementById('bulkCount');
      if (selectedKho.size > 0) {
        bar.classList.remove('hidden');
        cnt.textContent = selectedKho.size + ' phiếu đã chọn';
      } else {
        bar.classList.add('hidden');
      }
    }

    document.querySelectorAll('.kho-check').forEach(cb => {
      cb.addEventListener('change', function() {
        const id = this.dataset.id;
        if (this.checked) selectedKho.add(id); else selectedKho.delete(id);
        updateBulkBar();
      });
    });

    document.getElementById('selectAllKho')?.addEventListener('change', function() {
      document.querySelectorAll('.kho-check').forEach(cb => {
        cb.checked = this.checked;
        const id = cb.dataset.id;
        if (this.checked) selectedKho.add(id); else selectedKho.delete(id);
      });
      updateBulkBar();
    });

    function clearSelection() {
      selectedKho.clear();
      document.querySelectorAll('.kho-check').forEach(cb => cb.checked = false);
      document.getElementById('selectAllKho').checked = false;
      updateBulkBar();
    }

    async function bulkXuatKho() {
      if (selectedKho.size === 0) return;
      if (!confirm('Đánh dấu ' + selectedKho.size + ' phiếu = đã trả hết hàng?')) return;
      const ids = Array.from(selectedKho);
      const res = await fetch('/kho/api/kho/bulk-xuat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) { location.reload(); } else { const e = await res.json(); alert(e.error || 'Lỗi'); }
    }

    async function bulkTinhPhi() {
      if (selectedKho.size === 0) return;
      const ids = Array.from(selectedKho);
      const res = await fetch('/kho/api/kho/bulk-tinh-phi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, don_gia: dgKho })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.created === 0) { alert('Không có phiếu nào có phí lưu kho > 0'); return; }
        alert('Đã tạo ' + data.created + ' phiếu thu phí lưu kho');
        location.reload();
      } else { const e = await res.json(); alert(e.error || 'Lỗi'); }
    }

    function showUpdateForm(id, soKien, daTra) {
      // We need to fetch the lot details
      fetch('/kho/api/kho/lot/' + encodeURIComponent(id)).then(r => r.json()).then(lot => {
        document.getElementById('khoId').value = lot.id;
        document.getElementById('khoTongKien').value = lot.so_kien;
        document.getElementById('khoDaTraCu').value = lot.da_tra_hang;
        document.getElementById('khoDaTraMoi').value = lot.da_tra_hang;
        document.getElementById('khoDaTraMoi').max = lot.so_kien;
        document.getElementById('khoLyDo').value = lot.ly_do_thieu || '';
        document.getElementById('updateForm').classList.remove('hidden');
        document.getElementById('updateForm').scrollIntoView({ behavior: 'smooth' });
      });
    }
    function hideUpdateForm() {
      document.getElementById('updateForm').classList.add('hidden');
      document.getElementById('khoForm').reset();
    }
    document.getElementById('khoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('khoId').value;
      const da_tra_hang = Number(document.getElementById('khoDaTraMoi').value);
      const ly_do_thieu = document.getElementById('khoLyDo').value;
      const res = await fetch('/kho/api/kho/update-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, da_tra_hang, ly_do_thieu })
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    });
    </script>
  `;

  return c.html(layout('Kho', content, user, 'kho'));
});

/* ══════════════════════════════════════════════════════════════
   API: Get lot details
   ══════════════════════════════════════════════════════════════ */
khoRoutes.get('/api/kho/lot/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT id, so_kien, da_tra_hang, ly_do_thieu FROM lo_hang WHERE id = ?',
  ).bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

/* ══════════════════════════════════════════════════════════════
   API: List kho (JSON)
   ══════════════════════════════════════════════════════════════ */
khoRoutes.get('/api/kho', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT lh.*, kh.ten as khach_hang_ten, h.ten as hang_ten, cx.ngay_di, cx.ngay_den as ngay_ve, t.ten as tuyen_ten,
            (lh.so_kien - lh.da_tra_hang) as chua_tra
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.so_kien > lh.da_tra_hang
     ORDER BY lh.created_at DESC`,
  ).all();
  return c.json(results);
});

/* ══════════════════════════════════════════════════════════════
   POST /api/kho/update-delivered — Update da_tra_hang
   ══════════════════════════════════════════════════════════════ */
khoRoutes.post('/api/kho/update-delivered', async (c) => {
  const body = await c.req.json();
  await c.env.DB.prepare(
    "UPDATE lo_hang SET da_tra_hang=?, ly_do_thieu=?, updated_at=datetime('now') WHERE id=?",
  ).bind(body.da_tra_hang, body.ly_do_thieu || '', body.id).run();
  return c.json({ success: true });
});

/* ══════════════════════════════════════════════════════════════
   POST /api/kho/bulk-xuat — Bulk mark lots as fully returned
   ══════════════════════════════════════════════════════════════ */
khoRoutes.post('/api/kho/bulk-xuat', async (c) => {
  const body = await c.req.json();
  const ids: string[] = body.ids || [];
  if (ids.length === 0) return c.json({ error: 'No IDs' }, 400);

  const stmts = ids.map(id =>
    c.env.DB.prepare(
      "UPDATE lo_hang SET da_tra_hang = so_kien, updated_at = datetime('now') WHERE id = ?",
    ).bind(id),
  );
  await c.env.DB.batch(stmts);
  return c.json({ success: true, count: ids.length });
});

/* ══════════════════════════════════════════════════════════════
   POST /api/kho/bulk-tinh-phi — Bulk create phiếu thu for storage fees
   ══════════════════════════════════════════════════════════════ */
khoRoutes.post('/api/kho/bulk-tinh-phi', async (c) => {
  const body = await c.req.json();
  const ids: string[] = body.ids || [];
  const donGia = Number(body.don_gia) || 5;
  if (ids.length === 0) return c.json({ error: 'No IDs' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT lh.id, lh.khach_hang_id, lh.so_kien, lh.da_tra_hang, cx.ngay_den AS ngay_ve
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     WHERE lh.id IN (${placeholders})`,
  ).bind(...ids).all();

  type LotRow = Record<string, unknown>;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const byKh: Record<string, { tong: number; lots: string[] }> = {};

  for (const lh of results as LotRow[]) {
    const ngayVe = String(lh.ngay_ve || '');
    if (!ngayVe) continue;
    const soNgay = Math.floor((today.getTime() - new Date(ngayVe).getTime()) / 86400000);
    if (soNgay <= 0) continue;
    const conLuu = (Number(lh.so_kien) || 0) - (Number(lh.da_tra_hang) || 0);
    const phi = conLuu * donGia * soNgay;
    if (phi <= 0) continue;
    const khId = String(lh.khach_hang_id);
    if (!byKh[khId]) byKh[khId] = { tong: 0, lots: [] };
    byKh[khId].tong += phi;
    byKh[khId].lots.push(String(lh.id));
  }

  const entries = Object.entries(byKh);
  if (entries.length === 0) return c.json({ success: true, created: 0 });

  const user = c.get('user');
  const stmts = entries.map(([khId, d]) => {
    const ptId = `PT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    return c.env.DB.prepare(
      `INSERT INTO phieu_thu (id, ngay, khach_hang_id, dau_muc, kieu_qt, loai_tien, lo_ids, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      ptId, todayStr, khId, 'Vận tải Balan', 'trahet', 'vantai',
      JSON.stringify(d.lots), d.tong, 'PLN', 'CK',
      `Phí lưu kho ${d.lots.length} phiếu × ${donGia} PLN/kiện/ngày`,
      user.display_name,
      String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0'),
    );
  });
  await c.env.DB.batch(stmts);
  return c.json({ success: true, created: entries.length });
});
