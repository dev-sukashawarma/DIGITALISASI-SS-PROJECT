-- Pindah 6 order Arif (16 Nov 2026) dari MITRA CILEUDUG ke MITRA PONDOK AREN.
-- Sebab: tablet Pondok Aren login dengan akun Arif; hari itu Arif absen di Cileudug
-- (backup), sehingga POS mencatat penjualan Pondok Aren ke Cileudug.
-- Order #1-6, Rp 196.000, 14:14-16:51 WIB. Order Cileudug sendiri (#7-9, Maulana) tidak disentuh.
--
-- Langkah:
--  1. Pembalik potongan stok di Cileudug (adjustment per bahan per order, ref_order_id sama,
--     jadi net potongan order di Cileudug = 0 dan void di kemudian hari tetap benar).
--  2. Order dipindah ke Pondok Aren, lalu status preparing -> completed agar trg_process_bom_stok
--     memotong stok Pondok Aren dengan logika & skala yang sama seperti order biasa.
-- Uji coba ROLLBACK 2026-11-16: 68 baris pembalik, net Cileudug 0, 79 potongan Pondok Aren, omzet 196.000.
-- Idempoten secara aman: asersi pertama menolak bila order sudah tidak di Cileudug.

DO $$
DECLARE
  cil uuid := '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7';
  pa  uuid := '48b980da-5a42-4a9b-a952-86ab5db6666a';
  ids uuid[] := array['e0512e2e-6ca0-4b56-bf5b-ec4c82bf788d','37366985-d42b-4cba-80f5-e7492b981d0a','303c79a2-8d4c-4bbb-9c4c-2c07c7862f83','3b7457b3-6808-46b6-98b0-0c6eef30ad29','f584f33a-af42-4d61-a7bd-8ec29afa8cd6','80ab3608-19e9-4d74-98da-e6ed820bd8b0']::uuid[];
  n int; cil_net numeric; pa_rows int; pa_omzet numeric; pa_pem_before int;
BEGIN
  SELECT count(*) INTO n FROM orders WHERE id = ANY(ids) AND outlet_id = cil AND status='completed' AND cashier_name='Arif Gustiana';
  IF n <> 6 THEN RAISE EXCEPTION 'ASERSI GAGAL: target % bukan 6', n; END IF;

  INSERT INTO ledger_stok(outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at)
  SELECT cil, l.bahan_baku_id, 'adjustment', -SUM(l.qty),
         'Koreksi salah outlet: order #' || o.order_number || ' milik MITRA PONDOK AREN (POS memakai akun Arif yang absen di Cileudug)',
         l.ref_order_id, now()
  FROM ledger_stok l JOIN orders o ON o.id = l.ref_order_id
  WHERE l.ref_order_id = ANY(ids) AND l.outlet_id = cil AND l.tipe IN ('pemakaian','adjustment')
  GROUP BY l.bahan_baku_id, l.ref_order_id, o.order_number HAVING SUM(l.qty) < 0;

  SELECT count(*) INTO pa_pem_before FROM ledger_stok WHERE ref_order_id = ANY(ids) AND outlet_id = pa;
  UPDATE orders SET outlet_id = pa, status = 'preparing' WHERE id = ANY(ids);
  UPDATE orders SET status = 'completed' WHERE id = ANY(ids);

  SELECT COALESCE(SUM(qty),0) INTO cil_net FROM ledger_stok WHERE ref_order_id = ANY(ids) AND outlet_id = cil;
  SELECT count(*) INTO pa_rows FROM ledger_stok WHERE ref_order_id = ANY(ids) AND outlet_id = pa AND tipe='pemakaian';
  SELECT SUM(total_amount) INTO pa_omzet FROM orders WHERE id = ANY(ids) AND outlet_id = pa AND status='completed';

  IF abs(cil_net) > 1e-9 THEN RAISE EXCEPTION 'ASERSI GAGAL: sisa net Cileudug %', cil_net; END IF;
  IF pa_pem_before <> 0 OR pa_rows = 0 THEN RAISE EXCEPTION 'ASERSI GAGAL: baris PA sebelum % sesudah %', pa_pem_before, pa_rows; END IF;
  IF pa_omzet <> 196000 THEN RAISE EXCEPTION 'ASERSI GAGAL: omzet PA %', pa_omzet; END IF;
END $$;
