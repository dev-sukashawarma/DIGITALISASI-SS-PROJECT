-- Extend HRD alert recipients to active, explicitly authorized developers.
-- Does not grant bot access or change whose attendance is monitored.

CREATE OR REPLACE FUNCTION public.bot_hrd_antrekan(p_key text, p_title text, p_body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.bot_hrd_alert_outbox(event_key,staff_id,title,body)
  SELECT p_key,s.id,left(p_title,180),left(p_body,1200)
  FROM public.outlet_staff s
  JOIN public.hermes_bot_user_access a ON a.staff_id=s.id AND a.bot_slug='hrd'
  JOIN public.bot_telegram_links l ON l.staff_id=s.id
  WHERE s.role IN ('admin_hr','developer') AND s.status='active' AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key,staff_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.bot_hrd_kirim_antrean()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_url text; v_secret text; v_request bigint; r record; v_response record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-hrd-delivery')) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='telegram_hrd_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='telegram_hrd_send_secret' LIMIT 1;
  IF coalesce(v_url,'')='' OR coalesce(v_secret,'')='' THEN RETURN; END IF;
  FOR r IN SELECT * FROM public.bot_hrd_alert_outbox WHERE outcome='pending'
    AND (attempts=0 OR request_id IS NOT NULL OR attempted_at<=now()-interval '15 minutes')
    ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
    -- A correction may resolve lateness while delivery is waiting. Check the
    -- latest daily row before sending the original snapshot to HR.
    IF r.event_key LIKE 'telat:%' AND NOT EXISTS (
      SELECT 1 FROM public.attendance_harian h
      WHERE h.staff_id=split_part(r.event_key,':',2)::uuid
        AND h.outlet_id=split_part(r.event_key,':',3)::uuid
        AND h.tgl=split_part(r.event_key,':',4)::date
        AND h.sumber='absen' AND h.clock_in IS NOT NULL AND h.telat_menit>15
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome='skipped' WHERE id=r.id;
      CONTINUE;
    END IF;
    -- Recheck authorization at send time; revoked access must take effect even
    -- when the alert was queued earlier. The endpoint checks it once more.
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff s
      JOIN public.hermes_bot_user_access a ON a.staff_id=s.id AND a.bot_slug='hrd'
      JOIN public.bot_telegram_links l ON l.staff_id=s.id
      WHERE s.id=r.staff_id AND s.role IN ('admin_hr','developer') AND s.status='active' AND l.chat_id IS NOT NULL
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome='skipped' WHERE id=r.id;
      CONTINUE;
    END IF;
    IF r.request_id IS NOT NULL THEN
      SELECT status_code,content INTO v_response FROM net._http_response WHERE id=r.request_id;
      IF FOUND THEN
        IF v_response.status_code=200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'delivered'='true' THEN
          UPDATE public.bot_hrd_alert_outbox SET outcome='delivered' WHERE id=r.id;
          CONTINUE;
        ELSIF v_response.status_code=200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason'='not_eligible' THEN
          UPDATE public.bot_hrd_alert_outbox SET outcome='skipped' WHERE id=r.id;
          CONTINUE;
        END IF;
        UPDATE public.bot_hrd_alert_outbox SET request_id=NULL WHERE id=r.id;
      ELSIF r.attempted_at > now()-interval '2 minutes' THEN CONTINUE;
      END IF;
    END IF;
    IF r.attempts>=3 THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome='failed' WHERE id=r.id;
      CONTINUE;
    END IF;
    IF r.attempted_at > now()-interval '15 minutes' THEN CONTINUE; END IF;
    BEGIN
      v_request := net.http_post(url:=v_url,
        headers:=jsonb_build_object('Content-Type','application/json','Accept','application/json',
          'User-Agent','SukaShawarma-HRD-Alerts/1.0','Authorization','Bearer '||v_secret),
        body:=jsonb_build_object('user_id',r.staff_id,'title',r.title,'body',r.body),
        timeout_milliseconds:=15000);
      UPDATE public.bot_hrd_alert_outbox SET request_id=v_request,attempted_at=now(),attempts=attempts+1 WHERE id=r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bot_hrd_alert_outbox SET request_id=NULL,attempted_at=now(),attempts=attempts+1 WHERE id=r.id;
    END;
  END LOOP;
  -- Retain recent delivery evidence; cap growth without exposing HR messages.
  DELETE FROM public.bot_hrd_alert_outbox WHERE created_at < now()-interval '90 days' AND outcome<>'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.bot_hrd_antrekan(text,text,text), public.bot_hrd_kirim_antrean() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_hrd_kirim_antrean() TO service_role;
