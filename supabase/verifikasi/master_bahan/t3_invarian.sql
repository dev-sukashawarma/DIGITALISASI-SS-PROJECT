-- supabase/verifikasi/master_bahan/t3_invarian.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_id uuid; v_ok boolean; v_admin uuid; v_crew uuid; v_uid uuid; v_hg uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  SELECT id INTO v_hg FROM bahan_baku WHERE nama = 'HAND GLOVE';
  IF v_admin IS NULL OR v_crew IS NULL OR v_hg IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  -- (a) tiga tingkat: faktor_konversi diturunkan
  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, faktor_konversi, kategori)
  VALUES ('UJI T3 A', 'Dus', 'Roll', 48, 'cm', 36480, 999, 'UJI') RETURNING id INTO v_id;
  IF (SELECT faktor_konversi FROM bahan_baku WHERE id = v_id) <> 760 THEN
    RAISE EXCEPTION 'GAGAL (a): faktor_konversi tidak diturunkan';
  END IF;

  -- (b) tanpa satuan kecil → faktor_tampilan NULL, faktor_konversi 1
  INSERT INTO bahan_baku (nama, satuan, kategori, faktor_konversi) VALUES ('UJI T3 B', 'Unit', 'UJI', 50) RETURNING id INTO v_id;
  IF (SELECT faktor_konversi FROM bahan_baku WHERE id = v_id) <> 1
     OR (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_id) IS NOT NULL THEN
    RAISE EXCEPTION 'GAGAL (b): bahan satu tingkat tidak dinormalkan';
  END IF;

  -- (c) tengah tanpa kecil ditolak
  v_ok := false;
  BEGIN
    INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, kategori) VALUES ('UJI T3 C', 'Dus', 'Pack', 10, 'UJI');
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): tengah tanpa kecil diterima'; END IF;

  -- (d) label PO bukan salah satu tingkat ditolak; label sah diterima
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET satuan_po = 'karung' WHERE nama = 'UJI T3 A';
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): satuan_po liar diterima'; END IF;
  UPDATE bahan_baku SET satuan_po = 'roll', satuan_distribusi = 'Roll' WHERE nama = 'UJI T3 A';

  -- (e) faktor_tampilan bahan ber-riwayat ditolak tanpa app.ganti_satuan
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET faktor_tampilan = faktor_tampilan + 1 WHERE id = v_hg;
  EXCEPTION WHEN raise_exception THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): faktor bahan ber-riwayat bisa diubah langsung'; END IF;
  PERFORM set_config('app.ganti_satuan', 'on', true);
  UPDATE bahan_baku SET faktor_tampilan = faktor_tampilan + 1 WHERE id = v_hg;   -- lolos (dibatalkan ROLLBACK)
  PERFORM set_config('app.ganti_satuan', '', true);

  -- (f) keempat bahan sudah konsisten
  IF EXISTS (SELECT 1 FROM bahan_baku
              WHERE nama IN ('KERTAS STRUK','GALON AIR','KETUMBAR')
                AND abs(faktor_konversi * faktor_tengah - faktor_tampilan) > 0.001) THEN
    RAISE EXCEPTION 'GAGAL (f): masih ada bahan melanggar invarian';
  END IF;

  -- (g) kemasan_qty dipaksa sama dengan faktor_tampilan
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty)
  SELECT id, 1000, 1 FROM bahan_baku WHERE nama = 'UJI T3 A';
  IF (SELECT h.kemasan_qty FROM bahan_baku_harga h JOIN bahan_baku b ON b.id = h.bahan_baku_id WHERE b.nama = 'UJI T3 A') <> 36480 THEN
    RAISE EXCEPTION 'GAGAL (g): kemasan_qty tidak disamakan';
  END IF;

  -- (h) _peran_master: admin lolos 'data', crew ditolak 'harga'
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  v_uid := public._peran_master('data');
  IF v_uid IS DISTINCT FROM v_admin THEN RAISE EXCEPTION 'GAGAL (h): admin ditolak'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  v_ok := false;
  BEGIN
    PERFORM public._peran_master('harga');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (h): crew lolos _peran_master'; END IF;
  RAISE NOTICE 'HASIL T3: LULUS';
END $$;
ROLLBACK;
