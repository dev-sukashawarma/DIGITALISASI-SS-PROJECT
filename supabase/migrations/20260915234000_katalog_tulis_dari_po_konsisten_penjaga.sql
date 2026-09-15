-- supabase/migrations/20260915234000_katalog_tulis_dari_po_konsisten_penjaga.sql
--
-- Perbaikan atas 20260915230000: cabang INSERT `katalog_tulis_dari_po` bisa
-- membuat baris `bahan_baku_supplier` yang langsung ditolak
-- `cek_isi_kemasan_vendor` (migration 20260910220000) pada penerimaan PO
-- berikutnya untuk pasangan (bahan, vendor) yang sama.
--
-- ============================================================================
-- KENAPA INI BISA TERJADI
-- ============================================================================
--
-- Cabang INSERT menghitung `v_pembagi` dari `kemasan_qty` (basis kanonik
-- 2 Sep, fallback faktor penuh) lalu menyimpannya sebagai
-- `isi_satuan_kecil` untuk `satuan_beli = lower(btrim(bahan_baku.satuan))`.
-- Tapi `cek_isi_kemasan_vendor` menurunkan isi yang SEHARUSNYA untuk
-- `satuan_beli` = satuan master dari `faktor_tampilan` -- bukan dari
-- `kemasan_qty`. Untuk bahan yang keduanya sama, tidak ada masalah. Untuk
-- **PLASTIK BESAR** (`kemasan_qty` 100 vs `faktor_tampilan` 250 -- pertanyaan
-- terbuka ke owner di CLAUDE.md, belum dijawab sejak normalisasi harga
-- 3 September), baris yang baru saja dibuat fungsi ini akan ditolak trigger
-- itu tepat pada penerimaan PO berikutnya untuk vendor yang sama --
-- diverifikasi lewat query langsung ke DB: `kemasan_qty` 100, `faktor_tampilan`
-- 250, `abs(100-250)/250 = 60%` jauh di atas ambang 0,1%.
--
-- Diperiksa 2026-09-15, seluruh katalog aktif: PLASTIK BESAR **satu-satunya**
-- bahan yang divergen hari ini (pola sama dengan audit FOIL 2026-09-10).
--
-- ============================================================================
-- PERBAIKAN
-- ============================================================================
--
-- Sebelum INSERT (bukan UPDATE -- baris yang sudah ada di katalog sebelum
-- fungsi ini dijalankan tidak disentuh sama sekali oleh perbaikan ini),
-- turunkan ulang isi yang diharapkan `cek_isi_kemasan_vendor` untuk
-- `satuan_beli` = satuan master (persis logika CASE pertama trigger itu,
-- karena cabang INSERT SELALU memakai `lower(btrim(b.satuan))`): yaitu
-- `b.faktor_tampilan`. Kalau nilainya ada dan berbeda >0,1% dari `v_pembagi`,
-- jangan buat barisnya -- diam, konsisten dengan filosofi trigger ("diam kalau
-- tidak bisa memastikan" lebih aman daripada baris yang pasti akan ditolak).
-- Bahan itu tetap menunggu di jalur lama: `perlu_ditinjau` (tak pernah dibuat
-- baris = tetap tak ada baris, sama seperti sebelum fitur katalog-dari-PO ada).
--
-- Latensi yang berdekatan, dicatat supaya tidak dikira baru: `fill_harga_snapshot`
-- (20260915210000) menghitung nilai kiriman PLASTIK BESAR pakai `kemasan_qty`
-- (100), bukan `faktor_tampilan` (250) -- beda definisi yang sama, sisi lain.
-- Hari ini INERT karena katalog PLASTIK BESAR (satuan_beli 'ikat', kalau ada)
-- tidak akan pernah tercipta lagi lewat fungsi ini (harga tetap 0 di jalur
-- yang membacanya), tapi kalau kelak `kemasan_qty`/`faktor_tampilan` disatukan,
-- periksa juga titik itu.
--
-- ============================================================================
-- CABANG UPDATE TIDAK TERPENGARUH
-- ============================================================================
--
-- Baris yang sudah ada di katalog (row existing untuk pasangan bahan-vendor)
-- tidak dicek ulang isinya di sini -- guard hanya menahan pembuatan baris BARU.
-- Sekalian dibetulkan urutan aritmetika cabang UPDATE: kalikan dulu baru bagi
-- (`p_harga_besar * v_isi / v_pembagi`, bukan `p_harga_besar / v_pembagi * v_isi`)
-- supaya presisi numeric tidak kehilangan digit di pembagian antara.

BEGIN;

CREATE OR REPLACE FUNCTION public.katalog_tulis_dari_po(
  p_bahan uuid, p_supplier uuid, p_harga_besar numeric, p_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- konsisten dengan cek_isi_kemasan_vendor: cabang INSERT di bawah menahan
-- baris baru yang akan ditolak trigger itu pada penerimaan berikutnya.
DECLARE
  v_pembagi numeric;   -- satuan kecil per satuan besar (kemasan_qty / faktor penuh)
  v_isi     numeric;   -- satuan kecil per satuan_beli katalog
  v_harga   numeric;
  v_satuan  text;
  v_faktor_tampilan numeric; -- isi yang diharapkan cek_isi_kemasan_vendor untuk satuan master
BEGIN
  IF p_supplier IS NULL OR p_bahan IS NULL OR COALESCE(p_harga_besar,0) <= 0 THEN RETURN; END IF;

  SELECT COALESCE(NULLIF(bh.kemasan_qty,0),
           NULLIF(CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                       THEN b.faktor_tampilan ELSE b.faktor_konversi END,0), 1),
         lower(btrim(b.satuan)),
         b.faktor_tampilan
    INTO v_pembagi, v_satuan, v_faktor_tampilan
  FROM public.bahan_baku b LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = b.id
  WHERE b.id = p_bahan;
  IF NOT FOUND THEN RETURN; END IF;

  -- Vendor identitas: p_supplier dipakai APA ADANYA (tidak diresolve
  -- child->induk), sengaja konsisten dengan cek_isi_kemasan_vendor (yang
  -- juga membaca purchase_order.supplier_id mentah). fill_harga_snapshot
  -- me-resolve child->induk, tapi itu di titik BACA, bukan di titik TULIS ini.
  SELECT bs.isi_satuan_kecil INTO v_isi
  FROM public.bahan_baku_supplier bs WHERE bs.bahan_baku_id = p_bahan AND bs.supplier_id = p_supplier;

  IF FOUND THEN
    -- harga per satuan_beli = harga per satuan kecil x isi satuan_beli
    IF COALESCE(v_isi,0) <= 0 THEN RETURN; END IF;   -- tidak bisa dikonversi: diam
    v_harga := p_harga_besar * v_isi / v_pembagi;
    UPDATE public.bahan_baku_supplier
       SET harga = v_harga, harga_updated_at = now(), ref_po_id = p_po_id,
           sumber = 'po', perlu_ditinjau = false, is_active = true,
           updated_by = auth.uid()
     WHERE bahan_baku_id = p_bahan AND supplier_id = p_supplier;
  ELSE
    -- konsisten dengan cek_isi_kemasan_vendor: baris baru ini memakai
    -- satuan_beli = satuan master (v_satuan), jadi isi yang diharapkan
    -- trigger itu untuk satuan tersebut adalah b.faktor_tampilan (CASE
    -- pertamanya). Kalau v_pembagi (basis INSERT ini) menyimpang >0,1%,
    -- baris ini akan langsung ditolak pada penerimaan PO berikutnya untuk
    -- vendor ini -- jangan dibuat sama sekali (PLASTIK BESAR hari ini,
    -- kemasan_qty 100 vs faktor_tampilan 250).
    IF v_faktor_tampilan IS NOT NULL AND v_faktor_tampilan > 0
       AND abs(v_pembagi - v_faktor_tampilan) / v_faktor_tampilan > 0.001 THEN
      RETURN;
    END IF;

    INSERT INTO public.bahan_baku_supplier
      (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga,
       sumber, perlu_ditinjau, ref_po_id, harga_updated_at, updated_by)
    VALUES (p_bahan, p_supplier, v_satuan, v_pembagi, p_harga_besar,
            'po', false, p_po_id, now(), auth.uid());
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.katalog_tulis_dari_po(uuid,uuid,numeric,uuid) FROM PUBLIC, anon, authenticated;
-- hanya dipanggil dari verifikasi_terima_po (DEFINER); tidak perlu GRANT ke authenticated

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.katalog_tulis_dari_po'::regproc) INTO v_def;
  IF v_def NOT LIKE '%konsisten dengan cek_isi_kemasan_vendor%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: penanda guard hilang di katalog_tulis_dari_po';
  END IF;
  IF v_def NOT LIKE '%v_faktor_tampilan%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: pemeriksaan faktor_tampilan hilang';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.katalog_tulis_dari_po'::regproc) IS NOT TRUE THEN
    RAISE EXCEPTION 'ASERSI GAGAL: katalog_tulis_dari_po bukan SECURITY DEFINER';
  END IF;
END $$;
COMMIT;

-- DOWN (rollback ke versi 20260915230000, tanpa guard & tanpa perbaikan urutan aritmetika):
-- lihat body CREATE OR REPLACE FUNCTION di 20260915230000_katalog_tulis_dari_po.sql
