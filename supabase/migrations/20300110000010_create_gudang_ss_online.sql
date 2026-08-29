-- 20300110000010_create_gudang_ss_online.sql
-- 1. Insert entitas GUDANG SS ONLINE
-- 2. Inisialisasi stok_balance untuk seluruh bahan_baku aktif
-- 3. Update trg_process_bom_stok() untuk mengarahkan pemotongan BOM pesanan marketplace (TikTok Shop & Shopee) ke GUDANG SS ONLINE

-- 1. Insert GUDANG SS ONLINE
INSERT INTO public.outlets (id, slug, name, lat, lng, type, is_active, is_bom_enabled)
VALUES
  ('d23e11b3-23f1-4f9a-b428-cc73e1aa9b91', 'gudang-ss-online', 'GUDANG SS ONLINE', 0, 0, 'gudang', true, true)
ON CONFLICT (slug) DO UPDATE
SET name = 'GUDANG SS ONLINE', type = 'gudang', is_active = true, is_bom_enabled = true;

-- 2. Inisialisasi stok_balance
INSERT INTO public.stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
SELECT
  'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'::uuid,
  id,
  0,
  NOW()
FROM public.bahan_baku
WHERE is_active = true
ON CONFLICT (outlet_id, bahan_baku_id) DO NOTHING;

-- 3. Update trg_process_bom_stok()
CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec                RECORD;
  r_item             RECORD;
  l_item             RECORD;
  p_item             RECORD;
  v_resep_id         UUID;
  v_is_bom_enabled   BOOLEAN;
  v_is_package       BOOLEAN;
  v_selected_item_id UUID;
  v_item_label       TEXT;
  v_child_label      TEXT;
  v_divisor          NUMERIC;
  v_outlet_type      TEXT;
  v_target_outlet_id UUID;
  v_sso_gudang_id    UUID;
BEGIN
  -- Dapatkan tipe outlet dan status BOM
  SELECT type, is_bom_enabled INTO v_outlet_type, v_is_bom_enabled
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  -- Tentukan target outlet pemotongan stok:
  -- Jika pesanan berasal dari marketplace (TikTok Shop / Shopee), potong dari GUDANG SS ONLINE
  IF v_outlet_type = 'marketplace' OR COALESCE(NEW.sales_source, '') IN ('tiktok_shop', 'shopee_shop') THEN
    SELECT id INTO v_sso_gudang_id FROM public.outlets WHERE slug = 'gudang-ss-online' LIMIT 1;
    v_target_outlet_id := COALESCE(v_sso_gudang_id, 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'::uuid);
    -- Untuk marketplace, pastikan GUDANG SS ONLINE BOM-nya aktif
    SELECT is_bom_enabled INTO v_is_bom_enabled FROM public.outlets WHERE id = v_target_outlet_id;
  ELSE
    -- Guard Pawoon untuk non-marketplace
    IF NEW.external_order_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_target_outlet_id := NEW.outlet_id;
  END IF;

  -- Guard BOM Enabled
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
            AND ( (scope = 'outlet' AND outlet_id = v_target_outlet_id) OR (scope = 'global') )
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
              SELECT CASE WHEN b2.faktor_tengah IS NOT NULL AND b2.faktor_tampilan IS NOT NULL
                          THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
                INTO v_divisor
              FROM public.bahan_baku b2
              WHERE b2.id = r_item.bahan_baku_id;
              IF v_divisor IS NULL OR v_divisor = 0 THEN
                v_divisor := r_item.faktor_konversi;
              END IF;
              PERFORM public.process_waterfall_deduction(
                v_target_outlet_id,
                r_item.bahan_baku_id,
                r_item.qty_per_porsi * rec.quantity * p_item.quantity / v_divisor,
                'Penjualan Paket #' || COALESCE(NEW.order_number::text, NEW.external_order_id, 'N/A')
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
          AND ( (scope = 'outlet' AND outlet_id = v_target_outlet_id) OR (scope = 'global') )
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
            SELECT CASE WHEN b2.faktor_tengah IS NOT NULL AND b2.faktor_tampilan IS NOT NULL
                        THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
              INTO v_divisor
            FROM public.bahan_baku b2
            WHERE b2.id = r_item.bahan_baku_id;
            IF v_divisor IS NULL OR v_divisor = 0 THEN
              v_divisor := r_item.faktor_konversi;
            END IF;
            PERFORM public.process_waterfall_deduction(
              v_target_outlet_id,
              r_item.bahan_baku_id,
              r_item.qty_per_porsi * rec.quantity / v_divisor,
              'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, NEW.external_order_id, 'N/A')
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
        v_target_outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        -l_item.net_qty,
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, NEW.external_order_id, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$function$;
