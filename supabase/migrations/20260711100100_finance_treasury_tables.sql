-- 20260711100100_finance_treasury_tables.sql
-- M5 Finance: buku besar kas. cash_location (bank ATAU kas fisik) + cash_transaction
-- (bertanda) + cash_balance (saldo per-lokasi, dijaga trigger atomik meniru stok_balance).

-- 1. Lokasi uang: rekening bank ATAU kas fisik (mis. "Kas Pusat / Brankas")
CREATE TABLE IF NOT EXISTS public.cash_location (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('bank', 'cash')),
  bank_name    text,
  account_no   text,
  holder_name  text,
  scope        text NOT NULL DEFAULT 'pusat' CHECK (scope IN ('pusat', 'outlet')),
  outlet_id    uuid REFERENCES public.outlets(id),
  is_active    boolean NOT NULL DEFAULT true,
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Buku besar kas. amount selalu > 0; direction menentukan tanda; signed_amount generated.
CREATE TABLE IF NOT EXISTS public.cash_transaction (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_location_id uuid NOT NULL REFERENCES public.cash_location(id),
  direction    text NOT NULL CHECK (direction IN ('in', 'out')),
  amount       numeric NOT NULL CHECK (amount > 0),
  signed_amount numeric GENERATED ALWAYS AS (CASE WHEN direction = 'in' THEN amount ELSE -amount END) STORED,
  category     text,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  note         text,
  source_type  text NOT NULL DEFAULT 'manual'
                 CHECK (source_type IN ('payroll','supplier_po','expense_pusat','kasbon','cash_deposit','manual','transfer')),
  source_id    uuid,
  counter_transaction_id uuid REFERENCES public.cash_transaction(id),  -- kaki lawan utk transfer dua-kaki
  status       text NOT NULL DEFAULT 'pending_approval'
                 CHECK (status IN ('draft','pending_approval','approved','paid','reconciled','rejected','void')),
  -- Fase B (disbursement API) — nullable sampai P5
  gateway        text,
  gateway_ref    text,
  gateway_status text,
  disbursed_at   timestamptz,
  -- rekonsiliasi
  proof_url      text,
  reconciled_by  uuid REFERENCES public.outlet_staff(id),
  reconciled_at  timestamptz,
  -- audit maker-checker
  created_by   uuid REFERENCES public.outlet_staff(id),
  approved_by  uuid REFERENCES public.outlet_staff(id),
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_tx_location ON public.cash_transaction(cash_location_id);
CREATE INDEX IF NOT EXISTS idx_cash_tx_status   ON public.cash_transaction(status);
CREATE INDEX IF NOT EXISTS idx_cash_tx_source   ON public.cash_transaction(source_type, source_id);

-- 3. Saldo berjalan per lokasi.
CREATE TABLE IF NOT EXISTS public.cash_balance (
  cash_location_id uuid PRIMARY KEY REFERENCES public.cash_location(id),
  saldo      numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Trigger saldo atomik. Saldo hanya bergerak saat transaksi mencapai status yang
--    "mempengaruhi kas": 'paid' atau 'reconciled'. draft/pending/approved TIDAK mengubah saldo.
--    Increment relatif via upsert ON CONFLICT (row-lock) — anti lost-update (lih. 20260708100001).
--    WAJIB SECURITY DEFINER: 'authenticated' tak punya policy tulis cash_balance.
CREATE OR REPLACE FUNCTION public.cash_apply_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE loc uuid; delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- hanya terapkan bila lahir langsung sebagai paid/reconciled (mis. transfer dua-kaki)
    IF NEW.status IN ('paid','reconciled') THEN
      loc := NEW.cash_location_id; delta := NEW.signed_amount;
    ELSE RETURN NEW; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- transisi MASUK ke paid/reconciled (dari status non-kas) → terapkan
    IF NEW.status IN ('paid','reconciled') AND OLD.status NOT IN ('paid','reconciled') THEN
      loc := NEW.cash_location_id; delta := NEW.signed_amount;
    -- transisi KELUAR dari paid/reconciled (mis. void) → balikkan
    ELSIF OLD.status IN ('paid','reconciled') AND NEW.status NOT IN ('paid','reconciled') THEN
      loc := OLD.cash_location_id; delta := -OLD.signed_amount;
    ELSE RETURN NEW; END IF;
  END IF;

  INSERT INTO public.cash_balance (cash_location_id, saldo, updated_at)
  VALUES (loc, delta, now())
  ON CONFLICT (cash_location_id)
  DO UPDATE SET saldo = public.cash_balance.saldo + EXCLUDED.saldo, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_apply_balance ON public.cash_transaction;
CREATE TRIGGER trg_cash_apply_balance
  AFTER INSERT OR UPDATE OF status ON public.cash_transaction
  FOR EACH ROW EXECUTE FUNCTION public.cash_apply_balance();

-- DOWN: DROP TRIGGER/FUNCTION cash_apply_balance; DROP TABLE cash_balance, cash_transaction, cash_location CASCADE;
