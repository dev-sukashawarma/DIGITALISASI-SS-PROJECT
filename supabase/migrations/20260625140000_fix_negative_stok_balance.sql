-- Bersihkan saldo negatif yang terlanjur masuk sebelum guard dipasang.
-- Set ke 0 agar tampilan monitoring konsisten (stok tidak bisa minus).
UPDATE stok_balance SET saldo = 0, updated_at = NOW() WHERE saldo < 0;
