-- ARSIP — jalankan SEKALI. Koreksi owner 13 Nov 2026 (ketiga kalinya): Chick n Chips = 16589, berlaku 1 Nov.
DO $$
DECLARE v_admin uuid; v_n int; v_t date; v_id constant uuid := '9e9a1137-c7be-4cdc-b03c-8dd59d945591';
BEGIN
  SELECT id INTO v_admin FROM public.outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  SELECT count(*) INTO v_n FROM public.menu_hpp_pada(v_id,DATE '2026-11-13') h WHERE h.hpp_override=15081;
  IF v_n<>1 THEN RAISE EXCEPTION 'penjaga gagal'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  FOREACH v_t IN ARRAY ARRAY[DATE '2026-11-01', DATE '2026-11-13'] LOOP
    PERFORM public.ubah_hpp_menu(v_id, jsonb_build_object('hpp_override',16589), v_t, 'Koreksi owner 13 Nov 2026: Chick n Chips = 16589');
  END LOOP;
  SELECT count(*) INTO v_n FROM unnest(ARRAY[DATE '2026-11-01',DATE '2026-11-13']) d
    WHERE (SELECT hpp_override FROM public.menu_hpp_pada(v_id,d))=16589;
  IF v_n<>2 OR (SELECT hpp_override FROM public.menu_hpp_pada(v_id,DATE '2026-10-31')) IS NOT NULL THEN RAISE EXCEPTION 'ASERSI gagal'; END IF;
END $$;
