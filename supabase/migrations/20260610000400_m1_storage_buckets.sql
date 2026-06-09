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
