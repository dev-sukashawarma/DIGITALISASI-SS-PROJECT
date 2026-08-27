-- Add order_type column to orders table to support scheduled orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'regular';
