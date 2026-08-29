-- 20260828113000_fix_po_on_verified_gudang_id_and_scale.sql
-- Fix kitchen UUID to Gudang Pusat ('d23e11b3-23f1-4f9a-b428-cc73e1aa9b90')
-- and ensure to_ledger_scale is used for correct unit scale conversions on PO receipt

CREATE OR REPLACE FUNCTION public.po_on_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kitchen_id UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'; -- GUDANG PUSAT (HQ)
  v_item       RECORD;
  v_old_harga  NUMERIC;
BEGIN
  -- Hanya jalan saat status berubah ke 'sebagian_diterima' atau 'diterima_lengkap'
  IF NEW.status NOT IN ('sebagian_diterima', 'diterima_lengkap') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW; -- tidak ada perubahan status, skip
  END IF;

  -- Loop tiap item yang sudah diverifikasi (qty_terima IS NOT NULL)
  FOR v_item IN
    SELECT
      poi.id,
      poi.bahan_baku_id,
      poi.qty_terima,
      COALESCE(poi.harga_terima, poi.harga_pesan) AS harga_terima,
      b.nama AS nama_bahan
    FROM public.purchase_order_item poi
    JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
    WHERE poi.purchase_order_id = NEW.id
      AND poi.qty_terima IS NOT NULL
      AND poi.qty_terima > 0
      AND poi.kondisi = 'baik'
      AND poi.bahan_baku_id IS NOT NULL
  LOOP
    -- a) Stok kitchen/gudang pusat naik dengan skala yang tepat
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty,
      ref_po_id, catatan, created_by, created_at
    ) VALUES (
      v_kitchen_id,
      v_item.bahan_baku_id,
      'pembelian_supplier',
      to_ledger_scale(v_kitchen_id, v_item.bahan_baku_id, v_item.qty_terima),
      NEW.id,
      'Terima dari supplier: ' || NEW.nomor_po || ' — ' || v_item.nama_bahan,
      NEW.diverifikasi_oleh,
      NOW()
    );

    -- b) Update harga beli master otomatis (jika ada harga terima)
    IF v_item.harga_terima IS NOT NULL AND v_item.harga_terima > 0 THEN
      -- Ambil harga lama untuk audit history
      SELECT harga_beli INTO v_old_harga
      FROM public.bahan_baku_harga
      WHERE bahan_baku_id = v_item.bahan_baku_id;

      INSERT INTO public.bahan_baku_harga (
        bahan_baku_id, harga_beli, harga_beli_display, harga_updated_at, updated_by
      ) VALUES (
        v_item.bahan_baku_id,
        v_item.harga_terima,
        v_item.harga_terima,
        NOW(),
        NEW.diverifikasi_oleh
      )
      ON CONFLICT (bahan_baku_id) DO UPDATE
        SET harga_beli          = EXCLUDED.harga_beli,
            harga_beli_display  = EXCLUDED.harga_beli_display,
            harga_updated_at    = EXCLUDED.harga_updated_at,
            updated_by          = EXCLUDED.updated_by;

      -- Catat riwayat perubahan harga ke bahan_baku_harga_history jika harga berubah
      IF v_old_harga IS NULL OR v_old_harga <> v_item.harga_terima THEN
        INSERT INTO public.bahan_baku_harga_history (
          bahan_baku_id,
          harga_lama,
          harga_baru,
          ref_po_id,
          catatan,
          changed_by,
          changed_at
        ) VALUES (
          v_item.bahan_baku_id,
          v_old_harga,
          v_item.harga_terima,
          NEW.id,
          'Update otomatis dari penerimaan PO ' || NEW.nomor_po,
          NEW.diverifikasi_oleh,
          NOW()
        );
      END IF;
    END IF;
  END LOOP;

  -- c) Set jatuh tempo dari termin supplier
  UPDATE public.purchase_order po
    SET jatuh_tempo = NEW.diverifikasi_at::date + COALESCE(s.termin_hari, 0)
    FROM public.supplier s
    WHERE po.id = NEW.id
      AND po.supplier_id = s.id
      AND po.jatuh_tempo IS NULL;

  IF NEW.diverifikasi_at IS NULL THEN
    NEW.diverifikasi_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;
