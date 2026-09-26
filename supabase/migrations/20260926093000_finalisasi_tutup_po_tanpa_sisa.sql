-- supabase/migrations/20260926093000_finalisasi_tutup_po_tanpa_sisa.sql
--
-- Mendukung Finalisasi / Penutupan PO Parsial (Short-Close) tanpa menambah stok semu:
-- 1. Penyesuaian po_status_transition_guard: Mengizinkan transisi sebagian_diterima -> diterima_lengkap
--    bagi pengguna yang memiliki wewenang can_manage_po() (purchasing, admin_finance, admin, owner, kitchen).
-- 2. Fungsi RPC baru: finalisasi_tutup_po(p_po_id, p_alasan) untuk menutup PO langsung
--    tanpa menulis ledger stok apa pun untuk barang sisa.

-- 1. Perbarui trigger guard transisi status PO
CREATE OR REPLACE FUNCTION public.po_status_transition_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
    IF NEW.status = 'dikirim_ke_supplier' AND NOT public.can_approve_po() THEN
      RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat menyetujui & mengirim PO ke supplier'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Penutupan / finalisasi PO yang sudah sebagian diterima:
    -- Boleh dilakukan oleh purchasing, admin_finance, admin, owner, atau kitchen (can_manage_po).
    IF NEW.status = 'diterima_lengkap' AND OLD.status = 'sebagian_diterima' THEN
      IF NOT (public.can_verify_po_receipt() OR public.can_manage_po()) THEN
        RAISE EXCEPTION 'Hanya tim purchasing, finance, kitchen, atau admin yang dapat memfinalisasi PO'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.status IN ('sebagian_diterima', 'diterima_lengkap')
       AND NOT public.can_verify_po_receipt() THEN
      RAISE EXCEPTION 'Hanya kitchen/admin/owner yang dapat menandai PO diterima'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Fungsi RPC finalisasi_tutup_po
CREATE OR REPLACE FUNCTION public.finalisasi_tutup_po(
  p_po_id UUID,
  p_alasan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po RECORD;
  v_staff_name TEXT;
  v_catatan_baru TEXT;
  v_alasan_clean TEXT;
BEGIN
  -- 1. Validasi hak akses
  IF NOT public.can_manage_po() THEN
    RAISE EXCEPTION 'Hanya tim Purchasing, Finance, atau Admin yang dapat memfinalisasi penutupan PO'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validasi alasan
  v_alasan_clean := btrim(COALESCE(p_alasan, ''));
  IF v_alasan_clean = '' THEN
    RAISE EXCEPTION 'Alasan penutupan PO wajib diisi'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Ambil data PO
  SELECT id, nomor_po, status, catatan, diverifikasi_at, diverifikasi_oleh, supplier_id, jatuh_tempo
  INTO v_po
  FROM public.purchase_order
  WHERE id = p_po_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan';
  END IF;

  IF v_po.status = 'diterima_lengkap' THEN
    RAISE EXCEPTION 'Purchase Order % sudah berstatus diterima lengkap', v_po.nomor_po;
  END IF;

  IF v_po.status = 'dibatalkan' THEN
    RAISE EXCEPTION 'Purchase Order % sudah dibatalkan', v_po.nomor_po;
  END IF;

  IF v_po.status NOT IN ('sebagian_diterima', 'dikirim_ke_supplier') THEN
    RAISE EXCEPTION 'Hanya PO yang berstatus dikirim ke supplier atau sebagian diterima yang dapat difinalisasi';
  END IF;

  -- Ambil nama staff pemanggil
  SELECT name INTO v_staff_name
  FROM public.outlet_staff
  WHERE id = auth.uid();

  -- Format catatan audit
  v_catatan_baru := CASE
    WHEN v_po.catatan IS NOT NULL AND btrim(v_po.catatan) <> '' THEN
      v_po.catatan || E'\n\n'
    ELSE ''
  END || '[FINALISASI SELESAI TANPA SISA]: ' || v_alasan_clean ||
    ' (oleh ' || COALESCE(v_staff_name, 'Staff') || ' pada ' ||
    to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') || ' WIB)';

  -- 4. Update PO menjadi diterima_lengkap
  -- SAMA SEKALI TIDAK MENULIS LEDGER STOK UNTUK BARANG SISA.
  UPDATE public.purchase_order po
  SET
    status            = 'diterima_lengkap',
    catatan           = v_catatan_baru,
    diverifikasi_oleh = COALESCE(po.diverifikasi_oleh, auth.uid()),
    diverifikasi_at   = COALESCE(po.diverifikasi_at, NOW()),
    jatuh_tempo       = COALESCE(po.jatuh_tempo, NOW()::date + COALESCE(s.termin_hari, 0)),
    updated_at        = NOW()
  FROM public.supplier s
  WHERE po.id = p_po_id
    AND po.supplier_id = s.id;

  -- Fallback jika supplier_id null / tidak match tabel supplier
  UPDATE public.purchase_order
  SET
    status            = 'diterima_lengkap',
    catatan           = v_catatan_baru,
    diverifikasi_oleh = COALESCE(diverifikasi_oleh, auth.uid()),
    diverifikasi_at   = COALESCE(diverifikasi_at, NOW()),
    updated_at        = NOW()
  WHERE id = p_po_id
    AND status <> 'diterima_lengkap';

  RETURN jsonb_build_object(
    'success', true,
    'nomor_po', v_po.nomor_po,
    'status', 'diterima_lengkap',
    'message', 'PO ' || v_po.nomor_po || ' berhasil difinalisasi menjadi Diterima Lengkap tanpa menambah stok sisa.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalisasi_tutup_po(UUID, TEXT) TO authenticated;
