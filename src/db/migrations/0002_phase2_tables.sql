CREATE TABLE IF NOT EXISTS lo_hang (
  id TEXT PRIMARY KEY,
  chuyen_xe_id TEXT NOT NULL REFERENCES chuyen_xe(id),
  khach_hang_id TEXT NOT NULL REFERENCES khach_hang(id),
  hang_id TEXT NOT NULL REFERENCES hang(id),
  so_kien INTEGER NOT NULL,
  da_tra_hang INTEGER NOT NULL DEFAULT 0,
  ly_do_thieu TEXT DEFAULT '',
  don_gia REAL NOT NULL DEFAULT 0,
  tien_te TEXT NOT NULL DEFAULT 'PLN',
  thanh_tien REAL NOT NULL DEFAULT 0,
  so_tien_hang REAL NOT NULL DEFAULT 0,
  giam_gia REAL NOT NULL DEFAULT 0,
  nguoi_tao TEXT DEFAULT '',
  nguoi_thu TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lo_hang_chuyen_xe ON lo_hang(chuyen_xe_id);
CREATE INDEX IF NOT EXISTS idx_lo_hang_khach_hang ON lo_hang(khach_hang_id);
CREATE INDEX IF NOT EXISTS idx_lo_hang_hang ON lo_hang(hang_id);
CREATE INDEX IF NOT EXISTS idx_lo_hang_da_tra ON lo_hang(da_tra_hang);

CREATE TABLE IF NOT EXISTS phieu_thu (
  id TEXT PRIMARY KEY,
  ngay TEXT NOT NULL,
  khach_hang_id TEXT NOT NULL REFERENCES khach_hang(id),
  dau_muc TEXT DEFAULT '',
  kieu_qt TEXT NOT NULL DEFAULT 'trahet' CHECK(kieu_qt IN ('trahet', 'ung')),
  loai_tien TEXT NOT NULL DEFAULT 'vantai',
  lo_ids TEXT DEFAULT '[]',
  so_tien REAL NOT NULL DEFAULT 0,
  tien_te TEXT NOT NULL DEFAULT 'PLN',
  hinh_thuc TEXT NOT NULL DEFAULT 'TM' CHECK(hinh_thuc IN ('TM', 'CK')),
  ghi_chu TEXT DEFAULT '',
  nguoi_nhap TEXT DEFAULT '',
  gio TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_phieu_thu_ngay ON phieu_thu(ngay);
CREATE INDEX IF NOT EXISTS idx_phieu_thu_khach_hang ON phieu_thu(khach_hang_id);

CREATE TABLE IF NOT EXISTS phieu_chi (
  id TEXT PRIMARY KEY,
  ngay TEXT NOT NULL,
  dau_muc TEXT DEFAULT '',
  so_tien REAL NOT NULL DEFAULT 0,
  tien_te TEXT NOT NULL DEFAULT 'PLN',
  hinh_thuc TEXT NOT NULL DEFAULT 'TM' CHECK(hinh_thuc IN ('TM', 'CK')),
  ghi_chu TEXT DEFAULT '',
  nguoi_nhap TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_phieu_chi_ngay ON phieu_chi(ngay);
