-- 20260910231000_balikkan_adjustment_ganda_waste_sapi_empang.sql
--
-- Membalikkan koreksi stok GANDA yang lahir dari migration 20260910230000.
--
-- ============================================================================
-- APA YANG TERJADI
-- ============================================================================
--
-- 20260910230000 meralat qty laporan waste SAPI Empang 1504 -> 1,5 Blok, dengan
-- niat memperbaiki LAPORAN saja; ledger sengaja tidak disentuh karena stoknya
-- sudah dipulihkan `opname_selisih` malam 9 September (saldo 11,96 Blok, wajar).
--
-- Yang tidak diketahui saat itu: tabel `stok_waste_reports` punya trigger
-- `trg_sync_waste_ledger` -> `sync_waste_ledger()`. Begitu qty laporan yang
-- sudah APPROVED berubah, ia OTOMATIS menulis `adjustment` sebesar selisihnya,
-- mengembalikan barang yang batal jadi waste:
--
--   2026-09-10 20:42:20 · adjustment +3.005.000 g (+1.502,50 Blok)
--   catatan: "Koreksi waste: Basi / Expired (qty jadi 1.5)"
--
-- Perilaku trigger itu BENAR untuk kasus normal -- waste dibatalkan, barang
-- kembali. Tapi di sini stoknya sudah dikembalikan lebih dulu oleh opname, jadi
-- hasilnya koreksi ganda: saldo melonjak 11,96 -> 1.514,43 Blok (3 ton hantu).
--
-- ============================================================================
-- KENAPA MEMBALIK, BUKAN MENARIK RALAT qty-NYA
-- ============================================================================
--
-- Mengembalikan qty ke 1504 akan memicu trigger yang sama ke arah sebaliknya
-- dan memulihkan angka waste Rp 150,4 juta yang palsu di Laba Bersih. Ralat
-- laporannya benar dan harus bertahan; yang perlu dinetralkan hanya efek
-- sampingnya di stok.
--
-- Nilai pembalik SAMA PERSIS dengan yang ditulis trigger (-3.005.000 g), bukan
-- "target dikurangi saldo" -- penjualan terus berjalan tiap menit, jadi angka
-- target akan basi sebelum sempat diterapkan.
--
-- ============================================================================
-- PELAJARAN
-- ============================================================================
--
-- Asersi di 20260910230000 memeriksa `saldo < 0`. Saldo justru melonjak ke
-- ANGKA POSITIF yang mustahil, jadi asersinya lolos padahal kerusakannya nyata.
-- **Penjaga kewajaran harus berbatas dua sisi**, bukan cuma menahan yang minus.
--
-- Dan sebelum meng-UPDATE tabel produksi mana pun: `SELECT tgname FROM
-- pg_trigger WHERE tgrelid = '<tabel>'::regclass AND NOT tgisinternal` --
-- memperbaiki satu kolom bisa menggerakkan tabel lain lewat trigger.

INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT o.id, b.id, 'adjustment', -3005000,
       'Netralkan koreksi ganda: stok SAPI Empang sudah dipulihkan opname '
       || '9 Sep, lalu trg_sync_waste_ledger menambahkannya lagi saat qty '
       || 'laporan waste diralat (lihat migration 20260910231000)'
  FROM public.outlets o, public.bahan_baku b
 WHERE o.name ILIKE '%EMPANG%' AND b.nama = 'SAPI'
   -- Idempoten: hanya jalan kalau pembalikannya belum pernah ditulis.
   AND NOT EXISTS (
     SELECT 1 FROM public.ledger_stok l
      WHERE l.outlet_id = o.id AND l.bahan_baku_id = b.id
        AND l.tipe = 'adjustment' AND l.qty = -3005000
        AND l.catatan LIKE 'Netralkan koreksi ganda%')
   -- Jangan jalan kalau adjustment penyebabnya memang tak ada.
   AND EXISTS (
     SELECT 1 FROM public.ledger_stok l
      WHERE l.outlet_id = o.id AND l.bahan_baku_id = b.id
        AND l.tipe = 'adjustment' AND l.qty = 3005000);

-- Asersi berbatas DUA SISI -- pelajaran dari kegagalan migration sebelumnya.
DO $$
DECLARE
  v_blok numeric;
  v_qty  numeric;
BEGIN
  SELECT sb.saldo / 2000 INTO v_blok
    FROM public.stok_balance sb
    JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
    JOIN public.outlets o ON o.id = sb.outlet_id
   WHERE b.nama = 'SAPI' AND o.name ILIKE '%EMPANG%';

  IF v_blok IS NULL THEN
    RAISE EXCEPTION 'Saldo SAPI Empang tidak ditemukan';
  END IF;
  IF v_blok < 0 THEN
    RAISE EXCEPTION 'Saldo SAPI Empang minus: % Blok', round(v_blok, 2);
  END IF;
  IF v_blok > 60 THEN
    RAISE EXCEPTION 'Saldo SAPI Empang % Blok -- masih mustahil, batas wajar 60', round(v_blok, 2);
  END IF;

  -- Ralat laporannya harus TETAP bertahan.
  SELECT qty INTO v_qty FROM public.stok_waste_reports
   WHERE id = 'a23156e6-82df-46ec-a91b-c091bcef0fe0';
  IF v_qty IS DISTINCT FROM 1.5 THEN
    RAISE EXCEPTION 'qty laporan waste berubah jadi % -- ralat 1,5 hilang', v_qty;
  END IF;
END $$;

-- DOWN:
-- DELETE FROM public.ledger_stok
--  WHERE tipe = 'adjustment' AND qty = -3005000
--    AND catatan LIKE 'Netralkan koreksi ganda%';
