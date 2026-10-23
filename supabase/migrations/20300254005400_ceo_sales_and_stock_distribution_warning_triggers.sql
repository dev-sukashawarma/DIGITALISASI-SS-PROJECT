-- 20300254005400_ceo_sales_and_stock_distribution_warning_triggers.sql
-- Implementasi Trigger & Notifikasi Eksekutif Bot CEO (J.A.R.V.I.S.)
-- Domain: 1. Sales & Penjualan (Shift Menggantung, Diskon/Voucher Abuse, Rasio Tunai Anomali, Reject App)
--         2. Stok & Distribusi (Retur Inbound SJ, SJ Menggantung Malam/Molor, Penurunan Stok Drastis, Opname Missing)

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. SALES: Shift Kasir Belum Ditutup Lewat Jam Operasional
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
      AND o.is_active = true
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
          E'Shift kasir masih berstatus OPEN melewati jam operasional malam (%s WIB).\nOutlet: %s\nKasir Bertugas: %s\nDurasi Shift Terbuka: %s Jam\nTransaksi Tercatat: %s Order (Uang Kas: Rp %s)\n\nPerhatian Direksi: Uang fisik kasir belum dihitung & direkonsiliasi. AM wajib instruksikan closing segera.',
          to_char(v_now_wib, 'HH24:MI'),
          v_shift.outlet_name,
          coalesce(v_staff_name, 'Kasir'),
          v_shift.jam_aktif::text,
          coalesce(v_total_orders, 0)::text,
          to_char(coalesce(v_total_cash, 0), 'FM999,999,999')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 2. SALES: Anomali Rasio Uang Tunai saat Closing Shift
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_cash_ratio_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_staff_name text;
  v_total_orders int := 0;
  v_total_cash numeric := 0;
  v_total_cashless numeric := 0;
  v_total_omzet numeric := 0;
  v_cash_pct numeric := 0;
  v_ceo record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets WHERE id = NEW.outlet_id;

  SELECT coalesce(name, 'Kasir') INTO v_staff_name
  FROM public.outlet_staff WHERE id = coalesce(NEW.closed_by, NEW.staff_id);

  -- Hitung transaksi selama rentang shift berjalan
  SELECT 
    count(*),
    coalesce(sum(CASE WHEN lower(payment_method) = 'cash' THEN total_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN lower(payment_method) IN ('qris', 'card', 'edc', 'transfer') THEN total_amount ELSE 0 END), 0),
    coalesce(sum(total_amount), 0)
  INTO v_total_orders, v_total_cash, v_total_cashless, v_total_omzet
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status <> 'cancelled'
    AND created_at >= NEW.start_time
    AND created_at <= coalesce(NEW.end_time, now());

  -- Ambang batas evaluasi: minimal 12 order dan omzet >= Rp 1.000.000
  IF v_total_orders >= 12 AND v_total_omzet >= 1000000 THEN
    v_cash_pct := round((v_total_cash / v_total_omzet) * 100, 1);

    -- Peringatan jika rasio tunai >= 85% (indikasi QRIS diabaikan / diarahkan tunai)
    IF v_cash_pct >= 85.0 THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('cash_ratio_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
          v_ceo.id,
          format('⚠️ [SALES WARNING] Rasio Tunai Ekstrim (%s%% Cash) — %s', v_cash_pct::text, v_outlet_name),
          format(
            E'Deteksi anomali komposisi metode pembayaran pada closing shift.\nOutlet: %s\nKasir: %s\nRasio Tunai: %s%% dari total omzet\nTotal Cash: Rp %s\nTotal QRIS/EDC: Rp %s\nTotal Struk: %s Order\nWaktu Closing: %s WIB\n\nPerhatian Direksi: Rasio normal tunai adalah 35-45%%. Waspada manipulasi transaksi atau kasir mematikan QRIS.',
            v_outlet_name,
            v_staff_name,
            v_cash_pct::text,
            to_char(v_total_cash, 'FM999,999,999'),
            to_char(v_total_cashless, 'FM999,999,999'),
            v_total_orders::text,
            to_char(coalesce(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
          ),
          'https://admin.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_cash_ratio_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_cash_ratio_alert ON public.shifts;
CREATE TRIGGER trg_bot_ceo_cash_ratio_alert
  AFTER UPDATE OF status ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_cash_ratio_alert();

-- ─────────────────────────────────────────────────────────── 3. SALES: Lonjakan Pemakaian Diskon / Eksploitasi Voucher
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_voucher_abuse_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_outlet_name text;
  v_voucher_count int := 0;
  v_total_discount numeric := 0;
  v_kasir_name text;
  v_ceo record;
BEGIN
  IF NEW.status = 'cancelled' OR coalesce(NEW.discount_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Abaikan jika order historis masa lalu tersinkronisasi offline
  IF (coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date < v_tgl_wib THEN
    RETURN NEW;
  END IF;

  SELECT count(*), coalesce(sum(discount_amount), 0)
  INTO v_voucher_count, v_total_discount
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status <> 'cancelled'
    AND coalesce(discount_amount, 0) > 0
    AND created_at >= (now() - interval '2 hours');

  -- Ambang batas: >= 10 transaksi diskon dalam 2 jam ATAU total diskon >= Rp 250.000 dalam 2 jam
  IF v_voucher_count >= 10 OR v_total_discount >= 250000 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    v_kasir_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('voucher_abuse_ceo:%s:%s', v_tgl_wib::text, NEW.outlet_id::text),
        v_ceo.id,
        '🚨 [SALES WARNING] Lonjakan Diskon / Potensi Voucher Abuse — ' || v_outlet_name,
        format(
          E'Frekuensi pemotongan diskon tidak wajar di kasir dalam rentang 2 jam.\nOutlet: %s\nKasir Terakhir: %s\nJumlah Order Berdiskon: %s Transaksi (2 Jam Terakhir)\nTotal Nilai Diskon: Rp %s\nWaktu Terdeteksi: %s WIB\n\nPerhatian Direksi: Waspada kru kasir memotong tagihan konsumen dengan voucher/promo internal dan mengantongi selisih tunai.',
          v_outlet_name,
          v_kasir_name,
          v_voucher_count::text,
          to_char(v_total_discount, 'FM999,999,999'),
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_voucher_abuse_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_voucher_abuse_alert ON public.orders;
CREATE TRIGGER trg_bot_ceo_voucher_abuse_alert
  AFTER INSERT OR UPDATE OF discount_amount, status ON public.orders
  FOR EACH ROW
  WHEN (NEW.discount_amount > 0 AND NEW.status <> 'cancelled')
  EXECUTE FUNCTION public.trg_fn_bot_ceo_voucher_abuse_alert();

-- ─────────────────────────────────────────────────────────── 4. SALES: Lonjakan Pembatalan Pesanan Retail Online oleh Kru
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_retail_store_reject_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_outlet_name text;
  v_reject_count int := 0;
  v_lost_omzet numeric := 0;
  v_alasan text;
  v_ceo record;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Hanya order yang berasal dari customer retail app/online
  IF coalesce(lower(NEW.source), '') NOT IN ('app', 'online', 'website') 
     AND coalesce(lower(NEW.channel), '') NOT IN ('app', 'online', 'website') THEN
    RETURN NEW;
  END IF;

  -- Abaikan auto-cancel kadaluwarsa
  IF coalesce(NEW.void_reason, '') ILIKE '%melewati batas waktu%' 
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%melewati batas waktu%' THEN
    RETURN NEW;
  END IF;

  -- Hitung pembatalan order retail online di outlet ini dalam 2 jam terakhir
  SELECT count(*), coalesce(sum(total_amount), 0)
  INTO v_reject_count, v_lost_omzet
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (coalesce(lower(source), '') IN ('app', 'online', 'website') OR coalesce(lower(channel), '') IN ('app', 'online', 'website'))
    AND (coalesce(void_at, updated_at, created_at) >= now() - interval '2 hours');

  IF v_reject_count >= 3 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    v_alasan := coalesce(nullif(btrim(NEW.void_reason), ''), nullif(btrim(NEW.cancellation_reason), ''), 'Dibatalkan oleh kru toko');

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('retail_reject_ceo:%s:%s', v_tgl_wib::text, NEW.outlet_id::text),
        v_ceo.id,
        '🚨 [SALES WARNING] Lonjakan Penolakan Pesanan Retail Online — ' || v_outlet_name,
        format(
          E'Kru outlet membatalkan pesanan masuk dari Aplikasi Retail Suka Shawarma berulang kali.\nOutlet: %s\nPesanan Ditolak: %s Order (2 Jam Terakhir)\nOmzet Hilang: Rp %s\nAlasan Terakhir: %s\nWaktu: %s WIB\n\nPerhatian Direksi: Lost revenue & merusak kepuasan pelanggan retail online.',
          v_outlet_name,
          v_reject_count::text,
          to_char(v_lost_omzet, 'FM999,999,999'),
          v_alasan,
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_retail_store_reject_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_retail_store_reject_alert ON public.orders;
CREATE TRIGGER trg_bot_ceo_retail_store_reject_alert
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.trg_fn_bot_ceo_retail_store_reject_alert();

-- ─────────────────────────────────────────────────────────── 5. STOK & DISTRIBUSI: Penolakan Kiriman Central Kitchen
CREATE OR REPLACE FUNCTION public.bot_ceo_alert_retur_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_reporter_name text;
  v_item_count int := 0;
  v_sample_item text;
  v_ceo record;
BEGIN
  IF NEW.tipe_retur <> 'inbound_sj' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.created_by;

  SELECT count(*), max(b.nama)
  INTO v_item_count, v_sample_item
  FROM public.retur_stok_item ri
  JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
  WHERE ri.retur_stok_id = NEW.id;

  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      format('retur_inbound_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
      v_ceo.id,
      '🚨 [DISTRIBUSI WARNING] Penolakan Kiriman Central Kitchen — ' || coalesce(v_outlet_name, 'Outlet'),
      format(
        E'Kru cabang menolak penerimaan bahan baku kiriman Central Kitchen saat kurir/armada tiba.\nOutlet: %s\nNo. Retur: %s\nItem Ditolak: %s\nPelapor: %s\nWaktu Kejadian: %s WIB\n\nPerhatian Direksi: Cold chain kendaraan logistik atau kualitas produksi CK bermasalah. Cabang berisiko kekurangan stok.',
        coalesce(v_outlet_name, 'Outlet'),
        NEW.nomor_retur,
        coalesce(v_item_count::text || ' item (' || coalesce(v_sample_item, '') || ')', 'Bahan Baku'),
        coalesce(v_reporter_name, 'Kru Cabang'),
        to_char(coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI')
      ),
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_ceo_alert_retur_inbound gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_retur_inbound ON public.retur_stok;
CREATE CONSTRAINT TRIGGER trg_bot_ceo_retur_inbound
  AFTER INSERT ON public.retur_stok
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_ceo_alert_retur_inbound();

-- ─────────────────────────────────────────────────────────── 6. STOK & DISTRIBUSI: Surat Jalan Menggantung > 3.5 Jam / Malam Hari
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

  -- B. Alert Surat Jalan Menggantung > 2 Jam Belum Diverifikasi Cabang
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

-- ─────────────────────────────────────────────────────────── 7. STOK: Penurunan Stok Drastis Eskalasi ke CEO
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
  v_ceo RECORD;
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

  -- A. Penerima tim pusat (kitchen & purchasing)
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

  -- B. Eskalasi ke Bot CEO jika penurunan drastis >= 50%
  IF v_drop_pct >= 50 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('stockdrop_ceo:%s:%s:%s', to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'), NEW.outlet_id::text, NEW.bahan_baku_id::text),
        v_ceo.id,
        '📉 [STOK WARNING] Penurunan Stok Drastis (-' || v_drop_pct || '%) — ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Deteksi anomali penurunan stok drastis dalam satu perubahan.\nOutlet: %s\nBahan Baku: %s\nSaldo Sebelum: %s -> Saldo Akhir: %s (-%s%%)\nPenurunan: %s\nWaktu Cek: %s WIB\n\nPerhatian Direksi: Disarankan audit mutasi pemakaian produksi untuk mendeteksi potensi kebocoran bahan fisik.',
          coalesce(v_outlet_name, 'Outlet'),
          v_item_name,
          to_char(OLD.saldo, 'FM999,999,990.##'),
          to_char(NEW.saldo, 'FM999,999,990.##'),
          v_drop_pct::text,
          to_char(OLD.saldo - NEW.saldo, 'FM999,999,990.##'),
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_penurunan_stok_tidak_wajar gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 8. STOK: Rekap Cabang Belum Opname Malam (23:15 WIB)
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
    WHERE o.is_active IS TRUE
      AND lower(coalesce(o.type, 'internal')) NOT IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen', 'test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
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

-- ─────────────────────────────────────────────────────────── 9. Penjadwalan pg_cron untuk Cron Baru
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Pengecekan Shift Belum Ditutup: 23:45 WIB (16:45 UTC)
    PERFORM cron.unschedule('bot-ceo-unclosed-shifts') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-unclosed-shifts'
    );
    PERFORM cron.schedule(
      'bot-ceo-unclosed-shifts',
      '45 16 * * *',
      'SELECT public.bot_ceo_cek_unclosed_shifts();'
    );

    -- Pengecekan Cabang Belum Opname: 23:15 WIB (16:15 UTC)
    PERFORM cron.unschedule('bot-ceo-opname-missing') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-opname-missing'
    );
    PERFORM cron.schedule(
      'bot-ceo-opname-missing',
      '15 16 * * *',
      'SELECT public.bot_ceo_cek_opname_terlambat_malam();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Pendaftaran pg_cron bot ceo baru dilewati: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────── 10. Registrasi ke bot_trigger_catalog (Owner & Admin)
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  -- ── OWNER (CEO) ──
  ('tg_ceo_pos_unclosed_shift', 'owner', 'ceo',
   'Shift Kasir Belum Ditutup Lewat Jam Buka (23:45 WIB)',
   'Peringatan otomatis saat shift kasir masih berstatus open lewat jam operasional malam, uang fisik kasir belum dihitung & disetor.',
   'Cron Malam 23:45 WIB', false, true, 17, true),

  ('tg_ceo_pos_cash_ratio_anomaly', 'owner', 'ceo',
   'Anomali Rasio Uang Tunai saat Closing Shift (>= 85% Cash)',
   'Deteksi kasir dengan proporsi penerimaan uang tunai tidak wajar (>= 85% cash) untuk mencegah kecurangan pematian QRIS atau manipulasi kas.',
   'Trigger Real-Time shifts -> closed', true, true, 18, true),

  ('tg_ceo_marcom_voucher_abuse', 'owner', 'ceo',
   'Lonjakan Pemotongan Diskon / Potensi Voucher Abuse di Kasir',
   'Deteksi lonjakan penggunaan voucher/diskon beruntun (>= 10x atau >= Rp 250rb dalam 2 jam) di satu kasir cabang untuk mencegah kebocoran margin.',
   'Trigger Real-Time orders -> discount_amount', true, true, 19, true),

  ('tg_ceo_retail_store_rejection_surge', 'owner', 'ceo',
   'Lonjakan Pembatalan Pesanan Retail Online oleh Kru Cabang',
   'Peringatan saat kru cabang membatalkan pesanan dari aplikasi pelanggan retail online >= 3x dalam 2 jam untuk mencegah lost revenue & komplain.',
   'Trigger Real-Time orders -> cancelled (app/online)', true, true, 20, true),

  ('tg_ceo_distribusi_inbound_rejected', 'owner', 'ceo',
   'Penolakan Bahan Baku Kiriman Central Kitchen di Cabang',
   'Eskalasi darurat ketika kru outlet menolak barang kiriman Central Kitchen saat kurir tiba (kendala mutu/basi/suhu pendingin jebol).',
   'Trigger Real-Time retur_stok -> inbound_sj', true, true, 21, true),

  ('tg_ceo_distribusi_sj_unconfirmed_night', 'owner', 'ceo',
   'Surat Jalan Central Kitchen Menggantung (> 3.5 Jam / Closing)',
   'Deteksi pengiriman barang dari Central Kitchen yang tersendat lama di perjalanan atau belum dikonfirmasi terima saat closing outlet.',
   'Cron Cek Berkala 17:00 - 23:00 WIB', false, true, 22, true),

  ('tg_ceo_stok_phantom_drop', 'owner', 'ceo',
   'Penurunan Saldo Stok Bahan Baku Drastis (>= 50%)',
   'Deteksi anomali penurunan saldo stok bahan baku utama dalam satu mutasi tunggal untuk mendeteksi potensi kebocoran fisik atau pencurian bahan.',
   'Trigger Real-Time stok_balance -> saldo drop >= 50%', true, true, 23, true),

  ('tg_ceo_stok_opname_missing', 'owner', 'ceo',
   'Rekapitulasi Cabang Belum Finalisasi Opname Malam (23:15 WIB)',
   'Peringatan cut-off malam yang merangkum daftar seluruh cabang yang belum menyelesaikan dan memfinalisasi form Stok Opname harian.',
   'Cron Malam 23:15 WIB', false, true, 24, true),

  -- ── ADMIN ──
  ('tg_admin_pos_unclosed_shift', 'admin', 'ceo',
   'Shift Kasir Belum Ditutup Lewat Jam Buka (23:45 WIB)',
   'Peringatan otomatis saat shift kasir masih berstatus open lewat jam operasional malam, uang fisik kasir belum dihitung & disetor.',
   'Cron Malam 23:45 WIB', false, true, 17, true),

  ('tg_admin_pos_cash_ratio_anomaly', 'admin', 'ceo',
   'Anomali Rasio Uang Tunai saat Closing Shift (>= 85% Cash)',
   'Deteksi kasir dengan proporsi penerimaan uang tunai tidak wajar (>= 85% cash) untuk mencegah kecurangan pematian QRIS atau manipulasi kas.',
   'Trigger Real-Time shifts -> closed', true, true, 18, true),

  ('tg_admin_marcom_voucher_abuse', 'admin', 'ceo',
   'Lonjakan Pemotongan Diskon / Potensi Voucher Abuse di Kasir',
   'Deteksi lonjakan penggunaan voucher/diskon beruntun (>= 10x atau >= Rp 250rb dalam 2 jam) di satu kasir cabang untuk mencegah kebocoran margin.',
   'Trigger Real-Time orders -> discount_amount', true, true, 19, true),

  ('tg_admin_retail_store_rejection_surge', 'admin', 'ceo',
   'Lonjakan Pembatalan Pesanan Retail Online oleh Kru Cabang',
   'Peringatan saat kru cabang membatalkan pesanan dari aplikasi pelanggan retail online >= 3x dalam 2 jam untuk mencegah lost revenue & komplain.',
   'Trigger Real-Time orders -> cancelled (app/online)', true, true, 20, true),

  ('tg_admin_distribusi_inbound_rejected', 'admin', 'ceo',
   'Penolakan Bahan Baku Kiriman Central Kitchen di Cabang',
   'Eskalasi darurat ketika kru outlet menolak barang kiriman Central Kitchen saat kurir tiba (kendala mutu/basi/suhu pendingin jebol).',
   'Trigger Real-Time retur_stok -> inbound_sj', true, true, 21, true),

  ('tg_admin_distribusi_sj_unconfirmed_night', 'admin', 'ceo',
   'Surat Jalan Central Kitchen Menggantung (> 3.5 Jam / Closing)',
   'Deteksi pengiriman barang dari Central Kitchen yang tersendat lama di perjalanan atau belum dikonfirmasi terima saat closing outlet.',
   'Cron Cek Berkala 17:00 - 23:00 WIB', false, true, 22, true),

  ('tg_admin_stok_phantom_drop', 'admin', 'ceo',
   'Penurunan Saldo Stok Bahan Baku Drastis (>= 50%)',
   'Deteksi anomali penurunan saldo stok bahan baku utama dalam satu mutasi tunggal untuk mendeteksi potensi kebocoran fisik atau pencurian bahan.',
   'Trigger Real-Time stok_balance -> saldo drop >= 50%', true, true, 23, true),

  ('tg_admin_stok_opname_missing', 'admin', 'ceo',
   'Rekapitulasi Cabang Belum Finalisasi Opname Malam (23:15 WIB)',
   'Peringatan cut-off malam yang merangkum daftar seluruh cabang yang belum menyelesaikan dan memfinalisasi form Stok Opname harian.',
   'Cron Malam 23:15 WIB', false, true, 24, true)

ON CONFLICT (id) DO UPDATE SET
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
