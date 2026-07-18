CREATE OR REPLACE FUNCTION check_shift_closing_time()
RETURNS trigger AS $$
DECLARE
  current_hour INT;
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    current_hour := EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'));
    IF current_hour >= 6 AND current_hour < 22 THEN
      RAISE EXCEPTION 'Penutupan petty cash (shift) hanya bisa dilakukan antara jam 22:00 malam hingga 06:00 pagi.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_shift_closing_time ON shifts;
CREATE TRIGGER trigger_check_shift_closing_time
BEFORE UPDATE ON shifts
FOR EACH ROW
EXECUTE FUNCTION check_shift_closing_time();
