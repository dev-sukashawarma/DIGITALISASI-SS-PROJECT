-- Force sync all menus
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Queue all active recipes for all relevant outlets
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

    -- Process the queue synchronously
    PERFORM public.process_menu_sync_queue();
END;
$$;
