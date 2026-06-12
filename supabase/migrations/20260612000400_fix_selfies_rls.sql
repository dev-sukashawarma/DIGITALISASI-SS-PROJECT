-- Fix for StorageApiError on selfie upload when upsert: true is used
-- Supabase requires an UPDATE policy when upserting to storage.objects

CREATE POLICY selfies_update_own_outlet
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('selfies','face-refs')
    AND EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND (storage.foldername(name))[1] = me.outlet_id::text
    )
  );
