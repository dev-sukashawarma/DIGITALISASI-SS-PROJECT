-- Chat global, gelombang kedua: reaksi emoji, pengaturan grup, dan push.
--
-- Lanjutan 20300209000000. SELURUHNYA ADITIF — tidak ada objek milik web/POS
-- yang diubah. Edge function `send-push` yang dipakai bersama TIDAK disentuh;
-- migrasi ini hanya memanggilnya, dengan `app = 'native-chat'` supaya langganan
-- web push (yang menyaring kolom `app`) tidak ikut kebanjiran pesan chat.

SET lock_timeout = '5s';

-- 1. Reaksi emoji -----------------------------------------------------------
--
-- Tabel terpisah, bukan kolom jsonb di chat_messages: `chat_messages` sengaja
-- tidak punya policy UPDATE (pesan tidak bisa disunting siapa pun), sedangkan
-- reaksi justru harus bisa dipasang dan dicabut orang lain. Dua kebutuhan itu
-- tidak muat di satu baris yang sama.
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  message_id uuid        NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  emoji      text        NOT NULL,
  user_name  text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Satu orang satu reaksi per pesan, seperti WhatsApp: memilih emoji lain
  -- menggantikan yang sebelumnya, bukan menumpuk.
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT chat_reaction_emoji_pendek CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

COMMENT ON TABLE public.chat_message_reactions IS
  'Reaksi emoji pada pesan chat native. Ikut terhapus bersama pesannya (ON DELETE CASCADE), termasuk saat job chat-cleanup-24h menyapu.';

CREATE INDEX IF NOT EXISTS chat_message_reactions_message_idx
  ON public.chat_message_reactions (message_id);

ALTER TABLE public.chat_message_reactions REPLICA IDENTITY FULL;

-- Nama pemberi reaksi di-snapshot lewat trigger, alasan yang sama dengan
-- sender_name di chat_messages: RLS outlet_staff tidak membuka baris orang lain.
CREATE OR REPLACE FUNCTION public.chat_reaction_fill_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_nama text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  SELECT coalesce(nullif(btrim(display_name), ''), name) INTO v_nama
    FROM public.outlet_staff WHERE id = v_uid;

  NEW.user_id   := v_uid;
  NEW.user_name := coalesce(v_nama, '');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_reaction_fill_user() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS chat_reaction_fill_user ON public.chat_message_reactions;
CREATE TRIGGER chat_reaction_fill_user
  BEFORE INSERT OR UPDATE ON public.chat_message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.chat_reaction_fill_user();

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_reactions_select ON public.chat_message_reactions;
CREATE POLICY chat_reactions_select
  ON public.chat_message_reactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS chat_reactions_insert_self ON public.chat_message_reactions;
CREATE POLICY chat_reactions_insert_self
  ON public.chat_message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE diperlukan untuk upsert "ganti emoji".
DROP POLICY IF EXISTS chat_reactions_update_self ON public.chat_message_reactions;
CREATE POLICY chat_reactions_update_self
  ON public.chat_message_reactions FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS chat_reactions_delete_self ON public.chat_message_reactions;
CREATE POLICY chat_reactions_delete_self
  ON public.chat_message_reactions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
       AND tablename = 'chat_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
  END IF;
END
$$;

-- 2. Kutipan balasan untuk pesan berfoto -------------------------------------
--
-- Sebelumnya kutipan hanya membawa teks, jadi membalas foto BERKETERANGAN
-- kehilangan jejak bahwa yang dibalas adalah sebuah foto. Path fotonya ikut
-- di-snapshot supaya kartu kutipan bisa menampilkan gambar kecilnya.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_image text;

-- 3. Pengaturan grup ----------------------------------------------------------
--
-- Satu baris tunggal (id = 1). Dijaga CHECK supaya tidak ada yang membuat baris
-- kedua lalu bertanya-tanya mana yang berlaku.
CREATE TABLE IF NOT EXISTS public.chat_settings (
  id             smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nama_grup      text        NOT NULL DEFAULT 'Chat Tim',
  deskripsi      text        NOT NULL DEFAULT 'Ruang obrolan seluruh tim. Pesan hilang setelah 24 jam.',
  -- true = hanya role pengelola yang boleh mengirim (mode pengumuman).
  hanya_admin    boolean     NOT NULL DEFAULT false,
  diubah_oleh    text,
  diubah_pada    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.chat_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chat_settings REPLICA IDENTITY FULL;

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_settings_select ON public.chat_settings;
CREATE POLICY chat_settings_select
  ON public.chat_settings FOR SELECT
  TO authenticated
  USING (true);

-- Penjaga role dipusatkan di satu fungsi supaya policy dan trigger pengirim
-- memakai definisi yang sama persis.
CREATE OR REPLACE FUNCTION public.chat_is_pengelola()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
     WHERE id = auth.uid()
       AND role IN ('developer', 'admin', 'admin_hr')
  );
$$;

REVOKE ALL ON FUNCTION public.chat_is_pengelola() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_is_pengelola() TO authenticated;

COMMENT ON FUNCTION public.chat_is_pengelola() IS
  'Boleh mengubah pengaturan grup chat native: developer, admin, admin_hr.';

DROP POLICY IF EXISTS chat_settings_update_pengelola ON public.chat_settings;
CREATE POLICY chat_settings_update_pengelola
  ON public.chat_settings FOR UPDATE
  TO authenticated
  USING (public.chat_is_pengelola())
  WITH CHECK (public.chat_is_pengelola());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
       AND tablename = 'chat_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;
  END IF;
END
$$;

-- 4. Trigger pengirim: snapshot foto kutipan + mode pengumuman ----------------
--
-- Menggantikan versi 20300209000000. Perubahannya dua: ikut menyalin
-- `reply_to_image`, dan menolak kiriman non-pengelola saat mode pengumuman
-- menyala. Penegakan mode itu ada DI DATABASE, bukan sekadar tombol yang
-- disembunyikan di aplikasi.
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

  IF (SELECT hanya_admin FROM public.chat_settings WHERE id = 1)
     AND NOT public.chat_is_pengelola() THEN
    RAISE EXCEPTION 'Grup sedang dalam mode pengumuman: hanya pengelola yang dapat mengirim pesan.';
  END IF;

  NEW.sender_id     := v_uid;
  NEW.sender_name   := v_staff.nama;
  NEW.sender_avatar := v_staff.avatar_url;
  NEW.created_at    := now();

  IF NEW.image_path IS NOT NULL
     AND NEW.image_path NOT LIKE 'chat-media/' || v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Path foto chat tidak sah.';
  END IF;

  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT sender_name, body, image_path
      INTO v_asal
      FROM public.chat_messages
     WHERE id = NEW.reply_to_id;
    IF FOUND THEN
      NEW.reply_to_name    := v_asal.sender_name;
      NEW.reply_to_image   := v_asal.image_path;
      NEW.reply_to_snippet := CASE
        WHEN btrim(v_asal.body) <> '' THEN left(v_asal.body, 140)
        WHEN v_asal.image_path IS NOT NULL THEN 'Foto'
        ELSE ''
      END;
    ELSE
      NEW.reply_to_id      := NULL;
      NEW.reply_to_name    := NULL;
      NEW.reply_to_image   := NULL;
      NEW.reply_to_snippet := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Push ke perangkat Android ------------------------------------------------
--
-- Satu panggilan `broadcast` per pesan, bukan satu per penerima: chat ini
-- memang ditujukan ke semua orang, dan memanggil per-user akan berarti ratusan
-- http_post untuk satu pesan.
--
-- `app = 'native-chat'` membuat edge function menyaring langganan WEB push ke
-- nilai itu — tidak ada satu pun — sehingga pengguna web tidak menerima
-- notifikasi chat. Token FCM tidak ikut disaring kolom itu, jadi perangkat
-- Android tetap dapat.
--
-- Id pengirim dititipkan di `url` ('/chat?from=<uuid>') karena send-push hanya
-- meneruskan title/body/type/url. Aplikasi memakainya untuk tidak memberi
-- notifikasi kepada si pengirim sendiri.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_chat_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url  text;
  v_key  text;
  v_body text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RETURN NEW;
    END IF;

    v_body := CASE
      WHEN btrim(NEW.body) <> '' AND NEW.image_path IS NOT NULL THEN '📷 ' || left(NEW.body, 120)
      WHEN btrim(NEW.body) <> '' THEN left(NEW.body, 140)
      ELSE '📷 Foto'
    END;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'broadcast', true,
        'app', 'native-chat',
        'title', NEW.sender_name,
        'body', v_body,
        'url', '/chat?from=' || NEW.sender_id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Pesan tidak boleh gagal terkirim hanya karena notifikasinya gagal.
    RAISE WARNING 'Gagal mengirim push chat: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_send_push ON public.chat_messages;
CREATE TRIGGER on_chat_message_send_push
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_chat_message_push();

-- ROLLBACK (jalankan manual bila perlu):
--   DROP TRIGGER IF EXISTS on_chat_message_send_push ON public.chat_messages;
--   DROP FUNCTION IF EXISTS public.trigger_chat_message_push();
--   DROP TABLE IF EXISTS public.chat_settings;
--   DROP FUNCTION IF EXISTS public.chat_is_pengelola();
--   ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS reply_to_image;
--   DROP TABLE IF EXISTS public.chat_message_reactions;
--   DROP FUNCTION IF EXISTS public.chat_reaction_fill_user();
