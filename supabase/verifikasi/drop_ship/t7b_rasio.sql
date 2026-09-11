-- Harga nota yang rasionya PERSIS faktor konversi bahan (sidik jari salah satuan)
-- tidak boleh menimpa master. Sayur: faktor_tampilan 1000 -> harga/kg 22 (per gram) ditahan.
BEGIN;
DO $$
DECLARE v_crew uuid; v_purch uuid; v_bahan uuid; v_sup uuid; v_tagih date; v_lama numeric; v_baru numeric; v_q numeric;
BEGIN
  SELECT s.id INTO v_crew FROM public.outlet_staff s JOIN public.outlets o ON o.id=s.outlet_id WHERE o.type='test' AND s.role='crew' AND s.status='active' LIMIT 1;
  SELECT id INTO v_purch FROM public.outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE nama ILIKE '%lettuce%' LIMIT 1;
  SELECT id INTO v_sup FROM public.supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT tanggal_tagihan INTO v_tagih FROM public.periode_tagihan(current_date);
  SELECT harga_beli INTO v_lama FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.catat_terima_vendor(v_bahan, v_sup, 10, current_date, NULL, NULL);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT sum(qty) INTO v_q FROM public.terima_vendor_outlet t, public.periode_tagihan(v_tagih) p
   WHERE t.supplier_id=v_sup AND t.status='dicatat' AND t.tanggal_terima BETWEEN p.mulai AND p.akhir;
  PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, v_q, v_q * (v_lama / 1000), 'https://x/nota.jpg');
  SELECT harga_beli INTO v_baru FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;
  IF v_baru <> v_lama THEN RAISE EXCEPTION 'GAGAL: harga salah-satuan menimpa master (% -> %)', v_lama, v_baru; END IF;
  PERFORM 1 FROM public.bahan_baku_harga_history WHERE bahan_baku_id=v_bahan AND catatan LIKE 'DITOLAK (dugaan salah satuan)%';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: penolakan tidak dicatat di riwayat'; END IF;
  RAISE EXCEPTION 'HASIL T7b: LULUS (harga per-gram ditahan, master tetap %)', v_lama;
END $$;
ROLLBACK;
