-- Akses Bot Stokist diberikan kepada akun staf tertentu oleh owner/admin.
-- Tabel ini sengaja kosong saat migrasi: tautan lama tidak otomatis mendapat akses.
CREATE TABLE IF NOT EXISTS public.bot_telegram_access (
  staff_id uuid PRIMARY KEY REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_telegram_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_access FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bot_telegram_access TO service_role;

CREATE OR REPLACE FUNCTION public.bot_telegram_kirim_alert(
  p_staff_id uuid,
  p_app text,
  p_title text,
  p_body text,
  p_url text,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF p_staff_id IS NULL OR p_app IS NULL OR p_app NOT IN ('stok', 'distribusi')
    OR p_title IS NULL OR p_body IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bot_telegram_access a
    JOIN public.bot_telegram_links l ON l.staff_id = a.staff_id
    JOIN public.outlet_staff s ON s.id = l.staff_id AND s.status = 'active'
    WHERE a.staff_id = p_staff_id
      AND (p_outlet_id IS NULL OR s.role IN ('owner', 'admin', 'kitchen', 'purchasing', 'developer')
        OR s.outlet_id = p_outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = p_outlet_id
        ))
  ) THEN RETURN; END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_secret, '') = '' THEN
    RAISE WARNING 'Alert Stokist % dilewati: Vault belum tersedia.', p_app;
    RETURN;
  END IF;

  PERFORM net.http_post(
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengantrekan alert Telegram % untuk staf %: %', p_app, p_staff_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_kirim_alert(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_kirim_alert(uuid, text, text, text, text, uuid) TO service_role;
