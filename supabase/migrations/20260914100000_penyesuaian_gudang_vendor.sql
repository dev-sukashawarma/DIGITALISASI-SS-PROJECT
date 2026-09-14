-- 20260914100000_penyesuaian_gudang_vendor.sql
--
-- Celah 1 saldo vendor Gudang Pusat: penyesuaian (adjustment) & transfer keluar
-- manual untuk bahan multi-vendor tidak memotong/menambah saldo vendor, sehingga
-- buku vendor bergeser dari stok total setiap kali kitchen mengetik penyesuaian
-- (sejak baseline 12 Sep saja: SAPI -28 Blok, KENTANG -6,5 Dus, VACUUM -2 Roll).
--
-- Isi:
--   1. Sumber mutasi baru 'penyesuaian' (merujuk baris ledger-nya, unik).
--   2. RPC catat_penyesuaian_gudang_vendor(p_items jsonb) — menulis baris
--      ledger_stok DAN mutasi vendornya dalam satu transaksi. Satu vendor =
--      satu baris ledger. Pengurangan melebihi sisa vendor ditolak (sama dengan
--      penjaga surat jalan), penambahan bebas ke vendor mana pun milik bahan itu.
--   3. Constraint trigger DEFERRED di ledger_stok: baris adjustment/transfer_keluar
--      manual (tanpa rujukan dokumen) untuk bahan multi-vendor di Gudang Pusat
--      WAJIB punya mutasi 'penyesuaian' dengan qty sama saat COMMIT. Menutup
--      jalur lain (tab lama, skrip SQL) — penulisnya harus menulis mutasi juga.
--
-- Sengaja TIDAK dicakup: waste (tipe 'waste', lewat laporan + persetujuan, nol
-- kejadian di Gudang Pusat Sept 2026) dan baris ber-rujukan (surat jalan, PO,
-- opname, mutasi antar outlet, waste, order, terima vendor) — punya penulis
-- vendornya sendiri atau memang di luar buku vendor.
--
-- ⚠️ ledger_stok ada di publication supabase_realtime; DDL trigger di tabel itu
-- pernah deadlock. Terapkan dengan lock_timeout dan ulangi bila timeout.

SET lock_timeout = '5s';

-- 1. Sumber baru -------------------------------------------------------------
ALTER TABLE public.stok_vendor_gudang_mutasi
  DROP CONSTRAINT IF EXISTS stok_vendor_gudang_mutasi_sumber_check;
ALTER TABLE public.stok_vendor_gudang_mutasi
  ADD CONSTRAINT stok_vendor_gudang_mutasi_sumber_check
  CHECK (sumber IN ('po','sj_kirim','hitung_fisik','koreksi','penyesuaian'));

CREATE UNIQUE INDEX IF NOT EXISTS svgm_penyesuaian_unik
  ON public.stok_vendor_gudang_mutasi (ref_ledger_id) WHERE sumber = 'penyesuaian';

-- 2. RPC ---------------------------------------------------------------------
-- p_items: [{bahan_baku_id, vendor_id, tipe: 'adjustment'|'transfer_keluar',
--            qty_besar (adjustment bertanda; transfer_keluar positif), catatan}]
-- Qty dalam SATUAN BESAR; skala ledger dihitung di sini dengan to_ledger_scale
-- supaya ledger dan buku vendor pasti sekala.
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
  IF COALESCE(public.peran_saya(),'') NOT IN ('kitchen','admin','owner') THEN
    RAISE EXCEPTION 'Hanya kitchen/admin/owner yang boleh mencatat penyesuaian Gudang Pusat per vendor'
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

-- 3. Penjaga -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cek_penyesuaian_gudang_bervendor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_nama text;
BEGIN
  IF NOT public.bahan_multi_vendor(NEW.bahan_baku_id) THEN RETURN NULL; END IF;
  SELECT sum(qty) INTO v_total FROM stok_vendor_gudang_mutasi
   WHERE sumber = 'penyesuaian' AND ref_ledger_id = NEW.id;
  IF v_total IS NULL OR abs(v_total - NEW.qty) > 0.000001 THEN
    SELECT nama INTO v_nama FROM bahan_baku WHERE id = NEW.bahan_baku_id;
    RAISE EXCEPTION '% di Gudang Pusat punya lebih dari satu vendor — pilih vendor saat mencatat penyesuaian (muat ulang halaman bila pilihan vendor belum muncul)', v_nama
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.cek_penyesuaian_gudang_bervendor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cek_penyesuaian_gudang_bervendor ON public.ledger_stok;
CREATE CONSTRAINT TRIGGER trg_cek_penyesuaian_gudang_bervendor
  AFTER INSERT ON public.ledger_stok
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid
        AND NEW.tipe IN ('adjustment','transfer_keluar')
        AND NEW.ref_shipment_id IS NULL AND NEW.ref_transfer_id IS NULL
        AND NEW.ref_opname_id IS NULL AND NEW.ref_po_id IS NULL
        AND NEW.ref_waste_id IS NULL AND NEW.ref_order_id IS NULL
        AND NEW.ref_terima_vendor_id IS NULL)
  EXECUTE FUNCTION public.cek_penyesuaian_gudang_bervendor();

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_cek_penyesuaian_gudang_bervendor ON public.ledger_stok;
-- DROP FUNCTION IF EXISTS public.cek_penyesuaian_gudang_bervendor();
-- DROP FUNCTION IF EXISTS public.catat_penyesuaian_gudang_vendor(jsonb);
-- (sumber 'penyesuaian' dibiarkan; baris mutasi berumber itu tetap sah)
