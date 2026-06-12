-- ============================================================
-- MIGRATION: HARD REVOKE SESI KIOSK (Remote Kiosk Logout)
-- Jalankan sekali di Supabase SQL Editor.
-- Fungsi ini menghapus sesi server sebuah akun (by user_id) sehingga
-- tablet kiosk yang OFFLINE / mengabaikan sinyal realtime tetap ter-logout
-- begitu mencoba refresh token berikutnya. Tablet ONLINE sudah ter-logout
-- instan via broadcast (kiosk memanggil signOut sendiri).
-- ============================================================

-- Hapus semua sesi (dan refresh token via cascade) milik satu user.
CREATE OR REPLACE FUNCTION public.revoke_kiosk_sessions(target_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  DELETE FROM auth.sessions WHERE user_id = target_user;
$$;

-- Keamanan: HANYA service_role (dipakai oleh API route) yang boleh memanggil.
-- Cabut hak eksekusi dari klien publik agar tak bisa dipanggil sembarangan.
REVOKE ALL ON FUNCTION public.revoke_kiosk_sessions(uuid) FROM public;
REVOKE ALL ON FUNCTION public.revoke_kiosk_sessions(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_kiosk_sessions(uuid) TO service_role;

-- SELESAI.
