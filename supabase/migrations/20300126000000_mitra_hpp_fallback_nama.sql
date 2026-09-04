-- 20300126000000_mitra_hpp_fallback_nama.sql
--
-- HPP mitra: cari lewat NAMA menu bila `order_items.menu_item_id` kosong.
--
-- ============================================================================
-- MASALAH
--   Jalur pemesanan web menyimpan baris `order_items` dengan `menu_item_id`
--   NULL -- hanya `menu_item_name` yang terisi. Karena get_mitra_orders_summary
--   mencari HPP lewat id, biaya bahan order-order itu terhitung Rp 0:
--   omzet & uangnya masuk, biayanya hilang, laba mitra jadi kelihatan lebih
--   besar dari yang sebenarnya.
--
--   Terukur Agustus 2026, 9 outlet mitra:
--     - 98 order ber-`external_order_id` (100% QRIS, ada nama pembeli) --
--       SELURUH itemnya tanpa menu_item_id: 167 baris / 219 porsi.
--     - Jalur lain praktis bersih: 2 baris nyasar dari ~20.000.
--     - HPP yang hilang: Rp 4.282.740 -> bagi hasil mitra kelebihan
--       Rp 3.975.730 (Cileungsi sendiri Rp 2.070.640).
--
-- PENDEKATAN
--   Pola yang sama sudah dipakai dashboard Owner (`useHpp.ts`
--   `menuItemByNameMap`): kalau lookup id gagal, cocokkan nama menu yang sudah
--   dibersihkan dari metadata checkout ("Nama|ID|..|PARENT|..|NOTE|..").
--   Di sini pembersihannya = `split_part(name, '|', 1)`, lalu `btrim` + `lower`
--   supaya sedikit lebih toleran daripada versi TS (yang cocok persis).
--
--   Aman dari salah tebak: 50 baris `menu_items`, dan SETELAH dibersihkan
--   ke-50 namanya unik -- tidak ada satu pun yang bentrok, jadi pencocokan
--   nama deterministik. `ORDER BY id` tetap dipasang sebagai jaring pengaman
--   kalau kelak ada nama kembar.
--
--   Fallback hanya jalan saat lookup id menghasilkan 0 (COALESCE
--   short-circuit), jadi baris yang sudah benar tidak tersentuh dan biaya
--   query-nya hanya untuk segelintir baris bermasalah.
--
-- BUKAN perbaikan akar masalah. Jalur ingest web tetap harus diperbaiki agar
--   mengisi `menu_item_id`; migration ini menambal laporan untuk order yang
--   sudah terlanjur masuk.
--
-- LINGKUP: hanya dashboard Mitra. Tidak menyentuh dashboard Owner, stok,
--   ledger, maupun data satu baris pun.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_by_name(
    p_name text,
    p_channel text
) RETURNS numeric AS $$
DECLARE
    v_id uuid;
    v_key text;
BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RETURN 0;
    END IF;

    v_key := lower(btrim(split_part(p_name, '|', 1)));
    IF v_key = '' THEN
        RETURN 0;
    END IF;

    SELECT m.id INTO v_id
    FROM public.menu_items m
    WHERE lower(btrim(split_part(m.name, '|', 1))) = v_key
    ORDER BY m.id
    LIMIT 1;

    IF v_id IS NULL THEN
        RETURN 0;
    END IF;

    RETURN public.get_mitra_item_hpp(v_id, p_channel);
END;
$$ LANGUAGE plpgsql STABLE;


-- Hanya blok `order_cogs` yang berubah; sisanya identik dengan
-- 20300125000000_fix_mitra_pnl_omzet_acuan.sql.
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
                SELECT COALESCE(SUM(
                    oi.quantity * COALESCE(
                        -- utama: lewat id
                        NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, o.channel), 0),
                        -- cadangan: lewat nama (order web tanpa menu_item_id)
                        public.get_mitra_item_hpp_by_name(oi.menu_item_name, o.channel)
                    )
                ), 0)
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
