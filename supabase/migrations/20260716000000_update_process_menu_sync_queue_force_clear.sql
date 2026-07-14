-- Update process_menu_sync_queue to clear force_available_menu_ids when stock is replenished

CREATE OR REPLACE FUNCTION public.process_menu_sync_queue()
RETURNS void AS $$
DECLARE
    v_outlet_id UUID;
    v_menu_item_ref TEXT;
    v_is_unavailable BOOLEAN;
    v_auto_settings_value TEXT;
    v_force_settings_value TEXT;
    v_auto_ids TEXT[];
    v_new_auto_ids TEXT[];
    v_force_ids TEXT[];
    v_new_force_ids TEXT[];
BEGIN
    -- Temporary table to hold distinct outlet/menu pairs
    CREATE TEMP TABLE IF NOT EXISTS tmp_processing_queue ON COMMIT DROP AS
    SELECT DISTINCT outlet_id, menu_item_ref 
    FROM public.menu_sync_queue;

    -- Delete them from real queue
    DELETE FROM public.menu_sync_queue
    WHERE (outlet_id, menu_item_ref) IN (SELECT outlet_id, menu_item_ref FROM tmp_processing_queue);

    -- Loop outlets
    FOR v_outlet_id IN SELECT DISTINCT outlet_id FROM tmp_processing_queue LOOP
        
        -- Get current auto_unavailable_menu_ids from kiosk_settings
        SELECT value INTO v_auto_settings_value
        FROM public.kiosk_settings
        WHERE outlet_id = v_outlet_id AND key = 'auto_unavailable_menu_ids';

        IF v_auto_settings_value IS NULL OR v_auto_settings_value = '' THEN
            v_auto_ids := ARRAY[]::TEXT[];
        ELSE
            SELECT ARRAY(SELECT jsonb_array_elements_text(v_auto_settings_value::jsonb)) INTO v_auto_ids;
        END IF;

        -- Get current force_available_menu_ids from kiosk_settings
        SELECT value INTO v_force_settings_value
        FROM public.kiosk_settings
        WHERE outlet_id = v_outlet_id AND key = 'force_available_menu_ids';

        IF v_force_settings_value IS NULL OR v_force_settings_value = '' THEN
            v_force_ids := ARRAY[]::TEXT[];
        ELSE
            SELECT ARRAY(SELECT jsonb_array_elements_text(v_force_settings_value::jsonb)) INTO v_force_ids;
        END IF;

        v_new_auto_ids := v_auto_ids;
        v_new_force_ids := v_force_ids;

        -- Check each menu for this outlet
        FOR v_menu_item_ref IN SELECT menu_item_ref FROM tmp_processing_queue WHERE outlet_id = v_outlet_id LOOP
            
            -- Check if any ingredient is insufficient
            -- We assume insufficient if saldo < qty_per_porsi OR saldo is null
            SELECT EXISTS (
                SELECT 1
                FROM public.resep res
                JOIN public.resep_item ri ON res.id = ri.resep_id
                LEFT JOIN public.stok_balance sb 
                  ON sb.bahan_baku_id = ri.bahan_baku_id 
                 AND sb.outlet_id = v_outlet_id
                WHERE res.menu_item_ref = v_menu_item_ref
                  AND (res.scope = 'global' OR res.outlet_id = v_outlet_id)
                  AND res.is_active = true
                  AND (sb.saldo IS NULL OR sb.saldo < ri.qty_per_porsi)
            ) INTO v_is_unavailable;

            IF v_is_unavailable THEN
                -- Add to auto array if not present
                IF NOT (v_menu_item_ref = ANY(v_new_auto_ids)) THEN
                    v_new_auto_ids := array_append(v_new_auto_ids, v_menu_item_ref);
                END IF;
            ELSE
                -- Remove from auto array if present
                IF (v_menu_item_ref = ANY(v_new_auto_ids)) THEN
                    v_new_auto_ids := array_remove(v_new_auto_ids, v_menu_item_ref);
                END IF;
                -- Also remove from force_available array because the item is back in stock
                IF (v_menu_item_ref = ANY(v_new_force_ids)) THEN
                    v_new_force_ids := array_remove(v_new_force_ids, v_menu_item_ref);
                END IF;
            END IF;

        END LOOP;

        -- Update kiosk_settings if auto array changed
        IF v_auto_ids <> v_new_auto_ids THEN
            INSERT INTO public.kiosk_settings (outlet_id, key, value)
            VALUES (v_outlet_id, 'auto_unavailable_menu_ids', to_jsonb(v_new_auto_ids)::text)
            ON CONFLICT (outlet_id, key) 
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        END IF;

        -- Update kiosk_settings if force array changed
        IF v_force_ids <> v_new_force_ids THEN
            INSERT INTO public.kiosk_settings (outlet_id, key, value)
            VALUES (v_outlet_id, 'force_available_menu_ids', to_jsonb(v_new_force_ids)::text)
            ON CONFLICT (outlet_id, key) 
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        END IF;

    END LOOP;

    DROP TABLE tmp_processing_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
