-- ARSIP — SUDAH DIJALANKAN 2026-09-28 (COMMIT). JANGAN DIJALANKAN ULANG.
-- Hasil COGS owner: 1-18 Sep 606.338.090 -> 628.100.471; 19-28 Sep 331.888.518 -> 363.776.238; Agustus tetap 1.051.603.330.
-- Hasil COGS mitra: 1-18 Sep 313.561.270 -> 325.059.193; 19-28 Sep 173.921.426 -> 190.409.531; Agustus tetap 476.464.450.
-- Input HPP baru dari Excel "XX SS 2.0 HPP x 2026.xlsx" (sheet UPDATED SS 2.0 INTERNAL), berlaku mulai 1 Sep 2026.
-- Lewat RPC ubah_hpp_menu atas nama akun admin "Admin Dev".
-- Ditulis DUA kali per kunci: berlaku 1 Sep (menimpa angka lama 1-18 Sep) dan berlaku 19 Sep
-- (menimpa angka file "(1)" yang diinput 26 Sep; riwayat per kunci, baris 19 Sep kalau dibiarkan akan menang).
-- Shawarmie: hanya 1 Sep (dihentikan per 19 Sep, baris kosong 19 Sep dipertahankan).
-- HPP mitra (menu_outlet_prices, tampilan layar HPP) = round(baru x 1,1), seperti layar HPP.
BEGIN;
CREATE TEMP TABLE _cek (tahap text, periode text, owner_cogs numeric, mitra_cogs numeric);
CREATE TEMP TABLE _hasil (menu text, kategori text, tgl date, hpp numeric, ss numeric);

DO $$
DECLARE
  c_alasan constant text := 'HPP SS 2.0 (Excel XX SS 2.0 HPP x 2026, sheet UPDATED) berlaku 1 Sep 2026 - diinput via Claude atas permintaan owner 28 Sep 2026';
  v_admin uuid;
  v_mitra uuid[];
  v_rencana jsonb;
  v_r jsonb;
  v_perubahan jsonb;
  v_tgl date;
  v_n int;
  v_ss_kunci text[] := ARRAY['ss_online','tiktok_shop','shopee_shop','f3305089-b9e4-4b92-95da-14bf6e7fb6d5','d68eb5ec-d6bb-4d0a-8758-a2600c8f1584'];
  k text;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name = 'Admin Dev' AND role = 'admin' AND status = 'active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Akun Admin Dev tidak ditemukan'; END IF;
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type = 'mitra';

  INSERT INTO _cek SELECT 'sebelum', p.n,
    (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 1-18 Sep', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07'),
               ('3 19-28 Sep', timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-28 23:59:59.999+07')) p(n, a, b);

  -- (nama, kategori, hpp offline | NULL, hpp SS Online | NULL, sampai_18 = hanya berlaku 1 Sep)
  WITH rencana(nama, kategori, hpp, ss, hanya_1sep) AS (VALUES
    ('Original Ayam Sedang','Original Shawarma Ayam',15990.7,13512.4,false),
    ('Original Ayam Besar','Original Shawarma Ayam',20141,15424.2,false),
    ('Original Ayam Jumbo','Original Shawarma Ayam',23871.1,18807.8,false),
    ('Original Ayam Reguler','Original Shawarma Ayam',NULL,10316.9,false),
    ('Original Sapi Sedang','Original Shawarma Sapi',15796,13081.2,false),
    ('Original Sapi Besar','Original Shawarma Sapi',19113.6,15011.7,false),
    ('Original Sapi Jumbo','Original Shawarma Sapi',22742.5,18362.3,false),
    ('Original Sapi Reguler','Original Shawarma Sapi',NULL,10595.2,false),
    ('Best Seller 2','Original Shawarma Sapi',22742.5,NULL,false),
    ('Original Mix Besar','Original Shawarma Mix',22182.6,19714.2,false),
    ('Original Mix Jumbo','Original Shawarma Mix',28160,25594.8,false),
    ('Original Mix Reguler','Original Shawarma Mix',NULL,12269.4,false),
    ('Best Seller (Mix Jumbo)','Original Shawarma Mix',28160,NULL,false),
    ('Suka Chicken','Suka Suka',17337.1,NULL,false),
    ('Suka Beef','Suka Suka',18904.6,NULL,false),
    ('Suka Fried Chicken','Suka Suka',17733.1,NULL,false),
    ('Suka Samyang','Suka Suka',17447.1,NULL,false),
    ('Extra Keju','Topping',3850,NULL,false),
    ('Extra Kentang','Topping',3850,NULL,false),
    ('Original Ayam Reguler (BOGO)','BUY 1 GET 1',7546,NULL,false),
    ('Original Sapi Reguler (BOGO)','BUY 1 GET 1',7799,NULL,false),
    ('Shawarmie Ayam','Original Shawarma Ayam',16050.1,NULL,true),
    ('Shawarmie Sapi','Original Shawarma Sapi',15637.6,NULL,true),
    ('Original Ayam Sedang','Voucher Pamulang 10%',15990.7,NULL,false),
    ('Original Ayam Besar','Voucher Pamulang 10%',20141,NULL,false),
    ('Original Ayam Jumbo','Voucher Pamulang 10%',23871.1,NULL,false),
    ('Original Sapi Sedang','Voucher Pamulang 10%',15796,NULL,false),
    ('Original Sapi Besar','Voucher Pamulang 10%',19113.6,NULL,false),
    ('Original Sapi Jumbo','Voucher Pamulang 10%',22742.5,NULL,false),
    ('Original Mix Besar','Voucher Pamulang 10%',22182.6,NULL,false),
    ('Original Mix Jumbo','Voucher Pamulang 10%',28160,NULL,false),
    ('Suka Chicken','Voucher Pamulang 10%',17337.1,NULL,false),
    ('Suka Beef','Voucher Pamulang 10%',18904.6,NULL,false),
    ('Suka Fried Chicken','Voucher Pamulang 10%',17733.1,NULL,false),
    ('Suka Samyang','Voucher Pamulang 10%',17447.1,NULL,false)
  ),
  cocok AS (
    SELECT r.*, m.id AS menu_id, count(*) OVER (PARTITION BY r.nama, r.kategori) AS jml
    FROM rencana r
    JOIN menu_items m ON m.name = r.nama
    JOIN categories c ON c.id = m.category_id AND c.name = r.kategori
  )
  SELECT jsonb_agg(jsonb_build_object('nama', nama, 'kategori', kategori, 'hpp', hpp, 'ss', ss,
                                      'hanya_1sep', hanya_1sep, 'menu_id', menu_id, 'jml', jml))
    INTO v_rencana FROM cocok;

  v_n := jsonb_array_length(COALESCE(v_rencana, '[]'::jsonb));
  IF v_n <> 35 THEN RAISE EXCEPTION 'Harus cocok 35 menu, ketemu %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_rencana) e WHERE (e->>'jml')::int <> 1) THEN
    RAISE EXCEPTION 'Ada nama+kategori yang cocok ke lebih dari satu menu';
  END IF;

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
    FOREACH v_tgl IN ARRAY ARRAY[DATE '2026-09-01', DATE '2026-09-19'] LOOP
      CONTINUE WHEN v_tgl = DATE '2026-09-19' AND (v_r->>'hanya_1sep')::boolean;
      PERFORM public.ubah_hpp_menu((v_r->>'menu_id')::uuid, v_perubahan, v_tgl, c_alasan);
    END LOOP;
  END LOOP;
  RESET ROLE;

  -- HPP mitra di layar HPP (+10%), hanya menu aktif dengan HPP offline
  INSERT INTO menu_outlet_prices (menu_item_id, outlet_id, is_available, price, hpp_override)
  SELECT (e->>'menu_id')::uuid, o.id, true, NULL, round((e->>'hpp')::numeric * 1.1)
  FROM jsonb_array_elements(v_rencana) e CROSS JOIN outlets o
  WHERE o.type = 'mitra' AND e->'hpp' <> 'null'::jsonb AND NOT (e->>'hanya_1sep')::boolean
  ON CONFLICT (menu_item_id, outlet_id) DO UPDATE SET hpp_override = EXCLUDED.hpp_override, updated_at = now();

  INSERT INTO _hasil
  SELECT e->>'nama', e->>'kategori', d.t, h.hpp_override, (h.channel_hpp->>'ss_online')::numeric
  FROM jsonb_array_elements(v_rencana) e
  CROSS JOIN (VALUES (DATE '2026-08-31'), (DATE '2026-09-01'), (DATE '2026-09-18'), (DATE '2026-09-19'), (DATE '2026-09-28')) d(t)
  CROSS JOIN LATERAL public.menu_hpp_pada((e->>'menu_id')::uuid, d.t) h;

  -- Asersi: 1, 18, 19, 28 Sep = angka XX (Shawarmie: 19 & 28 kosong)
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_rencana) e
    CROSS JOIN (VALUES (DATE '2026-09-01'), (DATE '2026-09-18'), (DATE '2026-09-19'), (DATE '2026-09-28')) d(t)
    CROSS JOIN LATERAL public.menu_hpp_pada((e->>'menu_id')::uuid, d.t) h
    WHERE NOT ((e->>'hanya_1sep')::boolean AND d.t >= DATE '2026-09-19')
      AND ((e->'hpp' <> 'null'::jsonb AND h.hpp_override IS DISTINCT FROM (e->>'hpp')::numeric)
        OR (e->'ss' <> 'null'::jsonb AND (h.channel_hpp->>'ss_online')::numeric IS DISTINCT FROM (e->>'ss')::numeric))
  ) THEN RAISE EXCEPTION 'GAGAL: nilai September tidak sesuai XX'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_rencana) e
    CROSS JOIN LATERAL public.menu_hpp_pada((e->>'menu_id')::uuid, DATE '2026-09-19') h
    WHERE (e->>'hanya_1sep')::boolean AND h.hpp_override IS NOT NULL
  ) THEN RAISE EXCEPTION 'GAGAL: Shawarmie tidak kosong lagi mulai 19 Sep'; END IF;

  INSERT INTO _cek SELECT 'sesudah', p.n,
    (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 1-18 Sep', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07'),
               ('3 19-28 Sep', timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-28 23:59:59.999+07')) p(n, a, b);

  IF EXISTS (SELECT 1 FROM _cek s JOIN _cek b ON b.periode = s.periode AND b.tahap = 'sebelum'
             WHERE s.tahap = 'sesudah' AND s.periode = '1 Agustus'
               AND (s.owner_cogs IS DISTINCT FROM b.owner_cogs OR s.mitra_cogs IS DISTINCT FROM b.mitra_cogs)) THEN
    RAISE EXCEPTION 'GAGAL: Agustus ikut berubah';
  END IF;
END $$;

SELECT 'COGS | ' || periode || ' | ' || tahap || ' | owner ' || round(owner_cogs) || ' | mitra ' || round(mitra_cogs) AS baris FROM _cek
UNION ALL
SELECT 'HPP | ' || kategori || ' | ' || menu || ' | ' || tgl || ' | ' || COALESCE(hpp::text,'-') || ' | ss ' || COALESCE(ss::text,'-') FROM _hasil
ORDER BY 1;
-- AKHIR: ROLLBACK (uji coba) / COMMIT (sungguhan)
ROLLBACK;
