-- Pengingat aset outlet untuk HR (2026-09-29).
--
-- Tujuan: HR diberi tahu bila barang inventaris outlet mendekati / melewati
-- umur pakainya, atau dilaporkan rusak / perlu perbaikan oleh Area Manager,
-- lalu HR mencatat tindak lanjutnya.
--
-- Keputusan owner:
--   * pemegang tindak lanjut = HR
--   * tanggal beli diisi Area Manager di app inventori (kolom yang sudah ada:
--     inventaris_submission_items.purchase_date)
--   * pengingat saja, TANPA nilai buku / akuntansi penyusutan
--   * satu baris per jenis barang (bukan register per unit); bila unit lebih
--     dari satu, AM mengisi tanggal beli unit PALING LAMA.
--
-- Isi:
--   1. inventaris_master_items.umur_ekonomis_bulan — umur pakai per jenis
--      barang (NULL = tidak dilacak umurnya). Diatur HR, bukan per input AM.
--   2. inventaris_tindak_lanjut — catatan keputusan HR (insert-only, riwayat
--      utuh). Diikat ke (outlet, jenis barang, pemicu), BUKAN ke id baris item,
--      karena submit_inventaris menghapus & membuat ulang item setiap edit.
--   3. set_umur_ekonomis_inventaris() — satu-satunya jalur ubah umur.
--   4. inventaris_pengingat_aset() — kandidat pengingat untuk layar HR
--      (SECURITY INVOKER, tunduk RLS). Status dihitung di app
--      (apps/HR/src/lib/pengingatAset.ts).
--   5. Push notifikasi harian 08:00 WIB ke role admin_hr lewat superapp
--      (edge function send-push). Diketuk -> membuka halaman web HR.
--      inventaris_pengingat_aktif() menerapkan aturan yang SAMA dengan
--      pengingatAset.ts -- ubah keduanya bersamaan.

-- ---------------------------------------------------------------------------
-- 1. Umur pakai per jenis barang
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventaris_master_items
  ADD COLUMN IF NOT EXISTS umur_ekonomis_bulan INTEGER
    CHECK (umur_ekonomis_bulan IS NULL OR (umur_ekonomis_bulan > 0 AND umur_ekonomis_bulan <= 600));

COMMENT ON COLUMN public.inventaris_master_items.umur_ekonomis_bulan IS
  'Umur pakai operasional (bulan) untuk pengingat HR. NULL = tidak dilacak. Bukan umur pajak.';

-- Nilai awal = perkiraan umur operasional (bukan kelompok pajak PPh Pasal 11).
-- Hanya mengisi yang masih NULL agar aman dijalankan ulang dan tidak menimpa
-- angka yang sudah diubah HR. Barang milik pihak lain (MESIN EDC = bank,
-- SOUND BOX PAWOON = vendor, TABUNG GAS = deposit) sengaja tidak dilacak;
-- barang habis pakai cukup dipantau lewat kondisi.
UPDATE public.inventaris_master_items AS m
SET umur_ekonomis_bulan = v.bulan
FROM (VALUES
  ('FREEZER 400L/600L/750L', 72),
  ('GRILL STOVE (KOMPOR BAKAR)', 48),
  ('SINGLE FRYER', 48),
  ('DOUBLE FRYER', 48),
  ('BLENDER', 24),
  ('MUG ELEKTRIK', 24),
  ('TIMBANGAN DIGITAL', 36),
  ('REGULATOR SET', 24),
  ('EXHAUST FAN', 36),
  ('KIPAS ANGIN', 36),
  ('CCTV INTERIOR', 48),
  ('CCTV EXTERIOR', 48),
  ('HANDPHONE', 36),
  ('TABLET', 36),
  ('PRINTER STRUK', 36),
  ('CASH DRAWER', 60),
  ('NEON BOX', 48),
  ('LAMPU TEMBAK', 36),
  ('LED STRIP', 24),
  ('BANNER BESAR', 12),
  ('BANNER KECIL', 12),
  ('KURSI PLASTIK', 36),
  ('JENGKOK (KURSI JONGKOK)', 36)
) AS v(nama, bulan)
WHERE m.name = v.nama
  AND m.umur_ekonomis_bulan IS NULL;

-- ---------------------------------------------------------------------------
-- Helper: pemegang pengingat aset (HR + atasan). Satu tempat daftar role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_pengelola_pengingat_aset()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid()
      AND s.status = 'active'
      AND s.role IN ('admin_hr', 'owner', 'admin', 'developer')
  );
$$;

REVOKE ALL ON FUNCTION public.is_pengelola_pengingat_aset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pengelola_pengingat_aset() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Catatan tindak lanjut HR (insert-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventaris_tindak_lanjut (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  master_item_id UUID NOT NULL REFERENCES public.inventaris_master_items(id) ON DELETE CASCADE,
  pemicu TEXT NOT NULL CHECK (pemicu IN ('umur', 'kondisi')),
  keputusan TEXT NOT NULL CHECK (keputusan IN ('diganti', 'diperbaiki', 'ditunda')),
  catatan TEXT CHECK (catatan IS NULL OR char_length(catatan) <= 500),
  -- Pengingat disembunyikan sampai tanggal ini SELAMA data acuannya tidak
  -- berubah. Bila AM mengubah tanggal beli / kondisi, catatan ini tidak
  -- berlaku lagi dan barang dinilai ulang dari data baru.
  ingatkan_lagi DATE NOT NULL,
  acuan_tanggal_beli DATE,
  acuan_kondisi TEXT,
  dibuat_oleh UUID NOT NULL DEFAULT auth.uid() REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  dibuat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventaris_tindak_lanjut_terbaru
  ON public.inventaris_tindak_lanjut (outlet_id, master_item_id, pemicu, dibuat_at DESC);

ALTER TABLE public.inventaris_tindak_lanjut ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.inventaris_tindak_lanjut FROM anon, authenticated;
GRANT SELECT, INSERT ON public.inventaris_tindak_lanjut TO authenticated;

DROP POLICY IF EXISTS inventaris_tindak_lanjut_read ON public.inventaris_tindak_lanjut;
CREATE POLICY inventaris_tindak_lanjut_read ON public.inventaris_tindak_lanjut
  FOR SELECT TO authenticated
  USING (
    public.is_pengelola_pengingat_aset()
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  );

DROP POLICY IF EXISTS inventaris_tindak_lanjut_insert ON public.inventaris_tindak_lanjut;
CREATE POLICY inventaris_tindak_lanjut_insert ON public.inventaris_tindak_lanjut
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_pengelola_pengingat_aset()
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
    AND dibuat_oleh = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 3. Ubah umur pakai (HR). Master items tak punya policy UPDATE — sengaja
--    lewat RPC agar HR hanya bisa mengubah kolom ini, bukan nama/target.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_umur_ekonomis_inventaris(
  p_master_item_id UUID,
  p_bulan INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_pengelola_pengingat_aset() THEN
    RAISE EXCEPTION 'Hanya HR / admin / owner yang dapat mengatur umur barang'
      USING ERRCODE = '42501';
  END IF;
  IF p_bulan IS NOT NULL AND (p_bulan <= 0 OR p_bulan > 600) THEN
    RAISE EXCEPTION 'Umur barang harus 1–600 bulan';
  END IF;

  UPDATE public.inventaris_master_items
  SET umur_ekonomis_bulan = p_bulan
  WHERE id = p_master_item_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jenis barang tidak ditemukan';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_umur_ekonomis_inventaris(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_umur_ekonomis_inventaris(UUID, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Kandidat pengingat — satu request untuk seluruh halaman HR.
--    Hanya laporan TERBARU tiap outlet, hanya barang yang dilacak umurnya ATAU
--    dilaporkan rusak/perlu perbaikan, beserta tindak lanjut terakhir per
--    pemicu. SECURITY INVOKER: seluruh baris tetap tunduk RLS pemanggil.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventaris_pengingat_aset()
RETURNS TABLE (
  outlet_id UUID,
  outlet_name TEXT,
  master_item_id UUID,
  item_name TEXT,
  subsection TEXT,
  umur_ekonomis_bulan INTEGER,
  purchase_date DATE,
  kondisi TEXT,
  observed_qty NUMERIC,
  is_present BOOLEAN,
  brand TEXT,
  catatan TEXT,
  dilaporkan_oleh TEXT,
  dilaporkan_at TIMESTAMPTZ,
  tl_umur_keputusan TEXT,
  tl_umur_ingatkan_lagi DATE,
  tl_umur_acuan_tanggal DATE,
  tl_umur_catatan TEXT,
  tl_umur_oleh TEXT,
  tl_umur_at TIMESTAMPTZ,
  tl_kondisi_keputusan TEXT,
  tl_kondisi_ingatkan_lagi DATE,
  tl_kondisi_acuan TEXT,
  tl_kondisi_catatan TEXT,
  tl_kondisi_oleh TEXT,
  tl_kondisi_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH terbaru AS (
    SELECT DISTINCT ON (s.outlet_id) s.id, s.outlet_id, s.submitted_by, s.updated_at
    FROM public.inventaris_submissions s
    ORDER BY s.outlet_id, s.updated_at DESC, s.created_at DESC
  ),
  tl AS (
    SELECT DISTINCT ON (t.outlet_id, t.master_item_id, t.pemicu)
      t.outlet_id, t.master_item_id, t.pemicu, t.keputusan, t.ingatkan_lagi,
      t.acuan_tanggal_beli, t.acuan_kondisi, t.catatan, t.dibuat_at,
      st.name AS oleh
    FROM public.inventaris_tindak_lanjut t
    LEFT JOIN public.outlet_staff st ON st.id = t.dibuat_oleh
    ORDER BY t.outlet_id, t.master_item_id, t.pemicu, t.dibuat_at DESC
  )
  SELECT
    t.outlet_id,
    o.name,
    m.id,
    m.name,
    m.subsection,
    m.umur_ekonomis_bulan,
    i.purchase_date,
    i.kondisi,
    i.observed_qty,
    i.is_present,
    i.brand,
    i.catatan,
    pelapor.name,
    t.updated_at,
    tu.keputusan, tu.ingatkan_lagi, tu.acuan_tanggal_beli, tu.catatan, tu.oleh, tu.dibuat_at,
    tk.keputusan, tk.ingatkan_lagi, tk.acuan_kondisi, tk.catatan, tk.oleh, tk.dibuat_at
  FROM terbaru t
  JOIN public.outlets o ON o.id = t.outlet_id
  JOIN public.inventaris_submission_items i ON i.submission_id = t.id
  JOIN public.inventaris_master_items m ON m.id = i.master_item_id AND m.is_active
  LEFT JOIN public.outlet_staff pelapor ON pelapor.id = t.submitted_by
  LEFT JOIN tl tu ON tu.outlet_id = t.outlet_id AND tu.master_item_id = m.id AND tu.pemicu = 'umur'
  LEFT JOIN tl tk ON tk.outlet_id = t.outlet_id AND tk.master_item_id = m.id AND tk.pemicu = 'kondisi'
  WHERE COALESCE(o.type, 'outlet') NOT IN ('test', 'marketplace')
    AND (m.umur_ekonomis_bulan IS NOT NULL OR i.kondisi IN ('rusak', 'perlu_perbaikan'))
  ORDER BY o.name, m.section, m.sort_order;
$$;

REVOKE ALL ON FUNCTION public.inventaris_pengingat_aset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventaris_pengingat_aset() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Push harian untuk HR (superapp) — 08:00 WIB
-- ---------------------------------------------------------------------------
-- Aturan penilaian: SAMA PERSIS dengan apps/HR/src/lib/pengingatAset.ts
--   * barang tidak ada (kondisi tidak_ada / is_present=false / jumlah 0) dilewati
--   * rusak / perlu_perbaikan  -> alasan kondisi
--   * umur: jatuh tempo = tanggal beli + umur; lewat -> 'lewat_umur';
--     sisa <= min(90, floor(umur*30*0.25)) hari -> 'segera'
--   * tindak lanjut HR menyembunyikan pemicunya selama tanggal < ingatkan_lagi
--     DAN data acuan (tanggal beli / kondisi) belum berubah.
CREATE OR REPLACE FUNCTION public.inventaris_pengingat_aktif(p_today DATE)
RETURNS TABLE (
  outlet_id UUID,
  outlet_name TEXT,
  master_item_id UUID,
  item_name TEXT,
  alasan TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH terbaru AS (
    SELECT DISTINCT ON (s.outlet_id) s.id, s.outlet_id
    FROM public.inventaris_submissions s
    ORDER BY s.outlet_id, s.updated_at DESC, s.created_at DESC
  ),
  tl AS (
    SELECT DISTINCT ON (t.outlet_id, t.master_item_id, t.pemicu)
      t.outlet_id, t.master_item_id, t.pemicu, t.ingatkan_lagi, t.acuan_tanggal_beli, t.acuan_kondisi
    FROM public.inventaris_tindak_lanjut t
    ORDER BY t.outlet_id, t.master_item_id, t.pemicu, t.dibuat_at DESC
  ),
  barang AS (
    SELECT t.outlet_id, o.name AS outlet_name, m.id AS master_item_id, m.name AS item_name,
           m.umur_ekonomis_bulan AS umur, i.purchase_date, i.kondisi
    FROM terbaru t
    JOIN public.outlets o ON o.id = t.outlet_id
    JOIN public.inventaris_submission_items i ON i.submission_id = t.id
    JOIN public.inventaris_master_items m ON m.id = i.master_item_id AND m.is_active
    WHERE COALESCE(o.type, 'outlet') NOT IN ('test', 'marketplace')
      AND i.kondisi <> 'tidak_ada'
      AND i.is_present IS DISTINCT FROM false
      AND (i.observed_qty IS NULL OR i.observed_qty <> 0)
  ),
  kandidat AS (
    SELECT b.*, 'kondisi'::text AS pemicu,
           CASE b.kondisi WHEN 'rusak' THEN 'rusak' ELSE 'perbaikan' END AS alasan
    FROM barang b
    WHERE b.kondisi IN ('rusak', 'perlu_perbaikan')
    UNION ALL
    SELECT b.*, 'umur'::text,
           CASE WHEN (b.purchase_date + make_interval(months => b.umur))::date < p_today
                THEN 'lewat_umur' ELSE 'segera' END
    FROM barang b
    WHERE b.umur IS NOT NULL
      AND b.purchase_date IS NOT NULL
      AND (b.purchase_date + make_interval(months => b.umur))::date - p_today
          <= LEAST(90, floor(b.umur * 30 * 0.25))::int
  )
  SELECT k.outlet_id, k.outlet_name, k.master_item_id, k.item_name, k.alasan
  FROM kandidat k
  LEFT JOIN tl ON tl.outlet_id = k.outlet_id AND tl.master_item_id = k.master_item_id AND tl.pemicu = k.pemicu
  WHERE NOT (
    tl.ingatkan_lagi IS NOT NULL
    AND p_today < tl.ingatkan_lagi
    AND CASE k.pemicu
          WHEN 'umur' THEN tl.acuan_tanggal_beli IS NOT DISTINCT FROM k.purchase_date
          ELSE tl.acuan_kondisi IS NOT DISTINCT FROM k.kondisi
        END
  );
$$;

REVOKE ALL ON FUNCTION public.inventaris_pengingat_aktif(DATE) FROM PUBLIC, anon, authenticated;

-- Jejak push agar isi yang sama tidak diulang setiap hari.
CREATE TABLE IF NOT EXISTS public.inventaris_pengingat_push_log (
  tanggal DATE PRIMARY KEY,
  kunci TEXT[] NOT NULL,
  jumlah INTEGER NOT NULL,
  penerima INTEGER NOT NULL,
  dibuat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.inventaris_pengingat_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventaris_pengingat_push_log FROM anon, authenticated;

-- Susun judul & isi ringkasan (terpisah agar bisa diuji tanpa mengirim push).
--   * p_baru = kunci pengingat yang belum pernah dikirim ('outlet:item:alasan').
CREATE OR REPLACE FUNCTION public.inventaris_isi_push_pengingat(p_today DATE, p_baru TEXT[])
RETURNS TABLE (judul TEXT, isi TEXT, jumlah INTEGER, kunci TEXT[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rincian TEXT;
  v_contoh TEXT;
  v_jumlah_baru INTEGER;
BEGIN
  SELECT count(DISTINCT (p.outlet_id, p.master_item_id))::int,
         array_agg(DISTINCT p.outlet_id::text || ':' || p.master_item_id::text || ':' || p.alasan)
  INTO jumlah, kunci
  FROM public.inventaris_pengingat_aktif(p_today) p;

  IF COALESCE(jumlah, 0) = 0 THEN
    RETURN;
  END IF;

  SELECT string_agg(teks, ', ' ORDER BY urut) INTO v_rincian
  FROM (
    SELECT CASE p.alasan WHEN 'rusak' THEN 1 WHEN 'lewat_umur' THEN 2 WHEN 'perbaikan' THEN 3 ELSE 4 END AS urut,
           count(*) || ' ' || CASE p.alasan
             WHEN 'rusak' THEN 'rusak'
             WHEN 'lewat_umur' THEN 'lewat umur pakai'
             WHEN 'perbaikan' THEN 'perlu perbaikan'
             ELSE 'segera habis umur'
           END AS teks
    FROM public.inventaris_pengingat_aktif(p_today) p
    GROUP BY p.alasan
  ) x;

  judul := '🛠️ ' || jumlah || ' aset outlet perlu tindak lanjut';
  isi := v_rincian || '.';

  IF COALESCE(cardinality(p_baru), 0) > 0 THEN
    SELECT count(DISTINCT (p.outlet_id, p.master_item_id))::int,
           min(p.item_name || ' (' || p.outlet_name || ')')
    INTO v_jumlah_baru, v_contoh
    FROM public.inventaris_pengingat_aktif(p_today) p
    WHERE (p.outlet_id::text || ':' || p.master_item_id::text || ':' || p.alasan) = ANY (p_baru);
    IF v_jumlah_baru > 0 THEN
      isi := isi || E'\nBaru: ' || v_contoh
        || CASE WHEN v_jumlah_baru > 1 THEN ' (+' || (v_jumlah_baru - 1) || ' lainnya)' ELSE '' END;
    END IF;
  ELSE
    isi := isi || E'\nPengingat mingguan: masih menunggu tindak lanjut.';
  END IF;
  isi := isi || E'\nKetuk untuk membuka di web HR.';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.inventaris_isi_push_pengingat(DATE, TEXT[]) FROM PUBLIC, anon, authenticated;

-- Kirim satu ringkasan ke setiap admin_hr aktif.
--   * Dikirim bila ada pengingat BARU sejak push terakhir, atau setiap Senin
--     sebagai pengingat mingguan untuk yang masih tertunda. Tanpa aturan ini
--     HR menerima isi yang sama setiap pagi dan berhenti membacanya.
--   * Sekali per hari (PK tanggal) — aman bila cron terpicu dua kali.
--   * `url` absolut ke web HR. App superapp membuka browser untuk URL https
--     *.sukashawarma.com; versi lama cukup membuka beranda app.
CREATE OR REPLACE FUNCTION public.inventaris_kirim_pengingat_hr()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_url_web CONSTANT TEXT := 'https://hr.sukashawarma.com/inventaris/pengingat';
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_semua TEXT[];
  v_lalu TEXT[];
  v_baru TEXT[];
  v_pesan RECORD;
  v_url TEXT;
  v_key TEXT;
  v_penerima INTEGER := 0;
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventaris_pengingat_push_log WHERE tanggal = v_today) THEN
    RETURN 'sudah dikirim hari ini';
  END IF;

  SELECT array_agg(DISTINCT p.outlet_id::text || ':' || p.master_item_id::text || ':' || p.alasan)
  INTO v_semua
  FROM public.inventaris_pengingat_aktif(v_today) p;

  IF COALESCE(cardinality(v_semua), 0) = 0 THEN
    RETURN 'tidak ada pengingat';
  END IF;

  SELECT l.kunci INTO v_lalu
  FROM public.inventaris_pengingat_push_log l
  ORDER BY l.tanggal DESC LIMIT 1;

  SELECT array_agg(k) INTO v_baru
  FROM unnest(v_semua) AS k
  WHERE NOT (k = ANY (COALESCE(v_lalu, '{}'::text[])));

  IF COALESCE(cardinality(v_baru), 0) = 0 AND extract(isodow FROM v_today) <> 1 THEN
    RETURN 'tidak ada yang baru';
  END IF;

  SELECT * INTO v_pesan FROM public.inventaris_isi_push_pengingat(v_today, v_baru);

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Push pengingat aset dilewati: secret push belum ada di vault.';
    RETURN 'secret push belum ada';
  END IF;

  FOR r IN
    SELECT s.id FROM public.outlet_staff s
    WHERE s.role = 'admin_hr' AND s.status = 'active'
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', r.id,
          'app', 'hr',
          'title', v_pesan.judul,
          'body', v_pesan.isi,
          'url', c_url_web
        )
      );
      v_penerima := v_penerima + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim push pengingat aset: %', SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.inventaris_pengingat_push_log (tanggal, kunci, jumlah, penerima)
  VALUES (v_today, v_semua, v_pesan.jumlah, v_penerima);

  RETURN 'terkirim ke ' || v_penerima || ' HR';
END;
$$;

REVOKE ALL ON FUNCTION public.inventaris_kirim_pengingat_hr() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('inventaris-pengingat-aset-hr');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- pg_cron memakai UTC: 01:00 UTC = 08:00 WIB
SELECT cron.schedule(
  'inventaris-pengingat-aset-hr',
  '0 1 * * *',
  $cron$SELECT public.inventaris_kirim_pengingat_hr();$cron$
);
