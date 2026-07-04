-- Aktifkan BOM automation KHUSUS outlet SUKA SHAWARMA EMPANG (550e8400-e29b-41d4-a716-446655440002)
-- utk keperluan testing Tahap C. Outlet lain TIDAK terpengaruh (trigger skip otomatis).
INSERT INTO global_settings (key, value)
VALUES ('bom_automation_allowed_outlets', '550e8400-e29b-41d4-a716-446655440002')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
