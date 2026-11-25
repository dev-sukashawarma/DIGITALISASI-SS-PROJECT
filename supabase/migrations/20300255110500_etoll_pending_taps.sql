-- Migration: 20300255110500_etoll_pending_taps.sql
-- Menyimpan tap NFC kartu yang belum terdaftar (TTL pendek) agar modal
-- "Daftarkan Kartu e-Toll Baru" di Web Finance otomatis terisi nomor kartu, bank, & saldo.

CREATE TABLE IF NOT EXISTS public.etoll_pending_taps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT NOT NULL UNIQUE,
  issuer TEXT NOT NULL CHECK (issuer IN ('mandiri_emoney', 'bca_flazz', 'bni_tapcash', 'bri_brizzi')),
  balance BIGINT NOT NULL DEFAULT 0,
  tapped_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  tapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etoll_pending_taps_time ON public.etoll_pending_taps(tapped_at DESC);

ALTER TABLE public.etoll_pending_taps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etoll_pending_taps_finance"
  ON public.etoll_pending_taps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin', 'owner', 'admin_finance', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin', 'owner', 'admin_finance', 'developer')
    )
  );

NOTIFY pgrst, 'reload schema';
