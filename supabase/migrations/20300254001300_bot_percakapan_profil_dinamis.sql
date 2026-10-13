-- 20300254001300_bot_percakapan_profil_dinamis.sql
-- Fleksibilitas profil bot di public.bot_percakapan: izinkan profil slug dinamis (misal: marcom, purchasing, outlet)
-- tanpa perlu mengubah CHECK constraint tabel setiap kali ada penambahan bot divisi baru.

ALTER TABLE public.bot_percakapan DROP CONSTRAINT IF EXISTS bot_percakapan_profil_check;

ALTER TABLE public.bot_percakapan
  ADD CONSTRAINT bot_percakapan_profil_check
  CHECK (profil ~ '^[a-z0-9][a-z0-9_-]{0,31}$');

COMMENT ON COLUMN public.bot_percakapan.profil IS
  'Slug pengenal profil bot Hermes (misal: ceo, gudang, hrd, finance, marcom, purchasing, dll).';
