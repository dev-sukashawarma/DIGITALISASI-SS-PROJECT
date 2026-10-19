-- Display quantities only; stored stock balances and trigger thresholds stay exact.
CREATE OR REPLACE FUNCTION public.bot_telegram_format_angka(p_value NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT replace(trim_scale(round(p_value, 3))::text, '.', ',');
$$;
REVOKE ALL ON FUNCTION public.bot_telegram_format_angka(NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_format_angka(NUMERIC) TO service_role;


CREATE OR REPLACE FUNCTION public.bot_telegram_alert_penurunan_stok_tidak_wajar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_threshold NUMERIC;
  v_outlet_name TEXT;
  v_drop_pct NUMERIC;
  v_should_send BOOLEAN;
  r RECORD;
BEGIN
  -- This alert targets a sharp single-update decrease that remains above the
  -- normal reorder point; the existing critical-stock alert covers the rest.
  IF NEW.saldo >= OLD.saldo OR OLD.saldo <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         GREATEST(COALESCE(orp.reorder_point, b.default_reorder_point, 10), 1),
         o.name
  INTO v_item_name, v_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id
    AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL
    OR OLD.saldo < v_threshold * 2
    OR NEW.saldo <= v_threshold
    OR NEW.saldo > OLD.saldo * 0.5 THEN
    RETURN NEW;
  END IF;

  v_drop_pct := round(((OLD.saldo - NEW.saldo) / OLD.saldo) * 100, 1);

  -- Limit repeat alerts for the same item/outlet to one per hour.
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

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND (
        s.role IN ('owner', 'admin', 'developer', 'kitchen', 'purchasing')
        OR (s.role = 'leader' AND (
          s.outlet_id = NEW.outlet_id
          OR EXISTS (
            SELECT 1 FROM public.staff_outlets so
            WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
          )
        ))
      )
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Penurunan stok tidak biasa · ' || v_outlet_name,
      'Stok ' || v_item_name || ' turun ' || public.bot_telegram_format_angka(v_drop_pct)
        || '% dalam satu perubahan (' || public.bot_telegram_format_angka(OLD.saldo) || ' → ' || public.bot_telegram_format_angka(NEW.saldo)
        || '). Saldo masih di atas batas minimum. Mohon periksa mutasinya.',
      'https://stok.sukashawarma.com/stok/monitoring',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_telegram_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_threshold numeric;
  v_outlet_name text;
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL OR NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role = 'leader'
      AND (
        s.outlet_id = NEW.outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
        )
      )
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Stok mencapai batas minimum · ' || v_outlet_name,
      'Stok ' || v_item_name || ' tersisa ' || public.bot_telegram_format_angka(NEW.saldo) || '. Segera ajukan pemenuhan stok.',
      'https://stok.sukashawarma.com/stok/permintaan',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bot_telegram_format_angka(NUMERIC) IS
  'Display-only Indonesian numeric text: at most 3 decimals, decimal comma, no trailing zeroes.';
