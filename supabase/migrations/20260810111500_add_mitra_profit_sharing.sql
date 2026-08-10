-- Migration: Add profit sharing config to mitra_investments
ALTER TABLE public.mitra_investments
ADD COLUMN IF NOT EXISTS is_profit_sharing_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS persentase_bagi_hasil integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS management_fee numeric DEFAULT 0;
