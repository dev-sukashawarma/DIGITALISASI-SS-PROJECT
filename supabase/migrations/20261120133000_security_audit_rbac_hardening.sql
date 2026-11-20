-- ============================================================================
-- Security Audit & Industry-Standard RBAC Hardening (Non-Destructive DDL)
-- Applied: 2026-11-20
-- ============================================================================

-- 1. Distributed Login & PIN Rate-Limiting Tables + RPCs (service_role only)
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address text NOT NULL,
  identifier_key text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  cleared boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ident_active
  ON public.auth_login_attempts (identifier_key, attempted_at DESC)
  WHERE success = false AND cleared = false;

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_active
  ON public.auth_login_attempts (ip_address, attempted_at DESC)
  WHERE success = false AND cleared = false;

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_login_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_login_attempts TO service_role;

CREATE TABLE IF NOT EXISTS public.auth_pin_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_id uuid NOT NULL,
  ip_address text NOT NULL,
  caller_id uuid,
  success boolean NOT NULL DEFAULT false,
  cleared boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_pin_attempts_outlet_ip_active
  ON public.auth_pin_attempts (outlet_id, ip_address, attempted_at DESC)
  WHERE success = false AND cleared = false;

ALTER TABLE public.auth_pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_pin_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_pin_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_ip text,
  p_identifier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ip text := COALESCE(NULLIF(btrim(p_ip), ''), 'unknown');
  v_ident text := lower(COALESCE(NULLIF(btrim(p_identifier), ''), 'unknown'));
  v_window timestamptz := now() - interval '10 minutes';
  v_ident_fails int := 0;
  v_ip_fails int := 0;
  v_oldest timestamptz;
  v_retry int := 600;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), min(attempted_at)
    INTO v_ident_fails, v_oldest
    FROM public.auth_login_attempts
   WHERE identifier_key = v_ident
     AND success = false
     AND cleared = false
     AND attempted_at >= v_window;

  IF v_ident_fails >= 8 THEN
    v_retry := GREATEST(60, LEAST(600, CEIL(EXTRACT(EPOCH FROM ((v_oldest + interval '10 minutes') - now())))::int));
    RETURN jsonb_build_object('allowed', false, 'retry_after_sec', v_retry, 'reason', 'identifier_locked');
  END IF;

  IF v_ip <> 'unknown' THEN
    SELECT count(*), min(attempted_at)
      INTO v_ip_fails, v_oldest
      FROM public.auth_login_attempts
     WHERE ip_address = v_ip
       AND success = false
       AND cleared = false
       AND attempted_at >= v_window;

    IF v_ip_fails >= 20 THEN
      v_retry := GREATEST(60, LEAST(600, CEIL(EXTRACT(EPOCH FROM ((v_oldest + interval '10 minutes') - now())))::int));
      RETURN jsonb_build_object('allowed', false, 'retry_after_sec', v_retry, 'reason', 'ip_rate_limited');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'retry_after_sec', 0, 'reason', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_ip text,
  p_identifier text,
  p_success boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ip text := COALESCE(NULLIF(btrim(p_ip), ''), 'unknown');
  v_ident text := lower(COALESCE(NULLIF(btrim(p_identifier), ''), 'unknown'));
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_success THEN
    UPDATE public.auth_login_attempts
       SET cleared = true
     WHERE identifier_key = v_ident
       AND ip_address = v_ip
       AND success = false
       AND cleared = false
       AND attempted_at >= now() - interval '10 minutes';
  END IF;

  INSERT INTO public.auth_login_attempts (ip_address, identifier_key, success)
  VALUES (v_ip, v_ident, p_success);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_pin_rate_limit(
  p_outlet_id uuid,
  p_ip text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ip text := COALESCE(NULLIF(btrim(p_ip), ''), 'unknown');
  v_fails int := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_fails
    FROM public.auth_pin_attempts
   WHERE outlet_id = p_outlet_id
     AND ip_address = v_ip
     AND success = false
     AND cleared = false
     AND attempted_at >= now() - interval '10 minutes';

  RETURN v_fails < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pin_attempt(
  p_outlet_id uuid,
  p_ip text,
  p_caller_id uuid,
  p_success boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ip text := COALESCE(NULLIF(btrim(p_ip), ''), 'unknown');
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_success THEN
    UPDATE public.auth_pin_attempts
       SET cleared = true
     WHERE outlet_id = p_outlet_id
       AND ip_address = v_ip
       AND success = false
       AND cleared = false
       AND attempted_at >= now() - interval '10 minutes';
  END IF;

  INSERT INTO public.auth_pin_attempts (outlet_id, ip_address, caller_id, success)
  VALUES (p_outlet_id, v_ip, p_caller_id, p_success);
END;
$$;

-- 2. Synchronize outlet_staff.status & outlet_staff.is_active
UPDATE public.outlet_staff
   SET is_active = false
 WHERE status <> 'active'
   AND is_active IS TRUE;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_outlet_staff_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := CASE WHEN COALESCE(NEW.is_active, true) THEN 'active' ELSE 'inactive' END;
    END IF;
    NEW.is_active := (NEW.status = 'active');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.is_active := (NEW.status = 'active');
    ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      IF NEW.is_active IS FALSE AND NEW.status = 'active' THEN
        NEW.status := 'inactive';
      ELSIF NEW.is_active IS TRUE AND NEW.status = 'inactive' THEN
        NEW.status := 'active';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_outlet_staff_active'
      AND tgrelid = 'public.outlet_staff'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_outlet_staff_active
      BEFORE INSERT OR UPDATE OF status, is_active
      ON public.outlet_staff
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_fn_sync_outlet_staff_active();
  END IF;
END $$;

-- 3. Harden & Optimize Core RBAC Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin', 'admin_hr', 'owner', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('owner', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('owner', 'admin', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_developer(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = CASE
                 WHEN auth.role() = 'service_role' OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
                 THEN COALESCE(p_uid, auth.uid())
                 ELSE auth.uid()
               END
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role = 'developer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_finance_checker()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('owner', 'admin', 'admin_finance', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hr_pusat()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin', 'admin_hr', 'owner', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin', 'admin_hr', 'owner', 'regional_manager', 'area_manager', 'korlap', 'spv', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.i_am_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('spv', 'kepala_outlet')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_approve_po()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin_finance', 'owner', 'admin', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_set_harga_outlet()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin', 'owner', 'spv', 'regional_manager', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_verify_po_receipt()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('kitchen', 'admin', 'owner', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_bahan_baku()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin', 'owner', 'purchasing', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_payroll()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
      AND role IN ('admin', 'admin_hr', 'owner', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
    FROM public.outlet_staff
   WHERE id = auth.uid()
     AND status = 'active'
     AND COALESCE(is_active, true)
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_outlet_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT outlet_id
    FROM public.outlet_staff
   WHERE id = auth.uid()
     AND status = 'active'
     AND COALESCE(is_active, true)
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id
  FROM public.outlets o
  WHERE auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'service_role'

  UNION

  SELECT o.id
  FROM public.outlets o, (
    SELECT id, role, outlet_id
    FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
  ) me
  WHERE me.role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager',
    'kitchen', 'admin_finance', 'finance', 'purchasing', 'developer'
  )

  UNION

  SELECT so.outlet_id
  FROM public.staff_outlets so, (
    SELECT id, role
    FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
  ) me
  WHERE me.role IN ('leader', 'korlap', 'area_manager', 'kepala_outlet', 'crew')
    AND so.staff_id = me.id

  UNION

  SELECT me.outlet_id
  FROM (
    SELECT outlet_id
    FROM public.outlet_staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND COALESCE(is_active, true)
  ) me
  WHERE me.outlet_id IS NOT NULL

  UNION

  SELECT unnest(mp.outlet_ids)
  FROM public.mitra_profiles mp
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'aktif'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid()
        AND s.status = 'active'
        AND COALESCE(s.is_active, true)
    )

  UNION

  SELECT eca.target_outlet_id
  FROM public.emergency_crew_assignments eca
  JOIN public.outlet_staff s ON s.id = eca.staff_id
  WHERE eca.staff_id = auth.uid()
    AND s.status = 'active'
    AND COALESCE(s.is_active, true)
    AND eca.status = 'active'
    AND eca.assignment_date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
$$;

-- 4. Fix IDOR & Missing Auth Checks Inside Critical SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public.approve_retur_by_manager(
  p_retur_id uuid,
  p_approve boolean,
  p_catatan text DEFAULT NULL::text,
  p_manager_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_outlet_id UUID;
  v_nomor_retur TEXT;
  v_is_service BOOLEAN := (auth.role() = 'service_role' OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role');
  v_approver_id UUID;
BEGIN
  v_approver_id := CASE WHEN v_is_service THEN COALESCE(p_manager_id, auth.uid()) ELSE auth.uid() END;

  IF v_approver_id IS NULL THEN
    RAISE EXCEPTION 'ID manager tidak teridentifikasi' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role INTO v_role
  FROM public.outlet_staff
  WHERE id = v_approver_id AND status = 'active' AND COALESCE(is_active, true);

  IF NOT (v_role IN ('area_manager', 'regional_manager', 'spv', 'admin', 'owner', 'developer')) THEN
    RAISE EXCEPTION 'Hanya Area Manager, Regional Manager, SPV, Admin, atau Developer yang dapat menyetujui pengajuan retur'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status, outlet_id, nomor_retur INTO v_status, v_outlet_id, v_nomor_retur
  FROM public.retur_stok
  WHERE id = p_retur_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Data tiket retur tidak ditemukan' USING ERRCODE = 'data_exception';
  END IF;

  IF NOT v_is_service AND v_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Pengajuan retur ini di luar cakupan outlet Anda'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_status != 'diajukan' THEN
    RAISE EXCEPTION 'Tiket retur sudah tidak dalam status diajukan (status saat ini: %)', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_approve IS TRUE THEN
    UPDATE public.retur_stok
    SET
      status = 'disetujui_manager',
      approved_by_manager = v_approver_id,
      approved_manager_at = NOW(),
      catatan_manager = p_catatan,
      updated_at = NOW()
    WHERE id = p_retur_id;
  ELSE
    UPDATE public.retur_stok
    SET
      status = 'ditolak',
      approved_by_manager = v_approver_id,
      approved_manager_at = NOW(),
      catatan_manager = p_catatan,
      updated_at = NOW()
    WHERE id = p_retur_id;

    UPDATE public.ledger_stok
    SET
      tipe = 'waste',
      catatan = 'Retur ditolak Manager (dialihkan ke waste): ' || COALESCE(p_catatan, '')
    WHERE ref_retur_id = p_retur_id AND tipe = 'retur_ke_pusat';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'retur_id', p_retur_id,
    'status', CASE WHEN p_approve THEN 'disetujui_manager' ELSE 'ditolak' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_forward_funds(p_topup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT public.is_finance_checker() THEN
    RAISE EXCEPTION 'Hanya Finance/Admin/Owner yang berwenang meneruskan dana' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'approved_by_finance' THEN
    RAISE EXCEPTION 'Top up is not approved by Finance (status: %)', v_topup.status;
  END IF;

  UPDATE public.petty_cash_topups
  SET
    status = 'forwarded_by_finance',
    finance_forwarded_by = auth.uid(),
    finance_forwarded_at = NOW()
  WHERE id = p_topup_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crew_receive_funds(p_topup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
      RAISE EXCEPTION 'Anda tidak berwenang mengonfirmasi penerimaan dana outlet ini' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_topup.status != 'forwarded_by_leader' THEN
    RAISE EXCEPTION 'Top up is not ready for Crew receiving (status: %)', v_topup.status;
  END IF;

  UPDATE public.petty_cash_topups
  SET
    status = 'completed',
    crew_received_by = auth.uid(),
    completed_at = NOW()
  WHERE id = p_topup_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_purchase_orders(
  p_from date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date,
  p_to date DEFAULT CURRENT_DATE,
  p_status text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  nomor_po text,
  supplier_nama text,
  tanggal_po date,
  status text,
  total_nilai numeric,
  jumlah_item bigint,
  nama_dibuat_oleh text,
  created_at timestamp with time zone,
  total_nilai_terima numeric,
  jumlah_item_terima bigint,
  jumlah_invoice integer,
  has_discrepancy boolean,
  jatuh_tempo date,
  termin_hari integer,
  diverifikasi_at timestamp with time zone,
  paid_at timestamp with time zone,
  payment_status text,
  tanggal_estimasi_tiba date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    po.id,
    po.nomor_po,
    po.supplier_nama,
    po.tanggal_po,
    po.status,
    COALESCE(SUM(poi.subtotal), 0) AS total_nilai,
    COUNT(poi.id) AS jumlah_item,
    s_staff.name AS nama_dibuat_oleh,
    po.created_at,
    COALESCE(SUM(
      CASE
        WHEN poi.qty_terima IS NOT NULL THEN (poi.qty_terima * COALESCE(poi.harga_terima, poi.harga_pesan))
        ELSE 0
      END
    ), 0) AS total_nilai_terima,
    COUNT(CASE WHEN poi.qty_terima IS NOT NULL AND poi.qty_terima > 0 THEN 1 END) AS jumlah_item_terima,
    COALESCE(cardinality(po.invoice_urls), 0) AS jumlah_invoice,
    (
      EXISTS (
        SELECT 1 FROM public.purchase_order_item pi2
        WHERE pi2.purchase_order_id = po.id
          AND (
            (pi2.qty_terima IS NOT NULL AND pi2.qty_terima <> pi2.qty_pesan) OR
            (pi2.harga_terima IS NOT NULL AND pi2.harga_terima <> pi2.harga_pesan) OR
            (pi2.kondisi IN ('rusak', 'kurang'))
          )
      )
    ) AS has_discrepancy,
    po.jatuh_tempo,
    COALESCE(sup.termin_hari, 0)::INT AS termin_hari,
    po.diverifikasi_at,
    po.paid_at,
    COALESCE(po.payment_status, 'unpaid') AS payment_status,
    po.tanggal_estimasi_tiba
  FROM public.purchase_order po
  LEFT JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
  LEFT JOIN public.outlet_staff s_staff ON s_staff.id = po.dibuat_oleh
  LEFT JOIN public.supplier sup ON sup.id = po.supplier_id
  WHERE (
      auth.role() = 'service_role'
      OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
      OR public.can_manage_po()
      OR public.get_user_role() IN ('spv', 'regional_manager', 'area_manager', 'korlap')
    )
    AND (p_from IS NULL OR po.tanggal_po >= p_from)
    AND (p_to IS NULL OR po.tanggal_po <= p_to)
    AND (p_status IS NULL OR po.status = p_status)
  GROUP BY po.id, po.nomor_po, po.supplier_nama, po.tanggal_po, po.status, s_staff.name, po.created_at, po.invoice_urls, po.jatuh_tempo, sup.termin_hari, po.diverifikasi_at, po.paid_at, po.payment_status, po.tanggal_estimasi_tiba
  ORDER BY po.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.send_surat_jalan_signed(p_surat_jalan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sj record;
  v_sig_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.outlet_staff
       WHERE id = auth.uid()
         AND status = 'active'
         AND COALESCE(is_active, true)
         AND role IN ('kitchen', 'admin', 'owner', 'purchasing', 'driver', 'spv', 'regional_manager', 'developer')
     ) THEN
    RAISE EXCEPTION 'Tidak berwenang mengirim surat jalan' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, signatures INTO v_sj
  FROM public.surat_jalan
  WHERE id = p_surat_jalan_id;

  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'Surat jalan not found';
  END IF;

  v_sig_count := jsonb_array_length(v_sj.signatures);
  IF v_sig_count < 1 THEN
    RAISE EXCEPTION 'Minimal 1 signature required to send surat jalan';
  END IF;

  UPDATE public.surat_jalan
  SET status = 'dikirim'
  WHERE id = p_surat_jalan_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Surat jalan sent with ' || v_sig_count || ' signature(s)',
    'signatures', v_sj.signatures
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_surat_jalan(
  p_surat_jalan_id uuid,
  p_signed_by_name text,
  p_role text,
  p_signature_image text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_signatures jsonb;
  v_sj record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.outlet_staff
       WHERE id = auth.uid() AND status = 'active' AND COALESCE(is_active, true)
     ) THEN
    RAISE EXCEPTION 'Tidak terautentikasi sebagai staf aktif' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, signatures INTO v_sj
  FROM public.surat_jalan
  WHERE id = p_surat_jalan_id;

  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'Surat jalan not found';
  END IF;

  IF v_sj.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft surat jalan can be signed';
  END IF;

  v_signatures := coalesce(v_sj.signatures, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'signed_by', p_signed_by_name,
      'role', p_role,
      'signed_at', now(),
      'signature_image', p_signature_image
    )
  );

  UPDATE public.surat_jalan
  SET signatures = v_signatures
  WHERE id = p_surat_jalan_id;

  RETURN jsonb_build_object(
    'success', true,
    'signatures', v_signatures,
    'total_signatures', jsonb_array_length(v_signatures)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_receipt_surat_jalan(
  p_surat_jalan_id uuid,
  p_signed_by_name text,
  p_role text,
  p_signature_image text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sj record;
  v_sigs jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.outlet_staff
       WHERE id = auth.uid() AND status = 'active' AND COALESCE(is_active, true)
     ) THEN
    RAISE EXCEPTION 'Tidak terautentikasi sebagai staf aktif' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, receipt_signatures INTO v_sj
  FROM public.surat_jalan
  WHERE id = p_surat_jalan_id;

  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'Surat jalan not found';
  END IF;

  IF v_sj.status NOT IN ('dikirim', 'dikirim_lengkap', 'diterima_sebagian') THEN
    RAISE EXCEPTION 'Surat jalan tidak dalam status penerimaan (status: %)', v_sj.status;
  END IF;

  IF p_role NOT IN ('Crew Penerima', 'Supir') THEN
    RAISE EXCEPTION 'Role tidak valid untuk TTD penerimaan: %', p_role;
  END IF;

  v_sigs := coalesce(v_sj.receipt_signatures, '[]'::jsonb);

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_sigs) e
    WHERE e->>'role' = p_role
  ) THEN
    RAISE EXCEPTION '% sudah menandatangani penerimaan', p_role;
  END IF;

  v_sigs := v_sigs || jsonb_build_array(
    jsonb_build_object(
      'signed_by', p_signed_by_name,
      'role', p_role,
      'signed_at', now(),
      'signature_image', p_signature_image
    )
  );

  UPDATE public.surat_jalan
  SET receipt_signatures = v_sigs
  WHERE id = p_surat_jalan_id;

  RETURN jsonb_build_object(
    'success', true,
    'receipt_signatures', v_sigs,
    'total', jsonb_array_length(v_sigs)
  );
END;
$$;

-- 5. Lock Down Function EXECUTE Privileges & Mutable search_path Across public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public;', r.fn_sig);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS fn_sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT IN ('kb_cs_ambil')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.fn_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.fn_sig);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS fn_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proname IN (
          'exec_sql',
          'run_query_json',
          'dev_eval_sql',
          '_temp_explain',
          '_temp_inspect',
          '_temp_get_indexes',
          '_verify_schema_helper',
          'get_fn_def',
          'get_func_def',
          'get_func_src',
          'get_fn_src',
          'get_func_source',
          'temp_get_func_defs',
          'temp_get_triggers',
          'get_table_indexes',
          'check_rls',
          'list_policies',
          'check_pg_cron',
          'get_cron_jobs_info',
          'get_bot_triggers_info',
          'atomic_insert_order',
          'buat_permintaan_svc',
          'approve_permintaan_svc',
          'tolak_permintaan_svc',
          'chat_bersihkan_pesan_kadaluarsa',
          'process_menu_sync_queue',
          'prune_staff_location_trails',
          'resolve_username',
          'check_login_rate_limit',
          'record_login_attempt',
          'check_pin_rate_limit',
          'record_pin_attempt',
          'get_sales_board_today',
          'request_budget_topup_svc',
          'approve_budget_topup_svc'
        )
        OR p.proname LIKE 'bot_ceo_%'
        OR p.proname LIKE 'bot_manager_%'
        OR p.proname LIKE 'bot_hrd_%'
        OR p.proname LIKE 'bot_telegram_%'
        OR p.proname LIKE 'wa_am_%'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.fn_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.fn_sig);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 6. Tighten Over-Permissive RLS Policies Using Non-Destructive ALTER/CREATE POLICY
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ecommerce_channels',
    'ecommerce_entities',
    'ecommerce_menu_prices',
    'ecommerce_sale_items',
    'ecommerce_sales'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'Allow all for ' || t
    ) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I TO service_role USING (true) WITH CHECK (true);',
        'Allow all for ' || t, t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_authenticated_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.outlet_staff s WHERE s.id = (SELECT auth.uid()) AND s.status = ''active'' AND COALESCE(s.is_active, true)));',
        t || '_authenticated_read', t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_admin_write'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_owner_or_admin() OR (SELECT public.get_user_role()) IN (''admin_finance'', ''marcom'')) WITH CHECK (public.is_owner_or_admin() OR (SELECT public.get_user_role()) IN (''admin_finance'', ''marcom''));',
        t || '_admin_write', t
      );
    END IF;
  END LOOP;
END $$;

ALTER POLICY "pos_endorsements_all_service"
  ON public.pos_endorsements
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER POLICY "pos_endorsements_select_all"
  ON public.pos_endorsements
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = (SELECT auth.uid())
        AND s.status = 'active'
        AND COALESCE(s.is_active, true)
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pos_endorsements' AND policyname = 'pos_endorsements_marcom_manage'
  ) THEN
    CREATE POLICY "pos_endorsements_marcom_manage"
      ON public.pos_endorsements FOR ALL TO authenticated
      USING (
        public.is_owner_or_admin()
        OR (SELECT public.get_user_role()) IN ('marcom', 'staff_pusat')
      )
      WITH CHECK (
        public.is_owner_or_admin()
        OR (SELECT public.get_user_role()) IN ('marcom', 'staff_pusat')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pos_endorsements' AND policyname = 'pos_endorsements_outlet_claim'
  ) THEN
    CREATE POLICY "pos_endorsements_outlet_claim"
      ON public.pos_endorsements FOR UPDATE TO authenticated
      USING (outlet_id IN (SELECT public.accessible_outlet_ids()))
      WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));
  END IF;
END $$;

ALTER POLICY "cancellation_requests_public"
  ON public.cancellation_requests
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cancellation_requests' AND policyname = 'cancellation_requests_insert_scoped'
  ) THEN
    CREATE POLICY "cancellation_requests_insert_scoped"
      ON public.cancellation_requests FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = cancellation_requests.order_id
            AND o.outlet_id IN (SELECT public.accessible_outlet_ids())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cancellation_requests' AND policyname = 'cancellation_requests_update_scoped'
  ) THEN
    CREATE POLICY "cancellation_requests_update_scoped"
      ON public.cancellation_requests FOR UPDATE TO authenticated
      USING (
        public.is_owner_or_admin()
        OR (
          (SELECT public.get_user_role()) IN ('leader', 'spv', 'area_manager', 'regional_manager', 'korlap')
          AND EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = cancellation_requests.order_id
              AND o.outlet_id IN (SELECT public.accessible_outlet_ids())
          )
        )
      )
      WITH CHECK (
        public.is_owner_or_admin()
        OR (
          (SELECT public.get_user_role()) IN ('leader', 'spv', 'area_manager', 'regional_manager', 'korlap')
          AND EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = cancellation_requests.order_id
              AND o.outlet_id IN (SELECT public.accessible_outlet_ids())
          )
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

ALTER POLICY "order_items_insert_public"
  ON public.order_items
  TO authenticated
  WITH CHECK (
    public.is_owner_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id IN (SELECT public.accessible_outlet_ids())
    )
  );

ALTER POLICY "order_items_select_public"
  ON public.order_items
  TO authenticated
  USING (
    public.is_owner_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.outlet_id IN (SELECT public.accessible_outlet_ids())
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'order_items_service_all'
  ) THEN
    CREATE POLICY "order_items_service_all"
      ON public.order_items FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER POLICY "orders_insert_scoped" ON public.orders TO authenticated;
ALTER POLICY "orders_select_scoped" ON public.orders TO authenticated;
ALTER POLICY "orders_update_crew" ON public.orders TO authenticated;
ALTER POLICY "orders_update_leader" ON public.orders TO authenticated;

ALTER POLICY "Public read access for global_settings"
  ON public.global_settings
  TO anon
  USING (key IN ('brand_name', 'brand_logo', 'app_update', 'superapp_update', 'native_runtime_config'));

ALTER POLICY "outlets_read_anon" ON public.outlets TO service_role USING (true);
ALTER POLICY "bahan_baku_read_anon" ON public.bahan_baku TO authenticated USING (is_active = true);
ALTER POLICY "menu_items_select_public" ON public.menu_items TO authenticated, service_role;
ALTER POLICY "Enable read access for all users" ON public.menu_packages TO authenticated, service_role;
ALTER POLICY "menu_packages_select_public" ON public.menu_packages TO authenticated, service_role;
ALTER POLICY "kiosk_settings_select_public" ON public.kiosk_settings TO authenticated, service_role;
ALTER POLICY "outlet_promos_select_public" ON public.outlet_promos TO authenticated, service_role;

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'inbound_outbound_feed',
    'nilai_persediaan_spv',
    'system_health_latest',
    'system_health_transitions',
    'test_comment_view',
    'valid_operational_outlets'
  ]
  LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon;', v);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated, service_role;', v);
    END IF;
  END LOOP;
END $$;
