-- Migration: 20300255110000_etoll_tracking_module.sql
-- Modul Monitoring & Audit Kartu e-Toll (Mandiri e-Money, BCA Flazz, BNI TapCash, BRI Brizzi)
-- Terpisah dari pembukuan CashLocation/Laba Rugi untuk menghindari double-counting top-up.

-- 1. Master Kartu e-Toll Perusahaan
CREATE TABLE IF NOT EXISTS public.etoll_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT NOT NULL UNIQUE,
  issuer TEXT NOT NULL CHECK (issuer IN ('mandiri_emoney', 'bca_flazz', 'bni_tapcash', 'bri_brizzi')),
  label TEXT NOT NULL,
  holder_staff_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  division TEXT,
  vehicle_plate TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lost')),
  last_balance BIGINT NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  last_scanned_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etoll_cards_holder ON public.etoll_cards(holder_staff_id);
CREATE INDEX IF NOT EXISTS idx_etoll_cards_outlet ON public.etoll_cards(outlet_id);
CREATE INDEX IF NOT EXISTS idx_etoll_cards_status ON public.etoll_cards(status);

-- 2. Riwayat Serah-Terima Pemegang Kartu
CREATE TABLE IF NOT EXISTS public.etoll_card_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.etoll_cards(id) ON DELETE CASCADE,
  from_staff_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  to_staff_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  from_vehicle_plate TEXT,
  to_vehicle_plate TEXT,
  balance_at_handover BIGINT,
  note TEXT,
  assigned_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etoll_card_assignments_card ON public.etoll_card_assignments(card_id, assigned_at DESC);

-- 3. Log Aktivitas Scan NFC
CREATE TABLE IF NOT EXISTS public.etoll_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.etoll_cards(id) ON DELETE CASCADE,
  scanned_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  balance_before BIGINT,
  balance_after BIGINT NOT NULL,
  chip_records_found INTEGER NOT NULL DEFAULT 0,
  new_transactions_count INTEGER NOT NULL DEFAULT 0,
  untracked_gap_amount BIGINT NOT NULL DEFAULT 0,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  device_info TEXT,
  raw_diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etoll_scans_card ON public.etoll_scans(card_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_etoll_scans_by ON public.etoll_scans(scanned_by, scanned_at DESC);

-- 4. Kamus Kode Terminal / Gerbang Tol / Merchant (Learnable)
CREATE TABLE IF NOT EXISTS public.etoll_terminal_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer TEXT NOT NULL DEFAULT 'all' CHECK (issuer IN ('mandiri_emoney', 'bca_flazz', 'bni_tapcash', 'bri_brizzi', 'all')),
  terminal_code TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  default_category TEXT NOT NULL DEFAULT 'tol' CHECK (
    default_category IN ('tol', 'parkir', 'bbm_merchant', 'operasional_lain', 'pribadi_anomali', 'topup')
  ),
  notes TEXT,
  updated_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issuer, terminal_code)
);

CREATE INDEX IF NOT EXISTS idx_etoll_terminal_dict_code ON public.etoll_terminal_dictionary(terminal_code);

-- 5. Transaksi Permanen (Hasil Deduplikasi Chip + Baris Selisih Saldo Tak Terlacak)
CREATE TABLE IF NOT EXISTS public.etoll_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.etoll_cards(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.etoll_scans(id) ON DELETE SET NULL,
  holder_staff_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'chip' CHECK (source IN ('chip', 'untracked_gap', 'manual')),
  tx_type TEXT NOT NULL CHECK (tx_type IN ('debit', 'topup')),
  dedup_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  balance_after BIGINT,
  terminal_code TEXT,
  merchant_label TEXT,
  category TEXT NOT NULL DEFAULT 'belum_dikategorikan' CHECK (
    category IN (
      'belum_dikategorikan',
      'tol',
      'parkir',
      'bbm_merchant',
      'operasional_lain',
      'pribadi_anomali',
      'topup',
      'untracked_gap'
    )
  ),
  note TEXT,
  tagged_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  tagged_at TIMESTAMPTZ,
  raw_hex TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_etoll_tx_card_occurred ON public.etoll_transactions(card_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_etoll_tx_occurred ON public.etoll_transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_etoll_tx_holder ON public.etoll_transactions(holder_staff_id);
CREATE INDEX IF NOT EXISTS idx_etoll_tx_category ON public.etoll_transactions(category);
CREATE INDEX IF NOT EXISTS idx_etoll_tx_terminal ON public.etoll_transactions(terminal_code) WHERE terminal_code IS NOT NULL;

-- 6. Catatan Pemberian Top-Up Finance & Rekonsiliasi Otomatis terhadap Chip
CREATE TABLE IF NOT EXISTS public.etoll_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.etoll_cards(id) ON DELETE CASCADE,
  topup_date DATE NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  funding_source TEXT,
  reference_no TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'waiting_scan' CHECK (status IN ('waiting_scan', 'matched', 'mismatch', 'void')),
  matched_transaction_id UUID REFERENCES public.etoll_transactions(id) ON DELETE SET NULL,
  matched_scan_id UUID REFERENCES public.etoll_scans(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ,
  mismatch_note TEXT,
  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etoll_topups_card_status ON public.etoll_topups(card_id, status, topup_date DESC);

-- RLS Policies
ALTER TABLE public.etoll_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etoll_card_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etoll_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etoll_terminal_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etoll_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etoll_topups ENABLE ROW LEVEL SECURITY;

-- Helper expression: Finance/Admin roles (konsisten dengan useFinanceRole.ts)
CREATE POLICY "etoll_cards_select_authenticated"
  ON public.etoll_cards FOR SELECT TO authenticated USING (true);

CREATE POLICY "etoll_cards_write_finance"
  ON public.etoll_cards FOR ALL TO authenticated
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

CREATE POLICY "etoll_assignments_select_finance"
  ON public.etoll_card_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin', 'owner', 'admin_finance', 'developer')
    )
  );

CREATE POLICY "etoll_assignments_write_finance"
  ON public.etoll_card_assignments FOR ALL TO authenticated
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

CREATE POLICY "etoll_scans_select_authenticated"
  ON public.etoll_scans FOR SELECT TO authenticated USING (true);

CREATE POLICY "etoll_scans_write_finance"
  ON public.etoll_scans FOR ALL TO authenticated
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

CREATE POLICY "etoll_dictionary_select_authenticated"
  ON public.etoll_terminal_dictionary FOR SELECT TO authenticated USING (true);

CREATE POLICY "etoll_dictionary_write_finance"
  ON public.etoll_terminal_dictionary FOR ALL TO authenticated
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

CREATE POLICY "etoll_transactions_select_authenticated"
  ON public.etoll_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "etoll_transactions_write_finance"
  ON public.etoll_transactions FOR ALL TO authenticated
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

CREATE POLICY "etoll_topups_select_finance"
  ON public.etoll_topups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin', 'owner', 'admin_finance', 'developer')
    )
  );

CREATE POLICY "etoll_topups_write_finance"
  ON public.etoll_topups FOR ALL TO authenticated
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
