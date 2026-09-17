-- Info Pesan Chat Tim ala WhatsApp: Pelacakan pembacaan pesan secara realtime.
--
-- LATAR
-- Pengguna ingin fitur "Info Pesan" seperti di WhatsApp:
-- 1. Pengirim (dan pengelola tim) dapat melihat siapa saja yang telah membaca pesannya,
--    lengkap dengan jam/tanggal baca presisi.
-- 2. Anggota lain yang belum membaca terdaftar di seksi "Belum dibaca / Tersampaikan ke".
-- 3. Diperbarui secara realtime lewat Supabase Realtime saat orang lain membuka obrolan.
--
-- DESAIN DATA & KEAMANAN
-- 1. Tabel terpisah `chat_message_reads` dengan kunci utama gabungan (message_id, user_id)
--    sehingga satu pengguna hanya tercatat satu kali per pesan (ON CONFLICT DO NOTHING).
-- 2. Waktu baca (`read_at`) disimpan saat pertama kali dibaca dan tidak berubah-ubah.
-- 3. Terhubung ke `chat_messages(id) ON DELETE CASCADE`, sehingga otomatis ikut bersih
--    saat pesan kedaluwarsa oleh job pg_cron 24 jam.
-- 4. RLS & Trigger SECURITY DEFINER menjaga agar identitas pembaca (nama & avatar)
--    diambil dari server berdasarkan auth.uid() tanpa membuka tabel outlet_staff secara liar.

SET lock_timeout = '5s';

-- 1. Tabel Pembacaan Pesan ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_message_reads (
  message_id  uuid        NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  user_name   text        NOT NULL DEFAULT '',
  user_avatar text,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

COMMENT ON TABLE public.chat_message_reads IS
  'Catatan pembacaan pesan Chat Tim (Info Pesan ala WhatsApp). Otomatis terhapus bersama pesan (ON DELETE CASCADE).';

CREATE INDEX IF NOT EXISTS chat_message_reads_message_idx
  ON public.chat_message_reads (message_id);

CREATE INDEX IF NOT EXISTS chat_message_reads_user_idx
  ON public.chat_message_reads (user_id);

ALTER TABLE public.chat_message_reads REPLICA IDENTITY FULL;

-- 2. Trigger Snapshot Identitas Pembaca ---------------------------------------

CREATE OR REPLACE FUNCTION public.chat_message_read_fill_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_staff record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  SELECT coalesce(nullif(btrim(display_name), ''), name) AS nama,
         avatar_url
    INTO v_staff
    FROM public.outlet_staff
   WHERE id = v_uid;

  NEW.user_id     := v_uid;
  NEW.user_name   := coalesce(v_staff.nama, '');
  NEW.user_avatar := v_staff.avatar_url;
  NEW.read_at     := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_message_read_fill_user() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS chat_message_read_fill_user ON public.chat_message_reads;
CREATE TRIGGER chat_message_read_fill_user
  BEFORE INSERT ON public.chat_message_reads
  FOR EACH ROW EXECUTE FUNCTION public.chat_message_read_fill_user();

-- 3. Kebijakan Keamanan (RLS) -------------------------------------------------

ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_message_reads_select ON public.chat_message_reads;
CREATE POLICY chat_message_reads_select
  ON public.chat_message_reads FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS chat_message_reads_insert_self ON public.chat_message_reads;
CREATE POLICY chat_message_reads_insert_self
  ON public.chat_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS chat_message_reads_delete_self ON public.chat_message_reads;
CREATE POLICY chat_message_reads_delete_self
  ON public.chat_message_reads FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 4. Publikasi Realtime -------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'chat_message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reads;
  END IF;
END
$$;

-- 5. RPC Tandai Dibaca (Batch) ------------------------------------------------
--
-- Menandai kumpulan pesan sebagai telah dibaca oleh pemanggil.
-- Melewatkan pesan milik sendiri dan pesan yang sudah kedaluwarsa (> 24 jam).
-- Mengembalikan jumlah baris baru yang berhasil ditandai.

CREATE OR REPLACE FUNCTION public.chat_tandai_dibaca(p_message_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_staff  record;
  v_count  integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT coalesce(nullif(btrim(display_name), ''), name) AS nama,
         avatar_url
    INTO v_staff
    FROM public.outlet_staff
   WHERE id = v_uid;

  INSERT INTO public.chat_message_reads (message_id, user_id, user_name, user_avatar, read_at)
  SELECT m.id, v_uid, coalesce(v_staff.nama, ''), v_staff.avatar_url, now()
    FROM public.chat_messages m
   WHERE m.id = ANY(p_message_ids)
     AND m.sender_id <> v_uid
     AND m.created_at > now() - interval '24 hours'
  ON CONFLICT (message_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_tandai_dibaca(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_tandai_dibaca(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.chat_tandai_dibaca(uuid[]) IS
  'Menandai kumpulan pesan chat sebagai dibaca oleh sesi login aktif (batch insert). Mengabaikan pesan sendiri dan yang sudah dibaca sebelumnya.';

-- 6. RPC Detail Info Pesan (Info Pesan ala WA) --------------------------------
--
-- Mengembalikan rincian pesan, daftar orang yang sudah membaca (urut waktu baca terbaru),
-- dan daftar anggota tim aktif yang belum membaca (kecuali si pengirim pesan).

CREATE OR REPLACE FUNCTION public.chat_info_pesan(p_message_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_pesan  record;
  v_dibaca json;
  v_belum  json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  SELECT id, sender_id, sender_name, sender_avatar, body, image_path, created_at, edited_at
    INTO v_pesan
    FROM public.chat_messages
   WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesan tidak ditemukan atau sudah terhapus.';
  END IF;

  -- 1. Daftar anggota yang sudah membaca
  SELECT coalesce(json_agg(
           json_build_object(
             'user_id', r.user_id,
             'nama', coalesce(nullif(btrim(os.display_name), ''), os.name, r.user_name),
             'display_username', os.display_username,
             'avatar_url', coalesce(os.avatar_url, r.user_avatar),
             'role', os.role,
             'outlet_nama', o.name,
             'read_at', r.read_at
           ) ORDER BY r.read_at DESC
         ), '[]'::json)
    INTO v_dibaca
    FROM public.chat_message_reads r
    LEFT JOIN public.outlet_staff os ON os.id = r.user_id
    LEFT JOIN public.outlets o ON o.id = os.outlet_id
   WHERE r.message_id = p_message_id;

  -- 2. Daftar anggota aktif yang belum membaca (tidak termasuk si pengirim pesan)
  SELECT coalesce(json_agg(
           json_build_object(
             'user_id', os.id,
             'nama', coalesce(nullif(btrim(os.display_name), ''), os.name),
             'display_username', os.display_username,
             'avatar_url', os.avatar_url,
             'role', os.role,
             'outlet_nama', o.name,
             'read_at', null
           ) ORDER BY coalesce(nullif(btrim(os.display_name), ''), os.name) ASC
         ), '[]'::json)
    INTO v_belum
    FROM public.outlet_staff os
    LEFT JOIN public.outlets o ON o.id = os.outlet_id
   WHERE coalesce(os.status, 'active') = 'active'
     AND os.id <> v_pesan.sender_id
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_message_reads r
        WHERE r.message_id = p_message_id
          AND r.user_id = os.id
     );

  RETURN json_build_object(
    'message_id', v_pesan.id,
    'sender_id', v_pesan.sender_id,
    'created_at', v_pesan.created_at,
    'dibaca', v_dibaca,
    'belum_dibaca', v_belum
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_info_pesan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_info_pesan(uuid) TO authenticated;

COMMENT ON FUNCTION public.chat_info_pesan(uuid) IS
  'Mengembalikan informasi lengkap pembacaan pesan (dibaca dan belum dibaca) untuk layar Info Pesan ala WhatsApp.';
