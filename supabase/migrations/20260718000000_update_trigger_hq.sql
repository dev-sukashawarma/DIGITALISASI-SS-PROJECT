-- 20260718000000_update_trigger_hq.sql
-- Update v_kitchen_id to Gudang Pusat (HQ) ID for PO and SJ triggers

CREATE OR REPLACE FUNCTION public.po_on_verified()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    -- Updated to Gudang Pusat (HQ) ID
    v_kitchen_id UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
    v_item       RECORD;
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
        poi.harga_terima,
        b.nama AS nama_bahan
      FROM public.purchase_order_item poi
      JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
      WHERE poi.purchase_order_id = NEW.id
        AND poi.qty_terima IS NOT NULL
        AND poi.qty_terima > 0
        AND poi.kondisi = 'baik'
    LOOP
      -- a) Stok kitchen naik
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty,
        ref_po_id, catatan, created_by, created_at
      ) VALUES (
        v_kitchen_id,
        v_item.bahan_baku_id,
        'pembelian_supplier',
        v_item.qty_terima,
        NEW.id,
        'Terima dari supplier: ' || NEW.nomor_po || ' - ' || v_item.nama_bahan,
        NEW.diverifikasi_oleh,
        NOW()
      );
  
      -- b) Update harga beli master (hanya jika harga_terima diisi)
      IF v_item.harga_terima IS NOT NULL AND v_item.harga_terima > 0 THEN
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
    END LOOP;
  
    RETURN NEW;
  END;
  $$;

CREATE OR REPLACE FUNCTION public.sj_on_dikirim_kurangi_kitchen()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    -- Updated to Gudang Pusat (HQ) ID
    v_kitchen_id UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
    v_item       RECORD;
    v_sudah_ada  BOOLEAN;
  BEGIN
    -- Hanya jalan saat status berubah dari bukan 'dikirim' ke 'dikirim'
    IF NOT (OLD.status <> 'dikirim' AND NEW.status = 'dikirim') THEN
      RETURN NEW;
    END IF;
  
    -- Idempotency guard: cek apakah sudah ada ledger transfer_keluar untuk SJ ini
    SELECT EXISTS (
      SELECT 1 FROM public.ledger_stok
      WHERE ref_shipment_id = NEW.id
        AND outlet_id = v_kitchen_id
        AND tipe = 'transfer_keluar'
    ) INTO v_sudah_ada;
  
    IF v_sudah_ada THEN
      -- Sudah diproses sebelumnya, skip untuk mencegah dobel
      RAISE WARNING 'sj_on_dikirim: ledger transfer_keluar untuk SJ % sudah ada, dilewati.', NEW.id;
      RETURN NEW;
    END IF;
  
    -- Loop tiap item SJ, kurangi stok kitchen
    FOR v_item IN
      SELECT
        sji.bahan_baku_id,
        sji.qty_dikirim,
        b.nama AS nama_bahan
      FROM public.surat_jalan_item sji
      JOIN public.bahan_baku b ON b.id = sji.bahan_baku_id
      WHERE sji.surat_jalan_id = NEW.id
        AND sji.qty_dikirim > 0
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty,
        ref_shipment_id, catatan, created_at
      ) VALUES (
        v_kitchen_id,
        v_item.bahan_baku_id,
        'transfer_keluar',
        -(v_item.qty_dikirim),  -- negatif = keluar dari kitchen
        NEW.id,
        'Kirim SJ ke outlet - ' || v_item.nama_bahan,
        NOW()
      );
    END LOOP;
  
    RETURN NEW;
  END;
  $$;

CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_saldo NUMERIC;
DECLARE bahan_nama TEXT;
DECLARE bahan_satuan TEXT;
BEGIN
  -- Increment atomik: ON CONFLICT memegang row-lock stok_balance
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Guard no-negative-balance
  IF NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman')
  THEN
    SELECT nama, satuan INTO bahan_nama, bahan_satuan 
    FROM bahan_baku WHERE id = NEW.bahan_baku_id;
    
    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      bahan_nama, NEW.saldo_sebelum, bahan_satuan,
      ABS(NEW.qty), bahan_satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
