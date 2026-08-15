-- 20300108000003_fix_bom_allowlist_jsonb_quotes.sql
--
-- ROOT CAUSE (ditemukan & diverifikasi ke DB live 15 Aug 2026):
--   Guard allowlist di trg_process_bom_stok membaca:
--     SELECT value INTO v_allowed_outlets FROM global_settings WHERE key='bom_automation_allowed_outlets';
--   dengan v_allowed_outlets bertipe TEXT.
--
--   TAPI kolom global_settings.value bertipe JSONB (jsonb_typeof = 'string').
--   Cast implisit jsonb -> text MEMPERTAHANKAN tanda kutip pembungkus JSON:
--     "3f38c41d-...,550e8400-...,...,ffffffff-..."
--      ^                                        ^
--   Sehingga string_to_array(..., ',') menghasilkan:
--     elemen PERTAMA  = "3f38c41d-11e3-49ce-a189-d7303e45f9ad   <- ada kutip di depan
--     elemen TERAKHIR = ffffffff-ffff-ffff-ffff-ffffffffffff"   <- ada kutip di belakang
--   Keduanya TIDAK PERNAH sama dengan NEW.outlet_id::text.
--
--   DAMPAK NYATA: outlet pertama di daftar = MITRA CIBUBUR diam-diam keluar dari
--   BOM automation -> setiap penjualan di sana TIDAK memotong stok sama sekali.
--   Outlet terakhir = KANTOR PUSAT (dummy, tanpa order) jadi tak terasa.
--   Outlet di TENGAH daftar tidak terpengaruh -- itu sebabnya bug ini tak terlihat.
--
-- BUKTI:
--   - jsonb_typeof(value) = 'string'; (string_to_array(value::text,','))[1] = '"3f38c41d-...'
--   - Uji end-to-end (order completed di dalam transaksi lalu ROLLBACK):
--       outlet MITRA CIBUBUR (entri pertama) -> 0 baris ledger_stok
--       outlet DEPOK SUKMAJAYA (entri tengah) -> 27 baris ledger_stok
--   - Riwayat: MITRA CIBUBUR memotong ~800-1200 baris/hari s/d 14 Aug 2026, lalu berhenti.
--
-- FIX:
--   Buang tanda kutip pembungkus dengan btrim(value::text, '"') -- sengaja TIDAK memakai
--   operator jsonb (#>>) supaya tetap benar seandainya kolom ini suatu saat kembali TEXT
--   (btrim jadi no-op kalau memang tak ada kutip). Tiap elemen juga di-btrim dari spasi
--   agar daftar yang ditulis dengan ", " tetap cocok.
--
-- HANYA guard allowlist yang diubah. Seluruh sisa body identik dengan 20300108000002
-- (waterfall scale-aware + cabang paket + reversal net-per-bahan) -- diverifikasi via diff.
--
-- TIMESTAMP: sengaja 20300108000003 (bukan tanggal hari ini) karena migration ini
-- MENDEFINISIKAN ULANG fungsi yang juga didefinisikan oleh 20300108000002. Migration
-- bertimestamp 2030 selalu jalan paling akhir, jadi fix bertanggal wajar akan ditimpa
-- balik saat replay. Pola sama dengan 20300103000006. Utang teknis "lantai 2030" ini
-- sudah tercatat di CLAUDE.md -- jangan tambah yang baru di luar kasus seperti ini.

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec     RECORD;
  r_item  RECORD;
  l_item  RECORD;
  p_item  RECORD;
  v_resep_id        UUID;
  v_allowed_outlets TEXT;
  v_is_package      BOOLEAN;
  v_selected_item_id UUID;
  v_item_label      TEXT;
  v_child_label     TEXT;
BEGIN
  -- Guard Pawoon
  IF NEW.external_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Guard allowlist
  -- FIX: kolom value bertipe JSONB -> cast ke text menyisakan kutip pembungkus,
  -- yang membuat entri PERTAMA & TERAKHIR daftar tak pernah cocok. Lihat header.
  SELECT btrim(value::text, '"') INTO v_allowed_outlets FROM public.global_settings
    WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NULL
     OR NOT (NEW.outlet_id::text = ANY (
               ARRAY(SELECT btrim(x) FROM unnest(string_to_array(v_allowed_outlets, ',')) AS x)
             )) THEN
    RETURN NEW;
  END IF;

  -- ================================================================
  -- ORDER COMPLETED -> potong stok BOM
  -- ================================================================
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    FOR rec IN
      SELECT menu_item_id, quantity, package_choices, menu_item_name
      FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF rec.menu_item_id IS NULL THEN CONTINUE; END IF;

      v_item_label := COALESCE(NULLIF(split_part(rec.menu_item_name, '|', 1), ''), 'Item');
      SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;

      IF v_is_package THEN
        -- ---- PAKET / COMBO ----
        FOR p_item IN
          SELECT id, menu_item_id, or_menu_item_id, quantity
          FROM public.menu_packages WHERE package_id = rec.menu_item_id
        LOOP
          v_selected_item_id := p_item.menu_item_id;

          IF rec.package_choices IS NOT NULL
             AND (rec.package_choices->>p_item.id::text) IS NOT NULL THEN
            v_selected_item_id := (rec.package_choices->>p_item.id::text)::uuid;
          END IF;

          SELECT name INTO v_child_label FROM public.menu_items WHERE id = v_selected_item_id;
          v_child_label := COALESCE(NULLIF(v_child_label, ''), 'Komponen');

          v_resep_id := NULL;
          SELECT id INTO v_resep_id
          FROM public.resep
          WHERE menu_item_ref = v_selected_item_id::text
            AND is_active = true
            AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
          ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
          LIMIT 1;

          IF v_resep_id IS NOT NULL THEN
            FOR r_item IN
              SELECT ri.bahan_baku_id,
                     ri.qty_per_porsi,
                     b.faktor_konversi
              FROM public.resep_item ri
              JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              WHERE ri.resep_id = v_resep_id
            LOOP
              -- FIX: ganti INSERT langsung dengan waterfall (scale-aware)
              -- Input satuan besar = qty_per_porsi (gram) * qty_order * qty_komponen / faktor (gram/satuan)
              PERFORM public.process_waterfall_deduction(
                NEW.outlet_id,
                r_item.bahan_baku_id,
                r_item.qty_per_porsi * rec.quantity * p_item.quantity / r_item.faktor_konversi,
                'Penjualan Paket #' || COALESCE(NEW.order_number::text, 'N/A')
                  || ' (' || v_item_label || ' > ' || v_child_label || ')',
                NEW.id
              );
            END LOOP;
          END IF;
        END LOOP;

      ELSE
        -- ---- NORMAL ITEM ----
        v_resep_id := NULL;
        SELECT id INTO v_resep_id
        FROM public.resep
        WHERE menu_item_ref = rec.menu_item_id::text
          AND is_active = true
          AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
        ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
        LIMIT 1;

        IF v_resep_id IS NOT NULL THEN
          FOR r_item IN
            SELECT ri.bahan_baku_id,
                   ri.qty_per_porsi,
                   b.faktor_konversi
            FROM public.resep_item ri
            JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
            WHERE ri.resep_id = v_resep_id
          LOOP
            -- FIX: ganti INSERT langsung dengan waterfall (scale-aware)
            -- Input satuan besar = qty_per_porsi (gram) / faktor_konversi (gram per satuan besar)
            -- -> to_ledger_scale() akan konversi ke gram jika outlet saldo_is_gram=true
            PERFORM public.process_waterfall_deduction(
              NEW.outlet_id,
              r_item.bahan_baku_id,
              r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi,
              'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A')
                || ' (' || v_item_label || ')',
              NEW.id
            );
          END LOOP;
        END IF;
      END IF;
    END LOOP;

  -- ================================================================
  -- ORDER DIBATALKAN -> kembalikan stok (reverse net per bahan, idempoten)
  -- ================================================================
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

    FOR l_item IN
      SELECT bahan_baku_id, SUM(qty) AS net_qty
      FROM public.ledger_stok
      WHERE ref_order_id = NEW.id AND tipe IN ('pemakaian', 'adjustment')
      GROUP BY bahan_baku_id
      HAVING SUM(qty) < 0
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
      ) VALUES (
        NEW.outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        -l_item.net_qty,
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$function$;
