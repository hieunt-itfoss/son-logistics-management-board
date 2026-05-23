import { Hono } from 'hono';
import type { Env, Role, AppVariables } from '../types';
import type { EffectivePerms } from '../utils/permissions';
import { layout } from '../utils/layout';
import {
  modalShell,
  modalFooterInner,
  btnModalChip,
  btnSecondary,
  btnModalOutline,
} from '../utils/ui';
import {
  parseDelimitedText,
  buildImportPreview,
  csvTemplate,
  type ImportType,
  type PhieuDraft,
  type NewKhDraft,
  type NewHangDraft,
  type NewXeDraft,
  type NewChuyenDraft,
} from '../utils/import-data';

export const loHangRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function loHangPerm(perms: EffectivePerms): (typeof ROLE_PERMS)[Role] {
  const base = ROLE_PERMS[perms.role];
  return {
    loCols: base.loCols,
    canEdit: perms.canEdit,
    canEditTienHang: perms.canEditTienHang,
    canDelete: perms.canDelete,
    canSeeAllLo: perms.canSeeAllLo,
    canCreateLo: perms.canCreateLo,
  };
}

// ─── Constants ───────────────────────────────────────────────
const ALL_COLS = [
  'ma','ngayLenXe','ngayVe','soXe','bienSo','tuyenVT',
  'nguoiGui','nguoiNhan','nguoiTao','nguoiThu',
  'soKien','daTraHang','luuKho','ghiChu',
  'donGia','thanhTien','soTienHang',
] as const;

type ColKey = typeof ALL_COLS[number];

const COL_DEFS: Record<ColKey, { label: string; group: 'info'|'hang'|'money'; cls: string; filterable: boolean }> = {
  ma:         { label:'Mã phiếu',     group:'info',  cls:'',        filterable:true  },
  ngayLenXe:  { label:'Ngày lên xe',  group:'info',  cls:'',        filterable:true  },
  ngayVe:     { label:'Ngày về',      group:'info',  cls:'',        filterable:true  },
  soXe:       { label:'Số xe',        group:'info',  cls:'',        filterable:true  },
  bienSo:     { label:'Biển số',      group:'info',  cls:'',        filterable:true  },
  tuyenVT:    { label:'Tuyến VT',     group:'info',  cls:'',        filterable:true  },
  nguoiGui:   { label:'Người gửi',    group:'info',  cls:'',        filterable:true  },
  nguoiNhan:  { label:'Người nhận',   group:'info',  cls:'',        filterable:true  },
  nguoiTao:   { label:'Người tạo',    group:'info',  cls:'',        filterable:true  },
  nguoiThu:   { label:'Người thu',    group:'info',  cls:'',        filterable:true  },
  soKien:     { label:'Số kiện',      group:'hang',  cls:'num',     filterable:false },
  daTraHang:  { label:'Đã trả hàng',  group:'hang',  cls:'num kho', filterable:false },
  luuKho:     { label:'Lưu kho',      group:'hang',  cls:'num kho', filterable:false },
  ghiChu:     { label:'Ghi chú',      group:'hang',  cls:'kho',     filterable:false },
  donGia:     { label:'Đơn giá',      group:'money', cls:'num',     filterable:false },
  thanhTien:  { label:'Tiền vận tải', group:'money', cls:'num money', filterable:false },
  soTienHang: { label:'Tiền hàng',    group:'money', cls:'num money', filterable:false },
};

const LIMITED_COLS: ColKey[] = [
  'ma','ngayLenXe','ngayVe','soXe','tuyenVT',
  'nguoiGui','nguoiNhan','nguoiTao',
  'soKien','daTraHang','luuKho','ghiChu',
];

const ROLE_PERMS: Record<Role, {
  loCols: 'all' | ColKey[];
  canEdit: boolean;
  canEditTienHang: boolean;
  canDelete: boolean;
  canSeeAllLo: boolean;
  canCreateLo: boolean;
}> = {
  admin:        { loCols:'all', canEdit:true,  canEditTienHang:true,  canDelete:true,  canSeeAllLo:true,  canCreateLo:true  },
  ketoanTruong: { loCols:'all', canEdit:true,  canEditTienHang:true,  canDelete:false, canSeeAllLo:true,  canCreateLo:true  },
  ketoanVien:   { loCols:'all', canEdit:true,  canEditTienHang:false, canDelete:false, canSeeAllLo:true,  canCreateLo:true  },
  nhanvien:     { loCols:'all', canEdit:true,  canEditTienHang:false, canDelete:false, canSeeAllLo:true,  canCreateLo:true  },
  kho:          { loCols:LIMITED_COLS, canEdit:true, canEditTienHang:false, canDelete:false, canSeeAllLo:true, canCreateLo:true },
  laixe:        { loCols:LIMITED_COLS, canEdit:false, canEditTienHang:false, canDelete:false, canSeeAllLo:false, canCreateLo:true },
};

// ─── Helpers ─────────────────────────────────────────────────
function fmtNum(n: number): string {
  return (n || 0).toLocaleString('pl-PL');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  return `${parts[2]}/${parts[1]}`;
}

function fmtDateFull(d: string | null | undefined): string {
  if (!d) return '\u2014';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function esc(s: string | null | undefined): string {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c] || '');
}

function getVisibleCols(role: Role, hiddenParam: string): ColKey[] {
  const perm = ROLE_PERMS[role];
  const base: ColKey[] = perm.loCols === 'all' ? [...ALL_COLS] : [...perm.loCols];
  const hidden = new Set(hiddenParam ? hiddenParam.split(',').filter(Boolean) : []);
  return base.filter(c => !hidden.has(c));
}

function rangeLabel(range: string): string {
  switch(range) {
    case 'today': return 'Hôm nay';
    case 'thisWeek': return 'Tuần này';
    case 'thisMonth': return 'Tháng này';
    case 'all': return 'Tất cả';
    case 'custom': return 'Tùy chọn';
    default: return range;
  }
}

interface LoRow {
  id: string;
  chuyen_xe_id: string;
  khach_hang_id: string;
  hang_id: string;
  so_kien: number;
  da_tra_hang: number;
  ly_do_thieu: string;
  don_gia: number;
  tien_te: string;
  thanh_tien: number;
  so_tien_hang: number;
  giam_gia: number;
  nguoi_tao: string;
  nguoi_thu: string;
  tien_te_th: string;
  // joined fields
  khach_hang_ten: string;
  ma_kh: string;
  hang_ten: string;
  ngay_di: string;
  ngay_den: string;
  tuyen_ten: string;
  tuyen_mau: string;
  bien_so: string;
  so_xe: string;
  nguoi_tao_ten: string;
  nguoi_thu_ten: string;
  tai_xe_id: string;
}

// ─── SQL Query ───────────────────────────────────────────────
const LO_HANG_SQL = `
  SELECT lh.*,
    kh.ten as khach_hang_ten, kh.ma_kh,
    h.ten as hang_ten,
    cx.ngay_di, cx.ngay_den, cx.tai_xe_id,
    t.ten as tuyen_ten, t.mau as tuyen_mau,
    x.bien_so, x.so_xe,
    nv1.ten as nguoi_tao_ten,
    nv2.ten as nguoi_thu_ten
  FROM lo_hang lh
  LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
  LEFT JOIN hang h ON lh.hang_id = h.id
  LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
  LEFT JOIN tuyen t ON cx.tuyen_id = t.id
  LEFT JOIN xe x ON cx.xe_id = x.id
  LEFT JOIN nhan_vien nv1 ON lh.nguoi_tao = nv1.id
  LEFT JOIN nhan_vien nv2 ON lh.nguoi_thu = nv2.id
`;

// ─── GET / — Main Grid ───────────────────────────────────────
loHangRoutes.get('/', async (c) => {
  const user = c.get('user');
  const role = user.role as Role;
  const perm = loHangPerm(c.get('perms'));

  // Query params
  const filterRange = c.req.query('range') || 'thisMonth';
  const customFrom = c.req.query('from') || '';
  const customTo = c.req.query('to') || '';
  const freeSearch = c.req.query('q') || '';
  const filterCol = c.req.query('fc') || '';
  const filterVal = c.req.query('fv') || '';
  const hiddenCols = c.req.query('hide') || '';
  const collapsedParam = c.req.query('collapsed') || '';

  // Build WHERE clauses
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Role filter: laixe only sees their own xe's lo
  if (!perm.canSeeAllLo) {
    conditions.push(`cx.tai_xe_id = (SELECT nv.id FROM nhan_vien nv WHERE nv.vai_tro = 'laixe' LIMIT 1)`);
  }

  // Date range filter on chuyen_xe.ngay_di
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (filterRange === 'today') {
    conditions.push(`cx.ngay_di = ?`);
    params.push(todayStr);
  } else if (filterRange === 'thisWeek') {
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    conditions.push(`cx.ngay_di >= ? AND cx.ngay_di <= ?`);
    params.push(`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`);
    params.push(`${sunday.getFullYear()}-${String(sunday.getMonth()+1).padStart(2,'0')}-${String(sunday.getDate()).padStart(2,'0')}`);
  } else if (filterRange === 'thisMonth') {
    conditions.push(`cx.ngay_di >= ? AND cx.ngay_di <= ?`);
    params.push(`${yyyy}-${mm}-01`);
    params.push(`${yyyy}-${mm}-${dd}`);
  } else if (filterRange === 'custom' && customFrom && customTo) {
    conditions.push(`cx.ngay_di >= ? AND cx.ngay_di <= ?`);
    params.push(customFrom);
    params.push(customTo);
  }
  // 'all' = no date filter

  // Column filter
  if (filterCol && filterVal) {
    if (filterCol === 'nguoiNhan') {
      conditions.push(`lh.khach_hang_id = ?`);
      params.push(filterVal);
    } else if (filterCol === 'nguoiGui') {
      conditions.push(`lh.hang_id = ?`);
      params.push(filterVal);
    } else if (filterCol === 'soXe') {
      conditions.push(`x.so_xe = ?`);
      params.push(filterVal);
    } else if (filterCol === 'bienSo') {
      conditions.push(`x.bien_so = ?`);
      params.push(filterVal);
    } else if (filterCol === 'tuyenVT') {
      conditions.push(`cx.tuyen_id = ?`);
      params.push(filterVal);
    } else if (filterCol === 'ngayLenXe') {
      conditions.push(`cx.ngay_di = ?`);
      params.push(filterVal);
    } else if (filterCol === 'ngayVe') {
      conditions.push(`cx.ngay_den = ?`);
      params.push(filterVal);
    } else if (filterCol === 'nguoiTao') {
      conditions.push(`lh.nguoi_tao = ?`);
      params.push(filterVal);
    } else if (filterCol === 'nguoiThu') {
      conditions.push(`lh.nguoi_thu = ?`);
      params.push(filterVal);
    } else if (filterCol === 'ma') {
      conditions.push(`lh.chuyen_xe_id = ?`);
      params.push(filterVal);
    }
  }

  // Free text search
  if (freeSearch) {
    conditions.push(`(
      lh.id LIKE ? OR kh.ten LIKE ? OR kh.ma_kh LIKE ? OR h.ten LIKE ?
      OR x.so_xe LIKE ? OR x.bien_so LIKE ? OR t.ten LIKE ?
      OR lh.ly_do_thieu LIKE ? OR cx.id LIKE ?
    )`);
    const like = `%${freeSearch}%`;
    for (let i = 0; i < 9; i++) params.push(like);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const orderBy = 'ORDER BY cx.ngay_di DESC, lh.id DESC';

  const { results } = await c.env.DB.prepare(
    `${LO_HANG_SQL} ${whereClause} ${orderBy}`
  ).bind(...params).all<LoRow>();

  const lots = results as LoRow[];

  // Fetch dropdown data for create form
  const khRes = await c.env.DB.prepare('SELECT id, ten, ma_kh FROM khach_hang ORDER BY ten').all();
  const hangRes = await c.env.DB.prepare('SELECT id, ten FROM hang ORDER BY ten').all();
  const cxRes = await c.env.DB.prepare(
    `SELECT cx.id, t.ten as tuyen_ten, x.bien_so, x.so_xe, cx.ngay_di
     FROM chuyen_xe cx LEFT JOIN tuyen t ON cx.tuyen_id = t.id LEFT JOIN xe x ON cx.xe_id = x.id
     ORDER BY cx.ngay_di DESC LIMIT 200`
  ).all();
  const nvRes = await c.env.DB.prepare(`SELECT id, ten FROM nhan_vien WHERE active = 1 ORDER BY ten`).all();

  const khOptions = (khRes.results as {id:string;ten:string;ma_kh:string}[]).map(k =>
    `<option value="${esc(k.id)}">${esc(k.ma_kh)} - ${esc(k.ten)}</option>`
  ).join('');
  const hangOptions = (hangRes.results as {id:string;ten:string}[]).map(h =>
    `<option value="${esc(h.id)}">${esc(h.ten)}</option>`
  ).join('');
  const cxOptions = (cxRes.results as {id:string;tuyen_ten:string;bien_so:string;so_xe:string;ngay_di:string}[]).map(cx =>
    `<option value="${esc(cx.id)}">${esc(cx.id)} | ${esc(cx.tuyen_ten||'-')} | ${esc(cx.bien_so||'-')} | ${cx.ngay_di||'-'}</option>`
  ).join('');
  const nvOptions = (nvRes.results as {id:string;ten:string}[]).map(nv =>
    `<option value="${esc(nv.id)}">${esc(nv.ten)}</option>`
  ).join('');

  // Column visibility
  const cols = getVisibleCols(role, hiddenCols);
  const visibleByGroup: Record<string, ColKey[]> = { info:[], hang:[], money:[] };
  cols.forEach(c2 => {
    const def = COL_DEFS[c2];
    if (def) visibleByGroup[def.group].push(c2);
  });

  // Group by chuyen_xe_id
  const collapsed = new Set(collapsedParam ? collapsedParam.split(',').filter(Boolean) : []);
  const byChuyen = new Map<string, LoRow[]>();
  lots.forEach(l => {
    const k = l.chuyen_xe_id || '_NO_CHUYEN_';
    if (!byChuyen.has(k)) byChuyen.set(k, []);
    byChuyen.get(k)!.push(l);
  });

  // Sort chuyen groups: newest ngay_den first, no-chuyen last
  const chuyenIds = Array.from(byChuyen.keys()).sort((a, b) => {
    if (a === '_NO_CHUYEN_') return 1;
    if (b === '_NO_CHUYEN_') return -1;
    const aDate = byChuyen.get(a)![0]?.ngay_den || '';
    const bDate = byChuyen.get(b)![0]?.ngay_den || '';
    return bDate.localeCompare(aDate);
  });

  // Default: expand only first (newest) chuyen and no-chuyen group
  const defaultCollapsed = collapsed.size === 0 && chuyenIds.length > 1;
  if (defaultCollapsed) {
    chuyenIds.forEach((cid, i) => {
      if (cid !== '_NO_CHUYEN_' && i > 0) collapsed.add(cid);
    });
  }

  // Totals
  let totalSoKien = 0, totalDaTra = 0;
  const totalsByCcy: Record<string, { thanhTien: number; soTienHang: number }> = {};
  lots.forEach(l => {
    totalSoKien += l.so_kien;
    totalDaTra += l.da_tra_hang;
    if (!totalsByCcy[l.tien_te]) totalsByCcy[l.tien_te] = { thanhTien: 0, soTienHang: 0 };
    totalsByCcy[l.tien_te].thanhTien += l.thanh_tien;
    totalsByCcy[l.tien_te].soTienHang += (l.so_tien_hang || 0);
  });
  const totalLuuKho = totalSoKien - totalDaTra;

  const fmtCcy = (k: 'thanhTien'|'soTienHang') => {
    const arr = Object.entries(totalsByCcy).map(([t, v]) => v[k] > 0 ? `${fmtNum(v[k])} ${t}` : null).filter(Boolean);
    return arr.length ? arr.join('<br>') : '0';
  };

  // Filter chip display
  const filterChips: string[] = [];
  if (filterCol && filterVal) {
    const def = COL_DEFS[filterCol as ColKey];
    // Resolve display value
    let displayVal = filterVal;
    if (filterCol === 'nguoiNhan') {
      const kh = (khRes.results as {id:string;ten:string}[]).find(k => k.id === filterVal);
      if (kh) displayVal = kh.ten;
    } else if (filterCol === 'nguoiGui') {
      const ha = (hangRes.results as {id:string;ten:string}[]).find(h => h.id === filterVal);
      if (ha) displayVal = ha.ten;
    } else if (filterCol === 'ngayLenXe' || filterCol === 'ngayVe') {
      displayVal = fmtDate(filterVal);
    }
    filterChips.push(`
      <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
        <strong>${def?.label || filterCol}:</strong> ${esc(displayVal)}
        <a href="${buildGridUrl(c, { fc:'', fv:'' })}" class="ml-1 text-blue-400 hover:text-blue-700">&times;</a>
      </span>
    `);
  }

  // ─── Build HTML ────────────────────────────────────────────
  let html = '<div class="card overflow-hidden">';

  // Toolbar
  html += '<div class="card-body border-b border-light-dark flex flex-wrap items-center gap-2">';
  if (perm.canCreateLo) {
    html += `<a href="/lo-hang/create" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
      <iconify-icon icon="solar:add-circle-linear"></iconify-icon> Phiếu mới
    </a>`;
    html += `<button type="button" onclick="openImportModal()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
      <iconify-icon icon="solar:import-linear"></iconify-icon> Import dữ liệu
    </button>`;
  }
  html += `<form method="GET" action="/lo-hang" class="flex flex-wrap items-center gap-2" id="filterForm">`;
  // Hidden fields to preserve state
  html += `<input type="hidden" name="fc" value="${esc(filterCol)}">`;
  html += `<input type="hidden" name="fv" value="${esc(filterVal)}">`;
  html += `<input type="hidden" name="hide" value="${esc(hiddenCols)}">`;
  html += `<input type="hidden" name="collapsed" value="${esc(collapsedParam)}">`;

  html += `<select name="range" onchange="this.form.submit()" class="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
    <option value="today" ${filterRange==='today'?'selected':''}>Hôm nay</option>
    <option value="thisWeek" ${filterRange==='thisWeek'?'selected':''}>Tuần này</option>
    <option value="thisMonth" ${filterRange==='thisMonth'?'selected':''}>Tháng này</option>
    <option value="custom" ${filterRange==='custom'?'selected':''}>Tùy chọn</option>
    <option value="all" ${filterRange==='all'?'selected':''}>Tất cả</option>
  </select>`;

  if (filterRange === 'custom') {
    html += `<input type="date" name="from" value="${esc(customFrom)}" onchange="this.form.submit()" class="border border-gray-300 rounded-md px-2 py-2 text-sm">`;
    html += `<span class="text-gray-400 text-sm">\u2192</span>`;
    html += `<input type="date" name="to" value="${esc(customTo)}" onchange="this.form.submit()" class="border border-gray-300 rounded-md px-2 py-2 text-sm">`;
  }

  html += `<input type="text" name="q" value="${esc(freeSearch)}" placeholder="Tìm tự do (mã, khách, hãng, xe, tuyến...)" class="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[240px]" style="min-width:240px">`;
  html += `<button type="submit" class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300">Tìm</button>`;
  html += `</form>`;

  html += `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
    <iconify-icon icon="solar:sort-from-top-to-bottom-linear"></iconify-icon> Group: Chuyến
  </span>`;

  // Column visibility toggle
  html += `<button onclick="document.getElementById('colTogglePanel').classList.toggle('hidden')" class="px-3 py-1.5 rounded-md text-sm border border-gray-300 bg-white hover:bg-gray-50 text-gray-600">
    <iconify-icon icon="solar:settings-linear"></iconify-icon> Cột (${cols.length}/${ALL_COLS.length})
  </button>`;

  html += `</div>`;

  // Filter chips
  if (filterChips.length > 0) {
    html += `<div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200 bg-blue-50">`;
    html += `<span class="text-xs text-gray-500">Bộ lọc:</span>`;
    filterChips.forEach(chip => html += chip);
    html += `<a href="/lo-hang?range=${filterRange}" class="text-xs text-red-500 hover:text-red-700">Xoá tất cả</a>`;
    html += `</div>`;
  }

  // Column visibility panel (hidden by default)
  const permCols: ColKey[] = perm.loCols === 'all' ? [...ALL_COLS] : [...perm.loCols];
  html += `<div id="colTogglePanel" class="hidden border-b border-gray-200 bg-yellow-50 px-4 py-3">
    <div class="text-xs font-semibold text-gray-600 mb-2">Hiển thị cột:</div>
    <form method="GET" action="/lo-hang" class="flex flex-wrap gap-3" id="colForm">
      <input type="hidden" name="range" value="${esc(filterRange)}">
      <input type="hidden" name="q" value="${esc(freeSearch)}">
      <input type="hidden" name="fc" value="${esc(filterCol)}">
      <input type="hidden" name="fv" value="${esc(filterVal)}">
      <input type="hidden" name="collapsed" value="${esc(collapsedParam)}">`;
  permCols.forEach(col => {
    const def = COL_DEFS[col];
    const checked = cols.includes(col);
    html += `<label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
      <input type="checkbox" name="hide_check" value="${col}" ${checked ? 'checked' : ''} class="rounded border-gray-300"> ${def?.label || col}
    </label>`;
  });
  html += `<button type="submit" class="px-3 py-1 bg-blue-600 text-white rounded text-xs" id="colToggleSubmit">Áp dụng</button>
    </form>
  </div>`;

  // Grid table
  html += `<div class="overflow-x-auto"><table class="htql-table min-w-full text-sm" style="border-collapse:collapse">`;
  html += `<thead class="bg-gray-100">`;

  // Group header row
  html += `<tr class="border-b border-gray-300">`;
  html += `<th class="px-2 py-2 text-xs font-medium text-gray-500 text-center" style="width:24px"></th>`;
  html += `<th class="px-2 py-2 text-xs font-medium text-gray-500 text-center" style="width:30px">
    <input type="checkbox" id="selectAll" class="rounded border-gray-300" title="Chọn tất cả">
  </th>`;
  if (visibleByGroup.info.length)
    html += `<th class="px-2 py-2 text-xs font-semibold text-gray-600 text-center border-l border-gray-300" colspan="${visibleByGroup.info.length}">Thông tin chung</th>`;
  if (visibleByGroup.hang.length)
    html += `<th class="px-2 py-2 text-xs font-semibold text-center border-l border-gray-300" style="background:#f3e8ff;color:#7c3aed" colspan="${visibleByGroup.hang.length}">Nhóm HÀNG</th>`;
  if (visibleByGroup.money.length)
    html += `<th class="px-2 py-2 text-xs font-semibold text-center border-l border-gray-300" style="background:#dcfce7;color:#16a34a" colspan="${visibleByGroup.money.length}">Nhóm TIỀN</th>`;
  if (perm.canEdit) html += `<th class="px-2 py-2 text-xs font-medium text-gray-500 border-l border-gray-300" style="width:50px">Công cụ</th>`;
  html += `</tr>`;

  // Column header row
  html += `<tr class="border-b border-gray-300 bg-white">`;
  html += `<th class="px-2 py-2" style="width:24px"></th>`;
  html += `<th class="px-2 py-2" style="width:30px"></th>`;
  cols.forEach(col => {
    const def = COL_DEFS[col];
    const isHang = def?.group === 'hang';
    const isMoney = def?.group === 'money';
    const hasFilter = col === filterCol ? ' bg-blue-100' : '';
    const bgClass = isHang ? 'bg-purple-50' : isMoney ? 'bg-green-50' : '';
    const filterIcon = def?.filterable ? ` <a href="${buildFilterUrl(c, col)}" class="text-blue-500 hover:text-blue-700 no-underline" title="Lọc theo ${def?.label}">&#9662;</a>` : '';
    html += `<th class="px-2 py-2 text-xs font-semibold text-gray-600 border-l border-gray-100 whitespace-nowrap ${bgClass}${hasFilter}">${def?.label || col}${filterIcon}</th>`;
  });
  if (perm.canEdit) html += `<th class="px-2 py-2 border-l border-gray-100"></th>`;
  html += `</tr>`;
  html += `</thead><tbody>`;

  // Group rows and data rows
  chuyenIds.forEach(chuyenId => {
    const isNoChuyen = chuyenId === '_NO_CHUYEN_';
    const chLots = byChuyen.get(chuyenId) || [];
    // Group summary
    const sumKien = chLots.reduce((s, l) => s + l.so_kien, 0);
    const sumDaTra = chLots.reduce((s, l) => s + l.da_tra_hang, 0);
    const sumTTByCcy: Record<string, number> = {};
    const sumTHByCcy: Record<string, number> = {};
    chLots.forEach(l => {
      sumTTByCcy[l.tien_te] = (sumTTByCcy[l.tien_te] || 0) + l.thanh_tien;
      const tth = l.tien_te_th || l.tien_te;
      if (l.so_tien_hang > 0) sumTHByCcy[tth] = (sumTHByCcy[tth] || 0) + l.so_tien_hang;
    });
    const fmtCcyMulti = (m: Record<string, number>) => {
      const arr = Object.entries(m).filter(([, v]) => v > 0).map(([t, v]) => `${fmtNum(v)} <span class="text-xs text-gray-400">${t}</span>`);
      return arr.length ? arr.join('<br>') : '\u2014';
    };

    const isOpen = !collapsed.has(chuyenId);
    const collapseToggle = collapsed.has(chuyenId)
      ? `<a href="${buildGridUrl(c, { collapsed: collapsedParam ? collapsedParam.split(',').filter(x => x !== chuyenId).join(',') : '' })}" class="text-gray-400 hover:text-gray-700 no-underline" title="Mở">&#9654;</a>`
      : `<a href="${buildGridUrl(c, { collapsed: (collapsedParam ? collapsedParam + ',' : '') + chuyenId })}" class="text-gray-400 hover:text-gray-700 no-underline" title="Thu gọn">&#9660;</a>`;

    // Get first lo for chuyen info
    const firstLo = chLots[0];

    html += `<tr class="bg-gray-50 border-b border-gray-200 cursor-pointer font-medium">`;
    html += `<td class="px-2 py-2 text-center">${collapseToggle}</td>`;
    html += `<td class="px-2 py-2 text-center"><input type="checkbox" class="rounded border-gray-300 group-check" data-chuyen="${esc(chuyenId)}" title="Chọn tất cả trong chuyến"></td>`;
    cols.forEach(col => {
      const def = COL_DEFS[col];
      const isHang = def?.group === 'hang';
      const isMoney = def?.group === 'money';
      const tdCls = isHang ? 'bg-purple-50' : isMoney ? 'bg-green-50' : '';
      let v = '';
      if (col === 'ma') v = isNoChuyen ? `<strong style="color:#d97706">Chưa chuyến (${chLots.length})</strong>` : `<strong>${esc(chuyenId)}</strong>`;
      else if (col === 'ngayLenXe') v = firstLo?.ngay_di ? fmtDate(firstLo.ngay_di) : '\u2014';
      else if (col === 'ngayVe') v = firstLo?.ngay_den ? fmtDate(firstLo.ngay_den) : '\u2014';
      else if (col === 'soXe') v = esc(firstLo?.so_xe);
      else if (col === 'bienSo') v = esc(firstLo?.bien_so);
      else if (col === 'tuyenVT') v = firstLo?.tuyen_ten
        ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium" style="background:${tuyenColor(firstLo.tuyen_mau)}">${esc(firstLo.tuyen_ten)}</span>` : '';
      else if (col === 'soKien') v = fmtNum(sumKien);
      else if (col === 'daTraHang') v = fmtNum(sumDaTra);
      else if (col === 'luuKho') v = (sumKien - sumDaTra) > 0 ? `<span style="color:#7c3aed">${fmtNum(sumKien - sumDaTra)}</span>` : '0';
      else if (col === 'thanhTien') v = fmtCcyMulti(sumTTByCcy);
      else if (col === 'soTienHang') v = fmtCcyMulti(sumTHByCcy);
      html += `<td class="px-2 py-2 text-xs border-l border-gray-100 ${tdCls}">${v}</td>`;
    });
    if (perm.canEdit) html += `<td class="px-2 py-2 border-l border-gray-100"></td>`;
    html += `</tr>`;

    // Data rows (only if expanded)
    if (isOpen) {
      chLots.forEach(lo => {
        const luuKho = lo.so_kien - lo.da_tra_hang;
        html += `<tr class="border-b border-gray-100 hover:bg-blue-50 lo-row" data-lo-id="${esc(lo.id)}">`;
        html += `<td class="px-2 py-2"></td>`;
        html += `<td class="px-2 py-2 text-center"><input type="checkbox" class="rounded border-gray-300 lo-check" value="${esc(lo.id)}"></td>`;
        cols.forEach(col => {
          const def = COL_DEFS[col];
          const isHang = def?.group === 'hang';
          const isMoney = def?.group === 'money';
          const tdCls = isHang ? 'bg-purple-50/50' : isMoney ? 'bg-green-50/50' : '';
          const isNum = def?.cls?.includes('num') ?? false;
          const align = isNum ? 'text-right' : '';
          let v = '';
          switch(col) {
            case 'ma':
              v = `<a href="/lo-hang/${esc(lo.id)}" class="text-blue-600 hover:underline font-medium">${esc(lo.id)}</a>`;
              if (lo.so_kien === 0) v += ` <span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700">tiền only</span>`;
              break;
            case 'ngayLenXe':
              v = lo.ngay_di ? `<a href="${buildGridUrl(c,{fc:'ngayLenXe',fv:lo.ngay_di})}" class="text-gray-600 hover:text-blue-600 no-underline">${fmtDate(lo.ngay_di)}</a>` : '<span class="text-yellow-600">\u2014 (chưa)</span>';
              break;
            case 'ngayVe':
              v = lo.ngay_den ? `<a href="${buildGridUrl(c,{fc:'ngayVe',fv:lo.ngay_den})}" class="text-gray-600 hover:text-blue-600 no-underline">${fmtDate(lo.ngay_den)}</a>` : '<span class="text-yellow-600">\u2014 (chưa)</span>';
              break;
            case 'soXe':
              v = lo.so_xe ? `<a href="${buildGridUrl(c,{fc:'soXe',fv:lo.so_xe})}" class="text-gray-600 hover:text-blue-600 no-underline">${esc(lo.so_xe)}</a>` : '<span class="text-gray-400">\u2014</span>';
              break;
            case 'bienSo':
              v = lo.bien_so ? `<a href="${buildGridUrl(c,{fc:'bienSo',fv:lo.bien_so})}" class="text-gray-600 hover:text-blue-600 no-underline">${esc(lo.bien_so)}</a>` : '<span class="text-gray-400">\u2014</span>';
              break;
            case 'tuyenVT':
              v = lo.tuyen_ten ? `<a href="${buildGridUrl(c,{fc:'tuyenVT',fv:lo.chuyen_xe_id ? '' : ''})}" class="no-underline"><span class="inline-block px-2 py-0.5 rounded text-xs font-medium" style="background:${tuyenColor(lo.tuyen_mau)}">${esc(lo.tuyen_ten)}</span></a>` : '';
              break;
            case 'nguoiGui':
              v = lo.hang_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiGui',fv:lo.hang_id})}" class="text-gray-600 hover:text-blue-600 no-underline">${esc(lo.hang_ten)}</a>` : '';
              break;
            case 'nguoiNhan':
              v = lo.khach_hang_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiNhan',fv:lo.khach_hang_id})}" class="text-gray-600 hover:text-blue-600 no-underline">${esc(lo.khach_hang_ten)}</a>` : '';
              break;
            case 'nguoiTao':
              v = lo.nguoi_tao_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiTao',fv:lo.nguoi_tao})}" class="text-gray-600 hover:text-blue-600 no-underline">${esc(lo.nguoi_tao_ten)}</a>` : '\u2014';
              break;
            case 'nguoiThu':
              v = lo.nguoi_thu_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiThu',fv:lo.nguoi_thu})}" class="text-gray-600 hover:text-blue-600 no-underline">${esc(lo.nguoi_thu_ten)}</a>` : '\u2014';
              break;
            case 'soKien':
              v = fmtNum(lo.so_kien);
              break;
            case 'daTraHang':
              v = lo.da_tra_hang < lo.so_kien
                ? `<span style="color:#d97706">${fmtNum(lo.da_tra_hang)}</span>`
                : fmtNum(lo.da_tra_hang);
              break;
            case 'luuKho':
              v = luuKho > 0
                ? `<span style="color:#7c3aed">${fmtNum(luuKho)}</span>`
                : `<span class="text-gray-400">0</span>`;
              break;
            case 'ghiChu':
              v = lo.ly_do_thieu ? `<span class="text-xs">${esc(lo.ly_do_thieu)}</span>` : '\u2014';
              break;
            case 'donGia':
              v = lo.don_gia > 0
                ? `${fmtNum(lo.don_gia)} <span class="text-xs text-gray-400">${esc(lo.tien_te)}</span>`
                : '<span class="text-gray-400 italic">tổng</span>';
              break;
            case 'thanhTien':
              v = `${fmtNum(lo.thanh_tien)} <span class="text-xs text-gray-400">${esc(lo.tien_te)}</span>`;
              break;
            case 'soTienHang':
              v = (lo.so_tien_hang > 0)
                ? `${fmtNum(lo.so_tien_hang)} <span class="text-xs text-gray-400">${esc(lo.tien_te_th || lo.tien_te)}</span>`
                : '\u2014';
              break;
          }
          html += `<td class="px-2 py-2 text-xs border-l border-gray-100 ${tdCls} ${align}">${v}</td>`;
        });
        if (perm.canEdit) {
          html += `<td class="px-2 py-2 text-xs border-l border-gray-100">
            <a href="/lo-hang/${esc(lo.id)}" class="text-blue-600 hover:underline" title="Sửa">
              <iconify-icon icon="solar:pen-linear"></iconify-icon>
            </a>
          </td>`;
        }
        html += `</tr>`;
      });
    }
  });

  if (lots.length === 0) {
    html += `<tr><td colspan="${cols.length + 3}" class="px-4 py-8 text-center text-gray-400 italic">Chưa có phiếu nào</td></tr>`;
  }

  // Totals row
  html += `<tr class="border-t border-gray-300 bg-blue-50">`;
  html += `<td class="px-2 py-2 text-xs text-right" style="width:24px">&#128202;</td>`;
  html += `<td class="px-2 py-2" style="width:30px"></td>`;
  cols.forEach(col => {
    const def = COL_DEFS[col];
    const isNum = def?.cls?.includes('num') ?? false;
    let v = '';
    if (col === 'soKien') v = `<strong>${fmtNum(totalSoKien)}</strong>`;
    else if (col === 'daTraHang') v = `<strong>${fmtNum(totalDaTra)}</strong>`;
    else if (col === 'luuKho') v = totalLuuKho > 0 ? `<strong style="color:#7c3aed">${fmtNum(totalLuuKho)}</strong>` : '0';
    else if (col === 'thanhTien') v = `<strong style="color:#16a34a">${fmtCcy('thanhTien')}</strong>`;
    else if (col === 'soTienHang') v = `<strong>${fmtCcy('soTienHang')}</strong>`;
    else if (col === 'ma') v = `<span style="color:#6b7280;font-weight:normal">Tổng ${lots.length} phiếu:</span>`;
    html += `<td class="px-2 py-2 text-xs border-l border-gray-100" style="text-align:${isNum?'right':'left'}">${v}</td>`;
  });
  if (perm.canEdit) html += `<td class="px-2 py-2 border-l border-gray-100"></td>`;
  html += `</tr>`;

  html += `</tbody></table></div>`;

  // Footer
  html += `<div class="flex flex-wrap justify-between items-center px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
    <span>${chuyenIds.length} chuyến \u00B7 ${lots.length} phiếu \u00B7 <strong>${rangeLabel(filterRange)}</strong></span>
    <span>Vai trò: <strong>${user.display_name} (${role})</strong></span>
  </div>`;

  html += `</div>`;

  // Bulk action bar (client-side toggle)
  html += `<div id="bulkBar" class="hidden fixed bottom-0 left-0 right-0 bg-primary text-white px-6 py-3 flex items-center gap-3 z-50 shadow-lg">
    <span id="bulkCount" class="font-semibold">0 phiếu đã chọn:</span>
    <button onclick="bulkAction('tra-hang')" class="px-3 py-1.5 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50">Đã trả hàng</button>
    <button onclick="bulkAction('print')" class="px-3 py-1.5 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50">In nhãn</button>
    <button onclick="clearSelection()" class="px-3 py-1.5 bg-blue-700 text-white rounded text-sm hover:bg-blue-800 ml-auto">Bỏ chọn</button>
  </div>`;

  // Client-side scripts
  html += `<script>
  // Column toggle form: invert checkbox -> hidden param
  document.getElementById('colToggleSubmit')?.addEventListener('click', function(e) {
    e.preventDefault();
    const form = document.getElementById('colForm');
    const checked = Array.from(form.querySelectorAll('input[name="hide_check"]:checked')).map(cb => cb.value);
    const allPerm = [${permCols.map(c => `'${c}'`).join(',')}];
    const hidden = allPerm.filter(c => !checked.includes(c));
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'hide';
    hiddenInput.value = hidden.join(',');
    form.appendChild(hiddenInput);
    // Remove checkboxes so they don't go as params
    form.querySelectorAll('input[name="hide_check"]').forEach(cb => cb.remove());
    form.submit();
  });

  // Select all checkbox
  document.getElementById('selectAll')?.addEventListener('change', function() {
    document.querySelectorAll('.lo-check').forEach(cb => { cb.checked = this.checked; });
    updateBulkBar();
  });

  // Group checkboxes
  document.querySelectorAll('.group-check').forEach(gcb => {
    gcb.addEventListener('change', function() {
      const chId = this.dataset.chuyen;
      document.querySelectorAll('.lo-check').forEach(cb => {
        const row = cb.closest('tr');
        let prev = row?.previousElementSibling;
        while (prev && !prev.querySelector('.group-check')) prev = prev.previousElementSibling;
        if (prev) {
          const gCheck = prev.querySelector('.group-check');
          if (gCheck && gCheck.dataset.chuyen === chId) cb.checked = this.checked;
        }
      });
      updateBulkBar();
    });
  });

  // Individual checkboxes
  document.querySelectorAll('.lo-check').forEach(cb => {
    cb.addEventListener('change', updateBulkBar);
  });

  function updateBulkBar() {
    const selected = document.querySelectorAll('.lo-check:checked');
    const bar = document.getElementById('bulkBar');
    const count = document.getElementById('bulkCount');
    if (selected.length > 0) {
      bar.classList.remove('hidden');
      count.textContent = selected.length + ' phiếu đã chọn:';
    } else {
      bar.classList.add('hidden');
    }
  }

  function clearSelection() {
    document.querySelectorAll('.lo-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.group-check').forEach(cb => cb.checked = false);
    const sa = document.getElementById('selectAll');
    if (sa) sa.checked = false;
    updateBulkBar();
  }

  async function bulkAction(action) {
    const ids = Array.from(document.querySelectorAll('.lo-check:checked')).map(cb => cb.value);
    if (ids.length === 0) return;
    if (action === 'tra-hang') {
      if (!confirm('Đánh dấu đã trả hàng cho ' + ids.length + ' phiếu?')) return;
      const res = await fetch('/lo-hang/api/lo-hang/bulk', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'tra-hang', ids })
      });
      if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    }
  }

  window.importPreview = null;
  function openImportModal() {
    htqlOpenModal('importModal');
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('importText').value = '';
    window.importPreview = null;
    const input = document.getElementById('importFile');
    if (input) input.value = '';
    const nameEl = document.getElementById('importFileName');
    if (nameEl) {
      nameEl.textContent = '';
      nameEl.classList.add('hidden');
    }
  }
  function closeImportModal() {
    htqlCloseModal('importModal');
  }
  function dlImportTpl(type) {
    window.location.href = '/lo-hang/api/import/template/' + type;
  }
  function getImportType() {
    const active = document.querySelector('#importTypeTabs .htql-import-tab.active');
    return active?.dataset.value || 'phieu';
  }
  async function parseImport() {
    const type = getImportType();
    const text = document.getElementById('importText').value.trim();
    if (!text) { alert('Dán dữ liệu hoặc chọn file CSV/TSV'); return; }
    const res = await fetch('/lo-hang/api/import/parse', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ type, text })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Lỗi'); return; }
    window.importPreview = data;
    const el = document.getElementById('importPreview');
    let h = '<div class="text-sm space-y-3">';
    h += '<p class="text-base"><strong>' + (data.valid?.length || 0) + '</strong> dòng hợp lệ';
    if (data.errors?.length) h += ', <span class="text-red-600">' + data.errors.length + ' lỗi</span>';
    if (data.warns?.length) h += ', <span class="text-amber-600">' + data.warns.length + ' cảnh báo</span>';
    h += '</p>';
    if (data.errors?.length) {
      h += '<ul class="text-sm text-red-600 max-h-36 overflow-y-auto">';
      data.errors.slice(0, 20).forEach(e => { h += '<li>Dòng ' + e.row + ': ' + e.msg + '</li>'; });
      h += '</ul>';
    }
    if (data.warns?.length) {
      h += '<ul class="text-sm text-amber-700 max-h-36 overflow-y-auto">';
      data.warns.slice(0, 15).forEach(w => { h += '<li>Dòng ' + w.row + ': ' + w.msg + '</li>'; });
      h += '</ul>';
    }
    if (data.newKHs?.length) h += '<p class="text-sm">KH mới: ' + data.newKHs.length + '</p>';
    if (data.newHangs?.length) h += '<p class="text-sm">Hãng mới: ' + data.newHangs.length + '</p>';
    if (data.newChuyens?.length) h += '<p class="text-sm">Chuyến mới: ' + data.newChuyens.length + '</p>';
    if (data.missingTuyens?.length) h += '<p class="text-sm text-red-600">Thiếu tuyến: ' + data.missingTuyens.join(', ') + '</p>';
    h += '</div>';
    el.innerHTML = h;
    document.getElementById('importConfirmBtn').disabled = !(data.valid?.length) || (data.errors?.length > 0);
  }
  async function confirmImport() {
    const preview = window.importPreview;
    if (!preview?.valid?.length) { alert('Chưa có dữ liệu hợp lệ'); return; }
    if (!confirm('Import ' + preview.valid.length + ' bản ghi?')) return;
    const res = await fetch('/lo-hang/api/import/confirm', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ ...preview, type: getImportType() })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Đã import ' + (data.imported || 0) + ' bản ghi');
      location.reload();
    } else {
      alert(data.error || 'Lỗi import');
    }
  }
  function applyImportFileContent(text) {
    const ta = document.getElementById('importText');
    if (!ta) return;
    ta.value = text;
    const pasteArea = document.getElementById('importPasteArea');
    const toggle = document.getElementById('importPasteToggle');
    if (pasteArea) {
      pasteArea.classList.remove('hidden');
      if (toggle) toggle.textContent = 'Ẩn nhập thủ công';
    }
    document.getElementById('importPreview').innerHTML = '';
    window.importPreview = null;
    const btn = document.getElementById('importConfirmBtn');
    if (btn) btn.disabled = true;
  }
  function readImportFile(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => applyImportFileContent(String(r.result ?? ''));
    r.onerror = () => alert('Không đọc được file');
    r.readAsText(file);
  }
  </script>`;

  if (perm.canCreateLo) {
    html += `
    ${modalShell({
      id: "importModal",
      title: "Import dữ liệu",
      icon: "solar:archive-up-minimlistic-bold",
      panelClass: "htql-import-modal",
      size: "2xl",
      body: `
        <div class="flex flex-col gap-4 sm:gap-5">
          <div>
            <span class="htql-modal-label">Loại dữ liệu</span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" id="importTypeTabs">
              <button type="button" class="htql-import-tab active" data-value="phieu" onclick="setImportType(this)">
                <iconify-icon icon="solar:document-text-linear" style="font-size:20px"></iconify-icon>
                <span class="text-xs sm:text-sm font-medium text-center leading-tight">Phiếu</span>
              </button>
              <button type="button" class="htql-import-tab" data-value="kh" onclick="setImportType(this)">
                <iconify-icon icon="solar:users-group-rounded-linear" style="font-size:20px"></iconify-icon>
                <span class="text-xs sm:text-sm font-medium text-center leading-tight">Khách hàng</span>
              </button>
              <button type="button" class="htql-import-tab" data-value="hang" onclick="setImportType(this)">
                <iconify-icon icon="solar:delivery-linear" style="font-size:20px"></iconify-icon>
                <span class="text-xs sm:text-sm font-medium text-center leading-tight">Hãng</span>
              </button>
              <button type="button" class="htql-import-tab" data-value="cty" onclick="setImportType(this)">
                <iconify-icon icon="solar:bus-linear" style="font-size:20px"></iconify-icon>
                <span class="text-xs sm:text-sm font-medium text-center leading-tight">Công ty VT</span>
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${btnModalChip("Mẫu phiếu", { onclick: "dlImportTpl('phieu')", icon: "solar:download-minimalistic-linear" })}
            ${btnModalChip("Mẫu KH", { onclick: "dlImportTpl('kh')", icon: "solar:download-minimalistic-linear" })}
            ${btnModalChip("Mẫu Hãng", { onclick: "dlImportTpl('hang')", icon: "solar:download-minimalistic-linear" })}
            ${btnModalChip("Mẫu Cty VT", { onclick: "dlImportTpl('cty')", icon: "solar:download-minimalistic-linear" })}
          </div>
          <div>
            <label id="importDropzone" class="htql-import-dropzone">
              <input type="file" id="importFile" accept=".csv,.tsv,.txt,text/csv,text/plain" tabindex="-1">
              <div class="pointer-events-none">
                <iconify-icon icon="solar:cloud-upload-linear" class="text-bodytext dark:text-darklink" style="font-size:36px"></iconify-icon>
                <p class="htql-import-dropzone-text">Kéo thả file CSV/TSV vào đây</p>
                <p class="htql-import-dropzone-hint">hoặc dán từ Excel (Ctrl+V) · click để chọn file</p>
                <p id="importFileName" class="htql-import-file-name hidden break-all"></p>
              </div>
            </label>
            <div class="py-2 mt-2">
              <button type="button" id="importPasteToggle" class="text-sm font-medium text-primary hover:underline cursor-pointer" onclick="var ta=document.getElementById('importPasteArea');var lb=document.getElementById('importPasteToggle');if(ta.classList.contains('hidden')){ta.classList.remove('hidden');lb.textContent='Ẩn nhập thủ công'}else{ta.classList.add('hidden');lb.textContent='Dán thủ công'}">Dán thủ công</button>
            </div>
            <div id="importPasteArea" class="hidden mt-2">
              <textarea id="importText" rows="5" class="form-control font-mono text-sm max-h-[28vh] resize-y min-h-[100px]" placeholder="Dán header + dòng dữ liệu từ Excel..."></textarea>
            </div>
          </div>
          <div id="importPreview" class="min-h-0 text-sm max-h-[30vh] overflow-y-auto"></div>
        </div>`,
      footer: modalFooterInner(
        btnSecondary("Huỷ", { onclick: "closeImportModal()" }),
        btnModalOutline("Xem trước", {
          onclick: "parseImport()",
          icon: "solar:eye-linear",
        }),
        `<button type="button" id="importConfirmBtn" onclick="confirmImport()" disabled class="btn flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <iconify-icon icon="solar:upload-minimalistic-linear" class="text-lg"></iconify-icon>Xác nhận
            </button>`,
      ),
    })}
    <script>
    // Import type card-tab selector
    function setImportType(btn) {
      document.querySelectorAll('#importTypeTabs .htql-import-tab').forEach(function(t){ t.classList.remove('active'); });
      btn.classList.add('active');
    }
    // File input + drag-drop (must run after modal markup exists)
    (function() {
      var input = document.getElementById('importFile');
      var dz = document.getElementById('importDropzone');
      if (!input || !dz) return;

      function showFileName(name) {
        var el = document.getElementById('importFileName');
        if (!el) return;
        if (name) {
          el.textContent = 'Đã chọn: ' + name;
          el.classList.remove('hidden');
        } else {
          el.textContent = '';
          el.classList.add('hidden');
        }
      }

      input.addEventListener('change', function(ev) {
        var file = ev.target.files?.[0];
        if (!file) return;
        showFileName(file.name);
        readImportFile(file);
      });

      ['dragenter', 'dragover'].forEach(function(evt) {
        dz.addEventListener(evt, function(e) {
          e.preventDefault();
          e.stopPropagation();
          dz.classList.add('dz-dragover');
        });
      });
      dz.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('dz-dragover');
      });
      dz.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('dz-dragover');
        var file = e.dataTransfer?.files?.[0];
        if (!file) return;
        showFileName(file.name);
        readImportFile(file);
      });
    })();
    // Paste into importText: auto-show paste area
    document.addEventListener('paste', function(e) {
      var modal = document.getElementById('importModal');
      if (modal && !modal.classList.contains('hidden')) {
        var pasteArea = document.getElementById('importPasteArea');
        if (pasteArea && pasteArea.classList.contains('hidden')) {
          pasteArea.classList.remove('hidden');
          document.getElementById('importPasteToggle').textContent = 'Ẩn nhập thủ công';
        }
      }
    });
    // Enhance parseImport preview rendering (override)
    (function() {
      var _origParseImport = window.parseImport;
      window.parseImport = async function() {
        var type = getImportType();
        var text = document.getElementById('importText').value.trim();
        if (!text) { alert('Dán dữ liệu hoặc chọn file CSV/TSV'); return; }
        var res = await fetch('/lo-hang/api/import/parse', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ type: type, text: text })
        });
        var data = await res.json();
        if (!res.ok) { alert(data.error || 'Lỗi'); return; }
        window.importPreview = data;
        var el = document.getElementById('importPreview');
        var validCount = data.valid?.length || 0;
        var errCount = data.errors?.length || 0;
        var warnCount = data.warns?.length || 0;
        var h = '<div style="animation:modalIn 0.2s ease-out" class="rounded-xl border-2 border-gray-100 overflow-hidden">';
        // Summary row
        h += '<div class="flex items-center flex-wrap gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">';
        h += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-700"><iconify-icon icon="solar:check-circle-linear" style="font-size:18px"></iconify-icon> ' + validCount + ' hợp lệ</span>';
        if (errCount) h += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-100 text-red-700"><iconify-icon icon="solar:close-circle-linear" style="font-size:18px"></iconify-icon> ' + errCount + ' lỗi</span>';
        if (warnCount) h += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700"><iconify-icon icon="solar:danger-triangle-linear" style="font-size:18px"></iconify-icon> ' + warnCount + ' cảnh báo</span>';
        h += '</div>';
        // Errors
        if (data.errors?.length) {
          h += '<details class="border-b border-gray-100"><summary class="px-5 py-3 text-base font-medium text-red-700 cursor-pointer hover:bg-red-50 transition-colors select-none flex items-center gap-2"><iconify-icon icon="solar:close-circle-linear" style="font-size:20px"></iconify-icon> Lỗi (' + errCount + ')</summary>';
          h += '<ul class="px-5 pb-4 text-sm text-red-600 max-h-40 overflow-y-auto space-y-1 bg-red-50 mx-3 mb-3 rounded-lg">';
          data.errors.slice(0, 20).forEach(function(e) { h += '<li class="py-0.5">Dòng ' + e.row + ': ' + e.msg + '</li>'; });
          if (errCount > 20) h += '<li class="text-red-400 italic">...và ' + (errCount - 20) + ' lỗi khác</li>';
          h += '</ul></details>';
        }
        // Warnings
        if (data.warns?.length) {
          h += '<details class="border-b border-gray-100"><summary class="px-5 py-3 text-base font-medium text-amber-700 cursor-pointer hover:bg-amber-50 transition-colors select-none flex items-center gap-2"><iconify-icon icon="solar:danger-triangle-linear" style="font-size:20px"></iconify-icon> Cảnh báo (' + warnCount + ')</summary>';
          h += '<ul class="px-5 pb-4 text-sm text-amber-700 max-h-40 overflow-y-auto space-y-1 bg-amber-50 mx-3 mb-3 rounded-lg">';
          data.warns.slice(0, 15).forEach(function(w) { h += '<li class="py-0.5">Dòng ' + w.row + ': ' + w.msg + '</li>'; });
          if (warnCount > 15) h += '<li class="text-amber-400 italic">...và ' + (warnCount - 15) + ' cảnh báo khác</li>';
          h += '</ul></details>';
        }
        // New items badges
        var newItems = [];
        if (data.newKHs?.length) newItems.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">' + data.newKHs.length + ' KH mới</span>');
        if (data.newHangs?.length) newItems.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-violet-100 text-violet-700">' + data.newHangs.length + ' Hãng mới</span>');
        if (data.newChuyens?.length) newItems.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-700">' + data.newChuyens.length + ' Chuyến mới</span>');
        if (newItems.length) {
          h += '<div class="px-5 py-4 flex flex-wrap gap-2">';
          newItems.forEach(function(b) { h += b; });
          h += '</div>';
        }
        // Missing routes
        if (data.missingTuyens?.length) {
          h += '<div class="mx-3 mb-3 px-5 py-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3"><iconify-icon icon="solar:danger-triangle-linear" style="font-size:22px;color:#dc2626;margin-top:1px"></iconify-icon><div><p class="text-base font-semibold text-red-700">Thiếu tuyến</p><p class="text-sm text-red-600 mt-1">' + data.missingTuyens.join(', ') + '</p></div></div>';
        }
        h += '</div>';
        el.innerHTML = h;
        document.getElementById('importConfirmBtn').disabled = !(data.valid?.length) || (data.errors?.length > 0);
      };
    })();
    </script>`;
  }

  return c.html(layout('Phiếu', html, user, 'lo-hang'));
});

// ─── GET /create — Create Form ────────────────────────────────
loHangRoutes.get('/create', async (c) => {
  const user = c.get('user');
  const perm = loHangPerm(c.get('perms'));

  if (!perm.canCreateLo) {
    return c.html(layout('Không có quyền', '<div class="text-center py-12 text-red-500">Bạn không có quyền tạo phiếu</div>', user, 'lo-hang'));
  }

  const khRes = await c.env.DB.prepare('SELECT id, ten, ma_kh FROM khach_hang ORDER BY ten').all();
  const hangRes = await c.env.DB.prepare('SELECT id, ten FROM hang ORDER BY ten').all();
  const cxRes = await c.env.DB.prepare(
    `SELECT cx.id, t.ten as tuyen_ten, x.bien_so, cx.ngay_di
     FROM chuyen_xe cx LEFT JOIN tuyen t ON cx.tuyen_id = t.id LEFT JOIN xe x ON cx.xe_id = x.id
     ORDER BY cx.ngay_di DESC LIMIT 200`
  ).all();
  const nvRes = await c.env.DB.prepare(`SELECT id, ten FROM nhan_vien WHERE active = 1 ORDER BY ten`).all();

  const khOptions = (khRes.results as {id:string;ten:string;ma_kh:string}[]).map(k =>
    `<option value="${esc(k.id)}">${esc(k.ma_kh)} - ${esc(k.ten)}</option>`
  ).join('');
  const hangOptions = (hangRes.results as {id:string;ten:string}[]).map(h =>
    `<option value="${esc(h.id)}">${esc(h.ten)}</option>`
  ).join('');
  const cxOptions = (cxRes.results as {id:string;tuyen_ten:string;bien_so:string;ngay_di:string}[]).map(cx =>
    `<option value="${esc(cx.id)}">${esc(cx.id)} | ${esc(cx.tuyen_ten||'-')} | ${esc(cx.bien_so||'-')} | ${cx.ngay_di||'-'}</option>`
  ).join('');
  const nvOptions = (nvRes.results as {id:string;ten:string}[]).map(nv =>
    `<option value="${esc(nv.id)}">${esc(nv.ten)}</option>`
  ).join('');

  let html = `<a href="/lo-hang" class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mb-4">
    <iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Quay lại danh sách
  </a>`;

  html += `<div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-lg font-bold text-gray-900 mb-4">Tạo phiếu mới</h2>
    <form id="createForm" class="grid grid-cols-2 sm:grid-cols-3 gap-4" onsubmit="return createLo(event)">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Chuyến xe</label>
        <select name="chuyen_xe_id" id="chuyenSelect" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">-- Chưa có chuyến (DK) --</option>${cxOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Khách hàng <span class="text-red-500">*</span></label>
        <select name="khach_hang_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">-- Chọn KH --</option>${khOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Hãng <span class="text-red-500">*</span></label>
        <select name="hang_id" required class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">-- Chọn hãng --</option>${hangOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Số kiện</label>
        <input type="number" name="so_kien" value="1" min="0" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" oninput="calcThanhTien()">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Đơn giá</label>
        <input type="number" name="don_gia" value="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" oninput="calcThanhTien()">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tiền tệ</label>
        <select name="tien_te" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="PLN">PLN</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Thành tiền (tự tính)</label>
        <input type="number" name="thanh_tien" value="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50" readonly>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Số tiền hàng</label>
        <input type="number" name="so_tien_hang" value="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Giảm giá</label>
        <input type="number" name="giam_gia" value="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" oninput="calcThanhTien()">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Người tạo</label>
        <select name="nguoi_tao" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">-- Chọn --</option>${nvOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Người thu</label>
        <select name="nguoi_thu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">-- Chọn --</option>${nvOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
        <input type="text" name="ly_do_thieu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
      </div>
      <div class="col-span-2 sm:col-span-3 flex gap-2 pt-2">
        <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer">Tạo phiếu</button>
        <a href="/lo-hang" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">Hủy</a>
      </div>
    </form>
  </div>`;

  html += `<script>
  function calcThanhTien() {
    const form = document.getElementById('createForm');
    const soKien = Number(form.so_kien.value) || 0;
    const donGia = Number(form.don_gia.value) || 0;
    const giamGia = Number(form.giam_gia.value) || 0;
    form.thanh_tien.value = Math.max(0, soKien * donGia - giamGia);
  }
  async function createLo(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    body.so_kien = Number(body.so_kien) || 0;
    body.don_gia = Number(body.don_gia) || 0;
    body.thanh_tien = Number(body.thanh_tien) || 0;
    body.so_tien_hang = Number(body.so_tien_hang) || 0;
    body.giam_gia = Number(body.giam_gia) || 0;
    body.da_tra_hang = 0;
    const res = await fetch('/lo-hang/api/lo-hang', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (res.ok) { window.location.href = '/lo-hang'; }
    else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    return false;
  }
  </script>`;

  return c.html(layout('Tạo phiếu', html, user, 'lo-hang'));
});

// ─── GET /:id — Detail View ──────────────────────────────────
loHangRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const perm = loHangPerm(c.get('perms'));

  const lo = await c.env.DB.prepare(
    `${LO_HANG_SQL} WHERE lh.id = ?`
  ).bind(id).first<LoRow>();

  if (!lo) {
    return c.html(layout('Không tìm thấy', '<div class="text-center py-12 text-gray-400">Phiếu không tồn tại</div>', user, 'lo-hang'));
  }

  // Audit log
  const auditRes = await c.env.DB.prepare(
    `SELECT * FROM audit_log WHERE target = ? ORDER BY ngay DESC, gio DESC LIMIT 20`
  ).bind(id).all();

  // Related phieu thu
  const phieuThuRes = await c.env.DB.prepare(
    `SELECT pt.* FROM phieu_thu pt WHERE pt.lo_ids LIKE ? ORDER BY pt.ngay DESC`
  ).bind(`%"${id}%"`).all();

  // Fetch dropdown data for edit form
  const khRes = await c.env.DB.prepare('SELECT id, ten, ma_kh FROM khach_hang ORDER BY ten').all();
  const hangRes = await c.env.DB.prepare('SELECT id, ten FROM hang ORDER BY ten').all();
  const cxRes = await c.env.DB.prepare(
    `SELECT cx.id, t.ten as tuyen_ten, x.bien_so, cx.ngay_di
     FROM chuyen_xe cx LEFT JOIN tuyen t ON cx.tuyen_id = t.id LEFT JOIN xe x ON cx.xe_id = x.id
     ORDER BY cx.ngay_di DESC LIMIT 200`
  ).all();
  const nvRes = await c.env.DB.prepare(`SELECT id, ten FROM nhan_vien WHERE active = 1 ORDER BY ten`).all();

  const khOptions = (khRes.results as {id:string;ten:string;ma_kh:string}[]).map(k =>
    `<option value="${esc(k.id)}" ${k.id===lo.khach_hang_id?'selected':''}>${esc(k.ma_kh)} - ${esc(k.ten)}</option>`
  ).join('');
  const hangOptions = (hangRes.results as {id:string;ten:string}[]).map(h =>
    `<option value="${esc(h.id)}" ${h.id===lo.hang_id?'selected':''}>${esc(h.ten)}</option>`
  ).join('');
  const cxOptions = (cxRes.results as {id:string;tuyen_ten:string;bien_so:string;ngay_di:string}[]).map(cx =>
    `<option value="${esc(cx.id)}" ${cx.id===lo.chuyen_xe_id?'selected':''}>${esc(cx.id)} | ${esc(cx.tuyen_ten||'-')} | ${esc(cx.bien_so||'-')} | ${cx.ngay_di||'-'}</option>`
  ).join('');
  const nvTaoOptions = (nvRes.results as {id:string;ten:string}[]).map(nv =>
    `<option value="${esc(nv.id)}" ${nv.id===lo.nguoi_tao?'selected':''}>${esc(nv.ten)}</option>`
  ).join('');
  const nvThuOptions = (nvRes.results as {id:string;ten:string}[]).map(nv =>
    `<option value="${esc(nv.id)}" ${nv.id===lo.nguoi_thu?'selected':''}>${esc(nv.ten)}</option>`
  ).join('');

  const luuKho = lo.so_kien - lo.da_tra_hang;
  const tienVT = lo.thanh_tien - (lo.giam_gia || 0);

  // KPI cards
  let html = `<a href="/lo-hang" class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mb-4">
    <iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Quay lại danh sách
  </a>`;

  // Hero banner
  html += `<div class="rounded-lg overflow-hidden mb-4" style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)">
    <div class="px-6 py-5 text-white">
      <h1 class="text-xl font-bold mb-1">${esc(lo.id)}</h1>
      <div class="text-sm opacity-90">
        ${lo.khach_hang_ten ? esc(lo.khach_hang_ten) : '\u2014'} \u00B7 ${lo.hang_ten ? esc(lo.hang_ten) : '\u2014'} \u00B7 ${lo.ngay_di ? fmtDate(lo.ngay_di) : '\u2014'}
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        ${lo.tuyen_ten ? `<span class="bg-white/20 px-3 py-1 rounded-full text-xs">${esc(lo.tuyen_ten)}</span>` : ''}
        ${lo.chuyen_xe_id ? `<span class="bg-white/20 px-3 py-1 rounded-full text-xs">${esc(lo.chuyen_xe_id)}</span>` : '<span class="bg-yellow-400/40 px-3 py-1 rounded-full text-xs">Chưa có chuyến</span>'}
      </div>
    </div>
  </div>`;

  // KPI grid
  html += `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">`;
  html += kpiCard('Số kiện', String(lo.so_kien), `${lo.da_tra_hang}/${lo.so_kien} đã trả`, 'blue');
  html += kpiCard('Tiền VT', `${fmtNum(tienVT)} ${lo.tien_te}`, lo.giam_gia > 0 ? `Đã giảm ${fmtNum(lo.giam_gia)}` : '', 'green');
  if (lo.so_tien_hang > 0)
    html += kpiCard('Tiền hàng', `${fmtNum(lo.so_tien_hang)} ${lo.tien_te_th || lo.tien_te}`, '', 'yellow');
  html += kpiCard('Lưu kho', String(luuKho), luuKho > 0 ? 'Chưa trả hết' : 'Đã trả hết', luuKho > 0 ? 'purple' : 'green');
  html += `</div>`;

  // Detail info
  html += `<div class="bg-white rounded-lg shadow p-5 mb-4">
    <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
      <iconify-icon icon="solar:info-circle-linear"></iconify-icon> Thông tin phiếu
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">`;
  html += infoRow('Mã phiếu', `<strong>${esc(lo.id)}</strong>`);
  html += infoRow('Khách hàng', lo.khach_hang_ten ? `${esc(lo.khach_hang_ten)} (${esc(lo.ma_kh)})` : '\u2014');
  html += infoRow('Hãng giao', lo.hang_ten ? esc(lo.hang_ten) : '\u2014');
  if (lo.chuyen_xe_id) {
    html += infoRow('Chuyến xe', `${esc(lo.chuyen_xe_id)} \u00B7 ${esc(lo.so_xe||'?')} (${esc(lo.bien_so||'?')}) \u00B7 ${esc(lo.tuyen_ten||'\u2014')}`);
    html += infoRow('Ngày đi \u2192 về', `${fmtDateFull(lo.ngay_di)} \u2192 ${fmtDateFull(lo.ngay_den)}`);
  }
  html += infoRow('Đơn giá', lo.don_gia > 0 ? `${fmtNum(lo.don_gia)} ${lo.tien_te} \u00D7 ${lo.so_kien} kiện = <strong>${fmtNum(lo.thanh_tien)} ${lo.tien_te}</strong>` : '<em class="text-gray-400">tổng</em>');
  if (lo.giam_gia > 0) html += infoRow('Giảm giá', `${fmtNum(lo.giam_gia)} ${lo.tien_te}`);
  if (lo.ly_do_thieu) html += infoRow('Lý do thiếu', `<span class="text-yellow-700">${esc(lo.ly_do_thieu)}</span>`);
  html += infoRow('Người tạo', lo.nguoi_tao_ten ? esc(lo.nguoi_tao_ten) : '\u2014');
  html += infoRow('Người thu', lo.nguoi_thu_ten ? esc(lo.nguoi_thu_ten) : '\u2014');
  html += `</div></div>`;

  // Related phieu thu
  const phieuThus = phieuThuRes.results as {id:string;ngay:string;dau_muc:string;loai_tien:string;kieu_qt:string;so_tien:number;tien_te:string;gio:string}[];
  if (phieuThus.length > 0) {
    html += `<div class="bg-white rounded-lg shadow p-5 mb-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Lịch sử thanh toán (${phieuThus.length})</h3>
      <div class="overflow-x-auto"><table class="min-w-full text-sm">
        <thead class="bg-gray-50"><tr>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Mã</th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Ngày</th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Loại</th>
          <th class="px-3 py-2 text-right text-xs font-medium text-gray-500">Số tiền</th>
        </tr></thead><tbody>`;
    phieuThus.forEach(p => {
      const isTH = (p.loai_tien || 'vantai') === 'tienhang';
      const tag = isTH
        ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700">TH</span>'
        : '<span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">VT</span>';
      html += `<tr class="border-b border-gray-100">
        <td class="px-3 py-2">${esc(p.id)}</td>
        <td class="px-3 py-2">${fmtDate(p.ngay)} ${p.gio||''}</td>
        <td class="px-3 py-2">${tag} ${p.kieu_qt === 'ung' ? 'Ứng' : 'Trả hết'}</td>
        <td class="px-3 py-2 text-right font-medium">${fmtNum(p.so_tien)} ${esc(p.tien_te)}</td>
      </tr>`;
    });
    html += `</tbody></table></div></div>`;
  }

  // Audit log
  const audits = auditRes.results as {ngay:string;gio:string;nguoi_label:string;hanh_dong:string;chi_tiet:string}[];
  if (audits.length > 0) {
    html += `<div class="bg-white rounded-lg shadow p-5 mb-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Lịch sử thao tác (${audits.length})</h3>
      <div class="max-h-64 overflow-y-auto space-y-1">`;
    audits.forEach(a => {
      html += `<div class="text-xs py-1.5 border-b border-gray-50">${fmtDate(a.ngay)} ${a.gio||''} \u00B7 <strong class="text-blue-700">${esc(a.nguoi_label||'?')}</strong> \u00B7 ${esc(a.hanh_dong)} \u00B7 ${esc(a.chi_tiet||'')}</div>`;
    });
    html += `</div></div>`;
  }

  // Edit form (collapsible)
  if (perm.canEdit) {
    html += `<div class="bg-white rounded-lg shadow p-5 mb-4">
      <button onclick="document.getElementById('editForm').classList.toggle('hidden')" class="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer mb-3">
        <iconify-icon icon="solar:pen-linear"></iconify-icon> Sửa phiếu
      </button>
      <form id="editForm" class="hidden grid grid-cols-2 sm:grid-cols-3 gap-4" onsubmit="return saveEdit(event)">
        <input type="hidden" name="id" value="${esc(lo.id)}">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Khách hàng</label>
          <select name="khach_hang_id" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn KH --</option>${khOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Hãng</label>
          <select name="hang_id" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn hãng --</option>${hangOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Chuyến xe</label>
          <select name="chuyen_xe_id" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn chuyến --</option>${cxOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Số kiện</label>
          <input type="number" name="so_kien" value="${lo.so_kien}" min="0" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Đã trả hàng</label>
          <input type="number" name="da_tra_hang" value="${lo.da_tra_hang}" min="0" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Đơn giá</label>
          <input type="number" name="don_gia" value="${lo.don_gia}" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Tiền tệ</label>
          <select name="tien_te" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="PLN" ${lo.tien_te==='PLN'?'selected':''}>PLN</option>
            <option value="EUR" ${lo.tien_te==='EUR'?'selected':''}>EUR</option>
            <option value="USD" ${lo.tien_te==='USD'?'selected':''}>USD</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Thành tiền</label>
          <input type="number" name="thanh_tien" value="${lo.thanh_tien}" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        ${perm.canEditTienHang ? `<div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Số tiền hàng</label>
          <input type="number" name="so_tien_hang" value="${lo.so_tien_hang}" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>` : ''}
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Giảm giá</label>
          <input type="number" name="giam_gia" value="${lo.giam_gia}" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Người tạo</label>
          <select name="nguoi_tao" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn --</option>${nvTaoOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Người thu</label>
          <select name="nguoi_thu" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">-- Chọn --</option>${nvThuOptions}
          </select>
        </div>
        <div class="col-span-2 sm:col-span-3">
          <label class="block text-xs font-medium text-gray-600 mb-1">Lý do thiếu / Ghi chú</label>
          <input type="text" name="ly_do_thieu" value="${esc(lo.ly_do_thieu)}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        <div class="col-span-2 sm:col-span-3 flex gap-2">
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer">Lưu thay đổi</button>
          ${perm.canDelete ? `<button type="button" onclick="deleteLo('${esc(lo.id)}')" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm cursor-pointer">Xoá phiếu</button>` : ''}
        </div>
      </form>
    </div>`;
  }

  html += `<script>
  async function saveEdit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    body.so_kien = Number(body.so_kien) || 0;
    body.da_tra_hang = Number(body.da_tra_hang) || 0;
    body.don_gia = Number(body.don_gia) || 0;
    body.thanh_tien = Number(body.thanh_tien) || 0;
    body.so_tien_hang = Number(body.so_tien_hang) || 0;
    body.giam_gia = Number(body.giam_gia) || 0;
    const res = await fetch('/lo-hang/api/lo-hang/' + body.id, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
    return false;
  }
  async function deleteLo(id) {
    if (!confirm('Xoá phiếu ' + id + '?')) return;
    const res = await fetch('/lo-hang/api/lo-hang/' + id, { method: 'DELETE' });
    if (res.ok) { window.location.href = '/lo-hang'; } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
  }
  </script>`;

  return c.html(layout('Phiếu: ' + id, html, user, 'lo-hang'));
});

// ─── POST /api/lo-hang — Create ──────────────────────────────
loHangRoutes.post('/api/lo-hang', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    chuyen_xe_id: string;
    khach_hang_id: string;
    hang_id: string;
    so_kien: number;
    don_gia: number;
    tien_te: string;
    thanh_tien: number;
    so_tien_hang: number;
    giam_gia: number;
    nguoi_tao: string;
    nguoi_thu: string;
    ly_do_thieu: string;
  }>();

  // Generate ma
  let id: string;
  if (body.chuyen_xe_id) {
    // Count existing lo in this chuyen
    const countRes = await c.env.DB.prepare(
      `SELECT id FROM lo_hang WHERE chuyen_xe_id = ? ORDER BY id DESC LIMIT 1`
    ).bind(body.chuyen_xe_id).first<{id: string}>();

    let seq = 1;
    if (countRes?.id) {
      const parts = countRes.id.split('-');
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    id = `${body.chuyen_xe_id}-${String(seq).padStart(3, '0')}`;
  } else {
    // DK prefix
    const today = new Date();
    const dateStr = String(today.getFullYear()).slice(-2) +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const countRes = await c.env.DB.prepare(
      `SELECT id FROM lo_hang WHERE id LIKE ? ORDER BY id DESC LIMIT 1`
    ).bind(`DK${dateStr}-%`).first<{id: string}>();

    let seq = 1;
    if (countRes?.id) {
      const parts = countRes.id.split('-');
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    id = `DK${dateStr}-${String(seq).padStart(3, '0')}`;
  }

  await c.env.DB.prepare(
    `INSERT INTO lo_hang (id, chuyen_xe_id, khach_hang_id, hang_id, so_kien, da_tra_hang,
     ly_do_thieu, don_gia, tien_te, thanh_tien, so_tien_hang, giam_gia, nguoi_tao, nguoi_thu, tien_te_th)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.chuyen_xe_id || '',
    body.khach_hang_id,
    body.hang_id,
    body.so_kien || 0,
    0,
    body.ly_do_thieu || '',
    body.don_gia || 0,
    body.tien_te || 'PLN',
    body.thanh_tien || 0,
    body.so_tien_hang || 0,
    body.giam_gia || 0,
    body.nguoi_tao || '',
    body.nguoi_thu || '',
    body.tien_te || 'PLN'
  ).run();

  // Audit log
  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Tạo phiếu', ?, '')`
  ).bind(
    `AL-${Date.now()}`,
    user.role,
    user.display_name,
    id
  ).run();

  return c.json({ id }, 201);
});

// ─── PUT /api/lo-hang/:id — Update ───────────────────────────
loHangRoutes.put('/api/lo-hang/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    chuyen_xe_id: string;
    khach_hang_id: string;
    hang_id: string;
    so_kien: number;
    da_tra_hang: number;
    ly_do_thieu: string;
    don_gia: number;
    tien_te: string;
    thanh_tien: number;
    so_tien_hang: number;
    giam_gia: number;
    nguoi_tao: string;
    nguoi_thu: string;
  }>();

  await c.env.DB.prepare(
    `UPDATE lo_hang SET
      chuyen_xe_id=?, khach_hang_id=?, hang_id=?, so_kien=?, da_tra_hang=?,
      ly_do_thieu=?, don_gia=?, tien_te=?, thanh_tien=?, so_tien_hang=?,
      giam_gia=?, nguoi_tao=?, nguoi_thu=?,
      updated_at=datetime('now')
     WHERE id=?`
  ).bind(
    body.chuyen_xe_id || '',
    body.khach_hang_id,
    body.hang_id,
    body.so_kien || 0,
    body.da_tra_hang || 0,
    body.ly_do_thieu || '',
    body.don_gia || 0,
    body.tien_te || 'PLN',
    body.thanh_tien || 0,
    body.so_tien_hang || 0,
    body.giam_gia || 0,
    body.nguoi_tao || '',
    body.nguoi_thu || '',
    id
  ).run();

  // Audit log
  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Sửa phiếu', ?, ?)`
  ).bind(
    `AL-${Date.now()}`,
    user.role,
    user.display_name,
    id,
    `Sửa: so_kien=${body.so_kien}, don_gia=${body.don_gia}, thanh_tien=${body.thanh_tien}`
  ).run();

  return c.json({ success: true });
});

// ─── DELETE /api/lo-hang/:id — Delete ────────────────────────
loHangRoutes.delete('/api/lo-hang/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM lo_hang WHERE id=?').bind(id).run();

  // Audit log
  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Xoá phiếu', ?, '')`
  ).bind(
    `AL-${Date.now()}`,
    user.role,
    user.display_name,
    id
  ).run();

  return c.json({ success: true });
});

// ─── POST /api/lo-hang/bulk — Bulk Operations ────────────────
loHangRoutes.post('/api/lo-hang/bulk', async (c) => {
  const user = c.get('user');
  const { action, ids } = await c.req.json<{ action: string; ids: string[] }>();

  if (!ids || ids.length === 0) {
    return c.json({ error: 'No IDs provided' }, 400);
  }

  if (action === 'tra-hang') {
    // Set da_tra_hang = so_kien for each selected lo
    for (const id of ids) {
      const lo = await c.env.DB.prepare('SELECT so_kien FROM lo_hang WHERE id=?').bind(id).first<{so_kien: number}>();
      if (lo) {
        await c.env.DB.prepare('UPDATE lo_hang SET da_tra_hang=?, updated_at=datetime(\'now\') WHERE id=?')
          .bind(lo.so_kien, id).run();
      }
    }
    // Audit
    await c.env.DB.prepare(
      `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
       VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Bulk trả hàng', 'bulk', ?)`
    ).bind(
      `AL-${Date.now()}`,
      user.role,
      user.display_name,
      `${ids.length} phiếu: ${ids.join(', ')}`
    ).run();
    return c.json({ success: true, count: ids.length });
  }

  return c.json({ error: 'Unknown action' }, 400);
});

// ─── Import APIs ───────────────────────────────────────────────
async function loadImportContext(db: D1Database) {
  const [kh, hang, cty, tuyen, xe, chuyen] = await Promise.all([
    db.prepare('SELECT id, ma_kh, ten FROM khach_hang').all<KhRow>(),
    db.prepare('SELECT id, ten FROM hang').all<{ id: string; ten: string }>(),
    db.prepare('SELECT id, ten FROM cty_van_tai').all<{ id: string; ten: string }>(),
    db.prepare('SELECT id, ten, tien_to FROM tuyen').all<{ id: string; ten: string; tien_to: string }>(),
    db.prepare('SELECT id, so_xe, bien_so, tai_xe_id FROM xe').all<XeRow>(),
    db.prepare('SELECT id, xe_id, tuyen_id, ngay_di FROM chuyen_xe').all<ChuyenRow>(),
  ]);
  return {
    khachHang: kh.results || [],
    hang: hang.results || [],
    ctyVT: cty.results || [],
    tuyen: tuyen.results || [],
    xe: xe.results || [],
    chuyenXe: chuyen.results || [],
    loHangCountByKh: new Map<string, number>(),
  };
}

interface KhRow { id: string; ma_kh: string; ten: string }
interface XeRow { id: string; so_xe: string; bien_so: string; tai_xe_id: string }
interface ChuyenRow { id: string; xe_id: string; tuyen_id: string; ngay_di: string }

loHangRoutes.get('/api/import/template/:type', async (c) => {
  const user = c.get('user');
  const perm = loHangPerm(c.get('perms'));
  if (!perm.canCreateLo) return c.json({ error: 'Forbidden' }, 403);
  const type = c.req.param('type') as ImportType;
  if (!['kh', 'hang', 'cty', 'phieu'].includes(type)) return c.json({ error: 'Invalid type' }, 400);
  const tpl = csvTemplate(type);
  return new Response(tpl.content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${tpl.filename}"`,
    },
  });
});

loHangRoutes.post('/api/import/parse', async (c) => {
  const user = c.get('user');
  const perm = loHangPerm(c.get('perms'));
  if (!perm.canCreateLo) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ type: ImportType; text: string }>();
  const type = body.type;
  if (!type || !body.text) return c.json({ error: 'Thiếu type hoặc text' }, 400);

  const parsed = parseDelimitedText(body.text);
  if (parsed.rows.length === 0) return c.json({ error: 'Không có dòng dữ liệu' }, 400);

  const ctx = await loadImportContext(c.env.DB);
  const preview = buildImportPreview(type, parsed.rows, ctx);
  return c.json({ type, ...preview });
});

loHangRoutes.post('/api/import/confirm', async (c) => {
  const user = c.get('user');
  const perm = loHangPerm(c.get('perms'));
  if (!perm.canCreateLo) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{
    type: ImportType;
    valid: unknown[];
    newKHs?: NewKhDraft[];
    newHangs?: NewHangDraft[];
    newXes?: NewXeDraft[];
    newChuyens?: NewChuyenDraft[];
  }>();

  const db = c.env.DB;
  const now = new Date().toISOString();
  let imported = 0;

  if (body.type === 'kh') {
    for (const row of body.valid as { ten: string; nip?: string; dia_chi?: string; sdt?: string; han_tt?: number; ghi_chu?: string }[]) {
      const id = `KH-${Date.now()}-${imported}`;
      const maKh = `KH${String(imported + 1).padStart(4, '0')}`;
      await db.prepare(
        `INSERT OR IGNORE INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia, danh_gia_manual, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`
      ).bind(id, maKh, row.ten, row.nip || '', row.dia_chi || '', row.sdt || '', row.han_tt || 30, row.ghi_chu || '', now, now).run();
      imported++;
    }
  } else if (body.type === 'hang') {
    for (const row of body.valid as { ten: string; nuoc?: string; dia_chi?: string }[]) {
      const id = `H-${Date.now()}-${imported}`;
      await db.prepare(
        `INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, row.ten, row.nuoc || '', row.dia_chi || '', now, now).run();
      imported++;
    }
  } else if (body.type === 'cty') {
    for (const row of body.valid as { ten: string; dia_chi?: string; sdt?: string }[]) {
      const id = `CTY-${Date.now()}-${imported}`;
      await db.prepare(
        `INSERT OR IGNORE INTO cty_van_tai (id, ten, dia_chi, sdt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, row.ten, row.dia_chi || '', row.sdt || '', now, now).run();
      imported++;
    }
  } else if (body.type === 'phieu') {
    const khNameToId = new Map<string, string>();
    const hangNameToId = new Map<string, string>();
    const xeKeyToId = new Map<string, string>();

    const allKh = await db.prepare('SELECT id, ten FROM khach_hang').all<{ id: string; ten: string }>();
    for (const k of allKh.results || []) {
      khNameToId.set(k.ten.trim().toLowerCase().replace(/\s+/g, ' '), k.id);
    }

    for (const kh of body.newKHs || []) {
      if (kh.checked === false) continue;
      const id = `KH-${Date.now()}-${imported}`;
      const maKh = `IMP${String(imported + 1).padStart(4, '0')}`;
      await db.prepare(
        `INSERT OR IGNORE INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia, danh_gia_manual, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?)`
      ).bind(id, maKh, kh.ten, kh.nip || '', kh.dia_chi || '', kh.sdt || '', kh.han_tt || 30, now, now).run();
      khNameToId.set(kh.ten.trim().toLowerCase().replace(/\s+/g, ' '), id);
      imported++;
    }

    const allHang = await db.prepare('SELECT id, ten FROM hang').all<{ id: string; ten: string }>();
    for (const h of allHang.results || []) {
      hangNameToId.set(h.ten.trim().toLowerCase().replace(/\s+/g, ' '), h.id);
    }
    for (const h of body.newHangs || []) {
      if (h.checked === false) continue;
      const id = `H-${Date.now()}-${imported}`;
      await db.prepare(
        `INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, h.ten, h.nuoc || '', h.dia_chi || '', now, now).run();
      hangNameToId.set(h.ten.trim().toLowerCase().replace(/\s+/g, ' '), id);
      imported++;
    }

    for (const x of body.newXes || []) {
      if (x.checked === false) continue;
      const id = x.so_xe.replace(/\s+/g, '-').slice(0, 20) || `XE-${imported}`;
      await db.prepare(
        `INSERT OR IGNORE INTO xe (id, bien_so, so_xe, loai_xe, trong_tai, tai_xe_id, created_at, updated_at)
         VALUES (?, ?, ?, '', 0, '', ?, ?)`
      ).bind(id, x.bien_so || x.so_xe, x.so_xe, now, now).run();
      xeKeyToId.set(x.so_xe.trim().toLowerCase().replace(/\s+/g, ' '), id);
    }

    for (const ch of body.newChuyens || []) {
      const xeKey = (ch.so_xe || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const xeId = ch.xe_id || (xeKey ? xeKeyToId.get(xeKey) : '') || '';
      if (!xeId || !ch.tuyen_id) continue;
      await db.prepare(
        `INSERT OR IGNORE INTO chuyen_xe (id, tuyen_id, xe_id, tai_xe_id, ngay_di, ngay_den, trang_thai, ghi_chu, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'planned', '', ?, ?)`
      ).bind(ch.id, ch.tuyen_id, xeId, ch.tai_xe_id || '', ch.ngay_di, ch.ngay_den || ch.ngay_di, now, now).run();
    }

    for (const p of body.valid as PhieuDraft[]) {
      let khId = p.khach_hang_id;
      let hangId = p.hang_id;
      if (p._khTen) khId = khNameToId.get(p._khTen.trim().toLowerCase().replace(/\s+/g, ' ')) || khId;
      if (p._hangTen) hangId = hangNameToId.get(p._hangTen.trim().toLowerCase().replace(/\s+/g, ' ')) || hangId;
      if (!khId || !hangId) continue;

      let loId: string;
      if (p.chuyen_xe_id) {
        const last = await db.prepare(
          'SELECT id FROM lo_hang WHERE chuyen_xe_id = ? ORDER BY id DESC LIMIT 1'
        ).bind(p.chuyen_xe_id).first<{ id: string }>();
        let seq = 1;
        if (last?.id) {
          const parts = last.id.split('-');
          seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
        }
        loId = `${p.chuyen_xe_id}-${String(seq).padStart(3, '0')}`;
      } else {
        const today = new Date();
        const ds = String(today.getFullYear()).slice(-2) +
          String(today.getMonth() + 1).padStart(2, '0') +
          String(today.getDate()).padStart(2, '0');
        loId = `DK${ds}-${String(imported + 1).padStart(3, '0')}`;
      }

      await db.prepare(
        `INSERT OR IGNORE INTO lo_hang (id, chuyen_xe_id, khach_hang_id, hang_id, so_kien, da_tra_hang,
         ly_do_thieu, don_gia, tien_te, thanh_tien, so_tien_hang, giam_gia, nguoi_tao, nguoi_thu, tien_te_th, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        loId,
        p.chuyen_xe_id || '',
        khId,
        hangId,
        p.so_kien,
        p.da_tra_hang,
        p.ly_do_thieu || '',
        p.don_gia,
        p.tien_te || 'PLN',
        p.thanh_tien,
        p.so_tien_hang,
        p.giam_gia || 0,
        p.nguoi_tao || '',
        p.nguoi_thu || '',
        p.tien_te_th || p.tien_te || 'PLN',
        now,
        now,
      ).run();
      imported++;
    }
  } else {
    return c.json({ error: 'Invalid type' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Import', ?, ?)`
  ).bind(
    `AL-${Date.now()}`,
    user.role,
    user.display_name,
    body.type,
    `${imported} bản ghi`,
  ).run();

  return c.json({ success: true, imported });
});

// ─── Helper: build grid URL preserving params ─────────────────
function buildGridUrl(c: { req: { url: string } }, overrides: Record<string, string>): string {
  const url = new URL(c.req.url);
  const params = new URLSearchParams(url.search);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '') params.delete(k);
    else params.set(k, v);
  }
  return `${url.pathname}?${params.toString()}`;
}

function buildFilterUrl(c: { req: { url: string } }, col: string): string {
  // Build a URL that sets fc/fv but we can't resolve the value server-side without knowing which lo
  // This creates a filter page URL; actual filtering requires clicking a value in the dropdown
  // For column headers, link to same page with fc=col (will show filter UI via JS or just set the param)
  return buildGridUrl(c, { fc: col });
}

function tuyenColor(mau: string | null | undefined): string {
  switch(mau) {
    case 'red': return '#fee2e2';
    case 'blue': return '#dbeafe';
    case 'green': return '#dcfce7';
    case 'yellow': return '#fef3c7';
    case 'purple': return '#f3e8ff';
    case 'orange': return '#ffedd5';
    default: return '#f3f4f6';
  }
}

function kpiCard(label: string, value: string, sub: string, color: string): string {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
    red: 'bg-red-50 border-red-200',
  };
  const cls = bgMap[color] || 'bg-gray-50 border-gray-200';
  return `<div class="rounded-lg border ${cls} p-3">
    <div class="text-xs text-gray-500 mb-1">${label}</div>
    <div class="text-lg font-bold">${value}</div>
    ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
  </div>`;
}

function infoRow(key: string, val: string): string {
  return `<div class="flex justify-between py-1 border-b border-gray-50">
    <span class="text-gray-500">${key}</span>
    <span class="text-gray-900">${val}</span>
  </div>`;
}
