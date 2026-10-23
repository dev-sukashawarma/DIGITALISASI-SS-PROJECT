-- Migration: 20300254008000_fix_stock_alert_units_and_scale.sql
-- Memperbaiki keselarasan satuan stok (Dus vs Lembar/Gram), pencegahan division-by-zero,
-- dan scale-awareness pada trigger alert penurunan stok dan stok kritis.

-- 1. STOK: Penurunan Stok Drastis (Bot CEO & Tim Pusat)
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_satuan_besar TEXT;
  v_satuan_kecil TEXT;
  v_unit TEXT;
  v_raw_threshold NUMERIC;
  v_threshold NUMERIC;
  v_outlet_name TEXT;
  v_delta NUMERIC;
  v_drop_pct NUMERIC;
  v_should_send BOOLEAN;
  v_is_gram BOOLEAN;
  r RECORD;
  v_ceo RECORD;
BEGIN
  -- 1. Guard: Hanya proses jika saldo berkurang DAN saldo awal > 0
  -- Menghindari false alarm saat saldo awal 0 / minus dan mencegah division-by-zero
  IF NEW.saldo >= OLD.saldo OR round(OLD.saldo, 2) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan,
         b.satuan_kecil,
         GREATEST(COALESCE(orp.reorder_point, b.default_reorder_point, 10), 1),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_kecil, v_raw_threshold, v_outlet_name
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

  -- 2. Tentukan skala satuan (satuan_kecil vs satuan_besar) dan konversi threshold
  v_is_gram := public.saldo_is_gram(NEW);
  IF v_is_gram THEN
    v_unit := COALESCE(v_satuan_kecil, v_satuan_besar, 'unit');
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_unit := COALESCE(v_satuan_besar, 'unit');
    v_threshold := v_raw_threshold;
  END IF;

  v_delta := OLD.saldo - NEW.saldo;

  -- 3. Ambang batas penurunan tidak wajar:
  -- Penurunan >= 50% dari saldo awal DAN nominal penurunan >= 50% dari threshold reorder point
  -- Ini mencegah pemakaian normal POS (misal 2 lembar keju / 25 gr saos) memicu alarm darurat
  IF (v_delta < GREATEST(v_threshold * 0.5, 1))
    OR (NEW.saldo > OLD.saldo * 0.5) THEN
    RETURN NEW;
  END IF;

  -- 4. Hitung persentase penurunan secara aman (maksimal 100%)
  v_drop_pct := round((v_delta / OLD.saldo) * 100, 1);
  IF v_drop_pct > 100.0 THEN
    v_drop_pct := 100.0;
  END IF;

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
      E'\n\nSaldo Awal: ' || to_char(OLD.saldo, 'FM999,999,990.##') || ' ' || v_unit ||
      E'\nSaldo Akhir: ' || to_char(NEW.saldo, 'FM999,999,990.##') || ' ' || v_unit ||
      E'\nPenurunan: ' || to_char(v_delta, 'FM999,999,990.##') || ' ' || v_unit ||
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
          E'Deteksi anomali penurunan stok drastis dalam satu perubahan.\nOutlet: %s\nBahan Baku: %s\nSaldo Sebelum: %s %s -> Saldo Akhir: %s %s (-%s%%)\nPenurunan: %s %s\nWaktu Cek: %s WIB\n\nPerhatian Direksi: Disarankan audit mutasi pemakaian produksi untuk mendeteksi potensi kebocoran bahan fisik.',
          coalesce(v_outlet_name, 'Outlet'),
          v_item_name,
          to_char(OLD.saldo, 'FM999,999,990.##'), v_unit,
          to_char(NEW.saldo, 'FM999,999,990.##'), v_unit,
          v_drop_pct::text,
          to_char(v_delta, 'FM999,999,990.##'), v_unit,
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

-- 2. STOK: Anomali Drop >= 50% (Bot Manager)
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
  v_satuan_kecil text;
  v_unit text;
  v_raw_threshold numeric;
  v_threshold numeric;
  v_delta numeric;
  v_pct numeric;
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
         satuan,
         satuan_kecil,
         GREATEST(COALESCE(default_reorder_point, 10), 1)
  INTO v_bahan_nama, v_satuan_besar, v_satuan_kecil, v_raw_threshold
  FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;

  -- Scale-aware unit dan threshold
  IF public.saldo_is_gram(NEW) THEN
    v_unit := coalesce(v_satuan_kecil, v_satuan_besar, 'Unit');
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_unit := coalesce(v_satuan_besar, 'Unit');
    v_threshold := v_raw_threshold;
  END IF;

  v_delta := OLD.saldo - NEW.saldo;

  -- Abaikan mutasi kecil wajar POS
  IF v_delta < GREATEST(v_threshold * 0.5, 1) THEN
    RETURN NEW;
  END IF;

  v_pct := round((v_delta / OLD.saldo) * 100, 0);
  IF v_pct > 100 THEN
    v_pct := 100;
  END IF;

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
        E'Peringatan penurunan stok drastis (>=50%%) dalam satu mutasi.\nOutlet: %s\nBahan: %s\nSaldo Sebelum: %s %s -> Saldo Sekarang: %s %s (-%s%%)\n\nSegera cek kesesuaian pemakaian produksi / potensi shrinkage di cabang.',
        v_outlet_name,
        v_bahan_nama,
        round(OLD.saldo::numeric, 1)::text, v_unit,
        round(NEW.saldo::numeric, 1)::text, v_unit,
        v_pct::text
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
        E'Deteksi penurunan stok drastis (>= 50%%) dalam satu mutasi di cabang.\nOutlet: %s\nBahan: %s\nSaldo Sebelum: %s %s -> Sekarang: %s %s (-%s%%)\n\nPotensi penyusutan atau salah input fisik cabang. Audit disarankan di Admin Dashboard.',
        v_outlet_name,
        v_bahan_nama,
        round(OLD.saldo::numeric, 1)::text, v_unit,
        round(NEW.saldo::numeric, 1)::text, v_unit,
        v_pct::text
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

-- 3. STOK: Alert Stok Kritis (Bot Stokis & Eskalasi CEO)
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_satuan_besar text;
  v_satuan_kecil text;
  v_unit text;
  v_raw_threshold numeric;
  v_threshold numeric;
  v_outlet_name text;
  r record;
  v_ceo record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan,
         b.satuan_kecil,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_kecil, v_raw_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Scale-aware unit dan threshold
  IF public.saldo_is_gram(NEW) THEN
    v_unit := COALESCE(v_satuan_kecil, v_satuan_besar, 'unit');
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_unit := COALESCE(v_satuan_besar, 'unit');
    v_threshold := v_raw_threshold;
  END IF;

  IF NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

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
      'Stok ' || v_item_name || ' tersisa ' || round(NEW.saldo::numeric, 1)::text || ' ' || v_unit || '. Segera ajukan pemenuhan stok.',
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
        E'Bahan baku telah mencapai batas minimum (reorder point).\nOutlet: %s\nBahan Baku: %s\nSisa Saldo: %s %s\nBatas Minimum: %s %s\n\nPastikan rencana pasokan atau PO supplier sudah berjalan.',
        v_outlet_name,
        v_item_name,
        round(NEW.saldo::numeric, 1)::text, v_unit,
        round(v_threshold::numeric, 1)::text, v_unit
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

-- 4. STOK: Alert Stok Kritis (Bot Manager untuk AM)
CREATE OR REPLACE FUNCTION public.bot_manager_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_satuan_besar text;
  v_satuan_kecil text;
  v_unit text;
  v_raw_threshold numeric;
  v_threshold numeric;
  v_outlet_name text;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
  v_am record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         b.satuan,
         b.satuan_kecil,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_satuan_besar, v_satuan_kecil, v_raw_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Scale-aware unit dan threshold
  IF public.saldo_is_gram(NEW) THEN
    v_unit := COALESCE(v_satuan_kecil, v_satuan_besar, 'Unit');
    v_threshold := public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, v_raw_threshold);
  ELSE
    v_unit := COALESCE(v_satuan_besar, 'Unit');
    v_threshold := v_raw_threshold;
  END IF;

  IF NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  v_title := '⚠️ STOK BAHAN KRITIS';
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || v_item_name
    || E'\nSisa Stok: ' || round(NEW.saldo::numeric, 1)::text || ' ' || v_unit
    || E'\nBatas Reorder: ' || round(v_threshold::numeric, 1)::text || ' ' || v_unit
    || E'\nStatus: Berisiko kehabisan stok hari ini!'
    || E'\n\nSegera koordinasikan pengiriman darurat atau mutasi antar cabang.';

  -- Kirim ke Area Manager (AM) pembina outlet
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
