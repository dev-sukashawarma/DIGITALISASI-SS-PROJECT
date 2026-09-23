-- supabase/verifikasi/master_bahan/t1_peruntukan.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_ok boolean; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260923180000') THEN
    RAISE EXCEPTION 'GAGAL: migration 20260923180000 belum distempel';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bahan_baku_peruntukan_check') THEN
    RAISE EXCEPTION 'GAGAL: CHECK peruntukan tidak ada';
  END IF;
  INSERT INTO bahan_baku (nama, satuan, kategori) VALUES ('UJI T1 BAHAN', 'Pcs', 'UJI') RETURNING id INTO v_id;
  IF (SELECT peruntukan FROM bahan_baku WHERE id = v_id) <> 'outlet'
     OR (SELECT is_opname FROM bahan_baku WHERE id = v_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'GAGAL: default kolom salah';
  END IF;
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET peruntukan = 'lainnya' WHERE id = v_id;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: nilai peruntukan liar diterima'; END IF;
  RAISE NOTICE 'HASIL T1: LULUS';
END $$;
ROLLBACK;
