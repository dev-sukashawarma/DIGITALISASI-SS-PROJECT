-- ARSIP — SUDAH DIJALANKAN 2026-10-21 (COMMIT). JANGAN DIJALANKAN ULANG
-- (asersi nilai lama akan menolaknya).
-- Hasil (identik sebelum/sesudah, asersi): COGS owner Agustus 1.051.603.330, September
-- 1.012.112.265, 1-20 Okt 792.765.158; mitra Agustus 476.464.450, September 522.777.566,
-- 1-20 Okt 415.862.580. 14 baris riwayat ber-alasan, 14 menu x 14 outlet mitra tampilan.
-- Sumber: "HPP GRAND NEW (Sedang-Besar-Jumbo).xlsx", tab SUMMARY HPP, kolom HPP + OPEX
-- (= HPP x 1,1). Keputusan owner 2026-10-21 (grilling):
--   1. hpp_override = kolom HPP + OPEX.
--   2. Berlaku mulai 21 Okt 2026; 1-20 Okt tetap angka file XX.
--   3. HPP SS Online (channel_hpp) TIDAK diubah — hanya kunci 'hpp_override' yang ditulis.
--   4. Ayam Besar & Mix Jumbo pakai angka koreksi (gramasi lettuce 65 g; ayam 80 / sapi 105),
--      dihitung dengan harga per gram Excel: 17.638 x 1,1 = 19.401,8 dan 24.616,75 x 1,1 = 27.078,4.
--   5. Best Seller 2 = Original Sapi Jumbo; Best Seller (Mix Jumbo) = Original Mix Jumbo.
-- Lewat RPC ubah_hpp_menu atas nama akun admin "Admin Dev".
-- HPP mitra di layar HPP (menu_outlet_prices) = round(baru x 1,1); laporan mitra menghitung x 1,1 sendiri.
BEGIN;
CREATE TEMP TABLE _cek (tahap text, periode text, owner_cogs numeric, mitra_cogs numeric);
CREATE TEMP TABLE _hasil (menu text, tgl date, hpp numeric, ss numeric);

DO $$
DECLARE
  c_alasan constant text := 'HPP GRAND NEW (Sedang-Besar-Jumbo).xlsx, tab SUMMARY HPP kolom HPP + OPEX, berlaku 21 Okt 2026 - diinput via Claude atas keputusan owner 21 Okt 2026';
  c_tgl constant date := DATE '2026-10-21';
  v_admin uuid;
  v_mitra uuid[];
  v_n int;
  v_list jsonb;
  v_e jsonb;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name = 'Admin Dev' AND role = 'admin' AND status = 'active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Akun Admin Dev tidak ditemukan'; END IF;
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type = 'mitra';

  CREATE TEMP TABLE _rencana (menu_id uuid, nama text, hpp_lama numeric, hpp_baru numeric) ON COMMIT DROP;
  INSERT INTO _rencana VALUES
    ('4adb4426-0d1f-4962-a5d9-2b9dfbb29ecd', 'Original Sapi Sedang',    15796,   14525.5),
    ('a2c9433d-2525-4096-a28f-6e6f29dcf6df', 'Original Ayam Sedang',    15990.7, 14742.2),
    ('fea982b2-e172-4bfd-8fc6-1fa6de830c19', 'Suka Beef',               18904.6, 17090.7),
    ('4bb4210d-1f5f-4cd8-a0e4-c9c90b04bbde', 'Suka Chicken',            17337.1, 18159.9),
    ('410e8f2d-6bbf-4acd-a88a-8d291d78365d', 'Suka Fried Chicken',      17733.1, 16088.6),
    ('3c665d2b-ba92-49e9-8ced-bce946c90a2b', 'Suka Samyang',            17447.1, 17436.1),
    ('fe01e7d3-ed72-45e9-9b74-2017522a2b64', 'Original Sapi Besar',     19113.6, 18746.2),
    ('a80b91f8-e5dd-4f83-9c94-ebeba6b2da80', 'Original Ayam Besar',     20141,   19401.8),
    ('df8b5f68-a6fb-4dc8-9bad-f8f02aaff0d7', 'Original Mix Besar',      22182.6, 20945.1),
    ('df2d06dc-1326-4139-aa95-5bc66a0a332b', 'Original Sapi Jumbo',     22742.5, 22082.5),
    ('e85983b6-7e5f-4e78-b3c8-501cf21e39e4', 'Original Ayam Jumbo',     23871.1, 24370.5),
    ('82751882-7f37-4b47-9f85-c2b3fca4f939', 'Original Mix Jumbo',      28160,   27078.4),
    ('8657f72e-d1a2-4829-a5cf-33535f7b293c', 'Best Seller 2',           22742.5, 22082.5),
    ('c698603b-7f43-415c-986c-b883445e783c', 'Best Seller (Mix Jumbo)', 28160,   27078.4);

  -- Penjaga: id, nama, dan HPP lama harus persis seperti saat dicek (21 Okt).
  SELECT count(*) INTO v_n FROM _rencana r
    JOIN menu_items m ON m.id = r.menu_id AND m.name = r.nama AND m.outlet_id IS NULL AND m.hpp_override = r.hpp_lama;
  IF v_n <> 14 THEN RAISE EXCEPTION 'GAGAL: menu cocok (id+nama+HPP lama) = % (harap 14)', v_n; END IF;

  -- Identitas Admin Dev dipasang SEBELUM pengukuran pertama: tanpa itu
  -- get_owner_dashboard_summary tak melihat outlet mana pun dan mengembalikan COGS 0.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  INSERT INTO _cek SELECT 'sebelum', p.n,
    (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus',   timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 September', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07'),
               ('3 1-20 Okt',  timestamptz '2026-10-01 00:00+07', timestamptz '2026-10-20 23:59:59.999+07'),
               ('4 21 Okt',    timestamptz '2026-10-21 00:00+07', timestamptz '2026-10-21 23:59:59.999+07')) p(n, a, b);

  -- Rencana dibaca ke variabel dulu: tabel temp milik postgres tak bisa dibaca role authenticated.
  SELECT jsonb_agg(jsonb_build_object('menu_id', menu_id, 'hpp_baru', hpp_baru)) INTO v_list FROM _rencana;
  SET LOCAL ROLE authenticated;
  FOR v_e IN SELECT * FROM jsonb_array_elements(v_list) LOOP
    PERFORM public.ubah_hpp_menu((v_e->>'menu_id')::uuid,
                                 jsonb_build_object('hpp_override', (v_e->>'hpp_baru')::numeric), c_tgl, c_alasan);
  END LOOP;
  RESET ROLE;

  -- HPP mitra di layar HPP (+10%)
  INSERT INTO menu_outlet_prices (menu_item_id, outlet_id, is_available, price, hpp_override)
  SELECT r.menu_id, o.id, true, NULL, round(r.hpp_baru * 1.1)
  FROM _rencana r CROSS JOIN outlets o
  WHERE o.type = 'mitra'
  ON CONFLICT (menu_item_id, outlet_id) DO UPDATE SET hpp_override = EXCLUDED.hpp_override, updated_at = now();

  INSERT INTO _hasil
  SELECT r.nama, d.t, h.hpp_override, (h.channel_hpp->>'ss_online')::numeric
  FROM _rencana r
  CROSS JOIN (VALUES (DATE '2026-10-20'), (DATE '2026-10-21')) d(t)
  CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, d.t) h;

  -- Asersi: 20 Okt = lama, 21 Okt = baru, menu_items = baru, SS Online tak bergeser.
  IF EXISTS (SELECT 1 FROM _rencana r CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-10-20') h
             WHERE h.hpp_override IS DISTINCT FROM r.hpp_lama) THEN
    RAISE EXCEPTION 'GAGAL: HPP 20 Okt ikut berubah';
  END IF;
  IF EXISTS (SELECT 1 FROM _rencana r CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-10-21') h
             WHERE h.hpp_override IS DISTINCT FROM r.hpp_baru) THEN
    RAISE EXCEPTION 'GAGAL: HPP 21 Okt tidak sama dengan angka baru';
  END IF;
  IF EXISTS (SELECT 1 FROM _rencana r JOIN menu_items m ON m.id = r.menu_id
             WHERE m.hpp_override IS DISTINCT FROM r.hpp_baru) THEN
    RAISE EXCEPTION 'GAGAL: menu_items.hpp_override belum angka baru';
  END IF;
  IF EXISTS (SELECT 1 FROM _rencana r
             CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-10-20') a
             CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-10-21') b
             WHERE a.channel_hpp IS DISTINCT FROM b.channel_hpp) THEN
    RAISE EXCEPTION 'GAGAL: HPP SS Online ikut berubah';
  END IF;
  SELECT count(*) INTO v_n FROM menu_outlet_prices mop JOIN _rencana r ON r.menu_id = mop.menu_item_id
    JOIN outlets o ON o.id = mop.outlet_id AND o.type = 'mitra'
   WHERE mop.hpp_override = round(r.hpp_baru * 1.1);
  IF v_n <> 14 * cardinality(v_mitra) THEN
    RAISE EXCEPTION 'GAGAL: baris tampilan mitra = % (harap %)', v_n, 14 * cardinality(v_mitra);
  END IF;

  INSERT INTO _cek SELECT 'sesudah', p.n,
    (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus',   timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 September', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07'),
               ('3 1-20 Okt',  timestamptz '2026-10-01 00:00+07', timestamptz '2026-10-20 23:59:59.999+07'),
               ('4 21 Okt',    timestamptz '2026-10-21 00:00+07', timestamptz '2026-10-21 23:59:59.999+07')) p(n, a, b);

  IF EXISTS (SELECT 1 FROM _cek s JOIN _cek b ON b.periode = s.periode AND b.tahap = 'sebelum'
             WHERE s.tahap = 'sesudah' AND s.periode IN ('1 Agustus', '2 September', '3 1-20 Okt')
               AND (s.owner_cogs IS DISTINCT FROM b.owner_cogs OR s.mitra_cogs IS DISTINCT FROM b.mitra_cogs)) THEN
    RAISE EXCEPTION 'GAGAL: COGS sebelum 21 Okt ikut berubah';
  END IF;
END $$;

COMMIT;

SELECT 'COGS | ' || periode || ' | ' || tahap || ' | owner ' || round(owner_cogs) || ' | mitra ' || round(mitra_cogs) AS baris FROM _cek
UNION ALL
SELECT 'HPP | ' || menu || ' | ' || tgl || ' | ' || COALESCE(hpp::text, '-') || ' | ss ' || COALESCE(ss::text, '-') FROM _hasil
ORDER BY 1;
