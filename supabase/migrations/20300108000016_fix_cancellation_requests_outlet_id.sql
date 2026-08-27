-- `OrderRealtimeManager` subscribes to cancellation_requests with an
-- `outlet_id=eq.<uuid>` filter.  Realtime rejects the whole subscription when
-- the filtered column does not exist, which produced the P0001 log storm.
--
-- Derive the outlet from the referenced order in the database so every writer
-- remains compatible, including already-released POS/web clients that do not
-- send outlet_id yet.  The trigger also prevents a caller from assigning a
-- cancellation request to a different outlet than its order.

ALTER TABLE public.cancellation_requests
  ADD COLUMN IF NOT EXISTS outlet_id uuid;

CREATE OR REPLACE FUNCTION public.sync_cancellation_request_outlet_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  derived_outlet_id uuid;
BEGIN
  SELECT orders.outlet_id
    INTO derived_outlet_id
    FROM public.orders
   WHERE orders.id = NEW.order_id;

  IF NOT FOUND OR derived_outlet_id IS NULL THEN
    RAISE EXCEPTION 'cancellation request requires an order with an outlet'
      USING ERRCODE = '23503';
  END IF;

  NEW.outlet_id := derived_outlet_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_cancellation_request_outlet_id
  ON public.cancellation_requests;

CREATE TRIGGER sync_cancellation_request_outlet_id
BEFORE INSERT OR UPDATE OF order_id, outlet_id
ON public.cancellation_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_cancellation_request_outlet_id();

-- Backfill all existing requests before making the invariant mandatory.
UPDATE public.cancellation_requests AS request
   SET outlet_id = orders.outlet_id
  FROM public.orders
 WHERE orders.id = request.order_id
   AND request.outlet_id IS DISTINCT FROM orders.outlet_id;

ALTER TABLE public.cancellation_requests
  ALTER COLUMN outlet_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.cancellation_requests'::regclass
       AND conname = 'cancellation_requests_outlet_id_fkey'
  ) THEN
    ALTER TABLE public.cancellation_requests
      ADD CONSTRAINT cancellation_requests_outlet_id_fkey
      FOREIGN KEY (outlet_id)
      REFERENCES public.outlets(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_outlet_id
  ON public.cancellation_requests (outlet_id);

-- UPDATE and DELETE events must retain outlet_id for filtered Realtime clients.
ALTER TABLE public.cancellation_requests REPLICA IDENTITY FULL;

COMMENT ON COLUMN public.cancellation_requests.outlet_id IS
  'Canonical outlet derived from orders.outlet_id for scoped Realtime delivery.';
