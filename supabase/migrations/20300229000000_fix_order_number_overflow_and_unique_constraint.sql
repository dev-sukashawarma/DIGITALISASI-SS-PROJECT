-- ============================================================
-- Migration: Fix order_number integer overflow & counter race condition
-- 
-- 1. Upgrade orders.order_number dan outlet_order_counters.last_number ke BIGINT
--    Mencegah error 22003 (out of range for type integer) ketika query atau
--    pencarian mengirimkan string angka panjang (seperti nomor HP, no resi).
-- 2. Hapus trigger zombie lama trigger_assign_order_number (assign_order_number_fn)
--    yang berebut dengan trg_assign_order_number.
-- 3. Update public.assign_order_number() dengan fail-safe MAX check:
--    Memastikan counter harian selalu >= MAX(order_number) yang ada di tabel orders
--    sehingga tidak pernah menabrak constraint unik orders_outlet_bizdate_number_uq.
-- 4. Update public.search_outlet_orders() untuk validasi regex aman dan
--    mendukung pencarian customer_name, customer_phone, external_order_id.
-- ============================================================

-- 1. Tipe data BIGINT untuk order_number & last_number
ALTER TABLE public.orders 
  ALTER COLUMN order_number TYPE BIGINT;

ALTER TABLE public.outlet_order_counters 
  ALTER COLUMN last_number TYPE BIGINT;

-- 2. Hapus trigger dan fungsi lama yang bersaing
DROP TRIGGER IF EXISTS trigger_assign_order_number ON public.orders;
DROP FUNCTION IF EXISTS public.assign_order_number_fn();

-- 3. Update trigger function tunggal dengan proteksi tabrakan nomor antrian
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_biz_date date;
  v_next     bigint;
BEGIN
  IF NEW.outlet_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_biz_date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date;

  -- Satu pernyataan, atomik. Fail-safe: pastikan selalu > MAX yang sudah ada di tabel orders
  INSERT INTO public.outlet_order_counters AS c (outlet_id, biz_date, last_number)
  VALUES (
    NEW.outlet_id, 
    v_biz_date, 
    COALESCE((
      SELECT MAX(order_number) 
      FROM public.orders 
      WHERE outlet_id = NEW.outlet_id 
        AND ((created_at AT TIME ZONE 'Asia/Jakarta')::date) = v_biz_date
    ), 0) + 1
  )
  ON CONFLICT (outlet_id, biz_date)
  DO UPDATE SET last_number = GREATEST(
    c.last_number + 1,
    COALESCE((
      SELECT MAX(order_number) 
      FROM public.orders 
      WHERE outlet_id = NEW.outlet_id 
        AND ((created_at AT TIME ZONE 'Asia/Jakarta')::date) = v_biz_date
    ), 0) + 1
  )
  RETURNING c.last_number INTO v_next;

  NEW.order_number := v_next;
  RETURN NEW;
END;
$$;

-- 4. Update search_outlet_orders agar aman dari error casting integer
CREATE OR REPLACE FUNCTION public.search_outlet_orders(
  p_outlet_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_search TEXT,
  p_limit INT,
  p_offset INT
)
RETURNS SETOF JSONB AS $$
DECLARE
  v_search_number BIGINT;
  v_trimmed TEXT;
BEGIN
  v_trimmed := TRIM(COALESCE(p_search, ''));

  -- Validasi angka aman dengan regex TANPA memicu exception PostgreSQL 22003
  IF v_trimmed ~ '^[0-9]+$' AND length(v_trimmed) <= 9 THEN
    v_search_number := v_trimmed::BIGINT;
  ELSE
    v_search_number := NULL;
  END IF;

  RETURN QUERY
  WITH filtered_orders AS (
    SELECT o.*
    FROM orders o
    WHERE o.outlet_id = p_outlet_id
      AND o.status = 'completed'
      AND o.created_at >= p_start AND o.created_at <= p_end
      AND (
        v_trimmed = '' 
        OR (v_search_number IS NOT NULL AND o.order_number = v_search_number)
        OR (o.customer_name ILIKE '%' || v_trimmed || '%')
        OR (o.customer_phone ILIKE '%' || v_trimmed || '%')
        OR (o.external_order_id ILIKE '%' || v_trimmed || '%')
        OR EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = o.id 
            AND oi.menu_item_name ILIKE '%' || v_trimmed || '%'
        )
      )
  ),
  counted AS (
    SELECT COUNT(*) as tc FROM filtered_orders
  )
  SELECT 
    to_jsonb(f) || 
    jsonb_build_object(
      'order_items', (SELECT jsonb_agg(to_jsonb(oi)) FROM order_items oi WHERE oi.order_id = f.id),
      'total_count', (SELECT tc FROM counted)
    )
  FROM filtered_orders f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
-- Dikoreksi 2026-09-22 (lihat 20260922220000): semula SECURITY DEFINER tanpa
-- cek pemanggil + EXECUTE ke anon -> order semua outlet terbaca tanpa login.
-- INVOKER agar RLS orders/order_items menentukan outlet yang boleh dibaca.

REVOKE ALL ON FUNCTION public.search_outlet_orders(uuid, timestamptz, timestamptz, text, int, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_outlet_orders(uuid, timestamptz, timestamptz, text, int, int)
  TO authenticated, service_role;
