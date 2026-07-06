-- 20260707100600_po_rpcs.sql
-- RPC untuk modul Purchase Order.
-- Semua RPC menggunakan SECURITY DEFINER agar bisa bypass RLS saat diperlukan
-- (ledger_stok ditulis oleh trigger — RPC hanya buat/update PO).
--
-- RPCs:
--   1. create_purchase_order(p_supplier_id, p_supplier_nama, p_tanggal_po, p_items, p_catatan)
--      → Buat PO + items sekaligus, generate nomor PO otomatis. Return purchase_order.
--
--   2. verifikasi_terima_po(p_po_id, p_items)
--      → Verifikasi penerimaan: isi qty_terima + harga_terima per item,
--        ubah status PO, trigger otomatis jalankan ledger + price update.
--
--   3. get_purchase_orders(p_from, p_to, p_status)
--      → List PO per periode + total nilai, dipakai UI list page.

-- ============================================================
-- 1. create_purchase_order
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id    UUID,         -- boleh NULL jika supplier tidak ada di master
  p_supplier_nama  TEXT,         -- nama supplier (wajib)
  p_tanggal_po     DATE DEFAULT CURRENT_DATE,
  p_items          JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ "bahan_baku_id": "uuid", "qty_pesan": 10, "harga_pesan": 38000 }, ...]
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
    RAISE EXCEPTION 'Hanya admin atau kitchen yang dapat membuat Purchase Order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Validasi input
  IF p_supplier_nama IS NULL OR TRIM(p_supplier_nama) = '' THEN
    RAISE EXCEPTION 'Nama supplier wajib diisi';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Minimal 1 item bahan baku wajib ada';
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
      qty_pesan,
      harga_pesan
    ) VALUES (
      v_po.id,
      (v_item->>'bahan_baku_id')::UUID,
      (v_item->>'qty_pesan')::NUMERIC,
      COALESCE((v_item->>'harga_pesan')::NUMERIC, 0)
    );
  END LOOP;

  RETURN v_po;
END;
$$;

-- ============================================================
-- 2. verifikasi_terima_po
-- ============================================================
CREATE OR REPLACE FUNCTION public.verifikasi_terima_po(
  p_po_id  UUID,
  p_items  JSONB
  -- Format: [{ "bahan_baku_id": "uuid", "qty_terima": 9.5, "harga_terima": 39000, "kondisi": "baik" }, ...]
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
    RAISE EXCEPTION 'Hanya admin atau kitchen yang dapat verifikasi Purchase Order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ambil status PO
  SELECT status INTO v_status
    FROM public.purchase_order WHERE id = p_po_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan';
  END IF;

  IF v_status IN ('diterima_lengkap', 'dibatalkan') THEN
    RAISE EXCEPTION 'Purchase Order sudah % — tidak dapat diverifikasi ulang', v_status;
  END IF;

  -- Update qty_terima + harga_terima per item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.purchase_order_item
    SET
      qty_terima   = (v_item->>'qty_terima')::NUMERIC,
      harga_terima = NULLIF((v_item->>'harga_terima')::NUMERIC, 0),
      kondisi      = COALESCE(v_item->>'kondisi', 'baik'),
      catatan      = v_item->>'catatan'
    WHERE purchase_order_id = p_po_id
      AND bahan_baku_id = (v_item->>'bahan_baku_id')::UUID;
  END LOOP;

  -- Tentukan status baru berdasarkan kelengkapan
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE qty_terima IS NOT NULL)
  INTO v_total_items, v_total_ok
  FROM public.purchase_order_item
  WHERE purchase_order_id = p_po_id;

  IF v_total_ok = 0 THEN
    -- Belum ada yang diverifikasi — tidak update status
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Tidak ada item yang diverifikasi'
    );
  ELSIF v_total_ok < v_total_items THEN
    v_new_status := 'sebagian_diterima';
  ELSE
    v_new_status := 'diterima_lengkap';
  END IF;

  -- Update status PO — ini yang memicu trigger po_on_verified
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

-- ============================================================
-- 3. get_purchase_orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_purchase_orders(
  p_from   DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to     DATE DEFAULT CURRENT_DATE,
  p_status TEXT DEFAULT NULL   -- NULL = semua status
)
RETURNS TABLE (
  id                UUID,
  nomor_po          TEXT,
  supplier_nama     TEXT,
  tanggal_po        DATE,
  status            TEXT,
  total_nilai       NUMERIC,
  jumlah_item       BIGINT,
  nama_dibuat_oleh  TEXT,
  created_at        TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    po.id,
    po.nomor_po,
    po.supplier_nama,
    po.tanggal_po,
    po.status,
    COALESCE(SUM(poi.subtotal), 0) AS total_nilai,
    COUNT(poi.id)                  AS jumlah_item,
    s.name                         AS nama_dibuat_oleh,
    po.created_at
  FROM public.purchase_order po
  LEFT JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
  LEFT JOIN public.outlet_staff s          ON s.id = po.dibuat_oleh
  WHERE po.tanggal_po BETWEEN p_from AND p_to
    AND (p_status IS NULL OR po.status = p_status)
    AND public.can_manage_po()
  GROUP BY po.id, po.nomor_po, po.supplier_nama, po.tanggal_po,
           po.status, s.name, po.created_at
  ORDER BY po.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.verifikasi_terima_po  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_orders   TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_nomor_po     TO authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.create_purchase_order CASCADE;
-- DROP FUNCTION IF EXISTS public.verifikasi_terima_po  CASCADE;
-- DROP FUNCTION IF EXISTS public.get_purchase_orders   CASCADE;
