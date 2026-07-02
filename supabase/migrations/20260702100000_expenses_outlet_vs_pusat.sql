-- 20260702100000_expenses_outlet_vs_pusat.sql
-- Pengeluaran dua scope: Outlet (outlet_id terisi) vs Pusat (outlet_id NULL).
-- Ganti total 6 enum kategori lama → 14 kategori kanonik. Data lama = dummy,
-- dikosongkan (lihat ADR-013 & migration 20260625110000_remove_dummy_expenses).

-- 1. Kosongkan data lama (kategori 6-enum tak lagi valid; dummy sudah dihapus)
DELETE FROM public.expenses;

-- 2. outlet_id nullable (NULL = Pengeluaran Pusat / company-wide)
ALTER TABLE public.expenses ALTER COLUMN outlet_id DROP NOT NULL;

-- 3. Kolom periode rekap bulanan (selalu tanggal-1 bulan ybs)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS period_month DATE NOT NULL;

-- 4. Ganti CHECK category (drop nama lama, buat 14 kategori)
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'pengeluaran_outlet','gaji_crew_outlet','bonus_leader','bonus_korlap',
  'lembur','ads','endorsement','promo','pdam','pln','internet','sewa_outlet',
  'pengeluaran_global','gaji_staff_kantor'));

-- 5. Integritas scope: kategori pusat ⇔ outlet_id NULL
ALTER TABLE public.expenses ADD CONSTRAINT expenses_scope_check CHECK (
  (category IN ('pengeluaran_global','gaji_staff_kantor')) = (outlet_id IS NULL));

-- 6. Upsert per periode (NULLS NOT DISTINCT agar dua baris pusat NULL dianggap sama)
CREATE UNIQUE INDEX IF NOT EXISTS expenses_period_unique
  ON public.expenses (outlet_id, category, period_month) NULLS NOT DISTINCT;

-- 7. Helper: apakah user saat ini owner (untuk gate tulis Pengeluaran Pusat)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner');
$$;

-- 8. RLS SELECT: outlet rows per accessible_outlet_ids; pusat rows (NULL) owner/admin only
DROP POLICY IF EXISTS "expenses_select_scoped" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_all" ON public.expenses;
CREATE POLICY "expenses_select_scoped" ON public.expenses FOR SELECT TO authenticated USING (
  outlet_id IN (SELECT public.accessible_outlet_ids())
  OR (outlet_id IS NULL AND public.is_owner_or_admin())
);

-- 9. Tutup jalur tulis langsung (permissif lama) — tulis hanya lewat RPC di Step 10
DROP POLICY IF EXISTS "expenses_insert_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_all" ON public.expenses;
REVOKE INSERT, UPDATE, DELETE ON public.expenses FROM authenticated;

-- 10. RPC upsert rekap bulanan (owner/admin; pusat owner-only)
CREATE OR REPLACE FUNCTION public.upsert_expense(
  p_outlet UUID, p_category TEXT, p_period_month DATE, p_amount NUMERIC, p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_pusat BOOLEAN := p_category IN ('pengeluaran_global','gaji_staff_kantor');
BEGIN
  IF is_pusat THEN
    IF p_outlet IS NOT NULL THEN RAISE EXCEPTION 'Kategori pusat tak boleh punya outlet'; END IF;
    IF NOT public.is_owner() THEN RAISE EXCEPTION 'Hanya owner yang boleh input Pengeluaran Pusat'; END IF;
  ELSE
    IF p_outlet IS NULL THEN RAISE EXCEPTION 'Kategori outlet wajib punya outlet'; END IF;
    IF NOT public.is_owner_or_admin() THEN RAISE EXCEPTION 'Hanya owner/admin yang boleh input pengeluaran'; END IF;
  END IF;

  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, period_month)
  VALUES (p_outlet, p_category, p_amount, p_description, date_trunc('month', p_period_month)::date, date_trunc('month', p_period_month)::date)
  ON CONFLICT (outlet_id, category, period_month)
  DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_expense(UUID, TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
