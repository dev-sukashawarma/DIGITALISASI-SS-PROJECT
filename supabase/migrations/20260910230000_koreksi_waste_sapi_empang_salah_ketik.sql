-- 20260910230000_koreksi_waste_sapi_empang_salah_ketik.sql
--
-- Koreksi satu laporan waste yang salah ketik jumlah.
--
-- ============================================================================
-- KEJADIANNYA
-- ============================================================================
--
--   2026-09-09 14:54 WIB · SUKA SHAWARMA EMPANG · SAPI
--   Dilaporkan Agung Wardhana: 1504 Blok · alasan "Basi / Expired"
--   Disetujui Abu Bakar -> APPROVED
--
-- 1504 Blok = 3.008 kg daging sapi. Di satu outlet, dalam sehari.
--
-- Dikonfirmasi pelapor (diteruskan owner 2026-09-10):
--   "sorry ini tolong di rubah salah masukin jumlah, harusnya 1 1/2 blok atau 3kg"
--
-- Jadi yang benar 1,5 Blok (= 3 kg, karena 1 Blok = 2 kg). Angka 1504 lahir dari
-- "1,5" yang tertulis tanpa pemisah desimal.
--
-- ============================================================================
-- KERUSAKANNYA: LAPORAN, BUKAN STOK
-- ============================================================================
--
-- Persetujuan itu menulis ledger `waste` -3.008.000 g, dan saldo SAPI Empang
-- terjun ke -1.482 Blok. Malam itu juga crew opname, menghitung 14 Blok (angka
-- normal), dan `opname_selisih` menariknya kembali.
--
--   Saldo SAPI Empang saat migration ini ditulis: 11,96 Blok -- WAJAR.
--
-- ⚠️ MAKA LEDGER SENGAJA TIDAK DISENTUH. Baris `waste` -1504 Blok dan
--    `opname_selisih` +1496 Blok sudah saling meniadakan sampai ke hitungan
--    fisik. Menambah `adjustment` pembalik sekarang = mengoreksi dua kali,
--    dan stok Empang justru jadi salah. Keduanya juga jejak audit: mereka
--    merekam apa yang BENAR-BENAR terjadi (salah input, lalu diperbaiki opname).
--
-- Yang belum pulih hanyalah LAPORANNYA. `get_waste_periode` membaca
-- `stok_waste_reports` (bukan ledger), dan angkanya masuk ke Laba Bersih:
--
--   Waste September (APPROVED, outlet operasional)  Rp 152.862.040
--     dari baris ini saja                           Rp 150.400.000  (98,4%)
--     seluruh sisanya, 19 outlet 10 hari            Rp   2.462.040
--
-- Diperiksa: NOL view menilai ledger bertipe 'waste'. Hanya
-- `stok_waste_reports` yang menyuplai laporan waste & laba, jadi memperbaiki
-- satu kolom ini memperbaiki seluruh rantainya.
--
-- ============================================================================
-- KENAPA qty DIRALAT, BUKAN STATUS DIJADIKAN REJECTED
-- ============================================================================
--
-- Wastenya NYATA terjadi -- 1,5 Blok memang basi. Menolaknya akan menghapus
-- kejadian yang benar. Yang salah cuma angkanya.
--
-- Lingkup dijaga tiga lapis: id eksplisit + qty masih 1504 + status APPROVED.
-- Menjalankannya dua kali tidak mengubah apa pun.

UPDATE public.stok_waste_reports
   SET qty = 1.5,
       updated_at = now()
 WHERE id = 'a23156e6-82df-46ec-a91b-c091bcef0fe0'
   AND qty = 1504
   AND status = 'APPROVED';

-- Asersi + kontrol positif.
DO $$
DECLARE
  v_qty   numeric;
  v_total numeric;
  v_saldo numeric;
BEGIN
  SELECT qty INTO v_qty FROM public.stok_waste_reports
   WHERE id = 'a23156e6-82df-46ec-a91b-c091bcef0fe0';
  IF v_qty IS DISTINCT FROM 1.5 THEN
    RAISE EXCEPTION 'Koreksi gagal: qty sekarang %', v_qty;
  END IF;

  -- Kontrol positif 1: waste September harus turun ke angka yang masuk akal.
  SELECT COALESCE(SUM(w.qty * COALESCE(bh.harga_beli, 0)), 0) INTO v_total
    FROM public.stok_waste_reports w
    LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    JOIN public.outlets o ON o.id = w.outlet_id
   WHERE w.status = 'APPROVED' AND o.type <> 'test'
     AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-09-01';
  IF v_total > 10000000 THEN
    RAISE EXCEPTION 'Waste September masih Rp % -- masih ada baris janggal lain', v_total;
  END IF;

  -- Kontrol positif 2: stok TIDAK boleh ikut bergerak.
  SELECT sb.saldo INTO v_saldo
    FROM public.stok_balance sb
    JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
    JOIN public.outlets o ON o.id = sb.outlet_id
   WHERE b.nama = 'SAPI' AND o.name ILIKE '%EMPANG%';
  IF v_saldo IS NULL OR v_saldo < 0 THEN
    RAISE EXCEPTION 'Saldo SAPI Empang jadi % -- stok seharusnya tak tersentuh', v_saldo;
  END IF;
END $$;

-- DOWN:
-- UPDATE public.stok_waste_reports SET qty = 1504
--  WHERE id = 'a23156e6-82df-46ec-a91b-c091bcef0fe0';
