-- 20300104000002_accessible_outlet_ids_regional_manager.sql
-- Peran 'spv' sudah 0 pengguna; penggantinya 'regional_manager' (2 aktif) tidak
-- terdaftar di fungsi ini sehingga accessible_outlet_ids() mengembalikan KOSONG
-- untuk mereka -> seluruh RLS berbasis fungsi ini menolak barisnya, padahal
-- packages/auth/src/access.ts sudah memberi mereka akses 7 app.
--
-- 'spv' sengaja DIPERTAHANKAN (0 pengguna = tidak berbahaya); pencabutannya
-- perubahan terpisah.
--
-- DI LUAR CAKUPAN: 'area_manager' (punya area_manager_outlets sendiri) dan
-- 'purchasing' (butuh keputusan bisnis).
--
-- Salinan verbatim definisi live per 2026-08-02, HANYA menambah satu peran.
-- Sebelum mengubah fungsi ini: grep -rn "accessible_outlet_ids" supabase/migrations/

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
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$function$;
