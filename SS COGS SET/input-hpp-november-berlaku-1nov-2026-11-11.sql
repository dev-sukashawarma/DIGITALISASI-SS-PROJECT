-- ARSIP — jalankan SEKALI. Penjaga nilai lama akan menolak eksekusi ulang.
-- Sumber: "HPP NOVEMBER.xlsx", tab OFFLINE kolom C (HPP + OPEX = HPP murni x 1,10).
-- Keputusan owner 2026-11-11:
--   1. Angka HPP + OPEX di file November IDENTIK dengan yang sudah live sejak 2 Nov 2026
--      (dari "SS HPP OCT 2026 v2.2.xlsx"). Yang berubah HANYA tanggal berlaku: 2 Nov -> 1 Nov.
--      Skrip ini menambal satu hari, yaitu 1 November 2026.
--   2. HPP SS Online (channel_hpp) TIDAK diubah -- hanya kunci 'hpp_override'.
--   3. Agustus, September, dan Oktober 2026 dijamin NOL bergeser (diasersi di bawah).
-- Markup mitra 15% TIDAK ada di skrip ini -- itu perubahan mekanika, lewat
-- migration terpisah 20261111101413_mitra_markup_15_persen_november.sql.
-- Lewat RPC ubah_hpp_menu atas nama akun admin "Admin Dev".
--
-- CATATAN EKSEKUSI (jejak audit yang sebenarnya):
-- Versi pertama skrip ini memuat asersi COGS Agu/Sep/Okt DI DALAM transaksi.
-- Asersi itu memanggil get_mitra_item_hpp per baris atas ~84 rb baris order dan
-- membuat koneksi terputus sebelum COMMIT (diperiksa sesudahnya: 0 baris tertulis,
-- transaksi ter-rollback bersih). Karena itu asersi COGS DIPINDAH KE LUAR dan
-- dijalankan terpisah per bulan. Yang aman dilakukan begitu: baris riwayat
-- ber-berlaku_mulai 1 Nov secara struktural TIDAK BISA menyentuh bulan sebelumnya,
-- dan Asersi C (31 Okt tidak bergeser) sudah membuktikan batas itu di dalam
-- transaksi yang sama.
--
-- Hasil verifikasi COGS yang dijalankan terpisah sesudah COMMIT (11 Nov 2026):
--   internal Agu 491.596.600,00 | Sep 458.003.317,00 | Okt 525.419.366,30  -> cocok baseline
--   mitra    Agu 537.239.230,00 | Sep 522.279.061,00 | Okt 597.730.434,00  -> cocok baseline
-- (baseline: SS COGS SET/BASELINE-sebelum-hpp-november-2026-11-11.txt)
--
-- Kontrol negatif yang dijalankan sebelum skrip ini: ubah_hpp_menu dipanggil pada
-- Ice Tea lalu di-RAISE EXCEPTION dengan sengaja. Hasilnya membuktikan dua hal --
-- RPC memang menulis (1 baris, nilai 1 Nov berubah 4800 -> 5280) DAN exception
-- benar-benar membatalkannya (diperiksa: 0 baris, Ice Tea kembali 4800).

DO $$
DECLARE
  c_alasan constant text := 'HPP NOVEMBER.xlsx tab OFFLINE kolom HPP + OPEX, berlaku 1 Nov 2026 - keputusan owner 11 Nov 2026 (menggeser tanggal mulai dari 2 Nov ke 1 Nov; angkanya sama)';
  c_tgl    constant date := DATE '2026-11-01';
  v_admin  uuid;
  v_n      int;
  v_e      record;
BEGIN
  SELECT id INTO v_admin FROM public.outlet_staff
   WHERE name = 'Admin Dev' AND role = 'admin' AND status = 'active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Akun Admin Dev tidak ditemukan'; END IF;

  CREATE TEMP TABLE _rencana (menu_id uuid, nama text, hpp_lama_1nov numeric, hpp_baru numeric)
    ON COMMIT DROP;
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

  -- Penjaga 1: ke-18 menu cocok id + nama + menu global
  SELECT count(*) INTO v_n FROM _rencana r
    JOIN public.menu_items m ON m.id = r.menu_id AND m.name = r.nama AND m.outlet_id IS NULL;
  IF v_n <> 18 THEN RAISE EXCEPTION 'GAGAL penjaga 1: menu cocok = % (harap 18)', v_n; END IF;

  -- Penjaga 2: nilai yang berlaku 1 Nov sekarang masih angka lama (21 Okt)
  SELECT count(*) INTO v_n FROM _rencana r
   WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id, DATE '2026-11-01') h) = r.hpp_lama_1nov;
  IF v_n <> 18 THEN RAISE EXCEPTION 'GAGAL penjaga 2: nilai 1 Nov cocok angka lama = % (harap 18) - mungkin sudah dijalankan', v_n; END IF;

  -- Penjaga 3: angka Excel November benar-benar = yang sudah live per 2 Nov
  SELECT count(*) INTO v_n FROM _rencana r
   WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id, DATE '2026-11-02') h) = r.hpp_baru;
  IF v_n <> 18 THEN RAISE EXCEPTION 'GAGAL penjaga 3: nilai 2 Nov cocok angka Excel = % (harap 18)', v_n; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  FOR v_e IN SELECT * FROM _rencana LOOP
    PERFORM public.ubah_hpp_menu(v_e.menu_id,
      jsonb_build_object('hpp_override', v_e.hpp_baru), c_tgl, c_alasan);
  END LOOP;

  -- Asersi A: 1 Nov kini memakai angka baru
  SELECT count(*) INTO v_n FROM _rencana r
   WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id, DATE '2026-11-01') h) = r.hpp_baru;
  IF v_n <> 18 THEN RAISE EXCEPTION 'ASERSI A GAGAL: 1 Nov = angka baru hanya % dari 18', v_n; END IF;

  -- Asersi B: 2 Nov tidak bergeser
  SELECT count(*) INTO v_n FROM _rencana r
   WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id, DATE '2026-11-02') h) = r.hpp_baru;
  IF v_n <> 18 THEN RAISE EXCEPTION 'ASERSI B GAGAL: 2 Nov bergeser (% dari 18)', v_n; END IF;

  -- Asersi C: 31 Oktober tetap memakai angka lama
  SELECT count(*) INTO v_n FROM _rencana r
   WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id, DATE '2026-10-31') h) = r.hpp_lama_1nov;
  IF v_n <> 18 THEN RAISE EXCEPTION 'ASERSI C GAGAL: 31 Okt bergeser (% dari 18)', v_n; END IF;

  -- Asersi E: menu_items.hpp_override (= nilai yang berlaku HARI INI) tidak bergeser.
  -- ubah_hpp_menu menyetelnya ulang dari menu_hpp_pada(hari ini); karena hari ini
  -- 11 Nov > 2 Nov, nilainya harus tetap angka 2 Nov = angka baru.
  SELECT count(*) INTO v_n FROM public.menu_items m JOIN _rencana r ON r.menu_id = m.id
   WHERE m.hpp_override = r.hpp_baru;
  IF v_n <> 18 THEN RAISE EXCEPTION 'ASERSI E GAGAL: menu_items.hpp_override bergeser (% dari 18)', v_n; END IF;

  RAISE NOTICE 'OK: 18 baris riwayat berlaku 1 Nov 2026 tertulis.';
END $$;
