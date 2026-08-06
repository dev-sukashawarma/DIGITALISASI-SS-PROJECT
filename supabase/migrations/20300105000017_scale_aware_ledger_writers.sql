-- Migration: 20300105000017_scale_aware_ledger_writers.sql
--
-- §4 dari docs/SESSION-2026-08-04-STOK-SATUAN-GRAM-BESAR-AUDIT.md: 11 fungsi
-- penulis ledger_stok diaudit satu-satu. Semua nilai qty yang mereka tulis
-- berasal dari input client dalam SATUAN BESAR (qty_terima, qty_dikirim,
-- qty_diterima, qty waste, deduksi BOM) -- tak satu pun mengecek
-- saldo_is_gram(stok_balance) baris tujuan sebelum menulis delta. Kalau
-- baris tujuan sudah gram-scale, delta besar-scale itu salah besaran
-- sebesar faktor_tampilan.
--
-- Hasil audit:
--   AMAN, tak diubah:
--     - finalize_opname: menulis opname_item.selisih, yang SUDAH dihitung
--       gram-scale-vs-gram-scale oleh OpnameForm (fisik gram - sistem raw,
--       skala sama by construction) -- ini justru mekanisme "gram writer"-nya.
--     - hard_reset_outlet_data: set saldo=0, skala tidak relevan.
--     - trg_process_bom_stok cabang 'cancelled' (pengembalian void): jumlah
--       ulang ledger_stok.qty historis (SUM), otomatis ikut skala baris asal
--       -- benar SELAMA process_waterfall_deduction (penulis baris asal)
--       sudah benar, jadi cukup diperbaiki di situ.
--
--   DIPERBAIKI di migration ini:
--     - po_on_verified (terima PO dari supplier -> kitchen)
--     - process_waste_report_approval (approve waste, DUA jalur client
--       masuk sini: ManualEntryForm.tsx & WasteModal.tsx -- keduanya kirim
--       besar-scale mentah, jadi trigger inilah satu-satunya titik konversi
--       yang benar, BUKAN di client)
--     - kirim_mutasi / terima_mutasi (mutasi antar-outlet)
--     - finalize_surat_jalan (legacy, dipanggil dari
--       apps/distribusi/src/hooks/useSuratJalan.ts)
--     - finalize_surat_jalan_and_ledger (dipanggil dari VerifikasiForm.tsx)
--     - sj_on_dikirim_kurangi_kitchen (kirim SJ, kitchen dikurangi --
--       root cause asli yang memicu audit ini, lihat §4 dokumen sesi)
--     - process_waterfall_deduction (BOM per-order, frekuensi tertinggi --
--       fix lebih rumit dari sekadar bungkus sekali, lihat komentar di
--       definisinya)

-- ============================================================
-- Helper: konversi qty besar-scale ke skala baris stok_balance tujuan.
-- Tanpa baris (belum pernah ada transaksi outlet+bahan ini) -> anggap
-- besar-scale (default lama, aman).
-- ============================================================
CREATE OR REPLACE FUNCTION public.to_ledger_scale(
  p_outlet_id UUID,
  p_bahan_baku_id UUID,
  p_qty_besar NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_gram BOOLEAN;
  v_faktor  NUMERIC;
BEGIN
  SELECT saldo_is_gram(sb), b.faktor_tampilan
  INTO v_is_gram, v_faktor
  FROM public.stok_balance sb
  JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
  WHERE sb.outlet_id = p_outlet_id AND sb.bahan_baku_id = p_bahan_baku_id;

  IF NOT FOUND THEN
    RETURN p_qty_besar;
  END IF;

  IF v_is_gram AND v_faktor IS NOT NULL THEN
    RETURN p_qty_besar * v_faktor;
  END IF;

  RETURN p_qty_besar;
END;
$$;

-- ============================================================
-- 1. po_on_verified -- terima PO dari supplier (selalu ke kitchen)
-- ============================================================
CREATE OR REPLACE FUNCTION public.po_on_verified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DECLARE
    v_kitchen_id UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
    v_item       RECORD;
  BEGIN
    IF NEW.status NOT IN ('sebagian_diterima', 'diterima_lengkap') THEN
      RETURN NEW;
    END IF;
    IF OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;

    FOR v_item IN
      SELECT
        poi.id,
        poi.bahan_baku_id,
        poi.qty_terima,
        poi.harga_terima,
        b.nama AS nama_bahan
      FROM public.purchase_order_item poi
      JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
      WHERE poi.purchase_order_id = NEW.id
        AND poi.qty_terima IS NOT NULL
        AND poi.qty_terima > 0
        AND poi.kondisi = 'baik'
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty,
        ref_po_id, catatan, created_by, created_at
      ) VALUES (
        v_kitchen_id,
        v_item.bahan_baku_id,
        'pembelian_supplier',
        to_ledger_scale(v_kitchen_id, v_item.bahan_baku_id, v_item.qty_terima),
        NEW.id,
        'Terima dari supplier: ' || NEW.nomor_po || ' - ' || v_item.nama_bahan,
        NEW.diverifikasi_oleh,
        NOW()
      );

      IF v_item.harga_terima IS NOT NULL AND v_item.harga_terima > 0 THEN
        INSERT INTO public.bahan_baku_harga_history (
          bahan_baku_id, harga_lama, harga_baru, ref_po_id, changed_by
        )
        SELECT v_item.bahan_baku_id, bh.harga_beli, v_item.harga_terima, NEW.id, NEW.diverifikasi_oleh
        FROM (SELECT 1) _x
        LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = v_item.bahan_baku_id;

        INSERT INTO public.bahan_baku_harga (
          bahan_baku_id, harga_beli, harga_updated_at, updated_by
        ) VALUES (
          v_item.bahan_baku_id,
          v_item.harga_terima,
          NOW(),
          NEW.diverifikasi_oleh
        )
        ON CONFLICT (bahan_baku_id) DO UPDATE
          SET harga_beli       = EXCLUDED.harga_beli,
              harga_updated_at = EXCLUDED.harga_updated_at,
              updated_by       = EXCLUDED.updated_by;
      END IF;
    END LOOP;

    UPDATE public.purchase_order po
      SET jatuh_tempo = NEW.diverifikasi_at::date + COALESCE(s.termin_hari, 0)
      FROM public.supplier s
      WHERE po.id = NEW.id
        AND po.supplier_id = s.id
        AND po.jatuh_tempo IS NULL;

    RETURN NEW;
  END;
  $function$;

-- ============================================================
-- 2. process_waste_report_approval -- satu-satunya titik temu
--    ManualEntryForm.tsx & WasteModal.tsx (keduanya kirim besar-scale
--    mentah ke stok_waste_reports.qty)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_waste_report_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING' THEN
    INSERT INTO ledger_stok (
      outlet_id,
      bahan_baku_id,
      tipe,
      qty,
      catatan,
      ref_waste_id,
      created_by
    ) VALUES (
      NEW.outlet_id,
      NEW.bahan_baku_id,
      'waste',
      -to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, NEW.qty),
      'Approval waste: ' || NEW.reason,
      NEW.id,
      NEW.approved_by
    );
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. kirim_mutasi / terima_mutasi -- mutasi antar-outlet
-- ============================================================
CREATE OR REPLACE FUNCTION public.kirim_mutasi(p_mutasi_id uuid, p_kurir_info jsonb, p_items_dikirim jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mutasi mutasi_antar_outlet%ROWTYPE;
  v_item JSONB;
  v_mutasi_item mutasi_antar_outlet_item%ROWTYPE;
BEGIN
  SELECT * INTO v_mutasi FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_mutasi.id IS NULL THEN
    RAISE EXCEPTION 'Mutasi not found';
  END IF;

  IF auth_outlet_id() != v_mutasi.outlet_asal_id AND NOT auth_is_supervisor() THEN
    RAISE EXCEPTION 'Not authorized to send this mutasi';
  END IF;

  IF v_mutasi.status != 'menunggu_pengiriman' THEN
    RAISE EXCEPTION 'Invalid status for sending';
  END IF;

  UPDATE mutasi_antar_outlet
  SET status = 'dikirim', kurir_info = p_kurir_info, updated_at = NOW()
  WHERE id = p_mutasi_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_dikirim)
  LOOP
    UPDATE mutasi_antar_outlet_item
    SET qty_dikirim = (v_item->>'qty_dikirim')::NUMERIC
    WHERE id = (v_item->>'item_id')::UUID AND mutasi_id = p_mutasi_id
    RETURNING * INTO v_mutasi_item;

    IF v_mutasi_item.qty_dikirim > 0 THEN
      INSERT INTO ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, created_by, ref_transfer_id
      ) VALUES (
        v_mutasi.outlet_asal_id, v_mutasi_item.bahan_baku_id, 'transfer_keluar',
        -to_ledger_scale(v_mutasi.outlet_asal_id, v_mutasi_item.bahan_baku_id, v_mutasi_item.qty_dikirim),
        'Transfer keluar ke outlet ' || v_mutasi.outlet_tujuan_id,
        auth.uid(), p_mutasi_id
      );
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.terima_mutasi(p_mutasi_id uuid, p_items_diterima jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mutasi mutasi_antar_outlet%ROWTYPE;
  v_item JSONB;
  v_mutasi_item mutasi_antar_outlet_item%ROWTYPE;
BEGIN
  SELECT * INTO v_mutasi FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_mutasi.id IS NULL THEN
    RAISE EXCEPTION 'Mutasi not found';
  END IF;

  IF auth_outlet_id() != v_mutasi.outlet_tujuan_id AND NOT auth_is_supervisor() THEN
    RAISE EXCEPTION 'Not authorized to receive this mutasi';
  END IF;

  IF v_mutasi.status != 'dikirim' THEN
    RAISE EXCEPTION 'Invalid status for receiving';
  END IF;

  UPDATE mutasi_antar_outlet
  SET status = 'selesai',
      received_by = auth.uid(),
      received_at = NOW(),
      updated_at = NOW()
  WHERE id = p_mutasi_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_diterima)
  LOOP
    UPDATE mutasi_antar_outlet_item
    SET
      qty_diterima = (v_item->>'qty_diterima')::NUMERIC,
      kondisi_diterima = v_item->>'kondisi_diterima',
      foto_bukti_terima = v_item->>'foto_bukti_terima'
    WHERE id = (v_item->>'item_id')::UUID AND mutasi_id = p_mutasi_id
    RETURNING * INTO v_mutasi_item;

    IF v_mutasi_item.qty_diterima > 0 THEN
      INSERT INTO ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, created_by, ref_transfer_id
      ) VALUES (
        v_mutasi.outlet_tujuan_id, v_mutasi_item.bahan_baku_id, 'transfer_masuk',
        to_ledger_scale(v_mutasi.outlet_tujuan_id, v_mutasi_item.bahan_baku_id, v_mutasi_item.qty_diterima),
        'Transfer masuk dari outlet ' || v_mutasi.outlet_asal_id,
        auth.uid(), p_mutasi_id
      );
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================
-- 4. finalize_surat_jalan (legacy, dipanggil dari
--    apps/distribusi/src/hooks/useSuratJalan.ts)
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_surat_jalan(p_surat_jalan_id uuid)
 RETURNS surat_jalan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sj surat_jalan;
  v_outlet_id UUID;
  v_final_status TEXT;
  v_any_flagged BOOLEAN;
  r RECORD;
BEGIN
  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id FOR UPDATE;

  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'surat_jalan % not found', p_surat_jalan_id;
  END IF;
  IF v_sj.status != 'dikirim' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be dikirim', p_surat_jalan_id, v_sj.status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND outlet_id = v_sj.outlet_id) THEN
    RAISE EXCEPTION 'crew does not belong to this outlet';
  END IF;

  IF EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id = p_surat_jalan_id AND qty_terima IS NULL) THEN
    RAISE EXCEPTION 'masih ada barang belum dicek';
  END IF;

  SELECT EXISTS(SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id = p_surat_jalan_id AND flagged = true)
  INTO v_any_flagged;
  v_final_status := CASE WHEN v_any_flagged THEN 'diterima_sebagian' ELSE 'diterima_lengkap' END;

  UPDATE surat_jalan
  SET status = v_final_status, updated_at = NOW()
  WHERE id = p_surat_jalan_id
  RETURNING * INTO v_sj;

  FOR r IN
    SELECT bahan_baku_id, qty_terima
    FROM surat_jalan_item
    WHERE surat_jalan_id = p_surat_jalan_id AND qty_terima IS NOT NULL
  LOOP
    INSERT INTO ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, ref_surat_jalan_id, created_by, catatan
    )
    VALUES (
      v_sj.outlet_id, r.bahan_baku_id, 'terima_kiriman',
      to_ledger_scale(v_sj.outlet_id, r.bahan_baku_id, r.qty_terima),
      p_surat_jalan_id, auth.uid(),
      'Auto dari verifikasi kiriman'
    );
  END LOOP;

  RETURN v_sj;
END;
$function$;

-- ============================================================
-- 5. finalize_surat_jalan_and_ledger (dipanggil dari VerifikasiForm.tsx)
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_surat_jalan_and_ledger(p_surat_jalan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_outlet_id UUID;
  v_status TEXT;
  v_item RECORD;
  v_any_flagged BOOLEAN := false;
  v_final_status TEXT;
BEGIN
  SELECT outlet_id, status INTO v_outlet_id, v_status
  FROM surat_jalan
  WHERE id = p_surat_jalan_id;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Surat jalan not found';
  END IF;

  IF v_status IN ('diterima_lengkap', 'diterima_sebagian') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Surat jalan sudah diverifikasi sebelumnya'
    );
  END IF;

  FOR v_item IN
    SELECT
      sji.id,
      sji.bahan_baku_id,
      sji.qty_terima,
      sji.qty_dikirim,
      sji.kondisi,
      sji.catatan
    FROM surat_jalan_item sji
    WHERE sji.surat_jalan_id = p_surat_jalan_id
      AND sji.qty_terima IS NOT NULL
  LOOP
    IF v_item.qty_terima > 0 THEN
      INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
      VALUES (v_outlet_id, v_item.bahan_baku_id, 'terima_kiriman',
              to_ledger_scale(v_outlet_id, v_item.bahan_baku_id, v_item.qty_terima),
              p_surat_jalan_id, 'Auto-entry from surat jalan verification', NOW());
    END IF;

    -- Bagian ditolak/rusak: qty selalu 0 (murni catatan), skala tidak relevan.
    IF v_item.qty_terima < v_item.qty_dikirim OR v_item.kondisi IN ('rusak', 'hilang_qty') THEN
      DECLARE
        v_qty_tolak NUMERIC := v_item.qty_dikirim - COALESCE(v_item.qty_terima, 0);
      BEGIN
        INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
        VALUES (v_outlet_id, v_item.bahan_baku_id, 'rejected_kiriman', 0,
                p_surat_jalan_id,
                'Ditolak ' || v_qty_tolak::text || ' unit rusak/hilang'
                  || CASE WHEN v_item.catatan IS NOT NULL THEN ': ' || v_item.catatan ELSE '' END,
                NOW());
      END;
    END IF;
  END LOOP;

  SELECT EXISTS(
    SELECT 1
    FROM surat_jalan_item
    WHERE surat_jalan_id = p_surat_jalan_id
      AND (qty_terima < qty_dikirim OR kondisi IN ('rusak', 'hilang_qty') OR flagged = true)
  ) INTO v_any_flagged;

  v_final_status := CASE WHEN v_any_flagged THEN 'diterima_sebagian' ELSE 'diterima_lengkap' END;

  UPDATE surat_jalan
  SET status = v_final_status, updated_at = NOW()
  WHERE id = p_surat_jalan_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verifikasi selesai, status: ' || v_final_status,
    'status', v_final_status
  );
END;
$function$;

-- ============================================================
-- 6. sj_on_dikirim_kurangi_kitchen -- root cause asli audit ini
-- ============================================================
CREATE OR REPLACE FUNCTION public.sj_on_dikirim_kurangi_kitchen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DECLARE
    v_kitchen_id UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
    v_item       RECORD;
    v_sudah_ada  BOOLEAN;
  BEGIN
    IF NOT (OLD.status <> 'dikirim' AND NEW.status = 'dikirim') THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.ledger_stok
      WHERE ref_shipment_id = NEW.id
        AND outlet_id = v_kitchen_id
        AND tipe = 'transfer_keluar'
    ) INTO v_sudah_ada;

    IF v_sudah_ada THEN
      RAISE WARNING 'sj_on_dikirim: ledger transfer_keluar untuk SJ % sudah ada, dilewati.', NEW.id;
      RETURN NEW;
    END IF;

    FOR v_item IN
      SELECT
        sji.bahan_baku_id,
        sji.qty_dikirim,
        b.nama AS nama_bahan
      FROM public.surat_jalan_item sji
      JOIN public.bahan_baku b ON b.id = sji.bahan_baku_id
      WHERE sji.surat_jalan_id = NEW.id
        AND sji.qty_dikirim > 0
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty,
        ref_shipment_id, catatan, created_at
      ) VALUES (
        v_kitchen_id,
        v_item.bahan_baku_id,
        'transfer_keluar',
        -to_ledger_scale(v_kitchen_id, v_item.bahan_baku_id, v_item.qty_dikirim),
        NEW.id,
        'Kirim SJ ke outlet - ' || v_item.nama_bahan,
        NOW()
      );
    END LOOP;

    RETURN NEW;
  END;
  $function$;

-- ============================================================
-- 7. process_waterfall_deduction -- BOM, frekuensi tertinggi (tiap order)
--
-- Lebih rumit dari sekadar bungkus to_ledger_scale sekali: p_total_deduction
-- (dari trg_process_bom_stok) adalah SATU angka kanonik besar-scale MILIK
-- bahan utama, tapi tiap iterasi waterfall bisa pindah ke bahan pengganti
-- yang saldo-nya BEDA skala. Jadi tiap langkah:
--   1. Ambil skala LOKAL bahan yang sedang diproses (utama atau pengganti).
--   2. Konversi v_remaining_deduction (kanonik besar) -> skala lokal untuk
--      dibandingkan terhadap v_current_stock & ditulis ke ledger.
--   3. Kalau cuma sebagian yang bisa dipotong (lanjut ke pengganti
--      berikutnya), konversi BALIK jumlah yang terpotong ke skala kanonik
--      sebelum dikurangkan dari v_remaining_deduction -- supaya bahan
--      berikutnya membandingkan terhadap sisa yang benar.
-- Saat v_is_gram=false di semua langkah (kasus lama, mayoritas bahan),
-- v_local_needed = v_remaining_deduction persis seperti sebelumnya --
-- perilaku lama utuh, nol risiko regresi untuk baris besar-scale.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_waterfall_deduction(p_outlet_id uuid, p_bahan_baku_id uuid, p_total_deduction numeric, p_catatan text, p_ref_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_remaining_deduction NUMERIC := p_total_deduction;
  v_current_stock NUMERIC;
  v_qty_to_deduct NUMERIC;
  v_local_needed NUMERIC;
  v_is_gram BOOLEAN;
  v_faktor NUMERIC;
  sub_rec RECORD;
BEGIN
  -- Item utama --------------------------------------------------------
  SELECT sb.saldo, saldo_is_gram(sb), b.faktor_tampilan
  INTO v_current_stock, v_is_gram, v_faktor
  FROM public.stok_balance sb
  JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
  WHERE sb.outlet_id = p_outlet_id AND sb.bahan_baku_id = p_bahan_baku_id;
  v_current_stock := COALESCE(v_current_stock, 0);

  v_local_needed := CASE WHEN v_is_gram AND v_faktor IS NOT NULL
                         THEN v_remaining_deduction * v_faktor
                         ELSE v_remaining_deduction END;

  IF v_current_stock >= v_local_needed THEN
    v_qty_to_deduct := v_local_needed;
    v_remaining_deduction := 0;
  ELSE
    IF EXISTS (SELECT 1 FROM public.bahan_baku_substitusi WHERE bahan_baku_utama_id = p_bahan_baku_id) THEN
      IF v_current_stock > 0 THEN
        v_qty_to_deduct := v_current_stock;
        v_remaining_deduction := v_remaining_deduction -
          (CASE WHEN v_is_gram AND v_faktor IS NOT NULL THEN v_current_stock / v_faktor ELSE v_current_stock END);
      ELSE
        v_qty_to_deduct := 0;
      END IF;
    ELSE
      v_qty_to_deduct := v_local_needed;
      v_remaining_deduction := 0;
    END IF;
  END IF;

  IF v_qty_to_deduct > 0 THEN
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_qty_to_deduct, p_catatan, p_ref_order_id, NOW()
    );
  END IF;

  -- Bahan pengganti (waterfall) -----------------------------------------
  WHILE v_remaining_deduction > 0 LOOP
    FOR sub_rec IN SELECT bahan_baku_pengganti_id FROM public.bahan_baku_substitusi
                   WHERE bahan_baku_utama_id = p_bahan_baku_id ORDER BY urutan ASC LOOP

      SELECT sb.saldo, saldo_is_gram(sb), b.faktor_tampilan
      INTO v_current_stock, v_is_gram, v_faktor
      FROM public.stok_balance sb
      JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
      WHERE sb.outlet_id = p_outlet_id AND sb.bahan_baku_id = sub_rec.bahan_baku_pengganti_id;
      v_current_stock := COALESCE(v_current_stock, 0);

      v_local_needed := CASE WHEN v_is_gram AND v_faktor IS NOT NULL
                             THEN v_remaining_deduction * v_faktor
                             ELSE v_remaining_deduction END;

      IF v_current_stock >= v_local_needed THEN
         v_qty_to_deduct := v_local_needed;
         v_remaining_deduction := 0;
      ELSE
         IF v_current_stock > 0 THEN
           v_qty_to_deduct := v_current_stock;
           v_remaining_deduction := v_remaining_deduction -
             (CASE WHEN v_is_gram AND v_faktor IS NOT NULL THEN v_current_stock / v_faktor ELSE v_current_stock END);
         ELSE
           v_qty_to_deduct := 0;
         END IF;
      END IF;

      IF v_qty_to_deduct > 0 THEN
        INSERT INTO public.ledger_stok (
          outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
        ) VALUES (
          p_outlet_id, sub_rec.bahan_baku_pengganti_id, 'pemakaian', -v_qty_to_deduct, p_catatan, p_ref_order_id, NOW()
        );
      END IF;

      EXIT WHEN v_remaining_deduction <= 0;
    END LOOP;

    -- Paksa potong sisa dari item utama (skala item utama)
    IF v_remaining_deduction > 0 THEN
      SELECT saldo_is_gram(sb), b.faktor_tampilan INTO v_is_gram, v_faktor
      FROM public.stok_balance sb
      JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
      WHERE sb.outlet_id = p_outlet_id AND sb.bahan_baku_id = p_bahan_baku_id;

      v_local_needed := CASE WHEN v_is_gram AND v_faktor IS NOT NULL
                             THEN v_remaining_deduction * v_faktor
                             ELSE v_remaining_deduction END;

      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
      ) VALUES (
        p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_local_needed, p_catatan, p_ref_order_id, NOW()
      );
      v_remaining_deduction := 0;
    END IF;
  END LOOP;
END;
$function$;
