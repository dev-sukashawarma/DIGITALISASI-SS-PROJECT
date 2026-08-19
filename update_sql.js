const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE OR REPLACE FUNCTION public.pos_revenue_summary(
  p_outlet_id      uuid,
  p_start          timestamptz DEFAULT NULL,
  p_end            timestamptz DEFAULT NULL,
  p_payment_method text        DEFAULT NULL,
  p_channels       text[]      DEFAULT NULL,
  p_include_null_channel boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH scoped AS (
  SELECT
    o.id,
    o.status,
    o.payment_method,
    o.total_amount,
    o.created_at,
    o.cancellation_status,
    COALESCE(o.discount_amount, 0) AS discount_amount,
    COALESCE(o.promo_subsidy, 0)   AS promo_subsidy
  FROM public.orders o
  WHERE o.outlet_id = p_outlet_id
    AND (p_start IS NULL OR o.created_at >= p_start)
    AND (p_end   IS NULL OR o.created_at <= p_end)
    AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
    AND (
      p_channels IS NULL
      OR o.channel = ANY (p_channels)
      OR (p_include_null_channel AND o.channel IS NULL)
    )
),
completed AS (
  SELECT
    s.id,
    s.payment_method,
    s.total_amount,
    s.created_at,
    (s.total_amount + s.discount_amount + s.promo_subsidy) AS gross,
    COALESCE(i.qty, 0) AS qty
  FROM scoped s
  LEFT JOIN (
    SELECT order_id, SUM(quantity) AS qty
    FROM public.order_items
    GROUP BY order_id
  ) i ON i.order_id = s.id
  WHERE s.status = 'completed'
),
totals AS (
  SELECT
    COALESCE(SUM(gross), 0)        AS gross,
    COALESCE(SUM(total_amount), 0) AS net,
    COUNT(*)                       AS order_count,
    COALESCE(SUM(qty), 0)          AS items_sold
  FROM completed
),
by_payment AS (
  SELECT jsonb_agg(jsonb_build_object(
           'payment_method', COALESCE(payment_method, 'unknown'),
           'gross', gross, 'count', cnt
         ) ORDER BY gross DESC) AS data
  FROM (
    SELECT payment_method, SUM(gross) AS gross, COUNT(*) AS cnt
    FROM completed GROUP BY payment_method
  ) p
),
by_hour AS (
  SELECT jsonb_agg(jsonb_build_object('hour', h, 'count', cnt) ORDER BY h) AS data
  FROM (
    SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Jakarta')::int AS h,
           COUNT(*) AS cnt
    FROM completed GROUP BY 1
  ) x
),
by_day AS (
  SELECT jsonb_agg(jsonb_build_object('day', d, 'gross', gross) ORDER BY d) AS data
  FROM (
    SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
           SUM(gross) AS gross
    FROM completed GROUP BY 1
  ) x
),
top_items AS (
  SELECT jsonb_agg(jsonb_build_object(
           'name', name, 'qty', qty, 'gross', gross
         ) ORDER BY qty DESC) AS data
  FROM (
    SELECT oi.menu_item_name AS name,
           SUM(oi.quantity)  AS qty,
           SUM(oi.subtotal)  AS gross
    FROM public.order_items oi
    JOIN completed c ON c.id = oi.order_id
    GROUP BY oi.menu_item_name
    ORDER BY qty DESC
    LIMIT 10
  ) x
),
statuses AS (
  SELECT
    COUNT(*) FILTER (
      WHERE status = 'pending'
    ) AS pending_count,
    COUNT(*) FILTER (
      WHERE status = 'cancelled' OR COALESCE(cancellation_status, '') = 'pending_approval'
    ) AS cancelled_count
  FROM scoped
)
SELECT jsonb_build_object(
  'gross',           t.gross,
  'net',             t.net,
  'deductions',      GREATEST(t.gross - t.net, 0),
  'order_count',     t.order_count,
  'items_sold',      t.items_sold,
  'avg_order_gross', CASE WHEN t.order_count > 0 THEN t.net / t.order_count ELSE 0 END,
  'pending_count',   s.pending_count,
  'cancelled_count', s.cancelled_count,
  'by_payment',      COALESCE(bp.data, '[]'::jsonb),
  'by_hour',         COALESCE(bh.data, '[]'::jsonb),
  'by_day',          COALESCE(bd.data, '[]'::jsonb),
  'top_items',       COALESCE(ti.data, '[]'::jsonb)
)
FROM totals t, statuses s, by_payment bp, by_hour bh, by_day bd, top_items ti;
$$;

CREATE OR REPLACE FUNCTION public.pos_revenue_summary_guarded(
  p_outlet_id      uuid,
  p_start          timestamptz DEFAULT NULL,
  p_end            timestamptz DEFAULT NULL,
  p_payment_method text        DEFAULT NULL,
  p_channels       text[]      DEFAULT NULL,
  p_include_null_channel boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_outlet_id NOT IN (SELECT accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak punya akses ke outlet ini';
  END IF;

  RETURN public.pos_revenue_summary(
    p_outlet_id, p_start, p_end, p_payment_method, p_channels, p_include_null_channel
  );
END $$;
`;

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.log('Trying via raw postgres query...');
    // If exec_sql doesn't exist, we can't easily run DDL from client SDK.
    console.log(error);
  } else {
    console.log('Success:', data);
  }
}
main();
