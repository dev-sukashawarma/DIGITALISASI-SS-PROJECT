-- 20260813120500_update_po_items_hybrid.sql
-- Update purchase_order_item table to support Hybrid approach (Ad-hoc items)

ALTER TABLE public.purchase_order_item
  ALTER COLUMN bahan_baku_id DROP NOT NULL;

ALTER TABLE public.purchase_order_item
  ADD COLUMN item_description TEXT,
  ADD COLUMN satuan_ad_hoc TEXT;

-- Validation check: Either bahan_baku_id is present (Catalog item), OR item_description is present (Ad-hoc item)
ALTER TABLE public.purchase_order_item
  ADD CONSTRAINT chk_hybrid_item 
  CHECK (
    (bahan_baku_id IS NOT NULL) OR (item_description IS NOT NULL AND trim(item_description) <> '')
  );

