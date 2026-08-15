-- 20300108000005_fix_bom_middle_tier_factor_universal.sql
--
-- ROOT CAUSE (ditemukan 15 Aug 2026 saat rekonsiliasi manual 14 bahan mismatch):
--   Sistem satuan_baku punya TIGA tingkat: satuan_besar (mis. Dus) -> satuan_tengah
--   (mis. Pack, faktor_tengah = pack per dus) -> satuan_kecil/resep (mis. Lembar,
--   faktor_konversi = lembar per pack). faktor_tampilan adalah FAKTOR PENUH
--   (kecil per besar) untuk tampilan majemuk: faktor_tampilan = faktor_tengah x
--   faktor_konversi -- pola ini PERSIS untuk 13 dari 14 bahan yang diperiksa.
--
--   trg_process_bom_stok TIDAK PERNAH diperbarui mengikuti sistem 3-tingkat ini --
--   ia selalu membagi qty_per_porsi dengan faktor_konversi SAJA (tingkat kecil-ke-
--   tengah), bukan faktor PENUH (besar-ke-kecil). Untuk bahan yang tak berubah sejak
--   sebelum sistem 3-tingkat ada (faktor_tengah masih 1 implisit), ini kebetulan benar.
--   Untuk 13 bahan yang faktor_tengah-nya sudah diisi (Pack/Kg/dll), trigger selama ini
--   MEMBAGI DENGAN FAKTOR YANG TERLALU KECIL -> kurang-potong sebesar faktor_tengah kali,
--   di SEMUA outlet (bukan cuma gram-scale -- migration 20300108000004 baru menutup
--   separuh masalah, kebetulan benar untuk gram-scale karena to_ledger_scale juga
--   memakai faktor_tampilan).
--
-- BUKTI (dikonfirmasi owner 15 Aug 2026):
--   - Untuk SAPI/KEJU/MINYAK, migration ASLI yang eksplisit "dikonfirmasi owner"
--     (20260704160000 tgl 4 Juli; 20300104000003 tgl 2 Agustus utk MINYAK SAYUR)
--     menetapkan nilai PENUH (2000 gram/blok; 240 lembar/dus; 16000 ml/kompan) --
--     angka itu PERSIS SAMA dengan faktor_tampilan sekarang, BUKAN faktor_konversi
--     yang sekarang live (yang cuma porsi tingkat-tengah-ke-kecil).
--   - 13/14 bahan (semua kecuali STIKER) memenuhi faktor_tampilan = faktor_tengah x
--     faktor_konversi secara EKSAK -- bukan kebetulan, itu chain 3-tingkat yang sama.
--   - STIKER TIDAK punya faktor_tengah (satuan_tengah NULL) dan riwayat migration-nya
--     tak pernah menuntaskan angka "1 Roll = 100 lembar" yang disebut-sebut --
--     DIKECUALIKAN dari fix ini, tetap pakai faktor_konversi seperti sebelumnya.
--
-- FIX:
--   Divisor = faktor_tampilan KETIKA faktor_tengah terisi (berarti chain 3-tingkat
--   berlaku dan faktor_tampilan = faktor penuh yang benar); SELAIN itu tetap
--   faktor_konversi (bahan 1:1 tanpa tingkat tengah, termasuk STIKER -- TIDAK BERUBAH).
--   Berlaku UNIVERSAL untuk semua outlet (bukan kondisional saldo_is_gram lagi) --
--   lebih sederhana dari 20300108000004 sekaligus memperbaiki outlet besar-scale.
--   to_ledger_scale() tetap menangani sisi gram (kalikan lagi faktor_tampilan utk
--   outlet saldo_is_gram, apa adanya utk outlet besar-scale) -- TIDAK disentuh di sini.
--
--   CATATAN: 10 dari 13 bahan (semua kecuali SAPI/KEJU/MINYAK) BELUM punya konfirmasi
--   eksplisit owner tertulis di migration -- keputusan menerapkan fix ini ke semuanya
--   diambil owner 15 Aug 2026 berdasar kekuatan pola matematis (13/14 taat chain
--   faktor_tengah x faktor_konversi = faktor_tampilan). Rekonsiliasi fisik lanjutan
--   (opname ulang) tetap perlu untuk mengoreksi saldo yang sudah terlanjur salah.
--
-- Timestamp 2030 dipertahankan: fungsi ini juga didefinisikan 20300108000002/3/4.

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
              -- FIX: divisor = faktor PENUH (faktor_tampilan) kalau bahan punya
              -- faktor_tengah (chain 3-tingkat berlaku); selain itu faktor_konversi.
              SELECT CASE WHEN b2.faktor_tengah IS NOT NULL AND b2.faktor_tampilan IS NOT NULL
                          THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
                INTO v_divisor
              FROM public.bahan_baku b2
              WHERE b2.id = r_item.bahan_baku_id;
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
            -- FIX: divisor = faktor PENUH (faktor_tampilan) kalau bahan punya
            -- faktor_tengah (chain 3-tingkat berlaku); selain itu faktor_konversi.
            SELECT CASE WHEN b2.faktor_tengah IS NOT NULL AND b2.faktor_tampilan IS NOT NULL
                        THEN b2.faktor_tampilan ELSE b2.faktor_konversi END
              INTO v_divisor
            FROM public.bahan_baku b2
            WHERE b2.id = r_item.bahan_baku_id;
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
