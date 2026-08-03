-- 20300105000006_accessible_outlet_ids_area_manager.sql
--
-- Peran 'area_manager' (5 aktif, mis. abubakar@ss.com -> MITRA PALEDANG)
-- belum terdaftar di accessible_outlet_ids() -- fungsi mengembalikan himpunan
-- KOSONG untuk mereka, sama seperti kasus 'regional_manager' yang sudah
-- diperbaiki (20300104000002). Akibat nyata: Server Action apa pun yang
-- lewat assertOutletAccessible() (mis. estimasi_produksi.ts) menolak dengan
-- "Forbidden: outlet di luar scope akses Anda" walau outlet_id-nya OWN outlet.
--
-- Dua jalur ditambahkan sekaligus:
-- 1. me.outlet_id langsung (pola sama dengan crew/kiosk/mitra/staff_pusat) --
--    berlaku SEKARANG karena datanya sudah ada di outlet_staff.outlet_id.
-- 2. area_manager_outlets (tabel many-to-many, migration 20260730000000,
--    pola sama dengan staff_outlets utk leader/korlap) -- tabelnya MASIH
--    KOSONG (0 baris) per 2026-08-03, jadi jalur ini belum menyumbang apa
--    pun hari ini, tapi siap dipakai begitu wilayah binaan tiap area manager
--    diisi (keputusan bisnis, di luar cakupan migration ini -- siapa
--    membina outlet mana perlu ditentukan pemilik data, bukan ditebak di sini).
--
-- 'spv' tetap dipertahankan (0 pengguna, tidak berbahaya, lihat 20300104000002).

CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role IN ('leader', 'korlap') AND so.staff_id = me.id
  UNION
  SELECT amo.outlet_id FROM public.area_manager_outlets amo, me
    WHERE me.role = 'area_manager' AND amo.manager_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat', 'area_manager');
$function$;
