-- Nama crew backup untuk Papan & Rekap Kehadiran.
--
-- Crew backup (dipinjam dari cabang lain) absen di outlet yang bukan penempatannya.
-- RLS `outlet_staff` hanya membuka baris staf dari outlet yang bisa diakses pembaca,
-- jadi leader/AM outlet tujuan tidak bisa membaca nama mereka: di Papan orangnya
-- hilang, di Rekap namanya "-".
--
-- Fungsi ini membuka nama, role, dan username SEBATAS orang yang memang punya absen
-- di outlet tersebut, dan hanya bila outlet itu bisa diakses pemanggil. Tidak bisa
-- dipakai untuk menjelajah daftar staf: id yang tidak pernah absen di sana diabaikan.
-- Dipanggil dari native (feature/absensi DaftarStafAbsensi.backup).

CREATE OR REPLACE FUNCTION public.staf_absen_di_outlet(p_outlet_id uuid, p_ids uuid[])
RETURNS TABLE (id uuid, name text, role text, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.name, s.role, s.username
  FROM public.outlet_staff s
  WHERE s.id = ANY (p_ids[1:200])
    AND p_outlet_id IN (SELECT public.accessible_outlet_ids())
    AND EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.outlet_staff_id = s.id
        AND a.outlet_id = p_outlet_id
    );
$$;

REVOKE ALL ON FUNCTION public.staf_absen_di_outlet(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staf_absen_di_outlet(uuid, uuid[]) TO authenticated;
