-- supabase/migrations/20260911153000_saldo_vendor_opname.sql
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.opname_item_vendor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id     uuid NOT NULL REFERENCES public.opname(id) ON DELETE CASCADE,
  bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id),
  vendor_id     uuid NOT NULL REFERENCES public.supplier(id),
  qty_besar     numeric NOT NULL CHECK (qty_besar >= 0),
  UNIQUE (opname_id, bahan_baku_id, vendor_id)
);
ALTER TABLE public.opname_item_vendor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oiv_select ON public.opname_item_vendor;
CREATE POLICY oiv_select ON public.opname_item_vendor FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.opname o WHERE o.id = opname_id AND o.outlet_id IN (SELECT public.accessible_outlet_ids())));
REVOKE ALL ON public.opname_item_vendor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opname_item_vendor TO authenticated;

CREATE OR REPLACE FUNCTION public.simpan_hitung_vendor(p_opname_id uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o opname; r record; v_nama text;
BEGIN
  SELECT * INTO v_o FROM opname WHERE id = p_opname_id;
  IF v_o.id IS NULL OR v_o.outlet_id <> public.gudang_pusat_id() THEN
    RAISE EXCEPTION 'Opname bukan milik Gudang Pusat' USING ERRCODE = 'check_violation';
  END IF;
  IF v_o.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'Opname sudah %', v_o.status USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status='active' AND outlet_id = v_o.outlet_id) THEN
    RAISE EXCEPTION 'Bukan staff Gudang Pusat' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Tiap bahan yang dikirim wajib memuat SEMUA vendor induknya, tak lebih tak kurang.
  FOR r IN
    SELECT (x->>'bahan_baku_id')::uuid AS bahan,
           array_agg(public.vendor_induk((x->>'vendor_id')::uuid)
                     ORDER BY public.vendor_induk((x->>'vendor_id')::uuid)) AS vendor
      FROM jsonb_array_elements(p_items) x GROUP BY 1
  LOOP
    IF r.vendor IS DISTINCT FROM (SELECT array_agg(v ORDER BY v) FROM public.vendor_bahan(r.bahan) v) THEN
      SELECT nama INTO v_nama FROM bahan_baku WHERE id = r.bahan;
      RAISE EXCEPTION 'Hitungan % harus diisi untuk semua vendornya', v_nama USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  DELETE FROM opname_item_vendor WHERE opname_id = p_opname_id;
  INSERT INTO opname_item_vendor (opname_id, bahan_baku_id, vendor_id, qty_besar)
  SELECT p_opname_id, (x->>'bahan_baku_id')::uuid, public.vendor_induk((x->>'vendor_id')::uuid), (x->>'qty_besar')::numeric
    FROM jsonb_array_elements(p_items) x;
END $$;
REVOKE ALL ON FUNCTION public.simpan_hitung_vendor(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_hitung_vendor(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.opname_vendor_final() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_target numeric;
BEGIN
  IF NOT (NEW.status = 'finalized' AND OLD.status IS DISTINCT FROM 'finalized'
          AND NEW.outlet_id = public.gudang_pusat_id()) THEN RETURN NEW; END IF;
  FOR r IN SELECT bahan_baku_id, vendor_id, qty_besar FROM opname_item_vendor WHERE opname_id = NEW.id LOOP
    -- Idempoten: bila opname ini sudah menulis hitung_fisik untuk pasangan ini, lewati.
    CONTINUE WHEN EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi m WHERE m.sumber='hitung_fisik'
                           AND m.ref_opname_id = NEW.id AND m.bahan_baku_id = r.bahan_baku_id AND m.vendor_id = r.vendor_id);
    v_target := public.to_ledger_scale(public.gudang_pusat_id(), r.bahan_baku_id, r.qty_besar);
    INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_opname_id, catatan, dibuat_oleh)
    VALUES (r.bahan_baku_id, r.vendor_id, v_target - public.sisa_vendor_gudang(r.bahan_baku_id, r.vendor_id),
            'hitung_fisik', NEW.id, 'Opname gudang per vendor', auth.uid());
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.opname_vendor_final() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_opname_vendor_final ON public.opname;
CREATE TRIGGER trg_opname_vendor_final AFTER UPDATE OF status ON public.opname
  FOR EACH ROW EXECUTE FUNCTION public.opname_vendor_final();
