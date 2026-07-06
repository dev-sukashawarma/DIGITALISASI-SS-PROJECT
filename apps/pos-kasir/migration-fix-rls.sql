-- Perbaikan RLS Functions (Unifikasi Profil -> Outlet Staff)
-- Mengupdate fungsi get_user_role dan get_user_outlet_id agar membaca
-- dari tabel outlet_staff sebagai sumber kebenaran identitas (bukan tabel profiles yang sudah usang).
-- Ini memperbaiki bug di mana kasir tidak bisa mengubah status pesanan.

CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM outlet_staff WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_outlet_id() RETURNS uuid AS $$
  SELECT outlet_id FROM outlet_staff WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
