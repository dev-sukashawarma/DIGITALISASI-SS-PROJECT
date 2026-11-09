-- (1) Top Up kini punya tanggal transaksi.
-- (2) Refund Dana: kebalikan Top Up. Uang KELUAR dari rekening pusat ke luar sistem
--     (dikembalikan ke owner/atasan/pemodal). Keputusan owner 9 Nov 2026: langsung tanpa
--     persetujuan, bukti wajib, kelima rekening pusat, bisa dibatalkan (void, tak pernah DELETE).
--     Bukan biaya: tidak dibaca laporan laba mana pun.
-- Tanggal keduanya: 1 Nov 2026 (awal pembukuan baru) s/d hari ini WIB, jam = jam pencatatan.

ALTER TABLE public.cash_transaction DROP CONSTRAINT IF EXISTS cash_transaction_source_type_check;
ALTER TABLE public.cash_transaction ADD CONSTRAINT cash_transaction_source_type_check
  CHECK (source_type = ANY (ARRAY['payroll','supplier_po','expense_pusat','kasbon','cash_deposit',
    'manual','transfer','petty_cash_topup','setor_bank','income_lain','top_up','refund_dana']));

-- Waktu transaksi dari tanggal pilihan (WIB) + jam pencatatan; NULL = sekarang.
CREATE OR REPLACE FUNCTION public.kas_waktu_dari_tanggal(p_tanggal date)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF p_tanggal IS NULL THEN RETURN now(); END IF;
  IF p_tanggal < DATE '2026-11-01' THEN
    RAISE EXCEPTION 'Tanggal paling awal 1 November 2026' USING ERRCODE = 'check_violation';
  END IF;
  IF p_tanggal > v_hari_ini THEN
    RAISE EXCEPTION 'Tanggal tidak boleh di masa depan' USING ERRCODE = 'check_violation';
  END IF;
  RETURN (p_tanggal + (now() AT TIME ZONE 'Asia/Jakarta')::time) AT TIME ZONE 'Asia/Jakarta';
END;
$$;

DROP FUNCTION IF EXISTS public.record_top_up_saldo(uuid, numeric, text, text, text);

CREATE FUNCTION public.record_top_up_saldo(
  p_location uuid, p_amount numeric, p_sumber text, p_proof_url text,
  p_note text DEFAULT NULL, p_tanggal date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lok cash_location%ROWTYPE; v_id uuid; v_waktu timestamptz;
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
  v_waktu := kas_waktu_dari_tanggal(p_tanggal);

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status,
    occurred_at, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_location, 'in', p_amount, 'Top up dari ' || btrim(p_sumber), 'top_up', 'reconciled',
    v_waktu, nullif(btrim(coalesce(p_note, '')), ''), p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_refund_dana(
  p_location uuid, p_amount numeric, p_tujuan text, p_proof_url text,
  p_note text DEFAULT NULL, p_tanggal date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lok cash_location%ROWTYPE; v_id uuid; v_waktu timestamptz; v_saldo numeric;
BEGIN
  IF NOT (kas_pencatat_ok() OR EXISTS (
      SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat refund dana'
      USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal refund harus lebih dari 0' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_tujuan, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Tujuan refund wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_proof_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bukti refund wajib dilampirkan' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_lok FROM cash_location WHERE id = p_location;
  IF v_lok.id IS NULL OR v_lok.grup IS NULL OR NOT v_lok.is_active THEN
    RAISE EXCEPTION 'Refund hanya dari rekening pusat yang aktif' USING ERRCODE = 'check_violation';
  END IF;
  v_waktu := kas_waktu_dari_tanggal(p_tanggal);

  -- Uang tunai tidak bisa keluar melebihi isi brankas (aturan sama dengan Transfer).
  IF v_lok.kind = 'cash' THEN
    SELECT saldo INTO v_saldo FROM cash_balance WHERE cash_location_id = p_location FOR UPDATE;
    IF coalesce(v_saldo, 0) < p_amount THEN
      RAISE EXCEPTION 'Saldo % tidak mencukupi untuk refund', v_lok.label USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status,
    occurred_at, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_location, 'out', p_amount, 'Refund ke ' || btrim(p_tujuan), 'refund_dana', 'reconciled',
    v_waktu, nullif(btrim(coalesce(p_note, '')), ''), p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.batal_refund_dana(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  IF NOT (kas_pencatat_ok() OR EXISTS (
      SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh membatalkan refund'
      USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_alasan, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  SELECT status INTO v_status FROM cash_transaction
   WHERE id = p_id AND source_type = 'refund_dana' FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Refund tidak ditemukan' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status = 'void' THEN
    RAISE EXCEPTION 'Refund ini sudah dibatalkan' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE cash_transaction
     SET status = 'void',
         note = concat_ws(' ', note, '[Dibatalkan: ' || btrim(p_alasan) || ']')
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kas_waktu_dari_tanggal(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_top_up_saldo(uuid, numeric, text, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_refund_dana(uuid, numeric, text, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batal_refund_dana(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kas_waktu_dari_tanggal(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_top_up_saldo(uuid, numeric, text, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_refund_dana(uuid, numeric, text, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.batal_refund_dana(uuid, text) TO authenticated, service_role;
