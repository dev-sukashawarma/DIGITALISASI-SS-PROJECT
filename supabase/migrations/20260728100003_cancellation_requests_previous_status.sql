-- Fix: /api/cancellations/action hardcode order.status kembali ke 'pending'
-- saat reject, padahal order bisa diajukan cancel dari status 'preparing'
-- juga (lihat apps/pos-kasir KasirOrderClient.tsx). Simpan status order pada
-- saat pengajuan supaya reject bisa restore ke nilai yang benar.
-- Additive, nullable — baris lama tetap fallback ke 'pending' di app layer.
ALTER TABLE cancellation_requests
  ADD COLUMN IF NOT EXISTS previous_order_status text;
