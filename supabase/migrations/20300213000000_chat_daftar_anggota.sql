-- Daftar anggota Chat Tim, untuk layar Info Grup di app native.
--
-- KENAPA RPC, BUKAN SELECT BIASA
-- RLS `outlet_staff` sengaja sempit: seseorang hanya melihat barisnya sendiri,
-- kecuali SPV/kepala outlet (satu outlet) atau pemegang `accessible_outlet_ids`.
-- Chat ini se-perusahaan, jadi daftar anggotanya mustahil dibaca lewat SELECT
-- biasa oleh kru biasa. Melebarkan policy `outlet_staff` demi chat adalah harga
-- yang salah: tabel itu memuat data kepegawaian, dan sekali dibuka lebar ia
-- terbuka untuk SEMUA kolom di SEMUA jalur, bukan hanya untuk layar ini.
--
-- Fungsi ini membuka tepat enam kolom tampilan dan tidak lebih.
--
-- YANG SENGAJA TIDAK DIBUKA
--   `username`      : itu identitas login (<username>@outlet.local). Membukanya
--                     se-perusahaan berarti membagikan separuh kredensial semua
--                     orang. Yang dipakai di sini `display_username`, yang murni
--                     nama tampilan pilihan staff sendiri.
--   `ref_photo_url` : foto acuan wajah untuk absensi, bukan foto profil.
--   sisanya         : role/status/outlet_id internal, face_descriptor, dst.
--
-- Cakupan yang diterima sadar: setiap pemegang akun jadi bisa melihat nama,
-- foto, jabatan, dan outlet seluruh rekan. Itu setara dengan yang sudah terlihat
-- di dalam percakapan itu sendiri, jadi tidak menambah keterbukaan baru.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.chat_daftar_anggota()
RETURNS TABLE (
  id               uuid,
  nama             text,
  display_username text,
  avatar_url       text,
  role             text,
  outlet_nama      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT os.id,
         coalesce(nullif(btrim(os.display_name), ''), os.name) AS nama,
         os.display_username,
         os.avatar_url,
         os.role,
         o.name AS outlet_nama
    FROM public.outlet_staff os
    LEFT JOIN public.outlets o ON o.id = os.outlet_id
   -- Tanpa sesi tidak ada yang boleh melihat apa pun. GRANT di bawah sudah
   -- menutup anon; penjaga ini lapis keduanya.
   WHERE auth.uid() IS NOT NULL
     AND coalesce(os.status, 'active') = 'active'
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.chat_daftar_anggota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_daftar_anggota() TO authenticated;

COMMENT ON FUNCTION public.chat_daftar_anggota() IS
  'Daftar anggota Chat Tim native: hanya kolom tampilan (nama, display_username, avatar, role, outlet). Tidak pernah membuka username login maupun foto acuan wajah.';

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.chat_daftar_anggota();
