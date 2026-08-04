-- Backfill to fix online orders that were incorrectly categorized as POS
-- because the incoming API only set `source` instead of `sales_source`.
UPDATE public.orders
SET sales_source = 'online'
WHERE notes ILIKE '%info pemesan online%'
  AND sales_source = 'pos';
