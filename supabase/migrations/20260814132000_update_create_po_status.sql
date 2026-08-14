-- 20260814132000_update_create_po_status.sql

CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id    UUID,
  p_supplier_nama  TEXT,
  p_tanggal_po     DATE DEFAULT CURRENT_DATE,
  p_items          JSONB DEFAULT '[]'::jsonb,
  p_catatan        TEXT DEFAULT NULL,
  p_status         TEXT DEFAULT 'draft'
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

  -- Validasi status awal yang diperbolehkan
  IF p_status NOT IN ('draft', 'menunggu_approval_finance') THEN
    RAISE EXCEPTION 'Status awal PO tidak valid';
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
    p_status
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
