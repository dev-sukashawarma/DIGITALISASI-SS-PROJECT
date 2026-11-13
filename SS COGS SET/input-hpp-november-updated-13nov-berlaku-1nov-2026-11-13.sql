-- ARSIP — jalankan SEKALI (penjaga nilai lama menolak eksekusi ulang).
-- Sumber: "HPP NOVEMBER UPDATED TGL 13.xlsx", tab OFFLINE kolom C (HPP + OPEX), markup mitra P3 = 0,15.
-- Keputusan owner 2026-11-13: angka ini berlaku mulai 1 Nov 2026 (menggantikan angka 11 Nov).
-- Hanya kunci 'hpp_override'; channel_hpp (SS Online) tidak disentuh.
-- Baris riwayat ditulis di 1 Nov DAN 2 Nov (baris 2 Nov dari input sebelumnya kalau tidak ditimpa akan menang).
DO $$
DECLARE
  c_alasan constant text := 'HPP NOVEMBER UPDATED TGL 13.xlsx tab OFFLINE kolom HPP + OPEX, berlaku 1 Nov 2026 - keputusan owner 13 Nov 2026';
  v_admin uuid; v_n int; v_e record; v_t date;
BEGIN
  SELECT id INTO v_admin FROM public.outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Akun Admin Dev tidak ditemukan'; END IF;
  CREATE TEMP TABLE _r (menu_id uuid, nama text, lama numeric, baru numeric) ON COMMIT DROP;
  INSERT INTO _r VALUES
    ('4adb4426-0d1f-4962-a5d9-2b9dfbb29ecd','Original Sapi Sedang',15099.7,15484.7),
    ('a2c9433d-2525-4096-a28f-6e6f29dcf6df','Original Ayam Sedang',15167.9,15552.9),
    ('fea982b2-e172-4bfd-8fc6-1fa6de830c19','Suka Beef',17747.4,18209.4),
    ('4bb4210d-1f5f-4cd8-a0e4-c9c90b04bbde','Suka Chicken',18885.9,19347.9),
    ('410e8f2d-6bbf-4acd-a88a-8d291d78365d','Suka Fried Chicken',16482.4,16790.4),
    ('3c665d2b-ba92-49e9-8ced-bce946c90a2b','Suka Samyang',17829.9,18137.9),
    ('5dae21e6-eb0d-4076-9771-0aa4d8d046c3','Suka Sosis',13020.7,13405.7),
    ('fe01e7d3-ed72-45e9-9b74-2017522a2b64','Original Sapi Besar',19495.3,19995.8),
    ('a80b91f8-e5dd-4f83-9c94-ebeba6b2da80','Original Ayam Besar',19247.8,19478.8),
    ('df8b5f68-a6fb-4dc8-9bad-f8f02aaff0d7','Original Mix Besar',21843.8,22305.8),
    ('df2d06dc-1326-4139-aa95-5bc66a0a332b','Original Sapi Jumbo',22748,23441),
    ('e85983b6-7e5f-4e78-b3c8-501cf21e39e4','Original Ayam Jumbo',25086.6,25779.6),
    ('82751882-7f37-4b47-9f85-c2b3fca4f939','Original Mix Jumbo',28420.7,29113.7),
    ('8657f72e-d1a2-4829-a5cf-33535f7b293c','Best Seller 2',22748,23441),
    ('c698603b-7f43-415c-986c-b883445e783c','Best Seller (Mix Jumbo)',28420.7,29113.7);
  SELECT count(*) INTO v_n FROM _r r JOIN public.menu_items m ON m.id=r.menu_id AND m.name=r.nama AND m.outlet_id IS NULL;
  IF v_n<>15 THEN RAISE EXCEPTION 'GAGAL penjaga 1: % dari 15', v_n; END IF;
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-01') h)=r.lama
     AND (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-13') h)=r.lama;
  IF v_n<>15 THEN RAISE EXCEPTION 'GAGAL penjaga 2: nilai lama cocok % dari 15 (sudah dijalankan?)', v_n; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  FOREACH v_t IN ARRAY ARRAY[DATE '2026-11-01', DATE '2026-11-02'] LOOP
    FOR v_e IN SELECT * FROM _r LOOP
      PERFORM public.ubah_hpp_menu(v_e.menu_id, jsonb_build_object('hpp_override',v_e.baru), v_t, c_alasan);
    END LOOP;
  END LOOP;
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-01') h)=r.baru
     AND (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-13') h)=r.baru;
  IF v_n<>15 THEN RAISE EXCEPTION 'ASERSI A GAGAL: % dari 15', v_n; END IF;
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-10-31') h) IS DISTINCT FROM r.baru;
  IF v_n<>15 THEN RAISE EXCEPTION 'ASERSI C GAGAL: 31 Okt ikut bergeser'; END IF;
  SELECT count(*) INTO v_n FROM public.menu_items m JOIN _r r ON r.menu_id=m.id WHERE m.hpp_override=r.baru;
  IF v_n<>15 THEN RAISE EXCEPTION 'ASERSI E GAGAL: menu_items % dari 15', v_n; END IF;
  RAISE NOTICE 'OK: 15 menu x 2 tanggal tertulis.';
END $$;
