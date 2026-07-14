-- Add kitchen_receipt_printed column to orders table if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS kitchen_receipt_printed boolean DEFAULT false;

-- Notify PostgREST to reload the schema cache so the frontend can immediately use it
NOTIFY pgrst, 'reload schema';
