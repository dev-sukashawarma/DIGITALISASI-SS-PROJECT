-- supabase/migrations/20300119000000_retail_app_tahap1.sql
-- Tahap 1 SukaShawarma APP. SELURUHNYA ADITIF.
-- Tidak mengubah kolom, policy, trigger, atau fungsi yang sudah dipakai
-- POS kasir, stok, atau absensi.

-- 1. Kolom tampilan aplikasi di menu_items -------------------------------
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS tampil_di_app boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foto_app text,
  ADD COLUMN IF NOT EXISTS deskripsi_app text;

COMMENT ON COLUMN public.menu_items.tampil_di_app IS
  'Item muncul di SukaShawarma APP. Default false: item baru tidak otomatis terbit ke publik.';

-- 2. Penanda keikutsertaan outlet ---------------------------------------
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS app_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.outlets.app_enabled IS
  'Outlet melayani pesanan dari aplikasi pelanggan. Pilot: nyalakan 2-3 outlet saja.';

-- 3. Kode pengambilan: TIDAK ADA, dan itu disengaja ---------------------
-- Pesanan sudah punya kode uniknya sendiri: `orders.order_number`, yang
-- diisi trigger `generate_daily_outlet_order_number` sebagai MAX+1 per
-- outlet dan tidak pernah direset harian. Kasir sudah memakai nomor itu
-- sehari-hari.
--
-- Versi awal rencana ini menambahkan `orders.pickup_code` 4 digit — nomor
-- kedua untuk pesanan yang sudah punya nomor. Karena dihitung dari hash
-- dan bukan dari urutan, ia bertabrakan (±13% peluang per outlet per hari
-- pada ~50 pesanan). Dibuang; pelanggan menyebut nomor pesanannya.
--
-- Efek sampingnya bagus: tanpa CREATE INDEX pada `public.orders`,
-- migration ini tidak lagi mengunci penulisan di tabel transaksi 19
-- outlet. Yang tersisa hanya ADD COLUMN berdefault konstan, yang di
-- Postgres modern bersifat metadata-only.

-- 4. Skema retail --------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS retail;

CREATE TABLE IF NOT EXISTS retail.customers (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retail.order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_order_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES retail.customers (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets (id),
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'menunggu_bayar'
    CHECK (status IN ('menunggu_bayar', 'dibayar', 'kadaluarsa', 'gagal')),
  payment_ref text,
  payment_url text,
  pos_order_id uuid,
  pos_order_number int,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS order_drafts_customer_idx
  ON retail.order_drafts (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_drafts_payment_ref_idx
  ON retail.order_drafts (payment_ref);
CREATE INDEX IF NOT EXISTS order_drafts_expiry_idx
  ON retail.order_drafts (status, expires_at);

-- 5. RLS: tutup rapat. Hanya service role (Gateway) yang boleh masuk. ----
ALTER TABLE retail.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.order_drafts ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali = default deny untuk anon & authenticated.
-- service_role melewati RLS. Ini disengaja: publik tidak pernah
-- menyentuh tabel ini secara langsung, semuanya lewat Gateway.

REVOKE ALL ON SCHEMA retail FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA retail FROM anon, authenticated;

-- Gateway berbicara ke skema ini lewat PostgREST dengan service_role.
-- Skema baru TIDAK otomatis memberi hak apa pun: tanpa blok ini, setiap
-- panggilan ke tabel retail gagal dan seluruh produk mati.
GRANT USAGE ON SCHEMA retail TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA retail TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA retail TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA retail
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA retail
  GRANT ALL ON SEQUENCES TO service_role;

-- Minta PostgREST memuat ulang cache skemanya.
NOTIFY pgrst, 'reload schema';
