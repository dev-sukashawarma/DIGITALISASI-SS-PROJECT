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
CREATE TABLE IF NOT EXISTS bahan_baku(id uuid PRIMARY KEY, nama text, satuan text);
CREATE TABLE IF NOT EXISTS bahan_baku_harga(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bahan_baku_id uuid, harga_beli numeric, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS stok_waste_reports(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid,
  bahan_baku_id uuid,
  qty numeric,
  reason text,
  status text DEFAULT 'PENDING',
  reported_by uuid,
  created_at timestamptz DEFAULT now()
);

\ir ../../migrations/20300254003200_manager_telegram_alerts.sql
\ir ../../migrations/20300254003300_manager_waste_and_checklist_alerts.sql

CREATE OR REPLACE FUNCTION test_assert(boolean, text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF $1 IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', $2; END IF; END;
$$;

-- Setup Mock Master Data
INSERT INTO outlets VALUES 
  ('10000000-0000-0000-0000-000000000001', 'Pajajaran', 'outlet', true),
  ('10000000-0000-0000-0000-000000000002', 'Dramaga', 'outlet', true);

INSERT INTO outlet_staff(id, name, role, status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AM Pajajaran', 'area_manager', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'RM Wilayah', 'regional_manager', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'Kru Pajajaran', 'kitchen', 'active');

INSERT INTO staff_outlets VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

INSERT INTO bot_telegram_links SELECT id, 'chat-' || id FROM outlet_staff;

INSERT INTO bahan_baku VALUES 
  ('40000000-0000-0000-0000-000000000001', 'Daging Ayam Marinated', 'kg');

INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES 
  ('40000000-0000-0000-0000-000000000001', 30000);

-- ── TEST 1: Alert Waste Standar (<= Rp 150.000)
-- 2 kg * Rp 30.000 = Rp 60.000 -> Hanya ke AM Pajajaran
INSERT INTO stok_waste_reports (id, outlet_id, bahan_baku_id, qty, reason, reported_by, status)
VALUES ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 'Spill tumpah saat restock', '20000000-0000-0000-0000-000000000003', 'PENDING');

SELECT test_assert((SELECT count(*) = 1 AND bool_and(staff_id = '20000000-0000-0000-0000-000000000001') FROM bot_manager_alert_outbox WHERE event_key LIKE 'waste:%'), 'Waste 60rb hanya dikirim ke AM');
SELECT test_assert((SELECT body LIKE '%Pajajaran%' AND body LIKE '%Daging Ayam%' AND body LIKE '%60,000%' FROM bot_manager_alert_outbox WHERE staff_id = '20000000-0000-0000-0000-000000000001'), 'Detail pesan memuat nama bahan, nominal dan alasan');

-- ── TEST 2: Alert Waste Bernilai Tinggi (> Rp 150.000)
-- 6 kg * Rp 30.000 = Rp 180.000 -> Ke AM dan Eskalasi ke RM
INSERT INTO stok_waste_reports (id, outlet_id, bahan_baku_id, qty, reason, reported_by, status)
VALUES ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 6, 'Chiller mati semalaman', '20000000-0000-0000-0000-000000000003', 'PENDING');

SELECT test_assert((SELECT count(*) = 3 FROM bot_manager_alert_outbox WHERE event_key LIKE 'waste%'), 'Waste > 150rb mengantrekan ke AM dan RM');
SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE staff_id = '20000000-0000-0000-0000-000000000002' AND event_key LIKE 'waste_rm:%'), 'RM menerima alert eskalasi waste bernilai tinggi');

-- ── TEST 3: Ceklist Sidak AM Selesai -> Antre ke Telegram RM
PERFORM public.ceklist_harian_kirim_push(
  '20000000-0000-0000-0000-000000000002'::uuid,
  '📋 Ceklist Harian Masuk · Pajajaran',
  'AM Pajajaran mengirim ceklist harian Pajajaran. Skor SOP 90.'
);

SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'ceklist:%' AND staff_id = '20000000-0000-0000-0000-000000000002'), 'Push ceklist harian otomatis mengantrekan notifikasi Telegram ke RM');

SELECT 'Semua pengujian manager waste & checklist alerts lolos!' AS result;
ROLLBACK;
