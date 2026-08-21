ALTER TABLE public.inbound_outbound
DROP CONSTRAINT IF EXISTS inbound_outbound_created_by_fkey;

ALTER TABLE public.inbound_outbound
ADD CONSTRAINT inbound_outbound_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.outlet_staff(id) ON DELETE SET NULL;
