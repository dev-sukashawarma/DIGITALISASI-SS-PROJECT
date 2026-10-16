-- Mutasi antar outlet: nama kurir + ongkir WAJIB diisi saat pengajuan, ikut ditinjau
-- Admin Kitchen di approve_mutasi (gerbang can_approve_mutasi tidak berubah).
--
-- Disimpan di kurir_info dengan kunci yang sudah dibaca web & native
-- (nama/provider, ongkos), jadi halaman detail lama langsung menampilkannya.
-- kirim_mutasi kini MENGGABUNGKAN kurir_info: nilai yang sudah disetujui menang,
-- pengirim hanya bisa menambah (pengirim_nama, resi). Mutasi lama tanpa kurir
-- pengajuan tetap bisa diisi saat kirim.

CREATE OR REPLACE FUNCTION public.ajukan_mutasi(
  p_outlet_asal_id uuid,
  p_outlet_tujuan_id uuid,
  p_catatan text,
  p_items jsonb,
  p_nama_kurir text,
  p_ongkir numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mutasi_id UUID;
  v_item JSONB;
  v_kurir text := btrim(COALESCE(p_nama_kurir, ''));
BEGIN
  IF auth_outlet_id() != p_outlet_asal_id AND NOT auth_is_supervisor() THEN
    RAISE EXCEPTION 'Not authorized to create mutasi for this outlet';
  END IF;
  IF v_kurir = '' THEN
    RAISE EXCEPTION 'Nama kurir wajib diisi' USING ERRCODE = '22023';
  END IF;
  IF length(v_kurir) > 100 THEN
    RAISE EXCEPTION 'Nama kurir maksimal 100 karakter' USING ERRCODE = '22023';
  END IF;
  IF p_ongkir IS NULL OR p_ongkir < 0 OR p_ongkir = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Ongkir wajib diisi (boleh 0)' USING ERRCODE = '22023';
  END IF;

  INSERT INTO mutasi_antar_outlet (
    outlet_asal_id, outlet_tujuan_id, catatan_pengajuan, created_by, kurir_info
  ) VALUES (
    p_outlet_asal_id, p_outlet_tujuan_id, p_catatan, auth.uid(),
    jsonb_build_object('nama', v_kurir, 'provider', v_kurir, 'ongkos', round(p_ongkir))
  ) RETURNING id INTO v_mutasi_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO mutasi_antar_outlet_item (
      mutasi_id, bahan_baku_id, qty_diajukan
    ) VALUES (
      v_mutasi_id,
      (v_item->>'bahan_baku_id')::UUID,
      (v_item->>'qty_diajukan')::NUMERIC
    );
  END LOOP;

  RETURN v_mutasi_id;
END;
$function$;

-- Versi lama (tanpa kurir/ongkir) dipakai aplikasi yang belum diperbarui: tolak dengan
-- pesan yang bisa ditindaklanjuti, bukan "function not found".
CREATE OR REPLACE FUNCTION public.ajukan_mutasi(
  p_outlet_asal_id uuid,
  p_outlet_tujuan_id uuid,
  p_catatan text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Nama kurir dan ongkir wajib diisi. Perbarui aplikasi ke versi terbaru.'
    USING ERRCODE = '22023';
END;
$function$;

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

  -- Kurir & ongkir dari pengajuan sudah disetujui Admin Kitchen: kunci yang sudah ada
  -- menang atas kiriman pengirim (operator || : kanan menimpa kiri).
  UPDATE mutasi_antar_outlet
  SET status = 'dikirim',
      kurir_info = COALESCE(p_kurir_info, '{}'::jsonb) || COALESCE(v_mutasi.kurir_info, '{}'::jsonb),
      updated_at = NOW()
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

GRANT EXECUTE ON FUNCTION public.ajukan_mutasi(uuid, uuid, text, jsonb, text, numeric) TO authenticated;
