-- SUKA Bot tahap 1: rekap harian, riwayat chat, log pertanyaan gagal, pemakaian.
-- Spec: docs/superpowers/specs/2026-10-03-suka-bot-design.md §8
-- Akses: admin/owner/developer = is_owner_or_admin().

CREATE TABLE IF NOT EXISTS public.suka_bot_rekap (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal     date NOT NULL,
  versi       int  NOT NULL CHECK (versi >= 1),
  data        jsonb NOT NULL,
  teks        text NOT NULL,
  dibuat_oleh uuid NOT NULL DEFAULT auth.uid(),
  dibuat_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tanggal, versi)
);

CREATE TABLE IF NOT EXISTS public.suka_bot_percakapan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  judul         text NOT NULL DEFAULT 'Percakapan',
  dibuat_at     timestamptz NOT NULL DEFAULT now(),
  diperbarui_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suka_bot_percakapan_user_idx ON public.suka_bot_percakapan (user_id, diperbarui_at DESC);

CREATE TABLE IF NOT EXISTS public.suka_bot_pesan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  percakapan_id uuid NOT NULL REFERENCES public.suka_bot_percakapan(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  peran         text NOT NULL CHECK (peran IN ('user', 'assistant')),
  isi           text NOT NULL,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  dibuat_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suka_bot_pesan_percakapan_idx ON public.suka_bot_pesan (percakapan_id, dibuat_at);

CREATE TABLE IF NOT EXISTS public.suka_bot_gagal (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid(),
  pertanyaan text NOT NULL,
  alasan     text NOT NULL,
  dibuat_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suka_bot_pemakaian (
  user_id           uuid NOT NULL,
  tanggal           date NOT NULL,
  jumlah_pertanyaan int  NOT NULL DEFAULT 0,
  token_masuk       bigint NOT NULL DEFAULT 0,
  token_keluar      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tanggal)
);

-- Default privileges Supabase memberi ALL ke tabel baru; cabut lalu beri seperlunya.
REVOKE ALL ON public.suka_bot_rekap, public.suka_bot_percakapan, public.suka_bot_pesan,
              public.suka_bot_gagal, public.suka_bot_pemakaian FROM anon, authenticated;
GRANT SELECT, INSERT ON public.suka_bot_rekap TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suka_bot_percakapan TO authenticated;
GRANT SELECT, INSERT ON public.suka_bot_pesan TO authenticated;
GRANT SELECT, INSERT ON public.suka_bot_gagal TO authenticated;
GRANT SELECT ON public.suka_bot_pemakaian TO authenticated;

ALTER TABLE public.suka_bot_rekap      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_percakapan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_pesan      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_gagal      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_pemakaian  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.suka_bot_is_developer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'developer' AND status = 'active');
$$;
REVOKE ALL ON FUNCTION public.suka_bot_is_developer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suka_bot_is_developer() TO authenticated;

DROP POLICY IF EXISTS suka_bot_rekap_select ON public.suka_bot_rekap;
CREATE POLICY suka_bot_rekap_select ON public.suka_bot_rekap FOR SELECT TO authenticated
  USING (public.is_owner_or_admin());
DROP POLICY IF EXISTS suka_bot_rekap_insert ON public.suka_bot_rekap;
CREATE POLICY suka_bot_rekap_insert ON public.suka_bot_rekap FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_admin() AND dibuat_oleh = auth.uid());

DROP POLICY IF EXISTS suka_bot_percakapan_milik ON public.suka_bot_percakapan;
CREATE POLICY suka_bot_percakapan_milik ON public.suka_bot_percakapan FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_owner_or_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_owner_or_admin());

DROP POLICY IF EXISTS suka_bot_pesan_select ON public.suka_bot_pesan;
CREATE POLICY suka_bot_pesan_select ON public.suka_bot_pesan FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_owner_or_admin());
DROP POLICY IF EXISTS suka_bot_pesan_insert ON public.suka_bot_pesan;
CREATE POLICY suka_bot_pesan_insert ON public.suka_bot_pesan FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND public.is_owner_or_admin()
    AND EXISTS (SELECT 1 FROM public.suka_bot_percakapan p WHERE p.id = percakapan_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS suka_bot_gagal_insert ON public.suka_bot_gagal;
CREATE POLICY suka_bot_gagal_insert ON public.suka_bot_gagal FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_owner_or_admin());
DROP POLICY IF EXISTS suka_bot_gagal_select ON public.suka_bot_gagal;
CREATE POLICY suka_bot_gagal_select ON public.suka_bot_gagal FOR SELECT TO authenticated
  USING (public.suka_bot_is_developer());

DROP POLICY IF EXISTS suka_bot_pemakaian_select ON public.suka_bot_pemakaian;
CREATE POLICY suka_bot_pemakaian_select ON public.suka_bot_pemakaian FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.suka_bot_is_developer());

-- Satu-satunya jalur tulis pemakaian: dihitung server, tak bisa direset klien.
CREATE OR REPLACE FUNCTION public.suka_bot_catat_pemakaian(p_token_masuk int, p_token_keluar int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tgl date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_jumlah int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'SUKA Bot hanya untuk admin/owner/developer' USING ERRCODE = '42501';
  END IF;
  INSERT INTO suka_bot_pemakaian (user_id, tanggal, jumlah_pertanyaan, token_masuk, token_keluar)
  VALUES (auth.uid(), v_tgl, 1, GREATEST(p_token_masuk, 0), GREATEST(p_token_keluar, 0))
  ON CONFLICT (user_id, tanggal) DO UPDATE SET
    jumlah_pertanyaan = suka_bot_pemakaian.jumlah_pertanyaan + 1,
    token_masuk  = suka_bot_pemakaian.token_masuk  + GREATEST(p_token_masuk, 0),
    token_keluar = suka_bot_pemakaian.token_keluar + GREATEST(p_token_keluar, 0)
  RETURNING jumlah_pertanyaan INTO v_jumlah;
  RETURN v_jumlah;
END $$;
REVOKE ALL ON FUNCTION public.suka_bot_catat_pemakaian(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suka_bot_catat_pemakaian(int, int) TO authenticated;

-- Retensi riwayat chat 90 hari (03:30 WIB = 20:30 UTC). Rekap & log gagal tidak dihapus.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'suka-bot-retensi-90-hari') THEN
    PERFORM cron.unschedule('suka-bot-retensi-90-hari');
  END IF;
  PERFORM cron.schedule(
    'suka-bot-retensi-90-hari',
    '30 20 * * *',
    $cron$DELETE FROM public.suka_bot_percakapan WHERE diperbarui_at < now() - interval '90 days'$cron$
  );
END $$;
