import { Hono } from 'hono';
import type { Env, ChuyenXe, Tuyen, Xe, LoHang } from '../types';
import { layout } from '../utils/layout';
import {
  pageHeader, dataTable, tableRow, tableEmpty, tableActionLink, badge, searchField,
  formField, input, searchSelect, textarea, card, btnPrimary, btnSecondary,
  modalShell, modalFooterInner, kpiCard, FILTER_LABEL_CLASS,
} from '../utils/ui';

// ─── Joined-row types ───────────────────────────────────────────────
interface ChuyenRow extends ChuyenXe {
  tuyen_ten: string;
  tuyen_mau: string;
  tuyen_tien_to: string;
  so_xe: string;
  bien_so: string;
  tai_xe_ten: string;
  cty_vt_ten: string;
  total_kien: number;
}

interface LoHangDetail extends LoHang {
  khach_ten: string;
  hang_ten: string;
}

interface TaiXeRow { id: string; ten: string }
interface CtyVTRow { id: string; ten: string }

// ─── Helpers ────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  return n.toLocaleString('vi-VN');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const p = d.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return d;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TT_LABEL: Record<string, string> = {
  planned: 'K\u1ebf ho\u1ea1ch',
  dang_chay: '\u0110ang ch\u1ea1y',
  hoan_thanh: 'Ho\u00e0n th\u00e0nh',
  huy: 'H\u1ee7y',
};
const TT_VARIANT: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'neutral'> = {
  planned: 'neutral',
  dang_chay: 'primary',
  hoan_thanh: 'success',
  huy: 'error',
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Auto-generate trip ID ──────────────────────────────────────────
async function genMaChuyen(
  db: D1Database,
  tuyenId: string,
  ngayDi: string,
  xeId: string,
): Promise<string> {
  const tuyen = await db.prepare('SELECT tien_to FROM tuyen WHERE id = ?').bind(tuyenId).first<{ tien_to: string }>();
  const tienTo = tuyen?.tien_to || 'K';
  const [y, m, d] = ngayDi.split('-');
  const dateStr = y.slice(-2) + m + d;
  const xe = await db.prepare('SELECT so_xe FROM xe WHERE id = ?').bind(xeId).first<{ so_xe: string }>();
  const xeNum = (xe?.so_xe || '0').replace(/\D/g, '').padStart(2, '0') || '00';
  let mc = `${tienTo}${dateStr}-${xeNum}`;
  let suffix = 'A';
  while (await db.prepare('SELECT id FROM chuyen_xe WHERE id = ?').bind(mc).first()) {
    mc = `${tienTo}${dateStr}-${xeNum}${suffix}`;
    suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
    if (suffix > 'Z') break;
  }
  return mc;
}

// ─── Routes ─────────────────────────────────────────────────────────
export const chuyenXeRoutes = new Hono<{ Bindings: Env }>();

// ===================== GET / — List =================================
chuyenXeRoutes.get('/', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const range = c.req.query('range') || 'all';
  const from = c.req.query('from') || '';
  const to = c.req.query('to') || '';
  const tuyenFilter = c.req.query('tuyen') || '';
  const statusFilter = c.req.query('status') || '';
  const xeFilter = c.req.query('xe') || '';
  const bienSoFilter = c.req.query('bien_so') || '';
  const ctyVtFilter = c.req.query('cty_vt') || '';
  const taiXeFilter = c.req.query('tai_xe') || '';
  const q = (c.req.query('q') || '').toLowerCase().trim();

  const conds: string[] = [];
  const params: unknown[] = [];

  if (range === 'today') {
    conds.push('cx.ngay_di = ?'); params.push(todayStr());
  } else if (range === 'thisWeek') {
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    conds.push('cx.ngay_di >= ? AND cx.ngay_di <= ?');
    params.push(mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]);
  } else if (range === 'thisMonth') {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    conds.push('cx.ngay_di >= ? AND cx.ngay_di <= ?');
    params.push(`${now.getFullYear()}-${mm}-01`, `${now.getFullYear()}-${mm}-${String(last).padStart(2, '0')}`);
  } else if (range === 'custom' && from && to) {
    conds.push('cx.ngay_di >= ? AND cx.ngay_di <= ?');
    params.push(from, to);
  }
  if (tuyenFilter) { conds.push('cx.tuyen_id = ?'); params.push(tuyenFilter); }
  if (statusFilter) { conds.push('cx.trang_thai = ?'); params.push(statusFilter); }
  if (xeFilter) { conds.push('x.so_xe = ?'); params.push(xeFilter); }
  if (bienSoFilter) { conds.push('x.bien_so = ?'); params.push(bienSoFilter); }
  if (ctyVtFilter) { conds.push('x.cty_vt_id = ?'); params.push(ctyVtFilter); }
  if (taiXeFilter) { conds.push('cx.tai_xe_id = ?'); params.push(taiXeFilter); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const sql = `SELECT cx.*, t.ten AS tuyen_ten, t.mau AS tuyen_mau, t.tien_to AS tuyen_tien_to,
    x.so_xe, x.bien_so, x.cty_vt_id, tx.ten AS tai_xe_ten, cvt.ten AS cty_vt_ten,
    COALESCE((SELECT SUM(lh.so_kien) FROM lo_hang lh WHERE lh.chuyen_xe_id = cx.id),0) AS total_kien
    FROM chuyen_xe cx
    LEFT JOIN tuyen t ON cx.tuyen_id = t.id
    LEFT JOIN xe x ON cx.xe_id = x.id
    LEFT JOIN nhan_vien tx ON cx.tai_xe_id = tx.id
    LEFT JOIN cty_van_tai cvt ON x.cty_vt_id = cvt.id
    ${where} ORDER BY cx.ngay_di DESC`;

  const stmt = db.prepare(sql);
  const { results } = params.length
    ? await stmt.bind(...params).all<ChuyenRow>()
    : await stmt.all<ChuyenRow>();

  let chuyens = results as ChuyenRow[];
  if (q) {
    chuyens = chuyens.filter(ch =>
      [ch.id, ch.so_xe, ch.bien_so, ch.tuyen_ten, ch.tai_xe_ten, ch.cty_vt_ten, ch.so_sent_va_gt, ch.ngay_di, ch.ngay_den]
        .join(' ').toLowerCase().includes(q)
    );
  }

  const [tuyenList, xeList, ctyVtList, taiXeList] = await Promise.all([
    db.prepare('SELECT id, ten FROM tuyen ORDER BY ten').all<Tuyen>(),
    db.prepare('SELECT DISTINCT so_xe, bien_so FROM xe ORDER BY so_xe').all<{ so_xe: string; bien_so: string }>(),
    db.prepare('SELECT id, ten FROM cty_van_tai ORDER BY ten').all<CtyVTRow>(),
    db.prepare("SELECT id, ten FROM nhan_vien WHERE vai_tro = 'laixe' ORDER BY ten").all<TaiXeRow>(),
  ]);

  const tongBy: Record<string, number> = {};
  const tongNo: Record<string, number> = {};
  for (const ch of chuyens) {
    const tte = ch.tien_te || 'PLN';
    tongBy[tte] = (tongBy[tte] || 0) + ch.gia_chuyen;
    if (!ch.da_thanh_toan) tongNo[tte] = (tongNo[tte] || 0) + ch.gia_chuyen;
  }
  const fmtCcy = (m: Record<string, number>) =>
    Object.keys(m).length === 0
      ? '0'
      : Object.entries(m).map(([t, v]) => `<strong>${fmtNum(v)} ${t}</strong>`).join('<br>');

  const tuyenCombo = (tuyenList.results as Tuyen[]).map(t => ({ value: t.id, label: t.ten }));
  const xeSoCombo = (xeList.results as { so_xe: string; bien_so: string }[]).map(x => ({ value: x.so_xe, label: x.so_xe }));
  const bienSoCombo = (xeList.results as { so_xe: string; bien_so: string }[]).map(x => ({ value: x.bien_so, label: x.bien_so }));
  const ctyVtCombo = (ctyVtList.results as CtyVTRow[]).map(c => ({ value: c.id, label: c.ten }));
  const taiXeCombo = (taiXeList.results as TaiXeRow[]).map(tx => ({ value: tx.id, label: tx.ten }));

  const rows = chuyens.map(ch => {
    const ttVariant = TT_VARIANT[ch.trang_thai] || 'neutral';
    const ttTag = badge(TT_LABEL[ch.trang_thai] || ch.trang_thai, ttVariant);
    const payTag = ch.da_thanh_toan
      ? badge(`Đã TT ${fmtDate(ch.ngay_thanh_toan)}`, 'success')
      : badge('Chưa TT', 'warning');
    const mauClass = ch.tuyen_mau === 'blue' ? 'bg-lightprimary text-primary' : ch.tuyen_mau === 'green' ? 'bg-lightsuccess text-success' : ch.tuyen_mau === 'amber' ? 'bg-lightwarning text-warning' : 'bg-lightgray text-bodytext';
    return tableRow([
      `<input type="checkbox" class="cx-check rounded border-bordergray" value="${esc(ch.id)}">`,
      `<a href="/chuyen-xe/${esc(ch.id)}" class="text-primary hover:underline font-semibold font-mono">${esc(ch.id)}</a>`,
      esc(ch.so_xe),
      esc(ch.bien_so),
      `<span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${mauClass}">${esc(ch.tuyen_ten)}</span>`,
      esc(ch.cty_vt_ten || '—'),
      esc(ch.tai_xe_ten || '—'),
      fmtDate(ch.ngay_di),
      fmtDate(ch.ngay_den),
      `<span class="tabular-nums">${fmtNum(ch.total_kien)}</span>`,
      `<span class="font-semibold tabular-nums">${fmtNum(ch.gia_chuyen)} ${ch.tien_te}</span>`,
      `<span class="truncate max-w-[120px] inline-block">${esc(ch.so_sent_va_gt) || '—'}</span>`,
      payTag,
      ttTag,
      `<div class="flex items-center justify-center">${tableActionLink(`/chuyen-xe/create?edit=${esc(ch.id)}`)}</div>`,
    ], { align: 'center' });
  }).join('');

  const hasFilter = q || tuyenFilter || statusFilter || xeFilter || bienSoFilter || ctyVtFilter || taiXeFilter || range !== 'all';
  const content = `
    ${pageHeader('Chuyến xe', {
      actions: `<a href="/chuyen-xe/create" class="btn flex items-center gap-2">Chuyến mới</a>`,
    })}

    <div class="card mb-4">
      <div class="card-body">
      <form method="GET" action="/chuyen-xe" class="flex flex-wrap items-end gap-3">
        ${formField('Th\u1eddi gian', searchSelect({
          name: 'range', id: 'filterRange', class: 'w-[9rem] shrink-0',
          value: range, placeholder: 'Thời gian',
          options: [
            { value: 'all', label: 'Tất cả' },
            { value: 'today', label: 'Hôm nay' },
            { value: 'thisWeek', label: 'Tuần này' },
            { value: 'thisMonth', label: 'Tháng này' },
            { value: 'custom', label: 'Tùy chọn' },
          ],
        }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        <div id="customDateWrap" class="${range === 'custom' ? '' : 'hidden'} flex gap-2">
          ${formField('T\u1eeb', input({ type: 'date', name: 'from', value: esc(from), class: 'w-auto' }), { labelClass: FILTER_LABEL_CLASS })}
          ${formField('\u0110\u1ebfn', input({ type: 'date', name: 'to', value: esc(to), class: 'w-auto' }), { labelClass: FILTER_LABEL_CLASS })}
        </div>
        ${formField('Số xe', searchSelect({ name: 'xe', class: 'w-[7rem] shrink-0', emptyLabel: '— Tất cả —', value: xeFilter, placeholder: 'Số xe', options: xeSoCombo }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        ${formField('Biển số', searchSelect({ name: 'bien_so', class: 'w-[8rem] shrink-0', emptyLabel: '— Tất cả —', value: bienSoFilter, placeholder: 'Biển số', options: bienSoCombo }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        ${formField('Tuyến', searchSelect({ name: 'tuyen', class: 'w-[9rem] shrink-0', emptyLabel: '— Tất cả —', value: tuyenFilter, placeholder: 'Tuyến', options: tuyenCombo }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        ${formField('Cty VT', searchSelect({ name: 'cty_vt', class: 'w-[9rem] shrink-0', emptyLabel: '— Tất cả —', value: ctyVtFilter, placeholder: 'Cty VT', options: ctyVtCombo }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        ${formField('Tài xế', searchSelect({ name: 'tai_xe', class: 'w-[9rem] shrink-0', emptyLabel: '— Tất cả —', value: taiXeFilter, placeholder: 'Tài xế', options: taiXeCombo }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        ${formField('Trạng thái', searchSelect({
          name: 'status', class: 'w-[8rem] shrink-0', emptyLabel: 'Tất cả', value: statusFilter, placeholder: 'Trạng thái',
          options: [
            { value: 'planned', label: 'Kế hoạch' },
            { value: 'dang_chay', label: 'Đang chạy' },
            { value: 'hoan_thanh', label: 'Hoàn thành' },
            { value: 'huy', label: 'Hủy' },
          ],
        }), { labelClass: FILTER_LABEL_CLASS, class: 'shrink-0' })}
        <div class="flex-1">
          <label class="block ${FILTER_LABEL_CLASS} mb-1">Tìm kiếm</label>
          ${searchField({ value: esc(q), placeholder: 'Mã chuyến, biển số, tuyến, tài xế...', auto: true })}
        </div>
        <button type="submit" class="btn text-sm cursor-pointer">Lọc</button>
        ${hasFilter ? '<a href="/chuyen-xe" class="text-error hover:underline text-sm">Xóa lọc</a>' : ''}
      </form>
      </div>
    </div>

    <div id="cxBulkBar" class="hidden htql-bulkbar mb-4">
      <label class="flex items-center gap-2 font-semibold mr-2 cursor-pointer">
        <input type="checkbox" id="cxBulkBarChk" class="rounded border-success" checked>
        <span id="cxBulkCount">0 chuyến đã chọn:</span>
      </label>
      <button type="button" onclick="cxBulkDaVe()" class="htql-bulk-btn">Đã về (set ngày về)</button>
      <button type="button" onclick="cxBulkThanhToan()" class="htql-bulk-btn">Thanh toán cước</button>
      <button type="button" onclick="cxBulkUng()" class="htql-bulk-btn">Ứng cước</button>
      <button type="button" onclick="cxBulkDelete()" class="htql-bulk-btn htql-bulk-danger">Xóa chuyến</button>
      <button type="button" onclick="cxClearSelection()" class="htql-bulk-btn ml-auto">Bỏ chọn tất cả</button>
    </div>
    <style>
      .htql-bulkbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#e7f6ec;border:1px solid #b7e4c7;color:#1a7440;border-radius:8px;padding:8px 12px;font-size:13px}
      .dark .htql-bulkbar{background:#10271b;border-color:#1f5135;color:#7ee2a8}
      .htql-bulk-btn{border:1px solid #b7e4c7;color:#1a7440;background:#fff;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer}
      .htql-bulk-btn:hover{background:#d7f0e0}
      .dark .htql-bulk-btn{background:#0d1f15;border-color:#1f5135;color:#7ee2a8}
      .htql-bulk-danger{border-color:#f2b8b5;color:#c0392b}
      .htql-bulk-danger:hover{background:#fde8e6}
    </style>

    ${dataTable(
      ['<input type="checkbox" id="cxSelectAll" class="rounded border-bordergray" title="Chọn tất cả">', 'Mã chuyến', 'Số xe', 'Biển số', 'Tuyến', 'Cty VT', 'Tài xế', 'Ngày đi', 'Ngày về', 'Kiện', 'Giá chuyến', 'SENT/GT', 'TT cty VT', 'Trạng thái', ''],
      rows || tableEmpty(15),
      { align: 'center' },
    )}
    <div class="card mt-0 rounded-t-none border-t-0 -mt-6">
      <div class="card-body py-3 flex justify-between items-start flex-wrap gap-4 text-sm border-t border-light-dark">
        <span class="text-bodytext">${chuyens.length} chuyến${hasFilter ? ' (đã lọc)' : ''}</span>
        <span><b>Tổng chi phí:</b><br>${fmtCcy(tongBy)}</span>
        <span class="text-warning"><b>Còn nợ cty VT:</b><br>${fmtCcy(tongNo)}</span>
      </div>
    </div>

    <script>
    document.getElementById('filterRange')?.addEventListener('change', function() {
      document.getElementById('customDateWrap')?.classList.toggle('hidden', this.value !== 'custom');
    });

    function cxSelectedIds() {
      return Array.from(document.querySelectorAll('.cx-check:checked')).map(function(cb) { return cb.value; });
    }

    function cxUpdateBulkBar() {
      const ids = cxSelectedIds();
      const bar = document.getElementById('cxBulkBar');
      const cnt = document.getElementById('cxBulkCount');
      if (!bar || !cnt) return;
      if (ids.length) {
        bar.classList.remove('hidden');
        cnt.textContent = ids.length + ' chuyến đã chọn:';
      } else {
        bar.classList.add('hidden');
      }
      const sa = document.getElementById('cxSelectAll');
      const all = document.querySelectorAll('.cx-check');
      if (sa && all.length) sa.checked = ids.length === all.length;
    }

    document.getElementById('cxSelectAll')?.addEventListener('change', function() {
      document.querySelectorAll('.cx-check').forEach(function(cb) { cb.checked = this.checked; }.bind(this));
      cxUpdateBulkBar();
    });

    document.querySelectorAll('.cx-check').forEach(function(cb) {
      cb.addEventListener('change', cxUpdateBulkBar);
    });

    document.getElementById('cxBulkBarChk')?.addEventListener('change', function() {
      if (!this.checked) cxClearSelection();
    });

    window.cxClearSelection = function() {
      document.querySelectorAll('.cx-check').forEach(function(cb) { cb.checked = false; });
      const sa = document.getElementById('cxSelectAll');
      if (sa) sa.checked = false;
      cxUpdateBulkBar();
    };

    async function cxBulkPost(action, extra) {
      const ids = cxSelectedIds();
      if (!ids.length) return;
      const payload = Object.assign({ action: action, ids: ids }, extra || {});
      const res = await fetch('/chuyen-xe/api/chuyen-xe/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (action === 'delete' && data.skipped > 0) {
          alert('Đã xóa ' + data.count + ' chuyến. Bỏ qua ' + data.skipped + ' chuyến còn phiếu hàng.');
        }
        location.reload();
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi');
      }
    }

    window.cxBulkDaVe = function() {
      const ids = cxSelectedIds();
      if (!ids.length) return;
      const ngay = prompt('Ngày về cho ' + ids.length + ' chuyến (YYYY-MM-DD), để trống = hôm nay:', new Date().toISOString().slice(0, 10));
      if (ngay === null) return;
      cxBulkPost('da-ve', { ngay: ngay || undefined });
    };

    window.cxBulkThanhToan = function() {
      const ids = cxSelectedIds();
      if (!ids.length) return;
      if (!confirm('Tạo phiếu chi thanh toán cước cho ' + ids.length + ' chuyến?')) return;
      const ngay = prompt('Ngày phiếu chi (YYYY-MM-DD), để trống = hôm nay:', new Date().toISOString().slice(0, 10));
      if (ngay === null) return;
      cxBulkPost('thanh-toan', { ngay: ngay || undefined, hinhThuc: 'TM' });
    };

    window.cxBulkUng = function() {
      const ids = cxSelectedIds();
      if (!ids.length) return;
      const soTien = prompt('Số tiền ứng cước cho mỗi chuyến (PLN/EUR theo chuyến):');
      if (soTien === null || !soTien.trim()) return;
      const ngay = prompt('Ngày phiếu chi (YYYY-MM-DD), để trống = hôm nay:', new Date().toISOString().slice(0, 10));
      if (ngay === null) return;
      cxBulkPost('ung', { soTien: Number(soTien), ngay: ngay || undefined, hinhThuc: 'TM' });
    };

    window.cxBulkDelete = function() {
      const ids = cxSelectedIds();
      if (!ids.length) return;
      if (!confirm('Xóa ' + ids.length + ' chuyến? Chuyến còn phiếu hàng sẽ bị bỏ qua.')) return;
      cxBulkPost('delete');
    };
    </script>
  `;
  return c.html(layout('Chuy\u1ebfn xe', content, user, 'chuyen-xe'));
});

// ===================== GET /create — Create / Edit form =============
chuyenXeRoutes.get('/create', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const editId = c.req.query('edit') || '';

  const tuyenList = await db.prepare('SELECT id, ten, tien_to FROM tuyen ORDER BY ten').all<Tuyen>();
  const xeList = await db.prepare('SELECT id, so_xe, bien_so, tai_xe_id FROM xe ORDER BY so_xe').all<Xe>();
  const taiXeList = await db.prepare("SELECT id, ten FROM nhan_vien WHERE vai_tro = 'laixe' ORDER BY ten").all<TaiXeRow>();
  const ctyVtList = await db.prepare('SELECT id, ten FROM cty_van_tai ORDER BY ten').all<CtyVTRow>();

  let ch: (ChuyenXe & { so_xe?: string; bien_so?: string; tuyen_ten?: string }) | null = null;
  if (editId) {
    ch = await db.prepare(
      `SELECT cx.*, x.so_xe, x.bien_so, t.ten AS tuyen_ten
       FROM chuyen_xe cx LEFT JOIN xe x ON cx.xe_id = x.id LEFT JOIN tuyen t ON cx.tuyen_id = t.id
       WHERE cx.id = ?`
    ).bind(editId).first<ChuyenXe & { so_xe: string; bien_so: string; tuyen_ten: string }>();
  }

  const isEdit = !!ch;
  const today = todayStr();

  const tuyenCombo = (tuyenList.results as Tuyen[]).map(t => ({
    value: t.id, label: t.ten, data: { tiento: t.tien_to },
  }));
  const xeCombo = (xeList.results as Xe[]).map(x => ({
    value: x.id,
    label: `${x.so_xe} · ${x.bien_so}`,
    data: { soxe: x.so_xe, taixe: x.tai_xe_id || '' },
  }));
  const taiXeCombo = (taiXeList.results as TaiXeRow[]).map(tx => ({ value: tx.id, label: tx.ten }));
  const ctyVtCombo = (ctyVtList.results as CtyVTRow[]).map(cv => ({ value: cv.id, label: cv.ten }));

  const formBody = `
      <form id="chForm" class="space-y-4">
        ${isEdit ? `<input type="hidden" name="id" value="${esc(ch!.id)}">` : ''}
        ${!isEdit ? `<div>
          <label class="block text-sm font-medium text-dark dark:text-white mb-1">M\u00e3 chuy\u1ebfn (t\u1ef1 \u0111\u1ed9ng sinh)</label>
          <div id="maPreview" class="text-lg font-semibold text-primary bg-lightprimary px-3 py-2 rounded-md border border-primary/20 min-h-[38px] flex items-center">
            <span class="text-bodytext dark:text-darklink text-sm">Ch\u1ecdn tuy\u1ebfn, xe, ng\u00e0y \u0111i \u2192 m\u00e3 t\u1ef1 sinh</span>
          </div>
          <div class="mt-2">
            ${input({ type: 'text', name: 'custom_id', id: 'customId', placeholder: 'Ho\u1eb7c nh\u1eadp m\u00e3 th\u1ee7 c\u00f4ng: VD DK-001', class: 'max-w-xs' })}
          </div>
        </div>` : `
        <div>
          <label class="block text-sm font-medium text-dark dark:text-white mb-1">M\u00e3 chuy\u1ebfn</label>
          <div class="text-lg font-semibold text-dark dark:text-white bg-lightgray dark:bg-darkgray px-3 py-2 rounded-md border border-bordergray dark:border-darkborder">${esc(ch!.id)}</div>
        </div>`}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${formField('Tuy\u1ebfn', searchSelect({
            name: 'tuyen_id', id: 'selTuyen', required: true, placeholder: 'Chọn tuyến...',
            value: ch?.tuyen_id || '', options: tuyenCombo,
          }), { required: true })}
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <label class="block text-sm font-medium text-dark dark:text-white">Xe <span class="text-error">*</span></label>
              <button type="button" onclick="openXeModal()" class="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                <iconify-icon icon="solar:add-circle-linear" width="14"></iconify-icon> Th\u00eam xe
              </button>
            </div>
            ${searchSelect({
              name: 'xe_id', id: 'selXe', required: true, placeholder: 'Chọn xe...',
              value: ch?.xe_id || '', options: xeCombo,
            })}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${formField('Ng\u00e0y \u0111i', input({ type: 'date', name: 'ngay_di', id: 'ngayDi', required: true, value: ch?.ngay_di || today }), { required: true })}
          ${formField('Ng\u00e0y v\u1ec1 (\u0111\u1ec3 tr\u1ed1ng n\u1ebfu ch\u01b0a v\u1ec1)', input({ type: 'date', name: 'ngay_den', value: ch?.ngay_den || '' }))}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${formField('Gi\u00e1 chuy\u1ebfn (tr\u1ea3 Cty VT)', input({ type: 'number', name: 'gia_chuyen', value: String(ch?.gia_chuyen ?? 5000) }))}
          ${formField('Ti\u1ec1n t\u1ec7', searchSelect({
            name: 'tien_te', placeholder: 'Tiền tệ',
            value: ch?.tien_te || 'PLN',
            options: [
              { value: 'PLN', label: 'PLN' },
              { value: 'EUR', label: 'EUR' },
              { value: 'USD', label: 'USD' },
            ],
          }))}
          ${formField('Tr\u1ea1ng th\u00e1i', searchSelect({
            name: 'trang_thai', placeholder: 'Trạng thái',
            value: ch?.trang_thai || 'planned',
            options: [
              { value: 'planned', label: 'Kế hoạch' },
              { value: 'dang_chay', label: 'Đang chạy' },
              { value: 'hoan_thanh', label: 'Hoàn thành' },
              { value: 'huy', label: 'Hủy' },
            ],
          }))}
        </div>

        ${formField('S\u1ed1 SENT / Gi\u1ea5y t\u1edd (CMR/DDT)', input({ type: 'text', name: 'so_sent_va_gt', value: esc(ch?.so_sent_va_gt) }))}

        ${formField('T\u00e0i x\u1ebf', searchSelect({
          name: 'tai_xe_id', id: 'selTaiXe', placeholder: 'Tài xế...',
          value: ch?.tai_xe_id || '', emptyLabel: 'Tự động từ xe', options: taiXeCombo,
        }))}

        ${formField('Ghi ch\u00fa', textarea({ name: 'ghi_chu', rows: '2', value: esc(ch?.ghi_chu) }))}

        ${isEdit ? `<div class="flex items-center gap-2">
          <input type="checkbox" name="da_thanh_toan" id="chkTT" value="1"${ch!.da_thanh_toan ? ' checked' : ''} class="rounded border-bordergray">
          <label for="chkTT" class="text-sm text-dark dark:text-darklink">\u0110\u00e3 thanh to\u00e1n cho Cty VT</label>
        </div>` : ''}

        <div class="flex flex-wrap gap-3 pt-2">
          ${btnPrimary(isEdit ? '\u2713 L\u01b0u' : '\u2713 T\u1ea1o chuy\u1ebfn', { type: 'submit' })}
          <a href="/chuyen-xe" class="btn-outline border-bordergray text-link dark:text-darklink inline-flex items-center px-4 py-2">H\u1ee7y</a>
          ${isEdit ? `<button type="button" id="btnDel" class="btn bg-error hover:bg-erroremphasis text-white flex items-center gap-2 cursor-pointer ml-auto">X\u00f3a chuy\u1ebfn</button>` : ''}
        </div>
      </form>`;

  const content = `
    <div class="mb-4">
      <a href="/chuyen-xe" class="text-primary hover:underline text-sm inline-flex items-center gap-1">
        <iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Quay l\u1ea1i danh s\u00e1ch
      </a>
    </div>

    ${card({
      title: isEdit ? 'S\u1eeda chuy\u1ebfn ' + esc(ch!.id) : 'Chuy\u1ebfn m\u1edbi',
      class: 'max-w-4xl',
      body: formBody,
    })}

    ${modalShell({
      id: 'xeModal',
      title: 'Th\u00eam xe m\u1edbi',
      size: 'md',
      icon: 'solar:bus-bold-duotone',
      body: `<form id="xeForm" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${formField('S\u1ed1 xe', input({ name: 'so_xe', id: 'xe_so_xe', required: true, placeholder: 'VD: XE 55' }), { required: true })}
          ${formField('Bi\u1ec3n s\u1ed1', input({ name: 'bien_so', id: 'xe_bien_so', required: true, placeholder: 'VD: WW 12345A' }), { required: true })}
        </div>
        ${formField('Lo\u1ea1i xe', input({ name: 'loai_xe', id: 'xe_loai', placeholder: 'VD: T\u1ea3i l\u1edbn' }))}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${formField('Cty VT', searchSelect({
            name: 'cty_vt_id', id: 'xe_cty_vt', emptyLabel: '— Chọn —', placeholder: 'Cty VT...', options: ctyVtCombo,
          }))}
          ${formField('T\u00e0i x\u1ebf m\u1eb7c \u0111\u1ecbnh', searchSelect({
            name: 'tai_xe_id', id: 'xe_tai_xe', emptyLabel: '— Chọn —', placeholder: 'Tài xế...', options: taiXeCombo,
          }))}
        </div>
      </form>`,
      footer: modalFooterInner(
        btnSecondary('Hu\u1ef7', { onclick: 'htqlCloseModal("xeModal")' }),
        `<button type="submit" form="xeForm" class="btn cursor-pointer">\u2713 T\u1ea1o xe</button>`,
      ),
    })}

    <script>
    const selTuyen = document.getElementById('selTuyen');
    const selXe = document.getElementById('selXe');
    const selTaiXe = document.getElementById('selTaiXe');
    const ngayDi = document.getElementById('ngayDi');
    const maPreview = document.getElementById('maPreview');
    const customId = document.getElementById('customId');
    const form = document.getElementById('chForm');
    const isEdit = ${isEdit ? 'true' : 'false'};
    const editId = ${editId ? `"${esc(editId)}"` : 'null'};

    function syncTaiXe() {
      const xe = htqlComboboxGet('selXe');
      if (xe && xe.data && xe.data.taixe) {
        htqlComboboxSet('selTaiXe', xe.data.taixe);
      }
    }
    selXe?.addEventListener('change', syncTaiXe);

    function updatePreview() {
      if (isEdit || !maPreview) return;
      const customVal = customId?.value?.trim();
      if (customVal) {
        maPreview.innerHTML = '<span class="text-bodytext dark:text-darklink text-sm">T\u00f9y ch\u1ecdn:</span> <span class="text-primary">' + customVal + '</span>';
        return;
      }
      const tOpt = htqlComboboxGet('selTuyen');
      const xOpt = htqlComboboxGet('selXe');
      const d = ngayDi?.value;
      if (!tOpt?.value || !xOpt?.value || !d) {
        maPreview.innerHTML = '<span class="text-bodytext dark:text-darklink text-sm">Ch\u1ecdn tuy\u1ebfn, xe, ng\u00e0y \u0111i \u2192 m\u00e3 t\u1ef1 sinh</span>';
        return;
      }
      const tienTo = (tOpt.data && tOpt.data.tiento) || 'K';
      const parts = d.split('-');
      const dateStr = parts[0].slice(-2) + parts[1] + parts[2];
      const xeNum = ((xOpt.data && xOpt.data.soxe) || '0').replace(/\\D/g, '').padStart(2, '0') || '00';
      const mc = tienTo + dateStr + '-' + xeNum;
      maPreview.innerHTML = '<strong class="text-primary">' + mc + '</strong> <span class="text-bodytext dark:text-darklink text-sm">(ki\u1ec3m tra tr\u00f9ng khi l\u01b0u)</span>';
    }
    selTuyen?.addEventListener('change', updatePreview);
    selXe?.addEventListener('change', () => { syncTaiXe(); updatePreview(); });
    ngayDi?.addEventListener('change', updatePreview);
    customId?.addEventListener('input', updatePreview);

    function openXeModal() {
      document.getElementById('xeForm').reset();
      htqlOpenModal('xeModal');
    }

    document.getElementById('xeForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch('/chuyen-xe/api/xe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'L\u1ed7i t\u1ea1o xe');
        return;
      }
      const data = await res.json();
      htqlComboboxAdd('selXe', {
        value: data.id,
        label: data.so_xe + ' \\u00b7 ' + data.bien_so,
        data: { soxe: data.so_xe, taixe: data.tai_xe_id || '' },
      });
      syncTaiXe();
      updatePreview();
      htqlCloseModal('xeModal');
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = {};
      fd.forEach((v, k) => { body[k] = v; });
      body.gia_chuyen = Number(body.gia_chuyen) || 0;
      body.da_thanh_toan = body.da_thanh_toan ? 1 : 0;
      if (!body.ngay_den) body.ngay_den = null;
      if (!body.tai_xe_id) body.tai_xe_id = null;

      const res = await fetch('/chuyen-xe/api/chuyen-xe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = '/chuyen-xe/' + (data.id || editId);
      } else {
        const err = await res.json();
        alert(err.error || 'L\u1ed7i');
      }
    });

    document.getElementById('btnDel')?.addEventListener('click', async () => {
      if (!confirm('X\u00f3a chuy\u1ebfn ' + editId + '? Phi\u1ebfu thu\u1ed9c chuy\u1ebfn s\u1ebd KH\u00d4NG b\u1ecb xo\u00e1.')) return;
      const res = await fetch('/chuyen-xe/api/chuyen-xe/' + editId + '/delete', { method: 'POST' });
      if (res.ok) window.location.href = '/chuyen-xe';
      else { const err = await res.json(); alert(err.error || 'L\u1ed7i'); }
    });
    </script>
  `;
  return c.html(layout(isEdit ? 'S\u1eeda chuy\u1ebfn' : 'T\u1ea1o chuy\u1ebfn', content, user, 'chuyen-xe'));
});

// ===================== GET /:id — Detail ============================
chuyenXeRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const id = c.req.param('id');

  const ch = await db.prepare(
    `SELECT cx.*, t.ten AS tuyen_ten, t.mau AS tuyen_mau, t.tien_to AS tuyen_tien_to,
       x.so_xe, x.bien_so, x.cty_vt_id, tx.ten AS tai_xe_ten, cvt.ten AS cty_vt_ten
     FROM chuyen_xe cx
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     LEFT JOIN xe x ON cx.xe_id = x.id
     LEFT JOIN nhan_vien tx ON cx.tai_xe_id = tx.id
     LEFT JOIN cty_van_tai cvt ON x.cty_vt_id = cvt.id
     WHERE cx.id = ?`
  ).bind(id).first<ChuyenRow>();

  if (!ch) return c.notFound();

  const { results: lots } = await db.prepare(
    `SELECT lh.*, kh.ten AS khach_ten, h.ten AS hang_ten
     FROM lo_hang lh
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     WHERE lh.chuyen_xe_id = ? ORDER BY lh.id`
  ).bind(id).all<LoHangDetail>();

  const totalKien = lots.reduce((s, l) => s + l.so_kien, 0);
  const sumVT: Record<string, number> = {};
  const sumTH: Record<string, number> = {};
  for (const l of lots) {
    const vt = l.thanh_tien - (l.giam_gia || 0);
    sumVT[l.tien_te] = (sumVT[l.tien_te] || 0) + vt;
    if (l.so_tien_hang > 0) {
      const tte = l.tien_te_th || l.tien_te;
      sumTH[tte] = (sumTH[tte] || 0) + l.so_tien_hang;
    }
  }
  const fmtMap = (m: Record<string, number>) =>
    Object.keys(m).length === 0 ? '0'
    : Object.entries(m).map(([t, v]) => `${fmtNum(v)} ${t}`).join('<br>');

  const loRows = lots.map(l => {
    const tienVT = l.thanh_tien - (l.giam_gia || 0);
    return tableRow([
      `<a href="/lo-hang/${esc(l.id)}" class="text-primary hover:underline font-semibold">${esc(l.id)}</a>`,
      esc(l.khach_ten),
      esc(l.hang_ten),
      `<span class="block text-right">${l.so_kien}</span>`,
      `<span class="block text-right ${l.da_tra_hang === l.so_kien ? 'text-success' : 'text-warning'}">${l.da_tra_hang}</span>`,
      `<span class="block text-right">${fmtNum(tienVT)} ${l.tien_te}</span>`,
      `<span class="block text-right">${l.so_tien_hang > 0 ? `${fmtNum(l.so_tien_hang)} ${l.tien_te_th || l.tien_te}` : '\u2014'}</span>`,
    ]);
  }).join('');

  const payBtn = ch.da_thanh_toan
    ? `<button type="button" onclick="toggleTT()" class="cursor-pointer">${badge('\u2713 \u0110\u00e3 thanh to\u00e1n cty VT', 'success')}</button>`
    : `<button type="button" onclick="toggleTT()" class="cursor-pointer">${badge('Ch\u01b0a thanh to\u00e1n cty VT', 'warning')}</button>`;

  const infoRow = (label: string, val: string) =>
    `<div class="flex justify-between gap-4 py-2 border-b border-light-dark last:border-0">
      <span class="text-bodytext dark:text-darklink shrink-0">${label}</span>
      <span class="text-dark dark:text-white text-right">${val}</span>
    </div>`;

  const content = `
    <div class="mb-4">
      <a href="/chuyen-xe" class="text-primary hover:underline text-sm inline-flex items-center gap-1">
        <iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Quay l\u1ea1i danh s\u00e1ch
      </a>
    </div>

    ${pageHeader(esc(ch.id), {
      subtitle: `${esc(ch.so_xe)} (${esc(ch.bien_so)}) \u00b7 ${fmtDate(ch.ngay_di)} \u2192 ${fmtDate(ch.ngay_den)} \u00b7 TX: ${esc(ch.tai_xe_ten) || '\u2014'}`,
      actions: `
        <div class="flex flex-wrap items-center gap-2">
          ${ch.tuyen_ten ? badge(esc(ch.tuyen_ten), 'primary') : ''}
          ${ch.cty_vt_ten ? badge(esc(ch.cty_vt_ten), 'neutral') : ''}
          ${payBtn}
          ${ch.so_sent_va_gt ? badge(esc(ch.so_sent_va_gt), 'neutral') : ''}
          ${badge(TT_LABEL[ch.trang_thai] || ch.trang_thai, TT_VARIANT[ch.trang_thai] || 'neutral')}
          <a href="/chuyen-xe/create?edit=${esc(ch.id)}" class="btn flex items-center gap-1.5 cursor-pointer text-sm">
            <iconify-icon icon="solar:pen-linear"></iconify-icon> S\u1eeda
          </a>
        </div>`,
    })}

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${kpiCard('Phi\u1ebfu trong chuy\u1ebfn', String(lots.length), { hintHtml: `${totalKien} ki\u1ec7n h\u00e0ng`, icon: 'solar:box-bold-duotone', tone: 'primary' })}
      ${kpiCard('T\u1ed5ng ti\u1ec1n VT', fmtMap(sumVT), { icon: 'solar:wad-of-money-bold-duotone', tone: 'success' })}
      ${Object.keys(sumTH).length > 0 ? kpiCard('Ti\u1ec1n h\u00e0ng', fmtMap(sumTH), { icon: 'solar:box-minimalistic-bold-duotone', tone: 'warning' }) : ''}
      ${kpiCard('Chi Cty VT', `${fmtNum(ch.gia_chuyen)} ${ch.tien_te}`, {
        hintHtml: ch.da_thanh_toan ? '\u2713 \u0110\u00e3 TT' : 'Ch\u01b0a TT',
        icon: 'solar:card-transfer-bold-duotone',
        tone: ch.da_thanh_toan ? 'success' : 'error',
      })}
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <div class="xl:col-span-2">
        ${lots.length === 0
          ? card({ title: `Phi\u1ebfu h\u00e0ng (${lots.length})`, body: '<p class="text-center text-bodytext dark:text-darklink py-8">Chuy\u1ebfn ch\u01b0a c\u00f3 phi\u1ebfu</p>' })
          : card({
              title: `Phi\u1ebfu h\u00e0ng (${lots.length})`,
              body: `<div class="overflow-x-auto -mx-[30px] px-[30px]">
                <table class="htql-table min-w-full w-full text-sm">
                  <thead><tr class="border-b border-light-dark">
                    <th>M\u00e3</th><th>Kh\u00e1ch</th><th>H\u00e3ng</th>
                    <th class="text-right">Ki\u1ec7n</th><th class="text-right">\u0110\u00e3 tr\u1ea3</th>
                    <th class="text-right">Ti\u1ec1n VT</th><th class="text-right">Ti\u1ec1n h\u00e0ng</th>
                  </tr></thead>
                  <tbody class="divide-y divide-border dark:divide-darkborder">${loRows}</tbody>
                </table>
              </div>`,
            })
        }
      </div>
      ${card({
        title: 'Th\u00f4ng tin chuy\u1ebfn',
        class: 'h-fit',
        body: `
          ${infoRow('M\u00e3 chuy\u1ebfn', `<strong>${esc(ch.id)}</strong>`)}
          ${infoRow('Tuy\u1ebfn', `<strong>${esc(ch.tuyen_ten)}</strong>`)}
          ${infoRow('Xe', `${esc(ch.so_xe)} (${esc(ch.bien_so)})`)}
          ${infoRow('T\u00e0i x\u1ebf', esc(ch.tai_xe_ten) || '\u2014')}
          ${infoRow('Ng\u00e0y \u0111i', fmtDate(ch.ngay_di))}
          ${infoRow('Ng\u00e0y v\u1ec1', fmtDate(ch.ngay_den))}
          ${infoRow('Gi\u00e1 chuy\u1ebfn', `<strong>${fmtNum(ch.gia_chuyen)} ${ch.tien_te}</strong>`)}
          ${infoRow('Tr\u1ea1ng th\u00e1i', TT_LABEL[ch.trang_thai] || ch.trang_thai)}
          ${infoRow('SENT/GT', esc(ch.so_sent_va_gt) || '\u2014')}
          ${infoRow('Ghi ch\u00fa', esc(ch.ghi_chu) || '\u2014')}
        `,
      })}
    </div>

    <script>
    async function toggleTT() {
      const res = await fetch('/chuyen-xe/api/chuyen-xe/${esc(id)}/toggle-thanh-toan', { method: 'POST' });
      if (res.ok) location.reload();
      else { const err = await res.json(); alert(err.error || 'L\u1ed7i'); }
    }
    </script>
  `;
  return c.html(layout('Chuy\u1ebfn ' + id, content, user, 'chuyen-xe'));
});

// ===================== POST /api/xe — Create vehicle ================
chuyenXeRoutes.post('/api/xe', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{
    so_xe?: string;
    bien_so?: string;
    loai_xe?: string;
    tai_xe_id?: string;
    cty_vt_id?: string;
  }>();

  const soXe = (body.so_xe || '').trim();
  const bienSo = (body.bien_so || '').trim();
  if (!soXe || !bienSo) {
    return c.json({ error: 'Thi\u1ebfu s\u1ed1 xe ho\u1eb7c bi\u1ec3n s\u1ed1' }, 400);
  }

  const existingBien = await db.prepare('SELECT id FROM xe WHERE bien_so = ?').bind(bienSo).first();
  if (existingBien) return c.json({ error: 'Bi\u1ec3n s\u1ed1 \u0111\u00e3 t\u1ed3n t\u1ea1i' }, 400);

  let baseId = ('XE-' + soXe.replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '')).slice(0, 20);
  if (!baseId || baseId === 'XE-') baseId = `XE-${Date.now()}`;
  let id = baseId;
  let n = 1;
  while (await db.prepare('SELECT id FROM xe WHERE id = ?').bind(id).first()) {
    id = `${baseId}-${n++}`.slice(0, 24);
  }

  const taiXeId = (body.tai_xe_id || '').trim() || null;
  const ctyVtId = (body.cty_vt_id || '').trim() || null;
  const loaiXe = (body.loai_xe || '').trim();

  await db.prepare(
    `INSERT INTO xe (id, bien_so, so_xe, loai_xe, trong_tai, tai_xe_id, cty_vt_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, bienSo, soXe, loaiXe, taiXeId, ctyVtId).run();

  return c.json({ success: true, id, so_xe: soXe, bien_so: bienSo, tai_xe_id: taiXeId || '' });
});

// ===================== POST /api/chuyen-xe — Create / Update ========
chuyenXeRoutes.post('/api/chuyen-xe', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const id = body.id as string | undefined;
  const tuyenId = String(body.tuyen_id || '').trim();
  const xeId = String(body.xe_id || '').trim();
  const ngayDi = body.ngay_di as string;
  const ngayDen = (body.ngay_den as string) || null;
  const giaChuyen = Number(body.gia_chuyen) || 0;
  const tienTe = (body.tien_te as string) || 'PLN';
  const trangThai = (body.trang_thai as string) || 'planned';
  const soSentVaGT = (body.so_sent_va_gt as string) || '';
  const taiXeRaw = String(body.tai_xe_id || '').trim();
  const taiXeId = taiXeRaw || null;
  const ghiChu = (body.ghi_chu as string) || '';
  const daThanhToan = body.da_thanh_toan ? 1 : 0;

  if (!tuyenId) return c.json({ error: 'Chọn tuyến' }, 400);
  if (!xeId) return c.json({ error: 'Chọn xe' }, 400);
  if (!ngayDi) return c.json({ error: 'Nhập ngày đi' }, 400);

  const tuyenOk = await db.prepare('SELECT id FROM tuyen WHERE id=?').bind(tuyenId).first();
  if (!tuyenOk) return c.json({ error: 'Tuyến không tồn tại' }, 400);
  const xeOk = await db.prepare('SELECT id FROM xe WHERE id=?').bind(xeId).first();
  if (!xeOk) return c.json({ error: 'Xe không tồn tại' }, 400);
  if (taiXeId) {
    const txOk = await db.prepare('SELECT id FROM nhan_vien WHERE id=?').bind(taiXeId).first();
    if (!txOk) return c.json({ error: 'Tài xế không tồn tại' }, 400);
  }

  if (id) {
    const existing = await db.prepare('SELECT da_thanh_toan, ngay_thanh_toan FROM chuyen_xe WHERE id = ?').bind(id).first<{ da_thanh_toan: number; ngay_thanh_toan: string }>();
    const ngayTT = daThanhToan && (!existing || !existing.da_thanh_toan) ? todayStr() : (existing?.ngay_thanh_toan || '');

    await db.prepare(
      `UPDATE chuyen_xe SET tuyen_id=?, xe_id=?, tai_xe_id=?, ngay_di=?, ngay_den=?,
        trang_thai=?, gia_chuyen=?, tien_te=?, da_thanh_toan=?, ngay_thanh_toan=?,
        so_sent_va_gt=?, ghi_chu=?, updated_at=datetime('now') WHERE id=?`
    ).bind(tuyenId, xeId, taiXeId, ngayDi, ngayDen, trangThai, giaChuyen, tienTe, daThanhToan, ngayTT, soSentVaGT, ghiChu, id).run();
    return c.json({ success: true, id });
  }

  let newId: string;
  const customId = (body.custom_id as string)?.trim();
  if (customId) {
    const exists = await db.prepare('SELECT id FROM chuyen_xe WHERE id = ?').bind(customId).first();
    if (exists) return c.json({ error: 'M\u00e3 chuy\u1ebfn \u0111\u00e3 t\u1ed3n t\u1ea1i' }, 400);
    newId = customId;
  } else {
    newId = await genMaChuyen(db, tuyenId, ngayDi, xeId);
  }

  await db.prepare(
    `INSERT INTO chuyen_xe (id, tuyen_id, xe_id, tai_xe_id, ngay_di, ngay_den, trang_thai,
       gia_chuyen, tien_te, da_thanh_toan, ngay_thanh_toan, so_sent_va_gt, ghi_chu)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(newId, tuyenId, xeId, taiXeId, ngayDi, ngayDen, trangThai, giaChuyen, tienTe, 0, '', soSentVaGT, ghiChu).run();

  return c.json({ success: true, id: newId }, 201);
});

// ===================== POST /api/chuyen-xe/:id/delete ================
chuyenXeRoutes.post('/api/chuyen-xe/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM chuyen_xe WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===================== POST /api/chuyen-xe/:id/toggle-thanh-toan =====
chuyenXeRoutes.post('/api/chuyen-xe/:id/toggle-thanh-toan', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;

  const ch = await db.prepare('SELECT da_thanh_toan FROM chuyen_xe WHERE id = ?').bind(id).first<{ da_thanh_toan: number }>();
  if (!ch) return c.json({ error: 'Kh\u00f4ng t\u00ecm th\u1ea5y chuy\u1ebfn' }, 404);

  const newVal = ch.da_thanh_toan ? 0 : 1;
  const ngayTT = newVal ? todayStr() : '';

  await db.prepare(
    'UPDATE chuyen_xe SET da_thanh_toan = ?, ngay_thanh_toan = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(newVal, ngayTT, id).run();

  return c.json({ success: true, da_thanh_toan: newVal });
});

// ===================== POST /api/chuyen-xe/bulk =====================
// Bulk trips: pay carrier (create expense slip), advance (expense slip kieu ung),
// mark returned (set return date + complete), delete.
chuyenXeRoutes.post('/api/chuyen-xe/bulk', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const body = await c.req.json<{
    action: string;
    ids: string[];
    ngay?: string;
    soTien?: number;
    hinhThuc?: 'TM' | 'CK';
  }>();
  const ids = body.ids || [];
  if (ids.length === 0) return c.json({ error: 'Chưa chọn chuyến' }, 400);

  const audit = async (hanhDong: string, chiTiet: string) => {
    await db.prepare(
      `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
       VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, ?, 'bulk', ?)`
    ).bind(`AL-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, user.role, user.display_name, hanhDong, chiTiet).run();
  };

  if (body.action === 'da-ve') {
    const ngayVe = body.ngay || todayStr();
    for (const id of ids) {
      await db.prepare(
        "UPDATE chuyen_xe SET ngay_den=?, trang_thai='hoan_thanh', updated_at=datetime('now') WHERE id=?"
      ).bind(ngayVe, id).run();
    }
    await audit('Bulk đã về', `${ids.length} chuyến, ngày về ${ngayVe}`);
    return c.json({ success: true, count: ids.length });
  }

  if (body.action === 'delete') {
    let deleted = 0;
    for (const id of ids) {
      // Only delete if the trip has no remaining receipts (avoid orphans)
      const cnt = await db.prepare('SELECT COUNT(*) AS n FROM lo_hang WHERE chuyen_xe_id=?').bind(id).first<{ n: number }>();
      if ((cnt?.n || 0) > 0) continue;
      await db.prepare('DELETE FROM chuyen_xe WHERE id=?').bind(id).run();
      deleted++;
    }
    await audit('Bulk xoá chuyến', `${deleted}/${ids.length} chuyến (bỏ qua chuyến còn phiếu)`);
    return c.json({ success: true, count: deleted, skipped: ids.length - deleted });
  }

  if (body.action === 'thanh-toan' || body.action === 'ung') {
    const ngay = body.ngay || todayStr();
    const hinhThuc = body.hinhThuc || 'TM';
    const kieu = body.action === 'ung' ? 'ung' : 'trahet';
    let created = 0;
    for (const id of ids) {
      const ch = await db.prepare(
        `SELECT cx.id, cx.gia_chuyen, cx.tien_te, cx.da_thanh_toan, cvt.ten AS cty_ten
         FROM chuyen_xe cx LEFT JOIN xe x ON cx.xe_id=x.id LEFT JOIN cty_van_tai cvt ON x.cty_vt_id=cvt.id
         WHERE cx.id=?`
      ).bind(id).first<{ id: string; gia_chuyen: number; tien_te: string; da_thanh_toan: number; cty_ten: string }>();
      if (!ch) continue;
      const soTien = body.action === 'ung' ? (Number(body.soTien) || 0) : Number(ch.gia_chuyen) || 0;
      if (soTien <= 0) continue;
      const pid = `PC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      await db.prepare(
        `INSERT INTO phieu_chi (id, ngay, dau_muc, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, chuyen_xe_id, kieu_qt, gio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%H:%M','now'))`
      ).bind(
        pid, ngay, `Cước vận tải${ch.cty_ten ? ' - ' + ch.cty_ten : ''}`, soTien, ch.tien_te || 'PLN', hinhThuc,
        body.action === 'ung' ? `Ứng cước chuyến ${id}` : `Thanh toán cước chuyến ${id}`,
        user.display_name, id, kieu,
      ).run();
      // When fully paid, set the paid flag on the trip
      if (body.action === 'thanh-toan') {
        await db.prepare(
          "UPDATE chuyen_xe SET da_thanh_toan=1, ngay_thanh_toan=?, updated_at=datetime('now') WHERE id=?"
        ).bind(ngay, id).run();
      }
      created++;
    }
    await audit(body.action === 'ung' ? 'Bulk ứng cước' : 'Bulk thanh toán cước', `${created} phiếu chi, ngày ${ngay}`);
    return c.json({ success: true, count: created, ngay });
  }

  return c.json({ error: 'Unknown action' }, 400);
});
