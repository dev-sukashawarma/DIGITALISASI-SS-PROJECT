-- =============================================================
-- 20300108000002_fix_void_petty_cash_balance.sql
-- Bug: Pembatalan pengeluaran petty cash (void) berhasil,
--      tapi saldo tidak dikembalikan.
--
-- Root cause:
--   1. Kolom deleted_at / delete_reason mungkin belum ada di petty_cash_expenses
--   2. Fungsi void_petty_cash_expense mungkin tidak men-set deleted_at
--   3. get_petty_cash_balance & get_all_latest_petty_cash_balances
--      menghitung SEMUA pengeluaran tanpa mengecualikan yang di-void
--      (deleted_at IS NOT NULL).
--
-- Fix:
--   1. Tambah kolom deleted_at + delete_reason (idempotent)
--   2. Buat/ganti void_petty_cash_expense → soft-delete via deleted_at
--   3. Perbaiki get_petty_cash_balance → filter WHERE deleted_at IS NULL
--   4. Perbaiki get_all_latest_petty_cash_balances → filter deleted_at IS NULL
-- =============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Pastikan kolom deleted_at dan delete_reason ada
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.petty_cash_expenses
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by    UUID        REFERENCES public.outlet_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_petty_cash_expenses_deleted_at
  ON public.petty_cash_expenses(deleted_at)
  WHERE deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2. RPC void_petty_cash_expense — soft-delete, kembalikan saldo
--    Dapat dipanggil oleh kasir/leader di outlet sendiri.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_petty_cash_expense(
  p_expense_id UUID,
  p_reason      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_caller_staff_id UUID;
BEGIN
  -- Validasi caller
  v_caller_staff_id := auth.uid();
  IF v_caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  -- Validasi alasan
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
  END IF;

  -- Ambil data pengeluaran
  SELECT * INTO v_expense
  FROM public.petty_cash_expenses
  WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengeluaran tidak ditemukan';
  END IF;

  -- Pastikan caller bisa akses outlet ini
  IF v_expense.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang membatalkan pengeluaran ini';
  END IF;

  -- Sudah dibatalkan sebelumnya?
  IF v_expense.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pengeluaran ini sudah dibatalkan sebelumnya';
  END IF;

  -- Soft-delete: set deleted_at → saldo otomatis kembali karena
  -- get_petty_cash_balance & perhitungan frontend memfilter deleted_at IS NULL
  UPDATE public.petty_cash_expenses
  SET
    deleted_at    = NOW(),
    delete_reason = btrim(p_reason),
    deleted_by    = v_caller_staff_id
  WHERE id = p_expense_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.void_petty_cash_expense(UUID, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. Perbaiki get_petty_cash_balance → filter deleted_at IS NULL
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topups     DECIMAL := 0;
  v_expenses   DECIMAL := 0;
  v_starting   DECIMAL := 0;
  v_shift_start TIMESTAMPTZ;
  v_shift_id   UUID;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat saldo outlet ini';
  END IF;

  -- Ambil shift yang sedang BUKA
  SELECT id, COALESCE(starting_petty_cash, 0), start_time
  INTO v_shift_id, v_starting, v_shift_start
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    -- Topup selama shift ini (sudah diserahkan ke kasir)
    SELECT COALESCE(SUM(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = p_outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND (created_at >= v_shift_start OR completed_at >= v_shift_start OR leader_forwarded_at >= v_shift_start);

    -- Pengeluaran shift ini — KECUALI yang sudah dibatalkan (deleted_at IS NOT NULL)
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = p_outlet_id
      AND created_at >= v_shift_start
      AND deleted_at IS NULL;  -- ← FIX: abaikan yang di-void

    RETURN v_starting + v_topups - v_expenses;
  ELSE
    RETURN 0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. Perbaiki get_all_latest_petty_cash_balances → filter deleted_at IS NULL
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_all_latest_petty_cash_balances()
RETURNS TABLE (
  outlet_id UUID,
  balance   DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH latest_shifts AS (
    SELECT DISTINCT ON (s.outlet_id)
      s.outlet_id,
      s.id AS shift_id,
      COALESCE(s.starting_petty_cash, 0) AS starting_petty_cash,
      s.start_time
    FROM public.shifts s
    ORDER BY s.outlet_id, s.start_time DESC
  ),
  topups AS (
    SELECT ls.outlet_id, COALESCE(SUM(t.amount), 0) AS total_topup
    FROM latest_shifts ls
    LEFT JOIN public.petty_cash_topups t
      ON t.outlet_id = ls.outlet_id
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND (
        t.created_at        >= ls.start_time OR
        t.completed_at      >= ls.start_time OR
        t.leader_forwarded_at >= ls.start_time
      )
    GROUP BY ls.outlet_id
  ),
  expenses AS (
    SELECT ls.outlet_id, COALESCE(SUM(e.amount), 0) AS total_expense
    FROM latest_shifts ls
    LEFT JOIN public.petty_cash_expenses e
      ON e.outlet_id   = ls.outlet_id
      AND e.created_at >= ls.start_time
      AND e.deleted_at IS NULL  -- ← FIX: abaikan yang di-void
    GROUP BY ls.outlet_id
  )
  SELECT
    ls.outlet_id,
    (ls.starting_petty_cash + COALESCE(t.total_topup, 0) - COALESCE(e.total_expense, 0)) AS balance
  FROM latest_shifts ls
  LEFT JOIN topups t   ON t.outlet_id = ls.outlet_id
  LEFT JOIN expenses e ON e.outlet_id = ls.outlet_id;
END;
$$;

-- Hak akses: admin / finance yang biasanya memanggil ini
GRANT EXECUTE ON FUNCTION public.get_all_latest_petty_cash_balances() TO authenticated;
