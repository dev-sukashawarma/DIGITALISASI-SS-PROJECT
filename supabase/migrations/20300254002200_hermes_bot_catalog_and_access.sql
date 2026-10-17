-- Katalog profil bot untuk pengelolaan penerima per bot di Agents SS.
-- Izin Stokis tetap di bot_telegram_access agar pengiriman alert yang sudah berjalan tidak berubah.
CREATE TABLE IF NOT EXISTS public.hermes_bot_registry (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9_-]{1,39}$'),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 2 AND 80),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  dibuat_oleh uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL
);

INSERT INTO public.hermes_bot_registry (slug, nama) VALUES
  ('ceo', 'Bot CEO'),
  ('hrd', 'Bot HRD / HAFIZ'),
  ('marcom', 'Bot Marcom'),
  ('stokis', 'Bot Stokis / STEGO')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.hermes_bot_user_access (
  bot_slug text NOT NULL REFERENCES public.hermes_bot_registry(slug) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_slug, staff_id)
);

CREATE INDEX IF NOT EXISTS hermes_bot_user_access_staff_idx
  ON public.hermes_bot_user_access (staff_id);

ALTER TABLE public.hermes_bot_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_bot_user_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_bot_registry, public.hermes_bot_user_access FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.hermes_bot_registry, public.hermes_bot_user_access TO service_role;

COMMENT ON TABLE public.hermes_bot_user_access IS
  'Daftar staf per profil bot; izinkan chat di VPS sesuai daftar ini. Stokis memakai bot_telegram_access untuk alert aktif.';
