-- t4 — penjaga status Persiapan & jenis outlet di DB (migration 20261113130000)
-- Temuan review C1: penulis lain is_active (absensi pengaturan, form cadangan POS
-- Admin) membuat outlet Persiapan aktif tanpa Go-Live. Temuan I2: mengganti jenis
-- Mitra → Internal meninggalkan data investasi/RAB/akun mitra.
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't4 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_am uuid;
  v_o  uuid;
  v_i  uuid;
  v_ok boolean;
BEGIN
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  v_o := public.buat_outlet_persiapan(jsonb_build_object('jenis','mitra','nama','UJI WIZARD T4',
    'am_staff_id',v_am,'mitra',jsonb_build_object('nilai_investasi',1)));

  -- C1a: penulis lama hanya menyetel is_active = true (seperti absensi saveOutletException)
  UPDATE public.outlets SET is_active = true WHERE id = v_o;
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'pending'
     OR (SELECT is_active FROM public.outlets WHERE id = v_o) THEN
    RAISE EXCEPTION 'ASERSI GAGAL C1a: is_active=true mengaktifkan outlet Persiapan tanpa Go-Live';
  END IF;

  -- C1b: penulis menyetel status = 'active' langsung (form cadangan POS Admin)
  UPDATE public.outlets SET status = 'active', is_active = true WHERE id = v_o;
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'pending' THEN
    RAISE EXCEPTION 'ASERSI GAGAL C1b: status=active lolos tanpa Go-Live';
  END IF;

  -- C1c: menonaktifkan outlet Persiapan tanpa Batalkan pembukaan juga ditahan
  UPDATE public.outlets SET status = 'inactive' WHERE id = v_o;
  IF (SELECT status FROM public.outlets WHERE id = v_o) <> 'pending' THEN
    RAISE EXCEPTION 'ASERSI GAGAL C1c: status=inactive lolos tanpa Batalkan';
  END IF;

  -- C1d: kolom lain tetap bisa diubah
  UPDATE public.outlets SET address = 'Jl. Uji 4' WHERE id = v_o;
  IF (SELECT address FROM public.outlets WHERE id = v_o) <> 'Jl. Uji 4' THEN
    RAISE EXCEPTION 'ASERSI GAGAL C1d: perubahan alamat ikut tertahan';
  END IF;

  -- I2: mitra → internal ditolak selama ada data mitra
  v_ok := false;
  BEGIN
    UPDATE public.outlets SET type = 'internal' WHERE id = v_o;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'ASERSI GAGAL I2: jenis mitra → internal lolos padahal ada investasi'; END IF;

  -- I2b: outlet internal Persiapan tanpa data mitra boleh diganti jenis
  v_i := public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T4B','am_staff_id',v_am));
  UPDATE public.outlets SET type = 'mitra' WHERE id = v_i;
  IF (SELECT type FROM public.outlets WHERE id = v_i) <> 'mitra' THEN RAISE EXCEPTION 'ASERSI GAGAL I2b'; END IF;
END $$;
SELECT 't4 lulus' AS hasil;
ROLLBACK;
