-- 20300219000000_universal_interim_petty_cash_carryover.sql
-- Universal system-wide fix for petty cash interim top-ups across ALL outlets.
-- Ensures that top-ups received while no shift is open (between shifts / interim)
-- are automatically included in petty cash balance, carried over into next shift's
-- opening balance (starting_petty_cash), and visible in active ledger.

-- 1. Pastikan accessible_outlet_ids mengizinkan service_role (untuk background jobs & scripts)
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Service role bypass
  SELECT o.id
  FROM public.outlets o
  WHERE auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'service_role'

  UNION

  SELECT o.id
  FROM public.outlets o, (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'area_manager',
    'kitchen', 'admin_finance', 'finance', 'purchasing', 'developer'
  )

  UNION

  SELECT so.outlet_id
  FROM public.staff_outlets so, (
    SELECT id, role FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.role IN ('leader', 'korlap', 'area_manager', 'kepala_outlet')
    AND so.staff_id = me.id

  UNION

  SELECT me.outlet_id
  FROM (
    SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.outlet_id IS NOT NULL

  UNION

  SELECT unnest(mp.outlet_ids)
  FROM public.mitra_profiles mp
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'aktif';
$$;

GRANT EXECUTE ON FUNCTION public.accessible_outlet_ids() TO authenticated, service_role;

-- 2. Snapshot kanonis untuk Admin, POS web/native, Leader, dan Area Manager
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
  IF auth.role() IS DISTINCT FROM 'service_role' 
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
     AND p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat saldo outlet ini';
  END IF;

  SELECT * INTO v_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF FOUND THEN
    -- Ada shift yang sedang aktif (open)
    v_base := COALESCE(v_shift.admin_petty_cash_balance, v_shift.starting_petty_cash, 0);
    v_cutoff := COALESCE(v_shift.admin_petty_cash_updated_at, v_shift.start_time);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
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
  WHERE outlet_id = p_outlet_id AND status = 'closed'
  ORDER BY end_time DESC NULLS LAST, start_time DESC
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
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
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
  ELSE
    -- Jika outlet baru belum pernah memiliki shift tertutup sama sekali
    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader');

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.petty_cash_expenses e
    WHERE e.outlet_id = p_outlet_id
      AND e.deleted_at IS NULL;

    v_carry := v_topups - v_expenses;
  END IF;

  SELECT * INTO v_pending
  FROM public.petty_cash_adjustments
  WHERE outlet_id = p_outlet_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

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

GRANT EXECUTE ON FUNCTION public.get_petty_cash_snapshot(UUID) TO authenticated, service_role;

-- 3. get_petty_cash_balance: mengembalikan saldo petty cash outlet yang valid
-- baik ketika shift sedang buka maupun di antara shift (interim).
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap JSONB;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' 
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
     AND p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat saldo outlet ini';
  END IF;

  v_snap := public.get_petty_cash_snapshot(p_outlet_id);
  RETURN COALESCE((v_snap->>'current_balance')::DECIMAL, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated, service_role;

-- 4. get_all_latest_petty_cash_balances: mengembalikan saldo untuk semua outlet yang berhak
CREATE OR REPLACE FUNCTION public.get_all_latest_petty_cash_balances()
RETURNS TABLE (outlet_id UUID, balance DECIMAL)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, public.get_petty_cash_balance(o.id)
  FROM public.outlets o
  WHERE auth.role() = 'service_role' 
     OR (auth.jwt() ->> 'role') = 'service_role'
     OR o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION public.get_all_latest_petty_cash_balances() TO authenticated, service_role;

-- 5. open_shift: universal logic untuk SEMUA outlet.
-- Menggunakan snapshot kanonis get_petty_cash_snapshot agar saldo pembuka (opening_balance)
-- selalu 100% konsisten antara tampilan POS, Admin, dan nilai yang dicatat ke database shifts.
CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_last_shift public.shifts%ROWTYPE;
  v_snap JSONB;
  v_starting DECIMAL := 0;
  v_pending public.petty_cash_adjustments%ROWTYPE;
  v_staff_id UUID := auth.uid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' 
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
     AND p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
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

  -- Cari shift terakhir yang berstatus closed
  SELECT * INTO v_last_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'closed'
  ORDER BY end_time DESC NULLS LAST, start_time DESC
  LIMIT 1;

  -- Dapatkan kalkulasi saldo pembuka kanonis dari snapshot
  v_snap := public.get_petty_cash_snapshot(p_outlet_id);
  v_starting := COALESCE((v_snap->>'opening_balance')::DECIMAL, 0);

  -- Bila outlet baru belum pernah memiliki shift tertutup, belum ada topup interim,
  -- dan belum ada penyesuaian pending (v_starting = 0), gunakan input modal laci kasir jika ada.
  IF v_last_shift.id IS NULL AND v_starting = 0 AND p_starting_petty_cash IS NOT NULL AND p_starting_petty_cash > 0 THEN
    v_starting := p_starting_petty_cash;
  END IF;

  v_starting := GREATEST(COALESCE(v_starting, 0), 0);

  IF v_staff_id IS NULL THEN
    SELECT id INTO v_staff_id
    FROM public.outlet_staff
    WHERE outlet_id = p_outlet_id AND status = 'active'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
      SELECT id INTO v_staff_id
      FROM public.outlet_staff
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, v_staff_id, 0, v_starting, 'open')
  RETURNING id INTO v_shift_id;

  IF v_pending.id IS NOT NULL THEN
    UPDATE public.petty_cash_adjustments
    SET shift_id = v_shift_id, status = 'applied', applied_at = NOW()
    WHERE id = v_pending.id;
  END IF;

  RETURN v_shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated, service_role;

-- 6. Concurrency locking pada penyerahan dana oleh Leader agar aman dari race condition terhadap open_shift
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

  -- Kunci transaksi untuk outlet ini agar serial terhadap open_shift / penyesuaian saldo
  PERFORM pg_advisory_xact_lock(hashtextextended(v_topup.outlet_id::TEXT, 0));

  IF v_topup.status != 'forwarded_by_area_manager' THEN
    RAISE EXCEPTION 'Top up is not ready for Leader forwarding (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Leader funds';
  END IF;

  UPDATE public.petty_cash_topups
  SET
    status = 'forwarded_by_leader',
    leader_forwarded_by = auth.uid(),
    leader_forwarded_at = NOW()
  WHERE id = p_topup_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leader_forward_funds(UUID) TO authenticated;

-- 7. Rekonsiliasi Shift Aktif Pekayon yang terdampak topup interim (300.000)
-- Shift 1c74ca72-f3e9-42a2-9a6d-ae87e6db7727 dibuka dengan modal 164.000 karena mengabaikan
-- topup 60023b8d-5c95-4202-af61-d4aea248b74e (300.000) yang diserahkan Leader pada 11:05.
-- Modal awal yang benar: 164.000 + 300.000 = 464.000.
DO $$
BEGIN
  PERFORM set_config('app.admin_petty_cash_override', 'on', true);
  UPDATE public.shifts
  SET starting_petty_cash = 464000
  WHERE id = '1c74ca72-f3e9-42a2-9a6d-ae87e6db7727'
    AND outlet_id = '550e8400-e29b-41d4-a716-446655440018'
    AND status = 'open';

  -- Tandai penyesuaian manual sementara sebagai superseded agar tidak double-count
  UPDATE public.petty_cash_adjustments
  SET status = 'superseded', superseded_at = NOW()
  WHERE shift_id = '1c74ca72-f3e9-42a2-9a6d-ae87e6db7727'
    AND status = 'applied'
    AND adjustment_amount = 300000;
END $$;

-- 8. admin_adjust_petty_cash: pastikan service_role dan admin dapat melakukan penyesuaian saldo
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
  v_shift_id UUID;
  v_snapshot JSONB;
  v_before NUMERIC;
  v_carry NUMERIC;
  v_delta NUMERIC;
  v_previous_pending_id UUID;
  v_adjustment_id UUID;
  v_mode TEXT;
  v_admin_id UUID := auth.uid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' 
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    SELECT role INTO v_role
    FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active';

    IF v_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Hanya Admin yang dapat menyesuaikan petty cash';
    END IF;
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

  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id
    FROM public.outlet_staff
    WHERE role = 'admin' AND status = 'active'
    LIMIT 1;
    IF v_admin_id IS NULL THEN
      SELECT id INTO v_admin_id FROM public.outlet_staff LIMIT 1;
    END IF;
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
      btrim(p_note), v_admin_id, NOW()
    )
    RETURNING id INTO v_adjustment_id;
  ELSE
    v_mode := 'next_shift_opening';
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
      btrim(p_note), v_admin_id
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

GRANT EXECUTE ON FUNCTION public.admin_adjust_petty_cash(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- 9. close_shift_blind: modernisasi kalkulasi sisa petty cash penutupan shift agar 100% konsisten
-- dengan get_petty_cash_snapshot dan get_petty_cash_balance, menyaring deleted_at IS NULL
-- pada petty_cash_expenses dan mendukung seluruh alur status multi-tahap topup.
DROP FUNCTION IF EXISTS public.close_shift_blind(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION public.close_shift_blind(
  p_shift_id UUID, 
  p_actual_cash DECIMAL,
  p_actual_petty_cash DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_cash DECIMAL;
  v_expected_petty_cash DECIMAL;
  v_shift RECORD;
  v_snap JSONB;
BEGIN
  -- Lock the shift row
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;
  
  IF auth.role() IS DISTINCT FROM 'service_role' 
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
     AND v_shift.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to close this shift';
  END IF;

  IF v_shift.status = 'closed' THEN
    RAISE EXCEPTION 'Shift already closed';
  END IF;

  -- Pre-set end time for calculation
  UPDATE public.shifts SET end_time = NOW() WHERE id = p_shift_id;
  
  -- Calculate expected cash (laci)
  v_expected_cash := public.get_expected_shift_cash(p_shift_id);
  
  -- Calculate expected petty cash using canonical snapshot
  v_snap := public.get_petty_cash_snapshot(v_shift.outlet_id);
  v_expected_petty_cash := COALESCE((v_snap->>'current_balance')::DECIMAL, 0);
  
  -- Finalize shift
  UPDATE public.shifts
  SET 
    status = 'closed',
    closed_by = COALESCE(auth.uid(), v_shift.staff_id),
    expected_ending_cash = v_expected_cash,
    actual_ending_cash = p_actual_cash,
    variance = p_actual_cash - v_expected_cash,
    expected_ending_petty_cash = v_expected_petty_cash,
    actual_ending_petty_cash = p_actual_petty_cash,
    petty_cash_variance = CASE WHEN p_actual_petty_cash IS NOT NULL THEN p_actual_petty_cash - v_expected_petty_cash ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_shift_blind(UUID, DECIMAL, DECIMAL) TO authenticated, service_role;

-- 10. check_shift_closing_time: izinkan service_role (background job / scripts) bypass batasan jam operasional kasir
CREATE OR REPLACE FUNCTION public.check_shift_closing_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hour INT;
  test_outlet_id CONSTANT uuid := 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' 
     AND NEW.outlet_id <> test_outlet_id
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    current_hour := EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'));
    IF current_hour >= 6 AND current_hour < 22 THEN
      RAISE EXCEPTION 'Penutupan petty cash (shift) hanya bisa dilakukan antara jam 22:00 malam hingga 06:00 pagi.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
