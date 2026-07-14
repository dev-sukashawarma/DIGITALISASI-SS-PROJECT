-- 20260714000000_auto_toggle_menu_queue.sql

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table to queue menu items that need to be re-evaluated
CREATE TABLE IF NOT EXISTS public.menu_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    menu_item_ref TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(outlet_id, menu_item_ref)
);

CREATE INDEX IF NOT EXISTS idx_menu_sync_queue_outlet ON public.menu_sync_queue(outlet_id);

-- Function to queue dirty menus when stock balance changes
CREATE OR REPLACE FUNCTION public.trg_queue_menu_sync()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
    has_queued BOOLEAN := false;
    v_url TEXT;
    v_key TEXT;
    v_req_id BIGINT;
BEGIN
    -- We only care if saldo changed
    IF (TG_OP = 'UPDATE' AND OLD.saldo = NEW.saldo) THEN
        RETURN NEW;
    END IF;

    -- Find all menus that depend on this raw material
    FOR r IN (
        SELECT r.menu_item_ref
        FROM public.resep r
        JOIN public.resep_item ri ON r.id = ri.resep_id
        WHERE ri.bahan_baku_id = NEW.bahan_baku_id
          AND r.menu_item_ref IS NOT NULL
          AND r.is_active = true
          AND (r.scope = 'global' OR r.outlet_id = NEW.outlet_id)
    ) LOOP
        INSERT INTO public.menu_sync_queue (outlet_id, menu_item_ref)
        VALUES (NEW.outlet_id, r.menu_item_ref)
        ON CONFLICT (outlet_id, menu_item_ref) DO NOTHING;
        
        has_queued := true;
    END LOOP;

    -- If we added something to the queue, notify the edge function
    IF has_queued THEN
        BEGIN
            v_url := current_setting('app.settings.edge_function_url', true);
            v_key := current_setting('app.settings.service_role_key', true);
            
            IF v_url IS NOT NULL AND v_key IS NOT NULL AND v_url <> '' AND v_key <> '' THEN
                SELECT net.http_post(
                    url := v_url || '/auto-toggle-menu',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_key
                    ),
                    body := jsonb_build_object('source', 'database_trigger', 'outlet_id', NEW.outlet_id)
                ) INTO v_req_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to trigger auto-toggle-menu edge function: %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on stok_balance
DROP TRIGGER IF EXISTS trg_stok_balance_menu_sync ON public.stok_balance;

CREATE TRIGGER trg_stok_balance_menu_sync
AFTER INSERT OR UPDATE ON public.stok_balance
FOR EACH ROW
EXECUTE FUNCTION public.trg_queue_menu_sync();

-- RPC Function to process the queue (called by Edge Function)
CREATE OR REPLACE FUNCTION public.process_menu_sync_queue()
RETURNS void AS $$
DECLARE
    r RECORD;
    v_outlet_id UUID;
    v_menu_item_ref TEXT;
    v_is_unavailable BOOLEAN;
    v_current_auto_ids UUID[]; -- Actually menu_item_ref is TEXT, assuming it's UUID internally, but let's store as text or UUID. 
    -- wait, kiosk_settings value is TEXT (usually stringified JSON).
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
            
            -- Check if any ingredient is insufficient
            -- We assume insufficient if saldo < qty_per_porsi OR saldo is null
            SELECT EXISTS (
                SELECT 1
                FROM public.resep r
                JOIN public.resep_item ri ON r.id = ri.resep_id
                LEFT JOIN public.stok_balance sb 
                  ON sb.bahan_baku_id = ri.bahan_baku_id 
                 AND sb.outlet_id = v_outlet_id
                WHERE r.menu_item_ref = v_menu_item_ref
                  AND (r.scope = 'global' OR r.outlet_id = v_outlet_id)
                  AND r.is_active = true
                  AND (sb.saldo IS NULL OR sb.saldo < ri.qty_per_porsi)
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
