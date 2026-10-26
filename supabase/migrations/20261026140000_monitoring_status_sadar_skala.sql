-- Status monitoring (below/warning/ok) sadar skala satuan.
--
-- Masalah: stok_balance.saldo bisa berskala satuan KECIL (gram/lembar/ml) bila
-- saldo_is_gram(sb) = true, atau satuan BESAR bila false. Threshold
-- (outlet_reorder_point / default_reorder_point) selalu satuan BESAR, dan
-- calc_porsi_qty() juga mengembalikan satuan BESAR. Kolom `status` dan
-- `projection_text` dulu memakai sb.saldo mentah, jadi baris berskala kecil
-- tampak `ok` padahal kritis. Contoh: KEJU 62 lembar (0,26 Dus) vs ambang
-- 1 Dus -> dulu `ok`, seharusnya `below`.
-- Diukur 2026-10-26 (outlet internal/mitra aktif): 204 baris salah `ok`
-- (130 seharusnya below, 74 seharusnya warning), nol baris bergeser arah lain.
--
-- Perbaikan: hitung saldo dalam satuan besar sekali per baris (LATERAL), lalu
-- dipakai di seluruh cabang status dan projection_text.
--   * current_qty tetap saldo mentah (app memformat dengan saldo_is_gram).
--   * Kolom baru `current_qty_besar` ditambahkan di AKHIR (syarat
--     CREATE OR REPLACE VIEW) supaya app tidak perlu mengulang konversi.
--   * Selebihnya identik dengan definisi live (20260922190000): definer,
--     scope accessible_outlet_ids(), urutan baris, grant/owner dipertahankan.
--
-- ⚠️ Utang replay: 20300105000003 juga mendefinisikan kedua view dan terurut
-- SESUDAH berkas ini; replay dari nol akan memulihkan versi lama. Produksi aman
-- (berkas 2030 sudah terstempel). Preseden sama dengan 2026-09-09.

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
            WHEN sk.saldo_besar < (COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) / 2.0) THEN 'below'::text
            WHEN (EXISTS ( SELECT 1
               FROM resep_projection rp
              WHERE rp.bahan_baku_id = sb.bahan_baku_id
                AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)
                AND (sk.saldo_besar IS NULL
                     OR (sk.saldo_besar / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))
                        < COALESCE(o.marquee_warning_threshold, 7)::numeric))) THEN 'below'::text
            WHEN sk.saldo_besar < COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) THEN 'warning'::text
            ELSE 'ok'::text
        END AS status,
    ( SELECT string_agg(((rp.resep_nama || ' ('::text)
               || floor(COALESCE(sk.saldo_besar, 0::numeric) / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))::integer)
               || ' porsi)'::text, ' atau '::text) AS string_agg
           FROM resep_projection rp
          WHERE rp.bahan_baku_id = sb.bahan_baku_id
            AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)) AS projection_text,
    false AS is_flagged,
    sb.updated_at AS last_updated,
    last_opname_date(sb.*) AS last_opname_date,
    sk.is_gram AS saldo_is_gram,
    sk.saldo_besar AS current_qty_besar
   FROM stok_balance sb
     JOIN outlets o ON sb.outlet_id = o.id
     JOIN bahan_baku b ON sb.bahan_baku_id = b.id
     LEFT JOIN outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
     CROSS JOIN LATERAL ( SELECT g.is_gram,
                CASE WHEN g.is_gram AND b.faktor_tampilan > 0::numeric
                     THEN sb.saldo / b.faktor_tampilan
                     ELSE sb.saldo
                END AS saldo_besar
           FROM ( SELECT saldo_is_gram(sb.*) AS is_gram) g) sk
  WHERE b.is_active = true AND (sb.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids))
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
            WHEN sk.saldo_besar < (COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) / 2.0) THEN 'below'::text
            WHEN (EXISTS ( SELECT 1
               FROM resep_projection rp
              WHERE rp.bahan_baku_id = sb.bahan_baku_id
                AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)
                AND (sk.saldo_besar IS NULL
                     OR (sk.saldo_besar / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))
                        < COALESCE(o.marquee_warning_threshold, 7)::numeric))) THEN 'below'::text
            WHEN sk.saldo_besar < COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) THEN 'warning'::text
            ELSE 'ok'::text
        END AS status,
    ( SELECT string_agg(((rp.resep_nama || ' ('::text)
               || floor(COALESCE(sk.saldo_besar, 0::numeric) / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))::integer)
               || ' porsi)'::text, ' atau '::text) AS string_agg
           FROM resep_projection rp
          WHERE rp.bahan_baku_id = sb.bahan_baku_id
            AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)) AS projection_text,
    false AS is_flagged,
    sb.updated_at AS last_updated,
    last_opname_date(sb.*) AS last_opname_date,
    sk.is_gram AS saldo_is_gram,
    sk.saldo_besar AS current_qty_besar
   FROM stok_balance sb
     JOIN outlets o ON sb.outlet_id = o.id
     JOIN bahan_baku b ON sb.bahan_baku_id = b.id
     LEFT JOIN outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
     CROSS JOIN LATERAL ( SELECT g.is_gram,
                CASE WHEN g.is_gram AND b.faktor_tampilan > 0::numeric
                     THEN sb.saldo / b.faktor_tampilan
                     ELSE sb.saldo
                END AS saldo_besar
           FROM ( SELECT saldo_is_gram(sb.*) AS is_gram) g) sk
  WHERE b.is_active = true AND (sb.outlet_id IN ( SELECT accessible_outlet_ids() AS accessible_outlet_ids))
  ORDER BY b.nama;
