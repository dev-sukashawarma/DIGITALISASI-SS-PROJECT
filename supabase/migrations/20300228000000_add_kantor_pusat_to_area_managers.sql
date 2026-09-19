-- 20300228000000_add_kantor_pusat_to_area_managers.sql
-- Menambahkan outlet "KANTOR PUSAT" ke tabel staff_outlets untuk semua user dengan role area_manager.
-- Hal ini memungkinkan area manager untuk memilih dan melakukan absensi di Kantor Pusat
-- baik melalui Web Absensi maupun Native SuperApp.

INSERT INTO public.staff_outlets (staff_id, outlet_id)
SELECT id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
FROM public.outlet_staff
WHERE role = 'area_manager'
ON CONFLICT (staff_id, outlet_id) DO NOTHING;
