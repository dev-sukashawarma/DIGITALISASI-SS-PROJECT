-- Migration: 20300254009000_stok_app_identical_formatting.sql
-- Menyelaraskan 100% logika satuan, dekomposisi multi-unit (tri-unit & composite),
-- dan format delta di seluruh alert bot Telegram agar identik (plek ketiplek) dengan apps/stok.

-- 1. Helper Fungsi Dekomposisi Saldo Multi-Unit Identik apps/stok (compositeUnit.ts)
CREATE OR REPLACE FUNCTION public.bot_format_stok_adaptive(
  p_qty NUMERIC,
  p_saldo_is_gram BOOLEAN,
  p_satuan_besar TEXT,
  p_satuan_tengah TEXT,
  p_faktor_tengah NUMERIC,
  p_satuan_kecil TEXT,
  p_faktor_tampilan NUMERIC
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
  v_result TEXT;
BEGIN
  IF p_qty IS NULL THEN
    RETURN '0';
  END IF;

  IF p_qty < 0 THEN
    v_sign := '-';
  END IF;

  v_rem := round(abs(p_qty), 2);

  -- A. JIKA SALDO DISIMPAN DALAM SKALA SATUAN KECIL (saldo_is_gram = true)
  IF COALESCE(p_saldo_is_gram, false) THEN
    -- A1. Tri-unit (Besar - Tengah - Kecil, misal Dus - Kompan - Gram / Dus - Pack - Lembar)
    IF p_satuan_tengah IS NOT NULL AND p_faktor_tengah > 0 
       AND p_satuan_kecil IS NOT NULL AND p_faktor_tampilan > 0 THEN
      v_kecil_per_besar := p_faktor_tampilan;
      v_kecil_per_tengah := p_faktor_tampilan / p_faktor_tengah;

      v_besar := trunc(v_rem / v_kecil_per_besar);
      v_rem := v_rem - (v_besar * v_kecil_per_besar);
      v_tengah := trunc(v_rem / v_kecil_per_tengah);
      v_kecil := round(v_rem - (v_tengah * v_kecil_per_tengah), 2);

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

    -- A2. Two-unit (Besar - Kecil, misal Kg - Gram / Pack - Lembar)
    ELSIF p_satuan_kecil IS NOT NULL AND p_faktor_tampilan > 0 THEN
      v_besar := trunc(v_rem / p_faktor_tampilan);
      v_kecil := round(v_rem - (v_besar * p_faktor_tampilan), 2);

      IF v_besar <> 0 OR v_kecil = 0 THEN
        v_parts := array_append(v_parts, v_besar::text || ' ' || p_satuan_besar);
      END IF;
      IF v_kecil <> 0 THEN
        v_parts := array_append(v_parts, trim_scale(v_kecil)::text || ' ' || p_satuan_kecil);
      END IF;

      RETURN v_sign || array_to_string(v_parts, ' + ');
    ELSE
      -- Tanpa faktor tampilan: satuan tunggal
      RETURN trim_scale(round(p_qty, 2))::text || ' ' || COALESCE(p_satuan_kecil, p_satuan_besar, 'unit');
    END IF;

  -- B. JIKA SALDO DISIMPAN DALAM SKALA SATUAN BESAR (saldo_is_gram = false)
  ELSE
    IF p_satuan_kecil IS NOT NULL AND p_faktor_tampilan > 0 THEN
      v_besar := trunc(p_qty);
      v_kecil := round(abs(p_qty - v_besar) * p_faktor_tampilan, 2);

      IF v_besar <> 0 OR v_kecil = 0 THEN
        v_parts := array_append(v_parts, v_besar::text || ' ' || p_satuan_besar);
      END IF;
      IF v_kecil <> 0 THEN
        v_parts := array_append(v_parts, trim_scale(v_kecil)::text || ' ' || p_satuan_kecil);
      END IF;

      RETURN array_to_string(v_parts, ' + ');
    ELSE
      RETURN trim_scale(round(p_qty, 2))::text || ' ' || COALESCE(p_satuan_besar, 'unit');
    END IF;
  END IF;
END;
$$;

-- 2. Helper Fungsi Format Pergerakan / Delta (identik formatCompositeDeltaAdaptive apps/stok)
CREATE OR REPLACE FUNCTION public.bot_format_delta_adaptive(
  p_delta NUMERIC,
  p_saldo_is_gram BOOLEAN,
  p_satuan_besar TEXT,
  p_satuan_kecil TEXT,
  p_faktor_tampilan NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rounded NUMERIC;
  v_unit TEXT;
BEGIN
  IF p_delta IS NULL THEN
    RETURN '0';
  END IF;

  IF COALESCE(p_saldo_is_gram, false) THEN
    -- Delta gram-scale: qty sudah dalam satuan kecil
    v_rounded := round(p_delta, 2);
    v_unit := COALESCE(p_satuan_kecil, p_satuan_besar, 'unit');
    RETURN trim_scale(v_rounded)::text || ' ' || v_unit;
  ELSE
    -- Delta besar-scale: jika ada satuan kecil & faktor, ubah ke satuan kecil agar representatif
    IF p_satuan_kecil IS NOT NULL AND p_faktor_tampilan > 0 THEN
      v_rounded := round(p_delta * p_faktor_tampilan, 2);
      RETURN trim_scale(v_rounded)::text || ' ' || p_satuan_kecil;
    ELSE
      v_rounded := round(p_delta, 2);
      RETURN trim_scale(v_rounded)::text || ' ' || COALESCE(p_satuan_besar, 'unit');
    END IF;
  END IF;
END;
$$;

-- 3. Wrapper Praktis per Outlet & Bahan Baku
CREATE OR REPLACE FUNCTION public.bot_format_stok_outlet(
  p_qty NUMERIC,
  p_outlet_id UUID,
  p_bahan_baku_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
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
    p_qty,
    COALESCE(v_is_gram, false),
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
AS $$
DECLARE
  b RECORD;
  v_is_gram BOOLEAN;
BEGIN
  SELECT satuan, satuan_kecil, faktor_tampilan
  INTO b
  FROM public.bahan_baku
  WHERE id = p_bahan_baku_id;

  SELECT public.saldo_is_gram(sb) INTO v_is_gram
  FROM public.stok_balance sb
  WHERE sb.outlet_id = p_outlet_id AND sb.bahan_baku_id = p_bahan_baku_id;

  RETURN public.bot_format_delta_adaptive(
    p_delta,
    COALESCE(v_is_gram, false),
    b.satuan,
    b.satuan_kecil,
    b.faktor_tampilan
  );
END;
$$;

-- 4. Terapkan ke Penurunan Stok Drastis (Bot CEO & Tim Pusat)
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_satuan_besar TEXT;
  v_satuan_tengah TEXT;
  v_faktor_tengah NUMERIC;
  v_satuan_kecil TEXT;
  v_faktor_tampilan NUMERIC;
  v_raw_threshold NUMERIC;
  v_threshold NUMERIC;
  v_outlet_name TEXT;
  v_delta NUMERIC;
  v_drop_pct NUMERIC;
  v_should_send BOOLEAN;
  v_is_gram BOOLEAN;
  v_saldo_awal_str TEXT;
  v_saldo_akhir_str TEXT;
  v_penurunan_str TEXT;
  r RECORD;
  v_ceo RECORD;
BEGIN
  -- 1. Guard saldo tidak turun atau saldo awal <= 0 (cegah false alert & division-by-zero)
  IF NEW.saldo >= OLD.saldo OR round(OLD.saldo, 2) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan,
         b.satuan_tengah,
         b.faktor_tengah,
         b.satuan_kecil,
         b.faktor_tampilan,
         GREATEST(COALESCE(orp.reorder_point, b.default_reorder_point, 10), 1),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan, v_raw_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id
    AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Tentukan skala satuan dan konversi threshold
  v_is_gram := public.saldo_is_gram(NEW);
  IF v_is_gram THEN
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_threshold := v_raw_threshold;
  END IF;

  v_delta := OLD.saldo - NEW.saldo;

  -- 3. Ambang batas penurunan tidak wajar:
  -- Harus turun >= 50% dari saldo awal DAN nominal turun >= 50% dari threshold reorder point
  IF (v_delta < GREATEST(v_threshold * 0.5, 1))
    OR (NEW.saldo > OLD.saldo * 0.5) THEN
    RETURN NEW;
  END IF;

  -- 4. Hitung persentase aman
  v_drop_pct := round((v_delta / OLD.saldo) * 100, 1);
  IF v_drop_pct > 100.0 THEN
    v_drop_pct := 100.0;
  END IF;

  -- 5. Format teks identik dengan apps/stok
  v_saldo_awal_str := public.bot_format_stok_adaptive(OLD.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan);
  v_saldo_akhir_str := public.bot_format_stok_adaptive(NEW.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan);
  v_penurunan_str := public.bot_format_delta_adaptive(v_delta, v_is_gram, v_satuan_besar, v_satuan_kecil, v_faktor_tampilan);

  INSERT INTO public.bot_telegram_stock_drop_alert_state AS existing (
    outlet_id, bahan_baku_id, last_alerted_at
  ) VALUES (NEW.outlet_id, NEW.bahan_baku_id, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id) DO UPDATE
  SET last_alerted_at = NOW()
  WHERE existing.last_alerted_at < NOW() - INTERVAL '1 hour'
  RETURNING TRUE INTO v_should_send;

  IF NOT FOUND OR NOT COALESCE(v_should_send, FALSE) THEN
    RETURN NEW;
  END IF;

  -- A. Penerima tim pusat (kitchen & purchasing)
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '📉 Penurunan Stok Tidak Wajar: ' || v_item_name,
      'Bahan baku ' || v_item_name || ' di ' || v_outlet_name ||
      ' mengalami penurunan signifikan sebesar ' || v_drop_pct || '%.' ||
      E'\n\nSaldo Awal: ' || v_saldo_awal_str ||
      E'\nSaldo Akhir: ' || v_saldo_akhir_str ||
      E'\nPenurunan: ' || v_penurunan_str ||
      E'\n\nMohon lakukan verifikasi mutasi stok untuk memastikan tidak terjadi kebocoran bahan.',
      'https://stok.sukashawarma.com',
      NEW.outlet_id
    );
  END LOOP;

  -- B. Eskalasi ke Bot CEO jika penurunan drastis >= 50%
  IF v_drop_pct >= 50 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('stockdrop_ceo:%s:%s:%s', to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'), NEW.outlet_id::text, NEW.bahan_baku_id::text),
        v_ceo.id,
        '📉 [STOK WARNING] Penurunan Stok Drastis (-' || v_drop_pct || '%) — ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Deteksi anomali penurunan stok drastis dalam satu perubahan.\nOutlet: %s\nBahan Baku: %s\nSaldo Sebelum: %s -> Saldo Akhir: %s (-%s%%)\nPenurunan: %s\nWaktu Cek: %s WIB\n\nPerhatian Direksi: Disarankan audit mutasi pemakaian produksi untuk mendeteksi potensi kebocoran bahan fisik.',
          coalesce(v_outlet_name, 'Outlet'),
          v_item_name,
          v_saldo_awal_str,
          v_saldo_akhir_str,
          v_drop_pct::text,
          v_penurunan_str,
          to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_penurunan_stok_tidak_wajar gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5. Terapkan ke Drop >= 50% (Bot Manager)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_stok_drop50()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_outlet_type text;
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

  SELECT name, coalesce(type, 'internal') INTO v_outlet_name, v_outlet_type
  FROM public.outlets WHERE id = NEW.outlet_id;

  IF v_outlet_name IS NULL OR lower(v_outlet_type) IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen') THEN
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

-- 6. Terapkan ke Stok Kritis (Bot Stokis & Bot CEO)
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_stok_kritis()
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
  r record;
  v_ceo record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan, b.satuan_tengah, b.faktor_tengah, b.satuan_kecil, b.faktor_tampilan,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan, v_raw_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

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

  v_saldo_str := public.bot_format_stok_adaptive(NEW.saldo, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan);
  v_threshold_str := public.bot_format_stok_adaptive(v_threshold, v_is_gram, v_satuan_besar, v_satuan_tengah, v_faktor_tengah, v_satuan_kecil, v_faktor_tampilan);

  -- A. Kirim ke Kitchen & Purchasing via Bot Stokis
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Stok mencapai batas minimum · ' || v_outlet_name,
      'Stok ' || v_item_name || ' tersisa ' || v_saldo_str || ' (Batas Minimum: ' || v_threshold_str || '). Segera ajukan pemenuhan stok.',
      'https://stok.sukashawarma.com/stok/permintaan',
      NEW.outlet_id
    );
  END LOOP;

  -- B. Eskalasi ke Bot CEO (Owner / Admin / Developer)
  FOR v_ceo IN
    SELECT id FROM public.outlet_staff
    WHERE role IN ('owner', 'admin', 'developer')
      AND status = 'active'
  LOOP
    PERFORM public.bot_ceo_antrekan(
      format('stok_kritis_ceo:%s:%s', NEW.outlet_id::text, NEW.bahan_baku_id::text),
      v_ceo.id,
      '⚠️ [ALERT STOK KRITIS] ' || v_item_name || ' — ' || v_outlet_name,
      format(
        E'Bahan baku telah mencapai batas minimum (reorder point).\nOutlet: %s\nBahan Baku: %s\nSisa Saldo: %s\nBatas Minimum: %s\n\nPastikan rencana pasokan atau PO supplier sudah berjalan.',
        v_outlet_name,
        v_item_name,
        v_saldo_str,
        v_threshold_str
      ),
      'https://admin.sukashawarma.com'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_telegram_alert_stok_kritis gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;
