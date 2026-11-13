-- ARSIP — jalankan SEKALI. Sumber: "HPP NOVEMBER UPDATED TGL 13.xlsx" tab OFFLINE kolom C (HPP + OPEX), berlaku 1 Nov 2026.
-- C&C Original sebelumnya 15081 (COGS murni, berlaku 13 Nov) -> 16589,1; saus sebelumnya kosong.
DO $$
DECLARE v_admin uuid; v_n int; v_e record; v_t date;
BEGIN
  SELECT id INTO v_admin FROM public.outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Admin Dev tidak ada'; END IF;
  CREATE TEMP TABLE _r (menu_id uuid, nama text, baru numeric) ON COMMIT DROP;
  INSERT INTO _r VALUES
   ('9e9a1137-c7be-4cdc-b03c-8dd59d945591','ORIGINAL CHICK N CHIPS',16589.1),
   ('974cde6c-931a-43bd-97dc-4e400264980c','TRUFFLE SAUCE',3542),
   ('274557c1-d0a6-481d-8546-1cc8a3fa1be3','CHEESE SAUCE',1963.5),
   ('538c9fc5-efea-4d6d-920c-2b46029529d8','SAMYANG SAUCE',2310);
  SELECT count(*) INTO v_n FROM _r r JOIN public.menu_items m ON m.id=r.menu_id AND m.name=r.nama AND m.outlet_id IS NULL;
  IF v_n<>4 THEN RAISE EXCEPTION 'penjaga 1: % dari 4',v_n; END IF;
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-13') h) IS DISTINCT FROM r.baru;
  IF v_n<>4 THEN RAISE EXCEPTION 'penjaga 2: sudah dijalankan? % dari 4',v_n; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  FOREACH v_t IN ARRAY ARRAY[DATE '2026-11-01', DATE '2026-11-13'] LOOP
    FOR v_e IN SELECT * FROM _r LOOP
      PERFORM public.ubah_hpp_menu(v_e.menu_id, jsonb_build_object('hpp_override',v_e.baru), v_t, 'HPP NOVEMBER UPDATED TGL 13.xlsx tab OFFLINE, berlaku 1 Nov 2026 - owner 13 Nov 2026');
    END LOOP;
  END LOOP;
  SELECT count(*) INTO v_n FROM _r r WHERE (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-01') h)=r.baru
    AND (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-11-13') h)=r.baru
    AND (SELECT h.hpp_override FROM public.menu_hpp_pada(r.menu_id,DATE '2026-10-31') h) IS DISTINCT FROM r.baru;
  IF v_n<>4 THEN RAISE EXCEPTION 'ASERSI gagal % dari 4',v_n; END IF;
END $$;
