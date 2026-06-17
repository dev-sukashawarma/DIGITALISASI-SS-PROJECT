-- Drop existing restrictive policies if they exist
drop policy if exists surat_jalan_spv_select on surat_jalan;
drop policy if exists surat_jalan_crew_select on surat_jalan;
drop policy if exists surat_jalan_insert on surat_jalan;
drop policy if exists surat_jalan_item_crew_update on surat_jalan_item;

-- Authenticated users can read all surat jalan (master data visibility)
create policy surat_jalan_select
  on surat_jalan
  for select
  using (auth.role() = 'authenticated');

create policy surat_jalan_insert
  on surat_jalan
  for insert
  with check (auth.role() = 'authenticated');

create policy surat_jalan_update
  on surat_jalan
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy surat_jalan_item_select
  on surat_jalan_item
  for select
  using (auth.role() = 'authenticated');

create policy surat_jalan_item_insert
  on surat_jalan_item
  for insert
  with check (auth.role() = 'authenticated');

create policy surat_jalan_item_update
  on surat_jalan_item
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- Merged from 20260610000400_m1_storage_buckets.sql
-- pg_cron not enabled by any earlier migration; enable it here
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- M1: bucket selfie audit & foto referensi enroll
INSERT INTO storage.buckets (id, name, public)
VALUES ('selfies', 'selfies', false), ('face-refs', 'face-refs', false)
ON CONFLICT (id) DO NOTHING;

-- Baca selfie/face-ref hanya untuk staff di outlet yang sama (path: <outlet_id>/...)
CREATE POLICY selfies_read_own_outlet
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('selfies','face-refs')
    AND EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND (storage.foldername(name))[1] = me.outlet_id::text
    )
  );

-- Upload selfie/face-ref hanya ke folder outlet sendiri
CREATE POLICY selfies_write_own_outlet
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('selfies','face-refs')
    AND EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND (storage.foldername(name))[1] = me.outlet_id::text
    )
  );

-- Retensi 90 hari: hapus selfie lama via pg_cron harian 02:00
SELECT cron.schedule(
  'cleanup-selfies',
  '0 2 * * *',
  $$
    DELETE FROM storage.objects
    WHERE bucket_id = 'selfies'
      AND created_at < NOW() - INTERVAL '90 days';
    UPDATE attendance SET selfie_url = NULL
      WHERE selfie_url IS NOT NULL
        AND ts_server < NOW() - INTERVAL '90 days';
  $$
);

-- DOWN:
-- SELECT cron.unschedule('cleanup-selfies');
-- DROP POLICY IF EXISTS selfies_read_own_outlet ON storage.objects;
-- DROP POLICY IF EXISTS selfies_write_own_outlet ON storage.objects;
-- DELETE FROM storage.buckets WHERE id IN ('selfies','face-refs');
-- DROP EXTENSION IF EXISTS pg_cron;  -- only if no other module relies on it
