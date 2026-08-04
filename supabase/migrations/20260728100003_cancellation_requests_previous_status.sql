-- Fix: /api/cancellations/action hardcode order.status kembali ke 'pending'
-- saat reject, padahal order bisa diajukan cancel dari status 'preparing'
-- juga (lihat apps/pos-kasir KasirOrderClient.tsx). Simpan status order pada
-- saat pengajuan supaya reject bisa restore ke nilai yang benar.
-- Additive, nullable — baris lama tetap fallback ke 'pending' di app layer.

CREATE TABLE IF NOT EXISTS public.cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id),
    status TEXT DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.cancellation_requests
  ADD COLUMN IF NOT EXISTS previous_order_status text;
