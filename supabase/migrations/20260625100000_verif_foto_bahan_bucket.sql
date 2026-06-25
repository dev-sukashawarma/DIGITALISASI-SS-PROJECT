-- Bucket untuk foto bukti penerimaan barang per item surat jalan.
-- Private: akses via signed URL, bukan public URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verif-foto-bahan',
  'verif-foto-bahan',
  false,
  204800, -- 200KB max
  ARRAY['image/jpeg','image/jpg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: crew outlet yang terautentikasi bisa upload ke path {surat_jalan_id}/{item_id}.jpg
-- (validasi surat_jalan milik outlet mereka dilakukan di application layer)
CREATE POLICY "verif_foto_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'verif-foto-bahan');

-- Read: semua authenticated bisa baca (akses via signed URL saja karena bucket private)
CREATE POLICY "verif_foto_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'verif-foto-bahan');

-- Update/overwrite: boleh re-upload foto (mis. re-verifikasi)
CREATE POLICY "verif_foto_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'verif-foto-bahan');
