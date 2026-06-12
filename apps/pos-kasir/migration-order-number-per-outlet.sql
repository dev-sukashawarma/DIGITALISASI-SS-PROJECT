-- ============================================================
-- MIGRATION: NOMOR ANTRIAN PER-OUTLET
-- Jalankan sekali di Supabase SQL Editor.
--
-- Sebelumnya: order_number = SERIAL global (UNIQUE) → nomor antrian
-- tercampur antar-outlet. Sesudah: setiap outlet punya urutan sendiri
-- (mis. cabang A: 1,2,3… dan cabang B: 1,2,3…), aman dari balapan (race)
-- karena memakai counter tabel dengan UPSERT atomik.
-- ============================================================

-- 1. Tabel counter per outlet
CREATE TABLE IF NOT EXISTS outlet_order_counters (
  outlet_id   UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- 2. Lepas SERIAL global: hapus default sequence & constraint UNIQUE global
ALTER TABLE orders ALTER COLUMN order_number DROP DEFAULT;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

-- 3. Unik per kombinasi (outlet_id, order_number) — boleh sama antar outlet
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_outlet_number_unique;
ALTER TABLE orders ADD CONSTRAINT orders_outlet_number_unique UNIQUE (outlet_id, order_number);

-- 4. Seed counter dari data yang sudah ada agar nomor baru tidak bentrok
INSERT INTO outlet_order_counters (outlet_id, last_number)
SELECT outlet_id, COALESCE(MAX(order_number), 0)
FROM orders
WHERE outlet_id IS NOT NULL
GROUP BY outlet_id
ON CONFLICT (outlet_id) DO UPDATE SET last_number = EXCLUDED.last_number;

-- 5. Fungsi + trigger: isi order_number otomatis per outlet saat INSERT
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  INSERT INTO outlet_order_counters (outlet_id, last_number)
  VALUES (NEW.outlet_id, 1)
  ON CONFLICT (outlet_id)
  DO UPDATE SET last_number = outlet_order_counters.last_number + 1
  RETURNING last_number INTO next_num;

  NEW.order_number := next_num;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_number ON orders;
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- SELESAI. Nomor antrian kini terpisah per outlet.
