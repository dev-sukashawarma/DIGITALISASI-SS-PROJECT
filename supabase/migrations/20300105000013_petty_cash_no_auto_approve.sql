-- Petty cash: hapus auto-approve, paksa tiap tahap lewat manusia.
--
-- 1. leader_forward_funds berhenti melompat ke 'completed' (revert
--    20260728000000_auto_complete_petty_cash) -- crew wajib konfirmasi terima.
-- 2. Trigger urutan status: satu gerbang untuk SEMUA penulis (RPC, service_role,
--    migration masa depan). Auto-approve berikutnya gagal keras, bukan lolos diam.

CREATE OR REPLACE FUNCTION public.leader_forward_funds(p_topup_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_by_area_manager' THEN
    RAISE EXCEPTION 'Top up is not ready for Leader forwarding (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Leader funds';
  END IF;

  -- Saldo outlet naik di sini juga: get_petty_cash_balance() menghitung topup
  -- berstatus 'forwarded_by_leader'. Tabel petty_cash_transactions TIDAK ADA
  -- di DB ini -- insert ke sana bikin "relation does not exist".
  UPDATE public.petty_cash_topups
  SET
    status = 'forwarded_by_leader',
    leader_forwarded_by = auth.uid(),
    leader_forwarded_at = NOW()
  WHERE id = p_topup_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leader_forward_funds(UUID) TO authenticated;

-- Gerbang urutan status.
CREATE OR REPLACE FUNCTION public.petty_cash_enforce_flow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, '') != 'forwarded_to_area_manager' THEN
      RAISE EXCEPTION 'Pengajuan petty cash harus lahir dengan status forwarded_to_area_manager (dicoba: %). Auto-approve dilarang.', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'rejected' THEN
    RETURN NEW; -- boleh ditolak dari tahap mana pun yang belum final
  END IF;

  IF (OLD.status, NEW.status) NOT IN (
    ('forwarded_to_area_manager', 'forwarded_to_finance'),
    ('forwarded_to_finance',      'approved_by_finance'),
    ('approved_by_finance',       'forwarded_by_finance'),
    -- AM boleh mengambil dana langsung dari approved_by_finance (finance belum klik "serahkan").
    ('approved_by_finance',       'forwarded_by_area_manager'),
    ('forwarded_by_finance',      'forwarded_by_area_manager'),
    ('forwarded_by_area_manager', 'forwarded_by_leader'),
    ('forwarded_by_leader',       'completed')
  ) THEN
    RAISE EXCEPTION 'Transisi status petty cash tidak sah: % -> %. Setiap tahap wajib lewat persetujuan manual.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_petty_cash_enforce_flow_insert ON public.petty_cash_topups;
CREATE TRIGGER trg_petty_cash_enforce_flow_insert
  BEFORE INSERT ON public.petty_cash_topups
  FOR EACH ROW EXECUTE FUNCTION public.petty_cash_enforce_flow();

DROP TRIGGER IF EXISTS trg_petty_cash_enforce_flow_update ON public.petty_cash_topups;
CREATE TRIGGER trg_petty_cash_enforce_flow_update
  BEFORE UPDATE ON public.petty_cash_topups
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.petty_cash_enforce_flow();
