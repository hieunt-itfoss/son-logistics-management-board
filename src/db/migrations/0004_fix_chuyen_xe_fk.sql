-- Migration 0004: Fix chuyen_xe FK reference to renamed nhan_vien table
-- The old tai_xe table was renamed to nhan_vien in migration 0003,
-- but chuyen_xe still has: tai_xe_id TEXT REFERENCES tai_xe(id)
-- This causes FOREIGN KEY constraint failed on insert.

-- Recreate chuyen_xe with corrected FK reference
DROP TABLE IF EXISTS chuyen_xe;

CREATE TABLE chuyen_xe (
  id TEXT PRIMARY KEY,
  tuyen_id TEXT NOT NULL REFERENCES tuyen(id),
  xe_id TEXT NOT NULL REFERENCES xe(id),
  tai_xe_id TEXT REFERENCES nhan_vien(id),
  ngay_di TEXT NOT NULL,
  ngay_den TEXT,
  trang_thai TEXT NOT NULL DEFAULT 'planned' CHECK(trang_thai IN ('planned', 'dang_chay', 'hoan_thanh', 'huy')),
  gia_chuyen REAL NOT NULL DEFAULT 0,
  tien_te TEXT NOT NULL DEFAULT 'PLN',
  da_thanh_toan INTEGER NOT NULL DEFAULT 0,
  ngay_thanh_toan TEXT DEFAULT '',
  so_sent_va_gt TEXT DEFAULT '',
  ghi_chu TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chuyen_xe_tuyen_id ON chuyen_xe(tuyen_id);
CREATE INDEX IF NOT EXISTS idx_chuyen_xe_xe_id ON chuyen_xe(xe_id);
CREATE INDEX IF NOT EXISTS idx_chuyen_xe_ngay_di ON chuyen_xe(ngay_di);
CREATE INDEX IF NOT EXISTS idx_chuyen_xe_trang_thai ON chuyen_xe(trang_thai);
