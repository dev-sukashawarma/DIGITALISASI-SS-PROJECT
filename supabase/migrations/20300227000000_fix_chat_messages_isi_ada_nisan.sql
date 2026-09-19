-- Fix: Izinkan pesan terhapus (nisan / soft-delete) memiliki body kosong tanpa melanggar constraint isi_ada.
-- Sebelumnya, chat_messages_isi_ada mewajibkan btrim(body) <> '' OR image_path IS NOT NULL OR audio_path IS NOT NULL.
-- Saat chat_hapus_pesan mengosongkan body, image_path, dan audio_path sambil menyetel deleted_at = now(),
-- PostgreSQL menolak update dengan error 23514 (check constraint "chat_messages_isi_ada").
-- Dengan menambahkan `deleted_at IS NOT NULL`, pesan yang terhapus sebagai nisan diperbolehkan.

SET lock_timeout = '5s';

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_isi_ada;

ALTER TABLE public.chat_messages
    ADD CONSTRAINT chat_messages_isi_ada
    CHECK (
        deleted_at IS NOT NULL
        OR btrim(body) <> ''
        OR image_path IS NOT NULL
        OR audio_path IS NOT NULL
    );

COMMENT ON CONSTRAINT chat_messages_isi_ada ON public.chat_messages IS
  'Pesan aktif wajib memiliki isi (teks tidak kosong, foto, atau rekaman suara). Pesan terhapus (nisan / deleted_at IS NOT NULL) diperbolehkan kosong.';
