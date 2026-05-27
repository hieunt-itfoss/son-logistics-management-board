-- Migration 0003: Full schema to match original index.html data model
-- Adds: nhan_vien, cty_van_tai, bang_gia, cham_cong, audit_log, so_du_dau_ky
-- Alters: users (6 roles), khach_hang, tuyen, xe, chuyen_xe, phieu_chi

-- ============================================================
-- 1. Recreate users table with 6 roles
-- ============================================================
CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'ketoanTruong', 'ketoanVien', 'nhanvien', 'kho', 'laixe')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Migrate existing data with role mapping
INSERT OR IGNORE INTO users_new (id, username, password_hash, display_name, role, active, created_at, updated_at)
  SELECT id, username, password_hash, display_name,
    CASE role
      WHEN 'admin' THEN 'admin'
      WHEN 'ke_toan' THEN 'ketoanVien'
      WHEN 'tai_xe' THEN 'laixe'
      WHEN 'kho' THEN 'kho'
      ELSE 'nhanvien'
    END,
    active, created_at, updated_at
  FROM users;
DROP TABLE IF EXISTS sessions;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ============================================================
-- 2. New tables (create BEFORE adding FK references)
-- ============================================================

-- Staff (unified staff table — replaces tai_xe)
CREATE TABLE IF NOT EXISTS nhan_vien (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  vai_tro TEXT NOT NULL CHECK(vai_tro IN ('admin', 'ketoanTruong', 'ketoanVien', 'nhanvien', 'kho', 'laixe')),
  sdt TEXT DEFAULT '',
  so_giay_to TEXT DEFAULT '',
  dia_chi TEXT DEFAULT '',
  ghi_chu TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nhan_vien_vai_tro ON nhan_vien(vai_tro);

-- Carrier companies
CREATE TABLE IF NOT EXISTS cty_van_tai (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  dia_chi TEXT DEFAULT '',
  sdt TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pricing (per customer)
CREATE TABLE IF NOT EXISTS bang_gia (
  id TEXT PRIMARY KEY,
  khach_hang_id TEXT NOT NULL REFERENCES khach_hang(id),
  don_gia REAL NOT NULL DEFAULT 0,
  tien_te TEXT NOT NULL DEFAULT 'PLN',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bang_gia_khach_hang ON bang_gia(khach_hang_id);

-- Attendance
CREATE TABLE IF NOT EXISTS cham_cong (
  id TEXT PRIMARY KEY,
  nhan_vien_id TEXT NOT NULL REFERENCES nhan_vien(id),
  ngay TEXT NOT NULL,
  trang_thai TEXT NOT NULL DEFAULT 'co' CHECK(trang_thai IN ('co', 'vang', 'nua_ngay', 'phep')),
  ghi_chu TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cham_cong_nhan_vien ON cham_cong(nhan_vien_id);
CREATE INDEX IF NOT EXISTS idx_cham_cong_ngay ON cham_cong(ngay);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ngay TEXT NOT NULL,
  gio TEXT DEFAULT '',
  nguoi TEXT DEFAULT '',
  nguoi_label TEXT DEFAULT '',
  hanh_dong TEXT DEFAULT '',
  target TEXT DEFAULT '',
  chi_tiet TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target);
CREATE INDEX IF NOT EXISTS idx_audit_log_ngay ON audit_log(ngay);

-- Opening balances (per currency)
CREATE TABLE IF NOT EXISTS so_du_dau_ky (
  id TEXT PRIMARY KEY,
  tien_te TEXT NOT NULL UNIQUE,
  so_du REAL NOT NULL DEFAULT 0,
  ngay_ap_dung TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 3. Add missing columns to existing tables
-- ============================================================

-- khach_hang: add danh_gia_manual
ALTER TABLE khach_hang ADD COLUMN danh_gia_manual TEXT DEFAULT '';

-- tuyen: add mau (color), dau_muc_group
ALTER TABLE tuyen ADD COLUMN mau TEXT DEFAULT 'gray';
ALTER TABLE tuyen ADD COLUMN dau_muc_group TEXT DEFAULT 'khac';

-- xe: add tai_xe_id (current driver), cty_vt_id (assigned carrier)
ALTER TABLE xe ADD COLUMN tai_xe_id TEXT DEFAULT '';
ALTER TABLE xe ADD COLUMN cty_vt_id TEXT DEFAULT '';

-- chuyen_xe: add gia_chuyen, tien_te, da_thanh_toan, ngay_thanh_toan, so_sent_va_gt
ALTER TABLE chuyen_xe ADD COLUMN gia_chuyen REAL NOT NULL DEFAULT 0;
ALTER TABLE chuyen_xe ADD COLUMN tien_te TEXT NOT NULL DEFAULT 'PLN';
ALTER TABLE chuyen_xe ADD COLUMN da_thanh_toan INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chuyen_xe ADD COLUMN ngay_thanh_toan TEXT DEFAULT '';
ALTER TABLE chuyen_xe ADD COLUMN so_sent_va_gt TEXT DEFAULT '';

-- phieu_chi: add chuyen_xe_id, khach_hang_id, lo_ids, kieu_qt, gio, phai_thu_ve
ALTER TABLE phieu_chi ADD COLUMN chuyen_xe_id TEXT DEFAULT '';
ALTER TABLE phieu_chi ADD COLUMN khach_hang_id TEXT DEFAULT '';
ALTER TABLE phieu_chi ADD COLUMN lo_ids TEXT DEFAULT '[]';
ALTER TABLE phieu_chi ADD COLUMN kieu_qt TEXT NOT NULL DEFAULT 'trahet';
ALTER TABLE phieu_chi ADD COLUMN gio TEXT DEFAULT '';
ALTER TABLE phieu_chi ADD COLUMN phai_thu_ve INTEGER NOT NULL DEFAULT 0;

-- lo_hang: add tien_te_th (currency for merchandise money, may differ from transport)
ALTER TABLE lo_hang ADD COLUMN tien_te_th TEXT DEFAULT '';
