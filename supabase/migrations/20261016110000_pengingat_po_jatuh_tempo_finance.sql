-- Pengingat PO finance yang jatuh tempo dalam 3 hari atau sudah lewat tempo.
-- Hanya PO barang yang sudah diterima dan belum berstatus paid yang dihitung.
-- Alert baru dikirim saat PO masuk jendela pengingat; kasus yang tetap terbuka
-- diringkas kembali setiap Senin.

CREATE TABLE IF NOT EXISTS public.finance_po_pengingat_push_log (
  tanggal DATE PRIMARY KEY,
  kunci TEXT[] NOT NULL,
  jumlah_po INTEGER NOT NULL,
  jumlah_penerima INTEGER NOT NULL,
  dibuat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finance_po_pengingat_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_po_pengingat_push_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_po_pengingat_kandidat(p_today DATE DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date)
RETURNS TABLE (
  po_id UUID,
  nomor_po TEXT,
  supplier_nama TEXT,
  jatuh_tempo DATE,
  hari_ke_tempo INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.id,
         po.nomor_po,
         po.supplier_nama,
         po.jatuh_tempo,
         po.jatuh_tempo - p_today
  FROM public.purchase_order po
  WHERE po.status IN ('sebagian_diterima', 'diterima_lengkap')
    AND po.payment_status = 'unpaid'
    AND po.jatuh_tempo IS NOT NULL
    AND po.jatuh_tempo <= p_today + 3
  ORDER BY po.jatuh_tempo, po.nomor_po;
$$;

REVOKE ALL ON FUNCTION public.finance_po_pengingat_kandidat(DATE) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_kirim_pengingat_po_jatuh_tempo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_all TEXT[];
  v_previous TEXT[];
  v_new TEXT[];
  v_due_today INTEGER := 0;
  v_overdue INTEGER := 0;
  v_soon INTEGER := 0;
  v_url TEXT;
  v_key TEXT;
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

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Pengingat PO finance dilewati: secret push belum tersedia.';
    RETURN 'secret push belum tersedia';
  END IF;

  v_title := '💳 Pengingat jatuh tempo PO';
  v_body := COALESCE(v_overdue, 0) || ' PO lewat jatuh tempo, '
    || COALESCE(v_due_today, 0) || ' jatuh tempo hari ini, dan '
    || COALESCE(v_soon, 0) || ' jatuh tempo dalam 3 hari. Buka Finance untuk menindaklanjuti.';

  FOR r IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin_finance', 'owner', 'admin', 'purchase', 'purchasing')
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', r.id,
          'app', 'finance',
          'title', v_title,
          'body', v_body,
          'url', 'https://finance.sukashawarma.com/pembelian/invoice'
        )
      );
      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim pengingat PO kepada staf %: %', r.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.finance_po_pengingat_push_log (tanggal, kunci, jumlah_po, jumlah_penerima)
  VALUES (v_today, COALESCE(v_all, '{}'::text[]), cardinality(v_all), v_recipients);

  RETURN 'pengingat diproses untuk ' || cardinality(v_all) || ' PO; permintaan push ke ' || v_recipients || ' penerima';
END;
$$;

REVOKE ALL ON FUNCTION public.finance_kirim_pengingat_po_jatuh_tempo() FROM PUBLIC, anon, authenticated;

-- Transaksi treasury yang masuk status pending_approval langsung memberi tahu
-- approver Finance. Data bukti, rekening, dan catatan bebas tidak dimasukkan ke
-- payload push.
CREATE OR REPLACE FUNCTION public.finance_push_transaksi_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_label TEXT;
  v_penerima RECORD;
BEGIN
  IF NEW.status <> 'pending_approval'
    OR (TG_OP = 'UPDATE' AND OLD.status = 'pending_approval') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
    RAISE WARNING 'Push transaksi Finance dilewati: secret push belum tersedia.';
    RETURN NEW;
  END IF;

  v_label := CASE NEW.source_type
    WHEN 'supplier_po' THEN 'Pembayaran supplier'
    WHEN 'expense_pusat' THEN 'Pengeluaran pusat'
    WHEN 'cash_deposit' THEN 'Setoran outlet'
    WHEN 'payroll' THEN 'Pembayaran payroll'
    WHEN 'kasbon' THEN 'Transaksi kasbon'
    WHEN 'transfer' THEN 'Transfer kas'
    ELSE 'Transaksi keuangan'
  END;

  FOR v_penerima IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin_finance', 'owner', 'admin')
      AND s.id IS DISTINCT FROM NEW.created_by
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_penerima.id,
          'app', 'finance',
          'title', '⏳ Transaksi menunggu persetujuan',
          'body', v_label || ' sebesar Rp' || to_char(NEW.amount, 'FM999G999G999G999G990') || ' menunggu ditinjau.',
          'url', 'https://finance.sukashawarma.com/transaksi'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim push transaksi Finance % kepada staf %: %', NEW.id, v_penerima.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_push_transaksi_pending() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_finance_push_transaksi_pending ON public.cash_transaction;
CREATE TRIGGER trg_finance_push_transaksi_pending
  AFTER INSERT OR UPDATE OF status ON public.cash_transaction
  FOR EACH ROW
  EXECUTE FUNCTION public.finance_push_transaksi_pending();

DO $$ BEGIN
  PERFORM cron.unschedule('finance-po-jatuh-tempo-pengingat');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- pg_cron memakai UTC: 01:15 UTC = 08:15 WIB.
SELECT cron.schedule(
  'finance-po-jatuh-tempo-pengingat',
  '15 1 * * *',
  $cron$SELECT public.finance_kirim_pengingat_po_jatuh_tempo();$cron$
);
