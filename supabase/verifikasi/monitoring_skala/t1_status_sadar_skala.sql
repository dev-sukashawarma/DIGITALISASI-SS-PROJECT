-- Uji migration 20261026140000_monitoring_status_sadar_skala.
-- Jalankan SESUDAH migration (atau dalam transaksi yang sama lalu ROLLBACK).
-- Lulus = tidak ada exception. Kontrol negatif: jalankan SEBELUM migration ->
-- harus gagal di asersi (b) karena kolom current_qty_besar belum ada / (c).
--
-- View terskop accessible_outlet_ids(): tanpa sesi hasilnya kosong, jadi
-- pasang klaim akun admin dulu (admin = semua outlet).

DO $$
DECLARE
  v_total      int;
  v_gram       int;
  v_salah      int;
  v_kecil_ok   int;
  v_crew_beda  int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1),
                      'role', 'authenticated')::text, true);

  SELECT count(*), count(*) FILTER (WHERE saldo_is_gram) INTO v_total, v_gram
  FROM monitoring_view_spv;

  -- (a) view terbaca dan memuat baris skala kecil
  IF v_total = 0 OR v_gram = 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (a): view kosong atau tanpa baris gram (total %, gram %)', v_total, v_gram;
  END IF;

  -- (b) current_qty_besar = saldo / faktor_tampilan untuk baris gram, = saldo untuk lainnya
  SELECT count(*) INTO v_salah
  FROM monitoring_view_spv v JOIN bahan_baku b ON b.id = v.bahan_baku_id
  WHERE v.current_qty_besar IS DISTINCT FROM
        CASE WHEN v.saldo_is_gram AND b.faktor_tampilan > 0 THEN v.current_qty / b.faktor_tampilan ELSE v.current_qty END;
  IF v_salah > 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (b): % baris current_qty_besar salah', v_salah;
  END IF;

  -- (c) tidak ada baris yang `ok` padahal saldo satuan besar < threshold
  SELECT count(*) INTO v_salah
  FROM monitoring_view_spv
  WHERE status = 'ok' AND current_qty_besar < threshold;
  IF v_salah > 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (c): % baris ok padahal di bawah threshold', v_salah;
  END IF;

  -- (d) cabang below/warning memakai satuan besar
  SELECT count(*) INTO v_salah
  FROM monitoring_view_spv
  WHERE (current_qty_besar < threshold / 2.0 AND status <> 'below')
     OR (status = 'warning' AND current_qty_besar >= threshold);
  IF v_salah > 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (d): % baris status tak sesuai satuan besar', v_salah;
  END IF;

  -- (e) baris skala kecil yang dulu lolos sebagai ok kini tertangkap (bukti
  --     perbaikan benar-benar menyentuh kasusnya, bukan kebetulan nol)
  SELECT count(*) INTO v_kecil_ok
  FROM monitoring_view_spv
  WHERE saldo_is_gram AND current_qty >= threshold AND current_qty_besar < threshold
    AND status IN ('below', 'warning');
  IF v_kecil_ok = 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (e): tak ada baris gram yang dulu salah ok kini tertangkap';
  END IF;

  -- (f) view crew memberi status & current_qty_besar identik untuk baris yang sama
  SELECT count(*) INTO v_crew_beda
  FROM monitoring_view_spv s JOIN monitoring_view_crew c
    ON c.outlet_id = s.outlet_id AND c.bahan_baku_id = s.bahan_baku_id
  WHERE c.status IS DISTINCT FROM s.status
     OR c.current_qty_besar IS DISTINCT FROM s.current_qty_besar
     OR c.projection_text IS DISTINCT FROM s.projection_text;
  IF v_crew_beda > 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (f): % baris crew beda dengan spv', v_crew_beda;
  END IF;

  RAISE NOTICE 'LULUS: total %, gram %, gram dulu-salah-ok kini tertangkap %', v_total, v_gram, v_kecil_ok;
END $$;
