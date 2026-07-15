ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_receipt_printed BOOLEAN DEFAULT false;
