-- ============================================================
-- Fitur: Pencatatan Pesanan Walk-in (Kasir Langsung)
--
-- Kasir mencatat pesanan pelanggan yang datang langsung ke kasir,
-- membayar tunai (dengan kembalian) atau QRIS. Order langsung masuk
-- status 'preparing' (Sedang Diproses), source 'pos'.
--
-- Dua kolom di bawah menyimpan jejak kas untuk pembayaran tunai.
-- Keduanya nullable & aditif -> tidak mempengaruhi kiosk/manual/online.
-- ============================================================

-- Uang tunai yang diserahkan pelanggan (null untuk QRIS / non-walk-in)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2);

-- Kembalian yang diberikan kasir (null jika bukan tunai)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10,2);
