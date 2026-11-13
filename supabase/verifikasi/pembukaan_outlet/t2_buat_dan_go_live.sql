-- t2 — buat_outlet_persiapan, tautkan mitra, go_live_outlet (migration 20261113120000)
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't2 lulus'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

DO $$
DECLARE
  v_am     uuid;
  v_crew   uuid;
  v_mitra  uuid;
  v_o1     uuid;
  v_o2     uuid;
  v_int    uuid;
  v_err    text;
  v_n      int;
  v_bahan  int;
  v_ob1    int; v_ob2 int; v_ob3 int;
  r        jsonb;
  v_besok  date := (now() AT TIME ZONE 'Asia/Jakarta')::date + 1;
  v_hari   date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  SELECT s.id INTO v_mitra FROM public.outlet_staff s
  WHERE s.role = 'mitra' AND s.status = 'active'
    AND EXISTS (SELECT 1 FROM public.mitra_profiles mp WHERE mp.user_id = s.id) LIMIT 1;

  -- (a) outlet mitra lengkap
  v_o1 := public.buat_outlet_persiapan(jsonb_build_object(
    'jenis','mitra','nama','UJI WIZARD T2A','alamat','Jl. Uji 2','lat',-6.6,'lng',106.8,
    'am_staff_id',v_am,'tanggal_grand_opening',v_besok,
    'mitra',jsonb_build_object('nilai_investasi',150000000,'mitra_user_id',v_mitra,'nama_mitra','Mitra Uji'),
    'rab',jsonb_build_object('berlaku_sampai',v_hari + 30,
      'kategori_kecuali',jsonb_build_array('gas','pln','pdam','internet','wifi','utilitas','utilities','sewa','sewa_outlet'))));
  IF (SELECT status FROM public.outlets WHERE id = v_o1) <> 'pending' THEN RAISE EXCEPTION 'ASERSI GAGAL a: bukan pending'; END IF;
  IF (SELECT is_active FROM public.outlets WHERE id = v_o1) THEN RAISE EXCEPTION 'ASERSI GAGAL a: is_active true'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.am_outlet_assignments WHERE outlet_id = v_o1 AND staff_id = v_am AND effective_to IS NULL) THEN RAISE EXCEPTION 'ASERSI GAGAL a: penugasan AM'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff_outlets WHERE outlet_id = v_o1 AND staff_id = v_am) THEN RAISE EXCEPTION 'ASERSI GAGAL a: staff_outlets AM'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mitra_investments WHERE outlet_id = v_o1 AND persentase_bagi_hasil = 100 AND management_fee = 3 AND is_profit_sharing_active) THEN RAISE EXCEPTION 'ASERSI GAGAL a: investasi bawaan'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rab_outlet_otomatis WHERE outlet_id = v_o1 AND 'sewa_outlet' = ANY (kategori_kecuali)) THEN RAISE EXCEPTION 'ASERSI GAGAL a: RAB'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mitra_profiles WHERE user_id = v_mitra AND v_o1 = ANY (outlet_ids)) THEN RAISE EXCEPTION 'ASERSI GAGAL a: profil mitra'; END IF;

  -- (a2) outlet kedua mitra yang sama; tautkan ulang tidak menggandakan
  v_o2 := public.buat_outlet_persiapan(jsonb_build_object(
    'jenis','mitra','nama','UJI WIZARD T2B','am_staff_id',v_am,
    'mitra',jsonb_build_object('nilai_investasi',1,'mitra_user_id',v_mitra,'nama_mitra','Mitra Uji')));
  PERFORM public.tautkan_akun_mitra_outlet(v_o2, v_mitra, 'Mitra Uji');
  SELECT count(*) INTO v_n FROM public.mitra_profiles mp, unnest(mp.outlet_ids) x WHERE mp.user_id = v_mitra AND x IN (v_o1, v_o2);
  IF v_n <> 2 THEN RAISE EXCEPTION 'ASERSI GAGAL a2: outlet_ids berisi % (harus 2)', v_n; END IF;

  -- (b) Go-Live sebelum stok awal → ditolak, pesan menyebut stok awal
  BEGIN
    PERFORM public.go_live_outlet(v_o1, 'UJI WIZARD T2A', v_hari);
    RAISE EXCEPTION 'ASERSI GAGAL b: go-live lolos tanpa stok awal';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    -- Sejak 20261113170000 stok awal & opname hanya peringatan; yang menahan di sini = crew.
    IF v_err NOT LIKE '%Crew terdaftar%' THEN RAISE EXCEPTION 'ASERSI GAGAL b: pesan tak menyebut crew: %', v_err; END IF;
  END;

  -- (c) lengkapi → Go-Live berhasil, tanpa alert bot
  UPDATE public.outlet_staff SET outlet_id = v_o1 WHERE id = v_crew;
  INSERT INTO public.surat_jalan (outlet_id, status) VALUES (v_o1, 'diterima_lengkap');
  INSERT INTO public.opname (outlet_id, status, finalized_at) VALUES (v_o1, 'finalized', now());
  SELECT count(*) INTO v_ob1 FROM public.bot_manager_alert_outbox;
  SELECT count(*) INTO v_ob2 FROM public.bot_ceo_alert_outbox;
  SELECT count(*) INTO v_ob3 FROM public.bot_telegram_alert_delivery_request;
  SELECT count(*) INTO v_bahan FROM public.bahan_baku WHERE is_active AND peruntukan IN ('outlet','keduanya');

  r := public.go_live_outlet(v_o1, '  uji wizard t2a ', v_hari);
  IF NOT (SELECT is_active AND is_bom_enabled AND status = 'active' AND tanggal_grand_opening = v_hari FROM public.outlets WHERE id = v_o1) THEN RAISE EXCEPTION 'ASERSI GAGAL c: outlet belum aktif'; END IF;
  IF (SELECT tanggal_mulai FROM public.mitra_investments WHERE outlet_id = v_o1) <> v_hari THEN RAISE EXCEPTION 'ASERSI GAGAL c: tanggal_mulai'; END IF;
  SELECT count(*) INTO v_n FROM public.stok_balance WHERE outlet_id = v_o1;
  IF v_n <> v_bahan THEN RAISE EXCEPTION 'ASERSI GAGAL c: stok_balance % ≠ bahan %', v_n, v_bahan; END IF;
  IF (SELECT count(*) FROM public.bot_manager_alert_outbox) <> v_ob1
     OR (SELECT count(*) FROM public.bot_ceo_alert_outbox) <> v_ob2
     OR (SELECT count(*) FROM public.bot_telegram_alert_delivery_request) <> v_ob3 THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: Go-Live memicu alert bot';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlet_pembukaan_log WHERE outlet_id = v_o1 AND aksi = 'go_live') THEN RAISE EXCEPTION 'ASERSI GAGAL c: log'; END IF;

  -- (d) Go-Live kedua kali
  BEGIN
    PERFORM public.go_live_outlet(v_o1, 'UJI WIZARD T2A', v_hari + 1);
    RAISE EXCEPTION 'ASERSI GAGAL d: go-live kedua lolos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%sudah tidak berstatus Persiapan%' THEN RAISE EXCEPTION 'ASERSI GAGAL d: pesan %', SQLERRM; END IF;
  END;
  IF (SELECT tanggal_mulai FROM public.mitra_investments WHERE outlet_id = v_o1) <> v_hari THEN RAISE EXCEPTION 'ASERSI GAGAL d: tanggal_mulai berubah'; END IF;

  -- (e) nama konfirmasi salah
  BEGIN
    PERFORM public.go_live_outlet(v_o2, 'UJI WIZARD T2', v_hari);
    RAISE EXCEPTION 'ASERSI GAGAL e: nama salah lolos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%Nama konfirmasi%' THEN RAISE EXCEPTION 'ASERSI GAGAL e: pesan %', SQLERRM; END IF;
  END;

  -- (g) RAB untuk outlet internal
  BEGIN
    PERFORM public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T2G',
      'am_staff_id',v_am,'rab',jsonb_build_object('berlaku_sampai',v_hari + 5)));
    RAISE EXCEPTION 'ASERSI GAGAL g: RAB internal lolos';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
  END;

  -- (f) role crew → 42501
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.buat_outlet_persiapan(jsonb_build_object('jenis','internal','nama','UJI WIZARD T2F','am_staff_id',v_am));
    RAISE EXCEPTION 'ASERSI GAGAL f: crew bisa membuat outlet';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT 't2 lulus' AS hasil;
ROLLBACK;
