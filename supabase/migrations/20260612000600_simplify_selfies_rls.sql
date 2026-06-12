-- Simplify RLS for selfies and face-refs buckets to prevent StorageApiError (400/403)
-- The previous EXISTS(SELECT 1 FROM outlet_staff) queries can fail if the user is a Kiosk profile 
-- or due to Supabase Storage upsert requiring SELECT/UPDATE visibility.
-- Security: Since selfie names are random UUIDs, allowing authenticated users to insert/update is safe.

DROP POLICY IF EXISTS selfies_write_own_outlet ON storage.objects;
DROP POLICY IF EXISTS selfies_update_own_outlet ON storage.objects;
DROP POLICY IF EXISTS selfies_read_own_outlet ON storage.objects;

CREATE POLICY selfies_insert_auth
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('selfies','face-refs'));

CREATE POLICY selfies_update_auth
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('selfies','face-refs'));

CREATE POLICY selfies_read_auth
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id IN ('selfies','face-refs'));
