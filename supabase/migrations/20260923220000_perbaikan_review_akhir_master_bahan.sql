-- 20260923220000_perbaikan_review_akhir_master_bahan.sql
-- Perbaikan temuan review akhir branch "master bahan baku Tahap 1 (fondasi DB)".
-- Uji: supabase/verifikasi/master_bahan/t8_perbaikan_final.sql
--
-- Timestamp: brief meminta 20260923190000, tetapi versi itu sudah terstempel di DB
-- bersama oleh migration lain (golive_outlet_menu_aplikasi). Dipakai versi bebas
-- berikutnya setelah 20260923210000.
--
-- I1 — Mengaktifkan/menonaktifkan/menghapus supplier menggeser harga master.
--   trg_supplier_turunkan_harga_master (20260923183000) menurunkan ulang harga master
--   saat supplier.is_active berubah, dan DELETE supplier meng-CASCADE baris katalog
--   (yang juga memicu turunan). Policy supplier_write mengizinkan kitchen,
--   admin_finance, developer (status apa pun) menulis supplier; app finance
--   (usePurchaseOrder.ts) melakukan .update({is_active:false}). Probe review: kitchen
--   menonaktifkan PT Sahara menggeser master SAPI 109.999,89 -> 101.978.
--   Ruling: guard BEFORE UPDATE OF is_active / BEFORE DELETE — bila auth.uid() ada
--   (sesi pengguna), wajib outlet_staff aktif ber-role admin/owner/purchasing (sama
--   dengan _peran_master('harga'), jadi nonaktifkan_supplier/simpan_supplier sejalan).
--   Konteks tanpa auth.uid() (service role, migration, cron) lolos. supplier_write
--   TIDAK dipersempit: admin_finance tetap bisa edit nama/kontak sampai Tahap 2 (K3).
--
-- I2a — Halaman Katalog Vendor menulis bahan_baku_supplier langsung (tanpa penjaga
--   RPC), sehingga isi per satuan beli yang tak konsisten bisa menjadi sumber harga
--   master. Ruling: harga_vendor_terpercaya melewati baris yang isinya menyimpang
--   >0,1% dari isi turunan master, memakai aturan yang SAMA dengan simpan_harga_vendor
--   (hitung_faktor_po, lalu kg->gram = 1000). Label yang tak memetakan ke tingkat mana
--   pun tetap memenuhi syarat (perilaku lama; hanya bisa lewat p_paksa atau tulis
--   langsung). Tetap SECURITY INVOKER, signature & urutan sama.
--   Diperiksa sebelum apply: satu-satunya baris live yang kini terlewat adalah
--   FOIL / PT Altindo Mulia (roll 500 vs master 760). Baris itu BUKAN sumber harga
--   FOIL saat ini (sumbernya Ekadharma, 554.592), jadi tak ada harga master bergeser.
--
-- I2b — harga_updated_at dari klien bisa bertanggal masa depan dan "menang" selamanya.
--   Ruling: dijepit ke LEAST(COALESCE(nilai, now()), now()) saat INSERT, dan saat
--   UPDATE bila klien mengubahnya; tetap dibumbungkan ke now() bila harga berubah dan
--   klien tak mengisinya. Menjepit tidak menghalangi backdate. Hari ini 0 baris
--   bertanggal masa depan.
--
-- M1 — nonaktifkan_bahan_baku tak memeriksa bahan_baku_substitusi. Waterfall BOM
--   (process_waterfall_deduction) tetap memotong bahan utama & penggantinya, dan
--   trg_process_bom_stok tak menyaring is_active. Tabel substitusi tak punya kolom
--   aktif, jadi setiap barisnya dianggap berlaku: bahan yang muncul sebagai utama
--   ATAU pengganti tak bisa dinonaktifkan sampai baris substitusinya dihapus.
--   Badan fungsi selain blok baru identik dengan versi live (pg_get_functiondef).

-- ─── I1: guard status aktif / hapus supplier ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_jaga_status_hapus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = v_uid AND status = 'active';
  IF v_role IN ('admin', 'owner', 'purchasing') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Peran % tidak berhak % supplier: status aktif supplier menentukan harga master bahan baku. Minta purchasing, admin, atau owner.',
    COALESCE(v_role, '-'),
    CASE WHEN TG_OP = 'DELETE' THEN 'menghapus'
         WHEN NEW.is_active THEN 'mengaktifkan'
         ELSE 'menonaktifkan' END
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_jaga_status_hapus() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_supplier_jaga_status_hapus ON public.supplier;
CREATE TRIGGER trg_supplier_jaga_status_hapus
  BEFORE UPDATE OF is_active OR DELETE ON public.supplier
  FOR EACH ROW EXECUTE FUNCTION public.supplier_jaga_status_hapus();

-- ─── I2a: sumber harga hanya baris katalog yang isinya konsisten ─────────────
CREATE OR REPLACE FUNCTION public.harga_vendor_terpercaya(p_bahan uuid)
 RETURNS TABLE(supplier_id uuid, harga_per_besar numeric, harga_updated_at timestamp with time zone, sumber text, ref_po_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT s.supplier_id,
         s.harga / s.isi_satuan_kecil * COALESCE(b.faktor_tampilan, 1),
         s.harga_updated_at, s.sumber, s.ref_po_id
    FROM public.bahan_baku_supplier s
    JOIN public.bahan_baku b ON b.id = s.bahan_baku_id
    JOIN public.supplier  sp ON sp.id = s.supplier_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               public.hitung_faktor_po(b.satuan, s.satuan_beli, b.satuan_tengah, b.faktor_tengah,
                                       b.satuan_kecil, b.faktor_tampilan),
               CASE WHEN public._kanon_satuan(s.satuan_beli) = 'kg'
                     AND public._kanon_satuan(b.satuan_kecil) = 'gram' THEN 1000 END
             ) AS isi_master
    ) m
   WHERE s.bahan_baku_id = p_bahan
     AND s.is_active AND sp.is_active
     AND NOT s.perlu_ditinjau
     AND s.harga > 0 AND s.harga <> 'NaN'::numeric
     AND s.isi_satuan_kecil > 0 AND s.isi_satuan_kecil <> 'NaN'::numeric
     AND (m.isi_master IS NULL
          OR m.isi_master <= 0
          OR abs(s.isi_satuan_kecil - m.isi_master) / m.isi_master <= 0.001)
   ORDER BY s.harga_updated_at DESC NULLS LAST, s.updated_at DESC, s.id DESC
   LIMIT 1;
$function$;

-- ─── I2b: harga_updated_at tak boleh bertanggal masa depan ───────────────────
CREATE OR REPLACE FUNCTION public.bbs_isi_harga_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.harga_updated_at := LEAST(COALESCE(NEW.harga_updated_at, now()), now());
  ELSIF NEW.harga IS DISTINCT FROM OLD.harga
        AND NEW.harga_updated_at IS NOT DISTINCT FROM OLD.harga_updated_at THEN
    NEW.harga_updated_at := now();
  ELSIF NEW.harga_updated_at IS DISTINCT FROM OLD.harga_updated_at THEN
    NEW.harga_updated_at := LEAST(COALESCE(NEW.harga_updated_at, now()), now());
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── M1: nonaktifkan_bahan_baku memeriksa bahan_baku_substitusi ──────────────
CREATE OR REPLACE FUNCTION public.nonaktifkan_bahan_baku(p_id uuid, p_alasan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_halang text[] := '{}';
  v_teks   text;
  v_n      int;
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;

  -- trg_process_bom_stok tidak menyaring is_active: bahan di resep aktif tetap dipotong.
  SELECT string_agg(DISTINCT r.nama, ', ') INTO v_teks
    FROM public.resep_item ri JOIN public.resep r ON r.id = ri.resep_id
   WHERE ri.bahan_baku_id = p_id AND r.is_active;
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('masih dipakai resep aktif: ' || v_teks); END IF;

  -- Waterfall BOM memotong bahan utama & penggantinya tanpa melihat is_active;
  -- tabel substitusi tak punya kolom aktif, jadi setiap barisnya berlaku.
  SELECT string_agg(DISTINCT
           CASE WHEN s.bahan_baku_utama_id = p_id THEN 'utama untuk pengganti ' ELSE 'pengganti untuk ' END
           || COALESCE(o.nama, '?'), ', ') INTO v_teks
    FROM public.bahan_baku_substitusi s
    LEFT JOIN public.bahan_baku o
      ON o.id = CASE WHEN s.bahan_baku_utama_id = p_id THEN s.bahan_baku_pengganti_id ELSE s.bahan_baku_utama_id END
   WHERE p_id IN (s.bahan_baku_utama_id, s.bahan_baku_pengganti_id);
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('masih terdaftar di substitusi waterfall: ' || v_teks); END IF;

  SELECT count(*) INTO v_n FROM public.surat_jalan_item si JOIN public.surat_jalan s ON s.id = si.surat_jalan_id
   WHERE si.bahan_baku_id = p_id AND s.status IN ('draft', 'dikirim');
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris surat jalan draft/dikirim'); END IF;

  SELECT count(*) INTO v_n FROM public.purchase_order_item pi JOIN public.purchase_order p ON p.id = pi.purchase_order_id
   WHERE pi.bahan_baku_id = p_id AND p.status NOT IN ('diterima_lengkap', 'dibatalkan');
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris PO terbuka'); END IF;

  SELECT count(*) INTO v_n FROM public.permintaan_bahan_item pi JOIN public.permintaan_bahan p ON p.id = pi.permintaan_id
   WHERE pi.bahan_baku_id = p_id AND p.status = 'menunggu';
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris permintaan menunggu'); END IF;

  SELECT count(*) INTO v_n FROM public.opname_item oi JOIN public.opname o ON o.id = oi.opname_id
   WHERE oi.bahan_baku_id = p_id AND o.status = 'draft';
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris draft opname'); END IF;

  SELECT string_agg(o.name, ', ') INTO v_teks
    FROM public.stok_balance sb JOIN public.outlets o ON o.id = sb.outlet_id
   WHERE sb.bahan_baku_id = p_id AND sb.saldo <> 0;
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('saldo belum nol di: ' || v_teks); END IF;

  IF array_length(v_halang, 1) > 0 THEN
    RAISE EXCEPTION 'Tidak bisa dinonaktifkan — %', array_to_string(v_halang, '; ');
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku SET is_active = false WHERE id = p_id;
END;
$function$;
