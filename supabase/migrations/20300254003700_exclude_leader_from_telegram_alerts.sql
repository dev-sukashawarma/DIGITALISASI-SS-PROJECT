-- 20300254003700_exclude_leader_from_telegram_alerts.sql
-- Kebijakan: Role 'leader' tidak menerima notifikasi Telegram apa pun.
-- 1. bot_telegram_kirim_alert() memvalidasi s.role <> 'leader'.
-- 2. bot_telegram_alert_stok_kritis() dialihkan ke 'kitchen' & 'purchasing' (leader dikeluarkan).
-- 3. bot_telegram_alert_penurunan_stok_tidak_wajar() mengeluarkan 'leader', hanya ke tim pusat.
-- 4. bot_telegram_alert_surat_jalan_dikirim() dinonaktifkan untuk level outlet (leader & crew tidak menerima alert Telegram).
-- 5. opname_kirim_pengingat_belum_dilakukan() mengeluarkan 'leader'.
-- 6. bot_telegram_alert_delivery_request mendukung outcome 'role_not_eligible'.

-- ─────────────────────────────────────────────────────────── 1. Outcome Constraint
ALTER TABLE public.bot_telegram_alert_delivery_request
  DROP CONSTRAINT IF EXISTS bot_telegram_alert_delivery_request_outcome_check;

ALTER TABLE public.bot_telegram_alert_delivery_request
  ADD CONSTRAINT bot_telegram_alert_delivery_request_outcome_check
  CHECK (outcome IN ('delivered_to_endpoint', 'not_linked', 'role_not_eligible', 'telegram_api_error', 'recipient_lookup_failed', 'endpoint_enqueue_failed', 'endpoint_unreachable', 'endpoint_http_error'));

-- ─────────────────────────────────────────────────────────── 2. Watchdog Outcome Handling
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
    ELSIF COALESCE(r.content, '') LIKE '%"reason":"role_not_eligible"%'
      OR COALESCE(r.content, '') LIKE '%"reason": "role_not_eligible"%' THEN
      v_outcome := 'role_not_eligible';
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

-- ─────────────────────────────────────────────────────────── 3. Fungsi Utama bot_telegram_kirim_alert
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

  -- Proteksi mutlak: Role 'leader' TIDAK BOLEH menerima notifikasi Telegram apa pun.
  IF NOT EXISTS (
    SELECT 1
    FROM public.bot_telegram_access a
    JOIN public.bot_telegram_links l ON l.staff_id = a.staff_id
    JOIN public.outlet_staff s ON s.id = l.staff_id AND s.status = 'active'
    WHERE a.staff_id = p_staff_id
      AND s.role <> 'leader'
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

-- ─────────────────────────────────────────────────────────── 4. Alert Stok Kritis (ke Kitchen & Purchasing)
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_threshold numeric;
  v_outlet_name text;
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL OR NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  -- Dialihkan ke staf kitchen & purchasing aktif (role leader dikeluarkan)
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Stok mencapai batas minimum · ' || v_outlet_name,
      'Stok ' || v_item_name || ' tersisa ' || public.bot_telegram_format_angka(NEW.saldo) || '. Segera ajukan pemenuhan stok.',
      'https://stok.sukashawarma.com/stok/permintaan',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_stok_kritis() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bot_telegram_stok_kritis ON public.stok_balance;
CREATE TRIGGER trg_bot_telegram_stok_kritis
  AFTER INSERT OR UPDATE ON public.stok_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_stok_kritis();

-- ─────────────────────────────────────────────────────────── 5. Alert Penurunan Stok Tidak Biasa (Leader Dikeluarkan)
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

  -- Penerima hanya tim pusat; role leader tidak disertakan
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('owner', 'admin', 'developer', 'kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Penurunan stok tidak biasa · ' || v_outlet_name,
      'Stok ' || v_item_name || ' turun ' || public.bot_telegram_format_angka(v_drop_pct)
        || '% dalam satu perubahan (' || public.bot_telegram_format_angka(OLD.saldo) || ' → ' || public.bot_telegram_format_angka(NEW.saldo)
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

-- ─────────────────────────────────────────────────────────── 6. Alert Surat Jalan Dikirim (Dinonaktifkan untuk Kru & Leader)
DROP TRIGGER IF EXISTS trg_bot_telegram_surat_jalan_dikirim ON public.surat_jalan;

CREATE OR REPLACE FUNCTION public.bot_telegram_alert_surat_jalan_dikirim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dinonaktifkan: Alert Telegram saat surat jalan dikirim tidak lagi dikirim ke kru maupun leader outlet.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_surat_jalan_dikirim() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────── 7. Opname Belum Dilakukan (Leader Dikeluarkan)
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
        AND s.role <> 'leader' -- Role leader tidak menerima alert pengingat opname
        AND (
          (s.outlet_id = outlet.outlet_id AND s.role IN ('crew', 'kiosk'))
          OR (s.role IN ('korlap', 'area_manager') AND EXISTS (
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

  INSERT INTO public.opname_pengingat_push_log (tanggal, kunci, jumlah_outlet, jumlah_penerima)
  VALUES (v_today, v_all, v_count, v_recipients);

  RETURN 'terkirim ke ' || v_recipients || ' staf';
END;
$$;

REVOKE ALL ON FUNCTION public.opname_kirim_pengingat_belum_dilakukan() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.bot_telegram_alert_stok_kritis() IS
  'Alert Telegram saat saldo menembus reorder point ke staf kitchen & purchasing. Role leader tidak menerima notifikasi.';
COMMENT ON FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar() IS
  'Alert Telegram saat saldo turun >=50% dalam satu perubahan ke tim pengawas pusat. Role leader tidak menerima notifikasi.';
