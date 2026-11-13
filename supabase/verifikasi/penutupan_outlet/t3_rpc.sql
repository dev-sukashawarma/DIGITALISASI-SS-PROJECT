-- t3 — RPC penutupan outlet (migration 20261113202000)
-- Seluruhnya di dalam BEGIN … ROLLBACK. Bertindak sebagai Admin Dev lewat klaim JWT.
-- Sebelum migration: gagal (fungsi tidak ada). Sesudah: baris 't3: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_o      uuid;
  v_p      uuid;
  v_b1     uuid;
  v_b2     uuid;
  v_fin    uuid;
  v_hari   date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  r        record;
  j        jsonb;
  n        int;
  ok       boolean;
BEGIN
  INSERT INTO public.outlets (name, slug, type, status, is_active, address, app_enabled)
  VALUES ('UJI TUTUP T3', 'uji-tutup-t3', 'internal', 'active', true, 'Jl. Uji', true) RETURNING id INTO v_o;
  INSERT INTO public.outlet_promos (outlet_id, scope, discount_type, discount_value, is_active, is_assigned)
  VALUES (v_o, 'global', 'percentage', 10, true, true);

  -- (b) tanggal di luar batas
  BEGIN
    PERFORM public.tutup_outlet(v_o, v_hari + 1, 'uji t3 tanggal besok');
    RAISE EXCEPTION 'ASERSI GAGAL b: tanggal besok diterima';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.tutup_outlet(v_o, v_hari - 1, 'uji t3 sebelum dibuat');
    RAISE EXCEPTION 'ASERSI GAGAL b2: tanggal sebelum outlet dibuat diterima';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.tutup_outlet(v_o, v_hari, 'pendek');
    RAISE EXCEPTION 'ASERSI GAGAL b3: alasan pendek diterima';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
  END;

  -- (a) tutup
  PERFORM public.tutup_outlet(v_o, v_hari, 'uji t3 penutupan resmi');
  SELECT status, is_active, app_enabled, nonaktif_at, alasan_tutup, ditutup_by INTO r FROM public.outlets WHERE id = v_o;
  IF r.status <> 'inactive' OR r.is_active OR r.app_enabled
     OR r.nonaktif_at <> ((v_hari + time '23:59:59') AT TIME ZONE 'Asia/Jakarta')
     OR r.alasan_tutup <> 'uji t3 penutupan resmi'
     OR r.ditutup_by <> '6440a568-d9f3-45d3-b7d7-16e4b3166ab2' THEN
    RAISE EXCEPTION 'ASERSI GAGAL a: hasil tutup salah (%, %, %, %, %)', r.status, r.is_active, r.app_enabled, r.nonaktif_at, r.alasan_tutup;
  END IF;
  IF EXISTS (SELECT 1 FROM public.outlet_promos WHERE outlet_id = v_o AND is_active) THEN
    RAISE EXCEPTION 'ASERSI GAGAL a2: promo outlet masih aktif';
  END IF;
  SELECT count(*) INTO n FROM public.outlet_pembukaan_log WHERE outlet_id = v_o AND aksi = 'ditutup';
  IF n <> 1 THEN RAISE EXCEPTION 'ASERSI GAGAL a3: log ditutup % baris', n; END IF;

  -- (c) tutup dua kali
  BEGIN
    PERFORM public.tutup_outlet(v_o, v_hari, 'uji t3 tutup lagi');
    RAISE EXCEPTION 'ASERSI GAGAL c: tutup kedua diterima';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
    IF SQLERRM NOT ILIKE '%sudah ditutup%' THEN RAISE EXCEPTION 'ASERSI GAGAL c2: pesan "%"', SQLERRM; END IF;
  END;
  SELECT count(*) INTO n FROM public.outlet_pembukaan_log WHERE outlet_id = v_o AND aksi = 'ditutup';
  IF n <> 1 THEN RAISE EXCEPTION 'ASERSI GAGAL c3: log ditutup jadi %', n; END IF;

  -- (d) outlet Persiapan
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T3 P', 'uji-tutup-t3-p', 'internal', 'pending', false, 'Jl. Uji') RETURNING id INTO v_p;
  BEGIN
    PERFORM public.tutup_outlet(v_p, v_hari, 'uji t3 persiapan');
    RAISE EXCEPTION 'ASERSI GAGAL d: outlet Persiapan bisa ditutup';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
    IF SQLERRM NOT ILIKE '%Batalkan pembukaan%' THEN RAISE EXCEPTION 'ASERSI GAGAL d2: pesan "%"', SQLERRM; END IF;
  END;

  -- (e) nolkan stok: satu baris +5, satu baris -3
  PERFORM set_config('app.ganti_satuan', 'on', true);
  SELECT id INTO v_b1 FROM public.bahan_baku WHERE is_active ORDER BY id LIMIT 1;
  SELECT id INTO v_b2 FROM public.bahan_baku WHERE is_active ORDER BY id OFFSET 1 LIMIT 1;
  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (v_o, v_b1, 'adjustment', 5, 'uji t3'),
    (v_o, v_b2, 'pemakaian', -3, 'uji t3');  -- pemakaian boleh membuat saldo minus (kasus nyata Ciseeng)
  PERFORM set_config('app.ganti_satuan', '', true);
  j := public.nolkan_sisa_stok_outlet(v_o, 'uji t3 barang sudah habis');
  IF (j->>'jumlah_bahan')::int <> 2 THEN RAISE EXCEPTION 'ASERSI GAGAL e: jumlah_bahan %', j; END IF;
  IF (SELECT coalesce(sum(abs(saldo)),0) FROM public.stok_balance WHERE outlet_id = v_o) <> 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL e2: saldo belum nol';
  END IF;
  SELECT count(*) INTO n FROM public.ledger_stok WHERE outlet_id = v_o AND catatan LIKE 'Penutupan outlet: %';
  IF n <> 2 THEN RAISE EXCEPTION 'ASERSI GAGAL e3: ledger penutupan % baris', n; END IF;
  BEGIN
    PERFORM public.nolkan_sisa_stok_outlet(v_o, 'uji t3 jalan ulang');
    RAISE EXCEPTION 'ASERSI GAGAL e4: nolkan kedua diterima';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
  END;

  -- (f) tandai selesai: belum siap → ditolak; sesudah centang → berhasil
  BEGIN
    PERFORM public.tandai_penutupan_selesai(v_o);
    RAISE EXCEPTION 'ASERSI GAGAL f: selesai padahal belum siap';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASERSI%' THEN RAISE; END IF;
  END;
  PERFORM public.centang_langkah_penutupan(v_o, 'kanal_online', 'uji');
  PERFORM public.centang_langkah_penutupan(v_o, 'merchant_ojol', 'uji');
  PERFORM public.tandai_penutupan_selesai(v_o);
  IF (SELECT penutupan_selesai_at FROM public.outlets WHERE id = v_o) IS NULL THEN
    RAISE EXCEPTION 'ASERSI GAGAL f2: penutupan_selesai_at kosong';
  END IF;

  -- koreksi tanggal
  PERFORM public.koreksi_tanggal_tutup(v_o, v_hari, 'uji t3 koreksi tanggal');
  IF NOT EXISTS (SELECT 1 FROM public.outlet_pembukaan_log WHERE outlet_id = v_o AND aksi = 'tanggal_tutup_dikoreksi') THEN
    RAISE EXCEPTION 'ASERSI GAGAL k: log koreksi tidak ada';
  END IF;

  -- (g) buka kembali → aktif, kolom kosong, centang hilang, log tetap; tutup lagi berhasil
  PERFORM public.buka_kembali_outlet(v_o, 'uji t3 salah tutup');
  SELECT status, is_active, nonaktif_at, alasan_tutup, penutupan_selesai_at, app_enabled INTO r FROM public.outlets WHERE id = v_o;
  IF r.status <> 'active' OR NOT r.is_active OR r.nonaktif_at IS NOT NULL OR r.alasan_tutup IS NOT NULL
     OR r.penutupan_selesai_at IS NOT NULL OR r.app_enabled THEN
    RAISE EXCEPTION 'ASERSI GAGAL g: hasil buka kembali salah (%, %, %, %, %, %)', r.status, r.is_active, r.nonaktif_at, r.alasan_tutup, r.penutupan_selesai_at, r.app_enabled;
  END IF;
  IF EXISTS (SELECT 1 FROM public.outlet_penutupan_centang WHERE outlet_id = v_o) THEN
    RAISE EXCEPTION 'ASERSI GAGAL g2: centang tidak terhapus';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlet_pembukaan_log WHERE outlet_id = v_o AND aksi = 'ditutup') THEN
    RAISE EXCEPTION 'ASERSI GAGAL g3: log lama hilang';
  END IF;
  PERFORM public.tutup_outlet(v_o, v_hari, 'uji t3 tutup kedua kalinya');
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'inactive' THEN
    RAISE EXCEPTION 'ASERSI GAGAL g4: tutup ulang gagal';
  END IF;

  -- (h) admin_finance: centang boleh, tutup ditolak
  SELECT id INTO v_fin FROM public.outlet_staff WHERE role = 'admin_finance' AND status = 'active' LIMIT 1;
  IF v_fin IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
    PERFORM public.centang_langkah_penutupan(v_o, 'biaya_rutin', 'uji finance');
    BEGIN
      PERFORM public.buka_kembali_outlet(v_o, 'uji t3 finance mencoba');
      RAISE EXCEPTION 'ASERSI GAGAL h: admin_finance bisa buka kembali';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  ELSE
    RAISE EXCEPTION 'ASERSI GAGAL h0: tidak ada admin_finance aktif untuk diuji';
  END IF;
END $$;
SELECT 't3: LULUS' AS hasil;
ROLLBACK;
