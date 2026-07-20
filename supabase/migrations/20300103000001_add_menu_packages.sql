-- Migration to add Menu Packages functionality

-- 1. Add is_package column to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS is_package BOOLEAN DEFAULT false;

-- 2. Create menu_packages table
CREATE TABLE IF NOT EXISTS public.menu_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT menu_packages_prevent_self_ref CHECK (package_id != menu_item_id)
);

-- 3. RLS for menu_packages
ALTER TABLE public.menu_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_packages_select_public" ON public.menu_packages FOR SELECT USING (true);
CREATE POLICY "menu_packages_all_admin" ON public.menu_packages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role = 'admin'
  )
);

-- 4. Update the BOM Automation Trigger to handle packages
CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  p_item RECORD;
  v_resep_id UUID;
  v_allowed_outlets TEXT;
  v_is_package BOOLEAN;
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
        -- Check if it's a package
        SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;
        
        IF v_is_package THEN
          -- Loop through package items
          FOR p_item IN SELECT menu_item_id, quantity FROM public.menu_packages WHERE package_id = rec.menu_item_id LOOP
            -- Find the active recipe for this child item
            v_resep_id := NULL;
            SELECT id INTO v_resep_id
            FROM public.resep
            WHERE menu_item_ref = p_item.menu_item_id::text
              AND is_active = true
              AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
            ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
            LIMIT 1;

            -- If recipe found, deduct its materials (qty = item_qty * package_multiplier * req_qty / konversi)
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
                  -(r_item.qty_per_porsi * rec.quantity * p_item.quantity / r_item.faktor_konversi),
                  'Penjualan Paket #' || COALESCE(NEW.order_number::text, 'N/A'),
                  NEW.id,
                  NOW()
                );
              END LOOP;
            END IF;
          END LOOP;
        ELSE
          -- Normal item (Original logic)
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

-- Not modifying trigger attachment because the function name is exactly the same and REPLACE was used.
