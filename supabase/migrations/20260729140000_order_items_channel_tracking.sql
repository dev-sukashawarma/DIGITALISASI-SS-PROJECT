-- Retroactive migration: documents order_items.channel, which was added
-- directly to the live DB (outside migration history) alongside the
-- channel-aware sales tracking feature (app commit c336b556, 2026-07-29).
-- Idempotent so it is safe to run against an environment that already has
-- the column (production) or one that doesn't (fresh clone / local dev).

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'offline';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_channel_check'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_channel_check
      CHECK (channel = ANY (ARRAY['offline'::text, 'food_apps'::text, 'tiktok_go'::text]));
  END IF;
END $$;
