-- Custom / built-in đầu mục VT groups (used by tuyen.dau_muc_group)
CREATE TABLE IF NOT EXISTS dau_muc_nhom (
  id TEXT PRIMARY KEY,
  ten TEXT NOT NULL,
  tien_to TEXT NOT NULL DEFAULT 'K',
  mau TEXT NOT NULL DEFAULT 'gray',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO dau_muc_nhom (id, ten, tien_to, mau) VALUES
  ('phap',  'Vận tải Pháp',  'F', 'blue'),
  ('y',     'Vận tải Ý',     'W', 'amber'),
  ('tiep',  'Vận tải Tiệp',  'C', 'green'),
  ('balan', 'Vận tải Balan', 'P', 'gray'),
  ('khac',  'Vận tải khác',  'K', 'gray');
