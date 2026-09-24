-- supabase/verifikasi/master_bahan/t10_cabut_tulis_langsung.sql
-- Harapan SEBELUM migration 20260924200000 di-apply: GAGAL dengan pesan
--   "GAGAL: <tabel> masih bisa ditulis langsung"
-- Harapan SETELAH apply: RAISE NOTICE 'HASIL T10: LULUS', tanpa error.
--
-- Dijalankan dalam transaksi + ROLLBACK — tidak mengubah data.

BEGIN;
DO $$
DECLARE v_admin uuid; v_b uuid; v_ok boolean; t text;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_b FROM bahan_baku WHERE nama='SAPI';
  IF v_admin IS NULL OR v_b IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;
  FOREACH t IN ARRAY ARRAY['bahan_baku','bahan_baku_sku','bahan_baku_harga','bahan_baku_supplier','supplier'] LOOP
    IF has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')
       OR has_table_privilege('anon', 'public.' || t, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || t, 'INSERT')
       OR has_table_privilege('anon', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'GAGAL: % masih bisa ditulis langsung', t;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'GAGAL: SELECT % ikut dicabut', t;
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- admin: tulis langsung ditolak …
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET merek = merek WHERE id = v_b;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: admin masih bisa UPDATE bahan_baku langsung'; END IF;
  -- … tetapi RPC tetap jalan (merek diisi nilai yang sama → tidak mengubah data)
  PERFORM public.simpan_bahan_baku(v_b, jsonb_build_object('merek', (SELECT merek FROM bahan_baku WHERE id = v_b)), 'uji t10');
  RAISE NOTICE 'HASIL T10: LULUS';
END $$;
ROLLBACK;
