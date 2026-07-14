CREATE OR REPLACE FUNCTION public.process_menu_sync_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_outlet_id UUID;
    v_menu_item_ref TEXT;
    v_settings_value TEXT;
    v_auto_ids TEXT[];
    v_new_auto_ids TEXT[];
    v_is_unavailable BOOLEAN;
BEGIN
    -- Get distinct items to process (in case queue has duplicates somehow)
    CREATE TEMP TABLE IF NOT EXISTS tmp_processing_queue ON COMMIT DROP AS
    SELECT DISTINCT outlet_id, menu_item_ref 
    FROM public.menu_sync_queue;

    -- Delete them from real queue
    DELETE FROM public.menu_sync_queue
    WHERE (outlet_id, menu_item_ref) IN (SELECT outlet_id, menu_item_ref FROM tmp_processing_queue);

    -- Process each unique combination
    FOR v_outlet_id, v_menu_item_ref IN 
        SELECT outlet_id, menu_item_ref FROM tmp_processing_queue
    LOOP
        -- Get current auto_unavailable_menu_ids from kiosk_settings
        SELECT value INTO v_settings_value
        FROM public.kiosk_settings
        WHERE outlet_id = v_outlet_id AND key = 'auto_unavailable_menu_ids';

        IF v_settings_value IS NULL OR v_settings_value = '' THEN
            v_auto_ids := ARRAY[]::TEXT[];
        ELSE
            -- Assume JSON array of strings
            SELECT ARRAY(SELECT jsonb_array_elements_text(v_settings_value::jsonb)) INTO v_auto_ids;
        END IF;

        v_new_auto_ids := v_auto_ids;

        -- Check if any ingredient is out of stock for this menu and outlet
        -- The item is unavailable if AT LEAST ONE required ingredient is missing or insufficient
        SELECT EXISTS (
            SELECT 1
            FROM public.resep res
            JOIN public.resep_item ri ON res.id = ri.resep_id
            JOIN public.bahan_baku bb ON ri.bahan_baku_id = bb.id
            LEFT JOIN public.stok_balance sb 
              ON sb.bahan_baku_id = ri.bahan_baku_id 
             AND sb.outlet_id = v_outlet_id
            WHERE res.menu_item_ref = v_menu_item_ref
              AND (res.scope = 'global' OR res.outlet_id = v_outlet_id)
              AND res.is_active = true
              AND (
                  sb.saldo IS NULL OR 
                  sb.saldo < (
                      CASE 
                          WHEN lower(ri.satuan) = 'gram' AND lower(bb.satuan) = 'kg' THEN ri.qty_per_porsi / 1000.0
                          WHEN lower(ri.satuan) = 'ml' AND lower(bb.satuan) = 'liter' THEN ri.qty_per_porsi / 1000.0
                          WHEN lower(ri.satuan) = 'kg' AND lower(bb.satuan) = 'gram' THEN ri.qty_per_porsi * 1000.0
                          WHEN lower(ri.satuan) = 'liter' AND lower(bb.satuan) = 'ml' THEN ri.qty_per_porsi * 1000.0
                          ELSE ri.qty_per_porsi
                      END
                  )
              )
        ) INTO v_is_unavailable;

        -- Update array based on availability
        IF v_is_unavailable THEN
            -- Add to array if not present
            IF NOT (v_menu_item_ref = ANY(v_new_auto_ids)) THEN
                v_new_auto_ids := array_append(v_new_auto_ids, v_menu_item_ref);
            END IF;
        ELSE
            -- Remove from array if present
            IF (v_menu_item_ref = ANY(v_new_auto_ids)) THEN
                v_new_auto_ids := array_remove(v_new_auto_ids, v_menu_item_ref);
            END IF;
        END IF;

        -- Update kiosk_settings if array changed
        IF v_auto_ids <> v_new_auto_ids THEN
            INSERT INTO public.kiosk_settings (outlet_id, key, value)
            VALUES (v_outlet_id, 'auto_unavailable_menu_ids', to_jsonb(v_new_auto_ids)::text)
            ON CONFLICT (outlet_id, key) 
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        END IF;

    END LOOP;

    DROP TABLE IF EXISTS tmp_processing_queue;
END;
$$;

-- Force sync all menus again to apply the lower() fix
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT res.menu_item_ref, o.id as outlet_id
        FROM public.resep res
        CROSS JOIN public.outlets o
        WHERE res.menu_item_ref IS NOT NULL
          AND res.is_active = true
          AND (res.scope = 'global' OR res.outlet_id = o.id)
    ) LOOP
        INSERT INTO public.menu_sync_queue (outlet_id, menu_item_ref)
        VALUES (r.outlet_id, r.menu_item_ref)
        ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.process_menu_sync_queue();
END;
$$;
