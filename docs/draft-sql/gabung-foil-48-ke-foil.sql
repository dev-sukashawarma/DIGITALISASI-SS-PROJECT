-- ============================================================================
-- Penggabungan FOIL (48) kembali ke FOIL
--
-- SIAP DIJALANKAN. Jalankan berurutan, baca hasil tiap langkah.
-- Diperiksa ulang ke DB produksi: 3 September 2026.
--
-- ---------------------------------------------------------------------------
-- DUDUK PERKARA
--
-- FOIL (48) adalah bahan yang dibuat sekitar 2 September, lalu pembelian dari
-- PT Altindo diarahkan ke sana. Barangnya SAMA dengan FOIL, cuma beda vendor.
--
--   FOIL       <- PO/KITCHEN/20260831/0002, Ekadharma @11.554, masuk 760.000 cm (2 Sep)
--   FOIL (48)  <- PO/KITCHEN/20260902/0001, PT Altindo @8.791, masuk 760.000 cm (3 Sep)
--
-- Akibat pemecahan itu:
--   - 16 resep aktif memotong FOIL; FOIL (48) dipakai 0 resep
--   - Distribusi mengirim FOIL (48) ke outlet
--   - FOIL saldo -15.670, minus di 17 outlet, MELEBAR ~2.000/hari
--     (11.719 di 2 Sep -> 13.540 -> 15.670 di 3 Sep)
--   - FOIL (48) saldo +1.254.120, tak pernah berkurang
--   - Selisih ditambal opname_selisih ±700.000 di kedua sisi
--
-- Barangnya tidak hilang: ada di sebelah, tercatat sebagai bahan lain.
--
-- Efek samping yang jarang disadari: pemecahan ini MENGHALANGI pembaruan harga
-- yang normal. Pembelian Altindo @8.791 tak pernah memperbarui harga FOIL,
-- karena mendarat di baris yang berbeda.
--
-- ---------------------------------------------------------------------------
-- KENAPA AMAN DIGABUNG 1:1 (dicek, bukan diasumsikan)
--
--   FOIL      : Roll, faktor_konversi 760, faktor_tampilan 760, kemasan_qty 760 cm
--   FOIL (48) : Roll, faktor_konversi 760, faktor_tampilan 760, kemasan_qty 760 cm
--
-- Skala identik, jadi qty dipindah apa adanya tanpa konversi.
--
-- ---------------------------------------------------------------------------
-- KENAPA MENONAKTIFKAN FOIL (48) TIDAK MERUSAK DOKUMEN BERJALAN
--
-- Ada 26 surat jalan memuat FOIL (48) yang belum tuntas (21 'dikirim', 5 'draft').
-- Sudah dicek: TIDAK ADA fungsi DB yang memeriksa is_active --
-- verify_surat_jalan_item, finalize_surat_jalan, finalize_surat_jalan_and_ledger,
-- send_surat_jalan, sj_on_dikirim_kurangi_kitchen semuanya tidak peduli.
-- is_active hanya menyaring daftar pilihan di layar.
--
-- Jadi menonaktifkan FOIL (48) akan:
--   - mencegah dokumen BARU memilihnya  (yang kita mau)
--   - membiarkan 26 dokumen berjalan selesai normal  (yang kita mau)
--
-- Konsekuensinya: setelah 26 dokumen itu tuntas, outlet akan punya sedikit saldo
-- FOIL (48) lagi. Karena itu LANGKAH 4 (sapuan kedua) perlu dijalankan nanti.
--
-- ---------------------------------------------------------------------------
-- SOP yang diikuti: SEMUA perubahan stok lewat ledger_stok. JANGAN UPDATE
-- stok_balance langsung -- trigger yang mengurus saldo.
-- Penonaktifan mengikuti pola MINYAK SAYUR -> MINYAK (migration 20260813120000):
-- nonaktifkan, JANGAN delete (ada riwayat ledger + FK ON DELETE RESTRICT).
-- ============================================================================

-- ID (dikonfirmasi dari DB 2026-09-03):
--   FOIL       = 4804d1fc-f06c-4306-adfd-a798bda1275a
--   FOIL (48)  = fb243647-dd20-4ef1-b739-921b0a7307d7


-- ----------------------------------------------------------------------------
-- LANGKAH 0 — Foto keadaan sebelum. SIMPAN hasilnya untuk pembanding.
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- LANGKAH 1 — Nonaktifkan FOIL (48) LEBIH DULU.
--
-- Dilakukan sebelum pemindahan saldo, supaya tidak ada dokumen baru yang lahir
-- di tengah proses. Dokumen yang sudah berjalan tetap bisa selesai.
-- ----------------------------------------------------------------------------

UPDATE bahan_baku
SET nama      = 'FOIL (48) (DIGABUNG KE FOIL)',
    is_active = false
WHERE id = 'fb243647-dd20-4ef1-b739-921b0a7307d7';


-- ----------------------------------------------------------------------------
-- LANGKAH 2 — Pindahkan saldo FOIL (48) -> FOIL, per outlet.
--
-- Dua baris ledger berpasangan per outlet. Nilai diambil dari saldo saat
-- dijalankan, bukan angka mati.
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
       'Gabung FOIL (48) ke FOIL — keluar. Barang sama, beda vendor.',
       NOW()
FROM src
UNION ALL
SELECT outlet_id,
       '4804d1fc-f06c-4306-adfd-a798bda1275a',
       'adjustment',
       saldo,
       'Gabung FOIL (48) ke FOIL — masuk. Barang sama, beda vendor.',
       NOW()
FROM src;


-- ----------------------------------------------------------------------------
-- LANGKAH 3 — VERIFIKASI. Wajib.
-- ----------------------------------------------------------------------------

-- 3a. Saldo FOIL (48) harus NOL di semua outlet.
SELECT count(*) AS harus_nol
FROM stok_balance
WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
  AND saldo <> 0;

-- 3b. Saldo FOIL harus sama dengan kolom "gabungan" di LANGKAH 0.
SELECT o.name AS outlet, round(sb.saldo) AS foil_setelah_gabung
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o    ON o.id = sb.outlet_id
WHERE b.nama = 'FOIL'
ORDER BY sb.saldo;

-- 3c. Yang masih minus setelah digabung -- inilah selisih fisik sungguhan yang
--     perlu opname. Diperkirakan hanya SUKA SHAWARMA CIRENDEU dan "outlet tes".
SELECT o.name AS outlet, round(sb.saldo) AS masih_minus
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o    ON o.id = sb.outlet_id
WHERE b.nama = 'FOIL' AND sb.saldo < 0
ORDER BY sb.saldo;


-- ============================================================================
-- LANGKAH 4 — SAPUAN KEDUA. Jalankan SETELAH 26 surat jalan tuntas.
--
-- Cek dulu apakah masih ada yang menggantung:
--
--   SELECT sj.status, count(*)
--   FROM surat_jalan_item sji
--   JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
--   WHERE sji.bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
--     AND sj.status IN ('draft','dikirim')
--   GROUP BY sj.status;
--
-- Kalau sudah nol, jalankan ulang LANGKAH 2 dan LANGKAH 3 untuk memindahkan
-- sisa saldo yang mendarat dari dokumen-dokumen itu.
-- ============================================================================


-- ============================================================================
-- KEPUTUSAN TERPISAH — HARGA FOIL SETELAH DIGABUNG
--
-- TIDAK dikerjakan naskah ini. Perlu keputusan sadar karena menggeser HPP 16 menu.
--
-- Stok gabungan 1.238.450 cm (1.629 Roll) berasal dari DUA pembelian:
--   Ekadharma  @11.554/Roll  (masuk 2 Sep)
--   PT Altindo  @8.791/Roll  (masuk 3 Sep)
--
-- Tiga angka yang masuk akal:
--
--   a) Biarkan Rp11.554   -> nilai persediaan Rp18,8 jt
--      Tidak mencerminkan stok Altindo yang jumlahnya sebanding.
--
--   b) Rp8.791            -> nilai persediaan Rp14,3 jt
--      Inilah yang OTOMATIS terjadi kalau FOIL tak pernah dipecah -- aturan
--      sekarang adalah "harga pembelian terakhir menang", dan Altindo masuk
--      paling akhir (3 Sep). Paling konsisten dengan cara sistem berjalan.
--
--   c) Rp9.858            -> nilai persediaan Rp16,1 jt
--      Rata-rata tertimbang stok yang benar-benar ada. Paling jujur, tapi
--      belum menjadi metode resmi sistem ini.
--
-- Dampak ke menu (contoh, opsi b): biaya foil per porsi turun Rp164-182.
--   Original Mix Jumbo   Rp760 -> Rp578
--   Original Sapi Jumbo  Rp684 -> Rp521
--
-- Kalau memilih (b), jalankan:
--
--   -- UPDATE bahan_baku_harga
--   -- SET harga_beli = 8791, harga_beli_display = 8791, harga_updated_at = NOW()
--   -- WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a';
--
-- ---------------------------------------------------------------------------
-- TINDAK LANJUT NON-TEKNIS
--
-- 1. Beri tahu purchasing: pesan foil ke bahan "FOIL", bukan "FOIL (48)".
-- 2. Beri tahu distribusi: kirim "FOIL" ke outlet.
-- 3. Opname Cirendeu -- sisa minus di sana bukan efek penggabungan, melainkan
--    selisih fisik nyata.
-- ============================================================================
