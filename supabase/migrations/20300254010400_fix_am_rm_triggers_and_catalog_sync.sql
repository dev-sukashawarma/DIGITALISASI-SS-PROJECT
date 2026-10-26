-- =============================================================================
-- Migration: 20300254010400_fix_am_rm_triggers_and_catalog_sync.sql
-- Tanggal: 2026-10-26
-- Deskripsi:
--   Perbaikan komprehensif & sinkronisasi Alert Trigger Area Manager (AM)
--   dan Regional Manager (RM) antara Database, Telegram Bot, dan Native App:
--
--   1. trg_fn_bot_ceo_absensi_fraud_alert:
--      - Mengembalikan blok pengiriman ke Area Manager (absensi_fraud_am) saat
--        kru clock-in > 100m dari titik outlet (Fake GPS / Luar Radius),
--        sekaligus mempertahankan format HTML eksekutif untuk Bot CEO.
--
--   2. trg_fn_bot_manager_opname_finalized:
--      - Mengembalikan blok pengiriman real-time ke Regional Manager (opname_fin_rm)
--        dengan filter kanonikal bot_is_sales_outlet & bot_is_outlet_tutup_sementara.
--
--   3. bot_manager_cek_zero_sales_dan_sj_gantung:
--      - Mengembalikan batas waktu <= 48 jam pada Surat Jalan menggantung agar
--        SJ lama tidak memicu alarm berulang tiap jam.
--      - Mengembalikan eskalasi ke Bot CEO (sjgantung_ceo) jika menggantung >= 3.5 jam.
--
--   4. bot_manager_alert_stok_kritis:
--      - Menyelaraskan format satuan stok kritis AM menggunakan
--        bot_format_stok_adaptive() (multi-unit: Dus + Pack + Gram/Lembar)
--        agar identik dengan aplikasi Stok & tidak menampilkan angka gram mentah.
--
--   5. stok_push_waste_pending_approval:
--      - Menghapus 'area_manager' & 'regional_manager' dari penerima alert
--        stokist:stok waste agar AM/RM tidak menerima notifikasi ganda di HP
--        (karena AM/RM sudah menerima notif lengkap dari bot_manager_alert_waste
--        dan push langsung manager_waste dari trigger_waste_pending_push_notification).
--      - Membersihkan riwayat duplikat stokis waste milik AM/RM di bot_app_notifications.
--
--   6. bot_telegram_alert_verifikasi_surat_jalan:
--      - Memisahkan event_key sj_selisih_am & sj_selisih_rm serta judul eskalasi RM
--        saat surat jalan diterima sebagian (ada selisih fisik).
--
--   7. Sinkronisasi Katalog public.bot_trigger_catalog:
--      - Memperbarui penuh daftar trigger untuk 'area_manager' (17 trigger) dan
--        'regional_manager' (13 trigger) agar Tab "⚡ Trigger" di Native Superapp
--        dan perintah /help Telegram 100% sinkron dengan kondisi terbaru.
-- =============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Restore AM Alert pada trg_fn_bot_ceo_absensi_fraud_alert (Fake GPS > 100m)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_absensi_fraud_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_staff_name text;
  v_device_info text;
  v_am record;
  v_ceo record;
BEGIN
  IF NEW.type <> 'in' OR NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.distance_m, 0) > 100 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    SELECT coalesce(name, 'Kru Outlet') INTO v_staff_name
    FROM public.outlet_staff WHERE id = NEW.outlet_staff_id;

    v_device_info := coalesce(nullif(btrim(NEW.device_info), ''), 'Aplikasi Mobile Presensi');

    -- A. Kirim ke Area Manager (AM) pembina cabang (Push HP Native + Telegram Bot Manager)
    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('absensi_fraud_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '🚨 [AUDIT ABSENSI] Fake GPS / Luar Radius — ' || v_outlet_name,
        format(
          E'Deteksi presensi clock-in di luar radius batas aman toko di cabang binaan Anda.\nOutlet: %s\nNama Staf: %s\nJarak Terdeteksi: %s meter dari koordinat outlet (Batas SOP: 20m)\nWaktu Absen: %s WIB\n\nSegera kroscek apakah staf benar-benar ada di gerai atau menggunakan Fake GPS / titip absen.',
          v_outlet_name,
          v_staff_name,
          round(NEW.distance_m, 0)::text,
          to_char(coalesce(NEW.ts_client, NEW.ts_server) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'bot'
      );
    END LOOP;

    -- B. Kirim ke Bot CEO (Owner / Admin / Developer)
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('absensi_fraud_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 <b>ESKALASI INDIKASI FRAUD ABSENSI KRU</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'👤 <b>Kru:</b> <b>%s</b>\n' ||
          E'📍 <b>Jarak Terdeteksi:</b> <code>%s Meter</code> dari geofence outlet (Batas SOP: 20m)\n' ||
          E'⏱️ <b>Waktu Clock-In:</b> <code>%s WIB</code>\n' ||
          E'📱 <b>Perangkat:</b> %s\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Presensi dilakukan di luar radius toleransi lokasi outlet (indikasi Mock GPS atau titip absen). Konfirmasi dengan rekaman CCTV atau supervisi Area Manager.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(v_staff_name),
          round(NEW.distance_m, 0)::text,
          to_char(coalesce(NEW.ts_client, NEW.ts_server) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          public.bot_escape_html(v_device_info)
        ),
        'https://hr.sukashawarma.com/attendance'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_absensi_fraud_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Restore RM Alert pada trg_fn_bot_manager_opname_finalized (AM & RM)
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_rm record;
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

  -- A. Kirim Notifikasi Real-time ke Area Manager pembina cabang ini
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

  -- B. Kirim Notifikasi Real-time ke Regional Manager & Developer (Rekap Se-Regional)
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
    E'Cabang %s baru saja melakukan Finalize Stock Opname (%s WIB).\nProgress Opname Regional: %s / %s Cabang Selesai',
    v_outlet_name,
    to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
    v_sudah_count::text,
    v_total::text
  )
  || (CASE WHEN v_sudah_count > 0 THEN E'\n\n✅ SUDAH OPNAME (' || v_sudah_count || E' Cabang):\n• ' || array_to_string(v_sudah, E'\n• ') ELSE '' END)
  || (CASE WHEN v_draft_count > 0 THEN E'\n\n⏳ MASIH DRAFT (' || v_draft_count || E' Cabang):\n• ' || array_to_string(v_draft, E'\n• ') ELSE '' END)
  || (CASE WHEN v_belum_count > 0 THEN E'\n\n🚨 BELUM OPNAME (' || v_belum_count || E' Cabang):\n• ' || array_to_string(v_belum, E'\n• ') ELSE E'\n\n🎉 Seluruh cabang operasional telah menyelesaikan Stock Opname hari ini!' END);

  FOR v_rm IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('regional_manager', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      format('opname_fin_rm:%s:%s', NEW.id::text, v_rm.id::text),
      v_rm.id,
      format('📦 [OPNAME FINALIZED] %s (%s/%s Cabang)', v_outlet_name, v_sudah_count::text, v_total::text),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Restore Filter 48 Jam & Eskalasi CEO pada bot_manager_cek_zero_sales_dan_sj_gantung
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- A. Alert Cabang Rp 0 Transaksi (17:00 WIB ke AM, 19:30 WIB ke RM & CEO)
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

      IF v_jam > 19 OR (v_jam = 19 AND extract(minute FROM v_now_wib) >= 30) THEN
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

        FOR v_ceo IN
          SELECT id FROM public.outlet_staff
          WHERE role IN ('owner', 'admin', 'developer')
            AND status = 'active'
        LOOP
          PERFORM public.bot_ceo_antrekan(
            format('zero1930_ceo:%s:%s', v_tgl_wib::text, v_out.id::text),
            v_ceo.id,
            '🚨 <b>ESKALASI OUTLET NOL TRANSAKSI (PRIME TIME)</b>',
            format(
              E'━━━━━━━━━━━━━━━━━━━━━\n' ||
              E'🏪 <b>Outlet:</b> %s\n' ||
              E'⏱️ <b>Waktu Evaluasi:</b> <code>%s WIB</code>\n' ||
              E'📊 <b>Status Penjualan:</b> <code>Rp 0 (0 Transaksi)</code>\n\n' ||
              E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
              E'Gerai telah melewati jam buka dan memasuki jam sibuk malam namun belum mencatat 1 pun transaksi di POS. Segera hubungi AM dan periksa apakah ada kendala listrik, perangkat POS offline, atau gerai belum dibuka.</blockquote>',
              public.bot_escape_html(v_out.name),
              to_char(v_now_wib, 'HH24:MI')
            ),
            'https://admin.sukashawarma.com'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- B. Alert Surat Jalan Menggantung > 2 Jam Belum Diverifikasi Cabang (dibatasi <= 48 jam aktif)
  FOR v_sj IN
    SELECT sj.id,
           coalesce(sj.document_number, substr(sj.id::text, 1, 8)) AS doc_no,
           sj.outlet_id,
           coalesce(o.name, 'Cabang SS') AS outlet_name,
           round(extract(epoch FROM (now() - coalesce(sj.updated_at, sj.created_at))) / 3600.0, 1) AS jam_gantung
    FROM public.surat_jalan sj
    JOIN public.outlets o ON o.id = sj.outlet_id
    WHERE sj.status = 'dikirim'
      AND sj.auto_verified_at IS NULL
      AND sj.ditutup_administratif_at IS NULL
      AND coalesce(sj.updated_at, sj.created_at) < (now() - interval '2 hours')
      AND coalesce(sj.updated_at, sj.created_at) >= (now() - interval '48 hours')
      AND public.bot_is_sales_outlet(o.id)
  LOOP
    -- 1. Kirim ke Area Manager (mulai > 2 jam)
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
        '⏳ [SURAT JALAN BELUM DIVERIFIKASI] ' || v_sj.outlet_name,
        format(
          E'Surat Jalan pengiriman bahan ke cabang telah berstatus DIKIRIM selama %s Jam namun belum diverifikasi (diterima) oleh kru cabang.\nOutlet: %s\nNo. SJ: %s\n\nSegera hubungi Leader cabang untuk verifikasi fisik barang dan update status di aplikasi.',
          v_sj.jam_gantung::text,
          v_sj.outlet_name,
          v_sj.doc_no
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
          '📦 <b>PERINGATAN DISTRIBUSI: SURAT JALAN MENGGANTUNG</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet Tujuan:</b> %s\n' ||
            E'📄 <b>No. Dokumen SJ:</b> <code>%s</code>\n' ||
            E'⏳ <b>Durasi Menggantung:</b> <code>%s Jam (Status: Dikirim)</code>\n' ||
            E'⏱️ <b>Waktu Evaluasi:</b> <code>%s WIB</code>\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Pengiriman bahan baku Central Kitchen belum dikonfirmasi terima oleh outlet. Berisiko mengacaukan stok opname malam cabang.</blockquote>',
            public.bot_escape_html(v_sj.outlet_name),
            public.bot_escape_html(v_sj.doc_no),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Upgrade bot_manager_alert_stok_kritis (AM) ke Multi-Unit Adaptif
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_manager_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_satuan_besar text;
  v_satuan_tengah text;
  v_faktor_tengah numeric;
  v_satuan_kecil text;
  v_faktor_tampilan numeric;
  v_raw_threshold numeric;
  v_threshold numeric;
  v_outlet_name text;
  v_is_gram boolean;
  v_saldo_str text;
  v_threshold_str text;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
  v_am record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan,
         b.satuan_tengah,
         b.faktor_tengah,
         b.satuan_kecil,
         b.faktor_tampilan,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan, v_raw_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Scale-aware unit dan threshold
  v_is_gram := public.saldo_is_gram(NEW);
  IF v_is_gram THEN
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_threshold := v_raw_threshold;
  END IF;

  IF NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  -- Format dekomposisi multi-unit adaptif (identik dengan apps/stok)
  v_saldo_str := public.bot_format_stok_adaptive(
    NEW.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan
  );
  v_threshold_str := public.bot_format_stok_adaptive(
    v_threshold, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan
  );

  v_title := '⚠️ [STOK KRITIS] ' || v_item_name || ' — ' || COALESCE(v_outlet_name, 'Outlet');
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || v_item_name
    || E'\nSisa Stok: ' || v_saldo_str
    || E'\nBatas Reorder: ' || v_threshold_str
    || E'\nStatus: Berisiko kehabisan stok hari ini!'
    || E'\n\nSegera koordinasikan pengiriman darurat atau mutasi antar cabang.';

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
      'stok_kritis:' || NEW.outlet_id || ':' || NEW.bahan_baku_id || ':' || (now() AT TIME ZONE 'Asia/Jakarta')::date,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert stok kritis manager: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Hapus Duplikasi Notif Waste Stokis ke AM & RM pada stok_push_waste_pending_approval
--    (AM & RM sudah menerima notif lengkap via bot_manager_alert_waste & manager_waste)
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Hanya kirim ke tim Stokis Pusat (admin, kitchen, purchasing, developer).
  -- Area Manager & Regional Manager sudah ditangani oleh bot_manager_alert_waste
  -- dan trigger_waste_pending_push_notification (route: manager_waste).
  FOR v_recip IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin', 'kitchen', 'purchasing', 'developer')
      AND s.id IS DISTINCT FROM NEW.reported_by
  LOOP
    BEGIN
      -- 1. Jalur In-App Notif + Push HP Bot + Telegram Stokist
      PERFORM public.bot_telegram_kirim_alert(
        v_recip.id,
        'stok',
        '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet'),
        'Ada laporan waste baru yang perlu ditinjau di outlet ' || COALESCE(v_outlet_name, 'terkait') || '.',
        'https://stok.sukashawarma.com/stok/waste/approval',
        NEW.outlet_id
      );

      -- 2. Jalur FCM tambahan ke modul stok (jika secret tersedia)
      IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
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
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim push approval waste % kepada staf %: %', NEW.id, v_recip.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_push_waste_pending_approval() FROM PUBLIC, anon, authenticated;

-- Bersihkan riwayat notifikasi duplikat stokis waste pada akun AM & RM di bot_app_notifications
DELETE FROM public.bot_app_notifications n
USING public.outlet_staff s
WHERE n.staff_id = s.id
  AND s.role IN ('area_manager', 'regional_manager')
  AND n.bot_slug = 'stokis'
  AND n.event_key LIKE 'stokist:stok:%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Konsistensi Key & Judul Eskalasi RM pada bot_telegram_alert_verifikasi_surat_jalan
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_doc_no text;
  v_crew_name text;
  v_item_count int := 0;
  v_total_qty numeric := 0;
  v_duration_hours numeric;
  v_item_detail text := '';
  v_item_detail_html text := '';
  v_time_str text := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI');
  v_date_str text := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY');
  v_am record;
  v_rm record;
  v_ceo record;
  v_kit record;
  v_item record;
  v_diff_count int := 0;
  v_body_am text;
  v_body_ceo text;
BEGIN
  -- A. Catat waktu keberangkatan (dispatched_at) saat status menjadi 'dikirim' / 'dikirim_lengkap'
  IF NEW.status IN ('dikirim', 'dikirim_lengkap') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.bot_telegram_sj_kitchen_alert_state AS existing (
        surat_jalan_id, dispatched_at, completion_alerted_at, last_reminded_at
      ) VALUES (NEW.id, NOW(), NULL, NULL)
      ON CONFLICT (surat_jalan_id) DO UPDATE
        SET dispatched_at = EXCLUDED.dispatched_at,
            completion_alerted_at = NULL,
            last_reminded_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- B. Hanya proses alert penyelesaian saat transisi menuju 'diterima_lengkap' atau 'diterima_sebagian'
  IF NEW.status NOT IN ('diterima_lengkap', 'diterima_sebagian')
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT NULL AND OLD.status IN ('diterima_lengkap', 'diterima_sebagian')) THEN
    RETURN NEW;
  END IF;

  -- Tandai selesai di state pengingat agar tidak dikirim pengingat gantung > 2 jam lagi
  INSERT INTO public.bot_telegram_sj_kitchen_alert_state (
    surat_jalan_id, dispatched_at, completion_alerted_at
  ) VALUES (
    NEW.id, COALESCE(NEW.created_at, NOW()), NOW()
  )
  ON CONFLICT (surat_jalan_id) DO UPDATE
    SET completion_alerted_at = COALESCE(public.bot_telegram_sj_kitchen_alert_state.completion_alerted_at, NOW());

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_doc_no := COALESCE(NULLIF(NEW.document_number, ''), left(NEW.id::text, 8));

  IF NEW.auto_verified_at IS NOT NULL THEN
    v_crew_name := 'Sistem (Auto-Verifikasi Lewat Hari)';
  ELSE
    SELECT s.name INTO v_crew_name
    FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role IN ('crew', 'leader', 'kiosk')
      AND (s.outlet_id = NEW.outlet_id OR EXISTS (
        SELECT 1 FROM public.staff_outlets so
        WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
      ));

    IF NULLIF(btrim(v_crew_name), '') IS NULL THEN
      SELECT NULLIF(btrim(sig.value->>'signed_by'), '') INTO v_crew_name
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(NEW.receipt_signatures) = 'array'
          THEN NEW.receipt_signatures ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS sig(value, position)
      WHERE sig.value->>'role' = 'Crew Penerima'
      ORDER BY sig.position DESC LIMIT 1;
    END IF;

    IF NULLIF(btrim(v_crew_name), '') IS NULL THEN
      v_crew_name := 'Kru Cabang';
    END IF;
  END IF;

  SELECT count(*), coalesce(sum(qty_terima), 0)
  INTO v_item_count, v_total_qty
  FROM public.surat_jalan_item
  WHERE surat_jalan_id = NEW.id;

  v_duration_hours := round(extract(epoch FROM (NOW() - COALESCE(NEW.created_at, NOW()))) / 3600.0, 1);

  -- KASUS 1: DITERIMA LENGKAP
  IF NEW.status = 'diterima_lengkap' THEN
    v_body_am := format(
      E'Pengiriman bahan baku Central Kitchen telah selesai diverifikasi & diterima lengkap oleh cabang.\nOutlet: %s\nNo. SJ: %s\nPenerima: %s\nWaktu: %s WIB (%s)\nStatus: ✅ 100%% Sesuai & Baik (%s Item Bahan Baku)\nDurasi Perjalanan: %s Jam\n\nStok otomatis masuk ke inventori cabang dan siap digunakan untuk operasional.',
      v_outlet_name,
      v_doc_no,
      v_crew_name,
      v_time_str,
      v_date_str,
      v_item_count::text,
      v_duration_hours::text
    );

    v_body_ceo := format(
      E'━━━━━━━━━━━━━━━━━━━━━\n' ||
      E'🏪 <b>Outlet:</b> %s\n' ||
      E'📄 <b>No. Dokumen SJ:</b> <code>%s</code>\n' ||
      E'👤 <b>Kru Penerima:</b> %s\n' ||
      E'⏱️ <b>Waktu Verifikasi:</b> <code>%s WIB (%s)</code>\n' ||
      E'📦 <b>Hasil Pengecekan:</b> <code>%s Item Bahan Baku (100%% Sesuai)</code>\n' ||
      E'🚚 <b>Durasi Perjalanan:</b> <code>%s Jam</code>\n\n' ||
      E'<blockquote>💡 <b>Atensi Direksi:</b>\n' ||
      E'Barang inventori dari Central Kitchen telah diverifikasi lengkap dan resmi masuk ke saldo stok fisik cabang.</blockquote>',
      public.bot_escape_html(v_outlet_name),
      public.bot_escape_html(v_doc_no),
      public.bot_escape_html(v_crew_name),
      v_time_str,
      v_date_str,
      v_item_count::text,
      v_duration_hours::text
    );

    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_verif_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '✅ [DISTRIBUSI SELESAI] ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_verif_rm:%s:%s', NEW.id::text, v_rm.id::text),
        v_rm.id,
        '✅ [DISTRIBUSI SELESAI] ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('sj_verif_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '✅ <b>DISTRIBUSI SELESAI: SURAT JALAN DITERIMA LENGKAP</b>',
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    FOR v_kit IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      WHERE s.role IN ('kitchen', 'purchasing')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_telegram_kirim_alert(
        v_kit.id,
        'distribusi',
        '✅ Crew selesai verifikasi · ' || v_outlet_name,
        'SJ: ' || v_doc_no || E'\nCrew: ' || left(v_crew_name, 120)
          || E'\nWaktu: ' || v_time_str || ' WIB'
          || E'\nHasil: ' || v_item_count || ' baris bahan diterima lengkap dan sesuai.'
          || E'\nStok outlet telah diperbarui otomatis.',
        'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
        NEW.outlet_id
      );
    END LOOP;

  -- KASUS 2: DITERIMA SEBAGIAN (Ada Selisih)
  ELSIF NEW.status = 'diterima_sebagian' THEN
    FOR v_item IN
      SELECT
        bb.nama AS bahan_nama,
        bb.satuan,
        sji.qty_dikirim,
        sji.qty_terima,
        coalesce(sji.selisih, (sji.qty_terima - sji.qty_dikirim)) AS selisih_qty,
        nullif(btrim(sji.catatan), '') AS item_catatan
      FROM public.surat_jalan_item sji
      JOIN public.bahan_baku bb ON bb.id = sji.bahan_baku_id
      WHERE sji.surat_jalan_id = NEW.id
        AND (sji.flagged IS TRUE OR coalesce(sji.selisih, 0) <> 0 OR sji.qty_terima < sji.qty_dikirim)
      ORDER BY abs(coalesce(sji.selisih, (sji.qty_terima - sji.qty_dikirim))) DESC
    LOOP
      v_diff_count := v_diff_count + 1;
      IF v_diff_count <= 4 THEN
        v_item_detail := v_item_detail || format(
          E'\n• %s: Kirim %s %s, Diterima %s %s (Selisih: %s %s)%s',
          v_item.bahan_nama,
          trim_scale(v_item.qty_dikirim)::text,
          coalesce(v_item.satuan, ''),
          trim_scale(v_item.qty_terima)::text,
          coalesce(v_item.satuan, ''),
          case when v_item.selisih_qty > 0 then '+' else '' end || trim_scale(v_item.selisih_qty)::text,
          coalesce(v_item.satuan, ''),
          case when v_item.item_catatan is not null then ' — Catatan: "' || v_item.item_catatan || '"' else '' end
        );
        v_item_detail_html := v_item_detail_html || format(
          E'\n• <b>%s</b>: Kirim <code>%s %s</code>, Diterima <code>%s %s</code> (<b>Selisih:</b> <code>%s %s</code>)%s',
          public.bot_escape_html(v_item.bahan_nama),
          trim_scale(v_item.qty_dikirim)::text,
          public.bot_escape_html(coalesce(v_item.satuan, '')),
          trim_scale(v_item.qty_terima)::text,
          public.bot_escape_html(coalesce(v_item.satuan, '')),
          case when v_item.selisih_qty > 0 then '+' else '' end || trim_scale(v_item.selisih_qty)::text,
          public.bot_escape_html(coalesce(v_item.satuan, '')),
          case when v_item.item_catatan is not null then ' — <i>"' || public.bot_escape_html(v_item.item_catatan) || '"</i>' else '' end
        );
      END IF;
    END LOOP;

    IF v_diff_count > 4 THEN
      v_item_detail := v_item_detail || format(E'\n• (+%s item selisih lainnya...)', v_diff_count - 4);
      v_item_detail_html := v_item_detail_html || format(E'\n• <i>(+%s item selisih lainnya...)</i>', v_diff_count - 4);
    END IF;

    IF v_item_detail = '' THEN
      v_item_detail := E'\n(Item berstatus selisih fisik belum diperinci)';
      v_item_detail_html := E'\n<i>(Item berstatus selisih fisik belum diperinci)</i>';
    END IF;

    v_body_am := format(
      E'Penerimaan logistik di cabang binaan Anda dilaporkan ada SELISIH FISIK / BARANG KURANG.\nOutlet: %s\nNo. SJ: %s\nPenerima: %s\nWaktu: %s WIB (%s)\n\nRincian Item Selisih:%s\n\nSegera hubungi Leader cabang dan koordinasikan rekonsiliasi stok dengan Kitchen.',
      v_outlet_name,
      v_doc_no,
      v_crew_name,
      v_time_str,
      v_date_str,
      v_item_detail
    );

    v_body_ceo := format(
      E'━━━━━━━━━━━━━━━━━━━━━\n' ||
      E'🏪 <b>Outlet:</b> %s\n' ||
      E'📄 <b>No. Dokumen SJ:</b> <code>%s</code>\n' ||
      E'👤 <b>Kru Penerima:</b> %s\n' ||
      E'⏱️ <b>Waktu Verifikasi:</b> <code>%s WIB (%s)</code>\n\n' ||
      E'🔍 <b>Rincian Item Selisih:</b>%s\n\n' ||
      E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
      E'Terdapat selisih fisik antara muatan Central Kitchen dan penerimaan gerai. Lakukan audit pengiriman armada / timbangan outlet untuk mencegah kebocoran logistik.</blockquote>',
      public.bot_escape_html(v_outlet_name),
      public.bot_escape_html(v_doc_no),
      public.bot_escape_html(v_crew_name),
      v_time_str,
      v_date_str,
      v_item_detail_html
    );

    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_selisih_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '⚠️ [SELISIH DISTRIBUSI] ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_selisih_rm:%s:%s', NEW.id::text, v_rm.id::text),
        v_rm.id,
        '🚨 [ESKALASI RM] Selisih Logistik — ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('sj_selisih_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '⚠️ <b>PERINGATAN DISTRIBUSI: SELISIH PENERIMAAN SURAT JALAN</b>',
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    FOR v_kit IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      WHERE s.role IN ('kitchen', 'purchasing')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_telegram_kirim_alert(
        v_kit.id,
        'distribusi',
        '⚠️ Selisih penerimaan SJ · ' || v_outlet_name,
        'SJ: ' || v_doc_no || E'\nCrew: ' || left(v_crew_name, 120)
          || E'\nWaktu: ' || v_time_str || ' WIB'
          || E'\nRincian Selisih:' || left(v_item_detail, 400)
          || E'\nMohon investigasi dan sesuaikan penyesuaian stok jika diperlukan.',
        'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
        NEW.outlet_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_verifikasi_surat_jalan gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Sinkronisasi Katalog Trigger Terpusat (public.bot_trigger_catalog)
--    Single Source of Truth untuk Tab "⚡ Trigger" di SUKA Superapp & Bot Telegram
-- ─────────────────────────────────────────────────────────────────────────────

-- Hapus ID lama yang sudah digantikan agar tidak duplikat di UI
DELETE FROM public.bot_trigger_catalog
WHERE target_role IN ('area_manager', 'regional_manager')
  AND id IN ('tg_am_waste_submit', 'tg_am_understaffed_h0');

INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  -- ── REGIONAL MANAGER (13 TRIGGERS) ──
  ('tg_rm_opname_finalized', 'regional_manager', 'manager',
   'Notifikasi Finalize Opname Cabang (Rekap Sudah & Belum Opname)',
   'Notifikasi real-time setiap kali ada cabang yang melakukan Finalize Stock Opname, lengkap dengan daftar cabang yang ✅ Sudah Opname, ⏳ Masih Draft, dan 🚨 Belum Opname hari ini.',
   'Trigger Finalize Opname (opname -> finalized)', true, true, 1, true),
  ('tg_rm_sj_verif', 'regional_manager', 'manager',
   'Notifikasi Verifikasi Penerimaan & Selisih Surat Jalan Cabang',
   'Notifikasi real-time saat cabang menyelesaikan verifikasi penerimaan Surat Jalan (✅ 100% Lengkap maupun 🚨 Eskalasi Selisih Fisik/Barang Kurang).',
   'Trigger Verifikasi SJ (diterima_lengkap / diterima_sebagian)', true, true, 2, true),
  ('tg_rm_kritis_kru_1445', 'regional_manager', 'manager',
   'Eskalasi Cabang Kritis Kekurangan Kru (14:45 WIB)',
   'Alert eskalasi ke Regional Manager pukul 14:45 WIB jika ada cabang operasional yang hanya dijaga <= 1 kru hadir.',
   'Cron Evaluasi Presensi Siang (14:45 WIB)', false, true, 3, true),
  ('tg_rm_late_open_30m', 'regional_manager', 'manager',
   'Eskalasi Keterlambatan Buka Outlet (>= 30 Menit)',
   'Alert eskalasi ke Regional Manager jika cabang belum buka kasir dan belum ada kru absen masuk >= 30 menit dari jadwal buka.',
   'Cron Operasional Jam Buka (>= 30 Menit)', false, true, 4, true),
  ('tg_rm_zero_sales_1930', 'regional_manager', 'manager',
   'Eskalasi Cabang Masih Rp 0 Transaksi (19:30 WIB)',
   'Alert eskalasi ke Regional Manager pada prime time malam (19:30 WIB) jika ada cabang aktif yang sudah buka namun masih mencatat 0 order POS (Rp 0).',
   'Cron Audit Omzet Malam (19:30 WIB)', false, true, 5, true),
  ('tg_rm_cash_var_100k', 'regional_manager', 'manager',
   'Eskalasi Selisih Kas Kritis (> Rp 100.000)',
   'Notifikasi audit ke Regional Manager saat kasir tutup shift dengan selisih kas laci atau petty cash melebihi Rp 100.000.',
   'Trigger Closing Shift Kasir (> Rp 100rb)', true, true, 6, true),
  ('tg_rm_void_fraud', 'regional_manager', 'manager',
   'Eskalasi Pembatalan / Void Order POS Mencurigakan',
   'Peringatan instan ke Regional Manager saat terjadi pembatalan order (cancelled/void) bernilai >= Rp 50.000 atau beruntun >= 2x di cabang yang sama.',
   'Trigger POS Void (orders -> cancelled)', true, true, 7, true),
  ('tg_rm_stok_drop50', 'regional_manager', 'manager',
   'Eskalasi Anomali Penurunan Stok Cabang (>= 50%)',
   'Deteksi dini potensi kebocoran/shrinkage saat saldo bahan baku utama cabang turun >= 50% dalam satu mutasi.',
   'Trigger Mutasi Saldo Stok (stok_balance)', true, true, 8, true),
  ('tg_rm_waste_150k', 'regional_manager', 'manager',
   'Eskalasi Pengajuan Waste Bahan (> Rp 150.000)',
   'Otorisasi khusus ke Regional Manager saat cabang mengajukan laporan waste bahan baku dengan estimasi kerugian di atas Rp 150.000.',
   'Trigger Laporan Waste (> Rp 150rb)', true, true, 9, true),
  ('tg_rm_retur_bahan', 'regional_manager', 'manager',
   'Otorisasi Pengajuan Retur Bahan ke Gudang/Vendor',
   'Notifikasi ke Regional Manager saat cabang mengajukan retur bahan baku untuk koordinasi logistik penjemputan dan penggantian stok.',
   'Trigger Pengajuan Retur (retur_stok)', true, true, 10, true),
  ('tg_rm_sidak_review', 'regional_manager', 'manager',
   'Notifikasi Hasil Sidak Ceklist Harian AM',
   'Laporan instan ke Regional Manager saat Area Manager menyelesaikan sidak cabang beserta rincian poin Perhatian/Buruk untuk direview.',
   'Trigger Submit Sidak Ceklist AM', true, true, 11, true),
  ('tg_rm_opname_cutoff', 'regional_manager', 'manager',
   'Eskalasi Cut-Off Stok Opname (22:30 WIB)',
   'Rekap eskalasi ke Regional Manager pukul 22:30 WIB berisi daftar cabang per area yang masih belum menyelesaikan Stok Opname fisik.',
   'Cron Cut-Off Malam (22:30 WIB)', false, true, 12, true),
  ('tg_rm_omzet_3x', 'regional_manager', 'manager',
   'Broadcast Omzet Regional & Leaderboard AM (3 Sesi)',
   'Executive summary total omzet regional, porsi terjual, dan leaderboard perbandingan performa antar Area Manager (15:00, 19:30 & 22:30 WIB).',
   'Jadwal 15:00, 19:30 & 22:30 WIB', false, true, 13, true),

  -- ── AREA MANAGER (17 TRIGGERS) ──
  ('tg_am_opname_finalized', 'area_manager', 'manager',
   'Notifikasi Finalize Opname Cabang (Rekap Sudah & Belum Opname)',
   'Notifikasi instan setiap kali cabang binaan menyelesaikan (Finalize) Stock Opname, langsung merinci daftar cabang yang ✅ Sudah Opname, ⏳ Masih Draft, dan 🚨 Belum Opname di area Anda.',
   'Trigger Finalize Opname (opname -> finalized)', true, true, 1, true),
  ('tg_am_sj_kirim', 'area_manager', 'manager',
   'Notifikasi Keberangkatan Pengiriman Logistik (Surat Jalan Dikirim)',
   'Pemberitahuan real-time ke Area Manager saat armada distribusi memberangkatkan bahan baku menuju outlet binaan agar kru siap melakukan timbang terima.',
   'Trigger Distribusi Berangkat (surat_jalan -> dikirim)', true, true, 2, true),
  ('tg_am_sj_verif', 'area_manager', 'manager',
   'Notifikasi Verifikasi Penerimaan & Selisih Surat Jalan Cabang',
   'Laporan real-time saat kru cabang menyelesaikan verifikasi Surat Jalan (✅ 100% Diterima Lengkap maupun ⚠️ Laporan Selisih Fisik/Barang Kurang).',
   'Trigger Verifikasi SJ (diterima_lengkap / diterima_sebagian)', true, true, 3, true),
  ('tg_am_sj_gantung_2h', 'area_manager', 'manager',
   'Alert Surat Jalan Menggantung (> 2 Jam Belum Diterima)',
   'Pengingat ke Area Manager jika pengiriman barang (Surat Jalan) sudah berstatus dikirim > 2 jam namun belum diverifikasi terima oleh kru cabang.',
   'Cron Cek Distribusi Tiap 15 Menit', false, true, 4, true),
  ('tg_am_belum_absen_1445', 'area_manager', 'manager',
   'Monitoring Kehadiran & Kru Belum Absen (14:45 WIB)',
   'Rekap otomatis pukul 14:45 WIB (45 menit setelah jam buka) yang merinci daftar nama kru yang belum clock-in tanpa keterangan vs kru yang izin resmi di setiap outlet binaan.',
   'Cron Evaluasi Presensi Siang (14:45 WIB)', false, true, 5, true),
  ('tg_am_absensi_fraud', 'area_manager', 'manager',
   'Alert Audit Absensi di Luar Radius / Indikasi Fake GPS (> 100m)',
   'Peringatan instan ke Area Manager saat ada kru cabang binaan yang melakukan clock-in presensi berjarak > 100 meter dari titik koordinat outlet.',
   'Trigger Audit Presensi (attendance distance_m > 100)', true, true, 6, true),
  ('tg_am_late_open_5m', 'area_manager', 'manager',
   'Alert Keterlambatan Buka Outlet (+5 Menit)',
   'Peringatan instan ke Area Manager tepat 5 menit setelah jadwal buka jika cabang binaan belum buka shift kasir dan belum ada absen kru.',
   'Cron Operasional Jam Buka (+5 Menit)', false, true, 7, true),
  ('tg_am_zero_sales_1700', 'area_manager', 'manager',
   'Alert Cabang Zero Sales / Rp 0 Transaksi (17:00 WIB)',
   'Peringatan sore pukul 17:00 WIB (setelah jam buka operasional berjalan) jika ada cabang binaan yang masih belum mencatat 1 pun transaksi POS (Rp 0).',
   'Cron Audit Omzet Sore (17:00 WIB)', false, true, 8, true),
  ('tg_am_cash_var_20k', 'area_manager', 'manager',
   'Alert Selisih Kas Closing Kasir (> Rp 20.000)',
   'Notifikasi ke Area Manager pembina cabang saat kasir tutup shift dengan selisih kas laci atau petty cash di atas Rp 20.000.',
   'Trigger Closing Shift Kasir (> Rp 20rb)', true, true, 9, true),
  ('tg_am_void_order', 'area_manager', 'manager',
   'Alert Pembatalan Order (Void / Cancelled) POS',
   'Notifikasi instan ke Area Manager setiap kali kasir di cabang binaan membatalkan transaksi POS untuk audit alasan void.',
   'Trigger POS Void (orders -> cancelled)', true, true, 10, true),
  ('tg_am_stok_drop50', 'area_manager', 'manager',
   'Alert Anomali Penurunan Stok Cabang (>= 50%)',
   'Peringatan real-time ke Area Manager jika saldo bahan baku di cabang binaan turun drastis >= 50% dalam sekali mutasi.',
   'Trigger Mutasi Saldo Stok (stok_balance)', true, true, 11, true),
  ('tg_am_stok_kritis', 'area_manager', 'manager',
   'Alert Stok Kritis Cabang Binaan (Reorder Point)',
   'Peringatan real-time khusus Area Manager saat saldo bahan baku di cabang binaan turun menyentuh atau di bawah reorder point (format multi-unit adaptif).',
   'Trigger Mutasi Saldo Stok (stok_balance)', true, true, 12, true),
  ('tg_am_waste_all', 'area_manager', 'manager',
   'Alert Pengajuan Waste Bahan Baku Cabang',
   'Notifikasi ke Area Manager setiap kali outlet binaan mengajukan laporan waste bahan baku baru (status PENDING) untuk verifikasi fisik.',
   'Trigger Laporan Waste (stok_waste_reports)', true, true, 13, true),
  ('tg_am_retur_bahan', 'area_manager', 'manager',
   'Verifikasi Pengajuan Retur Bahan Baku Cabang',
   'Notifikasi ke Area Manager saat cabang binaan mengajukan retur fisik bahan cacat/salah kirim ke gudang atau vendor.',
   'Trigger Pengajuan Retur (retur_stok)', true, true, 14, true),
  ('tg_am_understaffed', 'area_manager', 'manager',
   'Alert Outlet Understaffed / Izin Mendadak Hari Ini',
   'Notifikasi seketika ke Area Manager saat kru cabang binaan mengajukan izin/sakit mendadak hari ini (H-0) agar AM dapat mengatur rolling kru.',
   'Trigger Izin Mendadak H-0 (leave_requests)', true, true, 15, true),
  ('tg_am_sidak_feedback', 'area_manager', 'manager',
   'Konfirmasi Evaluasi Sidak Ceklist dari RM',
   'Notifikasi balik ke Area Manager saat Regional Manager telah meninjau/menyetujui laporan sidak harian beserta catatan evaluasinya.',
   'Trigger Review Ceklist Harian RM', true, true, 16, true),
  ('tg_am_opname_2x', 'area_manager', 'manager',
   'Monitoring Status Stok Opname (21:30 & 22:30 WIB)',
   'Digest status opname cabang binaan pukul 21:30 WIB (Sudah/Draft/Belum) dan peringatan darurat final cut-off pukul 22:30 WIB.',
   'Cron Harian 21:30 & 22:30 WIB', false, true, 17, true),
  ('tg_am_omzet_3x', 'area_manager', 'manager',
   'Broadcast Omzet Area Binaan (3 Sesi)',
   'Rekap total omzet area binaan, porsi terjual, dan rincian % capaian target harian per outlet binaan (15:00, 19:30 & 22:30 WIB).',
   'Jadwal 15:00, 19:30 & 22:30 WIB', false, true, 18, true)
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
