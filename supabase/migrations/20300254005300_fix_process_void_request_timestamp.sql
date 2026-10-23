-- Migration: 20300254005300_fix_process_void_request_timestamp.sql
-- Description: Pastikan fungsi public.process_void_request mengisi void_at dan voided_by saat persetujuan void diproses lewat Native Superapp / RPC

CREATE OR REPLACE FUNCTION public.process_void_request(p_request_id uuid, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_staff       uuid := auth.uid();
  v_role        text;
  v_nama        text;
  v_req         public.cancellation_requests%ROWTYPE;
  v_outlet      uuid;
  v_status_baru text;
  v_alasan_lama text;
BEGIN
  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'Tidak ada sesi aktif.';
  END IF;

  SELECT role, name INTO v_role, v_nama
    FROM public.outlet_staff
   WHERE id = v_staff AND COALESCE(is_active, true);

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan atau sudah non-aktif.';
  END IF;

  IF v_role NOT IN ('area_manager', 'regional_manager', 'developer', 'admin', 'leader') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang memproses pembatalan pesanan.', v_role;
  END IF;

  SELECT * INTO v_req
    FROM public.cancellation_requests
   WHERE id = p_request_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
  END IF;

  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Pengajuan sudah diproses sebelumnya.';
  END IF;

  -- Penjaga swa-persetujuan, kini hanya untuk peran yang merangkap kasir.
  IF v_req.requested_by = v_staff AND v_role NOT IN ('area_manager', 'regional_manager', 'developer') THEN
    RAISE EXCEPTION 'Anda tidak bisa menyetujui pengajuan Anda sendiri.';
  END IF;

  IF v_role IN ('area_manager', 'leader') THEN
    SELECT o.outlet_id INTO v_outlet FROM public.orders o WHERE o.id = v_req.order_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_outlets
       WHERE staff_id = v_staff
         AND outlet_id = COALESCE(v_req.outlet_id, v_outlet)
    ) THEN
      RAISE EXCEPTION 'Outlet pesanan ini bukan binaan Anda.';
    END IF;
  END IF;

  v_status_baru := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;

  UPDATE public.cancellation_requests
     SET status = v_status_baru,
         updated_at = now()
   WHERE id = v_req.id;

  SELECT cancellation_reason INTO v_alasan_lama
    FROM public.orders WHERE id = v_req.order_id;

  UPDATE public.orders
     SET cancellation_status = v_status_baru,
         status = CASE
                    WHEN p_approve THEN 'cancelled'
                    ELSE COALESCE(v_req.previous_order_status, 'pending')
                  END,
         cancellation_reason = CASE
           WHEN p_approve THEN
             CASE
               WHEN COALESCE(v_alasan_lama, '') <> ''
                 THEN v_alasan_lama || ' (Disetujui ' || v_nama || ')'
               ELSE 'Disetujui ' || v_nama
             END
           ELSE cancellation_reason
         END,
         void_at = CASE WHEN p_approve THEN coalesce(void_at, now()) ELSE void_at END,
         voided_by = CASE WHEN p_approve THEN coalesce(voided_by, v_staff) ELSE voided_by END
   WHERE id = v_req.order_id;

  RETURN jsonb_build_object('status', v_status_baru);
END;
$function$;
