-- 20260711100200_finance_treasury_rpcs.sql
-- M5 Finance: helper is_finance() + RPC maker-checker. Semua tulis kas WAJIB lewat sini.

CREATE OR REPLACE FUNCTION public.is_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin_finance','owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_finance_checker() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('owner','admin'));
$$;

-- Maker membuat transaksi keluar/masuk (status pending_approval).
CREATE OR REPLACE FUNCTION public.submit_cash_transaction(
  p_location uuid, p_direction text, p_amount numeric, p_category text,
  p_source_type text DEFAULT 'manual', p_source_id uuid DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, source_id, note, status, created_by)
  VALUES (p_location, p_direction, p_amount, p_category,
    p_source_type, p_source_id, p_note, 'pending_approval', auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Checker approve → status approved (belum menggerakkan saldo; saldo bergerak saat 'paid'/'reconciled').
CREATE OR REPLACE FUNCTION public.approve_cash_transaction(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE maker uuid;
BEGIN
  IF NOT public.is_finance_checker() THEN RAISE EXCEPTION 'forbidden: bukan checker'; END IF;
  SELECT created_by INTO maker FROM public.cash_transaction WHERE id = p_id;
  IF maker = auth.uid() THEN RAISE EXCEPTION 'maker tak boleh approve transaksinya sendiri'; END IF;
  UPDATE public.cash_transaction
    SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = p_id AND status = 'pending_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'transaksi tak ada / bukan pending_approval'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_cash_transaction(p_id uuid, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_finance_checker() THEN RAISE EXCEPTION 'forbidden: bukan checker'; END IF;
  UPDATE public.cash_transaction
    SET status = 'rejected', note = COALESCE(p_reason, note), approved_by = auth.uid(), approved_at = now()
    WHERE id = p_id AND status IN ('pending_approval','approved');
  IF NOT FOUND THEN RAISE EXCEPTION 'transaksi tak bisa ditolak dari status saat ini'; END IF;
END;
$$;

-- Tandai transaksi approved → reconciled (+ opsional bukti). Menggerakkan saldo via trigger.
CREATE OR REPLACE FUNCTION public.mark_cash_transaction_paid(p_id uuid, p_proof_url text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  UPDATE public.cash_transaction
    SET status = 'reconciled', proof_url = COALESCE(p_proof_url, proof_url),
        reconciled_by = auth.uid(), reconciled_at = now()
    WHERE id = p_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'transaksi belum approved'; END IF;
END;
$$;

-- Transfer dua-kaki (Kas Pusat → bank). Buat dua cash_transaction saling-refer, atomik.
-- Langsung 'reconciled' (uang riil sudah berpindah + slip diupload). Butuh checker.
CREATE OR REPLACE FUNCTION public.record_cash_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_proof_url text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE out_id uuid; in_id uuid;
BEGIN
  IF NOT public.is_finance_checker() THEN RAISE EXCEPTION 'forbidden: transfer butuh checker'; END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'lokasi asal & tujuan sama'; END IF;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, status, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_from, 'out', p_amount, 'transfer', 'transfer', 'reconciled', p_note, p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO out_id;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, status, note, proof_url, counter_transaction_id, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_to, 'in', p_amount, 'transfer', 'transfer', 'reconciled', p_note, p_proof_url,
    out_id, auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO in_id;

  UPDATE public.cash_transaction SET counter_transaction_id = in_id WHERE id = out_id;
  RETURN out_id;
END;
$$;

-- DOWN: DROP FUNCTION is_finance, is_finance_checker, submit_cash_transaction,
--       approve_cash_transaction, reject_cash_transaction, mark_cash_transaction_paid,
--       record_cash_transfer.
