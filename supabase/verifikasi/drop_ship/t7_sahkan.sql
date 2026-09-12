-- Uji Task 7: crew mencatat, purchasing mengesahkan. ROLLBACK.
-- Harapan: "HASIL T7: LULUS ..."
-- REPEATABLE READ: (f) menghitung ledger_stok, yang ditulis POS tiap detik.
-- Dengan snapshot tetap, baris order live tak ikut terhitung (alarm palsu).
BEGIN ISOLATION LEVEL REPEATABLE READ;
DO $$
DECLARE
  v_crew uuid; v_outlet uuid; v_purch uuid; v_bahan uuid; v_sup uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_nota uuid; v_po uuid; v_ledger_sebelum int; v_ledger_sesudah int;
  v_tagih date := (SELECT tanggal_tagihan FROM public.periode_tagihan(current_date));
  v_harga_lama numeric; v_harga_baru numeric; v_ok boolean; v_sum numeric;
BEGIN
  SELECT s.id, s.outlet_id INTO v_crew, v_outlet FROM public.outlet_staff s JOIN public.outlets o ON o.id=s.outlet_id
   WHERE o.type='test' AND s.role='crew' AND s.status='active' LIMIT 1;
  SELECT id INTO v_purch FROM public.outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE nama ILIKE '%lettuce%' LIMIT 1;
  SELECT id INTO v_sup FROM public.supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT harga_beli INTO v_harga_lama FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;
  IF v_crew IS NULL OR v_purch IS NULL OR v_bahan IS NULL OR v_sup IS NULL THEN
    RAISE EXCEPTION 'GAGAL: data uji tak ketemu (crew %, purchasing %, bahan %, supplier %)', v_crew, v_purch, v_bahan, v_sup;
  END IF;

  -- crew mencatat 3 kiriman (yang ketiga nanti ditolak Pusat)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_t1 := public.catat_terima_vendor(v_bahan, v_sup, 4, current_date, NULL, NULL);
  v_t2 := public.catat_terima_vendor(v_bahan, v_sup, 6, current_date, NULL, NULL);
  v_t3 := public.catat_terima_vendor(v_bahan, v_sup, 3, current_date, NULL, NULL);

  -- (a) crew TIDAK boleh mengesahkan
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, 10, 230000, 'https://x/nota.jpg');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a): crew bisa mengesahkan'; END IF;

  -- (a2) crew TIDAK boleh menolak catatan
  v_ok := false;
  BEGIN PERFORM public.tolak_terima_vendor(v_t3, 'uji');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a2): crew bisa menolak'; END IF;

  -- ganti ke purchasing
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (b) ringkasan memuat catatan dari outlet tes
  PERFORM 1 FROM public.ringkasan_nota_vendor(v_sup, v_tagih) r WHERE r.outlet_id=v_outlet AND r.total_qty >= 13;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (b): ringkasan tidak memuat catatan crew'; END IF;

  -- (k) tolak: stok catatan itu kembali TEPAT nol, lewat rejected_kiriman
  PERFORM public.tolak_terima_vendor(v_t3, 'uji tolak');
  SELECT sum(qty) INTO v_sum FROM public.ledger_stok WHERE ref_terima_vendor_id = v_t3;
  IF v_sum IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'GAGAL (k): sisa ledger catatan ditolak = %', v_sum; END IF;
  PERFORM 1 FROM public.ledger_stok WHERE ref_terima_vendor_id = v_t3 AND tipe = 'rejected_kiriman' AND qty < 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (k): tidak ada baris rejected_kiriman'; END IF;
  -- tolak kedua kali ditolak (sudah diproses)
  v_ok := false;
  BEGIN PERFORM public.tolak_terima_vendor(v_t3, 'lagi');
  EXCEPTION WHEN no_data_found THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (k): tolak ganda lolos'; END IF;

  -- (c) tanggal bukan tanggal tagihan ditolak
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih - 1, 10, 230000, 'https://x/nota.jpg');
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): tanggal tagihan palsu lolos'; END IF;

  -- (d) selisih tanpa catatan ditolak (nota 8 kg vs crew >= 10 kg)
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, 8, 184000, 'https://x/nota.jpg');
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): selisih tanpa catatan lolos'; END IF;

  -- (e) sahkan: total crew periode ini (termasuk catatan lain yang mungkin ada)
  SELECT count(*) INTO v_ledger_sebelum FROM public.ledger_stok;
  v_nota := public.sahkan_nota_vendor(v_sup, v_tagih,
              (SELECT sum(qty) FROM public.terima_vendor_outlet t, public.periode_tagihan(v_tagih) p
                WHERE t.supplier_id=v_sup AND t.status='dicatat' AND t.tanggal_terima BETWEEN p.mulai AND p.akhir),
              (SELECT sum(qty) FROM public.terima_vendor_outlet t, public.periode_tagihan(v_tagih) p
                WHERE t.supplier_id=v_sup AND t.status='dicatat' AND t.tanggal_terima BETWEEN p.mulai AND p.akhir) * 23000,
              'https://x/nota.jpg', NULL,
              jsonb_build_array(jsonb_build_object('outlet_id', v_outlet, 'tanggal_kirim', current_date, 'qty_kg', 10)));
  SELECT count(*) INTO v_ledger_sesudah FROM public.ledger_stok;

  -- (f) LARANGAN 1: pengesahan menulis NOL baris stok
  IF v_ledger_sesudah <> v_ledger_sebelum THEN RAISE EXCEPTION 'GAGAL (f): pengesahan menulis % baris ledger', v_ledger_sesudah - v_ledger_sebelum; END IF;

  -- (g) PO utang tercipta benar
  SELECT purchase_order_id INTO v_po FROM public.nota_vendor WHERE id=v_nota;
  PERFORM 1 FROM public.purchase_order WHERE id=v_po AND status='diterima_lengkap' AND payment_status='unpaid'
     AND jatuh_tempo=v_tagih AND nota_vendor_id=v_nota AND supplier_id=v_sup;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (g): PO utang tidak sesuai'; END IF;

  -- (h) catatan crew terkunci; catatan yang ditolak TIDAK ikut disahkan
  PERFORM 1 FROM public.terima_vendor_outlet WHERE id IN (v_t1, v_t2) AND (status<>'disahkan' OR nota_vendor_id IS DISTINCT FROM v_nota);
  IF FOUND THEN RAISE EXCEPTION 'GAGAL (h): catatan crew belum disahkan/terhubung'; END IF;
  PERFORM 1 FROM public.terima_vendor_outlet WHERE id = v_t3 AND status = 'ditolak' AND nota_vendor_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (h): catatan ditolak ikut tersahkan'; END IF;

  -- (j) nota ganda periode sama ditolak
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, 1, 23000, 'https://x/nota.jpg', 'uji');
  EXCEPTION WHEN unique_violation OR check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (j): nota ganda lolos'; END IF;

  -- (i) harga master ikut nota (23.000) + riwayat.
  -- Dibaca sebagai postgres: policy bbhh_select mengizinkan role 'purchase'
  -- (salah ketik, bukan 'purchasing') -- purchasing tak bisa MEMBACA riwayat,
  -- walau barisnya ditulis. Temuan pre-existing, bukan bagian migration ini.
  EXECUTE 'RESET ROLE';
  SELECT harga_beli INTO v_harga_baru FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;
  IF v_harga_baru <> 23000 THEN RAISE EXCEPTION 'GAGAL (i): harga master % (harapan 23000, lama %)', v_harga_baru, v_harga_lama; END IF;
  PERFORM 1 FROM public.bahan_baku_harga_history WHERE bahan_baku_id=v_bahan AND ref_po_id=v_po AND harga_baru=23000;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (i): riwayat harga tidak ditulis'; END IF;

  RAISE EXCEPTION 'HASIL T7: LULUS (crew ditolak sahkan & tolak, ringkasan, tolak membalik stok, tgl palsu, selisih, nol ledger, PO utang, terkunci, harga+riwayat, anti-ganda)';
END $$;
ROLLBACK;
