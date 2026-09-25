-- Jalankan: supabase db query --linked -f supabase/verifikasi/app_retail_voucher/t1_skema.sql
-- Semua di dalam transaksi + ROLLBACK: nol perubahan nyata.
BEGIN;
DO $$
DECLARE v uuid; d uuid; c uuid; ok boolean;
BEGIN
  -- (a) persen tanpa nilai ditolak CHECK
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis) VALUES ('uji', 'persen');
    RAISE EXCEPTION 'GAGAL (a): persen tanpa nilai lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (b) gratis_item tanpa menu ditolak
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis) VALUES ('uji', 'gratis_item');
    RAISE EXCEPTION 'GAGAL (b): gratis_item tanpa menu lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (c) beli_x_gratis_y tanpa menu_ids ditolak
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis, beli_qty, gratis_qty) VALUES ('uji', 'beli_x_gratis_y', 2, 1);
    RAISE EXCEPTION 'GAGAL (c): beli_x tanpa menu_ids lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (d) persen sah diterima; kode disimpan huruf besar & unik tanpa beda huruf
  INSERT INTO retail.vouchers (nama, jenis, nilai, kode) VALUES ('uji', 'persen', 10, 'HEMAT10') RETURNING id INTO v;
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis, nilai, kode) VALUES ('uji2', 'persen', 10, 'hemat10');
    RAISE EXCEPTION 'GAGAL (d): kode kembar beda huruf lolos';
  EXCEPTION WHEN unique_violation OR check_violation THEN NULL; END;

  -- (e) voucher yang punya pemakaian tidak bisa dihapus
  SELECT id INTO d FROM retail.order_drafts LIMIT 1;
  SELECT customer_id INTO c FROM retail.order_drafts WHERE id = d;
  INSERT INTO retail.voucher_pemakaian (voucher_id, draft_id, customer_id, potongan) VALUES (v, d, c, 1000);
  BEGIN
    DELETE FROM retail.vouchers WHERE id = v;
    RAISE EXCEPTION 'GAGAL (e): voucher terpakai terhapus';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  -- (f) ringkasan hanya menghitung yang lunas
  SELECT (terpakai = 0) INTO ok FROM retail.voucher_ringkasan WHERE voucher_id = v;
  IF NOT ok THEN RAISE EXCEPTION 'GAGAL (f): belum lunas ikut terhitung'; END IF;
  UPDATE retail.voucher_pemakaian SET lunas_at = now() WHERE voucher_id = v;
  SELECT (terpakai = 1 AND total_potongan = 1000) INTO ok FROM retail.voucher_ringkasan WHERE voucher_id = v;
  IF NOT ok THEN RAISE EXCEPTION 'GAGAL (f2): lunas tidak terhitung'; END IF;

  -- (g) aksi log baru diterima
  INSERT INTO public.app_retail_log (aksi, oleh, sasaran_id, data)
  VALUES ('voucher_buat', (SELECT id FROM public.outlet_staff LIMIT 1), v, '{}'::jsonb);

  -- (h) anon & authenticated tak punya hak apa pun
  IF has_table_privilege('anon', 'retail.vouchers', 'SELECT')
     OR has_table_privilege('authenticated', 'retail.vouchers', 'SELECT')
     OR has_table_privilege('authenticated', 'retail.voucher_pemakaian', 'INSERT') THEN
    RAISE EXCEPTION 'GAGAL (h): hak akses klien terbuka';
  END IF;

  RAISE NOTICE 'LULUS t1_skema';
END $$;
ROLLBACK;
