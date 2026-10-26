-- =============================================================================
-- Migration: 20300254010600_fix_remaining_am_rm_and_shared_trigger_bugs.sql
-- Tanggal: 2026-10-26
-- Deskripsi:
--   Perbaikan menyeluruh hasil audit /bug-hunt-swarm untuk AM, RM, CEO, dan
--   Shared Triggers di atas migration 20300254010500 (tanpa bentrok dengan Kitchen):
--
--   1. Helper HTML & Outbox CEO (dari 20300254010100 yang belum ter-apply di prod):
--      - public.bot_escape_html(text)
--      - public.bot_format_rupiah(numeric)
--      - public.bot_format_angka(numeric)
--      - public.bot_ceo_antrekan(...) & public.bot_ceo_kirim_antrean()
--
--   2. RLS Policies Admin/Owner/Developer (dari 20300254010200):
--      - Mengizinkan role 'developer' & 'owner' pada outlets, expenses, orders,
--        order_items, guides, promo_quota_pools, outlet_promos.
--
--   3. Perbaikan P0 Kolom Non-Existent pada Trigger Live:
--      - trg_fn_bot_ceo_absensi_fraud_alert: ganti NEW.device_info -> NEW.source
--      - trigger_distribusi_push_notification: ganti public.attendance (a.staff_id,
--        a.date, a.clock_in, a.clock_out) -> public.attendance_harian (a.staff_id,
--        a.tgl, a.clock_in, a.clock_out), serta hapus pengiriman duplikat
--        'crew_distribusi' ke Area Manager (AM sudah menerima 'sj_kirim_am').
--      - trg_fn_crew_leave_status_push & trg_fn_crew_kasbon_status_push: ganti
--        NEW.rejection_reason -> NEW.rejection_note.
--      - trg_fn_bot_ceo_finance_no_receipt_expense: hapus query ke kolom
--        outlet_staff.auth_user_id yang tidak ada + tambahkan EXCEPTION handler.
--
--   4. Perbaikan Routing, Deduplikasi, & Kapasitas Pesan AM/RM:
--      - bot_kirim_push_hp: perbesar batas simpan body di bot_app_notifications
--        dari 1500 -> 3800 karakter agar rekap multi-cabang tidak terpotong.
--      - bot_manager_antrekan: petakan p_url/p_key secara cerdas ke rute native
--        ('manager_waste', 'manager_ceklist', 'manager_persetujuan', atau 'bot'),
--        bersihkan tag HTML untuk push HP, dan perbesar outbox body 1200 -> 3800.
--      - Drop trigger duplikat on_waste_pending_send_push pada stok_waste_reports
--        (karena bot_manager_alert_waste kini langsung mengirim route 'manager_waste'
--        dengan menghormati threshold Rp 150rb untuk RM).
--      - ceklist_harian_kirim_push: sertakan tanggal WIB pada event_key agar
--        laporan ceklist bersih di hari berikutnya tidak ter-skip oleh deduplikasi,
--        dan arahkan ke rute 'manager_ceklist'.
--
--   5. Perbaikan Timing & Guard Boundary Outlet Penjualan (bot_is_sales_outlet):
--      - Jadikan trg_bot_telegram_verifikasi_surat_jalan pada public.surat_jalan
--        sebagai CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED agar saat INSERT
--        status 'dikirim', rincian surat_jalan_item sudah ter-insert lebih dulu.
--      - Gunakan public.bot_is_sales_outlet() & NOT public.bot_is_outlet_tutup_sementara()
--        secara konsisten pada bot_manager_broadcast_omzet,
--        bot_manager_cek_zero_sales_dan_sj_gantung (dengan batas jam operasional
--        08:00-21:59 WIB & bucket 4 jam untuk pengingat SJ gantung), serta seluruh
--        trigger event-driven AM/RM.
-- =============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper Escaping & Formatting Telegram HTML + Outbox CEO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_escape_html(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;
  RETURN replace(
    replace(
      replace(p_text, '&', '&amp;'),
      '<', '&lt;'
    ),
    '>', '&gt;'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_format_rupiah(p_amount numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_amount IS NULL THEN
    RETURN 'Rp 0';
  END IF;
  IF p_amount < 0 THEN
    RETURN '-Rp ' || replace(to_char(abs(p_amount), 'FM999,999,999,999'), ',', '.');
  ELSE
    RETURN 'Rp ' || replace(to_char(p_amount, 'FM999,999,999,999'), ',', '.');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_format_angka(p_number numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_number IS NULL THEN
    RETURN '0';
  END IF;
  RETURN replace(to_char(p_number, 'FM999,999,999,999'), ',', '.');
END;
$$;

-- Perbesar kapasitas simpan body di bot_app_notifications (1500 -> 3800)
CREATE OR REPLACE FUNCTION public.bot_kirim_push_hp(
  p_event_key text,
  p_staff_id uuid,
  p_bot_slug text,
  p_title text,
  p_body text,
  p_route text DEFAULT 'bot'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted_id bigint;
  v_url text;
  v_key text;
  v_clean_key text;
  v_clean_route text;
BEGIN
  IF p_staff_id IS NULL OR coalesce(btrim(p_title), '') = '' OR coalesce(btrim(p_body), '') = '' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role <> 'leader'
  ) THEN
    RETURN;
  END IF;

  v_clean_key := coalesce(nullif(btrim(p_event_key), ''), 'bot:' || gen_random_uuid()::text);
  v_clean_route := coalesce(nullif(btrim(p_route), ''), 'bot');

  -- 1. Simpan ke tabel notifikasi HP (memicu Supabase Realtime + deduplikasi via event_key)
  INSERT INTO public.bot_app_notifications (
    event_key, staff_id, bot_slug, title, body, route
  ) VALUES (
    v_clean_key,
    p_staff_id,
    coalesce(nullif(btrim(p_bot_slug), ''), 'manager'),
    left(p_title, 180),
    left(p_body, 3800),
    v_clean_route
  )
  ON CONFLICT (event_key, staff_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Kirim ke Edge Function send-push untuk membangunkan HP via FCM
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

  IF coalesce(v_url, '') <> '' AND coalesce(v_key, '') <> '' THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'user_id', p_staff_id,
        'app', 'bot',
        'type', 'bot_alert',
        'event_key', v_clean_key,
        'title', left(p_title, 180),
        'body', left(p_body, 1200),
        'url', v_clean_route
      )
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengirim notifikasi HP Bot untuk staf %: %', p_staff_id, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_ceo_antrekan(
  p_key text,
  p_staff_id uuid,
  p_title text,
  p_body text,
  p_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg_url text;
BEGIN
  -- A. Jalur Notifikasi HP Native (SUKA Superapp) - bersihkan tag HTML
  IF EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'developer')
  ) THEN
    PERFORM public.bot_kirim_push_hp(
      p_key,
      p_staff_id,
      'ceo',
      regexp_replace(p_title, '<[^>]+>', '', 'g'),
      regexp_replace(p_body, '<[^>]+>', '', 'g'),
      'bot'
    );
  END IF;

  -- B. Jalur Telegram Bot CEO
  v_tg_url := CASE
    WHEN p_url IS NULL OR btrim(p_url) = '' OR btrim(p_url) = 'bot' OR p_url NOT LIKE 'https://%'
      THEN 'https://agents.sukashawarma.com'
    ELSE btrim(p_url)
  END;

  INSERT INTO public.bot_ceo_alert_outbox(event_key, staff_id, title, body, url)
  SELECT p_key, s.id, left(p_title, 255), left(p_body, 3800), v_tg_url
  FROM public.outlet_staff s
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role IN ('owner', 'admin', 'developer')
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_ceo_kirim_antrean()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bot_token text;
  v_url text;
  v_request bigint;
  r record;
  v_response record;
  v_text text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-ceo-delivery')) THEN
    RETURN;
  END IF;

  SELECT bot_token INTO v_bot_token FROM public.hermes_bot_registry WHERE slug = 'ceo' LIMIT 1;
  IF coalesce(v_bot_token, '') = '' THEN
    SELECT decrypted_secret INTO v_bot_token FROM vault.decrypted_secrets WHERE name = 'telegram_ceo_bot_token' LIMIT 1;
  END IF;

  IF coalesce(v_bot_token, '') <> '' THEN
    v_url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage';
  ELSE
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_ceo_send_url' LIMIT 1;
  END IF;

  IF coalesce(v_url, '') = '' THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT o.*, l.chat_id
    FROM public.bot_ceo_alert_outbox o
    JOIN public.bot_telegram_links l ON l.staff_id = o.staff_id
    JOIN public.outlet_staff s ON s.id = o.staff_id
    WHERE o.outcome = 'pending'
      AND s.role IN ('owner', 'admin', 'developer')
      AND s.status = 'active'
      AND l.chat_id IS NOT NULL
      AND (o.attempts = 0 OR o.request_id IS NOT NULL OR o.attempted_at <= now() - interval '2 minutes')
    ORDER BY o.created_at LIMIT 50 FOR UPDATE OF o SKIP LOCKED
  LOOP
    IF r.request_id IS NOT NULL THEN
      SELECT status_code, content INTO v_response FROM net._http_response WHERE id = r.request_id;
      IF FOUND THEN
        IF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND (v_response.content::jsonb->>'ok' = 'true' OR v_response.content::jsonb->>'delivered' = 'true') THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'delivered' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason' = 'not_eligible' THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 400 OR v_response.status_code = 403 THEN
          UPDATE public.bot_ceo_alert_outbox SET outcome = 'failed' WHERE id = r.id;
          CONTINUE;
        END IF;
        UPDATE public.bot_ceo_alert_outbox SET request_id = NULL WHERE id = r.id;
      ELSIF r.attempted_at > now() - interval '2 minutes' THEN
        CONTINUE;
      END IF;
    END IF;

    IF r.attempts >= 3 THEN
      UPDATE public.bot_ceo_alert_outbox SET outcome = 'failed' WHERE id = r.id;
      CONTINUE;
    END IF;

    IF r.body LIKE '━━━━━━━━━━━━━━━━━━━━━%' THEN
      v_text := r.title || E'\n' || r.body;
    ELSE
      v_text := r.title || E'\n\n' || r.body;
    END IF;

    BEGIN
      IF v_url LIKE '%api.telegram.org%' THEN
        v_request := net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'chat_id', r.chat_id,
            'text', v_text,
            'parse_mode', 'HTML'
          ),
          timeout_milliseconds := 15000
        );
      ELSE
        v_request := net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'user_id', r.staff_id,
            'title', r.title,
            'body', r.body,
            'url', r.url
          ),
          timeout_milliseconds := 15000
        );
      END IF;

      UPDATE public.bot_ceo_alert_outbox
      SET request_id = v_request, attempted_at = now(), attempts = attempts + 1
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bot_ceo_alert_outbox
      SET request_id = NULL, attempted_at = now(), attempts = attempts + 1
      WHERE id = r.id;
    END;
  END LOOP;

  DELETE FROM public.bot_ceo_alert_outbox
  WHERE created_at < now() - interval '90 days' AND outcome <> 'pending';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS Policies Admin / Owner / Developer (dari 20300254010200)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "outlets_all_admin" ON public.outlets;
CREATE POLICY "outlets_all_admin" ON public.outlets
  FOR ALL
  TO authenticated
  USING (
    public.is_owner_or_admin()
    OR (SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text])
  )
  WITH CHECK (
    public.is_owner_or_admin()
    OR (SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text])
  );

DROP POLICY IF EXISTS "outlets_insert_denied" ON public.outlets;
DROP POLICY IF EXISTS "outlets_update_denied" ON public.outlets;
DROP POLICY IF EXISTS "outlets_delete_denied" ON public.outlets;

DROP POLICY IF EXISTS "expenses_update_admin" ON public.expenses;
CREATE POLICY "expenses_update_admin" ON public.expenses
  FOR UPDATE TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "expenses_delete_admin" ON public.expenses;
CREATE POLICY "expenses_delete_admin" ON public.expenses
  FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "expenses_insert_scoped" ON public.expenses;
CREATE POLICY "expenses_insert_scoped" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (outlet_id IN (SELECT accessible_outlet_ids()))
    OR (outlet_id IS NULL AND (SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  );

DROP POLICY IF EXISTS "orders_all_admin" ON public.orders;
CREATE POLICY "orders_all_admin" ON public.orders
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "order_items_all_admin_kasir" ON public.order_items;
CREATE POLICY "order_items_all_admin_kasir" ON public.order_items
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text, 'kasir'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text, 'kasir'::text]));

DROP POLICY IF EXISTS "guides_all_admin" ON public.guides;
CREATE POLICY "guides_all_admin" ON public.guides
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "promo_quota_pools_admin_owner" ON public.promo_quota_pools;
CREATE POLICY "promo_quota_pools_admin_owner" ON public.promo_quota_pools
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

DROP POLICY IF EXISTS "outlet_promos_all_admin_owner" ON public.outlet_promos;
CREATE POLICY "outlet_promos_all_admin_owner" ON public.outlet_promos
  FOR ALL TO authenticated
  USING ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]))
  WITH CHECK ((SELECT get_user_role()) = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Upgrade bot_manager_antrekan (Deep-Link Rute Native & Outbox 3800 Karakter)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_manager_antrekan(
  p_key text,
  p_staff_id uuid,
  p_title text,
  p_body text,
  p_url text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tg_url text;
  v_route text;
BEGIN
  v_route := CASE
    WHEN p_url IN ('manager_waste', 'manager_ceklist', 'manager_persetujuan', 'bot') THEN p_url
    WHEN p_url LIKE '%/waste%' OR p_key LIKE 'waste_%' THEN 'manager_waste'
    WHEN p_url LIKE '%/ceklist%' OR p_key LIKE 'ceklist:%' THEN 'manager_ceklist'
    WHEN p_url LIKE '%/approvals%' OR p_key LIKE 'retur%' THEN 'manager_persetujuan'
    ELSE 'bot'
  END;

  -- 1. Jalur Notifikasi HP Native (SUKA Superapp)
  IF EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = p_staff_id
      AND s.status = 'active'
      AND s.role IN ('area_manager', 'regional_manager', 'developer')
  ) THEN
    PERFORM public.bot_kirim_push_hp(
      p_key,
      p_staff_id,
      'manager',
      regexp_replace(p_title, '<[^>]+>', '', 'g'),
      regexp_replace(p_body, '<[^>]+>', '', 'g'),
      v_route
    );
  END IF;

  -- 2. Jalur Telegram Bot Manager (pastikan URL yang masuk ke outbox adalah HTTPS valid)
  v_tg_url := CASE
    WHEN p_url IS NULL OR btrim(p_url) = '' OR p_url NOT LIKE 'https://%'
      THEN 'https://manager.sukashawarma.com'
    ELSE btrim(p_url)
  END;

  INSERT INTO public.bot_manager_alert_outbox(event_key, staff_id, title, body, url)
  SELECT p_key, s.id, left(p_title, 180), left(p_body, 3800), v_tg_url
  FROM public.outlet_staff s
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role IN ('area_manager', 'regional_manager', 'developer')
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
END;
$$;

-- Hapus trigger duplikat on_waste_pending_send_push pada stok_waste_reports
-- (karena bot_manager_alert_waste sudah mengirim push HP dengan route 'manager_waste'
-- dan menghormati threshold Rp 150.000 untuk Regional Manager).
DROP TRIGGER IF EXISTS on_waste_pending_send_push ON public.stok_waste_reports;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Perbaikan ceklist_harian_kirim_push (Sertakan Tanggal WIB pada Event Key)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ceklist_harian_kirim_push(
  p_user_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_tgl_wib text := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD');
BEGIN
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = p_user_id;
  IF v_role IN ('regional_manager', 'area_manager', 'developer') THEN
    PERFORM public.bot_manager_antrekan(
      'ceklist:' || p_user_id || ':' || v_tgl_wib || ':' || md5(p_title || p_body),
      p_user_id,
      p_title,
      p_body,
      'manager_ceklist'
    );
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Perbaikan P0 Kolom Non-Existent pada Trigger Live
-- ─────────────────────────────────────────────────────────────────────────────

-- 5A. trg_fn_bot_ceo_absensi_fraud_alert: gunakan NEW.source (bukan NEW.device_info)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_absensi_fraud_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_staff_name text;
  v_device_info text;
  v_am record;
  v_ceo record;
BEGIN
  IF NEW.type <> 'in' OR NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.distance_m, 0) > 100 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    SELECT coalesce(name, 'Kru Outlet') INTO v_staff_name
    FROM public.outlet_staff WHERE id = NEW.outlet_staff_id;

    v_device_info := coalesce(nullif(btrim(NEW.source), ''), 'Aplikasi Mobile Presensi');

    -- A. Kirim ke Area Manager (AM) pembina cabang (Push HP Native + Telegram Bot Manager)
    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('absensi_fraud_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '🚨 [AUDIT ABSENSI] Fake GPS / Luar Radius — ' || v_outlet_name,
        format(
          E'Deteksi presensi clock-in di luar radius batas aman toko di cabang binaan Anda.\nOutlet: %s\nNama Staf: %s\nJarak Terdeteksi: %s meter dari koordinat outlet (Batas SOP: 20m)\nWaktu Absen: %s WIB\n\nSegera kroscek apakah staf benar-benar ada di gerai atau menggunakan Fake GPS / titip absen.',
          v_outlet_name,
          v_staff_name,
          round(NEW.distance_m, 0)::text,
          to_char(coalesce(NEW.ts_client, NEW.ts_server) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'bot'
      );
    END LOOP;

    -- B. Kirim ke Bot CEO (Owner / Admin / Developer)
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('absensi_fraud_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 <b>ESKALASI INDIKASI FRAUD ABSENSI KRU</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'👤 <b>Kru:</b> <b>%s</b>\n' ||
          E'📍 <b>Jarak Terdeteksi:</b> <code>%s Meter</code> dari geofence outlet (Batas SOP: 20m)\n' ||
          E'⏱️ <b>Waktu Clock-In:</b> <code>%s WIB</code>\n' ||
          E'📱 <b>Sumber Presensi:</b> %s\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Presensi dilakukan di luar radius toleransi lokasi outlet (indikasi Mock GPS atau titip absen). Konfirmasi dengan rekaman CCTV atau supervisi Area Manager.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(v_staff_name),
          round(NEW.distance_m, 0)::text,
          to_char(coalesce(NEW.ts_client, NEW.ts_server) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          public.bot_escape_html(v_device_info)
        ),
        'https://hr.sukashawarma.com/attendance'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_absensi_fraud_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5B. trigger_distribusi_push_notification: gunakan public.attendance_harian
--     dan hanya kirim 'crew_distribusi' ke kru/leader/kasir (AM sudah dapat sj_kirim_am)
CREATE OR REPLACE FUNCTION public.trigger_distribusi_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_outlet_name TEXT;
  v_nomor_sj TEXT;
  v_title TEXT;
  v_body TEXT;
  v_target_staff_ids UUID[] := '{}';
  v_staff_id UUID;
  v_has_clocked_in BOOLEAN := false;
BEGIN
  IF NEW.status IN ('dikirim', 'dikirim_lengkap')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
      RETURN NEW;
    END IF;

    SELECT coalesce(name, 'Outlet') INTO v_outlet_name
    FROM public.outlets
    WHERE id = NEW.outlet_id;

    v_nomor_sj := coalesce(NULLIF(NEW.document_number, ''), left(NEW.id::text, 8));
    v_title := '🚚 [PENGIRIMAN TIBA] Bahan Baku Sedang Dikirim';
    v_body := format(
      'Surat Jalan no. %s untuk %s sedang dalam perjalanan/tiba. Mohon segera dicek & diverifikasi fisik barangnya!',
      v_nomor_sj,
      v_outlet_name
    );

    -- 1. Kru yang sedang bertugas hari ini di outlet tujuan (sudah clock-in & belum clock-out di attendance_harian)
    FOR v_staff_id IN
      SELECT DISTINCT a.staff_id
      FROM public.attendance_harian a
      JOIN public.outlet_staff s ON s.id = a.staff_id
      WHERE a.outlet_id = NEW.outlet_id
        AND a.tgl = v_today
        AND a.clock_in IS NOT NULL
        AND a.clock_out IS NULL
        AND s.status = 'active'
        AND s.role IN ('crew', 'leader', 'kasir')
    LOOP
      v_target_staff_ids := array_append(v_target_staff_ids, v_staff_id);
      v_has_clocked_in := true;
    END LOOP;

    -- Bila belum ada kru yang clock-in, fallback ke seluruh kru & leader aktif yang terdaftar di outlet tersebut
    IF NOT v_has_clocked_in THEN
      FOR v_staff_id IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        LEFT JOIN public.staff_outlets so ON so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
        WHERE (s.outlet_id = NEW.outlet_id OR so.outlet_id IS NOT NULL)
          AND s.status = 'active'
          AND s.role IN ('crew', 'leader', 'kasir')
      LOOP
        v_target_staff_ids := array_append(v_target_staff_ids, v_staff_id);
      END LOOP;
    END IF;

    -- Kirim push notification ke setiap kru/leader target
    FOREACH v_staff_id IN ARRAY v_target_staff_ids
    LOOP
      PERFORM public.crew_alert_kirim_push(
        v_staff_id,
        v_title,
        v_body,
        'crew_distribusi',
        'crew_distribusi'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trigger_distribusi_push_notification gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5C. trg_fn_crew_leave_status_push: gunakan NEW.rejection_note (bukan NEW.rejection_reason)
CREATE OR REPLACE FUNCTION public.trg_fn_crew_leave_status_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jenis TEXT;
  v_rentang TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    v_jenis := CASE lower(coalesce(NEW.type, NEW.leave_type, 'cuti'))
      WHEN 'annual' THEN 'Cuti Tahunan'
      WHEN 'cuti' THEN 'Cuti'
      WHEN 'sick' THEN 'Izin Sakit'
      WHEN 'sakit' THEN 'Izin Sakit'
      WHEN 'izin' THEN 'Izin'
      WHEN 'special' THEN 'Izin Khusus'
      ELSE 'Pengajuan Cuti/Izin'
    END;

    IF NEW.start_date IS NULL THEN
      v_rentang := '-';
    ELSIF NEW.end_date IS NULL OR NEW.end_date = NEW.start_date THEN
      v_rentang := to_char(NEW.start_date, 'DD Mon YYYY');
    ELSE
      v_rentang := to_char(NEW.start_date, 'DD Mon') || ' – ' || to_char(NEW.end_date, 'DD Mon YYYY');
    END IF;

    IF NEW.status = 'approved' THEN
      v_title := '✅ ' || v_jenis || ' Disetujui';
      v_body := 'Pengajuan ' || v_jenis || ' Anda (' || v_rentang || ') telah disetujui oleh HR.';
    ELSE
      v_title := '❌ ' || v_jenis || ' Ditolak';
      v_body := 'Pengajuan ' || v_jenis || ' Anda (' || v_rentang || ') ditolak oleh HR.';
      IF NEW.rejection_note IS NOT NULL AND btrim(NEW.rejection_note) <> '' THEN
        v_body := v_body || E'\nAlasan: "' || left(btrim(NEW.rejection_note), 150) || '"';
      END IF;
    END IF;

    PERFORM public.crew_alert_kirim_push(
      NEW.staff_id,
      v_title,
      v_body,
      'crew_cuti',
      'crew_cuti'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_crew_leave_status_push gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5D. trg_fn_crew_kasbon_status_push: gunakan NEW.rejection_note (bukan NEW.rejection_reason)
CREATE OR REPLACE FUNCTION public.trg_fn_crew_kasbon_status_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rupiah TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status_hr IN ('approved', 'rejected') AND (OLD.status_hr IS NULL OR OLD.status_hr = 'pending') THEN
    v_rupiah := 'Rp ' || to_char(coalesce(NEW.amount, 0), 'FM999,999,999');

    IF NEW.status_hr = 'approved' THEN
      v_title := '💰 Pengajuan Kasbon Disetujui';
      v_body := 'Pengajuan kasbon Anda sebesar ' || v_rupiah || ' telah disetujui oleh HR.';
      IF coalesce(NEW.installment_months, 1) > 1 THEN
        v_body := v_body || ' Dicicil ' || NEW.installment_months || ' bulan.';
      END IF;
    ELSE
      v_title := '❌ Pengajuan Kasbon Ditolak';
      v_body := 'Pengajuan kasbon Anda sebesar ' || v_rupiah || ' ditolak oleh HR.';
      IF NEW.rejection_note IS NOT NULL AND btrim(NEW.rejection_note) <> '' THEN
        v_body := v_body || E'\nAlasan: "' || left(btrim(NEW.rejection_note), 150) || '"';
      END IF;
    END IF;

    PERFORM public.crew_alert_kirim_push(
      NEW.staff_id,
      v_title,
      v_body,
      'crew_kasbon',
      'crew_kasbon'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_crew_kasbon_status_push gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5E. trg_fn_bot_ceo_finance_no_receipt_expense: hapus query ke auth_user_id + tambah EXCEPTION handler
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_no_receipt_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outlet_nama text;
  v_staff_nama text;
  v_ceo record;
  v_is_violation boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.receipt_url IS NULL OR trim(NEW.receipt_url) = '' THEN
    IF NEW.amount >= 100000 THEN
      v_is_violation := true;
    ELSIF NEW.amount >= 50000 AND NEW.category IN ('lainnya', 'pengeluaran_outlet', 'outlet') THEN
      v_is_violation := true;
    END IF;
  END IF;

  IF v_is_violation THEN
    SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;
    SELECT name INTO v_staff_nama FROM public.outlet_staff WHERE id = NEW.created_by;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('no_receipt_expense:%s', NEW.id::text),
        v_ceo.id,
        '⚠️ [FINANCE WARNING] Pengeluaran Kas Kecil Tanpa Bukti Nota Fisik — ' || coalesce(v_outlet_nama, 'Outlet'),
        format(
          E'Tercatat pengeluaran kas operasional gerai tanpa lampiran bukti foto struk/nota fisik yang sah.\nOutlet: %s\nNominal: Rp %s\nKategori: %s\nKeterangan: %s\nPencatat: %s\n\nPerhatian Direksi: Potensi nota fiktif atau pengeluaran tidak dapat dipertanggungjawabkan saat audit. Finance wajib verifikasi fisik nota ke Leader cabang.',
          coalesce(v_outlet_nama, 'Outlet'),
          to_char(NEW.amount, 'FM999,999,999'),
          upper(replace(NEW.category, '_', ' ')),
          coalesce(NEW.description, '-'),
          coalesce(v_staff_nama, 'Kru Kasir')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_finance_no_receipt_expense gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Perbaikan Boundary & Jam Operasional pada Cron AM/RM + Trigger Event-Driven
-- ─────────────────────────────────────────────────────────────────────────────

-- 6A. bot_manager_broadcast_omzet: tambahkan NOT public.bot_is_outlet_tutup_sementara(o.id)
CREATE OR REPLACE FUNCTION public.bot_manager_broadcast_omzet(p_sesi text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_sesi_label text;
  v_url text := 'https://manager.sukashawarma.com/dashboard';
  v_am record;
  v_outlet record;
  v_am_omzet numeric;
  v_am_pcs numeric;
  v_am_target numeric;
  v_am_pct numeric;
  v_am_lines text[];
  v_title text;
  v_body text;
  v_reg_omzet numeric := 0;
  v_reg_pcs numeric := 0;
  v_reg_target numeric := 0;
  v_reg_pct numeric := 0;
  v_reg_lines text[];
  v_area_item record;
  v_rm record;
BEGIN
  IF p_sesi NOT IN ('siang', 'dinner', 'closing') THEN
    RAISE EXCEPTION 'Sesi broadcast tidak valid: %', p_sesi;
  END IF;

  v_sesi_label := CASE p_sesi
    WHEN 'siang' THEN 'SIANG (15:00 WIB)'
    WHEN 'dinner' THEN 'DINNER (19:30 WIB)'
    WHEN 'closing' THEN 'CLOSING FINAL (22:30 WIB)'
  END;

  -- 1. Laporan Per Area Manager (AM)
  FOR v_am IN
    SELECT DISTINCT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager' AND s.status = 'active'
    ORDER BY s.name
  LOOP
    v_am_omzet := 0;
    v_am_pcs := 0;
    v_am_target := 0;
    v_am_lines := '{}';

    FOR v_outlet IN
      SELECT
        o.id,
        o.name,
        COALESCE(s.omzet, 0) AS outlet_omzet,
        COALESCE(s.total_pcs, 0) AS outlet_pcs,
        COALESCE(t.target_amount, 0) AS outlet_target,
        CASE WHEN COALESCE(t.target_amount, 0) > 0
          THEN ROUND((COALESCE(s.omzet, 0) / t.target_amount) * 100, 1)
          ELSE 0 END AS outlet_pct
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(ord.total_amount), 0) AS omzet,
          COALESCE((
            SELECT SUM(oi.quantity)
            FROM public.order_items oi
            JOIN public.orders ord2 ON ord2.id = oi.order_id
            WHERE ord2.outlet_id = o.id
              AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
              AND ord2.status IN ('completed', 'selesai', 'paid')
          ), 0) AS total_pcs
        FROM public.orders ord
        WHERE ord.outlet_id = o.id
          AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
          AND ord.status IN ('completed', 'selesai', 'paid')
      ) s
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          0
        ) AS target_amount
      ) t
      WHERE so.staff_id = v_am.id
        AND public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
      ORDER BY s.omzet DESC, o.name
    LOOP
      v_am_omzet := v_am_omzet + v_outlet.outlet_omzet;
      v_am_pcs := v_am_pcs + v_outlet.outlet_pcs;
      v_am_target := v_am_target + v_outlet.outlet_target;

      v_am_lines := array_append(
        v_am_lines,
        '• ' || v_outlet.name || ': Rp ' || to_char(v_outlet.outlet_omzet, 'FM999,999,999')
          || ' (' || v_outlet.outlet_pcs || ' pcs)'
          || CASE WHEN v_outlet.outlet_target > 0 THEN ' [' || v_outlet.outlet_pct || '%]' ELSE '' END
      );
    END LOOP;

    IF COALESCE(cardinality(v_am_lines), 0) > 0 THEN
      v_am_pct := CASE WHEN v_am_target > 0 THEN ROUND((v_am_omzet / v_am_target) * 100, 1) ELSE 0 END;

      v_title := '📊 LAPORAN OMZET ' || v_sesi_label;
      v_body := 'Area: ' || v_am.name
        || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
        || E'\nTotal Omzet: Rp ' || to_char(v_am_omzet, 'FM999,999,999') || ' (' || v_am_pcs || ' pcs)'
        || (CASE WHEN v_am_target > 0 THEN E'\nCapaian Target: ' || v_am_pct || '% dari Rp ' || to_char(v_am_target, 'FM999,999,999') ELSE '' END)
        || E'\n\nPerforma Cabang Binaan:'
        || E'\n' || array_to_string(v_am_lines, E'\n')
        || (CASE
            WHEN p_sesi = 'siang' AND v_am_pct < 40 THEN E'\n\n⚠️ Perhatian AM: Capaian siang masih di bawah 40%, mohon evaluasi jam operasional & stok cabang.'
            WHEN p_sesi = 'dinner' AND v_am_pct < 80 THEN E'\n\n⏳ Info AM: Masih butuh dorongan penjualan sebelum closing untuk mencapai target 100%.'
            WHEN p_sesi = 'closing' AND v_am_pct >= 100 THEN E'\n\n🎉 Selamat! Target area hari ini berhasil tercapai 100%.'
            ELSE '' END);

      PERFORM public.bot_manager_antrekan(
        'omzet_am:' || p_sesi || ':' || v_am.id || ':' || v_today,
        v_am.id,
        v_title,
        v_body,
        v_url
      );
    END IF;
  END LOOP;

  -- 2. Laporan Eksekutif Regional (ke Seluruh RM)
  SELECT
    COALESCE(SUM(s.omzet), 0),
    COALESCE(SUM(s.total_pcs), 0),
    COALESCE(SUM(t.target_amount), 0)
  INTO v_reg_omzet, v_reg_pcs, v_reg_target
  FROM public.outlets o
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(SUM(ord.total_amount), 0) AS omzet,
      COALESCE((
        SELECT SUM(oi.quantity)
        FROM public.order_items oi
        JOIN public.orders ord2 ON ord2.id = oi.order_id
        WHERE ord2.outlet_id = o.id
          AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
          AND ord2.status IN ('completed', 'selesai', 'paid')
      ), 0) AS total_pcs
    FROM public.orders ord
    WHERE ord.outlet_id = o.id
      AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
      AND ord.status IN ('completed', 'selesai', 'paid')
  ) s
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
      (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
      0
    ) AS target_amount
  ) t
  WHERE public.bot_is_sales_outlet(o.id)
    AND NOT public.bot_is_outlet_tutup_sementara(o.id);

  v_reg_lines := '{}';

  FOR v_area_item IN
    SELECT
      am.name AS am_name,
      COALESCE(SUM(s.omzet), 0) AS area_omzet,
      COALESCE(SUM(s.total_pcs), 0) AS area_pcs,
      COALESCE(SUM(t.target_amount), 0) AS area_target,
      CASE WHEN COALESCE(SUM(t.target_amount), 0) > 0
        THEN ROUND((COALESCE(SUM(s.omzet), 0) / SUM(t.target_amount)) * 100, 1)
        ELSE 0 END AS area_pct
    FROM public.outlet_staff am
    JOIN public.staff_outlets so ON so.staff_id = am.id
    JOIN public.outlets o ON o.id = so.outlet_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(SUM(ord.total_amount), 0) AS omzet,
        COALESCE((
          SELECT SUM(oi.quantity)
          FROM public.order_items oi
          JOIN public.orders ord2 ON ord2.id = oi.order_id
          WHERE ord2.outlet_id = o.id
            AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
            AND ord2.status IN ('completed', 'selesai', 'paid')
        ), 0) AS total_pcs
      FROM public.orders ord
      WHERE ord.outlet_id = o.id
        AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
        AND ord.status IN ('completed', 'selesai', 'paid')
    ) s
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        0
      ) AS target_amount
    ) t
    WHERE am.role = 'area_manager' AND am.status = 'active'
      AND public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
    GROUP BY am.id, am.name
    ORDER BY area_omzet DESC
  LOOP
    v_reg_lines := array_append(
      v_reg_lines,
      '• Area ' || v_area_item.am_name || ': Rp ' || to_char(v_area_item.area_omzet, 'FM999,999,999')
        || ' (' || v_area_item.area_pcs || ' pcs)'
        || CASE WHEN v_area_item.area_target > 0 THEN ' [' || v_area_item.area_pct || '%]' ELSE '' END
    );
  END LOOP;

  IF COALESCE(cardinality(v_reg_lines), 0) > 0 THEN
    v_reg_pct := CASE WHEN v_reg_target > 0 THEN ROUND((v_reg_omzet / v_reg_target) * 100, 1) ELSE 0 END;

    v_title := '🌐 REKAP REGIONAL OMZET ' || v_sesi_label;
    v_body := 'Wilayah: Seluruh Regional'
      || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
      || E'\nTotal Omzet: Rp ' || to_char(v_reg_omzet, 'FM999,999,999') || ' (' || v_reg_pcs || ' pcs)'
      || (CASE WHEN v_reg_target > 0 THEN E'\nCapaian Target: ' || v_reg_pct || '% dari Rp ' || to_char(v_reg_target, 'FM999,999,999') ELSE '' END)
      || E'\n\nPerforma Antar Area:'
      || E'\n' || array_to_string(v_reg_lines, E'\n')
      || E'\n\nCatatan: Koordinasikan dorongan target dengan Area Manager terkait.';

    FOR v_rm IN
      SELECT s.id
      FROM public.outlet_staff s
      WHERE s.role IN ('regional_manager', 'developer') AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'omzet_rm:' || p_sesi || ':' || v_rm.id || ':' || v_today,
        v_rm.id,
        v_title,
        v_body,
        v_url
      );
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_broadcast_omzet gagal: %', SQLERRM;
END;
$$;

-- 6B. bot_manager_cek_zero_sales_dan_sj_gantung:
--     batasi pengingat SJ gantung hanya pada jam operasional (08:00 - 22:00 WIB)
--     dengan bucket 4 jam, cek status IN ('dikirim', 'dikirim_lengkap'), dan exclude tutup sementara
CREATE OR REPLACE FUNCTION public.bot_manager_cek_zero_sales_dan_sj_gantung()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_tgl_wib date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_bucket_4h text := v_tgl_wib::text || '-b' || floor(v_jam / 4.0)::int::text;
  v_out record;
  v_sj record;
  v_am record;
  v_rm record;
  v_ceo record;
BEGIN
  -- A. Alert Cabang Rp 0 Transaksi (17:00 WIB ke AM, 19:30 WIB ke RM & CEO)
  IF v_jam >= 17 AND v_jam < 23 THEN
    FOR v_out IN
      SELECT o.id, o.name
      FROM public.outlets o
      WHERE public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
        AND NOT EXISTS (
          SELECT 1 FROM public.orders ord
          WHERE ord.outlet_id = o.id
            AND ord.status <> 'cancelled'
            AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib
        )
    LOOP
      FOR v_am IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        JOIN public.staff_outlets so ON so.staff_id = s.id
        WHERE so.outlet_id = v_out.id
          AND s.role = 'area_manager'
          AND s.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          format('zero17_am:%s:%s', v_tgl_wib::text, v_out.id::text),
          v_am.id,
          '🚨 [CABANG RP 0 TRANSAKSI] ' || v_out.name,
          format(
            E'Peringatan Sore (17:00 WIB): Outlet binaan sudah melewati jam buka namun belum mencatat 1 pun transaksi POS hari ini.\nOutlet: %s\nWaktu Cek: %s WIB\n\nSegera cek apakah kasir kendala perangkat/internet atau transaksi belum diinput ke POS.',
            v_out.name,
            to_char(v_now_wib, 'HH24:MI')
          ),
          'bot'
        );
      END LOOP;

      IF v_jam > 19 OR (v_jam = 19 AND extract(minute FROM v_now_wib) >= 30) THEN
        FOR v_rm IN
          SELECT id FROM public.outlet_staff
          WHERE role IN ('regional_manager', 'developer')
            AND status = 'active'
        LOOP
          PERFORM public.bot_manager_antrekan(
            format('zero1930_rm:%s:%s', v_tgl_wib::text, v_out.id::text),
            v_rm.id,
            '🚨 [ESKALASI RM] Cabang Masih Rp 0 Transaksi — ' || v_out.name,
            format(
              E'Eskalasi Malam (Prime Time): Outlet masih belum mencatat transaksi POS hingga pukul %s WIB.\nOutlet: %s\nStatus: Rp 0 (0 Order)\n\nMohon instruksikan Area Manager terkait untuk audit langsung operasional cabang.',
              to_char(v_now_wib, 'HH24:MI'),
              v_out.name
            ),
            'bot'
          );
        END LOOP;

        FOR v_ceo IN
          SELECT id FROM public.outlet_staff
          WHERE role IN ('owner', 'admin', 'developer')
            AND status = 'active'
        LOOP
          PERFORM public.bot_ceo_antrekan(
            format('zero1930_ceo:%s:%s', v_tgl_wib::text, v_out.id::text),
            v_ceo.id,
            '🚨 <b>ESKALASI OUTLET NOL TRANSAKSI (PRIME TIME)</b>',
            format(
              E'━━━━━━━━━━━━━━━━━━━━━\n' ||
              E'🏪 <b>Outlet:</b> %s\n' ||
              E'⏱️ <b>Waktu Evaluasi:</b> <code>%s WIB</code>\n' ||
              E'📊 <b>Status Penjualan:</b> <code>Rp 0 (0 Transaksi)</code>\n\n' ||
              E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
              E'Gerai telah melewati jam buka dan memasuki jam sibuk malam namun belum mencatat 1 pun transaksi di POS. Segera hubungi AM dan periksa apakah ada kendala listrik, perangkat POS offline, atau gerai belum dibuka.</blockquote>',
              public.bot_escape_html(v_out.name),
              to_char(v_now_wib, 'HH24:MI')
            ),
            'https://admin.sukashawarma.com'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- B. Alert Surat Jalan Menggantung > 2 Jam Belum Diverifikasi Cabang (hanya jam operasional 08:00 - 22:59 WIB, bucket 4 jam)
  IF v_jam >= 8 AND v_jam <= 22 THEN
    FOR v_sj IN
      SELECT sj.id,
             coalesce(sj.document_number, substr(sj.id::text, 1, 8)) AS doc_no,
             sj.outlet_id,
             coalesce(o.name, 'Cabang SS') AS outlet_name,
             round(extract(epoch FROM (now() - coalesce(sj.updated_at, sj.created_at))) / 3600.0, 1) AS jam_gantung
      FROM public.surat_jalan sj
      JOIN public.outlets o ON o.id = sj.outlet_id
      WHERE sj.status IN ('dikirim', 'dikirim_lengkap')
        AND sj.auto_verified_at IS NULL
        AND sj.ditutup_administratif_at IS NULL
        AND coalesce(sj.updated_at, sj.created_at) < (now() - interval '2 hours')
        AND coalesce(sj.updated_at, sj.created_at) >= (now() - interval '48 hours')
        AND public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
    LOOP
      -- 1. Kirim ke Area Manager (mulai > 2 jam, maksimal 1x per bucket 4 jam)
      FOR v_am IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        JOIN public.staff_outlets so ON so.staff_id = s.id
        WHERE so.outlet_id = v_sj.outlet_id
          AND s.role = 'area_manager'
          AND s.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          format('sj2h_am:%s:%s', v_sj.id::text, v_bucket_4h),
          v_am.id,
          '⏳ [SURAT JALAN BELUM DIVERIFIKASI] ' || v_sj.outlet_name,
          format(
            E'Surat Jalan pengiriman bahan ke cabang telah berstatus DIKIRIM selama %s Jam namun belum diverifikasi (diterima) oleh kru cabang.\nOutlet: %s\nNo. SJ: %s\n\nSegera hubungi Leader cabang untuk verifikasi fisik barang dan update status di aplikasi.',
            v_sj.jam_gantung::text,
            v_sj.outlet_name,
            v_sj.doc_no
          ),
          'bot'
        );
      END LOOP;

      -- 2. Eskalasi ke Bot CEO jika menggantung >= 3.5 jam ATAU sudah malam hari (>= 22:00 WIB)
      IF v_sj.jam_gantung >= 3.5 OR v_jam >= 22 THEN
        FOR v_ceo IN
          SELECT id FROM public.outlet_staff
          WHERE role IN ('owner', 'admin', 'developer')
            AND status = 'active'
        LOOP
          PERFORM public.bot_ceo_antrekan(
            format('sjgantung_ceo:%s:%s', v_sj.id::text, v_bucket_4h),
            v_ceo.id,
            '📦 <b>PERINGATAN DISTRIBUSI: SURAT JALAN MENGGANTUNG</b>',
            format(
              E'━━━━━━━━━━━━━━━━━━━━━\n' ||
              E'🏪 <b>Outlet Tujuan:</b> %s\n' ||
              E'📄 <b>No. Dokumen SJ:</b> <code>%s</code>\n' ||
              E'⏳ <b>Durasi Menggantung:</b> <code>%s Jam (Status: Dikirim)</code>\n' ||
              E'⏱️ <b>Waktu Evaluasi:</b> <code>%s WIB</code>\n\n' ||
              E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
              E'Pengiriman bahan baku Central Kitchen belum dikonfirmasi terima oleh outlet. Berisiko mengacaukan stok opname malam cabang.</blockquote>',
              public.bot_escape_html(v_sj.outlet_name),
              public.bot_escape_html(v_sj.doc_no),
              v_sj.jam_gantung::text,
              to_char(v_now_wib, 'HH24:MI')
            ),
            'https://admin.sukashawarma.com'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- 6C. Standarisasi bot_is_sales_outlet pada bot_manager_alert_stok_kritis
CREATE OR REPLACE FUNCTION public.bot_manager_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_satuan_besar text;
  v_satuan_tengah text;
  v_faktor_tengah numeric;
  v_satuan_kecil text;
  v_faktor_tampilan numeric;
  v_raw_threshold numeric;
  v_threshold numeric;
  v_outlet_name text;
  v_is_gram boolean;
  v_saldo_str text;
  v_threshold_str text;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
  v_am record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan,
         b.satuan_tengah,
         b.faktor_tengah,
         b.satuan_kecil,
         b.faktor_tampilan,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan, v_raw_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE;

  IF v_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_gram := public.saldo_is_gram(NEW);
  IF v_is_gram THEN
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_threshold := v_raw_threshold;
  END IF;

  IF NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  v_saldo_str := public.bot_format_stok_adaptive(
    NEW.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan
  );
  v_threshold_str := public.bot_format_stok_adaptive(
    v_threshold, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan
  );

  v_title := '⚠️ [STOK KRITIS] ' || v_item_name || ' — ' || COALESCE(v_outlet_name, 'Outlet');
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || v_item_name
    || E'\nSisa Stok: ' || v_saldo_str
    || E'\nBatas Reorder: ' || v_threshold_str
    || E'\nStatus: Berisiko kehabisan stok hari ini!'
    || E'\n\nSegera koordinasikan pengiriman darurat atau mutasi antar cabang.';

  FOR v_am IN
    SELECT so.staff_id
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'stok_kritis:' || NEW.outlet_id || ':' || NEW.bahan_baku_id || ':' || (now() AT TIME ZONE 'Asia/Jakarta')::date,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert stok kritis manager: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 6D. Standarisasi bot_is_sales_outlet pada trg_fn_bot_manager_stok_drop50
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_stok_drop50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outlet_name text;
  v_bahan_nama text;
  v_satuan_besar text;
  v_satuan_tengah text;
  v_faktor_tengah numeric;
  v_satuan_kecil text;
  v_faktor_tampilan numeric;
  v_raw_threshold numeric;
  v_threshold numeric;
  v_delta numeric;
  v_pct numeric;
  v_is_gram boolean;
  v_saldo_awal_str text;
  v_saldo_akhir_str text;
  v_penurunan_str text;
  v_tgl_wib text := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD');
  v_target record;
  v_ceo record;
BEGIN
  IF round(coalesce(OLD.saldo, 0), 2) <= 0 OR coalesce(NEW.saldo, 0) > (OLD.saldo * 0.5) THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name
  FROM public.outlets WHERE id = NEW.outlet_id;

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nama, 'Bahan Baku'),
         satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
         GREATEST(COALESCE(default_reorder_point, 10), 1)
  INTO v_bahan_nama, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan, v_raw_threshold
  FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;

  v_is_gram := public.saldo_is_gram(NEW);
  IF v_is_gram THEN
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_threshold := v_raw_threshold;
  END IF;

  v_delta := OLD.saldo - NEW.saldo;

  IF v_delta < GREATEST(v_threshold * 0.5, 1) THEN
    RETURN NEW;
  END IF;

  v_pct := round((v_delta / OLD.saldo) * 100, 0);
  IF v_pct > 100 THEN
    v_pct := 100;
  END IF;

  v_saldo_awal_str := public.bot_format_stok_adaptive(OLD.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan);
  v_saldo_akhir_str := public.bot_format_stok_adaptive(NEW.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan);
  v_penurunan_str := public.bot_format_delta_adaptive(v_delta, v_is_gram, v_satuan_besar, v_satuan_kecil, v_faktor_tampilan);

  -- A. Kirim ke AM & RM
  FOR v_target IN
    SELECT DISTINCT s.id, s.role
    FROM public.outlet_staff s
    LEFT JOIN public.staff_outlets so ON so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
    WHERE s.status = 'active'
      AND (
        s.role IN ('regional_manager', 'developer')
        OR (s.role = 'area_manager' AND so.outlet_id IS NOT NULL)
      )
  LOOP
    PERFORM public.bot_manager_antrekan(
      format('drop50_mgr:%s:%s:%s', v_tgl_wib, NEW.outlet_id::text, NEW.bahan_baku_id::text),
      v_target.id,
      format('🚨 [ANOMALI STOK -%s%%] %s (%s)', v_pct::text, v_bahan_nama, v_outlet_name),
      format(
        E'Peringatan penurunan stok drastis (>=50%%) dalam satu mutasi.\nOutlet: %s\nBahan: %s\nSaldo Sebelum: %s -> Saldo Sekarang: %s (-%s%%)\nPenurunan: %s\n\nSegera cek kesesuaian pemakaian produksi / potensi shrinkage di cabang.',
        v_outlet_name,
        v_bahan_nama,
        v_saldo_awal_str,
        v_saldo_akhir_str,
        v_pct::text,
        v_penurunan_str
      ),
      'bot'
    );
  END LOOP;

  -- B. Eskalasi ke Bot CEO (Owner / Admin / Developer)
  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      format('drop50_ceo:%s:%s:%s', v_tgl_wib, NEW.outlet_id::text, NEW.bahan_baku_id::text),
      v_ceo.id,
      format('🚨 [ANOMALI STOK -%s%%] %s (%s)', v_pct::text, v_bahan_nama, v_outlet_name),
      format(
        E'Deteksi penurunan stok drastis (>= 50%%) dalam satu mutasi di cabang.\nOutlet: %s\nBahan: %s\nSaldo Sebelum: %s -> Sekarang: %s (-%s%%)\nPenurunan: %s\n\nPotensi penyusutan atau salah input fisik cabang. Audit disarankan di Admin Dashboard.',
        v_outlet_name,
        v_bahan_nama,
        v_saldo_awal_str,
        v_saldo_akhir_str,
        v_pct::text,
        v_penurunan_str
      ),
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_stok_drop50 gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 6E. Standarisasi bot_is_sales_outlet pada bot_manager_alert_selisih_kas
CREATE OR REPLACE FUNCTION public.bot_manager_alert_selisih_kas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_laci_var numeric;
  v_petty_var numeric;
  v_max_var numeric;
  v_outlet_name text;
  v_staff_name text;
  v_title text;
  v_body text;
  v_url text;
  v_am record;
  v_rm record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  v_laci_var := COALESCE(NEW.variance, 0);
  v_petty_var := COALESCE(NEW.petty_cash_variance, 0);
  v_max_var := GREATEST(ABS(v_laci_var), ABS(v_petty_var));

  IF v_max_var <= 20000 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = COALESCE(NEW.closed_by, NEW.staff_id);

  v_title := CASE
    WHEN v_max_var > 100000 THEN '🚨 Alert Selisih Kas Kritis (> Rp 100rb)'
    ELSE '⚠️ Peringatan Selisih Kas Closing'
  END;

  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nKasir: ' || COALESCE(v_staff_name, '-')
    || E'\nWaktu Closing: ' || to_char(COALESCE(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB'
    || E'\nSelisih Laci: ' || CASE WHEN v_laci_var < 0 THEN '-Rp ' || to_char(abs(v_laci_var), 'FM999,999,999') ELSE '+Rp ' || to_char(v_laci_var, 'FM999,999,999') END
    || (CASE WHEN NEW.petty_cash_variance IS NOT NULL
        THEN E'\nSelisih Petty Cash: ' || CASE WHEN v_petty_var < 0 THEN '-Rp ' || to_char(abs(v_petty_var), 'FM999,999,999') ELSE '+Rp ' || to_char(v_petty_var, 'FM999,999,999') END
        ELSE '' END)
    || (CASE WHEN NEW.notes IS NOT NULL AND btrim(NEW.notes) <> ''
        THEN E'\nCatatan: ' || left(btrim(NEW.notes), 200)
        ELSE '' END);

  v_url := 'https://manager.sukashawarma.com/transactions';

  FOR v_am IN
    SELECT so.staff_id
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'selisih_kas:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  IF v_max_var > 100000 THEN
    FOR v_rm IN
      SELECT s.id AS staff_id
      FROM public.outlet_staff s
      WHERE s.role IN ('regional_manager', 'developer')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'selisih_kas_rm:' || NEW.id,
        v_rm.staff_id,
        '🚨 [ESKALASI REGIONAL] ' || v_title,
        v_body || E'\n\nPerhatian RM: Selisih kas melewati batas toleransi Rp 100.000.',
        v_url
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_alert_selisih_kas gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 6F. Standarisasi bot_is_sales_outlet pada bot_manager_alert_waste
CREATE OR REPLACE FUNCTION public.bot_manager_alert_waste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outlet_name text;
  v_bahan_nama text;
  v_bahan_satuan text;
  v_reporter_name text;
  v_harga numeric := 0;
  v_est_kerugian numeric := 0;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com/waste';
  v_am record;
  v_rm record;
BEGIN
  IF upper(coalesce(NEW.status, 'PENDING')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT nama, coalesce(satuan, 'Unit') INTO v_bahan_nama, v_bahan_satuan FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.reported_by;

  SELECT coalesce(harga_beli, 0) INTO v_harga
  FROM public.bahan_baku_harga
  WHERE bahan_baku_id = NEW.bahan_baku_id
  ORDER BY harga_updated_at DESC NULLS LAST LIMIT 1;

  v_est_kerugian := round(coalesce(NEW.qty, 0) * coalesce(v_harga, 0), 0);

  v_title := CASE
    WHEN v_est_kerugian > 150000 THEN '🚨 [ALERT WASTE] Bahan Bernilai Tinggi (> Rp 150rb)'
    ELSE '🗑️ Pengajuan Waste Bahan Baku — ' || coalesce(v_outlet_name, 'Outlet')
  END;

  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || COALESCE(v_bahan_nama, 'Bahan Baku') || ' (' || NEW.qty || ' ' || COALESCE(v_bahan_satuan, 'satuan') || ')'
    || (CASE WHEN v_est_kerugian > 0 THEN E'\nEst. Kerugian: Rp ' || to_char(v_est_kerugian, 'FM999,999,999') ELSE '' END)
    || E'\nAlasan: ' || left(coalesce(btrim(NEW.reason), '-'), 200)
    || E'\nPelapor: ' || COALESCE(v_reporter_name, 'Kru Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB';

  FOR v_am IN
    SELECT so.staff_id
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'waste_am:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  IF v_est_kerugian > 150000 THEN
    FOR v_rm IN
      SELECT s.id AS staff_id
      FROM public.outlet_staff s
      WHERE s.role IN ('regional_manager', 'developer')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'waste_rm:' || NEW.id,
        v_rm.staff_id,
        '🚨 [ESKALASI REGIONAL] ' || v_title,
        v_body || E'\n\nPerhatian RM: Estimasi kerugian bahan baku melebihi ambang batas toleransi Rp 150.000.',
        v_url
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_alert_waste gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 6G. Standarisasi bot_is_sales_outlet pada bot_manager_alert_retur_stok
CREATE OR REPLACE FUNCTION public.bot_manager_alert_retur_stok()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outlet_name text;
  v_reporter_name text;
  v_item_count int;
  v_sample_item text;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com/approvals';
  v_am record;
  v_rm record;
  v_ceo record;
BEGIN
  IF NEW.status <> 'diajukan' THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.created_by;

  SELECT count(*), max(b.nama)
  INTO v_item_count, v_sample_item
  FROM public.retur_stok_item ri
  JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
  WHERE ri.retur_stok_id = NEW.id;

  v_title := '🔄 Pengajuan Retur Bahan Baku';
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nNomor Retur: ' || NEW.nomor_retur
    || E'\nTipe: ' || CASE WHEN NEW.tipe_retur = 'inbound_sj' THEN 'Tolak saat Terima SJ' ELSE 'Chiller Outlet / Rusak' END
    || (CASE WHEN v_item_count > 0 THEN E'\nJumlah Item: ' || v_item_count || ' item (' || COALESCE(v_sample_item, '') || (CASE WHEN v_item_count > 1 THEN ' dll' ELSE '' END) || ')' ELSE '' END)
    || E'\nPelapor: ' || COALESCE(v_reporter_name, 'Kru Cabang')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB'
    || E'\n\nHarap verifikasi dan setujui sebelum kurir penjemputan berangkat!';

  FOR v_am IN
    SELECT so.staff_id
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'retur:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  FOR v_rm IN
    SELECT s.id AS staff_id
    FROM public.outlet_staff s
    WHERE s.role IN ('regional_manager', 'developer')
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'retur_rm:' || NEW.id,
      v_rm.staff_id,
      '📋 [INFO REGIONAL] ' || v_title,
      v_body,
      v_url
    );
  END LOOP;

  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      'retur_ceo:' || NEW.id,
      v_ceo.id,
      '🔄 [ALERT RETUR BAHAN] ' || COALESCE(v_outlet_name, 'Outlet'),
      v_body,
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert retur manager/ceo: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 6H. Standarisasi bot_is_sales_outlet pada trg_fn_bot_manager_void_order
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_void_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outlet_name text;
  v_void_count int := 1;
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_am record;
  v_rm record;
  v_amt numeric := coalesce(NEW.total_amount, 0);
  v_kasir_name text;
  v_alasan text;
  v_order_label text;
  v_waktu_str text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  IF (coalesce(NEW.void_at, NEW.created_at) AT TIME ZONE 'Asia/Jakarta')::date < v_tgl_wib THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.void_reason, '') ILIKE '%melewati batas waktu%'
     OR coalesce(NEW.void_reason, '') ILIKE '%otomatis batal%'
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%melewati batas waktu%'
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%otomatis batal%' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  SELECT count(*) INTO v_void_count
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (coalesce(void_at, updated_at, created_at) AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib;

  v_void_count := GREATEST(1, coalesce(v_void_count, 1));

  v_kasir_name := NULL;
  IF NEW.voided_by IS NOT NULL THEN
    SELECT s.name INTO v_kasir_name FROM public.outlet_staff s WHERE s.id = NEW.voided_by;
  END IF;
  IF v_kasir_name IS NULL OR v_kasir_name = '' THEN
    v_kasir_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');
  END IF;

  v_alasan := coalesce(nullif(btrim(NEW.void_reason), ''), nullif(btrim(NEW.cancellation_reason), ''), 'Tidak dicantumkan');
  v_order_label := '#' || coalesce(NEW.order_number::text, substr(NEW.id::text, 1, 8));
  v_waktu_str := to_char(coalesce(NEW.void_at, NEW.created_at) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB';

  FOR v_am IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    JOIN public.staff_outlets so ON so.staff_id = s.id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'void_am:' || NEW.id::text,
      v_am.id,
      '🛑 [ALERT VOID POS] Pembatalan Order ' || v_order_label || ' di ' || v_outlet_name,
      format(
        E'Transaksi POS dibatalkan (VOID/CANCELLED) di cabang binaan Anda.\nOutlet: %s\nNo. Order: %s\nNilai Order: Rp %s\nKasir: %s\nAlasan: %s\nTotal Void Hari Ini: %s transaksi\nWaktu Transaksi: %s\n\nSegera konfirmasi alasan pembatalan ke kasir/leader cabang.',
        v_outlet_name,
        v_order_label,
        to_char(v_amt, 'FM999,999,999'),
        v_kasir_name,
        v_alasan,
        v_void_count,
        v_waktu_str
      ),
      'bot'
    );
  END LOOP;

  IF v_amt >= 50000 OR v_void_count >= 2 THEN
    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'void_rm:' || NEW.id::text,
        v_rm.id,
        '🚨 [ESKALASI RM] Void Order Mencurigakan — ' || v_outlet_name,
        format(
          E'Deteksi pembatalan order (VOID) bernilai besar / beruntun di kasir POS.\nOutlet: %s\nNo. Order: %s\nNilai Void: Rp %s\nKasir: %s\nAlasan: %s\nFrekuensi Void Hari Ini: %sx di outlet ini\nWaktu Transaksi: %s\n\nMohon tinjau potensi anomali kasir bersama Area Manager.',
          v_outlet_name,
          v_order_label,
          to_char(v_amt, 'FM999,999,999'),
          v_kasir_name,
          v_alasan,
          v_void_count,
          v_waktu_str
        ),
        'bot'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_void_order gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 6I. Standarisasi bot_is_sales_outlet pada trg_fn_bot_manager_izin_mendadak
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_izin_mendadak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_staff_name text;
  v_outlet_id uuid;
  v_outlet_name text;
  v_jenis_izin text;
  v_am record;
  v_ceo record;
BEGIN
  IF v_tgl_wib < NEW.start_date OR v_tgl_wib > NEW.end_date THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.outlet_id, coalesce(o.name, 'Cabang SS')
  INTO v_staff_name, v_outlet_id, v_outlet_name
  FROM public.outlet_staff s
  LEFT JOIN public.outlets o ON o.id = s.outlet_id
  WHERE s.id = NEW.staff_id;

  IF v_outlet_id IS NULL OR NOT public.bot_is_sales_outlet(v_outlet_id) THEN
    RETURN NEW;
  END IF;

  v_jenis_izin := upper(coalesce(NEW.leave_type, NEW.type, 'IZIN'));

  FOR v_am IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    JOIN public.staff_outlets so ON so.staff_id = s.id
    WHERE so.outlet_id = v_outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'izin_h0_am:' || NEW.id::text,
      v_am.id,
      '👥 [OUTLET UNDERSTAFFED] Izin Mendadak Hari Ini — ' || v_outlet_name,
      format(
        E'Kru cabang binaan mengajukan %s mendadak untuk shift hari ini.\nOutlet: %s\nNama Kru: %s\nAlasan: %s\n\nPastikan ketersediaan personel shift mencukupi atau atur rolling bantuan dari cabang terdekat.',
        v_jenis_izin,
        v_outlet_name,
        coalesce(v_staff_name, 'Kru'),
        coalesce(NEW.reason, '-')
      ),
      'bot'
    );
  END LOOP;

  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      'izin_h0_ceo:' || NEW.id::text || ':' || v_ceo.id::text,
      v_ceo.id,
      '👥 [ESKALASI SDM] Izin Mendadak H-0 — ' || v_outlet_name,
      format(
        E'Kru cabang mengajukan %s mendadak untuk shift hari ini.\nOutlet: %s\nNama Kru: %s\nAlasan: %s\n\nPotensi cabang kekurangan tenaga operasional.',
        v_jenis_izin,
        v_outlet_name,
        coalesce(v_staff_name, 'Kru'),
        coalesce(NEW.reason, '-')
      ),
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_izin_mendadak gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Standarisasi bot_is_sales_outlet & Deferred Trigger pada Verifikasi SJ
--    (Mempertahankan 100% logika Kitchen + AM + RM + CEO dari 20300254010500)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_doc_no text;
  v_crew_name text;
  v_item_count int := 0;
  v_total_qty numeric := 0;
  v_duration_hours numeric;
  v_item_detail text := '';
  v_item_detail_html text := '';
  v_time_str text := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI');
  v_date_str text := to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY');
  v_am record;
  v_rm record;
  v_ceo record;
  v_kit record;
  v_item record;
  v_diff_count int := 0;
  v_body_am text;
  v_body_ceo text;
  v_kit_title text;
BEGIN
  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE;

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_doc_no := COALESCE(NULLIF(NEW.document_number, ''), left(NEW.id::text, 8));

  -- A. Saat status menjadi 'dikirim' / 'dikirim_lengkap': catat state & beritahu AM + Kitchen/Purchasing
  IF NEW.status IN ('dikirim', 'dikirim_lengkap') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.bot_telegram_sj_kitchen_alert_state AS existing (
        surat_jalan_id, dispatched_at, completion_alerted_at, last_reminded_at
      ) VALUES (NEW.id, NOW(), NULL, NULL)
      ON CONFLICT (surat_jalan_id) DO UPDATE
        SET dispatched_at = EXCLUDED.dispatched_at,
            completion_alerted_at = NULL,
            last_reminded_at = NULL;

      SELECT count(*) INTO v_item_count
      FROM public.surat_jalan_item
      WHERE surat_jalan_id = NEW.id;

      -- 1. Beritahu Area Manager pembina outlet (tg_am_sj_kirim)
      FOR v_am IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        JOIN public.staff_outlets so ON so.staff_id = s.id
        WHERE so.outlet_id = NEW.outlet_id
          AND s.role = 'area_manager'
          AND s.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          format('sj_kirim_am:%s:%s', NEW.id::text, v_am.id::text),
          v_am.id,
          '🚚 [DISTRIBUSI BERANGKAT] ' || v_outlet_name,
          format(
            E'Armada logistik telah memberangkatkan Surat Jalan menuju cabang binaan Anda.\nOutlet: %s\nNo. SJ: %s\nWaktu Kirim: %s WIB (%s)\nJumlah Item: %s item bahan baku\n\nPastikan kru outlet siap melakukan pengecekan & timbang terima saat barang tiba.',
            v_outlet_name,
            v_doc_no,
            v_time_str,
            v_date_str,
            v_item_count::text
          ),
          'bot'
        );
      END LOOP;

      -- 2. Beritahu Kitchen & Purchasing (tg_stok_verifikasi_sj)
      FOR v_kit IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        WHERE s.role IN ('kitchen', 'purchasing')
          AND s.status = 'active'
      LOOP
        PERFORM public.bot_telegram_kirim_alert(
          v_kit.id,
          'distribusi',
          '🚚 Surat jalan diberangkatkan · ' || v_outlet_name,
          'SJ: ' || v_doc_no
            || E'\nTujuan: ' || v_outlet_name
            || E'\nWaktu Kirim: ' || v_time_str || ' WIB (' || v_date_str || ')'
            || (CASE WHEN v_item_count > 0 THEN E'\nMuatan: ' || v_item_count || ' baris bahan baku' ELSE '' END)
            || E'\nStatus: Menunggu verifikasi penerimaan oleh kru outlet.',
          'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
          NEW.outlet_id,
          'sj_dikirim:' || NEW.id::text
        );
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  -- B. Hanya proses alert penyelesaian saat transisi menuju 'diterima_lengkap' atau 'diterima_sebagian'
  IF NEW.status NOT IN ('diterima_lengkap', 'diterima_sebagian')
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT NULL AND OLD.status IN ('diterima_lengkap', 'diterima_sebagian')) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bot_telegram_sj_kitchen_alert_state (
    surat_jalan_id, dispatched_at, completion_alerted_at
  ) VALUES (
    NEW.id, COALESCE(NEW.created_at, NOW()), NOW()
  )
  ON CONFLICT (surat_jalan_id) DO UPDATE
    SET completion_alerted_at = COALESCE(public.bot_telegram_sj_kitchen_alert_state.completion_alerted_at, NOW());

  IF NEW.auto_verified_at IS NOT NULL THEN
    v_crew_name := 'Sistem (Auto-Verifikasi Lewat Hari)';
  ELSE
    SELECT s.name INTO v_crew_name
    FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role IN ('crew', 'leader', 'kiosk')
      AND (s.outlet_id = NEW.outlet_id OR EXISTS (
        SELECT 1 FROM public.staff_outlets so
        WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
      ));

    IF NULLIF(btrim(v_crew_name), '') IS NULL THEN
      SELECT NULLIF(btrim(sig.value->>'signed_by'), '') INTO v_crew_name
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(NEW.receipt_signatures) = 'array'
          THEN NEW.receipt_signatures ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS sig(value, position)
      WHERE sig.value->>'role' = 'Crew Penerima'
      ORDER BY sig.position DESC LIMIT 1;
    END IF;

    IF NULLIF(btrim(v_crew_name), '') IS NULL THEN
      v_crew_name := 'Kru Cabang';
    END IF;
  END IF;

  SELECT count(*), coalesce(sum(qty_terima), 0)
  INTO v_item_count, v_total_qty
  FROM public.surat_jalan_item
  WHERE surat_jalan_id = NEW.id;

  v_duration_hours := round(extract(epoch FROM (NOW() - COALESCE(NEW.created_at, NOW()))) / 3600.0, 1);

  -- KASUS 1: DITERIMA LENGKAP
  IF NEW.status = 'diterima_lengkap' THEN
    v_kit_title := CASE
      WHEN NEW.auto_verified_at IS NOT NULL THEN '⚠️ SJ ditutup otomatis (Auto-Verifikasi) · ' || v_outlet_name
      ELSE '✅ Crew selesai verifikasi · ' || v_outlet_name
    END;

    v_body_am := format(
      E'Pengiriman bahan baku Central Kitchen telah selesai diverifikasi & diterima lengkap oleh cabang.\nOutlet: %s\nNo. SJ: %s\nPenerima: %s\nWaktu: %s WIB (%s)\nStatus: ✅ 100%% Sesuai & Baik (%s Item Bahan Baku)\nDurasi Perjalanan: %s Jam\n\nStok otomatis masuk ke inventori cabang dan siap digunakan untuk operasional.',
      v_outlet_name,
      v_doc_no,
      v_crew_name,
      v_time_str,
      v_date_str,
      v_item_count::text,
      v_duration_hours::text
    );

    v_body_ceo := format(
      E'━━━━━━━━━━━━━━━━━━━━━\n' ||
      E'🏪 <b>Outlet:</b> %s\n' ||
      E'📄 <b>No. Dokumen SJ:</b> <code>%s</code>\n' ||
      E'👤 <b>Kru Penerima:</b> %s\n' ||
      E'⏱️ <b>Waktu Verifikasi:</b> <code>%s WIB (%s)</code>\n' ||
      E'📦 <b>Hasil Pengecekan:</b> <code>%s Item Bahan Baku (100%% Sesuai)</code>\n' ||
      E'🚚 <b>Durasi Perjalanan:</b> <code>%s Jam</code>\n\n' ||
      E'<blockquote>💡 <b>Atensi Direksi:</b>\n' ||
      E'Barang inventori dari Central Kitchen telah diverifikasi lengkap dan resmi masuk ke saldo stok fisik cabang.</blockquote>',
      public.bot_escape_html(v_outlet_name),
      public.bot_escape_html(v_doc_no),
      public.bot_escape_html(v_crew_name),
      v_time_str,
      v_date_str,
      v_item_count::text,
      v_duration_hours::text
    );

    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_verif_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '✅ [DISTRIBUSI SELESAI] ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_verif_rm:%s:%s', NEW.id::text, v_rm.id::text),
        v_rm.id,
        '✅ [DISTRIBUSI SELESAI] ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('sj_verif_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '✅ <b>DISTRIBUSI SELESAI: SURAT JALAN DITERIMA LENGKAP</b>',
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    FOR v_kit IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      WHERE s.role IN ('kitchen', 'purchasing')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_telegram_kirim_alert(
        v_kit.id,
        'distribusi',
        v_kit_title,
        'SJ: ' || v_doc_no || E'\nCrew: ' || left(v_crew_name, 120)
          || E'\nWaktu: ' || v_time_str || ' WIB'
          || E'\nHasil: ' || v_item_count || ' baris bahan diterima lengkap dan sesuai.'
          || E'\nStok outlet telah diperbarui otomatis.',
        'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
        NEW.outlet_id,
        'sj_verif_lengkap:' || NEW.id::text
      );
    END LOOP;

  -- KASUS 2: DITERIMA SEBAGIAN
  ELSIF NEW.status = 'diterima_sebagian' THEN
    FOR v_item IN
      SELECT
        bb.nama AS bahan_nama,
        bb.satuan,
        sji.qty_dikirim,
        sji.qty_terima,
        coalesce(sji.selisih, (sji.qty_terima - sji.qty_dikirim)) AS selisih_qty,
        nullif(btrim(sji.catatan), '') AS item_catatan
      FROM public.surat_jalan_item sji
      JOIN public.bahan_baku bb ON bb.id = sji.bahan_baku_id
      WHERE sji.surat_jalan_id = NEW.id
        AND (sji.flagged IS TRUE OR coalesce(sji.selisih, 0) <> 0 OR sji.qty_terima < sji.qty_dikirim)
      ORDER BY abs(coalesce(sji.selisih, (sji.qty_terima - sji.qty_dikirim))) DESC
    LOOP
      v_diff_count := v_diff_count + 1;
      IF v_diff_count <= 4 THEN
        v_item_detail := v_item_detail || format(
          E'\n• %s: Kirim %s %s, Diterima %s %s (Selisih: %s %s)%s',
          v_item.bahan_nama,
          trim_scale(v_item.qty_dikirim)::text,
          coalesce(v_item.satuan, ''),
          trim_scale(v_item.qty_terima)::text,
          coalesce(v_item.satuan, ''),
          case when v_item.selisih_qty > 0 then '+' else '' end || trim_scale(v_item.selisih_qty)::text,
          coalesce(v_item.satuan, ''),
          case when v_item.item_catatan is not null then ' — Catatan: "' || v_item.item_catatan || '"' else '' end
        );
        v_item_detail_html := v_item_detail_html || format(
          E'\n• <b>%s</b>: Kirim <code>%s %s</code>, Diterima <code>%s %s</code> (<b>Selisih:</b> <code>%s %s</code>)%s',
          public.bot_escape_html(v_item.bahan_nama),
          trim_scale(v_item.qty_dikirim)::text,
          public.bot_escape_html(coalesce(v_item.satuan, '')),
          trim_scale(v_item.qty_terima)::text,
          public.bot_escape_html(coalesce(v_item.satuan, '')),
          case when v_item.selisih_qty > 0 then '+' else '' end || trim_scale(v_item.selisih_qty)::text,
          public.bot_escape_html(coalesce(v_item.satuan, '')),
          case when v_item.item_catatan is not null then ' — <i>"' || public.bot_escape_html(v_item.item_catatan) || '"</i>' else '' end
        );
      END IF;
    END LOOP;

    IF v_diff_count > 4 THEN
      v_item_detail := v_item_detail || format(E'\n• (+%s item selisih lainnya...)', v_diff_count - 4);
      v_item_detail_html := v_item_detail_html || format(E'\n• <i>(+%s item selisih lainnya...)</i>', v_diff_count - 4);
    END IF;

    IF v_item_detail = '' THEN
      v_item_detail := E'\n(Item berstatus selisih fisik belum diperinci)';
      v_item_detail_html := E'\n<i>(Item berstatus selisih fisik belum diperinci)</i>';
    END IF;

    v_body_am := format(
      E'Penerimaan logistik di cabang binaan Anda dilaporkan ada SELISIH FISIK / BARANG KURANG.\nOutlet: %s\nNo. SJ: %s\nPenerima: %s\nWaktu: %s WIB (%s)\n\nRincian Item Selisih:%s\n\nSegera hubungi Leader cabang dan koordinasikan rekonsiliasi stok dengan Kitchen.',
      v_outlet_name,
      v_doc_no,
      v_crew_name,
      v_time_str,
      v_date_str,
      v_item_detail
    );

    v_body_ceo := format(
      E'━━━━━━━━━━━━━━━━━━━━━\n' ||
      E'🏪 <b>Outlet:</b> %s\n' ||
      E'📄 <b>No. Dokumen SJ:</b> <code>%s</code>\n' ||
      E'👤 <b>Kru Penerima:</b> %s\n' ||
      E'⏱️ <b>Waktu Verifikasi:</b> <code>%s WIB (%s)</code>\n\n' ||
      E'🔍 <b>Rincian Item Selisih:</b>%s\n\n' ||
      E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
      E'Terdapat selisih fisik antara muatan Central Kitchen dan penerimaan gerai. Lakukan audit pengiriman armada / timbangan outlet untuk mencegah kebocoran logistik.</blockquote>',
      public.bot_escape_html(v_outlet_name),
      public.bot_escape_html(v_doc_no),
      public.bot_escape_html(v_crew_name),
      v_time_str,
      v_date_str,
      v_item_detail_html
    );

    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_selisih_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '⚠️ [SELISIH DISTRIBUSI] ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj_selisih_rm:%s:%s', NEW.id::text, v_rm.id::text),
        v_rm.id,
        '🚨 [ESKALASI RM] Selisih Logistik — ' || v_outlet_name,
        v_body_am,
        'bot'
      );
    END LOOP;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('sj_selisih_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '⚠️ <b>PERINGATAN DISTRIBUSI: SELISIH PENERIMAAN SURAT JALAN</b>',
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    FOR v_kit IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      WHERE s.role IN ('kitchen', 'purchasing')
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_telegram_kirim_alert(
        v_kit.id,
        'distribusi',
        '⚠️ Selisih penerimaan SJ · ' || v_outlet_name,
        'SJ: ' || v_doc_no || E'\nCrew: ' || left(v_crew_name, 120)
          || E'\nWaktu: ' || v_time_str || ' WIB'
          || E'\nRincian Selisih:' || left(v_item_detail, 400)
          || E'\nMohon investigasi dan sesuaikan penyesuaian stok jika diperlukan.',
        'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
        NEW.outlet_id,
        'sj_verif_selisih:' || NEW.id::text
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_verifikasi_surat_jalan gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan() FROM PUBLIC, anon, authenticated;

-- Ubah trigger trg_bot_telegram_verifikasi_surat_jalan menjadi CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED
-- agar saat INSERT surat_jalan dengan status 'dikirim', rincian surat_jalan_item sudah masuk sebelum v_item_count dihitung.
DROP TRIGGER IF EXISTS trg_bot_telegram_verifikasi_surat_jalan ON public.surat_jalan;
CREATE CONSTRAINT TRIGGER trg_bot_telegram_verifikasi_surat_jalan
  AFTER INSERT OR UPDATE OF status ON public.surat_jalan
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan();
