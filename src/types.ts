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

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}
