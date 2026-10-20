-- 20300254004600_register_bot_finance.sql
-- Daftarkan profil Bot Finance ke dalam hermes_bot_registry

INSERT INTO public.hermes_bot_registry (slug, nama) VALUES
  ('finance', 'Bot Finance')
ON CONFLICT (slug) DO UPDATE
SET nama = EXCLUDED.nama;
