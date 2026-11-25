-- Master Harga Bahan Baku (native) gagal dimuat untuk Kitchen, Purchasing,
-- Admin Finance, Admin dan Owner: RPC native_stok_price_data hanya mengizinkan
-- area_manager/leader/regional_manager/spv (+ developer sejak 20261003115317),
-- padahal menu web & native (canViewVendorPrices / StokAkses.melihatHargaBahan)
-- terbuka untuk peran-peran tersebut.
--
-- Hanya gerbang peran yang diubah; isi fungsi lain dibiarkan seperti di DB
-- (diambil lewat pg_get_functiondef agar tidak menimpa perubahan yang tak tercatat).
-- Idempoten: bila 'kitchen' sudah ada di gerbang, tidak ada yang diubah.

DO $$
DECLARE
  v_lama text;
  v_baru text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_lama
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'native_stok_price_data';
  IF v_lama IS NULL THEN
    RAISE EXCEPTION 'Fungsi public.native_stok_price_data tidak ditemukan';
  END IF;

  IF v_lama ~ 'role IN \([^)]*''kitchen''' THEN
    RAISE NOTICE 'Gerbang native_stok_price_data sudah memuat kitchen — dilewati';
    RETURN;
  END IF;

  v_baru := regexp_replace(
    v_lama,
    'role IN \(''area_manager''',
    'role IN (''kitchen'', ''purchasing'', ''admin_finance'', ''admin'', ''owner'', ''area_manager''',
    'g'
  );
  IF v_baru = v_lama THEN
    RAISE EXCEPTION 'Gerbang role IN (''area_manager'' ... ) tidak ditemukan di native_stok_price_data';
  END IF;

  v_baru := replace(v_baru, 'Akses modul Area Manager ditolak', 'Akses Master Harga Bahan Baku ditolak');

  EXECUTE v_baru;
END;
$$;
