-- Push notifikasi ke HR (role admin_hr) saat Area Manager mengisi / mengedit
-- laporan inventaris outlet dan ceklist harian (2026-09-29).
--
-- Jalur push sama dengan push lain: edge function `send-push` dipanggil lewat
-- pg_net (URL & secret dari Vault), payload `url` = URL ABSOLUT web HR. App
-- superapp membuka browser untuk https *.sukashawarma.com.
--
-- Kenapa trigger STATEMENT-level pada tabel ITEM, bukan pada header:
--   * submit_inventaris & submit_ceklist_harian menulis header dulu, lalu
--     (saat edit) menghapus dan memasukkan ulang seluruh item dalam SATU
--     statement INSERT ... SELECT. Trigger AFTER INSERT FOR EACH STATEMENT di
--     tabel item terpicu tepat SEKALI per kiriman, setelah seluruh item ada —
--     jadi isi push bisa merangkum barang rusak / poin buruk.
--   * Kedua RPC itu didefinisikan migration bertimestamp 2030; menulis ulang
--     fungsinya di sini akan ditimpa balik saat replay. Trigger tambahan tidak.
--   * pg_net baru mengirim setelah transaksi commit — kiriman yang gagal tidak
--     memancarkan push. Kegagalan push hanya WARNING, tidak pernah
--     menggagalkan simpan laporan.
--
-- Baru vs edit: header baru ditulis dalam transaksi yang sama sehingga
-- created_at = updated_at (NOW() transaksi); edit menyetel updated_at = NOW()
-- pada transaksi berikutnya sehingga updated_at > created_at.
--
-- HR juga diberi akses BACA ceklist harian (header, item, foto — item & foto
-- mengikuti policy header) agar notifikasinya bisa dibuka di web HR. Hanya
-- policy tambahan; policy & fungsi lama tidak diubah.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Helper role HR
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_hr()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.role = 'admin_hr' AND s.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_hr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_hr() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Akses baca ceklist harian untuk HR
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ceklist_harian_read_hr ON public.ceklist_harian;
CREATE POLICY ceklist_harian_read_hr ON public.ceklist_harian
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_hr())
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  );

DROP POLICY IF EXISTS ceklist_harian_photo_read_hr ON storage.objects;
CREATE POLICY ceklist_harian_photo_read_hr ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ceklist-harian-foto' AND (SELECT public.is_admin_hr()));

-- ---------------------------------------------------------------------------
-- 3. Kirim satu push ke setiap admin_hr aktif
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hr_kirim_push(p_title TEXT, p_body TEXT, p_url TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_jumlah INTEGER := 0;
  r RECORD;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Push HR dilewati: secret push_webhook_url/fcm_webhook_secret belum ada di vault.';
    RETURN 0;
  END IF;

  FOR r IN
    SELECT s.id FROM public.outlet_staff s
    WHERE s.role = 'admin_hr' AND s.status = 'active'
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := jsonb_build_object('user_id', r.id, 'app', 'hr', 'title', p_title, 'body', p_body, 'url', p_url)
    );
    v_jumlah := v_jumlah + 1;
  END LOOP;
  RETURN v_jumlah;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengirim push HR: %', SQLERRM;
  RETURN v_jumlah;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_kirim_push(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Isi push laporan inventaris (terpisah agar bisa diuji tanpa mengirim)
--
--   📦 Inventaris Diperbarui · EMPANG
--   Abu Bakar memperbarui laporan inventaris EMPANG (87 item).
--   ❌ Rusak: EXHAUST FAN, BLENDER
--   🔧 Perlu perbaikan: KIPAS ANGIN (+2 lainnya)
--   Ketuk untuk membuka di web HR.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventaris_isi_push_hr(p_submission_id UUID)
RETURNS TABLE (judul TEXT, isi TEXT, url TEXT, kirim BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s RECORD;
  v_outlet TEXT;
  v_tipe TEXT;
  v_am TEXT;
  v_baru BOOLEAN;
  v_total INTEGER;
  v_rusak TEXT[];
  v_perbaikan TEXT[];
  v_tidak_ada INTEGER;
  daftar CONSTANT INTEGER := 3;
BEGIN
  SELECT * INTO v_s FROM public.inventaris_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    kirim := false; RETURN NEXT; RETURN;
  END IF;
  SELECT o.name, o.type INTO v_outlet, v_tipe FROM public.outlets o WHERE o.id = v_s.outlet_id;
  v_outlet := COALESCE(NULLIF(btrim(v_outlet), ''), 'outlet');
  SELECT st.name INTO v_am FROM public.outlet_staff st WHERE st.id = v_s.submitted_by;
  v_baru := v_s.created_at = v_s.updated_at;

  SELECT count(*)::int,
         array_agg(m.name ORDER BY m.section, m.sort_order) FILTER (WHERE i.kondisi = 'rusak'),
         array_agg(m.name ORDER BY m.section, m.sort_order) FILTER (WHERE i.kondisi = 'perlu_perbaikan'),
         (count(*) FILTER (WHERE i.kondisi = 'tidak_ada'))::int
  INTO v_total, v_rusak, v_perbaikan, v_tidak_ada
  FROM public.inventaris_submission_items i
  JOIN public.inventaris_master_items m ON m.id = i.master_item_id
  WHERE i.submission_id = p_submission_id;

  -- Outlet uji & marketplace tidak dilaporkan ke HR.
  kirim := COALESCE(v_tipe, 'outlet') NOT IN ('test', 'marketplace');
  judul := CASE WHEN v_baru THEN '📦 Inventaris Masuk' ELSE '📦 Inventaris Diperbarui' END || ' · ' || v_outlet;
  isi := COALESCE(NULLIF(btrim(v_am), ''), 'Area manager')
    || CASE WHEN v_baru THEN ' mengirim' ELSE ' memperbarui' END
    || ' laporan inventaris ' || v_outlet || ' (' || COALESCE(v_total, 0) || ' item).';
  IF COALESCE(cardinality(v_rusak), 0) = 0 AND COALESCE(cardinality(v_perbaikan), 0) = 0 THEN
    isi := isi || E'\n✅ Tidak ada barang rusak.';
  END IF;
  IF COALESCE(cardinality(v_rusak), 0) > 0 THEN
    isi := isi || E'\n❌ Rusak: ' || array_to_string(v_rusak[1:daftar], ', ')
      || CASE WHEN cardinality(v_rusak) > daftar THEN ' (+' || (cardinality(v_rusak) - daftar) || ' lainnya)' ELSE '' END;
  END IF;
  IF COALESCE(cardinality(v_perbaikan), 0) > 0 THEN
    isi := isi || E'\n🔧 Perlu perbaikan: ' || array_to_string(v_perbaikan[1:daftar], ', ')
      || CASE WHEN cardinality(v_perbaikan) > daftar THEN ' (+' || (cardinality(v_perbaikan) - daftar) || ' lainnya)' ELSE '' END;
  END IF;
  IF COALESCE(v_tidak_ada, 0) > 0 THEN
    isi := isi || E'\n📭 Tidak ada di outlet: ' || v_tidak_ada || ' barang';
  END IF;
  isi := isi || E'\nKetuk untuk membuka di web HR.';
  url := 'https://hr.sukashawarma.com/inventaris/' || v_s.outlet_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.inventaris_isi_push_hr(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_inventaris_push_hr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  p RECORD;
BEGIN
  FOR v_id IN SELECT DISTINCT submission_id FROM baru LOOP
    BEGIN
      SELECT * INTO p FROM public.inventaris_isi_push_hr(v_id);
      IF p.kirim THEN
        PERFORM public.hr_kirim_push(p.judul, p.isi, p.url);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Push inventaris ke HR gagal: %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_inventaris_push_hr() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_inventaris_push_hr ON public.inventaris_submission_items;
CREATE TRIGGER trg_inventaris_push_hr
  AFTER INSERT ON public.inventaris_submission_items
  REFERENCING NEW TABLE AS baru
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_inventaris_push_hr();

-- ---------------------------------------------------------------------------
-- 5. Isi push ceklist harian — memakai perangkum RM yang sudah ada
--    (ceklist_harian_isi_push_rm), hanya kalimat penutupnya diganti karena HR
--    tidak menyetujui ceklist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ceklist_harian_isi_push_hr(p_ceklist_id UUID)
RETURNS TABLE (judul TEXT, isi TEXT, url TEXT, kirim BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c RECORD;
  v_outlet TEXT;
  v_tipe TEXT;
  v_baru BOOLEAN;
BEGIN
  SELECT * INTO v_c FROM public.ceklist_harian WHERE id = p_ceklist_id;
  IF NOT FOUND THEN
    kirim := false; RETURN NEXT; RETURN;
  END IF;
  SELECT o.name, o.type INTO v_outlet, v_tipe FROM public.outlets o WHERE o.id = v_c.outlet_id;
  v_baru := v_c.created_at = v_c.updated_at;

  kirim := COALESCE(v_tipe, 'outlet') NOT IN ('test', 'marketplace');
  judul := CASE WHEN v_baru THEN '📋 Ceklist Harian Masuk' ELSE '📋 Ceklist Harian Diperbarui' END
    || ' · ' || COALESCE(NULLIF(btrim(v_outlet), ''), 'Outlet');
  isi := regexp_replace(public.ceklist_harian_isi_push_rm(p_ceklist_id, v_baru), E'\\n[^\\n]*menyetujui\\.$', '')
    || E'\nKetuk untuk membuka di web HR.';
  url := 'https://hr.sukashawarma.com/ceklist-harian?tanggal=' || v_c.tanggal || '&outlet=' || v_c.outlet_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ceklist_harian_isi_push_hr(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_ceklist_harian_push_hr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  p RECORD;
BEGIN
  FOR v_id IN SELECT DISTINCT ceklist_id FROM baru LOOP
    BEGIN
      SELECT * INTO p FROM public.ceklist_harian_isi_push_hr(v_id);
      IF p.kirim THEN
        PERFORM public.hr_kirim_push(p.judul, p.isi, p.url);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Push ceklist harian ke HR gagal: %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_ceklist_harian_push_hr() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ceklist_harian_push_hr ON public.ceklist_harian_item;
CREATE TRIGGER trg_ceklist_harian_push_hr
  AFTER INSERT ON public.ceklist_harian_item
  REFERENCING NEW TABLE AS baru
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_ceklist_harian_push_hr();
