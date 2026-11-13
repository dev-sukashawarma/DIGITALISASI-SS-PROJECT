-- t4 — perbaikan review akhir (migration 20261113203000)
-- I1: penugasan AM yang diakhiri HR (effective_to = kemarin) harus dianggap selesai
--     walau tanggal tutup outlet jauh di masa lalu (penutupan mundur / backfill).
-- I2: pesanan yang masuk SESUDAH tanggal tutup hanya peringatan (pesanan_nyasar),
--     tidak boleh mengunci langkah wajib 'order'.
-- Seluruhnya BEGIN … ROLLBACK, sebagai Admin Dev. Sukses = baris 't4: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);

CREATE FUNCTION pg_temp.langkah(r jsonb, k text) RETURNS jsonb LANGUAGE sql AS
$$ SELECT e FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' = k $$;

DO $$
DECLARE
  v_o     uuid;
  v_am    uuid;
  v_hari  date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_tutup timestamptz := now() - interval '60 days';
  r       jsonb;
BEGIN
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T4', 'uji-tutup-t4', 'internal', 'active', true, 'Jl. Uji') RETURNING id INTO v_o;
  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets SET status='inactive', is_active=false, nonaktif_at=v_tutup,
         alasan_tutup='uji t4 penutupan mundur', app_enabled=false WHERE id = v_o;
  PERFORM set_config('app.penutupan_outlet', '', true);

  -- I1: penugasan AM diakhiri HR kemarin (jauh sesudah tanggal tutup) → selesai
  SELECT id INTO v_am FROM public.outlet_staff WHERE role = 'area_manager' AND status = 'active' LIMIT 1;
  INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
  VALUES (v_am, v_o, v_hari - 90, v_hari - 1, 'uji t4');
  r := public.status_penutupan_outlet(v_o);
  IF NOT (pg_temp.langkah(r,'penugasan')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL I1: penugasan yang sudah diakhiri kemarin masih dianggap berlaku (%)',
      pg_temp.langkah(r,'penugasan')->>'info';
  END IF;
  -- kontrol: penugasan yang masih berlaku hari ini tetap menahan
  UPDATE public.am_outlet_assignments SET effective_to = v_hari WHERE outlet_id = v_o;
  IF (pg_temp.langkah(public.status_penutupan_outlet(v_o),'penugasan')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL I1b: penugasan yang berlaku hari ini dianggap selesai';
  END IF;

  -- I2: pesanan menggantung yang masuk SESUDAH tutup → order tetap selesai, nyasar memperingatkan
  INSERT INTO public.orders (outlet_id, order_number, total_amount, status, sales_source, created_at)
  VALUES (v_o, 90004, 1000, 'preparing', 'online', v_tutup + interval '5 days');
  r := public.status_penutupan_outlet(v_o);
  IF NOT (pg_temp.langkah(r,'order')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL I2: pesanan sesudah tutup mengunci langkah wajib order';
  END IF;
  IF (pg_temp.langkah(r,'pesanan_nyasar')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL I2b: pesanan sesudah tutup tidak muncul sebagai peringatan';
  END IF;
END $$;
SELECT 't4: LULUS' AS hasil;
ROLLBACK;
