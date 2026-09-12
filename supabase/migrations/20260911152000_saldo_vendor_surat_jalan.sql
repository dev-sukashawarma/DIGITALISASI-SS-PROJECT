-- Surat jalan ber-vendor: kolom vendor_id, isi otomatis, harga vendor, approval alokasi,
-- penjaga sisa vendor saat kirim. Spec: docs/superpowers/specs/2026-09-11-saldo-vendor-gudang-design.md
SET lock_timeout = '5s';

ALTER TABLE public.surat_jalan_item ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.supplier(id);
ALTER TABLE public.surat_jalan_item DROP CONSTRAINT IF EXISTS surat_jalan_item_surat_jalan_id_bahan_baku_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS surat_jalan_item_sj_bahan_vendor_key
  ON public.surat_jalan_item (surat_jalan_id, bahan_baku_id, vendor_id) NULLS NOT DISTINCT;

-- Satu fungsi untuk vendor & harga: trigger berjalan urut abjad, jadi dua trigger
-- terpisah akan mengisi harga SEBELUM vendor terisi.
CREATE OR REPLACE FUNCTION public.fill_harga_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_satu uuid; v_n int;
BEGIN
  IF NEW.vendor_id IS NULL THEN
    SELECT count(*), min(v::text)::uuid INTO v_n, v_satu FROM public.vendor_bahan(NEW.bahan_baku_id) v;
    IF v_n = 1 THEN NEW.vendor_id := v_satu; END IF;
  ELSE
    NEW.vendor_id := public.vendor_induk(NEW.vendor_id);
  END IF;

  IF COALESCE(NEW.harga_snapshot, 0) = 0 AND NEW.vendor_id IS NOT NULL THEN
    SELECT bs.harga INTO NEW.harga_snapshot
      FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
     WHERE bs.bahan_baku_id = NEW.bahan_baku_id AND bs.is_active AND bs.harga > 0
       AND COALESCE(s.vendor_induk_id, s.id) = NEW.vendor_id
     ORDER BY bs.harga_updated_at DESC NULLS LAST, bs.id
     LIMIT 1;
  END IF;
  IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN
    SELECT COALESCE(harga_beli, 0) INTO NEW.harga_snapshot FROM public.bahan_baku_harga WHERE bahan_baku_id = NEW.bahan_baku_id;
  END IF;
  NEW.harga_snapshot := COALESCE(NEW.harga_snapshot, 0);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_surat_jalan(p_outlet_id uuid, p_items jsonb)
RETURNS surat_jalan LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sj surat_jalan; v_item jsonb;
BEGIN
  IF auth.role() != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen','admin','owner','purchasing')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen), purchasing, atau admin/owner yang boleh menerbitkan surat jalan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;
  INSERT INTO surat_jalan (outlet_id, created_by) VALUES (p_outlet_id, auth.uid()) RETURNING * INTO v_sj;
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim, vendor_id)
    VALUES (v_sj.id, (v_item->>'bahan_baku_id')::uuid, (v_item->>'qty_dikirim')::numeric,
            NULLIF(v_item->>'vendor_id','')::uuid);
  END LOOP;
  RETURN v_sj;
END $$;

CREATE OR REPLACE FUNCTION public.approve_permintaan_svc(p_permintaan_id uuid, p_items jsonb)
RETURNS permintaan_bahan LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p permintaan_bahan; v_item jsonb; v_a jsonb; v_sj surat_jalan; v_sj_items jsonb := '[]'::jsonb;
  v_bahan uuid; v_qty numeric; v_harga numeric; v_total numeric; v_nama text;
BEGIN
  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id; END IF;
  IF v_p.status != 'menunggu' THEN RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status; END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    v_bahan := (v_item->>'bahan_baku_id')::uuid;
    v_qty   := (v_item->>'qty_disetujui')::numeric;
    v_harga := COALESCE((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan), 0);

    UPDATE permintaan_bahan_item SET qty_disetujui = v_qty, harga_snapshot = v_harga
     WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;
    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui, harga_snapshot)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty, v_harga);
    END IF;

    IF v_qty > 0 THEN
      IF jsonb_typeof(v_item->'alokasi') = 'array' AND jsonb_array_length(v_item->'alokasi') > 0 THEN
        SELECT COALESCE(sum((a->>'qty')::numeric), 0) INTO v_total FROM jsonb_array_elements(v_item->'alokasi') a;
        IF abs(v_total - v_qty) > 0.000001 THEN
          SELECT nama INTO v_nama FROM bahan_baku WHERE id = v_bahan;
          RAISE EXCEPTION 'Pembagian vendor % (%) tidak sama dengan jumlah disetujui (%)', v_nama, v_total, v_qty
            USING ERRCODE = 'check_violation';
        END IF;
        FOR v_a IN SELECT jsonb_array_elements(v_item->'alokasi') LOOP
          IF (v_a->>'qty')::numeric > 0 THEN
            v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan,
              'qty_dikirim', (v_a->>'qty')::numeric, 'vendor_id', v_a->>'vendor_id');
          END IF;
        END LOOP;
      ELSE
        IF public.bahan_multi_vendor(v_bahan) THEN
          SELECT nama INTO v_nama FROM bahan_baku WHERE id = v_bahan;
          RAISE EXCEPTION 'Pilih vendor untuk %', v_nama USING ERRCODE = 'check_violation';
        END IF;
        v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan, 'qty_dikirim', v_qty);
      END IF;
    END IF;
  END LOOP;

  UPDATE permintaan_bahan_item SET qty_disetujui = 0 WHERE permintaan_id = p_permintaan_id AND qty_disetujui IS NULL;
  IF jsonb_array_length(v_sj_items) = 0 THEN
    RAISE EXCEPTION 'tidak ada item disetujui (qty > 0); gunakan tolak_permintaan_svc';
  END IF;
  v_sj := create_surat_jalan(v_p.outlet_id, v_sj_items);
  UPDATE permintaan_bahan SET status = 'disetujui', surat_jalan_id = v_sj.id, updated_at = NOW()
   WHERE id = p_permintaan_id RETURNING * INTO v_p;
  RETURN v_p;
END $$;

-- Penjaga + mutasi sj_kirim saat -> dikirim. RAISE membatalkan seluruh UPDATE,
-- termasuk debit gudang oleh sj_on_dikirim_kurangi_kitchen.
CREATE OR REPLACE FUNCTION public.sj_vendor_on_dikirim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_butuh numeric; v_sisa numeric; v_f numeric;
BEGIN
  IF NOT (OLD.status <> 'dikirim' AND NEW.status = 'dikirim') THEN RETURN NEW; END IF;
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

DROP TRIGGER IF EXISTS trg_sj_vendor_dikirim ON public.surat_jalan;
CREATE TRIGGER trg_sj_vendor_dikirim AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW EXECUTE FUNCTION public.sj_vendor_on_dikirim();
