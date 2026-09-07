-- Migration: 20260905140000_allow_cancel_draft_surat_jalan.sql
-- Description: Allow cancelling draft Surat Jalan / PO in Distribusi, with optional reason and sync to linked permintaan_bahan
-- Batasan Akses: Hanya berlaku untuk role 'kitchen', 'purchasing', dan 'admin' (serta 'owner').

-- 1. Update check constraint on surat_jalan status to include 'dibatalkan'
ALTER TABLE public.surat_jalan DROP CONSTRAINT IF EXISTS surat_jalan_status_check;

ALTER TABLE public.surat_jalan ADD CONSTRAINT surat_jalan_status_check
  CHECK (status IN ('draft', 'dikirim', 'dikirim_lengkap', 'diterima_sebagian', 'diterima_lengkap', 'selesai', 'dibatalkan'));

-- 2. Create RPC function to cancel draft surat jalan
CREATE OR REPLACE FUNCTION public.batalkan_surat_jalan_draft(
  p_surat_jalan_id UUID,
  p_alasan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj RECORD;
  v_caller_role TEXT;
  v_pb RECORD;
  v_debit NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- 1. Lock and fetch surat_jalan
  SELECT * INTO v_sj
  FROM surat_jalan
  WHERE id = p_surat_jalan_id
  FOR UPDATE;

  IF v_sj.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Surat Jalan tidak ditemukan');
  END IF;

  -- 2. Verify status is draft
  IF v_sj.status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Hanya dokumen berstatus draft yang dapat dibatalkan. Status saat ini: ' || v_sj.status
    );
  END IF;

  -- 3. Check authorization: Hanya role kitchen, purchasing, dan admin (serta owner)
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('kitchen', 'purchasing', 'admin', 'owner') THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Tidak memiliki hak akses. Hanya role kitchen, purchasing, dan admin yang dapat membatalkan PO.'
      );
    END IF;
  END IF;

  -- 4. Update surat_jalan status to dibatalkan
  UPDATE surat_jalan
  SET status = 'dibatalkan',
      notes = CASE 
        WHEN p_alasan IS NOT NULL AND trim(p_alasan) != '' THEN 
          COALESCE(notes || E'\n', '') || '[Dibatalkan]: ' || trim(p_alasan)
        ELSE COALESCE(notes || E'\n', '') || '[Dibatalkan]'
      END,
      updated_at = NOW()
  WHERE id = p_surat_jalan_id;

  -- 5. Handle linked permintaan_bahan if exists
  FOR v_pb IN
    SELECT id, outlet_id, catatan_kitchen
    FROM permintaan_bahan
    WHERE surat_jalan_id = p_surat_jalan_id
  LOOP
    UPDATE permintaan_bahan
    SET status = 'dibatalkan',
        catatan_kitchen = CASE 
          WHEN p_alasan IS NOT NULL AND trim(p_alasan) != '' THEN 
            COALESCE(catatan_kitchen || E'\n', '') || '[PO Dibatalkan di Distribusi]: ' || trim(p_alasan)
          ELSE COALESCE(catatan_kitchen || E'\n', '') || '[PO Dibatalkan di Distribusi]'
        END,
        updated_at = NOW()
    WHERE id = v_pb.id;

    -- Kembalikan saldo dompet outlet jika ada transaksi MATERIAL_PURCHASE
    SELECT debit INTO v_debit
    FROM outlet_balance_ledger
    WHERE reference_id = v_pb.id AND transaction_type = 'MATERIAL_PURCHASE'
    LIMIT 1;

    IF v_debit IS NOT NULL AND v_debit > 0 THEN
      UPDATE outlet_balance
      SET current_balance = current_balance + v_debit, updated_at = NOW()
      WHERE outlet_id = v_pb.outlet_id
      RETURNING current_balance INTO v_new_balance;

      INSERT INTO outlet_balance_ledger (outlet_id, transaction_type, reference_id, credit, debit, balance_after)
      VALUES (v_pb.outlet_id, 'TOP_UP', v_pb.id, v_debit, 0, v_new_balance);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'PO / Surat Jalan draft berhasil dibatalkan'
  );
END;
$$;
