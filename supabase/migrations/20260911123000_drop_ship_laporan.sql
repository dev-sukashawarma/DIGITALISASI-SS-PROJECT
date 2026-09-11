-- 20260911123000_drop_ship_laporan.sql
-- Saudara hpp_barang_masuk_harian_spv (yang HANYA membaca surat jalan, sehingga
-- sayur drop-ship tak pernah terhitung). Dipakai rekonsiliasi "nilai keluar
-- terkunci vs BOM terpakai". Spec §8.
--
-- security_invoker=true wajib -- tanpa itu view definer membocorkan data
-- lintas outlet/role (RLS tvo_select tvo_select membatasi ke
-- accessible_outlet_ids() + role privileged; view definer akan melewati itu).
-- Outlet tes dikecualikan lewat outlet_ids_terhitung() (outlets.type='test'),
-- pola kanonik CLAUDE.md untuk agregasi laporan baru -- bukan kecocokan nama.
SET lock_timeout = '5s';

CREATE OR REPLACE VIEW public.nilai_masuk_drop_ship_harian
WITH (security_invoker = true) AS
SELECT t.outlet_id, t.tanggal_terima AS tanggal, sum(t.qty * t.harga_snapshot) AS nilai_masuk
  FROM public.terima_vendor_outlet t
 WHERE t.status IN ('dicatat','disahkan')
   AND t.outlet_id IN (SELECT public.outlet_ids_terhitung())
 GROUP BY t.outlet_id, t.tanggal_terima;

REVOKE ALL ON public.nilai_masuk_drop_ship_harian FROM PUBLIC, anon;
GRANT SELECT ON public.nilai_masuk_drop_ship_harian TO authenticated, service_role;

-- DOWN: DROP VIEW IF EXISTS public.nilai_masuk_drop_ship_harian;
