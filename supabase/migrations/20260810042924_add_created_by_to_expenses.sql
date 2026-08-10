ALTER TABLE public.expenses 
ADD COLUMN created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL;
