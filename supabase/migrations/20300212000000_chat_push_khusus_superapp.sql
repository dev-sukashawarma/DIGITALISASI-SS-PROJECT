-- Push chat hanya ke aplikasi superapp, tidak lagi menyiram POS.
--
-- MASALAH YANG DIPERBAIKI
-- Trigger chat sebelumnya memanggil `send-push` dengan `broadcast: true`.
-- Dua akibatnya, keduanya salah:
--
--   1. `send-push` mengirim ke SELURUH baris `fcm_tokens`, dan tabel itu
--      dipakai bersama aplikasi POS. Setiap pesan chat ikut mendarat di HP
--      kasir.
--   2. `send-push` menandai kiriman broadcast dengan `type: 'broadcast'`.
--      Di `POSFirebaseMessagingService`, `type = 'broadcast'` berarti PESAN
--      OWNER: POS membunyikan alarm owner dan menulis judul
--      "PESAN DARI OWNER: <nama pengirim>". Itulah kenapa pesan chat muncul
--      sebagai pesan dari owner.
--
-- PERBAIKANNYA
-- Chat memakai daftar perangkatnya sendiri (`chat_push_tokens`) dan edge
-- function-nya sendiri (`send-chat-push`). `send-push`, `fcm_tokens`, POS, dan
-- web sama sekali TIDAK disentuh.
--
-- PRASYARAT: deploy edge function-nya lebih dulu —
--   npx supabase functions deploy send-chat-push

SET lock_timeout = '5s';

-- 1. Daftar perangkat khusus chat ------------------------------------------
--
-- Kunci utamanya token, bukan staff_id: satu orang boleh memegang dua HP, dan
-- keduanya berhak menerima pesan. Baris lama dibersihkan edge function saat
-- Firebase menyatakan tokennya sudah mati.
CREATE TABLE IF NOT EXISTS public.chat_push_tokens (
  token      text        PRIMARY KEY,
  staff_id   uuid        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_push_tokens_staff_idx
  ON public.chat_push_tokens (staff_id);

COMMENT ON TABLE public.chat_push_tokens IS
  'Token FCM perangkat yang memasang app native superapp. TERPISAH dari fcm_tokens yang dipakai bersama POS, supaya pesan chat tidak pernah sampai ke HP kasir.';

ALTER TABLE public.chat_push_tokens ENABLE ROW LEVEL SECURITY;

-- Tidak ada policy SELECT untuk `authenticated`: daftar perangkat orang lain
-- bukan urusan siapa pun di aplikasi. Edge function membacanya dengan
-- service role, yang melewati RLS.
DROP POLICY IF EXISTS chat_push_tokens_hapus_sendiri ON public.chat_push_tokens;
CREATE POLICY chat_push_tokens_hapus_sendiri
  ON public.chat_push_tokens FOR DELETE
  TO authenticated
  USING (staff_id = (SELECT auth.uid()));

-- 2. Pendaftaran token -----------------------------------------------------
--
-- Lewat RPC, bukan INSERT langsung: `staff_id` diambil paksa dari auth.uid()
-- sehingga tidak ada yang bisa mendaftarkan perangkat atas nama orang lain.
-- Token yang sama berpindah pemilik saat HP dipakai akun lain — perilaku yang
-- sama dengan `register_fcm_token` milik POS.
CREATE OR REPLACE FUNCTION public.register_chat_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;
  IF coalesce(btrim(p_token), '') = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_push_tokens (token, staff_id, updated_at)
  VALUES (btrim(p_token), v_uid, now())
  ON CONFLICT (token) DO UPDATE
    SET staff_id = EXCLUDED.staff_id,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_chat_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_chat_push_token(text) TO authenticated;

-- 3. Trigger push chat -----------------------------------------------------
--
-- Menggantikan versi 20300210000000 yang memanggil `send-push` broadcast.
-- URL-nya diturunkan dari secret `push_webhook_url` yang sudah ada, hanya
-- nama fungsinya yang ditukar — jadi tidak perlu menambah secret baru.
CREATE OR REPLACE FUNCTION public.trigger_chat_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url   text;
  v_key   text;
  v_body  text;
  v_grup  record;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RETURN NEW;
    END IF;
    v_url := replace(v_url, '/send-push', '/send-chat-push');

    SELECT nama_grup, foto_grup INTO v_grup
      FROM public.chat_settings WHERE id = 1;

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
        'message_id',  NEW.id,
        'sender_id',   NEW.sender_id,
        'sender_name', NEW.sender_name,
        'body',        v_body,
        'group_name',  COALESCE(v_grup.nama_grup, 'Chat Tim'),
        'group_photo', COALESCE(v_grup.foto_grup, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Pesan tidak boleh gagal terkirim hanya karena notifikasinya gagal.
    RAISE WARNING 'Gagal mengirim push chat: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.register_chat_push_token(text);
--   DROP TABLE IF EXISTS public.chat_push_tokens;
--   (dan kembalikan trigger_chat_message_push dari 20300210000000)
