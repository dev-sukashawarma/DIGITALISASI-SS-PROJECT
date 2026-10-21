-- ARSIP — HPP kasir 3 menu Reguler berlaku 21 Okt 2026. JANGAN DIJALANKAN ULANG
-- (penjaga "riwayat 20 Okt masih kosong" akan menolaknya).
-- Latar: riwayat HPP kunci 'hpp_override' ketiga menu Reguler kosong sejak 1 Sep 2026,
-- sehingga penjualan kasir/food apps tercatat tanpa HPP (HPP SS Online tetap terisi).
-- Keputusan owner 2026-10-21 (atas kartu HPP "AYAM REGULAR" & "SAPI REGULAR"):
--   1. Angka = jumlah rincian kartu x 1,1 (HPP + OPEX, aturan sama dengan menu lain):
--      Ayam 9.379 x 1,1 = 10.316,9; Sapi 9.632 x 1,1 = 10.595,2. Angka kuning di kartu
--      (9.000 / 9.700) adalah HPP lama sebelum 1 Sep, tidak dipakai.
--   2. Original Mix Reguler (tanpa kartu) = angka HPP SS Online-nya, 12.269,4 (11.154 x 1,1).
--   3. Berlaku 21 Okt 2026; periode sebelumnya tidak diubah.
--   4. HPP SS Online (channel_hpp) tidak diubah — hanya kunci 'hpp_override'.
-- Resep ketiga menu (dan BOGO) diubah terpisah: migration 20261021120000.
-- Lewat RPC ubah_hpp_menu atas nama akun admin "Admin Dev".
-- HPP mitra di layar HPP (menu_outlet_prices) = round(baru x 1,1).
BEGIN;
CREATE TEMP TABLE _cek (tahap text, periode text, owner_cogs numeric, mitra_cogs numeric);
CREATE TEMP TABLE _hasil (menu text, tgl date, hpp numeric, ss numeric, mitra_pos numeric);

DO $$
DECLARE
  c_alasan constant text := 'Kartu HPP AYAM REGULAR & SAPI REGULAR (jumlah rincian x 1,1 = HPP + OPEX); Mix Reguler = HPP SS Online-nya; berlaku 21 Okt 2026 - diinput via Claude atas keputusan owner 21 Okt 2026';
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

  CREATE TEMP TABLE _rencana (menu_id uuid, nama text, hpp_baru numeric) ON COMMIT DROP;
  INSERT INTO _rencana VALUES
    ('4a9c2877-3c8a-42c8-8644-479988c84873', 'Original Ayam Reguler', 10316.9),
    ('95872353-c467-4215-94b4-6c66751d2b02', 'Original Sapi Reguler', 10595.2),
    ('04166938-0a2b-48d2-ba86-407e4ffe77b8', 'Original Mix Reguler',  12269.4);

  -- Penjaga: id & nama cocok, dan riwayat HPP kasir 20 Okt memang masih kosong.
  SELECT count(*) INTO v_n FROM _rencana r
    JOIN menu_items m ON m.id = r.menu_id AND m.name = r.nama AND m.outlet_id IS NULL
    CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-10-20') h
   WHERE h.hpp_override IS NULL;
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL: menu cocok (id+nama+HPP 20 Okt kosong) = % (harap 3)', v_n; END IF;

  -- Identitas Admin Dev dipasang SEBELUM pengukuran pertama (tanpa itu COGS owner = 0).
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
  SELECT r.nama, d.t, h.hpp_override, (h.channel_hpp->>'ss_online')::numeric, public.get_mitra_item_hpp(r.menu_id, 'pos', d.t)
  FROM _rencana r
  CROSS JOIN (VALUES (DATE '2026-10-20'), (DATE '2026-10-21')) d(t)
  CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, d.t) h;

  -- Asersi: 20 Okt tetap kosong, 21 Okt = angka baru, menu_items = baru, SS Online tak bergeser.
  IF EXISTS (SELECT 1 FROM _rencana r CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-10-20') h
             WHERE h.hpp_override IS NOT NULL) THEN
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
  IF v_n <> 3 * cardinality(v_mitra) THEN
    RAISE EXCEPTION 'GAGAL: baris tampilan mitra = % (harap %)', v_n, 3 * cardinality(v_mitra);
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
SELECT 'HPP | ' || menu || ' | ' || tgl || ' | ' || COALESCE(hpp::text, '-') || ' | ss ' || COALESCE(ss::text, '-') || ' | mitra pos ' || COALESCE(mitra_pos::text, '-') FROM _hasil
ORDER BY 1;
