-- ============================================================================
-- Migrasi: Alert Notifikasi Role Crew & AM Outlet
-- 1. Kedatangan Distribusi Bahan Baku (Surat Jalan status 'dikirim' -> Kru bertugas & AM)
-- 2. Status Pengajuan Cuti Disetujui/Ditolak HR -> Kru Pengaju
-- 3. Status Pengajuan Kasbon Disetujui/Ditolak HR -> Kru Pengaju
-- ============================================================================

SET lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────── Helper Kirim Push Universal
CREATE OR REPLACE FUNCTION public.crew_alert_kirim_push(
  p_staff_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_route TEXT,
  p_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  IF p_staff_id IS NULL OR coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_body), '') = '' THEN
    RETURN;
  END IF;

  -- Cari endpoint push di Vault, fallback ke environment setting
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

  IF v_url IS NULL OR v_url = '' THEN
    v_url := current_setting('app.settings.edge_function_url', true) || '/send-push';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF v_url IS NOT NULL AND v_url <> '' AND v_key IS NOT NULL AND v_key <> '' THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'user_id', p_staff_id,
        'app', 'superapp',
        'type', coalesce(p_type, 'alert'),
        'title', left(p_title, 180),
        'body', left(p_body, 1200),
        'url', coalesce(p_route, '/')
      )
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'crew_alert_kirim_push gagal untuk staff %: %', p_staff_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.crew_alert_kirim_push(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_alert_kirim_push(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────── 1. Push Kedatangan Distribusi Bahan
CREATE OR REPLACE FUNCTION public.trigger_distribusi_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_outlet_name TEXT;
  v_nomor_sj TEXT;
  v_title TEXT;
  v_body TEXT;
  v_target_staff_ids UUID[] := '{}';
  v_staff_id UUID;
  v_has_clocked_in BOOLEAN := false;
BEGIN
  -- Trigger hanya ketika status berubah menjadi 'dikirim'
  IF NEW.status = 'dikirim' AND (OLD.status IS NULL OR OLD.status <> 'dikirim') THEN
    SELECT coalesce(name, 'Outlet') INTO v_outlet_name
    FROM public.outlets
    WHERE id = NEW.outlet_id;

    v_nomor_sj := coalesce(NULLIF(NEW.document_number, ''), left(NEW.id::text, 8));
    v_title := '🚚 [PENGIRIMAN TIBA] Bahan Baku Sedang Dikirim';
    v_body := format('Surat Jalan no. %s untuk %s sedang dalam perjalanan/tiba. Mohon segera dicek & diverifikasi fisik barangnya!', v_nomor_sj, v_outlet_name);

    -- 1. Kru yang sedang bertugas hari ini di outlet tujuan (sudah clock-in & belum clock-out)
    FOR v_staff_id IN
      SELECT DISTINCT a.staff_id
      FROM public.attendance a
      JOIN public.outlet_staff s ON s.id = a.staff_id
      WHERE a.outlet_id = NEW.outlet_id
        AND a.date = v_today
        AND a.clock_in IS NOT NULL
        AND a.clock_out IS NULL
        AND s.status = 'active'
    LOOP
      v_target_staff_ids := array_append(v_target_staff_ids, v_staff_id);
      v_has_clocked_in := true;
    END LOOP;

    -- Bila belum ada kru yang clock-in (misal barang datang sebelum toko buka),
    -- fallback ke seluruh kru & leader aktif yang terdaftar di outlet tersebut
    IF NOT v_has_clocked_in THEN
      FOR v_staff_id IN
        SELECT s.id
        FROM public.outlet_staff s
        WHERE s.outlet_id = NEW.outlet_id
          AND s.status = 'active'
          AND s.role IN ('crew', 'leader', 'kasir')
      LOOP
        v_target_staff_ids := array_append(v_target_staff_ids, v_staff_id);
      END LOOP;
    END IF;

    -- 2. Area Manager yang membawahi outlet tujuan
    FOR v_staff_id IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      IF NOT (v_staff_id = ANY(v_target_staff_ids)) THEN
        v_target_staff_ids := array_append(v_target_staff_ids, v_staff_id);
      END IF;
    END LOOP;

    -- Kirim push notification ke setiap target
    FOREACH v_staff_id IN ARRAY v_target_staff_ids
    LOOP
      PERFORM public.crew_alert_kirim_push(
        v_staff_id,
        v_title,
        v_body,
        'crew_distribusi',
        'crew_distribusi'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trigger_distribusi_push_notification gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_surat_jalan_dikirim_send_push ON public.surat_jalan;
CREATE TRIGGER on_surat_jalan_dikirim_send_push
  AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_distribusi_push_notification();


-- ─────────────────────────────────────────────────────────── 2. Push Status Pengajuan Cuti (leave_requests)
CREATE OR REPLACE FUNCTION public.trg_fn_crew_leave_status_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jenis TEXT;
  v_rentang TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Hanya saat status berubah dari pending menjadi approved atau rejected
  IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    v_jenis := CASE lower(coalesce(NEW.type, 'cuti'))
      WHEN 'annual' THEN 'Cuti Tahunan'
      WHEN 'cuti' THEN 'Cuti'
      WHEN 'sick' THEN 'Izin Sakit'
      WHEN 'sakit' THEN 'Izin Sakit'
      WHEN 'izin' THEN 'Izin'
      WHEN 'special' THEN 'Izin Khusus'
      ELSE 'Pengajuan Cuti/Izin'
    END;

    IF NEW.start_date IS NULL THEN
      v_rentang := '-';
    ELSIF NEW.end_date IS NULL OR NEW.end_date = NEW.start_date THEN
      v_rentang := to_char(NEW.start_date, 'DD Mon YYYY');
    ELSE
      v_rentang := to_char(NEW.start_date, 'DD Mon') || ' – ' || to_char(NEW.end_date, 'DD Mon YYYY');
    END IF;

    IF NEW.status = 'approved' THEN
      v_title := '✅ ' || v_jenis || ' Disetujui';
      v_body := 'Pengajuan ' || v_jenis || ' Anda (' || v_rentang || ') telah disetujui oleh HR.';
    ELSE
      v_title := '❌ ' || v_jenis || ' Ditolak';
      v_body := 'Pengajuan ' || v_jenis || ' Anda (' || v_rentang || ') ditolak oleh HR.';
      IF NEW.rejection_reason IS NOT NULL AND btrim(NEW.rejection_reason) <> '' THEN
        v_body := v_body || E'\nAlasan: "' || left(btrim(NEW.rejection_reason), 150) || '"';
      END IF;
    END IF;

    PERFORM public.crew_alert_kirim_push(
      NEW.staff_id,
      v_title,
      v_body,
      'crew_cuti',
      'crew_cuti'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_crew_leave_status_push gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crew_leave_status_push ON public.leave_requests;
CREATE TRIGGER trg_crew_leave_status_push
  AFTER UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_crew_leave_status_push();


-- ─────────────────────────────────────────────────────────── 3. Push Status Pengajuan Kasbon (cash_advances)
CREATE OR REPLACE FUNCTION public.trg_fn_crew_kasbon_status_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rupiah TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Hanya saat status_hr berubah dari pending menjadi approved atau rejected
  IF NEW.status_hr IN ('approved', 'rejected') AND (OLD.status_hr IS NULL OR OLD.status_hr = 'pending') THEN
    v_rupiah := 'Rp ' || to_char(coalesce(NEW.amount, 0), 'FM999,999,999');

    IF NEW.status_hr = 'approved' THEN
      v_title := '💰 Pengajuan Kasbon Disetujui';
      v_body := 'Pengajuan kasbon Anda sebesar ' || v_rupiah || ' telah disetujui oleh HR.';
      IF coalesce(NEW.installment_months, 1) > 1 THEN
        v_body := v_body || ' Dicicil ' || NEW.installment_months || ' bulan.';
      END IF;
    ELSE
      v_title := '❌ Pengajuan Kasbon Ditolak';
      v_body := 'Pengajuan kasbon Anda sebesar ' || v_rupiah || ' ditolak oleh HR.';
      IF NEW.rejection_reason IS NOT NULL AND btrim(NEW.rejection_reason) <> '' THEN
        v_body := v_body || E'\nAlasan: "' || left(btrim(NEW.rejection_reason), 150) || '"';
      END IF;
    END IF;

    PERFORM public.crew_alert_kirim_push(
      NEW.staff_id,
      v_title,
      v_body,
      'crew_kasbon',
      'crew_kasbon'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_crew_kasbon_status_push gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crew_kasbon_status_push ON public.cash_advances;
CREATE TRIGGER trg_crew_kasbon_status_push
  AFTER UPDATE OF status_hr ON public.cash_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_crew_kasbon_status_push();
