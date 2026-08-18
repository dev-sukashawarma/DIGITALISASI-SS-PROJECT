-- Tambahkan kolom pos_client pada tabel orders
ALTER TABLE orders ADD COLUMN pos_client TEXT DEFAULT 'web' CHECK (pos_client IN ('web', 'native'));

-- Update existing orders to have 'web' as pos_client
UPDATE orders SET pos_client = 'web' WHERE pos_client IS NULL;
