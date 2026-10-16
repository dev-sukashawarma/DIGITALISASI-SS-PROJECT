-- Notify scoped stock approvers when a waste report enters the approval queue.
-- Payload intentionally omits notes, evidence URLs, and other free-form fields.

CREATE OR REPLACE FUNCTION public.stok_push_waste_pending_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_outlet_name TEXT;
  v_recip RECORD;
BEGIN
  IF NEW.status <> 'PENDING'
    OR (TG_OP = 'UPDATE' AND OLD.status = 'PENDING') THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Push approval waste dilewati: secret push belum tersedia.';
    RETURN NEW;
  END IF;

  FOR v_recip IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('area_manager', 'regional_manager', 'admin', 'kitchen', 'developer')
      AND (
        s.role IN ('admin', 'kitchen', 'developer')
        OR s.outlet_id = NEW.outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
        )
      )
      AND s.id IS DISTINCT FROM NEW.reported_by
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'stok',
          'title', '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet'),
          'body', 'Ada laporan waste baru yang perlu ditinjau di outlet ' || COALESCE(v_outlet_name, 'terkait') || '.',
          'url', 'https://stok.sukashawarma.com/stok/waste/approval'
        )
      );
      PERFORM public.bot_telegram_kirim_alert(
        v_recip.id,
        'stok',
        '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet'),
        'Ada laporan waste baru yang perlu ditinjau di outlet ' || COALESCE(v_outlet_name, 'terkait') || '.',
        'https://stok.sukashawarma.com/stok/waste/approval',
        NEW.outlet_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim push approval waste % kepada staf %: %', NEW.id, v_recip.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_push_waste_pending_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stok_push_waste_pending_approval ON public.stok_waste_reports;
CREATE TRIGGER trg_stok_push_waste_pending_approval
  AFTER INSERT OR UPDATE OF status ON public.stok_waste_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.stok_push_waste_pending_approval();
