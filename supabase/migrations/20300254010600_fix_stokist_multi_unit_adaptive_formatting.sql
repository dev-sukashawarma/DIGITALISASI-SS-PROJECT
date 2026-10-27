-- =============================================================================
-- Migration: 20300254010600_fix_stokist_multi_unit_adaptive_formatting.sql
-- Tanggal: 2026-10-26
-- Deskripsi:
--   Menyempurnakan konversi & pemformatan satuan bertingkat (Tri-Unit & Two-Unit:
--   satuan -> satuan_tengah -> satuan_kecil) di seluruh fungsi & trigger Bot Stokis,
--   Manager, CEO, dan Leader:
--
--   1. public.bot_format_stok_adaptive:
--      - Perbaiki Cabang B (p_saldo_is_gram = false, yaitu angka dalam satuan besar
--        seperti pada surat_jalan_item, permintaan_bahan_item, stok_waste_reports,
--        retur_stok_item, purchase_order_item) agar mendukung dekomposisi Tri-Unit
--        (satuan_besar -> satuan_tengah -> satuan_kecil) serta mempertahankan tanda
--        negatif (v_sign).
--        Contoh nyata di produksi:
--        * HAND GLOVE (Dus -> 75 Box -> 7500 Lembar): 0.0666667 Dus -> "5 Box"
--        * BAWANG (Bal -> 20 Kg -> 20000 Gram): 0.05 Bal -> "1 Kg"
--        * SAOS SAMYANG (Dus -> 20 Pouch -> 5000 Gram): 0.1 Dus -> "2 Pouch"
--        * KERTAS STRUK (Dus -> 10 Pack -> 100 Roll): 0.5 Dus -> "5 Pack",
--          0.05 Dus -> "5 Roll", -0.45 Dus -> "-4 Pack + 5 Roll"
--
--   2. public.bot_format_qty_bahan(p_qty, p_bahan_baku_id):
--      - Fungsi helper untuk memformat kuantitas transaksi yang selalu disimpan
--        dalam satuan besar (waste, surat jalan, permintaan bahan, retur) tanpa
--        terkecoh flag saldo_is_gram milik tabel stok_balance.
--
--   3. Perbaikan Trigger Waste (stok_push_waste_pending_approval,
--      bot_manager_alert_waste, trg_fn_bot_ceo_waste_alert):
--      - Gunakan bot_format_qty_bahan(NEW.qty, NEW.bahan_baku_id) karena
--        stok_waste_reports.qty selalu dalam satuan besar (misal 0.05 Pack KULIT 28
--        = "1 Lembar", bukan "0.05 Lembar"; 0.8 kg Sayur = "800 gram").
--
--   4. Perbaikan Trigger Distribusi & Permintaan & Retur:
--      - bot_telegram_alert_verifikasi_surat_jalan & bot_telegram_alert_selisih_penerimaan
--      - bot_telegram_alert_permintaan_bahan
--      - bot_telegram_alert_retur_stok
--      - trigger_stok_minimum_push_notification (konversi to_ledger_scale + adaptive format)
-- =============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Perbaikan public.bot_format_stok_adaptive (Support Tri-Unit di kedua skala)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_format_stok_adaptive(
  p_qty NUMERIC,
  p_saldo_is_gram BOOLEAN,
  p_satuan_besar TEXT,
  p_satuan_tengah TEXT DEFAULT NULL,
  p_faktor_tengah NUMERIC DEFAULT NULL,
  p_satuan_kecil TEXT DEFAULT NULL,
  p_faktor_tampilan NUMERIC DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_sign TEXT := '';
  v_rem NUMERIC;
  v_besar NUMERIC := 0;
  v_tengah NUMERIC := 0;
  v_kecil NUMERIC := 0;
  v_kecil_per_besar NUMERIC;
  v_kecil_per_tengah NUMERIC;
  v_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_qty IS NULL THEN
    RETURN '0';
  END IF;

  IF p_qty < 0 THEN
    v_sign := '-';
  END IF;

  -- Normalisasi ke skala satuan kecil apabila faktor_tampilan tersedia
  IF p_satuan_kecil IS NOT NULL AND p_faktor_tampilan IS NOT NULL AND p_faktor_tampilan > 0 THEN
    IF COALESCE(p_saldo_is_gram, false) THEN
      v_rem := round(abs(p_qty), 2);
    ELSE
      v_rem := round(abs(p_qty) * p_faktor_tampilan, 2);
    END IF;

    -- 1A. Tri-unit (Besar -> Tengah -> Kecil, mis. Dus -> Box -> Lembar / Bal -> Kg -> Gram)
    IF p_satuan_tengah IS NOT NULL AND p_faktor_tengah IS NOT NULL AND p_faktor_tengah > 0 THEN
      v_kecil_per_besar := p_faktor_tampilan;
      v_kecil_per_tengah := p_faktor_tampilan / p_faktor_tengah;

      v_besar := trunc(v_rem / v_kecil_per_besar);
      v_rem := v_rem - (v_besar * v_kecil_per_besar);
      v_tengah := trunc(round(v_rem / v_kecil_per_tengah, 6));
      v_kecil := round(v_rem - (v_tengah * v_kecil_per_tengah), 2);

      IF v_kecil >= v_kecil_per_tengah THEN
        v_tengah := v_tengah + 1;
        v_kecil := 0;
      END IF;
      IF v_tengah >= p_faktor_tengah THEN
        v_besar := v_besar + 1;
        v_tengah := 0;
      END IF;

      IF v_besar <> 0 OR (v_tengah = 0 AND v_kecil = 0) THEN
        v_parts := array_append(v_parts, v_besar::text || ' ' || p_satuan_besar);
      END IF;
      IF v_tengah <> 0 THEN
        v_parts := array_append(v_parts, v_tengah::text || ' ' || p_satuan_tengah);
      END IF;
      IF v_kecil <> 0 THEN
        v_parts := array_append(v_parts, trim_scale(v_kecil)::text || ' ' || p_satuan_kecil);
      END IF;

      RETURN v_sign || array_to_string(v_parts, ' + ');

    -- 1B. Two-unit (Besar -> Kecil, mis. Kg -> Gram / Pack -> Lembar)
    ELSE
      v_besar := trunc(v_rem / p_faktor_tampilan);
      v_kecil := round(v_rem - (v_besar * p_faktor_tampilan), 2);

      IF v_kecil >= p_faktor_tampilan THEN
        v_besar := v_besar + 1;
        v_kecil := 0;
      END IF;

      IF v_besar <> 0 OR v_kecil = 0 THEN
        v_parts := array_append(v_parts, v_besar::text || ' ' || p_satuan_besar);
      END IF;
      IF v_kecil <> 0 THEN
        v_parts := array_append(v_parts, trim_scale(v_kecil)::text || ' ' || p_satuan_kecil);
      END IF;

      RETURN v_sign || array_to_string(v_parts, ' + ');
    END IF;
  END IF;

  -- 2. Jika hanya punya satuan_tengah & faktor_tengah (tanpa satuan_kecil/faktor_tampilan)
  IF NOT COALESCE(p_saldo_is_gram, false)
     AND p_satuan_tengah IS NOT NULL AND p_faktor_tengah IS NOT NULL AND p_faktor_tengah > 0 THEN
    v_rem := abs(p_qty);
    v_besar := trunc(v_rem);
    v_tengah := round((v_rem - v_besar) * p_faktor_tengah, 2);
    IF v_tengah >= p_faktor_tengah THEN
      v_besar := v_besar + 1;
      v_tengah := 0;
    END IF;

    IF v_besar <> 0 OR v_tengah = 0 THEN
      v_parts := array_append(v_parts, v_besar::text || ' ' || p_satuan_besar);
    END IF;
    IF v_tengah <> 0 THEN
      v_parts := array_append(v_parts, trim_scale(v_tengah)::text || ' ' || p_satuan_tengah);
    END IF;

    RETURN v_sign || array_to_string(v_parts, ' + ');
  END IF;

  -- 3. Fallback satuan tunggal
  IF COALESCE(p_saldo_is_gram, false) THEN
    RETURN trim_scale(round(p_qty, 2))::text || ' ' || COALESCE(p_satuan_kecil, p_satuan_besar, 'unit');
  ELSE
    RETURN trim_scale(round(p_qty, 2))::text || ' ' || COALESCE(p_satuan_besar, 'unit');
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper public.bot_format_qty_bahan & Perbaikan bot_format_delta_outlet
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_format_qty_bahan(
  p_qty NUMERIC,
  p_bahan_baku_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan
  INTO b
  FROM public.bahan_baku
  WHERE id = p_bahan_baku_id;

  IF NOT FOUND THEN
    RETURN trim_scale(round(COALESCE(p_qty, 0), 2))::text;
  END IF;

  RETURN public.bot_format_stok_adaptive(
    p_qty,
    false,
    b.satuan,
    b.satuan_tengah,
    b.faktor_tengah,
    b.satuan_kecil,
    b.faktor_tampilan
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_format_delta_outlet(
  p_delta NUMERIC,
  p_outlet_id UUID,
  p_bahan_baku_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  v_is_gram BOOLEAN;
BEGIN
  SELECT satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan
  INTO b
  FROM public.bahan_baku
  WHERE id = p_bahan_baku_id;

  SELECT public.saldo_is_gram(sb) INTO v_is_gram
  FROM public.stok_balance sb
  WHERE sb.outlet_id = p_outlet_id AND sb.bahan_baku_id = p_bahan_baku_id;

  RETURN public.bot_format_stok_adaptive(
    p_delta,
    COALESCE(v_is_gram, false),
    b.satuan,
    b.satuan_tengah,
    b.faktor_tengah,
    b.satuan_kecil,
    b.faktor_tampilan
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Perbaikan Trigger Waste (stok_waste_reports.qty selalu dalam satuan besar)
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

  -- stok_waste_reports.qty selalu disimpan dalam satuan besar (mis. 0.05 Pack = 1 Lembar)
  v_qty_str := public.bot_format_qty_bahan(NEW.qty, NEW.bahan_baku_id);
  v_alasan := NULLIF(btrim(NEW.reason), '');

  v_title := '⏳ Waste menunggu persetujuan · ' || COALESCE(v_outlet_name, 'Outlet');
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || COALESCE(v_bahan_nama, 'Bahan Baku') || ' (' || COALESCE(v_qty_str, trim_scale(NEW.qty)::text) || ')'
    || CASE WHEN v_pelapor IS NOT NULL THEN E'\nPelapor: ' || v_pelapor ELSE '' END
    || CASE WHEN v_alasan IS NOT NULL THEN E'\nAlasan: ' || left(v_alasan, 120) ELSE '' END
    || E'\n\nAda laporan waste baru yang perlu ditinjau.';

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

CREATE OR REPLACE FUNCTION public.bot_manager_alert_waste()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_bahan_nama text;
  v_qty_str text;
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
  SELECT nama INTO v_bahan_nama FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.reported_by;

  v_qty_str := public.bot_format_qty_bahan(NEW.qty, NEW.bahan_baku_id);

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
    || E'\nBahan: ' || COALESCE(v_bahan_nama, 'Bahan Baku') || ' (' || COALESCE(v_qty_str, trim_scale(NEW.qty)::text) || ')'
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

CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_waste_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_harga numeric := 0;
  v_est_kerugian numeric := 0;
  v_outlet_name text;
  v_bahan_name text;
  v_qty_str text;
  v_ceo record;
BEGIN
  IF upper(coalesce(NEW.status, 'PENDING')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT b.nama, coalesce(h.harga_beli, 0)
  INTO v_bahan_name, v_harga
  FROM public.bahan_baku b
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
  WHERE b.id = NEW.bahan_baku_id
  ORDER BY h.harga_updated_at DESC NULLS LAST
  LIMIT 1;

  v_est_kerugian := round(coalesce(NEW.qty, 0) * coalesce(v_harga, 0), 0);

  IF v_est_kerugian > 150000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
    v_qty_str := public.bot_format_qty_bahan(NEW.qty, NEW.bahan_baku_id);

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('waste_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🥩 [ESKALASI WASTE > 150RB] ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Pengajuan waste bahan baku melebihi ambang batas toleransi Rp 150.000.\nOutlet: %s\nBahan: %s\nKuantiti: %s\nEstimasi Kerugian: Rp %s\nAlasan: %s\n\nNotifikasi eskalasi otomatis ke Direksi / Owner.',
          coalesce(v_outlet_name, 'Outlet'),
          coalesce(v_bahan_name, 'Bahan Baku'),
          coalesce(v_qty_str, trim_scale(NEW.qty)::text),
          to_char(v_est_kerugian, 'FM999,999,999'),
          coalesce(NEW.reason, '-')
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Perbaikan Trigger Permintaan Bahan (Gunakan Satuan Bertingkat)
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
           b.nama || ' (' || public.bot_format_stok_adaptive(
             pbi.qty_diminta, false, b.satuan, b.satuan_tengah, b.faktor_tengah, b.satuan_kecil, b.faktor_tampilan
           ) || ')' AS item_desc
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Perbaikan Trigger Verifikasi & Selisih Surat Jalan (Format Multi-Unit)
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
  v_kirim_str text;
  v_terima_str text;
  v_selisih_str text;
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

  -- KASUS 2: DITERIMA SEBAGIAN (Format Multi-Unit Adaptif)
  ELSIF NEW.status = 'diterima_sebagian' THEN
    FOR v_item IN
      SELECT
        bb.nama AS bahan_nama,
        bb.satuan,
        bb.satuan_tengah,
        bb.faktor_tengah,
        bb.satuan_kecil,
        bb.faktor_tampilan,
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
        v_kirim_str := public.bot_format_stok_adaptive(
          v_item.qty_dikirim, false, v_item.satuan, v_item.satuan_tengah, v_item.faktor_tengah, v_item.satuan_kecil, v_item.faktor_tampilan
        );
        v_terima_str := public.bot_format_stok_adaptive(
          v_item.qty_terima, false, v_item.satuan, v_item.satuan_tengah, v_item.faktor_tengah, v_item.satuan_kecil, v_item.faktor_tampilan
        );
        v_selisih_str := (CASE WHEN v_item.selisih_qty > 0 THEN '+' ELSE '' END) || public.bot_format_stok_adaptive(
          v_item.selisih_qty, false, v_item.satuan, v_item.satuan_tengah, v_item.faktor_tengah, v_item.satuan_kecil, v_item.faktor_tampilan
        );

        v_item_detail := v_item_detail || format(
          E'\n• %s: Kirim %s, Diterima %s (Selisih: %s)%s',
          v_item.bahan_nama,
          v_kirim_str,
          v_terima_str,
          v_selisih_str,
          case when v_item.item_catatan is not null then ' — Catatan: "' || v_item.item_catatan || '"' else '' end
        );
        v_item_detail_html := v_item_detail_html || format(
          E'\n• <b>%s</b>: Kirim <code>%s</code>, Diterima <code>%s</code> (<b>Selisih:</b> <code>%s</code>)%s',
          public.bot_escape_html(v_item.bahan_nama),
          public.bot_escape_html(v_kirim_str),
          public.bot_escape_html(v_terima_str),
          public.bot_escape_html(v_selisih_str),
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
-- 6. Perbaikan Trigger Retur Bahan (Gunakan Satuan Bertingkat)
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
           b.nama || ' (' || public.bot_format_stok_adaptive(
             rsi.qty_klaim, false, b.satuan, b.satuan_tengah, b.faktor_tengah, b.satuan_kecil, b.faktor_tampilan
           ) || ')' AS item_desc
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Perbaikan trigger_stok_minimum_push_notification (Leader Outlet)
--    Agar konversi saldo_is_gram & to_ledger_scale akurat + format multi-unit
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_stok_minimum_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url            TEXT;
  v_key            TEXT;
  v_bahan_nama     TEXT;
  v_satuan_besar   TEXT;
  v_satuan_tengah  TEXT;
  v_faktor_tengah  NUMERIC;
  v_satuan_kecil   TEXT;
  v_faktor_tampilan NUMERIC;
  v_raw_threshold  NUMERIC;
  v_threshold      NUMERIC;
  v_is_gram        BOOLEAN;
  v_saldo_str      TEXT;
  v_threshold_str  TEXT;
  v_recip          RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan, b.satuan_tengah, b.faktor_tengah, b.satuan_kecil, b.faktor_tampilan,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10)
    INTO v_bahan_nama,
         v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan,
         v_raw_threshold
    FROM public.bahan_baku b
    LEFT JOIN public.outlet_reorder_point orp
      ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
   WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE;

  IF v_bahan_nama IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_gram := public.saldo_is_gram(NEW);
  IF v_is_gram THEN
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_threshold := v_raw_threshold;
  END IF;

  IF NEW.saldo <= v_threshold AND (OLD IS NULL OR OLD.saldo > v_threshold) THEN
    v_saldo_str := public.bot_format_stok_adaptive(
      NEW.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan
    );
    v_threshold_str := public.bot_format_stok_adaptive(
      v_threshold, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan
    );

    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
      SELECT decrypted_secret INTO v_key
        FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

      IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
        RAISE WARNING 'Push stok minimum dilewati: secret belum ada di vault.';
        RETURN NEW;
      END IF;

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
                      ' tersisa ' || v_saldo_str ||
                      ' (di bawah batas minimum ' || v_threshold_str ||
                      '). Segera lakukan permintaan.',
              'url', '/stok/permintaan'
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
