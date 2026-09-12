-- 20260912120000_baseline_saldo_vendor_gudang.sql
--
-- TITIK AWAL saldo per vendor Gudang Pusat — hasil hitung fisik owner,
-- 2026-09-12. Ini yang MENYALAKAN penjaga: sejak baris `hitung_fisik` ada,
-- `bahan_vendor_aktif()` true dan pengiriman yang melebihi sisa vendor ditolak
-- `sj_vendor_on_dikirim`.
--
-- Normalnya hitungan ini masuk lewat form opname Gudang Pusat (Task 8), tapi
-- aplikasinya belum ter-deploy sementara owner sudah menghitung fisik. Jadi
-- baseline ditulis sekali lewat migration ini; opname berikutnya memakai jalur
-- normal.
--
-- ============================================================================
-- ANGKA DARI OWNER (apa adanya, beserta satuan yang dia pakai)
-- ============================================================================
--   SAPI            Pak Aziz 14 Blok      · Djafafood 0
--   FOIL            Ekadharma 424 Roll    · Altindo 0
--   MAYONAISE       Toko Zein 128 Dus     · Indoboga 0
--   SAOS SAMYANG    Toko Zein 152 Pack    · Indoboga 0      (1 pack = 250 g)
--   SAOS TOMAT PCH  Toko Zein 68 Dus      · Indoboga 0
--   KENTANG         Agro Boga 540 Kg      · Indoboga 0
--   BAWANG          Family 16 Kg          · Bapak Marwan 0
--   KETUMBAR        Family 63 Kg          · Bapak Marwan 0
--   JINTEN          Family 7 Kg           · Bapak Marwan 0
--   KUNYIT          Family 2 Dus 21 sachet· Bapak Marwan 0
--   MINYAK          Family 9 Kompan       · Bapak Marwan 0
--   PLASTIK MERAH   Pak Aji 104 Pack      · Dunia Plastik 0
--   POLYBAG         Pak Aji 5 Pack        · Dunia Plastik 0
--   VACUUM JUMBO    sultanpacking 42 Roll · Dunia Plastik 0
--
-- Vendor berangka 0 dikonfirmasi owner "lagi kosong" — BUKAN "belum dihitung".
-- Bedanya penting: aturan "semua atau kosong" menuntut tiap vendor punya angka.
--
-- ============================================================================
-- KONVERSI: kalikan dulu, baru bagi
-- ============================================================================
-- Angka disimpan dalam skala ledger Gudang Pusat. Alih-alih mengubah hitungan
-- owner ke satuan besar (424/48 = 8,8333… yang harus dibulatkan), tiap baris
-- memberi pembilang & penyebut, lalu:
--     qty = to_ledger_scale(gudang, bahan, 1) * n / d
-- Penyebutnya selalu faktor yang membagi habis (48 roll/Dus, 20 pack/Dus,
-- 432 sachet/Dus, 25 kg/Bal, dst), jadi hasilnya bulat eksak.
--
-- Nilainya ditulis sebagai DELTA terhadap sisa yang sudah ada
-- (`target - sisa_vendor_gudang`), bukan angka mati — kalau trigger PO sempat
-- menulis mutasi lebih dulu, hasil akhirnya tetap sama dengan hitungan fisik.

SET lock_timeout = '5s';

DO $$
DECLARE
  v_g uuid := public.gudang_pusat_id();
  r record;
  v_bahan uuid;
  v_vendor uuid;
  v_skala numeric;
  v_target numeric;
  v_sisa numeric;
  v_n int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('SAPI',                 'Djafafood%',              0,   1),
      ('SAPI',                 'Lettuce (Pak Aziz)%',    14,   1),
      ('FOIL',                 'PT Altindo Mulia',        0,   1),
      ('FOIL',                 'Ekadharma%',            424,  48),
      ('MAYONAISE',            'Indoboga%',               0,   1),
      ('MAYONAISE',            'Toko Zein',             128,   1),
      ('SAOS SAMYANG',         'Indoboga%',               0,   1),
      ('SAOS SAMYANG',         'Toko Zein',             152,  20),
      ('SAOS TOMAT POUCH',     'Indoboga%',               0,   1),
      ('SAOS TOMAT POUCH',     'Toko Zein',              68,   1),
      ('KENTANG',              'Indoboga%',               0,   1),
      ('KENTANG',              'PT Agro Boga Utama',    540,  10),
      ('BAWANG',               'Bapak Marwan',            0,   1),
      ('BAWANG',               'Family Suplayer',        16,  20),
      ('KETUMBAR',             'Bapak Marwan',            0,   1),
      ('KETUMBAR',             'Family Suplayer',        63,  25),
      ('JINTEN',               'Bapak Marwan',            0,   1),
      ('JINTEN',               'Family Suplayer',         7,   1),
      ('KUNYIT',               'Bapak Marwan',            0,   1),
      ('KUNYIT',               'Family Suplayer',       885, 432),
      ('MINYAK',               'Bapak Marwan',            0,   1),
      ('MINYAK',               'Family Suplayer',         9,   1),
      ('PLASTIK MERAH',        'Dunia Plastik Depok',     0,   1),
      ('PLASTIK MERAH',        'Pak Aji',               104,   1),
      ('POLYBAG',              'Dunia Plastik Depok',     0,   1),
      ('POLYBAG',              'Pak Aji',                 5,   1),
      ('PLASTIK VACUUM JUMBO', 'Dunia Plastik Depok',     0,   1),
      ('PLASTIK VACUUM JUMBO', 'sultanpacking',          42,   1)
    ) AS t(bahan, vendor_like, n, d)
  LOOP
    SELECT id INTO v_bahan FROM public.bahan_baku
     WHERE nama = r.bahan AND is_active;
    IF v_bahan IS NULL THEN
      RAISE EXCEPTION 'Bahan % tidak ditemukan / tidak aktif', r.bahan;
    END IF;

    SELECT public.vendor_induk(s.id) INTO v_vendor
      FROM public.supplier s
     WHERE s.nama LIKE r.vendor_like AND COALESCE(s.is_active, true)
     ORDER BY s.nama
     LIMIT 1;
    IF v_vendor IS NULL THEN
      RAISE EXCEPTION 'Vendor % tidak ditemukan (bahan %)', r.vendor_like, r.bahan;
    END IF;

    -- Vendor itu harus memang vendor bahan ini, kalau tidak baseline-nya salah alamat.
    IF NOT EXISTS (SELECT 1 FROM public.vendor_bahan(v_bahan) v WHERE v = v_vendor) THEN
      RAISE EXCEPTION 'Vendor % bukan vendor aktif bahan %', r.vendor_like, r.bahan;
    END IF;

    v_skala := public.to_ledger_scale(v_g, v_bahan, 1);
    IF COALESCE(v_skala, 0) = 0 THEN
      RAISE EXCEPTION 'Skala ledger bahan % nol/NULL', r.bahan;
    END IF;

    v_target := (v_skala * r.n) / r.d;                       -- kalikan dulu, baru bagi
    v_sisa   := public.sisa_vendor_gudang(v_bahan, v_vendor);

    IF v_target <> v_sisa THEN
      INSERT INTO public.stok_vendor_gudang_mutasi
        (bahan_baku_id, vendor_id, qty, sumber, catatan, dibuat_oleh)
      VALUES (v_bahan, v_vendor, v_target - v_sisa, 'hitung_fisik',
              'Baseline hitung fisik per vendor 2026-09-12 (owner)', NULL);
      v_n := v_n + 1;
    END IF;

    -- Asersi per baris: sisa akhir HARUS sama dengan hitungan fisik.
    IF public.sisa_vendor_gudang(v_bahan, v_vendor) <> v_target THEN
      RAISE EXCEPTION 'Gagal set % / %: sisa % bukan %',
        r.bahan, r.vendor_like, public.sisa_vendor_gudang(v_bahan, v_vendor), v_target;
    END IF;
  END LOOP;

  -- Semua bahan multi-vendor aktif WAJIB punya titik awal sesudah ini —
  -- kalau ada yang terlewat, penjaganya diam untuk bahan itu tanpa ketahuan.
  IF EXISTS (
    SELECT 1 FROM public.bahan_baku b
     WHERE b.is_active AND public.bahan_multi_vendor(b.id)
       AND NOT public.bahan_vendor_aktif(b.id)
  ) THEN
    RAISE EXCEPTION 'Masih ada bahan multi-vendor tanpa titik awal: %',
      (SELECT string_agg(b.nama, ', ') FROM public.bahan_baku b
        WHERE b.is_active AND public.bahan_multi_vendor(b.id)
          AND NOT public.bahan_vendor_aktif(b.id));
  END IF;

  RAISE NOTICE 'Baseline ditulis: % baris mutasi', v_n;
END $$;

-- DOWN:
-- DELETE FROM public.stok_vendor_gudang_mutasi
--  WHERE sumber = 'hitung_fisik'
--    AND catatan = 'Baseline hitung fisik per vendor 2026-09-12 (owner)';
