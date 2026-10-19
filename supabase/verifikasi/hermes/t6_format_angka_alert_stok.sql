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
CREATE TABLE public.test_outbox (staff_id UUID, title TEXT, body TEXT);
CREATE FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO public.test_outbox VALUES ($1, $3, $4);
$$;
\ir ../../migrations/20300254002800_telegram_stock_number_format.sql
CREATE TRIGGER test_drop AFTER UPDATE OF saldo ON stok_balance
  FOR EACH ROW EXECUTE FUNCTION bot_telegram_alert_penurunan_stok_tidak_wajar();
CREATE TRIGGER test_critical AFTER INSERT OR UPDATE ON stok_balance
  FOR EACH ROW EXECUTE FUNCTION bot_telegram_alert_stok_kritis();

DO $$ BEGIN
  IF public.bot_telegram_format_angka(5.00000000000000000000) <> '5'
    OR public.bot_telegram_format_angka(2.50000000000000000000) <> '2,5'
    OR public.bot_telegram_format_angka(1.23456789) <> '1,235'
    OR public.bot_telegram_format_angka(-2.50000) <> '-2,5'
    OR public.bot_telegram_format_angka(0.00000) <> '0'
    OR public.bot_telegram_format_angka(60.0) <> '60'
    OR public.bot_telegram_format_angka(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: numeric formatter';
  END IF;
END $$;

INSERT INTO outlets VALUES ('10000000-0000-0000-0000-000000000001','Jagakarsa','outlet',TRUE);
INSERT INTO bahan_baku VALUES
  ('20000000-0000-0000-0000-000000000001','PLASTIK MERAH',1,TRUE),
  ('20000000-0000-0000-0000-000000000002','AYAM',5,TRUE);
INSERT INTO outlet_staff VALUES
  ('30000000-0000-0000-0000-000000000001','developer','active',NULL),
  ('30000000-0000-0000-0000-000000000002','leader','active','10000000-0000-0000-0000-000000000001');
INSERT INTO stok_balance VALUES
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',5.00000000000000000000);
UPDATE stok_balance SET saldo=2.00000000000000000000;
DO $$ BEGIN
  IF (SELECT count(*) FROM test_outbox) <> 2 OR EXISTS (
    SELECT 1 FROM test_outbox
    WHERE body NOT LIKE '%turun 60% dalam satu perubahan (5 → 2).%'
  ) THEN RAISE EXCEPTION 'FAIL: stock-drop text or recipients'; END IF;
  IF (SELECT saldo FROM stok_balance) IS DISTINCT FROM 2.00000000000000000000::numeric THEN
    RAISE EXCEPTION 'FAIL: formatter changed stored balance';
  END IF;
END $$;

TRUNCATE test_outbox;
INSERT INTO stok_balance VALUES
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',10);
UPDATE stok_balance SET saldo=2.50000000000000000000 WHERE bahan_baku_id='20000000-0000-0000-0000-000000000002';
DO $$ BEGIN
  IF (SELECT count(*) FROM test_outbox) <> 1 OR NOT EXISTS (
    SELECT 1 FROM test_outbox
    WHERE staff_id='30000000-0000-0000-0000-000000000002' AND body LIKE '%tersisa 2,5.%'
  ) THEN RAISE EXCEPTION 'FAIL: critical-stock text or recipient scope'; END IF;
END $$;
SELECT 'PASS: number formatting, real trigger messages, recipient scope, unchanged stock values' AS result;
ROLLBACK;
