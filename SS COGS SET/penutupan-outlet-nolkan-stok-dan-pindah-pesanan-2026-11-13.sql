-- Penutupan outlet (SOP docs/SOP-PENUTUPAN-OUTLET.md), keputusan owner 13 Nov 2026.
--
-- A. Sisa stok 4 outlet yang sudah tutup dinolkan lewat ledger `adjustment`
--    (bukan UPDATE stok_balance; trigger ledger_stamp_saldo yang mengurus saldo).
--    Barangnya secara fisik sudah tidak ada. Laporan laba TIDAK berubah (HPP
--    laba dihitung dari resep x penjualan, bukan dari stok); yang berubah hanya
--    Nilai Persediaan. Dicatat bertanggal hari dijalankan (November, belum closing).
-- B. 3 pesanan website November yang nyasar ke SAWANGAN (INTERNAL) dipindah ke
--    MITRA SAWANGAN DTC. Potongan stoknya sudah tercatat di DTC sejak awal,
--    jadi hanya baris orders yang dipindah. Bulan yang sudah closing tak disentuh.
--
-- p_jalankan = false -> uji coba (semua dibatalkan di akhir, ringkasan di pesan galat).
-- Alert stok (bot/push) dimatikan dalam transaksi lewat GUC app.ganti_satuan.
-- Idempoten: jalan ulang tak menemukan saldo <> 0 / pesanan di outlet lama -> ditolak penjaga.

DO $$
DECLARE
  p_jalankan constant boolean := true;    -- SUDAH DIJALANKAN 13 Nov 2026 — jangan diulang (penjaga menolak jalan ulang)

  c_outlets constant uuid[] := ARRAY[
    '550e8400-e29b-41d4-a716-446655440008',  -- SUKA SHAWARMA SAWANGAN (INTERNAL)
    '550e8400-e29b-41d4-a716-446655440017',  -- MITRA CISEENG
    '550e8400-e29b-41d4-a716-446655440012',  -- SUKA SHAWARMA JATIASIH
    '550e8400-e29b-41d4-a716-446655440005'   -- SUKA SHAWARMA DEPOK SUKMAJAYA
  ]::uuid[];
  c_lama   constant uuid := '550e8400-e29b-41d4-a716-446655440008';
  c_dtc    constant uuid := '5a4df577-5237-476e-b54c-9eb642a5a516';
  c_orders constant uuid[] := ARRAY[
    'adac90ee-d99f-40c7-a35a-f8d71af14846',  -- #40  1 Nov  Rp 34.204
    '576aeb1f-83ff-46b1-942f-23b23d15c37d',  -- #13  8 Nov  Rp 44.264
    'a967e27b-8b33-491b-8b1e-022d9ebbab5c'   -- #27  8 Nov  Rp 29.174
  ]::uuid[];

  v_n int; v_baris int; v_nilai numeric; v_sisa numeric; v_ringkas text;
BEGIN
  PERFORM set_config('app.ganti_satuan', 'on', true);

  -- ---------- Penjaga ----------
  SELECT count(*) INTO v_n FROM outlets
   WHERE id = ANY(c_outlets) AND is_active = false AND type IN ('internal','mitra');
  IF v_n <> 4 THEN RAISE EXCEPTION 'PENJAGA: harus 4 outlet nonaktif, ketemu %', v_n; END IF;

  SELECT count(*) INTO v_n FROM orders
   WHERE id = ANY(c_orders) AND outlet_id = c_lama AND status = 'completed';
  IF v_n <> 3 THEN RAISE EXCEPTION 'PENJAGA: 3 pesanan harus masih di outlet lama, ketemu %', v_n; END IF;

  SELECT count(*) INTO v_n FROM ledger_stok
   WHERE ref_order_id = ANY(c_orders) AND outlet_id <> c_dtc;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PENJAGA: % baris ledger pesanan bukan di DTC', v_n; END IF;

  SELECT count(*), round(coalesce(sum(nilai),0))
    INTO v_baris, v_nilai
    FROM nilai_persediaan_spv WHERE outlet_id = ANY(c_outlets);

  SELECT string_agg(format('%s: %s baris', o.name, x.n), '; ' ORDER BY o.name) INTO v_ringkas
    FROM (SELECT outlet_id, count(*) n FROM stok_balance
           WHERE outlet_id = ANY(c_outlets) AND saldo <> 0 GROUP BY 1) x
    JOIN outlets o ON o.id = x.outlet_id;
  IF v_ringkas IS NULL THEN RAISE EXCEPTION 'PENJAGA: tidak ada saldo untuk dinolkan (sudah dijalankan?)'; END IF;

  -- ---------- A. Nolkan stok ----------
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  SELECT b.outlet_id, b.bahan_baku_id, 'adjustment', -b.saldo,
         'Penutupan outlet: sisa stok dinolkan, barang fisik sudah tidak ada (SOP Penutupan Outlet, keputusan owner 13 Nov 2026)'
    FROM stok_balance b
   WHERE b.outlet_id = ANY(c_outlets) AND b.saldo <> 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  SELECT coalesce(sum(abs(saldo)),0) INTO v_sisa FROM stok_balance WHERE outlet_id = ANY(c_outlets);
  IF v_sisa <> 0 THEN RAISE EXCEPTION 'ASERSI GAGAL: sisa saldo % setelah dinolkan', v_sisa; END IF;

  -- ---------- B. Pindah 3 pesanan ke DTC ----------
  UPDATE orders SET outlet_id = c_dtc WHERE id = ANY(c_orders) AND outlet_id = c_lama;
  SELECT count(*) INTO v_baris FROM orders WHERE id = ANY(c_orders) AND outlet_id = c_dtc;
  IF v_baris <> 3 THEN RAISE EXCEPTION 'ASERSI GAGAL: hanya % pesanan pindah', v_baris; END IF;

  IF NOT p_jalankan THEN
    RAISE EXCEPTION 'UJI COBA OK (dibatalkan). Ledger adjustment: % baris [%]. Nilai persediaan dinolkan: Rp %. Pesanan pindah ke DTC: 3.',
      v_n, v_ringkas, v_nilai;
  END IF;
  RAISE NOTICE 'SELESAI. Ledger adjustment: % baris. Nilai persediaan dinolkan: Rp %.', v_n, v_nilai;
END $$;
