-- 20300105000007_accessible_outlet_ids_area_manager_use_staff_outlets.sql
--
-- KOREKSI atas 20300105000006. Migration sebelumnya menambahkan area_manager
-- lewat tabel `area_manager_outlets` (migration 20260730000000) yang ternyata
-- TIDAK DIPAKAI KODE APLIKASI MANA PUN -- di-grep di seluruh repo, nol hit.
-- `apps/manager` (7 file, dikerjakan paralel hari ini: monitoring/route.ts,
-- petty-cash/actions.ts, team/page.tsx, dst) ternyata memakai `staff_outlets`
-- (staff_id, outlet_id) -- TABEL YANG SAMA yang sudah dipakai leader/korlap.
--
-- Diverifikasi: `staff_outlets` untuk Abu Bakar (abubakar@ss.com) SUDAH berisi
-- 5 outlet yang benar (Empang, Cimanggu, Dramaga, Paledang, Cicurug) --
-- kemungkinan diisi sesi lain yang membangun apps/manager. Jadi
-- `area_manager_outlets` bukan cuma tak terpakai, tapi DUPLIKAT sumber
-- kebenaran yang bisa membingungkan (persis yang diingatkan user).
--
-- Fix: tambahkan 'area_manager' ke cabang staff_outlets yang SUDAH ADA
-- (bukan bikin cabang baru), buang cabang area_manager_outlets sepenuhnya.
-- 'area_manager' juga dibuang dari cabang single-outlet (me.outlet_id) --
-- staff_outlets sudah mencakup home base-nya (Paledang ikut ter-mapping di
-- sana), jadi tidak perlu dua jalur untuk outlet yang sama.

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
    WHERE me.role IN ('leader', 'korlap', 'area_manager') AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$function$;

-- Bersihkan 5 baris yang salah masuk ke area_manager_outlets (migration
-- sebelumnya) -- staff_outlets sudah punya data yang benar, ini cuma jejak
-- percobaan pertama yang keliru tabel. Tabel area_manager_outlets sendiri
-- TIDAK dihapus (bukan wewenang migration ini membongkar objek buatan
-- developer lain), hanya datanya yang dikosongkan agar tak ada dua sumber
-- kebenaran yang keduanya "kelihatan aktif".
DELETE FROM public.area_manager_outlets
WHERE manager_id = '2d4ae4e5-5f56-410b-928d-3e49f99d72d9';
