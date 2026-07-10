-- Add prep_time to menu_items
ALTER TABLE "public"."menu_items" 
ADD COLUMN IF NOT EXISTS "prep_time" integer DEFAULT 10;

-- Set specific default prep_times (Drinks usually take 5 mins)
UPDATE "public"."menu_items"
SET "prep_time" = 5
WHERE "category_id" IN (
    SELECT id FROM "public"."categories" 
    WHERE "name" ILIKE '%minuman%' 
    OR "name" ILIKE '%drink%'
);

-- Food usually takes 10 mins (default is 10 already, but to be sure we can set it explicitly if needed)
-- We will just rely on the default for now.

-- Add pickup_time and release_time to orders
ALTER TABLE "public"."orders"
ADD COLUMN IF NOT EXISTS "pickup_time" timestamp with time zone NULL;

ALTER TABLE "public"."orders"
ADD COLUMN IF NOT EXISTS "release_time" timestamp with time zone NULL;

-- Notify schema cache update for PostgREST
NOTIFY pgrst, 'reload schema';
