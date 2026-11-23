-- Terima mutasi antar-outlet: validasi qty diterima di server.
--
-- Sejak 2026-11-23 form terima (apps/stok mutasi/[id]) bisa mengisi jumlah diterima
-- saat kondisi Rusak / Hilang-Kurang. Penjagaan 0 <= diterima <= dikirim baru ada
-- di klien; RPC menerima angka apa pun (mis. 999 untuk kiriman 5) dan langsung
-- menulis transfer_masuk sebesar itu ke ledger -> stok tujuan bisa digelembungkan
-- lewat panggilan RPC langsung. Fungsi ini menolak:
--   - item yang bukan milik mutasi ini,
--   - qty_diterima kosong / bukan angka / negatif,
--   - qty_diterima > qty_dikirim (atau qty_diajukan bila belum ada qty_dikirim),
--     toleransi 0,000001 untuk pembulatan.
-- Selain validasi, isi fungsi sama persis dengan definisi live (cek otorisasi,
-- status, to_ledger_scale).
--
-- UTANG REPLAY: fungsi ini juga didefinisikan 20300105000017_scale_aware_ledger_writers
-- (timestamp 2030, terurut SESUDAH berkas ini). Replay dari nol akan memulihkan versi
-- tanpa validasi. Produksi aman (berkas 2030 sudah terstempel). Timestamp 2030 tidak
-- dipakai karena ditolak scripts/migration-timestamp-lint.mjs.

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
  v_lama mutasi_antar_outlet_item%ROWTYPE;
  v_qty NUMERIC;
  v_batas NUMERIC;
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
    SELECT * INTO v_lama
    FROM mutasi_antar_outlet_item
    WHERE id = (v_item->>'item_id')::UUID AND mutasi_id = p_mutasi_id
    FOR UPDATE;
    IF v_lama.id IS NULL THEN
      RAISE EXCEPTION 'Item % bukan bagian dari mutasi ini', v_item->>'item_id';
    END IF;

    BEGIN
      v_qty := (v_item->>'qty_diterima')::NUMERIC;
    EXCEPTION WHEN others THEN
      v_qty := NULL;
    END;
    IF v_qty IS NULL OR v_qty < 0 THEN
      RAISE EXCEPTION 'Jumlah diterima tidak valid untuk item %', v_lama.id;
    END IF;

    v_batas := COALESCE(v_lama.qty_dikirim, v_lama.qty_diajukan, 0);
    IF v_qty > v_batas + 0.000001 THEN
      RAISE EXCEPTION 'Jumlah diterima (%) melebihi jumlah dikirim (%)', v_qty, v_batas;
    END IF;

    UPDATE mutasi_antar_outlet_item
    SET
      qty_diterima = v_qty,
      kondisi_diterima = v_item->>'kondisi_diterima',
      foto_bukti_terima = v_item->>'foto_bukti_terima'
    WHERE id = v_lama.id
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
