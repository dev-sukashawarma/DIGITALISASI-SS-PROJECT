-- 20260813120501_update_po_rpc_hybrid.sql
-- Mengupdate fungsi RPC create_purchase_order dan verifikasi_terima_po untuk
-- mendukung insert bahan_baku_id NULL dengan item_description (Hybrid).

-- ============================================================
-- 1. create_purchase_order (Updated for Hybrid)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id    UUID,         -- boleh NULL jika supplier tidak ada di master
  p_supplier_nama  TEXT,         -- nama supplier (wajib)
  p_tanggal_po     DATE DEFAULT CURRENT_DATE,
  p_items          JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ "bahan_baku_id": "uuid" (bisa null), "item_description": "nama ad-hoc", "satuan_ad_hoc": "pcs", "qty_pesan": 10, "harga_pesan": 38000 }, ...]
  p_catatan        TEXT DEFAULT NULL
)
RETURNS public.purchase_order
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po      public.purchase_order;
  v_item    JSONB;
  v_nomor   TEXT;
BEGIN
  -- Validasi akses
  IF NOT public.can_manage_po() THEN
    RAISE EXCEPTION 'Hanya staff dengan role yang berwenang (Admin/Finance/Purchasing/Kitchen) yang dapat membuat Purchase Order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validasi input
  IF p_supplier_nama IS NULL OR TRIM(p_supplier_nama) = '' THEN
    RAISE EXCEPTION 'Nama supplier wajib diisi';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Minimal 1 item barang wajib ada';
  END IF;

  -- Generate nomor PO
  v_nomor := public.generate_nomor_po();

  -- Buat header PO
  INSERT INTO public.purchase_order (
    nomor_po, supplier_id, supplier_nama,
    tanggal_po, catatan, dibuat_oleh, status
  ) VALUES (
    v_nomor,
    p_supplier_id,
    TRIM(p_supplier_nama),
    p_tanggal_po,
    p_catatan,
    auth.uid(),
    'draft'
  )
  RETURNING * INTO v_po;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.purchase_order_item (
      purchase_order_id,
      bahan_baku_id,
      item_description,
      satuan_ad_hoc,
      qty_pesan,
      harga_pesan
    ) VALUES (
      v_po.id,
      NULLIF(v_item->>'bahan_baku_id', '')::UUID,
      v_item->>'item_description',
      v_item->>'satuan_ad_hoc',
      (v_item->>'qty_pesan')::NUMERIC,
      COALESCE((v_item->>'harga_pesan')::NUMERIC, 0)
    );
  END LOOP;

  RETURN v_po;
END;
$$;


-- ============================================================
-- 2. verifikasi_terima_po (Updated for Hybrid)
-- ============================================================
CREATE OR REPLACE FUNCTION public.verifikasi_terima_po(
  p_po_id  UUID,
  p_items  JSONB
  -- Format: [{ "id": "item_uuid", "qty_terima": 9.5, "harga_terima": 39000, "kondisi": "baik", "catatan": "..." }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status      TEXT;
  v_item        JSONB;
  v_total_items INT;
  v_total_ok    INT;
  v_new_status  TEXT;
BEGIN
  -- Validasi akses
  IF NOT public.can_manage_po() THEN
    RAISE EXCEPTION 'Hanya staff dengan role yang berwenang (Admin/Finance/Purchasing/Kitchen) yang dapat verifikasi Purchase Order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ambil status PO
  SELECT status INTO v_status
    FROM public.purchase_order WHERE id = p_po_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan';
  END IF;

  IF v_status IN ('diterima_lengkap', 'dibatalkan') THEN
    RAISE EXCEPTION 'Purchase Order sudah % - tidak dapat diverifikasi ulang', v_status;
  END IF;

  -- Update qty_terima + harga_terima per item (Updated to match by item ID instead of bahan_baku_id, 
  -- since bahan_baku_id can be null now)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.purchase_order_item
    SET
      qty_terima   = (v_item->>'qty_terima')::NUMERIC,
      harga_terima = NULLIF((v_item->>'harga_terima')::NUMERIC, 0),
      kondisi      = COALESCE(v_item->>'kondisi', 'baik'),
      catatan      = v_item->>'catatan'
    WHERE purchase_order_id = p_po_id
      AND id = (v_item->>'id')::UUID;
  END LOOP;

  -- Tentukan status baru berdasarkan kelengkapan
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE qty_terima IS NOT NULL)
  INTO v_total_items, v_total_ok
  FROM public.purchase_order_item
  WHERE purchase_order_id = p_po_id;

  IF v_total_ok = 0 THEN
    -- Belum ada yang diverifikasi - tidak update status
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Tidak ada item yang diverifikasi'
    );
  ELSIF v_total_ok < v_total_items THEN
    v_new_status := 'sebagian_diterima';
  ELSE
    v_new_status := 'diterima_lengkap';
  END IF;

  -- Update status PO - ini yang memicu trigger po_on_verified
  UPDATE public.purchase_order
  SET
    status            = v_new_status,
    diverifikasi_oleh = auth.uid(),
    diverifikasi_at   = NOW()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'success',  true,
    'status',   v_new_status,
    'message',  'Verifikasi selesai. Stok kitchen dan harga bahan baku telah diperbarui.',
    'total_items',  v_total_items,
    'items_ok',     v_total_ok
  );
END;
$$;

