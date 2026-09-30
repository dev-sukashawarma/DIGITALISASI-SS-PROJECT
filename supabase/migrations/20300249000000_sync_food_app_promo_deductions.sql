-- 20300249000000_sync_food_app_promo_deductions.sql
--
-- Sinkronisasi potongan/diskon merchant Food Apps (ShopeeFood, GrabFood, GoFood, TikTok Go)
-- ke dalam view sales_daily_spv dan sales_daily_scoped.
--
-- Latar Belakang:
--   Pada pesanan Food Apps (sejak 19 Agustus 2026), `orders.total_amount` bernilai harga
--   menu kotor (gross), sedangkan potongan promo dicatat kasir di `promo_subsidy`.
--   Sebelumnya, `total_deductions` dihitung dari GREATEST(0, total_subtotal - total_amount)
--   sehingga untuk Food Apps menghasilkan Rp 0 di Laba Rugi / Untung Rugi.
--
-- Perubahan:
--   - Untuk Food Apps (shopeefood, grabfood, gofood, tiktok):
--       total_deductions = promo_subsidy (+ selisih subtotal jika ada)
--       omzet (net)      = total_amount - total_deductions
--     sehingga omzet (net) + total_deductions = total_amount (gross tetap utuh).
--   - Untuk non-Food Apps (POS offline, online):
--       tetap memakai logika sebelumnya (total_amount sudah net).

CREATE OR REPLACE VIEW public.sales_daily_spv AS
WITH item_totals AS (
  SELECT oi.order_id,
     sum(oi.subtotal) AS total_subtotal
    FROM order_items oi
   GROUP BY oi.order_id
), resolved AS (
  SELECT o.outlet_id,
     o.total_amount,
     o.discount_amount,
     o.promo_subsidy,
     it.total_subtotal,
     (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
     CASE
         WHEN o.is_endorse OR (lower(COALESCE(o.channel, ''::text)) = ANY (ARRAY['endors'::text, 'endorse'::text])) OR (lower(COALESCE(o.sales_source, ''::text)) = ANY (ARRAY['endors'::text, 'endorse'::text])) THEN 'endors'::text
         ELSE resolve_sales_source(o.channel, o.sales_source)
     END AS sales_source
    FROM orders o
      LEFT JOIN item_totals it ON it.order_id = o.id
   WHERE o.status = 'completed'::text AND o.outlet_id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid AND (o.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids))
), order_calc AS (
  SELECT
    r.outlet_id,
    r.sales_source,
    r.sales_date,
    CASE
      -- Food Apps: total_amount sudah harga gross menu, omzet net = total_amount - promo_subsidy
      WHEN r.sales_source IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
        GREATEST(0::numeric, COALESCE(r.total_amount, 0::numeric) - (
          GREATEST(0::numeric, COALESCE(r.total_subtotal, 0::numeric) - COALESCE(r.total_amount, 0::numeric)) + COALESCE(r.promo_subsidy, 0)::numeric
        ))
      -- Non Food Apps: total_amount di DB sudah net
      ELSE
        COALESCE(r.total_amount, 0::numeric)
    END AS net_omzet,
    CASE
      -- Food Apps: potongan = promo_subsidy (+ diskon offline jika ada selisih subtotal)
      WHEN r.sales_source IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
        GREATEST(0::numeric, COALESCE(r.total_subtotal, 0::numeric) - COALESCE(r.total_amount, 0::numeric)) + COALESCE(r.promo_subsidy, 0)::numeric
      -- Non Food Apps:
      WHEN r.total_subtotal IS NULL THEN
        COALESCE(r.discount_amount, 0::numeric) + COALESCE(r.promo_subsidy, 0)::numeric
      ELSE
        GREATEST(0::numeric, r.total_subtotal - COALESCE(r.total_amount, 0::numeric))
    END AS deduction
  FROM resolved r
)
SELECT outlet_id,
   sales_source,
   sales_date,
   COALESCE(sum(net_omzet), 0::numeric) AS omzet,
   COALESCE(sum(deduction), 0::numeric) AS total_deductions,
   count(*) AS jumlah_order_completed
  FROM order_calc
 GROUP BY outlet_id, sales_source, sales_date;

CREATE OR REPLACE VIEW public.sales_daily_scoped AS
SELECT outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed
FROM public.sales_daily_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());

GRANT SELECT ON public.sales_daily_spv TO authenticated;
GRANT SELECT ON public.sales_daily_scoped TO authenticated;
REVOKE ALL ON public.sales_daily_spv FROM anon;
REVOKE ALL ON public.sales_daily_scoped FROM anon;
