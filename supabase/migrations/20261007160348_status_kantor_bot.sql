-- Kantor Bot tahap A (spec docs/superpowers/specs/2026-10-07-kantor-bot-tahap-a-design.md §4.2).
-- Ringkasan aktivitas tiap kunci Hermes aktif untuk papan /kantor di apps/bot.
-- hermes_api_log sengaja TANPA policy (hanya service role) — fungsi ini satu-satunya jalan baca
-- bagi pengguna, dan hanya untuk owner/admin. Tidak mengembalikan prefix/hash/IP/alasan.
CREATE OR REPLACE FUNCTION public.status_kantor_bot()
RETURNS TABLE (
  id uuid,
  nama text,
  scope text[],
  dibuat_at timestamptz,
  terakhir_at timestamptz,
  status_terakhir text,
  alat_terakhir text,
  panggilan_hari_ini integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_awal_hari timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
BEGIN
  IF NOT COALESCE(public.is_owner_or_admin(), false) THEN
    RAISE EXCEPTION 'status_kantor_bot: hanya owner/admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT k.id, k.nama, k.scope, k.dibuat_at,
         t.at, t.status, t.alat,
         (SELECT count(*)::integer FROM public.hermes_api_log h
           WHERE h.kunci_id = k.id AND h.at >= v_awal_hari)
  FROM public.hermes_api_key k
  LEFT JOIN LATERAL (
    SELECT l.at, l.status, l.alat
    FROM public.hermes_api_log l
    WHERE l.kunci_id = k.id AND l.at > now() - interval '24 hours'
    ORDER BY l.at DESC, l.id DESC
    LIMIT 1
  ) t ON true
  WHERE k.aktif
  ORDER BY k.dibuat_at, k.id;
END;
$$;

REVOKE ALL ON FUNCTION public.status_kantor_bot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_kantor_bot() TO authenticated;

COMMENT ON FUNCTION public.status_kantor_bot() IS
  'Kantor Bot (apps/bot /kantor): ringkasan kunci Hermes aktif + log terakhir. owner/admin saja.';
