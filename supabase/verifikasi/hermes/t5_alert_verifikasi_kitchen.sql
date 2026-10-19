-- Run ONLY in a disposable PostgreSQL database named ss_kitchen_alert_test:
-- psql -v ON_ERROR_STOP=1 -d ss_kitchen_alert_test -f this-file.sql
-- The sender is a local outbox stub. No Telegram, stock ledger, or real staff.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ss_kitchen_alert_test' THEN
    RAISE EXCEPTION 'Use a disposable database named ss_kitchen_alert_test';
  END IF;
END $$;

CREATE SCHEMA auth;
CREATE SCHEMA cron;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', TRUE), '')::uuid;
$$;
CREATE TABLE cron.job (jobid BIGSERIAL PRIMARY KEY, jobname TEXT UNIQUE, schedule TEXT, command TEXT);
CREATE FUNCTION cron.unschedule(TEXT) RETURNS BOOLEAN LANGUAGE sql AS $$
  DELETE FROM cron.job WHERE jobname = $1 RETURNING TRUE;
$$;
CREATE FUNCTION cron.schedule(TEXT, TEXT, TEXT) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO cron.job(jobname, schedule, command) VALUES ($1, $2, $3) RETURNING jobid;
$$;
CREATE TABLE public.outlets (id UUID PRIMARY KEY, name TEXT, type TEXT, is_active BOOLEAN DEFAULT TRUE);
CREATE TABLE public.outlet_staff (id UUID PRIMARY KEY, name TEXT, role TEXT, status TEXT, outlet_id UUID);
CREATE TABLE public.staff_outlets (staff_id UUID, outlet_id UUID);
CREATE TABLE public.bot_telegram_access (staff_id UUID PRIMARY KEY);
CREATE TABLE public.bot_telegram_links (staff_id UUID PRIMARY KEY, chat_id TEXT);
CREATE TABLE public.surat_jalan (
  id UUID PRIMARY KEY, outlet_id UUID, status TEXT, document_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  receipt_signatures JSONB DEFAULT '[]', auto_verified_at TIMESTAMPTZ,
  ditutup_administratif_at TIMESTAMPTZ
);
CREATE TABLE public.surat_jalan_item (
  surat_jalan_id UUID, qty_dikirim NUMERIC, qty_terima NUMERIC,
  kondisi TEXT DEFAULT 'baik', flagged BOOLEAN DEFAULT FALSE, verified_at TIMESTAMPTZ
);
CREATE TABLE public.test_outbox (staff_id UUID, title TEXT, body TEXT, url TEXT);
CREATE FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO public.test_outbox(staff_id, title, body, url) VALUES ($1, $3, $4, $5);
$$;

\ir ../../migrations/20300254002700_kitchen_telegram_receipt_alerts.sql

CREATE FUNCTION public.test_assert(p_ok BOOLEAN, p_message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', p_message; END IF;
END;
$$;

INSERT INTO outlets VALUES
  ('10000000-0000-0000-0000-000000000001', 'Beji', 'outlet', TRUE),
  ('10000000-0000-0000-0000-000000000002', 'Fixture', 'test', TRUE),
  ('10000000-0000-0000-0000-000000000003', 'Marketplace', 'marketplace', TRUE),
  ('10000000-0000-0000-0000-000000000004', 'Inactive', 'outlet', FALSE);
INSERT INTO outlet_staff VALUES
  ('20000000-0000-0000-0000-000000000001', 'Kitchen aktif', 'kitchen', 'active', NULL),
  ('20000000-0000-0000-0000-000000000002', 'Kitchen tanpa izin', 'kitchen', 'active', NULL),
  ('20000000-0000-0000-0000-000000000003', 'Kitchen nonaktif', 'kitchen', 'inactive', NULL),
  ('20000000-0000-0000-0000-000000000004', 'Owner', 'owner', 'active', NULL),
  ('20000000-0000-0000-0000-000000000005', 'Andi Crew', 'crew', 'active', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000006', 'Kitchen belum taut', 'kitchen', 'active', NULL);
INSERT INTO bot_telegram_access SELECT id FROM outlet_staff WHERE name <> 'Kitchen tanpa izin';
INSERT INTO bot_telegram_links SELECT id, 'test-chat' FROM outlet_staff WHERE name <> 'Kitchen belum taut';

-- Only new dispatches create reminder state; edits cannot reset their clock.
INSERT INTO surat_jalan(id,outlet_id,status,document_number) VALUES
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','draft','SJ-001');
SELECT test_assert((SELECT count(*)=0 FROM bot_telegram_sj_kitchen_alert_state),'draft has no dispatch state');
UPDATE surat_jalan SET status='dikirim' WHERE document_number='SJ-001';
UPDATE bot_telegram_sj_kitchen_alert_state SET dispatched_at=NOW()-INTERVAL '3 hours';
UPDATE surat_jalan SET updated_at=NOW()+INTERVAL '1 hour', receipt_signatures='[]' WHERE document_number='SJ-001';
SELECT test_assert((SELECT dispatched_at=NOW()-INTERVAL '3 hours' FROM bot_telegram_sj_kitchen_alert_state),'signature edits preserve dispatch time');

-- Exactly one summary, to linked active kitchen only, with actor and SJ detail.
INSERT INTO surat_jalan_item VALUES
  ('30000000-0000-0000-0000-000000000001',10,10,'baik',FALSE,NOW()),
  ('30000000-0000-0000-0000-000000000001',20,20,'baik',FALSE,NOW());
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',TRUE);
UPDATE surat_jalan SET status='diterima_lengkap' WHERE document_number='SJ-001';
SELECT test_assert((SELECT count(*)=1 FROM test_outbox),'one completion summary');
SELECT test_assert((SELECT bool_and(staff_id='20000000-0000-0000-0000-000000000001') FROM test_outbox),'only eligible kitchen receives');
SELECT test_assert((SELECT body LIKE '%Andi Crew%' AND body LIKE '%SJ-001%' AND body LIKE '%2 baris%' AND url LIKE '%/surat-jalan/%' FROM test_outbox),'completion has actor, SJ, count, detail URL');
UPDATE surat_jalan SET status='selesai' WHERE document_number='SJ-001';
UPDATE surat_jalan SET status='dikirim' WHERE document_number='SJ-001';
UPDATE surat_jalan SET status='diterima_lengkap' WHERE document_number='SJ-001';
SELECT test_assert((SELECT count(*)=1 FROM test_outbox),'repeated status cycle never repeats summary');
TRUNCATE test_outbox;

-- Automatic closure, discrepancy and unfinished forms must not claim crew success.
INSERT INTO surat_jalan(id,outlet_id,status,document_number) VALUES
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','dikirim','AUTO'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','dikirim','SELISIH'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','dikirim','BELUM'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','dikirim','TEST'),
  ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','dikirim','MARKET'),
  ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000004','dikirim','INACTIVE');
INSERT INTO surat_jalan_item VALUES
  ('30000000-0000-0000-0000-000000000002',10,10,'baik',FALSE,NOW()),
  ('30000000-0000-0000-0000-000000000003',10,9,'baik',TRUE,NOW()),
  ('30000000-0000-0000-0000-000000000004',10,NULL,'baik',FALSE,NULL);
UPDATE surat_jalan SET status='diterima_lengkap',auto_verified_at=NOW() WHERE document_number='AUTO';
UPDATE surat_jalan SET status='diterima_sebagian' WHERE document_number='SELISIH';
UPDATE surat_jalan SET status='diterima_lengkap' WHERE document_number IN ('BELUM','TEST','MARKET','INACTIVE');
SELECT test_assert((SELECT count(*)=0 FROM test_outbox),'no false completion summary');
SELECT test_assert((SELECT count(*)=0 FROM bot_telegram_sj_kitchen_alert_state WHERE surat_jalan_id IN ('30000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000007')),'excluded outlets never tracked');

-- Older dispatch lacking new tracking state is not retroactively reminded.
INSERT INTO surat_jalan(id,outlet_id,status,document_number,created_at) VALUES
  ('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','dikirim','OLD',NOW()-INTERVAL '30 days');
DELETE FROM bot_telegram_sj_kitchen_alert_state WHERE surat_jalan_id='30000000-0000-0000-0000-000000000008';

-- Deterministic reminder clock = 10:00 WIB. Boundary 2h, repeats 4h, stops on receipt.
INSERT INTO surat_jalan(id,outlet_id,status,document_number) VALUES
  ('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','dikirim_lengkap','REMIND');
DO $$
DECLARE v_now TIMESTAMPTZ := date_trunc('day',NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta' + INTERVAL '10 hours';
        v_id UUID := '30000000-0000-0000-0000-000000000009';
BEGIN
  UPDATE bot_telegram_sj_kitchen_alert_state SET dispatched_at=v_now-INTERVAL '119 minutes' WHERE surat_jalan_id=v_id;
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now)=0,'before 2h no reminder');
  UPDATE bot_telegram_sj_kitchen_alert_state SET dispatched_at=v_now-INTERVAL '2 hours' WHERE surat_jalan_id=v_id;
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now)=1,'at 2h one reminder');
  PERFORM test_assert((SELECT count(*)=1 FROM test_outbox),'exactly one reminder recipient');
  PERFORM test_assert((SELECT body LIKE '%Andi Crew%' AND body LIKE '%REMIND%' FROM test_outbox),'reminder contains outlet PIC and SJ');
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now+INTERVAL '239 minutes')=0,'no reminder before 4h repeat');
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now+INTERVAL '4 hours')=1,'repeat allowed after 4h');
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now+INTERVAL '11 hours')=0,'21:00 WIB is quiet time');
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now-INTERVAL '3 hours')=0,'07:00 WIB is quiet time');
  UPDATE surat_jalan SET status='diterima_sebagian' WHERE id=v_id;
  PERFORM test_assert(bot_telegram_pengingat_verifikasi_kitchen(v_now+INTERVAL '8 hours')=0,'receipt immediately stops reminders');
END $$;

-- Receipt signatures cover the browser flow that does not populate verified_by.
TRUNCATE test_outbox;
SELECT set_config('request.jwt.claim.sub','',TRUE);
INSERT INTO surat_jalan(id,outlet_id,status,document_number,receipt_signatures) VALUES
  ('30000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','dikirim','SIGNED','[{"role":"Crew Penerima","signed_by":"Budi"}]');
INSERT INTO surat_jalan_item VALUES ('30000000-0000-0000-0000-000000000010',1,1,'baik',FALSE,NOW());
UPDATE surat_jalan SET status='diterima_lengkap' WHERE document_number='SIGNED';
SELECT test_assert((SELECT count(*)=1 AND bool_and(body LIKE '%Budi%') FROM test_outbox),'signature fallback identifies receiving crew');
SELECT test_assert(NOT has_function_privilege('anon','public.bot_telegram_pengingat_verifikasi_kitchen(timestamptz)','EXECUTE'),'anon cannot run reminder');
SELECT test_assert(NOT has_function_privilege('authenticated','public.bot_telegram_pengingat_verifikasi_kitchen(timestamptz)','EXECUTE'),'staff cannot run reminder');
SELECT test_assert(NOT has_table_privilege('authenticated','public.bot_telegram_sj_kitchen_alert_state','SELECT'),'staff cannot inspect tracking');
SELECT 'PASS: kitchen completion, role/access gates, deduplication, automatic-close exclusion, dispatch clock, reminders and quiet hours' AS result;
ROLLBACK;
