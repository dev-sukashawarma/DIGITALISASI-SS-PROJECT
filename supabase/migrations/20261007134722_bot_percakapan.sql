-- Riwayat percakapan webapp Bot (apps/bot). Spec: docs/superpowers/specs/2026-10-07-webapp-bot-design.md §6.
-- Versi berkas = stempel apply_migration (20261007134722), diterapkan 2026-10-07.

CREATE TABLE IF NOT EXISTS public.bot_percakapan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  profil text NOT NULL CHECK (profil IN ('ceo','gudang','hrd','finance')),
  judul text NOT NULL CHECK (char_length(judul) BETWEEN 1 AND 120),
  hermes_session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  diperbarui_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_pesan (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  percakapan_id uuid NOT NULL REFERENCES public.bot_percakapan(id) ON DELETE CASCADE,
  peran text NOT NULL CHECK (peran IN ('user','bot')),
  isi text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  dibuat_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_percakapan_staff_idx ON public.bot_percakapan (staff_id, diperbarui_at DESC);
CREATE INDEX IF NOT EXISTS bot_pesan_percakapan_idx ON public.bot_pesan (percakapan_id, dibuat_at);

ALTER TABLE public.bot_percakapan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_pesan ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_percakapan_milik_sendiri ON public.bot_percakapan
  FOR ALL TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY bot_pesan_milik_sendiri ON public.bot_pesan
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bot_percakapan p WHERE p.id = percakapan_id AND p.staff_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_percakapan p WHERE p.id = percakapan_id AND p.staff_id = auth.uid()));

REVOKE ALL ON TABLE public.bot_percakapan FROM anon;
REVOKE ALL ON TABLE public.bot_pesan FROM anon;
REVOKE ALL ON SEQUENCE public.bot_pesan_id_seq FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_percakapan TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.bot_pesan TO authenticated;
GRANT USAGE ON SEQUENCE public.bot_pesan_id_seq TO authenticated;
