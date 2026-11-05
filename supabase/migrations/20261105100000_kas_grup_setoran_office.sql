-- Kas Setoran Outlet vs Kas Office (spec 2026-11-05-finance-kas-setoran-office-design.md).
-- Idempoten.

-- 1. Penanda grup kas.
ALTER TABLE public.cash_location ADD COLUMN IF NOT EXISTS grup text;
ALTER TABLE public.cash_location DROP CONSTRAINT IF EXISTS cash_location_grup_check;
ALTER TABLE public.cash_location ADD CONSTRAINT cash_location_grup_check
  CHECK (grup IS NULL OR grup IN ('setoran_outlet', 'office'));

-- 2. Lokasi baru (UUID tetap, dirujuk skrip pemindahan November).
INSERT INTO public.cash_location (id, label, kind, bank_name, account_no, holder_name, scope, outlet_id,
                                  is_active, opening_balance, opening_date, grup)
VALUES
  ('b0955193-7630-4c0e-9a11-5e70a0000001', 'Rekening Setoran 0955193763', 'bank', NULL, '0955193763',
   'PT SUKA PROFIT BERKAH', 'pusat', NULL, true, 0, '2026-11-01', 'setoran_outlet'),
  ('b0955381-0040-4c0e-9a11-5e70a0000002', 'Rekening Office 0955381004', 'bank', NULL, '0955381004',
   'PT SUKA PROFIT BERKAH', 'pusat', NULL, true, 0, '2026-11-01', 'office'),
  ('b0000000-0ff1-4c0e-9a11-5e70a0000003', 'Kas Office Tunai', 'cash', NULL, NULL,
   'PT SUKA PROFIT BERKAH', 'pusat', NULL, true, 0, '2026-11-01', 'office')
ON CONFLICT (id) DO NOTHING;

-- 3. Kas Setoran lama = Kas Setoran Tunai (saldo TIDAK diubah; finance rekonsiliasi manual).
UPDATE public.cash_location SET label = 'Kas Setoran Tunai', grup = 'setoran_outlet'
 WHERE id = 'a64f9484-70e9-4bf7-b62d-2643835a1874';

-- 4. Rekening lama BCA 48523399425 ditutup (riwayat tetap).
UPDATE public.cash_location SET is_active = false, grup = NULL
 WHERE id = '0c116d5f-f147-4eff-9bc2-ce9d549e2869';

-- 5. Jenis sumber transaksi baru.
ALTER TABLE public.cash_transaction DROP CONSTRAINT IF EXISTS cash_transaction_source_type_check;
ALTER TABLE public.cash_transaction ADD CONSTRAINT cash_transaction_source_type_check
  CHECK (source_type = ANY (ARRAY['payroll','supplier_po','expense_pusat','kasbon','cash_deposit',
                                   'manual','transfer','petty_cash_topup','setor_bank','income_lain']));

-- 6. Setor ke Bank (gabungan lintas outlet).
CREATE TABLE IF NOT EXISTS public.setor_bank (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  total_diambil numeric NOT NULL CHECK (total_diambil > 0),
  nominal_bank  numeric NOT NULL CHECK (nominal_bank > 0),
  receh         numeric NOT NULL CHECK (receh >= 0),
  proof_url     text NOT NULL,
  note          text,
  created_by    uuid REFERENCES public.outlet_staff(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (total_diambil = nominal_bank + receh)
);

-- 7. Income Lainnya (pendapatan pusat).
CREATE TABLE IF NOT EXISTS public.income_lainnya (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at         timestamptz NOT NULL,
  kategori            text NOT NULL CHECK (kategori IN
                        ('minyak_jelantah','kardus_bekas','kompan_bekas','equipment_bekas','lainnya')),
  keterangan          text,
  pembeli             text NOT NULL CHECK (btrim(pembeli) <> ''),
  asal_outlet_id      uuid REFERENCES public.outlets(id),
  amount              numeric NOT NULL CHECK (amount > 0),
  cash_location_id    uuid NOT NULL REFERENCES public.cash_location(id),
  proof_url           text NOT NULL CHECK (btrim(proof_url) <> ''),
  cash_transaction_id uuid REFERENCES public.cash_transaction(id),
  status              text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','batal')),
  batal_by            uuid REFERENCES public.outlet_staff(id),
  batal_at            timestamptz,
  batal_alasan        text,
  created_by          uuid REFERENCES public.outlet_staff(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (kategori <> 'lainnya' OR btrim(coalesce(keterangan, '')) <> '')
);
CREATE INDEX IF NOT EXISTS income_lainnya_occurred_at_idx ON public.income_lainnya (occurred_at);

-- 8. Hak akses: baca untuk finance checker, tulis hanya lewat RPC.
ALTER TABLE public.setor_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_lainnya ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.setor_bank, public.income_lainnya FROM anon, authenticated;
GRANT SELECT ON public.setor_bank, public.income_lainnya TO authenticated;

DROP POLICY IF EXISTS setor_bank_read ON public.setor_bank;
CREATE POLICY setor_bank_read ON public.setor_bank FOR SELECT TO authenticated
  USING (public.is_finance_checker());
DROP POLICY IF EXISTS income_lainnya_read ON public.income_lainnya;
CREATE POLICY income_lainnya_read ON public.income_lainnya FOR SELECT TO authenticated
  USING (public.is_finance_checker());
