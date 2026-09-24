-- =============================================================================
-- Ceklist Harian: push notifikasi
-- =============================================================================
--
--   1. Area manager mengirim / memperbarui ceklist  -> semua regional manager aktif
--   2. Regional manager menyetujui (meninjau)        -> area manager pengirimnya
--
-- Push dikirim dari DALAM RPC, bukan trigger tabel: trigger AFTER INSERT pada
-- header berjalan sebelum item & foto tersimpan, sehingga isi notifikasi tidak
-- bisa merangkum poin yang bermasalah. pg_net baru benar-benar mengirim setelah
-- transaksi commit, jadi pengiriman yang gagal tidak memancarkan push.
--
-- Jalurnya sama dengan push void/waste/petty cash: URL `send-push` dan secret
-- dibaca dari Vault (`push_webhook_url`, `fcm_webhook_secret`), payload membawa
-- `url` = rute layar native (`manager_ceklist`). Kegagalan push hanya dicatat
-- sebagai WARNING — laporan tidak boleh gagal tersimpan karena notifikasinya.
-- Nama di laporan dan notifikasi memakai nama lengkap (`outlet_staff.name`),
-- bukan `display_name`: kolom itu nama panggilan pilihan staf (mis. username),
-- sedangkan laporan ke atasan butuh nama resmi. Laporan yang sudah ada ikut
-- disamakan di akhir migrasi ini.
-- Idempoten.
-- =============================================================================

set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- Pembantu internal: satu push ke satu staf.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ceklist_harian_kirim_push(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Push ceklist dilewati: secret push_webhook_url/fcm_webhook_secret belum ada di vault.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'app', 'manager',
      'title', p_title,
      'body', p_body,
      'url', 'manager_ceklist'
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengirim push ceklist harian: %', SQLERRM;
END;
$$;

-- Hanya dipanggil RPC di bawah (yang berjalan sebagai pemilik fungsi).
REVOKE ALL ON FUNCTION public.ceklist_harian_kirim_push(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ceklist_harian_kirim_push(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.ceklist_harian_kirim_push(UUID, TEXT, TEXT) FROM authenticated;

-- -----------------------------------------------------------------------------
-- Isi notifikasi untuk RM, dirangkum dari laporan yang sudah tersimpan.
--
--   📋 Ceklist Harian · BNR
--   Rizky mengirim ceklist harian BNR.
--   ⚠️ Perhatian: Stok (kurang aman)
--   ❌ Buruk: Rasa Ayam (tidak sesuai SOP)
--   📝 Temuan: 1 unit baling-baling kipas patah (+1 lainnya)
--   Ketuk untuk meninjau & menyetujui.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ceklist_harian_isi_push_rm(p_ceklist_id UUID, p_baru BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c RECORD;
  v_outlet TEXT;
  v_perhatian TEXT;
  v_buruk TEXT;
  v_isi TEXT;
BEGIN
  SELECT * INTO v_c FROM public.ceklist_harian WHERE id = p_ceklist_id;
  SELECT name INTO v_outlet FROM public.outlets WHERE id = v_c.outlet_id;
  v_outlet := COALESCE(NULLIF(btrim(v_outlet), ''), 'outlet');

  SELECT
    string_agg(label, ', ' ORDER BY urut) FILTER (WHERE nilai = 'perhatian'),
    string_agg(label, ', ' ORDER BY urut) FILTER (WHERE nilai = 'buruk')
  INTO v_perhatian, v_buruk
  FROM (
    SELECT
      i.nilai,
      CASE i.kategori
        WHEN 'kebersihan' THEN 1 WHEN 'stok' THEN 2 WHEN 'seragam_crew' THEN 3
        WHEN 'rasa' THEN 4 ELSE 5
      END AS urut,
      CASE i.kategori
        WHEN 'kebersihan' THEN 'Kebersihan'
        WHEN 'stok' THEN 'Stok'
        WHEN 'seragam_crew' THEN 'Seragam & Crew'
        WHEN 'peralatan' THEN 'Peralatan'
        WHEN 'rasa' THEN 'Rasa ' || initcap(i.sub_item)
        ELSE i.kategori
      END
      || CASE WHEN COALESCE(btrim(i.keterangan), '') <> ''
           THEN ' (' || btrim(i.keterangan) || ')' ELSE '' END AS label
    FROM public.ceklist_harian_item i
    WHERE i.ceklist_id = p_ceklist_id AND i.nilai <> 'baik'
  ) t;

  v_isi := COALESCE(NULLIF(btrim(v_c.nama_am), ''), 'Area manager')
    || CASE WHEN p_baru THEN ' mengirim' ELSE ' memperbarui' END
    || ' ceklist harian ' || v_outlet || '.';

  IF v_perhatian IS NULL AND v_buruk IS NULL THEN
    v_isi := v_isi || E'\n✅ Semua poin penilaian baik.';
  ELSE
    IF v_buruk IS NOT NULL THEN v_isi := v_isi || E'\n❌ Buruk: ' || v_buruk; END IF;
    IF v_perhatian IS NOT NULL THEN v_isi := v_isi || E'\n⚠️ Perhatian: ' || v_perhatian; END IF;
  END IF;

  IF cardinality(v_c.temuan) > 0 THEN
    v_isi := v_isi || E'\n📝 Temuan: ' || v_c.temuan[1]
      || CASE WHEN cardinality(v_c.temuan) > 1
           THEN ' (+' || (cardinality(v_c.temuan) - 1) || ' lainnya)' ELSE '' END;
  END IF;

  RETURN v_isi || E'\nKetuk untuk meninjau & menyetujui.';
END;
$$;

REVOKE ALL ON FUNCTION public.ceklist_harian_isi_push_rm(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ceklist_harian_isi_push_rm(UUID, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.ceklist_harian_isi_push_rm(UUID, BOOLEAN) FROM authenticated;

-- -----------------------------------------------------------------------------
-- submit_ceklist_harian: isi sama dengan migrasi 20300240000000, ditambah push
-- ke regional manager di akhir.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_ceklist_harian(
  p_outlet_id UUID,
  p_items JSONB,
  p_foto JSONB,
  p_temuan TEXT[],
  p_perbaikan TEXT[],
  p_catatan TEXT,
  p_online_review TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Push ke seluruh regional manager aktif.
  SELECT name INTO v_outlet FROM public.outlets WHERE id = p_outlet_id;
  v_isi_push := public.ceklist_harian_isi_push_rm(v_id, v_baru);
  FOR v_rm IN
    SELECT id FROM public.outlet_staff
    WHERE role = 'regional_manager' AND COALESCE(is_active, true) AND id <> v_user
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
$$;

REVOKE ALL ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- tinjau_ceklist_harian: isi sama dengan migrasi 20300238000000, ditambah push
-- ke area manager pengirim.
--
--   ✅ Ceklist Disetujui · BNR
--   Budi (Regional Manager) menyetujui ceklist harian BNR tanggal 24 Sep 2026.
--   💬 Tanggapan: "Kipas segera diganti minggu ini."
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tinjau_ceklist_harian(
  p_ceklist_id UUID,
  p_tanggapan TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT * INTO v_c FROM public.ceklist_harian WHERE id = p_ceklist_id;
  v_outlet := v_c.outlet_id;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'Ceklist tidak ditemukan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS a(id) WHERE a.id = v_outlet) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;

  v_sudah := v_c.ditinjau_pada IS NOT NULL;

  UPDATE public.ceklist_harian SET
    ditinjau_oleh = v_user,
    nama_peninjau = v_nama,
    ditinjau_pada = NOW(),
    tanggapan_rm = v_tanggapan
  WHERE id = p_ceklist_id;

  -- Push ke area manager yang mengirim laporan.
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
$$;

REVOKE ALL ON FUNCTION public.tinjau_ceklist_harian(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tinjau_ceklist_harian(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.tinjau_ceklist_harian(UUID, TEXT) TO authenticated;

-- Samakan snapshot nama di laporan yang sudah tersimpan.
UPDATE public.ceklist_harian c SET nama_am = s.name
  FROM public.outlet_staff s
  WHERE s.id = c.submitted_by AND COALESCE(btrim(s.name), '') <> '' AND c.nama_am IS DISTINCT FROM s.name;
UPDATE public.ceklist_harian c SET nama_peninjau = s.name
  FROM public.outlet_staff s
  WHERE s.id = c.ditinjau_oleh AND COALESCE(btrim(s.name), '') <> '' AND c.nama_peninjau IS DISTINCT FROM s.name;
