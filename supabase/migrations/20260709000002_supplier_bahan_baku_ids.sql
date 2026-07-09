-- 20260709000000_supplier_bahan_baku_ids.sql
-- Add bahan_baku_ids to supplier to auto-populate PO items

ALTER TABLE public.supplier
ADD COLUMN IF NOT EXISTS bahan_baku_ids UUID[] DEFAULT '{}'::uuid[];
