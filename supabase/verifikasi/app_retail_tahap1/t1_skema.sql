-- Jalankan: supabase db query --linked -f supabase/verifikasi/app_retail_tahap1/t1_skema.sql
-- Harus berakhir tanpa exception. Kontrol negatif di bagian akhir WAJIB gagal
-- bila dibuka komentarnya (buktikan asersi bisa gagal).
BEGIN;

DO $$
DECLARE
  v_outlet uuid := 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'; -- outlet tes
  v_customer uuid;
  v_order uuid := gen_random_uuid();
  v_order2 uuid := gen_random_uuid();
  v_n int;
BEGIN
  -- 1. Seed pengaturan ada & sesuai bawaan
  SELECT count(*) INTO v_n FROM app_pengaturan WHERE id = 1 AND menit_pesan_terakhir = 30 AND menit_tertahan = 10;
  IF v_n <> 1 THEN RAISE EXCEPTION 'seed app_pengaturan salah'; END IF;

  -- 2. CHECK menolak nilai di luar batas
  BEGIN
    UPDATE app_pengaturan SET menit_tertahan = 0 WHERE id = 1;
    RAISE EXCEPTION 'CHECK menit_tertahan tidak menolak 0';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 3. Trigger refund: pesanan app yang draft-nya dibayar lalu dibatalkan -> 1 baris
  SELECT id INTO v_customer FROM retail.customers LIMIT 1;
  INSERT INTO orders (id, outlet_id, status, sales_source, channel, total_amount)
    VALUES (v_order, v_outlet, 'preparing', 'app', 'app', 30000);
  INSERT INTO retail.order_drafts (client_order_id, customer_id, outlet_id, items, subtotal, discount_amount, total_amount, status, pos_order_id, paid_at, expires_at)
    VALUES (gen_random_uuid(), v_customer, v_outlet, '[]'::jsonb, 30000, 0, 30000, 'dibayar', v_order, now(), now() + interval '15 min');
  UPDATE orders SET status = 'cancelled' WHERE id = v_order;
  SELECT count(*) INTO v_n FROM retail.refund_pesanan WHERE order_id = v_order AND status = 'perlu' AND nominal = 30000;
  IF v_n <> 1 THEN RAISE EXCEPTION 'trigger refund tidak membuat baris (n=%)', v_n; END IF;

  -- 4. Batal dua kali -> tetap 1 baris
  UPDATE orders SET status = 'preparing' WHERE id = v_order;
  UPDATE orders SET status = 'cancelled' WHERE id = v_order;
  SELECT count(*) INTO v_n FROM retail.refund_pesanan WHERE order_id = v_order;
  IF v_n <> 1 THEN RAISE EXCEPTION 'refund ganda (n=%)', v_n; END IF;

  -- 5. Pesanan POS (bukan app) dibatalkan -> 0 baris
  INSERT INTO orders (id, outlet_id, status, sales_source, total_amount)
    VALUES (v_order2, v_outlet, 'preparing', 'pos', 10000);
  UPDATE orders SET status = 'cancelled' WHERE id = v_order2;
  SELECT count(*) INTO v_n FROM retail.refund_pesanan WHERE order_id = v_order2;
  IF v_n <> 0 THEN RAISE EXCEPTION 'pesanan POS ikut masuk refund'; END IF;

  -- 6. RLS: authenticated non-admin tak bisa membaca
  -- (diuji terpisah di Step 5 dengan SET LOCAL ROLE, karena DO block berjalan sebagai postgres)

  -- KONTROL NEGATIF: buka komentar baris di bawah -> WAJIB gagal
  -- IF (SELECT count(*) FROM retail.refund_pesanan WHERE order_id = v_order) <> 99 THEN RAISE EXCEPTION 'kontrol negatif jalan'; END IF;
END $$;

ROLLBACK;
