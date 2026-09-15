-- supabase/verifikasi/hpp_dinamis/t2_harga_efektif.sql
-- Harapan: "HASIL T2: LULUS ..."
BEGIN;
DO $$
DECLARE v_empang uuid; v_bahan uuid; v_sj uuid; r record; v_ok boolean;
        v_bahan_tanpa_harga uuid; v_crew uuid;
BEGIN
  SELECT id INTO v_empang FROM outlets WHERE name='SUKA SHAWARMA EMPANG';
  -- bahan dengan kiriman terverifikasi ke Empang di September
  SELECT sji.bahan_baku_id, sj.id INTO v_bahan, v_sj
  FROM surat_jalan_item sji JOIN surat_jalan sj ON sj.id=sji.surat_jalan_id
  WHERE sj.outlet_id=v_empang AND sji.qty_terima>0 AND sji.harga_snapshot>0
    AND sj.created_at >= '2026-09-01' ORDER BY sj.created_at DESC LIMIT 1;
  IF v_bahan IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture kiriman Empang'; END IF;

  -- (a) tanggal hari ini -> tingkat 1 'kiriman', ref = SJ terbaru
  SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan, current_date);
  IF r.sumber_harga <> 'kiriman' THEN RAISE EXCEPTION 'GAGAL (a): sumber % bukan kiriman', r.sumber_harga; END IF;
  IF r.harga_besar <= 0 OR r.harga_kecil <= 0 OR r.harga_kecil > r.harga_besar THEN
    RAISE EXCEPTION 'GAGAL (a): harga besar % kecil %', r.harga_besar, r.harga_kecil; END IF;

  -- (b) tanggal 2026-08-15 (sebelum snapshot bersih) -> bukan 'kiriman' September
  SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan, '2026-08-15');
  IF r.ref_tanggal IS NOT NULL AND r.ref_tanggal > '2026-08-15' THEN
    RAISE EXCEPTION 'GAGAL (b): memakai referensi masa depan %', r.ref_tanggal; END IF;

  -- (c) outlet tanpa kiriman bahan ini (Gudang Pusat sendiri) -> master_historis/master_sekarang
  SELECT * INTO r FROM harga_bahan_efektif('d23e11b3-23f1-4f9a-b428-cc73e1aa9b90', v_bahan, current_date);
  IF r.sumber_harga NOT IN ('master_historis','master_sekarang','drop_ship') THEN
    RAISE EXCEPTION 'GAGAL (c): sumber % untuk gudang', r.sumber_harga; END IF;

  -- (d) bahan tanpa harga master sama sekali -> 'tidak_ada', harga 0
  SELECT b.id INTO v_bahan_tanpa_harga FROM bahan_baku b
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id=b.id
  WHERE bh.bahan_baku_id IS NULL AND NOT EXISTS (SELECT 1 FROM bahan_baku_harga_history h WHERE h.bahan_baku_id=b.id)
  LIMIT 1;
  IF v_bahan_tanpa_harga IS NOT NULL THEN
    SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan_tanpa_harga, current_date);
    IF r.sumber_harga <> 'tidak_ada' OR r.harga_besar <> 0 THEN
      RAISE EXCEPTION 'GAGAL (d): % / %', r.sumber_harga, r.harga_besar; END IF;
  END IF;

  -- (e) crew tidak boleh memanggil can_view_hpp_dinamis = true
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF public.can_view_hpp_dinamis() THEN RAISE EXCEPTION 'GAGAL (e): crew lolos gate'; END IF;
  EXECUTE 'RESET ROLE';

  -- (f) kontrol negatif
  v_ok := false;
  BEGIN
    SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan, current_date);
    IF r.sumber_harga = 'kiriman' THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): kontrol negatif tidak melempar'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (kiriman, batas tanggal, gudang fallback, tidak_ada, gate crew, kontrol negatif)';
END $$;
ROLLBACK;
