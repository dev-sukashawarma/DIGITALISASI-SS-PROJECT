-- Enable realtime for all tables in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Ensure publication exists (it should by default in Supabase, but just in case)
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add all tables in public schema to the publication
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || quote_ident(r.tablename);
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table is already in the publication, ignore
                NULL;
            WHEN OTHERS THEN
                -- If it fails for another reason (e.g. view, system table), log and continue
                RAISE NOTICE 'Skipping % due to error: %', r.tablename, SQLERRM;
        END;
    END LOOP;
END
$$;
