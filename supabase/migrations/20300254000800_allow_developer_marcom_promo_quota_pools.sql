-- =============================================================================
-- Migration: 20300254000800_allow_developer_marcom_promo_quota_pools.sql
-- Tujuan: Memberikan hak akses tabel promo_quota_pools kepada role
--         'developer' dan 'marcom' (selain 'admin' & 'owner') agar sinkron dengan
--         tabel outlet_promos.
-- =============================================================================

DROP POLICY IF EXISTS "promo_quota_pools_admin_owner" ON public.promo_quota_pools;
CREATE POLICY "promo_quota_pools_admin_owner"
  ON public.promo_quota_pools
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'))
  WITH CHECK ((SELECT get_user_role()) IN ('admin', 'developer', 'marcom', 'owner'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promo_quota_pools TO authenticated;
