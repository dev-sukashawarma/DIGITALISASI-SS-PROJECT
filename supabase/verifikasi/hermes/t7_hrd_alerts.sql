-- Disposable local PostgreSQL only. No external traffic: net.http_post is stubbed.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ss_hrd_alert_test' THEN RAISE EXCEPTION 'Use ss_hrd_alert_test'; END IF;
END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA cron;
CREATE SCHEMA vault;
CREATE SCHEMA net;
CREATE TABLE cron.job(name text, schedule text, command text);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job VALUES ($1,$2,$3) RETURNING 1::bigint;
$$;
CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
CREATE TABLE net._http_response(id bigint, status_code integer, content text);
CREATE TABLE net.test_requests(id bigint GENERATED ALWAYS AS IDENTITY, body jsonb);
CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.test_requests(body) VALUES ($3) RETURNING id; $$;
CREATE TABLE outlets(id uuid PRIMARY KEY,name text,type text,is_active boolean DEFAULT true);
CREATE TABLE outlet_staff(id uuid PRIMARY KEY,name text,role text,status text,account_category text,
  contract_type text,resign_date date);
CREATE TABLE hermes_bot_user_access(staff_id uuid,bot_slug text);
CREATE TABLE bot_telegram_links(staff_id uuid,chat_id text);
CREATE TABLE attendance_harian(staff_id uuid,outlet_id uuid,tgl date,sumber text,clock_in timestamptz,
  clock_out timestamptz,telat_menit integer,status text,PRIMARY KEY(staff_id,outlet_id,tgl));
CREATE TABLE leave_requests(staff_id uuid,status text,created_at timestamptz);
CREATE FUNCTION hr_hitung_status_nonabsen(date,uuid DEFAULT NULL) RETURNS integer LANGUAGE sql AS $$ SELECT 0; $$;
\ir ../../migrations/20300254002900_hrd_telegram_alerts.sql
CREATE FUNCTION test_assert(boolean,text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF $1 IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',$2; END IF; END;
$$;
INSERT INTO outlets VALUES ('10000000-0000-0000-0000-000000000001','Beji','outlet',true);
INSERT INTO outlet_staff(id,name,role,status,account_category) VALUES
 ('20000000-0000-0000-0000-000000000001','HR aktif','admin_hr','active','employee'),
 ('20000000-0000-0000-0000-000000000002','HR tanpa akses','admin_hr','active','employee'),
 ('20000000-0000-0000-0000-000000000003','HR nonaktif','admin_hr','inactive','employee'),
 ('20000000-0000-0000-0000-000000000004','Owner','owner','active','employee'),
 ('20000000-0000-0000-0000-000000000005','Crew','crew','active','employee');
INSERT INTO hermes_bot_user_access SELECT id,'hrd' FROM outlet_staff WHERE name<>'HR tanpa akses';
INSERT INTO bot_telegram_links SELECT id,'123' FROM outlet_staff;
INSERT INTO attendance_harian VALUES (
 '20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',
 (now() AT TIME ZONE 'Asia/Jakarta')::date,'absen',now(),NULL,15,'terlambat');
SELECT test_assert((SELECT count(*)=0 FROM bot_hrd_alert_outbox),'15 minutes does not alert');
UPDATE attendance_harian SET telat_menit=16;
SELECT test_assert((SELECT count(*)=1 AND bool_and(staff_id='20000000-0000-0000-0000-000000000001') FROM bot_hrd_alert_outbox),'16 minutes alerts only linked active authorized HR');
SELECT test_assert((SELECT body LIKE '%Crew%' AND body LIKE '%Beji%' AND body LIKE '%16 menit%' FROM bot_hrd_alert_outbox),'actionable lateness details');
UPDATE attendance_harian SET clock_out=now();
UPDATE attendance_harian SET telat_menit=23;
SELECT test_assert((SELECT count(*)=1 FROM bot_hrd_alert_outbox),'updates never duplicate the alert');
INSERT INTO attendance_harian SELECT staff_id,outlet_id,tgl-1,sumber,clock_in-interval '1 day',NULL,45,status FROM attendance_harian;
SELECT test_assert((SELECT count(*)=1 FROM bot_hrd_alert_outbox),'historical changes do not alert');
INSERT INTO leave_requests VALUES ('20000000-0000-0000-0000-000000000005','pending',now()-interval '2 days'),
 ('20000000-0000-0000-0000-000000000005','approved',now()-interval '2 days'),
 ('20000000-0000-0000-0000-000000000005','pending',now());
UPDATE outlet_staff SET contract_type='contract',resign_date=(now() AT TIME ZONE 'Asia/Jakarta')::date+30 WHERE name='Crew';
SELECT bot_hrd_rekap_harian();
SELECT bot_hrd_rekap_harian();
SELECT test_assert((SELECT count(*)=1 FROM bot_hrd_alert_outbox WHERE event_key LIKE 'rekap:%' AND body LIKE '%Tidak lengkap: 1%'),'daily recap is deduplicated');
SELECT test_assert((SELECT body LIKE '%tertunda >24 jam: 1%' AND body LIKE '%dalam 60 hari: 1%' FROM bot_hrd_alert_outbox WHERE event_key LIKE 'rekap:%'),'recap only counts overdue pending leave and expiring contracts');
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT count(*)=0 FROM net.test_requests),'missing vault retains queued alerts');
INSERT INTO vault.decrypted_secrets VALUES ('telegram_hrd_send_url','https://local.test'),('telegram_hrd_send_secret','test');
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT count(*)=2 FROM net.test_requests),'queue sends both alerts');
INSERT INTO net._http_response SELECT id,200,'{"delivered":true}' FROM net.test_requests;
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT count(*)=2 FROM bot_hrd_alert_outbox WHERE outcome='delivered'),'successful responses tracked');
SELECT bot_hrd_antrekan('retry','test','test');
SELECT bot_hrd_kirim_antrean();
INSERT INTO net._http_response SELECT max(id),502,'<html>error</html>' FROM net.test_requests;
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT attempts=1 AND outcome='pending' FROM bot_hrd_alert_outbox WHERE event_key='retry'),'failed response does not retry immediately');
UPDATE bot_hrd_alert_outbox SET attempted_at=now()-interval '16 minutes' WHERE event_key='retry';
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT attempts=2 FROM bot_hrd_alert_outbox WHERE event_key='retry'),'retry after 15 minutes');
INSERT INTO net._http_response SELECT max(id),200,'<html>bad response</html>' FROM net.test_requests;
SELECT bot_hrd_kirim_antrean();
UPDATE bot_hrd_alert_outbox SET attempted_at=now()-interval '16 minutes' WHERE event_key='retry';
SELECT bot_hrd_kirim_antrean();
INSERT INTO net._http_response SELECT max(id),503,'{}' FROM net.test_requests;
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT attempts=3 AND outcome='failed' FROM bot_hrd_alert_outbox WHERE event_key='retry'),'stops after three attempts, malformed responses handled');
SELECT bot_hrd_antrekan('revoke','test','test');
DELETE FROM hermes_bot_user_access WHERE staff_id='20000000-0000-0000-0000-000000000001';
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT outcome='skipped' FROM bot_hrd_alert_outbox WHERE event_key='revoke'),'revoked access cancels queued send');
INSERT INTO hermes_bot_user_access VALUES ('20000000-0000-0000-0000-000000000001','hrd');
TRUNCATE bot_hrd_alert_outbox;
UPDATE attendance_harian SET telat_menit=23 WHERE tgl=(now() AT TIME ZONE 'Asia/Jakarta')::date;
UPDATE attendance_harian SET telat_menit=0 WHERE tgl=(now() AT TIME ZONE 'Asia/Jakarta')::date;
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT count(*)=1 AND bool_and(outcome='skipped') FROM bot_hrd_alert_outbox),'resolved lateness cancels pending alert');
SELECT test_assert(NOT has_function_privilege('authenticated','public.bot_hrd_kirim_antrean()','EXECUTE'),'authenticated cannot send');
SELECT test_assert(NOT has_table_privilege('authenticated','public.bot_hrd_alert_outbox','SELECT'),'HR contents private');
-- Apply the incremental rollout after exercising the original migration.
\ir ../../migrations/20300254003100_hrd_developer_alert_recipients.sql
TRUNCATE bot_hrd_alert_outbox;
INSERT INTO outlet_staff(id,name,role,status,account_category) VALUES
 ('20000000-0000-0000-0000-000000000006','Developer aktif','developer','active','employee'),
 ('20000000-0000-0000-0000-000000000007','Developer nonaktif','developer','inactive','employee'),
 ('20000000-0000-0000-0000-000000000008','Developer izin bot lain','developer','active','employee'),
 ('20000000-0000-0000-0000-000000000009','Developer belum tertaut','developer','active','employee');
INSERT INTO hermes_bot_user_access VALUES
 ('20000000-0000-0000-0000-000000000006','hrd'),
 ('20000000-0000-0000-0000-000000000007','hrd'),
 ('20000000-0000-0000-0000-000000000008','ceo'),
 ('20000000-0000-0000-0000-000000000009','hrd');
INSERT INTO bot_telegram_links SELECT id,'123' FROM outlet_staff WHERE name IN
 ('Developer aktif','Developer nonaktif','Developer izin bot lain');
SELECT bot_hrd_antrekan('developer-test','test','test');
SELECT bot_hrd_antrekan('developer-test','test','test');
SELECT test_assert((SELECT count(*)=2 AND bool_and(staff_id IN (
 '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006'))
 FROM bot_hrd_alert_outbox),'only eligible HR and developer; dedup still holds');
SELECT bot_hrd_kirim_antrean();
INSERT INTO net._http_response SELECT request_id,200,'{"delivered":true}' FROM bot_hrd_alert_outbox;
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT count(*)=2 AND bool_and(outcome='delivered') FROM bot_hrd_alert_outbox),'HR and developer both delivered');
SELECT bot_hrd_antrekan('developer-revoke','test','test');
DELETE FROM hermes_bot_user_access WHERE staff_id='20000000-0000-0000-0000-000000000006';
SELECT bot_hrd_kirim_antrean();
SELECT test_assert((SELECT outcome='skipped' FROM bot_hrd_alert_outbox WHERE event_key='developer-revoke'
 AND staff_id='20000000-0000-0000-0000-000000000006'),'developer access revocation cancels delivery');
SELECT test_assert(NOT has_function_privilege('authenticated','public.bot_hrd_kirim_antrean()','EXECUTE'),'incremental migration preserves function restriction');
SELECT 'HRD alert checks passed' AS result;
ROLLBACK;
