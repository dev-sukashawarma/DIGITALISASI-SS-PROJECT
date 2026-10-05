-- 20261005120000_outlet_status_pending_active_soft_delete.sql
-- Penambahan status outlet (active, pending, inactive) & soft delete pelindung data omzet historis

SET lock_timeout = '5s';

-- 1. Tambah kolom status dan deleted_at pada outlets
ALTER TABLE public.outlets 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.outlets 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Tambah CHECK constraint untuk nilai status
ALTER TABLE public.outlets DROP CONSTRAINT IF EXISTS outlets_status_check;
ALTER TABLE public.outlets ADD CONSTRAINT outlets_status_check 
  CHECK (status IN ('active', 'pending', 'inactive'));

-- 3. Backfill data eksisting: sesuaikan status dengan is_active
UPDATE public.outlets 
SET status = CASE 
  WHEN is_active = false THEN 'inactive' 
  ELSE 'active' 
END
WHERE status IS NULL OR status NOT IN ('active', 'pending', 'inactive');

-- 4. Indeks performa tinggi untuk penyaringan status
CREATE INDEX IF NOT EXISTS idx_outlets_status ON public.outlets(status);
CREATE INDEX IF NOT EXISTS idx_outlets_status_is_active ON public.outlets(status, is_active);

-- 5. Trigger penyelarasan dua arah antara status dan is_active
CREATE OR REPLACE FUNCTION public.sync_outlet_status_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika status diubah atau diset saat INSERT
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'active' THEN
      NEW.is_active := true;
      NEW.deleted_at := NULL;
    ELSIF NEW.status = 'pending' THEN
      NEW.is_active := false;
      NEW.deleted_at := NULL;
    ELSIF NEW.status = 'inactive' THEN
      NEW.is_active := false;
      NEW.deleted_at := COALESCE(NEW.deleted_at, NOW());
    END IF;
  -- Jika is_active diubah tanpa menyetel status (kompatibilitas kode lama)
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = true THEN
      NEW.status := 'active';
      NEW.deleted_at := NULL;
    ELSE
      -- Jika sebelumnya pending, tetap pending; jika active, menjadi inactive
      IF OLD.status <> 'pending' THEN
        NEW.status := 'inactive';
      END IF;
      NEW.deleted_at := COALESCE(NEW.deleted_at, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_outlet_status_active ON public.outlets;
CREATE TRIGGER trg_sync_outlet_status_active
  BEFORE INSERT OR UPDATE OF status, is_active ON public.outlets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_outlet_status_active();

-- 6. Perbarui view valid_operational_outlets: Kecualikan outlet pending & nonaktif
CREATE OR REPLACE VIEW public.valid_operational_outlets AS
SELECT o.id, o.name, o.slug, o.type
FROM public.outlets o
WHERE o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
  AND LOWER(o.name) NOT LIKE '%tes%'
  AND LOWER(o.name) NOT LIKE '%test%'
  AND LOWER(o.name) NOT LIKE '%trial%'
  AND LOWER(o.name) NOT LIKE '%demo%'
  AND (o.type IS NULL OR o.type != 'marketplace')
  AND o.is_active = true
  AND COALESCE(o.status, 'active') = 'active';

GRANT SELECT ON public.valid_operational_outlets TO anon, authenticated, service_role;

-- 7. Perbarui function outlet_ids_terhitung(): Kecualikan outlet pending dari laporan/HPP
CREATE OR REPLACE FUNCTION public.outlet_ids_terhitung()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id
  FROM public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
    AND COALESCE(o.type, '') <> 'test'
    AND COALESCE(o.status, 'active') <> 'pending';
$function$;

GRANT EXECUTE ON FUNCTION public.outlet_ids_terhitung() TO authenticated;

-- 8. Perbarui function get_current_targets(): Hanya outlet beroperasi aktif
CREATE OR REPLACE FUNCTION public.get_current_targets()
RETURNS TABLE (
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  per_item_bonus NUMERIC,
  is_override   BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    public.resolve_per_item_bonus(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    EXISTS (SELECT 1 FROM public.daily_sales_targets t WHERE t.outlet_id = o.id)
  FROM public.outlets o
  WHERE o.is_active = true AND COALESCE(o.status, 'active') = 'active'
  ORDER BY o.name;
$$;
