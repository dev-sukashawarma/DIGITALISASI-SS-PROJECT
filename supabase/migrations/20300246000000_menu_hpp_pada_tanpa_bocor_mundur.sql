-- Perbaikan arti public.menu_hpp_pada (regresi dari 20300245000000_optimize_mitra_orders_summary).
--
-- Masalah: versi 20300245000000 memakai COALESCE(<nilai riwayat>, menu_items.<kolom>). Bila nilai
-- riwayat pada tanggal itu KOSONG (hpp_override lama NULL, kunci kanal belum ada, atau kunci
-- direset ke NULL), fungsi mengambil angka HARI INI dari menu_items → HPP baru bocor mundur ke
-- tanggal sebelum berlaku_mulai. Contoh nyata: HPP BOGO baru 7.546 berlaku 19 Sep ikut tampil
-- untuk 18 Sep dan Agustus. Tertangkap uji coba input HPP 26 Sep 2026 (belum ada data yang rusak).
--
-- Aturan yang benar (spec docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md §3.2):
-- menu yang PUNYA riwayat hanya memakai riwayat — per kunci baris berlaku_mulai terbesar yang
-- <= tanggal; kunci tanpa baris = tidak ada; hpp_override NULL bila tak ada; channel_hpp '{}'
-- bila tak ada kunci bernilai. menu_items dipakai HANYA bila menu tak punya riwayat sama sekali.
--
-- Bentuk query cepat dari 20300245000000 dipertahankan (satu SELECT, tanpa SET → bisa di-inline).
--
-- ⚠️ Timestamp 2030 disengaja: 20300245000000 (yang mendefinisikan fungsi ini) terurut paling
-- akhir dan per 26 Sep BELUM terstempel di schema_migrations. Berkas ini harus terurut SETELAHNYA
-- agar `db push` maupun replay dari nol berakhir di versi yang benar. Melanggar
-- migration-timestamp-lint dengan sadar.
BEGIN;

CREATE OR REPLACE FUNCTION public.menu_hpp_pada(p_menu_item_id uuid, p_tanggal date DEFAULT NULL::date)
RETURNS TABLE (hpp_override numeric, channel_hpp jsonb)
LANGUAGE sql STABLE AS $$
  SELECT
    CASE WHEN h.ada THEN
      (SELECT r.nilai FROM public.menu_hpp_riwayat r
       WHERE r.menu_item_id = p_menu_item_id AND r.kunci = 'hpp_override'
         AND r.berlaku_mulai <= COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date)
       ORDER BY r.berlaku_mulai DESC LIMIT 1)
    ELSE m.hpp_override END AS hpp_override,
    CASE WHEN h.ada THEN
      COALESCE(
        (SELECT jsonb_object_agg(sub.kunci, sub.nilai)
         FROM (
           SELECT DISTINCT ON (r.kunci) r.kunci, r.nilai
           FROM public.menu_hpp_riwayat r
           WHERE r.menu_item_id = p_menu_item_id AND r.kunci <> 'hpp_override'
             AND r.berlaku_mulai <= COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date)
           ORDER BY r.kunci, r.berlaku_mulai DESC
         ) sub
         WHERE sub.nilai IS NOT NULL),
        '{}'::jsonb)
    ELSE COALESCE(m.channel_hpp, '{}'::jsonb) END AS channel_hpp
  FROM public.menu_items m
  CROSS JOIN LATERAL (
    SELECT EXISTS (SELECT 1 FROM public.menu_hpp_riwayat r WHERE r.menu_item_id = m.id) AS ada
  ) h
  WHERE m.id = p_menu_item_id;
$$;
GRANT EXECUTE ON FUNCTION public.menu_hpp_pada(uuid, date) TO authenticated, service_role;

-- Gerbang nol pergeseran (riwayat saat ini hanya seed): rekonstruksi hari ini = menu_items untuk semua menu
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.menu_items m CROSS JOIN LATERAL public.menu_hpp_pada(m.id, NULL) h
  WHERE h.hpp_override IS DISTINCT FROM m.hpp_override
     OR h.channel_hpp IS DISTINCT FROM COALESCE((
          SELECT jsonb_object_agg(e.key, public._hpp_nilai_json(e.value))
          FROM jsonb_each(COALESCE(m.channel_hpp, '{}'::jsonb)) e
          WHERE public._hpp_nilai_json(e.value) IS NOT NULL), '{}'::jsonb);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'menu_hpp_pada bergeser untuk % menu — migration dibatalkan', v_n;
  END IF;
END $$;

COMMIT;
