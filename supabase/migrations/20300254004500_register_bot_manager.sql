-- 20300254004500_register_bot_manager.sql
-- Daftarkan profil Bot Manager (AM & RM) ke dalam hermes_bot_registry

INSERT INTO public.hermes_bot_registry (slug, nama) VALUES
  ('manager', 'Bot Manager (AM & RM)')
ON CONFLICT (slug) DO UPDATE
SET nama = EXCLUDED.nama;
