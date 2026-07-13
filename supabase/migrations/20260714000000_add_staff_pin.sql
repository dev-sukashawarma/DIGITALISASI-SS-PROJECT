-- supabase/migrations/20260714000000_add_staff_pin.sql

-- Add pin column to outlet_staff with a default of '123456' for existing records
ALTER TABLE public.outlet_staff
ADD COLUMN IF NOT EXISTS pin VARCHAR(6) DEFAULT '123456';
