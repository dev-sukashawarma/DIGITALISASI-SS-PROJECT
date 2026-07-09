-- 1. Perbaiki Foreign Key di tabel-tabel FIFO agar menunjuk ke bahan_baku
ALTER TABLE public.inventory_batches DROP CONSTRAINT IF EXISTS inventory_batches_item_id_fkey;
ALTER TABLE public.inventory_batches ADD CONSTRAINT inventory_batches_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.bahan_baku(id) ON DELETE RESTRICT;

ALTER TABLE public.internal_request_items DROP CONSTRAINT IF EXISTS internal_request_items_item_id_fkey;
ALTER TABLE public.internal_request_items ADD CONSTRAINT internal_request_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.bahan_baku(id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_conversions DROP CONSTRAINT IF EXISTS inventory_conversions_item_id_fkey;
ALTER TABLE public.inventory_conversions ADD CONSTRAINT inventory_conversions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.bahan_baku(id) ON DELETE CASCADE;

-- 2. Hapus tabel inventory_items karena sudah pakai bahan_baku
DROP TABLE IF EXISTS public.inventory_items CASCADE;

-- 3. Update trigger po_on_verified agar memasukkan data ke inventory_batches (FIFO)
CREATE OR REPLACE FUNCTION public.po_on_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kitchen_id UUID := '550e8400-e29b-41d4-a716-446655440001'; -- UUID Kitchen default
  v_item       RECORD;
BEGIN
  IF NEW.status NOT IN ('sebagian_diterima', 'diterima_lengkap') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW; 
  END IF;

  FOR v_item IN
    SELECT
      poi.id,
      poi.bahan_baku_id,
      poi.qty_terima,
      poi.harga_terima,
      poi.kondisi,
      b.nama AS nama_bahan
    FROM public.purchase_order_item poi
    JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
    WHERE poi.purchase_order_id = NEW.id
      AND poi.qty_terima IS NOT NULL
      AND poi.qty_terima > 0
  LOOP
    -- a) Stok ledger lama
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty,
      ref_po_id, catatan, created_by, created_at
    ) VALUES (
      v_kitchen_id,
      v_item.bahan_baku_id,
      'pembelian_supplier',
      v_item.qty_terima,
      NEW.id,
      'Terima PO: ' || NEW.nomor_po,
      NEW.diverifikasi_oleh,
      NOW()
    );

    -- b) Update harga beli master
    IF v_item.harga_terima IS NOT NULL
       AND v_item.harga_terima > 0
       AND v_item.kondisi != 'rusak'
    THEN
      INSERT INTO public.bahan_baku_harga (
        bahan_baku_id, harga_beli, harga_updated_at, updated_by
      ) VALUES (
        v_item.bahan_baku_id,
        v_item.harga_terima,
        NOW(),
        NEW.diverifikasi_oleh
      )
      ON CONFLICT (bahan_baku_id) DO UPDATE
        SET harga_beli       = EXCLUDED.harga_beli,
            harga_updated_at = EXCLUDED.harga_updated_at,
            updated_by       = EXCLUDED.updated_by;
    END IF;

    -- c) INJECT FIFO BATCH
    IF v_item.kondisi != 'rusak' THEN
       INSERT INTO public.inventory_batches (
          location_id,
          item_id,
          qty_initial,
          qty_remaining,
          price_per_base_unit,
          received_at
       ) VALUES (
          v_kitchen_id::TEXT, 
          v_item.bahan_baku_id,
          v_item.qty_terima,
          v_item.qty_terima,
          COALESCE(v_item.harga_terima, 0),
          NOW()
       );
    END IF;
  END LOOP;

  IF NEW.diverifikasi_at IS NULL THEN
    NEW.diverifikasi_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;
