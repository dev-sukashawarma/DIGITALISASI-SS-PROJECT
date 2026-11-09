-- supabase/verifikasi/ganti_satuan/t2_pratinjau.sql — harapan: berakhir dengan 'HASIL T2: LULUS'
-- (dilempar sebagai EXCEPTION P0001 agar terlihat lewat konektor MCP; galat lain = gagal).
-- Task 2: _rencana_ganti_satuan + pratinjau_ganti_satuan (read-only).
BEGIN;
DO $$
DECLARE
  c_bawang constant uuid := '516dd4a9-65df-4e58-adf6-d0e1f15ad9b5';
  c_baru   constant jsonb := '{"satuan":"Kg","satuan_tengah":null,"faktor_tengah":null,"satuan_kecil":"gram","isi_kecil_per_tengah":1000,"satuan_po":"Kg","satuan_distribusi":"Kg"}';
  v_admin uuid; v_crew uuid; v_p jsonb; v_row jsonb; v_ok boolean; v_draft int; v_n0 bigint; v_upd0 timestamptz;
  v_bahan uuid; v_peng uuid; v_lama numeric; v_baru_saldo numeric;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  SELECT count(DISTINCT o.id) INTO v_draft FROM opname o JOIN opname_item i ON i.opname_id = o.id
   WHERE i.bahan_baku_id = c_bawang AND o.status IN ('draft','pending_approval');
  SELECT count(*) INTO v_n0 FROM ledger_stok WHERE bahan_baku_id = c_bawang;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_p := public.pratinjau_ganti_satuan(c_bawang, c_baru, 6);
  RESET ROLE;

  -- (a) faktor
  IF abs((v_p->>'k_besar')::numeric - 2.592) > 1e-9 OR (v_p->>'k_kecil')::numeric <> 6 THEN
    RAISE EXCEPTION 'GAGAL (a): k_besar % k_kecil %', v_p->>'k_besar', v_p->>'k_kecil';
  END IF;
  IF (v_p->>'faktor_tampilan_baru')::numeric <> 1000 OR (v_p->>'faktor_tampilan_lama')::numeric <> 432 THEN
    RAISE EXCEPTION 'GAGAL (a): faktor tampilan %', v_p;
  END IF;

  -- (b) penghalang draft opname sebanyak draft aktual
  IF (SELECT count(*) FROM jsonb_array_elements(v_p->'penghalang') e WHERE e->>'jenis' = 'opname_draft') <> v_draft THEN
    RAISE EXCEPTION 'GAGAL (b): penghalang opname_draft % vs aktual %', v_p->'penghalang', v_draft;
  END IF;

  -- (c) saldo per lokasi: Sawangan (Internal) skala kecil ×6, BNR skala besar ×2.592
  SELECT e INTO v_row FROM jsonb_array_elements(v_p->'saldo') e WHERE e->>'outlet' ILIKE '%SAWANGAN (INTERNAL)%';
  IF v_row->>'skala' <> 'kecil' OR abs((v_row->>'saldo_baru')::numeric - (v_row->>'saldo_lama')::numeric * 6) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (c): Sawangan %', v_row;
  END IF;
  SELECT e INTO v_row FROM jsonb_array_elements(v_p->'saldo') e WHERE e->>'outlet' = 'SUKA SHAWARMA BNR';
  IF v_row->>'skala' <> 'besar' OR abs((v_row->>'saldo_baru')::numeric - (v_row->>'saldo_lama')::numeric * 2.592) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (c): BNR %', v_row;
  END IF;

  -- (d) harga master & jumlah
  IF abs((v_p->>'harga_master_baru')::numeric - 400000 / 2.592) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (d): harga %', v_p->>'harga_master_baru';
  END IF;
  IF (v_p->'jumlah'->>'ledger')::bigint <> v_n0 THEN RAISE EXCEPTION 'GAGAL (d): jumlah ledger %', v_p->'jumlah'; END IF;

  -- (e) read-only: tak ada perubahan
  IF (SELECT count(*) FROM ledger_stok WHERE bahan_baku_id = c_bawang) <> v_n0
     OR (SELECT satuan FROM bahan_baku WHERE id = c_bawang) <> 'Dus' THEN
    RAISE EXCEPTION 'GAGAL (e): pratinjau menulis data';
  END IF;

  -- (f) masukan salah → 22023
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.pratinjau_ganti_satuan(c_bawang, c_baru, 0);
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): jembatan 0 diterima'; END IF;
  v_ok := false;
  BEGIN PERFORM public.pratinjau_ganti_satuan(c_bawang, c_baru || '{"satuan_kecil":null}', 6);
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): satuan kecil kosong diterima'; END IF;
  v_ok := false;
  BEGIN PERFORM public.pratinjau_ganti_satuan(c_bawang, c_baru || '{"nama":"x"}', 6);
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): kunci asing diterima'; END IF;
  RESET ROLE;

  -- (g) crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.pratinjau_ganti_satuan(c_bawang, c_baru, 6);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): crew lolos'; END IF;

  -- (h) substitusi: penghalang bila satuan kecil berganti (k_kecil <> 1), tidak bila 1
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_kecil, faktor_tampilan, is_active)
  VALUES ('UJI T2 UTAMA', 'UJI', 'Dus', 'Pcs', 10, true) RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_kecil, faktor_tampilan, is_active)
  VALUES ('UJI T2 PENGGANTI', 'UJI', 'Dus', 'Pcs', 10, true) RETURNING id INTO v_peng;
  INSERT INTO bahan_baku_substitusi (bahan_baku_utama_id, bahan_baku_pengganti_id, urutan) VALUES (v_bahan, v_peng, 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_p := public.pratinjau_ganti_satuan(v_peng,
    '{"satuan":"Dus","satuan_kecil":"gram","isi_kecil_per_tengah":50,"satuan_po":"Dus","satuan_distribusi":"Dus"}', 5);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_p->'penghalang') e WHERE e->>'jenis' = 'substitusi') THEN
    RAISE EXCEPTION 'GAGAL (h): substitusi tak menghalangi jembatan 5';
  END IF;
  v_p := public.pratinjau_ganti_satuan(v_peng,
    '{"satuan":"Dus","satuan_kecil":"Pcs","isi_kecil_per_tengah":12,"satuan_po":"Dus","satuan_distribusi":"Dus"}', 1);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_p->'penghalang') e WHERE e->>'jenis' = 'substitusi') THEN
    RAISE EXCEPTION 'GAGAL (h): substitusi menghalangi jembatan 1';
  END IF;
  RESET ROLE;

  RAISE EXCEPTION 'HASIL T2: LULUS (draft=%)', v_draft;
END $$;
ROLLBACK;
