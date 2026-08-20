-- 20260820110001_outlet_budget_topup_ledger.sql
-- Memindahkan sistem budget outlet menjadi berbasis Ledger / Saldo Berjalan (Top-Up)

-- 1. Modifikasi outlet_budget_config
-- Hapus kolom period_type dan custom_days (kita tetap simpan 'nominal' sebagai Plafon Utama)
ALTER TABLE public.outlet_budget_config DROP COLUMN IF EXISTS period_type;
ALTER TABLE public.outlet_budget_config DROP COLUMN IF EXISTS custom_days;

-- 2. Buat tabel outlet_balance (Dompet Outlet)
CREATE TABLE IF NOT EXISTS public.outlet_balance (
  outlet_id UUID PRIMARY KEY REFERENCES public.outlets(id) ON DELETE CASCADE,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outlet_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ob_select ON public.outlet_balance;
CREATE POLICY ob_select ON public.outlet_balance FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

-- 3. Buat tabel outlet_budget_topup_requests
CREATE TABLE IF NOT EXISTS public.outlet_budget_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  requested_amount NUMERIC NOT NULL CHECK (requested_amount > 0),
  period_category TEXT NOT NULL CHECK (period_category IN ('weekday', 'weekend')),
  status TEXT NOT NULL CHECK (status IN ('pending_am', 'pending_finance', 'approved', 'rejected')) DEFAULT 'pending_am',
  created_by UUID REFERENCES public.outlet_staff(id),
  am_approved_by UUID REFERENCES public.outlet_staff(id),
  finance_approved_by UUID REFERENCES public.outlet_staff(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outlet_budget_topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ob_topup_select ON public.outlet_budget_topup_requests;
CREATE POLICY ob_topup_select ON public.outlet_budget_topup_requests FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));
  
DROP POLICY IF EXISTS ob_topup_insert ON public.outlet_budget_topup_requests;
CREATE POLICY ob_topup_insert ON public.outlet_budget_topup_requests FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT accessible_outlet_ids()));

-- 4. Buat tabel outlet_balance_ledger (Buku Kas)
CREATE TABLE IF NOT EXISTS public.outlet_balance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('TOP_UP', 'MATERIAL_PURCHASE')),
  reference_id UUID NOT NULL, -- ID dari topup request atau permintaan_bahan
  credit NUMERIC NOT NULL DEFAULT 0 CHECK (credit >= 0),
  debit NUMERIC NOT NULL DEFAULT 0 CHECK (debit >= 0),
  balance_after NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outlet_balance_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ob_ledger_select ON public.outlet_balance_ledger;
CREATE POLICY ob_ledger_select ON public.outlet_balance_ledger FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'outlet_balance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_balance;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'outlet_budget_topup_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_budget_topup_requests;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'outlet_balance_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_balance_ledger;
  END IF;
END $$;

-- 5. Ubah RPC get_outlet_budget_status
DROP FUNCTION IF EXISTS public.get_outlet_budget_status(UUID);

CREATE OR REPLACE FUNCTION public.get_outlet_budget_status(p_outlet_id UUID)
RETURNS TABLE (
  nominal      NUMERIC,
  period_type  TEXT,
  period_start DATE,
  period_end   DATE,
  terpakai     NUMERIC,
  sisa         NUMERIC,
  has_config   BOOLEAN,
  custom_days  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg_nominal NUMERIC;
  v_has_config  BOOLEAN := false;
  v_sisa        NUMERIC := 0;
BEGIN
  -- Dapatkan nominal dari config
  SELECT outlet_budget_config.nominal INTO v_cfg_nominal 
  FROM outlet_budget_config 
  WHERE outlet_id = p_outlet_id;

  IF FOUND THEN
    v_has_config := true;
  ELSE
    v_cfg_nominal := 0;
  END IF;

  -- Dapatkan saldo saat ini
  SELECT current_balance INTO v_sisa
  FROM outlet_balance
  WHERE outlet_id = p_outlet_id;

  IF NOT FOUND THEN
    v_sisa := 0;
  END IF;

  -- Kembalikan kolom yang persis sama dengan signature lama (agar frontend tidak crash)
  -- namun isikan nilai dummy/null untuk kolom yang tidak relevan lagi.
  -- Terpakai dihitung sebagai (nominal - sisa) agar percentage di UI tetap jalan.
  RETURN QUERY SELECT 
    v_cfg_nominal, 
    'harian'::TEXT, 
    NOW()::DATE, 
    NOW()::DATE, 
    (v_cfg_nominal - v_sisa), 
    v_sisa, 
    v_has_config, 
    1::INT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_outlet_budget_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_outlet_budget_status(uuid) TO service_role;

-- 6. RPC request_budget_topup_svc
CREATE OR REPLACE FUNCTION public.request_budget_topup_svc(
  p_outlet_id UUID, 
  p_requested_amount NUMERIC,
  p_period_category TEXT
)
RETURNS public.outlet_budget_topup_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nominal NUMERIC;
  v_sisa NUMERIC;
  v_max_request NUMERIC;
  v_request public.outlet_budget_topup_requests;
BEGIN
  -- Dapatkan limit plafon
  SELECT nominal INTO v_nominal FROM outlet_budget_config WHERE outlet_id = p_outlet_id;
  IF v_nominal IS NULL THEN
    RAISE EXCEPTION 'Outlet belum memiliki konfigurasi budget (plafon)';
  END IF;
  
  -- Dapatkan saldo saat ini
  SELECT current_balance INTO v_sisa FROM outlet_balance WHERE outlet_id = p_outlet_id;
  IF v_sisa IS NULL THEN
    v_sisa := 0;
  END IF;
  
  v_max_request := v_nominal - v_sisa;
  
  IF p_requested_amount > v_max_request THEN
    RAISE EXCEPTION 'Jumlah request melebihi sisa plafon. Maksimal yang bisa diajukan adalah %', v_max_request;
  END IF;
  
  INSERT INTO public.outlet_budget_topup_requests (outlet_id, requested_amount, period_category, status, created_by)
  VALUES (p_outlet_id, p_requested_amount, p_period_category, 'pending_am', auth.uid())
  RETURNING * INTO v_request;
  
  RETURN v_request;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_budget_topup_svc(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_budget_topup_svc(uuid, numeric, text) TO service_role;

-- 7. RPC approve_budget_topup_svc
CREATE OR REPLACE FUNCTION public.approve_budget_topup_svc(
  p_request_id UUID,
  p_action TEXT, -- 'approve_am', 'approve_finance', 'reject'
  p_notes TEXT DEFAULT NULL
)
RETURNS public.outlet_budget_topup_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.outlet_budget_topup_requests;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_request FROM outlet_budget_topup_requests WHERE id = p_request_id FOR UPDATE;
  
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request top-up tidak ditemukan';
  END IF;
  
  IF v_request.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Request sudah dalam status %', v_request.status;
  END IF;
  
  IF p_action = 'reject' THEN
    UPDATE outlet_budget_topup_requests 
    SET status = 'rejected', notes = p_notes, updated_at = NOW() 
    WHERE id = p_request_id RETURNING * INTO v_request;
    RETURN v_request;
  END IF;
  
  IF p_action = 'approve_am' THEN
    IF v_request.status != 'pending_am' THEN
      RAISE EXCEPTION 'Hanya bisa approve_am jika status pending_am';
    END IF;
    UPDATE outlet_budget_topup_requests 
    SET status = 'pending_finance', am_approved_by = auth.uid(), notes = COALESCE(p_notes, notes), updated_at = NOW() 
    WHERE id = p_request_id RETURNING * INTO v_request;
    RETURN v_request;
  END IF;
  
  IF p_action = 'approve_finance' THEN
    IF v_request.status != 'pending_finance' THEN
      RAISE EXCEPTION 'Hanya bisa approve_finance jika status pending_finance';
    END IF;
    
    -- Finance approval: update status and add to ledger
    UPDATE outlet_budget_topup_requests 
    SET status = 'approved', finance_approved_by = auth.uid(), notes = COALESCE(p_notes, notes), updated_at = NOW() 
    WHERE id = p_request_id RETURNING * INTO v_request;
    
    -- Insert/update balance
    INSERT INTO outlet_balance (outlet_id, current_balance, updated_at)
    VALUES (v_request.outlet_id, v_request.requested_amount, NOW())
    ON CONFLICT (outlet_id) 
    DO UPDATE SET current_balance = outlet_balance.current_balance + v_request.requested_amount, updated_at = NOW()
    RETURNING current_balance INTO v_new_balance;
    
    -- Insert ledger
    INSERT INTO outlet_balance_ledger (outlet_id, transaction_type, reference_id, credit, debit, balance_after)
    VALUES (v_request.outlet_id, 'TOP_UP', v_request.id, v_request.requested_amount, 0, v_new_balance);
    
    RETURN v_request;
  END IF;
  
  RAISE EXCEPTION 'Action tidak valid: %', p_action;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_budget_topup_svc(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_budget_topup_svc(uuid, text, text) TO service_role;

-- 8. Modifikasi approve_permintaan_svc untuk mendebit saldo
CREATE OR REPLACE FUNCTION public.approve_permintaan_svc(p_permintaan_id uuid, p_items jsonb)
 RETURNS permintaan_bahan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_p       permintaan_bahan;
  v_item    JSONB;
  v_sj      surat_jalan;
  v_sj_items JSONB := '[]'::jsonb;
  v_bahan   UUID;
  v_qty     NUMERIC;
  v_harga   NUMERIC;
  v_total_debit NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id;
  END IF;
  IF v_p.status != 'menunggu' THEN
    RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_bahan := (v_item->>'bahan_baku_id')::UUID;
    v_qty   := (v_item->>'qty_disetujui')::NUMERIC;
    v_harga := COALESCE((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan), 0);
    
    v_total_debit := v_total_debit + (v_qty * v_harga);

    UPDATE permintaan_bahan_item
    SET qty_disetujui = v_qty,
        harga_snapshot = v_harga
    WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;

    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui, harga_snapshot)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty, v_harga);
    END IF;

    IF v_qty > 0 THEN
      v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan, 'qty_dikirim', v_qty);
    END IF;
  END LOOP;

  UPDATE permintaan_bahan_item
  SET qty_disetujui = 0
  WHERE permintaan_id = p_permintaan_id AND qty_disetujui IS NULL;

  IF jsonb_array_length(v_sj_items) = 0 THEN
    RAISE EXCEPTION 'tidak ada item disetujui (qty > 0); gunakan tolak_permintaan_svc';
  END IF;

  v_sj := create_surat_jalan(v_p.outlet_id, v_sj_items);

  UPDATE permintaan_bahan
  SET status = 'disetujui', surat_jalan_id = v_sj.id, updated_at = NOW()
  WHERE id = p_permintaan_id
  RETURNING * INTO v_p;

  -- TAMBAHAN: Update saldo dompet dan ledger
  IF v_total_debit > 0 THEN
    -- Upsert ke outlet_balance, jika belum ada buat dengan balance negatif
    INSERT INTO outlet_balance (outlet_id, current_balance, updated_at)
    VALUES (v_p.outlet_id, -v_total_debit, NOW())
    ON CONFLICT (outlet_id) 
    DO UPDATE SET current_balance = outlet_balance.current_balance - v_total_debit, updated_at = NOW()
    RETURNING current_balance INTO v_new_balance;
    
    INSERT INTO outlet_balance_ledger (outlet_id, transaction_type, reference_id, credit, debit, balance_after)
    VALUES (v_p.outlet_id, 'MATERIAL_PURCHASE', p_permintaan_id, 0, v_total_debit, v_new_balance);
  END IF;

  RETURN v_p;
END;
$function$;
