-- Migration: Mitra PnL RPC Optimizations

-- 1. Helper function for item HPP
CREATE OR REPLACE FUNCTION get_mitra_item_hpp(
    p_menu_item_id uuid,
    p_channel text
) RETURNS numeric AS $$
DECLARE
    v_base_hpp numeric := 0;
    v_is_package boolean;
    v_hpp_override numeric;
    v_channel_hpp jsonb;
    v_norm_ch text := lower(p_channel);
    v_ch_val numeric;
    
    v_pkg_record RECORD;
    v_comp_hpp numeric;
BEGIN
    SELECT is_package, hpp_override, channel_hpp 
    INTO v_is_package, v_hpp_override, v_channel_hpp
    FROM public.menu_items WHERE id = p_menu_item_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
        IF v_norm_ch IN ('ss-online', 'ss_online', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584') OR v_norm_ch LIKE '%tiktok%' OR v_norm_ch LIKE '%shopee%' THEN
            v_ch_val := COALESCE(
                (v_channel_hpp->>'ss_online')::numeric, 
                (v_channel_hpp->>'tiktok_shop')::numeric, 
                (v_channel_hpp->>'shopee_shop')::numeric, 
                (v_channel_hpp->>v_norm_ch)::numeric
            );
        ELSE
            v_ch_val := (v_channel_hpp->>v_norm_ch)::numeric;
        END IF;
    END IF;
    
    IF v_ch_val IS NOT NULL AND v_ch_val > 0 THEN
        v_base_hpp := v_ch_val;
    ELSIF v_hpp_override IS NOT NULL AND v_hpp_override > 0 THEN
        v_base_hpp := v_hpp_override;
    ELSIF v_is_package THEN
        FOR v_pkg_record IN (SELECT menu_item_id, quantity FROM public.menu_packages WHERE package_id = p_menu_item_id) LOOP
            v_comp_hpp := public.get_mitra_item_hpp(v_pkg_record.menu_item_id, p_channel);
            IF v_comp_hpp = 0 THEN
                -- Fallback to pure hpp_override without markup if component has no channel_hpp
                v_comp_hpp := COALESCE((SELECT hpp_override FROM public.menu_items WHERE id = v_pkg_record.menu_item_id), 0);
                -- Actually the JS says: pkg.component ? getItemHpp(pkg.component) : (pkg.component?.hpp_override || 0)
                -- but get_mitra_item_hpp handles all this.
            END IF;
            v_base_hpp := v_base_hpp + (v_comp_hpp * v_pkg_record.quantity);
        END LOOP;
        -- Revert the +10% that was applied to components?
        -- Wait, the JS says:
        -- compHpp = getItemHpp(pkg.component, outletType, channel)
        -- which adds 10%.
        -- then sum.
        -- And then AT THE END: if (outletType === 'mitra' && baseHpp > 0) return Math.round(baseHpp * 1.10)
        -- Wait, does it double-add 10% for packages?!
        -- Let's check JS:
        --   compHpp = getItemHpp(...) -> returns with +10%.
        --   sum + compHpp * qty
        --   if (outletType == 'mitra') return baseHpp * 1.10
        -- YES! The JS implementation has a recursive 10% multiplier for packages!
        -- If it does, we must match it (or fix it, but matching POS logic is required).
    END IF;
    
    IF v_base_hpp > 0 THEN
        RETURN round(v_base_hpp * 1.10);
    END IF;
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Return Type
DROP TYPE IF EXISTS mitra_orders_summary_row CASCADE;
CREATE TYPE mitra_orders_summary_row AS (
  outlet_id uuid,
  channel_group text,
  gross_revenue numeric,
  deductions numeric,
  cogs numeric,
  order_count integer,
  grab_rev numeric,
  gofood_rev numeric,
  shopee_rev numeric
);

-- 3. Main function
CREATE OR REPLACE FUNCTION get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamp,
    p_to timestamp
) RETURNS SETOF mitra_orders_summary_row AS $$
BEGIN
    RETURN QUERY
    WITH order_details AS (
        SELECT 
            o.id as order_id,
            o.outlet_id,
            COALESCE(o.total_amount, 0) as total_amount,
            COALESCE(o.discount_amount, 0) as discount_amount,
            COALESCE(o.promo_subsidy, 0) as promo_subsidy,
            lower(COALESCE(o.channel, 'pos')) as channel,
            lower(COALESCE(o.sales_source, o.channel, 'pos')) as src,
            (
                SELECT COALESCE(SUM(oi.quantity * COALESCE(oi.subtotal, oi.unit_price, 0)), 0)
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            ) as item_gross,
            (
                SELECT COALESCE(SUM(oi.quantity * public.get_mitra_item_hpp(oi.menu_item_id, o.channel)), 0)
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            ) as order_cogs
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= p_from 
          AND o.created_at <= p_to
    ),
    calculated AS (
        SELECT 
            outlet_id,
            total_amount,
            discount_amount,
            promo_subsidy,
            channel,
            src,
            item_gross,
            order_cogs,
            GREATEST(0, item_gross - total_amount) as item_diff,
            GREATEST(0, GREATEST(0, item_gross - total_amount) - (discount_amount + promo_subsidy)) as extra_diff,
            discount_amount + promo_subsidy + GREATEST(0, GREATEST(0, item_gross - total_amount) - (discount_amount + promo_subsidy)) as deductions,
            CASE WHEN item_gross > 0 THEN item_gross ELSE (total_amount + discount_amount + promo_subsidy) END as gross_rev,
            CASE 
                WHEN src LIKE '%grab%' OR src LIKE '%gofood%' OR src LIKE '%shopee%' OR src = 'food_delivery' OR channel LIKE '%grab%' OR channel LIKE '%go%' OR channel LIKE '%shopee%' THEN 'foodApps'
                WHEN src LIKE '%tiktok%' OR channel LIKE '%tiktok%' THEN 'tiktok'
                ELSE 'pos'
            END as channel_group,
            CASE WHEN src LIKE '%grab%' OR channel LIKE '%grab%' THEN total_amount ELSE 0 END as grab_rev_val,
            CASE WHEN src LIKE '%gofood%' OR src LIKE '%go_food%' OR channel LIKE '%go%' THEN total_amount ELSE 0 END as gofood_rev_val,
            CASE WHEN src LIKE '%shopee%' OR channel LIKE '%shopee%' THEN total_amount ELSE 0 END as shopee_rev_val
        FROM order_details
    )
    SELECT 
        c.outlet_id,
        c.channel_group,
        SUM(c.gross_rev) as gross_revenue,
        SUM(c.deductions) as deductions,
        SUM(c.order_cogs) as cogs,
        COUNT(*)::integer as order_count,
        SUM(c.grab_rev_val) as grab_rev,
        SUM(c.gofood_rev_val) as gofood_rev,
        SUM(c.shopee_rev_val) as shopee_rev
    FROM calculated c
    GROUP BY c.outlet_id, c.channel_group;
END;
$$ LANGUAGE plpgsql;
