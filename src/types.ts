export type Role = 'admin' | 'ketoanTruong' | 'ketoanVien' | 'nhanvien' | 'kho' | 'laixe';

export type VaiTro = Role;

export type LoaiTien = 'vantai' | 'tienhang';

export type TienTe = 'PLN' | 'EUR' | 'USD';

export type HinhThuc = 'TM' | 'CK';

export type KieuQT = 'trahet' | 'ung';

export type TrangThaiChuyen = 'planned' | 'dang_chay' | 'hoan_thanh' | 'huy';

export type TrangThaiChamCong = 'co' | 'vang' | 'nua_ngay' | 'phep';

export type DauMucThuChi = 'Vận tải Pháp' | 'Vận tải Ý' | 'Vận tải Tiệp' | 'Vận tải Balan' | 'Vận tải khác' | 'Văn phòng' | 'Chi ngoài';

export type DauMucGroup = 'phap' | 'y' | 'tiep' | 'balan' | 'khac';

export const DAU_MUC_THU_CHI: DauMucThuChi[] = ['Vận tải Pháp', 'Vận tải Ý', 'Vận tải Tiệp', 'Vận tải Balan', 'Vận tải khác', 'Văn phòng', 'Chi ngoài'];

export const DM_GROUP_LABEL: Record<DauMucGroup, string> = {
  phap: 'Vận tải Pháp',
  y: 'Vận tải Ý',
  tiep: 'Vận tải Tiệp',
  balan: 'Vận tải Balan',
  khac: 'Vận tải khác',
};

export const DM_GROUP_TIENTO: Record<DauMucGroup, string> = {
  phap: 'F',
  y: 'W',
  tiep: 'C',
  balan: 'P',
  khac: 'K',
};

export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  APP_NAME: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: Role;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface KhachHang {
  id: string;
  ma_kh: string;
  ten: string;
  nip: string;
  dia_chi: string;
  sdt: string;
  han_tt: number;
  ghi_chu: string;
  danh_gia: string;
  danh_gia_manual: string;
}

export interface Hang {
  id: string;
  ten: string;
  nuoc: string;
  dia_chi: string;
}

export interface CtyVanTai {
  id: string;
  ten: string;
  dia_chi: string;
  sdt: string;
}

export interface Tuyen {
  id: string;
  ten: string;
  diem_di: string;
  diem_den: string;
  tien_to: string;
  mau: string;
  dau_muc_group: DauMucGroup;
  khoang_cach_km: number;
}

export interface Xe {
  id: string;
  bien_so: string;
  so_xe: string;
  loai_xe: string;
  trong_tai: number;
  tai_xe_id: string;
  cty_vt_id: string;
}

export interface NhanVien {
  id: string;
  ten: string;
  vai_tro: VaiTro;
  sdt: string;
  so_giay_to: string;
  dia_chi: string;
  ghi_chu: string;
  active: number;
}

export interface ChuyenXe {
  id: string;
  tuyen_id: string;
  xe_id: string;
  tai_xe_id: string;
  ngay_di: string;
  ngay_den: string;
  trang_thai: TrangThaiChuyen;
  gia_chuyen: number;
  tien_te: TienTe;
  da_thanh_toan: number;
  ngay_thanh_toan: string;
  so_sent_va_gt: string;
  ghi_chu: string;
}

export interface LoHang {
  id: string;
  chuyen_xe_id: string;
  khach_hang_id: string;
  hang_id: string;
  so_kien: number;
  da_tra_hang: number;
  ly_do_thieu: string;
  don_gia: number;
  tien_te: TienTe;
  thanh_tien: number;
  so_tien_hang: number;
  giam_gia: number;
  nguoi_tao: string;
  nguoi_thu: string;
  tien_te_th: string;
}

export interface PhieuThu {
  id: string;
  ngay: string;
  khach_hang_id: string;
  dau_muc: string;
  kieu_qt: KieuQT;
  loai_tien: LoaiTien;
  lo_ids: string;
  so_tien: number;
  tien_te: TienTe;
  hinh_thuc: HinhThuc;
  ghi_chu: string;
  nguoi_nhap: string;
  gio: string;
}

export interface PhieuChi {
  id: string;
  ngay: string;
  dau_muc: string;
  chuyen_xe_id: string;
  khach_hang_id: string;
  lo_ids: string;
  kieu_qt: KieuQT;
  so_tien: number;
  tien_te: TienTe;
  hinh_thuc: HinhThuc;
  ghi_chu: string;
  nguoi_nhap: string;
  gio: string;
  phai_thu_ve: number;
}

export interface BangGia {
  id: string;
  khach_hang_id: string;
  don_gia: number;
  tien_te: TienTe;
}

export interface ChamCong {
  id: string;
  nhan_vien_id: string;
  ngay: string;
  trang_thai: TrangThaiChamCong;
  ghi_chu: string;
}

export interface AuditLog {
  id: string;
  ngay: string;
  gio: string;
  nguoi: string;
  nguoi_label: string;
  hanh_dong: string;
  target: string;
  chi_tiet: string;
}

export interface SoDuDauKy {
  id: string;
  tien_te: string;
  so_du: number;
  ngay_ap_dung: string;
}

export interface CongNoEntry {
  dau_muc: string;
  tte: string;
  phai_thu: number;
  da_thu: number;
  con_no: number;
  is_th: boolean;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}
