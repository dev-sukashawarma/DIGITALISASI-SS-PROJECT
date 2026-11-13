-- ARSIP — jalankan SEKALI. Koreksi owner 13 Nov 2026: HPP tiga saus = kolom COGS (tanpa overhead) di tab OFFLINE.
-- Menimpa angka kolom OVERHEAD yang diinput beberapa menit sebelumnya (3542 / 1963,5 / 2310).
DO $$
DECLARE v_admin uuid; v_n int; v_e record; v_t date;
BEGIN
  SELECT id INTO v_admin FROM public.outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  CREATE TEMP TABLE _r (menu_id uuid, nama text, lama numeric, baru numeric) ON COMMIT DROP;
  INSERT INTO _r VALUES
   ('974cde6c-931a-43bd-97dc-4e400264980c','TRUFFLE SAUCE',3542,3220),
   ('274557c1-d0a6-481d-8546-1cc8a3fa1be3','CHEESE SAUCE',1963.5,1785),
   ('538c9fc5-efea-4d6d-920c-2b46029529d8','SAMYANG SAUCE',2310,2100);
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-13') h)=r.lama;
  IF v_n<>3 THEN RAISE EXCEPTION 'penjaga: % dari 3',v_n; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  FOREACH v_t IN ARRAY ARRAY[DATE '2026-11-01', DATE '2026-11-13'] LOOP
    FOR v_e IN SELECT * FROM _r LOOP
      PERFORM public.ubah_hpp_menu(v_e.menu_id, jsonb_build_object('hpp_override',v_e.baru), v_t, 'Koreksi owner 13 Nov 2026: saus = kolom COGS tanpa overhead');
    END LOOP;
  END LOOP;
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-01') h)=r.baru
    AND (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-13') h)=r.baru
    AND (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-10-31') h) IS NULL;
  IF v_n<>3 THEN RAISE EXCEPTION 'ASERSI gagal % dari 3',v_n; END IF;
END $$;
