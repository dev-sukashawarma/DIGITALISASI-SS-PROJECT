-- 20260619100300_create_expenses.sql
-- Create expenses table (seed dummy dihapus 2026-06-25 — lihat 20260625110000_remove_dummy_expenses.sql)

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bahan_baku', 'gaji', 'operasional', 'sewa', 'utilitas', 'lainnya')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "expenses_select_all" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_insert_all" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "expenses_update_all" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "expenses_delete_all" ON public.expenses FOR DELETE TO authenticated USING (true);

-- Grant select and modifications to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

-- CATATAN: Seed pengeluaran dummy (gaji/bahan baku/sewa karangan untuk 19 outlet)
-- dihapus pada 2026-06-25 atas permintaan owner — tabel ini hanya berisi data
-- pengeluaran asli. Pembersihan baris dummy yang terlanjur ter-insert di remote
-- dilakukan oleh migration 20260625110000_remove_dummy_expenses.sql.
