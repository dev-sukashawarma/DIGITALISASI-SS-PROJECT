-- ============================================================================
-- DRAFT — BELUM DIJALANKAN. Menunggu persetujuan.
--
-- Sengaja ditaruh di docs/draft-sql/, BUKAN supabase/migrations/, supaya tidak
-- ikut terbawa `supabase db push` sebelum disetujui.
--
-- Tujuan: menggabungkan FOIL (48) kembali ke FOIL.
--
-- Latar (diverifikasi di DB produksi 2026-09-03):
--   FOIL dan FOIL (48) adalah BARANG SAMA dari vendor berbeda, dipecah jadi dua
--   baris bahan_baku. Akibatnya:
--     - 16 resep aktif memotong FOIL       (39.464 baris pemakaian, -978.415)
--     - Distribusi mengirim FOIL (48)      (terima_kiriman +754.070)
--     - FOIL (48) dipakai 0 resep
--     - Saldo FOIL total -11.719, minus di 12 outlet
--     - Selisih ditambal opname_selisih ±700.000 di kedua sisi
--
--   Barangnya tidak hilang: ada di sebelah, cuma tercatat sebagai bahan lain.
--
-- Kenapa aman digabung 1:1 (dicek, jangan diasumsikan):
--   FOIL      : satuan Roll, faktor_konversi 760, faktor_tampilan 760, kemasan_qty 760 cm
--   FOIL (48) : satuan Roll, faktor_konversi 760, faktor_tampilan 760, kemasan_qty 760 cm
--   Skalanya identik, jadi qty dipindah apa adanya tanpa konversi.
--
-- Perkiraan hasil: 21 dari 23 baris outlet langsung wajar. Tersisa
--   SUKA SHAWARMA CIRENDEU (-4.522) dan "outlet tes" (-1) yang perlu opname.
--
-- Mengikuti SOP proyek: SEMUA perubahan stok lewat ledger_stok. JANGAN pernah
-- UPDATE/INSERT stok_balance langsung — trigger yang mengurus saldo.
-- Pola penonaktifan mengikuti MINYAK SAYUR -> MINYAK (migration 20260813120000):
-- nonaktifkan, JANGAN delete (ada riwayat ledger + FK ON DELETE RESTRICT).
-- ============================================================================

-- ID (dikonfirmasi dari DB 2026-09-03):
--   FOIL       = 4804d1fc-f06c-4306-adfd-a798bda1275a
--   FOIL (48)  = fb243647-dd20-4ef1-b739-921b0a7307d7


-- ----------------------------------------------------------------------------
-- LANGKAH 0 — PRA-PERIKSA. Jalankan dulu, baca hasilnya, baru lanjut.
-- ----------------------------------------------------------------------------

-- 0a. Foto saldo sebelum, per outlet. SIMPAN hasilnya untuk pembanding.
SELECT o.name AS outlet,
       round(MAX(CASE WHEN b.nama = 'FOIL'      THEN sb.saldo END)) AS foil,
       round(MAX(CASE WHEN b.nama = 'FOIL (48)' THEN sb.saldo END)) AS foil_48,
       round(COALESCE(MAX(CASE WHEN b.nama = 'FOIL'      THEN sb.saldo END), 0)
           + COALESCE(MAX(CASE WHEN b.nama = 'FOIL (48)' THEN sb.saldo END), 0)) AS gabungan
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o    ON o.id = sb.outlet_id
WHERE b.nama IN ('FOIL', 'FOIL (48)')
GROUP BY o.name
ORDER BY gabungan;

-- 0b. Ada dokumen FOIL (48) yang masih berjalan? Kalau ADA, selesaikan dulu --
--     surat jalan/permintaan yang belum tuntas akan menulis ke bahan yang sudah
--     dinonaktifkan.
--
--     Nilai status surat_jalan yang benar-benar dipakai (dicek 2026-09-03):
--       selesai, dikirim, draft, diterima_lengkap, diterima_sebagian
--     Yang BELUM tuntas = 'draft' (belum dikirim) dan 'dikirim' (belum diterima).
--     Per 2026-09-03 tercatat 21 'dikirim' + 5 'draft' = 26 baris menggantung.
--     LANGKAH 1 & 2 JANGAN dijalankan sebelum angka ini nol.
SELECT 'surat_jalan_item' AS sumber, count(*) AS baris_menggantung
FROM surat_jalan_item sji
JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
WHERE sji.bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
  AND sj.status IN ('draft', 'dikirim')
UNION ALL
SELECT 'permintaan_bahan_item', count(*)
FROM permintaan_bahan_item pbi
JOIN permintaan_bahan pb ON pb.id = pbi.permintaan_id
WHERE pbi.bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
  AND pb.status = 'menunggu'
UNION ALL
SELECT 'purchase_order_item', count(*)
FROM purchase_order_item poi
JOIN purchase_order po ON po.id = poi.purchase_order_id
WHERE poi.bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
  AND po.status IN ('draft', 'menunggu_approval_finance', 'dikirim_ke_supplier', 'sebagian_diterima');


-- ----------------------------------------------------------------------------
-- LANGKAH 1 — Pindahkan saldo FOIL (48) -> FOIL, per outlet.
--
-- Dua baris ledger berpasangan per outlet: keluar dari FOIL (48), masuk ke FOIL.
-- Nilai diambil dari saldo saat dijalankan (bukan angka mati), supaya tetap
-- benar meski saldo bergerak sejak naskah ini ditulis.
-- ----------------------------------------------------------------------------

WITH src AS (
  SELECT outlet_id, saldo
  FROM stok_balance
  WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
    AND saldo <> 0
)
INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
SELECT outlet_id,
       'fb243647-dd20-4ef1-b739-921b0a7307d7',
       'adjustment',
       -saldo,
       'Gabung FOIL (48) ke FOIL — keluar dari FOIL (48). Barang sama, beda vendor.',
       NOW()
FROM src
UNION ALL
SELECT outlet_id,
       '4804d1fc-f06c-4306-adfd-a798bda1275a',
       'adjustment',
       saldo,
       'Gabung FOIL (48) ke FOIL — masuk ke FOIL. Barang sama, beda vendor.',
       NOW()
FROM src;


-- ----------------------------------------------------------------------------
-- LANGKAH 2 — Nonaktifkan FOIL (48). JANGAN DELETE.
-- ----------------------------------------------------------------------------

UPDATE bahan_baku
SET nama      = 'FOIL (48) (DIGABUNG KE FOIL)',
    is_active = false
WHERE id = 'fb243647-dd20-4ef1-b739-921b0a7307d7';


-- ----------------------------------------------------------------------------
-- LANGKAH 3 — VERIFIKASI. Wajib, jangan dilewati.
-- ----------------------------------------------------------------------------

-- 3a. Saldo FOIL (48) harus NOL di semua outlet.
SELECT count(*) AS harus_nol
FROM stok_balance
WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
  AND saldo <> 0;

-- 3b. Saldo FOIL sekarang harus sama dengan kolom "gabungan" di langkah 0a.
SELECT o.name AS outlet, round(sb.saldo) AS foil_setelah_gabung
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o    ON o.id = sb.outlet_id
WHERE b.nama = 'FOIL'
ORDER BY sb.saldo;

-- 3c. Yang masih minus setelah digabung — inilah yang perlu opname beneran.
--     Diperkirakan: SUKA SHAWARMA CIRENDEU (-4.522), outlet tes (-1).
SELECT o.name AS outlet, round(sb.saldo) AS masih_minus
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o    ON o.id = sb.outlet_id
WHERE b.nama = 'FOIL' AND sb.saldo < 0
ORDER BY sb.saldo;


-- ============================================================================
-- KEPUTUSAN TERBUKA — perlu dijawab manusia, TIDAK dikerjakan naskah ini
--
-- 1. Harga FOIL setelah digabung.
--    Sekarang harga master FOIL = Rp11.554 (Ekadharma), sedangkan hampir seluruh
--    stok fisik berasal dari FOIL (48) = Rp8.791 (PT Altindo Mulia).
--    Setelah digabung, harga master sebaiknya mencerminkan barang yang benar-benar
--    ada. Kalau ya, jalankan terpisah setelah keputusan diambil:
--
--      -- UPDATE bahan_baku_harga SET harga_beli = 8791, harga_beli_display = 8791,
--      --        harga_updated_at = NOW()
--      -- WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a';
--
--    FOIL dipakai di 16 resep, jadi perubahan ini menggeser HPP 16 menu (-24%
--    untuk komponen foil). Jangan dijalankan tanpa keputusan sadar.
--
-- 2. PO berikutnya untuk foil.
--    Purchasing harus diberi tahu agar memesan ke bahan "FOIL", bukan "FOIL (48)"
--    yang sudah dinonaktifkan.
--
-- 3. Opname Cirendeu.
--    Sisa minus -4.522 bukan efek penggabungan; itu selisih nyata yang perlu
--    hitung fisik.
-- ============================================================================
