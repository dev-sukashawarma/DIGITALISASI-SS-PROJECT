-- Tanggal outlet dinonaktifkan. Diisi otomatis oleh trigger saat outlet berpindah
-- ke nonaktif, dikosongkan saat aktif lagi. Outlet yang sudah nonaktif sebelum
-- migration ini diisi perkiraan: penjualan terakhir, cadangan updated_at.

ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS nonaktif_at timestamptz;

CREATE OR REPLACE FUNCTION public.outlets_catat_nonaktif()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_baru boolean := NEW.status = 'inactive' OR (NEW.status IS NULL AND NOT NEW.is_active);
  v_lama boolean := TG_OP = 'UPDATE'
    AND (OLD.status = 'inactive' OR (OLD.status IS NULL AND NOT OLD.is_active));
BEGIN
  IF v_baru AND NOT v_lama THEN
    NEW.nonaktif_at := now();
  ELSIF NOT v_baru THEN
    NEW.nonaktif_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_outlets_catat_nonaktif ON public.outlets;
CREATE TRIGGER trg_outlets_catat_nonaktif
  BEFORE INSERT OR UPDATE OF status, is_active ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.outlets_catat_nonaktif();

UPDATE public.outlets o
SET nonaktif_at = COALESCE(
  (SELECT max(x.created_at) FROM public.orders x WHERE x.outlet_id = o.id),
  o.updated_at)
WHERE o.nonaktif_at IS NULL
  AND (o.status = 'inactive' OR (o.status IS NULL AND NOT o.is_active))
  AND o.type IN ('internal','mitra');
