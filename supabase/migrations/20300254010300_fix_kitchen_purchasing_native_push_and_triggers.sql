-- =============================================================================
-- Migration: 20300254010300_fix_kitchen_purchasing_native_push_and_triggers.sql
-- Tanggal: 2026-10-26
-- Deskripsi:
--   Memastikan seluruh trigger otomatis untuk role 'kitchen' dan 'purchasing'
--   100% masuk ke In-App Notification (public.bot_app_notifications) dan
--   Push Notification Native App (SUKA Superapp) tanpa wajib menautkan Telegram:
--
--   1. bot_telegram_alert_permintaan_bahan:
--      - Sertakan role 'purchasing' selain 'kitchen'.
--
--   2. bot_telegram_alert_verifikasi_surat_jalan & trg_bot_telegram_verifikasi_surat_jalan:
--      - Tangani juga event INSERT / UPDATE status 'dikirim' & 'dikirim_lengkap'
--        untuk mencatat dispatched_at ke bot_telegram_sj_kitchen_alert_state.
--      - Tandai completion_alerted_at saat status menjadi 'diterima_lengkap'
--        atau 'diterima_sebagian'.
--      - Lepas syarat INNER JOIN bot_telegram_links pada loop penerima
--        'kitchen' & 'purchasing' agar Push HP & In-App tetap terkirim.
--
--   3. bot_telegram_pengingat_verifikasi_kitchen:
--      - Backfill surat_jalan berstatus 'dikirim'/'dikirim_lengkap' yang belum
--        tercatat di bot_telegram_sj_kitchen_alert_state.
--      - Lepas syarat INNER JOIN bot_telegram_links dan sertakan 'purchasing'
--        selain 'kitchen'.
--
--   4. bot_telegram_opname_harian_kitchen:
--      - Lepas syarat INNER JOIN bot_telegram_links dan early-return Vault
--        Telegram agar Push HP & In-App tetap jalan.
--      - Sertakan role 'purchasing' selain 'kitchen'.
--
--   5. stok_push_waste_pending_approval:
--      - Sertakan role 'purchasing' selain 'kitchen'.
--      - Pastikan bot_telegram_kirim_alert tetap dipanggil meskipun secret
--        push_webhook_url belum disetel (agar Realtime In-App tetap jalan).
--
--   6. finance_kirim_pengingat_po_jatuh_tempo:
--      - Panggil juga bot_kirim_push_hp() agar pengingat PO jatuh tempo masuk
--        ke public.bot_app_notifications (In-App Bot & Realtime Push HP) untuk
--        role 'purchasing', 'admin_finance', 'owner', dan 'admin'.
--      - Daftarkan katalog trigger PO Jatuh Tempo untuk role 'purchasing'.
-- =============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Permintaan Bahan Masuk dari Cabang (Kitchen & Purchasing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_permintaan_bahan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_creator_name text;
  v_item_count int := 0;
  v_sample_items text;
  v_title text;
  v_body text;
  v_url text := 'https://stok.sukashawarma.com/stok/permintaan';
  r record;
BEGIN
  IF NEW.status <> 'menunggu' THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO v_creator_name
  FROM public.outlet_staff s
  WHERE s.id = NEW.dibuat_oleh;

  SELECT count(*)::int INTO v_item_count
  FROM public.permintaan_bahan_item
  WHERE permintaan_id = NEW.id;

  SELECT string_agg(sub.item_desc, ', ' ORDER BY sub.nama)
  INTO v_sample_items
  FROM (
    SELECT b.nama,
           b.nama || ' (' || public.bot_telegram_format_angka(pbi.qty_diminta) || ' ' || COALESCE(b.satuan, '') || ')' AS item_desc
    FROM public.permintaan_bahan_item pbi
    JOIN public.bahan_baku b ON b.id = pbi.bahan_baku_id
    WHERE pbi.permintaan_id = NEW.id
    ORDER BY b.nama
    LIMIT 3
  ) sub;

  v_title := '📦 Permintaan Bahan Masuk · ' || v_outlet_name;
  v_body := 'Outlet: ' || v_outlet_name
    || (CASE WHEN v_item_count > 0 THEN E'\nJumlah Item: ' || v_item_count || ' item' ELSE '' END)
    || (CASE WHEN v_sample_items IS NOT NULL AND btrim(v_sample_items) <> '' THEN E'\nRincian: ' || v_sample_items || (CASE WHEN v_item_count > 3 THEN ' dll' ELSE '' END) ELSE '' END)
    || E'\nDibuat oleh: ' || COALESCE(v_creator_name, 'Kru Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
    || E'\n\nMohon tim dapur pusat & purchasing meninjau permintaan dan memproses surat jalan pengiriman.';

  -- Kirim ke seluruh staf kitchen & purchasing aktif (Push HP + In-App + Telegram bila tertaut)
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      v_title,
      v_body,
      v_url,
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert permintaan bahan: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_permintaan_bahan() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Verifikasi Surat Jalan & Pencatatan Dispatched State (Kitchen & Purchasing)
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
BEGIN
  -- A. Catat waktu keberangkatan (dispatched_at) saat status menjadi 'dikirim' / 'dikirim_lengkap'
  IF NEW.status IN ('dikirim', 'dikirim_lengkap') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.bot_telegram_sj_kitchen_alert_state AS existing (
        surat_jalan_id, dispatched_at, completion_alerted_at, last_reminded_at
      ) VALUES (NEW.id, NOW(), NULL, NULL)
      ON CONFLICT (surat_jalan_id) DO UPDATE
        SET dispatched_at = EXCLUDED.dispatched_at,
            completion_alerted_at = NULL,
            last_reminded_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- B. Hanya proses alert penyelesaian saat transisi menuju 'diterima_lengkap' atau 'diterima_sebagian'
  IF NEW.status NOT IN ('diterima_lengkap', 'diterima_sebagian')
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT NULL AND OLD.status IN ('diterima_lengkap', 'diterima_sebagian')) THEN
    RETURN NEW;
  END IF;

  -- Tandai selesai di state pengingat agar tidak dikirim pengingat gantung > 2 jam lagi
  INSERT INTO public.bot_telegram_sj_kitchen_alert_state (
    surat_jalan_id, dispatched_at, completion_alerted_at
  ) VALUES (
    NEW.id, COALESCE(NEW.created_at, NOW()), NOW()
  )
  ON CONFLICT (surat_jalan_id) DO UPDATE
    SET completion_alerted_at = COALESCE(public.bot_telegram_sj_kitchen_alert_state.completion_alerted_at, NOW());

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

    -- Kirim ke seluruh staf kitchen & purchasing aktif (Push HP + In-App + Telegram jika tertaut)
    FOR v_kit IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      WHERE s.role IN ('kitchen', 'purchasing')
        AND s.status = 'active'
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

    -- Kirim ke seluruh staf kitchen & purchasing aktif (Push HP + In-App + Telegram jika tertaut)
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

REVOKE ALL ON FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_telegram_verifikasi_surat_jalan ON public.surat_jalan;
CREATE TRIGGER trg_bot_telegram_verifikasi_surat_jalan
  AFTER INSERT OR UPDATE OF status ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_verifikasi_surat_jalan();

-- Backfill state surat_jalan aktif hari ini yang berstatus 'dikirim'/'dikirim_lengkap'
INSERT INTO public.bot_telegram_sj_kitchen_alert_state (surat_jalan_id, dispatched_at)
SELECT h.id, COALESCE(h.updated_at, h.created_at, NOW())
FROM public.surat_jalan h
WHERE h.status IN ('dikirim', 'dikirim_lengkap')
  AND h.auto_verified_at IS NULL
  AND h.ditutup_administratif_at IS NULL
  AND h.created_at >= NOW() - INTERVAL '2 days'
ON CONFLICT (surat_jalan_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pengingat Crew Belum Verifikasi SJ > 2 Jam (Kitchen & Purchasing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(
  p_agora TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hour INTEGER;
  v_pic TEXT;
  v_count INTEGER := 0;
  v_sent BOOLEAN;
  sj RECORD;
  r RECORD;
BEGIN
  IF p_agora IS NULL OR NOT isfinite(p_agora) THEN RETURN 0; END IF;
  v_hour := extract(hour FROM p_agora AT TIME ZONE 'Asia/Jakarta');
  IF v_hour < 8 OR v_hour >= 21 THEN RETURN 0; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-telegram-kitchen-verification-reminder')) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active'
  ) THEN RETURN 0; END IF;

  -- Pastikan surat_jalan berstatus 'dikirim'/'dikirim_lengkap' tercatat di tabel state
  INSERT INTO public.bot_telegram_sj_kitchen_alert_state (surat_jalan_id, dispatched_at)
  SELECT h.id, COALESCE(h.updated_at, h.created_at, p_agora)
  FROM public.surat_jalan h
  WHERE h.status IN ('dikirim', 'dikirim_lengkap')
    AND h.auto_verified_at IS NULL
    AND h.ditutup_administratif_at IS NULL
    AND h.created_at >= p_agora - INTERVAL '2 days'
  ON CONFLICT (surat_jalan_id) DO NOTHING;

  FOR sj IN
    SELECT h.id, h.outlet_id, h.document_number, o.name AS outlet_name, st.dispatched_at
    FROM public.surat_jalan h
    JOIN public.bot_telegram_sj_kitchen_alert_state st ON st.surat_jalan_id = h.id
    JOIN public.outlets o ON o.id = h.outlet_id
    WHERE h.status IN ('dikirim', 'dikirim_lengkap')
      AND h.auto_verified_at IS NULL AND h.ditutup_administratif_at IS NULL
      AND o.is_active IS TRUE AND COALESCE(o.type, '') NOT IN ('test', 'marketplace')
      AND st.completion_alerted_at IS NULL
      AND st.dispatched_at <= p_agora - INTERVAL '2 hours'
      AND (st.last_reminded_at IS NULL OR st.last_reminded_at <= p_agora - INTERVAL '4 hours')
    ORDER BY st.dispatched_at, h.id
    LIMIT 50
    FOR UPDATE OF h SKIP LOCKED
  LOOP
    BEGIN
      SELECT string_agg(pic.name, ', ' ORDER BY pic.name) INTO v_pic
      FROM (
        SELECT s.name FROM public.outlet_staff s
        WHERE s.status = 'active' AND s.role IN ('crew', 'leader', 'kiosk')
          AND (s.outlet_id = sj.outlet_id OR EXISTS (
            SELECT 1 FROM public.staff_outlets so
            WHERE so.staff_id = s.id AND so.outlet_id = sj.outlet_id
          ))
        ORDER BY CASE WHEN s.role = 'leader' THEN 0 ELSE 1 END, s.name
        LIMIT 3
      ) pic;

      v_sent := FALSE;
      FOR r IN
        SELECT DISTINCT s.id FROM public.outlet_staff s
        WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active'
      LOOP
        PERFORM public.bot_telegram_kirim_alert(
          r.id, 'distribusi', '⏳ Crew belum verifikasi · ' || sj.outlet_name,
          'SJ: ' || COALESCE(NULLIF(sj.document_number, ''), left(sj.id::text, 8))
            || E'\nDikirim: ' || to_char(sj.dispatched_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
            || E'\nSudah ' || round(extract(epoch FROM (p_agora - sj.dispatched_at)) / 3600, 1)
            || ' jam sejak dikirim; verifikasi penerimaan belum selesai.'
            || E'\nPIC outlet: ' || left(COALESCE(v_pic, 'belum tercatat'), 240)
            || E'\nHubungi PIC untuk memastikan barang tiba dan verifikasi diselesaikan.',
          'https://distribusi.sukashawarma.com/distribusi/surat-jalan/' || sj.id::text,
          sj.outlet_id
        );
        v_sent := TRUE;
      END LOOP;
      IF v_sent THEN
        UPDATE public.bot_telegram_sj_kitchen_alert_state SET last_reminded_at = p_agora
        WHERE surat_jalan_id = sj.id;
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Pengingat verifikasi kitchen SJ % gagal: %', sj.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_pengingat_verifikasi_kitchen(TIMESTAMPTZ) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Pengingat Opname 21:00 WIB & Ringkasan Opname 22:30 WIB (Kitchen & Purchasing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_opname_harian_kitchen(
  p_fase TEXT, p_sekarang TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_time TIME;
  v_total INTEGER;
  v_done INTEGER;
  v_pending INTEGER;
  v_snapshot JSONB;
  v_pages TEXT[] := '{}'::text[];
  v_page TEXT := '';
  v_line TEXT;
  v_header TEXT;
  v_title TEXT;
  v_body TEXT;
  v_claimed BOOLEAN;
  v_page_count INTEGER;
  v_recipients INTEGER := 0;
  v_index INTEGER;
  row_data RECORD;
  recipient RECORD;
BEGIN
  IF p_fase IS NULL OR p_fase NOT IN ('pengingat', 'ringkasan')
    OR p_sekarang IS NULL OR NOT isfinite(p_sekarang) THEN RETURN 0; END IF;
  v_date := (p_sekarang AT TIME ZONE 'Asia/Jakarta')::date;
  v_time := (p_sekarang AT TIME ZONE 'Asia/Jakarta')::time;
  IF (p_fase = 'pengingat' AND (v_time < TIME '21:00' OR v_time >= TIME '22:30'))
    OR (p_fase = 'ringkasan' AND v_time < TIME '22:30') THEN RETURN 0; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('kitchen-opname:' || v_date || ':' || p_fase)) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active'
  ) THEN RETURN 0; END IF;

  SELECT count(*), count(*) FILTER (WHERE d.status_opname = 'finalized'),
         COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.outlet_name, d.outlet_id), '[]'::jsonb)
  INTO v_total, v_done, v_snapshot
  FROM public.bot_telegram_opname_harian_kitchen_data(v_date) d;
  v_pending := v_total - v_done;
  IF v_total = 0 OR (p_fase = 'pengingat' AND v_pending = 0) THEN RETURN 0; END IF;

  v_header := 'Tanggal: ' || to_char(v_date, 'DD-MM-YYYY') || ' · sampai '
    || to_char(p_sekarang AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || E' WIB\n'
    || 'Selesai: ' || v_done || '/' || v_total || E' outlet\n'
    || 'Belum final: ' || v_pending || E' outlet\n\n';
  v_title := CASE WHEN p_fase = 'pengingat' THEN '⏰ Opname belum selesai hari ini'
    ELSE '📋 Rangkuman opname harian' END;

  FOR row_data IN
    SELECT d.* FROM jsonb_to_recordset(v_snapshot) AS d(
      outlet_id UUID, outlet_name TEXT, status_opname TEXT,
      pic_name TEXT, tercatat_at TIMESTAMPTZ
    )
    WHERE p_fase = 'ringkasan' OR d.status_opname <> 'finalized'
    ORDER BY (d.status_opname = 'finalized') DESC, d.outlet_name, d.outlet_id
  LOOP
    v_line := CASE row_data.status_opname
      WHEN 'finalized' THEN '✅ '
      WHEN 'draft' THEN '🟡 '
      WHEN 'pending_approval' THEN '🟡 '
      ELSE '🔴 ' END
      || left(row_data.outlet_name, 60) || ' — '
      || CASE row_data.status_opname
        WHEN 'finalized' THEN 'selesai'
        WHEN 'draft' THEN 'sudah mulai, belum final'
        WHEN 'pending_approval' THEN 'menunggu persetujuan'
        WHEN 'rejected' THEN 'perlu perbaikan'
        ELSE 'belum mulai' END
      || ' · ' || left(row_data.pic_name, 40)
      || CASE WHEN row_data.status_opname = 'finalized' AND row_data.tercatat_at IS NOT NULL
        THEN ' · ' || to_char(row_data.tercatat_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ELSE '' END;
    IF length(v_page) + length(v_line) + 1 > 850 AND v_page <> '' THEN
      v_pages := array_append(v_pages, v_page);
      v_page := '';
    END IF;
    v_page := v_page || CASE WHEN v_page = '' THEN '' ELSE E'\n' END || v_line;
  END LOOP;
  IF v_page <> '' THEN v_pages := array_append(v_pages, v_page); END IF;
  v_page_count := cardinality(v_pages);

  FOR recipient IN
    SELECT DISTINCT s.id FROM public.outlet_staff s
    WHERE s.role IN ('kitchen', 'purchasing') AND s.status = 'active'
  LOOP
    BEGIN
      INSERT INTO public.bot_telegram_opname_kitchen_send_log (
        tanggal, fase, staff_id, jumlah_outlet, jumlah_selesai, jumlah_belum, jumlah_halaman
      ) VALUES (v_date, p_fase, recipient.id, v_total, v_done, v_pending, v_page_count)
      ON CONFLICT (tanggal, fase, staff_id) DO NOTHING
      RETURNING TRUE INTO v_claimed;
      IF NOT FOUND OR NOT COALESCE(v_claimed, FALSE) THEN CONTINUE; END IF;
      FOR v_index IN 1..v_page_count LOOP
        v_body := v_header || v_pages[v_index]
          || E'\n\nStatus diambil saat ringkasan dibuat. Lihat progres terbaru di aplikasi.'
          || CASE WHEN v_page_count > 1
            THEN E'\nBagian ' || v_index || '/' || v_page_count ELSE '' END;
        PERFORM public.bot_telegram_kirim_alert(
          recipient.id, 'stok', v_title, v_body,
          'https://stok.sukashawarma.com/stok/opname', NULL
        );
      END LOOP;
      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Ringkasan opname kitchen/purchasing gagal untuk staf %: %', recipient.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_recipients;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_opname_harian_kitchen(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_opname_harian_kitchen(TEXT, TIMESTAMPTZ) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Pengajuan Waste Menunggu Approval (Kitchen & Purchasing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stok_push_waste_pending_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_outlet_name TEXT;
  v_recip RECORD;
BEGIN
  IF NEW.status <> 'PENDING'
    OR (TG_OP = 'UPDATE' AND OLD.status = 'PENDING') THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

  FOR v_recip IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('area_manager', 'regional_manager', 'admin', 'kitchen', 'purchasing', 'developer')
      AND (
        s.role IN ('admin', 'kitchen', 'purchasing', 'developer')
        OR s.outlet_id = NEW.outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
        )
      )
      AND s.id IS DISTINCT FROM NEW.reported_by
  LOOP
    BEGIN
      -- 1. Jalur In-App Notif + Push HP Bot + Telegram (via bot_telegram_kirim_alert)
      PERFORM public.bot_telegram_kirim_alert(
        v_recip.id,
        'stok',
        '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet'),
        'Ada laporan waste baru yang perlu ditinjau di outlet ' || COALESCE(v_outlet_name, 'terkait') || '.',
        'https://stok.sukashawarma.com/stok/waste/approval',
        NEW.outlet_id
      );

      -- 2. Jalur FCM tambahan ke modul stok (jika secret tersedia)
      IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          body := jsonb_build_object(
            'user_id', v_recip.id,
            'app', 'stok',
            'title', '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet'),
            'body', 'Ada laporan waste baru yang perlu ditinjau di outlet ' || COALESCE(v_outlet_name, 'terkait') || '.',
            'url', 'https://stok.sukashawarma.com/stok/waste/approval'
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim push approval waste % kepada staf %: %', NEW.id, v_recip.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_push_waste_pending_approval() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Pengingat PO Jatuh Tempo 08:15 WIB (Purchasing & Finance -> In-App + Push HP)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_kirim_pengingat_po_jatuh_tempo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_all TEXT[];
  v_previous TEXT[];
  v_new TEXT[];
  v_due_today INTEGER := 0;
  v_overdue INTEGER := 0;
  v_soon INTEGER := 0;
  v_url TEXT;
  v_key TEXT;
  v_recipients INTEGER := 0;
  v_title TEXT;
  v_body TEXT;
  v_bot_slug TEXT;
  r RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('finance-po-pengingat-jatuh-tempo'));

  IF EXISTS (SELECT 1 FROM public.finance_po_pengingat_push_log WHERE tanggal = v_today) THEN
    RETURN 'sudah dikirim hari ini';
  END IF;

  SELECT array_agg(kunci ORDER BY kunci),
         count(*) FILTER (WHERE hari_ke_tempo = 0)::int,
         count(*) FILTER (WHERE hari_ke_tempo < 0)::int,
         count(*) FILTER (WHERE hari_ke_tempo BETWEEN 1 AND 3)::int
  INTO v_all, v_due_today, v_overdue, v_soon
  FROM (
    SELECT c.po_id::text || ':' || c.jatuh_tempo::text AS kunci, c.hari_ke_tempo
    FROM public.finance_po_pengingat_kandidat(v_today) c
  ) kandidat;

  IF COALESCE(cardinality(v_all), 0) = 0 THEN
    RETURN 'tidak ada PO mendekati jatuh tempo';
  END IF;

  SELECT l.kunci INTO v_previous
  FROM public.finance_po_pengingat_push_log l
  ORDER BY l.tanggal DESC LIMIT 1;

  SELECT array_agg(k) INTO v_new
  FROM unnest(COALESCE(v_all, '{}'::text[])) AS k
  WHERE NOT (k = ANY(COALESCE(v_previous, '{}'::text[])));

  IF COALESCE(cardinality(v_new), 0) = 0 AND extract(isodow FROM v_today) <> 1 THEN
    RETURN 'tidak ada kasus PO baru';
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

  v_title := '💳 Pengingat jatuh tempo PO';
  v_body := COALESCE(v_overdue, 0) || ' PO lewat jatuh tempo, '
    || COALESCE(v_due_today, 0) || ' jatuh tempo hari ini, dan '
    || COALESCE(v_soon, 0) || ' jatuh tempo dalam 3 hari. Buka Finance/Purchasing untuk menindaklanjuti.';

  FOR r IN
    SELECT s.id, s.role
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin_finance', 'owner', 'admin', 'purchase', 'purchasing')
  LOOP
    BEGIN
      v_bot_slug := CASE
        WHEN r.role IN ('purchase', 'purchasing') THEN 'stokis'
        WHEN r.role = 'admin_finance' THEN 'finance'
        ELSE 'ceo'
      END;

      -- 1. Simpan ke bot_app_notifications + kirim Push HP Bot (Dual-Delivery Realtime + FCM)
      PERFORM public.bot_kirim_push_hp(
        'po_jatuh_tempo:' || v_today::text,
        r.id,
        v_bot_slug,
        v_title,
        v_body,
        'bot'
      );

      -- 2. Kirim Push FCM modul finance (jika secret tersedia)
      IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          body := jsonb_build_object(
            'user_id', r.id,
            'app', 'finance',
            'title', v_title,
            'body', v_body,
            'url', 'https://finance.sukashawarma.com/pembelian/invoice'
          )
        );
      END IF;

      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim pengingat PO kepada staf %: %', r.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.finance_po_pengingat_push_log (tanggal, kunci, jumlah_po, jumlah_penerima)
  VALUES (v_today, COALESCE(v_all, '{}'::text[]), cardinality(v_all), v_recipients)
  ON CONFLICT (tanggal) DO UPDATE
    SET kunci = EXCLUDED.kunci,
        jumlah_po = EXCLUDED.jumlah_po,
        jumlah_penerima = EXCLUDED.jumlah_penerima,
        dibuat_at = NOW();

  RETURN 'pengingat diproses untuk ' || cardinality(v_all) || ' PO; permintaan push ke ' || v_recipients || ' penerima';
END;
$$;

REVOKE ALL ON FUNCTION public.finance_kirim_pengingat_po_jatuh_tempo() FROM PUBLIC, anon, authenticated;

-- Sinkronisasi lengkap 11 trigger Stokist (dibaca oleh Kitchen & Purchasing via in.(kitchen,stokist) / in.(purchasing,stokist))
-- serta 1 trigger khusus Purchasing (PO Jatuh Tempo) di public.bot_trigger_catalog
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  ('tg_stok_permintaan_masuk', 'stokist', 'stokist',
   'Notifikasi Permintaan Bahan Masuk dari Outlet',
   'Notifikasi instan real-time saat outlet cabang membuat permintaan bahan baru ke Kitchen / Gudang Pusat.',
   'Trigger Permintaan (permintaan_bahan -> menunggu)', true, true, 1, true),
  ('tg_stok_defisit_gudang', 'stokist', 'stokist',
   'Alert Defisit Stok Gudang Pusat Terhadap Permintaan Cabang',
   'Alert darurat real-time saat total kuantiti bahan yang diminta outlet melebihi sisa fisik di Gudang Pusat.',
   'Trigger Defisit Gudang Pusat', true, true, 2, true),
  ('tg_stok_rekap_pengadaan_0830', 'stokist', 'stokist',
   'Rekap Harian Saran Pengadaan / PO Gudang Pusat (08:30 WIB)',
   'Rangkuman otomatis setiap pagi pukul 08:30 WIB berisi daftar bahan yang defisit atau di bawah batas aman untuk dibuatkan PO.',
   'Cron Rekap Pengadaan Pagi (08:30 WIB)', false, true, 3, true),
  ('tg_stok_rop_minimum', 'stokist', 'stokist',
   'Peringatan Stok Kritis / Batas Minimum (ROP)',
   'Peringatan saat saldo bahan baku di cabang atau gudang mendekati atau di bawah batas minimum pemesanan kembali.',
   'Trigger Saldo Stok Minimum', true, true, 4, true),
  ('tg_stok_drop50_anomali', 'stokist', 'stokist',
   'Alert Anomali Penurunan Stok Drastis (>= 50%)',
   'Deteksi dini potensi kehilangan/shrinkage saat stok berkurang minimal 50% dalam satu transaksi mutasi.',
   'Trigger Mutasi Saldo Stok', true, true, 5, true),
  ('tg_stok_verifikasi_sj', 'stokist', 'stokist',
   'Notifikasi Verifikasi Pengiriman Surat Jalan',
   'Notifikasi saat armada logistik mulai diberangkatkan dan saat kru outlet menyelesaikan verifikasi penerimaan barang fisik.',
   'Trigger Surat Jalan (dikirim / diterima)', true, true, 6, true),
  ('tg_stok_selisih_terima', 'stokist', 'stokist',
   'Alert Selisih Penerimaan Barang Surat Jalan',
   'Alert otomatis jika terdapat ketidaksesuaian kuantiti barang yang dikirim dari gudang dengan fisik yang diterima outlet.',
   'Trigger Verifikasi Surat Jalan (selisih != 0)', true, true, 7, true),
  ('tg_stok_sj_gantung_2h', 'stokist', 'stokist',
   'Alert Surat Jalan Menggantung (> 2 Jam Belum Diterima)',
   'Peringatan jika pengiriman barang sudah berstatus dikirim lebih dari 2 jam namun belum diverifikasi penerimaannya oleh outlet.',
   'Cron Cek Distribusi Tiap 10 Menit', false, true, 8, true),
  ('tg_stok_waste_approval', 'stokist', 'stokist',
   'Alert Pengajuan Waste / Bahan Rusak Menunggu Approval',
   'Alert saat ada pengajuan bahan rusak/basi/terbuang yang memerlukan otorisasi atau persetujuan supervisor/manajer.',
   'Trigger Laporan Waste', true, true, 9, true),
  ('tg_stok_opname_reminder', 'stokist', 'stokist',
   'Pengingat Jadwal Stock Opname Harian Cabang (21:00 WIB)',
   'Reminder otomatis pukul 21:00 WIB berisi daftar cabang yang belum menyelesaikan input stock opname harian.',
   'Cron Reminder Opname Malam (21:00 WIB)', false, true, 10, true),
  ('tg_stok_opname_rekap_2230', 'stokist', 'stokist',
   'Rekapitulasi Kepatuhan Opname Harian Seluruh Outlet (22:30 WIB)',
   'Laporan konsolidasi kepatuhan opname harian seluruh outlet sebelum cut-off operasional malam (outlet finalized vs belum opname).',
   'Cron Cut-Off Opname Malam (22:30 WIB)', false, true, 11, true),
  ('tg_purchasing_po_jatuh_tempo', 'purchasing', 'stokist',
   'Pengingat Jatuh Tempo Invoice Purchase Order (PO Supplier)',
   'Peringatan otomatis setiap pagi (08:15 WIB) untuk PO yang sudah diterima namun belum lunas dan jatuh tempo dalam <= 3 hari atau lewat jatuh tempo.',
   'Cron Harian Pagi (08:15 WIB)', false, true, 12, true)
ON CONFLICT (id) DO UPDATE SET
  target_role = EXCLUDED.target_role,
  bot_slug = EXCLUDED.bot_slug,
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
