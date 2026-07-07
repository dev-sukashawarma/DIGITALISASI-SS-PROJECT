-- 1. Drop unique constraint on order_number
DO $$ 
DECLARE
  constraint_name text;
BEGIN
  -- Find the unique constraint for order_number in orders table
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = connamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'orders'
    AND con.contype = 'u'
    AND con.conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'order_number');
    
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- 2. Drop the sequence default from order_number
ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.orders_order_number_seq CASCADE;

-- 3. Create function to generate order_number per outlet, per day
CREATE OR REPLACE FUNCTION public.generate_daily_outlet_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  -- Find the highest order_number for this outlet TODAY
  -- If none exists, start at 1
  SELECT COALESCE(MAX(order_number), 0) + 1 INTO next_num
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') = DATE(COALESCE(NEW.created_at, NOW()) AT TIME ZONE 'Asia/Jakarta');

  NEW.order_number := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;
CREATE TRIGGER trigger_generate_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_daily_outlet_order_number();
