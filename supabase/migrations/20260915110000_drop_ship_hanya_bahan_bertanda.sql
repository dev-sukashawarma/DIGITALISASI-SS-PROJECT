-- 20260915110000_drop_ship_hanya_bahan_bertanda.sql
--
-- Keputusan owner 2026-09-15: drop-ship (vendor antar langsung ke outlet) untuk
-- sekarang HANYA sayur; bahan lain tidak boleh tampil/dicatat.
--
-- Sebelumnya info_terima_vendor & catat_terima_vendor menerima bahan APA SAJA
-- yang punya baris katalog vendor -- crew outlet bisa mencatat mis. SAPI dari
-- Pak Aziz dan stok outletnya bertambah tanpa surat jalan. Ini lubang, bukan
-- sekadar tampilan.
--
-- Penanda bahan_baku.drop_ship (default false). Hanya "Sayur (lettuce)" dinyalakan.
-- Kedua RPC menolak bahan tak bertanda. Isi fungsi lain identik dengan definisi
-- live (20260911121000). koreksi/tolak/sahkan tidak diubah (bekerja atas catatan
-- yang sudah ada).
-- Uji: supabase/verifikasi/drop_ship/t8_hanya_sayur.sql

SET lock_timeout = '5s';

ALTER TABLE public.bahan_baku ADD COLUMN IF NOT EXISTS drop_ship boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bahan_baku.drop_ship IS
  'true = boleh dicatat terima langsung dari vendor di outlet (drop-ship). 2026-09-15: hanya Sayur (lettuce).';

UPDATE public.bahan_baku SET drop_ship = true
 WHERE nama = 'Sayur (lettuce)' AND is_active AND NOT drop_ship;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.bahan_baku WHERE drop_ship) <> 1 THEN
    RAISE EXCEPTION 'Harapan tepat 1 bahan drop_ship, dapat %', (SELECT count(*) FROM public.bahan_baku WHERE drop_ship);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.info_terima_vendor(p_bahan_baku_id uuid)
 RETURNS TABLE(supplier_id uuid, supplier_nama text, harga_snapshot numeric, rata_pakai_harian numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_outlet uuid; v_faktor numeric; v_rata numeric;
BEGIN
  SELECT s.outlet_id INTO v_outlet FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active';
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'Akun tidak terhubung ke outlet' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bahan_baku b WHERE b.id = p_bahan_baku_id AND b.drop_ship) THEN
    RAISE EXCEPTION 'Bahan ini tidak dikirim langsung vendor ke outlet' USING ERRCODE = 'check_violation';
  END IF;
  v_faktor := NULLIF(public.to_ledger_scale(v_outlet, p_bahan_baku_id, 1), 0);
  SELECT (-sum(l.qty) / 7.0) / v_faktor INTO v_rata FROM public.ledger_stok l
   WHERE l.outlet_id = v_outlet AND l.bahan_baku_id = p_bahan_baku_id AND l.tipe = 'pemakaian'
     AND l.created_at >= now() - interval '7 days';
  RETURN QUERY
    SELECT s.id, s.nama, public._harga_snapshot_vendor(s.id, p_bahan_baku_id), v_rata
      FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
     WHERE bs.bahan_baku_id = p_bahan_baku_id AND bs.is_active AND COALESCE(s.is_active, true)
     ORDER BY s.nama;
END $function$;

CREATE OR REPLACE FUNCTION public.catat_terima_vendor(p_bahan_baku_id uuid, p_supplier_id uuid, p_qty numeric, p_tanggal date, p_catatan text DEFAULT NULL::text, p_foto_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_staff uuid := auth.uid(); v_outlet uuid; v_harga numeric; v_id uuid;
BEGIN
  -- Outlet SELALU outlet_staff.outlet_id sendiri -- bukan accessible_outlet_ids()
  -- (yang mengembalikan semua outlet untuk kitchen; itu lubang opname 2026-08-13).
  SELECT s.outlet_id INTO v_outlet FROM public.outlet_staff s WHERE s.id = v_staff AND s.status = 'active';
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'Akun tidak terhubung ke outlet' USING ERRCODE = 'insufficient_privilege'; END IF;

  -- Hanya bahan ber-penanda drop_ship (2026-09-15: hanya sayur).
  IF NOT EXISTS (SELECT 1 FROM public.bahan_baku b WHERE b.id = p_bahan_baku_id AND b.drop_ship) THEN
    RAISE EXCEPTION 'Bahan ini tidak dikirim langsung vendor ke outlet' USING ERRCODE = 'check_violation';
  END IF;

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
END $function$;

-- DOWN:
-- (kembalikan definisi fungsi dari 20260911121000; kolom boleh dibiarkan)
-- ALTER TABLE public.bahan_baku DROP COLUMN drop_ship;
