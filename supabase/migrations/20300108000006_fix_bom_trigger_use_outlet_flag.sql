-- 20300108000006_fix_bom_trigger_use_outlet_flag.sql
-- Mengganti guard allowlist yang menggunakan string global_settings
-- menjadi cek langsung ke kolom is_bom_enabled di tabel outlets.

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec     RECORD;
  r_item  RECORD;
  l_item  RECORD;
  p_item  RECORD;
  v_resep_id        UUID;
  v_is_bom_enabled  BOOLEAN;
  v_is_package      BOOLEAN;
  v_selected_item_id UUID;
  v_item_label      TEXT;
  v_child_label     TEXT;
  v_divisor         NUMERIC;
BEGIN
  -- Guard Pawoon
  IF NEW.external_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Guard BOM Enabled (Menggunakan kolom is_bom_enabled dari tabel outlets)
  SELECT is_bom_enabled INTO v_is_bom_enabled
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  IF v_is_bom_enabled IS NULL OR v_is_bom_enabled = false THEN
    RETURN NEW;
  END IF;

  -- ================================================================
  -- ORDER COMPLETED -> potong stok BOM
  -- ================================================================
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    FOR rec IN
      SELECT menu_item_id, quantity, package_choices, menu_item_name
      FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF rec.menu_item_id IS NULL THEN CONTINUE; END IF;

      v_item_label := COALESCE(NULLIF(split_part(rec.menu_item_name, '|', 1), ''), 'Item');
      SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;

      IF v_is_package THEN
        -- ---- PAKET / COMBO ----
        FOR p_item IN
          SELECT id, menu_item_id, or_menu_item_id, quantity
          FROM public.menu_packages WHERE package_id = rec.menu_item_id
        LOOP
          v_selected_item_id := p_item.menu_item_id;

          IF rec.package_choices IS NOT NULL
             AND (rec.package_choices->>p_item.id::text) IS NOT NULL THEN
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
              SELECT ri.bahan_baku_id,
                     ri.qty_per_porsi,
                     b.faktor_konversi
              FROM public.resep_item ri
              JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              WHERE ri.resep_id = v_resep_id
            LOOP
              -- FIX: ganti INSERT langsung dengan waterfall (scale-aware)
              -- FIX: divisor = faktor PENUH (faktor_tampilan) kalau bahan punya
              -- faktor_tengah (chain 3-tingkat berlaku); selain itu faktor_konversi.
              SELECT CASE WHEN b2.faktor_tengah IS NOT NULL AND b2.faktor_tampilan IS NOT NULL
                          THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
                INTO v_divisor
              FROM public.bahan_baku b2
              WHERE b2.id = r_item.bahan_baku_id;
              IF v_divisor IS NULL OR v_divisor = 0 THEN
                v_divisor := r_item.faktor_konversi;
              END IF;
              PERFORM public.process_waterfall_deduction(
                NEW.outlet_id,
                r_item.bahan_baku_id,
                r_item.qty_per_porsi * rec.quantity * p_item.quantity / v_divisor,
                'Penjualan Paket #' || COALESCE(NEW.order_number::text, 'N/A')
                  || ' (' || v_item_label || ' > ' || v_child_label || ')',
                NEW.id
              );
            END LOOP;
          END IF;
        END LOOP;

      ELSE
        -- ---- NORMAL ITEM ----
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
            SELECT ri.bahan_baku_id,
                   ri.qty_per_porsi,
                   b.faktor_konversi
            FROM public.resep_item ri
            JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
            WHERE ri.resep_id = v_resep_id
          LOOP
            -- FIX: ganti INSERT langsung dengan waterfall (scale-aware)
            -- -> to_ledger_scale() akan konversi ke gram jika outlet saldo_is_gram=true
            -- FIX: divisor = faktor PENUH (faktor_tampilan) kalau bahan punya
            -- faktor_tengah (chain 3-tingkat berlaku); selain itu faktor_konversi.
            SELECT CASE WHEN b2.faktor_tengah IS NOT NULL AND b2.faktor_tampilan IS NOT NULL
                        THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
              INTO v_divisor
            FROM public.bahan_baku b2
            WHERE b2.id = r_item.bahan_baku_id;
            IF v_divisor IS NULL OR v_divisor = 0 THEN
              v_divisor := r_item.faktor_konversi;
            END IF;
            PERFORM public.process_waterfall_deduction(
              NEW.outlet_id,
              r_item.bahan_baku_id,
              r_item.qty_per_porsi * rec.quantity / v_divisor,
              'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A')
                || ' (' || v_item_label || ')',
              NEW.id
            );
          END LOOP;
        END IF;
      END IF;
    END LOOP;

  -- ================================================================
  -- ORDER DIBATALKAN -> kembalikan stok (reverse net per bahan, idempoten)
  -- ================================================================
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
$function$;
