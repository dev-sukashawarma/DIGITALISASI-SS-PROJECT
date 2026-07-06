-- 20260707100500_po_triggers.sql
-- Dua trigger utama modul Purchase Order:
--
-- TRIGGER 1: po_on_verified
--   Jalan AFTER UPDATE pada purchase_order, ketika status berubah ke
--   'sebagian_diterima' atau 'diterima_lengkap'.
--   Untuk setiap item yang qty_terima IS NOT NULL:
--     a) INSERT ledger_stok kitchen: tipe='pembelian_supplier', qty=+qty_terima
--     b) UPSERT bahan_baku_harga: harga_beli = harga_terima (jika ada)
--
-- TRIGGER 2: sj_on_dikirim → kurangi stok kitchen
--   Jalan AFTER UPDATE pada surat_jalan, ketika status berubah ke 'dikirim'.
--   Berlaku untuk SJ ke SEMUA 19 outlet (internal + mitra).
--   Idempotent: skip jika sudah ada ledger transfer_keluar untuk SJ ini.
--   Untuk setiap surat_jalan_item:
--     INSERT ledger_stok kitchen: tipe='transfer_keluar', qty=-qty_dikirim

-- ============================================================
-- Konstanta Kitchen ID
-- ============================================================
-- KITCHEN = '550e8400-e29b-41d4-a716-446655440001' (SUKA SHAWARMA KITCHEN Bogor)
-- Dikodekan langsung sebagai literal UUID di fungsi (tidak ada tabel config,
-- kitchen adalah singleton — satu pusat distribusi).

-- ============================================================
-- TRIGGER 1: PO diverifikasi → stok kitchen naik + harga update
-- ============================================================
CREATE OR REPLACE FUNCTION public.po_on_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kitchen_id UUID := '550e8400-e29b-41d4-a716-446655440001';
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
      'Terima dari supplier: ' || NEW.nomor_po
        || ' — ' || v_item.nama_bahan,
      NEW.diverifikasi_oleh,
      NOW()
    );

    -- b) Update harga beli master (hanya jika harga_terima diisi)
    --    Admin tetap bisa override manual kapanpun setelah ini.
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

  -- Catat siapa yang verifikasi dan kapan (jika belum diisi RPC)
  IF NEW.diverifikasi_at IS NULL THEN
    NEW.diverifikasi_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_on_verified
  AFTER UPDATE ON public.purchase_order
  FOR EACH ROW
  EXECUTE FUNCTION public.po_on_verified();

-- ============================================================
-- TRIGGER 2: SJ dikirim → stok kitchen berkurang
-- ============================================================
CREATE OR REPLACE FUNCTION public.sj_on_dikirim_kurangi_kitchen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kitchen_id UUID := '550e8400-e29b-41d4-a716-446655440001';
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
      'Kirim SJ ke outlet — ' || v_item.nama_bahan,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sj_on_dikirim_kurangi_kitchen
  AFTER UPDATE ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.sj_on_dikirim_kurangi_kitchen();

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_po_on_verified ON public.purchase_order;
-- DROP FUNCTION IF EXISTS public.po_on_verified();
-- DROP TRIGGER IF EXISTS trg_sj_on_dikirim_kurangi_kitchen ON public.surat_jalan;
-- DROP FUNCTION IF EXISTS public.sj_on_dikirim_kurangi_kitchen();
