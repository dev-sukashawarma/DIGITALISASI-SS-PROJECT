-- ============================================================
-- MIGRATION: Actually close the anon-access gap on get_owner_dashboard_summary
-- Follow-up to 20300115000001. That migration ran
-- `REVOKE EXECUTE ... FROM anon`, which executed without error but had NO
-- effect: PostgreSQL grants EXECUTE to the PUBLIC pseudo-role by default at
-- function creation time, and `anon` is implicitly a member of PUBLIC, so it
-- inherited EXECUTE via PUBLIC regardless of the anon-specific revoke.
-- Verified live via pg_proc.proacl showing `=X/postgres` (the PUBLIC grant
-- entry) still present after the anon-specific revoke.
-- Fix: revoke from PUBLIC directly. authenticated/service_role/postgres keep
-- their explicit grants and are unaffected.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_summary(
  timestamptz, timestamptz, uuid, text, uuid
) FROM PUBLIC;
