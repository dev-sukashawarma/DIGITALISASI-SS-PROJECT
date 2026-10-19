-- Disposable database only. All send attempts go to a local outbox stub.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ss_gudang_alert_test' THEN
    RAISE EXCEPTION 'Use a disposable database named ss_gudang_alert_test';
  END IF;
END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE TABLE public.outlets (
  id UUID PRIMARY KEY,
  name TEXT,
  slug TEXT,
  type TEXT,
  is_active BOOLEAN
);

CREATE TABLE public.bahan_baku (
  id UUID PRIMARY KEY,
  nama TEXT,
  satuan TEXT,
  default_reorder_point NUMERIC,
  threshold_type TEXT DEFAULT 'angka',
  threshold_persentase NUMERIC DEFAULT 20,
  stok_ideal NUMERIC DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.outlet_staff (
  id UUID PRIMARY KEY,
  name TEXT,
  role TEXT,
  status TEXT,
  outlet_id UUID
);

CREATE TABLE public.stok_balance (
  outlet_id UUID REFERENCES outlets(id),
  bahan_baku_id UUID REFERENCES bahan_baku(id),
  saldo NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (outlet_id, bahan_baku_id)
);

CREATE TABLE public.outlet_reorder_point (
  outlet_id UUID REFERENCES outlets(id),
  bahan_baku_id UUID REFERENCES bahan_baku(id),
  reorder_point NUMERIC,
  stok_ideal NUMERIC,
  threshold_type TEXT DEFAULT 'angka',
  threshold_persentase NUMERIC,
  PRIMARY KEY (outlet_id, bahan_baku_id)
);

CREATE TABLE public.permintaan_bahan (
  id UUID PRIMARY KEY,
  outlet_id UUID REFERENCES outlets(id),
  dibuat_oleh UUID REFERENCES outlet_staff(id),
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.permintaan_bahan_item (
  id UUID PRIMARY KEY,
  permintaan_id UUID REFERENCES permintaan_bahan(id),
  bahan_baku_id UUID REFERENCES bahan_baku(id),
  qty_diminta NUMERIC
);

CREATE TABLE public.purchase_order (
  id UUID PRIMARY KEY,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.purchase_order_item (
  id UUID PRIMARY KEY,
  purchase_order_id UUID REFERENCES purchase_order(id),
  bahan_baku_id UUID REFERENCES bahan_baku(id),
  qty_pesan NUMERIC,
  qty_terima NUMERIC
);

-- Mock cron schema
CREATE SCHEMA IF NOT EXISTS cron;
CREATE OR REPLACE FUNCTION cron.schedule(TEXT, TEXT, TEXT) RETURNS BIGINT LANGUAGE sql AS $$ SELECT 1::bigint; $$;
CREATE OR REPLACE FUNCTION cron.unschedule(TEXT) RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT TRUE; $$;

CREATE TABLE public.test_outbox (
  staff_id UUID,
  app TEXT,
  title TEXT,
  body TEXT,
  outlet_id UUID
);

CREATE FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = $1;
  IF v_role = 'leader' THEN
    RETURN;
  END IF;
  INSERT INTO public.test_outbox VALUES ($1, $2, $3, $4, $6);
END;
$$;

\ir ../../migrations/20300254002800_telegram_stock_number_format.sql
\ir ../../migrations/20300254004100_gudang_pusat_pengadaan_dan_defisit_alerts.sql

-- 1. Setup Outlet: Gudang Pusat dan Cabang Pajajaran
INSERT INTO outlets VALUES
  ('d23e11b3-23f1-4f9a-b428-cc73e1aa9b90', 'GUDANG PUSAT (HQ)', 'hq', 'gudang', TRUE),
  ('10000000-0000-0000-0000-000000000001', 'SS Pajajaran', 'ss-pajajaran', 'internal', TRUE);

-- 2. Setup Bahan Baku
INSERT INTO bahan_baku (id, nama, satuan, default_reorder_point, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Daging Sapi Marinasi', 'kg', 50, TRUE),
  ('20000000-0000-0000-0000-000000000002', 'Kulit Tortilla 28', 'pack', 30, TRUE);

-- 3. Setup Saldo Gudang Pusat: Daging sapi hanya ada 10 kg (ROP 50 kg), Kulit ada 100 pack
INSERT INTO stok_balance VALUES
  ('d23e11b3-23f1-4f9a-b428-cc73e1aa9b90', '20000000-0000-0000-0000-000000000001', 10),
  ('d23e11b3-23f1-4f9a-b428-cc73e1aa9b90', '20000000-0000-0000-0000-000000000002', 100);

-- 4. Setup Staf Penerima
INSERT INTO outlet_staff VALUES
  ('30000000-0000-0000-0000-000000000001', 'Siti Purchasing', 'purchasing', 'active', NULL),
  ('30000000-0000-0000-0000-000000000002', 'Chef Budi', 'kitchen', 'active', NULL),
  ('30000000-0000-0000-0000-000000000003', 'Pak Owner', 'owner', 'active', NULL),
  ('30000000-0000-0000-0000-000000000004', 'Doni Leader', 'leader', 'active', '10000000-0000-0000-0000-000000000001');

-- TEST 1: Cabang membuat permintaan bahan 25 kg daging sapi (stok gudang cuma 10 kg -> DEFISIT 15 kg!)
INSERT INTO permintaan_bahan (id, outlet_id, status)
VALUES ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'menunggu');

INSERT INTO permintaan_bahan_item (id, permintaan_id, bahan_baku_id, qty_diminta)
VALUES ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 25);

COMMIT;

-- Mulai transaksi baru untuk verifikasi hasil TEST 1
BEGIN;
DO $$ BEGIN
  -- Purchasing, Kitchen, Owner HARUS menerima alert real-time defisit
  IF NOT EXISTS (
    SELECT 1 FROM public.test_outbox
    WHERE staff_id = '30000000-0000-0000-0000-000000000001'
      AND title LIKE '%Defisit Stok Gudang Pusat · SS Pajajaran%'
      AND body LIKE '%Daging Sapi Marinasi: Diminta 25 kg | Sisa Gudang: 10 kg (Kurang: 15 kg)%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Purchasing did not receive warehouse stock deficit alert!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.test_outbox
    WHERE staff_id = '30000000-0000-0000-0000-000000000002'
      AND title LIKE '%Defisit Stok Gudang Pusat · SS Pajajaran%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Kitchen did not receive warehouse stock deficit alert!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.test_outbox
    WHERE staff_id = '30000000-0000-0000-0000-000000000003'
      AND title LIKE '%Defisit Stok Gudang Pusat · SS Pajajaran%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Owner did not receive warehouse stock deficit alert!';
  END IF;

  -- Leader TIDAK BOLEH menerima
  IF EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000004') THEN
    RAISE EXCEPTION 'FAIL: Leader received warehouse stock deficit alert!';
  END IF;
END $$;

-- TEST 2: Uji Rekap Harian Pagi (08:30 WIB)
TRUNCATE public.test_outbox;
DO $$ 
DECLARE
  v_res INT;
BEGIN
  v_res := public.bot_telegram_rekap_pengadaan_gudang_pagi(now());
  IF v_res < 3 THEN
    RAISE EXCEPTION 'FAIL: Rekap pengadaan pagi should send to at least 3 recipients, got %', v_res;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.test_outbox
    WHERE staff_id = '30000000-0000-0000-0000-000000000001'
      AND title LIKE '%Rekap Saran Pengadaan Gudang Pusat%'
      AND body LIKE '%STATUS MENDESAK%'
      AND body LIKE '%Daging Sapi Marinasi%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Morning purchase suggestion did not include urgent beef stock!';
  END IF;
END $$;

ROLLBACK;
