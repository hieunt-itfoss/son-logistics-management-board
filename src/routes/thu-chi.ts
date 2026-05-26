import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { DAU_MUC_THU_CHI, DM_GROUP_LABEL } from '../types';
import type { DauMucGroup } from '../types';
import { layout } from '../utils/layout';
import { pageHeader, card, dataTable, tableRow, tableEmpty, badge, btnPrimary, btnSecondary, searchField } from '../utils/ui';

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
const VT_DAUMUCS = ['Vận tải Pháp','Vận tải Ý','Vận tải Tiệp','Vận tải Balan','Vận tải khác'];
const KHAC_DAUMUCS = ['Văn phòng','Chi ngoài'];

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

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return d;
}

/* ══════════════════════════════════════════════════════════════
   GET / — Main Thu/Chi view (with profit, warnings, chốt sổ)
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/', async (c) => {
  const user = c.get('user');
  const perms = c.get('perms');
  const canEdit = perms.canEdit;
  const canViewLN = perms.canViewLoiNhuan;
  const canChotSo = perms.canChotSo;
  const loai = c.req.query('loai') || 'all';
  const dauMuc = c.req.query('dau_muc') || 'all';
  const range = c.req.query('range') || 'today';
  const q = c.req.query('q') || '';

  /* ── build WHERE for list ── */
  const rangeWhere = dateRangeSQL(range, 'ngay');
  const dmWhere = dauMuc !== 'all' ? `AND dau_muc = ?` : '';
  const qWhere = q ? `AND (ghi_chu LIKE ? OR id LIKE ?)` : '';

  /* ── phieu thu ── */
  const thuQ = `SELECT pt.*, kh.ten as khach_hang_ten, kh.ma_kh
    FROM phieu_thu pt LEFT JOIN khach_hang kh ON pt.khach_hang_id = kh.id
    WHERE ${rangeWhere} ${dmWhere.replace(/dau_muc/g,'pt.dau_muc')} ${qWhere.replace(/ghi_chu/g,'pt.ghi_chu').replace(/\bid\b/g,'pt.id')}
    ORDER BY pt.ngay DESC, pt.gio DESC`;
  const thuBinds: string[] = [];
  if (dauMuc !== 'all') thuBinds.push(dauMuc);
  if (q) { thuBinds.push(`%${q}%`, `%${q}%`); }
  const { results: thuList } = await c.env.DB.prepare(thuQ).bind(...thuBinds).all();

  /* ── phieu chi ── */
  const chiQ = `SELECT * FROM phieu_chi
    WHERE ${rangeWhere} ${dmWhere} ${qWhere.replace(/ghi_chu/g,'phieu_chi.ghi_chu').replace(/\bid\b/g,'phieu_chi.id')}
    ORDER BY ngay DESC, gio DESC`;
  const chiBinds: string[] = [];
  if (dauMuc !== 'all') chiBinds.push(dauMuc);
  if (q) { chiBinds.push(`%${q}%`, `%${q}%`); }
  const { results: chiList } = await c.env.DB.prepare(chiQ).bind(...chiBinds).all();

  /* ── profit reporting data (for range or thisMonth fallback) ── */
  const profitRange = range === 'all' ? 'thisMonth' : range;
  const profitRangeWhere = dateRangeSQL(profitRange, 'ngay');

  const { results: allThuForProfit } = await c.env.DB.prepare(
    `SELECT dau_muc, so_tien, tien_te FROM phieu_thu WHERE ${profitRangeWhere}`
  ).all();
  const { results: allChiForProfit } = await c.env.DB.prepare(
    `SELECT dau_muc, so_tien, tien_te FROM phieu_chi WHERE ${profitRangeWhere}`
  ).all();

  /* ── warnings: phiếu chi phải thu về but not yet collected ── */
  const { results: warnResults } = await c.env.DB.prepare(
    `SELECT pc.*, cx.ngay_di as chuyen_ngay
     FROM phieu_chi pc
     LEFT JOIN chuyen_xe cx ON pc.chuyen_xe_id = cx.id
     WHERE pc.phai_thu_ve = 1
     ORDER BY pc.ngay DESC`
  ).all();

  /* ── chốt sổ: daily balances for last N days ── */
  const csDays = Number(c.req.query('cs_days')) || 7;
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().slice(0, 10);

  const csDateList: string[] = [];
  for (let i = 0; i < csDays; i++) {
    const d = new Date(todayDate.getTime() - i * 86400000);
    csDateList.push(d.toISOString().slice(0, 10));
  }

  const { results: allThuForCS } = await c.env.DB.prepare(
    'SELECT ngay, so_tien, tien_te FROM phieu_thu ORDER BY ngay ASC'
  ).all();
  const { results: allChiForCS } = await c.env.DB.prepare(
    'SELECT ngay, so_tien, tien_te FROM phieu_chi ORDER BY ngay ASC'
  ).all();

  const soDuRow = await c.env.DB.prepare(
    'SELECT tien_te, so_du FROM so_du_dau_ky'
  ).all();
  const dauKy: Record<string, number> = { PLN: 0, EUR: 0, USD: 0 };
  for (const r of (soDuRow.results || []) as Record<string, unknown>[]) {
    dauKy[String(r.tien_te)] = Number(r.so_du) || 0;
  }

  /* ── totals by currency ── */
  type R = Record<string, unknown>;
  const sumByCcy: Record<string,{thu:number,chi:number}> = {};
  for (const r of thuList as R[]) {
    const tte = String(r.tien_te || 'PLN');
    if (!sumByCcy[tte]) sumByCcy[tte] = { thu:0, chi:0 };
    sumByCcy[tte].thu += Number(r.so_tien) || 0;
  }
  for (const r of chiList as R[]) {
    const tte = String(r.tien_te || 'PLN');
    if (!sumByCcy[tte]) sumByCcy[tte] = { thu:0, chi:0 };
    sumByCcy[tte].chi += Number(r.so_tien) || 0;
  }

  /* ── render phieu rows ── */
  const allRows: string[] = [];

  if (loai === 'all' || loai === 'thu') {
    for (const r of thuList as R[]) {
      const loIds: string[] = r.lo_ids ? JSON.parse(String(r.lo_ids)) : [];
      const khTen = String(r.khach_hang_ten || '—');
      const loStr = loIds.length ? loIds.slice(0,2).map(l => `<span class="text-primary">${esc(l)}</span>`).join(', ') : '';
      const related = khTen + (loStr ? ' · ' + loStr : '');
      allRows.push(tableRow([
        badge('Thu', 'success'),
        `<span class="font-mono text-bodytext text-xs">${esc(String(r.id))}</span>`,
        esc(String(r.ngay)),
        esc(String(r.dau_muc || '')),
        related,
        `<span class="font-semibold text-success tabular-nums">+${fmtNum(Number(r.so_tien)||0)} ${r.tien_te}</span>`,
        badge(String(r.hinh_thuc), r.hinh_thuc === 'CK' ? 'warning' : 'success'),
        `<span class="max-w-[200px] truncate inline-block text-xs">${esc(String(r.ghi_chu||''))}</span>`,
        canEdit ? `<div class="flex justify-center gap-1">
          <a href="/thu-chi/thu/print/${esc(String(r.id))}" target="_blank" class="htql-table-action" title="In phiếu thu"><iconify-icon icon="solar:printer-linear" width="16"></iconify-icon></a>
          <button type="button" onclick="deleteThu('${esc(String(r.id))}')" class="htql-table-action htql-table-action--delete" title="Xóa"><iconify-icon icon="solar:trash-bin-trash-linear" width="16"></iconify-icon></button>
        </div>` : '',
      ], { align: 'center' }));
    }
  }

  if (loai === 'all' || loai === 'chi') {
    for (const r of chiList as R[]) {
      const phaiTV = Number(r.phai_thu_ve) ? badge('Cần thu', 'warning') : '';
      const cxId = String(r.chuyen_xe_id || '');
      const related = cxId ? `<a href="/chuyen-xe/${esc(cxId)}" class="text-primary hover:underline font-mono text-xs">${esc(cxId)}</a>` : '—';
      allRows.push(tableRow([
        badge('Chi', 'error'),
        `<span class="font-mono text-bodytext text-xs">${esc(String(r.id))}</span>`,
        esc(String(r.ngay)),
        esc(String(r.dau_muc||'')),
        related,
        `<span class="font-semibold text-error tabular-nums">−${fmtNum(Number(r.so_tien)||0)} ${r.tien_te}</span>`,
        badge(String(r.hinh_thuc), r.hinh_thuc === 'CK' ? 'warning' : 'success'),
        `<span class="max-w-[200px] truncate inline-block text-xs">${esc(String(r.ghi_chu||''))}</span> ${phaiTV}`,
        canEdit ? `<div class="flex justify-center gap-1">
          <a href="/thu-chi/chi/print/${esc(String(r.id))}" target="_blank" class="htql-table-action" title="In phiếu chi"><iconify-icon icon="solar:printer-linear" width="16"></iconify-icon></a>
          <button type="button" onclick="deleteChi('${esc(String(r.id))}')" class="htql-table-action htql-table-action--delete" title="Xóa"><iconify-icon icon="solar:trash-bin-trash-linear" width="16"></iconify-icon></button>
        </div>` : '',
      ], { align: 'center' }));
    }
  }

  const totalCount = allRows.length;
  const sumChips = Object.entries(sumByCcy).map(([tte, s]) =>
    badge(`${tte}: +${fmtNum(s.thu)} / −${fmtNum(s.chi)}`, 'neutral')
  ).join(' ');

  const dmOpts = DAU_MUC_THU_CHI.map(d => `<option value="${d}" ${dauMuc===d?'selected':''}>${d}</option>`).join('');

  const hasFilter = loai !== 'all' || dauMuc !== 'all' || q || range !== 'today';

  /* ═══════ SECTION: Profit reporting ═══════ */
  let profitSection = '';
  if (canViewLN) {
    const thuVT: Record<string,number> = {};
    const chiVT: Record<string,number> = {};
    const chiKhac: Record<string,number> = {};

    for (const p of allThuForProfit as R[]) {
      const dm = String(p.dau_muc || '');
      const tte = String(p.tien_te || 'PLN');
      const st = Number(p.so_tien) || 0;
      if (VT_DAUMUCS.includes(dm)) thuVT[tte] = (thuVT[tte] || 0) + st;
    }
    for (const p of allChiForProfit as R[]) {
      const dm = String(p.dau_muc || '');
      const tte = String(p.tien_te || 'PLN');
      const st = Number(p.so_tien) || 0;
      if (VT_DAUMUCS.includes(dm)) chiVT[tte] = (chiVT[tte] || 0) + st;
      else if (KHAC_DAUMUCS.includes(dm)) chiKhac[tte] = (chiKhac[tte] || 0) + st;
    }

    const allCcys = Array.from(new Set([...Object.keys(thuVT), ...Object.keys(chiVT), ...Object.keys(chiKhac)]));

    let lnCards = '';
    if (allCcys.length === 0) {
      lnCards = '<p class="text-bodytext dark:text-darklink italic py-4">Chưa có giao dịch</p>';
    } else {
      lnCards = `<div class="grid grid-cols-1 sm:grid-cols-${Math.min(allCcys.length, 3)} gap-3">`;
      for (const ccy of allCcys) {
        const tVT = thuVT[ccy] || 0;
        const cVT = chiVT[ccy] || 0;
        const cKhac = chiKhac[ccy] || 0;
        const lnGop = tVT - cVT;
        const lnThuan = lnGop - cKhac;
        const bd = tVT > 0 ? Math.round(lnThuan / tVT * 100) : 0;
        const lnGopColor = lnGop >= 0 ? 'text-success' : 'text-error';
        const lnThuanColor = lnThuan >= 0 ? 'text-success' : 'text-error';

        lnCards += `<div class="card">
          <div class="card-body text-sm leading-relaxed">
            <div class="font-bold text-primary text-base border-b border-light-dark dark:border-darkborder pb-2 mb-3">${ccy}</div>
            <div>• Thu VT: <strong>${fmtNum(tVT)}</strong></div>
            <div>• Chi VT: <strong>${fmtNum(cVT)}</strong></div>
            <div class="bg-lightsuccess dark:bg-success/10 px-2 py-1 rounded my-2">→ <strong>LN GỘP</strong>: <strong class="${lnGopColor}">${fmtNum(lnGop)}</strong></div>
            <div>• Chi khác: <strong>${fmtNum(cKhac)}</strong></div>
            <div class="bg-lightprimary dark:bg-primary/10 px-2 py-1 rounded mt-2">→ <strong>LN THUẦN</strong>: <strong class="${lnThuanColor} text-base">${fmtNum(lnThuan)}</strong> <span class="text-bodytext text-xs">(${bd}%)</span></div>
          </div>
        </div>`;
      }
      lnCards += '</div>';
      lnCards += '<p class="text-xs text-bodytext dark:text-darklink mt-2">Thu VT = Σ thu đầu mục VT · Chi VT = Σ chi đầu mục VT · Chi khác = VP+Chi ngoài · LN thuần = LN gộp − Chi khác</p>';
    }

    /* LN gộp by group */
    const groupStats: Record<string, { thuTT: Record<string,number>; chiTT: Record<string,number> }> = {};
    for (const g of Object.keys(DM_GROUP_LABEL) as DauMucGroup[]) {
      groupStats[g] = { thuTT: {}, chiTT: {} };
    }
    for (const p of allThuForProfit as R[]) {
      const dm = String(p.dau_muc || '');
      const tte = String(p.tien_te || 'PLN');
      const st = Number(p.so_tien) || 0;
      for (const [g, lbl] of Object.entries(DM_GROUP_LABEL)) {
        if (dm === lbl) { groupStats[g].thuTT[tte] = (groupStats[g].thuTT[tte] || 0) + st; break; }
      }
    }
    for (const p of allChiForProfit as R[]) {
      const dm = String(p.dau_muc || '');
      const tte = String(p.tien_te || 'PLN');
      const st = Number(p.so_tien) || 0;
      for (const [g, lbl] of Object.entries(DM_GROUP_LABEL)) {
        if (dm === lbl) { groupStats[g].chiTT[tte] = (groupStats[g].chiTT[tte] || 0) + st; break; }
      }
    }

    let groupLines = '';
    for (const [g, d] of Object.entries(groupStats)) {
      const label = DM_GROUP_LABEL[g as DauMucGroup] || g;
      const allGCcys = new Set([...Object.keys(d.thuTT), ...Object.keys(d.chiTT)]);
      if (allGCcys.size === 0) continue;
      const parts: string[] = [];
      for (const ccy of allGCcys) {
        const tTT = d.thuTT[ccy] || 0;
        const cTT = d.chiTT[ccy] || 0;
        const ln = tTT - cTT;
        const bd = tTT > 0 ? Math.round(ln / tTT * 100) : 0;
        const lnColor = ln >= 0 ? 'text-success' : 'text-error';
        parts.push(`Thu ${fmtNum(tTT)} − Chi ${fmtNum(cTT)} = <strong class="${lnColor}">${fmtNum(ln)} ${ccy}</strong> <span class="text-xs text-bodytext">(${bd}%)</span>`);
      }
      groupLines += `<div class="mb-2"><strong class="text-primary">▸ ${esc(label)}:</strong> ${parts.join(' · ')}</div>`;
    }

    /* Top chi by đầu mục */
    const chiByDM: Record<string, { total: number; count: number; byCcy: Record<string,number> }> = {};
    for (const p of allChiForProfit as R[]) {
      const dm = String(p.dau_muc || '');
      const tte = String(p.tien_te || 'PLN');
      const st = Number(p.so_tien) || 0;
      if (!chiByDM[dm]) chiByDM[dm] = { total: 0, count: 0, byCcy: {} };
      chiByDM[dm].byCcy[tte] = (chiByDM[dm].byCcy[tte] || 0) + st;
      chiByDM[dm].total += st;
      chiByDM[dm].count++;
    }

    const sortedChi = Object.entries(chiByDM).sort((a, b) => b[1].total - a[1].total);
    const totalAllChi = sortedChi.reduce((s, [, v]) => s + v.total, 0);

    let topChiRows = '';
    const topN = sortedChi.slice(0, 10);
    for (let i = 0; i < topN.length; i++) {
      const [dm, v] = topN[i];
      const displayTotal = Object.entries(v.byCcy).map(([t, val]) => fmtNum(val) + ' ' + t).join(' + ');
      const pct = totalAllChi > 0 ? Math.round(v.total / totalAllChi * 100) : 0;
      const barColor = i === 0 ? 'bg-error' : i === 1 ? 'bg-warning' : 'bg-primary';
      topChiRows += tableRow([
        `<strong>${i + 1}</strong>`,
        esc(dm),
        `${v.count}`,
        `<strong class="text-error">${displayTotal}</strong>`,
        `${pct}%`,
        `<div class="w-24 bg-lightgray dark:bg-darkgray rounded-full h-2 overflow-hidden"><div class="h-full ${barColor} rounded-full" style="width:${pct}%"></div></div>`,
      ]);
    }

    profitSection = `
      <div class="mb-6">
        <h3 class="text-base font-semibold text-dark dark:text-white mb-3 flex items-center gap-2">
          <iconify-icon icon="solar:diamond-linear" class="text-primary"></iconify-icon>
          Lợi nhuận vận tải
          <span class="text-xs text-bodytext font-normal">(${rangeLabel(profitRange)})</span>
        </h3>
        ${lnCards}
      </div>

      ${groupLines ? `
      <div class="mb-6">
        <h3 class="text-base font-semibold text-dark dark:text-white mb-3">
          <iconify-icon icon="solar:folder-open-linear" class="text-primary"></iconify-icon>
          Lợi nhuận GỘP theo nhóm vận tải
        </h3>
        ${card({ body: `<div class="text-sm leading-relaxed">${groupLines}</div>` })}
      </div>` : ''}

      ${topChiRows ? `
      <div class="mb-6">
        <h3 class="text-base font-semibold text-dark dark:text-white mb-3">
          <iconify-icon icon="solar:chart-2-linear" class="text-primary"></iconify-icon>
          Top chi nhiều nhất theo đầu mục
          <span class="text-xs text-bodytext font-normal">(${rangeLabel(profitRange)})</span>
        </h3>
        ${dataTable(['#', 'Đầu mục', 'Phiếu', 'Tổng chi', '%', 'Tỉ lệ'], topChiRows)}
        <p class="text-xs text-bodytext dark:text-darklink mt-1">Top đầu = cần xem xét tối ưu (đàm phán giá, gộp đơn, đổi nhà cung cấp)</p>
      </div>` : ''}
    `;
  } else {
    profitSection = card({
      body: '<div class="py-3 text-sm text-bodytext dark:text-darklink"><iconify-icon icon="solar:lock-linear" class="text-warning"></iconify-icon> Báo cáo lợi nhuận chỉ Admin/KTT mới xem được.</div>',
      class: 'mb-6',
    });
  }

  /* ═══════ SECTION: Warnings ═══════ */
  let warnSection = '';
  const warnList = warnResults as R[];
  if (warnList.length > 0) {
    let tongChuaThu: Record<string, number> = {};
    for (const p of warnList) {
      const tte = String(p.tien_te || 'PLN');
      tongChuaThu[tte] = (tongChuaThu[tte] || 0) + (Number(p.so_tien) || 0);
    }
    const tongChips = Object.entries(tongChuaThu).map(([t, v]) => badge(`${fmtNum(v)} ${t}`, 'error')).join(' ');

    const warnRows = warnList.slice(0, 20).map((p) => {
      const days = Math.floor((todayDate.getTime() - new Date(String(p.ngay)).getTime()) / 86400000);
      const rel = String(p.chuyen_xe_id || '') || '—';
      return tableRow([
        `<strong class="font-mono text-xs">${esc(String(p.id))}</strong>`,
        `${esc(String(p.ngay))} <span class="text-error text-xs">(${days}d)</span>`,
        esc(String(p.dau_muc || '')),
        rel !== '—' ? `<a href="/chuyen-xe/${esc(rel)}" class="text-primary hover:underline font-mono text-xs">${esc(rel)}</a>` : '—',
        `<strong class="text-error">${fmtNum(Number(p.so_tien) || 0)} ${p.tien_te}</strong>`,
        `<span class="text-xs">${esc(String(p.ghi_chu || ''))}</span>`,
      ]);
    }).join('');

    warnSection = `
      <div class="mb-6">
        <h3 class="text-base font-semibold text-error mb-3 flex items-center gap-2">
          <iconify-icon icon="solar:danger-triangle-linear"></iconify-icon>
          Cảnh báo: ${warnList.length} phiếu chi PHẢI THU VỀ nhưng chưa có thu
        </h3>
        ${card({
          body: `<div class="flex items-center gap-2 mb-3"><strong class="text-sm">Tổng chưa thu về:</strong> ${tongChips}</div>`,
          class: 'mb-2',
        })}
        ${dataTable(['Mã', 'Ngày', 'Đầu mục', 'Liên quan', 'Số tiền', 'Lý do'], warnRows)}
      </div>`;
  }

  /* ═══════ SECTION: Chốt sổ ═══════ */
  const ccys = ['PLN', 'EUR', 'USD'];
  type DailyBal = { dau: Record<string,number>; thu: Record<string,number>; chi: Record<string,number>; cuoi: Record<string,number> };
  const dailyData: Record<string, DailyBal> = {};
  const reversed = [...csDateList].reverse();
  const runBal = { ...dauKy };

  for (const d of reversed) {
    const thu: Record<string,number> = { PLN: 0, EUR: 0, USD: 0 };
    const chi: Record<string,number> = { PLN: 0, EUR: 0, USD: 0 };
    for (const p of allThuForCS as R[]) {
      if (String(p.ngay) === d) {
        const tte = String(p.tien_te || 'PLN');
        thu[tte] = (thu[tte] || 0) + (Number(p.so_tien) || 0);
      }
    }
    for (const p of allChiForCS as R[]) {
      if (String(p.ngay) === d) {
        const tte = String(p.tien_te || 'PLN');
        chi[tte] = (chi[tte] || 0) + (Number(p.so_tien) || 0);
      }
    }
    const cuoi: Record<string,number> = {};
    for (const ccy of ccys) {
      cuoi[ccy] = (runBal[ccy] || 0) + (thu[ccy] || 0) - (chi[ccy] || 0);
    }
    dailyData[d] = { dau: { ...runBal }, thu, chi, cuoi };
    for (const ccy of ccys) runBal[ccy] = cuoi[ccy];
  }

  let csRows = '';
  for (const d of csDateList) {
    const dd = dailyData[d];
    if (!dd) continue;
    const isToday = d === todayStr;
    const rowCls = isToday ? 'bg-lightwarning dark:bg-warning/10' : '';
    let ccyCells = '';
    for (const ccy of ccys) {
      ccyCells += `<td class="text-center tabular-nums text-xs">${fmtNum(dd.dau[ccy] || 0)} / <span class="text-success">+${fmtNum(dd.thu[ccy] || 0)}</span> / <span class="text-error">−${fmtNum(dd.chi[ccy] || 0)}</span> / <strong>${fmtNum(dd.cuoi[ccy] || 0)}</strong></td>`;
    }
    const statusBadge = isToday ? badge('Đang mở', 'warning') : badge('✓ Khớp', 'success');
    csRows += `<tr class="${rowCls}"><td><strong>${fmtDate(d)}/${d.slice(0, 4)}</strong>${isToday ? ' ' + badge('Hôm nay', 'warning') : ''}</td>${ccyCells}<td class="text-center">${statusBadge}</td></tr>`;
  }

  const csDaysOpts = [3, 7, 14, 30].map(n =>
    `<option value="${n}" ${csDays === n ? 'selected' : ''}>${n} ngày gần nhất</option>`
  ).join('');

  const chotSoSection = `
    <div class="mb-6">
      <h3 class="text-base font-semibold text-dark dark:text-white mb-3 flex items-center gap-2">
        <iconify-icon icon="solar:lock-linear" class="text-primary"></iconify-icon>
        Lịch sử chốt sổ
        <span class="text-xs text-bodytext font-normal">Mỗi dòng = 1 ngày · Thu/Chi riêng từng ngày</span>
      </h3>
      ${card({
        body: `<form method="get" action="/thu-chi" class="flex items-center gap-2 mb-3">
          <input type="hidden" name="loai" value="${esc(loai)}">
          <input type="hidden" name="dau_muc" value="${esc(dauMuc)}">
          <input type="hidden" name="range" value="${esc(range)}">
          <input type="hidden" name="q" value="${esc(q)}">
          <select name="cs_days" class="form-control w-auto" onchange="this.form.submit()">${csDaysOpts}</select>
        </form>
        <div class="overflow-x-auto">
          <table class="htql-table min-w-full w-full text-sm">
            <thead><tr class="border-b border-light-dark">
              <th>Ngày</th>
              <th class="text-center">PLN: Đầu / +Thu / −Chi / Cuối</th>
              <th class="text-center">EUR: Đầu / +Thu / −Chi / Cuối</th>
              <th class="text-center">USD: Đầu / +Thu / −Chi / Cuối</th>
              <th class="text-center">Trạng thái</th>
            </tr></thead>
            <tbody class="divide-y divide-border dark:divide-darkborder">${csRows}</tbody>
          </table>
        </div>`,
      })}
    </div>`;

  /* ═══════ Main content assembly ═══════ */
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

    ${profitSection}

    ${warnSection}

    ${chotSoSection}

    <h3 class="text-base font-semibold text-dark dark:text-white mb-3 flex items-center gap-2">
      <iconify-icon icon="solar:document-text-linear" class="text-primary"></iconify-icon>
      Chi tiết phiếu Thu / Chi
      <span class="text-xs text-bodytext font-normal">Bộ lọc riêng — KHÔNG ảnh hưởng số liệu chốt sổ</span>
    </h3>

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
        ${searchField({ value: esc(q), placeholder: 'Tìm mã / lý do...' })}
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

  const dmOpts = DAU_MUC_THU_CHI.slice(0, 5).map(d => `<option value="${d}">${d}</option>`).join('');

  const content = `
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a href="/thu-chi" class="text-bodytext hover:text-dark dark:hover:text-white"><iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon></a>
        <h2 class="text-xl font-semibold text-dark dark:text-white">+ Tạo Phiếu thu</h2>
      </div>

      ${card({
        body: `<form id="formThu" class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Khách hàng <span class="text-error">*</span></label>
            <select name="khach_hang_id" id="selKh" required class="form-control w-full">
              <option value="">— Chọn KH —</option>
              ${khOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Ngày <span class="text-error">*</span></label>
            <input type="date" name="ngay" value="${today}" required class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Giờ</label>
            <input type="time" name="gio" value="${gio}" class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Đầu mục <span class="text-error">*</span></label>
            <select name="dau_muc" required class="form-control w-full">
              ${dmOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Kiểu QT</label>
            <select name="kieu_qt" class="form-control w-full">
              <option value="trahet">Trả hết</option>
              <option value="ung">Ứng</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Loại tiền (VT/TH)</label>
            <select name="loai_tien" class="form-control w-full">
              <option value="vantai">Vận tải</option>
              <option value="tienhang">Tiền hàng</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Số tiền <span class="text-error">*</span></label>
            <input type="number" name="so_tien" required step="0.01" min="0" class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Tiền tệ</label>
            <select name="tien_te" class="form-control w-full">
              ${TIEN_TE_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Hình thức</label>
            <select name="hinh_thuc" class="form-control w-full">
              ${HINH_THUC_OPTIONS}
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-dark dark:text-white mb-1">Ghi chú</label>
          <input type="text" name="ghi_chu" class="form-control w-full">
        </div>

        <div id="loHangSection" class="hidden">
          <label class="block text-sm font-medium text-dark dark:text-white mb-2">Lô hàng liên quan</label>
          <div id="loHangCheckboxes" class="card-body bg-lightgray dark:bg-darkgray rounded-lg max-h-48 overflow-y-auto space-y-1 text-sm"></div>
        </div>

        <div class="flex gap-3 pt-2">
          ${btnPrimary('Lưu Phiếu thu', { type: 'submit', class: 'bg-success hover:bg-successemphasis' })}
          <a href="/thu-chi" class="btn-outline border-bordergray text-link dark:text-darklink">Hủy</a>
        </div>
      </form>`,
      })}
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
          return '<label class="flex items-center gap-2 p-1.5 hover:bg-lightprimary dark:hover:bg-primary/10 rounded cursor-pointer"><input type="checkbox" name="lo_ids" value="'+l.id+'" class="rounded text-primary"> <span class="font-mono text-xs">'+l.id+'</span> <span class="text-bodytext text-xs">'+dm+' · '+tt+' '+tte+'</span></label>';
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

  const { results: khachList } = await c.env.DB.prepare('SELECT id, ma_kh, ten FROM khach_hang ORDER BY ten').all();
  const { results: hangList } = await c.env.DB.prepare('SELECT id, ten FROM hang ORDER BY ten').all();
  const { results: ctyVTList } = await c.env.DB.prepare('SELECT id, ten FROM cty_van_tai ORDER BY ten').all();

  const nhOpts = `<optgroup label="Khách hàng">${(khachList as Record<string,unknown>[]).map(k => `<option value="kh:${k.id}">${esc(String(k.ten))}</option>`).join('')}</optgroup>
    <optgroup label="Hãng">${(hangList as Record<string,unknown>[]).map(h => `<option value="hang:${h.id}">${esc(String(h.ten))}</option>`).join('')}</optgroup>
    <optgroup label="Cty Vận tải">${(ctyVTList as Record<string,unknown>[]).map(ct => `<option value="cty:${ct.id}">${esc(String(ct.ten))}</option>`).join('')}</optgroup>
    <optgroup label="Khác"><option value="khac:other">Khác (ghi tên ở ghi chú)</option></optgroup>`;

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const gio = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  const content = `
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a href="/thu-chi" class="text-bodytext hover:text-dark dark:hover:text-white"><iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon></a>
        <h2 class="text-xl font-semibold text-dark dark:text-white">+ Tạo Phiếu chi</h2>
      </div>

      ${card({
        body: `<form id="formChi" class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Ngày <span class="text-error">*</span></label>
            <input type="date" name="ngay" value="${today}" required class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Giờ</label>
            <input type="time" name="gio" value="${gio}" class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Đầu mục <span class="text-error">*</span></label>
            <select name="dau_muc" required class="form-control w-full">
              ${DAU_MUC_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Người nhận tiền</label>
            <select name="nguoi_nhan" class="form-control w-full">
              <option value="">— Không —</option>
              ${nhOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Chuyến xe</label>
            <select name="chuyen_xe_id" class="form-control w-full">
              <option value="">— Không liên kết —</option>
              ${cxOpts}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Số tiền <span class="text-error">*</span></label>
            <input type="number" name="so_tien" required step="0.01" min="0" class="form-control w-full">
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Tiền tệ</label>
            <select name="tien_te" class="form-control w-full">
              ${TIEN_TE_OPTIONS}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark dark:text-white mb-1">Hình thức</label>
            <select name="hinh_thuc" class="form-control w-full">
              ${HINH_THUC_OPTIONS}
            </select>
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 py-2 cursor-pointer">
              <input type="checkbox" name="phai_thu_ve" value="1" class="rounded text-warning w-4 h-4">
              <span class="text-sm font-medium text-dark dark:text-white">Phải thu về</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-dark dark:text-white mb-1">Ghi chú</label>
          <input type="text" name="ghi_chu" class="form-control w-full">
        </div>

        <div class="flex gap-3 pt-2">
          ${btnPrimary('Lưu Phiếu chi', { type: 'submit', class: 'bg-error hover:bg-erroremphasis' })}
          <a href="/thu-chi" class="btn-outline border-bordergray text-link dark:text-darklink">Hủy</a>
        </div>
      </form>`,
      })}
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
   GET /thu/print/:id — Print phiếu thu (A5)
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/thu/print/:id', async (c) => {
  const id = c.req.param('id');
  const pt = await c.env.DB.prepare('SELECT * FROM phieu_thu WHERE id=?').bind(id).first() as Record<string,unknown> | null;
  if (!pt) return c.text('Không tìm thấy phiếu', 404);

  const kh = pt.khach_hang_id
    ? await c.env.DB.prepare('SELECT id, ten, ma_kh FROM khach_hang WHERE id=?').bind(pt.khach_hang_id).first() as Record<string,unknown> | null
    : null;

  const loIds: string[] = pt.lo_ids ? JSON.parse(String(pt.lo_ids)) : [];
  let lotsHtml = '';
  if (loIds.length > 0) {
    const placeholders = loIds.map(() => '?').join(',');
    const { results: lots } = await c.env.DB.prepare(
      `SELECT lh.id, lh.don_gia, lh.so_kien, lh.tien_te, cx.ngay_di, t.ten as tuyen_ten
       FROM lo_hang lh LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id LEFT JOIN tuyen t ON cx.tuyen_id = t.id
       WHERE lh.id IN (${placeholders})`
    ).bind(...loIds).all();
    const lotRows = (lots as Record<string,unknown>[]).map(l =>
      `<tr><td>${esc(String(l.id))}</td><td>${l.ngay_di || '—'}</td><td>${esc(String(l.tuyen_ten || '—'))}</td><td style="text-align:right">${fmtNum((Number(l.don_gia)||0) * (Number(l.so_kien)||0))} ${pt.tien_te || 'PLN'}</td></tr>`
    ).join('');
    lotsHtml = `<div style="margin:8px 0"><b>Phiếu liên quan:</b></div>
      <table><tr><th>Mã phiếu</th><th>Ngày</th><th>Tuyến</th><th>Số tiền</th></tr>${lotRows}</table>`;
  }

  const today = new Date().toLocaleDateString('vi-VN');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiếu thu ${esc(String(pt.id))}</title>
<style>
@page{size:A5;margin:1cm}
body{font-family:'Times New Roman',serif;font-size:13px;color:#000;margin:0;padding:14px}
.header{text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
.logo{font-size:22px;font-weight:bold;color:#1e40af}
.company{font-size:11px;color:#444}
h1{text-align:center;font-size:18px;margin:14px 0}
.info{margin:8px 0}
.info b{display:inline-block;min-width:100px}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12px}
table th,table td{border:1px solid #000;padding:4px 6px;text-align:left}
table th{background:#f0f0f0}
.amount{font-size:16px;font-weight:bold;color:#1e40af;text-align:right;margin:10px 0;padding:8px;background:#f8f8f8;border:2px solid #1e40af}
.signs{display:flex;justify-content:space-between;margin-top:30px;text-align:center}
.sign{flex:1}
.sign .role{font-weight:bold;margin-bottom:50px}
.sign .name{border-top:1px dashed #000;padding-top:4px}
.footer{text-align:center;font-size:10px;color:#666;margin-top:20px;border-top:1px solid #ccc;padding-top:6px}
@media print{body{padding:8px} .no-print{display:none}}
</style>
</head><body>
<div class="no-print" style="text-align:right;padding:8px;background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;margin-bottom:14px;font-family:Arial">
  <button onclick="window.print()" style="padding:8px 16px;background:#1e40af;color:white;border:none;border-radius:4px;cursor:pointer">🖨 In ngay (Ctrl+P)</button>
  <button onclick="try{window.close()}catch(e){};if(!window.closed)history.back()" style="padding:8px 16px;background:#6b7280;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:6px">✕ Đóng</button>
</div>
<div class="header">
  <div class="logo">SonLogistics Sp. z o.o.</div>
  <div class="company">Warszawa, Polska | sonlogistics.eu</div>
</div>
<h1>PHIẾU THU TIỀN</h1>
<div style="text-align:right">Số: <b>${esc(String(pt.id))}</b> &nbsp;&nbsp; Ngày: <b>${pt.ngay} ${pt.gio || ''}</b></div>
<div class="info"><b>Khách hàng:</b> ${kh ? esc(String(kh.ten)) + ' (' + esc(String(kh.ma_kh)) + ')' : '—'}</div>
<div class="info"><b>Đầu mục:</b> ${esc(String(pt.dau_muc || ''))}</div>
<div class="info"><b>Loại tiền:</b> ${String(pt.loai_tien) === 'tienhang' ? 'Tiền hàng' : 'Tiền vận tải'}</div>
<div class="info"><b>Hình thức:</b> ${String(pt.hinh_thuc) === 'TM' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
${lotsHtml}
<div class="amount">SỐ TIỀN: ${fmtNum(Number(pt.so_tien) || 0)} ${pt.tien_te || 'PLN'}</div>
${pt.ghi_chu ? `<div class="info"><b>Ghi chú:</b> ${esc(String(pt.ghi_chu))}</div>` : ''}
<div class="signs">
  <div class="sign"><div class="role">NGƯỜI NỘP TIỀN</div><div class="name">${kh ? esc(String(kh.ten)) : '...........................'}</div></div>
  <div class="sign"><div class="role">NGƯỜI NHẬN TIỀN</div><div class="name">${esc(String(pt.nguoi_nhap || '...........................'))}</div></div>
  <div class="sign"><div class="role">KẾ TOÁN TRƯỞNG</div><div class="name">...........................</div></div>
</div>
<div class="footer">Phiếu in lúc ${today} | Liên 1: Lưu | Liên 2: Khách | Liên 3: Kế toán</div>
</body></html>`;

  return c.html(html);
});

/* ══════════════════════════════════════════════════════════════
   GET /chi/print/:id — Print phiếu chi (A5)
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/chi/print/:id', async (c) => {
  const id = c.req.param('id');
  const pc = await c.env.DB.prepare('SELECT * FROM phieu_chi WHERE id=?').bind(id).first() as Record<string,unknown> | null;
  if (!pc) return c.text('Không tìm thấy phiếu', 404);

  const today = new Date().toLocaleDateString('vi-VN');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiếu chi ${esc(String(pc.id))}</title>
<style>
@page{size:A5;margin:1cm}
body{font-family:'Times New Roman',serif;font-size:13px;color:#000;margin:0;padding:14px}
.header{text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
.logo{font-size:22px;font-weight:bold;color:#dc2626}
.company{font-size:11px;color:#444}
h1{text-align:center;font-size:18px;margin:14px 0;color:#dc2626}
.info{margin:8px 0}
.info b{display:inline-block;min-width:100px}
.amount{font-size:16px;font-weight:bold;color:#dc2626;text-align:right;margin:10px 0;padding:8px;background:#fee2e2;border:2px solid #dc2626}
.signs{display:flex;justify-content:space-between;margin-top:30px;text-align:center}
.sign{flex:1}
.sign .role{font-weight:bold;margin-bottom:50px}
.sign .name{border-top:1px dashed #000;padding-top:4px}
.footer{text-align:center;font-size:10px;color:#666;margin-top:20px;border-top:1px solid #ccc;padding-top:6px}
@media print{body{padding:8px} .no-print{display:none}}
</style>
</head><body>
<div class="no-print" style="text-align:right;padding:8px;background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;margin-bottom:14px;font-family:Arial">
  <button onclick="window.print()" style="padding:8px 16px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer">🖨 In ngay (Ctrl+P)</button>
  <button onclick="try{window.close()}catch(e){};if(!window.closed)history.back()" style="padding:8px 16px;background:#6b7280;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:6px">✕ Đóng</button>
</div>
<div class="header">
  <div class="logo">SonLogistics Sp. z o.o.</div>
  <div class="company">Warszawa, Polska | sonlogistics.eu</div>
</div>
<h1>PHIẾU CHI TIỀN</h1>
<div style="text-align:right">Số: <b>${esc(String(pc.id))}</b> &nbsp;&nbsp; Ngày: <b>${pc.ngay} ${pc.gio || ''}</b></div>
<div class="info"><b>Đầu mục:</b> ${esc(String(pc.dau_muc || ''))}</div>
<div class="info"><b>Hình thức:</b> ${String(pc.hinh_thuc) === 'TM' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
<div class="amount">SỐ TIỀN: ${fmtNum(Number(pc.so_tien) || 0)} ${pc.tien_te || 'PLN'}</div>
${pc.ghi_chu ? `<div class="info"><b>Ghi chú:</b> ${esc(String(pc.ghi_chu))}</div>` : ''}
<div class="signs">
  <div class="sign"><div class="role">NGƯỜI NHẬN TIỀN</div><div class="name">...........................</div></div>
  <div class="sign"><div class="role">NGƯỜI CHI TIỀN</div><div class="name">${esc(String(pc.nguoi_nhap || '...........................'))}</div></div>
  <div class="sign"><div class="role">KẾ TOÁN TRƯỞNG</div><div class="name">...........................</div></div>
</div>
<div class="footer">Phiếu in lúc ${today} | Liên 1: Lưu | Liên 2: Người nhận | Liên 3: Kế toán</div>
</body></html>`;

  return c.html(html);
});

/* ══════════════════════════════════════════════════════════════
   GET /doi-soat/:khachId — Đối soát công nợ (enhanced)
   ══════════════════════════════════════════════════════════════ */
thuChiRoutes.get('/doi-soat/:khachId', async (c) => {
  const user = c.get('user');
  const khachId = c.req.param('khachId');

  const khRow = await c.env.DB.prepare(
    'SELECT id, ma_kh, ten, sdt FROM khach_hang WHERE id=?'
  ).bind(khachId).first();
  if (!khRow) return c.text('Không tìm thấy khách hàng', 404);
  const kh = khRow as Record<string,unknown>;
  const khTen = String(kh.ten);
  const khSdt = String(kh.sdt || '');

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

  const { results: ptList } = await c.env.DB.prepare(
    `SELECT * FROM phieu_thu WHERE khach_hang_id=? ORDER BY ngay DESC, gio DESC`
  ).bind(khachId).all();

  type R = Record<string, unknown>;
  const dmLabel: Record<string,string> = { phap:'Vận tải Pháp', y:'Vận tải Ý', tiep:'Vận tải Tiệp', balan:'Vận tải Balan', khac:'Vận tải khác' };

  type PhieuRow = { id:string; ngayDi:string; tuyen:string; dauMuc:string; nguoiGui:string; soKien:number; vtTienTe:string; vtAmount:number; thTienTe:string; thAmount:number };
  const phieuRows: PhieuRow[] = [];
  let totKien = 0;
  const totByVTCcy: Record<string,number> = {};
  const totByTHCcy: Record<string,number> = {};

  type CcyTot = { phai_thu: number; da_thu: number; con_no: number; vt: number; th: number };
  const ccySummary: Record<string, CcyTot> = {};

  for (const l of loList as R[]) {
    const ngayDi = String(l.ngay_di || '');
    const tuyen = String(l.tuyen_ten || '—');
    const dmGroup = String(l.dau_muc_group || 'khac');
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

    if (!ccySummary[vtTienTe]) ccySummary[vtTienTe] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
    ccySummary[vtTienTe].phai_thu += vtAmount;
    ccySummary[vtTienTe].vt += vtAmount;

    if (thAmount > 0) {
      if (!ccySummary[thTienTe]) ccySummary[thTienTe] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
      ccySummary[thTienTe].phai_thu += thAmount;
      ccySummary[thTienTe].th += thAmount;
    }

    phieuRows.push({ id: String(l.id), ngayDi, tuyen, dauMuc, nguoiGui, soKien, vtTienTe, vtAmount, thTienTe, thAmount });
  }

  for (const pt of ptList as R[]) {
    const tte = String(pt.tien_te || 'PLN');
    const soTien = Number(pt.so_tien) || 0;
    if (!ccySummary[tte]) ccySummary[tte] = { phai_thu:0, da_thu:0, con_no:0, vt:0, th:0 };
    ccySummary[tte].da_thu += soTien;
  }

  for (const tte of Object.keys(ccySummary)) {
    ccySummary[tte].con_no = ccySummary[tte].phai_thu - ccySummary[tte].da_thu;
  }

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
    ? `<div class="text-center p-4 bg-lighterror border-2 border-error rounded-lg mb-4">
        <div class="text-lg font-bold text-error">CÒN NỢ</div>
        <div class="text-base font-semibold text-error mt-1">${conNoVTStr.join(' + ')}</div>
        ${conNoTHStr.length ? `<div class="text-base font-semibold text-error">${conNoTHStr.join(' + ')}</div>` : ''}
       </div>`
    : `<div class="text-center p-4 bg-lightsuccess border-2 border-success rounded-lg mb-4">
        <div class="text-lg font-bold text-success">KHÁCH HÀNG ĐÃ THANH TOÁN ĐỦ</div>
       </div>`;

  /* Phieu hang table */
  let phieuHTML = '';
  if (phieuRows.length === 0) {
    phieuHTML = '<div class="text-center text-bodytext py-6">Chưa có phiếu hàng</div>';
  } else {
    const pRows = phieuRows.map(r => `<tr>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">${r.ngayDi}</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs"><strong>${esc(r.tuyen)}</strong><br><span class="text-bodytext">${esc(r.dauMuc)}</span></td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">${esc(r.nguoiGui)}</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right">${r.soKien}</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right bg-lightprimary dark:bg-primary/10 font-semibold">${fmtNum(r.vtAmount)}</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-center bg-lightprimary dark:bg-primary/10">${r.vtTienTe}</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right bg-lightwarning dark:bg-warning/10">${r.thAmount > 0 ? '<strong>' + fmtNum(r.thAmount) + '</strong>' : '—'}</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-center bg-lightwarning dark:bg-warning/10">${r.thAmount > 0 ? r.thTienTe : '—'}</td>
    </tr>`).join('');

    const vtTotRows = Object.entries(totByVTCcy).sort().map(([tte, v]) =>
      `<tr class="bg-lightgray dark:bg-darkgray font-bold"><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs" colspan="3">TỔNG VT ${tte}</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right">${fmtNum(totKien)}</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right bg-lightprimary dark:bg-primary/10">${fmtNum(v)}</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-center bg-lightprimary dark:bg-primary/10">${tte}</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">—</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">—</td></tr>`
    ).join('');
    const thTotRows = Object.entries(totByTHCcy).sort().map(([tte, v]) =>
      `<tr class="bg-lightwarning dark:bg-warning/10 font-bold"><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs" colspan="6">TỔNG TIỀN HÀNG ${tte}</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right">${fmtNum(v)}</td><td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-center">${tte}</td></tr>`
    ).join('');

    phieuHTML = `
      <div class="mb-4">
        <div class="bg-primary text-white px-3 py-1.5 text-sm font-bold rounded-t-lg">Phiếu hàng — chi tiết theo mệnh giá riêng</div>
        <table class="w-full border-collapse text-xs">
          <thead><tr class="bg-lightgray dark:bg-darkgray">
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-left">Ngày</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-left">Tuyến / Đầu mục</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-left">Người gửi</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-right">Kiện</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-right bg-lightprimary dark:bg-primary/10">Tiền VT</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-center bg-lightprimary dark:bg-primary/10">MG VT</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-right bg-lightwarning dark:bg-warning/10">Tiền hàng</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-center bg-lightwarning dark:bg-warning/10">MG TH</th>
          </tr></thead>
          <tbody>${pRows}${vtTotRows}${thTotRows}</tbody>
        </table>
      </div>`;
  }

  /* Payment history table */
  let ttHTML = '';
  const allTT = ptList as R[];
  if (allTT.length === 0) {
    ttHTML = '<div class="text-center text-bodytext py-4">Chưa có thanh toán</div>';
  } else {
    const ttRows = allTT.map(p => {
      const isTH = String(p.loai_tien || 'vantai') === 'tienhang';
      const tag = isTH ? badge('TH', 'warning') : badge('VT', 'primary');
      const ung = String(p.kieu_qt) === 'ung' ? ' <span class="text-warning text-xs">(ứng)</span>' : '';
      return `<tr>
        <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">${esc(String(p.ngay))}</td>
        <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">${esc(String(p.dau_muc))}${ung}</td>
        <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs">${tag}</td>
        <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right font-semibold">${fmtNum(Number(p.so_tien)||0)} ${p.tien_te}</td>
      </tr>`;
    }).join('');

    const totVT: Record<string,number> = {};
    const totTH: Record<string,number> = {};
    for (const p of allTT) {
      const isTH = String(p.loai_tien || 'vantai') === 'tienhang';
      const tte = String(p.tien_te || 'PLN');
      if (isTH) totTH[tte] = (totTH[tte]||0) + Number(p.so_tien||0);
      else totVT[tte] = (totVT[tte]||0) + Number(p.so_tien||0);
    }
    const fmtTot = (m: Record<string,number>) => Object.entries(m).map(([t,v]) => fmtNum(v)+' '+t).join(' + ');
    const totalRow = `<tr class="bg-lightgray dark:bg-darkgray font-bold">
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs" colspan="3">TỔNG ĐÃ THU</td>
      <td class="border border-bordergray dark:border-darkborder px-2 py-1 text-xs text-right">VT: ${fmtTot(totVT)||'0'}<br>TH: ${fmtTot(totTH)||'0'}</td>
    </tr>`;

    ttHTML = `
      <div class="mb-4">
        <div class="bg-success text-white px-3 py-1.5 text-sm font-bold rounded-t-lg">Lịch sử thanh toán</div>
        <table class="w-full border-collapse text-xs">
          <thead><tr class="bg-lightgray dark:bg-darkgray">
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-left">Ngày</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-left">Đầu mục</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-left">Loại</th>
            <th class="border border-bordergray dark:border-darkborder px-2 py-1 text-right">Số tiền</th>
          </tr></thead>
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
      <a href="/thu-chi" class="text-bodytext hover:text-dark dark:hover:text-white"><iconify-icon icon="solar:arrow-left-linear" class="text-xl"></iconify-icon></a>
      <h2 class="text-xl font-semibold text-dark dark:text-white">Đối soát công nợ — ${esc(khTen)}</h2>
    </div>

    <div class="flex flex-wrap gap-2 mb-4 no-print">
      <button onclick="window.print()" class="btn flex items-center gap-1.5 cursor-pointer">
        <iconify-icon icon="solar:printer-linear"></iconify-icon> In / In A5
      </button>
      <button onclick="copyDoiSoatText()" class="btn bg-success hover:bg-successemphasis text-white flex items-center gap-1.5 cursor-pointer">
        <iconify-icon icon="solar:copy-linear"></iconify-icon> Copy Viber/WeChat
      </button>
      ${khSdt ? `<a href="viber://chat?number=${encodeURIComponent(khSdt)}" target="_blank" class="btn bg-info hover:bg-infoemphasis text-white flex items-center gap-1.5">
        <iconify-icon icon="solar:chat-round-dots-linear"></iconify-icon> Mở Viber
      </a>` : ''}
    </div>

    <div class="max-w-3xl mx-auto" id="printArea">
      ${card({
        body: `
          <div class="text-center text-xl font-bold border-b-2 border-dark dark:border-white pb-2 mb-1 text-dark dark:text-white uppercase">${esc(khTen)}</div>
          <div class="text-right text-xs text-bodytext dark:text-darklink mb-3">Đối soát ngày: ${today}${khSdt ? ' · SĐT: ' + esc(khSdt) : ''}</div>
          ${bigText}
          ${phieuHTML}
          ${ttHTML}
        `,
      })}
    </div>

    <script>
    function copyDoiSoatText() {
      let text = "ĐỐI SOÁT CÔNG NỢ\\n";
      text += "Khách: ${esc(khTen)}\\n";
      text += "Ngày: ${today}\\n";
      text += "──────────────\\n";
      ${Object.entries(ccySummary).map(([tte, t]) => `
        text += "\\n${tte}:\\n";
        text += "Phải thu: ${fmtNum(t.phai_thu)}\\n";
        text += "Đã thu: ${fmtNum(t.da_thu)}\\n";
        text += "${t.con_no > 0 ? 'CÒN NỢ' : 'ĐÃ CÂN BẰNG'}: ${fmtNum(Math.abs(t.con_no))} ${tte}\\n";
        text += "──────────────\\n";
      `).join('')}
      text += "\\nVui lòng kiểm tra và phản hồi nếu có sai sót.\\nTrân trọng, SonLogistics";
      navigator.clipboard.writeText(text).then(() => {
        alert('Đã copy text vào clipboard!');
      });
    }
    </script>
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
