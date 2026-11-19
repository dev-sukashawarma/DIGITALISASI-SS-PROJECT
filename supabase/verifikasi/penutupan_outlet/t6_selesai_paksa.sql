-- t6 — Tandai Penutupan Selesai paksa (migration 20261119091000).
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't6: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_o    uuid;
  v_err  text;
  v_hari date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  lg     public.outlet_pembukaan_log%ROWTYPE;
BEGIN
  INSERT INTO public.outlets (name, slug, type, status, is_active, address, app_enabled)
  VALUES ('UJI TUTUP T6', 'uji-tutup-t6', 'internal', 'active', true, 'Jl. Uji', true) RETURNING id INTO v_o;

  PERFORM public.tutup_outlet(v_o, v_hari, 'uji t6 penutupan resmi');

  -- (a) tanpa alasan: tetap ditolak seperti dulu (pemanggil 1 argumen)
  BEGIN
    PERFORM public.tandai_penutupan_selesai(v_o);
    RAISE EXCEPTION 'ASERSI GAGAL a: lolos tanpa alasan';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE 'Penutupan belum bisa ditandai selesai%' THEN
      RAISE EXCEPTION 'ASERSI GAGAL a: pesan %', v_err;
    END IF;
  END;

  -- (b) alasan terlalu pendek: ditolak
  BEGIN
    PERFORM public.tandai_penutupan_selesai(v_o, '  pendek  ');
    RAISE EXCEPTION 'ASERSI GAGAL b: lolos dengan alasan pendek';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE '%minimal 10 karakter%' THEN
      RAISE EXCEPTION 'ASERSI GAGAL b: pesan %', v_err;
    END IF;
  END;
  IF (SELECT penutupan_selesai_at FROM public.outlets WHERE id = v_o) IS NOT NULL THEN
    RAISE EXCEPTION 'ASERSI GAGAL b: penutupan_selesai_at terisi';
  END IF;

  -- (c) alasan cukup: selesai, dan riwayat mencatat paksa + langkah yang dilewati
  PERFORM public.tandai_penutupan_selesai(v_o, 'Mutasi stok lama sudah tidak relevan');
  IF (SELECT penutupan_selesai_at FROM public.outlets WHERE id = v_o) IS NULL THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: penutupan_selesai_at masih kosong';
  END IF;
  SELECT * INTO lg FROM public.outlet_pembukaan_log WHERE outlet_id = v_o AND aksi = 'penutupan_selesai';
  IF lg.alasan IS DISTINCT FROM 'Mutasi stok lama sudah tidak relevan' THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: alasan %', lg.alasan;
  END IF;
  IF NOT (lg.detail->>'paksa')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: log tanpa paksa';
  END IF;
  IF NOT (lg.detail->'langkah_dilewati') ? 'kanal_online'
     OR NOT (lg.detail->'langkah_dilewati') ? 'merchant_ojol' THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: langkah_dilewati %', lg.detail->'langkah_dilewati';
  END IF;

  -- (d) satu overload saja
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'tandai_penutupan_selesai' AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL d: ada lebih dari satu tandai_penutupan_selesai';
  END IF;
END $$;

SELECT 't6: LULUS' AS hasil;
ROLLBACK;
