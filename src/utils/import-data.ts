/**
 * Import Excel/CSV/TSV — ported from reference index.html (SonLogistic v7)
 */

export type ImportType = 'kh' | 'hang' | 'cty' | 'phieu';

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseDelimitedText(text: string): ParsedTable {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const lines = t.split(/\r?\n/).filter((l) => l.length > 0 || l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };

  const first = lines[0];
  let delim = '\t';
  if (!first.includes('\t')) {
    delim = first.includes(';') && first.split(';').length > first.split(',').length ? ';' : ',';
  }

  const rawHeaders = lines[0].split(delim).map((h) => h.trim());
  const headers = rawHeaders.map((h) =>
    h.replace(/^\*+/, '').replace(/\s*\(.*?\)\s*$/g, '').trim().toLowerCase(),
  );

  const rows = lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cells = line.split(delim).map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || '';
    });
    return row;
  });

  return { headers, rows };
}

export function normImportDate(s: string): string {
  if (!s) return '';
  s = s.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4,5}$/.test(s) && parseInt(s, 10) > 30000) {
    const d = new Date((parseInt(s, 10) - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    let d: string;
    let mo: string;
    const y = m[3];
    if (parseInt(m[1], 10) > 12) {
      d = m[1];
      mo = m[2];
    } else if (parseInt(m[2], 10) > 12) {
      mo = m[1];
      d = m[2];
    } else {
      d = m[2];
      mo = m[1];
    }
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

function gv(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const k = a.toLowerCase();
    for (const [hk, hv] of Object.entries(row)) {
      if (hk === k || hk.startsWith(k) || hk.includes(k)) return (hv || '').toString().trim();
    }
  }
  return '';
}

function normName(s: string): string {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchByName<T extends object>(
  name: string,
  list: T[],
  fields: (keyof T & string)[],
): { item: T; exact: boolean } | null {
  if (!name) return null;
  const n = normName(name);
  for (const item of list) {
    for (const f of fields) {
      const v = normName(String(item[f] ?? ''));
      if (v === n) return { item, exact: true };
    }
  }
  for (const item of list) {
    for (const f of fields) {
      const v = normName(String(item[f] ?? ''));
      if (v && (v.includes(n) || n.includes(v)) && Math.abs(v.length - n.length) < 3) {
        return { item, exact: false };
      }
    }
  }
  return null;
}

export interface ImportError {
  row: number;
  msg: string;
}

export interface ImportWarn {
  row: number;
  msg: string;
  dup?: boolean;
}

export interface NewKhDraft {
  ten: string;
  nip: string;
  sdt: string;
  dia_chi: string;
  han_tt: number;
  checked: boolean;
}

export interface NewHangDraft {
  ten: string;
  nuoc: string;
  dia_chi: string;
  checked: boolean;
}

export interface NewXeDraft {
  so_xe: string;
  bien_so: string;
  checked: boolean;
}

export interface PhieuDraft {
  khach_hang_id: string;
  hang_id: string;
  chuyen_xe_id: string;
  so_kien: number;
  da_tra_hang: number;
  don_gia: number;
  tien_te: string;
  thanh_tien: number;
  so_tien_hang: number;
  tien_te_th: string;
  giam_gia: number;
  ly_do_thieu: string;
  nguoi_tao: string;
  nguoi_thu: string;
  _khTen?: string;
  _hangTen?: string;
  warns: string[];
}

export interface NewChuyenDraft {
  id: string;
  tuyen_id: string;
  xe_id: string;
  so_xe?: string;
  tai_xe_id: string;
  ngay_di: string;
  ngay_den: string;
  gia_chuyen: number;
  tien_te: string;
}

export interface ImportPreviewResult {
  valid: unknown[];
  errors: ImportError[];
  warns: ImportWarn[];
  newKHs?: NewKhDraft[];
  newHangs?: NewHangDraft[];
  newXes?: NewXeDraft[];
  newChuyens?: NewChuyenDraft[];
  missingTuyens?: string[];
}

interface KhRow {
  id: string;
  ma_kh: string;
  ten: string;
}
interface HangRow {
  id: string;
  ten: string;
}
interface TuyenRow {
  id: string;
  ten: string;
  tien_to: string;
}
interface XeRow {
  id: string;
  so_xe: string;
  bien_so: string;
  tai_xe_id: string;
}
interface ChuyenRow {
  id: string;
  xe_id: string;
  tuyen_id: string;
  ngay_di: string;
}

export function buildImportPreview(
  type: ImportType,
  rows: Record<string, string>[],
  ctx: {
    khachHang: KhRow[];
    hang: HangRow[];
    ctyVT: { id: string; ten: string }[];
    tuyen: TuyenRow[];
    xe: XeRow[];
    chuyenXe: ChuyenRow[];
    loHangCountByKh: Map<string, number>;
  },
): ImportPreviewResult {
  const valid: unknown[] = [];
  const errors: ImportError[] = [];
  const warns: ImportWarn[] = [];

  if (type === 'kh') {
    rows.forEach((r, i) => {
      const ten = gv(r, 'tenkh', 'ten', 'name');
      if (!ten) {
        errors.push({ row: i + 2, msg: 'Thiếu tên KH' });
        return;
      }
      const dup = ctx.khachHang.find((k) => normName(k.ten) === normName(ten));
      const obj = {
        ten,
        nip: gv(r, 'nip', 'mst'),
        dia_chi: gv(r, 'diachi', 'address'),
        sdt: gv(r, 'sdt', 'phone'),
        han_tt: parseInt(gv(r, 'hantt', 'han'), 10) || 30,
        ghi_chu: gv(r, 'ghichu', 'note'),
      };
      if (dup) warns.push({ row: i + 2, msg: `"${ten}" đã có (${dup.id})`, dup: true });
      else valid.push(obj);
    });
    return { valid, errors, warns };
  }

  if (type === 'hang') {
    rows.forEach((r, i) => {
      const ten = gv(r, 'tenhang', 'ten', 'name');
      if (!ten) {
        errors.push({ row: i + 2, msg: 'Thiếu tên Hãng' });
        return;
      }
      const dup = ctx.hang.find((h) => normName(h.ten) === normName(ten));
      const obj = {
        ten,
        nuoc: gv(r, 'nuoc', 'country'),
        dia_chi: gv(r, 'diachi', 'address'),
      };
      if (dup) warns.push({ row: i + 2, msg: `"${ten}" đã có`, dup: true });
      else valid.push(obj);
    });
    return { valid, errors, warns };
  }

  if (type === 'cty') {
    rows.forEach((r, i) => {
      const ten = gv(r, 'tencty', 'tenctyvt', 'ten', 'name');
      if (!ten) {
        errors.push({ row: i + 2, msg: 'Thiếu tên Cty' });
        return;
      }
      const dup = ctx.ctyVT.find((c) => normName(c.ten) === normName(ten));
      const obj = {
        ten,
        dia_chi: gv(r, 'diachi', 'address'),
        sdt: gv(r, 'sdt', 'phone'),
      };
      if (dup) warns.push({ row: i + 2, msg: `"${ten}" đã có`, dup: true });
      else valid.push(obj);
    });
    return { valid, errors, warns };
  }

  // phieu
  const newChs = new Map<string, NewChuyenDraft>();
  const newKHs = new Map<string, NewKhDraft>();
  const newHangs = new Map<string, NewHangDraft>();
  const newXes = new Map<string, NewXeDraft>();
  const missingTuyens = new Set<string>();

  rows.forEach((r, i) => {
    const tenKH = gv(r, 'tenkh', 'khach', 'customer');
    const tenHang = gv(r, 'tenhang', 'hang', 'sender');
    const soKien = parseInt(gv(r, 'sokien', 'kien', 'qty', 'pcs'), 10) || 0;
    if (!tenKH) {
      errors.push({ row: i + 2, msg: 'Thiếu tên KH (bắt buộc)' });
      return;
    }
    if (!tenHang) {
      errors.push({ row: i + 2, msg: 'Thiếu tên Hãng (bắt buộc)' });
      return;
    }
    if (soKien <= 0) {
      errors.push({ row: i + 2, msg: 'Thiếu số kiện hoặc = 0' });
      return;
    }

    const rowWarns: string[] = [];

    let khMatch = matchByName(tenKH, ctx.khachHang, ['ten']);
    if (!khMatch) {
      const key = normName(tenKH);
      const existing = newKHs.get(key);
      if (existing) {
        khMatch = { item: existing as unknown as KhRow, exact: true };
      } else {
        const draft: NewKhDraft = {
          ten: tenKH,
          nip: gv(r, 'nipkh', 'nip'),
          sdt: gv(r, 'sdtkh', 'sdt'),
          dia_chi: gv(r, 'diachikh', 'diachi'),
          han_tt: parseInt(gv(r, 'hanttkh', 'hantt'), 10) || 30,
          checked: true,
        };
        newKHs.set(key, draft);
        khMatch = { item: draft as unknown as KhRow, exact: true };
        rowWarns.push(`Tạo KH mới: ${tenKH}`);
      }
    } else if (!khMatch.exact) {
      rowWarns.push(`KH "${tenKH}" → "${(khMatch.item as KhRow).ten}"`);
    }

    let hangMatch = matchByName(tenHang, ctx.hang, ['ten']);
    if (!hangMatch) {
      const key = normName(tenHang);
      const existing = newHangs.get(key);
      if (existing) {
        hangMatch = { item: existing as unknown as HangRow, exact: true };
      } else {
        const draft: NewHangDraft = {
          ten: tenHang,
          nuoc: gv(r, 'nuochang', 'nuoc'),
          dia_chi: gv(r, 'diachihang', ''),
          checked: true,
        };
        newHangs.set(key, draft);
        hangMatch = { item: draft as unknown as HangRow, exact: true };
        rowWarns.push(`Tạo Hãng mới: ${tenHang}`);
      }
    }

    const soXeRaw = gv(r, 'soxe', 'xe', 'truck');
    const tenTuyen = gv(r, 'tentuyen', 'tuyen', 'route');
    const ngayDi = normImportDate(gv(r, 'ngaydi', 'startdate'));
    const ngayVe = normImportDate(gv(r, 'ngayve', 'enddate'));
    let xe: XeRow | NewXeDraft | null = null;
    let tuyen: TuyenRow | null = null;
    let chuyen: ChuyenRow | NewChuyenDraft | null = null;

    if (soXeRaw) {
      const m = matchByName(soXeRaw, ctx.xe, ['so_xe', 'bien_so', 'id']);
      if (m) xe = m.item as XeRow;
      else {
        const key = normName(soXeRaw);
        const ex = newXes.get(key);
        if (ex) xe = ex as unknown as XeRow;
        else {
          const draft: NewXeDraft = {
            so_xe: soXeRaw,
            bien_so: gv(r, 'bienso'),
            checked: true,
          };
          newXes.set(key, draft);
          xe = draft as unknown as XeRow;
          rowWarns.push(`Tạo xe mới: ${soXeRaw}`);
        }
      }
    }

    if (tenTuyen) {
      const tm = matchByName(tenTuyen, ctx.tuyen, ['ten']);
      if (tm) tuyen = tm.item;
      else {
        missingTuyens.add(tenTuyen);
        rowWarns.push(`Tuyến "${tenTuyen}" chưa có — tạo ở tab Tuyến trước`);
      }
    }

    if (xe && tuyen && ngayDi) {
      const xeId = 'id' in xe ? (xe as XeRow).id : '';
      chuyen =
        ctx.chuyenXe.find(
          (c) => c.xe_id === xeId && c.tuyen_id === tuyen.id && c.ngay_di === ngayDi,
        ) || null;
      if (!chuyen) {
        const xeNum = xeId.replace(/[^0-9]/g, '') || '0';
        const dd = ngayDi.split('-').reverse().join('').slice(0, 6);
        const newId = `${tuyen.tien_to}-${dd}-${xeNum}`;
        const draft: NewChuyenDraft = {
          id: newId,
          tuyen_id: tuyen.id,
          xe_id: xeId,
          so_xe: soXeRaw,
          tai_xe_id: (xe as XeRow).tai_xe_id || '',
          ngay_di: ngayDi,
          ngay_den: ngayVe || ngayDi,
          gia_chuyen: 0,
          tien_te: gv(r, 'tiente', 'currency') || 'PLN',
        };
        newChs.set(newId, draft);
        chuyen = draft;
        rowWarns.push(`Chuyến mới: ${newId}`);
      }
    }

    const tienTe = gv(r, 'tiente', 'currency') || 'PLN';
    const donGia = parseFloat(gv(r, 'dongia', 'price')) || 0;
    const thanhTien =
      parseFloat(gv(r, 'thanhtien', 'total')) || (donGia > 0 ? donGia * soKien : 0);
    const daTra = parseInt(gv(r, 'datrahang', 'datra'), 10);
    const khItem = khMatch!.item;
    const hangItem = hangMatch!.item;
    const obj: PhieuDraft = {
      khach_hang_id: ('id' in khItem ? String((khItem as KhRow).id) : '') || '',
      hang_id: ('id' in hangItem ? String((hangItem as HangRow).id) : '') || '',
      chuyen_xe_id: chuyen?.id || '',
      so_kien: soKien,
      da_tra_hang: Number.isFinite(daTra) ? daTra : soKien,
      don_gia: donGia,
      tien_te: tienTe,
      thanh_tien: thanhTien,
      so_tien_hang: parseFloat(gv(r, 'sotienhang', 'tienhang')) || 0,
      tien_te_th: gv(r, 'tienteth', 'thcurrency') || tienTe,
      giam_gia: parseFloat(gv(r, 'giamgia', 'discount')) || 0,
      ly_do_thieu: gv(r, 'lydothieu', 'note', 'lydo', 'ghichu'),
      nguoi_tao: '',
      nguoi_thu: '',
      _khTen: !('id' in khItem && (khItem as KhRow).id) ? tenKH : undefined,
      _hangTen: !('id' in hangItem && (hangItem as HangRow).id) ? tenHang : undefined,
      warns: rowWarns,
    };
    valid.push(obj);
  });

  return {
    valid,
    errors,
    warns,
    newKHs: Array.from(newKHs.values()),
    newHangs: Array.from(newHangs.values()),
    newXes: Array.from(newXes.values()),
    newChuyens: Array.from(newChs.values()),
    missingTuyens: Array.from(missingTuyens),
  };
}

export function csvTemplate(type: ImportType): { filename: string; content: string } {
  if (type === 'kh') {
    return {
      filename: 'mau_khach.csv',
      content:
        '\uFEFFtenKH,nip,diaChi,sdt,hanTT,ghiChu\nA QUÝ,PL5210999000,Warsaw,+48 600 000 001,30,\n',
    };
  }
  if (type === 'hang') {
    return {
      filename: 'mau_hang.csv',
      content: '\uFEFFtenHang,nuoc,diaChi\nItalmod,Ý,Bologna\n',
    };
  }
  if (type === 'cty') {
    return {
      filename: 'mau_cty_vt.csv',
      content: '\uFEFFtenCtyVT,diaChi,sdt\nPolFracht,Warszawa,+48 22 444 4444\n',
    };
  }
  return {
    filename: 'mau_phieu.csv',
    content:
      '\uFEFFtenKH,tenHang,soKien,soXe,tenTuyen,ngayDi,donGia,tienTe,thanhTien,soTienHang,ghiChu\nA HUI,JM,100,XE 50,Paris-Wólka,2026-06-01,85,EUR,8500,3000,\n',
  };
}
