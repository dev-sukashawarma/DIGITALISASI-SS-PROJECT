-- =============================================================================
-- Server-side outlet scoping for leader monitoring views.
--
-- Root cause: monitoring_view_spv and the opname-compliance query (outlets +
-- opname join) are unrestricted (security-definer / no row filter) so any
-- caller's browser receives ALL 19 outlets' data over the wire, with leader
-- scoping applied only client-side (apps/stok SPVDashboard.tsx allowedOutletIds
-- filter). This is a data-minimization gap, not a write-security hole, but
-- more data is exposed to a leader's browser than necessary.
--
-- Fix: new views that filter by accessible_outlet_ids() (already exists,
-- SECURITY DEFINER STABLE, defined in 20260620000000) so scoping happens in
-- Postgres based on auth.uid() of the querying session — correct regardless
-- of what the client requests, and works for every role since
-- accessible_outlet_ids() already returns ALL outlets for admin/owner/spv.
-- =============================================================================

-- Scoped version of monitoring_view_spv: same columns, filtered to the
-- caller's accessible outlets. For admin/owner/spv this returns all 19
-- outlets (unchanged behavior); for leader, only their bound outlets.
CREATE OR REPLACE VIEW monitoring_view_scoped AS
SELECT *
FROM monitoring_view_spv
WHERE outlet_id IN (SELECT accessible_outlet_ids());

-- Same OWNER-TO-postgres pattern as monitoring_view_spv: the filter itself
-- relies on accessible_outlet_ids() (SECURITY DEFINER) for correct scoping,
-- but the view still needs definer-style ownership to read through to
-- monitoring_view_spv's own underlying tables consistently.
ALTER VIEW monitoring_view_scoped OWNER TO postgres;
GRANT SELECT ON monitoring_view_scoped TO authenticated;

-- Scoped opname-compliance view (replaces the unrestricted outlets+opname
-- join previously done ad-hoc in fetchOpnameStatus()). One row per
-- accessible outlet with its most recent opname timestamp.
CREATE OR REPLACE VIEW opname_compliance_view AS
SELECT
  o.id          AS outlet_id,
  o.name        AS outlet_name,
  MAX(op.created_at) AS last_opname_date
FROM outlets o
LEFT JOIN opname op ON op.outlet_id = o.id
WHERE o.id IN (SELECT accessible_outlet_ids())
GROUP BY o.id, o.name
ORDER BY o.name;

ALTER VIEW opname_compliance_view OWNER TO postgres;
GRANT SELECT ON opname_compliance_view TO authenticated;
