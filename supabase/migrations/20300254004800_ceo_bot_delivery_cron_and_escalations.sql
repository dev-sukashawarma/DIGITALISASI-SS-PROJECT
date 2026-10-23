-- 20300254004800_ceo_bot_delivery_cron_and_escalations.sql
-- 1. Penjadwalan pg_cron Worker Pengiriman Outbox Bot CEO (Tiap 1 Menit)
-- 2. Integrasi Eskalasi Telat Buka (>= 30m) & Zero Sales Malam (19:30) ke Bot CEO
-- 3. Fungsi Uji Coba Alert Real-Time (bot_ceo_kirim_test_alert)

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Penjadwalan pg_cron bot-ceo-delivery
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('bot-ceo-delivery') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-delivery'
    );
    PERFORM cron.schedule(
      'bot-ceo-delivery',
      '* * * * *',
      'SELECT public.bot_ceo_kirim_antrean();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Pendaftaran pg_cron bot-ceo-delivery dilewati: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────── 2. Update Cron Zero Sales (19:30 WIB) Eskalasi ke CEO
CREATE OR REPLACE FUNCTION public.bot_manager_cek_zero_sales_dan_sj_gantung()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_tgl_wib date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_out record;
  v_sj record;
  v_am record;
  v_rm record;
  v_ceo record;
BEGIN
  -- A. Alert Cabang Rp 0 Transaksi
  IF v_jam >= 17 THEN
    FOR v_out IN
      SELECT o.id, o.name
      FROM public.outlets o
      WHERE o.is_active = true
        AND lower(coalesce(o.type, 'internal')) NOT IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen', 'test', 'marketplace', 'system')
        AND upper(o.name) NOT LIKE '%GUDANG%'
        AND upper(o.name) NOT LIKE '%KANTOR%'
        AND upper(o.name) NOT LIKE '%OFFICE%'
        AND NOT EXISTS (
          SELECT 1 FROM public.orders ord
          WHERE ord.outlet_id = o.id
            AND ord.status <> 'cancelled'
            AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib
        )
    LOOP
      -- 1. Kirim ke AM pembina cabang (mulai 17:00 WIB)
      FOR v_am IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        JOIN public.staff_outlets so ON so.staff_id = s.id
        WHERE so.outlet_id = v_out.id
          AND s.role = 'area_manager'
          AND s.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          format('zero17_am:%s:%s', v_tgl_wib::text, v_out.id::text),
          v_am.id,
          '🚨 [CABANG RP 0 TRANSAKSI] ' || v_out.name,
          format(
            E'Peringatan Sore (17:00 WIB): Outlet binaan sudah melewati jam buka namun belum mencatat 1 pun transaksi POS hari ini.\nOutlet: %s\nWaktu Cek: %s WIB\n\nSegera cek apakah kasir kendala perangkat/internet atau transaksi belum diinput ke POS.',
            v_out.name,
            to_char(v_now_wib, 'HH24:MI')
          ),
          'bot'
        );
      END LOOP;

      -- 2. Jika sudah >= 19:30 WIB (Prime Time Malam), eskalasi ke RM dan CEO
      IF v_jam > 19 OR (v_jam = 19 AND extract(minute FROM v_now_wib) >= 30) THEN
        -- Eskalasi ke RM
        FOR v_rm IN
          SELECT id FROM public.outlet_staff
          WHERE role IN ('regional_manager', 'developer')
            AND status = 'active'
        LOOP
          PERFORM public.bot_manager_antrekan(
            format('zero1930_rm:%s:%s', v_tgl_wib::text, v_out.id::text),
            v_rm.id,
            '🚨 [ESKALASI RM] Cabang Masih Rp 0 Transaksi — ' || v_out.name,
            format(
              E'Eskalasi Malam (Prime Time): Outlet masih belum mencatat transaksi POS hingga pukul %s WIB.\nOutlet: %s\nStatus: Rp 0 (0 Order)\n\nMohon instruksikan Area Manager terkait untuk audit langsung operasional cabang.',
              to_char(v_now_wib, 'HH24:MI'),
              v_out.name
            ),
            'bot'
          );
        END LOOP;

        -- Eskalasi ke Bot CEO (Owner & Admin)
        FOR v_ceo IN
          SELECT id FROM public.outlet_staff
          WHERE role IN ('owner', 'admin', 'developer')
            AND status = 'active'
        LOOP
          PERFORM public.bot_ceo_antrekan(
            format('zero1930_ceo:%s:%s', v_tgl_wib::text, v_out.id::text),
            v_ceo.id,
            '🚨 [ALERT CEO] Cabang Rp 0 Transaksi di Prime Time — ' || v_out.name,
            format(
              E'Eskalasi Malam (Prime Time): Outlet belum mencatat transaksi POS hingga pukul %s WIB.\nOutlet: %s\nStatus: Rp 0 (0 Order)\n\nMohon atensi manajemen untuk audit operasional cabang.',
              to_char(v_now_wib, 'HH24:MI'),
              v_out.name
            ),
            'https://admin.sukashawarma.com'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- B. Alert Surat Jalan Menggantung > 2 Jam Belum Diverifikasi Cabang (AM)
  FOR v_sj IN
    SELECT sj.id,
           coalesce(sj.document_number, substr(sj.id::text, 1, 8)) AS doc_no,
           sj.outlet_id,
           coalesce(o.name, 'Cabang SS') AS outlet_name,
           round(extract(epoch FROM (now() - coalesce(sj.updated_at, sj.created_at))) / 3600.0, 1) AS jam_gantung
    FROM public.surat_jalan sj
    JOIN public.outlets o ON o.id = sj.outlet_id
    WHERE sj.status = 'dikirim'
      AND coalesce(sj.updated_at, sj.created_at) < (now() - interval '2 hours')
      AND o.is_active = true
  LOOP
    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = v_sj.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj2h_am:%s:%s', v_sj.id::text, to_char(v_now_wib, 'YYYY-MM-DD-HH24')),
        v_am.id,
        '📦 [SURAT JALAN MENGGANTUNG > 2 JAM] No: ' || v_sj.doc_no,
        format(
          E'Pengiriman bahan baku ke cabang binaan Anda belum dikonfirmasi terima oleh outlet.\nNo SJ: %s\nTujuan: %s\nDurasi di Jalan: %s jam\n\nMohon ingatkan tim outlet untuk segera memverifikasi penerimaan fisik barang.',
          v_sj.doc_no,
          v_sj.outlet_name,
          v_sj.jam_gantung::text
        ),
        'bot'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 3. Update Cron Telat Buka (>= 30 Menit) Eskalasi ke CEO
CREATE OR REPLACE FUNCTION public.bot_manager_cek_outlet_telat_buka()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_now_time time := (now() AT TIME ZONE 'Asia/Jakarta')::time;
  r record;
  v_am record;
  v_rm record;
  v_ceo record;
  v_is_late boolean;
  v_is_late_30m boolean;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-manager-telat-buka')) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT 
      o.id,
      o.name,
      COALESCE(s.jam_masuk, c.jam_masuk, '10:00:00'::time) AS jam_buka
    FROM public.outlets o
    LEFT JOIN public.outlet_attendance_shift s ON s.outlet_id = o.id AND s.urutan = 1
    LEFT JOIN public.outlet_attendance_config c ON c.outlet_id = o.id
    WHERE o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
  LOOP
    -- Cek jendela waktu: sudah lewat jam buka + 5 menit dan belum lewat jam buka + 3 jam
    v_is_late := (v_now_time >= (r.jam_buka + interval '5 minutes'))
             AND (v_now_time <= (r.jam_buka + interval '3 hours'));
             
    IF NOT v_is_late THEN
      CONTINUE;
    END IF;

    -- Periksa apakah outlet sudah buka shift kasir hari ini
    IF EXISTS (
      SELECT 1 FROM public.shifts sh
      WHERE sh.outlet_id = r.id
        AND (sh.start_time AT TIME ZONE 'Asia/Jakarta')::date = v_today
    ) THEN
      CONTINUE;
    END IF;

    -- Periksa apakah kru sudah ada yang absen masuk (clock-in) hari ini
    IF EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.outlet_id = r.id
        AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date = v_today
        AND a.status != 'alpha'
    ) THEN
      CONTINUE;
    END IF;

    -- Jika sampai di sini, outlet belum buka shift dan belum ada kru absen (+5 menit lewat jam buka)
    v_body := 'Outlet: ' || r.name
      || E'\nJam Buka Jadwal: ' || to_char(r.jam_buka, 'HH24:MI') || ' WIB'
      || E'\nStatus: Belum open shift kasir & belum ada absensi kru.'
      || E'\nWaktu Deteksi: ' || to_char(v_now_time, 'HH24:MI') || ' WIB'
      || E'\n\nSegera hubungi kru outlet untuk konfirmasi kendala operasional cabang!';

    -- Kirim alert ke Area Manager (AM) binaan
    FOR v_am IN
      SELECT so.staff_id
      FROM public.staff_outlets so
      JOIN public.outlet_staff st ON st.id = so.staff_id
      WHERE so.outlet_id = r.id
        AND st.role = 'area_manager'
        AND st.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'telat_buka:' || r.id || ':' || v_today,
        v_am.staff_id,
        '🚨 ALERT: OUTLET TELAT BUKA (+5 Menit)',
        v_body,
        v_url
      );
    END LOOP;

    -- Eskalasi ke Regional Manager dan Bot CEO jika sudah telat >= 30 menit
    v_is_late_30m := (v_now_time >= (r.jam_buka + interval '30 minutes'));
    IF v_is_late_30m THEN
      FOR v_rm IN
        SELECT st.id AS staff_id
        FROM public.outlet_staff st
        WHERE st.role IN ('regional_manager', 'developer')
          AND st.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          'telat_buka_rm:' || r.id || ':' || v_today,
          v_rm.staff_id,
          '🚨 [ESKALASI RM] OUTLET TELAT BUKA (>= 30 Menit)',
          v_body || E'\n\nPerhatian RM: Outlet belum beroperasi setelah 30 menit dari jam buka!',
          v_url
        );
      END LOOP;

      FOR v_ceo IN
        SELECT st.id AS staff_id
        FROM public.outlet_staff st
        WHERE st.role IN ('owner', 'admin', 'developer')
          AND st.status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          'telat_buka_ceo:' || r.id || ':' || v_today,
          v_ceo.staff_id,
          '🚨 [ESKALASI CEO] OUTLET TELAT BUKA (>= 30 Menit) — ' || r.name,
          v_body || E'\n\nPerhatian Direksi: Outlet belum buka kasir & belum ada absensi kru setelah >= 30 menit.',
          'https://admin.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 4. Fungsi Tes Instan Pengiriman Alert Bot CEO
CREATE OR REPLACE FUNCTION public.bot_ceo_kirim_test_alert(
  p_title text DEFAULT '⚡ TEST ALERT BOT CEO (J.A.R.V.I.S.)',
  p_body text DEFAULT 'Pesan uji coba pengiriman notifikasi instan real-time ke Telegram Bot CEO dan Push HP SuperApp berhasil diproses!'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_ceo record;
  v_outbox_rows jsonb;
BEGIN
  FOR v_ceo IN
    SELECT s.id, s.name, s.role, l.chat_id
    FROM public.outlet_staff s
    JOIN public.bot_telegram_links l ON l.staff_id = s.id
    WHERE s.role IN ('owner', 'admin', 'developer')
      AND s.status = 'active'
      AND l.chat_id IS NOT NULL
  LOOP
    PERFORM public.bot_ceo_antrekan(
      'test_ceo:' || gen_random_uuid()::text,
      v_ceo.id,
      p_title,
      p_body,
      'https://agents.sukashawarma.com'
    );
    v_count := v_count + 1;
  END LOOP;

  -- Segera picu pengiriman worker
  PERFORM public.bot_ceo_kirim_antrean();

  -- Cek status baris di outbox
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', title,
    'outcome', outcome,
    'attempts', attempts,
    'attempted_at', attempted_at
  )), '[]'::jsonb)
  INTO v_outbox_rows
  FROM public.bot_ceo_alert_outbox
  WHERE event_key LIKE 'test_ceo:%'
  ORDER BY created_at DESC
  LIMIT 5;

  RETURN jsonb_build_object(
    'ok', true,
    'target_terdaftar', v_count,
    'outbox_terbaru', v_outbox_rows,
    'pesan', CASE
      WHEN v_count = 0 THEN 'Peringatan: Belum ada staf ber-role owner/admin/developer yang tertaut Telegram di tabel bot_telegram_links.'
      ELSE format('Berhasil mengantrekan alert ke %s penerima dan menjalankan worker kirim.', v_count)
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bot_ceo_kirim_test_alert(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bot_ceo_kirim_test_alert(text, text) TO authenticated, service_role;
