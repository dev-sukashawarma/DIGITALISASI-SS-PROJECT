-- 1. Remove the DEFAULT from order_number (so it doesn't use the global SERIAL sequence)
ALTER TABLE orders ALTER COLUMN order_number DROP DEFAULT;

-- 2. Drop the UNIQUE constraint on order_number.
-- By default, a SERIAL UNIQUE column in Postgres might create a constraint named 'orders_order_number_key'.
-- We drop it so multiple outlets can have the same order_number (e.g., 1, 2, 3) without conflicting.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key1;

-- 3. Create the function that assigns the next sequential number per outlet per day
CREATE OR REPLACE FUNCTION assign_order_number_fn()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  -- We only assign if order_number is not explicitly provided
  IF NEW.order_number IS NULL THEN
    -- Get the max order_number for this specific outlet on the same day (Jakarta time)
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO next_num
    FROM orders
    WHERE outlet_id = NEW.outlet_id
      AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') = DATE(NEW.created_at AT TIME ZONE 'Asia/Jakarta');
      
    NEW.order_number := next_num;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger to execute BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_assign_order_number ON orders;
CREATE TRIGGER trigger_assign_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION assign_order_number_fn();
