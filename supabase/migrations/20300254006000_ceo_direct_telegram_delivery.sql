-- Migration: direct telegram delivery for CEO bot using hermes_bot_registry token
CREATE OR REPLACE FUNCTION public.bot_ceo_kirim_antrean()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bot_token text;
  v_url text;
  v_request bigint;
  r record;
  v_response record;
  v_text text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-ceo-delivery')) THEN
    RETURN;
  END IF;

  -- 1. Ambil token bot CEO langsung dari public.hermes_bot_registry
  SELECT bot_token INTO v_bot_token FROM public.hermes_bot_registry WHERE slug = 'ceo' LIMIT 1;
  IF coalesce(v_bot_token, '') = '' THEN
    SELECT decrypted_secret INTO v_bot_token FROM vault.decrypted_secrets WHERE name = 'telegram_ceo_bot_token' LIMIT 1;
  END IF;

  -- Jika bot_token ditemukan, kirim langsung via Telegram Bot API (paling cepat & andal)
  IF coalesce(v_bot_token, '') <> '' THEN
    v_url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage';
  ELSE
    -- Fallback ke webhook Coolify jika token belum terdaftar
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_ceo_send_url' LIMIT 1;
  END IF;

  IF coalesce(v_url, '') = '' THEN
    RETURN;
  END IF;

  FOR r IN 
    SELECT o.*, l.chat_id
    FROM public.bot_ceo_alert_outbox o
    JOIN public.bot_telegram_links l ON l.staff_id = o.staff_id
    JOIN public.outlet_staff s ON s.id = o.staff_id
    WHERE o.outcome = 'pending'
      AND s.role IN ('owner', 'admin', 'developer')
      AND s.status = 'active'
      AND l.chat_id IS NOT NULL
      AND (o.attempts = 0 OR o.request_id IS NOT NULL OR o.attempted_at <= now() - interval '2 minutes')
    ORDER BY o.created_at LIMIT 50 FOR UPDATE OF o SKIP LOCKED 
  LOOP
    -- Cek status respons request sebelumnya jika ada
    IF r.request_id IS NOT NULL THEN
      SELECT status_code, content INTO v_response FROM net._http_response WHERE id = r.request_id;
      IF FOUND THEN
        IF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND (v_response.content::jsonb->>'ok' = 'true' OR v_response.content::jsonb->>'delivered' = 'true') THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'delivered' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason' = 'not_eligible' THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 400 OR v_response.status_code = 403 THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'failed' WHERE id = r.id;
          CONTINUE;
        END IF;
        UPDATE public.bot_ceo_alert_outbox SET request_id = NULL WHERE id = r.id;
      ELSIF r.attempted_at > now() - interval '2 minutes' THEN
        CONTINUE;
      END IF;
    END IF;

    IF r.attempts >= 3 THEN
      UPDATE public.bot_ceo_alert_outbox SET outcome = 'failed' WHERE id = r.id;
      CONTINUE;
    END IF;

    v_text := r.title || E'\n\n' || r.body;

    BEGIN
      IF v_url LIKE '%api.telegram.org%' THEN
        v_request := net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'chat_id', r.chat_id,
            'text', v_text,
            'parse_mode', 'HTML'
          ),
          timeout_milliseconds := 15000
        );
      ELSE
        v_request := net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'user_id', r.staff_id,
            'title', r.title,
            'body', r.body,
            'url', r.url
          ),
          timeout_milliseconds := 15000
        );
      END IF;

      UPDATE public.bot_ceo_alert_outbox 
      SET request_id = v_request, attempted_at = now(), attempts = attempts + 1 
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bot_ceo_alert_outbox 
      SET request_id = NULL, attempted_at = now(), attempts = attempts + 1 
      WHERE id = r.id;
    END;
  END LOOP;

  DELETE FROM public.bot_ceo_alert_outbox 
  WHERE created_at < now() - interval '90 days' AND outcome <> 'pending';
END;
$$;
