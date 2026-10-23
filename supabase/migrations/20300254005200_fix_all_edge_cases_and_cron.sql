-- 20300254005200_fix_all_edge_cases_and_cron.sql
-- Perbaikan komprehensif seluruh edge-cases operasional & keandalan bot (Swarm 2):
-- 1. Opname Tengah Malam (Bot CEO):
--    - Mengganti v_today menjadi coalesce(NEW.tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date)
--      agar closing opname yang selesai lewat jam 00:00 tidak memicu alarm palsu '27 Cabang Belum Opname'.
-- 2. Jadwal Cron Buka Outlet (bot-manager-cek-telat-buka):
--    - Diperluas dari '1-6 UTC' (08:00-13:55 WIB) menjadi '1-13 UTC' (08:00-20:55 WIB) agar cabang buka siang/sore terawasi.
-- 3. Kru Roving pada Izin Mendadak (trg_fn_bot_manager_izin_mendadak):
--    - Fallback ke tabel staff_outlets bila outlet_staff.outlet_id IS NULL agar kru roving tetap ternotifikasi ke AM binaan.
-- 4. Blind Spot Penurunan Stok Drastis (bot_telegram_alert_penurunan_stok_tidak_wajar):
--    - Menghapus syarat 'NEW.saldo <= v_threshold' yang menyebabkan penurunan drastis pada stok menipis diabaikan.
-- 5. Presensi HRD Telat Menit NULL (bot_hrd_alert_telat):
--    - Menggunakan coalesce(NEW.telat_menit, 0) dan SQLERRM untuk mencegah NOT NULL constraint error pada outbox.
-- 6. Rekap Regional Omzet Tanpa Double-Counting (bot_manager_broadcast_omzet):
--    - Agregasi omzet regional dihitung langsung dari outlet unik agar cabang yang memiliki multi-AM tidak terhitung ganda.
-- 7. Ghost Finance Triggers:
--    - Set is_active = false pada bot_trigger_catalog untuk bot_slug = 'finance' hingga backend outbox siap.

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Opname Finalized Bot CEO (Acuan Tanggal NEW.tanggal)
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

-- ─────────────────────────────────────────────────────────── 2. Cron Buka Outlet Diperluas Hingga Jam 21:00 WIB
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-manager-cek-telat-buka') THEN
    PERFORM cron.unschedule('bot-manager-cek-telat-buka');
  END IF;
END
$$;

SELECT cron.schedule(
  'bot-manager-cek-telat-buka',
  '*/5 1-13 * * *',
  'SELECT public.bot_manager_cek_outlet_telat_buka();'
);

-- ─────────────────────────────────────────────────────────── 3. Izin Mendadak Roving / Multi-Outlet Staff
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_izin_mendadak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_staff_name text;
  v_outlet_id uuid;
  v_outlet_name text;
  v_am record;
BEGIN
  IF v_tgl_wib < NEW.start_date OR v_tgl_wib > NEW.end_date THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.outlet_id, coalesce(o.name, 'Cabang SS')
  INTO v_staff_name, v_outlet_id, v_outlet_name
  FROM public.outlet_staff s
  LEFT JOIN public.outlets o ON o.id = s.outlet_id
  WHERE s.id = NEW.staff_id;

  -- Fallback untuk staf roving / multi-outlet yang tidak memiliki home outlet_id tetap
  IF v_outlet_id IS NULL THEN
    SELECT so.outlet_id, coalesce(o.name, 'Cabang SS')
    INTO v_outlet_id, v_outlet_name
    FROM public.staff_outlets so
    JOIN public.outlets o ON o.id = so.outlet_id
    WHERE so.staff_id = NEW.staff_id
    ORDER BY so.created_at DESC
    LIMIT 1;
  END IF;

  IF v_outlet_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_am IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    JOIN public.staff_outlets so ON so.staff_id = s.id
    WHERE so.outlet_id = v_outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'izin_h0_am:' || NEW.id::text,
      v_am.id,
      '👥 [OUTLET UNDERSTAFFED] Izin Mendadak Hari Ini — ' || v_outlet_name,
      format(
        E'Kru cabang binaan mengajukan %s mendadak untuk shift hari ini.\nOutlet: %s\nNama Kru: %s\nAlasan: %s\n\nPastikan ketersediaan personel shift mencukupi atau atur rolling bantuan dari cabang terdekat.',
        upper(coalesce(NEW.leave_type, 'IZIN')),
        v_outlet_name,
        coalesce(v_staff_name, 'Kru'),
        coalesce(NEW.reason, '-')
      ),
      'bot'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_izin_mendadak gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 4. Penurunan Stok Drastis (Eliminasi Blind Spot)
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar()
RETURNS trigger
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

  -- Pemicu penurunan tidak wajar: Turun >= 50% dalam 1 mutasi dan nominal penurunan >= 0.5 * threshold
  IF v_item_name IS NULL
    OR (OLD.saldo - NEW.saldo < GREATEST(v_threshold * 0.5, 1))
    OR (NEW.saldo > OLD.saldo * 0.5) THEN
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

  -- Penerima hanya tim pusat (kitchen & purchasing)
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '📉 Penurunan Stok Tidak Wajar: ' || v_item_name,
      'Bahan baku ' || v_item_name || ' di ' || v_outlet_name ||
      ' mengalami penurunan signifikan sebesar ' || v_drop_pct || '%.' ||
      E'\n\nSaldo Awal: ' || to_char(OLD.saldo, 'FM999,999,990.##') ||
      E'\nSaldo Akhir: ' || to_char(NEW.saldo, 'FM999,999,990.##') ||
      E'\nPenurunan: ' || to_char(OLD.saldo - NEW.saldo, 'FM999,999,990.##') ||
      E'\n\nMohon lakukan verifikasi mutasi stok untuk memastikan tidak terjadi kebocoran bahan.',
      'https://stok.sukashawarma.com',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_penurunan_stok_tidak_wajar gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. Presensi HRD Telat (Aman dari NULL telat_menit)
CREATE OR REPLACE FUNCTION public.bot_hrd_alert_telat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_outlet text;
BEGIN
  IF NEW.sumber <> 'absen' 
     OR NEW.clock_in IS NULL 
     OR coalesce(NEW.telat_menit, 0) <= 15
     OR NEW.tgl <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN 
    RETURN NEW; 
  END IF;

  SELECT s.name, o.name INTO v_name, v_outlet
  FROM public.outlet_staff s JOIN public.outlets o ON o.id = NEW.outlet_id
  WHERE s.id = NEW.staff_id AND s.status = 'active'
    AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra')
    AND o.is_active IS TRUE AND coalesce(o.type, '') NOT IN ('test', 'marketplace');

  IF v_name IS NULL THEN RETURN NEW; END IF;

  PERFORM public.bot_hrd_antrekan(
    'telat:' || NEW.staff_id || ':' || NEW.outlet_id || ':' || NEW.tgl,
    '⚠️ Keterlambatan lebih dari 15 menit',
    'Karyawan: ' || left(v_name, 120) || E'\nOutlet: ' || left(v_outlet, 100)
      || E'\nTanggal: ' || to_char(NEW.tgl, 'DD-MM-YYYY')
      || E'\nCheck-in: ' || to_char(NEW.clock_in AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB'
      || E'\nKeterlambatan: ' || coalesce(NEW.telat_menit, 0) || ' menit'
      || E'\nTindak lanjut HRD: konfirmasi alasan keterlambatan dan catat hasilnya di HR.'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengantrekan alert HRD: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 6. Rekap Regional Omzet Tanpa Double-Counting
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
        AND o.is_active IS TRUE
        AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
        AND o.name NOT ILIKE '%kantor pusat%'
        AND o.name NOT ILIKE '%gudang%'
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
  -- Menghitung total regional murni dari outlet unik agar bebas dari duplikasi shared mapping
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
  WHERE o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
    AND o.name NOT ILIKE '%kantor pusat%'
    AND o.name NOT ILIKE '%gudang%';

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
      AND o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
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

-- ─────────────────────────────────────────────────────────── 7. Nonaktifkan Trigger Phantom Bot Finance di Katalog
UPDATE public.bot_trigger_catalog
SET is_active = false
WHERE bot_slug = 'finance';
