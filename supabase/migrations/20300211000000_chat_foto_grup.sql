-- Foto grup chat.
--
-- Lanjutan 20300210000000, aditif murni: satu kolom pada `chat_settings`.
--
-- KENAPA BUCKET `avatars`, BUKAN `chat-media`
-- `chat-media` disapu job `chat-cleanup-24h` setiap jam — foto grup akan lenyap
-- sehari setelah dipasang. `avatars` tidak disapu, policy-nya sudah tepat
-- (menulis hanya ke folder milik sendiri, membaca untuk semua yang login), dan
-- foto grup memang berumur panjang seperti foto profil. Jadi tidak ada bucket
-- maupun policy baru; path-nya 'avatars/<uid pengelola>/grup-<uuid>.jpg'.

SET lock_timeout = '5s';

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS foto_grup text;

COMMENT ON COLUMN public.chat_settings.foto_grup IS
  'Path objek foto grup di bucket `avatars` (bukan chat-media, yang disapu job 24 jam). NULL = pakai ikon bawaan.';

-- ROLLBACK:
--   ALTER TABLE public.chat_settings DROP COLUMN IF EXISTS foto_grup;
