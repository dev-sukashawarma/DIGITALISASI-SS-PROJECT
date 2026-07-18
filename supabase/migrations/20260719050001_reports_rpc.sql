CREATE OR REPLACE FUNCTION get_outlet_analytics(
  p_outlet_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_revenue DECIMAL := 0;
  v_total_orders INT := 0;
  v_pending_count INT := 0;
  v_canceled_count INT := 0;
  v_avg_order DECIMAL := 0;
  
  v_payment_breakdown JSONB := '{}'::JSONB;
  v_category_data JSONB := '[]'::JSONB;
  v_best_sellers JSONB := '[]'::JSONB;
  v_hourly JSONB := '[]'::JSONB;
  v_daily JSONB := '[]'::JSONB;

  v_total_main INT := 0;
  v_total_extras INT := 0;
BEGIN
  -- Basic stats
  SELECT 
    COALESCE(SUM(total_amount), 0),
    COUNT(*)
  INTO v_total_revenue, v_total_orders
  FROM orders
  WHERE outlet_id = p_outlet_id 
    AND status = 'completed'
    AND created_at >= p_start AND created_at <= p_end;
    
  -- Canceled count
  SELECT COUNT(*) INTO v_canceled_count
  FROM orders
  WHERE outlet_id = p_outlet_id 
    AND status IN ('cancelled', 'expired')
    AND created_at >= p_start AND created_at <= p_end;
    
  -- Pending count
  SELECT COUNT(*) INTO v_pending_count
  FROM orders
  WHERE outlet_id = p_outlet_id 
    AND status = 'pending'
    AND created_at >= p_start AND created_at <= p_end;

  IF v_total_orders > 0 THEN
    v_avg_order := ROUND(v_total_revenue / v_total_orders);
  END IF;

  -- Payment Breakdown
  WITH pb AS (
    SELECT COALESCE(payment_method, 'unknown') as method,
           COUNT(*) as cnt,
           SUM(total_amount) as rev
    FROM orders
    WHERE outlet_id = p_outlet_id 
      AND status = 'completed'
      AND created_at >= p_start AND created_at <= p_end
    GROUP BY COALESCE(payment_method, 'unknown')
  )
  SELECT jsonb_object_agg(method, jsonb_build_object('count', cnt, 'revenue', rev))
  INTO v_payment_breakdown
  FROM pb;
  
  IF v_payment_breakdown IS NULL THEN
    v_payment_breakdown := '{}'::JSONB;
  END IF;

  -- Hourly distribution
  WITH hours AS (
    SELECT generate_series(0, 23) AS hr
  ),
  oh AS (
    SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'))::INT as h, COUNT(*) as cnt
    FROM orders
    WHERE outlet_id = p_outlet_id 
      AND status = 'completed'
      AND created_at >= p_start AND created_at <= p_end
    GROUP BY h
  )
  SELECT jsonb_agg(COALESCE(oh.cnt, 0) ORDER BY hours.hr)
  INTO v_hourly
  FROM hours LEFT JOIN oh ON hours.hr = oh.h;

  -- Daily entries
  WITH daily AS (
    SELECT to_char((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') as d, SUM(total_amount) as rev
    FROM orders
    WHERE outlet_id = p_outlet_id 
      AND status = 'completed'
      AND created_at >= p_start AND created_at <= p_end
    GROUP BY d
    ORDER BY d
  )
  SELECT jsonb_agg(jsonb_build_array(d, rev))
  INTO v_daily
  FROM daily;
  
  IF v_daily IS NULL THEN v_daily := '[]'::JSONB; END IF;

  -- Best Sellers & Category
  WITH items AS (
    SELECT oi.menu_item_name, oi.quantity, oi.subtotal
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.outlet_id = p_outlet_id 
      AND o.status = 'completed'
      AND o.created_at >= p_start AND o.created_at <= p_end
  ),
  agg_items AS (
    SELECT 
      TRIM(REGEXP_REPLACE(menu_item_name, '(?i)( - Extra.*|- Tambahan.*|- Level.*)', '')) as clean_name,
      SUM(quantity) as qty,
      SUM(subtotal) as revenue
    FROM items
    GROUP BY clean_name
  ),
  top_items AS (
    SELECT * FROM agg_items ORDER BY qty DESC LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object('name', clean_name, 'qty', qty, 'revenue', revenue))
  INTO v_best_sellers
  FROM top_items;
  
  IF v_best_sellers IS NULL THEN v_best_sellers := '[]'::JSONB; END IF;

  -- Category logic
  SELECT 
    COALESCE(SUM(CASE WHEN oi.menu_item_name ILIKE '%ekstra%' OR oi.menu_item_name ILIKE '%topping%' OR oi.menu_item_name ILIKE '%keju%' OR oi.menu_item_name ILIKE '%daging%' OR oi.menu_item_name ILIKE '%pedas%' THEN oi.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN oi.menu_item_name ILIKE '%ekstra%' OR oi.menu_item_name ILIKE '%topping%' OR oi.menu_item_name ILIKE '%keju%' OR oi.menu_item_name ILIKE '%daging%' OR oi.menu_item_name ILIKE '%pedas%' THEN 0 ELSE oi.quantity END), 0)
  INTO v_total_extras, v_total_main
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.outlet_id = p_outlet_id 
    AND o.status = 'completed'
    AND o.created_at >= p_start AND o.created_at <= p_end;

  IF v_total_main > 0 THEN
    v_category_data := v_category_data || jsonb_build_object('name', 'Menu Utama', 'value', v_total_main, 'color', '#f59e0b');
  END IF;
  IF v_total_extras > 0 THEN
    v_category_data := v_category_data || jsonb_build_object('name', 'Ekstra / Topping', 'value', v_total_extras, 'color', '#10b981');
  END IF;

  -- Build Result
  v_result := jsonb_build_object(
    'totalRevenue', v_total_revenue,
    'totalOrders', v_total_orders,
    'avgOrderValue', v_avg_order,
    'pendingCount', v_pending_count,
    'canceledCount', v_canceled_count,
    'paymentBreakdown', v_payment_breakdown,
    'hourly', v_hourly,
    'dailyEntries', v_daily,
    'bestSellers', v_best_sellers,
    'categoryData', v_category_data
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION search_outlet_orders(
  p_outlet_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_search TEXT,
  p_limit INT,
  p_offset INT
)
RETURNS SETOF JSONB AS $$
DECLARE
  v_search_number INT;
BEGIN
  -- try cast search to int if numeric
  BEGIN
    v_search_number := p_search::INT;
  EXCEPTION WHEN OTHERS THEN
    v_search_number := NULL;
  END;

  RETURN QUERY
  WITH filtered_orders AS (
    SELECT o.*
    FROM orders o
    WHERE o.outlet_id = p_outlet_id
      AND o.status = 'completed'
      AND o.created_at >= p_start AND o.created_at <= p_end
      AND (
        p_search = '' 
        OR (v_search_number IS NOT NULL AND o.order_number = v_search_number)
        OR EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = o.id 
            AND oi.menu_item_name ILIKE '%' || p_search || '%'
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
$$ LANGUAGE plpgsql;
