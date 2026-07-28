-- ============================================================
-- MIGRATION: PRESERVE OFFLINE ORDER NUMBER
-- Jalankan di Supabase SQL Editor.
-- ============================================================
-- Memodifikasi function set_order_number() agar tidak 
-- menimpa order_number yang sudah dikirim secara eksplisit 
-- (khususnya untuk order offline yang menggunakan angka 9000+)

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  -- Jika order_number sudah di-set (misal dari offline order 9001+),
  -- biarkan saja nilainya dan kembalikan NEW tanpa mengubah counter
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO outlet_order_counters (outlet_id, last_number)
  VALUES (NEW.outlet_id, 1)
  ON CONFLICT (outlet_id)
  DO UPDATE SET last_number = outlet_order_counters.last_number + 1
  RETURNING last_number INTO next_num;

  NEW.order_number := next_num;
  RETURN NEW;
END;
$$;
