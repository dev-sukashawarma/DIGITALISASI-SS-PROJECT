-- Fix variable shadowing in trg_queue_menu_sync
-- Rename the loop variable to `rec` to avoid conflict with `public.resep r` alias,
-- or rename the alias to `res`. We will rename the alias to `res` and loop var to `rec`.

CREATE OR REPLACE FUNCTION public.trg_queue_menu_sync()
RETURNS TRIGGER AS $$
DECLARE
    rec RECORD;
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
