-- Transfer antar rekening pusat (mis. Rekening Utama -> Rekening Bahan Baku Bank).
--
-- record_cash_transfer lama hanya memeriksa is_finance_checker() (tanpa cek status
-- aktif), menerima lokasi mana pun (termasuk kas kecil outlet), tanpa bukti, dan
-- terbuka untuk anon. Versi ini:
--  * pencatat wajib admin_finance/admin/owner aktif (kas_pencatat_ok) atau developer aktif;
--  * asal & tujuan wajib rekening pusat aktif (grup terisi) dan berbeda;
--  * nominal > 0, bukti wajib;
--  * Bahan Baku Tunai -> Bahan Baku Bank ditolak: pakai Setor ke Bank (ada pecahan & receh);
--  * sumber tunai dikunci lalu dicek saldonya (uang fisik tidak bisa minus);
--    sumber bank tidak dicek karena saldo awal Rekening Utama belum diketahui.
-- Tanda tangan fungsi tetap, jadi pemanggil lama (useCashMutations.transfer) tidak berubah.

CREATE OR REPLACE FUNCTION public.record_cash_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_proof_url text DEFAULT NULL::text, p_note text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  out_id uuid; in_id uuid;
  v_dari cash_location%ROWTYPE; v_ke cash_location%ROWTYPE;
  v_saldo numeric;
BEGIN
  IF NOT (kas_pencatat_ok() OR EXISTS (
      SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat transfer antar rekening'
      USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RAISE EXCEPTION 'Rekening asal dan tujuan harus berbeda' USING ERRCODE = 'check_violation';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal transfer harus lebih dari 0' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_proof_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bukti transfer wajib dilampirkan' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_dari FROM cash_location WHERE id = p_from;
  SELECT * INTO v_ke FROM cash_location WHERE id = p_to;
  IF v_dari.id IS NULL OR v_ke.id IS NULL OR v_dari.grup IS NULL OR v_ke.grup IS NULL
     OR NOT v_dari.is_active OR NOT v_ke.is_active THEN
    RAISE EXCEPTION 'Transfer hanya antar rekening pusat yang aktif' USING ERRCODE = 'check_violation';
  END IF;
  IF v_dari.grup = 'bahan_baku' AND v_dari.kind = 'cash' AND v_ke.grup = 'bahan_baku' AND v_ke.kind = 'bank' THEN
    RAISE EXCEPTION 'Setor tunai ke Rekening Bahan Baku Bank pakai fitur Setor ke Bank' USING ERRCODE = 'check_violation';
  END IF;

  IF v_dari.kind = 'cash' THEN
    SELECT saldo INTO v_saldo FROM cash_balance WHERE cash_location_id = p_from FOR UPDATE;
    IF coalesce(v_saldo, 0) < p_amount THEN
      RAISE EXCEPTION 'Saldo % tidak mencukupi', v_dari.label USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category,
    source_type, status, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_from, 'out', p_amount, 'Transfer ke ' || v_ke.label, 'transfer', 'reconciled',
    nullif(btrim(coalesce(p_note, '')), ''), p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO out_id;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category,
    source_type, status, note, proof_url, counter_transaction_id, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_to, 'in', p_amount, 'Transfer dari ' || v_dari.label, 'transfer', 'reconciled',
    nullif(btrim(coalesce(p_note, '')), ''), p_proof_url,
    out_id, auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO in_id;

  UPDATE cash_transaction SET counter_transaction_id = in_id WHERE id = out_id;
  RETURN out_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_cash_transfer(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_cash_transfer(uuid, uuid, numeric, text, text) TO authenticated, service_role;
