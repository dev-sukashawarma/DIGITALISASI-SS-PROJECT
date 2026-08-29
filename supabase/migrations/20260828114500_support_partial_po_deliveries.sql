
-- 20260828114500_support_partial_po_deliveries.sql
-- Mendukung penerimaan bertahap (multi-batch partial delivery) untuk PO Supplier

-- 1. Matikan trigger lama po_on_verified agar tidak terjadi double insert stok
DROP TRIGGER IF EXISTS trg_po_verified ON public.purchase_order;
DROP FUNCTION IF EXISTS public.po_on_verified() CASCADE;

-- 2. Update RPC verifikasi_terima_po untuk mendukung delta penerimaan bertahap
CREATE OR REPLACE FUNCTION public.verifikasi_terima_po(
  p_po_id UUID,
  p_items JSONB
  -- Format tiap item:
  -- {
  --   "id": "uuid_item",
  --   "qty_datang": 300,        -- [Opsional] Kuantitas fisik yang tiba pada sesi ini (delta)
  --   "qty_terima": 700,        -- [Opsional] Total akumulasi kuantitas diterima
  --   "harga_terima": 35000,
  --   "kondisi": "baik",
  --   "catatan": "..."
  -- }
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kitchen_id  UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'; -- GUDANG PUSAT (HQ)
  v_status      TEXT;
  v_nomor_po    TEXT;
  v_item        JSONB;
  v_item_id     UUID;
  v_bb_id       UUID;
  v_nama_bahan  TEXT;
  v_satuan      TEXT;
  v_qty_pesan   NUMERIC;
  v_old_terima  NUMERIC;
  v_incoming    NUMERIC;
  v_new_terima  NUMERIC;
  v_harga_trima NUMERIC;
  v_kondisi     TEXT;
  v_catatan     TEXT;
  v_total_pesan NUMERIC := 0;
  v_total_terima NUMERIC := 0;
  v_all_completed BOOLEAN := true;
  v_has_any_received BOOLEAN := false;
  v_new_status  TEXT;
  v_old_harga   NUMERIC;
BEGIN
  -- 1. Validasi hak akses
  IF NOT public.can_manage_po() THEN
    RAISE EXCEPTION 'Hanya staff dengan role yang berwenang (Admin/Finance/Purchasing/Kitchen) yang dapat verifikasi Purchase Order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Ambil PO
  SELECT status, nomor_po INTO v_status, v_nomor_po
  FROM public.purchase_order WHERE id = p_po_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan';
  END IF;

  IF v_status IN ('dibatalkan') THEN
    RAISE EXCEPTION 'Purchase Order % sudah dibatalkan - tidak dapat diverifikasi', v_nomor_po;
  END IF;

  -- 3. Loop tiap item dalam payload
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'id')::UUID;
    v_kondisi := COALESCE(v_item->>'kondisi', 'baik');
    v_catatan := v_item->>'catatan';
    v_harga_trima := NULLIF((v_item->>'harga_terima')::NUMERIC, 0);

    -- Ambil data item saat ini
    SELECT 
      poi.bahan_baku_id,
      COALESCE(b.nama, poi.item_description, 'Item PO'),
      COALESCE(b.satuan, poi.satuan_ad_hoc, 'satuan'),
      COALESCE(poi.qty_pesan, 0),
      COALESCE(poi.qty_terima, 0)
    INTO
      v_bb_id,
      v_nama_bahan,
      v_satuan,
      v_qty_pesan,
      v_old_terima
    FROM public.purchase_order_item poi
    LEFT JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
    WHERE poi.id = v_item_id AND poi.purchase_order_id = p_po_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Tentukan kuantitas tiba sekarang (incoming delta) vs kuantitas total diterima
    IF (v_item ? 'qty_datang') AND (v_item->>'qty_datang')::NUMERIC > 0 THEN
      v_incoming := (v_item->>'qty_datang')::NUMERIC;
      v_new_terima := v_old_terima + v_incoming;
    ELSE
      -- Jika client kirim new total qty_terima
      v_new_terima := (v_item->>'qty_terima')::NUMERIC;
      v_incoming := GREATEST(0, v_new_terima - v_old_terima);
    END IF;

    -- Update purchase_order_item
    UPDATE public.purchase_order_item
    SET
      qty_terima   = v_new_terima,
      harga_terima = COALESCE(v_harga_trima, harga_pesan),
      kondisi      = v_kondisi,
      catatan      = COALESCE(v_catatan, catatan)
    WHERE id = v_item_id;

    -- Jika ada barang fisik baru yang tiba dan kondisi baik -> Masukkan ke ledger Gudang Pusat
    IF v_incoming > 0 AND v_kondisi = 'baik' AND v_bb_id IS NOT NULL THEN
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty,
        ref_po_id, catatan, created_by, created_at
      ) VALUES (
        v_kitchen_id,
        v_bb_id,
        'pembelian_supplier',
        to_ledger_scale(v_kitchen_id, v_bb_id, v_incoming),
        p_po_id,
        'Terima PO ' || v_nomor_po || ' — ' || v_nama_bahan || ' (' || v_incoming || ' ' || v_satuan || ')',
        auth.uid(),
        NOW()
      );

      -- Update master price & audit history jika ada harga terima
      IF v_harga_trima IS NOT NULL AND v_harga_trima > 0 THEN
        SELECT harga_beli INTO v_old_harga
        FROM public.bahan_baku_harga
        WHERE bahan_baku_id = v_bb_id;

        INSERT INTO public.bahan_baku_harga (
          bahan_baku_id, harga_beli, harga_beli_display, harga_updated_at, updated_by
        ) VALUES (
          v_bb_id,
          v_harga_trima,
          v_harga_trima,
          NOW(),
          auth.uid()
        )
        ON CONFLICT (bahan_baku_id) DO UPDATE
          SET harga_beli          = EXCLUDED.harga_beli,
              harga_beli_display  = EXCLUDED.harga_beli_display,
              harga_updated_at    = EXCLUDED.harga_updated_at,
              updated_by          = EXCLUDED.updated_by;

        IF v_old_harga IS NULL OR v_old_harga <> v_harga_trima THEN
          INSERT INTO public.bahan_baku_harga_history (
            bahan_baku_id,
            harga_lama,
            harga_baru,
            ref_po_id,
            catatan,
            changed_by,
            changed_at
          ) VALUES (
            v_bb_id,
            v_old_harga,
            v_harga_trima,
            p_po_id,
            'Update dari penerimaan PO ' || v_nomor_po || ' (' || v_incoming || ' ' || v_satuan || ')',
            auth.uid(),
            NOW()
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 4. Hitung status kelengkapan seluruh item pada PO
  SELECT
    COALESCE(SUM(qty_pesan), 0),
    COALESCE(SUM(COALESCE(qty_terima, 0)), 0),
    BOOL_AND(COALESCE(qty_terima, 0) >= qty_pesan),
    BOOL_OR(COALESCE(qty_terima, 0) > 0)
  INTO
    v_total_pesan,
    v_total_terima,
    v_all_completed,
    v_has_any_received
  FROM public.purchase_order_item
  WHERE purchase_order_id = p_po_id;

  IF v_all_completed AND v_total_pesan > 0 THEN
    v_new_status := 'diterima_lengkap';
  ELSIF v_has_any_received THEN
    v_new_status := 'sebagian_diterima';
  ELSE
    v_new_status := 'dikirim_ke_supplier';
  END IF;

  -- Update status PO dan tanggal jatuh tempo
  UPDATE public.purchase_order po
  SET
    status            = v_new_status,
    diverifikasi_oleh = auth.uid(),
    diverifikasi_at   = COALESCE(po.diverifikasi_at, NOW()),
    jatuh_tempo       = COALESCE(po.jatuh_tempo, NOW()::date + COALESCE(s.termin_hari, 0))
  FROM public.supplier s
  WHERE po.id = p_po_id
    AND po.supplier_id = s.id;

  -- Jika supplier tidak terhubung ke tabel supplier
  UPDATE public.purchase_order
  SET
    status            = v_new_status,
    diverifikasi_oleh = auth.uid(),
    diverifikasi_at   = COALESCE(diverifikasi_at, NOW())
  WHERE id = p_po_id AND jatuh_tempo IS NULL;

  RETURN jsonb_build_object(
    'success',      true,
    'status',       v_new_status,
    'message',      CASE 
                      WHEN v_new_status = 'diterima_lengkap' THEN 'Seluruh pesanan PO telah diterima lengkap.'
                      ELSE 'Penerimaan bertahap berhasil dicatat. Status PO: Sebagian Diterima.'
                    END,
    'total_pesan',  v_total_pesan,
    'total_terima', v_total_terima
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verifikasi_terima_po(UUID, JSONB) TO authenticated;
