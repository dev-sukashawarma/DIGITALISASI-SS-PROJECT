-- =============================================================================
-- MIGRATION: CREATE DISCIPLINE_RECORDS TABLE FOR HR DISCIPLINE & WARNING MODULE
-- =============================================================================

-- 1. Create table public.discipline_records
CREATE TABLE IF NOT EXISTS public.discipline_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL CONSTRAINT discipline_records_staff_id_fkey REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  warning_level TEXT NOT NULL CHECK (warning_level IN ('Teguran', 'Teguran Lisan', 'SP1', 'SP2', 'SP3', 'Skorsing')),
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issue_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  expiry_date DATE,
  reason TEXT NOT NULL,
  action_plan TEXT,
  issued_by TEXT DEFAULT 'HR Manager',
  issued_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Trigger for updated_at and bidirectional sync between expires_at and expiry_date
CREATE OR REPLACE FUNCTION public.set_discipline_records_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.expiry_date IS NULL AND NEW.expires_at IS NOT NULL THEN
    NEW.expiry_date := NEW.expires_at;
  ELSIF NEW.expires_at IS NULL AND NEW.expiry_date IS NOT NULL THEN
    NEW.expires_at := NEW.expiry_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discipline_records_timestamps ON public.discipline_records;
CREATE TRIGGER trg_discipline_records_timestamps
  BEFORE INSERT OR UPDATE ON public.discipline_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_discipline_records_timestamps();

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hr_discipline_records_staff 
  ON public.discipline_records (staff_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hr_discipline_records_status 
  ON public.discipline_records (status);

CREATE INDEX IF NOT EXISTS idx_hr_discipline_records_created 
  ON public.discipline_records (created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Allow authenticated select" ON public.discipline_records;
CREATE POLICY "Allow authenticated select"
  ON public.discipline_records
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.discipline_records;
CREATE POLICY "Allow authenticated insert"
  ON public.discipline_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update" ON public.discipline_records;
CREATE POLICY "Allow authenticated update"
  ON public.discipline_records
  FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete" ON public.discipline_records;
CREATE POLICY "Allow authenticated delete"
  ON public.discipline_records
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service_role all" ON public.discipline_records;
CREATE POLICY "Allow service_role all"
  ON public.discipline_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select" ON public.discipline_records;
CREATE POLICY "Allow anon select"
  ON public.discipline_records
  FOR SELECT
  TO anon
  USING (true);

-- 6. Role grants
GRANT ALL ON TABLE public.discipline_records TO postgres, service_role, authenticated;
GRANT SELECT ON TABLE public.discipline_records TO anon;

-- 7. Supabase Realtime & Replica Identity
ALTER TABLE public.discipline_records REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'discipline_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discipline_records;
  END IF;
END $$;

-- 8. Disambiguate outlet_staff -> outlets relationship in PostgREST
ALTER TABLE public.staff_outlets DROP CONSTRAINT IF EXISTS staff_outlets_outlet_id_fkey;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
