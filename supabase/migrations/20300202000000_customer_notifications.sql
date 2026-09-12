-- supabase/migrations/20300202000000_customer_notifications.sql
--
-- Tabel notifikasi pelanggan dan token push FCM untuk aplikasi retail Suka Shawarma.
--
-- Sepenuhnya aditif di skema `retail`:
--   1. retail.customer_push_tokens: mencatat token FCM perangkat pelanggan dan preferensi toggle notifikasi
--   2. retail.customer_notifications: mencatat riwayat notifikasi (inbox) yang dikirim ke pelanggan
--
-- Sesuai arsitektur gateway:
--   * Tabel dilindungi RLS (default deny untuk anon/authenticated);
--   * Hanya Retail Gateway (service_role) yang mengakses tabel ini secara terotorisasi.

CREATE TABLE IF NOT EXISTS retail.customer_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES retail.customers (id) ON DELETE CASCADE,
  fcm_token text NOT NULL UNIQUE,
  device_info text,
  notify_order_status boolean NOT NULL DEFAULT true,
  notify_promotions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retail.customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES retail.customers (id) ON DELETE CASCADE,
  order_id uuid REFERENCES retail.order_drafts (id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'order_status'
    CHECK (type IN ('order_status', 'reminder', 'promo', 'system')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_notifications_customer_idx
  ON retail.customer_notifications (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_notifications_unread_idx
  ON retail.customer_notifications (customer_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS customer_push_tokens_customer_idx
  ON retail.customer_push_tokens (customer_id);

ALTER TABLE retail.customer_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.customer_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE retail.customer_push_tokens IS
  'Token FCM perangkat pelanggan dan preferensi kanal notifikasi (transaksional vs pemasaran)';

COMMENT ON TABLE retail.customer_notifications IS
  'Kotak masuk / log riwayat notifikasi pelanggan aplikasi retail';

NOTIFY pgrst, 'reload schema';
