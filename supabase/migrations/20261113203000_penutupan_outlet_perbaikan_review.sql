-- Wizard Penutupan Outlet — perbaikan review akhir (I1, I2).
-- Uji: supabase/verifikasi/penutupan_outlet/t4_perbaikan_review.sql
--
-- I1: langkah 'penugasan' dulu menghitung penugasan AM dengan effective_to > tanggal
--     tutup. HR mengakhiri penugasan dengan effective_to = KEMARIN (relatif hari ini),
--     jadi untuk penutupan mundur (dan 4 outlet backfill) langkah ini tak pernah
--     selesai. Kini: penugasan dihitung bila masih berlaku HARI INI (WIB).
-- I2: langkah wajib 'order' dulu juga menghitung pesanan yang masuk SESUDAH tanggal
--     tutup. Itu wilayah peringatan 'pesanan_nyasar' (spec §5), jadi kini dibatasi
--     sampai tanggal tutup.
--
-- Ditambal terarah (pg_get_functiondef + replace) dengan penjaga: tiap pola harus
-- ketemu tepat sekali, kalau tidak migration gagal tanpa mengubah apa pun.

DO $$
DECLARE
  v_def  text := pg_get_functiondef('public.status_penutupan_outlet(uuid)'::regprocedure);
  v_baru text;
  p1_lama constant text := 'AND (effective_to IS NULL OR effective_to > v_tgl)';
  p1_baru constant text := 'AND (effective_to IS NULL OR effective_to >= (now() AT TIME ZONE ''Asia/Jakarta'')::date)';
  p2_lama constant text := 'AND created_at >= v_tutup - interval ''30 days'';';
  p2_baru constant text := 'AND created_at >= v_tutup - interval ''30 days''
     AND created_at <= v_tutup;';
BEGIN
  IF position(p1_baru in v_def) > 0 THEN
    RAISE NOTICE 'status_penutupan_outlet sudah ditambal, dilewati';
    RETURN;
  END IF;
  IF (length(v_def) - length(replace(v_def, p1_lama, ''))) / length(p1_lama) <> 1 THEN
    RAISE EXCEPTION 'Pola I1 tidak ketemu tepat sekali';
  END IF;
  IF (length(v_def) - length(replace(v_def, p2_lama, ''))) / length(p2_lama) <> 1 THEN
    RAISE EXCEPTION 'Pola I2 tidak ketemu tepat sekali';
  END IF;
  v_baru := replace(replace(v_def, p1_lama, p1_baru), p2_lama, p2_baru);
  EXECUTE v_baru;
END $$;
