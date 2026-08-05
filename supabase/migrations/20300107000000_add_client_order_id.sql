-- supabase/migrations/20300107000000_add_client_order_id.sql
-- Add missing client_order_id column for idempotency
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_order_id uuid UNIQUE;
