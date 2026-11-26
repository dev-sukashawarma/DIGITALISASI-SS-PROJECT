-- ============================================================================
-- Push Notification Hub Approval Finance (Dual-Delivery FCM + Realtime)
-- Seluruh notifikasi untuk role admin_finance diarahkan ke halaman web:
-- https://finance.sukashawarma.com/approval (tanpa emoji pada konten).
-- ============================================================================

-- 1. Helper terpusat pengiriman push ke seluruh staf aktif ber-role admin_finance
CREATE OR REPLACE FUNCTION public.finance_kirim_push_approval(
  p_event_key text,
  p_title text,
  p_body text,
  p_exclude_staff_id uuid DEFAULT NULL,
  p_url text DEFAULT 'https://finance.sukashawarma.com/approval'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_webhook_url text;
  v_webhook_key text;
  v_clean_key text;
  v_clean_url text;
  v_inserted_id bigint;
  v_recip record;
BEGIN
  IF coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_body), '') = '' THEN
    RETURN;
  END IF;

  v_clean_key := coalesce(nullif(btrim(p_event_key), ''), 'fin:' || gen_random_uuid()::text);
  v_clean_url := coalesce(nullif(btrim(p_url), ''), 'https://finance.sukashawarma.com/approval');

  SELECT decrypted_secret INTO v_webhook_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;

  SELECT decrypted_secret INTO v_webhook_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

  FOR v_recip IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.role = 'admin_finance'
      AND s.status = 'active'
      AND COALESCE(s.is_active, true)
      AND (p_exclude_staff_id IS NULL OR s.id IS DISTINCT FROM p_exclude_staff_id)
  LOOP
    v_inserted_id := NULL;

    INSERT INTO public.bot_app_notifications (
      event_key, staff_id, bot_slug, title, body, route
    ) VALUES (
      v_clean_key,
      v_recip.id,
      'finance',
      left(p_title, 180),
      left(p_body, 3800),
      v_clean_url
    )
    ON CONFLICT (event_key, staff_id) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL AND coalesce(v_webhook_url, '') <> '' AND coalesce(v_webhook_key, '') <> '' THEN
      PERFORM net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_webhook_key
        ),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'finance',
          'type', 'bot_alert',
          'event_key', v_clean_key,
          'title', left(p_title, 180),
          'body', left(p_body, 1200),
          'url', v_clean_url
        )
      );
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengirim notifikasi approval Finance (%): %', p_event_key, SQLERRM;
END;
$function$;

-- 2. Antrean 1: Petty Cash Topup (status = forwarded_to_finance)
CREATE OR REPLACE FUNCTION public.petty_cash_topup_push_baru()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_outlet text;
  v_nominal text;
  v_desc text;
  v_recip record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'forwarded_to_finance' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'forwarded_to_finance' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999'), ',', '.');
    v_desc := CASE WHEN COALESCE(btrim(NEW.description), '') <> ''
      THEN ' · ' || left(btrim(NEW.description), 80) ELSE '' END;

    -- 1. Info pantauan ke AM binaan
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
      FOR v_recip IN
        SELECT s.id
        FROM public.staff_outlets so
        JOIN public.outlet_staff s ON s.id = so.staff_id
        WHERE so.outlet_id = NEW.outlet_id
          AND s.role = 'area_manager'
          AND s.status = 'active'
          AND COALESCE(s.is_active, true)
          AND s.id IS DISTINCT FROM NEW.created_by
      LOOP
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          body := jsonb_build_object(
            'user_id', v_recip.id,
            'app', 'manager',
            'title', 'Info Pengajuan Top Up · ' || COALESCE(v_outlet, 'Outlet'),
            'body', 'Top up petty cash Rp ' || v_nominal || v_desc || '. Langsung diproses Finance.',
            'url', 'manager_petty_cash'
          )
        );
      END LOOP;
    END IF;

    -- 2. Push Dual-Delivery ke Admin Finance -> Web Hub Approval
    PERFORM public.finance_kirim_push_approval(
      'fin_pc_topup:' || NEW.id::text,
      'Top Up Petty Cash Menunggu ACC · ' || COALESCE(v_outlet, 'Outlet'),
      'Pengajuan Rp ' || v_nominal || v_desc || '. Batas proses pukul 16:00 WIB.',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push topup baru %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_petty_cash_topup_push_baru
  AFTER INSERT OR UPDATE OF status ON public.petty_cash_topups
  FOR EACH ROW
  EXECUTE FUNCTION public.petty_cash_topup_push_baru();

-- 3. Antrean 2: Pengeluaran Petty Cash Kasir POS (status = pending)
CREATE OR REPLACE FUNCTION public.petty_cash_expense_push_am_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_outlet text;
  v_kategori text;
  v_nominal text;
  v_desc text;
  v_judul_am text;
  v_isi_am text;
  v_judul_fin text;
  v_isi_fin text;
  v_recip record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_kategori := CASE NEW.category
      WHEN 'pengeluaran_outlet' THEN 'Outlet'
      WHEN 'bahan_baku' THEN 'Bahan baku lainnya'
      WHEN 'gas' THEN 'Gas'
      WHEN 'transport' THEN 'Transport'
      WHEN 'pln' THEN 'Listrik'
      WHEN 'pdam' THEN 'Air'
      WHEN 'internet' THEN 'Internet'
      WHEN 'lembur' THEN 'Overtime'
      WHEN 'endorsement' THEN 'Endorsement'
      WHEN 'rab' THEN 'RAB'
      ELSE initcap(replace(COALESCE(NEW.category, 'pengeluaran'), '_', ' '))
    END;
    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999'), ',', '.');
    v_desc := CASE WHEN COALESCE(btrim(NEW.description), '') <> ''
      THEN ' · ' || left(btrim(NEW.description), 80) ELSE '' END;

    -- 1. Info pantauan ke AM binaan
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
      v_judul_am := 'Info Pengeluaran Outlet · ' || COALESCE(v_outlet, 'Outlet');
      v_isi_am := v_kategori || ' Rp ' || v_nominal || v_desc || '. Sedang menunggu ACC Finance.';

      FOR v_recip IN
        SELECT s.id
        FROM public.staff_outlets so
        JOIN public.outlet_staff s ON s.id = so.staff_id
        WHERE so.outlet_id = NEW.outlet_id
          AND s.role = 'area_manager'
          AND s.status = 'active'
          AND COALESCE(s.is_active, true)
          AND s.id IS DISTINCT FROM NEW.created_by
      LOOP
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          body := jsonb_build_object(
            'user_id', v_recip.id,
            'app', 'manager',
            'title', v_judul_am,
            'body', v_isi_am,
            'url', 'manager_petty_cash_pengeluaran'
          )
        );
      END LOOP;
    END IF;

    -- 2. Push Dual-Delivery ke Admin Finance -> Web Hub Approval
    v_judul_fin := 'Pengeluaran Outlet Menunggu ACC · ' || COALESCE(v_outlet, 'Outlet');
    v_isi_fin := v_kategori || ' Rp ' || v_nominal || v_desc || '. Kasir belum bisa tutup shift sebelum diproses.';

    PERFORM public.finance_kirim_push_approval(
      'fin_pc_exp:' || NEW.id::text,
      v_judul_fin,
      v_isi_fin,
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push pengeluaran petty cash %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 4. Antrean 3 & 4: Purchase Order (PO Menunggu Approval & Pembayaran Tagihan Vendor)
CREATE OR REPLACE FUNCTION public.po_push_finance_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_nominal_bayar numeric := 0;
  v_vendor text;
BEGIN
  BEGIN
    v_vendor := COALESCE(NULLIF(btrim(NEW.supplier_nama), ''), 'Vendor');

    -- A. PO diajukan ke Finance (status = menunggu_approval_finance)
    IF NEW.status = 'menunggu_approval_finance'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'menunggu_approval_finance') THEN
      SELECT COALESCE(SUM(subtotal), 0)
      INTO v_total
      FROM public.purchase_order_item
      WHERE purchase_order_id = NEW.id;

      PERFORM public.finance_kirim_push_approval(
        'fin_po_acc:' || NEW.id::text || ':' || txid_current()::text,
        'PO Menunggu Approval Finance · ' || COALESCE(NEW.nomor_po, 'PO'),
        v_vendor
          || CASE WHEN v_total > 0
               THEN ' · Rp ' || replace(to_char(v_total, 'FM999,999,999,999'), ',', '.')
               ELSE ''
             END
          || '. Ketuk untuk meninjau di Hub Approval.',
        NULL
      );
    END IF;

    -- B. Tagihan PO diajukan untuk pembayaran vendor (payment_status = pending)
    IF NEW.payment_status = 'pending'
       AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'pending') THEN
      IF NEW.cash_transaction_id IS NOT NULL THEN
        SELECT COALESCE(amount, 0)
        INTO v_nominal_bayar
        FROM public.cash_transaction
        WHERE id = NEW.cash_transaction_id;
      END IF;

      IF COALESCE(v_nominal_bayar, 0) <= 0 THEN
        SELECT COALESCE(SUM(subtotal), 0)
        INTO v_nominal_bayar
        FROM public.purchase_order_item
        WHERE purchase_order_id = NEW.id;
      END IF;

      PERFORM public.finance_kirim_push_approval(
        'fin_po_bayar:' || NEW.id::text || ':' || COALESCE(NEW.cash_transaction_id::text, txid_current()::text),
        'Tagihan Vendor Menunggu Pembayaran · ' || COALESCE(NEW.nomor_po, 'PO'),
        v_vendor
          || CASE WHEN v_nominal_bayar > 0
               THEN ' · Rp ' || replace(to_char(v_nominal_bayar, 'FM999,999,999,999'), ',', '.')
               ELSE ''
             END
          || '. Ketuk untuk memproses di Hub Approval.',
        NULL
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push PO Finance %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_po_push_finance_approval
  AFTER INSERT OR UPDATE OF status, payment_status ON public.purchase_order
  FOR EACH ROW
  EXECUTE FUNCTION public.po_push_finance_approval();

-- 5. Antrean 5: Kasbon Karyawan Menunggu Pencairan Finance (status_hr = approved & status = menunggu_cair)
CREATE OR REPLACE FUNCTION public.kasbon_push_finance_cair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nama text;
  v_outlet text;
  v_nominal text;
BEGIN
  IF NOT (
    NEW.status_hr = 'approved'
    AND NEW.status = 'menunggu_cair'
    AND (
      TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM 'menunggu_cair'
      OR OLD.status_hr IS DISTINCT FROM 'approved'
    )
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT s.name, o.name
    INTO v_nama, v_outlet
    FROM public.outlet_staff s
    LEFT JOIN public.outlets o ON o.id = s.outlet_id
    WHERE s.id = NEW.staff_id;

    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999'), ',', '.');

    PERFORM public.finance_kirim_push_approval(
      'fin_kasbon_cair:' || NEW.id::text || ':' || txid_current()::text,
      'Kasbon Menunggu Pencairan · ' || COALESCE(v_nama, 'Karyawan'),
      'Nominal Rp ' || v_nominal
        || CASE WHEN COALESCE(v_outlet, '') <> '' THEN ' (' || v_outlet || ')' ELSE '' END
        || '. Disetujui HR, menunggu pencairan Finance.',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push pencairan kasbon Finance %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_kasbon_push_finance_cair
  AFTER INSERT OR UPDATE OF status, status_hr ON public.cash_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.kasbon_push_finance_cair();

-- 6. Antrean 6: Voucher Kas Kantor Menunggu Verifikasi (outlet_id IS NULL & type = office_waiting_verification)
CREATE OR REPLACE FUNCTION public.voucher_kantor_push_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vcr text := '';
  v_ringkasan text := '';
  v_json_part text;
  v_parsed jsonb;
  v_nominal text;
BEGIN
  IF NOT (
    NEW.outlet_id IS NULL
    AND NEW.type = 'office_waiting_verification'
    AND (TG_OP = 'INSERT' OR OLD.type IS DISTINCT FROM 'office_waiting_verification')
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF COALESCE(NEW.description, '') LIKE '[OFFICE_VCR] %' THEN
      BEGIN
        v_json_part := split_part(substr(NEW.description, 14), ' | ', 1);
        v_ringkasan := btrim(split_part(substr(NEW.description, 14), ' | ', 2));
        v_parsed := v_json_part::jsonb;
        v_vcr := COALESCE(v_parsed->>'vcr', '');
      EXCEPTION WHEN OTHERS THEN
        v_ringkasan := left(btrim(NEW.description), 100);
      END;
    ELSE
      v_ringkasan := left(btrim(COALESCE(NEW.description, '')), 100);
    END IF;

    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999'), ',', '.');

    PERFORM public.finance_kirim_push_approval(
      'fin_voucher_kantor:' || NEW.id::text || ':' || txid_current()::text,
      'Voucher Kas Kantor Menunggu Verifikasi'
        || CASE WHEN v_vcr <> '' THEN ' · ' || v_vcr ELSE '' END,
      'Realisasi Rp ' || v_nominal
        || CASE WHEN v_ringkasan <> '' THEN ' · ' || left(v_ringkasan, 100) ELSE '' END
        || '. Ketuk untuk verifikasi di Hub Approval.',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push voucher kantor Finance %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_voucher_kantor_push_finance
  AFTER INSERT OR UPDATE OF type ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.voucher_kantor_push_finance();

-- 7. Antrean 7: Retur Vendor Menunggu Keputusan Finance (status = diajukan)
CREATE OR REPLACE FUNCTION public.retur_vendor_push_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supplier text;
  v_alasan text;
BEGIN
  IF NOT (
    NEW.status = 'diajukan'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'diajukan')
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT nama INTO v_supplier FROM public.supplier WHERE id = NEW.supplier_id;
    v_alasan := CASE NEW.alasan
      WHEN 'rusak' THEN 'Barang rusak'
      WHEN 'kualitas_tidak_sesuai' THEN 'Kualitas tidak sesuai'
      WHEN 'salah_kirim' THEN 'Salah kirim'
      WHEN 'kadaluarsa' THEN 'Kadaluarsa'
      ELSE 'Lainnya'
    END;

    PERFORM public.finance_kirim_push_approval(
      'fin_retur_vendor:' || NEW.id::text || ':' || txid_current()::text,
      'Retur Vendor Menunggu Persetujuan · ' || COALESCE(NEW.nomor, 'Retur'),
      COALESCE(v_supplier, 'Vendor') || ' · Alasan: ' || v_alasan
        || '. Ketuk untuk memutuskan di Hub Approval.',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push retur vendor Finance %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_retur_vendor_push_finance
  AFTER INSERT OR UPDATE OF status ON public.retur_vendor
  FOR EACH ROW
  EXECUTE FUNCTION public.retur_vendor_push_finance();

-- 8. Pengingat PO Jatuh Tempo: tanpa emoji & arahkan admin_finance ke Web Approval
CREATE OR REPLACE FUNCTION public.finance_kirim_pengingat_po_jatuh_tempo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_all TEXT[];
  v_previous TEXT[];
  v_new TEXT[];
  v_due_today INTEGER := 0;
  v_overdue INTEGER := 0;
  v_soon INTEGER := 0;
  v_recipients INTEGER := 0;
  v_title TEXT;
  v_body TEXT;
  r RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('finance-po-pengingat-jatuh-tempo'));

  IF EXISTS (SELECT 1 FROM public.finance_po_pengingat_push_log WHERE tanggal = v_today) THEN
    RETURN 'sudah dikirim hari ini';
  END IF;

  SELECT array_agg(kunci ORDER BY kunci),
         count(*) FILTER (WHERE hari_ke_tempo = 0)::int,
         count(*) FILTER (WHERE hari_ke_tempo < 0)::int,
         count(*) FILTER (WHERE hari_ke_tempo BETWEEN 1 AND 3)::int
  INTO v_all, v_due_today, v_overdue, v_soon
  FROM (
    SELECT c.po_id::text || ':' || c.jatuh_tempo::text AS kunci, c.hari_ke_tempo
    FROM public.finance_po_pengingat_kandidat(v_today) c
  ) kandidat;

  IF COALESCE(cardinality(v_all), 0) = 0 THEN
    RETURN 'tidak ada PO mendekati jatuh tempo';
  END IF;

  SELECT l.kunci INTO v_previous
  FROM public.finance_po_pengingat_push_log l
  ORDER BY l.tanggal DESC LIMIT 1;

  SELECT array_agg(k) INTO v_new
  FROM unnest(COALESCE(v_all, '{}'::text[])) AS k
  WHERE NOT (k = ANY(COALESCE(v_previous, '{}'::text[])));

  IF COALESCE(cardinality(v_new), 0) = 0 AND extract(isodow FROM v_today) <> 1 THEN
    RETURN 'tidak ada kasus PO baru';
  END IF;

  v_title := 'Pengingat Jatuh Tempo PO';
  v_body := COALESCE(v_overdue, 0) || ' PO lewat jatuh tempo, '
    || COALESCE(v_due_today, 0) || ' jatuh tempo hari ini, dan '
    || COALESCE(v_soon, 0) || ' jatuh tempo dalam 3 hari. Buka modul Finance / Purchasing untuk menindaklanjuti.';

  FOR r IN
    SELECT DISTINCT s.id, s.role
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND COALESCE(s.is_active, true)
      AND s.role IN ('admin_finance', 'owner', 'admin', 'purchasing')
  LOOP
    BEGIN
      IF r.role = 'purchasing' THEN
        PERFORM public.bot_telegram_kirim_alert(
          r.id,
          'stok',
          v_title,
          v_body,
          'https://finance.sukashawarma.com/pembelian/invoice',
          NULL,
          'po_jatuh_tempo:' || v_today::text
        );
      ELSE
        PERFORM public.bot_kirim_push_hp(
          'po_jatuh_tempo:' || v_today::text,
          r.id,
          CASE WHEN r.role = 'admin_finance' THEN 'finance' ELSE 'ceo' END,
          v_title,
          v_body,
          CASE WHEN r.role = 'admin_finance' THEN 'https://finance.sukashawarma.com/approval' ELSE 'bot' END
        );
      END IF;
      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim pengingat PO kepada staf %: %', r.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.finance_po_pengingat_push_log (tanggal, kunci, jumlah_po, jumlah_penerima)
  VALUES (v_today, COALESCE(v_all, '{}'::text[]), cardinality(v_all), v_recipients)
  ON CONFLICT (tanggal) DO UPDATE
    SET kunci = EXCLUDED.kunci,
        jumlah_po = EXCLUDED.jumlah_po,
        jumlah_penerima = EXCLUDED.jumlah_penerima,
        dibuat_at = NOW();

  RETURN 'pengingat diproses untuk ' || cardinality(v_all) || ' PO; permintaan push ke ' || v_recipients || ' penerima';
END;
$function$;
