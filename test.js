const { Client } = require('pg');
const client = new Client('postgres://postgres:Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8@db.khpkoreaaucvyqfhynfq.supabase.co:6543/postgres');

(async () => {
  try {
    await client.connect();
    
    const res = await client.query(`
      WITH 
      days AS (
        SELECT d::DATE AS dt
        FROM generate_series(make_date(2026, 7, 1), make_date(2026, 7, 31), '1 day'::interval) d
      ),
      DailyOrders AS (
        SELECT 
          id AS order_id,
          (created_at AT TIME ZONE 'Asia/Jakarta')::date AS order_date,
          total_amount,
          SUM(total_amount) OVER (PARTITION BY (created_at AT TIME ZONE 'Asia/Jakarta')::date ORDER BY created_at ASC) AS running_total
        FROM public.orders
        WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002'
          AND status = 'completed'
          AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Asia/Jakarta')) = 7
          AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Asia/Jakarta')) = 2026
      ),
      DailyTargets AS (
        SELECT DISTINCT
          order_date,
          public.resolve_daily_target('550e8400-e29b-41d4-a716-446655440002', order_date) AS target_amount,
          public.resolve_per_item_bonus('550e8400-e29b-41d4-a716-446655440002', order_date) AS per_item_bonus
        FROM DailyOrders
      ),
      BonusItems AS (
        SELECT 
          d.order_date,
          COALESCE(SUM(oi.quantity), 0) AS additional_items
        FROM DailyOrders d
        JOIN DailyTargets dt ON dt.order_date = d.order_date
        JOIN public.order_items oi ON oi.order_id = d.order_id
        WHERE d.running_total >= dt.target_amount
        GROUP BY d.order_date
      ),
      daily_target_eval AS (
        SELECT
          d.order_date,
          SUM(d.total_amount) AS daily_sales,
          dt.target_amount,
          dt.per_item_bonus,
          COALESCE(b.additional_items, 0) AS additional_items
        FROM DailyOrders d
        JOIN DailyTargets dt ON dt.order_date = d.order_date
        LEFT JOIN BonusItems b ON b.order_date = d.order_date
        GROUP BY d.order_date, dt.target_amount, dt.per_item_bonus, b.additional_items
      )
      SELECT
        COALESCE(SUM(CASE WHEN daily_sales >= target_amount THEN 1 ELSE 0 END), 0)::INT as days_reached,
        COALESCE(SUM(CASE WHEN daily_sales >= target_amount 
                     THEN (additional_items * per_item_bonus) 
                     ELSE 0 END), 0)::NUMERIC as total_bonus
      FROM daily_target_eval;
    `);
    
    console.log('Total Bonus calculated:', res.rows[0]);
    
    const crewCountRes = await client.query(`
      SELECT COUNT(*)::INT as count
      FROM public.outlet_staff
      WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002'
        AND role = 'crew'
        AND status = 'active';
    `);
    
    const count = crewCountRes.rows[0].count;
    console.log('Crew Count:', count);
    
    if (count > 0) {
      console.log('Bonus per crew:', res.rows[0].total_bonus / count);
    } else {
      console.log('Bonus per crew: 0');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
