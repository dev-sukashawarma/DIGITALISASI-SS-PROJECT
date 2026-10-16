-- Push status kesehatan sistem hanya saat ada perubahan insiden, bukan setiap
-- polling 5 menit. Data detail error tidak ikut dikirim ke perangkat.

CREATE OR REPLACE FUNCTION public.system_health_push_on_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous TEXT;
  v_url TEXT;
  v_key TEXT;
  v_title TEXT;
  v_body TEXT;
  v_target_label TEXT;
  r RECORD;
BEGIN
  IF NEW.status = 'unconfigured' THEN
    RETURN NEW;
  END IF;

  SELECT h.status INTO v_previous
  FROM public.system_health_log h
  WHERE h.target_name = NEW.target_name
    AND h.id <> NEW.id
  ORDER BY h.checked_at DESC, h.id DESC
  LIMIT 1;

  -- Pertahankan status awal yang sehat sebagai baseline. Kirim insiden saat
  -- pertama kali target ditemukan bermasalah, perubahan tingkat gangguan, dan
  -- pemulihan dari down/degraded ke up.
  IF NEW.status IN ('down', 'degraded') THEN
    IF v_previous IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.status = 'up' THEN
    IF v_previous IS NULL OR v_previous = 'up' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Push system health dilewati: secret push belum tersedia.';
    RETURN NEW;
  END IF;

  v_target_label := CASE NEW.target_name
    WHEN 'supabase-db' THEN 'Supabase Database'
    WHEN 'cpanel-server' THEN 'Server cPanel'
    ELSE NEW.target_name
  END;

  IF NEW.status = 'up' THEN
    v_title := '✅ Sistem pulih · ' || v_target_label;
    v_body := v_target_label || ' kembali normal.';
  ELSIF NEW.status = 'down' THEN
    v_title := '🚨 Sistem tidak tersedia · ' || v_target_label;
    v_body := v_target_label || ' terdeteksi tidak tersedia. Mohon periksa status sistem.';
  ELSE
    v_title := '⚠️ Sistem melambat · ' || v_target_label;
    v_body := v_target_label || ' terdeteksi mengalami gangguan. Mohon periksa status sistem.';
  END IF;

  FOR r IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin', 'owner', 'developer')
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', r.id,
          'app', 'admin-dashboard',
          'title', v_title,
          'body', v_body,
          'url', 'https://admin.sukashawarma.com/dashboard/system-health'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim push system health untuk % ke staf %: %', NEW.target_name, r.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.system_health_push_on_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_system_health_push_on_transition ON public.system_health_log;
CREATE TRIGGER trg_system_health_push_on_transition
  AFTER INSERT ON public.system_health_log
  FOR EACH ROW
  EXECUTE FUNCTION public.system_health_push_on_transition();
