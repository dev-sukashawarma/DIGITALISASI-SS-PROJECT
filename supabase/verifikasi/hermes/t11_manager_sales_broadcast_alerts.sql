-- Disposable local PostgreSQL only.
\set ON_ERROR_STOP on
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS net;

CREATE TABLE IF NOT EXISTS cron.job(name text, schedule text, command text);
CREATE OR REPLACE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job VALUES ($1,$2,$3) RETURNING 1::bigint;
$$;

CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(name text, decrypted_secret text);
CREATE TABLE IF NOT EXISTS net._http_response(id bigint, status_code integer, content text);
CREATE TABLE IF NOT EXISTS net.test_requests(id bigint GENERATED ALWAYS AS IDENTITY, body jsonb);
CREATE OR REPLACE FUNCTION net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer)
RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.test_requests(body) VALUES ($3) RETURNING id; $$;

CREATE TABLE IF NOT EXISTS outlets(id uuid PRIMARY KEY, name text, type text, is_active boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS outlet_staff(id uuid PRIMARY KEY, name text, role text, status text, account_category text);
CREATE TABLE IF NOT EXISTS staff_outlets(staff_id uuid, outlet_id uuid);
CREATE TABLE IF NOT EXISTS bot_telegram_links(staff_id uuid, chat_id text);

CREATE TABLE IF NOT EXISTS orders(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid,
  total_amount numeric,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  quantity numeric
);

CREATE TABLE IF NOT EXISTS daily_sales_targets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid,
  target_amount numeric,
  effective_from date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

\ir ../../migrations/20300254003200_manager_telegram_alerts.sql
\ir ../../migrations/20300254003500_manager_sales_broadcast_alerts.sql

CREATE OR REPLACE FUNCTION test_assert(boolean, text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF $1 IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', $2; END IF; END;
$$;

-- Setup Mock Data
INSERT INTO outlets VALUES 
  ('10000000-0000-0000-0000-000000000001', 'Pajajaran', 'outlet', true),
  ('10000000-0000-0000-0000-000000000002', 'Dramaga', 'outlet', true);

INSERT INTO outlet_staff(id, name, role, status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AM Bogor', 'area_manager', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'RM Regional', 'regional_manager', 'active');

INSERT INTO staff_outlets VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');

INSERT INTO bot_telegram_links SELECT id, 'chat-' || id FROM outlet_staff;

-- Targets
INSERT INTO daily_sales_targets(outlet_id, target_amount) VALUES
  ('10000000-0000-0000-0000-000000000001', 5000000),
  ('10000000-0000-0000-0000-000000000002', 4000000);

-- Orders
INSERT INTO orders (id, outlet_id, total_amount, status) VALUES
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2500000, 'completed'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1800000, 'paid');

INSERT INTO order_items (order_id, quantity) VALUES
  ('70000000-0000-0000-0000-000000000001', 50),
  ('70000000-0000-0000-0000-000000000002', 40);

-- ── TEST 1: Broadcast Siang (15:00 WIB)
SELECT bot_manager_broadcast_omzet('siang');

SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'omzet_am:siang:%'), 'AM menerima laporan omzet siang');
SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'omzet_rm:siang:%'), 'RM menerima executive summary regional siang');
SELECT test_assert((SELECT body LIKE '%4,300,000%' AND body LIKE '%90 pcs%' FROM bot_manager_alert_outbox WHERE event_key LIKE 'omzet_am:siang:%'), 'Rincian omzet dan pcs akurat');

-- ── TEST 2: Idempotensi (Panggilan kedua tidak duplikat)
SELECT bot_manager_broadcast_omzet('siang');
SELECT test_assert((SELECT count(*) = 2 FROM bot_manager_alert_outbox WHERE event_key LIKE 'omzet_%:siang:%'), 'Panggilan ulang terdeduplikasi via event_key');

-- ── TEST 3: Broadcast Dinner & Closing
SELECT bot_manager_broadcast_omzet('dinner');
SELECT bot_manager_broadcast_omzet('closing');
SELECT test_assert((SELECT count(*) = 6 FROM bot_manager_alert_outbox WHERE event_key LIKE 'omzet_%'), 'Ketiga sesi broadcast (siang, dinner, closing) tercatat lengkap');

SELECT 'Semua pengujian Tahap 4 (Otomasi Laporan Omzet) lolos!' AS result;
ROLLBACK;
