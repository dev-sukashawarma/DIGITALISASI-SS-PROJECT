-- Add usage limit feature for outlet_promos
ALTER TABLE outlet_promos
ADD COLUMN usage_limit INTEGER DEFAULT NULL,
ADD COLUMN current_usage INTEGER DEFAULT 0 NOT NULL;

-- Function to safely increment promo usage
CREATE OR REPLACE FUNCTION increment_promo_usage(p_promo_id UUID, p_increment_amount INTEGER DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage_limit INTEGER;
  v_current_usage INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT usage_limit, current_usage INTO v_usage_limit, v_current_usage
  FROM outlet_promos
  WHERE id = p_promo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- If no limit, just increment (or do nothing, but for tracking it might be useful to increment)
  IF v_usage_limit IS NULL THEN
    UPDATE outlet_promos
    SET current_usage = current_usage + p_increment_amount
    WHERE id = p_promo_id;
    RETURN TRUE;
  END IF;

  -- Check if limit exceeded
  IF (v_current_usage + p_increment_amount) > v_usage_limit THEN
    RETURN FALSE; -- Cannot apply promo
  END IF;

  -- Increment usage
  UPDATE outlet_promos
  SET current_usage = current_usage + p_increment_amount
  WHERE id = p_promo_id;

  RETURN TRUE;
END;
$$;
