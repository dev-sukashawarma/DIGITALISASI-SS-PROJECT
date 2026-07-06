-- 20260707100100_ledger_add_po_support.sql
-- Tambahkan:
--   1. Tipe baru 'pembelian_supplier' ke CHECK constraint ledger_stok.tipe
--   2. Kolom ref_po_id untuk traceability ke purchase_order
-- Tipe ini digunakan saat barang dari supplier diterima di kitchen.

-- 1. Perluas CHECK constraint tipe
ALTER TABLE public.ledger_stok DROP CONSTRAINT IF EXISTS ledger_stok_tipe_check;
ALTER TABLE public.ledger_stok ADD CONSTRAINT ledger_stok_tipe_check
  CHECK (tipe IN (
    'terima_kiriman',     -- outlet terima dari SJ kitchen
    'pemakaian',          -- BOM deduction per order
    'waste',              -- bahan terbuang/rusak
    'adjustment',         -- koreksi manual
    'opname_selisih',     -- selisih hasil stock opname
    'transfer_keluar',    -- kitchen kirim SJ ke outlet (stok kitchen berkurang)
    'transfer_masuk',     -- (reserved)
    'rejected_kiriman',   -- item SJ ditolak outlet
    'pembelian_supplier'  -- ← BARU: kitchen terima dari supplier (stok kitchen naik)
  ));

-- 2. Tambah kolom ref_po_id (nullable, hanya diisi untuk tipe 'pembelian_supplier')
ALTER TABLE public.ledger_stok
  ADD COLUMN IF NOT EXISTS ref_po_id UUID;

-- Index untuk lookup cepat (misal: "semua entri dari PO ini")
CREATE INDEX IF NOT EXISTS idx_ledger_ref_po ON public.ledger_stok(ref_po_id)
  WHERE ref_po_id IS NOT NULL;

-- DOWN:
-- ALTER TABLE public.ledger_stok DROP COLUMN IF EXISTS ref_po_id;
-- ALTER TABLE public.ledger_stok DROP CONSTRAINT IF EXISTS ledger_stok_tipe_check;
-- ALTER TABLE public.ledger_stok ADD CONSTRAINT ledger_stok_tipe_check
--   CHECK (tipe IN ('terima_kiriman','pemakaian','waste','adjustment',
--                   'opname_selisih','transfer_keluar','transfer_masuk','rejected_kiriman'));
