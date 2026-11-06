-- Top up saldo rekening pusat: uang masuk dari LUAR sistem (owner/atasan/modal),
-- bukan pemindahan antar rekening pusat (itu record_cash_transfer).
-- Keputusan owner 6 Nov 2026: langsung tanpa persetujuan, bukti wajib,
-- boleh ke kelima rekening pusat, bisa dibatalkan (void, tidak pernah DELETE).
-- Bukan pendapatan: tidak dibaca laporan laba mana pun.

ALTER TABLE public.cash_transaction DROP CONSTRAINT IF EXISTS cash_transaction_source_type_check;
ALTER TABLE public.cash_transaction ADD CONSTRAINT cash_transaction_source_type_check
  CHECK (source_type = ANY (ARRAY['payroll','supplier_po','expense_pusat','kasbon','cash_deposit',
    'manual','transfer','petty_cash_topup','setor_bank','income_lain','top_up']));

CREATE OR REPLACE FUNCTION public.record_top_up_saldo(
  p_location uuid, p_amount numeric, p_sumber text, p_proof_url text, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lok cash_location%ROWTYPE; v_id uuid;
BEGIN
  IF NOT (kas_pencatat_ok() OR EXISTS (
      SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat top up saldo'
      USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal top up harus lebih dari 0' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_sumber, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Sumber dana top up wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_proof_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bukti top up wajib dilampirkan' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_lok FROM cash_location WHERE id = p_location;
  IF v_lok.id IS NULL OR v_lok.grup IS NULL OR NOT v_lok.is_active THEN
    RAISE EXCEPTION 'Top up hanya ke rekening pusat yang aktif' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status,
    note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_location, 'in', p_amount, 'Top up dari ' || btrim(p_sumber), 'top_up', 'reconciled',
    nullif(btrim(coalesce(p_note, '')), ''), p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.batal_top_up_saldo(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  IF NOT (kas_pencatat_ok() OR EXISTS (
      SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh membatalkan top up'
      USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_alasan, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO v_status FROM cash_transaction
   WHERE id = p_id AND source_type = 'top_up' FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Top up tidak ditemukan' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status = 'void' THEN
    RAISE EXCEPTION 'Top up ini sudah dibatalkan' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE cash_transaction
     SET status = 'void',
         note = concat_ws(' ', note, '[Dibatalkan: ' || btrim(p_alasan) || ']')
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_top_up_saldo(uuid, numeric, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batal_top_up_saldo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_top_up_saldo(uuid, numeric, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.batal_top_up_saldo(uuid, text) TO authenticated, service_role;
