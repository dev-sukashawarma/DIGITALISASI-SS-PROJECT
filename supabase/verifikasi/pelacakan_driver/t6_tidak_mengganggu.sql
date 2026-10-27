-- Uji: galat apa pun di pelacakan TIDAK boleh menggagalkan perubahan status SJ
-- (verifikasi outlet / validasi pusat / batal) — alur stok yang sudah berjalan.
-- Pelacakan dipaksa galat dengan mengganti _pelacakan_hitung_km (di dalam transaksi ini saja).
-- Harapan: error P0001 "HASIL T6: LULUS ...".
BEGIN;
CREATE OR REPLACE FUNCTION public._pelacakan_hitung_km(p_id uuid) RETURNS numeric
LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'galat pelacakan buatan'; END $f$;
DO $$
DECLARE v_driver uuid; o1 uuid; sj1 uuid; v_status text;
BEGIN
  SELECT id INTO v_driver FROM outlet_staff WHERE role = 'driver' AND status = 'active' LIMIT 1;
  SELECT id INTO o1 FROM outlets WHERE is_active AND type IN ('internal','mitra') LIMIT 1;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o1, 'dikirim', 'UJI-T6-1') RETURNING id INTO sj1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM driver_mulai_perjalanan(ARRAY[sj1], -6.6, 106.8);
  RESET ROLE;

  -- Verifikasi outlet atas satu-satunya stop → trigger menutup perjalanan → galat buatan.
  BEGIN
    UPDATE surat_jalan SET status = 'diterima_lengkap' WHERE id = sj1;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'GAGAL: galat pelacakan menggagalkan verifikasi SJ: %', SQLERRM;
  END;
  SELECT status INTO v_status FROM surat_jalan WHERE id = sj1;
  IF v_status <> 'diterima_lengkap' THEN RAISE EXCEPTION 'GAGAL: status SJ %', v_status; END IF;

  RAISE EXCEPTION 'HASIL T6: LULUS (galat pelacakan tidak menggagalkan verifikasi SJ)';
END $$;
ROLLBACK;
