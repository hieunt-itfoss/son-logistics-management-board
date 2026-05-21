-- Seed data matching original SAMPLE for faithful feature port
-- 6 roles, matching original data model

-- Users (login accounts for 6 roles)
INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, active) VALUES
  ('USR-001', 'admin', 'admin123', 'Admin', 'admin', 1),
  ('USR-002', 'ketoan', 'admin123', 'Kế toán trưởng', 'ketoanTruong', 1),
  ('USR-003', 'nhanvien', 'admin123', 'Nhân viên', 'nhanvien', 1),
  ('USR-004', 'kho', 'admin123', 'Thủ kho', 'kho', 1),
  ('USR-005', 'laixe', 'admin123', 'Lái xe', 'laixe', 1),
  ('USR-006', 'ketoanvien', 'admin123', 'Kế toán viên', 'ketoanVien', 1);

-- Nhan vien (unified staff, replaces tai_xe)
INSERT OR IGNORE INTO nhan_vien (id, ten, vai_tro, sdt, so_giay_to, dia_chi) VALUES
  ('NV-001', 'Nam', 'laixe', '+48 700 111 111', 'PESEL 88051512345', 'Warszawa'),
  ('NV-002', 'Tuấn', 'laixe', '+48 700 222 222', 'PESEL 87031554321', 'Warszawa'),
  ('NV-003', 'Hùng', 'laixe', '+48 700 333 333', 'PESEL 90071587654', 'Łódź'),
  ('NV-004', 'Sơn', 'laixe', '+48 700 444 444', 'PESEL 92021521098', 'Kraków'),
  ('NV-005', 'Linh', 'ketoanVien', '+48 700 555 555', 'PESEL 91091598765', 'Warszawa'),
  ('NV-006', 'Mai', 'ketoanTruong', '+48 700 666 666', 'PESEL 89111176543', 'Warszawa'),
  ('NV-007', 'Hoa', 'admin', '+48 700 777 777', 'PESEL 85051023456', 'Warszawa'),
  ('NV-008', 'Lan', 'kho', '+48 700 888 888', 'PESEL 93081234567', 'Wólka'),
  ('NV-009', 'Phượng', 'nhanvien', '+48 700 999 999', 'PESEL 94121234567', 'Warszawa'),
  ('NV-010', 'Cường', 'laixe', '+48 701 010 010', 'PESEL 86041587654', 'Wrocław'),
  ('NV-011', 'Đức', 'laixe', '+48 701 011 011', 'PESEL 91020598765', 'Łódź'),
  ('NV-012', 'Phương Anh', 'ketoanVien', '+48 701 012 012', 'PESEL 95061234567', 'Warszawa'),
  ('NV-013', 'Hằng', 'kho', '+48 701 013 013', 'PESEL 96071234567', 'Wólka'),
  ('NV-014', 'Tâm', 'laixe', '+48 701 014 014', 'PESEL 88091587654', 'Kraków'),
  ('NV-015', 'Quang', 'nhanvien', '+48 701 015 015', 'PESEL 92031234567', 'Warszawa');

-- Cty van tai (carriers)
INSERT OR IGNORE INTO cty_van_tai (id, ten, dia_chi, sdt) VALUES
  ('CV-001', 'TransPol', 'Warszawa', '+48 22 111 1111'),
  ('CV-002', 'EuroLogistics', 'Łódź', '+48 42 222 2222'),
  ('CV-003', 'SpeedFreight', 'Wrocław', '+48 71 333 3333'),
  ('CV-004', 'PolFracht', 'Warszawa', '+48 22 444 4444'),
  ('CV-005', 'EastTrans', 'Białystok', '+48 85 555 5555'),
  ('CV-006', 'WestExpress', 'Poznań', '+48 61 666 6666'),
  ('CV-007', 'CarpathianLog', 'Kraków', '+48 12 777 7777');

-- Khach hang
INSERT OR IGNORE INTO khach_hang (id, ma_kh, ten, nip, dia_chi, sdt, han_tt, ghi_chu, danh_gia) VALUES
  ('KH-001', '001', 'A ĐỨC BÉO', 'PL5210123456', 'Warszawa', '+48 600 111 222', 30, '', ''),
  ('KH-002', '002', 'A HUI', 'PL5210234567', 'Wólka', '+48 600 222 333', 30, '', ''),
  ('KH-003', '003', 'A GIAO', 'PL5210345678', 'Warszawa', '+48 600 333 444', 30, '', ''),
  ('KH-004', '004', 'A TRƯỜNG', 'PL5210456789', 'Łódź', '+48 600 444 555', 14, 'Cẩn trọng', 'canhbao'),
  ('KH-005', '005', 'A PHƯƠNG', 'PL5210567890', 'Kraków', '+48 600 555 666', 30, '', ''),
  ('KH-006', '006', 'A QUÝ', 'PL5210600001', 'Wólka', '+48 601 600 001', 30, 'KH lâu năm', ''),
  ('KH-007', '007', 'A LỘC', 'PL5210700002', 'Warszawa', '+48 601 700 002', 21, '', ''),
  ('KH-008', '008', 'C HOA', 'PL5210800003', 'Łódź', '+48 601 800 003', 30, '', ''),
  ('KH-009', '009', 'C LAN', 'PL5210900004', 'Wrocław', '+48 601 900 004', 14, 'Khách mới', ''),
  ('KH-010', '010', 'A BÌNH', 'PL5211000005', 'Poznań', '+48 602 100 005', 30, '', ''),
  ('KH-011', '011', 'A KHANG', 'PL5211100006', 'Kraków', '+48 602 100 006', 30, 'Trả chậm', ''),
  ('KH-012', '012', 'C THẢO', 'PL5211200007', 'Wólka', '+48 602 100 007', 30, '', ''),
  ('KH-013', '013', 'A NHẬT', 'PL5211300008', 'Warszawa', '+48 602 100 008', 30, 'KH cảnh báo', ''),
  ('KH-014', '014', 'A LONG', 'PL5211400009', 'Wólka', '+48 602 100 009', 21, '', ''),
  ('KH-015', '015', 'C MAI', 'PL5211500010', 'Gdańsk', '+48 602 100 010', 30, 'KH mới ký HĐ', '');

-- Hang
INSERT OR IGNORE INTO hang (id, ten, nuoc, dia_chi) VALUES
  ('H-001', 'JM', 'Ý', 'Milano'),
  ('H-002', 'ENVIPLUS', 'Ý', 'Roma'),
  ('H-003', 'DYANA', 'Pháp', 'Paris'),
  ('H-004', 'ABB.WGT', 'Ý', 'Napoli'),
  ('H-005', 'CzMod', 'Tiệp', 'Praha'),
  ('H-006', 'Italmod', 'Ý', 'Bologna'),
  ('H-007', 'FrenchPrime', 'Pháp', 'Lyon'),
  ('H-008', 'GoldenWear', 'Pháp', 'Marseille'),
  ('H-009', 'Skoda Parts', 'Tiệp', 'Mladá Boleslav'),
  ('H-010', 'BergamoTech', 'Ý', 'Bergamo');

-- Tuyen (with mau and dau_muc_group)
INSERT OR IGNORE INTO tuyen (id, ten, mau, dau_muc_group, tien_to, diem_di, diem_den, khoang_cach_km) VALUES
  ('T-001', 'Paris-Wólka', 'blue', 'phap', 'F', 'Paris', 'Warszawa', 1500),
  ('T-002', 'Lyon-Wólka', 'blue', 'phap', 'F', 'Lyon', 'Warszawa', 1600),
  ('T-003', 'Prato-Wólka', 'amber', 'y', 'W', 'Prato', 'Warszawa', 1600),
  ('T-004', 'Roma-Wólka', 'amber', 'y', 'W', 'Roma', 'Warszawa', 1700),
  ('T-005', 'Praha-Wólka', 'green', 'tiep', 'C', 'Praha', 'Warszawa', 700),
  ('T-006', 'Wólka-Lodz', 'gray', 'balan', 'P', 'Wólka', 'Lodz', 150),
  ('T-007', 'Khác', 'gray', 'khac', 'K', '', '', 0),
  ('T-008', 'Berlin-Wólka', 'gray', 'khac', 'K', 'Berlin', 'Warszawa', 600),
  ('T-009', 'Madrid-Wólka', 'gray', 'khac', 'K', 'Madrid', 'Warszawa', 2500);

-- Xe (with tai_xe_id and cty_vt_id)
INSERT OR IGNORE INTO xe (id, bien_so, so_xe, loai_xe, trong_tai, tai_xe_id, cty_vt_id) VALUES
  ('XE-46', 'WW 12345A', 'XE 46', 'Tải lớn', 24000, 'NV-003', 'CV-001'),
  ('XE-47', 'WW 67890B', 'XE 47', 'Tải lớn', 24000, 'NV-001', 'CV-002'),
  ('XE-48', 'WL 11111C', 'XE 48', 'Tải vừa', 20000, 'NV-004', 'CV-002'),
  ('XE-49', 'KR 12345E', 'XE 49', 'Tải lớn', 24000, 'NV-010', 'CV-003'),
  ('XE-50', 'WW 99999D', 'XE 50', 'Tải vừa', 20000, 'NV-002', 'CV-001'),
  ('XE-51', 'WL 22222F', 'XE 51', 'Tải vừa', 20000, 'NV-011', 'CV-004'),
  ('XE-52', 'PO 33333G', 'XE 52', 'Tải lớn', 24000, 'NV-014', 'CV-005'),
  ('XE-53', 'GD 44444H', 'XE 53', 'Tải vừa', 20000, 'NV-001', 'CV-006'),
  ('XE-54', 'WR 55555I', 'XE 54', 'Tải nhỏ', 12000, 'NV-003', 'CV-007');

-- Bang gia
INSERT OR IGNORE INTO bang_gia (id, khach_hang_id, don_gia, tien_te) VALUES
  ('BG-001', 'KH-001', 100, 'PLN'), ('BG-002', 'KH-002', 80, 'PLN'),
  ('BG-003', 'KH-003', 100, 'PLN'), ('BG-004', 'KH-004', 80, 'PLN'),
  ('BG-005', 'KH-005', 100, 'PLN'), ('BG-006', 'KH-006', 90, 'PLN'),
  ('BG-007', 'KH-007', 95, 'PLN'),  ('BG-008', 'KH-008', 85, 'PLN'),
  ('BG-009', 'KH-009', 100, 'PLN'), ('BG-010', 'KH-010', 80, 'EUR'),
  ('BG-011', 'KH-011', 90, 'PLN'),  ('BG-012', 'KH-012', 85, 'PLN'),
  ('BG-013', 'KH-013', 95, 'PLN'),  ('BG-014', 'KH-014', 100, 'PLN'),
  ('BG-015', 'KH-015', 90, 'PLN');

-- Chuyen xe (with new columns)
INSERT OR IGNORE INTO chuyen_xe (id, tuyen_id, xe_id, tai_xe_id, ngay_di, ngay_den, gia_chuyen, tien_te, da_thanh_toan, ngay_thanh_toan, so_sent_va_gt, trang_thai) VALUES
  ('F260526-50', 'T-001', 'XE-50', 'NV-002', '2026-05-25', '2026-05-26', 4500, 'PLN', 0, '', 'SENT2026/0002 · CMR-FR-002', 'hoan_thanh'),
  ('W260526-47', 'T-003', 'XE-47', 'NV-001', '2026-05-24', '2026-05-26', 5000, 'PLN', 0, '', 'SENT2026/0001 · CMR-IT-001', 'hoan_thanh'),
  ('F260525-50', 'T-001', 'XE-50', 'NV-002', '2026-05-23', '2026-05-25', 4500, 'PLN', 0, '', 'SENT2026/0003', 'hoan_thanh'),
  ('F260524-50', 'T-001', 'XE-50', 'NV-002', '2026-05-22', '2026-05-24', 4500, 'PLN', 1, '2026-05-25', 'SENT2026/0004', 'hoan_thanh'),
  ('W260524-47', 'T-003', 'XE-47', 'NV-001', '2026-05-22', '2026-05-24', 5000, 'PLN', 0, '', 'SENT2026/0005', 'hoan_thanh'),
  ('W260523-46', 'T-003', 'XE-46', 'NV-003', '2026-05-21', '2026-05-23', 4800, 'PLN', 1, '2026-05-24', 'SENT2026/0006', 'hoan_thanh'),
  ('F260522-48', 'T-001', 'XE-48', 'NV-004', '2026-05-20', '2026-05-22', 4200, 'PLN', 1, '2026-05-23', 'SENT2026/0008', 'hoan_thanh'),
  ('F260526-49', 'T-001', 'XE-49', 'NV-010', '2026-05-23', '2026-05-26', 4600, 'PLN', 0, '', 'SENT2026/0014 · Paris', 'hoan_thanh'),
  ('F260526-47', 'T-002', 'XE-47', 'NV-001', '2026-05-24', '2026-05-26', 4400, 'PLN', 0, '', 'SENT2026/0013 · Lyon', 'hoan_thanh'),
  ('F260523-53', 'T-002', 'XE-53', 'NV-001', '2026-05-20', '2026-05-23', 4500, 'PLN', 1, '2026-05-24', 'SENT2026/0017 · Lyon', 'hoan_thanh'),
  ('W260526-46', 'T-004', 'XE-46', 'NV-003', '2026-05-23', '2026-05-26', 5200, 'PLN', 0, '', 'SENT2026/0012 · CMR-IT-Roma', 'hoan_thanh'),
  ('W260525-51', 'T-003', 'XE-51', 'NV-011', '2026-05-22', '2026-05-25', 5100, 'PLN', 0, '', 'SENT2026/0015 · Prato', 'hoan_thanh'),
  ('W260522-46', 'T-003', 'XE-46', 'NV-003', '2026-05-20', '2026-05-22', 4800, 'PLN', 0, '', 'SENT2026/0007', 'hoan_thanh'),
  ('C260526-49', 'T-005', 'XE-49', 'NV-001', '2026-05-24', '2026-05-26', 5500, 'PLN', 0, '', 'SENT2026/0011 · CMR-CZ-001', 'hoan_thanh'),
  ('C260524-52', 'T-005', 'XE-52', 'NV-014', '2026-05-21', '2026-05-24', 5800, 'PLN', 0, '', 'SENT2026/0016 · Praha', 'hoan_thanh'),
  ('C260520-48', 'T-005', 'XE-48', 'NV-004', '2026-05-18', '2026-05-20', 5500, 'PLN', 0, '', 'SENT2026/0010 · Tiệp', 'hoan_thanh'),
  ('P260526-48', 'T-006', 'XE-48', 'NV-004', '2026-05-26', '2026-05-26', 1200, 'PLN', 0, '', 'BL nội địa Lodz', 'hoan_thanh'),
  ('P260519-46', 'T-006', 'XE-46', 'NV-003', '2026-05-18', '2026-05-19', 1500, 'PLN', 0, '', 'BL nội địa', 'hoan_thanh'),
  ('K260521-49', 'T-008', 'XE-49', 'NV-010', '2026-05-19', '2026-05-21', 4200, 'EUR', 0, '', 'SENT2026/0018 · Berlin', 'hoan_thanh'),
  ('K260520-52', 'T-009', 'XE-52', 'NV-014', '2026-05-17', '2026-05-20', 6500, 'EUR', 0, '', 'SENT2026/0019 · Madrid', 'hoan_thanh');

-- Lo hang (matching original sample data)
INSERT OR IGNORE INTO lo_hang (id, chuyen_xe_id, khach_hang_id, hang_id, so_kien, da_tra_hang, don_gia, tien_te, thanh_tien, so_tien_hang, giam_gia, nguoi_tao, nguoi_thu) VALUES
  ('F260526-50-001', 'F260526-50', 'KH-001', 'H-003', 240, 240, 100, 'PLN', 24000, 0, 0, 'NV-005', 'NV-005'),
  ('F260526-50-002', 'F260526-50', 'KH-002', 'H-003', 128, 128, 85, 'EUR', 10880, 5000, 0, 'NV-005', 'NV-005'),
  ('W260526-47-001', 'W260526-47', 'KH-001', 'H-001', 182, 182, 100, 'PLN', 18200, 0, 200, 'NV-005', 'NV-005'),
  ('W260526-47-002', 'W260526-47', 'KH-002', 'H-002', 76, 72, 80, 'PLN', 6080, 0, 0, 'NV-009', 'NV-005'),
  ('F260525-50-001', 'F260525-50', 'KH-004', 'H-004', 95, 93, 80, 'PLN', 7600, 12000, 0, 'NV-009', 'NV-005'),
  ('F260524-50-001', 'F260524-50', 'KH-001', 'H-001', 149, 149, 100, 'PLN', 14900, 0, 0, 'NV-005', 'NV-005'),
  ('W260524-47-001', 'W260524-47', 'KH-002', 'H-002', 320, 200, 40, 'PLN', 12800, 0, 0, 'NV-005', 'NV-005'),
  ('W260523-46-001', 'W260523-46', 'KH-001', 'H-001', 204, 204, 100, 'PLN', 20400, 0, 0, 'NV-005', 'NV-005'),
  ('W260523-46-002', 'W260523-46', 'KH-005', 'H-003', 110, 110, 100, 'PLN', 11000, 0, 0, 'NV-005', 'NV-005'),
  ('W260522-46-001', 'W260522-46', 'KH-003', 'H-001', 111, 111, 100, 'PLN', 11100, 0, 0, 'NV-005', 'NV-005'),
  ('F260522-48-001', 'F260522-48', 'KH-001', 'H-001', 175, 175, 100, 'PLN', 17500, 0, 0, 'NV-005', 'NV-005'),
  ('C260520-48-001', 'C260520-48', 'KH-004', 'H-005', 220, 100, 80, 'PLN', 17600, 8000, 0, 'NV-005', 'NV-005'),
  ('P260519-46-001', 'P260519-46', 'KH-005', 'H-001', 50, 50, 0, 'PLN', 1800, 0, 0, 'NV-009', 'NV-005'),
  ('F260526-50-003', 'F260526-50', 'KH-005', 'H-001', 65, 60, 85, 'PLN', 5525, 0, 25, 'NV-005', 'NV-005'),
  ('F260526-49-001', 'F260526-49', 'KH-006', 'H-007', 150, 150, 90, 'PLN', 13500, 8000, 0, 'NV-005', 'NV-005'),
  ('F260526-47-001', 'F260526-47', 'KH-003', 'H-001', 120, 120, 90, 'PLN', 10800, 5500, 0, 'NV-005', 'NV-005'),
  ('F260523-53-001', 'F260523-53', 'KH-007', 'H-008', 200, 200, 95, 'PLN', 19000, 0, 200, 'NV-005', 'NV-005'),
  ('F260526-49-002', 'F260526-49', 'KH-008', 'H-003', 120, 120, 85, 'PLN', 10200, 0, 0, 'NV-005', 'NV-005'),
  ('F260526-49-003', 'F260526-49', 'KH-011', 'H-003', 140, 140, 90, 'PLN', 12600, 7000, 0, 'NV-005', 'NV-005'),
  ('F260526-49-004', 'F260526-49', 'KH-014', 'H-007', 130, 120, 100, 'PLN', 13000, 6500, 0, 'NV-005', 'NV-005'),
  ('F260523-53-002', 'F260523-53', 'KH-009', 'H-007', 75, 75, 100, 'PLN', 7500, 4000, 0, 'NV-009', 'NV-005'),
  ('F260523-53-003', 'F260523-53', 'KH-013', 'H-008', 160, 160, 95, 'PLN', 15200, 9000, 0, 'NV-005', 'NV-005'),
  ('W260525-51-001', 'W260525-51', 'KH-006', 'H-006', 80, 80, 90, 'PLN', 7200, 0, 0, 'NV-005', 'NV-005'),
  ('W260525-51-002', 'W260525-51', 'KH-007', 'H-001', 110, 110, 95, 'PLN', 10450, 5000, 0, 'NV-005', 'NV-005'),
  ('W260525-51-003', 'W260525-51', 'KH-009', 'H-002', 95, 95, 100, 'PLN', 9500, 0, 0, 'NV-005', 'NV-005'),
  ('W260525-51-004', 'W260525-51', 'KH-011', 'H-001', 70, 70, 90, 'PLN', 6300, 0, 0, 'NV-005', 'NV-005'),
  ('W260525-51-005', 'W260525-51', 'KH-012', 'H-006', 85, 85, 85, 'PLN', 7225, 0, 0, 'NV-005', 'NV-005'),
  ('W260525-51-006', 'W260525-51', 'KH-013', 'H-010', 55, 55, 95, 'PLN', 5225, 0, 0, 'NV-005', 'NV-005'),
  ('W260525-51-007', 'W260525-51', 'KH-015', 'H-002', 65, 65, 90, 'PLN', 5850, 0, 0, 'NV-005', 'NV-005'),
  ('C260524-52-001', 'C260524-52', 'KH-001', 'H-005', 80, 80, 120, 'PLN', 9600, 15000, 0, 'NV-005', 'NV-005'),
  ('C260524-52-002', 'C260524-52', 'KH-008', 'H-005', 60, 60, 85, 'PLN', 5100, 3500, 0, 'NV-005', 'NV-005'),
  ('C260524-52-003', 'C260524-52', 'KH-011', 'H-005', 50, 50, 90, 'PLN', 4500, 2500, 0, 'NV-005', 'NV-005'),
  ('C260524-52-004', 'C260524-52', 'KH-013', 'H-009', 75, 75, 95, 'PLN', 7125, 4500, 0, 'NV-005', 'NV-005'),
  ('C260524-52-005', 'C260524-52', 'KH-015', 'H-005', 90, 90, 90, 'PLN', 8100, 5000, 0, 'NV-005', 'NV-005'),
  ('K260521-49-001', 'K260521-49', 'KH-010', 'H-007', 180, 180, 80, 'EUR', 14400, 0, 0, 'NV-005', 'NV-005'),
  ('K260520-52-001', 'K260520-52', 'KH-010', 'H-008', 90, 90, 80, 'EUR', 7200, 5000, 0, 'NV-005', 'NV-005');

-- Phieu thu
INSERT OR IGNORE INTO phieu_thu (id, ngay, khach_hang_id, dau_muc, kieu_qt, loai_tien, lo_ids, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio) VALUES
  ('PT-001', '2026-05-26', 'KH-001', 'Vận tải Ý', 'trahet', 'vantai', '["W260526-47-001"]', 18000, 'PLN', 'CK', '', 'NV-005', '08:30'),
  ('PT-002', '2026-05-26', 'KH-003', 'Vận tải Ý', 'trahet', 'vantai', '["W260522-46-001"]', 11100, 'PLN', 'TM', 'Trả phiếu W-003-0001', 'NV-005', '09:15'),
  ('PT-003', '2026-05-26', 'KH-002', 'Vận tải Pháp', 'trahet', 'vantai', '["F260526-50-002"]', 10880, 'EUR', 'CK', '', 'NV-005', '09:40'),
  ('PT-004', '2026-05-26', 'KH-001', 'Vận tải Pháp', 'trahet', 'vantai', '["F260524-50-001","F260522-48-001"]', 32400, 'PLN', 'CK', 'Trả gộp 2 phiếu', 'NV-005', '10:00'),
  ('PT-005', '2026-05-26', 'KH-001', 'Vận tải Ý', 'trahet', 'vantai', '["W260523-46-001"]', 20400, 'PLN', 'CK', '', 'NV-005', '10:10'),
  ('PT-006', '2026-05-25', 'KH-005', 'Vận tải Ý', 'trahet', 'vantai', '["W260523-46-002"]', 11000, 'PLN', 'TM', '', 'NV-005', '14:00'),
  ('PT-007', '2026-05-26', 'KH-001', 'Vận tải Pháp', 'ung', 'vantai', '[]', 5000, 'PLN', 'TM', 'Khách ứng', 'NV-006', '15:00'),
  ('PT-008', '2026-05-26', 'KH-002', 'Vận tải Pháp', 'trahet', 'tienhang', '["F260526-50-002"]', 5000, 'EUR', 'CK', 'Trả tiền hàng', 'NV-005', '11:00'),
  ('PT-009', '2026-05-26', 'KH-001', 'Vận tải Pháp', 'trahet', 'vantai', '["F260526-50-001"]', 5000, 'PLN', 'CK', 'Trả 1 phần F-001-0001 (còn 19k)', 'NV-005', '11:30'),
  ('PT-010', '2026-05-26', 'KH-001', 'Vận tải Tiệp', 'trahet', 'vantai', '["C260524-52-001"]', 9600, 'PLN', 'CK', 'Trả VT Tiệp', 'NV-005', '13:00'),
  ('PT-011', '2026-05-26', 'KH-001', 'Vận tải Tiệp', 'trahet', 'tienhang', '["C260524-52-001"]', 10000, 'PLN', 'CK', 'Trả TH Tiệp 1 phần (còn 5k)', 'NV-005', '13:05'),
  ('PT-021', '2026-05-26', 'KH-005', 'Vận tải Pháp', 'trahet', 'vantai', '["F260526-50-003","F260526-50-003"]', 23525, 'PLN', 'CK', 'Trả gộp VT Pháp 2 phiếu', 'NV-005', '18:00'),
  ('PT-024', '2026-05-26', 'KH-006', 'Vận tải Pháp', 'trahet', 'vantai', '["F260526-49-001"]', 13500, 'PLN', 'CK', 'Trả VT Pháp', 'NV-005', '09:00'),
  ('PT-027', '2026-05-26', 'KH-007', 'Vận tải Pháp', 'trahet', 'vantai', '["F260523-53-001"]', 19000, 'PLN', 'CK', 'Trả hết Pháp', 'NV-005', '10:00'),
  ('PT-031', '2026-05-26', 'KH-010', 'Vận tải khác', 'trahet', 'vantai', '["K260521-49-001"]', 14400, 'EUR', 'CK', 'Trả VT Berlin', 'NV-005', '12:00');

-- Phieu chi
INSERT OR IGNORE INTO phieu_chi (id, ngay, dau_muc, chuyen_xe_id, lo_ids, kieu_qt, so_tien, tien_te, hinh_thuc, ghi_chu, nguoi_nhap, gio, phai_thu_ve) VALUES
  ('PC-001', '2026-05-25', 'Vận tải Pháp', 'F260524-50', '[]', 'trahet', 4500, 'PLN', 'CK', 'Trả TransPol F-240526-50', 'NV-007', '11:00', 1),
  ('PC-002', '2026-05-26', 'Vận tải Pháp', '', '[]', 'trahet', 250, 'PLN', 'TM', 'Xăng XE 47', 'NV-003', '10:20', 1),
  ('PC-003', '2026-05-26', 'Văn phòng', '', '[]', 'trahet', 180, 'PLN', 'TM', 'Đồ thắp hương + giấy in', 'NV-006', '11:00', 0),
  ('PC-007', '2026-05-15', 'Văn phòng', '', '[]', 'trahet', 12000, 'PLN', 'CK', 'Lương tháng 5', 'NV-007', '09:00', 0),
  ('PC-009', '2026-05-26', 'Vận tải Tiệp', 'C260526-49', '[]', 'trahet', 5500, 'PLN', 'CK', 'Trả CV C-260526-49', 'NV-007', '09:00', 1),
  ('PC-012', '2026-05-26', 'Vận tải Pháp', '', '[]', 'trahet', 380, 'EUR', 'TM', 'Phí cầu đường Pháp (EUR)', 'NV-002', '12:00', 1),
  ('PC-020', '2026-05-26', 'Vận tải khác', 'K260521-49', '[]', 'trahet', 4200, 'EUR', 'CK', 'Trả CV Berlin (EUR)', 'NV-007', '13:00', 1);

-- So du dau ky (opening balances)
INSERT OR IGNORE INTO so_du_dau_ky (id, tien_te, so_du, ngay_ap_dung) VALUES
  ('SD-001', 'PLN', 25000, '2026-05-01'),
  ('SD-002', 'EUR', 8500, '2026-05-01'),
  ('SD-003', 'USD', 320, '2026-05-01');
