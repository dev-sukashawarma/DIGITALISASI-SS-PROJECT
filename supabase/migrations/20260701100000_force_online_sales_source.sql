-- 20260701100000_force_online_sales_source.sql
-- Trigger untuk memastikan order online tidak terdeteksi sebagai POS Kasir.
-- Jika notes mengandung "info pemesan online" atau "[website]", maka otomatis jadikan online.

CREATE OR REPLACE FUNCTION public.force_online_sales_source()
RETURNS trigger AS $$
BEGIN
  -- Periksa apakah notes mengandung tanda pesanan online
  IF (NEW.notes ILIKE '%info pemesan online%' OR NEW.notes ILIKE '%[website]%') THEN
    NEW.sales_source := 'online';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_force_online_sales_source ON public.orders;
CREATE TRIGGER trg_force_online_sales_source
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.force_online_sales_source();

-- Terapkan secara retroaktif untuk data yang sudah salah (backfill)
UPDATE public.orders
SET sales_source = 'online'
WHERE (notes ILIKE '%info pemesan online%' OR notes ILIKE '%[website]%')
  AND sales_source = 'pos';
