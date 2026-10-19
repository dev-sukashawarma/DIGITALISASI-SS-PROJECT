-- Disposable PostgreSQL only. No network access or real recipient is needed.
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
CREATE SCHEMA cron;
CREATE SCHEMA vault;
CREATE TABLE cron.job (jobid BIGSERIAL PRIMARY KEY, jobname TEXT UNIQUE, schedule TEXT, command TEXT);
CREATE FUNCTION cron.unschedule(TEXT) RETURNS BOOLEAN LANGUAGE sql AS $$
  DELETE FROM cron.job WHERE jobname=$1 RETURNING TRUE;
$$;
CREATE FUNCTION cron.schedule(TEXT,TEXT,TEXT) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO cron.job(jobname,schedule,command) VALUES ($1,$2,$3) RETURNING jobid;
$$;
CREATE TABLE vault.decrypted_secrets (name TEXT, decrypted_secret TEXT);
INSERT INTO vault.decrypted_secrets VALUES
  ('telegram_stokist_send_url','test-local-outbox'),('telegram_stokist_send_secret','test-local-secret');
CREATE TABLE outlets (id UUID PRIMARY KEY,name TEXT,type TEXT,is_active BOOLEAN,deleted_at TIMESTAMPTZ);
CREATE TABLE outlet_staff (id UUID PRIMARY KEY,name TEXT,role TEXT,status TEXT,outlet_id UUID);
CREATE TABLE staff_outlets (staff_id UUID,outlet_id UUID);
CREATE TABLE bot_telegram_access (staff_id UUID PRIMARY KEY);
CREATE TABLE bot_telegram_links (staff_id UUID PRIMARY KEY,chat_id TEXT);
CREATE TABLE opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),outlet_id UUID,tanggal DATE,tipe TEXT,status TEXT,
  created_by UUID,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ,approved_at TIMESTAMPTZ
);
CREATE TABLE test_outbox (staff_id UUID,title TEXT,body TEXT,url TEXT);
CREATE FUNCTION bot_telegram_kirim_alert(UUID,TEXT,TEXT,TEXT,TEXT,UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_send',TRUE)='yes' THEN RAISE EXCEPTION 'test sender failed'; END IF;
  INSERT INTO test_outbox VALUES ($1,$3,$4,$5);
END;
$$;
CREATE FUNCTION test_assert(p_ok BOOLEAN,p_message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %',p_message; END IF;
END;
$$;

\ir ../../migrations/20300254003000_kitchen_daily_opname_summary.sql

INSERT INTO outlet_staff VALUES
  ('20000000-0000-0000-0000-000000000001','Kitchen','kitchen','active',NULL),
  ('20000000-0000-0000-0000-000000000002','Kitchen no access','kitchen','active',NULL),
  ('20000000-0000-0000-0000-000000000003','Kitchen inactive','kitchen','inactive',NULL),
  ('20000000-0000-0000-0000-000000000004','Kitchen no link','kitchen','active',NULL),
  ('20000000-0000-0000-0000-000000000005','Admin','admin','active',NULL),
  ('20000000-0000-0000-0000-000000000006','Andi','crew','active','10000000-0000-0000-0000-000000000001');
INSERT INTO bot_telegram_access SELECT id FROM outlet_staff WHERE name <> 'Kitchen no access';
INSERT INTO bot_telegram_links SELECT id,'test' FROM outlet_staff WHERE name <> 'Kitchen no link';
INSERT INTO outlets VALUES
  ('10000000-0000-0000-0000-000000000001','A-final','internal',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000002','B-draft','mitra',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000003','C-pending','internal',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000004','D-rejected','mitra',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000005','E-none','internal',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000006','F-weekly-only','internal',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000007','G-adhoc-only','mitra',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000008','EXCLUDED-test','test',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000009','EXCLUDED-market','marketplace',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000010','EXCLUDED-gudang','gudang',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000011','EXCLUDED-office','office',TRUE,NULL),
  ('10000000-0000-0000-0000-000000000012','EXCLUDED-inactive','internal',FALSE,NULL),
  ('10000000-0000-0000-0000-000000000013','EXCLUDED-deleted','mitra',TRUE,NOW());
INSERT INTO opname(outlet_id,tanggal,tipe,status,created_by,created_at,updated_at)
SELECT o.id,DATE '2026-10-19',
  CASE o.name WHEN 'F-weekly-only' THEN 'mingguan' WHEN 'G-adhoc-only' THEN 'ad_hoc' ELSE 'harian' END,
  CASE o.name WHEN 'B-draft' THEN 'draft' WHEN 'C-pending' THEN 'pending_approval'
    WHEN 'D-rejected' THEN 'rejected' ELSE 'finalized' END,
  '20000000-0000-0000-0000-000000000006','2026-10-19 20:00+07','2026-10-19 20:10+07'
FROM outlets o WHERE o.name <> 'E-none';
-- Later rejected/draft attempts must not erase an earlier completed daily opname.
INSERT INTO opname(outlet_id,tanggal,tipe,status,created_at,updated_at) VALUES
  ('10000000-0000-0000-0000-000000000001','2026-10-19','harian','rejected','2026-10-19 20:15+07','2026-10-19 20:20+07'),
  ('10000000-0000-0000-0000-000000000005','2026-10-18','harian','finalized','2026-10-18 20:00+07','2026-10-18 20:00+07');

SELECT test_assert((SELECT count(*)=7 FROM bot_telegram_opname_harian_kitchen_data('2026-10-19')),'only active physical outlets, once each');
SELECT test_assert((SELECT count(*)=1 FROM bot_telegram_opname_harian_kitchen_data('2026-10-19') WHERE status_opname='finalized'),'only same-date daily finalized counted');
SELECT test_assert((SELECT status_opname='belum_mulai' FROM bot_telegram_opname_harian_kitchen_data('2026-10-19') WHERE outlet_name='E-none'),'yesterday does not complete today');
SELECT test_assert(bot_telegram_opname_harian_kitchen('pengingat','2026-10-19 20:59+07')=0,'no early reminder');
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-19 22:29+07')=0,'no early recap');
-- 14:00 UTC is exactly 21:00 WIB, independent of the database session timezone.
SET LOCAL TIME ZONE 'America/Los_Angeles';
SELECT test_assert(bot_telegram_opname_harian_kitchen('pengingat','2026-10-19 14:00+00')=1,'21:00 WIB sends to one eligible kitchen');
SELECT test_assert((SELECT count(*)=1 AND bool_and(staff_id='20000000-0000-0000-0000-000000000001') FROM test_outbox),'recipient role/access/link gates');
SELECT test_assert((SELECT bool_and(body LIKE '%Selesai: 1/7%' AND body LIKE '%Belum final: 6%' AND body NOT LIKE '%A-final%') FROM test_outbox),'reminder omits completed outlet');
SELECT test_assert((SELECT string_agg(body,E'\n') LIKE '%menunggu persetujuan%' AND string_agg(body,E'\n') LIKE '%perlu perbaikan%' AND string_agg(body,E'\n') LIKE '%sudah mulai, belum final%' AND string_agg(body,E'\n') LIKE '%belum mulai%' FROM test_outbox),'unfinished states are distinct');
SELECT test_assert(bot_telegram_opname_harian_kitchen('pengingat','2026-10-19 21:10+07')=0,'reminder deduplicated');
SELECT test_assert(bot_telegram_opname_harian_kitchen('pengingat','2026-10-19 22:30+07')=0,'reminder stops at recap window');

-- Two outlets finish between the two reports; final recap must read fresh data.
TRUNCATE test_outbox;
UPDATE opname SET status='finalized',updated_at='2026-10-19 22:00+07'
WHERE tanggal='2026-10-19' AND status IN ('draft','pending_approval');
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-19 15:30+00')=1,'22:30 WIB final recap');
SELECT test_assert((SELECT bool_and(body LIKE '%Selesai: 3/7%' AND body LIKE '%Belum final: 4%' AND body LIKE '%19-10-2026%') FROM test_outbox),'final recap has fresh calendar-WIB totals');
SELECT test_assert((SELECT string_agg(body,E'\n') LIKE '%A-final%' AND string_agg(body,E'\n') LIKE '%G-adhoc-only%' AND string_agg(body,E'\n') NOT LIKE '%EXCLUDED-%' FROM test_outbox),'recap includes done and unfinished physical outlets');
SELECT test_assert((SELECT string_agg(body,E'\n') LIKE '%Andi%' AND string_agg(body,E'\n') LIKE '%22:00%' FROM test_outbox),'creator/PIC and recorded time appear');
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-19 23:00+07')=0,'recap deduplicated');

-- A fully completed day suppresses reminders, while still sending a final recap.
TRUNCATE test_outbox;
INSERT INTO opname(outlet_id,tanggal,tipe,status,created_at,updated_at)
SELECT id,'2026-10-20','harian','finalized','2026-10-20 20:00+07','2026-10-20 20:15+07'
FROM outlets WHERE type IN ('internal','mitra') AND is_active AND deleted_at IS NULL;
SELECT test_assert(bot_telegram_opname_harian_kitchen('pengingat','2026-10-20 21:00+07')=0,'all done does not produce actionable reminder');
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-20 22:30+07')=1,'all done still gets recap');
SELECT test_assert((SELECT bool_and(body LIKE '%Selesai: 7/7%' AND body LIKE '%Belum final: 0%') FROM test_outbox),'complete-day counts');

-- Many long outlet names require pagination, not truncation by the HTTP sender.
TRUNCATE test_outbox;
INSERT INTO outlets
SELECT gen_random_uuid(),'LARGE-' || lpad(n::text,3,'0') || repeat(' panjang',5),'internal',TRUE,NULL
FROM generate_series(1,60) n;
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-21 22:30+07')=1,'one batch even for many pages');
SELECT test_assert((SELECT count(*)>1 AND max(length(body))<1150 FROM test_outbox),'every page fits HTTP payload limit');
SELECT test_assert((SELECT count(*)=60 FROM regexp_matches((SELECT string_agg(body,E'\n') FROM test_outbox),'LARGE-[0-9]{3}','g')),'every large-fixture outlet appears exactly once');
SELECT test_assert((SELECT jumlah_halaman=(SELECT count(*) FROM test_outbox) AND jumlah_outlet=67 FROM bot_telegram_opname_kitchen_send_log WHERE tanggal='2026-10-21'),'audit records full batch totals');
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-21 23:00+07')=0,'pagination cannot create a duplicate batch');

-- Missing configuration and exceptions must not consume the day's sending key.
TRUNCATE test_outbox;
DELETE FROM vault.decrypted_secrets WHERE name='telegram_stokist_send_secret';
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-22 22:30+07')=0,'missing secret skips');
SELECT test_assert((SELECT count(*)=0 FROM bot_telegram_opname_kitchen_send_log WHERE tanggal='2026-10-22'),'missing secret does not claim key');
INSERT INTO vault.decrypted_secrets VALUES ('telegram_stokist_send_secret','test-local-secret');
SET LOCAL test.fail_send='yes';
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-22 22:30+07')=0,'sender exception handled');
SELECT test_assert((SELECT count(*)=0 FROM bot_telegram_opname_kitchen_send_log WHERE tanggal='2026-10-22'),'failed batch rolls back claim');
SET LOCAL test.fail_send='no';
SELECT test_assert(bot_telegram_opname_harian_kitchen('ringkasan','2026-10-22 22:35+07')=1,'failed batch may retry');
SELECT test_assert(NOT has_function_privilege('authenticated','public.bot_telegram_opname_harian_kitchen(text,timestamptz)','EXECUTE'),'staff cannot dispatch reports');
SELECT test_assert(NOT has_function_privilege('anon','public.bot_telegram_opname_harian_kitchen_data(date)','EXECUTE'),'anon cannot inspect cross-outlet report');
SELECT test_assert(NOT has_table_privilege('authenticated','public.bot_telegram_opname_kitchen_send_log','SELECT'),'private send audit');
SELECT test_assert((SELECT schedule='0 14 * * *' FROM cron.job WHERE jobname='bot-telegram-kitchen-opname-pengingat'),'21:00 WIB cron');
SELECT test_assert((SELECT schedule='30 15 * * *' FROM cron.job WHERE jobname='bot-telegram-kitchen-opname-ringkasan'),'22:30 WIB cron');
SELECT 'PASS: daily kitchen opname scope, status, date, schedule, fresh snapshot, deduplication, pagination and failure rollback' AS result;
ROLLBACK;
