-- supabase/verifikasi/master_bahan/t2_audit.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_admin uuid; v_crew uuid; v_id uuid; v_n int; v_row master_bahan_audit%ROWTYPE;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  IF v_admin IS NULL OR v_crew IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf tak lengkap'; END IF;

  INSERT INTO bahan_baku (nama, satuan, kategori) VALUES ('UJI T2 BAHAN', 'Pcs', 'UJI') RETURNING id INTO v_id;

  -- (a) sebagai admin, ubah nama dengan alasan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('app.alasan', 'uji t2 ganti nama', true);
  UPDATE bahan_baku SET nama = 'UJI T2 BAHAN B' WHERE id = v_id;

  SELECT * INTO v_row FROM master_bahan_audit
   WHERE tabel = 'bahan_baku' AND baris_id = v_id AND aksi = 'UPDATE' ORDER BY id DESC LIMIT 1;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'GAGAL (a): baris audit UPDATE tidak ada / tak terbaca admin'; END IF;
  IF v_row.perubahan -> 'nama' ->> 'baru' <> 'UJI T2 BAHAN B'
     OR v_row.perubahan -> 'nama' ->> 'lama' <> 'UJI T2 BAHAN' THEN
    RAISE EXCEPTION 'GAGAL (a): isi perubahan salah: %', v_row.perubahan;
  END IF;
  IF v_row.alasan IS DISTINCT FROM 'uji t2 ganti nama' OR v_row.changed_by IS DISTINCT FROM v_admin
     OR v_row.bahan_baku_id IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'GAGAL (a): alasan/pelaku/bahan salah';
  END IF;

  -- (b) UPDATE tanpa perubahan nilai tidak menulis audit
  SELECT count(*) INTO v_n FROM master_bahan_audit WHERE baris_id = v_id;
  UPDATE bahan_baku SET nama = 'UJI T2 BAHAN B' WHERE id = v_id;
  IF (SELECT count(*) FROM master_bahan_audit WHERE baris_id = v_id) <> v_n THEN
    RAISE EXCEPTION 'GAGAL (b): UPDATE kosong tetap menulis audit';
  END IF;

  -- (c) view riwayat memuat baris data
  IF NOT EXISTS (SELECT 1 FROM riwayat_master_bahan WHERE bahan_baku_id = v_id AND jenis = 'data') THEN
    RAISE EXCEPTION 'GAGAL (c): riwayat_master_bahan tak memuat baris data';
  END IF;

  -- (d) crew tidak bisa membaca log
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM master_bahan_audit WHERE baris_id = v_id) THEN
    RAISE EXCEPTION 'GAGAL (d): crew bisa membaca master_bahan_audit';
  END IF;
  RAISE NOTICE 'HASIL T2: LULUS';
END $$;
ROLLBACK;
