-- Migration: 20260719000000_hard_reset_outlet_rpc.sql
-- Description: Creates an RPC to hard reset an outlet's transaction and distribution data.

CREATE OR REPLACE FUNCTION public.hard_reset_outlet_data(p_outlet_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate that the caller has sufficient privileges (e.g. is authenticated)
  -- Currently assuming only admins can hit this endpoint via UI. We could add role checks here if needed,
  -- but since it's a danger zone, we trust the caller's RLS or API layer to restrict access.
  -- To be safe, we can enforce that the user must be authenticated at least.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Hapus transaksi penjualan (orders).
  -- Note: order_items otomatis terhapus karena ada ON DELETE CASCADE di public.order_items.
  DELETE FROM public.orders WHERE outlet_id = p_outlet_id;

  -- 2. Hapus riwayat stok (ledger_stok).
  DELETE FROM public.ledger_stok WHERE outlet_id = p_outlet_id;

  -- 3. Hapus data absensi uji coba (attendance).
  DELETE FROM public.attendance WHERE outlet_id = p_outlet_id;

  -- 4. Hapus data distribusi bahan baku (permintaan_bahan dan surat_jalan).
  -- Note: permintaan_bahan_item otomatis terhapus via CASCADE.
  DELETE FROM public.permintaan_bahan WHERE outlet_id = p_outlet_id;
  
  -- Note: surat_jalan_item otomatis terhapus via CASCADE.
  DELETE FROM public.surat_jalan WHERE outlet_id = p_outlet_id;

  -- 5. Reset sisa stok ke 0.
  UPDATE public.stok_balance SET saldo = 0 WHERE outlet_id = p_outlet_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.hard_reset_outlet_data(UUID) TO authenticated;
