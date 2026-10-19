-- 20300254003300_manager_waste_and_checklist_alerts.sql
-- Sistem Notifikasi Telegram untuk Area Manager (AM) dan Regional Manager (RM)
-- Tahap 2:
-- 1. Alert Pengajuan Waste Bahan Baku (ke AM pembina outlet, eskalasi ke RM jika > Rp 150.000)
-- 2. Notifikasi Ceklist Sidak AM Selesai (ke Telegram seluruh Regional Manager aktif)
-- 3. Notifikasi Ceklist Disetujui RM (ke Telegram Area Manager pengirim)

-- ─────────────────────────────────────────────────────────── 1. Alert Waste Bahan Baku
CREATE OR REPLACE FUNCTION public.bot_manager_alert_waste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_outlet_name text;
  v_bahan_nama text;
  v_bahan_satuan text;
  v_reporter_name text;
  v_harga numeric;
  v_est_kerugian numeric;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com/waste';
  v_am record;
  v_rm record;
BEGIN
  -- Hanya proses laporan yang berstatus PENDING
  IF NEW.status <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT nama, satuan INTO v_bahan_nama, v_bahan_satuan FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.reported_by;

  -- Hitung estimasi kerugian jika ada data harga beli
  SELECT harga_beli INTO v_harga 
  FROM public.bahan_baku_harga 
  WHERE bahan_baku_id = NEW.bahan_baku_id 
  ORDER BY created_at DESC LIMIT 1;

  IF v_harga IS NOT NULL AND v_harga > 0 THEN
    v_est_kerugian := NEW.qty * v_harga;
  ELSE
    v_est_kerugian := 0;
  END IF;

  v_title := CASE 
    WHEN v_est_kerugian > 150000 THEN '🚨 Alert Waste Bahan Bernilai Tinggi'
    ELSE '🗑️ Pengajuan Waste Bahan Baku'
  END;

  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || COALESCE(v_bahan_nama, 'Bahan Baku') || ' (' || NEW.qty || ' ' || COALESCE(v_bahan_satuan, 'satuan') || ')'
    || (CASE WHEN v_est_kerugian > 0 THEN E'\nEst. Kerugian: Rp ' || to_char(v_est_kerugian, 'FM999,999,999') ELSE '' END)
    || E'\nAlasan: ' || left(btrim(NEW.reason), 200)
    || E'\nPelapor: ' || COALESCE(v_reporter_name, 'Kru Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB';

  -- Kirim ke Area Manager (AM) pembina outlet
  FOR v_am IN
    SELECT so.staff_id 
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'waste:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Jika estimasi kerugian > Rp 150.000, eskalasi ke seluruh Regional Manager aktif
  IF v_est_kerugian > 150000 THEN
    FOR v_rm IN
      SELECT s.id AS staff_id
      FROM public.outlet_staff s
      WHERE s.role IN ('regional_manager', 'developer')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'waste_rm:' || NEW.id,
        v_rm.staff_id,
        '🚨 [ESKALASI REGIONAL] ' || v_title,
        v_body || E'\n\nPerhatian RM: Nilai waste melebihi ambang batas toleransi Rp 150.000.',
        v_url
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert waste manager: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_alert_waste ON public.stok_waste_reports;
CREATE TRIGGER trg_bot_manager_alert_waste
  AFTER INSERT ON public.stok_waste_reports
  FOR EACH ROW EXECUTE FUNCTION public.bot_manager_alert_waste();

-- ─────────────────────────────────────────────────────────── 2. Integrasi Ceklist Harian Sidak AM -> RM
-- Memperbarui pembantu push ceklist harian agar mengantrekan ke bot Telegram Manager
CREATE OR REPLACE FUNCTION public.ceklist_harian_kirim_push(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_role TEXT;
BEGIN
  -- 1. Jalur Telegram Bot Manager: kirim ke staf AM/RM jika akun Telegram tertaut
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = p_user_id;
  IF v_role IN ('regional_manager', 'area_manager', 'developer') THEN
    PERFORM public.bot_manager_antrekan(
      'ceklist:' || p_user_id || ':' || md5(p_title || p_body),
      p_user_id,
      p_title,
      p_body,
      'https://manager.sukashawarma.com'
    );
  END IF;

  -- 2. Jalur Push Notification Native (jika webhook vault sudah dikonfigurasi)
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'app', 'manager',
      'title', p_title,
      'body', p_body,
      'url', 'manager_ceklist'
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengirim push/telegram ceklist harian: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.ceklist_harian_kirim_push(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ceklist_harian_kirim_push(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.ceklist_harian_kirim_push(UUID, TEXT, TEXT) FROM authenticated;
