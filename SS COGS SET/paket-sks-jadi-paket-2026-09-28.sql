-- ARSIP — SUDAH DIJALANKAN 2026-09-28 (COMMIT). JANGAN DIJALANKAN ULANG.
-- Hasil: COGS owner Sep 995.401.595 -> 996.105.199 (+20 porsi x 35.180,2). Pembalikan: is_package = false.
-- PAKET SKS (Sistem Kenyang Sekali) ditandai sebagai paket agar HPP = jumlah komponen
-- (Suka Fried Chicken + Suka Samyang) dan stok dipotong per komponen, sama seperti SUKA DUO FAVORITE.
BEGIN;
CREATE TEMP TABLE _c (tahap text, cogs numeric, sks_hpp numeric);
INSERT INTO _c SELECT 'sebelum',
  (get_owner_dashboard_summary(timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07') ->> 'total_cogs')::numeric, NULL;
UPDATE menu_items SET is_package = true, updated_by = 'Claude (PAKET SKS ditandai paket, permintaan owner 28 Sep 2026)'
WHERE id = '169a0768-c286-444e-9a5f-b8816e27e24f' AND is_package = false;
DO $$ BEGIN
  IF (SELECT is_package FROM menu_items WHERE id = '169a0768-c286-444e-9a5f-b8816e27e24f') IS NOT TRUE THEN
    RAISE EXCEPTION 'GAGAL: is_package tidak berubah';
  END IF;
END $$;
INSERT INTO _c SELECT 'sesudah',
  (get_owner_dashboard_summary(timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07') ->> 'total_cogs')::numeric,
  (SELECT sum(h.hpp_override * mp.quantity) FROM menu_packages mp CROSS JOIN LATERAL menu_hpp_pada(mp.menu_item_id, DATE '2026-09-27') h
    WHERE mp.package_id = '169a0768-c286-444e-9a5f-b8816e27e24f');
SELECT tahap || ' | cogs Sep ' || round(cogs) || ' | hpp SKS ' || COALESCE(sks_hpp::text, '-') AS baris FROM _c ORDER BY tahap DESC;
ROLLBACK;
