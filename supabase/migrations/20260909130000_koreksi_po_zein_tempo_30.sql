-- 20260909130000_koreksi_po_zein_tempo_30.sql
-- Koreksi SPB/PO/VII/2026/042 (Toko Zein, MAYONAISE 100 Dus, Rp24.800.000).
--
-- Dikonfirmasi owner 9 September 2026: pembayaran TEMPO 30 HARI, dan
-- BELUM dibayar.
--
-- Dua hal yang salah, keduanya berasal dari importir Excel SPO-PO-047 yang
-- menulis langsung ke tabel tanpa melewati verifikasi_terima_po:
--
--   1. jatuh_tempo = 2026-08-26, sama dengan tanggal terimanya (efektif tunai).
--      Seharusnya tanggal terima + 30 hari = 2026-09-25.
--   2. payment_status = 'paid', padahal paid_at, paid_amount, dan
--      cash_transaction_id semuanya NULL -- tanda itu dipasang importir, bukan
--      hasil pelunasan nyata. Owner memastikan belum dibayar.
--
-- Sisi stok TIDAK disentuh: MAYONAISE-nya sudah masuk lewat adjustment
-- (1.272.000 gram, 15 & 28 Agustus, catatan "barang masuk").
--
-- Efeknya ke laporan: utang terbuka naik Rp24.800.000.
-- Idempoten.

UPDATE public.purchase_order
   SET jatuh_tempo    = DATE '2026-09-25',
       payment_status = 'unpaid',
       paid_at        = NULL,
       paid_amount    = NULL
 WHERE nomor_po = 'SPB/PO/VII/2026/042'
   AND (jatuh_tempo IS DISTINCT FROM DATE '2026-09-25'
        OR payment_status IS DISTINCT FROM 'unpaid');

-- DOWN:
-- UPDATE public.purchase_order
--    SET jatuh_tempo = DATE '2026-08-26', payment_status = 'paid'
--  WHERE nomor_po = 'SPB/PO/VII/2026/042';
