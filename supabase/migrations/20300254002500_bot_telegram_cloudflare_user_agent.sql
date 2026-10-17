-- Give pg_net a stable service User-Agent. Cloudflare rejects its default
-- client signature with 1010 before the authenticated bot endpoint is reached.
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
      'Accept', 'application/json',
      'User-Agent', 'SukaShawarma-Stokist-Alerts/1.0',
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
