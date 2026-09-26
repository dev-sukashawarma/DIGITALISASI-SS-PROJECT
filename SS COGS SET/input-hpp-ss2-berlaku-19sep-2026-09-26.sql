-- ⚠️ SUDAH DIJALANKAN di produksi 26 Sep 2026 (commit). JANGAN dijalankan ulang — skrip ini arsip/jejak audit.
-- Menjalankan ulang: input HPP akan meng-upsert baris yang sama (aman), tapi skrip Shawarmie berhenti sendiri (menu sudah ada / baris ≠ 279).
-- Input HPP baru (Excel "SS 2.0 HPP x 2026", sheet UPDATED SS 2.0 INTERNAL), berlaku mulai 19 Sep 2026.
-- Lewat RPC ubah_hpp_menu atas nama akun admin "Admin Dev". HPP mitra (+10%) ikut diperbarui seperti layar HPP.
BEGIN;
CREATE TEMP TABLE _hasil (menu text, kategori text, hpp_18 numeric, hpp_19 numeric, ss_18 numeric, ss_19 numeric, hpp_hari_ini numeric, mitra_baris int);

DO $$
DECLARE
  c_tgl constant date := DATE '2026-09-19';
  c_alasan constant text := 'HPP SS 2.0 (Excel SS 2.0 HPP x 2026, sheet UPDATED) — diinput via Claude atas permintaan owner 26 Sep 2026';
  v_admin uuid;
  v_rencana jsonb;
  v_r jsonb;
  v_perubahan jsonb;
  v_n int;
  v_ss_kunci text[] := ARRAY['ss_online','tiktok_shop','shopee_shop','f3305089-b9e4-4b92-95da-14bf6e7fb6d5','d68eb5ec-d6bb-4d0a-8758-a2600c8f1584'];
  k text;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name = 'Admin Dev' AND role = 'admin' AND status = 'active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Akun Admin Dev tidak ditemukan'; END IF;

  -- Rencana: (nama, kategori, hpp offline baru | NULL, hpp SS Online baru | NULL)
  WITH rencana(nama, kategori, hpp, ss) AS (VALUES
    ('Original Ayam Sedang','Original Shawarma Ayam',14537,12284),
    ('Original Ayam Besar','Original Shawarma Ayam',18310,14022),
    ('Original Ayam Jumbo','Original Shawarma Ayam',21701,17098),
    ('Original Ayam Reguler','Original Shawarma Ayam',NULL,9379),
    ('Original Sapi Sedang','Original Shawarma Sapi',14360,11892),
    ('Original Sapi Besar','Original Shawarma Sapi',17376,13647),
    ('Original Sapi Jumbo','Original Shawarma Sapi',20675,16693),
    ('Original Sapi Reguler','Original Shawarma Sapi',NULL,9632),
    ('Best Seller 2','Original Shawarma Sapi',20675,NULL),
    ('Original Mix Besar','Original Shawarma Mix',20166,17922),
    ('Original Mix Jumbo','Original Shawarma Mix',25600,23268),
    ('Original Mix Reguler','Original Shawarma Mix',NULL,11154),
    ('Best Seller (Mix Jumbo)','Original Shawarma Mix',25600,NULL),
    ('Suka Chicken','Suka Suka',15761,NULL),
    ('Suka Beef','Suka Suka',17186,NULL),
    ('Suka Fried Chicken','Suka Suka',16121,NULL),
    ('Suka Samyang','Suka Suka',15861,NULL),
    ('Original Ayam Reguler (BOGO)','BUY 1 GET 1',7546,NULL),
    ('Original Sapi Reguler (BOGO)','BUY 1 GET 1',7799,NULL),
    ('Original Ayam Sedang','Voucher Pamulang 10%',14537,NULL),
    ('Original Ayam Besar','Voucher Pamulang 10%',18310,NULL),
    ('Original Ayam Jumbo','Voucher Pamulang 10%',21701,NULL),
    ('Original Sapi Sedang','Voucher Pamulang 10%',14360,NULL),
    ('Original Sapi Besar','Voucher Pamulang 10%',17376,NULL),
    ('Original Sapi Jumbo','Voucher Pamulang 10%',20675,NULL),
    ('Original Mix Besar','Voucher Pamulang 10%',20166,NULL),
    ('Original Mix Jumbo','Voucher Pamulang 10%',25600,NULL),
    ('Suka Chicken','Voucher Pamulang 10%',15761,NULL),
    ('Suka Beef','Voucher Pamulang 10%',17186,NULL),
    ('Suka Fried Chicken','Voucher Pamulang 10%',16121,NULL),
    ('Suka Samyang','Voucher Pamulang 10%',15861,NULL)
  ),
  cocok AS (
    SELECT r.*, m.id AS menu_id, count(*) OVER (PARTITION BY r.nama, r.kategori) AS jml
    FROM rencana r
    JOIN menu_items m ON m.name = r.nama
    JOIN categories c ON c.id = m.category_id AND c.name = r.kategori
  )
  SELECT jsonb_agg(jsonb_build_object('nama', nama, 'kategori', kategori, 'hpp', hpp, 'ss', ss, 'menu_id', menu_id, 'jml', jml))
    INTO v_rencana FROM cocok;

  v_n := jsonb_array_length(COALESCE(v_rencana, '[]'::jsonb));
  IF v_n <> 31 THEN RAISE EXCEPTION 'Harus cocok 31 menu, ketemu %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_rencana) e WHERE (e->>'jml')::int <> 1) THEN
    RAISE EXCEPTION 'Ada nama+kategori yang cocok ke lebih dari satu menu';
  END IF;

  -- Tulis lewat RPC sebagai Admin Dev
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOR v_r IN SELECT * FROM jsonb_array_elements(v_rencana) LOOP
    v_perubahan := '{}'::jsonb;
    IF v_r->'hpp' <> 'null'::jsonb THEN
      v_perubahan := v_perubahan || jsonb_build_object('hpp_override', (v_r->>'hpp')::numeric);
    END IF;
    IF v_r->'ss' <> 'null'::jsonb THEN
      FOREACH k IN ARRAY v_ss_kunci LOOP
        v_perubahan := v_perubahan || jsonb_build_object(k, (v_r->>'ss')::numeric);
      END LOOP;
    END IF;
    PERFORM public.ubah_hpp_menu((v_r->>'menu_id')::uuid, v_perubahan, c_tgl, c_alasan);
  END LOOP;
  RESET ROLE;

  -- HPP mitra (+10%), meniru layar HPP: hanya untuk perubahan HPP offline
  INSERT INTO menu_outlet_prices (menu_item_id, outlet_id, is_available, price, hpp_override)
  SELECT (e->>'menu_id')::uuid, o.id, true, NULL, round((e->>'hpp')::numeric * 1.1)
  FROM jsonb_array_elements(v_rencana) e CROSS JOIN outlets o
  WHERE o.type = 'mitra' AND e->'hpp' <> 'null'::jsonb
  ON CONFLICT (menu_item_id, outlet_id) DO UPDATE SET hpp_override = EXCLUDED.hpp_override, updated_at = now();

  -- Verifikasi
  INSERT INTO _hasil
  SELECT e->>'nama', e->>'kategori',
         a.hpp_override, b.hpp_override,
         (a.channel_hpp->>'ss_online')::numeric, (b.channel_hpp->>'ss_online')::numeric,
         mi.hpp_override,
         (SELECT count(*) FROM menu_outlet_prices mop JOIN outlets o ON o.id = mop.outlet_id
           WHERE mop.menu_item_id = (e->>'menu_id')::uuid AND o.type = 'mitra'
             AND e->'hpp' <> 'null'::jsonb AND mop.hpp_override = round((e->>'hpp')::numeric * 1.1))
  FROM jsonb_array_elements(v_rencana) e
  CROSS JOIN LATERAL public.menu_hpp_pada((e->>'menu_id')::uuid, DATE '2026-09-18') a
  CROSS JOIN LATERAL public.menu_hpp_pada((e->>'menu_id')::uuid, DATE '2026-09-19') b
  JOIN menu_items mi ON mi.id = (e->>'menu_id')::uuid;

  -- Asersi: 19 Sep = angka baru, menu_items = angka baru
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_rencana) e
    CROSS JOIN LATERAL public.menu_hpp_pada((e->>'menu_id')::uuid, DATE '2026-09-19') b
    WHERE (e->'hpp' <> 'null'::jsonb AND b.hpp_override IS DISTINCT FROM (e->>'hpp')::numeric)
       OR (e->'ss' <> 'null'::jsonb AND (b.channel_hpp->>'ss_online')::numeric IS DISTINCT FROM (e->>'ss')::numeric)
  ) THEN RAISE EXCEPTION 'Verifikasi gagal: nilai 19 Sep tidak sesuai rencana'; END IF;
END $$;

COMMIT;
SELECT count(*) AS menu_tertulis FROM _hasil;
