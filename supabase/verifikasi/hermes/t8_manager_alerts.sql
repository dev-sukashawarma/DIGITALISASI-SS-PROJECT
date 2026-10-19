-- Disposable local PostgreSQL only. No external traffic: net.http_post is stubbed.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ss_hrd_alert_test' AND current_database()<>'ss_manager_alert_test' AND current_database()<>'postgres' THEN
    -- Allow standard local test db names
    NULL;
  END IF;
END $$;

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
CREATE TABLE IF NOT EXISTS shifts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid,
  staff_id uuid,
  closed_by uuid,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  variance numeric,
  petty_cash_variance numeric,
  status text DEFAULT 'open',
  notes text
);
CREATE TABLE IF NOT EXISTS attendance(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid,
  outlet_staff_id uuid,
  ts_server timestamptz DEFAULT now(),
  type text,
  status text
);
CREATE TABLE IF NOT EXISTS outlet_attendance_shift(outlet_id uuid, urutan smallint, jam_masuk time, jam_keluar time);
CREATE TABLE IF NOT EXISTS outlet_attendance_config(outlet_id uuid, jam_masuk time, jam_keluar time);

\ir ../../migrations/20300254003200_manager_telegram_alerts.sql

CREATE OR REPLACE FUNCTION test_assert(boolean, text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF $1 IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', $2; END IF; END;
$$;

-- Setup Mock Data
INSERT INTO outlets VALUES 
  ('10000000-0000-0000-0000-000000000001', 'Pajajaran', 'outlet', true),
  ('10000000-0000-0000-0000-000000000002', 'Dramaga', 'outlet', true);

INSERT INTO outlet_staff(id, name, role, status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AM Pajajaran', 'area_manager', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'AM Dramaga', 'area_manager', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'RM Wilayah', 'regional_manager', 'active'),
  ('20000000-0000-0000-0000-000000000004', 'Kasir Pajajaran', 'kasir', 'active');

INSERT INTO staff_outlets VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');

INSERT INTO bot_telegram_links SELECT id, 'chat-' || id FROM outlet_staff;

-- ── TEST 1: Selisih Kas Closing
-- Kasus 1: Selisih Rp 15.000 (<= Rp 20.000 toleransi) -> Tidak ada alert
INSERT INTO shifts (id, outlet_id, staff_id, closed_by, status, variance)
VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'open', 0);

UPDATE shifts SET status = 'closed', variance = -15000 WHERE id = '30000000-0000-0000-0000-000000000001';
SELECT test_assert((SELECT count(*) = 0 FROM bot_manager_alert_outbox), 'Selisih <= 20rb tidak menghasilkan alert');

-- Kasus 2: Selisih Rp 50.000 (> Rp 20.000 dan <= Rp 100.000) -> Alert hanya ke AM Pajajaran
INSERT INTO shifts (id, outlet_id, staff_id, closed_by, status, variance)
VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'open', 0);

UPDATE shifts SET status = 'closed', variance = -50000, notes = 'salah kembalian' WHERE id = '30000000-0000-0000-0000-000000000002';
SELECT test_assert((SELECT count(*) = 1 AND bool_and(staff_id = '20000000-0000-0000-0000-000000000001') FROM bot_manager_alert_outbox), 'Selisih 50rb hanya dikirim ke AM Pajajaran');
SELECT test_assert((SELECT body LIKE '%Pajajaran%' AND body LIKE '%50,000%' AND body LIKE '%salah kembalian%' FROM bot_manager_alert_outbox WHERE staff_id = '20000000-0000-0000-0000-000000000001'), 'Isi pesan memuat detail outlet, nominal, dan catatan');

-- Kasus 3: Selisih Rp 120.000 (> Rp 100.000) -> Alert ke AM Pajajaran dan eskalasi ke RM
INSERT INTO shifts (id, outlet_id, staff_id, closed_by, status, variance)
VALUES ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'open', 0);

UPDATE shifts SET status = 'closed', variance = -120000 WHERE id = '30000000-0000-0000-0000-000000000003';
SELECT test_assert((SELECT count(*) = 3 FROM bot_manager_alert_outbox), 'Selisih > 100rb menambahkan alert ke AM dan RM');
SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE staff_id = '20000000-0000-0000-0000-000000000003'), 'RM menerima notifikasi eskalasi');

-- ── TEST 2: Antrean dan Dispatch Pengiriman
SELECT bot_manager_kirim_antrean();
SELECT test_assert((SELECT count(*) = 0 FROM net.test_requests), 'Belum ada secret -> antrean tetap pending tanpa HTTP request');

INSERT INTO vault.decrypted_secrets VALUES 
  ('telegram_stokist_send_url', 'https://agents.sukashawarma.com/api/telegram/send'),
  ('telegram_stokist_send_secret', 'test-sec');

SELECT bot_manager_kirim_antrean();
SELECT test_assert((SELECT count(*) = 3 FROM net.test_requests), 'Semua 3 alert terkirim via HTTP post');

INSERT INTO net._http_response SELECT id, 200, '{"delivered":true}' FROM net.test_requests;
SELECT bot_manager_kirim_antrean();
SELECT test_assert((SELECT count(*) = 3 AND bool_and(outcome = 'delivered') FROM bot_manager_alert_outbox), 'Status outbox berubah jadi delivered');

SELECT 'Semua pengujian manager telegram alerts lolos!' AS result;
ROLLBACK;
