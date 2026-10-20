-- Uji pemakaian_resep_harian (migration 20261020100000).
-- Jalankan utuh; diam = LULUS, RAISE = GAGAL. Baca-saja (ROLLBACK di akhir).
--
-- Pembanding independen ("harapan"): jumlahkan |qty| baris `pemakaian` di
-- jendela WIB, KECUALI baris milik order yang pernah dibalik (punya baris
-- `adjustment` ber-ref_order_id). Rumus ini sah bila setiap order yang dibalik
-- bersih nol dan tak ada order yang pemakaian pertamanya di hari sebelumnya —
-- prasyarat itu diperiksa dulu, bukan diasumsikan.

BEGIN;

DO $$
DECLARE
  v_outlet uuid; v_d1 date; v_d2 date; v_order uuid;
  v_beda int; v_n int; v_crew uuid;
BEGIN
  -- Fixture: order batal di outlet sungguhan yang dibalik di HARI SESUDAH
  -- pemakaiannya (kasus yang tak tertangkap klien lama maupun netting per
  -- tanggal ledger).
  SELECT p.outlet_id, p.ref_order_id,
         (min(p.created_at) AT TIME ZONE 'Asia/Jakarta')::date,
         (min(a.created_at) AT TIME ZONE 'Asia/Jakarta')::date
    INTO v_outlet, v_order, v_d1, v_d2
  FROM ledger_stok p
  JOIN ledger_stok a ON a.ref_order_id = p.ref_order_id AND a.tipe = 'adjustment'
  JOIN orders o ON o.id = p.ref_order_id AND o.status = 'cancelled'
  WHERE p.tipe = 'pemakaian' AND p.created_at >= now() - interval '30 days'
  GROUP BY p.outlet_id, p.ref_order_id
  HAVING (min(a.created_at) AT TIME ZONE 'Asia/Jakarta')::date
       > (min(p.created_at) AT TIME ZONE 'Asia/Jakarta')::date
     AND abs(sum(p.qty) FILTER (WHERE true)) > 0
  ORDER BY min(p.created_at) DESC
  LIMIT 1;
  IF v_order IS NULL THEN RAISE EXCEPTION 'fixture: tak ada order batal lintas hari'; END IF;

  -- Untuk D1 dan D2: bandingkan RPC dengan harapan independen.
  FOR v_n IN 1..2 LOOP
    DECLARE v_d date := CASE v_n WHEN 1 THEN v_d1 ELSE v_d2 END;
            v_mulai timestamptz := (v_d::timestamp AT TIME ZONE 'Asia/Jakarta');
            v_akhir timestamptz := ((v_d + 1)::timestamp AT TIME ZONE 'Asia/Jakarta');
            v_prasyarat int;
    BEGIN
      -- Prasyarat rumus harapan.
      SELECT count(*) INTO v_prasyarat FROM (
        SELECT DISTINCT l.ref_order_id FROM ledger_stok l
        WHERE l.outlet_id = v_outlet AND l.tipe = 'pemakaian'
          AND l.created_at >= v_mulai AND l.created_at < v_akhir AND l.ref_order_id IS NOT NULL
      ) o
      WHERE EXISTS (SELECT 1 FROM ledger_stok e WHERE e.ref_order_id = o.ref_order_id
                      AND e.tipe = 'pemakaian' AND e.created_at < v_mulai)
         OR (EXISTS (SELECT 1 FROM ledger_stok e WHERE e.ref_order_id = o.ref_order_id AND e.tipe = 'adjustment')
             AND (SELECT abs(sum(e.qty)) FROM ledger_stok e WHERE e.ref_order_id = o.ref_order_id
                    AND e.tipe IN ('pemakaian','adjustment')) > 0.0001);
      IF v_prasyarat > 0 THEN
        RAISE EXCEPTION 'fixture % : % order melanggar prasyarat rumus harapan', v_d, v_prasyarat;
      END IF;

      WITH harapan AS (
        SELECT l.bahan_baku_id, sum(abs(l.qty)) q FROM ledger_stok l
        WHERE l.outlet_id = v_outlet AND l.tipe = 'pemakaian'
          AND l.created_at >= v_mulai AND l.created_at < v_akhir
          AND (l.ref_order_id IS NULL OR NOT EXISTS (
                SELECT 1 FROM ledger_stok a WHERE a.ref_order_id = l.ref_order_id AND a.tipe = 'adjustment'))
        GROUP BY 1 HAVING sum(abs(l.qty)) > 0
      ), hasil AS (SELECT * FROM pemakaian_resep_harian(v_outlet, v_d))
      SELECT count(*) INTO v_beda FROM harapan h FULL JOIN hasil r USING (bahan_baku_id)
      WHERE abs(coalesce(h.q, 0) - coalesce(r.qty, 0)) > 0.0001;
      IF v_beda > 0 THEN RAISE EXCEPTION 'tanggal %: % bahan beda dari harapan', v_d, v_beda; END IF;
    END;
  END LOOP;

  -- Kontrol negatif 1: order batal itu memang menggeser angka D1 (cara lama
  -- yang hanya menjumlah `pemakaian` akan memasukkannya).
  SELECT count(*) INTO v_beda FROM (
    SELECT l.bahan_baku_id, sum(abs(l.qty)) q FROM ledger_stok l
    WHERE l.outlet_id = v_outlet AND l.tipe = 'pemakaian'
      AND l.created_at >= (v_d1::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND l.created_at <  ((v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    GROUP BY 1
  ) lama FULL JOIN pemakaian_resep_harian(v_outlet, v_d1) r USING (bahan_baku_id)
  WHERE abs(coalesce(lama.q, 0) - coalesce(r.qty, 0)) > 0.0001;
  IF v_beda = 0 THEN RAISE EXCEPTION 'kontrol negatif 1: order batal tidak berpengaruh di D1'; END IF;

  -- Kontrol negatif 2: netting per tanggal ledger (pembalik dikurangkan di D2)
  -- menghasilkan angka berbeda dari RPC di D2.
  SELECT count(*) INTO v_beda FROM (
    SELECT l.bahan_baku_id, -sum(l.qty) q FROM ledger_stok l
    WHERE l.outlet_id = v_outlet
      AND (l.tipe = 'pemakaian' OR (l.tipe = 'adjustment' AND l.ref_order_id IS NOT NULL))
      AND l.created_at >= (v_d2::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND l.created_at <  ((v_d2 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    GROUP BY 1
  ) naif FULL JOIN pemakaian_resep_harian(v_outlet, v_d2) r USING (bahan_baku_id)
  WHERE abs(coalesce(naif.q, 0) - coalesce(r.qty, 0)) > 0.0001;
  IF v_beda = 0 THEN RAISE EXCEPTION 'kontrol negatif 2: pembalik hari lain tak terdeteksi di D2'; END IF;

  -- Hak akses: anon tak boleh, authenticated boleh.
  IF has_function_privilege('anon', 'public.pemakaian_resep_harian(uuid,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon masih bisa EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.pemakaian_resep_harian(uuid,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak bisa EXECUTE';
  END IF;

  -- RLS: crew outlet lain mendapat 0 baris; crew outlet itu sendiri mendapat isi.
  SELECT s.id INTO v_crew FROM outlet_staff s
  WHERE s.role = 'crew' AND s.status = 'active' AND s.outlet_id <> v_outlet LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM pemakaian_resep_harian(v_outlet, v_d1);
  RESET ROLE;
  IF v_n <> 0 THEN RAISE EXCEPTION 'RLS: crew outlet lain melihat % baris', v_n; END IF;

  SELECT s.id INTO v_crew FROM outlet_staff s
  WHERE s.role = 'crew' AND s.status = 'active' AND s.outlet_id = v_outlet LIMIT 1;
  IF v_crew IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM pemakaian_resep_harian(v_outlet, v_d1);
    RESET ROLE;
    IF v_n = 0 THEN RAISE EXCEPTION 'RLS: crew outlet sendiri tidak melihat apa pun'; END IF;
  END IF;

  RAISE NOTICE 'LULUS — outlet %, order %, D1 %, D2 %', v_outlet, v_order, v_d1, v_d2;
END $$;

ROLLBACK;
