import { Hono } from 'hono';
import type { Env, ChuyenXe, Tuyen, Xe, LoHang } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, dataTable, tableRow, tableEmpty, tableActionLink, badge } from '../utils/ui';

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
const TT_COLOR: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  dang_chay: 'bg-blue-100 text-blue-700',
  hoan_thanh: 'bg-green-100 text-green-700',
  huy: 'bg-red-100 text-red-700',
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

  const tuyenList = await db.prepare('SELECT id, ten FROM tuyen ORDER BY ten').all<Tuyen>();

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

  const tuyenOpts = (tuyenList.results as Tuyen[])
    .map(t => `<option value="${t.id}"${t.id === tuyenFilter ? ' selected' : ''}>${esc(t.ten)}</option>`).join('');

  const rows = chuyens.map(ch => {
    const ttVariant = ch.trang_thai === 'hoan_thanh' ? 'success' : ch.trang_thai === 'huy' ? 'error' : ch.trang_thai === 'dang_chay' ? 'primary' : 'neutral';
    const ttTag = badge(TT_LABEL[ch.trang_thai] || ch.trang_thai, ttVariant);
    const payTag = ch.da_thanh_toan
      ? badge(`Đã TT ${fmtDate(ch.ngay_thanh_toan)}`, 'success')
      : badge('Chưa TT', 'warning');
    const mauClass = ch.tuyen_mau === 'blue' ? 'bg-lightprimary text-primary' : ch.tuyen_mau === 'green' ? 'bg-lightsuccess text-success' : ch.tuyen_mau === 'amber' ? 'bg-lightwarning text-warning' : 'bg-lightgray text-bodytext';
    return tableRow([
      `<a href="/chuyen-xe/${esc(ch.id)}" class="text-primary hover:underline font-semibold font-mono">${esc(ch.id)}</a>`,
      esc(ch.so_xe),
      esc(ch.bien_so),
      `<span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${mauClass}">${esc(ch.tuyen_ten)}</span>`,
      esc(ch.cty_vt_ten || '—'),
      esc(ch.tai_xe_ten || '—'),
      fmtDate(ch.ngay_di),
      fmtDate(ch.ngay_den),
      `<span class="text-right block tabular-nums">${fmtNum(ch.total_kien)}</span>`,
      `<span class="text-right block font-semibold">${fmtNum(ch.gia_chuyen)} ${ch.tien_te}</span>`,
      `<span class="truncate max-w-[120px] inline-block">${esc(ch.so_sent_va_gt) || '—'}</span>`,
      payTag,
      ttTag,
      tableActionLink(`/chuyen-xe/create?edit=${esc(ch.id)}`),
    ]);
  }).join('');

  const hasFilter = q || tuyenFilter || statusFilter || range !== 'all';
  const content = `
    ${pageHeader('Chuyến xe', {
      actions: `<a href="/chuyen-xe/create" class="btn flex items-center gap-2"><iconify-icon icon="solar:add-circle-linear"></iconify-icon> Chuyến mới</a>`,
    })}

    <div class="card mb-4">
      <div class="card-body">
      <form method="GET" action="/chuyen-xe" class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Th\u1eddi gian</label>
          <select name="range" id="filterRange" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="all"${range === 'all' ? ' selected' : ''}>T\u1ea5t c\u1ea3</option>
            <option value="today"${range === 'today' ? ' selected' : ''}>H\u00f4m nay</option>
            <option value="thisWeek"${range === 'thisWeek' ? ' selected' : ''}>Tu\u1ea7n n\u00e0y</option>
            <option value="thisMonth"${range === 'thisMonth' ? ' selected' : ''}>Th\u00e1ng n\u00e0y</option>
            <option value="custom"${range === 'custom' ? ' selected' : ''}>T\u00f9y ch\u1ecdn</option>
          </select>
        </div>
        <div id="customDateWrap" class="${range === 'custom' ? '' : 'hidden'} flex gap-2">
          <div><label class="block text-xs font-medium text-gray-500 mb-1">T\u1eeb</label>
            <input type="date" name="from" value="${esc(from)}" class="border border-gray-300 rounded-md px-3 py-2 text-sm"></div>
          <div><label class="block text-xs font-medium text-gray-500 mb-1">\u0110\u1ebfn</label>
            <input type="date" name="to" value="${esc(to)}" class="border border-gray-300 rounded-md px-3 py-2 text-sm"></div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Tuy\u1ebfn</label>
          <select name="tuyen" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">\u2014 T\u1ea5t c\u1ea3 \u2014</option>${tuyenOpts}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Tr\u1ea1ng th\u00e1i</label>
          <select name="status" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">\u2014 T\u1ea5t c\u1ea3 \u2014</option>
            <option value="planned"${statusFilter === 'planned' ? ' selected' : ''}>K\u1ebf ho\u1ea1ch</option>
            <option value="dang_chay"${statusFilter === 'dang_chay' ? ' selected' : ''}>\u0110ang ch\u1ea1y</option>
            <option value="hoan_thanh"${statusFilter === 'hoan_thanh' ? ' selected' : ''}>Ho\u00e0n th\u00e0nh</option>
            <option value="huy"${statusFilter === 'huy' ? ' selected' : ''}>H\u1ee7y</option>
          </select>
        </div>
        <div class="flex-1 min-w-[240px]">
          <label class="block text-xs font-medium text-gray-500 mb-1">T\u00ecm ki\u1ebfm</label>
          <input type="text" name="q" value="${esc(q)}" placeholder="M\u00e3 chuy\u1ebfn, bi\u1ec3n s\u1ed1, tuy\u1ebfn, t\u00e0i x\u1ebf..." class="w-full border-2 border-blue-400 rounded-md px-3 py-2 text-sm">
        </div>
        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm cursor-pointer">L\u1ecdc</button>
        ${hasFilter ? '<a href="/chuyen-xe" class="text-error hover:underline text-sm">Xóa lọc</a>' : ''}
      </form>
      </div>
    </div>

    ${dataTable(
      ['Mã chuyến', 'Số xe', 'Biển số', 'Tuyến', 'Cty VT', 'Tài xế', 'Ngày đi', 'Ngày về', 'Kiện', 'Giá chuyến', 'SENT/GT', 'TT cty VT', 'Trạng thái', ''],
      rows || tableEmpty(14),
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

  const tuyenOpts = (tuyenList.results as Tuyen[])
    .map(t => `<option value="${t.id}" data-tiento="${esc(t.tien_to)}"${ch && ch.tuyen_id === t.id ? ' selected' : ''}>${esc(t.ten)}</option>`).join('');

  const xeOpts = (xeList.results as Xe[])
    .map(x => `<option value="${x.id}" data-soxe="${esc(x.so_xe)}" data-taixe="${esc(x.tai_xe_id)}"${ch && ch.xe_id === x.id ? ' selected' : ''}>${esc(x.so_xe)} \u00b7 ${esc(x.bien_so)}</option>`).join('');

  const taiXeOpts = (taiXeList.results as TaiXeRow[])
    .map(tx => `<option value="${tx.id}"${ch && ch.tai_xe_id === tx.id ? ' selected' : ''}>${esc(tx.ten)}</option>`).join('');

  const content = `
    <div class="mb-4">
      <a href="/chuyen-xe" class="text-blue-600 hover:underline text-sm inline-flex items-center gap-1">
        <iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Quay l\u1ea1i danh s\u00e1ch
      </a>
    </div>

    <div class="bg-white rounded-lg shadow p-6 max-w-3xl">
      <h2 class="text-lg font-semibold mb-4">${isEdit ? '\u270f S\u1eeda chuy\u1ebfn ' + esc(ch!.id) : '+ Chuy\u1ebfn m\u1edbi'}</h2>

      <form id="chForm" class="space-y-4">
        ${isEdit ? `<input type="hidden" name="id" value="${esc(ch!.id)}">` : ''}
        ${!isEdit ? `<div>
          <label class="block text-sm font-medium text-gray-700 mb-1">M\u00e3 chuy\u1ebfn (t\u1ef1 \u0111\u1ed9ng sinh)</label>
          <div id="maPreview" class="text-lg font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200" style="min-height:38px;display:flex;align-items:center">
            <span class="text-gray-400 text-sm">Ch\u1ecdn tuy\u1ebfn, xe, ng\u00e0y \u0111i \u2192 m\u00e3 t\u1ef1 sinh</span>
          </div>
          <div class="mt-1">
            <input type="text" name="custom_id" id="customId" placeholder="Ho\u1eb7c nh\u1eadp m\u00e3 th\u1ee7 c\u00f4ng: VD DK-001" class="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64">
          </div>
        </div>` : `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">M\u00e3 chuy\u1ebfn</label>
          <div class="text-lg font-bold text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">${esc(ch!.id)}</div>
        </div>`}

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tuy\u1ebfn</label>
            <select name="tuyen_id" id="selTuyen" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">-- Ch\u1ecdn tuy\u1ebfn --</option>${tuyenOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Xe</label>
            <select name="xe_id" id="selXe" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">-- Ch\u1ecdn xe --</option>${xeOpts}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ng\u00e0y \u0111i</label>
            <input type="date" name="ngay_di" id="ngayDi" required value="${ch?.ngay_di || today}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ng\u00e0y v\u1ec1 (\u0111\u1ec3 tr\u1ed1ng n\u1ebfu ch\u01b0a v\u1ec1)</label>
            <input type="date" name="ngay_den" value="${ch?.ngay_den || ''}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Gi\u00e1 chuy\u1ebfn (tr\u1ea3 Cty VT)</label>
            <input type="number" name="gia_chuyen" value="${ch?.gia_chuyen ?? 5000}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ti\u1ec1n t\u1ec7</label>
            <select name="tien_te" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="PLN"${ch?.tien_te === 'PLN' ? ' selected' : ''}>PLN</option>
              <option value="EUR"${ch?.tien_te === 'EUR' ? ' selected' : ''}>EUR</option>
              <option value="USD"${ch?.tien_te === 'USD' ? ' selected' : ''}>USD</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tr\u1ea1ng th\u00e1i</label>
            <select name="trang_thai" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="planned"${ch?.trang_thai === 'planned' ? ' selected' : ''}>K\u1ebf ho\u1ea1ch</option>
              <option value="dang_chay"${ch?.trang_thai === 'dang_chay' ? ' selected' : ''}>\u0110ang ch\u1ea1y</option>
              <option value="hoan_thanh"${ch?.trang_thai === 'hoan_thanh' ? ' selected' : ''}>Ho\u00e0n th\u00e0nh</option>
              <option value="huy"${ch?.trang_thai === 'huy' ? ' selected' : ''}>H\u1ee7y</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">S\u1ed1 SENT / Gi\u1ea5y t\u1edd (CMR/DDT)</label>
          <input type="text" name="so_sent_va_gt" value="${esc(ch?.so_sent_va_gt)}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">T\u00e0i x\u1ebf</label>
          <select name="tai_xe_id" id="selTaiXe" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- T\u1ef1 \u0111\u1ed9ng t\u1eeb xe --</option>${taiXeOpts}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Ghi ch\u00fa</label>
          <textarea name="ghi_chu" rows="2" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">${esc(ch?.ghi_chu)}</textarea>
        </div>

        ${isEdit ? `<div class="flex items-center gap-2">
          <input type="checkbox" name="da_thanh_toan" id="chkTT" value="1"${ch!.da_thanh_toan ? ' checked' : ''} class="rounded border-gray-300">
          <label for="chkTT" class="text-sm text-gray-700">\u0110\u00e3 thanh to\u00e1n cho Cty VT</label>
        </div>` : ''}

        <div class="flex gap-3 pt-2">
          <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 cursor-pointer font-medium">
            ${isEdit ? '\u2713 L\u01b0u' : '\u2713 T\u1ea1o chuy\u1ebfn'}
          </button>
          <a href="/chuyen-xe" class="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 inline-flex items-center">H\u1ee7y</a>
          ${isEdit ? `<button type="button" id="btnDel" class="ml-auto bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 cursor-pointer">\ud83d\uddd1 X\u00f3a chuy\u1ebfn</button>` : ''}
        </div>
      </form>
    </div>

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

    // Auto-set tai_xe from xe selection
    function syncTaiXe() {
      const opt = selXe.options[selXe.selectedIndex];
      if (opt && opt.dataset.taixe) {
        selTaiXe.value = opt.dataset.taixe;
      }
    }
    selXe?.addEventListener('change', syncTaiXe);

    // Auto-generate ma chuyen preview
    function updatePreview() {
      if (isEdit || !maPreview) return;
      const customVal = customId?.value?.trim();
      if (customVal) {
        maPreview.innerHTML = '<span class="text-gray-500 text-sm">T\u00f9y ch\u1ecdn:</span> <span class="text-blue-700">' + customVal + '</span>';
        return;
      }
      const tOpt = selTuyen?.options[selTuyen?.selectedIndex];
      const xOpt = selXe?.options[selXe?.selectedIndex];
      const d = ngayDi?.value;
      if (!tOpt?.value || !xOpt?.value || !d) {
        maPreview.innerHTML = '<span class="text-gray-400 text-sm">Ch\u1ecdn tuy\u1ebfn, xe, ng\u00e0y \u0111i \u2192 m\u00e3 t\u1ef1 sinh</span>';
        return;
      }
      const tienTo = tOpt.dataset.tiento || 'K';
      const parts = d.split('-');
      const dateStr = parts[0].slice(-2) + parts[1] + parts[2];
      const xeNum = (xOpt.dataset.soxe || '0').replace(/\\D/g, '').padStart(2, '0') || '00';
      const mc = tienTo + dateStr + '-' + xeNum;
      maPreview.innerHTML = '<strong>' + mc + '</strong> <span class="text-gray-400 text-sm">(ki\u1ec3m tra tr\u00f9ng khi l\u01b0u)</span>';
    }
    selTuyen?.addEventListener('change', updatePreview);
    selXe?.addEventListener('change', () => { syncTaiXe(); updatePreview(); });
    ngayDi?.addEventListener('change', updatePreview);
    customId?.addEventListener('input', updatePreview);

    // Submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body: Record<string, unknown> = {};
      fd.forEach((v, k) => { body[k] = v; });
      body.gia_chuyen = Number(body.gia_chuyen) || 0;
      body.da_thanh_toan = body.da_thanh_toan ? 1 : 0;
      if (!body.ngay_den) body.ngay_den = null;
      if (!body.tai_xe_id) body.tai_xe_id = null;

      const url = isEdit ? '/chuyen-xe/api/chuyen-xe' : '/chuyen-xe/api/chuyen-xe';
      const res = await fetch(url, {
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

    // Delete
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
    return `<tr class="hover:bg-gray-50 border-b border-gray-100">
      <td class="px-3 py-2.5 text-sm"><a href="/lo-hang/${esc(l.id)}" class="text-blue-600 hover:underline font-semibold">${esc(l.id)}</a></td>
      <td class="px-3 py-2.5 text-sm">${esc(l.khach_ten)}</td>
      <td class="px-3 py-2.5 text-sm">${esc(l.hang_ten)}</td>
      <td class="px-3 py-2.5 text-sm text-right">${l.so_kien}</td>
      <td class="px-3 py-2.5 text-sm text-right ${l.da_tra_hang === l.so_kien ? 'text-green-600' : 'text-amber-600'}">${l.da_tra_hang}</td>
      <td class="px-3 py-2.5 text-sm text-right">${fmtNum(tienVT)} ${l.tien_te}</td>
      <td class="px-3 py-2.5 text-sm text-right">${l.so_tien_hang > 0 ? fmtNum(l.so_tien_hang) + ' ' + (l.tien_te_th || l.tien_te) : '\u2014'}</td>
    </tr>`;
  }).join('');

  const payBtnLabel = ch.da_thanh_toan
    ? '\u2713 \u0110\u00e3 thanh to\u00e1n cty VT'
    : '\u23f3 Ch\u01b0a thanh to\u00e1n cty VT';
  const payBtnClass = ch.da_thanh_toan
    ? 'bg-green-100 text-green-700 hover:bg-green-200'
    : 'bg-amber-100 text-amber-700 hover:bg-amber-200';

  const content = `
    <div class="mb-4">
      <a href="/chuyen-xe" class="text-blue-600 hover:underline text-sm inline-flex items-center gap-1">
        <iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Quay l\u1ea1i danh s\u00e1ch
      </a>
    </div>

    <!-- Hero -->
    <div class="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-lg shadow-lg p-6 text-white mb-6">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold flex items-center gap-2">
            <iconify-icon icon="solar:bus-2-bold" class="text-3xl"></iconify-icon>
            ${esc(ch.id)}
          </h1>
          <div class="mt-2 text-blue-100 text-sm">
            ${esc(ch.so_xe)} (${esc(ch.bien_so)}) \u00b7 ${fmtDate(ch.ngay_di)} \u2192 ${fmtDate(ch.ngay_den)} \u00b7 TX: ${esc(ch.tai_xe_ten)}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${ch.tuyen_ten ? `<span class="bg-white/20 px-2.5 py-1 rounded-full text-xs">\ud83d\udef3 ${esc(ch.tuyen_ten)}</span>` : ''}
            ${ch.cty_vt_ten ? `<span class="bg-white/20 px-2.5 py-1 rounded-full text-xs">\ud83d\ude9a ${esc(ch.cty_vt_ten)}</span>` : ''}
            <button onclick="toggleTT()" class="${payBtnClass} px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors">${payBtnLabel}</button>
            ${ch.so_sent_va_gt ? `<span class="bg-white/20 px-2.5 py-1 rounded-full text-xs">\ud83d\udccb ${esc(ch.so_sent_va_gt)}</span>` : ''}
          </div>
        </div>
        <div class="flex gap-2">
          <a href="/chuyen-xe/create?edit=${esc(ch.id)}" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md text-sm transition-colors">\u270f S\u1eeda</a>
        </div>
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
        <div class="text-xs text-gray-500 font-medium">\ud83d\udce6 S\u1ed1 phi\u1ebfu trong chuy\u1ebfn</div>
        <div class="text-2xl font-bold text-gray-900 mt-1">${lots.length}</div>
        <div class="text-xs text-gray-400 mt-1">${totalKien} ki\u1ec7n h\u00e0ng</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
        <div class="text-xs text-gray-500 font-medium">\ud83d\udcb0 T\u1ed5ng ti\u1ec1n VT</div>
        <div class="text-lg font-bold text-gray-900 mt-1">${fmtMap(sumVT)}</div>
      </div>
      ${Object.keys(sumTH).length > 0 ? `<div class="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
        <div class="text-xs text-gray-500 font-medium">\ud83d\udce6 Ti\u1ec1n h\u00e0ng</div>
        <div class="text-lg font-bold text-gray-900 mt-1">${fmtMap(sumTH)}</div>
      </div>` : ''}
      <div class="bg-white rounded-lg shadow p-4 border-l-4 ${ch.da_thanh_toan ? 'border-green-500' : 'border-red-500'}">
        <div class="text-xs text-gray-500 font-medium">\ud83d\udcb8 Chi cho chuy\u1ebfn (Cty VT)</div>
        <div class="text-lg font-bold text-gray-900 mt-1">${fmtNum(ch.gia_chuyen)} ${ch.tien_te}</div>
        <div class="text-xs ${ch.da_thanh_toan ? 'text-green-600' : 'text-red-500'} mt-1">${ch.da_thanh_toan ? '\u2713 \u0110\u00e3 TT' : '\u23f3 Ch\u01b0a TT'}</div>
      </div>
    </div>

    <!-- Lo hang table -->
    <div class="bg-white rounded-lg shadow overflow-hidden mb-6">
      <div class="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 class="font-semibold text-gray-900">\ud83d\udce6 Phi\u1ebfu h\u00e0ng trong chuy\u1ebfn (${lots.length})</h3>
      </div>
      ${lots.length === 0
        ? '<div class="p-8 text-center text-gray-400">Chuy\u1ebfn ch\u01b0a c\u00f3 phi\u1ebfu</div>'
        : `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50"><tr>
            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">M\u00e3</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kh\u00e1ch</th>
            <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">H\u00e3ng</th>
            <th class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ki\u1ec7n</th>
            <th class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">\u0110\u00e3 tr\u1ea3</th>
            <th class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ti\u1ec1n VT</th>
            <th class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ti\u1ec1n h\u00e0ng</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">${loRows}</tbody>
        </table></div>`
      }
    </div>

    <!-- Thong tin chi tiet -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="font-semibold text-gray-900 mb-4">\u2139 Th\u00f4ng tin chuy\u1ebfn</h3>
      <div class="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
        <div><span class="text-gray-500">M\u00e3 chuy\u1ebfn:</span> <strong>${esc(ch.id)}</strong></div>
        <div><span class="text-gray-500">Tuy\u1ebfn:</span> <strong>${esc(ch.tuyen_ten)}</strong></div>
        <div><span class="text-gray-500">Xe:</span> ${esc(ch.so_xe)} (${esc(ch.bien_so)})</div>
        <div><span class="text-gray-500">T\u00e0i x\u1ebf:</span> ${esc(ch.tai_xe_ten) || '\u2014'}</div>
        <div><span class="text-gray-500">Ng\u00e0y \u0111i:</span> ${fmtDate(ch.ngay_di)}</div>
        <div><span class="text-gray-500">Ng\u00e0y v\u1ec1:</span> ${fmtDate(ch.ngay_den)}</div>
        <div><span class="text-gray-500">Gi\u00e1 chuy\u1ebfn:</span> <strong>${fmtNum(ch.gia_chuyen)} ${ch.tien_te}</strong></div>
        <div><span class="text-gray-500">Tr\u1ea1ng th\u00e1i:</span> ${TT_LABEL[ch.trang_thai] || ch.trang_thai}</div>
        <div><span class="text-gray-500">SENT/GT:</span> ${esc(ch.so_sent_va_gt) || '\u2014'}</div>
        <div><span class="text-gray-500">Ghi ch\u00fa:</span> ${esc(ch.ghi_chu) || '\u2014'}</div>
      </div>
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

// ===================== POST /api/chuyen-xe — Create / Update ========
chuyenXeRoutes.post('/api/chuyen-xe', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const id = body.id as string | undefined;
  const tuyenId = body.tuyen_id as string;
  const xeId = body.xe_id as string;
  const ngayDi = body.ngay_di as string;
  const ngayDen = (body.ngay_den as string) || null;
  const giaChuyen = Number(body.gia_chuyen) || 0;
  const tienTe = (body.tien_te as string) || 'PLN';
  const trangThai = (body.trang_thai as string) || 'planned';
  const soSentVaGT = (body.so_sent_va_gt as string) || '';
  const taiXeId = (body.tai_xe_id as string) || null;
  const ghiChu = (body.ghi_chu as string) || '';
  const daThanhToan = body.da_thanh_toan ? 1 : 0;

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
    if (!tuyenId || !xeId || !ngayDi) {
      return c.json({ error: 'Thi\u1ebfu th\u00f4ng tin \u0111\u1ec3 t\u1ef1 sinh m\u00e3 chuy\u1ebfn (c\u1ea7n tuy\u1ebfn, xe, ng\u00e0y \u0111i)' }, 400);
    }
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
