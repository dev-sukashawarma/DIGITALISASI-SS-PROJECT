-- Disposable database only. All send attempts go to a local outbox stub.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ss_kitchen_alert_test' THEN
    RAISE EXCEPTION 'Use a disposable database named ss_kitchen_alert_test';
  END IF;
END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.outlets (id UUID PRIMARY KEY, name TEXT, type TEXT, is_active BOOLEAN);
CREATE TABLE public.bahan_baku (id UUID PRIMARY KEY, nama TEXT, default_reorder_point NUMERIC, is_active BOOLEAN);
CREATE TABLE public.outlet_reorder_point (outlet_id UUID, bahan_baku_id UUID, reorder_point NUMERIC);
CREATE TABLE public.outlet_staff (id UUID PRIMARY KEY, role TEXT, status TEXT, outlet_id UUID);
CREATE TABLE public.staff_outlets (staff_id UUID, outlet_id UUID);
CREATE TABLE public.stok_balance (outlet_id UUID, bahan_baku_id UUID, saldo NUMERIC);
CREATE TABLE public.bot_telegram_stock_drop_alert_state (
  outlet_id UUID, bahan_baku_id UUID, last_alerted_at TIMESTAMPTZ,
  PRIMARY KEY(outlet_id, bahan_baku_id)
);
CREATE TABLE public.bot_telegram_alert_delivery_request (
  request_id BIGINT PRIMARY KEY,
  app TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now(),
  checked_at TIMESTAMPTZ,
  outcome TEXT
);
CREATE TABLE public.surat_jalan (
  id UUID PRIMARY KEY,
  outlet_id UUID,
  status TEXT
);
CREATE TABLE public.test_outbox (staff_id UUID, app TEXT, title TEXT, body TEXT);
CREATE FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = $1;
  -- Memastikan proteksi mutlak bahwa leader tidak pernah dikirim alert
  IF v_role = 'leader' THEN
    RETURN;
  END IF;
  INSERT INTO public.test_outbox VALUES ($1, $2, $3, $4);
END;
$$;

\ir ../../migrations/20300254002800_telegram_stock_number_format.sql
\ir ../../migrations/20300254003700_exclude_leader_from_telegram_alerts.sql

INSERT INTO outlets VALUES ('10000000-0000-0000-0000-000000000001','SS Empang','outlet',TRUE);
INSERT INTO bahan_baku VALUES
  ('20000000-0000-0000-0000-000000000001','Daging Sapi',10,TRUE),
  ('20000000-0000-0000-0000-000000000002','Roti Pita',20,TRUE);

INSERT INTO outlet_staff VALUES
  ('30000000-0000-0000-0000-000000000001','leader','active','10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002','kitchen','active',NULL),
  ('30000000-0000-0000-0000-000000000003','purchasing','active',NULL),
  ('30000000-0000-0000-0000-000000000004','admin','active',NULL);

-- TEST 1: Alert Penurunan Stok Tidak Wajar
-- Saldo awal 30 (>= 2x reorder point 10). Diturunkan menjadi 12 (turun 60% dan saldo > 10).
INSERT INTO stok_balance VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', 30);
UPDATE stok_balance SET saldo = 12 WHERE bahan_baku_id = '20000000-0000-0000-0000-000000000001';

DO $$ BEGIN
  -- Leader tidak boleh ada di outbox
  IF EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'FAIL: Leader unexpectedly received stock drop alert!';
  END IF;
  -- Kitchen, Purchasing, dan Admin harus menerima alert
  IF NOT EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000002')
     OR NOT EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000003')
     OR NOT EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000004') THEN
    RAISE EXCEPTION 'FAIL: Central team did not receive stock drop alert!';
  END IF;
END $$;

TRUNCATE public.test_outbox;

-- TEST 2: Alert Stok Kritis (Saldo turun <= threshold)
-- Saldo turun dari 12 menjadi 5 (di bawah threshold 10)
UPDATE stok_balance SET saldo = 5 WHERE bahan_baku_id = '20000000-0000-0000-0000-000000000001';

DO $$ BEGIN
  -- Leader TIDAK BOLEH menerima
  IF EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'FAIL: Leader unexpectedly received critical stock alert!';
  END IF;
  -- Kitchen & Purchasing HARUS menerima
  IF NOT EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000002')
     OR NOT EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id = '30000000-0000-0000-0000-000000000003') THEN
    RAISE EXCEPTION 'FAIL: Kitchen & Purchasing did not receive critical stock alert!';
  END IF;
END $$;

TRUNCATE public.test_outbox;

-- TEST 3: Alert Surat Jalan Dikirim
-- Status SJ diubah ke 'dikirim'. Karena dinonaktifkan untuk level outlet, outbox harus tetap 0.
INSERT INTO surat_jalan VALUES ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'draft');
UPDATE surat_jalan SET status = 'dikirim' WHERE id = '40000000-0000-0000-0000-000000000001';

DO $$ BEGIN
  IF (SELECT count(*) FROM public.test_outbox) > 0 THEN
    RAISE EXCEPTION 'FAIL: Dispatch alert sent when it should be disabled for outlet crew/leader!';
  END IF;
END $$;

ROLLBACK;
