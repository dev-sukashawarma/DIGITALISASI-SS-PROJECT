-- supabase/migrations/20260703000000_bom_automation.sql

-- 1. Add ref_order_id to ledger_stok
ALTER TABLE public.ledger_stok 
ADD COLUMN IF NOT EXISTS ref_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- 2. Create Trigger Function for Automatic BOM Deduction
CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
RETURNS trigger AS $$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  v_resep_id UUID;
BEGIN
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

        -- If recipe found, deduct its materials
        IF v_resep_id IS NOT NULL THEN
          FOR r_item IN SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = v_resep_id LOOP
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
              -(r_item.qty_per_porsi * rec.quantity), 
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
