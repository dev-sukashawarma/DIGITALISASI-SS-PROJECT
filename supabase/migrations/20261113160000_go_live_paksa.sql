-- Go-Live paksa (permintaan owner 13 Nov 2026).
-- Admin/developer (pembukaan_outlet_cek_peran(true), sama dengan Go-Live biasa) boleh
-- meresmikan outlet walau langkah wajib di papan belum selesai, ASAL memberi alasan
-- (min 10 karakter). Alasan + kunci langkah yang dilewati dicatat di outlet_pembukaan_log
-- (aksi 'go_live', detail.paksa = true). Tanpa alasan perilakunya sama seperti dulu.
-- Tanda tangan berubah (parameter ke-4 ber-DEFAULT) -> DROP dulu agar PostgREST tidak
-- melihat dua overload. Pemanggil 3 argumen tetap jalan.

DROP FUNCTION IF EXISTS public.go_live_outlet(uuid, text, date);

CREATE FUNCTION public.go_live_outlet(
  p_outlet_id uuid, p_konfirmasi_nama text, p_tanggal date, p_alasan_paksa text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_status   jsonb;
  v_kurang   text;
  v_seed     int;
  v_paksa    boolean := false;
  v_dilewati jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);

  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan';
  END IF;
  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'Outlet sudah tidak berstatus Persiapan';
  END IF;
  IF lower(btrim(coalesce(p_konfirmasi_nama, ''))) <> lower(btrim(o.name)) THEN
    RAISE EXCEPTION 'Nama konfirmasi tidak cocok dengan nama outlet';
  END IF;
  IF p_tanggal IS NULL OR abs(p_tanggal - v_hari_ini) > 7 THEN
    RAISE EXCEPTION 'Tanggal Go-Live harus dalam 7 hari dari hari ini';
  END IF;

  v_status := public.status_persiapan_outlet(p_outlet_id);
  IF NOT (v_status->>'siap_go_live')::boolean THEN
    SELECT string_agg(e->>'label', ', '), coalesce(jsonb_agg(e->>'kunci'), '[]'::jsonb)
      INTO v_kurang, v_dilewati
    FROM jsonb_array_elements(v_status->'langkah') e
    WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean;
    -- Go-Live paksa (owner 13 Nov): admin/developer boleh melewati langkah wajib
    -- asal memberi alasan; alasan + langkah yang dilewati masuk riwayat.
    IF length(btrim(coalesce(p_alasan_paksa, ''))) < 10 THEN
      RAISE EXCEPTION 'Langkah wajib belum selesai: %. Go-Live paksa butuh alasan (minimal 10 karakter).', v_kurang;
    END IF;
    v_paksa := true;
  END IF;

  -- Baris stok nol untuk bahan yang belum punya baris, SEBELUM outlet aktif:
  -- trigger alert stok kritis melewati outlet nonaktif, dan GUC app.ganti_satuan
  -- di sini dipakai sebagai saklar "tanpa efek samping" (bukan karena ganti satuan)
  -- untuk trigger yang memeriksanya di klausa WHEN.
  PERFORM set_config('app.ganti_satuan', 'on', true);
  INSERT INTO public.stok_balance (outlet_id, bahan_baku_id, saldo)
  SELECT p_outlet_id, b.id, 0
  FROM public.bahan_baku b
  WHERE b.is_active AND b.peruntukan IN ('outlet', 'keduanya')
  ON CONFLICT (outlet_id, bahan_baku_id) DO NOTHING;
  GET DIAGNOSTICS v_seed = ROW_COUNT;
  PERFORM set_config('app.ganti_satuan', '', true);

  -- Satu-satunya jalan keluar dari Persiapan (lihat trg_zz_outlets_jaga_persiapan).
  PERFORM set_config('app.pembukaan_outlet', 'on', true);
  UPDATE public.outlets
  SET status = 'active', is_bom_enabled = true, go_live_at = now(), go_live_by = auth.uid(),
      tanggal_grand_opening = p_tanggal, updated_at = now()
  WHERE id = p_outlet_id;
  PERFORM set_config('app.pembukaan_outlet', '', true);

  UPDATE public.mitra_investments SET tanggal_mulai = p_tanggal, updated_at = now()
  WHERE outlet_id = p_outlet_id;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'go_live',
    CASE WHEN v_paksa THEN btrim(p_alasan_paksa) END,
    jsonb_build_object('tanggal', p_tanggal, 'stok_balance_dibuat', v_seed,
                       'paksa', v_paksa, 'langkah_dilewati', v_dilewati));

  RETURN jsonb_build_object('outlet_id', p_outlet_id, 'stok_balance_dibuat', v_seed,
                            'paksa', v_paksa, 'langkah_dilewati', v_dilewati);
END;
$$;

REVOKE ALL ON FUNCTION public.go_live_outlet(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.go_live_outlet(uuid, text, date, text) TO authenticated;
