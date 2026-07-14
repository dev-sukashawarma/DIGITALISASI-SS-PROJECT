-- 20260716000002_fix_queue_processing_and_conversion.sql

-- 1. Fix the trigger to process the queue synchronously instead of relying on Edge Functions
CREATE OR REPLACE FUNCTION public.trg_queue_menu_sync()
RETURNS TRIGGER AS $$
DECLARE
    rec RECORD;
    has_queued BOOLEAN := false;
BEGIN
    -- We only care if saldo changed
    IF (TG_OP = 'UPDATE' AND OLD.saldo = NEW.saldo) THEN
        RETURN NEW;
    END IF;

    -- Find all menus that depend on this raw material
    FOR rec IN (
        SELECT res.menu_item_ref
        FROM public.resep res
        JOIN public.resep_item ri ON res.id = ri.resep_id
        WHERE ri.bahan_baku_id = NEW.bahan_baku_id
          AND res.menu_item_ref IS NOT NULL
          AND res.is_active = true
          AND (res.scope = 'global' OR res.outlet_id = NEW.outlet_id)
    ) LOOP
        INSERT INTO public.menu_sync_queue (outlet_id, menu_item_ref)
        VALUES (NEW.outlet_id, rec.menu_item_ref)
        ON CONFLICT (outlet_id, menu_item_ref) DO NOTHING;
        
        has_queued := true;
    END LOOP;

    -- Process the queue synchronously if we added anything
    IF has_queued THEN
        PERFORM public.process_menu_sync_queue();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix the unit conversion in process_menu_sync_queue
CREATE OR REPLACE FUNCTION public.process_menu_sync_queue()
RETURNS void AS $$
DECLARE
    v_outlet_id UUID;
    v_menu_item_ref TEXT;
    v_is_unavailable BOOLEAN;
    v_settings_value TEXT;
    v_auto_ids TEXT[];
    v_new_auto_ids TEXT[];
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

        -- Check each menu for this outlet
        FOR v_menu_item_ref IN SELECT menu_item_ref FROM tmp_processing_queue WHERE outlet_id = v_outlet_id LOOP
            
            -- Check if any ingredient is insufficient with unit conversion
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
                              WHEN ri.satuan = 'gram' AND bb.satuan = 'kg' THEN ri.qty_per_porsi / 1000.0
                              WHEN ri.satuan = 'ml' AND bb.satuan = 'liter' THEN ri.qty_per_porsi / 1000.0
                              WHEN ri.satuan = 'kg' AND bb.satuan = 'gram' THEN ri.qty_per_porsi * 1000.0
                              WHEN ri.satuan = 'liter' AND bb.satuan = 'ml' THEN ri.qty_per_porsi * 1000.0
                              ELSE ri.qty_per_porsi
                          END
                      )
                  )
            ) INTO v_is_unavailable;

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

        END LOOP;

        -- Update kiosk_settings if array changed
        IF v_auto_ids <> v_new_auto_ids THEN
            INSERT INTO public.kiosk_settings (outlet_id, key, value)
            VALUES (v_outlet_id, 'auto_unavailable_menu_ids', to_jsonb(v_new_auto_ids)::text)
            ON CONFLICT (outlet_id, key) 
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
