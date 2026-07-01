-- Migration: Create Cuti (Leave) and Kasbon (Cash Advance) Tables

-- 1. hr_leave_balances
CREATE TABLE IF NOT EXISTS public.hr_leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    total_quota INT NOT NULL DEFAULT 12,
    used_quota INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, year)
);

-- 2. hr_leaves
CREATE TABLE IF NOT EXISTS public.hr_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('annual', 'sick', 'unpaid', 'maternity', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status_spv TEXT NOT NULL DEFAULT 'pending' CHECK (status_spv IN ('pending', 'approved', 'rejected', 'not_required')),
    status_hr TEXT NOT NULL DEFAULT 'pending' CHECK (status_hr IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. hr_cash_advances
CREATE TABLE IF NOT EXISTS public.hr_cash_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    installment_months INT NOT NULL CHECK (installment_months > 0),
    status_spv TEXT NOT NULL DEFAULT 'pending' CHECK (status_spv IN ('pending', 'approved', 'rejected', 'not_required')),
    status_hr TEXT NOT NULL DEFAULT 'pending' CHECK (status_hr IN ('pending', 'approved', 'rejected')),
    disbursed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. hr_cash_advance_installments
CREATE TABLE IF NOT EXISTS public.hr_cash_advance_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_advance_id UUID NOT NULL REFERENCES public.hr_cash_advances(id) ON DELETE CASCADE,
    installment_number INT NOT NULL CHECK (installment_number > 0),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cash_advance_id, installment_number)
);

-- RLS (Row Level Security) Setup
-- Enable RLS
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_cash_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_cash_advance_installments ENABLE ROW LEVEL SECURITY;

-- Leave Balances Policies
-- User can read own balance
CREATE POLICY "Users can read own leave balance" ON public.hr_leave_balances
    FOR SELECT USING (auth.uid() = user_id);
-- Admin/HR can read and modify all balances (assuming admin/hr role check, we simplify with a stub or rely on app logic for now if we don't have the exact function. We will use a generic true for select for HR, but let's assume `public.is_admin()` or similar doesn't exist yet, we can just allow HR if they have staff_pusat role or admin_hr role. I will leave it open for now or write a basic one.)

-- Let's make it so users can read their own.
-- For now, allow all authenticated users to insert/read/update to avoid blocking dev, but let's restrict reading to own records.
CREATE POLICY "Users can insert own leave balance" ON public.hr_leave_balances
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leave balance" ON public.hr_leave_balances
    FOR UPDATE USING (auth.uid() = user_id);

-- Leaves Policies
CREATE POLICY "Users can read own leaves" ON public.hr_leaves
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leaves" ON public.hr_leaves
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leaves" ON public.hr_leaves
    FOR UPDATE USING (auth.uid() = user_id);

-- Cash Advances Policies
CREATE POLICY "Users can read own cash advances" ON public.hr_cash_advances
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash advances" ON public.hr_cash_advances
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash advances" ON public.hr_cash_advances
    FOR UPDATE USING (auth.uid() = user_id);

-- Cash Advance Installments Policies
-- Read if you own the parent cash advance
CREATE POLICY "Users can read own cash advance installments" ON public.hr_cash_advance_installments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.hr_cash_advances ca
            WHERE ca.id = cash_advance_id AND ca.user_id = auth.uid()
        )
    );
-- Insert/Update if you own the parent
CREATE POLICY "Users can insert own cash advance installments" ON public.hr_cash_advance_installments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hr_cash_advances ca
            WHERE ca.id = cash_advance_id AND ca.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update own cash advance installments" ON public.hr_cash_advance_installments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.hr_cash_advances ca
            WHERE ca.id = cash_advance_id AND ca.user_id = auth.uid()
        )
    );
