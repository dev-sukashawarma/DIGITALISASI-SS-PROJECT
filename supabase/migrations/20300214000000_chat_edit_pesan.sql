-- Menyunting pesan yang sudah terkirim di Chat Tim.
--
-- KENAPA RPC, BUKAN POLICY UPDATE
-- RLS bekerja per BARIS, bukan per KOLOM. Policy UPDATE apa pun bentuknya akan
-- sekaligus mengizinkan pengirim menulis ulang `sender_id`, `created_at`,
-- `image_path`, dan snapshot kutipan miliknya sendiri — artinya memalsukan siapa
-- pengirimnya dan kapan dikirim. Fungsi SECURITY DEFINER dengan daftar kolom
-- tetap adalah satu-satunya cara membatasi tepat pada `body`.
--
-- BATAS WAKTU 15 MENIT
-- Mengikuti kebiasaan aplikasi chat lain. Alasannya bukan teknis: pesan yang
-- sudah ditanggapi orang lain tidak boleh bisa ditulis ulang isinya, karena
-- jawaban di bawahnya jadi tidak masuk akal dan tidak ada yang tahu apa yang
-- sebenarnya tertulis. Nilai ini ditegakkan DI SINI; aplikasi hanya
-- menyembunyikan tombolnya, dan menyembunyikan tombol bukan penjagaan.

SET lock_timeout = '5s';

-- 1. Penanda sunting -------------------------------------------------------
--
-- Kolom terpisah, bukan menimpa `created_at`: urutan pesan harus tetap
-- mengikuti waktu KIRIM. Kalau menyunting memindahkan pesan ke bawah, percakapan
-- yang sudah dibaca orang akan berubah susunannya.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN public.chat_messages.edited_at IS
  'Kapan isi pesan terakhir disunting. NULL = belum pernah. Tidak memengaruhi urutan; urutan tetap dari created_at.';

-- 2. Fungsi sunting ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_edit_pesan(p_id uuid, p_body text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_pesan record;
  v_body  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  SELECT id, sender_id, created_at, image_path
    INTO v_pesan
    FROM public.chat_messages
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesan tidak ditemukan atau sudah terhapus.';
  END IF;
  IF v_pesan.sender_id <> v_uid THEN
    RAISE EXCEPTION 'Hanya pengirimnya yang dapat menyunting pesan ini.';
  END IF;
  IF v_pesan.created_at < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Pesan hanya dapat disunting dalam 15 menit setelah dikirim.';
  END IF;

  v_body := btrim(coalesce(p_body, ''));
  IF char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Pesan maksimal 2000 karakter.';
  END IF;
  -- Pesan berfoto boleh berketerangan kosong; pesan teks tidak boleh dikosongkan
  -- sampai tak bersisa — itu sama dengan menghapus lewat pintu belakang, tanpa
  -- melewati konfirmasi hapus.
  IF v_body = '' AND v_pesan.image_path IS NULL THEN
    RAISE EXCEPTION 'Pesan tidak boleh dikosongkan. Hapus pesannya bila memang tidak diperlukan.';
  END IF;

  UPDATE public.chat_messages
     SET body = v_body,
         edited_at = now()
   WHERE id = p_id;

  RETURN (
    SELECT json_build_object(
      'id', id,
      'body', body,
      'edited_at', edited_at
    )
    FROM public.chat_messages WHERE id = p_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_edit_pesan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_edit_pesan(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.chat_edit_pesan(uuid, text) IS
  'Menyunting isi pesan chat sendiri dalam 15 menit setelah dikirim. Hanya kolom body yang tersentuh; pengirim, waktu kirim, foto, dan kutipan tidak dapat diubah.';

-- CATATAN
-- Kutipan balasan menyimpan SNAPSHOT teks saat dibalas (reply_to_snippet), jadi
-- menyunting pesan asli TIDAK mengubah kutipan yang sudah terlanjur menempel di
-- balasan. Itu memang disengaja: kutipan adalah catatan apa yang dibaca si
-- pembalas saat itu.

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.chat_edit_pesan(uuid, text);
--   ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS edited_at;
