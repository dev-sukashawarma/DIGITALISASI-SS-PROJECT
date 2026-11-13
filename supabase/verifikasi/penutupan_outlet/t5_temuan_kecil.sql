-- t5 — temuan kecil review akhir (migration 20261113210000)
-- M1: auto-verifikasi SJ tidak boleh mengkredit stok ke outlet yang sudah tutup.
-- M3: buka kembali memulihkan masa RAB yang dipendekkan saat tutup.
-- (M4 status kosong: tidak mungkin — outlets.status NOT NULL di DB, tak perlu diuji.)
-- M7: app_enabled outlet tutup tidak bisa dinyalakan lagi di luar RPC.
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't5: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_tutup   uuid;
  v_aktif   uuid;
  v_m       uuid;
  v_sj_t    uuid;
  v_sj_a    uuid;
  v_hari    date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  r         record;
BEGIN
  -- M1 -----------------------------------------------------------------
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI T5 TUTUP', 'uji-t5-tutup', 'internal', 'active', true, 'Jl') RETURNING id INTO v_tutup;
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI T5 AKTIF', 'uji-t5-aktif', 'internal', 'active', true, 'Jl') RETURNING id INTO v_aktif;
  PERFORM public.tutup_outlet(v_tutup, v_hari, 'uji t5 outlet tutup');

  INSERT INTO public.surat_jalan (outlet_id, status) VALUES (v_tutup, 'dikirim') RETURNING id INTO v_sj_t;
  INSERT INTO public.surat_jalan (outlet_id, status) VALUES (v_aktif, 'dikirim') RETURNING id INTO v_sj_a;
  UPDATE public.surat_jalan SET updated_at = now() - interval '2 days' WHERE id IN (v_sj_t, v_sj_a);

  SELECT * INTO r FROM public.auto_verifikasi_surat_jalan(true);
  -- kontrol: SJ outlet aktif memang terpilih (membuktikan penyiapan uji benar)
  IF position(v_sj_a::text in coalesce(r.daftar, '')) = 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL M1-kontrol: SJ outlet aktif tidak terpilih (daftar %)', r.daftar;
  END IF;
  IF position(v_sj_t::text in coalesce(r.daftar, '')) > 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL M1: SJ ke outlet tutup ikut di-auto-verifikasi';
  END IF;

  -- M3 -----------------------------------------------------------------
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI T5 MITRA', 'uji-t5-mitra', 'mitra', 'active', true, 'Jl') RETURNING id INTO v_m;
  INSERT INTO public.rab_outlet_otomatis (outlet_id, berlaku_mulai, berlaku_sampai, kategori_kecuali, catatan)
  VALUES (v_m, v_hari, v_hari + 30, '{}', 'uji t5');
  PERFORM public.tutup_outlet(v_m, v_hari, 'uji t5 mitra tutup');
  IF (SELECT berlaku_sampai FROM public.rab_outlet_otomatis WHERE outlet_id = v_m) <> v_hari THEN
    RAISE EXCEPTION 'ASERSI GAGAL M3a: RAB tidak dipendekkan saat tutup';
  END IF;
  PERFORM public.buka_kembali_outlet(v_m, 'uji t5 salah tutup mitra');
  IF (SELECT berlaku_sampai FROM public.rab_outlet_otomatis WHERE outlet_id = v_m) <> v_hari + 30 THEN
    RAISE EXCEPTION 'ASERSI GAGAL M3: RAB tidak dipulihkan saat buka kembali (%)',
      (SELECT berlaku_sampai FROM public.rab_outlet_otomatis WHERE outlet_id = v_m);
  END IF;

  -- M7 -----------------------------------------------------------------
  UPDATE public.outlets SET app_enabled = true WHERE id = v_tutup;
  IF (SELECT app_enabled FROM public.outlets WHERE id = v_tutup) THEN
    RAISE EXCEPTION 'ASERSI GAGAL M7: outlet tutup bisa dinyalakan lagi di aplikasi pelanggan';
  END IF;
  -- kontrol: outlet aktif tetap bebas menyalakan aplikasi
  UPDATE public.outlets SET app_enabled = true WHERE id = v_aktif;
  IF NOT (SELECT app_enabled FROM public.outlets WHERE id = v_aktif) THEN
    RAISE EXCEPTION 'ASERSI GAGAL M7-kontrol: outlet aktif tidak bisa menyalakan aplikasi';
  END IF;
END $$;
SELECT 't5: LULUS' AS hasil;
ROLLBACK;
