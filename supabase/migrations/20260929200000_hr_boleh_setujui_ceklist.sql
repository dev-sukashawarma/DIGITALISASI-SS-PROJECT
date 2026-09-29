-- HR (role admin_hr) boleh menyetujui ceklist harian Area Manager (2026-09-29).
--
-- Permintaan owner: persetujuan ceklist harian tidak hanya oleh regional manager.
--
-- Badan fungsi DISALIN DARI DEFINISI LIVE (pg_get_functiondef, md5
-- 9125fa058286708dd4bf661e4c5cc9c0 = hasil 20300242000000), bukan dari berkas
-- lama: CREATE OR REPLACE diam-diam membuang apa pun yang tidak ikut ditulis
-- ulang (kunci versi anti-race, push ke AM). Perubahan hanya:
--   1. 'admin_hr' masuk daftar role peninjau (+ pesan galat).
--   2. Push ke AM menyebut jabatan peninjau yang sebenarnya — sebelumnya selalu
--      tertulis "(Regional Manager)" walau yang menyetujui admin/owner.
--
-- Signature, SECURITY DEFINER, search_path, dan ACL tidak berubah. Idempoten.
--
-- ⚠️ Utang replay: fungsi ini juga didefinisikan 20300238/241/242 (timestamp
-- 2030) yang terurut SESUDAH berkas ini. Di produksi aman (semuanya sudah
-- terstempel); pada replay dari nol, 20300242 menimpa balik versi ini.

CREATE OR REPLACE FUNCTION public.tinjau_ceklist_harian(p_ceklist_id uuid, p_tanggapan text, p_diperbarui_pada timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ditinjau_pada timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_role TEXT;
  v_nama TEXT;
  v_outlet UUID;
  v_c RECORD;
  v_outlet_nama TEXT;
  v_tanggapan TEXT := NULLIF(btrim(p_tanggapan), '');
  v_sudah BOOLEAN;
  v_bulan TEXT[] := ARRAY['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  v_isi TEXT;
  v_jabatan TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;

  SELECT role, COALESCE(NULLIF(btrim(name), ''), display_name, '')
    INTO v_role, v_nama
    FROM public.outlet_staff WHERE id = v_user;
  IF v_role IS NULL OR v_role NOT IN ('regional_manager', 'admin', 'owner', 'admin_hr') THEN
    RAISE EXCEPTION 'Hanya regional manager atau HR yang boleh meninjau ceklist harian';
  END IF;
  v_jabatan := CASE v_role
    WHEN 'regional_manager' THEN 'Regional Manager'
    WHEN 'admin_hr' THEN 'HR'
    WHEN 'owner' THEN 'Owner'
    ELSE 'Admin'
  END;

  SELECT * INTO v_c FROM public.ceklist_harian WHERE id = p_ceklist_id FOR UPDATE;
  v_outlet := v_c.outlet_id;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'Ceklist tidak ditemukan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS a(id) WHERE a.id = v_outlet) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;

  IF p_diperbarui_pada IS NOT NULL AND (
       v_c.updated_at IS DISTINCT FROM p_diperbarui_pada
    OR v_c.ditinjau_pada IS DISTINCT FROM p_ditinjau_pada
  ) THEN
    RAISE EXCEPTION 'Laporan ini baru saja diperbarui. Muat ulang dan periksa lagi sebelum menyetujui.';
  END IF;

  v_sudah := v_c.ditinjau_pada IS NOT NULL;

  UPDATE public.ceklist_harian SET
    ditinjau_oleh = v_user,
    nama_peninjau = v_nama,
    ditinjau_pada = NOW(),
    tanggapan_rm = v_tanggapan
  WHERE id = p_ceklist_id;

  SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = v_outlet;
  v_outlet_nama := COALESCE(NULLIF(btrim(v_outlet_nama), ''), 'outlet');

  v_isi := COALESCE(NULLIF(v_nama, ''), v_jabatan) || ' (' || v_jabatan || ') '
    || CASE WHEN v_sudah THEN 'memperbarui tanggapan untuk' ELSE 'menyetujui' END
    || ' ceklist harian ' || v_outlet_nama || ' tanggal '
    || extract(day FROM v_c.tanggal)::int || ' ' || v_bulan[extract(month FROM v_c.tanggal)::int]
    || ' ' || extract(year FROM v_c.tanggal)::int || '.'
    || CASE WHEN v_tanggapan IS NOT NULL
         THEN E'\n💬 Tanggapan: "' || v_tanggapan || '"'
         ELSE E'\nTidak ada catatan tambahan.' END;

  IF v_c.submitted_by <> v_user THEN
    PERFORM public.ceklist_harian_kirim_push(
      v_c.submitted_by,
      CASE WHEN v_sudah
        THEN '💬 Tanggapan ' || CASE WHEN v_role = 'admin_hr' THEN 'HR' ELSE 'RM' END || ' Diperbarui'
        ELSE '✅ Ceklist Disetujui' END
        || ' · ' || v_outlet_nama,
      v_isi
    );
  END IF;
END;
$function$;
