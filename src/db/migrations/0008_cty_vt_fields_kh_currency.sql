-- Add extra fields to cty_van_tai
ALTER TABLE cty_van_tai ADD COLUMN ten_ngan TEXT DEFAULT '';
ALTER TABLE cty_van_tai ADD COLUMN nip TEXT DEFAULT '';
ALTER TABLE cty_van_tai ADD COLUMN email TEXT DEFAULT '';
ALTER TABLE cty_van_tai ADD COLUMN ghi_chu TEXT DEFAULT '';

-- Add currency to khach_hang
ALTER TABLE khach_hang ADD COLUMN tien_te TEXT DEFAULT 'PLN';
