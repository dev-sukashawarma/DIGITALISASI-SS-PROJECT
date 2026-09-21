-- Nonaktifkan 6 bahan atas permintaan owner (21 Sep 2026). Bukan DELETE: semua punya saldo & riwayat ledger.
-- Catatan: MIE masih dipakai 4 resep aktif dan PLASTIK BESAR/TUTUP PACK masih punya SJ 'dikirim'.
UPDATE bahan_baku SET is_active = false
WHERE nama IN ('MIE','KAYU MANIS','MERICA','PLASTIK BESAR','PLASTIK KECIL','TUTUP PACK') AND is_active;
