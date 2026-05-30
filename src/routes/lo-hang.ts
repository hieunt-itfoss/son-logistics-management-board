import { Hono } from 'hono';
import type { Env, Role, AppVariables } from '../types';
import { DM_GROUP_LABEL, type DauMucGroup } from '../types';
import type { EffectivePerms } from '../utils/permissions';
import { layout } from '../utils/layout';
import {
  modalShell,
  modalFooterInner,
  btnModalChip,
  btnSecondary,
  btnModalOutline,
  searchField,
  formField,
  input,
  select,
  FILTER_LABEL_CLASS,
} from '../utils/ui';
import {
  parseDelimitedText,
  parseExcelBase64,
  buildImportPreview,
  excelTemplate,
  VIRTUAL_XE_ID,
  type ImportType,
  type PhieuDraft,
  type NewKhDraft,
  type NewHangDraft,
  type NewXeDraft,
  type NewChuyenDraft,
} from '../utils/import-data';
import { khongDau } from '../utils';

export const loHangRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Accent-stripping map for SQL expressions (SQLite has no unaccent).
// Nested lower() + replace() matches diacritic-insensitive text in WHERE clauses.
const ACCENT_MAP: [string, string][] = [
  ['à','a'],['á','a'],['ả','a'],['ã','a'],['ạ','a'],['ă','a'],['ằ','a'],['ắ','a'],['ẳ','a'],['ẵ','a'],['ặ','a'],
  ['â','a'],['ầ','a'],['ấ','a'],['ẩ','a'],['ẫ','a'],['ậ','a'],
  ['è','e'],['é','e'],['ẻ','e'],['ẽ','e'],['ẹ','e'],['ê','e'],['ề','e'],['ế','e'],['ể','e'],['ễ','e'],['ệ','e'],
  ['ì','i'],['í','i'],['ỉ','i'],['ĩ','i'],['ị','i'],
  ['ò','o'],['ó','o'],['ỏ','o'],['õ','o'],['ọ','o'],['ô','o'],['ồ','o'],['ố','o'],['ổ','o'],['ỗ','o'],['ộ','o'],
  ['ơ','o'],['ờ','o'],['ớ','o'],['ở','o'],['ỡ','o'],['ợ','o'],
  ['ù','u'],['ú','u'],['ủ','u'],['ũ','u'],['ụ','u'],['ư','u'],['ừ','u'],['ứ','u'],['ử','u'],['ữ','u'],['ự','u'],
  ['ỳ','y'],['ý','y'],['ỷ','y'],['ỹ','y'],['ỵ','y'],
  ['đ','d'],['ł','l'],
];

// Wrap a column in diacritic-stripping + lower(). e.g. unaccentSql('kh.ten')
function unaccentSql(col: string): string {
  let expr = `lower(${col})`;
  for (const [from, to] of ACCENT_MAP) {
    expr = `replace(${expr},'${from}','${to}')`;
  }
  return expr;
}

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
  tuyen_id: string;
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
    cx.ngay_di, cx.ngay_den, cx.tai_xe_id, cx.tuyen_id,
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

  // Column filter — supports multiple columns at once.
  // Source: 'filters' param (JSON [{c,v}]) + legacy fc/fv pair (backward compatible).
  const activeFilters: { c: string; v: string }[] = [];
  const filtersParam = c.req.query('filters') || '';
  if (filtersParam) {
    try {
      const arr = JSON.parse(filtersParam);
      if (Array.isArray(arr)) {
        for (const f of arr) {
          if (f && f.c && f.v != null && f.v !== '') activeFilters.push({ c: String(f.c), v: String(f.v) });
        }
      }
    } catch { /* ignore invalid filters JSON */ }
  }
  if (filterCol && filterVal && !activeFilters.some((f) => f.c === filterCol)) {
    activeFilters.push({ c: filterCol, v: filterVal });
  }

  const colToSql: Record<string, string> = {
    nguoiNhan: 'lh.khach_hang_id = ?',
    nguoiGui: 'lh.hang_id = ?',
    soXe: 'x.so_xe = ?',
    bienSo: 'x.bien_so = ?',
    tuyenVT: 'cx.tuyen_id = ?',
    ngayLenXe: 'cx.ngay_di = ?',
    ngayVe: 'cx.ngay_den = ?',
    nguoiTao: 'lh.nguoi_tao = ?',
    nguoiThu: 'lh.nguoi_thu = ?',
    ma: 'lh.chuyen_xe_id = ?',
  };
  for (const f of activeFilters) {
    const sql = colToSql[f.c];
    if (sql) {
      conditions.push(sql);
      params.push(f.v);
    }
  }

  // Free text search: apply unaccentSql in SQL for diacritic-insensitive matching
  // (works correctly with LIMIT/pagination when added later).
  if (freeSearch) {
    const needle = `%${khongDau(freeSearch)}%`;
    const cols = ['lh.id','kh.ten','kh.ma_kh','h.ten','x.so_xe','x.bien_so','t.ten','lh.ly_do_thieu','cx.id'];
    conditions.push('(' + cols.map(col => `${unaccentSql(col)} LIKE ?`).join(' OR ') + ')');
    for (let i = 0; i < cols.length; i++) params.push(needle);
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

  // Default: collapse all chuyen groups except the newest; persist in query param so toggles work
  const defaultCollapsed = collapsed.size === 0 && chuyenIds.length > 1;
  if (defaultCollapsed) {
    chuyenIds.forEach((cid, i) => {
      if (cid !== '_NO_CHUYEN_' && i > 0) collapsed.add(cid);
    });
  }
  const collapsedParamEffective = Array.from(collapsed).join(',');

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

  // Filter chip display (multi-filter)
  const resolveFilterDisplay = (col: string, val: string): string => {
    if (col === 'nguoiNhan') {
      const kh = (khRes.results as { id: string; ten: string }[]).find((k) => k.id === val);
      return kh ? kh.ten : val;
    } else if (col === 'nguoiGui') {
      const ha = (hangRes.results as { id: string; ten: string }[]).find((h) => h.id === val);
      return ha ? ha.ten : val;
    } else if (col === 'ngayLenXe' || col === 'ngayVe') {
      return fmtDate(val);
    }
    return val;
  };
  const filterChips: string[] = [];
  activeFilters.forEach((f, idx) => {
    const def = COL_DEFS[f.c as ColKey];
    const displayVal = resolveFilterDisplay(f.c, f.v);
    // Remove this filter, keep the rest
    const remain = activeFilters.filter((_, i) => i !== idx);
    const remainUrl = buildGridUrl(c, { fc: '', fv: '', filters: remain.length ? JSON.stringify(remain) : '' });
    filterChips.push(`
      <span class="htql-chip">
        <strong>${def?.label || f.c}:</strong> ${esc(displayVal)}
        <a href="${remainUrl}" class="htql-chip-remove">&times;</a>
      </span>
    `);
  });

  // ─── Build HTML ────────────────────────────────────────────
  let html = '<div class="htql-dt" data-htql-dt>';

  // Bulk action bar — light green background, hidden until rows are selected
  html += `<div id="bulkBar" class="hidden htql-bulkbar">
    <label class="flex items-center gap-2 font-semibold mr-2 cursor-pointer">
      <input type="checkbox" id="bulkBarChk" class="rounded border-success" checked>
      <span id="bulkCount">0 phiếu đã chọn:</span>
    </label>
    <button onclick="bulkAction('tra-hang')" class="htql-bulk-btn">📦 Đã trả hàng tất cả</button>
    <button onclick="bulkThanhToan()" class="htql-bulk-btn">💰 Đã thanh toán</button>
    <button onclick="bulkGanNguoiThu()" class="htql-bulk-btn">👤 Gán người thu</button>
    <button onclick="bulkGanChuyen()" class="htql-bulk-btn">🚚 Lên xe (gán chuyến)</button>
    <button onclick="bulkChuyenDaVe()" class="htql-bulk-btn">📅 Đã về (set ngày về)</button>
    <button onclick="bulkAction('duplicate')" class="htql-bulk-btn">📋 Sao chép</button>
    <button onclick="bulkExportCsv()" class="htql-bulk-btn">⬇ Export CSV</button>
    <button onclick="bulkAction('print')" class="htql-bulk-btn">🏷 In nhãn</button>
    <button onclick="bulkAction('delete')" class="htql-bulk-btn htql-bulk-danger">🗑 Xoá</button>
    <button onclick="clearSelection()" class="htql-bulk-btn ml-auto">✕ Bỏ chọn tất cả</button>
  </div>
  <style>
    .htql-bulkbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#e7f6ec;border:1px solid #b7e4c7;color:#1a7440;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:13px}
    .dark .htql-bulkbar{background:#10271b;border-color:#1f5135;color:#7ee2a8}
    .htql-bulk-btn{border:1px solid #b7e4c7;color:#1a7440;background:#fff;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer}
    .htql-bulk-btn:hover{background:#d7f0e0}
    .dark .htql-bulk-btn{background:#0d1f15;border-color:#1f5135;color:#7ee2a8}
    .htql-bulk-danger{border-color:#f2b8b5;color:#c0392b}
    .htql-bulk-danger:hover{background:#fde8e6}
  </style>`;

  // Toolbar
  html += '<div class="htql-dt-toolbar">';
  if (perm.canCreateLo) {
    html += `<a href="/lo-hang/create" class="btn flex items-center gap-1.5 cursor-pointer text-sm">
      <iconify-icon icon="solar:add-circle-linear"></iconify-icon> Phiếu mới
    </a>`;
    html += `<button type="button" onclick="openImportModal()" class="htql-dt-btn">
      <iconify-icon icon="solar:import-linear"></iconify-icon> Import
    </button>`;
  }
  html += `<form method="GET" action="/lo-hang" class="flex flex-wrap items-center gap-2" id="filterForm">`;
  html += `<input type="hidden" name="fc" value="${esc(filterCol)}">`;
  html += `<input type="hidden" name="fv" value="${esc(filterVal)}">`;
  html += `<input type="hidden" name="filters" value="${esc(filtersParam)}">`;
  html += `<input type="hidden" name="hide" value="${esc(hiddenCols)}">`;
  html += `<input type="hidden" name="collapsed" value="${esc(collapsedParamEffective)}">`;

  html += select({ name: 'range', onchange: 'this.form.submit()', class: 'w-auto', options: `
    <option value="today" ${filterRange==='today'?'selected':''}>Hôm nay</option>
    <option value="thisWeek" ${filterRange==='thisWeek'?'selected':''}>Tuần này</option>
    <option value="thisMonth" ${filterRange==='thisMonth'?'selected':''}>Tháng này</option>
    <option value="custom" ${filterRange==='custom'?'selected':''}>Tùy chọn</option>
    <option value="all" ${filterRange==='all'?'selected':''}>Tất cả</option>
  ` });

  if (filterRange === 'custom') {
    html += input({ type: 'date', name: 'from', value: esc(customFrom), onchange: 'this.form.submit()', class: 'w-auto' });
    html += `<span class="text-bodytext dark:text-darklink text-sm">\u2192</span>`;
    html += input({ type: 'date', name: 'to', value: esc(customTo), onchange: 'this.form.submit()', class: 'w-auto' });
  }

  html += searchField({ value: freeSearch, placeholder: 'Tìm mã, khách, hãng, xe, tuyến...', auto: true });
  html += `</form>`;

  html += `<button onclick="document.getElementById('colTogglePanel').classList.toggle('hidden')" class="htql-dt-btn">
  <iconify-icon icon="solar:settings-linear"></iconify-icon> Cột (${cols.length}/${ALL_COLS.length})
  </button>`;

  html += `<span class="htql-chip">
    <iconify-icon icon="solar:sort-from-top-to-bottom-linear"></iconify-icon> Group: Chuyến
  </span>`;

  html += `</div>`;

  // Filter chips
  if (filterChips.length > 0) {
    html += `<div class="htql-dt-chips">`;
    html += `<span class="text-xs text-bodytext dark:text-darklink">Bộ lọc:</span>`;
    filterChips.forEach(chip => html += chip);
    html += `<a href="/lo-hang?range=${filterRange}" class="text-xs text-error hover:underline">Xoá tất cả</a>`;
    html += `</div>`;
  }

  // Column visibility panel (hidden by default)
  const permCols: ColKey[] = perm.loCols === 'all' ? [...ALL_COLS] : [...perm.loCols];
  html += `<div id="colTogglePanel" class="hidden htql-dt-col-panel">
    <div class="text-xs font-semibold text-dark dark:text-white mb-2">Hiển thị cột:</div>
    <form method="GET" action="/lo-hang" class="flex flex-wrap gap-3" id="colForm">
      <input type="hidden" name="range" value="${esc(filterRange)}">
      <input type="hidden" name="q" value="${esc(freeSearch)}">
      <input type="hidden" name="fc" value="${esc(filterCol)}">
      <input type="hidden" name="fv" value="${esc(filterVal)}">
      <input type="hidden" name="collapsed" value="${esc(collapsedParamEffective)}">`;
  permCols.forEach(col => {
    const def = COL_DEFS[col];
    const checked = cols.includes(col);
    html += `<label class="flex items-center gap-1 text-xs text-dark dark:text-darklink cursor-pointer">
      <input type="checkbox" name="hide_check" value="${col}" ${checked ? 'checked' : ''} class="rounded border-bordergray"> ${def?.label || col}
    </label>`;
  });
  html += `<button type="submit" class="btn text-xs px-3 py-1" id="colToggleSubmit">Áp dụng</button>
    </form>
  </div>`;

  // Grid table
  const totalColspan = 2 + cols.length + (perm.canEdit ? 1 : 0);
  html += `<div class="htql-dt-scroll"><table>`;
  html += `<thead>`;

  // Group header row
  html += `<tr>`;
  html += `<th style="width:28px"></th>`;
  html += `<th style="width:32px">
    <div class="htql-dt-th-inner" style="justify-content:center"><input type="checkbox" id="selectAll" class="rounded border-bordergray" title="Chọn tất cả"></div>
  </th>`;
  if (visibleByGroup.info.length)
    html += `<th class="text-center" colspan="${visibleByGroup.info.length}"><div class="htql-dt-th-inner" style="justify-content:center">Thông tin chung</div></th>`;
  if (visibleByGroup.hang.length)
    html += `<th class="htql-col-hang text-center" colspan="${visibleByGroup.hang.length}"><div class="htql-dt-th-inner" style="justify-content:center;color:#7c3aed">Nhóm HÀNG</div></th>`;
  if (visibleByGroup.money.length)
    html += `<th class="htql-col-money text-center" colspan="${visibleByGroup.money.length}"><div class="htql-dt-th-inner" style="justify-content:center;color:#16a34a">Nhóm TIỀN</div></th>`;
  if (perm.canEdit) html += `<th style="width:50px"><div class="htql-dt-th-inner">Công cụ</div></th>`;
  html += `</tr>`;

  // Column header row (sortable)
  html += `<tr class="htql-dt-header-row">`;
  html += `<th style="width:28px"></th>`;
  html += `<th style="width:32px"></th>`;
  cols.forEach((col, colIdx) => {
    const def = COL_DEFS[col];
    const isHang = def?.group === 'hang';
    const isMoney = def?.group === 'money';
    const groupCls = isHang ? ' htql-col-hang' : isMoney ? ' htql-col-money' : '';
    const isActiveFilterCol = activeFilters.some((f) => f.c === col);
    const hasFilter = isActiveFilterCol ? ' style="outline:2px solid var(--primary);outline-offset:-2px"' : '';
    const sortable = true;
    const filterLink = def?.filterable
      ? ` <a href="javascript:void(0)" onclick="htqlOpenColFilter('${col}', event)" class="text-primary hover:opacity-70 no-underline" title="Lọc theo ${def?.label}" style="font-size:10px">&#9662;</a>`
      : '';
    html += `<th class="${sortable ? 'htql-dt-sortable' : ''}${groupCls}"${hasFilter} data-col="${col}">`;
    html += `<div class="htql-dt-th-inner">${def?.label || col}${filterLink}`;
    if (sortable) html += ` <iconify-icon icon="solar:sort-vertical-linear" class="htql-dt-sort-icon" width="14"></iconify-icon>`;
    html += `</div></th>`;
  });
  if (perm.canEdit) html += `<th></th>`;
  html += `</tr>`;

  html += `</thead><tbody>`;

  // Group rows and data rows
  chuyenIds.forEach(chuyenId => {
    const isNoChuyen = chuyenId === '_NO_CHUYEN_';
    const chLots = byChuyen.get(chuyenId) || [];
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
      const arr = Object.entries(m).filter(([, v]) => v > 0).map(([t, v]) => `${fmtNum(v)} <span class="text-xs text-bodytext dark:text-darklink">${t}</span>`);
      return arr.length ? arr.join('<br>') : '\u2014';
    };

    const isCollapsed = collapsed.has(chuyenId);
    const toggleIcon = isCollapsed ? '&#9654;' : '&#9660;';
    const toggleTitle = isCollapsed ? 'Mở' : 'Thu gọn';

    const firstLo = chLots[0];

    html += `<tr class="htql-dt-group-row cursor-pointer" data-group-id="${esc(chuyenId)}" data-collapsed="${isCollapsed ? 'true' : 'false'}" aria-expanded="${isCollapsed ? 'false' : 'true'}">`;
    html += `<td class="text-center"><span class="htql-dt-group-toggle text-bodytext dark:text-darklink" title="${toggleTitle}" aria-hidden="true">${toggleIcon}</span></td>`;
    html += `<td class="text-center"><input type="checkbox" class="rounded border-bordergray group-check" data-chuyen="${esc(chuyenId)}" title="Chọn tất cả trong chuyến"></td>`;
    cols.forEach(col => {
      const def = COL_DEFS[col];
      const isHang = def?.group === 'hang';
      const isMoney = def?.group === 'money';
      const tdCls = isHang ? ' htql-col-hang' : isMoney ? ' htql-col-money' : '';
      let v = '';
      if (col === 'ma') v = isNoChuyen ? `<strong class="text-warning">Chưa chuyến (${chLots.length})</strong>` : `<strong>${esc(chuyenId)}</strong>`;
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
      html += `<td class="text-xs${tdCls}">${v}</td>`;
    });
    if (perm.canEdit) html += `<td></td>`;
    html += `</tr>`;

    chLots.forEach(lo => {
        const luuKho = lo.so_kien - lo.da_tra_hang;
        const childHiddenCls = isCollapsed ? ' htql-dt-child-hidden' : '';
        html += `<tr class="lo-row${childHiddenCls}" data-lo-id="${esc(lo.id)}" data-group="${esc(chuyenId)}">`;
        html += `<td></td>`;
        html += `<td class="text-center"><input type="checkbox" class="rounded border-bordergray lo-check" value="${esc(lo.id)}"></td>`;
        cols.forEach(col => {
          const def = COL_DEFS[col];
          const isHang = def?.group === 'hang';
          const isMoney = def?.group === 'money';
          const tdCls = isHang ? ' htql-col-hang' : isMoney ? ' htql-col-money' : '';
          const isNum = def?.cls?.includes('num') ?? false;
          const align = isNum ? ' text-right' : '';
          let v = '';
          let sortVal = '';
          switch(col) {
            case 'ma':
              v = `<a href="/lo-hang/${esc(lo.id)}" class="text-primary hover:underline font-medium">${esc(lo.id)}</a>`;
              if (lo.so_kien === 0) v += ` <span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-lightwarning text-warning">tiền only</span>`;
              sortVal = lo.id;
              break;
            case 'ngayLenXe':
              v = lo.ngay_di ? `<a href="${buildGridUrl(c,{fc:'ngayLenXe',fv:lo.ngay_di})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${fmtDate(lo.ngay_di)}</a>` : '<span class="text-warning">\u2014 (chưa)</span>';
              sortVal = lo.ngay_di || '';
              break;
            case 'ngayVe':
              v = lo.ngay_den ? `<a href="${buildGridUrl(c,{fc:'ngayVe',fv:lo.ngay_den})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${fmtDate(lo.ngay_den)}</a>` : '<span class="text-warning">\u2014 (chưa)</span>';
              sortVal = lo.ngay_den || '';
              break;
            case 'soXe':
              v = lo.so_xe ? `<a href="${buildGridUrl(c,{fc:'soXe',fv:lo.so_xe})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${esc(lo.so_xe)}</a>` : '<span class="text-bodytext dark:text-darklink">\u2014</span>';
              sortVal = lo.so_xe || '';
              break;
            case 'bienSo':
              v = lo.bien_so ? `<a href="${buildGridUrl(c,{fc:'bienSo',fv:lo.bien_so})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${esc(lo.bien_so)}</a>` : '<span class="text-bodytext dark:text-darklink">\u2014</span>';
              sortVal = lo.bien_so || '';
              break;
            case 'tuyenVT':
              v = lo.tuyen_ten ? `<a href="${buildGridUrl(c,{fc:'tuyenVT',fv:lo.chuyen_xe_id ? '' : ''})}" class="no-underline"><span class="inline-block px-2 py-0.5 rounded text-xs font-medium" style="background:${tuyenColor(lo.tuyen_mau)}">${esc(lo.tuyen_ten)}</span></a>` : '';
              sortVal = lo.tuyen_ten || '';
              break;
            case 'nguoiGui':
              v = lo.hang_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiGui',fv:lo.hang_id})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${esc(lo.hang_ten)}</a>` : '';
              sortVal = lo.hang_ten || '';
              break;
            case 'nguoiNhan':
              v = lo.khach_hang_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiNhan',fv:lo.khach_hang_id})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${esc(lo.khach_hang_ten)}</a>` : '';
              sortVal = lo.khach_hang_ten || '';
              break;
            case 'nguoiTao':
              v = lo.nguoi_tao_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiTao',fv:lo.nguoi_tao})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${esc(lo.nguoi_tao_ten)}</a>` : '\u2014';
              sortVal = lo.nguoi_tao_ten || '';
              break;
            case 'nguoiThu':
              v = lo.nguoi_thu_ten ? `<a href="${buildGridUrl(c,{fc:'nguoiThu',fv:lo.nguoi_thu})}" class="text-dark dark:text-darklink hover:text-primary no-underline">${esc(lo.nguoi_thu_ten)}</a>` : '\u2014';
              sortVal = lo.nguoi_thu_ten || '';
              break;
            case 'soKien':
              v = fmtNum(lo.so_kien);
              sortVal = String(lo.so_kien);
              break;
            case 'daTraHang':
              v = lo.da_tra_hang < lo.so_kien
                ? `<span class="text-warning">${fmtNum(lo.da_tra_hang)}</span>`
                : fmtNum(lo.da_tra_hang);
              sortVal = String(lo.da_tra_hang);
              break;
            case 'luuKho':
              v = luuKho > 0
                ? `<span style="color:#7c3aed">${fmtNum(luuKho)}</span>`
                : `<span class="text-bodytext dark:text-darklink">0</span>`;
              sortVal = String(luuKho);
              break;
            case 'ghiChu':
              v = lo.ly_do_thieu ? `<span class="text-xs">${esc(lo.ly_do_thieu)}</span>` : '\u2014';
              sortVal = lo.ly_do_thieu || '';
              break;
            case 'donGia':
              v = lo.don_gia > 0
                ? `${fmtNum(lo.don_gia)} <span class="text-xs text-bodytext dark:text-darklink">${esc(lo.tien_te)}</span>`
                : '<span class="text-bodytext dark:text-darklink italic">tổng</span>';
              sortVal = String(lo.don_gia);
              break;
            case 'thanhTien':
              v = `${fmtNum(lo.thanh_tien)} <span class="text-xs text-bodytext dark:text-darklink">${esc(lo.tien_te)}</span>`;
              sortVal = String(lo.thanh_tien);
              break;
            case 'soTienHang':
              v = (lo.so_tien_hang > 0)
                ? `${fmtNum(lo.so_tien_hang)} <span class="text-xs text-bodytext dark:text-darklink">${esc(lo.tien_te_th || lo.tien_te)}</span>`
                : '\u2014';
              sortVal = String(lo.so_tien_hang || 0);
              break;
          }
          // Filter value (must match server-side colToSql)
          let fval = '';
          switch (col) {
            case 'nguoiNhan': fval = String(lo.khach_hang_id || ''); break;
            case 'nguoiGui': fval = String(lo.hang_id || ''); break;
            case 'soXe': fval = String(lo.so_xe || ''); break;
            case 'bienSo': fval = String(lo.bien_so || ''); break;
            case 'tuyenVT': fval = String(lo.tuyen_id || ''); break;
            case 'ngayLenXe': fval = String(lo.ngay_di || ''); break;
            case 'ngayVe': fval = String(lo.ngay_den || ''); break;
            case 'nguoiTao': fval = String(lo.nguoi_tao || ''); break;
            case 'nguoiThu': fval = String(lo.nguoi_thu || ''); break;
            case 'ma': fval = String(lo.chuyen_xe_id || ''); break;
          }
          const fAttr = (COL_DEFS[col]?.filterable && fval) ? ` data-col="${col}" data-fval="${esc(fval)}"` : '';
          html += `<td class="text-xs${tdCls}${align}"${sortVal ? ` data-sort="${esc(sortVal)}"` : ''}${fAttr}>${v}</td>`;
        });
        if (perm.canEdit) {
          html += `<td class="text-xs">
            <a href="/lo-hang/${esc(lo.id)}" class="htql-table-action htql-table-action--edit" title="Sửa">
              <iconify-icon icon="solar:pen-linear" width="16"></iconify-icon>
            </a>
          </td>`;
        }
        html += `</tr>`;
      });
  });

  if (lots.length === 0) {
    html += `<tr><td colspan="${totalColspan}" class="htql-dt-empty">Chưa có phiếu nào</td></tr>`;
  }

  // Totals row
  html += `<tr class="htql-dt-totals">`;
  html += `<td style="width:28px"><iconify-icon icon="solar:chart-2-bold-duotone" width="14"></iconify-icon></td>`;
  html += `<td style="width:32px"></td>`;
  cols.forEach(col => {
    const def = COL_DEFS[col];
    const isNum = def?.cls?.includes('num') ?? false;
    let v = '';
    if (col === 'soKien') v = `<strong>${fmtNum(totalSoKien)}</strong>`;
    else if (col === 'daTraHang') v = `<strong>${fmtNum(totalDaTra)}</strong>`;
    else if (col === 'luuKho') v = totalLuuKho > 0 ? `<strong style="color:#7c3aed">${fmtNum(totalLuuKho)}</strong>` : '0';
    else if (col === 'thanhTien') v = `<strong style="color:#16a34a">${fmtCcy('thanhTien')}</strong>`;
    else if (col === 'soTienHang') v = `<strong>${fmtCcy('soTienHang')}</strong>`;
    else if (col === 'ma') v = `<span class="text-bodytext dark:text-darklink font-normal">Tổng ${lots.length} phiếu:</span>`;
    html += `<td class="text-xs" style="text-align:${isNum?'right':'left'}">${v}</td>`;
  });
  if (perm.canEdit) html += `<td></td>`;
  html += `</tr>`;

  html += `</tbody></table></div>`;

  // Footer
  html += `<div class="htql-dt-footer">
    <span>${chuyenIds.length} chuyến \u00B7 ${lots.length} phiếu \u00B7 <strong>${rangeLabel(filterRange)}</strong></span>
    <span>Vai trò: <strong>${user.display_name} (${role})</strong></span>
  </div>`;

  html += `</div>`;

  // Bulk bar is rendered above the toolbar (#bulkBar)

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
      const bc = document.getElementById('bulkBarChk'); if (bc) bc.checked = true;
    } else {
      bar.classList.add('hidden');
    }
  }

  // Bulk bar master checkbox: uncheck clears all selections
  document.getElementById('bulkBarChk')?.addEventListener('change', function() {
    if (!this.checked) clearSelection();
  });

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
    if (action === 'print') {
      // Print labels: open print window for selected receipts
      const rows = ids.map(id => '<div style="border:1px solid #000;padding:8px;margin:4px;font:13px monospace">' + id + '</div>').join('');
      const w = window.open('', '_blank');
      w.document.write('<h3>Nhãn ' + ids.length + ' phiếu</h3>' + rows);
      w.document.close(); w.focus(); w.print();
      return;
    }
    let confirmMsg = '';
    if (action === 'tra-hang') confirmMsg = 'Đánh dấu đã trả hàng cho ' + ids.length + ' phiếu?';
    else if (action === 'duplicate') confirmMsg = 'Sao chép ' + ids.length + ' phiếu?';
    else if (action === 'delete') confirmMsg = 'XOÁ ' + ids.length + ' phiếu? Không thể hoàn tác.';
    if (confirmMsg && !confirm(confirmMsg)) return;
    const res = await fetch('/lo-hang/api/lo-hang/bulk', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action, ids })
    });
    if (res.ok) { location.reload(); } else { const err = await res.json(); alert(err.error || 'Lỗi'); }
  }

  function bulkSelectedIds() {
    return Array.from(document.querySelectorAll('.lo-check:checked')).map(cb => cb.value);
  }

  async function bulkGanNguoiThu() {
    const ids = bulkSelectedIds(); if (!ids.length) return;
    const nguoiThu = prompt('Nhập tên người thu cho ' + ids.length + ' phiếu:');
    if (nguoiThu === null) return;
    const res = await fetch('/lo-hang/api/lo-hang/bulk', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'gan-nguoi-thu', ids, nguoiThu })
    });
    if (res.ok) location.reload(); else alert((await res.json()).error || 'Lỗi');
  }

  async function bulkGanChuyen() {
    const ids = bulkSelectedIds(); if (!ids.length) return;
    const chuyenId = prompt('Nhập MÃ CHUYẾN đích để gán ' + ids.length + ' phiếu vào (vd: W260526-50).\\nPhiếu đang ở nhóm chờ xe (CX) sẽ tự đổi mã sang chuyến này:');
    if (!chuyenId) return;
    const res = await fetch('/lo-hang/api/lo-hang/bulk', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'gan-chuyen', ids, chuyenXeId: chuyenId.trim() })
    });
    if (res.ok) location.reload(); else alert((await res.json()).error || 'Lỗi');
  }

  function bulkExportCsv() {
    const ids = bulkSelectedIds(); if (!ids.length) return;
    // Export CSV client-side from the current table
    const headers = [];
    document.querySelectorAll('table thead th').forEach(th => headers.push((th.textContent||'').trim()));
    const lines = [headers.join(',')];
    document.querySelectorAll('.lo-check:checked').forEach(cb => {
      const tr = cb.closest('tr'); const cells = [];
      tr.querySelectorAll('td').forEach(td => { let t=(td.textContent||'').trim().replace(/"/g,'""'); cells.push('"'+t+'"'); });
      lines.push(cells.join(','));
    });
    const blob = new Blob(['\\uFEFF'+lines.join('\\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'phieu_export_' + Date.now() + '.csv'; a.click();
  }

  async function bulkChuyenDaVe() {
    const ids = bulkSelectedIds(); if (!ids.length) return;
    // "Returned" applies to TRIPS of the selected receipts
    const chuyens = Array.from(new Set(Array.from(document.querySelectorAll('.lo-check:checked')).map(cb => {
      const tr = cb.closest('tr'); return tr ? tr.getAttribute('data-group') : null;
    }).filter(Boolean)));
    if (!chuyens.length) { alert('Không xác định được chuyến của các phiếu đã chọn.'); return; }
    const ngay = prompt('Ngày về cho ' + chuyens.length + ' chuyến (YYYY-MM-DD), để trống = hôm nay:', new Date().toISOString().slice(0,10));
    if (ngay === null) return;
    const res = await fetch('/chuyen-xe/api/chuyen-xe/bulk', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'da-ve', ids: chuyens, ngay: ngay || undefined })
    });
    if (res.ok) location.reload(); else alert((await res.json()).error || 'Lỗi');
  }

  async function bulkThanhToan() {
    const ids = bulkSelectedIds(); if (!ids.length) return;
    htqlBulkTTOpen(ids);
  }

  // ── Header filter popover (multi-filter) ──
  window.htqlOpenColFilter = function(col, ev) {
    ev.stopPropagation();
    document.querySelectorAll('.htql-colfilter-pop').forEach(function(p){ p.remove(); });
    // Collect unique column values from the table: display text, filter by data-fval
    var map = new Map();
    document.querySelectorAll('td[data-col="' + col + '"]').forEach(function(td){
      var fval = td.getAttribute('data-fval'); if (!fval) return;
      var label = (td.textContent || '').trim() || fval;
      if (!map.has(fval)) map.set(fval, label);
    });
    if (map.size === 0) { alert('Không có giá trị để lọc ở cột này (trong trang hiện tại).'); return; }
    var pop = document.createElement('div');
    pop.className = 'htql-colfilter-pop';
    pop.style.cssText = 'position:absolute;z-index:70;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:8px;min-width:200px;max-height:300px;overflow:auto;font-size:13px';
    var items = Array.from(map.entries());
    pop.innerHTML = '<input type="text" placeholder="Tìm..." class="cf-search" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;margin-bottom:6px">' +
      '<div class="cf-list">' + items.map(function(e){
        return '<div class="cf-item" data-v="' + e[0].replace(/"/g,'&quot;') + '" style="padding:4px 6px;cursor:pointer;border-radius:4px">' + (e[1].replace(/</g,'&lt;')) + '</div>';
      }).join('') + '</div>';
    document.body.appendChild(pop);
    var r = ev.target.getBoundingClientRect();
    pop.style.left = (window.scrollX + r.left) + 'px';
    pop.style.top = (window.scrollY + r.bottom + 4) + 'px';
    pop.querySelector('.cf-search').addEventListener('input', function(){
      var q = this.value.toLowerCase();
      pop.querySelectorAll('.cf-item').forEach(function(it){ it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
    pop.querySelectorAll('.cf-item').forEach(function(it){
      it.addEventListener('mouseenter', function(){ it.style.background = '#eef2ff'; });
      it.addEventListener('mouseleave', function(){ it.style.background = ''; });
      it.addEventListener('click', function(){ htqlAddColFilter(col, it.getAttribute('data-v')); });
    });
    setTimeout(function(){
      document.addEventListener('click', function closer(e){
        if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', closer); }
      });
    }, 0);
  };
  window.htqlAddColFilter = function(col, val) {
    var url = new URL(window.location.href);
    var filters = [];
    try { filters = JSON.parse(url.searchParams.get('filters') || '[]'); } catch(e){ filters = []; }
    // Merge legacy fc/fv pair into filters if present
    var oldC = url.searchParams.get('fc'), oldV = url.searchParams.get('fv');
    if (oldC && oldV && !filters.some(function(f){return f.c===oldC;})) filters.push({c:oldC, v:oldV});
    if (!filters.some(function(f){ return f.c===col && f.v===val; })) filters.push({ c: col, v: val });
    url.searchParams.set('filters', JSON.stringify(filters));
    url.searchParams.delete('fc'); url.searchParams.delete('fv');
    window.location.href = url.toString();
  };

  window.importPreview = null;
  window.importExcelB64 = null;
  function openImportModal() {
    htqlOpenModal('importModal');
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('importText').value = '';
    window.importPreview = null;
    window.importExcelB64 = null;
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
    const excelB64 = window.importExcelB64 || '';
    if (!text && !excelB64) { alert('Chọn file Excel (.xlsx) hoặc dán dữ liệu từ Excel'); return; }
    const payload = { type };
    if (excelB64) payload.excelBase64 = excelB64;
    else payload.text = text;
    const res = await fetch('/lo-hang/api/import/parse', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
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
      var msg = 'Đã import ' + (data.imported || 0) + ' bản ghi';
      if (data.skipped > 0) msg += '\\n(Bỏ qua ' + data.skipped + ' dòng do thiếu KH/Hãng)';
      alert(msg);
      location.reload();
    } else {
      alert(data.error || 'Lỗi import');
    }
  }
  function readImportFile(file) {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      alert('Chỉ hỗ trợ file Excel (.xlsx, .xls)');
      return;
    }
    const r = new FileReader();
    r.onload = function() {
      const bytes = new Uint8Array(r.result);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      window.importExcelB64 = btoa(binary);
      document.getElementById('importText').value = '';
      document.getElementById('importPreview').innerHTML = '';
      window.importPreview = null;
      const btn = document.getElementById('importConfirmBtn');
      if (btn) btn.disabled = true;
      parseImport();
    };
    r.onerror = () => alert('Không đọc được file');
    r.readAsArrayBuffer(file);
  }

  // ── Bulk "Paid" modal ──
  var BULK_TT_IDS = [];
  var IS_ADMIN = ${role === 'admin' ? 'true' : 'false'};
  window.htqlBulkTTOpen = function(ids){
    BULK_TT_IDS = ids;
    var m = document.getElementById('bulkTTModal');
    document.getElementById('bulkTTCount').textContent = ids.length;
    var today = new Date().toISOString().slice(0,10);
    var d = document.getElementById('bulkTTNgay'); d.value = today; d.max = '';
    document.getElementById('bulkTTLoai').value = 'vantai';
    document.getElementById('bulkTTHinhThuc').value = 'TM';
    document.getElementById('bulkTTWarn').classList.add('hidden');
    var ngoaiWrap = document.getElementById('bulkTTNgoaiWrap');
    if (IS_ADMIN) { ngoaiWrap.classList.remove('hidden'); } else { ngoaiWrap.classList.add('hidden'); }
    document.getElementById('bulkTTNgoai').checked = false;
    m.classList.remove('hidden'); m.classList.add('flex');
  };
  window.htqlBulkTTClose = function(){
    var m = document.getElementById('bulkTTModal'); m.classList.add('hidden'); m.classList.remove('flex');
  };
  // Warn when a past date is chosen (affects balances/daily close on later days)
  document.addEventListener('change', function(e){
    if (e.target && e.target.id === 'bulkTTNgay') {
      var today = new Date().toISOString().slice(0,10);
      var w = document.getElementById('bulkTTWarn');
      if (e.target.value && e.target.value < today) w.classList.remove('hidden'); else w.classList.add('hidden');
    }
  });
  window.htqlBulkTTSubmit = async function(){
    var ngoaiSo = IS_ADMIN && document.getElementById('bulkTTNgoai').checked;
    var payload = { ids: BULK_TT_IDS };
    if (ngoaiSo) {
      payload.khongVaoSo = true;
    } else {
      payload.ngay = document.getElementById('bulkTTNgay').value;
      payload.loaiTien = document.getElementById('bulkTTLoai').value;
      payload.hinhThuc = document.getElementById('bulkTTHinhThuc').value;
      var today = new Date().toISOString().slice(0,10);
      if (payload.ngay < today && !confirm('Ngày ' + payload.ngay + ' là ngày quá khứ. Thêm phiếu thu sẽ LÀM THAY ĐỔI số dư/chốt sổ các ngày sau đó. Tiếp tục?')) return;
    }
    var res = await fetch('/lo-hang/api/lo-hang/bulk-thanh-toan', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if (res.ok) { var d = await res.json(); alert(ngoaiSo ? ('Đã đánh dấu TT ngoài sổ ' + d.count + ' phiếu') : ('Đã tạo ' + d.soPhieuThu + ' phiếu thu (ngày ' + d.ngay + ')')); location.reload(); }
    else { alert((await res.json()).error || 'Lỗi'); }
  };
  </script>

  <div id="bulkTTModal" class="hidden fixed inset-0 bg-black/50 z-[60] items-center justify-center p-4" onclick="if(event.target===this)htqlBulkTTClose()">
    <div class="bg-white dark:bg-darkgray rounded-lg shadow-xl w-full max-w-md p-5">
      <h3 class="text-lg font-semibold mb-3 text-dark dark:text-white">💰 Đã thanh toán <span id="bulkTTCount" class="text-primary">0</span> phiếu</h3>
      <div class="space-y-3">
        ${formField('Loại tiền thu', select({ id: 'bulkTTLoai', options: `
            <option value="vantai">Vận tải (thành tiền)</option>
            <option value="tienhang">Tiền hàng</option>
            <option value="ca-hai">Cả hai (tạo 2 nhóm phiếu thu)</option>
          ` }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Ngày thu', `
          ${input({ type: 'date', id: 'bulkTTNgay' })}
          <p id="bulkTTWarn" class="hidden text-xs text-error mt-1">⚠ Ngày quá khứ — sẽ làm thay đổi số dư/chốt sổ các ngày sau.</p>
        `, { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Hình thức', select({ id: 'bulkTTHinhThuc', options: `
            <option value="TM">Tiền mặt</option>
            <option value="CK">Chuyển khoản</option>
          ` }), { labelClass: FILTER_LABEL_CLASS })}
        <div id="bulkTTNgoaiWrap" class="hidden border-t pt-3">
          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" id="bulkTTNgoai" class="mt-0.5 rounded border-gray-300">
            <span>Đã thanh toán nhưng <strong>KHÔNG vào sổ</strong> thu chi (chỉ admin thấy, không tạo phiếu thu)</span>
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button onclick="htqlBulkTTClose()" class="px-4 py-2 text-sm rounded-md border border-gray-300">Huỷ</button>
        <button onclick="htqlBulkTTSubmit()" class="px-4 py-2 text-sm rounded-md bg-primary text-white">Xác nhận</button>
      </div>
    </div>
  </div>`;

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
              <input type="file" id="importFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" tabindex="-1">
              <div class="pointer-events-none">
                <iconify-icon icon="solar:cloud-upload-linear" class="text-bodytext dark:text-darklink" style="font-size:36px"></iconify-icon>
                <p class="htql-import-dropzone-text">Kéo thả file Excel (.xlsx) vào đây</p>
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
        window.importExcelB64 = null;
      }
    });
    var importTextEl = document.getElementById('importText');
    if (importTextEl) {
      importTextEl.addEventListener('input', function() {
        window.importExcelB64 = null;
      });
    }
    // Enhance parseImport preview rendering (override)
    (function() {
      var _origParseImport = window.parseImport;
      window.parseImport = async function() {
        var type = getImportType();
        var text = document.getElementById('importText').value.trim();
        var excelB64 = window.importExcelB64 || '';
        if (!text && !excelB64) { alert('Chọn file Excel (.xlsx) hoặc dán dữ liệu từ Excel'); return; }
        var payload = { type: type };
        if (excelB64) payload.excelBase64 = excelB64;
        else payload.text = text;
        var res = await fetch('/lo-hang/api/import/parse', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
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
      ${formField('Chuyến xe', select({ name: 'chuyen_xe_id', id: 'chuyenSelect', options: `<option value="">-- Chưa có chuyến (DK) --</option>${cxOptions}` }))}
      ${formField('Khách hàng', select({ name: 'khach_hang_id', required: true, options: `<option value="">-- Chọn KH --</option>${khOptions}` }), { required: true })}
      ${formField('Hãng', select({ name: 'hang_id', required: true, options: `<option value="">-- Chọn hãng --</option>${hangOptions}` }), { required: true })}
      ${formField('Số kiện', input({ type: 'number', name: 'so_kien', value: '1', min: '0', oninput: 'calcThanhTien()' }))}
      ${formField('Đơn giá', input({ type: 'number', name: 'don_gia', value: '0', step: '0.01', oninput: 'calcThanhTien()' }))}
      ${formField('Tiền tệ', select({ name: 'tien_te', options: '<option value="PLN">PLN</option><option value="EUR">EUR</option><option value="USD">USD</option>' }))}
      ${formField('Thành tiền (tự tính)', input({ type: 'number', name: 'thanh_tien', value: '0', step: '0.01', class: 'bg-lightgray dark:bg-darkgray', readonly: true }))}
      ${formField('Số tiền hàng', input({ type: 'number', name: 'so_tien_hang', value: '0', step: '0.01' }))}
      ${formField('Giảm giá', input({ type: 'number', name: 'giam_gia', value: '0', step: '0.01', oninput: 'calcThanhTien()' }))}
      ${formField('Người tạo', select({ name: 'nguoi_tao', options: `<option value="">-- Chọn --</option>${nvOptions}` }))}
      ${formField('Người thu', select({ name: 'nguoi_thu', options: `<option value="">-- Chọn --</option>${nvOptions}` }))}
      ${formField('Ghi chú', input({ type: 'text', name: 'ly_do_thieu' }))}
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

  // Related receipt slips
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

  // Related receipt slips
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
        ${formField('Khách hàng', select({ name: 'khach_hang_id', options: `<option value="">-- Chọn KH --</option>${khOptions}` }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Hãng', select({ name: 'hang_id', options: `<option value="">-- Chọn hãng --</option>${hangOptions}` }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Chuyến xe', select({ name: 'chuyen_xe_id', options: `<option value="">-- Chọn chuyến --</option>${cxOptions}` }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Số kiện', input({ type: 'number', name: 'so_kien', value: String(lo.so_kien), min: '0' }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Đã trả hàng', input({ type: 'number', name: 'da_tra_hang', value: String(lo.da_tra_hang), min: '0' }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Đơn giá', input({ type: 'number', name: 'don_gia', value: String(lo.don_gia), step: '0.01' }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Tiền tệ', select({ name: 'tien_te', options: `
            <option value="PLN" ${lo.tien_te==='PLN'?'selected':''}>PLN</option>
            <option value="EUR" ${lo.tien_te==='EUR'?'selected':''}>EUR</option>
            <option value="USD" ${lo.tien_te==='USD'?'selected':''}>USD</option>
          ` }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Thành tiền', input({ type: 'number', name: 'thanh_tien', value: String(lo.thanh_tien), step: '0.01' }), { labelClass: FILTER_LABEL_CLASS })}
        ${perm.canEditTienHang ? formField('Số tiền hàng', input({ type: 'number', name: 'so_tien_hang', value: String(lo.so_tien_hang), step: '0.01' }), { labelClass: FILTER_LABEL_CLASS }) : ''}
        ${formField('Giảm giá', input({ type: 'number', name: 'giam_gia', value: String(lo.giam_gia), step: '0.01' }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Người tạo', select({ name: 'nguoi_tao', options: `<option value="">-- Chọn --</option>${nvTaoOptions}` }), { labelClass: FILTER_LABEL_CLASS })}
        ${formField('Người thu', select({ name: 'nguoi_thu', options: `<option value="">-- Chọn --</option>${nvThuOptions}` }), { labelClass: FILTER_LABEL_CLASS })}
        <div class="col-span-2 sm:col-span-3">
          ${formField('Lý do thiếu / Ghi chú', input({ type: 'text', name: 'ly_do_thieu', value: esc(lo.ly_do_thieu) }), { labelClass: FILTER_LABEL_CLASS })}
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
  const body = await c.req.json<{
    action: string;
    ids: string[];
    nguoiThu?: string;
    chuyenXeId?: string;
    xeId?: string;
  }>();
  const { action, ids } = body;

  if (!ids || ids.length === 0) {
    return c.json({ error: 'No IDs provided' }, 400);
  }

  const now = "datetime('now')";
  const audit = async (hanhDong: string) => {
    await c.env.DB.prepare(
      `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
       VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, ?, 'bulk', ?)`
    ).bind(`AL-${Date.now()}`, user.role, user.display_name, hanhDong, `${ids.length} phiếu: ${ids.join(', ')}`).run();
  };

  if (action === 'tra-hang') {
    for (const id of ids) {
      const lo = await c.env.DB.prepare('SELECT so_kien FROM lo_hang WHERE id=?').bind(id).first<{ so_kien: number }>();
      if (lo) {
        await c.env.DB.prepare(`UPDATE lo_hang SET da_tra_hang=?, updated_at=${now} WHERE id=?`).bind(lo.so_kien, id).run();
      }
    }
    await audit('Bulk trả hàng');
    return c.json({ success: true, count: ids.length });
  }

  if (action === 'gan-nguoi-thu') {
    const nguoiThu = (body.nguoiThu || '').trim();
    for (const id of ids) {
      await c.env.DB.prepare(`UPDATE lo_hang SET nguoi_thu=?, updated_at=${now} WHERE id=?`).bind(nguoiThu, id).run();
    }
    await audit(`Bulk gán người thu: ${nguoiThu || '(trống)'}`);
    return c.json({ success: true, count: ids.length });
  }

  if (action === 'gan-chuyen') {
    // Assign receipts to a real trip. If a receipt is on an awaiting-vehicle trip (CX),
    // rename it to the new trip code: <newTrip>-<old suffix>.
    const chuyenMoi = (body.chuyenXeId || '').trim();
    if (!chuyenMoi) return c.json({ error: 'Thiếu mã chuyến đích' }, 400);
    const ch = await c.env.DB.prepare('SELECT id FROM chuyen_xe WHERE id=?').bind(chuyenMoi).first<{ id: string }>();
    if (!ch) return c.json({ error: 'Chuyến đích không tồn tại' }, 400);
    let changed = 0;
    for (const id of ids) {
      const lo = await c.env.DB.prepare('SELECT chuyen_xe_id FROM lo_hang WHERE id=?').bind(id).first<{ chuyen_xe_id: string }>();
      if (!lo) continue;
      // Build new ID: tail after the last '-' of the old trip (customer code / seq), append to new trip
      let newId = id;
      const oldCh = lo.chuyen_xe_id || '';
      if (oldCh && id.startsWith(oldCh)) {
        const tail = id.slice(oldCh.length).replace(/^-/, ''); // suffix after old trip code
        newId = tail ? `${chuyenMoi}-${tail}` : `${chuyenMoi}`;
      }
      // Avoid duplicate target ID
      if (newId !== id) {
        const dup = await c.env.DB.prepare('SELECT id FROM lo_hang WHERE id=?').bind(newId).first();
        if (dup) newId = `${newId}-${Date.now().toString().slice(-3)}`;
        await c.env.DB.prepare(`UPDATE lo_hang SET id=?, chuyen_xe_id=?, updated_at=${now} WHERE id=?`).bind(newId, chuyenMoi, id).run();
      } else {
        await c.env.DB.prepare(`UPDATE lo_hang SET chuyen_xe_id=?, updated_at=${now} WHERE id=?`).bind(chuyenMoi, id).run();
      }
      changed++;
    }
    await audit(`Bulk gán chuyến: ${chuyenMoi}`);
    return c.json({ success: true, count: changed });
  }

  if (action === 'duplicate') {
    let created = 0;
    for (const id of ids) {
      const lo = await c.env.DB.prepare('SELECT * FROM lo_hang WHERE id=?').bind(id).first<Record<string, unknown>>();
      if (!lo) continue;
      const newId = `${id}-COPY${Date.now().toString().slice(-4)}`;
      await c.env.DB.prepare(
        `INSERT INTO lo_hang (id, chuyen_xe_id, khach_hang_id, hang_id, so_kien, da_tra_hang,
         ly_do_thieu, don_gia, tien_te, thanh_tien, so_tien_hang, giam_gia, nguoi_tao, nguoi_thu, created_at, updated_at)
         SELECT ?, chuyen_xe_id, khach_hang_id, hang_id, so_kien, da_tra_hang,
         ly_do_thieu, don_gia, tien_te, thanh_tien, so_tien_hang, giam_gia, nguoi_tao, nguoi_thu, ${now}, ${now}
         FROM lo_hang WHERE id=?`
      ).bind(newId, id).run();
      created++;
    }
    await audit('Bulk sao chép phiếu');
    return c.json({ success: true, count: created });
  }

  if (action === 'delete') {
    for (const id of ids) {
      await c.env.DB.prepare('DELETE FROM lo_hang WHERE id=?').bind(id).run();
    }
    await audit('Bulk xoá phiếu');
    return c.json({ success: true, count: ids.length });
  }

  return c.json({ error: 'Unknown action' }, 400);
});

// ─── POST /api/lo-hang/bulk-thanh-toan — Mark as paid ───
// Create receipt slips (kieu_qt='trahet') grouped by customer + category + currency; or
// mark "paid outside ledger" (admin only) — no receipt slip, visible to admin only.
loHangRoutes.post('/api/lo-hang/bulk-thanh-toan', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    ids: string[];
    ngay?: string;
    loaiTien?: 'vantai' | 'tienhang' | 'ca-hai';
    khongVaoSo?: boolean;
    hinhThuc?: 'TM' | 'CK';
  }>();
  const ids = body.ids || [];
  if (ids.length === 0) return c.json({ error: 'Chưa chọn phiếu' }, 400);

  // Case C: paid outside ledger — admin only
  if (body.khongVaoSo) {
    if (user.role !== 'admin') return c.json({ error: 'Chỉ admin được đánh dấu thanh toán ngoài sổ' }, 403);
    for (const id of ids) {
      await c.env.DB.prepare("UPDATE lo_hang SET da_tt_ngoai_so=1, updated_at=datetime('now') WHERE id=?").bind(id).run();
    }
    await c.env.DB.prepare(
      `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
       VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'TT ngoài sổ (admin)', 'bulk', ?)`
    ).bind(`AL-${Date.now()}`, user.role, user.display_name, `${ids.length} phiếu`).run();
    return c.json({ success: true, count: ids.length, mode: 'ngoai-so' });
  }

  // Case A/B: create real receipt slips
  const ngay = body.ngay || new Date().toISOString().slice(0, 10);
  const loaiTien = body.loaiTien || 'vantai';
  const hinhThuc = body.hinhThuc || 'TM';
  const wantVT = loaiTien === 'vantai' || loaiTien === 'ca-hai';
  const wantTH = loaiTien === 'tienhang' || loaiTien === 'ca-hai';

  // Load selected receipt details (including category from route)
  const placeholders = ids.map(() => '?').join(',');
  const { results: lots } = await c.env.DB.prepare(
    `SELECT lh.id, lh.khach_hang_id, lh.thanh_tien, lh.giam_gia, lh.tien_te,
            lh.so_tien_hang, lh.tien_te_th, t.dau_muc_group
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     WHERE lh.id IN (${placeholders})`
  ).bind(...ids).all<Record<string, unknown>>();

  // Group by customer + category + currency + amount type
  type Grp = { khId: string; dauMuc: string; tte: string; loai: 'vantai' | 'tienhang'; tong: number; loIds: string[] };
  const groups = new Map<string, Grp>();
  for (const lo of lots) {
    const khId = String(lo.khach_hang_id);
    const dmg = String(lo.dau_muc_group || 'khac') as DauMucGroup;
    const dauMuc = DM_GROUP_LABEL[dmg] || 'Vận tải khác';
    if (wantVT) {
      const tt = Number(lo.thanh_tien) - Number(lo.giam_gia || 0);
      if (tt > 0) {
        const tte = String(lo.tien_te || 'PLN');
        const key = `${khId}|${dauMuc}|${tte}|vantai`;
        if (!groups.has(key)) groups.set(key, { khId, dauMuc, tte, loai: 'vantai', tong: 0, loIds: [] });
        const g = groups.get(key)!;
        g.tong += tt;
        g.loIds.push(String(lo.id));
      }
    }
    if (wantTH) {
      const th = Number(lo.so_tien_hang || 0);
      if (th > 0) {
        const tte = String(lo.tien_te_th || lo.tien_te || 'PLN');
        const key = `${khId}|${dauMuc}|${tte}|tienhang`;
        if (!groups.has(key)) groups.set(key, { khId, dauMuc, tte, loai: 'tienhang', tong: 0, loIds: [] });
        const g = groups.get(key)!;
        g.tong += th;
        g.loIds.push(String(lo.id));
      }
    }
  }

  if (groups.size === 0) return c.json({ error: 'Các phiếu đã chọn không có khoản phải thu phù hợp' }, 400);

  let created = 0;
  for (const g of groups.values()) {
    const id = `PT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    await c.env.DB.prepare(
      `INSERT INTO phieu_thu (id, ngay, khach_hang_id, dau_muc, kieu_qt, loai_tien, lo_ids, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio)
       VALUES (?, ?, ?, ?, 'trahet', ?, ?, ?, ?, ?, ?, ?, strftime('%H:%M','now'))`
    ).bind(
      id, ngay, g.khId, g.dauMuc, g.loai, JSON.stringify(g.loIds), g.tong, g.tte, hinhThuc,
      `Bulk thanh toán ${g.loIds.length} phiếu`, user.display_name,
    ).run();
    created++;
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_log (id, ngay, gio, nguoi, nguoi_label, hanh_dong, target, chi_tiet)
     VALUES (?, date('now'), strftime('%H:%M','now'), ?, ?, 'Bulk thanh toán', 'bulk', ?)`
  ).bind(`AL-${Date.now()}`, user.role, user.display_name, `${ids.length} phiếu -> ${created} phiếu thu, ngày ${ngay}`).run();

  return c.json({ success: true, soPhieuThu: created, ngay });
});

// ─── Import APIs ───────────────────────────────────────────────
async function loadImportContext(db: D1Database) {
  const [kh, hang, cty, tuyen, xe, chuyen] = await Promise.all([
    db.prepare('SELECT id, ma_kh, ten FROM khach_hang').all<KhRow>(),
    db.prepare('SELECT id, ten FROM hang').all<{ id: string; ten: string }>(),
    db.prepare('SELECT id, ten FROM cty_van_tai').all<{ id: string; ten: string }>(),
    db.prepare('SELECT id, ten, tien_to, dau_muc_group FROM tuyen').all<{ id: string; ten: string; tien_to: string; dau_muc_group: string }>(),
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
  const tpl = excelTemplate(type);
  return new Response(tpl.buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${tpl.filename}"`,
    },
  });
});

loHangRoutes.post('/api/import/parse', async (c) => {
  const user = c.get('user');
  const perm = loHangPerm(c.get('perms'));
  if (!perm.canCreateLo) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ type: ImportType; text?: string; excelBase64?: string; importDate?: string }>();
  const type = body.type;
  if (!type || (!body.text && !body.excelBase64)) {
    return c.json({ error: 'Thiếu type hoặc dữ liệu import' }, 400);
  }

  const parsed = body.excelBase64
    ? parseExcelBase64(body.excelBase64)
    : parseDelimitedText(body.text || '');
  if (parsed.rows.length === 0) return c.json({ error: 'Không có dòng dữ liệu' }, 400);

  const ctx = await loadImportContext(c.env.DB);
  if (body.importDate) (ctx as { importDate?: string }).importDate = body.importDate;
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

  let skipped = 0;

  if (body.type === 'kh') {
    const lastKh = await db.prepare("SELECT COUNT(*) as cnt FROM khach_hang").first<{cnt:number}>();
    let khSeq = (lastKh?.cnt || 0) + 1;
    for (const row of body.valid as { ten: string; nip?: string; dia_chi?: string; sdt?: string; han_tt?: number; ghi_chu?: string }[]) {
      const id = `KH-${Date.now()}-${khSeq}`;
      const maKh = `KH${String(khSeq).padStart(4, '0')}`;
      await db.prepare(
        `INSERT OR IGNORE INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia, danh_gia_manual, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)`
      ).bind(id, maKh, row.ten, row.nip || '', row.dia_chi || '', row.sdt || '', row.han_tt || 30, row.ghi_chu || '', now, now).run();
      imported++;
      khSeq++;
    }
  } else if (body.type === 'hang') {
    let hangSeq = Date.now();
    for (const row of body.valid as { ten: string; nuoc?: string; dia_chi?: string }[]) {
      const id = `H-${hangSeq}`;
      await db.prepare(
        `INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, row.ten, row.nuoc || '', row.dia_chi || '', now, now).run();
      imported++;
      hangSeq++;
    }
  } else if (body.type === 'cty') {
    let ctySeq = Date.now();
    for (const row of body.valid as { ten: string; dia_chi?: string; sdt?: string }[]) {
      const id = `CTY-${ctySeq}`;
      await db.prepare(
        `INSERT OR IGNORE INTO cty_van_tai (id, ten, dia_chi, sdt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, row.ten, row.dia_chi || '', row.sdt || '', now, now).run();
      imported++;
      ctySeq++;
    }
  } else if (body.type === 'phieu') {
    const khNameToId = new Map<string, string>();
    const hangNameToId = new Map<string, string>();
    const xeKeyToId = new Map<string, string>();

    const allKh = await db.prepare('SELECT id, ten FROM khach_hang').all<{ id: string; ten: string }>();
    for (const k of allKh.results || []) {
      khNameToId.set(k.ten.trim().toLowerCase().replace(/\s+/g, ' '), k.id);
    }

    let entitySeq = Date.now();
    for (const kh of body.newKHs || []) {
      if (kh.checked === false) continue;
      const id = `KH-${entitySeq}`;
      entitySeq++;
      const lastMaKh = await db.prepare("SELECT ma_kh FROM khach_hang WHERE ma_kh LIKE 'IMP%' ORDER BY ma_kh DESC LIMIT 1").first<{ma_kh:string}>();
      let impSeq = 1;
      if (lastMaKh?.ma_kh) {
        impSeq = (parseInt(lastMaKh.ma_kh.replace('IMP', ''), 10) || 0) + 1;
      }
      const maKh = `IMP${String(impSeq).padStart(4, '0')}`;
      await db.prepare(
        `INSERT OR IGNORE INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia, danh_gia_manual, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?)`
      ).bind(id, maKh, kh.ten, kh.nip || '', kh.dia_chi || '', kh.sdt || '', kh.han_tt || 30, now, now).run();
      khNameToId.set(kh.ten.trim().toLowerCase().replace(/\s+/g, ' '), id);
    }

    const allHang = await db.prepare('SELECT id, ten FROM hang').all<{ id: string; ten: string }>();
    for (const h of allHang.results || []) {
      hangNameToId.set(h.ten.trim().toLowerCase().replace(/\s+/g, ' '), h.id);
    }
    for (const h of body.newHangs || []) {
      if (h.checked === false) continue;
      const id = `H-${entitySeq}`;
      entitySeq++;
      await db.prepare(
        `INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, h.ten, h.nuoc || '', h.dia_chi || '', now, now).run();
      hangNameToId.set(h.ten.trim().toLowerCase().replace(/\s+/g, ' '), id);
    }

    for (const x of body.newXes || []) {
      if (x.checked === false) continue;
      const id = x.so_xe.replace(/\s+/g, '-').slice(0, 20) || `XE-${entitySeq++}`;
      await db.prepare(
        `INSERT OR IGNORE INTO xe (id, bien_so, so_xe, loai_xe, trong_tai, tai_xe_id, created_at, updated_at)
         VALUES (?, ?, ?, '', 0, '', ?, ?)`
      ).bind(id, x.bien_so || x.so_xe, x.so_xe, now, now).run();
      xeKeyToId.set(x.so_xe.trim().toLowerCase().replace(/\s+/g, ' '), id);
    }

    // Awaiting-vehicle trips (xe_id = VIRTUAL_XE_ID)? Pre-create virtual vehicle + empty supplier placeholder
    // to satisfy NOT NULL FK constraints on chuyen_xe.xe_id and lo_hang.hang_id.
    const coChoXe = (body.newChuyens || []).some((ch) => ch.xe_id === VIRTUAL_XE_ID);
    if (coChoXe) {
      await db.prepare(
        `INSERT OR IGNORE INTO xe (id, bien_so, so_xe, loai_xe, trong_tai, tai_xe_id, created_at, updated_at)
         VALUES (?, '(chờ xếp xe)', 'CX', '', 0, '', ?, ?)`
      ).bind(VIRTUAL_XE_ID, now, now).run();
      await db.prepare(
        `INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at)
         VALUES ('H-NONE', '(không hãng)', '', '', ?, ?)`
      ).bind(now, now).run();
      hangNameToId.set('(không hãng)', 'H-NONE');
    }

    for (const ch of body.newChuyens || []) {
      const xeKey = (ch.so_xe || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const xeId = ch.xe_id || (xeKey ? xeKeyToId.get(xeKey) : '') || '';
      if (!xeId || !ch.tuyen_id) continue;
      await db.prepare(
        `INSERT OR IGNORE INTO chuyen_xe (id, tuyen_id, xe_id, tai_xe_id, ngay_di, ngay_den, trang_thai, ghi_chu, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?)`
      ).bind(ch.id, ch.tuyen_id, xeId, ch.tai_xe_id || null, ch.ngay_di, ch.ngay_den || ch.ngay_di, ch.xe_id === VIRTUAL_XE_ID ? 'cho-xep-xe' : '', now, now).run();
    }

    for (const p of body.valid as PhieuDraft[]) {
      let khId = p.khach_hang_id;
      let hangId = p.hang_id;
      if (p._khTen) khId = khNameToId.get(p._khTen.trim().toLowerCase().replace(/\s+/g, ' ')) || khId;
      if (p._hangTen) hangId = hangNameToId.get(p._hangTen.trim().toLowerCase().replace(/\s+/g, ' ')) || hangId;
      // Pure transport receipt (no supplier) -> point to empty supplier H-NONE
      if (!hangId) {
        hangId = hangNameToId.get('(không hãng)') || 'H-NONE';
        await db.prepare(
          `INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at)
           VALUES ('H-NONE', '(không hãng)', '', '', ?, ?)`
        ).bind(now, now).run();
        hangNameToId.set('(không hãng)', 'H-NONE');
      }
      if (!khId) {
        skipped++;
        continue;
      }

      let loId: string;
      if (p._loId) {
        // Pre-assigned receipt ID (awaiting-vehicle trip): F260526-CX-003
        loId = p._loId;
      } else if (p.chuyen_xe_id) {
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
        const lastDk = await db.prepare(
          `SELECT id FROM lo_hang WHERE id LIKE ? ORDER BY id DESC LIMIT 1`
        ).bind(`DK${ds}-%`).first<{ id: string }>();
        let dkSeq = 1;
        if (lastDk?.id) {
          const parts = lastDk.id.split('-');
          dkSeq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
        }
        loId = `DK${ds}-${String(dkSeq).padStart(3, '0')}`;
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

  return c.json({ success: true, imported, skipped });
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
