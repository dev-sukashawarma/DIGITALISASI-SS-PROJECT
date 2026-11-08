-- Uji penguncian RLS hermes_bot_registry, penghapusan tabel _temp_*,
-- retensi cron.job_run_details, dan anggaran buffer pemakaian_resep_harian.
-- Jalankan utuh; selesai tanpa EXCEPTION = LULUS. Baca-saja (ROLLBACK di akhir).

BEGIN;

DO $$
DECLARE
  v_rls boolean;
  v_has_col boolean;
  v_cron_active boolean;
  v_cron_sched text;
  v_old_cron_rows bigint;
  v_fn_def text;
  v_outlet uuid;
  v_crew uuid;
  v_tanggal date;
  v_plan json;
  v_total_blks bigint;
BEGIN
  -- 1. Kolom bot_token & RLS pada public.hermes_bot_registry
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_bot_registry'
      AND column_name = 'bot_token'
  ) INTO v_has_col;
  IF NOT v_has_col THEN
    RAISE EXCEPTION 'hermes_bot_registry.bot_token belum terdaftar';
  END IF;

  SELECT c.relrowsecurity
    INTO v_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'hermes_bot_registry';

  IF COALESCE(v_rls, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'hermes_bot_registry: relrowsecurity masih FALSE';
  END IF;

  IF has_table_privilege('anon', 'public.hermes_bot_registry', 'SELECT') THEN
    RAISE EXCEPTION 'hermes_bot_registry: anon masih punya hak SELECT';
  END IF;

  IF has_table_privilege('authenticated', 'public.hermes_bot_registry', 'SELECT') THEN
    RAISE EXCEPTION 'hermes_bot_registry: authenticated masih punya hak SELECT';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.hermes_bot_registry', 'SELECT') THEN
    RAISE EXCEPTION 'hermes_bot_registry: service_role kehilangan hak SELECT';
  END IF;

  -- Kontrol negatif runtime: anon benar-benar ditolak saat SELECT
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM 1 FROM public.hermes_bot_registry LIMIT 1;
    RESET ROLE;
    RAISE EXCEPTION 'kontrol negatif gagal: anon berhasil SELECT hermes_bot_registry';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
  END;

  -- Kontrol negatif runtime: authenticated benar-benar ditolak saat SELECT
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM public.hermes_bot_registry LIMIT 1;
    RESET ROLE;
    RAISE EXCEPTION 'kontrol negatif gagal: authenticated berhasil SELECT hermes_bot_registry';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
  END;

  -- 2. Tabel debug sementara sudah dihapus
  IF to_regclass('public._temp_sql_output') IS NOT NULL THEN
    RAISE EXCEPTION 'tabel sisa debug public._temp_sql_output masih ada';
  END IF;

  IF to_regclass('public._temp_timings') IS NOT NULL THEN
    RAISE EXCEPTION 'tabel sisa debug public._temp_timings masih ada';
  END IF;

  -- 3. Jadwal retensi pg_cron & kebersihan histori > 7 hari
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT j.active, j.schedule
      INTO v_cron_active, v_cron_sched
    FROM cron.job j
    WHERE j.jobname = 'cron-job-run-details-retensi-7-hari';

    IF v_cron_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'job cron-job-run-details-retensi-7-hari belum terdaftar/aktif';
    END IF;

    IF v_cron_sched IS DISTINCT FROM '45 20 * * *' THEN
      RAISE EXCEPTION 'jadwal cron-job-run-details-retensi-7-hari salah: %', v_cron_sched;
    END IF;

    -- Cron berjalan sekali sehari (03:45 WIB) dengan batas 7 hari, sehingga di
    -- antara dua jadwal harian umur baris tertua maksimal ~8 hari.
    SELECT count(*)
      INTO v_old_cron_rows
    FROM cron.job_run_details
    WHERE end_time IS NOT NULL
      AND end_time < now() - interval '8 days 2 hours';

    IF v_old_cron_rows > 0 THEN
      RAISE EXCEPTION 'cron.job_run_details masih memiliki % baris selesai > 8 hari 2 jam', v_old_cron_rows;
    END IF;
  END IF;

  -- 4. Definisi & anggaran buffer pemakaian_resep_harian di bawah role authenticated
  SELECT pg_get_functiondef('public.pemakaian_resep_harian(uuid,date)'::regprocedure)
    INTO v_fn_def;

  IF position('baris_kandidat' IN v_fn_def) = 0 THEN
    RAISE EXCEPTION 'pemakaian_resep_harian belum memakai CTE baris_kandidat';
  END IF;

  IF position('order_milik_hari_ini' IN v_fn_def) > 0 THEN
    RAISE EXCEPTION 'pemakaian_resep_harian masih memuat CTE lama order_milik_hari_ini';
  END IF;

  -- Pilih tanggal aktif terbaru pada outlet tersibuk (MITRA CILEUNGSI atau fallback outlet ramai)
  SELECT l.outlet_id,
         (max(l.created_at) AT TIME ZONE 'Asia/Jakarta')::date
    INTO v_outlet, v_tanggal
  FROM public.ledger_stok l
  JOIN public.outlets o ON o.id = l.outlet_id
  WHERE l.tipe = 'pemakaian'
    AND l.created_at >= now() - interval '7 days'
    AND o.name ILIKE '%cileungsi%'
  GROUP BY l.outlet_id
  LIMIT 1;

  IF v_outlet IS NULL THEN
    SELECT l.outlet_id,
           (max(l.created_at) AT TIME ZONE 'Asia/Jakarta')::date
      INTO v_outlet, v_tanggal
    FROM public.ledger_stok l
    WHERE l.tipe = 'pemakaian'
      AND l.created_at >= now() - interval '7 days'
    GROUP BY l.outlet_id
    ORDER BY count(*) DESC
    LIMIT 1;
  END IF;

  SELECT s.id
    INTO v_crew
  FROM public.outlet_staff s
  WHERE s.role = 'crew'
    AND s.status = 'active'
    AND s.outlet_id = v_outlet
  LIMIT 1;

  IF v_outlet IS NOT NULL AND v_crew IS NOT NULL THEN
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', v_crew, 'role', 'authenticated')::text,
      true
    );
    SET LOCAL ROLE authenticated;

    EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM public.pemakaian_resep_harian($1, $2)'
      INTO v_plan
      USING v_outlet, v_tanggal;

    RESET ROLE;

    v_total_blks := COALESCE((v_plan->0->'Plan'->>'Shared Hit Blocks')::bigint, 0)
                  + COALESCE((v_plan->0->'Plan'->>'Shared Read Blocks')::bigint, 0);

    -- Sebelum optimasi: ~8.000-9.031 blok karena Bitmap Heap Scan 123k baris.
    -- Sesudah optimasi: ~660-1.800 blok (termasuk evaluasi accessible_outlet_ids()).
    IF v_total_blks > 3500 THEN
      RAISE EXCEPTION 'anggaran buffer pemakaian_resep_harian terlampaui: % blok (batas 3500)', v_total_blks;
    END IF;
  END IF;

  RAISE NOTICE 'LULUS — RLS terkunci, _temp_* bersih, cron aktif, pemakaian_resep_harian = % blok', v_total_blks;
END $$;

ROLLBACK;
