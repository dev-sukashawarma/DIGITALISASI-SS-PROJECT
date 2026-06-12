-- Create menu-images bucket for POS Kasir
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Publicly readable by anyone
CREATE POLICY menu_images_read_public
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Admin can write (insert, update, delete)
CREATE POLICY menu_images_write_admin
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND get_user_role() = 'admin'
  );

CREATE POLICY menu_images_update_admin
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND get_user_role() = 'admin'
  );

CREATE POLICY menu_images_delete_admin
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND get_user_role() = 'admin'
  );
