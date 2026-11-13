-- t5 — papan tanpa langkah "Jadwal absensi" dan "Target harian" (migration 20261113150000)
-- Keputusan owner 2026-11-13. Seluruhnya BEGIN … ROLLBACK. Sukses = baris 't5 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);
DO $$
DECLARE v_am uuid; v_o uuid; r jsonb;
BEGIN
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T5','am_staff_id',v_am));
  r := public.status_persiapan_outlet(v_o);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' IN ('absensi','target_harian')) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: papan masih memuat langkah absensi/target harian';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' = 'leader') THEN
    RAISE EXCEPTION 'ASERSI GAGAL: langkah leader ikut hilang';
  END IF;
END $$;
SELECT 't5 lulus' AS hasil;
ROLLBACK;
