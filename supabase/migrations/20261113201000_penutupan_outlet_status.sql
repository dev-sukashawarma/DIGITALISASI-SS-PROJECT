-- Wizard Penutupan Outlet — checklist (Task 2).
-- status_penutupan_outlet(): SATU-SATUNYA sumber checklist papan Penutupan &
-- gerbang "Tandai Penutupan Selesai". Spec §5.

CREATE OR REPLACE FUNCTION public.status_penutupan_outlet(p_outlet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_tutup    timestamptz;
  v_tgl      date;
  v_langkah  jsonb := '[]'::jsonb;
  v_n        int;
  v_n2       int;
  v_nilai    numeric;
  v_info     text;
  c          record;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('baca');

  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan' USING ERRCODE = 'no_data_found';
  END IF;
  v_tutup := coalesce(o.nonaktif_at, now());
  v_tgl   := (v_tutup AT TIME ZONE 'Asia/Jakarta')::date;

  -- crew
  -- Akun mitra sengaja tidak dihitung: investor tetap memegang akses laporan
  -- outlet yang sudah tutup (spec §6).
  SELECT count(*) INTO v_n FROM public.outlet_staff
   WHERE outlet_id = p_outlet_id AND status = 'active' AND role <> 'mitra';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','crew','label','Crew dipindah / dinonaktifkan','penanggung_jawab','HR',
    'wajib',true,'manual',false,'selesai',v_n = 0,
    'info', CASE WHEN v_n = 0 THEN NULL ELSE v_n || ' staf masih aktif di outlet ini' END);

  -- penugasan AM & leader
  SELECT count(*) INTO v_n FROM public.am_outlet_assignments
   WHERE outlet_id = p_outlet_id AND (effective_to IS NULL OR effective_to > v_tgl);
  SELECT count(*) INTO v_n2 FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
   WHERE so.outlet_id = p_outlet_id AND s.role = 'leader' AND s.status = 'active';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','penugasan','label','Penugasan AM & leader ditutup','penanggung_jawab','HR',
    'wajib',true,'manual',false,'selesai',v_n = 0 AND v_n2 = 0,
    'info', CASE WHEN v_n = 0 AND v_n2 = 0 THEN NULL
                 ELSE concat_ws(', ',
                   CASE WHEN v_n > 0 THEN v_n || ' penugasan AM masih berlaku' END,
                   CASE WHEN v_n2 > 0 THEN v_n2 || ' leader masih ditautkan' END) END);

  -- order menggantung (jendela 30 hari sebelum tutup ke depan)
  SELECT count(*) INTO v_n FROM public.orders
   WHERE outlet_id = p_outlet_id
     AND status NOT IN ('completed','cancelled')
     AND created_at >= v_tutup - interval '30 days';
  SELECT count(*) INTO v_n2 FROM public.orders
   WHERE outlet_id = p_outlet_id
     AND status NOT IN ('completed','cancelled')
     AND created_at < v_tutup - interval '30 days';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','order','label','Tidak ada pesanan menggantung','penanggung_jawab','AM',
    'wajib',true,'manual',false,'selesai',v_n = 0,
    'info', NULLIF(concat_ws('; ',
      CASE WHEN v_n > 0 THEN v_n || ' pesanan belum selesai/batal' END,
      CASE WHEN v_n2 > 0 THEN v_n2 || ' pesanan macet lama (>30 hari sebelum tutup, diabaikan)' END), ''));

  -- pesanan sesudah tanggal tutup (peringatan)
  SELECT coalesce(sum(x.n),0), string_agg(x.ket || ': ' || x.n, ', ' ORDER BY x.ket) INTO v_n, v_info
    FROM (SELECT coalesce(sales_source,'-') || ' (' || to_char(created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM') || ')' ket,
                 count(*) n
            FROM public.orders
           WHERE outlet_id = p_outlet_id AND created_at > v_tutup
           GROUP BY 1) x;
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','pesanan_nyasar','label','Pesanan masuk sesudah tanggal tutup','penanggung_jawab','Admin',
    'wajib',false,'manual',false,'selesai',v_n = 0,
    'info', CASE WHEN v_n = 0 THEN NULL ELSE v_n || ' pesanan: ' || v_info END);

  -- surat jalan & mutasi menggantung
  SELECT count(*) INTO v_n FROM public.surat_jalan
   WHERE outlet_id = p_outlet_id AND status IN ('draft','dikirim');
  SELECT count(*) INTO v_n2 FROM public.mutasi_antar_outlet
   WHERE (outlet_asal_id = p_outlet_id OR outlet_tujuan_id = p_outlet_id)
     AND status IN ('menunggu_persetujuan','menunggu_pengiriman','dikirim');
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','sj','label','Surat jalan & mutasi stok beres','penanggung_jawab','Kitchen',
    'wajib',true,'manual',false,'selesai',v_n = 0 AND v_n2 = 0,
    'info', CASE WHEN v_n = 0 AND v_n2 = 0 THEN NULL
                 ELSE concat_ws(', ',
                   CASE WHEN v_n > 0 THEN v_n || ' surat jalan draft/dikirim' END,
                   CASE WHEN v_n2 > 0 THEN v_n2 || ' mutasi stok belum selesai' END) END);

  -- stok
  SELECT count(*) FILTER (WHERE saldo <> 0) INTO v_n FROM public.stok_balance WHERE outlet_id = p_outlet_id;
  SELECT round(coalesce(sum(nilai),0)) INTO v_nilai FROM public.nilai_persediaan_spv WHERE outlet_id = p_outlet_id;
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','stok','label','Sisa stok dikosongkan','penanggung_jawab','Admin',
    'wajib',true,'manual',false,'selesai',v_n = 0,
    'info', CASE WHEN v_n = 0 THEN NULL
                 ELSE v_n || ' bahan, Rp ' || to_char(v_nilai, 'FM999G999G999G999') END);

  -- kas kecil (filter sama dengan Hub Approval finance)
  SELECT count(*) INTO v_n FROM public.petty_cash_expenses
   WHERE outlet_id = p_outlet_id AND status = 'pending' AND deleted_at IS NULL;
  SELECT count(*) INTO v_n2 FROM public.petty_cash_topups
   WHERE outlet_id = p_outlet_id AND status IN ('forwarded_to_finance','approved_by_finance');
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','kas_kecil','label','Kas kecil bersih','penanggung_jawab','Finance',
    'wajib',true,'manual',false,'selesai',v_n = 0 AND v_n2 = 0,
    'info', CASE WHEN v_n = 0 AND v_n2 = 0 THEN NULL
                 ELSE concat_ws(', ',
                   CASE WHEN v_n > 0 THEN v_n || ' pengeluaran menunggu' END,
                   CASE WHEN v_n2 > 0 THEN v_n2 || ' top-up menunggu' END) END);

  -- langkah manual
  FOR c IN
    SELECT t.kunci, t.label, t.pj, t.wajib,
           pc.outlet_id IS NOT NULL AS dicentang, pc.oleh_nama, pc.dibuat_at, pc.catatan
      FROM (VALUES
        (1, 'kanal_online',  'Aplikasi pelanggan & Order Online mati',        'Admin',           true,  true),
        (2, 'merchant_ojol', 'Merchant GoFood/Grab/Shopee/TikTok GO ditutup', 'Marcom',          true,  true),
        (3, 'mitra',         'Bagi hasil bulan terakhir ditransfer',          'Owner / Finance', true,  o.type = 'mitra'),
        (4, 'aset',          'Aset (freezer, printer, tablet) dipindah',      'AM',              false, true),
        (5, 'biaya_rutin',   'Biaya rutin (sewa, PLN, internet) dihentikan',  'Finance',         false, true)
      ) AS t(urut, kunci, label, pj, wajib, tampil)
      LEFT JOIN public.outlet_penutupan_centang pc
        ON pc.outlet_id = p_outlet_id AND pc.kunci = t.kunci
     WHERE t.tampil
     ORDER BY t.urut
  LOOP
    v_langkah := v_langkah || jsonb_build_object(
      'kunci', c.kunci,
      'label', c.label,
      'penanggung_jawab', c.pj,
      'wajib', c.wajib,
      'manual', true,
      -- kanal_online butuh centang DAN outlet benar-benar tidak tampil di aplikasi.
      'selesai', c.dicentang AND (c.kunci <> 'kanal_online' OR o.app_enabled IS NOT TRUE),
      'info', CASE WHEN c.kunci = 'kanal_online' AND o.app_enabled THEN 'Outlet masih tampil di aplikasi pelanggan'
                   ELSE c.catatan END,
      'dicentang_oleh', CASE WHEN c.dicentang THEN coalesce(c.oleh_nama, 'sistem') END,
      'dicentang_at', CASE WHEN c.dicentang THEN to_char(c.dibuat_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') END);
  END LOOP;

  RETURN jsonb_build_object(
    'outlet_id', o.id,
    'nama', o.name,
    'jenis', o.type,
    'status', o.status,
    'nonaktif_at', to_char(o.nonaktif_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'),
    'alasan_tutup', o.alasan_tutup,
    'penutupan_selesai_at', o.penutupan_selesai_at,
    'siap_selesai', NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_langkah) e
       WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean),
    'langkah', v_langkah);
END;
$$;
REVOKE ALL ON FUNCTION public.status_penutupan_outlet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_penutupan_outlet(uuid) TO authenticated;
