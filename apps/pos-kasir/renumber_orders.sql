-- Skrip ini akan mengurutkan ulang (me-renumber) seluruh nomor antrean (order_number) 
-- yang sudah terlanjur loncat menjadi urut mulai dari 1 untuk setiap outlet setiap harinya.

WITH numbered_orders AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (
      PARTITION BY outlet_id, DATE(created_at AT TIME ZONE 'Asia/Jakarta') 
      ORDER BY created_at ASC
    ) as new_order_number
  FROM orders
)
UPDATE orders
SET order_number = numbered_orders.new_order_number
FROM numbered_orders
WHERE orders.id = numbered_orders.id
  AND orders.order_number IS DISTINCT FROM numbered_orders.new_order_number;
