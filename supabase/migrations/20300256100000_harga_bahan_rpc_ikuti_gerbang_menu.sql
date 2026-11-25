-- Master Harga Bahan Baku (native): gerbang RPC native_stok_price_data disamakan
-- dengan gerbang menu native (StokAkses.melihatHargaBahan).
--
-- Keputusan user 25 Nov 2026 — yang boleh membuka halaman ini HANYA:
--   kitchen (Admin Kitchen), admin, developer, area_manager, regional_manager.
-- Sebelumnya RPC mengizinkan area_manager/leader/regional_manager/spv (+ developer
-- sejak 20261003115317) dan menolak kitchen/admin.
--
-- Hanya daftar peran di gerbang yang diganti; isi fungsi lain dibiarkan seperti
-- di DB (diambil lewat pg_get_functiondef agar perubahan tak tercatat tidak tertimpa).
-- Idempoten: aman dijalankan ulang.

DO $$
DECLARE
  v_lama text;
  v_baru text;
  v_gerbang constant text :=
    'role IN (''kitchen'', ''admin'', ''developer'', ''area_manager'', ''regional_manager'')';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_lama
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'native_stok_price_data';
  IF v_lama IS NULL THEN
    RAISE EXCEPTION 'Fungsi public.native_stok_price_data tidak ditemukan';
  END IF;

  -- Tepat satu gerbang peran di fungsi ini; tolak bila bentuknya tak terduga.
  IF (SELECT count(*) FROM regexp_matches(v_lama, 'role IN \([^)]*\)', 'g')) <> 1 THEN
    RAISE EXCEPTION 'Gerbang role IN (...) di native_stok_price_data tidak tepat satu';
  END IF;

  v_baru := regexp_replace(v_lama, 'role IN \([^)]*\)', v_gerbang);
  v_baru := replace(v_baru, 'Akses modul Area Manager ditolak', 'Akses Master Harga Bahan Baku ditolak');

  IF v_baru <> v_lama THEN
    EXECUTE v_baru;
  END IF;
END;
$$;
