-- SS COGS SET/pemantau-hpp-dinamis-2026-09.sql
-- Jalankan sebagai owner/admin/kitchen (RPC ber-gate). Satu blok per giliran.

-- Q1: selisih teoritis-dinamis vs override per menu, semua outlet, bulan berjalan
SELECT o.name AS outlet, m.menu_nama, m.qty_terjual,
       m.hpp_override_unit, round(m.hpp_teoritis_unit) AS hpp_dinamis_unit,
       round(100.0*(m.hpp_teoritis_unit - m.hpp_override_unit)/NULLIF(m.hpp_override_unit,0),1) AS selisih_pct
FROM outlets o
CROSS JOIN LATERAL get_hpp_dinamis_menu(o.id, date_trunc('month', current_date)::date, current_date) m
WHERE o.id IN (SELECT outlet_ids_terhitung()) AND m.punya_resep
ORDER BY abs(m.hpp_teoritis_unit - m.hpp_override_unit) * m.qty_terjual DESC
LIMIT 50;

-- Q2: porsi sumber harga per outlet (target: kiriman naik dari minggu ke minggu)
SELECT o.name AS outlet,
       round(100*SUM(b.nilai_kiriman)/NULLIF(SUM(b.nilai),0)) AS pct_kiriman,
       round(100*SUM(b.nilai_drop_ship)/NULLIF(SUM(b.nilai),0)) AS pct_drop_ship,
       round(100*(SUM(b.nilai_master_historis)+SUM(b.nilai_master_sekarang))/NULLIF(SUM(b.nilai),0)) AS pct_master,
       round(100*SUM(b.nilai_tidak_ada)/NULLIF(SUM(b.nilai),0)) AS pct_tidak_ada
FROM outlets o
CROSS JOIN LATERAL get_hpp_dinamis_bahan(o.id, current_date - 6, current_date) b
WHERE o.id IN (SELECT outlet_ids_terhitung())
GROUP BY o.name ORDER BY pct_kiriman NULLS FIRST;

-- Q3: aktual vs teoritis per outlet (selisih besar = substitusi/BOM/skala perlu dilihat)
SELECT o.name AS outlet,
       (SELECT SUM(nilai) FROM get_hpp_dinamis_bahan(o.id, date_trunc('month', current_date)::date, current_date)) AS aktual,
       (SELECT SUM(hpp_teoritis_total) FROM get_hpp_dinamis_menu(o.id, date_trunc('month', current_date)::date, current_date)) AS teoritis
FROM outlets o WHERE o.id IN (SELECT outlet_ids_terhitung())
ORDER BY 1;

-- Q4: bahan resep tanpa harga sama sekali (harus 0 baris)
SELECT DISTINCT b.nama FROM resep_item ri JOIN bahan_baku b ON b.id=ri.bahan_baku_id
LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id=b.id
WHERE b.is_active AND COALESCE(bh.harga_beli,0) = 0;

-- Q5: katalog vendor yang mulai terisi dari PO (harus naik dari 0)
SELECT count(*) FILTER (WHERE sumber='po' AND ref_po_id IS NOT NULL) AS dari_po,
       count(*) FILTER (WHERE perlu_ditinjau) AS perlu_ditinjau, count(*) AS total
FROM bahan_baku_supplier WHERE is_active;
