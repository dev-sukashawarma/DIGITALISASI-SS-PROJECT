-- Verifikasi voucher dana kantor (OPEX Kantor) memotong saldo rekening pusat.
--
-- Voucher kantor disimpan di expenses (outlet_id NULL, type office_*). Saat
-- finance menyetujuinya di Hub Approval, baris berubah ke type 'office_settled'
-- dan kini juga diberi cash_location_id = rekening pusat pembayar. Trigger kas
-- pusat yang sama dengan Buku Kas (expenses_sinkron_kas) lalu menulis tepat satu
-- cash_transaction 'out' sebesar nominal akhir yang disetujui.
--
-- Perubahan dari 20261106120000 / 20261105140000:
--  * expenses_cek_sumber_kas: rekening pembayar boleh untuk type 'expense' ATAU
--    'office_settled' (voucher yang sudah disetujui). Voucher yang belum
--    disetujui (office_advance / office_waiting_verification / office_rejected)
--    tetap ditolak, jadi saldo baru terpotong saat persetujuan.
--  * expenses_sinkron_kas: kategori transaksi kas 'OPEX kantor' untuk voucher,
--    'Belanja pusat' untuk pengeluaran Buku Kas (seperti sebelumnya).

CREATE OR REPLACE FUNCTION public.expenses_cek_sumber_kas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_grup text; v_aktif boolean;
BEGIN
  IF NEW.cash_location_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.cash_location_id IS NOT DISTINCT FROM OLD.cash_location_id
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.expense_date IS NOT DISTINCT FROM OLD.expense_date
     AND NEW.type IS NOT DISTINCT FROM OLD.type THEN
    RETURN NEW;  -- tidak menyentuh sisi kas
  END IF;

  IF auth.uid() IS NOT NULL AND NOT (
       kas_pencatat_ok()
       OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')
     ) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat pengeluaran dari rekening pusat'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(NEW.type, 'expense') NOT IN ('expense', 'office_settled') THEN
    RAISE EXCEPTION 'Rekening pembayar hanya untuk pengeluaran (type expense) atau voucher kantor yang disetujui, bukan %', NEW.type
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT grup, is_active INTO v_grup, v_aktif FROM cash_location WHERE id = NEW.cash_location_id;
  IF NOT FOUND OR v_aktif IS NOT TRUE THEN
    RAISE EXCEPTION 'Rekening pembayar tidak ditemukan atau sudah nonaktif'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_grup IS NULL THEN
    RAISE EXCEPTION 'Pengeluaran hanya boleh dibayar dari rekening pusat'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran dari rekening pusat harus lebih dari 0'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

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
      NEW.cash_location_id, 'out', NEW.amount,
      CASE WHEN NEW.type = 'office_settled' THEN 'OPEX kantor' ELSE 'Belanja pusat' END,
      'expense_pusat', NEW.id,
      'paid', left(coalesce(NEW.description, ''), 500), NEW.receipt_url,
      (SELECT id FROM outlet_staff WHERE id = NEW.created_by),
      NEW.outlet_id, v_waktu
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.expenses_cek_sumber_kas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expenses_sinkron_kas() FROM PUBLIC, anon, authenticated;
