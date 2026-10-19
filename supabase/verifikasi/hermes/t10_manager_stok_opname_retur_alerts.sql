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
CREATE TABLE IF NOT EXISTS bahan_baku(id uuid PRIMARY KEY, nama text, satuan text, default_reorder_point numeric DEFAULT 10, is_active boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS outlet_reorder_point(outlet_id uuid, bahan_baku_id uuid, reorder_point numeric);
CREATE TABLE IF NOT EXISTS stok_balance(outlet_id uuid, bahan_baku_id uuid, saldo numeric, updated_at timestamptz DEFAULT now(), PRIMARY KEY(outlet_id, bahan_baku_id));

CREATE TABLE IF NOT EXISTS retur_stok(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_retur varchar(64) NOT NULL,
  outlet_id uuid NOT NULL,
  tipe_retur varchar(32) DEFAULT 'chiller_outlet',
  status varchar(32) DEFAULT 'diajukan',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retur_stok_item(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retur_stok_id uuid NOT NULL,
  bahan_baku_id uuid NOT NULL,
  qty_klaim numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS opname(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL,
  tanggal date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  tipe text NOT NULL DEFAULT 'harian',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

\ir ../../migrations/20300254003200_manager_telegram_alerts.sql
\ir ../../migrations/20300254003400_manager_stok_opname_and_retur_alerts.sql

CREATE OR REPLACE FUNCTION test_assert(boolean, text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF $1 IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', $2; END IF; END;
$$;

-- Setup Mock Data
INSERT INTO outlets VALUES 
  ('10000000-0000-0000-0000-000000000001', 'Pajajaran', 'outlet', true),
  ('10000000-0000-0000-0000-000000000002', 'Dramaga', 'outlet', true),
  ('10000000-0000-0000-0000-000000000003', 'Sentul', 'outlet', true);

INSERT INTO outlet_staff(id, name, role, status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AM Bogor', 'area_manager', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'RM Regional', 'regional_manager', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'Kru Pajajaran', 'kitchen', 'active');

INSERT INTO staff_outlets VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');

INSERT INTO bot_telegram_links SELECT id, 'chat-' || id FROM outlet_staff;

INSERT INTO bahan_baku VALUES 
  ('40000000-0000-0000-0000-000000000001', 'Roti Pita Shawarma', 'pcs', 50, true);

-- ── TEST 1: Alert Retur Bahan Baku
INSERT INTO retur_stok (id, nomor_retur, outlet_id, tipe_retur, status, created_by)
VALUES ('60000000-0000-0000-0000-000000000001', 'RT-20261019-01', '10000000-0000-0000-0000-000000000001', 'chiller_outlet', 'diajukan', '20000000-0000-0000-0000-000000000003');

INSERT INTO retur_stok_item (retur_stok_id, bahan_baku_id, qty_klaim)
VALUES ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 30);

SELECT test_assert((SELECT count(*) = 2 FROM bot_manager_alert_outbox WHERE event_key LIKE 'retur%'), 'Pengajuan retur mengantrekan alert ke AM dan RM');

-- ── TEST 2: Alert Stok Kritis
INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo)
VALUES ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 20);

SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'stok_kritis:%'), 'Stok di bawah batas reorder point (20 < 50) mengirim alert ke AM');

-- ── TEST 3: Monitoring Stok Opname (21:30 WIB Pre-Closing)
-- Pajajaran: sudah final
-- Dramaga: masih draft
-- Sentul: belum buat sama sekali
INSERT INTO opname (outlet_id, tanggal, tipe, status) VALUES
  ('10000000-0000-0000-0000-000000000001', (now() AT TIME ZONE 'Asia/Jakarta')::date, 'harian', 'finalized'),
  ('10000000-0000-0000-0000-000000000002', (now() AT TIME ZONE 'Asia/Jakarta')::date, 'harian', 'draft');

SELECT bot_manager_cek_status_opname_harian(false);
SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'opname_mon:%:digest'), 'Digest monitoring 21:30 terkirim ke AM');
SELECT test_assert((SELECT body LIKE '%SUDAH OPNAME (1):%Pajajaran%' AND body LIKE '%MASIH DRAFT (1):%Dramaga%' AND body LIKE '%BELUM OPNAME (1):%Sentul%' FROM bot_manager_alert_outbox WHERE event_key LIKE 'opname_mon:%:digest'), 'Detail progress opname merinci cabang sudah, draft, dan belum');

-- ── TEST 4: Cutoff Alert (22:30 WIB)
SELECT bot_manager_cek_status_opname_harian(true);
SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'opname_mon:%:cutoff'), 'Alert cutoff 22:30 terkirim ke AM jika ada cabang belum selesai');
SELECT test_assert((SELECT count(*) = 1 FROM bot_manager_alert_outbox WHERE event_key LIKE 'opname_rm_cutoff:%'), 'Eskalasi cutoff terkirim ke RM karena ada cabang belum opname');

SELECT 'Semua pengujian Tahap 3 (SO, Stok Kritis, Retur) lolos!' AS result;
ROLLBACK;
