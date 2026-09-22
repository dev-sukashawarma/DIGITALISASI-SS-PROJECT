-- ====================================================================
-- MIGRATION: Optimasi Performa ledger_stok (858k+ Baris)
-- 1. Cabut ledger_stok dari publication supabase_realtime
-- 2. Kembalikan REPLICA IDENTITY ke DEFAULT (hemat WAL decode)
-- 3. Tambah Partial Indexes untuk ref_opname_id, ref_shipment_id,
--    ref_transfer_id, ref_waste_id (mencegah Full Table Scan & 57014 timeout)
-- ====================================================================

-- 1. Cabut ledger_stok dari publication supabase_realtime jika ada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ledger_stok'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.ledger_stok;
    RAISE NOTICE 'ledger_stok berhasil dicabut dari supabase_realtime';
  ELSE
    RAISE NOTICE 'ledger_stok sudah tidak ada di supabase_realtime';
  END IF;
END $$;

-- 2. Kembalikan REPLICA IDENTITY ke DEFAULT agar tidak menulis full-row image ke WAL saat UPDATE/DELETE
ALTER TABLE public.ledger_stok REPLICA IDENTITY DEFAULT;

-- 3. Tambahkan Partial Index pada kolom referensi dokumen
-- Menggunakan klausul WHERE ... IS NOT NULL agar index berukuran sangat kecil (< 5MB),
-- hemat memori RAM shared_buffers, dan mempercepat pencarian detail transaksi hingga < 5ms.

CREATE INDEX IF NOT EXISTS idx_ledger_stok_ref_opname_id
  ON public.ledger_stok (ref_opname_id)
  WHERE ref_opname_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_stok_ref_shipment_id
  ON public.ledger_stok (ref_shipment_id)
  WHERE ref_shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_stok_ref_transfer_id
  ON public.ledger_stok (ref_transfer_id)
  WHERE ref_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_stok_ref_waste_id
  ON public.ledger_stok (ref_waste_id)
  WHERE ref_waste_id IS NOT NULL;

-- 4. Kueri Verifikasi
-- Menampilkan status publication dan index yang baru dibuat
SELECT pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE tablename = 'ledger_stok';

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ledger_stok' AND indexname LIKE 'idx_ledger_stok_ref_%';
