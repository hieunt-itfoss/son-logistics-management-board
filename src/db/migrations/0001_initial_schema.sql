-- Migration: 001_initial_schema
-- Transport Management System (HTQLVT)

-- Users table (authentication & authorization)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'ke_toan', 'tai_xe', 'kho')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Customers
CREATE TABLE IF NOT EXISTS khach_hang (
  id TEXT PRIMARY KEY,
  ma_kh TEXT NOT NULL UNIQUE,
  ten TEXT NOT NULL,
  nip TEXT DEFAULT '',
  dia_chi TEXT DEFAULT '',
  sdt TEXT DEFAULT '',
  han_tt INTEGER NOT NULL DEFAULT 30,
  ghi_chu TEXT DEFAULT '',
  danh_gia TEXT DEFAULT '' CHECK(danh_gia IN ('', 'binhthuong', 'canhbao')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suppliers
CREATE TABLE IF NOT EXISTS hang (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  nuoc TEXT DEFAULT '',
  dia_chi TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Routes
CREATE TABLE IF NOT EXISTS tuyen (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  diem_di TEXT NOT NULL,
  diem_den TEXT NOT NULL,
  tien_to TEXT NOT NULL DEFAULT 'F',
  khoang_cach_km INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vehicles
CREATE TABLE IF NOT EXISTS xe (
  id TEXT PRIMARY KEY,
  bien_so TEXT NOT NULL UNIQUE,
  so_xe TEXT NOT NULL,
  loai_xe TEXT DEFAULT '',
  trong_tai REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Drivers
CREATE TABLE IF NOT EXISTS tai_xe (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  sdt TEXT DEFAULT '',
  cmnd TEXT DEFAULT '',
  ghi_chu TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trips
CREATE TABLE IF NOT EXISTS chuyen_xe (
  id TEXT PRIMARY KEY,
  tuyen_id TEXT NOT NULL REFERENCES tuyen(id),
  xe_id TEXT NOT NULL REFERENCES xe(id),
  tai_xe_id TEXT REFERENCES tai_xe(id),
  ngay_di TEXT NOT NULL,
  ngay_den TEXT,
  trang_thai TEXT NOT NULL DEFAULT 'planned' CHECK(trang_thai IN ('planned', 'dang_chay', 'hoan_thanh', 'huy')),
  ghi_chu TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chuyen_xe_tuyen ON chuyen_xe(tuyen_id);
CREATE INDEX IF NOT EXISTS idx_chuyen_xe_ngay ON chuyen_xe(ngay_di);
