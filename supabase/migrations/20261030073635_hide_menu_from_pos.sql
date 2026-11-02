-- Sembunyikan menu dari seluruh tampilan POS (Kasir, Kiosk, Order Manual)
-- tanpa menghapus baris `menu_items` (menjaga integritas FK order_items, ecommerce_sale_items, & HPP).
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_hidden_pos boolean NOT NULL DEFAULT false;

-- Partial index untuk mempercepat query katalog POS yang hanya mengambil menu aktif/tampil di POS
CREATE INDEX IF NOT EXISTS idx_menu_items_pos_visible
  ON public.menu_items (sort_order)
  WHERE is_hidden_pos = false;
