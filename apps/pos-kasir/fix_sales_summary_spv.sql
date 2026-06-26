-- ============================================================
-- Fix: Pastikan view sales_summary_spv mencakup SEMUA order
-- yang statusnya 'completed', termasuk yang dari Online
-- ============================================================

DROP VIEW IF EXISTS sales_summary_spv;

CREATE VIEW sales_summary_spv AS
SELECT 
  DATE(created_at AT TIME ZONE 'Asia/Jakarta') AS sales_date,
  SUM(total_amount) AS omzet,
  outlet_id
FROM orders
WHERE status = 'completed'
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Jakarta'), outlet_id;

-- Setelah menjalankan ini, grafik "Tren Pendapatan Interaktif" 
-- di halaman Overview Ringkas Admin akan secara otomatis
-- memasukkan pendapatan dari order online yang sudah diselesaikan Kasir.
