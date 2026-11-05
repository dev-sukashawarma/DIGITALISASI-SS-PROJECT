-- Belanja pusat dibayar dari Rekening Petty Cash (keputusan owner 5 Nov 2026).
--
-- Finance sudah mencatat belanja pusat sebagai pengeluaran di Buku Kas (tabel
-- expenses). Yang belum ada: potongan saldo rekening yang membayarnya. Kolom
-- expenses.cash_location_id menandai rekening pembayar; trigger menjaga tepat
-- satu cash_transaction (source_type 'expense_pusat') yang selaras dengan
-- baris pengeluaran itu: dibuat saat simpan, diganti saat nominal/tanggal/
-- rekening/bukti diubah, di-void saat dihapus. Sekali input -> biaya + kas.
--
-- Pengaman:
--  * rekening wajib aktif dan grup 'petty_cash';
--  * hanya untuk baris type 'expense' (bukan pemasukan / voucher kantor);
--  * pemanggil ber-login (auth.uid() terisi) wajib admin_finance/admin/owner
--    aktif. Server action Buku Kas memakai service role (auth.uid() NULL) dan
--    sudah memeriksa peran sendiri (requireRole).
--  * paling banyak satu transaksi kas non-void per pengeluaran.
-- Saldo tidak dicek: pengeluaran bisa dicatat mundur, dan menolak OPEX karena
-- saldo awal yang belum rapi lebih merugikan daripada saldo yang tampak minus.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cash_location_id uuid REFERENCES public.cash_location(id);

COMMENT ON COLUMN public.expenses.cash_location_id IS
  'Rekening pusat (grup petty_cash) yang membayar pengeluaran ini. NULL = tidak memotong saldo rekening pusat. Disinkronkan ke cash_transaction (source_type expense_pusat) oleh trigger.';

CREATE INDEX IF NOT EXISTS idx_expenses_cash_location
  ON public.expenses (cash_location_id) WHERE cash_location_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_tx_expense_pusat_aktif
  ON public.cash_transaction (source_id)
  WHERE source_type = 'expense_pusat' AND status <> 'void';

-- 1) Validasi sebelum tulis
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

  IF coalesce(NEW.type, 'expense') <> 'expense' THEN
    RAISE EXCEPTION 'Rekening pembayar hanya untuk pengeluaran (type expense), bukan %', NEW.type
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT grup, is_active INTO v_grup, v_aktif FROM cash_location WHERE id = NEW.cash_location_id;
  IF NOT FOUND OR v_aktif IS NOT TRUE THEN
    RAISE EXCEPTION 'Rekening pembayar tidak ditemukan atau sudah nonaktif'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_grup IS DISTINCT FROM 'petty_cash' THEN
    RAISE EXCEPTION 'Belanja pusat hanya boleh dibayar dari Rekening Petty Cash'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran dari rekening pusat harus lebih dari 0'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Sinkron transaksi kas setelah tulis
CREATE OR REPLACE FUNCTION public.expenses_sinkron_kas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    UPDATE cash_transaction SET status = 'void'
     WHERE source_type = 'expense_pusat' AND source_id = OLD.id AND status <> 'void';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.cash_location_id IS NOT NULL THEN
    INSERT INTO cash_transaction (
      cash_location_id, direction, amount, category, source_type, source_id,
      status, note, proof_url, created_by, outlet_id, occurred_at
    ) VALUES (
      NEW.cash_location_id, 'out', NEW.amount, 'Belanja pusat', 'expense_pusat', NEW.id,
      'paid', left(coalesce(NEW.description, ''), 500), NEW.receipt_url,
      (SELECT id FROM outlet_staff WHERE id = NEW.created_by),
      NEW.outlet_id,
      -- tanggal pengeluaran pukul 12:00 WIB, supaya laporan kas per hari ikut tanggalnya
      (NEW.expense_date::timestamp + time '12:00') AT TIME ZONE 'Asia/Jakarta'
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_cek_sumber_kas ON public.expenses;
CREATE TRIGGER trg_expenses_cek_sumber_kas
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_cek_sumber_kas();

DROP TRIGGER IF EXISTS trg_expenses_sinkron_kas ON public.expenses;
CREATE TRIGGER trg_expenses_sinkron_kas
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_sinkron_kas();

REVOKE ALL ON FUNCTION public.expenses_cek_sumber_kas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expenses_sinkron_kas() FROM PUBLIC, anon, authenticated;
