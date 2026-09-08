-- 20260908220000_koreksi_saldo_foil_gudang_pusat.sql
--
-- Menyetel saldo FOIL di Gudang Pusat ke hasil hitungan fisik: 1.096 Roll.
--
-- ============================================================================
-- SEBAB: satu penyesuaian manual hari ini, salah satuan 48x
-- ============================================================================
-- 8 September 2026, tiga baris berurutan di ledger:
--
--   13:47:33  EMPANG        +36.480.000 cm  "ekadharma"    <- salah outlet + satuan
--   13:52:07  EMPANG        -36.480.000 cm  "salah input"  <- dibatalkan sendiri
--   13:53:07  GUDANG PUSAT  +36.480.000 cm  "ekadharma"    <- diulang, satuan masih salah
--
-- Penerimaan 1.000 Roll dari Ekadharma diketik sebagai "1.000", lalu dikali
-- 36.480 (cm per DUS) alih-alih 760 (cm per ROLL) -> tercatat 48.000 Roll.
--
-- Formnya tidak salah hitung. Satuan besar FOIL baru berubah dari Roll ke Dus
-- PAGI INI (migration 20260908103000), jadi form kini meminta Dus sementara
-- orang gudang masih berpikir dalam Roll. Operator sempat menyadari salah
-- outlet dan membatalkannya -- tapi tidak menyadari satuannya juga berubah.
--
-- Diperiksa: seluruh outlet lain sehat (0,8 - 110 Roll). Hanya Gudang Pusat.
-- Tidak ada PO FOIL yang menggantung, jadi koreksi ini tidak akan tertimpa
-- verifikasi penerimaan yang menyusul.
--
-- ============================================================================
-- ANGKANYA
-- ============================================================================
--   sistem  36.588.680 cm = 48.143,00 Roll = 1.002,98 Dus  = Rp423.234.742
--   fisik      832.960 cm =  1.096,00 Roll =    22,83 Dus  = Rp  9.635.155
--   koreksi -35.755.720 cm                                 = -Rp413.599.586
--
-- Perbandingan waras: saldo sebelum penyesuaian salah itu 108.680 cm
-- (143 Roll); ditambah 1.000 Roll yang benar-benar datang jadi 1.143 Roll.
-- Hitungan fisik 1.096 Roll -- selisih 47 Roll (sekitar 1 Dus), wajar untuk
-- pemakaian/kiriman yang belum tercatat. Hitungan fisik yang dipakai.
--
-- ============================================================================
-- CARA MENULIS
-- ============================================================================
-- Lewat ledger 'adjustment', BUKAN UPDATE stok_balance langsung -- SOP proyek
-- ini; trigger yang mengurus saldo, dan jejaknya terlihat di riwayat.
--
-- IDEMPOTEN DENGAN CARA YANG BENAR: deltanya dihitung SAAT JALAN
-- (target - saldo saat ini), bukan angka mati -35.755.720. Naskah koreksi
-- berdelta-tetap pernah dijalankan dua kali pada 3 September dan justru
-- menggandakan kesalahannya. Kalau saldo sudah 832.960, tidak ada baris baru.

INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
SELECT sb.outlet_id, sb.bahan_baku_id, 'adjustment',
       832960 - sb.saldo,
       'Koreksi opname fisik 8 Sep 2026: 1.096 Roll. Membatalkan penyesuaian '
         || '13:53 yang mengetik 1.000 sebagai Dus (36.480 cm) alih-alih Roll '
         || '(760 cm) -- satuan FOIL berubah Roll->Dus pagi ini.',
       NOW()
FROM public.stok_balance sb
JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
WHERE b.nama = 'FOIL'
  AND sb.outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'
  AND sb.saldo <> 832960;
