-- 20260713000000_bom_automation_add_item_name.sql
-- Update trigger to include menu_item_name in the ledger_stok catatan
-- so the frontend can group ledger details by order item.

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Loop through each item in the order. Added menu_item_name for better logging.
    FOR rec IN SELECT menu_item_id, quantity, menu_item_name FROM public.order_items WHERE order_id = NEW.id LOOP
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
              'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A') || ' (' || COALESCE(rec.menu_item_name, 'Item') || ')',
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
        REPLACE(l_item.catatan, 'Penjualan Otomatis', 'Pengembalian Void'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
