-- 20300127000000_mitra_hpp_fallback_nama.sql
--
-- HPP mitra: cari lewat NAMA menu bila `order_items.menu_item_id` kosong,
-- DI ATAS struktur set-based dari 20300126000000_optimize_mitra_performance.
--
-- ============================================================================
-- MASALAH
--   Jalur pemesanan web menyimpan baris `order_items` dengan `menu_item_id`
--   NULL -- hanya `menu_item_name` yang terisi. Karena get_mitra_orders_summary
--   mencari HPP lewat id, biaya bahan order-order itu terhitung Rp 0: omzet &
--   uangnya masuk, biayanya hilang, laba mitra kelihatan lebih besar dari yang
--   sebenarnya.
--
--   Terukur Agustus 2026, 9 outlet mitra:
--     - 98 order ber-`external_order_id` (100% QRIS, ada nama pembeli, ada
--       catatan pesanan) -- SELURUH itemnya tanpa menu_item_id: 167 baris /
--       219 porsi. Jalur lain praktis bersih: 2 baris dari ~20.000.
--     - Bukan order endorse: ke-27 order endorse justru ber-menu_item_id lengkap.
--     - HPP hilang Rp 4.282.740 -> bagi hasil mitra kelebihan Rp 3.975.730
--       (Cileungsi sendiri Rp 2.070.640).
--
-- PENDEKATAN
--   Pola yang sama sudah dipakai dashboard Owner (`useHpp.ts`
--   menuItemByNameMap): kalau lookup id gagal, cocokkan nama menu yang sudah
--   dibersihkan dari metadata checkout ("Nama|ID|..|PARENT|..|NOTE|..").
--   Pembersihannya = `split_part(name,'|',1)` + btrim + lower.
--
--   Aman dari salah tebak: 50 baris `menu_items`, dan setelah dibersihkan
--   ke-50 namanya unik -- tidak ada yang bentrok. `ORDER BY id` dipasang
--   sebagai jaring pengaman kalau kelak ada nama kembar.
--
--   Fallback hanya jalan saat lookup id menghasilkan 0 (COALESCE
--   short-circuit), jadi baris yang sudah benar tak tersentuh dan biaya
--   query-nya hanya untuk segelintir baris bermasalah.
--
-- ⚠ KENAPA MIGRATION INI ADA (jangan diringkas jadi "cuma tambah fallback")
--   20300126000000 sempat dipakai DUA migration berbeda oleh dua orang:
--   `optimize_mitra_performance` (dev lain) dan `mitra_hpp_fallback_nama`
--   (versi awal file ini). Keduanya sama-sama `CREATE OR REPLACE` fungsi yang
--   SAMA, jadi yang jalan belakangan menimpa yang lain tanpa keluhan apa pun.
--   Sempat terjadi betulan di DB produksi: fallback nama diterapkan setelah
--   optimasi performa, sehingga struktur set-based `order_cogs_agg` hilang dari
--   fungsi live (indeks-nya tetap ada, karena itu objek terpisah).
--
--   Migration ini menomori ulang ke 20300127000000 dan MENGGABUNGKAN keduanya:
--   struktur set-based milik 20300126000000 + fallback nama. Jangan
--   memisahkannya lagi. Sebelum menyentuh get_mitra_orders_summary, jalankan
--   dulu: grep -rn "get_mitra_orders_summary" supabase/migrations/
--
-- BUKAN perbaikan akar masalah: jalur ingest web tetap harus diperbaiki agar
--   mengisi `menu_item_id`. Ini menambal laporan untuk order yang sudah masuk.
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


-- Struktur identik dengan 20300126000000_optimize_mitra_performance
-- (orders_filtered + order_cogs_agg set-based, bukan correlated subquery),
-- hanya blok perhitungan HPP di `order_cogs_agg` yang ditambahi cadangan nama.
CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamptz,
    p_to timestamptz
) RETURNS SETOF mitra_orders_summary_row AS $$
BEGIN
    RETURN QUERY
    WITH orders_filtered AS (
        SELECT
            o.id AS order_id,
            o.outlet_id,
            COALESCE(o.total_amount, 0)     AS total_amount,
            COALESCE(o.discount_amount, 0)  AS discount_amount,
            COALESCE(o.promo_subsidy, 0)    AS promo_subsidy,
            lower(COALESCE(o.channel, 'pos'))                  AS channel,
            lower(COALESCE(o.sales_source, o.channel, 'pos'))  AS src
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= p_from
          AND o.created_at <= p_to
    ),
    order_cogs_agg AS (
        SELECT
            oi.order_id,
            COALESCE(SUM(
                oi.quantity * COALESCE(
                    -- utama: lewat id
                    NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel), 0),
                    -- cadangan: lewat nama (order web tanpa menu_item_id)
                    public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel)
                )
            ), 0) AS order_cogs
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        GROUP BY oi.order_id
    ),
    calculated AS (
        SELECT
            of.outlet_id,
            of.total_amount,
            of.channel,
            of.src,
            COALESCE(oca.order_cogs, 0)                             AS order_cogs,
            of.discount_amount + of.promo_subsidy                   AS deductions,
            of.total_amount + of.discount_amount + of.promo_subsidy AS gross_rev,
            CASE
                WHEN of.src LIKE '%tiktok%' OR of.channel LIKE '%tiktok%'
                     OR of.channel = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'
                     OR of.channel = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' THEN 'tiktok'
                WHEN of.src LIKE '%grab%' OR of.src LIKE '%gofood%' OR of.src LIKE '%go_food%'
                     OR of.src LIKE '%gojek%' OR of.src LIKE '%shopee%'
                     OR of.src IN ('food_delivery', 'food_apps', 'foodapps')
                     OR of.channel LIKE '%grab%' OR of.channel LIKE '%gofood%'
                     OR of.channel LIKE '%go_food%' OR of.channel LIKE '%gojek%'
                     OR of.channel LIKE '%shopee%'
                     OR of.channel IN ('food_delivery', 'food_apps', 'foodapps')
                     OR of.channel IN ('1284ac2a-e753-4380-9f32-59219a322459',
                                    '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a',
                                    '0eaf2746-da9f-492c-a9b4-f091307c98c2') THEN 'foodApps'
                ELSE 'pos'
            END AS channel_group,
            CASE WHEN (of.src LIKE '%grab%' OR of.channel LIKE '%grab%'
                       OR of.channel = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS grab_rev_val,
            CASE WHEN (of.src LIKE '%gofood%' OR of.src LIKE '%go_food%' OR of.src LIKE '%gojek%'
                       OR of.channel LIKE '%gofood%' OR of.channel LIKE '%go_food%'
                       OR of.channel LIKE '%gojek%'
                       OR of.channel = '1284ac2a-e753-4380-9f32-59219a322459')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS gofood_rev_val,
            CASE WHEN (of.src LIKE '%shopee%' OR of.channel LIKE '%shopee%'
                       OR of.channel = '0eaf2746-da9f-492c-a9b4-f091307c98c2')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS shopee_rev_val
        FROM orders_filtered of
        LEFT JOIN order_cogs_agg oca ON of.order_id = oca.order_id
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
