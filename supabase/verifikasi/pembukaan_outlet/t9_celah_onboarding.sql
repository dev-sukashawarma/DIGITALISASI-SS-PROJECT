-- t9 — celah onboarding hasil bug hunt 2026-11-25 (migration 20261125173000).
-- (a) outlet yang pembukaannya dibatalkan tidak bisa diaktifkan lewat Buka kembali
-- (b) order untuk outlet Persiapan ditolak database
-- (c) batalkan outlet mitra: akun mitra tidak menahan penghapusan, profil mitra dibersihkan
-- (d) mitra → internal: akun mitra yang outlet utamanya ini dipindah ke outlet mitra lainnya
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't9 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_o      uuid;
  v_aktif  uuid;
  v_crew   uuid;
  v_mitra  uuid;
  v_lain   uuid;
  v_err    text;
  r        jsonb;
BEGIN
  -- (a) batal → nonaktif (ada crew) → Buka kembali harus ditolak
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T9A'));
  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  UPDATE public.outlet_staff SET outlet_id = v_o WHERE id = v_crew;
  r := public.batalkan_pembukaan_outlet(v_o, 'uji t9 batal');
  IF r->>'aksi' <> 'dinonaktifkan' THEN RAISE EXCEPTION 'ASERSI GAGAL a: aksi %', r->>'aksi'; END IF;
  BEGIN
    PERFORM public.buka_kembali_outlet(v_o, 'uji buka kembali tanpa go-live');
    RAISE EXCEPTION 'ASERSI GAGAL a: outlet batal bisa dibuka kembali';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE '%dibatalkan%' THEN RAISE EXCEPTION 'ASERSI GAGAL a: pesan %', v_err; END IF;
  END;
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'inactive' THEN RAISE EXCEPTION 'ASERSI GAGAL a: status berubah'; END IF;
  IF NOT public.pembukaan_outlet_dibatalkan(v_o) THEN RAISE EXCEPTION 'ASERSI GAGAL a: penanda batal salah'; END IF;

  -- (b) order untuk outlet Persiapan ditolak; outlet aktif tidak kena penolakan ini
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T9B'));
  BEGIN
    INSERT INTO public.orders (outlet_id) VALUES (v_o);
    RAISE EXCEPTION 'ASERSI GAGAL b: order outlet Persiapan diterima';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE '%belum dibuka%' THEN RAISE EXCEPTION 'ASERSI GAGAL b: pesan %', v_err; END IF;
  END;
  SELECT id INTO v_aktif FROM public.outlets WHERE status = 'active' AND type = 'internal' LIMIT 1;
  BEGIN
    INSERT INTO public.orders (outlet_id) VALUES (v_aktif);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%belum dibuka%' THEN RAISE EXCEPTION 'ASERSI GAGAL b: outlet aktif ikut ditolak'; END IF;
  END;

  -- (c) batalkan outlet mitra yang akun mitranya ber-outlet utama di sini → tetap terhapus
  SELECT s.id INTO v_mitra FROM public.outlet_staff s
  JOIN public.mitra_profiles mp ON mp.user_id = s.id
  WHERE s.role = 'mitra' AND s.status = 'active' AND cardinality(mp.outlet_ids) >= 1
  LIMIT 1;
  SELECT mp.outlet_ids[1] INTO v_lain FROM public.mitra_profiles mp WHERE mp.user_id = v_mitra;
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','mitra','nama','UJI WIZARD T9C',
    'mitra',jsonb_build_object('nilai_investasi',1,'mitra_user_id',v_mitra,'nama_mitra','Mitra Uji')));
  UPDATE public.outlet_staff SET outlet_id = v_o WHERE id = v_mitra;
  r := public.batalkan_pembukaan_outlet(v_o, 'uji t9 batal mitra');
  IF r->>'aksi' <> 'dihapus' THEN RAISE EXCEPTION 'ASERSI GAGAL c: akun mitra menahan penghapusan (%)', r; END IF;
  IF EXISTS (SELECT 1 FROM public.mitra_profiles WHERE v_o = ANY (outlet_ids)) THEN RAISE EXCEPTION 'ASERSI GAGAL c: profil mitra masih memuat outlet'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = v_mitra AND outlet_id = v_lain AND status = 'active') THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: akun mitra tidak dipindah ke outlet mitranya yang lain';
  END IF;

  -- (d) mitra → internal: outlet dikeluarkan dari profil, akun dipindah
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','mitra','nama','UJI WIZARD T9D',
    'mitra',jsonb_build_object('nilai_investasi',1,'mitra_user_id',v_mitra,'nama_mitra','Mitra Uji')));
  UPDATE public.outlet_staff SET outlet_id = v_o WHERE id = v_mitra;
  UPDATE public.outlets SET type = 'internal' WHERE id = v_o;
  IF EXISTS (SELECT 1 FROM public.mitra_profiles WHERE v_o = ANY (outlet_ids)) THEN RAISE EXCEPTION 'ASERSI GAGAL d: profil mitra masih memuat outlet internal'; END IF;
  IF EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = v_mitra AND outlet_id = v_o) THEN RAISE EXCEPTION 'ASERSI GAGAL d: akun mitra masih berpusat di outlet internal'; END IF;
END $$;
SELECT 't9 lulus' AS hasil;
ROLLBACK;
