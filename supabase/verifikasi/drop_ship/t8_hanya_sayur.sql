-- supabase/verifikasi/drop_ship/t8_hanya_sayur.sql — harapan "HASIL T8: LULUS"
-- Drop-ship hanya untuk bahan ber-penanda bahan_baku.drop_ship (2026-09-15: hanya
-- Sayur (lettuce)). Dijalankan sebagai staf outlet tes asli; semua di-ROLLBACK.
BEGIN;
DO $$
DECLARE
  v_staff uuid; v_outlet uuid; v_sayur uuid; v_sapi uuid; v_aziz uuid; v_id uuid; v_ok boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  SELECT s.id, s.outlet_id INTO v_staff, v_outlet FROM public.outlet_staff s
    JOIN public.outlets o ON o.id = s.outlet_id
   WHERE o.type = 'test' AND s.status = 'active' ORDER BY s.role LIMIT 1;
  SELECT id INTO v_sayur FROM public.bahan_baku WHERE nama = 'Sayur (lettuce)' AND is_active;
  SELECT id INTO v_sapi FROM public.bahan_baku WHERE nama = 'SAPI' AND is_active;
  SELECT id INTO v_aziz FROM public.supplier WHERE nama = 'Lettuce (Pak Aziz) - Tempo 10';
  IF v_staff IS NULL OR v_sayur IS NULL OR v_sapi IS NULL OR v_aziz IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture tak lengkap'; END IF;

  -- (a) penanda: sayur drop-ship, SAPI bukan
  IF NOT (SELECT drop_ship FROM public.bahan_baku WHERE id = v_sayur) THEN RAISE EXCEPTION 'GAGAL (a): sayur tak bertanda'; END IF;
  IF (SELECT drop_ship FROM public.bahan_baku WHERE id = v_sapi) THEN RAISE EXCEPTION 'GAGAL (a): SAPI bertanda'; END IF;

  -- Pastikan SAPI punya katalog Pak Aziz Tempo 10 supaya (c) benar-benar menguji penanda,
  -- bukan penolakan "vendor tak terdaftar".
  INSERT INTO public.bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil)
  VALUES (v_sapi, v_aziz, 'blok', public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1))
  ON CONFLICT (bahan_baku_id, supplier_id) DO UPDATE SET is_active = true;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (b) sayur tetap bisa dicatat & info vendor tersedia
  IF NOT EXISTS (SELECT 1 FROM public.info_terima_vendor(v_sayur)) THEN RAISE EXCEPTION 'GAGAL (b): info vendor sayur kosong'; END IF;
  v_id := public.catat_terima_vendor(v_sayur, v_aziz, 1, v_today, 'UJI t8', NULL);
  IF v_id IS NULL THEN RAISE EXCEPTION 'GAGAL (b): sayur tak tercatat'; END IF;

  -- (c) SAPI ditolak di catat
  v_ok := false;
  BEGIN PERFORM public.catat_terima_vendor(v_sapi, v_aziz, 1, v_today, 'UJI t8 sapi', NULL);
  EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE '%tidak dikirim langsung%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): SAPI bisa dicatat drop-ship'; END IF;

  -- (d) SAPI ditolak di info vendor
  v_ok := false;
  BEGIN PERFORM * FROM public.info_terima_vendor(v_sapi);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): info vendor SAPI tersedia'; END IF;

  RAISE EXCEPTION 'HASIL T8: LULUS (hanya bahan drop_ship: sayur dicatat, SAPI ditolak di catat & info)';
END $$;
ROLLBACK;
