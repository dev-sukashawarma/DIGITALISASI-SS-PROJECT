-- ============================================================================
-- Jatiwaringin #32 (JAT-131126-001, Aziz) — diaktifkan sebagai pendapatan 2026-11-18
-- Arsip — sudah dijalankan, jangan diulang.
--
-- Dibayar Xendit Rp 70.420 (13 Nov 21:42), di-void kasir "menu habis". Pelanggan
-- DILAYANI 14 Nov (konfirmasi user) lewat input PreOrder WA #14 (metode VA, sudah
-- bayar online) yang kemudian di-void "udah selesa". #14 tetap batal (dobel);
-- #32 diaktifkan kembali dengan total = Xendit, tanpa potong stok, tanpa notifikasi.
-- Pembalik: status cancelled, total 0, cancellation_status approved,
-- cancellation_reason 'menu habis (Disetujui Tri Rizky)', void_at 2026-11-13 22:39:03.181728+07,
-- voided_by caf351f1-ea40-4fff-99ce-a4af71c59d47.
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

UPDATE public.orders
SET status = 'completed', total_amount = 70420,
    cancellation_status = 'none', cancellation_reason = NULL, void_at = NULL, voided_by = NULL,
    notes = notes || E'\n[KOREKSI XENDIT 2026-11-18 MALAM] DIAKTIFKAN KEMBALI: pelanggan dilayani 14 Nov lewat PreOrder WA #14 (di-void "udah selesa"). Total = Xendit 70420. Void lama: menu habis, Tri Rizky 13 Nov 22:39. Tanpa potong stok.',
    updated_at = now()
WHERE id = '727e4f7c-9ffa-4332-88fd-5a587645f565' AND status = 'cancelled' AND total_amount = 0;

UPDATE public.orders
SET notes = notes || E'\n[KOREKSI XENDIT 2026-11-18 MALAM] Tetap batal: dobel dengan pesanan website #32 (JAT-131126-001) yang sudah dibayar Xendit.',
    updated_at = now()
WHERE id = '43ac5f8a-f592-4910-99fd-8da0baaa2cd2' AND status = 'cancelled';

SET LOCAL session_replication_role = origin;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.orders o JOIN public.xendit_pembayaran p ON p.external_order_id = o.external_order_id
   WHERE o.id = '727e4f7c-9ffa-4332-88fd-5a587645f565' AND o.status = 'completed' AND round(o.total_amount) = round(p.nominal);
  IF n <> 1 THEN RAISE EXCEPTION 'ASERSI GAGAL: cocok=%', n; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_stok WHERE ref_order_id = '727e4f7c-9ffa-4332-88fd-5a587645f565') THEN
    RAISE EXCEPTION 'ASERSI GAGAL: stok terpotong';
  END IF;
END $$;

COMMIT;
