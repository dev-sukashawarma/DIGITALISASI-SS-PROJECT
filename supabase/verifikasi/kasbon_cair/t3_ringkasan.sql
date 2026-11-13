-- Uji 20261113142000: daftar & ringkasan HR mengenal menunggu_cair.
-- Jalankan sesudah 20261113140000 & 20261113142000. Berakhir ROLLBACK. Penanda: 'KONTROL: T3 ...'.
BEGIN;
DO $$
DECLARE
  c_hr   uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_hr' AND status = 'active' ORDER BY id LIMIT 1);
  c_crew uuid := (SELECT id FROM outlet_staff WHERE role = 'crew' AND status = 'active' ORDER BY id LIMIT 1);
  b jsonb; a jsonb; d jsonb; v uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);
  b := hr_perizinan_ringkasan('{}') -> 'kasbon';
  INSERT INTO cash_advances (staff_id, amount, remaining, reason, status_hr) VALUES (c_crew, 500000, 500000, 'uji t3', 'approved') RETURNING id INTO v;
  a := hr_perizinan_ringkasan('{}') -> 'kasbon';
  IF (a->>'menunggu_cair')::int IS DISTINCT FROM coalesce((b->>'menunggu_cair')::int, 0) + 1 THEN RAISE EXCEPTION 'T3a hitung % %', b, a; END IF;
  IF (a->>'menunggu_cair_amount')::numeric IS DISTINCT FROM coalesce((b->>'menunggu_cair_amount')::numeric, 0) + 500000 THEN RAISE EXCEPTION 'T3a nominal'; END IF;
  d := hr_kasbon_daftar('menunggu_cair', NULL, NULL, '{}', 1000, 0);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d->'rows') e WHERE (e->>'id')::uuid = v) THEN RAISE EXCEPTION 'T3b tidak ada di tab menunggu_cair'; END IF;
  d := hr_kasbon_daftar('active', NULL, NULL, '{}', 1000, 0);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(d->'rows') e WHERE (e->>'id')::uuid = v) THEN RAISE EXCEPTION 'T3c bocor ke tab active'; END IF;
  RAISE EXCEPTION 'KONTROL: T3 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
