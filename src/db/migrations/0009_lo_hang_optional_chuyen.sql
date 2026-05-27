-- Migration 0009: Make lo_hang.chuyen_xe_id optional (remove FK constraint)
-- The application supports creating lo_hang without a chuyen_xe (DK prefix),
-- but the FK constraint blocks inserts with empty chuyen_xe_id.

-- Step 1: Recreate lo_hang without FK on chuyen_xe_id
CREATE TABLE lo_hang_new (
  id TEXT PRIMARY KEY,
  chuyen_xe_id TEXT NOT NULL DEFAULT '',
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
  tien_te_th TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy existing data
INSERT INTO lo_hang_new SELECT * FROM lo_hang;

-- Step 3: Drop old table
DROP TABLE lo_hang;

-- Step 4: Rename new table
ALTER TABLE lo_hang_new RENAME TO lo_hang;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_lo_hang_chuyen_xe ON lo_hang(chuyen_xe_id);
CREATE INDEX IF NOT EXISTS idx_lo_hang_khach_hang ON lo_hang(khach_hang_id);
CREATE INDEX IF NOT EXISTS idx_lo_hang_hang ON lo_hang(hang_id);
CREATE INDEX IF NOT EXISTS idx_lo_hang_da_tra ON lo_hang(da_tra_hang);
