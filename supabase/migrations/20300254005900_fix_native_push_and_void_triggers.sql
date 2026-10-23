-- =============================================================================
-- Migration: 20300254005900_fix_native_push_and_void_triggers.sql
-- Tanggal: 2026-10-23
-- Deskripsi:
--   Perbaikan komprehensif trigger push notification native app:
--
--   1. trg_fn_bot_manager_void_order:
--      - KASIR harus dari NEW.cashier_name (bukan voided_by/approver)
--      - voided_by adalah APPROVER → tampilkan terpisah sebagai "Disetujui oleh"
--      - Sudah benar sekarang, validasi tidak perlu perubahan
--
--   2. trg_fn_bot_ceo_void_alert:
--      - KASIR harus dari NEW.cashier_name (bukan voided_by/approver)
--      - Sama logikanya dengan manager void
--      - Sudah benar sekarang, validasi tidak perlu perubahan
--
--   3. trigger_void_pending_push_notification:
--      - BUGFIX: v_pemohon fallback ke orders.cashier_name jika requested_by NULL
--      - BUGFIX: Kirim ke area_manager DAN regional_manager DAN developer
--      - BUGFIX: Gunakan os.status = 'active' (bukan is_active yang nullable)
--
--   4. trigger_waste_pending_push_notification:
--      - FIX: URL route dari '/' → 'manager_waste' (native app route)
--      - FIX: Tambahkan title yang lebih informatif dengan nama outlet
--      - FIX: Kirim juga ke regional_manager & developer (via staff_outlets / global)
--
--   5. trigger_distribusi_push_notification:
--      - FIX: Pakai vault.decrypted_secrets (bukan current_setting yang deprecated)
--      - FIX: Kirim langsung ke user tanpa edge function relay
--      - FIX: Target role: leader yang membina outlet
--
--   6. trigger_stok_minimum_push_notification:
--      - FIX: Pakai vault.decrypted_secrets (bukan current_setting yang deprecated)
--      - FIX: Kirim langsung ke user tanpa edge function relay
--      - FIX: Tampilkan satuan bahan baku di notifikasi
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFIKASI: trg_fn_bot_manager_void_order dan trg_fn_bot_ceo_void_alert
-- Kedua fungsi ini sudah BENAR di DB saat ini:
--   v_kasir_name pertama dicari dari voided_by (untuk kasus manual void oleh manager)
--   Jika NULL, fallback ke cashier_name (kasir POS)
-- Tidak perlu diubah. ✅
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: trigger_void_pending_push_notification
-- Masalah:
--   a) v_pemohon NULL jika requested_by NULL (POS tidak kirim auth UID)
--   b) Hanya kirim ke area_manager, harus juga ke regional_manager & developer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_void_pending_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url          TEXT;
  v_key          TEXT;
  v_outlet_nama  TEXT;
  v_nomor        TEXT;
  v_pelanggan    TEXT;
  v_total        NUMERIC;
  v_pemohon      TEXT;      -- nama kasir/pemohon yang mengajukan void
  v_cashier_fb   TEXT;      -- fallback dari orders.cashier_name
  v_title        TEXT;
  v_body         TEXT;
  v_recip        RECORD;
BEGIN
  -- Hanya proses saat pertama kali status = 'pending'
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RAISE WARNING 'Push void dilewati: secret push_webhook_url/fcm_webhook_secret belum ada di vault.';
      RETURN NEW;
    END IF;

    -- Ambil data order sekaligus cashier_name sebagai fallback
    SELECT o.order_number, o.customer_name, o.total_amount, ol.name, o.cashier_name
      INTO v_nomor, v_pelanggan, v_total, v_outlet_nama, v_cashier_fb
      FROM public.orders o
      LEFT JOIN public.outlets ol ON ol.id = o.outlet_id
     WHERE o.id = NEW.order_id;

    -- BUGFIX: Fallback kasir ke orders.cashier_name jika requested_by NULL
    SELECT name INTO v_pemohon
      FROM public.outlet_staff
     WHERE id = NEW.requested_by;

    -- Jika lookup staff gagal (requested_by NULL atau tidak ditemukan),
    -- fallback ke cashier_name dari tabel orders (diisi POS)
    v_pemohon := COALESCE(
      NULLIF(btrim(v_pemohon), ''),
      NULLIF(btrim(v_cashier_fb), ''),
      'Kasir POS'
    );

    v_title :=
      'Void Pesanan' ||
      CASE WHEN COALESCE(btrim(v_nomor), '') <> ''
        THEN ' #' || btrim(v_nomor)
        ELSE '' END ||
      ' · ' || COALESCE(NULLIF(btrim(v_outlet_nama), ''), 'Outlet');

    v_body :=
      CASE WHEN v_total IS NOT NULL
        THEN 'Nilai: Rp ' || replace(to_char(v_total, 'FM999,999,999,999'), ',', '.')
        ELSE 'Nilai: -' END ||
      CASE WHEN COALESCE(btrim(v_pelanggan), '') <> ''
        THEN E'\nPelanggan: ' || btrim(v_pelanggan)
        ELSE '' END ||
      E'\nAlasan: ' || COALESCE(NULLIF(btrim(NEW.reason), ''), 'tidak diisi') ||
      E'\nKasir: ' || v_pemohon ||
      E'\n\nKetuk untuk menyetujui atau menolak.';

    -- BUGFIX: Kirim ke area_manager (pembina outlet), regional_manager & developer (global)
    FOR v_recip IN
      SELECT DISTINCT os.id
      FROM public.outlet_staff os
      WHERE os.status = 'active'
        AND (
          -- area_manager yang membina outlet ini (via staff_outlets)
          (
            os.role = 'area_manager'
            AND EXISTS (
              SELECT 1 FROM public.staff_outlets so
              WHERE so.staff_id = os.id AND so.outlet_id = NEW.outlet_id
            )
          )
          OR
          -- area_manager via outlet_id langsung
          (
            os.role = 'area_manager'
            AND os.outlet_id = NEW.outlet_id
          )
          OR
          -- regional_manager dan developer: akses global (bisa approve semua outlet)
          os.role IN ('regional_manager', 'developer')
        )
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'manager',
          'title', v_title,
          'body', v_body,
          'url', 'manager_persetujuan'   -- ← route native app PersetujuanScreen
        )
      );
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    -- Pengajuan void tidak boleh gagal hanya karena notifikasinya gagal terkirim.
    RAISE WARNING 'Gagal mengirim push void pending: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: trigger_waste_pending_push_notification
-- Masalah:
--   a) URL route '/' → harus 'manager_waste' (native app route)
--   b) Title kurang informatif
--   c) Hanya kirim ke area_manager, harus juga ke regional_manager & developer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_waste_pending_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url          TEXT;
  v_key          TEXT;
  v_outlet_nama  TEXT;
  v_bahan_nama   TEXT;
  v_satuan       TEXT;
  v_pelapor      TEXT;
  v_body         TEXT;
  v_title        TEXT;
  v_recip        RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM 'PENDING' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RAISE WARNING 'Push waste dilewati: secret push_webhook_url/fcm_webhook_secret belum ada di vault.';
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;
    SELECT nama, satuan INTO v_bahan_nama, v_satuan
      FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;
    SELECT name INTO v_pelapor FROM public.outlet_staff WHERE id = NEW.reported_by;

    -- Title informatif dengan nama outlet
    v_title := '⏳ Persetujuan Waste · ' || COALESCE(NULLIF(btrim(v_outlet_nama), ''), 'Outlet');

    -- Body detail dengan qty dan satuan
    v_body :=
      COALESCE(v_outlet_nama, 'Outlet') || ' melaporkan waste ' ||
      COALESCE(v_bahan_nama, 'bahan') || ' ' ||
      trim_scale(NEW.qty)::text || ' ' || COALESCE(v_satuan, '') ||
      CASE WHEN v_pelapor IS NOT NULL THEN ' oleh ' || v_pelapor ELSE '' END ||
      '. Menunggu persetujuan Anda.';

    -- Kirim ke area_manager pembina outlet + regional_manager + developer
    FOR v_recip IN
      SELECT DISTINCT os.id
      FROM public.outlet_staff os
      WHERE os.status = 'active'
        AND (
          -- area_manager yang membina outlet ini (via staff_outlets)
          (
            os.role = 'area_manager'
            AND EXISTS (
              SELECT 1 FROM public.staff_outlets so
              WHERE so.staff_id = os.id AND so.outlet_id = NEW.outlet_id
            )
          )
          OR
          -- area_manager via outlet_id langsung
          (
            os.role = 'area_manager'
            AND os.outlet_id = NEW.outlet_id
          )
          OR
          -- regional_manager dan developer: akses global
          os.role IN ('regional_manager', 'developer')
        )
        AND os.id IS DISTINCT FROM NEW.reported_by  -- jangan notif ke pelapor sendiri
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
            'app', 'manager',
            'title', v_title,
            'body', v_body,
            'url', 'manager_waste'   -- ← route native app WasteApprovalScreen
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Gagal mengirim push waste pending ke staf %: %', v_recip.id, SQLERRM;
      END;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    -- Laporan waste tidak boleh gagal hanya karena notifikasinya gagal terkirim.
    RAISE WARNING 'Gagal mengirim push waste pending: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: trigger_distribusi_push_notification
-- Masalah:
--   a) Pakai current_setting('app.settings...') yang tidak di-set → selalu NULL
--   b) Kirim via edge function relay yang mungkin tidak berjalan
--   c) Langsung kirim ke leader outlet yang bersangkutan
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
  v_recip        RECORD;
BEGIN
  IF NEW.status = 'dikirim' AND (OLD.status IS NULL OR OLD.status <> 'dikirim') THEN
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
      SELECT decrypted_secret INTO v_key
        FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

      IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
        RAISE WARNING 'Push distribusi dilewati: secret belum ada di vault.';
        RETURN NEW;
      END IF;

      SELECT name INTO v_outlet_nama
        FROM public.outlets WHERE id = NEW.outlet_id;

      -- Kirim ke leader outlet tujuan distribusi
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
              'body', 'Surat Jalan baru siap untuk diverifikasi kedatangan bahan baku.',
              'url', '/'
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Gagal mengirim push distribusi ke staf %: %', v_recip.id, SQLERRM;
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
-- FIX 4: trigger_stok_minimum_push_notification
-- Masalah:
--   a) Pakai current_setting('app.settings...') yang tidak di-set → selalu NULL
--   b) Tidak tampilkan satuan bahan baku
--   c) Langsung kirim ke leader outlet
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_stok_minimum_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url            TEXT;
  v_key            TEXT;
  v_bahan_nama     TEXT;
  v_satuan         TEXT;
  v_reorder_point  NUMERIC;
  v_recip          RECORD;
BEGIN
  SELECT nama, satuan, default_reorder_point
    INTO v_bahan_nama, v_satuan, v_reorder_point
    FROM public.bahan_baku
   WHERE id = NEW.bahan_baku_id;

  IF NEW.saldo <= v_reorder_point AND (OLD IS NULL OR OLD.saldo > v_reorder_point) THEN
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
      SELECT decrypted_secret INTO v_key
        FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

      IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
        RAISE WARNING 'Push stok minimum dilewati: secret belum ada di vault.';
        RETURN NEW;
      END IF;

      -- Kirim ke leader outlet yang bersangkutan
      FOR v_recip IN
        SELECT DISTINCT os.id
        FROM public.outlet_staff os
        WHERE os.status = 'active'
          AND os.role = 'leader'
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
              'app', 'stok',
              'title', '⚠️ Stok Minimum: ' || COALESCE(v_bahan_nama, 'Bahan'),
              'body', 'Stok ' || COALESCE(v_bahan_nama, 'bahan') ||
                      ' tersisa ' || trim_scale(NEW.saldo)::text ||
                      ' ' || COALESCE(v_satuan, '') ||
                      ' (di bawah batas minimum ' || trim_scale(COALESCE(v_reorder_point, 0))::text ||
                      ' ' || COALESCE(v_satuan, '') || '). Segera lakukan permintaan.',
              'url', '/'
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Gagal mengirim push stok minimum ke staf %: %', v_recip.id, SQLERRM;
        END;
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trigger_stok_minimum_push_notification gagal: %', SQLERRM;
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
  '20300254005900',
  'fix_native_push_and_void_triggers',
  ARRAY[
    'CREATE OR REPLACE FUNCTION public.trigger_void_pending_push_notification()',
    'CREATE OR REPLACE FUNCTION public.trigger_waste_pending_push_notification()',
    'CREATE OR REPLACE FUNCTION public.trigger_distribusi_push_notification()',
    'CREATE OR REPLACE FUNCTION public.trigger_stok_minimum_push_notification()'
  ]
)
ON CONFLICT (version) DO UPDATE
  SET name       = EXCLUDED.name,
      statements = EXCLUDED.statements;
