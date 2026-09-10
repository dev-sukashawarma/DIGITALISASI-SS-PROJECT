-- 20260910220000_penjaga_isi_kemasan_saat_terima_po.sql
--
-- Penjaga (2) dari fondasi multi-vendor: menolak penerimaan PO yang isi
-- kemasannya berbeda dari yang bisa diwakili bahan itu.
--
-- ============================================================================
-- KENAPA INI SATU-SATUNYA PENJAGA YANG MEMBLOKIR
-- ============================================================================
--
-- `verifikasi_terima_po` sudah punya dua penjaga (PO uji coba, salah satuan
-- harga). Keduanya sengaja TIDAK memblokir: mereka menahan penulisan harga
-- master lalu mencatat penolakannya di `bahan_baku_harga_history`. Itu benar,
-- karena penerimaannya sendiri tetap sah -- barangnya nyata datang, dan qty-nya
-- tetap tercatat betul. Harga bisa dibetulkan belakangan tanpa kehilangan apa pun.
--
-- Penjaga ini berbeda, dan perbedaannya bukan selera:
--
--   Untuk qty TIDAK ADA jalan mundur yang aman.
--
-- `to_ledger_scale()` mengalikan dengan faktor milik BAHAN, bukan milik vendor.
-- Kalau vendor mengirim kemasan berisi lain, tidak ada nilai yang bisa ditulis
-- yang sekaligus benar untuk (a) saldo cm dan (b) hitungan Roll/Dus yang dilihat
-- crew saat opname. Satu bahan hanya punya satu jembatan satuan. Menulis apa pun
-- berarti memilih siapa yang dibohongi.
--
-- Itulah yang terjadi pada FOIL: setiap roll Altindo 500 cm dicatat 760 cm,
-- 52% terlalu banyak, sampai akhirnya minus di 17 outlet dan butuh 42 baris
-- ledger berpasangan untuk memulihkan.
--
-- Jadi jawabannya bukan "catat dengan peringatan", tapi "jangan dicatat sampai
-- bahannya dipecah". Penjaga ini menegakkan urutan yang sudah jadi aturan:
-- **pecah DULU, sebelum barang masuk gudang.**
--
-- ============================================================================
-- KENAPA TRIGGER, BUKAN MENGUBAH verifikasi_terima_po
-- ============================================================================
--
-- Fungsi itu ~300 baris dan memuat dua penjaga yang sudah terbukti. Menulis
-- ulang seluruhnya demi menyisipkan satu pemeriksaan berarti mempertaruhkan
-- keduanya, dan `CREATE OR REPLACE` tidak akan mengeluh kalau ada yang hilang --
-- persis cara ranjau-2030 membuang perbaikan reversal BOM tanpa suara.
--
-- Trigger ini menjaga titik yang sebenarnya: SAAT stok ditulis. Ia ikut menjaga
-- jalur lain yang menulis `pembelian_supplier` ber-`ref_po_id`, sekarang maupun
-- nanti -- bukan cuma satu pemanggil.
--
-- ============================================================================
-- KENAPA AMAN MEMBLOKIR (diukur, bukan diasumsikan)
-- ============================================================================
--
-- Diperiksa 2026-09-10, seluruh katalog aktif: setiap baris `isi_satuan_kecil`
-- COCOK dengan isi turunan master untuk `satuan_beli`-nya, KECUALI satu --
-- FOIL/Altindo (500 vs 760). Jadi penjaga ini tidak akan menghasilkan alarm
-- palsu di data hari ini.
--
-- Diam (tidak memblokir) kalau tidak bisa memastikan:
--   * tak ada baris katalog untuk (bahan, supplier) itu
--   * `isi_satuan_kecil` kosong
--   * `satuan_beli` tak cocok dengan tingkat satuan mana pun di master
--     (mis. PRINTER THERMAL 'unit', ID CARD 'pcs' -- bahan tanpa satuan kecil)
-- Menolak berdasarkan ketidaktahuan lebih buruk daripada tidak menolak.

CREATE OR REPLACE FUNCTION public.cek_isi_kemasan_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_supplier   uuid;
  v_nomor_po   text;
  v_satuan     text;
  v_isi_vendor numeric;
  v_isi_master numeric;
  v_nama       text;
  v_vendor     text;
BEGIN
  IF NEW.tipe <> 'pembelian_supplier' OR NEW.ref_po_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT po.supplier_id, po.nomor_po INTO v_supplier, v_nomor_po
    FROM public.purchase_order po WHERE po.id = NEW.ref_po_id;

  IF v_supplier IS NULL THEN
    RETURN NEW;                       -- PO tanpa supplier tertaut: tak bisa dicek
  END IF;

  SELECT lower(btrim(bs.satuan_beli)), bs.isi_satuan_kecil
    INTO v_satuan, v_isi_vendor
    FROM public.bahan_baku_supplier bs
   WHERE bs.bahan_baku_id = NEW.bahan_baku_id
     AND bs.supplier_id   = v_supplier
     AND bs.is_active;

  IF v_satuan IS NULL OR v_isi_vendor IS NULL THEN
    RETURN NEW;                       -- belum ada di katalog: diam
  END IF;

  SELECT b.nama,
         CASE
           WHEN v_satuan = lower(btrim(b.satuan))        THEN b.faktor_tampilan
           WHEN v_satuan = lower(btrim(b.satuan_tengah)) THEN b.faktor_tampilan / NULLIF(b.faktor_tengah, 0)
           WHEN v_satuan = lower(btrim(b.satuan_kecil))  THEN 1
           ELSE NULL
         END
    INTO v_nama, v_isi_master
    FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id;

  IF v_isi_master IS NULL OR v_isi_master <= 0 THEN
    RETURN NEW;                       -- satuan beli tak memetakan ke tingkat mana pun: diam
  END IF;

  -- Toleransi 0,1% untuk pembulatan numeric, bukan untuk selisih nyata.
  -- Selisih sungguhan selalu jauh lebih besar (FOIL: 500 vs 760 = 34%).
  IF abs(v_isi_vendor - v_isi_master) / v_isi_master > 0.001 THEN
    SELECT s.nama INTO v_vendor FROM public.supplier s WHERE s.id = v_supplier;

    RAISE EXCEPTION
      'Isi kemasan vendor berbeda dari master: % dari % berisi % % per %, '
      'sedangkan master menghitung % % per %. PO % tidak bisa diterima ke bahan '
      'ini karena satu bahan hanya punya satu jembatan satuan -- mencatatnya '
      'akan salah % persen. Pecah dulu bahannya per SPESIFIKASI (bukan per merek), '
      'lalu terima ulang. Kalau justru isi di Katalog Harga Vendor yang keliru, '
      'perbaiki di sana. Lihat docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md',
      v_nama, COALESCE(v_vendor, 'vendor'), v_isi_vendor,
      COALESCE((SELECT b.satuan_kecil FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id), 'satuan kecil'),
      v_satuan,
      v_isi_master,
      COALESCE((SELECT b.satuan_kecil FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id), 'satuan kecil'),
      v_satuan,
      COALESCE(v_nomor_po, '?'),
      round(abs(v_isi_vendor - v_isi_master) / v_isi_master * 100, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cek_isi_kemasan_vendor ON public.ledger_stok;
CREATE TRIGGER trg_cek_isi_kemasan_vendor
  BEFORE INSERT ON public.ledger_stok
  FOR EACH ROW EXECUTE FUNCTION public.cek_isi_kemasan_vendor();

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_cek_isi_kemasan_vendor ON public.ledger_stok;
-- DROP FUNCTION IF EXISTS public.cek_isi_kemasan_vendor();
