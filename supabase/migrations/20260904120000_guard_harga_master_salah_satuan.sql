-- 20260904120000_guard_harga_master_salah_satuan.sql
-- Cegah harga master (bahan_baku_harga) ter-rebase diam-diam ke satuan yang
-- salah saat penerimaan PO.
--
-- Basis: definisi LIVE verifikasi_terima_po (pg_get_functiondef), BUKAN file
-- migration lama -- po_on_verified() dari 20260820155500 sudah TIDAK eksis di
-- DB dan triggernya sudah dilepas; jalur sync harga yang benar-benar jalan
-- ada di RPC ini.
--
-- Perubahan perilaku hanya satu: upsert harga master dilewati (dan dicatat ke
-- bahan_baku_harga_history sebagai DITOLAK) ketika rasio harga baru terhadap
-- master persis sama dengan salah satu faktor konversi bahan tsb. Alur lain --
-- ledger, qty_terima, status PO, jatuh tempo -- tidak disentuh.

CREATE OR REPLACE FUNCTION public.verifikasi_terima_po(p_po_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kitchen_id  UUID := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'; -- GUDANG PUSAT (HQ)
  v_status      TEXT;
  v_nomor_po    TEXT;
  v_item        JSONB;
  v_item_id     UUID;
  v_bb_id       UUID;
  v_nama_bahan  TEXT;
  v_satuan      TEXT;
  v_qty_pesan   NUMERIC;
  v_old_terima  NUMERIC;
  v_incoming    NUMERIC;
  v_new_terima  NUMERIC;
  v_harga_trima NUMERIC;
  v_kondisi     TEXT;
  v_catatan     TEXT;
  v_total_pesan NUMERIC := 0;
  v_total_terima NUMERIC := 0;
  v_all_completed BOOLEAN := true;
  v_has_any_received BOOLEAN := false;
  v_new_status  TEXT;
  v_old_harga   NUMERIC;
  v_rasio       NUMERIC;
  v_faktor      NUMERIC;
  v_salah_satuan BOOLEAN;
BEGIN
  -- 1. Validasi hak akses
  IF NOT public.can_manage_po() THEN
    RAISE EXCEPTION 'Hanya staff dengan role yang berwenang (Admin/Finance/Purchasing/Kitchen) yang dapat verifikasi Purchase Order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Ambil PO
  SELECT status, nomor_po INTO v_status, v_nomor_po
  FROM public.purchase_order WHERE id = p_po_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase Order tidak ditemukan';
  END IF;

  IF v_status IN ('dibatalkan') THEN
    RAISE EXCEPTION 'Purchase Order % sudah dibatalkan - tidak dapat diverifikasi', v_nomor_po;
  END IF;

  -- 3. Loop tiap item dalam payload
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'id')::UUID;
    v_kondisi := COALESCE(v_item->>'kondisi', 'baik');
    v_catatan := v_item->>'catatan';
    v_harga_trima := NULLIF((v_item->>'harga_terima')::NUMERIC, 0);

    -- Ambil data item saat ini
    SELECT 
      poi.bahan_baku_id,
      COALESCE(b.nama, poi.item_description, 'Item PO'),
      COALESCE(b.satuan, poi.satuan_ad_hoc, 'satuan'),
      COALESCE(poi.qty_pesan, 0),
      COALESCE(poi.qty_terima, 0)
    INTO
      v_bb_id,
      v_nama_bahan,
      v_satuan,
      v_qty_pesan,
      v_old_terima
    FROM public.purchase_order_item poi
    LEFT JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
    WHERE poi.id = v_item_id AND poi.purchase_order_id = p_po_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Tentukan kuantitas tiba sekarang (incoming delta) vs kuantitas total diterima
    IF (v_item ? 'qty_datang') AND (v_item->>'qty_datang')::NUMERIC > 0 THEN
      v_incoming := (v_item->>'qty_datang')::NUMERIC;
      v_new_terima := v_old_terima + v_incoming;
    ELSE
      -- Jika client kirim new total qty_terima
      v_new_terima := (v_item->>'qty_terima')::NUMERIC;
      v_incoming := GREATEST(0, v_new_terima - v_old_terima);
    END IF;

    -- Update purchase_order_item
    UPDATE public.purchase_order_item
    SET
      qty_terima   = v_new_terima,
      harga_terima = COALESCE(v_harga_trima, harga_pesan),
      kondisi      = v_kondisi,
      catatan      = COALESCE(v_catatan, catatan)
    WHERE id = v_item_id;

    -- Jika ada barang fisik baru yang tiba dan kondisi baik -> Masukkan ke ledger Gudang Pusat
    IF v_incoming > 0 AND v_kondisi = 'baik' AND v_bb_id IS NOT NULL THEN
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty,
        ref_po_id, catatan, created_by, created_at
      ) VALUES (
        v_kitchen_id,
        v_bb_id,
        'pembelian_supplier',
        to_ledger_scale(v_kitchen_id, v_bb_id, v_incoming),
        p_po_id,
        'Terima PO ' || v_nomor_po || ' â€” ' || v_nama_bahan || ' (' || v_incoming || ' ' || v_satuan || ')',
        auth.uid(),
        NOW()
      );

      -- Update master price & audit history jika ada harga terima
      IF v_harga_trima IS NOT NULL AND v_harga_trima > 0 THEN
        SELECT harga_beli INTO v_old_harga
        FROM public.bahan_baku_harga
        WHERE bahan_baku_id = v_bb_id;

        -- GUARD SALAH SATUAN (2026-09-04)
        -- harga_terima kontraknya per SATUAN BESAR (form terima melabeli
        -- "Harga Beli Faktur (Rp/<satuan besar>)"). Kalau operator terlanjur
        -- mengisi harga per Pack/Kg/Lembar, master ikut ter-rebase diam-diam
        -- dan menyeret HPP, nilai persediaan, serta estimasi budget permintaan.
        -- Sidik jarinya khas: rasio harga baru/lama PERSIS sama dengan salah
        -- satu faktor konversi bahan itu (mis. BAWANG 650.000 -> 32.500 = 20x
        -- = faktor_tengah). Pergerakan harga asli tidak pernah begitu
        -- (terukur: MINYAK +2%, SAPI +3%, FOIL +31%, AYAM +53%).
        -- Toleransi 1% supaya hanya rasio yang benar-benar pas yang tertangkap.
        v_salah_satuan := false;
        IF v_old_harga IS NOT NULL AND v_old_harga > 0 THEN
          v_rasio := v_harga_trima / v_old_harga;
          IF v_rasio < 1 THEN
            v_rasio := 1 / v_rasio;
          END IF;

          FOR v_faktor IN
            SELECT f FROM (
              SELECT b.faktor_tengah::NUMERIC AS f FROM public.bahan_baku b WHERE b.id = v_bb_id
              UNION ALL
              SELECT b.faktor_tampilan::NUMERIC FROM public.bahan_baku b WHERE b.id = v_bb_id
              UNION ALL
              SELECT b.faktor_konversi::NUMERIC FROM public.bahan_baku b WHERE b.id = v_bb_id
              UNION ALL
              SELECT b.faktor_tampilan::NUMERIC / NULLIF(b.faktor_tengah, 0)
                FROM public.bahan_baku b WHERE b.id = v_bb_id
            ) k
            WHERE f IS NOT NULL AND f >= 2
          LOOP
            IF ABS(v_rasio - v_faktor) / v_faktor <= 0.01 THEN
              v_salah_satuan := true;
              EXIT;
            END IF;
          END LOOP;
        END IF;

        IF v_salah_satuan THEN
          -- Master TIDAK ditimpa. harga_terima di item PO tetap tersimpan apa
          -- adanya supaya selisihnya kelihatan di tab Harga Bahan, dan owner
          -- bisa menimpa manual lewat Sync Master kalau ternyata memang benar.
          INSERT INTO public.bahan_baku_harga_history (
            bahan_baku_id, harga_lama, harga_baru, ref_po_id,
            catatan, changed_by, changed_at
          ) VALUES (
            v_bb_id,
            v_old_harga,
            v_old_harga,
            p_po_id,
            'DITOLAK (dugaan salah satuan): PO ' || v_nomor_po || ' mengisi Rp '
              || v_harga_trima || ' per ' || v_satuan || ', rasio '
              || ROUND(v_rasio, 2) || 'x terhadap master Rp ' || v_old_harga
              || '. Harga master dipertahankan.',
            auth.uid(),
            NOW()
          );
        ELSE

        INSERT INTO public.bahan_baku_harga (
          bahan_baku_id, harga_beli, harga_beli_display, harga_updated_at, updated_by
        ) VALUES (
          v_bb_id,
          v_harga_trima,
          v_harga_trima,
          NOW(),
          auth.uid()
        )
        ON CONFLICT (bahan_baku_id) DO UPDATE
          SET harga_beli          = EXCLUDED.harga_beli,
              harga_beli_display  = EXCLUDED.harga_beli_display,
              harga_updated_at    = EXCLUDED.harga_updated_at,
              updated_by          = EXCLUDED.updated_by;

        IF v_old_harga IS NULL OR v_old_harga <> v_harga_trima THEN
          INSERT INTO public.bahan_baku_harga_history (
            bahan_baku_id,
            harga_lama,
            harga_baru,
            ref_po_id,
            catatan,
            changed_by,
            changed_at
          ) VALUES (
            v_bb_id,
            v_old_harga,
            v_harga_trima,
            p_po_id,
            'Update dari penerimaan PO ' || v_nomor_po || ' (' || v_incoming || ' ' || v_satuan || ')',
            auth.uid(),
            NOW()
          );
        END IF;

        END IF; -- v_salah_satuan
      END IF;
    END IF;
  END LOOP;

  -- 4. Hitung status kelengkapan seluruh item pada PO
  SELECT
    COALESCE(SUM(qty_pesan), 0),
    COALESCE(SUM(COALESCE(qty_terima, 0)), 0),
    BOOL_AND(COALESCE(qty_terima, 0) >= qty_pesan),
    BOOL_OR(COALESCE(qty_terima, 0) > 0)
  INTO
    v_total_pesan,
    v_total_terima,
    v_all_completed,
    v_has_any_received
  FROM public.purchase_order_item
  WHERE purchase_order_id = p_po_id;

  IF v_all_completed AND v_total_pesan > 0 THEN
    v_new_status := 'diterima_lengkap';
  ELSIF v_has_any_received THEN
    v_new_status := 'sebagian_diterima';
  ELSE
    v_new_status := 'dikirim_ke_supplier';
  END IF;

  -- Update status PO dan tanggal jatuh tempo
  UPDATE public.purchase_order po
  SET
    status            = v_new_status,
    diverifikasi_oleh = auth.uid(),
    diverifikasi_at   = COALESCE(po.diverifikasi_at, NOW()),
    jatuh_tempo       = COALESCE(po.jatuh_tempo, NOW()::date + COALESCE(s.termin_hari, 0))
  FROM public.supplier s
  WHERE po.id = p_po_id
    AND po.supplier_id = s.id;

  -- Jika supplier tidak terhubung ke tabel supplier
  UPDATE public.purchase_order
  SET
    status            = v_new_status,
    diverifikasi_oleh = auth.uid(),
    diverifikasi_at   = COALESCE(diverifikasi_at, NOW())
  WHERE id = p_po_id AND jatuh_tempo IS NULL;

  RETURN jsonb_build_object(
    'success',      true,
    'status',       v_new_status,
    'message',      CASE 
                      WHEN v_new_status = 'diterima_lengkap' THEN 'Seluruh pesanan PO telah diterima lengkap.'
                      ELSE 'Penerimaan bertahap berhasil dicatat. Status PO: Sebagian Diterima.'
                    END,
    'total_pesan',  v_total_pesan,
    'total_terima', v_total_terima
  );
END;
$function$
;
