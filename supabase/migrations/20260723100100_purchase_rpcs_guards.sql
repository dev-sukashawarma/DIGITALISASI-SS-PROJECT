-- 20260723100100_purchase_rpcs_guards.sql
-- Guards pemisahan tugas + approval finance + riwayat harga.
-- Basis fungsi D (verifikasi_terima_po) & F (po_on_verified) disalin apa adanya dari DB live
-- (definisi terkini termasuk HQ/Gudang Pusat fix), lalu diberi perubahan bedah minimal.

-- ============================================================================
-- A) can_manage_po: compose/create/kirim PO. Tambah 'purchase'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_manage_po()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin','kitchen','purchase'));
$$;

-- ============================================================================
-- B) can_verify_po_receipt: HANYA yang boleh commit terima. TOLAK purchase.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_verify_po_receipt()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('kitchen','admin','owner'));
$$;

-- ============================================================================
-- C) can_approve_po: gerbang approval finance.
--    JANGAN pakai is_finance() (true untuk semua authenticated — bukan gate role).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_approve_po()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin_finance','owner','admin'));
$$;

-- ============================================================================
-- D) verifikasi_terima_po: definisi live utuh, HANYA guard di awal diganti
--    dari can_manage_po() ke can_verify_po_receipt() (tolak purchase).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verifikasi_terima_po(p_po_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status      TEXT;
  v_item        JSONB;
  v_total_items INT;
  v_total_ok    INT;
  v_new_status  TEXT;
BEGIN
  -- Validasi akses (pemisahan tugas: purchase TIDAK boleh verifikasi terima)
  IF NOT public.can_verify_po_receipt() THEN
    RAISE EXCEPTION 'Hanya kitchen/admin/owner yang dapat verifikasi terima PO'
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
$function$;

-- ============================================================================
-- E) approve_po_finance / reject_po_finance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_po_finance(p_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.can_approve_po() THEN
    RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat approve PO'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO v_status FROM public.purchase_order WHERE id = p_po_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_status <> 'menunggu_approval_finance' THEN
    RAISE EXCEPTION 'PO tidak dalam status menunggu approval (status: %)', v_status;
  END IF;
  UPDATE public.purchase_order
    SET status = 'dikirim_ke_supplier',
        disetujui_finance_oleh = auth.uid(),
        disetujui_finance_at = now(),
        updated_at = now()
    WHERE id = p_po_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_po_finance(p_po_id uuid, p_alasan text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.can_approve_po() THEN
    RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat menolak PO'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO v_status FROM public.purchase_order WHERE id = p_po_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_status <> 'menunggu_approval_finance' THEN
    RAISE EXCEPTION 'PO tidak dalam status menunggu approval (status: %)', v_status;
  END IF;
  UPDATE public.purchase_order
    SET status = 'draft',
        catatan = COALESCE(catatan,'') || CASE WHEN p_alasan IS NOT NULL
                    THEN E'\n[Ditolak finance] ' || p_alasan ELSE '' END,
        updated_at = now()
    WHERE id = p_po_id;
END; $$;

-- ============================================================================
-- F) po_on_verified: definisi live utuh (termasuk HQ/Gudang Pusat id),
--    dengan DUA sisipan:
--      (1) tulis riwayat harga (bahan_baku_harga_history) SEBELUM upsert harga,
--          LEFT JOIN agar harga_lama NULL bila belum ada baris harga sebelumnya.
--      (2) setelah loop, set jatuh_tempo dari termin supplier (hanya bila NULL).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.po_on_verified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- b1) Catat riwayat perubahan harga SEBELUM upsert.
        --     LEFT JOIN → harga_lama NULL bila belum ada baris harga sebelumnya.
        INSERT INTO public.bahan_baku_harga_history (
          bahan_baku_id, harga_lama, harga_baru, ref_po_id, changed_by
        )
        SELECT v_item.bahan_baku_id, bh.harga_beli, v_item.harga_terima, NEW.id, NEW.diverifikasi_oleh
        FROM (SELECT 1) _x
        LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = v_item.bahan_baku_id;

        -- b2) Upsert harga beli master
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

    -- c) Set jatuh_tempo dari termin supplier (hanya bila belum diisi)
    UPDATE public.purchase_order po
      SET jatuh_tempo = NEW.diverifikasi_at::date + COALESCE(s.termin_hari, 0)
      FROM public.supplier s
      WHERE po.id = NEW.id
        AND po.supplier_id = s.id
        AND po.jatuh_tempo IS NULL;

    RETURN NEW;
  END;
  $function$;
