-- 20300254004700_ceo_bot_trigger_catalog_and_alerts.sql
-- Single Source of Truth Katalog Trigger Eksekutif Bot CEO (J.A.R.V.I.S.),
-- Outbox Alert Telegram CEO, dan Integrasi Otomatisasi Eskalasi Kritis.

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Registrasi Bot CEO ke hermes_bot_registry
INSERT INTO public.hermes_bot_registry (slug, nama) VALUES
  ('ceo', 'Bot CEO (J.A.R.V.I.S.)')
ON CONFLICT (slug) DO UPDATE
SET nama = EXCLUDED.nama;

-- ─────────────────────────────────────────────────────────── 2. Update Constraint Target Role di bot_trigger_catalog
ALTER TABLE public.bot_trigger_catalog DROP CONSTRAINT IF EXISTS bot_trigger_catalog_target_role_check;
ALTER TABLE public.bot_trigger_catalog ADD CONSTRAINT bot_trigger_catalog_target_role_check 
  CHECK (target_role IN ('regional_manager', 'area_manager', 'owner', 'admin', 'admin_hr', 'kitchen', 'purchasing', 'admin_finance', 'stokist'));

-- ─────────────────────────────────────────────────────────── 3. Outbox Table untuk Bot CEO
CREATE TABLE IF NOT EXISTS public.bot_ceo_alert_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint,
  attempted_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','delivered','skipped','failed')),
  UNIQUE (event_key, staff_id)
);

ALTER TABLE public.bot_ceo_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_ceo_alert_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bot_ceo_alert_outbox TO service_role;
CREATE INDEX IF NOT EXISTS idx_bot_ceo_alert_pending 
  ON public.bot_ceo_alert_outbox(created_at) WHERE outcome = 'pending';

-- ─────────────────────────────────────────────────────────── 4. Fungsi Antrekan Bot CEO (Push HP Native + Telegram)
CREATE OR REPLACE FUNCTION public.bot_ceo_antrekan(
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
DECLARE
  v_tg_url text;
BEGIN
  -- A. Jalur Notifikasi HP Native (SUKA Superapp)
  IF EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'developer')
  ) THEN
    PERFORM public.bot_kirim_push_hp(
      p_key,
      p_staff_id,
      'ceo',
      p_title,
      p_body,
      'bot'
    );
  END IF;

  -- B. Jalur Telegram Bot CEO (Pastikan HTTPS valid)
  v_tg_url := CASE
    WHEN p_url IS NULL OR btrim(p_url) = '' OR btrim(p_url) = 'bot' OR p_url NOT LIKE 'https://%'
      THEN 'https://agents.sukashawarma.com'
    ELSE btrim(p_url)
  END;

  INSERT INTO public.bot_ceo_alert_outbox(event_key, staff_id, title, body, url)
  SELECT p_key, s.id, left(p_title, 180), left(p_body, 1200), v_tg_url
  FROM public.outlet_staff s
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role IN ('owner', 'admin', 'developer')
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. Worker Pengiriman Antrean Bot CEO
CREATE OR REPLACE FUNCTION public.bot_ceo_kirim_antrean()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request bigint;
  r record;
  v_response record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-ceo-delivery')) THEN
    RETURN;
  END IF;

  -- Cari endpoint telegram_ceo_send_url, fallback ke manager/stokist
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_ceo_send_url' LIMIT 1;
  IF coalesce(v_url, '') = '' THEN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_manager_send_url' LIMIT 1;
    IF coalesce(v_url, '') <> '' THEN
      v_url := regexp_replace(v_url, '/api/telegram/manager/send.*', '/api/telegram/ceo/send');
    END IF;
  END IF;
  IF coalesce(v_url, '') = '' THEN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_url' LIMIT 1;
    IF coalesce(v_url, '') <> '' THEN
      v_url := regexp_replace(v_url, '/api/telegram/send.*', '/api/telegram/ceo/send');
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_ceo_send_secret' LIMIT 1;
  IF coalesce(v_secret, '') = '' THEN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_manager_send_secret' LIMIT 1;
  END IF;
  IF coalesce(v_secret, '') = '' THEN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_secret' LIMIT 1;
  END IF;

  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN;
  END IF;

  FOR r IN 
    SELECT * FROM public.bot_ceo_alert_outbox 
    WHERE outcome = 'pending'
      AND (attempts = 0 OR request_id IS NOT NULL OR attempted_at <= now() - interval '15 minutes')
    ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED 
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff s
      JOIN public.bot_telegram_links l ON l.staff_id = s.id
      WHERE s.id = r.staff_id 
        AND s.role IN ('owner', 'admin', 'developer') 
        AND s.status = 'active' 
        AND l.chat_id IS NOT NULL
    ) THEN
      UPDATE public.bot_ceo_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
      CONTINUE;
    END IF;

    IF r.request_id IS NOT NULL THEN
      SELECT status_code, content INTO v_response FROM net._http_response WHERE id = r.request_id;
      IF FOUND THEN
        IF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'delivered' = 'true' THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'delivered' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason' = 'not_eligible' THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
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

    IF r.attempted_at > now() - interval '15 minutes' THEN 
      CONTINUE; 
    END IF;

    BEGIN
      v_request := net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_secret
        ),
        body := jsonb_build_object(
          'user_id', r.staff_id,
          'title', r.title,
          'body', r.body,
          'url', r.url
        ),
        timeout_milliseconds := 15000
      );
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

REVOKE ALL ON FUNCTION public.bot_ceo_antrekan(text, uuid, text, text, text),
  public.bot_ceo_kirim_antrean() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bot_ceo_antrekan(text, uuid, text, text, text),
  public.bot_ceo_kirim_antrean() TO service_role;

-- ─────────────────────────────────────────────────────────── 6. Triggers Otomatis Eskalasi Kritis ke CEO

-- 6A. Void POS Kritis (>= Rp 50.000 atau beruntun >= 2x)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_void_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric := coalesce(NEW.total_amount, 0);
  v_void_count int := 1;
  v_outlet_name text;
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_ceo record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  SELECT count(*) INTO v_void_count
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib;

  IF v_amt >= 50000 OR v_void_count >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('void_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🛑 [ESKALASI CEO] Void Order Berisiko — ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Deteksi pembatalan order (VOID) bernilai besar / beruntun di kasir POS.\nOutlet: %s\nNilai Void: Rp %s\nFrekuensi Void Hari Ini: %sx di outlet ini\nWaktu: %s WIB\n\nNotifikasi eskalasi otomatis ke Owner & Manajemen.',
          coalesce(v_outlet_name, 'Outlet'),
          to_char(v_amt, 'FM999,999,999'),
          v_void_count::text,
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_void_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_void_alert ON public.orders;
CREATE TRIGGER trg_bot_ceo_void_alert
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.trg_fn_bot_ceo_void_alert();

-- 6B. Selisih Kas Kritis (> Rp 100.000)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_selisih_kas_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laci_var numeric;
  v_petty_var numeric;
  v_max_var numeric;
  v_outlet_name text;
  v_staff_name text;
  v_ceo record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  v_laci_var := COALESCE(NEW.variance, 0);
  v_petty_var := COALESCE(NEW.petty_cash_variance, 0);
  v_max_var := GREATEST(ABS(v_laci_var), ABS(v_petty_var));

  -- Ambang batas toleransi kasir ke CEO: selisih kas > Rp 100.000
  IF v_max_var > 100000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
    SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = COALESCE(NEW.closed_by, NEW.staff_id);

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('selisih_kas_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 [ALERT CEO] Selisih Kas Kritis (> Rp 100rb) — ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Selisih kas closing shift kasir melewati toleransi Rp 100.000.\nOutlet: %s\nKasir: %s\nSelisih Laci: %sRp %s%s\nWaktu Closing: %s WIB\nCatatan Kasir: %s\n\nAudit menyeluruh disarankan melalui Admin Dashboard.',
          coalesce(v_outlet_name, 'Outlet'),
          coalesce(v_staff_name, '-'),
          CASE WHEN v_laci_var >= 0 THEN '+' ELSE '' END,
          to_char(v_laci_var, 'FM999,999,999'),
          CASE WHEN NEW.petty_cash_variance IS NOT NULL THEN E'\nSelisih Petty Cash: ' || CASE WHEN v_petty_var >= 0 THEN '+' ELSE '' END || to_char(v_petty_var, 'FM999,999,999') ELSE '' END,
          to_char(COALESCE(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          coalesce(btrim(NEW.notes), '-')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_selisih_kas_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_selisih_kas_alert ON public.shifts;
CREATE TRIGGER trg_bot_ceo_selisih_kas_alert
  AFTER UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_selisih_kas_alert();

-- 6C. Waste Bahan Baku Kritis (> Rp 150.000)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_waste_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_harga numeric := 0;
  v_est_kerugian numeric := 0;
  v_outlet_name text;
  v_bahan_name text;
  v_ceo record;
BEGIN
  IF upper(coalesce(NEW.status, 'PENDING')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(h.harga_beli, 0), b.nama
  INTO v_harga, v_bahan_name
  FROM public.bahan_baku b
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
  WHERE b.id = NEW.bahan_baku_id;

  v_est_kerugian := coalesce(NEW.qty, 0) * coalesce(v_harga, 0);

  IF v_est_kerugian > 150000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('waste_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🥩 [ESKALASI WASTE > 150RB] ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Pengajuan waste bahan baku melebihi ambang batas toleransi Rp 150.000.\nOutlet: %s\nBahan: %s\nKuantiti: %s\nEstimasi Kerugian: Rp %s\nAlasan: %s\n\nNotifikasi eskalasi otomatis ke Direksi / Owner.',
          coalesce(v_outlet_name, 'Outlet'),
          coalesce(v_bahan_name, 'Bahan Baku'),
          NEW.qty::text,
          to_char(v_est_kerugian, 'FM999,999,999'),
          coalesce(NEW.reason, '-')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_waste_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_waste_alert ON public.stok_waste_reports;
CREATE TRIGGER trg_bot_ceo_waste_alert
  AFTER INSERT ON public.stok_waste_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_waste_alert();

-- 6D. Finalize Stock Opname Real-time
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_opname_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_out record;
  v_sudah text[] := '{}';
  v_draft text[] := '{}';
  v_belum text[] := '{}';
  v_sudah_count int;
  v_draft_count int;
  v_belum_count int;
  v_total int;
  v_body text;
  v_ceo record;
BEGIN
  IF NEW.status <> 'finalized' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;

  FOR v_out IN
    SELECT o.id, o.name,
           (
             SELECT op.status
             FROM public.opname op
             WHERE op.outlet_id = o.id
               AND op.tanggal = v_today
             ORDER BY (op.status = 'finalized') DESC, op.updated_at DESC NULLS LAST
             LIMIT 1
           ) AS opname_status
    FROM public.outlets o
    WHERE o.is_active IS TRUE
      AND lower(coalesce(o.type, 'internal')) NOT IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen', 'test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
    ORDER BY o.name
  LOOP
    IF v_out.id = NEW.outlet_id OR v_out.opname_status = 'finalized' THEN
      v_sudah := array_append(v_sudah, v_out.name);
    ELSIF v_out.opname_status = 'draft' THEN
      v_draft := array_append(v_draft, v_out.name);
    ELSE
      v_belum := array_append(v_belum, v_out.name);
    END IF;
  END LOOP;

  v_sudah_count := coalesce(cardinality(v_sudah), 0);
  v_draft_count := coalesce(cardinality(v_draft), 0);
  v_belum_count := coalesce(cardinality(v_belum), 0);
  v_total := v_sudah_count + v_draft_count + v_belum_count;

  v_body := format(
    E'Cabang %s baru saja melakukan Finalize Stock Opname (%s WIB).\nProgress Opname Seluruh Jaringan: %s / %s Cabang Selesai',
    coalesce(v_outlet_name, 'Outlet'),
    to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
    v_sudah_count::text,
    v_total::text
  )
  || (CASE WHEN v_sudah_count > 0 THEN E'\n\n✅ SUDAH OPNAME (' || v_sudah_count || E' Cabang):\n• ' || array_to_string(v_sudah, E'\n• ') ELSE '' END)
  || (CASE WHEN v_draft_count > 0 THEN E'\n\n⏳ MASIH DRAFT (' || v_draft_count || E' Cabang):\n• ' || array_to_string(v_draft, E'\n• ') ELSE '' END)
  || (CASE WHEN v_belum_count > 0 THEN E'\n\n🚨 BELUM OPNAME (' || v_belum_count || E' Cabang):\n• ' || array_to_string(v_belum, E'\n• ') ELSE E'\n\n🎉 Seluruh cabang operasional telah menyelesaikan Stock Opname hari ini!' END);

  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      format('opname_fin_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
      v_ceo.id,
      format('📦 [REKAP OPNAME] %s (%s/%s Selesai)', coalesce(v_outlet_name, 'Outlet'), v_sudah_count::text, v_total::text),
      v_body,
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_opname_finalized gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_opname_finalized ON public.opname;
CREATE TRIGGER trg_bot_ceo_opname_finalized
  AFTER INSERT OR UPDATE OF status ON public.opname
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_opname_finalized();

-- ─────────────────────────────────────────────────────────── 7. Pendaftaran 15 Trigger Bot CEO ke bot_trigger_catalog

-- Masukkan untuk target_role = 'owner'
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  ('tg_ceo_sales_kemarin_0400', 'owner', 'ceo',
   'Rekapitulasi & Ranking Penjualan Kemarin (04:00 WIB)',
   'Briefing eksekutif subuh berisi total gross omzet, perbandingan target harian, ranking performa seluruh cabang, dan ringkasan cabang tertinggal.',
   'Cron Subuh Harian (04:00 WIB)', false, true, 1, true),
  ('tg_ceo_marcom_0401', 'owner', 'ceo',
   'Ringkasan Kinerja Marketing & Promo Kemarin (04:01 WIB)',
   'Laporan penyerapan voucher diskon, promo aktif, perolehan pelanggan baru, dan efektivitas channel marcom kemarin.',
   'Cron Evaluasi Marcom (04:01 WIB)', false, true, 2, true),
  ('tg_ceo_absensi_hq_0830', 'owner', 'ceo',
   'Laporan Presensi Staf Kantor Pusat / HQ (08:30 WIB)',
   'Status kehadiran tim kantor pusat (Direksi, Finance, HRD, Purchasing, Marcom) pagi hari memuat staf hadir tepat waktu, izin, sakit, dan terlambat.',
   'Cron Presensi Pagi HQ (08:30 WIB)', false, true, 3, true),
  ('tg_ceo_absensi_outlet_1400', 'owner', 'ceo',
   'Laporan Presensi Kru Seluruh Outlet (14:00 WIB)',
   'Konsolidasi presensi seluruh kru dan leader cabang shift pagi & siang, mendeteksi outlet understaffed, kru alpa, dan pergantian shift.',
   'Cron Presensi Siang Cabang (14:00 WIB)', false, true, 4, true),
  ('tg_ceo_sales_sore_1600', 'owner', 'ceo',
   'Flash Report Penjualan Sore (16:00 WIB)',
   'Peringatan antara tengah hari berisi pencapaian omzet sore terhadap target, porsi terjual, dan cabang dengan pergerakan transaksi terendah.',
   'Cron Monitoring Sore (16:00 WIB)', false, true, 5, true),
  ('tg_ceo_zero_sales_1930', 'owner', 'ceo',
   'Eskalasi Cabang Masih Rp 0 Transaksi di Prime Time (19:30 WIB)',
   'Alert eskalasi ke CEO jika ada outlet yang sudah buka namun belum menghasilkan transaksi sama sekali saat memasuki jam sibuk malam.',
   'Cron Audit Omzet Malam (19:30 WIB)', false, true, 6, true),
  ('tg_ceo_sales_malam_2200', 'owner', 'ceo',
   'Laporan Penutupan & Omzet Final Harian (22:00 WIB)',
   'Rangkuman eksekutif final seluruh cabang: total omzet harian vs target bulanan, best performing outlet, total porsi, dan evaluasi harian.',
   'Cron Closing Harian (22:00 WIB)', false, true, 7, true),
  ('tg_ceo_opname_cutoff_2230', 'owner', 'ceo',
   'Eskalasi Cut-Off Stok Opname Malam (22:30 WIB)',
   'Rekapitulasi kepatuhan opname harian seluruh outlet sebelum tutup operasional, mendata cabang yang belum submit atau masih draft.',
   'Cron Cut-Off Opname Malam (22:30 WIB)', false, true, 8, true),
  ('tg_ceo_opname_finalized', 'owner', 'ceo',
   'Notifikasi Rekap Finalize Stok Opname Cabang',
   'Pemberitahuan real-time rekap cabang yang telah menyelesaikan opname fisik malam beserta persentase kepatuhan jaringan outlet.',
   'Trigger Finalize Opname (opname -> finalized)', true, true, 9, true),
  ('tg_ceo_void_eskalasi', 'owner', 'ceo',
   'Eskalasi Pembatalan / Void POS Berisiko Tinggi',
   'Peringatan instan real-time saat terjadi pembatalan pesanan POS bernilai >= Rp 50.000 atau terjadi pembatalan beruntun >= 2x di cabang yang sama.',
   'Trigger Void POS (orders -> cancelled >= 50k)', true, true, 10, true),
  ('tg_ceo_cash_var_eskalasi', 'owner', 'ceo',
   'Eskalasi Selisih Kas Kritis Closing Shift (> Rp 100.000)',
   'Notifikasi darurat real-time saat kasir menutup shift dengan selisih kas fisik laci atau petty cash melebihi ambang batas toleransi Rp 100.000.',
   'Trigger Closing Shift Kasir (> Rp 100rb)', true, true, 11, true),
  ('tg_ceo_late_open_eskalasi', 'owner', 'ceo',
   'Eskalasi Keterlambatan Buka Outlet (>= 30 Menit)',
   'Peringatan eskalasi jika cabang belum beroperasi (kasir belum buka & belum ada staf absen) setelah 30 menit dari jam buka resmi.',
   'Cron Jam Buka Outlet (>= 30 Menit)', false, true, 12, true),
  ('tg_ceo_waste_eskalasi', 'owner', 'ceo',
   'Eskalasi Pengajuan Waste Bahan Baku (> Rp 150.000)',
   'Alert real-time ke jajaran direksi saat cabang menginput laporan waste/kerusakan bahan baku dengan nilai estimasi kerugian di atas Rp 150.000.',
   'Trigger Laporan Waste (> Rp 150rb)', true, true, 13, true),
  ('tg_ceo_watchdog_2h', 'owner', 'ceo',
   'Heartbeat & Diagnostik Infrastruktur VPS / Supabase (Tiap 2 Jam)',
   'Laporan diagnostik berkala memeriksa ketersediaan database Supabase, latency API bot, antrean outbox, dan sisa kuota AI.',
   'Cron Watchdog (Tiap 2 Jam)', false, true, 14, true),
  ('tg_ceo_alert_down', 'owner', 'ceo',
   'Alert Darurat Kegagalan Server / Database Down',
   'Notifikasi instan jika server bot, cron background, atau koneksi Supabase mengalami kegagalan/timeout pada siklus audit 2 menit.',
   'Monitor Healthcheck (Tiap 2 Menit)', true, true, 15, true)
ON CONFLICT (id) DO UPDATE SET
  target_role = EXCLUDED.target_role,
  bot_slug = EXCLUDED.bot_slug,
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Masukkan juga salinan untuk target_role = 'admin' agar staf berposisi Admin juga dapat melihat katalog ini di SuperApp
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  ('tg_admin_sales_kemarin_0400', 'admin', 'ceo',
   'Rekapitulasi & Ranking Penjualan Kemarin (04:00 WIB)',
   'Briefing eksekutif subuh berisi total gross omzet, perbandingan target harian, ranking performa seluruh cabang, dan ringkasan cabang tertinggal.',
   'Cron Subuh Harian (04:00 WIB)', false, true, 1, true),
  ('tg_admin_marcom_0401', 'admin', 'ceo',
   'Ringkasan Kinerja Marketing & Promo Kemarin (04:01 WIB)',
   'Laporan penyerapan voucher diskon, promo aktif, perolehan pelanggan baru, dan efektivitas channel marcom kemarin.',
   'Cron Evaluasi Marcom (04:01 WIB)', false, true, 2, true),
  ('tg_admin_absensi_hq_0830', 'admin', 'ceo',
   'Laporan Presensi Staf Kantor Pusat / HQ (08:30 WIB)',
   'Status kehadiran tim kantor pusat (Direksi, Finance, HRD, Purchasing, Marcom) pagi hari memuat staf hadir tepat waktu, izin, sakit, dan terlambat.',
   'Cron Presensi Pagi HQ (08:30 WIB)', false, true, 3, true),
  ('tg_admin_absensi_outlet_1400', 'admin', 'ceo',
   'Laporan Presensi Kru Seluruh Outlet (14:00 WIB)',
   'Konsolidasi presensi seluruh kru dan leader cabang shift pagi & siang, mendeteksi outlet understaffed, kru alpa, dan pergantian shift.',
   'Cron Presensi Siang Cabang (14:00 WIB)', false, true, 4, true),
  ('tg_admin_sales_sore_1600', 'admin', 'ceo',
   'Flash Report Penjualan Sore (16:00 WIB)',
   'Peringatan antara tengah hari berisi pencapaian omzet sore terhadap target, porsi terjual, dan cabang dengan pergerakan transaksi terendah.',
   'Cron Monitoring Sore (16:00 WIB)', false, true, 5, true),
  ('tg_admin_zero_sales_1930', 'admin', 'ceo',
   'Eskalasi Cabang Masih Rp 0 Transaksi di Prime Time (19:30 WIB)',
   'Alert eskalasi ke CEO jika ada outlet yang sudah buka namun belum menghasilkan transaksi sama sekali saat memasuki jam sibuk malam.',
   'Cron Audit Omzet Malam (19:30 WIB)', false, true, 6, true),
  ('tg_admin_sales_malam_2200', 'admin', 'ceo',
   'Laporan Penutupan & Omzet Final Harian (22:00 WIB)',
   'Rangkuman eksekutif final seluruh cabang: total omzet harian vs target bulanan, best performing outlet, total porsi, dan evaluasi harian.',
   'Cron Closing Harian (22:00 WIB)', false, true, 7, true),
  ('tg_admin_opname_cutoff_2230', 'admin', 'ceo',
   'Eskalasi Cut-Off Stok Opname Malam (22:30 WIB)',
   'Rekapitulasi kepatuhan opname harian seluruh outlet sebelum tutup operasional, mendata cabang yang belum submit atau masih draft.',
   'Cron Cut-Off Opname Malam (22:30 WIB)', false, true, 8, true),
  ('tg_admin_opname_finalized', 'admin', 'ceo',
   'Notifikasi Rekap Finalize Stok Opname Cabang',
   'Pemberitahuan real-time rekap cabang yang telah menyelesaikan opname fisik malam beserta persentase kepatuhan jaringan outlet.',
   'Trigger Finalize Opname (opname -> finalized)', true, true, 9, true),
  ('tg_admin_void_eskalasi', 'admin', 'ceo',
   'Eskalasi Pembatalan / Void POS Berisiko Tinggi',
   'Peringatan instan real-time saat terjadi pembatalan pesanan POS bernilai >= Rp 50.000 atau terjadi pembatalan beruntun >= 2x di cabang yang sama.',
   'Trigger Void POS (orders -> cancelled >= 50k)', true, true, 10, true),
  ('tg_admin_cash_var_eskalasi', 'admin', 'ceo',
   'Eskalasi Selisih Kas Kritis Closing Shift (> Rp 100.000)',
   'Notifikasi darurat real-time saat kasir menutup shift dengan selisih kas fisik laci atau petty cash melebihi ambang batas toleransi Rp 100.000.',
   'Trigger Closing Shift Kasir (> Rp 100rb)', true, true, 11, true),
  ('tg_admin_late_open_eskalasi', 'admin', 'ceo',
   'Eskalasi Keterlambatan Buka Outlet (>= 30 Menit)',
   'Peringatan eskalasi jika cabang belum beroperasi (kasir belum buka & belum ada staf absen) setelah 30 menit dari jam buka resmi.',
   'Cron Jam Buka Outlet (>= 30 Menit)', false, true, 12, true),
  ('tg_admin_waste_eskalasi', 'admin', 'ceo',
   'Eskalasi Pengajuan Waste Bahan Baku (> Rp 150.000)',
   'Alert real-time ke jajaran direksi saat cabang menginput laporan waste/kerusakan bahan baku dengan nilai estimasi kerugian di atas Rp 150.000.',
   'Trigger Laporan Waste (> Rp 150rb)', true, true, 13, true),
  ('tg_admin_watchdog_2h', 'admin', 'ceo',
   'Heartbeat & Diagnostik Infrastruktur VPS / Supabase (Tiap 2 Jam)',
   'Laporan diagnostik berkala memeriksa ketersediaan database Supabase, latency API bot, antrean outbox, dan sisa kuota AI.',
   'Cron Watchdog (Tiap 2 Jam)', false, true, 14, true),
  ('tg_admin_alert_down', 'admin', 'ceo',
   'Alert Darurat Kegagalan Server / Database Down',
   'Notifikasi instan jika server bot, cron background, atau koneksi Supabase mengalami kegagalan/timeout pada siklus audit 2 menit.',
   'Monitor Healthcheck (Tiap 2 Menit)', true, true, 15, true)
ON CONFLICT (id) DO UPDATE SET
  target_role = EXCLUDED.target_role,
  bot_slug = EXCLUDED.bot_slug,
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
