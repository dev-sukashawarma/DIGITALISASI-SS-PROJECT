-- Kitchen receives one completion summary per shipment, plus bounded reminders
-- for new shipments that crew have not verified. Existing discrepancy alerts
-- remain in bot_telegram_alert_selisih_penerimaan(). No historical backfill.
CREATE TABLE IF NOT EXISTS public.bot_telegram_sj_kitchen_alert_state (
  surat_jalan_id UUID PRIMARY KEY REFERENCES public.surat_jalan(id) ON DELETE CASCADE,
  dispatched_at TIMESTAMPTZ NOT NULL,
  completion_alerted_at TIMESTAMPTZ,
  last_reminded_at TIMESTAMPTZ
);

ALTER TABLE public.bot_telegram_sj_kitchen_alert_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_sj_kitchen_alert_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_telegram_sj_kitchen_alert_state TO service_role;
CREATE INDEX IF NOT EXISTS idx_bot_telegram_sj_kitchen_pending
  ON public.bot_telegram_sj_kitchen_alert_state(dispatched_at)
  WHERE completion_alerted_at IS NULL;

CREATE OR REPLACE FUNCTION public.bot_telegram_alert_verifikasi_kitchen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name TEXT;
  v_crew_name TEXT;
  v_document TEXT;
  v_item_count INTEGER;
  v_claimed BOOLEAN;
  r RECORD;
BEGIN
  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');
  IF v_outlet_name IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IN ('dikirim', 'dikirim_lengkap') THEN
    IF TG_OP = 'INSERT' OR OLD.status NOT IN ('dikirim', 'dikirim_lengkap') THEN
      -- A receipt signature or note can change updated_at; it must never
      -- restart the verification timer. Capture the actual dispatch event.
      INSERT INTO public.bot_telegram_sj_kitchen_alert_state AS existing (
        surat_jalan_id, dispatched_at
      ) VALUES (NEW.id, NOW())
      ON CONFLICT (surat_jalan_id) DO UPDATE
        SET dispatched_at = EXCLUDED.dispatched_at, last_reminded_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'diterima_lengkap'
    OR OLD.status NOT IN ('dikirim', 'dikirim_lengkap')
    OR NEW.auto_verified_at IS NOT NULL
    OR NEW.ditutup_administratif_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- A green status alone is insufficient evidence of crew verification.
  -- Exclude partially filled forms, discrepancies and automatic closures.
  SELECT count(*) INTO v_item_count
  FROM public.surat_jalan_item i WHERE i.surat_jalan_id = NEW.id;
  IF v_item_count = 0 OR EXISTS (
    SELECT 1 FROM public.surat_jalan_item i
    WHERE i.surat_jalan_id = NEW.id AND (
      i.verified_at IS NULL OR i.qty_terima IS NULL
      OR i.qty_terima IS DISTINCT FROM i.qty_dikirim
      OR i.kondisi IS DISTINCT FROM 'baik' OR i.flagged IS TRUE
    )
  ) THEN RETURN NEW; END IF;

  SELECT s.name INTO v_crew_name
  FROM public.outlet_staff s
  WHERE s.id = auth.uid() AND s.status = 'active'
    AND s.role IN ('crew', 'leader', 'kiosk')
    AND (s.outlet_id = NEW.outlet_id OR EXISTS (
      SELECT 1 FROM public.staff_outlets so
      WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
    ));

  IF NULLIF(btrim(v_crew_name), '') IS NULL THEN
    SELECT NULLIF(btrim(sig.value->>'signed_by'), '') INTO v_crew_name
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(NEW.receipt_signatures) = 'array'
        THEN NEW.receipt_signatures ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS sig(value, position)
    WHERE sig.value->>'role' = 'Crew Penerima'
    ORDER BY sig.position DESC LIMIT 1;
  END IF;
  IF v_crew_name IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    JOIN public.bot_telegram_access a ON a.staff_id = s.id
    JOIN public.bot_telegram_links l ON l.staff_id = s.id
    WHERE s.role = 'kitchen' AND s.status = 'active' AND l.chat_id IS NOT NULL
  ) THEN RETURN NEW; END IF;

  INSERT INTO public.bot_telegram_sj_kitchen_alert_state (surat_jalan_id, dispatched_at)
  VALUES (NEW.id, COALESCE(OLD.updated_at, OLD.created_at, NOW()))
  ON CONFLICT (surat_jalan_id) DO NOTHING;

  UPDATE public.bot_telegram_sj_kitchen_alert_state
  SET completion_alerted_at = NOW()
  WHERE surat_jalan_id = NEW.id AND completion_alerted_at IS NULL
  RETURNING TRUE INTO v_claimed;
  IF NOT FOUND OR NOT COALESCE(v_claimed, FALSE) THEN RETURN NEW; END IF;

  v_document := COALESCE(NULLIF(NEW.document_number, ''), left(NEW.id::text, 8));
  FOR r IN
    SELECT s.id FROM public.outlet_staff s
    JOIN public.bot_telegram_access a ON a.staff_id = s.id
    JOIN public.bot_telegram_links l ON l.staff_id = s.id
    WHERE s.role = 'kitchen' AND s.status = 'active' AND l.chat_id IS NOT NULL
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id, 'distribusi', '✅ Crew selesai verifikasi · ' || v_outlet_name,
      'SJ: ' || v_document || E'\nCrew: ' || left(v_crew_name, 120)
        || E'\nWaktu: ' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
        || E'\nHasil: ' || v_item_count || ' baris bahan diterima lengkap dan sesuai.'
        || E'\nLihat rincian dan bukti penerimaan pada surat jalan.',
      'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
      NEW.outlet_id
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notification failures must never roll back physical stock operations.
  RAISE WARNING 'Alert verifikasi kitchen SJ % gagal: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_verifikasi_kitchen() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bot_telegram_verifikasi_kitchen ON public.surat_jalan;
CREATE TRIGGER trg_bot_telegram_verifikasi_kitchen
  AFTER INSERT OR UPDATE OF status ON public.surat_jalan
  FOR EACH ROW EXECUTE FUNCTION public.bot_telegram_alert_verifikasi_kitchen();

CREATE OR REPLACE FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(
  p_agora TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hour INTEGER;
  v_pic TEXT;
  v_count INTEGER := 0;
  v_sent BOOLEAN;
  sj RECORD;
  r RECORD;
BEGIN
  IF p_agora IS NULL OR NOT isfinite(p_agora) THEN RETURN 0; END IF;
  v_hour := extract(hour FROM p_agora AT TIME ZONE 'Asia/Jakarta');
  IF v_hour < 8 OR v_hour >= 21 THEN RETURN 0; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-telegram-kitchen-verification-reminder')) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    JOIN public.bot_telegram_access a ON a.staff_id = s.id
    JOIN public.bot_telegram_links l ON l.staff_id = s.id
    WHERE s.role = 'kitchen' AND s.status = 'active' AND l.chat_id IS NOT NULL
  ) THEN RETURN 0; END IF;

  FOR sj IN
    SELECT h.id, h.outlet_id, h.document_number, o.name AS outlet_name, st.dispatched_at
    FROM public.surat_jalan h
    JOIN public.bot_telegram_sj_kitchen_alert_state st ON st.surat_jalan_id = h.id
    JOIN public.outlets o ON o.id = h.outlet_id
    WHERE h.status IN ('dikirim', 'dikirim_lengkap')
      AND h.auto_verified_at IS NULL AND h.ditutup_administratif_at IS NULL
      AND o.is_active IS TRUE AND COALESCE(o.type, '') NOT IN ('test', 'marketplace')
      AND st.completion_alerted_at IS NULL
      AND st.dispatched_at <= p_agora - INTERVAL '2 hours'
      AND (st.last_reminded_at IS NULL OR st.last_reminded_at <= p_agora - INTERVAL '4 hours')
    ORDER BY st.dispatched_at, h.id
    LIMIT 50
    -- Serialize against crew finalization; skip shipments currently being saved.
    FOR UPDATE OF h SKIP LOCKED
  LOOP
    BEGIN
      SELECT string_agg(pic.name, ', ' ORDER BY pic.name) INTO v_pic
      FROM (
        SELECT s.name FROM public.outlet_staff s
        WHERE s.status = 'active' AND s.role IN ('crew', 'leader', 'kiosk')
          AND (s.outlet_id = sj.outlet_id OR EXISTS (
            SELECT 1 FROM public.staff_outlets so
            WHERE so.staff_id = s.id AND so.outlet_id = sj.outlet_id
          ))
        ORDER BY CASE WHEN s.role = 'leader' THEN 0 ELSE 1 END, s.name
        LIMIT 3
      ) pic;

      v_sent := FALSE;
      FOR r IN
        SELECT s.id FROM public.outlet_staff s
        JOIN public.bot_telegram_access a ON a.staff_id = s.id
        JOIN public.bot_telegram_links l ON l.staff_id = s.id
        WHERE s.role = 'kitchen' AND s.status = 'active' AND l.chat_id IS NOT NULL
      LOOP
        PERFORM public.bot_telegram_kirim_alert(
          r.id, 'distribusi', '⏳ Crew belum verifikasi · ' || sj.outlet_name,
          'SJ: ' || COALESCE(NULLIF(sj.document_number, ''), left(sj.id::text, 8))
            || E'\nDikirim: ' || to_char(sj.dispatched_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
            || E'\nSudah ' || round(extract(epoch FROM (p_agora - sj.dispatched_at)) / 3600, 1)
            || ' jam sejak dikirim; verifikasi penerimaan belum selesai.'
            || E'\nPIC outlet: ' || left(COALESCE(v_pic, 'belum tercatat'), 240)
            || E'\nHubungi PIC untuk memastikan barang tiba dan verifikasi diselesaikan.',
          'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || sj.id::text,
          sj.outlet_id
        );
        v_sent := TRUE;
      END LOOP;
      IF v_sent THEN
        UPDATE public.bot_telegram_sj_kitchen_alert_state SET last_reminded_at = p_agora
        WHERE surat_jalan_id = sj.id;
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Pengingat verifikasi kitchen SJ % gagal: %', sj.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(TIMESTAMPTZ) TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('bot-telegram-kitchen-verification-reminder');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- pg_cron on this project uses GMT: 01:00-13:59 UTC = 08:00-20:59 WIB.
SELECT cron.schedule(
  'bot-telegram-kitchen-verification-reminder', '*/10 1-13 * * *',
  $cron$SELECT public.bot_telegram_pengingat_verifikasi_kitchen();$cron$
);

COMMENT ON FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(TIMESTAMPTZ) IS
  'Kitchen-only Telegram: new shipments unverified after 2h, retry reminder every 4h, 08:00-21:00 WIB; at most 50 shipments per run. Optional clock supports deterministic verification.';
COMMENT ON TABLE public.bot_telegram_sj_kitchen_alert_state IS
  'Private dispatch timestamps and notification deduplication; no historical reminder backfill.';
