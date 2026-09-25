-- Ceklist harian: menutup tiga celah race/penerima yang ditemukan audit 24 Sep 2026.
--
-- 1. Kiriman PERTAMA yang bersamaan untuk (outlet, tanggal) yang sama.
--    `SELECT ... FOR UPDATE` tidak mengunci apa pun selama barisnya belum ada, jadi
--    dua transaksi sama-sama INSERT dan yang kedua jatuh ke 23505 mentah — AM
--    melihat "Gagal mengirim ceklist" alih-alih "sudah diisi oleh X". Kunci
--    advisory per (outlet, tanggal) menyerialkan keduanya: yang kedua menunggu,
--    lalu menemukan baris yang pertama dan melewati jalur yang semestinya.
--
-- 2. RM menyetujui isi yang belum pernah dilihatnya.
--    Bila AM mengirim ulang tepat sebelum RM menekan Setujui, persetujuan jatuh ke
--    versi baru. Dua RM juga bisa saling menimpa tanggapan. `tinjau_ceklist_harian`
--    kini menerima token versi yang dilihat peninjau (`updated_at` dan
--    `ditinjau_pada`) dan menolak bila salah satunya sudah berubah. Kedua parameter
--    ber-DEFAULT NULL: pemanggil lama (dua argumen) tetap jalan tanpa pemeriksaan.
--
-- 3. Penerima push "ceklist masuk": RM yang status-nya sudah tidak aktif ikut
--    dikirimi karena filternya hanya `is_active`. (Seluruh RM memang berhak atas
--    seluruh outlet lewat accessible_outlet_ids(), jadi tidak ada penyaringan
--    wilayah yang perlu ditambahkan.)

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

  -- (1) Serialkan kiriman untuk (outlet, tanggal) yang sama, termasuk saat barisnya
  -- belum ada. Dilepas otomatis di akhir transaksi.
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
    -- (3) Hanya RM yang benar-benar aktif.
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

-- (2) Signature berubah; overload dua-argumen lama harus dibuang supaya panggilan
-- PostgREST dengan dua argumen tidak ambigu.
DROP FUNCTION IF EXISTS public.tinjau_ceklist_harian(uuid, text);

CREATE FUNCTION public.tinjau_ceklist_harian(
  p_ceklist_id uuid,
  p_tanggapan text,
  p_diperbarui_pada timestamptz DEFAULT NULL,
  p_ditinjau_pada timestamptz DEFAULT NULL
)
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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;

  SELECT role, COALESCE(NULLIF(btrim(name), ''), display_name, '')
    INTO v_role, v_nama
    FROM public.outlet_staff WHERE id = v_user;
  IF v_role IS NULL OR v_role NOT IN ('regional_manager', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Hanya regional manager yang boleh meninjau ceklist harian';
  END IF;

  -- Dikunci supaya kiriman ulang AM dan peninjau lain tidak menyelinap di antara
  -- pemeriksaan versi dan UPDATE di bawah.
  SELECT * INTO v_c FROM public.ceklist_harian WHERE id = p_ceklist_id FOR UPDATE;
  v_outlet := v_c.outlet_id;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'Ceklist tidak ditemukan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS a(id) WHERE a.id = v_outlet) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;

  -- Pemanggil yang mengirim token versi: tolak bila laporan sudah berubah sejak
  -- dilihat — dikirim ulang AM (updated_at) atau sudah ditinjau/ditanggapi
  -- peninjau lain (ditinjau_pada; NULL berarti "saat dilihat belum ditinjau").
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

  v_isi := COALESCE(NULLIF(v_nama, ''), 'Regional manager') || ' (Regional Manager) '
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
      CASE WHEN v_sudah THEN '💬 Tanggapan RM Diperbarui' ELSE '✅ Ceklist Disetujui' END
        || ' · ' || v_outlet_nama,
      v_isi
    );
  END IF;
END;
$function$;

-- Fungsi baru otomatis dapat EXECUTE untuk PUBLIC; samakan dengan yang lama:
-- hanya pengguna login dan service role.
REVOKE ALL ON FUNCTION public.tinjau_ceklist_harian(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tinjau_ceklist_harian(uuid, text, timestamptz, timestamptz) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
