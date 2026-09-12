-- Koreksi fill_harga_snapshot: harga katalog vendor dikonversi ke SATUAN BESAR.
--
-- Sebab: `bahan_baku_supplier.harga` dihargai per `satuan_beli`, sedangkan
-- `harga_snapshot` dikonsumsi sebagai harga per SATUAN BESAR
-- (`hpp_barang_masuk_harian_spv` mengalikannya dengan `qty_terima`, dan
-- fallback master `bahan_baku_harga.harga_beli` juga per satuan besar).
-- Untuk 12 dari 14 bahan multi-vendor rasionya 1,000 (satuan_beli = satuan
-- master) sehingga tak ada yang bergeser; FOIL TIDAK: `satuan_beli='roll'`
-- vs `satuan='Dus'`. Katalog FOIL 11.554 (Ekadharma, isi 760) dan 8.791
-- (Altindo, isi 500) versus master 421.977,6 — kiriman FOIL pertama akan
-- mencatat ~2% nilai sebenarnya.
--
-- Aturan: konversi HANYA bila baris katalog bisa direkonsiliasi —
-- `isi_satuan_kecil > 0` DAN `faktor_tampilan > 0`; selain itu katalog
-- dilewati dan jatuh ke fallback harga master (jangan menebak).
--   harga_satuan_besar = bs.harga * b.faktor_tampilan / bs.isi_satuan_kecil
-- Ekadharma: 11.554 / 760 × 36.480 = 554.592
-- Altindo  :  8.791 / 500 × 36.480 = 641.391,36
--
-- Migration 20260911152000 sudah applied & terstempel; koreksi dikirim sebagai
-- migration BARU, bukan dengan menyunting berkas yang sudah diterapkan.
--
-- CATATAN (a) — `approve_permintaan_svc` yang ditulis ulang di 20260911152000
-- TIDAK lagi memuat blok debit budget outlet (`v_total_debit` / `outlet_balance`
-- / `outlet_balance_ledger` `MATERIAL_PURCHASE`) yang ada pada definisi terakhir
-- ter-commit di `20260820110001_outlet_budget_topup_ledger.sql`. Blok itu sudah
-- inert di produksi sebelum branch ini (kedua tabel 0 baris meski 202 approval
-- sejak 20 Agu), jadi ini BUKAN regresi yang hidup — tetapi definisi kanonik di
-- repo kini menghilangkannya, dan bila dompet budget kelak dinyalakan ia akan
-- diam-diam tidak tersambung.
--
-- CATATAN (b) — `create_surat_jalan` juga didefinisikan oleh
-- `supabase/migrations/20300109000004_grant_purchasing_kitchen_stok_access.sql`,
-- yang terurut SETELAH berkas kita. Replay dari nol akan memulihkan versi tanpa
-- `vendor_id` sementara penjaganya tetap aktif — tak ada yang bisa dikirim.
-- Produksi aman karena kedua berkas sudah terstempel. Mengikuti preseden repo
-- (situasi sama, 2026-09-09): didokumentasikan, bukan di-rename.
SET lock_timeout = '5s';

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
    -- Katalog dihargai per `satuan_beli`; ubah ke satuan besar sebelum dipakai.
    -- Kali dulu, baru bagi: pembagian numeric lebih dulu menyisakan artefak
    -- pembulatan (554591,99999... alih-alih 554592).
    SELECT bs.harga * b.faktor_tampilan / bs.isi_satuan_kecil INTO NEW.harga_snapshot
      FROM public.bahan_baku_supplier bs
      JOIN public.supplier s ON s.id = bs.supplier_id
      JOIN public.bahan_baku b ON b.id = bs.bahan_baku_id
     WHERE bs.bahan_baku_id = NEW.bahan_baku_id AND bs.is_active AND bs.harga > 0
       AND COALESCE(bs.isi_satuan_kecil, 0) > 0
       AND COALESCE(b.faktor_tampilan, 0) > 0
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
