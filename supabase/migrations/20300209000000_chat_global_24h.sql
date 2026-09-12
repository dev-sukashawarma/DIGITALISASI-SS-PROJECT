-- Chat global 24 jam: satu grup perusahaan untuk semua staff, pesan sementara.
--
-- LATAR
-- App native (SUPER-APPS-SS-MOBILE) menambah layar chat ala grup WhatsApp:
-- semua pemegang akun staff berbagi satu ruang, pesan otomatis hilang setelah
-- 24 jam. Web TIDAK memakai fitur ini — migrasi ini murni aditif dan tidak
-- menyentuh satu pun tabel, policy, trigger, RPC, atau bucket yang sudah
-- dipakai web/POS/native.
--
-- TIGA KEPUTUSAN YANG PERLU DIINGAT
--
-- 1. Nama + foto pengirim di-SNAPSHOT ke baris pesan lewat trigger, bukan
--    di-join saat baca. RLS `outlet_staff` sengaja tidak mengizinkan membaca
--    baris orang lain, dan membuka policy SELECT lebar di tabel paling
--    sensitif itu demi chat adalah harga yang salah. Pesan hanya hidup 24 jam,
--    jadi snapshot tak sempat basi lama; dan karena diisi server dari
--    auth.uid(), klien tidak bisa mengirim atas nama orang lain.
--
-- 2. Kutipan reply juga di-snapshot (`reply_to_name`, `reply_to_snippet`)
--    supaya kutipan tetap tampil setelah pesan asalnya dihapus job 24 jam —
--    persis perilaku WhatsApp saat pesan asal sudah tidak ada.
--
-- 3. Penghapusan berjalan dua lapis: RLS SELECT hanya meloloskan baris
--    < 24 jam (akurat per detik, tanpa menunggu job), dan job pg_cron per jam
--    membuang baris + objek storage kedaluwarsa supaya tabel dan bucket tidak
--    membengkak. Job per jam TIDAK berarti pesan hilang per jam — yang
--    dihapus hanya yang umurnya sudah lewat 24 jam.

SET lock_timeout = '5s';

-- 1. Tabel ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        uuid        NOT NULL,
  -- Snapshot identitas pengirim saat kirim (diisi trigger, bukan klien).
  sender_name      text        NOT NULL DEFAULT '',
  sender_avatar    text,
  body             text        NOT NULL DEFAULT '',
  -- Path objek di bucket chat-media: 'chat-media/<sender_id>/<uuid>.webp'.
  image_path       text,
  -- Reply/quote. reply_to_id boleh menunjuk pesan yang kelak terhapus;
  -- karena itu TANPA foreign key — kutipan hidup dari snapshot di bawah.
  reply_to_id      uuid,
  reply_to_name    text,
  reply_to_snippet text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_isi_ada    CHECK (btrim(body) <> '' OR image_path IS NOT NULL),
  CONSTRAINT chat_messages_body_batas CHECK (char_length(body) <= 2000)
);

COMMENT ON TABLE public.chat_messages IS
  'Chat global 24 jam app native. Pesan sementara: RLS hanya meloloskan baris < 24 jam dan job pg_cron chat-cleanup-24h menghapus sisanya per jam.';

-- Query utamanya selalu "24 jam terakhir, urut waktu".
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON public.chat_messages (created_at);

-- Event DELETE realtime hanya dikirim ke subscriber bila baris lamanya bisa
-- diperiksa terhadap RLS — itu menuntut replica identity penuh. Tabelnya
-- kecil (isi < 24 jam), jadi biayanya tidak berarti.
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- 2. Trigger snapshot pengirim ----------------------------------------------
--
-- SECURITY DEFINER: fungsi ini boleh membaca outlet_staff dan chat_messages
-- melewati RLS, tepat untuk mengisi snapshot — pemanggil biasa tetap tidak
-- bisa membaca baris staff orang lain secara langsung.
CREATE OR REPLACE FUNCTION public.chat_messages_fill_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_staff record;
  v_asal  record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  SELECT coalesce(nullif(btrim(display_name), ''), name) AS nama,
         avatar_url,
         status
    INTO v_staff
    FROM public.outlet_staff
   WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun ini belum terhubung dengan data staff outlet.';
  END IF;
  IF v_staff.status <> 'active' THEN
    RAISE EXCEPTION 'Akun non-aktif tidak dapat mengirim pesan.';
  END IF;

  -- Identitas selalu dari server; apa pun kiriman klien ditimpa.
  NEW.sender_id     := v_uid;
  NEW.sender_name   := v_staff.nama;
  NEW.sender_avatar := v_staff.avatar_url;
  NEW.created_at    := now();

  -- Foto wajib berada di folder milik pengirim — tanpa ini seseorang bisa
  -- menautkan pesan ke objek storage milik orang lain.
  IF NEW.image_path IS NOT NULL
     AND NEW.image_path NOT LIKE 'chat-media/' || v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Path foto chat tidak sah.';
  END IF;

  -- Snapshot kutipan diambil server dari pesan asal, bukan dipercaya dari
  -- klien — supaya kutipan tidak bisa dipalsukan.
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT sender_name, body, image_path
      INTO v_asal
      FROM public.chat_messages
     WHERE id = NEW.reply_to_id;
    IF FOUND THEN
      NEW.reply_to_name    := v_asal.sender_name;
      NEW.reply_to_snippet := CASE
        WHEN btrim(v_asal.body) <> '' THEN left(v_asal.body, 140)
        WHEN v_asal.image_path IS NOT NULL THEN '📷 Foto'
        ELSE ''
      END;
    ELSE
      -- Pesan asal sudah terhapus di antara tap-reply dan kirim: kutipan
      -- kosong lebih jujur daripada menggagalkan kiriman.
      NEW.reply_to_id      := NULL;
      NEW.reply_to_name    := NULL;
      NEW.reply_to_snippet := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_messages_fill_sender() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS chat_messages_fill_sender ON public.chat_messages;
CREATE TRIGGER chat_messages_fill_sender
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_fill_sender();

-- 3. RLS ---------------------------------------------------------------------

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Baca: semua yang login, hanya jendela 24 jam. Batas waktunya ada di POLICY,
-- bukan hanya di query klien, supaya klien yang lupa memfilter pun tidak bisa
-- melihat pesan kedaluwarsa yang belum disapu job.
DROP POLICY IF EXISTS chat_messages_select_24h ON public.chat_messages;
CREATE POLICY chat_messages_select_24h
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (created_at > now() - interval '24 hours');

DROP POLICY IF EXISTS chat_messages_insert_self ON public.chat_messages;
CREATE POLICY chat_messages_insert_self
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

-- Hapus: hanya pesan sendiri (fitur "hapus pesan saya" di klien).
DROP POLICY IF EXISTS chat_messages_delete_self ON public.chat_messages;
CREATE POLICY chat_messages_delete_self
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()));

-- Tanpa policy UPDATE: pesan chat tidak bisa disunting, sengaja.

-- 4. Realtime ----------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END
$$;

-- 5. Bucket foto chat ---------------------------------------------------------
--
-- Pola persis bucket `avatars` (migrasi 20300208000000): privat, tulis hanya
-- ke folder user_id sendiri, baca untuk semua yang login.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', false, 5242880, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_media_insert_self ON storage.objects;
CREATE POLICY chat_media_insert_self
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS chat_media_read_authenticated ON storage.objects;
CREATE POLICY chat_media_read_authenticated
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-media');

-- Tanpa policy UPDATE/DELETE untuk klien: berkas kedaluwarsa disapu job di
-- bawah, dan menghapus pesan tidak menghapus objeknya seketika — objek yatim
-- paling lama menunggu satu hari.

-- 6. Job pembersih per jam ----------------------------------------------------
--
-- Menghapus baris pesan DAN baris storage.objects yang berumur > 24 jam.
-- (Menghapus baris storage.objects mencabut akses objeknya; sisa fisik di
-- backend dibereskan Supabase, bukan urusan job ini.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chat-cleanup-24h') THEN
    PERFORM cron.unschedule('chat-cleanup-24h');
  END IF;
END
$$;

SELECT cron.schedule(
  'chat-cleanup-24h',
  '17 * * * *',
  $$
    DELETE FROM public.chat_messages
     WHERE created_at < now() - interval '24 hours';
    DELETE FROM storage.objects
     WHERE bucket_id = 'chat-media'
       AND created_at < now() - interval '24 hours';
  $$
);

-- ROLLBACK (jalankan manual bila perlu):
--   SELECT cron.unschedule('chat-cleanup-24h');
--   DROP POLICY IF EXISTS chat_media_read_authenticated ON storage.objects;
--   DROP POLICY IF EXISTS chat_media_insert_self ON storage.objects;
--   DELETE FROM storage.objects WHERE bucket_id = 'chat-media';
--   DELETE FROM storage.buckets WHERE id = 'chat-media';
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
--   DROP TABLE IF EXISTS public.chat_messages;
--   DROP FUNCTION IF EXISTS public.chat_messages_fill_sender();
