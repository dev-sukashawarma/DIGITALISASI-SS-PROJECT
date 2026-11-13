-- t3 — batalkan_pembukaan_outlet (migration 20261113120000)
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't3 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_am  uuid;
  v_a   uuid;
  v_b   uuid;
  v_sj  uuid;
  v_aktif uuid;
  r     jsonb;
BEGIN
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;

  -- alasan terlalu pendek
  v_a := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T3A','am_staff_id',v_am));
  BEGIN
    PERFORM public.batalkan_pembukaan_outlet(v_a, 'x');
    RAISE EXCEPTION 'ASERSI GAGAL 0: alasan pendek lolos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
  END;

  -- (a) tanpa data → dihapus, log tetap ada
  r := public.batalkan_pembukaan_outlet(v_a, 'Lokasi batal disewa');
  IF r->>'aksi' <> 'dihapus' THEN RAISE EXCEPTION 'ASERSI GAGAL a: aksi %, sisa %', r->>'aksi', r->'sisa'; END IF;
  IF EXISTS (SELECT 1 FROM public.outlets WHERE id = v_a) THEN RAISE EXCEPTION 'ASERSI GAGAL a: outlet masih ada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlet_pembukaan_log WHERE outlet_id = v_a AND aksi = 'dihapus') THEN RAISE EXCEPTION 'ASERSI GAGAL a: log hilang'; END IF;

  -- (b) punya satu surat jalan → dinonaktifkan, SJ tetap ada
  v_b := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T3B','am_staff_id',v_am));
  INSERT INTO public.surat_jalan (outlet_id, status) VALUES (v_b, 'dikirim') RETURNING id INTO v_sj;
  r := public.batalkan_pembukaan_outlet(v_b, 'Mitra mundur');
  IF r->>'aksi' <> 'dinonaktifkan' THEN RAISE EXCEPTION 'ASERSI GAGAL b: aksi %', r->>'aksi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.surat_jalan WHERE id = v_sj) THEN RAISE EXCEPTION 'ASERSI GAGAL b: SJ ikut terhapus'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'sisa') e WHERE e->>'jenis' = 'surat_jalan' AND (e->>'jumlah')::int = 1) THEN
    RAISE EXCEPTION 'ASERSI GAGAL b: sisa tidak menyebut surat_jalan: %', r->'sisa';
  END IF;
  IF (SELECT status FROM public.outlets WHERE id = v_b) <> 'inactive' THEN RAISE EXCEPTION 'ASERSI GAGAL b: status'; END IF;

  -- (c) outlet aktif → ditolak
  SELECT id INTO v_aktif FROM public.outlets WHERE status = 'active' AND type = 'internal' LIMIT 1;
  BEGIN
    PERFORM public.batalkan_pembukaan_outlet(v_aktif, 'Uji tolak outlet aktif');
    RAISE EXCEPTION 'ASERSI GAGAL c: outlet aktif bisa dibatalkan';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
  END;
END $$;
SELECT 't3 lulus' AS hasil;
ROLLBACK;
