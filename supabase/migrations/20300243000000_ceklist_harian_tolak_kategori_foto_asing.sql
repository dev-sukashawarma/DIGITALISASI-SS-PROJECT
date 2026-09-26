-- Ceklist harian: tolak kategori foto yang tidak dikenal dengan pesan terkendali.
--
-- Ditemukan saat uji backend 25 Sep 2026 (versi web ceklist harian): p_foto dengan
-- kategori di luar delapan kategori sah lolos seluruh validasi RPC lalu jatuh ke
-- CHECK `ceklist_harian_foto_kategori_check` saat INSERT — error 23514 mentah alih-
-- alih 'Foto ceklist belum lengkap'. Aplikasi web & native tidak pernah mengirim
-- kategori asing, jadi hanya terjangkau request buatan tangan; perilaku klien yang
-- sah tidak berubah.
--
-- Badan fungsi DISALIN DARI DEFINISI LIVE (pg_get_functiondef, md5
-- e506a2e09df40f33b92abb9ed21e6f57 = hasil 20300242000000), bukan dari berkas lama:
-- CREATE OR REPLACE diam-diam membuang apa pun yang tidak ikut ditulis ulang, dan
-- fungsi ini memuat kunci advisory anti-race serta push ke regional manager.
-- Satu-satunya perubahan: blok IF kategori foto di bawah pemeriksaan path.
--
-- Signature, SECURITY DEFINER, search_path, dan hak akses (CREATE OR REPLACE
-- mempertahankan ACL) tidak berubah. Idempoten.

CREATE OR REPLACE FUNCTION public.submit_ceklist_harian(p_outlet_id uuid, p_items jsonb, p_foto jsonb, p_temuan text[], p_perbaikan text[], p_catatan text, p_online_review text[] DEFAULT '{}'::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_role TEXT;
  v_nama TEXT;
  v_tanggal DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
  v_id UUID;
  v_pemilik UUID;
  v_nama_pemilik TEXT;
  v_baru BOOLEAN;
  v_outlet TEXT;
  v_isi_push TEXT;
  v_rm RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;

  SELECT role, COALESCE(NULLIF(btrim(name), ''), display_name, '')
    INTO v_role, v_nama
    FROM public.outlet_staff WHERE id = v_user;
  IF v_role IS DISTINCT FROM 'area_manager' THEN
    RAISE EXCEPTION 'Hanya area manager yang boleh mengisi ceklist harian';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS a(id) WHERE a.id = p_outlet_id) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT, nilai TEXT)
    WHERE r.nilai IS NULL OR r.nilai NOT IN ('baik', 'perhatian', 'buruk')
      OR (r.kategori, COALESCE(r.sub_item, '')) NOT IN (
        ('kebersihan', ''), ('stok', ''), ('seragam_crew', ''), ('peralatan', ''),
        ('rasa', 'sapi'), ('rasa', 'ayam'), ('rasa', 'kentang'), ('rasa', 'tum'), ('rasa', 'sayur')
      )
  ) OR (
    SELECT count(*) <> 9 OR count(DISTINCT (r.kategori, COALESCE(r.sub_item, ''))) <> 9
    FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT)
  ) THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;

  IF jsonb_typeof(p_foto) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Foto ceklist belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT)
    WHERE f.path IS NULL OR f.path NOT LIKE v_user::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Path foto ceklist tidak valid';
  END IF;
  -- Kategori foto di luar daftar ditolak dengan pesan terkendali. Sebelumnya lolos
  -- ke INSERT dan jatuh ke CHECK constraint (23514) mentah — klien melihat
  -- "Gagal mengirim" tanpa tahu sebabnya.
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT)
    WHERE f.kategori IS NULL OR f.kategori NOT IN (
      'kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan',
      'online_review', 'temuan', 'perbaikan'
    )
  ) THEN
    RAISE EXCEPTION 'Foto ceklist belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan',
      'online_review', 'temuan', 'perbaikan'
    ]) AS k(kategori)
    LEFT JOIN jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT) ON f.kategori = k.kategori
    GROUP BY k.kategori
    HAVING count(f.path) > 3
        OR (k.kategori NOT IN ('online_review', 'temuan', 'perbaikan') AND count(f.path) < 1)
  ) THEN
    RAISE EXCEPTION 'Foto ceklist belum lengkap';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ceklist_harian:' || p_outlet_id::text || ':' || v_tanggal::text, 0)
  );

  SELECT c.id, c.submitted_by, c.nama_am
    INTO v_id, v_pemilik, v_nama_pemilik
    FROM public.ceklist_harian c
    WHERE c.outlet_id = p_outlet_id AND c.tanggal = v_tanggal
    FOR UPDATE;

  IF v_id IS NOT NULL AND v_pemilik <> v_user THEN
    RAISE EXCEPTION 'Ceklist outlet ini hari ini sudah diisi oleh %', v_nama_pemilik;
  END IF;

  v_baru := v_id IS NULL;

  IF v_baru THEN
    INSERT INTO public.ceklist_harian
      (outlet_id, submitted_by, nama_am, tanggal, temuan, perbaikan, online_review, catatan)
    VALUES (
      p_outlet_id, v_user, v_nama, v_tanggal,
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_temuan) t WHERE btrim(t) <> ''), '{}'),
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_perbaikan) t WHERE btrim(t) <> ''), '{}'),
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_online_review) t WHERE btrim(t) <> ''), '{}'),
      NULLIF(btrim(p_catatan), '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ceklist_harian SET
      nama_am = v_nama,
      temuan = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_temuan) t WHERE btrim(t) <> ''), '{}'),
      perbaikan = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_perbaikan) t WHERE btrim(t) <> ''), '{}'),
      online_review = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_online_review) t WHERE btrim(t) <> ''), '{}'),
      catatan = NULLIF(btrim(p_catatan), ''),
      ditinjau_oleh = NULL,
      nama_peninjau = NULL,
      ditinjau_pada = NULL,
      tanggapan_rm = NULL,
      updated_at = NOW()
    WHERE id = v_id;
    DELETE FROM public.ceklist_harian_item WHERE ceklist_id = v_id;
    DELETE FROM public.ceklist_harian_foto WHERE ceklist_id = v_id;
  END IF;

  INSERT INTO public.ceklist_harian_item (ceklist_id, kategori, sub_item, nilai, keterangan)
  SELECT v_id, r.kategori, COALESCE(r.sub_item, ''), r.nilai, NULLIF(btrim(r.keterangan), '')
  FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT, nilai TEXT, keterangan TEXT);

  INSERT INTO public.ceklist_harian_foto (ceklist_id, kategori, path, urutan)
  SELECT v_id, f.kategori, f.path, (row_number() OVER (PARTITION BY f.kategori))::int
  FROM jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT);

  SELECT name INTO v_outlet FROM public.outlets WHERE id = p_outlet_id;
  v_isi_push := public.ceklist_harian_isi_push_rm(v_id, v_baru);
  FOR v_rm IN
    SELECT id FROM public.outlet_staff
    WHERE role = 'regional_manager' AND status = 'active' AND COALESCE(is_active, true) AND id <> v_user
  LOOP
    PERFORM public.ceklist_harian_kirim_push(
      v_rm.id,
      CASE WHEN v_baru THEN '📋 Ceklist Harian Masuk' ELSE '📋 Ceklist Harian Diperbarui' END
        || ' · ' || COALESCE(NULLIF(btrim(v_outlet), ''), 'Outlet'),
      v_isi_push
    );
  END LOOP;

  RETURN v_id;
END;
$function$;
