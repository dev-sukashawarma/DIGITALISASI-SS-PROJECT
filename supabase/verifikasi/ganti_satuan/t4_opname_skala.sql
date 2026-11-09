-- supabase/verifikasi/ganti_satuan/t4_opname_skala.sql — harapan: 'HASIL T4: LULUS' (P0001 lewat MCP)
-- Temuan review C1: skala qty_system/qty_fisik opname dibaca dari DATA, bukan diandaikan.
--  (a) opname transisi yang qty_system-nya tersimpan skala KECIL (form sejak 19 Agu mengonversi
--      saldo skala besar ke gram) → ×k_kecil, bukan ×k_besar.
--  (b) opname transisi qty_system skala besar → ×k_besar (perilaku lama tetap).
--  (c) opname tanpa baris ledger (selisih 0) sesudah transisi → ×k_kecil; sebelum transisi
--      (outlet tanpa transisi, qty_system = saldo skala besar) → ×k_besar.
BEGIN;
DO $$
DECLARE
  c_kg constant jsonb := '{"satuan":"Kg","satuan_kecil":"gram","isi_kecil_per_tengah":1000,"satuan_po":"Kg","satuan_distribusi":"Kg"}';
  v_admin uuid; v_o1 uuid; v_o2 uuid; v_o3 uuid; v_b uuid; v_opa uuid; v_opb uuid; v_opc uuid; v_opd uuid; r record;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_o1 FROM outlets WHERE type IN ('internal','mitra') ORDER BY name LIMIT 1;
  SELECT id INTO v_o2 FROM outlets WHERE type IN ('internal','mitra') ORDER BY name OFFSET 1 LIMIT 1;
  SELECT id INTO v_o3 FROM outlets WHERE type IN ('internal','mitra') ORDER BY name OFFSET 2 LIMIT 1;
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
                          satuan_po, satuan_distribusi, is_active)
  VALUES ('UJI T4 OPNAME','UJI','Dus','Bks',6,'Pcs',432,'Dus','Bks',true) RETURNING id INTO v_b;

  -- o1: transisi dengan qty_system skala KECIL (2 Dus tersimpan 864), lalu opname selisih 0 tanpa ledger
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o1, v_b, 'adjustment', 2, 'uji t4', '2026-08-20 10:00+07');
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_at, finalized_at)
  VALUES (v_o1, '2026-09-01', 'ad_hoc', 'finalized', '2026-09-01 20:00+07', '2026-09-01 21:00+07') RETURNING id INTO v_opa;
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_system, qty_fisik) VALUES (v_opa, v_b, 864, 800);
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, ref_opname_id, created_at)
  VALUES (v_o1, v_b, 'opname_selisih', 798, 'uji t4', v_opa, '2026-09-01 21:00+07');
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_at, finalized_at)
  VALUES (v_o1, '2026-09-02', 'ad_hoc', 'finalized', '2026-09-02 20:00+07', '2026-09-02 21:00+07') RETURNING id INTO v_opc;
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_system, qty_fisik) VALUES (v_opc, v_b, 800, 800);

  -- o2: transisi dengan qty_system skala BESAR (2), qty_fisik kecil (800)
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o2, v_b, 'adjustment', 2, 'uji t4', '2026-08-20 10:00+07');
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_at, finalized_at)
  VALUES (v_o2, '2026-09-01', 'ad_hoc', 'finalized', '2026-09-01 20:00+07', '2026-09-01 21:00+07') RETURNING id INTO v_opb;
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_system, qty_fisik) VALUES (v_opb, v_b, 2, 800);
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, ref_opname_id, created_at)
  VALUES (v_o2, v_b, 'opname_selisih', 798, 'uji t4', v_opb, '2026-09-01 21:00+07');

  -- o3: tak pernah transisi; opname selisih 0 dengan qty_system = saldo skala besar (3)
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o3, v_b, 'adjustment', 3, 'uji t4', '2026-08-20 10:00+07');
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_at, finalized_at)
  VALUES (v_o3, '2026-09-03', 'ad_hoc', 'finalized', '2026-09-03 20:00+07', '2026-09-03 21:00+07') RETURNING id INTO v_opd;
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_system, qty_fisik) VALUES (v_opd, v_b, 3, 3);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.ganti_satuan_bahan(v_b, c_kg, 6, 'uji t4');
  RESET ROLE;

  SELECT * INTO r FROM opname_item WHERE opname_id = v_opa;
  IF abs(r.qty_system - 5184) > 1e-9 OR abs(r.qty_fisik - 4800) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (a): transisi qty_system kecil %', row_to_json(r); END IF;
  SELECT * INTO r FROM opname_item WHERE opname_id = v_opb;
  IF abs(r.qty_system - 5.184) > 1e-9 OR abs(r.qty_fisik - 4800) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (b): transisi qty_system besar %', row_to_json(r); END IF;
  SELECT * INTO r FROM opname_item WHERE opname_id = v_opc;
  IF abs(r.qty_system - 4800) > 1e-9 OR abs(r.qty_fisik - 4800) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (c): sesudah transisi tanpa ledger %', row_to_json(r); END IF;
  SELECT * INTO r FROM opname_item WHERE opname_id = v_opd;
  IF abs(r.qty_system - 7.776) > 1e-9 OR abs(r.qty_fisik - 7.776) > 1e-9 THEN
    RAISE EXCEPTION 'GAGAL (c): tanpa transisi %', row_to_json(r); END IF;

  RAISE EXCEPTION 'HASIL T4: LULUS';
END $$;
ROLLBACK;
