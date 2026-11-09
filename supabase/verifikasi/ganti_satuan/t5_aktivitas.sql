-- supabase/verifikasi/ganti_satuan/t5_aktivitas.sql — harapan: 'HASIL T5: LULUS' (P0001 lewat MCP)
-- Review I1: pratinjau melaporkan jumlah baris ledger bahan ini 15 menit terakhir, supaya admin
-- tidak mengganti satuan saat stok bahan sedang bergerak (transaksi yang berjalan bersamaan
-- membaca faktor lama dan menulis angka skala lama sesudah konversi selesai).
BEGIN;
DO $$
DECLARE v_admin uuid; v_p jsonb; v_o uuid; v_b uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_o FROM outlets WHERE type IN ('internal','mitra') ORDER BY name LIMIT 1;
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_kecil, faktor_tampilan, is_active)
  VALUES ('UJI T5 AKTIVITAS','UJI','Dus','Pcs',10,true) RETURNING id INTO v_b;
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES (v_o, v_b, 'adjustment', 1, 'uji t5');
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
  VALUES (v_o, v_b, 'adjustment', 1, 'uji t5 lama', now() - interval '1 hour');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_p := public.pratinjau_ganti_satuan(v_b,
    '{"satuan":"Kg","satuan_kecil":"gram","isi_kecil_per_tengah":1000,"satuan_po":"Kg","satuan_distribusi":"Kg"}', 6);
  RESET ROLE;
  IF NOT (v_p ? 'aktivitas_15_menit') THEN RAISE EXCEPTION 'GAGAL: pratinjau tanpa aktivitas_15_menit'; END IF;
  IF (v_p->>'aktivitas_15_menit')::int <> 1 THEN RAISE EXCEPTION 'GAGAL: aktivitas %', v_p->'aktivitas_15_menit'; END IF;
  RAISE EXCEPTION 'HASIL T5: LULUS';
END $$;
ROLLBACK;
