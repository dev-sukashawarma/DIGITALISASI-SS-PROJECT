-- Perbaikan 20261105130000: jam transaksi kas belanja pusat.
--
-- Versi awal memberi occurred_at = tanggal pengeluaran pukul 12:00 WIB. Akibatnya
-- belanja yang dicatat sore/malam terurut SEBELUM transaksi pagi-siang hari itu
-- (mis. penyesuaian saldo awal 13:51), sehingga saldo berjalan di Mutasi Rekening
-- sempat minus. Sekarang: tanggal pengeluaran + jam saat dicatat (WIB). Saat
-- pengeluaran diedit tanpa mengganti tanggal, jam transaksi lama dipertahankan.

CREATE OR REPLACE FUNCTION public.expenses_sinkron_kas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_waktu timestamptz;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.cash_location_id IS NOT DISTINCT FROM OLD.cash_location_id
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.expense_date IS NOT DISTINCT FROM OLD.expense_date
     AND NEW.receipt_url IS NOT DISTINCT FROM OLD.receipt_url
     AND NEW.description IS NOT DISTINCT FROM OLD.description THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF TG_OP = 'UPDATE' AND NEW.expense_date IS NOT DISTINCT FROM OLD.expense_date THEN
      SELECT occurred_at INTO v_waktu FROM cash_transaction
       WHERE source_type = 'expense_pusat' AND source_id = OLD.id AND status <> 'void'
       LIMIT 1;
    END IF;
    UPDATE cash_transaction SET status = 'void'
     WHERE source_type = 'expense_pusat' AND source_id = OLD.id AND status <> 'void';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.cash_location_id IS NOT NULL THEN
    v_waktu := coalesce(
      v_waktu,
      (NEW.expense_date + (now() AT TIME ZONE 'Asia/Jakarta')::time) AT TIME ZONE 'Asia/Jakarta'
    );
    INSERT INTO cash_transaction (
      cash_location_id, direction, amount, category, source_type, source_id,
      status, note, proof_url, created_by, outlet_id, occurred_at
    ) VALUES (
      NEW.cash_location_id, 'out', NEW.amount, 'Belanja pusat', 'expense_pusat', NEW.id,
      'paid', left(coalesce(NEW.description, ''), 500), NEW.receipt_url,
      (SELECT id FROM outlet_staff WHERE id = NEW.created_by),
      NEW.outlet_id, v_waktu
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.expenses_sinkron_kas() FROM PUBLIC, anon, authenticated;

-- Transaksi yang sudah terlanjur berjam 12:00: pakai jam saat dicatat.
-- (Mengubah occurred_at tidak menggerakkan saldo: trigger saldo hanya bereaksi pada status.)
UPDATE cash_transaction t
   SET occurred_at = (e.expense_date + (t.created_at AT TIME ZONE 'Asia/Jakarta')::time) AT TIME ZONE 'Asia/Jakarta'
  FROM expenses e
 WHERE t.source_type = 'expense_pusat' AND t.source_id = e.id
   AND (t.occurred_at AT TIME ZONE 'Asia/Jakarta')::time = time '12:00';
