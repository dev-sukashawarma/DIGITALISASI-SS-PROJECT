-- 20300103000007_restore_package_bom_after_pawoon_guard.sql
--
-- Memulihkan (LAGI) logika BOM menu paket/combo + reversal net-per-bahan, sambil
-- MEMPERTAHANKAN guard Pawoon.
--
-- LATAR:
--   20260725000000_skip_bom_for_pawoon_import.sql menambahkan guard `external_order_id`
--   dengan CREATE OR REPLACE di atas basis fungsi versi PRA-PAKET. Karena bertimestamp
--   2026 ia memang jalan sebelum file-file 2030 saat build dari nol, TAPI di DB live ia
--   dijalankan paling akhir -> membuang:
--     - logika paket (is_package / menu_packages / package_choices)  [20300103000001 + 000003]
--     - reversal net-per-bahan (anti over-restore)                    [20260708110000 / 20300103000006]
--
-- Diverifikasi di DB live sebelum migration ini ditulis:
--   pg_get_functiondef: '%is_package%' = false, '%package_choices%' = false,
--                       '%HAVING SUM%'  = false, ilike '%pawoon%' = true
--   menu_items.is_package = 27 baris, menu_packages = 66 baris (47 anak punya resep aktif)
--   resep untuk menu is_package = 0 baris  -> combo TIDAK memotong stok sama sekali
--   ledger 'Penjualan Paket %' = 762 baris, terakhir 2026-07-24 08:02 UTC (berhenti sejak regresi)
--
-- Basis di bawah = 20300103000006 (versi paket + reversal net yang benar) DITAMBAH guard
-- Pawoon dari 20260725000000. Tidak ada perubahan skema.

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  p_item RECORD;
  v_resep_id UUID;
  v_allowed_outlets TEXT;
  v_is_package BOOLEAN;
  v_selected_item_id UUID;
  v_item_label TEXT;
BEGIN
  -- GUARD Pawoon (pemulihan 20260725000000): order hasil import Pawoon adalah data historis
  -- dan TIDAK boleh memotong stok bahan baku.
  IF NEW.external_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Guard allowlist: kalau key tidak ada / outlet_id tidak terdaftar -> skip semua logika BOM
  -- (order tetap completed/cancelled normal, cuma tidak ada potongan/pengembalian stok BOM).
  SELECT value INTO v_allowed_outlets FROM public.global_settings
    WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NULL
     OR NOT (NEW.outlet_id::text = ANY (string_to_array(v_allowed_outlets, ','))) THEN
    RETURN NEW;
  END IF;

  -- Handle when an order is completed (either updated to completed, or inserted as completed)
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    -- Loop through each item in the order.
    -- menu_item_name dibawa untuk catatan ledger (20260715000000).
    FOR rec IN SELECT menu_item_id, quantity, package_choices, menu_item_name
               FROM public.order_items WHERE order_id = NEW.id LOOP
      IF rec.menu_item_id IS NOT NULL THEN

        -- /api/checkout menyisipkan metadata ke menu_item_name lewat pemisah '|'
        -- (|ID|, |PARENT|, |NOTE|). Ambil nama menunya saja agar catatan ledger tetap terbaca.
        v_item_label := COALESCE(NULLIF(split_part(rec.menu_item_name, '|', 1), ''), 'Item');

        -- Check if it's a package
        SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;

        IF v_is_package THEN
          -- Loop through package items
          FOR p_item IN SELECT id, menu_item_id, or_menu_item_id, quantity FROM public.menu_packages WHERE package_id = rec.menu_item_id LOOP
            -- Determine which item was chosen (default to primary)
            v_selected_item_id := p_item.menu_item_id;

            -- If the cashier selected an alternative option for this package item
            IF rec.package_choices IS NOT NULL AND (rec.package_choices->>p_item.id::text) IS NOT NULL THEN
              v_selected_item_id := (rec.package_choices->>p_item.id::text)::uuid;
            END IF;

            -- Find the active recipe for this selected child item
            v_resep_id := NULL;
            SELECT id INTO v_resep_id
            FROM public.resep
            WHERE menu_item_ref = v_selected_item_id::text
              AND is_active = true
              AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
            ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
            LIMIT 1;

            -- If recipe found, deduct its materials (qty = item_qty * package_multiplier * req_qty / konversi)
            IF v_resep_id IS NOT NULL THEN
              FOR r_item IN
                SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
                FROM public.resep_item ri
                JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
                WHERE ri.resep_id = v_resep_id
              LOOP
                INSERT INTO public.ledger_stok (
                  outlet_id,
                  bahan_baku_id,
                  tipe,
                  qty,
                  catatan,
                  ref_order_id,
                  created_at
                ) VALUES (
                  NEW.outlet_id,
                  r_item.bahan_baku_id,
                  'pemakaian',
                  -(r_item.qty_per_porsi * rec.quantity * p_item.quantity / r_item.faktor_konversi),
                  'Penjualan Paket #' || COALESCE(NEW.order_number::text, 'N/A') || ' (' || v_item_label || ')',
                  NEW.id,
                  NOW()
                );
              END LOOP;
            END IF;
          END LOOP;
        ELSE
          -- Normal item (Original logic)
          v_resep_id := NULL;
          SELECT id INTO v_resep_id
          FROM public.resep
          WHERE menu_item_ref = rec.menu_item_id::text
            AND is_active = true
            AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
          ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
          LIMIT 1;

          -- If recipe found, deduct its materials (dikonversi ke satuan_baku via faktor_konversi)
          IF v_resep_id IS NOT NULL THEN
            FOR r_item IN
              SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
              FROM public.resep_item ri
              JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              WHERE ri.resep_id = v_resep_id
            LOOP
              INSERT INTO public.ledger_stok (
                outlet_id,
                bahan_baku_id,
                tipe,
                qty,
                catatan,
                ref_order_id,
                created_at
              ) VALUES (
                NEW.outlet_id,
                r_item.bahan_baku_id,
                'pemakaian',
                -(r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi),
                'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A') || ' (' || v_item_label || ')',
                NEW.id,
                NOW()
              );
            END LOOP;
          END IF;
        END IF;
      END IF;
    END LOOP;

  -- Order dibatalkan (restore stok) -- reverse hanya SISA potongan bersih per bahan.
  -- Pemulihan 20260708110000: JANGAN reverse tiap baris 'pemakaian' satu per satu.
  -- Order yang sempat completed >1x punya beberapa baris pemakaian; membalik semuanya
  -- mengembalikan stok lebih banyak daripada yang benar-benar keluar.
  -- 'adjustment' ikut dijumlahkan supaya pengembalian sebelumnya terhitung: kalau sudah
  -- ter-reverse penuh (net = 0), HAVING menyaringnya -> no-op (idempoten).
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

    FOR l_item IN
      SELECT bahan_baku_id, SUM(qty) AS net_qty
      FROM public.ledger_stok
      WHERE ref_order_id = NEW.id AND tipe IN ('pemakaian', 'adjustment')
      GROUP BY bahan_baku_id
      HAVING SUM(qty) < 0            -- masih ada potongan outstanding yang belum dikembalikan
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id,
        bahan_baku_id,
        tipe,
        qty,
        catatan,
        ref_order_id,
        created_at
      ) VALUES (
        NEW.outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        -l_item.net_qty,             -- net_qty < 0 -> nilai kembalian positif = sisa outstanding
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger attachment tak berubah (fungsi yang di-REPLACE otomatis dipakai ulang).
--
-- CATATAN untuk yang menyentuh fungsi ini berikutnya:
-- ADA MIGRATION BERTIMESTAMP TAHUN 2030 (20300101..20300103) YANG SELALU JALAN PALING AKHIR.
-- Migration baru bertanggal 2026/2027 untuk fungsi ini AKAN tertimpa saat build dari nol,
-- DAN sebaliknya bisa menimpa versi 2030 di DB live (persis yang terjadi pada 20260725000000).
-- Selalu jalankan dulu: grep -rn "trg_process_bom_stok" supabase/migrations/
