-- 20260914110000_penyesuaian_vendor_izinkan_purchasing.sql
--
-- catat_penyesuaian_gudang_vendor (20260914100000) semula hanya untuk
-- kitchen/admin/owner. Keputusan owner 2026-09-14: purchasing juga berhak
-- mencatat penyesuaian Gudang Pusat per vendor. Isi fungsi identik dengan
-- migration sebelumnya kecuali daftar role (dan pesan galatnya).
--
-- Daftar role ini WAJIB sama dengan ROLE_PENYESUAIAN_VENDOR di
-- apps/stok/src/lib/stok/penyesuaianVendor.ts.

CREATE OR REPLACE FUNCTION public.catat_penyesuaian_gudang_vendor(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_g uuid := public.gudang_pusat_id();
  it jsonb;
  v_bahan uuid; v_vendor uuid; v_tipe text; v_qty_besar numeric; v_catatan text;
  v_qty numeric; v_sisa numeric; v_f numeric; v_ledger uuid;
  v_nama text; v_satuan text; v_vendor_nama text;
  v_n int := 0;
BEGIN
  IF COALESCE(public.peran_saya(),'') NOT IN ('kitchen','purchasing','admin','owner') THEN
    RAISE EXCEPTION 'Hanya kitchen/purchasing/admin/owner yang boleh mencatat penyesuaian Gudang Pusat per vendor'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tidak ada item' USING ERRCODE = 'check_violation';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_bahan     := NULLIF(it->>'bahan_baku_id','')::uuid;
    v_vendor    := NULLIF(it->>'vendor_id','')::uuid;
    v_tipe      := it->>'tipe';
    v_qty_besar := NULLIF(it->>'qty_besar','')::numeric;
    v_catatan   := btrim(COALESCE(it->>'catatan',''));

    SELECT nama, satuan INTO v_nama, v_satuan FROM bahan_baku WHERE id = v_bahan;
    IF v_nama IS NULL THEN
      RAISE EXCEPTION 'Bahan tidak ditemukan' USING ERRCODE = 'check_violation';
    END IF;
    IF v_tipe NOT IN ('adjustment','transfer_keluar') THEN
      RAISE EXCEPTION 'Tipe % tidak didukung', v_tipe USING ERRCODE = 'check_violation';
    END IF;
    IF v_qty_besar IS NULL OR v_qty_besar = 0 OR (v_tipe = 'transfer_keluar' AND v_qty_besar < 0) THEN
      RAISE EXCEPTION 'Jumlah % tidak valid', v_nama USING ERRCODE = 'check_violation';
    END IF;
    IF v_tipe = 'transfer_keluar' THEN v_qty_besar := -v_qty_besar; END IF;
    IF v_catatan = '' THEN
      RAISE EXCEPTION 'Keterangan % wajib diisi', v_nama USING ERRCODE = 'check_violation';
    END IF;
    IF NOT public.bahan_multi_vendor(v_bahan) THEN
      RAISE EXCEPTION '% hanya punya satu vendor — catat lewat penyesuaian biasa', v_nama
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_vendor IS NULL OR NOT EXISTS (SELECT 1 FROM public.vendor_bahan(v_bahan) v WHERE v = v_vendor) THEN
      RAISE EXCEPTION 'Pilih vendor yang benar untuk %', v_nama USING ERRCODE = 'check_violation';
    END IF;

    v_f   := NULLIF(public.to_ledger_scale(v_g, v_bahan, 1), 0);
    v_qty := public.to_ledger_scale(v_g, v_bahan, v_qty_besar);
    IF v_f IS NULL OR v_qty IS NULL OR v_qty = 0 THEN
      RAISE EXCEPTION 'Skala satuan % tidak bisa dihitung', v_nama USING ERRCODE = 'check_violation';
    END IF;

    -- Serialisasi per (bahan, vendor) supaya dua penyimpanan bersamaan tidak
    -- sama-sama lolos cek sisa.
    PERFORM pg_advisory_xact_lock(hashtext('svgm:' || v_bahan::text || ':' || v_vendor::text));

    IF v_qty < 0 AND public.bahan_vendor_aktif(v_bahan) THEN
      v_sisa := public.sisa_vendor_gudang(v_bahan, v_vendor);
      IF -v_qty > v_sisa + 0.000001 THEN
        SELECT regexp_replace(nama, '\s*-\s*Tempo\s*\d+\s*$', '', 'i') INTO v_vendor_nama
          FROM supplier WHERE id = v_vendor;
        RAISE EXCEPTION 'Sisa % % tinggal % %, penyesuaian butuh %',
          v_nama, v_vendor_nama, round(v_sisa / v_f, 2), v_satuan, abs(v_qty_besar)
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    -- Mutasi DULU, dengan id ledger yang disiapkan: penjaga di bawah tetap lolos
    -- walau sesi pemanggil menyetel SET CONSTRAINTS ALL IMMEDIATE.
    v_ledger := gen_random_uuid();
    INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_ledger_id, catatan, dibuat_oleh)
    VALUES (v_bahan, v_vendor, v_qty, 'penyesuaian', v_ledger, v_catatan, auth.uid());

    INSERT INTO ledger_stok (id, outlet_id, bahan_baku_id, tipe, qty, catatan, created_by)
    VALUES (v_ledger, v_g, v_bahan, v_tipe, v_qty, v_catatan, auth.uid());

    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.catat_penyesuaian_gudang_vendor(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catat_penyesuaian_gudang_vendor(jsonb) TO authenticated, service_role;
