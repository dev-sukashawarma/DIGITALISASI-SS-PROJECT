-- Migration: 20300254005600_align_all_triggers_with_webapp_logic.sql
-- Description: Penyelarasan Menyeluruh Seluruh Trigger & Cron Bot dengan Logika Kanonikal WebApp:
-- 1. Helper kanonikal public.bot_is_sales_outlet(uuid) sesuai apps/admin-dashboard & apps/manager (isExcludedOutlet & isTestOutlet)
--    - Mengeliminasi SS BACKUP, outlet tes, trial, demo, gudang, kantor pusat, marketplace (Shopee, TikTok) dari seluruh perhitungan ritel.
-- 2. Helper kanonikal public.bot_is_outlet_tutup_sementara(uuid) sesuai apps/admin-dashboard (statusOutlet / outlet_tutup_sementara).
-- 3. Jam Operasional Kanonikal:
--    - bot_manager_cek_outlet_telat_buka: Menggunakan COALESCE(o.open_hour, '14:00:00'::time) dan memeriksa status outlet_tutup_sementara.
-- 4. Audit & Penyelarasan Trigger/Cron Lain:
--    - bot_manager_cek_zero_sales_dan_sj_gantung: Mengeliminasi false alarm SS BACKUP Rp 0 dan membatasi Surat Jalan aktif <= 48 jam agar SJ lama outlet tes tidak memicu alert CEO.
--    - bot_manager_cek_status_opname_harian: Mengeliminasi SS BACKUP dari daftar "Belum Opname" dan total cabang regional (tepat 21 cabang ritel aktif).
--    - bot_ceo_cek_opname_terlambat_malam: Mengeliminasi false alarm SS BACKUP pada jam 23:15 WIB ke Bot CEO.
--    - trg_fn_bot_ceo_opname_finalized & trg_fn_bot_manager_opname_finalized: Rekap progress opname menggunakan bot_is_sales_outlet.
--    - bot_ceo_cek_unclosed_shifts: Hanya mengevaluasi shift pada outlet penjualan riil.
--    - bot_manager_broadcast_omzet: Agregat omzet AM & RM selaras 100% dengan angka dashboard webapp.
--    - opname_pengingat_kandidat: Mengeliminasi SS BACKUP, Kantor Pusat, dan Gudang dari daftar overdue opname.

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Helper Kanonikal: bot_is_sales_outlet
CREATE OR REPLACE FUNCTION public.bot_is_sales_outlet(p_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.outlets o
    WHERE o.id = p_outlet_id
      AND o.is_active IS TRUE
      AND o.id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'office', 'gudang', 'warehouse', 'kitchen', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
      AND o.name NOT ILIKE '%backup%'
      AND o.name NOT ILIKE '%tes%'
      AND o.name NOT ILIKE '%trial%'
      AND o.name NOT ILIKE '%demo%'
      AND o.name NOT ILIKE '%global%'
      AND o.name NOT ILIKE '%shopee%'
      AND o.name NOT ILIKE '%tiktok%'
      AND COALESCE(o.slug, '') NOT IN ('ss-backup', 'outlet-tes', 'shopee', 'tiktok-shop', 'global-system-outlet', 'kantor-pusat', 'suka-shawarma-hq', 'gudang-ss-online')
  );
$$;

-- ─────────────────────────────────────────────────────────── 2. Helper Kanonikal: bot_is_outlet_tutup_sementara
CREATE OR REPLACE FUNCTION public.bot_is_outlet_tutup_sementara(p_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.outlet_tutup_sementara ts
    WHERE ts.outlet_id = p_outlet_id
      AND ts.sampai > now()
      AND ts.dicabut_pada IS NULL
  );
$$;

-- ─────────────────────────────────────────────────────────── 3. bot_manager_cek_outlet_telat_buka
CREATE OR REPLACE FUNCTION public.bot_manager_cek_outlet_telat_buka()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      COALESCE(o.open_hour, '14:00:00'::time) AS jam_buka
    FROM public.outlets o
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
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

    -- Outlet belum buka shift dan belum ada kru absen (+5 menit lewat jam buka)
    v_body := 'Outlet: ' || r.name
      || E'\nJam Buka Jadwal: ' || to_char(r.jam_buka, 'HH24:MI') || ' WIB'
      || E'\nStatus: Belum open shift kasir & belum ada absensi kru.'
      || E'\nWaktu Deteksi: ' || to_char(v_now_time, 'HH24:MI') || ' WIB'
      || E'\n\nSegera hubungi kru outlet untuk konfirmasi kendala operasional cabang!';

    -- A. Kirim alert ke Area Manager (AM) binaan (+5 Menit)
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

    -- B. Eskalasi ke Regional Manager jika sudah telat >= 30 menit
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
          '🚨 [ESKALASI RM] OUTLET TELAT BUKA > 30 MENIT',
          'Perhatian RM: Outlet belum beroperasi setelah 30 menit dari jadwal.'
            || E'\n' || v_body,
          v_url
        );
      END LOOP;

      -- C. Eskalasi ke Bot CEO (Owner / Admin / Developer) jika sudah telat >= 30 menit
      FOR v_ceo IN
        SELECT st.id AS staff_id
        FROM public.outlet_staff st
        WHERE st.role IN ('owner', 'admin', 'developer')
          AND st.status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          'telat_buka_ceo:' || r.id || ':' || v_today,
          v_ceo.id,
          '🚨 [ESKALASI CEO] OUTLET TELAT BUKA > 30 MENIT — ' || r.name,
          'Peringatan Eksekutif: Cabang belum beroperasi setelah 30 menit dari jam buka resmi.'
            || E'\nOutlet: ' || r.name
            || E'\nJadwal Buka: ' || to_char(r.jam_buka, 'HH24:MI') || ' WIB'
            || E'\nWaktu Deteksi: ' || to_char(v_now_time, 'HH24:MI') || ' WIB'
            || E'\nStatus: Kasir belum buka shift & belum ada kru absen.'
            || E'\n\nNotifikasi otomatis diteruskan ke jajaran Direksi.',
          'https://admin.sukashawarma.com'
        );
      END LOOP;
    END IF;

  END LOOP;
END;
$function$;

-- ─────────────────────────────────────────────────────────── 4. bot_manager_cek_zero_sales_dan_sj_gantung
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
      WHERE public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
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

  -- B. Alert Surat Jalan Menggantung > 2 Jam Belum Diverifikasi Cabang
  -- Filter ketat: Hanya outlet penjualan riil dan dalam rentang 48 jam aktif (mencegah data tes lawas memicu alarm)
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
      AND coalesce(sj.updated_at, sj.created_at) >= (now() - interval '48 hours')
      AND public.bot_is_sales_outlet(o.id)
  LOOP
    -- 1. Kirim ke Area Manager (mulai 2 jam)
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

    -- 2. Eskalasi ke Bot CEO jika menggantung >= 3.5 jam ATAU sudah malam hari (>= 22:00 WIB)
    IF v_sj.jam_gantung >= 3.5 OR v_jam >= 22 THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('sjgantung_ceo:%s:%s', v_sj.id::text, to_char(v_now_wib, 'YYYY-MM-DD-HH24')),
          v_ceo.id,
          '📦 [DISTRIBUSI WARNING] Surat Jalan CK Menggantung (' || v_sj.jam_gantung || ' Jam) — ' || v_sj.outlet_name,
          format(
            E'Pengiriman bahan baku Central Kitchen belum dikonfirmasi terima oleh outlet.\nNo. SJ: %s\nTujuan: %s\nDurasi Pengiriman: %s Jam (Status: Dikirim)\nWaktu Cek: %s WIB\n\nPerhatian Direksi: Uang barang inventory mengambang. Berisiko mengacaukan stok opname malam cabang.',
            v_sj.doc_no,
            v_sj.outlet_name,
            v_sj.jam_gantung::text,
            to_char(v_now_wib, 'HH24:MI')
          ),
          'https://admin.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. bot_manager_cek_status_opname_harian
CREATE OR REPLACE FUNCTION public.bot_manager_cek_status_opname_harian(p_is_cutoff boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_am record;
  v_rm record;
  v_outlet record;
  v_sudah text[];
  v_draft text[];
  v_belum text[];
  v_sudah_count int;
  v_draft_count int;
  v_belum_count int;
  v_total int;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
  v_reg_belum_count int := 0;
  v_reg_total_count int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-manager-opname-monitor-' || p_is_cutoff::text)) THEN
    RETURN;
  END IF;

  -- Loop setiap Area Manager aktif
  FOR v_am IN
    SELECT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager' AND s.status = 'active'
  LOOP
    v_sudah := '{}';
    v_draft := '{}';
    v_belum := '{}';

    -- Evaluasi status opname untuk seluruh outlet binaan AM ini (hanya outlet penjualan riil aktif)
    FOR v_outlet IN
      SELECT o.id, o.name, op.status AS opname_status
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      LEFT JOIN public.opname op 
        ON op.outlet_id = o.id 
       AND op.tanggal = v_today 
       AND op.tipe = 'harian'
      WHERE so.staff_id = v_am.id
        AND public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
      ORDER BY o.name
    LOOP
      IF v_outlet.opname_status = 'finalized' THEN
        v_sudah := array_append(v_sudah, v_outlet.name);
      ELSIF v_outlet.opname_status = 'draft' THEN
        v_draft := array_append(v_draft, v_outlet.name);
      ELSE
        v_belum := array_append(v_belum, v_outlet.name);
      END IF;
    END LOOP;

    v_sudah_count := COALESCE(cardinality(v_sudah), 0);
    v_draft_count := COALESCE(cardinality(v_draft), 0);
    v_belum_count := COALESCE(cardinality(v_belum), 0);
    v_total := v_sudah_count + v_draft_count + v_belum_count;

    IF v_total = 0 THEN
      CONTINUE;
    END IF;

    -- Saat cut-off final (22:30), hanya kirim alert jika masih ada outlet yang belum finalized
    IF p_is_cutoff AND (v_draft_count + v_belum_count) = 0 THEN
      CONTINUE;
    END IF;

    v_title := CASE 
      WHEN p_is_cutoff THEN '🚨 [CUT-OFF OPNAME 22:30] Ringkasan Status Harian'
      ELSE '📋 [MONITORING OPNAME 21:30] Progress Harian Area'
    END;

    v_body := 'Area: ' || v_am.name
      || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
      || E'\nProgress Opname: ' || v_sudah_count || ' dari ' || v_total || ' Cabang Selesai'
      || (CASE WHEN v_sudah_count > 0 THEN E'\n\n✅ SUDAH OPNAME (' || v_sudah_count || E' Cabang):\n• ' || array_to_string(v_sudah, E'\n• ') ELSE '' END)
      || (CASE WHEN v_draft_count > 0 THEN E'\n\n⏳ MASIH DRAFT (' || v_draft_count || E' Cabang):\n• ' || array_to_string(v_draft, E'\n• ') ELSE '' END)
      || (CASE WHEN v_belum_count > 0 THEN E'\n\n🚨 BELUM OPNAME (' || v_belum_count || E' Cabang):\n• ' || array_to_string(v_belum, E'\n• ') ELSE E'\n\n🎉 Luar biasa! Seluruh cabang di area binaan Anda sudah menyelesaikan Stock Opname.' END);

    PERFORM public.bot_manager_antrekan(
      'opname_mon:' || v_am.id || ':' || v_today || (CASE WHEN p_is_cutoff THEN ':cutoff' ELSE ':digest' END),
      v_am.id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Evaluasi Ringkasan Regional untuk RM saat Cut-off (22:30 WIB)
  IF p_is_cutoff THEN
    SELECT 
      count(*) FILTER (WHERE op.id IS NULL OR op.status <> 'finalized'),
      count(*)
    INTO v_reg_belum_count, v_reg_total_count
    FROM public.outlets o
    LEFT JOIN public.opname op 
      ON op.outlet_id = o.id 
     AND op.tanggal = v_today 
     AND op.tipe = 'harian'
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id);

    IF v_reg_belum_count > 0 THEN
      FOR v_rm IN
        SELECT s.id, s.name
        FROM public.outlet_staff s
        WHERE s.role IN ('regional_manager', 'developer') AND s.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          'opname_rm_cutoff:' || v_rm.id || ':' || v_today,
          v_rm.id,
          '🚨 [ESKALASI RM] REKAP CUT-OFF OPNAME BELUM LENGKAP',
          'Tanggal: ' || to_char(v_today, 'DD-MM-YYYY')
            || E'\nStatus Cut-off: ' || v_reg_belum_count || ' dari ' || v_reg_total_count || ' cabang belum menyelesaikan opname fisik.'
            || E'\n\nMohon lakukan peneguran kepada Area Manager terkait agar opname diselesaikan sebelum pergantian hari.',
          v_url
        );
      END LOOP;
    END IF;
  END IF;

END;
$$;

-- ─────────────────────────────────────────────────────────── 6. bot_ceo_cek_opname_terlambat_malam
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_opname_terlambat_malam()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_out record;
  v_belum text[] := '{}';
  v_belum_count int := 0;
  v_ceo record;
BEGIN
  FOR v_out IN
    SELECT o.id, o.name
    FROM public.outlets o
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.opname op
        WHERE op.outlet_id = o.id
          AND op.tanggal = v_today
          AND op.status = 'finalized'
      )
    ORDER BY o.name
  LOOP
    v_belum := array_append(v_belum, v_out.name);
  END LOOP;

  v_belum_count := coalesce(cardinality(v_belum), 0);

  IF v_belum_count > 0 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('opname_missing_ceo:%s', v_today::text),
        v_ceo.id,
        format('⚠️ [STOK WARNING] %s Cabang Belum Finalisasi Opname (23:15 WIB)', v_belum_count::text),
        format(
          E'Peringatan Cut-off Malam: Masih terdapat cabang yang belum menyelesaikan & memfinalisasi Stok Opname harian.\nTanggal: %s\nCabang Belum Selesai (%s Outlet):\n• %s\n\nPerhatian Direksi: Opname yang tertunda berisiko mengaburkan akurasi inventori dan menutupi potensi selisih stok.',
          to_char(v_today, 'DD-MM-YYYY'),
          v_belum_count::text,
          array_to_string(v_belum, E'\n• ')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────── 7. trg_fn_bot_ceo_opname_finalized
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_opname_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_today date := coalesce(NEW.tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
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

  -- Hanya proses jika outlet adalah cabang ritel resmi
  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
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
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
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
    E'Cabang %s baru saja menyelesaikan & mem-finalisasi Stock Opname Harian (Tanggal: %s).\n\nProgress Jaringan: %s / %s Cabang Selesai\n\n✅ SUDAH OPNAME (%s Cabang):\n%s',
    coalesce(v_outlet_name, 'Outlet'),
    to_char(v_today, 'DD-MM-YYYY'),
    v_sudah_count,
    v_total,
    v_sudah_count,
    CASE WHEN v_sudah_count > 0 THEN '• ' || array_to_string(v_sudah, E'\n• ') ELSE '-' END
  );

  IF v_draft_count > 0 THEN
    v_body := v_body || format(E'\n\n⏳ DRAFT BELUM SELESAI (%s Cabang):\n%s', v_draft_count, '• ' || array_to_string(v_draft, E'\n• '));
  END IF;

  IF v_belum_count > 0 THEN
    v_body := v_body || format(E'\n\n🚨 BELUM OPNAME (%s Cabang):\n%s', v_belum_count, '• ' || array_to_string(v_belum, E'\n• '));
  END IF;

  v_body := v_body || E'\n\nWaktu Finalisasi: ' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB';

  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      format('opname_ceo:%s:%s:%s', NEW.id::text, v_today::text, v_ceo.id::text),
      v_ceo.id,
      format('📦 [OPNAME FINALIZED] %s (%s/%s Cabang Selesai)', coalesce(v_outlet_name, 'Outlet'), v_sudah_count, v_total),
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

-- ─────────────────────────────────────────────────────────── 8. trg_fn_bot_manager_opname_finalized
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_opname_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := coalesce(NEW.tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_outlet_name text;
  v_am record;
  v_out record;
  v_sudah text[];
  v_draft text[];
  v_belum text[];
  v_sudah_count int;
  v_draft_count int;
  v_belum_count int;
  v_total int;
  v_body text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalized' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'finalized' THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  -- Kirim Notifikasi Real-time ke Area Manager pembina cabang ini
  FOR v_am IN
    SELECT DISTINCT s.id, s.name
    FROM public.outlet_staff s
    JOIN public.staff_outlets so ON so.staff_id = s.id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    v_sudah := '{}';
    v_draft := '{}';
    v_belum := '{}';

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
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      WHERE so.staff_id = v_am.id
        AND public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
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
      E'Cabang %s baru saja melakukan Finalize Stock Opname (%s WIB).\nArea: %s\nProgress Opname Hari Ini: %s / %s Cabang Selesai',
      v_outlet_name,
      to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
      coalesce(v_am.name, 'Area Manager'),
      v_sudah_count::text,
      v_total::text
    )
    || (CASE WHEN v_sudah_count > 0 THEN E'\n\n✅ SUDAH OPNAME (' || v_sudah_count || E' Cabang):\n• ' || array_to_string(v_sudah, E'\n• ') ELSE '' END)
    || (CASE WHEN v_draft_count > 0 THEN E'\n\n⏳ MASIH DRAFT (' || v_draft_count || E' Cabang):\n• ' || array_to_string(v_draft, E'\n• ') ELSE '' END)
    || (CASE WHEN v_belum_count > 0 THEN E'\n\n🚨 BELUM OPNAME (' || v_belum_count || E' Cabang):\n• ' || array_to_string(v_belum, E'\n• ') ELSE E'\n\n🎉 Seluruh cabang di area binaan Anda sudah menyelesaikan Stock Opname hari ini!' END);

    PERFORM public.bot_manager_antrekan(
      format('opname_fin_am:%s:%s', NEW.id::text, v_am.id::text),
      v_am.id,
      format('📦 [OPNAME SELESAI] %s (%s/%s)', v_outlet_name, v_sudah_count, v_total),
      v_body,
      'https://manager.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_opname_finalized gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 9. bot_ceo_cek_unclosed_shifts
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_unclosed_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_tgl_wib date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_shift record;
  v_staff_name text;
  v_total_orders int;
  v_total_cash numeric;
  v_ceo record;
BEGIN
  -- Hanya dievaluasi pada malam hari (>= 23:00 WIB atau subuh <= 04:00 WIB)
  IF v_jam < 23 AND v_jam > 4 THEN
    RETURN;
  END IF;

  FOR v_shift IN
    SELECT s.id, s.outlet_id, s.staff_id, s.start_time,
           coalesce(o.name, 'Cabang SS') AS outlet_name,
           round(extract(epoch FROM (now() - s.start_time)) / 3600.0, 1) AS jam_aktif
    FROM public.shifts s
    JOIN public.outlets o ON o.id = s.outlet_id
    WHERE s.status = 'open'
      AND public.bot_is_sales_outlet(o.id)
      AND s.start_time < (now() - interval '6 hours')
  LOOP
    -- Lookup kasir
    SELECT coalesce(name, 'Kasir Cabang') INTO v_staff_name
    FROM public.outlet_staff WHERE id = v_shift.staff_id;

    -- Hitung akumulasi penjualan di shift tersebut
    SELECT count(*), coalesce(sum(CASE WHEN lower(payment_method) = 'cash' THEN total_amount ELSE 0 END), 0)
    INTO v_total_orders, v_total_cash
    FROM public.orders
    WHERE outlet_id = v_shift.outlet_id
      AND status <> 'cancelled'
      AND created_at >= v_shift.start_time;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('unclosed_shift_ceo:%s:%s', v_shift.id::text, v_tgl_wib::text),
        v_ceo.id,
        '⚠️ [SALES WARNING] Shift Kasir Belum Ditutup — ' || v_shift.outlet_name,
        format(
          E'Shift kasir POS masih berstatus OPEN setelah %s jam (melewati jam tutup malam).\nOutlet: %s\nKasir: %s\nWaktu Buka Shift: %s WIB\nAkumulasi Transaksi: %s Order (Total Tunai: Rp %s)\n\nPerhatian Direksi: Uang laci kasir belum dihitung & berisiko selisih/hilang.',
          v_shift.jam_aktif::text,
          v_shift.outlet_name,
          coalesce(v_staff_name, 'Kasir'),
          to_char(v_shift.start_time AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          v_total_orders::text,
          to_char(v_total_cash, 'FM999,999,999')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 10. bot_manager_broadcast_omzet
CREATE OR REPLACE FUNCTION public.bot_manager_broadcast_omzet(p_sesi text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_sesi_label text;
  v_url text := 'https://manager.sukashawarma.com/dashboard';
  v_am record;
  v_outlet record;
  v_am_omzet numeric;
  v_am_pcs numeric;
  v_am_target numeric;
  v_am_pct numeric;
  v_am_lines text[];
  v_title text;
  v_body text;
  v_reg_omzet numeric := 0;
  v_reg_pcs numeric := 0;
  v_reg_target numeric := 0;
  v_reg_pct numeric := 0;
  v_reg_lines text[];
  v_area_item record;
  v_rm record;
BEGIN
  IF p_sesi NOT IN ('siang', 'dinner', 'closing') THEN
    RAISE EXCEPTION 'Sesi broadcast tidak valid: %', p_sesi;
  END IF;

  v_sesi_label := CASE p_sesi
    WHEN 'siang' THEN 'SIANG (15:00 WIB)'
    WHEN 'dinner' THEN 'DINNER (19:30 WIB)'
    WHEN 'closing' THEN 'CLOSING FINAL (22:30 WIB)'
  END;

  -- 1. Laporan Per Area Manager (AM)
  FOR v_am IN
    SELECT DISTINCT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager' AND s.status = 'active'
    ORDER BY s.name
  LOOP
    v_am_omzet := 0;
    v_am_pcs := 0;
    v_am_target := 0;
    v_am_lines := '{}';

    FOR v_outlet IN
      SELECT 
        o.id,
        o.name,
        COALESCE(s.omzet, 0) AS outlet_omzet,
        COALESCE(s.total_pcs, 0) AS outlet_pcs,
        COALESCE(t.target_amount, 0) AS outlet_target,
        CASE WHEN COALESCE(t.target_amount, 0) > 0 
          THEN ROUND((COALESCE(s.omzet, 0) / t.target_amount) * 100, 1) 
          ELSE 0 END AS outlet_pct
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(ord.total_amount), 0) AS omzet,
          COALESCE((
            SELECT SUM(oi.quantity)
            FROM public.order_items oi
            JOIN public.orders ord2 ON ord2.id = oi.order_id
            WHERE ord2.outlet_id = o.id
              AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
              AND ord2.status IN ('completed', 'selesai', 'paid')
          ), 0) AS total_pcs
        FROM public.orders ord
        WHERE ord.outlet_id = o.id
          AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
          AND ord.status IN ('completed', 'selesai', 'paid')
      ) s
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          0
        ) AS target_amount
      ) t
      WHERE so.staff_id = v_am.id
        AND public.bot_is_sales_outlet(o.id)
      ORDER BY s.omzet DESC, o.name
    LOOP
      v_am_omzet := v_am_omzet + v_outlet.outlet_omzet;
      v_am_pcs := v_am_pcs + v_outlet.outlet_pcs;
      v_am_target := v_am_target + v_outlet.outlet_target;

      v_am_lines := array_append(
        v_am_lines,
        '• ' || v_outlet.name || ': Rp ' || to_char(v_outlet.outlet_omzet, 'FM999,999,999')
          || ' (' || v_outlet.outlet_pcs || ' pcs)'
          || CASE WHEN v_outlet.outlet_target > 0 THEN ' [' || v_outlet.outlet_pct || '%]' ELSE '' END
      );
    END LOOP;

    IF COALESCE(cardinality(v_am_lines), 0) > 0 THEN
      v_am_pct := CASE WHEN v_am_target > 0 THEN ROUND((v_am_omzet / v_am_target) * 100, 1) ELSE 0 END;

      v_title := '📊 LAPORAN OMZET ' || v_sesi_label;
      v_body := 'Area: ' || v_am.name
        || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
        || E'\nTotal Omzet: Rp ' || to_char(v_am_omzet, 'FM999,999,999') || ' (' || v_am_pcs || ' pcs)'
        || (CASE WHEN v_am_target > 0 THEN E'\nCapaian Target: ' || v_am_pct || '% dari Rp ' || to_char(v_am_target, 'FM999,999,999') ELSE '' END)
        || E'\n\nPerforma Cabang Binaan:'
        || E'\n' || array_to_string(v_am_lines, E'\n')
        || (CASE 
            WHEN p_sesi = 'siang' AND v_am_pct < 40 THEN E'\n\n⚠️ Perhatian AM: Capaian siang masih di bawah 40%, mohon evaluasi jam operasional & stok cabang.'
            WHEN p_sesi = 'dinner' AND v_am_pct < 80 THEN E'\n\n⏳ Info AM: Masih butuh dorongan penjualan sebelum closing untuk mencapai target 100%.'
            WHEN p_sesi = 'closing' AND v_am_pct >= 100 THEN E'\n\n🎉 Selamat! Target area hari ini berhasil tercapai 100%.'
            ELSE '' END);

      PERFORM public.bot_manager_antrekan(
        'omzet_am:' || p_sesi || ':' || v_am.id || ':' || v_today,
        v_am.id,
        v_title,
        v_body,
        v_url
      );
    END IF;
  END LOOP;

  -- 2. Laporan Eksekutif Regional (ke Seluruh RM)
  SELECT 
    COALESCE(SUM(s.omzet), 0),
    COALESCE(SUM(s.total_pcs), 0),
    COALESCE(SUM(t.target_amount), 0)
  INTO v_reg_omzet, v_reg_pcs, v_reg_target
  FROM public.outlets o
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(SUM(ord.total_amount), 0) AS omzet,
      COALESCE((
        SELECT SUM(oi.quantity)
        FROM public.order_items oi
        JOIN public.orders ord2 ON ord2.id = oi.order_id
        WHERE ord2.outlet_id = o.id
          AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
          AND ord2.status IN ('completed', 'selesai', 'paid')
      ), 0) AS total_pcs
    FROM public.orders ord
    WHERE ord.outlet_id = o.id
      AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
      AND ord.status IN ('completed', 'selesai', 'paid')
  ) s
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
      (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
      0
    ) AS target_amount
  ) t
  WHERE public.bot_is_sales_outlet(o.id);

  v_reg_lines := '{}';

  FOR v_area_item IN
    SELECT 
      am.name AS am_name,
      COALESCE(SUM(s.omzet), 0) AS area_omzet,
      COALESCE(SUM(s.total_pcs), 0) AS area_pcs,
      COALESCE(SUM(t.target_amount), 0) AS area_target,
      CASE WHEN COALESCE(SUM(t.target_amount), 0) > 0 
        THEN ROUND((COALESCE(SUM(s.omzet), 0) / SUM(t.target_amount)) * 100, 1) 
        ELSE 0 END AS area_pct
    FROM public.outlet_staff am
    JOIN public.staff_outlets so ON so.staff_id = am.id
    JOIN public.outlets o ON o.id = so.outlet_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(SUM(ord.total_amount), 0) AS omzet,
        COALESCE((
          SELECT SUM(oi.quantity)
          FROM public.order_items oi
          JOIN public.orders ord2 ON ord2.id = oi.order_id
          WHERE ord2.outlet_id = o.id
            AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
            AND ord2.status IN ('completed', 'selesai', 'paid')
        ), 0) AS total_pcs
      FROM public.orders ord
      WHERE ord.outlet_id = o.id
        AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
        AND ord.status IN ('completed', 'selesai', 'paid')
    ) s
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        0
      ) AS target_amount
    ) t
    WHERE am.role = 'area_manager' AND am.status = 'active'
      AND public.bot_is_sales_outlet(o.id)
    GROUP BY am.id, am.name
    ORDER BY area_omzet DESC
  LOOP
    v_reg_lines := array_append(
      v_reg_lines,
      '• Area ' || v_area_item.am_name || ': Rp ' || to_char(v_area_item.area_omzet, 'FM999,999,999')
        || ' (' || v_area_item.area_pcs || ' pcs)'
        || CASE WHEN v_area_item.area_target > 0 THEN ' [' || v_area_item.area_pct || '%]' ELSE '' END
    );
  END LOOP;

  IF COALESCE(cardinality(v_reg_lines), 0) > 0 THEN
    v_reg_pct := CASE WHEN v_reg_target > 0 THEN ROUND((v_reg_omzet / v_reg_target) * 100, 1) ELSE 0 END;

    v_title := '🌐 REKAP REGIONAL OMZET ' || v_sesi_label;
    v_body := 'Wilayah: Seluruh Regional'
      || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
      || E'\nTotal Omzet: Rp ' || to_char(v_reg_omzet, 'FM999,999,999') || ' (' || v_reg_pcs || ' pcs)'
      || (CASE WHEN v_reg_target > 0 THEN E'\nCapaian Target: ' || v_reg_pct || '% dari Rp ' || to_char(v_reg_target, 'FM999,999,999') ELSE '' END)
      || E'\n\nPerforma Antar Area:'
      || E'\n' || array_to_string(v_reg_lines, E'\n')
      || E'\n\nCatatan: Koordinasikan dorongan target dengan Area Manager terkait.';

    FOR v_rm IN
      SELECT s.id 
      FROM public.outlet_staff s 
      WHERE s.role IN ('regional_manager', 'developer') AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'omzet_rm:' || p_sesi || ':' || v_rm.id || ':' || v_today,
        v_rm.id,
        v_title,
        v_body,
        v_url
      );
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_broadcast_omzet gagal: %', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────── 11. opname_pengingat_kandidat
CREATE OR REPLACE FUNCTION public.opname_pengingat_kandidat(p_today date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta'::text))::date)
RETURNS TABLE(outlet_id uuid, outlet_name text, tanggal_opname_terakhir date, hari_sejak_opname integer, ada_draft_hari_ini boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH terakhir AS (
    SELECT op.outlet_id, MAX(op.tanggal) AS tanggal_terakhir
    FROM public.opname op
    WHERE op.status = 'finalized'
      AND op.tipe <> 'ad_hoc'
    GROUP BY op.outlet_id
  ),
  draft_hari_ini AS (
    SELECT DISTINCT op.outlet_id
    FROM public.opname op
    WHERE op.status = 'draft'
      AND op.tipe = 'harian'
      AND op.tanggal = p_today
  )
  SELECT o.id,
         o.name,
         t.tanggal_terakhir,
         CASE WHEN t.tanggal_terakhir IS NULL THEN NULL
              ELSE p_today - t.tanggal_terakhir END,
         (d.outlet_id IS NOT NULL)
  FROM public.outlets o
  LEFT JOIN terakhir t ON t.outlet_id = o.id
  LEFT JOIN draft_hari_ini d ON d.outlet_id = o.id
  WHERE public.bot_is_sales_outlet(o.id)
    AND NOT public.bot_is_outlet_tutup_sementara(o.id)
    AND (t.tanggal_terakhir IS NULL OR p_today - t.tanggal_terakhir > 7);
$function$;

-- ─────────────────────────────────────────────────────────── 12. Cleanup Outbox dari Data Palsu & Rekam Migrasi
DELETE FROM public.bot_ceo_alert_outbox
WHERE event_key LIKE 'sjgantung_ceo:%'
   OR event_key LIKE 'zero%SS BACKUP%'
   OR event_key LIKE 'opname%SS BACKUP%';

DELETE FROM public.bot_manager_alert_outbox
WHERE event_key LIKE 'zero%8ee417d9-d08b-4b7e-b09c-302870c7f0b5%'
   OR event_key LIKE 'opname%8ee417d9-d08b-4b7e-b09c-302870c7f0b5%';
