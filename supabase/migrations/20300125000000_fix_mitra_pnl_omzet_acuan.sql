-- 20300125000000_fix_mitra_pnl_omzet_acuan.sql
--
-- Menyamakan acuan Omzet Kotor dashboard Mitra dengan dashboard Owner, dan
-- menutup tiga cacat di get_mitra_orders_summary / get_mitra_item_hpp.
--
-- ============================================================================
-- CACAT 1 -- item_gross memakai `oi.quantity * oi.subtotal` (dobel hitung).
--   `order_items.subtotal` SUDAH `unit_price * quantity` (lihat apps/pos-kasir
--   checkout/manual/walk-in/pull-online route: `const subtotal = unitPrice * quantity`).
--   Dikalikan quantity lagi = tiap baris dengan qty>=2 dihitung berlipat.
--   Bukti lapangan Agustus 2026, 9 outlet mitra: omzet menggelembung +36% s/d
--   +138%. Contoh MITRA KALISARI: 152 dari 975 baris item ber-qty>1 -->
--   omzet terbaca Rp 66.401.001, padahal acuannya Rp 46.527.169.
--
-- CACAT 2 -- item_gross bukan acuan omzet yang benar, bahkan setelah dobelnya
--   dibuang. Untuk order food-apps, `promo_subsidy` TIDAK tercermin di baris
--   order_items sama sekali: `SUM(subtotal)` justru sama persis dengan
--   `total_amount`, dan subsidinya berdiri terpisah. Di Kalisari, 151 dari 752
--   order berpola begini, membuat SUM(subtotal) kurang Rp 3.125.168 sebulan.
--   Karena itu `extraDiff` (tambalan selisih item vs total) juga dibuang --
--   ia lahir dari ketidakcocokan yang tak pernah nyata.
--
--   Acuan kanonik dipakai di seluruh sistem (lihat sales_daily_spv +
--   apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx):
--       Omzet Kotor = total_amount + discount_amount + promo_subsidy
--       Potongan    = discount_amount + promo_subsidy
--       Net Revenue = total_amount              (uang yang benar-benar masuk)
--
--   Dampak perbaikan (Agustus 2026, 9 outlet mitra): Net Profit yang selama ini
--   dilaporkan TERLALU KECIL di SEMUA outlet -- total Rp 33,8 juta, setara
--   Rp 27,8 juta kekurangan pada angka bagi hasil mitra. Penyebabnya gelembung
--   cacat 1 masuk ke Potongan lewat extraDiff, dan potongan palsu itu lebih
--   besar daripada tambahan omzetnya.
--
-- CACAT 3 -- markup mitra 10% ditumpuk dua kali pada menu paket.
--   get_mitra_item_hpp menjumlahkan komponen lewat pemanggilan rekursif dirinya
--   sendiri (yang sudah mengembalikan nilai ber-markup), lalu mengalikan 1,10
--   sekali lagi di akhir => paket kena 1,21. Komentar di migration aslinya
--   (20300113000000) sudah menyadari ini tapi sengaja meniru bug JS-nya.
--   Diperbaiki dengan memisahkan fungsi basis (tanpa markup) dari fungsi
--   ber-markup, sehingga 1,10 hanya berlaku sekali di lapisan terluar.
--
-- CACAT 4 -- parameter p_from/p_to bertipe `timestamp` (naive), sedangkan
--   pemanggil mengirim ISO string ber-zona. Batas hari jadi bergeser mengikuti
--   timezone sesi DB (terbukti: 4-5 order berbeda antara hitungan aplikasi dan
--   RPC pada rentang yang sama). Diubah ke `timestamptz`.
--
-- LINGKUP: hanya dashboard Mitra (get_mitra_orders_summary dipakai oleh
--   mitraPnl.ts dan mitraRoi.ts). Tidak menyentuh view/RPC dashboard Owner,
--   tidak menyentuh stok/ledger, tidak mengubah data satu baris pun.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. HPP: pisahkan basis (tanpa markup) dari nilai ber-markup mitra.
-- ----------------------------------------------------------------------------

-- HPP dasar, TANPA markup mitra. Rekursi paket memakai fungsi ini juga, supaya
-- komponen tidak ikut ter-markup lebih dulu.
CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_base(
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
    v_pkg RECORD;
BEGIN
    SELECT is_package, hpp_override, channel_hpp
    INTO v_is_package, v_hpp_override, v_channel_hpp
    FROM public.menu_items WHERE id = p_menu_item_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
        IF v_norm_ch IN ('ss-online', 'ss_online',
                         'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
                         'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584')
           OR v_norm_ch LIKE '%tiktok%' OR v_norm_ch LIKE '%shopee%' THEN
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
        FOR v_pkg IN (
            SELECT menu_item_id, quantity
            FROM public.menu_packages
            WHERE package_id = p_menu_item_id
        ) LOOP
            v_base_hpp := v_base_hpp
                + public.get_mitra_item_hpp_base(v_pkg.menu_item_id, p_channel)
                  * COALESCE(v_pkg.quantity, 1);
        END LOOP;
    END IF;

    RETURN COALESCE(v_base_hpp, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Markup mitra 10% diterapkan SEKALI, di lapisan terluar.
CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp(
    p_menu_item_id uuid,
    p_channel text
) RETURNS numeric AS $$
DECLARE
    v_base numeric;
BEGIN
    v_base := public.get_mitra_item_hpp_base(p_menu_item_id, p_channel);
    IF v_base > 0 THEN
        RETURN round(v_base * 1.10);
    END IF;
    RETURN 0;
END;
$$ LANGUAGE plpgsql STABLE;


-- ----------------------------------------------------------------------------
-- 2. Ringkasan order: omzet memakai acuan kanonik, parameter jadi timestamptz.
-- ----------------------------------------------------------------------------

-- Tipe parameter berubah (timestamp -> timestamptz), jadi signature lama harus
-- dibuang dulu; CREATE OR REPLACE tidak bisa mengubah tipe argumen.
DROP FUNCTION IF EXISTS public.get_mitra_orders_summary(uuid[], timestamp, timestamp);
DROP FUNCTION IF EXISTS public.get_mitra_orders_summary(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamptz,
    p_to timestamptz
) RETURNS SETOF mitra_orders_summary_row AS $$
BEGIN
    RETURN QUERY
    WITH order_details AS (
        SELECT
            o.id AS order_id,
            o.outlet_id,
            COALESCE(o.total_amount, 0)     AS total_amount,
            COALESCE(o.discount_amount, 0)  AS discount_amount,
            COALESCE(o.promo_subsidy, 0)    AS promo_subsidy,
            lower(COALESCE(o.channel, 'pos'))                  AS channel,
            lower(COALESCE(o.sales_source, o.channel, 'pos'))  AS src,
            (
                -- HPP tetap dari baris item: quantity * HPP per unit.
                SELECT COALESCE(SUM(oi.quantity * public.get_mitra_item_hpp(oi.menu_item_id, o.channel)), 0)
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            ) AS order_cogs
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
            channel,
            src,
            order_cogs,
            -- Acuan kanonik, sama dengan sales_daily_spv + halaman Owner.
            discount_amount + promo_subsidy                     AS deductions,
            total_amount + discount_amount + promo_subsidy      AS gross_rev,
            CASE
                WHEN src LIKE '%tiktok%' OR channel LIKE '%tiktok%'
                     OR channel = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'
                     OR channel = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' THEN 'tiktok'
                WHEN src LIKE '%grab%' OR src LIKE '%gofood%' OR src LIKE '%go_food%'
                     OR src LIKE '%gojek%' OR src LIKE '%shopee%'
                     OR src IN ('food_delivery', 'food_apps', 'foodapps')
                     OR channel LIKE '%grab%' OR channel LIKE '%gofood%'
                     OR channel LIKE '%go_food%' OR channel LIKE '%gojek%'
                     OR channel LIKE '%shopee%'
                     OR channel IN ('food_delivery', 'food_apps', 'foodapps')
                     OR channel IN ('1284ac2a-e753-4380-9f32-59219a322459',
                                    '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a',
                                    '0eaf2746-da9f-492c-a9b4-f091307c98c2') THEN 'foodApps'
                ELSE 'pos'
            END AS channel_group,
            CASE WHEN (src LIKE '%grab%' OR channel LIKE '%grab%'
                       OR channel = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a')
                      AND src NOT LIKE '%tiktok%' AND channel NOT LIKE '%tiktok%'
                 THEN total_amount ELSE 0 END AS grab_rev_val,
            CASE WHEN (src LIKE '%gofood%' OR src LIKE '%go_food%' OR src LIKE '%gojek%'
                       OR channel LIKE '%gofood%' OR channel LIKE '%go_food%'
                       OR channel LIKE '%gojek%'
                       OR channel = '1284ac2a-e753-4380-9f32-59219a322459')
                      AND src NOT LIKE '%tiktok%' AND channel NOT LIKE '%tiktok%'
                 THEN total_amount ELSE 0 END AS gofood_rev_val,
            CASE WHEN (src LIKE '%shopee%' OR channel LIKE '%shopee%'
                       OR channel = '0eaf2746-da9f-492c-a9b4-f091307c98c2')
                      AND src NOT LIKE '%tiktok%' AND channel NOT LIKE '%tiktok%'
                 THEN total_amount ELSE 0 END AS shopee_rev_val
        FROM order_details
    )
    SELECT
        c.outlet_id,
        c.channel_group,
        SUM(c.gross_rev)        AS gross_revenue,
        SUM(c.deductions)       AS deductions,
        SUM(c.order_cogs)       AS cogs,
        COUNT(*)::integer       AS order_count,
        SUM(c.grab_rev_val)     AS grab_rev,
        SUM(c.gofood_rev_val)   AS gofood_rev,
        SUM(c.shopee_rev_val)   AS shopee_rev
    FROM calculated c
    GROUP BY c.outlet_id, c.channel_group;
END;
$$ LANGUAGE plpgsql;
