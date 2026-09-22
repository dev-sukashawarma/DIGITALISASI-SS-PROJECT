-- Scope per-outlet untuk view definer: filter accessible_outlet_ids() DI DALAM
-- body view (di pemindaian tabel dasar), bukan di luar.
--
-- Setelah 20260922180000 (anon dicabut), sisa lubang: pengguna LOGIN biasa
-- (crew) masih membaca data outlet LAIN lewat view-view ini -- view dimiliki
-- postgres tanpa security_invoker sehingga RLS tabel dasar terlewati. Terukur
-- 2026-09-22: crew membaca 200+ baris ledger_feed_spv / sales_*_spv /
-- monitoring_view_* milik outlet lain.
--
-- KENAPA BUKAN security_invoker (sudah dicoba & DIBATALKAN 2026-09-22):
-- menyalakan security_invoker membuat RLS berlaku SETELAH agregasi dan lewat
-- policy ber-OR (termasuk get_user_role()), hasilnya benar tapi lambat luar
-- biasa untuk crew: ledger_feed_spv 8 ms -> 11.885 ms, sales_summary_spv
-- 479 ms -> 2.352 ms. Filter di dalam body justru dipakai planner untuk
-- memangkas lewat index: ledger_feed_spv crew jadi ~22 ms.
-- daily_target_progress_spv juga TIDAK tersaring oleh security_invoker karena
-- bersumber dari outlets (policy-nya `true`) -- butuh filter eksplisit.
--
-- Efek per peran (accessible_outlet_ids()):
--   - admin/owner/spv/kitchen/admin_finance/purchasing/regional_manager/
--     developer -> SEMUA outlet: isi view TIDAK berubah (diverifikasi: jumlah
--     baris & checksum isi identik untuk ke-11 view);
--   - leader/korlap/area_manager -> outlet binaan; crew/kiosk/mitra -> outlet
--     sendiri; service_role -> bypass (cabang service_role di helper).
--
-- View *_scoped di atas *_spv tetap benar (filter ganda, hasil sama).
-- DILUAR cakupan (berbasis PERAN, bukan outlet): po_payable_spv,
-- pembelian_supplier_*, v_tiktok_rekap_harian, owner_messages_overview,
-- valid_operational_outlets.

CREATE OR REPLACE VIEW public.ledger_feed_spv AS
SELECT l.id,
    l.outlet_id,
    o.name AS outlet_name,
    l.bahan_baku_id,
    b.nama AS item_name,
    b.satuan,
    l.tipe,
    l.qty,
    l.catatan,
    l.saldo_sesudah,
    l.created_at
   FROM ledger_stok l
     JOIN outlets o ON l.outlet_id = o.id
     JOIN bahan_baku b ON l.bahan_baku_id = b.id
  WHERE l.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  ORDER BY l.created_at DESC;

CREATE OR REPLACE VIEW public.sales_summary_spv AS
SELECT o.outlet_id,
    ou.name AS outlet_name,
    o.sales_source,
    (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    COALESCE(sum(o.total_amount) FILTER (WHERE o.status = 'completed'::text), 0::numeric) AS omzet,
    count(*) FILTER (WHERE o.status = 'completed'::text) AS jumlah_order_completed,
    count(*) AS jumlah_order_all
   FROM orders o
     JOIN outlets ou ON ou.id = o.outlet_id
  WHERE COALESCE(ou.type, ''::text) <> 'test'::text AND o.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  GROUP BY o.outlet_id, ou.name, o.sales_source, ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date);

CREATE OR REPLACE VIEW public.sales_hourly_spv AS
SELECT outlet_id,
    sales_source,
    (created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    EXTRACT(hour FROM (created_at AT TIME ZONE 'Asia/Jakarta'::text))::integer AS sales_hour,
    COALESCE(sum(total_amount) FILTER (WHERE status = 'completed'::text), 0::numeric) AS omzet,
    count(*) FILTER (WHERE status = 'completed'::text) AS jumlah_order_completed
   FROM orders o
  WHERE status = 'completed'::text AND outlet_id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid AND outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  GROUP BY outlet_id, sales_source, ((created_at AT TIME ZONE 'Asia/Jakarta'::text)::date), (EXTRACT(hour FROM (created_at AT TIME ZONE 'Asia/Jakarta'::text)));

CREATE OR REPLACE VIEW public.sales_items_spv AS
SELECT o.outlet_id,
    o.sales_source,
    oi.menu_item_name,
    (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    COALESCE(sum(oi.quantity) FILTER (WHERE o.status = 'completed'::text), 0::bigint) AS total_qty,
    COALESCE(sum(oi.subtotal) FILTER (WHERE o.status = 'completed'::text), 0::numeric) AS total_revenue,
    COALESCE(o.is_endorse, false) AS is_endorse
   FROM orders o
     JOIN order_items oi ON o.id = oi.order_id
  WHERE o.status = 'completed'::text AND o.outlet_id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid AND o.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  GROUP BY o.outlet_id, o.sales_source, oi.menu_item_name, o.is_endorse, ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date)
 HAVING COALESCE(sum(oi.quantity) FILTER (WHERE o.status = 'completed'::text), 0::bigint) > 0;

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
          WHERE o.status = 'completed'::text AND o.outlet_id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid AND o.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
        )
 SELECT outlet_id,
    sales_source,
    sales_date,
    COALESCE(sum(total_amount), 0::numeric) AS omzet,
    COALESCE(sum(
        CASE
            WHEN total_subtotal IS NULL THEN COALESCE(discount_amount, 0::numeric) + COALESCE(promo_subsidy, 0)::numeric
            ELSE GREATEST(0::numeric, total_subtotal - COALESCE(total_amount, 0::numeric))
        END), 0::numeric) AS total_deductions,
    count(*) AS jumlah_order_completed
   FROM resolved r
  GROUP BY outlet_id, sales_source, sales_date;

CREATE OR REPLACE VIEW public.daily_target_progress_spv AS
WITH today_orders AS (
         SELECT ord.outlet_id,
            sum(ord.total_amount) AS omzet_today
           FROM orders ord
          WHERE (ord.status = ANY (ARRAY['completed'::text, 'selesai'::text, 'paid'::text])) AND ord.created_at >= ((now() AT TIME ZONE 'Asia/Jakarta'::text)::date::timestamp without time zone AT TIME ZONE 'Asia/Jakarta'::text) AND ord.created_at < (((now() AT TIME ZONE 'Asia/Jakarta'::text)::date + '1 day'::interval) AT TIME ZONE 'Asia/Jakarta'::text) AND ord.outlet_id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
          GROUP BY ord.outlet_id
        )
 SELECT o.id AS outlet_id,
    o.name AS outlet_name,
    resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta'::text)::date) AS target_amount,
    COALESCE(t.omzet_today, 0::numeric) AS omzet_today
   FROM outlets o
     LEFT JOIN today_orders t ON t.outlet_id = o.id
  WHERE o.id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid AND o.id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids);

CREATE OR REPLACE VIEW public.hpp_barang_masuk_harian_spv AS
SELECT sj.outlet_id,
    (sj.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS tanggal,
    sum(sji.qty_terima * sji.harga_snapshot) AS nilai_masuk
   FROM surat_jalan sj
     JOIN surat_jalan_item sji ON sji.surat_jalan_id = sj.id
  WHERE sji.qty_terima IS NOT NULL AND sj.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  GROUP BY sj.outlet_id, ((sj.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date);

CREATE OR REPLACE VIEW public.monitoring_view_spv AS
WITH resep_projection AS (
         SELECT ri.bahan_baku_id,
            res.outlet_id AS resep_outlet_id,
            res.scope AS resep_scope,
            res.nama AS resep_nama,
            ri.qty_per_porsi,
            ri.satuan AS ri_satuan
           FROM resep_item ri
             JOIN resep res ON res.id = ri.resep_id
          WHERE res.is_active = true AND ri.qty_per_porsi > 0::numeric
        )
 SELECT sb.outlet_id,
    o.name AS outlet_name,
    sb.bahan_baku_id,
    b.nama AS item_name,
    b.satuan,
    b.kategori,
    sb.saldo AS current_qty,
    COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) AS threshold,
        CASE
            WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) / 2.0) THEN 'below'::text
            WHEN (EXISTS ( SELECT 1
               FROM resep_projection rp
              WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id) AND (sb.saldo IS NULL OR (sb.saldo / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric)) < COALESCE(o.marquee_warning_threshold, 7)::numeric))) THEN 'below'::text
            WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) THEN 'warning'::text
            ELSE 'ok'::text
        END AS status,
    ( SELECT string_agg(((rp.resep_nama || ' ('::text) || floor(COALESCE(sb.saldo, 0::numeric) / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))::integer) || ' porsi)'::text, ' atau '::text) AS string_agg
           FROM resep_projection rp
          WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)) AS projection_text,
    false AS is_flagged,
    sb.updated_at AS last_updated,
    last_opname_date(sb.*) AS last_opname_date,
    saldo_is_gram(sb.*) AS saldo_is_gram
   FROM stok_balance sb
     JOIN outlets o ON sb.outlet_id = o.id
     JOIN bahan_baku b ON sb.bahan_baku_id = b.id
     LEFT JOIN outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
  WHERE b.is_active = true AND sb.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  ORDER BY o.name, b.nama;

CREATE OR REPLACE VIEW public.monitoring_view_crew AS
WITH resep_projection AS (
         SELECT ri.bahan_baku_id,
            res.outlet_id AS resep_outlet_id,
            res.scope AS resep_scope,
            res.nama AS resep_nama,
            ri.qty_per_porsi,
            ri.satuan AS ri_satuan
           FROM resep_item ri
             JOIN resep res ON res.id = ri.resep_id
          WHERE res.is_active = true AND ri.qty_per_porsi > 0::numeric
        )
 SELECT sb.outlet_id,
    o.name AS outlet_name,
    sb.bahan_baku_id,
    b.nama AS item_name,
    b.satuan,
    b.kategori,
    sb.saldo AS current_qty,
    COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) AS threshold,
        CASE
            WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) / 2.0) THEN 'below'::text
            WHEN (EXISTS ( SELECT 1
               FROM resep_projection rp
              WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id) AND (sb.saldo IS NULL OR (sb.saldo / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric)) < COALESCE(o.marquee_warning_threshold, 7)::numeric))) THEN 'below'::text
            WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) THEN 'warning'::text
            ELSE 'ok'::text
        END AS status,
    ( SELECT string_agg(((rp.resep_nama || ' ('::text) || floor(COALESCE(sb.saldo, 0::numeric) / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))::integer) || ' porsi)'::text, ' atau '::text) AS string_agg
           FROM resep_projection rp
          WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)) AS projection_text,
    false AS is_flagged,
    sb.updated_at AS last_updated,
    last_opname_date(sb.*) AS last_opname_date,
    saldo_is_gram(sb.*) AS saldo_is_gram
   FROM stok_balance sb
     JOIN outlets o ON sb.outlet_id = o.id
     JOIN bahan_baku b ON sb.bahan_baku_id = b.id
     LEFT JOIN outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
  WHERE b.is_active = true AND sb.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids)
  ORDER BY b.nama;

CREATE OR REPLACE VIEW public.menu_sales_spv AS
SELECT o.outlet_id,
    o.sales_source,
    (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    lower(TRIM(BOTH FROM regexp_replace(oi.menu_item_name, '\s+'::text, ' '::text, 'g'::text))) AS menu_key,
    max(oi.menu_item_name) AS menu_name,
    sum(oi.quantity) AS qty,
    sum(oi.subtotal) AS revenue
   FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'completed'::text AND o.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids) AND NOT (o.outlet_id IN ( SELECT ou.id
           FROM outlets ou
          WHERE COALESCE(ou.type, ''::text) = 'test'::text))
  GROUP BY o.outlet_id, o.sales_source, ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date), (lower(TRIM(BOTH FROM regexp_replace(oi.menu_item_name, '\s+'::text, ' '::text, 'g'::text))));

CREATE OR REPLACE VIEW public.hpp_nilai_stok_harian_spv AS
SELECT op.outlet_id,
    op.tanggal,
    sum(oi.qty_fisik * lp.harga) AS nilai_stok
   FROM opname op
     JOIN opname_item oi ON oi.opname_id = op.id
     JOIN LATERAL ( SELECT sji.harga_snapshot AS harga
           FROM surat_jalan_item sji
             JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
          WHERE sj.outlet_id = op.outlet_id AND sji.bahan_baku_id = oi.bahan_baku_id AND (sj.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date <= op.tanggal AND sji.harga_snapshot > 0::numeric
          ORDER BY sj.created_at DESC
         LIMIT 1) lp ON true
  WHERE op.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids) AND op.status = 'finalized'::text AND op.tipe = 'harian'::text AND oi.qty_fisik IS NOT NULL
  GROUP BY op.outlet_id, op.tanggal;

