import { Hono } from 'hono';
import type { Env } from '../types';
import { layout } from '../utils/layout';
import {
  th,
  tableRow,
  tableActions,
  badge,
  badgeIcon,
  btnPrimary,
  btnDanger,
  btnSecondary,
  modalShell,
  modalFooterSplit,
  formGroup,
  input,
  select,
  textarea,
  searchField,
} from '../utils/ui';

export const doiTacRoutes = new Hono<{ Bindings: Env }>();

// ── Helpers ─────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return Number(n).toLocaleString('vi-VN');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtCcyMap(m: Record<string, number>, sep = '<br>'): string {
  const entries = Object.entries(m).filter(([, v]) => v);
  if (entries.length === 0) return '—';
  return entries.map(([t, v]) => `<span class="num">${fmtNum(v)} ${t}</span>`).join(sep);
}

function fmtTotMap(m: Record<string, number>): string {
  const entries = Object.entries(m);
  if (entries.length === 0) return '—';
  return entries.map(([t, v]) => `${fmtNum(v)} ${t}`).join(', ');
}

const DM_GROUP_LABEL: Record<string, string> = {
  phap: 'Vận tải Pháp',
  y: 'Vận tải Ý',
  tiep: 'Vận tải Tiệp',
  balan: 'Vận tải Balan',
  khac: 'Vận tải khác',
};

function doiTacSearchField(search: string): string {
  return searchField({ value: search, placeholder: 'Tìm tên, mã, SĐT...' });
}

function canhBaoTag(quaHan: number): string {
  if (quaHan > 30) return badgeIcon(`${quaHan}d quá hạn`, 'error', 'solar:danger-triangle-bold');
  if (quaHan > 14) return badgeIcon(`${quaHan}d`, 'error', 'solar:bell-bold');
  if (quaHan > 0) return badgeIcon(`${quaHan}d`, 'warning', 'solar:clock-circle-linear');
  if (quaHan > -7) return badgeIcon('Sắp hạn', 'warning', 'solar:clock-circle-linear');
  return badgeIcon('Trong hạn', 'success', 'solar:check-circle-linear');
}

// ── Sub-tab pills HTML ──────────────────────────────────────────

function subTabPills(sub: string, khCount: number, hangCount: number, ctyCount: number): string {
  const pill = (key: string, label: string, count: number, icon: string) => {
    const active = sub === key;
    const cls = active
      ? 'bg-primary text-white'
      : 'bg-lightgray text-bodytext hover:bg-border dark:bg-darkgray dark:text-darklink';
    return `<a href="/doi-tac?sub=${key}" class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${cls}">
      <iconify-icon icon="${icon}" width="18"></iconify-icon>${label} (${count})
    </a>`;
  };
  return `<div class="flex gap-2 mb-4 flex-wrap">
    ${pill('khach', 'Khách', khCount, 'solar:user-linear')}
    ${pill('hang', 'Hãng', hangCount, 'solar:box-linear')}
    ${pill('cty', 'Công ty VT', ctyCount, 'solar:bus-linear')}
  </div>`;
}

// ── GET / — Main page with 3 sub-tabs ──────────────────────────

doiTacRoutes.get('/', async (c) => {
  const user = c.get('user');
  const sub = c.req.query('sub') || 'khach';
  const sort = c.req.query('sort') || 'abc';
  const q = c.req.query('q') || '';
  const db = c.env.DB;

  const [khCountR, hangCountR, ctyCountR] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM khach_hang').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) as cnt FROM hang').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) as cnt FROM cty_van_tai').first<{ cnt: number }>(),
  ]);

  const khCount = khCountR?.cnt ?? 0;
  const hangCount = hangCountR?.cnt ?? 0;
  const ctyCount = ctyCountR?.cnt ?? 0;

  const pills = subTabPills(sub, khCount, hangCount, ctyCount);

  let body = '';

  if (sub === 'khach') {
    body = await renderKhachList(db, sort, q);
  } else if (sub === 'hang') {
    body = await renderHangList(db, sort, q);
  } else {
    body = await renderCtyList(db, q);
  }

  // Modal containers + client-side JS
  const content = `
    ${pills}
    ${body}

    ${modalShell({
      id: 'khModal',
      title: 'Khách hàng mới',
      titleId: 'khModalTitle',
      size: 'lg',
      body: `<form id="khForm" method="POST" action="/doi-tac/api/khach-hang" class="space-y-4">
          <input type="hidden" name="id" id="kh_id">
          ${formGroup('Mã KH', input({ name: 'ma_kh', id: 'kh_ma', required: true, placeholder: 'VD: KH001' }), { required: true })}
          ${formGroup('Tên', input({ name: 'ten', id: 'kh_ten', required: true }), { required: true })}
          <div class="grid grid-cols-2 gap-4">
            ${formGroup('NIP', input({ name: 'nip', id: 'kh_nip' }))}
            ${formGroup('Hạn TT (ngày)', input({ type: 'number', name: 'han_tt', id: 'kh_han', value: '30' }))}
          </div>
          ${formGroup('Địa chỉ', input({ name: 'dia_chi', id: 'kh_dc' }))}
          ${formGroup('SĐT', input({ name: 'sdt', id: 'kh_sdt' }))}
          <div class="grid grid-cols-2 gap-4">
            ${formGroup('Đánh giá', select({ name: 'danh_gia', id: 'kh_dg', options: '<option value="">Mặc định</option><option value="binhthuong">🟡 Bình thường</option><option value="canhbao">🔴 Cảnh báo</option>' }))}
            ${formGroup('Tiền tệ', select({ name: 'tien_te', id: 'kh_tiente', options: '<option value="PLN">PLN</option><option value="EUR">EUR</option><option value="USD">USD</option>' }))}
          </div>
          ${formGroup('Ghi chú', textarea({ name: 'ghi_chu', id: 'kh_ghichu', rows: '2' }))}
        </form>`,
      footer: modalFooterSplit(
        `<span id="khDelBtn" class="hidden">${btnDanger('Xoá', { onclick: 'deleteKh()' })}</span>`,
        `${btnSecondary('Hủy', { onclick: 'closeKhModal()' })}<button type="submit" form="khForm" class="btn cursor-pointer">✓ Lưu</button>`,
      ),
    })}

    ${modalShell({
      id: 'hangModal',
      title: '+ Hãng mới',
      titleId: 'hangModalTitle',
      size: 'lg',
      body: `<form id="hangForm" method="POST" action="/doi-tac/api/hang" class="space-y-4">
          <input type="hidden" name="id" id="hang_id">
          ${formGroup('Tên hãng', input({ name: 'ten', id: 'hang_ten', required: true }), { required: true })}
          ${formGroup('Nước', input({ name: 'nuoc', id: 'hang_nuoc' }))}
          ${formGroup('Địa chỉ', input({ name: 'dia_chi', id: 'hang_dc' }))}
        </form>`,
      footer: modalFooterSplit(
        `<span id="hangDelBtn" class="hidden">${btnDanger('Xoá', { onclick: 'deleteHang()' })}</span>`,
        `${btnSecondary('Hủy', { onclick: 'closeHangModal()' })}<button type="submit" form="hangForm" class="btn cursor-pointer">✓ Lưu</button>`,
      ),
    })}

    ${modalShell({
      id: 'ctyModal',
      title: '+ Cty VT mới',
      titleId: 'ctyModalTitle',
      size: 'xl',
      body: `<form id="ctyForm" method="POST" action="/doi-tac/api/cty-vt" class="space-y-4">
          <input type="hidden" name="id" id="cty_id">
          <div class="grid grid-cols-2 gap-4">
            ${formGroup('Tên ngắn', input({ name: 'ten_ngan', id: 'cty_ten_ngan', placeholder: 'VD: SonLog' }))}
            ${formGroup('Tên đầy đủ', input({ name: 'ten', id: 'cty_ten', required: true, placeholder: 'Tên pháp lý đầy đủ' }), { required: true })}
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${formGroup('NIP', input({ name: 'nip', id: 'cty_nip', placeholder: 'Mã số thuế' }))}
            ${formGroup('Email', input({ type: 'email', name: 'email', id: 'cty_email' }))}
          </div>
          ${formGroup('Địa chỉ', input({ name: 'dia_chi', id: 'cty_dc' }))}
          ${formGroup('SĐT', input({ name: 'sdt', id: 'cty_sdt' }))}
          ${formGroup('Ghi chú (tuyến hay chạy...)', textarea({ name: 'ghi_chu', id: 'cty_ghichu', rows: '2' }))}
        </form>`,
      footer: modalFooterSplit(
        `<span id="ctyDelBtn" class="hidden">${btnDanger('Xoá', { onclick: 'deleteCty()' })}</span>`,
        `${btnSecondary('Hủy', { onclick: 'closeCtyModal()' })}<button type="submit" form="ctyForm" class="btn cursor-pointer">✓ Lưu</button>`,
      ),
    })}

    <script>
    // ── KH Modal ──
    function openKhModal(id) {
      const m = document.getElementById('khModal');
      if (!m) return;
      if (id) {
        document.getElementById('khModalTitle').textContent = 'Sửa khách hàng';
        document.getElementById('khDelBtn').classList.remove('hidden');
        // Fetch KH data and populate
        fetch('/doi-tac/api/khach-hang/' + id).then(r => r.json()).then(d => {
          document.getElementById('kh_id').value = d.id;
          document.getElementById('kh_ma').value = d.ma_kh || '';
          document.getElementById('kh_ten').value = d.ten || '';
          document.getElementById('kh_nip').value = d.nip || '';
          document.getElementById('kh_han').value = d.han_tt || 30;
          document.getElementById('kh_dc').value = d.dia_chi || '';
          document.getElementById('kh_sdt').value = d.sdt || '';
          document.getElementById('kh_dg').value = d.danh_gia || '';
          document.getElementById('kh_tiente').value = d.tien_te || 'PLN';
          document.getElementById('kh_ghichu').value = d.ghi_chu || '';
        });
      } else {
        document.getElementById('khModalTitle').textContent = '+ Khách hàng mới';
        document.getElementById('khDelBtn').classList.add('hidden');
        document.getElementById('khForm').reset();
        document.getElementById('kh_id').value = '';
      }
      htqlOpenModal('khModal');
    }
    function closeKhModal() { htqlCloseModal('khModal'); }
    function deleteKh() {
      const id = document.getElementById('kh_id').value;
      if (!id || !confirm('Xoá khách hàng này?')) return;
      fetch('/doi-tac/api/khach-hang/' + id, { method: 'DELETE' }).then(r => {
        if (r.ok) { closeKhModal(); location.reload(); }
        else { r.text().then(t => alert('Lỗi: ' + t)); }
      });
    }

    // ── Hãng Modal ──
    function openHangModal(id) {
      const m = document.getElementById('hangModal');
      if (id) {
        document.getElementById('hangModalTitle').textContent = 'Sửa hãng';
        document.getElementById('hangDelBtn').classList.remove('hidden');
        fetch('/doi-tac/api/hang/' + id).then(r => r.json()).then(d => {
          document.getElementById('hang_id').value = d.id;
          document.getElementById('hang_ten').value = d.ten || '';
          document.getElementById('hang_nuoc').value = d.nuoc || '';
          document.getElementById('hang_dc').value = d.dia_chi || '';
        });
      } else {
        document.getElementById('hangModalTitle').textContent = '+ Hãng mới';
        document.getElementById('hangDelBtn').classList.add('hidden');
        document.getElementById('hangForm').reset();
        document.getElementById('hang_id').value = '';
      }
      htqlOpenModal('hangModal');
    }
    function closeHangModal() { htqlCloseModal('hangModal'); }
    function deleteHang() {
      const id = document.getElementById('hang_id').value;
      if (!id || !confirm('Xoá hãng này?')) return;
      fetch('/doi-tac/api/hang/' + id, { method: 'DELETE' }).then(r => {
        if (r.ok) { closeHangModal(); location.reload(); }
        else { r.text().then(t => alert('Lỗi: ' + t)); }
      });
    }

    // ── Cty VT Modal ──
    function openCtyModal(id) {
      const m = document.getElementById('ctyModal');
      if (id) {
        document.getElementById('ctyModalTitle').textContent = 'Sửa công ty VT';
        document.getElementById('ctyDelBtn').classList.remove('hidden');
        fetch('/doi-tac/api/cty-vt/' + id).then(r => r.json()).then(d => {
          document.getElementById('cty_id').value = d.id;
          document.getElementById('cty_ten').value = d.ten || '';
          document.getElementById('cty_ten_ngan').value = d.ten_ngan || '';
          document.getElementById('cty_nip').value = d.nip || '';
          document.getElementById('cty_email').value = d.email || '';
          document.getElementById('cty_dc').value = d.dia_chi || '';
          document.getElementById('cty_sdt').value = d.sdt || '';
          document.getElementById('cty_ghichu').value = d.ghi_chu || '';
        });
      } else {
        document.getElementById('ctyModalTitle').textContent = '+ Cty VT mới';
        document.getElementById('ctyDelBtn').classList.add('hidden');
        document.getElementById('ctyForm').reset();
        document.getElementById('cty_id').value = '';
      }
      htqlOpenModal('ctyModal');
    }
    function closeCtyModal() { htqlCloseModal('ctyModal'); }
    function deleteCty() {
      const id = document.getElementById('cty_id').value;
      if (!id || !confirm('Xoá công ty VT này?')) return;
      fetch('/doi-tac/api/cty-vt/' + id, { method: 'DELETE' }).then(r => {
        if (r.ok) { closeCtyModal(); location.reload(); }
        else { r.text().then(t => alert('Lỗi: ' + t)); }
      });
    }

    </script>
  `;

  return c.html(layout('Đối tác', content, user, 'doi-tac'));
});

// ── Render KH List ──────────────────────────────────────────────

interface KhachRow {
  id: string; ma_kh: string; ten: string; nip: string; dia_chi: string;
  sdt: string; han_tt: number; ghi_chu: string; danh_gia: string; danh_gia_manual: string;
}

interface CongNoDM {
  dau_muc: string; tte: string; phai_thu: number; da_thu: number; con_no: number; is_th: boolean;
}

interface CanhBaoInfo { qua_han: number; }

async function renderKhachList(db: D1Database, sort: string, search: string): Promise<string> {
  const { results: khList } = await db.prepare(
    `SELECT k.*, bg.don_gia as bg_don_gia, bg.tien_te as bg_tien_te
     FROM khach_hang k
     LEFT JOIN bang_gia bg ON bg.khach_hang_id = k.id
     ORDER BY k.ten`
  ).all<KhachRow & { bg_don_gia: number | null; bg_tien_te: string | null }>();

  const { results: loHangAll } = await db.prepare(
    `SELECT lh.id, lh.khach_hang_id, lh.chuyen_xe_id, lh.hang_id, lh.so_kien, lh.da_tra_hang,
            lh.thanh_tien, lh.giam_gia, lh.tien_te, lh.so_tien_hang, lh.tien_te_th,
            cx.ngay_di, cx.ngay_den, t.dau_muc_group
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id`
  ).all<Record<string, unknown>>();

  const { results: phieuThuAll } = await db.prepare(
    `SELECT id, khach_hang_id, dau_muc, loai_tien, tien_te, so_tien, kieu_qt, lo_ids
     FROM phieu_thu`
  ).all<Record<string, unknown>>();

  const khCongNo = new Map<string, CongNoDM[]>();
  const khCanhBao = new Map<string, CanhBaoInfo>();
  const khStock = new Map<string, number>();
  const khNoVT = new Map<string, Record<string, number>>();
  const khNoTH = new Map<string, Record<string, number>>();
  const khTotalNo = new Map<string, number>();
  const khPhiKho = new Map<string, number>();

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

    const mucs: Record<string, CongNoDM> = {};

    for (const lo of lots) {
      const dmg = String(lo.dau_muc_group || 'khac');
      const dauMuc = DM_GROUP_LABEL[dmg] || 'Vận tải khác';
      const ttVT = Number(lo.thanh_tien) - Number(lo.giam_gia || 0);
      const tienTeVT = String(lo.tien_te || 'PLN');
      const kVT = `${dauMuc}|${tienTeVT}`;
      if (!mucs[kVT]) mucs[kVT] = { dau_muc: dauMuc, tte: tienTeVT, phai_thu: 0, da_thu: 0, con_no: 0, is_th: false };
      mucs[kVT].phai_thu += ttVT;

      const soTienHang = Number(lo.so_tien_hang || 0);
      if (soTienHang > 0) {
        const tienTeTH = String(lo.tien_te_th || lo.tien_te || 'PLN');
        const kTH = `${dauMuc} (TH)|${tienTeTH}`;
        if (!mucs[kTH]) mucs[kTH] = { dau_muc: `${dauMuc} (Tiền hàng)`, tte: tienTeTH, phai_thu: 0, da_thu: 0, con_no: 0, is_th: true };
        mucs[kTH].phai_thu += soTienHang;
      }
    }

    for (const pt of ptList) {
      const lt = String(pt.loai_tien || 'vantai');
      const dauMuc = String(pt.dau_muc || '');
      const tienTe = String(pt.tien_te || 'PLN');
      const k = lt === 'tienhang' ? `${dauMuc} (TH)|${tienTe}` : `${dauMuc}|${tienTe}`;
      if (!mucs[k]) mucs[k] = { dau_muc: lt === 'tienhang' ? `${dauMuc} (Tiền hàng)` : dauMuc, tte: tienTe, phai_thu: 0, da_thu: 0, con_no: 0, is_th: lt === 'tienhang' };
      mucs[k].da_thu += Number(pt.so_tien || 0);
    }

    const cnList = Object.values(mucs).map(m => ({ ...m, con_no: m.phai_thu - m.da_thu }));
    khCongNo.set(kh.id, cnList);

    const noVT: Record<string, number> = {};
    const noTH: Record<string, number> = {};
    let totalNo = 0;
    for (const c of cnList) {
      if (c.con_no > 0) {
        totalNo += c.con_no;
        if (c.is_th) {
          noTH[c.tte] = (noTH[c.tte] || 0) + c.con_no;
        } else {
          noVT[c.tte] = (noVT[c.tte] || 0) + c.con_no;
        }
      }
    }
    khNoVT.set(kh.id, noVT);
    khNoTH.set(kh.id, noTH);
    khTotalNo.set(kh.id, totalNo);

    let stock = 0;
    for (const lo of lots) {
      const con = Number(lo.so_kien) - Number(lo.da_tra_hang);
      if (con > 0) stock += con;
    }
    khStock.set(kh.id, stock);

    let phiKho = 0;
    const dgKho = 5;
    const today = new Date();
    for (const lo of lots) {
      const con = Number(lo.so_kien) - Number(lo.da_tra_hang);
      if (con <= 0) continue;
      const ngayDen = String(lo.ngay_den || '');
      if (!ngayDen) continue;
      const daysDiff = Math.floor((today.getTime() - new Date(ngayDen).getTime()) / 86400000);
      if (daysDiff > 0) phiKho += con * dgKho * daysDiff;
    }
    khPhiKho.set(kh.id, phiKho);

    let maxQuaHan = 0;
    const hanTT = kh.han_tt || 30;
    for (const lo of lots) {
      const ngayDi = String(lo.ngay_di || '');
      if (!ngayDi) continue;
      const ttVT = Number(lo.thanh_tien) - Number(lo.giam_gia || 0);
      const loId = String(lo.id);
      let daThuForLo = 0;
      for (const pt of ptList) {
        const loIds = String(pt.lo_ids || '[]');
        if (loIds.includes(loId)) {
          daThuForLo += Number(pt.so_tien || 0);
        }
      }
      if (ttVT - daThuForLo <= 0) continue;

      const ngayVe = String(lo.ngay_den || ngayDi);
      const han = new Date(new Date(ngayVe).getTime() + hanTT * 86400000);
      const quaHan = Math.floor((today.getTime() - han.getTime()) / 86400000);
      if (quaHan > maxQuaHan) maxQuaHan = quaHan;
    }
    khCanhBao.set(kh.id, { qua_han: maxQuaHan });
  }

  let sorted = [...khList];
  if (search) {
    const ql = search.toLowerCase();
    sorted = sorted.filter(k =>
      (k.ten || '').toLowerCase().includes(ql) ||
      (k.ma_kh || '').toLowerCase().includes(ql) ||
      (k.nip || '').toLowerCase().includes(ql) ||
      (k.sdt || '').toLowerCase().includes(ql)
    );
  }

  if (sort === 'abc') sorted.sort((a, b) => (a.ten || '').localeCompare(b.ten || ''));
  else if (sort === 'zyx') sorted.sort((a, b) => (b.ten || '').localeCompare(a.ten || ''));
  else if (sort === 'noNhieu') sorted.sort((a, b) => (khTotalNo.get(b.id) || 0) - (khTotalNo.get(a.id) || 0));
  else if (sort === 'noIt') sorted.sort((a, b) => (khTotalNo.get(a.id) || 0) - (khTotalNo.get(b.id) || 0));
  else if (sort === 'cbCao') sorted.sort((a, b) => (khCanhBao.get(b.id)?.qua_han || -999) - (khCanhBao.get(a.id)?.qua_han || -999));
  else if (sort === 'cbThap') sorted.sort((a, b) => (khCanhBao.get(a.id)?.qua_han || 999) - (khCanhBao.get(b.id)?.qua_han || 999));

  function dgAuto(kh: KhachRow): string {
    if (kh.danh_gia_manual) return kh.danh_gia_manual;
    const cb = khCanhBao.get(kh.id);
    if (!cb) return 'binhthuong';
    if (cb.qua_han > 60) return 'canhbao';
    if (cb.qua_han > 0) return 'binhthuong';
    return 'tot';
  }

  const dgBadge = (dg: string): string => {
    if (dg === 'tot') return badge('Tốt', 'success');
    if (dg === 'canhbao') return badge('Cảnh báo', 'error');
    return badge('Bình thường', 'warning');
  };

  const tongAllNo: Record<string, number> = {};
  const tongAllNoVT: Record<string, number> = {};
  const tongAllNoTH: Record<string, number> = {};
  let tongAllPhiKho = 0;

  const rows = sorted.map(kh => {
    const dg = dgAuto(kh);
    const noVT = khNoVT.get(kh.id) || {};
    const noTH = khNoTH.get(kh.id) || {};
    const stock = khStock.get(kh.id) || 0;
    const phiKho = khPhiKho.get(kh.id) || 0;
    tongAllPhiKho += phiKho;

    const tongAll: Record<string, number> = {};
    for (const [t, v] of Object.entries(noVT)) { tongAll[t] = (tongAll[t] || 0) + v; tongAllNoVT[t] = (tongAllNoVT[t] || 0) + v; }
    for (const [t, v] of Object.entries(noTH)) { tongAll[t] = (tongAll[t] || 0) + v; tongAllNoTH[t] = (tongAllNoTH[t] || 0) + v; }
    if (phiKho > 0) { tongAll['PLN'] = (tongAll['PLN'] || 0) + phiKho; }
    for (const [t, v] of Object.entries(tongAll)) { tongAllNo[t] = (tongAllNo[t] || 0) + v; }

    const cb = khCanhBao.get(kh.id);
    const cbBadge = cb ? canhBaoTag(cb.qua_han) : '';

    const bgKh = kh as KhachRow & { bg_don_gia: number | null; bg_tien_te: string | null };
    const bgStr = bgKh.bg_don_gia ? `${fmtNum(bgKh.bg_don_gia)} ${bgKh.bg_tien_te}` : '—';

    const isOver = Object.values(tongAll).some(v => v > 0);
    const tongAllStr = Object.entries(tongAll).length === 0
      ? '0'
      : Object.entries(tongAll).map(([t, v]) => `<strong>${fmtNum(v)} ${t}</strong>`).join('<br>');

    return tableRow([
      `<span class="font-mono font-medium">${esc(kh.ma_kh)}</span>`,
      `<a href="/doi-tac/khach-hang/${kh.id}" class="text-primary hover:underline font-medium">${esc(kh.ten)}</a>`,
      dgBadge(dg),
      cbBadge || '—',
      esc(kh.nip || '—'),
      `<span class="font-medium">${esc((kh as KhachRow & { tien_te?: string }).tien_te || 'PLN')}</span>`,
      `<span class="text-right block">${kh.han_tt || 30}d</span>`,
      `<span class="text-right block">${bgStr}</span>`,
      `<span class="text-right block ${stock > 0 ? 'text-primary font-medium' : ''}">${stock > 0 ? stock : '0'}</span>`,
      `<span class="text-right block ${Object.keys(noVT).length ? 'text-error font-medium' : ''}">${fmtCcyMap(noVT)}</span>`,
      `<span class="text-right block ${Object.keys(noTH).length ? 'text-error font-medium' : ''}">${fmtCcyMap(noTH)}</span>`,
      `<span class="text-right block ${phiKho > 0 ? 'text-primary' : ''}">${phiKho > 0 ? `${fmtNum(phiKho)} PLN` : '—'}</span>`,
      `<span class="text-right block ${isOver ? 'text-error font-bold' : ''}">${tongAllStr}</span>`,
      tableActions(`openKhModal('${kh.id}')`),
    ]);
  }).join('');

  const tongStr = Object.entries(tongAllNo).map(([t, v]) => `${fmtNum(v)} ${t}`).join(' · ');
  const fmtTotM = (m: Record<string, number>) => Object.entries(m).length === 0 ? '—' : Object.entries(m).map(([t, v]) => `${fmtNum(v)} ${t}`).join(', ');

  return `
    <div class="card overflow-hidden">
      <div class="card-body border-b border-light-dark flex flex-nowrap items-center gap-3">
        ${btnPrimary('Khách mới', { icon: 'solar:add-circle-linear', onclick: 'openKhModal()' })}
        <form method="GET" action="/doi-tac" class="flex flex-nowrap items-center gap-2 flex-1 min-w-0 justify-end">
          <input type="hidden" name="sub" value="khach">
          <select name="sort" onchange="this.form.submit()" class="form-control w-auto shrink-0">
            <option value="abc" ${sort === 'abc' ? 'selected' : ''}>A → Z</option>
            <option value="zyx" ${sort === 'zyx' ? 'selected' : ''}>Z → A</option>
            <option value="noNhieu" ${sort === 'noNhieu' ? 'selected' : ''}>Nợ nhiều nhất</option>
            <option value="noIt" ${sort === 'noIt' ? 'selected' : ''}>Nợ ít nhất</option>
            <option value="cbCao" ${sort === 'cbCao' ? 'selected' : ''}>Cảnh báo (cao→thấp)</option>
            <option value="cbThap" ${sort === 'cbThap' ? 'selected' : ''}>Cảnh báo (thấp→cao)</option>
          </select>
          ${doiTacSearchField(search)}
        </form>
      </div>
      <div class="overflow-x-auto">
        <table class="htql-table min-w-full w-full text-sm">
          <thead><tr class="border-b border-light-dark">
            ${th('Mã')}${th('Tên')}${th('Đánh giá')}${th('Cảnh báo')}${th('NIP')}${th('Tiền tệ')}
            ${th('Hạn', { align: 'right' })}${th('Đơn giá', { align: 'right' })}${th('Tồn', { align: 'right' })}
            ${th('Nợ VT', { align: 'right' })}${th('Nợ TH', { align: 'right' })}${th('Phí kho', { align: 'right' })}
            ${th('Tổng nợ', { align: 'right' })}${th('')}
          </tr></thead>
          <tbody class="divide-y divide-border dark:divide-darkborder">${rows}
            <tr class="bg-lightwarning font-semibold border-t-2 border-warning/30">
              <td colspan="9" class="text-right py-3">Tổng ${sorted.length} khách</td>
              <td class="text-right">${fmtTotM(tongAllNoVT)}</td>
              <td class="text-right">${fmtTotM(tongAllNoTH)}</td>
              <td class="text-right">${tongAllPhiKho > 0 ? fmtNum(tongAllPhiKho) + ' PLN' : '—'}</td>
              <td class="text-right text-error font-bold">${tongStr || '0'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Render Hãng List ────────────────────────────────────────────

async function renderHangList(db: D1Database, sort: string, search: string): Promise<string> {
  const { results: hangList } = await db.prepare(
    `SELECT h.*, COUNT(lh.id) as lo_count,
            COALESCE(SUM(CASE WHEN lh.so_tien_hang > 0 THEN lh.so_tien_hang ELSE 0 END), 0) as tong_tien_hang
     FROM hang h
     LEFT JOIN lo_hang lh ON lh.hang_id = h.id
     GROUP BY h.id
     ORDER BY h.ten`
  ).all<Record<string, unknown>>();

  const { results: hangCcy } = await db.prepare(
    `SELECT h.id as hang_id, lh.tien_te_th as tte, COALESCE(lh.tien_te, 'PLN') as tien_te,
            SUM(lh.so_tien_hang) as total
     FROM hang h
     JOIN lo_hang lh ON lh.hang_id = h.id
     WHERE lh.so_tien_hang > 0
     GROUP BY h.id, COALESCE(lh.tien_te_th, lh.tien_te)`
  ).all<{ hang_id: string; tte: string; tien_te: string; total: number }>();

  const hangCcyMap = new Map<string, Record<string, number>>();
  for (const r of hangCcy) {
    if (!hangCcyMap.has(r.hang_id)) hangCcyMap.set(r.hang_id, {});
    const m = hangCcyMap.get(r.hang_id)!;
    const tte = r.tte || r.tien_te || 'PLN';
    m[tte] = (m[tte] || 0) + r.total;
  }

  let sorted = [...hangList];
  if (search) {
    const ql = search.toLowerCase();
    sorted = sorted.filter(h =>
      (String(h.ten || '')).toLowerCase().includes(ql) ||
      (String(h.nuoc || '')).toLowerCase().includes(ql)
    );
  }
  if (sort === 'zyx') sorted.sort((a, b) => String(b.ten || '').localeCompare(String(a.ten || '')));

  const tongMuaAll: Record<string, number> = {};
  for (const h of sorted) {
    const ccy = hangCcyMap.get(String(h.id)) || {};
    for (const [t, v] of Object.entries(ccy)) {
      tongMuaAll[t] = (tongMuaAll[t] || 0) + v;
    }
  }

  const rows = sorted.map(h => {
    const id = String(h.id);
    const ccy = hangCcyMap.get(id) || {};
    const muaStr = Object.entries(ccy).length === 0
      ? '—'
      : Object.entries(ccy).map(([t, v]) => `${fmtNum(v)} ${t}`).join(', ');

    return tableRow([
      `<span class="font-mono text-bodytext">${esc(id)}</span>`,
      `<a href="/doi-tac/hang/${id}" class="text-primary hover:underline font-medium">${esc(String(h.ten || ''))}</a>`,
      esc(String(h.nuoc || '—')),
      esc(String(h.dia_chi || '—')),
      `<span class="text-right block">${Number(h.lo_count || 0)}</span>`,
      `<span class="text-right block">${muaStr}</span>`,
      tableActions(`openHangModal('${id}')`),
    ]);
  }).join('');

  const muaAllStr = Object.entries(tongMuaAll).map(([t, v]) => `${fmtNum(v)} ${t}`).join(' · ') || '0';

  return `
    <div class="card overflow-hidden">
      <div class="card-body border-b border-light-dark flex flex-nowrap items-center gap-3">
        ${btnPrimary('Hãng mới', { icon: 'solar:add-circle-linear', onclick: 'openHangModal()' })}
        <form method="GET" action="/doi-tac" class="flex flex-nowrap items-center gap-2 flex-1 min-w-0 justify-end">
          <input type="hidden" name="sub" value="hang">
          <select name="sort" onchange="this.form.submit()" class="form-control w-auto shrink-0">
            <option value="abc" ${sort === 'abc' ? 'selected' : ''}>A → Z</option>
            <option value="zyx" ${sort === 'zyx' ? 'selected' : ''}>Z → A</option>
          </select>
          ${doiTacSearchField(search)}
        </form>
      </div>
      <div class="overflow-x-auto">
        <table class="htql-table min-w-full w-full text-sm">
          <thead><tr class="border-b border-light-dark">
            ${th('Mã')}${th('Tên')}${th('Nước')}${th('Địa chỉ')}
            ${th('Phiếu', { align: 'right' })}${th('Tổng tiền hàng', { align: 'right' })}${th('')}
          </tr></thead>
          <tbody class="divide-y divide-border dark:divide-darkborder">${rows}
            <tr class="bg-lightwarning font-semibold border-t-2 border-warning/30">
              <td colspan="5" class="text-right py-3">Tổng tiền hàng đã mua qua hãng</td>
              <td class="text-right">${muaAllStr}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Render Cty VT List ──────────────────────────────────────────

async function renderCtyList(db: D1Database, search: string): Promise<string> {
  const { results: ctyList } = await db.prepare(
    `SELECT cvt.*,
            (SELECT COUNT(*) FROM xe x WHERE x.cty_vt_id = cvt.id) as xe_count
     FROM cty_van_tai cvt
     ORDER BY cvt.ten`
  ).all<Record<string, unknown>>();

  const { results: chuyenData } = await db.prepare(
    `SELECT x.cty_vt_id, cx.tien_te, cx.gia_chuyen, cx.da_thanh_toan
     FROM chuyen_xe cx
     JOIN xe x ON cx.xe_id = x.id
     WHERE x.cty_vt_id IS NOT NULL`
  ).all<{ cty_vt_id: string; tien_te: string; gia_chuyen: number; da_thanh_toan: number }>();

  const ctyCongNo = new Map<string, { phai_tra: Record<string, number>; da_tra: Record<string, number>; con_no: Record<string, number> }>();
  for (const ch of chuyenData) {
    if (!ctyCongNo.has(ch.cty_vt_id)) {
      ctyCongNo.set(ch.cty_vt_id, { phai_tra: {}, da_tra: {}, con_no: {} });
    }
    const cn = ctyCongNo.get(ch.cty_vt_id)!;
    const tte = ch.tien_te || 'PLN';
    cn.phai_tra[tte] = (cn.phai_tra[tte] || 0) + ch.gia_chuyen;
    if (ch.da_thanh_toan) {
      cn.da_tra[tte] = (cn.da_tra[tte] || 0) + ch.gia_chuyen;
    }
  }
  for (const [, cn] of ctyCongNo) {
    for (const tte of Object.keys(cn.phai_tra)) {
      const pt = cn.phai_tra[tte] || 0;
      const dt = cn.da_tra[tte] || 0;
      cn.con_no[tte] = pt - dt;
    }
  }

  const tongCtyAll = { phai_tra: {} as Record<string, number>, da_tra: {} as Record<string, number>, con_no: {} as Record<string, number> };

  let sorted = [...ctyList];
  if (search) {
    const ql = search.toLowerCase();
    sorted = sorted.filter(c =>
      (String(c.ten || '')).toLowerCase().includes(ql) ||
      (String(c.ten_ngan || '')).toLowerCase().includes(ql) ||
      (String(c.nip || '')).toLowerCase().includes(ql) ||
      (String(c.dia_chi || '')).toLowerCase().includes(ql) ||
      (String(c.sdt || '')).toLowerCase().includes(ql)
    );
  }

  const fmtCnKey = (cn: { phai_tra: Record<string, number>; da_tra: Record<string, number>; con_no: Record<string, number> }, key: 'phai_tra' | 'da_tra' | 'con_no') => {
    return Object.entries(cn[key]).map(([t, v]) => `${fmtNum(v)} ${t}`).join(', ') || '0';
  };

  const rows = sorted.map(c => {
    const id = String(c.id);
    const cn = ctyCongNo.get(id) || { phai_tra: {}, da_tra: {}, con_no: {} };

    for (const tte of Object.keys(cn.phai_tra)) {
      tongCtyAll.phai_tra[tte] = (tongCtyAll.phai_tra[tte] || 0) + (cn.phai_tra[tte] || 0);
      tongCtyAll.da_tra[tte] = (tongCtyAll.da_tra[tte] || 0) + (cn.da_tra[tte] || 0);
      tongCtyAll.con_no[tte] = (tongCtyAll.con_no[tte] || 0) + (cn.con_no[tte] || 0);
    }

    const isOver = Object.values(cn.con_no).some(v => v > 0);
    const tenNgan = String(c.ten_ngan || '');
    const tenDisplay = tenNgan
      ? `<a href="/doi-tac/cty-vt/${id}" class="text-primary hover:underline font-medium">${esc(tenNgan)}</a><div class="text-xs text-bodytext dark:text-darklink">${esc(String(c.ten || ''))}</div>`
      : `<a href="/doi-tac/cty-vt/${id}" class="text-primary hover:underline font-medium">${esc(String(c.ten || ''))}</a>`;

    return tableRow([
      `<span class="font-mono text-bodytext">${esc(id)}</span>`,
      tenDisplay,
      esc(String(c.nip || '—')),
      esc(String(c.dia_chi || '—')),
      esc(String(c.sdt || '—')),
      `<span class="text-right block">${Number(c.xe_count || 0)}</span>`,
      `<span class="text-right block">${fmtCnKey(cn, 'phai_tra')}</span>`,
      `<span class="text-right block text-success">${fmtCnKey(cn, 'da_tra')}</span>`,
      `<span class="text-right block ${isOver ? 'text-error font-bold' : ''}">${fmtCnKey(cn, 'con_no')}</span>`,
      tableActions(`openCtyModal('${id}')`),
    ]);
  }).join('');

  const fmtAllKey = (key: 'phai_tra' | 'da_tra' | 'con_no') => {
    return Object.entries(tongCtyAll[key]).map(([t, v]) => `${fmtNum(v)} ${t}`).join(' · ') || '0';
  };

  return `
    <div class="card overflow-hidden">
      <div class="card-body border-b border-light-dark flex flex-nowrap items-center gap-3">
        ${btnPrimary('Cty VT mới', { icon: 'solar:add-circle-linear', onclick: 'openCtyModal()' })}
        <form method="GET" action="/doi-tac" class="flex flex-nowrap items-center gap-2 flex-1 min-w-0 justify-end">
          <input type="hidden" name="sub" value="cty">
          ${doiTacSearchField(search)}
        </form>
      </div>
      <div class="overflow-x-auto">
        <table class="htql-table min-w-full w-full text-sm">
          <thead><tr class="border-b border-light-dark">
            ${th('Mã')}${th('Tên')}${th('NIP')}${th('Địa chỉ')}${th('SĐT')}${th('Xe', { align: 'right' })}
            ${th('Phải trả', { align: 'right' })}${th('Đã trả', { align: 'right' })}${th('Còn nợ', { align: 'right' })}${th('')}
          </tr></thead>
          <tbody class="divide-y divide-border dark:divide-darkborder">${rows}
            <tr class="bg-lightwarning font-semibold border-t-2 border-warning/30">
              <td colspan="6" class="text-right py-3">Tổng tất cả cty VT</td>
              <td class="text-right">${fmtAllKey('phai_tra')}</td>
              <td class="text-right text-success">${fmtAllKey('da_tra')}</td>
              <td class="text-right text-error font-bold">${fmtAllKey('con_no')}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── GET /khach-hang/:id — KH Detail ─────────────────────────────

doiTacRoutes.get('/khach-hang/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = c.env.DB;

  const kh = await db.prepare('SELECT * FROM khach_hang WHERE id = ?').bind(id).first<KhachRow>();
  if (!kh) return c.redirect('/doi-tac');

  const { results: lots } = await db.prepare(
    `SELECT lh.*, cx.ngay_di, cx.ngay_den, t.ten as tuyen_ten, t.mau as tuyen_mau, h.ten as hang_ten
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     LEFT JOIN hang h ON lh.hang_id = h.id
     WHERE lh.khach_hang_id = ?
     ORDER BY cx.ngay_di DESC`
  ).bind(id).all<Record<string, unknown>>();

  const { results: phieuThus } = await db.prepare(
    `SELECT * FROM phieu_thu WHERE khach_hang_id = ? ORDER BY ngay DESC, gio DESC`
  ).bind(id).all<Record<string, unknown>>();

  const mucs: Record<string, CongNoDM> = {};

  for (const lo of lots) {
    const dmg = String(lo.dau_muc_group || 'khac');
    const dauMuc = DM_GROUP_LABEL[dmg] || 'Vận tải khác';
    const ttVT = Number(lo.thanh_tien) - Number(lo.giam_gia || 0);
    const tienTeVT = String(lo.tien_te || 'PLN');
    const kVT = `${dauMuc}|${tienTeVT}`;
    if (!mucs[kVT]) mucs[kVT] = { dau_muc: dauMuc, tte: tienTeVT, phai_thu: 0, da_thu: 0, con_no: 0, is_th: false };
    mucs[kVT].phai_thu += ttVT;

    const soTienHang = Number(lo.so_tien_hang || 0);
    if (soTienHang > 0) {
      const tienTeTH = String(lo.tien_te_th || lo.tien_te || 'PLN');
      const kTH = `${dauMuc} (TH)|${tienTeTH}`;
      if (!mucs[kTH]) mucs[kTH] = { dau_muc: `${dauMuc} (Tiền hàng)`, tte: tienTeTH, phai_thu: 0, da_thu: 0, con_no: 0, is_th: true };
      mucs[kTH].phai_thu += soTienHang;
    }
  }

  for (const pt of phieuThus) {
    const lt = String(pt.loai_tien || 'vantai');
    const dauMuc = String(pt.dau_muc || '');
    const tienTe = String(pt.tien_te || 'PLN');
    const k = lt === 'tienhang' ? `${dauMuc} (TH)|${tienTe}` : `${dauMuc}|${tienTe}`;
    if (!mucs[k]) mucs[k] = { dau_muc: lt === 'tienhang' ? `${dauMuc} (Tiền hàng)` : dauMuc, tte: tienTe, phai_thu: 0, da_thu: 0, con_no: 0, is_th: lt === 'tienhang' };
    mucs[k].da_thu += Number(pt.so_tien || 0);
  }

  const cnList = Object.values(mucs).map(m => ({ ...m, con_no: m.phai_thu - m.da_thu }));

  const totByCcy: Record<string, { phai_thu: number; da_thu: number; con_no: number; vt: number; th: number }> = {};
  for (const m of cnList) {
    if (!totByCcy[m.tte]) totByCcy[m.tte] = { phai_thu: 0, da_thu: 0, con_no: 0, vt: 0, th: 0 };
    totByCcy[m.tte].phai_thu += m.phai_thu;
    totByCcy[m.tte].da_thu += m.da_thu;
    totByCcy[m.tte].con_no += m.con_no;
    if (m.is_th) totByCcy[m.tte].th += Math.max(0, m.con_no);
    else totByCcy[m.tte].vt += Math.max(0, m.con_no);
  }

  const fmtMap = (m: Record<string, number>) => Object.entries(m).filter(([, v]) => v).map(([t, v]) => `${fmtNum(v)} ${t}`).join('<br>') || '0';

  const dgAuto = kh.danh_gia_manual || 'tot';

  const bg = await db.prepare('SELECT don_gia, tien_te FROM bang_gia WHERE khach_hang_id = ?').bind(id).first<{ don_gia: number; tien_te: string }>();

  const content = `
    <a href="/doi-tac" class="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mb-4">← Quay lại danh sách</a>

    <!-- Hero -->
    <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white mb-6">
      <div class="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold">👤 ${esc(kh.ten)}</h1>
          <p class="text-blue-100 mt-1 text-sm">${esc(kh.id)} · ${esc(kh.nip || 'NIP: —')} · ${esc(kh.dia_chi || '')} · ${esc(kh.sdt || '—')}</p>
          <div class="mt-3 flex gap-2 flex-wrap">
            <span class="bg-white/20 px-3 py-1 rounded-full text-xs">${dgAuto === 'tot' ? '🟢 Tốt' : dgAuto === 'canhbao' ? '🔴 Cảnh báo' : '🟡 Bình thường'}</span>
            <span class="bg-white/20 px-3 py-1 rounded-full text-xs">Hạn TT: ${kh.han_tt || 30} ngày</span>
            ${bg ? `<span class="bg-white/20 px-3 py-1 rounded-full text-xs">Đơn giá: ${fmtNum(bg.don_gia)} ${bg.tien_te}</span>` : ''}
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="openKhModal('${kh.id}')" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm cursor-pointer">✏ Sửa</button>
        </div>
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-xs text-gray-500 mb-1">📦 Tổng phiếu hàng</div>
        <div class="text-2xl font-bold text-gray-900">${lots.length}</div>
        <div class="text-xs text-gray-400">${lots.filter(l => Number(l.so_kien) === Number(l.da_tra_hang)).length} đã trả hết</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-xs text-gray-500 mb-1">💰 Tổng phải thu</div>
        <div class="text-sm font-bold text-gray-900">${fmtMap(Object.fromEntries(Object.entries(totByCcy).map(([t, v]) => [t, v.phai_thu])) as Record<string, number>)}</div>
      </div>
      <div class="bg-white rounded-xl border border-green-200 bg-green-50 p-4">
        <div class="text-xs text-green-600 mb-1">✅ Đã thu</div>
        <div class="text-sm font-bold text-green-700">${fmtMap(Object.fromEntries(Object.entries(totByCcy).map(([t, v]) => [t, v.da_thu])) as Record<string, number>)}</div>
        <div class="text-xs text-gray-400">${phieuThus.length} phiếu thu</div>
      </div>
      <div class="bg-white rounded-xl border ${Object.values(totByCcy).some(v => v.con_no > 0) ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'} p-4">
        <div class="text-xs ${Object.values(totByCcy).some(v => v.con_no > 0) ? 'text-red-600' : 'text-green-600'} mb-1">🔴 Còn nợ</div>
        <div class="text-sm font-bold ${Object.values(totByCcy).some(v => v.con_no > 0) ? 'text-red-700' : 'text-green-700'}">
          ${Object.entries(totByCcy).filter(([, v]) => v.con_no > 0).length > 0
            ? Object.entries(totByCcy).filter(([, v]) => v.con_no > 0).map(([t, v]) => `${fmtNum(v.con_no)} ${t}`).join('<br>')
            : '✓ 0'}
        </div>
      </div>
    </div>

    <!-- Công nợ chi tiết by đầu mục -->
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">⚖ Bóc tách công nợ theo đầu mục + mệnh giá</div>
      ${cnList.length === 0
        ? '<div class="p-8 text-center text-gray-400">Không có giao dịch</div>'
        : `<div class="overflow-x-auto"><table class="w-full text-left">
            <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
              <th class="px-4 py-3">Đầu mục</th><th class="px-4 py-3">Loại</th><th class="px-4 py-3">Mệnh giá</th>
              <th class="px-4 py-3 text-right">Phải thu</th><th class="px-4 py-3 text-right">Đã thu</th><th class="px-4 py-3 text-right">Còn nợ</th>
            </tr></thead><tbody>
            ${cnList.sort((a, b) => b.con_no - a.con_no).map(m => {
              const tag = m.is_th
                ? '<span class="inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">TH</span>'
                : '<span class="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">VT</span>';
              const noteStyle = m.da_thu > 0 && m.phai_thu === 0 ? 'bg-amber-50' : '';
              const noteText = m.da_thu > 0 && m.phai_thu === 0 ? ' ⚠ Mismatch' : '';
              return `<tr class="${noteStyle} hover:bg-gray-50 border-b border-gray-50">
                <td class="px-4 py-2 text-sm">${esc(m.dau_muc.replace(' (Tiền hàng)', ''))}</td>
                <td class="px-4 py-2 text-sm">${tag}</td>
                <td class="px-4 py-2 text-sm font-medium">${m.tte}</td>
                <td class="px-4 py-2 text-sm text-right">${fmtNum(m.phai_thu)}</td>
                <td class="px-4 py-2 text-sm text-right text-green-600">${fmtNum(m.da_thu)}</td>
                <td class="px-4 py-2 text-sm text-right font-bold ${m.con_no > 0 ? 'text-red-600' : 'text-green-600'}">${fmtNum(m.con_no)}${noteText}</td>
              </tr>`;
            }).join('')}
            </tbody></table></div>`
      }
    </div>

    <!-- Phiếu hàng -->
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">📦 Phiếu hàng (${lots.length})</div>
      ${lots.length === 0
        ? '<div class="p-8 text-center text-gray-400">Chưa có phiếu</div>'
        : `<div class="overflow-x-auto"><table class="w-full text-left">
            <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
              <th class="px-4 py-3">Mã</th><th class="px-4 py-3">Ngày</th><th class="px-4 py-3">Tuyến</th><th class="px-4 py-3">Hãng</th>
              <th class="px-4 py-3 text-right">Kiện</th><th class="px-4 py-3 text-right">Tiền VT</th><th class="px-4 py-3 text-right">Tiền hàng</th><th class="px-4 py-3">Trạng thái</th>
            </tr></thead><tbody>
            ${lots.map(l => {
              const con = Number(l.so_kien) - Number(l.da_tra_hang);
              const trangThai = con <= 0
                ? '<span class="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">✓ Đã trả</span>'
                : '<span class="inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">Còn lưu kho</span>';
              const tuyenMau = String(l.tuyen_mau || 'gray');
              return `<tr class="hover:bg-gray-50 border-b border-gray-50">
                <td class="px-4 py-2 text-sm font-medium">${esc(String(l.id))}</td>
                <td class="px-4 py-2 text-sm">${fmtDate(String(l.ngay_di))}</td>
                <td class="px-4 py-2 text-sm">${l.tuyen_ten ? `<span class="inline-block px-2 py-0.5 text-xs rounded bg-${tuyenMau}-100 text-${tuyenMau}-700">${esc(String(l.tuyen_ten))}</span>` : '—'}</td>
                <td class="px-4 py-2 text-sm">${esc(String(l.hang_ten || ''))}</td>
                <td class="px-4 py-2 text-sm text-right">${Number(l.so_kien)}</td>
                <td class="px-4 py-2 text-sm text-right">${fmtNum(Number(l.thanh_tien) - Number(l.giam_gia || 0))} ${l.tien_te}</td>
                <td class="px-4 py-2 text-sm text-right">${Number(l.so_tien_hang) > 0 ? `${fmtNum(Number(l.so_tien_hang))} ${l.tien_te_th || l.tien_te}` : '—'}</td>
                <td class="px-4 py-2 text-sm">${trangThai}</td>
              </tr>`;
            }).join('')}
            </tbody></table></div>`
      }
    </div>

    <!-- Phiếu thu gần nhất -->
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">💰 Phiếu thu gần nhất (${phieuThus.length})</div>
      ${phieuThus.length === 0
        ? '<div class="p-8 text-center text-gray-400">Chưa có thanh toán</div>'
        : `<div class="overflow-x-auto"><table class="w-full text-left">
            <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
              <th class="px-4 py-3">Mã</th><th class="px-4 py-3">Ngày giờ</th><th class="px-4 py-3">Đầu mục</th><th class="px-4 py-3">Loại</th>
              <th class="px-4 py-3 text-right">Số tiền</th><th class="px-4 py-3">HT</th>
            </tr></thead><tbody>
            ${phieuThus.slice(0, 20).map(p => {
              const isTH = String(p.loai_tien || 'vantai') === 'tienhang';
              const tag = isTH
                ? '<span class="inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">TH</span>'
                : '<span class="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">VT</span>';
              return `<tr class="hover:bg-gray-50 border-b border-gray-50">
                <td class="px-4 py-2 text-sm font-medium">${esc(String(p.id))}</td>
                <td class="px-4 py-2 text-sm">${fmtDate(String(p.ngay))} ${String(p.gio || '')}</td>
                <td class="px-4 py-2 text-sm">${esc(String(p.dau_muc || ''))}</td>
                <td class="px-4 py-2 text-sm">${tag}</td>
                <td class="px-4 py-2 text-sm text-right font-bold">${fmtNum(Number(p.so_tien))} ${p.tien_te}</td>
                <td class="px-4 py-2 text-sm">${String(p.hinh_thuc || '')}</td>
              </tr>`;
            }).join('')}
            ${phieuThus.length > 20 ? `<tr><td colspan="6" class="px-4 py-3 text-center text-gray-400 text-sm">... và ${phieuThus.length - 20} phiếu thu cũ hơn</td></tr>` : ''}
            </tbody></table></div>`
      }
    </div>

    ${kh.ghi_chu ? `
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">📝 Ghi chú</div>
      <div class="px-6 py-4 text-sm text-gray-700">${esc(kh.ghi_chu)}</div>
    </div>` : ''}
  `;

  return c.html(layout(`Đối tác — ${kh.ten}`, content, user, 'doi-tac'));
});

// ── GET /hang/:id — Hãng Detail ─────────────────────────────────

doiTacRoutes.get('/hang/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = c.env.DB;

  const h = await db.prepare('SELECT * FROM hang WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!h) return c.redirect('/doi-tac');

  const { results: lots } = await db.prepare(
    `SELECT lh.*, cx.ngay_di, t.ten as tuyen_ten, t.mau as tuyen_mau, kh.ten as khach_ten, kh.id as khach_id
     FROM lo_hang lh
     LEFT JOIN chuyen_xe cx ON lh.chuyen_xe_id = cx.id
     LEFT JOIN tuyen t ON cx.tuyen_id = t.id
     LEFT JOIN khach_hang kh ON lh.khach_hang_id = kh.id
     WHERE lh.hang_id = ?
     ORDER BY cx.ngay_di DESC`
  ).bind(id).all<Record<string, unknown>>();

  const tienHangByCcy: Record<string, number> = {};
  const khachIds = new Set<string>();
  let tongKien = 0;
  for (const l of lots) {
    const sth = Number(l.so_tien_hang || 0);
    if (sth > 0) {
      const tte = String(l.tien_te_th || l.tien_te || 'PLN');
      tienHangByCcy[tte] = (tienHangByCcy[tte] || 0) + sth;
    }
    khachIds.add(String(l.khach_id));
    tongKien += Number(l.so_kien || 0);
  }

  const fmtMap = (m: Record<string, number>) => Object.entries(m).filter(([, v]) => v).map(([t, v]) => `${fmtNum(v)} ${t}`).join('<br>') || '0';

  const content = `
    <a href="/doi-tac?sub=hang" class="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mb-4">← Quay lại danh sách</a>

    <!-- Hero -->
    <div class="bg-gradient-to-r from-amber-500 to-amber-700 rounded-xl p-6 text-white mb-6">
      <div class="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold">🏭 ${esc(String(h.ten || ''))}</h1>
          <p class="text-amber-100 mt-1 text-sm">${esc(String(h.id))} · 🌍 ${esc(String(h.nuoc || ''))} · ${esc(String(h.dia_chi || ''))}</p>
        </div>
        <button onclick="openHangModal('${String(h.id)}')" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm cursor-pointer">✏ Sửa</button>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-xs text-gray-500 mb-1">📦 Tổng phiếu hàng</div>
        <div class="text-2xl font-bold">${lots.length}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-xs text-gray-500 mb-1">👥 Số khách hàng</div>
        <div class="text-2xl font-bold">${khachIds.size}</div>
      </div>
      <div class="bg-white rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div class="text-xs text-amber-600 mb-1">💰 Tổng tiền hàng đã trả hộ</div>
        <div class="text-sm font-bold">${fmtMap(tienHangByCcy)}</div>
      </div>
      <div class="bg-white rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div class="text-xs text-purple-600 mb-1">📊 Tổng kiện</div>
        <div class="text-2xl font-bold">${fmtNum(tongKien)}</div>
      </div>
    </div>

    <!-- Phiếu hàng -->
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">📦 Danh sách phiếu (${lots.length})</div>
      ${lots.length === 0
        ? '<div class="p-8 text-center text-gray-400">Chưa có phiếu</div>'
        : `<div class="overflow-x-auto"><table class="w-full text-left">
            <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
              <th class="px-4 py-3">Mã</th><th class="px-4 py-3">Ngày</th><th class="px-4 py-3">Khách</th><th class="px-4 py-3">Tuyến</th>
              <th class="px-4 py-3 text-right">Kiện</th><th class="px-4 py-3 text-right">Tiền VT</th><th class="px-4 py-3 text-right">Tiền hàng</th>
            </tr></thead><tbody>
            ${lots.map(l => {
              const tuyenMau = String(l.tuyen_mau || 'gray');
              return `<tr class="hover:bg-gray-50 border-b border-gray-50">
                <td class="px-4 py-2 text-sm font-medium">${esc(String(l.id))}</td>
                <td class="px-4 py-2 text-sm">${fmtDate(String(l.ngay_di))}</td>
                <td class="px-4 py-2 text-sm"><a href="/doi-tac/khach-hang/${String(l.khach_id)}" class="text-blue-600 hover:underline">${esc(String(l.khach_ten || ''))}</a></td>
                <td class="px-4 py-2 text-sm">${l.tuyen_ten ? `<span class="inline-block px-2 py-0.5 text-xs rounded bg-${tuyenMau}-100 text-${tuyenMau}-700">${esc(String(l.tuyen_ten))}</span>` : '—'}</td>
                <td class="px-4 py-2 text-sm text-right">${Number(l.so_kien)}</td>
                <td class="px-4 py-2 text-sm text-right">${fmtNum(Number(l.thanh_tien) - Number(l.giam_gia || 0))} ${l.tien_te}</td>
                <td class="px-4 py-2 text-sm text-right">${Number(l.so_tien_hang) > 0 ? `${fmtNum(Number(l.so_tien_hang))} ${l.tien_te_th || l.tien_te}` : '—'}</td>
              </tr>`;
            }).join('')}
            </tbody></table></div>`
      }
    </div>
  `;

  return c.html(layout(`Đối tác — ${String(h.ten)}`, content, user, 'doi-tac'));
});

// ── GET /cty-vt/:id — Cty VT Detail ─────────────────────────────

doiTacRoutes.get('/cty-vt/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = c.env.DB;

  const cty = await db.prepare('SELECT * FROM cty_van_tai WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!cty) return c.redirect('/doi-tac');

  const { results: xes } = await db.prepare(
    'SELECT * FROM xe WHERE cty_vt_id = ?'
  ).bind(id).all<Record<string, unknown>>();

  const xeIds = xes.map(x => String(x.id));
  let chuyens: Record<string, unknown>[] = [];
  if (xeIds.length > 0) {
    const placeholders = xeIds.map(() => '?').join(',');
    const { results: chResults } = await db.prepare(
      `SELECT cx.*, t.ten as tuyen_ten, t.mau as tuyen_mau, x.so_xe
       FROM chuyen_xe cx
       LEFT JOIN tuyen t ON cx.tuyen_id = t.id
       LEFT JOIN xe x ON cx.xe_id = x.id
       WHERE cx.xe_id IN (${placeholders})
       ORDER BY cx.ngay_den DESC`
    ).bind(...xeIds).all<Record<string, unknown>>();
    chuyens = chResults;
  }

  // Công nợ
  const cnByTte: Record<string, { phai_tra: number; da_tra: number; con_no: number }> = {};
  for (const ch of chuyens) {
    const tte = String(ch.tien_te || 'PLN');
    const gia = Number(ch.gia_chuyen || 0);
    if (!cnByTte[tte]) cnByTte[tte] = { phai_tra: 0, da_tra: 0, con_no: 0 };
    cnByTte[tte].phai_tra += gia;
    if (Number(ch.da_thanh_toan)) cnByTte[tte].da_tra += gia;
  }
  for (const tte of Object.keys(cnByTte)) {
    cnByTte[tte].con_no = cnByTte[tte].phai_tra - cnByTte[tte].da_tra;
  }

  const fmtMap = (m: Record<string, number>) => Object.entries(m).filter(([, v]) => v).map(([t, v]) => `${fmtNum(v)} ${t}`).join('<br>') || '0';

  const tongPhaiTra: Record<string, number> = {};
  const tongDaTra: Record<string, number> = {};
  const tongConNo: Record<string, number> = {};
  for (const [tte, v] of Object.entries(cnByTte)) {
    tongPhaiTra[tte] = v.phai_tra;
    tongDaTra[tte] = v.da_tra;
    if (v.con_no > 0) tongConNo[tte] = v.con_no;
  }

  const content = `
    <a href="/doi-tac?sub=cty" class="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mb-4">← Quay lại danh sách</a>

    <!-- Hero -->
    <div class="bg-gradient-to-r from-cyan-600 to-cyan-800 rounded-xl p-6 text-white mb-6">
      <div class="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold">🚛 ${esc(String(cty.ten_ngan || cty.ten || ''))}</h1>
          ${String(cty.ten_ngan || '') ? `<p class="text-cyan-200 text-sm">${esc(String(cty.ten || ''))}</p>` : ''}
          <p class="text-cyan-100 mt-1 text-sm">${esc(String(cty.id))}${String(cty.nip || '') ? ` · NIP: ${esc(String(cty.nip))}` : ''} · ${esc(String(cty.dia_chi || ''))} · ${esc(String(cty.sdt || '—'))}${String(cty.email || '') ? ` · ${esc(String(cty.email))}` : ''}</p>
          ${String(cty.ghi_chu || '') ? `<p class="text-cyan-200 text-xs mt-2">📝 ${esc(String(cty.ghi_chu))}</p>` : ''}
        </div>
        <button onclick="openCtyModal('${String(cty.id)}')" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm cursor-pointer">✏ Sửa</button>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-xs text-gray-500 mb-1">🚚 Số xe</div>
        <div class="text-2xl font-bold">${xes.length}</div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="text-xs text-gray-500 mb-1">📅 Số chuyến</div>
        <div class="text-2xl font-bold">${chuyens.length}</div>
        <div class="text-xs text-gray-400">${chuyens.filter(ch => Number(ch.da_thanh_toan)).length} đã thanh toán</div>
      </div>
      <div class="bg-white rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div class="text-xs text-amber-600 mb-1">💰 Tổng phải trả</div>
        <div class="text-sm font-bold">${fmtMap(tongPhaiTra)}</div>
      </div>
      <div class="bg-white rounded-xl border border-green-200 bg-green-50 p-4">
        <div class="text-xs text-green-600 mb-1">✅ Đã trả</div>
        <div class="text-sm font-bold">${fmtMap(tongDaTra)}</div>
      </div>
      <div class="bg-white rounded-xl border ${Object.keys(tongConNo).length > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'} p-4">
        <div class="text-xs ${Object.keys(tongConNo).length > 0 ? 'text-red-600' : 'text-green-600'} mb-1">🔴 Còn nợ</div>
        <div class="text-sm font-bold ${Object.keys(tongConNo).length > 0 ? 'text-red-700' : 'text-green-700'}">
          ${Object.keys(tongConNo).length > 0 ? Object.entries(tongConNo).map(([t, v]) => `${fmtNum(v)} ${t}`).join('<br>') : '✓ 0'}
        </div>
      </div>
    </div>

    <!-- Xe -->
    ${xes.length > 0 ? `
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">🚚 Xe (${xes.length})</div>
      <div class="overflow-x-auto"><table class="w-full text-left">
        <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
          <th class="px-4 py-3">Mã xe</th><th class="px-4 py-3">Số xe</th><th class="px-4 py-3">Biển số</th><th class="px-4 py-3">Loại</th><th class="px-4 py-3 text-right">Số chuyến</th>
        </tr></thead><tbody>
        ${xes.map(x => {
          const xCh = chuyens.filter(ch => String(ch.xe_id) === String(x.id)).length;
          return `<tr class="hover:bg-gray-50 border-b border-gray-50">
            <td class="px-4 py-2 text-sm font-medium">${esc(String(x.id))}</td>
            <td class="px-4 py-2 text-sm font-medium">${esc(String(x.so_xe || ''))}</td>
            <td class="px-4 py-2 text-sm">${esc(String(x.bien_so || ''))}</td>
            <td class="px-4 py-2 text-sm">${esc(String(x.loai_xe || ''))}</td>
            <td class="px-4 py-2 text-sm text-right">${xCh}</td>
          </tr>`;
        }).join('')}
        </tbody></table></div>
    </div>` : ''}

    <!-- Chuyến gần đây -->
    <div class="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">📅 Chuyến gần đây (${chuyens.length})</div>
      ${chuyens.length === 0
        ? '<div class="p-8 text-center text-gray-400">Chưa có chuyến</div>'
        : `<div class="overflow-x-auto"><table class="w-full text-left">
            <thead><tr class="bg-gray-50 text-xs uppercase text-gray-500">
              <th class="px-4 py-3">Mã chuyến</th><th class="px-4 py-3">Xe</th><th class="px-4 py-3">Tuyến</th><th class="px-4 py-3">Ngày đi → Về</th>
              <th class="px-4 py-3 text-right">Giá chuyến</th><th class="px-4 py-3">Trạng thái</th>
            </tr></thead><tbody>
            ${chuyens.slice(0, 20).map(ch => {
              const tuyenMau = String(ch.tuyen_mau || 'gray');
              const tt = Number(ch.da_thanh_toan)
                ? `<span class="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">✓ ${fmtDate(String(ch.ngay_thanh_toan))}</span>`
                : '<span class="inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">Chưa</span>';
              return `<tr class="hover:bg-gray-50 border-b border-gray-50">
                <td class="px-4 py-2 text-sm font-medium">${esc(String(ch.id))}</td>
                <td class="px-4 py-2 text-sm">${esc(String(ch.so_xe || ''))}</td>
                <td class="px-4 py-2 text-sm">${ch.tuyen_ten ? `<span class="inline-block px-2 py-0.5 text-xs rounded bg-${tuyenMau}-100 text-${tuyenMau}-700">${esc(String(ch.tuyen_ten))}</span>` : '—'}</td>
                <td class="px-4 py-2 text-sm">${fmtDate(String(ch.ngay_di))} → ${fmtDate(String(ch.ngay_den))}</td>
                <td class="px-4 py-2 text-sm text-right font-bold">${fmtNum(Number(ch.gia_chuyen))} ${ch.tien_te}</td>
                <td class="px-4 py-2 text-sm">${tt}</td>
              </tr>`;
            }).join('')}
            ${chuyens.length > 20 ? `<tr><td colspan="6" class="px-4 py-3 text-center text-gray-400 text-sm">... và ${chuyens.length - 20} chuyến cũ hơn</td></tr>` : ''}
            </tbody></table></div>`
      }
    </div>
  `;

  return c.html(layout(`Đối tác — ${String(cty.ten)}`, content, user, 'doi-tac'));
});

// ── GET /api/khach-hang/:id — KH JSON (for modal populate) ──────

doiTacRoutes.get('/api/khach-hang/:id', async (c) => {
  const id = c.req.param('id');
  const kh = await c.env.DB.prepare('SELECT * FROM khach_hang WHERE id = ?').bind(id).first();
  if (!kh) return c.json({ error: 'Not found' }, 404);
  return c.json(kh);
});

// ── GET /api/hang/:id — Hãng JSON ───────────────────────────────

doiTacRoutes.get('/api/hang/:id', async (c) => {
  const id = c.req.param('id');
  const h = await c.env.DB.prepare('SELECT * FROM hang WHERE id = ?').bind(id).first();
  if (!h) return c.json({ error: 'Not found' }, 404);
  return c.json(h);
});

// ── GET /api/cty-vt/:id — Cty VT JSON ───────────────────────────

doiTacRoutes.get('/api/cty-vt/:id', async (c) => {
  const id = c.req.param('id');
  const ct = await c.env.DB.prepare('SELECT * FROM cty_van_tai WHERE id = ?').bind(id).first();
  if (!ct) return c.json({ error: 'Not found' }, 404);
  return c.json(ct);
});

// ── POST /api/khach-hang — Create/Update KH ─────────────────────

doiTacRoutes.post('/api/khach-hang', async (c) => {
  const body = await c.req.parseBody();
  const id = String(body.id || '');
  const maKh = String(body.ma_kh || '');
  const ten = String(body.ten || '');
  const nip = String(body.nip || '');
  const hanTT = Number(body.han_tt || 30);
  const diaChi = String(body.dia_chi || '');
  const sdt = String(body.sdt || '');
  const danhGia = String(body.danh_gia || '');
  const tienTe = String(body.tien_te || 'PLN');
  const ghiChu = String(body.ghi_chu || '');

  const db = c.env.DB;
  const now = new Date().toISOString();

  if (id) {
    await db.prepare(
      `UPDATE khach_hang SET ten=?, nip=?, han_tt=?, dia_chi=?, sdt=?, danh_gia=?, tien_te=?, ghi_chu=?, danh_gia_manual=?, updated_at=?
       WHERE id=?`
    ).bind(ten, nip, hanTT, diaChi, sdt, danhGia, tienTe, ghiChu, danhGia, now, id).run();
  } else {
    const newId = `KH-${Date.now()}`;
    await db.prepare(
      `INSERT INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia, danh_gia_manual, tien_te, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId, maKh, ten, nip, diaChi, sdt, hanTT, ghiChu, danhGia, danhGia, tienTe, now, now).run();
  }

  return c.redirect('/doi-tac?sub=khach');
});

// ── POST /api/hang — Create/Update Hãng ─────────────────────────

doiTacRoutes.post('/api/hang', async (c) => {
  const body = await c.req.parseBody();
  const id = String(body.id || '');
  const ten = String(body.ten || '');
  const nuoc = String(body.nuoc || '');
  const diaChi = String(body.dia_chi || '');

  const db = c.env.DB;
  const now = new Date().toISOString();

  if (id) {
    await db.prepare(
      `UPDATE hang SET ten=?, nuoc=?, dia_chi=?, updated_at=? WHERE id=?`
    ).bind(ten, nuoc, diaChi, now, id).run();
  } else {
    const newId = `H-${Date.now()}`;
    await db.prepare(
      `INSERT INTO hang (id, ten, nuoc, dia_chi, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(newId, ten, nuoc, diaChi, now, now).run();
  }

  return c.redirect('/doi-tac?sub=hang');
});

// ── POST /api/cty-vt — Create/Update Cty VT ─────────────────────

doiTacRoutes.post('/api/cty-vt', async (c) => {
  const body = await c.req.parseBody();
  const id = String(body.id || '');
  const ten = String(body.ten || '');
  const tenNgan = String(body.ten_ngan || '');
  const nip = String(body.nip || '');
  const email = String(body.email || '');
  const diaChi = String(body.dia_chi || '');
  const sdt = String(body.sdt || '');
  const ghiChu = String(body.ghi_chu || '');

  const db = c.env.DB;
  const now = new Date().toISOString();

  if (id) {
    await db.prepare(
      `UPDATE cty_van_tai SET ten=?, ten_ngan=?, nip=?, email=?, dia_chi=?, sdt=?, ghi_chu=?, updated_at=? WHERE id=?`
    ).bind(ten, tenNgan, nip, email, diaChi, sdt, ghiChu, now, id).run();
  } else {
    const newId = `CVT-${Date.now()}`;
    await db.prepare(
      `INSERT INTO cty_van_tai (id, ten, ten_ngan, nip, email, dia_chi, sdt, ghi_chu, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId, ten, tenNgan, nip, email, diaChi, sdt, ghiChu, now, now).run();
  }

  return c.redirect('/doi-tac?sub=cty');
});

// ── DELETE /api/khach-hang/:id ──────────────────────────────────

doiTacRoutes.delete('/api/khach-hang/:id', async (c) => {
  const id = c.req.param('id');
  const loCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM lo_hang WHERE khach_hang_id = ?'
  ).bind(id).first<{ cnt: number }>();

  if (loCount && loCount.cnt > 0) {
    return c.text('Không thể xoá: khách hàng còn phiếu hàng', 400);
  }

  await c.env.DB.prepare('DELETE FROM khach_hang WHERE id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM bang_gia WHERE khach_hang_id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ── DELETE /api/hang/:id ────────────────────────────────────────

doiTacRoutes.delete('/api/hang/:id', async (c) => {
  const id = c.req.param('id');
  const loCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM lo_hang WHERE hang_id = ?'
  ).bind(id).first<{ cnt: number }>();

  if (loCount && loCount.cnt > 0) {
    return c.text('Không thể xoá: hãng còn phiếu hàng', 400);
  }

  await c.env.DB.prepare('DELETE FROM hang WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ── DELETE /api/cty-vt/:id ──────────────────────────────────────

doiTacRoutes.delete('/api/cty-vt/:id', async (c) => {
  const id = c.req.param('id');
  const xeCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM xe WHERE cty_vt_id = ?'
  ).bind(id).first<{ cnt: number }>();

  if (xeCount && xeCount.cnt > 0) {
    return c.text('Không thể xoá: công ty còn xe', 400);
  }

  await c.env.DB.prepare('DELETE FROM cty_van_tai WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});
