-- Developer mendapat wewenang yang sama dengan regional manager di modul Manager
-- (app native). Cakupan outlet sudah sama sejak lama: `accessible_outlet_ids()`
-- memasukkan 'developer' ke cabang seluruh-outlet. Yang tersisa adalah gerbang
-- role eksplisit yang hanya menyebut 'regional_manager'.
--
-- RPC: badan fungsi diambil dari definisi yang sedang live, lalu setiap daftar
-- `IN (...)` yang memuat 'regional_manager' ditambah 'developer'. Selain itu tidak
-- ada yang berubah. Kalau sebuah fungsi tak berubah (pola tak ditemukan), migrasi
-- gagal supaya tidak diam-diam meleset.

DO $$
DECLARE
  v_nama TEXT;
  v_lama TEXT;
  v_baru TEXT;
BEGIN
  FOREACH v_nama IN ARRAY ARRAY[
    'tinjau_ceklist_harian',   -- tinjau ceklist harian AM
    'native_stok_price_data',  -- layar Resep & HPP
    'process_void_request',    -- setujui/tolak pengajuan void
    'force_cancel_order'       -- batalkan paksa pesanan
  ] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_lama
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_nama;
    IF v_lama IS NULL THEN
      RAISE EXCEPTION 'Fungsi public.% tidak ditemukan', v_nama;
    END IF;

    v_baru := regexp_replace(
      v_lama,
      '(IN \([^)]*)''regional_manager''',
      '\1''regional_manager'', ''developer''',
      'g'
    );
    IF v_baru = v_lama THEN
      RAISE EXCEPTION 'Gerbang regional_manager tidak ditemukan di public.%', v_nama;
    END IF;

    EXECUTE v_baru;
  END LOOP;
END;
$$;

-- RLS: tabel yang dibaca modul Manager dengan daftar role eksplisit.

ALTER POLICY petty_cash_topups_select ON public.petty_cash_topups
  USING (
    (EXISTS (SELECT 1 FROM public.outlet_staff
              WHERE outlet_staff.id = (SELECT auth.uid())
                AND outlet_staff.role = ANY (ARRAY['admin','admin_finance','finance','owner','regional_manager','developer'])))
    OR outlet_id IN (SELECT staff_outlets.outlet_id FROM public.staff_outlets
                      WHERE staff_outlets.staff_id = (SELECT auth.uid()))
    OR outlet_id IN (SELECT outlet_staff.outlet_id FROM public.outlet_staff
                      WHERE outlet_staff.id = (SELECT auth.uid()))
    OR outlet_id IN (SELECT area_manager_outlets.outlet_id FROM public.area_manager_outlets
                      WHERE area_manager_outlets.manager_id = (SELECT auth.uid()))
  );

ALTER POLICY petty_cash_expenses_select ON public.petty_cash_expenses
  USING (
    (EXISTS (SELECT 1 FROM public.outlet_staff
              WHERE outlet_staff.id = (SELECT auth.uid())
                AND outlet_staff.role = ANY (ARRAY['admin','admin_finance','finance','owner','regional_manager','developer'])))
    OR outlet_id IN (SELECT staff_outlets.outlet_id FROM public.staff_outlets
                      WHERE staff_outlets.staff_id = (SELECT auth.uid()))
    OR outlet_id IN (SELECT outlet_staff.outlet_id FROM public.outlet_staff
                      WHERE outlet_staff.id = (SELECT auth.uid()))
  );

ALTER POLICY cancellation_requests_select ON public.cancellation_requests
  USING (
    (EXISTS (SELECT 1 FROM public.outlet_staff
              WHERE outlet_staff.id = (SELECT auth.uid())
                AND outlet_staff.role = ANY (ARRAY['admin','admin_finance','finance','owner','regional_manager','developer'])))
    OR order_id IN (
      SELECT orders.id FROM public.orders
       WHERE orders.outlet_id IN (
         SELECT outlet_staff.outlet_id FROM public.outlet_staff WHERE outlet_staff.id = (SELECT auth.uid())
         UNION
         SELECT staff_outlets.outlet_id FROM public.staff_outlets WHERE staff_outlets.staff_id = (SELECT auth.uid())
         UNION
         SELECT area_manager_outlets.outlet_id FROM public.area_manager_outlets WHERE area_manager_outlets.manager_id = (SELECT auth.uid())
       )
    )
  );

ALTER POLICY inventaris_sidak_reviews_manager_read ON public.inventaris_sidak_reviews
  USING (
    submission_id IN (
      SELECT s.id FROM public.inventaris_submissions s
       WHERE s.outlet_id IN (SELECT public.accessible_outlet_ids())
    )
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff me
       WHERE me.id = (SELECT auth.uid())
         AND me.role = ANY (ARRAY['regional_manager','area_manager','developer'])
         AND me.status = 'active'
    )
  );
