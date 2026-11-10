-- Voucher dana kantor yang disetujui masuk laporan OPEX.
--
-- Sejak fitur voucher kantor dibuat, persetujuan menyimpan baris expenses dengan
-- type 'office_settled'. Semua pembaca OPEX (Buku Kas, Laba Rugi, ekspor,
-- Ringkasan Bisnis get_owner_dashboard_summary) hanya membaca type 'expense',
-- jadi voucher yang disetujui tidak pernah terhitung sebagai biaya.
--
-- Mulai sekarang persetujuan menulis type 'expense' (outlet_id NULL, kategori
-- pengeluaran_global = biaya Pusat: masuk Laba Perusahaan, tidak ke laba outlet/
-- mitra). Penanda [OFFICE_VCR] di description tetap, jadi voucher tetap tampil
-- di daftar dana kantor.
--
-- 1) expenses_sinkron_kas: kategori transaksi kas 'OPEX kantor' dikenali dari
--    penanda [OFFICE_VCR] (bukan lagi type 'office_settled').
-- 2) Data: voucher November 2026 yang sudah disetujui (type office_settled)
--    dipindah ke type 'expense'. Mengubah type saja tidak menulis ulang
--    transaksi kas (trigger hanya bereaksi pada rekening/nominal/tanggal/bukti/
--    keterangan), jadi saldo rekening tidak bergerak.
--
-- type 'office_settled' tetap diterima expenses_cek_sumber_kas (20261110120000)
-- untuk baris lama.

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
      CASE WHEN NEW.type = 'office_settled' OR coalesce(NEW.description, '') LIKE '%[OFFICE_VCR]%'
           THEN 'OPEX kantor' ELSE 'Belanja pusat' END,
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

REVOKE ALL ON FUNCTION public.expenses_sinkron_kas() FROM PUBLIC, anon, authenticated;

UPDATE public.expenses
   SET type = 'expense'
 WHERE type = 'office_settled'
   AND outlet_id IS NULL
   AND description LIKE '%[OFFICE_VCR]%'
   AND expense_date >= '2026-11-01';
