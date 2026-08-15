-- 20300108000004_fix_bom_scale_factor_mismatch.sql
--
-- ROOT CAUSE (ditemukan 15 Aug 2026 saat verifikasi end-to-end fix Best Seller):
--   Sejak 20300108000002, BOM memotong lewat process_waterfall_deduction ->
--   to_ledger_scale(), yang untuk outlet gram-scale MENGALIKAN dengan
--   bahan_baku.faktor_tampilan. Tapi trigger MEMBAGI dengan faktor_konversi.
--   Untuk 14+ bahan kedua kolom itu BEDA, jadi hasilnya salah sebesar rasionya:
--
--     KEJU             fk=10    ft=240     -> 24x lipat
--     ES BATU          1000  vs 20000      -> 20x
--     MINYAK           1000  vs 16000      -> 16x
--     MAYONES / SAOS TOMAT                 -> 12x
--     KENTANG          1000  vs 10000      -> 10x
--     SAPI             1000  vs 2000       -> 2x
--
--   BUKTI: order uji (di dalam transaksi lalu ROLLBACK) di outlet gram-scale ->
--   resep minta SAPI 120g, ledger mencatat -240; resep minta 170g -> -340.
--   AYAM (fk=ft=1000) tercatat -110 alias benar. Terdampak s/d 21 outlet gram-scale.
--
-- KENAPA TIDAK MENYAMAKAN SAJA KEDUA KOLOM ITU:
--   Riwayat migration membuktikan TIDAK ADA satu kolom yang benar untuk semua bahan:
--     20260706110000 -> SAPI faktor_konversi seharusnya 2000 gram/blok (dipakai BOM);
--                       nilai live sekarang 1000  => faktor_konversi yang salah.
--     20300105000002 -> MAYONES faktor_tampilan 144000 dinyatakan SALAH (12x).
--     20260716000009 -> menyebut faktor_konversi legacy, prioritaskan faktor_tampilan.
--   Menyamakan ke salah satu arah PASTI merusak sebagian bahan. Rekonsiliasi nilai
--   fisik per bahan = keputusan owner, TERPISAH dari migration ini.
--
-- FIX (tidak butuh tahu ukuran kemasan sebenarnya):
--   Bagi dengan faktor yang SAMA dengan yang nanti dikalikan to_ledger_scale():
--     outlet gram-scale  -> bagi faktor_tampilan; (g/ft)*ft = g  => potong PERSIS
--                           qty_per_porsi gram sesuai resep. Benar secara aljabar,
--                           berapa pun nilai ft.
--     outlet besar-scale -> tetap faktor_konversi => perilaku TIDAK BERUBAH.
--   Fallback ke faktor_konversi kalau baris stok_balance / faktor_tampilan tak ada
--   (meniru perilaku NOT FOUND milik to_ledger_scale sendiri).
--
--   CATATAN: ini membuat pemotongan BOM konsisten, TAPI tidak mengoreksi saldo yang
--   sudah terlanjur salah, dan tidak menyentuh 8 fungsi penulis ledger lain yang juga
--   memakai to_ledger_scale. Opname ulang tetap diperlukan.
--
-- Timestamp 2030 dipertahankan: fungsi ini juga didefinisikan 20300108000002/3.

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
  v_divisor         NUMERIC;
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
              -- FIX SKALA: pakai faktor yang SAMA dengan yang dipakai to_ledger_scale().
              SELECT CASE WHEN saldo_is_gram(sb) AND b2.faktor_tampilan IS NOT NULL
                          THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
                INTO v_divisor
              FROM public.stok_balance sb
              JOIN public.bahan_baku b2 ON b2.id = sb.bahan_baku_id
              WHERE sb.outlet_id = NEW.outlet_id AND sb.bahan_baku_id = r_item.bahan_baku_id;
              IF v_divisor IS NULL OR v_divisor = 0 THEN
                v_divisor := r_item.faktor_konversi;
              END IF;
              PERFORM public.process_waterfall_deduction(
                NEW.outlet_id,
                r_item.bahan_baku_id,
                r_item.qty_per_porsi * rec.quantity * p_item.quantity / v_divisor,
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
            -- FIX SKALA: pakai faktor yang SAMA dengan yang dipakai to_ledger_scale().
            SELECT CASE WHEN saldo_is_gram(sb) AND b2.faktor_tampilan IS NOT NULL
                        THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
              INTO v_divisor
            FROM public.stok_balance sb
            JOIN public.bahan_baku b2 ON b2.id = sb.bahan_baku_id
            WHERE sb.outlet_id = NEW.outlet_id AND sb.bahan_baku_id = r_item.bahan_baku_id;
            IF v_divisor IS NULL OR v_divisor = 0 THEN
              v_divisor := r_item.faktor_konversi;
            END IF;
            PERFORM public.process_waterfall_deduction(
              NEW.outlet_id,
              r_item.bahan_baku_id,
              r_item.qty_per_porsi * rec.quantity / v_divisor,
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
