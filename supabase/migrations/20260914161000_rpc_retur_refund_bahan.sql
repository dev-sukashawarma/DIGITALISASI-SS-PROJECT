-- 20260914161000_rpc_retur_refund_bahan.sql
-- RPC Functions untuk Siklus Retur & Refund Bahan Baku Core

-- Tambahkan kolom ref_retur_id ke ledger_stok jika belum ada
ALTER TABLE public.ledger_stok
  ADD COLUMN IF NOT EXISTS ref_retur_id UUID REFERENCES public.retur_stok(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_ref_retur ON public.ledger_stok(ref_retur_id)
  WHERE ref_retur_id IS NOT NULL;

-- 1. RPC: ajukan_retur_stok
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
    catatan_kitchen,
    created_by
  ) VALUES (
    v_nomor_retur,
    p_outlet_id,
    COALESCE(p_tipe_retur, 'chiller_outlet'),
    'diajukan',
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

-- 2. RPC: approve_retur_by_manager (Role AM / RM / SPV / Admin)
CREATE OR REPLACE FUNCTION public.approve_retur_by_manager(
  p_retur_id UUID,
  p_approve BOOLEAN,
  p_catatan TEXT DEFAULT NULL,
  p_manager_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_outlet_id UUID;
  v_nomor_retur TEXT;
  v_approver_id UUID;
BEGIN
  v_approver_id := COALESCE(p_manager_id, auth.uid());

  IF v_approver_id IS NULL THEN
    RAISE EXCEPTION 'ID manager tidak teridentifikasi' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ambil role staf yang approve
  SELECT role INTO v_role
  FROM public.outlet_staff
  WHERE id = v_approver_id AND status = 'active';

  IF NOT (v_role IN ('area_manager', 'regional_manager', 'spv', 'admin', 'owner', 'developer')) THEN
    RAISE EXCEPTION 'Hanya Area Manager, Regional Manager, SPV, Admin, atau Developer yang dapat menyetujui pengajuan retur'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status, outlet_id, nomor_retur INTO v_status, v_outlet_id, v_nomor_retur
  FROM public.retur_stok
  WHERE id = p_retur_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Data tiket retur tidak ditemukan' USING ERRCODE = 'data_exception';
  END IF;

  IF v_status != 'diajukan' THEN
    RAISE EXCEPTION 'Tiket retur sudah tidak dalam status diajukan (status saat ini: %)', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_approve IS TRUE THEN
    UPDATE public.retur_stok
    SET
      status = 'disetujui_manager',
      approved_by_manager = v_approver_id,
      approved_manager_at = NOW(),
      catatan_manager = p_catatan,
      updated_at = NOW()
    WHERE id = p_retur_id;
  ELSE
    -- Jika ditolak AM/RM: alihkan potongan ledger menjadi waste
    UPDATE public.retur_stok
    SET
      status = 'ditolak',
      approved_by_manager = v_approver_id,
      approved_manager_at = NOW(),
      catatan_manager = p_catatan,
      updated_at = NOW()
    WHERE id = p_retur_id;

    UPDATE public.ledger_stok
    SET
      tipe = 'waste',
      catatan = 'Retur ditolak Manager (dialihkan ke waste): ' || COALESCE(p_catatan, '')
    WHERE ref_retur_id = p_retur_id AND tipe = 'retur_ke_pusat';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'retur_id', p_retur_id,
    'status', CASE WHEN p_approve THEN 'disetujui_manager' ELSE 'ditolak' END
  );
END;
$$;

-- 3. RPC: konfirmasi_serah_terima_logistik
CREATE OR REPLACE FUNCTION public.konfirmasi_serah_terima_logistik(
  p_retur_id UUID,
  p_jenis_logistik TEXT,
  p_nomor_resi TEXT,
  p_driver_nama TEXT,
  p_driver_kontak TEXT,
  p_driver_plat TEXT,
  p_foto_serah_terima TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_outlet_id UUID;
BEGIN
  SELECT status, outlet_id INTO v_status, v_outlet_id
  FROM public.retur_stok
  WHERE id = p_retur_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Data tiket retur tidak ditemukan' USING ERRCODE = 'data_exception';
  END IF;

  IF v_status != 'disetujui_manager' THEN
    RAISE EXCEPTION 'Barang belum dapat diserahkan ke kurir karena belum disetujui AM/RM'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (v_outlet_id IN (SELECT public.accessible_outlet_ids())) THEN
    RAISE EXCEPTION 'Akses ditolak untuk outlet ini' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.retur_stok
  SET
    status = 'dalam_pengiriman',
    jenis_logistik = COALESCE(p_jenis_logistik, 'internal'),
    nomor_resi_order = p_nomor_resi,
    driver_nama = p_driver_nama,
    driver_kontak = p_driver_kontak,
    driver_plat_kendaraan = p_driver_plat,
    foto_serah_terima_url = p_foto_serah_terima,
    diserahkan_driver_at = NOW(),
    updated_at = NOW()
  WHERE id = p_retur_id;

  RETURN jsonb_build_object(
    'success', true,
    'retur_id', p_retur_id,
    'status', 'dalam_pengiriman'
  );
END;
$$;

-- 4. RPC: verifikasi_kitchen_dan_buat_sj
CREATE OR REPLACE FUNCTION public.verifikasi_kitchen_dan_buat_sj(
  p_retur_id UUID,
  p_items_verified JSONB, -- [ { id (retur_stok_item_id), qty_diterima_kitchen } ]
  p_catatan TEXT DEFAULT NULL,
  p_terbitkan_sj_sekarang BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_retur RECORD;
  v_item RECORD;
  v_vitem JSONB;
  v_gudang_id UUID;
  v_sj_id UUID;
  v_sj_nomor TEXT;
  v_qty_terima NUMERIC;
BEGIN
  -- Periksa role kitchen/admin
  SELECT role INTO v_role
  FROM public.outlet_staff
  WHERE id = auth.uid();

  IF NOT (v_role IN ('kitchen', 'admin', 'owner', 'purchasing', 'admin_finance', 'developer')) THEN
    RAISE EXCEPTION 'Hanya tim Gudang Pusat (Kitchen) yang dapat memverifikasi fisik retur'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_retur
  FROM public.retur_stok
  WHERE id = p_retur_id;

  IF v_retur.id IS NULL THEN
    RAISE EXCEPTION 'Tiket retur tidak ditemukan' USING ERRCODE = 'data_exception';
  END IF;

  -- Update kuantitas verifikasi timbang kitchen jika ada payload
  IF p_items_verified IS NOT NULL AND jsonb_array_length(p_items_verified) > 0 THEN
    FOR v_vitem IN SELECT * FROM jsonb_array_elements(p_items_verified)
    LOOP
      UPDATE public.retur_stok_item
      SET qty_diterima_kitchen = (v_vitem->>'qty_diterima_kitchen')::NUMERIC
      WHERE id = (v_vitem->>'id')::UUID AND retur_stok_id = p_retur_id;
    END LOOP;
  END IF;

  -- OPSI 1: Terbitkan SJ Pengganti Sekarang (Barang siap & dikirim sekarang)
  IF p_terbitkan_sj_sekarang IS TRUE THEN
    v_sj_nomor := public.generate_surat_jalan_number(v_retur.outlet_id);

    INSERT INTO public.surat_jalan (
      document_number,
      outlet_id,
      created_by,
      status,
      notes,
      signatures,
      is_retur_replacement,
      ref_retur_id
    ) VALUES (
      v_sj_nomor,
      v_retur.outlet_id,
      COALESCE(auth.uid(), v_retur.created_by),
      'dikirim',
      'Surat Jalan Pengganti Retur ' || v_retur.nomor_retur || COALESCE(' — ' || p_catatan, ''),
      '[]'::jsonb,
      TRUE,
      p_retur_id
    ) RETURNING id INTO v_sj_id;

    -- Isi item surat jalan sesuai kuantitas verifikasi
    FOR v_item IN SELECT * FROM public.retur_stok_item WHERE retur_stok_id = p_retur_id
    LOOP
      v_qty_terima := COALESCE(v_item.qty_diterima_kitchen, v_item.qty_klaim);

      INSERT INTO public.surat_jalan_item (
        surat_jalan_id,
        bahan_baku_id,
        qty_dikirim,
        qty_terima
      ) VALUES (
        v_sj_id,
        v_item.bahan_baku_id,
        v_qty_terima,
        NULL
      );
    END LOOP;

    -- Update tiket retur ke status dikirim_pengganti
    UPDATE public.retur_stok
    SET
      status = 'dikirim_pengganti',
      verified_by_kitchen = auth.uid(),
      verified_kitchen_at = NOW(),
      catatan_kitchen = p_catatan,
      ref_surat_jalan_pengganti_id = v_sj_id,
      updated_at = NOW()
    WHERE id = p_retur_id;

    RETURN jsonb_build_object(
      'success', true,
      'retur_id', p_retur_id,
      'status', 'dikirim_pengganti',
      'surat_jalan_id', v_sj_id,
      'nomor_surat_jalan', v_sj_nomor
    );

  -- OPSI 2: Simpan Verifikasi Fisik Saja (Kirim nanti / gabung jadwal berikutnya)
  ELSE
    UPDATE public.retur_stok
    SET
      status = 'diterima_kitchen',
      verified_by_kitchen = auth.uid(),
      verified_kitchen_at = NOW(),
      catatan_kitchen = p_catatan,
      updated_at = NOW()
    WHERE id = p_retur_id;

    RETURN jsonb_build_object(
      'success', true,
      'retur_id', p_retur_id,
      'status', 'diterima_kitchen'
    );
  END IF;
END;
$$;

-- 5. Trigger Otomatis: Selesaikan Tiket Retur saat SJ Pengganti di-finalize di Outlet
CREATE OR REPLACE FUNCTION public.sync_retur_on_surat_jalan_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_retur_replacement IS TRUE 
     AND NEW.ref_retur_id IS NOT NULL 
     AND NEW.status IN ('diterima_lengkap', 'diterima_sebagian', 'selesai') 
  THEN
    UPDATE public.retur_stok
    SET status = 'selesai', updated_at = NOW()
    WHERE id = NEW.ref_retur_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_retur_on_surat_jalan_finalize ON public.surat_jalan;
CREATE TRIGGER trg_sync_retur_on_surat_jalan_finalize
  AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_retur_on_surat_jalan_finalize();
