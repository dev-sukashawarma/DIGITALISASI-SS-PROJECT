-- 20260922100000_update_sp_3_months_validity.sql
-- Sesuaikan masa berlaku data SP yang sudah ada di database menjadi 3 bulan kalender

UPDATE public.discipline_records
SET expires_at = (
  COALESCE(
    CASE WHEN incident_date IS NOT NULL AND incident_date != '' THEN incident_date::date ELSE NULL END,
    CASE WHEN issue_date IS NOT NULL AND issue_date != '' THEN issue_date::date ELSE NULL END,
    created_at::date
  ) + interval '3 month'
)::date::text
WHERE incident_date IS NOT NULL OR issue_date IS NOT NULL OR created_at IS NOT NULL;
