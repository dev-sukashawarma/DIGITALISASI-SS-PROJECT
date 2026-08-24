-- Satu input Penyesuaian Petty Cash untuk Admin.
-- Tanpa shift aktif: target menjadi modal awal shift berikutnya.
-- Dengan shift aktif: target menjadi saldo berjalan melalui mutasi selisih.

CREATE TABLE IF NOT EXISTS public.petty_cash_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  application_mode TEXT NOT NULL
    CHECK (application_mode IN ('active_shift', 'next_shift_opening')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'superseded')),
  balance_before NUMERIC(12,2) NOT NULL CHECK (balance_before >= 0),
  target_balance NUMERIC(12,2) NOT NULL CHECK (target_balance >= 0),
  adjustment_amount NUMERIC(12,2) NOT NULL,
  note TEXT NOT NULL CHECK (length(btrim(note)) >= 5),
  created_by UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES public.petty_cash_adjustments(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_petty_cash_adjustments_pending_outlet
  ON public.petty_cash_adjustments(outlet_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_petty_cash_adjustments_outlet_created
  ON public.petty_cash_adjustments(outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_petty_cash_adjustments_shift_applied
  ON public.petty_cash_adjustments(shift_id, applied_at)
  WHERE status = 'applied' AND application_mode = 'active_shift';

ALTER TABLE public.petty_cash_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS petty_cash_adjustments_select ON public.petty_cash_adjustments;
CREATE POLICY petty_cash_adjustments_select
ON public.petty_cash_adjustments
FOR SELECT TO authenticated
USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

REVOKE ALL ON public.petty_cash_adjustments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.petty_cash_adjustments FROM authenticated;
GRANT SELECT ON public.petty_cash_adjustments TO authenticated;

-- Snapshot kanonis untuk Admin, POS web/native, Leader, dan Area Manager.
CREATE OR REPLACE FUNCTION public.get_petty_cash_snapshot(p_outlet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_pending public.petty_cash_adjustments%ROWTYPE;
  v_cutoff TIMESTAMPTZ;
  v_base NUMERIC := 0;
  v_topups NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_adjustments NUMERIC := 0;
  v_last_adjustment public.petty_cash_adjustments%ROWTYPE;
  v_carry NUMERIC := 0;
  v_current NUMERIC := 0;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat saldo outlet ini';
  END IF;

  SELECT * INTO v_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF FOUND THEN
    -- Kolom override lama tetap dihormati selama shift legacy masih aktif.
    v_base := COALESCE(v_shift.admin_petty_cash_balance, v_shift.starting_petty_cash, 0);
    v_cutoff := COALESCE(v_shift.admin_petty_cash_updated_at, v_shift.start_time);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'forwarded_by_leader')
      AND CASE
        WHEN t.status IN ('completed', 'forwarded_by_leader')
          THEN COALESCE(t.leader_forwarded_at, t.completed_at, t.approved_at, t.created_at)
        ELSE COALESCE(t.approved_at, t.created_at)
      END >= v_cutoff;

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.petty_cash_expenses e
    WHERE e.outlet_id = p_outlet_id
      AND e.created_at >= v_cutoff
      AND e.deleted_at IS NULL;

    SELECT COALESCE(SUM(a.adjustment_amount), 0)
    INTO v_adjustments
    FROM public.petty_cash_adjustments a
    WHERE a.shift_id = v_shift.id
      AND a.application_mode = 'active_shift'
      AND a.status = 'applied';

    SELECT * INTO v_last_adjustment
    FROM public.petty_cash_adjustments a
    WHERE a.shift_id = v_shift.id
      AND a.application_mode = 'active_shift'
      AND a.status = 'applied'
    ORDER BY a.applied_at DESC NULLS LAST, a.created_at DESC
    LIMIT 1;

    v_current := v_base + v_topups - v_expenses + v_adjustments;

    RETURN jsonb_build_object(
      'outlet_id', p_outlet_id,
      'shift_id', v_shift.id,
      'shift_status', 'open',
      'has_active_shift', TRUE,
      'starting_balance', COALESCE(v_shift.starting_petty_cash, 0),
      'carry_balance', COALESCE(v_shift.starting_petty_cash, 0),
      'topups_total', v_topups,
      'expenses_total', v_expenses,
      'adjustments_total', v_adjustments,
      'current_balance', GREATEST(v_current, 0),
      'opening_balance', NULL,
      'pending_adjustment_id', NULL,
      'pending_note', NULL,
      'last_adjustment_note', v_last_adjustment.note,
      'last_adjustment_at', v_last_adjustment.applied_at,
      'calculated_at', NOW()
    );
  END IF;

  -- Tidak ada shift aktif: hitung saldo carry-forward dari shift terakhir.
  SELECT * INTO v_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id
  ORDER BY start_time DESC
  LIMIT 1;

  IF FOUND THEN
    v_carry := COALESCE(
      v_shift.actual_ending_petty_cash,
      v_shift.expected_ending_petty_cash,
      v_shift.admin_petty_cash_balance,
      v_shift.starting_petty_cash,
      0
    );
    v_cutoff := COALESCE(v_shift.end_time, v_shift.updated_at, v_shift.start_time);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'forwarded_by_leader')
      AND CASE
        WHEN t.status IN ('completed', 'forwarded_by_leader')
          THEN COALESCE(t.leader_forwarded_at, t.completed_at, t.approved_at, t.created_at)
        ELSE COALESCE(t.approved_at, t.created_at)
      END > v_cutoff;

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.petty_cash_expenses e
    WHERE e.outlet_id = p_outlet_id
      AND e.created_at > v_cutoff
      AND e.deleted_at IS NULL;

    v_carry := v_carry + v_topups - v_expenses;
  END IF;

  SELECT * INTO v_pending
  FROM public.petty_cash_adjustments
  WHERE outlet_id = p_outlet_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Pending disimpan sebagai selisih terhadap carry balance pada saat Admin
  -- menyesuaikan. Mutasi sah yang datang setelahnya tetap ikut ke saldo pembuka.
  v_current := v_carry + COALESCE(v_pending.adjustment_amount, 0);

  RETURN jsonb_build_object(
    'outlet_id', p_outlet_id,
    'shift_id', CASE WHEN v_shift.id IS NULL THEN NULL ELSE v_shift.id END,
    'shift_status', CASE WHEN v_shift.id IS NULL THEN NULL ELSE v_shift.status END,
    'has_active_shift', FALSE,
    'starting_balance', CASE WHEN v_shift.id IS NULL THEN 0 ELSE COALESCE(v_shift.starting_petty_cash, 0) END,
    'carry_balance', GREATEST(v_carry, 0),
    'topups_total', v_topups,
    'expenses_total', v_expenses,
    'adjustments_total', 0,
    'current_balance', GREATEST(v_current, 0),
    'opening_balance', GREATEST(v_current, 0),
    'pending_adjustment_id', v_pending.id,
    'pending_note', v_pending.note,
    'last_adjustment_note', NULL,
    'last_adjustment_at', NULL,
    'calculated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_petty_cash_snapshot(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_petty_cash_snapshot(p_outlet_id)->>'current_balance')::DECIMAL, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_all_latest_petty_cash_balances()
RETURNS TABLE (outlet_id UUID, balance DECIMAL)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, public.get_petty_cash_balance(o.id)
  FROM public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION public.get_all_latest_petty_cash_balances() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_petty_cash(
  p_outlet_id UUID,
  p_target_balance NUMERIC,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_snapshot JSONB;
  v_shift_id UUID;
  v_before NUMERIC;
  v_carry NUMERIC;
  v_delta NUMERIC;
  v_previous_pending_id UUID;
  v_adjustment_id UUID;
  v_mode TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.outlet_staff
  WHERE id = auth.uid() AND status = 'active';

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat menyesuaikan petty cash';
  END IF;

  IF p_target_balance IS NULL OR p_target_balance < 0 THEN
    RAISE EXCEPTION 'Nominal penyesuaian tidak valid';
  END IF;

  IF p_note IS NULL OR length(btrim(p_note)) < 5 THEN
    RAISE EXCEPTION 'Catatan perubahan minimal 5 karakter';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan';
  END IF;

  -- Lock yang sama dipakai open_shift agar keputusan mode tidak race.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_outlet_id::TEXT, 0));

  SELECT id INTO v_shift_id
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1
  FOR UPDATE;

  v_snapshot := public.get_petty_cash_snapshot(p_outlet_id);
  v_before := COALESCE((v_snapshot->>'current_balance')::NUMERIC, 0);
  v_carry := COALESCE((v_snapshot->>'carry_balance')::NUMERIC, v_before);

  IF p_target_balance = v_before THEN
    RAISE EXCEPTION 'Saldo target sama dengan saldo yang berlaku';
  END IF;

  IF v_shift_id IS NOT NULL THEN
    v_mode := 'active_shift';
    v_delta := p_target_balance - v_before;

    INSERT INTO public.petty_cash_adjustments (
      outlet_id, shift_id, application_mode, status,
      balance_before, target_balance, adjustment_amount,
      note, created_by, applied_at
    ) VALUES (
      p_outlet_id, v_shift_id, v_mode, 'applied',
      v_before, p_target_balance, v_delta,
      btrim(p_note), auth.uid(), NOW()
    )
    RETURNING id INTO v_adjustment_id;
  ELSE
    v_mode := 'next_shift_opening';
    -- Untuk pending, selisih harus terhadap carry tanpa pending lama. Dengan
    -- begitu pending baru benar-benar menggantikan pending lama, bukan menumpuk.
    v_delta := p_target_balance - v_carry;

    SELECT id INTO v_previous_pending_id
    FROM public.petty_cash_adjustments
    WHERE outlet_id = p_outlet_id AND status = 'pending'
    FOR UPDATE;

    IF v_previous_pending_id IS NOT NULL THEN
      UPDATE public.petty_cash_adjustments
      SET status = 'superseded', superseded_at = NOW()
      WHERE id = v_previous_pending_id;
    END IF;

    INSERT INTO public.petty_cash_adjustments (
      outlet_id, application_mode, status,
      balance_before, target_balance, adjustment_amount,
      note, created_by
    ) VALUES (
      p_outlet_id, v_mode, 'pending',
      v_before, p_target_balance, v_delta,
      btrim(p_note), auth.uid()
    )
    RETURNING id INTO v_adjustment_id;

    IF v_previous_pending_id IS NOT NULL THEN
      UPDATE public.petty_cash_adjustments
      SET superseded_by = v_adjustment_id
      WHERE id = v_previous_pending_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'application_mode', v_mode,
    'balance_before', v_before,
    'target_balance', p_target_balance,
    'adjustment_amount', v_delta,
    'snapshot', public.get_petty_cash_snapshot(p_outlet_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_petty_cash(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_petty_cash(UUID, NUMERIC, TEXT) TO authenticated;

-- Jalur dua-input lama ditutup; histori dan kolomnya dipertahankan untuk audit/legacy.
REVOKE EXECUTE ON FUNCTION public.admin_override_outlet_petty_cash(UUID, NUMERIC, NUMERIC, TEXT) FROM authenticated;

CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_starting DECIMAL;
  v_pending public.petty_cash_adjustments%ROWTYPE;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this outlet';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_outlet_id::TEXT, 0));

  IF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id AND status = 'open') THEN
    RAISE EXCEPTION 'There is already an open shift for this outlet';
  END IF;

  SELECT * INTO v_pending
  FROM public.petty_cash_adjustments
  WHERE outlet_id = p_outlet_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_pending.id IS NOT NULL THEN
    v_starting := public.get_petty_cash_balance(p_outlet_id);
  ELSIF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id) THEN
    v_starting := public.get_petty_cash_balance(p_outlet_id);
  ELSE
    v_starting := COALESCE(p_starting_petty_cash, 0);
  END IF;

  v_starting := GREATEST(COALESCE(v_starting, 0), 0);

  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, auth.uid(), 0, v_starting, 'open')
  RETURNING id INTO v_shift_id;

  IF v_pending.id IS NOT NULL THEN
    UPDATE public.petty_cash_adjustments
    SET shift_id = v_shift_id, status = 'applied', applied_at = NOW()
    WHERE id = v_pending.id;
  END IF;

  RETURN v_shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'petty_cash_adjustments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petty_cash_adjustments;
  END IF;
END;
$$;
