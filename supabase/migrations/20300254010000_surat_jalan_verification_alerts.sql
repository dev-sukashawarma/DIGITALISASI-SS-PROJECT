-- Migration: 20300254010000_surat_jalan_verification_alerts.sql
-- Implementasi notifikasi real-time saat Surat Jalan (SJ) diverifikasi oleh outlet:
-- 1. Status 'diterima_lengkap' (100% bahan diterima sesuai)
-- 2. Status 'diterima_sebagian' (ada selisih barang / rusak / barang kurang)
-- Dikirim ke:
-- - Area Manager (AM) via Push Superapp + Bot Manager
-- - Regional Manager (RM) & Developer via Bot Manager
-- - CEO / Direksi (Owner, Admin, Developer) via Bot CEO (@Agent_SukaShawarma_Bot)
-- - Central Kitchen (Kitchen & Purchasing) via Bot Stokis

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
  -- Hanya jalankan saat transisi status menjadi 'diterima_lengkap' atau 'diterima_sebagian'
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

  -- Tentukan nama verifikator (kru penerima / leader / sistem)
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

  -- Hitung total baris item bahan baku
  SELECT count(*), coalesce(sum(qty_terima), 0)
  INTO v_item_count, v_total_qty
  FROM public.surat_jalan_item
  WHERE surat_jalan_id = NEW.id;

  -- Hitung durasi pengiriman sejak dibuat/dikirim
  v_duration_hours := round(extract(epoch FROM (NOW() - COALESCE(NEW.created_at, NOW()))) / 3600.0, 1);

  -- =========================================================================
  -- KASUS 1: DITERIMA LENGKAP (100% Bahan Sesuai & Kondisi Baik)
  -- =========================================================================
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
      E'Pengiriman bahan baku Central Kitchen telah berhasil diterima dan diverifikasi lengkap oleh gerai.\nOutlet: %s\nNo. SJ: %s\nPenerima: %s\nWaktu Verifikasi: %s WIB (%s)\nStatus: ✅ 100%% Diterima Lengkap (%s Item Bahan Baku Sesuai)\nDurasi Pengiriman: %s Jam\n\nAtensi Direksi: Uang barang inventory Central Kitchen telah resmi berpindah ke saldo fisik outlet dan klir.',
      v_outlet_name,
      v_doc_no,
      v_crew_name,
      v_time_str,
      v_date_str,
      v_item_count::text,
      v_duration_hours::text
    );

    -- 1. Kirim ke Area Manager (AM) pembina cabang
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

    -- 2. Kirim ke Regional Manager (RM) & Developer
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

    -- 3. Kirim ke CEO / Direksi (Owner, Admin, Developer) via Bot CEO
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('sj_verif_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '✅ [DISTRIBUSI SELESAI] Surat Jalan Diterima Lengkap — ' || v_outlet_name,
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    -- 4. Kirim ke Central Kitchen / Purchasing via Bot Stokis
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

  -- =========================================================================
  -- KASUS 2: DITERIMA SEBAGIAN (Ada Selisih / Barang Kurang / Rusak)
  -- =========================================================================
  ELSIF NEW.status = 'diterima_sebagian' THEN
    -- Kumpulkan rincian item selisih
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
      END IF;
    END LOOP;

    IF v_diff_count > 4 THEN
      v_item_detail := v_item_detail || format(E'\n• (+%s item selisih lainnya...)', v_diff_count - 4);
    END IF;

    IF v_item_detail = '' THEN
      v_item_detail := E'\n(Item berstatus selisih fisik belum diperinci)';
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
      E'Penerimaan bahan baku Central Kitchen di gerai dilaporkan ada SELISIH FISIK / BARANG KURANG.\nOutlet: %s\nNo. SJ: %s\nPenerima: %s\nWaktu: %s WIB (%s)\n\nRincian Item Selisih:%s\n\nPerhatian Direksi: Disarankan audit pengiriman armada / timbangan outlet untuk memastikan tidak terjadi kebocoran bahan baku logistik.',
      v_outlet_name,
      v_doc_no,
      v_crew_name,
      v_time_str,
      v_date_str,
      v_item_detail
    );

    -- 1. Kirim ke Area Manager (AM)
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

    -- 2. Kirim ke Regional Manager (RM) & Developer
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

    -- 3. Kirim ke CEO / Direksi via Bot CEO
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('sj_selisih_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '⚠️ [SELISIH SURAT JALAN] ' || v_outlet_name,
        v_body_ceo,
        'https://admin.sukashawarma.com'
      );
    END LOOP;

    -- 4. Kirim ke Kitchen & Purchasing
    FOR v_kit IN
      SELECT s.id FROM public.outlet_staff s
      JOIN public.bot_telegram_access a ON a.staff_id = s.id
      JOIN public.bot_telegram_links l ON l.staff_id = s.id
      WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active' AND l.chat_id IS NOT NULL
    LOOP
      PERFORM public.bot_telegram_kirim_alert(
        v_kit.id,
        'distribusi',
        '⚠️ Selisih penerimaan · ' || v_outlet_name,
        'Penerimaan surat jalan ' || v_doc_no || ' di ' || v_outlet_name || ' memiliki item yang ditandai selisih.' || v_item_detail || E'\n\nMohon tinjau hasil verifikasinya.',
        'https://distribusi.sukashawarma.com/distribusi/terima/' || NEW.id::text,
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

-- Drop trigger lama yang hanya parsial / terbatas kitchen
DROP TRIGGER IF EXISTS trg_bot_telegram_verifikasi_kitchen ON public.surat_jalan;
DROP TRIGGER IF EXISTS trg_bot_telegram_selisih_penerimaan ON public.surat_jalan;

-- Pasang trigger tunggal terpadu untuk verifikasi Surat Jalan
DROP TRIGGER IF EXISTS trg_bot_telegram_verifikasi_surat_jalan ON public.surat_jalan;
CREATE TRIGGER trg_bot_telegram_verifikasi_surat_jalan
  AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan();

-- Hardening bot_ceo_kirim_antrean: pastikan entity HTML (&, <, >) di-escape aman agar tidak 400 Bad Request
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

  -- Jika bot_token ditemukan, kirim langsung via Telegram Bot API (paling cepat & andal)
  IF coalesce(v_bot_token, '') <> '' THEN
    v_url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage';
  ELSE
    -- Fallback ke webhook Coolify jika token belum terdaftar
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
    -- Cek status respons request sebelumnya jika ada
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

    -- Escape HTML entities: & -> &amp;, < -> &lt;, > -> &gt; agar Telegram parse_mode HTML tidak 400
    v_text := replace(replace(replace(r.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
              || E'\n\n' ||
              replace(replace(replace(r.body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

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
