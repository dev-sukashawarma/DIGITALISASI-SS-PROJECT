-- 20260619100300_create_expenses.sql
-- Create expenses table and seed it with realistic monthly costs for 19 outlets

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

-- Seed historical monthly operational expenses for the 19 outlets (April, May, and June 2026)
DO $$
DECLARE
  outlet_record RECORD;
  base_date DATE;
  i INT;
BEGIN
  -- Loop through each outlet
  FOR outlet_record IN SELECT id, name FROM public.outlets LOOP
    -- Seed data for April, May, and June 2026
    FOR i IN 0..2 LOOP
      base_date := DATE '2026-04-01' + (i || ' month')::INTERVAL;
      
      -- 1. Gaji Karyawan (Staff Salaries) - Paid on the 5th of each month
      INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date)
      VALUES (
        outlet_record.id,
        'gaji',
        CASE 
          WHEN outlet_record.name LIKE '%KITCHEN%' THEN 25000000.00
          WHEN outlet_record.name LIKE '%MITRA%' THEN 8000000.00
          ELSE 12000000.00
        END + (random() * 1000000 - 500000), -- Random variation
        'Pembayaran Gaji Karyawan Outlet Bulanan',
        base_date + INTERVAL '4 days'
      );

      -- 2. Bahan Baku (Raw Materials Purchases) - Paid on the 1st of each month
      INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date)
      VALUES (
        outlet_record.id,
        'bahan_baku',
        CASE 
          WHEN outlet_record.name LIKE '%KITCHEN%' THEN 75000000.00
          WHEN outlet_record.name LIKE '%MITRA%' THEN 15000000.00
          ELSE 35000000.00
        END + (random() * 4000000 - 2000000),
        'Belanja Bulanan Bahan Baku Utama (Daging, Sayur, Roti, Saus)',
        base_date
      );

      -- 3. Utilitas (Utilities - Electricity, Water, Gas, Internet) - Paid on the 10th of each month
      INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date)
      VALUES (
        outlet_record.id,
        'utilitas',
        CASE 
          WHEN outlet_record.name LIKE '%KITCHEN%' THEN 8000000.00
          WHEN outlet_record.name LIKE '%MITRA%' THEN 2000000.00
          ELSE 35000000.00 / 10.00 -- approx 3.5jt
        END + (random() * 400000 - 200000),
        'Tagihan Listrik, Air, Gas, dan Internet Outlet',
        base_date + INTERVAL '9 days'
      );

      -- 4. Sewa Tempat (Rent) - Paid on the 1st of each month
      INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date)
      VALUES (
        outlet_record.id,
        'sewa',
        CASE 
          WHEN outlet_record.name LIKE '%KITCHEN%' THEN 15000000.00
          WHEN outlet_record.name LIKE '%MITRA%' THEN 0.00 -- Mitra handles their own space, or lower
          ELSE 6000000.00
        END,
        'Biaya Sewa Tempat Outlet Bulanan',
        base_date
      );

      -- 5. Operasional Lainnya (Operational - Cleaning, Minor repairs, Logistics) - Paid on the 15th of each month
      INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date)
      VALUES (
        outlet_record.id,
        'operasional',
        1500000.00 + (random() * 500000 - 250000),
        'Pengeluaran Kebersihan, Keamanan, dan Logistik Harian',
        base_date + INTERVAL '14 days'
      );

      -- 6. Pengeluaran Lain-lain (Miscellaneous) - Paid on the 20th of each month
      INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date)
      VALUES (
        outlet_record.id,
        'lainnya',
        500000.00 + (random() * 200000 - 100000),
        'Biaya darurat atau pengeluaran tak terduga',
        base_date + INTERVAL '19 days'
      );
    END LOOP;
  END LOOP;
END $$;
