-- Fix process_menu_sync_queue pg_safeupdate error
CREATE OR REPLACE FUNCTION public.process_menu_sync_queue()
RETURNS void AS $$
BEGIN
    DELETE FROM public.menu_sync_queue WHERE outlet_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
