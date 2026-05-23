-- Per-NV permission overrides (reference: nhanVien.customPerms)
ALTER TABLE nhan_vien ADD COLUMN custom_perms TEXT NOT NULL DEFAULT '{}';
-- Link login account to staff record (optional)
ALTER TABLE users ADD COLUMN nhan_vien_id TEXT DEFAULT '';
