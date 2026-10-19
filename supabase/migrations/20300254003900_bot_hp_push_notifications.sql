-- 20300254003900_bot_hp_push_notifications.sql
-- Integrasi seluruh Trigger Otomatis Bot (Manager AM/RM, HRD, Stokis/Kitchen/Purchasing)
-- agar otomatis muncul di bilah notifikasi HP Android (SUKA Superapp) melalui:
-- 1. Tabel public.bot_app_notifications (Realtime WebSocket + Riwayat In-App)
-- 2. Edge Function send-push (FCM Push Notification latar belakang)
-- Tanpa mengharuskan pengguna menautkan akun Telegram terlebih dahulu.

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Tabel Notifikasi Bot HP
CREATE TABLE IF NOT EXISTS public.bot_app_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  bot_slug text NOT NULL DEFAULT 'manager',
  title text NOT NULL,
  body text NOT NULL,
  route text NOT NULL DEFAULT 'bot',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_app_notifications_staff_created
  ON public.bot_app_notifications (staff_id, created_at DESC);

ALTER TABLE public.bot_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bot_app_notifications_select_own ON public.bot_app_notifications;
CREATE POLICY bot_app_notifications_select_own
  ON public.bot_app_notifications FOR SELECT
  TO authenticated
  USING (staff_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bot_app_notifications_update_own ON public.bot_app_notifications;
CREATE POLICY bot_app_notifications_update_own
  ON public.bot_app_notifications FOR UPDATE
  TO authenticated
  USING (staff_id = (SELECT auth.uid()))
  WITH CHECK (staff_id = (SELECT auth.uid()));

REVOKE ALL ON public.bot_app_notifications FROM PUBLIC, anon;
GRANT SELECT, UPDATE (is_read) ON public.bot_app_notifications TO authenticated;
GRANT ALL ON public.bot_app_notifications TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'bot_app_notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_app_notifications;
  END IF;
END
$$;

COMMENT ON TABLE public.bot_app_notifications IS
  'Antrean & riwayat notifikasi trigger otomatis Bot yang dikirim ke HP pengguna SUKA Superapp (FCM + Supabase Realtime).';

-- ─────────────────────────────────────────────────────────── 2. Fungsi Pengirim Push HP Terpadu
CREATE OR REPLACE FUNCTION public.bot_kirim_push_hp(
  p_event_key text,
  p_staff_id uuid,
  p_bot_slug text,
  p_title text,
  p_body text,
  p_route text DEFAULT 'bot'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id bigint;
  v_url text;
  v_key text;
  v_clean_key text;
  v_clean_route text;
BEGIN
  IF p_staff_id IS NULL OR coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_body), '') = '' THEN
    RETURN;
  END IF;

  -- Pastikan penerima adalah staf aktif (dan bukan role leader sesuai kebijakan alert)
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role <> 'leader'
  ) THEN
    RETURN;
  END IF;

  v_clean_key := coalesce(nullif(btrim(p_event_key), ''), 'bot:' || gen_random_uuid()::text);
  v_clean_route := coalesce(nullif(btrim(p_route), ''), 'bot');

  -- 1. Simpan ke tabel notifikasi HP (memicu Supabase Realtime + deduplikasi via event_key)
  INSERT INTO public.bot_app_notifications (
    event_key, staff_id, bot_slug, title, body, route
  ) VALUES (
    v_clean_key,
    p_staff_id,
    coalesce(nullif(btrim(p_bot_slug), ''), 'manager'),
    left(p_title, 180),
    left(p_body, 1500),
    v_clean_route
  )
  ON CONFLICT (event_key, staff_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- Jika sudah pernah dikirim untuk event_key & staff_id ini, jangan kirim ulang FCM
  IF v_inserted_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Kirim ke Edge Function send-push untuk membangunkan HP via FCM
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

  IF coalesce(v_url, '') <> '' AND coalesce(v_key, '') <> '' THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'user_id', p_staff_id,
        'app', 'bot',
        'type', 'bot_alert',
        'event_key', v_clean_key,
        'title', left(p_title, 180),
        'body', left(p_body, 1200),
        'url', v_clean_route
      )
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengirim notifikasi HP Bot untuk staf %: %', p_staff_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_kirim_push_hp(text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_kirim_push_hp(text, uuid, text, text, text, text) TO service_role;

-- ─────────────────────────────────────────────────────────── 3. Integrasi ke Bot Manager (AM & RM)
CREATE OR REPLACE FUNCTION public.bot_manager_antrekan(
  p_key text,
  p_staff_id uuid,
  p_title text,
  p_body text,
  p_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Jalur Notifikasi HP Native (SUKA Superapp): aktif untuk semua AM/RM/Developer tanpa wajib link Telegram
  IF EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role IN ('area_manager', 'regional_manager', 'developer')
  ) THEN
    PERFORM public.bot_kirim_push_hp(
      p_key,
      p_staff_id,
      'manager',
      p_title,
      p_body,
      'bot'
    );
  END IF;

  -- 2. Jalur Telegram Bot Manager: bagi staf yang sudah menautkan akun Telegram
  INSERT INTO public.bot_manager_alert_outbox(event_key, staff_id, title, body, url)
  SELECT p_key, s.id, left(p_title, 180), left(p_body, 1200), p_url
  FROM public.outlet_staff s
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role IN ('area_manager', 'regional_manager', 'developer')
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_manager_antrekan(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────── 4. Integrasi ke Bot HRD (admin_hr)
CREATE OR REPLACE FUNCTION public.bot_hrd_antrekan(
  p_key text,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  -- 1. Jalur Notifikasi HP Native: kirim ke seluruh admin_hr aktif (dan developer yang punya akses bot hrd)
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    LEFT JOIN public.hermes_bot_user_access a ON a.staff_id = s.id AND a.bot_slug = 'hrd'
    WHERE s.status = 'active'
      AND (
        s.role = 'admin_hr'
        OR (s.role = 'developer' AND a.staff_id IS NOT NULL)
      )
  LOOP
    PERFORM public.bot_kirim_push_hp(
      p_key,
      r.id,
      'hrd',
      p_title,
      p_body,
      'bot'
    );
  END LOOP;

  -- 2. Jalur Telegram Bot HRD: bagi yang sudah menautkan Telegram
  INSERT INTO public.bot_hrd_alert_outbox(event_key, staff_id, title, body)
  SELECT p_key, s.id, left(p_title, 180), left(p_body, 1200)
  FROM public.outlet_staff s
  JOIN public.hermes_bot_user_access a ON a.staff_id = s.id AND a.bot_slug = 'hrd'
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.role IN ('admin_hr', 'developer')
    AND s.status = 'active'
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_hrd_antrekan(text, text, text) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────── 5. Integrasi ke Bot Stokist / Kitchen / Purchasing
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
  v_role TEXT;
  v_bot_slug TEXT;
BEGIN
  IF p_staff_id IS NULL OR p_app IS NULL OR p_app NOT IN ('stok', 'distribusi')
    OR p_title IS NULL OR p_body IS NULL THEN
    RETURN;
  END IF;

  -- Cek apakah staf aktif, bukan leader, dan berhak atas cakupan outlet
  SELECT s.role INTO v_role
  FROM public.outlet_staff s
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role <> 'leader'
    AND (
      p_outlet_id IS NULL
      OR s.role IN ('owner', 'admin', 'kitchen', 'purchasing', 'developer')
      OR s.outlet_id = p_outlet_id
      OR EXISTS (
        SELECT 1 FROM public.staff_outlets so
        WHERE so.staff_id = s.id AND so.outlet_id = p_outlet_id
      )
    );

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  v_bot_slug := CASE WHEN v_role = 'kitchen' THEN 'kitchen' ELSE 'stokis' END;

  -- 1. Jalur Notifikasi HP Native (SUKA Superapp)
  PERFORM public.bot_kirim_push_hp(
    'stokist:' || p_app || ':' || md5(p_staff_id::text || p_title || left(p_body, 200) || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD-HH24')),
    p_staff_id,
    v_bot_slug,
    p_title,
    p_body,
    'bot'
  );

  -- 2. Jalur Telegram Stokist: hanya bila terdaftar di bot_telegram_access & bot_telegram_links
  IF NOT EXISTS (
    SELECT 1
    FROM public.bot_telegram_access a
    JOIN public.bot_telegram_links l ON l.staff_id = a.staff_id
    WHERE a.staff_id = p_staff_id
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
    ),
    timeout_milliseconds := 15000
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

-- ─────────────────────────────────────────────────────────── 6. RPC Uji Notifikasi HP dari Aplikasi
CREATE OR REPLACE FUNCTION public.bot_kirim_uji_notifikasi_hp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_staff record;
  v_bot_slug text;
  v_title text;
  v_body text;
  v_event_key text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi login aktif.';
  END IF;

  SELECT id, name, role INTO v_staff
  FROM public.outlet_staff
  WHERE id = v_uid AND status = 'active';

  IF v_staff.id IS NULL THEN
    RAISE EXCEPTION 'Akun staf tidak ditemukan atau tidak aktif.';
  END IF;

  v_bot_slug := CASE v_staff.role
    WHEN 'regional_manager' THEN 'manager'
    WHEN 'area_manager' THEN 'manager'
    WHEN 'admin_hr' THEN 'hrd'
    WHEN 'kitchen' THEN 'kitchen'
    WHEN 'purchasing' THEN 'stokis'
    WHEN 'admin' THEN 'stokis'
    ELSE 'hermes'
  END;

  v_title := CASE v_staff.role
    WHEN 'regional_manager' THEN '📊 [Tes Trigger] Executive Summary Regional'
    WHEN 'area_manager' THEN '⚠️ [Tes Trigger] Radar Operasional Area Manager'
    WHEN 'admin_hr' THEN '📋 [Tes Trigger] Pemeriksaan Harian HRD'
    WHEN 'kitchen' THEN '📦 [Tes Trigger] Permintaan Bahan & Stok Dapur'
    WHEN 'purchasing' THEN '⚠️ [Tes Trigger] Peringatan Reorder Point Stokis'
    ELSE '🤖 [Tes Trigger] Notifikasi Bot SUKA Superapp'
  END;

  v_body := 'Halo ' || coalesce(v_staff.name, 'Staf') || ' (' || upper(replace(v_staff.role, '_', ' ')) || ')!'
    || E'\nSaluran notifikasi trigger otomatis Bot ke HP Anda sudah AKTIF.'
    || E'\nWaktu Uji: ' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI:SS') || ' WIB'
    || E'\nKetuk notifikasi ini untuk membuka halaman Bot & Otomasi.';

  v_event_key := 'uji_hp:' || v_uid::text || ':' || extract(epoch from now())::bigint::text;

  PERFORM public.bot_kirim_push_hp(
    v_event_key,
    v_uid,
    v_bot_slug,
    v_title,
    v_body,
    'bot'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'event_key', v_event_key,
    'title', v_title
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bot_kirim_uji_notifikasi_hp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bot_kirim_uji_notifikasi_hp() TO authenticated;
