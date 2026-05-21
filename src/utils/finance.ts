import { DM_GROUP_LABEL, type DauMucGroup } from '../types';

export type CcyMap = Record<string, number>;

export function fmtCcyMap(m: CcyMap, sep = ' · '): string {
  const entries = Object.entries(m).filter(([, v]) => Math.abs(v) > 0.001);
  if (entries.length === 0) return '0';
  return entries.map(([t, v]) => `${Math.round(v).toLocaleString('vi-VN')} ${t}`).join(sep);
}

export function addCcy(target: CcyMap, tte: string, amount: number): void {
  if (!tte || !amount) return;
  target[tte] = (target[tte] || 0) + amount;
}

/** Customer receivables (VT + tiền hàng) — same rules as doi-tac list */
export async function computeReceivables(db: D1Database): Promise<{
  totalByCcy: CcyMap;
  topDebtors: { id: string; ten: string; ma_kh: string; con_no: CcyMap; qua_han: number }[];
  overdueCount: number;
}> {
  const { results: khList } = await db.prepare('SELECT id, ma_kh, ten, han_tt FROM khach_hang').all<{
    id: string; ma_kh: string; ten: string; han_tt: number;
  }>();

  const { results: loHangAll } = await db.prepare(
    `SELECT lh.id, lh.khach_hang_id, lh.thanh_tien, lh.giam_gia, lh.tien_te, lh.so_tien_hang, lh.tien_te_th,
            cx.ngay_di, cx.ngay_den, t.dau_muc_group
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id`,
  ).all<Record<string, unknown>>();

  const { results: phieuThuAll } = await db.prepare(
    'SELECT khach_hang_id, dau_muc, loai_tien, tien_te, so_tien, lo_ids FROM phieu_thu',
  ).all<Record<string, unknown>>();

  const totalByCcy: CcyMap = {};
  const topDebtors: { id: string; ten: string; ma_kh: string; con_no: CcyMap; qua_han: number }[] = [];
  let overdueCount = 0;
  const today = new Date();

  const ptByKh = new Map<string, typeof phieuThuAll>();
  for (const pt of phieuThuAll) {
    const khId = String(pt.khach_hang_id);
    if (!ptByKh.has(khId)) ptByKh.set(khId, []);
    ptByKh.get(khId)!.push(pt);
  }

  const loByKh = new Map<string, typeof loHangAll>();
  for (const lo of loHangAll) {
    const khId = String(lo.khach_hang_id);
    if (!loByKh.has(khId)) loByKh.set(khId, []);
    loByKh.get(khId)!.push(lo);
  }

  for (const kh of khList) {
    const lots = loByKh.get(kh.id) || [];
    const ptList = ptByKh.get(kh.id) || [];
    const mucs: Record<string, { phai_thu: number; da_thu: number; tte: string }> = {};

    for (const lo of lots) {
      const dmg = String(lo.dau_muc_group || 'khac') as DauMucGroup;
      const dauMuc = DM_GROUP_LABEL[dmg] || 'Vận tải khác';
      const ttVT = Number(lo.thanh_tien) - Number(lo.giam_gia || 0);
      const tienTeVT = String(lo.tien_te || 'PLN');
      const kVT = `${dauMuc}|${tienTeVT}`;
      if (!mucs[kVT]) mucs[kVT] = { phai_thu: 0, da_thu: 0, tte: tienTeVT };
      mucs[kVT].phai_thu += ttVT;

      const soTienHang = Number(lo.so_tien_hang || 0);
      if (soTienHang > 0) {
        const tienTeTH = String(lo.tien_te_th || lo.tien_te || 'PLN');
        const kTH = `${dauMuc} (TH)|${tienTeTH}`;
        if (!mucs[kTH]) mucs[kTH] = { phai_thu: 0, da_thu: 0, tte: tienTeTH };
        mucs[kTH].phai_thu += soTienHang;
      }
    }

    for (const pt of ptList) {
      const lt = String(pt.loai_tien || 'vantai');
      const dauMuc = String(pt.dau_muc || '');
      const tienTe = String(pt.tien_te || 'PLN');
      const k = lt === 'tienhang' ? `${dauMuc} (TH)|${tienTe}` : `${dauMuc}|${tienTe}`;
      if (!mucs[k]) mucs[k] = { phai_thu: 0, da_thu: 0, tte: tienTe };
      mucs[k].da_thu += Number(pt.so_tien || 0);
    }

    const conNo: CcyMap = {};
    for (const m of Object.values(mucs)) {
      const cn = m.phai_thu - m.da_thu;
      if (cn > 0) addCcy(conNo, m.tte, cn);
    }

    const totalKh = Object.values(conNo).reduce((s, v) => s + v, 0);
    if (totalKh <= 0) continue;

    let maxQuaHan = 0;
    const hanTT = kh.han_tt || 30;
    for (const lo of lots) {
      const ngayDi = String(lo.ngay_di || '');
      if (!ngayDi) continue;
      const ttVT = Number(lo.thanh_tien) - Number(lo.giam_gia || 0);
      const loId = String(lo.id);
      let daThuForLo = 0;
      for (const pt of ptList) {
        if (String(pt.lo_ids || '[]').includes(loId)) {
          daThuForLo += Number(pt.so_tien || 0);
        }
      }
      if (ttVT - daThuForLo <= 0) continue;
      const ngayVe = String(lo.ngay_den || ngayDi);
      const han = new Date(new Date(ngayVe).getTime() + hanTT * 86400000);
      const quaHan = Math.floor((today.getTime() - han.getTime()) / 86400000);
      if (quaHan > maxQuaHan) maxQuaHan = quaHan;
    }

    if (maxQuaHan > 0) overdueCount++;
    for (const [tte, v] of Object.entries(conNo)) addCcy(totalByCcy, tte, v);

    topDebtors.push({ id: kh.id, ten: kh.ten, ma_kh: kh.ma_kh, con_no: conNo, qua_han: maxQuaHan });
  }

  topDebtors.sort((a, b) => {
    const ta = Object.values(a.con_no).reduce((s, v) => s + v, 0);
    const tb = Object.values(b.con_no).reduce((s, v) => s + v, 0);
    return tb - ta;
  });

  return { totalByCcy, topDebtors: topDebtors.slice(0, 10), overdueCount };
}

/** Tồn quỹ = số dư đầu kỳ + tổng thu − tổng chi (theo từng loại tiền) */
export async function computeFundBalance(db: D1Database): Promise<{
  byCcy: Record<string, { opening: number; thu: number; chi: number; balance: number }>;
}> {
  const { results: openings } = await db.prepare('SELECT tien_te, so_du FROM so_du_dau_ky').all<{
    tien_te: string; so_du: number;
  }>();
  const { results: thuRows } = await db.prepare(
    'SELECT tien_te, COALESCE(SUM(so_tien), 0) as total FROM phieu_thu GROUP BY tien_te',
  ).all<{ tien_te: string; total: number }>();
  const { results: chiRows } = await db.prepare(
    'SELECT tien_te, COALESCE(SUM(so_tien), 0) as total FROM phieu_chi GROUP BY tien_te',
  ).all<{ tien_te: string; total: number }>();

  const byCcy: Record<string, { opening: number; thu: number; chi: number; balance: number }> = {};
  const ensure = (tte: string) => {
    if (!byCcy[tte]) byCcy[tte] = { opening: 0, thu: 0, chi: 0, balance: 0 };
  };

  for (const o of openings) {
    ensure(o.tien_te);
    byCcy[o.tien_te].opening = o.so_du;
  }
  for (const r of thuRows) {
    ensure(r.tien_te);
    byCcy[r.tien_te].thu = r.total;
  }
  for (const r of chiRows) {
    ensure(r.tien_te);
    byCcy[r.tien_te].chi = r.total;
  }
  for (const tte of Object.keys(byCcy)) {
    const b = byCcy[tte];
    b.balance = b.opening + b.thu - b.chi;
  }

  return { byCcy };
}

/** Công nợ phải trả cty vận tải (chuyến chưa thanh toán) */
export async function computePayablesVT(db: D1Database): Promise<CcyMap> {
  const { results } = await db.prepare(
    `SELECT cx.tien_te, SUM(cx.gia_chuyen) as total
     FROM chuyen_xe cx
     WHERE cx.da_thanh_toan = 0 AND cx.gia_chuyen > 0
     GROUP BY cx.tien_te`,
  ).all<{ tien_te: string; total: number }>();

  const m: CcyMap = {};
  for (const r of results) m[r.tien_te || 'PLN'] = r.total;
  return m;
}
