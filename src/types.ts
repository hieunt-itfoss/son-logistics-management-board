export type Role = 'admin' | 'ke_toan' | 'tai_xe' | 'kho';

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
}

export interface Hang {
  id: string;
  ten: string;
  nuoc: string;
  dia_chi: string;
}

export interface Tuyen {
  id: string;
  ten: string;
  diem_di: string;
  diem_den: string;
  tien_to: string;
  khoang_cach_km: number;
}

export interface Xe {
  id: string;
  bien_so: string;
  so_xe: string;
  loai_xe: string;
  trong_tai: number;
}

export interface TaiXe {
  id: string;
  ten: string;
  sdt: string;
  cmnd: string;
  ghi_chu: string;
}

export interface ChuyenXe {
  id: string;
  tuyen_id: string;
  xe_id: string;
  tai_xe_id: string | null;
  ngay_di: string;
  ngay_den: string | null;
  trang_thai: 'planned' | 'dang_chay' | 'hoan_thanh' | 'huy';
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
  tien_te: string;
  thanh_tien: number;
  so_tien_hang: number;
  giam_gia: number;
  nguoi_tao: string;
  nguoi_thu: string;
}

export interface PhieuThu {
  id: string;
  ngay: string;
  khach_hang_id: string;
  dau_muc: string;
  kieu_qt: 'trahet' | 'ung';
  loai_tien: string;
  lo_ids: string;
  so_tien: number;
  tien_te: string;
  hinh_thuc: 'TM' | 'CK';
  ghi_chu: string;
  nguoi_nhap: string;
  gio: string;
}

export interface PhieuChi {
  id: string;
  ngay: string;
  dau_muc: string;
  so_tien: number;
  tien_te: string;
  hinh_thuc: 'TM' | 'CK';
  ghi_chu: string;
  nguoi_nhap: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}
