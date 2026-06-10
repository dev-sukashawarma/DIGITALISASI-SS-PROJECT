-- Manual RLS check. Run in Supabase SQL editor.
-- Simulates two staff in two different outlets and asserts opname isolation.
-- Requires two outlets and two outlet_staff rows (one per outlet) to exist.
-- Replace :staff_a / :outlet_a / :staff_b / :outlet_b with real ids.

-- As staff A: insert an opname in outlet A
SET request.jwt.claims = '{"sub":":staff_a","role":"authenticated"}';
SET ROLE authenticated;
INSERT INTO opname (outlet_id, tipe) VALUES (':outlet_a', 'ad_hoc');
-- Should see only outlet A opname:
SELECT count(*) AS visible_to_a FROM opname;

RESET ROLE;
-- As staff B (different outlet):
SET request.jwt.claims = '{"sub":":staff_b","role":"authenticated"}';
SET ROLE authenticated;
SELECT count(*) AS a_rows_visible_to_b FROM opname WHERE outlet_id = ':outlet_a';
-- expect: 0 (RLS hides outlet A from staff B)

RESET ROLE;
RESET request.jwt.claims;
-- cleanup
DELETE FROM opname WHERE tipe='ad_hoc' AND outlet_id=':outlet_a';
