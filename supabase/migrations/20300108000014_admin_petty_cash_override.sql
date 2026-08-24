-- Admin dapat menimpa modal awal dan saldo petty cash pada shift terbaru outlet.
-- Saldo override menjadi baseline; mutasi setelah waktu override tetap menambah/mengurangi saldo.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS admin_petty_cash_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS admin_petty_cash_note TEXT,
  ADD COLUMN IF NOT EXISTS admin_petty_cash_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_petty_cash_updated_by UUID
    REFERENCES public.outlet_staff(id) ON DELETE SET NULL;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_admin_petty_cash_balance_nonnegative;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_admin_petty_cash_balance_nonnegative
  CHECK (admin_petty_cash_balance IS NULL OR admin_petty_cash_balance >= 0);

CREATE TABLE IF NOT EXISTS public.petty_cash_balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  old_starting_balance NUMERIC(12,2) NOT NULL,
  new_starting_balance NUMERIC(12,2) NOT NULL,
  old_current_balance NUMERIC(12,2) NOT NULL,
  new_current_balance NUMERIC(12,2) NOT NULL,
  note TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT petty_cash_balance_history_new_starting_nonnegative
    CHECK (new_starting_balance >= 0),
  CONSTRAINT petty_cash_balance_history_new_current_nonnegative
    CHECK (new_current_balance >= 0),
  CONSTRAINT petty_cash_balance_history_note_present CHECK (btrim(note) <> '')
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_balance_history_outlet_changed
  ON public.petty_cash_balance_history(outlet_id, changed_at DESC);

ALTER TABLE public.petty_cash_balance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS petty_cash_balance_history_select ON public.petty_cash_balance_history;
CREATE POLICY petty_cash_balance_history_select
ON public.petty_cash_balance_history
FOR SELECT TO authenticated
USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

REVOKE ALL ON public.petty_cash_balance_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.petty_cash_balance_history FROM authenticated;
GRANT SELECT ON public.petty_cash_balance_history TO authenticated;

CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_starting DECIMAL := 0;
  v_override DECIMAL;
  v_shift_start TIMESTAMPTZ;
  v_override_at TIMESTAMPTZ;
  v_cutoff TIMESTAMPTZ;
  v_topups DECIMAL := 0;
  v_expenses DECIMAL := 0;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat saldo outlet ini';
  END IF;

  SELECT
    id,
    COALESCE(starting_petty_cash, 0),
    admin_petty_cash_balance,
    start_time,
    admin_petty_cash_updated_at
  INTO v_shift_id, v_starting, v_override, v_shift_start, v_override_at
  FROM public.shifts
  WHERE outlet_id = p_outlet_id
  ORDER BY (status = 'open') DESC, start_time DESC
  LIMIT 1;

  IF v_shift_id IS NULL THEN
    RETURN 0;
  END IF;

  v_cutoff := COALESCE(v_override_at, v_shift_start);

  SELECT COALESCE(SUM(amount), 0)
  INTO v_topups
  FROM public.petty_cash_topups
  WHERE outlet_id = p_outlet_id
    AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
    AND (
      created_at >= v_cutoff OR
      completed_at >= v_cutoff OR
      leader_forwarded_at >= v_cutoff
    );

  SELECT COALESCE(SUM(amount), 0)
  INTO v_expenses
  FROM public.petty_cash_expenses
  WHERE outlet_id = p_outlet_id
    AND created_at >= v_cutoff
    AND deleted_at IS NULL;

  RETURN COALESCE(v_override, v_starting) + v_topups - v_expenses;
END;
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

CREATE OR REPLACE FUNCTION public.guard_admin_petty_cash_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.starting_petty_cash IS DISTINCT FROM OLD.starting_petty_cash OR
    NEW.admin_petty_cash_balance IS DISTINCT FROM OLD.admin_petty_cash_balance OR
    NEW.admin_petty_cash_note IS DISTINCT FROM OLD.admin_petty_cash_note OR
    NEW.admin_petty_cash_updated_at IS DISTINCT FROM OLD.admin_petty_cash_updated_at OR
    NEW.admin_petty_cash_updated_by IS DISTINCT FROM OLD.admin_petty_cash_updated_by
  ) AND COALESCE(current_setting('app.admin_petty_cash_override', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Gunakan menu Saldo Petty Cash Admin untuk mengubah saldo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_petty_cash_override ON public.shifts;
CREATE TRIGGER trg_guard_admin_petty_cash_override
BEFORE UPDATE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.guard_admin_petty_cash_override();

CREATE OR REPLACE FUNCTION public.admin_override_outlet_petty_cash(
  p_outlet_id UUID,
  p_starting_balance NUMERIC,
  p_current_balance NUMERIC,
  p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_role TEXT;
  v_old_current NUMERIC;
  v_history_id UUID;
BEGIN
  SELECT role INTO v_role
  FROM public.outlet_staff
  WHERE id = auth.uid() AND status = 'active';

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat mengubah saldo petty cash';
  END IF;

  IF p_starting_balance IS NULL OR p_starting_balance < 0 THEN
    RAISE EXCEPTION 'Modal awal tidak valid';
  END IF;

  IF p_current_balance IS NULL OR p_current_balance < 0 THEN
    RAISE EXCEPTION 'Saldo saat ini tidak valid';
  END IF;

  IF p_note IS NULL OR length(btrim(p_note)) < 5 THEN
    RAISE EXCEPTION 'Catatan perubahan minimal 5 karakter';
  END IF;

  SELECT * INTO v_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id
  ORDER BY (status = 'open') DESC, start_time DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet ini belum mempunyai shift';
  END IF;

  v_old_current := public.get_petty_cash_balance(p_outlet_id);

  -- Trigger shifts menolak update saldo di luar RPC ini, termasuk direct API update.
  PERFORM set_config('app.admin_petty_cash_override', 'on', true);

  UPDATE public.shifts
  SET
    starting_petty_cash = p_starting_balance,
    admin_petty_cash_balance = p_current_balance,
    admin_petty_cash_note = btrim(p_note),
    admin_petty_cash_updated_at = NOW(),
    admin_petty_cash_updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = v_shift.id;

  INSERT INTO public.petty_cash_balance_history (
    outlet_id,
    shift_id,
    old_starting_balance,
    new_starting_balance,
    old_current_balance,
    new_current_balance,
    note,
    changed_by
  ) VALUES (
    p_outlet_id,
    v_shift.id,
    COALESCE(v_shift.starting_petty_cash, 0),
    p_starting_balance,
    v_old_current,
    p_current_balance,
    btrim(p_note),
    auth.uid()
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_override_outlet_petty_cash(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_override_outlet_petty_cash(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- Saldo terakhir, termasuk override Admin, menjadi modal awal shift berikutnya.
CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_starting DECIMAL;
  v_has_history BOOLEAN;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this outlet';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id AND status = 'open') THEN
    RAISE EXCEPTION 'There is already an open shift for this outlet';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id
  ) INTO v_has_history;

  IF v_has_history THEN
    v_starting := public.get_petty_cash_balance(p_outlet_id);
  ELSE
    v_starting := COALESCE(p_starting_petty_cash, 0);
  END IF;

  IF v_starting < 0 THEN
    v_starting := 0;
  END IF;

  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, auth.uid(), 0, v_starting, 'open')
  RETURNING id INTO v_shift_id;

  RETURN v_shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'petty_cash_balance_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petty_cash_balance_history;
  END IF;
END;
$$;
