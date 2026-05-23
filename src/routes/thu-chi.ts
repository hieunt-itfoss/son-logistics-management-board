import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { DAU_MUC_THU_CHI } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, tableRow, tableEmpty, badge, btnPrimary } from '../utils/ui';

export const thuChiRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function denyUnlessCanEdit(c: { get: (k: 'perms') => { canEdit: boolean } }): Response | null {
  if (!c.get('perms').canEdit) {
    return new Response(JSON.stringify({ error: 'Không có quyền sửa' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

/* ───────── helpers ───────── */

const fmtNum = (n: number): string => n.toLocaleString('vi-VN');
const esc = (s: string): string => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const DAU_MUC_OPTIONS = DAU_MUC_THU_CHI.map(d => `<option value="${d}">${d}</option>`).join('');
const TIEN_TE_OPTIONS = ['PLN','EUR','USD'].map(t => `<option value="${t}">${t}</option>`).join('');
const HINH_THUC_OPTIONS = '<option value="TM">Tiền mặt</option><option value="CK">Chuyển khoản</option>';

function dateRangeSQL(range: string, col: string): string {
  switch (range) {
    case 'today': return `date(${col}) = date('now')`;
    case 'thisWeek': return `date(${col}) >= date('now','-6 days')`;
    case 'thisMonth': return `strftime('%Y-%m',${col}) = strftime('%Y-%m','now')`;
    default: return '1=1';
  }
}

function rangeLabel(r: string): string {
  const m: Record<string,string> = { today:'Hôm nay', thisWeek:'Tuần này', thisMonth:'Tháng này', all:'Tất cả' };
  return m[r] || r;
}

/* ══════════════════════════════════════════════════════════════
   GET / — Main Thu/Chi view
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/', async (c) => {
  const user = c.get('user');
  const perms = c.get('perms');
  const canEdit = perms.canEdit;
  const loai = c.req.query('loai') || 'all';
  const dauMuc = c.req.query('dau_muc') || 'all';
  const range = c.req.query('range') || 'today';
  const q = c.req.query('q') || '';

  /* ── build WHERE ── */
  const rangeWhere = dateRangeSQL(range, 'ngay');
  const dmWhere = dauMuc !== 'all' ? `AND dau_muc = ?` : '';
  const qWhere = q ? `AND (ghi_chu LIKE ? OR id LIKE ?)` : '';

  /* ── phieu thu ── */
  const thuQ = `SELECT pt.*, kh.ten as khach_hang_ten, kh.ma_kh
    FROM phieu_thu pt LEFT JOIN khach_hang kh ON pt.khach_hang_id = kh.id
    WHERE ${rangeWhere} ${dmWhere.replace(/dau_muc/g,'pt.dau_muc')} ${qWhere.replace(/ghi_chu/g,'pt.ghi_chu').replace(/id/g,'pt.id')}
    ORDER BY pt.ngay DESC, pt.gio DESC`;
  const thuStmt = c.env.DB.prepare(thuQ);
  const thuBinds: string[] = [];
  if (dauMuc !== 'all') thuBinds.push(dauMuc);
  if (q) { thuBinds.push(`%${q}%`, `%${q}%`); }
  const { results: thuList } = await thuStmt.bind(...thuBinds).all();

  /* ── phieu chi ── */
  const chiQ = `SELECT * FROM phieu_chi
    WHERE ${rangeWhere} ${dmWhere} ${qWhere.replace(/ghi_chu/g,'phieu_chi.ghi_chu').replace(/id/g,'phieu_chi.id')}
    ORDER BY ngay DESC, gio DESC`;
  const chiStmt = c.env.DB.prepare(chiQ);
  const chiBinds: string[] = [];
  if (dauMuc !== 'all') chiBinds.push(dauMuc);
  if (q) { chiBinds.push(`%${q}%`, `%${q}%`); }
  const { results: chiList } = await chiStmt.bind(...chiBinds).all();

  /* ── totals by currency ── */
  const sumByCcy: Record<string,{thu:number,chi:number}> = {};
  for (const r of thuList as Record<string,unknown>[]) {
    const tte = String(r.tien_te || 'PLN');
    if (!sumByCcy[tte]) sumByCcy[tte] = { thu:0, chi:0 };
    sumByCcy[tte].thu += Number(r.so_tien) || 0;
  }
  for (const r of chiList as Record<string,unknown>[]) {
    const tte = String(r.tien_te || 'PLN');
    if (!sumByCcy[tte]) sumByCcy[tte] = { thu:0, chi:0 };
    sumByCcy[tte].chi += Number(r.so_tien) || 0;
  }

  /* ── render rows ── */
  const allRows: string[] = [];

  if (loai === 'all' || loai === 'thu') {
    for (const r of thuList as Record<string,unknown>[]) {
      const loIds: string[] = r.lo_ids ? JSON.parse(String(r.lo_ids)) : [];
      const khTen = String(r.khach_hang_ten || '—');
      const loStr = loIds.length ? loIds.slice(0,2).map(l => `<span class="text-blue-600">${esc(l)}</span>`).join(', ') : '';
      const related = khTen + (loStr ? ' · ' + loStr : '');
      allRows.push(tableRow([
        badge('Thu', 'success'),
        `<span class="font-mono text-bodytext">${esc(String(r.id))}</span>`,
        esc(String(r.ngay)),
        esc(String(r.dau_muc || '')),
        related,
        `<span class="font-semibold text-success tabular-nums">+${fmtNum(Number(r.so_tien)||0)} ${r.tien_te}</span>`,
        badge(String(r.hinh_thuc), r.hinh_thuc === 'CK' ? 'warning' : 'success'),
        `<span class="max-w-[200px] truncate inline-block">${esc(String(r.ghi_chu||''))}</span>`,
        canEdit ? `<div class="flex justify-center"><button type="button" onclick="deleteThu('${r.id}')" class="text-error hover:underline cursor-pointer text-sm">Xóa</button></div>` : '',
      ], { align: 'center' }));
    }
  }

  if (loai === 'all' || loai === 'chi') {
    for (const r of chiList as Record<string,unknown>[]) {
      const phaiTV = Number(r.phai_thu_ve) ? badge('Cần thu', 'warning') : '';
      const cxId = String(r.chuyen_xe_id || '');
      const related = cxId ? `<a href="/chuyen-xe/${esc(cxId)}" class="text-primary hover:underline font-mono">${esc(cxId)}</a>` : '—';
      allRows.push(tableRow([
        badge('Chi', 'error'),
        `<span class="font-mono text-bodytext">${esc(String(r.id))}</span>`,
        esc(String(r.ngay)),
        esc(String(r.dau_muc||'')),
        related,
        `<span class="font-semibold text-error tabular-nums">−${fmtNum(Number(r.so_tien)||0)} ${r.tien_te}</span>`,
        badge(String(r.hinh_thuc), r.hinh_thuc === 'CK' ? 'warning' : 'success'),
        `<span class="max-w-[200px] truncate inline-block">${esc(String(r.ghi_chu||''))}</span> ${phaiTV}`,
        canEdit ? `<div class="flex justify-center"><button type="button" onclick="deleteChi('${r.id}')" class="text-error hover:underline cursor-pointer text-sm">Xóa</button></div>` : '',
      ], { align: 'center' }));
    }
  }

  const totalCount = allRows.length;
  const sumChips = Object.entries(sumByCcy).map(([tte, s]) =>
    badge(`${tte}: +${fmtNum(s.thu)} / −${fmtNum(s.chi)}`, 'neutral')
  ).join(' ');

  const dmOpts = DAU_MUC_THU_CHI.map(d => `<option value="${d}" ${dauMuc===d?'selected':''}>${d}</option>`).join('');

  const hasFilter = loai !== 'all' || dauMuc !== 'all' || q || range !== 'today';
  const content = `
    ${pageHeader('Thu / Chi', {
      actions: canEdit ? `
        <a href="/thu-chi/thu/create" class="btn bg-success hover:bg-successemphasis text-white flex items-center gap-2">
          <iconify-icon icon="solar:add-circle-linear"></iconify-icon> Phiếu thu
        </a>
        <a href="/thu-chi/chi/create" class="btn bg-error hover:bg-erroremphasis text-white flex items-center gap-2">
          <iconify-icon icon="solar:add-circle-linear"></iconify-icon> Phiếu chi
        </a>` : '',
    })}

    ${card({
      body: `<form method="get" action="/thu-chi" class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-warning uppercase flex items-center gap-1">
          <iconify-icon icon="solar:filter-linear" width="16"></iconify-icon> Lọc
        </span>
        <select name="loai" class="form-control w-auto">
          <option value="all" ${loai==='all'?'selected':''}>Tất cả</option>
          <option value="thu" ${loai==='thu'?'selected':''}>Chỉ Thu</option>
          <option value="chi" ${loai==='chi'?'selected':''}>Chỉ Chi</option>
        </select>
        <select name="dau_muc" class="form-control w-auto">
          <option value="all">Tất cả Đầu mục</option>
          ${dmOpts}
        </select>
        <select name="range" class="form-control w-auto">
          <option value="today" ${range==='today'?'selected':''}>Hôm nay</option>
          <option value="thisWeek" ${range==='thisWeek'?'selected':''}>Tuần này</option>
          <option value="thisMonth" ${range==='thisMonth'?'selected':''}>Tháng này</option>
          <option value="all" ${range==='all'?'selected':''}>Tất cả thời gian</option>
        </select>
        <input name="q" value="${esc(q)}" placeholder="Tìm mã / lý do..." class="form-control w-48">
        ${btnPrimary('Lọc', { type: 'submit' })}
        ${hasFilter ? '<a href="/thu-chi" class="text-error text-sm hover:underline">Xóa lọc</a>' : ''}
      </form>`,
      class: 'mb-4',
    })}

    ${card({
      body: `<div class="flex flex-wrap items-center gap-3 text-sm">
        <span class="font-semibold text-dark dark:text-white">Kết quả (${rangeLabel(range)}):</span>
        <span class="text-bodytext">${totalCount} phiếu</span>
        ${sumChips}
      </div>`,
      class: 'mb-4',
    })}

    ${dataTable(
      ['Loại', 'Mã', 'Ngày', 'Đầu mục', 'Liên quan', 'Số tiền', 'HT', 'Ghi chú', ''],
      allRows.length ? allRows.join('') : tableEmpty(9, 'Không có phiếu nào phù hợp bộ lọc'),
      { align: 'center' },
    )}

    <script>
    async function deleteThu(id) {
      if (!confirm('Xóa phiếu thu này?')) return;
      const res = await fetch('/thu-chi/api/phieu-thu/' + id + '/delete', { method:'POST' });
      if (res.ok) location.reload(); else { const e = await res.json(); alert(e.error||'Lỗi'); }
    }
    async function deleteChi(id) {
      if (!confirm('Xóa phiếu chi này?')) return;
      const res = await fetch('/thu-chi/api/phieu-chi/' + id + '/delete', { method:'POST' });
      if (res.ok) location.reload(); else { const e = await res.json(); alert(e.error||'Lỗi'); }
    }
    </script>
  `;

  return c.html(layout('Thu / Chi', content, user, 'thu-chi'));
});

/* ══════════════════════════════════════════════════════════════
   GET /thu/create — Phiếu thu form
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/thu/create', async (c) => {
  if (!c.get('perms').canEdit) return c.redirect('/thu-chi?denied=edit');
  const user = c.get('user');

  const { results: khachList } = await c.env.DB.prepare('SELECT id, ma_kh, ten FROM khach_hang ORDER BY ten').all();
  const khOpts = (khachList as Record<string,unknown>[]).map(kh =>
    `<option value="${kh.id}">${esc(String(kh.ma_kh))} — ${esc(String(kh.ten))}</option>`
  ).join('');

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const gio = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  const content = `
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a href="/thu-chi" class="text-gray-500 hover:text-gray-700"><iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon></a>
        <h2 class="text-xl font-bold text-gray-900">+ Tạo Phiếu thu</h2>
      </div>

      <form id="formThu" class="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngày <span class="text-red-500">*</span></label>
            <input type="date" name="ngay" value="${today}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Giờ</label>
            <input type="time" name="gio" value="${gio}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Khách hàng <span class="text-red-500">*</span></label>
            <select name="khach_hang_id" id="selKh" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">— Chọn KH —</option>
              ${khOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Đầu mục <span class="text-red-500">*</span></label>
            <select name="dau_muc" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              ${DAU_MUC_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kiểu QT</label>
            <select name="kieu_qt" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="trahet">Trả hết</option>
              <option value="ung">Ứng</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Loại tiền (VT/TH)</label>
            <select name="loai_tien" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="vantai">Vận tải</option>
              <option value="tienhang">Tiền hàng</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền <span class="text-red-500">*</span></label>
            <input type="number" name="so_tien" required step="0.01" min="0" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tiền tệ</label>
            <select name="tien_te" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              ${TIEN_TE_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hình thức</label>
            <select name="hinh_thuc" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              ${HINH_THUC_OPTIONS}
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
          <input type="text" name="ghi_chu" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>

        <div id="loHangSection" class="hidden">
          <label class="block text-sm font-medium text-gray-700 mb-2">Lô hàng liên quan</label>
          <div id="loHangCheckboxes" class="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 text-sm"></div>
        </div>

        <div class="flex gap-3 pt-2">
          <button type="submit" class="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium cursor-pointer">Lưu Phiếu thu</button>
          <a href="/thu-chi" class="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Hủy</a>
        </div>
      </form>
    </div>

    <script>
    const selKh = document.getElementById('selKh');
    selKh.addEventListener('change', async function() {
      const khId = this.value;
      const sec = document.getElementById('loHangSection');
      const box = document.getElementById('loHangCheckboxes');
      if (!khId) { sec.classList.add('hidden'); return; }
      try {
        const res = await fetch('/thu-chi/api/lo-hang-by-kh?khach_hang_id=' + encodeURIComponent(khId));
        const los = await res.json();
        if (!los.length) { sec.classList.add('hidden'); return; }
        sec.classList.remove('hidden');
        box.innerHTML = los.map(l => {
          const dm = l.dau_muc || '';
          const tte = l.tien_te || 'PLN';
          const tt = Number(l.thanh_tien||0).toLocaleString('vi-VN');
          return '<label class="flex items-center gap-2 p-1 hover:bg-gray-100 rounded"><input type="checkbox" name="lo_ids" value="'+l.id+'" class="rounded text-blue-600"> <span>'+l.id+'</span> <span class="text-gray-500 text-xs">'+dm+' · '+tt+' '+tte+'</span></label>';
        }).join('');
      } catch(e) { sec.classList.add('hidden'); }
    });

    document.getElementById('formThu').addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      const loChecked = fd.getAll('lo_ids');
      const body = {
        ngay: fd.get('ngay'), gio: fd.get('gio'), khach_hang_id: fd.get('khach_hang_id'),
        dau_muc: fd.get('dau_muc'), kieu_qt: fd.get('kieu_qt'), loai_tien: fd.get('loai_tien'),
        so_tien: Number(fd.get('so_tien')) || 0, tien_te: fd.get('tien_te'),
        hinh_thuc: fd.get('hinh_thuc'), ghi_chu: fd.get('ghi_chu') || '',
        lo_ids: JSON.stringify(loChecked)
      };
      const res = await fetch('/thu-chi/api/phieu-thu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { window.location.href = '/thu-chi'; } else { const err = await res.json(); alert(err.error||'Lỗi'); }
    });
    </script>
  `;

  return c.html(layout('Tạo Phiếu thu', content, user, 'thu-chi'));
});

/* ══════════════════════════════════════════════════════════════
   GET /chi/create — Phiếu chi form
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/chi/create', async (c) => {
  if (!c.get('perms').canEdit) return c.redirect('/thu-chi?denied=edit');
  const user = c.get('user');

  const { results: chuyenList } = await c.env.DB.prepare(
    `SELECT cx.id, cx.ngay_di, t.ten as tuyen_ten FROM chuyen_xe cx LEFT JOIN tuyen t ON cx.tuyen_id = t.id ORDER BY cx.ngay_di DESC LIMIT 100`
  ).all();
  const cxOpts = (chuyenList as Record<string,unknown>[]).map(cx =>
    `<option value="${cx.id}">${esc(String(cx.id))} — ${esc(String(cx.tuyen_ten||''))} (${cx.ngay_di})</option>`
  ).join('');

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const gio = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  const content = `
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a href="/thu-chi" class="text-gray-500 hover:text-gray-700"><iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon></a>
        <h2 class="text-xl font-bold text-gray-900">+ Tạo Phiếu chi</h2>
      </div>

      <form id="formChi" class="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ngày <span class="text-red-500">*</span></label>
            <input type="date" name="ngay" value="${today}" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Giờ</label>
            <input type="time" name="gio" value="${gio}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Đầu mục <span class="text-red-500">*</span></label>
            <select name="dau_muc" required class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              ${DAU_MUC_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Chuyến xe</label>
            <select name="chuyen_xe_id" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">— Không liên kết —</option>
              ${cxOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền <span class="text-red-500">*</span></label>
            <input type="number" name="so_tien" required step="0.01" min="0" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tiền tệ</label>
            <select name="tien_te" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              ${TIEN_TE_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hình thức</label>
            <select name="hinh_thuc" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              ${HINH_THUC_OPTIONS}
            </select>
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 py-2">
              <input type="checkbox" name="phai_thu_ve" value="1" class="rounded text-amber-600 w-4 h-4">
              <span class="text-sm font-medium text-gray-700">Phải thu về</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
          <input type="text" name="ghi_chu" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>

        <div class="flex gap-3 pt-2">
          <button type="submit" class="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium cursor-pointer">Lưu Phiếu chi</button>
          <a href="/thu-chi" class="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Hủy</a>
        </div>
      </form>
    </div>

    <script>
    document.getElementById('formChi').addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      const body = {
        ngay: fd.get('ngay'), gio: fd.get('gio'), dau_muc: fd.get('dau_muc'),
        chuyen_xe_id: fd.get('chuyen_xe_id') || '',
        so_tien: Number(fd.get('so_tien')) || 0, tien_te: fd.get('tien_te'),
        hinh_thuc: fd.get('hinh_thuc'), ghi_chu: fd.get('ghi_chu') || '',
        phai_thu_ve: fd.has('phai_thu_ve') ? 1 : 0
      };
      const res = await fetch('/thu-chi/api/phieu-chi', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (res.ok) { window.location.href = '/thu-chi'; } else { const err = await res.json(); alert(err.error||'Lỗi'); }
    });
    </script>
  `;

  return c.html(layout('Tạo Phiếu chi', content, user, 'thu-chi'));
});

/* ══════════════════════════════════════════════════════════════
   GET /doi-soat/:khachId — Đối soát công nợ
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/doi-soat/:khachId', async (c) => {
  const user = c.get('user');
  const khachId = c.req.param('khachId');

  /* ── KH info ── */
  const khRow = await c.env.DB.prepare(
    'SELECT id, ma_kh, ten, sdt FROM khach_hang WHERE id=?'
  ).bind(khachId).first();
  if (!khRow) return c.text('Không tìm thấy khách hàng', 404);
  const kh = khRow as Record<string,unknown>;
  const khTen = String(kh.ten);
  const khSdt = String(kh.sdt || '');

  /* ── Lo hang for this KH ── */
  const { results: loList } = await c.env.DB.prepare(
    `SELECT lh.id, lh.chuyen_xe_id, lh.so_kien, lh.thanh_tien, lh.tien_te, lh.so_tien_hang, lh.tien_te_th, lh.giam_gia,
            cx.ngay_di, t.ten as tuyen_ten, t.dau_muc_group,
            h.ten as hang_ten
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     WHERE lh.khach_hang_id = ?
     ORDER BY cx.ngay_di ASC`
  ).bind(khachId).all();

  /* ── Phieu thu for this KH ── */
  const { results: ptList } = await c.env.DB.prepare(
    `SELECT * FROM phieu_thu WHERE khach_hang_id=? ORDER BY ngay DESC, gio DESC`
  ).bind(khachId).all();

  /* ── Calculate totals per dau_muc+tien_te ── */
  const VT_DAUMUCS = ['Vận tải Pháp','Vận tải Ý','Vận tải Tiệp','Vận tải Balan','Vận tải khác'];
  type CcyTot = { phai_thu: number; da_thu: number; con_no: number; vt: number; th: number };
  const totByCcy: Record<string, CcyTot> = {};

  const phieuRows: { id:string; ngayDi:string; tuyen:string; dauMuc:string; nguoiGui:string; soKien:number; vtTienTe:string; vtAmount:number; thTienTe:string; thAmount:number }[] = [];
  let totKien = 0;
  const totByVTCcy: Record<string,number> = {};
  const totByTHCcy: Record<string,number> = {};

  for (const l of loList as Record<string,unknown>[]) {
    const ngayDi = String(l.ngay_di || '');
    const tuyen = String(l.tuyen_ten || '—');
    const dmGroup = String(l.dau_muc_group || 'khac');
    const dmLabel: Record<string,string> = { phap:'Vận tải Pháp', y:'Vận tải Ý', tiep:'Vận tải Tiệp', balan:'Vận tải Balan', khac:'Vận tải khác' };
    const dauMuc = dmLabel[dmGroup] || 'Vận tải khác';
    const nguoiGui = String(l.hang_ten || '—');
    const soKien = Number(l.so_kien) || 0;
    const vtTienTe = String(l.tien_te || 'PLN');
    const vtAmount = (Number(l.thanh_tien) || 0) - (Number(l.giam_gia) || 0);
    const thTienTe = String(l.tien_te_th || l.tien_te || 'PLN');
    const thAmount = Number(l.so_tien_hang) || 0;

    totKien += soKien;
    totByVTCcy[vtTienTe] = (totByVTCcy[vtTienTe] || 0) + vtAmount;
    if (thAmount > 0) totByTHCcy[thTienTe] = (totByTHCcy[thTienTe] || 0) + thAmount;

    /* Per dauMuc+tienTe tracking for totals */
    const vtKey = `${dauMuc}|${vtTienTe}`;
    if (!totByCcy[vtKey]) totByCcy[vtKey] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
    totByCcy[vtKey].phai_thu += vtAmount;
    totByCcy[vtKey].vt += vtAmount;

    if (thAmount > 0) {
      const thKey = `${dauMuc}|TH|${thTienTe}`;
      if (!totByCcy[thKey]) totByCcy[thKey] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
      totByCcy[thKey].phai_thu += thAmount;
      totByCcy[thKey].th += thAmount;
    }

    phieuRows.push({ id: String(l.id), ngayDi, tuyen, dauMuc, nguoiGui, soKien, vtTienTe, vtAmount, thTienTe, thAmount });
  }

  /* Apply phieuThu to reduce con_no */
  const ccySummary: Record<string, CcyTot> = {};
  for (const pt of ptList as Record<string,unknown>[]) {
    const tte = String(pt.tien_te || 'PLN');
    const soTien = Number(pt.so_tien) || 0;
    if (!ccySummary[tte]) ccySummary[tte] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
    ccySummary[tte].da_thu += soTien;
  }

  /* Compute ccy-level phai_thu from lo_hang */
  for (const l of loList as Record<string,unknown>[]) {
    const tte = String(l.tien_te || 'PLN');
    const vt = (Number(l.thanh_tien)||0) - (Number(l.giam_gia)||0);
    const th = Number(l.so_tien_hang)||0;
    const thTte = String(l.tien_te_th || l.tien_te || 'PLN');
    if (!ccySummary[tte]) ccySummary[tte] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
    ccySummary[tte].phai_thu += vt;
    if (!ccySummary[thTte]) ccySummary[thTte] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
    ccySummary[thTte].phai_thu += th;
    ccySummary[thTte].th += th;
    ccySummary[tte].vt += vt;
  }

  for (const tte of Object.keys(ccySummary)) {
    const t = ccySummary[tte];
    t.con_no = t.phai_thu - t.da_thu;
  }

  /* ── Con no big text ── */
  const conNoVTStr: string[] = [];
  const conNoTHStr: string[] = [];
  for (const [tte, t] of Object.entries(ccySummary).sort()) {
    if (t.vt > t.da_thu) conNoVTStr.push(`${fmtNum(t.vt - t.da_thu)} ${tte} tiền VT`);
    if (t.th > 0) {
      const thConNo = t.phai_thu > t.da_thu ? Math.min(t.th, t.phai_thu - t.da_thu) : 0;
      if (thConNo > 0) conNoTHStr.push(`${fmtNum(thConNo)} ${tte} tiền hàng`);
    }
  }

  const hasDebt = conNoVTStr.length > 0 || conNoTHStr.length > 0;
  const bigText = hasDebt
    ? `<div class="text-center p-4 bg-red-50 border-2 border-red-600 rounded-lg mb-4">
        <div class="text-lg font-bold text-red-600">CÒN NỢ</div>
        <div class="text-base font-semibold text-red-700 mt-1">${conNoVTStr.join(' + ')}</div>
        ${conNoTHStr.length ? `<div class="text-base font-semibold text-red-700">${conNoTHStr.join(' + ')}</div>` : ''}
       </div>`
    : `<div class="text-center p-4 bg-green-50 border-2 border-green-600 rounded-lg mb-4">
        <div class="text-lg font-bold text-green-600">✅ KHÁCH HÀNG ĐÃ THANH TOÁN ĐỦ</div>
       </div>`;

  /* ── Phieu hang table ── */
  let phieuHTML = '';
  if (phieuRows.length === 0) {
    phieuHTML = '<div class="text-center text-gray-400 py-6">Chưa có phiếu hàng</div>';
  } else {
    const rows = phieuRows.map(r => `<tr>
      <td class="border border-gray-400 px-2 py-1 text-xs">${r.ngayDi}</td>
      <td class="border border-gray-400 px-2 py-1 text-xs"><strong>${esc(r.tuyen)}</strong><br><span class="text-gray-500">${esc(r.dauMuc)}</span></td>
      <td class="border border-gray-400 px-2 py-1 text-xs">${esc(r.nguoiGui)}</td>
      <td class="border border-gray-400 px-2 py-1 text-xs text-right">${r.soKien}</td>
      <td class="border border-gray-400 px-2 py-1 text-xs text-right bg-blue-50 font-semibold">${fmtNum(r.vtAmount)}</td>
      <td class="border border-gray-400 px-2 py-1 text-xs text-center bg-blue-50">${r.vtTienTe}</td>
      <td class="border border-gray-400 px-2 py-1 text-xs text-right bg-amber-50">${r.thAmount > 0 ? '<strong>' + fmtNum(r.thAmount) + '</strong>' : '—'}</td>
      <td class="border border-gray-400 px-2 py-1 text-xs text-center bg-amber-50">${r.thAmount > 0 ? r.thTienTe : '—'}</td>
    </tr>`).join('');

    const vtTotRows = Object.entries(totByVTCcy).sort().map(([tte, v]) =>
      `<tr class="bg-gray-100 font-bold"><td class="border border-gray-400 px-2 py-1 text-xs" colspan="3">TỔNG VT ${tte}</td><td class="border border-gray-400 px-2 py-1 text-xs text-right">${fmtNum(totKien)}</td><td class="border border-gray-400 px-2 py-1 text-xs text-right bg-blue-100">${fmtNum(v)}</td><td class="border border-gray-400 px-2 py-1 text-xs text-center bg-blue-100">${tte}</td><td class="border border-gray-400 px-2 py-1 text-xs">—</td><td class="border border-gray-400 px-2 py-1 text-xs">—</td></tr>`
    ).join('');
    const thTotRows = Object.entries(totByTHCcy).sort().map(([tte, v]) =>
      `<tr class="bg-amber-100 font-bold"><td class="border border-gray-400 px-2 py-1 text-xs" colspan="6">TỔNG TIỀN HÀNG ${tte}</td><td class="border border-gray-400 px-2 py-1 text-xs text-right bg-amber-100">${fmtNum(v)}</td><td class="border border-gray-400 px-2 py-1 text-xs text-center bg-amber-100">${tte}</td></tr>`
    ).join('');

    phieuHTML = `
      <div class="mb-4">
        <div class="bg-blue-800 text-white px-3 py-1.5 text-sm font-bold">📦 Phiếu hàng — chi tiết theo mệnh giá riêng</div>
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr class="bg-gray-200">
              <th class="border border-gray-400 px-2 py-1 text-left">Ngày</th>
              <th class="border border-gray-400 px-2 py-1 text-left">Tuyến / Đầu mục</th>
              <th class="border border-gray-400 px-2 py-1 text-left">Người gửi</th>
              <th class="border border-gray-400 px-2 py-1 text-right">Kiện</th>
              <th class="border border-gray-400 px-2 py-1 text-right bg-blue-100">Tiền VT</th>
              <th class="border border-gray-400 px-2 py-1 text-center bg-blue-100">MG VT</th>
              <th class="border border-gray-400 px-2 py-1 text-right bg-amber-100">Tiền hàng</th>
              <th class="border border-gray-400 px-2 py-1 text-center bg-amber-100">MG TH</th>
            </tr>
          </thead>
          <tbody>${rows}${vtTotRows}${thTotRows}</tbody>
        </table>
      </div>`;
  }

  /* ── Payment history table ── */
  let ttHTML = '';
  const allTT = ptList as Record<string,unknown>[];
  if (allTT.length === 0) {
    ttHTML = '<div class="text-center text-gray-400 py-4">Chưa có thanh toán</div>';
  } else {
    const ttRows = allTT.map(p => {
      const isTH = String(p.loai_tien || 'vantai') === 'tienhang';
      const tag = isTH ? '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">TH</span>' : '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">VT</span>';
      const ung = String(p.kieu_qt) === 'ung' ? ' <span class="text-amber-600 text-xs">(ứng)</span>' : '';
      return `<tr>
        <td class="border border-gray-400 px-2 py-1 text-xs">${esc(String(p.ngay))}</td>
        <td class="border border-gray-400 px-2 py-1 text-xs">${esc(String(p.dau_muc))}${ung}</td>
        <td class="border border-gray-400 px-2 py-1 text-xs">${tag}</td>
        <td class="border border-gray-400 px-2 py-1 text-xs text-right font-semibold">${fmtNum(Number(p.so_tien)||0)} ${p.tien_te}</td>
      </tr>`;
    }).join('');

    /* Total paid split VT/TH */
    const totVT: Record<string,number> = {};
    const totTH: Record<string,number> = {};
    for (const p of allTT) {
      const isTH = String(p.loai_tien || 'vantai') === 'tienhang';
      const tte = String(p.tien_te || 'PLN');
      if (isTH) totTH[tte] = (totTH[tte]||0) + Number(p.so_tien||0);
      else totVT[tte] = (totVT[tte]||0) + Number(p.so_tien||0);
    }
    const fmtTot = (m: Record<string,number>) => Object.entries(m).map(([t,v]) => fmtNum(v)+' '+t).join(' + ');
    const totalRow = `<tr class="bg-gray-100 font-bold">
      <td class="border border-gray-400 px-2 py-1 text-xs" colspan="3">TỔNG ĐÃ THU</td>
      <td class="border border-gray-400 px-2 py-1 text-xs text-right">VT: ${fmtTot(totVT)||'0'}<br>TH: ${fmtTot(totTH)||'0'}</td>
    </tr>`;

    ttHTML = `
      <div class="mb-4">
        <div class="bg-green-700 text-white px-3 py-1.5 text-sm font-bold">💰 Lịch sử thanh toán</div>
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr class="bg-gray-200">
              <th class="border border-gray-400 px-2 py-1 text-left">Ngày</th>
              <th class="border border-gray-400 px-2 py-1 text-left">Đầu mục</th>
              <th class="border border-gray-400 px-2 py-1 text-left">Loại</th>
              <th class="border border-gray-400 px-2 py-1 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>${ttRows}${totalRow}</tbody>
        </table>
      </div>`;
  }

  const today = new Date().toLocaleDateString('vi-VN');

  const content = `
    <style>
      @media print {
        .no-print, header, aside, .app-header { display: none !important; }
        .page-wrapper { margin-left: 0 !important; }
        body { background: white; }
      }
    </style>

    <div class="flex items-center gap-3 mb-4 no-print">
      <a href="/thu-chi" class="text-gray-500 hover:text-gray-700"><iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon></a>
      <h2 class="text-xl font-bold text-gray-900">📋 Đối soát công nợ — ${esc(khTen)}</h2>
    </div>

    <div class="flex gap-2 mb-4 no-print">
      <button onclick="window.print()" class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm font-medium cursor-pointer">
        <iconify-icon icon="solar:printer-linear"></iconify-icon> In / In A5
      </button>
    </div>

    <div class="max-w-3xl mx-auto bg-white border border-gray-300 rounded-lg p-6 shadow-sm" id="printArea">
      <div class="text-center text-xl font-bold border-b-2 border-gray-800 pb-2 mb-1 text-gray-900 uppercase">${esc(khTen)}</div>
      <div class="text-right text-xs text-gray-500 mb-3">Đối soát ngày: ${today}${khSdt ? ' · SĐT: ' + esc(khSdt) : ''}</div>

      ${bigText}
      ${phieuHTML}
      ${ttHTML}
    </div>
  `;

  return c.html(layout(`Đối soát — ${khTen}`, content, user, 'thu-chi'));
});

/* ══════════════════════════════════════════════════════════════
   API: Lo hang by KH (for thu form checkboxes)
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/api/lo-hang-by-kh', async (c) => {
  const khId = c.req.query('khach_hang_id') || '';
  const { results } = await c.env.DB.prepare(
    `SELECT lh.id, lh.thanh_tien, lh.tien_te, lh.so_tien_hang, t.dau_muc_group
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.khach_hang_id = ?
     ORDER BY lh.id DESC LIMIT 50`
  ).bind(khId).all();

  const dmLabel: Record<string,string> = { phap:'Vận tải Pháp', y:'Vận tải Ý', tiep:'Vận tải Tiệp', balan:'Vận tải Balan', khac:'Vận tải khác' };
  const out = (results as Record<string,unknown>[]).map(r => ({
    id: r.id,
    thanh_tien: Number(r.thanh_tien)||0,
    tien_te: String(r.tien_te || 'PLN'),
    dau_muc: dmLabel[String(r.dau_muc_group || 'khac')] || 'Vận tải khác',
  }));
  return c.json(out);
});

/* ══════════════════════════════════════════════════════════════
   POST /api/phieu-thu — Create phieu thu
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.post('/api/phieu-thu', async (c) => {
  const denied = denyUnlessCanEdit(c);
  if (denied) return denied;
  const user = c.get('user');
  const body = await c.req.json();
  const id = `PT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  await c.env.DB.prepare(
    `INSERT INTO phieu_thu (id, ngay, khach_hang_id, dau_muc, kieu_qt, loai_tien, lo_ids, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    String(body.ngay || new Date().toISOString().slice(0, 10)),
    String(body.khach_hang_id || ''),
    String(body.dau_muc || ''),
    String(body.kieu_qt || 'trahet'),
    String(body.loai_tien || 'vantai'),
    String(body.lo_ids || '[]'),
    Number(body.so_tien) || 0,
    String(body.tien_te || 'PLN'),
    String(body.hinh_thuc || 'TM'),
    String(body.ghi_chu || ''),
    user.display_name,
    String(body.gio || '')
  ).run();

  return c.json({ success: true, id }, 201);
});

/* ══════════════════════════════════════════════════════════════
   POST /api/phieu-chi — Create phieu chi
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.post('/api/phieu-chi', async (c) => {
  const denied = denyUnlessCanEdit(c);
  if (denied) return denied;
  const user = c.get('user');
  const body = await c.req.json();
  const id = `PC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  await c.env.DB.prepare(
    `INSERT INTO phieu_chi (id, ngay, dau_muc, chuyen_xe_id, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio, phai_thu_ve, lo_ids, kieu_qt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    String(body.ngay || new Date().toISOString().slice(0, 10)),
    String(body.dau_muc || ''),
    String(body.chuyen_xe_id || ''),
    Number(body.so_tien) || 0,
    String(body.tien_te || 'PLN'),
    String(body.hinh_thuc || 'TM'),
    String(body.ghi_chu || ''),
    user.display_name,
    String(body.gio || ''),
    Number(body.phai_thu_ve) ? 1 : 0,
    '[]',
    'trahet'
  ).run();

  return c.json({ success: true, id }, 201);
});

/* ══════════════════════════════════════════════════════════════
   POST /api/phieu-thu/:id/delete — Delete phieu thu
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.post('/api/phieu-thu/:id/delete', async (c) => {
  const denied = denyUnlessCanEdit(c);
  if (denied) return denied;
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM phieu_thu WHERE id=?').bind(id).run();
  return c.json({ success: true });
});

/* ══════════════════════════════════════════════════════════════
   POST /api/phieu-chi/:id/delete — Delete phieu chi
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.post('/api/phieu-chi/:id/delete', async (c) => {
  const denied = denyUnlessCanEdit(c);
  if (denied) return denied;
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM phieu_chi WHERE id=?').bind(id).run();
  return c.json({ success: true });
});
