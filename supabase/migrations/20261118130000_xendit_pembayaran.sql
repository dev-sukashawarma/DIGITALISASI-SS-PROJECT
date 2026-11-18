-- Validasi Xendit di Histori Transaksi (spec 2026-11-18-validasi-xendit-histori-transaksi).
-- Satu baris = satu pembayaran masuk di Xendit, ditautkan ke pesanan website lewat
-- external_order_id (= id pesanan Order Online). Diisi webhook FormOrder dan unggahan
-- file Balance History. Murni label — tidak dibaca laporan omzet mana pun.

CREATE TABLE IF NOT EXISTS public.xendit_pembayaran (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xendit_id         text NOT NULL UNIQUE,          -- = CSV "Transaction ID"
  xendit_ref        text,                          -- = CSV "Reference"
  ref_qris          text,                          -- = CSV "Channel Reference" (RRN)
  nominal           numeric NOT NULL,
  dibayar_at        timestamptz NOT NULL,
  channel           text,
  external_order_id text,                          -- tidak unik: bayar dobel
  cara_cocok        text CHECK (cara_cocok IN ('webhook','file_id','file_nominal_jam','manual')),
  bukan_penjualan   boolean NOT NULL DEFAULT false,
  outlet_id         uuid REFERENCES public.outlets(id),
  nama_pelanggan    text,
  ringkasan_item    text,
  sumber            text NOT NULL CHECK (sumber IN ('webhook','file')),
  nama_file         text,
  diimpor_at        timestamptz NOT NULL DEFAULT now(),
  diimpor_oleh      uuid
);

CREATE INDEX IF NOT EXISTS xendit_pembayaran_external_order_id_idx ON public.xendit_pembayaran (external_order_id);
CREATE INDEX IF NOT EXISTS xendit_pembayaran_dibayar_at_idx ON public.xendit_pembayaran (dibayar_at);

ALTER TABLE public.xendit_pembayaran ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.xendit_pembayaran FROM anon, authenticated;
GRANT SELECT ON public.xendit_pembayaran TO authenticated;
GRANT ALL ON public.xendit_pembayaran TO service_role;

DROP POLICY IF EXISTS xendit_pembayaran_baca ON public.xendit_pembayaran;
CREATE POLICY xendit_pembayaran_baca ON public.xendit_pembayaran
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role IN ('owner','admin','admin_finance','admin_hr','developer')
  ));
