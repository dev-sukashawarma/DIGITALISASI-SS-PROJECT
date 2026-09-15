-- supabase/migrations/20260915210000_pengerasan_harga.sql
-- Spec §6. Tiga hal:
-- (1) DROP po_on_verified(): zombie dari 20300105000017, tanpa guard PO uji &
--     salah satuan; triggernya di-drop 20260828114500. Kalau dipasang ulang
--     akan menembus semua perlindungan 4/8 Sep.
--     ⚠️ Diverifikasi ground-truth sebelum menulis migration ini (2026-09-15):
--     `po_on_verified` SUDAH TIDAK ADA di DB live (pg_proc: 0 baris; pg_trigger
--     ILIKE '%po_on_verified%': 0 baris) — berbeda dari ekspektasi task brief
--     (`po_on_verified_ada=1`). DROP FUNCTION IF EXISTS tetap idempoten dan
--     dipertahankan sebagai dokumentasi + penjagaan andai fungsi itu pernah
--     ditulis ulang oleh migration lain (pola ranjau-2030).
-- (2) get_waste_breakdown / _incidents / _summary_v2: hpp_kecil dari
--     harga_beli/faktor_konversi -> harga_beli/kemasan_qty (basis kanonik
--     2 Sep). get_waste_periode TIDAK disentuh (qty x harga_beli, satuan besar).
--     Ground-truth check (pg_get_functiondef, 2026-09-15): get_waste_incidents
--     dan get_waste_summary_v2 SUDAH memakai
--     `harga_beli / COALESCE(NULLIF(kemasan_qty,0), faktor_penuh)` sejak
--     20300132000000 — hanya get_waste_breakdown yang masih memakai
--     `harga_beli / COALESCE(faktor_konversi, 1)` murni. Jadi hanya
--     get_waste_breakdown yang di-CREATE OR REPLACE di sini; incidents &
--     summary_v2 TIDAK disalin ulang (nol perubahan, menghindari risiko
--     salah ketik pada fungsi yang sudah benar) — assersi di bawah tetap
--     memverifikasi ketiganya dari body live.
-- (3) fill_harga_snapshot: konversi katalog -> satuan besar pakai kemasan_qty
--     (fallback faktor_tampilan), selaras dengan get_hpp_periode.
-- ⚠️ 20300132000000 terurut SETELAH file ini; replay dari nol memulihkan
--     pembagi lama get_waste_breakdown. Produksi aman (terstempel). Preseden
--     2026-09-09.
BEGIN;

DROP FUNCTION IF EXISTS public.po_on_verified();

-- ------------------------------------------------------------------
-- get_waste_breakdown — hpp_kecil kini kemasan_qty (fallback faktor
-- penuh: faktor_tampilan bila faktor_tengah ada, else faktor_konversi),
-- konsisten dengan pola yang sudah dipakai get_waste_incidents/_summary_v2.
-- Badan disalin utuh dari 20300132000000 baris 232-277; HANYA ekspresi
-- hpp_kecil yang berubah.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_waste_breakdown(p_from date, p_to date)
 RETURNS TABLE(outlet_id uuid, outlet_name text, reason text, bahan_baku_id uuid, bahan_nama text, tanggal date, qty numeric, qty_kecil numeric, satuan_kecil text, hpp_kecil numeric, nilai numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  SELECT
    w.outlet_id,
    o.name AS outlet_name,
    w.reason,
    w.bahan_baku_id,
    b.nama AS bahan_nama,
    (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
    w.qty,
    -- Faktor PENUH (kecil per besar) -- aturan kanonik yang sama persis dengan
    -- trg_process_bom_stok (20300108000005) dan to_ledger_scale().
    w.qty * GREATEST(
      COALESCE(
        CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
             THEN b.faktor_tampilan
             ELSE b.faktor_konversi
        END,
        1
      ),
      1
    ) AS qty_kecil,
    b.satuan_kecil,
    -- Basis kanonik 2 Sep: harga_beli per kemasan_qty. Fallback ke faktor
    -- penuh (faktor_tampilan bila faktor_tengah ada, else faktor_konversi)
    -- kalau kemasan_qty kosong/nol -- pola identik get_waste_incidents/_v2.
    COALESCE(bh.harga_beli, 0) / COALESCE(
      NULLIF(bh.kemasan_qty, 0),
      NULLIF(
        CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
             THEN b.faktor_tampilan
             ELSE b.faktor_konversi
        END,
        0
      ),
      1
    ) AS hpp_kecil,
    w.qty * COALESCE(bh.harga_beli, 0) AS nilai
  FROM stok_waste_reports w
  JOIN outlets o ON o.id = w.outlet_id
  JOIN bahan_baku b ON b.id = w.bahan_baku_id
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
  WHERE w.status = 'APPROVED'
    AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND w.outlet_id IN (SELECT public.outlet_ids_terhitung());
END;
$function$;

-- ------------------------------------------------------------------
-- fill_harga_snapshot — konversi katalog vendor ke satuan besar kini
-- memakai kemasan_qty (basis kanonik) dengan fallback faktor_tampilan,
-- selaras get_hpp_periode. Badan disalin utuh dari 20260912100000
-- baris 40-71; hanya ekspresi & join di blok katalog yang berubah.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_harga_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_satu uuid; v_n int;
BEGIN
  IF NEW.vendor_id IS NULL THEN
    SELECT count(*), min(v::text)::uuid INTO v_n, v_satu FROM public.vendor_bahan(NEW.bahan_baku_id) v;
    IF v_n = 1 THEN NEW.vendor_id := v_satu; END IF;
  ELSE
    NEW.vendor_id := public.vendor_induk(NEW.vendor_id);
  END IF;

  IF COALESCE(NEW.harga_snapshot, 0) = 0 AND NEW.vendor_id IS NOT NULL THEN
    -- Katalog dihargai per `satuan_beli`; ubah ke satuan besar sebelum dipakai.
    -- Kali dulu, baru bagi: pembagian numeric lebih dulu menyisakan artefak
    -- pembulatan (554591,99999... alih-alih 554592).
    -- Basis kanonik 2 Sep: kemasan_qty (bahan_baku_harga), fallback
    -- faktor_tampilan (bahan_baku) kalau kemasan_qty kosong/nol.
    SELECT bs.harga * COALESCE(NULLIF(bh.kemasan_qty, 0), b.faktor_tampilan) / bs.isi_satuan_kecil
      INTO NEW.harga_snapshot
      FROM public.bahan_baku_supplier bs
      JOIN public.supplier s ON s.id = bs.supplier_id
      JOIN public.bahan_baku b ON b.id = bs.bahan_baku_id
      LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = bs.bahan_baku_id
     WHERE bs.bahan_baku_id = NEW.bahan_baku_id AND bs.is_active AND bs.harga > 0
       AND COALESCE(bs.isi_satuan_kecil, 0) > 0
       AND COALESCE(NULLIF(bh.kemasan_qty, 0), b.faktor_tampilan, 0) > 0
       AND COALESCE(s.vendor_induk_id, s.id) = NEW.vendor_id
     ORDER BY bs.harga_updated_at DESC NULLS LAST, bs.id
     LIMIT 1;
  END IF;
  IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN
    SELECT COALESCE(harga_beli, 0) INTO NEW.harga_snapshot FROM public.bahan_baku_harga WHERE bahan_baku_id = NEW.bahan_baku_id;
  END IF;
  NEW.harga_snapshot := COALESCE(NEW.harga_snapshot, 0);
  RETURN NEW;
END $function$;

DO $$
DECLARE v_def text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='po_on_verified') THEN
    RAISE EXCEPTION 'ASERSI GAGAL: po_on_verified masih ada';
  END IF;
  FOR v_def IN SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND proname IN ('get_waste_breakdown','get_waste_incidents','get_waste_summary_v2')
  LOOP
    IF v_def NOT LIKE '%kemasan_qty%' THEN
      RAISE EXCEPTION 'ASERSI GAGAL: fungsi waste belum memakai kemasan_qty';
    END IF;
    IF v_def NOT LIKE '%is_owner_or_admin%' THEN
      RAISE EXCEPTION 'ASERSI GAGAL: gate is_owner_or_admin hilang saat salin';
    END IF;
  END LOOP;
  SELECT pg_get_functiondef('public.fill_harga_snapshot'::regproc) INTO v_def;
  IF v_def NOT LIKE '%kemasan_qty%' OR v_def NOT LIKE '%vendor_induk%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: fill_harga_snapshot salah salin';
  END IF;
END $$;

COMMIT;
