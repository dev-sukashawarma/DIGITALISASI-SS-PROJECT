-- 20260911121000_drop_ship_catat_terima.sql
-- Penulis stok drop-ship + RPC sisi crew. Spec §4.1, §5.1, §6.

-- ledger_stok dilewati tiap order POS. Kalau lock-nya tak didapat cepat, GAGAL
-- dan ulangi nanti -- jangan mengantre lalu memblokir penjualan di belakangnya.
SET lock_timeout = '5s';

-- Trigger sinkron stok -- pola sync_waste_ledger: target vs yang sudah tercatat.
-- Idempoten; koreksi qty sebelum disahkan menyesuaikan stok otomatis.
-- Delta negatif memakai tipe 'rejected_kiriman': 'adjustment' diblokir penjaga
-- anti-minus di ledger_stamp_saldo, padahal sayur biasanya sudah terpakai
-- sebelum catatan dikoreksi/ditolak -- pembalikan akan GAGAL kalau pakai adjustment.
-- Ditulis pada tabel terima_vendor_outlet (BUKAN ledger_stok) -- ledger_stok ada
-- di publication realtime, DDL langsung di sana bisa deadlock (ruling R6).
CREATE OR REPLACE FUNCTION public.sync_terima_vendor_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target numeric; v_sudah numeric; v_delta numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.outlet_id IS DISTINCT FROM OLD.outlet_id
                           OR NEW.bahan_baku_id IS DISTINCT FROM OLD.bahan_baku_id) THEN
    RAISE EXCEPTION 'Outlet/bahan catatan terima vendor tidak boleh diubah' USING ERRCODE = 'check_violation';
  END IF;

  v_target := CASE WHEN NEW.status IN ('dicatat','disahkan')
                   THEN public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, NEW.qty) ELSE 0 END;
  SELECT COALESCE(sum(qty), 0) INTO v_sudah FROM public.ledger_stok WHERE ref_terima_vendor_id = NEW.id;
  v_delta := v_target - v_sudah;
  IF abs(v_delta) < 0.000001 THEN RETURN NULL; END IF;

  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, ref_terima_vendor_id, created_by)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id,
          CASE WHEN v_delta > 0 THEN 'pembelian_supplier' ELSE 'rejected_kiriman' END,
          v_delta,
          CASE WHEN v_sudah = 0 THEN 'Terima langsung vendor'
               WHEN NEW.status = 'ditolak' THEN 'Terima vendor ditolak Pusat'
               ELSE 'Koreksi terima vendor (qty jadi ' || NEW.qty || ')' END,
          NEW.id, NEW.dicatat_oleh);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_terima_vendor_ledger ON public.terima_vendor_outlet;
CREATE TRIGGER trg_sync_terima_vendor_ledger
  AFTER INSERT OR UPDATE ON public.terima_vendor_outlet
  FOR EACH ROW EXECUTE FUNCTION public.sync_terima_vendor_ledger();

-- Harga dikunci saat dicatat: katalog vendor bila > 0, selain itu master. Spec §4.1.
CREATE OR REPLACE FUNCTION public._harga_snapshot_vendor(p_supplier uuid, p_bahan uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT NULLIF(bs.harga, 0) FROM public.bahan_baku_supplier bs
      WHERE bs.supplier_id = p_supplier AND bs.bahan_baku_id = p_bahan AND bs.is_active),
    (SELECT bh.harga_beli FROM public.bahan_baku_harga bh WHERE bh.bahan_baku_id = p_bahan),
    0)
$$;

CREATE OR REPLACE FUNCTION public.info_terima_vendor(p_bahan_baku_id uuid)
RETURNS TABLE(supplier_id uuid, supplier_nama text, harga_snapshot numeric, rata_pakai_harian numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_outlet uuid; v_faktor numeric; v_rata numeric;
BEGIN
  SELECT s.outlet_id INTO v_outlet FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active';
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'Akun tidak terhubung ke outlet' USING ERRCODE = 'insufficient_privilege'; END IF;
  v_faktor := NULLIF(public.to_ledger_scale(v_outlet, p_bahan_baku_id, 1), 0);
  SELECT (-sum(l.qty) / 7.0) / v_faktor INTO v_rata FROM public.ledger_stok l
   WHERE l.outlet_id = v_outlet AND l.bahan_baku_id = p_bahan_baku_id AND l.tipe = 'pemakaian'
     AND l.created_at >= now() - interval '7 days';
  RETURN QUERY
    SELECT s.id, s.nama, public._harga_snapshot_vendor(s.id, p_bahan_baku_id), v_rata
      FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
     WHERE bs.bahan_baku_id = p_bahan_baku_id AND bs.is_active AND COALESCE(s.is_active, true)
     ORDER BY s.nama;
END $$;

CREATE OR REPLACE FUNCTION public.catat_terima_vendor(
  p_bahan_baku_id uuid, p_supplier_id uuid, p_qty numeric, p_tanggal date,
  p_catatan text DEFAULT NULL, p_foto_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff uuid := auth.uid(); v_outlet uuid; v_harga numeric; v_id uuid;
BEGIN
  -- Outlet SELALU outlet_staff.outlet_id sendiri -- bukan accessible_outlet_ids()
  -- (yang mengembalikan semua outlet untuk kitchen; itu lubang opname 2026-08-13).
  SELECT s.outlet_id INTO v_outlet FROM public.outlet_staff s WHERE s.id = v_staff AND s.status = 'active';
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'Akun tidak terhubung ke outlet' USING ERRCODE = 'insufficient_privilege'; END IF;

  PERFORM 1 FROM public.bahan_baku_supplier bs
   WHERE bs.supplier_id = p_supplier_id AND bs.bahan_baku_id = p_bahan_baku_id AND bs.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor ini tidak terdaftar untuk bahan tersebut' USING ERRCODE = 'check_violation'; END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus lebih dari 0' USING ERRCODE = 'check_violation';
  END IF;
  -- Tanggal WIB, bukan current_date (UTC): crew yang mencatat 00:00-07:00 WIB
  -- akan ditolak "masa depan" kalau pakai UTC.
  IF p_tanggal IS NULL OR p_tanggal > (now() AT TIME ZONE 'Asia/Jakarta')::date
     OR p_tanggal < (now() AT TIME ZONE 'Asia/Jakarta')::date - 3 THEN
    RAISE EXCEPTION 'Tanggal terima harus hari ini atau paling lama 3 hari lalu' USING ERRCODE = 'check_violation';
  END IF;

  v_harga := public._harga_snapshot_vendor(p_supplier_id, p_bahan_baku_id);
  -- Batas atas mutlak (dua sisi). Rp 10 jt = ~450 kg sayur -- mustahil untuk satu kiriman harian.
  IF p_qty * v_harga > 10000000 THEN
    RAISE EXCEPTION 'Nilai kiriman Rp % tidak wajar untuk satu catatan. Periksa satuan (kg, bukan gram).',
      round(p_qty * v_harga) USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.terima_vendor_outlet
    (outlet_id, supplier_id, bahan_baku_id, qty, harga_snapshot, tanggal_terima, catatan, foto_url, dicatat_oleh)
  VALUES (v_outlet, p_supplier_id, p_bahan_baku_id, p_qty, v_harga, p_tanggal,
          NULLIF(btrim(p_catatan), ''), NULLIF(btrim(p_foto_url), ''), v_staff)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.koreksi_terima_vendor(p_id uuid, p_qty numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.terima_vendor_outlet; v_peran text := public.peran_saya();
BEGIN
  SELECT * INTO r FROM public.terima_vendor_outlet WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catatan tidak ditemukan' USING ERRCODE = 'no_data_found'; END IF;
  -- Pencatat sendiri, atau pengesah.
  -- COALESCE wajib: bila pemanggil bukan staff aktif, v_peran NULL dan
  -- (false OR NULL) = NULL -> IF NOT (NULL) TIDAK menolak. Kelas bug yang sama
  -- dengan penjaga yang lolos diam-diam di proyek ini.
  IF NOT (r.dicatat_oleh = auth.uid() OR COALESCE(v_peran, '') IN ('purchasing','kitchen','admin')) THEN
    RAISE EXCEPTION 'Catatan tidak ditemukan' USING ERRCODE = 'no_data_found';  -- sengaja sama: jangan bocorkan keberadaan
  END IF;
  IF r.status <> 'dicatat' THEN
    RAISE EXCEPTION 'Catatan sudah % -- tidak bisa dikoreksi', r.status USING ERRCODE = 'check_violation';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty * r.harga_snapshot > 10000000 THEN
    RAISE EXCEPTION 'Jumlah koreksi tidak wajar' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.terima_vendor_outlet SET qty = p_qty, updated_at = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.daftar_terima_vendor_saya(p_dari date, p_sampai date)
RETURNS TABLE(id uuid, tanggal_terima date, bahan_nama text, satuan text, supplier_nama text,
              qty numeric, harga_snapshot numeric, status text, dicatat_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.tanggal_terima, b.nama, b.satuan, s.nama, t.qty, t.harga_snapshot, t.status, t.dicatat_at
    FROM public.terima_vendor_outlet t
    JOIN public.bahan_baku b ON b.id = t.bahan_baku_id
    JOIN public.supplier s ON s.id = t.supplier_id
   WHERE t.outlet_id = (SELECT s2.outlet_id FROM public.outlet_staff s2 WHERE s2.id = auth.uid() AND s2.status = 'active')
     AND t.tanggal_terima BETWEEN p_dari AND p_sampai
   ORDER BY t.dicatat_at DESC
$$;

REVOKE ALL ON FUNCTION public.sync_terima_vendor_ledger(), public._harga_snapshot_vendor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.info_terima_vendor(uuid), public.catat_terima_vendor(uuid,uuid,numeric,date,text,text),
  public.koreksi_terima_vendor(uuid,numeric), public.daftar_terima_vendor_saya(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.info_terima_vendor(uuid), public.catat_terima_vendor(uuid,uuid,numeric,date,text,text),
  public.koreksi_terima_vendor(uuid,numeric), public.daftar_terima_vendor_saya(date,date) TO authenticated, service_role;

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_sync_terima_vendor_ledger ON public.terima_vendor_outlet;
-- DROP FUNCTION IF EXISTS public.daftar_terima_vendor_saya(date,date), public.koreksi_terima_vendor(uuid,numeric),
--   public.catat_terima_vendor(uuid,uuid,numeric,date,text,text), public.info_terima_vendor(uuid),
--   public._harga_snapshot_vendor(uuid,uuid), public.sync_terima_vendor_ledger();
