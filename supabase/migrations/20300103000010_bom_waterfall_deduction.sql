-- 20300103000010_bom_waterfall_deduction.sql
-- Fitur: Substitusi otomatis (Waterfall Deduction) untuk bahan baku yang memiliki varian kemasan
-- (misal Pouch vs Kompan). Jika barang utama habis, sisa potongan dilimpahkan ke barang pengganti.

CREATE TABLE IF NOT EXISTS public.bahan_baku_substitusi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bahan_baku_utama_id uuid REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  bahan_baku_pengganti_id uuid REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  urutan integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Hapus data lama (jika ada) untuk memastikan bersih
TRUNCATE TABLE public.bahan_baku_substitusi;

-- Mengisi mapping substitusi awal (Saos Cabe Pouch -> Kompan, Saos Tomat Pouch -> Kompan)
DO $$
DECLARE
  v_cabe_pouch UUID;
  v_cabe_kompan UUID;
  v_tomat_pouch UUID;
  v_tomat_kompan UUID;
BEGIN
  SELECT id INTO v_cabe_pouch FROM public.bahan_baku WHERE nama = 'SAOS CABE POUCH' LIMIT 1;
  SELECT id INTO v_cabe_kompan FROM public.bahan_baku WHERE nama = 'SAOS CABE' LIMIT 1; -- Saat ini bernama SAOS CABE
  
  SELECT id INTO v_tomat_pouch FROM public.bahan_baku WHERE nama = 'SAOS TOMAT POUCH' LIMIT 1;
  SELECT id INTO v_tomat_kompan FROM public.bahan_baku WHERE nama = 'SAOS TOMAT KOMPAN' LIMIT 1;

  IF v_cabe_pouch IS NOT NULL AND v_cabe_kompan IS NOT NULL THEN
    INSERT INTO public.bahan_baku_substitusi (bahan_baku_utama_id, bahan_baku_pengganti_id, urutan)
    VALUES (v_cabe_pouch, v_cabe_kompan, 1);
  END IF;

  IF v_tomat_pouch IS NOT NULL AND v_tomat_kompan IS NOT NULL THEN
    INSERT INTO public.bahan_baku_substitusi (bahan_baku_utama_id, bahan_baku_pengganti_id, urutan)
    VALUES (v_tomat_pouch, v_tomat_kompan, 1);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_waterfall_deduction(
  p_outlet_id UUID,
  p_bahan_baku_id UUID,
  p_total_deduction NUMERIC,
  p_catatan TEXT,
  p_ref_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining_deduction NUMERIC := p_total_deduction;
  v_current_stock NUMERIC;
  v_qty_to_deduct NUMERIC;
  sub_rec RECORD;
BEGIN
  -- Try to deduct from primary item first
  SELECT saldo INTO v_current_stock FROM public.stok_balance 
  WHERE outlet_id = p_outlet_id AND bahan_baku_id = p_bahan_baku_id;
  v_current_stock := COALESCE(v_current_stock, 0);

  IF v_current_stock >= v_remaining_deduction THEN
    v_qty_to_deduct := v_remaining_deduction;
    v_remaining_deduction := 0;
  ELSE
    IF EXISTS (SELECT 1 FROM public.bahan_baku_substitusi WHERE bahan_baku_utama_id = p_bahan_baku_id) THEN
      IF v_current_stock > 0 THEN
        v_qty_to_deduct := v_current_stock;
        v_remaining_deduction := v_remaining_deduction - v_current_stock;
      ELSE
        v_qty_to_deduct := 0;
      END IF;
    ELSE
      v_qty_to_deduct := v_remaining_deduction;
      v_remaining_deduction := 0;
    END IF;
  END IF;

  IF v_qty_to_deduct > 0 THEN
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_qty_to_deduct, p_catatan, p_ref_order_id, NOW()
    );
  END IF;

  -- Process substitutes if there's remaining deduction
  WHILE v_remaining_deduction > 0 LOOP
    FOR sub_rec IN SELECT bahan_baku_pengganti_id FROM public.bahan_baku_substitusi 
                   WHERE bahan_baku_utama_id = p_bahan_baku_id ORDER BY urutan ASC LOOP
      
      SELECT saldo INTO v_current_stock FROM public.stok_balance 
      WHERE outlet_id = p_outlet_id AND bahan_baku_id = sub_rec.bahan_baku_pengganti_id;
      v_current_stock := COALESCE(v_current_stock, 0);
      
      IF v_current_stock >= v_remaining_deduction THEN
         v_qty_to_deduct := v_remaining_deduction;
         v_remaining_deduction := 0;
      ELSE
         IF v_current_stock > 0 THEN
           v_qty_to_deduct := v_current_stock;
           v_remaining_deduction := v_remaining_deduction - v_current_stock;
         ELSE
           v_qty_to_deduct := 0;
         END IF;
      END IF;
      
      IF v_qty_to_deduct > 0 THEN
        INSERT INTO public.ledger_stok (
          outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
        ) VALUES (
          p_outlet_id, sub_rec.bahan_baku_pengganti_id, 'pemakaian', -v_qty_to_deduct, p_catatan, p_ref_order_id, NOW()
        );
      END IF;
      
      EXIT WHEN v_remaining_deduction <= 0;
    END LOOP;
    
    -- Force deduct remainder from primary item
    IF v_remaining_deduction > 0 THEN
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
      ) VALUES (
        p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_remaining_deduction, p_catatan, p_ref_order_id, NOW()
      );
      v_remaining_deduction := 0;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  p_item RECORD;
  v_resep_id UUID;
  v_allowed_outlets TEXT;
  v_is_package BOOLEAN;
  v_selected_item_id UUID;
  v_item_label TEXT;
  v_child_label TEXT;
BEGIN
  IF NEW.external_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_allowed_outlets FROM public.global_settings
    WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NULL
     OR NOT (NEW.outlet_id::text = ANY (string_to_array(v_allowed_outlets, ','))) THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    FOR rec IN SELECT menu_item_id, quantity, package_choices, menu_item_name
               FROM public.order_items WHERE order_id = NEW.id LOOP
      IF rec.menu_item_id IS NOT NULL THEN

        v_item_label := COALESCE(NULLIF(split_part(rec.menu_item_name, '|', 1), ''), 'Item');

        SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;

        IF v_is_package THEN
          FOR p_item IN SELECT id, menu_item_id, or_menu_item_id, quantity FROM public.menu_packages WHERE package_id = rec.menu_item_id LOOP
            v_selected_item_id := p_item.menu_item_id;

            IF rec.package_choices IS NOT NULL AND (rec.package_choices->>p_item.id::text) IS NOT NULL THEN
              v_selected_item_id := (rec.package_choices->>p_item.id::text)::uuid;
            END IF;

            SELECT name INTO v_child_label FROM public.menu_items WHERE id = v_selected_item_id;
            v_child_label := COALESCE(NULLIF(v_child_label, ''), 'Komponen');

            v_resep_id := NULL;
            SELECT id INTO v_resep_id
            FROM public.resep
            WHERE menu_item_ref = v_selected_item_id::text
              AND is_active = true
              AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
            ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
            LIMIT 1;

            IF v_resep_id IS NOT NULL THEN
              FOR r_item IN
                SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
                FROM public.resep_item ri
                JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
                WHERE ri.resep_id = v_resep_id
              LOOP
                PERFORM public.process_waterfall_deduction(
                  NEW.outlet_id,
                  r_item.bahan_baku_id,
                  (r_item.qty_per_porsi * rec.quantity * p_item.quantity / r_item.faktor_konversi),
                  'Penjualan Paket #' || COALESCE(NEW.order_number::text, 'N/A') || ' (' || v_item_label || ' > ' || v_child_label || ')',
                  NEW.id
                );
              END LOOP;
            END IF;
          END LOOP;
        ELSE
          v_resep_id := NULL;
          SELECT id INTO v_resep_id
          FROM public.resep
          WHERE menu_item_ref = rec.menu_item_id::text
            AND is_active = true
            AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
          ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
          LIMIT 1;

          IF v_resep_id IS NOT NULL THEN
            FOR r_item IN
              SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
              FROM public.resep_item ri
              JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              WHERE ri.resep_id = v_resep_id
            LOOP
              PERFORM public.process_waterfall_deduction(
                NEW.outlet_id,
                r_item.bahan_baku_id,
                (r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi),
                'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A') || ' (' || v_item_label || ')',
                NEW.id
              );
            END LOOP;
          END IF;
        END IF;
      END IF;
    END LOOP;

  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

    FOR l_item IN
      SELECT bahan_baku_id, SUM(qty) AS net_qty
      FROM public.ledger_stok
      WHERE ref_order_id = NEW.id AND tipe IN ('pemakaian', 'adjustment')
      GROUP BY bahan_baku_id
      HAVING SUM(qty) < 0
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
      ) VALUES (
        NEW.outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        -l_item.net_qty,
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;
