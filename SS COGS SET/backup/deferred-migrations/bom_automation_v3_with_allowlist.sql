-- DRAFT v3 -- BELUM di-push, untuk direview dulu.
-- Perubahan dari v2 (bom_automation_v2_with_konversi.sql):
--   Tambah GUARD allowlist outlet -- trigger cuma jalan (potong stok) untuk outlet_id
--   yang terdaftar di global_settings key 'bom_automation_allowed_outlets' (comma-separated
--   UUID). Outlet DI LUAR daftar: order tetap completed normal, TIDAK ada potongan BOM
--   sama sekali (sama seperti sebelum bom_automation ada) -- aman untuk rollout bertahap.
--
-- Cara pakai:
--   -- Tambah outlet ke allowlist (contoh: cuma outlet Empang dulu):
--   INSERT INTO global_settings (key, value) VALUES
--     ('bom_automation_allowed_outlets', '<outlet_id_empang>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
--   -- Tambah outlet lain kemudian (gabung dgn koma):
--   UPDATE global_settings SET value = value || ',' || '<outlet_id_baru>'
--   WHERE key = 'bom_automation_allowed_outlets';
--
--   -- Aktifkan ke SEMUA outlet (hapus guard, mode global penuh):
--   DELETE FROM global_settings WHERE key = 'bom_automation_allowed_outlets';
--   (kalau key tidak ada sama sekali, trigger dianggap NONAKTIF DI SEMUA OUTLET -- fail-safe
--    by default, bukan fail-open. Lihat logika di bawah.)

-- 1. Add ref_order_id to ledger_stok
ALTER TABLE public.ledger_stok
ADD COLUMN IF NOT EXISTS ref_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- 2. Create Trigger Function for Automatic BOM Deduction (v3: konversi satuan + allowlist)
CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
RETURNS trigger AS $$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  v_resep_id UUID;
  v_allowed_outlets TEXT;
BEGIN
  -- Guard allowlist: kalau key tidak ada / outlet_id tidak terdaftar -> skip semua logika BOM
  -- (order tetap completed/cancelled normal, cuma tidak ada potongan/pengembalian stok BOM).
  SELECT value INTO v_allowed_outlets FROM public.global_settings
    WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NULL
     OR NOT (NEW.outlet_id::text = ANY (string_to_array(v_allowed_outlets, ','))) THEN
    RETURN NEW;
  END IF;

  -- Handle when an order is completed (either updated to completed, or inserted as completed)
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    -- Loop through each item in the order
    FOR rec IN SELECT menu_item_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF rec.menu_item_id IS NOT NULL THEN
        -- Find the active recipe for this menu item, prioritizing outlet-specific over global
        v_resep_id := NULL;
        SELECT id INTO v_resep_id
        FROM public.resep
        WHERE menu_item_ref = rec.menu_item_id::text
          AND is_active = true
          AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
        ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
        LIMIT 1;

        -- If recipe found, deduct its materials (dikonversi ke satuan_baku via faktor_konversi)
        IF v_resep_id IS NOT NULL THEN
          FOR r_item IN
            SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
            FROM public.resep_item ri
            JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
            WHERE ri.resep_id = v_resep_id
          LOOP
            INSERT INTO public.ledger_stok (
              outlet_id,
              bahan_baku_id,
              tipe,
              qty,
              catatan,
              ref_order_id,
              created_at
            ) VALUES (
              NEW.outlet_id,
              r_item.bahan_baku_id,
              'pemakaian',
              -(r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi),
              'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A'),
              NEW.id,
              NOW()
            );
          END LOOP;
        END IF;
      END IF;
    END LOOP;

  -- Handle when an order is voided/cancelled (restore the stock)
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

    -- Find all negative ledger entries created by this order and reverse them
    -- (tidak perlu konversi ulang -- qty di sini sudah dalam satuan_baku)
    FOR l_item IN SELECT * FROM public.ledger_stok WHERE ref_order_id = NEW.id AND tipe = 'pemakaian' AND qty < 0 LOOP
      INSERT INTO public.ledger_stok (
        outlet_id,
        bahan_baku_id,
        tipe,
        qty,
        catatan,
        ref_order_id,
        created_at
      ) VALUES (
        l_item.outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        ABS(l_item.qty),
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to Orders table
DROP TRIGGER IF EXISTS trg_orders_bom_stok ON public.orders;
CREATE TRIGGER trg_orders_bom_stok
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_bom_stok();
