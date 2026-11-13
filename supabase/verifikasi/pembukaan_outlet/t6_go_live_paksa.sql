-- t6 — Go-Live paksa (migration 20261113160000).
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't6 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_am    uuid;
  v_o     uuid;
  v_err   text;
  r       jsonb;
  v_hari  date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  lg      public.outlet_pembukaan_log%ROWTYPE;
BEGIN
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  v_o := public.buat_outlet_persiapan(jsonb_build_object(
    'jenis','internal','nama','UJI WIZARD T6','am_staff_id',v_am));

  -- (a) tanpa alasan: tetap ditolak seperti dulu (pemanggil 3 argumen)
  BEGIN
    PERFORM public.go_live_outlet(v_o, 'UJI WIZARD T6', v_hari);
    RAISE EXCEPTION 'ASERSI GAGAL a: lolos tanpa alasan';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE 'Langkah wajib belum selesai%' THEN RAISE EXCEPTION 'ASERSI GAGAL a: pesan %', v_err; END IF;
  END;

  -- (b) alasan terlalu pendek: ditolak
  BEGIN
    PERFORM public.go_live_outlet(v_o, 'UJI WIZARD T6', v_hari, '  pendek  ');
    RAISE EXCEPTION 'ASERSI GAGAL b: lolos dengan alasan pendek';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF v_err NOT LIKE '%minimal 10 karakter%' THEN RAISE EXCEPTION 'ASERSI GAGAL b: pesan %', v_err; END IF;
  END;
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'pending' THEN RAISE EXCEPTION 'ASERSI GAGAL b: status berubah'; END IF;

  -- (c) alasan cukup: aktif, dan riwayat mencatat paksa + langkah yang dilewati
  r := public.go_live_outlet(v_o, 'UJI WIZARD T6', v_hari, 'Grand opening besok, stok menyusul');
  IF NOT (SELECT is_active AND is_bom_enabled AND status = 'active' FROM public.outlets WHERE id = v_o) THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: outlet belum aktif';
  END IF;
  IF NOT (r->>'paksa')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL c: hasil tidak bertanda paksa'; END IF;
  SELECT * INTO lg FROM public.outlet_pembukaan_log WHERE outlet_id = v_o AND aksi = 'go_live';
  IF lg.alasan IS DISTINCT FROM 'Grand opening besok, stok menyusul' THEN RAISE EXCEPTION 'ASERSI GAGAL c: alasan %', lg.alasan; END IF;
  IF NOT (lg.detail->>'paksa')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL c: log tanpa paksa'; END IF;
  IF NOT (lg.detail->'langkah_dilewati') ? 'crew' OR (lg.detail->'langkah_dilewati') ? 'stok_awal' THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: langkah_dilewati %', lg.detail->'langkah_dilewati';
  END IF;

  -- (d) satu overload saja
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'go_live_outlet' AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL d: ada lebih dari satu go_live_outlet';
  END IF;
END $$;

SELECT 't6 lulus' AS hasil;
ROLLBACK;
