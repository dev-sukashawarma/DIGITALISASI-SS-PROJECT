-- 1. Mutasi Status Enum
CREATE TYPE mutasi_status AS ENUM (
  'menunggu_persetujuan',
  'ditolak',
  'menunggu_pengiriman',
  'dikirim',
  'selesai'
);

-- 2. Master Table
CREATE TABLE mutasi_antar_outlet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_asal_id UUID NOT NULL REFERENCES outlets(id),
  outlet_tujuan_id UUID NOT NULL REFERENCES outlets(id),
  status mutasi_status NOT NULL DEFAULT 'menunggu_persetujuan',
  
  created_by UUID REFERENCES outlet_staff(id),
  approved_by UUID REFERENCES outlet_staff(id),
  
  kurir_info JSONB,
  catatan_pengajuan TEXT,
  catatan_penolakan TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT mutasi_different_outlets CHECK (outlet_asal_id != outlet_tujuan_id)
);

CREATE INDEX idx_mutasi_asal ON mutasi_antar_outlet(outlet_asal_id);
CREATE INDEX idx_mutasi_tujuan ON mutasi_antar_outlet(outlet_tujuan_id);
CREATE INDEX idx_mutasi_status ON mutasi_antar_outlet(status);
CREATE INDEX idx_mutasi_created ON mutasi_antar_outlet(created_at DESC);

-- 3. Item Table
CREATE TABLE mutasi_antar_outlet_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mutasi_id UUID NOT NULL REFERENCES mutasi_antar_outlet(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id),
  
  qty_diajukan NUMERIC NOT NULL CHECK (qty_diajukan > 0),
  qty_dikirim NUMERIC CHECK (qty_dikirim >= 0),
  qty_diterima NUMERIC CHECK (qty_diterima >= 0),
  
  kondisi_diterima TEXT CHECK (kondisi_diterima IN ('baik','rusak','hilang_qty')),
  foto_bukti_terima TEXT,
  
  UNIQUE(mutasi_id, bahan_baku_id)
);

CREATE INDEX idx_mutasi_item_mutasi ON mutasi_antar_outlet_item(mutasi_id);
CREATE INDEX idx_mutasi_item_bahan ON mutasi_antar_outlet_item(bahan_baku_id);

-- 4. RLS Policies
ALTER TABLE mutasi_antar_outlet ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutasi_antar_outlet_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY mutasi_read ON mutasi_antar_outlet FOR SELECT TO authenticated
USING (
  auth_is_supervisor() OR
  outlet_asal_id = auth_outlet_id() OR
  outlet_tujuan_id = auth_outlet_id()
);

CREATE POLICY mutasi_item_read ON mutasi_antar_outlet_item FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mutasi_antar_outlet m
    WHERE m.id = mutasi_antar_outlet_item.mutasi_id
    AND (
      auth_is_supervisor() OR
      m.outlet_asal_id = auth_outlet_id() OR
      m.outlet_tujuan_id = auth_outlet_id()
    )
  )
);

-- Note: We do not allow direct INSERT/UPDATE. Everything is handled via RPCs running as SECURITY DEFINER.

-- 5. RPCs for Workflow

-- a. Ajukan Mutasi (Outlet A)
CREATE OR REPLACE FUNCTION ajukan_mutasi(
  p_outlet_asal_id UUID,
  p_outlet_tujuan_id UUID,
  p_catatan TEXT,
  p_items JSONB -- Array of { bahan_baku_id, qty_diajukan }
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutasi_id UUID;
  v_item JSONB;
BEGIN
  IF auth_outlet_id() != p_outlet_asal_id THEN
    RAISE EXCEPTION 'Not authorized to create mutasi for this outlet';
  END IF;

  INSERT INTO mutasi_antar_outlet (
    outlet_asal_id, outlet_tujuan_id, catatan_pengajuan, created_by
  ) VALUES (
    p_outlet_asal_id, p_outlet_tujuan_id, p_catatan, auth.uid()
  ) RETURNING id INTO v_mutasi_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO mutasi_antar_outlet_item (
      mutasi_id, bahan_baku_id, qty_diajukan
    ) VALUES (
      v_mutasi_id, 
      (v_item->>'bahan_baku_id')::UUID, 
      (v_item->>'qty_diajukan')::NUMERIC
    );
  END LOOP;

  RETURN v_mutasi_id;
END;
$$;

-- b. Approve Mutasi (Pusat)
CREATE OR REPLACE FUNCTION approve_mutasi(
  p_mutasi_id UUID,
  p_is_approved BOOLEAN,
  p_catatan_penolakan TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status mutasi_status;
BEGIN
  IF NOT auth_is_supervisor() THEN
    RAISE EXCEPTION 'Not authorized to approve mutasi';
  END IF;

  SELECT status INTO v_status FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_status != 'menunggu_persetujuan' THEN
    RAISE EXCEPTION 'Mutasi is not waiting for approval';
  END IF;

  IF p_is_approved THEN
    UPDATE mutasi_antar_outlet 
    SET status = 'menunggu_pengiriman', approved_by = auth.uid(), updated_at = NOW()
    WHERE id = p_mutasi_id;
  ELSE
    UPDATE mutasi_antar_outlet 
    SET status = 'ditolak', approved_by = auth.uid(), catatan_penolakan = p_catatan_penolakan, updated_at = NOW()
    WHERE id = p_mutasi_id;
  END IF;
END;
$$;

-- c. Kirim Mutasi (Outlet A) -> Deduct Stock
CREATE OR REPLACE FUNCTION kirim_mutasi(
  p_mutasi_id UUID,
  p_kurir_info JSONB,
  p_items_dikirim JSONB -- Array of { item_id, qty_dikirim }
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutasi mutasi_antar_outlet%ROWTYPE;
  v_item JSONB;
  v_mutasi_item mutasi_antar_outlet_item%ROWTYPE;
BEGIN
  SELECT * INTO v_mutasi FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_mutasi.id IS NULL THEN
    RAISE EXCEPTION 'Mutasi not found';
  END IF;
  
  IF auth_outlet_id() != v_mutasi.outlet_asal_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_mutasi.status != 'menunggu_pengiriman' THEN
    RAISE EXCEPTION 'Invalid status for sending';
  END IF;

  UPDATE mutasi_antar_outlet
  SET status = 'dikirim', kurir_info = p_kurir_info, updated_at = NOW()
  WHERE id = p_mutasi_id;

  -- Update items with actual sent qty and create ledger entries
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_dikirim)
  LOOP
    UPDATE mutasi_antar_outlet_item 
    SET qty_dikirim = (v_item->>'qty_dikirim')::NUMERIC
    WHERE id = (v_item->>'item_id')::UUID AND mutasi_id = p_mutasi_id
    RETURNING * INTO v_mutasi_item;

    -- Create Ledger Entry for Outlet A (Deduct stock, qty < 0)
    IF v_mutasi_item.qty_dikirim > 0 THEN
      INSERT INTO ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, created_by, ref_transfer_id
      ) VALUES (
        v_mutasi.outlet_asal_id, v_mutasi_item.bahan_baku_id, 'transfer_keluar',
        -v_mutasi_item.qty_dikirim, 'Transfer keluar ke outlet ' || v_mutasi.outlet_tujuan_id,
        auth.uid(), p_mutasi_id
      );
    END IF;
  END LOOP;
END;
$$;

-- d. Terima Mutasi (Outlet B) -> Add Stock
CREATE OR REPLACE FUNCTION terima_mutasi(
  p_mutasi_id UUID,
  p_items_diterima JSONB -- Array of { item_id, qty_diterima, kondisi_diterima, foto_bukti_terima }
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutasi mutasi_antar_outlet%ROWTYPE;
  v_item JSONB;
  v_mutasi_item mutasi_antar_outlet_item%ROWTYPE;
BEGIN
  SELECT * INTO v_mutasi FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_mutasi.id IS NULL THEN
    RAISE EXCEPTION 'Mutasi not found';
  END IF;
  
  IF auth_outlet_id() != v_mutasi.outlet_tujuan_id THEN
    RAISE EXCEPTION 'Not authorized to receive this mutasi';
  END IF;

  IF v_mutasi.status != 'dikirim' THEN
    RAISE EXCEPTION 'Invalid status for receiving';
  END IF;

  UPDATE mutasi_antar_outlet
  SET status = 'selesai', updated_at = NOW()
  WHERE id = p_mutasi_id;

  -- Update items with actual received qty and create ledger entries
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_diterima)
  LOOP
    UPDATE mutasi_antar_outlet_item 
    SET 
      qty_diterima = (v_item->>'qty_diterima')::NUMERIC,
      kondisi_diterima = v_item->>'kondisi_diterima',
      foto_bukti_terima = v_item->>'foto_bukti_terima'
    WHERE id = (v_item->>'item_id')::UUID AND mutasi_id = p_mutasi_id
    RETURNING * INTO v_mutasi_item;

    -- Create Ledger Entry for Outlet B (Add stock, qty > 0)
    IF v_mutasi_item.qty_diterima > 0 THEN
      INSERT INTO ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, created_by, ref_transfer_id
      ) VALUES (
        v_mutasi.outlet_tujuan_id, v_mutasi_item.bahan_baku_id, 'transfer_masuk',
        v_mutasi_item.qty_diterima, 'Transfer masuk dari outlet ' || v_mutasi.outlet_asal_id,
        auth.uid(), p_mutasi_id
      );
    END IF;
  END LOOP;
END;
$$;
