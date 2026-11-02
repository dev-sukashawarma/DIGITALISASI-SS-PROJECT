-- ARSIP — SUDAH DIJALANKAN 2026-11-02 (COMMIT). JANGAN DIJALANKAN ULANG
-- (asersi nilai lama akan menolaknya).
-- Sumber: "⛔SS HPP OCT 2026 v2.2.xlsx", tab OFFLINE, kolom C (HPP + OPEX) & kolom O (HPP MITRA = HPP Murni x 1,10).
-- Keputusan owner 2026-11-02:
--   1. hpp_override pusat/internal = kolom C (HPP + OPEX), berlaku mulai 2 Nov 2026 (2026-11-02).
--   2. Mencakup 15 menu makanan utama (termasuk Suka Sosis / SUKA SAUSAGE, Best Seller 2,
--      Best Seller Mix Jumbo) + 3 minuman (Ice Tea 5.280, Orange Juice 5.280, Aqua 1.500).
--   3. HPP SS Online (channel_hpp) TIDAK diubah — hanya kunci 'hpp_override' yang ditulis.
--   4. HPP Mitra mulai 1 Okt 2026 di-takeout komponen OPEX 10% (pakai HPP Murni x 1,10 = kolom O),
--      KECUALI MITRA CILEUNGSI (62a56103-2085-4dd5-9d25-a3c0cffc88ff) yang tetap memakai
--      (HPP + OPEX) x 1,10.
--   5. Periode sebelum 1 Okt 2026 (Agustus & September 2026) dijamin Rp 0 bergeser.
-- Lewat RPC ubah_hpp_menu atas nama akun admin "Admin Dev".

BEGIN;
CREATE TEMP TABLE _cek (
  tahap text,
  periode text,
  owner_cogs numeric,
  owner_markup numeric,
  mitra_cogs numeric,
  cileungsi_cogs numeric
);
CREATE TEMP TABLE _hasil (menu text, tgl date, hpp numeric, mitra_std numeric, mitra_cileungsi numeric, ss numeric);

DO $$
DECLARE
  c_alasan constant text := 'SS HPP OCT 2026 v2.2.xlsx, tab OFFLINE kolom HPP + OPEX (Mitra takeout OPEX kecuali Cileungsi), berlaku 2 Nov 2026 - diinput atas keputusan owner 2 Nov 2026';
  c_tgl constant date := DATE '2026-11-02';
  c_cileungsi constant uuid := '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid;
  v_admin uuid;
  v_mitra uuid[];
  v_n int;
  v_list jsonb;
  v_e jsonb;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name = 'Admin Dev' AND role = 'admin' AND status = 'active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Akun Admin Dev tidak ditemukan'; END IF;

  SELECT array_agg(o.id ORDER BY o.name) INTO v_mitra
  FROM outlets o
  WHERE (
      o.type = 'mitra'
      OR EXISTS (SELECT 1 FROM mitra_investments mi WHERE mi.outlet_id = o.id)
      OR COALESCE(o.name, '') ILIKE '%mitra%'
    )
    AND o.id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
    AND COALESCE(o.name, '') !~* '(tes|test|trial|demo)'
    AND COALESCE(o.slug, '') !~* '(tes|test|trial|demo)';

  CREATE TEMP TABLE _rencana (menu_id uuid, nama text, hpp_lama numeric, hpp_baru numeric) ON COMMIT DROP;
  INSERT INTO _rencana VALUES
    ('4adb4426-0d1f-4962-a5d9-2b9dfbb29ecd', 'Original Sapi Sedang',    14525.5,  15099.7),
    ('a2c9433d-2525-4096-a28f-6e6f29dcf6df', 'Original Ayam Sedang',    14742.2,  15167.9),
    ('fea982b2-e172-4bfd-8fc6-1fa6de830c19', 'Suka Beef',               17090.7,  17747.4),
    ('4bb4210d-1f5f-4cd8-a0e4-c9c90b04bbde', 'Suka Chicken',            18159.9,  18885.9),
    ('410e8f2d-6bbf-4acd-a88a-8d291d78365d', 'Suka Fried Chicken',      16088.6,  16482.4),
    ('3c665d2b-ba92-49e9-8ced-bce946c90a2b', 'Suka Samyang',            17436.1,  17829.9),
    ('5dae21e6-eb0d-4076-9771-0aa4d8d046c3', 'Suka Sosis',              13075,    13020.7),
    ('fe01e7d3-ed72-45e9-9b74-2017522a2b64', 'Original Sapi Besar',     18746.2,  19495.3),
    ('a80b91f8-e5dd-4f83-9c94-ebeba6b2da80', 'Original Ayam Besar',     19401.8,  19247.8),
    ('df8b5f68-a6fb-4dc8-9bad-f8f02aaff0d7', 'Original Mix Besar',      20945.1,  21843.8),
    ('df2d06dc-1326-4139-aa95-5bc66a0a332b', 'Original Sapi Jumbo',     22082.5,  22748),
    ('e85983b6-7e5f-4e78-b3c8-501cf21e39e4', 'Original Ayam Jumbo',     24370.5,  25086.6),
    ('82751882-7f37-4b47-9f85-c2b3fca4f939', 'Original Mix Jumbo',      27078.4,  28420.7),
    ('8657f72e-d1a2-4829-a5cf-33535f7b293c', 'Best Seller 2',           22082.5,  22748),
    ('c698603b-7f43-415c-986c-b883445e783c', 'Best Seller (Mix Jumbo)', 27078.4,  28420.7),
    ('08a57f8f-f212-4205-a3eb-fb88066ae1b8', 'Ice Tea',                 4800,     5280),
    ('c543b78e-3341-44e0-b3ef-53349e71e3d3', 'Orange Juice',            4800,     5280),
    ('c8427af3-0a41-48dd-9a08-6b93cd913ec6', 'Aqua',                    1541.67,  1500);

  -- Penjaga: ke-18 menu harus cocok persis id + nama + outlet_id NULL + hpp_lama
  SELECT count(*) INTO v_n FROM _rencana r
    JOIN menu_items m ON m.id = r.menu_id AND m.name = r.nama AND m.outlet_id IS NULL AND m.hpp_override = r.hpp_lama;
  IF v_n <> 18 THEN RAISE EXCEPTION 'GAGAL: menu cocok (id+nama+HPP lama) = % (harap 18)', v_n; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  INSERT INTO _cek
  SELECT
    'sebelum',
    p.n,
    (od.val ->> 'total_cogs')::numeric,
    (od.val ->> 'total_mitra_markup')::numeric,
    COALESCE((SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b)), 0),
    COALESCE((SELECT sum(cogs) FROM get_mitra_orders_summary(ARRAY[c_cileungsi], p.a, p.b)), 0)
  FROM (VALUES
    ('1 Agustus',   timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
    ('2 September', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-30 23:59:59.999+07'),
    ('3 Oktober',   timestamptz '2026-10-01 00:00:00+07', timestamptz '2026-10-31 23:59:59.999+07'),
    ('4 1 Nov',     timestamptz '2026-11-01 00:00:00+07', timestamptz '2026-11-01 23:59:59.999+07')
  ) p(n, a, b)
  CROSS JOIN LATERAL (SELECT get_owner_dashboard_summary(p.a, p.b, NULL, 'all', NULL) AS val) od;

  -- Asersi baseline historis pra-migrasi (Agustus, September, & MITRA CILEUNGSI) tidak bergeser Rp 1 pun!
  IF EXISTS (
    SELECT 1 FROM _cek WHERE tahap = 'sebelum' AND periode = '1 Agustus'
      AND (owner_cogs IS DISTINCT FROM 1058015120
        OR owner_markup IS DISTINCT FROM 49227820
        OR mitra_cogs IS DISTINCT FROM 476464450
        OR cileungsi_cogs IS DISTINCT FROM 116157470)
  ) THEN
    RAISE EXCEPTION 'GAGAL: baseline Agustus bergeser dari pra-migrasi!';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _cek WHERE tahap = 'sebelum' AND periode = '2 September'
      AND (owner_cogs IS DISTINCT FROM 1012503112.52
        OR owner_markup IS DISTINCT FROM 47529928.57
        OR mitra_cogs IS DISTINCT FROM 522777566
        OR cileungsi_cogs IS DISTINCT FROM 139420304)
  ) THEN
    RAISE EXCEPTION 'GAGAL: baseline September bergeser dari pra-migrasi!';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _cek WHERE tahap = 'sebelum' AND periode = '3 Oktober'
      AND cileungsi_cogs IS DISTINCT FROM 125888199
  ) THEN
    RAISE EXCEPTION 'GAGAL: COGS Oktober MITRA CILEUNGSI bergeser dari 125888199!';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _cek WHERE tahap = 'sebelum' AND periode = '4 1 Nov'
      AND cileungsi_cogs IS DISTINCT FROM 5153912
  ) THEN
    RAISE EXCEPTION 'GAGAL: COGS 1 Nov MITRA CILEUNGSI bergeser dari 5153912!';
  END IF;

  -- Tulis 18 perubahan HPP per 2026-11-02 lewat RPC resmi ubah_hpp_menu
  SELECT jsonb_agg(jsonb_build_object('menu_id', menu_id, 'hpp_baru', hpp_baru)) INTO v_list FROM _rencana;
  SET LOCAL ROLE authenticated;
  FOR v_e IN SELECT * FROM jsonb_array_elements(v_list) LOOP
    PERFORM public.ubah_hpp_menu(
      (v_e->>'menu_id')::uuid,
      jsonb_build_object('hpp_override', (v_e->>'hpp_baru')::numeric),
      c_tgl,
      c_alasan
    );
  END LOOP;
  RESET ROLE;

  UPDATE public.menu_items
  SET updated_by = 'Admin Dev', updated_at = now()
  WHERE id IN (SELECT menu_id FROM _rencana);

  -- Sinkronisasi tampilan HPP Mitra di menu_outlet_prices:
  -- Cileungsi tetap round(base * 1.10); mitra lain memakai takeout OPEX = get_mitra_item_hpp(..., c_tgl, o.id)
  INSERT INTO public.menu_outlet_prices (menu_item_id, outlet_id, is_available, price, hpp_override, updated_by, updated_at)
  SELECT
    r.menu_id,
    o.id,
    true,
    NULL,
    public.get_mitra_item_hpp(r.menu_id, NULL, c_tgl, o.id),
    'Admin Dev',
    now()
  FROM _rencana r
  CROSS JOIN public.outlets o
  WHERE o.type = 'mitra'
  ON CONFLICT (menu_item_id, outlet_id) DO UPDATE
    SET hpp_override = EXCLUDED.hpp_override,
        updated_by = 'Admin Dev',
        updated_at = now();

  -- Sinkronkan pula baris menu_outlet_prices mitra lainnya yang sudah ada (topping, paket, reguler, BOGO)
  -- tanpa menyentuh price maupun is_available.
  UPDATE public.menu_outlet_prices mop
  SET hpp_override = public.get_mitra_item_hpp(mop.menu_item_id, NULL, c_tgl, mop.outlet_id),
      updated_by = 'Admin Dev',
      updated_at = now()
  FROM public.outlets o
  WHERE o.id = mop.outlet_id
    AND o.type = 'mitra'
    AND mop.hpp_override IS NOT NULL
    AND public.get_mitra_item_hpp(mop.menu_item_id, NULL, c_tgl, mop.outlet_id) > 0
    AND mop.hpp_override IS DISTINCT FROM public.get_mitra_item_hpp(mop.menu_item_id, NULL, c_tgl, mop.outlet_id);

  INSERT INTO _hasil
  SELECT
    r.nama,
    d.t,
    h.hpp_override,
    public.get_mitra_item_hpp(r.menu_id, NULL, d.t, NULL),
    public.get_mitra_item_hpp(r.menu_id, NULL, d.t, c_cileungsi),
    (h.channel_hpp->>'ss_online')::numeric
  FROM _rencana r
  CROSS JOIN (VALUES (DATE '2026-11-01'), (DATE '2026-11-02')) d(t)
  CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, d.t) h;

  -- Asersi pasca-input: 1 Nov = lama, 2 Nov = baru, menu_items = baru, SS Online tak berubah
  IF EXISTS (SELECT 1 FROM _rencana r CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-11-01') h
             WHERE h.hpp_override IS DISTINCT FROM r.hpp_lama) THEN
    RAISE EXCEPTION 'GAGAL: HPP 1 Nov ikut berubah';
  END IF;
  IF EXISTS (SELECT 1 FROM _rencana r CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-11-02') h
             WHERE h.hpp_override IS DISTINCT FROM r.hpp_baru) THEN
    RAISE EXCEPTION 'GAGAL: HPP 2 Nov tidak sama dengan angka baru';
  END IF;
  IF EXISTS (SELECT 1 FROM _rencana r JOIN menu_items m ON m.id = r.menu_id
             WHERE m.hpp_override IS DISTINCT FROM r.hpp_baru) THEN
    RAISE EXCEPTION 'GAGAL: menu_items.hpp_override belum angka baru';
  END IF;
  IF EXISTS (SELECT 1 FROM _rencana r
             CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-11-01') a
             CROSS JOIN LATERAL public.menu_hpp_pada(r.menu_id, DATE '2026-11-02') b
             WHERE a.channel_hpp IS DISTINCT FROM b.channel_hpp) THEN
    RAISE EXCEPTION 'GAGAL: HPP SS Online ikut berubah';
  END IF;

  INSERT INTO _cek
  SELECT
    'sesudah',
    p.n,
    (od.val ->> 'total_cogs')::numeric,
    (od.val ->> 'total_mitra_markup')::numeric,
    COALESCE((SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b)), 0),
    COALESCE((SELECT sum(cogs) FROM get_mitra_orders_summary(ARRAY[c_cileungsi], p.a, p.b)), 0)
  FROM (VALUES
    ('1 Agustus',   timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
    ('2 September', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-30 23:59:59.999+07'),
    ('3 Oktober',   timestamptz '2026-10-01 00:00:00+07', timestamptz '2026-10-31 23:59:59.999+07'),
    ('4 1 Nov',     timestamptz '2026-11-01 00:00:00+07', timestamptz '2026-11-01 23:59:59.999+07')
  ) p(n, a, b)
  CROSS JOIN LATERAL (SELECT get_owner_dashboard_summary(p.a, p.b, NULL, 'all', NULL) AS val) od;

  -- Asersi: input HPP tanggal 2 Nov TIDAK boleh menggeser angka 1 Agu s/d 1 Nov sedikit pun!
  IF EXISTS (
    SELECT 1 FROM _cek s
    JOIN _cek b ON b.periode = s.periode AND b.tahap = 'sebelum'
    WHERE s.tahap = 'sesudah'
      AND (s.owner_cogs IS DISTINCT FROM b.owner_cogs
        OR s.owner_markup IS DISTINCT FROM b.owner_markup
        OR s.mitra_cogs IS DISTINCT FROM b.mitra_cogs
        OR s.cileungsi_cogs IS DISTINCT FROM b.cileungsi_cogs)
  ) THEN
    RAISE EXCEPTION 'GAGAL: COGS sebelum 2 Nov ikut berubah saat input 2 Nov!';
  END IF;
END $$;

COMMIT;

SELECT jsonb_build_object(
  'cek', (SELECT jsonb_agg(row_to_json(c) ORDER BY c.periode, c.tahap) FROM _cek c),
  'hasil', (SELECT jsonb_agg(row_to_json(h) ORDER BY h.menu, h.tgl) FROM _hasil h)
) AS hasil_eksekusi;
