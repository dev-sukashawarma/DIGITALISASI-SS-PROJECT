-- 20260916170000_alter_retur_alasan_text.sql
-- Mengubah tipe kolom retur_stok_item.alasan dari VARCHAR(64) ke TEXT
-- agar dapat menampung keterangan rinci (misal: kategori 'Lainnya' dengan deskripsi kondisi)
-- dan menambahkan kolom catatan_outlet di public.retur_stok.

ALTER TABLE public.retur_stok_item 
  ALTER COLUMN alasan TYPE TEXT;

ALTER TABLE public.retur_stok 
  ADD COLUMN IF NOT EXISTS catatan_outlet TEXT;

-- Update RPC ajukan_retur_stok agar mencatat catatan_outlet
CREATE OR REPLACE FUNCTION public.ajukan_retur_stok(
  p_outlet_id UUID,
  p_tipe_retur TEXT,
  p_items JSONB,
  p_catatan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retur_id UUID;
  v_nomor_retur TEXT;
  v_prefix TEXT;
  v_seq INT;
  v_item JSONB;
  v_bahan_id UUID;
  v_qty NUMERIC;
  v_foto_fisik TEXT;
  v_foto_timbangan TEXT;
  v_alasan TEXT;
  v_item_catatan TEXT;
  v_is_refundable BOOLEAN;
  v_scaled_qty NUMERIC;
BEGIN
  -- Validasi akses outlet
  IF NOT (p_outlet_id IN (SELECT public.accessible_outlet_ids())) THEN
    RAISE EXCEPTION 'Akses ditolak untuk outlet ini' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Generate nomor retur: RET-YYYYMMDD-XXXX
  v_prefix := 'RET-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD') || '-';
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM public.retur_stok
  WHERE nomor_retur LIKE v_prefix || '%';

  v_nomor_retur := v_prefix || LPAD(v_seq::TEXT, 4, '0');

  -- Insert header retur_stok
  INSERT INTO public.retur_stok (
    nomor_retur,
    outlet_id,
    tipe_retur,
    status,
    catatan_outlet,
    catatan_kitchen,
    created_by
  ) VALUES (
    v_nomor_retur,
    p_outlet_id,
    COALESCE(p_tipe_retur, 'chiller_outlet'),
    'diajukan',
    p_catatan,
    p_catatan,
    auth.uid()
  ) RETURNING id INTO v_retur_id;

  -- Loop item klaim
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_bahan_id := (v_item->>'bahan_baku_id')::UUID;
    v_qty := (v_item->>'qty_klaim')::NUMERIC;
    v_foto_fisik := v_item->>'foto_fisik_url';
    v_foto_timbangan := v_item->>'foto_timbangan_url';
    v_alasan := v_item->>'alasan';
    v_item_catatan := v_item->>'catatan';

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantitas retur harus lebih besar dari 0' USING ERRCODE = 'check_violation';
    END IF;

    -- Validasi is_refundable
    SELECT is_refundable INTO v_is_refundable
    FROM public.bahan_baku
    WHERE id = v_bahan_id;

    IF v_is_refundable IS NOT TRUE THEN
      RAISE EXCEPTION 'Bahan baku ini tidak memenuhi syarat untuk diretur/refund' USING ERRCODE = 'check_violation';
    END IF;

    -- Insert ke retur_stok_item
    INSERT INTO public.retur_stok_item (
      retur_stok_id,
      bahan_baku_id,
      qty_klaim,
      foto_fisik_url,
      foto_timbangan_url,
      alasan,
      catatan
    ) VALUES (
      v_retur_id,
      v_bahan_id,
      v_qty,
      v_foto_fisik,
      v_foto_timbangan,
      v_alasan,
      v_item_catatan
    );

    -- Potong saldo outlet jika retur berasal dari chiller (pasca-terima)
    IF p_tipe_retur = 'chiller_outlet' THEN
      v_scaled_qty := public.to_ledger_scale(p_outlet_id, v_bahan_id, v_qty);

      INSERT INTO public.ledger_stok (
        outlet_id,
        bahan_baku_id,
        tipe,
        qty,
        catatan,
        ref_retur_id,
        created_by
      ) VALUES (
        p_outlet_id,
        v_bahan_id,
        'retur_ke_pusat',
        -v_scaled_qty,
        'Pengajuan retur ' || v_nomor_retur || ': ' || COALESCE(v_alasan, ''),
        v_retur_id,
        auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'retur_id', v_retur_id,
    'nomor_retur', v_nomor_retur
  );
END;
$$;
