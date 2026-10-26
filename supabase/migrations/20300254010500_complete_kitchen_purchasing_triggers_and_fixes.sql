-- =============================================================================
-- Migration: 20300254010500_complete_kitchen_purchasing_triggers_and_fixes.sql
-- Tanggal: 2026-10-26
-- Deskripsi:
--   Menuntaskan seluruh temuan audit /bug-hunt-swarm untuk role 'kitchen' dan
--   'purchasing' baik di Database (Supabase), Cron, maupun Native App Push:
--
--   1. bot_telegram_kirim_alert:
--      - Tambah parameter opsional p_event_key TEXT DEFAULT NULL agar pemanggil
--        bisa mengirimkan ID transaksi eksak (mencegah tabrakan hash MD5 1 jam).
--      - Pastikan seluruh staf aktif 'kitchen' & 'purchasing' terdaftar di
--        public.bot_telegram_access.
--
--   2. stok_push_waste_pending_approval:
--      - Hapus panggilan net.http_post kedua yang menyebabkan duplikasi 2 push
--        notification di HP dan melempar user ke browser eksternal.
--      - Sertakan rincian nama bahan, kuantitas adaptif, dan nama pelapor,
--        serta gunakan p_event_key := 'waste_pending:' || NEW.id::text.
--
--   3. bot_telegram_alert_permintaan_bahan & trg_bot_telegram_permintaan_bahan:
--      - Tangani AFTER INSERT OR UPDATE OF status menuju 'menunggu' dengan guard
--        transisi status dan p_event_key := 'permintaan_bahan:' || NEW.id::text.
--
--   4. bot_telegram_alert_gudang_defisit_permintaan &
--      bot_telegram_rekap_pengadaan_gudang_pagi:
--      - Terapkan konversi skala satuan (saldo_is_gram, to_ledger_scale) dan
--        pemformatan multi-unit (bot_format_stok_adaptive) agar bahan gudang
--        berskala gram/lembar terdeteksi akurat dan tampil identik apps/stok.
--
--   5. bot_telegram_opname_harian_kitchen_data:
--      - Filter dengan bot_is_sales_outlet(o.id) dan
--        NOT bot_is_outlet_tutup_sementara(o.id) agar outlet non-penjualan
--        (SS BACKUP, Gudang, Kantor Pusat) tidak ikut terhitung belum opname.
--
--   6. bot_telegram_alert_verifikasi_surat_jalan:
--      - Kirim juga notifikasi saat SJ diberangkatkan ('dikirim'/'dikirim_lengkap')
--        ke Kitchen, Purchasing, dan Area Manager sesuai kontrak katalog trigger.
--      - Bedakan judul saat SJ ditutup oleh sistem otomatis (auto_verified_at)
--        vs diverifikasi oleh kru cabang, dan gunakan p_event_key eksak.
--
--   7. finance_po_pengingat_push_log, finance_po_pengingat_kandidat, &
--      finance_kirim_pengingat_po_jatuh_tempo:
--      - Buat tabel & fungsi kandidat yang sempat hilang di remote DB, tambahkan
--        GRANT EXECUTE TO service_role, hapus duplikasi FCM kedua, dan jadwalkan
--        cron 'finance-po-pengingat-jatuh-tempo' (08:15 WIB).
--
--   8. Trigger baru retur_stok (trg_bot_stokist_alert_retur) &
--      purchase_order (trg_bot_stokist_alert_po_status) untuk Kitchen & Purchasing.
-- =============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Upgrade bot_telegram_kirim_alert dengan p_event_key Opsional & Sync Access
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.bot_telegram_access (staff_id)
SELECT id FROM public.outlet_staff
WHERE status = 'active'
  AND role IN ('kitchen', 'purchasing', 'owner', 'admin', 'developer')
ON CONFLICT (staff_id) DO NOTHING;

DROP FUNCTION IF EXISTS public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.bot_telegram_kirim_alert(
  p_staff_id UUID,
  p_app TEXT,
  p_title TEXT,
  p_body TEXT,
  p_url TEXT,
  p_outlet_id UUID DEFAULT NULL,
  p_event_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
  v_role TEXT;
  v_bot_slug TEXT;
  v_push_key TEXT;
BEGIN
  IF p_staff_id IS NULL OR p_app IS NULL OR p_app NOT IN ('stok', 'distribusi')
    OR p_title IS NULL OR p_body IS NULL THEN
    RETURN;
  END IF;

  SELECT s.role INTO v_role
  FROM public.outlet_staff s
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role <> 'leader'
    AND (
      p_outlet_id IS NULL
      OR s.role IN ('owner', 'admin', 'kitchen', 'purchasing', 'developer')
      OR s.outlet_id = p_outlet_id
      OR EXISTS (
        SELECT 1 FROM public.staff_outlets so
        WHERE so.staff_id = s.id AND so.outlet_id = p_outlet_id
      )
    );

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  v_bot_slug := CASE WHEN v_role = 'kitchen' THEN 'kitchen' ELSE 'stokis' END;

  IF NULLIF(btrim(p_event_key), '') IS NOT NULL THEN
    v_push_key := 'stokist:' || p_app || ':' || btrim(p_event_key);
  ELSE
    v_push_key := 'stokist:' || p_app || ':' || md5(
      p_staff_id::text || p_title || p_body || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD-HH24')
    );
  END IF;

  -- 1. Jalur Notifikasi HP Native (SUKA Superapp: Realtime + FCM)
  PERFORM public.bot_kirim_push_hp(
    v_push_key,
    p_staff_id,
    v_bot_slug,
    p_title,
    p_body,
    'bot'
  );

  -- 2. Jalur Telegram Stokist: bagi yang sudah menautkan Telegram
  IF NOT EXISTS (
    SELECT 1
    FROM public.bot_telegram_access a
    JOIN public.bot_telegram_links l ON l.staff_id = a.staff_id
    WHERE a.staff_id = p_staff_id
      AND l.chat_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_secret, '') = '' THEN
    RAISE WARNING 'Alert Stokist % dilewati: Vault belum tersedia.', p_app;
    RETURN;
  END IF;

  v_request_id := net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json',
      'User-Agent', 'SukaShawarma-Stokist-Alerts/1.0',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'user_id', p_staff_id,
      'app', p_app,
      'title', left(p_title, 180),
      'body', left(p_body, 1200),
      'url', p_url
    ),
    timeout_milliseconds := 15000
  );

  INSERT INTO public.bot_telegram_alert_delivery_request (request_id, app)
  VALUES (v_request_id, p_app)
  ON CONFLICT (request_id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.bot_telegram_alert_delivery_failure(p_app, 'endpoint_enqueue_failed');
  RAISE WARNING 'Gagal mengantrekan alert Telegram % untuk staf %: %', p_app, p_staff_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Perbaikan stok_push_waste_pending_approval (Tanpa Double Push & Rincian Lengkap)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stok_push_waste_pending_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name TEXT;
  v_bahan_nama TEXT;
  v_qty_str TEXT;
  v_pelapor TEXT;
  v_alasan TEXT;
  v_title TEXT;
  v_body TEXT;
  v_recip RECORD;
BEGIN
  IF NEW.status <> 'PENDING'
    OR (TG_OP = 'UPDATE' AND OLD.status = 'PENDING') THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id;

  SELECT b.nama INTO v_bahan_nama
  FROM public.bahan_baku b
  WHERE b.id = NEW.bahan_baku_id;

  SELECT s.name INTO v_pelapor
  FROM public.outlet_staff s
  WHERE s.id = NEW.reported_by;

  v_qty_str := public.bot_format_delta_outlet(NEW.qty, NEW.outlet_id, NEW.bahan_baku_id);
  v_alasan := NULLIF(btrim(NEW.reason), '');

  v_title := '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet');
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || COALESCE(v_bahan_nama, 'Bahan Baku') || ' (' || COALESCE(v_qty_str, trim_scale(NEW.qty)::text) || ')'
    || CASE WHEN v_pelapor IS NOT NULL THEN E'\nPelapor: ' || v_pelapor ELSE '' END
    || CASE WHEN v_alasan IS NOT NULL THEN E'\nAlasan: ' || left(v_alasan, 120) ELSE '' END
    || E'\n\nAda laporan waste baru yang perlu ditinjau.';

  -- Kirim ke tim Stokis Pusat (admin, kitchen, purchasing, developer) via jalur terpadu Bot
  -- (Area Manager & Regional Manager sudah ditangani oleh bot_manager_alert_waste & manager_waste)
  FOR v_recip IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin', 'kitchen', 'purchasing', 'developer')
      AND s.id IS DISTINCT FROM NEW.reported_by
  LOOP
    BEGIN
      PERFORM public.bot_telegram_kirim_alert(
        v_recip.id,
        'stok',
        v_title,
        v_body,
        'https://stok.sukashawarma.com/stok/waste/approval',
        NEW.outlet_id,
        'waste_pending:' || NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim notif waste % kepada staf %: %', NEW.id, v_recip.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_push_waste_pending_approval() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Perbaikan Permintaan Bahan Masuk (Support INSERT & UPDATE status -> 'menunggu')
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
  IF NEW.status <> 'menunggu'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'menunggu') THEN
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
      NEW.outlet_id,
      'permintaan_bahan:' || NEW.id::text
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert permintaan bahan: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_permintaan_bahan() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_telegram_permintaan_bahan ON public.permintaan_bahan;
CREATE CONSTRAINT TRIGGER trg_bot_telegram_permintaan_bahan
  AFTER INSERT OR UPDATE OF status ON public.permintaan_bahan
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_permintaan_bahan();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Perbaikan Skala Multi-Unit (saldo_is_gram & to_ledger_scale) pada
--    Defisit Stok Gudang Pusat & Rekap Pengadaan Pagi (08:30 WIB)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_gudang_defisit_permintaan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gudang_id uuid;
  v_gudang_name text;
  v_outlet_name text;
  v_defisit_list text;
  v_defisit_count int := 0;
  v_title text;
  v_body text;
  v_url text := 'https://stok.sukashawarma.com/stok/permintaan';
  r record;
BEGIN
  IF NEW.status <> 'menunggu'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'menunggu') THEN
    RETURN NEW;
  END IF;

  SELECT id, name INTO v_gudang_id, v_gudang_name
  FROM public.outlets
  WHERE is_active IS TRUE AND (type = 'gudang' OR slug = 'hq')
  ORDER BY (id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid) DESC
  LIMIT 1;

  IF v_gudang_id IS NULL OR NEW.outlet_id = v_gudang_id THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id;

  -- Bandingkan qty_diminta dalam skala ledger Gudang Pusat (gram-scale vs besar-scale)
  WITH evaluasi_item AS (
    SELECT
      b.id AS bahan_baku_id,
      b.nama,
      b.satuan,
      b.satuan_tengah,
      b.faktor_tengah,
      b.satuan_kecil,
      b.faktor_tampilan,
      COALESCE(public.saldo_is_gram(sb), false) AS is_gram,
      COALESCE(sb.saldo, 0) AS saldo_gudang,
      CASE
        WHEN COALESCE(public.saldo_is_gram(sb), false) THEN
          public.to_ledger_scale(v_gudang_id, b.id, pbi.qty_diminta)
        ELSE pbi.qty_diminta
      END AS qty_diminta_scaled
    FROM public.permintaan_bahan_item pbi
    JOIN public.bahan_baku b ON b.id = pbi.bahan_baku_id AND b.is_active IS TRUE
    LEFT JOIN public.stok_balance sb ON sb.bahan_baku_id = pbi.bahan_baku_id AND sb.outlet_id = v_gudang_id
    WHERE pbi.permintaan_id = NEW.id
  )
  SELECT
    string_agg(
      '• ' || e.nama || ': Diminta '
      || public.bot_format_stok_adaptive(e.qty_diminta_scaled, e.is_gram, e.satuan, e.satuan_tengah, e.faktor_tengah, e.satuan_kecil, e.faktor_tampilan)
      || ' | Sisa Gudang: '
      || public.bot_format_stok_adaptive(e.saldo_gudang, e.is_gram, e.satuan, e.satuan_tengah, e.faktor_tengah, e.satuan_kecil, e.faktor_tampilan)
      || ' (Kurang: '
      || public.bot_format_stok_adaptive(e.qty_diminta_scaled - e.saldo_gudang, e.is_gram, e.satuan, e.satuan_tengah, e.faktor_tengah, e.satuan_kecil, e.faktor_tampilan)
      || ')',
      E'\n'
      ORDER BY e.nama
    ),
    count(*)::int
  INTO v_defisit_list, v_defisit_count
  FROM evaluasi_item e
  WHERE e.qty_diminta_scaled > e.saldo_gudang;

  IF v_defisit_count = 0 OR v_defisit_list IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := '🚨 Defisit Stok Gudang Pusat · ' || COALESCE(v_outlet_name, 'Outlet');
  v_body := 'Permintaan bahan dari cabang MELEBIHI sisa stok fisik di Gudang Pusat:'
    || E'\n\nCabang Pemohon: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
    || E'\n\nDaftar Bahan Defisit (' || v_defisit_count || ' item):\n' || v_defisit_list
    || E'\n\n⚠️ Mohon tim Purchasing segera koordinasi pengadaan / PO ke supplier agar distribusi cabang tidak terhambat.';

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('purchasing', 'kitchen', 'owner', 'admin')
      AND s.role <> 'leader'
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      v_title,
      v_body,
      v_url,
      v_gudang_id,
      'defisit_gudang:' || NEW.id::text
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert defisit stok gudang pusat: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_gudang_defisit_permintaan() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(
  p_sekarang TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_gudang_id UUID;
  v_gudang_name TEXT;
  v_mendesak_list TEXT := '';
  v_menipis_list TEXT := '';
  v_count_mendesak INT := 0;
  v_count_menipis INT := 0;
  v_total_perlu INT := 0;
  v_title TEXT;
  v_body TEXT;
  v_url TEXT := 'https://stok.sukashawarma.com/stok/monitoring';
  v_recipients INT := 0;
  r RECORD;
  recipient RECORD;
BEGIN
  IF p_sekarang IS NULL OR NOT isfinite(p_sekarang) THEN RETURN 0; END IF;
  v_date := (p_sekarang AT TIME ZONE 'Asia/Jakarta')::date;

  IF NOT pg_try_advisory_xact_lock(hashtext('gudang-rekap-po:' || v_date::text)) THEN
    RETURN 0;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bot_telegram_gudang_po_log WHERE tanggal = v_date) THEN
    RETURN 0;
  END IF;

  SELECT id, name INTO v_gudang_id, v_gudang_name
  FROM public.outlets
  WHERE is_active IS TRUE AND (type = 'gudang' OR slug = 'hq')
  ORDER BY (id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid) DESC
  LIMIT 1;

  IF v_gudang_id IS NULL THEN RETURN 0; END IF;

  FOR r IN
    WITH raw_hq AS (
      SELECT b.id AS bahan_baku_id,
             b.nama,
             b.satuan,
             b.satuan_tengah,
             b.faktor_tengah,
             b.satuan_kecil,
             b.faktor_tampilan,
             COALESCE(public.saldo_is_gram(sb), false) AS is_gram,
             COALESCE(sb.saldo, 0) AS saldo_gudang,
             CASE
               WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
                 (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
               ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
             END AS raw_threshold
      FROM public.bahan_baku b
      LEFT JOIN public.stok_balance sb ON sb.bahan_baku_id = b.id AND sb.outlet_id = v_gudang_id
      LEFT JOIN public.outlet_reorder_point orp ON orp.bahan_baku_id = b.id AND orp.outlet_id = v_gudang_id
      WHERE b.is_active IS TRUE
    ),
    permintaan_cabang AS (
      SELECT pbi.bahan_baku_id,
             COALESCE(SUM(pbi.qty_diminta), 0) AS raw_diminta
      FROM public.permintaan_bahan_item pbi
      JOIN public.permintaan_bahan pb ON pb.id = pbi.permintaan_id
      WHERE pb.status = 'menunggu'
      GROUP BY pbi.bahan_baku_id
    ),
    po_aktif AS (
      SELECT poi.bahan_baku_id,
             COALESCE(SUM(GREATEST(poi.qty_pesan - COALESCE(poi.qty_terima, 0), 0)), 0) AS raw_po_jalan
      FROM public.purchase_order_item poi
      JOIN public.purchase_order po ON po.id = poi.purchase_order_id
      WHERE po.status IN ('menunggu_approval_finance', 'disetujui_finance', 'dikirim_ke_supplier', 'sebagian_diterima')
      GROUP BY poi.bahan_baku_id
    ),
    scaled AS (
      SELECT
        rh.bahan_baku_id,
        rh.nama,
        rh.satuan,
        rh.satuan_tengah,
        rh.faktor_tengah,
        rh.satuan_kecil,
        rh.faktor_tampilan,
        rh.is_gram,
        rh.saldo_gudang,
        CASE WHEN rh.is_gram THEN public.to_ledger_scale(v_gudang_id, rh.bahan_baku_id, rh.raw_threshold) ELSE rh.raw_threshold END AS threshold,
        CASE WHEN rh.is_gram THEN public.to_ledger_scale(v_gudang_id, rh.bahan_baku_id, COALESCE(pc.raw_diminta, 0)) ELSE COALESCE(pc.raw_diminta, 0) END AS permintaan_pending,
        CASE WHEN rh.is_gram THEN public.to_ledger_scale(v_gudang_id, rh.bahan_baku_id, COALESCE(pa.raw_po_jalan, 0)) ELSE COALESCE(pa.raw_po_jalan, 0) END AS po_jalan
      FROM raw_hq rh
      LEFT JOIN permintaan_cabang pc ON pc.bahan_baku_id = rh.bahan_baku_id
      LEFT JOIN po_aktif pa ON pa.bahan_baku_id = rh.bahan_baku_id
    )
    SELECT
      sc.*,
      public.bot_format_stok_adaptive(sc.saldo_gudang, sc.is_gram, sc.satuan, sc.satuan_tengah, sc.faktor_tengah, sc.satuan_kecil, sc.faktor_tampilan) AS saldo_str,
      public.bot_format_stok_adaptive(sc.threshold, sc.is_gram, sc.satuan, sc.satuan_tengah, sc.faktor_tengah, sc.satuan_kecil, sc.faktor_tampilan) AS threshold_str,
      public.bot_format_stok_adaptive(sc.permintaan_pending, sc.is_gram, sc.satuan, sc.satuan_tengah, sc.faktor_tengah, sc.satuan_kecil, sc.faktor_tampilan) AS diminta_str,
      public.bot_format_stok_adaptive(sc.po_jalan, sc.is_gram, sc.satuan, sc.satuan_tengah, sc.faktor_tengah, sc.satuan_kecil, sc.faktor_tampilan) AS po_str,
      CASE
        WHEN sc.saldo_gudang <= 0
          OR (sc.permintaan_pending > 0 AND sc.saldo_gudang < sc.permintaan_pending)
          OR sc.saldo_gudang <= (sc.threshold * 0.3) THEN 'mendesak'
        WHEN sc.saldo_gudang <= sc.threshold
          OR (sc.saldo_gudang + sc.po_jalan) < (sc.threshold + sc.permintaan_pending) THEN 'menipis'
        ELSE 'aman'
      END AS status_kebutuhan
    FROM scaled sc
    WHERE sc.saldo_gudang <= sc.threshold
       OR (sc.permintaan_pending > 0 AND sc.saldo_gudang < sc.permintaan_pending)
       OR (sc.saldo_gudang + sc.po_jalan) < (sc.threshold + sc.permintaan_pending)
    ORDER BY
      CASE WHEN sc.saldo_gudang <= 0 OR (sc.permintaan_pending > 0 AND sc.saldo_gudang < sc.permintaan_pending) THEN 0
           WHEN sc.saldo_gudang <= (sc.threshold * 0.3) THEN 1
           ELSE 2 END,
      sc.nama
  LOOP
    IF r.status_kebutuhan = 'mendesak' THEN
      v_count_mendesak := v_count_mendesak + 1;
      IF v_count_mendesak <= 12 THEN
        v_mendesak_list := v_mendesak_list || E'• *' || r.nama || E'*\n'
          || '  - Sisa Gudang: ' || r.saldo_str
          || (CASE WHEN r.permintaan_pending > 0 THEN ' | Diminta Cabang: ' || r.diminta_str ELSE '' END)
          || (CASE WHEN r.po_jalan > 0 THEN ' | PO Jalan: ' || r.po_str ELSE ' | PO Jalan: 0' END)
          || E'\n';
      END IF;
    ELSIF r.status_kebutuhan = 'menipis' THEN
      v_count_menipis := v_count_menipis + 1;
      IF v_count_menipis <= 8 THEN
        v_menipis_list := v_menipis_list || E'• ' || r.nama
          || ': Sisa ' || r.saldo_str
          || ' (Batas Aman: ' || r.threshold_str || ')'
          || (CASE WHEN r.po_jalan > 0 THEN ', PO: ' || r.po_str ELSE '' END)
          || E'\n';
      END IF;
    END IF;
  END LOOP;

  v_total_perlu := v_count_mendesak + v_count_menipis;

  IF v_total_perlu = 0 THEN
    INSERT INTO public.bot_telegram_gudang_po_log (tanggal, jumlah_mendesak, jumlah_menipis, dikirim_at)
    VALUES (v_date, 0, 0, NOW())
    ON CONFLICT (tanggal) DO NOTHING;
    RETURN 0;
  END IF;

  v_title := '📋 Rekap Saran Pengadaan Gudang Pusat (08:30 WIB)';
  v_body := 'Evaluasi Buffer Stok Gudang Pusat & Antrean Cabang:'
    || E'\nTanggal: ' || to_char(p_sekarang AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY') || ' · 08:30 WIB\n';

  IF v_count_mendesak > 0 THEN
    v_body := v_body || E'\n🔴 *STATUS MENDESAK (' || v_count_mendesak || ' bahan):*\n' || v_mendesak_list;
    IF v_count_mendesak > 12 THEN
      v_body := v_body || '  ...dan ' || (v_count_mendesak - 12) || E' bahan mendesak lainnya\n';
    END IF;
  END IF;

  IF v_count_menipis > 0 THEN
    v_body := v_body || E'\n🟡 *STATUS MENIPIS (' || v_count_menipis || ' bahan):*\n' || v_menipis_list;
    IF v_count_menipis > 8 THEN
      v_body := v_body || '  ...dan ' || (v_count_menipis - 8) || E' bahan menipis lainnya\n';
    END IF;
  END IF;

  v_body := v_body || E'\n👉 *Tindakan Disarankan:* Segera buat Purchase Order (PO) ke supplier sebelum batas waktu cutoff pengiriman hari ini.';

  FOR recipient IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('purchasing', 'kitchen', 'owner', 'admin')
      AND s.role <> 'leader'
  LOOP
    BEGIN
      PERFORM public.bot_telegram_kirim_alert(
        recipient.id,
        'stok',
        v_title,
        v_body,
        v_url,
        v_gudang_id,
        'rekap_po_gudang:' || v_date::text
      );
      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim rekap pengadaan gudang kepada staf %: %', recipient.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.bot_telegram_gudang_po_log (tanggal, jumlah_mendesak, jumlah_menipis, dikirim_at)
  VALUES (v_date, v_count_mendesak, v_count_menipis, NOW())
  ON CONFLICT (tanggal) DO UPDATE
  SET jumlah_mendesak = EXCLUDED.jumlah_mendesak,
      jumlah_menipis = EXCLUDED.jumlah_menipis,
      dikirim_at = EXCLUDED.dikirim_at;

  RETURN v_recipients;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(TIMESTAMPTZ) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Filter Outlet Penjualan & Tidak Tutup Sementara pada Opname Harian Kitchen
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_opname_harian_kitchen_data(p_tanggal DATE)
RETURNS TABLE (
  outlet_id UUID, outlet_name TEXT, status_opname TEXT,
  pic_name TEXT, tercatat_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, COALESCE(op.status, 'belum_mulai'),
         COALESCE(NULLIF(author.name, ''), pic.names, 'PIC belum tercatat'),
         CASE WHEN op.status = 'finalized'
           THEN COALESCE(op.approved_at, op.updated_at, op.created_at)
           ELSE COALESCE(op.updated_at, op.created_at) END
  FROM public.outlets o
  LEFT JOIN LATERAL (
    SELECT p.status, p.created_by, p.created_at, p.updated_at, p.approved_at
    FROM public.opname p
    WHERE p.outlet_id = o.id AND p.tanggal = p_tanggal AND p.tipe = 'harian'
    ORDER BY (p.status = 'finalized') DESC,
             COALESCE(p.updated_at, p.created_at) DESC NULLS LAST, p.id DESC
    LIMIT 1
  ) op ON TRUE
  LEFT JOIN public.outlet_staff author ON author.id = op.created_by
  LEFT JOIN LATERAL (
    SELECT string_agg(x.name, ', ' ORDER BY x.priority, x.name) AS names
    FROM (
      SELECT s.name, CASE WHEN s.role = 'leader' THEN 0 ELSE 1 END AS priority
      FROM public.outlet_staff s
      WHERE s.status = 'active' AND s.role IN ('crew', 'leader', 'kiosk')
        AND (s.outlet_id = o.id OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = o.id
        ))
      ORDER BY priority, s.name LIMIT 2
    ) x
  ) pic ON TRUE
  WHERE o.is_active IS TRUE
    AND o.deleted_at IS NULL
    AND o.type IN ('internal', 'mitra')
    AND public.bot_is_sales_outlet(o.id)
    AND NOT public.bot_is_outlet_tutup_sementara(o.id);
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_opname_harian_kitchen_data(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_opname_harian_kitchen_data(DATE) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Verifikasi & Keberangkatan Surat Jalan (Bedakan Auto-Verify + Event Key Eksak)
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
  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Tabel & Cron Pengingat PO Jatuh Tempo 08:15 WIB (Purchasing, Finance, CEO)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_po_pengingat_push_log (
  tanggal DATE PRIMARY KEY,
  kunci TEXT[] NOT NULL,
  jumlah_po INTEGER NOT NULL,
  jumlah_penerima INTEGER NOT NULL,
  dibuat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finance_po_pengingat_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_po_pengingat_push_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.finance_po_pengingat_push_log TO service_role;

CREATE OR REPLACE FUNCTION public.finance_po_pengingat_kandidat(
  p_today DATE DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date
)
RETURNS TABLE (
  po_id UUID,
  nomor_po TEXT,
  supplier_nama TEXT,
  jatuh_tempo DATE,
  hari_ke_tempo INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.id,
         po.nomor_po,
         po.supplier_nama,
         po.jatuh_tempo,
         po.jatuh_tempo - p_today
  FROM public.purchase_order po
  WHERE po.status IN ('sebagian_diterima', 'diterima_lengkap')
    AND po.payment_status = 'unpaid'
    AND po.jatuh_tempo IS NOT NULL
    AND po.jatuh_tempo <= p_today + 3
  ORDER BY po.jatuh_tempo, po.nomor_po;
$$;

REVOKE ALL ON FUNCTION public.finance_po_pengingat_kandidat(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_po_pengingat_kandidat(DATE) TO service_role;

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
  v_recipients INTEGER := 0;
  v_title TEXT;
  v_body TEXT;
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

  v_title := '💳 Pengingat jatuh tempo PO';
  v_body := COALESCE(v_overdue, 0) || ' PO lewat jatuh tempo, '
    || COALESCE(v_due_today, 0) || ' jatuh tempo hari ini, dan '
    || COALESCE(v_soon, 0) || ' jatuh tempo dalam 3 hari. Buka modul Finance / Purchasing untuk menindaklanjuti.';

  FOR r IN
    SELECT DISTINCT s.id, s.role
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('admin_finance', 'owner', 'admin', 'purchasing')
  LOOP
    BEGIN
      IF r.role = 'purchasing' THEN
        PERFORM public.bot_telegram_kirim_alert(
          r.id,
          'stok',
          v_title,
          v_body,
          'https://finance.sukashawarma.com/pembelian/invoice',
          NULL,
          'po_jatuh_tempo:' || v_today::text
        );
      ELSE
        PERFORM public.bot_kirim_push_hp(
          'po_jatuh_tempo:' || v_today::text,
          r.id,
          CASE WHEN r.role = 'admin_finance' THEN 'finance' ELSE 'ceo' END,
          v_title,
          v_body,
          'bot'
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
GRANT EXECUTE ON FUNCTION public.finance_kirim_pengingat_po_jatuh_tempo() TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('finance-po-pengingat-jatuh-tempo');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'finance-po-pengingat-jatuh-tempo',
  '15 1 * * *',
  $cron$SELECT public.finance_kirim_pengingat_po_jatuh_tempo();$cron$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Trigger Notifikasi Retur Bahan (public.retur_stok) untuk Kitchen & Purchasing
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_retur_stok()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_nomor_retur text;
  v_item_count int := 0;
  v_sample_items text;
  v_title text;
  v_body text;
  r record;
BEGIN
  IF NEW.status NOT IN ('diajukan', 'disetujui_manager', 'dalam_pengiriman') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_nomor_retur := COALESCE(NULLIF(btrim(NEW.nomor_retur), ''), left(NEW.id::text, 8));

  SELECT count(*)::int INTO v_item_count
  FROM public.retur_stok_item
  WHERE retur_stok_id = NEW.id;

  SELECT string_agg(sub.item_desc, ', ' ORDER BY sub.nama)
  INTO v_sample_items
  FROM (
    SELECT b.nama,
           b.nama || ' (' || trim_scale(rsi.qty_klaim)::text || ' ' || COALESCE(b.satuan, '') || ')' AS item_desc
    FROM public.retur_stok_item rsi
    JOIN public.bahan_baku b ON b.id = rsi.bahan_baku_id
    WHERE rsi.retur_stok_id = NEW.id
    ORDER BY b.nama
    LIMIT 3
  ) sub;

  IF NEW.status = 'diajukan' THEN
    v_title := '↩️ Pengajuan Retur Bahan · ' || v_outlet_name;
    v_body := 'No. Retur: ' || v_nomor_retur
      || E'\nOutlet: ' || v_outlet_name
      || E'\nTipe: ' || COALESCE(NEW.tipe_retur, 'retur')
      || (CASE WHEN v_item_count > 0 THEN E'\nItem (' || v_item_count || '): ' || COALESCE(v_sample_items, '-') ELSE '' END)
      || E'\nStatus: Menunggu persetujuan Area Manager.';
  ELSIF NEW.status = 'disetujui_manager' THEN
    v_title := '✅ Retur Disetujui Manager · ' || v_outlet_name;
    v_body := 'No. Retur: ' || v_nomor_retur
      || E'\nOutlet: ' || v_outlet_name
      || (CASE WHEN v_item_count > 0 THEN E'\nItem (' || v_item_count || '): ' || COALESCE(v_sample_items, '-') ELSE '' END)
      || E'\nStatus: Disetujui Manager, menunggu pengiriman fisik balik ke Central Kitchen.';
  ELSE
    v_title := '🚚 Barang Retur Dikirim ke Kitchen · ' || v_outlet_name;
    v_body := 'No. Retur: ' || v_nomor_retur
      || E'\nOutlet: ' || v_outlet_name
      || (CASE WHEN NULLIF(btrim(NEW.driver_nama), '') IS NOT NULL THEN E'\nKurir/Driver: ' || btrim(NEW.driver_nama) ELSE '' END)
      || (CASE WHEN v_item_count > 0 THEN E'\nItem (' || v_item_count || '): ' || COALESCE(v_sample_items, '-') ELSE '' END)
      || E'\n\nMohon tim Kitchen melakukan timbang terima & verifikasi barang retur saat tiba.';
  END IF;

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
      'https://stok.sukashawarma.com/stok/retur',
      NEW.outlet_id,
      'retur_stok:' || NEW.id::text || ':' || NEW.status
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert retur_stok kitchen/purchasing: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_retur_stok() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_stokist_alert_retur ON public.retur_stok;
CREATE CONSTRAINT TRIGGER trg_bot_stokist_alert_retur
  AFTER INSERT OR UPDATE OF status ON public.retur_stok
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_retur_stok();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Trigger Notifikasi Status Purchase Order (public.purchase_order)
--    untuk Purchasing & Kitchen
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_po_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nomor_po text;
  v_supplier text;
  v_item_count int := 0;
  v_title text;
  v_body text;
  r record;
BEGIN
  IF NEW.status NOT IN ('disetujui_finance', 'ditolak', 'sebagian_diterima', 'diterima_lengkap') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_nomor_po := COALESCE(NULLIF(btrim(NEW.nomor_po), ''), left(NEW.id::text, 8));
  v_supplier := COALESCE(NULLIF(btrim(NEW.supplier_nama), ''), 'Supplier');

  SELECT count(*)::int INTO v_item_count
  FROM public.purchase_order_item
  WHERE purchase_order_id = NEW.id;

  IF NEW.status = 'disetujui_finance' THEN
    v_title := '✅ PO Disetujui Finance · ' || v_nomor_po;
    v_body := 'No. PO: ' || v_nomor_po
      || E'\nSupplier: ' || v_supplier
      || (CASE WHEN v_item_count > 0 THEN E'\nJumlah Item: ' || v_item_count || ' item' ELSE '' END)
      || E'\nStatus: Disetujui Finance dan siap dikirim ke supplier.';
  ELSIF NEW.status = 'ditolak' THEN
    v_title := '❌ PO Ditolak Finance · ' || v_nomor_po;
    v_body := 'No. PO: ' || v_nomor_po
      || E'\nSupplier: ' || v_supplier
      || (CASE WHEN NULLIF(btrim(NEW.catatan), '') IS NOT NULL THEN E'\nCatatan: ' || left(btrim(NEW.catatan), 200) ELSE '' END)
      || E'\nMohon tim Purchasing meninjau kembali pengajuan PO.';
  ELSIF NEW.status = 'sebagian_diterima' THEN
    v_title := '📦 PO Diterima Sebagian · ' || v_nomor_po;
    v_body := 'No. PO: ' || v_nomor_po
      || E'\nSupplier: ' || v_supplier
      || E'\nStatus: Barang PO telah diterima sebagian di Gudang Pusat.';
  ELSE
    v_title := '✅ PO Diterima Lengkap · ' || v_nomor_po;
    v_body := 'No. PO: ' || v_nomor_po
      || E'\nSupplier: ' || v_supplier
      || E'\nStatus: Seluruh barang PO telah diterima lengkap & masuk ke stok Gudang Pusat.';
  END IF;

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('purchasing', 'kitchen')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      v_title,
      v_body,
      'https://stok.sukashawarma.com/stok/po',
      NULL,
      'po_status:' || NEW.id::text || ':' || NEW.status
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert status PO: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_po_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_stokist_alert_po_status ON public.purchase_order;
CREATE TRIGGER trg_bot_stokist_alert_po_status
  AFTER INSERT OR UPDATE OF status ON public.purchase_order
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_po_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Sinkronisasi Katalog Trigger (public.bot_trigger_catalog)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  ('tg_stok_retur_bahan', 'stokist', 'stokist',
   'Notifikasi Pengajuan & Pengiriman Retur Bahan Cabang',
   'Notifikasi real-time saat cabang mengajukan retur bahan baku, disetujui Manager, hingga barang dikirim kembali ke Central Kitchen untuk verifikasi timbang.',
   'Trigger Retur Bahan (retur_stok)', true, true, 12, true),
  ('tg_purchasing_po_jatuh_tempo', 'purchasing', 'stokist',
   'Pengingat Jatuh Tempo Invoice Purchase Order (PO Supplier)',
   'Peringatan otomatis setiap pagi (08:15 WIB) untuk PO yang sudah diterima namun belum lunas dan jatuh tempo dalam <= 3 hari atau lewat jatuh tempo.',
   'Cron Harian Pagi (08:15 WIB)', false, true, 13, true),
  ('tg_purchasing_po_status', 'purchasing', 'stokist',
   'Notifikasi Persetujuan Finance & Penerimaan Barang PO',
   'Notifikasi real-time saat Purchase Order (PO) disetujui/ditolak oleh Finance serta saat barang PO diverifikasi masuk ke Gudang Pusat.',
   'Trigger Status PO (purchase_order)', true, true, 14, true)
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
