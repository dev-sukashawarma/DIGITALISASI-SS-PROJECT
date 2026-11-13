-- t0 — status mitra dari type (migration 20261113100000)
--
-- Bagian A: PENGUKURAN. Jalankan SEBELUM dan SESUDAH migration; hasil harus identik
-- sampai rupiah. Klaim JWT Admin Dev dipasang dulu (tanpa itu COGS terbaca 0).
-- Bagian B: ASERSI penjaga investasi + kontrol negatif. Hanya bermakna SESUDAH
-- migration; seluruhnya di-ROLLBACK.

-- ===== Bagian A: pengukuran =====
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);
SELECT periode,
       (r->>'total_revenue')::numeric       AS omzet,
       (r->>'total_cogs')::numeric          AS cogs,
       (r->>'total_mitra_markup')::numeric  AS markup_mitra
FROM (VALUES
  ('2026-08', '2026-08-01 00:00+07'::timestamptz, '2026-09-01 00:00+07'::timestamptz),
  ('2026-09', '2026-09-01 00:00+07', '2026-10-01 00:00+07'),
  ('2026-10', '2026-10-01 00:00+07', '2026-11-01 00:00+07'),
  ('2026-11-01..12', '2026-11-01 00:00+07', '2026-11-13 00:00+07')
) v(periode, dari, sampai)
CROSS JOIN LATERAL (SELECT public.get_owner_dashboard_summary(v.dari, v.sampai)::jsonb AS r) x
ORDER BY periode;
ROLLBACK;

-- ===== Bagian B: asersi (sesudah migration) =====
BEGIN;
DO $$
DECLARE
  v_internal uuid;
  v_mitra    uuid;
  v_ditolak  boolean := false;
BEGIN
  SELECT id INTO v_internal FROM public.outlets WHERE type = 'internal' AND is_active LIMIT 1;
  SELECT id INTO v_mitra    FROM public.outlets WHERE type = 'mitra' AND is_active LIMIT 1;

  BEGIN
    INSERT INTO public.mitra_investments (outlet_id, nilai_investasi, tanggal_mulai)
    VALUES (v_internal, 1, current_date);
  EXCEPTION WHEN check_violation THEN
    v_ditolak := true;
  END;
  IF NOT v_ditolak THEN
    RAISE EXCEPTION 'ASERSI GAGAL: investasi ke outlet internal tidak ditolak';
  END IF;

  -- outlet mitra tetap boleh (UPDATE baris yang ada, tidak mengubah apa pun)
  UPDATE public.mitra_investments SET outlet_id = outlet_id WHERE outlet_id = v_mitra;

  RAISE NOTICE 't0 B: LULUS';
END $$;
ROLLBACK;

-- Kontrol negatif: asersi yang sengaja salah HARUS melempar.
-- DO $$ BEGIN IF (SELECT count(*) FROM public.outlets) < 0 OR true THEN
--   RAISE EXCEPTION 'KONTROL NEGATIF: blok asersi memang bisa gagal'; END IF; END $$;
