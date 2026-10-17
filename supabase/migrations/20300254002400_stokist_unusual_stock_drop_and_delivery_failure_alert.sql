-- Add actionable Stokist alerts for unusual balance drops and Telegram delivery
-- failures. Failure notifications use native push as a separate channel to
-- avoid recursively notifying admins through the failed Telegram channel.

CREATE TABLE IF NOT EXISTS public.bot_telegram_alert_delivery_request (
  request_id BIGINT PRIMARY KEY,
  app TEXT NOT NULL CHECK (app IN ('stok', 'distribusi')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('delivered_to_endpoint', 'not_linked', 'telegram_api_error', 'recipient_lookup_failed', 'endpoint_enqueue_failed', 'endpoint_unreachable', 'endpoint_http_error'))
);

ALTER TABLE public.bot_telegram_alert_delivery_request ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_alert_delivery_request FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.bot_telegram_stock_drop_alert_state (
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  last_alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (outlet_id, bahan_baku_id)
);

ALTER TABLE public.bot_telegram_stock_drop_alert_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_stock_drop_alert_state FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_threshold NUMERIC;
  v_outlet_name TEXT;
  v_drop_pct NUMERIC;
  v_should_send BOOLEAN;
  r RECORD;
BEGIN
  -- This alert targets a sharp single-update decrease that remains above the
  -- normal reorder point; the existing critical-stock alert covers the rest.
  IF NEW.saldo >= OLD.saldo OR OLD.saldo <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         GREATEST(COALESCE(orp.reorder_point, b.default_reorder_point, 10), 1),
         o.name
  INTO v_item_name, v_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id
    AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL
    OR OLD.saldo < v_threshold * 2
    OR NEW.saldo <= v_threshold
    OR NEW.saldo > OLD.saldo * 0.5 THEN
    RETURN NEW;
  END IF;

  v_drop_pct := round(((OLD.saldo - NEW.saldo) / OLD.saldo) * 100, 1);

  -- Limit repeat alerts for the same item/outlet to one per hour.
  INSERT INTO public.bot_telegram_stock_drop_alert_state AS existing (
    outlet_id, bahan_baku_id, last_alerted_at
  ) VALUES (NEW.outlet_id, NEW.bahan_baku_id, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id) DO UPDATE
  SET last_alerted_at = NOW()
  WHERE existing.last_alerted_at < NOW() - INTERVAL '1 hour'
  RETURNING TRUE INTO v_should_send;

  IF NOT FOUND OR NOT COALESCE(v_should_send, FALSE) THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND (
        s.role IN ('owner', 'admin', 'developer', 'kitchen', 'purchasing')
        OR (s.role = 'leader' AND (
          s.outlet_id = NEW.outlet_id
          OR EXISTS (
            SELECT 1 FROM public.staff_outlets so
            WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
          )
        ))
      )
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Penurunan stok tidak biasa · ' || v_outlet_name,
      'Stok ' || v_item_name || ' turun ' || v_drop_pct::text
        || '% dalam satu perubahan (' || OLD.saldo::text || ' → ' || NEW.saldo::text
        || '). Saldo masih di atas batas minimum. Mohon periksa mutasinya.',
      'https://stok.sukashawarma.com/stok/monitoring',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bot_telegram_penurunan_stok_tidak_wajar ON public.stok_balance;
CREATE TRIGGER trg_bot_telegram_penurunan_stok_tidak_wajar
  AFTER UPDATE OF saldo ON public.stok_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar();

-- Aggregated state rate-limits admin fallback pushes to one per app/failure
-- class every 15 minutes. Raw Telegram errors and recipient identifiers are
-- intentionally not stored in this table.
CREATE TABLE IF NOT EXISTS public.bot_telegram_delivery_failure_state (
  app TEXT NOT NULL CHECK (app IN ('stok', 'distribusi')),
  failure_code TEXT NOT NULL CHECK (failure_code IN ('telegram_api_error', 'recipient_lookup_failed', 'endpoint_enqueue_failed', 'endpoint_unreachable', 'endpoint_http_error')),
  failure_count INTEGER NOT NULL DEFAULT 1 CHECK (failure_count > 0),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (app, failure_code)
);

ALTER TABLE public.bot_telegram_delivery_failure_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_delivery_failure_state FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bot_telegram_alert_delivery_failure(
  p_app TEXT,
  p_failure_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify BOOLEAN;
  v_failure_count INTEGER;
  v_url TEXT;
  v_secret TEXT;
  r RECORD;
BEGIN
  IF p_app IS NULL OR p_failure_code IS NULL
    OR p_app NOT IN ('stok', 'distribusi')
    OR p_failure_code NOT IN ('telegram_api_error', 'recipient_lookup_failed', 'endpoint_enqueue_failed', 'endpoint_unreachable', 'endpoint_http_error') THEN
    RETURN;
  END IF;

  INSERT INTO public.bot_telegram_delivery_failure_state AS existing (
    app, failure_code, failure_count, last_failed_at, last_notified_at
  ) VALUES (p_app, p_failure_code, 1, NOW(), NOW())
  ON CONFLICT (app, failure_code) DO UPDATE
  SET failure_count = CASE
        WHEN existing.last_notified_at < NOW() - INTERVAL '15 minutes' THEN 1
        ELSE existing.failure_count + 1
      END,
      last_failed_at = NOW(),
      last_notified_at = CASE
        WHEN existing.last_notified_at < NOW() - INTERVAL '15 minutes' THEN NOW()
        ELSE existing.last_notified_at
      END
  RETURNING (last_failed_at = last_notified_at), failure_count
  INTO v_should_notify, v_failure_count;

  IF NOT COALESCE(v_should_notify, FALSE) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_secret, '') = '' THEN
    RAISE WARNING 'Fallback alert kegagalan Telegram dilewati: secret push belum tersedia.';
    RETURN;
  END IF;

  FOR r IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('owner', 'admin', 'developer')
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object(
        'user_id', r.id,
        'app', 'stok',
        'title', '⚠️ Pengiriman alert Telegram gagal',
        'body', 'Pengiriman alert ' || upper(p_app) || ' gagal (' || p_failure_code
          || '). Jumlah kegagalan dalam periode ini: ' || v_failure_count
          || '. Mohon periksa layanan bot.',
        'url', 'https://admin.sukashawarma.com/dashboard/sistem/bot-telegram'
      )
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Monitoring failure must not turn an unsuccessful alert into a server error.
  RAISE WARNING 'Fallback push untuk kegagalan Telegram tidak terkirim: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_delivery_failure(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_alert_delivery_failure(TEXT, TEXT) TO service_role;

-- Track each asynchronous pg_net request. A separate cron worker checks its
-- response so an unavailable bot endpoint is noticed even if the app never ran.
CREATE OR REPLACE FUNCTION public.bot_telegram_kirim_alert(
  p_staff_id UUID,
  p_app TEXT,
  p_title TEXT,
  p_body TEXT,
  p_url TEXT,
  p_outlet_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  IF p_staff_id IS NULL OR p_app IS NULL OR p_app NOT IN ('stok', 'distribusi')
    OR p_title IS NULL OR p_body IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bot_telegram_access a
    JOIN public.bot_telegram_links l ON l.staff_id = a.staff_id
    JOIN public.outlet_staff s ON s.id = l.staff_id AND s.status = 'active'
    WHERE a.staff_id = p_staff_id
      AND (p_outlet_id IS NULL OR s.role IN ('owner', 'admin', 'kitchen', 'purchasing', 'developer')
        OR s.outlet_id = p_outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = p_outlet_id
        ))
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_secret, '') = '' THEN
    RAISE WARNING 'Alert Stokist % dilewati: Vault belum tersedia.', p_app;
    RETURN;
  END IF;

  v_request_id := net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'user_id', p_staff_id,
      'app', p_app,
      'title', left(p_title, 180),
      'body', left(p_body, 1200),
      'url', p_url
    )
  );

  INSERT INTO public.bot_telegram_alert_delivery_request (request_id, app)
  VALUES (v_request_id, p_app)
  ON CONFLICT (request_id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.bot_telegram_alert_delivery_failure(p_app, 'endpoint_enqueue_failed');
  RAISE WARNING 'Gagal mengantrekan alert Telegram % untuk staf %: %', p_app, p_staff_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.bot_telegram_proses_hasil_pengiriman()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_failure_code TEXT;
  v_outcome TEXT;
  v_processed INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bot-telegram-delivery-watchdog'));

  FOR r IN
    SELECT q.request_id, q.app, q.requested_at,
           h.id AS response_id, h.status_code, h.content,
           h.timed_out, h.error_msg
    FROM public.bot_telegram_alert_delivery_request q
    LEFT JOIN net._http_response h ON h.id = q.request_id
    WHERE q.checked_at IS NULL
      AND (h.id IS NOT NULL OR q.requested_at < NOW() - INTERVAL '5 minutes')
    ORDER BY q.requested_at
    LIMIT 200
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    v_failure_code := NULL;
    v_outcome := 'delivered_to_endpoint';

    IF r.response_id IS NULL OR COALESCE(r.timed_out, FALSE) OR r.error_msg IS NOT NULL THEN
      v_failure_code := 'endpoint_unreachable';
      v_outcome := v_failure_code;
    ELSIF r.status_code IS NULL OR r.status_code < 200 OR r.status_code >= 300 THEN
      IF COALESCE(r.content, '') LIKE '%"reason":"telegram_error"%'
        OR COALESCE(r.content, '') LIKE '%"reason": "telegram_error"%' THEN
        v_failure_code := 'telegram_api_error';
      ELSIF COALESCE(r.content, '') LIKE '%"error":"Database unavailable"%'
        OR COALESCE(r.content, '') LIKE '%"error": "Database unavailable"%' THEN
        v_failure_code := 'recipient_lookup_failed';
      ELSE
        v_failure_code := 'endpoint_http_error';
      END IF;
      v_outcome := v_failure_code;
    ELSIF COALESCE(r.content, '') LIKE '%"reason":"not_linked"%'
      OR COALESCE(r.content, '') LIKE '%"reason": "not_linked"%' THEN
      v_outcome := 'not_linked';
    END IF;

    UPDATE public.bot_telegram_alert_delivery_request
    SET checked_at = NOW(), outcome = v_outcome
    WHERE request_id = r.request_id;

    IF v_failure_code IS NOT NULL THEN
      PERFORM public.bot_telegram_alert_delivery_failure(r.app, v_failure_code);
    END IF;
    v_processed := v_processed + 1;
  END LOOP;

  DELETE FROM public.bot_telegram_alert_delivery_request
  WHERE checked_at < NOW() - INTERVAL '7 days';

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_proses_hasil_pengiriman() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('bot-telegram-delivery-watchdog');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'bot-telegram-delivery-watchdog',
  '* * * * *',
  $cron$SELECT public.bot_telegram_proses_hasil_pengiriman();$cron$
);

COMMENT ON FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar() IS
  'Telegram alert saat saldo satu bahan turun >=50% dalam satu update, dari >=2x reorder point, dan masih di atas reorder point; maksimum sekali per item/outlet per jam.';
COMMENT ON FUNCTION public.bot_telegram_alert_delivery_failure(TEXT, TEXT) IS
  'Mengirim fallback push ke owner/admin/developer saat jalur alert Telegram gagal; dibatasi sekali per app/kelas kegagalan tiap 15 menit.';
