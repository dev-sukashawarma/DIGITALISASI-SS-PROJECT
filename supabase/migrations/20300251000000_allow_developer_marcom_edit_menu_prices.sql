-- =============================================================================
-- Migration: 20300251000000_allow_developer_marcom_edit_menu_prices.sql
-- Tujuan: Memberikan hak edit menu, harga (multi-channel & offline), promo,
--         dan gambar menu kepada role 'developer' dan 'marcom' (selain 'admin' & 'owner').
-- =============================================================================

-- 1. Perluas CHECK constraint outlet_staff.role dengan 'marcom'
ALTER TABLE public.outlet_staff DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff ADD CONSTRAINT outlet_staff_role_check
  CHECK (role = ANY (ARRAY[
    'admin','admin_hr','owner','regional_manager','area_manager','spv','kitchen',
    'leader','crew','kiosk','mitra','staff_pusat','admin_finance','korlap','purchasing',
    'developer', 'driver', 'marcom'
  ]));

-- 2. Perbarui policy menu_items agar admin, developer, marcom, owner bisa kelola menu
DROP POLICY IF EXISTS "menu_items_all_admin" ON public.menu_items;
CREATE POLICY "menu_items_all_admin" ON public.menu_items
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'));

-- 3. Perbarui policy menu_packages agar developer dan marcom bisa kelola isi paket
DROP POLICY IF EXISTS menu_packages_write ON public.menu_packages;
CREATE POLICY menu_packages_write ON public.menu_packages
  FOR ALL TO authenticated
  USING (public.is_owner_or_admin() OR (SELECT get_user_role()) = 'marcom')
  WITH CHECK (public.is_owner_or_admin() OR (SELECT get_user_role()) = 'marcom');

-- 4. Perbarui policy categories
DROP POLICY IF EXISTS "categories_all_admin" ON public.categories;
CREATE POLICY "categories_all_admin" ON public.categories
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'));

-- 5. Perbarui policy kiosk_settings (upsell, bestseller, recommendation)
DROP POLICY IF EXISTS "kiosk_settings_all_admin" ON public.kiosk_settings;
CREATE POLICY "kiosk_settings_all_admin" ON public.kiosk_settings
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'));

-- 6. Perbarui policy outlet_promos
DROP POLICY IF EXISTS "outlet_promos_all_admin" ON public.outlet_promos;
CREATE POLICY "outlet_promos_all_admin" ON public.outlet_promos
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'));

-- 7. Perbarui policy storage objects untuk bucket 'menu-images'
DROP POLICY IF EXISTS "Admin can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Kasir can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Kasir can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin and Kasir can delete menu images" ON storage.objects;
DROP POLICY IF EXISTS "Menu images upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Menu images update policy" ON storage.objects;
DROP POLICY IF EXISTS "Menu images delete policy" ON storage.objects;

CREATE POLICY "Menu images upload policy" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-images' AND (SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner', 'crew', 'leader')
  );
CREATE POLICY "Menu images update policy" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'menu-images' AND (SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner', 'crew', 'leader')
  );
CREATE POLICY "Menu images delete policy" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'menu-images' AND (SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner', 'crew', 'leader')
  );
