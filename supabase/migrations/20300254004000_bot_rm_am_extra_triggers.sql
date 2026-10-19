-- 20300254004000_bot_rm_am_extra_triggers.sql
-- Tambahan 5 Trigger Otomatis Lapangan untuk Regional Manager (RM) & Area Manager (AM):
-- 1. Alert & Eskalasi Pembatalan Order / Void POS (orders status -> cancelled)
-- 2. Alert & Eskalasi Anomali Penurunan Stok >= 50% (stok_balance shrinkage)
-- 3. Alert Outlet Understaffed / Izin Mendadak Hari Ini (leave_requests H-0)
-- 4. Alert Cabang "Mati Suri" / Rp 0 Transaksi di Jam Sibuk (AM 14:00 WIB & Eskalasi RM 18:30 WIB)
-- 5. Alert Surat Jalan Menggantung > 2 Jam Belum Diverifikasi Cabang (AM)

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Trigger Void / Cancelled Order POS (AM & Eskalasi RM)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_void_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_void_count int := 1;
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_am record;
  v_rm record;
  v_amt numeric := coalesce(NEW.total_amount, 0);
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

  -- A. Kirim ke Area Manager pembina cabang
  FOR v_am IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    JOIN public.staff_outlets so ON so.staff_id = s.id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'void_am:' || NEW.id::text,
      v_am.id,
      '🛑 [ALERT VOID POS] Pembatalan Order di ' || v_outlet_name,
      format(
        E'Transaksi POS dibatalkan (VOID/CANCELLED) di cabang binaan Anda.\nOutlet: %s\nNilai Order: Rp %s\nTotal Void Hari Ini: %s transaksi\nWaktu: %s WIB\n\nSegera konfirmasi alasan pembatalan ke kasir/leader cabang.',
        v_outlet_name,
        to_char(v_amt, 'FM999,999,999'),
        v_void_count,
        to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
      ),
      'bot'
    );
  END LOOP;

  -- B. Eskalasi ke Regional Manager jika nilai void >= Rp 50.000 atau void beruntun >= 2x hari ini
  IF v_amt >= 50000 OR v_void_count >= 2 THEN
    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'void_rm:' || NEW.id::text,
        v_rm.id,
        '🚨 [ESKALASI RM] Void Order Mencurigakan — ' || v_outlet_name,
        format(
          E'Deteksi pembatalan order (VOID) bernilai besar / beruntun.\nOutlet: %s\nNilai Void: Rp %s\nFrekuensi Void Hari Ini: %sx di outlet ini\nWaktu: %s WIB\n\nMohon tinjau potensi anomali kasir bersama Area Manager.',
          v_outlet_name,
          to_char(v_amt, 'FM999,999,999'),
          v_void_count,
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'bot'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_void_order gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_void_order ON public.orders;
CREATE TRIGGER trg_bot_manager_void_order
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.trg_fn_bot_manager_void_order();

-- ─────────────────────────────────────────────────────────── 2. Trigger Anomali Penurunan Stok >= 50% (AM & RM)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_stok_drop50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_outlet_type text;
  v_bahan_nama text;
  v_satuan text;
  v_pct numeric;
  v_tgl_wib text := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD');
  v_target record;
BEGIN
  IF coalesce(OLD.saldo, 0) <= 2 OR coalesce(NEW.saldo, 0) > (OLD.saldo * 0.5) THEN
    RETURN NEW;
  END IF;

  SELECT name, coalesce(type, 'internal') INTO v_outlet_name, v_outlet_type
  FROM public.outlets WHERE id = NEW.outlet_id;

  IF v_outlet_name IS NULL OR lower(v_outlet_type) IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nama, 'Bahan Baku'), coalesce(satuan, 'Unit')
  INTO v_bahan_nama, v_satuan
  FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;

  v_pct := round(((OLD.saldo - NEW.saldo) / OLD.saldo) * 100, 0);

  FOR v_target IN
    SELECT DISTINCT s.id, s.role
    FROM public.outlet_staff s
    LEFT JOIN public.staff_outlets so ON so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
    WHERE s.status = 'active'
      AND (
        s.role IN ('regional_manager', 'developer')
        OR (s.role = 'area_manager' AND so.outlet_id IS NOT NULL)
      )
  LOOP
    PERFORM public.bot_manager_antrekan(
      format('drop50_mgr:%s:%s:%s', v_tgl_wib, NEW.outlet_id::text, NEW.bahan_baku_id::text),
      v_target.id,
      format('🚨 [ANOMALI STOK -%s%%] %s (%s)', v_pct::text, v_bahan_nama, v_outlet_name),
      format(
        E'Peringatan penurunan stok drastis (>=50%%) dalam satu mutasi.\nOutlet: %s\nBahan: %s\nSaldo Sebelum: %s %s -> Saldo Sekarang: %s %s (-%s%%)\n\nSegera cek kesesuaian pemakaian produksi / potensi shrinkage di cabang.',
        v_outlet_name,
        v_bahan_nama,
        round(OLD.saldo::numeric, 1)::text, v_satuan,
        round(NEW.saldo::numeric, 1)::text, v_satuan,
        v_pct::text
      ),
      'bot'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_stok_drop50 gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_stok_drop50 ON public.stok_balance;
CREATE TRIGGER trg_bot_manager_stok_drop50
  AFTER UPDATE OF saldo ON public.stok_balance
  FOR EACH ROW
  WHEN (OLD.saldo > 2 AND NEW.saldo <= (OLD.saldo * 0.5))
  EXECUTE FUNCTION public.trg_fn_bot_manager_stok_drop50();

-- ─────────────────────────────────────────────────────────── 3. Trigger Outlet Understaffed / Izin Mendadak H-0 (AM)
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

DROP TRIGGER IF EXISTS trg_bot_manager_izin_mendadak ON public.leave_requests;
CREATE TRIGGER trg_bot_manager_izin_mendadak
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_manager_izin_mendadak();

-- ─────────────────────────────────────────────────────────── 4 & 5. Fungsi Cron Cabang Rp 0 Transaksi (17:00 & 19:30) + SJ Menggantung > 2 Jam
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
BEGIN
  -- A. Alert Cabang Rp 0 Transaksi: AM (mulai 17:00 WIB setelah jam buka sore berjalan) & Eskalasi RM (mulai 19:30 WIB prime time)
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
      -- Kirim ke AM pembina cabang (1x per hari pada sesi sore >= 17:00 WIB)
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

      -- Jika sudah >= 19:30 WIB (Prime Time Malam) dan masih Rp 0, eskalasi ke Regional Manager
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
      AND coalesce(sj.updated_at, sj.created_at) <= now() - interval '2 hours'
      AND coalesce(sj.updated_at, sj.created_at) >= now() - interval '24 hours'
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
        format('sj_gantung2h_am:%s:%s', v_tgl_wib::text, v_sj.id::text),
        v_am.id,
        '📦 [SURAT JALAN MENGGANTUNG >2 JAM] ' || v_sj.outlet_name,
        format(
          E'Pengiriman bahan baku ke cabang binaan belum diverifikasi terima > 2 jam.\nOutlet: %s\nNo. SJ: %s\nDurasi Menggantung: %s jam\n\nSegera ingatkan kru outlet untuk cek fisik dan klik Terima Surat Jalan di aplikasi.',
          v_sj.outlet_name,
          v_sj.doc_no,
          v_sj.jam_gantung::text
        ),
        'bot'
      );
    END LOOP;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_cek_zero_sales_dan_sj_gantung gagal: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('bot-manager-zero-sales-sj-gantung')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-manager-zero-sales-sj-gantung');

    PERFORM cron.schedule(
      'bot-manager-zero-sales-sj-gantung',
      '*/15 * * * *',
      'SELECT public.bot_manager_cek_zero_sales_dan_sj_gantung();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mendaftarkan pg_cron bot-manager-zero-sales-sj-gantung: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────── 6. Trigger Real-time Outlet Finalize Opname (Rekap Sudah & Belum Opname ke AM & RM)
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

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  -- A. Kirim Notifikasi Real-time ke Area Manager pembina cabang ini (lengkap dengan daftar Sudah vs Belum di area binaannya)
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
        AND o.is_active IS TRUE
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
      format('📦 [OPNAME SELESAI] %s (%s/%s Cabang)', v_outlet_name, v_sudah_count::text, v_total::text),
      v_body,
      'bot'
    );
  END LOOP;

  -- B. Kirim Notifikasi Real-time ke Regional Manager (lengkap dengan daftar Sudah vs Belum se-Regional)
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
      'bot'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_opname_finalized gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_opname_finalized ON public.opname;
CREATE TRIGGER trg_bot_manager_opname_finalized
  AFTER INSERT OR UPDATE OF status ON public.opname
  FOR EACH ROW
  WHEN (NEW.status = 'finalized')
  EXECUTE FUNCTION public.trg_fn_bot_manager_opname_finalized();

-- ─────────────────────────────────────────────────────────── 7. Sinkronisasi URL Outbox Telegram & Rute In-App HP
CREATE OR REPLACE FUNCTION public.bot_manager_antrekan(
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
  -- 1. Jalur Notifikasi HP Native (SUKA Superapp): selalu arahkan ke rute in-app 'bot'
  IF EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role IN ('area_manager', 'regional_manager', 'developer')
  ) THEN
    PERFORM public.bot_kirim_push_hp(
      p_key,
      p_staff_id,
      'manager',
      p_title,
      p_body,
      'bot'
    );
  END IF;

  -- 2. Jalur Telegram Bot Manager: pastikan URL yang masuk ke outbox Telegram adalah HTTPS valid
  v_tg_url := CASE
    WHEN p_url IS NULL OR btrim(p_url) = '' OR btrim(p_url) = 'bot' OR p_url NOT LIKE 'https://%'
      THEN 'https://manager.sukashawarma.com'
    ELSE btrim(p_url)
  END;

  INSERT INTO public.bot_manager_alert_outbox(event_key, staff_id, title, body, url)
  SELECT p_key, s.id, left(p_title, 180), left(p_body, 1200), v_tg_url
  FROM public.outlet_staff s
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role IN ('area_manager', 'regional_manager', 'developer')
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_manager_antrekan(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Normalisasi antrean yang sempat tersimpan dengan url = 'bot' agar langsung terkirim ke Telegram
UPDATE public.bot_manager_alert_outbox
SET url = 'https://manager.sukashawarma.com',
    request_id = NULL,
    attempted_at = NULL
WHERE url = 'bot' AND outcome = 'pending';


