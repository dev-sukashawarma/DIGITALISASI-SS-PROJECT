-- Kitchen-only daily opname reports. Calendar dates and display times use WIB.
-- Counts are per active operational outlet, not per opname row.
CREATE TABLE IF NOT EXISTS public.bot_telegram_opname_kitchen_send_log (
  tanggal DATE NOT NULL,
  fase TEXT NOT NULL CHECK (fase IN ('pengingat', 'ringkasan')),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  jumlah_outlet INTEGER NOT NULL CHECK (jumlah_outlet > 0),
  jumlah_selesai INTEGER NOT NULL CHECK (jumlah_selesai >= 0),
  jumlah_belum INTEGER NOT NULL CHECK (jumlah_belum >= 0),
  jumlah_halaman INTEGER NOT NULL CHECK (jumlah_halaman > 0),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tanggal, fase, staff_id),
  CHECK (jumlah_selesai + jumlah_belum = jumlah_outlet)
);
ALTER TABLE public.bot_telegram_opname_kitchen_send_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_opname_kitchen_send_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bot_telegram_opname_kitchen_send_log TO service_role;

CREATE OR REPLACE FUNCTION public.bot_telegram_opname_harian_kitchen_data(p_tanggal DATE)
RETURNS TABLE (
  outlet_id UUID, outlet_name TEXT, status_opname TEXT,
  pic_name TEXT, tercatat_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, COALESCE(op.status, 'belum_mulai'),
         COALESCE(NULLIF(author.name, ''), pic.names, 'PIC belum tercatat'),
         CASE WHEN op.status = 'finalized'
           THEN COALESCE(op.approved_at, op.updated_at, op.created_at)
           ELSE COALESCE(op.updated_at, op.created_at) END
  FROM public.outlets o
  LEFT JOIN LATERAL (
    SELECT p.status, p.created_by, p.created_at, p.updated_at, p.approved_at
    FROM public.opname p
    WHERE p.outlet_id = o.id AND p.tanggal = p_tanggal AND p.tipe = 'harian'
    -- Any finalized daily opname wins over later drafts/rejected attempts.
    ORDER BY (p.status = 'finalized') DESC,
             COALESCE(p.updated_at, p.created_at) DESC NULLS LAST, p.id DESC
    LIMIT 1
  ) op ON TRUE
  LEFT JOIN public.outlet_staff author ON author.id = op.created_by
  LEFT JOIN LATERAL (
    SELECT string_agg(x.name, ', ' ORDER BY x.priority, x.name) AS names
    FROM (
      SELECT s.name, CASE WHEN s.role = 'leader' THEN 0 ELSE 1 END AS priority
      FROM public.outlet_staff s
      WHERE s.status = 'active' AND s.role IN ('crew', 'leader', 'kiosk')
        AND (s.outlet_id = o.id OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = o.id
        ))
      ORDER BY priority, s.name LIMIT 2
    ) x
  ) pic ON TRUE
  WHERE o.is_active IS TRUE AND o.deleted_at IS NULL
    AND o.type IN ('internal', 'mitra');
$$;
REVOKE ALL ON FUNCTION public.bot_telegram_opname_harian_kitchen_data(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_opname_harian_kitchen_data(DATE) TO service_role;

CREATE OR REPLACE FUNCTION public.bot_telegram_opname_harian_kitchen(
  p_fase TEXT, p_sekarang TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_time TIME;
  v_total INTEGER;
  v_done INTEGER;
  v_pending INTEGER;
  v_snapshot JSONB;
  v_pages TEXT[] := '{}'::text[];
  v_page TEXT := '';
  v_line TEXT;
  v_header TEXT;
  v_title TEXT;
  v_body TEXT;
  v_claimed BOOLEAN;
  v_page_count INTEGER;
  v_recipients INTEGER := 0;
  v_index INTEGER;
  row_data RECORD;
  recipient RECORD;
BEGIN
  IF p_fase IS NULL OR p_fase NOT IN ('pengingat', 'ringkasan')
    OR p_sekarang IS NULL OR NOT isfinite(p_sekarang) THEN RETURN 0; END IF;
  v_date := (p_sekarang AT TIME ZONE 'Asia/Jakarta')::date;
  v_time := (p_sekarang AT TIME ZONE 'Asia/Jakarta')::time;
  IF (p_fase = 'pengingat' AND (v_time < TIME '21:00' OR v_time >= TIME '22:30'))
    OR (p_fase = 'ringkasan' AND v_time < TIME '22:30') THEN RETURN 0; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('kitchen-opname:' || v_date || ':' || p_fase)) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    JOIN public.bot_telegram_access a ON a.staff_id = s.id
    JOIN public.bot_telegram_links l ON l.staff_id = s.id
    WHERE s.role = 'kitchen' AND s.status = 'active' AND l.chat_id IS NOT NULL
  ) THEN RETURN 0; END IF;
  -- The existing sender returns void when its Vault configuration is absent.
  -- Do not consume today's deduplication key for a request it cannot enqueue.
  IF (SELECT count(DISTINCT name) FROM vault.decrypted_secrets
      WHERE name IN ('telegram_stokist_send_url', 'telegram_stokist_send_secret')
        AND COALESCE(decrypted_secret, '') <> '') <> 2 THEN
    RAISE WARNING 'Ringkasan opname kitchen dilewati: konfigurasi Telegram belum lengkap.';
    RETURN 0;
  END IF;

  -- Materialize once so totals and individual outlet lines share one snapshot.
  SELECT count(*), count(*) FILTER (WHERE d.status_opname = 'finalized'),
         COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.outlet_name, d.outlet_id), '[]'::jsonb)
  INTO v_total, v_done, v_snapshot
  FROM public.bot_telegram_opname_harian_kitchen_data(v_date) d;
  v_pending := v_total - v_done;
  IF v_total = 0 OR (p_fase = 'pengingat' AND v_pending = 0) THEN RETURN 0; END IF;

  v_header := 'Tanggal: ' || to_char(v_date, 'DD-MM-YYYY') || ' · sampai '
    || to_char(p_sekarang AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || E' WIB\n'
    || 'Selesai: ' || v_done || '/' || v_total || E' outlet\n'
    || 'Belum final: ' || v_pending || E' outlet\n\n';
  v_title := CASE WHEN p_fase = 'pengingat' THEN '⏰ Opname belum selesai hari ini'
    ELSE '📋 Rangkuman opname harian' END;

  FOR row_data IN
    SELECT d.* FROM jsonb_to_recordset(v_snapshot) AS d(
      outlet_id UUID, outlet_name TEXT, status_opname TEXT,
      pic_name TEXT, tercatat_at TIMESTAMPTZ
    )
    WHERE p_fase = 'ringkasan' OR d.status_opname <> 'finalized'
    ORDER BY (d.status_opname = 'finalized') DESC, d.outlet_name, d.outlet_id
  LOOP
    v_line := CASE row_data.status_opname
      WHEN 'finalized' THEN '✅ '
      WHEN 'draft' THEN '🟡 '
      WHEN 'pending_approval' THEN '🟡 '
      ELSE '🔴 ' END
      || left(row_data.outlet_name, 60) || ' — '
      || CASE row_data.status_opname
        WHEN 'finalized' THEN 'selesai'
        WHEN 'draft' THEN 'sudah mulai, belum final'
        WHEN 'pending_approval' THEN 'menunggu persetujuan'
        WHEN 'rejected' THEN 'perlu perbaikan'
        ELSE 'belum mulai' END
      || ' · ' || left(row_data.pic_name, 40)
      || CASE WHEN row_data.status_opname = 'finalized' AND row_data.tercatat_at IS NOT NULL
        THEN ' · ' || to_char(row_data.tercatat_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ELSE '' END;
    -- Bound each body below the sender's 1200-character payload limit.
    -- Retain every outlet by continuing the report in numbered messages.
    IF length(v_page) + length(v_line) + 1 > 850 AND v_page <> '' THEN
      v_pages := array_append(v_pages, v_page);
      v_page := '';
    END IF;
    v_page := v_page || CASE WHEN v_page = '' THEN '' ELSE E'\n' END || v_line;
  END LOOP;
  IF v_page <> '' THEN v_pages := array_append(v_pages, v_page); END IF;
  v_page_count := cardinality(v_pages);

  FOR recipient IN
    SELECT s.id FROM public.outlet_staff s
    JOIN public.bot_telegram_access a ON a.staff_id = s.id
    JOIN public.bot_telegram_links l ON l.staff_id = s.id
    WHERE s.role = 'kitchen' AND s.status = 'active' AND l.chat_id IS NOT NULL
  LOOP
    BEGIN
      INSERT INTO public.bot_telegram_opname_kitchen_send_log (
        tanggal, fase, staff_id, jumlah_outlet, jumlah_selesai, jumlah_belum, jumlah_halaman
      ) VALUES (v_date, p_fase, recipient.id, v_total, v_done, v_pending, v_page_count)
      ON CONFLICT (tanggal, fase, staff_id) DO NOTHING
      RETURNING TRUE INTO v_claimed;
      IF NOT FOUND OR NOT COALESCE(v_claimed, FALSE) THEN CONTINUE; END IF;
      FOR v_index IN 1..v_page_count LOOP
        v_body := v_header || v_pages[v_index]
          || E'\n\nStatus diambil saat ringkasan dibuat. Lihat progres terbaru di aplikasi.'
          || CASE WHEN v_page_count > 1
            THEN E'\nBagian ' || v_index || '/' || v_page_count ELSE '' END;
        PERFORM public.bot_telegram_kirim_alert(
          recipient.id, 'stok', v_title, v_body,
          'https://stok.sukashawarma.com/stok/opname', NULL
        );
      END LOOP;
      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Ringkasan opname kitchen gagal untuk staf %: %', recipient.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_recipients;
END;
$$;
REVOKE ALL ON FUNCTION public.bot_telegram_opname_harian_kitchen(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_opname_harian_kitchen(TEXT, TIMESTAMPTZ) TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('bot-telegram-kitchen-opname-pengingat');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('bot-telegram-kitchen-opname-ringkasan');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Project cron.timezone is GMT. These map to 21:00 and 22:30 Asia/Jakarta.
SELECT cron.schedule('bot-telegram-kitchen-opname-pengingat', '0 14 * * *',
  $cron$SELECT public.bot_telegram_opname_harian_kitchen('pengingat');$cron$);
SELECT cron.schedule('bot-telegram-kitchen-opname-ringkasan', '30 15 * * *',
  $cron$SELECT public.bot_telegram_opname_harian_kitchen('ringkasan');$cron$);

COMMENT ON FUNCTION public.bot_telegram_opname_harian_kitchen(TEXT, TIMESTAMPTZ) IS
  'Kitchen-only daily calendar-WIB reports: pending reminder 21:00, full recap 22:30. One batch per recipient/date/phase. Clock parameter supports isolated verification.';
COMMENT ON TABLE public.bot_telegram_opname_kitchen_send_log IS
  'Private enqueue audit and daily deduplication, not proof that Telegram was delivered; delivery watchdog records HTTP outcomes.';
