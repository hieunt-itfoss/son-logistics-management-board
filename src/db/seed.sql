-- Seed: Admin user (password: admin123)
-- Password hash is bcrypt-style: in Workers we'll use Web Crypto API
-- For seed purposes, we store a placeholder - the app will hash properly on first run
INSERT INTO users (id, username, password_hash, display_name, role, active)
VALUES ('USR-001', 'admin', 'admin123', 'Quản trị viên', 'admin', 1);

INSERT INTO tuyen (id, ten, diem_di, diem_den, tien_to, khoang_cach_km)
VALUES
  ('T-001', 'Pháp - Ba Lan', 'Paris', 'Warszawa', 'F', 1500),
  ('T-002', 'Ý - Ba Lan', 'Milano', 'Warszawa', 'W', 1600),
  ('T-003', 'Tiệp - Ba Lan', 'Praha', 'Warszawa', 'C', 700);

INSERT INTO hang (id, ten, nuoc, dia_chi)
VALUES
  ('H-001', 'JM', 'Ý', 'Milano'),
  ('H-002', 'ENVIPLUS', 'Ý', 'Roma'),
  ('H-003', 'DYANA', 'Pháp', 'Paris'),
  ('H-004', 'ABB.WGT', 'Ý', 'Napoli'),
  ('H-005', 'CzMod', 'Tiệp', 'Praha');

INSERT INTO xe (id, bien_so, so_xe, loai_xe, trong_tai)
VALUES
  ('X-001', 'WA 12345', '50', 'TIR', 20000),
  ('X-002', 'WA 67890', '51', 'TIR', 20000),
  ('X-003', 'WA 11111', '52', 'TIR', 18000);

INSERT INTO tai_xe (id, ten, sdt, cmnd, ghi_chu)
VALUES
  ('TX-001', 'Nguyễn Văn A', '+48 600 111 222', '123456', ''),
  ('TX-002', 'Trần Văn B', '+48 600 333 444', '234567', '');

INSERT INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia)
VALUES
  ('KH-001', '001', 'A ĐỨC BÉO', 'PL5210123456', 'Warszawa', '+48 600 111 222', 30, '', ''),
  ('KH-002', '002', 'A HUI', 'PL5210234567', 'Wólka', '+48 600 222 333', 30, '', ''),
  ('KH-003', '003', 'A GIAO', 'PL5210345678', 'Warszawa', '+48 600 333 444', 30, '', ''),
  ('KH-004', '004', 'A TRƯỜNG', 'PL5210456789', 'Łódź', '+48 600 444 555', 14, 'Cẩn trọng', 'canhbao'),
  ('KH-005', '005', 'A PHƯƠNG', 'PL5210567890', 'Kraków', '+48 600 555 666', 30, '', '');
