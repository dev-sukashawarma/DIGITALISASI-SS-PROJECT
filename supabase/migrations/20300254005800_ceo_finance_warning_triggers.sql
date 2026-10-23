-- 20300254005800_ceo_finance_warning_triggers.sql
-- Implementasi Trigger & Notifikasi Eksekutif Bot CEO (J.A.R.V.I.S.)
-- Domain: 4. Keuangan, Kas Kecil (Petty Cash) & Rekonsiliasi Setoran Kasir
--         1. Saldo Kas Kecil Jebol / Minus (Defisit Laci Kas Operasional)
--         2. Pengeluaran Kas Tanpa Bukti Nota Fisik (Indikasi Nota Fiktif)
--         3. Uang Setoran Tunai Menggantung di Gerai (> 48 Jam Belum Disetor)

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Saldo Kas Kecil Jebol / Minus
-- Trigger pada petty_cash_expenses saat ada pengeluaran yang membuat saldo < 0
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_petty_cash_deficit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
  v_topups numeric := 0;
  v_expenses numeric := 0;
  v_starting numeric := 0;
  v_shift_start timestamptz;
  v_shift_id uuid;
  v_outlet_nama text;
  v_ceo record;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;

  -- 1. Cek shift aktif saat ini
  SELECT id, coalesce(starting_petty_cash, 0), start_time
  INTO v_shift_id, v_starting, v_shift_start
  FROM public.shifts
  WHERE outlet_id = NEW.outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    SELECT coalesce(sum(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = NEW.outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND (created_at >= v_shift_start OR completed_at >= v_shift_start OR leader_forwarded_at >= v_shift_start);

    SELECT coalesce(sum(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = NEW.outlet_id
      AND created_at >= v_shift_start
      AND deleted_at IS NULL;

    v_balance := v_starting + v_topups - v_expenses;
  ELSE
    -- Jika di luar jam shift, evaluasi 30 hari terakhir
    SELECT coalesce(sum(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = NEW.outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND created_at >= (now() - interval '30 days');

    SELECT coalesce(sum(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = NEW.outlet_id
      AND created_at >= (now() - interval '30 days')
      AND deleted_at IS NULL;

    v_balance := v_topups - v_expenses;
  END IF;

  -- Jika saldo kas kecil jebol/minus (< 0)
  IF v_balance < 0 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('petty_cash_deficit:%s:%s', NEW.outlet_id::text, v_today::text),
        v_ceo.id,
        '🚨 [FINANCE WARNING] Saldo Kas Kecil Jebol / Minus — ' || coalesce(v_outlet_nama, 'Outlet'),
        format(
          E'Laci kas kecil gerai mengalami defisit dana (saldo negatif).\nOutlet: %s\nPengeluaran Terakhir: Rp %s (%s)\nEstimasi Saldo Kas Kecil: -Rp %s\n\nPerhatian Direksi: Kasir/Leader membelanjakan uang di luar anggaran yang tersedia. Berisiko tinggi menutupi kekurangan menggunakan uang omzet tunai kasir!',
          coalesce(v_outlet_nama, 'Outlet'),
          to_char(NEW.amount, 'FM999,999,999'),
          coalesce(NEW.description, NEW.category, 'Pengeluaran'),
          to_char(abs(v_balance), 'FM999,999,999')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_petty_cash_deficit ON public.petty_cash_expenses;
CREATE TRIGGER trg_bot_ceo_petty_cash_deficit
  AFTER INSERT ON public.petty_cash_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_finance_petty_cash_deficit();

-- Trigger tambahan pada shifts saat closing shift jika petty cash variance tekor parah
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_closing_petty_cash_variance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_nama text;
  v_ceo record;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_variance numeric := coalesce(NEW.petty_cash_variance, 0);
  v_actual numeric := coalesce(NEW.actual_ending_petty_cash, 0);
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    IF v_variance < -50000 OR v_actual < 0 THEN
      SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;

      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('petty_cash_closing_variance:%s:%s', NEW.id::text, v_today::text),
          v_ceo.id,
          '🚨 [FINANCE WARNING] Selisih Kas Kecil Tekor saat Closing Shift — ' || coalesce(v_outlet_nama, 'Outlet'),
          format(
            E'Ditemukan selisih fisik kas kecil (petty cash) tekor signifikan saat penutupan shift kasir.\nOutlet: %s\nFisik Kas Kecil Terhitung: Rp %s\nEkspektasi Sistem: Rp %s\nSelisih (Variance): -Rp %s\n\nPerhatian Direksi: Uang fisik kas kecil di laci toko tidak sesuai pembukuan. Wajib dikonfirmasi ke kasir bertugas dan Area Manager.',
            coalesce(v_outlet_nama, 'Outlet'),
            to_char(v_actual, 'FM999,999,999'),
            to_char(coalesce(NEW.expected_ending_petty_cash, 0), 'FM999,999,999'),
            to_char(abs(v_variance), 'FM999,999,999')
          ),
          'https://finance.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_finance_closing_petty_cash_variance ON public.shifts;
CREATE TRIGGER trg_bot_ceo_finance_closing_petty_cash_variance
  AFTER UPDATE OF status ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_finance_closing_petty_cash_variance();

-- ─────────────────────────────────────────────────────────── 2. Pengeluaran Kas Tanpa Bukti Nota Fisik
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_no_receipt_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_nama text;
  v_staff_nama text;
  v_ceo record;
  v_is_violation boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Kriteria pelanggaran tanpa bukti struk fisik:
  -- 1. Pengeluaran apapun >= Rp 100.000 tanpa receipt_url
  -- 2. Kategori berisiko / 'lainnya' / 'pengeluaran_outlet' >= Rp 50.000 tanpa receipt_url
  IF NEW.receipt_url IS NULL OR trim(NEW.receipt_url) = '' THEN
    IF NEW.amount >= 100000 THEN
      v_is_violation := true;
    ELSIF NEW.amount >= 50000 AND NEW.category IN ('lainnya', 'pengeluaran_outlet', 'outlet') THEN
      v_is_violation := true;
    END IF;
  END IF;

  IF v_is_violation THEN
    SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;

    -- Cari nama pencatat dari outlet_staff
    SELECT name INTO v_staff_nama FROM public.outlet_staff WHERE id = NEW.created_by;
    IF v_staff_nama IS NULL THEN
      SELECT name INTO v_staff_nama FROM public.outlet_staff WHERE auth_user_id = NEW.created_by LIMIT 1;
    END IF;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('no_receipt_expense:%s', NEW.id::text),
        v_ceo.id,
        '⚠️ [FINANCE WARNING] Pengeluaran Kas Kecil Tanpa Bukti Nota Fisik — ' || coalesce(v_outlet_nama, 'Outlet'),
        format(
          E'Tercatat pengeluaran kas operasional gerai tanpa lampiran bukti foto struk/nota fisik yang sah.\nOutlet: %s\nNominal: Rp %s\nKategori: %s\nKeterangan: %s\nPencatat: %s\n\nPerhatian Direksi: Potensi nota fiktif atau pengeluaran tidak dapat dipertanggungjawabkan saat audit. Finance wajib verifikasi fisik nota ke Leader cabang.',
          coalesce(v_outlet_nama, 'Outlet'),
          to_char(NEW.amount, 'FM999,999,999'),
          upper(replace(NEW.category, '_', ' ')),
          coalesce(NEW.description, '-'),
          coalesce(v_staff_nama, 'Kru Kasir')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_finance_no_receipt_expense ON public.petty_cash_expenses;
CREATE TRIGGER trg_bot_ceo_finance_no_receipt_expense
  AFTER INSERT ON public.petty_cash_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_finance_no_receipt_expense();

-- ─────────────────────────────────────────────────────────── 3. Uang Setoran Tunai Menggantung di Gerai (> 48 Jam)
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_setoran_tertahan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_today date := v_now_wib::date;
  v_row record;
  v_total_deposit numeric;
  v_ceo record;
  v_selisih numeric;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-ceo-setoran-tertahan')) THEN
    RETURN;
  END IF;

  -- Audit penjualan tunai dari shift yang ditutup antara 2 s/d 7 hari lalu dengan kas tunai >= Rp 300.000
  FOR v_row IN
    SELECT 
      s.outlet_id,
      o.name AS outlet_nama,
      (s.end_time AT TIME ZONE 'Asia/Jakarta')::date AS tanggal_jual,
      sum(coalesce(s.actual_ending_cash, 0)) AS total_kas_tunai,
      count(s.id) AS total_shift
    FROM public.shifts s
    JOIN public.outlets o ON o.id = s.outlet_id
    WHERE s.status = 'closed'
      AND s.end_time IS NOT NULL
      AND (s.end_time AT TIME ZONE 'Asia/Jakarta')::date BETWEEN (v_today - interval '7 days') AND (v_today - interval '2 days')
      AND public.bot_is_sales_outlet(s.outlet_id)
      AND NOT public.bot_is_outlet_tutup_sementara(s.outlet_id)
    GROUP BY s.outlet_id, o.name, (s.end_time AT TIME ZONE 'Asia/Jakarta')::date
    HAVING sum(coalesce(s.actual_ending_cash, 0)) >= 300000
    ORDER BY (s.end_time AT TIME ZONE 'Asia/Jakarta')::date ASC, o.name
  LOOP
    -- Cek total setoran tercatat di cash_transaction untuk outlet dan tanggal penjualan tersebut
    SELECT coalesce(sum(amount), 0)
    INTO v_total_deposit
    FROM public.cash_transaction
    WHERE outlet_id = v_row.outlet_id
      AND source_type = 'cash_deposit'
      AND status NOT IN ('void', 'rejected', 'cancelled')
      AND (
        sales_date = v_row.tanggal_jual
        OR (
          sales_date IS NULL 
          AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_row.tanggal_jual AND (v_row.tanggal_jual + interval '3 days')
        )
      );

    -- Bila setoran belum masuk atau masih < 70% dari uang tunai terkumpul
    IF v_total_deposit < (v_row.total_kas_tunai * 0.7) THEN
      v_selisih := v_row.total_kas_tunai - v_total_deposit;

      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('delayed_bank_deposit:%s:%s', v_row.outlet_id::text, v_row.tanggal_jual::text),
          v_ceo.id,
          '🚨 [FINANCE WARNING] Uang Setoran Tunai Belum Disetor (> 48 Jam) — ' || v_row.outlet_nama,
          format(
            E'Uang fisik penjualan tunai cabang belum tercatat disetor ke rekening bank pusat (> 48 jam).\nOutlet: %s\nTanggal Penjualan: %s (%s hari lalu)\nTotal Kasir Terkumpul: Rp %s\nSetoran Tercatat: Rp %s\nUang Kas Menggantung: Rp %s\n\nPerhatian Direksi: Uang kas mengendap di gerai berisiko hilang, digelapkan, atau dipakai pribadi (cash floating). Leader & Finance wajib segera menyetorkan dana ke Bank.',
            v_row.outlet_nama,
            to_char(v_row.tanggal_jual, 'DD Mon YYYY'),
            (v_today - v_row.tanggal_jual)::text,
            to_char(v_row.total_kas_tunai, 'FM999,999,999'),
            to_char(v_total_deposit, 'FM999,999,999'),
            to_char(v_selisih, 'FM999,999,999')
          ),
          'https://finance.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 4. Penjadwalan pg_cron untuk Setoran Tertahan (10:00 WIB)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Audit Setoran Kasir Tertahan: 10:00 WIB (03:00 UTC)
    PERFORM cron.unschedule('bot-ceo-setoran-tertahan') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-setoran-tertahan'
    );
    PERFORM cron.schedule(
      'bot-ceo-setoran-tertahan',
      '0 3 * * *',
      'SELECT public.bot_ceo_cek_setoran_tertahan();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Pendaftaran pg_cron setoran tertahan ceo dilewati: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────── 5. Registrasi ke bot_trigger_catalog (Owner & Admin)
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  -- ── OWNER (CEO) ──
  ('tg_ceo_finance_petty_cash_deficit', 'owner', 'ceo',
   'Saldo Kas Kecil Jebol / Minus (Defisit Laci Kas Operasional)',
   'Peringatan otomatis saat pengeluaran kas kecil membuat saldo outlet minus atau selisih fisik petty cash tekor parah saat closing shift.',
   'Trigger Real-Time petty_cash_expenses / shifts', true, true, 32, true),

  ('tg_ceo_finance_no_receipt_expense', 'owner', 'ceo',
   'Pengeluaran Kas Tanpa Bukti Nota Fisik (Indikasi Nota Fiktif)',
   'Deteksi pengeluaran kas operasional >= Rp 100.000 atau kategori lainnya >= Rp 50.000 tanpa lampiran bukti foto struk/nota fisik yang sah.',
   'Trigger Real-Time petty_cash_expenses -> insert', true, true, 33, true),

  ('tg_ceo_finance_delayed_bank_deposit', 'owner', 'ceo',
   'Uang Setoran Tunai Menggantung di Gerai (> 48 Jam Belum Disetor)',
   'Audit harian terhadap shift kasir tertutup yang memiliki akumulasi uang tunai >= Rp 300.000 tapi belum tercatat disetor ke rekening bank pusat > 2 hari.',
   'Cron Pagi 10:00 WIB', false, true, 34, true),

  -- ── ADMIN ──
  ('tg_admin_finance_petty_cash_deficit', 'admin', 'ceo',
   'Saldo Kas Kecil Jebol / Minus (Defisit Laci Kas Operasional)',
   'Peringatan otomatis saat pengeluaran kas kecil membuat saldo outlet minus atau selisih fisik petty cash tekor parah saat closing shift.',
   'Trigger Real-Time petty_cash_expenses / shifts', true, true, 32, true),

  ('tg_admin_finance_no_receipt_expense', 'admin', 'ceo',
   'Pengeluaran Kas Tanpa Bukti Nota Fisik (Indikasi Nota Fiktif)',
   'Deteksi pengeluaran kas operasional >= Rp 100.000 atau kategori lainnya >= Rp 50.000 tanpa lampiran bukti foto struk/nota fisik yang sah.',
   'Trigger Real-Time petty_cash_expenses -> insert', true, true, 33, true),

  ('tg_admin_finance_delayed_bank_deposit', 'admin', 'ceo',
   'Uang Setoran Tunai Menggantung di Gerai (> 48 Jam Belum Disetor)',
   'Audit harian terhadap shift kasir tertutup yang memiliki akumulasi uang tunai >= Rp 300.000 tapi belum tercatat disetor ke rekening bank pusat > 2 hari.',
   'Cron Pagi 10:00 WIB', false, true, 34, true)

ON CONFLICT (id) DO UPDATE SET
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
