-- t2 — status_penutupan_outlet (migration 20261113201000)
-- Seluruhnya di dalam BEGIN … ROLLBACK. Bertindak sebagai Admin Dev lewat klaim JWT.
-- Sebelum migration: gagal (fungsi tidak ada). Sesudah: baris 't2: LULUS'.
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"6440a568-d9f3-45d3-b7d7-16e4b3166ab2","role":"authenticated"}', true);
SELECT set_config('app.ganti_satuan', 'on', true);

CREATE FUNCTION pg_temp.langkah(r jsonb, k text) RETURNS jsonb LANGUAGE sql AS
$$ SELECT e FROM jsonb_array_elements(r->'langkah') e WHERE e->>'kunci' = k $$;

DO $$
DECLARE
  v_o     uuid;
  v_m     uuid;
  v_crew  uuid;
  v_asal  uuid;
  v_bahan uuid;
  v_ord   uuid;
  v_tutup timestamptz := now() - interval '3 days';
  r       jsonb;
BEGIN
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T2', 'uji-tutup-t2', 'internal', 'active', true, 'Jl. Uji') RETURNING id INTO v_o;
  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets SET status='inactive', is_active=false, nonaktif_at=v_tutup,
         alasan_tutup='uji t2 penutupan', app_enabled=false WHERE id = v_o;
  PERFORM set_config('app.penutupan_outlet', '', true);

  -- (a) awal: tanpa centang manual → belum siap
  r := public.status_penutupan_outlet(v_o);
  IF (r->>'siap_selesai')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL a: siap tanpa centang'; END IF;
  IF (pg_temp.langkah(r,'kanal_online')->>'manual')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'ASERSI GAGAL a2: kanal_online bukan manual'; END IF;
  IF pg_temp.langkah(r,'mitra') IS NOT NULL THEN RAISE EXCEPTION 'ASERSI GAGAL a3: outlet internal punya langkah mitra'; END IF;

  -- (b) crew aktif → belum; dipindah → selesai
  SELECT id, outlet_id INTO v_crew, v_asal FROM public.outlet_staff WHERE role='crew' AND status='active' AND outlet_id IS NOT NULL LIMIT 1;
  UPDATE public.outlet_staff SET outlet_id = v_o WHERE id = v_crew;
  IF (pg_temp.langkah(public.status_penutupan_outlet(v_o),'crew')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL b: crew aktif dianggap selesai';
  END IF;
  UPDATE public.outlet_staff SET outlet_id = v_asal WHERE id = v_crew;
  IF NOT (pg_temp.langkah(public.status_penutupan_outlet(v_o),'crew')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL b2: crew sudah dipindah tapi belum selesai';
  END IF;

  -- (c) order macet 40 hari sebelum tutup → abaikan; 2 hari sebelum → belum
  INSERT INTO public.orders (outlet_id, order_number, total_amount, status, created_at)
  VALUES (v_o, 90001, 1000, 'preparing', v_tutup - interval '40 days');
  IF NOT (pg_temp.langkah(public.status_penutupan_outlet(v_o),'order')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL c: order macet 40 hari lalu mengunci';
  END IF;
  INSERT INTO public.orders (outlet_id, order_number, total_amount, status, created_at)
  VALUES (v_o, 90002, 1000, 'preparing', v_tutup - interval '2 days') RETURNING id INTO v_ord;
  IF (pg_temp.langkah(public.status_penutupan_outlet(v_o),'order')->>'selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL c2: order macet 2 hari sebelum tutup diabaikan';
  END IF;
  DELETE FROM public.orders WHERE id = v_ord;

  -- (d) pesanan sesudah tutup → peringatan saja
  INSERT INTO public.orders (outlet_id, order_number, total_amount, status, sales_source, created_at)
  VALUES (v_o, 90003, 1000, 'completed', 'online', v_tutup + interval '1 day');
  r := public.status_penutupan_outlet(v_o);
  IF (pg_temp.langkah(r,'pesanan_nyasar')->>'selesai')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL d: nyasar dianggap selesai'; END IF;
  IF (pg_temp.langkah(r,'pesanan_nyasar')->>'wajib')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL d2: nyasar wajib'; END IF;
  IF position('online' in pg_temp.langkah(r,'pesanan_nyasar')->>'info') = 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL d3: info nyasar tanpa kanal: %', pg_temp.langkah(r,'pesanan_nyasar')->>'info';
  END IF;

  -- (e) saldo stok → belum, info diawali "1 bahan"
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE is_active LIMIT 1;
  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  VALUES (v_o, v_bahan, 'adjustment', 5, 'uji t2');
  r := public.status_penutupan_outlet(v_o);
  IF (pg_temp.langkah(r,'stok')->>'selesai')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL e: stok bersaldo dianggap selesai'; END IF;
  IF (pg_temp.langkah(r,'stok')->>'info') NOT LIKE '1 bahan%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL e2: info stok "%"', pg_temp.langkah(r,'stok')->>'info';
  END IF;
  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  VALUES (v_o, v_bahan, 'adjustment', -5, 'uji t2');

  -- (f) semua beres + centang manual wajib → siap
  INSERT INTO public.outlet_penutupan_centang (outlet_id, kunci) VALUES (v_o, 'kanal_online'), (v_o, 'merchant_ojol');
  r := public.status_penutupan_outlet(v_o);
  IF NOT (r->>'siap_selesai')::boolean THEN
    RAISE EXCEPTION 'ASERSI GAGAL f: belum siap, kurang: %',
      (SELECT string_agg(e->>'kunci', ', ') FROM jsonb_array_elements(r->'langkah') e
        WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean);
  END IF;

  -- outlet mitra butuh centang 'mitra'
  INSERT INTO public.outlets (name, slug, type, status, is_active, address)
  VALUES ('UJI TUTUP T2 M', 'uji-tutup-t2-m', 'mitra', 'active', true, 'Jl. Uji') RETURNING id INTO v_m;
  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets SET status='inactive', is_active=false, nonaktif_at=v_tutup, alasan_tutup='uji t2 mitra', app_enabled=false WHERE id = v_m;
  PERFORM set_config('app.penutupan_outlet', '', true);
  INSERT INTO public.outlet_penutupan_centang (outlet_id, kunci) VALUES (v_m, 'kanal_online'), (v_m, 'merchant_ojol');
  IF (public.status_penutupan_outlet(v_m)->>'siap_selesai')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL f2: mitra siap tanpa centang mitra'; END IF;
  INSERT INTO public.outlet_penutupan_centang (outlet_id, kunci) VALUES (v_m, 'mitra');
  IF NOT (public.status_penutupan_outlet(v_m)->>'siap_selesai')::boolean THEN RAISE EXCEPTION 'ASERSI GAGAL f3: mitra belum siap'; END IF;

  -- (g) crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.status_penutupan_outlet(v_o);
    RAISE EXCEPTION 'ASERSI GAGAL g: crew bisa membaca status penutupan';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT 't2: LULUS' AS hasil;
ROLLBACK;
