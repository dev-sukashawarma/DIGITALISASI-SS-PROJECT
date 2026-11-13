-- t1 — fondasi penutupan outlet (migration 20261113200000)
-- Seluruhnya di dalam BEGIN … ROLLBACK. Bertindak sebagai Admin Dev lewat klaim JWT.
-- Sebelum migration: gagal (kolom/fungsi tidak ada). Sesudah: NOTICE 't1: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_a      uuid;
  v_b      uuid;
  v_office uuid;
  v_crew   uuid;
  r        record;
  n        int;
BEGIN
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T1 A', 'uji-tutup-t1-a', 'internal', 'active', true, 'Jl. Uji')
  RETURNING id INTO v_a;
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T1 B', 'uji-tutup-t1-b', 'mitra', 'active', true, 'Jl. Uji')
  RETURNING id INTO v_b;
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T1 OFFICE', 'uji-tutup-t1-office', 'office', 'active', true, 'Jl. Uji')
  RETURNING id INTO v_office;

  -- (a) nonaktif tanpa GUC → ditahan diam-diam
  UPDATE public.outlets SET status = 'inactive', is_active = false WHERE id = v_a;
  SELECT status, is_active, nonaktif_at INTO r FROM public.outlets WHERE id = v_a;
  IF r.status <> 'active' OR NOT r.is_active OR r.nonaktif_at IS NOT NULL THEN
    RAISE EXCEPTION 'ASERSI GAGAL a: outlet internal bisa dinonaktifkan tanpa wizard (%, %, %)', r.status, r.is_active, r.nonaktif_at;
  END IF;

  -- (b) dengan GUC + nonaktif_at diberikan → nilai dipertahankan, bukan now()
  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets SET status = 'inactive', is_active = false,
         nonaktif_at = timestamptz '2026-11-01 23:59:59+07', alasan_tutup = 'uji t1 tutup resmi'
   WHERE id = v_a;
  PERFORM set_config('app.penutupan_outlet', '', true);
  SELECT status, nonaktif_at INTO r FROM public.outlets WHERE id = v_a;
  IF r.status <> 'inactive' OR r.nonaktif_at <> timestamptz '2026-11-01 23:59:59+07' THEN
    RAISE EXCEPTION 'ASERSI GAGAL b: tutup resmi tidak tersimpan benar (%, %)', r.status, r.nonaktif_at;
  END IF;

  -- (c) aktifkan lagi tanpa GUC → ditahan; kolom penutupan utuh
  UPDATE public.outlets SET is_active = true WHERE id = v_a;
  SELECT status, is_active, nonaktif_at, alasan_tutup INTO r FROM public.outlets WHERE id = v_a;
  IF r.status <> 'inactive' OR r.is_active OR r.nonaktif_at IS DISTINCT FROM timestamptz '2026-11-01 23:59:59+07'
     OR r.alasan_tutup IS DISTINCT FROM 'uji t1 tutup resmi' THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: outlet tutup hidup lagi / kolom hilang (%, %, %, %)', r.status, r.is_active, r.nonaktif_at, r.alasan_tutup;
  END IF;

  -- (d) meniru saveGlobalConfig absensi: tulis is_active=true ke semua internal/mitra
  UPDATE public.outlets SET is_active = true WHERE type IN ('internal','mitra');
  SELECT count(*) INTO n FROM public.outlets
   WHERE id IN ('550e8400-e29b-41d4-a716-446655440008','550e8400-e29b-41d4-a716-446655440005',
                '550e8400-e29b-41d4-a716-446655440017','550e8400-e29b-41d4-a716-446655440012')
     AND status = 'inactive' AND NOT is_active AND nonaktif_at IS NOT NULL;
  IF n <> 4 THEN RAISE EXCEPTION 'ASERSI GAGAL d: penulis massal menghidupkan outlet tutup (tinggal % dari 4)', n; END IF;

  -- (e) outlet office tidak dijaga
  UPDATE public.outlets SET status = 'inactive', is_active = false WHERE id = v_office;
  IF (SELECT status FROM public.outlets WHERE id = v_office) <> 'inactive' THEN
    RAISE EXCEPTION 'ASERSI GAGAL e: outlet office ikut dijaga';
  END IF;

  -- (f) backfill 4 outlet
  SELECT count(*) INTO n FROM public.outlets
   WHERE id IN ('550e8400-e29b-41d4-a716-446655440008','550e8400-e29b-41d4-a716-446655440005',
                '550e8400-e29b-41d4-a716-446655440017','550e8400-e29b-41d4-a716-446655440012')
     AND alasan_tutup = '(ditutup sebelum wizard)';
  IF n <> 4 THEN RAISE EXCEPTION 'ASERSI GAGAL f: backfill alasan_tutup hanya % dari 4', n; END IF;
  SELECT count(*) INTO n FROM public.outlet_pembukaan_log
   WHERE aksi = 'ditutup' AND outlet_id IN ('550e8400-e29b-41d4-a716-446655440008','550e8400-e29b-41d4-a716-446655440005',
                '550e8400-e29b-41d4-a716-446655440017','550e8400-e29b-41d4-a716-446655440012');
  IF n <> 4 THEN RAISE EXCEPTION 'ASERSI GAGAL f2: log backfill % baris (harus 4)', n; END IF;

  -- tabel centang ada & aksi log baru diterima
  INSERT INTO public.outlet_penutupan_centang (outlet_id, kunci, oleh_nama) VALUES (v_a, 'aset', 'uji');
  INSERT INTO public.outlet_pembukaan_log (outlet_id, nama_outlet, aksi) VALUES (v_a, 'UJI', 'stok_dinolkan');

  -- (g) peran: crew ditolak
  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.penutupan_outlet_cek_peran('tulis');
    RAISE EXCEPTION 'ASERSI GAGAL g: crew lolos penjaga tulis';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.penutupan_outlet_cek_peran('baca');
    RAISE EXCEPTION 'ASERSI GAGAL g2: crew lolos penjaga baca';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  RAISE NOTICE 't1: LULUS';
END $$;

ROLLBACK;
