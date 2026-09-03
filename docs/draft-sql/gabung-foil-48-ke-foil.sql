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
--
-- ---------------------------------------------------------------------------
-- URUTAN MENJALANKAN
--
--   SEKARANG :  0  ->  1  ->  2  ->  3  ->  5
--   NANTI    :  4        (setelah 26 surat jalan berjalan tuntas),
--                        lalu ulangi 2 dan 3 untuk sisa saldonya
--
-- LANGKAH 4 sengaja ditulis sebelum 5 karena berkaitan dengan saldo, tapi
-- dijalankan paling belakang. Jangan menunggu 4 untuk menjalankan 5.
-- ---------------------------------------------------------------------------


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

-- CATATAN: cast ::uuid dan ::text WAJIB di sini. Tanpa UNION ALL, Postgres
-- mengenali sendiri teks '4804d1fc-...' sebagai uuid. Tapi UNION ALL memaksa
-- resolusi tipe lebih awal dan menganggapnya text, sehingga muncul
--   ERROR 42804: column "bahan_baku_id" is of type uuid but expression is of type text
WITH src AS (
  SELECT outlet_id, saldo
  FROM stok_balance
  WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'::uuid
    AND saldo <> 0
)
INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
SELECT outlet_id,
       'fb243647-dd20-4ef1-b739-921b0a7307d7'::uuid,
       'adjustment'::text,
       -saldo,
       'Gabung FOIL (48) ke FOIL — keluar. Barang sama, beda vendor.'::text,
       NOW()
FROM src
UNION ALL
SELECT outlet_id,
       '4804d1fc-f06c-4306-adfd-a798bda1275a'::uuid,
       'adjustment'::text,
       saldo,
       'Gabung FOIL (48) ke FOIL — masuk. Barang sama, beda vendor.'::text,
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
-- LANGKAH 4 — SAPUAN BERKALA.
--
-- KOREKSI: versi awal naskah ini menulis "jalankan setelah 26 surat jalan
-- tuntas". Syarat itu KELIRU dan tidak realistis. Diperiksa 2026-09-03:
-- dari 199 surat jalan berstatus 'dikirim' di seluruh sistem, 130 di antaranya
-- sudah LEBIH DARI DUA MINGGU (rata-rata normal selesai 5 hari). Status
-- 'dikirim' memang menumpuk dan sering tak pernah difinalkan.
--
-- Menunggu angka 26 itu jadi nol berarti menunggu selamanya.
--
-- GANTINYA: pemicunya bukan "dokumen tuntas", melainkan "saldo muncul lagi".
-- Karena FOIL (48) sudah nonaktif, tidak ada dokumen BARU yang bisa memilihnya.
-- Satu-satunya sumber saldo baru adalah 26 dokumen lama itu, dan jumlahnya
-- kecil (total qty 446 dari stok 1,2 juta cm).
--
-- CARA PAKAI — cek kapan saja dengan satu query:
--
--   SELECT count(*) AS outlet, round(COALESCE(sum(saldo),0)) AS total
--   FROM stok_balance
--   WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'::uuid
--     AND saldo <> 0;
--
--   Hasil 0  -> tidak ada yang perlu dikerjakan.
--   Hasil >0 -> jalankan ulang LANGKAH 2 lalu LANGKAH 3.
--
-- RITME YANG DISARANKAN: cek seminggu lagi (setelah dokumen 2-3 September
-- selesai diterima), lalu cukup sebulan sekali. Aman dijalankan berulang --
-- kalau saldo sudah nol, LANGKAH 2 tidak menulis baris apa pun.
--
-- CATATAN TERPISAH: 130 surat jalan menggantung >2 minggu itu masalah
-- tersendiri di luar urusan foil. Nilainya Rp1,2 juta -- barang sudah keluar
-- dari catatan gudang tapi belum masuk catatan outlet. Perlu dirapikan, tapi
-- tidak mendesak.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- LANGKAH 5 — Harga FOIL disesuaikan ke Rp8.791,2
--
-- KEPUTUSAN OWNER (3 September 2026): opsi (b).
--
-- Stok gabungan berasal dari dua pembelian:
--   Ekadharma  @11.554/Roll   (masuk 2 Sep, mendarat di FOIL)
--   PT Altindo  @8.791,2/Roll (masuk 3 Sep, mendarat di FOIL (48))
--
-- Rp8.791,2 dipilih karena inilah yang OTOMATIS terjadi seandainya FOIL tak
-- pernah dipecah: aturan sistem sekarang adalah "harga pembelian terakhir
-- menang", dan Altindo masuk paling akhir. Jadi ini bukan angka baru --
-- ini memulihkan pembaruan harga yang terhalang oleh pemecahan itu.
--
-- Dua angka lain yang dipertimbangkan dan tidak dipilih:
--   Rp11.554  -> nilai persediaan Rp18,8 jt; abaikan stok Altindo
--   Rp9.858   -> nilai persediaan Rp16,1 jt; rata-rata tertimbang stok riil,
--                paling jujur tapi belum jadi metode resmi sistem ini
--
-- Dampak: nilai persediaan foil Rp18,8 jt -> Rp14,3 jt.
--         Biaya foil per porsi turun Rp164-182 di 16 menu, contoh:
--           Original Mix Jumbo   Rp760 -> Rp578
--           Original Sapi Jumbo  Rp684 -> Rp521
--
-- CATATAN TEKNIS (sudah diperiksa):
--   - Nilai persisnya 8791.2, BUKAN 8791. Jangan dibulatkan.
--   - JANGAN set harga_beli_display manual. Trigger trg_sync_harga_beli_display
--     menghitungnya sendiri: harga_beli * kemasan_qty / v_penuh.
--     Untuk FOIL: faktor_tengah NULL -> v_penuh = faktor_konversi = 760,
--     jadi display = 8791,2 * 760/760 = 8791,2. Tidak ada pelipatan.
--   - TIDAK ADA trigger yang menulis riwayat harga otomatis; hanya po_on_verified
--     yang melakukannya. Karena itu baris riwayat ditulis manual di bawah,
--     supaya perubahan ini tidak jadi pergeseran nilai tanpa jejak.
-- ----------------------------------------------------------------------------

-- 5a. Catat riwayat DULU, selagi harga lama masih tersimpan.
INSERT INTO bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, catatan, changed_at)
SELECT '4804d1fc-f06c-4306-adfd-a798bda1275a'::uuid,
       harga_beli,
       8791.2,
       'Penggabungan FOIL (48) ke FOIL. Menyesuaikan ke harga pembelian terakhir '
       || '(PT Altindo, PO/KITCHEN/20260902/0001) yang sebelumnya terhalang '
       || 'karena mendarat di bahan terpisah.',
       NOW()
FROM bahan_baku_harga
WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a';

-- 5b. Baru ubah harganya.
UPDATE bahan_baku_harga
SET harga_beli       = 8791.2,
    harga_updated_at = NOW()
WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a';

-- 5c. Verifikasi: harga dan display harus sama-sama 8791.2
SELECT b.nama, h.harga_beli::text, h.harga_beli_display::text, h.harga_updated_at
FROM bahan_baku b JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
WHERE b.nama = 'FOIL';

-- 5d. Verifikasi nilai persediaan foil setelah penyesuaian (perkiraan Rp14,3 jt)
SELECT round(SUM(sb.saldo)) AS saldo_cm,
       round(SUM(sb.saldo) * h.harga_beli / h.kemasan_qty) AS nilai_persediaan
FROM stok_balance sb
JOIN bahan_baku b       ON b.id = sb.bahan_baku_id
JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
WHERE b.nama = 'FOIL'
GROUP BY h.harga_beli, h.kemasan_qty;


-- ============================================================================
-- ---------------------------------------------------------------------------
-- TINDAK LANJUT NON-TEKNIS
--
-- 1. Beri tahu purchasing: pesan foil ke bahan "FOIL", bukan "FOIL (48)".
-- 2. Beri tahu distribusi: kirim "FOIL" ke outlet.
-- 3. Opname Cirendeu -- sisa minus di sana bukan efek penggabungan, melainkan
--    selisih fisik nyata.
-- ============================================================================
