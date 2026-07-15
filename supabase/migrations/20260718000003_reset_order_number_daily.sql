-- Update function to generate order_number, resetting daily based on Asia/Jakarta timezone
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
