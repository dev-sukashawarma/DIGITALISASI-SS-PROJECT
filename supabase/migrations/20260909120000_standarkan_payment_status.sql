-- 20260909120000_standarkan_payment_status.sql
-- Satukan kosakata purchase_order.payment_status ke 'unpaid' | 'pending' | 'paid',
-- dan PULIHKAN alur pelunasan PO yang rusak sejak 2 September 2026.
--
-- Riwayatnya:
--   20260711120000 membuat CHECK ('unpaid','pending','paid') -- cocok dengan RPC
--                  settle_purchase_order yang menulis payment_status='pending'.
--   20260902133000 menulis ulang CHECK jadi ('unpaid','paid','lunas') sambil
--                  menambah kolom paid_amount. 'pending' HILANG dari daftar.
--
-- Akibatnya settle_purchase_order dijamin gagal constraint sejak 2 Sep. Bukti di
-- data: NOL purchase_order berstatus 'pending', NOL yang punya cash_transaction_id.
-- Yang ada 20 baris ber-paid_at, semuanya dari form manual yang menulis 'lunas'
-- tanpa pernah membuat transaksi kas.
--
-- 'lunas' juga membelah pembacaan: usePurchasingDashboard menghitung utang dengan
-- payment_status <> 'paid' dan SupplierView menghitung lunas dengan = 'paid',
-- sementara form menulis 'lunas'. Jadi setiap PO yang ditandai lunas lewat form
-- tetap tercatat sebagai utang (Rp37.395.280 dari 5 PO saat migration ini ditulis).
--
-- Idempoten.

-- 1. Satukan nilai lama
UPDATE public.purchase_order
   SET payment_status = 'paid'
 WHERE payment_status = 'lunas';

-- 2. Kembalikan daftar yang benar; 'pending' masuk lagi supaya
--    settle_purchase_order bisa jalan, 'lunas' dibuang supaya tak lahir lagi.
ALTER TABLE public.purchase_order
  DROP CONSTRAINT IF EXISTS purchase_order_payment_status_check;

ALTER TABLE public.purchase_order
  ADD CONSTRAINT purchase_order_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid'));

-- DOWN:
-- ALTER TABLE public.purchase_order DROP CONSTRAINT purchase_order_payment_status_check;
-- ALTER TABLE public.purchase_order ADD CONSTRAINT purchase_order_payment_status_check
--   CHECK (payment_status IN ('unpaid','paid','lunas'));
-- (nilai 'lunas' yang sudah diubah tidak dikembalikan)
