-- Jalankan: supabase db query --linked -f supabase/verifikasi/app_retail_menu_terlaris/t1_kolom.sql
-- Di dalam transaksi + ROLLBACK: nol perubahan nyata.
BEGIN;
DO $$
DECLARE ids uuid[];
BEGIN
  -- (a) kolom ada, default kosong, tidak NULL
  SELECT menu_terlaris_ids INTO ids FROM public.app_pengaturan WHERE id = 1;
  IF ids IS NULL THEN RAISE EXCEPTION 'GAGAL (a): menu_terlaris_ids NULL'; END IF;

  -- (b) 6 id diterima
  UPDATE public.app_pengaturan SET menu_terlaris_ids = ARRAY(SELECT gen_random_uuid() FROM generate_series(1,6)) WHERE id = 1;

  -- (c) 7 id ditolak
  BEGIN
    UPDATE public.app_pengaturan SET menu_terlaris_ids = ARRAY(SELECT gen_random_uuid() FROM generate_series(1,7)) WHERE id = 1;
    RAISE EXCEPTION 'GAGAL (c): 7 menu terlaris lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (d) NULL ditolak
  BEGIN
    UPDATE public.app_pengaturan SET menu_terlaris_ids = NULL WHERE id = 1;
    RAISE EXCEPTION 'GAGAL (d): NULL lolos';
  EXCEPTION WHEN not_null_violation THEN NULL; END;

  RAISE NOTICE 'LULUS t1_kolom menu terlaris';
END $$;
ROLLBACK;
