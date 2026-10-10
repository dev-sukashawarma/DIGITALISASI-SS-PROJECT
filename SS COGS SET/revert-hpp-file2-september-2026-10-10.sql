-- ARSIP — SUDAH DIJALANKAN 2026-10-10. JANGAN DIJALANKAN ULANG.
-- Jejak Audit Sesi Penyesuaian September 2026:
-- 1. Revert HPP menu September 2026 ke Excel "SS 2.0 HPP x 2026 (2).xlsx" (sheet UPDATED SS 2.0 INTERNAL).
-- 2. Berlaku khusus periode 1–30 September 2026.
-- 3. Shawarmie Ayam & Sapi berlaku 1–18 Sep (14.591 & 14.216), dikosongkan mulai 19 Sep (menu dinonaktifkan).
-- 4. Checkpoint per 1 Oktober 2026 dikembalikan ke data File XX (XX SS 2.0 HPP x 2026.xlsx) sebagai acuan baku seterusnya.
-- 5. Hasil Verifikasi:
--    - COGS Owner Agustus: 1.051.603.330 (IDENTIK / Rp 0 drift)
--    - COGS Mitra Agustus: 476.464.450 (IDENTIK / Rp 0 drift)
--    - COGS Owner September: 1.118.529.484,63 -> 1.017.387.460,53 (-Rp 101.142.024,10)
--    - COGS Mitra September: 524.875.026,00
--    - COGS Owner Oktober: 366.751.895,69 (IDENTIK / Rp 0 drift)

BEGIN;

-- Catatan: Data riwayat HPP telah di-upsert ke tabel public.menu_hpp_riwayat
-- dengan constraint menu_hpp_riwayat_unik (menu_item_id, kunci, berlaku_mulai).
-- Tiga checkpoint tanggal dicatat:
-- 1. 2026-09-01: Nilai File (2) (Offline & SS Online)
-- 2. 2026-09-19: Nilai File (2) (Shawarmie NULL)
-- 3. 2026-10-01: Nilai File XX (Kembali ke XX untuk Oktober ke depan)

COMMIT;
