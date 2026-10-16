-- Pengingat opname stok yang belum pernah dilakukan atau tertinggal lebih dari
-- 7 hari. Ambang 7 hari mengikuti status overdue di apps/stok compliance board.
-- Pengingat dikirim setiap hari untuk outlet yang baru overdue; pengingat ulang
-- untuk kasus yang sama dikirim mingguan. Outlet tanpa opname sebelumnya ikut
-- dianggap overdue.

CREATE TABLE IF NOT EXISTS public.opname_pengingat_push_log (
  tanggal DATE PRIMARY KEY,
  kunci TEXT[] NOT NULL,
  jumlah_outlet INTEGER NOT NULL,
  jumlah_penerima INTEGER NOT NULL,
  dibuat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.opname_pengingat_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opname_pengingat_push_log FROM PUBLIC, anon, authenticated;

-- Compliance menghitung opname yang benar-benar dikirim untuk persetujuan atau
-- sudah final. Draft yang belum selesai tidak mengatur ulang umur kepatuhan.
CREATE OR REPLACE VIEW public.opname_compliance_view AS
SELECT
  o.id AS outlet_id,
  o.name AS outlet_name,
  MAX(op.created_at) FILTER (
    WHERE op.status = 'finalized'
      AND op.tipe <> 'ad_hoc'
  ) AS last_opname_date
FROM public.outlets o
LEFT JOIN public.opname op ON op.outlet_id = o.id
WHERE o.id IN (SELECT public.accessible_outlet_ids())
GROUP BY o.id, o.name
ORDER BY o.name;

ALTER VIEW public.opname_compliance_view OWNER TO postgres;
GRANT SELECT ON public.opname_compliance_view TO authenticated;

CREATE OR REPLACE FUNCTION public.opname_pengingat_kandidat(p_today DATE DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date)
RETURNS TABLE (
  outlet_id UUID,
  outlet_name TEXT,
  tanggal_opname_terakhir DATE,
  hari_sejak_opname INTEGER,
  ada_draft_hari_ini BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH terakhir AS (
    SELECT op.outlet_id, MAX(op.tanggal) AS tanggal_terakhir
    FROM public.opname op
    WHERE op.status = 'finalized'
      AND op.tipe <> 'ad_hoc'
    GROUP BY op.outlet_id
  ),
  draft_hari_ini AS (
    SELECT DISTINCT op.outlet_id
    FROM public.opname op
    WHERE op.status = 'draft'
      AND op.tipe = 'harian'
      AND op.tanggal = p_today
  )
  SELECT o.id,
         o.name,
         t.tanggal_terakhir,
         CASE WHEN t.tanggal_terakhir IS NULL THEN NULL
              ELSE p_today - t.tanggal_terakhir END,
         (d.outlet_id IS NOT NULL)
  FROM public.outlets o
  LEFT JOIN terakhir t ON t.outlet_id = o.id
  LEFT JOIN draft_hari_ini d ON d.outlet_id = o.id
  WHERE COALESCE(o.type, 'outlet') NOT IN ('test', 'marketplace')
    AND o.is_active IS TRUE
    AND (t.tanggal_terakhir IS NULL OR p_today - t.tanggal_terakhir > 7);
$$;

REVOKE ALL ON FUNCTION public.opname_pengingat_kandidat(DATE) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.opname_kirim_pengingat_belum_dilakukan()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_all TEXT[];
  v_previous TEXT[];
  v_new TEXT[];
  v_sample TEXT;
  v_url TEXT;
  v_key TEXT;
  v_count INTEGER := 0;
  v_recipients INTEGER := 0;
  r RECORD;
  outlet RECORD;
BEGIN
  -- Cegah dua eksekusi cron bersamaan mengirim alert duplikat.
  PERFORM pg_advisory_xact_lock(hashtext('opname-pengingat-belum-dilakukan'));

  IF EXISTS (SELECT 1 FROM public.opname_pengingat_push_log WHERE tanggal = v_today) THEN
    RETURN 'sudah dikirim hari ini';
  END IF;

  SELECT array_agg(kunci ORDER BY kunci), count(*)::int
  INTO v_all, v_count
  FROM (
    SELECT p.outlet_id::text || ':' || COALESCE(p.tanggal_opname_terakhir::text, 'belum-pernah') AS kunci
    FROM public.opname_pengingat_kandidat(v_today) p
  ) kandidat;

  IF COALESCE(v_count, 0) = 0 THEN
    RETURN 'tidak ada outlet overdue';
  END IF;

  SELECT l.kunci INTO v_previous
  FROM public.opname_pengingat_push_log l
  ORDER BY l.tanggal DESC LIMIT 1;

  SELECT array_agg(k) INTO v_new
  FROM unnest(COALESCE(v_all, '{}'::text[])) AS k
  WHERE NOT (k = ANY(COALESCE(v_previous, '{}'::text[])));

  -- Kirim alert baru segera. Pengingat ulang bagi kasus yang masih sama hanya
  -- dikirim setiap Senin agar PIC tidak menerima push yang sama setiap pagi.
  IF COALESCE(cardinality(v_new), 0) = 0 AND extract(isodow FROM v_today) <> 1 THEN
    RETURN 'tidak ada kasus baru';
  END IF;

  SELECT string_agg(x.outlet_name, ', ' ORDER BY x.outlet_name)
  INTO v_sample
  FROM (
    SELECT p.outlet_name
    FROM public.opname_pengingat_kandidat(v_today) p
    ORDER BY p.outlet_name
    LIMIT 5
  ) x;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Pengingat opname dilewati: secret push_webhook_url/fcm_webhook_secret belum tersedia.';
    RETURN 'secret push belum tersedia';
  END IF;

  -- Alert per outlet hanya kepada staf aktif yang terhubung ke outlet itu dan
  -- manager area yang outlet-nya tercantum pada staff_outlets.
  FOR outlet IN
    SELECT p.*,
           (p.outlet_id::text || ':' || COALESCE(p.tanggal_opname_terakhir::text, 'belum-pernah')) AS kunci
    FROM public.opname_pengingat_kandidat(v_today) p
    WHERE (p.outlet_id::text || ':' || COALESCE(p.tanggal_opname_terakhir::text, 'belum-pernah')) = ANY(COALESCE(v_new, '{}'::text[]))
  LOOP
    FOR r IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      WHERE s.status = 'active'
        AND (
          (s.outlet_id = outlet.outlet_id AND s.role IN ('crew', 'kiosk', 'leader'))
          OR (s.role IN ('leader', 'korlap', 'area_manager') AND EXISTS (
            SELECT 1 FROM public.staff_outlets so
            WHERE so.staff_id = s.id AND so.outlet_id = outlet.outlet_id
          ))
        )
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          body := jsonb_build_object(
            'user_id', r.id,
            'app', 'stok',
            'title', '📋 Opname belum selesai · ' || outlet.outlet_name,
            'body', CASE
              WHEN outlet.ada_draft_hari_ini THEN 'Opname hari ini sudah dimulai, tetapi belum difinalisasi. Mohon selesaikan opname.'
              WHEN outlet.tanggal_opname_terakhir IS NULL THEN 'Belum ada opname yang difinalisasi di outlet ini. Mohon lakukan opname.'
              ELSE 'Opname terakhir ' || outlet.hari_sejak_opname || ' hari lalu. Mohon lakukan opname.'
            END,
            'url', 'https://stok.sukashawarma.com/stok/opname'
          )
        );
        PERFORM public.bot_telegram_kirim_alert(
          r.id,
          'stok',
          '📋 Opname belum selesai · ' || outlet.outlet_name,
          CASE
            WHEN outlet.ada_draft_hari_ini THEN 'Opname hari ini sudah dimulai, tetapi belum difinalisasi. Mohon selesaikan opname.'
            WHEN outlet.tanggal_opname_terakhir IS NULL THEN 'Belum ada opname yang difinalisasi di outlet ini. Mohon lakukan opname.'
            ELSE 'Opname terakhir ' || outlet.hari_sejak_opname || ' hari lalu. Mohon lakukan opname.'
          END,
          'https://stok.sukashawarma.com/stok/opname',
          outlet.outlet_id
        );
        v_recipients := v_recipients + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Gagal mengirim pengingat opname outlet % kepada staf %: %', outlet.outlet_id, r.id, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  -- Ringkasan mingguan untuk owner dan pengelola stok pusat.
  IF extract(isodow FROM v_today) = 1 THEN
    FOR r IN
      SELECT s.id
      FROM public.outlet_staff s
      WHERE s.status = 'active'
        AND s.role IN ('owner', 'spv', 'regional_manager', 'kitchen', 'purchasing')
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          body := jsonb_build_object(
            'user_id', r.id,
            'app', 'stok',
            'title', '📋 Ringkasan kepatuhan opname',
            'body', v_count || ' outlet belum menyelesaikan opname dalam 7 hari terakhir: ' || v_sample
              || CASE WHEN v_count > 5 THEN ' (dan ' || (v_count - 5) || ' outlet lainnya).' ELSE '.' END,
            'url', 'https://stok.sukashawarma.com/stok/opname'
          )
        );
        PERFORM public.bot_telegram_kirim_alert(
          r.id,
          'stok',
          '📋 Ringkasan kepatuhan opname',
          v_count || ' outlet belum menyelesaikan opname dalam 7 hari terakhir: ' || v_sample
            || CASE WHEN v_count > 5 THEN ' (dan ' || (v_count - 5) || ' outlet lainnya).' ELSE '.' END,
          'https://stok.sukashawarma.com/stok/opname'
        );
        v_recipients := v_recipients + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Gagal mengirim ringkasan opname kepada staf %: %', r.id, SQLERRM;
      END;
    END LOOP;
  END IF;

  INSERT INTO public.opname_pengingat_push_log (tanggal, kunci, jumlah_outlet, jumlah_penerima)
  VALUES (v_today, COALESCE(v_all, '{}'::text[]), v_count, v_recipients);

  RETURN 'pengingat diproses untuk ' || v_count || ' outlet; permintaan push ke ' || v_recipients || ' penerima';
END;
$$;

REVOKE ALL ON FUNCTION public.opname_kirim_pengingat_belum_dilakukan() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('opname-pengingat-belum-dilakukan');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- pg_cron memakai UTC: 01:00 UTC = 08:00 WIB.
SELECT cron.schedule(
  'opname-pengingat-belum-dilakukan',
  '0 1 * * *',
  $cron$SELECT public.opname_kirim_pengingat_belum_dilakukan();$cron$
);
