-- Menambahkan kolom outlet_id ke menu_items
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE;

-- Update RLS policies untuk menu_items
DROP POLICY IF EXISTS "menu_items_select_public" ON menu_items;
DROP POLICY IF EXISTS "menu_items_all_admin" ON menu_items;
DROP POLICY IF EXISTS "menu_items_all_kasir" ON menu_items;

-- Select: Bisa dibaca oleh publik (nanti difilter di aplikasi berdasarkan outlet)
CREATE POLICY "menu_items_select_public" ON menu_items FOR SELECT USING (true);

-- Admin bisa semuanya
CREATE POLICY "menu_items_all_admin" ON menu_items FOR ALL USING (get_user_role() = 'admin');

-- Kasir hanya bisa mengatur menu yang outlet_id nya sama dengan outlet_id profil mereka
CREATE POLICY "menu_items_all_kasir" ON menu_items FOR ALL USING (
  get_user_role() = 'kasir' AND outlet_id = get_user_outlet_id()
);

-- Update RLS Storage "menu-images" bucket
DROP POLICY IF EXISTS "Admin can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete menu images" ON storage.objects;

CREATE POLICY "Admin and Kasir can upload menu images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'menu-images' AND get_user_role() IN ('admin', 'kasir')
);
CREATE POLICY "Admin and Kasir can update menu images" ON storage.objects FOR UPDATE USING (
  bucket_id = 'menu-images' AND get_user_role() IN ('admin', 'kasir')
);
CREATE POLICY "Admin and Kasir can delete menu images" ON storage.objects FOR DELETE USING (
  bucket_id = 'menu-images' AND get_user_role() IN ('admin', 'kasir')
);
