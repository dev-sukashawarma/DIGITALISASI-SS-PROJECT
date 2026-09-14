-- 20260914170000_kunci_sisa_vendor.sql
--
-- Menutup race pada penjaga sisa vendor Gudang Pusat. Sebelumnya
-- sj_vendor_on_dikirim membaca sisa_vendor_gudang() TANPA kunci: dua surat jalan
-- berisi bahan+vendor yang sama yang dikirim hampir bersamaan sama-sama membaca
-- sisa lama, sama-sama lolos, dan saldo vendor bisa minus.
--
-- Perbaikan: sebelum membaca sisa, kunci setiap pasangan (bahan, vendor) dengan
-- pg_advisory_xact_lock(hashtext('svgm:<bahan>:<vendor>')) -- KUNCI YANG SAMA
-- dengan catat_penyesuaian_gudang_vendor, urut bahan_baku_id::text lalu
-- vendor_id::text di kedua fungsi supaya penulis bersamaan saling antre, bukan
-- deadlock. Di READ COMMITTED, pembacaan sisa sesudah kunci memakai snapshot
-- baru sehingga melihat mutasi penulis sebelumnya yang sudah commit.
--
-- catat_penyesuaian_gudang_vendor: isi identik dengan 20260914110000 kecuali
-- kunci per item dipindah jadi kunci semua pasangan di muka.
-- Uji: supabase/verifikasi/saldo_vendor/t6_kunci.sql

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.sj_vendor_on_dikirim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_butuh numeric; v_sisa numeric; v_f numeric; v_pasangan record;
BEGIN
  IF NOT (OLD.status <> 'dikirim' AND NEW.status = 'dikirim') THEN RETURN NEW; END IF;

  FOR v_pasangan IN
    SELECT DISTINCT i.bahan_baku_id::text AS b, i.vendor_id::text AS v
      FROM surat_jalan_item i
     WHERE i.surat_jalan_id = NEW.id AND i.qty_dikirim > 0 AND i.vendor_id IS NOT NULL
     ORDER BY 1, 2
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('svgm:' || v_pasangan.b || ':' || v_pasangan.v));
  END LOOP;

  FOR r IN
    SELECT i.id, i.bahan_baku_id, i.qty_dikirim, i.vendor_id, b.nama AS bahan, b.satuan, s.nama AS vendor
      FROM surat_jalan_item i JOIN bahan_baku b ON b.id = i.bahan_baku_id
      LEFT JOIN supplier s ON s.id = i.vendor_id
     WHERE i.surat_jalan_id = NEW.id AND i.qty_dikirim > 0 AND public.bahan_multi_vendor(i.bahan_baku_id)
  LOOP
    IF r.vendor_id IS NULL THEN
      RAISE EXCEPTION 'Pilih vendor untuk % sebelum dikirim', r.bahan USING ERRCODE = 'check_violation';
    END IF;
    v_f := NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), r.bahan_baku_id, 1), 0);
    v_butuh := public.to_ledger_scale(public.gudang_pusat_id(), r.bahan_baku_id, r.qty_dikirim);
    IF public.bahan_vendor_aktif(r.bahan_baku_id) THEN
      v_sisa := public.sisa_vendor_gudang(r.bahan_baku_id, r.vendor_id);
      IF v_butuh > v_sisa + 0.000001 THEN
        RAISE EXCEPTION 'Sisa % % tinggal % %, surat jalan butuh %',
          r.bahan, regexp_replace(r.vendor, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'),
          round(v_sisa / v_f, 2), r.satuan, r.qty_dikirim USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_surat_jalan_item_id, catatan, dibuat_oleh)
    VALUES (r.bahan_baku_id, r.vendor_id, -v_butuh, 'sj_kirim', r.id, 'Kirim SJ', auth.uid())
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sj_vendor_on_dikirim() FROM PUBLIC, anon, authenticated;

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
  v_pasangan record;
BEGIN
  IF COALESCE(public.peran_saya(),'') NOT IN ('kitchen','purchasing','admin','owner') THEN
    RAISE EXCEPTION 'Hanya kitchen/purchasing/admin/owner yang boleh mencatat penyesuaian Gudang Pusat per vendor'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tidak ada item' USING ERRCODE = 'check_violation';
  END IF;

  -- Kunci SEMUA pasangan (bahan, vendor) di muka, urut bahan lalu vendor -- urutan
  -- sama dengan sj_vendor_on_dikirim -- supaya dua penulis bersamaan tidak sama-sama
  -- lolos cek sisa dan tidak saling tunggu (deadlock). Item berformat salah dilewati
  -- di sini dan ditolak validasi di loop di bawah.
  FOR v_pasangan IN
    SELECT DISTINCT lower(e->>'bahan_baku_id') AS b, lower(e->>'vendor_id') AS v
      FROM jsonb_array_elements(p_items) e
     WHERE (e->>'bahan_baku_id') ~* '^[0-9a-f-]{36}$' AND (e->>'vendor_id') ~* '^[0-9a-f-]{36}$'
     ORDER BY 1, 2
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('svgm:' || v_pasangan.b || ':' || v_pasangan.v));
  END LOOP;

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
