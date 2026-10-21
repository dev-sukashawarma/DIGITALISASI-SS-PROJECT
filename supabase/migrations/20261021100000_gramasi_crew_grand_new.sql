-- =============================================================================
-- 20261021100000_gramasi_crew_grand_new.sql
-- =============================================================================
-- Sumber: "HPP GRAND NEW (Sedang-Besar-Jumbo).xlsx", tab GRAMASI CREW
-- (diterima owner 2026-10-21). Jawaban owner atas selisih yang ditanyakan:
--   1. Lettuce Original Ayam Besar tetap 65 g (angka 30 di Excel salah ketik).
--   2. Original Mix Jumbo tetap ayam 80 / sapi 105 (Excel menukar keduanya).
--   3. Suka Sosis: menu & bahan SOSIS belum ada — TIDAK di migration ini.
--   4. Minyak, foil, plastik, paper wrap: tetap angka DB (Excel menulis
--      "porsi"/"pcs", stok dipotong per gram/cm).
--   5. Menu "Voucher Pamulang 10%" dihapus dari penjualan -> dinonaktifkan,
--      BUKAN DELETE: 29 baris order_items merujuknya (terakhir 17 Okt) dan
--      DELETE meng-CASCADE riwayat HPP (pelajaran Shawarmie, Sep 2026).
--      Resepnya dibiarkan aktif agar order susulan (antrean offline) tetap
--      memotong stok.
--   6. Gramasi = berat matang; HPP di Excel sudah memakai harga matang.
--   7. GAS dikeluarkan dari BOM (owner 2026-10-21): baris GAS 3Kg dibuang
--      dari SEMUA resep aktif (39 baris: 27 global termasuk Online/Reguler/
--      BOGO/Best Seller + 12 salinan Voucher Pamulang). Sesudah ini stok gas
--      outlet hanya bergerak lewat kiriman & opname; pemakaiannya terlihat
--      sebagai selisih opname. GAS 12 KG tidak dipakai resep mana pun.
--
-- Pemetaan nama Excel -> bahan_baku: LETUCE -> "Sayur (lettuce)",
-- SAUS CABE -> SAOS CABE, SAUS TOMAT -> SAOS TOMAT POUCH, TORTILA -> KULIT,
-- KEJU SLICE -> KEJU, PLASTIK -> PLASTIK MERAH.
--
-- Hanya resep GLOBAL yang disentuh (dirujuk lewat id). Suka Chicken sudah
-- sama persis dengan Excel. Best Seller (Mix Jumbo), Best Seller 2, menu
-- Online, Reguler & BOGO tidak ada di Excel -> tidak disentuh. Paket ikut
-- otomatis karena BOM menguraikan komponennya.
--
-- Setiap baris memeriksa nilai lama: kalau resep sudah berubah sejak dicek
-- (2026-10-21), migration gagal dan tidak ada yang tertulis.
--
-- Berlaku ke depan saja. Ledger historis tidak disentuh (opname rutin sudah
-- menyerap, pola sama dengan 20261019100000 Extra Keju).
-- =============================================================================
BEGIN;

CREATE TEMP TABLE _gramasi (resep_id uuid, menu text, bahan text, qty_lama numeric, qty_baru numeric) ON COMMIT DROP;
INSERT INTO _gramasi VALUES
  -- UKURAN 25 (SEDANG)
  ('5cb47d83-8f41-4299-b42d-eb2d1cc105f4', 'Original Sapi Sedang', 'KENTANG',          45, 40),
  ('5cb47d83-8f41-4299-b42d-eb2d1cc105f4', 'Original Sapi Sedang', 'Sayur (lettuce)',  60, 50),
  ('5cb47d83-8f41-4299-b42d-eb2d1cc105f4', 'Original Sapi Sedang', 'TUM',              10, 15),
  ('5cb47d83-8f41-4299-b42d-eb2d1cc105f4', 'Original Sapi Sedang', 'MAYONAISE',        50, 25),
  ('8091c1ef-222e-4ea5-ad43-5d3b0a7d5155', 'Original Ayam Sedang', 'Sayur (lettuce)',  60, 50),
  ('8091c1ef-222e-4ea5-ad43-5d3b0a7d5155', 'Original Ayam Sedang', 'TUM',              10, 15),
  ('8091c1ef-222e-4ea5-ad43-5d3b0a7d5155', 'Original Ayam Sedang', 'MAYONAISE',        50, 25),
  ('d12d5e03-98da-4f29-b24f-3a9933a3b974', 'Suka Beef',            'TUM',              10, 15),
  ('dc79f116-b807-44cd-81f1-9b898124b4c4', 'Suka Fried Chicken',   'KENTANG',          60, 50),
  ('dc79f116-b807-44cd-81f1-9b898124b4c4', 'Suka Fried Chicken',   'Sayur (lettuce)',  60, 40),
  ('6b2207e3-a5ba-4b41-bef9-d62a07712227', 'Suka Samyang',         'KENTANG',          60, 50),
  ('6b2207e3-a5ba-4b41-bef9-d62a07712227', 'Suka Samyang',         'Sayur (lettuce)',  60, 40),
  ('6b2207e3-a5ba-4b41-bef9-d62a07712227', 'Suka Samyang',         'SAOS CABE',        30, 25),
  -- UKURAN 28 (BESAR)
  ('deb85b05-b644-4abe-be52-b3fe44ee399f', 'Original Sapi Besar',  'Sayur (lettuce)',  70, 65),
  ('deb85b05-b644-4abe-be52-b3fe44ee399f', 'Original Sapi Besar',  'TUM',              15, 20),
  ('deb85b05-b644-4abe-be52-b3fe44ee399f', 'Original Sapi Besar',  'MAYONAISE',        50, 30),
  ('20d87fca-d81b-41d2-a283-baa3e666ddd6', 'Original Ayam Besar',  'TUM',              15, 20),
  ('20d87fca-d81b-41d2-a283-baa3e666ddd6', 'Original Ayam Besar',  'MAYONAISE',        35, 30),
  ('7dbc269a-e16a-4419-89e5-7fd1324c0e64', 'Original Mix Besar',   'Sayur (lettuce)',  70, 60),
  ('7dbc269a-e16a-4419-89e5-7fd1324c0e64', 'Original Mix Besar',   'TUM',              15, 20),
  ('7dbc269a-e16a-4419-89e5-7fd1324c0e64', 'Original Mix Besar',   'MAYONAISE',        50, 30),
  -- UKURAN 32 (JUMBO)
  ('e3dca54f-36df-47b1-a321-28f465f12534', 'Original Sapi Jumbo',  'Sayur (lettuce)',  80, 90),
  ('e3dca54f-36df-47b1-a321-28f465f12534', 'Original Sapi Jumbo',  'TUM',              20, 30),
  ('e3dca54f-36df-47b1-a321-28f465f12534', 'Original Sapi Jumbo',  'MAYONAISE',        60, 35),
  ('82ea21fb-7659-44ba-8893-780e0efdbe9e', 'Original Ayam Jumbo',  'Sayur (lettuce)',  80, 90),
  ('82ea21fb-7659-44ba-8893-780e0efdbe9e', 'Original Ayam Jumbo',  'TUM',              20, 30),
  ('82ea21fb-7659-44ba-8893-780e0efdbe9e', 'Original Ayam Jumbo',  'MAYONAISE',        40, 35),
  ('60d1dc68-d010-4435-8417-07c36ea5a248', 'Original Mix Jumbo',   'Sayur (lettuce)',  80, 90),
  ('60d1dc68-d010-4435-8417-07c36ea5a248', 'Original Mix Jumbo',   'TUM',              20, 30),
  ('60d1dc68-d010-4435-8417-07c36ea5a248', 'Original Mix Jumbo',   'MAYONAISE',        60, 35);

DO $$
DECLARE v_n int;
BEGIN
  -- Resep yang dirujuk harus resep global aktif milik menu yang namanya cocok.
  SELECT count(DISTINCT g.resep_id) INTO v_n
    FROM _gramasi g
    JOIN public.resep r ON r.id = g.resep_id AND r.is_active AND r.scope = 'global'
    JOIN public.menu_items m ON m.id::text = r.menu_item_ref AND m.name = g.menu;
  IF v_n <> 11 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: resep global yang cocok = % (harap 11)', v_n;
  END IF;

  UPDATE public.resep_item ri
     SET qty_per_porsi = g.qty_baru
    FROM _gramasi g
    JOIN public.bahan_baku b ON b.nama = g.bahan AND b.is_active
   WHERE ri.resep_id = g.resep_id
     AND ri.bahan_baku_id = b.id
     AND ri.qty_per_porsi = g.qty_lama;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 30 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris resep yang diubah = % (harap 30)', v_n;
  END IF;

  -- Suka Samyang: tambah TUM 10 g, buang SAOS TOMAT POUCH (Excel: tanpa saus tomat).
  IF EXISTS (SELECT 1 FROM public.resep_item ri JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              WHERE ri.resep_id = '6b2207e3-a5ba-4b41-bef9-d62a07712227' AND b.nama = 'TUM') THEN
    RAISE EXCEPTION 'ASERSI GAGAL: Suka Samyang sudah punya baris TUM';
  END IF;
  INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
  SELECT '6b2207e3-a5ba-4b41-bef9-d62a07712227', b.id, 10, 'gram'
    FROM public.bahan_baku b WHERE b.nama = 'TUM' AND b.is_active;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris TUM Suka Samyang yang ditambah = % (harap 1)', v_n;
  END IF;

  DELETE FROM public.resep_item ri
   USING public.bahan_baku b
   WHERE ri.bahan_baku_id = b.id
     AND ri.resep_id = '6b2207e3-a5ba-4b41-bef9-d62a07712227'
     AND b.nama = 'SAOS TOMAT POUCH'
     AND ri.qty_per_porsi = 30;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris SAOS TOMAT POUCH Suka Samyang yang dibuang = % (harap 1)', v_n;
  END IF;

  -- GAS keluar dari BOM: semua baris GAS 3Kg di resep aktif.
  DELETE FROM public.resep_item ri
   USING public.bahan_baku b, public.resep r
   WHERE ri.bahan_baku_id = b.id
     AND ri.resep_id = r.id
     AND r.is_active
     AND b.nama = 'GAS 3Kg';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 39 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris GAS 3Kg yang dibuang = % (harap 39)', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.resep_item ri JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              JOIN public.resep r ON r.id = ri.resep_id
              WHERE r.is_active AND b.nama ILIKE '%gas%') THEN
    RAISE EXCEPTION 'ASERSI GAGAL: masih ada bahan gas di resep aktif';
  END IF;

  -- Menu "Voucher Pamulang 10%": dinonaktifkan (sama dengan tombol Nonaktifkan
  -- di admin-dashboard: is_available, is_available_online, tampil_di_app).
  UPDATE public.menu_items m
     SET is_available = false, is_available_online = false, tampil_di_app = false
    FROM public.resep r
   WHERE r.menu_item_ref = m.id::text
     AND r.scope = 'outlet'
     AND r.nama ILIKE '%(Voucher Pamulang 10\%)%'
     AND m.is_available;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 12 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: menu Voucher Pamulang yang dinonaktifkan = % (harap 12)', v_n;
  END IF;
END $$;

COMMIT;
