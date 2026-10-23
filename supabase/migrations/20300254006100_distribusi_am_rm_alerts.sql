-- =============================================================================
-- Migration: 20300254006100_distribusi_am_rm_alerts.sql
-- Tanggal: 2026-10-23
-- Deskripsi:
--   Implementasi Notifikasi Distribusi Logistik & Bahan Baku untuk Area Manager (AM)
--   dan Regional Manager (RM):
--
--   1. bot_telegram_alert_selisih_penerimaan (Trigger tabel surat_jalan saat status = 'diterima_sebagian'):
--      - Menambahkan pengiriman alert ke Area Manager (AM) pembina outlet.
--      - Menambahkan pengiriman eskalasi ke Regional Manager (RM) & Developer.
--      - Mengambil detail rincian item bahan baku yang mengalami selisih dari surat_jalan_item.
--      - Menggunakan public.bot_manager_antrekan(...) sehingga terkirim ke:
--          a) Push Notification HP Native (SUKA Superapp)
--          b) Telegram Bot Manager
--
--   2. trigger_distribusi_push_notification (Trigger tabel surat_jalan saat status = 'dikirim'):
--      - Menambahkan pengiriman alert keberangkatan ke Area Manager (AM) pembina cabang,
--        sehingga AM mengetahui secara real-time pengiriman bahan baku menuju gerainya.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trigger Selisih Penerimaan Distribusi (Kitchen -> Cabang)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_selisih_penerimaan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_outlet_name text;
  v_doc_no text;
  v_item_detail text := '';
  r record;
  v_ceo record;
  v_am record;
  v_rm record;
  v_item record;
  v_item_count int := 0;
BEGIN
  -- Hanya jalankan saat transisi status menjadi 'diterima_sebagian'
  IF NEW.status <> 'diterima_sebagian' OR OLD.status IS NOT DISTINCT FROM 'diterima_sebagian' THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');
  IF v_outlet_name IS NULL THEN RETURN NEW; END IF;

  v_doc_no := coalesce(NEW.document_number, substr(NEW.id::text, 1, 8));

  -- Kumpulkan rincian bahan baku yang mengalami selisih (maks 5 item pertama agar pesan ringkas)
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
    v_item_count := v_item_count + 1;
    IF v_item_count <= 4 THEN
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

  IF v_item_count > 4 THEN
    v_item_detail := v_item_detail || format(E'\n• (+%s item selisih lainnya...)', v_item_count - 4);
  END IF;

  IF v_item_detail = '' THEN
    v_item_detail := E'\n(Item berstatus selisih fisik belum diperinci)';
  END IF;

  -- A. Kirim ke Kitchen & Purchasing via Bot Stokis
  FOR r IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'distribusi',
      '⚠️ Selisih penerimaan · ' || v_outlet_name,
      'Penerimaan surat jalan ' || v_doc_no || ' di ' || v_outlet_name || ' memiliki item yang ditandai selisih.' || v_item_detail || E'\n\nMohon tinjau hasil verifikasinya.',
      'https://distribusi.sukashawarma.com/distribusi/terima/' || NEW.id::text,
      NEW.outlet_id
    );
  END LOOP;

  -- B. Kirim ke Area Manager (AM) pembina outlet binaan (Push HP Native + Telegram Bot Manager)
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
      format(
        E'Penerimaan logistik di cabang binaan Anda dilaporkan ada SELISIH FISIK / BARANG KURANG.\nOutlet: %s\nNo. SJ: %s\n\nRincian Item Selisih:%s\n\nSegera hubungi Leader cabang dan koordinasikan penyelesaiannya dengan Kitchen.',
        v_outlet_name,
        v_doc_no,
        v_item_detail
      ),
      'bot'
    );
  END LOOP;

  -- C. Eskalasi ke Regional Manager (RM) & Developer
  FOR v_rm IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('regional_manager', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      format('sj_selisih_rm:%s:%s', NEW.id::text, v_rm.id::text),
      v_rm.id,
      '🚨 [ESKALASI RM] Selisih Logistik — ' || v_outlet_name,
      format(
        E'Deteksi selisih penerimaan logistik di gerai cabang.\nOutlet: %s\nNo. SJ: %s\n\nRincian Item Selisih:%s\n\nMohon monitor tindak lanjut Area Manager bersama tim Kitchen/Logistik.',
        v_outlet_name,
        v_doc_no,
        v_item_detail
      ),
      'bot'
    );
  END LOOP;

  -- D. Eskalasi ke Bot CEO (Owner / Admin)
  FOR v_ceo IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('owner', 'admin')
  LOOP
    PERFORM public.bot_ceo_antrekan(
      'sj_selisih_ceo:' || NEW.id::text || ':' || v_ceo.id::text,
      v_ceo.id,
      '⚠️ [SELISIH SURAT JALAN] ' || v_outlet_name,
      format(
        E'Penerimaan logistik di cabang memiliki item dengan selisih fisik barang.\nOutlet: %s\nNo. SJ: %s\n\nRincian Item Selisih:%s\n\nRekonsiliasi pengiriman dapat ditinjau via Admin Dashboard.',
        v_outlet_name,
        v_doc_no,
        v_item_detail
      ),
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_selisih_penerimaan gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger Pengiriman Distribusi Berangkat (Status = 'dikirim')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_distribusi_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url          TEXT;
  v_key          TEXT;
  v_outlet_nama  TEXT;
  v_doc_no       TEXT;
  v_recip        RECORD;
  v_am           RECORD;
BEGIN
  IF NEW.status = 'dikirim' AND (OLD.status IS NULL OR OLD.status <> 'dikirim') THEN
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
      SELECT decrypted_secret INTO v_key
        FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

      SELECT name INTO v_outlet_nama
        FROM public.outlets WHERE id = NEW.outlet_id;

      v_doc_no := coalesce(NEW.document_number, substr(NEW.id::text, 1, 8));

      -- A. Kirim Push Notification ke Leader & Kru di outlet tujuan
      IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
        FOR v_recip IN
          SELECT DISTINCT os.id
          FROM public.outlet_staff os
          WHERE os.status = 'active'
            AND os.role IN ('leader', 'crew')
            AND (
              os.outlet_id = NEW.outlet_id
              OR EXISTS (
                SELECT 1 FROM public.staff_outlets so
                WHERE so.staff_id = os.id AND so.outlet_id = NEW.outlet_id
              )
            )
        LOOP
          BEGIN
            PERFORM net.http_post(
              url := v_url,
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
              ),
              body := jsonb_build_object(
                'user_id', v_recip.id,
                'app', 'distribusi',
                'title', '📦 Bahan Baku Sedang Dikirim · ' || COALESCE(v_outlet_nama, 'Outlet'),
                'body', 'Surat Jalan #' || v_doc_no || ' baru siap untuk diverifikasi kedatangan bahan baku.',
                'url', '/'
              )
            );
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Gagal mengirim push distribusi ke kru %: %', v_recip.id, SQLERRM;
          END;
        END LOOP;
      END IF;

      -- B. Kirim Alert ke Area Manager (AM) pembina outlet (Push HP Native + Telegram Bot)
      FOR v_am IN
        SELECT DISTINCT s.id
        FROM public.outlet_staff s
        JOIN public.staff_outlets so ON so.staff_id = s.id
        WHERE so.outlet_id = NEW.outlet_id
          AND s.role = 'area_manager'
          AND s.status = 'active'
      LOOP
        BEGIN
          PERFORM public.bot_manager_antrekan(
            format('sj_kirim_am:%s:%s', NEW.id::text, v_am.id::text),
            v_am.id,
            '🚚 [PENGIRIMAN LOGISTIK] ' || coalesce(v_outlet_nama, 'Outlet'),
            format(
              E'Bahan baku sedang dalam perjalanan menuju outlet binaan Anda.\nOutlet: %s\nNo. SJ: %s\n\nPastikan kru/leader outlet standby menerima dan melakukan verifikasi timbangan barang saat tiba.',
              coalesce(v_outlet_nama, 'Outlet'),
              v_doc_no
            ),
            'bot'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Gagal antrekan alert distribusi ke AM %: %', v_am.id, SQLERRM;
        END;
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trigger_distribusi_push_notification gagal: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Catat migration ke schema_migrations
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20300254006100',
  'distribusi_am_rm_alerts',
  ARRAY[
    'CREATE OR REPLACE FUNCTION public.bot_telegram_alert_selisih_penerimaan()',
    'CREATE OR REPLACE FUNCTION public.trigger_distribusi_push_notification()'
  ]
)
ON CONFLICT (version) DO UPDATE
  SET name       = EXCLUDED.name,
      statements = EXCLUDED.statements;
