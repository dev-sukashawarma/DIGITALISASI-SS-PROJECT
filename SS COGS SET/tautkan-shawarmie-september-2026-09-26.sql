-- ⚠️ SUDAH DIJALANKAN di produksi 26 Sep 2026 (commit). JANGAN dijalankan ulang — skrip ini arsip/jejak audit.
-- Menjalankan ulang: input HPP akan meng-upsert baris yang sama (aman), tapi skrip Shawarmie berhenti sendiri (menu sudah ada / baris ≠ 279).
-- Tautkan ulang baris penjualan Shawarmie Ayam/Sapi SEPTEMBER 2026 (menu_item_id NULL karena menu lama terhapus ~16 Sep)
-- ke menu Shawarmie yang dibuat ulang 26 Sep. Juli & Agustus tidak disentuh.
-- Pembalikan: UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id IN (<id Shawarmie Ayam>, <id Shawarmie Sapi>);
BEGIN;
CREATE TEMP TABLE _cek (tahap text, periode text, owner_cogs numeric, mitra_cogs numeric, baris int);
DO $$
DECLARE v_ayam uuid; v_sapi uuid; v_mitra uuid[]; v_n int;
BEGIN
  SELECT id INTO v_ayam FROM menu_items WHERE name='Shawarmie Ayam' AND NOT is_available;
  SELECT id INTO v_sapi FROM menu_items WHERE name='Shawarmie Sapi' AND NOT is_available;
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';
  IF v_ayam IS NULL OR v_sapi IS NULL THEN RAISE EXCEPTION 'menu Shawarmie tidak ditemukan'; END IF;

  INSERT INTO _cek SELECT 'sebelum', p.n, (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b)), NULL
  FROM (VALUES ('Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('1-18 Sep', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07')) p(n, a, b);

  UPDATE order_items oi SET menu_item_id = CASE lower(btrim(split_part(oi.menu_item_name,'|',1))) WHEN 'shawarmie ayam' THEN v_ayam ELSE v_sapi END
  FROM orders o
  WHERE o.id = oi.order_id AND oi.menu_item_id IS NULL
    AND lower(btrim(split_part(oi.menu_item_name,'|',1))) IN ('shawarmie ayam','shawarmie sapi')
    AND (o.created_at AT TIME ZONE 'Asia/Jakarta') >= '2026-09-01' AND (o.created_at AT TIME ZONE 'Asia/Jakarta') < '2026-10-01';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 279 THEN RAISE EXCEPTION 'Harap 279 baris, ter-update %', v_n; END IF;

  INSERT INTO _cek SELECT 'sesudah', p.n, (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b)), v_n
  FROM (VALUES ('Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('1-18 Sep', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07')) p(n, a, b);

  IF EXISTS (SELECT 1 FROM _cek s JOIN _cek b ON b.periode=s.periode AND b.tahap='sebelum'
             WHERE s.tahap='sesudah' AND (s.mitra_cogs IS DISTINCT FROM b.mitra_cogs
                   OR (s.periode='Agustus' AND s.owner_cogs IS DISTINCT FROM b.owner_cogs))) THEN
    RAISE EXCEPTION 'GAGAL: mitra atau Agustus ikut berubah';
  END IF;
END $$;
COMMIT;
SELECT tahap || ' | ' || periode || ' | owner ' || owner_cogs || ' | mitra ' || round(mitra_cogs) || COALESCE(' | baris ' || baris, '') AS baris FROM _cek ORDER BY periode, tahap DESC;
