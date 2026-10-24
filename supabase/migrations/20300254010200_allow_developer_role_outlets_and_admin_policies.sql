-- Migration: 20300254010200_allow_developer_role_outlets_and_admin_policies.sql
-- Memberikan izin kepada role 'developer' dan 'owner' untuk mengelola tabel outlets dan tabel admin lainnya.
-- Sebelumnya policy outlets_all_admin hanya mengizinkan role 'admin',
-- sehingga user dengan role 'developer' (superuser teknis) dan 'owner' terkena penolakan RLS saat mengubah/membuat outlet.

-- 1. outlets
DROP POLICY IF EXISTS "outlets_all_admin" ON public.outlets;
CREATE POLICY "outlets_all_admin" ON public.outlets
  FOR ALL
  TO authenticated
  USING (
    public.is_owner_or_admin()
    OR (SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text])
  )
  WITH CHECK (
    public.is_owner_or_admin()
    OR (SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text])
  );

DROP POLICY IF EXISTS "outlets_insert_denied" ON public.outlets;
DROP POLICY IF EXISTS "outlets_update_denied" ON public.outlets;
DROP POLICY IF EXISTS "outlets_delete_denied" ON public.outlets;

-- 2. expenses
DROP POLICY IF EXISTS "expenses_update_admin" ON public.expenses;
CREATE POLICY "expenses_update_admin" ON public.expenses
  FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "expenses_delete_admin" ON public.expenses;
CREATE POLICY "expenses_delete_admin" ON public.expenses
  FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "expenses_insert_scoped" ON public.expenses;
CREATE POLICY "expenses_insert_scoped" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (outlet_id IN (SELECT accessible_outlet_ids()))
    OR (outlet_id IS NULL AND (SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  );

-- 3. orders
DROP POLICY IF EXISTS "orders_all_admin" ON public.orders;
CREATE POLICY "orders_all_admin" ON public.orders
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

-- 4. order_items
DROP POLICY IF EXISTS "order_items_all_admin_kasir" ON public.order_items;
CREATE POLICY "order_items_all_admin_kasir" ON public.order_items
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text, 'kasir'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text, 'kasir'::text]));

-- 5. guides
DROP POLICY IF EXISTS "guides_all_admin" ON public.guides;
CREATE POLICY "guides_all_admin" ON public.guides
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

-- 6. promo_quota_pools
DROP POLICY IF EXISTS "promo_quota_pools_admin_owner" ON public.promo_quota_pools;
CREATE POLICY "promo_quota_pools_admin_owner" ON public.promo_quota_pools
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

-- 7. outlet_promos
DROP POLICY IF EXISTS "outlet_promos_all_admin_owner" ON public.outlet_promos;
CREATE POLICY "outlet_promos_all_admin_owner" ON public.outlet_promos
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));
