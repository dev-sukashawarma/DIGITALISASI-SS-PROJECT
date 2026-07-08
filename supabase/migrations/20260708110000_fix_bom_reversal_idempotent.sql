-- 20260708110000_fix_bom_reversal_idempotent.sql
-- FIX (pemotongan bahan baku setelah order): reversal void BOM over-restore.
--
-- Bug: blok pembatalan (NEW.status='cancelled' AND OLD.status='completed') me-reverse
-- SETIAP baris 'pemakaian' negatif untuk ref_order_id (tiap baris -> satu adjustment
-- +ABS). Karena order bisa 'completed' lebih dari sekali (update-status route
-- mengizinkan completed->cancelled->completed tanpa guard), setiap penyelesaian
-- ulang menambah satu set potongan baru. Saat dibatalkan lagi, loop me-reverse SEMUA
-- potongan historis -> stok di-restore berlebih (net inflasi = jumlah potongan lama).
--
-- Fix: reverse hanya SISA potongan bersih per bahan. Hitung net qty per bahan dari
-- seluruh baris BOM order (pemakaian negatif + adjustment reversal sebelumnya, yang
-- keduanya ber-ref_order_id sama); kalau net < 0 (masih ada potongan outstanding),
-- kembalikan tepat -net. Idempoten terhadap berapa pun siklus complete/cancel:
-- kalau sudah ter-reverse penuh (net=0), HAVING menyaringnya -> no-op.
--
-- SECURITY DEFINER + search_path & logika potong (allowlist, faktor_konversi) TIDAK berubah.

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  v_resep_id UUID;
  v_allowed_outlets TEXT;
BEGIN
  -- Guard allowlist: kalau key tidak ada / outlet_id tidak terdaftar -> skip semua logika BOM.
  SELECT value INTO v_allowed_outlets FROM public.global_settings
    WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NULL
     OR NOT (NEW.outlet_id::text = ANY (string_to_array(v_allowed_outlets, ','))) THEN
    RETURN NEW;
  END IF;

  -- Order selesai (di-update ke completed, atau di-insert sudah completed).
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    FOR rec IN SELECT menu_item_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF rec.menu_item_id IS NOT NULL THEN
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
            SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
            FROM public.resep_item ri
            JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
            WHERE ri.resep_id = v_resep_id
          LOOP
            INSERT INTO public.ledger_stok (
              outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
            ) VALUES (
              NEW.outlet_id,
              r_item.bahan_baku_id,
              'pemakaian',
              -(r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi),
              'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A'),
              NEW.id,
              NOW()
            );
          END LOOP;
        END IF;
      END IF;
    END LOOP;

  -- Order dibatalkan (restore stok) -- reverse hanya SISA potongan bersih per bahan.
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

    FOR l_item IN
      SELECT bahan_baku_id, SUM(qty) AS net_qty
      FROM public.ledger_stok
      WHERE ref_order_id = NEW.id AND tipe IN ('pemakaian', 'adjustment')
      GROUP BY bahan_baku_id
      HAVING SUM(qty) < 0            -- masih ada potongan outstanding yang belum dikembalikan
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
      ) VALUES (
        NEW.outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        -l_item.net_qty,            -- net_qty < 0 -> nilai kembalian positif = sisa outstanding
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger attachment tak berubah (fungsi yang di-REPLACE otomatis dipakai ulang).

-- DOWN: kembalikan versi 20260704200000 (reverse per-baris, rawan over-restore).
