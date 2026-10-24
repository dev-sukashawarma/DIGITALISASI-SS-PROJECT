-- Migration: 20300254010100_permanis_format_telegram_ceo_bot.sql
-- Standarisasi Format Visual Eksekutif Pesan Notifikasi Bot CEO (@Agent_SukaShawarma_Bot / J.A.R.V.I.S.)
-- 1. Helper bot_escape_html, bot_format_rupiah, bot_format_angka
-- 2. Buffer outbox bot_ceo_antrekan (up to 3800 karakter & pembersihan tag untuk Superapp push)
-- 3. bot_ceo_kirim_antrean (perapian spacing divider)
-- 4. Formatting ulang seluruh Warning Trigger & Cron Job Eksekutif Bot CEO

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Helper Escaping & Formatting Telegram HTML
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

-- ─────────────────────────────────────────────────────────── 2. Update bot_ceo_antrekan (Kapasitas Buffer & Bersih Push HP)
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
  -- A. Jalur Notifikasi HP Native (SUKA Superapp) - hapus tag HTML agar bersih di mobile notification tray
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

  -- B. Jalur Telegram Bot CEO (Pastikan HTTPS valid)
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

-- ─────────────────────────────────────────────────────────── 3. Worker Pengiriman Outbox Bot CEO (Spacing Divider Presisi)
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

  -- 1. Ambil token bot CEO langsung dari public.hermes_bot_registry
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

    -- Pasang divider rapi tepat di bawah title tanpa jeda baris kosong berlebih
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

-- ─────────────────────────────────────────────────────────── 4. VOID ORDER POS BERISIKO TINGGI
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_void_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric := coalesce(NEW.total_amount, 0);
  v_void_count int := 1;
  v_outlet_name text;
  v_cashier_name text;
  v_order_no text;
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_ceo record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  SELECT count(*) INTO v_void_count
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib;

  v_cashier_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');
  v_order_no := coalesce(nullif(btrim(NEW.order_number), ''), left(NEW.id::text, 8));

  IF v_amt >= 50000 OR v_void_count >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('void_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🛑 <b>ESKALASI VOID POS BERISIKO TINGGI</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'💰 <b>Nilai Void:</b> <code>%s</code>\n' ||
          E'🔢 <b>No. Order:</b> <code>#%s</code>\n' ||
          E'👤 <b>Kasir:</b> %s\n' ||
          E'⏱️ <b>Waktu Transaksi:</b> <code>%s WIB</code>\n' ||
          E'📊 <b>Frekuensi Void Hari Ini:</b> <code>%sx</code> di outlet ini\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Pembatalan transaksi bernilai tinggi atau beruntun berpotensi manipulasi kasir atau kelalaian operasional. Segera konfirmasi ke Kasir & CCTV cabang.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_format_rupiah(v_amt),
          public.bot_escape_html(v_order_no),
          public.bot_escape_html(v_cashier_name),
          to_char(coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          v_void_count::text
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_void_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. SELISIH KAS CLOSING SHIFT
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_selisih_kas_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laci_var numeric;
  v_petty_var numeric;
  v_max_var numeric;
  v_outlet_name text;
  v_staff_name text;
  v_ceo record;
  v_petty_str text := '';
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  v_laci_var := COALESCE(NEW.variance, 0);
  v_petty_var := COALESCE(NEW.petty_cash_variance, 0);
  v_max_var := GREATEST(ABS(v_laci_var), ABS(v_petty_var));

  IF v_max_var > 100000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
    SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = COALESCE(NEW.closed_by, NEW.staff_id);

    IF NEW.petty_cash_variance IS NOT NULL THEN
      v_petty_str := format(E'\n💵 <b>Selisih Kas Kecil:</b> <code>%s</code>', public.bot_format_rupiah(v_petty_var));
    END IF;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('selisih_kas_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 <b>ESKALASI SELISIH KAS CLOSING SHIFT</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'👤 <b>Kasir / Staf:</b> %s\n' ||
          E'💵 <b>Selisih Laci Kas:</b> <code>%s</code>%s\n' ||
          E'⏱️ <b>Waktu Closing:</b> <code>%s WIB</code>\n' ||
          E'📝 <b>Catatan Kasir:</b> <i>%s</i>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Selisih kas fisik laci melewati batas toleransi Rp 100.000. Audit rekonsiliasi dan verifikasi amplop setoran tunai segera.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(coalesce(v_staff_name, 'Kasir')),
          public.bot_format_rupiah(v_laci_var),
          v_petty_str,
          to_char(COALESCE(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          public.bot_escape_html(coalesce(nullif(btrim(NEW.notes), ''), 'Tidak ada catatan'))
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_selisih_kas_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 6. WASTE BAHAN BAKU KRITIS (> RP 150.000)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_waste_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_harga numeric := 0;
  v_est_kerugian numeric := 0;
  v_outlet_name text;
  v_bahan_name text;
  v_satuan text;
  v_ceo record;
BEGIN
  IF upper(coalesce(NEW.status, 'PENDING')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(h.harga_beli, 0), b.nama, coalesce(b.satuan, 'porsi')
  INTO v_harga, v_bahan_name, v_satuan
  FROM public.bahan_baku b
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
  WHERE b.id = NEW.bahan_baku_id;

  v_est_kerugian := coalesce(NEW.qty, 0) * coalesce(v_harga, 0);

  IF v_est_kerugian > 150000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('waste_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🥩 <b>ESKALASI LAPORAN WASTE BAHAN BAKU</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'📦 <b>Bahan Baku:</b> <b>%s</b>\n' ||
          E'⚖️ <b>Kuantiti:</b> <code>%s %s</code>\n' ||
          E'💸 <b>Estimasi Kerugian:</b> <code>%s</code>\n' ||
          E'⏱️ <b>Waktu Lapor:</b> <code>%s WIB</code>\n' ||
          E'📝 <b>Alasan:</b> <i>%s</i>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Estimasi kerugian waste melampaui batas toleransi Rp 150.000. Periksa penyebab pembusukan, kelalaian defrosting, atau kesalahan porsi resep.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(coalesce(v_bahan_name, 'Bahan Baku')),
          public.bot_format_angka(NEW.qty),
          public.bot_escape_html(v_satuan),
          public.bot_format_rupiah(v_est_kerugian),
          to_char(coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          public.bot_escape_html(coalesce(NEW.reason, '-'))
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_waste_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 7. UPDATE STOK OPNAME HARIAN (FINALIZE)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_opname_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_today date := coalesce(NEW.tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_out record;
  v_sudah text[] := '{}';
  v_draft text[] := '{}';
  v_belum text[] := '{}';
  v_sudah_count int;
  v_draft_count int;
  v_belum_count int;
  v_total int;
  v_pct numeric := 0;
  v_status_detail text := '';
  v_ceo record;
BEGIN
  IF NEW.status <> 'finalized' THEN
    RETURN NEW;
  END IF;

  IF NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;

  FOR v_out IN
    SELECT o.id, o.name,
           (
             SELECT op.status
             FROM public.opname op
             WHERE op.outlet_id = o.id
               AND op.tanggal = v_today
             ORDER BY (op.status = 'finalized') DESC, op.updated_at DESC NULLS LAST
             LIMIT 1
           ) AS opname_status
    FROM public.outlets o
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
    ORDER BY o.name
  LOOP
    IF v_out.id = NEW.outlet_id OR v_out.opname_status = 'finalized' THEN
      v_sudah := array_append(v_sudah, v_out.name);
    ELSIF v_out.opname_status = 'draft' THEN
      v_draft := array_append(v_draft, v_out.name);
    ELSE
      v_belum := array_append(v_belum, v_out.name);
    END IF;
  END LOOP;

  v_sudah_count := coalesce(cardinality(v_sudah), 0);
  v_draft_count := coalesce(cardinality(v_draft), 0);
  v_belum_count := coalesce(cardinality(v_belum), 0);
  v_total := v_sudah_count + v_draft_count + v_belum_count;

  IF v_total > 0 THEN
    v_pct := round((v_sudah_count::numeric / v_total::numeric) * 100, 0);
  END IF;

  IF v_draft_count > 0 THEN
    v_status_detail := v_status_detail || E'\n⏳ <b>Masih Draft (' || v_draft_count || E' Cabang):</b>\n• ' || array_to_string(v_draft, E'\n• ');
  END IF;

  IF v_belum_count > 0 THEN
    v_status_detail := v_status_detail || E'\n🚨 <b>Belum Opname (' || v_belum_count || E' Cabang):</b>\n• ' || array_to_string(v_belum, E'\n• ');
  ELSE
    v_status_detail := v_status_detail || E'\n🎉 <i>Seluruh cabang operasional telah menyelesaikan Stok Opname hari ini!</i>';
  END IF;

  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      format('opname_fin_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
      v_ceo.id,
      '📦 <b>UPDATE STOK OPNAME HARIAN</b>',
      format(
        E'━━━━━━━━━━━━━━━━━━━━━\n' ||
        E'🏪 <b>Cabang Finalize:</b> <b>%s</b>\n' ||
        E'⏱️ <b>Waktu Selesai:</b> <code>%s WIB</code>\n' ||
        E'📊 <b>Progress Jaringan:</b> <code>%s / %s Cabang Selesai (%s%%)</code>\n' ||
        E'%s\n\n' ||
        E'<blockquote>💡 <b>Atensi Direksi:</b>\n' ||
        E'Data saldo fisik telah disinkronkan ke sistem inventori live untuk perhitungan HPP harian.</blockquote>',
        public.bot_escape_html(v_outlet_name),
        to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
        v_sudah_count::text,
        v_total::text,
        v_pct::text,
        v_status_detail
      ),
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_opname_finalized gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 8. SHIFT KASIR BELUM CLOSING LEWAT OPERASIONAL (23:45 WIB)
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_unclosed_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_tgl_wib date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_shift record;
  v_staff_name text;
  v_total_orders int;
  v_total_cash numeric;
  v_ceo record;
BEGIN
  IF v_jam < 23 AND v_jam > 4 THEN
    RETURN;
  END IF;

  FOR v_shift IN
    SELECT s.id, s.outlet_id, s.staff_id, s.start_time,
           coalesce(o.name, 'Cabang SS') AS outlet_name,
           round(extract(epoch FROM (now() - s.start_time)) / 3600.0, 1) AS jam_aktif
    FROM public.shifts s
    JOIN public.outlets o ON o.id = s.outlet_id
    WHERE s.status = 'open'
      AND public.bot_is_sales_outlet(s.outlet_id)
      AND NOT public.bot_is_outlet_tutup_sementara(s.outlet_id)
      AND s.start_time < (now() - interval '6 hours')
  LOOP
    SELECT coalesce(name, 'Kasir Cabang') INTO v_staff_name
    FROM public.outlet_staff WHERE id = v_shift.staff_id;

    SELECT count(*), coalesce(sum(CASE WHEN lower(payment_method) = 'cash' THEN total_amount ELSE 0 END), 0)
    INTO v_total_orders, v_total_cash
    FROM public.orders
    WHERE outlet_id = v_shift.outlet_id
      AND status <> 'cancelled'
      AND created_at >= v_shift.start_time;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('unclosed_shift_ceo:%s:%s', v_shift.id::text, v_tgl_wib::text),
        v_ceo.id,
        '⏳ <b>PERINGATAN SHIFT KASIR BELUM CLOSING</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'👤 <b>Kasir Bertugas:</b> %s\n' ||
          E'⏱️ <b>Durasi Shift Terbuka:</b> <code>%s Jam</code>\n' ||
          E'🧾 <b>Transaksi Tercatat:</b> <code>%s Order</code>\n' ||
          E'💰 <b>Akumulasi Kas Fisik:</b> <code>%s</code>\n' ||
          E'🌙 <b>Waktu Audit:</b> <code>%s WIB</code>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Shift kasir masih aktif melewati jam operasional malam. Uang fisik di laci berisiko tercecer atau hilang. Instruksikan closing dan hitung kas laci segera.</blockquote>',
          public.bot_escape_html(v_shift.outlet_name),
          public.bot_escape_html(coalesce(v_staff_name, 'Kasir')),
          v_shift.jam_aktif::text,
          coalesce(v_total_orders, 0)::text,
          public.bot_format_rupiah(coalesce(v_total_cash, 0)),
          to_char(v_now_wib, 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 9. ANOMALI RASIO UANG TUNAI CLOSING SHIFT
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_cash_ratio_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_staff_name text;
  v_total_orders int := 0;
  v_total_cash numeric := 0;
  v_total_cashless numeric := 0;
  v_total_omzet numeric := 0;
  v_cash_pct numeric := 0;
  v_cashless_pct numeric := 0;
  v_ceo record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets WHERE id = NEW.outlet_id;

  SELECT coalesce(name, 'Kasir') INTO v_staff_name
  FROM public.outlet_staff WHERE id = coalesce(NEW.closed_by, NEW.staff_id);

  SELECT 
    count(*),
    coalesce(sum(CASE WHEN lower(payment_method) = 'cash' THEN total_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN lower(payment_method) IN ('qris', 'card', 'edc', 'transfer') THEN total_amount ELSE 0 END), 0),
    coalesce(sum(total_amount), 0)
  INTO v_total_orders, v_total_cash, v_total_cashless, v_total_omzet
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status <> 'cancelled'
    AND created_at >= NEW.start_time
    AND created_at <= coalesce(NEW.end_time, now());

  IF v_total_orders >= 12 AND v_total_omzet >= 1000000 THEN
    v_cash_pct := round((v_total_cash / v_total_omzet) * 100, 1);
    v_cashless_pct := round(100.0 - v_cash_pct, 1);

    IF v_cash_pct >= 85.0 THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('cash_ratio_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
          v_ceo.id,
          '⚠️ <b>ANOMALI RASIO PEMBAYARAN TUNAI</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'👤 <b>Kasir:</b> %s\n' ||
            E'💰 <b>Total Omzet:</b> <code>%s</code> (<code>%s Order</code>)\n' ||
            E'💵 <b>Porsi Tunai:</b> <code>%s</code> (<code>%s%%</code>)\n' ||
            E'💳 <b>Porsi Non-Tunai / QRIS:</b> <code>%s</code> (<code>%s%%</code>)\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Rasio transaksi tunai menyentuh persentase ekstrem tidak lazim dibandingkan pola histori cabang. Lakukan sampling struk fisik dan cross-check dengan mutasi QRIS/EDC.</blockquote>',
            public.bot_escape_html(v_outlet_name),
            public.bot_escape_html(v_staff_name),
            public.bot_format_rupiah(v_total_omzet),
            v_total_orders::text,
            public.bot_format_rupiah(v_total_cash),
            v_cash_pct::text,
            public.bot_format_rupiah(v_total_cashless),
            v_cashless_pct::text
          ),
          'https://admin.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_cash_ratio_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 10. VOUCHER / PROMO ABUSE POS
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_voucher_abuse_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_outlet_name text;
  v_voucher_count int := 0;
  v_total_discount numeric := 0;
  v_kasir_name text;
  v_promo_name text;
  v_order_no text;
  v_ceo record;
BEGIN
  IF NEW.status = 'cancelled' OR coalesce(NEW.discount_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  IF (coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date < v_tgl_wib THEN
    RETURN NEW;
  END IF;

  SELECT count(*), coalesce(sum(discount_amount), 0)
  INTO v_voucher_count, v_total_discount
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status <> 'cancelled'
    AND coalesce(discount_amount, 0) > 0
    AND created_at >= (now() - interval '2 hours');

  IF v_voucher_count >= 10 OR v_total_discount >= 250000 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    v_kasir_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');
    v_promo_name := coalesce(nullif(btrim(NEW.promo_code), ''), nullif(btrim(NEW.discount_reason), ''), 'Diskon Kasir');
    v_order_no := coalesce(nullif(btrim(NEW.order_number), ''), left(NEW.id::text, 8));

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('voucher_abuse_ceo:%s:%s', v_tgl_wib::text, NEW.outlet_id::text),
        v_ceo.id,
        '🎟️ <b>ESKALASI INDIKASI ABUSE PROMO / VOUCHER</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'🎟️ <b>Kode / Promo:</b> <b>%s</b>\n' ||
          E'💸 <b>Total Diskon (2 Jam):</b> <code>%s</code> (<code>%sx Order</code>)\n' ||
          E'🔢 <b>Order Terakhir:</b> <code>#%s</code>\n' ||
          E'👤 <b>Kasir:</b> %s\n' ||
          E'⏱️ <b>Waktu:</b> <code>%s WIB</code>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Diskon melebihi ambang batas kewajaran atau frekuensi penggunaan berulang di kasir yang sama. Waspadai pemotongan tagihan konsumen sepihak untuk mengambil selisih tunai.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(v_promo_name),
          public.bot_format_rupiah(v_total_discount),
          v_voucher_count::text,
          public.bot_escape_html(v_order_no),
          public.bot_escape_html(v_kasir_name),
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_voucher_abuse_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 11. REJECT ORDER APLIKASI RETAIL ONLINE
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_retail_store_reject_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_outlet_name text;
  v_reject_count int := 0;
  v_lost_omzet numeric := 0;
  v_alasan text;
  v_platform text;
  v_ceo record;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF coalesce(lower(NEW.source), '') NOT IN ('app', 'online', 'website') 
     AND coalesce(lower(NEW.channel), '') NOT IN ('app', 'online', 'website') THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.void_reason, '') ILIKE '%melewati batas waktu%' 
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%melewati batas waktu%' THEN
    RETURN NEW;
  END IF;

  SELECT count(*), coalesce(sum(total_amount), 0)
  INTO v_reject_count, v_lost_omzet
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (coalesce(lower(source), '') IN ('app', 'online', 'website') OR coalesce(lower(channel), '') IN ('app', 'online', 'website'))
    AND (coalesce(void_at, updated_at, created_at) >= now() - interval '2 hours');

  IF v_reject_count >= 3 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    v_alasan := coalesce(nullif(btrim(NEW.void_reason), ''), nullif(btrim(NEW.cancellation_reason), ''), 'Dibatalkan oleh kru toko');
    v_platform := upper(coalesce(nullif(btrim(NEW.channel), ''), nullif(btrim(NEW.source), ''), 'Retail App'));

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('retail_reject_ceo:%s:%s', v_tgl_wib::text, NEW.outlet_id::text),
        v_ceo.id,
        '📱 <b>ESKALASI PENOLAKAN ORDER ONLINE CABANG</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'🛵 <b>Platform:</b> <b>%s</b>\n' ||
          E'💰 <b>Omzet Terlewat:</b> <code>%s</code> (<code>%s Order Ditolak</code>)\n' ||
          E'⏱️ <b>Waktu:</b> <code>%s WIB</code>\n' ||
          E'📝 <b>Alasan:</b> <i>%s</i>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Pembatalan order online menurunkan rating merchant dan menghilangkan potensi omzet. Audit kesiapan kru dan ketersediaan stok gerai.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(v_platform),
          public.bot_format_rupiah(v_lost_omzet),
          v_reject_count::text,
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          public.bot_escape_html(v_alasan)
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_retail_store_reject_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 12. ZERO SALES PRIME TIME (19:30 WIB) & SJ GANTUNG
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
  v_out record;
  v_sj record;
  v_am record;
  v_rm record;
  v_ceo record;
BEGIN
  IF v_jam >= 17 THEN
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

  FOR v_sj IN
    SELECT sj.id,
           coalesce(sj.document_number, substr(sj.id::text, 1, 8)) AS doc_no,
           sj.outlet_id,
           coalesce(o.name, 'Cabang SS') AS outlet_name,
           round(extract(epoch FROM (now() - coalesce(sj.updated_at, sj.created_at))) / 3600.0, 1) AS jam_gantung
    FROM public.surat_jalan sj
    JOIN public.outlets o ON o.id = sj.outlet_id
    WHERE sj.status = 'dikirim'
      AND coalesce(sj.updated_at, sj.created_at) < (now() - interval '2 hours')
      AND public.bot_is_sales_outlet(o.id)
  LOOP
    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = v_sj.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('sj2h_am:%s:%s', v_sj.id::text, to_char(v_now_wib, 'YYYY-MM-DD-HH24')),
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
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 13. CUT-OFF OPNAME MALAM (23:15 WIB)
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_opname_terlambat_malam()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_out record;
  v_belum text[] := '{}';
  v_belum_count int := 0;
  v_total_outlet int := 0;
  v_selesai_count int := 0;
  v_pct numeric := 0;
  v_ceo record;
BEGIN
  SELECT count(*) INTO v_total_outlet
  FROM public.outlets o
  WHERE public.bot_is_sales_outlet(o.id)
    AND NOT public.bot_is_outlet_tutup_sementara(o.id);

  FOR v_out IN
    SELECT o.id, o.name
    FROM public.outlets o
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.opname op
        WHERE op.outlet_id = o.id
          AND op.tanggal = v_today
          AND op.status = 'finalized'
      )
    ORDER BY o.name
  LOOP
    v_belum := array_append(v_belum, v_out.name);
  END LOOP;

  v_belum_count := coalesce(cardinality(v_belum), 0);
  v_selesai_count := v_total_outlet - v_belum_count;

  IF v_total_outlet > 0 THEN
    v_pct := round((v_selesai_count::numeric / v_total_outlet::numeric) * 100, 0);
  END IF;

  IF v_belum_count > 0 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('opname_missing_ceo:%s', v_today::text),
        v_ceo.id,
        '⏳ <b>ESKALASI CUT-OFF STOK OPNAME MALAM</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🌙 <b>Waktu Cut-Off:</b> <code>23:15 WIB</code>\n' ||
          E'📊 <b>Kepatuhan Jaringan:</b> <code>%s / %s Cabang Finalize (%s%%)</code>\n\n' ||
          E'🚨 <b>Cabang Belum Finalisasi Opname (%s Outlet):</b>\n• %s\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Cabang yang belum menyelesaikan opname fisik malam berpotensi menghambat perhitungan bahan baku harian dan replenishment esok subuh. AM wajib kawal cabang yang tertinggal.</blockquote>',
          v_selesai_count::text,
          v_total_outlet::text,
          v_pct::text,
          v_belum_count::text,
          array_to_string(v_belum, E'\n• ')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────── 14. PRESENSI: KEKURANGAN KRU & ABSEN MASAL
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_kru_dan_absensi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_today date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_menit int := extract(minute FROM v_now_wib);
  v_out record;
  v_total_crew int := 0;
  v_present_crew int := 0;
  v_present_names text[];
  v_absent_count int := 0;
  v_ceo record;
BEGIN
  IF v_jam < 14 OR v_jam > 16 THEN
    RETURN;
  END IF;

  FOR v_out IN
    SELECT o.id, o.name,
           coalesce(o.open_hour, '14:00:00'::time) AS jam_buka
    FROM public.outlets o
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
    ORDER BY o.name
  LOOP
    SELECT count(*)
    INTO v_total_crew
    FROM public.outlet_staff s
    WHERE s.outlet_id = v_out.id
      AND s.status = 'active'
      AND s.role IN ('crew', 'leader');

    IF v_total_crew < 2 THEN
      CONTINUE;
    END IF;

    SELECT count(DISTINCT a.outlet_staff_id),
           array_agg(DISTINCT s.name)
    INTO v_present_crew, v_present_names
    FROM public.attendance a
    JOIN public.outlet_staff s ON s.id = a.outlet_staff_id
    WHERE a.outlet_id = v_out.id
      AND a.type = 'in'
      AND a.status <> 'alpha'
      AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date = v_today;

    v_present_crew := coalesce(v_present_crew, 0);
    v_absent_count := v_total_crew - v_present_crew;

    -- ALERT 1: Kritis Hanya 1 Orang Hadir
    IF (v_jam > 14 OR (v_jam = 14 AND v_menit >= 40)) AND v_present_crew = 1 THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('understaffed_ceo:%s:%s', v_out.id::text, v_today::text),
          v_ceo.id,
          '👥 <b>PERINGATAN CABANG KEKURANGAN KRU</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'⏱️ <b>Waktu Evaluasi:</b> <code>%s WIB</code>\n' ||
            E'👥 <b>Kru Hadir di Lokasi:</b> <b>%s</b> (<code>1 Orang</code>)\n' ||
            E'❌ <b>Kru Tidak Hadir:</b> <code>%s Orang</code>\n' ||
            E'📋 <b>Standar Shift Cabang:</b> Minimal 2-3 Kru\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Gerai hanya dijaga oleh 1 orang saat jam operasional aktif. Risiko antrean terbengkalai dan pelayanan lambat parah. Area Manager wajib koordinasikan bantuan kru perbantuan.</blockquote>',
            public.bot_escape_html(v_out.name),
            to_char(v_now_wib, 'HH24:MI'),
            public.bot_escape_html(coalesce(v_present_names[1], '1 Kru Kitchen')),
            v_absent_count::text
          ),
          'https://manager.sukashawarma.com'
        );
      END LOOP;
    END IF;

    -- ALERT 2: Anomali Absen Masal
    IF v_total_crew >= 3 AND (v_absent_count >= 3 OR (v_absent_count::numeric / v_total_crew) >= 0.5) THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('mass_absent_ceo:%s:%s', v_out.id::text, v_today::text),
          v_ceo.id,
          '🚨 <b>PERINGATAN ANOMALI ABSENSI MASAL KRU</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'⏱️ <b>Waktu Evaluasi:</b> <code>%s WIB</code>\n' ||
            E'👥 <b>Total Kru Terjadwal:</b> <code>%s Orang</code>\n' ||
            E'❌ <b>Kru Tidak Hadir / Alpa:</b> <code>%s Orang</code> (<code>%s%%</code>)\n' ||
            E'✅ <b>Kru Hadir:</b> <code>%s Orang</code>\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Tingkat ketidakhadiran tidak wajar di satu cabang. Waspadai problem kepemimpinan lokal atau mogok kerja tersembunyi. HRD Pusat disarankan investigasi langsung.</blockquote>',
            public.bot_escape_html(v_out.name),
            to_char(v_now_wib, 'HH24:MI'),
            v_total_crew::text,
            v_absent_count::text,
            round((v_absent_count::numeric / v_total_crew) * 100, 0)::text,
            v_present_crew::text
          ),
          'https://hr.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 15. MANIPULASI ABSENSI / FAKE GPS
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

    v_device_info := coalesce(nullif(btrim(NEW.device_info), ''), 'Aplikasi Mobile Presensi');

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
          E'📱 <b>Perangkat:</b> %s\n\n' ||
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

-- ─────────────────────────────────────────────────────────── 16. SUPERVISI AM: SKOR MUTU & FOOD SAFETY BURUK
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_ceklist_buruk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_buruk_total int := 0;
  v_buruk_kritis int := 0;
  v_buruk_list text[];
  v_ceo record;
BEGIN
  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets WHERE id = NEW.outlet_id;

  SELECT count(*),
         count(*) FILTER (WHERE kategori IN ('kebersihan', 'rasa')),
         array_agg(kategori || coalesce(' (' || sub_item || ')', '')) FILTER (WHERE nilai = 'buruk')
  INTO v_buruk_total, v_buruk_kritis, v_buruk_list
  FROM public.ceklist_harian_item
  WHERE ceklist_id = NEW.id
    AND nilai = 'buruk';

  v_buruk_total := coalesce(v_buruk_total, 0);
  v_buruk_kritis := coalesce(v_buruk_kritis, 0);

  IF v_buruk_kritis >= 1 OR v_buruk_total >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('ceklist_buruk_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🔍 <b>PERINGATAN HASIL AUDIT SUPERVISI BURUK</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'👤 <b>Auditor (AM):</b> %s\n' ||
          E'📊 <b>Jumlah Pelanggaran:</b> <code>%s Item Kategori Buruk</code>\n' ||
          E'⏱️ <b>Tanggal Audit:</b> <code>%s</code>\n' ||
          E'⚠️ <b>Item Bermasalah:</b>\n• %s\n\n' ||
          E'📝 <b>Catatan Temuan AM:</b>\n<i>%s</i>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Temuan audit mendeteksi pelanggaran SOP kebersihan / food safety yang membahayakan reputasi brand. Instruksikan corrective action dalam 24 jam.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          public.bot_escape_html(coalesce(NEW.nama_am, 'Area Manager')),
          v_buruk_total::text,
          to_char(NEW.tanggal, 'DD-MM-YYYY'),
          coalesce(array_to_string(v_buruk_list, E'\n• '), '-'),
          public.bot_escape_html(coalesce(array_to_string(NEW.temuan, E'\n• '), coalesce(NEW.catatan, 'Tidak ada catatan tambahan')))
        ),
        'https://manager.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_ceklist_buruk gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 17. SUPERVISI AM BOLONG (21:00 WIB)
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_checklist_missing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_today date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_out record;
  v_missing text[] := '{}';
  v_missing_count int := 0;
  v_ceo record;
BEGIN
  IF v_jam < 21 THEN
    RETURN;
  END IF;

  FOR v_out IN
    SELECT o.id, o.name,
           coalesce(
             (SELECT st.name
              FROM public.staff_outlets so
              JOIN public.outlet_staff st ON st.id = so.staff_id
              WHERE so.outlet_id = o.id AND st.role = 'area_manager' AND st.status = 'active'
              LIMIT 1),
             'Tanpa AM'
           ) AS nama_am
    FROM public.outlets o
    WHERE public.bot_is_sales_outlet(o.id)
      AND NOT public.bot_is_outlet_tutup_sementara(o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.ceklist_harian ch
        WHERE ch.outlet_id = o.id
          AND ch.tanggal = v_today
      )
    ORDER BY o.name
  LOOP
    v_missing := array_append(v_missing, v_out.name || ' (AM: ' || v_out.nama_am || ')');
  END LOOP;

  v_missing_count := coalesce(cardinality(v_missing), 0);

  IF v_missing_count >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('ceklist_missing_ceo:%s', v_today::text),
        v_ceo.id,
        '📋 <b>PERINGATAN KELALAIAN SUPERVISI AREA MANAGER</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🌙 <b>Waktu Evaluasi:</b> <code>21:00 WIB (%s)</code>\n' ||
          E'📊 <b>Cabang Tanpa Supervisi:</b> <code>%s Cabang</code>\n\n' ||
          E'📍 <b>Daftar Cabang Belum Disupervisi:</b>\n• %s\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Beberapa cabang belum menerima kunjungan atau checklist audit AM hingga batas cut-off malam. Evaluasi disiplin kerja Area Manager terkait.</blockquote>',
          to_char(v_today, 'DD-MM-YYYY'),
          v_missing_count::text,
          array_to_string(v_missing, E'\n• ')
        ),
        'https://manager.sukashawarma.com'
      );
    END LOOP;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────── 18. PENGAJUAN KASBON BERISIKO TINGGI
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_kasbon_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_name text;
  v_staff_created timestamptz;
  v_outlet_name text;
  v_total_kasbon numeric := 0;
  v_nominal_pengajuan numeric := 0;
  v_masa_kerja_hari int := 0;
  v_masa_kerja_bulan int := 0;
  v_is_risky boolean := false;
  v_alasan_risiko text := '';
  v_ceo record;
BEGIN
  IF coalesce(NEW.status_hr, 'pending') <> 'pending' OR NEW.status = 'paid_off' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status_hr = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.created_at, coalesce(o.name, 'Kantor Pusat')
  INTO v_staff_name, v_staff_created, v_outlet_name
  FROM public.outlet_staff s
  LEFT JOIN public.outlets o ON o.id = s.outlet_id
  WHERE s.id = NEW.staff_id;

  v_nominal_pengajuan := coalesce(NEW.amount_requested, NEW.amount, 0);
  v_masa_kerja_hari := extract(day FROM (now() - coalesce(v_staff_created, now())));
  v_masa_kerja_bulan := round(v_masa_kerja_hari::numeric / 30.0, 0);

  SELECT coalesce(sum(coalesce(amount_requested, amount, 0)), 0)
  INTO v_total_kasbon
  FROM public.cash_advances
  WHERE staff_id = NEW.staff_id
    AND status <> 'paid_off'
    AND coalesce(status_hr, 'pending') IN ('pending', 'approved');

  IF v_total_kasbon >= 2500000 THEN
    v_is_risky := true;
    v_alasan_risiko := 'Akumulasi kasbon aktif mencapai ' || public.bot_format_rupiah(v_total_kasbon);
  ELSIF v_masa_kerja_hari < 90 AND v_nominal_pengajuan >= 1000000 THEN
    v_is_risky := true;
    v_alasan_risiko := 'Masa kerja baru ' || v_masa_kerja_hari || ' hari (Masih Masa Percobaan/Probation)';
  END IF;

  IF v_is_risky THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('kasbon_risiko_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '💳 <b>PERINGATAN PENGAJUAN KASBON BERISIKO TINGGI</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'👤 <b>Staf Pemohon:</b> <b>%s</b>\n' ||
          E'🏪 <b>Penugasan / Cabang:</b> %s\n' ||
          E'💰 <b>Nominal Pengajuan:</b> <code>%s</code>\n' ||
          E'💳 <b>Total Akumulasi Kasbon:</b> <code>%s</code>\n' ||
          E'⏱️ <b>Masa Kerja:</b> <code>%s Hari (%s Bulan)</code>\n' ||
          E'⚠️ <b>Indikasi Risiko:</b> <i>%s</i>\n' ||
          E'📝 <b>Alasan Kasbon:</b> <i>%s</i>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Nominal pengajuan melampaui limit wajar atau diajukan oleh staf baru. Periksa rekam jejak kedisiplinan dan batas cicilan potong gaji sebelum menyetujui.</blockquote>',
          public.bot_escape_html(v_staff_name),
          public.bot_escape_html(v_outlet_name),
          public.bot_format_rupiah(v_nominal_pengajuan),
          public.bot_format_rupiah(v_total_kasbon),
          v_masa_kerja_hari::text,
          v_masa_kerja_bulan::text,
          public.bot_escape_html(v_alasan_risiko),
          public.bot_escape_html(coalesce(NEW.reason, '-'))
        ),
        'https://hr.sukashawarma.com/perizinan/kasbon'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_kasbon_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 19. LONJAKAN RESIGN / TURNOVER KRU
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_turnover_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_resigned_count int := 0;
  v_resigned_names text[];
  v_ceo record;
BEGIN
  IF NEW.status <> 'inactive' OR OLD.status = 'inactive' OR NEW.outlet_id IS NULL OR NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         array_agg(name)
  INTO v_resigned_count, v_resigned_names
  FROM public.outlet_staff
  WHERE outlet_id = NEW.outlet_id
    AND status = 'inactive'
    AND updated_at >= (now() - interval '30 days');

  v_resigned_count := coalesce(v_resigned_count, 0);

  IF v_resigned_count >= 3 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('turnover_spike_ceo:%s:%s', NEW.outlet_id::text, to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')),
        v_ceo.id,
        '👥 <b>PERINGATAN LONJAKAN RESIGN / TURNOVER KRU</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'📊 <b>Jumlah Resign:</b> <code>%s Kru</code> (30 Hari Terakhir)\n' ||
          E'👥 <b>Kru Non-Aktif:</b> %s\n' ||
          E'⏱️ <b>Waktu Audit:</b> <code>%s WIB</code>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Terjadi lonjakan pengunduran diri kru di atas batas kewajaran pada satu outlet. Evaluasi kepemimpinan Store Leader dan beban kerja kru cabang tersebut.</blockquote>',
          public.bot_escape_html(v_outlet_name),
          v_resigned_count::text,
          public.bot_escape_html(array_to_string(v_resigned_names, ', ')),
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://hr.sukashawarma.com/team'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_turnover_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 20. DEFISIT KAS KECIL OPERASIONAL
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_petty_cash_deficit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
  v_topups numeric := 0;
  v_expenses numeric := 0;
  v_starting numeric := 0;
  v_shift_start timestamptz;
  v_shift_id uuid;
  v_outlet_nama text;
  v_ceo record;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;

  SELECT id, coalesce(starting_petty_cash, 0), start_time
  INTO v_shift_id, v_starting, v_shift_start
  FROM public.shifts
  WHERE outlet_id = NEW.outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    SELECT coalesce(sum(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = NEW.outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND (created_at >= v_shift_start OR completed_at >= v_shift_start OR leader_forwarded_at >= v_shift_start);

    SELECT coalesce(sum(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = NEW.outlet_id
      AND created_at >= v_shift_start
      AND deleted_at IS NULL;

    v_balance := v_starting + v_topups - v_expenses;
  ELSE
    SELECT coalesce(sum(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = NEW.outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND created_at >= (now() - interval '30 days');

    SELECT coalesce(sum(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = NEW.outlet_id
      AND created_at >= (now() - interval '30 days')
      AND deleted_at IS NULL;

    v_balance := v_topups - v_expenses;
  END IF;

  IF v_balance < 0 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('petty_cash_deficit:%s:%s', NEW.outlet_id::text, v_today::text),
        v_ceo.id,
        '🚨 <b>PERINGATAN DEFISIT SALDO KAS KECIL</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'💸 <b>Pengeluaran Terakhir:</b> <code>%s</code> (<i>%s</i>)\n' ||
          E'📉 <b>Estimasi Defisit Saldo:</b> <code>%s</code>\n' ||
          E'⏱️ <b>Waktu:</b> <code>%s WIB</code>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Pengeluaran operasional melebihi pagu saldo kas kecil yang tersedia. Waspadai risiko kru menutupi pengeluaran dengan uang omzet tunai laci kasir!</blockquote>',
          public.bot_escape_html(v_outlet_nama),
          public.bot_format_rupiah(NEW.amount),
          public.bot_escape_html(coalesce(NEW.description, NEW.category, 'Pengeluaran')),
          public.bot_format_rupiah(v_balance),
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 21. SELISIH PETTY CASH CLOSING SHIFT
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_closing_petty_cash_variance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_nama text;
  v_staff_name text;
  v_ceo record;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_variance numeric := coalesce(NEW.petty_cash_variance, 0);
  v_actual numeric := coalesce(NEW.actual_ending_petty_cash, 0);
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    IF v_variance < -50000 OR v_actual < 0 THEN
      SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;
      SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = coalesce(NEW.closed_by, NEW.staff_id);

      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('petty_cash_closing_variance:%s:%s', NEW.id::text, v_today::text),
          v_ceo.id,
          '💵 <b>PERINGATAN SELISIH PETTY CASH CLOSING SHIFT</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'👤 <b>Kasir / Staf:</b> %s\n' ||
            E'💵 <b>Fisik Kas Kecil Terhitung:</b> <code>%s</code>\n' ||
            E'📊 <b>Ekspektasi Sistem:</b> <code>%s</code>\n' ||
            E'📉 <b>Selisih (Variance):</b> <code>%s</code>\n' ||
            E'⏱️ <b>Waktu Closing:</b> <code>%s WIB</code>\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Terdapat selisih fisik petty cash saat penutupan shift kasir. Minta bukti fisik nota belanja operasional dan cocokkan dengan amplop kas kecil.</blockquote>',
            public.bot_escape_html(v_outlet_nama),
            public.bot_escape_html(coalesce(v_staff_name, 'Kasir')),
            public.bot_format_rupiah(v_actual),
            public.bot_format_rupiah(coalesce(NEW.expected_ending_petty_cash, 0)),
            public.bot_format_rupiah(v_variance),
            to_char(coalesce(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
          ),
          'https://finance.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 22. PENGELUARAN KAS TANPA BUKTI NOTA FISIK
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_no_receipt_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    IF v_staff_nama IS NULL THEN
      SELECT name INTO v_staff_nama FROM public.outlet_staff WHERE auth_user_id = NEW.created_by LIMIT 1;
    END IF;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('no_receipt_expense:%s', NEW.id::text),
        v_ceo.id,
        '🧾 <b>PERINGATAN PENGELUARAN KAS TANPA NOTA FISIK</b>',
        format(
          E'━━━━━━━━━━━━━━━━━━━━━\n' ||
          E'🏪 <b>Outlet:</b> %s\n' ||
          E'💰 <b>Nominal Pengeluaran:</b> <code>%s</code>\n' ||
          E'📦 <b>Keperluan / Kategori:</b> %s (<i>%s</i>)\n' ||
          E'👤 <b>Diinput Oleh:</b> %s\n' ||
          E'⏱️ <b>Waktu Transaksi:</b> <code>%s WIB</code>\n\n' ||
          E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
          E'Pengeluaran kas tercatat di atas batas Rp 100.000 tanpa lampiran foto nota / struk belanja. Waspadai potensi nota fiktif atau pengeluaran pribadi staf.</blockquote>',
          public.bot_escape_html(v_outlet_nama),
          public.bot_format_rupiah(NEW.amount),
          public.bot_escape_html(upper(replace(NEW.category, '_', ' '))),
          public.bot_escape_html(coalesce(NEW.description, '-')),
          public.bot_escape_html(coalesce(v_staff_nama, 'Kru Kasir')),
          to_char(coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 23. UANG SETORAN TUNAI TERTAHAN DI GERAI (> 48 JAM)
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_setoran_tertahan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_today date := v_now_wib::date;
  v_row record;
  v_total_deposit numeric;
  v_ceo record;
  v_selisih numeric;
  v_jam_tertahan int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-ceo-setoran-tertahan')) THEN
    RETURN;
  END IF;

  FOR v_row IN
    SELECT 
      s.outlet_id,
      o.name AS outlet_nama,
      (s.end_time AT TIME ZONE 'Asia/Jakarta')::date AS tanggal_jual,
      sum(coalesce(s.actual_ending_cash, 0)) AS total_kas_tunai,
      count(s.id) AS total_shift
    FROM public.shifts s
    JOIN public.outlets o ON o.id = s.outlet_id
    WHERE s.status = 'closed'
      AND s.end_time IS NOT NULL
      AND (s.end_time AT TIME ZONE 'Asia/Jakarta')::date BETWEEN (v_today - interval '7 days') AND (v_today - interval '2 days')
      AND public.bot_is_sales_outlet(s.outlet_id)
      AND NOT public.bot_is_outlet_tutup_sementara(s.outlet_id)
    GROUP BY s.outlet_id, o.name, (s.end_time AT TIME ZONE 'Asia/Jakarta')::date
    HAVING sum(coalesce(s.actual_ending_cash, 0)) >= 300000
    ORDER BY (s.end_time AT TIME ZONE 'Asia/Jakarta')::date ASC, o.name
  LOOP
    SELECT coalesce(sum(amount), 0)
    INTO v_total_deposit
    FROM public.cash_transaction
    WHERE outlet_id = v_row.outlet_id
      AND source_type = 'cash_deposit'
      AND status NOT IN ('void', 'rejected', 'cancelled')
      AND (
        sales_date = v_row.tanggal_jual
        OR (
          sales_date IS NULL 
          AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_row.tanggal_jual AND (v_row.tanggal_jual + interval '3 days')
        )
      );

    IF v_total_deposit < (v_row.total_kas_tunai * 0.7) THEN
      v_selisih := v_row.total_kas_tunai - v_total_deposit;
      v_jam_tertahan := (v_today - v_row.tanggal_jual) * 24;

      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('delayed_bank_deposit:%s:%s', v_row.outlet_id::text, v_row.tanggal_jual::text),
          v_ceo.id,
          '💰 <b>PERINGATAN SETORAN TUNAI TERTAHAN DI GERAI</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'💰 <b>Total Uang Tertahan:</b> <code>%s</code> (<code>%s Shift</code>)\n' ||
            E'⏳ <b>Lama Tertahan:</b> <code>%s Jam (%s Hari)</code>\n' ||
            E'📅 <b>Tanggal Penjualan:</b> <code>%s</code>\n' ||
            E'💵 <b>Kasir Terkumpul:</b> <code>%s</code>\n' ||
            E'🏦 <b>Setoran Tercatat:</b> <code>%s</code>\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Uang hasil penjualan tunai tersimpan di cabang lebih dari 48 jam tanpa disetorkan ke rekening bank perusahaan. Risiko tinggi pencurian atau penyalahgunaan uang operasional.</blockquote>',
            public.bot_escape_html(v_row.outlet_nama),
            public.bot_format_rupiah(v_selisih),
            v_row.total_shift::text,
            v_jam_tertahan::text,
            (v_today - v_row.tanggal_jual)::text,
            to_char(v_row.tanggal_jual, 'DD Mon YYYY'),
            public.bot_format_rupiah(v_row.total_kas_tunai),
            public.bot_format_rupiah(v_total_deposit)
          ),
          'https://finance.sukashawarma.com'
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 24. VERIFIKASI SURAT JALAN OLEH OUTLET (CEO CASE)
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
BEGIN
  IF NEW.status NOT IN ('diterima_lengkap', 'diterima_sebagian')
     OR (OLD.status IS NOT NULL AND OLD.status IN ('diterima_lengkap', 'diterima_sebagian')) THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_doc_no := COALESCE(NULLIF(NEW.document_number, ''), left(NEW.id::text, 8));

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
      SELECT s.id FROM public.outlet_staff s
      JOIN public.bot_telegram_access a ON a.staff_id = s.id
      JOIN public.bot_telegram_links l ON l.staff_id = s.id
      WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active' AND l.chat_id IS NOT NULL
    LOOP
      PERFORM public.bot_telegram_kirim_alert(
        v_kit.id,
        'distribusi',
        '✅ Crew selesai verifikasi · ' || v_outlet_name,
        'SJ: ' || v_doc_no || E'\nCrew: ' || left(v_crew_name, 120)
          || E'\nWaktu: ' || v_time_str || ' WIB'
          || E'\nHasil: ' || v_item_count || ' baris bahan diterima lengkap dan sesuai.'
          || E'\nStok outlet telah diperbarui otomatis.',
        'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || NEW.id::text,
        NEW.outlet_id
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
        format('sj_verif_am:%s:%s', NEW.id::text, v_am.id::text),
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
        format('sj_verif_rm:%s:%s', NEW.id::text, v_rm.id::text),
        v_rm.id,
        '⚠️ [SELISIH DISTRIBUSI] ' || v_outlet_name,
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
        '⚠️ <b>PERINGATAN DISTRIBUSI: SELISIH PENERIMAAN SURAT JALAN</b>',
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    FOR v_kit IN
      SELECT s.id FROM public.outlet_staff s
      JOIN public.bot_telegram_access a ON a.staff_id = s.id
      JOIN public.bot_telegram_links l ON l.staff_id = s.id
      WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active' AND l.chat_id IS NOT NULL
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
        NEW.outlet_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_verifikasi_surat_jalan gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;
